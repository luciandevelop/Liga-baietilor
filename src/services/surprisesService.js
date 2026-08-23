import { collection, doc, getDoc, getDocs, setDoc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { listActiveUserIds, listGameweeks, getLiveGameweekPoints, isGameweekReadyToResolve, getLastCompletedGameweek, listGameweekScores } from "./adminService";

// ══════════════════════════════════════════════════════════════════
// CATALOG — un singur loc, reutilizat de Admin (configurare) și de UI
// (afișare). Pentru runda asta, DOAR "duel-random" și "roulette" sunt
// active — restul apar ca "COMING SOON", neselectabile, dar deja
// prezente în listă, ca extinderea ulterioară să nu ceară altă
// structură de date, doar activarea lor aici.
// ══════════════════════════════════════════════════════════════════
export const MAIN_CATALOG = [
  { id: "duel-random", label: "Duel 1v1 Random", active: true },
  { id: "duel-extreme", label: "Duel 1v1 Extreme", active: true },
  { id: "duel-rivali", label: "Duel 1v1 Rivali", active: true },
  { id: "team-duel-random", label: "Duel de Echipe", active: true },
  { id: "half-random", label: "Jumate-Jumate Random", active: true },
  { id: "half-topbottom", label: "Jumate-Jumate Top vs Bottom", active: true },
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

// ── Clasamentul etapei anterioare — pentru Extreme/Rivali. Doar
// etapele FINALIZATE contează (are sens un clasament DEFINITIV, nu unul
// încă în mișcare). Dacă nu există nicio etapă finalizată (prima etapă
// a sezonului), întoarce null — reveal-ul cade decent pe random. Userii
// activi ACUM, dar care n-au avut rând în etapa anterioară (proaspăt
// aprobați), se adaugă la finalul listei (tratați ca ultimii), ca
// nimeni să nu lipsească din formarea perechilor. ──
async function getPreviousGameweekRanking(gameweekId) {
  const gwSnap = await getDoc(doc(db, "gameweeks", gameweekId));
  if (!gwSnap.exists()) return null;
  const seasonId = gwSnap.data().seasonId;
  const lastGw = await getLastCompletedGameweek(seasonId);
  if (!lastGw) return null;

  const rows = await listGameweekScores(lastGw.id); // deja sortate după rank, deja filtrate pe activi ACUM
  const ranked = rows.map((r) => r.userId);

  const activeUids = [...(await listActiveUserIds())];
  const missing = activeUids.filter((uid) => !ranked.includes(uid)).sort();
  return [...ranked, ...missing];
}

// ── Variantă ÎMBOGĂȚITĂ, pentru Jumate-Jumate Top/Bottom — clasamentul
// etapei anterioare, dar cu departajare pe seasonPoints (cumulat) la
// rank-uri EGALE, cerut explicit (listGameweekScores păstrează doar
// ordinea brută din Firestore la egalitate de rank, nu e determinist
// din perspectiva "cine merită mai sus"). Userii fără rând în etapa
// anterioară intră tot la coadă, ordonați după seasonPoints. ──
async function getPreviousGameweekRankingWithTieBreak(gameweekId) {
  const gwSnap = await getDoc(doc(db, "gameweeks", gameweekId));
  if (!gwSnap.exists()) return null;
  const seasonId = gwSnap.data().seasonId;
  const lastGw = await getLastCompletedGameweek(seasonId);
  if (!lastGw) return null;

  const rows = await listGameweekScores(lastGw.id);
  const activeUids = [...(await listActiveUserIds())];
  const rankedUidsSet = new Set(rows.map((r) => r.userId));
  const missingUids = activeUids.filter((uid) => !rankedUidsSet.has(uid));

  // seasonPoints pentru TOȚI cei implicați (clasați + lipsă) — o singură
  // trecere prin colecția users, deja disponibilă via listActiveUserIds
  // dar fără câmpurile complete; le citim direct.
  const allInvolvedUids = [...rows.map((r) => r.userId), ...missingUids];
  const userSnaps = await Promise.all(allInvolvedUids.map((uid) => getDoc(doc(db, "users", uid))));
  const seasonPointsByUid = {};
  allInvolvedUids.forEach((uid, i) => {
    seasonPointsByUid[uid] = userSnaps[i].exists() ? (userSnaps[i].data().seasonPoints || 0) : 0;
  });

  const combined = [
    ...rows.map((r) => ({ uid: r.userId, rank: r.rank, seasonPoints: seasonPointsByUid[r.userId] || 0 })),
    ...missingUids.map((uid) => ({ uid, rank: Infinity, seasonPoints: seasonPointsByUid[uid] || 0 })),
  ];
  combined.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return b.seasonPoints - a.seasonPoints; // departajare cerută explicit
  });
  return combined.map((c) => c.uid);
}

// ── REVEAL MAIN — freeze participanți (STRICT activi, din sistemul real
// existent) + generare pairing O SINGURĂ DATĂ, în aceeași tranzacție care
// marchează mainRevealed=true. Idempotent — al doilea apel nu face nimic. ──
export async function revealMain(gameweekId) {
  const publicRef = doc(db, "weeklySurprises", gameweekId);
  const secretRef = doc(db, "weeklySurprises", gameweekId, "secret", "main");

  const activeUids = shuffleDeterministic([...(await listActiveUserIds())], gameweekId + "_main");
  // Pentru Extreme/Rivali — calculat mereu (ieftin, un query în plus),
  // folosit doar dacă tipul chiar e unul din cele 2. Dacă nu există etapă
  // anterioară finalizată, rămâne null — tratat mai jos ca fallback random.
  const previousRanking = await getPreviousGameweekRanking(gameweekId);
  const previousRankingTieBreak = await getPreviousGameweekRankingWithTieBreak(gameweekId);

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
    } else if (type === "duel-extreme" || type === "duel-rivali") {
      // Ambele au nevoie de un clasament — dacă nu există etapă
      // anterioară finalizată (prima etapă a sezonului), cade decent pe
      // random, cu o notă explicită persistată, ca userii să înțeleagă
      // de ce nu văd perechi "extreme"/"rivali" reale.
      const ranking = previousRanking && previousRanking.length > 0 ? previousRanking : activeUids;
      const usedRandomFallback = !previousRanking || previousRanking.length === 0;

      const pairings = [];
      let byePlayer = null;
      const n = ranking.length;

      if (type === "duel-extreme") {
        // Locul 1 vs ultimul, locul 2 vs penultimul, ...
        let lo = 0, hi = n - 1;
        while (lo < hi) { pairings.push({ playerA: ranking[lo], playerB: ranking[hi] }); lo++; hi--; }
        if (lo === hi) byePlayer = ranking[lo]; // mijlocul, la număr impar
      } else {
        // Rivali: locul 1 vs 2, locul 3 vs 4, ...
        for (let i = 0; i < n; i += 2) {
          if (i + 1 < n) pairings.push({ playerA: ranking[i], playerB: ranking[i + 1] });
          else byePlayer = ranking[i];
        }
      }
      config = { pairings, byePlayer, usedRandomFallback };
    } else if (type === "team-duel-random") {
      // Regulă de bază: cât mai multe confruntări 2v2 curate posibil.
      // Resturile (0-3 jucători rămași după grupele de 4) NU mai devin
      // NICIODATĂ Duel separat sau Bye — se adaugă, câte unul, în
      // confruntarea cu cea mai MICĂ dimensiune totală în acel moment
      // (dacă mai multe sunt la fel, cea cu indexul cel mai mic), ca
      // dezechilibrul să se răspândească, nu să se adune într-un singur
      // loc. Exemplu confirmat cu userul: 11 jucători → 3v3 și 3v2, nu
      // 3v2+3v2+1 Bye. Alternarea între teamA/teamB în ACELAȘI grup (când
      // primește 2 resturi) previne un 4v2 nedorit, produce 3v3.
      // Excepție: sub 4 jucători activi, nicio confruntare de echipă nu
      // se poate forma — cade decent pe Duel 1v1 simplu (pereche + bye).
      if (activeUids.length < 4) {
        const pairings = [];
        let byePlayer = null;
        for (let i = 0; i < activeUids.length; i += 2) {
          if (i + 1 < activeUids.length) pairings.push({ playerA: activeUids[i], playerB: activeUids[i + 1] });
          else byePlayer = activeUids[i];
        }
        config = { fallbackToDuel: true, pairings, byePlayer };
      } else {
        const numGroups = Math.floor(activeUids.length / 4);
        const groups = [];
        for (let i = 0; i < numGroups; i++) {
          const base = activeUids.slice(i * 4, i * 4 + 4);
          groups.push({ teamA: [base[0], base[1]], teamB: [base[2], base[3]] });
        }
        const extras = activeUids.slice(numGroups * 4);
        extras.forEach((uid) => {
          let smallestIdx = 0, smallestSize = Infinity;
          groups.forEach((g, idx) => {
            const size = g.teamA.length + g.teamB.length;
            if (size < smallestSize) { smallestSize = size; smallestIdx = idx; }
          });
          const g = groups[smallestIdx];
          const additionsSoFar = (g.teamA.length - 2) + (g.teamB.length - 2);
          if (additionsSoFar % 2 === 0) g.teamA.push(uid);
          else g.teamB.push(uid);
        });
        config = { groups };
      }
    } else if (type === "half-random" || type === "half-topbottom") {
      // Random: ordine amestecată (activeUids, deja shuffle-uit mai sus).
      // Top vs Bottom: ordine după clasamentul etapei anterioare, cu
      // departajare pe seasonPoints — fallback random dacă nu există
      // etapă anterioară finalizată.
      let ordered;
      let usedRandomFallback = false;
      if (type === "half-topbottom") {
        ordered = previousRankingTieBreak && previousRankingTieBreak.length > 0 ? previousRankingTieBreak : activeUids;
        usedRandomFallback = !previousRankingTieBreak || previousRankingTieBreak.length === 0;
      } else {
        ordered = activeUids;
      }

      // Diferență MAXIMĂ de 1 jucător între tabere, impusă explicit —
      // jumătatea de sus (sau prima, la Random) primește jucătorul în
      // plus dacă numărul e impar.
      const topSize = Math.ceil(ordered.length / 2);
      const top = ordered.slice(0, topSize);
      const bottom = ordered.slice(topSize);
      config = { top, bottom, usedRandomFallback };
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
    const secretData = secretSnap.exists() ? secretSnap.data() : {};
    const mainType = secretData.type || "duel-random";
    const config = secretData.config || {};

    const toWrite = [];

    // Duel 1v1 clasic — compară direct 2 useri.
    function resolveDuelPair(playerA, playerB) {
      const sA = scoreByUid[playerA] || 0;
      const sB = scoreByUid[playerB] || 0;
      let pA, pB;
      if (sA > sB) { pA = 200; pB = 0; }
      else if (sB > sA) { pA = 0; pB = 200; }
      else { pA = 100; pB = 100; }
      toWrite.push({ uid: playerA, points: pA, matchScore: sA, opponentMatchScore: sB });
      toWrite.push({ uid: playerB, points: pB, matchScore: sB, opponentMatchScore: sA });
    }

    if (mainType === "duel-random" || mainType === "duel-extreme" || mainType === "duel-rivali") {
      const { pairings = [], byePlayer = null } = config;
      pairings.forEach(({ playerA, playerB }) => resolveDuelPair(playerA, playerB));
      if (byePlayer) toWrite.push({ uid: byePlayer, points: 100, matchScore: null, opponentMatchScore: null });
    } else if (mainType === "team-duel-random") {
      if (config.fallbackToDuel) {
        // Sub 4 jucători activi — a căzut pe Duel 1v1 simplu la Reveal.
        const { pairings = [], byePlayer = null } = config;
        pairings.forEach(({ playerA, playerB }) => resolveDuelPair(playerA, playerB));
        if (byePlayer) toWrite.push({ uid: byePlayer, points: 100, matchScore: null, opponentMatchScore: null });
      } else {
        const { groups = [] } = config;
        // Scorul unei părți = suma membrilor, din meciuri FINAL — DAR
        // dacă partea are 3+ jucători, punctele celui clasat la mijloc
        // (floor(n/2)+1, aceeași regulă ca la Jumate-Jumate) NU intră în
        // sumă — el rămâne în echipă, primește premiul dacă echipa
        // câștigă, doar nu-i "contează" scorul la comparație. Cu 2
        // jucători, nicio excludere (suma amândurora, ca la 2v2 clasic).
        function teamSum(members) {
          if (members.length <= 2) {
            return members.reduce((sum, uid) => sum + (scoreByUid[uid] || 0), 0);
          }
          const sorted = [...members].sort((a, b) => (scoreByUid[b] || 0) - (scoreByUid[a] || 0));
          const excludeIdx = Math.floor(members.length / 2) + 1 - 1; // index 0-based
          return sorted.reduce((sum, uid, i) => (i === excludeIdx ? sum : sum + (scoreByUid[uid] || 0)), 0);
        }

        groups.forEach(({ teamA, teamB }) => {
          const sA = teamSum(teamA);
          const sB = teamSum(teamB);
          let pA, pB;
          if (sA > sB) { pA = 200; pB = 0; }
          else if (sB > sA) { pA = 0; pB = 200; }
          else { pA = 100; pB = 100; }
          // Premiul e IDENTIC pentru FIECARE membru — inclusiv cel exclus
          // din sumă. El nu e scos din echipă, doar din comparație.
          teamA.forEach((uid) => toWrite.push({ uid, points: pA, matchScore: sA, opponentMatchScore: sB }));
          teamB.forEach((uid) => toWrite.push({ uid, points: pB, matchScore: sB, opponentMatchScore: sA }));
        });
      }
    } else if (mainType === "half-random" || mainType === "half-topbottom") {
      const { top = [], bottom = [] } = config;
      // Excludere DOAR din partea MAI NUMEROASĂ (nu ambele, spre
      // deosebire de Duel de Echipe) — cerut explicit. Cu dimensiuni
      // egale, nicio excludere, sumă simplă pentru amândouă.
      function halfSum(members, isLargerSide) {
        if (!isLargerSide) return members.reduce((sum, uid) => sum + (scoreByUid[uid] || 0), 0);
        const sorted = [...members].sort((a, b) => (scoreByUid[b] || 0) - (scoreByUid[a] || 0));
        const excludeIdx = Math.floor(members.length / 2) + 1 - 1;
        return sorted.reduce((sum, uid, i) => (i === excludeIdx ? sum : sum + (scoreByUid[uid] || 0)), 0);
      }

      const topIsLarger = top.length > bottom.length;
      const bottomIsLarger = bottom.length > top.length;
      const sTop = halfSum(top, topIsLarger);
      const sBottom = halfSum(bottom, bottomIsLarger);
      let pTop, pBottom;
      if (sTop > sBottom) { pTop = 200; pBottom = 0; }
      else if (sBottom > sTop) { pTop = 0; pBottom = 200; }
      else { pTop = 100; pBottom = 100; }

      top.forEach((uid) => toWrite.push({ uid, points: pTop, matchScore: sTop, opponentMatchScore: sBottom }));
      bottom.forEach((uid) => toWrite.push({ uid, points: pBottom, matchScore: sBottom, opponentMatchScore: sTop }));
    }

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
