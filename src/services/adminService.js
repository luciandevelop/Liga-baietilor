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
  writeBatch,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { computeMatchPoints, computeRankingBonuses } from "./scoringEngine";
import { resolveCompetitionPreset } from "../competitionThemes";

// Aceeași regulă de lock ca în predictionsService.LOCK_MINUTES_BEFORE_KICKOFF
// (30 min înainte de kickoff) — NU importată de-acolo intenționat, ca să nu
// creăm un import circular (predictionsService.js importă deja listMatches
// din acest fișier). Dacă schimbi pragul de lock, schimbă-l ȘI aici.
const LIVE_PUBLISH_LOCK_MS = 30 * 60 * 1000;
function isLockedForPublish(match) {
  const kickoffMs = match?.kickoffAt?.toMillis ? match.kickoffAt.toMillis() : null;
  if (kickoffMs === null) return false;
  return Date.now() >= kickoffMs - LIVE_PUBLISH_LOCK_MS;
}

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

const VALID_MATCH_STATUSES = ["scheduled", "live", "paused", "finished", "postponed", "cancelled"];

export async function createMatch({ gameweekId, homeTeam, awayTeam, kickoffAt, competitionId, competitionName, competitionColor }) {
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
    // Competiția e denormalizată direct pe meci (nu doar un id de căutat
    // în altă parte) — cerut explicit, ca fiecare meci să-și poarte
    // singur identitatea vizuală. NU stocăm un URL de logo aici: fișierele
    // din assets/ primesc alt hash la fiecare build Vite, deci un URL
    // salvat în Firestore ar deveni stale la următorul deploy. Logo-ul se
    // rezolvă mereu live, din competitionId, via CompetitionLogo.
    competitionId: competitionId ?? null,
    competitionName: competitionName ?? null,
    competitionColor: competitionColor ?? null,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

// Schimbă statusul unui meci — ORICE tranziție e permisă, fără validare
// de "flux" (Programat→Live→Final etc nu e impusă). Statusul și scorul
// rămân independente: asta doar scrie câmpul `status`, nu atinge
// realScoreA/B/Corners/Cards (acelea rămân responsabilitatea
// saveMatchResult, apelată separat).
export async function updateMatchStatus(matchId, status) {
  if (!VALID_MATCH_STATUSES.includes(status)) {
    throw new Error(`Status invalid: "${status}". Valorile permise: ${VALID_MATCH_STATUSES.join(", ")}.`);
  }
  await updateDoc(doc(db, "matches", matchId), { status });
}

export async function listMatches(gameweekId) {
  // Același motiv — fără orderBy() în query, sortăm în JS după kickoffAt.
  const snap = await getDocs(query(collection(db, "matches"), where("gameweekId", "==", gameweekId)));
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return list.sort((a, b) => a.kickoffAt.toMillis() - b.kickoffAt.toMillis());
}

// Toate meciurile din toate etapele — DOAR pentru Health Check (citire
// pură, fără filtru de etapă). Nu e folosită de niciun alt ecran.
export async function listAllMatches() {
  const snap = await getDocs(collection(db, "matches"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Corectează manual un meci deja existent — kickoffAt (text "YYYY-MM-DD
// HH:mm", ora de perete România, parsată cu ACELAȘI parser strict folosit
// la import) și/sau competiția. NU rulează automat, NU șterge/recreează
// nimic — un singur updateDoc, cu exact câmpurile date. Fiecare parametru
// e opțional — trimiți doar ce vrei să corectezi.
export async function updateMatch(matchId, { kickoffAtWallClock, competitionId, competitionName, competitionColor } = {}) {
  const patch = {};
  if (kickoffAtWallClock !== undefined) {
    const utcDate = parseWallClockDateTime(kickoffAtWallClock, "Corecție manuală");
    patch.kickoffAt = Timestamp.fromDate(utcDate);
  }
  if (competitionId !== undefined) patch.competitionId = competitionId || null;
  if (competitionName !== undefined) patch.competitionName = competitionName || null;
  if (competitionColor !== undefined) patch.competitionColor = competitionColor || null;
  if (Object.keys(patch).length === 0) return;
  await updateDoc(doc(db, "matches", matchId), patch);
}

// ── Health Check — DOAR detectare, nu modifică nimic ──
// Verifică o listă de meciuri deja salvate și semnalează probleme
// probabile. Fiecare regulă e euristică și explicată în text — admin
// decide, nimic nu se corectează singur.
const SEASON_YEAR_MIN = 2025;
const SEASON_YEAR_MAX = 2028;

export function runMatchHealthCheck(matches) {
  const now = Date.now();
  const issues = [];
  const dupGroups = new Map();

  matches.forEach((m) => {
    const problems = [];
    const kickoffMs = m.kickoffAt?.toMillis ? m.kickoffAt.toMillis() : null;

    if (kickoffMs === null) {
      problems.push("Nu are deloc o dată/oră de start salvată.");
    } else {
      const kickoffDate = new Date(kickoffMs);

      // dată din trecut + status încă "Programat"
      if (kickoffMs < now && (!m.status || m.status === "scheduled")) {
        problems.push("Data e deja în trecut, dar statusul e tot „Programat” — probabil trebuia actualizat manual sau data e greșită.");
      }

      // dată imposibilă / în afara intervalului rezonabil al sezonului
      const year = kickoffDate.getUTCFullYear();
      if (year < SEASON_YEAR_MIN || year > SEASON_YEAR_MAX) {
        problems.push(`Anul salvat (${year}) e în afara intervalului rezonabil pentru acest sezon (${SEASON_YEAR_MIN}–${SEASON_YEAR_MAX}).`);
      }

      // oră suspect de devreme dimineața, în România — fereastra tipică
      // în care cade o oră de seară interpretată greșit ca UTC (vechiul
      // bug). NU e o certitudine, doar un semnal de verificat manual.
      const bucharestParts = getZonedParts(kickoffDate, BUCHAREST_TZ);
      if (bucharestParts.hour >= 0 && bucharestParts.hour <= 4) {
        const hh = String(bucharestParts.hour).padStart(2, "0");
        const mm = String(bucharestParts.minute).padStart(2, "0");
        problems.push(`Ora afișată (${hh}:${mm}, România) e foarte devreme dimineața — posibil efect al vechiului bug de fus orar. Verifică manual ora reală a meciului.`);
      }

      // grupare pentru detectarea duplicatelor
      const key = `${(m.homeTeam || "").toLowerCase()}|${(m.awayTeam || "").toLowerCase()}|${kickoffMs}`;
      if (!dupGroups.has(key)) dupGroups.set(key, []);
      dupGroups.get(key).push(m);
    }

    // competiție lipsă
    if (!m.competitionId && !m.competitionName) {
      problems.push("Nu are competiție salvată (competitionId/competitionName lipsă).");
    }

    if (problems.length > 0) {
      issues.push({ match: m, problems });
    }
  });

  // meciuri identice — adăugate separat, ca să apară grupul complet
  dupGroups.forEach((group) => {
    if (group.length > 1) {
      group.forEach((m) => {
        issues.push({
          match: m,
          problems: [`Duplicat — există ${group.length} meciuri identice (aceleași echipe, aceeași oră salvată).`],
        });
      });
    }
  });

  return issues;
}

// Parsează strict "YYYY-MM-DD HH:mm" și construiește instantul UTC real
// din ora de perete Bucharest (folosind zonedTimeToUtc, deja testat mai
// sus pentru granițele săptămânii). ACESTA ERA BUG-UL DE DATĂ GREȘITĂ:
// codul vechi făcea `new Date("2026-08-06T21:00")` — un string FĂRĂ fus
// orar explicit — a cărui interpretare depinde de fusul dispozitivului
// care rulează codul, nu e garantat Bucharest. Rezultatul putea aluneca
// pe ziua următoare (sau anterioară) în funcție de fus/oră, exact
// simptomul raportat (meci real pe 6 august, afișat pe 7 august).
// Acum ora de perete introdusă de admin e mereu interpretată explicit ca
// Europe/Bucharest, indiferent de dispozitiv.
function parseWallClockDateTime(str, context) {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(str);
  if (!m) {
    throw new Error(`${context}: formatul datei/orei trebuie să fie "YYYY-MM-DD HH:mm" (ex: 2026-08-06 21:00), am primit "${str}".`);
  }
  const [, yStr, moStr, dStr, hStr, miStr] = m;
  const y = Number(yStr), mo = Number(moStr), d = Number(dStr), h = Number(hStr), mi = Number(miStr);
  if (mo < 1 || mo > 12) throw new Error(`${context}: lună invalidă ("${moStr}").`);
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  if (d < 1 || d > daysInMonth) throw new Error(`${context}: zi invalidă ("${dStr}") pentru luna ${moStr}.`);
  if (h < 0 || h > 23) throw new Error(`${context}: oră invalidă ("${hStr}").`);
  if (mi < 0 || mi > 59) throw new Error(`${context}: minut invalid ("${miStr}").`);
  return zonedTimeToUtc(y, mo, d, h, mi, 0, 0, BUCHAREST_TZ);
}

// Parsează text lipit, un meci pe linie, format:
// "Echipa Gazdă - Echipa Oaspete | 2026-09-16 21:00"
// Suportă opțional antete de competiție ("# Champions League") — orice
// meci de sub un antet primește competiția aceea, până la următorul antet
// sau până la finalul textului. Fără niciun antet, meciurile rămân fără
// competiție (comportament vechi, neschimbat — retrocompatibil).
//
// Validează la parsare (cerut explicit): dată/oră (aruncă eroare, blochează
// importul — o dată invalidă nu poate fi stocată sensibil), competiție
// necunoscută (avertisment, NU blochează — poate fi o competiție nouă,
// legitimă, doar încă neadăugată în presetări), duplicate evidente ÎN
// ACELAȘI text lipit (aceleași echipe + aceeași oră exactă — avertisment,
// meciul al doilea e sărit, nu creat a doua oară).
//
// Returnează { matches, warnings } — kickoffAt e acum un Date real
// (instant UTC corect), nu un string.
export function parseMatchesText(text) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  let current = null; // { id, name, color } | null

  const matches = [];
  const warnings = [];
  const seenKeys = new Set();

  lines.forEach((line, i) => {
    if (line.startsWith("#")) {
      const name = line.slice(1).trim();
      if (!name) throw new Error(`Linia ${i + 1}: antet de competiție gol ("#" fără nume).`);
      const preset = resolveCompetitionPreset(name);
      if (preset) {
        current = { id: preset.id, name: preset.name, color: preset.primaryColor };
      } else {
        current = { id: null, name, color: null };
        warnings.push(`Linia ${i + 1}: competiție necunoscută "${name}" — salvată fără culoare/logo presetat.`);
      }
      return;
    }

    const [teamsPart, timePart] = line.split("|").map((p) => p && p.trim());
    if (!teamsPart || !timePart) {
      throw new Error(`Linia ${i + 1}: format greșit, lipsește "|" (echipe | dată oră).`);
    }
    const [homeTeam, awayTeam] = teamsPart.split(" - ").map((p) => p && p.trim());
    if (!homeTeam || !awayTeam) {
      throw new Error(`Linia ${i + 1}: lipsește " - " între echipe.`);
    }
    const kickoffAt = parseWallClockDateTime(timePart, `Linia ${i + 1}`);

    const dupKey = `${homeTeam.toLowerCase()}|${awayTeam.toLowerCase()}|${kickoffAt.getTime()}`;
    if (seenKeys.has(dupKey)) {
      warnings.push(`Linia ${i + 1}: duplicat evident (${homeTeam} - ${awayTeam}, aceeași oră) — nu a fost adăugat a doua oară.`);
      return;
    }
    seenKeys.add(dupKey);

    matches.push({
      homeTeam,
      awayTeam,
      kickoffAt,
      competitionId: current?.id ?? null,
      competitionName: current?.name ?? null,
      competitionColor: current?.color ?? null,
    });
  });
  return { matches, warnings };
}

// Creează toate meciurile dintr-un text lipit, dintr-o dată, pentru o etapă.
// Verifică suplimentar duplicate față de meciurile DEJA existente în etapă
// (nu doar în interiorul textului curent) — aceleași echipe + aceeași oră.
export async function bulkCreateMatches(gameweekId, text) {
  const { matches: parsed, warnings } = parseMatchesText(text);
  const existing = await listMatches(gameweekId);
  const existingKeys = new Set(
    existing.map((m) => `${m.homeTeam.toLowerCase()}|${m.awayTeam.toLowerCase()}|${m.kickoffAt.toMillis()}`)
  );

  let created = 0;
  for (const m of parsed) {
    const key = `${m.homeTeam.toLowerCase()}|${m.awayTeam.toLowerCase()}|${m.kickoffAt.getTime()}`;
    if (existingKeys.has(key)) {
      warnings.push(`${m.homeTeam} - ${m.awayTeam}: există deja în etapă la aceeași oră — nu a fost adăugat din nou.`);
      continue;
    }
    await createMatch({ gameweekId, ...m });
    created++;
  }
  return { created, warnings };
}

// Șterge TOT (sezoane, etape, meciuri) — folosit doar pentru curățarea
// datelor de test înainte de lansarea reală. Ireversibil.
export async function resetAllTestData() {
  const collections = ["matches", "gameweeks", "seasons", "gameweekLiveScores"];
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

  // Breakdown COMPLET, per user per meci — nu doar meciurile cu predicție
  // și rezultat (cum era înainte). Fiecare meci al etapei apare mereu în
  // breakdown, cu un `status` explicit:
  //  - "scored"        — predicție validă + rezultat real → punctaj calculat normal
  //  - "pending"        — meciul încă nu are rezultat real introdus
  //  - "no-prediction"  — meciul are rezultat, dar userul nu a pontat deloc
  // Asta permite UI-ului (Admin Preview / Clasament live / Player Detail) să
  // arate exact "meciuri deja punctate" vs. "meciuri în așteptare", fără nicio
  // formulă duplicată — totul vine din computeMatchPoints, aceeași sursă unică.
  const rows = allUids.map((uid) => {
    let pointsFromMatches = 0;
    const breakdown = {};

    matches.forEach((match) => {
      const p = (predictionsByUser[uid] || []).find((pr) => pr.matchId === match.id) || null;
      const isFeatured = featuredMatchIds.includes(match.id);
      const isJoker = jokerMatchByUser[uid] === match.id;
      const hasResult = isMatchResultComplete(match);

      const matchSnapshot = {
        matchId: match.id,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        kickoffAt: match.kickoffAt,
        prediction: p ? { scoreA: p.scoreA, scoreB: p.scoreB, corners: p.corners, cards: p.cards } : null,
        real: hasResult
          ? { scoreA: match.realScoreA, scoreB: match.realScoreB, corners: match.realCorners, cards: match.realCards }
          : null,
        isFeatured,
        isJoker,
      };

      if (!hasResult) {
        breakdown[match.id] = { ...matchSnapshot, status: "pending" };
        return;
      }
      if (!p) {
        breakdown[match.id] = { ...matchSnapshot, status: "no-prediction" };
        return;
      }

      const result = computeMatchPoints({ prediction: p, match, isFeatured, isJoker });
      if (!result) {
        // predicție incompletă (fără scor) — tratată tot ca "no-prediction"
        // pentru scop de afișare, nu contribuie puncte.
        breakdown[match.id] = { ...matchSnapshot, status: "no-prediction" };
        return;
      }

      pointsFromMatches += result.total;
      breakdown[match.id] = { ...matchSnapshot, status: "scored", ...result };
    });

    return { uid, pointsFromMatches, breakdown };
  });

  const ranked = computeRankingBonuses(rows);
  const withTotals = ranked.map((r) => ({ ...r, totalPoints: r.pointsFromMatches + r.rankingBonus }));
  withTotals.sort((a, b) => a.rank - b.rank);

  return {
    gameweekId,
    rows: withTotals,
    incompleteMatchIds,
    totalMatches: matches.length,
    matches,
    featuredMatchIds,
  };
}

// Preview — DOAR calcul, nicio scriere. Admin vede exact ce s-ar
// întâmpla, INCLUSIV câte meciuri nu au încă rezultat complet.
export async function previewGameweekResults(gameweekId) {
  return computeGameweekResults(gameweekId);
}

// ── Clasament LIVE public, sigur pentru useri normali ──────────────────
//
// computeGameweekResults (mai sus) e ADMIN-ONLY prin natura ei: interoghează
// predictions/jokers ale TUTUROR userilor, fără nicio filtrare de privacy —
// corect pentru Admin Preview (adminul trebuie să vadă tot ca să audit-eze
// matematic), GREȘIT dacă un user normal ar rula aceeași funcție (ar primi
// în browser pronosticul altora înainte de lock).
//
// Soluția: adminul (singurul care oricum rulează computeGameweekResults)
// calculează totul complet, apoi scrie o COPIE SANITIZATĂ, per user, într-o
// colecție publică nouă `gameweekLiveScores/{gameweekId}_{uid}` — citibilă
// de orice user semnat. Sanitizarea se face AICI, înainte de scriere, nu în
// UI: pentru fiecare meci "scored" care încă NU e locked (kickoff - 30min
// nu a trecut încă), câmpul `prediction` e ȘTERS complet din documentul
// public și înlocuit cu `predictionHidden: true` — pronosticul lui X nu
// ajunge NICIODATĂ în clientul lui Y înainte de lock, pentru că nu e scris
// niciodată în documentul pe care Y îl citește. Punctajul (numărul de
// puncte) rămâne vizibil — cerința explicită e să ascundem PRONOSTICUL, nu
// scorul.
function sanitizeBreakdownForPublish(breakdown) {
  const clean = {};
  Object.entries(breakdown).forEach(([matchId, m]) => {
    const locked = isLockedForPublish({ kickoffAt: m.kickoffAt });

    // isJoker e o alegere PERSONALĂ/secretă (spre deosebire de isFeatured,
    // care e o decizie publică a adminului, anunțată tuturor) — nu trebuie
    // să ajungă la ceilalți înainte de lock, indiferent de status. Doar
    // flagul e ascuns; NU atingem multiplier/finalMatchPoints — punctajele
    // rămân afișabile normal (regulă explicită, separată de pronostic).
    const isJokerSafe = locked ? m.isJoker : false;

    if (!m.prediction) {
      clean[matchId] = { ...m, isJoker: isJokerSafe };
      return;
    }
    if (locked) {
      clean[matchId] = m; // după lock, pronosticul + Jokerul sunt publice conform regulii existente
    } else {
      const { prediction, ...rest } = m;
      clean[matchId] = { ...rest, prediction: null, predictionHidden: true, isJoker: isJokerSafe };
    }
  });
  return clean;
}

// Recalculează TOT (aceeași sursă unică, computeGameweekResults) și publică
// o copie sanitizată per user în gameweekLiveScores. De apelat de admin
// după orice schimbare care afectează punctajul: rezultat nou salvat,
// Meciurile Săptămânii schimbate, sau manual din buton. NU scrie nimic în
// gameweekScores (acela rămâne DOAR pentru finalizare) și nu atinge
// seasonPoints/gameweeksPlayed — complet separat de finalizare, sigur de
// rulat oricând, oricât de des.
export async function publishLiveScores(gameweekId) {
  const results = await computeGameweekResults(gameweekId);

  const batch = writeBatch(db);
  results.rows.forEach((r) => {
    const ref = doc(db, "gameweekLiveScores", `${gameweekId}_${r.uid}`);
    batch.set(ref, {
      gameweekId,
      userId: r.uid,
      rank: r.rank,
      pointsFromMatches: r.pointsFromMatches,
      rankingBonus: r.rankingBonus,
      totalPoints: r.totalPoints,
      breakdown: sanitizeBreakdownForPublish(r.breakdown),
      computedAt: serverTimestamp(),
    });
  });
  await batch.commit();

  return { publishedRows: results.rows.length, incompleteMatchIds: results.incompleteMatchIds };
}

// Citire live (real-time) a gameweekLiveScores pentru useri normali —
// NICIODATĂ predictions/jokers direct. onSnapshot, nu polling: userul
// primește update automat de fiecare dată când adminul republică (după un
// rezultat nou salvat), fără request-uri repetate. Întoarce funcția de
// unsubscribe — apelantul TREBUIE să o cheme la unmount.
export function listenLiveGameweekScores(gameweekId, onRows) {
  const q = query(collection(db, "gameweekLiveScores"), where("gameweekId", "==", gameweekId));
  return onSnapshot(q, (snap) => {
    const rows = snap.docs.map((d) => d.data());
    // BUG REPARAT: lipsea complet sortarea aici — Firestore întoarce
    // documentele în ordine arbitrară (nu garantat după rank), deci
    // locul 2 putea apărea înaintea locului 1 doar pentru că документul
    // lui avea un ID "mai mic". Aceeași regulă de sortare ca la
    // listGameweekScores (rank salvat, cu fallback la totalPoints pentru
    // rânduri fără rank încă).
    rows.sort((a, b) => {
      const aHasRank = typeof a.rank === "number";
      const bHasRank = typeof b.rank === "number";
      if (aHasRank && bHasRank) return a.rank - b.rank;
      if (aHasRank) return -1;
      if (bHasRank) return 1;
      return (b.totalPoints || 0) - (a.totalPoints || 0);
    });
    onRows(rows);
  });
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
