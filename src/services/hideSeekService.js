import { collection, doc, getDoc, getDocs, onSnapshot, runTransaction, serverTimestamp, Timestamp, writeBatch, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { listActiveUserIds } from "./adminService";
import { computeAllPoints, drawPairs, isValidPick, HS_TURNS } from "./hideSeekEngine";

// ══════════════════════════════════════════════════════════════════
// 🚪 ASCUNSELEA — Firestore. Colecție separată (nu sub weeklySurprises, unde o regulă
// „catch-all” interzice subcolecții noi), ca Podul și Lumină roșie:
//   hideSeek/{gw}                         perechile (create o singură dată, de Admin) + termenul
//   hideSeek/{gw}/picks/{pair}_{turn}_{uid}  alegerile SECRETE ale unei ture (create-only)
//   hideSeek/{gw}/marks/{pair}_{turn}_{uid}  „a confirmat ✓” — public, fără uși (create-only)
// Secretul îl țin REGULILE: o alegere se poate citi doar de proprietar, până când există
// ambele marcaje ale turei. Ora vine de la server (request.time), nu de pe telefon.
// ══════════════════════════════════════════════════════════════════

export const gameRef = (gw) => doc(db, "hideSeek", gw);
const pickId = (pair, turn, uid) => `${pair}_${turn}_${uid}`;
const pickRef = (gw, pair, turn, uid) => doc(db, "hideSeek", gw, "picks", pickId(pair, turn, uid));
const markRef = (gw, pair, turn, uid) => doc(db, "hideSeek", gw, "marks", pickId(pair, turn, uid));

export async function getHideSeek(gw) {
  const s = await getDoc(gameRef(gw));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

// Admin: tragerea la sorți — o SINGURĂ dată (tranzacție; dacă există deja, nu se schimbă nimic).
export async function startHideSeek(gw, endAtDate) {
  const end = endAtDate instanceof Date ? endAtDate : new Date(endAtDate);
  if (!(end.getTime() > Date.now())) throw new Error("Termenul trebuie să fie în viitor.");
  const uids = [...(await listActiveUserIds())];
  if (uids.length < 2) throw new Error("Sunt necesari cel puțin 2 jucători activi.");
  const { pairs, bye } = drawPairs(uids);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(gameRef(gw));
    if (snap.exists()) return { id: gw, ...snap.data(), already: true };
    const data = { gameweekId: gw, pairs, bye: bye || null, participants: uids, endAt: Timestamp.fromDate(end), createdAt: serverTimestamp() };
    tx.set(gameRef(gw), data);
    return { id: gw, ...data };
  });
}

// Admin: anulare — DOAR cât timp nimeni n-a confirmat nicio tură.
export async function cancelHideSeek(gw) {
  const marks = await getDocs(collection(db, "hideSeek", gw, "marks"));
  if (!marks.empty) throw new Error("Nu se mai poate anula: jucătorii au început deja să joace.");
  await deleteDoc(gameRef(gw));
}

export function myPairIndex(game, uid) {
  return (game?.pairs || []).findIndex((p) => p.a === uid || p.b === uid);
}

// Marcajele (cine a confirmat ce tură) — mici, publice; ascultăm toată colecția (max 18 × 5 documente).
export function listenMarks(gw, cb) {
  return onSnapshot(collection(db, "hideSeek", gw, "marks"), (snap) => {
    const out = {}; snap.docs.forEach((d) => { out[d.id] = d.data(); }); cb(out);
  }, () => cb(null));
}
export const hasMark = (marks, pair, turn, uid) => !!marks?.[pickId(pair, turn, uid)];

// Confirmă tura: alegerea secretă + marcajul public, în ACELAȘI lot atomic (ori amândouă, ori nimic).
// Repetarea (dublu-tap, conexiune căzută) nu poate schimba nimic: documentele se pot doar crea.
export async function submitTurn(gw, game, uid, turn, hide, seek) {
  const pair = myPairIndex(game, uid);
  if (pair < 0) throw new Error("Nu ești într-o pereche.");
  const p = game.pairs[pair]; const opp = p.a === uid ? p.b : p.a;
  const pick = { hide: [...hide], seek: [...seek] };
  if (!isValidPick(pick)) throw new Error("Alege toate cele 6 uși.");
  // deja confirmat? (ex. a doua apăsare după o conexiune căzută) → nu rescrie, doar confirmă
  const mine = await getDoc(markRef(gw, pair, turn, uid)).catch(() => null);
  if (mine?.exists()) return { already: true };
  const b = writeBatch(db);
  b.set(pickRef(gw, pair, turn, uid), { uid, opp, pair, turn, hide: pick.hide, seek: pick.seek, at: serverTimestamp() });
  b.set(markRef(gw, pair, turn, uid), { uid, pair, turn, at: serverTimestamp() });
  try { await b.commit(); } catch (e) {
    const again = await getDoc(markRef(gw, pair, turn, uid)).catch(() => null);
    if (again?.exists()) return { already: true };
    throw e;
  }
  return { ok: true };
}

// Alegerile unei perechi care se POT citi acum (ale mele mereu; ale ambilor după ce au confirmat amândoi).
// Întoarce picks în formatul motorului: { [turn]: { A?, B? } }.
export async function loadPairPicks(gw, game, pairIdx, marks, myUid) {
  const p = game.pairs[pairIdx]; const out = {};
  const jobs = [];
  for (let t = 1; t <= HS_TURNS; t++) {
    const mA = hasMark(marks, pairIdx, t, p.a); const mB = hasMark(marks, pairIdx, t, p.b);
    if (!mA && !mB) break;
    const both = mA && mB;
    [["A", p.a, mA], ["B", p.b, mB]].forEach(([side, u, has]) => {
      if (!has || !(both || u === myUid)) return;
      jobs.push(getDoc(pickRef(gw, pairIdx, t, u)).then((s) => { if (s.exists()) { out[t] = out[t] || {}; out[t][side] = s.data(); } }).catch(() => {}));
    });
    if (!both) break;
  }
  await Promise.all(jobs);
  return out;
}

// Admin: toate alegerile (doar Admin are voie să le citească pe toate) → puncte oficiale.
export async function computeHideSeekPoints(gw) {
  const game = await getHideSeek(gw);
  if (!game) return { game: null, points: {} };
  const snap = await getDocs(collection(db, "hideSeek", gw, "picks"));
  const byPair = {};
  snap.docs.forEach((d) => {
    const x = d.data(); const p = game.pairs[x.pair]; if (!p) return;
    const side = x.uid === p.a ? "A" : x.uid === p.b ? "B" : null; if (!side) return;
    byPair[x.pair] = byPair[x.pair] || {}; byPair[x.pair][x.turn] = byPair[x.pair][x.turn] || {};
    byPair[x.pair][x.turn][side] = x;
  });
  return { game, byPair, points: computeAllPoints(game, byPair, true) };
}
