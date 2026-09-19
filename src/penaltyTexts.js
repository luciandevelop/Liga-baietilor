// ── Texte contextuale — Penalty PvP. Pool-uri per situație, alese
// aleator, alternanță funny/provocare/aroganță/ironie — nu fiecare
// vulgar, conform direcției aprobate. ──
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export const SAVE_LINES = [
  "Ți-am apărat-o, fraiere 😂",
  "Te-am ghicit și de data asta. 🧤",
  "Te-am citit ca pe carte, coaie. 😂",
  "Tot acolo? Te-am mirosit. 🧤😏",
];
export const SAVE_CENTER_LINES = ["Pe centru? Serios? Mersi de minge. 😂", "Direct în brațe. Mulțumesc frumos."];

export const GOAL_LINES = [
  "Ia-o p-asta, portarule. ⚽😂",
  "Te-ai dus după țigări? E în plasă. 😂",
  "Colțul ăla avea numele meu pe el. 😎",
];
export const WRONG_GUESS_LINES = ["Unde pula mea te-ai dus? 😂", "Ai ghicit-o pe dos, coaie."];

export const ROLE_SHOOT_TITLE = "🎯 UNDE TRAGI?";
export const ROLE_DEFEND_TITLE = "🧤 UNDE TE ARUNCI?";
export const ROLE_SWITCH_TITLE = "🔄 SCHIMB DE ROLURI";
export const ROLE_SWITCH_LINE = "Acum intri în poartă.";

export function finalLine(myGoals, mySaves) {
  const total = myGoals + mySaves;
  if (total >= 7) return pick(["La următoarea etapă îți aducem și mănușile lui Buffon. 🧤😎", "Serie de vis. Restul grupului te urăște acum."]);
  if (total <= 3) return pick(["Bă, măcar ai nimerit stadionul. 😂", "A fost... o experiență. 😅"]);
  return pick(["Onorabil. Nici erou, nici victimă.", "Ai supraviețuit seria. Meriți o bere."]);
}
