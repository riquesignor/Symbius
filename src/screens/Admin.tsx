import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  SafeAreaView, StatusBar, TextInput, ActivityIndicator,
  Modal, Animated, useWindowDimensions, Platform
} from 'react-native';
import { db } from '../config/firebaseConfig';
import {
  collection, query, orderBy, getDocs, updateDoc, doc
} from 'firebase/firestore';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LineChart, BarChart, PieChart, ProgressChart
} from 'react-native-chart-kit';

// ── Fonte Poppins ──
const F = {
  regular:  'Poppins_400Regular',
  medium:   'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold:     'Poppins_700Bold',
  black:    'Poppins_800ExtraBold',
};

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
  verde:           '#27ae60',
  vermelho:        '#e74c3c',
  laranja:         '#e67e22',
  roxo:            '#8e44ad',
  azulCeu:         '#3498db',
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
const STATUS_CORES: Record<number, string> = { 0: '#FFC82C', 1: '#27ae60', 2: '#e74c3c' };
const TIPOS_USUARIO = ['Aluno', 'Gremista', 'Administrador'];
const STATUS_OPCOES = [
  { value: 0, label: 'Pendente' },
  { value: 1, label: 'Ativo'    },
  { value: 2, label: 'Suspenso' },
];

const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

// ── Animação fade in ──
const FadeInView = ({ children, delay = 0, style }: any) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1, duration: 450, delay, useNativeDriver: true,
    }).start();
  }, []);
  return (
    <Animated.View style={[
      style,
      {
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0,1], outputRange: [16, 0] }) }],
      },
    ]}>
      {children}
    </Animated.View>
  );
};

// ── Counter animado ──
const AnimatedCounter = ({ value, style, duration = 1200 }: any) => {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const anim = new Animated.Value(0);
    const listener = anim.addListener(({ value: v }) => {
      setDisplay(Math.round(v));
    });
    Animated.timing(anim, {
      toValue: value, duration, useNativeDriver: false,
    }).start();
    return () => anim.removeListener(listener);
  }, [value]);
  return <Text style={style}>{display.toLocaleString('pt-BR')}</Text>;
};

export default function Admin({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const uid = route?.params?.uid;

  const [posts,    setPosts]    = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [abaAtiva, setAbaAtiva] = useState<'overview' | 'engagement' | 'usuarios'>('overview');

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

  // Filtro tipo de usuário
  const [filtroTipoU, setFiltroTipoU] = useState<string>('todos');

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

      const t: Record<string, string>  = {};
      const s: Record<string, number>  = {};
      us.forEach((u: any) => { t[u.uid] = u.tipo; s[u.uid] = u.status; });
      setEditTipo(t);
      setEditStatus(s);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // ── STATS ────────────────────────────────────────────────
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
    return {
      totalViews, totalAlunos, totalGremistas, totalAdmins,
      totalAtivos, totalPendentes, totalSuspensos,
      taxaEngaj, mediaViews,
    };
  }, [posts, usuarios]);

  // ── Top 5 ────────────────────────────────────────────────
  const top5     = [...posts].sort((a, b) => (b.visualizacoes || 0) - (a.visualizacoes || 0)).slice(0, 5);
  const maxViews = top5[0]?.visualizacoes || 1;

  // ── Posts por categoria (pizza) ──────────────────────────
  const postsPorCat = useMemo(() => {
    const map: Record<string, number> = {};
    posts.forEach(p => {
      const c = p.categoria || 'avisos';
      map[c] = (map[c] || 0) + 1;
    });
    return Object.entries(map).map(([cat, count]) => ({
      name: CAT_LABELS[cat] || cat,
      population: count,
      color: CAT_CORES[cat] || '#888',
      legendFontColor: CORES.azulEscuro,
      legendFontSize: 11,
    }));
  }, [posts]);

  // ── Views por categoria (barra horizontal) ──────────────
  const viewsPorCat = useMemo(() => {
    const map: Record<string, number> = {};
    posts.forEach(p => {
      const c = p.categoria || 'avisos';
      map[c] = (map[c] || 0) + (p.visualizacoes || 0);
    });
    const labels = Object.keys(map).map(k => CAT_LABELS[k] || k);
    const dados  = Object.values(map);
    return { labels, dados };
  }, [posts]);

  // ── Cadastros últimos 6 meses (linha) ───────────────────
  const cadastrosTimeline = useMemo(() => {
    const hoje = new Date();
    const labels: string[] = [];
    const dados:  number[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const label = MESES_ABREV[d.getMonth()];
      labels.push(label);

      const inicio = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      const fim    = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).getTime();
      const count  = usuarios.filter((u: any) => {
        if (!u.cadastrado_em) return false;
        const dt = u.cadastrado_em.toDate
          ? u.cadastrado_em.toDate().getTime()
          : new Date(u.cadastrado_em).getTime();
        return dt >= inicio && dt <= fim;
      }).length;
      dados.push(count);
    }
    return { labels, dados };
  }, [usuarios]);

  // ── Engajamento por categoria (progress) ────────────────
  const progressData = useMemo(() => {
    const labels: string[] = [];
    const data:   number[] = [];
    const max = Math.max(1, ...Object.values(
      posts.reduce((acc: Record<string, number>, p) => {
        const c = p.categoria || 'avisos';
        acc[c] = (acc[c] || 0) + (p.visualizacoes || 0);
        return acc;
      }, {})
    ));

    Object.keys(CAT_LABELS).forEach(cat => {
      const v = posts.filter(p => p.categoria === cat).reduce((s, p) => s + (p.visualizacoes || 0), 0);
      labels.push(CAT_LABELS[cat]);
      data.push(Math.min(1, v / max));
    });
    return { labels, data };
  }, [posts]);

  // ── Salvar usuário ───────────────────────────────────────
  const salvarUsuario = async (uid: string) => {
    setSalvando(prev => ({ ...prev, [uid]: true }));
    try {
      await updateDoc(doc(db, 'usuarios', uid), {
        tipo:   editTipo[uid],
        status: editStatus[uid],
      });
      setUsuarios(prev => prev.map((u: any) =>
        u.uid === uid ? { ...u, tipo: editTipo[uid], status: editStatus[uid] } : u
      ));
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
      await updateDoc(doc(db, 'usuarios', usuarioBuscado.uid), {
        tipo: cartaoTipo, status: cartaoStatus,
      });
      setUsuarios(prev => prev.map((u: any) =>
        u.uid === usuarioBuscado.uid ? { ...u, tipo: cartaoTipo, status: cartaoStatus } : u
      ));
      setToast(`${usuarioBuscado.nome_completo.split(' ')[0]} atualizado`);
    } catch { setToast('Falha ao salvar'); }
    finally { setSalvandoCartao(false); }
  };

  // ── Filtro de usuários ──────────────────────────────────
  const usuariosFiltrados = useMemo(() => {
    if (filtroTipoU === 'todos') return usuarios;
    if (filtroTipoU === 'pendentes') return usuarios.filter((u: any) => u.status === 0);
    if (filtroTipoU === 'suspensos') return usuarios.filter((u: any) => u.status === 2);
    return usuarios.filter((u: any) => u.tipo === filtroTipoU);
  }, [usuarios, filtroTipoU]);

  // ── Config dos gráficos ──────────────────────────────────
  const chartConfigBase = {
    backgroundColor:        CORES.branco,
    backgroundGradientFrom: CORES.branco,
    backgroundGradientTo:   CORES.branco,
    decimalPlaces:          0,
    color:                  (opacity = 1) => `rgba(11, 32, 70, ${opacity})`,
    labelColor:             (opacity = 1) => `rgba(141, 153, 174, ${opacity})`,
    style:                  { borderRadius: 16 },
    propsForDots:           { r: '5', strokeWidth: '2', stroke: CORES.rosa },
    propsForBackgroundLines:{ strokeDasharray: '', stroke: CORES.cinzaClaro, strokeWidth: 0.5 },
    propsForLabels:         { fontFamily: F.semibold, fontSize: 10 },
  };

  const chartConfigBar = {
    ...chartConfigBase,
    color: (opacity = 1) => `rgba(229, 28, 106, ${opacity})`,
    fillShadowGradient: CORES.rosa,
    fillShadowGradientOpacity: 1,
    barPercentage: 0.6,
  };

  if (loading) return (
    <View style={styles.centro}>
      <ActivityIndicator size="large" color={CORES.azulEscuro} />
      <Text style={styles.loadingText}>Carregando dashboard...</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={CORES.azulEscuro} />

      {/* TOAST */}
      {toast !== '' && (
        <View style={[styles.toast, { top: insets.top + 12 }]}>
          <Ionicons name="checkmark-circle" size={16} color={CORES.amarelo} />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      {/* HEADER PREMIUM */}
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <TouchableOpacity
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Index', params: { uid } }] })}
          style={styles.btnVoltar}
        >
          <Ionicons name="arrow-back" size={20} color={CORES.branco} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <View style={styles.headerEyebrowRow}>
            <View style={styles.headerDot} />
            <Text style={styles.headerEyebrow}>PAINEL RESTRITO</Text>
          </View>
          <Text style={styles.headerTitulo}>Dashboard Admin</Text>
        </View>
        <TouchableOpacity onPress={carregar} style={styles.btnRefresh}>
          <Ionicons name="refresh" size={18} color={CORES.branco} />
        </TouchableOpacity>
      </View>

      {/* ABAS */}
      <View style={styles.abas}>
        {[
          { key: 'overview',   label: 'Visão Geral', icon: 'grid'        },
          { key: 'engagement', label: 'Engajamento', icon: 'trending-up' },
          { key: 'usuarios',   label: 'Usuários',    icon: 'people'      },
        ].map(a => (
          <TouchableOpacity
            key={a.key}
            style={[styles.aba, abaAtiva === a.key && styles.abaAtiva]}
            onPress={() => setAbaAtiva(a.key as any)}
          >
            <Ionicons
              name={a.icon as any}
              size={14}
              color={abaAtiva === a.key ? CORES.azulEscuro : CORES.textoSec}
            />
            <Text style={[styles.abaText, abaAtiva === a.key && styles.abaTextAtiva]}>
              {a.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 60 }}
      >

        {/* ═══════ ABA OVERVIEW ═══════ */}
        {abaAtiva === 'overview' && (
          <View style={{ padding: 16 }}>

            {/* HERO STATS */}
            <FadeInView delay={0}>
              <View style={styles.heroCard}>
                <View>
                  <Text style={styles.heroEyebrow}>TOTAL DE VISUALIZAÇÕES</Text>
                  <AnimatedCounter
                    value={stats.totalViews}
                    style={styles.heroValor}
                  />
                  <View style={styles.heroBadges}>
                    <View style={styles.heroBadge}>
                      <Ionicons name="trending-up" size={10} color={CORES.verde} />
                      <Text style={[styles.heroBadgeText, { color: CORES.verde }]}>
                        {stats.mediaViews}/post
                      </Text>
                    </View>
                    <View style={styles.heroBadge}>
                      <Ionicons name="flash" size={10} color={CORES.amarelo} />
                      <Text style={[styles.heroBadgeText, { color: CORES.amarelo }]}>
                        {stats.taxaEngaj}% engaj.
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.heroIconWrap}>
                  <FontAwesome5 name="chart-line" size={28} color={CORES.amarelo} />
                </View>
              </View>
            </FadeInView>

            {/* MINI STATS GRID */}
            <FadeInView delay={120}>
              <View style={styles.miniGrid}>
                <View style={[styles.miniCard, { borderLeftColor: CORES.azulCeu }]}>
                  <View style={[styles.miniIcon, { backgroundColor: CORES.azulCeu + '15' }]}>
                    <Ionicons name="people" size={16} color={CORES.azulCeu} />
                  </View>
                  <AnimatedCounter value={usuarios.length} style={styles.miniValor} />
                  <Text style={styles.miniLabel}>Usuários</Text>
                </View>

                <View style={[styles.miniCard, { borderLeftColor: CORES.verde }]}>
                  <View style={[styles.miniIcon, { backgroundColor: CORES.verde + '15' }]}>
                    <Ionicons name="checkmark-circle" size={16} color={CORES.verde} />
                  </View>
                  <AnimatedCounter value={stats.totalAtivos} style={styles.miniValor} />
                  <Text style={styles.miniLabel}>Ativos</Text>
                </View>

                <View style={[styles.miniCard, { borderLeftColor: CORES.amarelo }]}>
                  <View style={[styles.miniIcon, { backgroundColor: CORES.amarelo + '20' }]}>
                    <Ionicons name="time" size={16} color={CORES.laranja} />
                  </View>
                  <AnimatedCounter value={stats.totalPendentes} style={styles.miniValor} />
                  <Text style={styles.miniLabel}>Pendentes</Text>
                </View>

                <View style={[styles.miniCard, { borderLeftColor: CORES.rosa }]}>
                  <View style={[styles.miniIcon, { backgroundColor: CORES.rosa + '15' }]}>
                    <Ionicons name="document-text" size={16} color={CORES.rosa} />
                  </View>
                  <AnimatedCounter value={posts.length} style={styles.miniValor} />
                  <Text style={styles.miniLabel}>Posts</Text>
                </View>
              </View>
            </FadeInView>

            {/* GRÁFICO LINHA — CADASTROS */}
            <FadeInView delay={240}>
              <View style={styles.chartCard}>
                <View style={styles.chartHeader}>
                  <View>
                    <Text style={styles.chartEyebrow}>ÚLTIMOS 6 MESES</Text>
                    <Text style={styles.chartTitulo}>Crescimento de cadastros</Text>
                  </View>
                  <View style={styles.chartLegenda}>
                    <View style={[styles.dotCor, { backgroundColor: CORES.rosa }]} />
                    <Text style={styles.chartLegendaText}>Novos usuários</Text>
                  </View>
                </View>

                <LineChart
                  data={{
                    labels:   cadastrosTimeline.labels,
                    datasets: [{ data: cadastrosTimeline.dados.length ? cadastrosTimeline.dados : [0,0,0,0,0,0] }],
                  }}
                  width={winW - 64}
                  height={180}
                  chartConfig={chartConfigBase}
                  bezier
                  style={styles.chartGraph}
                  withInnerLines={true}
                  withOuterLines={false}
                  withVerticalLines={false}
                  fromZero
                />
              </View>
            </FadeInView>

            {/* PIZZA + DISTRIBUIÇÃO */}
            <FadeInView delay={360}>
              <View style={styles.chartCard}>
                <View style={styles.chartHeader}>
                  <View>
                    <Text style={styles.chartEyebrow}>DISTRIBUIÇÃO</Text>
                    <Text style={styles.chartTitulo}>Posts por categoria</Text>
                  </View>
                </View>

                {postsPorCat.length > 0 ? (
                  <PieChart
                    data={postsPorCat}
                    width={winW - 64}
                    height={180}
                    chartConfig={chartConfigBase}
                    accessor="population"
                    backgroundColor="transparent"
                    paddingLeft="10"
                    absolute
                  />
                ) : (
                  <View style={styles.chartVazio}>
                    <Ionicons name="pie-chart-outline" size={32} color={CORES.cinzaClaro} />
                    <Text style={styles.chartVazioText}>Sem dados ainda</Text>
                  </View>
                )}
              </View>
            </FadeInView>

            {/* CARDS DE STATUS */}
            <FadeInView delay={480}>
              <Text style={styles.secaoTituloGrande}>Status dos usuários</Text>
              <View style={styles.statusGrid}>
                <View style={[styles.statusCard, { backgroundColor: CORES.verde + '12' }]}>
                  <View style={[styles.statusBolha, { backgroundColor: CORES.verde }]}>
                    <Ionicons name="checkmark" size={20} color="#FFF" />
                  </View>
                  <AnimatedCounter value={stats.totalAtivos} style={[styles.statusN, { color: CORES.verde }]} />
                  <Text style={styles.statusL}>Ativos</Text>
                  <View style={styles.statusBarra}>
                    <View style={[styles.statusBarraFill, {
                      width: `${(stats.totalAtivos / Math.max(1, usuarios.length)) * 100}%`,
                      backgroundColor: CORES.verde
                    }]} />
                  </View>
                </View>

                <View style={[styles.statusCard, { backgroundColor: CORES.amarelo + '20' }]}>
                  <View style={[styles.statusBolha, { backgroundColor: CORES.laranja }]}>
                    <Ionicons name="hourglass" size={18} color="#FFF" />
                  </View>
                  <AnimatedCounter value={stats.totalPendentes} style={[styles.statusN, { color: CORES.laranja }]} />
                  <Text style={styles.statusL}>Pendentes</Text>
                  <View style={styles.statusBarra}>
                    <View style={[styles.statusBarraFill, {
                      width: `${(stats.totalPendentes / Math.max(1, usuarios.length)) * 100}%`,
                      backgroundColor: CORES.laranja
                    }]} />
                  </View>
                </View>

                <View style={[styles.statusCard, { backgroundColor: CORES.vermelho + '12' }]}>
                  <View style={[styles.statusBolha, { backgroundColor: CORES.vermelho }]}>
                    <Ionicons name="close" size={20} color="#FFF" />
                  </View>
                  <AnimatedCounter value={stats.totalSuspensos} style={[styles.statusN, { color: CORES.vermelho }]} />
                  <Text style={styles.statusL}>Suspensos</Text>
                  <View style={styles.statusBarra}>
                    <View style={[styles.statusBarraFill, {
                      width: `${(stats.totalSuspensos / Math.max(1, usuarios.length)) * 100}%`,
                      backgroundColor: CORES.vermelho
                    }]} />
                  </View>
                </View>
              </View>
            </FadeInView>

            {/* COMPOSIÇÃO USUÁRIOS */}
            <FadeInView delay={600}>
              <View style={styles.chartCard}>
                <View style={styles.chartHeader}>
                  <View>
                    <Text style={styles.chartEyebrow}>COMPOSIÇÃO</Text>
                    <Text style={styles.chartTitulo}>Tipos de usuário</Text>
                  </View>
                </View>

                <View style={styles.composicaoLista}>
                  {[
                    { tipo: 'Aluno',        n: stats.totalAlunos,    cor: CORES.azulCeu, icon: 'school' },
                    { tipo: 'Gremista',     n: stats.totalGremistas, cor: CORES.amarelo, icon: 'star' },
                    { tipo: 'Administrador',n: stats.totalAdmins,    cor: CORES.rosa,    icon: 'shield' },
                  ].map(item => {
                    const pct = Math.round((item.n / Math.max(1, usuarios.length)) * 100);
                    return (
                      <View key={item.tipo} style={styles.composicaoItem}>
                        <View style={[styles.composicaoIcon, { backgroundColor: item.cor + '15' }]}>
                          <Ionicons name={item.icon as any} size={14} color={item.cor} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={styles.composicaoTopo}>
                            <Text style={styles.composicaoNome}>{item.tipo}</Text>
                            <Text style={styles.composicaoValor}>{item.n} <Text style={{ color: CORES.textoSec, fontFamily: F.regular }}>· {pct}%</Text></Text>
                          </View>
                          <View style={styles.composicaoBarra}>
                            <View style={[styles.composicaoBarraFill, { width: `${pct}%`, backgroundColor: item.cor }]} />
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            </FadeInView>
          </View>
        )}

        {/* ═══════ ABA ENGAGEMENT ═══════ */}
        {abaAtiva === 'engagement' && (
          <View style={{ padding: 16 }}>

            {/* GRÁFICO BARRA — VIEWS POR CATEGORIA */}
            <FadeInView delay={0}>
              <View style={styles.chartCard}>
                <View style={styles.chartHeader}>
                  <View>
                    <Text style={styles.chartEyebrow}>POR CATEGORIA</Text>
                    <Text style={styles.chartTitulo}>Visualizações totais</Text>
                  </View>
                </View>

                {viewsPorCat.dados.length > 0 ? (
                  <BarChart
                    data={{
                      labels:   viewsPorCat.labels,
                      datasets: [{ data: viewsPorCat.dados }],
                    }}
                    width={winW - 64}
                    height={210}
                    chartConfig={chartConfigBar}
                    style={styles.chartGraph}
                    fromZero
                    showValuesOnTopOfBars
                    withInnerLines={false}
                    yAxisLabel=""
                    yAxisSuffix=""
                  />
                ) : (
                  <View style={styles.chartVazio}>
                    <Ionicons name="bar-chart-outline" size={32} color={CORES.cinzaClaro} />
                    <Text style={styles.chartVazioText}>Sem dados ainda</Text>
                  </View>
                )}
              </View>
            </FadeInView>

            {/* PROGRESS — ENGAJAMENTO POR CATEGORIA */}
            <FadeInView delay={120}>
              <View style={styles.chartCard}>
                <View style={styles.chartHeader}>
                  <View>
                    <Text style={styles.chartEyebrow}>RANKING RELATIVO</Text>
                    <Text style={styles.chartTitulo}>Performance comparada</Text>
                  </View>
                </View>

                {progressData.data.some(d => d > 0) ? (
                  <ProgressChart
                    data={progressData}
                    width={winW - 64}
                    height={200}
                    strokeWidth={12}
                    radius={26}
                    chartConfig={{
                      ...chartConfigBase,
                      color: (opacity = 1) => `rgba(229, 28, 106, ${opacity})`,
                    }}
                    hideLegend={false}
                  />
                ) : (
                  <View style={styles.chartVazio}>
                    <Ionicons name="speedometer-outline" size={32} color={CORES.cinzaClaro} />
                    <Text style={styles.chartVazioText}>Sem dados ainda</Text>
                  </View>
                )}
              </View>
            </FadeInView>

            {/* TOP 5 PREMIUM */}
            <FadeInView delay={240}>
              <View style={styles.chartCard}>
                <View style={styles.chartHeader}>
                  <View>
                    <Text style={styles.chartEyebrow}>HALL DA FAMA</Text>
                    <Text style={styles.chartTitulo}>Top 5 posts</Text>
                  </View>
                  <View style={styles.trofeu}>
                    <FontAwesome5 name="trophy" size={14} color={CORES.amarelo} />
                  </View>
                </View>

                {top5.length === 0 ? (
                  <View style={styles.chartVazio}>
                    <Ionicons name="trophy-outline" size={32} color={CORES.cinzaClaro} />
                    <Text style={styles.chartVazioText}>Sem posts ainda</Text>
                  </View>
                ) : top5.map((p: any, i: number) => {
                  const corPos = i === 0 ? CORES.amarelo : i === 1 ? '#A8B2C8' : i === 2 ? '#CD7F32' : CORES.cinzaClaro;
                  const pctBar = Math.round(((p.visualizacoes || 0) / maxViews) * 100);

                  return (
                    <View key={p.id} style={styles.top5ItemPro}>
                      <View style={[styles.top5Medalha, { backgroundColor: corPos + '25', borderColor: corPos }]}>
                        <Text style={[styles.top5Pos, { color: i < 3 ? corPos : CORES.textoSec }]}>
                          {i + 1}
                        </Text>
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.top5Nome} numberOfLines={1}>{p.titulo}</Text>
                        <View style={styles.top5MetaRow}>
                          <View style={[styles.top5Cat, { backgroundColor: (CAT_CORES[p.categoria] || '#888') + '20' }]}>
                            <Text style={[styles.top5CatText, { color: CAT_CORES[p.categoria] || '#888' }]}>
                              {CAT_LABELS[p.categoria] || p.categoria}
                            </Text>
                          </View>
                          <View style={styles.top5Views}>
                            <Ionicons name="eye" size={11} color={CORES.rosa} />
                            <Text style={styles.top5ViewsText}>{p.visualizacoes || 0}</Text>
                          </View>
                        </View>
                        <View style={styles.barraWrap}>
                          <View style={[styles.barra, { width: `${pctBar}%` }]} />
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </FadeInView>

          </View>
        )}

        {/* ═══════ ABA USUÁRIOS ═══════ */}
        {abaAtiva === 'usuarios' && (
          <View style={{ padding: 16 }}>

            {/* BUSCA */}
            <FadeInView delay={0}>
              <View style={styles.chartCard}>
                <Text style={styles.chartEyebrow}>BUSCA RÁPIDA</Text>
                <Text style={[styles.chartTitulo, { marginBottom: 14 }]}>Encontrar por RA</Text>

                <View style={styles.buscaRow}>
                  <View style={styles.buscaInputWrap}>
                    <Ionicons name="search" size={16} color={CORES.textoSec} />
                    <TextInput
                      style={styles.buscaInput}
                      placeholder="Digite o RA do aluno..."
                      placeholderTextColor={CORES.textoSec}
                      value={buscaRA}
                      onChangeText={setBuscaRA}
                      autoCapitalize="characters"
                      onSubmitEditing={buscarRA}
                    />
                  </View>
                  <TouchableOpacity style={styles.btnBuscar} onPress={buscarRA}>
                    <Text style={styles.btnBuscarText}>Buscar</Text>
                  </TouchableOpacity>
                </View>

                {usuarioBuscado && (
                  <FadeInView delay={100}>
                    <View style={styles.cartaoEncontrado}>
                      <View style={styles.cartaoEncontradoTopo}>
                        <View style={styles.cartaoAvatar}>
                          <Text style={styles.cartaoAvatarText}>
                            {usuarioBuscado.nome_completo?.charAt(0)?.toUpperCase() || '?'}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cartaoNome}>{usuarioBuscado.nome_completo}</Text>
                          <Text style={styles.cartaoEmail}>{usuarioBuscado.email_escolar}</Text>
                        </View>
                      </View>

                      <View style={styles.cartaoInfoRow}>
                        <View style={styles.cartaoInfoBox}>
                          <Text style={styles.cartaoInfoLabel}>RA</Text>
                          <Text style={styles.cartaoInfoValor}>{usuarioBuscado.ra || '—'}</Text>
                        </View>
                        <View style={styles.cartaoInfoBox}>
                          <Text style={styles.cartaoInfoLabel}>TURMA</Text>
                          <Text style={styles.cartaoInfoValor}>{usuarioBuscado.turma || '—'}</Text>
                        </View>
                      </View>

                      <View style={styles.cartaoControles}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.campoLabel}>TIPO</Text>
                          <TouchableOpacity style={styles.seletorBtn} onPress={() => setModalCartaoTipo(true)}>
                            <Text style={styles.seletorBtnText}>{cartaoTipo}</Text>
                            <Ionicons name="chevron-down" size={14} color={CORES.textoSec} />
                          </TouchableOpacity>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.campoLabel}>STATUS</Text>
                          <TouchableOpacity style={styles.seletorBtn} onPress={() => setModalCartaoSts(true)}>
                            <View style={[styles.dotStatus, { backgroundColor: STATUS_CORES[cartaoStatus] }]} />
                            <Text style={styles.seletorBtnText}>{STATUS_LABELS[cartaoStatus]}</Text>
                            <Ionicons name="chevron-down" size={14} color={CORES.textoSec} />
                          </TouchableOpacity>
                        </View>
                      </View>

                      <TouchableOpacity style={styles.btnSalvarCartao} onPress={salvarCartao} disabled={salvandoCartao}>
                        {salvandoCartao
                          ? <ActivityIndicator color="#FFF" size="small" />
                          : <>
                              <Ionicons name="save" size={14} color="#FFF" />
                              <Text style={styles.btnSalvarCartaoText}>Salvar Alterações</Text>
                            </>
                        }
                      </TouchableOpacity>
                    </View>
                  </FadeInView>
                )}
              </View>
            </FadeInView>

            {/* FILTROS */}
            <FadeInView delay={120}>
              <View style={styles.chartCard}>
                <View style={styles.chartHeader}>
                  <View>
                    <Text style={styles.chartEyebrow}>GERENCIAR</Text>
                    <Text style={styles.chartTitulo}>
                      {usuariosFiltrados.length} usuário{usuariosFiltrados.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipsRow}
                >
                  {[
                    { key: 'todos',         label: 'Todos',          icon: 'grid'         },
                    { key: 'Aluno',         label: 'Alunos',         icon: 'school'       },
                    { key: 'Gremista',      label: 'Gremistas',      icon: 'star'         },
                    { key: 'Administrador', label: 'Admins',         icon: 'shield'       },
                    { key: 'pendentes',     label: 'Pendentes',      icon: 'time'         },
                    { key: 'suspensos',     label: 'Suspensos',      icon: 'close-circle' },
                  ].map(c => {
                    const ativo = filtroTipoU === c.key;
                    return (
                      <TouchableOpacity
                        key={c.key}
                        style={[styles.chip, ativo && styles.chipAtivo]}
                        onPress={() => setFiltroTipoU(c.key)}
                      >
                        <Ionicons
                          name={c.icon as any}
                          size={11}
                          color={ativo ? CORES.branco : CORES.textoSec}
                        />
                        <Text style={[styles.chipText, ativo && styles.chipTextAtivo]}>
                          {c.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* LISTA */}
                {usuariosFiltrados.map((u: any, i: number) => (
                  <FadeInView key={u.uid} delay={i * 30}>
                    <View style={styles.usuarioCard}>
                      <View style={styles.usuarioTopo}>
                        <View style={styles.usuarioAvatar}>
                          <Text style={styles.usuarioAvatarText}>
                            {u.nome_completo?.charAt(0)?.toUpperCase() || '?'}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.usuarioNome} numberOfLines={1}>{u.nome_completo || '—'}</Text>
                          <Text style={styles.usuarioEmail} numberOfLines={1}>{u.email_escolar || ''}</Text>
                          <Text style={styles.usuarioDetalhe}>{u.ra || '—'} · {u.turma || '—'}</Text>
                        </View>
                        <View style={[styles.statusPill, { backgroundColor: STATUS_CORES[u.status] + '20' }]}>
                          <View style={[styles.dotStatus, { backgroundColor: STATUS_CORES[u.status] }]} />
                          <Text style={[styles.statusPillText, { color: STATUS_CORES[u.status] }]}>
                            {STATUS_LABELS[u.status]}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.usuarioControles}>
                        <TouchableOpacity
                          style={styles.seletorBtnSm}
                          onPress={() => { setModalUidAlvo(u.uid); setModalTipo(true); }}
                        >
                          <Text style={styles.seletorBtnSmText}>{editTipo[u.uid] || u.tipo}</Text>
                          <Ionicons name="chevron-down" size={11} color={CORES.textoSec} />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.seletorBtnSm}
                          onPress={() => { setModalUidAlvo(u.uid); setModalStatus(true); }}
                        >
                          <View style={[styles.dotStatus, { backgroundColor: STATUS_CORES[editStatus[u.uid] ?? u.status] }]} />
                          <Text style={styles.seletorBtnSmText}>{STATUS_LABELS[editStatus[u.uid] ?? u.status]}</Text>
                          <Ionicons name="chevron-down" size={11} color={CORES.textoSec} />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.btnSalvarRow}
                          onPress={() => salvarUsuario(u.uid)}
                          disabled={salvando[u.uid]}
                        >
                          {salvando[u.uid]
                            ? <ActivityIndicator color="#FFF" size="small" />
                            : <Ionicons name="checkmark" size={14} color="#FFF" />
                          }
                        </TouchableOpacity>
                      </View>
                    </View>
                  </FadeInView>
                ))}
              </View>
            </FadeInView>
          </View>
        )}
      </ScrollView>

      {/* MODAIS */}
      <Modal visible={modalTipo} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitulo}>Tipo de Usuário</Text>
            {TIPOS_USUARIO.map(t => (
              <TouchableOpacity
                key={t}
                style={styles.seletorItem}
                onPress={() => {
                  setEditTipo(prev => ({ ...prev, [modalUidAlvo]: t }));
                  setModalTipo(false);
                }}
              >
                <Text style={styles.seletorItemText}>{t}</Text>
                {editTipo[modalUidAlvo] === t && <Ionicons name="checkmark" size={18} color={CORES.azulEscuro} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      <Modal visible={modalStatus} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitulo}>Status</Text>
            {STATUS_OPCOES.map(s => (
              <TouchableOpacity
                key={s.value}
                style={styles.seletorItem}
                onPress={() => {
                  setEditStatus(prev => ({ ...prev, [modalUidAlvo]: s.value }));
                  setModalStatus(false);
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={[styles.dotStatus, { backgroundColor: STATUS_CORES[s.value] }]} />
                  <Text style={styles.seletorItemText}>{s.label}</Text>
                </View>
                {editStatus[modalUidAlvo] === s.value && <Ionicons name="checkmark" size={18} color={CORES.azulEscuro} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      <Modal visible={modalCartaoTipo} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitulo}>Tipo de Usuário</Text>
            {TIPOS_USUARIO.map(t => (
              <TouchableOpacity
                key={t}
                style={styles.seletorItem}
                onPress={() => { setCartaoTipo(t); setModalCartaoTipo(false); }}
              >
                <Text style={styles.seletorItemText}>{t}</Text>
                {cartaoTipo === t && <Ionicons name="checkmark" size={18} color={CORES.azulEscuro} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      <Modal visible={modalCartaoSts} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitulo}>Status</Text>
            {STATUS_OPCOES.map(s => (
              <TouchableOpacity
                key={s.value}
                style={styles.seletorItem}
                onPress={() => { setCartaoStatus(s.value); setModalCartaoSts(false); }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={[styles.dotStatus, { backgroundColor: STATUS_CORES[s.value] }]} />
                  <Text style={styles.seletorItemText}>{s.label}</Text>
                </View>
                {cartaoStatus === s.value && <Ionicons name="checkmark" size={18} color={CORES.azulEscuro} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: CORES.fundo },
  centro:             { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: CORES.fundo, gap: 14 },
  loadingText:        { fontSize: 13, color: CORES.textoSec, fontFamily: F.semibold },

  // TOAST
  toast:              { position: 'absolute', alignSelf: 'center', backgroundColor: CORES.azulEscuro, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 24, zIndex: 9999, elevation: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  toastText:          { color: CORES.branco, fontFamily: F.bold, fontSize: 12 },

  // HEADER
  header:             { backgroundColor: CORES.azulEscuro, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 16, gap: 12 },
  btnVoltar:          { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  headerEyebrowRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerDot:          { width: 6, height: 6, borderRadius: 3, backgroundColor: CORES.amarelo },
  headerEyebrow:      { color: 'rgba(255,255,255,0.7)', fontSize: 9, fontFamily: F.black, letterSpacing: 1.6 },
  headerTitulo:       { color: CORES.branco, fontSize: 19, fontFamily: F.black, letterSpacing: -0.4, marginTop: 2 },
  btnRefresh:         { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },

  // ABAS
  abas:               { flexDirection: 'row', backgroundColor: CORES.branco, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: CORES.cinzaClaro },
  aba:                { flex: 1, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 5 },
  abaAtiva:           { borderBottomWidth: 3, borderBottomColor: CORES.rosa },
  abaText:            { fontSize: 11, fontFamily: F.bold, color: CORES.textoSec },
  abaTextAtiva:       { color: CORES.azulEscuro },

  // HERO CARD
  heroCard:           { backgroundColor: CORES.azulEscuro, borderRadius: 22, padding: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, elevation: 4, shadowColor: CORES.azulEscuro, shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, overflow: 'hidden' },
  heroEyebrow:        { color: 'rgba(255,255,255,0.6)', fontSize: 9, fontFamily: F.black, letterSpacing: 1.4, marginBottom: 6 },
  heroValor:          { color: CORES.branco, fontSize: 38, fontFamily: F.black, letterSpacing: -1, lineHeight: 42 },
  heroBadges:         { flexDirection: 'row', gap: 6, marginTop: 8 },
  heroBadge:          { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  heroBadgeText:      { fontSize: 10, fontFamily: F.bold },
  heroIconWrap:       { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },

  // MINI GRID
  miniGrid:           { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  miniCard:           { width: '48.5%', backgroundColor: CORES.branco, borderRadius: 14, padding: 12, borderLeftWidth: 3, gap: 6 },
  miniIcon:           { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  miniValor:          { fontSize: 22, fontFamily: F.black, color: CORES.azulEscuro, letterSpacing: -0.5 },
  miniLabel:          { fontSize: 10, fontFamily: F.bold, color: CORES.textoSec, letterSpacing: 0.6, textTransform: 'uppercase' },

  // CHART CARD
  chartCard:          { backgroundColor: CORES.branco, borderRadius: 18, padding: 16, marginBottom: 14, elevation: 2, shadowColor: CORES.azulEscuro, shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  chartHeader:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  chartEyebrow:       { fontSize: 9, fontFamily: F.black, color: CORES.rosa, letterSpacing: 1.2 },
  chartTitulo:        { fontSize: 15, fontFamily: F.black, color: CORES.azulEscuro, marginTop: 2, letterSpacing: -0.2 },
  chartLegenda:       { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: CORES.fundo, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  chartLegendaText:   { fontSize: 10, fontFamily: F.semibold, color: CORES.textoSec },
  dotCor:             { width: 8, height: 8, borderRadius: 4 },
  chartGraph:         { borderRadius: 14, marginVertical: 4, marginLeft: -10 },
  chartVazio:         { alignItems: 'center', paddingVertical: 30, gap: 8 },
  chartVazioText:     { fontSize: 12, color: CORES.textoSec, fontFamily: F.medium },
  trofeu:             { width: 32, height: 32, borderRadius: 10, backgroundColor: CORES.amarelo + '20', justifyContent: 'center', alignItems: 'center' },

  // SECAO TITULO GRANDE
  secaoTituloGrande:  { fontSize: 13, fontFamily: F.black, color: CORES.azulEscuro, marginBottom: 10, marginTop: 4, letterSpacing: -0.2 },

  // STATUS GRID
  statusGrid:         { flexDirection: 'row', gap: 8, marginBottom: 14 },
  statusCard:         { flex: 1, borderRadius: 16, padding: 14, alignItems: 'center', gap: 6 },
  statusBolha:        { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  statusN:            { fontSize: 24, fontFamily: F.black, letterSpacing: -0.5 },
  statusL:            { fontSize: 10, fontFamily: F.bold, color: CORES.textoSec, letterSpacing: 0.6, textTransform: 'uppercase' },
  statusBarra:        { width: '100%', height: 3, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 2, marginTop: 8, overflow: 'hidden' },
  statusBarraFill:    { height: 3, borderRadius: 2 },

  // COMPOSIÇÃO
  composicaoLista:    { gap: 14 },
  composicaoItem:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  composicaoIcon:     { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  composicaoTopo:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  composicaoNome:     { fontSize: 13, fontFamily: F.bold, color: CORES.azulEscuro },
  composicaoValor:    { fontSize: 13, fontFamily: F.black, color: CORES.azulEscuro },
  composicaoBarra:    { height: 5, backgroundColor: CORES.cinzaClaro, borderRadius: 3, overflow: 'hidden' },
  composicaoBarraFill:{ height: 5, borderRadius: 3 },

  // TOP 5
  top5ItemPro:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: CORES.cinzaClaro },
  top5Medalha:        { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5 },
  top5Pos:            { fontSize: 14, fontFamily: F.black },
  top5Nome:           { fontSize: 13, fontFamily: F.bold, color: CORES.azulEscuro, marginBottom: 4 },
  top5MetaRow:        { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  top5Cat:            { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  top5CatText:        { fontSize: 9, fontFamily: F.black, letterSpacing: 0.4 },
  top5Views:          { flexDirection: 'row', alignItems: 'center', gap: 3 },
  top5ViewsText:      { fontSize: 11, color: CORES.rosa, fontFamily: F.bold },
  barraWrap:          { height: 4, backgroundColor: CORES.cinzaClaro, borderRadius: 2, overflow: 'hidden' },
  barra:              { height: 4, backgroundColor: CORES.azulEscuro, borderRadius: 2 },

  // BUSCA
  buscaRow:           { flexDirection: 'row', gap: 8 },
  buscaInputWrap:     { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: CORES.fundo, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: CORES.cinzaClaro },
  buscaInput:         { flex: 1, paddingVertical: 12, fontSize: 13, color: CORES.azulEscuro, fontFamily: F.medium },
  btnBuscar:          { backgroundColor: CORES.azulEscuro, borderRadius: 12, paddingHorizontal: 18, justifyContent: 'center', alignItems: 'center' },
  btnBuscarText:      { color: CORES.branco, fontFamily: F.black, fontSize: 12 },

  // CARTÃO ENCONTRADO
  cartaoEncontrado:       { marginTop: 14, padding: 16, backgroundColor: CORES.fundo, borderRadius: 14, borderWidth: 1, borderColor: CORES.cinzaClaro },
  cartaoEncontradoTopo:   { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  cartaoAvatar:           { width: 44, height: 44, borderRadius: 22, backgroundColor: CORES.rosa, justifyContent: 'center', alignItems: 'center' },
  cartaoAvatarText:       { color: CORES.branco, fontSize: 18, fontFamily: F.black },
  cartaoNome:             { fontSize: 14, fontFamily: F.black, color: CORES.azulEscuro },
  cartaoEmail:            { fontSize: 11, color: CORES.textoSec, fontFamily: F.medium, marginTop: 2 },
  cartaoInfoRow:          { flexDirection: 'row', gap: 8, marginBottom: 12 },
  cartaoInfoBox:          { flex: 1, backgroundColor: CORES.branco, borderRadius: 10, padding: 10 },
  cartaoInfoLabel:        { fontSize: 9, fontFamily: F.black, color: CORES.textoSec, letterSpacing: 0.8 },
  cartaoInfoValor:        { fontSize: 14, fontFamily: F.bold, color: CORES.azulEscuro, marginTop: 3 },
  cartaoControles:        { flexDirection: 'row', gap: 8, marginBottom: 12 },
  campoLabel:             { fontSize: 9, fontFamily: F.black, color: CORES.textoSec, letterSpacing: 0.8, marginBottom: 5 },
  seletorBtn:             { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'space-between', backgroundColor: CORES.branco, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: CORES.cinzaClaro },
  seletorBtnText:         { fontSize: 12, fontFamily: F.bold, color: CORES.azulEscuro, flex: 1 },
  dotStatus:              { width: 8, height: 8, borderRadius: 4 },
  btnSalvarCartao:        { flexDirection: 'row', gap: 6, backgroundColor: CORES.azulEscuro, borderRadius: 12, paddingVertical: 12, justifyContent: 'center', alignItems: 'center' },
  btnSalvarCartaoText:    { color: CORES.branco, fontFamily: F.black, fontSize: 13 },

  // CHIPS
  chipsRow:           { gap: 8, paddingVertical: 4, paddingBottom: 12, flexDirection: 'row' },
  chip:               { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: CORES.fundo, borderWidth: 1, borderColor: CORES.cinzaClaro },
  chipAtivo:          { backgroundColor: CORES.azulEscuro, borderColor: CORES.azulEscuro },
  chipText:           { fontSize: 11, fontFamily: F.bold, color: CORES.textoSec },
  chipTextAtivo:      { color: CORES.branco },

  // USUÁRIO CARD
  usuarioCard:        { backgroundColor: CORES.fundo, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 0.5, borderColor: CORES.cinzaClaro },
  usuarioTopo:        { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  usuarioAvatar:      { width: 40, height: 40, borderRadius: 20, backgroundColor: CORES.azulEscuro, justifyContent: 'center', alignItems: 'center' },
  usuarioAvatarText:  { color: CORES.branco, fontSize: 15, fontFamily: F.black },
  usuarioNome:        { fontSize: 13, fontFamily: F.black, color: CORES.azulEscuro },
  usuarioEmail:       { fontSize: 11, color: CORES.textoSec, fontFamily: F.medium, marginTop: 2 },
  usuarioDetalhe:     { fontSize: 10, color: CORES.textoSec, fontFamily: F.semibold, marginTop: 1 },
  statusPill:         { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusPillText:     { fontSize: 9, fontFamily: F.black, letterSpacing: 0.4 },
  usuarioControles:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  seletorBtnSm:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4, backgroundColor: CORES.branco, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 7, borderWidth: 0.5, borderColor: CORES.cinzaClaro },
  seletorBtnSmText:   { fontSize: 10, fontFamily: F.bold, color: CORES.azulEscuro, flex: 1 },
  btnSalvarRow:       { width: 32, height: 32, borderRadius: 8, backgroundColor: CORES.verde, justifyContent: 'center', alignItems: 'center' },

  // MODAIS
  modalOverlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet:         { backgroundColor: CORES.branco, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 32 },
  modalHandle:        { width: 40, height: 4, backgroundColor: CORES.cinzaClaro, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitulo:        { fontSize: 16, fontFamily: F.black, color: CORES.azulEscuro, marginBottom: 10 },
  seletorItem:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: CORES.cinzaClaro },
  seletorItemText:    { fontSize: 14, fontFamily: F.bold, color: CORES.azulEscuro },
});