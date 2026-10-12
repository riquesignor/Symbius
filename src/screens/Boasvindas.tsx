import React from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, SafeAreaView, StatusBar,
} from 'react-native';
import Svg, { Path, Ellipse, G } from 'react-native-svg';
import { F } from '../constants/theme';

import { CORES_SYMBIUS } from '../constants/coresSymbius';

export { CORES_SYMBIUS, CORES_SYMBIUS_DARK } from '../constants/coresSymbius';

export default function Boasvindas({ navigation }: any) {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <Svg width="100%" height="100%" viewBox="0 0 390 844" style={StyleSheet.absoluteFill}>
        <G opacity={0.9}>
          <Path d="M0 0 C20 60 -10 110 30 150 C10 180 40 210 15 250 C50 240 60 190 45 150 C75 140 70 90 40 60 C60 40 40 10 0 0Z" fill={CORES_SYMBIUS.splashDecor1} />
          <Ellipse cx={18} cy={40} rx={26} ry={14} fill={CORES_SYMBIUS.splashDecor2} rotation={-30} origin="18,40" />
          <Ellipse cx={45} cy={95} rx={30} ry={15} fill={CORES_SYMBIUS.splashDecor2} rotation={25} origin="45,95" />
          <Ellipse cx={10} cy={150} rx={28} ry={14} fill={CORES_SYMBIUS.splashDecor2} rotation={-15} origin="10,150" />
          <Ellipse cx={38} cy={205} rx={26} ry={13} fill={CORES_SYMBIUS.splashDecor2} rotation={20} origin="38,205" />
        </G>
        <G opacity={0.9}>
          <Path d="M390 0 C370 60 400 110 360 150 C380 180 350 210 375 250 C340 240 330 190 345 150 C315 140 320 90 350 60 C330 40 350 10 390 0Z" fill={CORES_SYMBIUS.splashDecor1} />
          <Ellipse cx={372} cy={40} rx={26} ry={14} fill={CORES_SYMBIUS.splashDecor2} rotation={30} origin="372,40" />
          <Ellipse cx={345} cy={95} rx={30} ry={15} fill={CORES_SYMBIUS.splashDecor2} rotation={-25} origin="345,95" />
          <Ellipse cx={380} cy={150} rx={28} ry={14} fill={CORES_SYMBIUS.splashDecor2} rotation={15} origin="380,150" />
        </G>
        <G opacity={0.7}>
          <Path d="M0 844 C40 780 20 720 60 680 C40 650 70 610 45 570 C90 590 95 650 70 690 C100 700 95 760 60 800 C80 815 70 830 40 844Z" fill={CORES_SYMBIUS.splashDecor1} />
          <Ellipse cx={30} cy={760} rx={28} ry={14} fill={CORES_SYMBIUS.splashDecor2} rotation={20} origin="30,760" />
          <Ellipse cx={65} cy={700} rx={26} ry={13} fill={CORES_SYMBIUS.splashDecor2} rotation={-20} origin="65,700" />
        </G>
        <G opacity={0.7}>
          <Path d="M390 844 C350 780 370 720 330 680 C350 650 320 610 345 570 C300 590 295 650 320 690 C290 700 295 760 330 800 C310 815 320 830 350 844Z" fill={CORES_SYMBIUS.splashDecor1} />
          <Ellipse cx={360} cy={760} rx={28} ry={14} fill={CORES_SYMBIUS.splashDecor2} rotation={-20} origin="360,760" />
        </G>
      </Svg>

      <View style={styles.conteudo}>
        <View style={{ flex: 1 }} />
        <View style={styles.centro}>
          <Text style={styles.logo}>Symbius</Text>
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CORES_SYMBIUS.splashBg },
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
