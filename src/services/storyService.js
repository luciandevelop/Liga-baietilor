// ══════════════════════════════════════════════════════════════════
// PLAY LEAGUE STORIES — serviciu minimal, ZERO colecții noi, ZERO
// reguli Firestore noi.
//
// Starea ACTIVĂ (care Story e activ, ce versiune, câte slide-uri) se
// scrie direct pe documentul deja existent — gameweeks/{id} pentru
// Story de etapă, seasons/{id} pentru Story de sezon. Admin scrie deja
// în aceste documente în mod curent (creare/editare etapă) — exact
// aceeași regulă deja dovedită, nimic nou de deblocat.
//
// Starea VĂZUT se scrie STRICT pe users/{uid} — propriul document al
// userului, deja permis să-l editeze (dovedit: editarea nickname-ului
// din Profil). Un singur câmp per tip de Story (etapă/sezon) — "care e
// ultimul Story activ pe care l-a TERMINAT acest user", nimic per-slide.
// ══════════════════════════════════════════════════════════════════
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

export async function activateGameweekStory(gameweekId, slideCount) {
  const ref = doc(db, "gameweeks", gameweekId);
  const snap = await getDoc(ref);
  const prevVersion = snap.exists() ? (snap.data().storyVersion || 0) : 0;
  await updateDoc(ref, { storyActive: true, storyVersion: prevVersion + 1, storySlideCount: slideCount });
}

export async function deactivateGameweekStory(gameweekId) {
  await updateDoc(doc(db, "gameweeks", gameweekId), { storyActive: false });
}

export async function activateSeasonStory(seasonId, slideCount) {
  const ref = doc(db, "seasons", seasonId);
  const snap = await getDoc(ref);
  const prevVersion = snap.exists() ? (snap.data().storyVersion || 0) : 0;
  await updateDoc(ref, { storyActive: true, storyVersion: prevVersion + 1, storySlideCount: slideCount });
}

export async function deactivateSeasonStory(seasonId) {
  await updateDoc(doc(db, "seasons", seasonId), { storyActive: false });
}

// ── Cheia de "văzut" — {id}_v{versiune}. Dacă Admin dezactivează și
// reactivează cu o versiune nouă, cheia se schimbă — devine automat
// nevăzut pentru toată lumea, fără să ștergem nimic manual. ──
export function storyKey(id, version) {
  return `${id}_v${version}`;
}

export async function markGwStorySeen(uid, gameweekId, version) {
  await updateDoc(doc(db, "users", uid), { lastSeenGwStoryKey: storyKey(gameweekId, version) });
}

export async function markSeasonStorySeen(uid, seasonId, version) {
  await updateDoc(doc(db, "users", uid), { lastSeenSeasonStoryKey: storyKey(seasonId, version) });
}
