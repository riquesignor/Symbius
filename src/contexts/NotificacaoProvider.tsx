import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  Platform, Vibration, AppState, Alert,
  Animated, TouchableOpacity, Image, Text, View, StyleSheet, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection, query, where, onSnapshot,
  doc as firestoreDoc, setDoc, serverTimestamp, getDoc,
} from 'firebase/firestore';
import { db, auth } from '../config/firebaseConfig';
import { useAppSettings } from './AppSettingsContext';
import { CORES_SYMBIUS } from '../constants/coresSymbius';
import { F } from '../constants/theme';
import { navegarGlobal, navegacaoRef } from '../navegacao';
import { sairDaConta } from '../services/authService';
import {
  configurarPushParaUsuario,
  registrarListenerForeground,
  registrarListenerToqueBackground,
  obterNotificacaoQueAbriuApp,
} from '../services/pushNotificationsService';

// ══════════════════════════════════════════════════════════════════════
// Dois caminhos de notificação, sem sobreposição:
//  • App em segundo plano/fechado → push do FCM (backend em api/), mostrado
//    pelo próprio sistema.
//  • App aberto → banner in-app deste provider. Mensagens, match e eventos
//    vêm de listeners do Firestore (não dependem do push chegar); curtidas e
//    comentários de resumo vêm do onMessage do FCM.
// ══════════════════════════════════════════════════════════════════════

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Push que chega com o app aberto vira banner só pros tipos sem listener próprio
// do Firestore abaixo (mensagens, solicitações e eventos já têm o deles).
const TIPOS_BANNER_PUSH = [
  'resumo_curtida', 'resumo_comentario', 'match_aceito', 'grupo_adicionado',
  'novo_post', 'checkin', 'conta_reativada', 'admin_nova_conta', 'admin_resumo',
];
const ICONE_POR_TIPO: Record<string, keyof typeof Ionicons.glyphMap> = {
  match_aceito: 'heart', resumo_curtida: 'thumbs-up', resumo_comentario: 'chatbubble-ellipses',
  grupo_adicionado: 'people', novo_post: 'newspaper', checkin: 'leaf',
  conta_reativada: 'checkmark-circle', admin_nova_conta: 'person-add', admin_resumo: 'clipboard',
};

const extrairSerie = (turma: string): string | null => {
  const match = (turma || '').match(/^(\d+)/);
  return match ? `${match[1]}º` : null;
};

const EVENTO_SUBS: { tipo: string; sub: string }[] = [
  { tipo: 'Prova',   sub: 'provas'   },
  { tipo: 'Feriado', sub: 'feriados' },
  { tipo: 'Aviso',   sub: 'avisos'   },
  { tipo: 'Evento',  sub: 'eventos'  },
];

export interface ChatNotif {
  id: string;
  nome: string;
  foto: string | null;
  corpo: string;
  outroUid: string;
  outroNome: string;
  grupoId?: string;
  quando: Date;
}

interface NotificacaoContextType {
  uidAtual: string | null;
  conversaAtiva: string | null;
  setConversaAtiva: (id: string | null) => void;
  notificacoesChat: ChatNotif[];
  limparNotificacoesChat: () => void;
}
const NotificacaoContext = createContext<NotificacaoContextType>({
  uidAtual: null,
  conversaAtiva: null,
  setConversaAtiva: () => {},
  notificacoesChat: [],
  limparNotificacoesChat: () => {},
});
export const useNotificacao = () => useContext(NotificacaoContext);

interface BannerDados {
  titulo: string;
  corpo: string;
  foto?: string | null;
  icone?: keyof typeof Ionicons.glyphMap;
  rota: string;
  params?: any;
}

// Rota de destino a partir do `data` de um push (toque na notificação do sistema).
export const rotaDoPush = (data: any, uid: string | null): { rota: string; params: any } | null => {
  if (!data?.tipo) return null;
  switch (data.tipo) {
    case 'mensagem':          return { rota: 'Chat', params: { outroUid: data.outroUid, outroNome: data.outroNome } };
    case 'solicitacao_match':
    case 'match_aceito':      return { rota: 'Match', params: { uid, aba: data.tipo === 'match_aceito' ? 'matches' : 'solicitacoes' } };
    case 'evento_admin':
    case 'lembrete':          return { rota: 'Calendario', params: { uid } };
    case 'resumo_curtida':
    case 'resumo_comentario': return { rota: 'Resumos', params: { uid, resumoId: data.resumoId } };
    case 'mensagem_grupo':
    case 'grupo_adicionado':  return { rota: 'GrupoChat', params: { uid, grupoId: data.grupoId } };
    case 'novo_post':         return { rota: 'Index', params: { uid, abrirPostId: data.postId } };
    case 'checkin':
    case 'conta_reativada':   return { rota: 'Index', params: { uid } };
    case 'admin_nova_conta':
    case 'admin_resumo':      return { rota: 'Admin', params: { uid } };
    default:                  return null;
  }
};

const fotoParaUri = (foto?: string | null) => {
  if (!foto) return null;
  return foto.startsWith('http') || foto.startsWith('data:') ? foto : `data:image/jpeg;base64,${foto}`;
};

export const NotificacaoProvider = ({ children }: { children: React.ReactNode }) => {
  const { notifGeral, notifMatch, notifEventos, notifAvisos, notifMensagens, vibracao, somNotif } = useAppSettings();

  const [uidAtual, setUidAtual] = useState<string | null>(auth.currentUser?.uid ?? null);
  const [serie, setSerie] = useState<string | null>(null);
  const [conversaAtiva, setConversaAtiva] = useState<string | null>(null);
  const [notificacoesChat, setNotificacoesChat] = useState<ChatNotif[]>([]);
  const limparNotificacoesChat = () => setNotificacoesChat([]);

  // ── Refs (listeners do Firestore não enxergam state novo) ──
  const prefsRef = useRef({ notifGeral, notifMatch, notifEventos, notifAvisos, notifMensagens, vibracao, somNotif });
  useEffect(() => {
    prefsRef.current = { notifGeral, notifMatch, notifEventos, notifAvisos, notifMensagens, vibracao, somNotif };
  }, [notifGeral, notifMatch, notifEventos, notifAvisos, notifMensagens, vibracao, somNotif]);
  const conversaAtivaRef = useRef<string | null>(null);
  useEffect(() => { conversaAtivaRef.current = conversaAtiva; }, [conversaAtiva]);
  const silenciadosRef = useRef<string[]>([]);
  const appAtivoRef = useRef(AppState.currentState === 'active');
  const uidRef = useRef<string | null>(uidAtual);
  useEffect(() => { uidRef.current = uidAtual; }, [uidAtual]);

  // ── Banner in-app ──
  const [banner, setBanner] = useState<BannerDados | null>(null);
  const [bannerVisivel, setBannerVisivel] = useState(false);
  const bannerAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-90)).current;
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const esconderBanner = () => {
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    Animated.parallel([
      Animated.timing(bannerAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -90, duration: 220, useNativeDriver: true }),
    ]).start(() => { setBannerVisivel(false); setBanner(null); });
  };

  const vibrar = () => {
    const { vibracao: vib, somNotif: som } = prefsRef.current;
    if (!vib || Platform.OS === 'web') return;
    if (som === 'Leve') Vibration.vibrate(20);
    else if (som === 'Forte') Vibration.vibrate([50, 20, 50, 20, 50]);
    else Vibration.vibrate([30, 10, 30]);
  };

  const mostrarBanner = (dados: BannerDados) => {
    if (!appAtivoRef.current || !prefsRef.current.notifGeral) return;
    vibrar();
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerAnim.setValue(0);
    slideAnim.setValue(-90);
    setBanner(dados);
    setBannerVisivel(true);
    bannerTimer.current = setTimeout(esconderBanner, 4500);
  };
  const mostrarBannerRef = useRef(mostrarBanner);
  useEffect(() => { mostrarBannerRef.current = mostrarBanner; });

  useEffect(() => {
    if (!bannerVisivel) return;
    Animated.parallel([
      Animated.timing(bannerAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, bounciness: 6 }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bannerVisivel]);

  // ════ SESSÃO — vem do Firebase Auth (persistido), vale pro login novo também ════
  useEffect(() => onAuthStateChanged(auth, (user) => setUidAtual(user?.uid ?? null)), []);

  // ════ PUSH (token FCM) ════
  useEffect(() => {
    if (!uidAtual) return;
    let cancelar: (() => void) | undefined;
    configurarPushParaUsuario(uidAtual).then(fn => { cancelar = fn; });
    return () => cancelar?.();
  }, [uidAtual]);

  // ════ TOQUE EM NOTIFICAÇÃO DO SISTEMA ════
  useEffect(() => {
    const abrir = (m: any) => {
      const destino = rotaDoPush(m?.data, uidRef.current);
      if (destino) navegarGlobal(destino.rota, destino.params);
    };
    obterNotificacaoQueAbriuApp().then(m => { if (m) abrir(m); });
    return registrarListenerToqueBackground(abrir);
  }, []);

  // ════ PUSH COM O APP ABERTO — só os tipos sem listener próprio abaixo ════
  useEffect(() => {
    return registrarListenerForeground((m) => {
      const data: any = m.data || {};
      if (!TIPOS_BANNER_PUSH.includes(data.tipo)) return;
      if (data.tipo === 'match_aceito' && !prefsRef.current.notifMatch) return;
      const destino = rotaDoPush(data, uidRef.current);
      if (!destino) return;
      mostrarBannerRef.current({
        titulo: m.notification?.title || 'Simbio',
        corpo: m.notification?.body || '',
        icone: ICONE_POR_TIPO[data.tipo] || 'notifications',
        rota: destino.rota,
        params: destino.params,
      });
    });
  }, []);

  // ════ APP STATE: online/offline + banner só em primeiro plano + zera badge ════
  useEffect(() => {
    const handler = AppState.addEventListener('change', (state) => {
      appAtivoRef.current = state === 'active';
      if (state === 'active') Notifications.setBadgeCountAsync(0).catch(() => {});
      const uid = uidRef.current;
      if (!uid) return;
      const ref = firestoreDoc(db, 'usuarios', uid);
      if (state === 'active') setDoc(ref, { online: true }, { merge: true }).catch(() => {});
      else setDoc(ref, { online: false, ultimo_acesso: serverTimestamp() }, { merge: true }).catch(() => {});
    });
    return () => handler.remove();
  }, []);

  // ════ DADOS DO USUÁRIO (série + conversas silenciadas) ════
  useEffect(() => {
    if (!uidAtual) { setSerie(null); silenciadosRef.current = []; return; }
    setDoc(firestoreDoc(db, 'usuarios', uidAtual), { online: true }, { merge: true }).catch(() => {});
    return onSnapshot(firestoreDoc(db, 'usuarios', uidAtual), (snap) => {
      const d = snap.data() || {};
      if (d.status === 2) {
        sairDaConta(uidAtual).finally(() => {
          if (navegacaoRef.isReady()) navegacaoRef.reset({ index: 0, routes: [{ name: 'Login' }] });
          Alert.alert('Conta desativada', 'Sua conta foi desativada pela coordenação. Em caso de dúvida, procure a secretaria.');
        });
        return;
      }
      setSerie(extrairSerie(d.turma || ''));
      silenciadosRef.current = Array.isArray(d.silenciados) ? d.silenciados : [];
    }, () => {});
  }, [uidAtual]);

  // ════ MENSAGENS ════
  useEffect(() => {
    if (!uidAtual) return;
    let primeiraCarga = true;
    const ultimas: Record<string, string> = {};
    const q = query(collection(db, 'conversas'), where('membros', 'array-contains', uidAtual));
    return onSnapshot(q, (snapshot) => {
      if (primeiraCarga) { primeiraCarga = false; return; }
      snapshot.docChanges().forEach((change) => {
        if (change.type !== 'modified' && change.type !== 'added') return;
        const conversa: any = change.doc.data();
        const conversaId = change.doc.id;
        const remetente = conversa.quemEnviou;
        if (!remetente || remetente === uidAtual) return;
        if (conversaAtivaRef.current === conversaId) return;
        const ehGrupo = !!conversa.isGrupo;
        if (silenciadosRef.current.includes(ehGrupo ? conversaId : remetente)) return;

        const chave = `${conversaId}_${conversa.data_postagem?.seconds ?? ''}`;
        if (ultimas[conversaId] === chave) return;
        ultimas[conversaId] = chave;

        const nomeRemetente = conversa.dadosMembros?.[remetente]?.nome || 'Nova mensagem';
        const nome = ehGrupo ? (conversa.nome || 'Grupo') : nomeRemetente;
        const foto = ehGrupo ? null : (conversa.dadosMembros?.[remetente]?.foto || null);
        const corpo = String(conversa.ultimaMensagem || '').substring(0, 120);

        setNotificacoesChat(prev => [{
          id: `${conversaId}_${Date.now()}`, nome, foto, corpo,
          outroUid: remetente, outroNome: nomeRemetente,
          grupoId: ehGrupo ? conversaId : undefined,
          quando: new Date(),
        }, ...prev].slice(0, 20));

        if (!prefsRef.current.notifMensagens) return;
        mostrarBannerRef.current({
          titulo: nome, corpo, foto,
          icone: ehGrupo ? 'people' : undefined,
          rota: ehGrupo ? 'GrupoChat' : 'Chat',
          params: ehGrupo ? { grupoId: conversaId, uid: uidAtual } : { outroUid: remetente, outroNome: nomeRemetente },
        });
      });
    }, (err) => console.log('Erro listener conversas:', err.message));
  }, [uidAtual]);

  // ════ SOLICITAÇÕES DE MATCH ════
  useEffect(() => {
    if (!uidAtual) return;
    let primeiraCarga = true;
    const q = query(
      collection(db, 'match_solicitacoes'),
      where('paraUid', '==', uidAtual),
      where('status', '==', 'pendente'),
    );
    return onSnapshot(q, (snapshot) => {
      if (primeiraCarga) { primeiraCarga = false; return; }
      snapshot.docChanges().forEach(async (change) => {
        if (change.type !== 'added' || !prefsRef.current.notifMatch) return;
        const sol: any = change.doc.data();
        let nome = 'Alguém';
        let foto: string | null = null;
        try {
          const s = await getDoc(firestoreDoc(db, 'usuarios', sol.deUid));
          if (s.exists()) { nome = s.data().nome_completo || nome; foto = s.data().foto || null; }
        } catch {}
        mostrarBannerRef.current({
          titulo: 'Nova solicitação de match',
          corpo: `${nome} quer estudar com você!`,
          foto, icone: 'heart',
          rota: 'Match', params: { uid: uidAtual, aba: 'solicitacoes' },
        });
      });
    }, (err) => console.log('Erro listener match:', err.message));
  }, [uidAtual]);

  // ════ EVENTOS DA SÉRIE ════
  useEffect(() => {
    if (!uidAtual || !serie) return;
    const unsubs = EVENTO_SUBS.map(({ tipo, sub }) => {
      let primeiraCarga = true;
      const q = query(collection(db, 'eventos_admin', 'tipos', sub), where('series', 'array-contains', serie));
      return onSnapshot(q, (snapshot) => {
        if (primeiraCarga) { primeiraCarga = false; return; }
        snapshot.docChanges().forEach((change) => {
          if (change.type !== 'added') return;
          const liberado = tipo === 'Aviso' ? prefsRef.current.notifAvisos : prefsRef.current.notifEventos;
          if (!liberado) return;
          const ev: any = change.doc.data();
          mostrarBannerRef.current({
            titulo: `Novo ${tipo.toLowerCase()} na agenda`,
            corpo: ev.titulo || '',
            icone: 'calendar',
            rota: 'Calendario', params: { uid: uidAtual },
          });
        });
      }, (err) => console.log(`Erro listener eventos/${sub}:`, err.message));
    });
    return () => unsubs.forEach(u => u());
  }, [uidAtual, serie]);

  const fotoUri = fotoParaUri(banner?.foto);

  return (
    <NotificacaoContext.Provider value={{ uidAtual, conversaAtiva, setConversaAtiva, notificacoesChat, limparNotificacoesChat }}>
      {children}

      <Modal visible={bannerVisivel} transparent animationType="none" statusBarTranslucent onRequestClose={esconderBanner}>
        <View style={bannerStyles.overlay} pointerEvents="box-none">
          <Animated.View style={[bannerStyles.wrapper, { opacity: bannerAnim, transform: [{ translateY: slideAnim }] }]}>
            <TouchableOpacity
              activeOpacity={0.92}
              style={bannerStyles.card}
              onPress={() => {
                const alvo = banner;
                esconderBanner();
                if (alvo) navegarGlobal(alvo.rota, alvo.params);
              }}
            >
              {fotoUri
                ? <Image source={{ uri: fotoUri }} style={bannerStyles.foto} />
                : (
                  <View style={[bannerStyles.foto, bannerStyles.fotoIcone]}>
                    <Ionicons name={banner?.icone || 'chatbubble-ellipses'} size={20} color={CORES_SYMBIUS.creme} />
                  </View>
                )}
              <View style={{ flex: 1 }}>
                <Text style={bannerStyles.nome} numberOfLines={1}>{banner?.titulo}</Text>
                <Text style={bannerStyles.corpo} numberOfLines={2}>{banner?.corpo}</Text>
              </View>
              <TouchableOpacity onPress={esconderBanner} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={18} color="rgba(244,241,232,0.6)" />
              </TouchableOpacity>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </NotificacaoContext.Provider>
  );
};

const bannerStyles = StyleSheet.create({
  overlay: { flex: 1 },
  wrapper: { position: 'absolute', top: Platform.OS === 'ios' ? 54 : 44, left: 12, right: 12 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#1F3D2B', borderRadius: 18, padding: 12,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 5 },
    elevation: 24,
  },
  foto: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2E5B3F' },
  fotoIcone: { justifyContent: 'center', alignItems: 'center' },
  nome: { color: '#F4F1E8', fontSize: 14, fontFamily: F.bold },
  corpo: { color: 'rgba(244,241,232,0.75)', fontSize: 12.5, fontFamily: F.regular, marginTop: 2 },
});
