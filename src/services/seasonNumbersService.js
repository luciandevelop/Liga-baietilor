import { doc, getDoc, runTransaction, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { listGeneralLeaderboard, listSeasonLeaderboard } from "./adminService";

// ══════════════════════════════════════════════════════════════════
// 🔢 NUMERELE SEZONULUI 3 („Player 001”…)
//
// Un singur document: seasonNumbers/season3 — separat de profilurile
// jucătorilor (regulile profilului nu permit câmpuri noi; un câmp nou
// acolo i-ar împiedica pe jucători să-și editeze profilul).
//   numbers:   { uid: 1, uid2: 2, … }   (numărul, ca întreg)
//   frozenAt, tieSeasonId
//   transfers: [{ number, fromUid, toUid, at }]  (istoric înlocuiri)
// Citit de toți, scris doar de Admin (Firestore Rules).
// După înghețare, numerele NU se mai recalculează singure.
// ══════════════════════════════════════════════════════════════════

const numbersRef = () => doc(db, "seasonNumbers", "season3");

export function formatPlayerNumber(n) {
  return Number.isFinite(n) ? String(n).padStart(3, "0") : "";
}

export async function getSeasonNumbers() {
  const snap = await getDoc(numbersRef());
  return snap.exists() ? snap.data() : null;
}

// Ordinea propusă: clasamentul general (doar jucători activi), departajare
// după clasamentul sezonului ales, apoi alfabetic (doar ca să fie determinist).
export async function computeNumberOrder(tieSeasonId) {
  const [general, season] = await Promise.all([
    listGeneralLeaderboard(),
    tieSeasonId ? listSeasonLeaderboard(tieSeasonId) : Promise.resolve([]),
  ]);
  const seasonTotal = {};
  (season || []).forEach((r) => { seasonTotal[r.uid] = r.totalPoints || 0; });
  const rows = general
    .filter((r) => typeof r.uid === "string" && r.uid)
    .map((r) => ({ uid: r.uid, nickname: r.nickname || r.uid, total: r.seasonPoints || 0, seasonTotal: seasonTotal[r.uid] || 0 }));
  rows.sort((a, b) => (b.total - a.total) || (b.seasonTotal - a.seasonTotal) || a.nickname.localeCompare(b.nickname, "ro"));
  return rows.map((r, i) => ({ ...r, number: i + 1 }));
}

// Îngheață numerele O SINGURĂ DATĂ. Dacă există deja, refuză.
export async function freezeSeasonNumbers(tieSeasonId) {
  const order = await computeNumberOrder(tieSeasonId);
  if (order.length === 0) throw new Error("Nu există jucători activi în clasamentul general.");
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(numbersRef());
    if (snap.exists() && snap.data().numbers) throw new Error("Numerele sunt deja înghețate.");
    const numbers = {};
    order.forEach((r) => { numbers[r.uid] = r.number; });
    tx.set(numbersRef(), { numbers, tieSeasonId: tieSeasonId || null, frozenAt: serverTimestamp(), transfers: [] });
  });
  return order;
}

// Înlocuitorul preia numărul jucătorului înlocuit (care rămâne fără număr).
export async function transferNumber(fromUid, toUid) {
  if (!fromUid || !toUid || fromUid === toUid) throw new Error("Alegere invalidă.");
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(numbersRef());
    if (!snap.exists()) throw new Error("Numerele nu sunt înghețate încă.");
    const data = snap.data();
    const numbers = { ...(data.numbers || {}) };
    const number = numbers[fromUid];
    if (!Number.isFinite(number)) throw new Error("Jucătorul înlocuit nu are număr.");
    if (Number.isFinite(numbers[toUid])) throw new Error("Înlocuitorul are deja un număr.");
    delete numbers[fromUid];
    numbers[toUid] = number;
    const transfers = [...(data.transfers || []), { number, fromUid, toUid, at: Date.now() }];
    tx.set(numbersRef(), { ...data, numbers, transfers });
  });
}

// ── Aspectul personajelor (Pod etc.): seasonNumbers/looks = { bald: { uid: true } } ──
// Document SEPARAT de numere (altfel ar bloca „Îngheață numerele”, care cere ca
// documentul numerelor să nu existe). Aceleași reguli: citit de toți, scris de Admin.
const looksRef = () => doc(db, "seasonNumbers", "looks");
export async function getPlayerLooks() {
  const snap = await getDoc(looksRef());
  return snap.exists() ? snap.data() : { bald: {} };
}
export async function setPlayerBald(uid, bald) {
  await setDoc(looksRef(), { bald: { [uid]: !!bald } }, { merge: true });
}
