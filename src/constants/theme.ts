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
  // Mesmo verde-carvão da paleta Symbius escura (constants/coresSymbius.ts)
  azulEscuro:  '#F4F1E8',
  azulMedio:   '#A9BFAE',
  rosa:        '#3F8A5C',
  amarelo:     '#E8A33D',

  fundo:       '#0F1F16',
  branco:      '#16281C',
  cinzaClaro:  '#26402F',
  cinzaInput:  '#1F3527',

  textoSec:    '#A9BFAE',
  preto:       '#F4F1E8',

  verde:       '#5CBF60',
  vermelho:    '#e74c3c',
  roxo:        '#a569d8',
  laranja:     '#E8A33D',
  azulCeu:     '#6AA8D6',
} as const;

// ─── Tipo exportado ───────────────────────────────────────────────────
// Widening pra string: o objetivo é descrever o FORMATO da paleta
// (quais chaves existem), não travar nos valores exatos da paleta clara.
// Sem isso, CORES_DARK (que tem os mesmos hex só que diferentes) não
// seria aceito como um "Tema" válido.
export type Tema = { [K in keyof typeof CORES]: string };

// ─── Helper ───────────────────────────────────────────────────────────
/** Retorna a paleta correta baseado em modoEscuro. */
export const getTheme = (modoEscuro: boolean): Tema =>
  modoEscuro ? CORES_DARK : CORES;