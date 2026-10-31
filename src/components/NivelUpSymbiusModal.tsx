import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal, StyleSheet, Text, View, TouchableOpacity, Animated, Easing, useWindowDimensions,
} from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle, Polygon } from 'react-native-svg';
import { LevelUpInfo } from '../services/gamificationService';
import { NIVEL_GRADIENTE, NIVEL_NUMERO, animalPorNome } from '../constants/temaSymbius';
import AnimalImagem from './AnimalImagem';
import NivelUpFundoGradiente from './NivelUpFundoGradiente';
import { F } from '../constants/theme';

// ══════════════════════════════════════════════════════════════════════
// "Novo nível alcançado": tela cheia com o gradiente do animal, raios de luz
// girando, ondas de choque, explosão de cristais low-poly, animal entrando
// com impacto, nível contando e faíscas subindo. Usa o LevelUpInfo real do
// gamificationService; só a apresentação é animada.
// ══════════════════════════════════════════════════════════════════════

interface Props {
  info: LevelUpInfo | null;
  onFechar: () => void;
}

const N_CRISTAIS = 34;
const N_FAISCAS = 16;
const N_RAIOS = 14;
const N_ONDAS = 3;
const ND = true; // useNativeDriver

const pseudo = (i: number) => {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

const timing = (v: Animated.Value, toValue: number, duration: number, easing?: (t: number) => number) =>
  Animated.timing(v, { toValue, duration, easing, useNativeDriver: ND });

export default function NivelUpSymbiusModal({ info, onFechar }: Props) {
  const { width, height } = useWindowDimensions();
  const tamAnimal = Math.min(width * 0.7, 300);

  const fundo     = useRef(new Animated.Value(0)).current;
  const raios     = useRef(new Animated.Value(0)).current;
  const giro      = useRef(new Animated.Value(0)).current;
  const halo      = useRef(new Animated.Value(0)).current;
  const pulso     = useRef(new Animated.Value(0)).current;
  const animalIn  = useRef(new Animated.Value(0)).current;
  const flutua    = useRef(new Animated.Value(0)).current;
  const explosao  = useRef(new Animated.Value(0)).current;
  const flash     = useRef(new Animated.Value(0)).current;
  const nomeIn    = useRef(new Animated.Value(0)).current;
  const faseIn    = useRef(new Animated.Value(0)).current;
  const citacaoIn = useRef(new Animated.Value(0)).current;
  const botaoIn   = useRef(new Animated.Value(0)).current;
  const ondas     = useRef(Array.from({ length: N_ONDAS }, () => new Animated.Value(0))).current;
  const palavras  = useRef(Array.from({ length: 3 }, () => new Animated.Value(0))).current;
  const faiscas   = useRef(Array.from({ length: N_FAISCAS }, () => new Animated.Value(0))).current;
  const [numExibido, setNumExibido] = useState(0);

  const animal = info ? animalPorNome(info.nomeAnimal) : 'coruja';
  const g = NIVEL_GRADIENTE[animal];
  const numero = NIVEL_NUMERO[animal];

  const cristais = useMemo(() => {
    const cores = [g.labelTopo, g.subtitulo, '#C8A84B', g.c1, '#FFFFFF'];
    return Array.from({ length: N_CRISTAIS }, (_, i) => {
      const ang = (i / N_CRISTAIS) * Math.PI * 2 + (pseudo(i) - 0.5) * 0.4;
      const dist = 120 + pseudo(i + 7) * 190;
      return {
        dx: Math.cos(ang) * dist,
        dy: Math.sin(ang) * dist,
        tam: 7 + pseudo(i + 3) * 14,
        giro: (pseudo(i + 11) - 0.5) * 720,
        cor: cores[i % cores.length],
        triangulo: i % 3 === 0,
      };
    });
  }, [animal]);

  useEffect(() => {
    if (!info) return;
    [fundo, raios, giro, halo, pulso, animalIn, flutua, explosao, flash, nomeIn, faseIn, citacaoIn, botaoIn,
      ...ondas, ...palavras, ...faiscas].forEach(v => v.setValue(0));

    // o número do nível "rola" do anterior para o atual
    setNumExibido(numero > 1 ? numero - 1 : numero);
    const tNum = numero > 1 ? setTimeout(() => setNumExibido(numero), 2100) : undefined;

    const cena = Animated.parallel([
      timing(fundo, 1, 500),
      Animated.sequence([
        Animated.delay(350),
        Animated.parallel([
          Animated.sequence([timing(flash, 1, 90), timing(flash, 0, 520)]),
          Animated.spring(animalIn, { toValue: 1, friction: 5, tension: 70, useNativeDriver: ND }),
          timing(explosao, 1, 1500, Easing.out(Easing.cubic)),
          timing(halo, 1, 900),
          timing(raios, 1, 1200),
          ...ondas.map((o, i) =>
            Animated.sequence([Animated.delay(i * 260), timing(o, 1, 1400, Easing.out(Easing.quad))])),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(900),
        Animated.stagger(120, palavras.map(p => timing(p, 1, 420, Easing.out(Easing.back(1.6))))),
      ]),
      Animated.sequence([
        Animated.delay(1350),
        Animated.spring(nomeIn, { toValue: 1, friction: 6, tension: 80, useNativeDriver: ND }),
      ]),
      Animated.sequence([Animated.delay(1700), timing(faseIn, 1, 450)]),
      Animated.sequence([Animated.delay(2100), timing(citacaoIn, 1, 700)]),
      Animated.sequence([
        Animated.delay(2700),
        Animated.spring(botaoIn, { toValue: 1, friction: 7, tension: 80, useNativeDriver: ND }),
      ]),
    ]);
    cena.start();

    const loops: Animated.CompositeAnimation[] = [
      Animated.loop(timing(giro, 1, 26000, Easing.linear)),
      Animated.loop(Animated.sequence([
        timing(flutua, 1, 1800, Easing.inOut(Easing.sin)),
        timing(flutua, 0, 1800, Easing.inOut(Easing.sin)),
      ])),
      Animated.loop(Animated.sequence([
        timing(pulso, 1, 1400, Easing.inOut(Easing.quad)),
        timing(pulso, 0, 1400, Easing.inOut(Easing.quad)),
      ])),
      ...faiscas.map((f, i) =>
        Animated.sequence([
          Animated.delay(900 + i * 170),
          Animated.loop(timing(f, 1, 3200 + pseudo(i) * 2200, Easing.linear)),
        ])),
    ];
    loops.forEach(l => l.start());

    return () => {
      cena.stop();
      loops.forEach(l => l.stop());
      if (tNum) clearTimeout(tNum);
    };
  }, [info]);

  if (!info) return null;

  const raioGrande = tamAnimal * 2.4;
  const centroY = height * 0.3;

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={onFechar}>
      <View style={styles.tela}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: fundo }]}>
          <NivelUpFundoGradiente animal={animal} />
        </Animated.View>

        {/* Raios de luz girando */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.centro,
            {
              top: centroY - raioGrande / 2, width: raioGrande, height: raioGrande, opacity: raios,
              transform: [{ rotate: giro.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
            },
          ]}
        >
          <Svg width={raioGrande} height={raioGrande} viewBox="-100 -100 200 200">
            <Defs>
              <RadialGradient id="raio" cx="0" cy="0" r="100" gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor={g.labelTopo} stopOpacity={0.55} />
                <Stop offset="1" stopColor={g.labelTopo} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            {Array.from({ length: N_RAIOS }, (_, i) => {
              const a0 = (i / N_RAIOS) * Math.PI * 2;
              const a1 = a0 + ((Math.PI * 2) / N_RAIOS) * 0.38;
              const p = (a: number) => `${Math.cos(a) * 100},${Math.sin(a) * 100}`;
              return <Polygon key={i} points={`0,0 ${p(a0)} ${p(a1)}`} fill="url(#raio)" />;
            })}
          </Svg>
        </Animated.View>

        {/* Halo pulsante atrás do animal */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.centro,
            {
              top: centroY - tamAnimal, width: tamAnimal * 2, height: tamAnimal * 2, opacity: halo,
              transform: [{ scale: pulso.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] }) }],
            },
          ]}
        >
          <Svg width={tamAnimal * 2} height={tamAnimal * 2}>
            <Defs>
              <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={g.subtitulo} stopOpacity={0.55} />
                <Stop offset="0.5" stopColor={g.glow} stopOpacity={0.3} />
                <Stop offset="1" stopColor={g.glow} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={tamAnimal} cy={tamAnimal} r={tamAnimal} fill="url(#halo)" />
          </Svg>
        </Animated.View>

        {/* Ondas de choque */}
        {ondas.map((o, i) => (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={[
              styles.onda,
              {
                top: centroY - tamAnimal * 0.4, width: tamAnimal * 0.8, height: tamAnimal * 0.8,
                borderRadius: tamAnimal * 0.4, borderColor: g.labelTopo,
                opacity: o.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 0.8, 0] }),
                transform: [{ scale: o.interpolate({ inputRange: [0, 1], outputRange: [0.3, 3.2] }) }],
              },
            ]}
          />
        ))}

        {/* Faíscas subindo (loop) */}
        {faiscas.map((f, i) => (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={[
              styles.faisca,
              {
                left: pseudo(i + 40) * (width - 12), top: height,
                width: 4 + (i % 3) * 2, height: 4 + (i % 3) * 2, borderRadius: 4,
                backgroundColor: i % 2 ? g.labelTopo : '#C8A84B',
                opacity: f.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 0.9, 0.7, 0] }),
                transform: [
                  { translateY: f.interpolate({ inputRange: [0, 1], outputRange: [0, -height * 1.05] }) },
                  { translateX: f.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, i % 2 ? 22 : -22, 0] }) },
                ],
              },
            ]}
          />
        ))}

        {/* Cristais explodindo do centro */}
        <View pointerEvents="none" style={[styles.pontoCentral, { top: centroY }]}>
          {cristais.map((c, i) => (
            <Animated.View
              key={i}
              style={[
                c.triangulo
                  ? {
                      width: 0, height: 0, borderLeftWidth: c.tam / 1.6, borderRightWidth: c.tam / 1.6,
                      borderBottomWidth: c.tam * 1.4, borderLeftColor: 'transparent',
                      borderRightColor: 'transparent', borderBottomColor: c.cor,
                    }
                  : { width: c.tam, height: c.tam, backgroundColor: c.cor },
                {
                  position: 'absolute',
                  opacity: explosao.interpolate({ inputRange: [0, 0.08, 0.7, 1], outputRange: [0, 1, 0.9, 0] }),
                  transform: [
                    { translateX: explosao.interpolate({ inputRange: [0, 1], outputRange: [0, c.dx] }) },
                    { translateY: explosao.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0, c.dy, c.dy + 70] }) },
                    { rotate: explosao.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${c.giro}deg`] }) },
                    { scale: explosao.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1.2, 0.5] }) },
                  ],
                },
              ]}
            />
          ))}
        </View>

        {/* Animal */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.animalWrap,
            {
              top: centroY - tamAnimal / 2,
              opacity: animalIn.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 1, 1] }),
              transform: [
                { translateY: flutua.interpolate({ inputRange: [0, 1], outputRange: [6, -8] }) },
                { scale: animalIn.interpolate({ inputRange: [0, 1], outputRange: [2.6, 1] }) },
                { rotate: animalIn.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '0deg'] }) },
              ],
            },
          ]}
        >
          <AnimalImagem animal={animal} size={tamAnimal} />
        </Animated.View>

        {/* Flash de impacto */}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: '#FFFFFF', opacity: flash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] }) },
          ]}
        />

        {/* Textos */}
        <View style={[styles.textos, { top: centroY + tamAnimal / 2 + 28 }]} pointerEvents="box-none">
          <View style={styles.palavrasRow}>
            {['Novo', 'nível', 'alcançado!'].map((w, i) => (
              <Animated.Text
                key={w}
                style={[
                  styles.label,
                  {
                    color: g.labelTopo,
                    opacity: palavras[i],
                    transform: [{ translateY: palavras[i].interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
                  },
                ]}
              >
                {w}
              </Animated.Text>
            ))}
          </View>

          <Animated.Text
            style={[
              styles.nomeAnimal,
              {
                opacity: nomeIn,
                transform: [{ scale: nomeIn.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
              },
            ]}
          >
            {info.nomeAnimal}
          </Animated.Text>

          <Animated.View
            style={[
              styles.faseRow,
              { opacity: faseIn, transform: [{ translateY: faseIn.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] },
            ]}
          >
            <View style={[styles.fasePill, { borderColor: g.subtitulo }]}>
              <Text style={[styles.faseTxt, { color: g.labelTopo }]}>{info.nomeSubfase}</Text>
            </View>
            <Text style={[styles.nivel, { color: g.subtitulo }]}>Nível {numExibido}</Text>
          </Animated.View>

          <Animated.Text style={[styles.citacao, { color: g.citacaoCor, opacity: citacaoIn }]}>
            "{g.citacao}"
          </Animated.Text>
        </View>

        <Animated.View
          style={[
            styles.botaoWrap,
            { opacity: botaoIn, transform: [{ translateY: botaoIn.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }] },
          ]}
        >
          <TouchableOpacity style={styles.btn} onPress={onFechar} activeOpacity={0.85} accessibilityRole="button">
            <Text style={[styles.btnTxt, { color: g.botaoTexto }]}>Continuar</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, overflow: 'hidden', backgroundColor: '#10160D' },
  centro: { position: 'absolute', alignSelf: 'center' },
  onda: { position: 'absolute', alignSelf: 'center', borderWidth: 3 },
  faisca: { position: 'absolute' },
  pontoCentral: { position: 'absolute', alignSelf: 'center', width: 0, height: 0 },
  animalWrap: { position: 'absolute', alignSelf: 'center' },
  textos: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: 28 },
  palavrasRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  label: { fontSize: 16, fontFamily: F.semibold, letterSpacing: 0.4 },
  nomeAnimal: { fontSize: 46, lineHeight: 54, fontFamily: F.black, color: '#FFFFFF', marginTop: 6, textAlign: 'center' },
  faseRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  fasePill: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 5 },
  faseTxt: { fontSize: 14, fontFamily: F.bold },
  nivel: { fontSize: 16, fontFamily: F.semibold },
  citacao: {
    fontSize: 14, fontFamily: F.medium, fontStyle: 'italic', textAlign: 'center',
    lineHeight: 21, marginTop: 18, maxWidth: 280,
  },
  botaoWrap: { position: 'absolute', left: 28, right: 28, bottom: 44, alignItems: 'center' },
  btn: {
    backgroundColor: '#F4F1E8', borderRadius: 18, minHeight: 54, paddingHorizontal: 40,
    justifyContent: 'center', alignItems: 'center', alignSelf: 'stretch', maxWidth: 360,
  },
  btnTxt: { fontSize: 16, fontFamily: F.bold },
});
