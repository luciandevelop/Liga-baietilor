// ── Date mock, STRICT pentru preview Admin — nu ating Firestore. ──
import { CHOICE_MORE, CHOICE_LESS } from "./services/higherLowerService";

const ME = { uid: "me", nickname: "Luck87", avatarId: "luck87" };
const OPP = { uid: "opp", nickname: "Bogdan", avatarId: "bogdanb" };

const QUESTIONS = [
  { id: "q1", matchId: "m1", criteria: "Total goluri — Liverpool vs Tottenham", threshold: 2.5, unit: "goluri" },
  { id: "q2", matchId: "m1", criteria: "Total cornere — Liverpool vs Tottenham", threshold: 9.5, unit: "cornere" },
  { id: "q3", matchId: "m2", criteria: "Total goluri — United vs City", threshold: 2.5, unit: "goluri" },
  { id: "q4", matchId: "m2", criteria: "Total cartonașe — United vs City", threshold: 4.5, unit: "cartonașe" },
  { id: "q5", matchId: "m3", criteria: "Total goluri — Real vs Barca", threshold: 3.5, unit: "goluri" },
  { id: "q6", matchId: "m3", criteria: "Total cornere — Real vs Barca", threshold: 10.5, unit: "cornere" },
];

function baseDuel() {
  return { playerA: "me", playerB: "opp", starterUid: "me" };
}

function buildRounds({ decidedCount, resolvedCount, tiebreak }) {
  return QUESTIONS.map((q, idx) => {
    const roundNumber = idx + 1;
    const isOdd = roundNumber % 2 === 1; // "me" e starter -> prioritate pe impare
    const priorityUid = isOdd ? "me" : "opp";
    const otherUid = isOdd ? "opp" : "me";
    const decided = idx < decidedCount;
    const priorityChoice = decided ? (idx % 2 === 0 ? CHOICE_MORE : CHOICE_LESS) : null;
    const otherChoice = decided ? (priorityChoice === CHOICE_MORE ? CHOICE_LESS : CHOICE_MORE) : null;
    const choiceA = priorityUid === "me" ? priorityChoice : otherChoice;
    const choiceB = priorityUid === "opp" ? priorityChoice : otherChoice;
    const resolved = idx < resolvedCount;
    return {
      roundNumber, question: q, priorityUid, otherUid, choiceA, choiceB,
      decided, result: resolved ? (idx % 2 === 0 ? CHOICE_MORE : CHOICE_LESS) : null,
    };
  });
}

const STATES = {
  // A — eu am prioritate (runda 1) și aleg
  A: { duel: baseDuel(), rounds: buildRounds({ decidedCount: 0, resolvedCount: 0 }), myTiebreaker: null },
  // B — adversarul are prioritate (runda 2), încă n-a ales
  B: { duel: baseDuel(), rounds: buildRounds({ decidedCount: 1, resolvedCount: 0 }), myTiebreaker: null },
  // C — adversarul a ales, ambele variante vizibile
  C: { duel: baseDuel(), rounds: buildRounds({ decidedCount: 2, resolvedCount: 0 }), myTiebreaker: null },
  // D — duel în desfășurare, scor parțial
  D: { duel: baseDuel(), rounds: buildRounds({ decidedCount: 4, resolvedCount: 2 }), myTiebreaker: 7 },
  // E — rezultate validate parțial, scor progresiv
  E: { duel: baseDuel(), rounds: buildRounds({ decidedCount: 6, resolvedCount: 4 }), myTiebreaker: 7 },
  // F — baraj (toate 6 decise, 6 rezultate, egalitate 3-3)
  F: { duel: baseDuel(), rounds: buildRounds({ decidedCount: 6, resolvedCount: 6 }), myTiebreaker: 7, tiebreak: { real: 8, mine: 7, opp: 5, winner: "me" } },
  // G — resolve final
  G: { duel: baseDuel(), rounds: buildRounds({ decidedCount: 6, resolvedCount: 6 }), myTiebreaker: 7, final: { winsMine: 4, winsOpp: 2, bonus: 50, total: 150 } },
};

export function buildMockView(previewState) {
  const s = STATES[previewState] || STATES.A;
  return {
    duelId: "d_preview", duel: s.duel, opponentUid: "opp",
    rounds: s.rounds,
    winsMine: s.rounds.filter((r) => r.result != null && r.choiceA === r.result).length,
    winsOpp: s.rounds.filter((r) => r.result != null && r.choiceB === r.result).length,
    myTiebreaker: s.myTiebreaker,
    tiebreak: s.tiebreak || null,
    final: s.final || null,
    me: ME, opponent: OPP,
  };
}

export const HIGHER_LOWER_PREVIEW_STATES = [
  { id: "A", label: "A — eu aleg" },
  { id: "B", label: "B — aștept adversarul" },
  { id: "C", label: "C — adversar a ales" },
  { id: "D", label: "D — în desfășurare" },
  { id: "E", label: "E — validat parțial" },
  { id: "F", label: "F — baraj" },
  { id: "G", label: "G — resolve final" },
];
