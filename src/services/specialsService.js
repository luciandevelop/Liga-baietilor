import {
  collection, doc, getDoc, getDocs, setDoc, query, where, runTransaction, serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { PICK_TYPES, getPhaseDefinition, SPECIAL_COMPETITIONS } from "../specialDefinitions";

// ── Citire ──────────────────────────────────────────────────────────

// Toate fazele unui sezon, indiferent de status — Admin și playerii
// filtrează local (status/requiresPhase), nu se cere din nou per fază.
export async function listSpecialPhases(seasonId) {
  const snap = await getDocs(query(collection(db, "specialPhases"), where("seasonId", "==", seasonId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Propria alegere a userului pentru o fază — mereu permisă (regulă:
// userul își citește mereu propriile date).
export async function loadOwnSpecialPick(phaseId, uid) {
  const snap = await getDoc(doc(db, "specialPicks", `${phaseId}_${uid}`));
  return snap.exists() ? snap.data() : null;
}

// Alegerile TUTUROR pentru o fază — funcționează doar după închidere,
// exact ca la meciuri (regula reală se verifică server-side, nu aici;
// dacă faza nu s-a închis încă, interogarea întoarce eroare de
// permisiuni, nu date parțiale).
export async function loadAllSpecialPicks(phaseId) {
  const snap = await getDocs(query(collection(db, "specialPicks"), where("phaseId", "==", phaseId)));
  return snap.docs.map((d) => d.data());
}

// Progresul unui user pe toate fazele unui sezon — pentru cardul de
// competiție ("6/8 → +1400p") și pentru totalul de Puncte Speciale.
export async function getUserSpecialProgress(uid, seasonId) {
  const [phases, scoresSnap, picksSnap] = await Promise.all([
    listSpecialPhases(seasonId),
    getDocs(query(collection(db, "specialScores"), where("userId", "==", uid))),
    getDocs(query(collection(db, "specialPicks"), where("userId", "==", uid))),
  ]);
  const scoresByPhase = Object.fromEntries(scoresSnap.docs.map((d) => [d.data().phaseId, d.data()]));
  const picksByPhase = Object.fromEntries(picksSnap.docs.map((d) => [d.data().phaseId, d.data()]));
  const totalPoints = Object.values(scoresByPhase).reduce((sum, s) => sum + (s.points || 0), 0);
  return { phases, scoresByPhase, picksByPhase, totalPoints };
}

// ── Scriere — Admin ────────────────────────────────────────────────

// Deschide/actualizează o fază — creează documentul dacă nu există,
// altfel doar actualizează opțiunile/orarul (nu atinge picks-urile deja
// salvate de useri).
export async function openSpecialPhase({ seasonId, phaseId, competitionId, closesAt, options }) {
  await setDoc(
    doc(db, "specialPhases", phaseId),
    { seasonId, phaseId, competitionId, status: "open", closesAt, options, correctAnswer: null, resolvedAt: null },
    { merge: true }
  );
}

export async function closeSpecialPhase(phaseId) {
  await setDoc(doc(db, "specialPhases", phaseId), { status: "closed" }, { merge: true });
}

// ── Scorare — generică, ramifică STRICT pe phase.type, niciodată pe
// competiție. O competiție nouă (Mondial, EURO) refolosește automat
// aceeași logică, atâta timp cât fazele ei folosesc unul din cele 3 tipuri.
function scoreSinglePick(pick, correctAnswer, points) {
  return pick?.choice === correctAnswer ? points : 0;
}
function scoreRankedPick(pick, correctAnswer, { pointsInSet, pointsExact }) {
  const choices = pick?.choices || [];
  const correctSet = new Set(correctAnswer);
  let total = 0;
  choices.forEach((teamId, index) => {
    if (correctAnswer[index] === teamId) total += pointsExact;
    else if (correctSet.has(teamId)) total += pointsInSet;
  });
  return total;
}
function scoreGroupPick(pick, correctAnswer, pointsPerCorrect) {
  const choices = pick?.choices || [];
  const correctSet = new Set(correctAnswer);
  return choices.filter((id) => correctSet.has(id)).length * pointsPerCorrect;
}

function computeSpecialPoints(phaseDef, pick, correctAnswer) {
  if (!pick || correctAnswer == null) return 0;
  switch (phaseDef.type) {
    case PICK_TYPES.SINGLE:
      return scoreSinglePick(pick, correctAnswer, phaseDef.points);
    case PICK_TYPES.RANKED:
      return scoreRankedPick(pick, correctAnswer, phaseDef);
    case PICK_TYPES.GROUP:
      return scoreGroupPick(pick, correctAnswer, phaseDef.pointsPerCorrect);
    default:
      return 0;
  }
}

// Rezolvă o fază: admin introduce răspunsul real, funcția calculează
// punctele TUTUROR userilor care au ales, scrie specialScores, și
// adaugă punctele DIRECT în users/{uid}.seasonPoints — exact același
// total pe care-l citește azi Clasamentul General, Player Card, header-ul
// din Home. Niciun ecran nu trebuie să știe că "există Speciale" separat.
//
// IDEMPOTENT — exact tiparul de la finalizeGameweek: dacă faza e deja
// "resolved", a doua apăsare pe "Rezolvă" nu mai adaugă punctele a doua
// oară.
export async function resolveSpecialPhase(phaseId, correctAnswer) {
  const { phase: phaseDef } = getPhaseDefinition(phaseId) ? { phase: getPhaseDefinition(phaseId).phase } : { phase: null };
  if (!phaseDef) throw new Error(`Fază necunoscută în configurare: ${phaseId}`);

  const phaseRef = doc(db, "specialPhases", phaseId);
  const phaseSnap = await getDoc(phaseRef);
  if (!phaseSnap.exists()) throw new Error("Faza nu există.");
  if (phaseSnap.data().status === "resolved") {
    return { alreadyResolved: true };
  }

  const picksSnap = await getDocs(query(collection(db, "specialPicks"), where("phaseId", "==", phaseId)));
  const picks = picksSnap.docs.map((d) => d.data());

  // Fiecare user primit e o tranzacție separată — un eșec izolat pe un
  // singur user nu blochează scorarea celorlalți.
  for (const pick of picks) {
    const points = computeSpecialPoints(phaseDef, pick, correctAnswer);
    const scoreRef = doc(db, "specialScores", `${phaseId}_${pick.userId}`);
    const userRef = doc(db, "users", pick.userId);
    await runTransaction(db, async (tx) => {
      const existingScore = await tx.get(scoreRef);
      if (existingScore.exists()) return; // deja scris — nu duplicăm
      const userSnap = await tx.get(userRef);
      const prevPoints = userSnap.exists() ? userSnap.data().seasonPoints || 0 : 0;
      tx.set(scoreRef, { phaseId, userId: pick.userId, points, computedAt: serverTimestamp() });
      tx.update(userRef, { seasonPoints: prevPoints + points });
    });
  }

  await setDoc(phaseRef, { status: "resolved", correctAnswer, resolvedAt: serverTimestamp() }, { merge: true });
  return { alreadyResolved: false, scoredUsers: picks.length };
}

// ── Scriere — Player ───────────────────────────────────────────────

export async function saveSpecialPick(phaseId, uid, pickData) {
  await setDoc(
    doc(db, "specialPicks", `${phaseId}_${uid}`),
    { phaseId, userId: uid, ...pickData, submittedAt: serverTimestamp() },
    { merge: true }
  );
}

// Alegerile TUTUROR, pentru MAI MULTE faze deodată — folosit de
// overview-ul agregat din Admin (secțiunea "Cine a completat
// Specialele"). Reutilizează exact loadAllSpecialPicks per fază, doar
// le rulează în paralel și le combină.
export async function listAllSpecialPicksForPhases(phaseIds) {
  const results = await Promise.all(phaseIds.map((id) => loadAllSpecialPicks(id).catch(() => [])));
  const byPhase = {};
  phaseIds.forEach((id, i) => { byPhase[id] = results[i]; });
  return byPhase;
}

// Lista tuturor competițiilor + fazele lor, din configurare — folosită
// direct de ecrane, fără nicio interogare.
export function listAllSpecialCompetitions() {
  return SPECIAL_COMPETITIONS;
}
