import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { auth, db } from "../firebase";

// ══════════════════════════════════════════════════════════════════
// 🌉 PODUL DE STICLĂ — legătura aplicației cu serverul de încredere.
//
// Aplicația NU decide niciodată rezultatul unei sărituri: trimite doar
// rândul și partea aleasă la /api/bridge, iar serverul (care singur
// cunoaște traseul) răspunde „sigur” / „spart” și noua stare.
// Citirile de aici sunt doar ale stării PUBLICE (fără trasee).
// ══════════════════════════════════════════════════════════════════

const ENDPOINT = "/api/bridge";

// Mesaje pe înțelesul jucătorului pentru erorile serverului.
export const BRIDGE_ERRORS = {
  stale: "Săritura a fost deja înregistrată. Se reîncarcă starea.",
  finished: "Jocul tău s-a încheiat.",
  closed: "Termenul Podului a expirat.",
  too_early: "Poți încasa abia de la treapta 5.",
  not_started: "Podul nu a fost pornit încă.",
  not_player: "Nu ești înscris în Podul acestei etape.",
  auth: "Sesiunea a expirat. Reîncarcă aplicația.",
  admin_only: "Doar Adminul poate porni Podul.",
  deadline: "Termenul ales nu e valid.",
  no_players: "Nu există jucători activi.",
  not_test: "Doar Podul de test poate fi resetat.",
  server: "Eroare pe server. Încearcă din nou.",
  network: "Nu există conexiune. Încearcă din nou.",
};

async function call(action, payload) {
  const user = auth.currentUser;
  if (!user) return { ok: false, error: "auth" };
  let token;
  try { token = await user.getIdToken(); } catch { return { ok: false, error: "auth" }; }
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, ...payload }),
    });
    const data = await res.json().catch(() => ({ ok: false, error: "server" }));
    return data;
  } catch {
    return { ok: false, error: "network" };
  }
}

// Admin: pornește Podul (perechi + trasee), o singură dată per etapă.
export function startBridge(gameweekId, deadlineMs) { return call("setup", { gameweekId, deadlineMs }); }
// Jucător: o săritură pe rândul `row` (0–8), partea `side` (0 = stânga, 1 = dreapta).
export function jumpBridge(gameweekId, row, side) { return call("jump", { gameweekId, row, side }); }
// Jucător: încasează punctele treptei curente (de la treapta 5).
export function cashoutBridge(gameweekId) { return call("cashout", { gameweekId }); }

// Admin, DOAR pentru Podul de test (id „test-…”): șterge tot ca să poată fi repornit.
export function resetTestBridge(gameweekId) { return call("reset", { gameweekId }); }

// Starea publică: perechile + termenul.
export async function getBridge(gameweekId) {
  const snap = await getDoc(doc(db, "bridge", gameweekId));
  return snap.exists() ? snap.data() : null;
}
// Starea publică a unui jucător (treaptă, vieți, statut, puncte — fără alegeri).
export async function getBridgePlayer(gameweekId, uid) {
  const snap = await getDoc(doc(db, "bridge", gameweekId, "players", uid));
  return snap.exists() ? snap.data() : null;
}
// Toți jucătorii (pentru Admin și pentru Rezolvare).
export async function listBridgePlayers(gameweekId) {
  const snap = await getDocs(collection(db, "bridge", gameweekId, "players"));
  return snap.docs.map((d) => d.data());
}

// Resursele grafice și audio (încărcate o singură dată, doar pe ecranul Podului).
let assetsPromise = null;
export function loadBridgeAssets() {
  if (!assetsPromise) {
    assetsPromise = Promise.all(["human", "hairs", "sfx"].map((n) => fetch(`/bridge/${n}.json`).then((r) => {
      if (!r.ok) throw new Error(`Lipsește /bridge/${n}.json`);
      return r.json();
    }))).then(([human, hairs, sfx]) => ({ human, hairs, sfx }))
      .catch((e) => { assetsPromise = null; throw e; });
  }
  return assetsPromise;
}
