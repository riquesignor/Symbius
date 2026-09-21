import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; 
import { getAuth } from "firebase/auth";

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
export const auth = getAuth(app);