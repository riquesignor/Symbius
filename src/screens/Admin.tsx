import React, { useState, useEffect, useMemo, useRef } from 'react';
import SymbiusTabBar from '../components/SymbiusTabBar';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  SafeAreaView, StatusBar, TextInput, ActivityIndicator,
  Modal, Animated, useWindowDimensions, Platform
} from 'react-native';
import { db } from '../config/firebaseConfig';
import { dispararPush } from '../services/pushNotificationsService';
import {
  collection, query, orderBy, getDocs, updateDoc, doc
} from 'firebase/firestore';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppSettings } from '../contexts/AppSettingsContext';
import { RefreshControl } from 'react-native';

import {
  LineChart, BarChart, PieChart, ProgressChart
} from 'react-native-chart-kit';

// ── Fonte Poppins ──
import { F } from '../constants/theme';
import { CORES_SYMBIUS, CORES_SYMBIUS_DARK } from './Boasvindas';

// ── Shadow de paleta Symbius (mesma técnica de Match/Perfil/Configuracoes/
// Calendario): a lógica desta tela usa CORES.xxx (import direto, fixo
// claro) e C.xxx (via useAppSettings, muda com modoEscuro). ──
const CORES = {
  azulEscuro: CORES_SYMBIUS.verdeEscuro,
  azulCeu:    CORES_SYMBIUS.azul,
  branco:     CORES_SYMBIUS.fundoCard,
  cinzaClaro: CORES_SYMBIUS.borda,
  textoSec:   CORES_SYMBIUS.textoSec,
  amarelo:    CORES_SYMBIUS.laranja,
  laranja:    CORES_SYMBIUS.laranjaTexto,
  verde:      CORES_SYMBIUS.sucesso,
  rosa:       CORES_SYMBIUS.laranjaTexto,
  vermelho:   '#D64545',
};
const CORES_LOCAL_CLARO = {
  azulEscuro: CORES_SYMBIUS.verdeEscuro,
  branco:     CORES_SYMBIUS.fundoCard,
  cinzaClaro: CORES_SYMBIUS.borda,
  fundo:      CORES_SYMBIUS.fundo,
  textoSec:   CORES_SYMBIUS.textoSec,
  amarelo:    CORES_SYMBIUS.laranja,
};
const CORES_LOCAL_ESCURO = {
  azulEscuro: CORES_SYMBIUS.verdeMedio,
  branco:     CORES_SYMBIUS_DARK.fundoCard,
  cinzaClaro: CORES_SYMBIUS_DARK.fundoSuave,
  fundo:      CORES_SYMBIUS_DARK.fundo,
  textoSec:   CORES_SYMBIUS_DARK.textoSec,
  amarelo:    CORES_SYMBIUS.laranja,
};

const CAT_LABELS: Record<string, string> = {
  destaque:      'Destaques',
  oportunidades: 'Oportunidades',
  olimpiadas:    'Olimpíadas',
  avisos:        'Avisos',
  passeios:      'Passeios',
};

const CAT_CORES: Record<string, string> = {
  destaque:      '#FFC82C',
  oportunidades: '#27ae60',
  olimpiadas:    '#e67e22',
  avisos:        '#3498db',
  passeios:      '#8e44ad',
};

const STATUS_LABELS: Record<number, string> = { 0: 'Pendente', 1: 'Ativo', 2: 'Suspenso' };
const STATUS_CORES:  Record<number, string> = { 0: '#FFC82C', 1: '#27ae60', 2: '#e74c3c' };
const TIPOS_USUARIO = ['Aluno', 'Gremista', 'Administrador'];
const STATUS_OPCOES = [
  { value: 0, label: 'Pendente' },
  { value: 1, label: 'Ativo'    },
  { value: 2, label: 'Suspenso' },
];

const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MEDALHAS    = ['#FFD700', '#C0C0C0', '#CD7F32', CORES.textoSec, CORES.textoSec];

const ABAS_DEF = [
  { key: 'overview', label: 'Visão Geral', icon: 'grid'   },
  { key: 'usuarios', label: 'Usuários',    icon: 'people' },
] as const;

// ── Animação fade in ──
const FadeInView = ({ children, delay = 0, style }: any) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 450, delay, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={[style, {
      opacity: anim,
      transform: [{ translateY: anim.interpolate({ inputRange: [0,1], outputRange: [16,0] }) }],
    }]}>
      {children}
    </Animated.View>
  );
};

// ── Counter animado ──
const AnimatedCounter = ({ value, style, duration = 1200 }: any) => {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const anim = new Animated.Value(0);
    const listener = anim.addListener(({ value: v }) => setDisplay(Math.round(v)));
    Animated.timing(anim, { toValue: value, duration, useNativeDriver: false }).start();
    return () => anim.removeListener(listener);
  }, [value]);
  return <Text style={style}>{display.toLocaleString('pt-BR')}</Text>;
};

export default function Admin({ navigation, route }: any) {
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const uid = route?.params?.uid;

  const { cores: _coresContexto, fonteScale, modoEscuro: _modoEscuroReal } = useAppSettings();
  // Paleta Symbius ainda não tem modo escuro definitivo (pendente) — fixado
  // em claro por ora, independente do toggle real de Modo Escuro.
  const modoEscuro = false;
  const C = CORES_LOCAL_CLARO;
  const fs = (size: number) => size * fonteScale;

  const [posts,    setPosts]    = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [abaAtiva, setAbaAtiva] = useState<'overview' | 'usuarios'>('overview');

  // Busca por RA
  const [buscaRA,        setBuscaRA]        = useState('');
  const [usuarioBuscado, setUsuarioBuscado] = useState<any>(null);

  // Edição inline
  const [editTipo,   setEditTipo]   = useState<Record<string, string>>({});
  const [editStatus, setEditStatus] = useState<Record<string, number>>({});
  const [salvando,   setSalvando]   = useState<Record<string, boolean>>({});

  // Modais
  const [modalTipo,       setModalTipo]       = useState(false);
  const [modalStatus,     setModalStatus]     = useState(false);
  const [modalUidAlvo,    setModalUidAlvo]    = useState('');
  const [modalCartaoTipo, setModalCartaoTipo] = useState(false);
  const [modalCartaoSts,  setModalCartaoSts]  = useState(false);
  const [cartaoTipo,      setCartaoTipo]      = useState('');
  const [cartaoStatus,    setCartaoStatus]    = useState(0);
  const [salvandoCartao,  setSalvandoCartao]  = useState(false);

  // Filtro
  const [filtroTipoU, setFiltroTipoU] = useState<string>('todos');

  // ── Pager horizontal ────────────────────────────────────────
  const pageRef   = useRef<ScrollView>(null);
  const scrollX   = useRef(new Animated.Value(0)).current;
  const tabW      = winW / 2;
  const indicatorX = scrollX.interpolate({
    inputRange: [0, winW], outputRange: [0, tabW], extrapolate: 'clamp',
  });

  const irParaAba = (idx: number) => {
    pageRef.current?.scrollTo({ x: idx * winW, animated: true });
    setAbaAtiva(idx === 0 ? 'overview' : 'usuarios');
  };

  const handlePageScroll = (e: any) => {
    const x = e.nativeEvent.contentOffset.x;
    setAbaAtiva(x < winW / 2 ? 'overview' : 'usuarios');
  };

  // Toast
  const [toast, setToast] = useState('');
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!uid) {
      (async () => {
        await AsyncStorage.removeItem('uid');
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      })();
      return;
    }
    carregar();
  }, [uid]);

  const carregar = async () => {
    setLoading(true);
    try {
      const [snapPosts, snapUsuarios] = await Promise.all([
        getDocs(query(collection(db, 'posts'), orderBy('visualizacoes', 'desc'))),
        getDocs(query(collection(db, 'usuarios'), orderBy('nome_completo', 'asc'))),
      ]);
      const ps = snapPosts.docs.map(d => ({ id: d.id, ...d.data() }));
      const us = snapUsuarios.docs.map(d => ({ uid: d.id, ...d.data() }));
      setPosts(ps);
      setUsuarios(us);
      const t: Record<string, string> = {};
      const s: Record<string, number> = {};
      us.forEach((u: any) => { t[u.uid] = u.tipo; s[u.uid] = u.status; });
      setEditTipo(t);
      setEditStatus(s);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // ── Stats ────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalViews     = posts.reduce((s, p) => s + (p.visualizacoes || 0), 0);
    const totalAlunos    = usuarios.filter((u: any) => u.tipo === 'Aluno').length;
    const totalGremistas = usuarios.filter((u: any) => u.tipo === 'Gremista').length;
    const totalAdmins    = usuarios.filter((u: any) => u.tipo?.toLowerCase() === 'administrador').length;
    const totalAtivos    = usuarios.filter((u: any) => u.status === 1).length;
    const totalPendentes = usuarios.filter((u: any) => u.status === 0).length;
    const totalSuspensos = usuarios.filter((u: any) => u.status === 2).length;
    const taxaEngaj      = posts.length > 0 ? Math.round((totalViews / (posts.length * Math.max(1, usuarios.length))) * 100) : 0;
    const mediaViews     = posts.length > 0 ? Math.round(totalViews / posts.length) : 0;
    return { totalViews, totalAlunos, totalGremistas, totalAdmins, totalAtivos, totalPendentes, totalSuspensos, taxaEngaj, mediaViews };
  }, [posts, usuarios]);

  const top5     = [...posts].sort((a, b) => (b.visualizacoes || 0) - (a.visualizacoes || 0)).slice(0, 5);
  const maxViews = top5[0]?.visualizacoes || 1;

  const postsPorCat = useMemo(() => {
    const map: Record<string, number> = {};
    posts.forEach(p => { const c = p.categoria || 'avisos'; map[c] = (map[c] || 0) + 1; });
    return Object.entries(map).map(([cat, count]) => ({
      name: CAT_LABELS[cat] || cat, population: count,
      color: CAT_CORES[cat] || '#888', legendFontColor: CORES.azulEscuro, legendFontSize: 11,
    }));
  }, [posts]);

  const cadastrosTimeline = useMemo(() => {
    const hoje = new Date();
    const labels: string[] = [], dados: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      labels.push(MESES_ABREV[d.getMonth()]);
      const inicio = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      const fim    = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).getTime();
      dados.push(usuarios.filter((u: any) => {
        if (!u.cadastrado_em) return false;
        const dt = u.cadastrado_em.toDate ? u.cadastrado_em.toDate().getTime() : new Date(u.cadastrado_em).getTime();
        return dt >= inicio && dt <= fim;
      }).length);
    }
    return { labels, dados };
  }, [usuarios]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await carregar(); } catch (e) { console.error(e); } finally { setRefreshing(false); }
  };

  // Avisa a pessoa quando a conta é suspensa ou volta a ficar ativa.
  const avisarMudancaStatus = (uid: string, antes: number, depois: number) => {
    if (antes === depois) return;
    if (depois === 2) dispararPush({
      destinatarioUid: uid,
      titulo: 'Conta desativada',
      corpo: 'Sua conta no Simbio foi desativada pela coordenação.',
      dados: { tipo: 'conta_suspensa' },
    });
    else if (antes === 2 && depois === 1) dispararPush({
      destinatarioUid: uid,
      titulo: 'Conta reativada',
      corpo: 'Sua conta no Simbio foi reativada. Bem-vindo de volta!',
      dados: { tipo: 'conta_reativada' },
    });
  };

  const salvarUsuario = async (uid: string) => {
    setSalvando(prev => ({ ...prev, [uid]: true }));
    try {
      await updateDoc(doc(db, 'usuarios', uid), { tipo: editTipo[uid], status: editStatus[uid] });
      avisarMudancaStatus(uid, (usuarios.find((u: any) => u.uid === uid) as any)?.status, editStatus[uid]);
      setUsuarios(prev => prev.map((u: any) => u.uid === uid ? { ...u, tipo: editTipo[uid], status: editStatus[uid] } : u));
      setToast('Usuário atualizado');
    } catch { setToast('Falha ao salvar'); }
    finally { setSalvando(prev => ({ ...prev, [uid]: false })); }
  };

  const buscarRA = () => {
    setUsuarioBuscado(null);
    if (!buscaRA.trim()) { setToast('Digite um RA'); return; }
    const encontrado = usuarios.find((u: any) => u.ra?.toUpperCase() === buscaRA.trim().toUpperCase());
    if (!encontrado) { setToast(`RA "${buscaRA.trim().toUpperCase()}" não encontrado`); return; }
    setUsuarioBuscado(encontrado);
    setCartaoTipo(encontrado.tipo);
    setCartaoStatus(encontrado.status);
  };

  const salvarCartao = async () => {
    if (!usuarioBuscado) return;
    setSalvandoCartao(true);
    try {
      await updateDoc(doc(db, 'usuarios', usuarioBuscado.uid), { tipo: cartaoTipo, status: cartaoStatus });
      avisarMudancaStatus(usuarioBuscado.uid, usuarioBuscado.status, cartaoStatus);
      setUsuarios(prev => prev.map((u: any) => u.uid === usuarioBuscado.uid ? { ...u, tipo: cartaoTipo, status: cartaoStatus } : u));
      setToast(`${usuarioBuscado.nome_completo.split(' ')[0]} atualizado`);
    } catch { setToast('Falha ao salvar'); }
    finally { setSalvandoCartao(false); }
  };

  const usuariosFiltrados = useMemo(() => {
    if (filtroTipoU === 'todos')     return usuarios;
    if (filtroTipoU === 'pendentes') return usuarios.filter((u: any) => u.status === 0);
    if (filtroTipoU === 'suspensos') return usuarios.filter((u: any) => u.status === 2);
    return usuarios.filter((u: any) => u.tipo === filtroTipoU);
  }, [usuarios, filtroTipoU]);

  const chartConfigBase = useMemo(() => ({
    backgroundColor: C.branco, backgroundGradientFrom: C.branco, backgroundGradientTo: C.branco,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(232,163,61,${opacity})`, // laranja Symbius — linha do gráfico
    labelColor: (opacity = 1) => modoEscuro ? `rgba(180,190,200,${opacity})` : `rgba(141,153,174,${opacity})`,
    style: { borderRadius: 16 },
    propsForDots: { r: '5', strokeWidth: '2', stroke: CORES.rosa },
    propsForBackgroundLines: { strokeDasharray: '', stroke: modoEscuro ? '#3A4048' : CORES.cinzaClaro, strokeWidth: 0.5 },
    propsForLabels: { fontFamily: F.semibold, fontSize: 10 },
  }), [modoEscuro, C.branco]);

  const postsPorCatStyled = useMemo(() => postsPorCat.map(p => ({ ...p, legendFontColor: C.azulEscuro })), [postsPorCat, C.azulEscuro]);

  const refreshProps = {
    refreshing,
    onRefresh: handleRefresh,
    tintColor: modoEscuro ? C.amarelo : CORES.azulEscuro,
    title: 'Puxe para recarregar',
    titleColor: C.textoSec,
  };

  if (loading) return (
    <View style={[styles.centro, { backgroundColor: C.fundo }]}>
      <ActivityIndicator size="large" color={modoEscuro ? C.amarelo : CORES.azulEscuro} />
      <Text style={[styles.loadingText, { color: C.textoSec, fontSize: fs(13) }]}>Carregando dashboard...</Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: C.fundo }]}>
      <StatusBar barStyle={CORES_SYMBIUS.barStyle} backgroundColor={CORES_SYMBIUS.fundo} />

      {/* TOAST */}
      {toast !== '' && (
        <View style={[styles.toast, { top: insets.top + 12 }]}>
          <Ionicons name="checkmark-circle" size={16} color={CORES.amarelo} />
          <Text style={[styles.toastText, { fontSize: fs(12) }]}>{toast}</Text>
        </View>
      )}

      {/* HEADER */}
      <View style={[styles.header, { paddingTop: insets.top + 28 }]}>
        <TouchableOpacity
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Index', params: { uid } }] })}
          style={styles.btnVoltar}
          accessibilityLabel="Voltar"
        >
          <Ionicons name="arrow-back" size={22} color={CORES_SYMBIUS.texto} />
        </TouchableOpacity>
        {/* Título no fluxo normal (não absoluto): um Text absoluto por cima
            do header engolia os toques de voltar/atualizar no Android/iOS. */}
        <Text
          style={[styles.headerTitulo, styles.headerTituloFlex, { fontSize: fs(17) }]}
          numberOfLines={1}
          accessibilityRole="header"
        >
          Dashboard Admin
        </Text>
        <TouchableOpacity onPress={carregar} style={styles.btnRefresh} accessibilityLabel="Atualizar">
          <Ionicons name="refresh" size={20} color={CORES_SYMBIUS.texto} />
        </TouchableOpacity>
      </View>

      {/* ABAS — indicador desliza com o swipe */}
      <View style={[styles.abas, { backgroundColor: C.branco, borderBottomColor: C.cinzaClaro }]}>
        <Animated.View
          style={[styles.abaIndicatorLine, { width: tabW, transform: [{ translateX: indicatorX }] }]}
        />
        {ABAS_DEF.map((a, idx) => {
          const ativo = abaAtiva === a.key;
          return (
            <TouchableOpacity key={a.key} style={styles.aba} onPress={() => irParaAba(idx)}>
              <Ionicons name={a.icon as any} size={14} color={ativo ? C.azulEscuro : C.textoSec} />
              <Text style={[styles.abaText, { color: C.textoSec, fontSize: fs(11) }, ativo && { color: C.azulEscuro }]}>
                {a.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ════ PAGER HORIZONTAL — deslize para navegar ════ */}
      <ScrollView
        ref={pageRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false, listener: handlePageScroll },
        )}
        style={{ flex: 1 }}
      >

        {/* ══ PAGE 0 — VISÃO GERAL ══ */}
        <ScrollView
          style={{ width: winW }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl {...refreshProps} />}
          contentContainerStyle={{ paddingBottom: insets.bottom + 60 }}
        >
          <View style={{ padding: 16 }}>

            {/* HERO */}
            <FadeInView delay={0}>
              <View style={styles.heroCard}>
                <View>
                  <Text style={[styles.heroEyebrow, { fontSize: fs(9) }]}>TOTAL DE VISUALIZAÇÕES</Text>
                  <AnimatedCounter value={stats.totalViews} style={[styles.heroValor, { fontSize: fs(38) }]} />
                  <View style={styles.heroBadges}>
                    <View style={styles.heroBadge}>
                      <Ionicons name="trending-up" size={10} color={CORES.verde} />
                      <Text style={[styles.heroBadgeText, { color: CORES.verde, fontSize: fs(10) }]}>{stats.mediaViews}/post</Text>
                    </View>
                    <View style={styles.heroBadge}>
                      <Ionicons name="flash" size={10} color={CORES.amarelo} />
                      <Text style={[styles.heroBadgeText, { color: CORES.amarelo, fontSize: fs(10) }]}>{stats.taxaEngaj}% engaj.</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.heroIconWrap}>
                  <FontAwesome5 name="chart-line" size={28} color={CORES.amarelo} />
                </View>
              </View>
            </FadeInView>

            {/* MINI GRID */}
            <FadeInView delay={120}>
              <View style={styles.miniGrid}>
                {[
                  { label: 'Usuários', value: usuarios.length,      cor: CORES.azulCeu, icon: 'people'         },
                  { label: 'Ativos',   value: stats.totalAtivos,    cor: CORES.verde,   icon: 'checkmark-circle'},
                  { label: 'Pendentes',value: stats.totalPendentes, cor: CORES.laranja, icon: 'time'            },
                  { label: 'Posts',    value: posts.length,         cor: CORES.rosa,    icon: 'document-text'   },
                ].map(item => (
                  <View key={item.label} style={[styles.miniCard, { backgroundColor: C.branco, borderLeftColor: item.cor }]}>
                    <View style={[styles.miniIcon, { backgroundColor: item.cor + (modoEscuro ? '25' : '15') }]}>
                      <Ionicons name={item.icon as any} size={16} color={item.cor} />
                    </View>
                    <AnimatedCounter value={item.value} style={[styles.miniValor, { color: C.azulEscuro, fontSize: fs(22) }]} />
                    <Text style={[styles.miniLabel, { color: C.textoSec, fontSize: fs(10) }]}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </FadeInView>

            {/* GRÁFICO LINHA — CADASTROS */}
            <FadeInView delay={240}>
              <View style={[styles.chartCard, { backgroundColor: C.branco }]}>
                <View style={styles.chartHeader}>
                  <View>
                    <Text style={[styles.chartEyebrow, { color: CORES.rosa, fontSize: fs(9) }]}>ÚLTIMOS 6 MESES</Text>
                    <Text style={[styles.chartTitulo, { color: C.azulEscuro, fontSize: fs(15) }]}>Crescimento de cadastros</Text>
                  </View>
                  <View style={[styles.chartLegenda, { backgroundColor: C.fundo }]}>
                    <View style={[styles.dotCor, { backgroundColor: CORES.rosa }]} />
                    <Text style={[styles.chartLegendaText, { color: C.textoSec, fontSize: fs(10) }]}>Novos usuários</Text>
                  </View>
                </View>
                {cadastrosTimeline.dados.every(v => v === 0) ? (
                  <View style={styles.chartVazio}>
                    <Ionicons name="people-outline" size={32} color={C.cinzaClaro} />
                    <Text style={[styles.chartVazioText, { color: C.textoSec, fontSize: fs(13) }]}>Nenhum cadastro nos últimos 6 meses</Text>
                  </View>
                ) : (
                  <LineChart
                    data={{ labels: cadastrosTimeline.labels, datasets: [{ data: cadastrosTimeline.dados }] }}
                    width={winW - 64} height={180}
                    chartConfig={chartConfigBase} bezier
                    style={styles.chartGraph}
                    withInnerLines withOuterLines={false} withVerticalLines={false} fromZero
                  />
                )}
              </View>
            </FadeInView>

            {/* PIZZA */}
            <FadeInView delay={360}>
              <View style={[styles.chartCard, { backgroundColor: C.branco }]}>
                <View style={styles.chartHeader}>
                  <View>
                    <Text style={[styles.chartEyebrow, { color: CORES.rosa, fontSize: fs(9) }]}>DISTRIBUIÇÃO</Text>
                    <Text style={[styles.chartTitulo, { color: C.azulEscuro, fontSize: fs(15) }]}>Posts por categoria</Text>
                  </View>
                </View>
                {postsPorCatStyled.length > 0 ? (
                  <View style={{ alignItems: 'center' }}>
                    <PieChart
                      data={postsPorCatStyled} width={winW - 64} height={160}
                      chartConfig={chartConfigBase} accessor="population"
                      backgroundColor="transparent" paddingLeft="20" hasLegend={false} absolute
                    />
                    <View style={styles.pizzaLegenda}>
                      {postsPorCatStyled.map(item => (
                        <View key={item.name} style={styles.pizzaLegendaItem}>
                          <View style={[styles.pizzaLegendaDot, { backgroundColor: item.color }]} />
                          <Text style={[styles.pizzaLegendaTxt, { color: C.azulEscuro, fontSize: fs(11) }]}>
                            {item.population} {item.name}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : (
                  <View style={styles.chartVazio}>
                    <Ionicons name="pie-chart-outline" size={32} color={C.cinzaClaro} />
                    <Text style={[styles.chartVazioText, { color: C.textoSec, fontSize: fs(12) }]}>Sem dados ainda</Text>
                  </View>
                )}
              </View>
            </FadeInView>

            {/* STATUS DOS USUÁRIOS */}
            <FadeInView delay={480}>
              <Text style={[styles.secaoTituloGrande, { color: C.azulEscuro, fontSize: fs(13) }]}>Status dos usuários</Text>
              <View style={styles.statusGrid}>
                {[
                  { label: 'Ativos',    value: stats.totalAtivos,    cor: CORES.verde,   icon: 'checkmark' },
                  { label: 'Pendentes', value: stats.totalPendentes, cor: CORES.laranja, icon: 'hourglass' },
                  { label: 'Suspensos', value: stats.totalSuspensos, cor: CORES.vermelho,icon: 'close'     },
                ].map(item => (
                  <View key={item.label} style={[styles.statusCard, { backgroundColor: item.cor + (modoEscuro ? '20' : '12') }]}>
                    <View style={[styles.statusBolha, { backgroundColor: item.cor }]}>
                      <Ionicons name={item.icon as any} size={20} color="#FFF" />
                    </View>
                    <AnimatedCounter value={item.value} style={[styles.statusN, { color: item.cor, fontSize: fs(24) }]} />
                    <Text style={[styles.statusL, { color: C.textoSec, fontSize: fs(10) }]}>{item.label}</Text>
                    <View style={[styles.statusBarra, { backgroundColor: modoEscuro ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
                      <View style={[styles.statusBarraFill, {
                        width: `${(item.value / Math.max(1, usuarios.length)) * 100}%`,
                        backgroundColor: item.cor,
                      }]} />
                    </View>
                  </View>
                ))}
              </View>
            </FadeInView>

            {/* COMPOSIÇÃO */}
            <FadeInView delay={600}>
              <View style={[styles.chartCard, { backgroundColor: C.branco }]}>
                <View style={styles.chartHeader}>
                  <View>
                    <Text style={[styles.chartEyebrow, { color: CORES.rosa, fontSize: fs(9) }]}>COMPOSIÇÃO</Text>
                    <Text style={[styles.chartTitulo, { color: C.azulEscuro, fontSize: fs(15) }]}>Tipos de usuário</Text>
                  </View>
                </View>
                <View style={styles.composicaoLista}>
                  {[
                    { tipo: 'Aluno',        n: stats.totalAlunos,    cor: CORES.azulCeu, icon: 'school' },
                    { tipo: 'Gremista',     n: stats.totalGremistas, cor: CORES.amarelo, icon: 'star'   },
                    { tipo: 'Administrador',n: stats.totalAdmins,    cor: CORES.rosa,    icon: 'shield' },
                  ].map(item => {
                    const pct = Math.round((item.n / Math.max(1, usuarios.length)) * 100);
                    return (
                      <View key={item.tipo} style={styles.composicaoItem}>
                        <View style={[styles.composicaoIcon, { backgroundColor: item.cor + (modoEscuro ? '25' : '15') }]}>
                          <Ionicons name={item.icon as any} size={14} color={item.cor} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={styles.composicaoTopo}>
                            <Text style={[styles.composicaoNome, { color: C.azulEscuro, fontSize: fs(13) }]}>{item.tipo}</Text>
                            <Text style={[styles.composicaoValor, { color: C.azulEscuro, fontSize: fs(13) }]}>
                              {item.n} <Text style={{ color: C.textoSec, fontFamily: F.regular }}>· {pct}%</Text>
                            </Text>
                          </View>
                          <View style={[styles.composicaoBarra, { backgroundColor: C.cinzaClaro }]}>
                            <View style={[styles.composicaoBarraFill, { width: `${pct}%`, backgroundColor: item.cor }]} />
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            </FadeInView>

            {/* TOP 5 POSTS MAIS LIDOS */}
            {top5.length > 0 && (
              <FadeInView delay={720}>
                <View style={[styles.chartCard, { backgroundColor: C.branco }]}>
                  <View style={styles.chartHeader}>
                    <View>
                      <Text style={[styles.chartEyebrow, { color: CORES.rosa, fontSize: fs(9) }]}>RANKING</Text>
                      <Text style={[styles.chartTitulo, { color: C.azulEscuro, fontSize: fs(15) }]}>Posts mais lidos</Text>
                    </View>
                    <View style={[styles.chartLegenda, { backgroundColor: C.fundo }]}>
                      <Ionicons name="eye-outline" size={12} color={C.textoSec} />
                      <Text style={[styles.chartLegendaText, { color: C.textoSec, fontSize: fs(10) }]}>visualizações</Text>
                    </View>
                  </View>
                  {top5.map((p, i) => (
                    <View
                      key={p.id}
                      style={[
                        styles.top5ItemPro,
                        { borderBottomColor: C.cinzaClaro },
                        i === top5.length - 1 && { borderBottomWidth: 0 },
                      ]}
                    >
                      <View style={[styles.top5Medalha, {
                        borderColor: MEDALHAS[i],
                        backgroundColor: MEDALHAS[i] + (modoEscuro ? '25' : '18'),
                      }]}>
                        <Text style={[styles.top5Pos, { color: MEDALHAS[i], fontSize: fs(12) }]}>{i + 1}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.top5Nome, { color: C.azulEscuro, fontSize: fs(13) }]} numberOfLines={1}>
                          {p.titulo || 'Sem título'}
                        </Text>
                        <View style={styles.top5MetaRow}>
                          <View style={[styles.top5Cat, { backgroundColor: (CAT_CORES[p.categoria] || '#888') + '20' }]}>
                            <Text style={[styles.top5CatText, { color: CAT_CORES[p.categoria] || '#888', fontSize: fs(9) }]}>
                              {CAT_LABELS[p.categoria] || p.categoria || '—'}
                            </Text>
                          </View>
                          <View style={styles.top5Views}>
                            <Ionicons name="eye-outline" size={12} color={CORES.rosa} />
                            <Text style={[styles.top5ViewsText, { fontSize: fs(11) }]}>
                              {(p.visualizacoes || 0).toLocaleString('pt-BR')}
                            </Text>
                          </View>
                        </View>
                        <View style={[styles.barraWrap, { backgroundColor: C.cinzaClaro, marginTop: 6 }]}>
                          <View style={[styles.barra, {
                            width: `${Math.round(((p.visualizacoes || 0) / maxViews) * 100)}%`,
                            backgroundColor: CAT_CORES[p.categoria] || CORES.rosa,
                          }]} />
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </FadeInView>
            )}

          </View>
        </ScrollView>

        {/* ══ PAGE 1 — USUÁRIOS ══ */}
        <ScrollView
          style={{ width: winW }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl {...refreshProps} />}
          contentContainerStyle={{ paddingBottom: insets.bottom + 60 }}
        >
          <View style={{ padding: 16 }}>

            {/* BUSCA */}
            <FadeInView delay={0}>
              <View style={[styles.chartCard, { backgroundColor: C.branco }]}>
                <Text style={[styles.chartEyebrow, { color: CORES.rosa, fontSize: fs(9) }]}>BUSCA RÁPIDA</Text>
                <Text style={[styles.chartTitulo, { color: C.azulEscuro, fontSize: fs(15), marginBottom: 14 }]}>Encontrar por RA</Text>
                <View style={styles.buscaRow}>
                  <View style={[styles.buscaInputWrap, { backgroundColor: C.fundo, borderColor: C.cinzaClaro }]}>
                    <Ionicons name="search" size={16} color={C.textoSec} />
                    <TextInput
                      style={[styles.buscaInput, { color: C.azulEscuro, fontSize: fs(13) }]}
                      placeholder="Digite o RA do aluno..."
                      placeholderTextColor={C.textoSec}
                      value={buscaRA}
                      onChangeText={setBuscaRA}
                      autoCapitalize="characters"
                      onSubmitEditing={buscarRA}
                    />
                  </View>
                  <TouchableOpacity
                    style={[styles.btnBuscar, { backgroundColor: modoEscuro ? C.amarelo : CORES.azulEscuro }]}
                    onPress={buscarRA}
                  >
                    <Text style={[styles.btnBuscarText, { color: modoEscuro ? CORES.azulEscuro : CORES.branco, fontSize: fs(12) }]}>
                      Buscar
                    </Text>
                  </TouchableOpacity>
                </View>

                {usuarioBuscado && (
                  <FadeInView delay={100}>
                    <View style={[styles.cartaoEncontrado, { backgroundColor: C.fundo, borderColor: C.cinzaClaro }]}>
                      <View style={styles.cartaoEncontradoTopo}>
                        <View style={styles.cartaoAvatar}>
                          <Text style={[styles.cartaoAvatarText, { fontSize: fs(18) }]}>
                            {usuarioBuscado.nome_completo?.charAt(0)?.toUpperCase() || '?'}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.cartaoNome, { color: C.azulEscuro, fontSize: fs(14) }]}>{usuarioBuscado.nome_completo}</Text>
                          <Text style={[styles.cartaoEmail, { color: C.textoSec, fontSize: fs(11) }]}>{usuarioBuscado.email_escolar}</Text>
                        </View>
                      </View>
                      <View style={styles.cartaoInfoRow}>
                        <View style={[styles.cartaoInfoBox, { backgroundColor: C.branco }]}>
                          <Text style={[styles.cartaoInfoLabel, { color: C.textoSec, fontSize: fs(9) }]}>RA</Text>
                          <Text style={[styles.cartaoInfoValor, { color: C.azulEscuro, fontSize: fs(14) }]}>{usuarioBuscado.ra || '—'}</Text>
                        </View>
                        <View style={[styles.cartaoInfoBox, { backgroundColor: C.branco }]}>
                          <Text style={[styles.cartaoInfoLabel, { color: C.textoSec, fontSize: fs(9) }]}>TURMA</Text>
                          <Text style={[styles.cartaoInfoValor, { color: C.azulEscuro, fontSize: fs(14) }]}>{usuarioBuscado.turma || '—'}</Text>
                        </View>
                      </View>
                      <View style={styles.cartaoControles}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.campoLabel, { color: C.textoSec, fontSize: fs(9) }]}>TIPO</Text>
                          <TouchableOpacity
                            style={[styles.seletorBtn, { backgroundColor: C.branco, borderColor: C.cinzaClaro }]}
                            onPress={() => setModalCartaoTipo(true)}
                          >
                            <Text style={[styles.seletorBtnText, { color: C.azulEscuro, fontSize: fs(12) }]}>{cartaoTipo}</Text>
                            <Ionicons name="chevron-down" size={14} color={C.textoSec} />
                          </TouchableOpacity>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.campoLabel, { color: C.textoSec, fontSize: fs(9) }]}>STATUS</Text>
                          <TouchableOpacity
                            style={[styles.seletorBtn, { backgroundColor: C.branco, borderColor: C.cinzaClaro }]}
                            onPress={() => setModalCartaoSts(true)}
                          >
                            <View style={[styles.dotStatus, { backgroundColor: STATUS_CORES[cartaoStatus] }]} />
                            <Text style={[styles.seletorBtnText, { color: C.azulEscuro, fontSize: fs(12) }]}>{STATUS_LABELS[cartaoStatus]}</Text>
                            <Ionicons name="chevron-down" size={14} color={C.textoSec} />
                          </TouchableOpacity>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={[styles.btnSalvarCartao, { backgroundColor: modoEscuro ? C.amarelo : CORES.azulEscuro }]}
                        onPress={salvarCartao}
                        disabled={salvandoCartao}
                      >
                        {salvandoCartao
                          ? <ActivityIndicator color={modoEscuro ? CORES.azulEscuro : '#FFF'} size="small" />
                          : <>
                              <Ionicons name="save" size={14} color={modoEscuro ? CORES.azulEscuro : '#FFF'} />
                              <Text style={[styles.btnSalvarCartaoText, { color: modoEscuro ? CORES.azulEscuro : CORES.branco, fontSize: fs(13) }]}>
                                Salvar Alterações
                              </Text>
                            </>
                        }
                      </TouchableOpacity>
                    </View>
                  </FadeInView>
                )}
              </View>
            </FadeInView>

            {/* FILTROS + LISTA */}
            <FadeInView delay={120}>
              <View style={[styles.chartCard, { backgroundColor: C.branco }]}>
                <View style={styles.chartHeader}>
                  <View>
                    <Text style={[styles.chartEyebrow, { color: CORES.rosa, fontSize: fs(9) }]}>GERENCIAR</Text>
                    <Text style={[styles.chartTitulo, { color: C.azulEscuro, fontSize: fs(15) }]}>
                      {usuariosFiltrados.length} usuário{usuariosFiltrados.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                  {[
                    { key: 'todos',         label: 'Todos',    icon: 'grid'         },
                    { key: 'Aluno',         label: 'Alunos',   icon: 'school'       },
                    { key: 'Gremista',      label: 'Gremistas',icon: 'star'         },
                    { key: 'Administrador', label: 'Admins',   icon: 'shield'       },
                    { key: 'pendentes',     label: 'Pendentes',icon: 'time'         },
                    { key: 'suspensos',     label: 'Suspensos',icon: 'close-circle' },
                  ].map(c => {
                    const ativo = filtroTipoU === c.key;
                    return (
                      <TouchableOpacity
                        key={c.key}
                        style={[
                          styles.chip,
                          { backgroundColor: C.fundo, borderColor: C.cinzaClaro },
                          ativo && { backgroundColor: modoEscuro ? C.amarelo : CORES.azulEscuro, borderColor: modoEscuro ? C.amarelo : CORES.azulEscuro },
                        ]}
                        onPress={() => setFiltroTipoU(c.key)}
                      >
                        <Ionicons name={c.icon as any} size={11} color={ativo ? (modoEscuro ? CORES.azulEscuro : CORES.branco) : C.textoSec} />
                        <Text style={[styles.chipText, { color: C.textoSec, fontSize: fs(11) }, ativo && { color: modoEscuro ? CORES.azulEscuro : CORES.branco }]}>
                          {c.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {usuariosFiltrados.map((u: any, i: number) => (
                  <FadeInView key={u.uid} delay={i * 30}>
                    <View style={[styles.usuarioCard, { backgroundColor: C.fundo, borderColor: C.cinzaClaro }]}>
                      <View style={styles.usuarioTopo}>
                        <View style={[styles.usuarioAvatar, { backgroundColor: modoEscuro ? C.amarelo : CORES.azulEscuro }]}>
                          <Text style={[styles.usuarioAvatarText, { color: modoEscuro ? CORES.azulEscuro : CORES.branco, fontSize: fs(15) }]}>
                            {u.nome_completo?.charAt(0)?.toUpperCase() || '?'}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.usuarioNome, { color: C.azulEscuro, fontSize: fs(13) }]} numberOfLines={1}>
                            {u.nome_completo || '—'}
                          </Text>
                          <Text style={[styles.usuarioEmail, { color: C.textoSec, fontSize: fs(11) }]} numberOfLines={1}>
                            {u.email_escolar || ''}
                          </Text>
                          <Text style={[styles.usuarioDetalhe, { color: C.textoSec, fontSize: fs(10) }]}>
                            {u.ra || '—'} · {u.turma || '—'}
                          </Text>
                        </View>
                        <View style={[styles.statusPill, { backgroundColor: STATUS_CORES[u.status] + (modoEscuro ? '30' : '20') }]}>
                          <View style={[styles.dotStatus, { backgroundColor: STATUS_CORES[u.status] }]} />
                          <Text style={[styles.statusPillText, { color: STATUS_CORES[u.status], fontSize: fs(9) }]}>
                            {STATUS_LABELS[u.status]}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.usuarioControles}>
                        <TouchableOpacity
                          style={[styles.seletorBtnSm, { backgroundColor: C.branco, borderColor: C.cinzaClaro }]}
                          onPress={() => { setModalUidAlvo(u.uid); setModalTipo(true); }}
                        >
                          <Text style={[styles.seletorBtnSmText, { color: C.azulEscuro, fontSize: fs(10) }]}>{editTipo[u.uid] || u.tipo}</Text>
                          <Ionicons name="chevron-down" size={11} color={C.textoSec} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.seletorBtnSm, { backgroundColor: C.branco, borderColor: C.cinzaClaro }]}
                          onPress={() => { setModalUidAlvo(u.uid); setModalStatus(true); }}
                        >
                          <View style={[styles.dotStatus, { backgroundColor: STATUS_CORES[editStatus[u.uid] ?? u.status] }]} />
                          <Text style={[styles.seletorBtnSmText, { color: C.azulEscuro, fontSize: fs(10) }]}>
                            {STATUS_LABELS[editStatus[u.uid] ?? u.status]}
                          </Text>
                          <Ionicons name="chevron-down" size={11} color={C.textoSec} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.btnSalvarRow} onPress={() => salvarUsuario(u.uid)} disabled={salvando[u.uid]}>
                          {salvando[u.uid] ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name="checkmark" size={14} color="#FFF" />}
                        </TouchableOpacity>
                      </View>
                    </View>
                  </FadeInView>
                ))}
              </View>
            </FadeInView>

          </View>
        </ScrollView>

      </ScrollView>

      {/* ════ MODAIS ════ */}
      <Modal visible={modalTipo} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: C.branco, paddingBottom: insets.bottom + 24 }]}>
            <View style={[styles.modalHandle, { backgroundColor: C.cinzaClaro }]} />
            <Text style={[styles.modalTitulo, { color: C.azulEscuro, fontSize: fs(16) }]}>Tipo de Usuário</Text>
            {TIPOS_USUARIO.map(t => (
              <TouchableOpacity
                key={t} style={[styles.seletorItem, { borderBottomColor: C.cinzaClaro }]}
                onPress={() => { setEditTipo(prev => ({ ...prev, [modalUidAlvo]: t })); setModalTipo(false); }}
              >
                <Text style={[styles.seletorItemText, { color: C.azulEscuro, fontSize: fs(14) }]}>{t}</Text>
                {editTipo[modalUidAlvo] === t && <Ionicons name="checkmark" size={18} color={C.azulEscuro} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      <Modal visible={modalStatus} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: C.branco, paddingBottom: insets.bottom + 24 }]}>
            <View style={[styles.modalHandle, { backgroundColor: C.cinzaClaro }]} />
            <Text style={[styles.modalTitulo, { color: C.azulEscuro, fontSize: fs(16) }]}>Status</Text>
            {STATUS_OPCOES.map(s => (
              <TouchableOpacity
                key={s.value} style={[styles.seletorItem, { borderBottomColor: C.cinzaClaro }]}
                onPress={() => { setEditStatus(prev => ({ ...prev, [modalUidAlvo]: s.value })); setModalStatus(false); }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={[styles.dotStatus, { backgroundColor: STATUS_CORES[s.value] }]} />
                  <Text style={[styles.seletorItemText, { color: C.azulEscuro, fontSize: fs(14) }]}>{s.label}</Text>
                </View>
                {editStatus[modalUidAlvo] === s.value && <Ionicons name="checkmark" size={18} color={C.azulEscuro} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      <Modal visible={modalCartaoTipo} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: C.branco, paddingBottom: insets.bottom + 24 }]}>
            <View style={[styles.modalHandle, { backgroundColor: C.cinzaClaro }]} />
            <Text style={[styles.modalTitulo, { color: C.azulEscuro, fontSize: fs(16) }]}>Tipo de Usuário</Text>
            {TIPOS_USUARIO.map(t => (
              <TouchableOpacity
                key={t} style={[styles.seletorItem, { borderBottomColor: C.cinzaClaro }]}
                onPress={() => { setCartaoTipo(t); setModalCartaoTipo(false); }}
              >
                <Text style={[styles.seletorItemText, { color: C.azulEscuro, fontSize: fs(14) }]}>{t}</Text>
                {cartaoTipo === t && <Ionicons name="checkmark" size={18} color={C.azulEscuro} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      <Modal visible={modalCartaoSts} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: C.branco, paddingBottom: insets.bottom + 24 }]}>
            <View style={[styles.modalHandle, { backgroundColor: C.cinzaClaro }]} />
            <Text style={[styles.modalTitulo, { color: C.azulEscuro, fontSize: fs(16) }]}>Status</Text>
            {STATUS_OPCOES.map(s => (
              <TouchableOpacity
                key={s.value} style={[styles.seletorItem, { borderBottomColor: C.cinzaClaro }]}
                onPress={() => { setCartaoStatus(s.value); setModalCartaoSts(false); }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={[styles.dotStatus, { backgroundColor: STATUS_CORES[s.value] }]} />
                  <Text style={[styles.seletorItemText, { color: C.azulEscuro, fontSize: fs(14) }]}>{s.label}</Text>
                </View>
                {cartaoStatus === s.value && <Ionicons name="checkmark" size={18} color={C.azulEscuro} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
      <SymbiusTabBar ativa="nenhuma" navigation={navigation} uid={uid ?? null} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, ...(Platform.OS === 'web' ? { height: '100vh' as any, overflow: 'hidden' as any } : {}) },
  centro:      { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 },
  loadingText: { fontFamily: F.semibold },

  toast:     { position: 'absolute', alignSelf: 'center', backgroundColor: CORES.azulEscuro, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 24, zIndex: 9999, elevation: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  toastText: { color: CORES.branco, fontFamily: F.bold },

  header:          { backgroundColor: CORES_SYMBIUS.fundo, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 10, gap: 8 },
  btnVoltar:       { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start' },
  headerEyebrowRow:{ flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerDot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: CORES.amarelo },
  headerEyebrow:   { color: 'rgba(255,255,255,0.7)', fontFamily: F.black, letterSpacing: 1.6 },
  headerTitulo:    { color: CORES_SYMBIUS.texto, fontFamily: F.black, letterSpacing: -0.3 },
  headerTituloFlex: { flex: 1, textAlign: 'center' },
  btnRefresh:      { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },

  // ABAS com indicador animado
  abas:             { flexDirection: 'row', paddingHorizontal: 4, borderBottomWidth: 1, position: 'relative' },
  aba:              { flex: 1, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 5 },
  abaText:          { fontFamily: F.bold },
  abaIndicatorLine: { position: 'absolute', bottom: 0, left: 4, height: 3, backgroundColor: CORES.rosa, borderRadius: 3 },

  heroCard:      { backgroundColor: CORES.azulEscuro, borderRadius: 22, padding: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, elevation: 4, shadowColor: CORES.azulEscuro, shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  heroEyebrow:   { color: 'rgba(255,255,255,0.6)', fontFamily: F.black, letterSpacing: 1.4, marginBottom: 6 },
  heroValor:     { color: CORES.branco, fontFamily: F.black, letterSpacing: -1, lineHeight: 42 },
  heroBadges:    { flexDirection: 'row', gap: 6, marginTop: 8 },
  heroBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  heroBadgeText: { fontFamily: F.bold },
  heroIconWrap:  { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },

  miniGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  miniCard:  { width: '48.5%', borderRadius: 14, padding: 12, borderLeftWidth: 3, gap: 6 },
  miniIcon:  { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  miniValor: { fontFamily: F.black, letterSpacing: -0.5 },
  miniLabel: { fontFamily: F.bold, letterSpacing: 0.6, textTransform: 'uppercase' },

  chartCard:        { borderRadius: 18, padding: 16, marginBottom: 14, elevation: 2, shadowColor: CORES.azulEscuro, shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  chartHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  chartEyebrow:     { fontFamily: F.black, letterSpacing: 1.2 },
  chartTitulo:      { fontFamily: F.black, marginTop: 2, letterSpacing: -0.2 },
  chartLegenda:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  chartLegendaText: { fontFamily: F.semibold },
  dotCor:           { width: 8, height: 8, borderRadius: 4 },
  chartGraph:       { borderRadius: 14, marginVertical: 4, marginLeft: -10 },
  chartVazio:       { alignItems: 'center', paddingVertical: 30, gap: 8 },
  chartVazioText:   { fontFamily: F.medium },
  pizzaLegenda:     { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 8, paddingHorizontal: 8 },
  pizzaLegendaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  pizzaLegendaDot:  { width: 10, height: 10, borderRadius: 5 },
  pizzaLegendaTxt:  { fontFamily: F.semibold },

  secaoTituloGrande: { fontFamily: F.black, marginBottom: 10, marginTop: 4, letterSpacing: -0.2 },

  statusGrid:     { flexDirection: 'row', gap: 8, marginBottom: 14 },
  statusCard:     { flex: 1, borderRadius: 16, padding: 14, alignItems: 'center', gap: 6 },
  statusBolha:    { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  statusN:        { fontFamily: F.black, letterSpacing: -0.5 },
  statusL:        { fontFamily: F.bold, letterSpacing: 0.6, textTransform: 'uppercase' },
  statusBarra:    { width: '100%', height: 3, borderRadius: 2, marginTop: 8, overflow: 'hidden' },
  statusBarraFill:{ height: 3, borderRadius: 2 },

  composicaoLista:    { gap: 14 },
  composicaoItem:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  composicaoIcon:     { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  composicaoTopo:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  composicaoNome:     { fontFamily: F.bold },
  composicaoValor:    { fontFamily: F.black },
  composicaoBarra:    { height: 5, borderRadius: 3, overflow: 'hidden' },
  composicaoBarraFill:{ height: 5, borderRadius: 3 },

  top5ItemPro:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 0.5 },
  top5Medalha:  { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5 },
  top5Pos:      { fontFamily: F.black },
  top5Nome:     { fontFamily: F.bold, marginBottom: 4 },
  top5MetaRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  top5Cat:      { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  top5CatText:  { fontFamily: F.black, letterSpacing: 0.4 },
  top5Views:    { flexDirection: 'row', alignItems: 'center', gap: 3 },
  top5ViewsText:{ color: CORES.rosa, fontFamily: F.bold },
  barraWrap:    { height: 4, borderRadius: 2, overflow: 'hidden' },
  barra:        { height: 4, borderRadius: 2 },

  buscaRow:       { flexDirection: 'row', gap: 8 },
  buscaInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1 },
  buscaInput:     { flex: 1, paddingVertical: 12, fontFamily: F.medium },
  btnBuscar:      { borderRadius: 12, paddingHorizontal: 18, justifyContent: 'center', alignItems: 'center' },
  btnBuscarText:  { fontFamily: F.black },

  cartaoEncontrado:     { marginTop: 14, padding: 16, borderRadius: 14, borderWidth: 1 },
  cartaoEncontradoTopo: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  cartaoAvatar:         { width: 44, height: 44, borderRadius: 22, backgroundColor: CORES.rosa, justifyContent: 'center', alignItems: 'center' },
  cartaoAvatarText:     { color: CORES.branco, fontFamily: F.black },
  cartaoNome:           { fontFamily: F.black },
  cartaoEmail:          { fontFamily: F.medium, marginTop: 2 },
  cartaoInfoRow:        { flexDirection: 'row', gap: 8, marginBottom: 12 },
  cartaoInfoBox:        { flex: 1, borderRadius: 10, padding: 10 },
  cartaoInfoLabel:      { fontFamily: F.black, letterSpacing: 0.8 },
  cartaoInfoValor:      { fontFamily: F.bold, marginTop: 3 },
  cartaoControles:      { flexDirection: 'row', gap: 8, marginBottom: 12 },
  campoLabel:           { fontFamily: F.black, letterSpacing: 0.8, marginBottom: 5 },
  seletorBtn:           { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'space-between', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1 },
  seletorBtnText:       { fontFamily: F.bold, flex: 1 },
  dotStatus:            { width: 8, height: 8, borderRadius: 4 },
  btnSalvarCartao:      { flexDirection: 'row', gap: 6, borderRadius: 12, paddingVertical: 12, justifyContent: 'center', alignItems: 'center' },
  btnSalvarCartaoText:  { fontFamily: F.black },

  chipsRow: { gap: 8, paddingVertical: 4, paddingBottom: 12, flexDirection: 'row' },
  chip:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  chipText: { fontFamily: F.bold },

  usuarioCard:       { borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 0.5 },
  usuarioTopo:       { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  usuarioAvatar:     { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  usuarioAvatarText: { fontFamily: F.black },
  usuarioNome:       { fontFamily: F.black },
  usuarioEmail:      { fontFamily: F.medium, marginTop: 2 },
  usuarioDetalhe:    { fontFamily: F.semibold, marginTop: 1 },
  statusPill:        { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusPillText:    { fontFamily: F.black, letterSpacing: 0.4 },
  usuarioControles:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  seletorBtnSm:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 7, borderWidth: 0.5 },
  seletorBtnSmText:  { fontFamily: F.bold, flex: 1 },
  btnSalvarRow:      { width: 32, height: 32, borderRadius: 8, backgroundColor: CORES.verde, justifyContent: 'center', alignItems: 'center' },

  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet:    { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 32 },
  modalHandle:   { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitulo:   { fontFamily: F.black, marginBottom: 10 },
  seletorItem:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 0.5 },
  seletorItemText:{ fontFamily: F.bold },
});
