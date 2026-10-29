import { voltar } from '../navegacao';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import SymbiusTabBar from '../components/SymbiusTabBar';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  SafeAreaView, StatusBar, ActivityIndicator, Image, Animated
} from 'react-native';
import { db } from '../config/firebaseConfig';
import { doc, getDoc, getDocs, collection, onSnapshot } from 'firebase/firestore';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polygon, Line, Text as SvgText } from 'react-native-svg';
import { useAppSettings } from '../contexts/AppSettingsContext';
// ✅ GAMIFICAÇÃO
import AnimalImagem from '../components/AnimalImagem';
import { calcularNivel, calcularFaseCoruja, calcularProgressoXp } from '../utils/gamification';

// ── Fonte Poppins ──
import { F } from '../constants/theme';
import { CORES_SYMBIUS } from '../constants/coresSymbius';

// ════ ÁREAS DE CONHECIMENTO (igual ao Perfil) ════
const AREAS = [
  { key: 'exatas',     label: 'Exatas',      cor: CORES_SYMBIUS.azul },
  { key: 'humanas',    label: 'Humanas',     cor: CORES_SYMBIUS.laranjaTexto },
  { key: 'biologicas', label: 'Biológicas',  cor: CORES_SYMBIUS.verdeEscuro },
  { key: 'linguagens', label: 'Linguagens',  cor: CORES_SYMBIUS.verdeEscuro },
  { key: 'tecnologia', label: 'Lógica',      cor: CORES_SYMBIUS.textoSec },
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

// ── Helper de imagem (base64 ou URL) ──
const getImageUri = (foto: any): string | null => {
  if (!foto) return null;
  if (typeof foto === 'string') {
    if (foto.startsWith('http') || foto.startsWith('data:image')) return foto;
    if (foto.length > 50) return `data:image/jpeg;base64,${foto}`;
  }
  return null;
};

// ════ ANIMAÇÃO ════
const FadeInView = ({ children, delay = 0, style }: any) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 450, delay, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={[
      style,
      { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0,1], outputRange: [10, 0] }) }] },
    ]}>
      {children}
    </Animated.View>
  );
};

// ════ RADAR CHART (igual ao Perfil) ════
const RadarChart = ({ scores, size, modoEscuro }: any) => {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.24;
  const N = AREAS.length;
  const labelDist = radius + size * 0.12;

  const getPoint = (i: number, dist: number) => {
    const angle = (i * 2 * Math.PI) / N - Math.PI / 2;
    return { x: cx + dist * Math.cos(angle), y: cy + dist * Math.sin(angle) };
  };

  const aneis = [0.5, 1.0];
  const scorePoints = scores
    .map((s: number, i: number) => {
      const p = getPoint(i, radius * Math.max(0.05, s));
      return `${p.x},${p.y}`;
    })
    .join(' ');

  const corLinhas = CORES_SYMBIUS.borda2;
  const corLabel  = CORES_SYMBIUS.textoSec;
  const corPolig  = CORES_SYMBIUS.azul;

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
          <Polygon key={idx} points={pts} fill="none" stroke={corLinhas}
            strokeWidth={0.7} strokeDasharray={idx === 0 ? '2,3' : ''} />
        );
      })}
      {scores.map((_: any, i: number) => {
        const p = getPoint(i, radius);
        return <Line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={corLinhas} strokeWidth={0.6} />;
      })}
      <Polygon points={scorePoints} fill={corPolig}
        fillOpacity={modoEscuro ? 0.35 : 0.28} stroke={corPolig}
        strokeWidth={1.5} strokeLinejoin="round" />
      {AREAS.map((area, i) => {
        const p = getPoint(i, labelDist);
        return (
          <SvgText key={area.key} x={p.x} y={p.y} fill={corLabel}
            fontSize={size * 0.055} fontFamily={F.semibold}
            textAnchor="middle" alignmentBaseline="middle">
            {area.label}
          </SvgText>
        );
      })}
    </Svg>
  );
};

// ════════════════════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL — PERFIL PÚBLICO (de outra pessoa)
// ════════════════════════════════════════════════════════════════════════
export default function PerfilPublico({ navigation, route }: any) {
  const insets = useSafeAreaInsets();

  // uid = dono do perfil que estou VENDO. meuUid = quem está olhando.
  const uidPerfil = route?.params?.uid;
  const meuUid    = route?.params?.meuUid;

  // Tema vem das configs de quem está OLHANDO (o dispositivo atual)
  const { cores: C, fonteScale, modoEscuro } = useAppSettings();
  const fs = (size: number) => size * fonteScale;

  const [usuario,  setUsuario]  = useState<any>(null);
  const [medalhas, setMedalhas] = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [online,   setOnline]   = useState(false);

  // ── Carrega o perfil da pessoa (tempo real, pra status online atualizar) ──
  useEffect(() => {
    if (!uidPerfil) { setLoading(false); return; }
    const unsub = onSnapshot(doc(db, 'usuarios', uidPerfil), (snap) => {
      if (snap.exists()) {
        const dados: any = { uid: snap.id, ...snap.data() };
        setUsuario(dados);
        // Online só conta se a pessoa permite mostrar (statusOnline !== false)
        setOnline(dados.online === true && dados.statusOnline !== false);
      }
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [uidPerfil]);

  // ── Medalhas visíveis ──
  useEffect(() => {
    if (!uidPerfil) return;
    (async () => {
      try {
        const userSnap = await getDoc(doc(db, 'usuarios', uidPerfil));
        if (!userSnap.exists()) return;
        const idsVisiveis: string[] = userSnap.data()?.medalhas_visiveis || [];
        if (idsVisiveis.length === 0) { setMedalhas([]); return; }
        const snapAll = await getDocs(collection(db, 'medalhas'));
        const todas = snapAll.docs.map(d => ({ id: d.id, ...d.data() }));
        setMedalhas(todas.filter((m: any) => idsVisiveis.includes(m.id)));
      } catch (e) { console.log('Erro medalhas:', e); }
    })();
  }, [uidPerfil]);

  // ── Radar (mesma lógica do Perfil pessoal) ──
  const radarScores = useMemo(() => {
    if (!usuario) return AREAS.map(() => 0);
    const ensina  = usuario.posso_ensinar || [];
    const aprende = usuario.quer_aprender || [];
    const pontos: Record<string, number> = {};
    AREAS.forEach(a => { pontos[a.key] = 0; });
    ensina.forEach((m: string) => { const area = MATERIA_AREA[m]; if (area) pontos[area] += 1; });
    aprende.forEach((m: string) => { const area = MATERIA_AREA[m]; if (area) pontos[area] = Math.max(0, pontos[area] - 0.4); });
    const max = Math.max(1, ...Object.values(pontos));
    return AREAS.map(a => Math.min(1, pontos[a.key] / max));
  }, [usuario]);

  // ── Abrir chat com a pessoa ──
  const conversar = () => {
    if (!usuario || !meuUid) return;
    navigation.navigate('Chat', {
      outroUid: usuario.uid,
      outroNome: usuario.nome_completo,
      outraFoto: usuario.foto || null,
    });
  };

  // ════ LOADING ════
  if (loading) return (
    <View style={[styles.centro, { backgroundColor: CORES_SYMBIUS.fundo }]}>
      <ActivityIndicator size="large" color={modoEscuro ? CORES_SYMBIUS.verdeEscuro : CORES_SYMBIUS.texto} />
    </View>
  );

  // ════ NÃO ENCONTRADO ════
  if (!usuario) return (
    <SafeAreaView style={[styles.container, { backgroundColor: CORES_SYMBIUS.fundo }]}>
      <StatusBar barStyle={CORES_SYMBIUS.barStyle} backgroundColor={CORES_SYMBIUS.fundo} />
      <View style={[styles.header, { paddingTop: insets.top + 22 }]}>
        <TouchableOpacity onPress={() => voltar(navigation)} style={styles.btnVoltar}>
          <Ionicons name="arrow-back" size={22} color={CORES_SYMBIUS.texto} />
        </TouchableOpacity>
        <Text style={[styles.logoText, { color: CORES_SYMBIUS.verdeEscuro, fontSize: fs(22) }]}>Simbio</Text>
        <View style={{ width: 44 }} />
      </View>
      <View style={styles.centro}>
        <Ionicons name="alert-circle" size={48} color={CORES_SYMBIUS.textoSec} />
        <Text style={[styles.semDadosText, { color: CORES_SYMBIUS.textoSec, fontSize: fs(14) }]}>
          Usuário não encontrado
        </Text>
      </View>
    </SafeAreaView>
  );

  const isTutor   = usuario.tipo?.toLowerCase() === 'gremista' || usuario.tipo?.toLowerCase() === 'administrador';
  const ensina    = usuario.posso_ensinar || [];
  const aprende   = usuario.quer_aprender  || [];
  const topMaterias = [...ensina].slice(0, 3);
  const fotoUri   = getImageUri(usuario.foto);

  // 🔒 PRIVACIDADE: se "Privado", mostra só foto + nome
  const ehPrivado = usuario.visibilidade === 'Privado';

  // ════ CABEÇALHO (compartilhado) ════
  const Header = (
    <View style={[styles.header, { paddingTop: insets.top + 22 }]}>
      <TouchableOpacity onPress={() => voltar(navigation)} style={styles.btnVoltar}>
        <Ionicons name="arrow-back" size={22} color={CORES_SYMBIUS.texto} />
      </TouchableOpacity>
      <Text style={[styles.logoText, { color: CORES_SYMBIUS.verdeEscuro, fontSize: fs(22) }]}>Simbio</Text>
      <View style={{ width: 44 }} />
    </View>
  );

  // ════ VERSÃO PRIVADA ════
  if (ehPrivado) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: CORES_SYMBIUS.fundo }]}>
        <StatusBar barStyle={CORES_SYMBIUS.barStyle} backgroundColor={CORES_SYMBIUS.fundo} />
        {Header}
        <View style={styles.centro}>
          <View style={styles.fotoWrapGrande}>
            {fotoUri ? (
              <Image source={{ uri: fotoUri }} style={styles.fotoGrande} />
            ) : (
              <View style={[styles.fotoPlaceholderGrande, { backgroundColor: CORES_SYMBIUS.verdeEscuro + '20' }]}>
                <Text style={[styles.fotoLetraGrande, { fontSize: fs(48) }]}>
                  {usuario.nome_completo?.charAt(0)?.toUpperCase() || '?'}
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.nomePrivado, { color: CORES_SYMBIUS.texto, fontSize: fs(22) }]} numberOfLines={2}>
            {usuario.nome_completo || 'Sem nome'}
          </Text>
          <View style={[styles.cadeadoBox, { backgroundColor: CORES_SYMBIUS.fundoCard }]}>
            <Ionicons name="lock-closed" size={18} color={CORES_SYMBIUS.textoSec} />
            <Text style={[styles.cadeadoText, { color: CORES_SYMBIUS.textoSec, fontSize: fs(13) }]}>
              Este perfil é privado
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ════ VERSÃO COMPLETA (Público / Apenas Contatos) ════
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: CORES_SYMBIUS.fundo }]}>
      <StatusBar barStyle={CORES_SYMBIUS.barStyle} backgroundColor={CORES_SYMBIUS.fundo} />
      {Header}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 50, paddingTop: 6 }}
      >
        {/* ════ HERO ════ */}
        <FadeInView delay={0}>
          <View style={[styles.heroCard, { backgroundColor: CORES_SYMBIUS.fundoCard }]}>
            <View style={styles.fotoWrap}>
              {fotoUri ? (
                <Image source={{ uri: fotoUri }} style={styles.foto} />
              ) : (
                <View style={[styles.fotoPlaceholder, { backgroundColor: CORES_SYMBIUS.verdeEscuro + '20' }]}>
                  <Text style={[styles.fotoLetra, { fontSize: fs(34) }]}>
                    {usuario.nome_completo?.charAt(0)?.toUpperCase() || '?'}
                  </Text>
                </View>
              )}
              {/* Bolinha de online — só se a pessoa permite */}
              {online && <View style={styles.onlineDot} />}
            </View>

            <View style={styles.heroInfo}>
              <Text style={[styles.nome, { color: CORES_SYMBIUS.texto, fontSize: fs(22) }]} numberOfLines={2}>
                {usuario.nome_completo || 'Sem nome'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {isTutor && (
                  <View style={[styles.tutorBadge, { borderColor: CORES_SYMBIUS.verdeEscuro + '60' }]}>
                    <FontAwesome5 name="graduation-cap" size={9} color={CORES_SYMBIUS.verdeEscuro} />
                    <Text style={[styles.tutorBadgeText, { fontSize: fs(12) }]}>TUTOR</Text>
                  </View>
                )}
                {online && (
                  <View style={styles.onlineChip}>
                    <View style={styles.onlineChipDot} />
                    <Text style={[styles.onlineChipText, { fontSize: fs(12) }]}>ONLINE</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </FadeInView>

        {/* ════ BOTÃO CONVERSAR (só se não for o próprio perfil) ════ */}
        {meuUid && meuUid !== usuario.uid && (
          <FadeInView delay={80}>
            <TouchableOpacity
              style={[styles.btnConversar, { backgroundColor: CORES_SYMBIUS.verdeEscuro }]}
              onPress={conversar}
              activeOpacity={0.85}
            >
              <Ionicons name="chatbubble-ellipses" size={16} color={CORES_SYMBIUS.creme} />
              <Text style={[styles.btnConversarText, { fontSize: fs(14) }]}>Conversar</Text>
            </TouchableOpacity>
          </FadeInView>
        )}

        {/* ════ CONQUISTAS & MEDALHAS ════ */}
        <FadeInView delay={120}>
          <View style={styles.secao}>
            <Text style={[styles.secaoTituloPrincipal, { color: CORES_SYMBIUS.texto, fontSize: fs(15) }]}>
              Conquistas & Medalhas
            </Text>
            {medalhas.length === 0 ? (
              <View style={[styles.medalhasVazio, { backgroundColor: CORES_SYMBIUS.fundoCard }]}>
                <FontAwesome5 name="medal" size={22} color={CORES_SYMBIUS.textoSec} style={{ opacity: 0.5 }} />
                <Text style={[styles.medalhasVazioText, { color: CORES_SYMBIUS.textoSec, fontSize: fs(12) }]}>
                  Nenhuma conquista para exibir
                </Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.medalhasRow}>
                {medalhas.map((m: any) => (
                  <View key={m.id} style={styles.medalhaItem}>
                    <View style={[styles.medalhaCirculo, { backgroundColor: (m.cor || CORES_SYMBIUS.verdeEscuro) + (modoEscuro ? '30' : '20') }]}>
                      {m.imagem_url ? (
                        <Image source={{ uri: m.imagem_url }} style={styles.medalhaImage} />
                      ) : (
                        <FontAwesome5 name="medal" size={26} color={m.cor || CORES_SYMBIUS.verdeEscuro} />
                      )}
                    </View>
                    <Text style={[styles.medalhaLabel, { color: CORES_SYMBIUS.texto, fontSize: fs(12) }]} numberOfLines={1}>
                      {m.label || 'Medalha'}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </FadeInView>

        {/* ════ PROGRESSO (XP + MOEDAS) — COM PRIVACIDADE ════ */}
        {usuario?.perfil_publico_xp ? (
          <FadeInView delay={180}>
            <View style={styles.secao}>
              <Text style={[styles.secaoTituloPrincipal, { color: CORES_SYMBIUS.texto, fontSize: fs(15) }]}>
                Progresso
              </Text>

              <View style={[styles.xpCard, { backgroundColor: CORES_SYMBIUS.fundoCard }]}>
                {/* Fase Coruja + XP */}
                <View style={styles.xpCardTop}>
                  <View style={styles.corujhBox}>
                    <AnimalImagem animal={calcularNivel(usuario.xp_total || 0).animal} size={72} />
                    <Text style={[styles.corujaLabel, { color: CORES_SYMBIUS.texto, fontSize: fs(12) }]}>
                      {calcularFaseCoruja(usuario.xp_total || 0).label}
                    </Text>
                  </View>

                  {/* XP Info */}
                  <View style={styles.xpInfo}>
                    <View style={styles.xpRow}>
                      <Text style={[styles.xpLabel, { color: CORES_SYMBIUS.textoSec, fontSize: fs(12) }]}>
                        EXPERIÊNCIA
                      </Text>
                      <Text style={[styles.xpNumero, { color: CORES_SYMBIUS.texto, fontSize: fs(16) }]}>
                        {usuario.xp_total || 0}
                      </Text>
                    </View>

                    {/* Progress Bar */}
                    <View style={[styles.xpBarBg, { backgroundColor: CORES_SYMBIUS.fundo }]}>
                      <View
                        style={[
                          styles.xpBarFill,
                          {
                            backgroundColor: CORES_SYMBIUS.verdeEscuro,
                            width: `${calcularProgressoXp(usuario.xp_total || 0).percentual}%`,
                          },
                        ]}
                      />
                    </View>

                    <Text style={[styles.xpFaltam, { color: CORES_SYMBIUS.textoSec, fontSize: fs(12) }]}>
                      {calcularProgressoXp(usuario.xp_total || 0).faltam} XP até próximo nível
                    </Text>
                  </View>
                </View>

                {/* Moedas */}
                <View style={[styles.xpCardDivisor, { backgroundColor: CORES_SYMBIUS.borda }]} />
                <View style={styles.xpCardBottom}>
                  <View style={styles.moedaItem}>
                    <Ionicons name="leaf" size={24} color={CORES_SYMBIUS.verdeEscuro} />
                    <View>
                      <Text style={[styles.moedaLabel, { color: CORES_SYMBIUS.textoSec, fontSize: fs(12) }]}>
                        Sementes
                      </Text>
                      <Text style={[styles.moedaNumero, { color: CORES_SYMBIUS.texto, fontSize: fs(18) }]}>
                        {usuario.moedas_saldo || 0}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.moedaItem}>
                    <Ionicons name="ribbon" size={24} color={CORES_SYMBIUS.verdeEscuro} />
                    <View>
                      <Text style={[styles.moedaLabel, { color: CORES_SYMBIUS.textoSec, fontSize: fs(12) }]}>
                        Nível
                      </Text>
                      <Text style={[styles.moedaNumero, { color: CORES_SYMBIUS.texto, fontSize: fs(18) }]}>
                        {calcularFaseCoruja(usuario.xp_total || 0).label}
                      </Text>
                    </View>
                  </View>

                  {usuario.avaliacao_contagem > 0 && (
                    <View style={styles.moedaItem}>
                      <Ionicons name="star" size={24} color={CORES_SYMBIUS.verdeEscuro} />
                      <View>
                        <Text style={[styles.moedaLabel, { color: CORES_SYMBIUS.textoSec, fontSize: fs(12) }]}>
                          Reputação
                        </Text>
                        <Text style={[styles.moedaNumero, { color: CORES_SYMBIUS.texto, fontSize: fs(18) }]}>
                          {usuario.avaliacao_media.toFixed(1)} ({usuario.avaliacao_contagem})
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </FadeInView>
        ) : (
          <FadeInView delay={180}>
            <View style={styles.secao}>
              <View style={[styles.privacidadeCard, { backgroundColor: CORES_SYMBIUS.borda }]}>
                <Ionicons name="lock-closed" size={24} color={CORES_SYMBIUS.textoSec} />
                <Text style={[styles.privacidadeText, { color: CORES_SYMBIUS.textoSec, fontSize: fs(13) }]}>
                  Este usuário prefere manter o progresso privado
                </Text>
              </View>
            </View>
          </FadeInView>
        )}

        {/* ════ ESPECIALIDADES (radar) ════ */}
        <FadeInView delay={240}>
          <View style={styles.secao}>
            <Text style={[styles.secaoTituloPrincipal, { color: CORES_SYMBIUS.texto, fontSize: fs(15) }]}>
              Especialidades
            </Text>
            <View style={[styles.especCard, { backgroundColor: CORES_SYMBIUS.fundoCard }]}>
              <View style={styles.especRadarBox}>
                <RadarChart scores={radarScores} size={260} modoEscuro={modoEscuro} />
                <Text style={[styles.radarLegenda, { color: CORES_SYMBIUS.textoSec, fontSize: fs(12) }]}>
                  Matérias de tutoria
                </Text>
              </View>
              <View style={styles.especListaBox}>
                {topMaterias.length === 0 ? (
                  <View style={styles.especVazio}>
                    <Ionicons name="ellipse-outline" size={22} color={CORES_SYMBIUS.textoSec} />
                    <Text style={[styles.especVazioText, { color: CORES_SYMBIUS.textoSec, fontSize: fs(12) }]}>
                      Sem matérias cadastradas
                    </Text>
                  </View>
                ) : (
                  topMaterias.map((m: string) => {
                    const area = MATERIA_AREA[m];
                    const cor = AREAS.find(a => a.key === area)?.cor || CORES_SYMBIUS.texto;
                    return (
                      <View key={m} style={[styles.materiaPill, { backgroundColor: CORES_SYMBIUS.fundo }]}>
                        <View style={[styles.materiaDot, { backgroundColor: cor }]} />
                        <Text style={[styles.materiaText, { color: CORES_SYMBIUS.texto, fontSize: fs(13) }]} numberOfLines={1}>
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

        {/* ════ POSSO ENSINAR (read-only) ════ */}
        <FadeInView delay={360}>
          <View style={styles.secao}>
            <View style={styles.secaoTituloComIcon}>
              <FontAwesome5 name="graduation-cap" size={12} color={CORES_SYMBIUS.verdeEscuro} />
              <Text style={[styles.secaoTitulo, { color: CORES_SYMBIUS.texto, fontSize: fs(15) }]}>
                Pode ensinar
              </Text>
            </View>
            <View style={[styles.skillsCard, { backgroundColor: CORES_SYMBIUS.fundoCard, marginTop: 10 }]}>
              {ensina.length === 0 ? (
                <Text style={[styles.skillsVazio, { color: CORES_SYMBIUS.textoSec, fontSize: fs(12) }]}>
                  Nenhuma matéria
                </Text>
              ) : (
                <View style={styles.chipsWrap}>
                  {ensina.map((m: string) => (
                    <View key={m} style={[styles.chipSkill, {
                      backgroundColor: CORES_SYMBIUS.verdeEscuro + (modoEscuro ? '25' : '12'),
                      borderColor: CORES_SYMBIUS.verdeEscuro + '50',
                    }]}>
                      <Text style={[styles.chipSkillText, { color: CORES_SYMBIUS.verdeEscuro, fontSize: fs(12) }]}>{m}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        </FadeInView>

        {/* ════ QUER MELHORAR (read-only) ════ */}
        <FadeInView delay={480}>
          <View style={styles.secao}>
            <View style={styles.secaoTituloComIcon}>
              <Ionicons name="trending-up" size={14} color={CORES_SYMBIUS.verdeEscuro} />
              <Text style={[styles.secaoTitulo, { color: CORES_SYMBIUS.texto, fontSize: fs(15) }]}>
                Quer melhorar
              </Text>
            </View>
            <View style={[styles.skillsCard, { backgroundColor: CORES_SYMBIUS.fundoCard, marginTop: 10 }]}>
              {aprende.length === 0 ? (
                <Text style={[styles.skillsVazio, { color: CORES_SYMBIUS.textoSec, fontSize: fs(12) }]}>
                  Nenhuma matéria
                </Text>
              ) : (
                <View style={styles.chipsWrap}>
                  {aprende.map((m: string) => (
                    <View key={m} style={[styles.chipSkill, {
                      backgroundColor: CORES_SYMBIUS.verdeEscuro + (modoEscuro ? '25' : '12'),
                      borderColor: CORES_SYMBIUS.verdeEscuro + '50',
                    }]}>
                      <Text style={[styles.chipSkillText, { color: CORES_SYMBIUS.verdeEscuro, fontSize: fs(12) }]}>{m}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        </FadeInView>

        {/* ════ SOBRE (read-only) ════ */}
        {usuario.bio ? (
          <FadeInView delay={600}>
            <View style={styles.secao}>
              <View style={styles.secaoTituloComIcon}>
                <Ionicons name="reader-outline" size={14} color={CORES_SYMBIUS.textoSec} />
                <Text style={[styles.secaoTitulo, { color: CORES_SYMBIUS.texto, fontSize: fs(15) }]}>
                  Sobre
                </Text>
              </View>
              <View style={[styles.bioCard, { backgroundColor: CORES_SYMBIUS.fundoCard, marginTop: 10 }]}>
                <Text style={[styles.bioText, { color: CORES_SYMBIUS.texto, fontSize: fs(13) }]}>
                  {usuario.bio}
                </Text>
              </View>
            </View>
          </FadeInView>
        ) : null}

        {/* ════ INFO ACADÊMICA (SEM RA — só visível pro próprio dono) ════ */}
        <FadeInView delay={720}>
          <View style={styles.secao}>
            <Text style={[styles.secaoTituloPrincipal, { color: CORES_SYMBIUS.texto, fontSize: fs(15) }]}>
              Informações Acadêmicas
            </Text>
            <View style={[styles.infoCard, { backgroundColor: CORES_SYMBIUS.fundoCard }]}>
              <View style={styles.infoBox}>
                <Text style={[styles.infoLabel, { color: CORES_SYMBIUS.textoSec, fontSize: fs(12) }]}>TURMA</Text>
                <Text style={[styles.infoValor, { color: CORES_SYMBIUS.texto, fontSize: fs(15) }]} numberOfLines={1}>
                  {usuario.turma || '—'}
                </Text>
              </View>
              <View style={[styles.infoSep, { backgroundColor: CORES_SYMBIUS.borda }]} />
              <View style={styles.infoBox}>
                <Text style={[styles.infoLabel, { color: CORES_SYMBIUS.textoSec, fontSize: fs(12) }]}>AJUDAS</Text>
                <Text style={[styles.infoValor, { color: CORES_SYMBIUS.texto, fontSize: fs(15) }]}>
                  {usuario.ajudas || 0}
                </Text>
              </View>
            </View>
          </View>
        </FadeInView>
      </ScrollView>
      <SymbiusTabBar ativa="nenhuma" navigation={navigation} uid={meuUid ?? null} />
    </SafeAreaView>
  );
}

// ════════════════════════════════════════════════════════════════════════
//  STYLESHEET
// ════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: { flex: 1 },
  centro:    { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
  semDadosText: { fontFamily: F.bold },

  // HEADER
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 4 },
  btnVoltar: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  logoText:  { fontFamily: F.black, letterSpacing: -0.5 },

  // PERFIL PRIVADO
  fotoWrapGrande: { width: 120, height: 120, marginBottom: 6 },
  fotoGrande: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: CORES_SYMBIUS.verdeEscuro },
  fotoPlaceholderGrande: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: CORES_SYMBIUS.verdeEscuro, justifyContent: 'center', alignItems: 'center' },
  fotoLetraGrande: { color: CORES_SYMBIUS.verdeEscuro, fontFamily: F.black },
  nomePrivado: { fontFamily: F.black, textAlign: 'center', letterSpacing: -0.4 },
  cadeadoBox: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, marginTop: 6 },
  cadeadoText: { fontFamily: F.semibold },

  // HERO
  heroCard:  { borderWidth: 1, borderColor: CORES_SYMBIUS.borda, flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 14, padding: 16, borderRadius: 22, gap: 14 },
  fotoWrap:  { width: 76, height: 76 },
  foto:      { width: 76, height: 76, borderRadius: 38, borderWidth: 3, borderColor: CORES_SYMBIUS.verdeEscuro },
  fotoPlaceholder: { width: 76, height: 76, borderRadius: 38, borderWidth: 3, borderColor: CORES_SYMBIUS.verdeEscuro, justifyContent: 'center', alignItems: 'center' },
  fotoLetra: { color: CORES_SYMBIUS.verdeEscuro, fontFamily: F.black, letterSpacing: -1 },
  onlineDot: { position: 'absolute', bottom: 2, right: 2, width: 18, height: 18, borderRadius: 9, backgroundColor: '#22C55E', borderWidth: 3, borderColor: CORES_SYMBIUS.fundoCard },

  heroInfo:  { flex: 1, gap: 8 },
  nome:      { fontFamily: F.black, letterSpacing: -0.4, lineHeight: 27 },
  tutorBadge:{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1, alignSelf: 'flex-start' },
  tutorBadgeText: { color: CORES_SYMBIUS.verdeEscuro, fontFamily: F.black, letterSpacing: 1 },
  onlineChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: '#22C55E18' },
  onlineChipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E' },
  onlineChipText: { color: '#16A34A', fontFamily: F.black, letterSpacing: 1 },

  // BOTÃO CONVERSAR
  btnConversar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, marginTop: 14, minHeight: 48, borderRadius: 16 },
  btnConversarText: { color: CORES_SYMBIUS.creme, fontFamily: F.black },

  // SECAO
  secao:     { marginHorizontal: 16, marginTop: 22 },
  secaoTituloPrincipal: { fontFamily: F.black, letterSpacing: -0.3, marginBottom: 10, paddingHorizontal: 2 },
  secaoTitulo: { fontFamily: F.black, letterSpacing: -0.3 },
  secaoTituloComIcon: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 2 },

  // MEDALHAS
  medalhasRow: { gap: 18, paddingHorizontal: 4, paddingVertical: 6, paddingRight: 20 },
  medalhaItem: { alignItems: 'center', gap: 6, width: 76 },
  medalhaCirculo: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
  medalhaImage: { width: 50, height: 50, borderRadius: 25 },
  medalhaLabel: { fontFamily: F.bold, textAlign: 'center', letterSpacing: -0.2 },
  medalhasVazio: { borderWidth: 1, borderColor: CORES_SYMBIUS.borda, borderRadius: 16, paddingVertical: 22, alignItems: 'center', gap: 8 },
  medalhasVazioText: { fontFamily: F.medium, paddingHorizontal: 30, textAlign: 'center' },

  // ESPECIALIDADES
  especCard: { borderWidth: 1, borderColor: CORES_SYMBIUS.borda, alignItems: 'center', borderRadius: 22, padding: 12, gap: 8 },
  especRadarBox: { width: 260, justifyContent: 'center', alignItems: 'center' },
  radarLegenda:  { textAlign: 'center', marginTop: 4, fontFamily: F.regular },
  especListaBox: { alignSelf: 'stretch', gap: 8 },
  materiaPill: { paddingHorizontal: 16, paddingVertical: 14, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 8 },
  materiaDot: { width: 6, height: 6, borderRadius: 3 },
  materiaText: { fontFamily: F.bold, flex: 1 },
  especVazio: { paddingVertical: 12, alignItems: 'center', gap: 6 },
  especVazioText: { fontFamily: F.medium, fontStyle: 'italic', textAlign: 'center' },

  // SKILLS
  skillsCard: { borderWidth: 1, borderColor: CORES_SYMBIUS.borda, borderRadius: 14, padding: 14 },
  skillsVazio: { fontFamily: F.medium, fontStyle: 'italic', textAlign: 'center', paddingVertical: 14 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipSkill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  chipSkillText: { fontFamily: F.bold },

  // BIO
  bioCard: { borderWidth: 1, borderColor: CORES_SYMBIUS.borda, borderRadius: 14, padding: 14 },
  bioText: { fontFamily: F.regular, lineHeight: 19 },

  // INFO
  infoCard: { borderWidth: 1, borderColor: CORES_SYMBIUS.borda, flexDirection: 'row', borderRadius: 14, padding: 16, alignItems: 'center' },
  infoBox: { flex: 1, alignItems: 'center', gap: 4 },
  infoLabel: { fontFamily: F.black, letterSpacing: 1 },
  infoValor: { fontFamily: F.black, letterSpacing: -0.3 },
  infoSep: { width: 1, height: 26 },

  // XP & GAMIFICAÇÃO
  xpCard: { borderWidth: 1, borderColor: CORES_SYMBIUS.borda, borderRadius: 18, overflow: 'hidden' },
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

  // PRIVACIDADE
  privacidadeCard: { borderRadius: 14, padding: 16, alignItems: 'center', gap: 10, justifyContent: 'center' },
  privacidadeText: { fontFamily: F.medium, textAlign: 'center' },
});