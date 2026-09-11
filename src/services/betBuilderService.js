// ══════════════════════════════════════════════════════════════════
// 🎟️ BET BUILDER — Surpriza Mare/Duel, bazată pe cele 3 ⭐ Meciuri ale
// Săptămânii. Structură Firestore MINIMĂ, gândită explicit să evite
// duplicarea:
//
// betBuilders/{gameweekId}  — UN SINGUR document, tot ce e COMUN:
//   { status: "draft"|"active",
//     matchGroups: [{ matchId, questions:[{id,text,options}], results:{qId:"pending"|"hit"|"miss"}, tiebreakerText, tiebreakerRealAnswer }, x3],
//     duels: [{ id, matchId, playerA, playerB }, x9] }
//   — cele 5 întrebări + cele 5 rezultate sunt STOCATE O SINGURĂ DATĂ
//   per meci, NU per jucător (6 jucători le citesc pe aceleași).
//
// betBuilderPicks/{gameweekId}_{uid} — STRICT ce e per-jucător:
//   { uid, matchId, duelId, opponentUid, picks:{qId:optionIndex},
//     tiebreakerAnswer, confirmed, confirmedAt, finalPoints, pointsAwarded }
//
// SECRET (Varianta A, aprobată explicit) — ACELAȘI nivel ca la
// predicțiile normale ale aplicației: Firestore Rules NEATINSE, nicio
// protecție server-side nouă. Aplicația pur și simplu NU citește
// biletul adversarului decât DUPĂ ce userul și-a confirmat propriul
// bilet (gardă client-side, exact tiparul canRevealPredictions()).
// ══════════════════════════════════════════════════════════════════
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { listActiveUserIds } from "./adminService";

const POINTS_PER_HIT = 20;
const PERFECT_BONUS = 50;
const DUEL_WIN_BONUS = 50;
const QUESTIONS_PER_MATCH = 5;

// ── Deadline propriu, SEPARAT de cel al predicțiilor normale (30 min) —
// 12 ore înainte de meciul repartizat, exact cerut. Funcție pură,
// testabilă izolat, nu atinge deloc matchLockRule.js. ──
export const BET_BUILDER_DEADLINE_HOURS = 12;
export function isBetBuilderLocked(match, now = Date.now()) {
  const kickoffMs = match?.kickoffAt?.toMillis ? match.kickoffAt.toMillis() : null;
  if (kickoffMs === null) return false;
  return now >= kickoffMs - BET_BUILDER_DEADLINE_HOURS * 60 * 60 * 1000;
}

function betBuilderRef(gameweekId) {
  return doc(db, "betBuilders", gameweekId);
}
function pickRef(gameweekId, uid) {
  return doc(db, "betBuilderPicks", `${gameweekId}_${uid}`);
}

// ── Amestecare Fisher-Yates — folosită STRICT la generarea inițială. ──
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ══════════════════════════════════════════════════════════════════
// ADMIN — generare
// ══════════════════════════════════════════════════════════════════

// ── Generează cele 9 dueluri O SINGURĂ DATĂ, persistate — un refresh/
// redeploy/redeschidere NU regenerează nimic, pentru că funcția verifică
// ÎNTÂI dacă documentul chiar există deja și refuză explicit dacă da. ──
export async function generateBetBuilderDuels(gameweekId, featuredMatchIds) {
  if (!featuredMatchIds || featuredMatchIds.length !== 3) {
    throw new Error(`Bet Builder necesită exact 3 Meciuri ale Săptămânii — am găsit ${featuredMatchIds?.length ?? 0}.`);
  }
  const existing = await getDoc(betBuilderRef(gameweekId));
  if (existing.exists()) {
    throw new Error("Bet Builder pentru această etapă a fost deja generat — duelurile sunt deja persistate. Nu se regenerează automat.");
  }

  const activeSet = await listActiveUserIds();
  const activeUids = Array.from(activeSet);
  if (activeUids.length !== 18) {
    throw new Error(`Bet Builder necesită exact 18 jucători activi — am găsit ${activeUids.length}. Verifică lista de jucători activi înainte de generare.`);
  }

  const shuffled = shuffle(activeUids);
  const matchGroups = [];
  const duels = [];
  featuredMatchIds.forEach((matchId, mIdx) => {
    const slice = shuffled.slice(mIdx * 6, mIdx * 6 + 6); // 6 jucători pentru acest meci
    for (let d = 0; d < 3; d++) {
      const playerA = slice[d * 2];
      const playerB = slice[d * 2 + 1];
      duels.push({ id: `${matchId}_d${d + 1}`, matchId, playerA, playerB });
    }
    matchGroups.push({
      matchId, questions: [], results: {}, tiebreakerText: "", tiebreakerRealAnswer: null,
    });
  });

  await setDoc(betBuilderRef(gameweekId), {
    gameweekId, status: "draft", matchGroups, duels,
    createdAt: serverTimestamp(),
  });
  return { matchGroups, duels };
}

export async function getBetBuilder(gameweekId) {
  const snap = await getDoc(betBuilderRef(gameweekId));
  return snap.exists() ? snap.data() : null;
}

// ── Setează cele 5 întrebări + baraj pentru UN meci — nu atinge
// celelalte 2 grupuri. ──
export async function setMatchQuestions(gameweekId, matchId, questions, tiebreakerText) {
  if (!questions || questions.length !== QUESTIONS_PER_MATCH) {
    throw new Error(`Fiecare meci trebuie să aibă exact ${QUESTIONS_PER_MATCH} selecții — am primit ${questions?.length ?? 0}.`);
  }
  const bb = await getBetBuilder(gameweekId);
  if (!bb) throw new Error("Bet Builder nu a fost generat încă pentru această etapă.");
  const matchGroups = bb.matchGroups.map((g) => g.matchId === matchId
    ? { ...g, questions: questions.map((q, i) => ({ id: q.id || `q${i + 1}`, text: q.text, options: q.options })), tiebreakerText: tiebreakerText || "" }
    : g);
  await updateDoc(betBuilderRef(gameweekId), { matchGroups });
}

export async function activateBetBuilder(gameweekId) {
  const bb = await getBetBuilder(gameweekId);
  if (!bb) throw new Error("Bet Builder nu a fost generat încă.");
  const incomplete = bb.matchGroups.find((g) => g.questions.length !== QUESTIONS_PER_MATCH || !g.tiebreakerText);
  if (incomplete) throw new Error(`Meciul ${incomplete.matchId} nu are toate cele ${QUESTIONS_PER_MATCH} selecții și/sau întrebarea de baraj completate.`);
  await updateDoc(betBuilderRef(gameweekId), { status: "active", activatedAt: serverTimestamp() });
}

// ══════════════════════════════════════════════════════════════════
// ADMIN — rezolvare (15 evenimente comune + 3 baraje)
// ══════════════════════════════════════════════════════════════════

// Idempotent prin construcție — rescrie STRICT statusul cerut, oricât
// de des e apelat; nu există nicio acumulare/incrementare aici.
export async function resolveQuestion(gameweekId, matchId, questionId, result) {
  if (!["pending", "hit", "miss"].includes(result)) throw new Error("Status invalid pentru selecție.");
  const bb = await getBetBuilder(gameweekId);
  if (!bb) throw new Error("Bet Builder inexistent.");
  const matchGroups = bb.matchGroups.map((g) => g.matchId === matchId
    ? { ...g, results: { ...g.results, [questionId]: result } }
    : g);
  await updateDoc(betBuilderRef(gameweekId), { matchGroups });
}

export async function resolveTiebreaker(gameweekId, matchId, realAnswer) {
  const bb = await getBetBuilder(gameweekId);
  if (!bb) throw new Error("Bet Builder inexistent.");
  const matchGroups = bb.matchGroups.map((g) => g.matchId === matchId
    ? { ...g, tiebreakerRealAnswer: Number(realAnswer) }
    : g);
  await updateDoc(betBuilderRef(gameweekId), { matchGroups });
}

// ── Recalculează TOATE cele 9 dueluri dintr-o dată — pentru Admin, după
// ce a marcat evenimentele. Idempotent (fiecare duel individual e
// idempotent) — sigur de apăsat de câte ori e nevoie, inclusiv după
// corectarea unui rezultat greșit marcat anterior. ──
export async function resolveAllDuels(gameweekId) {
  const bb = await getBetBuilder(gameweekId);
  if (!bb) throw new Error("Bet Builder inexistent.");
  const outcomes = [];
  for (const duel of bb.duels) {
    const matchGroup = bb.matchGroups.find((g) => g.matchId === duel.matchId);
    const res = await computeAndSaveDuelScore(gameweekId, duel, matchGroup);
    outcomes.push({ duelId: duel.id, computed: !!res });
  }
  return outcomes;
}

// ══════════════════════════════════════════════════════════════════
// SCORING — funcție PURĂ, testabilă izolat, NU scrie nimic singură.
// Calculează punctajul unui jucător dintr-un duel, dat fiind:
// - propriile picks;
// - picks-urile adversarului (pentru compararea numărului de reușite);
// - rezultatele comune ale meciului;
// - baraj (dacă egalitate).
// ══════════════════════════════════════════════════════════════════
// ── Convenție fixă, simplă: fiecare întrebare are exact 2 opțiuni
// (index 0 și 1 — ex. "Peste"/"Sub", "DA"/"NU"). Admin rezolvă
// evenimentul DESCRIS DE TEXTUL întrebării (ex. "Peste 9,5 cornere"):
// ✅ IEȘIT înseamnă opțiunea de index 0 a fost corectă; ❌ RATAT
// înseamnă opțiunea de index 1 a fost corectă. O selecție a jucătorului
// numără ca reușită DOAR dacă opțiunea aleasă de el chiar coincide cu
// cea rezolvată — nu doar dacă întrebarea, în general, s-a rezolvat. ──
export function countHits(picks, results) {
  return Object.entries(picks).filter(([qId, optionIdx]) => {
    const outcome = results[qId]; // "hit" | "miss" | "pending"/undefined
    if (outcome !== "hit" && outcome !== "miss") return false; // încă nerezolvat, nu numără
    const correctOptionIdx = outcome === "hit" ? 0 : 1;
    return optionIdx === correctOptionIdx;
  }).length;
}

export function computeDuelResult({ myPicks, opponentPicks, results, myTiebreaker, opponentTiebreaker, tiebreakerRealAnswer }) {
  const myHits = countHits(myPicks, results);
  const oppHits = countHits(opponentPicks, results);
  // ── REPARAT — Object.values({}).every(...) e adevărat vacuu pentru un
  // obiect gol, deci "toate rezolvate" ar fi ieșit TRUE înainte ca vreo
  // întrebare să fi fost rezolvată vreodată. Verificăm explicit că toate
  // cele 5 întrebări ale biletului (din myPicks, garantat complet la
  // confirmare) au un rezultat hit/miss — nu doar ce există în results. ──
  const questionIds = Object.keys(myPicks || {});
  const allResolved = questionIds.length === QUESTIONS_PER_MATCH
    && questionIds.every((qId) => results[qId] === "hit" || results[qId] === "miss");

  const basePoints = myHits * POINTS_PER_HIT;
  const perfect = allResolved && myHits === QUESTIONS_PER_MATCH;
  const perfectBonus = perfect ? PERFECT_BONUS : 0;

  let duelBonus = 0;
  let duelOutcome = "pending"; // "win" | "lose" | "draw" | "pending"
  if (allResolved) {
    if (myHits > oppHits) { duelBonus = DUEL_WIN_BONUS; duelOutcome = "win"; }
    else if (myHits < oppHits) { duelOutcome = "lose"; }
    else {
      // Egalitate — barajul decide DOAR bonusul de duel.
      duelOutcome = "draw";
      if (tiebreakerRealAnswer != null && myTiebreaker != null && opponentTiebreaker != null) {
        const myDist = Math.abs(myTiebreaker - tiebreakerRealAnswer);
        const oppDist = Math.abs(opponentTiebreaker - tiebreakerRealAnswer);
        if (myDist < oppDist) duelBonus = DUEL_WIN_BONUS;
        else if (myDist === oppDist) duelBonus = DUEL_WIN_BONUS / 2; // +25 fiecare, la egalitate perfectă
      }
    }
  }

  return {
    myHits, oppHits, basePoints, perfect, perfectBonus, duelOutcome, duelBonus,
    totalPoints: allResolved ? basePoints + perfectBonus + duelBonus : null, // null = încă nedeterminat
    allResolved,
  };
}

// ── Calculează și SCRIE punctajul final pentru AMBII jucători ai unui
// duel — apelată de Admin, sigur de rulat de câte ori e nevoie
// (idempotent: rescrie mereu aceeași valoare corectă, nu adună). ──
export async function computeAndSaveDuelScore(gameweekId, duel, matchGroup) {
  const [pickASnap, pickBSnap] = await Promise.all([getDoc(pickRef(gameweekId, duel.playerA)), getDoc(pickRef(gameweekId, duel.playerB))]);
  if (!pickASnap.exists() || !pickBSnap.exists()) return null; // cineva n-a confirmat deloc — nimic de calculat
  const pickA = pickASnap.data();
  const pickB = pickBSnap.data();
  if (!pickA.confirmed || !pickB.confirmed) return null; // se calculează DOAR după confirmarea AMBILOR

  const resultA = computeDuelResult({
    myPicks: pickA.picks, opponentPicks: pickB.picks, results: matchGroup.results,
    myTiebreaker: pickA.tiebreakerAnswer, opponentTiebreaker: pickB.tiebreakerAnswer,
    tiebreakerRealAnswer: matchGroup.tiebreakerRealAnswer,
  });
  const resultB = computeDuelResult({
    myPicks: pickB.picks, opponentPicks: pickA.picks, results: matchGroup.results,
    myTiebreaker: pickB.tiebreakerAnswer, opponentTiebreaker: pickA.tiebreakerAnswer,
    tiebreakerRealAnswer: matchGroup.tiebreakerRealAnswer,
  });

  if (resultA.totalPoints != null) {
    await updateDoc(pickRef(gameweekId, duel.playerA), { finalPoints: resultA.totalPoints, pointsAwarded: true });
    await saveToWeeklySurpriseResults(gameweekId, duel.playerA, resultA);
  }
  if (resultB.totalPoints != null) {
    await updateDoc(pickRef(gameweekId, duel.playerB), { finalPoints: resultB.totalPoints, pointsAwarded: true });
    await saveToWeeklySurpriseResults(gameweekId, duel.playerB, resultB);
  }
  return { resultA, resultB };
}

// ── Scrie în ACEEAȘI subcolecție deja citită de finalizarea etapei
// (weeklySurprises/{gameweekId}/results/{uid}) — ZERO atingere a
// finalizeGameweek() însuși, care citește deja generic de-aici,
// indiferent de tipul surprizei. mainPoints = scor + bonus Perfect
// (max 150), bonusPoints = bonusul de duel (max 50) — aceeași
// distincție main/bonus deja folosită de celelalte tipuri de surprize.
// merge:true — nu suprascrie alte câmpuri, dacă vreodată coexistă. ──
async function saveToWeeklySurpriseResults(gameweekId, uid, result) {
  const ref = doc(db, "weeklySurprises", gameweekId, "results", uid);
  await setDoc(ref, {
    mainPoints: result.basePoints + result.perfectBonus,
    bonusPoints: result.duelBonus,
    source: "betBuilder",
  }, { merge: true });
}

// ══════════════════════════════════════════════════════════════════
// JUCĂTOR
// ══════════════════════════════════════════════════════════════════

// ── Tot ce are nevoie ecranul jucătorului, într-o singură citire a
// documentului comun + citirea propriului bilet. NICIODATĂ biletul
// adversarului aici. ──
export async function getMyBetBuilderView(gameweekId, uid) {
  const bb = await getBetBuilder(gameweekId);
  if (!bb || bb.status !== "active") return null;
  const duel = bb.duels.find((d) => d.playerA === uid || d.playerB === uid);
  if (!duel) return null; // userul nu a fost repartizat (ex. n-a fost activ la generare)
  const matchGroup = bb.matchGroups.find((g) => g.matchId === duel.matchId);
  const opponentUid = duel.playerA === uid ? duel.playerB : duel.playerA;

  const [mySnap, matchSnap] = await Promise.all([
    getDoc(pickRef(gameweekId, uid)),
    getDoc(doc(db, "matches", duel.matchId)),
  ]);
  const myPick = mySnap.exists() ? mySnap.data() : null;
  const match = matchSnap.exists() ? { id: matchSnap.id, ...matchSnap.data() } : null;

  return { duel, matchGroup, opponentUid, myPick, match };
}

export async function saveMyPicks(gameweekId, uid, { matchId, duelId, opponentUid, picks, tiebreakerAnswer }) {
  const existing = await getDoc(pickRef(gameweekId, uid));
  if (existing.exists() && existing.data().confirmed) {
    throw new Error("Biletul e deja confirmat — nu mai poate fi modificat.");
  }
  await setDoc(pickRef(gameweekId, uid), {
    gameweekId, uid, matchId, duelId, opponentUid, picks, tiebreakerAnswer,
    confirmed: false, updatedAt: serverTimestamp(),
  }, { merge: true });
}

// ── Confirmare — idempotentă: dacă e deja confirmat, nu face nimic
// (previne dublu-tap / dublă scriere). Validează complet ÎNAINTE de
// a bloca biletul. ──
export async function confirmMyTicket(gameweekId, uid, questionsCount) {
  const snap = await getDoc(pickRef(gameweekId, uid));
  if (!snap.exists()) throw new Error("Nu ai încă niciun bilet salvat.");
  const data = snap.data();
  if (data.confirmed) return data; // deja confirmat — no-op, exact cerut
  const answeredCount = Object.keys(data.picks || {}).length;
  if (answeredCount !== questionsCount) {
    throw new Error(`Trebuie să completezi toate cele ${questionsCount} selecții înainte de confirmare.`);
  }
  if (data.tiebreakerAnswer == null || data.tiebreakerAnswer === "") {
    throw new Error("Trebuie să răspunzi și la întrebarea de baraj înainte de confirmare.");
  }
  await updateDoc(pickRef(gameweekId, uid), { confirmed: true, confirmedAt: serverTimestamp() });
  return { ...data, confirmed: true };
}

// ── Regula de reveal — funcție PURĂ, testabilă, aceeași filosofie ca
// matchLockRule.canRevealPredictions(): un singur loc care decide DACĂ
// e voie să citim biletul adversarului. Apelantul TREBUIE să verifice
// asta ÎNAINTE de a apela getOpponentPick — exact convenția predicțiilor,
// nicio protecție server-side nouă (Varianta A, aprobată). ──
export function canRevealOpponent(myPick) {
  return !!myPick?.confirmed;
}

// ── Citește biletul adversarului — apelată STRICT după ce
// canRevealOpponent(myPick) e true. Dacă adversarul încă n-a confirmat,
// întoarce doar confirmed:false — apelantul nu afișează picks-urile
// lui până la confirmed:true (aceeași convenție ca la predicții). ──
export async function getOpponentPick(gameweekId, opponentUid) {
  const snap = await getDoc(pickRef(gameweekId, opponentUid));
  return snap.exists() ? snap.data() : null;
}
