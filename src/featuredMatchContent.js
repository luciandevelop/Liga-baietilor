import { slugify } from "./utils/slugify";

// ══════════════════════════════════════════════════════════════════
// Conținut editorial pentru ⭐ Meciul Săptămânii — STRICT local/offline.
// Zero Firestore, zero API-Football. Editabil direct aici, de tine sau
// de mine, oricând, fără nicio schemă/colecție nouă.
//
// Cheia NU e ID-ul Firestore al meciului (ar trebui să-l cauți în
// consolă de fiecare dată) — e o combinație "echipaGazdă|echipaOaspete",
// normalizată cu ACEEAȘI funcție slugify() deja folosită în tot
// proiectul pentru sigle. Se calculează automat din homeTeam/awayTeam
// ale meciului — tu doar adaugi intrarea, cu numele echipelor exact
// cum apar în Admin la crearea meciului.
//
// STRUCTURĂ PREGĂTITĂ PENTRU VIITOR (cerut explicit): fiecare intrare
// are `probableLineup` — dacă vreodată decidem să expunem lineup-ul
// OFICIAL în starea comună (matchesStore), FeaturedMatchScreen știe
// deja să prefere `officialLineup` peste `probableLineup`, dacă un
// obiect e transmis din exterior (vezi FeaturedMatchScreen.jsx) — NU
// e nevoie să schimbi nimic aici pentru asta, doar să completezi acel
// mecanism separat, altă dată.
// ══════════════════════════════════════════════════════════════════

export function featuredContentKey(homeTeam, awayTeam) {
  return `${slugify(homeTeam)}|${slugify(awayTeam)}`;
}

export const FEATURED_MATCH_CONTENT = {
  // Exemplu, completează cu meciurile reale ale săptămânii curente.
  // "real-madrid|inter": {
  //   formation: "4-3-3",
  //   probableLineup: {
  //     home: [
  //       { name: "Courtois", pos: "GK", x: 50, y: 88 },
  //       { name: "Carvajal", pos: "DF", x: 18, y: 68 },
  //       { name: "Rüdiger", pos: "DF", x: 39, y: 71 },
  //       { name: "Militão", pos: "DF", x: 61, y: 71 },
  //       { name: "Mendy", pos: "DF", x: 82, y: 68 },
  //       { name: "Tchouaméni", pos: "MF", x: 28, y: 49 },
  //       { name: "Valverde", pos: "MF", x: 50, y: 45 },
  //       { name: "Bellingham", pos: "MF", x: 72, y: 49 },
  //       { name: "Vinícius", pos: "FW", x: 20, y: 20 },
  //       { name: "Mbappé", pos: "FW", x: 50, y: 13 },
  //       { name: "Rodrygo", pos: "FW", x: 80, y: 20 },
  //     ],
  //     away: [ /* aceeași structură, 11 jucători */ ],
  //   },
  //   form: { home: ["W", "W", "D", "W", "L"], away: ["W", "W", "W", "L", "W"] },
  //   h2h: [
  //     { home: "Real Madrid", away: "Inter", score: "2-0" },
  //     { home: "Inter", away: "Real Madrid", score: "1-1" },
  //     { home: "Real Madrid", away: "Inter", score: "3-2" },
  //   ],
  //   facts: [
  //     "Ultima finală UCL a fost exact Real Madrid – Inter, în 1964.",
  //     "Mbappé n-a marcat niciodată împotriva unei echipe italiene în UCL.",
  //   ],
  //   stadium: { name: "Santiago Bernabéu", city: "Madrid", capacity: 78297, note: "Renovat complet în 2024, cu acoperiș retractabil." },
  // },
};

// ── Întoarce conținutul editorial al unui meci, sau null dacă încă
// n-a fost pregătit local pentru el — apelantul (FeaturedMatchScreen)
// trebuie să gestioneze null cu grație (secțiuni goale/ascunse), nu să
// crape ecranul. ──
export function getFeaturedMatchContent(homeTeam, awayTeam) {
  return FEATURED_MATCH_CONTENT[featuredContentKey(homeTeam, awayTeam)] || null;
}
