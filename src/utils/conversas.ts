import {
  doc, getDoc, updateDoc, serverTimestamp, collection, query, where, getDocs, writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

// ══════════════════════════════════════════════════════════════════════
// Leitura e ocultação de conversas (1:1 e grupos), tudo dentro do próprio
// documento `conversas/{id}`:
//   leitura.{uid}  -> quando cada participante leu pela última vez
//   ocultaEm.{uid} -> quando cada participante "apagou" a conversa pra si
// Mensagem nova depois desses horários volta a contar como não lida / reaparece.
// ══════════════════════════════════════════════════════════════════════

// Timestamp do Firestore -> ms. `padrao` cobre o serverTimestamp ainda pendente
// (null no cache local logo após escrever).
export const msDe = (t: any, padrao = 0): number => {
  if (!t) return padrao;
  if (typeof t === 'number') return t;
  if (typeof t.toMillis === 'function') return t.toMillis();
  if (typeof t.seconds === 'number') return t.seconds * 1000;
  return padrao;
};

// Última mensagem é de outra pessoa e saiu depois da minha última leitura.
export const conversaNaoLida = (conversa: any, uid?: string | null): boolean => {
  if (!conversa || !uid || !conversa.quemEnviou || conversa.quemEnviou === uid) return false;
  return msDe(conversa.data_postagem, Date.now()) > msDe(conversa.leitura?.[uid]);
};

// Uma mensagem minha foi lida pelo outro se ele leu depois que ela foi enviada.
export const mensagemLidaPor = (conversa: any, outroUid: string, dataMensagem: any): boolean =>
  msDe(conversa?.leitura?.[outroUid]) >= msDe(dataMensagem, Date.now());

export const ocultaParaMim = (conversa: any, uid?: string | null): boolean => {
  if (!conversa || !uid || !conversa.ocultaEm?.[uid]) return false;
  return msDe(conversa.data_postagem, Date.now()) <= msDe(conversa.ocultaEm[uid]);
};

export const marcarComoLida = async (conversaId: string, uid: string) => {
  try {
    await updateDoc(doc(db, 'conversas', conversaId), {
      [`leitura.${uid}`]: serverTimestamp(),
      visto: true,
    });
  } catch (e) {
    console.log('Erro ao marcar conversa como lida:', e);
  }
};

// "Apagar conversa": some da minha lista e do meu histórico. Se todos os
// participantes já apagaram, remove de vez do banco (mensagens são base64 e
// pesam no Firestore).
export const apagarConversaParaMim = async (conversaId: string, uid: string): Promise<void> => {
  const ref = doc(db, 'conversas', conversaId);
  await updateDoc(ref, { [`ocultaEm.${uid}`]: serverTimestamp() });

  const snap = await getDoc(ref);
  const dados: any = snap.data();
  const membros: string[] = dados?.membros || [];
  const todosApagaram = membros.length > 0 && membros.every(m => !!dados?.ocultaEm?.[m]);
  if (!todosApagaram) return;

  const msgs = await getDocs(query(collection(db, 'mensagens'), where('conversaId', '==', conversaId)));
  for (let i = 0; i < msgs.docs.length; i += 400) {
    const lote = writeBatch(db);
    msgs.docs.slice(i, i + 400).forEach(d => lote.delete(d.ref));
    await lote.commit();
  }
  // Mantém o documento da conversa (sem mensagens) pra não perder o histórico do
  // match/XP; só zera o que aparece.
  await updateDoc(ref, { ultimaMensagem: '' });
};
