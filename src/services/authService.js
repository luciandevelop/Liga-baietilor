import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, googleProvider } from "../firebase";

// Creează documentul de user în Firestore dacă nu există deja.
// isAdmin e mereu false la creare — se setează manual, o singură dată, direct din
// consola Firebase, pentru contul de admin (exact rețeta care a funcționat la World Cup Arena).
async function ensureUserDoc(user, nickname) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      email: user.email || "",
      nickname: nickname || user.displayName || "Jucător nou",
      isAdmin: false,
      avatarId: null,
      seasonPoints: 0,
      gameweeksPlayed: 0,
      createdAt: serverTimestamp(),
    });
  }
  return ref;
}

export async function registerWithEmail(email, password, nickname) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (nickname) {
    await updateProfile(cred.user, { displayName: nickname });
  }
  await ensureUserDoc(cred.user, nickname);
  return cred.user;
}

export async function loginWithEmail(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function loginWithGoogle() {
  const cred = await signInWithPopup(auth, googleProvider);
  await ensureUserDoc(cred.user, cred.user.displayName);
  return cred.user;
}

export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

export async function logout() {
  await signOut(auth);
}

// Traduce codurile de eroare Firebase în mesaje înțelese, în română.
export function translateAuthError(code) {
  const map = {
    "auth/invalid-email": "Adresa de email nu e validă.",
    "auth/user-disabled": "Contul a fost dezactivat.",
    "auth/user-not-found": "Nu există niciun cont cu acest email.",
    "auth/wrong-password": "Parola introdusă e greșită.",
    "auth/invalid-credential": "Email sau parolă greșită.",
    "auth/email-already-in-use": "Există deja un cont cu acest email.",
    "auth/weak-password": "Parola trebuie să aibă cel puțin 6 caractere.",
    "auth/too-many-requests": "Prea multe încercări greșite. Încearcă din nou peste câteva minute.",
    "auth/popup-closed-by-user": "Fereastra de Google a fost închisă înainte de finalizare.",
    "auth/network-request-failed": "Problemă de conexiune. Verifică internetul și încearcă din nou.",
  };
  return map[code] || "A apărut o eroare neașteptată. Încearcă din nou.";
}
