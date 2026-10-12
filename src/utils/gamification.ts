/**
 * Utils de Gamificação
 * Sistema completo: 5 animais × 4 subfases = 20 estágios
 * Baseado em: Especificação de Gamificação e Identidade Visual - TCC V2
 */

// ─ Configuração de pontuação ─
export const GAMIFICATION_CONFIG = {
  MATCH_CONCLUIDO: {
    xp: 50,
    moedas: 15,
    maxPorDia: 3,
  },
  RESPOSTA_FORUM: {
    xp: 30,
    moedas: 5,
  },
  DAILY_CHECKIN: {
    xp: 10,
    moedas: 10,
  },
  PEDIR_AJUDA: {
    xp: 10,
    moedas: 5,
  },
  DECAIMENTO_INATIVIDADE: {
    xpPorDia: -20,
    diasCarencia: 5,
    diasAteDecair: 6,
    pisoMinimo: 0,
  },

  // ─ Finalizar Match (revisado): aluno avalia o professor ─
  // Dúvida resolvida (4 ou 5 estrelas) → aluno ganha o mesmo valor nos dois casos.
  FINALIZAR_MATCH_ALUNO: { xp: 30, moedas: 10, maxPorDia: 3 },

  // Professor: recompensa proporcional à nota recebida do aluno.
  FINALIZAR_MATCH_PROFESSOR: {
    5: { xp: 60, moedas: 25 }, // perfeito
    4: { xp: 45, moedas: 18 }, // bom, mas não perfeito
    3: { xp: 25, moedas: 10 }, // não resolveu, mas explicou bem
    2: { xp: 12, moedas: 5 },
    1: { xp: 5,  moedas: 2 },
    0: { xp: 0,  moedas: 0 },
  } as Record<number, { xp: number; moedas: number }>,
};

// ─ Sistema de animais conforme o documento ─
// Cada animal tem 4 subfases com XP dividido igualmente dentro do range.
//
// Coruja:   0 – 300    (75 XP/subfase)
// Raposa:   301 – 1200 (225 XP/subfase)
// Gavião:   1201 – 3500 (575 XP/subfase)
// Leopardo: 3501 – 8000 (1125 XP/subfase)
// Tubarão:  8001+       (subfases de 1500 XP)

export type Animal = 'coruja' | 'raposa' | 'gaviao' | 'leopardo' | 'tubarao';
export type Subfase = 'filhote' | 'jovem' | 'adulto' | 'veterano';

export interface NivelInfo {
  animal: Animal;
  subfase: Subfase;
  nomeAnimal: string;
  nomeSubfase: string;
  iconeAnimal: string;
  iconeSubfase: string;
  xpMinimo: number;
  xpMaximo: number;
  conceitoRank: string;
}

// Ranges de XP por animal (conforme doc)
const ANIMAL_RANGES: Record<Animal, { min: number; max: number; nome: string; icone: string; conceito: string }> = {
  coruja:   { min: 0,    max: 300,      nome: 'Coruja',   icone: '🦉', conceito: 'Busca pelo saber, observação silenciosa e absorção de conteúdo.' },
  raposa:   { min: 301,  max: 1200,     nome: 'Raposa',   icone: '🦊', conceito: 'Estratégia de estudo, malícia acadêmica.' },
  gaviao:   { min: 1201, max: 3500,     nome: 'Gavião',   icone: '🦅', conceito: 'Precisão cirúrgica para sanar dúvidas.' },
  leopardo: { min: 3501, max: 8000,     nome: 'Leopardo', icone: '🐆', conceito: 'Agilidade e rapidez mental, foco dinâmico.' },
  tubarao:  { min: 8001, max: Infinity, nome: 'Tubarão',  icone: '🦈', conceito: 'Domínio absoluto do ecossistema estudantil.' },
};

const SUBFASE_CONFIG: Record<Subfase, { nome: string; icone: string }> = {
  filhote:  { nome: 'Filhote',  icone: '🐣' },
  jovem:    { nome: 'Jovem',    icone: '🌱' },
  adulto:   { nome: 'Adulto',   icone: '⭐' },
  veterano: { nome: 'Veterano', icone: '👑' },
};

const SUBFASES_ORDER: Subfase[] = ['filhote', 'jovem', 'adulto', 'veterano'];
export const ANIMAIS_ORDER: Animal[]   = ['coruja', 'raposa', 'gaviao', 'leopardo', 'tubarao'];

// Calcula os limites de XP de cada subfase dentro de um animal
const getSubfaseLimits = (animal: Animal, subfase: Subfase): { min: number; max: number } => {
  const range = ANIMAL_RANGES[animal];
  const totalXp = range.max === Infinity ? range.min + 6000 - 1 : range.max; // Tubarão: 4 subfases de 1500
  const xpPorSubfase = Math.floor((totalXp - range.min + 1) / 4);
  const subfaseIdx = SUBFASES_ORDER.indexOf(subfase);

  const min = range.min + subfaseIdx * xpPorSubfase;
  const max = subfaseIdx === 3
    ? (range.max === Infinity ? Infinity : range.max)
    : range.min + (subfaseIdx + 1) * xpPorSubfase - 1;

  return { min, max };
};

// ─ Calcula o nível atual baseado no XP total ─
export const calcularNivel = (xp: number): NivelInfo => {
  // Encontra o animal
  let animalAtual: Animal = 'coruja';
  for (const animal of ANIMAIS_ORDER) {
    const range = ANIMAL_RANGES[animal];
    if (xp >= range.min && (range.max === Infinity || xp <= range.max)) {
      animalAtual = animal;
      break;
    }
  }

  // Encontra a subfase dentro do animal
  let subfaseAtual: Subfase = 'filhote';
  for (const subfase of SUBFASES_ORDER) {
    const limits = getSubfaseLimits(animalAtual, subfase);
    if (xp >= limits.min && (limits.max === Infinity || xp <= limits.max)) {
      subfaseAtual = subfase;
      break;
    }
  }

  const animalConfig  = ANIMAL_RANGES[animalAtual];
  const subfaseConfig = SUBFASE_CONFIG[subfaseAtual];
  const limits        = getSubfaseLimits(animalAtual, subfaseAtual);

  return {
    animal:       animalAtual,
    subfase:      subfaseAtual,
    nomeAnimal:   animalConfig.nome,
    nomeSubfase:  subfaseConfig.nome,
    iconeAnimal:  animalConfig.icone,
    iconeSubfase: subfaseConfig.icone,
    xpMinimo:     limits.min,
    xpMaximo:     limits.max === Infinity ? xp + 1500 : limits.max,
    conceitoRank: animalConfig.conceito,
  };
};

// ─ Progresso até a próxima subfase ─
export const calcularProgressoXp = (xp: number): { percentual: number; faltam: number } => {
  const nivel      = calcularNivel(xp);
  const xpNoNivel  = xp - nivel.xpMinimo;
  const xpTotal    = nivel.xpMaximo - nivel.xpMinimo + 1;

  return {
    percentual: Math.min(100, (xpNoNivel / xpTotal) * 100),
    faltam:     Math.max(0, nivel.xpMaximo - xp + 1),
  };
};

// ─ Compatibilidade retroativa — alias para quem importava calcularFaseCoruja ─
export const calcularFaseCoruja = (xp: number) => {
  const n = calcularNivel(xp);
  return {
    fase:      n.subfase as any,
    label:     `${n.nomeAnimal} ${n.nomeSubfase}`,
    icone:     n.iconeAnimal,
    xpMinimo:  n.xpMinimo,
    xpMaximo:  n.xpMaximo,
  };
};

// ─ Legado: mantido pra não quebrar imports no Perfil.tsx ─
export const NIVEIS_CORUJA = {
  filhote:  { min: 0,   max: 74,  label: 'Coruja Filhote',  icone: '🦉' },
  jovem:    { min: 75,  max: 149, label: 'Coruja Jovem',    icone: '🦉' },
  adulto:   { min: 150, max: 224, label: 'Coruja Adulto',   icone: '🦉' },
  veterano: { min: 225, max: 300, label: 'Coruja Veterano', icone: '🦉' },
};

// ─ Validação: pode ganhar XP por match hoje? ─
export const podeGanharXpMatch = (
  matchesBonificadosHoje: number = 0
): boolean => {
  return matchesBonificadosHoje < GAMIFICATION_CONFIG.MATCH_CONCLUIDO.maxPorDia;
};

// ─ Reset de contador diário (meia-noite) ─
export const verificarResetDiario = (ultimoReset: any): boolean => {
  if (!ultimoReset) return true;

  const data = ultimoReset.toDate ? ultimoReset.toDate() : new Date(ultimoReset);
  const hoje = new Date();

  data.setHours(0, 0, 0, 0);
  hoje.setHours(0, 0, 0, 0);

  return data.getTime() !== hoje.getTime();
};

// ─ Formatação de números para exibição ─
export const formatarNumero = (num: number): string => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000)    return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

// ─ Mensagem de ganho de XP ─
export const mensagemGanhoXp = (xp: number, moedas: number): string => {
  return `+${xp} XP, +${moedas} Sementes 🌱`;
};

// ─ Verifica se o usuário já alcançou pelo menos um certo animal ─
// (usado pra liberar itens de prestígio na loja de cosméticos)
export const atingiuAnimal = (xp: number, animalMinimo: Animal): boolean => {
  const atual = calcularNivel(xp).animal;
  return ANIMAIS_ORDER.indexOf(atual) >= ANIMAIS_ORDER.indexOf(animalMinimo);
};