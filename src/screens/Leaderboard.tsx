import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity,
  SafeAreaView, StatusBar, Image, ActivityIndicator, RefreshControl,
} from 'react-native';
import { db } from '../config/firebaseConfig';
import {
  collection, query, orderBy, limit, getDocs, where,
} from 'firebase/firestore';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppSettings } from '../contexts/AppSettingsContext';
import { calcularNivel } from '../utils/gamification';
import { F, CORES } from '../constants/theme';

// ── Séries disponíveis ──────────────────────────────────────────────────
const SERIES = ['Todas', '1º', '2º', '3º'];

// ── Cores do pódio ──────────────────────────────────────────────────────
const PODIO_COR   = ['#FFD700', '#C0C0C0', '#CD7F32']; 
const PODIO_H     = [88, 72, 60];                       
const PODIO_LABEL = ['🥇', '🥈', '🥉'];


export default function Leaderboard({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { cores: C, fonteScale, modoEscuro } = useAppSettings();
  const fs = (s: number) => s * fonteScale;

  const uidAtual: string = route?.params?.uid || '';

  const [ranking, setRanking]       = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [serieAtiva, setSerieAtiva] = useState('Todas');

  // ── Busca ────────────────────────────────────────────────────────────
  const buscarRanking = useCallback(async () => {
    try {
      let q;
      if (serieAtiva === 'Todas') {
        q = query(
          collection(db, 'usuarios'),
          orderBy('xp_total', 'desc'),
          limit(20),
        );
      } else {
        // Filtra por primeiro dígito da turma (ex: "2A" → "2º")
        q = query(
          collection(db, 'usuarios'),
          where('turma_serie', '==', serieAtiva),
          orderBy('xp_total', 'desc'),
          limit(20),
        );
      }
      const snap = await getDocs(q);
      setRanking(snap.docs.map((d, i) => ({ ...d.data(), uid: d.id, posicao: i + 1 })));
    } catch (e) {
      // Fallback sem filtro de série se o índice ainda não existe
      try {
        const snap = await getDocs(
          query(collection(db, 'usuarios'), orderBy('xp_total', 'desc'), limit(20)),
        );
        const todos = snap.docs.map((d, i) => ({ ...d.data(), uid: d.id, posicao: i + 1 }));
        if (serieAtiva !== 'Todas') {
          const filtrado = todos.filter(u => {
            const t = String(u.turma || '');
            return t.startsWith(serieAtiva.replace('º', ''));
          });
          setRanking(filtrado.map((u, i) => ({ ...u, posicao: i + 1 })));
        } else {
          setRanking(todos);
        }
      } catch (_) {}
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [serieAtiva]);

  useEffect(() => {
    setLoading(true);
    buscarRanking();
  }, [serieAtiva]);

  const onRefresh = () => {
    setRefreshing(true);
    buscarRanking();
  };

  // ── Pódio (top 3) ────────────────────────────────────────────────────
  const top3   = ranking.slice(0, 3);
  const restante = ranking.slice(3);

  const renderPodio = () => {
    if (top3.length < 1) return null;
    // Ordem visual: 2º, 1º, 3º
    const ordem = [top3[1], top3[0], top3[2]].filter(Boolean);
    const alts  = [PODIO_H[1], PODIO_H[0], PODIO_H[2]];
    const cores = [PODIO_COR[1], PODIO_COR[0], PODIO_COR[2]];
    const labels = [PODIO_LABEL[1], PODIO_LABEL[0], PODIO_LABEL[2]];

    return (
      <View style={[styles.podioWrap, { backgroundColor: modoEscuro ? C.branco + '08' : C.cinzaClaro + '80' }]}>
        {ordem.map((u, vi) => {
          const nivel = calcularNivel(u.xp_total || 0);
          const euSou = u.uid === uidAtual;
          return (
            <TouchableOpacity
              key={u.uid}
              style={styles.podioPessoa}
              onPress={() => navigation.navigate('PerfilPublico', { uid: u.uid })}
              activeOpacity={0.8}
            >
              {/* Avatar */}
              <View style={[
                styles.podioAvatarWrap,
                { borderColor: cores[vi] + 'AA', borderWidth: 2.5 },
                euSou && { borderColor: CORES.rosa, borderWidth: 3 },
              ]}>
                {u.foto_url ? (
                  <Image source={{ uri: u.foto_url }} style={styles.podioAvatar} />
                ) : (
                  <View style={[styles.podioAvatar, { backgroundColor: cores[vi] + '30', justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={{ fontSize: 22 }}>{nivel.iconeAnimal}</Text>
                  </View>
                )}
                <Text style={styles.podioMedal}>{labels[vi]}</Text>
              </View>

              {/* Nome */}
              <Text style={[styles.podioNome, { color: C.azulEscuro, fontSize: fs(11) }]} numberOfLines={1}>
                {euSou ? 'Você' : (u.nome?.split(' ')[0] || 'Anon')}
              </Text>

              {/* XP */}
              <Text style={[styles.podioXp, { color: cores[vi], fontSize: fs(10) }]}>
                {(u.xp_total || 0).toLocaleString('pt-BR')} XP
              </Text>

              {/* Coluna do pódio */}
              <View style={[
                styles.podioColunaBase,
                { height: alts[vi], backgroundColor: cores[vi] + (modoEscuro ? '30' : '20'), borderColor: cores[vi] + '50', borderTopWidth: 2 },
              ]}>
                <Text style={[styles.podioPos, { color: cores[vi] }]}>
                  {vi === 1 ? '1' : vi === 0 ? '2' : '3'}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  // ── Item da lista (posições 4–20) ─────────────────────────────────────
  const renderItem = ({ item }: any) => {
    const nivel = calcularNivel(item.xp_total || 0);
    const euSou = item.uid === uidAtual;
    return (
      <TouchableOpacity
        style={[
          styles.rankItem,
          { backgroundColor: euSou ? CORES.azulEscuro : C.branco,
            borderColor: euSou ? CORES.azulEscuro : C.cinzaClaro },
        ]}
        onPress={() => navigation.navigate('PerfilPublico', { uid: item.uid })}
        activeOpacity={0.8}
      >
        {/* Posição */}
        <Text style={[styles.rankPos, { color: euSou ? '#fff' : C.textoSec, fontSize: fs(13) }]}>
          {item.posicao}
        </Text>

        {/* Avatar */}
        <View style={styles.rankAvatarWrap}>
          {item.foto_url ? (
            <Image source={{ uri: item.foto_url }} style={styles.rankAvatar} />
          ) : (
            <View style={[styles.rankAvatar, { backgroundColor: C.cinzaClaro, justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={{ fontSize: 18 }}>{nivel.iconeAnimal}</Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={{ flex: 1 }}>
          <Text style={[styles.rankNome, { color: euSou ? '#fff' : C.azulEscuro, fontSize: fs(13) }]} numberOfLines={1}>
            {euSou ? 'Você' : (item.nome || 'Anônimo')}
          </Text>
          <Text style={[styles.rankAnimal, { color: euSou ? '#ffffff99' : C.textoSec, fontSize: fs(10) }]}>
            {nivel.iconeAnimal} {nivel.nomeSubfase} {nivel.nomeAnimal}
          </Text>
        </View>

        {/* XP */}
        <Text style={[styles.rankXp, { color: euSou ? CORES.amarelo : CORES.rosa, fontSize: fs(12) }]}>
          {(item.xp_total || 0).toLocaleString('pt-BR')} XP
        </Text>
      </TouchableOpacity>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: C.fundo }]}>
      <StatusBar
        barStyle={modoEscuro ? 'light-content' : 'dark-content'}
        backgroundColor={C.fundo}
      />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: C.cinzaClaro, paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={22} color={C.azulEscuro} />
        </TouchableOpacity>
        <Text style={[styles.headerTitulo, { color: C.azulEscuro, fontSize: fs(16) }]}>
          🏆 Ranking
        </Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Filtro de série */}
      <View style={[styles.filtroRow, { borderBottomColor: C.cinzaClaro }]}>
        {SERIES.map(s => {
          const ativa = s === serieAtiva;
          return (
            <TouchableOpacity
              key={s}
              style={[
                styles.filtroPill,
                { backgroundColor: ativa ? CORES.azulEscuro : C.branco,
                  borderColor: ativa ? CORES.azulEscuro : C.cinzaClaro },
              ]}
              onPress={() => setSerieAtiva(s)}
            >
              <Text style={[styles.filtroText, { color: ativa ? '#fff' : C.textoSec, fontSize: fs(11) }]}>
                {s}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={CORES.rosa} size="large" />
      ) : ranking.length === 0 ? (
        <View style={styles.vazio}>
          <FontAwesome5 name="trophy" size={40} color={C.cinzaClaro} />
          <Text style={[styles.vazioText, { color: C.textoSec, fontSize: fs(13) }]}>
            Nenhum usuário encontrado para esta série.
          </Text>
        </View>
      ) : (
        <FlatList
          data={restante}
          keyExtractor={item => item.uid}
          ListHeaderComponent={renderPodio}
          renderItem={renderItem}
          contentContainerStyle={styles.lista}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[CORES.rosa]} />
          }
        />
      )}
    </SafeAreaView>
  );
}

// ════════════════════════════════════════════════════════════════════════
//  STYLES
// ════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: { flex: 1 },

  // HEADER
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingBottom: 14, borderBottomWidth: 1,
  },
  headerTitulo: { fontFamily: F.black, letterSpacing: -0.5 },

  // FILTRO
  filtroRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 18, paddingVertical: 12,
    borderBottomWidth: 1,
  },
  filtroPill: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5,
  },
  filtroText: { fontFamily: F.bold },

  // PÓDIO
  podioWrap: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center',
    gap: 8, paddingTop: 28, paddingHorizontal: 16, borderRadius: 20,
    marginHorizontal: 16, marginTop: 16, overflow: 'hidden',
  },
  podioPessoa:    { alignItems: 'center', flex: 1 },
  podioAvatarWrap:{ borderRadius: 36, marginBottom: 6, position: 'relative' },
  podioAvatar:    { width: 60, height: 60, borderRadius: 30 },
  podioMedal:     { position: 'absolute', bottom: -4, right: -4, fontSize: 18 },
  podioNome:      { fontFamily: F.bold, textAlign: 'center', marginTop: 6, marginBottom: 2 },
  podioXp:        { fontFamily: F.black, textAlign: 'center', marginBottom: 6 },
  podioColunaBase:{
    width: '100%', borderTopLeftRadius: 6, borderTopRightRadius: 6,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
    borderBottomWidth: 0,
  },
  podioPos: { fontFamily: F.black, fontSize: 20 },

  // LISTA
  lista:    { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 40 },
  rankItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, padding: 12, marginBottom: 8,
    borderWidth: 1, elevation: 1,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  rankPos:       { fontFamily: F.black, width: 26, textAlign: 'center' },
  rankAvatarWrap:{ },
  rankAvatar:    { width: 42, height: 42, borderRadius: 21 },
  rankNome:      { fontFamily: F.bold, marginBottom: 2 },
  rankAnimal:    { fontFamily: F.medium },
  rankXp:        { fontFamily: F.black },

  // VAZIO
  vazio:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 40 },
  vazioText:{ fontFamily: F.medium, textAlign: 'center', lineHeight: 20 },
});
