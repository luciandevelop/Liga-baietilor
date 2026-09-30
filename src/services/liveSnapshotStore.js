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

// ── FAZA 2 reads — FEREASTRĂ DE GRAȚIE. Adminul incrementează
// resultsVersion la validare și publică snapshot-ul nou câteva secunde
// mai târziu. În acest interval, snapshot-ul pare „depășit" pe TOATE
// telefoanele, care porneau fiecare recalcularea scumpă (~400 citiri/
// telefon). Acum, dacă există deja un snapshot (doar vechi) și
// incrementarea e recentă, telefonul AȘTEAPTĂ — fără nicio citire —
// snapshot-ul nou, care vine prin listener-ul existent. Recalcularea
// rulează doar dacă publicarea nu sosește în fereastră (publicare
// eșuată) sau dacă snapshot-ul lipsește complet. Un singur timer per
// etapă (nu polling), o singură recalculare per telefon. ──
export const FALLBACK_GRACE_MS = 90 * 1000;
const graceWaiters = new Map(); // gameweekId -> { version, resolve, timer }

function settleGraceWaiter(gameweekId, value) {
  const w = graceWaiters.get(gameweekId);
  if (!w) return;
  clearTimeout(w.timer);
  graceWaiters.delete(gameweekId);
  w.resolve(value);
}

export function getOrRunFallback(gameweekId, resultsVersion, computeFn) {
  const existing = fallbackPromises.get(gameweekId);
  if (existing && existing.version === resultsVersion) {
    console.log(`[FS-TRACE] liveFallback REUSED promise gw=${gameweekId} v=${resultsVersion}`);
    return existing.promise;
  }
  const last = stores.get(gameweekId)?.lastData;
  const hasOldSnapshot = !!(last && last.pointsByUid != null);
  const ageMs = last?.resultsVersionAtMs ? Date.now() - last.resultsVersionAtMs : Infinity;
  let promise;
  let kind = "computed";
  if (hasOldSnapshot && ageMs < FALLBACK_GRACE_MS) {
    kind = "grace";
    console.log(`[FS-TRACE] liveFallback GRACE gw=${gameweekId} v=${resultsVersion} (aștept snapshot-ul nou, fără citiri)`);
    const prev = graceWaiters.get(gameweekId);
    promise = new Promise((resolve) => {
      const timer = setTimeout(() => {
        graceWaiters.delete(gameweekId);
        const cur = stores.get(gameweekId)?.lastData;
        if (cur && !isSnapshotStale(cur)) resolve({ pointsByUid: cur.pointsByUid, diagnostic: null });
        else {
          console.log(`[FS-TRACE] liveFallback START (după grație) gw=${gameweekId} v=${resultsVersion}`);
          const fp = fallbackPromises.get(gameweekId);
          if (fp && fp.version === resultsVersion) fp.kind = "computed"; // rezultatul se refolosește la remount
          resolve(computeFn());
        }
      }, Math.min(FALLBACK_GRACE_MS, Math.max(0, FALLBACK_GRACE_MS - ageMs))); // ceas decalat → niciodată peste 90 s
      graceWaiters.set(gameweekId, { version: resultsVersion, resolve, timer });
    });
    // O versiune și mai nouă înlocuiește așteptarea precedentă: cine
    // aștepta versiunea veche primește rezultatul celei noi (lanț).
    if (prev) { clearTimeout(prev.timer); prev.resolve(promise); }
  } else {
    console.log(`[FS-TRACE] liveFallback START gw=${gameweekId} v=${resultsVersion}`);
    promise = computeFn();
  }
  fallbackPromises.set(gameweekId, { version: resultsVersion, promise, kind });
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
            // "estimate": pe dispozitivul Adminului, timestamp-ul încă nescris pe server nu e null.
            resultsVersionAtMs: (() => { const t = snap.data({ serverTimestamps: "estimate" }).resultsVersionAt; return t?.toMillis ? t.toMillis() : null; })(),
          }
        : { pointsByUid: null, updatedAt: null, snapshotVersion: null, resultsVersion: 0 };
      entry.lastData = data;
      // Snapshot proaspăt sosit → cine aștepta în fereastra de grație îl
      // primește direct; recalcularea NU mai pornește.
      if (!isSnapshotStale(data)) {
        settleGraceWaiter(gameweekId, { pointsByUid: data.pointsByUid, diagnostic: null });
        fallbackPromises.delete(gameweekId);
      }
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
      // FAZA 2 — nimeni nu mai ascultă: anulăm așteptarea în curs (altfel
      // timer-ul ar porni o recalculare scumpă în fundal, pentru nimeni).
      // Un rezultat DEJA calculat rămâne în cache, ca remount-ul să nu
      // recalculeze din nou.
      if (graceWaiters.has(gameweekId)) {
        settleGraceWaiter(gameweekId, { pointsByUid: entry.lastData?.pointsByUid || {}, diagnostic: null });
        const fp = fallbackPromises.get(gameweekId);
        if (fp && fp.kind === "grace") fallbackPromises.delete(gameweekId);
      }
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
