// ── Date mock, STRICT pentru preview Admin — nu ating Firestore. ──
import { CHOICE_MORE, CHOICE_LESS, computeHigherLowerDuelPoints } from "./services/higherLowerService";

const ME = { uid: "me", nickname: "Luck87", avatarId: "luck87/1" };
const OPP = { uid: "opp", nickname: "Bogdan", avatarId: "bogdanb/1" };

const QUESTIONS = [
  { id: "q1", matchId: "m1", criteria: "Total goluri", matchLabel: "Liverpool vs Tottenham", threshold: 2.5, unit: "goluri" },
  { id: "q2", matchId: "m1", criteria: "Total cornere", matchLabel: "Liverpool vs Tottenham", threshold: 9.5, unit: "cornere" },
  { id: "q3", matchId: "m2", criteria: "Total goluri", matchLabel: "United vs City", threshold: 2.5, unit: "goluri" },
  { id: "q4", matchId: "m2", criteria: "Total cartonașe", matchLabel: "United vs City", threshold: 4.5, unit: "cartonașe" },
  { id: "q5", matchId: "m3", criteria: "Total goluri", matchLabel: "Real vs Barca", threshold: 3.5, unit: "goluri" },
  { id: "q6", matchId: "m3", criteria: "Total cornere", matchLabel: "Real vs Barca", threshold: 10.5, unit: "cornere" },
];

function baseDuel() {
  return { playerA: "me", playerB: "opp", starterUid: "me" };
}

// ── Aceeași logică de derivare ca higherLowerService.deriveDuelRounds
// (rescrisă local, pur, ca să nu depindă de Firestore/gameweekId real —
// dar identică ca algoritm, ca preview-ul să reflecte exact realitatea). ──
function buildRounds({ decidedCount, resolvedCount }) {
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

function activeRoundIndex(rounds) {
  let idx = rounds.findIndex((r) => !r.decided);
  if (idx === -1) idx = rounds.findIndex((r) => !r.result);
  return idx; // -1 dacă totul e rezolvat
}

const STATES_RAW = {
  A: { rounds: buildRounds({ decidedCount: 0, resolvedCount: 0 }), myTiebreaker: null, tbRevealed: false },
  B: { rounds: buildRounds({ decidedCount: 1, resolvedCount: 0 }), myTiebreaker: null, tbRevealed: false },
  C: { rounds: buildRounds({ decidedCount: 2, resolvedCount: 0 }), myTiebreaker: null, tbRevealed: false },
  D: { rounds: buildRounds({ decidedCount: 4, resolvedCount: 2 }), myTiebreaker: 7, tbRevealed: false },
  E: { rounds: buildRounds({ decidedCount: 6, resolvedCount: 4 }), myTiebreaker: 7, tbRevealed: false },
  // F/G: 6 decise + 6 rezolvate -> prin construcție rezultă EXACT 3-3
  // (verificat: rundele 1/3/5 le câștigă "me", 2/4/6 le câștigă "opp").
  // F = baraj trimis, ÎNCĂ nedezvăluit. G = dezvăluit, final complet.
  F: { rounds: buildRounds({ decidedCount: 6, resolvedCount: 6 }), myTiebreaker: 7, tbRevealed: false },
  G: { rounds: buildRounds({ decidedCount: 6, resolvedCount: 6 }), myTiebreaker: 7, oppTiebreaker: 5, realGoalsTotal: 8, tbRevealed: true },
};

export function buildMockView(previewState) {
  const s = STATES_RAW[previewState] || STATES_RAW.A;
  const winsMine = s.rounds.filter((r) => r.result != null && r.choiceA === r.result).length;
  const winsOpp = s.rounds.filter((r) => r.result != null && r.choiceB === r.result).length;
  const allResolved = s.rounds.every((r) => r.result != null);

  // ── Punctele finale se calculează STRICT prin formula reală
  // (computeHigherLowerDuelPoints) — niciodată hardcodate — exact fix-ul
  // pentru bug-ul găsit în Preview G (+150 la 3-3, imposibil). ──
  let final = null;
  if (allResolved && s.tbRevealed) {
    const pts = computeHigherLowerDuelPoints(winsMine, winsOpp, s.myTiebreaker, s.oppTiebreaker, s.realGoalsTotal);
    final = {
      winsMine, winsOpp, bonusMine: pts.bonusA, bonusOpp: pts.bonusB, totalMine: pts.totalA, totalOpp: pts.totalB,
      tiebreakUsed: winsMine === winsOpp,
      tiebreakWinner: pts.bonusA > pts.bonusB ? "me" : pts.bonusB > pts.bonusA ? "opp" : "tie",
    };
  }

  return {
    duelId: "d_preview", duel: baseDuel(), opponentUid: "opp",
    rounds: s.rounds, winsMine, winsOpp,
    activeRoundIndex: activeRoundIndex(s.rounds),
    myTiebreaker: s.myTiebreaker,
    oppTiebreaker: s.tbRevealed ? s.oppTiebreaker : null,
    realGoalsTotal: s.tbRevealed ? s.realGoalsTotal : null,
    tiebreakNeeded: allResolved && winsMine === winsOpp,
    tbRevealed: s.tbRevealed,
    final,
    me: ME, opponent: OPP,
  };
}

export const HIGHER_LOWER_PREVIEW_STATES = [
  { id: "A", label: "A — eu aleg" },
  { id: "B", label: "B — aștept adversarul" },
  { id: "C", label: "C — adversar a ales" },
  { id: "D", label: "D — în desfășurare" },
  { id: "E", label: "E — validat parțial" },
  { id: "F", label: "F — baraj (nedezvăluit)" },
  { id: "G", label: "G — resolve final" },
];
