// ══════════════════════════════════════════════════════════════════
// Inițializare Firebase Admin — comună pentru toate rutele din api/.
// Server-side EXCLUSIV (Vercel Serverless Functions, plan Hobby).
//
// Variabile de mediu necesare (Vercel → Settings → Environment
// Variables), NICIODATĂ cu prefix VITE_ (acelea ajung publice):
//   FIREBASE_SERVICE_ACCOUNT_KEY — JSON-ul contului de service,
//     ca STRING (Firebase Console → Project Settings → Service
//     Accounts → Generate new private key → lipești tot JSON-ul aici)
//   FIREBASE_PROJECT_ID — id-ul proiectului Firebase (îl vezi în
//     același JSON, câmpul "project_id")
// ══════════════════════════════════════════════════════════════════
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

let app;
export function getAdminDb() {
  if (!getApps().length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    app = initializeApp({
      credential: cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
  }
  return getFirestore();
}
