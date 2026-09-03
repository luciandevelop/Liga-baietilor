// ══════════════════════════════════════════════════════════════════
// FEED ENGINE v3 — reconstrucție completă, cerută explicit după ce
// motorul v2 s-a dovedit fragil (processLiveRankChanges scrisă corect,
// dar niciodată conectată la vreun trigger — cod mort; variația de
// limbaj hash-uia CONȚINUTUL opțiunilor, nu ID-ul evenimentului, deci
// dădea mereu ACELAȘI text pentru aceeași categorie, niciodată variat
// real). Ambele găsite și reparate aici, ca parte din reconstrucție,
// nu ca patch-uri separate.
//
// PIPELINE CONCEPTUAL (fiecare etapă = funcții separate, nu un monolit):
//   RAW EVENT    — ce s-a întâmplat, fapt brut, fără text (ex:
//                  "uid X a trecut de pe rank 7 pe rank 3")
//   CONTEXT      — îmbogățire: e schimbare de lider? intrare pe podium?
//                  salt mare? (booleeni derivați, tot fără text)
//   IMPORTANCE   — scor numeric, din context, decide ce se păstrează/
//                  agregă/evidențiază — NU decide ordinea cronologică
//   NARRATIVE    — abia AICI se generează title/subtitle, dintr-un pool
//                  de variante, ales determinist din hash(eventId) —
//                  aceeași poveste arată mereu la fel, poveștile
//                  diferite nu sună toate identic
//   AGGREGATION  — mai multe raw events din același "moment" (ex. 6
//                  jucători își schimbă locul după un singur meci) devin
//                  1-2 carduri "poveste", nu 6 carduri individuale
//   DEDUPLICATION — ID determinist pe tranziția EXACTĂ (nu pe timestamp)
//                  — reprocesarea aceluiași eveniment e no-op în Firestore
// ══════════════════════════════════════════════════════════════════

import { canRevealPredictions } from "./matchLockRule";

// ── Hash determinist REAL, pe un string arbitrar (de obicei eventId) —
// BUG REPARAT: varianta veche hash-uia lungimile textelor din pool-ul de
// opțiuni, nu evenimentul propriu-zis, deci ACELAȘI pool dădea mereu
// ACEEAȘI frază, indiferent care eveniment o cerea. Acum: eventId
// diferit → (foarte probabil) variantă diferită; ACELAȘI eventId →
// ÎNTOTDEAUNA aceeași variantă (stabil la refresh). ──
function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}
function pick(options, seed) {
  if (options.length === 1) return options[0];
  return options[hashSeed(String(seed)) % options.length];
}

// ── Anti-repetiție DETERMINISTĂ — cerut explicit: hash-ul stabil poate
// alege accidental aceeași variantă de mai multe ori la rând. Dacă
// indexul ales de hash e în lista celor recent folosite (pentru
// ACELAȘI subtip), avansăm liniar (tot determinist — niciun
// Math.random) până găsim una neutilizată recent. Dacă TOATE sunt
// recent folosite (pool mic), renunțăm și-l folosim oricum — mai bine
// o repetiție ocazională decât un index infinit. ──
function pickIndexAvoiding(optionsLength, seed, avoidIndices) {
  const start = hashSeed(String(seed)) % optionsLength;
  if (!avoidIndices || avoidIndices.size === 0 || avoidIndices.size >= optionsLength) return start;
  for (let i = 0; i < optionsLength; i++) {
    const idx = (start + i) % optionsLength;
    if (!avoidIndices.has(idx)) return idx;
  }
  return start;
}
function pickAvoiding(options, seed, avoidIndices) {
  if (options.length === 1) return { text: options[0], index: 0 };
  const index = pickIndexAvoiding(options.length, seed, avoidIndices);
  return { text: options[index], index };
}

// ══════════════════════════════════════════════════════════════════
// SCHEMA — fiecare eveniment scris în Firestore respectă asta. `type`/
// `subtype` țin loc de vechiul `category`, dar mai granular — UI-ul și
// motorul de agregare pot distinge "gol banal" de "gol decisiv" fără să
// parseze text. `metadata` ține datele STRUCTURATE (nu doar textul deja
// format) — esențial pentru agregare și pentru orice motor viitor
// (Surprize) care va vrea să consume Feed-ul fără să reconstruiască din
// propoziții.
// ══════════════════════════════════════════════════════════════════
export const TYPE = {
  RANK: "rank", MATCH: "match", PREDICTION: "prediction",
  FACT: "fact", BANTER: "banter", SURPRISE: "surprise",
};

export const IMPORTANCE = {
  NEW_LEADER: 100, RANK_MAXIMA: 95, PODIUM_ENTRY: 90, PODIUM_EXIT: 85,
  BIG_CLIMB: 80, BIG_DROP: 75, TOP10_ENTRY: 72, TOP10_EXIT: 70, RANK_MINOR: 55,
  MATCH_DECISIVE_GOAL: 78, MATCH_FINAL_WITH_EXACT: 76, MATCH_FINAL: 68,
  GOAL_MAJOR: 73, GOAL_ROUTINE: 40,
  EXACT_SCORE_RARE: 74, EXACT_SCORE: 60,
  JOKER: 58, UPCOMING_IMPORTANT: 50, PREVIEW: 35,
  FACT_INTERNAL: 45, BANTER_ATTACHED: 0,
  FUN: 15, CITY_FACT: 42,
  SURPRISE_CREATED: 65, SURPRISE_MATCHUP: 68, SURPRISE_PROGRESS: 48, SURPRISE_RESULT: 72, SURPRISE_REWARD: 66,
  LIVE_STARTED: 40, LIVE_GOAL: 77, LIVE_LEAD_CHANGE: 82, LIVE_HALFTIME: 45, LIVE_RED_CARD: 70, LIVE_FULLTIME: 68,
  LINEUP: 52, LINEUP_SCORER_SURPRISE: 62, H2H_FACT: 38, FORM_FACT: 36, INJURY: 44, API_PREDICTION: 40,
};

export const VISUAL_CATEGORY = {
  [TYPE.RANK]: { label: "CLASAMENT", icon: "👑" },
  [TYPE.MATCH]: { label: "MECI", icon: "⚽" },
  [TYPE.PREDICTION]: { label: "PREDICȚII", icon: "🎯" },
  [TYPE.FACT]: { label: "FACT", icon: "📊" },
  [TYPE.BANTER]: { label: "MOMENT", icon: "🔥" },
  [TYPE.SURPRISE]: { label: "SURPRIZĂ", icon: "🎲" },
};

// ══════════════════════════════════════════════════════════════════
// 1. RANK
// ══════════════════════════════════════════════════════════════════
function rankContext(before, row, totalPlayers) {
  const moved = before.rank - row.rank;
  if (moved === 0) return null;
  return {
    uid: row.uid, nickname: row.nickname, moved,
    rankBefore: before.rank, rankAfter: row.rank,
    pointsBefore: before.points, pointsAfter: row.seasonPoints,
    becameLeader: row.rank === 1 && before.rank !== 1,
    lostLead: before.rank === 1 && row.rank !== 1,
    enteredTop3: row.rank <= 3 && before.rank > 3,
    leftTop3: row.rank > 3 && before.rank <= 3,
    enteredTop10: row.rank <= 10 && before.rank > 10 && totalPlayers > 10,
    leftTop10: row.rank > 10 && before.rank <= 10 && totalPlayers > 10,
    lastPlaceChange: row.rank === totalPlayers || before.rank === totalPlayers,
    bigClimb: moved >= 5, climb3plus: moved >= 3,
    bigDrop: moved <= -5, drop3plus: moved <= -3,
  };
}

function rankImportance(ctx) {
  if (ctx.becameLeader) return IMPORTANCE.NEW_LEADER;
  if (ctx.lostLead) return IMPORTANCE.RANK_MAXIMA;
  if (ctx.enteredTop3) return IMPORTANCE.PODIUM_ENTRY;
  if (ctx.leftTop3) return IMPORTANCE.PODIUM_EXIT;
  if (ctx.bigClimb) return IMPORTANCE.BIG_CLIMB;
  if (ctx.bigDrop) return IMPORTANCE.BIG_DROP;
  if (ctx.enteredTop10) return IMPORTANCE.TOP10_ENTRY;
  if (ctx.leftTop10) return IMPORTANCE.TOP10_EXIT;
  // BUG REPARAT: "lastPlaceChange" (orice mutare care ATINGE ultimul
  // loc) califica pentru publicare INDIFERENT de câte poziții s-au
  // mișcat cu adevărat — o mutare banală de 1 loc (10→11) la coada
  // clasamentului apărea ca și card individual, de fiecare dată când
  // se întâmpla, la orice user. Exact spam-ul semnalat explicit
  // ("RZVN a coborât pe 11", "Bogdan B a coborât pe 11", "AndreiS a
  // coborât pe 11" — 3 carduri aproape identice). Povestea REALĂ,
  // interesantă ("cineva preia lanterna roșie") e deja spusă mult mai
  // bine de detectBottomStory (bottom_takeover/escape_last) — nu are
  // nevoie de dublură aici. Rămâne doar climb3plus/drop3plus (mutare
  // reală de minim 3 poziții).
  if (ctx.climb3plus || ctx.drop3plus) return IMPORTANCE.RANK_MINOR;
  return null;
}

function pozitii(n) { return n === 1 ? "1 poziție" : `${n} poziții`; }

// ── Pool-uri de variante — extinse la cererea explicită „nu vreau
// template-generated". Fiecare frază e completă, gândită separat, nu
// un fragment lipit. NEW_LEADER/BIG_CLIMB/BIG_DROP au cele mai multe
// variante (evenimente frecvente); TOP10 are mai puține (rar). ──
const POOL_NEW_LEADER = (n, scope, ot) => [
  `👑 ${n} preia conducerea${scope}!${ot}`,
  `👑 ${n} este noul lider${scope}${ot}`,
  `👑 Schimbare la vârf${scope} — ${n} trece pe primul loc${ot}`,
  `👑 ${n} urcă direct pe primul loc${scope}${ot}`,
  `👑 Avem un nume nou în frunte${scope}: ${n}${ot}`,
  `👑 ${n} ia coroana${scope}${ot}`,
  `🏆 ${n} preia fruntea clasamentului${scope}${ot}`,
  `👑 ${n} trece în față — locul 1 are proprietar nou${ot}`,
  `👑 Poziția 1${scope} e a lui ${n} acum${ot}`,
  `🥇 ${n} e liderul momentului${scope}${ot}`,
  `👑 ${n} sare direct în frunte${scope}${ot}`,
  `👑 Vârful clasamentului${scope} se schimbă: ${n} conduce acum${ot}`,
];
const POOL_LEADER_LOST = (n, scope) => [
  `👑 ${n} pierde primul loc${scope} după ultimul rezultat`,
  `👑 Domnia lui ${n}${scope} se termină aici — cade pe alt loc`,
  `👑 ${n} cade de pe tron${scope}`,
  `${n} nu mai e lider${scope} — locul 1 a scăpat`,
  `Fostul lider${scope}, ${n}, acum doar unul dintre mulți`,
  `Coroana i-a alunecat lui ${n}${scope}`,
  `${n} pierde fruntea clasamentului${scope}`,
  `Nu mai e ${n} în frunte${scope}`,
  `${n} iese din prim-plan${scope} — altcineva conduce acum`,
  `👑 Scurtă domnie pentru ${n}${scope}`,
];
const POOL_PODIUM_ENTRY = (n, scope, rank, ot) => [
  `🔥 ${n} urcă pe podium${scope}${ot}`,
  `🔥 ${n} intră în top 3${scope}, pe locul ${rank}`,
  `🔥 Loc pe podium pentru ${n}${scope}`,
  `🔥 ${n} pășește pe podium${scope}`,
  `${n} se alătură primilor trei${scope}`,
  `🔥 Podiumul${scope} are un nume nou: ${n}`,
  `${n} ajunge în top 3${scope}, pe locul ${rank}`,
  `🔥 ${n} forțează intrarea pe podium${scope}`,
  `Top 3${scope} se schimbă — ${n} e acolo acum`,
  `🔥 ${n} urcă până pe podium${scope}`,
];
const POOL_PODIUM_EXIT = (n, scope, rank) => [
  `😬 ${n} cade de pe podium${scope}, pe locul ${rank}`,
  `😬 Podiumul${scope} nu-l mai are pe ${n} — coboară pe ${rank}`,
  `${n} iese din top 3${scope}`,
  `😬 ${n} pierde locul de pe podium${scope}`,
  `Podiumul${scope} își schimbă fața — ${n} nu mai e acolo`,
  `😬 ${n} coboară sub linia podiumului${scope}`,
  `${n} a fost pe podium${scope}. A fost.`,
  `😬 Loc pierdut pe podium pentru ${n}${scope}`,
  `Top 3${scope} rămâne fără ${n}`,
  `😬 ${n} alunecă în afara podiumului${scope}, pe locul ${rank}`,
];
const POOL_BIG_CLIMB = (n, scope, moved, rank) => [
  `🚀 ${n} urcă ${pozitii(moved)}${scope} și ajunge pe locul ${rank}`,
  `🚀 ${n} face saltul etapei: locul ${rank + moved} → ${rank}`,
  `📈 Rezultatul îi priește lui ${n}${scope}: ${pozitii(moved)} câștigate`,
  `🚀 ${n} trece prin clasament${scope} ca prin ușă rotativă`,
  `${n} sare ${pozitii(moved)} într-un singur meci`,
  `🚀 Urcare masivă pentru ${n}${scope}`,
  `📈 ${n} câștigă teren rapid${scope}`,
  `${n} face un salt de ${pozitii(moved)}${scope}`,
  `🚀 Clasamentul${scope} se rearanjează în favoarea lui ${n}`,
  `Nimeni nu se aștepta la urcarea asta a lui ${n}`,
  `🚀 ${n} profită din plin de etapa asta`,
  `Meciul ăsta l-a propulsat pe ${n}${scope}`,
  `🚀 ${n} ia cu asalt clasamentul${scope}`,
  `Salt spectaculos${scope}: ${n}, +${moved} locuri`,
  `🚀 ${n} trece peste mulți dintr-o dată`,
];
const POOL_BIG_DROP = (n, scope, moved, rank) => [
  `📉 ${n} cade ${pozitii(moved)}${scope} după ultimul rezultat`,
  `📉 Etapă de uitat pentru ${n}${scope}`,
  `Clasamentul${scope} a apăsat pe lift pentru ${n}`,
  `📉 ${n} pierde teren rapid${scope}`,
  `Cădere abruptă${scope} pentru ${n}`,
  `📉 ${n} coboară ${pozitii(moved)} într-un singur meci`,
  `Nu a fost meciul lui ${n}`,
  `📉 ${n} alunecă puternic în clasament${scope}`,
  `Rezultatul l-a costat scump pe ${n}`,
  `📉 ${n} plonjează ${pozitii(moved)}`,
  `Etapa asta nu intră în CV-ul lui ${n}`,
  `📉 Cădere de proporții${scope} pentru ${n}`,
  `${n} a pierdut teren masiv${scope}`,
  `📉 Meciul ăsta l-a costat pe ${n}`,
  `${n} coboară vizibil în clasament${scope}, pe locul ${rank}`,
];
const POOL_TOP10_ENTRY = (n, scope, rank) => [
  `${n} intră în top 10${scope}, pe locul ${rank}`,
  `${n} ajunge în primii 10${scope}`,
  `Loc în top 10${scope} pentru ${n}`,
  `${n} trece pragul de top 10${scope}`,
  `Top 10${scope} are un nume nou: ${n}`,
  `${n} forțează intrarea în top 10${scope}`,
  `${n} urcă în top 10${scope}, pe locul ${rank}`,
  `Primii 10${scope} îl au acum și pe ${n}`,
];
const POOL_TOP10_EXIT = (n, scope, rank) => [
  `${n} iese din top 10${scope}, pe locul ${rank}`,
  `${n} cade sub linia primilor 10${scope}`,
  `Top 10${scope} rămâne fără ${n}`,
  `${n} pierde locul din top 10${scope}`,
  `${n} alunecă în afara top 10${scope}`,
  `Nu mai e ${n} în top 10${scope}`,
  `${n} coboară sub top 10${scope}, pe locul ${rank}`,
  `Loc pierdut în top 10${scope} pentru ${n}`,
];

function rankNarrative(ctx, seed, overtaken, scopeLabel, avoidIndices) {
  const overtakenText = overtaken.length > 0 ? ` — l-a depășit pe ${overtaken.join(" și ")}` : "";
  let pool = null, args = null;
  if (ctx.becameLeader) { pool = POOL_NEW_LEADER; args = [ctx.nickname, scopeLabel, overtakenText]; }
  else if (ctx.lostLead) { pool = POOL_LEADER_LOST; args = [ctx.nickname, scopeLabel]; }
  else if (ctx.enteredTop3) { pool = POOL_PODIUM_ENTRY; args = [ctx.nickname, scopeLabel, ctx.rankAfter, overtakenText]; }
  else if (ctx.leftTop3) { pool = POOL_PODIUM_EXIT; args = [ctx.nickname, scopeLabel, ctx.rankAfter]; }
  else if (ctx.bigClimb) { pool = POOL_BIG_CLIMB; args = [ctx.nickname, scopeLabel, ctx.moved, ctx.rankAfter]; }
  else if (ctx.bigDrop) { pool = POOL_BIG_DROP; args = [ctx.nickname, scopeLabel, Math.abs(ctx.moved), ctx.rankAfter]; }
  else if (ctx.enteredTop10) { pool = POOL_TOP10_ENTRY; args = [ctx.nickname, scopeLabel, ctx.rankAfter]; }
  else if (ctx.leftTop10) { pool = POOL_TOP10_EXIT; args = [ctx.nickname, scopeLabel, ctx.rankAfter]; }
  else if (ctx.moved > 0) return { text: pick([`${ctx.nickname} a urcat ${pozitii(ctx.moved)}${scopeLabel}${overtakenText}`], seed), index: 0 };
  else return { text: pick([`${ctx.nickname} a coborât ${pozitii(Math.abs(ctx.moved))}${scopeLabel}`], seed), index: 0 };

  const options = pool(...args);
  return pickAvoiding(options, seed, avoidIndices);
}

function findOvertaken(row, before, currentRows, prevState) {
  if (before.rank - row.rank <= 0) return [];
  return currentRows
    .filter((other) => {
      const otherBefore = prevState[other.uid];
      if (!otherBefore || other.uid === row.uid) return false;
      return otherBefore.rank < before.rank && other.rank > row.rank;
    })
    .map((other) => other.nickname)
    .slice(0, 2);
}

export function detectRankChangeEvents(prevState, currentRows, opts = {}) {
  const idPrefix = opts.idPrefix || "rank";
  const scopeLabel = opts.scopeLabel || "";
  const recentVariants = opts.recentVariants || {}; // { [subtype]: Set<index> }
  if (!prevState) return [];
  const totalPlayers = currentRows.length;
  const raw = [];

  currentRows.forEach((row) => {
    const before = prevState[row.uid];
    if (!before) return;
    const ctx = rankContext(before, row, totalPlayers);
    if (!ctx) return;
    const importance = rankImportance(ctx);
    if (importance == null) return;

    const subtype = ctx.becameLeader ? "new_leader" : ctx.lostLead ? "leader_lost"
      : ctx.enteredTop3 ? "podium_entry" : ctx.leftTop3 ? "podium_exit"
      : ctx.bigClimb ? "big_climb" : ctx.bigDrop ? "big_drop"
      : ctx.enteredTop10 ? "top10_entry" : ctx.leftTop10 ? "top10_exit" : "rank_minor";
    const overtaken = findOvertaken(row, before, currentRows, prevState);
    const id = `${idPrefix}_${row.uid}_${before.rank}to${row.rank}`;
    const { text: title, index: variantIndex } = rankNarrative(ctx, id, overtaken, scopeLabel, recentVariants[subtype]);

    raw.push({
      id, type: TYPE.RANK, subtype,
      ts: Date.now(), importance, actors: [row.uid],
      metadata: { ...ctx, overtaken },
      narrativeKey: id, version: 2,
      icon: ctx.moved > 0 ? "up" : "down", important: importance >= IMPORTANCE.PODIUM_EXIT,
      title, subtitle: `Locul ${ctx.rankBefore} → Locul ${ctx.rankAfter}`,
      category: "clasament", priority: importance, variantIndex,
      detail: { rankBefore: ctx.rankBefore, rankAfter: ctx.rankAfter, pointsBefore: ctx.pointsBefore, pointsAfter: ctx.pointsAfter, overtaken },
    });
  });

  return raw.sort((a, b) => b.importance - a.importance);
}

export function aggregateRankStory(rawRankEvents) {
  if (rawRankEvents.length === 0) return [];
  // BIG_CLIMB/BIG_DROP (75-80) rămân "headline" — categorii numite
  // explicit. TOP10_ENTRY/EXIT (70-72) și mișcările mici (55) se
  // comprimă mereu. DAR: dacă apar 2+ headline-uri DIN ACELAȘI meci,
  // nu le mai arătăm separat ("X coboară" + "Y coboară" + "Z intră pe
  // podium" ca 3 carduri) — le combinăm într-O SINGURĂ poveste, exact
  // cum a cerut explicit: "Golul lui X a făcut prăpăd: A urcă, B intră
  // pe podium, C pierde șefia." Un singur headline rămâne solo (e deja
  // cea mai bună poveste posibilă, n-are cu ce să se combine).
  const headline = rawRankEvents.filter((e) => e.importance >= IMPORTANCE.BIG_DROP);
  const minor = rawRankEvents.filter((e) => e.importance < IMPORTANCE.BIG_DROP);

  const result = [];
  if (headline.length >= 2) {
    result.push(buildCombinedRankStory(headline));
  } else {
    result.push(...headline);
  }
  if (minor.length === 1) {
    result.push(minor[0]);
  } else if (minor.length > 1) {
    const names = minor.slice(0, 3).map((e) => e.metadata.nickname);
    const extra = minor.length > 3 ? ` și încă ${minor.length - 3}` : "";
    const seed = minor.map((e) => e.id).join("|");
    result.push({
      id: `rank_agg_${hashSeed(seed)}`, type: TYPE.RANK, subtype: "aggregate",
      ts: Date.now(), importance: IMPORTANCE.RANK_MINOR, actors: minor.map((e) => e.actors[0]),
      metadata: { count: minor.length, names }, narrativeKey: `rank_agg_${hashSeed(seed)}`, version: 2,
      icon: "up", important: false,
      title: pick([
        `Mișcare în clasament: ${names.join(", ")}${extra} își schimbă poziția`,
        `${names.join(", ")}${extra} — clasamentul se mai rearanjează puțin`,
      ], seed),
      subtitle: null, category: "clasament", priority: IMPORTANCE.RANK_MINOR, detail: { count: minor.length },
    });
  }
  return result;
}

// ── Frază scurtă per persoană, pentru povestea combinată — reflectă
// EXACT ce i s-a întâmplat (nu generic "și-a schimbat poziția"). ──
function shortClauseFor(e) {
  const n = e.metadata.nickname;
  switch (e.subtype) {
    case "new_leader": return `${n} preia șefia`;
    case "leader_lost": return `${n} pierde șefia`;
    case "leader_return": return `${n} revine lider`;
    case "podium_entry": return `${n} intră pe podium`;
    case "podium_exit": return `${n} cade de pe podium`;
    case "big_climb": return `${n} urcă ${Math.abs(e.metadata.moved)} locuri`;
    case "big_drop": return `${n} coboară ${Math.abs(e.metadata.moved)} locuri`;
    default: return `${n} își schimbă poziția`;
  }
}

function buildCombinedRankStory(headlineEvents) {
  const sorted = [...headlineEvents].sort((a, b) => b.importance - a.importance);
  const MAX_NAMED = 4;
  const named = sorted.slice(0, MAX_NAMED);
  const clauses = named.map(shortClauseFor);
  const extra = sorted.length > MAX_NAMED ? [`încă ${sorted.length - MAX_NAMED} jucători își schimbă poziția`] : [];
  const allClauses = [...clauses, ...extra];
  const seed = sorted.map((e) => e.id).join("|");
  const id = `rank_combined_${hashSeed(seed)}`;
  const last = allClauses[allClauses.length - 1];
  const rest = allClauses.slice(0, -1);
  const body = rest.length > 0 ? `${rest.join(", ")}, iar ${last}` : last;
  return {
    id, type: TYPE.RANK, subtype: "combined",
    ts: Date.now(), importance: Math.max(...sorted.map((e) => e.importance)) + 2, // ușor peste cel mai mare component, ca să câștige la sortare
    actors: sorted.map((e) => e.actors[0]),
    metadata: { count: sorted.length, components: sorted.map((e) => e.subtype) },
    narrativeKey: id, version: 2, icon: "up", important: true,
    title: pick([
      `🌪️ Rezultatul ăsta a făcut prăpăd în clasament: ${body}.`,
      `🌪️ Clasamentul s-a răsturnat: ${body}.`,
      `📊 Un singur rezultat, mai multe povești: ${body}.`,
    ], seed),
    subtitle: null, category: "clasament", priority: Math.max(...sorted.map((e) => e.importance)) + 2,
    detail: { count: sorted.length },
  };
}

// ══════════════════════════════════════════════════════════════════
// 2. MECI FINAL + SCOR EXACT
// ══════════════════════════════════════════════════════════════════
export function buildMatchFinalEvent(match, exactScorers = [], recentVariants = {}) {
  if (match.realScoreA == null || match.realScoreB == null) return null;
  const id = `match-final_${match.id}`;
  const diff = Math.abs(match.realScoreA - match.realScoreB);
  const resultLine = pick(
    diff === 0
      ? [`${match.homeTeam} ${match.realScoreA}–${match.realScoreB} ${match.awayTeam} — remiză`]
      : diff >= 3
        ? [`${match.homeTeam} ${match.realScoreA}–${match.realScoreB} ${match.awayTeam}`, `Demonstrație clară: ${match.homeTeam} ${match.realScoreA}–${match.realScoreB} ${match.awayTeam}`]
        : [`${match.homeTeam} ${match.realScoreA}–${match.realScoreB} ${match.awayTeam}`],
    id
  );
  const sc = `${match.realScoreA}–${match.realScoreB}`;
  let scorersVariantIndex = null;
  const scorersText = exactScorers.length === 0 ? null
    : exactScorers.length === 1 ? (() => {
        const { text, index } = pickAvoiding([
          `🎯 ${exactScorers[0]} a nimerit exact ${sc}.`,
          `🎯 ${exactScorers[0]} a văzut scorul dinainte: ${sc}.`,
          `🎯 Scor exact pentru ${exactScorers[0]}: ${sc}.`,
          `🎯 ${exactScorers[0]} a ghicit perfect: ${sc}.`,
          `🎯 Singurul care a nimerit ${sc}: ${exactScorers[0]}.`,
          `🎯 ${exactScorers[0]} a citit meciul ăsta perfect.`,
          `🎯 ${exactScorers[0]} punctează maxim — ${sc} exact.`,
          `🎯 Fix ${sc}, exact cum a zis ${exactScorers[0]}.`,
          `🎯 ${exactScorers[0]} avea deja scorul în cap: ${sc}.`,
          `🎯 O singură predicție exactă: ${exactScorers[0]}, cu ${sc}.`,
          `🎯 ${exactScorers[0]} nu a lăsat loc de îndoială — ${sc} exact.`,
          `🎯 Bilă albă pentru ${exactScorers[0]}: ${sc}.`,
          `🎯 ${exactScorers[0]} lovește exact la ${sc}.`,
          `🎯 Predicție perfectă: ${exactScorers[0]}, ${sc}.`,
          `🎯 ${exactScorers[0]} a punctat maxim cu ${sc}.`,
        ], id, recentVariants.exact_score_single);
        scorersVariantIndex = index;
        return text;
      })()
    : exactScorers.length <= 3 ? pick([
        `🎯 ${exactScorers.join(", ")} au nimerit exact ${sc}.`,
        `🎯 ${exactScorers.join(", ")} au văzut perfect scorul: ${sc}.`,
        `🎯 ${exactScorers.join(" și ")} nimeresc amândoi ${sc}.`,
        `🎯 ${exactScorers.join(", ")} — toți cu ${sc} exact.`,
        `🎯 ${sc} exact pentru ${exactScorers.join(", ")}.`,
      ], id)
    : pick([
        `🎯 ${exactScorers.length} jucători au nimerit exact ${sc}. N-a fost chiar surpriza serii.`,
        `🎯 ${exactScorers.slice(0, 2).join(", ")} și încă ${exactScorers.length - 2} au văzut perfect ${sc}.`,
        `🎯 ${sc} a fost destul de previzibil — ${exactScorers.length} scoruri exacte.`,
        `🎯 ${exactScorers.length} predicții perfecte pentru ${sc}.`,
        `🎯 Aproape jumătate au nimerit ${sc}. Restul, poate data viitoare.`,
        `🎯 ${sc} exact pentru ${exactScorers.length} jucători — scor destul de "citit".`,
        `🎯 Nu a fost greu de ghicit: ${exactScorers.length} scoruri exacte la ${sc}.`,
        `🎯 ${exactScorers.length} jucători pe val — toți cu ${sc}.`,
        `🎯 ${sc} — mai popular decât părea, cu ${exactScorers.length} nimeriri exacte.`,
        `🎯 O etapă bună pentru clarvăzători: ${exactScorers.length} scoruri exacte la ${sc}.`,
      ], id);

  return {
    id, type: TYPE.MATCH, subtype: exactScorers.length > 0 ? "final_with_exact" : "final",
    ts: Date.now(), importance: exactScorers.length > 0 ? IMPORTANCE.MATCH_FINAL_WITH_EXACT : IMPORTANCE.MATCH_FINAL,
    actors: exactScorers, metadata: { homeTeam: match.homeTeam, awayTeam: match.awayTeam, scoreA: match.realScoreA, scoreB: match.realScoreB, exactScorers },
    narrativeKey: id, version: 2,
    icon: "whistle", important: exactScorers.length > 0,
    title: resultLine, subtitle: scorersText, exactScoreVariantIndex: scorersVariantIndex,
    category: "meciuri", priority: exactScorers.length > 0 ? IMPORTANCE.MATCH_FINAL_WITH_EXACT : IMPORTANCE.MATCH_FINAL,
    detail: {
      competitionName: match.competitionName, status: match.status,
      kickoffAt: match.kickoffAt?.toMillis ? match.kickoffAt.toMillis() : null,
      matchId: match.id, exactScorers,
    },
  };
}

// ══════════════════════════════════════════════════════════════════
// FAPT DE ORAȘ — card propriu, nu doar îngropat în preview-ul de meci.
// Un singur fapt per meci, dedup pe etapă (nu se repetă), determinist
// (pick pe id-ul meciului, nu pe conținut — stabil la refresh). ──
// ══════════════════════════════════════════════════════════════════
// FILLER ZILNIC — pentru zilele fără meciuri/activitate reală (între
// etape), Feed-ul nu mai rămâne "înghețat" cu zile vechi. Un singur
// card general (proverb/glumă), determinist pe DATA calendaristică
// (nu pe conținut) — deci se schimbă natural în fiecare zi nouă, fără
// să repete niciodată aceeași zi de două ori, fără Math.random. ──
// ── CITAT — text/autor NESCHIMBATE (baza de date primită de la Lu).
// Anti-repetiție (citat ȘI autor) gestionată de apelant (feedService.js
// — recentQuotes, aceeași filozofie ca recentBanter). ──
export function buildQuoteEvent(dateKey, slotIndex, quote) {
  if (!quote) return null;
  const id = `quote_${dateKey}_${slotIndex}`;
  return {
    id, type: TYPE.BANTER, subtype: "quote", ts: Date.now(),
    importance: IMPORTANCE.FUN, actors: [], version: 2,
    icon: "fun", important: false,
    title: quote.text, subtitle: `— ${quote.author}`,
    category: "fun", priority: IMPORTANCE.FUN,
    detail: { source: "internal", origin: quote.origin },
  };
}

export function buildDailyFillerEvent(dateKey, funItems) {
  if (!funItems || funItems.length === 0) return null;
  const id = `filler_${dateKey}`;
  const item = funItems[hashSeed(id) % funItems.length];
  return {
    id, type: TYPE.BANTER, subtype: "daily_filler", ts: Date.now(),
    importance: IMPORTANCE.FUN, actors: [], version: 2,
    icon: "fun", important: false,
    title: item.text, subtitle: item.label || null,
    category: "fun", priority: IMPORTANCE.FUN,
    detail: { source: "internal" },
  };
}

// ── CLUB FACT — matchup (ambele echipe) sau individual (o echipă),
// din baza structurată în clubFactsContent.js. ──
export function buildClubFactEvent(match, fact, kind) {
  if (!fact) return null;
  const id = `clubfact_${match.id}_${fact.id}`;
  const label = kind === "matchup" ? "MATCHUP" : fact.club?.toUpperCase() || "COMPETIȚIE";
  return {
    id, type: TYPE.FACT, subtype: "club", ts: Date.now(),
    importance: kind === "matchup" ? 60 : 45, actors: [], version: 2,
    icon: "city", important: false,
    title: `${fact.title}`, subtitle: fact.text,
    category: "fun", priority: kind === "matchup" ? 60 : 45,
    detail: { matchId: match.id, factId: fact.id, kind, exclusiveGroup: fact.exclusiveGroup, source: "internal" },
  };
}

export function buildCityFactEvent(match, cityFact) {
  if (!cityFact) return null;
  return {
    id: `cityfact_${match.id}`, type: TYPE.FACT, subtype: "city",
    ts: Date.now(), importance: IMPORTANCE.CITY_FACT, actors: [],
    metadata: { matchId: match.id, homeTeam: match.homeTeam, awayTeam: match.awayTeam },
    narrativeKey: `cityfact_${match.id}`, version: 2,
    icon: "city", important: false,
    title: cityFact.subtitle || cityFact.title,
    subtitle: cityFact.body || null,
    category: "city", priority: IMPORTANCE.CITY_FACT,
    detail: { matchId: match.id, source: cityFact.source || null },
  };
}

// ══════════════════════════════════════════════════════════════════
// SURPRIZE — 5 tipuri GENERICE, extensibile la orice mod existent sau
// viitor (Duel, Mystery Box, Sabotaj, Trivia, Zaruri, Penalty PvP,
// Ruletă...) fără să reconstruim Feed-ul la fiecare mod nou adăugat.
// `mode` + `metadata` țin specificul fiecărui tip; textul e generic,
// construit din `label`/`detail`, nu hardcodat pe un singur mod.
// ══════════════════════════════════════════════════════════════════
export function buildSurpriseCreatedEvent(gameweekId, kind, mode, label) {
  const id = `surprise_created_${gameweekId}_${kind}`;
  return {
    id, type: TYPE.SURPRISE, subtype: "surprise_created",
    ts: Date.now(), importance: IMPORTANCE.SURPRISE_CREATED, actors: [],
    metadata: { gameweekId, kind, mode }, narrativeKey: id, version: 2,
    icon: "surprise", important: false,
    title: pick([
      `🎭 Surpriza ${kind === "main" ? "Principală" : "Săptămânii"} e gata: ${label}.`,
      `🎭 ${label} — asta e provocarea ${kind === "main" ? "principală a" : "bonus a"} etapei.`,
      `✨ S-a dezvăluit: ${label}.`,
    ], id),
    category: "fun", priority: IMPORTANCE.SURPRISE_CREATED,
    detail: { gameweekId, kind, mode },
  };
}

export function buildSurpriseMatchupEvent(gameweekId, kind, mode, description) {
  const id = `surprise_matchup_${gameweekId}_${kind}`;
  return {
    id, type: TYPE.SURPRISE, subtype: "surprise_matchup",
    ts: Date.now(), importance: IMPORTANCE.SURPRISE_MATCHUP, actors: [],
    metadata: { gameweekId, kind, mode }, narrativeKey: id, version: 2,
    icon: "vs", important: true,
    title: description,
    category: "fun", priority: IMPORTANCE.SURPRISE_MATCHUP,
    detail: { gameweekId, kind, mode },
  };
}

export function buildSurpriseProgressEvent(gameweekId, kind, mode, uniqueSuffix, description) {
  const id = `surprise_progress_${gameweekId}_${kind}_${uniqueSuffix}`;
  return {
    id, type: TYPE.SURPRISE, subtype: "surprise_progress",
    ts: Date.now(), importance: IMPORTANCE.SURPRISE_PROGRESS, actors: [],
    metadata: { gameweekId, kind, mode }, narrativeKey: id, version: 2,
    icon: "surprise", important: false,
    title: description,
    category: "fun", priority: IMPORTANCE.SURPRISE_PROGRESS,
    detail: { gameweekId, kind, mode },
  };
}

export function buildSurpriseResultEvent(gameweekId, kind, mode, description) {
  const id = `surprise_result_${gameweekId}_${kind}`;
  return {
    id, type: TYPE.SURPRISE, subtype: "surprise_result",
    ts: Date.now(), importance: IMPORTANCE.SURPRISE_RESULT, actors: [],
    metadata: { gameweekId, kind, mode }, narrativeKey: id, version: 2,
    icon: "trophy", important: true,
    title: description,
    category: "fun", priority: IMPORTANCE.SURPRISE_RESULT,
    detail: { gameweekId, kind, mode },
  };
}

export function buildSurpriseRewardEvent(gameweekId, kind, mode, uid, description) {
  const id = `surprise_reward_${gameweekId}_${kind}_${uid}`;
  return {
    id, type: TYPE.SURPRISE, subtype: "surprise_reward",
    ts: Date.now(), importance: IMPORTANCE.SURPRISE_REWARD, actors: [uid],
    metadata: { gameweekId, kind, mode }, narrativeKey: id, version: 2,
    icon: "gift", important: false,
    title: description,
    category: "fun", priority: IMPORTANCE.SURPRISE_REWARD,
    detail: { gameweekId, kind, mode },
  };
}

// ══════════════════════════════════════════════════════════════════
// LIVE MATCH EVENTS — din date externe (API-Football), NORMALIZATE
// deja (vezi api/_lib/footballLogic.js). Gardă de privacy INTERNĂ
// (defense in depth, ca la feedFactsEngine.js) — dacă meciul nu-i
// blocat încă, funcția refuză singură corelarea cu predicții,
// INDIFERENT ce-i dă apelantul.
//
// `internal` (opțional) = { exactCount, jokerCount } — calculat de
// feedService.js din predicțiile PROPRII ale aplicației, NUMAI dacă
// meciul e deja blocat (apelantul verifică O DATĂ, funcția verifică
// A DOUA OARĂ — dacă nu se potrivesc, câștigă varianta STRICTĂ, fără
// corelare). ──
// external = din API-Football (extern), spre deosebire de
// buildLiveMatchEvent (mai jos) care e pentru evenimente introduse
// manual de Admin — două surse diferite, nume diferite, ca să nu se
// suprascrie una pe alta.
export function buildExternalLiveEvent(kind, match, snapshot, extra, internal) {
  const canCorrelate = canRevealPredictions(match) && internal;
  const base = { home: match.homeTeam, away: match.awayTeam };
  const id = `live_${snapshot.fixtureId}_${kind}_${extra?.eventId || snapshot.minute || kind}`;

  function withCorrelation(bareTitle, richTitleFn) {
    if (!canCorrelate) return bareTitle;
    return richTitleFn(internal) || bareTitle;
  }

  let title, importance, icon;
  switch (kind) {
    case "MATCH_STARTED":
      importance = IMPORTANCE.LIVE_STARTED; icon = "live";
      title = pick([`🔴 A început ${base.home} – ${base.away}.`], id);
      break;

    case "GOAL": {
      importance = IMPORTANCE.LIVE_GOAL; icon = "goal";
      const { before, after, team, player, semantic } = extra;
      const scoreStr = `${after.home}–${after.away}`;
      const scoreLabel = { opens: "deschide scorul", equalizer: "egalează", lead_change: "întoarce scorul", extends_lead: "mărește avantajul", scores: "marchează" }[semantic];
      const bare = pick([
        `⚽ ${team} ${scoreLabel}${player ? ` prin ${player}` : ""}! ${scoreStr}, minutul ${extra.minute}.`,
      ], id);
      title = withCorrelation(bare, (i) =>
        i.exactCount > 0
          ? pick([`⚽ ${team} ${scoreLabel}! ${scoreStr} în minutul ${extra.minute}. ${i.exactCount} băieți sunt momentan pe scor exact.`], id)
          : bare
      );
      break;
    }

    case "HALFTIME":
      importance = IMPORTANCE.LIVE_HALFTIME; icon = "whistle";
      title = pick([`⏱ Pauză: ${base.home} ${snapshot.homeScore}–${snapshot.awayScore} ${base.away}.`], id);
      break;

    case "RED_CARD": {
      importance = IMPORTANCE.LIVE_RED_CARD; icon = "card";
      title = pick([`🟥 Roșu pentru ${extra.team}${extra.player ? ` (${extra.player})` : ""}, minutul ${extra.minute}.`], id);
      break;
    }

    case "MISSED_PENALTY": {
      importance = IMPORTANCE.LIVE_GOAL; icon = "goal";
      title = pick([`🧤 Penalty ratat! ${extra.team}${extra.player ? ` (${extra.player})` : ""} nu marchează, minutul ${extra.minute}.`], id);
      break;
    }

    case "FULLTIME":
      importance = IMPORTANCE.LIVE_FULLTIME; icon = "whistle";
      title = pick([`🏁 Final la ${base.home}: ${base.home} ${snapshot.homeScore}–${snapshot.awayScore} ${base.away}.`], id);
      break;

    default:
      return null;
  }

  return {
    id, type: TYPE.MATCH, subtype: `live_${kind.toLowerCase()}`, ts: Date.now(),
    importance, actors: [], version: 2, icon, important: kind === "GOAL" || kind === "FULLTIME",
    title, subtitle: null, category: "meciuri", priority: importance,
    detail: { matchId: match.id, fixtureId: snapshot.fixtureId, provider: "api-football" },
  };
}

// ══════════════════════════════════════════════════════════════════
// MATCH INTELLIGENCE — carduri din date reale API-Football (lineup,
// H2H, formă, accidentări, predicții API), transformate editorial.
// NU inventează nimic — dacă datele nu susțin o afirmație clară,
// funcția întoarce null, Story Engine nu publică nimic pentru acel tip.
// ══════════════════════════════════════════════════════════════════

export function buildLineupEvent(match, lineup) {
  if (!lineup?.home?.startingXI?.length) return null;
  const id = `lineup_${match.id}`;
  const keyPlayers = lineup.home.startingXI.slice(0, 3).map((p) => p.name).join(", ");
  return {
    id, type: TYPE.MATCH, subtype: "lineup", ts: Date.now(), importance: IMPORTANCE.LINEUP,
    actors: [], version: 2, icon: "lineup", important: false,
    title: pick([`📋 Echipele sunt afară la ${match.homeTeam} – ${match.awayTeam}.`], id),
    subtitle: pick([`${match.homeTeam} merge pe ${lineup.home.formation || "?"}. ${keyPlayers}${lineup.home.startingXI.length > 3 ? " și restul." : "."}`], id),
    category: "meciuri", priority: IMPORTANCE.LINEUP,
    detail: { matchId: match.id, lineup },
  };
}

// H2H — publică DOAR dacă datele susțin o afirmație clară (o echipă
// domină net, sau meciurile produc constant multe goluri). Altfel null
// — nu forțăm un fapt plictisitor din date echilibrate.
export function buildH2HFact(match, h2h) {
  if (!h2h || h2h.totalMatches < 3) return null;
  const id = `h2h_${match.id}`;
  const homeDominant = h2h.homeWins >= h2h.totalMatches * 0.6;
  const awayDominant = h2h.awayWins >= h2h.totalMatches * 0.6;
  let title = null;
  if (homeDominant) {
    title = pick([`📊 Istoria e cu ${match.homeTeam}: ${h2h.homeWins} victorii din ultimele ${h2h.totalMatches} dueluri cu ${match.awayTeam}.`], id);
  } else if (awayDominant) {
    title = pick([`📊 ${match.awayTeam} are avantaj istoric: ${h2h.awayWins} victorii din ultimele ${h2h.totalMatches} cu ${match.homeTeam}.`], id);
  } else if (h2h.avgGoals >= 3) {
    title = pick([`👀 Meciuri cu goluri: ultimele ${h2h.totalMatches} dueluri au produs în medie ${h2h.avgGoals} goluri.`], id);
  }
  if (!title) return null;
  return {
    id, type: TYPE.FACT, subtype: "h2h", ts: Date.now(), importance: IMPORTANCE.H2H_FACT,
    actors: [], version: 2, icon: "stats", important: false, title, subtitle: null,
    category: "fun", priority: IMPORTANCE.H2H_FACT, detail: { matchId: match.id, h2h },
  };
}

// Formă — publică doar dacă diferența e reală, nu "amândouă la fel".
export function buildFormFact(match, homeForm, awayForm) {
  if (!homeForm?.form || !awayForm?.form) return null;
  const score = (f) => f.split("").reduce((s, c) => s + (c === "W" ? 1 : c === "D" ? 0 : -1), 0);
  const homeScore = score(homeForm.form), awayScore = score(awayForm.form);
  if (Math.abs(homeScore - awayScore) < 3) return null; // prea apropiat, nu-i o poveste
  const id = `form_${match.id}`;
  const better = homeScore > awayScore ? match.homeTeam : match.awayTeam;
  const betterForm = homeScore > awayScore ? homeForm.form : awayForm.form;
  return {
    id, type: TYPE.FACT, subtype: "form", ts: Date.now(), importance: IMPORTANCE.FORM_FACT,
    actors: [], version: 2, icon: "fire", important: false,
    title: pick([`🔥 ${better} vine în formă bună: ${betterForm}.`], id), subtitle: null,
    category: "fun", priority: IMPORTANCE.FORM_FACT, detail: { matchId: match.id, homeForm, awayForm },
  };
}

// Accidentări — compact, FĂRĂ să inventăm "vedetă" (nu avem o metodă
// sigură de a determina importanța unui jucător).
export function buildInjuryEvent(match, injuries) {
  if (!injuries || injuries.length === 0) return null;
  const id = `injuries_${match.id}`;
  const names = injuries.slice(0, 4).map((i) => i.player).join(", ");
  return {
    id, type: TYPE.FACT, subtype: "injury", ts: Date.now(), importance: IMPORTANCE.INJURY,
    actors: [], version: 2, icon: "injury", important: false,
    title: pick([`🚑 Absențe la ${match.homeTeam} – ${match.awayTeam}: ${names}${injuries.length > 4 ? ` și încă ${injuries.length - 4}` : ""}.`], id),
    subtitle: null, category: "fun", priority: IMPORTANCE.INJURY, detail: { matchId: match.id, injuries },
  };
}

// Predicții API — comparate cu consensul NOSTRU DOAR după reveal
// (privacy guard intern, defense in depth). Înainte de reveal, arată
// doar procentele API-ului, fără nicio referire la ce cred băieții.
export function buildApiPredictionEvent(match, apiPrediction, ourConsensus) {
  if (!apiPrediction) return null;
  const id = `apipred_${match.id}`;
  const favorite = apiPrediction.homePct > apiPrediction.awayPct ? match.homeTeam : match.awayTeam;
  const favoritePct = Math.max(apiPrediction.homePct, apiPrediction.awayPct);

  const canCompare = canRevealPredictions(match) && ourConsensus;
  if (canCompare) {
    const ourFavorite = ourConsensus.homeCount > ourConsensus.awayCount ? match.homeTeam : match.awayTeam;
    const agree = favorite === ourFavorite;
    return {
      id, type: TYPE.FACT, subtype: "api_prediction", ts: Date.now(), importance: IMPORTANCE.API_PREDICTION,
      actors: [], version: 2, icon: "chart", important: false,
      title: agree
        ? pick([`🧠 Băieții sunt de acord cu datele: ambii văd ${favorite} favorit.`], id)
        : pick([`😈 Liga merge contra curentului: datele văd ${favorite} favorit (${favoritePct}%), băieții merg pe ${ourFavorite}.`], id),
      subtitle: null, category: "fun", priority: IMPORTANCE.API_PREDICTION, detail: { matchId: match.id },
    };
  }
  return {
    id, type: TYPE.FACT, subtype: "api_prediction", ts: Date.now(), importance: IMPORTANCE.API_PREDICTION,
    actors: [], version: 2, icon: "chart", important: false,
    title: pick([`🤖 Datele îl văd favorit pe ${favorite} (${favoritePct}%).`], id),
    subtitle: null, category: "fun", priority: IMPORTANCE.API_PREDICTION, detail: { matchId: match.id },
  };
}

// Un singur generator de eveniment pentru AMBELE tipuri de Joker — nu
// unul separat pentru Joker Extra (cerut explicit: nu un nou tip de
// card, doar text distinct în cardul deja existent). `isExtra` schimbă
// DOAR textul și id-ul (ca să nu se suprascrie unul pe altul în Feed,
// dacă același user are ambele active în aceeași etapă) — restul
// structurii (subtype, icon, categorie) rămâne identic.
export function buildJokerEvent(joker, match, nickname, isExtra = false) {
  if (!match) return null;
  const label = isExtra ? "Jokerul Extra" : "Jokerul";
  return {
    id: `joker_${joker.gameweekId}_${joker.userId}${isExtra ? "_extra" : ""}`, type: TYPE.SURPRISE, subtype: "joker",
    ts: Date.now(), importance: IMPORTANCE.JOKER, actors: [joker.userId],
    metadata: { matchId: match.id, homeTeam: match.homeTeam, awayTeam: match.awayTeam },
    narrativeKey: `joker_${joker.gameweekId}_${joker.userId}${isExtra ? "_extra" : ""}`, version: 2,
    icon: "joker", important: false,
    title: `${nickname} a activat ${label} pe ${match.homeTeam} – ${match.awayTeam}`,
    category: "jokeri", priority: IMPORTANCE.JOKER,
    detail: { competitionName: match.competitionName, multiplier: "×2", matchStatus: match.status, matchId: match.id, gameweekId: joker.gameweekId, isExtra },
  };
}

export function buildUpcomingMatchEvent(match, editorialSnippets, isImportant) {
  // ── Faptele de oraș/echipă existau deja, calculate corect, dar
  // rămâneau îngropate în `detail.editorialSnippets` — pe care
  // FeedCard nu-l citea niciodată. Bug găsit și reparat: acum un
  // fapt (determinist, ales din cele calculate) apare direct în
  // subtitlul cardului, vizibil. Restul rămân disponibile în detail
  // pentru "Vezi tot"/ecranul complet, dacă vrem să le arătăm pe
  // toate acolo mai târziu. ──
  const snippet = editorialSnippets && editorialSnippets.length > 0
    ? pick(editorialSnippets.map((s) => s.subtitle || s.body), `upcoming_${match.id}`)
    : null;
  return {
    id: `upcoming_${match.id}`, type: TYPE.MATCH, subtype: isImportant ? "upcoming_important" : "upcoming",
    ts: Date.now(), importance: isImportant ? IMPORTANCE.UPCOMING_IMPORTANT : IMPORTANCE.PREVIEW,
    actors: [], metadata: { matchId: match.id, homeTeam: match.homeTeam, awayTeam: match.awayTeam },
    narrativeKey: `upcoming_${match.id}`, version: 2,
    icon: isImportant ? "star" : "whistle", important: isImportant,
    title: isImportant ? `${match.homeTeam} – ${match.awayTeam}: Meciul Săptămânii (Punctaj Dublu)` : `${match.homeTeam} – ${match.awayTeam}`,
    subtitle: snippet || match.competitionName || null,
    category: "meciuri", priority: isImportant ? IMPORTANCE.UPCOMING_IMPORTANT : IMPORTANCE.PREVIEW,
    detail: {
      competitionName: match.competitionName, matchId: match.id,
      kickoffAt: match.kickoffAt?.toMillis ? match.kickoffAt.toMillis() : null,
      editorialSnippets: editorialSnippets || [],
    },
  };
}

// ══════════════════════════════════════════════════════════════════
// 3. GOLURI LIVE
// ══════════════════════════════════════════════════════════════════
export function buildLiveMatchEvent(match, event) {
  const teamName = event.team === "home" ? match.homeTeam : match.awayTeam;
  const allGoals = (match.matchEvents || []).filter((e) => e.type === "goal");
  const goalsUpToNow = allGoals.filter((g) => g.minute < event.minute || (g.minute === event.minute && g.id <= event.id));
  const scoreA = goalsUpToNow.filter((g) => g.team === "home").length;
  const scoreB = goalsUpToNow.filter((g) => g.team === "away").length;
  const scoreLine = ` · ${match.homeTeam} ${scoreA}-${scoreB} ${match.awayTeam}`;
  const id = `liveevent_${event.id}`;

  if (event.type === "goal") {
    const beforeA = scoreA - (event.team === "home" ? 1 : 0);
    const beforeB = scoreB - (event.team === "away" ? 1 : 0);
    const wasTied = beforeA === beforeB;
    const teamWasBehind = event.team === "home" ? beforeA < beforeB : beforeB < beforeA;
    const nowTied = scoreA === scoreB;
    const late = event.minute >= 85;
    const wasComeback = teamWasBehind && (event.team === "home" ? beforeB - beforeA >= 2 : beforeA - beforeB >= 2);

    let phrase, importance;
    if (beforeA === 0 && beforeB === 0) {
      phrase = pick([`deschide scorul`, `punctează primul`, `trece echipa în avantaj de la 0-0`], id);
      importance = IMPORTANCE.GOAL_MAJOR;
    } else if (wasTied) {
      phrase = pick([`aduce ${teamName} în avantaj`, `trece ${teamName} în frunte`, `duce ${teamName} în avantaj`], id);
      importance = IMPORTANCE.GOAL_MAJOR;
    } else if (teamWasBehind && nowTied) {
      phrase = late
        ? pick([`egalează dramatic, aproape de final`, `restabilește egalitatea în prelungiri`], id)
        : wasComeback
          ? pick([`întoarce meciul cu o egalare de senzație`, `revine de la o diferență de 2 și egalează`], id)
          : pick([`egalează pentru ${teamName}`, `readuce ${teamName} la egalitate`], id);
      importance = IMPORTANCE.MATCH_DECISIVE_GOAL;
    } else if (teamWasBehind) {
      phrase = pick([`reduce din diferență pentru ${teamName}`, `apropie ${teamName} pe tabelă`], id);
      importance = late ? IMPORTANCE.GOAL_MAJOR : IMPORTANCE.GOAL_ROUTINE;
    } else {
      phrase = late
        ? pick([`sigilează victoria pentru ${teamName}`, `închide meciul în prelungiri`], id)
        : pick([`mărește avantajul lui ${teamName}`, `dublează diferența pentru ${teamName}`, `își continuă recitalul ${teamName}`], id);
      importance = late ? IMPORTANCE.GOAL_MAJOR : IMPORTANCE.GOAL_ROUTINE;
    }

    return {
      id, type: TYPE.MATCH, subtype: "goal", ts: Date.now(), importance,
      actors: [], metadata: { matchId: match.id, minute: event.minute, team: event.team, player: event.player || null, scoreA, scoreB },
      narrativeKey: id, version: 2,
      icon: "goal", important: importance >= IMPORTANCE.GOAL_MAJOR,
      title: event.player ? `⚽ ${event.player} ${phrase}` : `⚽ ${teamName} ${phrase}`,
      subtitle: `Minutul ${event.minute}${scoreLine}`,
      category: "meciuri", priority: importance,
      detail: { competitionName: match.competitionName, matchId: match.id, minute: event.minute, team: event.team, player: event.player || null },
    };
  }
  if (event.type === "red_card") {
    return {
      id, type: TYPE.MATCH, subtype: "red_card", ts: Date.now(), importance: IMPORTANCE.GOAL_MAJOR,
      actors: [], metadata: { matchId: match.id, minute: event.minute, team: event.team, player: event.player || null },
      narrativeKey: id, version: 2,
      icon: "redcard", important: true,
      title: event.player ? `🟥 Cartonaș roșu — ${event.player} (${teamName})` : `🟥 Cartonaș roșu — ${teamName}`,
      subtitle: `Minutul ${event.minute}${scoreLine}`,
      category: "meciuri", priority: IMPORTANCE.GOAL_MAJOR,
      detail: { competitionName: match.competitionName, matchId: match.id, minute: event.minute, team: event.team, player: event.player || null },
    };
  }
  return null;
}

// ══════════════════════════════════════════════════════════════════
// 4. BANTER
// ══════════════════════════════════════════════════════════════════
const BANTER_POOLS = {
  new_leader: [
    (n) => `${n} e lider. Conferința de presă probabil a început deja.`,
    (n) => `${n} își cumpără deja cupa, doar că e prea devreme.`,
    (n) => `Fruntea clasamentului are un chiriaș nou: ${n}.`,
    (n) => `${n} se uită de sus la restul. Deocamdată.`,
    (n) => `Se aude un „am zis eu" dinspre ${n}.`,
    (n) => `${n} e lider. Restul, oficial, sunt „ceilalți".`,
    (n) => `Coroana are proprietar nou: ${n}.`,
    (n) => `${n} conduce. Restul se prefac că nu e mare lucru.`,
  ],
  leader_lost: [
    (n) => `Domnia lui ${n} a durat cât o pauză de reclame.`,
    (n) => `${n} coboară de pe tron. Fără ceremonie.`,
    (n) => `Fostul lider, ${n}, acum doar unul dintre mulți.`,
    (n) => `${n} a fost lider. Timpul trecut e important aici.`,
    (n) => `Coroana i-a alunecat lui ${n} chiar din cap.`,
    (n) => `${n} pierde primul loc mai repede decât l-a câștigat.`,
  ],
  big_climb: [
    (n) => `${n} tocmai a trecut prin clasament ca prin ușă rotativă.`,
    (n) => `Se aud deja declarațiile de campion din tabăra lui ${n}.`,
    (n) => `${n} a găsit liftul și a apăsat direct sus.`,
    (n) => `Cine a oprit-o pe ${n}? Nimeni, deocamdată.`,
    (n) => `${n} urcă atât de repede încât restul au amețeală.`,
    (n) => `Etapa are un erou neașteptat: ${n}.`,
    (n) => `${n} a decis brusc că vrea și el/ea în față.`,
    (n) => `Clasamentul s-a rearanjat exclusiv în favoarea lui ${n}.`,
  ],
  big_drop: [
    (n) => `Telefonul funcționează, pronosticurile lui ${n} mai puțin.`,
    (n) => `Clasamentul a apăsat pe lift pentru ${n} și a uitat să oprească.`,
    (n) => `${n} a coborât atât de repede că i s-au înfundat urechile.`,
    (n) => `Etapa asta nu va intra în CV-ul lui ${n}.`,
    (n) => `${n} a găsit scara în jos și n-a mai vrut să iasă.`,
    (n) => `Ceva n-a mers azi pentru ${n}. Multe, de fapt.`,
    (n) => `${n} cade atât de rapid încât restul cer reluare.`,
  ],
  podium_entry: [
    (n) => `${n} urcă pe podium. Se aud deja declarațiile de campion.`,
    (n) => `${n} intră în top 3 și deja repetă discursul de mulțumire.`,
    (n) => `Loc pe podium pentru ${n} — restul se înghesuie.`,
  ],
  podium_exit: [
    (n) => `Podiumul îl uită pe ${n} chiar acum.`,
    (n) => `${n} coboară de pe podium fără prea multe explicații.`,
    (n) => `Locul pe podium al lui ${n} a fost, aparent, temporar.`,
  ],
  final_with_exact: [
    () => `Câteva scoruri exacte într-o etapă. Verificați-le istoricul browserului.`,
    () => `Prea multe scoruri exacte pentru o coincidență.`,
    () => `Etapa asta a avut clarvăzători, nu pronosticatori.`,
  ],
  exact_streak: [
    (n) => `${n} nimerește iar. Bănuim un abonament la cablu sportiv.`,
    (n) => `A doua oară la rând pentru ${n}. Coincidență? Poate.`,
    (n) => `${n} a intrat în cap cu antrenorii.`,
  ],
  zero_streak: [
    (n) => `${n} colecționează zerouri ca pe timbre.`,
    (n) => `Pronosticurile lui ${n} au nevoie de o pauză.`,
    (n) => `${n} nu mai nimerește nimic de câteva meciuri. Se întâmplă.`,
  ],
  bottom_takeover: [
    (n) => `Locul ${n} e ocupat acum de ${n}. Cică temporar.`,
    (n) => `${n} preia ultimul loc. Onoarea e discutabilă.`,
  ],
  escape_last: [
    (n) => `${n} scapă de ultimul loc. Sărbătoare mică, dar meritată.`,
  ],
  lone_wolf_success: [
    (n) => `${n} a mers singur împotriva tuturor. Și a avut dreptate.`,
    (n) => `Toată lumea râdea de ${n}. Nu mai râde nimeni.`,
  ],
  lone_wolf_fail: [
    (n) => `${n} a mers singur împotriva tuturor. De data asta, degeaba.`,
  ],
  upset: [
    () => `Liga Băieților a votat aproape unanim. Fotbalul n-a fost de acord.`,
    () => `Consens total, rezultat total diferit.`,
  ],
  comeback: [
    (n) => `${n} a decis brusc că nu vrea să piardă etapa asta.`,
    (n) => `Revenirea lui ${n} merită aplauze, chiar dacă e doar în privat.`,
  ],
  collapse: [
    (n) => `${n} avea totul sub control. Avea.`,
    (n) => `${n} a văzut vârful și a decis să coboare din nou.`,
  ],
  rivalry_swap: [
    () => `Cei doi tot schimbă locul între ei. Un fel de derby personal.`,
  ],
  bottom_battle: [
    () => `Și la coadă e tensiune — nimeni nu vrea ultimul loc.`,
  ],
};

export function attachBanter(event, recentKeys = new Set()) {
  const pool = BANTER_POOLS[event.subtype];
  if (!pool) return event;
  const id = event.id + "_banter";
  const idx = hashSeed(id) % pool.length;
  const key = `${event.subtype}_${idx}`;
  if (recentKeys.has(key)) return event;
  const name = event.metadata?.nickname || event.metadata?.count || "";
  return { ...event, banter: pool[idx](name), banterKey: key };
}

// ══════════════════════════════════════════════════════════════════
// 5. DEDUPLICATION / ANTI-SPAM
// ══════════════════════════════════════════════════════════════════
export function mergeFeedEvents(...groups) {
  const all = groups.flat().filter(Boolean);
  const seen = new Set();
  const deduped = all.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
  const sorted = deduped.sort((a, b) => (b.priority - a.priority) || (b.ts - a.ts));

  const routineGoalCountByMatch = {};
  const filtered = [];
  for (const ev of sorted) {
    const isRoutineGoal = ev.type === TYPE.MATCH && ev.subtype === "goal" && !ev.important;
    if (isRoutineGoal) {
      const mid = ev.detail?.matchId || "unknown";
      routineGoalCountByMatch[mid] = (routineGoalCountByMatch[mid] || 0) + 1;
      if (routineGoalCountByMatch[mid] > 2) continue;
    }
    filtered.push(ev);
  }
  return editorialMix(filtered);
}

// ── Mixer editorial — DETERMINIST (nu Math.random), reordonează doar
// cât să evite 3+ carduri consecutive din ACEEAȘI categorie, când
// există o alternativă mai jos în listă care poate "sări" mai devreme
// fără să strice ierarhia de importanță prea mult (doar în interiorul
// unei ferestre mici — nu amestecă tot, nu scoate un card important
// de sus doar ca să alterneze culori). Nu schimbă CE se publică, doar
// ORDINEA — cerut explicit: "MATCH FACT SURPRISE PREDICTION RANKING",
// nu "RANKING RANKING RANKING RANKING". ──
function editorialMix(sortedEvents) {
  const result = [];
  const pool = [...sortedEvents];
  const WINDOW = 15; // suficient de larg cât să găsească alternativă chiar și după un bloc mare de aceeași categorie (ex. 6-8 fapte de oraș, câte unul per meci)
  while (pool.length > 0) {
    const lastCat = result.length > 0 ? result[result.length - 1].category : null;
    const prevCat = result.length > 1 ? result[result.length - 2].category : null;
    // 2 la rând din aceeași categorie — caută o alternativă în fereastră
    if (lastCat && lastCat === prevCat) {
      const altIndex = pool.findIndex((e, i) => i < WINDOW && e.category !== lastCat);
      if (altIndex > 0) {
        result.push(pool.splice(altIndex, 1)[0]);
        continue;
      }
    }
    result.push(pool.shift());
  }
  return result;
}

// Compat cu apelurile vechi din feedService.js care importă FEED_CATEGORIES/PRIORITY —
// păstrate ca alias-uri, ca să nu fie nevoie să rescriu TOATE punctele de-apel deodată.
export const FEED_CATEGORIES = { CLASAMENT: "clasament", MECIURI: "meciuri", JOKERI: "jokeri", FUN: "fun" };
export const PRIORITY = IMPORTANCE;

export { hashSeed, pick, pickAvoiding, pickIndexAvoiding };
