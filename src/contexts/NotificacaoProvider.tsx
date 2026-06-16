
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  Platform, Vibration, AppState,
  Animated, TouchableOpacity, Image, Text, View, StyleSheet,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection, query, where, onSnapshot, orderBy, limit,
  getDoc, doc as firestoreDoc, setDoc, serverTimestamp,
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

const PLACEHOLDER_FOTO = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

// ════ TIPOS PÚBLICOS ════
export interface ChatNotif {
  id: string;            // conversaId + timestamp (único)
  nome: string;
  foto: string | null;
  corpo: string;
  outroUid: string;
  outroNome: string;
  quando: Date;
}

// ════ CONTEXTO ════
interface NotificacaoContextType {
  conversaAtiva: string | null;
  setConversaAtiva: (id: string | null) => void;
  notificacoesChat: ChatNotif[];
  limparNotificacoesChat: () => void;
}
const NotificacaoContext = createContext<NotificacaoContextType>({
  conversaAtiva: null,
  setConversaAtiva: () => {},
  notificacoesChat: [],
  limparNotificacoesChat: () => {},
});
export const useNotificacao = () => useContext(NotificacaoContext);

// ════ PROVIDER ════
export const NotificacaoProvider = ({ children }: { children: React.ReactNode }) => {
  const { notifGeral, notifMatch, notifEventos, somNotif, vibracao } = useAppSettings();

  const [uidAtual, setUidAtual] = useState<string | null>(null);
  const [serie, setSerie] = useState<string | null>(null);
  const [conversaAtiva, setConversaAtiva] = useState<string | null>(null);
  const [notificacoesChat, setNotificacoesChat] = useState<ChatNotif[]>([]);
  const limparNotificacoesChat = () => setNotificacoesChat([]);

  // ── Banner in-app ─────────────────────────────────────────
  interface BannerDados {
    nome: string;
    foto: string | null;
    corpo: string;
    outroUid: string;
    outroNome: string;
  }
  const [bannerMsg, setBannerMsg] = useState<BannerDados | null>(null);
  const bannerAnim  = useRef(new Animated.Value(0)).current;  // 0 = invisível, 1 = visível
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs (evitam closures velhas dentro dos listeners)
  const conversaAtivaRef = useRef<string | null>(null);
  const notifGeralRef    = useRef(true);
  const notifMatchRef    = useRef(true);
  const notifEventosRef  = useRef(true);
  const somNotifRef      = useRef('Normal');
  const vibracaoRef      = useRef(true);

  const ultimasMensagensRef = useRef<Record<string, string>>({});

  // ── Helpers do banner ────────────────────────────────────
  const esconderBanner = () => {
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    Animated.timing(bannerAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setBannerMsg(null);
    });
  };

  const mostrarBanner = (dados: BannerDados) => {
    bannerAnim.setValue(0);       // reset antes do mount → view começa invisível
    setBannerMsg(dados);          // dispara re-render → Animated.View monta
    // A animação é iniciada no useEffect abaixo, APÓS o view existir no native side
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(esconderBanner, 4000);
  };

  // Inicia fade-in SÓ após o Animated.View ter sido montado (resolve race com useNativeDriver)
  useEffect(() => {
    if (!bannerMsg) return;
    Animated.timing(bannerAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bannerMsg]);

  // Ref para evitar stale closure nos listeners Firestore
  const mostrarBannerRef = useRef<(dados: BannerDados) => void>(() => {});

  // ── Mantém refs atualizadas ──
  useEffect(() => { mostrarBannerRef.current = mostrarBanner; }); // sem deps → atualiza em todo render
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

  // ════ 2️⃣b ONLINE STATUS GLOBAL ════
  // Marca online ao logar; atualiza conforme AppState; marca offline ao sair
  useEffect(() => {
    if (!uidAtual) return;
    const userRef = firestoreDoc(db, 'usuarios', uidAtual);

    // Marca online imediatamente
    setDoc(userRef, { online: true }, { merge: true });

    const handler = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setDoc(userRef, { online: true }, { merge: true });
      } else {
        // background ou inactive → offline + registra ultimo_acesso
        setDoc(userRef, { online: false, ultimo_acesso: serverTimestamp() }, { merge: true });
      }
    });

    return () => {
      handler.remove();
      setDoc(userRef, { online: false, ultimo_acesso: serverTimestamp() }, { merge: true });
    };
  }, [uidAtual]);

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

      // ── Dados disponíveis diretamente na conversa ─────────────────────
      const nome  = conversa.dadosMembros?.[remetenteUid]?.nome || 'Mensagem nova';
      const foto  = conversa.dadosMembros?.[remetenteUid]?.foto || null;
      // ultimaMensagem já vem "📷 Imagem" para fotos (Chat.tsx linha 496)
      const corpo = (String(conversa.ultimaMensagem || '')).substring(0, 120);

      // Dedup via timestamp da conversa (não precisa buscar msgId pra o banner)
      const tsKey = conversa.data_postagem?.seconds?.toString() || String(Date.now());
      const chaveConversa = `${conversaId}_${tsKey}`;
      if (ultimasMensagensRef.current[conversaId] === chaveConversa) return;
      ultimasMensagensRef.current[conversaId] = chaveConversa;

      vibrar();

      // ── Banner in-app: imediato, sem nenhuma query extra ─────────────
      mostrarBannerRef.current({ nome, foto, corpo, outroUid: remetenteUid, outroNome: nome });

      // ── Histórico de notificações (sino na Index) ─────────────────────
      const novaNotifChat: ChatNotif = {
        id: `${conversaId}_${Date.now()}`,
        nome, foto, corpo,
        outroUid: remetenteUid, outroNome: nome,
        quando: new Date(),
      };
      setNotificacoesChat(prev => [novaNotifChat, ...prev].slice(0, 20));

      // ── Notificação do sistema: busca msgId pro dedup correto ─────────
      // (erro aqui não afeta o banner – bloco independente)
      try {
        const qUltima = query(
          collection(db, 'mensagens'),
          where('conversaId', '==', conversaId),
          orderBy('data_postagem', 'desc'),
          limit(1)
        );
        let unsubInner: (() => void) | undefined;
        const snapMsgs = await new Promise<any>((resolve, reject) => {
          const timer = setTimeout(() => { unsubInner?.(); reject(new Error('timeout')); }, 5000);
          unsubInner = onSnapshot(qUltima, (s) => {
            clearTimeout(timer);
            unsubInner?.();
            resolve(s);
          }, (err) => { clearTimeout(timer); reject(err); });
        });

        if (!snapMsgs.empty) {
          const ultimaMsg  = snapMsgs.docs[0];
          const msgData    = ultimaMsg.data();
          const msgId      = ultimaMsg.id;
          const chaveNotif = `notif_msg_${msgId}`;

          if (!(await AsyncStorage.getItem(chaveNotif))) {
            const horario = (msgData.data_postagem?.toDate?.() || new Date())
              .toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            await Notifications.scheduleNotificationAsync({
              content: {
                title: nome,
                body:  corpo,
                subtitle: horario,
                sound: somNotifRef.current !== 'Nenhum' ? 'default' : undefined,
                badge: 1,
                data: { tipo: 'mensagem', conversaId, outroUid: remetenteUid, outroNome: nome },
              },
              trigger: null,
            });
            await AsyncStorage.setItem(chaveNotif, '1');
          }
        }
      } catch { /* erro de sistema não cancela o banner – ignora */ }

      console.log(`✅ Banner: ${nome} — ${corpo.substring(0, 40)}`);
    } catch (e: any) {
      console.log('❌ Erro processarChat:', e.message);
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

  const fotoUri = bannerMsg?.foto
    ? (bannerMsg.foto.startsWith('http') || bannerMsg.foto.startsWith('data:')
        ? bannerMsg.foto
        : `data:image/jpeg;base64,${bannerMsg.foto}`)
    : PLACEHOLDER_FOTO;

  return (
    <NotificacaoContext.Provider value={{ conversaAtiva, setConversaAtiva, notificacoesChat, limparNotificacoesChat }}>
      <View style={{ flex: 1, overflow: 'visible' }}>
        {children}

        {/* ── Banner in-app (foto + nome + prévia da mensagem) ── */}
        {bannerMsg && (
          <Animated.View
            style={[bannerStyles.wrapper, { opacity: bannerAnim }]}
            // @ts-ignore
            pointerEvents="box-none"
          >
            <TouchableOpacity
              activeOpacity={0.92}
              style={bannerStyles.card}
              onPress={() => {
                esconderBanner();
                const nav = (globalThis as any).navigationRef;
                if (nav && bannerMsg)
                  nav.navigate('Chat', { outroUid: bannerMsg.outroUid, outroNome: bannerMsg.outroNome });
              }}
            >
              <Image source={{ uri: fotoUri }} style={bannerStyles.foto} />
              <View style={{ flex: 1 }}>
                <Text style={bannerStyles.nome} numberOfLines={1}>{bannerMsg.nome}</Text>
                <Text style={bannerStyles.corpo} numberOfLines={1}>{bannerMsg.corpo}</Text>
              </View>
              <TouchableOpacity onPress={esconderBanner} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={bannerStyles.fechar}>✕</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
    </NotificacaoContext.Provider>
  );
};

// ════ ESTILOS DO BANNER ════
const bannerStyles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 36,
    left: 14,
    right: 14,
    zIndex: 9999,
    elevation: 20,
    overflow: 'visible',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0B2046',
    borderRadius: 18,
    padding: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  foto:   { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1B3868' },
  nome:   { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  corpo:  { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 },
  fechar: { color: 'rgba(255,255,255,0.5)', fontSize: 17, paddingLeft: 4 },
});