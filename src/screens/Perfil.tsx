import { voltar } from '../navegacao';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  StatusBar, Modal, TextInput, ActivityIndicator,
  Image, Animated, Platform, PanResponder
} from 'react-native';
import { db } from '../config/firebaseConfig';
import {
  doc, getDoc, updateDoc, collection, getDocs, onSnapshot
} from 'firebase/firestore';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polygon, Circle, Line, Text as SvgText, G, Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { useAppSettings } from '../contexts/AppSettingsContext';
import AnimalImagem from '../components/AnimalImagem';
import { calcularNivel, calcularFaseCoruja, calcularProgressoXp, Animal } from '../utils/gamification';

import { F } from '../constants/theme';
import { TEMA_SYMBIUS as CORES, CORES_SYMBIUS, NIVEL_GRADIENTE, NIVEL_NUMERO } from '../constants/temaSymbius';
import SymbiusTabBar from '../components/SymbiusTabBar';
import PainelPrivacidade from '../components/PainelPrivacidade';
import AvatarComCosmeticos from '../components/AvatarComCosmeticos';
import { escolherImagemBase64, OrigemImagem } from '../utils/midiaNativa';
import { sairDaConta } from '../services/authService';

const fotoUri = (foto?: string | null) =>
  !foto ? null : foto.startsWith('http') || foto.startsWith('data:') ? foto : `data:image/jpeg;base64,${foto}`;

// "Henrique Signor" → "HS"; nome único → só a primeira letra
const iniciais = (nome?: string) => {
  const partes = (nome || '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  const primeira = partes[0].charAt(0);
  const ultima = partes.length > 1 ? partes[partes.length - 1].charAt(0) : '';
  return (primeira + ultima).toUpperCase();
};

// ════════════════════════════════════════════════════════════════════════
//  ÁREAS DE CONHECIMENTO
// ════════════════════════════════════════════════════════════════════════
// Cores fixas (não seguem o tema ativo) — o radar de matérias precisa das 5
// sempre distintas entre si, então ficam desacopladas de CORES/TEMA_SYMBIUS.
const AREAS = [
  { key: 'exatas',     label: 'Exatas',      cor: '#3498db' },
  { key: 'humanas',    label: 'Humanas',     cor: '#e67e22' },
  { key: 'biologicas', label: 'Biológicas',  cor: '#27ae60' },
  { key: 'linguagens', label: 'Linguagens',  cor: '#E51C6A' },
  { key: 'tecnologia', label: 'Lógica',      cor: '#8e44ad' },
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


// ── Banner do topo: cores do animal do nível, com facetas low-poly ──
const BANNER_H = 220;
const FACETAS = [
  '0,0 38,0 0,34', '38,0 78,0 58,26', '78,0 100,0 100,30', '0,34 26,60 0,60',
  '26,60 60,60 44,38', '60,60 100,60 100,34', '58,26 100,30 70,48',
];
const BannerAnimal = ({ animal }: { animal: Animal }) => {
  const g = NIVEL_GRADIENTE[animal];
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 100 60" preserveAspectRatio="none">
      <Defs>
        <RadialGradient id={`banner-${animal}`} cx="72%" cy="24%" r="85%">
          <Stop offset="0" stopColor={g.c1} />
          <Stop offset="1" stopColor={g.c2} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100" height="60" fill={`url(#banner-${animal})`} />
      {FACETAS.map((pts, i) => (
        <Polygon key={i} points={pts} fill={i % 2 ? '#FFFFFF' : '#000000'} fillOpacity={i % 2 ? 0.06 : 0.1} />
      ))}
    </Svg>
  );
};

const RadarChart = ({ scores, size, modoEscuro }: any) => {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.24;
  const N = AREAS.length;
  const labelDist = radius + size * 0.12;

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

  const corLinhas = CORES_SYMBIUS.borda2;
  const corLabel  = CORES_SYMBIUS.textoSec;
  const corPolig  = CORES_SYMBIUS.verdeEscuro;

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
            fontSize={size * 0.055}
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



// ── Estilos do novo cabeçalho/hero do Perfil (pixel-fiel ao mockup Symbius) ──
const heroStyles = StyleSheet.create({
  topHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 8, minHeight: 44,
  },
  topHeaderTituloFlex: { flex: 1, textAlign: 'center' },
  topHeaderLado: { width: 96, flexDirection: 'row', alignItems: 'center', gap: 8 },
  topHeaderTitulo: { fontFamily: F.bold, color: CORES_SYMBIUS.texto },

  banner: { width: '100%', overflow: 'hidden', borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  bannerAnimal: { position: 'absolute', right: 10, bottom: 8 },
  topHeaderSobreBanner: { position: 'absolute', top: 0, left: 0, right: 0 },
  btnBanner: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.22)' },
  avatarRow: { paddingHorizontal: 20, marginTop: -48, flexDirection: 'row', alignItems: 'flex-end' },
  identidade: { paddingHorizontal: 20, marginTop: 12 },
  handleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 2 },
  tutorChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: CORES_SYMBIUS.verdeEscuro + '1F' },
  tutorChipTxt: { fontFamily: F.bold, color: CORES_SYMBIUS.verdeEscuro },
  bloco: { marginHorizontal: 16 },
  nivelTopo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nivelNome: { fontFamily: F.black, letterSpacing: -0.3, color: CORES_SYMBIUS.texto },
  nivelSub: { fontFamily: F.medium, color: CORES_SYMBIUS.textoSec, marginTop: 1 },
  nivelXp: { fontFamily: F.black, color: CORES_SYMBIUS.texto },
  nivelXpSufixo: { fontFamily: F.semibold, fontSize: 12, color: CORES_SYMBIUS.textoSec },
  barraTrilho: { height: 10, borderRadius: 5, backgroundColor: CORES_SYMBIUS.fundoSuave, overflow: 'hidden', marginTop: 16 },
  barraFill: { height: 10, borderRadius: 5 },
  barraTxt: { fontFamily: F.medium, color: CORES_SYMBIUS.textoSec, marginTop: 8 },
  statsCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, marginTop: 12 },
  stat: { flex: 1, alignItems: 'center', gap: 3 },
  statNum: { fontFamily: F.black, color: CORES_SYMBIUS.texto },
  statLabel: { fontFamily: F.medium, color: CORES_SYMBIUS.textoSec },
  statSep: { width: 1, height: 44, backgroundColor: CORES_SYMBIUS.borda2 },
  btnEditarBio: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: CORES_SYMBIUS.borda2, backgroundColor: CORES_SYMBIUS.fundoCard },
  heroWrap: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 4 },
  // Folga embaixo: colar/laço saem dos limites da foto.
  avatarWrap: { position: 'relative', marginBottom: 14 },
  avatar: { width: 96, height: 96, borderRadius: 48, borderWidth: 4, borderColor: CORES_SYMBIUS.fundo },
  avatarPlaceholder: {
    backgroundColor: CORES_SYMBIUS.fundoSuave, justifyContent: 'center', alignItems: 'center',
  },
  avatarCarregando: { position: 'absolute', top: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },
  avatarBadge: {
    position: 'absolute', bottom: -4, right: -4, width: 32, height: 32, borderRadius: 16,
    backgroundColor: CORES_SYMBIUS.fundoSuave, borderWidth: 2, borderColor: CORES_SYMBIUS.fundo,
    justifyContent: 'center', alignItems: 'center',
  },
  fotoEditBtn: {
    position: 'absolute', bottom: 2, right: 0, width: 28, height: 28, borderRadius: 14,
    backgroundColor: CORES_SYMBIUS.verdeEscuro, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: CORES_SYMBIUS.fundo,
  },

  nome: { fontFamily: F.black, letterSpacing: -0.5, color: CORES_SYMBIUS.texto },
  handle: { fontFamily: F.medium, color: CORES_SYMBIUS.textoSec, marginTop: 2 },

  levelPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10,
    backgroundColor: CORES_SYMBIUS.fundoSuave, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14,
  },
  levelPillTxt: { fontFamily: F.bold, color: CORES_SYMBIUS.texto },

  xpBarWrap: { width: '100%', maxWidth: 220, marginTop: 12 },
  xpBarLabel: { fontFamily: F.medium, color: CORES_SYMBIUS.textoSec, marginBottom: 6, textAlign: 'center' },
  xpBarBg: { width: '100%', height: 6, borderRadius: 3, backgroundColor: CORES_SYMBIUS.borda, overflow: 'hidden' },
  xpBarFill: { height: 6, borderRadius: 3, backgroundColor: CORES_SYMBIUS.verdeEscuro },

  papelTabs: {
    flexDirection: 'row', gap: 6, backgroundColor: CORES_SYMBIUS.fundoSuave,
    padding: 4, borderRadius: 16, marginTop: 14, width: '100%', alignSelf: 'stretch',
  },
  papelTab: { flex: 1, minHeight: 42, justifyContent: 'center', borderRadius: 12, alignItems: 'center' },
  papelTabAtivo: { backgroundColor: CORES_SYMBIUS.verdeEscuro },
  papelTabTxt: { fontFamily: F.semibold, color: CORES_SYMBIUS.textoSec },
  papelTabTxtAtivo: { fontFamily: F.bold, color: CORES_SYMBIUS.creme },

  conquistasRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 22, paddingHorizontal: 8 },
  conquistaItem: { alignItems: 'center', gap: 6, flex: 1 },
  conquistaCirculo: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: CORES_SYMBIUS.fundoSuave,
    justifyContent: 'center', alignItems: 'center',
  },
  conquistaNum: { fontFamily: F.bold, color: CORES_SYMBIUS.texto },
  conquistaLabel: { fontFamily: F.medium, color: CORES_SYMBIUS.textoSec, textAlign: 'center' },

  btnEditarPerfil: {
    width: '100%', marginTop: 20, paddingVertical: 14, borderRadius: 16,
    backgroundColor: CORES_SYMBIUS.fundoSuave, borderWidth: 1, borderColor: CORES_SYMBIUS.borda2,
    alignItems: 'center',
  },
  btnEditarPerfilTxt: { fontFamily: F.bold, color: CORES_SYMBIUS.texto },
});

export default function Perfil({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const uid = route?.params?.uid;

  const { fonteScale } = useAppSettings();
  // ── TELA DE TESTE (Symbius): paleta verde fixa, ignora o tema real do usuário.
  const modoEscuro = false; // paleta Symbius agora é modo claro
  const C = CORES; // CORES já é TEMA_SYMBIUS (import aliasado acima)
  const fs = (size: number) => size * fonteScale;

  const [usuario,      setUsuario]      = useState<any>(null);
  const [medalhas,     setMedalhas]     = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [salvando,     setSalvando]     = useState(false);
  const [toast,        setToast]        = useState('');

  const [modalBio,     setModalBio]     = useState(false);
  const [bioTemp,      setBioTemp]      = useState('');
  const [modalSkill,   setModalSkill]   = useState<'ensina' | 'melhorar' | null>(null);

  // ── Papel na comunidade (Aprendiz/Mentor) — front-end apenas por enquanto:
  // só grava a tag em `papel_comunidade` (mesmo campo já usado no cadastro e
  // no filtro do Leaderboard); nenhuma lógica de contagem/gamificação nova.
  const [papelAtivo, setPapelAtivo] = useState<'aprender' | 'ensinar'>('aprender');
  const papelAtivoRef = useRef<'aprender' | 'ensinar'>('aprender');
  useEffect(() => { papelAtivoRef.current = papelAtivo; }, [papelAtivo]);
  const escolherPapelRef = useRef<(papel: 'aprender' | 'ensinar') => void>(() => {});
  // Arrastar o dedo pra esquerda/direita no toggle também alterna Aprendiz/Mentor
  // (com animação de movimento: o toggle acompanha o dedo e volta com uma mola)
  const papelSwipeX = useRef(new Animated.Value(0)).current;
  const papelSwipeResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 20 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_, g) => {
        const max = 32;
        papelSwipeX.setValue(Math.max(-max, Math.min(max, g.dx * 0.4)));
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx < -40 && papelAtivoRef.current === 'aprender') escolherPapelRef.current('ensinar');
        else if (g.dx > 40 && papelAtivoRef.current === 'ensinar') escolherPapelRef.current('aprender');
        Animated.spring(papelSwipeX, { toValue: 0, useNativeDriver: true, friction: 6 }).start();
      },
    })
  ).current;
  const [salvandoPapel, setSalvandoPapel] = useState(false);
  const [modalConfirmSair, setModalConfirmSair] = useState(false);
  const [modalFoto,    setModalFoto]    = useState(false);
  const [salvandoFoto, setSalvandoFoto] = useState(false);

  const trocarFoto = async (origem: OrigemImagem) => {
    setModalFoto(false);
    try {
      // Foto de perfil fica pequena: aparece no máximo a ~90px na tela
      const b64 = await escolherImagemBase64({ origem, ladoMax: 400, qualidade: 0.7, quadrada: true });
      if (!b64) return;
      setSalvandoFoto(true);
      await updateDoc(doc(db, 'usuarios', uid), { foto: b64 });
      setToast('Foto atualizada');
    } catch (e) {
      console.log('Erro ao trocar foto:', e);
      setToast('Erro ao salvar a foto');
    } finally {
      setSalvandoFoto(false);
    }
  };

  const removerFoto = async () => {
    setModalFoto(false);
    setSalvandoFoto(true);
    try {
      await updateDoc(doc(db, 'usuarios', uid), { foto: null });
      setToast('Foto removida');
    } catch { setToast('Erro ao remover'); }
    finally { setSalvandoFoto(false); }
  };

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

  useEffect(() => {
    if (usuario?.papel_comunidade === 'ensinar' || usuario?.papel_comunidade === 'aprender') {
      setPapelAtivo(usuario.papel_comunidade);
    }
  }, [usuario?.papel_comunidade]);

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

  const alterarVisivelMatch = async (valor: boolean) => {
    if (!uid) return;
    setUsuario((prev: any) => prev ? { ...prev, visivel_match: valor } : prev);
    try {
      await updateDoc(doc(db, 'usuarios', uid), { visivel_match: valor });
      setToast(valor ? 'Você aparece nos Elos' : 'Você está oculto nos Elos');
    } catch {
      setUsuario((prev: any) => prev ? { ...prev, visivel_match: !valor } : prev);
      setToast('Erro ao salvar');
    }
  };

  const escolherPapel = async (papel: 'aprender' | 'ensinar') => {
    if (!uid || papel === papelAtivo) { setPapelAtivo(papel); return; }
    setPapelAtivo(papel);
    setSalvandoPapel(true);
    try {
      await updateDoc(doc(db, 'usuarios', uid), { papel_comunidade: papel });
    } catch {
      setToast('Erro ao salvar');
    } finally {
      setSalvandoPapel(false);
    }
  };
  useEffect(() => { escolherPapelRef.current = escolherPapel; });

  const sair = async () => {
    await sairDaConta(uid);
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

  // Nível atual: o animal manda nas cores do banner e da barra de XP
  const xpAtual = usuario.xp_total || 0;
  const nivelInfo = calcularNivel(xpAtual);
  const progressoXp = calcularProgressoXp(xpAtual);
  const gAnimal = NIVEL_GRADIENTE[nivelInfo.animal];

  return (
    <View style={[styles.container, { backgroundColor: C.fundo }]}>
      <StatusBar barStyle={CORES_SYMBIUS.barStyle} backgroundColor={C.fundo} />

      {/* TOAST */}
      {toast !== '' && (
        <View style={[styles.toast, { top: insets.top + 12 }]}>
          <Ionicons name="checkmark-circle" size={15} color={CORES.amarelo} />
          <Text style={[styles.toastText, { fontSize: fs(12) }]}>{toast}</Text>
        </View>
      )}

     
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* BANNER na cor do animal */}
        <View style={[heroStyles.banner, { height: BANNER_H + insets.top, backgroundColor: gAnimal.c1 }]}>
          <BannerAnimal animal={nivelInfo.animal} />
          <View style={heroStyles.bannerAnimal} pointerEvents="none">
            <AnimalImagem animal={nivelInfo.animal} size={140} />
          </View>

          <View style={[heroStyles.topHeader, heroStyles.topHeaderSobreBanner, { paddingTop: insets.top + 24 }]}>
            {/* Lados com a mesma largura pra centralizar o título sem
                sobrepor nada: antes ele era um Text absoluto por cima do
                botão de voltar e roubava os toques no Android/iOS. */}
            <View style={heroStyles.topHeaderLado}>
              <TouchableOpacity
                onPress={() => (navigation.canGoBack() ? voltar(navigation) : navigation.navigate('Index', { uid }))}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={heroStyles.btnBanner}
                accessibilityRole="button"
                accessibilityLabel="Voltar"
              >
                <Ionicons name="arrow-back" size={22} color={gAnimal.labelTopo} />
              </TouchableOpacity>
            </View>
            <Text
              style={[heroStyles.topHeaderTitulo, heroStyles.topHeaderTituloFlex, { fontSize: fs(15), color: gAnimal.labelTopo }]}
              numberOfLines={1}
              accessibilityRole="header"
            >
              Perfil
            </Text>
            <View style={[heroStyles.topHeaderLado, { justifyContent: 'flex-end' }]}>
              <TouchableOpacity style={heroStyles.btnBanner} onPress={() => navigation.navigate('Loja', { uid })} accessibilityLabel="Loja">
                <Ionicons name="bag-outline" size={19} color={gAnimal.labelTopo} />
              </TouchableOpacity>
              <TouchableOpacity style={heroStyles.btnBanner} onPress={() => navigation.navigate('Leaderboard', { uid })} accessibilityLabel="Ranking">
                <FontAwesome5 name="trophy" size={16} color={gAnimal.labelTopo} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <FadeInView delay={0}>
          {/* FOTO + NOME (a foto sobe sobre o banner) */}
          <View style={heroStyles.avatarRow}>
            <TouchableOpacity style={heroStyles.avatarWrap} onPress={() => setModalFoto(true)} activeOpacity={0.85} accessibilityLabel="Alterar foto de perfil">
              <AvatarComCosmeticos
                foto={usuario.foto}
                nome={usuario.nome_completo}
                tamanho={96}
                cosmeticosEquipados={usuario.cosmeticos_equipados}
                borda={{ cor: CORES_SYMBIUS.fundo, largura: 4 }}
              />
              {salvandoFoto && (
                <View style={[heroStyles.avatar, heroStyles.avatarCarregando]}>
                  <ActivityIndicator color="#FFF" />
                </View>
              )}
              <View style={heroStyles.fotoEditBtn}>
                <Ionicons name="camera" size={13} color={CORES_SYMBIUS.creme} />
              </View>
            </TouchableOpacity>
          </View>

          <View style={heroStyles.identidade}>
            <Text style={[heroStyles.nome, { fontSize: fs(24) }]} numberOfLines={2}>
              {usuario.nome_completo || 'Sem nome'}
            </Text>
            <View style={heroStyles.handleRow}>
              <Text style={[heroStyles.handle, { fontSize: fs(13) }]}>
                @{(usuario.nome_completo || 'usuario')
                  .normalize('NFD').replace(/[̀-ͯ]/g, '')
                  .toLowerCase().trim().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '')}
              </Text>
              {isTutor && (
                <View style={heroStyles.tutorChip}>
                  <FontAwesome5 name="graduation-cap" size={10} color={CORES_SYMBIUS.verdeEscuro} />
                  <Text style={[heroStyles.tutorChipTxt, { fontSize: fs(12) }]}>Tutor</Text>
                </View>
              )}
            </View>
          </View>

          {/* NÍVEL: animal, fase e barra de XP na cor do animal */}
          <TouchableOpacity
            style={[styles.cardN, heroStyles.bloco, { marginTop: 20 }]}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Leaderboard', { uid })}
            accessibilityRole="button"
            accessibilityLabel={`${nivelInfo.nomeAnimal} ${nivelInfo.nomeSubfase}, ${xpAtual} de experiência. Abrir ranking.`}
          >
            <View style={heroStyles.nivelTopo}>
              <AnimalImagem animal={nivelInfo.animal} size={52} />
              <View style={{ flex: 1 }}>
                <Text style={[heroStyles.nivelNome, { fontSize: fs(17) }]}>{nivelInfo.nomeAnimal} · {nivelInfo.nomeSubfase}</Text>
                <Text style={[heroStyles.nivelSub, { fontSize: fs(12) }]}>Nível {NIVEL_NUMERO[nivelInfo.animal]}</Text>
              </View>
              <Text style={[heroStyles.nivelXp, { fontSize: fs(18) }]}>{xpAtual}<Text style={heroStyles.nivelXpSufixo}> XP</Text></Text>
              <Ionicons name="chevron-forward" size={18} color={CORES_SYMBIUS.textoSec} />
            </View>
            <View style={heroStyles.barraTrilho}>
              <View style={[heroStyles.barraFill, { width: `${Math.max(progressoXp.percentual, 3)}%`, backgroundColor: gAnimal.c1 }]} />
            </View>
            <Text style={[heroStyles.barraTxt, { fontSize: fs(12) }]}>faltam {progressoXp.faltam} XP para evoluir</Text>
          </TouchableOpacity>

          {/* Aprendiz / Mentor — front-end apenas: grava a tag em
              `papel_comunidade` (mesmo campo do cadastro / filtro do Ranking). */}
          <View style={heroStyles.bloco}>
            <Animated.View style={[heroStyles.papelTabs, { transform: [{ translateX: papelSwipeX }] }]} {...papelSwipeResponder.panHandlers}>
              <TouchableOpacity
                style={[heroStyles.papelTab, papelAtivo === 'aprender' && heroStyles.papelTabAtivo]}
                onPress={() => escolherPapel('aprender')}
                disabled={salvandoPapel}
                accessibilityRole="tab"
                accessibilityState={{ selected: papelAtivo === 'aprender' }}
              >
                <Text style={[heroStyles.papelTabTxt, papelAtivo === 'aprender' && heroStyles.papelTabTxtAtivo, { fontSize: fs(13) }]}>Aprendiz</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[heroStyles.papelTab, papelAtivo === 'ensinar' && heroStyles.papelTabAtivo]}
                onPress={() => escolherPapel('ensinar')}
                disabled={salvandoPapel}
                accessibilityRole="tab"
                accessibilityState={{ selected: papelAtivo === 'ensinar' }}
              >
                <Text style={[heroStyles.papelTabTxt, papelAtivo === 'ensinar' && heroStyles.papelTabTxtAtivo, { fontSize: fs(13) }]}>Mentor</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* Números reais já carregados (nenhum contador novo/fake) */}
          <View style={[styles.cardN, heroStyles.bloco, heroStyles.statsCard]}>
            <View style={heroStyles.stat}>
              <Ionicons name="leaf" size={22} color={CORES_SYMBIUS.verdeEscuro} />
              <Text style={[heroStyles.statNum, { fontSize: fs(20) }]}>{usuario.moedas_saldo || 0}</Text>
              <Text style={[heroStyles.statLabel, { fontSize: fs(12) }]}>Sementes</Text>
            </View>
            <View style={heroStyles.statSep} />
            <View style={heroStyles.stat}>
              <Ionicons name="infinite" size={22} color={CORES_SYMBIUS.verdeEscuro} />
              <Text style={[heroStyles.statNum, { fontSize: fs(20) }]}>{usuario.matches_bonificados_hoje || 0}/3</Text>
              <Text style={[heroStyles.statLabel, { fontSize: fs(12) }]}>Elos hoje</Text>
            </View>
            <View style={heroStyles.statSep} />
            <View style={heroStyles.stat}>
              <Ionicons name="ribbon" size={22} color={CORES_SYMBIUS.verdeEscuro} />
              <Text style={[heroStyles.statNum, { fontSize: fs(20) }]}>{medalhas.length}</Text>
              <Text style={[heroStyles.statLabel, { fontSize: fs(12) }]}>Medalhas</Text>
            </View>
            {usuario.avaliacao_contagem > 0 && (
              <>
                <View style={heroStyles.statSep} />
                <View style={heroStyles.stat}>
                  <Ionicons name="star" size={22} color={CORES_SYMBIUS.verdeEscuro} />
                  <Text style={[heroStyles.statNum, { fontSize: fs(20) }]}>{usuario.avaliacao_media.toFixed(1)}</Text>
                  <Text style={[heroStyles.statLabel, { fontSize: fs(12) }]}>{usuario.avaliacao_contagem} aval.</Text>
                </View>
              </>
            )}
          </View>
        </FadeInView>

        {/* SOBRE MIM */}
        <FadeInView delay={60}>
          <View style={styles.secaoN}>
            <View style={styles.secaoTopoN}>
              <Text style={[styles.tituloN, { fontSize: fs(18) }]}>Sobre mim</Text>
              <TouchableOpacity style={heroStyles.btnEditarBio} onPress={abrirEdicaoBio} accessibilityRole="button" accessibilityLabel="Editar descrição">
                <Ionicons name="create-outline" size={18} color={CORES_SYMBIUS.verdeEscuro} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.cardN} activeOpacity={0.75} onPress={abrirEdicaoBio}>
              <Text
                style={[styles.bioText, {
                  color: usuario.bio ? CORES_SYMBIUS.texto : CORES_SYMBIUS.textoSec,
                  fontSize: fs(14),
                  fontStyle: usuario.bio ? 'normal' : 'italic',
                }]}
              >
                {usuario.bio || 'Toque para adicionar uma descrição sobre você...'}
              </Text>
            </TouchableOpacity>
          </View>
        </FadeInView>

        {medalhas.length > 0 && (
          <FadeInView delay={150}>
            <View style={styles.secaoN}>
              <Text style={[styles.tituloN, { fontSize: fs(18), marginBottom: 6 }]}>
                Medalhas
              </Text>
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
            </View>
          </FadeInView>
        )}

        {/* MINHAS ESPECIALIDADES */}
        <FadeInView delay={240}>
          <View style={styles.secaoN}>
            <Text style={[styles.tituloN, { fontSize: fs(18) }]}>Minhas especialidades</Text>
            <View style={styles.cardN}>
              <View style={{ alignItems: 'center' }}>
                <RadarChart scores={radarScores} size={260} modoEscuro={modoEscuro} />
                <Text style={[styles.radarLegenda, { color: CORES_SYMBIUS.textoSec, fontSize: fs(12) }]}>
                  Baseado nas suas matérias de tutoria
                </Text>
              </View>
              {topMaterias.length === 0 ? (
                <View style={styles.especVazio}>
                  <Ionicons name="add-circle-outline" size={22} color={CORES_SYMBIUS.textoSec} />
                  <Text style={[styles.especVazioText, { color: CORES_SYMBIUS.textoSec, fontSize: fs(12) }]}>
                    Adicione matérias abaixo
                  </Text>
                </View>
              ) : (
                <View style={styles.topMateriasN}>
                  {topMaterias.map((m: string) => {
                    const area = MATERIA_AREA[m];
                    const cor = AREAS.find(a => a.key === area)?.cor || CORES_SYMBIUS.verdeEscuro;
                    return (
                      <View key={m} style={styles.materiaChipN}>
                        <View style={[styles.materiaDot, { backgroundColor: cor }]} />
                        <Text style={[styles.chipNTxt, { color: CORES_SYMBIUS.texto, fontSize: fs(13) }]} numberOfLines={1}>{m}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        </FadeInView>

        {/* POSSO ENSINAR */}
        <FadeInView delay={360}>
          <View style={styles.secaoN}>
            <View style={styles.secaoTopoN}>
              <Text style={[styles.tituloN, { fontSize: fs(18) }]}>Posso ensinar</Text>
              <TouchableOpacity style={styles.btnAddN} onPress={() => setModalSkill('ensina')} accessibilityRole="button" accessibilityLabel="Adicionar matéria que posso ensinar">
                <Ionicons name="add" size={16} color={CORES_SYMBIUS.verdeEscuro} />
                <Text style={[styles.btnAddNTxt, { fontSize: fs(13) }]}>Adicionar</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.cardN}>
              {ensina.length === 0 ? (
                <Text style={[styles.vazioN, { fontSize: fs(13) }]}>Nenhuma matéria adicionada</Text>
              ) : (
                <View style={styles.chipsWrap}>
                  {ensina.map((m: string) => (
                    <TouchableOpacity key={m} style={[styles.chipN, styles.chipEnsina]} onPress={() => toggleSkill('ensina', m)} activeOpacity={0.7} accessibilityLabel={`Remover ${m}`}>
                      <Text style={[styles.chipNTxt, { color: CORES_SYMBIUS.texto, fontSize: fs(13) }]}>{m}</Text>
                      <Ionicons name="close" size={14} color={CORES_SYMBIUS.textoSec} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>
        </FadeInView>

        {/* QUERO MELHORAR */}
        <FadeInView delay={480}>
          <View style={styles.secaoN}>
            <View style={styles.secaoTopoN}>
              <Text style={[styles.tituloN, { fontSize: fs(18) }]}>Quero melhorar</Text>
              <TouchableOpacity style={styles.btnAddN} onPress={() => setModalSkill('melhorar')} accessibilityRole="button" accessibilityLabel="Adicionar matéria que quero melhorar">
                <Ionicons name="add" size={16} color={CORES_SYMBIUS.verdeEscuro} />
                <Text style={[styles.btnAddNTxt, { fontSize: fs(13) }]}>Adicionar</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.cardN}>
              {aprende.length === 0 ? (
                <Text style={[styles.vazioN, { fontSize: fs(13) }]}>Nenhuma matéria adicionada</Text>
              ) : (
                <View style={styles.chipsWrap}>
                  {aprende.map((m: string) => (
                    <TouchableOpacity key={m} style={[styles.chipN, styles.chipMelhorar]} onPress={() => toggleSkill('melhorar', m)} activeOpacity={0.7} accessibilityLabel={`Remover ${m}`}>
                      <Text style={[styles.chipNTxt, { color: CORES_SYMBIUS.texto, fontSize: fs(13) }]}>{m}</Text>
                      <Ionicons name="close" size={14} color={CORES_SYMBIUS.textoSec} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>
        </FadeInView>

        {/* PRIVACIDADE (antes ficava só em Configurações) */}
        <FadeInView delay={600}>
          <View style={styles.secaoN}>
            <Text style={[styles.tituloN, { fontSize: fs(18) }]} accessibilityRole="header">Privacidade</Text>
            <PainelPrivacidade
              visivelMatch={usuario.visivel_match !== false}
              onVisivelMatch={alterarVisivelMatch}
              fs={fs}
            />
          </View>
        </FadeInView>

        {/* INFORMAÇÕES ACADÊMICAS */}
        <FadeInView delay={720}>
          <View style={styles.secaoN}>
            <Text style={[styles.tituloN, { fontSize: fs(18) }]}>Informações acadêmicas</Text>
            <View style={[styles.cardN, styles.infoRowN]}>
              <View style={styles.infoBox}>
                <Text style={[styles.infoLabelN, { fontSize: fs(12) }]}>Turma</Text>
                <Text style={[styles.infoValorN, { fontSize: fs(16) }]} numberOfLines={1}>{usuario.turma || '—'}</Text>
              </View>
              <View style={styles.infoSepN} />
              <View style={styles.infoBox}>
                <Text style={[styles.infoLabelN, { fontSize: fs(12) }]}>RA</Text>
                <Text style={[styles.infoValorN, { fontSize: fs(16) }]} numberOfLines={1}>{usuario.ra || '—'}</Text>
              </View>
              <View style={styles.infoSepN} />
              <View style={styles.infoBox}>
                <Text style={[styles.infoLabelN, { fontSize: fs(12) }]}>Ajudas</Text>
                <Text style={[styles.infoValorN, { fontSize: fs(16) }]}>{usuario.ajudas || 0}</Text>
              </View>
            </View>
          </View>
        </FadeInView>

        {/* SAIR DA CONTA */}
        <FadeInView delay={840}>
          <TouchableOpacity
            style={styles.btnSairN}
            onPress={() => setModalConfirmSair(true)}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <Ionicons name="log-out-outline" size={20} color="#C84B2E" />
            <Text style={[styles.btnSairNTxt, { fontSize: fs(15) }]}>Sair da conta</Text>
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

      <Modal visible={modalFoto} transparent animationType="slide" onRequestClose={() => setModalFoto(false)}>
        <TouchableOpacity style={styles.fotoOverlay} activeOpacity={1} onPress={() => setModalFoto(false)}>
          <View style={[styles.fotoSheet, { paddingBottom: 20 + insets.bottom }]}>
            <View style={styles.fotoHandle} />
            <Text style={[styles.fotoTitulo, { fontSize: fs(15) }]}>Foto de perfil</Text>
            <TouchableOpacity style={styles.fotoOpcao} onPress={() => trocarFoto('galeria')}>
              <Ionicons name="images-outline" size={20} color={CORES_SYMBIUS.verdeEscuro} />
              <Text style={[styles.fotoOpcaoTxt, { fontSize: fs(14) }]}>Escolher da galeria</Text>
            </TouchableOpacity>
            {Platform.OS !== 'web' && (
              <TouchableOpacity style={styles.fotoOpcao} onPress={() => trocarFoto('camera')}>
                <Ionicons name="camera-outline" size={20} color={CORES_SYMBIUS.verdeEscuro} />
                <Text style={[styles.fotoOpcaoTxt, { fontSize: fs(14) }]}>Tirar foto</Text>
              </TouchableOpacity>
            )}
            {!!usuario.foto && (
              <TouchableOpacity style={styles.fotoOpcao} onPress={removerFoto}>
                <Ionicons name="trash-outline" size={20} color="#D64545" />
                <Text style={[styles.fotoOpcaoTxt, { fontSize: fs(14), color: '#D64545' }]}>Remover foto</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.fotoOpcao, { justifyContent: 'center', borderBottomWidth: 0 }]} onPress={() => setModalFoto(false)}>
              <Text style={[styles.fotoOpcaoTxt, { fontSize: fs(14), color: CORES_SYMBIUS.textoSec }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <SymbiusTabBar ativa="perfil" navigation={navigation} uid={uid} />
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════
//  STYLESHEET
// ════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  fotoOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  fotoSheet:   { backgroundColor: CORES_SYMBIUS.fundoCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12 },
  fotoHandle:  { width: 40, height: 4, borderRadius: 2, backgroundColor: CORES_SYMBIUS.borda2, alignSelf: 'center', marginBottom: 12 },
  fotoTitulo:  { fontFamily: F.black, color: CORES_SYMBIUS.texto, marginBottom: 6 },
  fotoOpcao:   { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: CORES_SYMBIUS.borda },
  fotoOpcaoTxt:{ fontFamily: F.semibold, color: CORES_SYMBIUS.texto },
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
  secaoN: { marginHorizontal: 16, marginTop: 24 },
  tituloN: { fontFamily: F.black, letterSpacing: -0.3, color: CORES_SYMBIUS.texto },
  secaoTopoN: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0 },
  cardN: { backgroundColor: CORES_SYMBIUS.fundoCard, borderRadius: 22, borderWidth: 1, borderColor: CORES_SYMBIUS.borda2, padding: 16, marginTop: 10 },
  btnAddN: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: CORES_SYMBIUS.borda2, backgroundColor: CORES_SYMBIUS.fundoCard },
  btnAddNTxt: { fontFamily: F.bold, color: CORES_SYMBIUS.verdeEscuro },
  chipN: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 38, paddingLeft: 14, paddingRight: 10, borderRadius: 19, borderWidth: 1 },
  chipEnsina: { backgroundColor: CORES_SYMBIUS.verdeEscuro + '1F', borderColor: CORES_SYMBIUS.verdeEscuro + '66' },
  chipMelhorar: { backgroundColor: CORES_SYMBIUS.semente + '33', borderColor: CORES_SYMBIUS.semente },
  chipNTxt: { fontFamily: F.semibold },
  topMateriasN: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 6 },
  materiaChipN: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 38, paddingHorizontal: 14, borderRadius: 19, backgroundColor: CORES_SYMBIUS.fundoSuave },
  vazioN: { fontFamily: F.medium, color: CORES_SYMBIUS.textoSec, textAlign: 'center', paddingVertical: 6 },
  infoRowN: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18 },
  infoLabelN: { fontFamily: F.medium, color: CORES_SYMBIUS.textoSec },
  infoValorN: { fontFamily: F.black, letterSpacing: -0.3, color: CORES_SYMBIUS.texto },
  infoSepN: { width: 1, height: 34, backgroundColor: CORES_SYMBIUS.borda2 },
  btnSairN: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52, marginHorizontal: 16, marginTop: 34, borderRadius: 18, borderWidth: 1.5, borderColor: '#C84B2E' },
  btnSairNTxt: { fontFamily: F.bold, color: '#C84B2E' },
  secao:     { marginHorizontal: 16, marginTop: 22 },
  secaoTituloPrincipal: { fontFamily: F.black, letterSpacing: -0.3, marginBottom: 4, paddingHorizontal: 2 },
  secaoSubtitulo:       { fontFamily: F.regular, marginBottom: 12, paddingHorizontal: 2 },
  conquistaSub:         { fontFamily: F.semibold, textAlign: 'center', marginTop: 1 },
  secaoHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingHorizontal: 2 },
  secaoTitulo: { fontFamily: F.black, letterSpacing: -0.3 },
  secaoTituloComIcon: { flexDirection: 'row', alignItems: 'center', gap: 7 },

  // MEDALHAS
  // CONQUISTAS
  conquistasGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingVertical: 4 },
  conquistaItem:    { alignItems: 'center', gap: 5, width: 72 },
  conquistaCirculo: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  conquistaEmoji:   { fontSize: 26 },
  conquistaLabel:   { fontFamily: F.bold, textAlign: 'center', letterSpacing: -0.2 },
  conquistaLock:    { position: 'absolute', bottom: 2, right: 2, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 8, padding: 2 },

  medalhasRow: { gap: 18, paddingHorizontal: 4, paddingVertical: 6, paddingRight: 20 },
  medalhaItem: { alignItems: 'center', gap: 6, width: 76 },
  medalhaCirculo: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
  medalhaImage: { width: 50, height: 50, borderRadius: 25 },
  medalhaLabel: { fontFamily: F.bold, textAlign: 'center', letterSpacing: -0.2 },
  medalhasVazio: { borderRadius: 16, paddingVertical: 22, alignItems: 'center', gap: 8 },
  medalhasVazioText: { fontFamily: F.medium, paddingHorizontal: 30, textAlign: 'center' },

  // ESPECIALIDADES
  especCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 22, padding: 12, gap: 4, elevation: 1, shadowColor: CORES.azulEscuro, shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  especRadarBox: { width: 260, justifyContent: 'center', alignItems: 'center' },
  radarLegenda:  { textAlign: 'center', marginTop: 4, fontFamily: F.regular },
  especListaBox: { flex: 1, gap: 8, paddingLeft: 4 },
  materiaPill: { paddingHorizontal: 16, paddingVertical: 14, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 8 },
  materiaDot: { width: 6, height: 6, borderRadius: 3 },
  materiaText: { fontFamily: F.bold, flex: 1 },
  especVazio: { paddingVertical: 12, alignItems: 'center', gap: 6 },
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