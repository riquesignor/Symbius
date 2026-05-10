import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  Image, SafeAreaView, StatusBar, Dimensions,
  Modal, TouchableWithoutFeedback, Platform, FlatList
} from 'react-native';
import { db } from '../config/firebaseConfig';
import {
  doc, getDoc, collection, onSnapshot, query, orderBy,
  updateDoc, increment, arrayUnion, where, getDocs
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppSettings } from '../contexts/AppSettingsContext';

import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');
const DESTAQUE_W = (width - 18 * 2 - 10) / 2;

// ✅ Tempo (em dias) que um post fica visível na home após ser publicado
const DIAS_VALIDADE_POST = 30;

// ✅ Fonte padrão — funciona com Poppins (se instalada) ou cai no system
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
  cinzaClaro:      '#EAEFF4',
  cinzaInput:      '#F0F4F8',
  textoSecundario: '#8D99AE',
  branco:          '#FFFFFF',
};

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
  if (diff === 0)  return { texto: 'É HOJE',           cor: '#e74c3c' };
  if (diff === 1)  return { texto: 'É AMANHÃ',         cor: '#e67e22' };
  if (diff > 0)    return { texto: `FALTAM ${diff} DIAS`, cor: CORES.azulEscuro };
  return { texto: '',  cor: CORES.textoSecundario };
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
  const insets = useSafeAreaInsets();
  const [userData, setUserData]                 = useState<any>(null);
  const [posts, setPosts]                       = useState<any[]>([]);
  const [agendaItens, setAgendaItens]           = useState<any[]>([]);
  const [modalVisible, setModalVisible]         = useState(false);
  const [selectedPost, setSelectedPost]         = useState<any>(null);
  const [modoEdicao, setModoEdicao]             = useState(false);
  const [miniMenuAberto, setMiniMenuAberto]     = useState(false);
  const [destaqueIdx, setDestaqueIdx]           = useState(0);
  const [serieFiltroAdm, setSerieFiltroAdm]     = useState('todas');

  const [modalEvento, setModalEvento]           = useState(false);
  const [eventoSelecionado, setEventoSelecionado] = useState<any>(null);

  const { cores: C, fonteScale, modoEscuro } = useAppSettings();
  const fs = (size: number) => size * fonteScale;

  const catBg = (cfg: any) => modoEscuro ? cfg.color + '25' : cfg.bg;

  const carrosselRef = useRef<FlatList>(null);

  // ── Permissões ──
  const userEmail           = userData?.email_escolar || '';
  const isSuperAdmin        = userEmail.endsWith('@anchieta.br') || userData?.tipo?.toLowerCase() === 'administrador';
  const isAdmin             = userData?.tipo?.toLowerCase() === 'administrador';
  const isGremio            = userData?.tipo === 'Gremista';
  const temPermissaoDeStaff = isSuperAdmin || isGremio;
  const primeiroNome        = userData?.nome_completo?.split(' ')[0] || 'aluno';

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

    carregarPerfil();
    return () => unsubPosts();
  }, []);

  // ── Carregar agenda ──
  useEffect(() => {
    if (!userData?.uid) return;
    carregarAgenda();
  }, [userData?.uid, serieFiltroAdm, isAdmin]);

 const carregarAgenda = async () => {
  try {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const limite = new Date(hoje);
    limite.setDate(limite.getDate() + 7);

    const itens: any[] = [];

    // ✅ LEMBRETES — agora buscamos da subcollection do RA
    if (userData?.uid) {
      // ✅ Não usa RA se for inválido (admin com "N/A", etc)
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

    // ✅ EVENTOS ADMIN — busca de todas as 4 collections
  for (const tipo of Object.keys(TIPO_COLLECTION)) {
  const subName = TIPO_COLLECTION[tipo];
  const subRef = collection(db, 'eventos_admin', 'tipos', subName);

  try {
    const snapE = await getDocs(subRef);

    snapE.forEach((d: any) => {
      const ev = { id: d.id, fonte: 'admin', ...d.data() };
      const series: string[] = ev.series || [];

      // ✅ Normaliza: pega só o primeiro dígito de cada série
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

    setAgendaItens(proximos);
  } catch (e) {
    console.error('Erro ao carregar agenda:', e);
  }
};

  // ✅ Posts válidos (todas categorias, dentro da validade)
  const postsValidos = useMemo(
    () => posts.filter(postValido),
    [posts]
  );

  // ✅ Pares pra carrossel (2 por slide)
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

    return (
      <TouchableOpacity
        key={post.id}
        style={[styles.destCard, { width: DESTAQUE_W }]}
        onPress={() => modoEdicao && isSuperAdmin
          ? navigation.navigate('EditorPost', { postId: post.id, categoria: post.categoria, current: post })
          : visualizarPost(post)
        }
        activeOpacity={0.85}
      >
        {post.capa
          ? <Image source={{ uri: post.capa }} style={StyleSheet.absoluteFillObject} />
          : <View style={[StyleSheet.absoluteFillObject, { backgroundColor: CORES.azulEscuro }]} />
        }
        <View style={[
          styles.destOverlay,
          modoEscuro && { backgroundColor: 'rgba(0,0,0,0.55)' }
        ]} />

        <View style={styles.destTopo}>
          <View style={[styles.destBadge, { backgroundColor: catBg(config) }]}>
            <MaterialIcons name={config.icon} size={9} color={config.color} />
            <Text style={[styles.destBadgeText, { color: config.color, fontSize: fs(8) }]}>
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
          <Text style={[styles.destTitulo, { fontSize: fs(14) }]} numberOfLines={3}>
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

    return (
      <TouchableOpacity
        style={[
          styles.agCard,
          { backgroundColor: C.branco, borderColor: C.cinzaClaro, borderLeftColor: config.color }
        ]}
        onPress={() => { setEventoSelecionado(item); setModalEvento(true); }}
        activeOpacity={0.85}
      >
        <View style={[styles.agData, { backgroundColor: catBg(config) }]}>
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
          <Text style={[styles.agMeta, { color: C.textoSec, fontSize: fs(10) }]}>
            {item.fonte === 'lembrete'
              ? 'Meu lembrete pessoal'
              : `Agenda escolar · ${(item.series || []).join(' · ')}`}
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={14} color={C.cinzaClaro} />
      </TouchableOpacity>
    );
  };

  const TabItem = ({ icon, label, onPress, ativo }: any) => (
    <TouchableOpacity style={styles.tabItem} onPress={onPress}>
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
        <View style={styles.logoWrap}>
          <View style={styles.dotAmarelo} />
          {/* Logo: cor da identidade — JU adapta, MO sempre rosa */}
          <Text style={[styles.logoText, { fontSize: fs(26) }]}>
            <Text style={{ color: C.azulEscuro }}>JU</Text>
            <Text style={{ color: CORES.rosa }}>MO</Text>
          </Text>
        </View>

        <View style={styles.navRight}>
          {temPermissaoDeStaff && (
            <TouchableOpacity
              onPress={() => setModoEdicao(!modoEdicao)}
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

          <TouchableOpacity style={[styles.btnSino, { backgroundColor: C.fundo }]}>
            <Ionicons name="notifications-outline" size={18} color={C.azulEscuro} />
            <View style={[styles.dotNotif, { borderColor: C.branco }]} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.avatarBtn,
              { borderColor: C.azulEscuro, backgroundColor: C.cinzaClaro }
            ]}
            onPress={() => navigation.navigate('Perfil', { uid: userData?.uid })}
          >
            {userData?.foto
              ? <Image source={{ uri: userData.foto }} style={styles.avatarImg} />
              : <View style={styles.avatarPlaceholder}>
                  <MaterialIcons name="person" size={20} color={C.azulEscuro} />
                </View>
            }
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* SAUDAÇÃO */}
        <View style={styles.saudacaoWrap}>
          <Text style={[styles.saudacaoTexto, { color: C.azulEscuro, fontSize: fs(22) }]}>
            O que você vai explorar hoje,{'\n'}
            <Text style={[styles.saudacaoNome, { color: C.azulEscuro }]}>{primeiroNome}?</Text>
          </Text>
        </View>

        {modoEdicao && (
          <View style={[
            styles.alertEdicao,
            { backgroundColor: modoEscuro ? C.amarelo : CORES.azulEscuro }
          ]}>
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
          <View>
            <Text style={[styles.secaoEyebrow, { color: C.textoSec, fontSize: fs(10) }]}>
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
              >
                <MaterialIcons name="add" size={16} color="#FFF" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.navDestBtn, { backgroundColor: C.fundo, borderColor: C.cinzaClaro }]}
              onPress={() => irParaSlide(destaqueIdx - 1)}
              disabled={slidesDestaque.length <= 1}
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
            >
              <Ionicons
                name="chevron-forward"
                size={14}
                color={modoEscuro ? CORES.azulEscuro : '#FFF'}
              />
            </TouchableOpacity>
          </View>
        </View>

        {slidesDestaque.length > 0 ? (
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

            <View style={styles.indicadores}>
              {slidesDestaque.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.indicador,
                    { backgroundColor: C.cinzaClaro },
                    i === destaqueIdx && {
                      width: 18,
                      backgroundColor: modoEscuro ? C.amarelo : CORES.azulEscuro
                    }
                  ]}
                />
              ))}
            </View>
          </>
        ) : (
          <View style={[
            styles.destEmpty,
            { backgroundColor: C.branco, borderColor: C.cinzaClaro }
          ]}>
            <Ionicons name="newspaper-outline" size={32} color={C.cinzaClaro} />
            <Text style={[styles.destEmptyText, { color: C.textoSec, fontSize: fs(13) }]}>
              Nenhum post recente.
            </Text>
            {modoEdicao && isSuperAdmin && (
              <TouchableOpacity
                style={styles.btnPrimeiroPost}
                onPress={() => navigation.navigate('EditorPost', { categoria: 'destaque' })}
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={[styles.iconAgendaWrap, { backgroundColor: C.cinzaClaro }]}>
              <Ionicons name="calendar" size={14} color={C.azulEscuro} />
            </View>
            <View>
              <Text style={[styles.secaoEyebrow, { color: C.textoSec, fontSize: fs(10) }]}>
                PRÓXIMOS 7 DIAS
              </Text>
              <Text style={[styles.secaoTituloPequeno, { color: C.azulEscuro, fontSize: fs(16) }]}>
                Seu dia no JUMO
              </Text>
            </View>
          </View>

          {agendaItens.length > 0 && (
            <View style={[
              styles.contagemBadge,
              { backgroundColor: modoEscuro ? C.amarelo : CORES.azulEscuro }
            ]}>
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
          <View style={styles.filtroSerieRow}>
            {['todas','1º','2º','3º'].map(s => {
              const ativo = serieFiltroAdm === s;
              return (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.filtroSerieBtn,
                    { backgroundColor: C.branco, borderColor: C.cinzaClaro },
                    ativo && {
                      backgroundColor: modoEscuro ? C.amarelo : CORES.azulEscuro,
                      borderColor: modoEscuro ? C.amarelo : CORES.azulEscuro
                    }
                  ]}
                  onPress={() => setSerieFiltroAdm(s)}
                >
                  <Text style={[
                    styles.filtroSerieText,
                    { color: C.textoSec, fontSize: fs(12) },
                    ativo && { color: modoEscuro ? CORES.azulEscuro : '#FFF' }
                  ]}>
                    {s === 'todas' ? 'Todas' : `${s} Ano`}
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
            <View style={[styles.agEmptyIcon, { backgroundColor: C.fundo }]}>
              <Text style={{ fontSize: 28 }}>😎</Text>
            </View>
            <Text style={[styles.agEmptyTitulo, { color: C.azulEscuro, fontSize: fs(15) }]}>
              Nada agendado por aqui
            </Text>
            <Text style={[styles.agEmptySub, { color: C.textoSec, fontSize: fs(12) }]}>
              Aproveite a folga ou adicione um lembrete no calendário!
            </Text>
            <TouchableOpacity
              style={[styles.btnAbrirCalendario, { backgroundColor: C.fundo }]}
              onPress={() => navigation.navigate('Calendario', {
                uid: userData?.uid, tipo: userData?.tipo, turma: userData?.turma
              })}
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
      <View style={[
        styles.tabBar,
        { paddingBottom: insets.bottom, backgroundColor: C.branco, borderTopColor: C.cinzaClaro }
      ]}>
        <TabItem icon="home"             label="Início"  ativo onPress={() => {}} />
        <TabItem icon="calendar-outline" label="Agenda"        onPress={() => navigation.navigate('Calendario', { uid: userData?.uid, tipo: userData?.tipo, turma: userData?.turma })} />

        <View style={styles.centerTab}>
          <TouchableOpacity
            style={[styles.centerBtn, { borderColor: C.branco }]}
            onPress={() => navigation.navigate('Match', { uid: userData?.uid })}
          >
            <Ionicons name="heart" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>

        <TabItem icon="search-outline"      label="Achados" onPress={() => navigation.navigate('AchadosPerdidos', { uid: userData?.uid, tipo: userData?.tipo })} />
        <TabItem icon="ellipsis-horizontal" label="Mais"    onPress={() => setMiniMenuAberto(true)} />
      </View>

      {/* MENU MAIS */}
      <Modal visible={miniMenuAberto} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setMiniMenuAberto(false)}>
          <View style={styles.menuOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.menuPopup, { backgroundColor: C.branco }]}>
                <TouchableOpacity style={styles.menuItem} onPress={() => { setMiniMenuAberto(false); navigation.navigate('Contatos'); }}>
                  <Ionicons name="call" size={17} color={C.azulEscuro} />
                  <Text style={[styles.menuItemText, { color: C.azulEscuro, fontSize: fs(14) }]}>
                    Contatos
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={() => { setMiniMenuAberto(false); navigation.navigate('Ajuda'); }}>
                  <Ionicons name="help-circle" size={17} color={C.azulEscuro} />
                  <Text style={[styles.menuItemText, { color: C.azulEscuro, fontSize: fs(14) }]}>
                    Ajuda
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={() => { setMiniMenuAberto(false); navigation.navigate('Configuracoes', { uid: userData?.uid }); }}>
                  <Ionicons name="settings" size={17} color={C.azulEscuro} />
                  <Text style={[styles.menuItemText, { color: C.azulEscuro, fontSize: fs(14) }]}>
                    Configurações
                  </Text>
                </TouchableOpacity>

                {isAdmin && (
                  <>
                    <View style={[styles.menuDivider, { backgroundColor: C.cinzaClaro }]} />
                    <TouchableOpacity style={styles.menuItem} onPress={() => { setMiniMenuAberto(false); navigation.navigate('Admin', { uid: userData?.uid }); }}>
                      <Ionicons name="shield-checkmark" size={17} color={C.azulEscuro} />
                      <Text style={[styles.menuItemText, { color: C.azulEscuro, fontSize: fs(14) }]}>
                        Painel Admin
                      </Text>
                    </TouchableOpacity>
                  </>
                )}

                <View style={[styles.menuDivider, { backgroundColor: C.cinzaClaro }]} />
                <TouchableOpacity style={styles.menuItem} onPress={handleSair}>
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
      <Modal visible={modalEvento} transparent animationType="slide">
        <View style={styles.evModalOverlay}>
          <View style={[styles.evModalSheet, { backgroundColor: C.branco }]}>
            <View style={[styles.evModalHandle, { backgroundColor: C.cinzaClaro }]} />

            {eventoSelecionado && (() => {
              const config   = TIPO_CONFIG[eventoSelecionado.tipo] || TIPO_CONFIG.Evento;
              const [a,m,d]  = eventoSelecionado.data.split('-').map(Number);
              const obj      = new Date(a, m - 1, d);
              const diaSem   = DIAS_SEMANA[obj.getDay()];
              const cont     = calcDias(eventoSelecionado.data);

              return (
                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={[styles.evHero, { backgroundColor: catBg(config) }]}>
                    <View style={[styles.evHeroIcon, { backgroundColor: config.color }]}>
                      <Ionicons name={config.icon} size={26} color="#FFF" />
                    </View>
                    <Text style={[styles.evHeroTipo, { color: config.color, fontSize: fs(11) }]}>
                      {config.label}
                    </Text>
                    <Text style={[styles.evHeroTitulo, { color: C.azulEscuro, fontSize: fs(20) }]}>
                      {eventoSelecionado.titulo}
                    </Text>

                    {cont.texto !== '' && (
                      <View style={[styles.evContagem, { backgroundColor: cont.cor }]}>
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
                      <Text style={[styles.evInfoLabel, { color: C.textoSec, fontSize: fs(9) }]}>DATA</Text>
                      <Text style={[styles.evInfoValor, { color: C.azulEscuro, fontSize: fs(15) }]}>
                        {d} de {MESES[m-1]}
                      </Text>
                      <Text style={[styles.evInfoSub, { color: C.textoSec, fontSize: fs(11) }]}>
                        {diaSem}, {a}
                      </Text>
                    </View>
                    <View style={[styles.evInfoBox, { backgroundColor: C.fundo }]}>
                      <Ionicons
                        name={eventoSelecionado.fonte === 'lembrete' ? 'bookmark' : 'people'}
                        size={15}
                        color={config.color}
                      />
                      <Text style={[styles.evInfoLabel, { color: C.textoSec, fontSize: fs(9) }]}>
                        {eventoSelecionado.fonte === 'lembrete' ? 'TIPO' : 'SÉRIES'}
                      </Text>
                      <Text style={[styles.evInfoValor, { color: C.azulEscuro, fontSize: fs(15) }]}>
                        {eventoSelecionado.fonte === 'lembrete' ? 'Pessoal' : (eventoSelecionado.series || []).length}
                      </Text>
                      <Text style={[styles.evInfoSub, { color: C.textoSec, fontSize: fs(11) }]}>
                        {eventoSelecionado.fonte === 'lembrete'
                          ? 'Meu lembrete'
                          : (eventoSelecionado.series || []).join(' · ')}
                      </Text>
                    </View>
                  </View>

                  {eventoSelecionado.descricao ? (
                    <View style={[styles.evDescBox, { backgroundColor: C.fundo }]}>
                      <Text style={[styles.evDescLabel, { color: C.textoSec, fontSize: fs(9) }]}>
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
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={[styles.modalWrap, { backgroundColor: C.fundo }]}>
          <View style={styles.modalCover}>
            {selectedPost?.capa
              ? <Image source={{ uri: selectedPost.capa }} style={StyleSheet.absoluteFillObject} />
              : <View style={[StyleSheet.absoluteFillObject, { backgroundColor: CORES.azulEscuro, justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={[styles.logoMini, { fontSize: fs(36) }]}>
                    JU<Text style={{ color: CORES.rosa }}>MO</Text>
                  </Text>
                </View>
            }
            <View style={styles.modalCoverOverlay} />
            <TouchableOpacity style={styles.btnFechar} onPress={() => setModalVisible(false)}>
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
              <Text style={[styles.modalTitulo, { color: C.azulEscuro, fontSize: fs(26) }]}>
                {selectedPost?.titulo}
              </Text>
              {selectedPost?.subtitulo && (
                <Text style={[styles.modalSub, { color: C.textoSec, fontSize: fs(15) }]}>
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
                    <Text style={[styles.autorRole, { color: C.textoSec, fontSize: fs(11) }]}>
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

    </SafeAreaView>
  );
}

// ════════════════════════════════════════════════════════════════════════
// 🎨 STYLESHEET — sem cores hardcoded em elementos dinâmicos
// ════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: { flex: 1 },

  // NAVBAR
  navbar:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, height: 64, borderBottomWidth: 1 },
  logoWrap:      { position: 'relative', flexDirection: 'row', alignItems: 'center' },
  dotAmarelo:    { position: 'absolute', top: 2, left: -4, width: 7, height: 7, borderRadius: 4, backgroundColor: CORES.amarelo, zIndex: 1 },
  logoText:      { fontFamily: F.black, letterSpacing: -1 },
  navRight:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnEdit:       { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5 },
  btnSino:       { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  dotNotif:      { position: 'absolute', top: 7, right: 7, width: 8, height: 8, borderRadius: 4, backgroundColor: CORES.rosa, borderWidth: 1.5 },
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

  slideWrap:     { width, paddingHorizontal: 18, flexDirection: 'row', gap: 10 },
  destCard:      { aspectRatio: 1, borderRadius: 20, padding: 14, justifyContent: 'space-between', overflow: 'hidden', elevation: 4, shadowColor: CORES.azulEscuro, shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  destOverlay:   { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(11, 32, 70, 0.45)' },
  destTopo:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  destBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  destBadgeText: { fontFamily: F.black, letterSpacing: 0.6 },
  destNovoBadge: { backgroundColor: CORES.amarelo, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  destNovoText:  { fontFamily: F.black, color: CORES.azulEscuro, letterSpacing: 0.6 },
  destTitulo:    { fontFamily: F.bold, color: CORES.branco, lineHeight: 18, letterSpacing: -0.2 },
  destMeta:      { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  destMetaText:  { color: 'rgba(255,255,255,0.85)', fontFamily: F.semibold },
  destEditBadge: { position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },

  indicadores:    { flexDirection: 'row', justifyContent: 'center', gap: 4, marginTop: 12 },
  indicador:      { width: 5, height: 5, borderRadius: 3 },

  destEmpty:      { alignItems: 'center', paddingVertical: 40, gap: 10, marginHorizontal: 18, borderRadius: 18, borderWidth: 0.5 },
  destEmptyText:  { fontFamily: F.semibold },
  btnPrimeiroPost:    { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: CORES.rosa, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  btnPrimeiroPostText:{ color: '#FFF', fontFamily: F.bold },

  // FILTRO ADMIN
  filtroSerieRow:     { flexDirection: 'row', gap: 8, paddingHorizontal: 18, marginBottom: 10 },
  filtroSerieBtn:     { flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
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
  btnAbrirCalendario:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, marginTop: 4 },
  btnAbrirCalendarioText: { fontFamily: F.bold },

  // TAB BAR
  tabBar:        { position: 'absolute', bottom: 0, width: '100%', height: Platform.OS === 'ios' ? 84 : 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', borderTopWidth: 1, paddingBottom: Platform.OS === 'ios' ? 18 : 0, elevation: 20 },
  tabItem:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabLabel:      { fontFamily: F.semibold, marginTop: 3 },
  centerTab:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerBtn:     { width: 54, height: 54, borderRadius: 27, backgroundColor: CORES.rosa, justifyContent: 'center', alignItems: 'center', marginTop: -22, borderWidth: 4, elevation: 6, shadowColor: CORES.rosa, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },

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
  modalCover:        { width: '100%', height: height * 0.42, position: 'absolute', top: 0 },
  modalCoverOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  logoMini:          { fontFamily: F.black, color: '#FFF', opacity: 0.2 },
  btnFechar:         { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 28, right: 18, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 22, width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  modalBody:         { flex: 1, marginTop: height * 0.36, borderTopLeftRadius: 36, borderTopRightRadius: 36, overflow: 'hidden', elevation: 20 },
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
