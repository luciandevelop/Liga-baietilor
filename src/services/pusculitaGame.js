import { collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, setDoc, Timestamp, updateDoc, where, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { computePusculita, PUSCULITA_ROUNDS } from "./pusculitaService";

// ══════════════════════════════════════════════════════════════════
// 🐷 PUȘCULIȚA — datele jocului real (Firestore). Calculele rămân
// EXCLUSIV în pusculitaService.js; aici doar se citește/scrie.
//
// pusculita/{gameweekId}            (citit de toți, scris de Admin)
//   published, participants[], rounds[{matchIds, threshold, voteDeadline}]
//   alive.{r0,r1,r2}         supraviețuitorii confirmați după runda k
//   voteOpen.{r0..}          votul rundei k e deschis
//   voteRevealed.{r0..}      votul rundei k a fost dezvăluit
//   voteResults.{r0..}       { uid: "O"|"X" } — publicat la dezvăluire
// pusculita/{gw}/votes/{k_uid}      votul secret (scris o dată de jucător)
// pusculita/{gw}/voted/{k_uid}      doar „a votat” (public, fără alegere)
// gameweeks/{gw}.pusculitaRounds    { r0:[matchIds], … } — pentru calculul
//   punctelor pe rundă la fiecare validare (fără citiri în plus).
// gameweeks/{gw}.liveSnapshotPusculita  { points:{r0:{uid:pts}}, complete:{r0:bool}, validated:{r0:n} }
// ══════════════════════════════════════════════════════════════════

export const pusculitaRef = (gw) => doc(db, "pusculita", gw);
const rk = (k) => `r${k}`;

export async function getPusculita(gameweekId) {
  const snap = await getDoc(pusculitaRef(gameweekId));
  return snap.exists() ? snap.data() : null;
}

// Publică și blochează configurația (o singură dată).
export async function publishPusculita(gameweekId, { rounds, participants }) {
  if (!Array.isArray(rounds) || rounds.length !== PUSCULITA_ROUNDS) throw new Error("Trebuie exact 4 runde.");
  await runTransaction(db, async (tx) => {
    const ref = pusculitaRef(gameweekId);
    const snap = await tx.get(ref);
    if (snap.exists() && snap.data().published) throw new Error("Pușculița e deja publicată pentru această etapă.");
    tx.set(ref, {
      gameweekId, published: true, publishedAt: serverTimestamp(), participants,
      rounds: rounds.map((r) => ({
        matchIds: r.matchIds, threshold: r.threshold,
        voteDeadline: Number.isFinite(r.voteDeadlineMs) ? Timestamp.fromMillis(r.voteDeadlineMs) : null,
      })),
      alive: {}, voteOpen: {}, voteRevealed: {}, voteResults: {},
    });
    const roundsMap = {}; rounds.forEach((r, i) => { roundsMap[rk(i)] = r.matchIds; });
    tx.update(doc(db, "gameweeks", gameweekId), { pusculitaRounds: roundsMap });
  });
}

// Confirmă supraviețuitorii rundei k și deschide votul (dacă e cazul).
export async function confirmRound(gameweekId, k, survivors, openVote) {
  await updateDoc(pusculitaRef(gameweekId), {
    [`alive.${rk(k)}`]: survivors,
    ...(openVote ? { [`voteOpen.${rk(k)}`]: true } : {}),
    updatedAt: serverTimestamp(),
  });
}

// Votul jucătorului: o singură dată, definitiv (regulile refuză orice modificare).
export async function submitVote(gameweekId, k, uid, vote) {
  const id = `${k}_${uid}`;
  const b = writeBatch(db);
  b.set(doc(db, "pusculita", gameweekId, "votes", id), { uid, round: k, vote, at: serverTimestamp() });
  b.set(doc(db, "pusculita", gameweekId, "voted", id), { uid, round: k, at: serverTimestamp() });
  await b.commit();
}

export async function getMyVote(gameweekId, k, uid) {
  try {
    const snap = await getDoc(doc(db, "pusculita", gameweekId, "votes", `${k}_${uid}`));
    return snap.exists() ? snap.data().vote : null;
  } catch { return null; }
}

// Cine a votat (fără alegere) — pentru Admin și pentru ecranul jucătorilor.
export async function listVoted(gameweekId, k) {
  const snap = await getDocs(collection(db, "pusculita", gameweekId, "voted"));
  return snap.docs.map((d) => d.data()).filter((v) => v.round === k).map((v) => v.uid);
}

// Dezvăluirea votului rundei k (Admin): închide votul, apoi citește și publică rezultatele.
export async function revealVote(gameweekId, k) {
  await updateDoc(pusculitaRef(gameweekId), { [`voteOpen.${rk(k)}`]: false, [`voteRevealed.${rk(k)}`]: true, updatedAt: serverTimestamp() });
  // Interogare filtrată pe rundă — regulile permit citirea doar după dezvăluire.
  const snap = await getDocs(query(collection(db, "pusculita", gameweekId, "votes"), where("round", "==", k)));
  const results = {};
  snap.docs.forEach((d) => { const v = d.data(); if (v.round === k && (v.vote === "O" || v.vote === "X")) results[v.uid] = v.vote; });
  await updateDoc(pusculitaRef(gameweekId), { [`voteResults.${rk(k)}`]: results, updatedAt: serverTimestamp() });
  return results;
}

// ── Punctele pe rundă, din rezultatele DEJA calculate la validare (rows) ──
// Doar meciuri validate oficial (breakdown.status === "scored"); jucători activi.
export function buildRoundSnapshot(roundsMap, rows, matches, activeUids) {
  const points = {}, complete = {}, validated = {};
  const statusById = Object.fromEntries((matches || []).map((m) => [m.id, m.status]));
  for (let k = 0; k < PUSCULITA_ROUNDS; k++) {
    const ids = roundsMap?.[rk(k)] || [];
    const closed = ids.filter((id) => ["finished", "cancelled", "postponed"].includes(statusById[id]));
    validated[rk(k)] = closed.length;
    complete[rk(k)] = ids.length > 0 && closed.length === ids.length;
    const pts = {};
    (rows || []).forEach((r) => {
      if (activeUids && !activeUids.has(r.uid)) return;
      let s = 0;
      ids.forEach((id) => { const b = r.breakdown?.[id]; if (b && b.status === "scored") s += b.total || 0; });
      pts[r.uid] = s;
    });
    points[rk(k)] = pts;
  }
  return { points, complete, validated };
}

// ── Intrarea pentru motor, din documentul jocului + snapshot ──
export function buildPusculitaInput(game, live) {
  const rounds = (game?.rounds || []).map((r) => ({ matchIds: r.matchIds || [], threshold: r.threshold }));
  const roundPoints = [], roundComplete = [], votes = [], voteClosed = [];
  for (let k = 0; k < PUSCULITA_ROUNDS; k++) {
    roundPoints.push(live?.points?.[rk(k)] || {});
    roundComplete.push(!!live?.complete?.[rk(k)]);
    votes.push(game?.voteResults?.[rk(k)] || {});
    voteClosed.push(!!game?.voteRevealed?.[rk(k)]);
  }
  return { participants: game?.participants || [], rounds, roundPoints, roundComplete, votes, voteClosed };
}

// ── Automat, la fiecare validare a Adminului: dacă o rundă tocmai s-a
// completat, confirmă supraviețuitorii și deschide votul. Nu decide nimic
// altceva (dezvăluirea votului rămâne manuală). ──
export async function autoAdvancePusculita(gameweekId, live) {
  const game = await getPusculita(gameweekId);
  if (!game?.published) return null;
  const res = computePusculita(buildPusculitaInput(game, live));
  const actions = [];
  for (const t of res.timeline) {
    if (!t.complete || t.index >= PUSCULITA_ROUNDS - 1) continue;
    if (game.alive?.[rk(t.index)]) continue;
    const openVote = t.survivors.length >= 3;
    await confirmRound(gameweekId, t.index, t.survivors, openVote);
    actions.push({ round: t.index, survivors: t.survivors.length, voteOpened: openVote });
  }
  return actions;
}

export async function setPusculitaDoc(gameweekId, data) {
  await setDoc(pusculitaRef(gameweekId), data, { merge: true });
}
