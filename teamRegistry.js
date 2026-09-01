// ══════════════════════════════════════════════════════════════════
// REGISTRUL DE ECHIPE — Specialele Sezonului. Motivul acestui fișier
// (cerut explicit): "PSG" vs "Paris Saint-Germain" vs greșeli de scriere
// nu trebuie NICIODATĂ să conteze la scorare. Fiecare echipă are un id
// stabil (slug), folosit identic peste tot: lista de opțiuni, pick-ul
// userului, răspunsul corect introdus de admin, scorarea, afișarea.
//
// id-ul e ales să coincidă cu slug-ul din assets/clubs (același sistem
// de logo-uri pe care-l folosește restul aplicației la meciuri) — dacă
// echipa are logo în pachet, apare automat; dacă nu, cade pe fallback
// cu inițială (comportament deja existent, nu unul nou).
//
// Actualizare sezon viitor: se editează STRICT listele de mai jos —
// niciun ecran, niciun component nu se schimbă.
// ══════════════════════════════════════════════════════════════════
import { CL_TOP_SCORER_OPTIONS } from "./src/specialDefinitions.js";

function team(id, label) {
  return { id, label };
}

// ── Champions League — toate cele 36 de echipe din league phase
// 2026/27, confirmate: 29 calificate direct + 7 câștigătoare din
// play-off (Sabah, LASK, Bodø/Glimt, AEK Athens, Viking, Slovan
// Bratislava, Fenerbahçe — confirmate din sursă UEFA, 26 august 2026).
// Predicțiile deja salvate pe cele 29 rămân valide — lista doar
// SE COMPLETEAZĂ, niciun id existent nu se schimbă. ──
export const CL_LEAGUE_PHASE_TEAMS = [
  team("arsenal", "Arsenal"),
  team("barcelona", "Barcelona"),
  team("real-madrid", "Real Madrid"),
  team("bayern-munchen", "Bayern München"),
  team("psv", "PSV Eindhoven"),
  team("inter", "Inter"),
  team("manchester-city", "Manchester City"),
  team("borussia-dortmund", "Borussia Dortmund"),
  team("manchester-united", "Manchester United"),
  team("fc-porto", "Porto"),
  team("paris-saint-germain", "Paris Saint-Germain"),
  team("villarreal", "Villarreal"),
  team("atletico-madrid", "Atlético Madrid"),
  team("real-betis", "Real Betis"),
  team("rb-leipzig", "RB Leipzig"),
  team("lens", "Lens"),
  team("feyenoord", "Feyenoord"),
  team("galatasaray", "Galatasaray"),
  team("shakhtar", "Shakhtar Donetsk"),
  team("slavia-prague", "Slavia Prague"),
  team("aston-villa", "Aston Villa"),
  team("vfb-stuttgart", "Stuttgart"),
  team("napoli", "Napoli"),
  team("lille", "Lille"),
  team("club-brugge", "Club Brugge"),
  team("liverpool", "Liverpool"),
  team("sporting-cp", "Sporting CP"),
  team("roma", "Roma"),
  team("como-1907", "Como"),
  // ── cele 7 din play-off, adăugate acum ──
  team("sabah-baku", "Sabah FK"),
  team("lask", "LASK"),
  team("bodo-glimt", "Bodø/Glimt"),
  team("aek-athens", "AEK Athens"),
  team("viking", "Viking FK"),
  team("slovan-bratislava", "Slovan Bratislava"),
  team("fenerbahce", "Fenerbahçe"),
];

// ── Europa League — toate cele 36 de echipe din league phase 2026/27,
// confirmate din sursă UEFA. Lista ÎNLOCUIEȘTE modelul vechi de
// "10 favorite + ALTA" — cerut explicit acum (Câștigătoare EL folosește
// toate participantele, la fel ca Champions League, nu doar favorite). ──
export const EL_TEAMS = [
  team("ararat-armenia", "Ararat-Armenia"),
  team("salzburg", "Salzburg"),
  team("sturm-graz", "Sturm Graz"),
  team("anderlecht", "Anderlecht"),
  team("union-sg", "Union SG"),
  team("levski-sofia", "Levski Sofia"),
  team("dinamo-zagreb", "GNK Dinamo"),
  team("omonia", "Omonia"),
  team("sparta-praha", "Sparta Praha"),
  team("viktoria-plzen", "Viktoria Plzeň"),
  team("bournemouth", "Bournemouth"),
  team("crystal-palace", "Crystal Palace"),
  team("sunderland", "Sunderland"),
  team("lyon", "Lyon"),
  team("marseille", "Marseille"),
  team("rennes", "Rennes"),
  team("hoffenheim", "Hoffenheim"),
  team("bayer-leverkusen", "Bayer Leverkusen"),
  team("ofi-crete", "OFI Crete"),
  team("olympiacos", "Olympiacos"),
  team("ferencvaros", "Ferencváros"),
  team("hapoel-beer-sheva", "Hapoel Beer-Sheva"),
  team("milan", "Milan"),
  team("juventus", "Juventus"),
  team("az-alkmaar", "AZ Alkmaar"),
  team("nec", "N.E.C."),
  team("lillestrom", "Lillestrøm"),
  team("jagiellonia", "Jagiellonia"),
  team("lech-poznan", "Lech Poznań"),
  team("benfica", "Benfica"),
  team("torreense", "Torreense"),
  team("celtic", "Celtic"),
  team("celje", "Celje"),
  team("real-sociedad", "Real Sociedad"),
  team("celta", "Celta Vigo"),
  team("besiktas", "Beşiktaş"),
];

// ── Conference League — 15 favorite + "ALTA" (opțiune reală de
// scorare — vezi computeSpecialPoints din specialsService.js). Lista
// dată explicit acum, înlocuiește complet lista veche de 10. ──
export const UECL_FAVORITES = [
  team("brighton", "Brighton"),
  team("atalanta", "Atalanta"),
  team("freiburg", "Freiburg"),
  team("as-monaco", "AS Monaco"),
  team("braga", "Braga"),
  team("ajax", "Ajax"),
  team("midtjylland", "Midtjylland"),
  team("fc-copenhagen", "FC Copenhagen"),
  team("crvena-zvezda", "Crvena Zvezda"),
  team("getafe", "Getafe"),
  team("gent", "Gent"),
  team("panathinaikos", "Panathinaikos"),
  team("twente", "Twente"),
  team("lugano", "Lugano"),
  team("pafos", "Pafos"),
];

// Marcaj universal "altă echipă decât favoritele" — id fix, recunoscut
// direct de scorare (vezi computeSpecialPoints din specialsService.js).
export const ALTA_OPTION_ID = "alta";
export const ALTA_OPTION = { id: ALTA_OPTION_ID, label: "ALTA ECHIPĂ" };

// ── Campionate naționale — liste complete, 2026/27, verificate. ──
export const PREMIER_LEAGUE_TEAMS = [
  team("arsenal", "Arsenal"), team("aston-villa", "Aston Villa"), team("bournemouth", "Bournemouth"),
  team("brentford", "Brentford"), team("brighton", "Brighton"), team("chelsea", "Chelsea"),
  team("coventry-city", "Coventry City"), team("crystal-palace", "Crystal Palace"), team("everton", "Everton"),
  team("fulham", "Fulham"), team("hull-city", "Hull City"), team("ipswich", "Ipswich Town"),
  team("leeds-united", "Leeds United"), team("liverpool", "Liverpool"), team("manchester-city", "Manchester City"),
  team("manchester-united", "Manchester United"), team("newcastle", "Newcastle"), team("nottingham-forest", "Nottingham Forest"),
  team("sunderland", "Sunderland"), team("tottenham", "Tottenham"),
];

export const LA_LIGA_TEAMS = [
  team("barcelona", "Barcelona"), team("real-madrid", "Real Madrid"), team("atletico-madrid", "Atlético Madrid"),
  team("athletic-club", "Athletic Bilbao"), team("villarreal", "Villarreal"), team("real-betis", "Real Betis"),
  team("celta", "Celta Vigo"), team("rayo-vallecano", "Rayo Vallecano"), team("osasuna", "Osasuna"),
  team("real-sociedad", "Real Sociedad"), team("sevilla", "Sevilla"), team("getafe", "Getafe"),
  team("espanyol", "Espanyol"), team("alaves", "Alavés"), team("valencia", "Valencia"),
  team("levante", "Levante"), team("elche", "Elche"), team("racing", "Racing Santander"),
  team("deportivo-la-coruna", "Deportivo La Coruña"), team("malaga", "Málaga"),
];

export const SERIE_A_TEAMS = [
  team("atalanta", "Atalanta"), team("bologna", "Bologna"), team("cagliari", "Cagliari"),
  team("como-1907", "Como"), team("fiorentina", "Fiorentina"), team("genoa", "Genoa"),
  team("inter", "Inter"), team("juventus", "Juventus"), team("lazio", "Lazio"),
  team("lecce", "Lecce"), team("milan", "Milan"), team("napoli", "Napoli"),
  team("parma", "Parma"), team("roma", "Roma"), team("sassuolo", "Sassuolo"),
  team("torino", "Torino"), team("udinese", "Udinese"), team("venezia", "Venezia"),
  team("frosinone", "Frosinone"), team("monza", "Monza"),
];

export const SUPERLIGA_TEAMS = [
  team("fcsb", "FCSB"), team("cfr-cluj", "CFR Cluj"), team("u-craiova", "Universitatea Craiova"),
  team("u-cluj", "Universitatea Cluj"), team("rapid-bucuresti", "Rapid București"), team("dinamo-bucuresti", "Dinamo București"),
  team("farul-constanta", "Farul Constanța"), team("uta", "UTA Arad"), team("botosani", "Botoșani"),
  team("petrolul-ploiesti", "Petrolul Ploiești"), team("otelul", "Oțelul Galați"), team("csikszereda", "Csikszereda"),
  team("arges-pitesti", "FC Argeș"), team("corvinul-hunedoara", "Corvinul Hunedoara"), team("sepsi", "Sepsi OSK"),
  team("voluntari", "FC Voluntari"),
];

// ── Rezolvă lista de opțiuni pentru o fază, după `optionsSource` din
// specialDefinitions.js — SINGURUL loc care știe "ce înseamnă teams
// pentru fiecare competiție". Adăugarea unei competiții noi (Mondial,
// EURO) = un nou `case` aici, nimic altundeva. ──
export function resolveTeamOptions(competitionId, phaseId) {
  // Fazele cu candidați JUCĂTORI (nu echipe) — verificate ÎNTÂI, altfel
  // "cl-golgheter" cădea pe case-ul "uefa-champions-league" și butonul
  // de pre-completare umplea greșit cu cele 36 de echipe, nu cei 15
  // jucători. Bug găsit și reparat acum.
  if (phaseId === "cl-golgheter") return CL_TOP_SCORER_OPTIONS;

  switch (competitionId) {
    case "uefa-champions-league":
      return CL_LEAGUE_PHASE_TEAMS;
    case "uefa-europa-league":
      return EL_TEAMS;
    case "uefa-conference-league":
      return [...UECL_FAVORITES, ALTA_OPTION];
    case "english-premier-league":
      return PREMIER_LEAGUE_TEAMS;
    case "la-liga":
      return LA_LIGA_TEAMS;
    case "serie-a":
      return SERIE_A_TEAMS;
    case "superliga":
      return SUPERLIGA_TEAMS;
    default:
      return [];
  }
}
