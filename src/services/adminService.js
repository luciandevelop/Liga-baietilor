import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  runTransaction,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";

// Verifică dacă userul curent e admin, citind admins/{uid} — conform
// regulilor Firestore, doar owner-ul poate citi propriul document din admins/.
export async function checkIsAdmin(uid) {
  try {
    const snap = await getDoc(doc(db, "admins", uid));
    return snap.exists();
  } catch (err) {
    console.error("Verificare admin eșuată:", err);
    return false;
  }
}

export async function createSeason({ name, startDate, endDate }) {
  const ref = await addDoc(collection(db, "seasons"), {
    name,
    startDate: Timestamp.fromDate(new Date(startDate)),
    endDate: Timestamp.fromDate(new Date(endDate)),
    status: "upcoming",
    gameweekCount: 0, // folosit pentru numerotarea atomică a etapelor
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function listSeasons() {
  const snap = await getDocs(query(collection(db, "seasons"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ── Calcul de săptămână, FIXAT pe Europe/Bucharest ─────────────────────
// Nu depinde de fusul orar al dispozitivului (nu folosește Date.getDay()/
// setHours() locale). Citește ora reală din Bucharest via Intl.DateTimeFormat,
// gestionează corect ora de vară/iarnă. Testat concret (nu doar presupus)
// pentru: luni/marți/miercuri, trecere peste Anul Nou, ambele tranziții DST,
// și independență față de fusul dispozitivului — vezi timezone-test.js.
const BUCHAREST_TZ = "Europe/Bucharest";

function getZonedParts(date, timeZone) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    fractionalSecondDigits: 3,
  });
  const parts = dtf.formatToParts(date).reduce((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});
  return {
    year: parseInt(parts.year, 10),
    month: parseInt(parts.month, 10),
    day: parseInt(parts.day, 10),
    hour: parseInt(parts.hour, 10),
    minute: parseInt(parts.minute, 10),
    second: parseInt(parts.second, 10),
    ms: parseInt(parts.fractionalSecond, 10),
  };
}

// Offset-ul (ms) al fusului dat față de UTC, LA ACEL INSTANT anume
// (diferă automat vara/iarna — nu e o constantă).
function getTimeZoneOffsetMs(timeZone, date) {
  const p = getZonedParts(date, timeZone);
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second, p.ms);
  return asUTC - date.getTime();
}

// Convertește o oră "de perete" din Bucharest într-un instant UTC real.
function zonedTimeToUtc(y, m, d, h, mi, s, ms, timeZone) {
  let guess = new Date(Date.UTC(y, m - 1, d, h, mi, s, ms));
  for (let i = 0; i < 2; i++) {
    const offset = getTimeZoneOffsetMs(timeZone, guess);
    guess = new Date(Date.UTC(y, m - 1, d, h, mi, s, ms) - offset);
  }
  return guess;
}

// Zi-a-săptămânii PUR calendaristică (ancorată la amiază UTC — fără nicio
// dependență de oră/fus, deci fără risc de alunecare de dată).
function dowOf(y, m, d) {
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay(); // 0=Duminică..6=Sâmbătă
}
function addDaysYMD(y, m, d, days) {
  const t = Date.UTC(y, m - 1, d, 12, 0, 0) + days * 86400000;
  const dt = new Date(t);
  return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate() };
}
function pad(n) { return String(n).padStart(2, "0"); }

// Calculează granițele săptămânii calendaristice CURENTE (Europe/Bucharest):
// luni 00:00:00.000 până duminică 23:59:59.999, indiferent de fusul
// dispozitivului care rulează codul.
function getCurrentWeekBounds() {
  const now = getZonedParts(new Date(), BUCHAREST_TZ);
  const dow = dowOf(now.year, now.month, now.day);
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  const monday = addDaysYMD(now.year, now.month, now.day, diffToMonday);
  const sunday = addDaysYMD(monday.year, monday.month, monday.day, 6);

  const weekStart = zonedTimeToUtc(monday.year, monday.month, monday.day, 0, 0, 0, 0, BUCHAREST_TZ);
  const weekEnd = zonedTimeToUtc(sunday.year, sunday.month, sunday.day, 23, 59, 59, 999, BUCHAREST_TZ);
  return { weekStart, weekEnd, mondayYMD: monday };
}

function weekIdFromYMD({ year, month, day }) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

// Creează etapa săptămânii CURENTE pentru sezonul dat, sau — dacă există deja
// o etapă pentru săptămâna asta — o returnează pe aceea, fără să creeze alta.
//
// Duplicarea e prevenită STRUCTURAL, nu doar printr-o verificare anterioară:
// 1) ID-ul documentului e determinist (seasonId + luni-ul săptămânii), deci
//    două apăsări simultane țintesc mereu EXACT același document.
// 2) Totul rulează într-o runTransaction — Firestore serializează automat
//    tranzacțiile concurente pe același document, deci un dublu-click rapid
//    nu poate crea două etape, indiferent de viteza rețelei sau a click-urilor.
// 3) Numărul etapei vine dintr-un contor atomic (seasons/{id}.gameweekCount),
//    incrementat în aceeași tranzacție — nu dintr-un query separat "ultimul+1",
//    care ar avea propriul risc de race condition.
export async function createOrGetWeeklyGameweek(seasonId) {
  const { weekStart, weekEnd, mondayYMD } = getCurrentWeekBounds();
  const weekId = weekIdFromYMD(mondayYMD);
  const gameweekId = `${seasonId}_${weekId}`;
  const gwRef = doc(db, "gameweeks", gameweekId);
  const seasonRef = doc(db, "seasons", seasonId);

  try {
    const result = await runTransaction(db, async (tx) => {
      // AMBELE citiri, necondiționat, înaintea oricărei decizii sau scrieri —
      // nu doar "citiri înainte de scrieri pe calea de execuție", ci literal
      // primele două linii ale tranzacției, fără nicio ramificație între ele.
      const seasonSnap = await tx.get(seasonRef);
      const gwSnap = await tx.get(gwRef);

      if (gwSnap.exists()) {
        return { id: gameweekId, number: gwSnap.data().number, existed: true };
      }
      if (!seasonSnap.exists()) {
        throw new Error("Sezonul selectat nu există.");
      }

      const currentCount = seasonSnap.data().gameweekCount || 0;
      const nextNumber = currentCount + 1;

      tx.update(seasonRef, { gameweekCount: nextNumber });
      tx.set(gwRef, {
        seasonId,
        number: nextNumber,
        title: `Etapa ${nextNumber}`,
        status: "draft",
        weekStart: Timestamp.fromDate(weekStart),
        weekEnd: Timestamp.fromDate(weekEnd),
        createdAt: serverTimestamp(),
      });

      return { id: gameweekId, number: nextNumber, existed: false };
    });

    return result;
  } catch (err) {
    // Nu ascundem eroarea originală — o păstrăm ca sursă, dar aruncăm un
    // mesaj cu context, ca userul să vadă exact ce s-a întâmplat, nu doar
    // un cod generic Firebase.
    console.error("Tranzacție eșuată la createOrGetWeeklyGameweek:", err);
    const detail = err?.message || err?.code || "eroare necunoscută";
    const wrapped = new Error(`Crearea etapei a eșuat în tranzacția Firestore: ${detail}`);
    wrapped.cause = err;
    throw wrapped;
  }
}

export async function listGameweeks(seasonId) {
  // Fără orderBy() în query — where()+orderBy() pe câmpuri diferite ar cere
  // un index compus în Firestore. Sortăm în JS după ce vin datele (liste
  // mici, sub 40 de elemente — zero impact real de performanță).
  const snap = await getDocs(query(collection(db, "gameweeks"), where("seasonId", "==", seasonId)));
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return list.sort((a, b) => Number(a.number) - Number(b.number));
}

export async function createMatch({ gameweekId, homeTeam, awayTeam, kickoffAt }) {
  const ref = await addDoc(collection(db, "matches"), {
    gameweekId,
    homeTeam,
    awayTeam,
    kickoffAt: Timestamp.fromDate(new Date(kickoffAt)),
    realScoreA: null,
    realScoreB: null,
    realCorners: null,
    realCards: null,
    status: "scheduled",
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function listMatches(gameweekId) {
  // Același motiv — fără orderBy() în query, sortăm în JS după kickoffAt.
  const snap = await getDocs(query(collection(db, "matches"), where("gameweekId", "==", gameweekId)));
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return list.sort((a, b) => a.kickoffAt.toMillis() - b.kickoffAt.toMillis());
}

// Parsează text lipit, un meci pe linie, format:
// "Echipa Gazdă - Echipa Oaspete | 2026-09-16 21:00"
// Returnează un array de {homeTeam, awayTeam, kickoffAt} sau aruncă eroare
// cu numărul liniei greșite, ca userul să știe exact ce să corecteze.
export function parseMatchesText(text) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines.map((line, i) => {
    const [teamsPart, timePart] = line.split("|").map((p) => p && p.trim());
    if (!teamsPart || !timePart) {
      throw new Error(`Linia ${i + 1}: format greșit, lipsește "|" (echipe | dată oră).`);
    }
    const [homeTeam, awayTeam] = teamsPart.split(" - ").map((p) => p && p.trim());
    if (!homeTeam || !awayTeam) {
      throw new Error(`Linia ${i + 1}: lipsește " - " între echipe.`);
    }
    const kickoffAt = timePart.replace(" ", "T");
    if (isNaN(new Date(kickoffAt).getTime())) {
      throw new Error(`Linia ${i + 1}: data/ora nu e validă ("${timePart}").`);
    }
    return { homeTeam, awayTeam, kickoffAt };
  });
}

// Creează toate meciurile dintr-un text lipit, dintr-o dată, pentru o etapă.
export async function bulkCreateMatches(gameweekId, text) {
  const parsed = parseMatchesText(text);
  for (const m of parsed) {
    await createMatch({ gameweekId, ...m });
  }
  return parsed.length;
}

// Șterge TOT (sezoane, etape, meciuri) — folosit doar pentru curățarea
// datelor de test înainte de lansarea reală. Ireversibil.
export async function resetAllTestData() {
  const collections = ["matches", "gameweeks", "seasons"];
  let deleted = 0;
  for (const name of collections) {
    const snap = await getDocs(collection(db, name));
    for (const d of snap.docs) {
      await deleteDoc(doc(db, name, d.id));
      deleted++;
    }
  }
  return deleted;
}

// Setează cele 3 Meciurile Săptămânii pentru o etapă — un singur câmp
// array pe documentul gameweek, suprascris integral la fiecare salvare
// (nu adăugare incrementală). Validare minimă client-side: exact 3 ID-uri.
export async function setFeaturedMatches(gameweekId, matchIds) {
  if (!Array.isArray(matchIds) || matchIds.length !== 3) {
    throw new Error("Trebuie să alegi exact 3 Meciurile Săptămânii.");
  }
  await updateDoc(doc(db, "gameweeks", gameweekId), { featuredMatchIds: matchIds });
}

// Șterge UN meci, curățând tot ce ar rămâne orfan după el:
// 1) predicțiile userilor pentru acel meci (predictions/{matchId}_{uid});
// 2) Jokerii care indicau exact acel meci (jokers/{gameweekId}_{uid});
// 3) referința la meci din gameweek.featuredMatchIds, dacă era acolo;
// 4) documentul meciului însuși, la final.
// Nu e o tranzacție atomică (interogările nu pot fi combinate sigur cu
// scrieri într-o singură tranzacție Firestore) — pentru date de test,
// riscul unei erori la jumătatea drumului e acceptabil; operația poate
// fi reluată în siguranță (fiecare pas e idempotent).
export async function deleteMatch(matchId, gameweekId) {
  const predSnap = await getDocs(query(collection(db, "predictions"), where("matchId", "==", matchId)));
  for (const d of predSnap.docs) {
    await deleteDoc(doc(db, "predictions", d.id));
  }

  const jokerSnap = await getDocs(query(collection(db, "jokers"), where("matchId", "==", matchId)));
  for (const d of jokerSnap.docs) {
    await deleteDoc(doc(db, "jokers", d.id));
  }

  const gwSnap = await getDoc(doc(db, "gameweeks", gameweekId));
  if (gwSnap.exists()) {
    const featured = gwSnap.data().featuredMatchIds || [];
    if (featured.includes(matchId)) {
      await updateDoc(doc(db, "gameweeks", gameweekId), {
        featuredMatchIds: featured.filter((id) => id !== matchId),
      });
    }
  }

  await deleteDoc(doc(db, "matches", matchId));
}
