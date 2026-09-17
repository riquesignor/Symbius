import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  SafeAreaView, StatusBar, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { db } from '../config/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { calcularNivel, calcularProgressoXp } from '../utils/gamification';
import { awardDailyCheckIn, CheckInResult } from '../services/gamificationService';
import { CORES_SABE } from './Boasvindas';

// ══════════════════════════════════════════════════════════════════════
// ⚠️  TELA DE TESTE — Home no visual novo ("Sabé"), ligada ao back-end
// atual (mesma coleção `usuarios`, mesmo serviço de gamificação). O Index
// original com mural/agenda/notificações foi preservado em Index.legado.tsx.
// ══════════════════════════════════════════════════════════════════════

const ACOES = [
  { chave: 'match',    label: 'Encontrar match', icone: 'people-outline'    as const },
  { chave: 'foto',     label: 'Tirar foto',      icone: 'camera-outline'    as const },
  { chave: 'postar',   label: 'Postar',          icone: 'create-outline'    as const },
  { chave: 'ranking',  label: 'Ver ranking',     icone: 'trophy-outline'    as const },
];

export default function Index({ navigation, route }: any) {
  const [uid, setUid] = useState<string | null>(route?.params?.uid || null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [checkIn, setCheckIn] = useState<CheckInResult | null>(null);
  const [processandoCheckIn, setProcessandoCheckIn] = useState(false);

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

  const primeiroNome = userData?.nome_completo?.split(' ')[0] || 'colega';
  const xpTotal = userData?.xp_total || 0;
  const nivel = calcularNivel(xpTotal);
  const progresso = calcularProgressoXp(xpTotal);

  const irPara = (destino: string, params: any = {}) => {
    if (!uid) return;
    navigation.navigate(destino, { uid, ...params });
  };

  const handleAcao = async (chave: string) => {
    if (chave === 'match')   return irPara('Match');
    if (chave === 'ranking') return irPara('Leaderboard');
    if (chave === 'postar')  return navigation.navigate('EditorPost', {});

    if (chave === 'foto') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Precisamos de acesso à câmera.');
        return;
      }
      const resultado = await ImagePicker.launchCameraAsync({ quality: 0.3, base64: true });
      if (!resultado.canceled && resultado.assets[0].base64) {
        navigation.navigate('EditorPost', {
          current: { capa: `data:image/jpeg;base64,${resultado.assets[0].base64}` },
        });
      }
    }
  };

  const fazerCheckIn = async () => {
    if (!uid || processandoCheckIn) return;
    setProcessandoCheckIn(true);
    const resultado = await awardDailyCheckIn(uid);
    setCheckIn(resultado);
    setProcessandoCheckIn(false);
    if (resultado.ganhou) await carregar(); // atualiza XP/nível na tela
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.centro]}>
        <ActivityIndicator size="large" color={CORES_SABE.verdeClaro} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <Text style={styles.saudacao}>Olá, {primeiroNome}!</Text>
            <Text style={styles.subSaudacao}>Hoje é um ótimo dia pra aprender.</Text>
          </View>
          <View style={styles.headerIcones}>
            <TouchableOpacity onPress={() => irPara('Configuracoes')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="settings-outline" size={22} color={CORES_SABE.textoClaro} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => irPara('Perfil')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ marginLeft: 16 }}>
              <Ionicons name="person-circle-outline" size={26} color={CORES_SABE.textoClaro} />
            </TouchableOpacity>
          </View>
        </View>

        {/* BUSCA (visual — ainda não filtra dados; pra testar a navegação primeiro) */}
        <View style={styles.buscaWrap}>
          <Ionicons name="search-outline" size={18} color={CORES_SABE.textoSec} />
          <TextInput
            style={styles.buscaInput}
            placeholder="Buscar colegas, matérias..."
            placeholderTextColor={CORES_SABE.textoSec}
            value={busca}
            onChangeText={setBusca}
          />
        </View>

        {/* AÇÕES RÁPIDAS */}
        <View style={styles.acoesGrid}>
          {ACOES.map((a) => (
            <TouchableOpacity key={a.chave} style={styles.acaoCard} activeOpacity={0.85} onPress={() => handleAcao(a.chave)}>
              <View style={styles.acaoIconeWrap}>
                <Ionicons name={a.icone} size={22} color={CORES_SABE.verdeClaro} />
              </View>
              <Text style={styles.acaoLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* SEU PROGRESSO */}
        <View style={styles.cardProgresso}>
          <View style={styles.progressoTopo}>
            <Text style={styles.progressoIcone}>{nivel.iconeAnimal}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.progressoTitulo}>{nivel.nomeAnimal} · {nivel.nomeSubfase}</Text>
              <Text style={styles.progressoSub}>{xpTotal} XP</Text>
            </View>
            <Text style={styles.progressoMoedas}>🌱 {userData?.moedas_saldo || 0}</Text>
          </View>
          <View style={styles.barraFundo}>
            <View style={[styles.barraPreenchida, { width: `${progresso.percentual}%` }]} />
          </View>
          <Text style={styles.progressoFaltam}>Faltam {progresso.faltam} XP pro próximo estágio</Text>
        </View>

        {/* DESAFIO DO DIA (check-in real, via gamificationService) */}
        <TouchableOpacity
          style={styles.cardDesafio}
          activeOpacity={0.9}
          onPress={fazerCheckIn}
          disabled={processandoCheckIn}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.desafioLabel}>DESAFIO DO DIA</Text>
            <Text style={styles.desafioTitulo}>
              {checkIn?.ganhou
                ? `Feito! +${checkIn.xp} XP, +${checkIn.moedas} Sementes 🌱`
                : checkIn && !checkIn.ganhou
                ? 'Você já fez o check-in de hoje ✓'
                : 'Faça seu check-in diário'}
            </Text>
          </View>
          {processandoCheckIn
            ? <ActivityIndicator color={CORES_SABE.fundo} />
            : <MaterialIcons name="chevron-right" size={26} color={CORES_SABE.fundo} />
          }
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CORES_SABE.fundo },
  centro: { justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  headerIcones: { flexDirection: 'row', alignItems: 'center', paddingTop: 4 },
  saudacao: { fontSize: 21, fontWeight: '800', color: CORES_SABE.textoClaro },
  subSaudacao: { fontSize: 12.5, color: CORES_SABE.textoSec, marginTop: 2 },

  buscaWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: CORES_SABE.fundoCard, borderRadius: 14, paddingHorizontal: 14,
    paddingVertical: 11, marginBottom: 18, borderWidth: 1, borderColor: CORES_SABE.borda,
  },
  buscaInput: { flex: 1, color: CORES_SABE.textoClaro, fontSize: 14 },

  acoesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 },
  acaoCard: {
    width: '47%', backgroundColor: CORES_SABE.fundoCard, borderRadius: 16,
    padding: 14, borderWidth: 1, borderColor: CORES_SABE.borda,
  },
  acaoIconeWrap: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: CORES_SABE.fundo,
    justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  acaoLabel: { color: CORES_SABE.textoClaro, fontSize: 13, fontWeight: '700' },

  cardProgresso: {
    backgroundColor: CORES_SABE.fundoCard, borderRadius: 18, padding: 18,
    marginBottom: 14, borderWidth: 1, borderColor: CORES_SABE.borda,
  },
  progressoTopo: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  progressoIcone: { fontSize: 30 },
  progressoTitulo: { color: CORES_SABE.textoClaro, fontSize: 15, fontWeight: '800' },
  progressoSub: { color: CORES_SABE.textoSec, fontSize: 12, marginTop: 1 },
  progressoMoedas: { color: CORES_SABE.verdeClaro, fontSize: 13, fontWeight: '700' },
  barraFundo: { height: 8, backgroundColor: CORES_SABE.fundo, borderRadius: 4, overflow: 'hidden' },
  barraPreenchida: { height: 8, backgroundColor: CORES_SABE.verdeClaro, borderRadius: 4 },
  progressoFaltam: { color: CORES_SABE.textoSec, fontSize: 11, marginTop: 8 },

  cardDesafio: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: CORES_SABE.verdeClaro, borderRadius: 18, padding: 18,
  },
  desafioLabel: { color: CORES_SABE.fundo, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.6, opacity: 0.75 },
  desafioTitulo: { color: CORES_SABE.fundo, fontSize: 14.5, fontWeight: '800', marginTop: 3 },
});
