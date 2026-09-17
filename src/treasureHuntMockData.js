// ══════════════════════════════════════════════════════════════════
// 🏴‍☠️ COMOARA BLESTEMATĂ — motor MOCK, 100% local, ZERO Firestore.
//
// Regula de bază (anti-cheat, deja gândit pentru implementarea reală
// ulterioară, pattern Mystery Box): rezultatele unui pas sunt
// amestecate O SINGURĂ DATĂ, la intrarea în pas — ÎNAINTE ca jucătorul
// să aleagă — nu se trage nimic random după click. Click-ul doar
// selectează un INDEX dintr-un array deja fixat.
// ══════════════════════════════════════════════════════════════════

export const MAX_POINTS = 100;
export const TREASURE_BONUS = 25;
export const START_LIVES = 2;
export const TOTAL_STEPS = 7;

const DEST_NAMES_3 = ["GOLFUL", "STRÂMTOAREA", "CEAȚA"];
const DEST_NAMES_4 = ["GOLFUL", "STRÂMTOAREA", "CEAȚA", "INSULA"];

// ── Configurația pe pas — SOURCE OF TRUTH primit, neschimbată aici. ──
function outcomesForStep(step) {
  if (step <= 3) {
    return [
      { type: "points", value: 5 },
      { type: "points", value: 10 },
      { type: "points", value: 15 },
    ];
  }
  if (step <= 5) {
    return [
      { type: "points", value: 10 },
      { type: "points", value: 20 },
      { type: "points", value: -10 },
      { type: "life", value: -1 },
    ];
  }
  return [
    { type: "points", value: 10 },
    { type: "points", value: 20 },
    { type: "life", value: -1 },
    { type: "life", value: -1 },
  ];
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Amestecă rezultatele unui pas ÎNAINTE de alegere — apelat o
// singură dată, la intrarea în pas, niciodată după click. ──
export function shuffleStepDoors(step) {
  const outcomes = shuffle(outcomesForStep(step));
  const names = outcomes.length === 3 ? DEST_NAMES_3 : DEST_NAMES_4;
  return outcomes.map((outcome, i) => ({ label: names[i], outcome }));
}

export function clampPoints(v) {
  return Math.max(0, Math.min(MAX_POINTS, v));
}

// ── Aplică un rezultat deja ales pe starea curentă — pur, fără efecte
// secundare. Cash-out-ul are loc STRICT ÎNAINTE de asumarea riscului
// (nu poate fi ales după ce a văzut rezultatele pasului). ──
export function applyOutcome(state, doorIndex) {
  const door = state.doors[doorIndex];
  const outcome = door.outcome;
  let total = state.total;
  let lives = state.lives;
  if (outcome.type === "points") total = clampPoints(total + outcome.value);
  else lives = lives - 1;

  // ── Reveal-ul se arată ÎNTOTDEAUNA, inclusiv la a doua viață
  // pierdută — cerut explicit ("folosește momentul de reacție și apoi
  // treci în game over"). Game over-ul propriu-zis se activează abia
  // la advanceAfterReveal, după ce jucătorul a văzut reacția. Scoring-ul
  // (total/lives) e neschimbat — doar SECVENȚIEREA fazei. ──
  return { ...state, total, lives, chosenIndex: doorIndex, phase: "revealed" };
}

// ── Stări inițiale ale motorului — folosite de un joc nou REAL,
// ulterior (nu de data asta, doar structura trebuie să permită). ──
export function freshGameState() {
  return { step: 1, total: 0, lives: START_LIVES, phase: "choosing", doors: shuffleStepDoors(1), chosenIndex: null };
}

// ── Tranziții — motorul complet, reutilizabil identic de UI real
// (viitor) și de preview (acum). ──
export function advanceAfterReveal(state) {
  if (state.lives <= 0) return { ...state, phase: "gameover", total: 0 };
  const { step } = state;
  if (step >= TOTAL_STEPS) {
    return { ...state, phase: "treasure", preTreasureTotal: state.total, total: clampPoints(state.total + TREASURE_BONUS) };
  }
  if (step >= 3) {
    return { ...state, phase: "cashout" };
  }
  const nextStep = step + 1;
  return { ...state, step: nextStep, phase: "choosing", doors: shuffleStepDoors(nextStep), chosenIndex: null };
}

export function cashOut(state) {
  return { ...state, phase: "cashedout" };
}

export function continueAfterCashout(state) {
  const nextStep = state.step + 1;
  return { ...state, step: nextStep, phase: "choosing", doors: shuffleStepDoors(nextStep), chosenIndex: null };
}

// ══════════════════════════════════════════════════════════════════
// PREVIEW ADMIN — stări A-J, MOCK, fără nicio scriere reală.
// ══════════════════════════════════════════════════════════════════
function fixedDoors(step, chosenOutcomeIdx) {
  const doors = shuffleStepDoors(step);
  return { doors, chosenIndex: chosenOutcomeIdx };
}

export function buildTreasureHuntPreview(letter) {
  switch (letter) {
    case "A": // pas sigur (1) inainte de alegere
      return { step: 1, total: 0, lives: 2, phase: "choosing", doors: shuffleStepDoors(1), chosenIndex: null };
    case "B": { // pas sigur (2) dupa reveal
      const { doors } = fixedDoors(2);
      return { step: 2, total: 10, lives: 2, phase: "revealed", doors, chosenIndex: 0 };
    }
    case "C": // pas de risc (4) inainte de alegere
      return { step: 4, total: 30, lives: 2, phase: "choosing", doors: shuffleStepDoors(4), chosenIndex: null };
    case "D": { // rezultat pozitiv (+20)
      const doors = shuffleStepDoors(4);
      const idx = doors.findIndex((d) => d.outcome.type === "points" && d.outcome.value === 20);
      return { step: 4, total: 50, lives: 2, phase: "revealed", doors, chosenIndex: idx };
    }
    case "E": { // -10
      const doors = shuffleStepDoors(4);
      const idx = doors.findIndex((d) => d.outcome.type === "points" && d.outcome.value === -10);
      return { step: 4, total: 20, lives: 2, phase: "revealed", doors, chosenIndex: idx };
    }
    case "F": { // pierdere prima viata
      const doors = shuffleStepDoors(4);
      const idx = doors.findIndex((d) => d.outcome.type === "life");
      return { step: 4, total: 30, lives: 1, phase: "revealed", doors, chosenIndex: idx };
    }
    case "G": // cash-out
      return { step: 4, total: 30, lives: 2, phase: "cashout", doors: [], chosenIndex: null };
    case "H": // ultima trecere (7)
      return { step: 7, total: 65, lives: 1, phase: "choosing", doors: shuffleStepDoors(7), chosenIndex: null };
    case "I": // comoara gasita
      return { step: 7, total: clampPoints(70 + TREASURE_BONUS), preTreasureTotal: 70, lives: 1, phase: "treasure", doors: [], chosenIndex: null };
    case "J": // game over
      return { step: 5, total: 0, lives: 0, phase: "gameover", doors: [], chosenIndex: null };
    default:
      return freshGameState();
  }
}

export const TREASURE_HUNT_PREVIEW_STATES = [
  { id: "A", label: "A — pas sigur, alegere" },
  { id: "B", label: "B — pas sigur, reveal" },
  { id: "C", label: "C — risc, alegere" },
  { id: "D", label: "D — rezultat +20" },
  { id: "E", label: "E — rezultat −10" },
  { id: "F", label: "F — pierdere 1 viață" },
  { id: "G", label: "G — cash-out" },
  { id: "H", label: "H — ultima trecere" },
  { id: "I", label: "I — comoară găsită" },
  { id: "J", label: "J — game over" },
];
