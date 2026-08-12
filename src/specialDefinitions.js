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

// ── Competiții — id-ul trebuie să existe și în competitionThemes.js
// (logo/culoare), altfel cardul cade pe fallback generic acolo, nu aici.
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
    ],
  },
  {
    id: "uefa-conference-league",
    name: "Conference League",
    tier: "secondary",
    phases: [
      { id: "ecl-winner", label: "Câștigătoare Conference League", icon: "🏆", type: PICK_TYPES.SINGLE, points: 500, optionsSource: "teams", requiresPhase: null },
    ],
  },
  {
    id: "english-premier-league",
    name: "Premier League",
    tier: "league",
    phases: [
      { id: "epl-winner", label: "Câștigătoare", icon: "🏆", type: PICK_TYPES.SINGLE, points: 700, optionsSource: "teams", requiresPhase: null },
    ],
  },
  {
    id: "la-liga",
    name: "LaLiga",
    tier: "league",
    phases: [
      { id: "laliga-winner", label: "Câștigătoare", icon: "🏆", type: PICK_TYPES.SINGLE, points: 700, optionsSource: "teams", requiresPhase: null },
    ],
  },
  {
    id: "serie-a",
    name: "Serie A",
    tier: "league",
    phases: [
      { id: "seriea-winner", label: "Câștigătoare", icon: "🏆", type: PICK_TYPES.SINGLE, points: 700, optionsSource: "teams", requiresPhase: null },
    ],
  },
  {
    id: "superliga",
    name: "SuperLiga",
    tier: "league",
    phases: [
      { id: "superliga-winner", label: "Câștigătoare", icon: "🏆", type: PICK_TYPES.SINGLE, points: 700, optionsSource: "teams", requiresPhase: null },
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
