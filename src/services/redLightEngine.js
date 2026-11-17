// ══════════════════════════════════════════════════════════════════
// 🚦 LUMINĂ ROȘIE, LUMINĂ VERDE — MOTOR DE CALCUL (ETAPA 1)
//
// STRICT funcții PURE: niciun import Firebase, nicio citire/scriere,
// niciun listener. Fișierul NU e importat încă de nimic din aplicație —
// urcarea lui nu schimbă nimic din ce văd jucătorii.
//
// Totul se RECALCULEAZĂ de la zero la fiecare apel (nimic nu se adună
// incremental) → o validare repetată, întârziată sau o corectură nu pot
// da puncte de două ori.
//
// REGULAMENT (aprobat):
// - Ordinea celor 20 de meciuri e fixă, stabilită la publicare.
// - AVANSEZ: 1X2 corect = +1 pas; scor exact = +2 pași TOTAL;
//   1X2 greșit = +1 greșeală (pașii nu scad). STAU / fără alegere = nimic.
// - AVANSEZ fără pronostic valid = tratat ca STAU (și blocat în UI + reguli).
// - Joker / Meciul Săptămânii NU contează: se folosește mainScore,
//   care e DEJA fără multiplicator (scoringEngine.computeMainScore):
//   120 = scor exact · 70/50 = 1X2 corect · 20/0 = 1X2 greșit.
// - A 3-a greșeală = ELIMINAT, 0 PCT.
// - 14 pași = FINISHER, 200 PCT (13 + scor exact = 14, nu 15).
// - FINISHER / ELIMINAT / SAFE nu mai evoluează la meciurile următoare.
// - MĂ OPRESC: ireversibil. Meciurile blocate ÎNAINTE de oprire, cu
//   AVANSEZ, se joacă oricum (riscul asumat rămâne); cele blocate DUPĂ
//   oprire se ignoră. SAFE devine definitiv abia după ce toate aceste
//   riscuri au fost validate (și jucătorul a supraviețuit).
// - Meci anulat/amânat = fără pași, fără greșeli, și NU blochează oprirea.
// - Cine nu e eliminat la final își păstrează punctele, cu sau fără oprire.
//
// PROCESARE ÎN ORDINE (determinism): meciurile se procesează strict în
// ordinea 1–20 și se OPRESC la primul meci încă nerezolvat. Un meci
// validat aflat DUPĂ un meci nevalidat așteaptă. Astfel starea afișată e
// mereu un prefix sigur al istoriei — rezultatul final e identic, iar
// show-ul nu arată niciodată un eveniment care s-ar schimba când se
// validează un meci anterior.
// ══════════════════════════════════════════════════════════════════

export const RED_LIGHT_TYPE_ID = "red-light";
export const RED_LIGHT_PUBLIC_NAME = "Lumină roșie, lumină verde";

export const RL_FINISH_STEPS = 14;
export const RL_MAX_STRIKES = 3; // a 3-a greșeală elimină
export const RL_LOCK_MINUTES = 30; // identic cu pronosticurile (matchLockRule.js)

// Pași → PCT (0–6 pași = 0).
export const RL_POINTS_TABLE = { 7: 30, 8: 50, 9: 70, 10: 90, 11: 110, 12: 130, 13: 150, 14: 200 };

export const RL_STATUS = { ACTIVE: "ACTIV", SAFE: "SAFE", FINISHER: "FINISHER", ELIMINATED: "ELIMINAT" };

export const RL_CHOICE = { ADVANCE: "AVANSEZ", STAY: "STAU" };

// Rezultatul unui jucător la un meci, în motor.
export const RL_OUTCOME = {
  EXACT: "exact",          // +2
  CORRECT: "correct",      // +1
  WRONG: "wrong",          // +1 greșeală
  STAY: "stay",            // a ales STAU (sau nimic)
  NO_PREDICTION: "noPrediction", // a ales AVANSEZ dar n-are pronostic valid → STAU
  IGNORED_STOP: "ignoredAfterStop", // meci blocat după oprire → ignorat
  OUT: "out",              // deja FINISHER / ELIMINAT / SAFE
  VOID: "void",            // meci anulat/amânat
};

const MATCH_VOID = new Set(["cancelled", "postponed"]);

export function pointsForSteps(steps) {
  const s = Math.max(0, Math.min(RL_FINISH_STEPS, Math.floor(Number(steps) || 0)));
  return RL_POINTS_TABLE[s] || 0;
}

// mainScore (fără multiplicator) → rezultatul jocului.
export function classifyMainScore(mainScore) {
  if (!Number.isFinite(mainScore)) return null;
  if (mainScore === 120) return RL_OUTCOME.EXACT;
  if (mainScore >= 50) return RL_OUTCOME.CORRECT; // 70 sau 50
  return RL_OUTCOME.WRONG; // 20 sau 0
}

function uniq(list) {
  const out = []; const seen = new Set();
  (Array.isArray(list) ? list : []).forEach((x) => {
    if (typeof x === "string" && x && !seen.has(x)) { seen.add(x); out.push(x); }
  });
  return out;
}

// Starea unui meci în motor: "validated" | "void" | "pending".
export function matchState(m) {
  if (!m) return "pending";
  if (MATCH_VOID.has(m.status)) return "void";
  if (m.status === "finished" && m.validated !== false) return "validated";
  return "pending";
}

// ══════════════════════════════════════════════════════════════════
// computeRedLight(input) — SINGURA sursă de adevăr.
//
// input = {
//   participants: [uid],                     // înghețați la publicare
//   order: [matchId],                        // ordinea fixă 1–20
//   matches: { [matchId]: { status, lockAtMs } },
//   advances: { [matchId]: [uid] },          // cine a ales AVANSEZ (doar alegeri blocate)
//   mainScores: { [matchId]: { [uid]: mainScore } }, // doar pronosticuri valide, meciuri validate
//   stops: { [uid]: stopAtMs },              // ora serverului la MĂ OPRESC
//   nowMs,                                   // pentru „poate să se oprească acum?”
// }
// ══════════════════════════════════════════════════════════════════
export function computeRedLight(input) {
  const participants = uniq(input?.participants);
  const order = uniq(input?.order);
  const matches = input?.matches || {};
  const stops = input?.stops || {};
  const nowMs = Number.isFinite(input?.nowMs) ? input.nowMs : null;

  const advanceSets = {};
  order.forEach((id) => { advanceSets[id] = new Set(uniq(input?.advances?.[id])); });

  const players = {};
  participants.forEach((uid) => {
    const stopAt = Number.isFinite(stops[uid]) ? stops[uid] : null;
    players[uid] = {
      uid, steps: 0, strikes: 0, status: RL_STATUS.ACTIVE,
      stopAtMs: stopAt, stopRequested: stopAt !== null,
      finishedAt: null, eliminatedAt: null, safeAt: null, // index în ordine (-1 = înainte de meciul 1)
      stepsAtElimination: null,
    };
  });

  const lockOf = (id) => (Number.isFinite(matches[id]?.lockAtMs) ? matches[id].lockAtMs : null);

  // Meciul a fost blocat înainte de oprire? (lock ≤ oprire → riscul se joacă)
  const lockedBeforeStop = (id, stopAt) => {
    const l = lockOf(id);
    return l !== null && l <= stopAt;
  };

  // Riscurile asumate înainte de oprire: meciuri cu AVANSEZ blocate până la oprire.
  const riskIndexes = (uid) => {
    const p = players[uid];
    if (p.stopAtMs === null) return [];
    const out = [];
    order.forEach((id, i) => { if (advanceSets[id].has(uid) && lockedBeforeStop(id, p.stopAtMs)) out.push(i); });
    return out;
  };

  const tryMakeSafe = (uid, processedUpTo) => {
    const p = players[uid];
    if (p.status !== RL_STATUS.ACTIVE || p.stopAtMs === null) return false;
    const risks = riskIndexes(uid);
    const lastRisk = risks.length ? Math.max(...risks) : -1;
    if (lastRisk <= processedUpTo) { p.status = RL_STATUS.SAFE; p.safeAt = processedUpTo; return true; }
    return false;
  };

  const events = [];
  const initialSafe = [];
  participants.forEach((uid) => { if (tryMakeSafe(uid, -1)) initialSafe.push(uid); });

  let processed = 0; // numărul de meciuri procesate (prefix)
  for (let i = 0; i < order.length; i++) {
    const id = order[i];
    const state = matchState(matches[id]);
    if (state === "pending") break;
    const ev = { index: i, matchId: id, state, entries: [], finishers: [], eliminated: [], newlySafe: [] };

    participants.forEach((uid) => {
      const p = players[uid];
      const before = { steps: p.steps, strikes: p.strikes, status: p.status };
      let choice = advanceSets[id].has(uid) ? RL_CHOICE.ADVANCE : RL_CHOICE.STAY;
      let outcome;

      if (p.status !== RL_STATUS.ACTIVE) {
        outcome = RL_OUTCOME.OUT;
      } else if (state === "void") {
        outcome = RL_OUTCOME.VOID;
      } else if (choice === RL_CHOICE.ADVANCE && p.stopAtMs !== null && !lockedBeforeStop(id, p.stopAtMs)) {
        outcome = RL_OUTCOME.IGNORED_STOP; choice = RL_CHOICE.STAY;
      } else if (choice === RL_CHOICE.STAY) {
        outcome = RL_OUTCOME.STAY;
      } else {
        const cls = classifyMainScore(input?.mainScores?.[id]?.[uid]);
        if (!cls) { outcome = RL_OUTCOME.NO_PREDICTION; choice = RL_CHOICE.STAY; }
        else {
          outcome = cls;
          if (cls === RL_OUTCOME.EXACT) p.steps = Math.min(RL_FINISH_STEPS, p.steps + 2);
          else if (cls === RL_OUTCOME.CORRECT) p.steps = Math.min(RL_FINISH_STEPS, p.steps + 1);
          else p.strikes += 1;

          if (p.strikes >= RL_MAX_STRIKES) {
            p.status = RL_STATUS.ELIMINATED; p.eliminatedAt = i; p.stepsAtElimination = p.steps;
            ev.eliminated.push(uid);
          } else if (p.steps >= RL_FINISH_STEPS) {
            p.status = RL_STATUS.FINISHER; p.finishedAt = i;
            ev.finishers.push(uid);
          }
        }
      }

      ev.entries.push({
        uid, choice, outcome,
        stepsBefore: before.steps, stepsAfter: p.steps,
        strikesBefore: before.strikes, strikesAfter: p.strikes,
        statusBefore: before.status, statusAfter: p.status,
      });
    });

    processed = i + 1;
    participants.forEach((uid) => { if (tryMakeSafe(uid, i)) ev.newlySafe.push(uid); });
    events.push(ev);
  }

  const resolvedAll = processed === order.length;

  const rows = participants.map((uid) => {
    const p = players[uid];
    const pct = p.status === RL_STATUS.ELIMINATED ? 0 : p.status === RL_STATUS.FINISHER ? 200 : pointsForSteps(p.steps);
    // Poate apăsa MĂ OPRESC acum? Doar ACTIV, neoprit, fără niciun meci cu
    // AVANSEZ deja blocat (lock ≤ acum) și încă neprocesat.
    let canStop = false; let pendingRisks = 0;
    if (p.status === RL_STATUS.ACTIVE && p.stopAtMs === null && !resolvedAll) {
      for (let i = processed; i < order.length; i++) {
        const id = order[i];
        const l = lockOf(id);
        if (advanceSets[id].has(uid) && l !== null && nowMs !== null && l <= nowMs && matchState(matches[id]) !== "void") pendingRisks += 1;
      }
      canStop = nowMs !== null && pendingRisks === 0;
    }
    return {
      uid, steps: p.steps, strikes: p.strikes, status: p.status, pct,
      stopRequested: p.stopRequested, stopAtMs: p.stopAtMs,
      finishedAt: p.finishedAt, eliminatedAt: p.eliminatedAt, safeAt: p.safeAt,
      stepsAtElimination: p.stepsAtElimination, canStop, pendingRisks,
    };
  });

  const prizesByUid = {};
  if (resolvedAll) rows.forEach((r) => { prizesByUid[r.uid] = r.pct; });

  return {
    processed, total: order.length, resolvedAll,
    rows, byUid: Object.fromEntries(rows.map((r) => [r.uid, r])),
    events, initialSafe,
    prizesByUid: resolvedAll ? prizesByUid : null, // premiile oficiale există DOAR când toate meciurile sunt rezolvate
  };
}

// ── Adaptor PUR: din rândurile deja calculate de aplicație
// (computeGameweekResults → rows[].breakdown) și lista de meciuri. ──
// breakdown[matchId].status === "scored" → are pronostic valid și meci final.
export function buildMainScoresFromRows(rows, matchIds) {
  const want = new Set(matchIds || []);
  const out = {};
  (rows || []).forEach((r) => {
    Object.entries(r?.breakdown || {}).forEach(([mid, b]) => {
      if (want.size && !want.has(mid)) return;
      if (b?.status !== "scored" || !Number.isFinite(b?.mainScore)) return;
      (out[mid] = out[mid] || {})[r.uid] = b.mainScore;
    });
  });
  return out;
}

// lockAtMs = ora meciului − 30 min (aceeași regulă ca pronosticurile).
export function lockAtFromKickoff(kickoffMs) {
  return Number.isFinite(kickoffMs) ? kickoffMs - RL_LOCK_MINUTES * 60 * 1000 : null;
}

// ══════════════════════════════════════════════════════════════════
// Avertisment pentru Admin la corectarea unui rezultat (Q3):
// compară starea veche cu cea recalculată.
// ══════════════════════════════════════════════════════════════════
export function diffRedLight(prev, next) {
  const changes = [];
  const a = prev?.byUid || {}; const b = next?.byUid || {};
  Object.keys(b).forEach((uid) => {
    const x = a[uid]; const y = b[uid];
    if (!x) return;
    const important = x.status !== y.status || x.pct !== y.pct;
    if (!important && x.steps === y.steps && x.strikes === y.strikes) return;
    changes.push({
      uid, from: { status: x.status, steps: x.steps, strikes: x.strikes, pct: x.pct },
      to: { status: y.status, steps: y.steps, strikes: y.strikes, pct: y.pct },
      affectsFinisher: x.status === RL_STATUS.FINISHER || y.status === RL_STATUS.FINISHER,
      affectsEliminated: x.status === RL_STATUS.ELIMINATED || y.status === RL_STATUS.ELIMINATED,
      affectsPoints: x.pct !== y.pct,
    });
  });
  return changes;
}

// ══════════════════════════════════════════════════════════════════
// SHOW: scenariul e DOAR afișare (nu scrie niciodată puncte).
// buildShowScript ia evenimentele meciurilor [fromIndex, toIndex) deja
// procesate. checkShowScript verifică dacă un scenariu salvat mai e
// valabil după o recalculare (corectură) → dacă nu, replay-ul trebuie
// marcat „invalidat” și regenerat.
// ══════════════════════════════════════════════════════════════════
export function buildShowScript(result, fromIndex) {
  const from = Math.max(0, Number(fromIndex) || 0);
  const evs = (result?.events || []).filter((e) => e.index >= from);
  return {
    fromIndex: from, toIndex: from + evs.length,
    events: evs.map((e) => ({
      index: e.index, matchId: e.matchId, state: e.state,
      entries: e.entries.map((x) => ({ uid: x.uid, choice: x.choice, outcome: x.outcome, stepsAfter: x.stepsAfter, strikesAfter: x.strikesAfter, statusAfter: x.statusAfter })),
      finishers: [...e.finishers], eliminated: [...e.eliminated], newlySafe: [...e.newlySafe],
    })),
    signature: scriptSignature(evs),
  };
}

function scriptSignature(evs) {
  return evs.map((e) => `${e.index}:${e.matchId}:${e.state}|` + e.entries.map((x) => `${x.uid}=${x.choice}/${x.outcome}/${x.stepsAfter}/${x.strikesAfter}/${x.statusAfter}`).join(",")
    + `|S:${(e.newlySafe || []).join(",")}`).join("#");
}

export function checkShowScript(script, result) {
  if (!script) return { valid: false, changedMatchIds: [] };
  const fresh = buildShowScript(result, script.fromIndex);
  const freshByIdx = Object.fromEntries(fresh.events.map((e) => [e.index, e]));
  const changed = [];
  script.events.forEach((e) => {
    const f = freshByIdx[e.index];
    if (!f || scriptSignature([f]) !== scriptSignature([e])) changed.push(e.matchId);
  });
  return { valid: changed.length === 0, changedMatchIds: changed };
}
