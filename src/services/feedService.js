import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, runTransaction, serverTimestamp,
  query, where, orderBy, limit as fbLimit,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  detectRankChangeEvents, buildMatchFinalEvent, buildJokerEvent, buildUpcomingMatchEvent, buildLiveMatchEvent,
  mergeFeedEvents, FEED_CATEGORIES,
} from "./feedEngine";
import { listGeneralLeaderboard, listAllUsers, listActiveUserIds } from "./adminService";
import { getUserPublicProfiles } from "./profilesService";
import { EDITORIAL_ARTICLES } from "../feedContent/editorialContent";
import { FUN_ITEMS } from "../feedContent/funContent";
import { CLUB_ALIASES } from "../assets/clubs/index.js";
import { slugify } from "../utils/slugify";

const RANK_SNAPSHOT_DOC = doc(db, "feedState", "rankSnapshot");
// Cât de departe în viitor mai contează un meci ca "urmează" — o
// fereastră de o săptămână, nu toate meciurile viitoare din tot sezonul.
const UPCOMING_WINDOW_MS = 7 * 24 * 3600 * 1000;

// ── LIVE EVENTS — scrise o singură dată per eveniment (ID determinist
// pe tranziție, nu pe timestamp), citite din Firestore, niciodată
// regenerate din nimic la fiecare încărcare. ──
export async function saveFeedEvents(events) {
  await Promise.all(events.map((e) => setDoc(doc(db, "feedEvents", e.id), { ...e }, { merge: true })));
}

export async function listLiveFeedEvents({ max = 150 } = {}) {
  const snap = await getDocs(query(collection(db, "feedEvents"), orderBy("ts", "desc"), fbLimit(max)));
  return snap.docs.map((d) => d.data());
}

// ── Curățare țintită — DOAR evenimentele "liveevent_" (goluri/cartonașe
// roșii), scrise cu textul vechi înainte de reparație. Nu atinge nimic
// altceva din Feed (clasament, rezultate finale, Jokeri, FUN) — golurile
// viitoare se rescriu automat, corect, la următorul eveniment real.
export async function deleteAllLiveMatchEvents() {
  const snap = await getDocs(collection(db, "feedEvents"));
  const staleIds = snap.docs.map((d) => d.id).filter((id) => id.startsWith("liveevent_"));
  await Promise.all(staleIds.map((id) => deleteDoc(doc(db, "feedEvents", id))));
  return staleIds.length;
}

// ── Schimbări de clasament — PERSISTENTE, într-o tranzacție (vezi
// comentariul din versiunea anterioară — neschimbat aici, era deja
// corect). ──
export async function processRankChanges() {
  const rowsRaw = await listGeneralLeaderboard();
  const rows = rowsRaw.map((r, i) => ({ ...r, rank: i + 1 }));

  const events = await runTransaction(db, async (tx) => {
    const snap = await tx.get(RANK_SNAPSHOT_DOC);
    const prevState = snap.exists() ? snap.data().ranks : null;

    const detected = detectRankChangeEvents(prevState, rows);

    const nextState = {};
    rows.forEach((r) => { nextState[r.uid] = { rank: r.rank, points: r.seasonPoints || 0 }; });
    tx.set(RANK_SNAPSHOT_DOC, { ranks: nextState, updatedAt: serverTimestamp() });

    detected.forEach((e) => tx.set(doc(db, "feedEvents", e.id), e, { merge: true }));
    return detected;
  });

  return { events };
}

// ── ROOT CAUSE 2 din audit — reparat aici, nu doar patch-uit: clasamentul
// GENERAL (users.seasonPoints, folosit mai sus) e ÎNGHEȚAT toată etapa —
// se actualizează DOAR la finalizeGameweek. Meciuri care se termină ÎN
// TIMPUL etapei nu mișcă seasonPoints deloc, deci processRankChanges()
// de mai sus nu poate detecta NIMIC din mișcarea reală a etapei curente,
// oricâte meciuri s-ar termina. Sursa corectă pentru asta e
// gameweekLiveScores — se republică AUTOMAT după fiecare rezultat salvat
// (adminService.handleSaveResult → recomputeAndPublish → publishLiveScores),
// deci chiar reflectă etapa în timp real. Snapshot separat, per etapă
// (cheie cu gameweekId) — se resetează natural la fiecare etapă nouă,
// nu se amestecă cu istoricul altor etape sau cu clasamentul general. ──
export async function processLiveRankChanges(gameweekId) {
  if (!gameweekId) return { events: [] };
  const snap = await getDocs(query(collection(db, "gameweekLiveScores"), where("gameweekId", "==", gameweekId)));
  if (snap.empty) return { events: [] };

  const activeUids = await listActiveUserIds();
  const rawRows = snap.docs.map((d) => d.data()).filter((r) => activeUids.has(r.userId));
  if (rawRows.length === 0) return { events: [] };

  const sorted = [...rawRows].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
  const profiles = await getUserPublicProfiles(sorted.map((r) => r.userId));
  const rows = sorted.map((r, i) => ({
    uid: r.userId,
    rank: typeof r.rank === "number" ? r.rank : i + 1,
    nickname: profiles[r.userId]?.nickname || r.userId,
    seasonPoints: r.totalPoints, // reutilizăm câmpul generic așteptat de detectRankChangeEvents
  }));

  const snapshotRef = doc(db, "feedState", `rankSnapshotEtapa_${gameweekId}`);
  const events = await runTransaction(db, async (tx) => {
    const prevSnap = await tx.get(snapshotRef);
    const prevState = prevSnap.exists() ? prevSnap.data().ranks : null;

    const detected = detectRankChangeEvents(prevState, rows, { idPrefix: `rank_etapa_${gameweekId}`, scopeLabel: " etapei" });

    const nextState = {};
    rows.forEach((r) => { nextState[r.uid] = { rank: r.rank, points: r.seasonPoints || 0 }; });
    tx.set(snapshotRef, { ranks: nextState, gameweekId, updatedAt: serverTimestamp() });

    detected.forEach((e) => tx.set(doc(db, "feedEvents", e.id), e, { merge: true }));
    return detected;
  });

  return { events };
}

// ── Cine a nimerit scorul EXACT la un meci — citit din matchPoints
// (scorePoints === 120, aceeași sursă de adevăr folosită peste tot
// pentru scoring, nu predicțiile brute recitite separat). Query simplu
// pe un singur câmp (matchId) — nu cere index compus. ──
async function getExactScorersForMatch(matchId) {
  const snap = await getDocs(query(collection(db, "matchPoints"), where("matchId", "==", matchId)));
  const exactUids = snap.docs.map((d) => d.data()).filter((p) => p.scorePoints === 120).map((p) => p.uid);
  if (exactUids.length === 0) return [];
  const profiles = await getUserPublicProfiles(exactUids);
  return exactUids.map((uid) => profiles[uid]?.nickname || uid);
}

// ── Meciuri terminate — eveniment de scor final, ȘI ștergerea oricărui
// eveniment "urmează" pentru același meci (nu mai are sens să apară ca
// "următor" un meci deja terminat — REGULA ZERO se aplică și aici). ──
export async function processFinishedMatches(matches) {
  const events = (await Promise.all(
    matches.map(async (m) => buildMatchFinalEvent(m, await getExactScorersForMatch(m.id).catch(() => [])))
  )).filter(Boolean);
  if (events.length > 0) {
    await saveFeedEvents(events);
    await Promise.all(matches.map((m) => deleteDoc(doc(db, "feedEvents", `upcoming_${m.id}`)).catch(() => {})));
  }
  return events;
}

// ── Eveniment LIVE (gol / cartonaș roșu) — apelat direct din Admin,
// imediat ce introduce evenimentul. Un singur eveniment nou în Feed per
// apel — ID determinist, deci reîncercarea unei scrieri eșuate nu
// dublează nimic. ──
export async function processLiveMatchEvent(match, event) {
  const feedEvent = buildLiveMatchEvent(match, event);
  if (feedEvent) await saveFeedEvents([feedEvent]);
  return feedEvent;
}

export async function processJokerActivation(joker, match, nickname) {
  const event = buildJokerEvent(joker, match, nickname);
  if (event) await saveFeedEvents([event]);
  return event;
}

// ── Fragmente editoriale pentru UN meci — STRICT legate de echipele
// care joacă ACUM, nu un articol de club permanent. Caută în banca de
// conținut (editorialContent.js) după teamId, potrivit din numele real
// al echipei (slugify — aceeași convenție ca siglele de club, deja
// verificată). Maxim 2 fragmente per echipă, ca detaliul să rămână
// citibil, nu un perete de text. ──
// Rezolvă numele unei echipe (oricum ar fi scris — "PSG", "CFR Cluj",
// "Universitatea Craiova") la teamId-ul canonic din banca editorială —
// REFOLOSEȘTE CLUB_ALIASES, deja construit pentru exact aceeași problemă
// la siglele de club. Trece rezultatul din nou prin slugify — unele
// intrări din CLUB_ALIASES mapează spre un NUME afișabil ("CFR Cluj"),
// nu spre un slug ("cfr-cluj"), găsit în verificare — fără al doilea
// slugify, potrivirea ar fi picat exact pentru echipele din SuperLiga.
function resolveTeamId(rawName) {
  const slug = slugify(rawName);
  const aliased = CLUB_ALIASES[slug];
  return aliased ? slugify(aliased) : slug;
}

// Hash simplu, determinist — ACELAȘI meci arată mereu ACELEAȘI fragmente
// (nu se schimbă la fiecare refresh, ar fi confuz), dar meciuri DIFERITE
// ale aceleiași echipe rotesc prin restul băncii — cu zeci de meciuri
// Real Madrid/Barcelona pe sezon, feed-ul nu repetă mereu exact aceleași
// 4 fapte.
function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function pickRotating(arr, count, seed) {
  if (arr.length <= count) return arr;
  const start = seed % arr.length;
  const result = [];
  for (let i = 0; i < count; i++) result.push(arr[(start + i) % arr.length]);
  return result;
}

function getEditorialSnippetsForMatch(match) {
  const homeId = resolveTeamId(match.homeTeam);
  const awayId = resolveTeamId(match.awayTeam);
  // Selecție cu variație reală: până la 2 fapte fotbalistice + până la 2
  // fapte de oraș/istorie (identificate după title === "Despre oraș"),
  // rotite pe baza ID-ului meciului — nu mereu primele N din array.
  const forTeam = (teamId) => {
    const all = EDITORIAL_ARTICLES.filter((a) => a.teamId === teamId);
    const football = all.filter((a) => a.title !== "Despre oraș");
    const city = all.filter((a) => a.title === "Despre oraș");
    const seed = hashSeed(match.id + teamId);
    return [...pickRotating(football, 2, seed), ...pickRotating(city, 2, seed)];
  };
  return [...forTeam(homeId), ...forTeam(awayId)];
}

// ── Meciuri care urmează — DOAR cele reale, din matches (status
// "scheduled"), într-o fereastră de 7 zile. Fiecare primește fragmente
// editoriale STRICT dacă există conținut pentru echipele respective —
// dacă nu există nimic în bancă pentru niciuna din echipe, evenimentul
// tot apare (meciul e real), doar fără secțiunea de context. ──
export async function processUpcomingMatches(matches, featuredMatchIds = []) {
  const now = Date.now();
  const upcoming = matches.filter((m) => {
    if (m.status !== "scheduled") return false;
    const kickoffMs = m.kickoffAt?.toMillis ? m.kickoffAt.toMillis() : null;
    return kickoffMs && kickoffMs > now && kickoffMs - now < UPCOMING_WINDOW_MS;
  });

  const events = upcoming.map((m) => {
    const snippets = getEditorialSnippetsForMatch(m);
    return buildUpcomingMatchEvent(m, snippets, featuredMatchIds.includes(m.id));
  });

  if (events.length > 0) await saveFeedEvents(events);
  return events;
}

// ── FUN — conținut de bază din cod + adăugat de admin din Firestore. ──
export async function listAdminFunItems() {
  const snap = await getDocs(collection(db, "feedFunItems"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function addFunItem({ label, text }) {
  const id = `custom-${Date.now()}`;
  await setDoc(doc(db, "feedFunItems", id), { label, text, createdAt: serverTimestamp() });
  return id;
}
export async function deleteFunItem(id) {
  await deleteDoc(doc(db, "feedFunItems", id));
}

// ── Feed-ul complet — DOAR evenimente reale: clasament, rezultate,
// jokeri, meciuri care urmează (cu context editorial DOAR dacă
// relevant), FUN. NIMIC editorial de sine stătător. ──
export async function loadFullFeed() {
  const [live, users, adminFun] = await Promise.all([listLiveFeedEvents(), listAllUsers(), listAdminFunItems()]);

  const fun = [
    ...FUN_ITEMS.map((f) => ({ id: `fun_${f.id}`, label: f.label, text: f.text })),
    ...adminFun.map((f) => ({ id: `fun_${f.id}`, label: f.label, text: f.text })),
  ].map((f) => ({
    id: f.id, category: FEED_CATEGORIES.FUN, priority: 15, ts: Date.now(),
    icon: "fun", important: false, title: f.text, subtitle: f.label,
  }));

  return { merged: mergeFeedEvents(live, fun), users };
}

// ── Pentru Admin → Feed: evenimentele LIVE recente (inclusiv "urmează",
// separate acum de conceptul de "articol editorial permanent" care nu
// mai există). ──
export async function listRecentEventsForAdmin({ max = 50 } = {}) {
  return listLiveFeedEvents({ max });
}
