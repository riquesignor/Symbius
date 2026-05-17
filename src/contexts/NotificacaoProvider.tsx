import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform, Vibration, AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection, query, where, onSnapshot, orderBy, limit,
  getDoc, doc as firestoreDoc,
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { useAppSettings } from './AppSettingsContext';

// ════ SETUP EXPO NOTIFICATIONS ════
// Define como notificações aparecem quando app tá em foreground
Notifications.setNotificationHandler({
  handleNotification: async () => {
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    } as any;
  },
});

// ════ INTERFACE DO CONTEXTO ════
interface NotificacaoContextType {
  // Chat avisa qual conversa tá aberta (pra não notificar dela)
  conversaAtiva: string | null;
  setConversaAtiva: (id: string | null) => void;
}

const NotificacaoContext = createContext<NotificacaoContextType>({
  conversaAtiva: null,
  setConversaAtiva: () => {},
});

// ════ HOOK PRA USAR EM OUTRAS TELAS ════
export const useNotificacao = () => useContext(NotificacaoContext);

// ════ PROVIDER ════
export const NotificacaoProvider = ({ children }: { children: React.ReactNode }) => {
  const { notifGeral, somNotif, vibracao } = useAppSettings();

  const [uidAtual, setUidAtual] = useState<string | null>(null);
  const [conversaAtiva, setConversaAtiva] = useState<string | null>(null);
  
  // Refs pra evitar problemas com closures dentro do listener
  const conversaAtivaRef = useRef<string | null>(null);
  const notifGeralRef = useRef(true);
  const somNotifRef = useRef('Normal');
  const vibracaoRef = useRef(true);
  const ultimasMensagensRef = useRef<Record<string, string>>({}); // {conversaId: ultimaMsgId}

  // ════ MANTÉM REFS ATUALIZADAS ════
  useEffect(() => { conversaAtivaRef.current = conversaAtiva; }, [conversaAtiva]);
  useEffect(() => { notifGeralRef.current = notifGeral; }, [notifGeral]);
  useEffect(() => { somNotifRef.current = somNotif; }, [somNotif]);
  useEffect(() => { vibracaoRef.current = vibracao; }, [vibracao]);

  // ════ 1️⃣ PEDIR PERMISSÃO DE NOTIFICAÇÕES ════
  useEffect(() => {
    const pedirPermissao = async () => {
      try {
        const { status: statusAtual } = await Notifications.getPermissionsAsync();
        
        if (statusAtual !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          if (status !== 'granted') {
            console.log('Usuário negou permissão de notificações');
            return;
          }
        }

        // Criar channel no Android (necessário pra notifs aparecerem)
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('mensagens', {
            name: 'Mensagens',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#E51C6A',
            sound: 'default',
            showBadge: true,
          });
        }

        console.log('✅ Permissões de notificação ok');
      } catch (e) {
        console.log('Erro permissão notif:', e);
      }
    };

    pedirPermissao();
  }, []);

  // ════ 2️⃣ CARREGAR UID DO USUÁRIO ════
  useEffect(() => {
    AsyncStorage.getItem('uid').then(uid => {
      if (uid) setUidAtual(uid);
    });
  }, []);

  // ════ 3️⃣ LISTENER GLOBAL — TODAS AS CONVERSAS DO USUÁRIO ════
  useEffect(() => {
    if (!uidAtual) return;

    console.log('Iniciando listener global de notificações para', uidAtual);

    // Query: todas as conversas onde EU sou membro
    const q = query(
      collection(db, 'conversas'),
      where('membros', 'array-contains', uidAtual)
    );

    const unsub = onSnapshot(q, async (snapshot) => {
      // Detectar mudanças (novas mensagens)
      snapshot.docChanges().forEach(async (change) => {
        // Só interessa quando uma conversa é MODIFICADA (nova mensagem)
        if (change.type !== 'modified' && change.type !== 'added') return;

        const conversa = change.doc.data();
        const conversaId = change.doc.id;

        // 1️⃣ A última mensagem foi enviada por OUTRO usuário?
        if (conversa.quemEnviou === uidAtual) return; // Eu mandei, ignora
        if (!conversa.quemEnviou) return; // Sem remetente, ignora

        // 2️⃣ O usuário JÁ TÁ vendo essa conversa? Se sim, não notifica
        if (conversaAtivaRef.current === conversaId) {
          console.log('Conversa ativa, sem notificar:', conversaId);
          return;
        }

        // 3️⃣ Notificações estão ligadas?
        if (!notifGeralRef.current) {
          console.log('Notificações desligadas');
          return;
        }

        // 4️⃣ Buscar dados do remetente E última mensagem
        await processarNotificacaoChat(conversaId, conversa);
      });
    }, (err) => {
      console.log('Erro listener conversas:', err.message);
    });

    return () => {
      console.log('Parando listener global de notificações');
      unsub();
    };
  }, [uidAtual]);

  // ════ 4️⃣ PROCESSAR E ENVIAR NOTIFICAÇÃO ════
  const processarNotificacaoChat = async (conversaId: string, conversa: any) => {
    try {
      // Pegar quem mandou
      const remetenteUid = conversa.quemEnviou;

      // Buscar última mensagem real (pra pegar id, conteúdo, foto)
      const qUltima = query(
        collection(db, 'mensagens'),
        where('conversaId', '==', conversaId),
        orderBy('data_postagem', 'desc'),
        limit(1)
      );

      const snapMsgs = await new Promise<any>((resolve) => {
        const unsubTemp = onSnapshot(qUltima, (s) => {
          unsubTemp();
          resolve(s);
        });
      });

      if (snapMsgs.empty) return;

      const ultimaMsg = snapMsgs.docs[0];
      const msgData = ultimaMsg.data();
      const msgId = ultimaMsg.id;

      // Verificar dedup (essa mensagem já notificou?)
      if (ultimasMensagensRef.current[conversaId] === msgId) {
        return;
      }
      ultimasMensagensRef.current[conversaId] = msgId;

      // Verificar AsyncStorage também (persistente)
      const chaveDedup = `notif_msg_${msgId}`;
      const jaNotificou = await AsyncStorage.getItem(chaveDedup);
      if (jaNotificou) return;

      // ════ MONTAR DADOS DA NOTIFICAÇÃO ════

      // Nome do remetente
      const nome = conversa.dadosMembros?.[remetenteUid]?.nome 
        || msgData.nome_remetente 
        || 'Mensagem nova';

      // Foto do remetente (pode ser base64 ou URL)
      let foto = conversa.dadosMembros?.[remetenteUid]?.foto || msgData.foto || null;

      // Se foto é base64 sem prefixo, adicionar
      if (foto && typeof foto === 'string' && !foto.startsWith('http') && !foto.startsWith('data:')) {
        foto = `data:image/jpeg;base64,${foto}`;
      }

      // Conteúdo da mensagem
      const corpo = msgData.tipo === 'imagem' 
        ? '📷 Imagem' 
        : (msgData.mensagem || '').substring(0, 100);

      // Horário formatado
      const data = msgData.data_postagem?.toDate?.() || new Date();
      const horario = data.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });

      // ════ VIBRAR ════
      if (vibracaoRef.current) {
        const padroes: Record<string, number[]> = {
          'Leve': [0, 50],
          'Normal': [0, 100, 50, 100],
          'Forte': [0, 200, 100, 200, 100, 200],
        };
        const padrao = padroes[somNotifRef.current] || padroes['Normal'];
        Vibration.vibrate(padrao);
      }

      // ════ ENVIAR NOTIFICAÇÃO ════
      await Notifications.scheduleNotificationAsync({
        content: {
          title: nome,                              // Nome aparece em destaque
          body: corpo,                              // Mensagem aparece embaixo
          sound: somNotifRef.current !== 'Nenhum' ? 'default' : undefined,
          badge: 1,
          
          // Estilo iOS-like com subtitle (horário)
          subtitle: horario,
          
          // Dados pra quando user tocar
          data: {
            tipo: 'mensagem',
            conversaId,
            outroUid: remetenteUid,
            outroNome: nome,
            msgId,
          },

          // Android-specific: foto grande estilo WhatsApp
          ...(Platform.OS === 'android' && foto ? {
            attachments: [{
              identifier: 'avatar',
              url: foto,
              type: 'image',
            }],
          } : {}),
        },
        
        // Channel pro Android
        ...(Platform.OS === 'android' ? {
          identifier: `chat_${conversaId}_${msgId}`,
        } : {}),
        
        trigger: null, // Imediato
      });

      // Marcar como notificado (persistente, evita duplicata)
      await AsyncStorage.setItem(chaveDedup, '1');

      console.log(`✅ Notificou: ${nome} - ${corpo}`);
    } catch (e: any) {
      console.log('Erro ao notificar:', e.message);
    }
  };

  // ════ 5️⃣ LIDAR COM TOQUE NA NOTIFICAÇÃO ════
  useEffect(() => {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response?.notification?.request?.content?.data as any;
    
    console.log('User tocou notificação:', data);

    if (data && data.tipo === 'mensagem' && (globalThis as any).navigationRef) {
      try {
        (globalThis as any).navigationRef.navigate('Chat', {
          outroUid: data.outroUid || '',
          outroNome: data.outroNome || 'Chat',
        });
      } catch (e) {
        console.log('Erro ao navegar:', e);
      }
    }
  });

  return () => sub.remove();
}, []);

  // ════ 6️⃣ LIMPAR DADOS AO SAIR DO APP ════
  useEffect(() => {
    const handler = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        // App voltou pro foreground, zera badge
        Notifications.setBadgeCountAsync(0);
      }
    });
    return () => handler.remove();
  }, []);

  return (
    <NotificacaoContext.Provider value={{ conversaAtiva, setConversaAtiva }}>
      {children}
    </NotificacaoContext.Provider>
  );
};
