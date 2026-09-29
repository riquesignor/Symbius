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
// Sem isso, o Firebase Auth so vive em memoria: ao fechar e reabrir o app,
// auth.currentUser volta null mesmo com o `uid` ainda salvo no AsyncStorage
// (que e o que o app usa pra pular a tela de login), quebrando qualquer
// fluxo que dependa de auth.currentUser.getIdToken() depois de um restart.
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});