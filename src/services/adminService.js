import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
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
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function listSeasons() {
  const snap = await getDocs(query(collection(db, "seasons"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createGameweek({ seasonId, number, title }) {
  const ref = await addDoc(collection(db, "gameweeks"), {
    seasonId,
    number: Number(number),
    title,
    status: "upcoming",
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function listGameweeks(seasonId) {
  const snap = await getDocs(
    query(collection(db, "gameweeks"), where("seasonId", "==", seasonId), orderBy("number", "asc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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
  const snap = await getDocs(
    query(collection(db, "matches"), where("gameweekId", "==", gameweekId), orderBy("kickoffAt", "asc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
