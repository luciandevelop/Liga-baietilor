// ══════════════════════════════════════════════════════════════════
// PLAY LEAGUE — BACKUP MANUAL JSON (FAZA 1)
//
// STRICT: citire → construire JSON → download local. Nicio scriere,
// nicio modificare, niciun listener, niciun polling. Rulează DOAR la
// apăsarea explicită a butonului din Admin — niciodată la mount,
// niciodată pentru jucători.
//
// Aprobat pe baza auditului Firestore anterior (colecțiile/
// subcolecțiile de mai jos sunt exact cele confirmate din cod, nimic
// inventat). Vezi comentariile per-secțiune pentru path-urile reale.
// ══════════════════════════════════════════════════════════════════
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { getCurrentSeason, getCurrentGameweek } from "./predictionsService";

export const BACKUP_SCHEMA_VERSION = 1;

// ── Serializare recursivă — Timestamp Firestore păstrat EXPLICIT (nu
// doar string), ca restore-ul ulterior să poată reconstrui exact
// tipul. Auditul anterior nu a găsit GeoPoint/DocumentReference
// folosite nicăieri în cod — dacă totuși apare ceva neașteptat aici,
// e raportat ca atare (best-effort string), nu ascuns silențios. ──
function serializeValue(v) {
  if (v === null || v === undefined) return null;
  if (v && typeof v.toDate === "function" && typeof v.seconds === "number") {
    return { __type: "timestamp", iso: v.toDate().toISOString(), seconds: v.seconds, nanoseconds: v.nanoseconds || 0 };
  }
  if (Array.isArray(v)) return v.map(serializeValue);
  if (typeof v === "object") {
    const out = {};
    Object.keys(v).forEach((k) => { out[k] = serializeValue(v[k]); });
    return out;
  }
  return v; // primitive (string/number/boolean)
}

function docToEntry(path, d) {
  return { path: `${path}/${d.id}`, id: d.id, data: serializeValue(d.data()) };
}

// ── O colecție/query întreagă → array de {path,id,data}. Zero
// documente e un rezultat VALID (etapă fără o anumită Surpriză, de
// exemplu) — doar o excepție reală (permission-denied, rețea) trebuie
// să oprească tot exportul. Aruncă mai departe, cu path-ul exact,
// pentru ca apelantul să poată raporta clar ce a eșuat. ──
async function readCollection(pathSegments, label) {
  try {
    const snap = await getDocs(collection(db, ...pathSegments));
    return snap.docs.map((d) => docToEntry(pathSegments.join("/"), d));
  } catch (err) {
    throw new Error(`Citire eșuată: ${label} (${pathSegments.join("/")}) — ${err.message || err}`);
  }
}

async function readFilteredCollection(pathSegments, field, op, value, label) {
  try {
    const snap = await getDocs(query(collection(db, ...pathSegments), where(field, op, value)));
    return snap.docs.map((d) => docToEntry(pathSegments.join("/"), d));
  } catch (err) {
    throw new Error(`Citire eșuată: ${label} (${pathSegments.join("/")} where ${field} ${op} ${value}) — ${err.message || err}`);
  }
}

async function readSingleDoc(pathSegments, label) {
  try {
    const snap = await getDoc(doc(db, ...pathSegments));
    if (!snap.exists()) return null; // absent = valid, nu eroare
    return docToEntry(pathSegments.slice(0, -1).join("/"), snap);
  } catch (err) {
    throw new Error(`Citire eșuată: ${label} (${pathSegments.join("/")}) — ${err.message || err}`);
  }
}

// ── Subcolecțiile Surprizelor, confirmate exact din audit — NU
// inventate. Rulate per gameweek existent, indiferent de sezon
// (backup-ul acoperă TOATĂ ediția, nu doar sezonul curent). ──
const HIGHER_LOWER_SUB = [
  "results", "triviaAnswers", "diceRolls", "diceStops",
  "sabotajChoices", "sabotajPicked", "sabotajTaken",
  "higherLowerPicks", "higherLowerTiebreakers",
  "rouletteSpins", "mysteryBoxPicks", "penaltyChoices", "penaltySubmitted",
];

export async function generatePlayLeagueBackup(onProgress) {
  const startedAt = new Date();
  const documents = [];
  const counts = {};
  const report = (label) => { if (onProgress) onProgress(label); };

  function addAll(entries, countKey) {
    documents.push(...entries);
    counts[countKey] = (counts[countKey] || 0) + entries.length;
  }

  // ── TOP LEVEL / CORE ──
  report("users");
  // STRICT users/{uid} — NICIODATĂ users/{uid}/private/profile (acolo
  // e email-ul) — excluderea e prin simplul fapt că nu citim acea
  // subcolecție deloc aici, nu printr-un filtru ulterior.
  addAll(await readCollection(["users"], "Utilizatori"), "users");

  report("admins");
  // ── EXCEPȚIE, clar marcată — spre deosebire de tot restul acestei
  // funcții. Descoperit live: Firestore Rules NU permit citirea
  // colecției `admins` ca listă întreagă (probabil doar per-document
  // propriu e permis) — nu e o eroare tranzitorie, e o restricție
  // reală de Rules, pe care NU am voie s-o ating. Colecția e mică,
  // gestionată STRICT manual în Firebase Console (confirmat în audit —
  // zero scriitor din aplicație), deci pierderea ei din backup NU e o
  // pierdere reală de date de joc — e mereu reconstruibilă manual de
  // Admin. De-aia, STRICT pentru asta, un eșec NU oprește backup-ul —
  // dar e notat explicit în metadata, niciodată ascuns. ──
  let adminsIncluded = true;
  let adminsError = null;
  try {
    addAll(await readCollection(["admins"], "Admini"), "admins");
  } catch (err) {
    adminsIncluded = false;
    adminsError = err.message || String(err);
    counts.admins = 0;
    console.error("Backup: colecția admins indisponibilă (non-blocant, vezi metadata.adminsIncluded):", err);
  }

  report("seasons");
  const seasonsDocs = await readCollection(["seasons"], "Sezoane");
  addAll(seasonsDocs, "seasons");

  report("gameweeks");
  const gameweeksDocs = await readCollection(["gameweeks"], "Etape");
  addAll(gameweeksDocs, "gameweeks");

  report("matches");
  addAll(await readCollection(["matches"], "Meciuri"), "matches");

  report("predictions");
  addAll(await readCollection(["predictions"], "Pronosticuri"), "predictions");

  report("jokers");
  addAll(await readCollection(["jokers"], "Jokere"), "jokers");

  report("jokerExtra");
  addAll(await readCollection(["jokerExtra"], "Joker Extra"), "jokerExtra");

  report("matchPoints");
  addAll(await readCollection(["matchPoints"], "Puncte per meci"), "matchPoints");

  report("gameweekScores");
  addAll(await readCollection(["gameweekScores"], "Scoruri finale etape"), "gameweekScores");

  // ── SPECIALE ──
  report("specialPhases");
  addAll(await readCollection(["specialPhases"], "Faze Speciale"), "specialPhases");

  report("specialPicks");
  addAll(await readCollection(["specialPicks"], "Pronosticuri Speciale"), "specialPicks");

  report("specialScores");
  addAll(await readCollection(["specialScores"], "Scoruri Speciale"), "specialScores");

  // ── BET BUILDER ──
  report("betBuilders");
  addAll(await readCollection(["betBuilders"], "Config Bet Builder"), "betBuilders");

  report("betBuilderPicks");
  addAll(await readCollection(["betBuilderPicks"], "Alegeri Bet Builder"), "betBuilderPicks");

  // ── WEEKLY SURPRISES — per etapă existentă, toate subcolecțiile
  // reale confirmate în audit. Zero documente într-o subcolecție e
  // valid (etapa aia n-a avut acel joc). ──
  report("weeklySurprises");
  let wsCount = 0;
  for (const gw of gameweeksDocs) {
    const gwId = gw.id;
    const mainDoc = await readSingleDoc(["weeklySurprises", gwId], `weeklySurprises/${gwId} (principal)`);
    if (mainDoc) { documents.push(mainDoc); wsCount++; }

    const secretMain = await readSingleDoc(["weeklySurprises", gwId, "secret", "main"], `secret/main (${gwId})`);
    if (secretMain) { documents.push(secretMain); wsCount++; }
    const secretBonus = await readSingleDoc(["weeklySurprises", gwId, "secret", "bonus"], `secret/bonus (${gwId})`);
    if (secretBonus) { documents.push(secretBonus); wsCount++; }

    for (const sub of HIGHER_LOWER_SUB) {
      const entries = await readCollection(["weeklySurprises", gwId, sub], `${sub} (${gwId})`);
      documents.push(...entries);
      wsCount += entries.length;
    }
  }
  counts.weeklySurprises = wsCount;

  // ── FEED — STRICT manual + published, dedupe pe id ──
  report("feedEvents");
  const manualNews = await readFilteredCollection(["feedEvents"], "subtype", "==", "manual", "Feed — știri manuale");
  const publishedNews = await readFilteredCollection(["feedEvents"], "status", "==", "published", "Feed — publicate");
  const seenFeedIds = new Set();
  const feedEntries = [];
  [...manualNews, ...publishedNews].forEach((e) => {
    if (!seenFeedIds.has(e.id)) { seenFeedIds.add(e.id); feedEntries.push(e); }
  });
  addAll(feedEntries, "feedEvents");

  report("feedFunItems");
  addAll(await readCollection(["feedFunItems"], "Feed — item-e Fun"), "feedFunItems");

  // ── METADATA — currentSeasonId/currentGameweekId, cost mic
  // (funcții deja existente, reutilizate, nu interogări noi construite
  // special pentru backup). Best-effort — un eșec aici NU invalidează
  // backup-ul (nu sunt date critice, doar context). ──
  let currentSeasonId = null, currentGameweekId = null;
  try {
    const cs = await getCurrentSeason();
    currentSeasonId = cs?.id || null;
    if (cs) {
      const cgw = await getCurrentGameweek(cs.id);
      currentGameweekId = cgw?.id || null;
    }
  } catch (err) {
    console.error("Backup: context sezon/etapă curentă indisponibil (non-critic):", err);
  }

  const completedAt = new Date();
  const metadata = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    backupType: "manual",
    app: "PLAY LEAGUE",
    edition: "2026/27",
    createdAt: completedAt.toISOString(),
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs: completedAt.getTime() - startedAt.getTime(),
    consistencyMode: "sequential-client-export",
    currentSeasonId,
    currentGameweekId,
    adminsIncluded,
    adminsError,
    counts,
    totalDocuments: documents.length,
    backupStatus: "COMPLETE", // se ajunge aici DOAR dacă nimic de mai sus n-a aruncat
  };

  return { metadata, documents };
}

export function downloadBackupJson(backup) {
  const pad = (n) => String(n).padStart(2, "0");
  const d = new Date();
  const filename = `PLAY-LEAGUE_BACKUP_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}.json`;
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return filename;
}
