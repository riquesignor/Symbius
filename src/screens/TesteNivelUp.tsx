import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CORES_SYMBIUS } from '../constants/coresSymbius';
import { F } from '../constants/theme';
import { Animal, ANIMAIS_ORDER, calcularNivel } from '../utils/gamification';
import { LevelUpInfo } from '../services/gamificationService';
import AnimalImagem from '../components/AnimalImagem';
import NivelUpSymbiusModal from '../components/NivelUpSymbiusModal';

// Tela de simulação (só visual): dispara a animação de "subiu de nível" sem
// mexer em XP nem gravar nada no Firebase.

const NOMES: Record<Animal, string> = {
  coruja: 'Coruja', raposa: 'Raposa', gaviao: 'Gavião', leopardo: 'Leopardo', tubarao: 'Tubarão',
};
const SUBFASES = ['Bronze', 'Prata', 'Ouro', 'Diamante'];

// XP de cada animal × subfase (início de cada faixa, ver utils/gamification.ts)
const XP: Record<Animal, number[]> = {
  coruja:   [0, 75, 150, 225],
  raposa:   [301, 526, 751, 976],
  gaviao:   [1201, 1776, 2351, 2926],
  leopardo: [3501, 4626, 5751, 6876],
  tubarao:  [8001, 9501, 11001, 12501],
};

export default function TesteNivelUp({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [animal, setAnimal] = useState<Animal>('coruja');
  const [fase, setFase] = useState(0);
  const [info, setInfo] = useState<LevelUpInfo | null>(null);

  const simular = () => {
    const n = calcularNivel(XP[animal][fase]);
    setInfo({
      nomeAnimal: n.nomeAnimal, iconeAnimal: n.iconeAnimal,
      nomeSubfase: n.nomeSubfase, iconeSubfase: n.iconeSubfase, conceitoRank: n.conceitoRank,
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 22 }]}>
      <View style={styles.topo}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.btnVoltar} accessibilityLabel="Voltar">
          <Ionicons name="arrow-back" size={22} color={CORES_SYMBIUS.texto} />
        </TouchableOpacity>
        <Text style={styles.titulo}>Simular subida de nível</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.sub}>
          Escolha o animal e a fase e toque em simular. Nada é salvo: o XP e o nível reais não mudam.
        </Text>

        <Text style={styles.rotulo}>Animal</Text>
        <View style={styles.animais}>
          {ANIMAIS_ORDER.map(a => {
            const ativo = a === animal;
            return (
              <TouchableOpacity
                key={a}
                style={[styles.animalBtn, ativo && styles.animalBtnAtivo]}
                onPress={() => setAnimal(a)}
                accessibilityRole="button"
                accessibilityState={{ selected: ativo }}
              >
                <AnimalImagem animal={a} size={52} />
                <Text style={[styles.animalNome, ativo && { color: CORES_SYMBIUS.creme }]}>{NOMES[a]}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.rotulo}>Fase</Text>
        <View style={styles.fases}>
          {SUBFASES.map((f, i) => {
            const ativo = i === fase;
            return (
              <TouchableOpacity
                key={f}
                style={[styles.faseBtn, ativo && styles.faseBtnAtivo]}
                onPress={() => setFase(i)}
                accessibilityRole="button"
                accessibilityState={{ selected: ativo }}
              >
                <Text style={[styles.faseTxt, ativo && { color: CORES_SYMBIUS.creme }]}>{f}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.rodape, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity style={styles.btnSimular} onPress={simular} activeOpacity={0.85} accessibilityRole="button">
          <Ionicons name="sparkles" size={18} color={CORES_SYMBIUS.creme} />
          <Text style={styles.btnSimularTxt}>Simular subida de nível</Text>
        </TouchableOpacity>
      </View>

      <NivelUpSymbiusModal info={info} onFechar={() => setInfo(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CORES_SYMBIUS.fundo },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20 },
  btnVoltar: {
    width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start',
  },
  titulo: { fontSize: 18, fontFamily: F.bold, color: CORES_SYMBIUS.texto },
  sub: { fontSize: 13.5, fontFamily: F.regular, color: CORES_SYMBIUS.textoSec, lineHeight: 20 },
  rotulo: { fontSize: 14, fontFamily: F.bold, color: CORES_SYMBIUS.texto, marginTop: 24, marginBottom: 10 },
  animais: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  animalBtn: {
    width: 96, minHeight: 100, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 8,
    backgroundColor: CORES_SYMBIUS.fundoCard, borderWidth: 1, borderColor: CORES_SYMBIUS.borda2,
  },
  animalBtnAtivo: { backgroundColor: CORES_SYMBIUS.verdeEscuro, borderColor: CORES_SYMBIUS.verdeEscuro },
  animalNome: { fontSize: 13, fontFamily: F.semibold, color: CORES_SYMBIUS.texto },
  fases: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  faseBtn: {
    minHeight: 44, paddingHorizontal: 18, borderRadius: 14, justifyContent: 'center',
    backgroundColor: CORES_SYMBIUS.fundoCard, borderWidth: 1, borderColor: CORES_SYMBIUS.borda2,
  },
  faseBtnAtivo: { backgroundColor: CORES_SYMBIUS.verdeEscuro, borderColor: CORES_SYMBIUS.verdeEscuro },
  faseTxt: { fontSize: 14, fontFamily: F.semibold, color: CORES_SYMBIUS.texto },
  rodape: {
    position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12,
    backgroundColor: CORES_SYMBIUS.fundo, borderTopWidth: 1, borderTopColor: CORES_SYMBIUS.borda,
  },
  btnSimular: {
    minHeight: 54, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: CORES_SYMBIUS.verdeEscuro,
  },
  btnSimularTxt: { fontSize: 16, fontFamily: F.bold, color: CORES_SYMBIUS.creme },
});
