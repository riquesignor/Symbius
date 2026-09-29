import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity,
  SafeAreaView, StatusBar, Image, ActivityIndicator, RefreshControl,
} from 'react-native';
import { db } from '../config/firebaseConfig';
import {
  collection, query, orderBy, limit, getDocs, where, doc, getDoc,
} from 'firebase/firestore';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppSettings } from '../contexts/AppSettingsContext';
import { calcularNivel, calcularProgressoXp, ANIMAIS_ORDER } from '../utils/gamification';
import { CORES_SYMBIUS } from './Boasvindas';
import { NIVEL_AVATAR_BG, NIVEL_NUMERO } from '../constants/temaSymbius';
import { F } from '../constants/theme';

// ══════════════════════════════════════════════════════════════════════
// ⚠️  Ranking no visual novo ("Symbius"), ligada ao back-end atual (mesma
// coleção `usuarios`, mesmo cálculo de nível). O filtro por série foi
// trocado por Geral/Aprendiz/Mentor, usando o campo real `papel_comunidade`
// (adicionado no Cadastro) — não é dado mockado. A seção "sua jornada" usa
// o mesmo `calcularNivel`/`calcularProgressoXp` do resto do app.
// ══════════════════════════════════════════════════════════════════════

type Aba = 'geral' | 'aprender' | 'ensinar';
const ABAS: { chave: Aba; label: string }[] = [
  { chave: 'geral',    label: 'Geral' },
  { chave: 'aprender', label: 'Aprendiz' },
  { chave: 'ensinar',  label: 'Mentor' },
];

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

  const onRefresh = () => {
    setRefreshing(true);
    buscarRanking();
  };

  // ── Item da lista ───────────────────────────────────────────────────
  const renderItem = ({ item }: any) => {
    const nivel = calcularNivel(item.xp_total || 0);
    const euSou = item.uid === uidAtual;
    const medalha = item.posicao === 1 ? '🥇' : item.posicao === 2 ? '🥈' : item.posicao === 3 ? '🥉' : null;
    const avatarBg = NIVEL_AVATAR_BG[nivel.animal];

    return (
      <TouchableOpacity
        style={[styles.item, euSou && styles.itemEuSou]}
        onPress={() => navigation.navigate('PerfilPublico', { uid: item.uid })}
        activeOpacity={0.85}
      >
        <Text style={[styles.pos, { fontSize: fs(14) }, item.posicao <= 3 && { color: CORES_SYMBIUS.laranja }]}>
          {medalha || item.posicao}
        </Text>

        <View style={styles.avatarWrap}>
          {item.foto_url ? (
            <Image source={{ uri: item.foto_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: avatarBg }]}>
              <Text style={{ fontSize: 20 }}>{nivel.iconeAnimal}</Text>
            </View>
          )}
        </View>

        <View style={{ flex: 1 }}>
          <Text style={[styles.nome, { fontSize: fs(13.5) }]} numberOfLines={1}>
            {euSou ? 'Você' : (item.nome_completo || item.nome || 'Anônimo')}
          </Text>
          <Text style={[styles.animal, { fontSize: fs(11) }]}>
            {nivel.iconeAnimal} {nivel.nomeAnimal} · {nivel.nomeSubfase}
          </Text>
        </View>

        <Text style={[styles.xp, { fontSize: fs(13) }]}>
          {(item.xp_total || 0).toLocaleString('pt-BR')} XP
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
          <Text style={{ fontSize: 26 }}>{nivel.iconeAnimal}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.jornadaTitulo, { fontSize: fs(13.5) }]}>
              {nivel.nomeAnimal} · {nivel.nomeSubfase} · Nível {NIVEL_NUMERO[nivel.animal]}
            </Text>
            <Text style={[styles.jornadaSub, { fontSize: fs(11) }]}>
              Faltam {progresso.faltam} XP para o próximo estágio
            </Text>
          </View>
        </View>
        <View style={styles.jornadaBarraBg}>
          <View style={[styles.jornadaBarraFill, { width: `${progresso.percentual}%` }]} />
        </View>
        <View style={styles.jornadaStats}>
          <View style={styles.jornadaStatItem}>
            <Text style={[styles.jornadaStatNum, { fontSize: fs(15) }]}>{passados}</Text>
            <Text style={[styles.jornadaStatLabel, { fontSize: fs(10) }]}>Níveis conquistados</Text>
          </View>
          <View style={styles.jornadaStatDiv} />
          <View style={styles.jornadaStatItem}>
            <Text style={[styles.jornadaStatNum, { fontSize: fs(15) }]}>{restantes}</Text>
            <Text style={[styles.jornadaStatLabel, { fontSize: fs(10) }]}>Níveis restantes</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={CORES_SYMBIUS.barStyle} backgroundColor={CORES_SYMBIUS.fundo} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top || 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={24} color={CORES_SYMBIUS.texto} />
        </TouchableOpacity>
        <Text style={[styles.headerTitulo, { fontSize: fs(17) }]}>Ranking</Text>
        <View style={{ width: 24 }} />
      </View>

      {renderJornada()}

      {/* Abas */}
      <View style={styles.abasRow}>
        {ABAS.map(a => {
          const ativa = a.chave === abaAtiva;
          return (
            <TouchableOpacity
              key={a.chave}
              style={[styles.abaPill, ativa && styles.abaPillAtiva]}
              onPress={() => setAbaAtiva(a.chave)}
            >
              <Text style={[styles.abaTxt, ativa && styles.abaTxtAtiva, { fontSize: fs(12.5) }]}>
                {a.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={CORES_SYMBIUS.verdeEscuro} size="large" />
      ) : ranking.length === 0 ? (
        <View style={styles.vazio}>
          <FontAwesome5 name="trophy" size={40} color={CORES_SYMBIUS.borda} />
          <Text style={[styles.vazioText, { fontSize: fs(13) }]}>
            Ninguém encontrado nessa aba ainda.
          </Text>
        </View>
      ) : (
        <FlatList
          data={ranking}
          keyExtractor={item => item.uid}
          renderItem={renderItem}
          contentContainerStyle={styles.lista}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[CORES_SYMBIUS.verdeEscuro]} tintColor={CORES_SYMBIUS.verdeEscuro} />
          }
        />
      )}
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

  jornadaCard: {
    marginHorizontal: 18, marginTop: 12, backgroundColor: CORES_SYMBIUS.fundoCard,
    borderRadius: 16, padding: 14, borderWidth: 1, borderColor: CORES_SYMBIUS.borda,
  },
  jornadaTopo: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  jornadaTitulo: { color: CORES_SYMBIUS.texto, fontFamily: F.bold },
  jornadaSub: { color: CORES_SYMBIUS.textoSec, marginTop: 2 },
  jornadaBarraBg: { height: 6, borderRadius: 3, backgroundColor: CORES_SYMBIUS.borda, overflow: 'hidden' },
  jornadaBarraFill: { height: 6, borderRadius: 3, backgroundColor: CORES_SYMBIUS.verdeEscuro },
  jornadaStats: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  jornadaStatItem: { flex: 1, alignItems: 'center' },
  jornadaStatDiv: { width: 1, height: 28, backgroundColor: CORES_SYMBIUS.borda },
  jornadaStatNum: { color: CORES_SYMBIUS.texto, fontFamily: F.black },
  jornadaStatLabel: { color: CORES_SYMBIUS.textoSec, marginTop: 2 },

  abasRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 10,
  },
  abaPill: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: CORES_SYMBIUS.fundoSuave,
  },
  abaPillAtiva: { backgroundColor: CORES_SYMBIUS.verdeEscuro },
  abaTxt: { color: CORES_SYMBIUS.textoSec, fontFamily: F.semibold },
  abaTxtAtiva: { color: CORES_SYMBIUS.creme, fontFamily: F.bold },

  lista: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40 },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: CORES_SYMBIUS.fundoCard, borderRadius: 16, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: CORES_SYMBIUS.borda,
  },
  itemEuSou: { borderColor: CORES_SYMBIUS.verdeEscuro, borderWidth: 1.5 },
  pos: { color: CORES_SYMBIUS.textoSec, fontFamily: F.black, width: 24, textAlign: 'center' },
  avatarWrap: {},
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: { justifyContent: 'center', alignItems: 'center' },
  nome: { color: CORES_SYMBIUS.texto, fontFamily: F.bold, marginBottom: 2 },
  animal: { color: CORES_SYMBIUS.textoSec, fontFamily: F.medium },
  xp: { color: CORES_SYMBIUS.texto, fontFamily: F.bold },

  vazio: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 40 },
  vazioText: { color: CORES_SYMBIUS.textoSec, textAlign: 'center', lineHeight: 20, fontFamily: F.medium },
});
