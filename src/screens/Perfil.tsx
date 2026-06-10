import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  SafeAreaView, StatusBar, Modal, TextInput, ActivityIndicator,
  Image, Animated, Platform
} from 'react-native';
import { db } from '../config/firebaseConfig';
import {
  doc, getDoc, updateDoc, collection, getDocs, onSnapshot
} from 'firebase/firestore';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polygon, Circle, Line, Text as SvgText, G } from 'react-native-svg';
import { useAppSettings } from '../contexts/AppSettingsContext';
// ✅ GAMIFICAÇÃO
import { calcularFaseCoruja, calcularProgressoXp } from '../utils/gamification';

// ── Fonte Poppins ──
const F = {
  regular:  'Poppins_400Regular',
  medium:   'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold:     'Poppins_700Bold',
  black:    'Poppins_800ExtraBold',
};

// ── Paleta estática ──
const CORES = {
  azulEscuro: '#0B2046',
  rosa:       '#E51C6A',
  amarelo:    '#FFC82C',
  verde:      '#27ae60',
  vermelho:   '#e74c3c',
  laranja:    '#e67e22',
  roxo:       '#8e44ad',
  azulCeu:    '#3498db',
  fundo:      '#F5F7FA',
  branco:     '#FFFFFF',
  cinzaClaro: '#EAEFF4',
  textoSec:   '#8D99AE',
};

// ════════════════════════════════════════════════════════════════════════
//  ÁREAS DE CONHECIMENTO
// ════════════════════════════════════════════════════════════════════════
const AREAS = [
  { key: 'exatas',     label: 'Exatas',      cor: CORES.azulCeu },
  { key: 'humanas',    label: 'Humanas',     cor: CORES.laranja },
  { key: 'biologicas', label: 'Biológicas',  cor: CORES.verde },
  { key: 'linguagens', label: 'Linguagens',  cor: CORES.rosa },
  { key: 'tecnologia', label: 'Lógica',      cor: CORES.roxo },
];

const MATERIA_AREA: Record<string, string> = {
  'Matemática': 'exatas', 'Física': 'exatas', 'Química': 'exatas',
  'Cálculo': 'exatas', 'Estatística': 'exatas',
  'História': 'humanas', 'Geografia': 'humanas', 'Filosofia': 'humanas',
  'Sociologia': 'humanas', 'Atualidades': 'humanas',
  'Biologia': 'biologicas', 'Ciências': 'biologicas',
  'Anatomia': 'biologicas', 'Ecologia': 'biologicas',
  'Português': 'linguagens', 'Literatura': 'linguagens', 'Redação': 'linguagens',
  'Inglês': 'linguagens', 'Espanhol': 'linguagens',
  'Gramática': 'linguagens', 'Artes': 'linguagens',
  'Programação': 'tecnologia', 'Lógica': 'tecnologia', 'Robótica': 'tecnologia',
  'Banco de Dados': 'tecnologia', 'Web': 'tecnologia', 'Python': 'tecnologia',
};

const MATERIAS_DISPONIVEIS = Object.keys(MATERIA_AREA).sort();

// ════════════════════════════════════════════════════════════════════════
//  ANIMAÇÃO
// ════════════════════════════════════════════════════════════════════════
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
        transform: [{ translateY: anim.interpolate({ inputRange: [0,1], outputRange: [10, 0] }) }],
      },
    ]}>
      {children}
    </Animated.View>
  );
};

// ════════════════════════════════════════════════════════════════════════
//  RADAR CHART pequeno (estilo da imagem)
// ════════════════════════════════════════════════════════════════════════
const RadarChart = ({ scores, size, modoEscuro }: any) => {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.30;
  const N = AREAS.length;
  const labelDist = radius + size * 0.16;

  const getPoint = (i: number, dist: number) => {
    const angle = (i * 2 * Math.PI) / N - Math.PI / 2;
    return {
      x: cx + dist * Math.cos(angle),
      y: cy + dist * Math.sin(angle),
    };
  };

  const aneis = [0.5, 1.0];

  const scorePoints = scores
    .map((s: number, i: number) => {
      const p = getPoint(i, radius * Math.max(0.05, s));
      return `${p.x},${p.y}`;
    })
    .join(' ');

  const corLinhas = modoEscuro ? '#3A4048' : '#D8DEE6';
  const corLabel  = modoEscuro ? '#B4BEC8' : CORES.textoSec;
  const corPolig  = CORES.azulCeu;

  return (
    <Svg width={size} height={size}>
      {aneis.map((nivel, idx) => {
        const pts = scores
          .map((_: any, i: number) => {
            const p = getPoint(i, radius * nivel);
            return `${p.x},${p.y}`;
          })
          .join(' ');
        return (
          <Polygon
            key={idx}
            points={pts}
            fill="none"
            stroke={corLinhas}
            strokeWidth={0.7}
            strokeDasharray={idx === 0 ? '2,3' : ''}
          />
        );
      })}

      {scores.map((_: any, i: number) => {
        const p = getPoint(i, radius);
        return (
          <Line
            key={i}
            x1={cx} y1={cy}
            x2={p.x} y2={p.y}
            stroke={corLinhas}
            strokeWidth={0.6}
          />
        );
      })}

      <Polygon
        points={scorePoints}
        fill={corPolig}
        fillOpacity={modoEscuro ? 0.35 : 0.28}
        stroke={corPolig}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />

      {AREAS.map((area, i) => {
        const p = getPoint(i, labelDist);
        return (
          <SvgText
            key={area.key}
            x={p.x}
            y={p.y}
            fill={corLabel}
            fontSize={size * 0.075}
            fontFamily={F.semibold}
            textAnchor="middle"
            alignmentBaseline="middle"
          >
            {area.label}
          </SvgText>
        );
      })}
    </Svg>
  );
};

// ════════════════════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ════════════════════════════════════════════════════════════════════════
export default function Perfil({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const uid = route?.params?.uid;

  const { cores: C, fonteScale, modoEscuro } = useAppSettings();
  const fs = (size: number) => size * fonteScale;

  const [usuario,      setUsuario]      = useState<any>(null);
  const [medalhas,     setMedalhas]     = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [salvando,     setSalvando]     = useState(false);
  const [toast,        setToast]        = useState('');

  const [modalBio,     setModalBio]     = useState(false);
  const [bioTemp,      setBioTemp]      = useState('');
  const [modalSkill,   setModalSkill]   = useState<'ensina' | 'melhorar' | null>(null);
  const [modalConfirmSair, setModalConfirmSair] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!uid) return;
    const unsubUser = onSnapshot(doc(db, 'usuarios', uid), (snap) => {
      if (snap.exists()) setUsuario({ uid: snap.id, ...snap.data() });
      setLoading(false);
    });
    carregarMedalhas();
    return () => unsubUser();
  }, [uid]);

  const carregarMedalhas = async () => {
    try {
      const userSnap = await getDoc(doc(db, 'usuarios', uid));
      if (!userSnap.exists()) return;
      const idsVisiveis: string[] = userSnap.data()?.medalhas_visiveis || [];
      if (idsVisiveis.length === 0) { setMedalhas([]); return; }
      const snapAll = await getDocs(collection(db, 'medalhas'));
      const todas = snapAll.docs.map(d => ({ id: d.id, ...d.data() }));
      const minhas = todas.filter((m: any) => idsVisiveis.includes(m.id));
      setMedalhas(minhas);
    } catch (e) {
      console.error('Erro ao carregar medalhas:', e);
    }
  };

  const radarScores = useMemo(() => {
    if (!usuario) return AREAS.map(() => 0);
    const ensina  = usuario.posso_ensinar || [];
    const aprende = usuario.quer_aprender || [];
    const pontos: Record<string, number> = {};
    AREAS.forEach(a => { pontos[a.key] = 0; });
    ensina.forEach((m: string) => {
      const area = MATERIA_AREA[m];
      if (area) pontos[area] += 1;
    });
    aprende.forEach((m: string) => {
      const area = MATERIA_AREA[m];
      if (area) pontos[area] = Math.max(0, pontos[area] - 0.4);
    });
    const max = Math.max(1, ...Object.values(pontos));
    return AREAS.map(a => Math.min(1, pontos[a.key] / max));
  }, [usuario]);

  const abrirEdicaoBio = () => {
    setBioTemp(usuario?.bio || '');
    setModalBio(true);
  };

  const salvarBio = async () => {
    setSalvando(true);
    try {
      await updateDoc(doc(db, 'usuarios', uid), { bio: bioTemp.trim() });
      setToast('Bio atualizada');
      setModalBio(false);
    } catch { setToast('Erro ao salvar'); }
    finally { setSalvando(false); }
  };

  const toggleSkill = async (tipo: 'ensina' | 'melhorar', materia: string) => {
    if (!usuario) return;
    const campo = tipo === 'ensina' ? 'posso_ensinar' : 'quer_aprender';
    const lista: string[] = usuario[campo] || [];
    const nova = lista.includes(materia)
      ? lista.filter((m: string) => m !== materia)
      : [...lista, materia];
    try {
      await updateDoc(doc(db, 'usuarios', uid), { [campo]: nova });
      setToast(lista.includes(materia) ? 'Removido' : 'Adicionado');
    } catch { setToast('Erro ao salvar'); }
  };

  const sair = async () => {
    await AsyncStorage.removeItem('uid');
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  if (loading) return (
    <View style={[styles.centro, { backgroundColor: C.fundo }]}>
      <ActivityIndicator size="large" color={modoEscuro ? C.amarelo : CORES.azulEscuro} />
    </View>
  );

  if (!usuario) return (
    <View style={[styles.centro, { backgroundColor: C.fundo }]}>
      <Ionicons name="alert-circle" size={48} color={C.textoSec} />
      <Text style={[styles.semDadosText, { color: C.textoSec, fontSize: fs(14) }]}>
        Usuário não encontrado
      </Text>
    </View>
  );

  const isTutor = usuario.tipo?.toLowerCase() === 'gremista' || usuario.tipo?.toLowerCase() === 'administrador';
  const ensina  = usuario.posso_ensinar || [];
  const aprende = usuario.quer_aprender  || [];

  // Top matérias para mostrar no card de especialidades (max 3)
  const topMaterias = [...ensina].slice(0, 3);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: C.fundo }]}>
      <StatusBar
        barStyle={modoEscuro ? 'light-content' : 'dark-content'}
        backgroundColor={C.fundo}
      />

      {/* TOAST */}
      {toast !== '' && (
        <View style={[styles.toast, { top: insets.top + 12 }]}>
          <Ionicons name="checkmark-circle" size={15} color={CORES.amarelo} />
          <Text style={[styles.toastText, { fontSize: fs(12) }]}>{toast}</Text>
        </View>
      )}

      {/* ════════════════════════════════════════════════
          HEADER MINIMALISTA (logo JUMO no centro)
      ════════════════════════════════════════════════ */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.btnVoltar, { backgroundColor: C.branco }]}
        >
          <Ionicons name="arrow-back" size={18} color={C.azulEscuro} />
        </TouchableOpacity>

        <Text style={[styles.logoText, { fontSize: fs(22) }]}>
          <Text style={{ color: C.azulEscuro }}>JU</Text>
          <Text style={{ color: CORES.rosa }}>MO</Text>
        </Text>

        <TouchableOpacity style={[styles.btnMenu, { backgroundColor: C.branco }]}>
          <Ionicons name="ellipsis-horizontal" size={18} color={C.azulEscuro} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 50, paddingTop: 6 }}
      >
        {/* ════════════════════════════════════════════════
            HERO HORIZONTAL (foto à esquerda, nome à direita)
        ════════════════════════════════════════════════ */}
        <FadeInView delay={0}>
          <View style={[styles.heroCard, { backgroundColor: C.branco }]}>
            <View style={styles.fotoWrap}>
              {usuario.foto ? (
                <Image source={{ uri: usuario.foto }} style={styles.foto} />
              ) : (
                <View style={[styles.fotoPlaceholder, { backgroundColor: CORES.rosa + '20' }]}>
                  <Text style={[styles.fotoLetra, { fontSize: fs(34) }]}>
                    {usuario.nome_completo?.charAt(0)?.toUpperCase() || '?'}
                  </Text>
                </View>
              )}
              <TouchableOpacity style={styles.fotoEditBtn} activeOpacity={0.8}>
                <Ionicons name="camera" size={11} color="#FFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.heroInfo}>
              <Text
                style={[styles.nome, { color: C.azulEscuro, fontSize: fs(22) }]}
                numberOfLines={2}
              >
                {usuario.nome_completo || 'Sem nome'}
              </Text>
              {isTutor && (
                <View style={[styles.tutorBadge, { borderColor: CORES.verde + '60' }]}>
                  <FontAwesome5 name="graduation-cap" size={9} color={CORES.verde} />
                  <Text style={[styles.tutorBadgeText, { fontSize: fs(9) }]}>TUTOR</Text>
                </View>
              )}
            </View>
          </View>
        </FadeInView>

        {/* ════════════════════════════════════════════════
            XP & MOEDAS (GAMIFICAÇÃO MVP)
        ════════════════════════════════════════════════ */}
        <FadeInView delay={100}>
          <View style={styles.secao}>
            <Text style={[styles.secaoTituloPrincipal, { color: C.azulEscuro, fontSize: fs(15) }]}>
              Progresso
            </Text>

            {usuario ? (
              <View style={[styles.xpCard, { backgroundColor: C.branco }]}>
                {/* Fase Coruja + XP */}
                <View style={styles.xpCardTop}>
                  <View style={styles.corujhBox}>
                    <Text style={[styles.corujaEmoji, { fontSize: fs(48) }]}>
                      {calcularFaseCoruja(usuario.xp_total || 0).icone}
                    </Text>
                    <Text style={[styles.corujaLabel, { color: C.azulEscuro, fontSize: fs(12) }]}>
                      {calcularFaseCoruja(usuario.xp_total || 0).label}
                    </Text>
                  </View>

                  {/* XP Info */}
                  <View style={styles.xpInfo}>
                    <View style={styles.xpRow}>
                      <Text style={[styles.xpLabel, { color: C.textoSec, fontSize: fs(11) }]}>
                        EXPERIÊNCIA
                      </Text>
                      <Text style={[styles.xpNumero, { color: C.azulEscuro, fontSize: fs(16) }]}>
                        {usuario.xp_total || 0}
                      </Text>
                    </View>

                    {/* Progress Bar */}
                    <View style={[styles.xpBarBg, { backgroundColor: C.fundo }]}>
                      <View
                        style={[
                          styles.xpBarFill,
                          {
                            backgroundColor: CORES.amarelo,
                            width: `${calcularProgressoXp(usuario.xp_total || 0).percentual}%`,
                          },
                        ]}
                      />
                    </View>

                    <Text style={[styles.xpFaltam, { color: C.textoSec, fontSize: fs(10) }]}>
                      {calcularProgressoXp(usuario.xp_total || 0).faltam} XP até próximo nível
                    </Text>
                  </View>
                </View>

                {/* Moedas */}
                <View style={[styles.xpCardDivisor, { backgroundColor: C.cinzaClaro }]} />
                <View style={styles.xpCardBottom}>
                  <View style={styles.moedaItem}>
                    <Text style={{ fontSize: fs(24) }}>🌱</Text>
                    <View>
                      <Text style={[styles.moedaLabel, { color: C.textoSec, fontSize: fs(11) }]}>
                        Sementes
                      </Text>
                      <Text style={[styles.moedaNumero, { color: C.azulEscuro, fontSize: fs(18) }]}>
                        {usuario.moedas_saldo || 0}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.moedaItem}>
                    <Text style={{ fontSize: fs(24) }}>📍</Text>
                    <View>
                      <Text style={[styles.moedaLabel, { color: C.textoSec, fontSize: fs(11) }]}>
                        Matches Hoje
                      </Text>
                      <Text style={[styles.moedaNumero, { color: C.azulEscuro, fontSize: fs(18) }]}>
                        {usuario.matches_bonificados_hoje || 0}/3
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            ) : null}
          </View>
        </FadeInView>

        {/* ════════════════════════════════════════════════
            CONQUISTAS & MEDALHAS (em fila com label embaixo)
        ════════════════════════════════════════════════ */}
        <FadeInView delay={120}>
          <View style={styles.secao}>
            <Text style={[styles.secaoTituloPrincipal, { color: C.azulEscuro, fontSize: fs(15) }]}>
              Conquistas & Medalhas
            </Text>

            {medalhas.length === 0 ? (
              <View style={[styles.medalhasVazio, { backgroundColor: C.branco }]}>
                <FontAwesome5 name="medal" size={22} color={C.textoSec} style={{ opacity: 0.5 }} />
                <Text style={[styles.medalhasVazioText, { color: C.textoSec, fontSize: fs(11) }]}>
                  As conquistas habilitadas aparecerão aqui
                </Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.medalhasRow}
              >
                {medalhas.map((m: any) => (
                  <View key={m.id} style={styles.medalhaItem}>
                    <View style={[
                      styles.medalhaCirculo,
                      { backgroundColor: (m.cor || CORES.amarelo) + (modoEscuro ? '30' : '20') }
                    ]}>
                      {m.imagem_url ? (
                        <Image source={{ uri: m.imagem_url }} style={styles.medalhaImage} />
                      ) : (
                        <FontAwesome5 name="medal" size={26} color={m.cor || CORES.amarelo} />
                      )}
                    </View>
                    <Text
                      style={[styles.medalhaLabel, { color: C.azulEscuro, fontSize: fs(11) }]}
                      numberOfLines={1}
                    >
                      {m.label || 'Medalha'}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </FadeInView>

        {/* ════════════════════════════════════════════════
            MINHAS ESPECIALIDADES (radar + matérias ao lado — fiel à imagem)
        ════════════════════════════════════════════════ */}
        <FadeInView delay={240}>
          <View style={styles.secao}>
            <Text style={[styles.secaoTituloPrincipal, { color: C.azulEscuro, fontSize: fs(15) }]}>
              Minhas Especialidades
            </Text>

            <View style={[styles.especCard, { backgroundColor: C.branco }]}>
              {/* Radar à esquerda */}
              <View style={styles.especRadarBox}>
                <RadarChart
                  scores={radarScores}
                  size={150}
                  modoEscuro={modoEscuro}
                />
              </View>

              {/* Matérias à direita (cards individuais) */}
              <View style={styles.especListaBox}>
                {topMaterias.length === 0 ? (
                  <View style={styles.especVazio}>
                    <Ionicons name="add-circle-outline" size={22} color={C.textoSec} />
                    <Text style={[styles.especVazioText, { color: C.textoSec, fontSize: fs(11) }]}>
                      Adicione matérias abaixo
                    </Text>
                  </View>
                ) : (
                  topMaterias.map((m: string) => {
                    const area = MATERIA_AREA[m];
                    const cor = AREAS.find(a => a.key === area)?.cor || CORES.azulEscuro;
                    return (
                      <View
                        key={m}
                        style={[styles.materiaPill, { backgroundColor: C.fundo }]}
                      >
                        <View style={[styles.materiaDot, { backgroundColor: cor }]} />
                        <Text
                          style={[styles.materiaText, { color: C.azulEscuro, fontSize: fs(13) }]}
                          numberOfLines={1}
                        >
                          {m}
                        </Text>
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          </View>
        </FadeInView>

        {/* ════════════════════════════════════════════════
            POSSO ENSINAR
        ════════════════════════════════════════════════ */}
        <FadeInView delay={360}>
          <View style={styles.secao}>
            <View style={styles.secaoHeaderRow}>
              <View style={styles.secaoTituloComIcon}>
                <FontAwesome5 name="graduation-cap" size={12} color={CORES.verde} />
                <Text style={[styles.secaoTitulo, { color: C.azulEscuro, fontSize: fs(15) }]}>
                  Posso ensinar
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.btnAdicionar, { backgroundColor: CORES.verde + (modoEscuro ? '30' : '15') }]}
                onPress={() => setModalSkill('ensina')}
              >
                <Ionicons name="add" size={13} color={CORES.verde} />
                <Text style={[styles.btnAdicionarText, { color: CORES.verde, fontSize: fs(11) }]}>
                  Adicionar
                </Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.skillsCard, { backgroundColor: C.branco }]}>
              {ensina.length === 0 ? (
                <Text style={[styles.skillsVazio, { color: C.textoSec, fontSize: fs(12) }]}>
                  Nenhuma matéria adicionada
                </Text>
              ) : (
                <View style={styles.chipsWrap}>
                  {ensina.map((m: string) => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.chipSkill, {
                        backgroundColor: CORES.verde + (modoEscuro ? '25' : '12'),
                        borderColor: CORES.verde + '50',
                      }]}
                      onPress={() => toggleSkill('ensina', m)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.chipSkillText, { color: CORES.verde, fontSize: fs(12) }]}>
                        {m}
                      </Text>
                      <Ionicons name="close-circle" size={14} color={CORES.verde} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>
        </FadeInView>

        {/* ════════════════════════════════════════════════
            QUERO MELHORAR
        ════════════════════════════════════════════════ */}
        <FadeInView delay={480}>
          <View style={styles.secao}>
            <View style={styles.secaoHeaderRow}>
              <View style={styles.secaoTituloComIcon}>
                <Ionicons name="trending-up" size={14} color={CORES.rosa} />
                <Text style={[styles.secaoTitulo, { color: C.azulEscuro, fontSize: fs(15) }]}>
                  Quero melhorar
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.btnAdicionar, { backgroundColor: CORES.rosa + (modoEscuro ? '30' : '15') }]}
                onPress={() => setModalSkill('melhorar')}
              >
                <Ionicons name="add" size={13} color={CORES.rosa} />
                <Text style={[styles.btnAdicionarText, { color: CORES.rosa, fontSize: fs(11) }]}>
                  Adicionar
                </Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.skillsCard, { backgroundColor: C.branco }]}>
              {aprende.length === 0 ? (
                <Text style={[styles.skillsVazio, { color: C.textoSec, fontSize: fs(12) }]}>
                  Nenhuma matéria adicionada
                </Text>
              ) : (
                <View style={styles.chipsWrap}>
                  {aprende.map((m: string) => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.chipSkill, {
                        backgroundColor: CORES.rosa + (modoEscuro ? '25' : '12'),
                        borderColor: CORES.rosa + '50',
                      }]}
                      onPress={() => toggleSkill('melhorar', m)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.chipSkillText, { color: CORES.rosa, fontSize: fs(12) }]}>
                        {m}
                      </Text>
                      <Ionicons name="close-circle" size={14} color={CORES.rosa} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>
        </FadeInView>

        {/* ════════════════════════════════════════════════
            SOBRE MIM
        ════════════════════════════════════════════════ */}
        <FadeInView delay={600}>
          <View style={styles.secao}>
            <View style={styles.secaoHeaderRow}>
              <View style={styles.secaoTituloComIcon}>
                <Ionicons name="reader-outline" size={14} color={C.textoSec} />
                <Text style={[styles.secaoTitulo, { color: C.azulEscuro, fontSize: fs(15) }]}>
                  Sobre mim
                </Text>
              </View>
              <TouchableOpacity onPress={abrirEdicaoBio}>
                <Ionicons name="create-outline" size={16} color={CORES.rosa} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.bioCard, { backgroundColor: C.branco }]}
              activeOpacity={0.75}
              onPress={abrirEdicaoBio}
            >
              <Text
                style={[styles.bioText, {
                  color: usuario.bio ? C.azulEscuro : C.textoSec,
                  fontSize: fs(13),
                  fontStyle: usuario.bio ? 'normal' : 'italic',
                }]}
              >
                {usuario.bio || 'Toque para adicionar uma descrição sobre você...'}
              </Text>
            </TouchableOpacity>
          </View>
        </FadeInView>

        {/* ════════════════════════════════════════════════
            INFORMAÇÕES ACADÊMICAS
        ════════════════════════════════════════════════ */}
        <FadeInView delay={720}>
          <View style={styles.secao}>
            <Text style={[styles.secaoTituloPrincipal, { color: C.azulEscuro, fontSize: fs(15) }]}>
              Informações Acadêmicas
            </Text>

            <View style={[styles.infoCard, { backgroundColor: C.branco }]}>
              <View style={styles.infoBox}>
                <Text style={[styles.infoLabel, { color: C.textoSec, fontSize: fs(9) }]}>TURMA</Text>
                <Text
                  style={[styles.infoValor, { color: C.azulEscuro, fontSize: fs(15) }]}
                  numberOfLines={1}
                >
                  {usuario.turma || '—'}
                </Text>
              </View>
              <View style={[styles.infoSep, { backgroundColor: C.cinzaClaro }]} />
              <View style={styles.infoBox}>
                <Text style={[styles.infoLabel, { color: C.textoSec, fontSize: fs(9) }]}>RA</Text>
                <Text
                  style={[styles.infoValor, { color: C.azulEscuro, fontSize: fs(15) }]}
                  numberOfLines={1}
                >
                  {usuario.ra || '—'}
                </Text>
              </View>
              <View style={[styles.infoSep, { backgroundColor: C.cinzaClaro }]} />
              <View style={styles.infoBox}>
                <Text style={[styles.infoLabel, { color: C.textoSec, fontSize: fs(9) }]}>AJUDAS</Text>
                <Text style={[styles.infoValor, { color: C.azulEscuro, fontSize: fs(15) }]}>
                  {usuario.ajudas || 0}
                </Text>
              </View>
            </View>
          </View>
        </FadeInView>

        {/* ════════════════════════════════════════════════
            SAIR DA CONTA
        ════════════════════════════════════════════════ */}
        <FadeInView delay={840}>
          <TouchableOpacity
            style={styles.btnSair}
            onPress={() => setModalConfirmSair(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={18} color={CORES.rosa} />
            <Text style={[styles.btnSairText, { color: CORES.rosa, fontSize: fs(15) }]}>
              Sair da conta
            </Text>
          </TouchableOpacity>
        </FadeInView>
      </ScrollView>

      {/* ════════════════════════════════════════════════
          MODAL EDITAR BIO
      ════════════════════════════════════════════════ */}
      <Modal visible={modalBio} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: C.branco }]}>
            <View style={[styles.modalHandle, { backgroundColor: C.cinzaClaro }]} />
            <Text style={[styles.modalTitulo, { color: C.azulEscuro, fontSize: fs(17) }]}>
              Editar Bio
            </Text>
            <Text style={[styles.modalSub, { color: C.textoSec, fontSize: fs(12) }]}>
              Conte algo sobre você (até 200 caracteres)
            </Text>

            <TextInput
              style={[
                styles.bioInput,
                {
                  backgroundColor: C.fundo,
                  color: C.azulEscuro,
                  borderColor: C.cinzaClaro,
                  fontSize: fs(13),
                }
              ]}
              placeholder="Ex: Adoro ensinar matemática e jogar xadrez..."
              placeholderTextColor={C.textoSec}
              value={bioTemp}
              onChangeText={setBioTemp}
              multiline
              maxLength={200}
              textAlignVertical="top"
            />

            <Text style={[styles.contador, { color: C.textoSec, fontSize: fs(10) }]}>
              {bioTemp.length}/200
            </Text>

            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: C.cinzaClaro }]}
                onPress={() => setModalBio(false)}
              >
                <Text style={[styles.modalBtnText, { color: C.azulEscuro, fontSize: fs(13) }]}>
                  Cancelar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: CORES.rosa }]}
                onPress={salvarBio}
                disabled={salvando}
              >
                {salvando ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={[styles.modalBtnText, { color: '#FFF', fontSize: fs(13) }]}>
                    Salvar
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ════════════════════════════════════════════════
          MODAL ADICIONAR SKILL
      ════════════════════════════════════════════════ */}
      <Modal visible={modalSkill !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: C.branco, maxHeight: '85%' }]}>
            <View style={[styles.modalHandle, { backgroundColor: C.cinzaClaro }]} />
            <Text style={[styles.modalTitulo, { color: C.azulEscuro, fontSize: fs(17) }]}>
              {modalSkill === 'ensina' ? 'Posso ensinar' : 'Quero melhorar'}
            </Text>
            <Text style={[styles.modalSub, { color: C.textoSec, fontSize: fs(12) }]}>
              Toque para adicionar ou remover
            </Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 8 }}>
              {AREAS.map(area => {
                const materiasArea = MATERIAS_DISPONIVEIS.filter(m => MATERIA_AREA[m] === area.key);
                return (
                  <View key={area.key} style={{ marginBottom: 12 }}>
                    <View style={styles.areaHeader}>
                      <View style={[styles.areaPin, { backgroundColor: area.cor }]} />
                      <Text style={[styles.areaLabel, { color: C.azulEscuro, fontSize: fs(11) }]}>
                        {area.label.toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.chipsWrap}>
                      {materiasArea.map(m => {
                        const lista = modalSkill === 'ensina' ? ensina : aprende;
                        const ativo = lista.includes(m);
                        return (
                          <TouchableOpacity
                            key={m}
                            style={[
                              styles.chipSkillSelector,
                              {
                                backgroundColor: ativo
                                  ? area.cor + (modoEscuro ? '30' : '15')
                                  : C.fundo,
                                borderColor: ativo ? area.cor : C.cinzaClaro,
                              }
                            ]}
                            onPress={() => toggleSkill(modalSkill!, m)}
                          >
                            {ativo && <Ionicons name="checkmark" size={12} color={area.cor} />}
                            <Text style={[
                              styles.chipSkillText,
                              {
                                color: ativo ? area.cor : C.azulEscuro,
                                fontSize: fs(12),
                              }
                            ]}>
                              {m}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={[styles.btnFecharModal, { backgroundColor: C.fundo }]}
              onPress={() => setModalSkill(null)}
            >
              <Text style={[styles.btnFecharModalText, { color: C.textoSec, fontSize: fs(13) }]}>
                Fechar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ════════════════════════════════════════════════
          MODAL CONFIRMAÇÃO SAIR
      ════════════════════════════════════════════════ */}
      <Modal visible={modalConfirmSair} transparent animationType="fade">
        <View style={styles.confirmOverlay}>
          <View style={[styles.confirmBox, { backgroundColor: C.branco }]}>
            <View style={[styles.confirmIcon, { backgroundColor: CORES.rosa + '20' }]}>
              <Ionicons name="log-out" size={26} color={CORES.rosa} />
            </View>
            <Text style={[styles.confirmTitulo, { color: C.azulEscuro, fontSize: fs(17) }]}>
              Sair da conta?
            </Text>
            <Text style={[styles.confirmMsg, { color: C.textoSec, fontSize: fs(13) }]}>
              Você precisará fazer login novamente para acessar o app.
            </Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: C.cinzaClaro }]}
                onPress={() => setModalConfirmSair(false)}
              >
                <Text style={[styles.confirmBtnText, { color: C.azulEscuro, fontSize: fs(13) }]}>
                  Cancelar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: CORES.rosa }]}
                onPress={() => { setModalConfirmSair(false); sair(); }}
              >
                <Text style={[styles.confirmBtnText, { color: '#FFF', fontSize: fs(13) }]}>
                  Sair
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ════════════════════════════════════════════════════════════════════════
//  STYLESHEET
// ════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: { flex: 1 },
  centro:    { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  semDadosText: { fontFamily: F.bold },

  // TOAST
  toast:     { position: 'absolute', alignSelf: 'center', backgroundColor: CORES.azulEscuro, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 24, zIndex: 9999, elevation: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  toastText: { color: CORES.branco, fontFamily: F.bold },

  // HEADER
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 4 },
  btnVoltar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3 },
  btnMenu:   { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3 },
  logoText:  { fontFamily: F.black, letterSpacing: -0.5 },

  // HERO
  heroCard:  { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 14, padding: 16, borderRadius: 22, gap: 14, elevation: 2, shadowColor: CORES.azulEscuro, shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  fotoWrap:  { width: 76, height: 76 },
  foto:      { width: 76, height: 76, borderRadius: 38, borderWidth: 3, borderColor: CORES.rosa },
  fotoPlaceholder: { width: 76, height: 76, borderRadius: 38, borderWidth: 3, borderColor: CORES.rosa, justifyContent: 'center', alignItems: 'center' },
  fotoLetra: { color: CORES.rosa, fontFamily: F.black, letterSpacing: -1 },
  fotoEditBtn: { position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: CORES.rosa, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: CORES.branco },

  heroInfo:  { flex: 1, gap: 6 },
  nome:      { fontFamily: F.black, letterSpacing: -0.4, lineHeight: 27 },
  tutorBadge:{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1, alignSelf: 'flex-start' },
  tutorBadgeText: { color: CORES.verde, fontFamily: F.black, letterSpacing: 1 },

  // SECAO
  secao:     { marginHorizontal: 16, marginTop: 22 },
  secaoTituloPrincipal: { fontFamily: F.black, letterSpacing: -0.3, marginBottom: 10, paddingHorizontal: 2 },
  secaoHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingHorizontal: 2 },
  secaoTitulo: { fontFamily: F.black, letterSpacing: -0.3 },
  secaoTituloComIcon: { flexDirection: 'row', alignItems: 'center', gap: 7 },

  // MEDALHAS
  medalhasRow: { gap: 18, paddingHorizontal: 4, paddingVertical: 6, paddingRight: 20 },
  medalhaItem: { alignItems: 'center', gap: 6, width: 76 },
  medalhaCirculo: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
  medalhaImage: { width: 50, height: 50, borderRadius: 25 },
  medalhaLabel: { fontFamily: F.bold, textAlign: 'center', letterSpacing: -0.2 },
  medalhasVazio: { borderRadius: 16, paddingVertical: 22, alignItems: 'center', gap: 8 },
  medalhasVazioText: { fontFamily: F.medium, paddingHorizontal: 30, textAlign: 'center' },

  // ESPECIALIDADES
  especCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 22, padding: 12, gap: 4, elevation: 1, shadowColor: CORES.azulEscuro, shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  especRadarBox: { width: 150, height: 150, justifyContent: 'center', alignItems: 'center' },
  especListaBox: { flex: 1, gap: 8, paddingLeft: 4 },
  materiaPill: { paddingHorizontal: 16, paddingVertical: 14, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 8 },
  materiaDot: { width: 6, height: 6, borderRadius: 3 },
  materiaText: { fontFamily: F.bold, flex: 1 },
  especVazio: { paddingVertical: 30, alignItems: 'center', gap: 6 },
  especVazioText: { fontFamily: F.medium, fontStyle: 'italic', textAlign: 'center' },

  // BTN ADICIONAR
  btnAdicionar: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 18 },
  btnAdicionarText: { fontFamily: F.black, letterSpacing: 0.4 },

  // SKILLS
  skillsCard: { borderRadius: 14, padding: 14, elevation: 1 },
  skillsVazio: { fontFamily: F.medium, fontStyle: 'italic', textAlign: 'center', paddingVertical: 14 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipSkill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingLeft: 12, paddingRight: 8, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  chipSkillText: { fontFamily: F.bold },
  chipSkillSelector: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },

  // BIO
  bioCard: { borderRadius: 14, padding: 14, elevation: 1 },
  bioText: { fontFamily: F.regular, lineHeight: 19 },

  // INFO
  infoCard: { flexDirection: 'row', borderRadius: 14, padding: 16, elevation: 1, alignItems: 'center' },
  infoBox: { flex: 1, alignItems: 'center', gap: 4 },
  infoLabel: { fontFamily: F.black, letterSpacing: 1 },
  infoValor: { fontFamily: F.black, letterSpacing: -0.3 },
  infoSep: { width: 1, height: 26 },

  // SAIR
  btnSair: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 26, paddingVertical: 12 },
  btnSairText: { fontFamily: F.black },

  // MODAIS
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 36 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitulo: { fontFamily: F.black, marginBottom: 4, letterSpacing: -0.3 },
  modalSub: { fontFamily: F.regular, marginBottom: 14 },

  bioInput: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, fontFamily: F.regular, height: 100 },
  contador: { fontFamily: F.bold, textAlign: 'right', marginTop: 6 },

  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 18 },
  modalBtn: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  modalBtnText: { fontFamily: F.black },

  areaHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, paddingHorizontal: 2 },
  areaPin: { width: 4, height: 14, borderRadius: 2 },
  areaLabel: { fontFamily: F.black, letterSpacing: 1.2 },

  btnFecharModal: { borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 14 },
  btnFecharModalText: { fontFamily: F.bold },

  // CONFIRMAÇÃO
  confirmOverlay: { flex: 1, backgroundColor: 'rgba(11,32,70,0.65)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 },
  confirmBox: { width: '100%', maxWidth: 360, borderRadius: 18, padding: 22, alignItems: 'center' },
  confirmIcon: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  confirmTitulo: { fontFamily: F.black, marginBottom: 6, textAlign: 'center' },
  confirmMsg: { fontFamily: F.regular, textAlign: 'center', lineHeight: 19, marginBottom: 18 },
  confirmBtns: { flexDirection: 'row', gap: 8, width: '100%' },
  confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  confirmBtnText: { fontFamily: F.black },

  // XP & GAMIFICAÇÃO
  xpCard: { borderRadius: 18, overflow: 'hidden', elevation: 2, shadowColor: CORES.azulEscuro, shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  xpCardTop: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  corujhBox: { alignItems: 'center', gap: 6 },
  corujaEmoji: { lineHeight: 60 },
  corujaLabel: { fontFamily: F.bold, letterSpacing: -0.2 },
  xpInfo: { flex: 1, gap: 8 },
  xpRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  xpLabel: { fontFamily: F.black, letterSpacing: 0.6 },
  xpNumero: { fontFamily: F.black },
  xpBarBg: { height: 8, borderRadius: 4, overflow: 'hidden' },
  xpBarFill: { height: 8, borderRadius: 4 },
  xpFaltam: { fontFamily: F.regular },
  xpCardDivisor: { height: 1 },
  xpCardBottom: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 16 },
  moedaItem: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  moedaLabel: { fontFamily: F.medium },
  moedaNumero: { fontFamily: F.black },
});
