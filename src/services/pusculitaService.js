// ══════════════════════════════════════════════════════════════════
// 🐷 PUȘCULIȚA — MOTOR DE CALCUL (ETAPA 1)
//
// STRICT funcții PURE: niciun import Firebase, nicio citire/scriere,
// niciun listener. Fișierul NU e importat încă de nimic din aplicație —
// urcarea lui nu schimbă nimic din ce văd jucătorii.
//
// Aceleași funcții vor fi folosite IDENTIC de Preview (DEMO), de Arena
// reală și de calculul oficial (Rezolvare) — o singură sursă de adevăr.
//
// INTRARE: punctele pe rundă ale fiecărui jucător = suma punctelor din
// meciurile rundei, DOAR din meciurile validate oficial de Admin
// (aceeași sursă ca restul aplicației). Motorul nu știe nimic de scoruri
// LIVE — primește doar ce a fost validat.
// ══════════════════════════════════════════════════════════════════

export const PUSCULITA_TYPE_ID = "pusculita";
export const PUSCULITA_PUBLIC_NAME = "Pușculița";

export const PUSCULITA_ROUNDS = 4;
export const PUSCULITA_DEFAULT_THRESHOLD_PER_MATCH = [40, 44, 48, 50];
export const PUSCULITA_QUOTA_RATE = 0.25;      // rundele 1 și 2: ultimii 25% din numărul INIȚIAL
export const PUSCULITA_MAX_FINALISTS = 5;      // runda 3: maximum 5 rămân
export const PUSCULITA_STOP_POT = 400;         // STOP: 400 împărțite egal
export const PUSCULITA_PODIUM = [200, 190, 180];
export const PUSCULITA_PODIUM_CAP = 600;
export const PUSCULITA_MAX_PER_PLAYER = 200;

export const VOTE_CONTINUE = "O";
export const VOTE_STOP = "X";

function toPts(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function uniq(list) {
  const out = []; const seen = new Set();
  (Array.isArray(list) ? list : []).forEach((x) => {
    if (typeof x === "string" && x && !seen.has(x)) { seen.add(x); out.push(x); }
  });
  return out;
}

// Pragul total al unei runde = prag pe meci × numărul de meciuri.
// (Adminul îl poate suprascrie înainte de publicare — `threshold` explicit.)
export function roundThreshold(round, index) {
  if (Number.isFinite(round?.threshold)) return round.threshold;
  const perMatch = Number.isFinite(round?.thresholdPerMatch)
    ? round.thresholdPerMatch : PUSCULITA_DEFAULT_THRESHOLD_PER_MATCH[index] ?? 0;
  const n = Array.isArray(round?.matchIds) ? round.matchIds.length : 0;
  return perMatch * n;
}

// ── Clasamentul unei runde: rang OLIMPIC (1,1,3), ordine stabilă. ──
export function rankRound(uids, pointsByUid) {
  const rows = uniq(uids).map((uid) => ({ uid, points: toPts(pointsByUid?.[uid]) }));
  rows.sort((a, b) => (b.points - a.points) || (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
  rows.forEach((r, i) => { r.rank = 1 + rows.filter((x) => x.points > r.points).length; r.position = i + 1; });
  return rows;
}

// ── Eliminarea unei runde.
//  keepCount = câți rămân după regula de cotă (null = fără cotă).
//  Egalitatea EXACT pe linie: toți cei egali cu ultimul calificat rămân.
//  Plus: oricine e sub prag e eliminat. Un jucător nu e eliminat de două ori. ──
export function eliminateRound(ranking, keepCount, threshold) {
  const byQuota = new Set();
  if (keepCount !== null && keepCount < ranking.length) {
    if (keepCount <= 0) {
      ranking.forEach((r) => byQuota.add(r.uid));
    } else {
      const lineValue = ranking[keepCount - 1].points; // ultimul calificat
      ranking.forEach((r) => { if (r.points < lineValue) byQuota.add(r.uid); });
    }
  }
  const byThreshold = new Set(ranking.filter((r) => r.points < threshold).map((r) => r.uid));
  const eliminated = new Set([...byQuota, ...byThreshold]);
  return {
    eliminated: ranking.filter((r) => eliminated.has(r.uid)).map((r) => r.uid),
    byQuota: [...byQuota],
    byThreshold: [...byThreshold],
    survivors: ranking.filter((r) => !eliminated.has(r.uid)).map((r) => r.uid),
  };
}

// Câți rămân după regula de cotă în runda `index` (0..3).
export function keepCountFor(index, survivorsBefore, initialCount) {
  if (index === 0 || index === 1) {
    const quota = Math.floor(PUSCULITA_QUOTA_RATE * initialCount);
    return survivorsBefore - quota;
  }
  if (index === 2) return Math.min(survivorsBefore, PUSCULITA_MAX_FINALISTS);
  return null; // runda 4 = finala: fără cotă, doar pragul pentru premii
}

// ── Votul: CONTINUĂ cere majoritatea ABSOLUTĂ a TUTUROR supraviețuitorilor.
//  Nevotanții = STOP automat. ──
export function tallyVote(survivors, votesByUid) {
  const rows = uniq(survivors).map((uid) => {
    const v = votesByUid?.[uid];
    const vote = v === VOTE_CONTINUE ? VOTE_CONTINUE : VOTE_STOP;
    return { uid, vote, auto: v !== VOTE_CONTINUE && v !== VOTE_STOP };
  });
  const cont = rows.filter((r) => r.vote === VOTE_CONTINUE).length;
  const stop = rows.length - cont;
  return { rows, continueCount: cont, stopCount: stop, decision: cont * 2 > rows.length ? "continue" : "stop" };
}

// ── Premiul STOP: 400 împărțite egal, întregi, rotunjit în jos, max 200. ──
export function stopPrizes(survivors) {
  const s = uniq(survivors);
  const each = s.length ? Math.min(PUSCULITA_MAX_PER_PLAYER, Math.floor(PUSCULITA_STOP_POT / s.length)) : 0;
  const out = {}; s.forEach((uid) => { out[uid] = each; });
  return out;
}

// ── Podiumul finalei: doar cei care ating pragul. Locuri olimpice.
//  Egalitate = același loc și același premiu, dar totalul nu trece de 600:
//  dacă grupul egal ar depăși plafonul, suma rămasă se împarte egal (în jos). ──
export function podiumPrizes(finalRanking, threshold) {
  const eligible = finalRanking.filter((r) => r.points >= threshold);
  const ranked = rankRound(eligible.map((r) => r.uid), Object.fromEntries(eligible.map((r) => [r.uid, r.points])));
  const out = {}; let assigned = 0;
  const groups = [];
  ranked.forEach((r) => {
    const g = groups[groups.length - 1];
    if (g && g.rank === r.rank) g.uids.push(r.uid); else groups.push({ rank: r.rank, uids: [r.uid] });
  });
  groups.forEach((g) => {
    if (g.rank > PUSCULITA_PODIUM.length) return;
    let per = PUSCULITA_PODIUM[g.rank - 1];
    if (assigned + per * g.uids.length > PUSCULITA_PODIUM_CAP) {
      per = Math.floor(Math.max(0, PUSCULITA_PODIUM_CAP - assigned) / g.uids.length);
    }
    per = Math.min(per, PUSCULITA_MAX_PER_PLAYER);
    g.uids.forEach((uid) => { out[uid] = per; });
    assigned += per * g.uids.length;
  });
  return { prizes: out, eligible: eligible.map((r) => r.uid), places: groups.filter((g) => g.rank <= 3) };
}

// ══════════════════════════════════════════════════════════════════
// CALCUL COMPLET
//   participants: uid-urile jucătorilor înscriși (activi) — numărul INIȚIAL.
//   rounds: [{ matchIds, thresholdPerMatch?, threshold? }] × 4 (config publicată).
//   roundPoints: [{ uid: puncte }] — punctele VALIDATE din fiecare rundă.
//   roundComplete: [bool] — toate meciurile rundei sunt validate?
//   votes: [{ uid: "O"|"X" }] — votul de după runda 1, 2, 3.
//   voteClosed: [bool] — termenul votului respectiv a trecut?
// Ieșire: cronologia completă + starea + premiile. Determinist.
// O rundă incompletă produce doar un clasament PROVIZORIU (zone, fără eliminări).
// ══════════════════════════════════════════════════════════════════
export function computePusculita({
  participants = [], rounds = [], roundPoints = [], roundComplete = [], votes = [], voteClosed = [],
} = {}) {
  const initial = uniq(participants);
  const N = initial.length;
  const timeline = [];
  let alive = initial.slice();
  let outcome = { status: "running", reason: null, prizes: {} };

  for (let i = 0; i < PUSCULITA_ROUNDS; i++) {
    const round = rounds[i] || {};
    const threshold = roundThreshold(round, i);
    const ranking = rankRound(alive, roundPoints[i] || {});
    const keep = keepCountFor(i, alive.length, N);
    const elim = eliminateRound(ranking, keep, threshold);
    const complete = !!roundComplete[i];
    const entry = {
      index: i, threshold, entrants: alive.slice(), complete,
      ranking: ranking.map((r) => ({
        ...r,
        belowThreshold: r.points < threshold,
        inEliminationZone: elim.eliminated.includes(r.uid),
      })),
      eliminated: complete ? elim.eliminated : [],
      byQuota: complete ? elim.byQuota : [],
      byThreshold: complete ? elim.byThreshold : [],
      survivors: complete ? elim.survivors : alive.slice(),
      provisional: !complete,
      vote: null,
    };
    timeline.push(entry);
    if (!complete) { outcome = { status: "running", reason: "round_in_progress", currentRound: i, prizes: {} }; break; }

    // ── FINALA (runda 4): podium ──
    if (i === PUSCULITA_ROUNDS - 1) {
      const pod = podiumPrizes(entry.ranking, threshold);
      outcome = { status: "ended", reason: "final", prizes: pod.prizes, podium: pod.places, finalists: alive.slice() };
      break;
    }

    alive = elim.survivors;
    // ── Situații speciale ──
    if (alive.length === 0) { outcome = { status: "ended", reason: "zero_survivors", prizes: {} }; break; }
    if (alive.length <= 2) {
      const prizes = {}; alive.forEach((uid) => { prizes[uid] = PUSCULITA_MAX_PER_PLAYER; });
      outcome = { status: "ended", reason: alive.length === 1 ? "one_survivor" : "two_survivors", prizes };
      break;
    }

    // ── Votul de după runda i ──
    const closed = !!voteClosed[i];
    const tally = tallyVote(alive, votes[i] || {});
    entry.vote = { closed, ...tally };
    if (!closed) { outcome = { status: "running", reason: "vote_open", currentRound: i, prizes: {} }; break; }
    if (tally.decision === "stop") {
      outcome = { status: "ended", reason: "stop", prizes: stopPrizes(alive), stoppedAfterRound: i };
      break;
    }
  }

  // Premiile pentru TOȚI participanții (0 pentru ceilalți) — formatul mainPoints.
  const allPrizes = {};
  initial.forEach((uid) => { allPrizes[uid] = Math.min(PUSCULITA_MAX_PER_PLAYER, outcome.prizes?.[uid] || 0); });
  return { initialCount: N, timeline, outcome, prizesByUid: allPrizes };
}

// ══════════════════════════════════════════════════════════════════
// CALENDAR — verificări pure (folosite la configurare și la alerta Admin)
// ══════════════════════════════════════════════════════════════════
const MATCH_DURATION_MS = 2 * 60 * 60 * 1000;

// round.kickoffs: [ms] ale meciurilor rundei; round.voteDeadline: ms (rundele 1–3).
export function validateSchedule(rounds, { minVoteHours = 12, validationMarginHours = 2 } = {}) {
  const errors = []; const warnings = [];
  if (!Array.isArray(rounds) || rounds.length !== PUSCULITA_ROUNDS) errors.push("Trebuie exact 4 runde.");
  (rounds || []).forEach((r, i) => {
    const k = (r?.kickoffs || []).filter(Number.isFinite);
    if (k.length === 0) errors.push(`Runda ${i + 1} nu are meciuri.`);
    if (i < PUSCULITA_ROUNDS - 1) {
      const next = (rounds[i + 1]?.kickoffs || []).filter(Number.isFinite);
      if (!k.length || !next.length) return;
      const lastEnd = Math.max(...k) + MATCH_DURATION_MS;
      const voteOpenEarliest = lastEnd + validationMarginHours * 3600e3;
      const deadline = r.voteDeadline;
      const nextStart = Math.min(...next);
      if (!Number.isFinite(deadline)) { errors.push(`Runda ${i + 1}: lipsește termenul votului.`); return; }
      if (deadline >= nextStart) errors.push(`Runda ${i + 1}: votul trebuie să se închidă înainte de primul meci al rundei ${i + 2}.`);
      if (deadline - voteOpenEarliest < minVoteHours * 3600e3) {
        warnings.push(`Runda ${i + 1}: rămân mai puțin de ${minVoteHours} ore de vot dacă validarea durează ${validationMarginHours} ore după ultimul meci.`);
      }
      if (Math.min(...next) < Math.max(...k)) errors.push(`Runda ${i + 2} începe înaintea ultimului meci din runda ${i + 1}.`);
    }
  });
  return { ok: errors.length === 0, errors, warnings };
}

// Alerta pentru Admin: runda e validată prea târziu ca să mai rămână timp de vot.
// NU decide nimic automat — doar semnalează.
export function voteTimeAlert({ validatedAt, voteDeadline, now, minVoteHours = 12 }) {
  const start = Number.isFinite(validatedAt) ? validatedAt : now;
  const remaining = voteDeadline - start;
  if (!Number.isFinite(remaining)) return null;
  if (remaining <= 0) return { level: "critical", message: "Termenul votului a trecut înainte de validarea rundei." };
  if (remaining < minVoteHours * 3600e3) {
    const h = Math.floor(remaining / 3600e3), m = Math.floor((remaining % 3600e3) / 60e3);
    return { level: "warning", message: `Au rămas doar ${h}h ${m}m de vot (minimum ${minVoteHours}h).` };
  }
  return null;
}
