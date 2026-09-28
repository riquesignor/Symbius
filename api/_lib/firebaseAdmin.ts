import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Credenciais da service account vêm de variáveis de ambiente (nunca commitadas).
// Gerar em: Firebase Console → Configurações do projeto → Contas de serviço →
// Gerar nova chave privada.
const app = getApps()[0] ?? initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    // Vercel guarda env vars como string única — a chave privada tem quebras
    // de linha literais "\n" que precisam virar quebras de linha de verdade.
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

export const messagingAdmin = getMessaging(app);
export const dbAdmin = getFirestore(app);
export const authAdmin = getAuth(app);
