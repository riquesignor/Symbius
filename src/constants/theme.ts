// ─── Famílias de fonte ────────────────────────────────────────────────
// TESTE de fonte: com USAR_JAKARTA = true o app inteiro usa Plus Jakarta Sans.
// Para voltar à Poppins, basta trocar para false (o App.tsx carrega as duas).
export const USAR_JAKARTA = true;

const POPPINS = {
  regular:  'Poppins_400Regular',
  medium:   'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold:     'Poppins_700Bold',
  black:    'Poppins_800ExtraBold',
} as const;

const JAKARTA = {
  regular:  'PlusJakartaSans_400Regular',
  medium:   'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold:     'PlusJakartaSans_700Bold',
  black:    'PlusJakartaSans_800ExtraBold',
} as const;

export const F: { [K in keyof typeof POPPINS]: string } = USAR_JAKARTA ? JAKARTA : POPPINS;

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

  fundo:       '#0D1F13',
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