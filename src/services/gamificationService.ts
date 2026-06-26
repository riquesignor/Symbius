

import { db } from '../config/firebaseConfig';
import { doc, updateDoc, getDoc, increment, serverTimestamp } from 'firebase/firestore';
import {
  GAMIFICATION_CONFIG,
  podeGanharXpMatch,
  verificarResetDiario,
  calcularNivel,
} from '../utils/gamification';


export const awardXpMatch = async (meuUid: string): Promise<boolean> => {
  try {
    if (!meuUid) throw new Error('UID não fornecido');

    const userRef = doc(db, 'usuarios', meuUid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) throw new Error('Usuário não encontrado');

    const userData = userSnap.data();
    const matchesBonificadosHoje = userData?.matches_bonificados_hoje || 0;
    const ultimoReset = userData?.ultimo_reset_diario;

    // ─ Verificar se passou da meia-noite (reset diário) ─
    const deveReset = verificarResetDiario(ultimoReset);
    const matchesHoje = deveReset ? 0 : matchesBonificadosHoje;

    // ─ Validar limite diário ─
    if (!podeGanharXpMatch(matchesHoje)) {
      console.warn('⚠️ Limite de 3 matches bonificados atingido hoje');
      return false;
    }

    // ─ Award XP e Moedas ─
    const xpGanho = GAMIFICATION_CONFIG.MATCH_CONCLUIDO.xp;
    const moedasGanhas = GAMIFICATION_CONFIG.MATCH_CONCLUIDO.moedas;

    await updateDoc(userRef, {
      xp_total: increment(xpGanho),
      moedas_saldo: increment(moedasGanhas),
      matches_bonificados_hoje: deveReset ? 1 : increment(1),
      ultimo_reset_diario: deveReset ? serverTimestamp() : ultimoReset,
    });

    console.log(`✅ +${xpGanho} XP, +${moedasGanhas} Moedas!`);
    return true;
  } catch (error) {
    console.error('❌ Erro ao award XP:', error);
    return false;
  }
};

// ─ Helpers de data ──────────────────────────────────────────────────
const hojeStr = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const ontemStr = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export interface LevelUpInfo {
  nomeAnimal:   string;
  iconeAnimal:  string;
  nomeSubfase:  string;
  iconeSubfase: string;
  conceitoRank: string;
}

export interface CheckInResult {
  ganhou:   boolean;       // false = já fez hoje
  streak:   number;        // dias consecutivos (incluindo hoje)
  xp:       number;
  moedas:   number;
  levelUp:  LevelUpInfo | null; // null = sem mudança de nível
}


export const awardDailyCheckIn = async (meuUid: string): Promise<CheckInResult> => {
  const fallback: CheckInResult = { ganhou: false, streak: 0, xp: 0, moedas: 0, levelUp: null };
  try {
    if (!meuUid) return fallback;

    const userRef  = doc(db, 'usuarios', meuUid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return fallback;

    const userData       = userSnap.data();
    const ultimoDia      = userData?.ultimo_checkin_dia as string | undefined;
    const streakAtual    = (userData?.streak_dias as number) || 0;
    const hoje           = hojeStr();
    const ontem          = ontemStr();

    // ─ Já fez check-in hoje ─
    if (ultimoDia === hoje) {
      return { ganhou: false, streak: streakAtual, xp: 0, moedas: 0, levelUp: null };
    }

    // ─ Calcular novo streak ─
    const novoStreak = ultimoDia === ontem ? streakAtual + 1 : 1;

    // ─ Award XP e Moedas ─
    const xpGanho     = GAMIFICATION_CONFIG.DAILY_CHECKIN.xp;
    const moedasGanhas = GAMIFICATION_CONFIG.DAILY_CHECKIN.moedas;
    const xpAtual     = (userData?.xp_total as number) || 0;

    // ─ Detectar level-up ─
    const nivelAntes  = calcularNivel(xpAtual);
    const nivelDepois = calcularNivel(xpAtual + xpGanho);
    const subiu = nivelDepois.animal !== nivelAntes.animal || nivelDepois.subfase !== nivelAntes.subfase;
    const levelUp: LevelUpInfo | null = subiu
      ? { nomeAnimal: nivelDepois.nomeAnimal, iconeAnimal: nivelDepois.iconeAnimal,
          nomeSubfase: nivelDepois.nomeSubfase, iconeSubfase: nivelDepois.iconeSubfase,
          conceitoRank: nivelDepois.conceitoRank }
      : null;

    await updateDoc(userRef, {
      xp_total:           increment(xpGanho),
      moedas_saldo:       increment(moedasGanhas),
      streak_dias:        novoStreak,
      ultimo_checkin_dia: hoje,
    });

    console.log(`✅ Check-in dia ${novoStreak}! +${xpGanho} XP${levelUp ? ' 🎉 LEVEL UP!' : ''}`);
    return { ganhou: true, streak: novoStreak, xp: xpGanho, moedas: moedasGanhas, levelUp };
  } catch (error) {
    console.error('❌ Erro ao award daily check-in:', error);
    return fallback;
  }
};


export const awardXpForum = async (
  meuUid: string,
  foiValidada: boolean
): Promise<boolean> => {
  try {
    if (!meuUid) throw new Error('UID não fornecido');

    // ─ Só bonifica se a resposta foi validada ─
    if (!foiValidada) {
      console.warn('⚠️ Resposta ainda não validada (sem upvote ou selo de resolução)');
      return false;
    }

    const userRef = doc(db, 'usuarios', meuUid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) throw new Error('Usuário não encontrado');

    const xpGanho = GAMIFICATION_CONFIG.RESPOSTA_FORUM.xp;
    const moedasGanhas = GAMIFICATION_CONFIG.RESPOSTA_FORUM.moedas;

    await updateDoc(userRef, {
      xp_total: increment(xpGanho),
      moedas_saldo: increment(moedasGanhas),
    });

    console.log(`✅ Resposta no fórum validada! +${xpGanho} XP, +${moedasGanhas} Moedas!`);
    return true;
  } catch (error) {
    console.error('❌ Erro ao award XP do fórum:', error);
    return false;
  }
};


export const awardXpPedirAjuda = async (meuUid: string): Promise<boolean> => {
  try {
    if (!meuUid) throw new Error('UID não fornecido');

    const userRef = doc(db, 'usuarios', meuUid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) throw new Error('Usuário não encontrado');

    const xpGanho = GAMIFICATION_CONFIG.PEDIR_AJUDA.xp;
    const moedasGanhas = GAMIFICATION_CONFIG.PEDIR_AJUDA.moedas;

    await updateDoc(userRef, {
      xp_total: increment(xpGanho),
      moedas_saldo: increment(moedasGanhas),
    });

    console.log(`✅ Dúvida finalizada! +${xpGanho} XP, +${moedasGanhas} Moedas!`);
    return true;
  } catch (error) {
    console.error('❌ Erro ao award XP de pedir ajuda:', error);
    return false;
  }
};


export const comprarCosmetico = async (
  meuUid: string,
  idCosmetico: string,
  precoCosmetico: number
): Promise<boolean> => {
  try {
    if (!meuUid) throw new Error('UID não fornecido');

    const userRef = doc(db, 'usuarios', meuUid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) throw new Error('Usuário não encontrado');

    const userData = userSnap.data();
    const moedas = userData?.moedas_saldo || 0;

    // ─ Validar moedas suficientes ─
    if (moedas < precoCosmetico) {
      console.warn(`⚠️ Moedas insuficientes. Tem ${moedas}, precisa ${precoCosmetico}`);
      return false;
    }

    // ─ Verificar se já tem ─
    const itensAdquiridos = userData?.itens_adquiridos || [];
    if (itensAdquiridos.includes(idCosmetico)) {
      console.warn('⚠️ Você já possui este cosmético');
      return false;
    }

    // ─ Fazer compra ─
    await updateDoc(userRef, {
      moedas_saldo: increment(-precoCosmetico),
      itens_adquiridos: [...itensAdquiridos, idCosmetico],
    });

    console.log(`✅ Cosmético comprado! -${precoCosmetico} Moedas`);
    return true;
  } catch (error) {
    console.error('❌ Erro ao comprar cosmético:', error);
    return false;
  }
};


export const equiparCosmetico = async (
  meuUid: string,
  idCosmetico: string
): Promise<boolean> => {
  try {
    if (!meuUid) throw new Error('UID não fornecido');

    const userRef = doc(db, 'usuarios', meuUid);
    await updateDoc(userRef, {
      cosmetico_equipado: idCosmetico,
    });

    console.log(`✅ Cosmético equipado!`);
    return true;
  } catch (error) {
    console.error('❌ Erro ao equipar cosmético:', error);
    return false;
  }
};
