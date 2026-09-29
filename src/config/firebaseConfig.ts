import { Platform } from "react-native";
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, initializeAuth, type Auth } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyBpPd1Hb1ZwVHxgEhGXsXS_TFfxdMsOOO4",
  authDomain: "jumo-d9094.firebaseapp.com",
  projectId: "jumo-d9094",
  storageBucket: "jumo-d9094.firebasestorage.app",
  messagingSenderId: "320566695312",
  appId: "1:320566695312:web:e6c5a4bb954de2b6150f15"
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
