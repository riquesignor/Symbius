import { db } from '../config/firebaseConfig';
import {
  collection, query, orderBy, limit, getDocs, onSnapshot, addDoc,
  doc, setDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove, increment, serverTimestamp,
  runTransaction,
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
  descurtidas?: string[];   // uids de quem marcou "não curti"
  descurtidasCount?: number;
  comentariosCount?: number;
  // Anexo opcional (PDF/DOCX em base64 — mesmos campos já usados no Firestore)
  arquivoNome?: string;
  arquivoBase64?: string;
  arquivoTipo?: string;
  arquivoTamanho?: number;
  criadoEm: any;            // Firestore Timestamp
  privado?: boolean;        // se true, só aparece pro próprio autor no feed
}

const COLECAO = 'resumos';

// ── Criar um resumo novo ────────────────────────────────────────────
export interface AnexoResumo { nome: string; base64: string; tipo: string; tamanho: number }

export const criarResumo = async (dados: {
  autorUid: string; autorNome: string; autorFoto?: string | null;
  materia: string; titulo: string; corpo: string; anexo?: AnexoResumo | null;
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
      descurtidas: [],
      descurtidasCount: 0,
      comentariosCount: 0,
      privado: false,
      criadoEm: serverTimestamp(),
      ...(dados.anexo ? {
        arquivoNome: dados.anexo.nome,
        arquivoBase64: dados.anexo.base64,
        arquivoTipo: dados.anexo.tipo,
        arquivoTamanho: dados.anexo.tamanho,
      } : {}),
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

// ── Curtir / não curtir (uma exclui a outra) ─────────────────────────
// Transação pra os contadores não descolarem das listas com cliques rápidos.
export type Reacao = 'curtir' | 'descurtir';

export const reagirResumo = async (resumoId: string, uid: string, reacao: Reacao): Promise<'adicionou' | 'removeu' | null> => {
  try {
    return await runTransaction(db, async (tx) => {
      const ref = doc(db, COLECAO, resumoId);
      const snap = await tx.get(ref);
      if (!snap.exists()) return null;
      const r = snap.data() as any;
      const curtidas: string[] = r.curtidas || [];
      const descurtidas: string[] = r.descurtidas || [];
      const alvo = reacao === 'curtir' ? curtidas : descurtidas;
      const oposta = reacao === 'curtir' ? descurtidas : curtidas;

      const jaTinha = alvo.includes(uid);
      const novoAlvo = jaTinha ? alvo.filter(u => u !== uid) : [...alvo, uid];
      const novaOposta = oposta.filter(u => u !== uid);
      const novasCurtidas = reacao === 'curtir' ? novoAlvo : novaOposta;
      const novasDescurtidas = reacao === 'curtir' ? novaOposta : novoAlvo;

      tx.update(ref, {
        curtidas: novasCurtidas,
        curtidasCount: novasCurtidas.length,
        descurtidas: novasDescurtidas,
        descurtidasCount: novasDescurtidas.length,
      });
      return jaTinha ? 'removeu' : 'adicionou';
    });
  } catch (e) {
    console.error('Erro ao reagir ao resumo:', e);
    return null;
  }
};

// Mantido pra quem ainda chama a API antiga.
export const alternarCurtidaResumo = async (resumoId: string, uid: string, _jaCurtiu: boolean): Promise<boolean> =>
  (await reagirResumo(resumoId, uid, 'curtir')) !== null;

// ── Comentários (subcoleção resumos/{id}/comentarios) ────────────────
export interface Comentario {
  id: string;
  autorUid: string;
  autorNome: string;
  autorFoto: string | null;
  texto: string;
  criadoEm: any;
}

export const ouvirComentarios = (resumoId: string, aoMudar: (lista: Comentario[]) => void) =>
  onSnapshot(
    query(collection(db, COLECAO, resumoId, 'comentarios'), orderBy('criadoEm', 'asc')),
    snap => aoMudar(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))),
    e => console.error('Erro ao ouvir comentários:', e),
  );

export const comentarResumo = async (resumoId: string, dados: {
  autorUid: string; autorNome: string; autorFoto: string | null; texto: string;
}): Promise<boolean> => {
  try {
    const texto = dados.texto.trim();
    if (!texto) return false;
    await addDoc(collection(db, COLECAO, resumoId, 'comentarios'), {
      ...dados, texto: texto.slice(0, 1000), criadoEm: serverTimestamp(),
    });
    await updateDoc(doc(db, COLECAO, resumoId), { comentariosCount: increment(1) });
    return true;
  } catch (e) {
    console.error('Erro ao comentar:', e);
    return false;
  }
};

export const apagarComentario = async (resumoId: string, comentarioId: string): Promise<boolean> => {
  try {
    await deleteDoc(doc(db, COLECAO, resumoId, 'comentarios', comentarioId));
    await updateDoc(doc(db, COLECAO, resumoId), { comentariosCount: increment(-1) });
    return true;
  } catch (e) {
    console.error('Erro ao apagar comentário:', e);
    return false;
  }
};
