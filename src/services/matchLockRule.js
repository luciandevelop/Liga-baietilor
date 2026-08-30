// ── Regula de lock — extrasă din predictionsService.js ca sursă unică.
// ÎNAINTE, formula era duplicată (predictionsService + firestore.rules
// aveau aceeași constantă scrisă de mână în două locuri). Acum și
// Feed-ul o folosește, prin acest fișier — dacă pragul se schimbă
// vreodată, se schimbă o singură dată, aici. Fișier PUR — fără
// Firestore, fără efecte, testabil izolat. ──
export const LOCK_MINUTES_BEFORE_KICKOFF = 30;
const LOCK_MS = LOCK_MINUTES_BEFORE_KICKOFF * 60 * 1000;

export function isMatchLocked(match, now = Date.now()) {
  const kickoffMs = match?.kickoffAt?.toMillis ? match.kickoffAt.toMillis() : null;
  if (kickoffMs === null) return false;
  return now >= kickoffMs - LOCK_MS;
}

// ── Guard central — GHID DE APĂRARE ÎN ADÂNCIME cerut explicit: orice
// funcție care ar putea dezvălui ceva derivat din predicțiile altor
// jucători (distribuție, preview, consensus, lone wolf, scor popular)
// TREBUIE să cheme asta chiar EA, nu doar să se bazeze pe faptul că
// apelantul o cheamă la momentul potrivit. Dacă peste o lună un apel se
// mută, funcția refuză singură, nu depinde de disciplina apelantului.
//
// Regula REALĂ: predicțiile devin revelabile exact când se blochează
// (isMatchLocked) — ACELAȘI prag ca interzicerea modificării, nu unul
// inventat separat.
export function canRevealPredictions(match, now = Date.now()) {
  return isMatchLocked(match, now);
}
