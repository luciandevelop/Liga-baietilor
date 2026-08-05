// Derivă starea reală a unui meci — NU există un câmp "live" în date (a
// fost o decizie explicită, documentată în AdminScreen.jsx: "nu există
// sursă live"). Un meci e:
//   - "finished"  — are deja rezultat real salvat (realScoreA/B)
//   - "live"      — ora de start a trecut, dar încă nu are rezultat salvat
//   - "scheduled" — ora de start nu a venit încă
export function getMatchStatus(match, now = Date.now()) {
  const hasResult = match.realScoreA !== null && match.realScoreA !== undefined && match.realScoreB !== null && match.realScoreB !== undefined;
  if (hasResult) return "finished";
  const kickoffMs = match.kickoffAt?.toMillis ? match.kickoffAt.toMillis() : null;
  if (kickoffMs !== null && now >= kickoffMs) return "live";
  return "scheduled";
}

export const MATCH_STATUS_LABEL = {
  scheduled: "Programat",
  live: "Live",
  finished: "Final",
};
