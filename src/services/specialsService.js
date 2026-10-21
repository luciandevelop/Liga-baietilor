import {
  collection, doc, getDoc, getDocs, setDoc, query, where, runTransaction, serverTimestamp, updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { PICK_TYPES, getPhaseDefinition, SPECIAL_COMPETITIONS } from "../specialDefinitions";

// ── Specialele NU aparțin unui sezon Play League (fiecare sezon = doar
// 4 etape/săptămâni) — sunt pronosticuri pe termen lung, valabile pe
// TOATĂ ediția Play League 2026/27 (7 sept 2026 – 13 iun 2027, 10
// sezoane). Câmpul "seasonId" de pe specialPhases rămâne neschimbat ca
// NUME/mecanism (nicio arhitectură nouă) — doar valoarea lui e acum
// un identificator FIX, al întregii ediții, nu al sezonului Play
// League curent selectat/activ. Asta decuplează complet ciclul de
// viață al Specialelor de ciclul (mult mai scurt) al sezoanelor. ──
export const SPECIALS_EDITION_ID = "play-league-2026-27";

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
// ── Migrare, o singură dată — Specialele deja create (dinainte de acest
// fix) au încă seasonId-ul sezonului Play League REAL în care au fost
// deschise, deci sunt "invizibile" acum (query-urile caută
// SPECIALS_EDITION_ID). Sigur de rulat oricând, oricâte ori — mută
// DOAR câmpul seasonId, nu atinge status/opțiuni/deadline/rezultate.
// Documentele deja pe SPECIALS_EDITION_ID sunt sărite (idempotent). ──
export async function migrateSpecialPhasesToEdition() {
  const snap = await getDocs(collection(db, "specialPhases"));
  let migrated = 0;
  for (const d of snap.docs) {
    if (d.data().seasonId === SPECIALS_EDITION_ID) continue;
    await updateDoc(doc(db, "specialPhases", d.id), { seasonId: SPECIALS_EDITION_ID });
    migrated++;
  }
  return { migrated, total: snap.docs.length };
}

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

// ── Rezolvare și corectare — ATOMICE ────────────────────────────────────────────────────────────
// O fază se validează (și se corectează) într-O SINGURĂ tranzacție Firestore: scorurile tuturor
// jucătorilor, totalurile users.specialPoints și statusul fazei se scriu ÎMPREUNĂ — fie toate, fie
// niciuna. Nu mai poate rămâne o fază „pe jumătate” scorată, iar două operații concurente se
// serializează (a doua se reia pe starea nouă și fie nu mai are nimic de făcut, fie e refuzată).
//
// Punctele se scriu ca VALOARE-ȚINTĂ în specialScores/{fază}_{uid}, iar users.specialPoints se ajustează
// DOAR cu diferența față de scorul vechi (0 dacă jucătorul n-avea document) — la fel ca la reparația
// Bet Builder. Repetarea aceleiași operații nu dublează nimic; corectarea 500 → 0 scade exact 500, iar
// 0 → 500 adaugă exact 500. Jucătorii fără pronostic nu sunt atinși deloc.
//
// Punctele merg în câmpul SEPARAT users.specialPoints (NU în seasonPoints): seasonPoints rămâne strict
// punctele de etape (resetabil curat), Specialele supraviețuiesc Reset-ului, iar Clasamentul General le
// adună doar la afișare (listGeneralLeaderboard). Etapa și Sezonul nu citesc niciodată specialPoints.
// Compatibil cu „Recalculează puncte Speciale” (migrateSpecialPointsFromScores): sursa de adevăr rămâne
// specialScores, iar users.specialPoints = suma lor.
// Limita Firestore: 500 de scrieri / tranzacție (aici: 2 per jucător + 1) — sub limită pentru grupul real.
const MAX_SPECIAL_TX_WRITES = 450;

function canonAnswer(phaseDef, answer) {
  if (answer == null) return "";
  if (phaseDef.type === PICK_TYPES.GROUP) return JSON.stringify([...answer].map(String).sort()); // ordinea nu contează
  return JSON.stringify(Array.isArray(answer) ? answer.map(String) : String(answer));            // ranked: ordinea contează
}
export function sameSpecialAnswer(phaseDef, a, b) {
  return canonAnswer(phaseDef, a) === canonAnswer(phaseDef, b);
}

// PLAN PUR (fără Firestore): pentru fiecare jucător cu pronostic → puncte noi, puncte vechi, diferență.
// Scorurile fără pronostic („orfane”) NU se ating — se raportează doar.
export function planSpecialScoring(phaseDef, correctAnswer, picksByUid, scoresByUid) {
  const rows = Object.keys(picksByUid).map((uid) => {
    const newPoints = computeSpecialPoints(phaseDef, picksByUid[uid], correctAnswer);
    const score = scoresByUid[uid];
    const hadScore = !!score;
    const oldPoints = hadScore ? (Number(score.points) || 0) : 0;
    return { uid, newPoints, oldPoints, hadScore, delta: newPoints - oldPoints, writeScore: !hadScore || Number(score.points) !== newPoints };
  });
  const orphanScores = Object.keys(scoresByUid).filter((uid) => !picksByUid[uid]);
  return { rows, orphanScores };
}

async function applySpecialResult(phaseId, correctAnswer, { mode, expectedPreviousAnswer }) {
  const found = getPhaseDefinition(phaseId);
  const phaseDef = found ? found.phase : null;
  if (!phaseDef) throw new Error(`Fază necunoscută în configurare: ${phaseId}`);

  const phaseRef = doc(db, "specialPhases", phaseId);
  const pre = await getDoc(phaseRef);
  if (!pre.exists()) throw new Error("Faza nu există.");
  if (mode === "resolve" && pre.data().status === "resolved") return { alreadyResolved: true };
  if (mode === "correct" && pre.data().status !== "resolved") throw new Error("Corectarea e posibilă doar pentru o fază deja rezolvată.");
  // Fază încă deschisă: o închidem întâi — regulile refuză orice alegere nouă când status != "open",
  // deci lista jucătorilor cu pronostic e finală înainte de scorare.
  if (pre.data().status === "open") await closeSpecialPhase(phaseId);

  const picksSnap = await getDocs(query(collection(db, "specialPicks"), where("phaseId", "==", phaseId)));
  const uids = [...new Set(picksSnap.docs.map((d) => d.data().userId).filter(Boolean))];
  if (uids.length * 2 + 1 > MAX_SPECIAL_TX_WRITES) throw new Error("Prea mulți jucători pentru o singură tranzacție atomică.");

  let outcome = null;
  await runTransaction(db, async (tx) => {
    // TOATE citirile mai întâi (cerință Firestore), abia apoi scrierile.
    const phaseSnap = await tx.get(phaseRef);
    if (!phaseSnap.exists()) throw new Error("Faza nu există.");
    const phase = phaseSnap.data();
    if (phase.status === "open") throw new Error("Faza s-a redeschis între timp — reîncearcă.");
    if (mode === "resolve" && phase.status === "resolved") { outcome = { alreadyResolved: true }; return; }
    if (mode === "correct") {
      if (phase.status !== "resolved") throw new Error("Corectarea e posibilă doar pentru o fază deja rezolvată.");
      if (!sameSpecialAnswer(phaseDef, phase.correctAnswer, expectedPreviousAnswer)) {
        throw new Error("Rezultatul oficial s-a schimbat între timp (altă corectare) — reîncarcă pagina și reia.");
      }
    }
    const pickSnaps = await Promise.all(uids.map((u) => tx.get(doc(db, "specialPicks", `${phaseId}_${u}`))));
    const scoreSnaps = await Promise.all(uids.map((u) => tx.get(doc(db, "specialScores", `${phaseId}_${u}`))));
    const userSnaps = await Promise.all(uids.map((u) => tx.get(doc(db, "users", u))));
    const picks = {}, scores = {}, users = {};
    uids.forEach((u, i) => {
      if (pickSnaps[i].exists()) picks[u] = pickSnaps[i].data();
      if (scoreSnaps[i].exists()) scores[u] = scoreSnaps[i].data();
      if (userSnaps[i].exists()) users[u] = userSnaps[i].data();
    });
    const plan = planSpecialScoring(phaseDef, correctAnswer, picks, scores);
    const rows = plan.rows.filter((r) => users[r.uid]);          // un cont șters nu blochează restul
    const skipped = plan.rows.filter((r) => !users[r.uid]).map((r) => r.uid);

    if (mode === "correct" && sameSpecialAnswer(phaseDef, phase.correctAnswer, correctAnswer) && rows.every((r) => !r.writeScore && r.delta === 0)) {
      outcome = { unchanged: true };                              // aceeași confirmare → nicio scriere
      return;
    }
    let changedUsers = 0, totalDelta = 0;
    rows.forEach((r) => {
      if (r.writeScore) tx.set(doc(db, "specialScores", `${phaseId}_${r.uid}`), { phaseId, userId: r.uid, points: r.newPoints, computedAt: serverTimestamp() });
      if (r.delta !== 0) {
        tx.update(doc(db, "users", r.uid), { specialPoints: (Number(users[r.uid].specialPoints) || 0) + r.delta });
        changedUsers++; totalDelta += r.delta;
      }
    });
    tx.set(phaseRef, mode === "resolve" ? { status: "resolved", correctAnswer, resolvedAt: serverTimestamp() } : { correctAnswer }, { merge: true });
    outcome = mode === "resolve"
      ? { alreadyResolved: false, scoredUsers: rows.length, skipped }
      : { corrected: true, changedUsers, totalDelta, skipped };
  });
  return outcome;
}

// Validare (rezolvare) — comportament neschimbat pentru Admin: același nume, aceeași formă a răspunsului,
// acordare IMEDIATĂ în users.specialPoints (Clasamentul General), dar acum atomic și reluabil.
export async function resolveSpecialPhase(phaseId, correctAnswer) {
  return applySpecialResult(phaseId, correctAnswer, { mode: "resolve" });
}

// Corectarea rezultatului oficial al unei faze DEJA validate. `expectedPreviousAnswer` = rezultatul pe care
// Admin îl vedea când a cerut corectarea; dacă între timp s-a schimbat, operația e refuzată.
export async function correctSpecialPhase(phaseId, newAnswer, expectedPreviousAnswer) {
  return applySpecialResult(phaseId, newAnswer, { mode: "correct", expectedPreviousAnswer });
}

// PREVIEW al unei corectări — doar citiri, zero scrieri. Folosit pentru confirmarea explicită din Admin.
export async function previewSpecialCorrection(phaseId, newAnswer) {
  const found = getPhaseDefinition(phaseId);
  const phaseDef = found ? found.phase : null;
  if (!phaseDef) throw new Error(`Fază necunoscută în configurare: ${phaseId}`);
  const phaseSnap = await getDoc(doc(db, "specialPhases", phaseId));
  if (!phaseSnap.exists() || phaseSnap.data().status !== "resolved") throw new Error("Corectarea e posibilă doar pentru o fază deja rezolvată.");
  const [picksSnap, scoresSnap] = await Promise.all([
    getDocs(query(collection(db, "specialPicks"), where("phaseId", "==", phaseId))),
    getDocs(query(collection(db, "specialScores"), where("phaseId", "==", phaseId))),
  ]);
  const picks = {}, scores = {};
  picksSnap.docs.forEach((d) => { const v = d.data(); if (v.userId) picks[v.userId] = v; });
  scoresSnap.docs.forEach((d) => { const v = d.data(); if (v.userId) scores[v.userId] = v; });
  const plan = planSpecialScoring(phaseDef, newAnswer, picks, scores);
  const changed = plan.rows.filter((r) => r.writeScore || r.delta !== 0);
  const currentAnswer = phaseSnap.data().correctAnswer;
  return {
    currentAnswer,
    unchanged: sameSpecialAnswer(phaseDef, currentAnswer, newAnswer) && changed.length === 0,
    rows: changed,
    changedUsers: changed.filter((r) => r.delta !== 0).length,
    totalDelta: changed.reduce((sum, r) => sum + r.delta, 0),
    orphanScores: plan.orphanScores,
  };
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

// ── Detaliile Specialelor pentru FIȘA jucătorului (Clasament General) ─────────────────────────────
// Doar citiri, declanșate DOAR când se deschide fișa: lista fazelor ediției (reținută 5 minute în
// memorie — se schimbă rar) + scorurile ACELUI jucător (o singură interogare, ≤ câteva zeci de
// documente). Fără listener, fără polling. Scorurile NU se rețin (o corectare trebuie să se vadă).
// Stări: "won" (+X PCT) · "zero" (0 PCT) · "nopick" (validat, dar jucătorul n-a pronosticat) ·
// "waiting" (pronosticuri blocate / încă nevalidat) · "open" (pronosticuri deschise).
// Fazele neîncă deschise de Admin nu apar. Un scor existent = fază validată (chiar dacă lista
// reținută are încă o stare mai veche).
const PHASES_CACHE_MS = 5 * 60 * 1000;
let phasesCache = { at: 0, value: null };

export async function getPlayerSpecialsBreakdown(uid) {
  const phasesPromise = phasesCache.value && Date.now() - phasesCache.at < PHASES_CACHE_MS
    ? Promise.resolve(phasesCache.value)
    : listSpecialPhases(SPECIALS_EDITION_ID).then((v) => { phasesCache = { at: Date.now(), value: v }; return v; });
  const [phases, scoresSnap] = await Promise.all([
    phasesPromise,
    getDocs(query(collection(db, "specialScores"), where("userId", "==", uid))),
  ]);
  const phaseById = Object.fromEntries(phases.map((p) => [p.phaseId || p.id, p]));
  const scoreByPhase = Object.fromEntries(scoresSnap.docs.map((d) => [d.data().phaseId, d.data()]));
  const rows = [];
  SPECIAL_COMPETITIONS.forEach((comp) => comp.phases.forEach((ph) => {
    const phase = phaseById[ph.id];
    const score = scoreByPhase[ph.id];
    if (!phase && !score) return;
    let state, points = null;
    if (phase?.status === "resolved" || score) {
      if (score) { points = Number(score.points) || 0; state = points > 0 ? "won" : "zero"; }
      else state = "nopick";
    } else {
      state = phase.status === "open" ? "open" : "waiting";
    }
    rows.push({ phaseId: ph.id, competition: comp.name, label: ph.label, state, points });
  }));
  return { rows, sumPoints: rows.reduce((sum, r) => sum + (r.points || 0), 0) };
}
