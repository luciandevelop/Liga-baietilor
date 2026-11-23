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

// ── ⏱ Admin: PRELUNGIRE TERMEN ──────────────────────────────────────
// Regulile NU permit modificarea documentului hideSeek/{gw} (nici Adminului: „update: false”), dar îi permit
// Adminului să-l șteargă și să-l creeze. Așa că îl RESCRIEM identic — aceleași perechi, același bye, aceiași
// participanți — doar cu termenul nou. Alegerile și marcajele (subcolecțiile picks / marks) NU se ating:
// Firestore nu șterge subcolecțiile odată cu documentul. Duelurile continuă exact de unde au rămas.
// Siguranță: copia perechilor stă în telefon (localStorage) până la recreare; dacă ceva pică între ștergere
// și creare, panoul arată „Restaurează” (cu ACELEAȘI perechi), nu o tragere nouă.
const backupKey = (gw) => `hs_backup_${gw}`;
export function getHideSeekBackup(gw) {
  try {
    const raw = localStorage.getItem(backupKey(gw)); const b = raw ? JSON.parse(raw) : null;
    return b && Array.isArray(b.pairs) && b.pairs.length && Array.isArray(b.participants) ? b : null;
  } catch { return null; }
}
function saveBackup(gw, b) { try { localStorage.setItem(backupKey(gw), JSON.stringify(b)); } catch { /* fără stocare */ } }
function clearBackup(gw) { try { localStorage.removeItem(backupKey(gw)); } catch { /* fără stocare */ } }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function checkNewEnd(newEnd) {
  const end = newEnd instanceof Date ? newEnd : new Date(newEnd);
  if (Number.isNaN(end.getTime())) throw new Error("Data noului termen nu e validă.");
  if (end.getTime() < Date.now() + 10 * 60 * 1000) throw new Error("Noul termen trebuie să fie la cel puțin 10 minute de acum.");
  return end;
}
// Creează documentul cu perechile DATE (fără tragere nouă). Dacă există deja, nu schimbă nimic.
function createWithPairs(gw, keep, end) {
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(gameRef(gw));
    if (snap.exists()) return { id: gw, ...snap.data(), already: true };
    const data = { gameweekId: gw, pairs: keep.pairs, bye: keep.bye ?? null, participants: keep.participants, endAt: Timestamp.fromDate(end), createdAt: serverTimestamp() };
    tx.set(gameRef(gw), data);
    return { id: gw, ...data };
  });
}
async function createWithRetry(gw, keep, end, tries = 4) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { return await createWithPairs(gw, keep, end); } catch (e) { last = e; if (i < tries - 1) await wait(700 * (i + 1)); }
  }
  throw last;
}

export async function extendHideSeek(gw, newEnd) {
  const end = checkNewEnd(newEnd);
  const pub = await getDoc(doc(db, "weeklySurprises", gw));
  if (pub.exists() && pub.data().bonusResolved) throw new Error("Surpriza e deja rezolvată — punctele sunt oficiale, termenul nu se mai schimbă.");
  const snap = await getDoc(gameRef(gw));
  if (!snap.exists()) throw new Error("Ascunselea nu există pentru etapa asta.");
  const d = snap.data();
  if (!Array.isArray(d.pairs) || !d.pairs.length || !Array.isArray(d.participants)) throw new Error("Documentul Ascunselea e incomplet — nu-l ating.");
  const curEnd = d.endAt?.toMillis ? d.endAt.toMillis() : 0;
  if (end.getTime() <= curEnd) throw new Error("Noul termen trebuie să fie după cel actual.");
  const keep = { pairs: d.pairs, bye: d.bye ?? null, participants: d.participants, oldEndMs: curEnd };
  saveBackup(gw, keep);
  await deleteDoc(gameRef(gw));
  const g = await createWithRetry(gw, keep, end);
  clearBackup(gw);
  return g;
}

// Dacă prelungirea s-a întrerupt după ștergere: recreează din copia din telefon (aceleași perechi).
export async function restoreHideSeek(gw, newEnd) {
  const b = getHideSeekBackup(gw);
  if (!b) throw new Error("Nu există o copie a perechilor în acest telefon.");
  const end = checkNewEnd(newEnd);
  const g = await createWithRetry(gw, b, end);
  clearBackup(gw);
  return g;
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
