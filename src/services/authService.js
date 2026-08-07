import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, setDoc, collection, query, where, getDocs, serverTimestamp } from "firebase/firestore";
import { auth, db, googleProvider } from "../firebase";

// BUG REPARAT (sprint anterior) — cauza reală a "Jucător nou" pentru
// conturile email/parolă: createUserWithEmailAndPassword() declanșează
// onAuthStateChanged() în App.jsx aproape imediat ce contul e creat —
// ÎNAINTE ca linia următoare, updateProfile(displayName), să apuce să se
// termine. Fix păstrat: nickname-ul tastat la înregistrare e reținut
// sincron, înainte de apelul async care poate declanșa cursa.
let pendingNickname = null;

export function consumePendingNickname() {
  const n = pendingNickname;
  pendingNickname = null;
  return n;
}

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

// Eroare dedicată — nickname deja folosit de alt cont.
export class NicknameTakenError extends Error {
  constructor(nickname) {
    super(`Nickname-ul "${nickname}" este deja folosit.`);
    this.name = "NicknameTakenError";
    this.code = "nickname-taken";
  }
}

function normalizeNickname(raw) {
  return (raw || "").trim();
}
function nicknameLowerOf(raw) {
  return normalizeNickname(raw).toLowerCase();
}

// Validare — aceleași reguli peste tot unde se alege un nickname (picker
// obligatoriu SAU înregistrare cu email). Lungime rezonabilă, fără
// caractere care ar putea crea confuzie vizuală/tehnică.
export function validateNickname(raw) {
  const n = normalizeNickname(raw);
  if (n.length < 2) return "Nickname-ul trebuie să aibă cel puțin 2 caractere.";
  if (n.length > 20) return "Nickname-ul poate avea cel mult 20 de caractere.";
  if (!/^[a-zA-Z0-9ăâîșțĂÂÎȘȚ _.-]+$/.test(n)) return "Nickname-ul conține caractere nepermise.";
  return null;
}

// Interoghează users după nicknameLower — SINGURUL mod de a garanta
// unicitatea, fără a atinge firestore.rules (users e deja citibil de orice
// user autentificat). La scara asta (grup de prieteni, ~11 useri, nu
// sute simultan) fereastra de cursă (doi useri salvând EXACT în aceeași
// clipă același nickname) e neglijabilă — nu am adăugat o colecție
// separată de rezervări, care ar fi cerut o modificare de
// firestore.rules pe care nu o pot verifica orb, fără fișierul tău real.
async function isNicknameTaken(nicknameLower, excludeUid) {
  const snap = await getDocs(query(collection(db, "users"), where("nicknameLower", "==", nicknameLower)));
  return snap.docs.some((d) => d.id !== excludeUid);
}

// Alege DEFINITIV nickname-ul unui user — singurul loc din toată
// aplicația unde users/{uid}.nickname se poate scrie DUPĂ crearea
// profilului. Nu există (și nu trebuie construită) o funcție de
// schimbare ulterioară.
export async function claimNickname(uid, rawNickname) {
  const nickname = normalizeNickname(rawNickname);
  const err = validateNickname(nickname);
  if (err) throw new Error(err);

  const nicknameLower = nicknameLowerOf(nickname);
  const taken = await isNicknameTaken(nicknameLower, uid);
  if (taken) throw new NicknameTakenError(nickname);

  await setDoc(doc(db, "users", uid), { nickname, nicknameLower, nicknameSet: true }, { merge: true });
  return { nickname, nicknameLower, nicknameSet: true };
}

// Decide dacă profilul ARE NEVOIE de pickerul obligatoriu de nickname.
//   - nicknameSet === true  → NICIODATĂ (indiferent de restul câmpurilor)
//   - fără nickname deloc   → da
//   - exact "Jucător nou"   → da (victimă directă a bug-ului vechi)
//   - conține spațiu        → probabil numele complet de la Google
//     (displayName), nu un nickname ales — euristică, documentată clar,
//     necesară pentru migrarea conturilor EXISTENTE create înainte de
//     acest sprint (nu există alt semnal disponibil pentru ele)
export function needsNicknamePrompt(profile) {
  if (!profile) return true;
  if (profile.nicknameSet === true) return false;
  const n = normalizeNickname(profile.nickname);
  if (!n) return true;
  if (n === "Jucător nou") return true;
  if (/\s/.test(n)) return true;
  return false;
}

// Creează/actualizează profilul în Firestore (public + privat, separate).
// NU se mai apelează din registerWithEmail/loginWithEmail/loginWithGoogle —
// e responsabilitatea EXCLUSIVĂ a App.jsx, apelată o singură dată per
// schimbare de stare de autentificare (vezi App.jsx).
//
// SCHIMBARE ACEST SPRINT: nu se mai inventează NICIUN nickname la creare
// — nici din displayName, nici "Jucător nou". Dacă `nickname` nu e dat
// explicit (cazul Google — vine null), profilul se creează cu
// nickname:null, nicknameSet:false, iar App.jsx va deschide obligatoriu
// ecranul de alegere. Dacă `nickname` e dat (cazul Email, ales la
// înregistrare), se scrie direct ca DEFINITIV (nicknameSet:true) — exact
// comportamentul cerut, păstrat neschimbat pentru fluxul email.
export async function ensureUserProfile(user, nickname) {
  const publicRef = doc(db, "users", user.uid);
  const privateRef = doc(db, "users", user.uid, "private", "profile");

  try {
    const publicSnap = await getDoc(publicRef);
    if (!publicSnap.exists()) {
      const chosen = normalizeNickname(nickname);
      await setDoc(publicRef, {
        uid: user.uid,
        nickname: chosen || null,
        nicknameLower: chosen ? nicknameLowerOf(chosen) : null,
        nicknameSet: Boolean(chosen),
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
  pendingNickname = nickname || null;
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

// Traduce codurile de eroare (Firebase Auth SAU ProfileSaveError/
// NicknameTakenError) în mesaje înțelese, în română.
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
    "nickname-taken": "Acest nickname este deja folosit. Alege altul.",
  };
  return map[code] || "A apărut o eroare neașteptată. Încearcă din nou.";
}
