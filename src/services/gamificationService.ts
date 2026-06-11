/**
 * Service de Gamificação
 * Lida com triggers, validações e atualizações de XP/Moedas
 */

import { db } from '../config/firebaseConfig';
import { doc, updateDoc, getDoc, increment, serverTimestamp } from 'firebase/firestore';
import {
  GAMIFICATION_CONFIG,
  podeGanharXpMatch,
  verificarResetDiario,
} from '../utils/gamification';

/**
 * Awarded XP quando um match é concluído com avaliação 5⭐
 * @param meuUid - UID do usuário logado
 * @returns Promise com sucesso ou erro
 */
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

/**
 * Award XP daily check-in
 * @param meuUid - UID do usuário logado
 * @returns Promise com sucesso ou erro
 */
export const awardDailyCheckIn = async (meuUid: string): Promise<boolean> => {
  try {
    if (!meuUid) throw new Error('UID não fornecido');

    const userRef = doc(db, 'usuarios', meuUid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) throw new Error('Usuário não encontrado');

    const userData = userSnap.data();
    const ultimoAcesso = userData?.ultimo_acesso;

    // ─ Verificar se já recebeu hoje ─
    const hoje = new Date();
    const dataUltimoAcesso = ultimoAcesso?.toDate ? ultimoAcesso.toDate() : new Date(ultimoAcesso);

    hoje.setHours(0, 0, 0, 0);
    dataUltimoAcesso.setHours(0, 0, 0, 0);

    if (hoje.getTime() === dataUltimoAcesso.getTime()) {
      console.warn('⚠️ Daily check-in já resgatado hoje');
      return false;
    }

    // ─ Award XP e Moedas ─
    const xpGanho = GAMIFICATION_CONFIG.DAILY_CHECKIN.xp;
    const moedasGanhas = GAMIFICATION_CONFIG.DAILY_CHECKIN.moedas;

    await updateDoc(userRef, {
      xp_total: increment(xpGanho),
      moedas_saldo: increment(moedasGanhas),
      ultimo_acesso: serverTimestamp(),
    });

    console.log(`✅ Daily Check-in! +${xpGanho} XP, +${moedasGanhas} Moedas!`);
    return true;
  } catch (error) {
    console.error('❌ Erro ao award daily check-in:', error);
    return false;
  }
};

/**
 * Award XP quando uma resposta no fórum recebe upvote ou selo de resolução
 * @param meuUid - UID do usuário logado
 * @param foiValidada - true se a resposta recebeu upvote ou selo de resolução
 * @returns Promise com sucesso ou erro
 */
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

/**
 * Award XP quando o aluno pede ajuda e finaliza uma dúvida
 * @param meuUid - UID do usuário logado
 * @returns Promise com sucesso ou erro
 */
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

/**
 * Comprar cosmético (gasta Moedas)
 * @param meuUid - UID do usuário
 * @param idCosmetico - ID do cosmético
 * @param precoCosmetico - Preço em Moedas
 * @returns Promise com sucesso ou erro
 */
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

/**
 * Equipar cosmético (mostrar no mascote)
 * @param meuUid - UID do usuário
 * @param idCosmetico - ID do cosmético
 * @returns Promise com sucesso ou erro
 */
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
