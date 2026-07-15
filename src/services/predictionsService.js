import { collection, doc, getDoc, getDocs, query, where, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { listMatches } from "./adminService";

// Alege sezonul curent: primul al cărui interval [startDate, endDate]
// conține azi. Dacă niciunul nu se potrivește (ex: sezon de test fără
// date reale de sezon), fallback sigur — cel mai recent creat.
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
// [weekStart, weekEnd] conține azi. NU există fallback pe "ultima etapă"
// sau "numărul cel mai mare" — dacă nu există etapă pentru săptămâna
// curentă, întoarce null explicit, ca UI-ul să arate clar "nicio etapă
// activă", nu o etapă trecută/viitoare din greșeală.
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

// Punctul de intrare al paginii: găsește sezonul+etapa curentă și meciurile
// ei, dintr-o singură chemare.
export async function loadCurrentGameweekWithMatches() {
  const season = await resolveCurrentSeason();
  if (!season) return { season: null, gameweek: null, matches: [] };

  const gameweek = await resolveCurrentGameweek(season.id);
  if (!gameweek) return { season, gameweek: null, matches: [] };

  const matches = await listMatches(gameweek.id);
  return { season, gameweek, matches };
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
// Folosit ca să distingem "userul n-a completat încă" de "a completat greșit".
function parseNonNegativeInt(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return undefined;
  return n;
}

// Salvează predicția pentru UN meci. Payload-ul conține DOAR câmpurile cu
// valoare validă — cornere/cartonașe lipsă nu sunt trimise deloc, deci
// merge:true nu le suprascrie dacă existau deja o valoare anterioară.
async function saveSinglePrediction({ matchId, uid, scoreA, scoreB, corners, cards }) {
  const ref = doc(db, "predictions", `${matchId}_${uid}`);
  const payload = { userId: uid, matchId, scoreA, scoreB };
  if (corners !== undefined) payload.corners = corners;
  if (cards !== undefined) payload.cards = cards;
  await setDoc(ref, payload, { merge: true });
}

// Salvează toate predicțiile valide dintr-o etapă, dintr-un singur buton.
// Sare peste meciurile blocate (kickoff trecut) și peste cele fără scor
// completat — nu inventează valori. Raportează clar ce s-a întâmplat cu
// fiecare categorie, ca userul să știe exact starea reală.
export async function saveAllPredictions(uid, matches, predictionsState) {
  let saved = 0;
  let skippedEmpty = 0;
  let invalid = 0;
  const errors = [];

  for (const match of matches) {
    const locked = match.kickoffAt?.toMillis ? match.kickoffAt.toMillis() <= Date.now() : false;
    if (locked) continue;

    const p = predictionsState[match.id] || {};
    const scoreAEmpty = p.scoreA === undefined || p.scoreA === null || p.scoreA === "";
    const scoreBEmpty = p.scoreB === undefined || p.scoreB === null || p.scoreB === "";
    if (scoreAEmpty && scoreBEmpty) {
      skippedEmpty++;
      continue;
    }

    const a = parseNonNegativeInt(p.scoreA);
    const b = parseNonNegativeInt(p.scoreB);
    if (a === undefined || b === undefined) {
      invalid++;
      continue;
    }

    const corners = parseNonNegativeInt(p.corners);
    const cards = parseNonNegativeInt(p.cards);

    try {
      await saveSinglePrediction({ matchId: match.id, uid, scoreA: a, scoreB: b, corners, cards });
      saved++;
    } catch (err) {
      console.error(`Eroare la salvarea meciului ${match.id}:`, err);
      errors.push(`${match.homeTeam} - ${match.awayTeam}: ${err.message || err.code}`);
    }
  }

  return { saved, skippedEmpty, invalid, errors };
}
