import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, runTransaction, serverTimestamp,
  query, where, orderBy, limit as fbLimit,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  detectRankChangeEvents, buildMatchFinalEvent, buildJokerEvent, buildFeaturedMatchEvent,
  mergeFeedEvents, FEED_CATEGORIES,
} from "./feedEngine";
import { listGeneralLeaderboard, listAllUsers } from "./adminService";
import { EDITORIAL_ARTICLES } from "../feedContent/editorialContent";
import { FUN_ITEMS } from "../feedContent/funContent";

const RANK_SNAPSHOT_DOC = doc(db, "feedState", "rankSnapshot");

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

// ── Schimbări de clasament — PERSISTENTE, nu doar per-sesiune. Citește
// ultimul snapshot cunoscut din Firestore, compară cu starea curentă,
// scrie evenimentele + snapshot-ul nou, totul într-o SINGURĂ tranzacție
// — dacă două device-uri apelează asta aproape simultan, unul câștigă
// tranzacția, celălalt vede snapshot-ul deja actualizat și nu mai
// generează nimic în plus (Firestore rulează tranzacția a doua oară
// automat, cu datele proaspete). Asta rezolvă exact ce a fost semnalat:
// "funcționează doar în aceeași sesiune" — acum funcționează chiar
// dacă userul închide aplicația și revine mai târziu, sau dacă
// schimbarea are loc în timp ce nimeni nu are aplicația deschisă (se
// detectează la următoarea deschidere a oricui). ──
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

// ── Meciuri terminate — un eveniment de scor final per meci nou
// terminat (ID determinist -> re-procesarea nu creează duplicate). ──
export async function processFinishedMatches(matches) {
  const events = matches.map((m) => buildMatchFinalEvent(m)).filter(Boolean);
  if (events.length > 0) await saveFeedEvents(events);
  return events;
}

export async function processJokerActivation(joker, match, nickname) {
  const event = buildJokerEvent(joker, match, nickname);
  if (event) await saveFeedEvents([event]);
  return event;
}

export async function processFeaturedMatch(match) {
  const event = buildFeaturedMatchEvent(match);
  await saveFeedEvents([event]);
  return event;
}

// ── EDITORIAL + FUN — conținut de bază din fișiere de configurare
// (curatoriat, nu vrem calitate variabilă din tastare liberă), PLUS un
// strat subțire din Firestore pentru moderare: articole ascunse de
// admin, și FUN adăugat de admin peste lista de bază. ──
export async function listHiddenEditorialIds() {
  const snap = await getDocs(collection(db, "feedEditorialHidden"));
  return new Set(snap.docs.map((d) => d.id));
}
export async function hideEditorialArticle(articleId) {
  await setDoc(doc(db, "feedEditorialHidden", articleId), { hiddenAt: serverTimestamp() });
}
export async function unhideEditorialArticle(articleId) {
  await deleteDoc(doc(db, "feedEditorialHidden", articleId));
}

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

// ── Feed-ul complet, amestecat — FeedScreen.jsx (extins) și
// WelcomeScreen.jsx (primele 7-8). Aplică ascunderile de admin. ──
export async function loadFullFeed() {
  const [live, users, hiddenIds, adminFun] = await Promise.all([
    listLiveFeedEvents(), listAllUsers(), listHiddenEditorialIds(), listAdminFunItems(),
  ]);

  const editorial = EDITORIAL_ARTICLES
    .filter((a) => !hiddenIds.has(a.id))
    .map((a) => ({
      id: `editorial_${a.id}`, category: a.category, priority: 55, ts: a.publishedAtMs,
      icon: a.icon || "info", important: false, title: a.title, subtitle: a.subtitle, article: a,
    }));

  const fun = [
    ...FUN_ITEMS.map((f) => ({ id: `fun_${f.id}`, label: f.label, text: f.text })),
    ...adminFun.map((f) => ({ id: `fun_${f.id}`, label: f.label, text: f.text })),
  ].map((f) => ({
    id: f.id, category: FEED_CATEGORIES.FUN, priority: 15, ts: Date.now(),
    icon: "fun", important: false, title: f.text, subtitle: f.label,
  }));

  return { merged: mergeFeedEvents(live, editorial, fun), users };
}

// ── Pentru Admin → Feed: evenimentele LIVE recente, cu tot detaliul
// (categorie, prioritate, oră, sursă automată/editorial), fără
// amestecul cu editorial/FUN — Admin vrea să verifice EVENIMENTELE
// automate, separat de conținutul curatoriat. ──
export async function listRecentEventsForAdmin({ max = 50 } = {}) {
  return listLiveFeedEvents({ max });
}
