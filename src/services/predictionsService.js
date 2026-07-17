import { collection, doc, getDoc, getDocs, query, where, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { listMatches } from "./adminService";

// Pragul de lock e cu 30 de minute ÎNAINTE de kickoff — aceeași regulă ca
// în firestore.rules (isBeforeLock/isAfterLock). Ținută într-o singură
// constantă, ca UI-ul și regulile server-side să nu poată diverge.
export const LOCK_MINUTES_BEFORE_KICKOFF = 30;
const LOCK_MS = LOCK_MINUTES_BEFORE_KICKOFF * 60 * 1000;

// Verifică dacă un meci e blocat ACUM, client-side (doar pentru UI —
// securitatea reală e în firestore.rules, cu aceeași regulă).
export function isMatchLocked(match) {
  const kickoffMs = match?.kickoffAt?.toMillis ? match.kickoffAt.toMillis() : null;
  if (kickoffMs === null) return false;
  return Date.now() >= kickoffMs - LOCK_MS;
}

// Alege sezonul curent: primul al cărui interval [startDate, endDate]
// conține azi. Dacă niciunul nu se potrivește, fallback sigur — cel mai
// recent creat.
async function resolveCurrentSeason() {
  const snap = await getDocs(collection(db, "seasons"));
  const seasons = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (seasons.length === 0) return null;

  const now = Date.now();
  const withinRange = seasons.find((s) => {
    const start = s.startDate?.toMillis ? s.startDate.toMillis() : null;
    const end = s.endDate?.toMillis ? s.endDate.toMillis() : null;
    return start !== null && end !== null && now >= start && now <= end;
  });
  if (withinRange) return withinRange;

  seasons.sort((a, b) => {
    const at = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const bt = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    return bt - at;
  });
  return seasons[0];
}

// Alege etapa curentă a sezonului: STRICT cea a cărei săptămână
// [weekStart, weekEnd] conține azi. Fără fallback pe "ultima etapă" —
// dacă nu există etapă pentru săptămâna curentă, întoarce null explicit.
async function resolveCurrentGameweek(seasonId) {
  const snap = await getDocs(query(collection(db, "gameweeks"), where("seasonId", "==", seasonId)));
  const gameweeks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (gameweeks.length === 0) return null;

  const now = Date.now();
  const withinWeek = gameweeks.find((g) => {
    const start = g.weekStart?.toMillis ? g.weekStart.toMillis() : null;
    const end = g.weekEnd?.toMillis ? g.weekEnd.toMillis() : null;
    return start !== null && end !== null && now >= start && now <= end;
  });
  return withinWeek || null;
}

export async function getCurrentSeason() {
  return resolveCurrentSeason();
}

export async function getCurrentGameweek(seasonId) {
  return resolveCurrentGameweek(seasonId);
}

// Predicțiile existente ale userului pentru un set de meciuri — citire
// directă pe ID determinist (matchId_uid), fără query, deci fără index.
export async function loadUserPredictions(uid, matchIds) {
  const results = {};
  await Promise.all(
    matchIds.map(async (matchId) => {
      const snap = await getDoc(doc(db, "predictions", `${matchId}_${uid}`));
      if (snap.exists()) results[matchId] = snap.data();
    })
  );
  return results;
}

// Întoarce un întreg valid (>=0) sau undefined dacă valoarea e goală/invalidă.
function parseNonNegativeInt(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return undefined;
  return n;
}

// Salvează predicția pentru UN SINGUR meci — apelată de butonul propriu
// al fiecărui card, nu de un buton global. Scorul e obligatoriu (regula
// Firestore cere scoreA+scoreB mereu); cornere/cartonașe sunt opționale
// și, dacă lipsesc, NU sunt trimise deloc în payload — merge:true nu le
// suprascrie dacă exista deja o valoare anterioară.
export async function savePredictionForMatch({ matchId, uid, scoreA, scoreB, corners, cards }) {
  const a = parseNonNegativeInt(scoreA);
  const b = parseNonNegativeInt(scoreB);
  if (a === undefined || b === undefined) {
    throw new Error("Scorul trebuie să fie un număr întreg valid (≥ 0) pentru ambele echipe.");
  }

  const payload = { userId: uid, matchId, scoreA: a, scoreB: b };
  const c = parseNonNegativeInt(corners);
  const k = parseNonNegativeInt(cards);
  if (c !== undefined) payload.corners = c;
  if (k !== undefined) payload.cards = k;

  const ref = doc(db, "predictions", `${matchId}_${uid}`);
  await setDoc(ref, payload, { merge: true });
  return { scoreA: a, scoreB: b, corners: c, cards: k };
}

// ── Joker ────────────────────────────────────────────────────────────
// Un singur document per user per etapă (ID determinist gameweekId_uid),
// deci nu poate exista structural mai mult de un Joker activ simultan.

export async function loadUserJoker(gameweekId, uid) {
  const snap = await getDoc(doc(db, "jokers", `${gameweekId}_${uid}`));
  return snap.exists() ? snap.data() : null;
}

export async function saveJoker({ gameweekId, uid, matchId }) {
  const ref = doc(db, "jokers", `${gameweekId}_${uid}`);
  await setDoc(ref, { userId: uid, gameweekId, matchId }, { merge: false });
}

// Renunțare la Joker — șterge documentul complet. Userul rămâne fără
// Joker activ pentru etapă până alege altul. Blocată de firestore.rules
// (nu doar de UI) după lock-ul meciului care avea Jokerul.
export async function deleteJoker(gameweekId, uid) {
  await deleteDoc(doc(db, "jokers", `${gameweekId}_${uid}`));
}

// Citire best-effort a pronosticului UNUI ALT user pentru UN meci —
// folosită de Player Detail când documentul public gameweekLiveScores încă
// arată `predictionHidden: true` (posibil pentru că adminul nu a republicat
// de la lock încoace). NU decidem noi dacă e permis — încercăm citirea
// directă din predictions/{matchId}_{uid} și lăsăm firestore.rules să
// accepte sau să refuze, exact ca la orice altă citire. Un refuz
// (permission-denied) înseamnă doar "încă ascuns", nu o eroare de
// aplicație — întoarcem null, silențios. Rezultatul reflectă mereu starea
// REALĂ, server-side, a lock-ului — nu ceasul telefonului adminului.
export async function tryLoadPrediction(matchId, uid) {
  try {
    const snap = await getDoc(doc(db, "predictions", `${matchId}_${uid}`));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    return null;
  }
}
