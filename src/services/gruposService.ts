import {
  doc, getDoc, setDoc, updateDoc, addDoc, collection,
  arrayRemove, arrayUnion, serverTimestamp, deleteField,
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { dispararPush } from './pushNotificationsService';
import { msDe } from '../utils/conversas';

// ══════════════════════════════════════════════════════════════════════
// Grupo de estudo = um documento em `conversas` com isGrupo: true. Mesmas
// coleções do chat 1:1 (`conversas` + `mensagens` por conversaId), então o
// listener de notificações (membros array-contains) já enxerga os grupos.
// Matches entram direto; quem não é match entra por convite (convitesService).
// As permissões abaixo são repetidas em firestore.rules — a interface só
// esconde o que o servidor recusaria.
// ══════════════════════════════════════════════════════════════════════

export interface MembroInfo { nome: string; foto: string | null }

export interface Grupo {
  id: string;
  nome: string;
  materia?: string;
  descricao?: string;
  foto?: string | null;
  membros: string[];
  admins?: string[];
  banidos?: string[];
  dadosMembros: Record<string, MembroInfo>;
  criadoPor: string;
  ultimaMensagem?: string;
  quemEnviou?: string;
  data_postagem?: any;
}

export const MAX_MEMBROS_GRUPO = 8;
export const MAX_DESCRICAO_GRUPO = 200;
export const JANELA_APAGAR_PARA_TODOS_MS = 30 * 60 * 1000;

const novoId = () => `grupo_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const perfilBasico = async (uid: string): Promise<MembroInfo> => {
  const snap = await getDoc(doc(db, 'usuarios', uid));
  const d: any = snap.exists() ? snap.data() : {};
  return { nome: d.nome_completo || 'Usuário', foto: d.foto || null };
};

const primeiroNome = (nome: string) => (nome || 'Alguém').split(' ')[0];

// Grupos criados antes do campo `admins` têm o criador como admin. Se nenhum
// admin ainda é membro, o grupo está "sem dono" (ver repararAdminDoGrupo).
export const adminsDoGrupo = (g: Pick<Grupo, 'admins' | 'criadoPor' | 'membros'>): string[] =>
  (g.admins ?? [g.criadoPor]).filter(uid => g.membros.includes(uid));

export const souAdminDoGrupo = (g: Grupo | null, uid?: string | null): boolean =>
  !!g && !!uid && adminsDoGrupo(g).includes(uid);

const registrarEvento = (texto: string, autorUid: string) => ({
  ultimaMensagem: texto.slice(0, 140),
  quemEnviou: autorUid,
  data_postagem: serverTimestamp(),
});

export const criarGrupo = async (params: {
  criadorUid: string; nome: string; materia?: string; descricao?: string; membrosUids: string[];
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
    descricao: params.descricao?.trim().slice(0, MAX_DESCRICAO_GRUPO) || '',
    foto: null,
    membros,
    admins: [params.criadorUid],
    banidos: [],
    dadosMembros,
    criadoPor: params.criadorUid,
    criadoEm: serverTimestamp(),
    ...registrarEvento(`${primeiroNome(criador)} criou o grupo`, params.criadorUid),
  });

  membros.filter(u => u !== params.criadorUid).forEach(uid => dispararPush({
    destinatarioUid: uid,
    titulo: 'Novo grupo de estudo',
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
  const nome1 = primeiroNome(remetente.nome);
  await updateDoc(doc(db, 'conversas', grupo.id), registrarEvento(`${nome1}: ${resumo}`, remetente.uid));
  grupo.membros.filter(u => u !== remetente.uid).forEach(uid => dispararPush({
    destinatarioUid: uid,
    titulo: grupo.nome,
    corpo: `${nome1}: ${resumo}`.slice(0, 200),
    dados: { tipo: 'mensagem_grupo', grupoId: grupo.id, grupoNome: grupo.nome },
  }));
};

// ─ Sair: se eu era o único admin e ainda sobra gente, o membro mais antigo
// vira admin — o grupo nunca fica sem admin. ─
export const sairDoGrupo = async (grupo: Grupo, uid: string, nome: string) => {
  const restantes = grupo.membros.filter(m => m !== uid);
  let admins = adminsDoGrupo(grupo).filter(a => a !== uid);
  if (admins.length === 0 && restantes.length > 0) admins = [restantes[0]];
  await updateDoc(doc(db, 'conversas', grupo.id), {
    membros: arrayRemove(uid),
    admins,
    [`dadosMembros.${uid}`]: deleteField(),
    ...registrarEvento(`${primeiroNome(nome)} saiu do grupo`, uid),
  });
};

// Grupo antigo cujo criador já saiu: o membro mais antigo assume como admin.
export const repararAdminDoGrupo = async (grupo: Grupo, uid: string) => {
  if (adminsDoGrupo(grupo).length > 0 || grupo.membros[0] !== uid) return;
  await updateDoc(doc(db, 'conversas', grupo.id), { admins: [uid] });
};

// ─ Ações de admin ─────────────────────────────────────────────────────
export const atualizarInfoGrupo = async (grupo: Grupo, autorUid: string, autorNome: string, dados: {
  nome?: string; descricao?: string; foto?: string | null;
}) => {
  const patch: Record<string, any> = {};
  if (dados.nome !== undefined && dados.nome.trim()) patch.nome = dados.nome.trim().slice(0, 40);
  if (dados.descricao !== undefined) patch.descricao = dados.descricao.trim().slice(0, MAX_DESCRICAO_GRUPO);
  if (dados.foto !== undefined) patch.foto = dados.foto;
  if (Object.keys(patch).length === 0) return;
  await updateDoc(doc(db, 'conversas', grupo.id), {
    ...patch,
    ...registrarEvento(`${primeiroNome(autorNome)} atualizou o grupo`, autorUid),
  });
};

// Só matches do admin entram direto; os demais recebem convite.
export const adicionarMembros = async (grupo: Grupo, autor: { uid: string; nome: string }, uids: string[]) => {
  const banidos = grupo.banidos || [];
  const novos = uids.filter(u => !grupo.membros.includes(u) && !banidos.includes(u))
    .slice(0, Math.max(0, MAX_MEMBROS_GRUPO - grupo.membros.length));
  if (novos.length === 0) return 0;
  const infos = await Promise.all(novos.map(perfilBasico));
  const patch: Record<string, any> = { membros: arrayUnion(...novos) };
  novos.forEach((uid, i) => { patch[`dadosMembros.${uid}`] = infos[i]; });
  const nomes = infos.map(i => primeiroNome(i.nome)).join(', ');
  await updateDoc(doc(db, 'conversas', grupo.id), {
    ...patch,
    ...registrarEvento(`${primeiroNome(autor.nome)} adicionou ${nomes}`, autor.uid),
  });
  novos.forEach(uid => dispararPush({
    destinatarioUid: uid,
    titulo: 'Novo grupo de estudo',
    corpo: `${autor.nome} te adicionou em "${grupo.nome}"`,
    dados: { tipo: 'grupo_adicionado', grupoId: grupo.id, grupoNome: grupo.nome },
  }));
  return novos.length;
};

export const removerMembro = async (grupo: Grupo, autor: { uid: string; nome: string }, alvoUid: string, banir: boolean) => {
  if (alvoUid === autor.uid) throw new Error('Use "Sair do grupo" para sair.');
  const alvoNome = primeiroNome(grupo.dadosMembros?.[alvoUid]?.nome || 'Alguém');
  await updateDoc(doc(db, 'conversas', grupo.id), {
    membros: arrayRemove(alvoUid),
    admins: adminsDoGrupo(grupo).filter(a => a !== alvoUid),
    ...(banir ? { banidos: arrayUnion(alvoUid) } : {}),
    [`dadosMembros.${alvoUid}`]: deleteField(),
    ...registrarEvento(`${primeiroNome(autor.nome)} ${banir ? 'baniu' : 'removeu'} ${alvoNome}`, autor.uid),
  });
};

export const desbanirMembro = async (grupo: Grupo, alvoUid: string) => {
  await updateDoc(doc(db, 'conversas', grupo.id), { banidos: arrayRemove(alvoUid) });
};

export const promoverAdmin = async (grupo: Grupo, autor: { uid: string; nome: string }, alvoUid: string) => {
  const alvoNome = primeiroNome(grupo.dadosMembros?.[alvoUid]?.nome || 'Alguém');
  await updateDoc(doc(db, 'conversas', grupo.id), {
    admins: [...adminsDoGrupo(grupo), alvoUid].filter((u, i, a) => a.indexOf(u) === i),
    ...registrarEvento(`${primeiroNome(autor.nome)} tornou ${alvoNome} admin`, autor.uid),
  });
};

// ─ Mensagens: editar e apagar ─────────────────────────────────────────
export const podeApagarParaTodos = (msg: any, uid?: string | null, agora = Date.now()) =>
  !!uid && msg?.remetenteUid === uid && !msg?.apagadaParaTodos
  && agora - msDe(msg?.data_postagem, agora) < JANELA_APAGAR_PARA_TODOS_MS;

export const editarMensagemGrupo = async (mensagemId: string, texto: string) => {
  const t = texto.trim();
  if (!t) return;
  await updateDoc(doc(db, 'mensagens', mensagemId), { mensagem: t, editada: true, editadaEm: serverTimestamp() });
};

export const apagarMensagemParaMim = async (mensagemId: string, uid: string) => {
  await updateDoc(doc(db, 'mensagens', mensagemId), { ocultaPara: arrayUnion(uid) });
};

export const apagarMensagemParaTodos = async (grupo: Grupo, msg: any, uid: string, eraUltima: boolean) => {
  if (!podeApagarParaTodos(msg, uid)) throw new Error('O prazo de 30 minutos para apagar para todos já passou.');
  await updateDoc(doc(db, 'mensagens', msg.id), {
    apagadaParaTodos: true, mensagem: '', tipo: 'apagada', apagadaEm: serverTimestamp(),
  });
  if (eraUltima) {
    await updateDoc(doc(db, 'conversas', grupo.id), { ultimaMensagem: '🚫 Mensagem apagada' }).catch(() => {});
  }
};
