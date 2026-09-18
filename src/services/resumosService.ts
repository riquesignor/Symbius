import { db } from '../config/firebaseConfig';
import {
  collection, addDoc, query, orderBy, limit, getDocs,
  doc, updateDoc, arrayUnion, arrayRemove, increment, serverTimestamp,
} from 'firebase/firestore';

// ══════════════════════════════════════════════════════════════════════
// Feed de Resumos — feature nova (tela "Sabé" não tinha equivalente real
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
}

const COLECAO = 'resumos';

// ── Criar um resumo novo ────────────────────────────────────────────
export const criarResumo = async (dados: {
  autorUid: string; autorNome: string; autorFoto?: string | null;
  materia: string; titulo: string; corpo: string;
}): Promise<boolean> => {
  try {
    if (!dados.autorUid || !dados.titulo.trim() || !dados.corpo.trim()) return false;
    await addDoc(collection(db, COLECAO), {
      autorUid: dados.autorUid,
      autorNome: dados.autorNome || 'Anônimo',
      autorFoto: dados.autorFoto || null,
      materia: dados.materia.trim() || 'Geral',
      titulo: dados.titulo.trim(),
      corpo: dados.corpo.trim(),
      curtidas: [],
      curtidasCount: 0,
      criadoEm: serverTimestamp(),
    });
    return true;
  } catch (e) {
    console.error('Erro ao criar resumo:', e);
    return false;
  }
};

// ── Buscar resumos (recentes ou mais populares) ─────────────────────
export const buscarResumos = async (ordenacao: 'recentes' | 'populares', max = 30): Promise<Resumo[]> => {
  try {
    const q = ordenacao === 'recentes'
      ? query(collection(db, COLECAO), orderBy('criadoEm', 'desc'), limit(max))
      : query(collection(db, COLECAO), orderBy('curtidasCount', 'desc'), limit(max));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Resumo[];
  } catch (e) {
    console.error('Erro ao buscar resumos:', e);
    return [];
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
