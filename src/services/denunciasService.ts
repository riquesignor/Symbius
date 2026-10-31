import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

// ══════════════════════════════════════════════════════════════════════
// Denúncia de mensagem (chats individuais e grupos). Só persiste os dados;
// o painel de Admin vai ler a coleção `denuncias` (status 'pendente') depois.
// Id `{mensagemId}_{denuncianteUid}`: a mesma pessoa não denuncia a mesma
// mensagem duas vezes.
// ══════════════════════════════════════════════════════════════════════

export const COLECAO_DENUNCIAS = 'denuncias';

export type StatusDenuncia = 'pendente' | 'em_analise' | 'resolvida' | 'descartada';

export const MOTIVOS_DENUNCIA = [
  'Ofensa ou assédio',
  'Conteúdo impróprio',
  'Spam',
  'Cola ou fraude em atividade',
  'Outro',
] as const;

export const denunciarMensagem = async (params: {
  mensagemId: string;
  conversaId: string;
  denuncianteUid: string;
  autorUid: string;
  tipoConversa: 'individual' | 'grupo';
  motivo: string;
}): Promise<'registrada' | 'ja_denunciada'> => {
  const ref = doc(db, COLECAO_DENUNCIAS, `${params.mensagemId}_${params.denuncianteUid}`);
  const existente = await getDoc(ref).catch(() => null);
  if (existente?.exists()) return 'ja_denunciada';
  await setDoc(ref, {
    mensagemId: params.mensagemId,
    conversaId: params.conversaId,
    denuncianteUid: params.denuncianteUid,
    autorUid: params.autorUid,
    tipoConversa: params.tipoConversa,
    motivo: params.motivo,
    status: 'pendente' as StatusDenuncia,
    criadoEm: serverTimestamp(),
  });
  return 'registrada';
};
