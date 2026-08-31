import { doc, getDoc, collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import {
  getWeeklySurprise, getSecretMain, getSecretBonus, MAIN_CATALOG, BONUS_CATALOG,
  getMySabotajChoice, getRouletteSpin, getAllMysteryBoxPicks, getMyTriviaAnswers,
} from "./surprisesService";

// ── Meciuri de azi fără pronostic — verificare directă pe existența
// documentului de predicție (id = `${matchId}_${uid}`, convenția deja
// folosită peste tot în aplicație), nu o interogare nouă/index nou. ──
export async function getUnpredictedMatchesToday(matches, uid) {
  const now = Date.now();
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const todays = matches.filter((m) => {
    const kickoffMs = m.kickoffAt?.toMillis ? m.kickoffAt.toMillis() : null;
    if (!kickoffMs) return false;
    return kickoffMs >= startOfDay.getTime() && kickoffMs > now && m.status === "scheduled";
  });
  if (todays.length === 0) return [];

  const checks = await Promise.all(todays.map(async (m) => {
    const snap = await getDoc(doc(db, "predictions", `${m.id}_${uid}`));
    return { match: m, hasPrediction: snap.exists() };
  }));
  return checks.filter((c) => !c.hasPrediction).map((c) => c.match);
}

// ── Dispatch per tip de Surpriză — "are userul ceva de făcut acolo".
// Tipurile de Duel/Jumate-Jumate NU cer nicio acțiune de la user (sunt
// auto-rezolvate din rezultatele meciurilor) — pentru alea, simpla
// dezvăluire nedeacționată de Admin (nerezolvată încă) e tot ce putem
// semnala, informativ. ──
const NO_ACTION_TYPES = new Set(["duel-random", "duel-extreme", "duel-rivali", "team-duel-random", "half-random", "half-topbottom"]);

async function hasActedOnMain(gameweekId, uid, type, secretMain) {
  if (NO_ACTION_TYPES.has(type)) return true; // nimic de acționat — nu notificăm individual
  if (type === "sabotaj") {
    const choice = await getMySabotajChoice(gameweekId, uid).catch(() => null);
    return !!choice;
  }
  if (type === "trivia") {
    const questions = secretMain?.config?.questions || [];
    if (questions.length === 0) return true;
    const answers = await getMyTriviaAnswers(gameweekId, uid, questions.map((q) => q.id)).catch(() => ({}));
    return Object.keys(answers).length >= questions.length;
  }
  if (type === "zaruri") {
    const questions = secretMain?.config?.questions || [];
    if (questions.length === 0) return true;
    const snaps = await Promise.all(questions.map((q) =>
      getDoc(doc(db, "weeklySurprises", gameweekId, "diceStops", `${q.id}_${uid}`)).catch(() => ({ exists: () => false }))
    ));
    return snaps.every((s) => s.exists());
  }
  return true; // tip necunoscut — nu blocăm, nu presupunem
}

async function hasActedOnBonus(gameweekId, uid, type) {
  if (type === "roulette") {
    const spin = await getRouletteSpin(gameweekId, uid, 1).catch(() => null);
    return !!spin;
  }
  if (type === "mystery-box") {
    const picks = await getAllMysteryBoxPicks(gameweekId).catch(() => []);
    return picks.some((p) => p.uid === uid);
  }
  if (type === "penalty-pvp") {
    // tratat separat, per pereche — vezi getMyPenaltyChoices dacă/când
    // devine parte din pachetul curent; deocamdată BONUS_CATALOG îl are
    // active:false, deci nu ajunge aici oricum (filtrat mai devreme).
    return true;
  }
  return true;
}

// ── Surprize dezvăluite dar neacționate de userul curent — pentru
// tipul curent (main + bonus), dacă etapa curentă are vreunul activ. ──
export async function getUnactionedSurprises(gameweekId, uid) {
  const pub = await getWeeklySurprise(gameweekId);
  if (!pub) return [];
  const results = [];

  if (pub.mainRevealed && !pub.mainResolved) {
    const secretMain = await getSecretMain(gameweekId);
    if (secretMain?.type) {
      const catalogEntry = MAIN_CATALOG.find((c) => c.id === secretMain.type);
      if (catalogEntry?.active) {
        const acted = await hasActedOnMain(gameweekId, uid, secretMain.type, secretMain);
        if (!acted) results.push({ kind: "main", type: secretMain.type, label: catalogEntry.label });
      }
    }
  }
  if (pub.bonusRevealed && !pub.bonusResolved) {
    const secretBonus = await getSecretBonus(gameweekId);
    if (secretBonus?.type) {
      const catalogEntry = BONUS_CATALOG.find((c) => c.id === secretBonus.type);
      if (catalogEntry?.active) {
        const acted = await hasActedOnBonus(gameweekId, uid, secretBonus.type);
        if (!acted) results.push({ kind: "bonus", type: secretBonus.type, label: catalogEntry.label });
      }
    }
  }
  return results;
}

// ── Meciurile Săptămânii — informativ, doar cât timp cel puțin unul
// mai poate fi pronosticat (nu blocat încă). Nu ține stare "văzut",
// dispare singur natural odată ce se blochează toate 3. ──
export function getActiveFeaturedMatches(matches, featuredMatchIds) {
  if (!featuredMatchIds || featuredMatchIds.length === 0) return [];
  const now = Date.now();
  return matches.filter((m) => {
    if (!featuredMatchIds.includes(m.id)) return false;
    const kickoffMs = m.kickoffAt?.toMillis ? m.kickoffAt.toMillis() : null;
    return kickoffMs && kickoffMs > now && m.status === "scheduled";
  });
}

// ── Agregatul complet — un singur apel, folosit de clopoțel (pentru
// punctul roșu) și de panoul deschis (pentru conținut). ──
export async function loadNotifications({ gameweekId, matches, uid, featuredMatchIds }) {
  const [unpredicted, unactioned] = await Promise.all([
    getUnpredictedMatchesToday(matches, uid),
    gameweekId ? getUnactionedSurprises(gameweekId, uid) : Promise.resolve([]),
  ]);
  const featured = getActiveFeaturedMatches(matches, featuredMatchIds);

  const items = [];
  unpredicted.forEach((m) => items.push({
    id: `unpred_${m.id}`, kind: "unpredicted",
    title: `${m.homeTeam} – ${m.awayTeam}`, subtitle: "Nu ai pus încă pronosticul",
    matchId: m.id,
  }));
  unactioned.forEach((s) => items.push({
    id: `surprise_${s.kind}_${s.type}`, kind: "surprise",
    title: s.label, subtitle: s.kind === "main" ? "Surpriza Principală te așteaptă" : "Bonusul Săptămânii te așteaptă",
  }));
  if (featured.length > 0) {
    items.push({
      id: "featured", kind: "featured",
      title: "Meciurile Săptămânii", subtitle: `${featured.length} ${featured.length === 1 ? "meci" : "meciuri"} cu punctaj dublu`,
    });
  }

  return { items, count: items.length };
}
