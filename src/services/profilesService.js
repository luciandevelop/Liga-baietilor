import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

// Un singur query per user, întoarce ce au nevoie orice listă de useri
// (nickname + avatarId), ca să nu se dubleze cererile atunci când un
// ecran are nevoie și de nickname și de avatar pentru aceiași useri
// (Home, Clasament, Admin Preview).
export async function getUserPublicProfiles(uids) {
  const result = {};
  await Promise.all(
    uids.map(async (uid) => {
      const snap = await getDoc(doc(db, "users", uid));
      result[uid] = snap.exists()
        ? { nickname: snap.data().nickname, avatarId: snap.data().avatarId ?? null }
        : { nickname: uid, avatarId: null };
    })
  );
  return result;
}

// Userul își schimbă PROPRIUL avatar — oricând, fără limitări (cerut
// explicit). Scrie STRICT câmpul avatarId, deja permis de regulile reale
// (users/{userId}.avatarId — string sau null) — nicio schemă nouă.
export async function updateOwnAvatar(uid, avatarId) {
  await setDoc(doc(db, "users", uid), { avatarId }, { merge: true });
}
