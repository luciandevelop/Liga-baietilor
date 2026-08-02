import { doc, getDoc } from "firebase/firestore";
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
