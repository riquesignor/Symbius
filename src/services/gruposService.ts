import {
  doc, getDoc, setDoc, updateDoc, addDoc, collection,
  arrayRemove, serverTimestamp, deleteField,
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { dispararPush } from './pushNotificationsService';

// ══════════════════════════════════════════════════════════════════════
// Grupo de estudo = um documento em `conversas` com isGrupo: true. Mesmas
// coleções do chat 1:1 (`conversas` + `mensagens` por conversaId), então o
// listener de notificações (membros array-contains) já enxerga os grupos.
// Só dá pra adicionar quem já é seu match.
// ══════════════════════════════════════════════════════════════════════

export interface MembroInfo { nome: string; foto: string | null }

export interface Grupo {
  id: string;
  nome: string;
  materia?: string;
  membros: string[];
  dadosMembros: Record<string, MembroInfo>;
  criadoPor: string;
  ultimaMensagem?: string;
  quemEnviou?: string;
  data_postagem?: any;
}

export const MAX_MEMBROS_GRUPO = 8;

const novoId = () => `grupo_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const perfilBasico = async (uid: string): Promise<MembroInfo> => {
  const snap = await getDoc(doc(db, 'usuarios', uid));
  const d: any = snap.exists() ? snap.data() : {};
  return { nome: d.nome_completo || 'Usuário', foto: d.foto || null };
};

export const criarGrupo = async (params: {
  criadorUid: string; nome: string; materia?: string; membrosUids: string[];
}): Promise<string> => {
  const membros = [params.criadorUid, ...params.membrosUids.filter(u => u !== params.criadorUid)];
  const infos = await Promise.all(membros.map(perfilBasico));
  const dadosMembros: Record<string, MembroInfo> = {};
  membros.forEach((uid, i) => { dadosMembros[uid] = infos[i]; });

  const id = novoId();
  const nome = params.nome.trim();
  const criador = dadosMembros[params.criadorUid].nome;
  await setDoc(doc(db, 'conversas', id), {
    isGrupo: true,
    nome,
    materia: params.materia?.trim() || null,
    membros,
    dadosMembros,
    criadoPor: params.criadorUid,
    criadoEm: serverTimestamp(),
    ultimaMensagem: `${criador.split(' ')[0]} criou o grupo`,
    quemEnviou: params.criadorUid,
    data_postagem: serverTimestamp(),
  });

  membros.filter(u => u !== params.criadorUid).forEach(uid => dispararPush({
    destinatarioUid: uid,
    titulo: '👥 Novo grupo de estudo',
    corpo: `${criador} te adicionou em "${nome}"`,
    dados: { tipo: 'grupo_adicionado', grupoId: id, grupoNome: nome },
  }));
  return id;
};

export const enviarMensagemGrupo = async (grupo: Grupo, remetente: { uid: string; nome: string; foto: string | null }, conteudo: {
  tipo: 'texto' | 'imagem'; mensagem: string;
}) => {
  await addDoc(collection(db, 'mensagens'), {
    conversaId: grupo.id,
    mensagem: conteudo.mensagem,
    tipo: conteudo.tipo,
    remetenteUid: remetente.uid,
    nome_remetente: remetente.nome,
    foto: remetente.foto,
    data_postagem: serverTimestamp(),
  });
  const resumo = conteudo.tipo === 'imagem' ? '📷 Imagem' : conteudo.mensagem;
  const primeiroNome = remetente.nome.split(' ')[0];
  await updateDoc(doc(db, 'conversas', grupo.id), {
    ultimaMensagem: `${primeiroNome}: ${resumo}`.slice(0, 140),
    quemEnviou: remetente.uid,
    data_postagem: serverTimestamp(),
  });
  grupo.membros.filter(u => u !== remetente.uid).forEach(uid => dispararPush({
    destinatarioUid: uid,
    titulo: grupo.nome,
    corpo: `${primeiroNome}: ${resumo}`.slice(0, 200),
    dados: { tipo: 'mensagem_grupo', grupoId: grupo.id, grupoNome: grupo.nome },
  }));
};

export const sairDoGrupo = async (grupo: Grupo, uid: string, nome: string) => {
  await updateDoc(doc(db, 'conversas', grupo.id), {
    membros: arrayRemove(uid),
    [`dadosMembros.${uid}`]: deleteField(),
    ultimaMensagem: `${nome.split(' ')[0]} saiu do grupo`,
    quemEnviou: uid,
    data_postagem: serverTimestamp(),
  });
};
