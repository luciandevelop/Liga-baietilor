// ══════════════════════════════════════════════════════════════════════════
// 🛠️ REPARARE RETROACTIVĂ — punctele Bet Builder lipsă dintr-o etapă DEJA FINALIZATĂ.
//
// Context: „Rezolvă” (resolveMain) nu are ramură pentru Bet Builder, iar punctele lui se scriu doar
// la „Recalculează toate cele 9 dueluri”. Dacă etapa a fost finalizată fără acel pas, Finalizează
// a citit mainPoints inexistent și a scris mainSurprisePoints = 0 pentru toți.
//
// Scop STRICT: adaugă retroactiv, pentru fiecare jucător, totalul REAL Bet Builder
// (selecții + bonus Perfect + bonus de duel) ca mainSurprisePoints / mainPoints. NU recalculează
// clasamentul, rank-ul, Top 3, NU re-finalizează etapa, NU atinge bonusPoints / Penalty PvP.
//
// Câmpuri scrise (singurele permise):
//   gameweekScores/{etapă}_{uid}  : mainSurprisePoints, totalPoints
//   weeklySurprises/{etapă}/results/{uid} : mainPoints   (+ uid, doar dacă documentul lipsește)
//   users/{uid}                   : seasonPoints
//
// IDEMPOTENȚĂ: se setează o valoare-ȚINTĂ (mainSurprisePoints = total Bet Builder), iar totalPoints și
// seasonPoints se ajustează cu DIFERENȚA față de starea curentă. La a doua rulare diferența e 0 → nu
// se scrie nimic.
//
// ATOMICITATE: Apply e UN SINGUR runTransaction (~76 citiri, 54 scrieri < limita de 500 de scrieri a
// Firestore) care re-citește totul, re-validează față de Preview și abia apoi scrie. Fie se aplică
// pentru toți 18 jucătorii, fie pentru niciunul. O întrerupere nu poate lăsa o stare parțială; dacă
// tranzacția eșuează, nu s-a scris nimic și se poate relua în siguranță.
// ══════════════════════════════════════════════════════════════════════════
import { doc, getDoc, runTransaction } from "firebase/firestore";
import { db } from "../firebase";
import { computeDuelResult } from "./betBuilderService";
import { getUserNicknames } from "./adminService";

const QUESTIONS = 5;
const EXPECTED_DUELS = 9;
const EXPECTED_PLAYERS = 18;

// JSON canonic: chei sortate recursiv → două citiri ale ACELUIAȘI conținut dau mereu același șir.
function canon(v) {
  if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(",")}}`;
  return JSON.stringify(v === undefined ? null : v);
}

const num = (x) => (x === null || x === undefined || String(x).trim() === "" ? NaN : Number(x));
const isNum = (x) => Number.isFinite(num(x));
const isInt = (x) => typeof x === "number" && Number.isInteger(x);

function refs(gameweekId) {
  return {
    gw: doc(db, "gameweeks", gameweekId),
    pub: doc(db, "weeklySurprises", gameweekId),
    secretMain: doc(db, "weeklySurprises", gameweekId, "secret", "main"),
    bb: doc(db, "betBuilders", gameweekId),
    pick: (uid) => doc(db, "betBuilderPicks", `${gameweekId}_${uid}`),
    score: (uid) => doc(db, "gameweekScores", `${gameweekId}_${uid}`),
    user: (uid) => doc(db, "users", uid),
    result: (uid) => doc(db, "weeklySurprises", gameweekId, "results", uid),
  };
}

// Citește toate documentele necesare. `getter` = (ref) => getDoc(ref)  SAU  (ref) => tx.get(ref).
async function readRaw(getter, gameweekId) {
  const r = refs(gameweekId);
  const [gwS, pubS, secS, bbS] = await Promise.all([getter(r.gw), getter(r.pub), getter(r.secretMain), getter(r.bb)]);
  const bb = bbS.exists() ? bbS.data() : null;
  const uids = [];
  (bb?.duels || []).forEach((d) => [d.playerA, d.playerB].forEach((u) => { if (u && !uids.includes(u)) uids.push(u); }));
  const picks = {}, scores = {}, users = {}, results = {};
  await Promise.all(uids.map(async (uid) => {
    const [p, sc, us, rs] = await Promise.all([getter(r.pick(uid)), getter(r.score(uid)), getter(r.user(uid)), getter(r.result(uid))]);
    picks[uid] = p.exists() ? p.data() : null;
    scores[uid] = sc.exists() ? sc.data() : null;
    users[uid] = us.exists() ? us.data() : null;
    results[uid] = rs.exists() ? rs.data() : null;
  }));
  return {
    gameweekId,
    gameweek: gwS.exists() ? gwS.data() : null,
    pub: pubS.exists() ? pubS.data() : null,
    secretMain: secS.exists() ? secS.data() : null,
    bb, uids, picks, scores, users, results,
  };
}

// ── Calculul unui duel, STRICT: orice ambiguitate devine motiv de blocare, niciodată 0 ca fallback. ──
function computeDuel(duel, group, pickA, pickB) {
  const reasons = [];
  const A = duel.playerA, B = duel.playerB;
  if (!group) { reasons.push("nu există grupul de întrebări al meciului"); return { reasons, players: null }; }
  const qIds = (group.questions || []).map((q) => q.id);
  if (qIds.length !== QUESTIONS) reasons.push(`meciul are ${qIds.length} întrebări (se așteaptă ${QUESTIONS})`);
  const results = group.results || {};
  const pending = qIds.filter((id) => results[id] !== "hit" && results[id] !== "miss");
  if (pending.length) reasons.push(`întrebări nemarcate hit/miss: ${pending.join(", ")}`);

  const check = (uid, pick, label) => {
    if (!pick) { reasons.push(`${label}: niciun bilet salvat`); return; }
    if (pick.confirmed !== true) reasons.push(`${label}: bilet neconfirmat`);
    const keys = Object.keys(pick.picks || {});
    if (keys.length !== qIds.length || !qIds.every((id) => keys.includes(id))) reasons.push(`${label}: biletul nu acoperă exact cele ${qIds.length} întrebări`);
    else if (!keys.every((k) => isInt(pick.picks[k]) && (pick.picks[k] === 0 || pick.picks[k] === 1))) reasons.push(`${label}: alegeri invalide în bilet`);
  };
  check(A, pickA, "A"); check(B, pickB, "B");
  if (reasons.length) return { reasons, players: null };

  const calc = (mine, theirs) => computeDuelResult({
    myPicks: mine.picks, opponentPicks: theirs.picks, results,
    myTiebreaker: mine.tiebreakerAnswer, opponentTiebreaker: theirs.tiebreakerAnswer,
    tiebreakerRealAnswer: group.tiebreakerRealAnswer,
  });
  const rA = calc(pickA, pickB), rB = calc(pickB, pickA);

  if (rA.myHits === rA.oppHits) {
    // Egalitate la selecții → bonusul de duel depinde de baraj; fără date complete NU aproximăm.
    if (!isNum(group.tiebreakerRealAnswer)) reasons.push("egalitate la selecții, dar răspunsul REAL al barajului lipsește");
    if (!isNum(pickA.tiebreakerAnswer)) reasons.push("egalitate la selecții, dar A nu are răspuns la baraj");
    if (!isNum(pickB.tiebreakerAnswer)) reasons.push("egalitate la selecții, dar B nu are răspuns la baraj");
  }
  if (rA.totalPoints == null || rB.totalPoints == null) reasons.push("scorul duelului nu poate fi determinat complet");
  [[A, pickA, rA, "A"], [B, pickB, rB, "B"]].forEach(([, pick, res, label]) => {
    if (pick.pointsAwarded === true && res.totalPoints != null && num(pick.finalPoints) !== res.totalPoints) {
      reasons.push(`${label}: finalPoints salvat (${pick.finalPoints}) diferă de cel calculat (${res.totalPoints})`);
    }
  });
  if (reasons.length) return { reasons, players: null };

  const part = (res) => ({
    hits: res.myHits, basePoints: res.basePoints, perfectBonus: res.perfectBonus,
    duelBonus: res.duelBonus, duelOutcome: res.duelOutcome, total: res.totalPoints,
  });
  return { reasons, players: { [A]: part(rA), [B]: part(rB) } };
}

// ── Planul de reparare: FUNCȚIE PURĂ (fără Firestore), folosită și la Preview, și în tranzacția Apply. ──
export function buildRepairPlan(raw) {
  const { gameweekId, gameweek, secretMain, bb, picks, scores, users, results } = raw;
  const blockers = [];
  const block = (scope, id, message) => blockers.push({ scope, id, message });

  if (!gameweek) block("general", null, "etapa nu există");
  else if (gameweek.status !== "completed") block("general", null, `etapa nu e finalizată (status: ${gameweek.status}) — repararea e doar pentru etape finalizate`);
  if (!secretMain || secretMain.type !== "betBuilder") block("general", null, `Surpriza Mare a etapei nu e Bet Builder (tip: ${secretMain?.type ?? "necunoscut"})`);
  if (!bb) block("general", null, "documentul betBuilders al etapei nu există");

  const duels = [];
  const players = [];
  const duelList = bb?.duels || [];
  if (bb && duelList.length !== EXPECTED_DUELS) block("general", null, `se așteptau ${EXPECTED_DUELS} dueluri, s-au găsit ${duelList.length}`);
  const allUids = raw.uids || [];
  if (bb && allUids.length !== EXPECTED_PLAYERS) block("general", null, `se așteptau ${EXPECTED_PLAYERS} jucători distincți în dueluri, s-au găsit ${allUids.length}`);

  duelList.forEach((duel, i) => {
    const group = (bb.matchGroups || []).find((g) => g.matchId === duel.matchId);
    const c = computeDuel(duel, group, picks[duel.playerA], picks[duel.playerB]);
    const entry = { id: duel.id || `d${i + 1}`, index: i + 1, matchId: duel.matchId, playerA: duel.playerA, playerB: duel.playerB, ok: c.reasons.length === 0, reasons: c.reasons };
    duels.push(entry);
    c.reasons.forEach((m) => block("duel", entry.id, `Duelul ${i + 1}: ${m}`));

    [[duel.playerA, duel.playerB], [duel.playerB, duel.playerA]].forEach(([uid, opp]) => {
      const part = c.players ? c.players[uid] : null;
      const pReasons = [];
      const sc = scores[uid], us = users[uid], rs = results[uid];
      if (!sc) pReasons.push("lipsește gameweekScores pentru acest jucător");
      if (!us) pReasons.push("lipsește documentul jucătorului (users)");
      let current = null;
      if (sc && us) {
        const need = ["pointsFromMatches", "rankingBonus", "bonusSurprisePoints", "totalPoints"];
        const bad = need.filter((k) => !isNum(sc[k]));
        if (bad.length) pReasons.push(`gameweekScores are câmpuri numerice lipsă/invalide: ${bad.join(", ")}`);
        if (sc.mainSurprisePoints !== undefined && !isNum(sc.mainSurprisePoints)) pReasons.push("mainSurprisePoints invalid");
        if (!isNum(us.seasonPoints)) pReasons.push("users.seasonPoints lipsește/invalid");
        if (sc.mainSurpriseType !== "betBuilder") pReasons.push(`gameweekScores.mainSurpriseType = ${sc.mainSurpriseType ?? "null"} (se așteaptă betBuilder)`);
        if (!bad.length) {
          const main = isNum(sc.mainSurprisePoints) ? num(sc.mainSurprisePoints) : 0;
          const joker = isNum(sc.jokerExtraBonus) ? num(sc.jokerExtraBonus) : 0;
          const expectedTotal = num(sc.pointsFromMatches) + num(sc.rankingBonus) + joker + main + num(sc.bonusSurprisePoints);
          if (expectedTotal !== num(sc.totalPoints)) pReasons.push(`totalPoints actual (${sc.totalPoints}) nu corespunde componentelor (${expectedTotal}) — stare inconsistentă`);
          current = {
            mainSurprisePoints: main, totalPoints: num(sc.totalPoints), seasonPoints: num(us.seasonPoints),
            mainPointsResult: rs && isNum(rs.mainPoints) ? num(rs.mainPoints) : null, resultExists: !!rs,
            bonusSurprisePoints: num(sc.bonusSurprisePoints), rank: sc.rank ?? null, rankingBonus: num(sc.rankingBonus),
            pointsFromMatches: num(sc.pointsFromMatches), jokerExtraBonus: joker,
            gameweeksPlayed: us.gameweeksPlayed ?? null, specialPoints: us.specialPoints ?? null,
            resultBonusPoints: rs && rs.bonusPoints !== undefined ? rs.bonusPoints : null,
          };
        }
      }
      const pick = picks[uid];
      const ok = !!part && pReasons.length === 0 && !!current;
      const target = part ? part.total : null;
      const delta = ok ? target - current.mainSurprisePoints : null;
      const needs = ok ? { score: delta !== 0, user: delta !== 0, result: current.mainPointsResult !== target } : { score: false, user: false, result: false };
      pReasons.forEach((m) => block("player", uid, `Jucător ${uid}: ${m}`));
      players.push({
        uid, opponentUid: opp, duelId: entry.id, duelIndex: i + 1, matchId: duel.matchId,
        confirmed: !!pick && pick.confirmed === true,
        hits: part?.hits ?? null, basePoints: part?.basePoints ?? null, perfectBonus: part?.perfectBonus ?? null,
        duelBonus: part?.duelBonus ?? null, duelOutcome: part?.duelOutcome ?? null, total: target,
        current, delta, needs, ok, reasons: [...(c.players ? [] : c.reasons), ...pReasons],
      });
    });
  });

  // Amprenta DATELOR-SURSĂ (duelurile, rezultatele întrebărilor, baraj, biletele): dacă oricare se schimbă
  // între Preview și Apply, Apply refuză — chiar dacă totalurile ar ieși la fel.
  const inputsParts = {
    duels: duelList.map((d) => [d.id, d.matchId, d.playerA, d.playerB]),
    groups: (bb?.matchGroups || []).map((g) => [g.matchId, (g.questions || []).map((q) => q.id), g.results || {}, g.tiebreakerRealAnswer ?? null]),
    picks: allUids.map((u) => {
      const k = picks[u];
      return [u, k ? [k.picks || {}, k.tiebreakerAnswer ?? null, k.confirmed === true, k.pointsAwarded === true, k.finalPoints ?? null] : null];
    }),
  };
  const inputsSig = canon(inputsParts);

  const okPlayers = players.filter((p) => p.ok);
  const needAny = players.some((p) => p.needs.score || p.needs.user || p.needs.result);
  const clean = blockers.length === 0 && players.length === EXPECTED_PLAYERS && okPlayers.length === EXPECTED_PLAYERS;
  return {
    gameweekId, blockers, duels, players, inputsSig, inputsParts,
    totals: {
      duels: duelList.length, duelsOk: duels.filter((d) => d.ok).length,
      players: players.length, playersOk: okPlayers.length,
      sumTarget: okPlayers.reduce((s, p) => s + p.total, 0),
      sumDelta: okPlayers.reduce((s, p) => s + p.delta, 0),
    },
    canApply: clean && needAny,
    alreadyApplied: clean && !needAny,
  };
}

// ── PREVIEW — doar citiri (ZERO scrieri). ──
export async function previewBetBuilderRepair(gameweekId) {
  const raw = await readRaw((ref) => getDoc(ref), gameweekId);
  const plan = buildRepairPlan(raw);
  let nicknames = {};
  try { nicknames = await getUserNicknames(raw.uids); } catch (_) { /* doar afișare */ }
  return { ...plan, nicknames, readAt: Date.now() };
}

// Semnătura valorilor pe care Apply se bazează: dacă ceva diferă față de Preview, nu se aplică.
const SIG_FIELDS = ["total", "delta", "main", "totalPoints", "seasonPoints", "results.mainPoints", "bonusSurprisePoints", "rank", "rankingBonus", "gameweeksPlayed"];
function playerSigRow(p) {
  return [
    p.total, p.delta,
    p.current?.mainSurprisePoints, p.current?.totalPoints, p.current?.seasonPoints, p.current?.mainPointsResult,
    p.current?.bonusSurprisePoints, p.current?.rank, p.current?.rankingBonus, p.current?.gameweeksPlayed,
  ];
}
function planSignature(plan) {
  return plan.inputsSig + canon(plan.players.map((p) => [p.uid, ...playerSigRow(p)]));
}

// Descrie EXACT ce diferă între Preview și starea citită acum (max. 6 rânduri), ca să nu ghicim.
// Întâi CAUZELE din datele-sursă (bilete / rezultate / dueluri), apoi valorile jucătorilor.
function describeChanges(prev, cur) {
  const name = (uid) => prev.nicknames?.[uid] || uid;
  const source = [];
  const values = [];
  const pa = prev.inputsParts || {}, pb = cur.inputsParts || {};
  if (canon(pa.duels) !== canon(pb.duels)) source.push("duelurile (perechile de jucători) s-au schimbat");
  (pb.groups || []).forEach((g, i) => { if (canon((pa.groups || [])[i]) !== canon(g)) source.push(`meciul ${g[0]}: rezultatele întrebărilor / barajul real s-au schimbat`); });
  (pb.picks || []).forEach((k, i) => { if (canon((pa.picks || [])[i]) !== canon(k)) source.push(`biletul lui ${name(k[0])} s-a schimbat (alegeri / baraj / confirmare / finalPoints)`); });
  const prevPl = Object.fromEntries(prev.players.map((p) => [p.uid, p]));
  const curPl = Object.fromEntries(cur.players.map((p) => [p.uid, p]));
  Object.keys({ ...prevPl, ...curPl }).forEach((uid) => {
    const a = prevPl[uid], b = curPl[uid];
    if (!a || !b) { values.push(`${name(uid)}: a ${a ? "dispărut din" : "apărut în"} dueluri`); return; }
    const ra = playerSigRow(a), rb = playerSigRow(b);
    ra.forEach((v, i) => { if (SIG_FIELDS[i] !== "delta" && canon(v) !== canon(rb[i])) values.push(`${name(uid)}: ${SIG_FIELDS[i]} ${v ?? "—"} → ${rb[i] ?? "—"}`); });
  });
  return [...source, ...values].slice(0, 6);
}

// ── APPLY — o singură tranzacție atomică, cu re-validare față de Preview. ──
export async function applyBetBuilderRepair(gameweekId, previewPlan) {
  if (!previewPlan || previewPlan.gameweekId !== gameweekId) throw new Error("Preview lipsă sau pentru altă etapă — rulează din nou Preview.");
  if (!previewPlan.canApply) throw new Error("Preview-ul nu permite Apply (există blocaje sau nu e nimic de aplicat).");
  const r = refs(gameweekId);
  let used = null;

  await runTransaction(db, async (tx) => {
    const raw = await readRaw((ref) => tx.get(ref), gameweekId);
    const plan = buildRepairPlan(raw);
    if (!plan.canApply) {
      throw new Error(plan.alreadyApplied
        ? "Repararea e deja aplicată (diferențele sunt 0) — nu s-a scris nimic."
        : `Re-validare eșuată — ${plan.blockers.map((b) => b.message).slice(0, 3).join(" | ")}`);
    }
    if (planSignature(plan) !== planSignature(previewPlan)) {
      const diffs = describeChanges(previewPlan, plan);
      throw new Error(`Datele s-au schimbat față de Preview${diffs.length ? ` (${diffs.join("; ")})` : " (diferență fără câmp identificat)"} — nu s-a scris nimic. Rulează din nou Preview și verifică-l înainte de Apply.`);
    }
    // TOATE citirile s-au terminat; de aici doar scrieri.
    plan.players.forEach((p) => {
      if (p.needs.score) tx.update(r.score(p.uid), { mainSurprisePoints: p.total, totalPoints: p.current.totalPoints + p.delta });
      if (p.needs.result) {
        tx.set(r.result(p.uid), p.current.resultExists ? { mainPoints: p.total } : { uid: p.uid, mainPoints: p.total }, { merge: true });
      }
      if (p.needs.user) tx.update(r.user(p.uid), { seasonPoints: p.current.seasonPoints + p.delta });
    });
    used = plan;
  });

  const verification = await verifyBetBuilderRepair(gameweekId, used);
  return { plan: used, verification };
}

// ── VERIFICARE POST-APPLY — doar citiri. `plan.players[].current` = starea citită ÎN tranzacție, înainte de scrieri. ──
export async function verifyBetBuilderRepair(gameweekId, plan) {
  const raw = await readRaw((ref) => getDoc(ref), gameweekId);
  const players = plan.players.map((p) => {
    const sc = raw.scores[p.uid], us = raw.users[p.uid], rs = raw.results[p.uid];
    const b = p.current;
    const checks = [];
    const add = (name, expected, actual) => checks.push({ name, expected, actual, ok: expected === actual });
    add("mainSurprisePoints = Bet Builder calculat", p.total, sc ? num(sc.mainSurprisePoints) : null);
    add("mainPoints (results) = aceeași valoare", p.total, rs && isNum(rs.mainPoints) ? num(rs.mainPoints) : null);
    add("totalPoints a crescut exact cu delta", b.totalPoints + p.delta, sc ? num(sc.totalPoints) : null);
    add("seasonPoints a crescut exact cu delta", b.seasonPoints + p.delta, us ? num(us.seasonPoints) : null);
    add("bonusSurprisePoints identic", b.bonusSurprisePoints, sc ? num(sc.bonusSurprisePoints) : null);
    add("rank identic", b.rank, sc ? (sc.rank ?? null) : null);
    add("rankingBonus identic", b.rankingBonus, sc ? num(sc.rankingBonus) : null);
    add("gameweeksPlayed identic", b.gameweeksPlayed, us ? (us.gameweeksPlayed ?? null) : null);
    add("pointsFromMatches identic", b.pointsFromMatches, sc ? num(sc.pointsFromMatches) : null);
    add("jokerExtraBonus identic", b.jokerExtraBonus, sc ? (isNum(sc.jokerExtraBonus) ? num(sc.jokerExtraBonus) : 0) : null);
    add("specialPoints identic", b.specialPoints, us ? (us.specialPoints ?? null) : null);
    add("results.bonusPoints (Penalty) identic", b.resultBonusPoints, rs ? (rs.bonusPoints !== undefined ? rs.bonusPoints : null) : null);
    return { uid: p.uid, ok: checks.every((c) => c.ok), checks };
  });
  const failures = [];
  players.forEach((pl) => pl.checks.filter((c) => !c.ok).forEach((c) => failures.push({ uid: pl.uid, name: c.name, expected: c.expected, actual: c.actual })));
  return { ok: failures.length === 0, players, failures };
}
