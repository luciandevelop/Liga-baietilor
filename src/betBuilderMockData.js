// ══════════════════════════════════════════════════════════════════
// Date MOCK, 100% locale — folosite STRICT de Preview-ul din Admin.
// Aceeași formă exactă ca getMyBetBuilderView() din betBuilderService,
// ca BetBuilderScreen să nu observe nicio diferență structurală între
// modul real și preview. Niciun apel Firestore aici.
// ══════════════════════════════════════════════════════════════════
const MOCK_MATCH = {
  id: "mock_match", homeTeam: "Real Madrid", awayTeam: "Inter",
  kickoffAt: { toMillis: () => Date.now() + 3 * 24 * 60 * 60 * 1000 }, // peste 3 zile — mereu "editabil" in preview
};

const MOCK_QUESTIONS = [
  { id: "q1", text: "Peste 2.5 goluri în meci", options: ["Peste", "Sub"] },
  { id: "q2", text: "Real Madrid — peste 4.5 cornere", options: ["Peste", "Sub"] },
  { id: "q3", text: "Lautaro Martínez — șut pe poartă", options: ["DA", "NU"] },
  { id: "q4", text: "Peste 3.5 cartonașe în meci", options: ["Peste", "Sub"] },
  { id: "q5", text: "Ambele echipe marchează", options: ["DA", "NU"] },
];

const MOCK_UID_ME = "preview_luck87";
const MOCK_UID_OPP = "preview_bogdan";

export const PREVIEW_PROFILES = {
  [MOCK_UID_ME]: { nickname: "Luck87", avatarId: null },
  [MOCK_UID_OPP]: { nickname: "Bogdan", avatarId: null },
};

function baseMatchGroup(results, tiebreakerRealAnswer) {
  return {
    matchId: MOCK_MATCH.id,
    questions: MOCK_QUESTIONS,
    results: results || {},
    tiebreakerText: "Câte goluri vor fi în total în cele 20 de meciuri ale etapei?",
    tiebreakerRealAnswer: tiebreakerRealAnswer ?? null,
  };
}

function baseDuel() {
  return { id: "mock_duel", matchId: MOCK_MATCH.id, playerA: MOCK_UID_ME, playerB: MOCK_UID_OPP };
}

// A — completare, nimic salvat încă.
function stateA() {
  return {
    duel: baseDuel(), matchGroup: baseMatchGroup(), opponentUid: MOCK_UID_OPP,
    myPick: null, match: MOCK_MATCH,
  };
}

// B — ambii confirmați, reveal, meciul încă n-a început (toate pending).
function stateB() {
  const results = { q1: "pending", q2: "pending", q3: "pending", q4: "pending", q5: "pending" };
  return {
    duel: baseDuel(), matchGroup: baseMatchGroup(results), opponentUid: MOCK_UID_OPP,
    myPick: { uid: MOCK_UID_ME, picks: { q1: 0, q2: 0, q3: 1, q4: 1, q5: 0 }, tiebreakerAnswer: 48, confirmed: true },
    opponentPick: { uid: MOCK_UID_OPP, picks: { q1: 0, q2: 1, q3: 0, q4: 1, q5: 0 }, tiebreakerAnswer: 52, confirmed: true },
    match: MOCK_MATCH,
  };
}

// C — live, rezultate mixte (exact exemplul din cerință: eu 2/3 validate, adversar 2/3).
function stateC() {
  const results = { q1: "hit", q2: "hit", q3: "miss", q4: "pending", q5: "pending" };
  return {
    duel: baseDuel(), matchGroup: baseMatchGroup(results), opponentUid: MOCK_UID_OPP,
    myPick: { uid: MOCK_UID_ME, picks: { q1: 0, q2: 0, q3: 1, q4: 1, q5: 0 }, tiebreakerAnswer: 48, confirmed: true },
    opponentPick: { uid: MOCK_UID_OPP, picks: { q1: 0, q2: 1, q3: 0, q4: 1, q5: 0 }, tiebreakerAnswer: 52, confirmed: true },
    match: MOCK_MATCH,
  };
}

// D — final, toate rezolvate, egalitate pe hituri -> baraj decide.
function stateD() {
  const results = { q1: "hit", q2: "hit", q3: "miss", q4: "miss", q5: "hit" };
  return {
    duel: baseDuel(), matchGroup: baseMatchGroup(results, 50), opponentUid: MOCK_UID_OPP,
    // Eu: q1,q2,q3 corecte (3/5). Adversar: q1,q3,q4 corecte (3/5) — egalitate, decide barajul.
    myPick: { uid: MOCK_UID_ME, picks: { q1: 0, q2: 0, q3: 1, q4: 0, q5: 1 }, tiebreakerAnswer: 49, confirmed: true },
    opponentPick: { uid: MOCK_UID_OPP, picks: { q1: 0, q2: 1, q3: 1, q4: 1, q5: 1 }, tiebreakerAnswer: 45, confirmed: true },
    match: MOCK_MATCH,
  };
}

export function buildMockView(state) {
  if (state === "A") return stateA();
  if (state === "B") return stateB();
  if (state === "C") return stateC();
  if (state === "D") return stateD();
  return stateA();
}

export const PREVIEW_USER = { uid: MOCK_UID_ME };
