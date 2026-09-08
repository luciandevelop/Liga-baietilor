import { collection, doc, getDoc, getDocs, query, where, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { listMatches } from "./adminService";
import { LOCK_MINUTES_BEFORE_KICKOFF, isMatchLocked } from "./matchLockRule";

export { LOCK_MINUTES_BEFORE_KICKOFF, isMatchLocked };

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
// ── Etapa "curentă" — REPARAT: înainte se decidea STRICT după interval
// de date (now între weekStart/weekEnd), deci la trecerea de weekEnd
// (duminică 23:59→00:00) nicio etapă nu mai era "curentă" și TOT ce
// depindea de asta dispărea din aplicație (meciuri, rezultate, Surpriza
// săptămânii) — deși Adminul nu finalizase încă nimic. Regulă nouă,
// cerută explicit: etapa rămâne curentă/vizibilă până la finalizarea
// EXPLICITĂ din Admin (gameweeks/{id}.status === "completed" — același
// câmp deja folosit la finalizare, nu un mecanism nou).
//
// Ordine de căutare:
// 1. Etapa "în plină desfășurare" (now în [weekStart, weekEnd]) — cazul
//    normal, comportament NESCHIMBAT.
// 2. Dacă nicio etapă nu se potrivește (fie între etape, fie am trecut
//    de weekEnd al ultimei), căutăm cea mai recentă etapă care CHIAR a
//    început (weekStart <= now) și care NU e încă finalizată de Admin —
//    exact cazul "etapa s-a terminat calendaristic, dar Adminul n-a
//    apăsat încă Finalizează". Rămâne vizibilă.
// 3. Dacă nici asta nu găsește nimic (nicio etapă n-a început încă —
//    ex. înainte de prima etapă a sezonului), întoarce null, EXACT ca
//    înainte — nu arătăm o etapă viitoare mai devreme decât trebuie.
//
// NU schimbă în niciun fel regulile de deadline pentru pronosticuri
// (isBeforeLock/isAfterLock, complet separate, neatinse) — doar CE
// etapă se consideră "curentă" pentru afișare.
async function resolveCurrentGameweek(seasonId) {
  const snap = await getDocs(query(collection(db, "gameweeks"), where("seasonId", "==", seasonId)));
  const gameweeks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (gameweeks.length === 0) return null;

  const now = Date.now();
  const bounds = (g) => ({
    start: g.weekStart?.toMillis ? g.weekStart.toMillis() : null,
    end: g.weekEnd?.toMillis ? g.weekEnd.toMillis() : null,
  });

  const withinWeek = gameweeks.find((g) => {
    const { start, end } = bounds(g);
    return start !== null && end !== null && now >= start && now <= end;
  });
  if (withinWeek) return withinWeek;

  const startedNotCompleted = gameweeks
    .filter((g) => {
      const { start } = bounds(g);
      return start !== null && start <= now && g.status !== "completed";
    })
    .sort((a, b) => bounds(b).start - bounds(a).start);
  if (startedNotCompleted.length > 0) return startedNotCompleted[0];

  return null;
}

export async function getCurrentSeason() {
  return resolveCurrentSeason();
}

export async function getCurrentGameweek(seasonId) {
  return resolveCurrentGameweek(seasonId);
}

// Predicțiile existente ale userului pentru un set de meciuri — citire
// directă pe ID determinist (matchId_uid), fără query, deci fără index.
// ── REPARAT (audit Firestore reads, P0, aprobat explicit) — înainte
// făcea o citire INDIVIDUALĂ per meci (matchIds.length citiri, chiar și
// pentru meciuri nepronosticate încă). Acum: O SINGURĂ interogare, pe
// un singur câmp simplu (userId==) — indexat AUTOMAT de Firestore
// dintotdeauna, deci ZERO risc de index compus lipsă la prima rulare
// (spre deosebire de o interogare userId+matchId combinată, care ar
// necesita un index nou, netestat, riscant într-o zi de concurs real).
// Filtrarea la EXACT meciurile cerute (matchIds) se face local, în
// memorie, după citire — echivalent matematic garantat cu varianta
// veche: fiecare document de predicție are câmpul matchId setat
// EXACT la componenta din ID-ul lui determinist (matchId_uid, verificat
// direct în savePredictionForMatch), deci filtrarea locală găsește
// exact aceleași predicții pe care le-ar fi găsit citirea individuală,
// nici mai multe, nici mai puține.
//
// Notă pentru viitor (comunicată explicit, nu rezolvată acum — Reset-ul
// golește "predictions" complet, deci acum, la începutul ediției, users
// au doar predicțiile etapei curente; pe termen lung, peste multe
// etape, userId== va reveni tot mai multe documente istorice; rămâne
// totuși un singur query, cost crescător dar liniar, nu un risc de
// stabilitate acum).
export async function loadUserPredictions(uid, matchIds) {
  const matchIdSet = new Set(matchIds);
  const snap = await getDocs(query(collection(db, "predictions"), where("userId", "==", uid)));
  const results = {};
  snap.docs.forEach((d) => {
    const data = d.data();
    if (matchIdSet.has(data.matchId)) results[data.matchId] = data;
  });
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

// ── Joker Extra ──────────────────────────────────────────────────────
// Câștigat prin Mystery Box (cutii speciale), NU ales liber ca Jokerul
// normal de mai sus — care rămâne complet neatins de tot ce urmează.
// Colecție SEPARATĂ (`jokerExtra`), aceeași structură/convenție de ID
// determinist (`{gameweekId}_{uid}`) ca Jokerul normal, dar independentă:
// nimic din codul de mai sus nu știe că asta există. Eligibilitatea (a
// găsit sau nu o cutie Joker Extra în etapa asta) NU se ține aici — se
// verifică live din Mystery Box, vezi surprisesService.checkJokerExtraEligibility.
export async function loadUserJokerExtra(gameweekId, uid) {
  const snap = await getDoc(doc(db, "jokerExtra", `${gameweekId}_${uid}`));
  return snap.exists() ? snap.data() : null;
}

export async function saveJokerExtra({ gameweekId, uid, matchId }) {
  const ref = doc(db, "jokerExtra", `${gameweekId}_${uid}`);
  await setDoc(ref, { userId: uid, gameweekId, matchId }, { merge: false });
}

export async function deleteJokerExtra(gameweekId, uid) {
  await deleteDoc(doc(db, "jokerExtra", `${gameweekId}_${uid}`));
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

// ── Toate pronosticurile unui meci — DOAR pentru afișare după lock/live/
// finished. Regulile Firestore (predictions) resping complet interogarea
// dacă meciul nu e încă blocat (fiecare document trebuie să treacă
// isAfterLock individual) — nu ascundem noi în UI, chiar serverul refuză.
// Se apelează STRICT la cerere (deschiderea acordeonului sau a 👁),
// niciodată la încărcarea Home sau a listei complete de meciuri.
export async function listPredictionsForMatch(matchId) {
  const snap = await getDocs(query(collection(db, "predictions"), where("matchId", "==", matchId)));
  return snap.docs.map((d) => d.data());
}
