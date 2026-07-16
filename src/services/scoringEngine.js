// ── Motor de scoring — funcții PURE, fără efecte secundare ──────────
// Nu ating Firestore aici deloc. Testabile independent, apelate din
// adminService.computeGameweekResults la calcularea/finalizarea etapei.

// Scor principal, pe niveluri MUTUAL EXCLUSIVE — se ia doar cel mai bun
// nivel aplicabil, niciodată cumulat.
export function computeMainScore(predA, predB, realA, realB) {
  if (predA === realA && predB === realB) return 120;

  const predDiff = predA - predB;
  const realDiff = realA - realB;
  const predResult = Math.sign(predDiff); // -1 oaspeți, 0 egal, 1 gazde
  const realResult = Math.sign(realDiff);

  if (predResult === realResult) {
    // Rezultat 1/X/2 corect — verificăm dacă și diferența e corectă.
    return predDiff === realDiff ? 70 : 50;
  }

  // Rezultat greșit — ultima șansă: totalul de goluri corect.
  return predA + predB === realA + realB ? 20 : 0;
}

// Tabel generic diferență-absolută → puncte, folosit identic pentru
// cornere și cartonașe (praguri diferite).
function scoreByAbsDiff(predVal, realVal, table) {
  if (predVal === undefined || predVal === null) return 0; // component neprezisă = 0p, nu invalidează meciul
  if (realVal === undefined || realVal === null) return 0; // fără rezultat real pentru componentă = 0p
  const diff = Math.abs(predVal - realVal);
  for (const [maxDiff, points] of table) {
    if (diff <= maxDiff) return points;
  }
  return 0;
}

const CORNERS_TABLE = [
  [0, 15],
  [1, 10],
  [2, 5],
  [3, 2],
];
const CARDS_TABLE = [
  [0, 15],
  [1, 10],
  [2, 5],
];

export function computeCornersScore(predCorners, realCorners) {
  return scoreByAbsDiff(predCorners, realCorners, CORNERS_TABLE);
}

export function computeCardsScore(predCards, realCards) {
  return scoreByAbsDiff(predCards, realCards, CARDS_TABLE);
}

// Punctajul TOTAL pentru un meci + o predicție, cu multiplicator aplicat
// la finalul sumei (nu pe componente separat). Multiplicatorul e 2 dacă
// meciul e Meci al Săptămânii SAU Joker-ul userului — niciodată x4 (cele
// două sunt deja mutual exclusive, impus la nivel de Firestore Rules în
// Livrarea 1: un Joker nu poate fi ales pe un meci deja featured).
// Întoarce null dacă nu există predicție validă sau rezultat real încă.
export function computeMatchPoints({ prediction, match, isFeatured, isJoker }) {
  if (!prediction || prediction.scoreA === undefined || prediction.scoreA === null) return null;
  if (prediction.scoreB === undefined || prediction.scoreB === null) return null;
  if (match.realScoreA === undefined || match.realScoreA === null) return null;
  if (match.realScoreB === undefined || match.realScoreB === null) return null;

  const mainScore = computeMainScore(prediction.scoreA, prediction.scoreB, match.realScoreA, match.realScoreB);
  const cornersScore = computeCornersScore(prediction.corners, match.realCorners);
  const cardsScore = computeCardsScore(prediction.cards, match.realCards);
  const base = mainScore + cornersScore + cardsScore;
  const multiplier = isFeatured || isJoker ? 2 : 1;
  const total = base * multiplier;

  return { mainScore, cornersScore, cardsScore, base, multiplier, total };
}

// Bonus/penalizare de poziție, cu regulă olimpică (egalitate = punctaj
// întreg pentru toți de la acel loc) ȘI protecție defensivă pentru
// grupuri mici, unde pozițiile de top s-ar suprapune cu cele de jos.
//
// Regulă defensivă exactă (grupuri mici):
// 1) Se calculează rangul standard de competiție (1,1,3,4… la egalități).
// 2) Locurile 1/2/3 primesc mereu bonusul lor, DACĂ acel rang există.
// 3) Locul "ultimul" (rangul maxim) primește -150 — DAR NUMAI dacă acel
//    rang nu a fost deja premiat la pasul 2 (evită contradicția "locul 3
//    ȘI ultimul" când sunt doar 3 jucători, caz în care doar bonusul
//    pozitiv se aplică, penalizarea se omite).
// 4) Locul "penultimul" (al doilea cel mai slab rang distinct) primește
//    -50 — doar dacă nu s-a atins deja de pașii 2 sau 3.
// Cu 3 jucători fără egalități: toți 3 primesc bonus pozitiv (300/150/100),
// nimeni nu e penalizat — nu există contradicție posibilă.
// Cu 2 jucători: la fel, ambele ranguri (1,2) intră în plaja premiată
// 1/2/3, deci ambii primesc bonus pozitiv (300/150) — nimeni penalizat,
// pentru că nu există un rang "liber" sub locul 3 de penalizat.
export function computeRankingBonuses(rows) {
  const sorted = [...rows].sort((a, b) => b.pointsFromMatches - a.pointsFromMatches);

  let rank = 0;
  let prevPoints = null;
  const ranked = sorted.map((r, i) => {
    if (prevPoints === null || r.pointsFromMatches !== prevPoints) {
      rank = i + 1;
      prevPoints = r.pointsFromMatches;
    }
    return { ...r, rank };
  });

  const distinctRanksAsc = [...new Set(ranked.map((r) => r.rank))].sort((a, b) => a - b);
  const bonusByRank = {};

  if (distinctRanksAsc.includes(1)) bonusByRank[1] = 300;
  if (distinctRanksAsc.includes(2)) bonusByRank[2] = 150;
  if (distinctRanksAsc.includes(3)) bonusByRank[3] = 100;

  const unclaimed = distinctRanksAsc.filter((r) => !(r in bonusByRank));
  if (unclaimed.length > 0) {
    const lastRank = Math.max(...unclaimed);
    bonusByRank[lastRank] = -150;

    const remaining = unclaimed.filter((r) => r !== lastRank);
    if (remaining.length > 0) {
      const penultimateRank = Math.max(...remaining);
      bonusByRank[penultimateRank] = -50;
    }
  }

  return ranked.map((r) => ({ ...r, rankingBonus: bonusByRank[r.rank] || 0 }));
}
