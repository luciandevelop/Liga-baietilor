// ── Texte cu personalitate — Comoara Blestemată. Câteva variante per
// context, alese aleator (fără arhitectură suplimentară). Nu toate
// vulgare — doar unde poanta chiar merită, conform direcției aprobate. ──

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── INTRO ──
export const INTRO_TITLE = "🏴‍☠️ COMOARA BLESTEMATĂ";
export const INTRO_LINES = [
  "Dincolo de cele 7 ape te așteaptă comoara.",
  "Ai 2 ❤️.",
  "Strânge puncte. Oprește-te când vrei după primele 3 ape.",
  "Dacă pierzi ambele vieți, pleci cu 0 PCT.",
];

// ── SOSIRE / INTRO CAPITOL (per zonă) ──
export const SAFE_ARRIVAL = [
  "Marea e liniștită. Orice drum îți aduce ceva.",
  "Vânt bun, apă calmă. Zi ușoară.",
];
export const RISK_ARRIVAL = [
  "☠️ APE PRIMEJDIOASE — de aici, nu toate drumurile duc înainte.",
  "Aerul s-a schimbat. Cineva o să piardă ceva azi.",
];
export const CURSED_ARRIVAL = [
  "☠️ APELE BLESTEMATE — de aici, jumătate dintre drumuri îți iau o viață.",
  "Furtuna te așteaptă. Insula se vede — dar prețul crește.",
];

// ── MESAJE DUPĂ REVEAL-UL DE POSIBILITĂȚI ──
export const POSSIBILITIES_SAFE_LINE = "Asta se ascunde pe cele 3 drumuri.";
export const POSSIBILITIES_RISK_LINE = "Una dintre cele 4 căi îți poate lua o viață.";
export const POSSIBILITIES_CURSED_LINE = "2 drumuri bune. 2 blestemate.";

export const RISK_ZONE_INTRO = RISK_ARRIVAL;
export const CURSED_ZONE_INTRO = CURSED_ARRIVAL;

export const LAST_LIFE_WARNING_TITLE = "⚠️ ULTIMA VIAȚĂ";
export const LAST_LIFE_WARNING_BODY = [
  "Dacă mai pierzi o ❤️, pierzi TOATE punctele și termini cu 0 PCT.",
  "O ❤️ pierdută de-acum = tot ce ai strâns, dus pe apa sâmbetei.",
];
export function lastLifeCashoutLine(total) {
  return pick([
    `${total} PCT. O viață. Și tot vrei să continui? 😈`,
    `${total} PCT pe masă. O ❤️ distanță de zero. Gândește bine.`,
  ]);
}

// ── REZULTAT BUN/RĂU (rămân, extinse ușor) ──
export function bigPositiveLine(value) {
  return pick([
    `Ai mirosit aurul de data asta. +${value} PCT.`,
    `+${value} PCT. Norocosule.`,
    `+${value} PCT — cineva și-a făcut temele... sau doar noroc chior.`,
  ]);
}
export function negativeLine(value) {
  return pick([
    `Bravo, Warren Buffett. ${value} PCT 😂`,
    `Ai găsit fix căcatul de pe hartă. ${value} 🤣`,
    `${value} PCT. Investiție proastă, coaie.`,
  ]);
}

export const LIFE_LOST_FIRST = [
  "Corabia merge, demnitatea mai puțin. −1 ❤️",
  "Ai supraviețuit. Onoarea, mai puțin.",
  "−1 ❤️. Mai ai una. Nu o irosi ca pe asta.",
];
export const LIFE_LOST_SECOND = [
  "Ultima inimă s-a dus. Comoara te-a învins.",
  "Ai vrut totul, ai rămas cu nimic.",
];

// ── GAME OVER — devreme vs târziu (mai aproape de comoară = mai dureros) ──
export const GAME_OVER_EARLY_LINES = [
  "Ai vrut comoara, ai luat muie. 0 PCT 😂",
  "Lăcomia, coaie... lăcomia. 0 PCT 🤣",
  "Comoara zice mersi de vizită. 0 PCT.",
];
export function gameOverLateLine(step, total) {
  return pick([
    `Pas ${step}. Comoara la doi pași. Și ai plecat cu pula-n mână. 0 PCT 😂`,
    `Ai văzut comoara. Ai vrut-o. Acum ai 0. 😂`,
    `Atât de aproape, coaie. Atât de departe. 0 PCT.`,
  ]);
}
export const GAME_OVER_LINES = GAME_OVER_EARLY_LINES; // păstrat pentru compatibilitate

export const TREASURE_FOUND_LINES = [
  "Comoara e a ta. Acum poți să ne explici că a fost «strategie». 😎",
  "Ai reușit. Restul lumii — nu neapărat.",
];
export const PERFECT_100_LINES = [
  "100 PCT. Fă poză, trimite-o în grup, lasă-i să sufere. 🏆",
  "Ai curățat harta. Maxim absolut. Respect.",
];

export function cashoutLine(total, safe) {
  if (safe) return pick([`${total} PCT — nimic spectaculos, dar sigur.`, `${total} PCT în buzunar. Poți dormi liniștit.`]);
  return pick([`De aici începe partea urâtă.`, `${total} PCT. Rișcă sau ia banii și pleacă.`, `${total} PCT strânși cu sudoare. Le lași aici?`]);
}

// ── TRAVEL — o propoziție scurtă, per zonă țintă ──
export const TRAVEL_LINES_SAFE = ["Marea încă ține cu tine...", "Vânt bun în pânze."];
export const TRAVEL_LINES_RISK = ["În față se vede o epavă.", "Cerul începe să se închidă."];
export const TRAVEL_LINES_CURSED = ["De aici începe partea proastă.", "Stadionul se vede printre fulgere."];
export const FINAL_CROSSING_LINES = ["Mai e puțin...", "Ai trecut de blestem."];
