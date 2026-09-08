import { listPredictionsForMatch } from "./predictionsService";
import { getUserPublicProfiles } from "./profilesService";
import { listJokersForMatch, listJokerExtraForMatch } from "./adminService";

// ── Cache SIMPLU, în memorie, per sesiune (un singur Map la nivel de
// modul — trăiește cât trăiește pagina, dispare la reload, exact cum
// s-a cerut). NU e Firestore, NU e o colecție nouă, NU e persistat.
//
// Motivul: predicțiile unui meci, o dată blocate, NU se mai schimbă
// niciodată — doar scorul live se schimbă (acela vine separat, prin
// listener-ul deja existent pe `matches`). Deci prima citire e valabilă
// pentru tot restul sesiunii, indiferent de câte ori userul intră/iese
// din LIVE sau din reveal-ul unui meci. ──
const cache = new Map(); // matchId -> { rows, jokerUids, jokerExtraUids }

// Aceeași formă de date, aceeași sursă de citire (listPredictionsForMatch
// + getUserPublicProfiles + listJokersForMatch/listJokerExtraForMatch) —
// EXACT ce făcea PredictionsRevealSheet inline înainte, doar extras
// aici ca să nu se dubleze între "ochi" și ecranul LIVE, și ca a doua
// cerere pentru același meci, în aceeași sesiune, să fie gratuită.
export async function getRevealData(matchId) {
  if (cache.has(matchId)) return cache.get(matchId);

  const preds = await listPredictionsForMatch(matchId);
  const profiles = await getUserPublicProfiles(preds.map((p) => p.userId));
  const rows = preds.map((p) => ({
    uid: p.userId,
    nickname: profiles[p.userId]?.nickname || p.userId,
    avatarId: profiles[p.userId]?.avatarId ?? null,
    scoreA: p.scoreA, scoreB: p.scoreB,
  }));

  // Joker/Joker Extra — best-effort, ca înainte: dacă eșuează (ex. meci
  // nedezvăluit încă), seturile rămân goale, nu blocăm restul.
  let jokerUids = new Set();
  let jokerExtraUids = new Set();
  try {
    const jokers = await listJokersForMatch(matchId);
    jokerUids = new Set(jokers.map((j) => j.userId));
  } catch (err) {
    console.error("Eroare la încărcarea Jokerelor meciului:", err);
  }
  try {
    const jokersExtra = await listJokerExtraForMatch(matchId);
    jokerExtraUids = new Set(jokersExtra.map((j) => j.userId));
  } catch (err) {
    console.error("Eroare la încărcarea Jokerelor Extra ale meciului:", err);
  }

  const data = { rows, jokerUids, jokerExtraUids };
  cache.set(matchId, data);
  return data;
}
