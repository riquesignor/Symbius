/**
 * theme.ts — fonte única de verdade para fontes e cores do JUMO
 *
 * Para trocar o tema visual do app inteiro, edite apenas este arquivo.
 * Todas as telas importam F, CORES e CORES_DARK daqui.
 *
 * Estrutura:
 *   F          — famílias de fonte (Poppins ou qualquer outra)
 *   CORES      — paleta de cores no modo claro
 *   CORES_DARK — paleta de cores no modo escuro
 *   getTheme   — helper que retorna a paleta certa dado modoEscuro
 */

// ─── Famílias de fonte ────────────────────────────────────────────────
export const F = {
  regular:  'Poppins_400Regular',
  medium:   'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold:     'Poppins_700Bold',
  black:    'Poppins_800ExtraBold',
} as const;

// ─── Paleta — modo claro ──────────────────────────────────────────────
export const CORES = {
  // Primários
  azulEscuro:  '#0B2046',   // cor de texto principal e header
  azulMedio:   '#1B3868',   // variação mais clara do primário
  rosa:        '#E51C6A',   // acento / destaque
  amarelo:     '#FFC82C',   // acento secundário

  // Superfícies
  fundo:       '#F5F7FA',   // background da tela
  branco:      '#FFFFFF',   // cards, inputs
  cinzaClaro:  '#EAEFF4',   // bordas, divisórias
  cinzaInput:  '#F0F4F8',   // fundo de input

  // Texto
  textoSec:    '#8D99AE',   // texto secundário / placeholder
  preto:       '#1A1A2E',   // texto em componentes que usam cor fixa

  // Semânticas
  verde:       '#27ae60',
  vermelho:    '#e74c3c',
  roxo:        '#8e44ad',
  laranja:     '#e67e22',
  azulCeu:     '#3498db',
} as const;

// ─── Paleta — modo escuro ─────────────────────────────────────────────
export const CORES_DARK = {
  // Primários
  azulEscuro:  '#FFFFFF',   // texto principal vira branco
  azulMedio:   '#E0E0E0',
  rosa:        '#FF5C97',   // acento mais vibrante no escuro
  amarelo:     '#FFC82C',

  // Superfícies
  fundo:       '#0F1419',
  branco:      '#1A1F26',   // cards ficam escuros
  cinzaClaro:  '#2A2F36',   // bordas escuras
  cinzaInput:  '#1E2530',

  // Texto
  textoSec:    '#7A8595',
  preto:       '#FFFFFF',

  // Semânticas (mantidas iguais para não perder legibilidade)
  verde:       '#27ae60',
  vermelho:    '#e74c3c',
  roxo:        '#a569d8',
  laranja:     '#e67e22',
  azulCeu:     '#3498db',
} as const;

// ─── Tipo exportado ───────────────────────────────────────────────────
export type Tema = typeof CORES;

// ─── Helper ───────────────────────────────────────────────────────────
/** Retorna a paleta correta baseado em modoEscuro. */
export const getTheme = (modoEscuro: boolean): Tema =>
  modoEscuro ? CORES_DARK : CORES;
