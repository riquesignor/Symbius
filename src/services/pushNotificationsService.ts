import { Platform, PermissionsAndroid } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { RemoteMessage } from '@react-native-firebase/messaging';
import { doc, setDoc, deleteField } from 'firebase/firestore';
import { db, auth } from '../config/firebaseConfig';
import { API_BASE_URL } from '../config/apiConfig';

// ══════════════════════════════════════════════════════════════════════
// Push notifications via Firebase Cloud Messaging (FCM nativo) — entrega
// mesmo com o app fechado. O módulo nativo não existe na web (npm run web),
// então tudo aqui vira no-op por lá.
// ══════════════════════════════════════════════════════════════════════

const rnfb: typeof import('@react-native-firebase/messaging') | null =
  Platform.OS === 'web' ? null : require('@react-native-firebase/messaging');
const messagingApp = rnfb ? rnfb.getMessaging() : null;

export type { RemoteMessage };

export const CANAL_ANDROID = 'symbius';

export const pedirPermissaoPush = async (): Promise<boolean> => {
  if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
    const resultado = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    return resultado === PermissionsAndroid.RESULTS.GRANTED;
  }
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
};

const salvarTokenFcm = async (uid: string, token: string) => {
  try {
    await setDoc(doc(db, 'usuarios', uid), { fcmToken: token }, { merge: true });
  } catch (e) {
    console.log('Erro ao salvar token FCM:', e);
  }
};

// Chamar sempre que houver um usuário logado. O token é salvo mesmo se a
// permissão for negada: a mensagem ainda chega com o app aberto (onMessage)
// e vira banner in-app; a permissão só controla a notificação do sistema.
export const configurarPushParaUsuario = async (uid: string): Promise<() => void> => {
  if (!rnfb || !messagingApp) return () => {};

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CANAL_ANDROID, {
      name: 'Symbius',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1F3D2B',
      sound: 'default',
      showBadge: true,
    }).catch(() => {});
  }

  await pedirPermissaoPush().catch(() => false);

  try {
    const token = await rnfb.getToken(messagingApp);
    if (token) await salvarTokenFcm(uid, token);
  } catch (e) {
    console.log('Erro ao obter token FCM:', e);
  }

  return rnfb.onTokenRefresh(messagingApp, (novoToken) => { salvarTokenFcm(uid, novoToken); });
};

// No logout: sem isso o aparelho continuaria recebendo push da conta anterior.
export const removerTokenFcm = async (uid: string) => {
  try {
    await setDoc(doc(db, 'usuarios', uid), { fcmToken: deleteField() }, { merge: true });
    if (rnfb && messagingApp) await rnfb.deleteToken(messagingApp);
  } catch (e) {
    console.log('Erro ao remover token FCM:', e);
  }
};

export const registrarListenerForeground = (aoReceber: (m: RemoteMessage) => void) =>
  rnfb && messagingApp ? rnfb.onMessage(messagingApp, async (m) => aoReceber(m)) : () => {};

export const registrarListenerToqueBackground = (aoTocar: (m: RemoteMessage) => void) =>
  rnfb && messagingApp ? rnfb.onNotificationOpenedApp(messagingApp, (m) => aoTocar(m)) : () => {};

export const obterNotificacaoQueAbriuApp = async (): Promise<RemoteMessage | null> =>
  rnfb && messagingApp ? rnfb.getInitialNotification(messagingApp) : null;

// ── Disparo (o app chama logo após salvar no Firestore) ──
// Falhas aqui nunca travam o fluxo principal — o dado já foi salvo.
const chamarBackend = async (rota: string, corpo: object) => {
  try {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) {
      console.log(`Push (${rota}) não enviado: sem sessão no Firebase Auth`);
      return;
    }
    const resp = await fetch(`${API_BASE_URL}/api/${rota}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify(corpo),
    });
    if (!resp.ok) console.log(`Push (${rota}) falhou:`, resp.status, await resp.text());
  } catch (e) {
    console.log(`Erro ao disparar push (${rota}):`, e);
  }
};

export type TipoPush =
  | 'mensagem' | 'solicitacao_match' | 'match_aceito' | 'evento_admin'
  | 'resumo_curtida' | 'resumo_comentario';

interface DispararPushParams {
  destinatarioUid: string;
  titulo: string;
  corpo: string;
  dados: { tipo: TipoPush } & Record<string, string>;
}

export const dispararPush = ({ destinatarioUid, titulo, corpo, dados }: DispararPushParams) =>
  chamarBackend('enviar-push', { destinatarioUid, titulo, corpo, dados });

// Só administradores (validado no backend) — manda pra todos os alunos das séries.
export const dispararPushSerie = (params: { series: string[]; titulo: string; corpo: string; dados: Record<string, string> }) =>
  chamarBackend('enviar-push-serie', params);
