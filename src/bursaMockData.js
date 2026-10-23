// ══════════════════════════════════════════════════════════════════
// 📈📉 BURSA PRIETENILOR — DATE SIMULATE, STRICT pentru Admin Preview.
// Zero Firestore. Avatarele sunt cele REALE din public/avatars
// (avatarId „pachet/index”, exact formatul din users/{uid}), afișate
// ulterior prin PlayerAvatar — nu se creează avatare noi.
//
// Toate punctajele afișate în Preview se CALCULEAZĂ cu bursaService.js
// (aceleași funcții ca jocul real) — nimic nu e scris „de mână” aici,
// în afară de pointsFromMatches simulate după fiecare validare.
// ══════════════════════════════════════════════════════════════════
import { computeBursaResults, buildDuelSeries, normalizePortfolio } from "./services/bursaService";

// active: oglindește getPlayerStatus(...) === "active" din aplicație.
function P(uid, nickname, avatarId, active = true) { return { uid, nickname, avatarId, active }; }

export const BURSA_MOCK_PLAYERS = {
  adireal: P("adireal", "AdiReal", "adireal/1"),
  alex: P("alex", "Alex", "alex-nicoara/7"),
  andreis: P("andreis", "AndreiS", "andreis/1"),
  bogdanb: P("bogdanb", "BogdanB", "bogdanb/1"),
  bona: P("bona", "Bona", "bona/1"),
  cristian: P("cristian", "Cristian", "cristian/1"),
  doctoru: P("doctoru", "Doctoru", "doctoru/1"),
  ghioca: P("ghioca", "Ghioca", "ghioca/1"),
  luck87: P("luck87", "Luck87", "luck87/1"),
  micea: P("micea", "Micea", "ooo-micea/9"),
  pannnnn: P("pannnnn", "Pannnnn", "pannnnn/1"),
  rzvn: P("rzvn", "Rzvn", "rzvn/1"),
  sammy20: P("sammy20", "Sammy20", "sammy20/1"),
  sexu: P("sexu", "Sexu", "sexu-ciobanu/1"),
  ursuleo: P("ursuleo", "UrsuLeo", "ursuleo/1"),
  utzy: P("utzy", "Utzy", "utzy/1"),
  vikigbt: P("vikigbt", "VikiGbt", "vikigbt/1"),
  vladinhuu: P("vladinhuu", "Vladinhuu", "vladinhuu/1"),
  // DEZACTIVAT de Admin — nu trebuie să apară NICĂIERI în Bursă (test).
  dragalin: P("dragalin", "Dragalin", null, false),
};

export const BURSA_MOCK_ME = "luck87";
export const BURSA_MOCK_OPP = "bogdanb";

// Eligibili = DOAR activii (același criteriu ca listActiveUserIds).
const ALL_18 = Object.keys(BURSA_MOCK_PLAYERS).filter((u) => BURSA_MOCK_PLAYERS[u].active);
export const BURSA_MOCK_ELIGIBLE = ALL_18;
const ALL_17 = ALL_18.filter((u) => u !== "vladinhuu"); // pentru bye (număr impar)

// ── Duelurile, format identic cu revealMain: { pairings, byePlayer }. ──
const PAIRINGS_18 = [
  { playerA: "luck87", playerB: "bogdanb" },
  { playerA: "adireal", playerB: "alex" },
  { playerA: "andreis", playerB: "bona" },
  { playerA: "cristian", playerB: "doctoru" },
  { playerA: "ghioca", playerB: "micea" },
  { playerA: "pannnnn", playerB: "rzvn" },
  { playerA: "sammy20", playerB: "sexu" },
  { playerA: "ursuleo", playerB: "utzy" },
  { playerA: "vikigbt", playerB: "vladinhuu" },
];
// 17 jucători: Luck87 rămâne fără adversar (bye), BogdanB e mutat.
const PAIRINGS_17 = [
  { playerA: "bogdanb", playerB: "vikigbt" },
  ...PAIRINGS_18.slice(1, 8),
];

// ── Portofoliile. MY/OPP sunt alese ca duelul să fie interesant. ──
const MY_PORTFOLIO = { perf: ["adireal", "andreis"], contra: ["sammy20", "utzy"] };
const OPP_PORTFOLIO = { perf: ["ghioca", "cristian"], contra: ["rzvn", "doctoru"] };

// Ceilalți — portofolii deterministe (rotație), valide (fără sine,
// fără dubluri), ca ecranul „toate selecțiile” să fie plin.
function rotatedPortfolio(uid, pool) {
  const others = pool.filter((u) => u !== uid);
  const i = pool.indexOf(uid);
  const pick = (k) => others[(i * 3 + k * 4) % others.length];
  const chosen = [];
  for (let k = 0; chosen.length < 4 && k < others.length * 2; k++) {
    const c = pick(k);
    if (!chosen.includes(c)) chosen.push(c);
  }
  return { perf: chosen.slice(0, 2), contra: chosen.slice(2, 4) };
}

function picksFor(pool, overrides = {}, skip = []) {
  const out = {};
  pool.forEach((uid) => {
    if (skip.includes(uid)) return;
    out[uid] = overrides[uid] || rotatedPortfolio(uid, pool);
  });
  return out;
}

// ── ISTORIC DE VALIDĂRI — pointsFromMatches după fiecare rezultat
// validat de Admin (cumulat). Pasul 0 = nicio validare (toți 0).
// Ordinea coloanelor = ALL_18. ──
const COLS = ALL_18;
const TABLE = [
  //  adi alex andr bogd bona cris doct ghio luck mice pann rzvn samm sexu urs utzy viki vlad
  ["Start · 0 meciuri validate",
    [  0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0]],
  ["Validare #1",
    [ 30,  10,  60,  10,  20,  10,   0,  10,  20,  30,  10,  20,   0,  10,  20,   0,  10,  20]],
  ["Validare #2",
    [ 70,  40,  90,  30,  40,  20,  10,  40,  50,  50,  30,  40,  10,  30,  40,  10,  20,  50]],
  ["Validare #3",
    [ 90,  70, 120,  70,  60,  60,  40,  90,  70,  60,  50,  50,  40,  50,  60,  30,  40,  70]],
  ["Validare #4",
    [100, 110, 130, 100,  90, 120,  50, 150,  90,  80,  70,  60,  80,  70,  80,  60,  50,  90]],
  ["Validare #5",
    [110, 140, 140, 130, 120, 150,  60, 180, 110, 100,  90,  70, 120,  90, 100,  90,  70, 100]],
  ["Validare #6 · ultimul meci",
    [130, 160, 170, 160, 140, 190,  70, 210, 130, 120, 110,  80, 150, 110, 120, 120,  90, 110]],
];

export const BURSA_MOCK_HISTORY = TABLE.map(([label, values]) => {
  const pointsByUid = {};
  COLS.forEach((uid, i) => { pointsByUid[uid] = values[i]; });
  // Dragalin (dezactivat) are puncte în sursă, ca testul să dovedească
  // că Bursa le IGNORĂ (altfel ar fi pe locul 1 la final).
  pointsByUid.dragalin = values.length ? Math.max(...values) + 50 : 0;
  return { label, pointsByUid };
});

// ══════════════════════════════════════════════════════════════════
// STĂRILE PREVIEW (A–L)
// phase: "open" | "saved" | "revealed" | "live" | "final"
// historyUpTo: câte validări sunt „făcute” (index în BURSA_MOCK_HISTORY)
// ══════════════════════════════════════════════════════════════════
export const BURSA_PREVIEW_STATES = [
  { id: "A", label: "A · Înscrieri deschise" },
  { id: "B", label: "B · Primul coleg ales" },
  { id: "C", label: "C · Portofoliu complet" },
  { id: "D", label: "D · Salvat, aștept închiderea" },
  { id: "E", label: "E · Dezvăluire" },
  { id: "F", label: "F · Duel la start" },
  { id: "G", label: "G · După câteva validări" },
  { id: "H", label: "H · Răsturnare de situație" },
  { id: "I", label: "I · Egalitate (+25 fiecare)" },
  { id: "J", label: "J · Adversar absent" },
  { id: "K", label: "K · Fără adversar (bye)" },
  { id: "L", label: "L · Duel finalizat" },
];

const LAST = BURSA_MOCK_HISTORY.length - 1;

function scenarioConfig(stateId) {
  const base = {
    eligibleUids: ALL_18, pairings: PAIRINGS_18, byePlayer: null,
    picksByUid: picksFor(ALL_18, { [BURSA_MOCK_ME]: MY_PORTFOLIO, [BURSA_MOCK_OPP]: OPP_PORTFOLIO }),
    myPortfolio: MY_PORTFOLIO, phase: "live", historyUpTo: 0,
  };
  switch (stateId) {
    case "A": return { ...base, phase: "open", myPortfolio: { perf: [], contra: [] } };
    case "B": return { ...base, phase: "open", myPortfolio: { perf: ["adireal"], contra: [] } };
    case "C": return { ...base, phase: "open" };
    case "D": return { ...base, phase: "saved" };
    case "E": return { ...base, phase: "revealed" };
    case "F": return { ...base, historyUpTo: 0 };
    case "G": return { ...base, historyUpTo: 2 };
    case "H": return { ...base, historyUpTo: 4 };
    case "I": return {
      ...base, historyUpTo: LAST,
      // Adversarul a ales EXACT aceiași colegi → scor brut identic.
      picksByUid: picksFor(ALL_18, { [BURSA_MOCK_ME]: MY_PORTFOLIO, [BURSA_MOCK_OPP]: MY_PORTFOLIO }),
    };
    case "J": return {
      ...base, historyUpTo: 3,
      picksByUid: picksFor(ALL_18, { [BURSA_MOCK_ME]: MY_PORTFOLIO }, [BURSA_MOCK_OPP]),
    };
    case "K": return {
      ...base, historyUpTo: 3, eligibleUids: ALL_17, pairings: PAIRINGS_17, byePlayer: BURSA_MOCK_ME,
      picksByUid: picksFor(ALL_17, { [BURSA_MOCK_ME]: MY_PORTFOLIO, [BURSA_MOCK_OPP]: OPP_PORTFOLIO }),
    };
    case "L": return { ...base, phase: "final", historyUpTo: LAST };
    default: return base;
  }
}

// ── Scenariul brut — BursaScreen îl folosește interactiv și calculează
// singur totul cu bursaService (aceeași cale ca jocul real). ──
export function getBursaMockScenario(stateId) {
  const cfg = scenarioConfig(stateId);
  return { ...cfg, history: BURSA_MOCK_HISTORY, myUid: BURSA_MOCK_ME };
}

// ── View-model complet pentru o stare (folosit la verificări). ──
export function buildBursaMockView(stateId) {
  const cfg = scenarioConfig(stateId);
  // În fazele de înscriere, portofoliul meu e cel în lucru (poate fi
  // incomplet → încă neparticipant, exact ca în jocul real).
  if (cfg.phase === "open") cfg.picksByUid = { ...cfg.picksByUid, [BURSA_MOCK_ME]: cfg.myPortfolio };
  const history = BURSA_MOCK_HISTORY.slice(0, cfg.historyUpTo + 1);
  const pointsByUid = history[history.length - 1].pointsByUid;
  const results = computeBursaResults({
    pairings: cfg.pairings, byePlayer: cfg.byePlayer, eligibleUids: cfg.eligibleUids,
    picksByUid: cfg.picksByUid, pointsByUid,
  });
  const mine = results.byUid[BURSA_MOCK_ME] || null;
  const opponentUid = mine?.opponentUid || null;
  const series = buildDuelSeries(history, {
    playerA: BURSA_MOCK_ME, playerB: opponentUid, eligibleUids: cfg.eligibleUids, picksByUid: cfg.picksByUid,
  });
  const revealed = cfg.phase === "revealed" || cfg.phase === "live" || cfg.phase === "final";
  return {
    stateId, phase: cfg.phase,
    myUid: BURSA_MOCK_ME, opponentUid, isBye: !!mine?.isBye,
    players: BURSA_MOCK_PLAYERS,
    eligibleUids: cfg.eligibleUids,
    myPortfolio: normalizePortfolio(cfg.myPortfolio),
    // Înainte de închidere, nimeni nu vede selecțiile celorlalți.
    picksByUid: revealed ? cfg.picksByUid : { [BURSA_MOCK_ME]: cfg.myPortfolio },
    validatedCount: cfg.historyUpTo,
    history, series, results, mine,
    opponent: opponentUid ? results.byUid[opponentUid] : null,
    reversalNow: series.length > 0 && series[series.length - 1].reversal,
    isFinal: cfg.phase === "final",
  };
}
