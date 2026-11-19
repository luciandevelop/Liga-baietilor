// Teste: comentatorul (replici pe context real) și titlurile — rulare: node scripts/hideSeekExtras.test.mjs
import { createCommentator, computeTitles, computeStats, turnCardData, HS_LINES } from "../src/hideseek/hsCommentator.js";
import { computeTurn, computeDuel, computeAllPoints } from "../src/services/hideSeekEngine.js";

let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("✗", m); } };
const PK = (h, s) => ({ hide: h.split(""), seek: s.split("") });

// 1) context real: același vânător prinde de 3 ori la aceeași ușă → replică „sameDoorCatch” cu numărul real
let com = createCommentator({ A: "Lu", B: "Cristi" }, "t1");
let r = computeTurn(PK("OOO", "TTT"), PK("SSS", "OOO")); // A ascuns la O, B caută la O → prins ×3
const cats = r.events.map((ev, k) => com.event(ev, 1, k));
const third = cats.filter((c, i) => r.events[i].hider === "A")[2];
ok(third.category === "sameDoorCatch" && /3/.test(third.text) && third.text.includes("Cristi"), `a 3-a prindere la aceeași ușă: ${third.text}`);
// 2) serie de evadări + vânător orb, din date reale
com = createCommentator({ A: "Lu", B: "Cristi" }, "t2");
r = computeTurn(PK("OOO", "SSS"), PK("TTT", "SSS")); // A scapă ×3 (B caută S), B prins? B ascuns T, A caută S → B scapă ×3
const c2 = r.events.map((ev, k) => com.event(ev, 1, k));
ok(c2.some((c) => c.category === "escapeStreak" && /3/.test(c.text)), "trei evadări la rând sunt observate");
r = computeTurn(PK("OTS", "TTT"), PK("SSS", "OOO")); const c3 = r.events.map((ev, k) => com.event(ev, 2, k));
ok([...c2, ...c3].some((c) => c.category === "blindSeeker"), "vânătorul care nu nimerește nimic e observat");
// 3) final de tură: 6–0, 3–3, revenire
com = createCommentator({ A: "Lu", B: "Cristi" }, "t3");
ok(com.turnEnd(1, 6, 0, 15, 0, ["A", "A", "A", "A", "A", "A"]).category === "shutout", "6–0");
ok(com.turnEnd(2, 3, 3, 8, 8, ["A", "B", "A", "B", "A", "B"]).category === "tie", "3–3");
ok(com.turnEnd(3, 4, 2, 20, 0, ["B", "B", "A", "A", "A", "A"]).category === "comebackTurn", "revenire în tură");
ok(com.turnEnd(5, 2, 4, 0, 30, ["A", "B", "B", "A", "B", "B"]).category === "exit", "EXIT la tura 5");
// 4) final: revenire reală (B a fost în urmă și câștigă)
com = createCommentator({ A: "Lu", B: "Cristi" }, "t4"); com.turnEnd(1, 4, 2, 15, 0, []); com.turnEnd(2, 2, 4, 0, 15, []); com.turnEnd(3, 2, 4, 0, 20, []);
ok(com.final(15, 35).category === "finalComeback", "revenire la final, din scor real");
ok(com.final(51, 51).category === "finalTie", "egalitate finală");
// 5) fără repetiții în același show
com = createCommentator({ A: "Lu", B: "Cristi" }, "t5"); const seen = new Set(); let dup = 0;
for (let i = 0; i < HS_LINES.caught.length; i++) { const t = com.event({ hider: "A", seeker: "B", hideDoor: ["O", "T", "S"][i % 3], seekDoor: ["O", "T", "S"][i % 3], caught: true, winner: "B" }, 1, i); if (t.category === "caught") { if (seen.has(t.text)) dup++; seen.add(t.text); } }
ok(dup === 0, "replicile de bază nu se repetă până nu se termină lista");
ok(Object.values(HS_LINES).reduce((a, l) => a + l.length, 0) >= 80, "bibliotecă bogată de replici");
ok(Object.values(HS_LINES).flat().every((t) => !/\{(?!H|S|W|L|A|B|D|Ds|N)\w+\}/.test(t)), "toate variabilele din replici sunt cunoscute");
// 6) titluri: criterii
const game = { pairs: [{ a: "x", b: "y" }, { a: "z", b: "w" }], bye: "b" };
const all5 = (a, b) => Object.fromEntries([1, 2, 3, 4, 5].map((t) => [t, { A: a, B: b }]));
const byPair = { 0: all5(PK("OTS", "TSO"), PK("SOT", "SOT")), 1: { 1: { A: PK("OOO", "OOO"), B: PK("OOO", "OOO") }, 2: { A: PK("OOO", "TTT") } } };
const T = computeTitles(game, byPair); const st = computeStats(game, byPair);
ok(st.x.played === 5 && st.x.caught === 0 && T.ghost.includes("x"), "FANTOMA: 5 ture jucate, niciodată prins");
ok(!T.ghost.includes("z"), "FANTOMA cere toate cele 5 ture");
ok(st.z.played === 1 && st.z.caught === 3, "tura neconfirmată de ambii nu se numără");
ok(T.hunter.length >= 1 && T.loser.length >= 1, `CÂINE: ${T.hunter} · FRAIER: ${T.loser}`);
ok(T.loser.includes("y") === (st.y.caught >= st.z.caught), "FRAIERUL = cel prins de cele mai multe ori");
const tie = computeTitles({ pairs: [{ a: "p", b: "q" }] }, { 0: { 1: { A: PK("OOO", "OOO"), B: PK("OOO", "OOO") } } });
ok(tie.hunter.length === 2 && tie.loser.length === 2, "egalitate perfectă → titlu împărțit");
ok(computeTitles(game, {}).ghost.length === 0 && computeTitles(game, {}).hunter.length === 0, "fără ture jucate → fără titluri");
// 7) cartonașul folosește scorul real al turei
const PL = { A: { nick: "Lu" }, B: { nick: "Cristi" } };
const cd = turnCardData({ 1: { A: PK("OOO", "TTT"), B: PK("TTT", "SSS") } }, false, 1, PL.A, PL.B, "k", "HOL");
ok(cd && cd.winsA === 6 && cd.winsB === 0 && cd.ptsA === 15 && cd.result === "A" && cd.quip.length > 5, "cartonaș: 6–0, 15 PCT");
ok(turnCardData({ 1: { A: PK("OOO", "TTT") } }, false, 1, PL.A, PL.B, "k", "HOL") === null, "fără cartonaș pentru tura nejucată de ambii");
// 8) punctajul NU e atins de nimic nou
ok(computeAllPoints(game, byPair, true).x === 8 + 8 + 10 + 10 + 15 && computeAllPoints(game, byPair, true).b === 50, "punctajul rămâne cel aprobat (5 egalități = 51, bancă = 50)");
ok(T.ghost.includes("y"), "doi jucători neprinși → FANTOMA împărțită");
console.log(`\nREZULTAT: ${pass} trecute, ${fail} eșuate`); process.exit(fail ? 1 : 0);
