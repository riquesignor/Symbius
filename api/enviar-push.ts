import type { VercelRequest, VercelResponse } from '@vercel/node';
import { messagingAdmin, dbAdmin, authAdmin } from './_lib/firebaseAdmin';

// ══════════════════════════════════════════════════════════════════════
// Envia push (FCM) pra um usuário específico. Chamado pelo app logo após
// salvar no Firestore (nova mensagem de chat, solicitação de match, etc).
// Entrega mesmo com o app fechado.
//
// POST /api/enviar-push
// Headers: Authorization: Bearer <firebase-id-token-do-remetente>
// Body: { destinatarioUid, titulo, corpo, dados? }
// ══════════════════════════════════════════════════════════════════════

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  const authHeader = req.headers.authorization || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) {
    return res.status(401).json({ erro: 'Token de autenticação ausente' });
  }

  try {
    await authAdmin.verifyIdToken(idToken);
  } catch {
    return res.status(401).json({ erro: 'Token de autenticação inválido' });
  }

  const { destinatarioUid, titulo, corpo, dados } = req.body || {};
  if (!destinatarioUid || !titulo || !corpo) {
    return res.status(400).json({ erro: 'destinatarioUid, titulo e corpo são obrigatórios' });
  }

  try {
    const snap = await dbAdmin.collection('usuarios').doc(destinatarioUid).get();
    const fcmToken = snap.data()?.fcmToken;

    if (!fcmToken) {
      return res.status(200).json({ enviado: false, motivo: 'Destinatário sem token FCM registrado' });
    }

    await messagingAdmin.send({
      token: fcmToken,
      notification: { title: titulo, body: corpo },
      data: dados ? stringificarValores(dados) : undefined,
      android: { priority: 'high' },
    });

    return res.status(200).json({ enviado: true });
  } catch (e: any) {
    console.error('Erro ao enviar push:', e);
    return res.status(500).json({ erro: 'Falha ao enviar notificação' });
  }
}

// FCM `data` exige que todos os valores sejam string
function stringificarValores(obj: Record<string, any>): Record<string, string> {
  const resultado: Record<string, string> = {};
  for (const chave in obj) resultado[chave] = String(obj[chave]);
  return resultado;
}
