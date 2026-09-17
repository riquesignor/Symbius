import { db } from '../config/firebaseConfig';
import { doc, updateDoc, getDoc, increment, serverTimestamp, arrayUnion } from 'firebase/firestore';
import {
  GAMIFICATION_CONFIG,
  podeGanharXpMatch,
  verificarResetDiario,
  calcularNivel,
} from '../utils/gamification';


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

// ─ Resultado genérico de premiação de XP (match / pedir ajuda) ─
export interface AwardResult {
  sucesso: boolean;        // false = não pôde premiar (limite diário, erro, etc.)
  xp:      number;
  moedas:  number;
  levelUp: LevelUpInfo | null;
}

// ─ Detecta level-up comparando XP antes/depois e monta o resultado ─
const construirAwardResult = (xpAntes: number, xpGanho: number, moedasGanhas: number): AwardResult => {
  const nivelAntes  = calcularNivel(xpAntes);
  const nivelDepois = calcularNivel(xpAntes + xpGanho);
  const subiu = nivelDepois.animal !== nivelAntes.animal || nivelDepois.subfase !== nivelAntes.subfase;
  return {
    sucesso: true,
    xp: xpGanho,
    moedas: moedasGanhas,
    levelUp: subiu
      ? { nomeAnimal: nivelDepois.nomeAnimal, iconeAnimal: nivelDepois.iconeAnimal,
          nomeSubfase: nivelDepois.nomeSubfase, iconeSubfase: nivelDepois.iconeSubfase,
          conceitoRank: nivelDepois.conceitoRank }
      : null,
  };
};

const AWARD_FALHA: AwardResult = { sucesso: false, xp: 0, moedas: 0, levelUp: null };

// ─ Match de Estudos Concluído (Avaliação 5) — +50 XP / +15 Sementes, máx. 3/dia ─
export const awardXpMatch = async (meuUid: string): Promise<AwardResult> => {
  try {
    if (!meuUid) throw new Error('UID não fornecido');

    const userRef = doc(db, 'usuarios', meuUid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) throw new Error('Usuário não encontrado');

    const userData = userSnap.data();
    const matchesBonificadosHoje = userData?.matches_bonificados_hoje || 0;
    const ultimoReset = userData?.ultimo_reset_diario;
    const xpAtual = (userData?.xp_total as number) || 0;

    // ─ Verificar se passou da meia-noite (reset diário) ─
    const deveReset = verificarResetDiario(ultimoReset);
    const matchesHoje = deveReset ? 0 : matchesBonificadosHoje;

    // ─ Validar limite diário ─
    if (!podeGanharXpMatch(matchesHoje)) {
      console.warn('⚠️ Limite de 3 matches bonificados atingido hoje');
      return AWARD_FALHA;
    }

    const xpGanho = GAMIFICATION_CONFIG.MATCH_CONCLUIDO.xp;
    const moedasGanhas = GAMIFICATION_CONFIG.MATCH_CONCLUIDO.moedas;

    await updateDoc(userRef, {
      xp_total: increment(xpGanho),
      moedas_saldo: increment(moedasGanhas),
      matches_bonificados_hoje: deveReset ? 1 : increment(1),
      ultimo_reset_diario: deveReset ? serverTimestamp() : ultimoReset,
    });

    console.log(`✅ +${xpGanho} XP, +${moedasGanhas} Moedas!`);
    return construirAwardResult(xpAtual, xpGanho, moedasGanhas);
  } catch (error) {
    console.error('❌ Erro ao award XP:', error);
    return AWARD_FALHA;
  }
};


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


export const awardXpPedirAjuda = async (meuUid: string): Promise<AwardResult> => {
  try {
    if (!meuUid) throw new Error('UID não fornecido');

    const userRef = doc(db, 'usuarios', meuUid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) throw new Error('Usuário não encontrado');

    const xpAtual = (userSnap.data()?.xp_total as number) || 0;
    const xpGanho = GAMIFICATION_CONFIG.PEDIR_AJUDA.xp;
    const moedasGanhas = GAMIFICATION_CONFIG.PEDIR_AJUDA.moedas;

    await updateDoc(userRef, {
      xp_total: increment(xpGanho),
      moedas_saldo: increment(moedasGanhas),
    });

    console.log(`✅ Dúvida finalizada! +${xpGanho} XP, +${moedasGanhas} Moedas!`);
    return construirAwardResult(xpAtual, xpGanho, moedasGanhas);
  } catch (error) {
    console.error('❌ Erro ao award XP de pedir ajuda:', error);
    return AWARD_FALHA;
  }
};


// ─ Resultado do "Finalizar Match" revisado: aluno avalia o professor ─
export interface FinalizarMatchResult {
  aluno: AwardResult;
  professor: AwardResult;
}

// ─ Aluno avalia o professor ao finalizar o match ──────────────────
// entendeu=true  → estrelas deve ser 4 ou 5 (dúvida resolvida)
// entendeu=false → estrelas deve ser 0 a 3 (dúvida não resolvida)
export const awardXpFinalizarMatch = async (
  alunoUid: string,
  professorUid: string,
  entendeu: boolean,
  estrelas: number,
  comentarioPrivado?: string
): Promise<FinalizarMatchResult> => {
  try {
    if (!alunoUid || !professorUid) throw new Error('UIDs inválidos');
    const nota = Math.max(0, Math.min(5, Math.round(estrelas)));

    const alunoRef = doc(db, 'usuarios', alunoUid);
    const profRef  = doc(db, 'usuarios', professorUid);
    const [alunoSnap, profSnap] = await Promise.all([getDoc(alunoRef), getDoc(profRef)]);
    if (!alunoSnap.exists() || !profSnap.exists()) throw new Error('Usuário não encontrado');

    const alunoData = alunoSnap.data();
    const profData  = profSnap.data();

    // ── Professor: recompensa proporcional à nota + histórico de avaliações ──
    const tierProfessor = GAMIFICATION_CONFIG.FINALIZAR_MATCH_PROFESSOR[nota];
    const xpProfessorAtual = (profData?.xp_total as number) || 0;

    const contagemAnterior = (profData?.avaliacao_contagem as number) || 0;
    const mediaAnterior    = (profData?.avaliacao_media as number) || 0;
    const novaContagem = contagemAnterior + 1;
    const novaMedia    = (mediaAnterior * contagemAnterior + nota) / novaContagem;

    const profUpdates: any = {
      avaliacao_contagem: novaContagem,
      avaliacao_media: novaMedia,
      avaliacoes_recebidas: arrayUnion({
        estrelas: nota,
        comentario: comentarioPrivado || null,
        deUid: alunoUid,
        data: new Date().toISOString(), // serverTimestamp() não é suportado dentro de arrayUnion
      }),
    };
    if (tierProfessor.xp > 0)     profUpdates.xp_total     = increment(tierProfessor.xp);
    if (tierProfessor.moedas > 0) profUpdates.moedas_saldo = increment(tierProfessor.moedas);

    await updateDoc(profRef, profUpdates);
    const resultadoProfessor = construirAwardResult(xpProfessorAtual, tierProfessor.xp, tierProfessor.moedas);

    // ── Aluno: só ganha se a dúvida foi resolvida, com limite diário ──
    let resultadoAluno: AwardResult = AWARD_FALHA;
    if (entendeu) {
      const matchesBonificadosHoje = alunoData?.matches_bonificados_hoje || 0;
      const ultimoReset = alunoData?.ultimo_reset_diario;
      const deveReset = verificarResetDiario(ultimoReset);
      const matchesHoje = deveReset ? 0 : matchesBonificadosHoje;

      if (podeGanharXpMatch(matchesHoje)) {
        const xpAluno = GAMIFICATION_CONFIG.FINALIZAR_MATCH_ALUNO.xp;
        const moedasAluno = GAMIFICATION_CONFIG.FINALIZAR_MATCH_ALUNO.moedas;
        const xpAlunoAtual = (alunoData?.xp_total as number) || 0;

        await updateDoc(alunoRef, {
          xp_total: increment(xpAluno),
          moedas_saldo: increment(moedasAluno),
          matches_bonificados_hoje: deveReset ? 1 : increment(1),
          ultimo_reset_diario: deveReset ? serverTimestamp() : ultimoReset,
        });
        resultadoAluno = construirAwardResult(xpAlunoAtual, xpAluno, moedasAluno);
      } else {
        console.warn('⚠️ Limite de 3 matches bonificados atingido hoje (aluno)');
      }
    }

    return { aluno: resultadoAluno, professor: resultadoProfessor };
  } catch (error) {
    console.error('❌ Erro ao finalizar match:', error);
    return { aluno: AWARD_FALHA, professor: AWARD_FALHA };
  }
};

// ─ Decaimento por inatividade ──────────────────────────────────
// Roda no boot do app (AppSettingsContext). Compara 'ultimo_acesso'
// (marcado sempre que o usuário fica offline) com 'ultimo_decaimento_check'
// pra saber a partir de quando ainda não descontamos nada — assim,
// mesmo rodando em todo login, nunca desconta o mesmo dia duas vezes.
export interface DecaimentoResult {
  aplicado: boolean;
  xpPerdido: number;
  diasInativo: number;
}

export const aplicarDecaimentoInatividade = async (meuUid: string): Promise<DecaimentoResult> => {
  const nada: DecaimentoResult = { aplicado: false, xpPerdido: 0, diasInativo: 0 };
  try {
    if (!meuUid) return nada;
    const userRef = doc(db, 'usuarios', meuUid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) return nada;
    const data = snap.data();

    const ultimoAcessoSeg     = data?.ultimo_acesso?.seconds ?? null;
    const ultimoCheckSeg      = data?.ultimo_decaimento_check?.seconds ?? null;
    if (ultimoAcessoSeg === null) {
      // Primeira vez que vemos esse usuário — nada pra decair ainda.
      await updateDoc(userRef, { ultimo_decaimento_check: serverTimestamp() });
      return nada;
    }

    // Ponto de referência: o mais recente entre "última vez visto" e
    // "última vez que já conferimos decaimento" — evita descontar de novo
    // um período que já foi processado numa sessão anterior.
    const referenciaSeg = Math.max(ultimoAcessoSeg, ultimoCheckSeg ?? 0);
    const agoraSeg = Date.now() / 1000;
    const diasInativo = Math.floor((agoraSeg - referenciaSeg) / 86400);

    const { diasCarencia, xpPorDia, pisoMinimo } = GAMIFICATION_CONFIG.DECAIMENTO_INATIVIDADE;

    if (diasInativo <= diasCarencia) {
      await updateDoc(userRef, { ultimo_decaimento_check: serverTimestamp() });
      return { ...nada, diasInativo };
    }

    const diasParaDecair = diasInativo - diasCarencia;
    const xpAtual   = (data?.xp_total as number) || 0;
    const xpPerdido = Math.min(xpAtual - pisoMinimo, diasParaDecair * Math.abs(xpPorDia));
    const xpNovo    = Math.max(pisoMinimo, xpAtual - xpPerdido);

    await updateDoc(userRef, {
      xp_total: xpNovo,
      ultimo_decaimento_check: serverTimestamp(),
    });

    return { aplicado: xpPerdido > 0, xpPerdido, diasInativo };
  } catch (error) {
    console.error('❌ Erro ao aplicar decaimento por inatividade:', error);
    return nada;
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
  categoria: 'chapeu' | 'acessorio' | 'moldura',
  idCosmetico: string | null
): Promise<boolean> => {
  try {
    if (!meuUid) throw new Error('UID não fornecido');

    const userRef = doc(db, 'usuarios', meuUid);
    await updateDoc(userRef, {
      [`cosmeticos_equipados.${categoria}`]: idCosmetico,
    });

    console.log(idCosmetico ? '✅ Cosmético equipado!' : '✅ Cosmético removido!');
    return true;
  } catch (error) {
    console.error('❌ Erro ao equipar cosmético:', error);
    return false;
  }
};