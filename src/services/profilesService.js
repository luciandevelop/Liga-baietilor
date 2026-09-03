import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

// ── Cache în memorie, per uid, cu TTL — nickname/avatar se schimbă
// RAR (userul își modifică avatarul din când în când), deci n-are rost
// să recitim din Firestore la fiecare ecran care afișează o listă de
// jucători (Home, Clasament, Feed, Duel etc.). Doar uid-urile lipsă sau
// expirate se mai citesc efectiv. ──
const profileCache = new Map(); // uid -> { nickname, avatarId, cachedAt }
const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;

// Un singur query per user LIPSĂ din cache, întoarce ce au nevoie orice
// listă de useri (nickname + avatarId), ca să nu se dubleze cererile
// atunci când un ecran are nevoie și de nickname și de avatar pentru
// aceiași useri (Home, Clasament, Admin Preview).
export async function getUserPublicProfiles(uids) {
  const result = {};
  const now = Date.now();
  const toFetch = [];
  for (const uid of uids) {
    const cached = profileCache.get(uid);
    if (cached && now - cached.cachedAt < PROFILE_CACHE_TTL_MS) {
      result[uid] = { nickname: cached.nickname, avatarId: cached.avatarId };
    } else {
      toFetch.push(uid);
    }
  }
  await Promise.all(
    toFetch.map(async (uid) => {
      const snap = await getDoc(doc(db, "users", uid));
      const entry = snap.exists()
        ? { nickname: snap.data().nickname, avatarId: snap.data().avatarId ?? null }
        : { nickname: uid, avatarId: null };
      profileCache.set(uid, { ...entry, cachedAt: now });
      result[uid] = entry;
    })
  );
  return result;
}

// Userul își schimbă PROPRIUL avatar — oricând, fără limitări (cerut
// explicit). Scrie STRICT câmpul avatarId, deja permis de regulile reale
// (users/{userId}.avatarId — string sau null) — nicio schemă nouă.
export async function updateOwnAvatar(uid, avatarId) {
  await setDoc(doc(db, "users", uid), { avatarId }, { merge: true });
  // Invalidează cache-ul DOAR pentru userul curent — restul rămân
  // valabile, nu are rost să le aruncăm pe toate pentru o schimbare a
  // unui singur om. La următoarea citire, avatarul nou se ia din nou
  // din Firestore, nu mai arată pe cel vechi din cache.
  profileCache.delete(uid);
}
