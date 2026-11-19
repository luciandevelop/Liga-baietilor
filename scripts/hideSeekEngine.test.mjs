// Teste pentru motorul 🚪 Ascunselea — rulare: node scripts/hideSeekEngine.test.mjs
import { HS_DOORS, HS_TURN_VALUES, HS_TIE_VALUES, HS_BYE_POINTS, computeTurn, computeDuel, computeAllPoints, drawPairs, isValidPick, pickQuip, HS_QUIPS } from "../src/services/hideSeekEngine.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("✗", m); } };
const P = (h, s) => ({ hide: h.split(""), seek: s.split("") });

// 1) Exhaustiv: toate cele 729 × 729 combinații ale unei ture
const all = [];
for (const a of HS_DOORS) for (const b of HS_DOORS) for (const c of HS_DOORS) all.push([a, b, c]);
let ties = 0, n = 0, bad = 0;
for (const h1 of all) for (const s1 of all) {
  const pa = { hide: h1, seek: s1 };
  for (const h2 of all) for (const s2 of all) {
    const r = computeTurn(pa, { hide: h2, seek: s2 }); n++;
    if (r.winsA + r.winsB !== 6 || r.events.length !== 6) bad++;
    if (r.result === "T") ties++;
  }
}
ok(bad === 0, "fiecare tură are exact 6 confruntări, iar câștigurile se adună la 6");
console.log(`  ${n.toLocaleString("ro-RO")} ture verificate; 3–3 în ${(100 * ties / n).toFixed(1)}% din combinații`);

// 2) Reguli de bază
let r = computeTurn(P("OOO", "OOO"), P("OOO", "OOO"));
ok(r.winsA === 3 && r.winsB === 3 && r.result === "T", "aceeași ușă peste tot → toți prinși → 3–3");
r = computeTurn(P("OOO", "OOO"), P("TTT", "TTT")); // A ascuns la O, B caută la T → A scapă (3); B ascuns la T, A caută la O → B scapă (3)
ok(r.result === "T", "toți scapă → 3–3");
r = computeTurn(P("OOO", "TTT"), P("TTT", "SSS")); // A scapă ×3 (B caută S), A prinde ×3 (B ascuns T, A caută T)
ok(r.winsA === 6 && r.result === "A", "6–0 pentru A");
ok(r.events.slice(0, 3).every((e) => e.hider === "A" && e.half === 1) && r.events.slice(3).every((e) => e.hider === "B" && e.half === 2), "două reprize: întâi B caută de 3 ori, apoi A caută de 3 ori");

// 3) Punctaj: exhaustiv pe toate cele 3^5 rezultate de ture
const T = ["A", "B", "T"]; let maxInd = 0, maxPool = 0;
const pickFor = { A: [P("OOO", "TTT"), P("TTT", "SSS")], B: [P("TTT", "SSS"), P("OOO", "TTT")], T: [P("OOO", "OOO"), P("OOO", "OOO")] };
for (let m = 0; m < 243; m++) {
  let x = m; const picks = {};
  for (let t = 1; t <= 5; t++) { const res = T[x % 3]; x = Math.floor(x / 3); picks[t] = { A: pickFor[res][0], B: pickFor[res][1] }; }
  const d = computeDuel(picks, true);
  maxInd = Math.max(maxInd, d.totalA, d.totalB); maxPool = Math.max(maxPool, d.totalA + d.totalB);
  if (d.played !== 5) bad++;
}
ok(maxInd === 100, `maxim individual = 100 (găsit ${maxInd})`);
ok(maxPool === 102, `maxim pe pereche = 102, din rotunjirea egalităților (găsit ${maxPool})`);
ok(HS_TIE_VALUES.join() === "8,8,10,10,15", "egalitate: 8 · 8 · 10 · 10 · 15");
ok(HS_TURN_VALUES.reduce((a, b) => a + b) === 100, "turele însumează 100");
const allWin = {}; for (let t = 1; t <= 5; t++) allWin[t] = { A: pickFor.A[0], B: pickFor.A[1] };
ok(computeDuel(allWin, true).totalA === 100 && computeDuel(allWin, true).totalB === 0, "5 ture câștigate = 100 / 0");
const allTie = {}; for (let t = 1; t <= 5; t++) allTie[t] = { A: pickFor.T[0], B: pickFor.T[1] };
const dt = computeDuel(allTie, true);
ok(dt.totalA === 51 && dt.totalB === 51 && dt.winner === "T", "5 egalități = 51 / 51, EGALITATE");

// 4) Absență / abandon (la termen, closed = true)
const g = P("OOO", "TTT");
let d = computeDuel({ 1: { A: g } }, true);
ok(d.totalA === 100 && d.totalB === 0, "B nu intră deloc, A a confirmat tura 1 → A 100 / B 0");
d = computeDuel({}, true);
ok(d.totalA === 0 && d.totalB === 0 && d.turns.every((x) => x.status === "void"), "niciunul nu intră → 0 / 0");
d = computeDuel({ 1: pickFor.A.length && { A: pickFor.A[0], B: pickFor.A[1] }, 2: { A: pickFor.B[0], B: pickFor.B[1] }, 3: { B: g } }, true);
ok(d.totalA === 15 && d.totalB === 15 + 20 + 20 + 30, "A câștigă t1, B câștigă t2, A dispare la t3 → A 15 / B 85");
ok(d.turns[2].status === "forfeitB" && d.turns[4].status === "forfeitB", "turele 3–5 marcate câștigate de B prin absență");
d = computeDuel({ 1: { A: pickFor.T[0], B: pickFor.T[1] } }, true);
ok(d.totalA === 8 && d.totalB === 8 && d.turns[1].status === "void", "t1 3–3, apoi niciunul → 8 / 8");
d = computeDuel({ 1: { A: g } }, false);
ok(d.turns[0].status === "waitB" && d.turns[1].status === "locked" && d.totalA === 0 && !d.finished, "înainte de termen: A așteaptă, nimic acordat");
d = computeDuel({ 1: { A: g, B: g } }, false);
ok(d.currentTurn === 2 && d.turns[1].status === "open", "după ce confirmă amândoi, se deschide tura 2");
d = computeDuel({ 1: { A: { hide: ["O"], seek: ["T"] } } }, true);
ok(d.totalA === 0 && d.totalB === 0, "alegere invalidă = neprezentare");

// 5) Validare
ok(isValidPick(g) && !isValidPick({ hide: ["O", "O", "X"], seek: ["O", "O", "O"] }) && !isValidPick({ hide: ["O"], seek: [] }) && !isValidPick(null), "validarea alegerilor");

// 6) Tragerea la sorți + BYE
for (const k of [2, 17, 18]) {
  const uids = Array.from({ length: k }, (_, i) => "u" + i);
  const { pairs, bye } = drawPairs(uids);
  const seen = new Set(pairs.flatMap((p) => [p.a, p.b]).concat(bye ? [bye] : []));
  ok(seen.size === k && pairs.length === Math.floor(k / 2) && (k % 2 ? !!bye : bye === null), `tragere corectă pentru ${k} jucători`);
}
const game = { pairs: [{ a: "x", b: "y" }], bye: "z" };
const pts = computeAllPoints(game, { 0: { 1: { A: g } } }, true);
ok(pts.x === 100 && pts.y === 0 && pts.z === HS_BYE_POINTS, "puncte oficiale: absență + BYE 50");

// 7) Replici: deterministe, cu nume, fără acolade rămase
const q1 = pickQuip("caught", "0_1_2", { H: "Ghioca", S: "Lu" });
ok(q1 === pickQuip("caught", "0_1_2", { H: "Ghioca", S: "Lu" }) && !/[{}]/.test(q1), "replici deterministe și completate");
const total = Object.values(HS_QUIPS).reduce((a, l) => a + l.length, 0);
ok(total >= 40, `bibliotecă de replici: ${total}`);

console.log(`\nREZULTAT: ${pass} trecute, ${fail} eșuate`);
process.exit(fail ? 1 : 0);
