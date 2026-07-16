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
import { computeMatchPoints, computeRankingBonuses } from "./scoringEngine";

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

function isValidNonNegInt(v) {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

// Salvează rezultatul real al unui meci — actualizează documentul
// matches/{matchId} existent, nu creează o colecție separată.
// Validare STRICTĂ: toate cele 4 valori trebuie prezente și întregi >= 0
// (nu se mai acceptă salvare parțială a rezultatului — cornerele/cartona-
// șele fac parte din "rezultatul final", nu sunt opționale ca la predicții).
// Blocată dacă etapa e deja finalizată — verificat aici, în service, NU
// doar prin disabled în UI.
export async function saveMatchResult(matchId, { realScoreA, realScoreB, realCorners, realCards }) {
  if (!isValidNonNegInt(realScoreA) || !isValidNonNegInt(realScoreB)) {
    throw new Error("Scorul real trebuie completat, întreg, pentru ambele echipe.");
  }
  if (!isValidNonNegInt(realCorners) || !isValidNonNegInt(realCards)) {
    throw new Error("Cornerele și cartonașele reale trebuie completate, întregi (≥0), pentru rezultatul final.");
  }

  const matchSnap = await getDoc(doc(db, "matches", matchId));
  if (!matchSnap.exists()) throw new Error("Meciul nu există.");
  const gameweekId = matchSnap.data().gameweekId;

  const gwSnap = await getDoc(doc(db, "gameweeks", gameweekId));
  if (gwSnap.exists() && gwSnap.data().status === "completed") {
    throw new Error("Etapa e deja finalizată — rezultatele nu mai pot fi modificate.");
  }

  await updateDoc(doc(db, "matches", matchId), { realScoreA, realScoreB, realCorners, realCards });
}

// Un meci are rezultat COMPLET dacă toate cele 4 valori sunt întregi >= 0.
function isMatchResultComplete(m) {
  return (
    isValidNonNegInt(m.realScoreA) &&
    isValidNonNegInt(m.realScoreB) &&
    isValidNonNegInt(m.realCorners) &&
    isValidNonNegInt(m.realCards)
  );
}

// Calcul PUR (fără scriere) al rezultatelor unei etape — folosit atât de
// preview, cât și de finalizare (aceeași sursă de adevăr pentru ambele,
// ca preview-ul afișat adminului să fie mereu exact ce se va scrie).
//
// PARTICIPĂ TOȚI userii din users/, nu doar cei cu predicții — un user
// fără niciun pronostic intră cu pointsFromMatches=0 și poate primi
// penalizarea de ultim loc (nu poate "evita" clasamentul nepontând).
async function computeGameweekResults(gameweekId) {
  const gwSnap = await getDoc(doc(db, "gameweeks", gameweekId));
  if (!gwSnap.exists()) throw new Error("Etapa nu există.");
  const gameweek = gwSnap.data();
  const featuredMatchIds = gameweek.featuredMatchIds || [];

  const matches = await listMatches(gameweekId);
  const matchById = {};
  matches.forEach((m) => { matchById[m.id] = m; });

  const incompleteMatchIds = matches.filter((m) => !isMatchResultComplete(m)).map((m) => m.id);

  // Toate predicțiile pentru meciurile etapei — un query per meci (fără
  // index compus, doar egalitate pe matchId). Admin are acces deja
  // confirmat prin firestore.rules (isAdmin() pe read la predictions).
  const allPredictions = [];
  for (const matchId of Object.keys(matchById)) {
    const snap = await getDocs(query(collection(db, "predictions"), where("matchId", "==", matchId)));
    snap.docs.forEach((d) => allPredictions.push(d.data()));
  }

  const jokerSnap = await getDocs(query(collection(db, "jokers"), where("gameweekId", "==", gameweekId)));
  const jokerMatchByUser = {};
  jokerSnap.docs.forEach((d) => {
    const j = d.data();
    jokerMatchByUser[j.userId] = j.matchId;
  });

  const predictionsByUser = {};
  allPredictions.forEach((p) => {
    if (!predictionsByUser[p.userId]) predictionsByUser[p.userId] = [];
    predictionsByUser[p.userId].push(p);
  });

  // TOȚI userii — sursa participanților, nu doar cei cu predicții.
  const usersSnap = await getDocs(collection(db, "users"));
  const allUids = usersSnap.docs.map((d) => d.id);

  const rows = allUids.map((uid) => {
    let pointsFromMatches = 0;
    const breakdown = {};
    (predictionsByUser[uid] || []).forEach((p) => {
      const match = matchById[p.matchId];
      if (!match) return;
      const isFeatured = featuredMatchIds.includes(p.matchId);
      const isJoker = jokerMatchByUser[uid] === p.matchId;
      const result = computeMatchPoints({ prediction: p, match, isFeatured, isJoker });
      if (result) {
        pointsFromMatches += result.total;
        breakdown[p.matchId] = result;
      }
    });
    return { uid, pointsFromMatches, breakdown };
  });

  const ranked = computeRankingBonuses(rows);
  const withTotals = ranked.map((r) => ({ ...r, totalPoints: r.pointsFromMatches + r.rankingBonus }));
  withTotals.sort((a, b) => a.rank - b.rank);

  return { gameweekId, rows: withTotals, incompleteMatchIds, totalMatches: matches.length };
}

// Preview — DOAR calcul, nicio scriere. Admin vede exact ce s-ar
// întâmpla, INCLUSIV câte meciuri nu au încă rezultat complet.
export async function previewGameweekResults(gameweekId) {
  return computeGameweekResults(gameweekId);
}

// Finalizare IDEMPOTENTĂ: dacă etapa e deja "completed", tranzacția
// citește asta ȘI RETURNEAZĂ IMEDIAT, fără nicio scriere — a doua
// apăsare accidentală a butonului nu poate dubla seasonPoints/
// gameweeksPlayed, indiferent de viteza click-urilor (Firestore
// serializează tranzacțiile concurente pe același document gameweek).
// Calculul (computeGameweekResults) rulează ÎN AFARA tranzacției — e
// pur/idempotent prin construcție; doar SCRIEREA finală e tranzacțională,
// cu citirile (gameweek + fiecare user) înaintea oricărei scrieri.
//
// REFUZ OBLIGATORIU dacă există meciuri fără rezultat complet — verificat
// ÎNAINTE de a porni tranzacția, deci în caz de refuz nu se scrie NIMIC
// (gameweek.status rămâne neschimbat, gameweekScores nu se scrie, users
// nu se ating).
export async function finalizeGameweek(gameweekId) {
  const results = await computeGameweekResults(gameweekId);

  if (results.incompleteMatchIds.length > 0) {
    throw new Error(
      `Nu poți finaliza etapa. ${results.incompleteMatchIds.length} meciuri nu au rezultate complete.`
    );
  }

  const gwRef = doc(db, "gameweeks", gameweekId);

  const outcome = await runTransaction(db, async (tx) => {
    const gwSnap = await tx.get(gwRef);
    if (!gwSnap.exists()) throw new Error("Etapa nu există.");
    if (gwSnap.data().status === "completed") {
      return { alreadyCompleted: true, rows: results.rows };
    }

    const userRefs = results.rows.map((r) => doc(db, "users", r.uid));
    const userSnaps = [];
    for (const ref of userRefs) {
      userSnaps.push(await tx.get(ref));
    }

    results.rows.forEach((r, i) => {
      const scoreRef = doc(db, "gameweekScores", `${gameweekId}_${r.uid}`);
      tx.set(scoreRef, {
        gameweekId,
        userId: r.uid,
        rank: r.rank,
        pointsFromMatches: r.pointsFromMatches,
        rankingBonus: r.rankingBonus,
        totalPoints: r.totalPoints,
        breakdown: r.breakdown,
        computedAt: serverTimestamp(),
      });

      if (userSnaps[i].exists()) {
        const prev = userSnaps[i].data();
        tx.update(userRefs[i], {
          seasonPoints: (prev.seasonPoints || 0) + r.totalPoints,
          gameweeksPlayed: (prev.gameweeksPlayed || 0) + 1,
        });
      }
    });

    tx.update(gwRef, { status: "completed", finalizedAt: serverTimestamp() });
    return { alreadyCompleted: false, rows: results.rows };
  });

  return outcome;
}

// Nickname-uri pentru un set de UID-uri — folosit la afișarea preview-ului
// de clasament (admin) și la ecranul de Clasament (user). users/{uid} e
// deja citibil de orice user autentificat.
export async function getUserNicknames(uids) {
  const result = {};
  await Promise.all(
    uids.map(async (uid) => {
      const snap = await getDoc(doc(db, "users", uid));
      result[uid] = snap.exists() ? snap.data().nickname : uid;
    })
  );
  return result;
}

// Clasamentul unei etape — citit din gameweekScores (populat doar după
// finalizare). Sortare pe `rank` salvat (păstrează exact egalitățile
// calculate la finalizare, ex. 1,1,3) — NU recalculăm rangul din
// totalPoints aici, ca să nu riscăm o altă regulă de tie-break din
// greșeală. Fallback defensiv: documente vechi fără `rank` (dinainte de
// acest fix) merg la coadă, sortate după totalPoints între ele.
export async function listGameweekScores(gameweekId) {
  const snap = await getDocs(query(collection(db, "gameweekScores"), where("gameweekId", "==", gameweekId)));
  const rows = snap.docs.map((d) => d.data());
  rows.sort((a, b) => {
    const aHasRank = typeof a.rank === "number";
    const bHasRank = typeof b.rank === "number";
    if (aHasRank && bHasRank) return a.rank - b.rank;
    if (aHasRank) return -1;
    if (bHasRank) return 1;
    return b.totalPoints - a.totalPoints;
  });
  return rows;
}

// Clasamentul general — direct din users (seasonPoints/gameweeksPlayed),
// deja citibil de orice user autentificat.
export async function listGeneralLeaderboard() {
  const snap = await getDocs(collection(db, "users"));
  const rows = snap.docs.map((d) => d.data());
  rows.sort((a, b) => (b.seasonPoints || 0) - (a.seasonPoints || 0));
  return rows;
}
