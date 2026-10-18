import type { VercelRequest, VercelResponse } from '@vercel/node';
import { dbAdmin } from './_lib/firebaseAdmin';
import { liberarCors, uidDoToken, permitePush, enviarParaTokens, Destino, ehAdmin, ehStaff } from './_lib/push';

const extrairSerie = (turma: string): string | null => {
  const m = (turma || '').match(/^(\d+)/);
  return m ? `${m[1]}º` : null;
};

// POST /api/enviar-push-serie
//  • Evento do calendário (só administradores):
//    { series: ['1º','2º'], titulo, corpo, dados: { tipo: 'evento_admin', tipoEvento, ... } }
//  • Post novo no mural, pra todo mundo (administrador ou grêmio — quem pode postar):
//    { todos: true, titulo, corpo, dados: { tipo: 'novo_post', postId } }
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (liberarCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' });

  const uid = await uidDoToken(req.headers.authorization);
  if (!uid) return res.status(401).json({ erro: 'Não autenticado' });

  const { series, todos, titulo, corpo, dados } = req.body || {};
  const paraTodos = todos === true;
  if (!titulo || !corpo || (!paraTodos && (!Array.isArray(series) || series.length === 0))) {
    return res.status(400).json({ erro: 'titulo, corpo e series (ou todos: true) são obrigatórios' });
  }

  const autor = (await dbAdmin.collection('usuarios').doc(uid).get()).data();
  if (paraTodos ? !ehStaff(autor) : !ehAdmin(autor)) {
    return res.status(403).json({ erro: 'Sem permissão' });
  }

  try {
    const tipo = paraTodos ? 'novo_post' : 'evento_admin';
    const tipoPref = paraTodos ? 'novo_post' : dados?.tipoEvento === 'Aviso' ? 'aviso_admin' : 'evento_admin';
    const usuarios = await dbAdmin.collection('usuarios').get();
    const destinos: Destino[] = [];
    usuarios.forEach(d => {
      const u = d.data();
      if (d.id === uid || !u.fcmToken || u.status === 2) return;
      if (!paraTodos) {
        const serie = extrairSerie(u.turma);
        if (!serie || !series.includes(serie)) return;
      }
      if (!permitePush(u, tipoPref)) return;
      destinos.push({ uid: d.id, token: u.fcmToken });
    });

    const resultado = await enviarParaTokens(destinos, String(titulo).slice(0, 120), String(corpo).slice(0, 240), {
      ...(dados || {}), tipo,
    });
    return res.status(200).json(resultado);
  } catch (e: any) {
    console.error('Erro ao enviar push em massa:', e);
    return res.status(500).json({ erro: 'Falha ao enviar notificações' });
  }
}
