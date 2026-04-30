import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  SafeAreaView, StatusBar, Modal, TextInput,
  ActivityIndicator, Platform, FlatList,
  useWindowDimensions, Animated
} from 'react-native';
import { db } from '../config/firebaseConfig';
import {
  collection, query, where, getDocs, addDoc, updateDoc,
  deleteDoc, doc, setDoc, getDoc, serverTimestamp
} from 'firebase/firestore';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ── Fonte Poppins (igual Index) ──
const F = {
  regular:  'Poppins_400Regular',
  medium:   'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold:     'Poppins_700Bold',
  black:    'Poppins_800ExtraBold',
};

// ── Paleta alinhada com Index ──
const CORES = {
  azulEscuro:      '#0B2046',
  azulMedio:       '#1B3868',
  rosa:            '#E51C6A',
  amarelo:         '#FFC82C',
  fundo:           '#F5F7FA',
  branco:          '#FFFFFF',
  cinzaClaro:      '#EAEFF4',
  textoSec:        '#8D99AE',
  preto:           '#1A1A2E',
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
  lembrete: { color: '#2c3e50', bg: '#EBF0F5', icon: 'bookmark'      },
  Prova:    { color: '#e74c3c', bg: '#FDECEA', icon: 'document-text' },
  Feriado:  { color: '#27ae60', bg: '#E8F8EE', icon: 'sunny'         },
  Aviso:    { color: '#e67e22', bg: '#FEF3E7', icon: 'megaphone'     },
  Evento:   { color: '#8e44ad', bg: '#F3E8FA', icon: 'sparkles'      },
};

const TIPO_COLLECTION: Record<string, { sub: string; prefix: string }> = {
  Prova:   { sub: 'provas',   prefix: 'prv' },
  Feriado: { sub: 'feriados', prefix: 'fer' },
  Aviso:   { sub: 'avisos',   prefix: 'avs' },
  Evento:  { sub: 'eventos',  prefix: 'evt' },
};

// Path completo: eventos_admin/tipos/{sub}/{id}
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
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const CEL_SIZE = Math.floor((winW - 32) / 7);

  const uid     = route?.params?.uid;

  const [userRA, setUserRA] = useState<string | null>(null);

// Fetch do RA do usuário ao montar
useEffect(() => {
  const buscarRA = async () => {
  if (!uid) return;
  try {
    const snap = await getDoc(doc(db, 'usuarios', uid));
    if (snap.exists()) {
      const dados = snap.data();
      // ✅ Limpa RA inválido (admin com "N/A", barras, etc)
      const raLimpo = dados.ra?.replace(/[\/\\]/g, '');
      const raValido = raLimpo && raLimpo !== 'N/A' && raLimpo.length > 0;
      setUserRA(raValido ? raLimpo : uid);
    }
  } catch (e) { console.error('Erro buscar RA:', e); }
};
  buscarRA();
}, [uid]);

  const tipo    = route?.params?.tipo;
  const turma   = route?.params?.turma;
  const isAdmin = tipo?.toLowerCase() === 'administrador';
  const serie   = extrairSerie(turma || '');

  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());

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

  // ✅ Modal de confirmação customizado (substitui Alert.alert)
  const [confirm, setConfirm] = useState<{
    titulo: string; msg: string; btn: string; onOk: () => void
  } | null>(null);

  // ✅ Toast de feedback
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
  // ✅ Edição de lembrete pessoal
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
  // ✅ Edição de evento admin
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
      
      // Path: eventos_admin/tipos/{eventos|avisos|provas|feriados}
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
          _sub: config.sub,  // ← guarda de qual subcollection veio
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

  // ✅ Filtro: mês selecionado + tipo
  const eventosFiltrados = useMemo(() => {
    const doMes = adminTodos.filter(ev => {
      const [a, m] = ev.data.split('-').map(Number);
      return a === ano && m === mes + 1;
    });
    if (filtroTipo === 'todos') return doMes;
    return doMes.filter(ev => ev.tipo === filtroTipo);
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
      // ✅ Edição
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

  // ✅ Excluir com modal customizado
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

    // ✅ Pega a collection correta baseada no tipo
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
      // ✅ PRIMEIRO garante que o doc pai 'tipos' existe
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

  const renderCelula = (dia: number | null, idx: number) => {
    if (!dia) return (
      <View
        key={`v${idx}`}
        style={[styles.celulaVazia, { width: CEL_SIZE, height: CEL_SIZE * 0.95 }]}
      />
    );

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
        style={[
          styles.celula,
          { width: CEL_SIZE, height: CEL_SIZE * 0.95 },
          eFimSem && styles.celulaFimSem,
          (temLemb || temAdmin) && styles.celulaComEvento,
        ]}
        onPress={() => { setDiaSelecionado(dataStr); setModalDia(true); }}
        activeOpacity={0.7}
      >
        <View style={[styles.numWrap, eHoje && styles.numHoje]}>
          <Text style={[
            styles.numDia,
            eFimSem && { color: CORES.textoSec },
            eHoje && { color: CORES.branco }
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

  const confirmarData = () => {
    setAdminData(formatarDataStr(selAno, selMes, selDia));
    setModalDataEvt(false);
  };

  // ── Card de evento (com fade in) ──
  const renderEventoCard = ({ item, index }: any) => {
    const config   = TIPO_CONFIG[item.tipo] || TIPO_CONFIG.Evento;
    const [, m, d] = item.data.split('-').map(Number);
    const contagem = calcularDiasRestantes(item.data);

    return (
      <FadeInView delay={index * 60}>
        <TouchableOpacity
          style={styles.evCard}
          onPress={() => { setEventoDetalhe(item); setModalDetalhe(true); }}
          activeOpacity={0.85}
        >
          <View style={[styles.evDataBox, { backgroundColor: config.bg }]}>
            <Text style={[styles.evDataDia, { color: config.color }]}>{d}</Text>
            <Text style={[styles.evDataMes, { color: config.color }]}>{MESES_ABREV[m - 1]}</Text>
          </View>

          <View style={styles.evConteudo}>
            <View style={styles.evTopo}>
              <View style={[styles.evIconWrap, { backgroundColor: config.bg }]}>
                <Ionicons name={config.icon} size={11} color={config.color} />
              </View>
              <Text style={[styles.evTipoLabel, { color: config.color }]}>
                {item.tipo.toUpperCase()}
              </Text>
              <View style={[styles.evChipMini, { backgroundColor: contagem.cor + '18' }]}>
                <Text style={[styles.evChipMiniText, { color: contagem.cor }]}>
                  {contagem.texto}
                </Text>
              </View>
            </View>

            <Text style={styles.evTitulo} numberOfLines={1}>{item.titulo}</Text>

            <View style={styles.evMetaRow}>
              <Ionicons name="people-outline" size={10} color={CORES.textoSec} />
              <Text style={styles.evMeta}>{(item.series || []).join(' · ')}</Text>
            </View>
          </View>

          <Ionicons name="chevron-forward" size={16} color={CORES.cinzaClaro} />
        </TouchableOpacity>
      </FadeInView>
    );
  };

  if (loading) return (
    <View style={styles.centro}>
      <ActivityIndicator size="large" color={CORES.azulEscuro} />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={CORES.azulEscuro} />

      {/* TOAST */}
      {toast !== '' && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      {/* HEADER */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.btnVoltar}>
          <Ionicons name="arrow-back" size={20} color={CORES.branco} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerEyebrow}>AGENDA ESCOLAR</Text>
          <Text style={styles.headerTitulo}>Calendário</Text>
        </View>
        <TouchableOpacity onPress={() => setModalLegenda(true)} style={styles.btnIcone}>
          <Ionicons name="information-circle-outline" size={22} color={CORES.branco} />
        </TouchableOpacity>
        {isAdmin && (
          <TouchableOpacity onPress={abrirFormNovoEvento} style={styles.btnAdd}>
            <Ionicons name="add" size={18} color={CORES.branco} />
            <Text style={styles.btnAddText}>Evento</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* NAV MÊS */}
        <View style={styles.navMes}>
          <TouchableOpacity
            style={styles.btnNavMes}
            onPress={() => { if (mes === 0) { setMes(11); setAno(a => a - 1); } else setMes(m => m - 1); }}
          >
            <Ionicons name="chevron-back" size={16} color={CORES.azulEscuro} />
          </TouchableOpacity>

          <View style={{ alignItems: 'center' }}>
            <Text style={styles.navMesNome}>{MESES[mes]}</Text>
            <Text style={styles.navAno}>{ano}</Text>
          </View>

          <TouchableOpacity
            style={styles.btnNavMes}
            onPress={() => { if (mes === 11) { setMes(0); setAno(a => a + 1); } else setMes(m => m + 1); }}
          >
            <Ionicons name="chevron-forward" size={16} color={CORES.azulEscuro} />
          </TouchableOpacity>
        </View>

        {/* BOTÃO IR PRA HOJE — só aparece se não está no mês atual */}
        {!noMesAtual && (
          <TouchableOpacity
            style={styles.btnHoje}
            onPress={() => { setMes(hoje.getMonth()); setAno(hoje.getFullYear()); }}
          >
            <Ionicons name="locate" size={12} color={CORES.azulEscuro} />
            <Text style={styles.btnHojeText}>Ir para hoje</Text>
          </TouchableOpacity>
        )}

        {/* DIAS DA SEMANA */}
        <View style={styles.semanaRow}>
          {DIAS_SEMANA.map(d => (
            <Text key={d} style={[styles.semanaLabel, { width: CEL_SIZE }]}>{d}</Text>
          ))}
        </View>

        {/* GRADE */}
        <View style={styles.grade}>
          {celulas.map((dia, idx) => renderCelula(dia, idx))}
        </View>

        {/* SEÇÃO EVENTOS */}
        <View style={styles.secaoEventos}>
          <View style={styles.secaoHeader}>
            <View>
              <Text style={styles.secaoEyebrow}>{MESES[mes].toUpperCase()} · {ano}</Text>
              <Text style={styles.secaoTitulo}>
                {isAdmin ? 'Eventos cadastrados' : 'Eventos da sua turma'}
              </Text>
            </View>
            <View style={styles.secaoCount}>
              <Text style={styles.secaoCountText}>{eventosFiltrados.length}</Text>
            </View>
          </View>

          {/* CHIPS DE FILTRO */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            <TouchableOpacity
              style={[styles.chip, filtroTipo === 'todos' && styles.chipAtivo]}
              onPress={() => setFiltroTipo('todos')}
            >
              <Text style={[styles.chipText, filtroTipo === 'todos' && styles.chipTextAtivo]}>
                Todos
              </Text>
            </TouchableOpacity>
            {TIPOS_EVENTO.map(t => {
              const config = TIPO_CONFIG[t];
              const ativo = filtroTipo === t;
              return (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.chip,
                    ativo && { backgroundColor: config.color, borderColor: config.color }
                  ]}
                  onPress={() => setFiltroTipo(t)}
                >
                  <Ionicons
                    name={config.icon}
                    size={11}
                    color={ativo ? CORES.branco : config.color}
                  />
                  <Text style={[
                    styles.chipText,
                    ativo && styles.chipTextAtivo,
                    !ativo && { color: config.color }
                  ]}>
                    {t}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* LISTA com scroll interno */}
          {eventosFiltrados.length === 0 ? (
            //<View style={[styles.header, { paddingTop: insets.top }]}>
            <View style={[styles.listaVazia, { paddingTop: insets.top}]}>
              <Ionicons name="calendar-outline" size={32} color={CORES.cinzaClaro} />
              <Text style={styles.listaVaziaText}>
                Nenhum evento{filtroTipo !== 'todos' ? ` do tipo ${filtroTipo}` : ''} em {MESES[mes]}.
              </Text>
            </View>
          ) : (
            <FlatList
              data={eventosFiltrados}
              keyExtractor={item => item.id}
              renderItem={renderEventoCard}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
              scrollEnabled={eventosFiltrados.length > 3}
              style={{ maxHeight: Math.max(220, winH * 0.32) }}
              contentContainerStyle={{ paddingTop: 4, paddingBottom: 4 }}
            />
          )}
        </View>
      </ScrollView>

      {/* ════════════════════════════════════════════════
          MODAL DETALHE
      ════════════════════════════════════════════════ */}
      <Modal visible={modalDetalhe} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            {eventoDetalhe && (() => {
              const config   = TIPO_CONFIG[eventoDetalhe.tipo] || TIPO_CONFIG.Evento;
              const [a,m,d]  = eventoDetalhe.data.split('-').map(Number);
              const obj      = new Date(a, m - 1, d);
              const diaSem   = DIAS_SEMANA[obj.getDay()];
              const contagem = calcularDiasRestantes(eventoDetalhe.data);

              return (
                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={[styles.detHero, { backgroundColor: config.bg }]}>
                    <View style={[styles.detHeroIcon, { backgroundColor: config.color }]}>
                      <Ionicons name={config.icon} size={26} color={CORES.branco} />
                    </View>
                    <Text style={[styles.detHeroTipo, { color: config.color }]}>
                      {eventoDetalhe.tipo.toUpperCase()}
                    </Text>
                    <Text style={styles.detHeroTitulo}>{eventoDetalhe.titulo}</Text>
                    <View style={[styles.detContagem, { backgroundColor: contagem.cor }]}>
                      <Ionicons name="time" size={12} color={CORES.branco} />
                      <Text style={styles.detContagemText}>{contagem.texto}</Text>
                    </View>
                  </View>

                  <View style={styles.detInfoRow}>
                    <View style={styles.detInfoBox}>
                      <Ionicons name="calendar" size={14} color={config.color} />
                      <Text style={styles.detInfoLabel}>DATA</Text>
                      <Text style={styles.detInfoValor}>{d} de {MESES[m-1]}</Text>
                      <Text style={styles.detInfoSub}>{diaSem}, {a}</Text>
                    </View>
                    <View style={styles.detInfoBox}>
                      <Ionicons name="people" size={14} color={config.color} />
                      <Text style={styles.detInfoLabel}>SÉRIES</Text>
                      <Text style={styles.detInfoValor}>{(eventoDetalhe.series || []).length}</Text>
                      <Text style={styles.detInfoSub}>{(eventoDetalhe.series || []).join(' · ')}</Text>
                    </View>
                  </View>

                  {eventoDetalhe.descricao ? (
                    <View style={styles.detDescBox}>
                      <Text style={styles.detDescLabel}>DESCRIÇÃO</Text>
                      <Text style={styles.detDescTexto}>{eventoDetalhe.descricao}</Text>
                    </View>
                  ) : null}

                  {/* ✅ Ações Admin: editar + excluir */}
                  {isAdmin && (
                    <View style={styles.detAcoesRow}>
                      <TouchableOpacity
                        style={styles.detBtnEditar}
                        onPress={() => editarEventoAdmin(eventoDetalhe)}
                      >
                        <Ionicons name="pencil" size={14} color={CORES.azulEscuro} />
                        <Text style={styles.detBtnEditarText}>Editar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.detBtnExcluir}
                        onPress={() => pedirConfirmacaoExcluirEvento(eventoDetalhe.id, eventoDetalhe.data)}
                      >
                        <Ionicons name="trash-outline" size={14} color="#e74c3c" />
                        <Text style={styles.detBtnExcluirText}>Excluir</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.btnFecharModal}
                    onPress={() => setModalDetalhe(false)}
                  >
                    <Text style={styles.btnFecharModalText}>Fechar</Text>
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
      <Modal visible={modalDia} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            <View style={styles.diaHeader}>
              <Text style={styles.diaSemLabel}>{diaSemNome}</Text>
              <Text style={styles.diaTituloData}>{diaNum} de {mesNomeDia}, {anoN}</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: winH * 0.55 }}>

              {/* EVENTOS ADMIN */}
              {evsAdmDia.length > 0 && (
                <View style={styles.diaBloco}>
                  <Text style={styles.diaBlocoTitulo}>AGENDA ESCOLAR</Text>
                  {evsAdmDia.map(ev => (
                    <TouchableOpacity
                      key={ev.id}
                      style={[styles.eventoItem, { borderLeftColor: TIPO_CONFIG[ev.tipo]?.color }]}
                      onPress={() => { setEventoDetalhe(ev); setModalDia(false); setTimeout(() => setModalDetalhe(true), 250); }}
                    >
                      <View style={styles.eventoTop}>
                        <View style={[styles.tipoBadge, { backgroundColor: TIPO_CONFIG[ev.tipo]?.bg }]}>
                          <Text style={[styles.tipoBadgeText, { color: TIPO_CONFIG[ev.tipo]?.color }]}>
                            {ev.tipo}
                          </Text>
                        </View>
                        <Text style={styles.eventoTitulo} numberOfLines={1}>{ev.titulo}</Text>
                      </View>
                      {ev.descricao ? <Text style={styles.eventoDesc} numberOfLines={2}>{ev.descricao}</Text> : null}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* LEMBRETES */}
              <View style={styles.diaBloco}>
                <Text style={styles.diaBlocoTitulo}>MEUS LEMBRETES</Text>
                {lembDia.length === 0 ? (
                  <Text style={styles.diaVazio}>Nenhum lembrete para este dia.</Text>
                ) : lembDia.map(ev => (
                  <View key={ev.id} style={[styles.eventoItem, { borderLeftColor: TIPO_CONFIG.lembrete.color }]}>
                    <View style={styles.eventoTop}>
                      <View style={[styles.tipoBadge, { backgroundColor: TIPO_CONFIG.lembrete.bg }]}>
                        <Text style={[styles.tipoBadgeText, { color: TIPO_CONFIG.lembrete.color }]}>Lembrete</Text>
                      </View>
                      <Text style={styles.eventoTitulo} numberOfLines={1}>{ev.titulo}</Text>
                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        {/* ✅ Botão editar */}
                        <TouchableOpacity onPress={() => editarLembrete(ev)} style={styles.btnAcaoMini}>
                          <Ionicons name="pencil" size={12} color={CORES.azulEscuro} />
                        </TouchableOpacity>
                        {/* ✅ Botão excluir */}
                        <TouchableOpacity onPress={() => pedirConfirmacaoExcluirLembrete(ev.id)} style={styles.btnAcaoMini}>
                          <Ionicons name="trash-outline" size={12} color="#e74c3c" />
                        </TouchableOpacity>
                      </View>
                    </View>
                    {ev.descricao ? <Text style={styles.eventoDesc} numberOfLines={2}>{ev.descricao}</Text> : null}
                  </View>
                ))}
              </View>

              {/* FORM LEMBRETE (criar OU editar) */}
              <View style={[styles.diaBloco, { borderTopWidth: 1, borderTopColor: CORES.cinzaClaro, paddingTop: 16 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Text style={styles.diaBlocoTitulo}>
                    {lembEditandoId ? 'EDITANDO LEMBRETE' : 'ADICIONAR LEMBRETE'}
                  </Text>
                  {lembEditandoId && (
                    <TouchableOpacity onPress={cancelarEdicaoLembrete}>
                      <Text style={styles.linkCancelar}>Cancelar</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <TextInput
                  style={styles.lembInput}
                  placeholder="Título do lembrete *"
                  placeholderTextColor={CORES.textoSec}
                  value={lembreTitulo}
                  onChangeText={setLembreTitulo}
                />
                <TextInput
                  style={[styles.lembInput, { height: 70, textAlignVertical: 'top' }]}
                  placeholder="Descrição (opcional)"
                  placeholderTextColor={CORES.textoSec}
                  value={lembreDesc}
                  onChangeText={setLembreDesc}
                  multiline
                />
                <TouchableOpacity style={styles.btnSalvarLemb} onPress={salvarLembrete} disabled={salvandoLemb}>
                  {salvandoLemb
                    ? <ActivityIndicator color="#FFF" size="small" />
                    : <Text style={styles.btnSalvarLembText}>
                        {lembEditandoId ? 'Atualizar Lembrete' : 'Salvar Lembrete'}
                      </Text>
                  }
                </TouchableOpacity>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.btnFecharModal}
              onPress={() => { setModalDia(false); cancelarEdicaoLembrete(); }}
            >
              <Text style={styles.btnFecharModalText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ════════════════════════════════════════════════
          MODAL ADMIN FORM (cria E edita)
      ════════════════════════════════════════════════ */}
      <Modal visible={modalAdminForm} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}>
            <View style={[styles.modalSheet, { paddingBottom: Platform.OS === 'ios' ? 40 : 28 }]}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitulo}>
                {admEditandoId ? 'Editar Evento' : 'Novo Evento Escolar'}
              </Text>
              <Text style={styles.modalSub}>
                {admEditandoId ? 'Edite as informações do evento.' : 'Será visível para os alunos das séries selecionadas'}
              </Text>

              <Text style={styles.formLabel}>TÍTULO *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ex: Prova de Matemática"
                placeholderTextColor={CORES.textoSec}
                value={adminTitulo}
                onChangeText={setAdminTitulo}
              />

              <Text style={styles.formLabel}>DESCRIÇÃO</Text>
              <TextInput
                style={[styles.formInput, { height: 72, textAlignVertical: 'top' }]}
                placeholder="Informações adicionais..."
                placeholderTextColor={CORES.textoSec}
                value={adminDesc}
                onChangeText={setAdminDesc}
                multiline
              />

              <View style={styles.adminRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>DATA *</Text>
                  <TouchableOpacity
                    style={styles.formSelect}
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
                    <Text style={[styles.formSelectText, !adminData && { color: CORES.textoSec }]}>
                      {adminData ? adminData.split('-').reverse().join('/') : 'Selecione...'}
                    </Text>
                    <Ionicons name="calendar-outline" size={14} color={CORES.textoSec} />
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>TIPO *</Text>
                  <TouchableOpacity style={styles.formSelect} onPress={() => setModalTipoEvt(true)}>
                    <Text style={[styles.formSelectText, !adminTipo && { color: CORES.textoSec }]}>
                      {adminTipo || 'Selecione...'}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color={CORES.textoSec} />
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.formLabel}>SÉRIES *</Text>
              <View style={styles.seriesRow}>
                {['1º','2º','3º'].map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.serieBadge, adminSeries.includes(s) && styles.serieBadgeAtivo]}
                    onPress={() => toggleSerie(s)}
                  >
                    <Text style={[styles.serieBadgeText, adminSeries.includes(s) && { color: CORES.branco }]}>
                      {s} Ano
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.formBtns}>
                <TouchableOpacity
                  style={[styles.formBtn, { backgroundColor: CORES.cinzaClaro }]}
                  onPress={() => { setModalAdminForm(false); setAdmEditandoId(null); }}
                >
                  <Text style={[styles.formBtnText, { color: CORES.preto }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.formBtn, { backgroundColor: CORES.azulEscuro }]}
                  onPress={salvarEventoAdmin}
                  disabled={salvandoAdm}
                >
                  {salvandoAdm
                    ? <ActivityIndicator color="#FFF" size="small" />
                    : <Text style={[styles.formBtnText, { color: CORES.branco }]}>
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
      <Modal visible={modalTipoEvt} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitulo}>Tipo de Evento</Text>
            {TIPOS_EVENTO.map(t => (
              <TouchableOpacity
                key={t}
                style={styles.seletorItem}
                onPress={() => { setAdminTipo(t); setModalTipoEvt(false); }}
              >
                <View style={[styles.dot, { backgroundColor: TIPO_CONFIG[t]?.color, width: 10, height: 10 }]} />
                <Text style={styles.seletorItemText}>{t}</Text>
                {adminTipo === t && <Ionicons name="checkmark" size={18} color={CORES.azulEscuro} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* MODAL DATA EVT */}
      <Modal visible={modalDataEvt} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitulo}>Selecionar Data</Text>

            <View style={styles.dataPickerRow}>
              <TouchableOpacity onPress={() => setSelAno(a => a - 1)} style={styles.btnNavMes}>
                <Ionicons name="chevron-back" size={14} color={CORES.azulEscuro} />
              </TouchableOpacity>
              <Text style={styles.dataPickerValor}>{selAno}</Text>
              <TouchableOpacity onPress={() => setSelAno(a => a + 1)} style={styles.btnNavMes}>
                <Ionicons name="chevron-forward" size={14} color={CORES.azulEscuro} />
              </TouchableOpacity>
            </View>

            <View style={styles.dataPickerRow}>
              <TouchableOpacity onPress={() => setSelMes(m => m === 1 ? 12 : m - 1)} style={styles.btnNavMes}>
                <Ionicons name="chevron-back" size={14} color={CORES.azulEscuro} />
              </TouchableOpacity>
              <Text style={styles.dataPickerValor}>{MESES[selMes - 1]}</Text>
              <TouchableOpacity onPress={() => setSelMes(m => m === 12 ? 1 : m + 1)} style={styles.btnNavMes}>
                <Ionicons name="chevron-forward" size={14} color={CORES.azulEscuro} />
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 12 }}>
              {Array.from({ length: totalDiasSelMes }, (_, i) => i + 1).map(d => (
                <TouchableOpacity
                  key={d}
                  style={[styles.diaPickerBtn, selDia === d && styles.diaPickerBtnAtivo]}
                  onPress={() => setSelDia(d)}
                >
                  <Text style={[styles.diaPickerText, selDia === d && { color: CORES.branco }]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={[styles.formBtn, { backgroundColor: CORES.azulEscuro, marginTop: 8 }]} onPress={confirmarData}>
              <Text style={[styles.formBtnText, { color: CORES.branco }]}>Confirmar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL LEGENDA */}
      <Modal visible={modalLegenda} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitulo}>Legenda</Text>
            {[
              { key: 'lembrete', label: 'Meu lembrete' },
              { key: 'Prova',    label: 'Prova'         },
              { key: 'Feriado',  label: 'Feriado'       },
              { key: 'Aviso',    label: 'Aviso Escolar' },
              { key: 'Evento',   label: 'Evento'        },
            ].map(item => (
              <View key={item.key} style={styles.legendaItem}>
                <View style={[styles.dot, { backgroundColor: TIPO_CONFIG[item.key]?.color, width: 10, height: 10 }]} />
                <Text style={styles.legendaText}>{item.label}</Text>
              </View>
            ))}
            <TouchableOpacity style={styles.btnFecharModal} onPress={() => setModalLegenda(false)}>
              <Text style={styles.btnFecharModalText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ✅ MODAL DE CONFIRMAÇÃO (substitui Alert.alert) */}
      <Modal visible={confirm !== null} transparent animationType="fade">
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <View style={styles.confirmIcon}>
              <Ionicons name="alert-circle" size={28} color="#e74c3c" />
            </View>
            <Text style={styles.confirmTitulo}>{confirm?.titulo}</Text>
            <Text style={styles.confirmMsg}>{confirm?.msg}</Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: CORES.cinzaClaro }]}
                onPress={() => setConfirm(null)}
              >
                <Text style={[styles.confirmBtnText, { color: CORES.preto }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: '#e74c3c' }]}
                onPress={() => { confirm?.onOk(); setConfirm(null); }}
              >
                <Text style={[styles.confirmBtnText, { color: CORES.branco }]}>{confirm?.btn}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: CORES.fundo },
  centro:            { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: CORES.fundo },

  // TOAST
  toast:             { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 18, alignSelf: 'center', backgroundColor: CORES.azulEscuro, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 24, zIndex: 9999, elevation: 10 },
  toastText:         { color: CORES.branco, fontFamily: F.bold, fontSize: 13 },

  // HEADER
  header:            { backgroundColor: CORES.azulEscuro, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14, gap: 10 },
  btnVoltar:         { padding: 4 },
  headerEyebrow:     { color: 'rgba(255,255,255,0.5)', fontSize: 9, fontFamily: F.black, letterSpacing: 1.6 },
  headerTitulo:      { color: CORES.branco, fontSize: 18, fontFamily: F.black, letterSpacing: -0.4 },
  btnIcone:          { padding: 4 },
  btnAdd:            { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: CORES.rosa, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10 },
  btnAddText:        { color: CORES.branco, fontFamily: F.bold, fontSize: 12 },

  // NAV MÊS
  navMes:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14, backgroundColor: CORES.branco, borderBottomWidth: 1, borderBottomColor: CORES.cinzaClaro },
  btnNavMes:         { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: CORES.cinzaClaro, backgroundColor: CORES.branco },
  navMesNome:        { fontSize: 16, fontFamily: F.black, color: CORES.azulEscuro, textAlign: 'center', letterSpacing: -0.3 },
  navAno:            { fontSize: 11, color: CORES.textoSec, textAlign: 'center', fontFamily: F.semibold },

  btnHoje:           { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'center', marginVertical: 8, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 18, borderWidth: 1, borderColor: CORES.cinzaClaro, backgroundColor: CORES.branco },
  btnHojeText:       { fontSize: 11, fontFamily: F.bold, color: CORES.azulEscuro },

  // GRADE
  semanaRow:         { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 6, backgroundColor: CORES.branco, borderTopWidth: 1, borderTopColor: CORES.cinzaClaro },
  semanaLabel:       { textAlign: 'center', fontSize: 10, fontFamily: F.black, color: CORES.textoSec, letterSpacing: 0.6 },
  grade:             { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingTop: 4, backgroundColor: CORES.branco, borderBottomWidth: 1, borderBottomColor: CORES.cinzaClaro },
  celula:            { borderWidth: 0.5, borderColor: CORES.cinzaClaro, padding: 4, backgroundColor: CORES.branco },
  celulaVazia:       { backgroundColor: '#FBFBFD', borderWidth: 0.5, borderColor: CORES.cinzaClaro },
  celulaFimSem:      { backgroundColor: '#FAFAF8' },
  celulaComEvento:   { backgroundColor: '#FAFFF9' },
  numWrap:           { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  numHoje:           { backgroundColor: CORES.azulEscuro },
  numDia:            { fontSize: 11, fontFamily: F.bold, color: CORES.azulEscuro },
  dotsRow:           { flexDirection: 'row', flexWrap: 'wrap', gap: 2, marginTop: 2 },
  dot:               { width: 5, height: 5, borderRadius: 3 },

  // SEÇÃO EVENTOS
  secaoEventos:      { marginHorizontal: 16, marginTop: 18, backgroundColor: CORES.branco, borderRadius: 20, padding: 16, elevation: 3, shadowColor: CORES.azulEscuro, shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  secaoHeader:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  secaoEyebrow:      { fontSize: 9, fontFamily: F.black, color: CORES.rosa, letterSpacing: 1.4, marginBottom: 2 },
  secaoTitulo:       { fontSize: 17, fontFamily: F.black, color: CORES.azulEscuro, letterSpacing: -0.3 },
  secaoCount:        { backgroundColor: CORES.azulEscuro, minWidth: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 10 },
  secaoCountText:    { color: CORES.branco, fontSize: 12, fontFamily: F.black },

  // CHIPS
  chipsRow:          { gap: 8, paddingVertical: 8, paddingHorizontal: 2, flexDirection: 'row' },
  chip:              { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: CORES.fundo, borderWidth: 1, borderColor: CORES.cinzaClaro },
  chipAtivo:         { backgroundColor: CORES.azulEscuro, borderColor: CORES.azulEscuro },
  chipText:          { fontSize: 11, fontFamily: F.bold, color: CORES.textoSec },
  chipTextAtivo:     { color: CORES.branco },

  // CARD MÉDIO
  evCard:            { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: CORES.branco, borderRadius: 14, padding: 10, borderWidth: 0.5, borderColor: CORES.cinzaClaro },
  evDataBox:         { width: 48, height: 54, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  evDataDia:         { fontSize: 19, fontFamily: F.black, lineHeight: 22 },
  evDataMes:         { fontSize: 9, fontFamily: F.black, letterSpacing: 0.8, marginTop: 2 },
  evConteudo:        { flex: 1, gap: 3 },
  evTopo:            { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  evIconWrap:        { width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  evTipoLabel:       { fontSize: 9, fontFamily: F.black, letterSpacing: 0.6 },
  evChipMini:        { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 'auto' as any },
  evChipMiniText:    { fontSize: 8, fontFamily: F.black, letterSpacing: 0.4 },
  evTitulo:          { fontSize: 13, fontFamily: F.bold, color: CORES.azulEscuro },
  evMetaRow:         { flexDirection: 'row', alignItems: 'center', gap: 4 },
  evMeta:            { fontSize: 10, color: CORES.textoSec, fontFamily: F.semibold },

  listaVazia:        { alignItems: 'center', paddingVertical: 28, gap: 8 },
  listaVaziaText:    { fontSize: 12, color: CORES.textoSec, fontFamily: F.medium, textAlign: 'center' },

  // MODAL DETALHE
  detHero:           { borderRadius: 18, padding: 22, alignItems: 'center', marginBottom: 12 },
  detHeroIcon:       { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  detHeroTipo:       { fontSize: 11, fontFamily: F.black, letterSpacing: 1.4, marginBottom: 6 },
  detHeroTitulo:     { fontSize: 20, fontFamily: F.black, color: CORES.azulEscuro, textAlign: 'center', letterSpacing: -0.3, lineHeight: 26 },
  detContagem:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginTop: 12 },
  detContagemText:   { color: CORES.branco, fontSize: 11, fontFamily: F.black, letterSpacing: 0.7 },
  detInfoRow:        { flexDirection: 'row', gap: 10, marginBottom: 12 },
  detInfoBox:        { flex: 1, backgroundColor: CORES.fundo, borderRadius: 14, padding: 12, gap: 3 },
  detInfoLabel:      { fontSize: 9, fontFamily: F.black, color: CORES.textoSec, letterSpacing: 1.1, marginTop: 4 },
  detInfoValor:      { fontSize: 15, fontFamily: F.black, color: CORES.azulEscuro },
  detInfoSub:        { fontSize: 11, color: CORES.textoSec, fontFamily: F.semibold },
  detDescBox:        { backgroundColor: CORES.fundo, borderRadius: 14, padding: 12, marginBottom: 12 },
  detDescLabel:      { fontSize: 9, fontFamily: F.black, color: CORES.textoSec, letterSpacing: 1.1, marginBottom: 5 },
  detDescTexto:      { fontSize: 13, color: CORES.azulEscuro, lineHeight: 19, fontFamily: F.regular },
  detAcoesRow:       { flexDirection: 'row', gap: 8, marginBottom: 8 },
  detBtnEditar:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 12, backgroundColor: CORES.fundo, borderWidth: 1, borderColor: CORES.cinzaClaro },
  detBtnEditarText:  { color: CORES.azulEscuro, fontFamily: F.bold, fontSize: 12 },
  detBtnExcluir:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 12, backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: '#FDECEA' },
  detBtnExcluirText: { color: '#e74c3c', fontFamily: F.bold, fontSize: 12 },

  // MODAIS GERAL
  modalOverlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet:        { backgroundColor: CORES.branco, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 32, maxHeight: '92%' },
  modalHandle:       { width: 40, height: 4, backgroundColor: CORES.cinzaClaro, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitulo:       { fontSize: 17, fontFamily: F.black, color: CORES.azulEscuro, marginBottom: 4, letterSpacing: -0.3 },
  modalSub:          { fontSize: 12, color: CORES.textoSec, marginBottom: 14, fontFamily: F.regular },

  // MODAL DIA
  diaHeader:         { marginBottom: 14, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: CORES.cinzaClaro },
  diaSemLabel:       { fontSize: 10, fontFamily: F.black, letterSpacing: 1.4, color: CORES.rosa, textTransform: 'uppercase' },
  diaTituloData:     { fontSize: 20, fontFamily: F.black, color: CORES.azulEscuro, letterSpacing: -0.4 },
  diaBloco:          { marginBottom: 14 },
  diaBlocoTitulo:    { fontSize: 9, fontFamily: F.black, color: CORES.textoSec, letterSpacing: 1.2, marginBottom: 8, textTransform: 'uppercase' },
  diaVazio:          { fontSize: 12, color: CORES.textoSec, fontFamily: F.medium, fontStyle: 'italic' },
  eventoItem:        { borderLeftWidth: 3, borderLeftColor: CORES.cinzaClaro, paddingLeft: 10, paddingVertical: 8, paddingRight: 8, backgroundColor: CORES.fundo, marginBottom: 6, borderRadius: 8 },
  eventoTop:         { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  eventoTitulo:      { fontSize: 13, fontFamily: F.bold, color: CORES.azulEscuro, flex: 1 },
  eventoDesc:        { fontSize: 11, color: CORES.textoSec, lineHeight: 16, fontFamily: F.regular },
  btnAcaoMini:       { width: 24, height: 24, borderRadius: 12, backgroundColor: CORES.branco, justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: CORES.cinzaClaro },
  linkCancelar:      { fontSize: 11, color: CORES.rosa, fontFamily: F.bold },

  tipoBadge:         { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  tipoBadgeText:     { fontSize: 9, fontFamily: F.black, letterSpacing: 0.4 },

  lembInput:         { backgroundColor: CORES.fundo, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, color: CORES.azulEscuro, borderWidth: 1, borderColor: CORES.cinzaClaro, marginBottom: 8, fontFamily: F.regular },
  btnSalvarLemb:     { backgroundColor: CORES.azulEscuro, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  btnSalvarLembText: { color: CORES.branco, fontFamily: F.black, fontSize: 13 },

  // FORM ADMIN
  formLabel:         { fontSize: 10, fontFamily: F.black, color: CORES.textoSec, letterSpacing: 0.8, marginBottom: 6, marginTop: 12 },
  formInput:         { backgroundColor: CORES.fundo, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, color: CORES.azulEscuro, borderWidth: 1, borderColor: CORES.cinzaClaro, fontFamily: F.regular },
  formSelect:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: CORES.fundo, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: CORES.cinzaClaro },
  formSelectText:    { fontSize: 13, fontFamily: F.bold, color: CORES.azulEscuro },
  adminRow:          { flexDirection: 'row', gap: 10 },
  seriesRow:         { flexDirection: 'row', gap: 10, marginTop: 4 },
  serieBadge:        { flex: 1, paddingVertical: 11, borderRadius: 12, borderWidth: 1.5, borderColor: CORES.cinzaClaro, alignItems: 'center', backgroundColor: CORES.fundo },
  serieBadgeAtivo:   { backgroundColor: CORES.azulEscuro, borderColor: CORES.azulEscuro },
  serieBadgeText:    { fontSize: 12, fontFamily: F.black, color: CORES.textoSec },
  formBtns:          { flexDirection: 'row', gap: 10, marginTop: 18 },
  formBtn:           { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  formBtnText:       { fontFamily: F.black, fontSize: 13 },

  // SELETOR DATA
  dataPickerRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  dataPickerValor:   { fontSize: 15, fontFamily: F.black, color: CORES.azulEscuro, flex: 1, textAlign: 'center' },
  diaPickerBtn:      { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: CORES.cinzaClaro, backgroundColor: CORES.fundo },
  diaPickerBtnAtivo: { backgroundColor: CORES.azulEscuro, borderColor: CORES.azulEscuro },
  diaPickerText:     { fontSize: 12, fontFamily: F.bold, color: CORES.azulEscuro },

  seletorItem:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: CORES.cinzaClaro },
  seletorItemText:   { flex: 1, fontSize: 14, fontFamily: F.bold, color: CORES.azulEscuro },

  legendaItem:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  legendaText:       { fontSize: 13, fontFamily: F.semibold, color: CORES.azulEscuro },

  btnFecharModal:    { backgroundColor: CORES.fundo, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 10 },
  btnFecharModalText:{ fontFamily: F.bold, fontSize: 13, color: CORES.textoSec },

  // MODAL CONFIRMAÇÃO
  confirmOverlay:    { flex: 1, backgroundColor: 'rgba(11, 32, 70, 0.65)', justifyContent: 'center', alignItems: 'center', padding: 28 },
  confirmBox:        { width: '100%', maxWidth: 320, backgroundColor: CORES.branco, borderRadius: 22, padding: 24, alignItems: 'center', elevation: 12, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20 },
  confirmIcon:       { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFF5F5', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  confirmTitulo:     { fontSize: 17, fontFamily: F.black, color: CORES.azulEscuro, marginBottom: 6, textAlign: 'center' },
  confirmMsg:        { fontSize: 13, color: CORES.textoSec, fontFamily: F.regular, textAlign: 'center', lineHeight: 19, marginBottom: 18 },
  confirmBtns:       { flexDirection: 'row', gap: 8, width: '100%' },
  confirmBtn:        { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  confirmBtnText:    { fontFamily: F.black, fontSize: 13 },
});