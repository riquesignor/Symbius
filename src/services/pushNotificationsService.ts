import { Platform, PermissionsAndroid } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  getMessaging,
  getToken,
  onMessage,
  onNotificationOpenedApp,
  onTokenRefresh,
  getInitialNotification,
  type RemoteMessage,
} from '@react-native-firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';
import { db, auth } from '../config/firebaseConfig';
import { API_BASE_URL } from '../config/apiConfig';

// ══════════════════════════════════════════════════════════════════════
// Push notifications via Firebase Cloud Messaging (FCM nativo).
// Entrega mesmo com o app fechado — diferente das notificações locais do
// NotificacaoProvider, que só disparam com o app aberto (listener Firestore).
// ══════════════════════════════════════════════════════════════════════

const messagingApp = getMessaging();

export const pedirPermissaoPush = async (): Promise<boolean> => {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    const resultado = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    );
    if (resultado !== PermissionsAndroid.RESULTS.GRANTED) return false;
    return true;
  }

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
};

export const obterTokenFcm = async (): Promise<string | null> => {
  try {
    return await getToken(messagingApp);
  } catch (e) {
    console.log('Erro ao obter token FCM:', e);
    return null;
  }
};

export const salvarTokenFcm = async (uid: string, token: string): Promise<void> => {
  try {
    await setDoc(doc(db, 'usuarios', uid), { fcmToken: token }, { merge: true });
  } catch (e) {
    console.log('Erro ao salvar token FCM:', e);
  }
};

// Chamar uma vez, logo após o login/sessão confirmada
export const configurarPushParaUsuario = async (uid: string): Promise<void> => {
  const permitido = await pedirPermissaoPush();
  if (!permitido) {
    console.log('⚠️ Permissão de push negada');
    return;
  }

  const token = await obterTokenFcm();
  if (token) await salvarTokenFcm(uid, token);

  // Token pode mudar (reinstalação, restore de backup, etc) — mantém salvo
  onTokenRefresh(messagingApp, (novoToken) => {
    salvarTokenFcm(uid, novoToken);
  });
};

// Notificação chegou com o app ABERTO (foreground) — FCM não mostra alerta
// sozinho nesse estado, então repassamos pro handler local existente.
export const registrarListenerForeground = (
  aoReceber: (mensagem: RemoteMessage) => void
) => onMessage(messagingApp, async (mensagem) => aoReceber(mensagem));

// Usuário tocou na notificação com o app em BACKGROUND (processo vivo, não em foco)
export const registrarListenerToqueBackground = (
  aoTocar: (mensagem: RemoteMessage) => void
) => onNotificationOpenedApp(messagingApp, (mensagem) => aoTocar(mensagem));

// App estava FECHADO (processo morto) e abriu por causa do toque na notificação
export const obterNotificacaoQueAbriuApp = async (): Promise<RemoteMessage | null> => {
  return getInitialNotification(messagingApp);
};

// ── Disparo do push (chamado pelo app logo após salvar no Firestore) ──
interface DispararPushParams {
  destinatarioUid: string;
  titulo: string;
  corpo: string;
  dados?: Record<string, string>;
}

// Falha aqui nunca deve travar o fluxo principal (mensagem/match já foram
// salvos no Firestore antes de chamar isso) — por isso só loga o erro.
export const dispararPush = async ({ destinatarioUid, titulo, corpo, dados }: DispararPushParams): Promise<void> => {
  try {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) return;

    await fetch(`${API_BASE_URL}/api/enviar-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ destinatarioUid, titulo, corpo, dados }),
    });
  } catch (e) {
    console.log('Erro ao disparar push:', e);
  }
};
