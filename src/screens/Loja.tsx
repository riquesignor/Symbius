import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  SafeAreaView, StatusBar, ActivityIndicator, Alert,
} from 'react-native';
import { db } from '../config/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppSettings } from '../contexts/AppSettingsContext';
import { atingiuAnimal } from '../utils/gamification';
import { COSMETICOS, LABEL_CATEGORIA, CategoriaCosmetico, Cosmetico } from '../constants/cosmeticos';
import { comprarCosmetico, equiparCosmetico } from '../services/gamificationService';
import { F, CORES } from '../constants/theme';

const CATEGORIAS: CategoriaCosmetico[] = ['chapeu', 'acessorio', 'moldura'];

export default function Loja({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { cores: C, fonteScale, modoEscuro } = useAppSettings();
  const fs = (s: number) => s * fonteScale;

  const uid: string = route?.params?.uid || '';

  const [categoriaAtiva, setCategoriaAtiva] = useState<CategoriaCosmetico>('chapeu');
  const [usuario,   setUsuario]   = useState<any>(null);
  const [loading,   setLoading]   = useState(true);
  const [processando, setProcessando] = useState<string | null>(null);

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
  const equipados: Record<string, string | null> = usuario?.cosmeticos_equipados || {};

  const handleComprar = async (item: Cosmetico) => {
    if (!uid || processando) return;
    if (moedas < item.preco) {
      Alert.alert('Sementes insuficientes', `Você precisa de ${item.preco} sementes pra comprar "${item.nome}".`);
      return;
    }
    setProcessando(item.id);
    const ok = await comprarCosmetico(uid, item.id, item.preco);
    if (ok) await carregar();
    else Alert.alert('Ops', 'Não foi possível comprar esse item agora.');
    setProcessando(null);
  };

  const handleEquipar = async (item: Cosmetico) => {
    if (!uid || processando) return;
    const jaEquipado = equipados[item.categoria] === item.id;
    setProcessando(item.id);
    const ok = await equiparCosmetico(uid, item.categoria, jaEquipado ? null : item.id);
    if (ok) await carregar();
    setProcessando(null);
  };

  const itensDaCategoria = COSMETICOS.filter(c => c.categoria === categoriaAtiva);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: C.fundo }]}>
      <StatusBar barStyle={modoEscuro ? 'light-content' : 'dark-content'} backgroundColor={C.fundo} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: C.cinzaClaro, paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={22} color={C.azulEscuro} />
        </TouchableOpacity>
        <Text style={[styles.headerTitulo, { color: C.azulEscuro, fontSize: fs(16) }]}>
          🛍️ Loja
        </Text>
        <View style={[styles.saldoPill, { backgroundColor: modoEscuro ? '#2A2F36' : '#FFF3E0' }]}>
          <Text style={{ fontSize: fs(14) }}>🌱</Text>
          <Text style={[styles.saldoTxt, { color: C.azulEscuro, fontSize: fs(13) }]}>{moedas}</Text>
        </View>
      </View>

      {/* Filtro de categoria */}
      <View style={[styles.filtroRow, { borderBottomColor: C.cinzaClaro }]}>
        {CATEGORIAS.map(cat => {
          const ativa = cat === categoriaAtiva;
          return (
            <TouchableOpacity
              key={cat}
              style={[
                styles.filtroPill,
                { backgroundColor: ativa ? CORES.azulEscuro : C.branco,
                  borderColor: ativa ? CORES.azulEscuro : C.cinzaClaro },
              ]}
              onPress={() => setCategoriaAtiva(cat)}
            >
              <Text style={[styles.filtroText, { color: ativa ? '#fff' : C.textoSec, fontSize: fs(12) }]}>
                {LABEL_CATEGORIA[cat]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={CORES.rosa} size="large" />
      ) : (
        <ScrollView contentContainerStyle={styles.lista} showsVerticalScrollIndicator={false}>
          {itensDaCategoria.map(item => {
            const possui       = itensAdquiridos.includes(item.id);
            const equipado     = equipados[item.categoria] === item.id;
            const bloqueado    = !!item.prestigio && item.animalMinimo && !atingiuAnimal(xpTotal, item.animalMinimo);
            const carregandoEsse = processando === item.id;

            return (
              <View key={item.id} style={[styles.card, { backgroundColor: C.branco, borderColor: equipado ? CORES.rosa : C.cinzaClaro }]}>
                <View style={[
                  styles.iconeWrap,
                  { backgroundColor: modoEscuro ? '#2A2F36' : '#F5F7FA' },
                  item.categoria === 'moldura' ? { borderWidth: 3, borderColor: item.cor } : null,
                ]}>
                  <Text style={{ fontSize: fs(28) }}>{item.emoji}</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemNome, { color: C.azulEscuro, fontSize: fs(14) }]}>
                    {item.nome}
                    {item.prestigio && <Text style={{ fontSize: fs(11) }}>  ✨ prestígio</Text>}
                  </Text>

                  {bloqueado ? (
                    <Text style={[styles.itemBloqueado, { color: C.textoSec, fontSize: fs(11) }]}>
                      🔒 Requer alcançar {item.animalMinimo ? item.animalMinimo.charAt(0).toUpperCase() + item.animalMinimo.slice(1) : ''}
                    </Text>
                  ) : (
                    <Text style={[styles.itemPreco, { color: C.textoSec, fontSize: fs(12) }]}>
                      🌱 {item.preco} sementes
                    </Text>
                  )}
                </View>

                {carregandoEsse ? (
                  <ActivityIndicator color={CORES.rosa} size="small" />
                ) : bloqueado ? (
                  <Ionicons name="lock-closed" size={20} color={C.textoSec} />
                ) : possui ? (
                  <TouchableOpacity
                    style={[styles.btnAcao, { backgroundColor: equipado ? CORES.rosa : (modoEscuro ? '#2A2F36' : '#F5F7FA') }]}
                    onPress={() => handleEquipar(item)}
                  >
                    <Text style={[styles.btnAcaoTxt, { color: equipado ? '#fff' : C.azulEscuro, fontSize: fs(12) }]}>
                      {equipado ? 'Equipado ✓' : 'Equipar'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.btnAcao, { backgroundColor: moedas >= item.preco ? CORES.azulEscuro : C.cinzaClaro }]}
                    onPress={() => handleComprar(item)}
                    disabled={moedas < item.preco}
                  >
                    <Text style={[styles.btnAcaoTxt, { color: moedas >= item.preco ? '#fff' : C.textoSec, fontSize: fs(12) }]}>
                      Comprar
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
          <View style={{ height: 30 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingBottom: 14, borderBottomWidth: 1,
  },
  headerTitulo: { fontFamily: F.black, letterSpacing: -0.5 },
  saldoPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14,
  },
  saldoTxt: { fontFamily: F.black },

  filtroRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 18, paddingVertical: 12,
    borderBottomWidth: 1,
  },
  filtroPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5 },
  filtroText: { fontFamily: F.bold },

  lista: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 20 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, padding: 12, marginBottom: 10, borderWidth: 1.5,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  iconeWrap: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
  },
  itemNome:      { fontFamily: F.bold, marginBottom: 3 },
  itemPreco:     { fontFamily: F.medium },
  itemBloqueado: { fontFamily: F.medium },
  btnAcao:      { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12 },
  btnAcaoTxt:   { fontFamily: F.bold },
});