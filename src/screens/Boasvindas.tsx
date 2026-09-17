import React from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, SafeAreaView, StatusBar,
} from 'react-native';

// ── Paleta "Sabé" — usada só nas telas novas de teste (Boasvindas, EscolhaPapel, Home) ──
// Isolada do theme.ts atual (azul/rosa) de propósito, pra não afetar o resto do app.
export const CORES_SABE = {
  fundo:        '#132218',
  fundoCard:    '#1B3323',
  verdeClaro:   '#A9C971',
  creme:        '#F5F1E2',
  textoClaro:   '#E7ECD9',
  textoSec:     '#9FB39B',
  borda:        '#2B4A33',
};

export default function Boasvindas({ navigation }: any) {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.conteudo}>
        <Text style={styles.logo}>sabé</Text>
        <Text style={styles.slogan}>aprenda junto</Text>

        <View style={{ flex: 1 }} />

        <Text style={styles.frase}>
          Juntos, o conhecimento{'\n'}floresce mais.
        </Text>

        <TouchableOpacity
          style={styles.btnComecar}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('EscolhaPapel')}
        >
          <Text style={styles.btnComecarText}>Começar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnLogin}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.btnLoginText}>Já tenho uma conta</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CORES_SABE.fundo },
  conteudo: { flex: 1, paddingHorizontal: 28, paddingBottom: 34, paddingTop: 60 },
  logo: {
    fontSize: 40, fontWeight: '800', color: CORES_SABE.creme, letterSpacing: -0.5,
  },
  slogan: {
    fontSize: 14, color: CORES_SABE.verdeClaro, fontWeight: '600', marginTop: 2,
  },
  frase: {
    fontSize: 22, color: CORES_SABE.textoClaro, fontWeight: '600', lineHeight: 30,
    marginBottom: 28,
  },
  btnComecar: {
    backgroundColor: CORES_SABE.creme, borderRadius: 16, paddingVertical: 17,
    alignItems: 'center', marginBottom: 14,
  },
  btnComecarText: { color: CORES_SABE.fundo, fontSize: 16, fontWeight: '800' },
  btnLogin: { alignItems: 'center', paddingVertical: 8 },
  btnLoginText: { color: CORES_SABE.textoSec, fontSize: 14, fontWeight: '600' },
});
