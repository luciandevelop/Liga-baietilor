// ── Sursă UNICĂ pentru clasificarea "exact / încă în joc / eliminat" —
// extrasă EXACT din PredictionsRevealSheet.jsx (funcția tierFor), fără
// nicio schimbare de matematică. Folosită acum atât de reveal-ul
// existent ("ochiul"), cât și de ecranul LIVE — un singur loc, nicio
// logică duplicată.
//
// Regula matematică exactă: poți mai ajunge la scorul exact doar dacă
// predA >= liveA ȘI predB >= liveB (golurile nu pot scădea).
export function tierFor(row, isLive, liveA, liveB) {
  if (!isLive || liveA == null || liveB == null) return null;
  if (row.scoreA === liveA && row.scoreB === liveB) return "exact";
  if (row.scoreA >= liveA && row.scoreB >= liveB) return "alive";
  return "dead";
}

export const TIER_ORDER = { exact: 0, alive: 1, dead: 2 };

// ── Grupare + rezumat numeric — utilă direct pentru ecranul LIVE (3
// coloane) și reutilizabilă și de reveal dacă e nevoie. Calcul PUR local
// pe rândurile deja încărcate — ZERO citiri Firestore. ──
export function groupByTier(rows, isLive, liveA, liveB) {
  const decorated = rows.map((r) => ({ ...r, tier: tierFor(r, isLive, liveA, liveB) }));
  const groups = { exact: [], alive: [], dead: [] };
  for (const r of decorated) {
    if (r.tier && groups[r.tier]) groups[r.tier].push(r);
  }
  return {
    decorated,
    groups,
    summary: isLive ? { exact: groups.exact.length, alive: groups.alive.length, dead: groups.dead.length } : null,
  };
}
