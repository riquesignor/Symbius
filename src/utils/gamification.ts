/**
 * Utils de Gamificação
 * Funções helper para cálculos e validações de XP/Moedas
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
};

// ─ Validação: pode ganhar XP por match hoje? ─
export const podeGanharXpMatch = (
  matchesBonificadosHoje: number = 0
): boolean => {
  return matchesBonificadosHoje < GAMIFICATION_CONFIG.MATCH_CONCLUIDO.maxPorDia;
};

// ─ Reset de contador diário (meia-noite) ─
export const verificarResetDiario = (
  ultimoReset: any
): boolean => {
  if (!ultimoReset) return true;

  const data = ultimoReset.toDate ? ultimoReset.toDate() : new Date(ultimoReset);
  const hoje = new Date();

  data.setHours(0, 0, 0, 0);
  hoje.setHours(0, 0, 0, 0);

  return data.getTime() !== hoje.getTime();
};

// ─ Calcular fases da Coruja (MVP) ─
export const NIVEIS_CORUJA = {
  filhote: { min: 0, max: 299, label: 'Filhote', icone: '🐣' },
  jovem: { min: 300, max: 749, label: 'Jovem', icone: '🐥' },
  adulto: { min: 750, max: 1499, label: 'Adulto', icone: '🦉' },
  veterano: { min: 1500, max: Infinity, label: 'Veterano', icone: '👑' },
};

export const calcularFaseCoruja = (
  xp: number
): { fase: keyof typeof NIVEIS_CORUJA; label: string; icone: string; xpMinimo: number; xpMaximo: number } => {
  let faseAtual: keyof typeof NIVEIS_CORUJA = 'filhote';

  for (const [fase, config] of Object.entries(NIVEIS_CORUJA)) {
    if (xp >= config.min && xp <= config.max) {
      faseAtual = fase as keyof typeof NIVEIS_CORUJA;
      break;
    }
  }

  const config = NIVEIS_CORUJA[faseAtual];
  return {
    fase: faseAtual,
    label: config.label,
    icone: config.icone,
    xpMinimo: config.min,
    xpMaximo: config.max === Infinity ? xp + 500 : config.max,
  };
};

// ─ Calcular progresso até próximo nível ─
export const calcularProgressoXp = (xp: number): { percentual: number; faltam: number } => {
  const faseAtual = calcularFaseCoruja(xp);
  const xpNoNivel = xp - faseAtual.xpMinimo;
  const xpTotalNivel = faseAtual.xpMaximo - faseAtual.xpMinimo + 1;

  return {
    percentual: Math.min(100, (xpNoNivel / xpTotalNivel) * 100),
    faltam: Math.max(0, faseAtual.xpMaximo - xp + 1),
  };
};

// ─ Formatação de números para exibição ─
export const formatarNumero = (num: number): string => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

// ─ Mensagem de ganho de XP ─
export const mensagemGanhoXp = (xp: number, moedas: number): string => {
  return `+${xp} XP, +${moedas} Sementes 🌱`;
};
