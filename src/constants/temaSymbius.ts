import { Tema } from './theme';
import { CORES_SYMBIUS } from './coresSymbius';
import { Animal } from '../utils/gamification';

export { CORES_SYMBIUS };

// ── Tema "Symbius" no formato Tema (mesmas chaves de CORES/CORES_DARK) ──
// Permite "sombrear" localmente `cores`/`CORES`/`modoEscuro` em telas já
// existentes (Match, Perfil) sem tocar em nenhuma linha de lógica:
// a tela continua lendo C.fundo, C.azulEscuro, CORES.rosa etc. normalmente,
// só que agora esses tokens resolvem pra paleta clara do Symbius.
//
export const TEMA_SYMBIUS: Tema = {
  azulEscuro:  CORES_SYMBIUS.texto,        // texto principal
  azulMedio:   CORES_SYMBIUS.verdeEscuro,  // variação / secundário do primário
  rosa:        CORES_SYMBIUS.verdeEscuro,  // acento / destaque principal (era rosa, agora verde)
  amarelo:     CORES_SYMBIUS.laranja,      // acento secundário

  fundo:       CORES_SYMBIUS.fundo,
  branco:      CORES_SYMBIUS.fundoCard,
  cinzaClaro:  CORES_SYMBIUS.borda,
  cinzaInput:  CORES_SYMBIUS.fundoSuave,

  textoSec:    CORES_SYMBIUS.textoSec,
  preto:       CORES_SYMBIUS.texto,

  // Semânticas
  verde:       '#4CAF50',
  vermelho:    '#e74c3c',
  roxo:        '#a569d8',
  laranja:     CORES_SYMBIUS.laranja,
  azulCeu:     CORES_SYMBIUS.azul,
};

// ── Gradientes radiais de "subiu de nível", um por animal ──────────────
// Extraídos pixel-a-pixel do mockup (radial-gradient(circle at 50% 35%, c1, c2 75%)).
export const NIVEL_GRADIENTE: Record<Animal, {
  c1: string;
  c2: string;
  glow: string;      // cor do brilho atrás do animal
  labelTopo: string;  // "Novo nível alcançado!"
  subtitulo: string;  // "Nível N"
  citacaoCor: string;
  botaoTexto: string; // cor do texto do botão "Continuar" (fundo é sempre creme)
  citacao: string;
}> = {
  // cada fundo parte da cor do próprio animal
  tubarao: {
    c1: '#2F78AA', c2: '#08213A', glow: 'rgba(110,185,235,0.5)',
    labelTopo: '#E3F1FB', subtitulo: '#A9CFE8', citacaoCor: '#D4E8F5', botaoTexto: '#08213A',
    citacao: 'Quem lidera com força, inspira com exemplo.',
  },
  leopardo: {
    c1: '#C28A1E', c2: '#2E1F06', glow: 'rgba(255,200,80,0.55)',
    labelTopo: '#FBF0D6', subtitulo: '#E8CE8E', citacaoCor: '#F3E3B8', botaoTexto: '#2E1F06',
    citacao: 'Agilidade é saber a hora certa de agir.',
  },
  gaviao: {
    c1: '#8C5A33', c2: '#2A180C', glow: 'rgba(230,165,95,0.5)',
    labelTopo: '#F6E8D8', subtitulo: '#DDBF9C', citacaoCor: '#EBD5B8', botaoTexto: '#2A180C',
    citacao: 'A precisão é o começo da confiança.',
  },
  raposa: {
    c1: '#CC5A1E', c2: '#3A1507', glow: 'rgba(255,135,60,0.55)',
    labelTopo: '#FCE9DC', subtitulo: '#F0B995', citacaoCor: '#F7D9C4', botaoTexto: '#3A1507',
    citacao: 'Esperteza abre caminhos que a força não vê.',
  },
  coruja: {
    c1: '#6F6B5C', c2: '#1D1C17', glow: 'rgba(210,200,160,0.45)',
    labelTopo: '#F0ECDD', subtitulo: '#CFC8B0', citacaoCor: '#E3DDC8', botaoTexto: '#1D1C17',
    citacao: 'Sabedoria começa com a primeira pergunta.',
  },
};

// ── Cor de fundo pastel do avatar de cada animal nas listas de ranking ──
export const NIVEL_AVATAR_BG: Record<Animal, string> = {
  tubarao:  '#DCEAF2',
  leopardo: '#F3E4CE',
  gaviao:   '#F0DCC7',
  raposa:   '#F3DCC9',
  coruja:   '#F0EEE6',
};

// ── Emoji de cada animal (usado nos avatares/badges) ────────────────────
export const NIVEL_EMOJI: Record<Animal, string> = {
  tubarao: '🦈',
  leopardo: '🐆',
  gaviao: '🦅',
  raposa: '🦊',
  coruja: '🦉',
};

// ── Nº do nível exibido no modal de "subiu de nível" (1 = Coruja … 5 = Tubarão) ──
export const NIVEL_NUMERO: Record<Animal, number> = {
  coruja: 1, raposa: 2, gaviao: 3, leopardo: 4, tubarao: 5,
};

// ── LevelUpInfo (gamificationService) só traz `nomeAnimal` em português
// acentuado ("Gavião", "Tubarão") — esse helper resolve de volta pra chave
// `Animal` ('gaviao', 'tubarao'...) usada nas tabelas acima. ──
export const animalPorNome = (nome: string): Animal => {
  const norm = (nome || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() as Animal;
  const validos: Animal[] = ['coruja', 'raposa', 'gaviao', 'leopardo', 'tubarao'];
  return validos.includes(norm) ? norm : 'coruja';
};
