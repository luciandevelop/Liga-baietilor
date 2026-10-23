import { collection, doc, getDoc, getDocs, runTransaction, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { getPlayerStatus } from "./adminService";
import {
  BURSA_TYPE_ID, normalizePortfolio, validatePortfolio, isBursaLocked, canReopenBursa, rankingUidsFor,
} from "./bursaService";

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
// 👑🐸 PRINȚ SAU BROSCOI? — STRATUL FIRESTORE (id intern: bursa-prietenilor)
//
// Algoritmul de calcul e în bursaService.js (funcții PURE, aceleași în Preview, LIVE și rezolvare).
// Aici sunt DOAR operațiile de citire/scriere, fără listeners și fără polling:
//
//   weeklySurprises/{gw}                       (document existent) + câmpuri noi scrise de Admin:
//        bursaActive, bursaLockAt (ora primului meci), bursaClosed, bursaClosedAt
//   weeklySurprises/{gw}/secret/main            config: { pairings, byePlayer, eligibleUids }  (existent)
//   weeklySurprises/{gw}/bursaPicks/{uid}       portofoliul fiecărui jucător { uid, perf[2], contra[2], updatedAt }
//        — PRIVAT până la blocare (regulile propuse, nepublicate încă), apoi public pentru jucătorii logați
//   weeklySurprises/{gw}/bursaMeta/history      istoricul validărilor: entries[versiune] = { pointsByUid }
//
// Punctele LIVE vin din instantaneul existent (gameweeks/{id}.liveSnapshotPointsByUid, liveSnapshotStore.js).
// Punctele definitive se scriu doar de resolveMain (surprisesService.js), prin fluxul existent al Surprizelor Mari.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════

const pubRef = (gw) => doc(db, "weeklySurprises", gw);
const secretRef = (gw) => doc(db, "weeklySurprises", gw, "secret", "main");
const picksCol = (gw) => collection(db, "weeklySurprises", gw, "bursaPicks");
const pickRef = (gw, uid) => doc(db, "weeklySurprises", gw, "bursaPicks", uid); // ca în restul codului: doc(db, ...cale)
const historyRef = (gw) => doc(db, "weeklySurprises", gw, "bursaMeta", "history");

// ── Jucători: numele, avatarele și statusul vin din documentele users/{uid} — ACEEAȘI sursă ca Clasamentul
// (getUserPublicProfiles / listGeneralLeaderboard). Un singur query pe colecție; rezultat reținut 2 minute.
const PLAYERS_TTL_MS = 2 * 60 * 1000;
let playersCache = { at: 0, value: null };

export async function loadBursaPlayers({ force = false } = {}) {
  if (!force && playersCache.value && Date.now() - playersCache.at < PLAYERS_TTL_MS) return playersCache.value;
  const snap = await getDocs(collection(db, "users"));
  const out = {};
  snap.docs.forEach((d) => {
    const v = d.data();
    out[d.id] = { uid: d.id, nickname: v.nickname || d.id, avatarId: v.avatarId ?? null, active: getPlayerStatus(v) === "active" };
  });
  playersCache = { at: Date.now(), value: out };
  return out;
}

// Configurația jocului din secret/main (pairings / byePlayer / eligibleUids). Întoarce null dacă nu e Bursă.
function readConfig(secretSnap) {
  if (!secretSnap || !secretSnap.exists()) return null;
  const d = secretSnap.data();
  if (d.type !== BURSA_TYPE_ID) return null;
  const c = d.config || {};
  return {
    pairings: Array.isArray(c.pairings) ? c.pairings : [],
    byePlayer: c.byePlayer || null,
    eligibleUids: Array.isArray(c.eligibleUids) ? c.eligibleUids : [],
  };
}

// ── Încărcarea jocului pentru un jucător (la deschiderea ecranului): 2 + 1 + ~18 citiri; după blocare, încă
// ≤ N portofolii + 1 istoric. Fără listener — punctele LIVE vin separat din instantaneul partajat existent.
export async function loadBursaGame(gameweekId, uid, nowMs = Date.now()) {
  const [pubSnap, secretSnap, mySnap, players] = await Promise.all([
    getDoc(pubRef(gameweekId)), getDoc(secretRef(gameweekId)), getDoc(pickRef(gameweekId, uid)), loadBursaPlayers(),
  ]);
  const pub = pubSnap.exists() ? pubSnap.data() : {};
  const config = readConfig(secretSnap);
  const activeSet = new Set(Object.values(players).filter((p) => p.active).map((p) => p.uid));
  const frozen = config ? config.eligibleUids : [];
  const rankingUids = rankingUidsFor(frozen, activeSet);
  const locked = isBursaLocked(pub, nowMs);

  let picksByUid = {};
  let entries = {};
  if (locked || pub.mainResolved === true) {
    const [picksSnap, histSnap] = await Promise.all([getDocs(picksCol(gameweekId)), getDoc(historyRef(gameweekId))]);
    picksSnap.docs.forEach((d) => { picksByUid[d.id] = normalizePortfolio(d.data()); });
    entries = histSnap.exists() ? (histSnap.data().entries || {}) : {};
  } else if (mySnap.exists()) {
    picksByUid[uid] = normalizePortfolio(mySnap.data());
  }
  const lockMs = pub.bursaLockAt && typeof pub.bursaLockAt.toMillis === "function" ? pub.bursaLockAt.toMillis() : null;
  return {
    pub, isBursa: !!config, config, players, activeSet, frozenUids: frozen, rankingUids,
    locked, resolved: pub.mainResolved === true, lockAtMs: lockMs,
    myPortfolio: mySnap.exists() ? normalizePortfolio(mySnap.data()) : null,
    picksByUid, entries,
  };
}

// Reîncarcă DOAR istoricul (1 citire) — folosit când instantaneul LIVE s-a schimbat.
export async function loadBursaHistoryEntries(gameweekId) {
  const snap = await getDoc(historyRef(gameweekId));
  return snap.exists() ? (snap.data().entries || {}) : {};
}

// ── Salvarea portofoliului (jucătorul): validare completă + tranzacție care re-verifică blocarea pe server
// (regulile propuse impun aceleași condiții). Se poate modifica oricând până la blocare — rămâne ultima variantă.
export async function saveBursaPortfolio(gameweekId, uid, portfolio, validUids) {
  const p = normalizePortfolio(portfolio);
  const v = validatePortfolio(p, uid, validUids);
  if (!v.ok) throw new Error(v.errors[0]);
  await runTransaction(db, async (tx) => {
    const pubSnap = await tx.get(pubRef(gameweekId));
    const pub = pubSnap.exists() ? pubSnap.data() : {};
    if (!pub.mainRevealed) throw new Error("Jocul nu e deschis încă.");
    if (pub.mainResolved) throw new Error("Etapa a fost deja rezolvată.");
    if (isBursaLocked(pub, Date.now())) throw new Error("Înscrierile s-au închis.");
    tx.set(pickRef(gameweekId, uid), { uid, perf: p.perf, contra: p.contra, updatedAt: serverTimestamp() });
  });
  return p;
}

// ═══ ADMIN ═════════════════════════════════════════════════════════════════════════════════════════

// Închidere manuală: portofoliile devin vizibile imediat (regulile citesc bursaClosed). Idempotent.
export async function closeBursa(gameweekId) {
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(pubRef(gameweekId));
    const pub = snap.exists() ? snap.data() : {};
    if (!pub.mainRevealed || !pub.bursaActive) throw new Error("Bursa nu e deschisă pentru etapa asta.");
    if (pub.mainResolved) throw new Error("Etapa e deja rezolvată.");
    if (pub.bursaClosed === true) return { already: true };
    tx.set(pubRef(gameweekId), { bursaClosed: true, bursaClosedAt: serverTimestamp() }, { merge: true });
    return { already: false };
  });
}

// Redeschidere: DOAR înainte de primul meci (după, interzisă și Adminului). Nu șterge nicio alegere.
export async function reopenBursa(gameweekId) {
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(pubRef(gameweekId));
    const pub = snap.exists() ? snap.data() : {};
    if (!pub.mainRevealed || !pub.bursaActive) throw new Error("Bursa nu e deschisă pentru etapa asta.");
    if (!canReopenBursa(pub, Date.now())) throw new Error("Primul meci a început (sau etapa e rezolvată) — redeschiderea e interzisă, chiar și Adminului.");
    if (pub.bursaClosed !== true) return { already: true };
    tx.set(pubRef(gameweekId), { bursaClosed: false, bursaClosedAt: null }, { merge: true });
    return { already: false };
  });
}

// Cine a completat și cine nu (Admin, la apăsare). Doar jucătorii din lista fixată la dezvăluire.
export async function getBursaEntryStatus(gameweekId) {
  const [pubSnap, secretSnap, picksSnap, players] = await Promise.all([
    getDoc(pubRef(gameweekId)), getDoc(secretRef(gameweekId)), getDocs(picksCol(gameweekId)), loadBursaPlayers({ force: true }),
  ]);
  const config = readConfig(secretSnap);
  const pub = pubSnap.exists() ? pubSnap.data() : {};
  const done = new Set();
  picksSnap.docs.forEach((d) => { const pf = normalizePortfolio(d.data()); if (pf.perf.length === 2 && pf.contra.length === 2) done.add(d.id); });
  const frozen = config ? config.eligibleUids : [];
  const rows = frozen.map((uid) => {
    const p = players[uid] || { uid, nickname: uid, avatarId: null, active: false };
    const status = !p.active ? "inactive" : done.has(uid) ? "done" : "missing";
    return { uid, nickname: p.nickname, avatarId: p.avatarId, status };
  }).sort((a, b) => a.nickname.localeCompare(b.nickname, "ro"));
  const lockMs = pub.bursaLockAt && typeof pub.bursaLockAt.toMillis === "function" ? pub.bursaLockAt.toMillis() : null;
  return {
    rows, lockAtMs: lockMs, closed: pub.bursaClosed === true, resolved: pub.mainResolved === true,
    locked: isBursaLocked(pub, Date.now()),
    counts: { done: rows.filter((r) => r.status === "done").length, missing: rows.filter((r) => r.status === "missing").length, inactive: rows.filter((r) => r.status === "inactive").length },
  };
}

// Istoricul real al validărilor (pentru graficul duelului). Apelat de Admin, ghidat, după publicarea
// instantaneului LIVE; scrie O intrare per versiune (idempotent: aceeași versiune = suprascrie aceeași cheie).
// NU face nimic dacă etapa nu are Bursă activă. Un eșec NU trebuie să strice publicarea instantaneului.
export async function appendBursaHistoryIfActive(gameweekId, version, pointsByUid) {
  const snap = await getDoc(pubRef(gameweekId));
  const pub = snap.exists() ? snap.data() : null;
  if (!pub || !pub.bursaActive || !pub.mainRevealed || pub.mainResolved) return false;
  const v = Number(version);
  if (!Number.isFinite(v)) return false;
  await setDoc(historyRef(gameweekId), { entries: { [String(v)]: { pointsByUid: pointsByUid || {}, at: serverTimestamp() } } }, { merge: true });
  return true;
}
