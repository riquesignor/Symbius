// Paleta "Symbius". As telas leem CORES_SYMBIUS dentro de StyleSheet.create no
// carregamento do módulo, então a troca claro/escuro acontece ANTES das telas
// serem importadas (ver index.ts) e é aplicada mutando este objeto. Trocar o
// tema em tempo de execução exige reiniciar o JS (ver utils/reiniciarApp.ts).

const CLARO = {
  fundo:             '#FAF9F5',
  fundoCard:         '#FFFFFF',
  fundoSuave:        '#F0EEE6', // pills, busca, bolha recebida, caixas de ícone
  fundoLaranjaClaro: '#FCEFE3',

  verdeEscuro: '#1F3D2B', // botões primários, tab ativa, bolha enviada
  verdeMedio:  '#2E5B3F',

  creme: '#F4F1E8', // texto/ícone sobre fundo verde

  texto:          '#1A1A1A',
  textoSec:       '#7C8177',
  textoTerciario: '#9AA398',
  textoMuted:     '#8A8F84',

  borda:  '#ECE9DE',
  borda2: '#E3E0D6',

  laranja:      '#E8A33D',
  laranjaTexto: '#B4682A',
  azul:         '#4A90C2',
  sucesso:      '#4CAF50',
  pontoInativo: '#DDD9CC',

  // splash (Boasvindas) — verde escuro sempre
  splashBg:       '#1F3D2B',
  splashDecor1:   '#264D33',
  splashDecor2:   '#2E5B3F',
  splashTexto:    '#F4F1E8',
  splashTextoSec: '#B9C9B4',

  // cards de destaque verde-mata (ranking, etc.)
  heroiFundo:    '#16301F',
  heroiElevado:  '#24472E',
  heroiTexto:    '#F0EAD8',
  heroiTextoSec: '#8FD4A0',
  folha:         '#52A86A',

  barStyle: 'dark-content' as 'dark-content' | 'light-content',
};

// Extensão escura do verde da marca (em vez de cinza/preto neutro). O verde
// primário fica mais claro que no modo claro porque também é usado como cor
// de texto (logo, links) e precisa de contraste sobre o fundo escuro.
const ESCURO: typeof CLARO = {
  fundo:             '#0D1F13', // floresta
  fundoCard:         '#16281C',
  fundoSuave:        '#1F3527',
  fundoLaranjaClaro: '#3A2B1C',

  verdeEscuro: '#3F8A5C',
  verdeMedio:  '#2E6B45',

  creme: '#F4F1E8',

  texto:          '#F4F1E8',
  textoSec:       '#A9BFAE',
  textoTerciario: '#7F9886',
  textoMuted:     '#8FA596',

  borda:  '#26402F',
  borda2: '#2F4D39',

  laranja:      '#E8A33D',
  laranjaTexto: '#F0B070',
  azul:         '#6AA8D6',
  sucesso:      '#5CBF60',
  pontoInativo: '#35503E',

  splashBg:       '#1F3D2B',
  splashDecor1:   '#264D33',
  splashDecor2:   '#2E5B3F',
  splashTexto:    '#F4F1E8',
  splashTextoSec: '#B9C9B4',

  heroiFundo:    '#1A3A22',
  heroiElevado:  '#264D31',
  heroiTexto:    '#F0EAD8',
  heroiTextoSec: '#8FD4A0',
  folha:         '#52A86A',

  barStyle: 'light-content',
};

export const CORES_SYMBIUS = { ...CLARO };

// Mantido pelas telas que já importavam os tokens escuros diretamente.
export const CORES_SYMBIUS_DARK = {
  fundo:      ESCURO.fundo,
  fundoCard:  ESCURO.fundoCard,
  fundoSuave: ESCURO.fundoSuave,
  texto:      ESCURO.texto,
  textoSec:   ESCURO.textoSec,
};

export let modoEscuroAtivo = false;

export const aplicarPaleta = (escuro: boolean) => {
  Object.assign(CORES_SYMBIUS, escuro ? ESCURO : CLARO);
  modoEscuroAtivo = escuro;
};
