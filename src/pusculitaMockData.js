// ══════════════════════════════════════════════════════════════════
// 🐷 PUȘCULIȚA — DATE SIMULATE, STRICT pentru modul DEMO / Preview Admin.
// Zero Firestore. Toate rezultatele (eliminări, vot, premii) se
// CALCULEAZĂ cu pusculitaService.js — aici sunt doar punctele simulate
// ale meciurilor validate și voturile simulate.
// Identitățile: locuri neutre (p01…p15); în Preview, Adminul le va
// înlocui cu jucătorii activi reali (nume + avatar din același uid).
// ══════════════════════════════════════════════════════════════════
import { computePusculita, VOTE_CONTINUE as O, VOTE_STOP as X } from "./services/pusculitaService";

export const PUSCULITA_MOCK_ME = "p05";
export const PUSCULITA_MOCK_PLAYERS = Array.from({ length: 15 }, (_, i) => {
  const uid = `p${String(i + 1).padStart(2, "0")}`;
  return { uid, nickname: `Jucător ${i + 1}`, avatarId: null };
});
const ALL = PUSCULITA_MOCK_PLAYERS.map((p) => p.uid);

// 4 runde × 5 meciuri (praguri standard 40/44/48/50 pe meci → 200/220/240/250).
export const PUSCULITA_MOCK_ROUNDS = [0, 1, 2, 3].map((r) => ({
  matchIds: [1, 2, 3, 4, 5].map((m) => `r${r + 1}m${m}`),
  thresholdPerMatch: [40, 44, 48, 50][r],
}));

// Punctele VALIDATE pe meci (deterministe) — puncte reale PLAY LEAGUE: 0/20/50/70/120.
// mulberry32 — generator determinist, bine distribuit de la primul pas.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0; let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function matchPoints(seed, skill) {
  const r = rng(seed)();
  // Distribuție aleasă ca demo-ul să parcurgă toate fazele (media ≈ 55/meci).
  const pe = 0.14 + 0.1 * skill, p70 = pe + 0.26, p50 = p70 + 0.26, p20 = p50 + 0.1;
  return r < pe ? 120 : r < p70 ? 70 : r < p50 ? 50 : r < p20 ? 20 : 0;
}
const SKILL = Object.fromEntries(ALL.map((u, i) => [u, ((i * 7) % 15) / 14]));
// pointsByMatch[roundIndex][matchIndex][uid]
const POINTS = [0, 1, 2, 3].map((r) => [0, 1, 2, 3, 4].map((m) =>
  Object.fromEntries(ALL.map((u, i) => [u, matchPoints(1000 * r + 100 * m + i * 7 + 13, SKILL[u])]))));

// Suma pe rundă, doar din primele `validated` meciuri validate.
function roundTotals(r, validated = 5, override = {}) {
  const out = {};
  ALL.forEach((u) => {
    let s = 0; for (let m = 0; m < validated; m++) s += POINTS[r][m][u];
    out[u] = s;
  });
  return { ...out, ...override };
}

const votesAll = (uids, v) => Object.fromEntries(uids.map((u) => [u, v]));

export const PUSCULITA_PREVIEW_STATES = [
  { id: "A", label: "A · Programul publicat" },
  { id: "B", label: "B · Runda 1 în desfășurare (2/5 validate)" },
  { id: "C", label: "C · Runda 1 încheiată — eliminări" },
  { id: "D", label: "D · Vot deschis după runda 1" },
  { id: "E", label: "E · Dezvăluire: CONTINUĂ" },
  { id: "F", label: "F · Runda 2 încheiată" },
  { id: "G", label: "G · Vot după runda 2: STOP (400 împărțite)" },
  { id: "H", label: "H · Runda 3: cei 5 finaliști" },
  { id: "I", label: "I · Vot după runda 3: CONTINUĂ spre finală" },
  { id: "J", label: "J · Finala: podiumul" },
  { id: "K", label: "K · Doar 2 supraviețuitori: 200 fiecare" },
  { id: "L", label: "L · Zero supraviețuitori" },
  { id: "M", label: "M · Finala: podium complet (3 câștigători)" },
];

// Construiește intrarea pentru motor pentru fiecare stare.
export function getPusculitaMockInput(stateId) {
  const base = { participants: ALL, rounds: PUSCULITA_MOCK_ROUNDS };
  const R1 = roundTotals(0), R2 = roundTotals(1), R3 = roundTotals(2), R4 = roundTotals(3);
  const after = (rounds) => computePusculita({ ...base, ...rounds });
  const survivorsAfter = (k, extra) => after({
    roundPoints: [R1, R2, R3, R4].slice(0, k), roundComplete: Array(k).fill(true),
    votes: extra?.votes || [], voteClosed: extra?.voteClosed || [],
  }).timeline[k - 1]?.survivors || [];

  const s1 = survivorsAfter(1);
  const contAll1 = votesAll(s1, O);
  const s2 = survivorsAfter(2, { votes: [contAll1], voteClosed: [true] });
  const contAll2 = votesAll(s2, O);
  const s3 = survivorsAfter(3, { votes: [contAll1, contAll2], voteClosed: [true, true] });

  switch (stateId) {
    case "A": return { ...base, roundPoints: [{}], roundComplete: [false], validatedInRound: 0 };
    case "B": return { ...base, roundPoints: [roundTotals(0, 2)], roundComplete: [false], validatedInRound: 2 };
    case "C": return { ...base, roundPoints: [R1], roundComplete: [true] };
    case "D": {
      // Vot în curs: o parte a votat, restul încă nu (la închidere ar fi STOP automat).
      const partial = Object.fromEntries(s1.slice(0, Math.ceil(s1.length / 2)).map((u, i) => [u, i % 3 === 0 ? X : O]));
      return { ...base, roundPoints: [R1], roundComplete: [true], votes: [partial], voteClosed: [false] };
    }
    case "E": {
      const v = Object.fromEntries(s1.map((u, i) => [u, i < Math.floor(s1.length / 2) + 1 ? O : X]));
      return { ...base, roundPoints: [R1, {}], roundComplete: [true, false], votes: [v], voteClosed: [true] };
    }
    case "F": return { ...base, roundPoints: [R1, R2], roundComplete: [true, true], votes: [contAll1], voteClosed: [true, false] };
    case "G": {
      // Majoritatea NU votează CONTINUĂ (unii nu votează deloc = STOP automat).
      const v = Object.fromEntries(s2.slice(0, Math.floor(s2.length / 2)).map((u) => [u, O]));
      return { ...base, roundPoints: [R1, R2], roundComplete: [true, true], votes: [contAll1, v], voteClosed: [true, true] };
    }
    case "H": return { ...base, roundPoints: [R1, R2, R3], roundComplete: [true, true, true], votes: [contAll1, contAll2], voteClosed: [true, true, false] };
    case "I": return { ...base, roundPoints: [R1, R2, R3, roundTotals(3, 1)], roundComplete: [true, true, true, false], votes: [contAll1, contAll2, votesAll(s3, O)], voteClosed: [true, true, true] };
    case "J": {
      // Egalitate pe locul 1 între primii doi finaliști.
      const f = s3; const top = Math.max(...f.map((u) => R4[u])) + 30;
      const R4t = { ...R4, [f[0]]: top, [f[1]]: top };
      return { ...base, roundPoints: [R1, R2, R3, R4t], roundComplete: [true, true, true, true], votes: [contAll1, contAll2, votesAll(s3, O)], voteClosed: [true, true, true] };
    }
    case "M": {
      // Trei câștigători diferiți (locurile 1, 2, 3); ceilalți doi finaliști sub prag.
      const f = s3;
      const R4m = { ...R4, [f[0]]: 420, [f[1]]: 360, [f[2]]: 300, [f[3]]: 240, [f[4]]: 190 };
      return { ...base, roundPoints: [R1, R2, R3, R4m], roundComplete: [true, true, true, true], votes: [contAll1, contAll2, votesAll(s3, O)], voteClosed: [true, true, true] };
    }
    case "K": {
      // Runda 1: toți, cu excepția a doi jucători, sub prag.
      const R1k = Object.fromEntries(ALL.map((u, i) => [u, i < 2 ? 260 : 120]));
      return { ...base, roundPoints: [R1k], roundComplete: [true] };
    }
    case "L": {
      const R1l = Object.fromEntries(ALL.map((u) => [u, 90]));
      return { ...base, roundPoints: [R1l], roundComplete: [true] };
    }
    default: return { ...base, roundPoints: [{}], roundComplete: [false] };
  }
}

export function buildPusculitaMockView(stateId) {
  const input = getPusculitaMockInput(stateId);
  return { stateId, input, result: computePusculita(input), me: PUSCULITA_MOCK_ME, players: PUSCULITA_MOCK_PLAYERS };
}
