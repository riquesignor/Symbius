import type { VercelRequest, VercelResponse } from '@vercel/node';
import { dbAdmin } from './_lib/firebaseAdmin';
import { uidDoToken, permitePush, enviarParaTokens, Destino } from './_lib/push';

const extrairSerie = (turma: string): string | null => {
  const m = (turma || '').match(/^(\d+)/);
  return m ? `${m[1]}º` : null;
};

// POST /api/enviar-push-serie — só administradores.
// Body: { series: ['1º','2º'], titulo, corpo, dados: { tipo: 'evento_admin', tipoEvento, ... } }
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' });

  const uid = await uidDoToken(req.headers.authorization);
  if (!uid) return res.status(401).json({ erro: 'Não autenticado' });

  const autor = (await dbAdmin.collection('usuarios').doc(uid).get()).data();
  if (String(autor?.tipo || '').toLowerCase() !== 'administrador') {
    return res.status(403).json({ erro: 'Apenas administradores' });
  }

  const { series, titulo, corpo, dados } = req.body || {};
  if (!Array.isArray(series) || series.length === 0 || !titulo || !corpo) {
    return res.status(400).json({ erro: 'series, titulo e corpo são obrigatórios' });
  }

  try {
    const tipoPref = dados?.tipoEvento === 'Aviso' ? 'aviso_admin' : 'evento_admin';
    const usuarios = await dbAdmin.collection('usuarios').get();
    const destinos: Destino[] = [];
    usuarios.forEach(d => {
      const u = d.data();
      if (d.id === uid || !u.fcmToken) return;
      const serie = extrairSerie(u.turma);
      if (!serie || !series.includes(serie)) return;
      if (!permitePush(u, tipoPref)) return;
      destinos.push({ uid: d.id, token: u.fcmToken });
    });

    const resultado = await enviarParaTokens(destinos, String(titulo).slice(0, 120), String(corpo).slice(0, 240), {
      ...(dados || {}), tipo: 'evento_admin',
    });
    return res.status(200).json(resultado);
  } catch (e: any) {
    console.error('Erro ao enviar push por série:', e);
    return res.status(500).json({ erro: 'Falha ao enviar notificações' });
  }
}
