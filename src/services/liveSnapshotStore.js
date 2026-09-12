import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

// ══════════════════════════════════════════════════════════════════
// Magazin comun pentru snapshot-ul LIVE al clasamentului — aprobat
// explicit, ca soluție la citirile Firestore excesive (Header +
// Clasament citeau separat, la 2 minute, ~200-400 documente FIECARE).
//
// Model NOU: Adminul recalculează O SINGURĂ DATĂ, la validarea unui
// rezultat (AdminScreen.jsx, recomputeAndPublish), și scrie rezultatul
// pe gameweeks/{id}.liveSnapshotPointsByUid — un singur document mic,
// 18 numere. Toți ceilalți DOAR citesc acest document, prin UN SINGUR
// listener Firestore, partajat (reference-counted, exact ca
// matchesStore.js) — actualizare INSTANT pentru toată lumea, fără
// polling, fără recalculare pe fiecare telefon.
//
// gameweeks/{id} e deja citibil de orice user autentificat și deja
// scriibil de Admin (exact tiparul folosit pentru Story) — zero regulă
// Firestore nouă necesară.
// ══════════════════════════════════════════════════════════════════
const stores = new Map(); // gameweekId -> { unsubscribe, subscribers: Set, lastData }

// ── HOTFIX PRODUCȚIE, 12 sept 2026 — REGRESIE reparată. Varianta
// anterioară (`shouldAttemptFallback`, semafor boolean "primul are
// voie") avea un bug real, confirmat: al DOILEA consumator (Header sau
// Clasament, oricare vine al doilea într-o navigare secvențială, ex.
// Home → Clasament) primea `false` și făcea `return` imediat — fără să
// aplice NICIODATĂ datele, fără să oprească NICIODATĂ starea de
// "Se încarcă...". Rezultat exact: Clasament blocat permanent, Header
// rămas la valorile persistate (0 PCT într-o etapă nouă).
//
// Fix: promisiune PARTAJATĂ, nu semafor. Primul consumator declanșează
// calculul; oricâți alți consumatori vin în același interval, pentru
// ACEEAȘI resultsVersion, primesc EXACT ACEEAȘI promisiune (deja în
// desfășurare sau deja rezolvată) — TOȚI aplică rezultatul, nimeni nu
// rămâne blocat. Calculul scump tot rulează o singură dată (scopul
// inițial al optimizării rămâne intact). ──
const fallbackPromises = new Map(); // gameweekId -> { version, promise }

export function getOrRunFallback(gameweekId, resultsVersion, computeFn) {
  const existing = fallbackPromises.get(gameweekId);
  if (existing && existing.version === resultsVersion) {
    console.log(`[FS-TRACE] liveFallback REUSED promise gw=${gameweekId} v=${resultsVersion}`);
    return existing.promise;
  }
  console.log(`[FS-TRACE] liveFallback START gw=${gameweekId} v=${resultsVersion}`);
  const promise = computeFn();
  fallbackPromises.set(gameweekId, { version: resultsVersion, promise });
  // Dacă rulează cu eroare, nu blocăm PERMANENT versiunea asta — la
  // următoarea încercare (ex. altă navigare) se poate reîncerca curat.
  promise.catch(() => { fallbackPromises.delete(gameweekId); });
  return promise;
}

export function subscribeToLiveSnapshot(gameweekId, callback) {
  if (!gameweekId) return () => {};

  let entry = stores.get(gameweekId);
  if (!entry) {
    entry = { subscribers: new Set(), lastData: null, unsubscribe: null };
    console.log(`[FS-TRACE] liveSnapshot listener START gw=${gameweekId}`);
    entry.unsubscribe = onSnapshot(doc(db, "gameweeks", gameweekId), (snap) => {
      const data = snap.exists()
        ? {
            pointsByUid: snap.data().liveSnapshotPointsByUid || null,
            updatedAt: snap.data().liveSnapshotUpdatedAt || null,
            snapshotVersion: snap.data().liveSnapshotResultsVersion ?? null,
            resultsVersion: snap.data().resultsVersion || 0,
          }
        : { pointsByUid: null, updatedAt: null, snapshotVersion: null, resultsVersion: 0 };
      entry.lastData = data;
      entry.subscribers.forEach((cb) => cb(data));
    }, (err) => {
      console.error("Eroare la ascultarea snapshot-ului live al clasamentului:", err);
    });
    stores.set(gameweekId, entry);
  }

  entry.subscribers.add(callback);
  if (entry.lastData) callback(entry.lastData);

  return () => {
    entry.subscribers.delete(callback);
    if (entry.subscribers.size === 0) {
      console.log(`[FS-TRACE] liveSnapshot listener STOP gw=${gameweekId}`);
      entry.unsubscribe();
      stores.delete(gameweekId);
    }
  };
}

// ── Detectare STRICTĂ a snapshot-ului învechit — cerut explicit, ca un
// write eșuat (rar, dar posibil) să nu ajungă niciodată afișat ca fiind
// actual. Nu presupune nimic: dacă lipsește versiunea, sau versiunea
// snapshot-ului e în urma resultsVersion (incrementat ATOMIC, exact la
// validarea unui rezultat, indiferent dacă scrierea snapshot-ului a
// reușit), tratează explicit ca STALE. ──
export function isSnapshotStale(data) {
  if (!data || data.pointsByUid == null) return true;
  if (data.snapshotVersion == null) return true;
  return data.snapshotVersion < (data.resultsVersion || 0);
}
