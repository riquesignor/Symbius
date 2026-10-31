import type { VercelRequest, VercelResponse } from '@vercel/node';
import { dbAdmin } from './_lib/firebaseAdmin';
import { liberarCors, uidDoToken, permitePush, enviarParaTokens, Destino, ehAdmin } from './_lib/push';

// POST /api/notificar-admins  { evento: 'nova_conta' }
// Avisa os administradores sobre algo feito pelo próprio chamador. O texto é
// montado aqui a partir do perfil de quem chamou — o cliente não escolhe o
// que vai aparecer na notificação dos admins.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (liberarCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' });

  const uid = await uidDoToken(req.headers.authorization);
  if (!uid) return res.status(401).json({ erro: 'Não autenticado' });

  const { evento } = req.body || {};
  if (evento !== 'nova_conta') return res.status(400).json({ erro: 'Evento desconhecido' });

  try {
    const quem = (await dbAdmin.collection('usuarios').doc(uid).get()).data();
    // Só vale pra conta recém-criada (ainda aguardando confirmação de e-mail),
    // então não dá pra usar isso pra encher os admins de notificação.
    if (!quem || quem.status !== 0 || quem.notificou_admins) {
      return res.status(200).json({ enviados: 0, motivo: 'Nada a notificar' });
    }
    await dbAdmin.collection('usuarios').doc(uid).update({ notificou_admins: true });

    const admins = await dbAdmin.collection('usuarios').get();
    const destinos: Destino[] = [];
    admins.forEach(d => {
      const u = d.data();
      if (d.id === uid || !u.fcmToken || !ehAdmin(u)) return;
      if (!permitePush(u, 'admin_nova_conta')) return;
      destinos.push({ uid: d.id, token: u.fcmToken });
    });

    const turma = quem.turma && quem.turma !== 'N/A' ? ` · ${quem.turma}` : '';
    const r = await enviarParaTokens(
      destinos,
      '🆕 Nova conta no Symbius',
      `${quem.nome_completo || 'Alguém'} (${quem.tipo || 'Aluno'}${turma}) acabou de se cadastrar.`,
      { tipo: 'admin_nova_conta', novoUid: uid },
    );
    return res.status(200).json(r);
  } catch (e: any) {
    console.error('Erro ao notificar admins:', e);
    return res.status(500).json({ erro: 'Falha ao notificar' });
  }
}
