import { voltar, HIT_VOLTAR } from '../navegacao';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  StatusBar, Modal, TextInput,
  ActivityIndicator, Platform, FlatList,
  useWindowDimensions, Animated, Vibration, PanResponder, Pressable,
} from 'react-native';
import { useAppSettings } from '../contexts/AppSettingsContext';
import { db } from '../config/firebaseConfig';
import {
  collection, query, where, getDocs, addDoc, updateDoc,
  deleteDoc, doc, setDoc, getDoc, serverTimestamp, onSnapshot
} from 'firebase/firestore';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RefreshControl } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SymbiusTabBar from '../components/SymbiusTabBar';
import { dispararPushSerie } from '../services/pushNotificationsService';



// ── Fonte Poppins (igual Index) ──
import { F } from '../constants/theme';
import { CORES_SYMBIUS, CORES_SYMBIUS_DARK } from './Boasvindas';

// ── Shadow de paleta Symbius (mesma técnica de Match/Perfil/Configuracoes):
// a lógica desta tela usa CORES.xxx (import direto, fixo claro) e C.xxx
// (via useAppSettings, muda com modoEscuro) — sombreamos os dois. ──
const CORES = {
  azulEscuro: CORES_SYMBIUS.verdeEscuro,
  branco:     CORES_SYMBIUS.fundoCard,
  rosa:       '#C9667E',
  textoSec:   CORES_SYMBIUS.textoSec,
};
const CORES_LOCAL_CLARO = {
  azulEscuro: CORES_SYMBIUS.verdeEscuro,
  branco:     CORES_SYMBIUS.fundoCard,
  cinzaClaro: CORES_SYMBIUS.borda,
  fundo:      CORES_SYMBIUS.fundo,
  preto:      CORES_SYMBIUS.texto,
  textoSec:   CORES_SYMBIUS.textoSec,
  amarelo:    CORES_SYMBIUS.laranja,
  rosa:       CORES_SYMBIUS.laranjaTexto,
};
const CORES_LOCAL_ESCURO = {
  azulEscuro: CORES_SYMBIUS.verdeMedio,
  branco:     CORES_SYMBIUS_DARK.fundoCard,
  cinzaClaro: CORES_SYMBIUS_DARK.fundoSuave,
  fundo:      CORES_SYMBIUS_DARK.fundo,
  preto:      CORES_SYMBIUS_DARK.texto,
  textoSec:   CORES_SYMBIUS_DARK.textoSec,
  amarelo:    CORES_SYMBIUS.laranja,
  rosa:       CORES_SYMBIUS.laranja,
};

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MESES_ABREV = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

const gerarIdAleatorio = (prefix: string) => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = prefix + '_';
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
};

const TIPOS_EVENTO = ['Prova','Feriado','Aviso','Evento'];

const TIPO_CONFIG: Record<string, { color: string; bg: string; icon: any }> = {
  lembrete: { color: '#6B7A70', bg: '#6B7A7022', icon: 'bookmark'      },
  Prova:    { color: '#C84B2E', bg: '#C84B2E22', icon: 'document-text' },
  Feriado:  { color: '#3E8E55', bg: '#3E8E5522', icon: 'sunny'         },
  Aviso:    { color: '#A8841F', bg: '#C8A84B33', icon: 'megaphone'     },
  Evento:   { color: '#3F82B5', bg: '#3F82B522', icon: 'sparkles'      },
};

const TIPO_COLLECTION: Record<string, { sub: string; prefix: string }> = {
  Prova:   { sub: 'provas',   prefix: 'prv' },
  Feriado: { sub: 'feriados', prefix: 'fer' },
  Aviso:   { sub: 'avisos',   prefix: 'avs' },
  Evento:  { sub: 'eventos',  prefix: 'evt' },
};

const PARENT_DOC = 'tipos';

// ── Utils ──
const formatarDataStr = (ano: number, mes: number, dia: number) =>
  `${ano}-${String(mes).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;

const extrairSerie = (turma: string) => {
  if (!turma) return null;
  const match = turma.match(/^(\d+)/);
  return match ? `${match[1]}º` : null;
};

const capitalizarPrimeira = (s: string) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

const calcularDiasRestantes = (dataStr: string) => {
  const [a, m, d] = dataStr.split('-').map(Number);
  const alvo = new Date(a, m - 1, d);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  alvo.setHours(0, 0, 0, 0);
  const diff = Math.round((alvo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0)  return { texto: 'É HOJE',           cor: '#e74c3c' };
  if (diff === 1)  return { texto: 'É AMANHÃ',         cor: '#e67e22' };
  if (diff === -1) return { texto: 'FOI ONTEM',        cor: CORES.textoSec };
  if (diff > 0)    return { texto: `FALTAM ${diff} DIAS`, cor: CORES.azulEscuro };
  return { texto: `HÁ ${Math.abs(diff)} DIAS`, cor: CORES.textoSec };
};

// ── Animação de entrada (fade + slide) ──
const FadeInView = ({ children, delay = 0, style }: any) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 350,
      delay,
      useNativeDriver: true,
    }).start();
  }, []);
  return (
    <Animated.View style={[
      style,
      {
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0,1], outputRange: [12, 0] }) }],
      },
    ]}>
      {children}
    </Animated.View>
  );
};

// ── Componente principal ───────────────────────────────
export default function Calendario({ navigation, route }: any) {
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const CEL_SIZE = Math.floor((Math.min(winW, 520) - 32 - 24) / 7);
  const CEL_ALT = Math.round(CEL_SIZE * 1.05);

  const { cores: _coresContexto, fonteScale, modoEscuro: _modoEscuroReal } = useAppSettings();
  // Paleta Symbius ainda não tem modo escuro definitivo (pendente) — fixado
  // em claro por ora, independente do toggle real de Modo Escuro.
  const modoEscuro = false;
  const C = CORES_LOCAL_CLARO;

  const fs = (size: number) => size * fonteScale;

  const uid     = route?.params?.uid;

  const [userRA, setUserRA] = useState<string | null>(null);
  // tipo/turma vêm do perfil no Firestore: a barra inferior navega só com
  // { uid }, e sem isso o admin perdia o botão de criar evento e o aluno
  // não via nenhum evento da série.
  const [tipo,  setTipo]  = useState<string | undefined>(route?.params?.tipo);
  const [turma, setTurma] = useState<string | undefined>(route?.params?.turma);

// Fetch do RA do usuário ao montar
useEffect(() => {
  const buscarRA = async () => {
  if (!uid) return;
  try {
    const snap = await getDoc(doc(db, 'usuarios', uid));
    if (snap.exists()) {
      const dados = snap.data();
      const raLimpo = dados.ra?.replace(/[\/\\]/g, '');
      const raValido = raLimpo && raLimpo !== 'N/A' && raLimpo.length > 0;
      setTipo(dados.tipo);
      setTurma(dados.turma);
      setUserRA(raValido ? raLimpo : uid);
    }
  } catch (e) { console.error('Erro buscar RA:', e); }
};
  buscarRA();
}, [uid]);

  const isAdmin = tipo?.toLowerCase() === 'administrador';
  const serie   = extrairSerie(turma || '');

  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());

  // ── Trocar de mês: setas e arrastar horizontal usam a mesma função ──
  const mesAnoRef = useRef({ mes, ano });
  mesAnoRef.current = { mes, ano };
  const mudarMes = (delta: number) => {
    const total = mesAnoRef.current.ano * 12 + mesAnoRef.current.mes + delta;
    setAno(Math.floor(total / 12));
    setMes(((total % 12) + 12) % 12);
  };

  // O gesto só é assumido quando o movimento é claramente horizontal, então
  // a rolagem vertical da tela continua com o ScrollView.
  const arrasteX = useRef(new Animated.Value(0)).current;
  const LIMIAR_TROCA = 60;
  const panMes = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 16 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_, g) => arrasteX.setValue(g.dx * 0.6),
    onPanResponderRelease: (_, g) => {
      const trocar = Math.abs(g.dx) > LIMIAR_TROCA || Math.abs(g.vx) > 0.5;
      if (!trocar) {
        Animated.spring(arrasteX, { toValue: 0, useNativeDriver: false }).start();
        return;
      }
      const direcao = g.dx < 0 ? 1 : -1; // arrastar pra esquerda = próximo mês
      Animated.timing(arrasteX, { toValue: -direcao * 120, duration: 120, useNativeDriver: false }).start(() => {
        mudarMesRef.current(direcao);
        arrasteX.setValue(direcao * 120);
        Animated.timing(arrasteX, { toValue: 0, duration: 160, useNativeDriver: false }).start();
      });
    },
    onPanResponderTerminate: () => Animated.spring(arrasteX, { toValue: 0, useNativeDriver: false }).start(),
  })).current;
  const mudarMesRef = useRef(mudarMes);
  mudarMesRef.current = mudarMes;
  const opacidadeArraste = arrasteX.interpolate({ inputRange: [-120, 0, 120], outputRange: [0.3, 1, 0.3], extrapolate: 'clamp' });

  // ── Dados ──
  const [lembretes,    setLembretes]    = useState<Map<string, any[]>>(new Map());
  const [eventosAdmin, setEventosAdmin] = useState<Map<string, any[]>>(new Map());
  const [adminTodos,   setAdminTodos]   = useState<any[]>([]);
  const [lembretesTodos, setLembretesTodos] = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);

  // ── Modais ──
  const [modalDia,        setModalDia]        = useState(false);
  const [modalAdminForm,  setModalAdminForm]  = useState(false);
  const [modalLegenda,    setModalLegenda]    = useState(false);
  const [modalDetalhe,    setModalDetalhe]    = useState(false);
  const [eventoDetalhe,   setEventoDetalhe]   = useState<any>(null);
  const [diaSelecionado,  setDiaSelecionado]  = useState('');

  const [confirm, setConfirm] = useState<{
    titulo: string; msg: string; btn: string; onOk: () => void
  } | null>(null);

  const [toast, setToast] = useState('');
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Filtros ──
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');

  // ── Form lembrete ──
  const [lembreTitulo, setLembreTitulo] = useState('');
  const [lembreDesc,   setLembreDesc]   = useState('');
  const [salvandoLemb, setSalvandoLemb] = useState(false);
  const [lembEditandoId, setLembEditandoId] = useState<string | null>(null);

  // ── Form admin ──
  const [adminTitulo,  setAdminTitulo]  = useState('');
  const [adminDesc,    setAdminDesc]    = useState('');
  const [adminData,    setAdminData]    = useState('');
  const [adminTipo,    setAdminTipo]    = useState('');
  const [adminSeries,  setAdminSeries]  = useState<string[]>([]);
  const [salvandoAdm,  setSalvandoAdm]  = useState(false);
  const [modalTipoEvt, setModalTipoEvt] = useState(false);
  const [modalDataEvt, setModalDataEvt] = useState(false);
  const [admEditandoId, setAdmEditandoId] = useState<string | null>(null);

  // Seletor de data
  const [selAno, setSelAno] = useState(ano);
  const [selMes, setSelMes] = useState(mes + 1);
  const [selDia, setSelDia] = useState(1);
  const totalDiasSelMes = new Date(selAno, selMes, 0).getDate();

  useEffect(() => {
  if (userRA) carregar();
}, [userRA]);

  const carregar = async () => {
    setLoading(true);
    await Promise.all([carregarLembretes(), carregarEventosAdmin()]);
    setLoading(false);
  };

  const carregarLembretes = async () => {
  if (!userRA) return;
  try {
    const snap = await getDocs(collection(db, 'lembretes', userRA, 'lembretes'));
    const mapa = new Map<string, any[]>();
    const todos: any[] = [];
    snap.forEach(d => {
      const ev: any = { id: d.id, ...d.data() };
      todos.push(ev);
      if (!mapa.has(ev.data)) mapa.set(ev.data, []);
      mapa.get(ev.data)!.push(ev);
    });
    setLembretes(mapa);
    setLembretesTodos(todos);
  } catch (e) { console.error('Erro lembretes:', e); }
};

  const carregarEventosAdmin = async () => {
  try {
    const mapa = new Map<string, any[]>();
    const todos: any[] = [];

    for (const tipo of Object.keys(TIPO_COLLECTION)) {
      const config = TIPO_COLLECTION[tipo];
      let snap;
      
      const subRef = collection(db, 'eventos_admin', PARENT_DOC, config.sub);

      if (isAdmin) {
        snap = await getDocs(subRef);
      } else if (serie) {
        snap = await getDocs(query(
          subRef,
          where('series', 'array-contains', serie)
        ));
      } else continue;

      snap.forEach(d => {
        const ev: any = { 
          id: d.id, 
          _sub: config.sub,
          ...d.data() 
        };
        todos.push(ev);
        if (!mapa.has(ev.data)) mapa.set(ev.data, []);
        mapa.get(ev.data)!.push(ev);
      });
    }

    todos.sort((a, b) => a.data.localeCompare(b.data));
    setEventosAdmin(mapa);
    setAdminTodos(todos);
  } catch (e) { console.error('Erro eventos admin:', e); }
};

  
  const eventosFiltrados = useMemo(() => {
    const doMes = adminTodos.filter(ev => {
      const [a, m] = ev.data.split('-').map(Number);
      return a === ano && m === mes + 1;
    });
    const filtrados = filtroTipo === 'todos' ? doMes : doMes.filter(ev => ev.tipo === filtroTipo);

    // Prioridade: próximos (>= hoje) primeiro em ordem crescente; vencidos (<hoje) por último em ordem decrescente
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const hojeStr = hoje.toISOString().split('T')[0]; // 'YYYY-MM-DD'

    const proximos = filtrados.filter(ev => ev.data >= hojeStr).sort((a, b) => a.data.localeCompare(b.data));
    const vencidos = filtrados.filter(ev => ev.data <  hojeStr).sort((a, b) => b.data.localeCompare(a.data));

    return [...proximos, ...vencidos];
  }, [adminTodos, mes, ano, filtroTipo]);

  // ── Lembrete: salvar OU atualizar ──
  const salvarLembrete = async () => {
  if (!lembreTitulo.trim()) {
    setToast('Título obrigatório');
    return;
  }
  if (!userRA) {
    setToast('Aguarde carregar...');
    return;
  }
  setSalvandoLemb(true);
  try {
    const dados = {
      uid,
      data:      diaSelecionado,
      titulo:    capitalizarPrimeira(lembreTitulo.trim()),
      descricao: capitalizarPrimeira(lembreDesc.trim()),
    };
    if (lembEditandoId) {
      await updateDoc(doc(db, 'lembretes', userRA, 'lembretes', lembEditandoId), dados);
      setLembretes(prev => {
        const nova = new Map(prev);
        const lista = (nova.get(diaSelecionado) || []).map(e =>
          e.id === lembEditandoId ? { ...e, ...dados } : e
        );
        nova.set(diaSelecionado, lista);
        return nova;
      });
      setToast('Lembrete atualizado');
    } else {
      const ref = await addDoc(collection(db, 'lembretes', userRA, 'lembretes'), {
        ...dados, criado_em: serverTimestamp(),
      });
      const novo = { id: ref.id, ...dados };
      setLembretes(prev => {
        const nova = new Map(prev);
        if (!nova.has(diaSelecionado)) nova.set(diaSelecionado, []);
        nova.get(diaSelecionado)!.push(novo);
        return nova;
      });
      setToast('Lembrete salvo');
    }
    setLembreTitulo(''); setLembreDesc(''); setLembEditandoId(null);
  } catch {
    setToast('Falha ao salvar');
  } finally {
    setSalvandoLemb(false);
  }
};
  const editarLembrete = (lemb: any) => {
    setLembEditandoId(lemb.id);
    setLembreTitulo(lemb.titulo);
    setLembreDesc(lemb.descricao || '');
  };

  const cancelarEdicaoLembrete = () => {
    setLembEditandoId(null);
    setLembreTitulo(''); setLembreDesc('');
  };

  const pedirConfirmacaoExcluirLembrete = (id: string) => {
  setConfirm({
    titulo: 'Excluir lembrete?',
    msg:    'Essa ação não pode ser desfeita.',
    btn:    'Excluir',
    onOk:   async () => {
      if (!userRA) return;
      try {
        await deleteDoc(doc(db, 'lembretes', userRA, 'lembretes', id));
        setLembretes(prev => {
          const nova = new Map(prev);
          const lista = (nova.get(diaSelecionado) || []).filter(e => e.id !== id);
          if (lista.length) nova.set(diaSelecionado, lista);
          else nova.delete(diaSelecionado);
          return nova;
        });
        setToast('Lembrete excluído');
      } catch {
        setToast('Erro ao excluir');
      }
    }
  });
};

  // ── Admin: salvar OU atualizar ──
  const toggleSerie = (s: string) =>
    setAdminSeries(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const abrirFormNovoEvento = () => {
    setAdmEditandoId(null);
    setSelAno(ano); setSelMes(mes + 1); setSelDia(1);
    setAdminData(''); setAdminTitulo(''); setAdminDesc('');
    setAdminTipo(''); setAdminSeries([]);
    setModalAdminForm(true);
  };

  const editarEventoAdmin = (ev: any) => {
    setAdmEditandoId(ev.id);
    setAdminTitulo(ev.titulo);
    setAdminDesc(ev.descricao || '');
    setAdminData(ev.data);
    setAdminTipo(ev.tipo);
    setAdminSeries(ev.series || []);
    setModalDetalhe(false);
    setTimeout(() => setModalAdminForm(true), 200);
  };

  const salvarEventoAdmin = async () => {
  if (!adminTitulo.trim() || !adminData || !adminTipo || adminSeries.length === 0) {
    setToast('Preencha tudo + ao menos uma série');
    return;
  }
  setSalvandoAdm(true);
  try {
    const dados = {
      titulo:    capitalizarPrimeira(adminTitulo.trim()),
      descricao: capitalizarPrimeira(adminDesc.trim()),
      data:      adminData,
      tipo:      adminTipo,
      series:    adminSeries,
    };

    const config = TIPO_COLLECTION[adminTipo];
    if (!config) {
    setToast('Tipo inválido');
    setSalvandoAdm(false);
    return;
  }

    if (admEditandoId) {
      // Edição: usa a sub original
      const eventoOriginal = adminTodos.find(e => e.id === admEditandoId);
      const subOriginal = eventoOriginal?._sub || config.sub;
      
      await updateDoc(
        doc(db, 'eventos_admin', PARENT_DOC, subOriginal, admEditandoId),
        dados
      );
      await carregarEventosAdmin();
      setToast('Evento atualizado');
    } else {
      await setDoc(doc(db, 'eventos_admin', PARENT_DOC), 
        { _placeholder: true }, 
        { merge: true }
      );
      const novoId = gerarIdAleatorio(config.prefix);
      await setDoc(
        doc(db, 'eventos_admin', PARENT_DOC, config.sub, novoId),
        { ...dados, criado_em: serverTimestamp() }
      );

      const novo = { id: novoId, _sub: config.sub, ...dados };
      setAdminTodos(prev => [...prev, novo].sort((a,b) => a.data.localeCompare(b.data)));
      setEventosAdmin(prev => {
        const nova = new Map(prev);
        if (!nova.has(adminData)) nova.set(adminData, []);
        nova.get(adminData)!.push(novo);
        return nova;
      });
      setToast('Evento publicado');
      const [, mEv, dEv] = adminData.split('-').map(Number);
      dispararPushSerie({
        series: adminSeries,
        titulo: `Novo ${adminTipo.toLowerCase()} na agenda`,
        corpo: `${dados.titulo} · ${dEv} de ${MESES[mEv - 1]}`,
        dados: { tipo: 'evento_admin', eventoId: novoId, tipoEvento: adminTipo },
      });
    }

    setModalAdminForm(false);
    setAdminTitulo(''); setAdminDesc(''); setAdminData('');
    setAdminTipo(''); setAdminSeries([]); setAdmEditandoId(null);
  } catch (e) {
    console.error('Erro salvar admin:', e);
    setToast('Falha ao salvar');
  } finally {
    setSalvandoAdm(false);
  }
};

  const pedirConfirmacaoExcluirEvento = (id: string, dataStr: string) => {
  setConfirm({
    titulo: 'Excluir evento?',
    msg:    'Será removido para todos os alunos das séries selecionadas.',
    btn:    'Excluir',
    onOk:   async () => {
      try {
        const evento = adminTodos.find(e => e.id === id);
        const subOrigem = evento?._sub || 'eventos';

        await deleteDoc(doc(db, 'eventos_admin', PARENT_DOC, subOrigem, id));
        
        setEventosAdmin(prev => {
          const nova = new Map(prev);
          const lista = (nova.get(dataStr) || []).filter(e => e.id !== id);
          if (lista.length) nova.set(dataStr, lista);
          else nova.delete(dataStr);
          return nova;
        });
        setAdminTodos(prev => prev.filter(e => e.id !== id));
        setModalDetalhe(false);
        setToast('Evento excluído');
      } catch {
        setToast('Erro ao excluir');
      }
    }
  });
};
  // ── Grade ──
  const primeiroDia = new Date(ano, mes, 1).getDay();
  const totalDias   = new Date(ano, mes + 1, 0).getDate();
  const celulas: (number | null)[] = [
    ...Array(primeiroDia).fill(null),
    ...Array.from({ length: totalDias }, (_, i) => i + 1),
  ];

  const noMesAtual = mes === hoje.getMonth() && ano === hoje.getFullYear();

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([carregarLembretes(), carregarEventosAdmin()]);
      } catch (error) {
      console.error('Erro ao recarregar:', error);
      } finally {
      setRefreshing(false);
    }
  };
  
  const renderCelula = (dia: number | null, idx: number) => {
    if (!dia) return <View key={`v${idx}`} style={{ width: CEL_SIZE, height: CEL_ALT }} />;

    const dataStr   = formatarDataStr(ano, mes + 1, dia);
    const eHoje     = dia === hoje.getDate() && noMesAtual;
    const diaSem    = new Date(ano, mes, dia).getDay();
    const eFimSem   = diaSem === 0 || diaSem === 6;
    const temLemb   = lembretes.has(dataStr);
    const temAdmin  = eventosAdmin.has(dataStr);
    const tiposAdm  = temAdmin ? [...new Set(eventosAdmin.get(dataStr)!.map(e => e.tipo))] : [];

    return (
      <TouchableOpacity
        key={dataStr}
        style={[styles.celula, { width: CEL_SIZE, height: CEL_ALT }]}
        onPress={() => { setDiaSelecionado(dataStr); setModalDia(true); }}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${dia} de ${MESES[mes]}${temLemb || temAdmin ? ', com compromissos' : ''}`}
      >
        <View style={[styles.numWrap, eHoje && { backgroundColor: CORES_SYMBIUS.verdeEscuro }]}>
          <Text style={[
            styles.numDia,
            { color: eFimSem ? CORES_SYMBIUS.textoSec : CORES_SYMBIUS.texto, fontSize: fs(14) },
            eHoje && { color: CORES_SYMBIUS.creme },
          ]}>
            {dia}
          </Text>
        </View>
        <View style={styles.dotsRow}>
          {temLemb && <View style={[styles.dot, { backgroundColor: TIPO_CONFIG.lembrete.color }]} />}
          {tiposAdm.slice(0, 3).map(t => (
            <View key={t} style={[styles.dot, { backgroundColor: TIPO_CONFIG[t]?.color || '#888' }]} />
          ))}
        </View>
      </TouchableOpacity>
    );
  };

  // ── Modal dia ──
  const parseDia = (ds: string) => {
    if (!ds) return { dia: 0, mesNome: '', anoN: 0, diaSemNome: '' };
    const [a, m, d] = ds.split('-').map(Number);
    const obj = new Date(a, m - 1, d);
    return { dia: d, mesNome: MESES[m - 1], anoN: a, diaSemNome: DIAS_SEMANA[obj.getDay()] };
  };

  const { dia: diaNum, mesNome: mesNomeDia, anoN, diaSemNome } = parseDia(diaSelecionado);
  const evsAdmDia: any[] = eventosAdmin.get(diaSelecionado) || [];
  const lembDia:   any[] = lembretes.get(diaSelecionado)    || [];

  const diasNoMes = (a: number, m: number) => new Date(a, m, 0).getDate();
  // Troca ano/mês mantendo o dia válido (31 de jan -> fev vira 28/29) e virando
  // o ano quando passa de dezembro/janeiro.
  const ajustarSelecao = (a: number, m: number, d: number) => {
    while (m > 12) { m -= 12; a += 1; }
    while (m < 1)  { m += 12; a -= 1; }
    setSelAno(a); setSelMes(m); setSelDia(Math.min(d, diasNoMes(a, m)));
  };

  const resetFormAdmin = () => {
    setModalAdminForm(false);
    setAdminTitulo(''); setAdminDesc(''); setAdminData('');
    setAdminTipo(''); setAdminSeries([]); setAdmEditandoId(null);
  };
  // Tocar fora do quadro fecha; se já tem coisa preenchida, confirma antes.
  const fecharFormAdmin = () => {
    const sujo = !admEditandoId && (adminTitulo.trim() || adminDesc.trim() || adminData || adminTipo || adminSeries.length > 0);
    if (!sujo) { resetFormAdmin(); return; }
    setConfirm({
      titulo: 'Descartar este evento?',
      msg:    'O que você preencheu será perdido.',
      btn:    'Descartar',
      onOk:   resetFormAdmin,
    });
  };

  const confirmarData = () => {
    setAdminData(formatarDataStr(selAno, selMes, selDia));
    setModalDataEvt(false);
  };

  

  // ── Linha de evento ──
  const quandoCurto = (dataStr: string) => {
    const [a, m, d] = dataStr.split('-').map(Number);
    const alvo = new Date(a, m - 1, d); alvo.setHours(0, 0, 0, 0);
    const ref = new Date(); ref.setHours(0, 0, 0, 0);
    const diff = Math.round((alvo.getTime() - ref.getTime()) / 86400000);
    if (diff === 0) return { texto: 'Hoje', destaque: true, passado: false };
    if (diff === 1) return { texto: 'Amanhã', destaque: true, passado: false };
    if (diff === -1) return { texto: 'Ontem', destaque: false, passado: true };
    if (diff > 0) return { texto: `Em ${diff} dias`, destaque: false, passado: false };
    return { texto: `Há ${Math.abs(diff)} dias`, destaque: false, passado: true };
  };

  const renderEventoCard = ({ item, index }: any) => {
    const config = TIPO_CONFIG[item.tipo] || TIPO_CONFIG.Evento;
    const [, m, d] = item.data.split('-').map(Number);
    const quando = quandoCurto(item.data);
    const series = (item.series || []).join(' · ');

    return (
      <FadeInView delay={index * 50}>
        <TouchableOpacity
          style={[styles.evLinha, quando.passado && { opacity: 0.6 }]}
          onPress={() => { setEventoDetalhe(item); setModalDetalhe(true); }}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`${item.tipo}: ${item.titulo}, ${d} de ${MESES[m - 1]}, ${quando.texto}`}
        >
          <View style={[styles.evBarra, { backgroundColor: config.color }]} />
          <View style={styles.evData}>
            <Text style={[styles.evDataDia, { color: config.color, fontSize: fs(22) }]}>{d}</Text>
            <Text style={[styles.evDataMes, { fontSize: fs(12) }]}>{MESES_ABREV[m - 1]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.evTitulo, { fontSize: fs(15) }]} numberOfLines={1}>{item.titulo}</Text>
            <Text style={[styles.evMeta, { fontSize: fs(12) }]} numberOfLines={1}>
              {item.tipo}{series ? ` · ${series}` : ''}
            </Text>
          </View>
          <Text style={[styles.evQuando, { fontSize: fs(12) }, quando.destaque && styles.evQuandoDestaque]}>{quando.texto}</Text>
        </TouchableOpacity>
      </FadeInView>
    );
  };

   if (loading) return (
    <View style={[styles.centro, { backgroundColor: C.fundo }]}>
      <ActivityIndicator size="large" color={modoEscuro ? C.amarelo : CORES.azulEscuro} />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: C.fundo }]}>
      {/* StatusBar continua azul fixo (identidade visual do header) */}
      <StatusBar barStyle={CORES_SYMBIUS.barStyle} backgroundColor={CORES_SYMBIUS.fundo} />

      {/* TOAST — mantém azul escuro fixo (overlay) */}
      {toast !== '' && (
        <View style={[styles.toast, { top: insets.top + 12 }]}>
          <Text style={[styles.toastText, { fontSize: fs(13) }]}>{toast}</Text>
        </View>
      )}

      {/* HEADER */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity hitSlop={HIT_VOLTAR} onPress={() => voltar(navigation)} style={styles.btnVoltar} accessibilityLabel="Voltar">
          <Ionicons name="arrow-back" size={22} color={CORES_SYMBIUS.texto} />
        </TouchableOpacity>
        <Text style={[styles.headerTitulo, { flex: 1, textAlign: 'center', fontSize: fs(17) }]} numberOfLines={1}>Calendário</Text>
        {isAdmin ? (
          <TouchableOpacity onPress={abrirFormNovoEvento} style={styles.btnAdd} accessibilityRole="button" accessibilityLabel="Novo evento">
            <Ionicons name="add-circle" size={30} color={CORES_SYMBIUS.verdeEscuro} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

    <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={modoEscuro ? C.amarelo : CORES.azulEscuro}
          title="Puxe para recarregar"
          titleColor={C.textoSec}
        />
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* MÊS */}
        <FadeInView delay={0}>
        <View style={styles.navMes}>
          <TouchableOpacity
            style={styles.btnNavMes}
            onPress={() => mudarMes(-1)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            accessibilityLabel="Mês anterior"
          >
            <Ionicons name="chevron-back" size={20} color={CORES_SYMBIUS.texto} />
          </TouchableOpacity>

          <View style={{ alignItems: 'center' }}>
            <Text style={[styles.navMesNome, { fontSize: fs(26) }]}>{MESES[mes]}</Text>
            <Text style={[styles.navAno, { fontSize: fs(13) }]}>{ano}</Text>
          </View>

          <TouchableOpacity
            style={styles.btnNavMes}
            onPress={() => mudarMes(1)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            accessibilityLabel="Próximo mês"
          >
            <Ionicons name="chevron-forward" size={20} color={CORES_SYMBIUS.texto} />
          </TouchableOpacity>
        </View>

        {!noMesAtual && (
          <TouchableOpacity
            style={styles.btnHoje}
            onPress={() => { setMes(hoje.getMonth()); setAno(hoje.getFullYear()); }}
            accessibilityRole="button"
          >
            <Ionicons name="locate" size={14} color={CORES_SYMBIUS.verdeEscuro} />
            <Text style={[styles.btnHojeText, { fontSize: fs(13) }]}>Voltar para hoje</Text>
          </TouchableOpacity>
        )}
        </FadeInView>

        {/* CALENDÁRIO */}
        <FadeInView delay={80}>
        <Animated.View
          {...panMes.panHandlers}
          style={[styles.cardCal, { width: CEL_SIZE * 7 + 26, opacity: opacidadeArraste, transform: [{ translateX: arrasteX }] }]}
          accessibilityHint="Arraste para os lados para trocar de mês"
        >
          <View style={styles.semanaRow}>
            {DIAS_SEMANA.map(d => (
              <Text key={d} style={[styles.semanaLabel, { width: CEL_SIZE, fontSize: fs(12) }]}>{d}</Text>
            ))}
          </View>
          <View style={styles.grade}>
            {celulas.map((dia, idx) => renderCelula(dia, idx))}
          </View>
        </Animated.View>
        </FadeInView>

        {/* EVENTOS DO MÊS */}
        <FadeInView delay={160}>
        <View style={styles.secao}>
          <View style={styles.secaoTopo}>
            <Text style={[styles.secaoTitulo, { fontSize: fs(20) }]}>
              {isAdmin ? 'Eventos cadastrados' : 'Eventos da sua turma'}
            </Text>
            <Text style={[styles.secaoCont, { fontSize: fs(13) }]}>
              {eventosFiltrados.length} {eventosFiltrados.length === 1 ? 'evento' : 'eventos'}
            </Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow} style={styles.chipsScroll}>
            <TouchableOpacity
              style={[styles.chip, filtroTipo === 'todos' && styles.chipAtivo]}
              onPress={() => setFiltroTipo('todos')}
              accessibilityRole="button"
              accessibilityState={{ selected: filtroTipo === 'todos' }}
            >
              <Text style={[styles.chipText, { fontSize: fs(13) }, filtroTipo === 'todos' && styles.chipTextAtivo]}>Todos</Text>
            </TouchableOpacity>
            {TIPOS_EVENTO.map(t => {
              const ativo = filtroTipo === t;
              return (
                <TouchableOpacity
                  key={t}
                  style={[styles.chip, ativo && styles.chipAtivo]}
                  onPress={() => setFiltroTipo(t)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: ativo }}
                >
                  <View style={[styles.chipDot, { backgroundColor: TIPO_CONFIG[t].color }]} />
                  <Text style={[styles.chipText, { fontSize: fs(13) }, ativo && styles.chipTextAtivo]}>{t}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {eventosFiltrados.length === 0 ? (
            <View style={styles.listaVazia}>
              <Ionicons name="calendar-outline" size={30} color={CORES_SYMBIUS.borda2} />
              <Text style={[styles.listaVaziaText, { fontSize: fs(13) }]}>
                Nenhum evento{filtroTipo !== 'todos' ? ` do tipo ${filtroTipo}` : ''} em {MESES[mes]}.
              </Text>
            </View>
          ) : (
            <View style={styles.listaCard}>
              {eventosFiltrados.map((item: any, index: number) => (
                <View key={item.id}>
                  {index > 0 && <View style={styles.evSeparador} />}
                  {renderEventoCard({ item, index })}
                </View>
              ))}
            </View>
          )}
        </View>
        </FadeInView>
      </ScrollView>


      {/* ════════════════════════════════════════════════
          MODAL DETALHE
      ════════════════════════════════════════════════ */}
      <Modal visible={modalDetalhe} transparent animationType="slide" onRequestClose={() => setModalDetalhe(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setModalDetalhe(false)} accessibilityLabel="Fechar" />
          <View style={[styles.modalSheet, { backgroundColor: C.branco }]}>
            <View style={[styles.modalHandle, { backgroundColor: C.cinzaClaro }]} />

            {eventoDetalhe && (() => {
              const config   = TIPO_CONFIG[eventoDetalhe.tipo] || TIPO_CONFIG.Evento;
              const [a,m,d]  = eventoDetalhe.data.split('-').map(Number);
              const obj      = new Date(a, m - 1, d);
              const diaSem   = DIAS_SEMANA[obj.getDay()];
              const contagem = calcularDiasRestantes(eventoDetalhe.data);

              return (
                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={[styles.detHero, { backgroundColor: config.bg }]}>
                    <View style={[styles.detHero, { backgroundColor: modoEscuro ? C.cinzaClaro : config.bg }]}>
                      <Ionicons name={config.icon} size={26} color={CORES.branco} />
                    </View>
                    <Text style={[styles.detHeroTipo, { color: config.color, fontSize: fs(11) }]}>
                      {eventoDetalhe.tipo.toUpperCase()}
                    </Text>
                    <Text style={[styles.detHeroTitulo, { color: CORES.azulEscuro, fontSize: fs(20) }]}>
                      {eventoDetalhe.titulo}
                    </Text>
                    <View style={[styles.detContagem, { backgroundColor: contagem.cor }]}>
                      <Ionicons name="time" size={12} color={CORES.branco} />
                      <Text style={[styles.detContagemText, { fontSize: fs(11) }]}>{contagem.texto}</Text>
                    </View>
                  </View>

                  <View style={styles.detInfoRow}>
                    <View style={[styles.detInfoBox, { backgroundColor: C.fundo }]}>
                      <Ionicons name="calendar" size={14} color={config.color} />
                      <Text style={[styles.detInfoLabel, { color: C.textoSec, fontSize: fs(9) }]}>DATA</Text>
                      <Text style={[styles.detInfoValor, { color: C.azulEscuro, fontSize: fs(15) }]}>
                        {d} de {MESES[m-1]}
                      </Text>
                      <Text style={[styles.detInfoSub, { color: C.textoSec, fontSize: fs(11) }]}>
                        {diaSem}, {a}
                      </Text>
                    </View>
                    <View style={[styles.detInfoBox, { backgroundColor: C.fundo }]}>
                      <Ionicons name="people" size={14} color={config.color} />
                      <Text style={[styles.detInfoLabel, { color: C.textoSec, fontSize: fs(9) }]}>SÉRIES</Text>
                      <Text style={[styles.detInfoValor, { color: C.azulEscuro, fontSize: fs(15) }]}>
                        {(eventoDetalhe.series || []).length}
                      </Text>
                      <Text style={[styles.detInfoSub, { color: C.textoSec, fontSize: fs(11) }]}>
                        {(eventoDetalhe.series || []).join(' · ')}
                      </Text>
                    </View>
                  </View>

                  {eventoDetalhe.descricao ? (
                    <View style={[styles.detDescBox, { backgroundColor: C.fundo }]}>
                      <Text style={[styles.detDescLabel, { color: C.textoSec, fontSize: fs(9) }]}>DESCRIÇÃO</Text>
                      <Text style={[styles.detDescTexto, { color: C.azulEscuro, fontSize: fs(13) }]}>
                        {eventoDetalhe.descricao}
                      </Text>
                    </View>
                  ) : null}

                  {isAdmin && (
                    <View style={styles.detAcoesRow}>
                      <TouchableOpacity
                        style={[styles.detBtnEditar, { backgroundColor: C.fundo, borderColor: C.cinzaClaro }]}
                        onPress={() => editarEventoAdmin(eventoDetalhe)}
                      >
                        <Ionicons name="pencil" size={14} color={C.azulEscuro} />
                        <Text style={[styles.detBtnEditarText, { color: C.azulEscuro, fontSize: fs(12) }]}>
                          Editar
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.detBtnExcluir}
                        onPress={() => pedirConfirmacaoExcluirEvento(eventoDetalhe.id, eventoDetalhe.data)}
                      >
                        <Ionicons name="trash-outline" size={14} color="#e74c3c" />
                        <Text style={[styles.detBtnExcluirText, { fontSize: fs(12) }]}>Excluir</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <TouchableOpacity
                  style={[styles.btnFecharModal, { backgroundColor: modoEscuro ? C.cinzaClaro : C.fundo }]}
                    onPress={() => setModalDetalhe(false)}
                  >
                    <Text style={[styles.btnFecharModalText, { color: C.textoSec, fontSize: fs(13) }]}>
                      Fechar
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* ════════════════════════════════════════════════
          MODAL DIA
      ════════════════════════════════════════════════ */}
      <Modal visible={modalDia} transparent animationType="slide" onRequestClose={() => { setModalDia(false); cancelarEdicaoLembrete(); }}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => { setModalDia(false); cancelarEdicaoLembrete(); }} accessibilityLabel="Fechar" />
          <View style={[styles.modalSheet, { backgroundColor: C.branco }]}>
            <View style={[styles.modalHandle, { backgroundColor: C.cinzaClaro }]} />

            <View style={[styles.diaHeader, { borderBottomColor: C.cinzaClaro }]}>
              <Text style={[styles.diaSemLabel, { color: C.rosa, fontSize: fs(10) }]}>{diaSemNome}</Text>
              <Text style={[styles.diaTituloData, { color: C.azulEscuro, fontSize: fs(20) }]}>
                {diaNum} de {mesNomeDia}, {anoN}
              </Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: winH * 0.55 }}>

              {/* EVENTOS ADMIN */}
              {evsAdmDia.length > 0 && (
                <View style={styles.diaBloco}>
                  <Text style={[styles.diaBlocoTitulo, { color: C.textoSec, fontSize: fs(9) }]}>
                    AGENDA ESCOLAR
                  </Text>
                  {evsAdmDia.map(ev => (
                    <TouchableOpacity
                      key={ev.id}
                      style={[
                        styles.eventoItem,
                        { backgroundColor: C.fundo, borderLeftColor: TIPO_CONFIG[ev.tipo]?.color }
                      ]}
                      onPress={() => { setEventoDetalhe(ev); setModalDia(false); setTimeout(() => setModalDetalhe(true), 250); }}
                    >
                      <View style={styles.eventoTop}>
                        <View style={[styles.tipoBadge, { backgroundColor: TIPO_CONFIG[ev.tipo]?.bg }]}>
                          <Text style={[styles.tipoBadgeText, { color: TIPO_CONFIG[ev.tipo]?.color, fontSize: fs(9) }]}>
                            {ev.tipo}
                          </Text>
                        </View>
                        <Text
                          style={[styles.eventoTitulo, { color: C.azulEscuro, fontSize: fs(13) }]}
                          numberOfLines={1}
                        >
                          {ev.titulo}
                        </Text>
                      </View>
                      {ev.descricao ? (
                        <Text
                          style={[styles.eventoDesc, { color: C.textoSec, fontSize: fs(11) }]}
                          numberOfLines={2}
                        >
                          {ev.descricao}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* LEMBRETES */}
              <View style={styles.diaBloco}>
                <Text style={[styles.diaBlocoTitulo, { color: C.textoSec, fontSize: fs(9) }]}>
                  MEUS LEMBRETES
                </Text>
                {lembDia.length === 0 ? (
                  <Text style={[styles.diaVazio, { color: C.textoSec, fontSize: fs(12) }]}>
                    Nenhum lembrete para este dia.
                  </Text>
                ) : lembDia.map(ev => (
                  <View
                    key={ev.id}
                    style={[
                      styles.eventoItem,
                      { backgroundColor: C.fundo, borderLeftColor: TIPO_CONFIG.lembrete.color }
                    ]}
                  >
                    <View style={styles.eventoTop}>
                      <View style={[styles.tipoBadge, { backgroundColor: TIPO_CONFIG.lembrete.bg }]}>
                        <Text style={[styles.tipoBadgeText, { color: TIPO_CONFIG.lembrete.color, fontSize: fs(9) }]}>
                          Lembrete
                        </Text>
                      </View>
                      <Text
                        style={[styles.eventoTitulo, { color: C.azulEscuro, fontSize: fs(13) }]}
                        numberOfLines={1}
                      >
                        {ev.titulo}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        <TouchableOpacity
                          onPress={() => editarLembrete(ev)}
                          style={[styles.btnAcaoMini, { backgroundColor: C.branco, borderColor: C.cinzaClaro }]}
                        >
                          <Ionicons name="pencil" size={12} color={C.azulEscuro} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => pedirConfirmacaoExcluirLembrete(ev.id)}
                          style={[styles.btnAcaoMini, { backgroundColor: C.branco, borderColor: C.cinzaClaro }]}
                        >
                          <Ionicons name="trash-outline" size={12} color="#e74c3c" />
                        </TouchableOpacity>
                      </View>
                    </View>
                    {ev.descricao ? (
                      <Text
                        style={[styles.eventoDesc, { color: C.textoSec, fontSize: fs(11) }]}
                        numberOfLines={2}
                      >
                        {ev.descricao}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>

              {/* FORM LEMBRETE */}
              <View style={[
                styles.diaBloco,
                { borderTopWidth: 1, borderTopColor: C.cinzaClaro, paddingTop: 16 }
              ]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Text style={[styles.diaBlocoTitulo, { color: C.textoSec, fontSize: fs(9) }]}>
                    {lembEditandoId ? 'EDITANDO LEMBRETE' : 'ADICIONAR LEMBRETE'}
                  </Text>
                  {lembEditandoId && (
                    <TouchableOpacity onPress={cancelarEdicaoLembrete}>
                      <Text style={[styles.linkCancelar, { color: C.rosa, fontSize: fs(11) }]}>Cancelar</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <TextInput
                  style={[
                    styles.lembInput,
                    { backgroundColor: C.fundo, color: C.azulEscuro, borderColor: C.cinzaClaro, fontSize: fs(13) }
                  ]}
                  placeholder="Título do lembrete *"
                  placeholderTextColor={C.textoSec}
                  value={lembreTitulo}
                  onChangeText={setLembreTitulo}
                />
                <TextInput
                  style={[
                    styles.lembInput,
                    { height: 70, textAlignVertical: 'top', backgroundColor: C.fundo, color: C.azulEscuro, borderColor: C.cinzaClaro, fontSize: fs(13) }
                  ]}
                  placeholder="Descrição (opcional)"
                  placeholderTextColor={C.textoSec}
                  value={lembreDesc}
                  onChangeText={setLembreDesc}
                  multiline
                />
                <TouchableOpacity
                  style={[styles.btnSalvarLemb, { backgroundColor: modoEscuro ? C.amarelo : CORES.azulEscuro }]}
                  onPress={salvarLembrete}
                  disabled={salvandoLemb}
                >
                  {salvandoLemb
                    ? <ActivityIndicator color={modoEscuro ? CORES.azulEscuro : '#FFF'} size="small" />
                    : <Text style={[
                        styles.btnSalvarLembText,
                        { color: modoEscuro ? CORES.azulEscuro : CORES.branco, fontSize: fs(13) }
                      ]}>
                        {lembEditandoId ? 'Atualizar Lembrete' : 'Salvar Lembrete'}
                      </Text>
                  }
                </TouchableOpacity>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.btnFecharModal, { backgroundColor: C.fundo }]}
              onPress={() => { setModalDia(false); cancelarEdicaoLembrete(); }}
            >
              <Text style={[styles.btnFecharModalText, { color: C.textoSec, fontSize: fs(13) }]}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>


      {/* ════════════════════════════════════════════════
          MODAL ADMIN FORM (cria E edita)
      ════════════════════════════════════════════════ */}
      <Modal visible={modalAdminForm} transparent animationType="slide" onRequestClose={fecharFormAdmin}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={fecharFormAdmin} accessibilityLabel="Fechar" />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}>
            {/* espaço livre acima do quadro: tocar aqui fecha (o fundo fica atrás da rolagem) */}
            <Pressable style={{ flex: 1 }} onPress={fecharFormAdmin} accessibilityLabel="Fechar" />
            <View style={[
              styles.modalSheet,
              { paddingBottom: Platform.OS === 'ios' ? 40 : 28, backgroundColor: C.branco }
            ]}>
              <View style={[styles.modalHandle, { backgroundColor: C.cinzaClaro }]} />
              <Text style={[styles.modalTitulo, { color: C.azulEscuro, fontSize: fs(17) }]}>
                {admEditandoId ? 'Editar Evento' : 'Novo Evento Escolar'}
              </Text>
              <Text style={[styles.modalSub, { color: C.textoSec, fontSize: fs(12) }]}>
                {admEditandoId ? 'Edite as informações do evento.' : 'Será visível para os alunos das séries selecionadas'}
              </Text>

              <Text style={[styles.formLabel, { color: C.textoSec, fontSize: fs(10) }]}>TÍTULO *</Text>
              <TextInput
                style={[
                  styles.formInput,
                  { backgroundColor: C.fundo, color: C.azulEscuro, borderColor: C.cinzaClaro, fontSize: fs(13) }
                ]}
                placeholder="Ex: Prova de Matemática"
                placeholderTextColor={C.textoSec}
                value={adminTitulo}
                onChangeText={setAdminTitulo}
              />

              <Text style={[styles.formLabel, { color: C.textoSec, fontSize: fs(10) }]}>DESCRIÇÃO</Text>
              <TextInput
                style={[
                  styles.formInput,
                  { height: 72, textAlignVertical: 'top', backgroundColor: C.fundo, color: C.azulEscuro, borderColor: C.cinzaClaro, fontSize: fs(13) }
                ]}
                placeholder="Informações adicionais..."
                placeholderTextColor={C.textoSec}
                value={adminDesc}
                onChangeText={setAdminDesc}
                multiline
              />

              <View style={styles.adminRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.formLabel, { color: C.textoSec, fontSize: fs(10) }]}>DATA *</Text>
                  <TouchableOpacity
                    style={[styles.formSelect, { backgroundColor: C.fundo, borderColor: C.cinzaClaro }]}
                    onPress={() => {
                      if (adminData) {
                        const [a, m, d] = adminData.split('-').map(Number);
                        setSelAno(a); setSelMes(m); setSelDia(d);
                      } else {
                        setSelAno(ano); setSelMes(mes + 1); setSelDia(1);
                      }
                      setModalDataEvt(true);
                    }}
                  >
                    <Text style={[
                      styles.formSelectText,
                      { color: C.azulEscuro, fontSize: fs(13) },
                      !adminData && { color: C.textoSec }
                    ]}>
                      {adminData ? adminData.split('-').reverse().join('/') : 'Selecione...'}
                    </Text>
                    <Ionicons name="calendar-outline" size={14} color={C.textoSec} />
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.formLabel, { color: C.textoSec, fontSize: fs(10) }]}>TIPO *</Text>
                  <TouchableOpacity
                    style={[styles.formSelect, { backgroundColor: C.fundo, borderColor: C.cinzaClaro }]}
                    onPress={() => setModalTipoEvt(true)}
                  >
                    <Text style={[
                      styles.formSelectText,
                      { color: C.azulEscuro, fontSize: fs(13) },
                      !adminTipo && { color: C.textoSec }
                    ]}>
                      {adminTipo || 'Selecione...'}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color={C.textoSec} />
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={[styles.formLabel, { color: C.textoSec, fontSize: fs(10) }]}>SÉRIES *</Text>
              <View style={styles.seriesRow}>
                {['1º','2º','3º'].map(s => {
                  const ativo = adminSeries.includes(s);
                  return (
                    <TouchableOpacity
                      key={s}
                      style={[
                        styles.serieBadge,
                        { backgroundColor: C.fundo, borderColor: C.cinzaClaro },
                        ativo && { backgroundColor: modoEscuro ? C.amarelo : CORES.azulEscuro, borderColor: modoEscuro ? C.amarelo : CORES.azulEscuro }
                      ]}
                      onPress={() => toggleSerie(s)}
                    >
                      <Text style={[
                        styles.serieBadgeText,
                        { color: C.textoSec, fontSize: fs(12) },
                        ativo && { color: modoEscuro ? CORES.azulEscuro : CORES.branco }
                      ]}>
                        {s} Ano
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.formBtns}>
                <TouchableOpacity
                  style={[styles.formBtn, { backgroundColor: C.cinzaClaro }]}
                  onPress={() => { setModalAdminForm(false); setAdmEditandoId(null); }}
                >
                  <Text style={[styles.formBtnText, { color: C.preto, fontSize: fs(13) }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.formBtn, { backgroundColor: modoEscuro ? C.amarelo : CORES.azulEscuro }]}
                  onPress={salvarEventoAdmin}
                  disabled={salvandoAdm}
                >
                  {salvandoAdm
                    ? <ActivityIndicator color={modoEscuro ? CORES.azulEscuro : '#FFF'} size="small" />
                    : <Text style={[
                        styles.formBtnText,
                        { color: modoEscuro ? CORES.azulEscuro : CORES.branco, fontSize: fs(13) }
                      ]}>
                        {admEditandoId ? 'Salvar' : 'Publicar'}
                      </Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* MODAL TIPO EVT */}
      <Modal visible={modalTipoEvt} transparent animationType="slide" onRequestClose={() => setModalTipoEvt(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setModalTipoEvt(false)} accessibilityLabel="Fechar" />
          <View style={[styles.modalSheet, { backgroundColor: C.branco }]}>
            <View style={[styles.modalHandle, { backgroundColor: C.cinzaClaro }]} />
            <Text style={[styles.modalTitulo, { color: C.azulEscuro, fontSize: fs(17) }]}>Tipo de Evento</Text>
            {TIPOS_EVENTO.map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.seletorItem, { borderBottomColor: C.cinzaClaro }]}
                onPress={() => { setAdminTipo(t); setModalTipoEvt(false); }}
              >
                <View style={[styles.dot, { backgroundColor: TIPO_CONFIG[t]?.color, width: 10, height: 10 }]} />
                <Text style={[styles.seletorItemText, { color: C.azulEscuro, fontSize: fs(14) }]}>{t}</Text>
                {adminTipo === t && <Ionicons name="checkmark" size={18} color={C.azulEscuro} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* MODAL DATA EVT */}
      <Modal visible={modalDataEvt} transparent animationType="slide" onRequestClose={() => setModalDataEvt(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setModalDataEvt(false)} accessibilityLabel="Fechar" />
          <View style={[styles.modalSheet, { backgroundColor: C.branco }]}>
            <View style={[styles.modalHandle, { backgroundColor: C.cinzaClaro }]} />
            <Text style={[styles.modalTitulo, { color: C.azulEscuro, fontSize: fs(17) }]}>Selecionar Data</Text>

            <View style={styles.dataPickerRow}>
              <TouchableOpacity
                onPress={() => ajustarSelecao(selAno - 1, selMes, selDia)}
                style={[styles.btnNavMes, { backgroundColor: C.branco, borderColor: C.cinzaClaro }]}
              >
                <Ionicons name="chevron-back" size={14} color={C.azulEscuro} />
              </TouchableOpacity>
              <Text style={[styles.dataPickerValor, { color: C.azulEscuro, fontSize: fs(15) }]}>{selAno}</Text>
              <TouchableOpacity
                onPress={() => ajustarSelecao(selAno + 1, selMes, selDia)}
                style={[styles.btnNavMes, { backgroundColor: C.branco, borderColor: C.cinzaClaro }]}
              >
                <Ionicons name="chevron-forward" size={14} color={C.azulEscuro} />
              </TouchableOpacity>
            </View>

            <View style={styles.dataPickerRow}>
              <TouchableOpacity
                onPress={() => ajustarSelecao(selAno, selMes - 1, selDia)}
                style={[styles.btnNavMes, { backgroundColor: C.branco, borderColor: C.cinzaClaro }]}
              >
                <Ionicons name="chevron-back" size={14} color={C.azulEscuro} />
              </TouchableOpacity>
              <Text style={[styles.dataPickerValor, { color: C.azulEscuro, fontSize: fs(15) }]}>
                {MESES[selMes - 1]}
              </Text>
              <TouchableOpacity
                onPress={() => ajustarSelecao(selAno, selMes + 1, selDia)}
                style={[styles.btnNavMes, { backgroundColor: C.branco, borderColor: C.cinzaClaro }]}
              >
                <Ionicons name="chevron-forward" size={14} color={C.azulEscuro} />
              </TouchableOpacity>
            </View>

            <View style={styles.diasGrade}>
              {Array.from({ length: totalDiasSelMes }, (_, i) => i + 1).map(d => {
                const ativo = selDia === d;
                return (
                  <TouchableOpacity
                    key={d}
                    style={[
                      styles.diaPickerBtn,
                      { backgroundColor: C.fundo, borderColor: C.cinzaClaro },
                      ativo && { backgroundColor: modoEscuro ? C.amarelo : CORES.azulEscuro, borderColor: modoEscuro ? C.amarelo : CORES.azulEscuro }
                    ]}
                    onPress={() => setSelDia(d)}
                  >
                    <Text style={[
                      styles.diaPickerText,
                      { color: C.azulEscuro, fontSize: fs(12) },
                      ativo && { color: modoEscuro ? CORES.azulEscuro : CORES.branco }
                    ]}>
                      {d}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.formBtn, { backgroundColor: modoEscuro ? C.amarelo : CORES.azulEscuro, marginTop: 8 }]}
              onPress={confirmarData}
            >
              <Text style={[
                styles.formBtnText,
                { color: modoEscuro ? CORES.azulEscuro : CORES.branco, fontSize: fs(13) }
              ]}>
                Confirmar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL LEGENDA */}
      <Modal visible={modalLegenda} transparent animationType="fade" onRequestClose={() => setModalLegenda(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setModalLegenda(false)} accessibilityLabel="Fechar" />
          <View style={[styles.modalSheet, { backgroundColor: C.branco }]}>
            <View style={[styles.modalHandle, { backgroundColor: C.cinzaClaro }]} />
            <Text style={[styles.modalTitulo, { color: C.azulEscuro, fontSize: fs(17) }]}>Legenda</Text>
            {[
              { key: 'lembrete', label: 'Meu lembrete' },
              { key: 'Prova',    label: 'Prova'         },
              { key: 'Feriado',  label: 'Feriado'       },
              { key: 'Aviso',    label: 'Aviso Escolar' },
              { key: 'Evento',   label: 'Evento'        },
            ].map(item => (
              <View key={item.key} style={styles.legendaItem}>
                <View style={[styles.dot, { backgroundColor: TIPO_CONFIG[item.key]?.color, width: 10, height: 10 }]} />
                <Text style={[styles.legendaText, { color: C.azulEscuro, fontSize: fs(13) }]}>{item.label}</Text>
              </View>
            ))}
            <TouchableOpacity
              style={[styles.btnFecharModal, { backgroundColor: C.fundo }]}
              onPress={() => setModalLegenda(false)}
            >
              <Text style={[styles.btnFecharModalText, { color: C.textoSec, fontSize: fs(13) }]}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL DE CONFIRMAÇÃO */}
      <Modal visible={confirm !== null} transparent animationType="fade">
        <View style={styles.confirmOverlay}>
          <View style={[styles.confirmBox, { backgroundColor: C.branco }]}>
            <View style={styles.confirmIcon}>
              <Ionicons name="alert-circle" size={28} color="#e74c3c" />
            </View>
            <Text style={[styles.confirmTitulo, { color: C.azulEscuro, fontSize: fs(17) }]}>
              {confirm?.titulo}
            </Text>
            <Text style={[styles.confirmMsg, { color: C.textoSec, fontSize: fs(13) }]}>
              {confirm?.msg}
            </Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: C.cinzaClaro }]}
                onPress={() => setConfirm(null)}
              >
                <Text style={[styles.confirmBtnText, { color: C.preto, fontSize: fs(13) }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: '#e74c3c' }]}
                onPress={() => { confirm?.onOk(); setConfirm(null); }}
              >
                <Text style={[styles.confirmBtnText, { color: CORES.branco, fontSize: fs(13) }]}>
                  {confirm?.btn}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <SymbiusTabBar ativa="agenda" navigation={navigation} uid={uid} />
    </View>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1 },
  centro:            { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // TOAST — fixo
  toast:             { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 18, alignSelf: 'center', backgroundColor: CORES.azulEscuro, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 24, zIndex: 9999, elevation: 10 },
  toastText:         { color: CORES.branco, fontFamily: F.bold },

  // HEADER — fixo (identidade visual)
  header:            { backgroundColor: CORES_SYMBIUS.fundo, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 10, gap: 8 },
  btnVoltar:         { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start' },
  headerEyebrow:     { color: 'rgba(255,255,255,0.5)', fontFamily: F.black, letterSpacing: 1.6 },
  headerTitulo:      { color: CORES_SYMBIUS.texto, fontFamily: F.black, letterSpacing: -0.3 },
  headerTituloCentro: { position: 'absolute', left: 0, right: 0, height: 44, lineHeight: 44, textAlign: 'center' },
  btnIcone:          { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  btnAdd:            { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-end' },
  btnAddText:        { color: CORES_SYMBIUS.creme, fontFamily: F.bold },

  // NAV MÊS
  navMes:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14 },
  btnNavMes:         { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', backgroundColor: CORES_SYMBIUS.fundoCard, borderWidth: 1, borderColor: CORES_SYMBIUS.borda2 },
  navMesNome:        { fontFamily: F.black, textAlign: 'center', letterSpacing: -0.6, color: CORES_SYMBIUS.texto },
  navAno:            { textAlign: 'center', fontFamily: F.semibold, color: CORES_SYMBIUS.textoSec },

  btnHoje:           { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', minHeight: 40, marginBottom: 10, paddingHorizontal: 14 },
  btnHojeText:       { fontFamily: F.bold, color: CORES_SYMBIUS.verdeEscuro },

  // GRADE
  semanaRow:         { flexDirection: 'row', paddingBottom: 4 },
  semanaLabel:       { textAlign: 'center', fontFamily: F.semibold, color: CORES_SYMBIUS.textoSec },
  grade:             { flexDirection: 'row', flexWrap: 'wrap' },
  celula:            { alignItems: 'center', justifyContent: 'center' },
  celulaVazia:       { borderWidth: 0.5 },
  numWrap:           { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  numDia:            { fontFamily: F.semibold },
  dotsRow:           { flexDirection: 'row', justifyContent: 'center', gap: 3, height: 7, marginTop: 1 },
  dot:               { width: 5, height: 5, borderRadius: 3 },

  // SEÇÃO EVENTOS
  secaoEventos:      { marginHorizontal: 16, marginTop: 18, borderRadius: 20, padding: 16, elevation: 3, shadowColor: CORES.azulEscuro, shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  secaoHeader:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  secaoEyebrow:      { fontFamily: F.black, letterSpacing: 1.4, marginBottom: 2 },
  secaoTitulo:       { fontFamily: F.black, letterSpacing: -0.3, color: CORES_SYMBIUS.texto },
  secaoCount:        { minWidth: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 10 },
  secaoCountText:    { fontFamily: F.black },

  // CHIPS
  chipsRow:          { gap: 8, paddingRight: 16, flexDirection: 'row' },
  chip:              { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 40, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: CORES_SYMBIUS.borda2, backgroundColor: CORES_SYMBIUS.fundoCard },
  cardCal:           { alignSelf: 'center', backgroundColor: CORES_SYMBIUS.fundoCard, borderRadius: 24, borderWidth: 1, borderColor: CORES_SYMBIUS.borda2, paddingVertical: 14, paddingHorizontal: 12 },
  secao:             { marginHorizontal: 16, marginTop: 32 },
  secaoTopo:         { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 },
  secaoCont:         { fontFamily: F.medium, color: CORES_SYMBIUS.textoSec },
  chipsScroll:       { marginHorizontal: -16, paddingLeft: 16, marginBottom: 16, flexGrow: 0 },
  chipAtivo:         { backgroundColor: CORES_SYMBIUS.verdeEscuro, borderColor: CORES_SYMBIUS.verdeEscuro },
  chipTextAtivo:     { color: CORES_SYMBIUS.creme, fontFamily: F.bold },
  chipDot:           { width: 8, height: 8, borderRadius: 4 },
  listaCard:         { backgroundColor: CORES_SYMBIUS.fundoCard, borderRadius: 22, borderWidth: 1, borderColor: CORES_SYMBIUS.borda2, overflow: 'hidden' },
  evLinha:           { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 72, paddingVertical: 12, paddingRight: 16 },
  evBarra:           { width: 4, alignSelf: 'stretch', borderTopRightRadius: 3, borderBottomRightRadius: 3 },
  evData:            { width: 40, alignItems: 'center' },
  evSeparador:       { height: 1, marginLeft: 18, backgroundColor: CORES_SYMBIUS.borda },
  evQuando:          { fontFamily: F.medium, color: CORES_SYMBIUS.textoSec },
  evQuandoDestaque:  { fontFamily: F.bold, color: CORES_SYMBIUS.verdeEscuro },
  chipText:          { fontFamily: F.semibold, color: CORES_SYMBIUS.textoSec },

  // CARD
  evCard:            { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 10, borderWidth: 0.5 },
  evDataBox:         { width: 48, height: 54, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  evDataDia:         { fontFamily: F.black, lineHeight: 26 },
  evDataMes:         { fontFamily: F.semibold, color: CORES_SYMBIUS.textoSec, textTransform: 'uppercase' },
  evConteudo:        { flex: 1, gap: 3 },
  evTopo:            { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  evIconWrap:        { width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  evTipoLabel:       { fontFamily: F.black, letterSpacing: 0.6 },
  evChipMini:        { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 'auto' as any },
  evChipMiniText:    { fontFamily: F.black, letterSpacing: 0.4 },
  evTitulo:          { fontFamily: F.bold, color: CORES_SYMBIUS.texto },
  evMetaRow:         { flexDirection: 'row', alignItems: 'center', gap: 4 },
  evMeta:            { fontFamily: F.medium, color: CORES_SYMBIUS.textoSec, marginTop: 2 },

  listaVazia:        { alignItems: 'center', paddingVertical: 32, gap: 8 },
  listaVaziaText:    { fontFamily: F.medium, textAlign: 'center', color: CORES_SYMBIUS.textoSec },

  // MODAL DETALHE
  detHero:           { borderRadius: 18, padding: 22, alignItems: 'center', marginBottom: 12 },
  detHeroIcon:       { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  detHeroTipo:       { fontFamily: F.black, letterSpacing: 1.4, marginBottom: 6 },
  detHeroTitulo:     { fontFamily: F.black, textAlign: 'center', letterSpacing: -0.3, lineHeight: 26 },
  detContagem:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginTop: 12 },
  detContagemText:   { color: CORES.branco, fontFamily: F.black, letterSpacing: 0.7 },
  detInfoRow:        { flexDirection: 'row', gap: 10, marginBottom: 12 },
  detInfoBox:        { flex: 1, borderRadius: 14, padding: 12, gap: 3 },
  detInfoLabel:      { fontFamily: F.black, letterSpacing: 1.1, marginTop: 4 },
  detInfoValor:      { fontFamily: F.black },
  detInfoSub:        { fontFamily: F.semibold },
  detDescBox:        { borderRadius: 14, padding: 12, marginBottom: 12 },
  detDescLabel:      { fontFamily: F.black, letterSpacing: 1.1, marginBottom: 5 },
  detDescTexto:      { lineHeight: 19, fontFamily: F.regular },
  detAcoesRow:       { flexDirection: 'row', gap: 8, marginBottom: 8 },
  detBtnEditar:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 12, borderWidth: 1 },
  detBtnEditarText:  { fontFamily: F.bold },
  detBtnExcluir:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 12, backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: '#FDECEA' },
  detBtnExcluirText: { color: '#e74c3c', fontFamily: F.bold },

  // MODAIS GERAL
  modalOverlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet:        { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 32, maxHeight: '92%' },
  modalHandle:       { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitulo:       { fontFamily: F.black, marginBottom: 4, letterSpacing: -0.3 },
  modalSub:          { marginBottom: 14, fontFamily: F.regular },

  // MODAL DIA
  diaHeader:         { marginBottom: 14, paddingBottom: 14, borderBottomWidth: 1 },
  diaSemLabel:       { fontFamily: F.black, letterSpacing: 1.4, textTransform: 'uppercase' },
  diaTituloData:     { fontFamily: F.black, letterSpacing: -0.4 },
  diaBloco:          { marginBottom: 14 },
  diaBlocoTitulo:    { fontFamily: F.black, letterSpacing: 1.2, marginBottom: 8, textTransform: 'uppercase' },
  diaVazio:          { fontFamily: F.medium, fontStyle: 'italic' },
  eventoItem:        { borderLeftWidth: 3, paddingLeft: 10, paddingVertical: 8, paddingRight: 8, marginBottom: 6, borderRadius: 8 },
  eventoTop:         { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  eventoTitulo:      { fontFamily: F.bold, flex: 1 },
  eventoDesc:        { lineHeight: 16, fontFamily: F.regular },
  btnAcaoMini:       { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 0.5 },
  linkCancelar:      { fontFamily: F.bold },

  tipoBadge:         { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  tipoBadgeText:     { fontFamily: F.black, letterSpacing: 0.4 },

  lembInput:         { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, marginBottom: 8, fontFamily: F.regular },
  btnSalvarLemb:     { borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  btnSalvarLembText: { fontFamily: F.black },

  // FORM ADMIN
  formLabel:         { fontFamily: F.black, letterSpacing: 0.8, marginBottom: 6, marginTop: 12 },
  formInput:         { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, fontFamily: F.regular },
  formSelect:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1 },
  formSelectText:    { fontFamily: F.bold },
  adminRow:          { flexDirection: 'row', gap: 10 },
  seriesRow:         { flexDirection: 'row', gap: 10, marginTop: 4 },
  serieBadge:        { flex: 1, paddingVertical: 11, borderRadius: 12, borderWidth: 1.5, alignItems: 'center' },
  serieBadgeText:    { fontFamily: F.black },
  formBtns:          { flexDirection: 'row', gap: 10, marginTop: 18 },
  formBtn:           { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  formBtnText:       { fontFamily: F.black },

  // SELETOR DATA
  dataPickerRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  dataPickerValor:   { fontFamily: F.black, flex: 1, textAlign: 'center' },
  diasGrade:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', paddingVertical: 12 },
  diaPickerBtn:      { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  diaPickerText:     { fontFamily: F.bold },

  seletorItem:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1 },
  seletorItemText:   { flex: 1, fontFamily: F.bold },

  legendaItem:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  legendaText:       { fontFamily: F.semibold },

  btnFecharModal:    { borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 10 },
  btnFecharModalText:{ fontFamily: F.bold },

  // MODAL CONFIRMAÇÃO
  confirmOverlay:    { flex: 1, backgroundColor: 'rgba(11, 32, 70, 0.65)', justifyContent: 'center', alignItems: 'center', padding: 28 },
  confirmBox:        { width: '100%', maxWidth: 320, borderRadius: 22, padding: 24, alignItems: 'center', elevation: 12, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20 },
  confirmIcon:       { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFF5F5', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  confirmTitulo:     { fontFamily: F.black, marginBottom: 6, textAlign: 'center' },
  confirmMsg:        { fontFamily: F.regular, textAlign: 'center', lineHeight: 19, marginBottom: 18 },
  confirmBtns:       { flexDirection: 'row', gap: 8, width: '100%' },
  confirmBtn:        { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  confirmBtnText:    { fontFamily: F.black },
});