// Statusul unui meci e explicit, controlat din Admin — NU se mai deduce
// din oră sau din existența scorului. `match.status` e mereu una din
// cele 6 valori de mai jos (setat implicit la "scheduled" la creare,
// schimbat liber din Admin după aceea).
export const MATCH_STATUSES = ["scheduled", "live", "paused", "finished", "postponed", "cancelled"];

export const MATCH_STATUS_LABEL = {
  scheduled: "Programat",
  live: "Live",
  paused: "Pauză",
  finished: "Final",
  postponed: "Amânat",
  cancelled: "Anulat",
};

export const MATCH_STATUS_TONE = {
  scheduled: { bg: "rgba(255,255,255,0.06)", fg: "#9099AC" },
  live: { bg: "rgba(139,217,87,0.16)", fg: "#8BD957" },
  paused: { bg: "rgba(240,147,12,0.16)", fg: "#F0930C" },
  finished: { bg: "rgba(255,255,255,0.07)", fg: "#C4C9D4" },
  postponed: { bg: "rgba(240,147,12,0.14)", fg: "#F0A94E" },
  cancelled: { bg: "rgba(139,146,165,0.14)", fg: "#8B92A5" },
};

// `match.status` e sursa principală (setat/schimbat liber din Admin).
// SINGURA excepție: dacă statusul e încă "scheduled" (implicit, neatins
// de admin) ȘI ora de start a trecut deja ȘI nu există rezultat real —
// afișăm LIVE. Asta NU reintroduce deducerea generală a statusului din
// oră (Final/Amânat/Anulat rămân mereu explicite, controlate doar din
// Admin) — acoperă exclusiv golul dintre "meciul chiar a-nceput" și
// "adminul a apucat să apese butonul Live".
// `now` are valoare implicită Date.now() — apelurile existente (ex. din
// Admin/MatchResultCard) rămân neschimbate și continuă să funcționeze.
export function getMatchStatus(match, now = Date.now()) {
  const explicit = MATCH_STATUSES.includes(match?.status) ? match.status : "scheduled";
  if (explicit !== "scheduled") return explicit;

  const hasResult = match.realScoreA !== null && match.realScoreA !== undefined;
  if (hasResult) return "scheduled"; // caz neobișnuit (rezultat fără status Final) — nu presupunem nimic în plus

  const kickoffMs = match.kickoffAt?.toMillis ? match.kickoffAt.toMillis() : null;
  if (kickoffMs !== null && now >= kickoffMs) return "live";
  return "scheduled";
}
