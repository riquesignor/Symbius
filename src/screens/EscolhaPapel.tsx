import { voltar } from '../navegacao';
import React from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CORES_SYMBIUS } from './Boasvindas';
import { F } from '../constants/theme';

// ── Papel na comunidade (não é um "tipo" novo de conta no backend — é uma tag
//    exibida no perfil; todo mundo continua sendo "Aluno" no Firestore) ──
//    Essa tela só aparece durante o cadastro de uma conta nova. Pra trocar
//    de papel depois, o usuário faz isso na tela de Perfil.
type Papel = 'aprender' | 'ensinar';

export default function EscolhaPapel({ navigation }: any) {
  const escolher = (papel: Papel) => {
    // A escolha vai como parâmetro pro Cadastro, que grava como tag no perfil
    // (campo `papel_comunidade`) — não cria um tipo de conta novo.
    navigation.navigate('Cadastro', { papel });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={CORES_SYMBIUS.barStyle} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => voltar(navigation)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={22} color={CORES_SYMBIUS.texto} />
        </TouchableOpacity>
      </View>

      <View style={styles.marcaWrap}>
        <Text style={styles.marca}>Simbio</Text>
      </View>

      <View style={styles.tituloWrap}>
        <Text style={styles.titulo}>Qual é o seu papel na comunidade?</Text>
      </View>

      <View style={{ flex: 1 }} />

      <View style={styles.opcoes}>
        <TouchableOpacity
          style={styles.cardPrimario}
          activeOpacity={0.85}
          onPress={() => escolher('aprender')}
        >
          <View style={styles.iconeWrapPrimario}>
            <Ionicons name="person-outline" size={22} color={CORES_SYMBIUS.creme} />
          </View>
          <Text style={styles.cardTituloPrimario}>Quero aprender (Aluno)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cardSecundario}
          activeOpacity={0.85}
          onPress={() => escolher('ensinar')}
        >
          <View style={styles.iconeWrapSecundario}>
            <Ionicons name="person-outline" size={22} color={CORES_SYMBIUS.texto} />
          </View>
          <Text style={styles.cardTituloSecundario}>Quero ensinar (Mentor)</Text>
        </TouchableOpacity>

        <Text style={styles.nota}>Você pode ser os dois!</Text>
      </View>

      <View style={styles.pontos}>
        <View style={[styles.ponto, { backgroundColor: CORES_SYMBIUS.verdeEscuro }]} />
        <View style={[styles.ponto, { backgroundColor: CORES_SYMBIUS.pontoInativo }]} />
        <View style={[styles.ponto, { backgroundColor: CORES_SYMBIUS.pontoInativo }]} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CORES_SYMBIUS.fundo },
  header: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 4 },
  marcaWrap: { alignItems: 'center', paddingVertical: 12 },
  marca: { fontSize: 26, fontFamily: F.bold, color: CORES_SYMBIUS.verdeEscuro },
  tituloWrap: { paddingHorizontal: 28 },
  titulo: {
    fontSize: 22, fontFamily: F.black, color: CORES_SYMBIUS.texto, textAlign: 'center', lineHeight: 30,
  },
  opcoes: { paddingHorizontal: 28 },
  cardPrimario: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: CORES_SYMBIUS.verdeEscuro, borderRadius: 22, padding: 24,
    marginBottom: 16,
  },
  iconeWrapPrimario: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: CORES_SYMBIUS.verdeMedio,
    justifyContent: 'center', alignItems: 'center',
  },
  cardTituloPrimario: { fontSize: 17, fontFamily: F.bold, color: CORES_SYMBIUS.creme },
  cardSecundario: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: CORES_SYMBIUS.fundoSuave, borderRadius: 22, padding: 24,
    borderWidth: 1, borderColor: CORES_SYMBIUS.borda2,
  },
  iconeWrapSecundario: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: CORES_SYMBIUS.borda2,
    justifyContent: 'center', alignItems: 'center',
  },
  cardTituloSecundario: { fontSize: 17, fontFamily: F.bold, color: CORES_SYMBIUS.texto },
  nota: {
    fontSize: 13, color: CORES_SYMBIUS.textoMuted, fontFamily: F.medium, textAlign: 'center', marginTop: 18,
  },
  pontos: {
    flexDirection: 'row', justifyContent: 'center', gap: 6, paddingBottom: 32, paddingTop: 8,
  },
  ponto: { width: 6, height: 6, borderRadius: 3 },
});
