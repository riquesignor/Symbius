import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  Image, StatusBar, Dimensions, Platform,
  ActivityIndicator, FlatList, Vibration, Animated, PanResponder, Switch, Modal, TextInput,
} from 'react-native';
import { db } from '../config/firebaseConfig';
import {
  collection, doc, getDoc, getDocs, query, where,
  addDoc, updateDoc, setDoc, serverTimestamp, onSnapshot
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import AnimalImagem from '../components/AnimalImagem';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppSettings } from '../contexts/AppSettingsContext';
import { dispararPush } from '../services/pushNotificationsService';
import { Grupo, criarGrupo, MAX_MEMBROS_GRUPO } from '../services/gruposService';

// ── Fonte Poppins ──
import { F } from '../constants/theme';
import { TEMA_SYMBIUS as CORES, CORES_SYMBIUS } from '../constants/temaSymbius';
import SymbiusTabBar from '../components/SymbiusTabBar';

const { width, height } = Dimensions.get('window');

const MATERIAS = [
  'Português', 'Redação', 'Matemática', 'Física', 'Química', 'Biologia',
  'História', 'Geografia', 'Inglês', 'Filosofia', 'Sociologia',
];

const getImageUri = (foto: any) => {
  const padrao = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
  if (!foto) return padrao;
  if (typeof foto === 'string') {
    if (foto.startsWith('http') || foto.startsWith('data:image')) return foto;
    if (foto.length > 100) return `data:image/jpeg;base64,${foto}`;
  }
  return padrao;
};

// O Perfil salva as matérias em posso_ensinar / quer_aprender. O Match lia só
// `ensinar` (campo antigo), então qualquer conta criada depois nunca aparecia
// no Descobrir. Lê os dois pra não perder quem ainda tem o campo antigo.
const materiasQueEnsina = (u: any): string[] =>
  [...new Set<string>([...(u?.posso_ensinar || []), ...(u?.ensinar || [])])];
const materiasQueAprende = (u: any): string[] =>
  [...new Set<string>([...(u?.quer_aprender || []), ...(u?.melhorar || [])])];

const formatarHora = (data: any): string => {
  if (!data) return '';
  const date = data?.toDate ? data.toDate() : new Date(data);
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

type Aba  = 'descobrir' | 'solicitacoes' | 'matches';

// Estado da relação com cada pessoa, montado a partir de TODAS as
// solicitações (enviadas e recebidas) — é o que decide quem some do Descobrir.
interface Relacao {
  aceito: boolean;
  pendenteEnviada: string | null;  // id da solicitação que eu mandei
  pendenteRecebida: string | null; // id da solicitação que recebi
  recusadoEm: number;              // ms da recusa mais recente (0 = nunca)
}

const CHAVE_PULADOS = 'match_pulados';
const QUINZE_DIAS_MS = 15 * 24 * 60 * 60 * 1000;

// criadoEm é serverTimestamp: fica null até o servidor confirmar a escrita.
// Antes isso virava 0 e a solicitação era ignorada no filtro.
const tsMs = (t: any) => (t?.toMillis ? t.toMillis() : t?.seconds ? t.seconds * 1000 : Date.now());

// ── Helper: formata "último acesso" estilo Instagram ──
const formatarUltimoAcesso = (ultimoAcesso: any): string => {
  if (!ultimoAcesso) return '';
  const date = ultimoAcesso?.toDate ? ultimoAcesso.toDate() : new Date(ultimoAcesso);
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1)  return 'agora';
  if (diffMin < 60) return `visto há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24)   return `visto há ${diffH}h`;
  return `visto em ${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
};

// ── Hook: ouve conversas de uma lista de matchIds ──
function useConversas(meuUid: string | undefined, matchIds: string[]) {
  const [conversas, setConversas] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!meuUid || matchIds.length === 0) return;
    const unsubs: (() => void)[] = [];

    matchIds.forEach(outroUid => {
      const conversaId = [meuUid, outroUid].sort().join('_');
      const unsub = onSnapshot(doc(db, 'conversas', conversaId), snap => {
        if (snap.exists()) {
          setConversas(prev => ({ ...prev, [outroUid]: snap.data() }));
        }
      });
      unsubs.push(unsub);
    });

    return () => unsubs.forEach(u => u());
  }, [meuUid, matchIds.join(',')]);

  return conversas;
}

// ── Hook: ouve status online de cada match ──
function useOnlineStatus(uids: string[]) {
  const [statuses, setStatuses] = useState<Record<string, {
    online: boolean; ultimo_acesso: any; statusOnline: boolean;
  }>>({});

  useEffect(() => {
    if (uids.length === 0) return;
    const unsubs: (() => void)[] = [];

    uids.forEach(uid => {
      const unsub = onSnapshot(doc(db, 'usuarios', uid), snap => {
        if (snap.exists()) {
          const d = snap.data();
          setStatuses(prev => ({
            ...prev,
            [uid]: {
              online:       d.online === true,
              ultimo_acesso: d.ultimo_acesso || null,
              statusOnline: d.statusOnline !== false,
            },
          }));
        }
      });
      unsubs.push(unsub);
    });

    return () => unsubs.forEach(u => u());
  }, [uids.join(',')]);

  return statuses;
}

export default function Match({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { fonteScale } = useAppSettings();
  // ── TELA DE TESTE (Symbius): paleta verde fixa, ignora o tema real do usuário.
  // C/CORES/modoEscuro seguem sendo usados normalmente no resto do arquivo —
  // só o valor que eles resolvem mudou. Nenhuma lógica abaixo foi tocada.
  const modoEscuro = false; // paleta Symbius agora é modo claro
  const C = CORES; // CORES já é TEMA_SYMBIUS (import aliasado acima)
  const fs = (size: number) => size * fonteScale;

  const abaInicial: Aba = ['descobrir', 'solicitacoes', 'matches'].includes(route?.params?.aba) ? route.params.aba : 'descobrir';
  const [abaAtiva,       setAbaAtiva]       = useState<Aba>(abaInicial);
  const abaAtivaRef = useRef<Aba>(abaInicial);
  useEffect(() => { abaAtivaRef.current = abaAtiva; }, [abaAtiva]);
  // Notificação/banner pode reabrir a tela já montada pedindo outra aba
  useEffect(() => { if (route?.params?.aba) setAbaAtiva(route.params.aba); }, [route?.params?.aba]);
  const [materiasFiltro, setMateriasFiltro] = useState<string[]>([]);
  const [relacoesCarregadas, setRelacoesCarregadas] = useState(false);
  const [relacoes,       setRelacoes]       = useState<Map<string, Relacao>>(new Map());
  const [pulados,        setPulados]        = useState<Record<string, number>>({});
  const [candidatosBrutos, setCandidatosBrutos] = useState<any[]>([]);
  const [solicitacoesBrutas, setSolicitacoesBrutas] = useState<any[]>([]);
  const [matches,        setMatches]        = useState<any[]>([]);
  const [meusDados,      setMeusDados]      = useState<any>(null);
  const [carregando,     setCarregando]     = useState(false);
  const [enviandoPara,   setEnviandoPara]   = useState<string | null>(null);
  const [popupInfo,      setPopupInfo]      = useState(false);
  const [popupMateria,   setPopupMateria]   = useState(false);
  const [salvandoVisivel, setSalvandoVisivel] = useState(false);
  const [grupos,         setGrupos]         = useState<Grupo[]>([]);
  const [modalGrupo,     setModalGrupo]     = useState(false);
  const [grupoNome,      setGrupoNome]      = useState('');
  const [grupoMateria,   setGrupoMateria]   = useState('');
  const [grupoMembros,   setGrupoMembros]   = useState<string[]>([]);
  const [criandoGrupo,   setCriandoGrupo]   = useState(false);

  const meuUid = route?.params?.uid;

  // Pessoas puladas no Descobrir ficam escondidas por 15 dias (só neste aparelho)
  useEffect(() => {
    AsyncStorage.getItem(CHAVE_PULADOS).then(raw => {
      if (!raw) return;
      const agora = Date.now();
      const obj: Record<string, number> = JSON.parse(raw);
      const validos = Object.fromEntries(Object.entries(obj).filter(([, ts]) => agora - ts < QUINZE_DIAS_MS));
      setPulados(validos);
    }).catch(() => {});
  }, []);

  // ── Arrastar o dedo pra esquerda/direita muda a aba ativa (com animação de movimento) ──
  const ABAS_MATCH: Aba[] = ['descobrir', 'solicitacoes', 'matches'];
  const tabSwipeX = useRef(new Animated.Value(0)).current;
  const tabSwipeResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 20 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_, g) => {
        const idx = ABAS_MATCH.indexOf(abaAtivaRef.current);
        const podeAnterior = idx > 0;
        const podeProxima  = idx < ABAS_MATCH.length - 1;
        let dx = g.dx;
        if (dx < 0 && !podeProxima)  dx *= 0.25; // resistência na última aba
        if (dx > 0 && !podeAnterior) dx *= 0.25; // resistência na primeira aba
        tabSwipeX.setValue(dx);
      },
      onPanResponderRelease: (_, g) => {
        const idx = ABAS_MATCH.indexOf(abaAtivaRef.current);
        const vaiProxima  = g.dx < -40 && idx < ABAS_MATCH.length - 1;
        const vaiAnterior = g.dx > 40  && idx > 0;
        if (vaiProxima || vaiAnterior) {
          const dir = vaiProxima ? -1 : 1;
          Animated.timing(tabSwipeX, { toValue: dir * width, duration: 180, useNativeDriver: true }).start(() => {
            setAbaAtiva(ABAS_MATCH[idx + (vaiProxima ? 1 : -1)]);
            tabSwipeX.setValue(-dir * width);
            Animated.timing(tabSwipeX, { toValue: 0, duration: 220, useNativeDriver: true }).start();
          });
        } else {
          Animated.spring(tabSwipeX, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
        }
      },
    })
  ).current;

  const matchUids    = matches.map(m => m.outro?.uid).filter(Boolean);
  const conversas    = useConversas(meuUid, matchUids);
  const onlineStatus = useOnlineStatus(matchUids);

  // ── Dados do usuário logado ──
  useEffect(() => {
    if (!meuUid) return;
    return onSnapshot(doc(db, 'usuarios', meuUid), snap => {
      if (snap.exists()) setMeusDados({ ...snap.data(), uid: meuUid });
    });
  }, [meuUid]);

  // ── Grupos de estudo em que participo ──
  useEffect(() => {
    if (!meuUid) return;
    const q = query(collection(db, 'conversas'), where('membros', 'array-contains', meuUid));
    return onSnapshot(q, snap => {
      const lista = snap.docs
        .map(d => ({ id: d.id, ...(d.data() as any) }))
        .filter((c: any) => c.isGrupo) as Grupo[];
      lista.sort((a, b) => (b.data_postagem?.seconds ?? 0) - (a.data_postagem?.seconds ?? 0));
      setGrupos(lista);
    }, e => console.log('Erro grupos:', e.message));
  }, [meuUid]);

  // Visível por padrão: campo ausente conta como ligado.
  const perfilVisivel = meusDados?.visivel_match !== false;
  const alternarVisibilidade = async (valor: boolean) => {
    if (!meuUid) return;
    setSalvandoVisivel(true);
    try {
      await updateDoc(doc(db, 'usuarios', meuUid), { visivel_match: valor });
    } catch (e) { console.log(e); }
    finally { setSalvandoVisivel(false); }
  };

  const abrirCriarGrupo = () => {
    setGrupoNome(''); setGrupoMateria(''); setGrupoMembros([]);
    setModalGrupo(true);
  };

  const alternarMembroGrupo = (uid: string) => {
    setGrupoMembros(prev => prev.includes(uid)
      ? prev.filter(u => u !== uid)
      : prev.length >= MAX_MEMBROS_GRUPO - 1 ? prev : [...prev, uid]);
  };

  const confirmarCriarGrupo = async () => {
    if (!meuUid || !grupoNome.trim() || grupoMembros.length < 2 || criandoGrupo) return;
    setCriandoGrupo(true);
    try {
      const id = await criarGrupo({ criadorUid: meuUid, nome: grupoNome, materia: grupoMateria, membrosUids: grupoMembros });
      setModalGrupo(false);
      navigation.navigate('GrupoChat', { grupoId: id, uid: meuUid });
    } catch (e) {
      console.log('Erro ao criar grupo:', e);
    } finally {
      setCriandoGrupo(false);
    }
  };

  // ── Relação com cada pessoa (solicitações enviadas + recebidas) ──
  useEffect(() => {
    if (!meuUid) return;
    const qEnv = query(collection(db, 'match_solicitacoes'), where('deUid',   '==', meuUid));
    const qRec = query(collection(db, 'match_solicitacoes'), where('paraUid', '==', meuUid));

    let envDocs: any[] | null = null;
    let recDocs: any[] | null = null;

    const recalcular = () => {
      if (!envDocs || !recDocs) return;
      const mapa = new Map<string, Relacao>();
      const rel = (uid: string) => {
        if (!mapa.has(uid)) mapa.set(uid, { aceito: false, pendenteEnviada: null, pendenteRecebida: null, recusadoEm: 0 });
        return mapa.get(uid)!;
      };
      const processar = (d: any, outroUid: string, enviada: boolean) => {
        if (!outroUid) return;
        const sol = d.data();
        const r = rel(outroUid);
        if (sol.status === 'aceito') r.aceito = true;
        else if (sol.status === 'pendente') {
          if (enviada) r.pendenteEnviada = d.id; else r.pendenteRecebida = d.id;
        } else if (sol.status === 'recusado') r.recusadoEm = Math.max(r.recusadoEm, tsMs(sol.criadoEm));
      };
      envDocs.forEach(d => processar(d, d.data().paraUid, true));
      recDocs.forEach(d => processar(d, d.data().deUid, false));
      setRelacoes(mapa);
      setSolicitacoesBrutas(recDocs.filter(d => d.data().status === 'pendente').map(d => ({ id: d.id, ...d.data() })));
      setRelacoesCarregadas(true);
    };

    const u1 = onSnapshot(qEnv, snap => { envDocs = snap.docs; recalcular(); });
    const u2 = onSnapshot(qRec, snap => { recDocs = snap.docs; recalcular(); });
    return () => { u1(); u2(); };
  }, [meuUid]);

  // ── Carrega candidatos quando filtro muda ──
  useEffect(() => {
    if (!meusDados) return;
    carregarCandidatos();
  }, [meusDados, materiasFiltro.join(',')]);

  // ── Solicitações recebidas: some quem já é match e repetidas da mesma pessoa ──
  const [perfisRemetentes, setPerfisRemetentes] = useState<Record<string, any>>({});
  const solicitacoes = useMemo(() => {
    const porRemetente = new Map<string, any>();
    solicitacoesBrutas.forEach(sol => {
      if (relacoes.get(sol.deUid)?.aceito) return;
      const atual = porRemetente.get(sol.deUid);
      if (!atual || tsMs(sol.criadoEm) > tsMs(atual.criadoEm)) porRemetente.set(sol.deUid, sol);
    });
    return Array.from(porRemetente.values())
      .map(sol => ({ ...sol, remetente: perfisRemetentes[sol.deUid] }))
      .filter(sol => sol.remetente)
      .sort((x, y) => tsMs(y.criadoEm) - tsMs(x.criadoEm));
  }, [solicitacoesBrutas, relacoes, perfisRemetentes]);

  useEffect(() => {
    const faltando = [...new Set(solicitacoesBrutas.map(sol => sol.deUid))].filter(uid => !perfisRemetentes[uid]);
    if (faltando.length === 0) return;
    Promise.all(faltando.map(async uid => {
      const snap = await getDoc(doc(db, 'usuarios', uid));
      return [uid, snap.exists() ? snap.data() : null] as const;
    })).then(pares => setPerfisRemetentes(prev => {
      const novo = { ...prev };
      pares.forEach(([uid, dados]) => { if (dados) novo[uid] = dados; });
      return novo;
    })).catch(() => {});
  }, [solicitacoesBrutas]);

  // ── Ouve matches confirmados ──
  useEffect(() => {
    if (!meuUid) return;
    const q = query(
      collection(db, 'match_solicitacoes'),
      where('status',  '==', 'aceito'),
      where('membros', 'array-contains', meuUid)
    );
    const unsub = onSnapshot(q, async snap => {
      const parVistos = new Map<string, any>();
      const UM_DIA_SEG = 24 * 60 * 60;
      const agoraSeg = Date.now() / 1000;
      await Promise.all(snap.docs.map(async d => {
        const data     = d.data();
        const outroUid = data.membros?.find((id: string) => id !== meuUid);
        if (!outroUid) return;
        const oSnap = await getDoc(doc(db, 'usuarios', outroUid));
        if (!oSnap.exists()) return;

        // Some da lista se o match já foi finalizado/avaliado há mais de 1 dia
        const conversaId = [meuUid, outroUid].sort().join('_');
        const cSnap = await getDoc(doc(db, 'conversas', conversaId));
        if (cSnap.exists()) {
          const cData = cSnap.data();
          const finalizadoTs = cData?.finalizadoEm?.seconds;
          if (cData?.matchFinalizado && finalizadoTs && (agoraSeg - finalizadoTs) > UM_DIA_SEG) {
            return;
          }
        }

        const jaExiste = parVistos.get(outroUid);
        const ts = data.criadoEm?.seconds ?? 0;
        if (!jaExiste || ts > (jaExiste._ts ?? 0)) {
          parVistos.set(outroUid, {
            id: d.id, ...data, _ts: ts,
            outro: { ...oSnap.data(), uid: outroUid },
          });
        }
      }));
      setMatches(Array.from(parVistos.values()));
    });
    return () => unsub();
  }, [meuUid]);

  const carregarCandidatos = async () => {
    setCarregando(true);
    try {
      const snap = await getDocs(collection(db, 'usuarios'));
      setCandidatosBrutos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.log(e); }
    finally { setCarregando(false); }
  };

  // Quem aparece no Descobrir: ensina algo (e bate com o filtro), e NÃO é
  // match, não tem solicitação pendente em nenhum sentido, não recusou/foi
  // recusado nos últimos 15 dias e não foi pulado recentemente.
  const candidatos = useMemo(() => {
    const agora = Date.now();
    return candidatosBrutos.filter((u: any) => {
      if (u.id === meuUid || u.status !== 1) return false;
      if (u.visivel_match === false) return false;
      const r = relacoes.get(u.id);
      if (r && (r.aceito || r.pendenteEnviada || r.pendenteRecebida)) return false;
      if (r?.recusadoEm && agora - r.recusadoEm < QUINZE_DIAS_MS) return false;
      if (pulados[u.id]) return false;
      if (materiasFiltro.length === 0) return true;
      const materias = materiasQueEnsina(u);
      return materiasFiltro.some(m => materias.includes(m));
    }).sort((a: any, b: any) => materiasQueEnsina(b).length - materiasQueEnsina(a).length);
  }, [candidatosBrutos, relacoes, pulados, materiasFiltro, meuUid]);

  const criarConversaDoMatch = async (outroUid: string) => {
    if (!meuUid) return;
    const conversaId = [meuUid, outroUid].sort().join('_');
    const [meuSnap, outroSnap] = await Promise.all([
      getDoc(doc(db, 'usuarios', meuUid)),
      getDoc(doc(db, 'usuarios', outroUid)),
    ]);
    const meuData: any   = meuSnap.exists()  ? meuSnap.data()  : {};
    const outroData: any = outroSnap.exists() ? outroSnap.data() : {};
    await setDoc(doc(db, 'conversas', conversaId), {
      membros: [meuUid, outroUid],
      ultimaMensagem: 'Vocês criaram um elo!',
      data_postagem: serverTimestamp(),
      quemEnviou: outroUid, visto: false, isMatch: true,
      dadosMembros: {
        [meuUid]:   { nome: meuData.nome_completo   || 'Usuário', foto: meuData.foto   || null },
        [outroUid]: { nome: outroData.nome_completo || 'Usuário', foto: outroData.foto || null },
      },
    }, { merge: true });
  };

  const responderSolicitacao = async (solId: string, deUid: string, aceitar: boolean) => {
    if (!meuUid) return;
    try {
      await updateDoc(doc(db, 'match_solicitacoes', solId), { status: aceitar ? 'aceito' : 'recusado' });
      if (!aceitar) return;

      // Se eu também tinha mandado pra essa pessoa, fecha a minha junto —
      // senão ela continuava vendo meu pedido pendente mesmo já sendo match.
      const minhaPendente = relacoes.get(deUid)?.pendenteEnviada;
      if (minhaPendente) await updateDoc(doc(db, 'match_solicitacoes', minhaPendente), { status: 'aceito' });

      await criarConversaDoMatch(deUid);
      dispararPush({
        destinatarioUid: deUid,
        titulo: 'Novo elo!',
        corpo: `${meusDados?.nome_completo || 'Alguém'} aceitou estudar com você. Bora conversar?`,
        dados: { tipo: 'match_aceito', deUid: meuUid },
      });
    } catch (e) { console.log(e); }
  };

  const enviarSolicitacao = async (paraUid: string) => {
    if (!meuUid || enviandoPara) return;
    const r = relacoes.get(paraUid);
    if (r?.aceito || r?.pendenteEnviada) return;
    setEnviandoPara(paraUid);
    try {
      // A pessoa já tinha me chamado: em vez de criar outra solicitação, é match direto.
      if (r?.pendenteRecebida) {
        await responderSolicitacao(r.pendenteRecebida, paraUid, true);
        return;
      }
      await addDoc(collection(db, 'match_solicitacoes'), {
        deUid: meuUid, paraUid,
        status: 'pendente', membros: [meuUid, paraUid],
        criadoEm: serverTimestamp(),
      });
      dispararPush({
        destinatarioUid: paraUid,
        titulo: 'Nova solicitação de elo',
        corpo: `${meusDados?.nome_completo || 'Alguém'} quer estudar com você!`,
        dados: { tipo: 'solicitacao_match', deUid: meuUid },
      });
    } catch (e) { console.log(e); }
    finally { setEnviandoPara(null); }
  };

  const pularCandidato = (uid: string) => {
    const novo = { ...pulados, [uid]: Date.now() };
    setPulados(novo);
    AsyncStorage.setItem(CHAVE_PULADOS, JSON.stringify(novo)).catch(() => {});
  };

  const abrirChat = (outroUid: string, outroNome: string, outraFoto: string) => {
    const conversaId = [meuUid, outroUid].sort().join('_');
    navigation.navigate('Chat', {
      room: conversaId, meuUid,
      meuNome:   meusDados?.nome_completo,
      minhaFoto: meusDados?.foto || null,
      outroUid, outroNome,
      outraFoto: outraFoto || null,
    });
  };

  // ✅ Abre o perfil público de uma pessoa (toque na foto)
  const abrirPerfil = (outroUid: string) => {
    if (!outroUid) return;
    navigation.navigate('PerfilPublico', { uid: outroUid, meuUid });
  };

  const getMateriaDoMatch = (item: any): { materias: string[]; tipo: 'te ensina' | 'você ensina' } => {
    const outro = item.outro || {};
    if (item.deUid === meuUid) {
      return { materias: materiasQueEnsina(outro), tipo: 'te ensina' };
    } else {
      return { materias: materiasQueEnsina(meusDados), tipo: 'você ensina' };
    }
  };

  const toggleMateria = (m: string) => {
    setMateriasFiltro(prev =>
      prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
    );
  };

  // ── Matches ordenados pela última mensagem ──
  const matchesNaoLidos = matches.filter(m => {
    const conversa = conversas[m.outro?.uid];
    return conversa && !conversa.visto && conversa.quemEnviou !== meuUid;
  }).length;

  const matchesOrdenados = [...matches].sort((a, b) => {
    const ca = conversas[a.outro?.uid];
    const cb = conversas[b.outro?.uid];
    const ta = ca?.data_postagem?.seconds ?? a._ts ?? 0;
    const tb = cb?.data_postagem?.seconds ?? b._ts ?? 0;
    return tb - ta;
  });

  // ── FEED DE CANDIDATOS (lista vertical, estilo feed) ──
  const renderCandidato = ({ item }: any) => {
    const ensina = materiasQueEnsina(item);
    const materias: string[] = ensina.length > 0 ? ensina : materiasQueAprende(item);
    const rotuloMaterias = ensina.length > 0 ? 'PODE TE AJUDAR EM' : 'TAMBÉM QUER APRENDER';
    const enviando = enviandoPara === item.id;
    return (
      <View style={styles.feedCard}>
        <TouchableOpacity style={styles.feedTopo} onPress={() => abrirPerfil(item.id)} activeOpacity={0.8}>
          <Image source={{ uri: getImageUri(item.foto) }} style={styles.feedAvatar} />
          <View style={{ flex: 1 }}>
            <Text style={styles.feedNome} numberOfLines={1}>{item.nome_completo}</Text>
            <Text style={styles.feedTurma} numberOfLines={1}>{item.turma || item.ra || ''}</Text>
            {item.avaliacao_contagem > 0 && (
              <View style={styles.feedNota}>
                <Ionicons name="star" size={12} color="#E8A33D" />
                <Text style={styles.feedNotaTxt}>
                  {Number(item.avaliacao_media || 0).toFixed(1)} · {item.avaliacao_contagem} avaliações
                </Text>
              </View>
            )}
          </View>
          <Ionicons name="chevron-forward" size={18} color={CORES_SYMBIUS.textoTerciario} />
        </TouchableOpacity>

        {!!item.bio && <Text style={styles.feedBio} numberOfLines={3}>{item.bio}</Text>}

        <Text style={styles.feedRotulo}>{materias.length > 0 ? rotuloMaterias : 'AINDA NÃO ESCOLHEU MATÉRIAS'}</Text>
        <View style={styles.feedMaterias}>
          {materias.slice(0, 6).map((m: string) => (
            <View key={m} style={[styles.feedMateria, materiasFiltro.includes(m) && styles.feedMateriaDestaque]}>
              <Text style={[styles.feedMateriaTxt, materiasFiltro.includes(m) && { color: CORES_SYMBIUS.creme }]}>{m}</Text>
            </View>
          ))}
        </View>

        <View style={styles.feedAcoes}>
          <TouchableOpacity
            style={styles.feedBtnRecusar}
            onPress={() => pularCandidato(item.id)}
            accessibilityLabel={`Pular ${item.nome_completo}`}
          >
            <Ionicons name="close" size={20} color="#D9534F" />
            <Text style={styles.feedBtnRecusarTxt}>Pular</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.feedBtnAceitar, enviando && { opacity: 0.6 }]}
            onPress={() => enviarSolicitacao(item.id)}
            disabled={enviando}
            accessibilityLabel={`Quero estudar com ${item.nome_completo}`}
          >
            {enviando
              ? <ActivityIndicator size="small" color={CORES_SYMBIUS.creme} />
              : <Ionicons name="checkmark-circle" size={20} color={CORES_SYMBIUS.creme} />}
            <Text style={styles.feedBtnAceitarTxt}>Quero estudar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderDescobrir = () => {
    if (carregando || !relacoesCarregadas) return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" color={CORES_SYMBIUS.verdeEscuro} />
      </View>
    );
    return (
      <FlatList
        data={candidatos}
        keyExtractor={i => i.id}
        renderItem={renderCandidato}
        contentContainerStyle={{ padding: 16, paddingBottom: 24, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListHeaderComponent={<>
          {!perfilVisivel && (
            <TouchableOpacity
              style={[styles.cardVisivel, styles.cardVisivelOff]}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('Configuracoes', { uid: meuUid })}
              accessibilityRole="button"
            >
              <Ionicons name="eye-off" size={20} color={CORES_SYMBIUS.laranjaTexto} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardVisivelTitulo}>Seu perfil está oculto</Text>
                <Text style={styles.cardVisivelSub}>Ninguém te encontra aqui. Mude em Configurações.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={CORES_SYMBIUS.textoSec} />
            </TouchableOpacity>
          )}
        </>}
        ListHeaderComponentStyle={{ marginBottom: 12, gap: 10 }}
        ListEmptyComponent={(
          <View style={[styles.centro, { paddingTop: 40 }]}>
            <AnimalImagem animal="coruja" size={96} />
            <Text style={styles.txtVazio}>Ninguém novo por aqui!</Text>
            <Text style={[styles.txtVazio, { fontSize: 13, marginTop: 4 }]}>
              Tente mudar o filtro ou volte mais tarde.
            </Text>
            {materiasFiltro.length > 0 && (
              <TouchableOpacity
                style={[styles.btnRecarregar, { backgroundColor: CORES_SYMBIUS.fundoSuave }]}
                onPress={() => setMateriasFiltro([])}
              >
                <Text style={[styles.btnRecarregarTxt, { color: CORES_SYMBIUS.texto }]}>Limpar filtros</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.btnRecarregar} onPress={carregarCandidatos}>
              <Text style={styles.btnRecarregarTxt}>Recarregar</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    );
  };

  // ── ITEM DE SOLICITAÇÃO ──
  const renderSolicitacao = ({ item }: any) => (
    <View style={[styles.solCard, { backgroundColor: C.branco }]}>
      <TouchableOpacity onPress={() => abrirPerfil(item.deUid)} activeOpacity={0.8}>
        <Image source={{ uri: getImageUri(item.remetente?.foto) }} style={styles.solAvatar} />
      </TouchableOpacity>
      <View style={styles.solInfo}>
        <Text style={[styles.solNome, { color: C.azulEscuro, fontFamily: F.bold }]}>{item.remetente?.nome_completo || 'Usuário'}</Text>
        <Text style={[styles.solTurma, { color: C.textoSec, fontFamily: F.regular }]}>{item.remetente?.turma || ''}</Text>
      </View>
      <View style={styles.solAcoes}>
        <TouchableOpacity
          style={styles.btnSolRecusar}
          onPress={() => responderSolicitacao(item.id, item.deUid, false)}
        >
          <Ionicons name="close" size={20} color="#FF5252" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btnSolAceitar}
          onPress={() => responderSolicitacao(item.id, item.deUid, true)}
        >
          <Ionicons name="checkmark" size={20} color={CORES.branco} />
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── ITEM DE MATCH ──
  const renderMatch = ({ item }: any) => {
    const { materias, tipo } = getMateriaDoMatch(item);
    const outroUid  = item.outro?.uid;
    const conversa  = conversas[outroUid];
    const status    = onlineStatus[outroUid];

    // Online: respeita a config de privacidade statusOnline do outro
    const estaOnline = status?.online === true && status?.statusOnline !== false;

    const ultimaMsg  = conversa?.ultimaMensagem || '';
    const quemEnviou = conversa?.quemEnviou;
    const naoLida    = conversa && !conversa.visto && quemEnviou !== meuUid;
    const prefixo    = quemEnviou === meuUid
      ? 'Você: '
      : (item.outro?.nome_completo?.split(' ')[0] + ': ' || '');
    const labelMsg   = ultimaMsg
      ? `${prefixo}${ultimaMsg}`
      : 'Diga olá!';

    // Texto da direita: "online agora" se online, senão último acesso, senão hora da msg
    const labelDireita = estaOnline
      ? 'online'
      : (status?.ultimo_acesso
          ? formatarUltimoAcesso(status.ultimo_acesso)
          : (conversa?.data_postagem ? formatarHora(conversa.data_postagem) : ''));

    return (
      <TouchableOpacity
        style={[styles.solCard, { backgroundColor: C.branco }, naoLida && styles.solCardNaoLido]}
        onPress={() => abrirChat(outroUid, item.outro?.nome_completo, item.outro?.foto)}
        activeOpacity={0.75}
      >
        <TouchableOpacity style={styles.avatarWrap} onPress={() => abrirPerfil(outroUid)} activeOpacity={0.8}>
          <Image source={{ uri: getImageUri(item.outro?.foto) }} style={styles.solAvatar} />
          {/* Bolinha verde = online, separada do indicador de não lida */}
          {estaOnline && <View style={styles.bolinhaOnline} />}
        </TouchableOpacity>

        <View style={styles.solInfo}>
          <View style={styles.nomeLinha}>
            <Text
              style={[styles.solNome, naoLida && styles.solNomeNaoLido, { flex: 1, color: C.azulEscuro, fontFamily: naoLida ? F.black : F.bold }]}
              numberOfLines={1}
            >
              {item.outro?.nome_completo || 'Usuário'}
            </Text>
            <Text style={[styles.msgTimestamp, { color: estaOnline ? CORES.verde : C.textoSec, fontFamily: F.medium }]}>
              {labelDireita}
            </Text>
          </View>

          <Text
            style={[styles.ultimaMsg, naoLida && styles.ultimaMsgNaoLida, { color: naoLida ? C.azulEscuro : C.textoSec, fontFamily: naoLida ? F.bold : F.regular }]}
            numberOfLines={1}
          >
            {labelMsg}
          </Text>
        </View>

        {/* Badge de não lida */}
        {naoLida && <View style={styles.badgeNaoLida} />}
      </TouchableOpacity>
    );
  };

  // ══════════════════════════════════════════════════════════
  // RENDER PRINCIPAL
  // ══════════════════════════════════════════════════════════
  return (
    <View style={[styles.container, { backgroundColor: C.fundo }]}>
      <StatusBar
        barStyle={CORES_SYMBIUS.barStyle}
        backgroundColor={C.fundo}
      />

      {/* NAVBAR */}
      <View style={[styles.navbar, { paddingTop: insets.top + 16, minHeight: 60 + insets.top + 16, backgroundColor: CORES_SYMBIUS.fundo, borderBottomColor: CORES_SYMBIUS.borda }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={C.azulEscuro} />
        </TouchableOpacity>
        <View style={styles.logoWrap}>
          <Text style={[styles.logo, { color: C.azulEscuro, fontFamily: F.black }]}>Elos de Estudos</Text>
        </View>
        <TouchableOpacity onPress={() => setPopupInfo(true)}>
          <Ionicons name="help-circle-outline" size={26} color={C.azulEscuro} />
        </TouchableOpacity>
      </View>

      {/* TABS */}
      <View style={[styles.tabs, { backgroundColor: CORES_SYMBIUS.fundo, borderBottomColor: CORES_SYMBIUS.borda }]}>
        <View style={[styles.tabsTrack, { backgroundColor: CORES_SYMBIUS.fundoSuave }]}>
        {(['descobrir', 'solicitacoes', 'matches'] as Aba[]).map(aba => (
          <TouchableOpacity
            key={aba}
            style={[styles.tab, abaAtiva === aba && styles.tabAtiva]}
            accessibilityRole="tab"
            accessibilityState={{ selected: abaAtiva === aba }}
            onPress={() => setAbaAtiva(aba)}
          >
            {abaAtiva === aba && (
              <Ionicons
                name={aba === 'descobrir' ? 'search' : aba === 'solicitacoes' ? 'mail' : 'people'}
                size={15}
                color={CORES.branco}
              />
            )}
            <Text numberOfLines={1} style={[styles.tabTxt, { color: abaAtiva === aba ? CORES.branco : C.textoSec, fontFamily: F.bold }, abaAtiva === aba && styles.tabTxtAtiva]}>
              {aba === 'descobrir' ? 'Descobrir' : aba === 'solicitacoes' ? 'Pedidos' : 'Elos'}
            </Text>
            {aba === 'solicitacoes' && solicitacoes.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeTxt}>{solicitacoes.length}</Text>
              </View>
            )}
            {aba === 'matches' && matchesNaoLidos > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeTxt}>{matchesNaoLidos}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
        </View>
      </View>

      <Animated.View style={{ flex: 1, transform: [{ translateX: tabSwipeX }] }} {...tabSwipeResponder.panHandlers}>
      {/* ABA DESCOBRIR */}
      {abaAtiva === 'descobrir' && (
        <View style={{ flex: 1 }}>
          <View style={[styles.filtros, { backgroundColor: CORES_SYMBIUS.fundo, borderBottomColor: CORES_SYMBIUS.borda }]}>
            {/* Selector de matérias — abre popup */}
            <TouchableOpacity
              style={styles.materiaSelector}
              onPress={() => setPopupMateria(true)}
            >
              {materiasFiltro.length === 0 ? (
                <Text style={[styles.materiaSelectorTxt, { color: C.textoSec, fontFamily: F.medium }]}>Filtrar por matéria</Text>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, flex: 1 }}>
                  {materiasFiltro.map(m => (
                    <View key={m} style={styles.tagMateriaFiltro}>
                      <Text style={styles.tagMateriaFiltroTxt}>{m}</Text>
                    </View>
                  ))}
                </View>
              )}
              <Ionicons name="chevron-down" size={16} color={CORES.textoSec} />
            </TouchableOpacity>
          </View>

          {renderDescobrir()}
        </View>
      )}

      {/* ABA SOLICITAÇÕES */}
      {abaAtiva === 'solicitacoes' && (
        solicitacoes.length === 0
          ? <View style={styles.centro}>
              <Ionicons name="mail-open-outline" size={56} color={CORES.cinzaClaro} />
              <Text style={styles.txtVazio}>Nenhuma solicitação pendente.</Text>
            </View>
          : <FlatList
              data={solicitacoes}
              keyExtractor={i => i.id}
              renderItem={renderSolicitacao}
              contentContainerStyle={{ padding: 16 }}
              ListHeaderComponent={(
                <View style={styles.solicTopo}>
                  <Text style={styles.solicTitulo}>
                    {solicitacoes.length === 1 ? '1 pessoa quer estudar com você' : `${solicitacoes.length} pessoas querem estudar com você`}
                  </Text>
                  <Text style={styles.solicSub}>Aceite para abrir o chat e criar um elo.</Text>
                </View>
              )}
            />
      )}

      {/* ABA MATCHES */}
      {abaAtiva === 'matches' && (
        matchesOrdenados.length === 0 && grupos.length === 0
          ? <View style={styles.centro}>
              <Ionicons name="heart-outline" size={56} color={CORES.cinzaClaro} />
              <Text style={styles.txtVazio}>Nenhum elo ainda.</Text>
              <Text style={[styles.txtVazio, { fontSize: 13, marginTop: 4 }]}>
                Comece a descobrir monitores!
              </Text>
            </View>
          : <FlatList
              data={matchesOrdenados}
              keyExtractor={i => i.id}
              renderItem={renderMatch}
              contentContainerStyle={{ padding: 16 }}
              ListHeaderComponent={
                <View style={{ marginBottom: 6 }}>
                  <TouchableOpacity
                    style={[styles.btnCriarGrupo, matches.length < 2 && { opacity: 0.55 }]}
                    onPress={abrirCriarGrupo}
                    disabled={matches.length < 2}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="people" size={18} color={CORES_SYMBIUS.creme} />
                    <Text style={styles.btnCriarGrupoTxt}>Criar grupo de estudo</Text>
                  </TouchableOpacity>
                  {matches.length < 2 && (
                    <Text style={styles.dicaGrupo}>Você precisa de pelo menos 2 elos para montar um grupo.</Text>
                  )}

                  {grupos.length > 0 && <Text style={styles.secaoLista}>GRUPOS</Text>}
                  {grupos.map(g => {
                    const naoLida = g.quemEnviou && g.quemEnviou !== meuUid;
                    return (
                      <TouchableOpacity
                        key={g.id}
                        style={[styles.solCard, { backgroundColor: C.branco }]}
                        onPress={() => navigation.navigate('GrupoChat', { grupoId: g.id, uid: meuUid })}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.solAvatar, styles.grupoAvatar]}>
                          <Ionicons name="people" size={22} color={CORES_SYMBIUS.creme} />
                        </View>
                        <View style={styles.solInfo}>
                          <Text style={[styles.solNome, { color: C.azulEscuro, fontFamily: F.bold }]} numberOfLines={1}>{g.nome}</Text>
                          <Text style={[styles.ultimaMsg, { color: naoLida ? C.azulEscuro : C.textoSec, fontFamily: naoLida ? F.semibold : F.regular }]} numberOfLines={1}>
                            {g.ultimaMensagem || `${g.membros.length} participantes`}
                          </Text>
                        </View>
                        <Text style={[styles.msgTimestamp, { color: C.textoSec, fontFamily: F.medium }]}>{g.membros.length} membros</Text>
                      </TouchableOpacity>
                    );
                  })}
                  {matchesOrdenados.length > 0 && <Text style={styles.secaoLista}>ELOS</Text>}
                </View>
              }
            />
      )}
      </Animated.View>

      <Modal visible={modalGrupo} transparent animationType="slide" onRequestClose={() => setModalGrupo(false)}>
        <View style={styles.grupoOverlay}>
          <View style={[styles.grupoSheet, { paddingBottom: 20 + insets.bottom }]}>
            <View style={styles.grupoHandle} />
            <Text style={styles.grupoTitulo}>Novo grupo de estudo</Text>
            <TextInput
              style={styles.grupoInput}
              placeholder="Nome do grupo (ex: Revisão de Química)"
              placeholderTextColor={CORES_SYMBIUS.textoTerciario}
              value={grupoNome}
              onChangeText={setGrupoNome}
              maxLength={40}
            />
            <TextInput
              style={styles.grupoInput}
              placeholder="Matéria (opcional)"
              placeholderTextColor={CORES_SYMBIUS.textoTerciario}
              value={grupoMateria}
              onChangeText={setGrupoMateria}
              maxLength={30}
            />
            <Text style={styles.secaoLista}>
              QUEM VAI PARTICIPAR ({grupoMembros.length}/{MAX_MEMBROS_GRUPO - 1})
            </Text>
            <ScrollView style={{ maxHeight: 260 }}>
              {matchesOrdenados.map(m => {
                const uid = m.outro?.uid;
                if (!uid) return null;
                const marcado = grupoMembros.includes(uid);
                return (
                  <TouchableOpacity key={uid} style={styles.grupoOpcao} onPress={() => alternarMembroGrupo(uid)}>
                    <Image source={{ uri: getImageUri(m.outro?.foto) }} style={styles.grupoOpcaoFoto} />
                    <Text style={styles.grupoOpcaoNome} numberOfLines={1}>{m.outro?.nome_completo || 'Usuário'}</Text>
                    <Ionicons name={marcado ? 'checkbox' : 'square-outline'} size={22} color={marcado ? CORES_SYMBIUS.verdeEscuro : CORES_SYMBIUS.textoTerciario} />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={styles.grupoBotoes}>
              <TouchableOpacity style={[styles.grupoBtn, { backgroundColor: CORES_SYMBIUS.fundoSuave }]} onPress={() => setModalGrupo(false)}>
                <Text style={[styles.grupoBtnTxt, { color: CORES_SYMBIUS.texto }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.grupoBtn, { backgroundColor: CORES_SYMBIUS.verdeEscuro }, (!grupoNome.trim() || grupoMembros.length < 2 || criandoGrupo) && { opacity: 0.5 }]}
                onPress={confirmarCriarGrupo}
                disabled={!grupoNome.trim() || grupoMembros.length < 2 || criandoGrupo}
              >
                {criandoGrupo
                  ? <ActivityIndicator color={CORES_SYMBIUS.creme} />
                  : <Text style={styles.grupoBtnTxt}>Criar grupo</Text>}
              </TouchableOpacity>
            </View>
            {grupoMembros.length < 2 && <Text style={[styles.dicaGrupo, { textAlign: 'center' }]}>Escolha pelo menos 2 pessoas.</Text>}
          </View>
        </View>
      </Modal>

      {/* POPUP INFO */}
      {popupInfo && (
        <View style={styles.overlayEscuro}>
          <View style={[styles.popupBox, { backgroundColor: C.branco }]}>
            <View style={[styles.popupIcone, { backgroundColor: CORES.rosa + '25' }]}>
              <Ionicons name="people" size={32} color={CORES.rosa} />
            </View>
            <Text style={[styles.popupTitulo, { color: C.azulEscuro, fontFamily: F.black }]}>
              O que é o <Text style={{ fontStyle: 'italic', color: CORES.rosa }}>Elo Acadêmico</Text>?
            </Text>
            <ScrollView style={{ maxHeight: height * 0.45 }} showsVerticalScrollIndicator={false}>
              {[
                { num: '01', titulo: 'Encontre seu monitor ideal',         desc: 'Conectamos alunos que querem aprender com quem pode ensinar — da mesma série ou superior.' },
                { num: '02', titulo: 'Você escolhe com quem quer estudar', desc: 'Nada é imposto. Você vê o perfil de cada pessoa e decide se quer se conectar.' },
                { num: '03', titulo: 'Elo mútuo → Chat liberado',        desc: 'Só quando os dois aceitarem é que o chat é aberto. Seguro e respeitoso.' },
                { num: '04', titulo: 'Configure no seu Perfil',            desc: 'Vá em Perfil e configure quais matérias você pode ensinar e quais quer melhorar.' },
              ].map(item => (
                <View key={item.num} style={styles.popupItem}>
                  <View style={styles.popupNum}>
                    <Text style={styles.popupNumTxt}>{item.num}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.popupItemTitulo, { color: C.azulEscuro, fontFamily: F.bold }]}>{item.titulo}</Text>
                    <Text style={[styles.popupItemDesc, { color: C.textoSec, fontFamily: F.regular }]}>{item.desc}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.popupBtnPrimary} onPress={() => setPopupInfo(false)}>
              <Ionicons name="checkmark" size={18} color={CORES.branco} />
              <Text style={[styles.popupBtnTxt, { fontFamily: F.bold }]}>Entendido, vamos lá!</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* POPUP MATÉRIA — multi-select com tags */}
      {popupMateria && (
        <View style={styles.overlayEscuro}>
          <View style={[styles.materiaBox, { backgroundColor: C.branco }]}>
            <Text style={[styles.materiaTitulo, { color: C.azulEscuro, fontFamily: F.black }]}>Filtrar por matéria</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.materiaTagsGrid}>
                {MATERIAS.map(m => {
                  const selecionada = materiasFiltro.includes(m);
                  return (
                    <TouchableOpacity
                      key={m}
                      style={[
                        styles.materiaTagOpcao,
                        selecionada && styles.materiaTagOpcaoAtiva,
                      ]}
                      onPress={() => toggleMateria(m)}
                    >
                      {selecionada && (
                        <Ionicons name="checkmark" size={11} color={CORES.branco} style={{ marginRight: 3 }} />
                      )}
                      <Text style={[
                        styles.materiaTagOpcaoTxt,
                        { color: selecionada ? CORES.branco : CORES.azulEscuro, fontFamily: F.bold },
                      ]}>
                        {m}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.materiaBotoes}>
              <TouchableOpacity
                style={styles.btnLimpar}
                onPress={() => setMateriasFiltro([])}
              >
                <Text style={[styles.btnLimparTxt, { color: C.textoSec, fontFamily: F.bold }]}>Limpar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnAplicar}
                onPress={() => setPopupMateria(false)}
              >
                <Text style={styles.btnAplicarTxt}>
                  {materiasFiltro.length === 0
                    ? 'Ver todas'
                    : `Ver resultados (${materiasFiltro.length})`}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <SymbiusTabBar ativa="match" navigation={navigation} uid={meuUid} />
    </View>
  );
}

const styles = StyleSheet.create({
  cardVisivel: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16,
    backgroundColor: CORES_SYMBIUS.fundoCard, borderWidth: 1, borderColor: CORES_SYMBIUS.borda,
  },
  cardVisivelOff: { backgroundColor: CORES_SYMBIUS.fundoLaranjaClaro, borderColor: CORES_SYMBIUS.laranja + '55' },
  cardVisivelTitulo: { fontSize: 13.5, fontFamily: F.bold, color: CORES_SYMBIUS.texto },
  cardVisivelSub: { fontSize: 11.5, fontFamily: F.regular, color: CORES_SYMBIUS.textoSec, marginTop: 2, lineHeight: 16 },
  btnCriarGrupo: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: CORES_SYMBIUS.verdeEscuro, borderRadius: 14, paddingVertical: 12,
  },
  btnCriarGrupoTxt: { fontSize: 14, fontFamily: F.bold, color: CORES_SYMBIUS.creme },
  dicaGrupo: { fontSize: 11.5, fontFamily: F.medium, color: CORES_SYMBIUS.textoSec, marginTop: 6 },
  secaoLista: { fontSize: 10.5, fontFamily: F.bold, letterSpacing: 0.6, color: CORES_SYMBIUS.textoSec, marginTop: 14, marginBottom: 8 },
  grupoAvatar: { backgroundColor: CORES_SYMBIUS.verdeEscuro, justifyContent: 'center', alignItems: 'center' },
  grupoOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  grupoSheet: { backgroundColor: CORES_SYMBIUS.fundoCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12 },
  grupoHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: CORES_SYMBIUS.borda2, alignSelf: 'center', marginBottom: 12 },
  grupoTitulo: { fontSize: 18, fontFamily: F.black, color: CORES_SYMBIUS.texto, marginBottom: 12 },
  grupoInput: {
    backgroundColor: CORES_SYMBIUS.fundo, borderRadius: 12, borderWidth: 1, borderColor: CORES_SYMBIUS.borda,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, fontFamily: F.regular, color: CORES_SYMBIUS.texto, marginBottom: 10,
  },
  grupoOpcao: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  grupoOpcaoFoto: { width: 36, height: 36, borderRadius: 18, backgroundColor: CORES_SYMBIUS.fundoSuave },
  grupoOpcaoNome: { flex: 1, fontSize: 14, fontFamily: F.semibold, color: CORES_SYMBIUS.texto },
  grupoBotoes: { flexDirection: 'row', gap: 10, marginTop: 14 },
  grupoBtn: { flex: 1, borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  grupoBtnTxt: { fontSize: 14, fontFamily: F.bold, color: CORES_SYMBIUS.creme },

  feedCard: {
    backgroundColor: CORES_SYMBIUS.fundoCard, borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: CORES_SYMBIUS.borda,
  },
  feedTopo:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  feedAvatar:    { width: 56, height: 56, borderRadius: 28, backgroundColor: CORES_SYMBIUS.fundoSuave },
  feedNome:      { fontSize: 16, fontFamily: F.bold, color: CORES_SYMBIUS.texto },
  feedTurma:     { fontSize: 12, fontFamily: F.medium, color: CORES_SYMBIUS.textoSec, marginTop: 1 },
  feedNota:      { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  feedNotaTxt:   { fontSize: 11, fontFamily: F.semibold, color: CORES_SYMBIUS.textoSec },
  feedBio:       { fontSize: 13, fontFamily: F.regular, color: CORES_SYMBIUS.texto, lineHeight: 19, marginTop: 12 },
  feedRotulo:    { fontSize: 10, fontFamily: F.bold, letterSpacing: 0.6, color: CORES_SYMBIUS.textoSec, marginTop: 12, marginBottom: 6 },
  feedMaterias:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  feedMateria:   { backgroundColor: CORES_SYMBIUS.fundoSuave, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  feedMateriaDestaque: { backgroundColor: CORES_SYMBIUS.verdeEscuro },
  feedMateriaTxt: { fontSize: 11.5, fontFamily: F.semibold, color: CORES_SYMBIUS.texto },
  feedAcoes:     { flexDirection: 'row', gap: 10, marginTop: 14 },
  feedBtnRecusar: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: 14, paddingVertical: 11, borderWidth: 1.5, borderColor: '#D9534F55',
  },
  feedBtnRecusarTxt: { fontSize: 13.5, fontFamily: F.bold, color: '#D9534F' },
  feedBtnAceitar: {
    flex: 1.6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: 14, paddingVertical: 11, backgroundColor: CORES_SYMBIUS.verdeEscuro,
  },
  feedBtnAceitarTxt: { fontSize: 13.5, fontFamily: F.bold, color: CORES_SYMBIUS.creme },
  solicTopo:        { marginBottom: 14, paddingHorizontal: 2 },
  solicTitulo:      { fontSize: 18, lineHeight: 24, fontFamily: F.black, letterSpacing: -0.3, color: CORES_SYMBIUS.texto },
  solicSub:         { fontSize: 13, fontFamily: F.medium, color: CORES_SYMBIUS.textoSec, marginTop: 3 },
  avisoSolic: {
    flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, padding: 14, borderRadius: 20,
    backgroundColor: CORES_SYMBIUS.fundoCard, borderWidth: 1.5, borderColor: CORES_SYMBIUS.semente,
  },
  avisoSolicIcone: { width: 42, height: 42, borderRadius: 21, backgroundColor: CORES_SYMBIUS.semente, justifyContent: 'center', alignItems: 'center' },
  avisoSolicTitulo: { fontSize: 14, fontFamily: F.bold, color: CORES_SYMBIUS.texto },
  avisoSolicSub:    { fontSize: 12, fontFamily: F.medium, color: CORES_SYMBIUS.textoSec, marginTop: 1 },

  container:          { flex: 1, backgroundColor: CORES.fundo },
  navbar:             { minHeight: 60, paddingBottom: 8, backgroundColor: CORES.branco, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: CORES.cinzaClaro },
  logoWrap:           { position: 'relative', flexDirection: 'row', alignItems: 'center' },
  dotAmarelo:         { position: 'absolute', top: 2, left: -4, width: 7, height: 7, borderRadius: 4, backgroundColor: CORES.amarelo, zIndex: 1 },
  logo:               { fontSize: 17, fontFamily: F.black, color: CORES.azulEscuro, letterSpacing: -0.3 },
  tabs:               { flexDirection: 'row', backgroundColor: CORES.branco, paddingHorizontal: 16, paddingBottom: 14, paddingTop: 10, borderBottomWidth: 1, borderBottomColor: CORES.cinzaClaro },
  tabsTrack:          { flex: 1, flexDirection: 'row', gap: 4, backgroundColor: CORES.fundo, padding: 4, borderRadius: 14 },
  tab:                { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8, minHeight: 44, borderRadius: 12 },
  tabAtiva:           { backgroundColor: CORES.azulEscuro },
  tabTxt:             { fontSize: 13, fontFamily: F.bold, color: CORES.textoSec },
  tabTxtAtiva:        { color: CORES.branco },
  badge:              { backgroundColor: CORES.rosa, width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', marginLeft: 2 },
  badgeTxt:           { color: CORES.branco, fontSize: 10, fontFamily: F.black },
  filtros:            { backgroundColor: CORES.branco, paddingHorizontal: 16, paddingVertical: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: CORES.cinzaClaro },
  materiaSelector:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: CORES.fundo, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: CORES.cinzaClaro, minHeight: 46 },
  materiaSelectorTxt: { fontSize: 14, fontFamily: F.semibold, color: CORES.textoSec },

  // Tags no selector (resumo das selecionadas)
  tagMateriaFiltro:    { backgroundColor: CORES.azulEscuro, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  tagMateriaFiltroTxt: { color: CORES.branco, fontSize: 11, fontFamily: F.bold },

  // Card descobrir
  cardWrap:         { flex: 1, alignItems: 'center', paddingTop: 20, paddingHorizontal: 20 },
  matchCard:        { width: '100%', height: height * 0.45, borderRadius: 28, overflow: 'hidden', elevation: 8, shadowColor: CORES.azulEscuro, shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, backgroundColor: CORES.azulEscuro },
  // Swipe overlays
  swiperLabel:      { position: 'absolute', top: 20, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 2.5, backgroundColor: 'rgba(255,255,255,0.15)' },
  swiperLabelCurtir:{ left: 16, borderColor: '#4CAF50' },
  swiperLabelPular: { right: 16, borderColor: '#FF5252' },
  swiperLabelTxt:   { fontSize: 15, fontFamily: F.black, letterSpacing: 1 },
  cardFoto:         { width: '100%', height: '100%' },
  cardOverlay:      { ...{
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
} as any, backgroundColor: 'rgba(11,32,70,0.45)' },
  cardInfo:         { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20 },
  cardNome:         { fontSize: 24, fontFamily: F.black, color: CORES.branco, letterSpacing: -0.5 },
  cardTurma:        { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginBottom: 10 },
  materiasRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  materiaTag:       { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  materiaTagTxt:    { color: CORES.branco, fontSize: 11, fontFamily: F.bold },
  arenaContador:    { marginTop: 12, fontSize: 12, color: CORES.textoSec, fontFamily: F.semibold },
  acoesRow:         { flexDirection: 'row', gap: 24, marginTop: 20 },
  btnRecusar:       { width: 64, height: 64, borderRadius: 32, backgroundColor: CORES.branco, justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#FF5252', shadowOpacity: 0.2, shadowRadius: 8 },
  btnAceitar:       { width: 64, height: 64, borderRadius: 32, backgroundColor: CORES.rosa, justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: CORES.rosa, shadowOpacity: 0.4, shadowRadius: 8 },
  btnRecarregar:    { marginTop: 16, backgroundColor: CORES.azulEscuro, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 16 },
  btnRecarregarTxt: { color: CORES.branco, fontFamily: F.bold },
  centro:           { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  txtVazio:         { color: CORES.textoSec, fontSize: 15, fontFamily: F.semibold, textAlign: 'center' },

  // Cards de match / solicitação
  solCard:         { flexDirection: 'row', alignItems: 'center', backgroundColor: CORES.branco, padding: 14, borderRadius: 20, marginBottom: 10, elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4 },
  solCardNaoLido:  { backgroundColor: CORES.rosa + '18', borderLeftWidth: 3, borderLeftColor: CORES.rosa },
  solAvatar:       { width: 52, height: 52, borderRadius: 26, backgroundColor: CORES.cinzaClaro },
  solInfo:         { flex: 1, marginLeft: 12 },
  solNome:         { fontSize: 15, fontFamily: F.bold, color: CORES.azulEscuro },
  solNomeNaoLido:  { fontFamily: F.black },
  solTurma:        { fontSize: 11, color: CORES.textoSec, marginTop: 1 },
  solAcoes:        { flexDirection: 'row', gap: 8 },
  btnSolRecusar:   { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FF525225', justifyContent: 'center', alignItems: 'center' },
  btnSolAceitar:   { width: 38, height: 38, borderRadius: 19, backgroundColor: CORES.verde, justifyContent: 'center', alignItems: 'center' },

  // Avatar com bolinha online (canto inferior direito — igual Instagram)
  avatarWrap:    { position: 'relative' },
  bolinhaOnline: { position: 'absolute', bottom: 1, right: 1, width: 13, height: 13, borderRadius: 7, backgroundColor: CORES.verde, borderWidth: 2, borderColor: CORES.branco },
  badgeNaoLida:  { width: 10, height: 10, borderRadius: 5, backgroundColor: CORES.rosa, marginLeft: 8, alignSelf: 'center' },

  // Tags inline no match
  nomeLinha:    { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  tagTipo:      { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 7 },
  tagTipoTxt:   { fontSize: 9, fontFamily: F.black },
  tagMateria:   { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 7 },
  tagMateriaTxt:{ fontSize: 10, fontFamily: F.bold },
  tagMais:      { fontSize: 10, color: CORES.textoSec, fontFamily: F.bold },

  // Última mensagem
  ultimaMsg:        { fontSize: 13, color: CORES.textoSec, marginTop: 3 },
  ultimaMsgNaoLida: { color: CORES.azulEscuro, fontFamily: F.bold },
  msgTimestamp:     { fontSize: 11, color: CORES.textoSec, fontFamily: F.medium, marginLeft: 6 },

  // Overlays / popups
  overlayEscuro: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20, zIndex: 999,
  },
  popupBox:      { backgroundColor: CORES.branco, borderRadius: 28, padding: 28, width: '100%', maxWidth: 400 },
  popupIcone:    { width: 64, height: 64, borderRadius: 32, backgroundColor: CORES.rosa + '25', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 16 },
  popupTitulo:   { fontSize: 22, fontFamily: F.black, color: CORES.azulEscuro, textAlign: 'center', marginBottom: 20, letterSpacing: -0.5 },
  popupItem:     { flexDirection: 'row', gap: 14, marginBottom: 18 },
  popupNum:      { width: 32, height: 32, borderRadius: 16, backgroundColor: CORES.azulEscuro, justifyContent: 'center', alignItems: 'center' },
  popupNumTxt:   { color: CORES.branco, fontSize: 11, fontFamily: F.black },
  popupItemTitulo:{ fontSize: 14, fontFamily: F.black, color: CORES.azulEscuro, marginBottom: 4 },
  popupItemDesc: { fontSize: 13, color: CORES.textoSec, lineHeight: 18 },
  popupBtnPrimary:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: CORES.rosa, paddingVertical: 14, borderRadius: 18, marginTop: 8 },
  popupBtnTxt:   { color: CORES.branco, fontFamily: F.black, fontSize: 15 },

  // Popup matéria — novo visual multi-select
  materiaBox:         { backgroundColor: CORES.branco, borderRadius: 28, padding: 24, width: '100%', maxWidth: 400, maxHeight: height * 0.7 },
  materiaTitulo:      { fontSize: 18, fontFamily: F.black, color: CORES.azulEscuro, marginBottom: 16, textAlign: 'center' },
  materiaTagsGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 8 },
  materiaTagOpcao:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: CORES.cinzaClaro },
  materiaTagOpcaoAtiva:{ backgroundColor: CORES.azulEscuro },
  materiaTagOpcaoTxt: { fontSize: 13, fontFamily: F.bold, color: CORES.azulEscuro },
  materiaBotoes:      { flexDirection: 'row', gap: 10, marginTop: 16 },
  btnLimpar:          { flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: 16, borderWidth: 1.5, borderColor: CORES.cinzaClaro },
  btnLimparTxt:       { fontFamily: F.bold, color: CORES.textoSec, fontSize: 14 },
  btnAplicar:         { flex: 2, alignItems: 'center', paddingVertical: 13, borderRadius: 16, backgroundColor: CORES.rosa },
  btnAplicarTxt:      { fontFamily: F.black, color: CORES.branco, fontSize: 14 },
});