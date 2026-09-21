// ══════════════════════════════════════════════════════════════════
// 📈📉 MAI MARE / MAI MIC — Surpriză Principală, Duel, max 200 PCT.
//
// STRUCTURĂ FIRESTORE (STRICT izolată de celelalte Surprize):
//
// weeklySurprises/{gameweekId}                — document PĂRINTE, deja
//   existent, regulă NEATINSĂ (read: isSignedIn, write: isAdmin).
//   Câmpuri NOI, aditive, scrise de Admin:
//     higherLowerDeadlineAt (Timestamp) — 12h înainte de primul dintre
//       cele 3 ⭐ Meciuri ale Săptămânii. Sursă de adevăr pentru Rules.
//     higherLowerRevealed (bool) — Admin dezvăluie barajele adversarilor.
//
// weeklySurprises/{gameweekId}/secret/main    — document deja existent,
//   regulă NEATINSĂ, tip generic {type, ...}. Pentru acest joc:
//     { type: "higherLower",
//       matchIds: [m1, m2, m3],
//       questions: [{id, matchId, criteria, threshold, unit}, x6],
//       duels: { [duelId]: { playerA, playerB, starterUid } },  // x9
//       results: { [questionId]: "mai_mare"|"mai_mic"|null } }
//
// weeklySurprises/{gameweekId}/higherLowerPicks/{duelId}_{uid}_{questionId}
//   — NOU. Un document PER alegere/rundă, definitiv la creare (Rules:
//   update mereu interzis). { uid, duelId, questionId, roundNumber, choice, createdAt }
//
// weeklySurprises/{gameweekId}/higherLowerTiebreakers/{uid}
//   — NOU. Estimarea secretă de baraj. { uid, value, createdAt }
//
// weeklySurprises/{gameweekId}/results/{uid} — deja existent, regulă
//   NEATINSĂ. Scorul final, aceeași subcolecție generică citită de
//   finalizarea etapei (source: "higherLower", ca la Bet Builder).
// ══════════════════════════════════════════════════════════════════
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { listActiveUserIds } from "./adminService";

const POINTS_PER_ROUND = 25;
const DUEL_WIN_BONUS = 50;
export const HIGHER_LOWER_DEADLINE_HOURS = 12;
export const CHOICE_MORE = "mai_mare";
export const CHOICE_LESS = "mai_mic";

function secretRef(gameweekId) {
  return doc(db, "weeklySurprises", gameweekId, "secret", "main");
}
function parentRef(gameweekId) {
  return doc(db, "weeklySurprises", gameweekId);
}
function pickRef(gameweekId, duelId, uid, questionId) {
  return doc(db, "weeklySurprises", gameweekId, "higherLowerPicks", `${duelId}_${uid}_${questionId}`);
}
function tiebreakerRef(gameweekId, uid) {
  return doc(db, "weeklySurprises", gameweekId, "higherLowerTiebreakers", uid);
}

// ── Amestecare Fisher-Yates — locală, izolată (nu import din
// betBuilderService, ca cele două jocuri să rămână complet decuplate). ──
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function roundIsOdd(roundNumber) {
  return roundNumber === 1 || roundNumber === 3 || roundNumber === 5;
}

// ══════════════════════════════════════════════════════════════════
// ADMIN — generare
// ══════════════════════════════════════════════════════════════════

// ── Generează cele 9 perechi + starter RANDOM, o singură dată,
// persistat — refuză explicit dacă documentul există deja (nu
// rerandomizează la refresh/reload). Scrie și deadline-ul (12h înainte
// de primul dintre cele 3 meciuri), pe documentul PĂRINTE — sursă de
// adevăr și pentru Rules. ──
export async function generateHigherLower(gameweekId, featuredMatchIds, kickoffMsByMatchId) {
  if (!featuredMatchIds || featuredMatchIds.length !== 3) {
    throw new Error(`Mai Mare/Mai Mic necesită exact 3 Meciuri ale Săptămânii — am găsit ${featuredMatchIds?.length ?? 0}.`);
  }
  const existing = await getDoc(secretRef(gameweekId));
  // ── Verificarea NU se uită doar la `type` — selectarea Surprizei din
  // dropdown-ul MAIN scrie deja {type: "higherLower"} pe acest document
  // (configureSurprise, în surprisesService.js), cu MULT înainte ca
  // "Generează 9 perechi" să fie apăsat vreodată. O verificare doar pe
  // `type` bloca prima generare reală, confundând stub-ul de configurare
  // cu perechi deja generate (bug real, confirmat: matchIds lipsă, 0
  // dueluri, deși eroarea spunea "deja generat"). Acum se verifică
  // explicit că duelurile chiar există. ──
  const existingData = existing.exists() ? existing.data() : null;
  const alreadyGenerated = existingData?.type === "higherLower" && existingData?.duels && Object.keys(existingData.duels).length > 0;
  if (alreadyGenerated) {
    throw new Error("Mai Mare/Mai Mic pentru această etapă a fost deja generat — perechile sunt deja persistate. Nu se regenerează automat.");
  }

  const activeSet = await listActiveUserIds();
  const activeUids = Array.from(activeSet);
  if (activeUids.length !== 18) {
    throw new Error(`Mai Mare/Mai Mic necesită exact 18 jucători activi — am găsit ${activeUids.length}.`);
  }

  const shuffled = shuffle(activeUids);
  const duels = {};
  for (let i = 0; i < 9; i++) {
    const playerA = shuffled[i * 2];
    const playerB = shuffled[i * 2 + 1];
    const starterUid = Math.random() < 0.5 ? playerA : playerB;
    duels[`d${i + 1}`] = { playerA, playerB, starterUid };
  }

  const earliestKickoffMs = Math.min(...featuredMatchIds.map((id) => kickoffMsByMatchId[id]).filter((ms) => ms != null));
  if (!Number.isFinite(earliestKickoffMs)) {
    throw new Error("Nu pot calcula deadline-ul — lipsește ora de start pentru unul dintre cele 3 Meciuri ale Săptămânii.");
  }
  const deadlineAt = new Date(earliestKickoffMs - HIGHER_LOWER_DEADLINE_HOURS * 60 * 60 * 1000);

  await setDoc(secretRef(gameweekId), {
    type: "higherLower", matchIds: featuredMatchIds, questions: [], duels, results: {},
  });
  await updateDoc(parentRef(gameweekId), { higherLowerDeadlineAt: deadlineAt, higherLowerRevealed: false });

  return { duels, deadlineAt };
}

export async function getHigherLower(gameweekId) {
  const snap = await getDoc(secretRef(gameweekId));
  return snap.exists() && snap.data().type === "higherLower" ? snap.data() : null;
}

// ── Setează cele 6 întrebări — exact 2 per meci, praguri STRICT de tip
// X,5 (niciodată întreg), ca egalitatea cu pragul să fie imposibilă. ──
export async function setHigherLowerQuestions(gameweekId, questions) {
  if (!questions || questions.length !== 6) {
    throw new Error(`Trebuie exact 6 întrebări — am primit ${questions?.length ?? 0}.`);
  }
  questions.forEach((q, i) => {
    if (!Number.isFinite(q.threshold) || Number.isInteger(q.threshold)) {
      throw new Error(`Runda ${i + 1}: pragul trebuie să fie de tip X,5 (ex. 2.5) — niciodată număr întreg, ca să evităm egalitatea.`);
    }
  });
  const hl = await getHigherLower(gameweekId);
  if (!hl) throw new Error("Mai Mare/Mai Mic nu a fost generat încă pentru această etapă.");
  await updateDoc(secretRef(gameweekId), {
    questions: questions.map((q, i) => ({
      id: q.id || `q${i + 1}`, matchId: q.matchId, criteria: q.criteria, threshold: q.threshold, unit: q.unit || "",
    })),
  });
}

export async function activateHigherLower(gameweekId) {
  const hl = await getHigherLower(gameweekId);
  if (!hl) throw new Error("Mai Mare/Mai Mic nu a fost generat încă.");
  if (!hl.questions || hl.questions.length !== 6) throw new Error("Trebuie completate toate cele 6 întrebări înainte de activare.");
  await updateDoc(parentRef(gameweekId), { mainRevealed: true });
}

// ── Admin validează UN rezultat comun — folosit de toate cele 9
// duelurile deodată. Idempotent (rescrie, nu adună). ──
export async function resolveHigherLowerQuestion(gameweekId, questionId, result) {
  if (![CHOICE_MORE, CHOICE_LESS].includes(result)) throw new Error("Rezultat invalid pentru rundă.");
  const hl = await getHigherLower(gameweekId);
  if (!hl) throw new Error("Mai Mare/Mai Mic inexistent pentru această etapă.");
  await updateDoc(secretRef(gameweekId), { results: { ...hl.results, [questionId]: result } });
}

export async function revealHigherLowerTiebreakers(gameweekId) {
  await updateDoc(parentRef(gameweekId), { higherLowerRevealed: true });
}

// ── Totalul real de goluri din cele 3 meciuri — STRICT din datele deja
// existente (realScoreA/realScoreB, status "finished"), zero API nou.
// Întoarce null dacă nu toate 3 s-au terminat încă. ──
export async function computeRealGoalsTotal(matches) {
  if (!matches || matches.length !== 3) return null;
  if (matches.some((m) => m.status !== "finished")) return null;
  return matches.reduce((sum, m) => sum + (m.realScoreA ?? 0) + (m.realScoreB ?? 0), 0);
}

// ── Recalculează TOATE cele 9 duelurile — Admin, idempotent (sigur de
// rulat oricând, inclusiv după corectarea unui rezultat). ──
export async function resolveAllHigherLowerDuels(gameweekId, realGoalsTotal) {
  const hl = await getHigherLower(gameweekId);
  if (!hl) throw new Error("Mai Mare/Mai Mic inexistent.");
  const outcomes = [];
  for (const [duelId, duel] of Object.entries(hl.duels)) {
    const res = await computeAndSaveHigherLowerDuelScore(gameweekId, duelId, duel, hl, realGoalsTotal);
    outcomes.push({ duelId, computed: !!res });
  }
  return outcomes;
}

// ── Formula de scoring — PURĂ, exportată explicit ca să fie SINGURA
// sursă de adevăr, folosită atât de rezolvarea reală, cât și de
// preview/mock (evită exact bug-ul găsit: un total hardcodat separat,
// decuplat de calculul real). Formula NU s-a schimbat — doar extrasă. ──
export function computeHigherLowerDuelPoints(winsA, winsB, tbA, tbB, realGoalsTotal) {
  let bonusA = 0, bonusB = 0;
  if (winsA > winsB) bonusA = DUEL_WIN_BONUS;
  else if (winsB > winsA) bonusB = DUEL_WIN_BONUS;
  else if (realGoalsTotal != null && tbA != null && tbB != null) {
    const distA = Math.abs(tbA - realGoalsTotal);
    const distB = Math.abs(tbB - realGoalsTotal);
    if (distA < distB) bonusA = DUEL_WIN_BONUS;
    else if (distB < distA) bonusB = DUEL_WIN_BONUS;
    else { bonusA = DUEL_WIN_BONUS / 2; bonusB = DUEL_WIN_BONUS / 2; }
  }
  return {
    bonusA, bonusB,
    totalA: winsA * POINTS_PER_ROUND + bonusA,
    totalB: winsB * POINTS_PER_ROUND + bonusB,
  };
}

async function computeAndSaveHigherLowerDuelScore(gameweekId, duelId, duel, hl, realGoalsTotal) {
  const picksSnap = await getDocs(query(collection(db, "weeklySurprises", gameweekId, "higherLowerPicks"), where("duelId", "==", duelId)));
  const picksByUid = { [duel.playerA]: {}, [duel.playerB]: {} };
  picksSnap.forEach((d) => {
    const p = d.data();
    if (picksByUid[p.uid]) picksByUid[p.uid][p.questionId] = p.choice;
  });

  const derived = deriveDuelRounds(hl, duel, picksByUid);
  const allResolved = derived.every((r) => r.result != null);
  if (!allResolved) return null;

  let winsA = 0, winsB = 0;
  derived.forEach((r) => {
    if (r.choiceA === r.result) winsA += 1;
    else if (r.choiceB === r.result) winsB += 1;
  });

  const [tbASnap, tbBSnap] = await Promise.all([
    getDoc(tiebreakerRef(gameweekId, duel.playerA)), getDoc(tiebreakerRef(gameweekId, duel.playerB)),
  ]);
  const tbA = tbASnap.exists() ? tbASnap.data().value : null;
  const tbB = tbBSnap.exists() ? tbBSnap.data().value : null;

  const { bonusA, bonusB, totalA, totalB } = computeHigherLowerDuelPoints(winsA, winsB, tbA, tbB, realGoalsTotal);

  await setDoc(doc(db, "weeklySurprises", gameweekId, "results", duel.playerA), {
    mainPoints: winsA * POINTS_PER_ROUND, bonusPoints: bonusA, source: "higherLower",
  }, { merge: true });
  await setDoc(doc(db, "weeklySurprises", gameweekId, "results", duel.playerB), {
    mainPoints: winsB * POINTS_PER_ROUND, bonusPoints: bonusB, source: "higherLower",
  }, { merge: true });

  return { winsA, winsB, totalA, totalB };
}

// ── Pentru fiecare din cele 6 runde, calculează alegerea reală a
// FIECĂRUI jucător (directă dacă are prioritate pe rundă, DEDUSĂ —
// opusul partenerului — dacă nu) ȘI rezultatul validat, dacă există.
// Funcție PURĂ — aceeași folosită de client (view) ȘI de Admin
// (resolve), o singură sursă de adevăr pentru "cine a ales ce". ──
export function deriveDuelRounds(hl, duel, picksByUid) {
  return hl.questions.map((q, idx) => {
    const roundNumber = idx + 1;
    const starterHasPriority = roundIsOdd(roundNumber);
    const priorityUid = starterHasPriority ? duel.starterUid : (duel.starterUid === duel.playerA ? duel.playerB : duel.playerA);
    const otherUid = priorityUid === duel.playerA ? duel.playerB : duel.playerA;
    const priorityChoice = picksByUid[priorityUid]?.[q.id] || null;
    const otherChoice = priorityChoice ? (priorityChoice === CHOICE_MORE ? CHOICE_LESS : CHOICE_MORE) : null;
    const choiceA = duel.playerA === priorityUid ? priorityChoice : otherChoice;
    const choiceB = duel.playerB === priorityUid ? priorityChoice : otherChoice;
    return {
      roundNumber, question: q, priorityUid, otherUid, choiceA, choiceB,
      decided: !!priorityChoice, result: hl.results?.[q.id] || null,
    };
  });
}

// ══════════════════════════════════════════════════════════════════
// JUCĂTOR
// ══════════════════════════════════════════════════════════════════

// ── Tot ce are nevoie ecranul jucătorului. Reveal-ul per rundă e
// IMEDIAT (nu gated) — citim direct alegerile ambilor jucători din
// duel, exact mecanica aprobată. Barajul rămâne separat — citit doar
// dacă owner/Admin/higherLowerRevealed (impus de Rules, nu doar aici). ──
export async function getMyHigherLowerView(gameweekId, uid) {
  const hl = await getHigherLower(gameweekId);
  if (!hl) return null;
  const entry = Object.entries(hl.duels).find(([, d]) => d.playerA === uid || d.playerB === uid);
  if (!entry) return null;
  const [duelId, duel] = entry;
  const opponentUid = duel.playerA === uid ? duel.playerB : duel.playerA;

  const [picksSnap, myTbSnap] = await Promise.all([
    getDocs(query(collection(db, "weeklySurprises", gameweekId, "higherLowerPicks"), where("duelId", "==", duelId))),
    getDoc(tiebreakerRef(gameweekId, uid)),
  ]);
  const picksByUid = { [duel.playerA]: {}, [duel.playerB]: {} };
  picksSnap.forEach((d) => {
    const p = d.data();
    if (picksByUid[p.uid]) picksByUid[p.uid][p.questionId] = p.choice;
  });

  const rounds = deriveDuelRounds(hl, duel, picksByUid);
  const winsMine = rounds.filter((r) => r.result != null && (uid === duel.playerA ? r.choiceA : r.choiceB) === r.result).length;
  const winsOpp = rounds.filter((r) => r.result != null && (opponentUid === duel.playerA ? r.choiceA : r.choiceB) === r.result).length;

  return {
    duelId, duel, opponentUid, rounds, winsMine, winsOpp,
    myTiebreaker: myTbSnap.exists() ? myTbSnap.data().value : null,
  };
}

// ── Toate CELELALTE perechi (exclus a userului) — pentru lista "cine cu
// cine a picat", cerută explicit, ca la Duel/Bet Builder. O SINGURĂ
// interogare (toate picks-urile etapei deodată, nu una per pereche),
// reutilizează EXACT `deriveDuelRounds` — niciun calcul nou de scor. ──
export async function listOtherHigherLowerPairs(gameweekId, myUid) {
  const hl = await getHigherLower(gameweekId);
  if (!hl) return [];
  const picksSnap = await getDocs(collection(db, "weeklySurprises", gameweekId, "higherLowerPicks"));
  const picksByDuelUid = {};
  picksSnap.forEach((d) => {
    const p = d.data();
    if (!picksByDuelUid[p.duelId]) picksByDuelUid[p.duelId] = {};
    if (!picksByDuelUid[p.duelId][p.uid]) picksByDuelUid[p.duelId][p.uid] = {};
    picksByDuelUid[p.duelId][p.uid][p.questionId] = p.choice;
  });
  return Object.entries(hl.duels)
    .filter(([, duel]) => duel.playerA !== myUid && duel.playerB !== myUid)
    .map(([duelId, duel]) => {
      const picksByUid = {
        [duel.playerA]: picksByDuelUid[duelId]?.[duel.playerA] || {},
        [duel.playerB]: picksByDuelUid[duelId]?.[duel.playerB] || {},
      };
      const rounds = deriveDuelRounds(hl, duel, picksByUid);
      const winsA = rounds.filter((r) => r.result != null && r.choiceA === r.result).length;
      const winsB = rounds.filter((r) => r.result != null && r.choiceB === r.result).length;
      return { duelId, playerA: duel.playerA, playerB: duel.playerB, winsA, winsB };
    });
}

// ── O alegere e DEFINITIVĂ la trimitere — Rules interzice update. Aici
// verificăm întâi client-side dacă documentul există deja, ca eroarea
// să fie clară ("ai ales deja"), nu un permission-denied brut. ──
export async function submitHigherLowerPick(gameweekId, duelId, uid, questionId, roundNumber, choice) {
  if (![CHOICE_MORE, CHOICE_LESS].includes(choice)) throw new Error("Alegere invalidă.");
  const ref = pickRef(gameweekId, duelId, uid, questionId);
  const existing = await getDoc(ref);
  if (existing.exists()) throw new Error("Ai ales deja pentru runda asta — alegerea e definitivă.");
  await setDoc(ref, { uid, duelId, questionId, roundNumber, choice, createdAt: serverTimestamp() });
}

// ── Estimarea de baraj — la fel, definitivă la trimitere (Rules
// interzice update). ──
export async function submitHigherLowerTiebreaker(gameweekId, uid, value) {
  if (!Number.isInteger(value) || value < 0) throw new Error("Estimarea trebuie să fie un număr întreg ≥ 0.");
  const ref = tiebreakerRef(gameweekId, uid);
  const existing = await getDoc(ref);
  if (existing.exists()) throw new Error("Ai trimis deja o estimare de baraj.");
  await setDoc(ref, { uid, value, createdAt: serverTimestamp() });
}

export function isHigherLowerLocked(deadlineAt, now = Date.now()) {
  const ms = deadlineAt?.toMillis ? deadlineAt.toMillis() : deadlineAt;
  if (ms == null) return false;
  return now >= ms;
}
