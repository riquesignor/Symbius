import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  StatusBar, TextInput, ActivityIndicator,
  Image, FlatList, Dimensions, Modal,
} from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { db } from '../config/firebaseConfig';
import {
  doc, getDoc, getDocs, collection, query, where, orderBy, onSnapshot,
  updateDoc, increment, arrayUnion,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { calcularNivel, calcularProgressoXp } from '../utils/gamification';
import { awardDailyCheckIn, CheckInResult, LevelUpInfo } from '../services/gamificationService';
import { useNotificacao } from '../contexts/NotificacaoProvider';
import { F } from '../constants/theme';
import { CORES_SYMBIUS } from './Boasvindas';
import NivelUpSymbiusModal from '../components/NivelUpSymbiusModal';
import SymbiusTabBar from '../components/SymbiusTabBar';

// ══════════════════════════════════════════════════════════════════════
// Home ("Symbius"), ligada ao back-end atual (mesma coleção `usuarios`, mesmo
// serviço de gamificação, mesma coleção `posts` do mural original). As
// funções de mural/post/admin/notificações do Index original foram
// restauradas aqui (com o visual Symbius) a partir de Index.legado.tsx, que
// continua guardado como referência.
// ══════════════════════════════════════════════════════════════════════

const { width } = Dimensions.get('window');
const PAD_H = 20;
const DESTAQUE_W = (width - PAD_H * 2 - 12) / 2;
const LARGURA_ANTIGO = (width - 44 - 12) / 2; // largura de card dentro do notifSheet (padding 22 de cada lado)

const DIAS_VALIDADE_POST = 30;
const HIT_SLOP_SM = { top: 10, bottom: 10, left: 10, right: 10 };
const HIT_SLOP_MD = { top: 14, bottom: 14, left: 14, right: 14 };
const HIT_SLOP_DOT = { top: 18, bottom: 18, left: 14, right: 14 };

// ── Cores das categorias dos posts (badges sobre a capa da imagem) ──
const CATEGORIA_CONFIG: Record<string, { color: string; bg: string; label: string; icon: any }> = {
  avisos:        { color: '#1F3D2B', bg: '#EAF1EC', label: 'AVISO',        icon: 'campaign'     },
  destaque:      { color: '#B4682A', bg: '#FCEFE3', label: 'DESTAQUE',     icon: 'star'         },
  oportunidades: { color: '#27ae60', bg: '#E8F8EE', label: 'OPORTUNIDADE', icon: 'work'         },
  olimpiadas:    { color: '#e67e22', bg: '#FEF3E7', label: 'OLIMPÍADA',    icon: 'emoji-events' },
  passeios:      { color: '#8e44ad', bg: '#F3E8FA', label: 'PASSEIO',      icon: 'explore'      },
};

const diasDesdePub = (post: any) => {
  if (!post?.data_publicacao) return 999;
  const dt = post.data_publicacao.toDate
    ? post.data_publicacao.toDate()
    : new Date(post.data_publicacao);
  const hoje = new Date();
  return Math.floor((hoje.getTime() - dt.getTime()) / (1000 * 60 * 60 * 24));
};
const ehNovo = (post: any) => diasDesdePub(post) <= 1;
const postValido = (post: any) => {
  const d = diasDesdePub(post);
  return d >= 0 && d <= DIAS_VALIDADE_POST;
};

const SUBS_AGENDA: { sub: string; rotulo: string; icon: any }[] = [
  { sub: 'provas',   rotulo: 'Prova',   icon: 'document-text' },
  { sub: 'feriados', rotulo: 'Feriado', icon: 'sunny' },
  { sub: 'avisos',   rotulo: 'Aviso',   icon: 'megaphone' },
  { sub: 'eventos',  rotulo: 'Evento',  icon: 'sparkles' },
];

const quandoTexto = (dias: number) =>
  dias === 0 ? 'hoje' : dias === 1 ? 'amanhã' : dias > 0 ? `em ${dias} dias` : `há ${Math.abs(dias)} dias`;

const ACOES = [
  { chave: 'match',   label: 'Encontrar match', icone: 'location-outline'    as const, cor: CORES_SYMBIUS.verdeMedio },
  { chave: 'duvida',  label: 'Tirar dúvida',    icone: 'help-buoy-outline'   as const, cor: CORES_SYMBIUS.laranja },
  { chave: 'resumo',  label: 'Postar resumo',   icone: 'book-outline'        as const, cor: CORES_SYMBIUS.azul },
  { chave: 'ranking', label: 'Ver ranking',     icone: 'bar-chart-outline'   as const, cor: CORES_SYMBIUS.laranja },
];

export default function Index({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const [uid, setUid] = useState<string | null>(route?.params?.uid || null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [checkIn, setCheckIn] = useState<CheckInResult | null>(null);
  const [processandoCheckIn, setProcessandoCheckIn] = useState(false);
  const [levelUpInfo, setLevelUpInfo] = useState<LevelUpInfo | null>(null);

  // ── Mural / posts (coleção `posts` do app original) ──
  const [posts, setPosts] = useState<any[]>([]);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [destaqueIdx, setDestaqueIdx] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const carrosselRef = useRef<FlatList>(null);

  // ── Publicações antigas (fora da janela de 30 dias do mural) ──
  const [modalAntigos, setModalAntigos] = useState(false);

  // ── Notificações (histórico aberto direto aqui, sem navegar pra Config) ──
  const [modalNotif, setModalNotif] = useState(false);
  const [notificacoesAgenda, setNotificacoesAgenda] = useState<any[]>([]);
  const [notifDescartadas, setNotifDescartadas] = useState<Set<string>>(new Set());
  const [miniMenuAberto, setMiniMenuAberto] = useState(false);

  const { notificacoesChat, limparNotificacoesChat } = useNotificacao();

  const carregar = useCallback(async () => {
    try {
      let uidAtual = uid;
      if (!uidAtual) {
        uidAtual = await AsyncStorage.getItem('uid');
        if (uidAtual) setUid(uidAtual);
      }
      if (!uidAtual) { setLoading(false); return; }

      const snap = await getDoc(doc(db, 'usuarios', uidAtual));
      if (snap.exists()) setUserData(snap.data());
    } catch (e) {
      console.log('Erro ao carregar Home:', e);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('data_publicacao', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});
    return () => unsub();
  }, []);

  // Carrega IDs de notificações de agenda já descartadas
  useEffect(() => {
    AsyncStorage.getItem('notif_descartadas').then(raw => {
      if (raw) setNotifDescartadas(new Set(JSON.parse(raw)));
    }).catch(() => {});
  }, []);

  // Agenda no sino: eventos da série nos próximos 7 dias + lembretes pessoais
  // próximos (até 3 dias) ou vencidos. Tocar em qualquer um abre o Calendário.
  useEffect(() => {
    if (!uid || !userData) return;
    (async () => {
      try {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const diasAte = (dataStr: string) => {
          const [a, m, d] = dataStr.split('-').map(Number);
          return Math.round((new Date(a, m - 1, d).getTime() - hoje.getTime()) / 86400000);
        };
        const notifs: any[] = [];

        const ehAdmin = userData?.tipo?.toLowerCase() === 'administrador';
        const numSerie = (userData?.turma || '').match(/^(\d+)/)?.[1];
        const serie = numSerie ? `${numSerie}º` : null;
        await Promise.all(SUBS_AGENDA.map(async ({ sub, rotulo, icon }) => {
          if (!ehAdmin && !serie) return;
          try {
            const ref = collection(db, 'eventos_admin', 'tipos', sub);
            const snap = await getDocs(ehAdmin ? ref : query(ref, where('series', 'array-contains', serie)));
            snap.forEach(d => {
              const ev: any = d.data();
              if (!ev.data) return;
              const dias = diasAte(ev.data);
              if (dias >= 0 && dias <= 7) notifs.push({ id: d.id, tipo: 'evento', rotulo, titulo: ev.titulo, data: ev.data, dias, icon });
            });
          } catch {}
        }));

        const raLimpo = userData?.ra?.replace(/[\/\\]/g, '');
        const raValido = raLimpo && raLimpo !== 'N/A' && raLimpo.length > 0;
        try {
          const snapL = await getDocs(collection(db, 'lembretes', raValido ? raLimpo : uid, 'lembretes'));
          snapL.forEach(d => {
            const l: any = d.data();
            if (!l.data) return;
            const dias = diasAte(l.data);
            if (dias < 0) notifs.push({ id: d.id, tipo: 'lembrete_vencido', titulo: l.titulo, data: l.data, dias, icon: 'alert-circle' });
            else if (dias <= 3) notifs.push({ id: d.id, tipo: 'lembrete_proximo', titulo: l.titulo, data: l.data, dias, icon: 'bookmark' });
          });
        } catch {}

        notifs.sort((a, b) => a.data.localeCompare(b.data));
        setNotificacoesAgenda(notifs);
      } catch (e) { console.error('Erro ao carregar notificações de agenda:', e); }
    })();
  }, [uid, userData?.ra, userData?.turma, userData?.tipo]);

  const totalNotificacoesAtivas =
    notificacoesChat.length + notificacoesAgenda.filter(n => !notifDescartadas.has(n.id)).length;

  const limparHistoricoNotificacoes = () => {
    limparNotificacoesChat();
    const idsAtivos = notificacoesAgenda.map(n => n.id);
    const novoSet = new Set([...notifDescartadas, ...idsAtivos]);
    setNotifDescartadas(novoSet);
    AsyncStorage.setItem('notif_descartadas', JSON.stringify([...novoSet])).catch(() => {});
  };

  // ── Permissões (idênticas ao Index original) ──
  const userEmail = userData?.email_escolar || '';
  const isSuperAdmin = userEmail.endsWith('@anchieta.br') || userData?.tipo?.toLowerCase() === 'administrador';
  const isAdmin = userData?.tipo?.toLowerCase() === 'administrador';
  const isGremio = userData?.tipo === 'Gremista';
  const temPermissaoDeStaff = isSuperAdmin || isGremio;

  const primeiroNome = userData?.nome_completo?.split(' ')[0] || 'colega';
  const xpTotal = userData?.xp_total || 0;
  const nivel = calcularNivel(xpTotal);
  const progresso = calcularProgressoXp(xpTotal);

  // ── Desafio do dia só aparece se fizer 24h reais desde o último check-in
  // (não é reset de meia-noite — usa o timestamp exato salvo pelo backend) ──
  const checkInDisponivel = useMemo(() => {
    const ts = userData?.ultimo_checkin_ts;
    if (!ts) return true;
    const ultimoMs = typeof ts === 'number' ? ts : (ts?.toMillis ? ts.toMillis() : new Date(ts).getTime());
    return Date.now() - ultimoMs >= 24 * 60 * 60 * 1000;
  }, [userData?.ultimo_checkin_ts]);

  const postsValidos = useMemo(() => posts.filter(postValido), [posts]);
  // Posts fora da janela de 30 dias — hoje eram "perdidos pra sempre" no
  // mural; ficam disponíveis aqui pra quem quiser ver via "Ver publicações
  // antigas" (já vêm ordenados por data desc, mesma ordem de `posts`).
  const postsAntigos = useMemo(() => posts.filter(p => !postValido(p)), [posts]);

  const postsFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return postsValidos;
    return postsValidos.filter(p => {
      const titulo = (p.titulo || '').toLowerCase();
      const categoria = (p.categoria || '').toLowerCase();
      const catLabel = (CATEGORIA_CONFIG[p.categoria]?.label || '').toLowerCase();
      return titulo.includes(termo) || categoria.includes(termo) || catLabel.includes(termo);
    });
  }, [postsValidos, busca]);

  const slidesDestaque = useMemo(() => {
    const pares: any[] = [];
    for (let i = 0; i < postsValidos.length; i += 2) {
      pares.push(postsValidos.slice(i, i + 2));
    }
    return pares;
  }, [postsValidos]);

  const irParaSlide = (idx: number) => {
    const total = slidesDestaque.length;
    if (total === 0) return;
    const novo = ((idx % total) + total) % total;
    setDestaqueIdx(novo);
    carrosselRef.current?.scrollToIndex({ index: novo, animated: true });
  };

  const visualizarPost = async (post: any) => {
    setSelectedPost(post);
    setModalVisible(true);
    try {
      const jaLeu = post.leitores?.includes(uid);
      if (!jaLeu && uid) {
        await updateDoc(doc(db, 'posts', post.id), {
          visualizacoes: increment(1),
          leitores: arrayUnion(uid),
        });
      }
    } catch (e) {}
  };

  // Veio da notificação de post novo: abre o post assim que ele carregar.
  const abrirPostId = route?.params?.abrirPostId;
  useEffect(() => {
    if (!abrirPostId || posts.length === 0) return;
    const alvo = posts.find(p => p.id === abrirPostId);
    if (alvo) visualizarPost(alvo);
    navigation.setParams({ abrirPostId: undefined });
  }, [abrirPostId, posts.length]);

  // Fecha o modal de "publicações antigas" antes de abrir o post em cima,
  // pra não ter dois Modal do RN abertos ao mesmo tempo.
  const abrirPostAntigo = (post: any) => {
    setModalAntigos(false);
    visualizarPost(post);
  };

  const irPara = (destino: string, params: any = {}) => {
    if (!uid) return;
    navigation.navigate(destino, { uid, ...params });
  };

  const handleAcao = async (chave: string) => {
    if (chave === 'match')   return irPara('Match');
    if (chave === 'ranking') return irPara('Leaderboard');
    if (chave === 'resumo')  return irPara('Resumos');
    if (chave === 'duvida')  return irPara('Ajuda');
  };

  const fazerCheckIn = async () => {
    if (!uid || processandoCheckIn) return;
    setProcessandoCheckIn(true);
    const resultado = await awardDailyCheckIn(uid);
    setCheckIn(resultado);
    setProcessandoCheckIn(false);
    if (resultado.levelUp) setLevelUpInfo(resultado.levelUp);
    if (resultado.ganhou) await carregar(); // atualiza XP/nível na tela
  };

  // ── Card de destaque (capa real + categoria como badge) ──
  // `opts` permite reusar o mesmo card no grid de "publicações antigas"
  // (largura diferente + fecha o modal de antigas antes de abrir o post).
  const renderDestaqueCard = (post: any, opts?: { largura?: number; onAbrir?: () => void }) => {
    const config = CATEGORIA_CONFIG[post.categoria] || CATEGORIA_CONFIG.avisos;
    const novo = ehNovo(post);
    const largura = opts?.largura ?? DESTAQUE_W;

    return (
      <TouchableOpacity
        key={post.id}
        style={[styles.destCard, { width: largura }]}
        onPress={() => modoEdicao && isSuperAdmin
          ? navigation.navigate('EditorPost', { postId: post.id, categoria: post.categoria, current: post })
          : (opts?.onAbrir ? opts.onAbrir() : visualizarPost(post))
        }
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`${config.label}. ${post.titulo}. ${post.visualizacoes || 0} visualizações.${novo ? ' Publicação nova.' : ''}`}
      >
        {post.capa
          ? <Image source={{ uri: post.capa }} style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no" />
          : <View style={[StyleSheet.absoluteFill, { backgroundColor: CORES_SYMBIUS.verdeEscuro }]} />
        }
        <LinearGradient
          colors={['rgba(31,61,43,0.05)', 'rgba(31,61,43,0.45)', 'rgba(20,35,25,0.90)']}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <View style={styles.destTopo}>
          <View style={[styles.destBadge, { backgroundColor: config.bg }]}>
            <MaterialIcons name={config.icon} size={9} color={config.color} />
            <Text style={[styles.destBadgeText, { color: config.color }]}>{config.label}</Text>
          </View>
          {novo && (
            <View style={styles.destNovoBadge}>
              <Text style={styles.destNovoText}>NOVO</Text>
            </View>
          )}
        </View>

        <View>
          <Text style={styles.destTitulo} numberOfLines={2}>{post.titulo}</Text>
          <View style={styles.destMeta}>
            <Ionicons name="eye" size={10} color="rgba(255,255,255,0.85)" />
            <Text style={styles.destMetaText}>{post.visualizacoes || 0} visualizações</Text>
          </View>
        </View>

        {modoEdicao && isSuperAdmin && (
          <View style={styles.destEditBadge}>
            <MaterialIcons name="edit" size={11} color="#FFF" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centro]}>
        <ActivityIndicator size="large" color={CORES_SYMBIUS.verdeEscuro} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle={CORES_SYMBIUS.barStyle} backgroundColor={CORES_SYMBIUS.fundo} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12 }]} showsVerticalScrollIndicator={false}>

        {/* HEADER */}
        <View style={styles.topoMarca}>
          <Text style={styles.marca}>Symbius</Text>
          <View style={styles.headerIcones}>
            {temPermissaoDeStaff && (
              <TouchableOpacity
                onPress={() => setModoEdicao(!modoEdicao)}
                hitSlop={HIT_SLOP_SM}
                style={[styles.btnEdit, modoEdicao && styles.btnEditAtivo]}
                accessibilityRole="switch"
                accessibilityLabel={modoEdicao ? 'Desativar modo editor' : 'Ativar modo editor'}
                accessibilityState={{ checked: modoEdicao }}
              >
                <FontAwesome5 name="pen" size={11} color={modoEdicao ? CORES_SYMBIUS.creme : CORES_SYMBIUS.verdeEscuro} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => setModalNotif(true)}
              hitSlop={HIT_SLOP_SM}
              style={{ marginLeft: 14 }}
              accessibilityRole="button"
              accessibilityLabel="Notificações"
              accessibilityHint="Toque duplo para ver suas notificações"
            >
              <Ionicons name="notifications-outline" size={20} color={CORES_SYMBIUS.texto} />
              {totalNotificacoesAtivas > 0 && <View style={styles.dotNotif} />}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => irPara('Loja')} hitSlop={HIT_SLOP_SM} style={{ marginLeft: 14 }}>
              <Ionicons name="bag-outline" size={20} color={CORES_SYMBIUS.texto} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setMiniMenuAberto(true)}
              hitSlop={HIT_SLOP_SM}
              style={{ marginLeft: 14 }}
              accessibilityRole="button"
              accessibilityLabel="Mais opções"
              accessibilityHint="Abre o menu com dúvidas, contato e admin"
            >
              <Ionicons name="ellipsis-horizontal" size={20} color={CORES_SYMBIUS.texto} />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.saudacao}>Olá, {primeiroNome}!</Text>
        <Text style={styles.subSaudacao}>Hoje é um ótimo dia para aprender.</Text>

        {/* BUSCA */}
        <View style={styles.buscaWrap}>
          <Ionicons name="search-outline" size={16} color={CORES_SYMBIUS.textoMuted} />
          <TextInput
            style={styles.buscaInput}
            placeholder="Buscar posts, dúvidas, assuntos..."
            placeholderTextColor={CORES_SYMBIUS.textoMuted}
            value={busca}
            onChangeText={setBusca}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {busca.length > 0 && (
            <TouchableOpacity onPress={() => setBusca('')} hitSlop={HIT_SLOP_SM}>
              <Ionicons name="close" size={16} color={CORES_SYMBIUS.textoMuted} />
            </TouchableOpacity>
          )}
        </View>

        {modoEdicao && (
          <View style={styles.alertEdicao} accessibilityRole="alert" accessibilityLabel="Modo editor ativado">
            <Ionicons name="alert-circle" size={14} color={CORES_SYMBIUS.creme} />
            <Text style={styles.txtEdicao}>MODO EDITOR ATIVADO</Text>
          </View>
        )}

        {/* ═══ DESTAQUES (mural real, restaurado do Index original) ═══ */}
        <View style={styles.secaoHeaderRow}>
          <View>
            <Text style={styles.secaoEyebrow}>EM DESTAQUE</Text>
            <Text style={styles.secaoTitulo}>Confira agora</Text>
          </View>
          <View style={styles.navDestRow}>
            {modoEdicao && isSuperAdmin && (
              <TouchableOpacity
                style={styles.btnNovoPost}
                onPress={() => navigation.navigate('EditorPost', { categoria: 'destaque' })}
                hitSlop={HIT_SLOP_MD}
                accessibilityLabel="Criar novo post"
              >
                <MaterialIcons name="add" size={16} color={CORES_SYMBIUS.creme} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.navDestBtn}
              onPress={() => irParaSlide(destaqueIdx - 1)}
              disabled={slidesDestaque.length <= 1}
              hitSlop={HIT_SLOP_MD}
              accessibilityLabel="Slide anterior"
            >
              <Ionicons name="chevron-back" size={14} color={CORES_SYMBIUS.textoSec} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navDestBtn, styles.navDestBtnAtivo]}
              onPress={() => irParaSlide(destaqueIdx + 1)}
              disabled={slidesDestaque.length <= 1}
              hitSlop={HIT_SLOP_MD}
              accessibilityLabel="Próximo slide"
            >
              <Ionicons name="chevron-forward" size={14} color={CORES_SYMBIUS.creme} />
            </TouchableOpacity>
          </View>
        </View>

        {busca.trim().length > 0 ? (
          <View style={{ marginBottom: 6 }}>
            {postsFiltrados.length === 0 ? (
              <View style={styles.destEmpty}>
                <MaterialIcons name="search-off" size={30} color={CORES_SYMBIUS.borda2} />
                <Text style={styles.destEmptyText}>Nenhum post encontrado para "{busca}"</Text>
              </View>
            ) : (
              postsFiltrados.map(post => (
                <View key={post.id} style={{ marginBottom: 10 }}>{renderDestaqueCard(post)}</View>
              ))
            )}
          </View>
        ) : slidesDestaque.length > 0 ? (
          <>
            <FlatList
              ref={carrosselRef}
              data={slidesDestaque}
              keyExtractor={(_, i) => `slide-${i}`}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / width);
                setDestaqueIdx(idx);
              }}
              renderItem={({ item: par }) => (
                <View style={[styles.slideWrap, { width }]}>
                  {par.map((post: any) => renderDestaqueCard(post))}
                  {par.length === 1 && <View style={{ width: DESTAQUE_W }} />}
                </View>
              )}
            />
            <View style={styles.indicadores}>
              {slidesDestaque.map((_, i) => {
                const ativo = i === destaqueIdx;
                return (
                  <TouchableOpacity key={i} onPress={() => irParaSlide(i)} hitSlop={HIT_SLOP_DOT}>
                    <View style={[styles.indicador, ativo && styles.indicadorAtivo]} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        ) : (
          <View style={styles.destEmpty}>
            <Ionicons name="newspaper-outline" size={30} color={CORES_SYMBIUS.borda2} />
            <Text style={styles.destEmptyText}>Nenhum post recente.</Text>
            {modoEdicao && isSuperAdmin && (
              <TouchableOpacity
                style={styles.btnPrimeiroPost}
                onPress={() => navigation.navigate('EditorPost', { categoria: 'destaque' })}
              >
                <MaterialIcons name="add" size={14} color={CORES_SYMBIUS.creme} />
                <Text style={styles.btnPrimeiroPostText}>Criar primeiro post</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {busca.trim().length === 0 && postsAntigos.length > 0 && (
          <TouchableOpacity
            style={styles.btnVerAntigos}
            onPress={() => setModalAntigos(true)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Ver publicações antigas, ${postsAntigos.length} no total`}
          >
            <Ionicons name="time-outline" size={14} color={CORES_SYMBIUS.laranjaTexto} />
            <Text style={styles.btnVerAntigosTxt}>Ver publicações antigas ({postsAntigos.length})</Text>
            <Ionicons name="chevron-forward" size={14} color={CORES_SYMBIUS.laranjaTexto} />
          </TouchableOpacity>
        )}

        {/* AÇÕES RÁPIDAS */}
        <View style={styles.acoesGrid}>
          {ACOES.map((a) => (
            <TouchableOpacity key={a.chave} style={styles.acaoCard} activeOpacity={0.85} onPress={() => handleAcao(a.chave)}>
              <View style={[styles.acaoIconeWrap, { backgroundColor: a.cor }]}>
                <Ionicons name={a.icone} size={20} color={CORES_SYMBIUS.creme} />
              </View>
              <Text style={styles.acaoLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* SEU PROGRESSO */}
        <Text style={styles.secaoTituloSimples}>Seu progresso</Text>
        <View style={styles.cardProgresso}>
          <View style={styles.progressoIconeWrap}>
            <Text style={styles.progressoIcone}>{nivel.iconeAnimal}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.progressoTitulo}>{nivel.nomeAnimal} · {nivel.nomeSubfase}</Text>
            <Text style={styles.progressoSub}>{xpTotal} XP · faltam {progresso.faltam}</Text>
            <View style={styles.barraFundo}>
              <View style={[styles.barraPreenchida, { width: `${progresso.percentual}%` }]} />
            </View>
          </View>
          <Text style={styles.progressoMoedas}>+10 XP</Text>
        </View>

        {/* DESAFIO DO DIA (check-in real, via gamificationService) — só
            aparece se já passaram 24h reais desde o último check-in;
            some sozinho depois de coletado e só volta no dia seguinte. */}
        {checkInDisponivel && (
          <TouchableOpacity
            style={styles.cardDesafio}
            activeOpacity={0.9}
            onPress={fazerCheckIn}
            disabled={processandoCheckIn}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.desafioLabel}>Desafio do dia</Text>
              <Text style={styles.desafioTitulo}>
                {checkIn?.ganhou
                  ? `Feito! +${checkIn.xp} XP, +${checkIn.moedas} Sementes 🌱`
                  : 'Conecte-se com 1 novo match'}
              </Text>
            </View>
            {processandoCheckIn
              ? <ActivityIndicator color={CORES_SYMBIUS.creme} />
              : (
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.desafioXp}>+10 XP</Text>
                  <Text style={styles.desafioMoedas}>🌱 5 Sementes</Text>
                </View>
              )
            }
          </TouchableOpacity>
        )}

      </ScrollView>

      <SymbiusTabBar ativa="inicio" navigation={navigation} uid={uid} />
      <NivelUpSymbiusModal info={levelUpInfo} onFechar={() => setLevelUpInfo(null)} />

      {/* MODAL — leitura do post */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalWrap}>
          <View style={styles.modalCover}>
            {selectedPost?.capa
              ? <Image source={{ uri: selectedPost.capa }} style={StyleSheet.absoluteFill} />
              : (
                <View style={[StyleSheet.absoluteFill, styles.modalCoverVazia]}>
                  <Text style={styles.modalMarca}>Symbius</Text>
                </View>
              )
            }
            <View style={styles.modalCoverOverlay} />
            <TouchableOpacity style={styles.btnFechar} onPress={() => setModalVisible(false)} hitSlop={HIT_SLOP_SM}>
              <Ionicons name="chevron-down" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingBottom: 60 }}>
              {selectedPost?.tags?.length > 0 && (
                <View style={styles.tagsRow}>
                  {selectedPost.tags.map((tag: string, i: number) => (
                    <View key={i} style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>
                  ))}
                </View>
              )}
              <Text style={styles.modalTitulo}>{selectedPost?.titulo}</Text>
              {selectedPost?.subtitulo && <Text style={styles.modalSub}>{selectedPost.subtitulo}</Text>}
              <View style={styles.modalMeta}>
                <View style={styles.autorRow}>
                  <View style={styles.autorAvatar}>
                    <MaterialIcons name="person" size={16} color={CORES_SYMBIUS.creme} />
                  </View>
                  <View>
                    <Text style={styles.autorNome}>{selectedPost?.autor || 'Gestão'}</Text>
                    <Text style={styles.autorRole}>Autor(a)</Text>
                  </View>
                </View>
                <View style={styles.viewsPill}>
                  <Ionicons name="eye" size={13} color={CORES_SYMBIUS.laranja} />
                  <Text style={styles.viewsText}>{selectedPost?.visualizacoes || 0} views</Text>
                </View>
              </View>
              <View style={styles.modalDivider} />
              <Text style={styles.modalConteudo}>{selectedPost?.conteudo}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL — histórico de notificações (aberto direto pelo sino, sem navegar) */}
      <Modal visible={modalNotif} transparent animationType="slide" onRequestClose={() => setModalNotif(false)}>
        <View style={styles.notifOverlay}>
          <View style={styles.notifSheet}>
            <View style={styles.notifHandle} />
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
              <Text style={styles.notifTitulo}>Notificações</Text>
              {totalNotificacoesAtivas > 0 && (
                <TouchableOpacity onPress={limparHistoricoNotificacoes} hitSlop={HIT_SLOP_SM} style={{ marginLeft: 'auto' }}>
                  <Text style={styles.notifLimparTxt}>Limpar tudo</Text>
                </TouchableOpacity>
              )}
            </View>

            {totalNotificacoesAtivas === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 36 }}>
                <Ionicons name="notifications-off" size={36} color={CORES_SYMBIUS.borda2} />
                <Text style={styles.notifVaziaTxt}>Nenhuma notificação</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
                {notificacoesChat.length > 0 && (
                  <>
                    <Text style={styles.notifGrupoLabel}>MENSAGENS</Text>
                    {notificacoesChat.map(item => (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.notifCard}
                        onPress={() => {
                          setModalNotif(false);
                          if (item.grupoId) navigation.navigate('GrupoChat', { grupoId: item.grupoId, uid });
                          else navigation.navigate('Chat', { outroUid: item.outroUid, outroNome: item.outroNome });
                        }}
                      >
                        <View style={[styles.notifIconWrap, { backgroundColor: CORES_SYMBIUS.laranjaTexto + '18' }]}>
                          <Ionicons name="chatbubble-ellipses" size={16} color={CORES_SYMBIUS.laranjaTexto} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.notifCardTitulo} numberOfLines={1}>{item.nome}</Text>
                          <Text style={styles.notifCardMeta} numberOfLines={1}>{item.corpo}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </>
                )}

                {notificacoesAgenda.filter(n => !notifDescartadas.has(n.id)).length > 0 && (
                  <>
                    <Text style={[styles.notifGrupoLabel, { marginTop: notificacoesChat.length > 0 ? 12 : 0 }]}>AGENDA</Text>
                    {notificacoesAgenda.filter(n => !notifDescartadas.has(n.id)).map(item => {
                      const vencido = item.tipo === 'lembrete_vencido';
                      const cor = vencido ? '#e74c3c' : CORES_SYMBIUS.laranja;
                      const meta = item.tipo === 'evento'
                        ? `${item.rotulo} · ${quandoTexto(item.dias)}`
                        : `Lembrete · ${vencido ? 'vencido ' : ''}${quandoTexto(item.dias)}`;
                      return (
                        <TouchableOpacity
                          key={item.id}
                          style={styles.notifCard}
                          activeOpacity={0.8}
                          onPress={() => { setModalNotif(false); irPara('Calendario'); }}
                          accessibilityRole="button"
                          accessibilityHint="Abre o calendário"
                        >
                          <View style={[styles.notifIconWrap, { backgroundColor: cor + '18' }]}>
                            <Ionicons name={item.icon} size={16} color={cor} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.notifCardTitulo} numberOfLines={1}>{item.titulo}</Text>
                            <Text style={styles.notifCardMeta}>{meta}</Text>
                          </View>
                          <Ionicons name="chevron-forward" size={16} color={CORES_SYMBIUS.textoTerciario} />
                        </TouchableOpacity>
                      );
                    })}
                  </>
                )}
              </ScrollView>
            )}

            <TouchableOpacity style={styles.notifBtnFechar} onPress={() => setModalNotif(false)}>
              <Text style={styles.notifBtnFecharTxt}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL — publicações antigas (fora da janela de 30 dias) */}
      <Modal visible={modalAntigos} transparent animationType="slide" onRequestClose={() => setModalAntigos(false)}>
        <View style={styles.notifOverlay}>
          <View style={[styles.notifSheet, { maxHeight: '85%' }]}>
            <View style={styles.notifHandle} />
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.secaoEyebrow}>MURAL</Text>
                <Text style={styles.notifTitulo}>Publicações antigas</Text>
              </View>
              <TouchableOpacity onPress={() => setModalAntigos(false)} hitSlop={HIT_SLOP_SM}>
                <Ionicons name="close" size={22} color={CORES_SYMBIUS.textoSec} />
              </TouchableOpacity>
            </View>

            {postsAntigos.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 36 }}>
                <Ionicons name="archive-outline" size={36} color={CORES_SYMBIUS.borda2} />
                <Text style={styles.notifVaziaTxt}>Nenhuma publicação antiga</Text>
              </View>
            ) : (
              <FlatList
                data={postsAntigos}
                keyExtractor={(p) => p.id}
                numColumns={2}
                columnWrapperStyle={{ gap: 12 }}
                contentContainerStyle={{ gap: 12, paddingBottom: 8 }}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => renderDestaqueCard(item, {
                  largura: LARGURA_ANTIGO,
                  onAbrir: () => abrirPostAntigo(item),
                })}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* MENU "MAIS" — dúvidas / contato / admin */}
      <Modal visible={miniMenuAberto} transparent animationType="fade" onRequestClose={() => setMiniMenuAberto(false)}>
        <TouchableOpacity style={[styles.menuOverlay, { paddingTop: insets.top + 44 }]} activeOpacity={1} onPress={() => setMiniMenuAberto(false)}>
          <View style={styles.menuPopup}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { setMiniMenuAberto(false); irPara('Ajuda'); }}
            >
              <Ionicons name="help-circle" size={17} color={CORES_SYMBIUS.verdeEscuro} />
              <Text style={styles.menuItemText}>Dúvidas / Ajuda</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { setMiniMenuAberto(false); navigation.navigate('Contatos'); }}
            >
              <Ionicons name="call" size={17} color={CORES_SYMBIUS.verdeEscuro} />
              <Text style={styles.menuItemText}>Contato</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { setMiniMenuAberto(false); irPara('Configuracoes'); }}
            >
              <Ionicons name="settings" size={17} color={CORES_SYMBIUS.verdeEscuro} />
              <Text style={styles.menuItemText}>Configurações</Text>
            </TouchableOpacity>
            {isAdmin && (
              <>
                <View style={styles.menuDivider} />
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => { setMiniMenuAberto(false); irPara('Admin'); }}
                >
                  <Ionicons name="shield-checkmark" size={17} color={CORES_SYMBIUS.verdeEscuro} />
                  <Text style={styles.menuItemText}>Painel Admin</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CORES_SYMBIUS.fundo },
  centro: { justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: PAD_H, paddingBottom: 24 },

  topoMarca: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  marca: { fontSize: 22, fontFamily: F.bold, color: CORES_SYMBIUS.verdeEscuro },
  headerIcones: { flexDirection: 'row', alignItems: 'center' },
  btnEdit: {
    width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center',
    backgroundColor: CORES_SYMBIUS.fundoSuave, borderWidth: 1, borderColor: CORES_SYMBIUS.borda2,
  },
  btnEditAtivo: { backgroundColor: CORES_SYMBIUS.verdeEscuro, borderColor: CORES_SYMBIUS.verdeEscuro },
  dotNotif: {
    position: 'absolute', top: -1, right: -1, width: 8, height: 8, borderRadius: 4,
    backgroundColor: CORES_SYMBIUS.laranjaTexto, borderWidth: 1.5, borderColor: CORES_SYMBIUS.fundo,
  },

  saudacao: { fontSize: 21, fontFamily: F.black, color: CORES_SYMBIUS.texto, marginTop: 14 },
  subSaudacao: { fontSize: 13.5, color: CORES_SYMBIUS.textoSec, fontFamily: F.medium, marginTop: 2 },

  buscaWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: CORES_SYMBIUS.fundoSuave, borderRadius: 14, paddingHorizontal: 14,
    paddingVertical: 12, marginTop: 16,
  },
  buscaInput: { flex: 1, color: CORES_SYMBIUS.texto, fontSize: 13, fontFamily: F.regular },

  alertEdicao: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: CORES_SYMBIUS.verdeEscuro,
    borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, marginTop: 14,
  },
  txtEdicao: { color: CORES_SYMBIUS.creme, fontSize: 11.5, fontFamily: F.bold, letterSpacing: 0.4 },

  secaoHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 20, marginBottom: 10 },
  secaoEyebrow: { fontSize: 10, fontFamily: F.bold, color: CORES_SYMBIUS.textoSec, letterSpacing: 0.6 },
  secaoTitulo: { fontSize: 16, fontFamily: F.black, color: CORES_SYMBIUS.texto, marginTop: 2 },
  secaoTituloSimples: { fontSize: 13, fontFamily: F.bold, color: CORES_SYMBIUS.texto, marginTop: 20, marginBottom: 10 },

  navDestRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  btnNovoPost: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: CORES_SYMBIUS.laranjaTexto,
    justifyContent: 'center', alignItems: 'center',
  },
  navDestBtn: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: CORES_SYMBIUS.fundoSuave,
    borderWidth: 1, borderColor: CORES_SYMBIUS.borda2, justifyContent: 'center', alignItems: 'center',
  },
  navDestBtnAtivo: { backgroundColor: CORES_SYMBIUS.verdeEscuro, borderColor: CORES_SYMBIUS.verdeEscuro },

  slideWrap: { flexDirection: 'row', gap: 12, paddingRight: 12 },
  destCard: { height: 150, borderRadius: 16, overflow: 'hidden', justifyContent: 'space-between', padding: 10 },
  destTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  destBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  destBadgeText: { fontSize: 8, fontFamily: F.bold, letterSpacing: 0.3 },
  destNovoBadge: { backgroundColor: CORES_SYMBIUS.laranjaTexto, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  destNovoText: { color: '#FFF', fontSize: 9, fontFamily: F.bold },
  destTitulo: { color: '#FFF', fontSize: 14, fontFamily: F.bold, lineHeight: 18 },
  destMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  destMetaText: { color: 'rgba(255,255,255,0.85)', fontSize: 10, fontFamily: F.medium },
  destEditBadge: {
    position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center',
  },

  destEmpty: {
    alignItems: 'center', gap: 8, backgroundColor: CORES_SYMBIUS.fundoCard, borderRadius: 16,
    borderWidth: 1, borderColor: CORES_SYMBIUS.borda, paddingVertical: 28, paddingHorizontal: 16,
  },
  destEmptyText: { color: CORES_SYMBIUS.textoMuted, fontSize: 12.5, fontFamily: F.medium, textAlign: 'center' },
  btnPrimeiroPost: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: CORES_SYMBIUS.verdeEscuro,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, marginTop: 6,
  },
  btnPrimeiroPostText: { color: CORES_SYMBIUS.creme, fontSize: 12, fontFamily: F.bold },

  indicadores: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  indicador: { width: 6, height: 6, borderRadius: 3, backgroundColor: CORES_SYMBIUS.borda2 },
  indicadorAtivo: { width: 18, backgroundColor: CORES_SYMBIUS.verdeEscuro },

  acoesGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 20 },
  acaoCard: { flex: 1, alignItems: 'center', gap: 6 },
  acaoIconeWrap: {
    width: 44, height: 44, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  acaoLabel: { color: CORES_SYMBIUS.texto, fontSize: 10.5, fontFamily: F.semibold, textAlign: 'center' },

  cardProgresso: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: CORES_SYMBIUS.fundoCard, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: CORES_SYMBIUS.borda,
  },
  progressoIconeWrap: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: CORES_SYMBIUS.fundoSuave,
    justifyContent: 'center', alignItems: 'center',
  },
  progressoIcone: { fontSize: 22 },
  progressoTitulo: { color: CORES_SYMBIUS.texto, fontSize: 14, fontFamily: F.bold },
  progressoSub: { color: CORES_SYMBIUS.textoMuted, fontSize: 11, fontFamily: F.medium, marginTop: 4, marginBottom: 6 },
  progressoMoedas: { color: CORES_SYMBIUS.laranja, fontSize: 12, fontFamily: F.bold },
  barraFundo: { height: 6, backgroundColor: CORES_SYMBIUS.borda, borderRadius: 3, overflow: 'hidden' },
  barraPreenchida: { height: 6, backgroundColor: CORES_SYMBIUS.verdeEscuro, borderRadius: 3 },

  cardDesafio: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: CORES_SYMBIUS.verdeEscuro, borderRadius: 16, padding: 16,
    marginTop: 8,
  },
  desafioLabel: { color: CORES_SYMBIUS.creme, fontSize: 13, fontFamily: F.bold },
  desafioTitulo: { color: '#C7D4C2', fontSize: 12, fontFamily: F.medium, marginTop: 2 },
  desafioXp: { color: CORES_SYMBIUS.creme, fontSize: 12, fontFamily: F.bold },
  desafioMoedas: { color: '#C7D4C2', fontSize: 11, fontFamily: F.medium, marginTop: 2 },

  // ── Modal de leitura do post ──
  modalWrap: { flex: 1, backgroundColor: CORES_SYMBIUS.fundo },
  modalCover: { height: 220 },
  modalCoverVazia: { backgroundColor: CORES_SYMBIUS.verdeEscuro, justifyContent: 'center', alignItems: 'center' },
  modalMarca: { color: CORES_SYMBIUS.creme, fontSize: 30, fontFamily: F.black },
  modalCoverOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.18)' },
  btnFechar: {
    position: 'absolute', top: 44, left: 16, width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center',
  },
  modalBody: { flex: 1, backgroundColor: CORES_SYMBIUS.fundoCard, marginTop: -20, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  tag: { backgroundColor: CORES_SYMBIUS.fundoLaranjaClaro, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  tagText: { color: CORES_SYMBIUS.laranjaTexto, fontSize: 11, fontFamily: F.bold },
  modalTitulo: { fontSize: 22, fontFamily: F.black, color: CORES_SYMBIUS.texto },
  modalSub: { fontSize: 14, fontFamily: F.medium, color: CORES_SYMBIUS.textoSec, marginTop: 6 },
  modalMeta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: CORES_SYMBIUS.fundoSuave, borderRadius: 12, padding: 10, marginTop: 16,
  },
  autorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  autorAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: CORES_SYMBIUS.verdeEscuro, justifyContent: 'center', alignItems: 'center' },
  autorNome: { color: CORES_SYMBIUS.texto, fontSize: 12.5, fontFamily: F.bold },
  autorRole: { color: CORES_SYMBIUS.textoMuted, fontSize: 10, fontFamily: F.regular },
  viewsPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: CORES_SYMBIUS.fundoCard, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  viewsText: { color: CORES_SYMBIUS.texto, fontSize: 11, fontFamily: F.semibold },
  modalDivider: { height: 1, backgroundColor: CORES_SYMBIUS.borda, marginVertical: 18 },
  modalConteudo: { color: CORES_SYMBIUS.texto, fontSize: 14.5, fontFamily: F.regular, lineHeight: 22 },

  // ── Modal de notificações ──
  notifOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  notifSheet: {
    backgroundColor: CORES_SYMBIUS.fundoCard, borderTopLeftRadius: 26, borderTopRightRadius: 26,
    padding: 22, paddingBottom: 36, maxHeight: '80%',
  },
  btnVerAntigos: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: CORES_SYMBIUS.fundoLaranjaClaro, borderRadius: 12,
    paddingVertical: 10, marginTop: 2, marginBottom: 4,
  },
  btnVerAntigosTxt: { color: CORES_SYMBIUS.laranjaTexto, fontSize: 12.5, fontFamily: F.bold },
  notifHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16, backgroundColor: CORES_SYMBIUS.borda2 },
  notifTitulo: { fontSize: 17, fontFamily: F.black, color: CORES_SYMBIUS.texto },
  notifLimparTxt: { fontSize: 13, fontFamily: F.bold, color: CORES_SYMBIUS.laranjaTexto },
  notifVaziaTxt: { color: CORES_SYMBIUS.textoMuted, fontSize: 13, fontFamily: F.medium, marginTop: 10 },
  notifGrupoLabel: { fontSize: 10, fontFamily: F.bold, letterSpacing: 0.6, color: CORES_SYMBIUS.textoSec, marginBottom: 8 },
  notifCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: CORES_SYMBIUS.fundoSuave,
    borderRadius: 14, padding: 10, marginBottom: 8,
  },
  notifIconWrap: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  notifCardTitulo: { fontSize: 13, fontFamily: F.bold, color: CORES_SYMBIUS.texto },
  notifCardMeta: { fontSize: 11, fontFamily: F.regular, color: CORES_SYMBIUS.textoSec, marginTop: 2 },
  notifBtnFechar: { backgroundColor: CORES_SYMBIUS.verdeEscuro, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  notifBtnFecharTxt: { color: CORES_SYMBIUS.creme, fontSize: 14, fontFamily: F.bold },

  // ── Menu "Mais" (dúvidas / contato / admin) ──
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: 60, paddingRight: 20 },
  menuPopup: {
    backgroundColor: CORES_SYMBIUS.fundoCard, borderRadius: 16, paddingVertical: 6, minWidth: 200,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  menuItemText: { fontSize: 14, fontFamily: F.semibold, color: CORES_SYMBIUS.texto },
  menuDivider: { height: 1, backgroundColor: CORES_SYMBIUS.borda, marginVertical: 2 },
});
