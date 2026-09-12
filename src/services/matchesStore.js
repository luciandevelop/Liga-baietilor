import { listenMatches } from "./adminService";

// ══════════════════════════════════════════════════════════════════
// Magazin comun, STRICT în memorie, pentru meciurile etapei curente.
//
// POLITICA DE CACHE (aprobată explicit, audit incident reads 12 sept
// 2026, root cause #2):
//
// - listener-ul (onSnapshot, REALTIME real — scor/status/minut se
//   actualizează normal, live, exact ca înainte) se creează la primul
//   abonat;
// - când ultimul abonat pleacă, listener-ul NU se închide instant —
//   rămâne deschis încă GRACE_MS (3 minute). Ăsta e fix-ul: înainte,
//   Home → Speciale → Home (câteva secunde) însemna listener închis +
//   redeschis, deci o recitire COMPLETĂ a colecției de meciuri, de
//   fiecare dată. Acum, o revenire în fereastra de grație găsește
//   listener-ul ÎNCĂ VIU — 0 citiri noi, date deja proaspete;
// - dacă trec cele 3 minute FĂRĂ niciun abonat, listener-ul chiar se
//   închide (nu ținem conexiuni realtime plătite la nesfârșit pentru
//   ecrane pe care nimeni nu se uită) — la următoarea revenire, se
//   redeschide normal (o citire completă, inevitabilă, e prima citire
//   după o pauză reală);
// - PRE-MECI / LIVE / FT — comportament identic în toate cele trei
//   stări: cât timp există fie un abonat activ, fie suntem în
//   fereastra de grație, datele sunt live, nu doar cache static.
// ══════════════════════════════════════════════════════════════════
const GRACE_MS = 3 * 60 * 1000;

const stores = new Map(); // gameweekId -> { unsubscribe, subscribers: Set, lastRows, teardownTimer }

export function subscribeToGameweekMatches(gameweekId, callback) {
  if (!gameweekId) return () => {};

  let entry = stores.get(gameweekId);
  if (!entry) {
    entry = { subscribers: new Set(), lastRows: null, unsubscribe: null, teardownTimer: null };
    console.log(`[FS-TRACE] listenMatches START gw=${gameweekId}`);
    entry.unsubscribe = listenMatches(gameweekId, (rows) => {
      console.log(`[FS-TRACE] listenMatches SNAPSHOT gw=${gameweekId} docs=${rows.length}`);
      entry.lastRows = rows;
      entry.subscribers.forEach((cb) => cb(rows));
    });
    stores.set(gameweekId, entry);
  } else if (entry.teardownTimer) {
    // Revenire în fereastra de grație — anulăm închiderea programată,
    // listener-ul vechi rămâne exact cel care era, deschis, live.
    console.log(`[FS-TRACE] listenMatches REUSED (grace window) gw=${gameweekId}`);
    clearTimeout(entry.teardownTimer);
    entry.teardownTimer = null;
  }

  entry.subscribers.add(callback);
  if (entry.lastRows) callback(entry.lastRows);

  return () => {
    entry.subscribers.delete(callback);
    if (entry.subscribers.size === 0 && !entry.teardownTimer) {
      entry.teardownTimer = setTimeout(() => {
        console.log(`[FS-TRACE] listenMatches STOP gw=${gameweekId}`);
        entry.unsubscribe();
        stores.delete(gameweekId);
      }, GRACE_MS);
    }
  };
}

// ── Citire sincronă, FĂRĂ abonare — pentru consumatori ocazionali (ex.
// Surprize) care vor să reutilizeze datele DOAR dacă sunt deja
// disponibile (pentru că Home/LIVE sunt/au fost active în sesiune),
// fără să creeze ei înșiși niciun listener. Întoarce null dacă nimeni
// nu a încărcat încă meciurile acestei etape — apelantul rămâne liber
// să facă citirea lui obișnuită în acest caz (comportament neschimbat). ──
export function getLastKnownMatches(gameweekId) {
  return stores.get(gameweekId)?.lastRows || null;
}
