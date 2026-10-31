import {
  doc, getDoc, runTransaction, serverTimestamp, arrayUnion, writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { dispararPush } from './pushNotificationsService';
import { Grupo, MAX_MEMBROS_GRUPO } from './gruposService';

// ══════════════════════════════════════════════════════════════════════
// Convite para grupo com consentimento. Um documento por pessoa convidada:
// `convites_grupo/{alvoUid}`. Como o id é o próprio alvo, nunca existem dois
// convites pendentes pra mesma pessoa — e as Security Rules recusam
// sobrescrever um convite que ainda está pendente.
// ══════════════════════════════════════════════════════════════════════

export const COLECAO_CONVITES = 'convites_grupo';

export type StatusConvite = 'pendente' | 'aceito' | 'recusado';

export interface ConviteGrupo {
  alvoUid: string;
  grupoId: string;
  grupoNome: string;
  deUid: string;
  deNome: string;
  status: StatusConvite;
  criadoEm?: any;
}

export class ConviteIndisponivel extends Error {}

export const enviarConviteGrupo = async (
  grupo: Pick<Grupo, 'id' | 'nome' | 'membros' | 'banidos'>,
  de: { uid: string; nome: string },
  alvoUid: string,
): Promise<void> => {
  if (grupo.membros.includes(alvoUid)) throw new ConviteIndisponivel('Essa pessoa já está no grupo.');
  if ((grupo.banidos || []).includes(alvoUid)) throw new ConviteIndisponivel('Essa pessoa foi banida deste grupo.');

  const ref = doc(db, COLECAO_CONVITES, alvoUid);
  await runTransaction(db, async tx => {
    const atual = await tx.get(ref);
    if (atual.exists() && atual.data()?.status === 'pendente') {
      throw new ConviteIndisponivel('Essa pessoa já tem um convite pendente. Tente de novo quando ela responder.');
    }
    tx.set(ref, {
      alvoUid, grupoId: grupo.id, grupoNome: grupo.nome,
      deUid: de.uid, deNome: de.nome,
      status: 'pendente', criadoEm: serverTimestamp(), respondidoEm: null,
    });
  });

  // `conviteGrupoId` e não `grupoId`: o backend exige que o destinatário de
  // um push com grupoId já seja membro, e o convidado ainda não é.
  dispararPush({
    destinatarioUid: alvoUid,
    titulo: 'Convite para grupo de estudo',
    corpo: `${de.nome} te convidou para "${grupo.nome}"`,
    dados: { tipo: 'convite_grupo', conviteGrupoId: grupo.id, grupoNome: grupo.nome },
  });
};

export const responderConviteGrupo = async (
  eu: { uid: string; nome: string; foto: string | null },
  aceitar: boolean,
): Promise<{ grupoId: string | null }> => {
  const conviteRef = doc(db, COLECAO_CONVITES, eu.uid);
  const conviteSnap = await getDoc(conviteRef);
  const convite = conviteSnap.data() as ConviteGrupo | undefined;
  if (!convite || convite.status !== 'pendente') return { grupoId: null };

  const resposta = { status: aceitar ? 'aceito' : 'recusado', respondidoEm: serverTimestamp() };
  if (!aceitar) {
    const lote = writeBatch(db);
    lote.update(conviteRef, resposta);
    await lote.commit();
    return { grupoId: null };
  }

  const grupoRef = doc(db, 'conversas', convite.grupoId);
  const grupoSnap = await getDoc(grupoRef);
  const grupo = grupoSnap.data() as Grupo | undefined;
  if (!grupo) {
    const lote = writeBatch(db);
    lote.update(conviteRef, { status: 'recusado', respondidoEm: serverTimestamp() });
    await lote.commit();
    throw new ConviteIndisponivel('Este grupo não existe mais.');
  }
  if ((grupo.banidos || []).includes(eu.uid)) throw new ConviteIndisponivel('Você não pode entrar neste grupo.');
  if (!grupo.membros.includes(eu.uid) && grupo.membros.length >= MAX_MEMBROS_GRUPO) {
    throw new ConviteIndisponivel(`O grupo já está cheio (${MAX_MEMBROS_GRUPO} pessoas).`);
  }

  // Convite e entrada no mesmo lote: as regras conferem que existia um convite
  // pendente pra este grupo antes de deixar a pessoa se adicionar.
  const lote = writeBatch(db);
  lote.update(grupoRef, {
    membros: arrayUnion(eu.uid),
    [`dadosMembros.${eu.uid}`]: { nome: eu.nome, foto: eu.foto },
    ultimaMensagem: `${eu.nome.split(' ')[0]} entrou no grupo`,
    quemEnviou: eu.uid,
    data_postagem: serverTimestamp(),
  });
  lote.update(conviteRef, resposta);
  await lote.commit();

  dispararPush({
    destinatarioUid: convite.deUid,
    titulo: grupo.nome,
    corpo: `${eu.nome.split(' ')[0]} aceitou o convite e entrou no grupo`,
    dados: { tipo: 'mensagem_grupo', grupoId: convite.grupoId, grupoNome: grupo.nome },
  });
  return { grupoId: convite.grupoId };
};
