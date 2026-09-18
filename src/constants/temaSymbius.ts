import { Tema } from './theme';
import { CORES_SYMBIUS } from '../screens/Boasvindas';
import { Animal } from '../utils/gamification';

export { CORES_SYMBIUS };

// ── Tema "Symbius" no formato Tema (mesmas chaves de CORES/CORES_DARK) ──
// Permite "sombrear" localmente `cores`/`CORES`/`modoEscuro` em telas já
// existentes (Match, Perfil) sem tocar em nenhuma linha de lógica:
// a tela continua lendo C.fundo, C.azulEscuro, CORES.rosa etc. normalmente,
// só que agora esses tokens resolvem pra paleta clara do Symbius.
//
// ⚠️ Modo claro apenas. O modo escuro do Symbius ainda não tem paleta definida
// (o usuário vai enviar depois) — não inventar valores aqui.
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
  glow: string;      // cor do drop-shadow atrás do emoji
  labelTopo: string;  // "Novo nível alcançado!"
  subtitulo: string;  // "Nível N"
  citacaoCor: string;
  botaoTexto: string; // cor do texto do botão "Continuar" (fundo é sempre creme)
  citacao: string;
}> = {
  tubarao: {
    c1: '#7A5A2E', c2: '#2E1E10', glow: 'rgba(255,180,80,0.5)',
    labelTopo: '#F4E8D8', subtitulo: '#D8C4A6', citacaoCor: '#E8D9C2', botaoTexto: '#2E1E10',
    citacao: 'Quem lidera com força, inspira com exemplo.',
  },
  leopardo: {
    c1: '#6E5A2E', c2: '#26200F', glow: 'rgba(230,190,80,0.5)',
    labelTopo: '#F1EAD8', subtitulo: '#D6CBA6', citacaoCor: '#E6DEC2', botaoTexto: '#26200F',
    citacao: 'Agilidade é saber a hora certa de agir.',
  },
  gaviao: {
    c1: '#B4762E', c2: '#3A2410', glow: 'rgba(255,170,80,0.55)',
    labelTopo: '#F7E7CE', subtitulo: '#E0C6A0', citacaoCor: '#F0DDBC', botaoTexto: '#3A2410',
    citacao: 'A precisão é o começo da confiança.',
  },
  raposa: {
    c1: '#A85A2E', c2: '#331F10', glow: 'rgba(255,140,60,0.5)',
    labelTopo: '#F6E4D2', subtitulo: '#DEC1A2', citacaoCor: '#EED7BC', botaoTexto: '#331F10',
    citacao: 'Esperteza abre caminhos que a força não vê.',
  },
  coruja: {
    c1: '#4A5A3E', c2: '#1C2416', glow: 'rgba(150,190,120,0.5)',
    labelTopo: '#E4EDD8', subtitulo: '#C2CFA6', citacaoCor: '#D9E4C2', botaoTexto: '#1C2416',
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
