// Separarea definitivă cerută: PROVOCĂRI (moduri de joc, pe etapă) vs
// EVENIMENTE (pariuri pe termen lung, pe sezon/turneu). Doar infrastructura
// de date — nicio grafică/ecran nou legat de asta în acest sprint.
export const PROVOCARI = [
  { id: "zaruri", name: "Zaruri" },
  { id: "dueluri", name: "Dueluri" },
  { id: "2v2", name: "2 vs 2" },
  { id: "half-time", name: "Half Time" },
  { id: "survivor", name: "Survivor" },
  { id: "joker", name: "Joker" },
];

export const EVENIMENTE = [
  { id: "campioana-champions-league", name: "Campioana Champions League" },
  { id: "campioana-europa-league", name: "Campioana Europa League" },
  { id: "campioana-conference-league", name: "Campioana Conference League" },
  { id: "campioana-campionatelor", name: "Campioana fiecărui campionat" },
  { id: "balonul-de-aur", name: "Balonul de Aur" },
  { id: "golgheter", name: "Golgheter" },
];
