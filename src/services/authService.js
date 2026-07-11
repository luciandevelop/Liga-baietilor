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

// Eroare dedicată pentru probleme de Firestore. Păstrează codul original al
// erorii care a cauzat eșecul (ex: "permission-denied", "unavailable"), sau
// un cod generic "profile-save-failed" dacă eroarea originală nu are cod —
// NU presupune automat că e o problemă de permisiuni.
export class ProfileSaveError extends Error {
  constructor(cause) {
    super("Contul de autentificare a fost creat, dar profilul nu a putut fi salvat.");
    this.name = "ProfileSaveError";
    this.cause = cause;
    this.code = cause?.code || "profile-save-failed";
  }
}

// Creează/actualizează profilul în Firestore (public + privat, separate).
// NU se mai apelează din registerWithEmail/loginWithEmail/loginWithGoogle —
// e responsabilitatea EXCLUSIVĂ a App.jsx, apelată o singură dată per
// schimbare de stare de autentificare (vezi App.jsx). Asta elimină race-ul
// dintre onAuthStateChanged și scrierea în Firestore, și previne apelurile
// duplicate care existau înainte (authService + WelcomeScreen independent).
export async function ensureUserProfile(user, nickname) {
  const publicRef = doc(db, "users", user.uid);
  const privateRef = doc(db, "users", user.uid, "private", "profile");

  try {
    const publicSnap = await getDoc(publicRef);
    if (!publicSnap.exists()) {
      await setDoc(publicRef, {
        uid: user.uid,
        nickname: nickname || user.displayName || "Jucător nou",
        avatarId: null,
        seasonPoints: 0,
        gameweeksPlayed: 0,
      });
    }

    const privateSnap = await getDoc(privateRef);
    if (!privateSnap.exists()) {
      await setDoc(privateRef, {
        email: user.email || "",
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      });
    } else {
      await setDoc(privateRef, { lastLoginAt: serverTimestamp() }, { merge: true });
    }

    const finalSnap = await getDoc(publicRef);
    return finalSnap.exists() ? finalSnap.data() : null;
  } catch (err) {
    console.error("Eroare la salvarea profilului în Firestore:", err);
    throw new ProfileSaveError(err);
  }
}

// Doar autentificare — NU ating Firestore aici. Dacă asta reușește, contul
// Auth există garantat; profilul se creează separat, în App.jsx.
export async function registerWithEmail(email, password, nickname) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (nickname) {
    await updateProfile(cred.user, { displayName: nickname });
  }
  return cred.user;
}

export async function loginWithEmail(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function loginWithGoogle() {
  const cred = await signInWithPopup(auth, googleProvider);
  return cred.user;
}

export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

export async function logout() {
  await signOut(auth);
}

// Traduce codurile de eroare (Firebase Auth SAU ProfileSaveError) în mesaje
// înțelese, în română. Funcționează identic pentru ambele tipuri de erori,
// pentru că ProfileSaveError expune acum `.code`.
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
    "permission-denied": "Nu s-a putut salva profilul (permisiuni Firestore). Contactează admin-ul.",
    "profile-save-failed": "Contul de autentificare există, dar profilul nu a putut fi salvat. Verifică conexiunea și încearcă din nou.",
  };
  return map[code] || "A apărut o eroare neașteptată. Încearcă din nou.";
}
