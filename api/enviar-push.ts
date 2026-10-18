import type { VercelRequest, VercelResponse } from '@vercel/node';
import { dbAdmin } from './_lib/firebaseAdmin';
import { liberarCors, uidDoToken, permitePush, enviarParaTokens, TIPOS_SO_ADMIN, ehAdmin } from './_lib/push';

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

    const snap = await dbAdmin.collection('usuarios').doc(destinatarioUid).get();
    const usuario = snap.data();
    if (!usuario?.fcmToken) return res.status(200).json({ enviado: false, motivo: 'Destinatário sem token FCM' });
    if (!permitePush(usuario, dados.tipo, dados.grupoId ? String(dados.grupoId) : remetenteUid)) return res.status(200).json({ enviado: false, motivo: 'Bloqueado pelas preferências do destinatário' });

    // O remetente vem do token verificado, não do corpo — evita alguém se
    // passar por outra pessoa no toque da notificação.
    const { enviados, erros } = await enviarParaTokens(
      [{ uid: destinatarioUid, token: usuario.fcmToken }],
      String(titulo).slice(0, 120),
      String(corpo).slice(0, 240),
      { ...dados, remetenteUid, ...(dados.tipo === 'mensagem' ? { outroUid: remetenteUid } : {}) },
    );
    return res.status(200).json(enviados > 0 ? { enviado: true } : { enviado: false, motivo: erros[0] || 'falha no FCM' });
  } catch (e: any) {
    console.error('Erro ao enviar push:', e);
    return res.status(500).json({ erro: 'Falha ao enviar notificação' });
  }
}
