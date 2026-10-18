import { FieldValue } from 'firebase-admin/firestore';
import { messagingAdmin, dbAdmin, authAdmin } from './firebaseAdmin';

export const CANAL_ANDROID = 'symbius';

// Só o app na web (npm run web) precisa disso: o navegador bloqueia chamadas
// entre origens sem esses cabeçalhos. A autenticação é por Bearer token (sem
// cookies), então liberar a origem não abre nada além do que o token já protege.
// Retorna true quando era só a verificação prévia (OPTIONS) e já foi respondida.
export const liberarCors = (req: any, res: any): boolean => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return true; }
  return false;
};

export const uidDoToken = async (authorization: string | undefined): Promise<string | null> => {
  const idToken = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
  if (!idToken) return null;
  try {
    return (await authAdmin.verifyIdToken(idToken)).uid;
  } catch {
    return null;
  }
};

// Qual preferência (usuarios/{uid}.notif_prefs) libera cada tipo de push.
// Preferência ausente = liberado (padrão dos toggles é ligado).
const PREF_POR_TIPO: Record<string, string> = {
  mensagem: 'mensagens',
  solicitacao_match: 'match',
  match_aceito: 'match',
  evento_admin: 'eventos',
  aviso_admin: 'avisos',
  lembrete: 'eventos',
  resumo_curtida: 'geral',
  resumo_comentario: 'geral',
  mensagem_grupo: 'mensagens',
  grupo_adicionado: 'match',
  novo_post: 'avisos',
  checkin: 'diario',
};

// Avisos sobre a própria conta chegam sempre, independente das preferências.
const TIPOS_OBRIGATORIOS = new Set(['conta_suspensa', 'conta_reativada']);

// Só um administrador pode disparar esses tipos (senão qualquer usuário
// logado poderia mandar "sua conta foi suspensa" pra outra pessoa).
export const TIPOS_SO_ADMIN = new Set(['conta_suspensa', 'conta_reativada']);

export const ehAdmin = (u: any) => String(u?.tipo || '').toLowerCase() === 'administrador';
export const ehStaff = (u: any) => ehAdmin(u) || String(u?.tipo || '').toLowerCase() === 'gremista';

// `silenciavel` é quem pode estar na lista de silenciados: o remetente numa
// conversa 1:1 ou o id do grupo numa conversa em grupo.
export const permitePush = (usuario: any, tipo: string, silenciavel?: string): boolean => {
  if (TIPOS_OBRIGATORIOS.has(tipo)) return true;
  const prefs = usuario?.notif_prefs || {};
  if (prefs.geral === false) return false;
  const campo = PREF_POR_TIPO[tipo];
  if (campo && prefs[campo] === false) return false;
  if (silenciavel && (usuario?.silenciados || []).includes(silenciavel)) return false;
  return true;
};

// FCM exige que todos os valores de `data` sejam string.
const stringificar = (obj: Record<string, any> = {}) => {
  const r: Record<string, string> = {};
  for (const k in obj) if (obj[k] !== undefined && obj[k] !== null) r[k] = String(obj[k]);
  return r;
};

// Só esses códigos significam "o token não existe mais". invalid-argument NÃO
// entra: ele também aparece quando a mensagem está malformada, e apagar um
// token válido por isso deixaria a pessoa sem push até reabrir o app.
const TOKEN_INVALIDO = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

export interface Destino { uid: string; token: string }

// Envia pra vários tokens e apaga do Firestore os que o FCM disser que não
// existem mais (app desinstalado, token trocado).
export const enviarParaTokens = async (
  destinos: Destino[],
  titulo: string,
  corpo: string,
  dados: Record<string, any>,
): Promise<{ enviados: number; falhas: number; erros: string[] }> => {
  if (destinos.length === 0) return { enviados: 0, falhas: 0, erros: [] };
  let enviados = 0;
  let falhas = 0;
  const erros: string[] = [];

  for (let i = 0; i < destinos.length; i += 500) {
    const lote = destinos.slice(i, i + 500);
    const resp = await messagingAdmin.sendEach(lote.map(d => ({
      token: d.token,
      notification: { title: titulo, body: corpo },
      data: stringificar(dados),
      android: { priority: 'high' as const, notification: { channelId: CANAL_ANDROID, color: '#1F3D2B' } },
      apns: { payload: { aps: { sound: 'default' } } },
    })));
    enviados += resp.successCount;
    falhas += resp.failureCount;

    await Promise.all(resp.responses.map(async (r, idx) => {
      if (r.success || !r.error) return;
      erros.push(r.error.code);
      console.error(`Push falhou para ${lote[idx].uid}: ${r.error.code} — ${r.error.message}`);
      if (!TOKEN_INVALIDO.has(r.error.code)) return;
      await dbAdmin.collection('usuarios').doc(lote[idx].uid)
        .update({ fcmToken: FieldValue.delete() })
        .catch(() => {});
    }));
  }
  return { enviados, falhas, erros };
};
