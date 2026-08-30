// ══════════════════════════════════════════════════════════════════
// INTERNAL FACTS ENGINE — pur, din date reale (predicții, matchPoints,
// clasament). NICIODATĂ internet, NICIODATĂ inventat. Fiecare funcție
// întoarce fie un fapt (dacă datele îl susțin), fie null (dacă nu avem
// destule date sau faptul n-ar avea sens) — nu completează cu ghiciri.
// ══════════════════════════════════════════════════════════════════
import { IMPORTANCE, TYPE, hashSeed, pick } from "./feedEngine";
import { canRevealPredictions } from "./matchLockRule";

// ── GUARD CENTRAL — orice funcție de mai jos care citește predicțiile
// ALTOR jucători îl cheamă PE EA ÎNSĂȘI (defense in depth, cerut
// explicit), nu se bazează pe faptul că apelantul o invocă la momentul
// potrivit. Dacă meciul nu e încă blocat, funcția refuză singură,
// necondiționat — indiferent ce date i se dau. ──
export function buildPredictionDistributionFact(match, predictions) {
  if (!canRevealPredictions(match)) return null;
  if (predictions.length < 3) return null; // prea puține, nu-i un "fapt" relevant
  const homeCount = predictions.filter((p) => p.scoreA > p.scoreB).length;
  const drawCount = predictions.filter((p) => p.scoreA === p.scoreB).length;
  const awayCount = predictions.filter((p) => p.scoreA < p.scoreB).length;
  const total = predictions.length;

  const scoreKey = (p) => `${p.scoreA}-${p.scoreB}`;
  const scoreCounts = {};
  predictions.forEach((p) => { const k = scoreKey(p); scoreCounts[k] = (scoreCounts[k] || 0) + 1; });
  const popularScore = Object.entries(scoreCounts).sort((a, b) => b[1] - a[1])[0];

  const id = `fact_predist_${match.id}`;
  let title;
  if (homeCount === total) {
    title = pick([`👀 Toată lumea (${total}/${total}) merge pe ${match.homeTeam}.`], id);
  } else if (awayCount === total) {
    title = pick([`👀 Toată lumea (${total}/${total}) merge pe ${match.awayTeam}.`], id);
  } else if (drawCount === total) {
    title = `🧠 Toată lumea a pronosticat egal la ${match.homeTeam} – ${match.awayTeam}.`;
  } else if (homeCount === 1 || awayCount === 1 || drawCount === 1) {
    const loneVoter = homeCount === 1 ? predictions.find((p) => p.scoreA > p.scoreB)
      : awayCount === 1 ? predictions.find((p) => p.scoreA < p.scoreB)
      : predictions.find((p) => p.scoreA === p.scoreB);
    title = pick([
      `🐺 ${loneVoter.nickname} merge singur împotriva tuturor la ${match.homeTeam} – ${match.awayTeam}.`,
      `🧠 Doar ${loneVoter.nickname} vede altfel ${match.homeTeam} – ${match.awayTeam}.`,
    ], id);
  } else {
    const majority = Math.max(homeCount, drawCount, awayCount);
    const majorityLabel = majority === homeCount ? match.homeTeam : majority === awayCount ? match.awayTeam : "egal";
    title = pick([`👀 ${majority}/${total} merg pe ${majorityLabel} la ${match.homeTeam} – ${match.awayTeam}.`], id);
  }

  return {
    id, type: TYPE.PREDICTION, subtype: "distribution", ts: Date.now(),
    importance: IMPORTANCE.FACT_INTERNAL, actors: [], version: 2,
    metadata: { matchId: match.id, homeCount, drawCount, awayCount, total, popularScore: popularScore ? popularScore[0] : null },
    narrativeKey: id, icon: "fun", important: false,
    title,
    subtitle: popularScore && popularScore[1] > 1 ? `Scorul cel mai popular: ${popularScore[0]} (${popularScore[1]} jucători)` : null,
    category: "fun", priority: IMPORTANCE.FACT_INTERNAL,
    detail: { matchId: match.id },
  };
}

// ── Nimeni n-a nimerit / mulți au nimerit — separat de cardul de meci
// final (acela e despre REZULTAT, asta e despre cât de "surprinzător" a
// fost pentru grup). Se generează DOAR dacă are sens: 0 din N sau
// procent mare din N. ──
export function buildSurpriseFact(match, allPredictionsForMatch, exactCount) {
  if (!canRevealPredictions(match)) return null;
  const total = allPredictionsForMatch.length;
  if (total < 4) return null;
  const id = `fact_surprise_${match.id}`;
  if (exactCount === 0) {
    return {
      id, type: TYPE.FACT, subtype: "no_exact", ts: Date.now(), importance: IMPORTANCE.FACT_INTERNAL,
      actors: [], version: 2, metadata: { matchId: match.id, total },
      narrativeKey: id, icon: "fun", important: false,
      title: pick([
        `Nimeni n-a nimerit ${match.realScoreA}–${match.realScoreB}. Rezultat surpriză pentru toată lumea.`,
        `${match.realScoreA}–${match.realScoreB} — scor pe care nu l-a ales nimeni.`,
        `Zero scoruri exacte la ${match.realScoreA}–${match.realScoreB}. Meciul a păcălit pe toată lumea.`,
        `Niciun clarvăzător de data asta — ${match.realScoreA}–${match.realScoreB} a scăpat tuturor.`,
        `${match.realScoreA}–${match.realScoreB} n-a fost în mintea nimănui.`,
        `Toată Liga a ratat scorul exact: ${match.realScoreA}–${match.realScoreB}.`,
        `Un rezultat pe care nimeni nu l-a văzut venind: ${match.realScoreA}–${match.realScoreB}.`,
        `${match.realScoreA}–${match.realScoreB} — 0 din toți. Meciul ăsta a fost imprevizibil.`,
      ], id),
      category: "fun", priority: IMPORTANCE.FACT_INTERNAL, detail: { matchId: match.id },
    };
  }
  return null;
}

// ── Cine are cele mai multe scoruri exacte ÎN ETAPA ASTA — din
// matchPoints ale userilor activi, pentru meciurile deja Final ale
// etapei curente. Se generează doar dacă cineva are 2+ (1 singur nu-i
// un "fapt", e normal). ──
export function buildTopExactScorerFact(gameweekId, matchPointsRows) {
  const countByUid = {};
  matchPointsRows.forEach((mp) => { if (mp.scorePoints === 120) countByUid[mp.uid] = (countByUid[mp.uid] || 0) + 1; });
  const entries = Object.entries(countByUid).filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  const [uid, count] = entries[0];
  const id = `fact_topexact_${gameweekId}_${uid}`;
  return {
    id, type: TYPE.FACT, subtype: "top_exact_scorer", ts: Date.now(), importance: IMPORTANCE.FACT_INTERNAL,
    actors: [uid], version: 2, metadata: { uid, count, gameweekId },
    narrativeKey: id, icon: "fun", important: false,
    title: null, // nickname rezolvat de apelant (are nevoie de profil) — vezi feedService.js
    category: "fun", priority: IMPORTANCE.FACT_INTERNAL, detail: { uid, count },
  };
}

// ── Diferența dintre locurile 1-2, sau podium foarte strâns — din
// clasamentul curent al etapei. ──
export function buildStandingsGapFact(gameweekId, rows) {
  if (rows.length < 2) return null;
  const sorted = [...rows].sort((a, b) => a.rank - b.rank);
  const gap12 = sorted[1].seasonPoints != null ? Math.abs(sorted[0].seasonPoints - sorted[1].seasonPoints) : null;
  if (gap12 == null) return null;
  const id = `fact_gap_${gameweekId}`;

  if (gap12 <= 10) {
    return {
      id, type: TYPE.FACT, subtype: "tight_top", ts: Date.now(), importance: IMPORTANCE.FACT_INTERNAL,
      actors: [sorted[0].uid, sorted[1].uid], version: 2, metadata: { gap: gap12 },
      narrativeKey: id, icon: "fun", important: false,
      title: pick([`🔥 Doar ${gap12}p între ${sorted[0].nickname} și ${sorted[1].nickname} în fruntea clasamentului.`], id),
      category: "fun", priority: IMPORTANCE.FACT_INTERNAL, detail: { gap: gap12 },
    };
  }
  if (gap12 >= 100) {
    return {
      id, type: TYPE.FACT, subtype: "leader_detached", ts: Date.now(), importance: IMPORTANCE.FACT_INTERNAL,
      actors: [sorted[0].uid], version: 2, metadata: { gap: gap12 },
      narrativeKey: id, icon: "fun", important: false,
      title: pick([`${sorted[0].nickname} conduce detașat, cu ${gap12}p peste locul 2.`], id),
      category: "fun", priority: IMPORTANCE.FACT_INTERNAL, detail: { gap: gap12 },
    };
  }
  return null;
}

// ── Cea mai mare urcare/cădere de la ÎNCEPUTUL etapei (nu doar ultimul
// meci) — necesită snapshot-ul de la începutul etapei, dat de apelant. ──
export function buildBiggestMoveOfGameweekFact(gameweekId, startOfGwRanks, currentRows) {
  if (!startOfGwRanks) return null;
  let biggest = null;
  currentRows.forEach((row) => {
    const start = startOfGwRanks[row.uid];
    if (!start) return;
    const moved = start.rank - row.rank;
    if (!biggest || Math.abs(moved) > Math.abs(biggest.moved)) biggest = { uid: row.uid, nickname: row.nickname, moved, from: start.rank, to: row.rank };
  });
  if (!biggest || Math.abs(biggest.moved) < 3) return null;
  const id = `fact_biggestmove_${gameweekId}_${biggest.uid}`;
  return {
    id, type: TYPE.FACT, subtype: "biggest_move", ts: Date.now(), importance: IMPORTANCE.FACT_INTERNAL,
    actors: [biggest.uid], version: 2, metadata: biggest,
    narrativeKey: id, icon: "fun", important: false,
    title: biggest.moved > 0
      ? pick([`${biggest.nickname} a urcat ${biggest.moved} poziții de la începutul etapei.`], id)
      : pick([`${biggest.nickname} a coborât ${Math.abs(biggest.moved)} poziții de la începutul etapei.`], id),
    category: "fun", priority: IMPORTANCE.FACT_INTERNAL, detail: biggest,
  };
}

export { hashSeed };
