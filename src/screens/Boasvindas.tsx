import React from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, SafeAreaView, StatusBar, Image,
} from 'react-native';
import { F } from '../constants/theme';

import { CORES_SYMBIUS } from '../constants/coresSymbius';

export { CORES_SYMBIUS, CORES_SYMBIUS_DARK } from '../constants/coresSymbius';

export default function Boasvindas({ navigation }: any) {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Foto em 9:16 preenchendo a tela inteira (corta as bordas em vez de esticar) */}
      <Image
        source={require('../../assets/fundo.jpg')}
        style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
        resizeMode="cover"
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <View style={styles.escurecer} pointerEvents="none" />

      <SafeAreaView style={{ flex: 1 }}>
      <View style={styles.conteudo}>
        <View style={{ flex: 1 }} />
        <View style={styles.centro}>
          <Text style={styles.logo}>Simbio</Text>
          <Text style={styles.slogan}>aprenda junto</Text>
        </View>
        <View style={{ flex: 1 }} />

        <Text style={styles.frase}>
          Juntos, o conhecimento{'\n'}floresce mais.
        </Text>

        <TouchableOpacity
          style={styles.btnComecar}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Login')}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CORES_SYMBIUS.splashBg, overflow: 'hidden' },
  escurecer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(6,22,12,0.38)' },
  conteudo: {
    flex: 1, paddingHorizontal: 28, paddingBottom: 34, paddingTop: 60,
  },
  centro: { alignItems: 'center', justifyContent: 'center' },
  logo: {
    fontSize: 44, fontFamily: F.bold, color: CORES_SYMBIUS.splashTexto, letterSpacing: 0.5,
  },
  slogan: {
    fontSize: 14, color: CORES_SYMBIUS.splashTextoSec, fontFamily: F.medium, marginTop: 2,
  },
  frase: {
    fontSize: 22, color: CORES_SYMBIUS.splashTexto, fontFamily: F.bold, lineHeight: 30,
    textAlign: 'center', marginBottom: 28,
  },
  btnComecar: {
    backgroundColor: CORES_SYMBIUS.splashTexto, borderRadius: 28, paddingVertical: 16,
    alignItems: 'center', marginBottom: 14,
  },
  btnComecarText: { color: CORES_SYMBIUS.splashBg, fontSize: 15, fontFamily: F.bold },
  btnLogin: { alignItems: 'center', paddingVertical: 8 },
  btnLoginText: { color: CORES_SYMBIUS.splashTexto, fontSize: 14, fontFamily: F.semibold },
});
