// ── Texte cu personalitate — Comoara Blestemată. Câteva variante per
// context, alese aleator (fără arhitectură suplimentară). Nu toate
// vulgare — doar unde poanta chiar merită, conform direcției aprobate. ──

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export const RISK_ZONE_INTRO = [
  "Mai ai coaie? 😏",
  "De-aici încolo nu mai e plimbare cu barca.",
  "Zona serioasă. Regreți sau continui?",
];

export const CURSED_ZONE_INTRO = [
  "Apele blestemate nu iartă pe nimeni.",
  "Aici mor visele — și uneori vieți.",
  "Ultima parte a hărții. Ține-te bine.",
];

export const LAST_LIFE_WARNING_TITLE = "⚠️ ULTIMA VIAȚĂ";
export const LAST_LIFE_WARNING_BODY = [
  "Dacă mai pierzi o ❤️, pierzi TOATE punctele și termini cu 0 PCT.",
  "Un ❤️ pierdut de-acum = tot ce ai strâns, dus pe apa sâmbetei.",
];
export function lastLifeCashoutLine(total) {
  const variants = [
    `${total} PCT. O viață. Și tot vrei să continui? 😈`,
    `${total} PCT pe masă. Un ❤️ distanță de zero. Gândește bine.`,
  ];
  return pick(variants);
}

export function bigPositiveLine(value) {
  return pick([
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

export const GAME_OVER_LINES = [
  "Ai vrut comoara, ai luat muie. 0 PCT 😂",
  "Lăcomia, coaie... lăcomia. 0 PCT 🤣",
  "Comoara zice mersi de vizită. 0 PCT.",
];

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
  return pick([`${total} PCT. Rișcă sau ia banii și pleacă.`, `${total} PCT strânși cu sudoare. Le lași aici?`]);
}
