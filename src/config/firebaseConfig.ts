import { Platform } from "react-native";
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, initializeAuth, type Auth } from "firebase/auth";
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

// No celular, sem persistência o Auth só vive em memória: ao fechar e reabrir
// o app, auth.currentUser volta null mesmo com o `uid` salvo no AsyncStorage,
// e o app não consegue chamar o backend de push. Na web (npm run web) essa
// função não existe e o navegador já persiste a sessão sozinho.
const criarAuth = (): Auth => {
  if (Platform.OS === "web") return getAuth(app);
  try {
    // getReactNativePersistence só existe na build React Native do pacote;
    // o TypeScript não enxerga essa condição de export, por isso o require.
    const { getReactNativePersistence } = require("@firebase/auth");
    return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch {
    // Fast refresh recarrega este módulo e initializeAuth só pode rodar uma vez.
    return getAuth(app);
  }
};

export const auth = criarAuth();
