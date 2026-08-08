import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";
import { doc, getDoc, setDoc, collection, getDocs, serverTimestamp } from "firebase/firestore";
import { auth, db, googleProvider } from "../firebase";

// BUG REPARAT (sprint anterior) — cauza reală a "Jucător nou" pentru
// conturile email/parolă: createUserWithEmailAndPassword() declanșează
// onAuthStateChanged() în App.jsx aproape imediat ce contul e creat —
// ÎNAINTE ca eventualul pas următor să apuce să se termine. Fix păstrat:
// nickname-ul tastat la înregistrare e reținut sincron, înainte de
// apelul async care poate declanșa cursa.
let pendingNickname = null;

export function consumePendingNickname() {
  const n = pendingNickname;
  pendingNickname = null;
  return n;
}

export class ProfileSaveError extends Error {
  constructor(cause) {
    super("Contul de autentificare a fost creat, dar profilul nu a putut fi salvat.");
    this.name = "ProfileSaveError";
    this.cause = cause;
    this.code = cause?.code || "profile-save-failed";
  }
}

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

export function validateNickname(raw) {
  const n = normalizeNickname(raw);
  if (n.length < 2) return "Nickname-ul trebuie să aibă cel puțin 2 caractere.";
  if (n.length > 20) return "Nickname-ul poate avea cel mult 20 de caractere.";
  if (!/^[a-zA-Z0-9ăâîșțĂÂÎȘȚ _.-]+$/.test(n)) return "Nickname-ul conține caractere nepermise.";
  return null;
}

// Interoghează TOATE documentele din users și compară nickname-urile
// direct în JS, case-insensitive — NU printr-un câmp nicknameLower
// separat. Regulile tale reale (hasOnly pe users/{userId}) permit DOAR
// ['uid','nickname','avatarId','seasonPoints','gameweeksPlayed'] — orice
// câmp în plus, oricât de mic, face ca scrierea să fie respinsă integral.
// La scara unui grup de prieteni (~11 useri), citirea tuturor documentelor
// e neglijabilă ca cost — mult mai simplu și mai sigur decât să cer o
// modificare de regulă doar pentru un câmp de căutare.
export async function isNicknameAvailable(nickname, excludeUid) {
  const lower = nicknameLowerOf(nickname);
  if (!lower) return false;
  const snap = await getDocs(collection(db, "users"));
  return !snap.docs.some((d) => d.id !== excludeUid && nicknameLowerOf(d.data().nickname) === lower);
}

// Alege DEFINITIV nickname-ul unui user — singurul loc din toată
// aplicația unde users/{uid}.nickname se poate scrie DUPĂ crearea
// profilului. Scrie STRICT câmpul `nickname` — regula ta (hasOnly) ar
// respinge orice altceva, inclusiv un eventual nicknameLower.
export async function claimNickname(uid, rawNickname) {
  const nickname = normalizeNickname(rawNickname);
  const err = validateNickname(nickname);
  if (err) throw new Error(err);

  const available = await isNicknameAvailable(nickname, uid);
  if (!available) throw new NicknameTakenError(nickname);

  await setDoc(doc(db, "users", uid), { nickname }, { merge: true });
  return { nickname };
}

// Decide dacă profilul ARE NEVOIE de pickerul obligatoriu de nickname —
// STRICT pe baza a ce e salvat în users/{uid}.nickname, fără nicio
// comparație cu displayName din Firebase Auth.
//
// BUG REPARAT — versiunea anterioară compara nickname-ul cu displayName
// din Auth, ca să detecteze "copiat automat de la Google". Dar pentru
// conturile de email create ÎNAINTE de fix-ul precedent (când
// registerWithEmail încă seta displayName = nickname-ul ales),
// displayName a rămas PERMANENT egal cu nickname-ul — Firebase Auth nu
// șterge retroactiv acel câmp. Comparația credea greșit că e "copiat
// automat" și cerea din nou alegerea, la fiecare login, la nesfârșit.
// Regula acum e simplă și fiabilă: există un nickname valid salvat? da
// → nu mai cere niciodată. Nu contează cum s-a autentificat.
//   - lipsă / gol / eșuează validarea → da, cere
//   - exact "Jucător nou" → da, cere (victimă directă a bug-ului vechi)
//   - altfel → nu, trece direct
export function needsNicknamePrompt(profile) {
  if (!profile) return true;
  const n = normalizeNickname(profile.nickname);
  if (!n || validateNickname(n)) return true;
  if (n === "Jucător nou") return true;
  return false;
}

// Creează/actualizează profilul în Firestore (public + privat, separate).
// NU se mai apelează din registerWithEmail/loginWithEmail/loginWithGoogle —
// e responsabilitatea EXCLUSIVĂ a App.jsx, apelată o singură dată per
// schimbare de stare de autentificare.
//
// Scrierea de creare respectă STRICT regula ta reală (hasOnly + hasAll pe
// exact 5 câmpuri, nickname obligatoriu string — niciodată null). Pentru
// un user nou fără nickname ales încă (cazul Google), scriem string gol
// "" — satisface `is string`, iar needsNicknamePrompt() îl tratează ca
// "lipsă", deschizând corect pickerul.
export async function ensureUserProfile(user, nickname) {
  const publicRef = doc(db, "users", user.uid);
  const privateRef = doc(db, "users", user.uid, "private", "profile");

  try {
    const publicSnap = await getDoc(publicRef);
    if (!publicSnap.exists()) {
      const chosen = normalizeNickname(nickname);
      await setDoc(publicRef, {
        uid: user.uid,
        nickname: chosen, // string mereu — gol ("") dacă nu a fost ales încă
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
//
// NU mai setează displayName pe contul Firebase Auth (spre deosebire de
// versiunea anterioară) — asta e ce face needsNicknamePrompt() de mai sus
// să funcționeze corect fără niciun flag suplimentar: dacă am fi lăsat
// displayName = nickname-ul ales, orice cont de email ar fi coincis mereu
// cu propriul displayName și ar fi fost trimis greșit înapoi la picker.
export async function registerWithEmail(email, password, nickname) {
  pendingNickname = nickname || null;
  const cred = await createUserWithEmailAndPassword(auth, email, password);
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
