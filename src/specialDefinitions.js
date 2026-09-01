// ══════════════════════════════════════════════════════════════════
// SPECIALELE SEZONULUI — configurare completă. Nimic din acest sistem
// nu are logică hardcodată per-competiție — fiecare fază e o intrare de
// date, evaluată generic de adminService.js/SpecialsScreen.jsx. Pentru
// a adăuga o competiție nouă (Mondial, EURO, Cupa României), se adaugă
// STRICT un obiect nou aici — niciun ecran, nicio funcție nu se schimbă.
// ══════════════════════════════════════════════════════════════════

// ── Tipuri de alegere — cele 3 forme posibile ale unei faze ──
// "single"  — o singură opțiune aleasă dintr-o listă (Câștigătoare, Golgheter)
// "ranked"  — N opțiuni alese ȘI ordonate (TOP 8 după faza ligii)
// "group"   — N opțiuni alese, FĂRĂ ordine (Sferturi → cine merge în semi)
export const PICK_TYPES = { SINGLE: "single", RANKED: "ranked", GROUP: "group" };

// ── Golgheter Champions League — 15 candidați + ALTUL, cerut explicit
// să NU aibă câmp de text liber. "ALTUL" e o opțiune NORMALĂ (id fix),
// scorată exact ca restul — dacă golgheterul real NU e unul din cei 15,
// Admin introduce "ALTUL" ca răspuns corect la rezolvare, și oricine a
// ales "ALTUL" primește punctajul complet, automat (scoreSinglePick
// deja face asta — pick.choice === correctAnswer). ──
export const CL_TOP_SCORER_OPTIONS = [
  { id: "mbappe", label: "Kylian Mbappé" },
  { id: "kane", label: "Harry Kane" },
  { id: "haaland", label: "Erling Haaland" },
  { id: "dembele", label: "Ousmane Dembélé" },
  { id: "bellingham", label: "Jude Bellingham" },
  { id: "vinicius", label: "Vinícius Júnior" },
  { id: "raphinha", label: "Raphinha" },
  { id: "lamine-yamal", label: "Lamine Yamal" },
  { id: "kvaratskhelia", label: "Khvicha Kvaratskhelia" },
  { id: "lautaro", label: "Lautaro Martínez" },
  { id: "isak", label: "Alexander Isak" },
  { id: "julian-alvarez", label: "Julián Álvarez" },
  { id: "havertz", label: "Kai Havertz" },
  { id: "gyokeres", label: "Viktor Gyökeres" },
  { id: "osimhen", label: "Victor Osimhen" },
  { id: "altul", label: "ALTUL" },
];

// ── Speciale de tip "Top N cu poziții" — funcție comună (cerută
// explicit, secțiunea 26), valorile configurabile per fază, NU
// presupuse identice. Reutilizează exact PICK_TYPES.RANKED, deja
// existent și testat (era deja folosit la cl-top8). ──
export const SPECIAL_COMPETITIONS = [
  {
    id: "uefa-champions-league",
    name: "Champions League",
    tier: "primary", // "primary" = card mare, evidențiat; "secondary" = compact
    phases: [
      {
        id: "cl-winner",
        label: "Câștigătoare Champions League",
        icon: "🏆",
        type: PICK_TYPES.SINGLE,
        points: 1500,
        optionsSource: "teams", // admin introduce lista de echipe valide la deschidere
        requiresPhase: null, // se deschide independent, nu așteaptă altceva
      },
      {
        id: "cl-golgheter",
        label: "Golgheter",
        icon: "⚽",
        type: PICK_TYPES.SINGLE,
        points: 800,
        optionsSource: "players", // admin introduce o listă scurtă de candidați (nu text liber — vezi nota din analiză)
        requiresPhase: null,
      },
      {
        id: "cl-top8",
        label: "TOP 8 după faza ligii",
        icon: "🥇",
        type: PICK_TYPES.RANKED,
        rankedSize: 8,
        pointsInSet: 200, // echipa e în TOP 8, dar pe altă poziție
        pointsExact: 300, // poziție exactă — NU se cumulează cu pointsInSet
        optionsSource: "teams",
        requiresPhase: null,
      },
      {
        id: "cl-quarters",
        label: "Sferturi",
        icon: "🏆",
        type: PICK_TYPES.GROUP,
        groupSize: 4, // alege cele 4 echipe care merg în semifinală
        pointsPerCorrect: 200,
        optionsSource: "teams",
        requiresPhase: "cl-top8", // rămâne "Coming Soon" până faza ligii se rezolvă
      },
      {
        id: "cl-semifinals",
        label: "Semifinale",
        icon: "🏆",
        type: PICK_TYPES.GROUP,
        groupSize: 2, // alege cei 2 finaliști
        pointsPerCorrect: 300,
        optionsSource: "teams",
        requiresPhase: "cl-quarters",
      },
      {
        id: "cl-final",
        label: "Finală",
        icon: "🏆",
        type: PICK_TYPES.SINGLE,
        points: 400,
        optionsSource: "teams",
        requiresPhase: "cl-semifinals",
        // Independent de cl-winner — alegerea de dinainte de sezon NU se
        // suprascrie și nu se pierde dacă userul alege altă echipă aici.
      },
    ],
  },
  {
    id: "uefa-europa-league",
    name: "Europa League",
    tier: "secondary",
    phases: [
      { id: "el-winner", label: "Câștigătoare Europa League", icon: "🏆", type: PICK_TYPES.SINGLE, points: 1000, optionsSource: "teams", requiresPhase: null },
      {
        id: "el-top8",
        label: "TOP 8 după faza ligii",
        icon: "🥇",
        type: PICK_TYPES.RANKED,
        rankedSize: 8,
        pointsInSet: 100, // echipa în TOP 8, poziție greșită
        pointsExact: 200, // poziție exactă — NU se cumulează
        optionsSource: "teams",
        requiresPhase: null,
      },
      {
        id: "el-semifinals",
        label: "Semifinale",
        icon: "🏆",
        type: PICK_TYPES.GROUP,
        groupSize: 2, // alege cei 2 finaliști
        pointsPerCorrect: 200,
        optionsSource: "teams",
        requiresPhase: null, // apare de la început, dar BLOCAT — vezi UI (SpecialPhasePicker), nu requiresPhase (UEL nu are Top8→Semis ca dependență, per cerință explicită)
      },
      {
        id: "el-final",
        label: "Finală",
        icon: "🏆",
        type: PICK_TYPES.SINGLE,
        points: 300,
        optionsSource: "teams",
        requiresPhase: "el-semifinals",
      },
    ],
  },
  {
    id: "uefa-conference-league",
    name: "Conference League",
    tier: "secondary",
    phases: [
      { id: "ecl-winner", label: "Câștigătoare Conference League", icon: "🏆", type: PICK_TYPES.SINGLE, points: 500, optionsSource: "teams", requiresPhase: null },
      {
        id: "ecl-semifinals",
        label: "Semifinale",
        icon: "🏆",
        type: PICK_TYPES.GROUP,
        groupSize: 2,
        pointsPerCorrect: 100,
        optionsSource: "teams",
        requiresPhase: null,
      },
      {
        id: "ecl-final",
        label: "Finală",
        icon: "🏆",
        type: PICK_TYPES.SINGLE,
        points: 200,
        optionsSource: "teams",
        requiresPhase: "ecl-semifinals",
      },
    ],
  },
  {
    id: "english-premier-league",
    name: "Premier League",
    tier: "league",
    phases: [
      { id: "epl-winner", label: "Câștigătoare", icon: "🏆", type: PICK_TYPES.SINGLE, points: 700, optionsSource: "teams", requiresPhase: null },
      { id: "epl-top4", label: "TOP 4", icon: "🥇", type: PICK_TYPES.RANKED, rankedSize: 4, pointsInSet: 100, pointsExact: 150, optionsSource: "teams", requiresPhase: null },
    ],
  },
  {
    id: "la-liga",
    name: "LaLiga",
    tier: "league",
    phases: [
      { id: "laliga-winner", label: "Câștigătoare", icon: "🏆", type: PICK_TYPES.SINGLE, points: 700, optionsSource: "teams", requiresPhase: null },
      { id: "laliga-top4", label: "TOP 4", icon: "🥇", type: PICK_TYPES.RANKED, rankedSize: 4, pointsInSet: 100, pointsExact: 150, optionsSource: "teams", requiresPhase: null },
    ],
  },
  {
    id: "serie-a",
    name: "Serie A",
    tier: "league",
    phases: [
      { id: "seriea-winner", label: "Câștigătoare", icon: "🏆", type: PICK_TYPES.SINGLE, points: 700, optionsSource: "teams", requiresPhase: null },
      { id: "seriea-top4", label: "TOP 4", icon: "🥇", type: PICK_TYPES.RANKED, rankedSize: 4, pointsInSet: 100, pointsExact: 150, optionsSource: "teams", requiresPhase: null },
    ],
  },
  {
    id: "superliga",
    name: "SuperLiga",
    tier: "league",
    phases: [
      { id: "superliga-winner", label: "Câștigătoare", icon: "🏆", type: PICK_TYPES.SINGLE, points: 700, optionsSource: "teams", requiresPhase: null },
      {
        id: "superliga-top6",
        label: "Play-off — Locurile 1-6",
        icon: "🥇",
        type: PICK_TYPES.RANKED,
        rankedSize: 6,
        pointsInSet: 100, // echipa în Top 6, poziție greșită
        pointsExact: 150, // poziție exactă — NU se cumulează
        optionsSource: "teams",
        requiresPhase: null,
      },
      {
        id: "superliga-retro",
        label: "Retrogradare directă (15-16)",
        icon: "📉",
        type: PICK_TYPES.RANKED,
        rankedSize: 2, // exact locurile 15 și 16
        pointsInSet: 100, // echipa corectă, loc inversat
        pointsExact: 150, // loc exact — NU se cumulează
        optionsSource: "teams",
        requiresPhase: null,
      },
    ],
  },
];

// Index rapid: phaseId -> { competition, phase } — folosit peste tot ca
// să nu se caute manual prin array la fiecare citire.
const PHASE_INDEX = {};
SPECIAL_COMPETITIONS.forEach((comp) => {
  comp.phases.forEach((phase) => {
    PHASE_INDEX[phase.id] = { competition: comp, phase };
  });
});

export function getPhaseDefinition(phaseId) {
  return PHASE_INDEX[phaseId] || null;
}

export function getCompetitionDefinition(competitionId) {
  return SPECIAL_COMPETITIONS.find((c) => c.id === competitionId) || null;
}
