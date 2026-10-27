import React from 'react';
import { Image, StyleProp, View, ViewStyle } from 'react-native';
import { IMG_ANIMAL, IMG_ANIMAL_ROSTO } from '../constants/animaisImg';
import { NIVEL_AVATAR_BG } from '../constants/temaSymbius';
import type { Animal } from '../utils/gamification';

interface Props {
  animal: Animal;
  size: number;
  /** força o fundo pastel mesmo em tamanhos grandes */
  comFundo?: boolean;
  style?: StyleProp<ViewStyle>;
}

// Ilustração do animal (PNG sem fundo). Em tamanho pequeno vira avatar
// circular com o pastel do animal; em tamanho grande fica solta, sem moldura.
export default function AnimalImagem({ animal, size, comFundo, style }: Props) {
  const pequeno = size <= 64;
  const fundo = pequeno || comFundo;
  const pad = fundo ? size * (pequeno && IMG_ANIMAL_ROSTO[animal] ? 0.06 : 0.1) : 0;
  return (
    <View
      style={[
        { width: size, height: size, alignItems: 'center', justifyContent: 'center' },
        fundo && { backgroundColor: NIVEL_AVATAR_BG[animal], borderRadius: pequeno ? size / 2 : size * 0.22 },
        style,
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <Image source={(pequeno && IMG_ANIMAL_ROSTO[animal]) || IMG_ANIMAL[animal]} style={{ width: size - pad * 2, height: size - pad * 2 }} resizeMode="contain" />
    </View>
  );
}
