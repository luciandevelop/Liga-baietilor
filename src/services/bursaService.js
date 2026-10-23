// ══════════════════════════════════════════════════════════════════
// 👑🐸 PRINȚ SAU BROSCOI? (id intern „bursa-prietenilor”) — MOTOR DE CALCUL
//
// STRICT funcții PURE: niciun import Firebase, nicio citire, nicio
// scriere, niciun listener. Fișierul NU e importat încă de nicio parte
// a aplicației — urcarea lui nu schimbă nimic din ce văd jucătorii.
//
// Aceleași funcții vor fi folosite IDENTIC de:
//   - Admin Preview (bursaMockData.js, date simulate);
//   - ecranul LIVE (din gameweeks/{id}.liveSnapshotPointsByUid);
//   - Rezolvarea definitivă (ramura viitoare din resolveMain).
// O singură sursă de calcul — niciodată două formule care pot diverge.
//
// INTRARE: pointsByUid = pointsFromMatches per jucător (include
// pronosticuri, Meciul Săptămânii, Joker, Lupul Singuratic; EXCLUDE
// bonusul de clasament, Joker Extra, Surprizele). Aceasta e exact
// cifra scrisă de Admin în snapshot-ul LIVE și calculată de
// computeGameweekResults — funcțiile de aici NU o recalculează.
// ══════════════════════════════════════════════════════════════════

export const BURSA_TYPE_ID = "bursa-prietenilor"; // ID INTERN (stocat în Firestore) — NU se redenumește
export const BURSA_PUBLIC_NAME = "PRINȚ SAU BROSCOI?"; // numele public
export const BURSA_LABEL_PRINCE = "Prinț";
export const BURSA_LABEL_FROG = "Broscoi";

// POARTĂ DE ACTIVARE. Cât timp e false, jocul apare în catalog ca „în curând” și NU poate fi ales de Admin
// (deci nu poate fi dezvăluit jucătorilor). Se trece pe true DOAR după ce regulile Firestore pentru
// bursaPicks / bursaMeta sunt verificate și publicate.
export const BURSA_ENABLED = false;

export const BURSA_CATEGORY_PERF = "perf";
export const BURSA_CATEGORY_CONTRA = "contra";
export const BURSA_PICKS_PER_CATEGORY = 2;

export const BURSA_REWARD_FIRST = 75;   // Performanță: locul 1 · Contra: ultimul grup
export const BURSA_REWARD_PODIUM = 45;  // Performanță: locurile 2–3 · Contra: grupurile 2–3 de la coadă
export const BURSA_REWARD_HALF = 20;    // restul jumătății (superioare / inferioare)

export const BURSA_BASE_CAP = 150;
export const BURSA_DUEL_WIN = 50;
export const BURSA_DUEL_TIE = 25;
export const BURSA_BYE_BONUS = 25;

// Zonele — etichete stabile pentru UI (culoare, text), fără logică în ele.
export const BURSA_ZONE = {
  TOP1: "top1",
  TOP3: "top3",
  TOP_HALF: "topHalf",
  LAST: "last",
  BOTTOM3: "bottom3",
  BOTTOM_HALF: "bottomHalf",
  NONE: "none",
};

function toPoints(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function uniqueStrings(list) {
  const out = [];
  const seen = new Set();
  (Array.isArray(list) ? list : []).forEach((x) => {
    if (typeof x === "string" && x && !seen.has(x)) { seen.add(x); out.push(x); }
  });
  return out;
}

// ── Clasamentul Bursei — EXCLUSIV pe lista de eligibili (înghețată la
// închidere). Rang OLIMPIC, aceeași regulă ca computeRankingBonuses din
// scoringEngine.js: rang = 1 + câți au STRICT mai multe puncte (1,1,3).
//
// ELIGIBIL = jucător ACTIV în aplicație — exact mecanismul existent
// listActiveUserIds() (adminService.js, getPlayerStatus === "active").
// Lista o construiește APELANTUL; aici nu se inventează alta.
//   - Jucător DEZACTIVAT de Admin → NU e în eligibleUids → nu apare în
//     clasament, nu poate fi ales, nu e în duel. Chiar dacă pointsByUid
//     conține puncte pentru el, sunt IGNORATE.
//   - Jucător ACTIV fără pronosticuri → ESTE eligibil, intră cu 0 puncte
//     (lipsa din pointsByUid = 0), poate fi ales și poate juca.
//
// Poziții: un grup de egalitate ocupă [start, end] (start = rangul).
// half = floor(N/2). Jumătatea superioară = pozițiile 1..half;
// cea inferioară = N-half+1..N. La N impar, poziția din mijloc nu e în
// nicio jumătate (neutră pentru 20 PCT). Un grup care traversează
// granița nu e „întreg” în nicio jumătate → neutru pentru 20 PCT. ──
export function buildBursaRanking(pointsByUid, eligibleUids) {
  const uids = uniqueStrings(eligibleUids);
  const rows = uids.map((uid) => ({ uid, points: toPoints(pointsByUid?.[uid]) }));
  // Ordinea în cadrul unei egalități e doar pentru afișare stabilă.
  rows.sort((a, b) => (b.points - a.points) || (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));

  const n = rows.length;
  const half = Math.floor(n / 2);
  const bottomStart = n - half + 1;

  const groups = [];
  rows.forEach((r, i) => {
    const last = groups[groups.length - 1];
    if (last && last.points === r.points) {
      last.end = i + 1;
      last.uids.push(r.uid);
    } else {
      groups.push({ points: r.points, start: i + 1, end: i + 1, uids: [r.uid] });
    }
  });

  const byUid = {};
  groups.forEach((g, gi) => {
    const fromBottom = groups.length - 1 - gi; // 0 = ultimul grup distinct
    const inTopHalf = half > 0 && g.end <= half;
    const inBottomHalf = half > 0 && g.start >= bottomStart;
    g.uids.forEach((uid) => {
      byUid[uid] = {
        uid, points: g.points, rank: g.start, start: g.start, end: g.end,
        groupSize: g.uids.length, groupFromTop: gi, groupFromBottom: fromBottom,
        inTopHalf, inBottomHalf,
      };
    });
  });

  return {
    n, half,
    allEqual: groups.length <= 1, // toți la egalitate (sau ≤1 jucător) → toate recompensele 0
    groups: groups.map((g) => ({ points: g.points, start: g.start, end: g.end, uids: [...g.uids] })),
    order: rows.map((r) => r.uid),
    byUid,
  };
}

// ── Recompensa UNEI selecții. Întoarce { reward, zone }. ──
export function computeSelectionReward(category, uid, ranking) {
  const none = { reward: 0, zone: BURSA_ZONE.NONE };
  const e = ranking?.byUid?.[uid];
  if (!e || ranking.allEqual) return none;

  if (category === BURSA_CATEGORY_PERF) {
    if (e.rank === 1) return { reward: BURSA_REWARD_FIRST, zone: BURSA_ZONE.TOP1 };
    if (e.rank <= 3) return { reward: BURSA_REWARD_PODIUM, zone: BURSA_ZONE.TOP3 };
    if (e.inTopHalf) return { reward: BURSA_REWARD_HALF, zone: BURSA_ZONE.TOP_HALF };
    return none;
  }
  if (category === BURSA_CATEGORY_CONTRA) {
    if (e.groupFromBottom === 0) return { reward: BURSA_REWARD_FIRST, zone: BURSA_ZONE.LAST };
    if ((e.groupFromBottom === 1 || e.groupFromBottom === 2) && e.inBottomHalf) {
      return { reward: BURSA_REWARD_PODIUM, zone: BURSA_ZONE.BOTTOM3 };
    }
    if (e.inBottomHalf) return { reward: BURSA_REWARD_HALF, zone: BURSA_ZONE.BOTTOM_HALF };
    return none;
  }
  return none;
}

// ── Portofoliu: { perf: [uid, uid], contra: [uid, uid] }. ──
export function normalizePortfolio(p) {
  return {
    perf: Array.isArray(p?.perf) ? p.perf.slice(0, BURSA_PICKS_PER_CATEGORY) : [],
    contra: Array.isArray(p?.contra) ? p.contra.slice(0, BURSA_PICKS_PER_CATEGORY) : [],
  };
}

// Validare COMPLETĂ (aceeași regulă va fi impusă ulterior și în Rules).
export function validatePortfolio(portfolio, selfUid, eligibleUids) {
  const errors = [];
  const perf = Array.isArray(portfolio?.perf) ? portfolio.perf : [];
  const contra = Array.isArray(portfolio?.contra) ? portfolio.contra : [];
  const eligible = new Set(uniqueStrings(eligibleUids));

  if (perf.length !== BURSA_PICKS_PER_CATEGORY) errors.push("Alege exact 2 Prinți.");
  if (contra.length !== BURSA_PICKS_PER_CATEGORY) errors.push("Alege exact 2 Broscoi.");

  const all = [...perf, ...contra];
  if (all.some((u) => typeof u !== "string" || !u)) errors.push("Selecție invalidă.");
  if (all.includes(selfUid)) errors.push("Nu te poți selecta pe tine.");
  if (new Set(all).size !== all.length) errors.push("Nu poți selecta același coleg de două ori.");
  if (all.some((u) => typeof u === "string" && u && !eligible.has(u))) errors.push("Ai selectat un jucător neeligibil.");

  return { ok: errors.length === 0, errors };
}

// ── Scorul brut al unui portofoliu (fără bonus de duel). ──
export function computePortfolioScore(portfolio, ranking) {
  const p = normalizePortfolio(portfolio);
  const selections = [];
  [[BURSA_CATEGORY_PERF, p.perf], [BURSA_CATEGORY_CONTRA, p.contra]].forEach(([category, list]) => {
    list.forEach((uid, slot) => {
      const e = ranking?.byUid?.[uid] || null;
      const { reward, zone } = computeSelectionReward(category, uid, ranking);
      selections.push({ uid, category, slot, rank: e ? e.rank : null, points: e ? e.points : null, reward, zone });
    });
  });
  const raw = selections.reduce((s, x) => s + x.reward, 0);
  return { selections, raw, base: Math.min(BURSA_BASE_CAP, raw) };
}

// ── Cine conduce un duel: "A" | "B" | "tie" | null (niciunul nu participă). ──
export function duelLeader(a, b) {
  if (!a?.participated && !b?.participated) return null;
  if (a?.participated && !b?.participated) return "A";
  if (!a?.participated && b?.participated) return "B";
  if (a.raw > b.raw) return "A";
  if (b.raw > a.raw) return "B";
  return "tie";
}

// „RĂSTURNARE DE SITUAȚIE!” — DOAR când liderul trece efectiv de la
// unul la celălalt. Egalitatea, primul calcul sau lipsa unei schimbări
// NU declanșează efectul.
export function isLeadReversal(prevLeader, nextLeader) {
  const real = (x) => x === "A" || x === "B";
  return real(prevLeader) && real(nextLeader) && prevLeader !== nextLeader;
}

// ══════════════════════════════════════════════════════════════════
// CALCUL COMPLET — clasament + toate portofoliile + toate duelurile.
//   pairings / byePlayer: exact formatul revealMain (config).
//   eligibleUids: lista înghețată la închidere.
//   picksByUid: { [uid]: portofoliu } — DOAR cei care au salvat.
//   pointsByUid: pointsFromMatches.
// Participă = are portofoliu VALID. Un portofoliu invalid (date
// corupte) e tratat defensiv ca neparticipare, nu ca eroare.
// ══════════════════════════════════════════════════════════════════
// eligibleUids = jucătorii care CONTEAZĂ în clasamentul Bursei (activi acum, din lista de la dezvăluire).
// validUids (opțional) = cine poate fi ales într-un portofoliu valid (implicit = eligibleUids). Se folosește la
// calculul real: un coleg dezactivat DUPĂ ce a fost ales nu mai are loc în clasament (recompensă 0), dar
// portofoliul celui care l-a ales rămâne VALID (nu pierde duelul din cauza unei dezactivări).
export function computeBursaResults({ pairings = [], byePlayer = null, eligibleUids = [], picksByUid = {}, pointsByUid = {}, validUids = null } = {}) {
  const ranking = buildBursaRanking(pointsByUid, eligibleUids);

  function playerState(uid) {
    const pf = picksByUid?.[uid];
    const valid = !!pf && validatePortfolio(pf, uid, validUids || eligibleUids).ok;
    if (!valid) return { uid, participated: false, selections: [], raw: 0, base: 0 };
    const { selections, raw, base } = computePortfolioScore(pf, ranking);
    return { uid, participated: true, selections, raw, base };
  }

  const byUid = {};
  const duels = [];

  function finalize(st, extra) {
    const duelBonus = extra.duelBonus || 0;
    byUid[st.uid] = { ...st, ...extra, duelBonus, total: st.participated ? st.base + duelBonus : 0 };
  }

  (Array.isArray(pairings) ? pairings : []).forEach(({ playerA, playerB } = {}) => {
    if (!playerA || !playerB) return;
    const a = playerState(playerA);
    const b = playerState(playerB);
    const leader = duelLeader(a, b);
    let bonusA = 0, bonusB = 0, outA = "none", outB = "none";
    if (a.participated && b.participated) {
      if (leader === "A") { bonusA = BURSA_DUEL_WIN; outA = "win"; outB = "lose"; }
      else if (leader === "B") { bonusB = BURSA_DUEL_WIN; outB = "win"; outA = "lose"; }
      else { bonusA = BURSA_DUEL_TIE; bonusB = BURSA_DUEL_TIE; outA = "tie"; outB = "tie"; }
    } else if (a.participated) { bonusA = BURSA_DUEL_WIN; outA = "walkover"; }
    else if (b.participated) { bonusB = BURSA_DUEL_WIN; outB = "walkover"; }

    finalize(a, { opponentUid: playerB, isBye: false, outcome: outA, duelBonus: bonusA });
    finalize(b, { opponentUid: playerA, isBye: false, outcome: outB, duelBonus: bonusB });
    duels.push({ playerA, playerB, leader, a: byUid[playerA], b: byUid[playerB] });
  });

  if (byePlayer && !byUid[byePlayer]) {
    const st = playerState(byePlayer);
    finalize(st, { opponentUid: null, isBye: true, outcome: st.participated ? "bye" : "none", duelBonus: st.participated ? BURSA_BYE_BONUS : 0 });
  }

  // Defensiv: un eligibil care a salvat dar nu apare în nicio pereche
  // (nu ar trebui să existe) — primește doar baza, fără bonus de duel.
  Object.keys(picksByUid || {}).forEach((uid) => {
    if (byUid[uid]) return;
    const st = playerState(uid);
    if (st.participated) finalize(st, { opponentUid: null, isBye: false, outcome: "unpaired", duelBonus: 0 });
  });

  return { ranking, byUid, duels };
}

// ── Seria pentru graficul unui duel — din ISTORICUL REAL al validărilor
// (o listă de pointsByUid, câte unul per validare). Nu inventează
// puncte: fiecare punct al graficului = calculul complet de mai sus pe
// acel moment. Folosit de Preview acum; la LIVE, doar cu istoric real. ──
export function buildDuelSeries(history, { playerA, playerB, eligibleUids, picksByUid, validUids = null }) {
  const pairings = playerB ? [{ playerA, playerB }] : [];
  const byePlayer = playerB ? null : playerA;
  let prevLeader = null;
  return (Array.isArray(history) ? history : []).map((step, i) => {
    const res = computeBursaResults({ pairings, byePlayer, eligibleUids, validUids, picksByUid, pointsByUid: step?.pointsByUid || {} });
    const a = res.byUid[playerA] || null;
    const b = playerB ? (res.byUid[playerB] || null) : null;
    const leader = playerB ? duelLeader(a, b) : null;
    const reversal = isLeadReversal(prevLeader, leader);
    if (leader === "A" || leader === "B") prevLeader = leader;
    return { index: i, label: step?.label || `#${i}`, rawA: a ? a.raw : 0, rawB: b ? b.raw : 0, leader, reversal };
  });
}

// ── AJUTOARE PURE pentru integrarea reală ─────────────────────────────────────────────────────────

// Cine contează în clasament: lista fixată la dezvăluire ∩ jucătorii ACTIVI acum (un jucător dezactivat de Admin
// nu apare nicăieri, chiar dacă are puncte). Un jucător activ fără pronosticuri RĂMÂNE (0 puncte).
export function rankingUidsFor(frozenUids, activeSet) {
  const active = activeSet instanceof Set ? activeSet : new Set(activeSet || []);
  return uniqueStrings(frozenUids).filter((u) => active.has(u));
}

// Bursa e blocată dacă Adminul a închis-o SAU a trecut primul meci al etapei (bursaLockAt).
export function isBursaLocked(pub, nowMs) {
  if (!pub) return false;
  if (pub.bursaClosed === true) return true;
  const lock = pub.bursaLockAt;
  const ms = lock && typeof lock.toMillis === "function" ? lock.toMillis() : (typeof lock === "number" ? lock : null);
  return ms != null && Number(nowMs) >= ms;
}

// Redeschiderea e permisă DOAR înainte de primul meci (și doar dacă nu e rezolvată).
export function canReopenBursa(pub, nowMs) {
  if (!pub || pub.mainResolved) return false;
  const lock = pub.bursaLockAt;
  const ms = lock && typeof lock.toMillis === "function" ? lock.toMillis() : (typeof lock === "number" ? lock : null);
  return ms == null || Number(nowMs) < ms;
}

// Istoricul real al validărilor (document bursaMeta/history: entries = { [versiune]: { pointsByUid } }) + instantaneul
// curent, dacă e mai nou decât ultima intrare. Rezultat: [{ label, pointsByUid }], primul = „Start” (toți 0).
export function buildHistoryFromEntries(entries, snapshot) {
  const list = Object.entries(entries || {})
    .map(([v, e]) => ({ v: Number(v), pointsByUid: (e && e.pointsByUid) || {} }))
    .filter((x) => Number.isFinite(x.v))
    .sort((a, b) => a.v - b.v);
  const out = [{ label: "Start — 0 meciuri validate", pointsByUid: {} }];
  list.forEach((e, i) => out.push({ label: `Validare #${i + 1}`, pointsByUid: e.pointsByUid }));
  const last = list[list.length - 1];
  const sv = snapshot && Number.isFinite(Number(snapshot.version)) ? Number(snapshot.version) : null;
  if (snapshot && snapshot.pointsByUid && sv !== null && (!last || sv > last.v)) {
    out.push({ label: `Validare #${list.length + 1}`, pointsByUid: snapshot.pointsByUid });
  }
  return out;
}

// Rezumatul unui jucător, pentru results/{uid}.bursa (transparență în Registru; fără date private).
export function summarizeBursaResult(r) {
  return {
    participated: !!r.participated, raw: r.raw || 0, base: r.base || 0, duelBonus: r.duelBonus || 0,
    outcome: r.outcome || "none", opponentUid: r.opponentUid || null,
    selections: (r.selections || []).map((x) => ({ uid: x.uid, category: x.category, rank: x.rank, reward: x.reward })),
  };
}
