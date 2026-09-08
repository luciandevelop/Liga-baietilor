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
  "real-madrid|inter": {
    formation: "Real Madrid 4-3-3 · Inter 3-5-2",
    probableLineup: {
      home: [
        { name: "Courtois", pos: "GK", x: 50, y: 88 },
        { name: "Cucurella", pos: "DF", x: 16, y: 68 },
        { name: "Huijsen", pos: "DF", x: 38, y: 72 },
        { name: "Konaté", pos: "DF", x: 62, y: 72 },
        { name: "Dumfries", pos: "DF", x: 84, y: 68 },
        { name: "Alexander-Arnold", pos: "MF", x: 24, y: 48 },
        { name: "Valverde", pos: "MF", x: 50, y: 44 },
        { name: "Bellingham", pos: "MF", x: 76, y: 48 },
        { name: "Brahim Díaz", pos: "FW", x: 20, y: 18 },
        { name: "Mbappé", pos: "FW", x: 50, y: 12 },
        { name: "Vinícius Jr", pos: "FW", x: 80, y: 18 },
      ],
      away: [
        { name: "Martínez", pos: "GK", x: 50, y: 88 },
        { name: "Bastoni", pos: "DF", x: 24, y: 70 },
        { name: "Bisseck", pos: "DF", x: 50, y: 74 },
        { name: "Pavard", pos: "DF", x: 76, y: 70 },
        { name: "Carlos Augusto", pos: "MF", x: 10, y: 48 },
        { name: "Jones", pos: "MF", x: 31, y: 45 },
        { name: "Çalhanoğlu", pos: "MF", x: 50, y: 41 },
        { name: "Barella", pos: "MF", x: 69, y: 45 },
        { name: "Diouf", pos: "MF", x: 90, y: 48 },
        { name: "Thuram", pos: "FW", x: 35, y: 16 },
        { name: "Lautaro Martínez", pos: "FW", x: 65, y: 16 },
      ],
    },
    h2h: [
      { home: "Real Madrid", away: "Inter", score: "2-0" },
      { home: "Inter", away: "Real Madrid", score: "0-1" },
      { home: "Inter", away: "Real Madrid", score: "0-2" },
      { home: "Real Madrid", away: "Inter", score: "3-2" },
    ],
    h2hSummary: "Real Madrid a câștigat ultimele 4 întâlniri directe.",
    facts: [
      "🏆 Mourinho, din nou față în față cu Inter — José Mourinho a câștigat Champions League cu Inter în 2010. Finala s-a jucat chiar pe Santiago Bernabéu. Cristian Chivu făcea parte din echipa lui Mourinho, iar acum cei doi sunt adversari de pe băncile Realului și Interului.",
      "🏟️ Bernabéu nu-i priește lui Inter — Real Madrid a câștigat ultimele 7 meciuri de acasă împotriva lui Inter, patru dintre ele fără gol primit.",
      "🔥 Un duel cu istorie — Real Madrid și Inter s-au întâlnit de 19 ori în competițiile europene. Real are 10 victorii, Inter 7, iar două meciuri s-au terminat la egalitate.",
    ],
    stadium: { name: "Santiago Bernabéu", city: "Madrid" },
  },
};

// ── Întoarce conținutul editorial al unui meci, sau null dacă încă
// n-a fost pregătit local pentru el — apelantul (FeaturedMatchScreen)
// trebuie să gestioneze null cu grație (secțiuni goale/ascunse), nu să
// crape ecranul. ──
export function getFeaturedMatchContent(homeTeam, awayTeam) {
  return FEATURED_MATCH_CONTENT[featuredContentKey(homeTeam, awayTeam)] || null;
}
