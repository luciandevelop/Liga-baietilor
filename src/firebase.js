import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Configurația proiectului Firebase "Liga Băieților" (Cupa Septembrie)
// Proiect complet separat de World Cup Arena 2026 — izolare totală.
const firebaseConfig = {
  apiKey: "AIzaSyALUkFRxp7oLUphefsBgE191RAHgZ8P-aU",
  authDomain: "champions-league-25d0a.firebaseapp.com",
  projectId: "champions-league-25d0a",
  storageBucket: "champions-league-25d0a.firebasestorage.app",
  messagingSenderId: "601408791029",
  appId: "1:601408791029:web:8c391dae948847bb0900bc",
  measurementId: "G-Z2NVLL2Q4N",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
