// ══════════════════════════════════════════════════════════════════
// 🧪 ASCUNSELEA — DATE DEMO (fără Firebase). Folosite de demo-urile din Admin.
// ══════════════════════════════════════════════════════════════════
import { drawPairs, HS_LEVELS } from "../services/hideSeekEngine";
import { turnCardData } from "./hsCommentator";

const NICKS = ["Lu", "Ghioca", "AdiReal", "Sexu", "Mihai", "Vlad", "Cristi", "Dani", "Bogdan", "Răzvan", "Tudor", "Ionuț", "Sorin", "Andrei", "Paul", "Radu", "Alex", "Marius"];
export function demoPlayers() { return Object.fromEntries(NICKS.map((nick, i) => [`d${i + 1}`, { nick, number: i + 1, avatarId: `s3/${i + 1}` }])); }
function seeded(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
export function demoDraw() { const players = demoPlayers(); const { pairs, bye } = drawPairs(Object.keys(players), seeded(11)); return { players, pairs, bye }; }
const PK = (h, s) => ({ hide: h.split(""), seek: s.split("") });
// Duelul demo Lu (A) vs Cristi (B): fiecare tură arată altceva (4–2, 3–3, 6–0, revenire, 0–6 la EXIT)
export const DEMO_DUEL_PICKS = {
  1: { A: PK("OOO", "TSO"), B: PK("SOT", "OTS") },
  2: { A: PK("OTS", "OTS"), B: PK("OTS", "OTS") },
  3: { A: PK("OOO", "TTT"), B: PK("TTT", "SSS") },
  4: { A: PK("STO", "OSS"), B: PK("OSS", "STT") },
  5: { A: PK("TTO", "SOO"), B: PK("OSS", "TTO") },
};
export function demoDuel(variant = "full") {
  const players = demoPlayers(); const pair = { a: "d1", b: "d7" };
  let picks = DEMO_DUEL_PICKS; let closed = false; let fromTurn = 1; let toTurn = 5;
  const lv = /^level(\d)$/.exec(variant); if (lv) { fromTurn = toTurn = Number(lv[1]); }
  if (variant === "tie") { fromTurn = toTurn = 2; }
  if (variant === "exit") { fromTurn = toTurn = 5; }
  if (variant === "forfeit") { picks = { 1: DEMO_DUEL_PICKS[1], 2: DEMO_DUEL_PICKS[2], 3: { A: DEMO_DUEL_PICKS[3].A } }; closed = true; }
  return { players, pair, picks, closed, fromTurn, toTurn, key: "demo_" + variant };
}
// Seara de proiecție demo: 9 dueluri reale (alegeri generate), unul abandonat, unul nejucat
export function demoCinema() {
  const { players, pairs, bye } = demoDraw(); const rnd = seeded(77); const D = ["O", "T", "S"]; const r3 = () => [0, 1, 2].map(() => D[Math.floor(rnd() * 3)]);
  const byPair = {};
  pairs.forEach((p, i) => {
    const turns = i === 7 ? 2 : i === 8 ? 0 : 5; byPair[i] = {};
    for (let t = 1; t <= turns; t++) byPair[i][t] = { A: { hide: r3(), seek: r3() }, B: { hide: r3(), seek: r3() } };
    if (i === 7) byPair[i][3] = { A: { hide: r3(), seek: r3() } }; // B dispare după tura 2
    if (i === 0) byPair[i] = { ...DEMO_DUEL_PICKS };
    if (i === 1) for (let t = 1; t <= 5; t++) byPair[i][t] = { A: PK("OTS", "TSO"), B: PK("SOT", "SOT") }; // cineva care nu e prins niciodată → FANTOMA
  });
  return { players, pairs, bye, byPair, closed: true, gw: "demo" };
}
export function demoCard() { const p = demoPlayers(); const A = { nick: p.d1.nick, num: "001", avatarId: p.d1.avatarId }, B = { nick: p.d7.nick, num: "007", avatarId: p.d7.avatarId }; return { A, B, base: turnCardData(DEMO_DUEL_PICKS, false, 3, A, B, "demo_card", HS_LEVELS[2]) }; }
