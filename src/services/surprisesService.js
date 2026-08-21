import { collection, doc, getDoc, getDocs, setDoc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { listActiveUserIds, listGameweeks, getLiveGameweekPoints, isGameweekReadyToResolve } from "./adminService";

// ══════════════════════════════════════════════════════════════════
// CATALOG — un singur loc, reutilizat de Admin (configurare) și de UI
// (afișare). Pentru runda asta, DOAR "duel-random" și "roulette" sunt
// active — restul apar ca "COMING SOON", neselectabile, dar deja
// prezente în listă, ca extinderea ulterioară să nu ceară altă
// structură de date, doar activarea lor aici.
// ══════════════════════════════════════════════════════════════════
export const MAIN_CATALOG = [
  { id: "duel-random", label: "Duel 1v1 Random", active: true },
  { id: "duel-extreme", label: "Duel 1v1 Extreme", active: false },
  { id: "duel-rivali", label: "Duel 1v1 Rivali", active: false },
  { id: "2v2-random", label: "2v2 Random", active: false },
  { id: "half-random", label: "Jumate-Jumate Random", active: false },
  { id: "half-topbottom", label: "Jumate-Jumate Top vs Bottom", active: false },
  { id: "trivia", label: "Trivia Etapei", active: false },
  { id: "zaruri", label: "Zarurile", active: false },
  { id: "sabotaj", label: "Sabotaj", active: false },
];

export const BONUS_CATALOG = [
  { id: "roulette", label: "Ruletă", active: true },
  { id: "mystery-box", label: "Mystery Box", active: false },
  { id: "penalty-pvp", label: "Penalty PvP", active: false },
];

// 16 segmente, distribuția aprobată. Ordinea de-aici NU e ordinea vizuală
// pe roată — la randare, componenta le rearanjează ca valorile identice
// să nu fie lipite (cerut explicit).
export const ROULETTE_SEGMENTS = [0, 0, 0, 0, 25, 25, 25, 25, 25, 50, 50, 50, 50, 75, 75, 100];

export function getSurpriseStatus(pub) {
  if (!pub) return "locked";
  const anyRevealed = pub.mainRevealed || pub.bonusRevealed;
  if (!anyRevealed) return "locked";
  if (pub.mainResolved && pub.bonusResolved) return "resolved";
  return "active";
}

// ── Shuffle determinist (seed = string) — NU pentru securitate (asta
// rulează în tranzacție, scris o singură dată, deci nu trebuie
// re-generabil identic), ci ca eventuale retry-uri de tranzacție să nu
// producă ordini complet diferite fără motiv. ──
function shuffleDeterministic(arr, seedStr) {
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
  function rand() {
    seed = (seed * 1103515245 + 12345) >>> 0;
    return seed / 4294967296;
  }
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ══════════════════════════════════════════════════════════════════
// CITIRE — public + secret (secret întoarce null dacă nu ai voie încă,
// Firestore Rules oprește citirea, nu doar o ascunde în UI).
// ══════════════════════════════════════════════════════════════════
export async function getWeeklySurprise(gameweekId) {
  const snap = await getDoc(doc(db, "weeklySurprises", gameweekId));
  return snap.exists() ? snap.data() : null;
}

export async function getSecretMain(gameweekId) {
  try {
    const snap = await getDoc(doc(db, "weeklySurprises", gameweekId, "secret", "main"));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    return null; // permission-denied = normal, încă nedezvăluit
  }
}

export async function getSecretBonus(gameweekId) {
  try {
    const snap = await getDoc(doc(db, "weeklySurprises", gameweekId, "secret", "bonus"));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    return null;
  }
}

export async function getSurpriseResult(gameweekId, uid) {
  try {
    const snap = await getDoc(doc(db, "weeklySurprises", gameweekId, "results", uid));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    return null;
  }
}

export async function getAllSurpriseResults(gameweekId) {
  const snap = await getDocs(collection(db, "weeklySurprises", gameweekId, "results"));
  return snap.docs.map((d) => d.data());
}

// ══════════════════════════════════════════════════════════════════
// ADMIN — configurare (doar tipul, fără pairing — acela vine la Reveal)
// ══════════════════════════════════════════════════════════════════
export async function configureSurprise(gameweekId, { mainType, bonusType } = {}) {
  await setDoc(doc(db, "weeklySurprises", gameweekId), { gameweekId }, { merge: true });
  if (mainType) {
    await setDoc(doc(db, "weeklySurprises", gameweekId, "secret", "main"), { type: mainType }, { merge: true });
  }
  if (bonusType) {
    await setDoc(doc(db, "weeklySurprises", gameweekId, "secret", "bonus"), { type: bonusType }, { merge: true });
  }
}

// ── REVEAL MAIN — freeze participanți (STRICT activi, din sistemul real
// existent) + generare pairing O SINGURĂ DATĂ, în aceeași tranzacție care
// marchează mainRevealed=true. Idempotent — al doilea apel nu face nimic. ──
export async function revealMain(gameweekId) {
  const publicRef = doc(db, "weeklySurprises", gameweekId);
  const secretRef = doc(db, "weeklySurprises", gameweekId, "secret", "main");

  const activeUids = shuffleDeterministic([...(await listActiveUserIds())], gameweekId + "_main");

  await runTransaction(db, async (tx) => {
    const pubSnap = await tx.get(publicRef);
    if (pubSnap.exists() && pubSnap.data().mainRevealed) return; // deja dezvăluit, nu regenerăm

    const secretSnap = await tx.get(secretRef);
    const secretData = secretSnap.exists() ? secretSnap.data() : {};
    const type = secretData.type || "duel-random";

    let config = {};
    if (type === "duel-random") {
      const pairings = [];
      let byePlayer = null;
      for (let i = 0; i < activeUids.length; i += 2) {
        if (i + 1 < activeUids.length) pairings.push({ playerA: activeUids[i], playerB: activeUids[i + 1] });
        else byePlayer = activeUids[i];
      }
      config = { pairings, byePlayer };
    }

    tx.set(secretRef, { ...secretData, type, config }, { merge: true });
    tx.set(publicRef, { gameweekId, mainRevealed: true, mainRevealedAt: serverTimestamp() }, { merge: true });
  });
}

export async function revealBonus(gameweekId) {
  const publicRef = doc(db, "weeklySurprises", gameweekId);
  await runTransaction(db, async (tx) => {
    const pubSnap = await tx.get(publicRef);
    if (pubSnap.exists() && pubSnap.data().bonusRevealed) return;
    tx.set(publicRef, { gameweekId, bonusRevealed: true, bonusRevealedAt: serverTimestamp() }, { merge: true });
  });
}

// ── RESOLVE MAIN (Duel) — compară punctele DIN ETAPĂ (getLiveGameweekPoints,
// nu seasonPoints), scrie rezultatele + incrementează seasonPoints, totul
// într-o singură tranzacție. Read-before-write respectat strict (toate
// citirile înaintea oricărei scrieri, cerință reală a SDK-ului Firestore
// pentru tranzacții, nu doar stil). Idempotent — al doilea apel e no-op. ──
export async function resolveMain(gameweekId) {
  const publicRef = doc(db, "weeklySurprises", gameweekId);
  const secretRef = doc(db, "weeklySurprises", gameweekId, "secret", "main");

  // GARDĂ CRITICĂ — refuz explicit dacă mai există meciuri în desfășurare.
  // BUG REAL, GĂSIT: înainte, Resolve putea fi apelat oricând, chiar cu
  // etapa doar parțial jucată — WIN/LOSE se fixa pe scoruri PROVIZORII,
  // care puteau deveni greșite pe măsură ce restul meciurilor se termină
  // (exemplu concret semnalat: AdiReal 240 vs Sexu 180 la jumătatea
  // etapei → Resolve prematur → AdiReal WIN — dar la final Sexu ajunge
  // 350 vs 280, câștigătorul REAL era altul). Acum: Resolve refuză
  // explicit, nu doar "sperăm că Admin apasă la momentul potrivit".
  const ready = await isGameweekReadyToResolve(gameweekId);
  if (!ready) throw new Error("Nu poți rezolva Duelul — mai există meciuri care nu s-au încheiat încă (Programat/Live/Pauză).");

  // Sursă unică (getLiveGameweekPoints, adminService) — STRICT meciuri
  // FINAL ale etapei curente, aceeași cifră ca în Clasament → Etapă.
  // BUG REPARAT: înainte folosea listGameweekScores (gameweekScores),
  // scrisă DOAR la finalizarea etapei — Duelul nu putea fi rezolvat
  // deloc înainte de asta. Acum funcționează corect ORICÂND în timpul
  // etapei, cu exact aceleași puncte pe care userul le vede în Clasament.
  const { pointsByUid: scoreByUid } = await getLiveGameweekPoints(gameweekId);

  await runTransaction(db, async (tx) => {
    const pubSnap = await tx.get(publicRef);
    if (!pubSnap.exists() || !pubSnap.data().mainRevealed) throw new Error("MAIN nu a fost dezvăluit încă.");
    if (pubSnap.data().mainResolved) return;

    const secretSnap = await tx.get(secretRef);
    const { pairings = [], byePlayer = null } = secretSnap.exists() ? (secretSnap.data().config || {}) : {};

    const toWrite = [];
    pairings.forEach(({ playerA, playerB }) => {
      const sA = scoreByUid[playerA] || 0;
      const sB = scoreByUid[playerB] || 0;
      let pA, pB;
      if (sA > sB) { pA = 200; pB = 0; }
      else if (sB > sA) { pA = 0; pB = 200; }
      else { pA = 100; pB = 100; }
      // Scorul CONFRUNTĂRII (performanța din meciuri FINAL) — persistat
      // separat de premiu, ca istoricul să poată arăta "450p vs 310p",
      // NU contaminat retroactiv cu bonusul de +200p câștigat.
      toWrite.push({ uid: playerA, points: pA, matchScore: sA, opponentMatchScore: sB });
      toWrite.push({ uid: playerB, points: pB, matchScore: sB, opponentMatchScore: sA });
    });
    if (byePlayer) toWrite.push({ uid: byePlayer, points: 100, matchScore: null, opponentMatchScore: null });

    // FAZA DE CITIRE — toate înaintea oricărei scrieri.
    // NOTĂ IMPORTANTĂ: NU se mai citește/scrie users.seasonPoints aici.
    // Premiul (mainPoints) se PERSISTĂ, dar se ADUNĂ în totalurile
    // cumulative STRICT o singură dată, la finalizeGameweek — altfel
    // riscul de dublare (Resolve + Finalize, ambele incrementând
    // seasonPoints separat) era exact sursa haosului raportat.
    // FAZA DE SCRIERE.
    toWrite.forEach((r) => {
      tx.set(doc(db, "weeklySurprises", gameweekId, "results", r.uid), {
        uid: r.uid, mainPoints: r.points, mainMatchScore: r.matchScore, mainOpponentMatchScore: r.opponentMatchScore,
      }, { merge: true });
    });
    tx.set(publicRef, { mainResolved: true }, { merge: true });
  });
}

// ── RESOLVE BONUS (Ruletă) — rezultatul final per user e determinist,
// calculat din spin2 (dacă există) sau spin1: nicio decizie "de câștigător"
// nu e necesară, doar aplicarea punctelor. Tot idempotent, tot tranzacțional. ──
export async function resolveBonus(gameweekId) {
  const publicRef = doc(db, "weeklySurprises", gameweekId);
  const activeUids = [...(await listActiveUserIds())];

  const spinsPerUser = await Promise.all(activeUids.map(async (uid) => {
    const [s1, s2] = await Promise.all([
      getDoc(doc(db, "weeklySurprises", gameweekId, "rouletteSpins", `1_${uid}`)),
      getDoc(doc(db, "weeklySurprises", gameweekId, "rouletteSpins", `2_${uid}`)),
    ]);
    const finalValue = s2.exists() ? s2.data().value : (s1.exists() ? s1.data().value : 0);
    return { uid, points: finalValue };
  }));

  await runTransaction(db, async (tx) => {
    const pubSnap = await tx.get(publicRef);
    if (!pubSnap.exists() || !pubSnap.data().bonusRevealed) throw new Error("BONUS nu a fost dezvăluit încă.");
    if (pubSnap.data().bonusResolved) return;

    // Premiul se persistă, dar NU se mai adaugă la users.seasonPoints
    // aici — se consolidează o singură dată, la finalizeGameweek, exact
    // ca la Main (motivul e identic: evită dublarea la Resolve+Finalize).
    spinsPerUser.forEach((r) => {
      tx.set(doc(db, "weeklySurprises", gameweekId, "results", r.uid), { uid: r.uid, bonusPoints: r.points }, { merge: true });
    });
    tx.set(publicRef, { bonusResolved: true }, { merge: true });
  });
}

// ══════════════════════════════════════════════════════════════════
// RULETĂ — spin-uri per user. ID determinist "{1|2}_{uid}", create-only
// (regula Firestore interzice orice update/delete — imutabil real).
// ══════════════════════════════════════════════════════════════════
export async function getRouletteSpin(gameweekId, uid, spinNumber) {
  try {
    const snap = await getDoc(doc(db, "weeklySurprises", gameweekId, "rouletteSpins", `${spinNumber}_${uid}`));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    return null;
  }
}

// ── Starea LIVE a Ruletei, pentru TOȚI jucătorii activi — nu așteaptă
// Resolve. Fiecare persoană: "nu a învârtit încă" / "a păstrat Xp" /
// "a rerulat, final Yp" — exact regula reală (spin2 dacă există, altfel
// spin1). Citește direct, cu regula Firestore relaxată (orice user
// autentificat, DUPĂ ce Bonusul a fost dezvăluit) — cerută explicit
// pentru transparență totală, "să nu existe discuții".
export async function getAllRouletteSpinsStatus(gameweekId) {
  const activeUids = [...(await listActiveUserIds())];
  const rows = await Promise.all(activeUids.map(async (uid) => {
    const [s1, s2] = await Promise.all([
      getRouletteSpin(gameweekId, uid, 1),
      getRouletteSpin(gameweekId, uid, 2),
    ]);
    if (s2) return { uid, status: "final-after-reroll", value: s2.value };
    if (s1) return { uid, status: "kept-first", value: s1.value };
    return { uid, status: "not-spun", value: null };
  }));
  return rows;
}

export async function submitRouletteSpin(gameweekId, uid, spinNumber) {
  const value = ROULETTE_SEGMENTS[Math.floor(Math.random() * ROULETTE_SEGMENTS.length)];
  const ref = doc(db, "weeklySurprises", gameweekId, "rouletteSpins", `${spinNumber}_${uid}`);
  await setDoc(ref, { uid, value, spinNumber, createdAt: serverTimestamp() });
  return value;
}

// ── Istoricul sezonului — o intrare per etapă, cu starea calculată. ──
export async function listSeasonSurprises(seasonId) {
  const gameweeks = await listGameweeks(seasonId);
  const rows = await Promise.all(gameweeks.map(async (gw) => {
    const pub = await getWeeklySurprise(gw.id);
    return { gameweek: gw, public: pub, status: getSurpriseStatus(pub) };
  }));
  return rows.sort((a, b) => (a.gameweek.number || 0) - (b.gameweek.number || 0));
}
