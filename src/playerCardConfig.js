// ══════════════════════════════════════════════════════════════════
// Configurația Player Card — SINGURA sursă pentru serii, titluri,
// praguri și atribute fun. Orice extindere viitoare (serie nouă,
// titlu nou, prag ajustat) se face DOAR aici — PlayerCard.jsx și
// adminService.js citesc din acest fișier, niciodată valori proprii.
// ══════════════════════════════════════════════════════════════════

// ── Praguri — balansul jocului, NU hardcodat în logică ──────────────
export const CARD_THRESHOLDS = {
  HOT_STREAK_POINTS: 500,     // puncte într-o etapă pentru titlul "Hot Streak"
  VETERAN_GAMEWEEKS: 5,       // etape jucate (all-time) pentru "Veteran"
  COMEBACK_POINTS: 150,       // creștere față de etapa anterioară pentru "Revenire spectaculoasă"
  LUNETIST_EXACT_SCORES: 2,   // scoruri exacte într-o etapă pentru "Lunetist"
};

// ── Serii — identitate vizuală permanentă per user (hash din uid),
// cu excepția "icon", rezervată exclusiv locului #1 din General.
// Fiecare intrare = un "skin" complet: culori, motto, citat fix.
// Adăugarea unei serii noi (Halloween, Christmas, Legend, Event...)
// înseamnă STRICT un obiect nou aici — nimic altceva nu se schimbă.
export const SERIES = {
  goldElite: {
    id: "goldElite",
    name: "Gold Elite",
    motto: "Regele etapei",
    quote: "Campionii nu urmăresc punctele. Punctele îi urmăresc pe ei.",
    icon: "👑",
    primary: "#D4AF37",
    secondary: "#FFE9A8",
    bg: ["#4a3a0e", "#1c1608", "#0a0805"],
    texture: "metal", // metal auriu, benzi de lumină late, lux discret
  },
  futureStars: {
    id: "futureStars",
    name: "Future Stars",
    motto: "Viitorul începe azi",
    quote: "Fiecare etapă este o șansă să urci.",
    icon: "⭐",
    primary: "#B355E8",
    secondary: "#E8B8FF",
    bg: ["#2a0f3d", "#150a24", "#08040f"],
    texture: "crystal", // fațete cristaline, gradient pe diagonală, futurist
  },
  totw: {
    id: "totw",
    name: "Team of the Week",
    motto: "În formă maximă",
    quote: "Ai prins momentul perfect.",
    icon: "⚡",
    primary: "#3AA0FF",
    secondary: "#A9D9FF",
    bg: ["#0a2340", "#071528", "#030a14"],
    texture: "electric", // puls radial, energie, muchii ascuțite de lumină
  },
  icon: {
    id: "icon",
    name: "Icon",
    motto: "Legendă",
    quote: "Respectul se câștigă etapă cu etapă.",
    icon: "💎",
    primary: "#F0F0F0",
    secondary: "#FFFFFF",
    bg: ["#3a3a3a", "#1a1a1a", "#0a0a0a"],
    texture: "marble", // marmură, vene fine, eleganță clasică
    rare: true, // singura serie cu efect holografic — vezi PlayerCard.jsx
  },
};

// Toate seriile sunt eligibile pentru asignare prin hash — inclusiv
// Icon. Nicio serie nu mai depinde de rang (vezi deterministicHash.js).
export const ALL_SERIES_IDS = ["goldElite", "futureStars", "totw", "icon"];

// ── Titluri dinamice — evaluate în ordine, primul care se potrivește
// câștigă. Adăugarea unui titlu nou = un obiect nou în array, oriunde
// e nevoie în ordinea de prioritate — nimic altceva nu se schimbă.
// `check(stats)` primește exact obiectul întors de getPlayerCardStats.
export const TITLES = [
  // "Campion General" — statutul de #1 din TOATE sezoanele, cel mai
  // rar/valoros titlu posibil, de-asta e verificat primul. Aici, NU pe
  // serie, trăiește acum recompensa pentru locul #1 — poate apărea și
  // dispărea liber de la o etapă la alta, fără să atingă identitatea
  // permanentă a cardului.
  { id: "champion-general", label: "Campion General", icon: "👑", check: (s) => s.isTopGeneral === true },
  { id: "mvp", label: "MVP-ul etapei", icon: "🏆", check: (s) => s.rank === 1 },
  { id: "champion", label: "Campionul etapei", icon: "🥈", check: (s) => s.rank === 2 || s.rank === 3 },
  { id: "lunetist", label: "Lunetist", icon: "🎯", check: (s) => s.exactScores >= CARD_THRESHOLDS.LUNETIST_EXACT_SCORES },
  {
    id: "hotstreak", label: "Hot Streak", icon: "⚡",
    check: (s) => s.etapaPoints != null && s.etapaPoints >= CARD_THRESHOLDS.HOT_STREAK_POINTS,
  },
  {
    id: "comeback", label: "Revenire spectaculoasă", icon: "🚀",
    check: (s) => s.etapaPoints != null && s.previousEtapaPoints != null &&
      (s.etapaPoints - s.previousEtapaPoints) >= CARD_THRESHOLDS.COMEBACK_POINTS,
  },
  { id: "informa", label: "În formă", icon: "🔥", check: (s) => s.matchesThisEtapa > 0 && s.noPointsCount === 0 },
  { id: "veteran", label: "Veteran", icon: "💎", check: (s) => s.gameweeksPlayed >= CARD_THRESHOLDS.VETERAN_GAMEWEEKS },
];
export const DEFAULT_TITLE = { id: "active", label: "Jucător activ", icon: "🎮" };

// Alege primul titlu potrivit — mereu întoarce ceva (fallback la
// DEFAULT_TITLE), niciodată slot gol.
export function resolveTitle(stats) {
  return TITLES.find((t) => t.check(stats)) || DEFAULT_TITLE;
}

// ── Fun — 8 atribute posibile, fiecare user primește un subset (4)
// + valori, ambele determinist din uid (vezi deterministicHash.js).
// Fără nicio comparație între useri — pur personalitate.
export const FUN_ATTRIBUTES = [
  { id: "smecherie", icon: "😎", label: "Șmecherie" },
  { id: "carisma", icon: "🔥", label: "Carismă" },
  { id: "chefdebere", icon: "🍻", label: "Chef de bere" },
  { id: "sexy", icon: "💘", label: "Sexy" },
  { id: "talent", icon: "🧠", label: "Talent" },
  { id: "instinct", icon: "⚡", label: "Instinct" },
  { id: "aura", icon: "👑", label: "Aura" },
  { id: "noroc", icon: "😂", label: "Noroc" },
];
export const FUN_ATTRIBUTES_PER_CARD = 4;
export const FUN_VALUE_MIN = 82;
export const FUN_VALUE_MAX = 99;
