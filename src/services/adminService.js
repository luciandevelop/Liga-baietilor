import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  deleteDoc,
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
