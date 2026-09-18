import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient as SvgRadialGradient, Stop, Rect } from 'react-native-svg';
import { Animal } from '../utils/gamification';
import { NIVEL_GRADIENTE } from '../constants/temaSabe';

// ── Fundo com gradiente radial "circle at 50% 35%" — um por animal ──────
// Equivalente ao CSS `radial-gradient(circle at 50% 35%, c1, c2 75%)` do
// mockup. react-native-svg não tem gradiente radial nativo do RN, então
// usamos <RadialGradient> do SVG cobrindo a tela inteira.
interface Props {
  animal: Animal;
}

export default function NivelUpFundoGradiente({ animal }: Props) {
  const g = NIVEL_GRADIENTE[animal];
  const gradId = `nivelup-grad-${animal}`;

  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <SvgRadialGradient id={gradId} cx="50%" cy="35%" r="75%" gradientUnits="objectBoundingBox">
          <Stop offset="0" stopColor={g.c1} stopOpacity={1} />
          <Stop offset="0.75" stopColor={g.c2} stopOpacity={1} />
          <Stop offset="1" stopColor={g.c2} stopOpacity={1} />
        </SvgRadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradId})`} />
    </Svg>
  );
}
