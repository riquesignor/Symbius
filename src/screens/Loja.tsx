import { voltar, HIT_VOLTAR } from '../navegacao';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import SymbiusTabBar from '../components/SymbiusTabBar';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView, Image,
  SafeAreaView, StatusBar, ActivityIndicator, Alert, PanResponder, Animated, Dimensions,
} from 'react-native';
import { db } from '../config/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppSettings } from '../contexts/AppSettingsContext';
import { atingiuAnimal } from '../utils/gamification';
import { COSMETICOS, Cosmetico, equipadosPorAncora } from '../constants/cosmeticos';
import AvatarComCosmeticos from '../components/AvatarComCosmeticos';
import { comprarCosmetico, equiparCosmetico } from '../services/gamificationService';
import { CORES_SYMBIUS } from './Boasvindas';
import { F } from '../constants/theme';

// ══════════════════════════════════════════════════════════════════════
// ⚠️  TELA DE TESTE — Loja de Cosméticos no visual novo ("Symbius"), ligada
// ao back-end atual (COSMETICOS, comprarCosmetico/equiparCosmetico — nada
// de item mockado). As abas do mockup (Básicos/Rewards) mapeiam pro campo
// real `prestigio` de cada cosmético.
// ══════════════════════════════════════════════════════════════════════

type Aba = 'basicos' | 'rewards';

export default function Loja({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { fonteScale } = useAppSettings();
  const fs = (s: number) => s * fonteScale;

  const uid: string = route?.params?.uid || '';

  const [abaAtiva, setAbaAtiva] = useState<Aba>('basicos');
  const abaAtivaRef = useRef<Aba>('basicos');
  useEffect(() => { abaAtivaRef.current = abaAtiva; }, [abaAtiva]);
  const ABAS_LOJA: Aba[] = ['basicos', 'rewards'];
  const abaSwipeX = useRef(new Animated.Value(0)).current;
  const abaSwipeResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 20 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_, g) => {
        const idx = ABAS_LOJA.indexOf(abaAtivaRef.current);
        let dx = g.dx;
        if (dx < 0 && idx >= ABAS_LOJA.length - 1) dx *= 0.25;
        if (dx > 0 && idx <= 0) dx *= 0.25;
        abaSwipeX.setValue(dx);
      },
      onPanResponderRelease: (_, g) => {
        const idx = ABAS_LOJA.indexOf(abaAtivaRef.current);
        const vaiProxima  = g.dx < -40 && idx < ABAS_LOJA.length - 1;
        const vaiAnterior = g.dx > 40  && idx > 0;
        if (vaiProxima || vaiAnterior) {
          const dir = vaiProxima ? -1 : 1;
          const { width } = Dimensions.get('window');
          Animated.timing(abaSwipeX, { toValue: dir * width, duration: 180, useNativeDriver: true }).start(() => {
            setAbaAtiva(ABAS_LOJA[idx + (vaiProxima ? 1 : -1)]);
            abaSwipeX.setValue(-dir * width);
            Animated.timing(abaSwipeX, { toValue: 0, duration: 220, useNativeDriver: true }).start();
          });
        } else {
          Animated.spring(abaSwipeX, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
        }
      },
    })
  ).current;
  const [usuario,   setUsuario]   = useState<any>(null);
  const [loading,   setLoading]   = useState(true);
  const [processando, setProcessando] = useState<string | null>(null);
  // Item tocado: aparece no provador por cima do que está equipado.
  const [provando, setProvando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!uid) { setLoading(false); return; }
    try {
      const snap = await getDoc(doc(db, 'usuarios', uid));
      if (snap.exists()) setUsuario(snap.data());
    } catch (e) { console.log('Erro ao carregar loja:', e); }
    setLoading(false);
  }, [uid]);

  useEffect(() => { carregar(); }, [carregar]);

  const moedas: number = usuario?.moedas_saldo || 0;
  const xpTotal: number = usuario?.xp_total || 0;
  const itensAdquiridos: string[] = usuario?.itens_adquiridos || [];
  const equipados = equipadosPorAncora(usuario?.cosmeticos_equipados);
  const itemProvando = COSMETICOS.find(c => c.id === provando) || null;

  const handleComprar = async (item: Cosmetico) => {
    if (!uid || processando) return;
    if (moedas < item.preco) {
      Alert.alert('Sementes insuficientes', `Faltam ${item.preco - moedas} sementes para comprar ${item.nome}.`);
      return;
    }
    setProcessando(item.id);
    const resultado = await comprarCosmetico(uid, item.id);
    if (resultado === 'comprado') {
      await equiparCosmetico(uid, item.ancora, item.id, usuario?.cosmeticos_equipados);
      setProvando(null);
      await carregar();
    } else if (resultado === 'ja_possui') await carregar();
    else if (resultado === 'sem_saldo') Alert.alert('Sementes insuficientes', `Você precisa de ${item.preco} sementes para comprar ${item.nome}.`);
    else if (resultado === 'bloqueado') Alert.alert('Item bloqueado', 'Suba de nível para liberar este item.');
    else Alert.alert('Compra não concluída', 'Verifique sua conexão e tente de novo. Nenhuma semente foi descontada.');
    setProcessando(null);
  };

  const handleEquipar = async (item: Cosmetico) => {
    if (!uid || processando) return;
    const jaEquipado = equipados[item.ancora] === item.id;
    setProcessando(item.id);
    const ok = await equiparCosmetico(uid, item.ancora, jaEquipado ? null : item.id, usuario?.cosmeticos_equipados);
    if (ok) { setProvando(null); await carregar(); }
    else Alert.alert('Não foi possível equipar', 'Verifique sua conexão e tente de novo.');
    setProcessando(null);
  };

  const itensDaAba = COSMETICOS.filter(c => (abaAtiva === 'rewards') === !!c.prestigio);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={CORES_SYMBIUS.barStyle} backgroundColor={CORES_SYMBIUS.fundo} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: (insets.top || 12) + 16 }]}>
        <TouchableOpacity hitSlop={HIT_VOLTAR}
          onPress={() => voltar(navigation)}
          style={styles.btnVoltar}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Ionicons name="arrow-back" size={22} color={CORES_SYMBIUS.texto} />
        </TouchableOpacity>
        <Text style={[styles.headerTitulo, { fontSize: fs(17) }]}>Loja de Cosméticos</Text>
        <View style={styles.saldoPill} accessible accessibilityLabel={`Saldo: ${moedas} sementes`}>
          <Ionicons name="leaf" size={15} color={CORES_SYMBIUS.laranja} />
          <Text style={[styles.saldoTxt, { fontSize: fs(13) }]}>{moedas}</Text>
        </View>
      </View>

      {/* Provador: o avatar real com o que está equipado + o item tocado */}
      <View style={styles.provador}>
        <View style={styles.provadorPalco}>
          <AvatarComCosmeticos
            foto={usuario?.foto}
            nome={usuario?.nome_completo}
            tamanho={92}
            equipados={equipados}
            previaId={provando}
          />
        </View>
        <View style={{ flex: 1 }}>
          {itemProvando ? (
            <>
              <Text style={[styles.provadorTitulo, { fontSize: fs(16) }]} numberOfLines={1}>{itemProvando.nome}</Text>
              <Text style={[styles.provadorSub, { fontSize: fs(12.5) }]}>
                {itensAdquiridos.includes(itemProvando.id) ? 'Você já tem este item.' : `Custa ${itemProvando.preco} sementes.`}
              </Text>
              <TouchableOpacity onPress={() => setProvando(null)} style={styles.provadorLimpar} accessibilityRole="button">
                <Text style={[styles.provadorLimparTxt, { fontSize: fs(12.5) }]}>Parar de provar</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={[styles.provadorTitulo, { fontSize: fs(16) }]}>Seu visual</Text>
              <Text style={[styles.provadorSub, { fontSize: fs(12.5) }]}>Toque num item para ver como fica antes de comprar.</Text>
            </>
          )}
        </View>
      </View>

      {/* Abas */}
      <View style={styles.abasRow}>
        {([{ chave: 'basicos', label: 'Básicos' }, { chave: 'rewards', label: 'Rewards' }] as { chave: Aba; label: string }[]).map(a => {
          const ativa = a.chave === abaAtiva;
          return (
            <TouchableOpacity
              key={a.chave}
              style={[styles.abaPill, ativa && styles.abaPillAtiva]}
              onPress={() => setAbaAtiva(a.chave)}
              accessibilityRole="tab"
              accessibilityState={{ selected: ativa }}
            >
              <Text style={[styles.abaTxt, ativa && styles.abaTxtAtiva, { fontSize: fs(13) }]}>
                {a.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Animated.View style={{ flex: 1, transform: [{ translateX: abaSwipeX }] }} {...abaSwipeResponder.panHandlers}>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={CORES_SYMBIUS.verdeEscuro} size="large" />
      ) : (
        <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
          {itensDaAba.map(item => {
            const possui       = itensAdquiridos.includes(item.id);
            const equipado     = equipados[item.ancora] === item.id;
            const bloqueado    = !!item.prestigio && item.animalMinimo && !atingiuAnimal(xpTotal, item.animalMinimo);
            const carregandoEsse = processando === item.id;

            return (
              <View key={item.id} style={[styles.card, equipado && styles.cardEquipado, provando === item.id && styles.cardProvando]}>
                <TouchableOpacity
                  style={styles.arteWrap}
                  onPress={() => setProvando(provando === item.id ? null : item.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Provar ${item.nome}`}
                  accessibilityState={{ selected: provando === item.id }}
                >
                  <Image source={item.imagem} style={styles.arte} resizeMode="contain" />
                </TouchableOpacity>

                <Text style={[styles.itemNome, { fontSize: fs(13.5) }]} numberOfLines={1}>
                  {item.nome}
                </Text>

                {bloqueado ? (
                  <Text style={[styles.itemBloqueado, { fontSize: fs(10.5) }]} numberOfLines={2}>
                    Requer {item.animalMinimo ? item.animalMinimo.charAt(0).toUpperCase() + item.animalMinimo.slice(1) : ''}
                  </Text>
                ) : (
                  <Text style={[styles.itemPreco, { fontSize: fs(12) }]}>
                    {item.preco} Sementes
                  </Text>
                )}

                {carregandoEsse ? (
                  <ActivityIndicator color={CORES_SYMBIUS.verdeEscuro} size="small" style={{ marginTop: 8 }} />
                ) : bloqueado ? (
                  <View style={[styles.btnAcao, styles.btnBloqueado]} accessible accessibilityLabel="Bloqueado">
                    <Ionicons name="lock-closed" size={14} color={CORES_SYMBIUS.textoSec} />
                  </View>
                ) : possui ? (
                  <TouchableOpacity
                    style={[styles.btnAcao, equipado ? styles.btnEquipado : styles.btnEquipar]}
                    onPress={() => handleEquipar(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`${equipado ? 'Remover' : 'Equipar'} ${item.nome}`}
                  >
                    <Text style={[styles.btnAcaoTxt, equipado ? styles.btnAcaoTxtEquipado : styles.btnAcaoTxtEquipar, { fontSize: fs(12) }]}>
                      {equipado ? 'Remover' : 'Equipar'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.btnAcao, moedas >= item.preco ? styles.btnComprar : styles.btnDesabilitado]}
                    onPress={() => handleComprar(item)}
                    disabled={moedas < item.preco}
                    accessibilityRole="button"
                    accessibilityLabel={`Comprar ${item.nome} por ${item.preco} sementes`}
                    accessibilityState={{ disabled: moedas < item.preco }}
                  >
                    <Text style={[styles.btnAcaoTxt, moedas >= item.preco ? styles.btnAcaoTxtComprar : styles.btnAcaoTxtDesabilitado, { fontSize: fs(12) }]}>
                      Comprar
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
      </Animated.View>
      <SymbiusTabBar ativa="nenhuma" navigation={navigation} uid={uid} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CORES_SYMBIUS.fundo },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingBottom: 14, gap: 10,
  },
  headerTitulo: { flex: 1, color: CORES_SYMBIUS.texto, fontFamily: F.black },
  btnVoltar: { width: 44, height: 44, justifyContent: 'center' },

  provador: {
    flexDirection: 'row', alignItems: 'center', gap: 16, marginHorizontal: 18, marginBottom: 14,
    paddingHorizontal: 16, borderRadius: 22, backgroundColor: CORES_SYMBIUS.verdeEscuro,
  },
  // Folga acima e abaixo: chapéu e colar saem dos limites da foto.
  provadorPalco: { paddingTop: 40, paddingBottom: 34, paddingHorizontal: 10 },
  provadorTitulo: { color: CORES_SYMBIUS.creme, fontFamily: F.black },
  provadorSub: { color: 'rgba(244,241,232,0.75)', fontFamily: F.medium, marginTop: 2, lineHeight: 18 },
  provadorLimpar: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  provadorLimparTxt: { color: CORES_SYMBIUS.laranja, fontFamily: F.bold },
  saldoPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: CORES_SYMBIUS.fundoCard, borderWidth: 1, borderColor: CORES_SYMBIUS.borda,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14,
  },
  saldoTxt: { color: CORES_SYMBIUS.verdeEscuro, fontFamily: F.black },

  abasRow: { flexDirection: 'row', gap: 4, marginHorizontal: 18, marginBottom: 14, backgroundColor: CORES_SYMBIUS.fundoSuave, padding: 4, borderRadius: 14 },
  abaPill: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10 },
  abaPillAtiva: { backgroundColor: CORES_SYMBIUS.verdeEscuro },
  abaTxt: { color: CORES_SYMBIUS.textoSec, fontFamily: F.bold },
  abaTxtAtiva: { color: CORES_SYMBIUS.fundo },

  grid: {
    paddingHorizontal: 16, paddingTop: 4, paddingBottom: 30,
    flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between',
  },
  card: {
    width: '47%', backgroundColor: CORES_SYMBIUS.fundoCard, borderRadius: 16,
    padding: 14, marginBottom: 4, borderWidth: 1, borderColor: CORES_SYMBIUS.borda,
  },
  cardEquipado: { borderColor: CORES_SYMBIUS.verdeEscuro, borderWidth: 1.5 },
  cardProvando: { borderColor: CORES_SYMBIUS.laranja, borderWidth: 2 },
  arteWrap: {
    height: 84, borderRadius: 14, backgroundColor: CORES_SYMBIUS.fundo,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10, padding: 10,
  },
  arte: { width: '100%', height: '100%' },
  itemNome: { color: CORES_SYMBIUS.texto, fontFamily: F.bold, marginBottom: 4 },
  itemPreco: { color: CORES_SYMBIUS.textoSec, fontFamily: F.semibold, marginBottom: 10 },
  itemBloqueado: { color: CORES_SYMBIUS.textoSec, fontFamily: F.semibold, marginBottom: 10, lineHeight: 14 },

  btnAcao: { borderRadius: 12, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  btnBloqueado: { backgroundColor: CORES_SYMBIUS.fundo },
  btnComprar: { backgroundColor: CORES_SYMBIUS.verdeEscuro },
  btnDesabilitado: { backgroundColor: CORES_SYMBIUS.fundo },
  btnEquipar: { backgroundColor: CORES_SYMBIUS.fundo, borderWidth: 1, borderColor: CORES_SYMBIUS.borda },
  btnEquipado: { backgroundColor: CORES_SYMBIUS.verdeEscuro },
  btnAcaoTxt: { fontFamily: F.bold },
  btnAcaoTxtComprar: { color: CORES_SYMBIUS.fundo },
  btnAcaoTxtDesabilitado: { color: CORES_SYMBIUS.textoSec },
  btnAcaoTxtEquipar: { color: CORES_SYMBIUS.texto },
  btnAcaoTxtEquipado: { color: CORES_SYMBIUS.fundo },
});
