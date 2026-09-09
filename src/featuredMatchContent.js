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

  "liverpool|atletico-madrid": {
    formation: "Liverpool 4-3-3 · Atlético Madrid 4-4-2",
    probableLineup: {
      home: [
        { name: "Alisson", pos: "GK", x: 50, y: 88 },
        { name: "Kerkez", pos: "DF", x: 16, y: 68 },
        { name: "Van Dijk", pos: "DF", x: 38, y: 72 },
        { name: "Araújo", pos: "DF", x: 62, y: 72 },
        { name: "Jacquet", pos: "DF", x: 84, y: 68 },
        { name: "Szoboszlai", pos: "MF", x: 24, y: 48 },
        { name: "Mac Allister", pos: "MF", x: 50, y: 44 },
        { name: "Wirtz", pos: "MF", x: 76, y: 48 },
        { name: "Muñoz", pos: "FW", x: 20, y: 18 },
        { name: "Gakpo", pos: "FW", x: 50, y: 12 },
        { name: "Isak", pos: "FW", x: 80, y: 18 },
      ],
      away: [
        { name: "Oblak", pos: "GK", x: 50, y: 88 },
        { name: "Llorente", pos: "DF", x: 16, y: 68 },
        { name: "Pubill", pos: "DF", x: 39, y: 72 },
        { name: "Hancko", pos: "DF", x: 61, y: 72 },
        { name: "Grimaldo", pos: "DF", x: 84, y: 68 },
        { name: "Giuliano Simeone", pos: "MF", x: 12, y: 46 },
        { name: "Barrios", pos: "MF", x: 37, y: 42 },
        { name: "Hjulmand", pos: "MF", x: 63, y: 42 },
        { name: "Lookman", pos: "MF", x: 88, y: 46 },
        { name: "Kang-in Lee", pos: "FW", x: 35, y: 16 },
        { name: "Baena", pos: "FW", x: 65, y: 16 },
      ],
    },
    h2h: [
      { date: "17 SEP 2025", home: "Liverpool", away: "Atlético Madrid", score: "3-2" },
      { date: "03 NOV 2021", home: "Liverpool", away: "Atlético Madrid", score: "2-0" },
      { date: "19 OCT 2021", home: "Atlético Madrid", away: "Liverpool", score: "2-3" },
      { date: "11 MAR 2020", home: "Liverpool", away: "Atlético Madrid", score: "2-3", note: "d.p." },
    ],
    h2hSummary: "Liverpool a câștigat ultimele 3 întâlniri directe.",
    facts: [
      "🔥 Anfield și Atlético — Cele două echipe s-au întâlnit de cinci ori pe Anfield înaintea acestei seri. Liverpool a câștigat trei dintre aceste meciuri.",
      "⚔️ Amintiri grele pentru Liverpool — Pe 11 martie 2020, Atlético a câștigat cu 3-2 după prelungiri pe Anfield și a eliminat-o pe Liverpool din optimile Champions League. Marcos Llorente a marcat de două ori.",
      "🔴 Serie favorabilă Reds — Liverpool a câștigat ultimele trei confruntări cu Atlético: 3-2 la Madrid în 2021, 2-0 pe Anfield în 2021 și 3-2 pe Anfield în septembrie 2025.",
    ],
    stadium: { name: "Anfield", city: "Liverpool" },
  },

  "manchester-united|manchester-city": {
    formation: "Man United 4-2-3-1 · Man City 4-2-3-1",
    probableLineup: {
      home: [
        { name: "Lammens", pos: "GK", x: 50, y: 88 },
        { name: "Dalot", pos: "DF", x: 16, y: 68 },
        { name: "Maguire", pos: "DF", x: 39, y: 72 },
        { name: "Martínez", pos: "DF", x: 61, y: 72 },
        { name: "Shaw", pos: "DF", x: 84, y: 68 },
        { name: "Tielemans", pos: "MF", x: 35, y: 50 },
        { name: "Mainoo", pos: "MF", x: 65, y: 50 },
        { name: "Mbeumo", pos: "MF", x: 20, y: 28 },
        { name: "Fernandes", pos: "MF", x: 50, y: 24 },
        { name: "Rashford", pos: "MF", x: 80, y: 28 },
        { name: "Cunha", pos: "FW", x: 50, y: 12 },
      ],
      away: [
        { name: "Donnarumma", pos: "GK", x: 50, y: 88 },
        { name: "Khusanov", pos: "DF", x: 16, y: 68 },
        { name: "Dias", pos: "DF", x: 39, y: 72 },
        { name: "Guéhi", pos: "DF", x: 61, y: 72 },
        { name: "Gvardiol", pos: "DF", x: 84, y: 68 },
        { name: "Anderson", pos: "MF", x: 35, y: 50 },
        { name: "Enzo Fernández", pos: "MF", x: 65, y: 50 },
        { name: "Foden", pos: "MF", x: 20, y: 28 },
        { name: "Cherki", pos: "MF", x: 50, y: 24 },
        { name: "Semenyo", pos: "MF", x: 80, y: 28 },
        { name: "Haaland", pos: "FW", x: 50, y: 12 },
      ],
    },
    h2h: [
      { date: "17 IAN 2026", home: "Manchester United", away: "Manchester City", score: "2-0" },
      { date: "14 SEP 2025", home: "Manchester City", away: "Manchester United", score: "3-0" },
      { date: "06 APR 2025", home: "Manchester United", away: "Manchester City", score: "0-0" },
      { date: "15 DEC 2024", home: "Manchester City", away: "Manchester United", score: "1-2" },
    ],
    h2hSummary: "Ultimele 4 derby-uri de Premier League: United 2 victorii, City 1 victorie, 1 egal.",
    facts: [
      "🔥 Ultimul derby pe Old Trafford — Manchester United a câștigat cu 2-0 pe 17 ianuarie 2026. Este cea mai recentă întâlnire dintre cele două echipe înaintea acestui meci.",
      "🏙️ Un derby care s-a schimbat mult — În ultimele patru întâlniri de Premier League, United are două victorii, City una, iar un meci s-a terminat 0-0. City câștigase însă cu 3-0 derby-ul din septembrie 2025.",
      "⚔️ Old Trafford, din nou scena duelului — United și City se întâlnesc din nou la mai puțin de opt luni după victoria cu 2-0 a lui United pe același stadion.",
    ],
    stadium: { name: "Old Trafford", city: "Manchester" },
  },
};

// ── Întoarce conținutul editorial al unui meci, sau null dacă încă
// n-a fost pregătit local pentru el — apelantul (FeaturedMatchScreen)
// trebuie să gestioneze null cu grație (secțiuni goale/ascunse), nu să
// crape ecranul. ──
export function getFeaturedMatchContent(homeTeam, awayTeam) {
  return FEATURED_MATCH_CONTENT[featuredContentKey(homeTeam, awayTeam)] || null;
}
