import type { VercelRequest, VercelResponse } from '@vercel/node';
import { dbAdmin } from './_lib/firebaseAdmin';
import {
  liberarCors, uidDoToken, permitePush, enviarParaTokens, TIPOS_SO_ADMIN, ehAdmin,
  mensagensNaoLidas, montarBloco, urlFoto,
} from './_lib/push';

// POST /api/enviar-push
// Headers: Authorization: Bearer <firebase-id-token-do-remetente>
// Body: { destinatarioUid, titulo, corpo, dados: { tipo, ... } }
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (liberarCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' });

  const remetenteUid = await uidDoToken(req.headers.authorization);
  if (!remetenteUid) return res.status(401).json({ erro: 'Não autenticado' });

  const { destinatarioUid, titulo, corpo, dados } = req.body || {};
  if (!destinatarioUid || !titulo || !corpo || !dados?.tipo) {
    return res.status(400).json({ erro: 'destinatarioUid, titulo, corpo e dados.tipo são obrigatórios' });
  }
  if (destinatarioUid === remetenteUid) return res.status(200).json({ enviado: false, motivo: 'Destinatário é o próprio remetente' });

  try {
    if (TIPOS_SO_ADMIN.has(dados.tipo)) {
      const remetente = (await dbAdmin.collection('usuarios').doc(remetenteUid).get()).data();
      if (!ehAdmin(remetente)) return res.status(403).json({ erro: 'Apenas administradores' });
    }
    // Mensagem de grupo: os dois precisam ser membros, senão qualquer um
    // mandaria push "em nome" de um grupo do qual não participa.
    if (dados.grupoId) {
      const grupo = (await dbAdmin.collection('conversas').doc(String(dados.grupoId)).get()).data();
      const membros: string[] = grupo?.membros || [];
      if (!grupo?.isGrupo || !membros.includes(remetenteUid) || !membros.includes(destinatarioUid)) {
        return res.status(403).json({ erro: 'Não é membro do grupo' });
      }
    }

    // Convite: só quem criou o convite pendente pra essa pessoa pode avisá-la.
    if (dados.tipo === 'convite_grupo') {
      const convite = (await dbAdmin.collection('convites_grupo').doc(destinatarioUid).get()).data();
      if (convite?.status !== 'pendente' || convite?.deUid !== remetenteUid || convite?.grupoId !== String(dados.conviteGrupoId)) {
        return res.status(403).json({ erro: 'Convite inexistente' });
      }
    }

    const snap = await dbAdmin.collection('usuarios').doc(destinatarioUid).get();
    const usuario = snap.data();
    if (!usuario?.fcmToken) return res.status(200).json({ enviado: false, motivo: 'Destinatário sem token FCM' });
    if (!permitePush(usuario, dados.tipo, dados.grupoId ? String(dados.grupoId) : remetenteUid)) return res.status(200).json({ enviado: false, motivo: 'Bloqueado pelas preferências do destinatário' });

    let tituloFinal = String(titulo).slice(0, 120);
    let corpoFinal = String(corpo).slice(0, 240);
    let tag: string | undefined;
    let imagem: string | undefined;
    const host = req.headers.host;
    const fotoDoRemetente = async () =>
      urlFoto(host, 'u', remetenteUid, (await dbAdmin.collection('usuarios').doc(remetenteUid).get()).data()?.foto);

    if (dados.tipo === 'mensagem') {
      // Várias mensagens da mesma pessoa viram UMA notificação com a lista das
      // não lidas, que substitui a anterior (tag fixa por conversa).
      const conversaId = [remetenteUid, destinatarioUid].sort().join('_');
      const bloco = await mensagensNaoLidas({ conversaId, destinatarioUid, remetenteUid });
      ({ titulo: tituloFinal, corpo: corpoFinal } = montarBloco(tituloFinal, bloco, corpoFinal));
      tag = `chat_${conversaId}`;
      imagem = await fotoDoRemetente();
    } else if (dados.tipo === 'mensagem_grupo' && dados.grupoId) {
      const bloco = await mensagensNaoLidas({ conversaId: String(dados.grupoId), destinatarioUid, comNome: true });
      ({ titulo: tituloFinal, corpo: corpoFinal } = montarBloco(tituloFinal, bloco, corpoFinal));
      tag = `grupo_${dados.grupoId}`;
      // foto do grupo; se o grupo não tiver, a de quem mandou
      const grupoFoto = (await dbAdmin.collection('conversas').doc(String(dados.grupoId)).get()).data()?.foto;
      imagem = urlFoto(host, 'g', String(dados.grupoId), grupoFoto) || await fotoDoRemetente();
    } else if (dados.tipo === 'solicitacao_match' || dados.tipo === 'match_aceito') {
      tag = `${dados.tipo}_${remetenteUid}`;
    } else if (dados.tipo === 'convite_grupo') {
      tag = `convite_grupo_${destinatarioUid}`;
    } else if (dados.resumoId) {
      tag = `${dados.tipo}_${dados.resumoId}`;
    }

    // O remetente vem do token verificado, não do corpo — evita alguém se
    // passar por outra pessoa no toque da notificação.
    const { enviados, erros } = await enviarParaTokens(
      [{ uid: destinatarioUid, token: usuario.fcmToken }],
      tituloFinal,
      corpoFinal,
      { ...dados, remetenteUid, ...(dados.tipo === 'mensagem' ? { outroUid: remetenteUid } : {}) },
      { tag, imagem },
    );
    return res.status(200).json(enviados > 0 ? { enviado: true } : { enviado: false, motivo: erros[0] || 'falha no FCM' });
  } catch (e: any) {
    console.error('Erro ao enviar push:', e);
    return res.status(500).json({ erro: 'Falha ao enviar notificação' });
  }
}
