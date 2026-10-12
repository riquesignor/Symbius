import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { initializeAuth } from "firebase/auth";
// getReactNativePersistence existe em runtime (Metro resolve a condicao
// "react-native" dos exports do @firebase/auth corretamente), mas o
// TypeScript nao reconhece essa condicao pra fins de tipos nesse pacote
// especifico (limitacao conhecida do firebase-js-sdk).
// @ts-ignore
import { getReactNativePersistence } from "@firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Valores client-side do Firebase (não são segredo — o SDK é feito pra ir
// embutido no app; quem protege os dados são as regras do Firestore). Ainda
// assim ficam em env vars pra não amarrar o repo a um projeto Firebase
// específico. Veja .env.example.
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
// Sem isso, o Firebase Auth so vive em memoria: ao fechar e reabrir o app,
// auth.currentUser volta null mesmo com o `uid` ainda salvo no AsyncStorage
// (que e o que o app usa pra pular a tela de login), quebrando qualquer
// fluxo que dependa de auth.currentUser.getIdToken() depois de um restart.
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});