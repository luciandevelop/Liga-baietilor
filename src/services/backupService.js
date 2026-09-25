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
//
// DESIGN — schimbat live, după test real: firestore.rules din repo NU
// reflectă Rules-urile chiar deployed (confirmat: betBuilders/
// betBuilderPicks nici nu apar în fișierul local, deși există real în
// Firestore) — deci nu se poate ști dinainte, din cod, care colecții
// au restricții de tip "listă" (admins și betBuilders au eșuat DEJA
// live, ambele cu "Missing or insufficient permissions", nu eroare de
// rețea). Din acest motiv, FIECARE secțiune e acum independentă:
// un eșec la o colecție NU mai aruncă tot exportul — se notează
// explicit (niciodată ascuns) și restul continuă. backupStatus e
// "COMPLETE" DOAR dacă absolut totul a reușit, altfel "PARTIAL", cu
// failedSections listate clar. Fișierul tot se descarcă — conține tot
// ce s-a putut citi cu succes, plus dovada exactă a ce lipsește. ──
// ══════════════════════════════════════════════════════════════════
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { getCurrentSeason, getCurrentGameweek } from "./predictionsService";

export const BACKUP_SCHEMA_VERSION = 2;

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
  return v; // primitiv
}

function docToEntry(path, d) {
  return { path: `${path}/${d.id}`, id: d.id, data: serializeValue(d.data()) };
}

async function readCollection(pathSegments) {
  const snap = await getDocs(collection(db, ...pathSegments));
  return snap.docs.map((d) => docToEntry(pathSegments.join("/"), d));
}

async function readFilteredCollection(pathSegments, field, op, value) {
  const snap = await getDocs(query(collection(db, ...pathSegments), where(field, op, value)));
  return snap.docs.map((d) => docToEntry(pathSegments.join("/"), d));
}

async function readSingleDoc(pathSegments) {
  const snap = await getDoc(doc(db, ...pathSegments));
  if (!snap.exists()) return null; // absent = valid, nu eroare
  return docToEntry(pathSegments.slice(0, -1).join("/"), snap);
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
  const failedSections = []; // { key, label, path, error } — niciodată ascuns
  const report = (label) => { if (onProgress) onProgress(label); };

  // ── O secțiune = o unitate independentă. Reușește → documentele
  // intră în backup normal. Eșuează → notat în failedSections, restul
  // secțiunilor continuă neafectat. ──
  async function runSection(key, label, fn) {
    report(label);
    try {
      const entries = await fn();
      documents.push(...entries);
      counts[key] = (counts[key] || 0) + entries.length;
    } catch (err) {
      counts[key] = counts[key] || 0;
      failedSections.push({ key, label, error: err.message || String(err) });
      console.error(`Backup — secțiune eșuată (non-blocant): ${label}`, err);
    }
  }

  // ── TOP LEVEL / CORE ──
  // STRICT users/{uid} — NICIODATĂ users/{uid}/private/profile (acolo
  // e email-ul) — excluderea e prin simplul fapt că nu citim acea
  // subcolecție deloc aici, nu printr-un filtru ulterior.
  await runSection("users", "Utilizatori", () => readCollection(["users"]));
  await runSection("admins", "Admini", () => readCollection(["admins"]));

  let seasonsDocs = [];
  await runSection("seasons", "Sezoane", async () => { seasonsDocs = await readCollection(["seasons"]); return seasonsDocs; });

  let gameweeksDocs = [];
  await runSection("gameweeks", "Etape", async () => { gameweeksDocs = await readCollection(["gameweeks"]); return gameweeksDocs; });

  await runSection("matches", "Meciuri", () => readCollection(["matches"]));
  await runSection("predictions", "Pronosticuri", () => readCollection(["predictions"]));
  await runSection("jokers", "Jokere", () => readCollection(["jokers"]));
  await runSection("jokerExtra", "Joker Extra", () => readCollection(["jokerExtra"]));
  await runSection("matchPoints", "Puncte per meci", () => readCollection(["matchPoints"]));
  await runSection("gameweekScores", "Scoruri finale etape", () => readCollection(["gameweekScores"]));

  // ── SPECIALE ──
  await runSection("specialPhases", "Faze Speciale", () => readCollection(["specialPhases"]));
  await runSection("specialPicks", "Pronosticuri Speciale", () => readCollection(["specialPicks"]));
  await runSection("specialScores", "Scoruri Speciale", () => readCollection(["specialScores"]));

  // ── BET BUILDER ──
  await runSection("betBuilders", "Config Bet Builder", () => readCollection(["betBuilders"]));
  await runSection("betBuilderPicks", "Alegeri Bet Builder", () => readCollection(["betBuilderPicks"]));

  // ── WEEKLY SURPRISES — per etapă existentă, toate subcolecțiile
  // reale confirmate în audit. Fiecare etapă + fiecare subcolecție e
  // propria ei secțiune (cheie unică pe etapă), ca un eșec la o
  // singură etapă/subcolecție să nu ascundă restul etapelor. Zero
  // documente într-o subcolecție e valid (etapa aia n-a avut acel
  // joc), diferit de un eșec real de citire. ──
  for (const gw of gameweeksDocs) {
    const gwId = gw.id;
    await runSection(`weeklySurprises_${gwId}_main`, `Surprize — principal (${gwId})`, async () => {
      const d = await readSingleDoc(["weeklySurprises", gwId]);
      return d ? [d] : [];
    });
    await runSection(`weeklySurprises_${gwId}_secretMain`, `Surprize — secret/main (${gwId})`, async () => {
      const d = await readSingleDoc(["weeklySurprises", gwId, "secret", "main"]);
      return d ? [d] : [];
    });
    await runSection(`weeklySurprises_${gwId}_secretBonus`, `Surprize — secret/bonus (${gwId})`, async () => {
      const d = await readSingleDoc(["weeklySurprises", gwId, "secret", "bonus"]);
      return d ? [d] : [];
    });
    for (const sub of HIGHER_LOWER_SUB) {
      await runSection(`weeklySurprises_${gwId}_${sub}`, `Surprize — ${sub} (${gwId})`, () => readCollection(["weeklySurprises", gwId, sub]));
    }
  }

  // ── FEED — STRICT manual + published, dedupe pe id ──
  await runSection("feedEvents", "Feed — știri manuale + publicate", async () => {
    const manualNews = await readFilteredCollection(["feedEvents"], "subtype", "==", "manual");
    const publishedNews = await readFilteredCollection(["feedEvents"], "status", "==", "published");
    const seen = new Set();
    const out = [];
    [...manualNews, ...publishedNews].forEach((e) => { if (!seen.has(e.id)) { seen.add(e.id); out.push(e); } });
    return out;
  });
  await runSection("feedFunItems", "Feed — item-e Fun", () => readCollection(["feedFunItems"]));

  // ── METADATA — currentSeasonId/currentGameweekId, cost mic
  // (funcții deja existente, reutilizate). Best-effort — un eșec aici
  // NU e o "secțiune de date", doar context, nu intră în
  // failedSections. ──
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
    counts,
    totalDocuments: documents.length,
    failedSections, // [] dacă totul a reușit
    backupStatus: failedSections.length === 0 ? "COMPLETE" : "PARTIAL",
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
