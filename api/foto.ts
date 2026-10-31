import type { VercelRequest, VercelResponse } from '@vercel/node';
import { dbAdmin } from './_lib/firebaseAdmin';
import { assinaturaFotoValida } from './_lib/push';

// GET /api/foto?t=u|g&id=<uid ou id do grupo>&v=<versão>&s=<assinatura>
// Entrega a foto (guardada em base64 no Firestore) como imagem, pra aparecer
// na notificação. Só responde com assinatura válida, gerada pelo próprio backend.
const tipoImagem = (b: Buffer) =>
  b[0] === 0xff && b[1] === 0xd8 ? 'image/jpeg'
  : b[0] === 0x89 && b[1] === 0x50 ? 'image/png'
  : b.slice(0, 4).toString() === 'RIFF' ? 'image/webp'
  : b.slice(0, 3).toString() === 'GIF' ? 'image/gif'
  : null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  const t = String(req.query.t || '');
  const id = String(req.query.id || '');
  if (!['u', 'g'].includes(t) || !id || !assinaturaFotoValida(t, id, String(req.query.s || ''))) {
    return res.status(403).end();
  }
  try {
    const ref = t === 'u' ? dbAdmin.collection('usuarios').doc(id) : dbAdmin.collection('conversas').doc(id);
    const foto = (await ref.get()).data()?.foto;
    if (!foto) return res.status(404).end();
    const base64 = String(foto).replace(/^data:[^,]*,/, '');
    const bytes = Buffer.from(base64, 'base64');
    const tipo = tipoImagem(bytes);
    if (!tipo) return res.status(415).end();
    // o link já muda quando a foto muda (parâmetro v), então pode guardar em cache
    res.setHeader('Content-Type', tipo);
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    return res.status(200).send(bytes);
  } catch (e) {
    console.error('Erro ao servir foto:', e);
    return res.status(500).end();
  }
}
