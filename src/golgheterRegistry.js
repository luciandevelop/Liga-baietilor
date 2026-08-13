// ══════════════════════════════════════════════════════════════════
// GOLGHETER — top 10 favoriți pentru sezonul de Champions League
// curent (2026/27), cercetați acum (nu inventați): combinație din
// board-ul real de pariuri "Champions League Top Goalscorer Odds
// 2026/27" + istoricul de golgheteri UEFA din ultimele sezoane.
// Filtrat STRICT la jucători ale căror echipe sunt deja confirmate în
// cele 29 calificate direct în league phase (CL_LEAGUE_PHASE_TEAMS) —
// un jucător de la o echipă încă în play-off (sau eliminată) nu apare
// aici, la fel cum echipele din play-off nu apar la Câștigătoare.
//
// Fiecare opțiune are `club` (numele exact al clubului, pentru logo —
// aceeași convenție ca la echipe: getClubLogo îl slugifică la runtime).
// ══════════════════════════════════════════════════════════════════

function player(id, label, club) {
  return { id, label, club };
}

export const GOLGHETER_ID = "cl-golgheter";

// CORECTAT — Lewandowski a fost inclus greșit inițial la Barcelona; a
// plecat de la finalul sezonului 2025/26, semnat cu Chicago Fire (MLS)
// din 29 iunie 2026, deci nu mai e eligibil pentru Champions League.
// Verificat explicit acum, nu presupus.
export const GOLGHETER_FAVORITES = [
  player("mbappe", "Kylian Mbappé", "Real Madrid"),
  player("haaland", "Erling Haaland", "Manchester City"),
  player("kane", "Harry Kane", "Bayern München"),
  player("osimhen", "Victor Osimhen", "Galatasaray"),
  player("gyokeres", "Viktor Gyökeres", "Arsenal"),
  player("isak", "Alexander Isak", "Liverpool"),
  player("kvaratskhelia", "Khvicha Kvaratskhelia", "Paris Saint-Germain"),
  player("vinicius", "Vinícius Júnior", "Real Madrid"),
  player("dembele", "Ousmane Dembélé", "Paris Saint-Germain"),
  player("alvarez", "Julián Álvarez", "Atlético Madrid"),
];

// Marcaj universal "oricare alt jucător decât favoriții" — aceeași idee
// ca ALTA_OPTION de la echipe, id fix, recunoscut direct de scorare
// (computeSpecialPoints tratează asta ca orice altă opțiune validă —
// nimic special-cazat).
export const ALTUL_OPTION_ID = "altul";
export const ALTUL_OPTION = { id: ALTUL_OPTION_ID, label: "ORICARE ALTUL", club: null };

export function resolveGolgheterOptions() {
  return [...GOLGHETER_FAVORITES, ALTUL_OPTION];
}
