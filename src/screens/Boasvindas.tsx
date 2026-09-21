import React from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, SafeAreaView, StatusBar,
} from 'react-native';
import Svg, { Path, Ellipse, G } from 'react-native-svg';
import { F } from '../constants/theme';

// ── Paleta "Symbius" — modo claro ──────────────────────────────────────────
// Isolada do theme.ts atual (azul/rosa) de propósito, pra não afetar o
// resto do app. Extraída pixel-a-pixel do mockup HTML fornecido.
//
// ⚠️ Apenas modo claro por enquanto — o modo escuro do Symbius será enviado
// separadamente pelo usuário.
export const CORES_SYMBIUS = {
  // fundo geral do app
  fundo:             '#FAF9F5',
  fundoCard:         '#FFFFFF',
  fundoSuave:        '#F0EEE6', // pills, busca, bolha recebida, caixas de ícone
  fundoLaranjaClaro: '#FCEFE3', // caixa "precisa aprender" no popup do chat

  // verde da marca
  verdeEscuro: '#1F3D2B', // botões primários, tab ativa, bolha enviada
  verdeMedio:  '#2E5B3F', // círculos de ícone sobre fundo verde

  creme: '#F4F1E8', // texto/ícone sobre fundo verde

  // texto
  texto:          '#1A1A1A',
  textoSec:       '#7C8177',
  textoTerciario: '#9AA398',
  textoMuted:     '#8A8F84',

  // bordas / divisórias
  borda:  '#ECE9DE',
  borda2: '#E3E0D6',

  // acentos
  laranja:      '#E8A33D',
  laranjaTexto: '#B4682A',
  azul:         '#4A90C2',
  sucesso:      '#4CAF50',
  pontoInativo: '#DDD9CC',

  // splash (Boasvindas) — permanece verde escuro sempre, mesmo em modo claro
  splashBg:       '#1F3D2B',
  splashDecor1:   '#264D33',
  splashDecor2:   '#2E5B3F',
  splashTexto:    '#F4F1E8',
  splashTextoSec: '#B9C9B4',
};

// ─── Paleta "Symbius" — modo escuro (recomendação do usuário, ainda não
// ligada a nenhum toggle — guardada aqui pra quando o modo escuro real
// for implementado nas telas). Extensão escura do verde da marca em vez
// de um cinza/preto neutro genérico. ───────────────────────────────────
export const CORES_SYMBIUS_DARK = {
  fundo:      '#0F1F16', // verde-carvão — fundo base
  fundoCard:  '#16281C', // cards / superfícies
  fundoSuave: '#2A4A34', // elementos ativos / inputs
  texto:      '#F4F1E8', // texto principal (igual ao claro)
  textoSec:   '#8FAE96', // texto secundário
};

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
