import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet, View, TouchableOpacity, Text, Animated, Easing, Keyboard, Platform,
  AccessibilityInfo, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CORES_SYMBIUS } from '../constants/coresSymbius';
import { auth } from '../config/firebaseConfig';
import { irParaAba, navegacaoRef } from '../navegacao';
import { F } from '../constants/theme';

// ══════════════════════════════════════════════════════════════════════
// Dock de navegação. Existe UMA só, montada em App.tsx por cima do Stack
// (DockGlobal): assim ela não é desmontada ao trocar de tela e a cápsula
// pode deslizar de uma aba pra outra enquanto a tela de baixo transiciona.
//
// Cada tela continua renderizando <SymbiusTabBar />, que agora é só um
// espaçador invisível com a altura da dock — o conteúdo da tela não passa
// por baixo dela. Telas que mostram a dock precisam estar em ROTA_PARA_ABA.
// ══════════════════════════════════════════════════════════════════════
export type SymbiusAba = 'inicio' | 'agenda' | 'match' | 'feed' | 'perfil' | 'nenhuma';

interface Props {
  ativa?: SymbiusAba;
  navigation?: any;
  uid?: string | null;
}

// Rota do Stack -> aba destacada. 'nenhuma' = mostra a dock sem destacar aba.
// Rotas fora desta lista (Login, Chat, GrupoChat...) escondem a dock.
export const ROTA_PARA_ABA: Record<string, SymbiusAba> = {
  Index: 'inicio', Calendario: 'agenda', Match: 'match', Resumos: 'feed', Perfil: 'perfil',
  Ajuda: 'nenhuma', Loja: 'nenhuma', Admin: 'nenhuma', Contatos: 'nenhuma',
  Leaderboard: 'nenhuma', Configuracoes: 'nenhuma', PerfilPublico: 'nenhuma',
};

const ITENS: { chave: SymbiusAba; label: string; icone: keyof typeof Ionicons.glyphMap; iconeAtivo: keyof typeof Ionicons.glyphMap; destino: string }[] = [
  { chave: 'inicio', label: 'Início',  icone: 'home-outline',      iconeAtivo: 'home',      destino: 'Index' },
  { chave: 'agenda', label: 'Agenda',  icone: 'calendar-outline',  iconeAtivo: 'calendar',  destino: 'Calendario' },
  { chave: 'match',  label: 'Elos',    icone: 'infinite-outline',  iconeAtivo: 'infinite',  destino: 'Match' },
  { chave: 'feed',   label: 'Resumos', icone: 'newspaper-outline', iconeAtivo: 'newspaper', destino: 'Resumos' },
  { chave: 'perfil', label: 'Perfil',  icone: 'person-outline',    iconeAtivo: 'person',    destino: 'Perfil' },
];

// ── Medidas (o espaçador e a dock precisam concordar) ──
const ITEM_H = 48;
const DOCK_PAD = 6;
const DOCK_BORDA = 1;
const FAIXA_TOPO = 6;
const MARGEM_LATERAL = 14;
const DOCK_MAX = 440;
const ICONE = 22;
const GAP_LABEL = 7;
const baixo = (insetBottom: number) => Math.max(10, insetBottom + 4);
const alturaDock = (insetBottom: number) =>
  FAIXA_TOPO + ITEM_H + DOCK_PAD * 2 + DOCK_BORDA * 2 + baixo(insetBottom);

// ── Rota atual: o App avisa, a dock escuta ──
let rotaAtual: string | null = null;
const ouvintes = new Set<(r: string | null) => void>();
export const definirRotaDock = (rota: string | null) => {
  if (rota === rotaAtual) return;
  rotaAtual = rota;
  ouvintes.forEach(f => f(rota));
};
const useRotaDock = () => {
  const [rota, setRota] = useState<string | null>(rotaAtual);
  useEffect(() => {
    ouvintes.add(setRota);
    setRota(rotaAtual);
    return () => { ouvintes.delete(setRota); };
  }, []);
  return rota;
};

const useTecladoVisivel = () => {
  const [visivel, setVisivel] = useState(false);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const a = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', () => setVisivel(true));
    const b = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setVisivel(false));
    return () => { a.remove(); b.remove(); };
  }, []);
  return visivel;
};

// ── Espaçador que cada tela renderiza no lugar da barra antiga ──
export default function SymbiusTabBar(_: Props) {
  const insets = useSafeAreaInsets();
  const teclado = useTecladoVisivel();
  return <View pointerEvents="none" style={{ height: teclado ? 0 : alturaDock(insets.bottom) }} />;
}

// ── A dock de verdade ──
export function DockGlobal() {
  const rota = useRotaDock();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const teclado = useTecladoVisivel();

  const [reduzirMovimento, setReduzirMovimento] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduzirMovimento).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduzirMovimento);
    return () => sub.remove();
  }, []);

  // Aba destacada: guarda a última válida, pra a cápsula não sumir enquanto a
  // dock se esconde ao ir pra uma tela sem dock (ex.: Chat).
  const abaDaRota = rota ? ROTA_PARA_ABA[rota] : undefined;
  const [ativa, setAtiva] = useState<SymbiusAba>(abaDaRota ?? 'nenhuma');
  useEffect(() => { if (abaDaRota !== undefined) setAtiva(abaDaRota); }, [abaDaRota]);

  const mostrar = abaDaRota !== undefined && !teclado;
  const aparecer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(aparecer, {
      toValue: mostrar ? 1 : 0, duration: reduzirMovimento ? 0 : 240,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, [mostrar, reduzirMovimento]);

  // 0 = aba comum, 1 = aba ativa. A cápsula "passa" de uma pra outra: a antiga
  // encolhe enquanto a nova cresce e revela o nome.
  const destaque = useRef(ITENS.map(it => new Animated.Value(it.chave === ativa ? 1 : 0))).current;
  useEffect(() => {
    Animated.parallel(ITENS.map((it, i) => Animated.timing(destaque[i], {
      toValue: it.chave === ativa ? 1 : 0, duration: reduzirMovimento ? 0 : 300,
      easing: Easing.out(Easing.cubic), useNativeDriver: false, // largura não usa driver nativo
    }))).start();
  }, [ativa, reduzirMovimento]);

  // Largura real de cada nome (medida num texto invisível, já com a fonte carregada).
  const [medidas, setMedidas] = useState<number[]>(ITENS.map(i => Math.ceil(i.label.length * 8)));
  const maiorNome = Math.max(...medidas);
  const disponivel = Math.min(width - MARGEM_LATERAL * 2, DOCK_MAX) - DOCK_PAD * 2 - DOCK_BORDA * 2;
  const base = Math.max(44, Math.min(ITEM_H, Math.floor((disponivel - GAP_LABEL - maiorNome) / ITENS.length)));
  const padIcone = (base - ICONE) / 2;

  const irPara = (destino: string) => {
    if (destino === rota) return;
    const params: any = navegacaoRef.getCurrentRoute()?.params;
    const uid = auth.currentUser?.uid ?? params?.meuUid ?? params?.uid ?? null;
    irParaAba(navegacaoRef, destino, uid ? { uid } : undefined);
  };

  return (
    <Animated.View
      pointerEvents={mostrar ? 'box-none' : 'none'}
      // Escondida: some também para leitores de tela (só opacidade não basta).
      accessibilityElementsHidden={!mostrar}
      importantForAccessibility={mostrar ? 'auto' : 'no-hide-descendants'}
      aria-hidden={!mostrar}
      style={[
        styles.faixa,
        {
          paddingBottom: baixo(insets.bottom),
          opacity: aparecer,
          transform: [{ translateY: aparecer.interpolate({ inputRange: [0, 1], outputRange: [alturaDock(insets.bottom) + 24, 0] }) }],
        },
      ]}
    >
      <View style={styles.dock} accessibilityRole="tablist">
        {ITENS.map((item, i) => {
          const t = destaque[i];
          const ativo = item.chave === ativa;
          const largura = t.interpolate({ inputRange: [0, 1], outputRange: [base, base + GAP_LABEL + medidas[i]] });
          return (
            <TouchableOpacity
              key={item.chave}
              activeOpacity={0.8}
              onPress={() => irPara(item.destino)}
              accessibilityRole="tab"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: ativo }}
            >
              <Animated.View style={[styles.item, { width: largura, paddingLeft: padIcone }]}>
                <Animated.View style={[StyleSheet.absoluteFill, styles.capsula, { opacity: t }]} />
                <View style={styles.icone}>
                  <Animated.View style={[StyleSheet.absoluteFill, { opacity: t.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>
                    <Ionicons name={item.icone} size={ICONE} color={CORES_SYMBIUS.textoSec} />
                  </Animated.View>
                  <Animated.View style={[StyleSheet.absoluteFill, { opacity: t }]}>
                    <Ionicons name={item.iconeAtivo} size={ICONE} color={CORES_SYMBIUS.creme} />
                  </Animated.View>
                </View>
                <Animated.Text numberOfLines={1} style={[styles.label, { opacity: t, marginLeft: GAP_LABEL }]}>
                  {item.label}
                </Animated.Text>
              </Animated.View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View pointerEvents="none" style={styles.medidor} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {ITENS.map((item, i) => (
          <Text
            key={item.chave}
            numberOfLines={1}
            style={[styles.label, { alignSelf: 'flex-start' }]}
            onLayout={e => {
              const w = Math.ceil(e.nativeEvent.layout.width) + 1;
              setMedidas(prev => (prev[i] === w ? prev : prev.map((v, j) => (j === i ? w : v))));
            }}
          >
            {item.label}
          </Text>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Em fluxo normal: quem posiciona no rodapé é o provider em App.tsx, que tem
  // exatamente o tamanho da dock (no Android toque fora do pai não chega ao filho).
  faixa: { paddingHorizontal: MARGEM_LATERAL, paddingTop: FAIXA_TOPO },
  dock: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    alignSelf: 'center', width: '100%', maxWidth: DOCK_MAX,
    padding: DOCK_PAD, borderRadius: 32,
    backgroundColor: CORES_SYMBIUS.fundoCard,
    borderWidth: DOCK_BORDA, borderColor: CORES_SYMBIUS.borda,
    shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  item: { height: ITEM_H, borderRadius: ITEM_H / 2, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  capsula: { backgroundColor: CORES_SYMBIUS.verdeEscuro, borderRadius: ITEM_H / 2 },
  icone: { width: ICONE, height: ICONE },
  label: { fontSize: 13, fontFamily: F.bold, color: CORES_SYMBIUS.creme },
  medidor: { position: 'absolute', left: 0, bottom: 0, width: 200, opacity: 0, zIndex: -1 },
});
