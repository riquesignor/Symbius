
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
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }) as any,
});

// ════ HELPERS ════
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// Extrai a série (ex: "3º") a partir da turma (ex: "3º - Info - A")
const extrairSerie = (turma: string): string | null => {
  if (!turma) return null;
  const match = turma.match(/^(\d+)/);
  return match ? `${match[1]}º` : null;
};

// Subcollections de eventos_admin/tipos/{sub}
const EVENTO_SUBS: { tipo: string; sub: string }[] = [
  { tipo: 'Prova',   sub: 'provas'   },
  { tipo: 'Feriado', sub: 'feriados' },
  { tipo: 'Aviso',   sub: 'avisos'   },
  { tipo: 'Evento',  sub: 'eventos'  },
];

// ════ CONTEXTO ════
interface NotificacaoContextType {
  conversaAtiva: string | null;
  setConversaAtiva: (id: string | null) => void;
}
const NotificacaoContext = createContext<NotificacaoContextType>({
  conversaAtiva: null,
  setConversaAtiva: () => {},
});
export const useNotificacao = () => useContext(NotificacaoContext);

// ════ PROVIDER ════
export const NotificacaoProvider = ({ children }: { children: React.ReactNode }) => {
  const { notifGeral, notifMatch, notifEventos, somNotif, vibracao } = useAppSettings();

  const [uidAtual, setUidAtual] = useState<string | null>(null);
  const [serie, setSerie] = useState<string | null>(null);
  const [conversaAtiva, setConversaAtiva] = useState<string | null>(null);

  // Refs (evitam closures velhas dentro dos listeners)
  const conversaAtivaRef = useRef<string | null>(null);
  const notifGeralRef    = useRef(true);
  const notifMatchRef    = useRef(true);
  const notifEventosRef  = useRef(true);
  const somNotifRef      = useRef('Normal');
  const vibracaoRef      = useRef(true);

  const ultimasMensagensRef = useRef<Record<string, string>>({});

  // ── Mantém refs atualizadas ──
  useEffect(() => { conversaAtivaRef.current = conversaAtiva; }, [conversaAtiva]);
  useEffect(() => { notifGeralRef.current   = notifGeral;   }, [notifGeral]);
  useEffect(() => { notifMatchRef.current   = notifMatch;   }, [notifMatch]);
  useEffect(() => { notifEventosRef.current = notifEventos; }, [notifEventos]);
  useEffect(() => { somNotifRef.current     = somNotif;     }, [somNotif]);
  useEffect(() => { vibracaoRef.current     = vibracao;     }, [vibracao]);

  // ── Vibração conforme intensidade ──
  const vibrar = () => {
    if (!vibracaoRef.current) return;
    const s = somNotifRef.current;
    if (s === 'Leve')   Vibration.vibrate(20);
    else if (s === 'Forte') Vibration.vibrate([50, 20, 50, 20, 50]);
    else Vibration.vibrate([30, 10, 30]); // Normal (default)
  };

  // ════ 1️⃣ PERMISSÃO + CANAL ANDROID ════
  useEffect(() => {
    (async () => {
      try {
        const { status: atual } = await Notifications.getPermissionsAsync();
        if (atual !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          if (status !== 'granted') {
            console.log('⚠️ Permissão de notificações negada');
            return;
          }
        }
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('jumo', {
            name: 'JUMO',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#E51C6A',
            sound: 'default',
            showBadge: true,
          });
        }
      } catch (e) { console.log('Erro permissão notif:', e); }
    })();
  }, []);

  // ════ 2️⃣ CARREGA UID + SÉRIE ════
  useEffect(() => {
    (async () => {
      const uid = await AsyncStorage.getItem('uid');
      if (!uid) return;
      setUidAtual(uid);
      try {
        const snap = await getDoc(firestoreDoc(db, 'usuarios', uid));
        if (snap.exists()) setSerie(extrairSerie(snap.data().turma || ''));
      } catch (e) { console.log('Erro série:', e); }
    })();
  }, []);

  // ════ 3️⃣ LISTENER — CHAT (todas as conversas do usuário) ════
  useEffect(() => {
    if (!uidAtual) return;
    let primeiraCarga = true; // não notifica a leva inicial ao abrir o app

    const q = query(
      collection(db, 'conversas'),
      where('membros', 'array-contains', uidAtual)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      if (primeiraCarga) {
        primeiraCarga = false;
        return;
      }
      snapshot.docChanges().forEach((change) => {
        if (change.type !== 'modified' && change.type !== 'added') return;
        const conversa = change.doc.data();
        const conversaId = change.doc.id;

        if (!conversa.quemEnviou || conversa.quemEnviou === uidAtual) return; // eu mandei
        if (conversaAtivaRef.current === conversaId) return;                  // já estou vendo
        if (!notifGeralRef.current) return;

        processarChat(conversaId, conversa);
      });
    }, (err) => console.log('❌ Erro listener conversas:', err.message));

    return () => unsub();
  }, [uidAtual]);

  const processarChat = async (conversaId: string, conversa: any) => {
    try {
      const remetenteUid = conversa.quemEnviou;
      const qUltima = query(
        collection(db, 'mensagens'),
        where('conversaId', '==', conversaId),
        orderBy('data_postagem', 'desc'),
        limit(1)
      );
      const snapMsgs = await new Promise<any>((resolve) => {
        const u = onSnapshot(qUltima, (s) => { u(); resolve(s); });
      });
      if (snapMsgs.empty) return;

      const ultimaMsg = snapMsgs.docs[0];
      const msgData = ultimaMsg.data();
      const msgId = ultimaMsg.id;

      if (ultimasMensagensRef.current[conversaId] === msgId) return;
      ultimasMensagensRef.current[conversaId] = msgId;

      const chaveDedup = `notif_msg_${msgId}`;
      if (await AsyncStorage.getItem(chaveDedup)) return;

      const nome = conversa.dadosMembros?.[remetenteUid]?.nome
        || msgData.nome_remetente || 'Mensagem nova';
      const corpo = msgData.tipo === 'imagem'
        ? '📷 Imagem'
        : (msgData.mensagem || '').substring(0, 120);
      const horario = (msgData.data_postagem?.toDate?.() || new Date())
        .toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      vibrar();
      await Notifications.scheduleNotificationAsync({
        content: {
          title: nome,
          body: corpo,
          subtitle: horario,
          sound: somNotifRef.current !== 'Nenhum' ? 'default' : undefined,
          badge: 1,
          data: { tipo: 'mensagem', conversaId, outroUid: remetenteUid, outroNome: nome },
        },
        trigger: null,
      });
      await AsyncStorage.setItem(chaveDedup, '1');
      console.log(`✅ Notif chat: ${nome}`);
    } catch (e: any) {
      console.log('❌ Erro notif chat:', e.message);
    }
  };

  // ════ 4️⃣ LISTENER — MATCH (solicitações recebidas) ════
  useEffect(() => {
    if (!uidAtual) return;
    let primeiraCarga = true;

    const q = query(
      collection(db, 'match_solicitacoes'),
      where('paraUid', '==', uidAtual),
      where('status', '==', 'pendente')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      if (primeiraCarga) {
        primeiraCarga = false;
        return;
      }
      snapshot.docChanges().forEach((change) => {
        if (change.type !== 'added') return;
        if (!notifGeralRef.current || !notifMatchRef.current) return;
        processarMatch(change.doc.id, change.doc.data());
      });
    }, (err) => console.log('❌ Erro listener match:', err.message));

    return () => unsub();
  }, [uidAtual]);

  const processarMatch = async (solId: string, sol: any) => {
    try {
      const chaveDedup = `notif_sol_${solId}`;
      if (await AsyncStorage.getItem(chaveDedup)) return;

      let nome = 'Alguém';
      try {
        const rSnap = await getDoc(firestoreDoc(db, 'usuarios', sol.deUid));
        if (rSnap.exists()) nome = rSnap.data().nome_completo || 'Alguém';
      } catch {}

      vibrar();
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🎓 Nova solicitação de match',
          body: `${nome} quer estudar com você!`,
          sound: somNotifRef.current !== 'Nenhum' ? 'default' : undefined,
          badge: 1,
          data: { tipo: 'solicitacao_match', solicitacaoId: solId, deUid: sol.deUid },
        },
        trigger: null,
      });
      await AsyncStorage.setItem(chaveDedup, '1');
      console.log(`✅ Notif match: ${nome}`);
    } catch (e: any) {
      console.log('❌ Erro notif match:', e.message);
    }
  };

  // ════ 5️⃣ LISTENER — EVENTOS (novos eventos da série do aluno) ════
  useEffect(() => {
    if (!uidAtual || !serie) return;
    const unsubs: (() => void)[] = [];

    EVENTO_SUBS.forEach(({ tipo, sub }) => {
      let primeiraCarga = true;
      const q = query(
        collection(db, 'eventos_admin', 'tipos', sub),
        where('series', 'array-contains', serie)
      );
      const unsub = onSnapshot(q, (snapshot) => {
        if (primeiraCarga) {
          primeiraCarga = false;
          return;
        }
        snapshot.docChanges().forEach((change) => {
          if (change.type !== 'added') return;
          if (!notifGeralRef.current || !notifEventosRef.current) return;
          processarEvento(tipo, change.doc.id, change.doc.data());
        });
      }, (err) => console.log(`❌ Erro listener eventos/${sub}:`, err.message));
      unsubs.push(unsub);
    });

    return () => unsubs.forEach(u => u());
  }, [uidAtual, serie]);

  const processarEvento = async (tipo: string, evId: string, ev: any) => {
    try {
      const chaveDedup = `notif_evt_${evId}`;
      if (await AsyncStorage.getItem(chaveDedup)) return;

      let quando = '';
      try {
        const [, m, d] = (ev.data || '').split('-').map(Number);
        if (m && d) quando = ` • ${d} de ${MESES[m - 1]}`;
      } catch {}

      vibrar();
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `📅 ${String(tipo).toUpperCase()}`,
          body: `${ev.titulo || 'Novo evento'}${quando}`,
          sound: somNotifRef.current !== 'Nenhum' ? 'default' : undefined,
          badge: 1,
          data: { tipo: 'evento_admin', eventoId: evId },
        },
        trigger: null,
      });
      await AsyncStorage.setItem(chaveDedup, '1');
      console.log(`✅ Notif evento: ${ev.titulo}`);
    } catch (e: any) {
      console.log('❌ Erro notif evento:', e.message);
    }
  };

  // ════ 6️⃣ TOQUE NA NOTIFICAÇÃO → abre a tela certa ════
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data: any = response.notification.request.content.data;
      const nav = (globalThis as any).navigationRef;

      if (!nav || !data) return;

      if (data.tipo === 'mensagem') {
        nav.navigate('Chat', { outroUid: data.outroUid, outroNome: data.outroNome });
      } else if (data.tipo === 'solicitacao_match') {
        nav.navigate('Match', { uid: uidAtual });
      } else if (data.tipo === 'evento_admin') {
        nav.navigate('Calendario', { uid: uidAtual });
      }
    });
    return () => sub.remove();
  }, [uidAtual]);

  // ════ 7️⃣ ZERA BADGE AO VOLTAR PRO APP ════
  useEffect(() => {
    const handler = AppState.addEventListener('change', (state) => {
      if (state === 'active') Notifications.setBadgeCountAsync(0);
    });
    return () => handler.remove();
  }, []);

  return (
    <NotificacaoContext.Provider value={{ conversaAtiva, setConversaAtiva }}>
      {children}
    </NotificacaoContext.Provider>
  );
};