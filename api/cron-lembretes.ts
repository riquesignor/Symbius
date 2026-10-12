import type { VercelRequest, VercelResponse } from '@vercel/node';
import { dbAdmin } from './_lib/firebaseAdmin';
import { permitePush, enviarParaTokens, Destino } from './_lib/push';

// Roda 1x por dia (vercel.json → crons). Avisa 3 dias e 1 dia antes de:
//  • eventos do admin (eventos_admin/tipos/{provas|feriados|avisos|eventos}), pra série de cada um
//  • lembretes pessoais (lembretes/{RA ou uid}/lembretes/{id}), pro dono
const SUBS: Record<string, string> = { provas: 'Prova', feriados: 'Feriado', avisos: 'Aviso', eventos: 'Evento' };
const ANTECEDENCIAS = [3, 1];

const dataBrasilia = (somaDias: number) => {
  const agora = new Date(Date.now() + somaDias * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(agora); // YYYY-MM-DD
};

const extrairSerie = (turma: string): string | null => {
  const m = (turma || '').match(/^(\d+)/);
  return m ? `${m[1]}º` : null;
};

const textoAntecedencia = (dias: number) => (dias === 1 ? 'É amanhã' : `Faltam ${dias} dias`);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || req.headers.authorization !== `Bearer ${segredo}`) {
    return res.status(401).json({ erro: 'Não autorizado' });
  }

  try {
    const alvos = new Map(ANTECEDENCIAS.map(d => [dataBrasilia(d), d]));

    const usuariosSnap = await dbAdmin.collection('usuarios').get();
    const usuarios = new Map<string, any>();
    const uidPorRa = new Map<string, string>();
    usuariosSnap.forEach(d => {
      const u = d.data();
      usuarios.set(d.id, u);
      const ra = String(u.ra || '').replace(/[\/\\]/g, '');
      if (ra && ra !== 'N/A') uidPorRa.set(ra, d.id);
    });

    let enviados = 0;

    // ── Eventos do admin ──
    for (const [sub, tipoEvento] of Object.entries(SUBS)) {
      const eventos = await dbAdmin.collection('eventos_admin').doc('tipos').collection(sub).get();
      for (const evDoc of eventos.docs) {
        const ev = evDoc.data();
        const dias = alvos.get(ev.data);
        if (!dias || !Array.isArray(ev.series)) continue;
        const tipoPref = tipoEvento === 'Aviso' ? 'aviso_admin' : 'evento_admin';
        const destinos: Destino[] = [];
        usuarios.forEach((u, uid) => {
          const serie = extrairSerie(u.turma);
          if (!u.fcmToken || !serie || !ev.series.includes(serie)) return;
          if (!permitePush(u, tipoPref)) return;
          destinos.push({ uid, token: u.fcmToken });
        });
        const r = await enviarParaTokens(
          destinos,
          `${textoAntecedencia(dias)}: ${tipoEvento.toLowerCase()}`,
          ev.titulo || 'Evento na agenda',
          { tipo: 'evento_admin', eventoId: evDoc.id, tipoEvento },
        );
        enviados += r.enviados;
      }
    }

    // ── Lembretes pessoais ──
    // collectionGroup sem filtro não exige índice; o volume de um TCC é pequeno.
    const lembretes = await dbAdmin.collectionGroup('lembretes').get();
    for (const lDoc of lembretes.docs) {
      const l = lDoc.data();
      const dias = alvos.get(l.data);
      if (!dias || !l.titulo) continue;
      const dono = l.uid || uidPorRa.get(lDoc.ref.parent.parent?.id || '') || lDoc.ref.parent.parent?.id;
      const u = dono ? usuarios.get(dono) : null;
      if (!u?.fcmToken || !permitePush(u, 'lembrete')) continue;
      const r = await enviarParaTokens(
        [{ uid: dono, token: u.fcmToken }],
        `${textoAntecedencia(dias)}: seu lembrete`,
        l.titulo,
        { tipo: 'lembrete', lembreteId: lDoc.id },
      );
      enviados += r.enviados;
    }

    return res.status(200).json({ ok: true, datas: [...alvos.keys()], enviados });
  } catch (e: any) {
    console.error('Erro no cron de lembretes:', e);
    return res.status(500).json({ erro: 'Falha no cron' });
  }
}
