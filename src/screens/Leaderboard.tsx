import { voltar } from '../navegacao';
import React, { useState, useEffect, useCallback } from 'react';
import SymbiusTabBar from '../components/SymbiusTabBar';
import AvatarComCosmeticos from '../components/AvatarComCosmeticos';
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity,
  SafeAreaView, StatusBar, Image, ActivityIndicator, RefreshControl,
} from 'react-native';
import { db } from '../config/firebaseConfig';
import {
  collection, query, orderBy, limit, getDocs, where, doc, getDoc,
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppSettings } from '../contexts/AppSettingsContext';
import AnimalImagem from '../components/AnimalImagem';
import { calcularNivel, calcularProgressoXp, ANIMAIS_ORDER } from '../utils/gamification';
import { CORES_SYMBIUS } from './Boasvindas';
import { NIVEL_NUMERO } from '../constants/temaSymbius';
import { F } from '../constants/theme';

// ══════════════════════════════════════════════════════════════════════
// Ranking ligado ao back-end atual (mesma coleção `usuarios`, mesmo cálculo
// de nível). O filtro é Geral/Aprendiz/Mentor, usando o campo real
// `papel_comunidade`. A seção "sua jornada" usa o mesmo `calcularNivel` /
// `calcularProgressoXp` do resto do app.
// ══════════════════════════════════════════════════════════════════════

type Aba = 'geral' | 'aprender' | 'ensinar';
const ABAS: { chave: Aba; label: string }[] = [
  { chave: 'geral',    label: 'Geral' },
  { chave: 'aprender', label: 'Aprendiz' },
  { chave: 'ensinar',  label: 'Mentor' },
];

// Aros do pódio
const COR_POSICAO: Record<number, string> = { 1: '#D4A72C', 2: '#B8C0C4', 3: '#C98A4B' };

const primeiroNome = (u: any) => (u.nome_completo || u.nome || 'Anônimo').split(' ')[0];

export default function Leaderboard({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { fonteScale } = useAppSettings();
  const fs = (s: number) => s * fonteScale;

  const uidAtual: string = route?.params?.uid || '';

  const [ranking, setRanking]       = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [abaAtiva, setAbaAtiva]     = useState<Aba>('geral');
  const [meuXp, setMeuXp]           = useState<number | null>(null);
  const [top3, setTop3]             = useState<any[]>([]);

  // ── Minha jornada (independente da posição no ranking) ───────────────
  useEffect(() => {
    if (!uidAtual) return;
    getDoc(doc(db, 'usuarios', uidAtual)).then((snap) => {
      if (snap.exists()) setMeuXp(snap.data()?.xp_total || 0);
    }).catch(() => {});
  }, [uidAtual]);

  // ── Busca do ranking ───────────────────────────────────────────────────
  const buscarRanking = useCallback(async () => {
    try {
      let q;
      if (abaAtiva === 'geral') {
        q = query(collection(db, 'usuarios'), orderBy('xp_total', 'desc'), limit(20));
      } else {
        q = query(
          collection(db, 'usuarios'),
          where('papel_comunidade', '==', abaAtiva),
          orderBy('xp_total', 'desc'),
          limit(20),
        );
      }
      const snap = await getDocs(q);
      setRanking(snap.docs.map((d, i) => ({ ...(d.data() as any), uid: d.id, posicao: i + 1 })));
    } catch (e) {
      // Fallback sem filtro (ex: índice composto do Firestore ainda não existe)
      try {
        const snap = await getDocs(
          query(collection(db, 'usuarios'), orderBy('xp_total', 'desc'), limit(20)),
        );
        const todos = snap.docs.map((d, i) => ({ ...(d.data() as any), uid: d.id, posicao: i + 1 }));
        if (abaAtiva !== 'geral') {
          const filtrado = todos.filter(u => (u.papel_comunidade || 'aprender') === abaAtiva);
          setRanking(filtrado.map((u, i) => ({ ...u, posicao: i + 1 })));
        } else {
          setRanking(todos);
        }
      } catch (_) {}
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [abaAtiva]);

  useEffect(() => {
    setLoading(true);
    buscarRanking();
  }, [abaAtiva]);

  // Pódio: os 3 primeiros do ranking geral (independente da aba da lista)
  const buscarTop3 = useCallback(async () => {
    try {
      const snap = await getDocs(query(collection(db, 'usuarios'), orderBy('xp_total', 'desc'), limit(3)));
      setTop3(snap.docs.map((d, i) => ({ ...(d.data() as any), uid: d.id, posicao: i + 1 })));
    } catch (_) {}
  }, []);

  useEffect(() => { buscarTop3(); }, []);

  const onRefresh = () => {
    setRefreshing(true);
    buscarRanking();
    buscarTop3();
  };

  const abrirPerfil = (uid: string) => navigation.navigate('PerfilPublico', { uid, meuUid: uidAtual });

  // ── Avatar: foto real, ou o rosto do animal do nível ─────────────────
  const renderAvatar = (item: any, tamanho: number) => {
    const nivel = calcularNivel(item.xp_total || 0);
    return (
      <AvatarComCosmeticos
        foto={item.foto || item.foto_url || null}
        nome={item.nome_completo}
        tamanho={tamanho}
        cosmeticosEquipados={item.cosmeticos_equipados}
        semFoto={<AnimalImagem animal={nivel.animal} size={tamanho} rosto />}
      />
    );
  };

  // ── Pódio (1º, 2º e 3º) ───────────────────────────────────────────────
  const renderPodio = () => {
    const [p1, p2, p3] = [top3[0], top3[1], top3[2]];
    if (!p1) return null;
    // ordem visual: 2º | 1º | 3º
    const colunas = [
      { u: p2, pos: 2, avatar: 60, bloco: 64 },
      { u: p1, pos: 1, avatar: 76, bloco: 92 },
      { u: p3, pos: 3, avatar: 60, bloco: 46 },
    ];
    return (
      <View style={styles.podio}>
        <View style={styles.podioColunas}>
          {colunas.map(({ u, pos, avatar, bloco }) => {
            if (!u) return <View key={pos} style={styles.podioCol} />;
            const euSou = u.uid === uidAtual;
            return (
              <TouchableOpacity
                key={pos}
                style={styles.podioCol}
                activeOpacity={0.85}
                onPress={() => abrirPerfil(u.uid)}
                accessibilityRole="button"
                accessibilityLabel={`${pos}º lugar, ${primeiroNome(u)}, ${u.xp_total || 0} XP`}
              >
                {pos === 1 && <Ionicons name="trophy" size={22} color={COR_POSICAO[1]} style={{ marginBottom: 4 }} />}
                <View style={[styles.podioAro, { borderColor: COR_POSICAO[pos], width: avatar + 8, height: avatar + 8, borderRadius: (avatar + 8) / 2 }]}>
                  {renderAvatar(u, avatar)}
                </View>
                <Text style={[styles.podioNome, { fontSize: fs(13) }]} numberOfLines={1}>
                  {euSou ? 'Você' : primeiroNome(u)}
                </Text>
                <Text style={[styles.podioXp, { fontSize: fs(12) }]}>
                  {(u.xp_total || 0).toLocaleString('pt-BR')} XP
                </Text>
                <View style={[styles.podioBloco, { height: bloco }, pos === 1 && styles.podioBlocoPrimeiro]}>
                  <Text style={[styles.podioPos, { fontSize: fs(pos === 1 ? 30 : 24), color: pos === 1 ? COR_POSICAO[1] : CORES_SYMBIUS.heroiTexto }]}>
                    {pos}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  // ── Item da lista (a partir do 4º) ────────────────────────────────────
  const renderItem = ({ item }: any) => {
    const nivel = calcularNivel(item.xp_total || 0);
    const euSou = item.uid === uidAtual;
    return (
      <TouchableOpacity
        style={[styles.item, euSou && styles.itemEuSou]}
        onPress={() => abrirPerfil(item.uid)}
        activeOpacity={0.85}
      >
        <Text style={[styles.pos, { fontSize: fs(15) }, euSou && { color: CORES_SYMBIUS.verdeEscuro }]}>
          {item.posicao}
        </Text>
        {renderAvatar(item, 44)}
        <View style={{ flex: 1 }}>
          <Text style={[styles.nome, { fontSize: fs(14) }]} numberOfLines={1}>
            {euSou ? 'Você' : (item.nome_completo || item.nome || 'Anônimo')}
          </Text>
          <Text style={[styles.animal, { fontSize: fs(12) }]}>
            {nivel.nomeAnimal} · {nivel.nomeSubfase}
          </Text>
        </View>
        <Text style={[styles.xp, { fontSize: fs(14) }]}>
          {(item.xp_total || 0).toLocaleString('pt-BR')}
          <Text style={styles.xpSufixo}> XP</Text>
        </Text>
      </TouchableOpacity>
    );
  };

  // ── "Sua jornada" — níveis já passados, quanto falta, XP até o próximo ──
  const renderJornada = () => {
    if (meuXp === null) return null;
    const nivel = calcularNivel(meuXp);
    const progresso = calcularProgressoXp(meuXp);
    const meuIndice = ANIMAIS_ORDER.indexOf(nivel.animal);
    const passados = meuIndice; // quantos animais já foram superados
    const restantes = ANIMAIS_ORDER.length - 1 - meuIndice;

    return (
      <View style={styles.jornadaCard}>
        <View style={styles.jornadaTopo}>
          <View style={styles.jornadaMedalhao}>
            <AnimalImagem animal={nivel.animal} size={56} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.jornadaAnimal, { fontSize: fs(22) }]}>{nivel.nomeAnimal}</Text>
            <View style={styles.jornadaFase}>
              <Text style={[styles.jornadaFaseTxt, { fontSize: fs(12) }]}>
                {nivel.nomeSubfase} · Nível {NIVEL_NUMERO[nivel.animal]}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.jornadaBarraBg}>
          <View style={[styles.jornadaBarraFill, { width: `${Math.max(progresso.percentual, 3)}%` }]} />
        </View>
        <Text style={[styles.jornadaSub, { fontSize: fs(12) }]}>
          Faltam {progresso.faltam} XP para o próximo estágio
        </Text>
        <View style={styles.jornadaStats}>
          <View style={styles.jornadaStatItem}>
            <Text style={[styles.jornadaStatNum, { fontSize: fs(20) }]}>{passados}</Text>
            <Text style={[styles.jornadaStatLabel, { fontSize: fs(12) }]}>Níveis conquistados</Text>
          </View>
          <View style={styles.jornadaStatDiv} />
          <View style={styles.jornadaStatItem}>
            <Text style={[styles.jornadaStatNum, { fontSize: fs(20) }]}>{restantes}</Text>
            <Text style={[styles.jornadaStatLabel, { fontSize: fs(12) }]}>Níveis restantes</Text>
          </View>
        </View>
      </View>
    );
  };

  const cabecalho = (
    <View>
      {renderPodio()}
      {renderJornada()}

      <View style={styles.abasRow}>
        {ABAS.map(a => {
          const ativa = a.chave === abaAtiva;
          return (
            <TouchableOpacity
              key={a.chave}
              style={[styles.abaPill, ativa && styles.abaPillAtiva]}
              onPress={() => setAbaAtiva(a.chave)}
              accessibilityRole="tab"
              accessibilityState={{ selected: ativa }}
            >
              <Text style={[styles.abaTxt, ativa && styles.abaTxtAtiva, { fontSize: fs(13) }]}>{a.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const vazioOuCarregando = loading ? (
    <ActivityIndicator style={{ marginTop: 40 }} color={CORES_SYMBIUS.verdeEscuro} size="large" />
  ) : ranking.length === 0 ? (
    <View style={styles.vazio}>
      <Ionicons name="trophy-outline" size={40} color={CORES_SYMBIUS.borda2} />
      <Text style={[styles.vazioText, { fontSize: fs(13) }]}>
        Ninguém encontrado nessa aba ainda.
      </Text>
    </View>
  ) : null;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={CORES_SYMBIUS.barStyle} backgroundColor={CORES_SYMBIUS.fundo} />

      <View style={[styles.header, { paddingTop: (insets.top || 12) + 16 }]}>
        <TouchableOpacity onPress={() => voltar(navigation)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityLabel="Voltar">
          <Ionicons name="arrow-back" size={22} color={CORES_SYMBIUS.texto} />
        </TouchableOpacity>
        <Text style={[styles.headerTitulo, { fontSize: fs(17) }]}>Ranking</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={loading ? [] : (abaAtiva === 'geral' ? ranking.slice(3) : ranking)}
        keyExtractor={item => item.uid}
        renderItem={renderItem}
        ListHeaderComponent={cabecalho}
        ListEmptyComponent={vazioOuCarregando}
        contentContainerStyle={styles.lista}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[CORES_SYMBIUS.verdeEscuro]} tintColor={CORES_SYMBIUS.verdeEscuro} />
        }
      />
      <SymbiusTabBar ativa="nenhuma" navigation={navigation} uid={uidAtual} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CORES_SYMBIUS.fundo },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingBottom: 4,
  },
  headerTitulo: { color: CORES_SYMBIUS.texto, fontFamily: F.black },

  lista: { paddingHorizontal: 16, paddingBottom: 40 },

  // ── Sua jornada ──
  jornadaCard: {
    marginTop: 0, backgroundColor: CORES_SYMBIUS.fundoCard, borderRadius: 24, padding: 16,
    borderWidth: 1, borderColor: CORES_SYMBIUS.borda2,
  },
  jornadaTopo: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  jornadaMedalhao: {
    width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: CORES_SYMBIUS.folha, backgroundColor: CORES_SYMBIUS.fundoSuave,
  },
  jornadaAnimal: { color: CORES_SYMBIUS.texto, fontFamily: F.black },
  jornadaFase: {
    alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
    backgroundColor: CORES_SYMBIUS.heroiFundo,
  },
  jornadaFaseTxt: { color: CORES_SYMBIUS.heroiTextoSec, fontFamily: F.semibold },
  jornadaBarraBg: { height: 10, borderRadius: 5, backgroundColor: CORES_SYMBIUS.fundoSuave, overflow: 'hidden' },
  jornadaBarraFill: { height: 10, borderRadius: 5, backgroundColor: CORES_SYMBIUS.folha },
  jornadaSub: { color: CORES_SYMBIUS.textoSec, marginTop: 8, fontFamily: F.medium },
  jornadaStats: {
    flexDirection: 'row', alignItems: 'center', marginTop: 14, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: CORES_SYMBIUS.borda,
  },
  jornadaStatItem: { flex: 1, alignItems: 'center' },
  jornadaStatDiv: { width: 1, height: 32, backgroundColor: CORES_SYMBIUS.borda2 },
  jornadaStatNum: { color: CORES_SYMBIUS.verdeEscuro, fontFamily: F.black },
  jornadaStatLabel: { color: CORES_SYMBIUS.textoSec, marginTop: 2, fontFamily: F.medium },

  // ── Abas ──
  abasRow: { flexDirection: 'row', gap: 8, paddingTop: 18, paddingBottom: 14 },
  abaPill: {
    flex: 1, alignItems: 'center', minHeight: 40, paddingHorizontal: 8, borderRadius: 20, justifyContent: 'center',
    backgroundColor: CORES_SYMBIUS.fundoCard, borderWidth: 1, borderColor: CORES_SYMBIUS.borda2,
  },
  abaPillAtiva: { backgroundColor: CORES_SYMBIUS.heroiFundo, borderColor: CORES_SYMBIUS.heroiFundo },
  abaTxt: { color: CORES_SYMBIUS.textoSec, fontFamily: F.semibold },
  abaTxtAtiva: { color: CORES_SYMBIUS.heroiTexto, fontFamily: F.bold },

  // ── Pódio ──
  podio: {
    backgroundColor: CORES_SYMBIUS.heroiFundo, borderRadius: 28, paddingTop: 22, paddingHorizontal: 12,
    marginBottom: 16, overflow: 'hidden',
  },
  podioColunas: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  podioCol: { flex: 1, alignItems: 'center' },
  podioAro: { borderWidth: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: CORES_SYMBIUS.heroiElevado },
  podioNome: { color: CORES_SYMBIUS.heroiTexto, fontFamily: F.bold, marginTop: 8, maxWidth: '100%' },
  podioXp: { color: CORES_SYMBIUS.heroiTextoSec, fontFamily: F.semibold, marginTop: 1, marginBottom: 10 },
  podioBloco: {
    width: '100%', borderTopLeftRadius: 14, borderTopRightRadius: 14,
    backgroundColor: CORES_SYMBIUS.heroiElevado, alignItems: 'center', justifyContent: 'center',
  },
  podioBlocoPrimeiro: { backgroundColor: CORES_SYMBIUS.folha + '55' },
  podioPos: { fontFamily: F.black },

  // ── Lista ──
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64,
    backgroundColor: CORES_SYMBIUS.fundoCard, borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 8,
    borderWidth: 1, borderColor: CORES_SYMBIUS.borda,
  },
  itemEuSou: { borderColor: CORES_SYMBIUS.folha, borderWidth: 1.5, backgroundColor: CORES_SYMBIUS.fundoSuave },
  pos: { color: CORES_SYMBIUS.textoSec, fontFamily: F.black, width: 24, textAlign: 'center' },
  nome: { color: CORES_SYMBIUS.texto, fontFamily: F.bold, marginBottom: 2 },
  animal: { color: CORES_SYMBIUS.textoSec, fontFamily: F.medium },
  xp: { color: CORES_SYMBIUS.verdeEscuro, fontFamily: F.black },
  xpSufixo: { color: CORES_SYMBIUS.textoSec, fontFamily: F.semibold, fontSize: 12 },

  vazio: { alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 40, paddingTop: 40 },
  vazioText: { color: CORES_SYMBIUS.textoSec, textAlign: 'center', lineHeight: 20, fontFamily: F.medium },
});
