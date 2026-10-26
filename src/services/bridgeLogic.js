// ══════════════════════════════════════════════════════════════════
// 🌉 PODUL DE STICLĂ — LOGICA JOCULUI (pură, fără Firebase)
//
// O singură sursă de adevăr, folosită IDENTIC de:
//   - serverul de încredere (Vercel /api) care validează săriturile;
//   - modul DEMO din Admin (aceleași reguli, date locale).
// Traseul secret NU ajunge niciodată pe telefon în jocul real: aici
// există doar funcțiile care îl aplică; în producție le rulează serverul.
//
// Convenții:
//   route[i] ∈ {0,1}  — panoul sigur pe rândul i (0 = STÂNGA, 1 = DREAPTA)
//   step               — câte panouri a trecut în tura curentă (0…9);
//                        următoarea săritură e pe rândul `step` (treapta step+1)
//   status             — "active" | "cashed" | "won" | "eliminated"
// ══════════════════════════════════════════════════════════════════

export const BRIDGE_TYPE_ID = "glass-bridge";
export const BRIDGE_ROWS = 9;
export const BRIDGE_LIVES_PAIR = 3;
export const BRIDGE_LIVES_SOLO = 5;
export const BRIDGE_MIN_CASHOUT_STEP = 5;
export const LEFT = 0;
export const RIGHT = 1;

// Punctajul disponibil după treapta atinsă (panouri trecute în tura curentă).
const POINTS_BY_STEP = { 5: 20, 6: 40, 7: 60, 8: 80, 9: 100 };
export function cashoutValue(step) { return POINTS_BY_STEP[step] || 0; }

const TERMINAL = ["cashed", "won", "eliminated"];
export function isTerminal(state) { return TERMINAL.includes(state?.status); }

// ── Aleatoriu: serverul folosește crypto; DEMO poate injecta un generator. ──
export function secureRandom() {
  // globalThis.crypto există în browser și în Node 20 (runtime-ul Vercel).
  const a = new Uint32Array(1);
  globalThis.crypto.getRandomValues(a);
  return a[0] / 4294967296;
}

export function makeRoute(rng = secureRandom) {
  return Array.from({ length: BRIDGE_ROWS }, () => (rng() < 0.5 ? LEFT : RIGHT));
}

// Perechi aleatorii; la număr impar, un jucător ales aleatoriu joacă singur.
export function makePairs(uids, rng = secureRandom) {
  const list = [...new Set((uids || []).filter((u) => typeof u === "string" && u))];
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  const pairs = []; let soloUid = null;
  for (let i = 0; i < list.length; i += 2) {
    if (i + 1 < list.length) pairs.push({ id: `p${pairs.length + 1}`, members: [list[i], list[i + 1]] });
    else { soloUid = list[i]; pairs.push({ id: `p${pairs.length + 1}`, members: [list[i]], solo: true }); }
  }
  return { pairs, soloUid };
}

export function initialPlayerState(uid, pairId, solo = false) {
  const lives = solo ? BRIDGE_LIVES_SOLO : BRIDGE_LIVES_PAIR;
  return { uid, pairId, solo: !!solo, maxLives: lives, lives, step: 0, status: "active", points: 0, lastFallRow: null, jumps: 0, falls: 0 };
}

function closed(nowMs, deadlineMs) { return Number.isFinite(deadlineMs) && nowMs >= deadlineMs; }

// ── O săritură. `row` = rândul pe care clientul CREDE că sare (protecție la
// retrimitere: dacă nu e egal cu step, cererea e veche și nu schimbă nimic). ──
export function applyJump(state, route, row, side, nowMs = Date.now(), deadlineMs = null) {
  if (!state) return { ok: false, error: "no_player" };
  if (isTerminal(state)) return { ok: false, error: "finished", state };
  if (closed(nowMs, deadlineMs)) return { ok: false, error: "closed", state };
  if (side !== LEFT && side !== RIGHT) return { ok: false, error: "bad_side", state };
  if (row !== state.step) return { ok: false, error: "stale", state };
  if (!Array.isArray(route) || route.length !== BRIDGE_ROWS) return { ok: false, error: "no_route", state };

  const next = { ...state, jumps: (state.jumps || 0) + 1 };
  if (route[row] === side) {
    next.step = state.step + 1;
    if (next.step >= BRIDGE_ROWS) { next.status = "won"; next.points = 100; return { ok: true, result: "won", state: next }; }
    return { ok: true, result: "safe", state: next };
  }
  next.lives = state.lives - 1;
  next.falls = (state.falls || 0) + 1;
  next.lastFallRow = row + 1; // treapta (1–9) de la care a căzut — fără partea aleasă
  next.step = 0;
  if (next.lives <= 0) { next.lives = 0; next.status = "eliminated"; next.points = 0; return { ok: true, result: "eliminated", state: next }; }
  return { ok: true, result: "fall", state: next };
}

// ── Încasarea: de la treapta 5, o singură dată, definitiv. ──
export function applyCashout(state, nowMs = Date.now(), deadlineMs = null) {
  if (!state) return { ok: false, error: "no_player" };
  if (isTerminal(state)) return { ok: false, error: "finished", state };
  if (closed(nowMs, deadlineMs)) return { ok: false, error: "closed", state };
  if (state.step < BRIDGE_MIN_CASHOUT_STEP) return { ok: false, error: "too_early", state };
  const points = cashoutValue(state.step);
  return { ok: true, points, state: { ...state, status: "cashed", points } };
}

// ── Punctajul final (la Rezolvare): doar cine a încasat sau a traversat. ──
export function finalPoints(state) {
  return state && (state.status === "cashed" || state.status === "won") ? Math.min(100, state.points || 0) : 0;
}

// Ce poate vedea oricine despre un jucător (partener inclus) — fără alegeri.
export function publicView(state) {
  if (!state) return null;
  const { uid, pairId, solo, maxLives, lives, step, status, points, lastFallRow } = state;
  return { uid, pairId, solo, maxLives, lives, step, status, points, lastFallRow };
}
