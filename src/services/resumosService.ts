import { db } from '../config/firebaseConfig';
import {
  collection, query, orderBy, limit, getDocs,
  doc, setDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove, increment, serverTimestamp,
} from 'firebase/firestore';
import { gerarIdLegivel } from '../utils/firestoreIds';

// ══════════════════════════════════════════════════════════════════════
// Feed de Resumos — feature nova (tela "Symbius" não tinha equivalente real
// no back-end; a rota 'Resumos' só existia quebrada no Index legado).
// Collection própria no Firestore: `resumos`.
// ══════════════════════════════════════════════════════════════════════

export interface Resumo {
  id: string;
  autorUid: string;
  autorNome: string;
  autorFoto: string | null;
  materia: string;
  titulo: string;
  corpo: string;
  curtidas: string[];       // uids de quem curtiu
  curtidasCount: number;
  criadoEm: any;            // Firestore Timestamp
  privado?: boolean;        // se true, só aparece pro próprio autor no feed
}

const COLECAO = 'resumos';

// ── Criar um resumo novo ────────────────────────────────────────────
export const criarResumo = async (dados: {
  autorUid: string; autorNome: string; autorFoto?: string | null;
  materia: string; titulo: string; corpo: string;
}): Promise<boolean> => {
  try {
    if (!dados.autorUid || !dados.titulo.trim() || !dados.corpo.trim()) return false;
    // ID legível (slug do título + sufixo curto) em vez do ID aleatório do
    // addDoc — facilita identificar o documento direto na lista do Firestore.
    const id = gerarIdLegivel(dados.titulo);
    await setDoc(doc(db, COLECAO, id), {
      autorUid: dados.autorUid,
      autorNome: dados.autorNome || 'Anônimo',
      autorFoto: dados.autorFoto || null,
      materia: dados.materia.trim() || 'Geral',
      titulo: dados.titulo.trim(),
      corpo: dados.corpo.trim(),
      curtidas: [],
      curtidasCount: 0,
      privado: false,
      criadoEm: serverTimestamp(),
    });
    return true;
  } catch (e) {
    console.error('Erro ao criar resumo:', e);
    return false;
  }
};

// ── Buscar resumos (recentes ou mais populares) ─────────────────────
// Resumos marcados como `privado` só voltam pra quem é o próprio autor
// (uidAtual) — filtrado no cliente pra não depender de índice composto.
export const buscarResumos = async (
  ordenacao: 'recentes' | 'populares',
  max = 30,
  uidAtual?: string | null,
): Promise<Resumo[]> => {
  try {
    const q = ordenacao === 'recentes'
      ? query(collection(db, COLECAO), orderBy('criadoEm', 'desc'), limit(max))
      : query(collection(db, COLECAO), orderBy('curtidasCount', 'desc'), limit(max));
    const snap = await getDocs(q);
    const lista = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Resumo[];
    return lista.filter(r => !r.privado || r.autorUid === uidAtual);
  } catch (e) {
    console.error('Erro ao buscar resumos:', e);
    return [];
  }
};

// ── Editar um resumo existente (só quem é o autor deve poder chamar) ──
export const editarResumo = async (resumoId: string, dados: {
  materia: string; titulo: string; corpo: string;
}): Promise<boolean> => {
  try {
    if (!dados.titulo.trim() || !dados.corpo.trim()) return false;
    const ref = doc(db, COLECAO, resumoId);
    await updateDoc(ref, {
      materia: dados.materia.trim() || 'Geral',
      titulo: dados.titulo.trim(),
      corpo: dados.corpo.trim(),
    });
    return true;
  } catch (e) {
    console.error('Erro ao editar resumo:', e);
    return false;
  }
};

// ── Apagar um resumo (só quem é o autor deve poder chamar) ───────────
export const apagarResumo = async (resumoId: string): Promise<boolean> => {
  try {
    await deleteDoc(doc(db, COLECAO, resumoId));
    return true;
  } catch (e) {
    console.error('Erro ao apagar resumo:', e);
    return false;
  }
};

// ── Tornar um resumo privado (só o autor vê) ou público novamente ────
export const alternarPrivacidadeResumo = async (resumoId: string, privadoAtual: boolean): Promise<boolean> => {
  try {
    const ref = doc(db, COLECAO, resumoId);
    await updateDoc(ref, { privado: !privadoAtual });
    return true;
  } catch (e) {
    console.error('Erro ao alterar privacidade do resumo:', e);
    return false;
  }
};

// ── Curtir / descurtir ───────────────────────────────────────────────
export const alternarCurtidaResumo = async (resumoId: string, uid: string, jaCurtiu: boolean): Promise<boolean> => {
  try {
    const ref = doc(db, COLECAO, resumoId);
    await updateDoc(ref, {
      curtidas: jaCurtiu ? arrayRemove(uid) : arrayUnion(uid),
      curtidasCount: increment(jaCurtiu ? -1 : 1),
    });
    return true;
  } catch (e) {
    console.error('Erro ao curtir resumo:', e);
    return false;
  }
};
