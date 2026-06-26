import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  Image, SafeAreaView, StatusBar, Dimensions, TextInput,
  Modal, TouchableWithoutFeedback, Platform, FlatList, RefreshControl,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient'; // ✅ NOVO — gradiente p/ contraste nos cards
import { db } from '../config/firebaseConfig';
import {
  doc, getDoc, collection, onSnapshot, query, orderBy,
  updateDoc, increment, arrayUnion, where, getDocs
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppSettings } from '../contexts/AppSettingsContext';
import { useNotificacao, ChatNotif } from '../contexts/NotificacaoProvider';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


const { width, height } = Dimensions.get('window');
const DESTAQUE_W = (width - 18 * 2 - 10) / 2;

const DIAS_VALIDADE_POST = 30;


const HIT_SLOP_SM  = { top: 10, bottom: 10, left: 10, right: 10 }; // botões 34→54
const HIT_SLOP_MD  = { top: 14, bottom: 14, left: 14, right: 14 }; // botões 30→58
const HIT_SLOP_DOT = { top: 18, bottom: 18, left: 14, right: 14 }; // pontos do carrossel

// ✅ Fonte padrão — funciona com Poppins (se instalada) ou cai no system
import { F, CORES } from '../constants/theme';
import { awardDailyCheckIn, CheckInResult, LevelUpInfo } from '../services/gamificationService';

// ── Cores das categorias dos posts ──
const CATEGORIA_CONFIG: Record<string, { color: string; bg: string; label: string; icon: any }> = {
  avisos:        { color: '#1B3868', bg: '#EAEFF4', label: 'AVISO',        icon: 'campaign'     },
  destaque:      { color: '#B8860B', bg: '#FFF6DD', label: 'DESTAQUE',     icon: 'star'         },
  oportunidades: { color: '#27ae60', bg: '#E8F8EE', label: 'OPORTUNIDADE', icon: 'work'         },
  olimpiadas:    { color: '#e67e22', bg: '#FEF3E7', label: 'OLIMPÍADA',    icon: 'emoji-events' },
  passeios:      { color: '#8e44ad', bg: '#F3E8FA', label: 'PASSEIO',      icon: 'explore'      },
};

// ── Cores dos tipos da agenda ──
const TIPO_CONFIG: Record<string, { color: string; bg: string; label: string; icon: any }> = {
  lembrete: { color: '#2c3e50', bg: '#EBF0F5', label: 'LEMBRETE', icon: 'bookmark'      },
  Prova:    { color: '#e74c3c', bg: '#FDECEA', label: 'PROVA',    icon: 'document-text' },
  Feriado:  { color: '#27ae60', bg: '#E8F8EE', label: 'FERIADO',  icon: 'sunny'         },
  Aviso:    { color: '#e67e22', bg: '#FEF3E7', label: 'AVISO',    icon: 'megaphone'     },
  Evento:   { color: '#8e44ad', bg: '#F3E8FA', label: 'EVENTO',   icon: 'sparkles'      },
};

const TIPO_COLLECTION: Record<string, string> = {
  Prova:   'provas',
  Feriado: 'feriados',
  Aviso:   'avisos',
  Evento:  'eventos',
};

const MESES_ABREV = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

// ── Util: contagem regressiva ──
const calcDias = (dataStr: string) => {
  const [a, m, d] = dataStr.split('-').map(Number);
  const alvo = new Date(a, m - 1, d);
  const hoje = new Date();
  hoje.setHours(0,0,0,0); alvo.setHours(0,0,0,0);
  const diff = Math.round((alvo.getTime() - hoje.getTime()) / (1000*60*60*24));
  if (diff === 0)  return { texto: 'É HOJE',           cor: '#e67e22' };
  if (diff === 1)  return { texto: 'É AMANHÃ',         cor: '#e67e22' };
  if (diff > 0)    return { texto: `FALTAM ${diff} DIAS`, cor: CORES.azulEscuro };
  return { texto: '',  cor: CORES.textoSec };
};

// ── Util: dias desde a publicação ──
const diasDesdePub = (post: any) => {
  if (!post?.data_publicacao) return Infinity;
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

// ── Util: extrai série da turma ──
const extrairSerie = (turma: string) => {
  if (!turma) return null;
  const m = turma.match(/^(\d+)/);
  return m ? `${m[1]}º` : null;
};

export default function Index({ navigation, route }: any) {
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();
  const [userData, setUserData]                 = useState<any>(null);
  const [posts, setPosts]                       = useState<any[]>([]);
  const [agendaItens, setAgendaItens]           = useState<any[]>([]);
  const [modalVisible, setModalVisible]         = useState(false);
  const [selectedPost, setSelectedPost]         = useState<any>(null);
  const [modoEdicao, setModoEdicao]             = useState(false);
  const [miniMenuAberto, setMiniMenuAberto]     = useState(false);
  const [destaqueIdx, setDestaqueIdx]           = useState(0);
  const [notificacoes, setNotificacoes] = useState<any[]>([]);
  const [notificacoesDescartadas, setNotificacoesDescartadas] = useState<Set<string>>(new Set());
  const [modalNotif, setModalNotif] = useState(false);

  const { notificacoesChat, limparNotificacoesChat } = useNotificacao();
  const [serieFiltroAdm, setSerieFiltroAdm]     = useState('todas');

  const [modalEvento, setModalEvento]           = useState(false);
  const [eventoSelecionado, setEventoSelecionado] = useState<any>(null);

  // ── Check-in toast + level-up modal ──
  const [checkInToast, setCheckInToast]   = useState<null | CheckInResult>(null);
  const checkInOpacity = useRef(new Animated.Value(0)).current;
  const checkInSlide   = useRef(new Animated.Value(40)).current;  // slide de baixo pra cima
  const [levelUpInfo, setLevelUpInfo]     = useState<null | LevelUpInfo>(null);
  const levelUpScale   = useRef(new Animated.Value(0.7)).current;
  const levelUpOpacity = useRef(new Animated.Value(0)).current;

  const { cores: C, fonteScale, modoEscuro } = useAppSettings();
  const fs = (size: number) => size * fonteScale;

  const catBg = (cfg: any) => modoEscuro ? cfg.color + '25' : cfg.bg;

  
  const textoSecAcc = modoEscuro ? '#B8C0CC' : '#5C6678';

  const carrosselRef = useRef<FlatList>(null);

  // ── Permissões ──
  const userEmail           = userData?.email_escolar || '';
  const isSuperAdmin        = userEmail.endsWith('@anchieta.br') || userData?.tipo?.toLowerCase() === 'administrador';
  const isAdmin             = userData?.tipo?.toLowerCase() === 'administrador';
  const isGremio            = userData?.tipo === 'Gremista';
  const temPermissaoDeStaff = isSuperAdmin || isGremio;
  const primeiroNome        = userData?.nome_completo?.split(' ')[0] || 'aluno';


  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Recarregar dados do perfil
      const uid = route?.params?.uid;
      if (uid) {
        const docSnap = await getDoc(doc(db, 'usuarios', uid));
        if (docSnap.exists()) setUserData({ ...docSnap.data(), uid });
      }

      // Recarregar agenda
      await carregarAgenda();
    } catch (error) {
      console.error('Erro ao recarregar:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // ── Carregar perfil + posts ──
  useEffect(() => {
    const carregarPerfil = async () => {
      const uid = route?.params?.uid;
      if (!uid) return;
      try {
        const docSnap = await getDoc(doc(db, 'usuarios', uid));
        if (docSnap.exists()) setUserData({ ...docSnap.data(), uid });
      } catch (error) { console.error(error); }
    };

    const q = query(collection(db, 'posts'), orderBy('data_publicacao', 'desc'));
    const unsubPosts = onSnapshot(q, (snapshot) => {
      setPosts(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Carrega IDs de notificações de agenda descartadas
    AsyncStorage.getItem('notif_descartadas').then(raw => {
      if (raw) setNotificacoesDescartadas(new Set(JSON.parse(raw)));
    }).catch(() => {});

    carregarPerfil();
    return () => unsubPosts();
  }, []);

  // ── Carregar agenda ──
  useEffect(() => {
    if (!userData?.uid) return;
    carregarAgenda();
  }, [userData?.uid, serieFiltroAdm, isAdmin]);

  // ── Daily check-in (roda 1x por dia ao entrar na home) ──
  useEffect(() => {
    if (!userData?.uid) return;
    (async () => {
      const res = await awardDailyCheckIn(userData.uid);
      if (!res.ganhou) return;                          // já fez hoje — silencioso

      // ── Toast ──
      setCheckInToast(res);
      checkInOpacity.setValue(0);
      checkInSlide.setValue(40);
      Animated.parallel([
        Animated.timing(checkInOpacity, { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.spring(checkInSlide,   { toValue: 0, friction: 6, tension: 80, useNativeDriver: true }),
      ]).start();
      const toastDuration = res.levelUp ? 2200 : 4000;
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(checkInOpacity, { toValue: 0, duration: 260, useNativeDriver: true }),
          Animated.timing(checkInSlide,   { toValue: 40, duration: 260, useNativeDriver: true }),
        ]).start(() => {
          setCheckInToast(null);
          // ── Level-up modal (aparece após o toast sumir) ──
          if (res.levelUp) {
            setLevelUpInfo(res.levelUp);
            levelUpScale.setValue(0.7);
            levelUpOpacity.setValue(0);
            Animated.parallel([
              Animated.spring(levelUpScale,   { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }),
              Animated.timing(levelUpOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
            ]).start();
          }
        });
      }, toastDuration);
    })();
  }, [userData?.uid]);

  const carregarAgenda = async () => {
    try {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const limite = new Date(hoje);
      limite.setDate(limite.getDate() + 7);

      const itens: any[] = [];

      if (userData?.uid) {
        const raLimpo = userData.ra?.replace(/[\/\\]/g, '');
        const raValido = raLimpo && raLimpo !== 'N/A' && raLimpo.length > 0;
        const userIdentifier = raValido ? raLimpo : userData.uid;
        try {
          const snapL = await getDocs(collection(db, 'lembretes', userIdentifier, 'lembretes'));
          snapL.forEach(d => {
            itens.push({ id: d.id, fonte: 'lembrete', tipo: 'lembrete', ...d.data() });
          });
        } catch (e) { console.error('Erro lembretes:', e); }
      }

      for (const tipo of Object.keys(TIPO_COLLECTION)) {
        const subName = TIPO_COLLECTION[tipo];
        const subRef = collection(db, 'eventos_admin', 'tipos', subName);

        try {
          const snapE = await getDocs(subRef);

          snapE.forEach((d: any) => {
            const ev = { id: d.id, fonte: 'admin', ...d.data() };
            const series: string[] = ev.series || [];

            const seriesNumeros = series.map(s => String(s).match(/\d/)?.[0] || '');

            let incluir = false;

            if (isAdmin) {
              if (serieFiltroAdm === 'todas') {
                incluir = true;
              } else {
                // Pega só o número do filtro (ex: '1º' → '1')
                const filtroNumero = serieFiltroAdm.match(/\d/)?.[0] || '';
                incluir = seriesNumeros.includes(filtroNumero);
              }
            } else {
              const serie = extrairSerie(userData?.turma || '');
              if (serie) {
                const serieNumero = serie.match(/\d/)?.[0] || '';
                incluir = seriesNumeros.includes(serieNumero);
              }
            }

            if (incluir) itens.push(ev);
          });
        } catch (e) { console.error(`Erro ${subName}:`, e); }
      }

      // Filtra próximos 7 dias e ordena
      const proximos = itens.filter(ev => {
        if (!ev.data) return false;
        const [a, m, dd] = ev.data.split('-').map(Number);
        const dt = new Date(a, m - 1, dd);
        dt.setHours(0, 0, 0, 0);
        return dt >= hoje && dt <= limite;
      }).sort((a, b) => a.data.localeCompare(b.data));

      const notifs: any[] = [];

      // Lembretes vencidos
      itens.forEach(item => {
        if (item.tipo === 'lembrete') {
          const [a, m, d] = item.data.split('-').map(Number);
          const dt = new Date(a, m - 1, d);
          dt.setHours(0, 0, 0, 0);
          if (dt < hoje) {
            notifs.push({
              id: item.id,
              tipo: 'lembrete_vencido',
              titulo: item.titulo,
              data: item.data,
              icon: 'alert-circle'
            });
          }
        }
      });

      // Provas nos próximos 7 dias
      itens.forEach(item => {
        if (item.tipo === 'Prova') {
          notifs.push({
            id: item.id,
            tipo: 'prova_proxima',
            titulo: item.titulo,
            data: item.data,
            icon: 'document-text'
          });
        }
      });

      setNotificacoes(notifs);

      setAgendaItens(proximos);
    } catch (e) {
      console.error('Erro ao carregar agenda:', e);
    }
  };

  const postsValidos = useMemo(
    () => posts.filter(postValido),
    [posts]
  );

  // ── Busca no feed ──────────────────────────────────────────
  const [termoBusca, setTermoBusca] = useState('');

  const postsFiltrados = useMemo(() => {
    const termo = termoBusca.trim().toLowerCase();
    if (!termo) return postsValidos;
    return postsValidos.filter(p => {
      const titulo    = (p.titulo    || '').toLowerCase();
      const categoria = (p.categoria || '').toLowerCase();
      const catLabel  = (CATEGORIA_CONFIG[p.categoria]?.label || '').toLowerCase();
      return titulo.includes(termo) || categoria.includes(termo) || catLabel.includes(termo);
    });
  }, [postsValidos, termoBusca]);

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
      const uid   = userData?.uid;
      const jaLeu = post.leitores?.includes(uid);
      if (!jaLeu && uid) {
        await updateDoc(doc(db, 'posts', post.id), {
          visualizacoes: increment(1),
          leitores: arrayUnion(uid),
        });
      }
    } catch (e) {}
  };

  const handleSair = async () => {
    await AsyncStorage.removeItem('uid');
    setMiniMenuAberto(false);
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  // ── Card de destaque (capa real + categoria como badge) ──
  const renderDestaqueCard = (post: any) => {
    const config = CATEGORIA_CONFIG[post.categoria] || CATEGORIA_CONFIG.avisos;
    const novo   = ehNovo(post);

    
    const a11yLabel = [
      config.label,
      post.titulo,
      `${post.visualizacoes || 0} visualizações`,
      novo ? 'publicação nova' : null,
    ].filter(Boolean).join('. ');

    return (
      <TouchableOpacity
        key={post.id}
        style={[styles.destCard, { width: DESTAQUE_W }]}
        onPress={() => modoEdicao && isSuperAdmin
          ? navigation.navigate('EditorPost', { postId: post.id, categoria: post.categoria, current: post })
          : visualizarPost(post)
        }
        activeOpacity={0.85}
        accessible
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        accessibilityHint={
          modoEdicao && isSuperAdmin
            ? 'Toque duplo para editar este post'
            : 'Toque duplo para abrir o post'
        }
      >
        {post.capa
          ? <Image
              source={{ uri: post.capa }}
              style={StyleSheet.absoluteFillObject}
              // ✅ Acessibilidade #5 — imagem decorativa (título já lido pelo card)
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
          : <View style={[StyleSheet.absoluteFillObject, { backgroundColor: CORES.azulEscuro }]} />
        }

        
        <LinearGradient
          colors={
            modoEscuro
              ? ['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.92)']
              : ['rgba(11,32,70,0.10)', 'rgba(11,32,70,0.55)', 'rgba(11,32,70,0.92)']
          }
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        <View style={styles.destTopo}>
          <View style={[styles.destBadge, { backgroundColor: catBg(config) }]}>
            <MaterialIcons name={config.icon} size={9} color={config.color} />
            <Text
              style={[styles.destBadgeText, { color: config.color, fontSize: fs(8) }]}
              accessibilityElementsHidden
              importantForAccessibility="no"
            >
              {config.label}
            </Text>
          </View>
          {novo && (
            <View style={styles.destNovoBadge}>
              <Text style={[styles.destNovoText, { fontSize: fs(9) }]}>NOVO</Text>
            </View>
          )}
        </View>

        <View>
          <Text style={[styles.destTitulo, { fontSize: fs(14) }]} numberOfLines={2}>
            {post.titulo}
          </Text>
          <View style={styles.destMeta}>
            <Ionicons name="eye" size={10} color="rgba(255,255,255,0.85)" />
            <Text style={[styles.destMetaText, { fontSize: fs(10) }]}>
              {post.visualizacoes || 0} visualizações
            </Text>
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

  // ── Card de agenda (abre mini modal) ──
  const renderAgendaCard = ({ item }: any) => {
    const config  = TIPO_CONFIG[item.tipo] || TIPO_CONFIG.Evento;
    const [, m, d] = item.data.split('-').map(Number);
    const cont    = calcDias(item.data);

    const a11yLabel = [
      config.label,
      item.titulo,
      `dia ${d} de ${MESES[m - 1]}`,
      cont.texto || null,
    ].filter(Boolean).join('. ');

    return (
      <TouchableOpacity
        style={[
          styles.agCard,
          { backgroundColor: C.branco, borderColor: C.cinzaClaro, borderLeftColor: config.color }
        ]}
        onPress={() => { setEventoSelecionado(item); setModalEvento(true); }}
        activeOpacity={0.85}
        accessible
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        accessibilityHint="Toque duplo para ver detalhes do evento"
      >
        <View
          style={[styles.agData, { backgroundColor: catBg(config) }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Text style={[styles.agDataDia, { color: config.color, fontSize: fs(17) }]}>
            {String(d).padStart(2,'0')}
          </Text>
          <Text style={[styles.agDataMes, { color: config.color, fontSize: fs(9) }]}>
            {MESES_ABREV[m-1]}
          </Text>
        </View>

        <View style={styles.agConteudo}>
          <View style={styles.agTopo}>
            <View style={[styles.agTipoBadge, { backgroundColor: catBg(config) }]}>
              <Text style={[styles.agTipoBadgeText, { color: config.color, fontSize: fs(8) }]}>
                {config.label}
              </Text>
            </View>
            {cont.texto !== '' && (
              <View style={[styles.agChipMini, { backgroundColor: cont.cor + '22' }]}>
                <Text style={[styles.agChipMiniText, { color: cont.cor, fontSize: fs(8) }]}>
                  {cont.texto}
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.agTitulo, { color: C.azulEscuro, fontSize: fs(13) }]} numberOfLines={1}>
            {item.titulo}
          </Text>
          <Text style={[styles.agMeta, { color: textoSecAcc, fontSize: fs(10) }]}>
            {item.fonte === 'lembrete'
              ? 'Meu lembrete pessoal'
              : `Agenda escolar · ${(item.series || []).join(' · ')}`}
          </Text>
        </View>

        <Ionicons
          name="chevron-forward"
          size={14}
          color={C.cinzaClaro}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      </TouchableOpacity>
    );
  };

  // ── Tab item (com label visível para todas as abas, inclusive central) ──
  const TabItem = ({ icon, label, onPress, ativo, accessibilityHint }: any) => (
    <TouchableOpacity
      style={styles.tabItem}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected: !!ativo }}
    >
      <Ionicons
        name={icon}
        size={22}
        color={ativo ? C.azulEscuro : C.textoSec}
      />
      <Text style={[
        styles.tabLabel,
        { color: C.textoSec, fontSize: fs(10) },
        ativo && { color: C.azulEscuro, fontFamily: F.bold }
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: C.fundo }]}>
      <StatusBar
        barStyle={modoEscuro ? "light-content" : "dark-content"}
        backgroundColor={C.branco}
      />

      {/* ═══ NAVBAR ═══ */}
      <View style={[
        styles.navbar,
        { paddingTop: insets.top, backgroundColor: C.branco, borderBottomColor: C.cinzaClaro }
      ]}>
        <View
          style={styles.logoWrap}
          accessible
          accessibilityRole="header"
          accessibilityLabel="JUMO"
        >
          <View
            style={styles.dotAmarelo}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
          {/* Logo: cor da identidade — JU adapta, MO sempre rosa */}
          <Text style={[styles.logoText, { fontSize: fs(26) }]} importantForAccessibility="no">
            <Text style={{ color: C.azulEscuro }}>JU</Text>
            <Text style={{ color: CORES.rosa }}>MO</Text>
          </Text>
        </View>

        <View style={styles.navRight}>
          {temPermissaoDeStaff && (
            <TouchableOpacity
              onPress={() => setModoEdicao(!modoEdicao)}
              hitSlop={HIT_SLOP_SM}
              accessibilityRole="switch"
              accessibilityLabel={modoEdicao ? 'Desativar modo editor' : 'Ativar modo editor'}
              accessibilityState={{ checked: modoEdicao }}
              style={[
                styles.btnEdit,
                { backgroundColor: C.branco, borderColor: C.cinzaClaro },
                modoEdicao && {
                  backgroundColor: modoEscuro ? C.amarelo : CORES.azulEscuro,
                  borderColor: modoEscuro ? C.amarelo : CORES.azulEscuro
                }
              ]}
            >
              <FontAwesome5
                name="pen"
                size={11}
                color={
                  modoEdicao
                    ? (modoEscuro ? CORES.azulEscuro : '#FFF')
                    : C.azulEscuro
                }
              />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.btnSino, { backgroundColor: C.fundo }]}
            onPress={() => setModalNotif(true)}
            hitSlop={HIT_SLOP_SM}
            accessibilityRole="button"
            accessibilityLabel={
              (notificacoes.filter(n => !notificacoesDescartadas.has(n.id)).length + notificacoesChat.length) > 0
                ? `Notificações, ${notificacoes.filter(n => !notificacoesDescartadas.has(n.id)).length + notificacoesChat.length} novas`
                : 'Notificações'
            }
            accessibilityHint="Toque duplo para ver suas notificações"
          >
            <Ionicons name="notifications-outline" size={18} color={C.azulEscuro} />
            {(notificacoes.filter(n => !notificacoesDescartadas.has(n.id)).length + notificacoesChat.length) > 0 && (
              <View
                style={[styles.dotNotifBadge, { borderColor: C.branco, backgroundColor: CORES.rosa }]}
                accessibilityElementsHidden
                importantForAccessibility="no"
              >
                <Text style={styles.dotNotifText}>
                  {(() => {
                    const total = notificacoes.filter(n => !notificacoesDescartadas.has(n.id)).length + notificacoesChat.length;
                    return total > 9 ? '9+' : total;
                  })()}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.avatarBtn,
              { borderColor: C.azulEscuro, backgroundColor: C.cinzaClaro }
            ]}
            onPress={() => navigation.navigate('Perfil', { uid: userData?.uid })}
            hitSlop={HIT_SLOP_SM}
            accessibilityRole="button"
            accessibilityLabel={`Perfil de ${primeiroNome}`}
            accessibilityHint="Toque duplo para abrir seu perfil"
          >
            {userData?.foto
              ? <Image
                  source={{ uri: userData.foto }}
                  style={styles.avatarImg}
                  accessible={false}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
              : <View style={styles.avatarPlaceholder}>
                  <MaterialIcons name="person" size={20} color={C.azulEscuro} />
                </View>
            }
          </TouchableOpacity>
        </View>
      </View>

      {/* ═══ BARRA DE BUSCA ═══ */}
      <View style={[styles.searchWrap, { backgroundColor: C.branco, borderBottomColor: C.cinzaClaro }]}>
        <View style={[styles.searchBox, { backgroundColor: C.fundo }]}>
          <MaterialIcons name="search" size={18} color={C.textoSec} />
          <TextInput
            style={[styles.searchInput, { color: C.azulEscuro, fontFamily: F.regular }]}
            placeholder="Buscar posts..."
            placeholderTextColor={C.textoSec}
            value={termoBusca}
            onChangeText={setTermoBusca}
            returnKeyType="search"
            clearButtonMode="while-editing"
            accessibilityLabel="Campo de busca de posts"
          />
          {termoBusca.length > 0 && (
            <TouchableOpacity onPress={() => setTermoBusca('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialIcons name="close" size={16} color={C.textoSec} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
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
      >

        {/* SAUDAÇÃO */}
        <View
          style={styles.saudacaoWrap}
          accessible
          accessibilityRole="header"
          accessibilityLabel={`Olá, ${primeiroNome}. O que você vai explorar hoje?`}
        >
          <Text style={[styles.saudacaoTexto, { color: C.azulEscuro, fontSize: fs(22) }]} importantForAccessibility="no">
            O que você vai explorar hoje,{'\n'}
            <Text style={[styles.saudacaoNome, { color: C.azulEscuro }]}>{primeiroNome}?</Text>
          </Text>
        </View>

        {modoEdicao && (
          <View
            style={[
              styles.alertEdicao,
              { backgroundColor: modoEscuro ? C.amarelo : CORES.azulEscuro }
            ]}
            accessible
            accessibilityRole="alert"
            accessibilityLabel="Modo editor ativado"
          >
            <Ionicons
              name="alert-circle"
              size={15}
              color={modoEscuro ? CORES.azulEscuro : '#FFF'}
            />
            <Text style={[
              styles.txtEdicao,
              { color: modoEscuro ? CORES.azulEscuro : '#FFF', fontSize: fs(12) }
            ]}>
              MODO EDITOR ATIVADO
            </Text>
          </View>
        )}

        {/* ═══ DESTAQUES ═══ */}
        <View style={styles.secaoHeader}>
          <View accessible accessibilityRole="header">
            <Text style={[styles.secaoEyebrow, { color: textoSecAcc, fontSize: fs(10) }]}>
              EM DESTAQUE
            </Text>
            <Text style={[styles.secaoTituloPequeno, { color: C.azulEscuro, fontSize: fs(16) }]}>
              Confira agora
            </Text>
          </View>

          <View style={styles.navDestRow}>
            {modoEdicao && isSuperAdmin && (
              <TouchableOpacity
                style={styles.btnNovoPost}
                onPress={() => navigation.navigate('EditorPost', { categoria: 'destaque' })}
                hitSlop={HIT_SLOP_MD}
                accessibilityRole="button"
                accessibilityLabel="Criar novo post"
              >
                <MaterialIcons name="add" size={16} color="#FFF" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.navDestBtn, { backgroundColor: C.fundo, borderColor: C.cinzaClaro }]}
              onPress={() => irParaSlide(destaqueIdx - 1)}
              disabled={slidesDestaque.length <= 1}
              hitSlop={HIT_SLOP_MD}
              accessibilityRole="button"
              accessibilityLabel="Slide anterior"
              accessibilityState={{ disabled: slidesDestaque.length <= 1 }}
            >
              <Ionicons name="chevron-back" size={14} color={C.textoSec} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.navDestBtn,
                {
                  backgroundColor: modoEscuro ? C.amarelo : CORES.azulEscuro,
                  borderColor: modoEscuro ? C.amarelo : CORES.azulEscuro
                }
              ]}
              onPress={() => irParaSlide(destaqueIdx + 1)}
              disabled={slidesDestaque.length <= 1}
              hitSlop={HIT_SLOP_MD}
              accessibilityRole="button"
              accessibilityLabel="Próximo slide"
              accessibilityState={{ disabled: slidesDestaque.length <= 1 }}
            >
              <Ionicons
                name="chevron-forward"
                size={14}
                color={modoEscuro ? CORES.azulEscuro : '#FFF'}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* ─ Resultados de busca (substitui o carrossel quando há termo) ─ */}
        {termoBusca.trim().length > 0 ? (
          <View style={{ paddingHorizontal: 18, paddingTop: 8 }}>
            {postsFiltrados.length === 0 ? (
              <View style={[styles.destEmpty, { backgroundColor: C.branco, borderColor: C.cinzaClaro }]}>
                <MaterialIcons name="search-off" size={32} color={C.cinzaClaro} />
                <Text style={[styles.destEmptyText, { color: C.textoSec, fontSize: fs(13) }]}>
                  Nenhum post encontrado para "{termoBusca}"
                </Text>
              </View>
            ) : (
              postsFiltrados.map(post => (
                <View key={post.id} style={{ marginBottom: 10 }}>
                  {renderDestaqueCard(post)}
                </View>
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
                <View style={styles.slideWrap}>
                  {par.map((post: any) => renderDestaqueCard(post))}
                  {par.length === 1 && <View style={{ width: DESTAQUE_W }} />}
                </View>
              )}
            />

            {/* ✅ Acessibilidade #3 — indicadores tappáveis com área de toque ≥44px */}
            <View
              style={styles.indicadores}
              accessibilityRole="tablist"
              accessibilityLabel="Navegação do carrossel"
            >
              {slidesDestaque.map((_, i) => {
                const ativo = i === destaqueIdx;
                return (
                  <TouchableOpacity
                    key={i}
                    onPress={() => irParaSlide(i)}
                    hitSlop={HIT_SLOP_DOT}
                    activeOpacity={0.7}
                    style={styles.indicadorTouch}
                    accessibilityRole="button"
                    accessibilityLabel={`Slide ${i + 1} de ${slidesDestaque.length}`}
                    accessibilityState={{ selected: ativo }}
                  >
                    <View
                      style={[
                        styles.indicador,
                        { backgroundColor: C.cinzaClaro },
                        ativo && {
                          width: 18,
                          backgroundColor: modoEscuro ? C.amarelo : CORES.azulEscuro
                        }
                      ]}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        ) : (
          <View style={[
            styles.destEmpty,
            { backgroundColor: C.branco, borderColor: C.cinzaClaro }
          ]}>
            <Ionicons
              name="newspaper-outline"
              size={32}
              color={C.cinzaClaro}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
            <Text style={[styles.destEmptyText, { color: textoSecAcc, fontSize: fs(13) }]}>
              Nenhum post recente.
            </Text>
            {modoEdicao && isSuperAdmin && (
              <TouchableOpacity
                style={styles.btnPrimeiroPost}
                onPress={() => navigation.navigate('EditorPost', { categoria: 'destaque' })}
                accessibilityRole="button"
                accessibilityLabel="Criar primeiro post"
              >
                <MaterialIcons name="add" size={14} color="#FFF" />
                <Text style={[styles.btnPrimeiroPostText, { fontSize: fs(12) }]}>
                  Criar primeiro post
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ═══ AGENDA ═══ */}
        <View style={[styles.secaoHeader, { marginTop: 28 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} accessible accessibilityRole="header">
            <View
              style={[styles.iconAgendaWrap, { backgroundColor: C.cinzaClaro }]}
              accessibilityElementsHidden
              importantForAccessibility="no"
            >
              <Ionicons name="calendar" size={14} color={C.azulEscuro} />
            </View>
            <View>
              <Text style={[styles.secaoEyebrow, { color: textoSecAcc, fontSize: fs(10) }]}>
                PRÓXIMOS 7 DIAS
              </Text>
              <Text style={[styles.secaoTituloPequeno, { color: C.azulEscuro, fontSize: fs(16) }]}>
                Seu dia no JUMO
              </Text>
            </View>
          </View>

          {agendaItens.length > 0 && (
            <View
              style={[
                styles.contagemBadge,
                { backgroundColor: modoEscuro ? C.amarelo : CORES.azulEscuro }
              ]}
              accessible
              accessibilityLabel={`${agendaItens.length} ${agendaItens.length === 1 ? 'evento' : 'eventos'} nos próximos 7 dias`}
            >
              <Text style={[
                styles.contagemBadgeText,
                { color: modoEscuro ? CORES.azulEscuro : '#FFF', fontSize: fs(11) }
              ]}>
                {agendaItens.length}
              </Text>
            </View>
          )}
        </View>

        {/* Filtro admin */}
        {isAdmin && (
          <View style={styles.filtroSerieRow} accessibilityRole="tablist">
            {['todas','1º','2º','3º'].map(s => {
              const ativo = serieFiltroAdm === s;
              const label = s === 'todas' ? 'Todas' : `${s} Ano`;
              return (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.filtroSerieBtn,
                    { backgroundColor: C.branco, borderColor: modoEscuro ? C.cinzaClaro : '#CBD2DC' },
                    ativo && {
                      backgroundColor: modoEscuro ? C.amarelo : CORES.azulEscuro,
                      borderColor: modoEscuro ? C.amarelo : CORES.azulEscuro
                    }
                  ]}
                  onPress={() => setSerieFiltroAdm(s)}
                  accessibilityRole="tab"
                  accessibilityLabel={`Filtro: ${label}`}
                  accessibilityState={{ selected: ativo }}
                >
                  <Text style={[
                    styles.filtroSerieText,
                    { color: textoSecAcc, fontSize: fs(12) },
                    ativo && { color: modoEscuro ? CORES.azulEscuro : '#FFF' }
                  ]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {agendaItens.length > 0 ? (
          <View style={styles.agListaWrap}>
            <FlatList
              data={agendaItens}
              keyExtractor={item => `${item.fonte}-${item.id}`}
              renderItem={renderAgendaCard}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
              scrollEnabled={agendaItens.length > 3}
              style={{ maxHeight: 280 }}
            />
          </View>
        ) : (
          <View style={[
            styles.agEmpty,
            { backgroundColor: C.branco, borderColor: C.cinzaClaro }
          ]}>
            <View
              style={[styles.agEmptyIcon, { backgroundColor: C.fundo }]}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Text style={{ fontSize: 28 }}>😎</Text>
            </View>
            <Text style={[styles.agEmptyTitulo, { color: C.azulEscuro, fontSize: fs(15) }]}>
              Nada agendado por aqui
            </Text>
            <Text style={[styles.agEmptySub, { color: textoSecAcc, fontSize: fs(12) }]}>
              Aproveite a folga ou adicione um lembrete no calendário!
            </Text>
            <TouchableOpacity
              style={[styles.btnAbrirCalendario, { backgroundColor: C.fundo }]}
              onPress={() => navigation.navigate('Calendario', {
                uid: userData?.uid, tipo: userData?.tipo, turma: userData?.turma
              })}
              accessibilityRole="button"
              accessibilityLabel="Abrir calendário"
              accessibilityHint="Vai para a tela completa da agenda"
            >
              <Text style={[styles.btnAbrirCalendarioText, { color: C.azulEscuro, fontSize: fs(12) }]}>
                Abrir calendário
              </Text>
              <Ionicons name="arrow-forward" size={13} color={C.azulEscuro} />
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* ═══ TAB BAR ═══ */}
      <View
        style={[
          styles.tabBar,
          { paddingBottom: insets.bottom, backgroundColor: C.branco, borderTopColor: C.cinzaClaro }
        ]}
        accessibilityRole="tablist"
        accessibilityLabel="Navegação principal"
      >
        <TabItem
          icon="home"
          label="Início"
          ativo
          onPress={() => {}}
          accessibilityHint="Você está na tela inicial"
        />
        <TabItem
          icon="calendar-outline"
          label="Agenda"
          onPress={() => navigation.navigate('Calendario', { uid: userData?.uid, tipo: userData?.tipo, turma: userData?.turma })}
          accessibilityHint="Abre o calendário completo"
        />

        <View style={styles.centerTab}>
          <TouchableOpacity
            style={[styles.centerBtn, { borderColor: C.branco }]}
            onPress={() => navigation.navigate('Match', { uid: userData?.uid })}
            accessibilityRole="button"
            accessibilityLabel="Match"
            accessibilityHint="Abre a tela do Match"
          >
            <Ionicons name="people" size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={[styles.tabLabel, styles.centerLabel, { color: CORES.rosa, fontSize: fs(10) }]}>
            Match
          </Text>
        </View>

        <TabItem
          icon="document-text-outline"
          label="Resumos"
          onPress={() => navigation.navigate('Resumos', { uid: userData?.uid })}
          accessibilityHint="Abre a tela de resumos"
        />
        <TabItem
          icon="ellipsis-horizontal"
          label="Mais"
          onPress={() => setMiniMenuAberto(true)}
          accessibilityHint="Abre o menu com mais opções"
        />
      </View>

      {/* MENU MAIS */}
      <Modal
        visible={miniMenuAberto}
        transparent
        animationType="fade"
        onRequestClose={() => setMiniMenuAberto(false)}
      >
        <TouchableWithoutFeedback
          onPress={() => setMiniMenuAberto(false)}
          accessibilityLabel="Fechar menu"
        >
          <View style={styles.menuOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.menuPopup, { backgroundColor: C.branco }]} accessibilityRole="menu">
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => { setMiniMenuAberto(false); navigation.navigate('Contatos'); }}
                  accessibilityRole="menuitem"
                  accessibilityLabel="Contatos"
                >
                  <Ionicons name="call" size={17} color={C.azulEscuro} />
                  <Text style={[styles.menuItemText, { color: C.azulEscuro, fontSize: fs(14) }]}>
                    Contatos
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => { setMiniMenuAberto(false); navigation.navigate('Ajuda'); }}
                  accessibilityRole="menuitem"
                  accessibilityLabel="Ajuda"
                >
                  <Ionicons name="help-circle" size={17} color={C.azulEscuro} />
                  <Text style={[styles.menuItemText, { color: C.azulEscuro, fontSize: fs(14) }]}>
                    Ajuda
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => { setMiniMenuAberto(false); navigation.navigate('Configuracoes', { uid: userData?.uid }); }}
                  accessibilityRole="menuitem"
                  accessibilityLabel="Configurações"
                >
                  <Ionicons name="settings" size={17} color={C.azulEscuro} />
                  <Text style={[styles.menuItemText, { color: C.azulEscuro, fontSize: fs(14) }]}>
                    Configurações
                  </Text>
                </TouchableOpacity>

                {isAdmin && (
                  <>
                    <View style={[styles.menuDivider, { backgroundColor: C.cinzaClaro }]} />
                    <TouchableOpacity
                      style={styles.menuItem}
                      onPress={() => { setMiniMenuAberto(false); navigation.navigate('Admin', { uid: userData?.uid }); }}
                      accessibilityRole="menuitem"
                      accessibilityLabel="Painel Admin"
                    >
                      <Ionicons name="shield-checkmark" size={17} color={C.azulEscuro} />
                      <Text style={[styles.menuItemText, { color: C.azulEscuro, fontSize: fs(14) }]}>
                        Painel Admin
                      </Text>
                    </TouchableOpacity>
                  </>
                )}

                <View style={[styles.menuDivider, { backgroundColor: C.cinzaClaro }]} />
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={handleSair}
                  accessibilityRole="menuitem"
                  accessibilityLabel="Sair da conta"
                >
                  <Ionicons name="log-out" size={17} color="#FF5252" />
                  <Text style={[styles.menuItemText, { color: '#FF5252', fontSize: fs(14) }]}>
                    Sair
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ═══ MINI MODAL EVENTO ═══ */}
      <Modal
        visible={modalEvento}
        transparent
        animationType="slide"
        onRequestClose={() => setModalEvento(false)}
      >
        <View style={styles.evModalOverlay}>
          <View style={[styles.evModalSheet, { backgroundColor: C.branco }]}>
            <View
              style={[styles.evModalHandle, { backgroundColor: C.cinzaClaro }]}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />

            {eventoSelecionado && (() => {
              const config   = TIPO_CONFIG[eventoSelecionado.tipo] || TIPO_CONFIG.Evento;
              const [a,m,d]  = eventoSelecionado.data.split('-').map(Number);
              const obj      = new Date(a, m - 1, d);
              const diaSem   = DIAS_SEMANA[obj.getDay()];
              const cont     = calcDias(eventoSelecionado.data);

              return (
                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={[styles.evHero, { backgroundColor: catBg(config) }]}>
                    <View
                      style={[styles.evHeroIcon, { backgroundColor: config.color }]}
                      accessibilityElementsHidden
                      importantForAccessibility="no"
                    >
                      <Ionicons name={config.icon} size={26} color="#FFF" />
                    </View>
                    <Text style={[styles.evHeroTipo, { color: config.color, fontSize: fs(11) }]}>
                      {config.label}
                    </Text>
                    <Text
                      style={[styles.evHeroTitulo, { color: C.azulEscuro, fontSize: fs(20) }]}
                      accessibilityRole="header"
                    >
                      {eventoSelecionado.titulo}
                    </Text>

                    {cont.texto !== '' && (
                      <View
                        style={[styles.evContagem, { backgroundColor: cont.cor }]}
                        accessible
                        accessibilityLabel={cont.texto}
                      >
                        <Ionicons name="time" size={12} color="#FFF" />
                        <Text style={[styles.evContagemText, { fontSize: fs(11) }]}>
                          {cont.texto}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.evInfoRow}>
                    <View style={[styles.evInfoBox, { backgroundColor: C.fundo }]}>
                      <Ionicons name="calendar" size={15} color={config.color} />
                      <Text style={[styles.evInfoLabel, { color: textoSecAcc, fontSize: fs(9) }]}>DATA</Text>
                      <Text style={[styles.evInfoValor, { color: C.azulEscuro, fontSize: fs(15) }]}>
                        {d} de {MESES[m-1]}
                      </Text>
                      <Text style={[styles.evInfoSub, { color: textoSecAcc, fontSize: fs(11) }]}>
                        {diaSem}, {a}
                      </Text>
                    </View>
                    <View style={[styles.evInfoBox, { backgroundColor: C.fundo }]}>
                      <Ionicons
                        name={eventoSelecionado.fonte === 'lembrete' ? 'bookmark' : 'people'}
                        size={15}
                        color={config.color}
                      />
                      <Text style={[styles.evInfoLabel, { color: textoSecAcc, fontSize: fs(9) }]}>
                        {eventoSelecionado.fonte === 'lembrete' ? 'TIPO' : 'SÉRIES'}
                      </Text>
                      <Text style={[styles.evInfoValor, { color: C.azulEscuro, fontSize: fs(15) }]}>
                        {eventoSelecionado.fonte === 'lembrete' ? 'Pessoal' : (eventoSelecionado.series || []).length}
                      </Text>
                      <Text style={[styles.evInfoSub, { color: textoSecAcc, fontSize: fs(11) }]}>
                        {eventoSelecionado.fonte === 'lembrete'
                          ? 'Meu lembrete'
                          : (eventoSelecionado.series || []).join(' · ')}
                      </Text>
                    </View>
                  </View>

                  {eventoSelecionado.descricao ? (
                    <View style={[styles.evDescBox, { backgroundColor: C.fundo }]}>
                      <Text style={[styles.evDescLabel, { color: textoSecAcc, fontSize: fs(9) }]}>
                        DESCRIÇÃO
                      </Text>
                      <Text style={[styles.evDescTexto, { color: C.azulEscuro, fontSize: fs(13) }]}>
                        {eventoSelecionado.descricao}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.evBtnRow}>
                    <TouchableOpacity
                      style={[styles.evBtnSecundario, { backgroundColor: C.fundo }]}
                      onPress={() => {
                        setModalEvento(false);
                        setTimeout(() => navigation.navigate('Calendario', {
                          uid: userData?.uid, tipo: userData?.tipo, turma: userData?.turma
                        }), 200);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Ver no calendário"
                    >
                      <Ionicons name="calendar-outline" size={14} color={C.azulEscuro} />
                      <Text style={[styles.evBtnSecundarioText, { color: C.azulEscuro, fontSize: fs(12) }]}>
                        Ver no calendário
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.evBtnPrimario,
                        { backgroundColor: modoEscuro ? C.amarelo : CORES.azulEscuro }
                      ]}
                      onPress={() => setModalEvento(false)}
                      accessibilityRole="button"
                      accessibilityLabel="Fechar"
                    >
                      <Text style={[
                        styles.evBtnPrimarioText,
                        { color: modoEscuro ? CORES.azulEscuro : '#FFF', fontSize: fs(12) }
                      ]}>
                        Fechar
                      </Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* MODAL POST */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={[styles.modalWrap, { backgroundColor: C.fundo }]}>
          <View style={styles.modalCover}>
            {selectedPost?.capa
              ? <Image
                  source={{ uri: selectedPost.capa }}
                  style={StyleSheet.absoluteFillObject}
                  accessible={false}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
              : <View style={[StyleSheet.absoluteFillObject, { backgroundColor: CORES.azulEscuro, justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={[styles.logoMini, { fontSize: fs(36) }]} importantForAccessibility="no">
                    JU<Text style={{ color: CORES.rosa }}>MO</Text>
                  </Text>
                </View>
            }
            <View
              style={styles.modalCoverOverlay}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
            <TouchableOpacity
              style={styles.btnFechar}
              onPress={() => setModalVisible(false)}
              hitSlop={HIT_SLOP_SM}
              accessibilityRole="button"
              accessibilityLabel="Fechar post"
            >
              <Ionicons name="chevron-down" size={26} color="#FFF" />
            </TouchableOpacity>
          </View>

          <View style={[styles.modalBody, { backgroundColor: C.branco }]}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 28, paddingBottom: 60 }}>
              {selectedPost?.tags?.length > 0 && (
                <View style={styles.tagsRow}>
                  {selectedPost.tags.map((tag: string, i: number) => (
                    <View
                      key={i}
                      style={[
                        styles.tag,
                        { backgroundColor: modoEscuro ? CORES.rosa + '25' : '#FFE4EC' }
                      ]}
                    >
                      <Text style={[styles.tagText, { fontSize: fs(11) }]}>{tag}</Text>
                    </View>
                  ))}
                </View>
              )}
              <Text
                style={[styles.modalTitulo, { color: C.azulEscuro, fontSize: fs(26) }]}
                accessibilityRole="header"
              >
                {selectedPost?.titulo}
              </Text>
              {selectedPost?.subtitulo && (
                <Text style={[styles.modalSub, { color: textoSecAcc, fontSize: fs(15) }]}>
                  {selectedPost.subtitulo}
                </Text>
              )}
              <View style={[styles.modalMeta, { backgroundColor: C.fundo }]}>
                <View style={styles.autorRow}>
                  <View style={[
                    styles.autorAvatar,
                    { backgroundColor: modoEscuro ? C.amarelo : CORES.azulEscuro }
                  ]}>
                    <MaterialIcons
                      name="person"
                      size={18}
                      color={modoEscuro ? CORES.azulEscuro : '#FFF'}
                    />
                  </View>
                  <View>
                    <Text style={[styles.autorNome, { color: C.azulEscuro, fontSize: fs(14) }]}>
                      {selectedPost?.autor || 'Gestão JUMO'}
                    </Text>
                    <Text style={[styles.autorRole, { color: textoSecAcc, fontSize: fs(11) }]}>
                      Autor(a)
                    </Text>
                  </View>
                </View>
                <View style={[styles.viewsPill, { backgroundColor: C.branco }]}>
                  <Ionicons name="eye" size={14} color={CORES.rosa} />
                  <Text style={[styles.viewsText, { fontSize: fs(12) }]}>
                    {selectedPost?.visualizacoes} views
                  </Text>
                </View>
              </View>
              <View style={[styles.modalDivider, { backgroundColor: C.cinzaClaro }]} />
              <Text style={[
                styles.modalConteudo,
                { color: modoEscuro ? '#D0D5DC' : '#4A4A68', fontSize: fs(16) }
              ]}>
                {selectedPost?.conteudo}
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL NOTIFICAÇÕES */}
      <Modal
        visible={modalNotif}
        transparent
        animationType="slide"
        onRequestClose={() => setModalNotif(false)}
      >
        <View style={[styles.evModalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.evModalSheet, { backgroundColor: C.branco }]}>
            <View
              style={[styles.evModalHandle, { backgroundColor: C.cinzaClaro }]}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />

            {/* Cabeçalho + Limpar */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <Text
                style={[styles.evHeroTitulo, { color: C.azulEscuro, fontSize: fs(18), flex: 1 }]}
                accessibilityRole="header"
              >
                Notificações
              </Text>
              {(notificacoesChat.length > 0 || notificacoes.filter(n => !notificacoesDescartadas.has(n.id)).length > 0) && (
                <TouchableOpacity
                  onPress={() => {
                    // Limpa mensagens de chat
                    limparNotificacoesChat();
                    // Descarta notificações de agenda atuais
                    const idsAtivos = notificacoes.map(n => n.id);
                    const novoSet = new Set([...notificacoesDescartadas, ...idsAtivos]);
                    setNotificacoesDescartadas(novoSet);
                    AsyncStorage.setItem('notif_descartadas', JSON.stringify([...novoSet])).catch(() => {});
                  }}
                  hitSlop={HIT_SLOP_SM}
                  accessibilityRole="button"
                  accessibilityLabel="Limpar todas as notificações"
                >
                  <Text style={{ color: CORES.rosa, fontSize: fs(13), fontFamily: F.bold }}>
                    Limpar tudo
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {notificacoesChat.length === 0 && notificacoes.filter(n => !notificacoesDescartadas.has(n.id)).length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Ionicons
                  name="notifications-off"
                  size={40}
                  color={C.cinzaClaro}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
                <Text style={[{ color: textoSecAcc, fontSize: fs(14), marginTop: 12 }]}>
                  Nenhuma notificação
                </Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>

                {/* ── Mensagens recebidas ── */}
                {notificacoesChat.length > 0 && (
                  <>
                    <Text style={[styles.agMeta, { color: textoSecAcc, fontSize: fs(10), marginBottom: 8, letterSpacing: 0.6 }]}>
                      MENSAGENS
                    </Text>
                    {notificacoesChat.map(item => (
                      <TouchableOpacity
                        key={item.id}
                        style={[styles.agCard, { backgroundColor: C.fundo, borderColor: C.cinzaClaro, borderLeftColor: CORES.rosa, marginBottom: 8 }]}
                        onPress={() => {
                          setModalNotif(false);
                          navigation.navigate('Chat', { outroUid: item.outroUid, outroNome: item.outroNome });
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Mensagem de ${item.nome}: ${item.corpo}`}
                      >
                        {item.foto ? (
                          <Image
                            source={{ uri: item.foto.startsWith('http') || item.foto.startsWith('data:') ? item.foto : `data:image/jpeg;base64,${item.foto}` }}
                            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.cinzaClaro }}
                          />
                        ) : (
                          <View style={[styles.agData, { backgroundColor: '#F0E6FF' }]}>
                            <Ionicons name="chatbubble-ellipses" size={16} color={CORES.rosa} />
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.agTitulo, { color: C.azulEscuro, fontSize: fs(13) }]} numberOfLines={1}>
                            {item.nome}
                          </Text>
                          <Text style={[styles.agMeta, { color: textoSecAcc, fontSize: fs(11) }]} numberOfLines={1}>
                            {item.corpo}
                          </Text>
                        </View>
                        <Text style={{ color: textoSecAcc, fontSize: fs(10), alignSelf: 'flex-start', marginTop: 2 }}>
                          {item.quando.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </>
                )}

                {/* ── Agenda ── */}
                {notificacoes.filter(n => !notificacoesDescartadas.has(n.id)).length > 0 && (
                  <>
                    <Text style={[styles.agMeta, { color: textoSecAcc, fontSize: fs(10), marginBottom: 8, marginTop: notificacoesChat.length > 0 ? 12 : 0, letterSpacing: 0.6 }]}>
                      AGENDA
                    </Text>
                    {notificacoes.filter(n => !notificacoesDescartadas.has(n.id)).map(item => (
                      <View
                        key={item.id}
                        style={[styles.agCard, { backgroundColor: C.fundo, borderColor: C.cinzaClaro, borderLeftColor: item.tipo === 'lembrete_vencido' ? '#e74c3c' : '#e67e22', marginBottom: 8 }]}
                        accessible
                        accessibilityRole="text"
                        accessibilityLabel={`${item.tipo === 'lembrete_vencido' ? 'Lembrete vencido' : 'Prova próxima'}: ${item.titulo}`}
                      >
                        <View style={[styles.agData, { backgroundColor: item.tipo === 'lembrete_vencido' ? '#FDECEA' : '#FEF3E7' }]}>
                          <Ionicons
                            name={item.icon}
                            size={18}
                            color={item.tipo === 'lembrete_vencido' ? '#e74c3c' : '#e67e22'}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.agTitulo, { color: C.azulEscuro, fontSize: fs(13) }]}>
                            {item.titulo}
                          </Text>
                          <Text style={[styles.agMeta, { color: textoSecAcc, fontSize: fs(10) }]}>
                            {item.tipo === 'lembrete_vencido' ? '⚠️ Vencido' : '📅 Próximo'}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </>
                )}

              </ScrollView>
            )}

            <TouchableOpacity
              style={[styles.evBtnPrimario, { backgroundColor: modoEscuro ? C.amarelo : CORES.azulEscuro, marginTop: 16 }]}
              onPress={() => setModalNotif(false)}
              accessibilityRole="button"
              accessibilityLabel="Fechar notificações"
            >
              <Text style={[styles.evBtnPrimarioText, { color: modoEscuro ? CORES.azulEscuro : '#FFF', fontSize: fs(13) }]}>
                Fechar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Modal de level-up ── */}
      {levelUpInfo && (
        <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={() => setLevelUpInfo(null)}>
          <TouchableWithoutFeedback onPress={() => setLevelUpInfo(null)}>
            <View style={levelUpStyles.backdrop}>
              <TouchableWithoutFeedback>
                <Animated.View style={[
                  levelUpStyles.card,
                  { backgroundColor: modoEscuro ? '#0B2046' : CORES.branco,
                    opacity: levelUpOpacity,
                    transform: [{ scale: levelUpScale }] },
                ]}>
                  {/* Gradiente de fundo decorativo */}
                  <LinearGradient
                    colors={[CORES.azulEscuro, CORES.azulMedio]}
                    style={levelUpStyles.header}
                  >
                    <Text style={levelUpStyles.headerLabel}>🎉 SUBIU DE NÍVEL!</Text>
                    <Text style={levelUpStyles.animalEmoji}>{levelUpInfo.iconeAnimal}</Text>
                    <Text style={levelUpStyles.subfaseEmoji}>{levelUpInfo.iconeSubfase}</Text>
                  </LinearGradient>

                  <View style={levelUpStyles.body}>
                    <Text style={[levelUpStyles.nivelTitulo, { color: modoEscuro ? CORES.amarelo : CORES.azulEscuro }]}>
                      {levelUpInfo.nomeSubfase} {levelUpInfo.nomeAnimal}
                    </Text>
                    <Text style={[levelUpStyles.conceito, { color: C.textoSec }]}>
                      {levelUpInfo.conceitoRank}
                    </Text>
                    <TouchableOpacity
                      style={[levelUpStyles.btnFechar, { backgroundColor: CORES.rosa }]}
                      onPress={() => setLevelUpInfo(null)}
                      activeOpacity={0.85}
                    >
                      <Text style={levelUpStyles.btnFecharText}>Incrível! 🚀</Text>
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}

      {/* ── Toast de check-in diário ── */}
      {checkInToast && (
        <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={() => setCheckInToast(null)}>
          <View style={toastStyles.overlay} pointerEvents="none">
            <Animated.View style={[
              toastStyles.card,
              { backgroundColor: modoEscuro ? '#1B3868' : CORES.branco,
                opacity: checkInOpacity,
                transform: [{ translateY: checkInSlide }] },
            ]}>
              <Text style={toastStyles.emoji}>🌱</Text>
              <View>
                <Text style={[toastStyles.titulo, { color: modoEscuro ? '#fff' : CORES.azulEscuro }]}>
                  Check-in do dia!
                </Text>
                <Text style={[toastStyles.subtitulo, { color: CORES.textoSec }]}>
                  +{checkInToast.xp} XP · +{checkInToast.moedas} Sementes
                  {checkInToast.streak > 1 ? `  🔥 ${checkInToast.streak} dias seguidos` : ''}
                </Text>
              </View>
            </Animated.View>
          </View>
        </Modal>
      )}

    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1 },

  // NAVBAR
  navbar:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, minHeight: 64, borderBottomWidth: 1 },
  searchWrap:    { paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1 },
  searchBox:     { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, gap: 8 },
  searchInput:   { flex: 1, fontSize: 14, padding: 0 },
  logoWrap:      { position: 'relative', flexDirection: 'row', alignItems: 'center' },
  dotAmarelo:    { position: 'absolute', top: 2, left: -4, width: 7, height: 7, borderRadius: 4, backgroundColor: CORES.amarelo, zIndex: 1 },
  logoText:      { fontFamily: F.black, letterSpacing: -1 },
  navRight:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnEdit:       { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5 },
  btnSino:       { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', position: 'relative' },

  dotNotifBadge: { position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5 },
  dotNotifText:  { color: '#FFF', fontSize: 9, fontFamily: F.bold, textAlign: 'center', lineHeight: 11 },

  avatarBtn:     { width: 36, height: 36, borderRadius: 18, overflow: 'hidden', borderWidth: 2 },
  avatarImg:     { width: '100%', height: '100%' },
  avatarPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  scrollContent: { paddingBottom: 20 },

  // SAUDAÇÃO
  saudacaoWrap:  { paddingHorizontal: 18, paddingTop: 22, paddingBottom: 8 },
  saudacaoTexto: { fontFamily: F.bold, lineHeight: 28, letterSpacing: -0.4 },
  saudacaoNome:  { fontFamily: F.black },

  // ALERTA EDITOR
  alertEdicao:   { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, padding: 10, marginHorizontal: 18, marginTop: 10 },
  txtEdicao:     { fontFamily: F.bold },

  // SEÇÃO HEADER
  secaoHeader:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, marginTop: 18, marginBottom: 12 },
  secaoEyebrow:       { fontFamily: F.black, letterSpacing: 1.4 },
  secaoTituloPequeno: { fontFamily: F.black, marginTop: 2, letterSpacing: -0.3 },
  iconAgendaWrap:     { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  contagemBadge:      { minWidth: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 },
  contagemBadgeText:  { fontFamily: F.black },

  // CARROSSEL
  navDestRow:         { flexDirection: 'row', alignItems: 'center', gap: 6 },
  btnNovoPost:        { width: 30, height: 30, borderRadius: 15, backgroundColor: CORES.rosa, justifyContent: 'center', alignItems: 'center' },
  navDestBtn:         { width: 30, height: 30, borderRadius: 15, borderWidth: 0.5, justifyContent: 'center', alignItems: 'center' },

  slideWrap:     { width, paddingHorizontal: 18, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  destCard:      { width: DESTAQUE_W, height: DESTAQUE_W, borderRadius: 20, padding: 14, justifyContent: 'space-between', overflow: 'hidden', elevation: 4, shadowColor: CORES.azulEscuro, shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  // 🗑 destOverlay removido — substituído por <LinearGradient> dentro do card (correção #2)
  destTopo:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  destBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  destBadgeText: { fontFamily: F.black, letterSpacing: 0.6 },
  destNovoBadge: { backgroundColor: CORES.amarelo, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  destNovoText:  { fontFamily: F.black, color: CORES.azulEscuro, letterSpacing: 0.6 },
  destTitulo:    { fontFamily: F.bold, color: CORES.branco, lineHeight: 18, letterSpacing: -0.2, textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  destMeta:      { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  destMetaText:  { color: 'rgba(255,255,255,0.92)', fontFamily: F.semibold, textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  destEditBadge: { position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },

  indicadores:    { flexDirection: 'row', justifyContent: 'center', gap: 4, marginTop: 12, paddingHorizontal: 18 },
  indicadorTouch: { width: 44, height: 30, alignItems: 'center', justifyContent: 'center' },
  indicador:      { width: 5, height: 5, borderRadius: 3 },

  destEmpty:      { alignItems: 'center', paddingVertical: 40, gap: 10, marginHorizontal: 18, borderRadius: 18, borderWidth: 0.5 },
  destEmptyText:  { fontFamily: F.semibold },
  btnPrimeiroPost:    { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: CORES.rosa, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  btnPrimeiroPostText:{ color: '#FFF', fontFamily: F.bold },

  // FILTRO ADMIN
  filtroSerieRow:     { flexDirection: 'row', gap: 8, paddingHorizontal: 18, marginBottom: 10 },
  filtroSerieBtn:     { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: 'center' }, // 8→10 p/ folga vertical
  filtroSerieText:    { fontFamily: F.bold },

  // AGENDA
  agListaWrap:    { paddingHorizontal: 18 },
  agCard:         { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 10, borderWidth: 0.5, borderLeftWidth: 3 },
  agData:         { width: 44, height: 50, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  agDataDia:      { fontFamily: F.black, lineHeight: 20 },
  agDataMes:      { fontFamily: F.black, letterSpacing: 0.8, marginTop: 2 },
  agConteudo:     { flex: 1, gap: 3 },
  agTopo:         { flexDirection: 'row', alignItems: 'center', gap: 5 },
  agTipoBadge:    { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  agTipoBadgeText:{ fontFamily: F.black, letterSpacing: 0.5 },
  agChipMini:     { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, marginLeft: 'auto' as any },
  agChipMiniText: { fontFamily: F.black, letterSpacing: 0.5 },
  agTitulo:       { fontFamily: F.bold },
  agMeta:         { fontFamily: F.semibold },

  agEmpty:        { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24, marginHorizontal: 18, borderRadius: 18, borderWidth: 0.5, gap: 10 },
  agEmptyIcon:    { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  agEmptyTitulo:  { fontFamily: F.black },
  agEmptySub:     { textAlign: 'center', lineHeight: 18, fontFamily: F.regular },
  btnAbrirCalendario:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, marginTop: 4 }, // 8→10
  btnAbrirCalendarioText: { fontFamily: F.bold },

  // TAB BAR
  tabBar:        { position: 'absolute', bottom: 0, width: '100%', height: Platform.OS === 'ios' ? 84 : 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', borderTopWidth: 1, paddingBottom: Platform.OS === 'ios' ? 18 : 0, elevation: 20 },
  tabItem:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabLabel:      { fontFamily: F.semibold, marginTop: 3 },
  centerTab:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerBtn:     { width: 54, height: 54, borderRadius: 27, backgroundColor: CORES.rosa, justifyContent: 'center', alignItems: 'center', marginTop: -22, borderWidth: 4, elevation: 6, shadowColor: CORES.rosa, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  centerLabel:   { marginTop: -2, fontFamily: F.bold },

  // MENU MAIS
  menuOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.08)' },
  menuPopup:     { position: 'absolute', bottom: Platform.OS === 'ios' ? 95 : 78, right: 14, borderRadius: 16, paddingVertical: 8, width: 170, elevation: 12, shadowColor: CORES.azulEscuro, shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  menuItem:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 16 },
  menuItemText:  { fontFamily: F.bold },
  menuDivider:   { height: 1, marginHorizontal: 14, marginVertical: 4 },

  // MINI MODAL EVENTO
  evModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  evModalSheet:   { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 36, maxHeight: '85%' },
  evModalHandle:  { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  evHero:         { borderRadius: 20, padding: 22, alignItems: 'center', marginBottom: 14 },
  evHeroIcon:     { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  evHeroTipo:     { fontFamily: F.black, letterSpacing: 1.4, marginBottom: 6 },
  evHeroTitulo:   { fontFamily: F.black, textAlign: 'center', letterSpacing: -0.3, lineHeight: 26 },
  evContagem:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginTop: 12 },
  evContagemText: { color: '#FFF', fontFamily: F.black, letterSpacing: 0.6 },
  evInfoRow:      { flexDirection: 'row', gap: 10, marginBottom: 12 },
  evInfoBox:      { flex: 1, borderRadius: 14, padding: 12, gap: 3 },
  evInfoLabel:    { fontFamily: F.black, letterSpacing: 1, marginTop: 4 },
  evInfoValor:    { fontFamily: F.black },
  evInfoSub:      { fontFamily: F.semibold },
  evDescBox:      { borderRadius: 14, padding: 12, marginBottom: 12 },
  evDescLabel:    { fontFamily: F.black, letterSpacing: 1, marginBottom: 5 },
  evDescTexto:    { lineHeight: 19, fontFamily: F.regular },
  evBtnRow:       { flexDirection: 'row', gap: 8, marginTop: 4 },
  evBtnSecundario:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 13, borderRadius: 12 },
  evBtnSecundarioText:{ fontFamily: F.bold },
  evBtnPrimario:      { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  evBtnPrimarioText:  { fontFamily: F.bold },

  // MODAL POST
  modalWrap:         { flex: 1 },
  modalCover:        { width: '100%', height: height * 0.52, position: 'absolute', top: 0 },
  modalCoverOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  logoMini:          { fontFamily: F.black, color: '#FFF', opacity: 0.2 },
  btnFechar:         { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 28, right: 18, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 22, width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  modalBody:         { flex: 1, marginTop: height * 0.46, borderTopLeftRadius: 36, borderTopRightRadius: 36, overflow: 'hidden', elevation: 20 },
  tagsRow:           { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  tag:               { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  tagText:           { color: CORES.rosa, fontFamily: F.black, letterSpacing: 0.5, textTransform: 'uppercase' },
  modalTitulo:       { fontFamily: F.black, lineHeight: 32, marginBottom: 8, letterSpacing: -0.5 },
  modalSub:          { fontStyle: 'italic', marginBottom: 20, lineHeight: 22, fontFamily: F.regular },
  modalMeta:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 16 },
  autorRow:          { flexDirection: 'row', alignItems: 'center', gap: 10 },
  autorAvatar:       { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  autorNome:         { fontFamily: F.black },
  autorRole:         { fontFamily: F.regular },
  viewsPill:         { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  viewsText:         { fontFamily: F.black, color: CORES.rosa },
  modalDivider:      { height: 3, width: 40, borderRadius: 2, alignSelf: 'center', marginVertical: 24 },
  modalConteudo:     { lineHeight: 26, fontFamily: F.medium },
});

// ── Modal de level-up ──
const levelUpStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  card: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 24,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    gap: 4,
  },
  headerLabel:  { fontFamily: F.black, fontSize: 13, color: CORES.amarelo, letterSpacing: 1.5, marginBottom: 8 },
  animalEmoji:  { fontSize: 52 },
  subfaseEmoji: { fontSize: 26, marginTop: 4 },
  body: {
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  nivelTitulo:  { fontFamily: F.black,    fontSize: 22, textAlign: 'center' },
  conceito:     { fontFamily: F.medium,   fontSize: 13, textAlign: 'center', lineHeight: 19, opacity: 0.85 },
  btnFechar: {
    marginTop: 8,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
  },
  btnFecharText:{ fontFamily: F.bold, fontSize: 15, color: '#fff' },
});

// ── Toast de check-in (separado para manter escopos limpos) ──
const toastStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 44 : 32,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 16,
    minWidth: 240,
  },
  emoji:    { fontSize: 28 },
  titulo:   { fontFamily: F.bold,    fontSize: 13, marginBottom: 1 },
  subtitulo:{ fontFamily: F.medium,  fontSize: 12 },
});