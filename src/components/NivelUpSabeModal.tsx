import React, { useEffect, useRef } from 'react';
import {
  Modal, StyleSheet, Text, View, TouchableOpacity, Animated,
} from 'react-native';
import { LevelUpInfo } from '../services/gamificationService';
import { CORES_SABE } from '../screens/Boasvindas';
import { NIVEL_GRADIENTE, NIVEL_NUMERO, animalPorNome } from '../constants/temaSabe';
import NivelUpFundoGradiente from './NivelUpFundoGradiente';
import { F } from '../constants/theme';

// ══════════════════════════════════════════════════════════════════════
// Modal de "novo nível alcançado", no estilo sabé: tela cheia, gradiente
// radial exclusivo de cada animal (extraído pixel-a-pixel do mockup).
// Reaproveita o mesmo LevelUpInfo já calculado pelo gamificationService
// (nada de dado fake) — só a casca visual mudou.
// ══════════════════════════════════════════════════════════════════════

interface Props {
  info: LevelUpInfo | null;
  onFechar: () => void;
}

export default function NivelUpSabeModal({ info, onFechar }: Props) {
  const scale   = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (info) {
      scale.setValue(0.85);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(scale,   { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 320, useNativeDriver: true }),
      ]).start();
    }
  }, [info]);

  if (!info) return null;

  const animal = animalPorNome(info.nomeAnimal);
  const g = NIVEL_GRADIENTE[animal];
  const numero = NIVEL_NUMERO[animal];

  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={onFechar}>
      <View style={styles.tela}>
        <NivelUpFundoGradiente animal={animal} />
        <Animated.View style={[styles.conteudo, { opacity, transform: [{ scale }] }]}>
          <Text style={[styles.emoji, { textShadowColor: g.glow }]}>{info.iconeAnimal}</Text>
          <Text style={[styles.label, { color: g.labelTopo }]}>Novo nível alcançado!</Text>
          <Text style={styles.nomeAnimal}>{info.nomeAnimal}</Text>
          <Text style={[styles.nivel, { color: g.subtitulo }]}>Nível {numero}</Text>
          <Text style={[styles.citacao, { color: g.citacaoCor }]}>"{g.citacao}"</Text>

          <TouchableOpacity style={styles.btn} onPress={onFechar} activeOpacity={0.85}>
            <Text style={[styles.btnTxt, { color: g.botaoTexto }]}>Continuar</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  tela: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 28, paddingVertical: 40,
  },
  conteudo: { width: '100%', maxWidth: 340, alignItems: 'center' },
  emoji: {
    fontSize: 110, lineHeight: 120, textAlign: 'center',
    textShadowRadius: 30, textShadowOffset: { width: 0, height: 0 },
  },
  label: { fontSize: 15, fontFamily: F.semibold, marginTop: 28, textAlign: 'center' },
  nomeAnimal: { fontSize: 28, fontFamily: F.black, color: '#FFFFFF', marginTop: 6, textAlign: 'center' },
  nivel: { fontSize: 14, fontFamily: F.medium, marginTop: 2, textAlign: 'center' },
  citacao: {
    fontSize: 13, fontFamily: F.medium, fontStyle: 'italic', textAlign: 'center',
    lineHeight: 19, marginTop: 16, maxWidth: 260,
  },
  btn: {
    marginTop: 32, width: '100%', paddingVertical: 15, borderRadius: 26,
    backgroundColor: CORES_SABE.creme, alignItems: 'center',
  },
  btnTxt: { fontSize: 15, fontFamily: F.bold },
});
