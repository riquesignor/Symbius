import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

// Transição de tema em "cachoeira": uma onda com degradê cobre a tela e o app
// reinicia por baixo dela (as cores só são lidas quando os módulos carregam, ver
// index.ts). Ao voltar, a onda já está na cor do tema novo e fica ali até o app
// estar realmente pronto (fontes + sessão), então se dissolve — sem tela branca,
// sem piscada e sem a bolinha de loading no meio.
//   claro → escuro: a onda sobe, de baixo pra cima
//   escuro → claro: a onda desce, de cima pra baixo

export const CHAVE_TRANSICAO = 'tema_transicao';

export const FUNDO_ESCURO = '#0D1F13';
export const FUNDO_CLARO = '#FAF9F5';

export interface EstadoInicial { pendente: boolean; escuro: boolean }

// ── estado compartilhado entre index.ts, App.tsx e o componente ──
let inicialGlobal: EstadoInicial = { pendente: false, escuro: false };
let appProntoFlag = false;
const ouvintesPronto = new Set<() => void>();

export const prepararTransicao = (e: EstadoInicial) => { inicialGlobal = e; };
// true enquanto o app está reabrindo depois de uma troca de tema (App.tsx esconde o spinner)
export const transicaoEmAndamento = () => inicialGlobal.pendente && !appProntoFlag;
// App.tsx chama quando a primeira tela de verdade já pode aparecer
export const marcarAppPronto = () => {
  appProntoFlag = true;
  ouvintesPronto.forEach(f => f());
};

// Na web dá pra ler o localStorage na hora (o AsyncStorage da web é ele), então
// o primeiro quadro já sai na cor certa. No celular a leitura é assíncrona.
export const lerEstadoWeb = (): EstadoInicial | null => {
  if (Platform.OS !== 'web') return null;
  try {
    return {
      pendente: window.localStorage.getItem(CHAVE_TRANSICAO) === '1',
      escuro: window.localStorage.getItem('cfg_modoEscuro') === '1',
    };
  } catch { return null; }
};

type Disparo = (paraEscuro: boolean) => Promise<void>;
let disparo: Disparo | null = null;
let emTransicao = false;

// Roda a onda e resolve quando a tela está toda coberta. Devolve false se já
// há uma transição em andamento (ex.: toque no interruptor dispara dois eventos):
// quem chamou deve ignorar. Sem o componente montado devolve true na hora e o
// chamador só reinicia, sem efeito.
export const executarTransicaoTema = async (paraEscuro: boolean): Promise<boolean> => {
  if (emTransicao) return false;
  if (!disparo) return true;
  emTransicao = true;
  await disparo(paraEscuro);
  await AsyncStorage.setItem(CHAVE_TRANSICAO, '1').catch(() => {});
  setTimeout(() => { emTransicao = false; }, 6000); // se o reinício falhar, libera de novo
  return true; // continua "em transição" até o reinício; o app recarrega por cima
};

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

interface Props { pronto: boolean; inicial?: EstadoInicial }

const TransicaoTema: React.FC<Props> = ({ pronto, inicial }) => {
  const { height: H } = useWindowDimensions();
  const reabre = !!inicial?.pendente;
  const [paraEscuro, setParaEscuro] = useState(inicial?.escuro ?? true);
  const [visivel, setVisivel] = useState(reabre);
  const [reabrindo, setReabrindo] = useState(reabre);
  const [appPronto, setAppPronto] = useState(appProntoFlag);

  const principal = useRef(new Animated.Value(reabre ? 1 : 0)).current; // 0 → 1: onda de fundo
  const lider = useRef(new Animated.Value(reabre ? 1 : 0)).current;     // 0 → 1: brilho na frente
  const opacidade = useRef(new Animated.Value(1)).current;
  const nativo = Platform.OS !== 'web';

  // Disparo vindo das configurações
  useEffect(() => {
    disparo = (escuro) => new Promise<void>((resolve) => {
      setParaEscuro(escuro);
      principal.setValue(0);
      lider.setValue(0);
      opacidade.setValue(1);
      setVisivel(true);
      Animated.parallel([
        Animated.timing(lider, { toValue: 1, duration: 950, easing: Easing.inOut(Easing.cubic), useNativeDriver: nativo }),
        Animated.timing(principal, { toValue: 1, duration: 1150, delay: 120, easing: Easing.inOut(Easing.cubic), useNativeDriver: nativo }),
      ]).start(() => resolve());
    });
    return () => { disparo = null; };
  }, []);

  // Reinício: consome a flag e acompanha quando o App termina de carregar
  useEffect(() => {
    if (reabre) AsyncStorage.removeItem(CHAVE_TRANSICAO).catch(() => {});
    const f = () => setAppPronto(true);
    ouvintesPronto.add(f);
    return () => { ouvintesPronto.delete(f); };
  }, []);

  // Quando o app já montou (ou passou do limite de espera), dissolve a onda
  useEffect(() => {
    if (!reabrindo) return;
    const dissolver = () => {
      Animated.timing(opacidade, { toValue: 0, duration: 520, easing: Easing.out(Easing.quad), useNativeDriver: nativo })
        .start(() => { setVisivel(false); setReabrindo(false); });
    };
    if (pronto && appPronto) {
      const t = setTimeout(dissolver, 140);
      return () => clearTimeout(t);
    }
    const limite = setTimeout(dissolver, 6000); // rede lenta: não prende a tela pra sempre
    return () => clearTimeout(limite);
  }, [reabrindo, pronto, appPronto]);

  if (!visivel) return null;

  const cor = paraEscuro ? FUNDO_ESCURO : FUNDO_CLARO;
  const altura = H * 1.5;
  // sobe: começa abaixo da tela e termina com o degradê todo acima; desce: o contrário
  const ty = (p: Animated.Value) => p.interpolate({
    inputRange: [0, 1],
    outputRange: paraEscuro ? [H, -(altura - H)] : [-altura, 0],
  });

  // brilho que corre na frente da onda: verde-musgo ao escurecer, creme ao clarear
  const corLider = paraEscuro ? '#3F8A5C' : '#FFF8E6';
  const camadas: { anim: Animated.Value; cor: string; alfa: number }[] = [
    { anim: lider, cor: corLider, alfa: paraEscuro ? 0.85 : 0.9 },
    { anim: principal, cor, alfa: 1 },
  ];

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.raiz, { opacity: opacidade }]}>
      {camadas.map((c, i) => (
        <Animated.View key={i} style={[styles.onda, { height: altura, transform: [{ translateY: ty(c.anim) }] }]}>
          <LinearGradient
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            colors={paraEscuro
              ? [rgba(c.cor, 0), rgba(c.cor, c.alfa), rgba(c.cor, c.alfa)]
              : [rgba(c.cor, c.alfa), rgba(c.cor, c.alfa), rgba(c.cor, 0)]}
            locations={paraEscuro ? [0, 0.38, 1] : [0, 0.62, 1]}
          />
        </Animated.View>
      ))}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  raiz: { zIndex: 9999, elevation: 9999, overflow: 'hidden' },
  onda: { position: 'absolute', left: 0, right: 0, top: 0 },
});

export default TransicaoTema;
