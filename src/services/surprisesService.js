import { collection, doc, getDoc, getDocs, setDoc, query, where, runTransaction, serverTimestamp } from "firebase/firestore";
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
  { id: "trivia", label: "Trivia Etapei", active: true },
  { id: "zaruri", label: "Zarurile", active: true },
  { id: "sabotaj", label: "Sabotaj", active: true },
];

export const BONUS_CATALOG = [
  { id: "roulette", label: "Ruletă", active: true },
  { id: "mystery-box", label: "Mystery Box", active: true },
  { id: "penalty-pvp", label: "Penalty PvP", active: true },
];

// 16 segmente, distribuția aprobată. Ordinea de-aici NU e ordinea vizuală
// pe roată — la randare, componenta le rearanjează ca valorile identice
// să nu fie lipite (cerut explicit).
export const ROULETTE_SEGMENTS = [0, 0, 0, 0, 25, 25, 25, 25, 25, 50, 50, 50, 50, 75, 75, 100];

// 40 de cutii — distribuția aprobată cu 2×JOKER EXTRA, înlocuind 2 cutii
// de 50p (11→9), restul neschimbat: 5×100, 8×75, 9×50, 4×40, 3×30, 3×20,
// 6×0, 2×JOKER EXTRA (40 cutii). Ordinea din array NU e ordinea cutiilor
// pe grilă — se amestecă o singură dată, la Dezvăluire, și rămâne
// înghețată. IMPORTANT: array-ul e citit DOAR la crearea unui Mystery Box
// nou (revealBonus) — orice etapă deja dezvăluită are propriile boxValues
// înghețate în Firestore și NU e afectată de nicio schimbare de-aici.
export const JOKER_EXTRA_SENTINEL = "JOKER_EXTRA";
export const MYSTERY_BOX_VALUES = [
  100, 100, 100, 100, 100,
  75, 75, 75, 75, 75, 75, 75, 75,
  50, 50, 50, 50, 50, 50, 50, 50, 50,
  40, 40, 40, 40,
  30, 30, 30,
  20, 20, 20,
  0, 0, 0, 0, 0, 0,
  JOKER_EXTRA_SENTINEL, JOKER_EXTRA_SENTINEL,
];

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

const PENALTY_ZONES = ["left", "center", "right"];

// ══════════════════════════════════════════════════════════════════
// PENALTY PVP — funcție PURĂ, fără Firestore, testabilă independent.
// Aceeași folosită ATÂT de getPenaltyDuelPreview (live, înainte de
// Resolve) CÂT ȘI de resolveBonus (oficial) — o singură sursă de
// adevăr, niciodată recalculată diferit în două locuri.
//
// choicesA/choicesB: { shots: [5 zone], defends: [5 zone] }
// Runda i: A șutează în shots[i], B apără în defends[i] — GOL dacă
// zonele diferă, APĂRAT dacă sunt identice (regula cerută explicit).
// Simetric pentru B care șutează, A apără.
// ══════════════════════════════════════════════════════════════════
export function computePenaltyDuel(choicesA, choicesB) {
  const rounds = [];
  let aGoals = 0, aSaves = 0, bGoals = 0, bSaves = 0;
  for (let i = 0; i < 5; i++) {
    const aShot = choicesA.shots[i], bDefend = choicesB.defends[i];
    const aScores = aShot !== bDefend;
    if (aScores) aGoals++; else bSaves++;

    const bShot = choicesB.shots[i], aDefend = choicesA.defends[i];
    const bScores = bShot !== aDefend;
    if (bScores) bGoals++; else aSaves++;

    rounds.push({ aShot, bDefend, aScores, bShot, aDefend, bScores });
  }
  // +10 per gol marcat, +10 per apărare reușită — max 5×10+5×10=100.
  const aPoints = aGoals * 10 + aSaves * 10;
  const bPoints = bGoals * 10 + bSaves * 10;
  return {
    rounds,
    myGoals: aGoals, mySaves: aSaves, myPoints: aPoints,
    oppGoals: bGoals, oppSaves: bSaves, oppPoints: bPoints,
  };
}

function validatePenaltyChoiceArray(arr) {
  return Array.isArray(arr) && arr.length === 5 && arr.every((z) => PENALTY_ZONES.includes(z));
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
export async function configureSurprise(gameweekId, { mainType, bonusType, duelTheme } = {}) {
  await setDoc(doc(db, "weeklySurprises", gameweekId), { gameweekId }, { merge: true });
  if (mainType) {
    await setDoc(doc(db, "weeklySurprises", gameweekId, "secret", "main"), { type: mainType }, { merge: true });
  }
  if (bonusType) {
    await setDoc(doc(db, "weeklySurprises", gameweekId, "secret", "bonus"), { type: bonusType }, { merge: true });
  }
  // Tema de Duel — câmp soră lui `type`, pe același document. Independentă
  // de bibliotecă (poate fi aleasă chiar dacă tema n-are încă nicio
  // imagine — fallback automat la avatarul normal, vezi fighters.js).
  if (duelTheme !== undefined) {
    await setDoc(doc(db, "weeklySurprises", gameweekId, "secret", "main"), { duelTheme: duelTheme || null }, { merge: true });
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
    } else if (type === "trivia" || type === "zaruri") {
      // Reutilizează EXACT pairing-ul aleatoriu de la Duel Random —
      // aceeași funcție, aceeași regulă de Bye. Întrebările au fost DEJA
      // configurate de Admin (configureTriviaQuestions/configureZaruriQuestions,
      // oricând înainte) — le păstrăm neatinse, doar adăugăm perechile.
      const pairings = [];
      let byePlayer = null;
      for (let i = 0; i < activeUids.length; i += 2) {
        if (i + 1 < activeUids.length) pairings.push({ playerA: activeUids[i], playerB: activeUids[i + 1] });
        else byePlayer = activeUids[i];
      }
      config = { ...(secretData.config || {}), pairings, byePlayer };
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
    } else if (type === "sabotaj") {
      // Spre deosebire de toate celelalte tipuri, Sabotajul NU generează
      // perechile la Reveal — doar ÎNGHEAȚĂ ordinea de alegere (identică
      // ca sursă cu Jumate-Jumate Top/Bottom: clasamentul etapei
      // precedente, tie-break pe seasonPoints, fallback random dacă nu
      // există etapă anterioară finalizată). Alegerile reale se fac
      // secvențial, DUPĂ Reveal, prin submitSabotajChoice — vezi mai jos.
      const order = previousRankingTieBreak && previousRankingTieBreak.length > 0
        ? previousRankingTieBreak
        : activeUids;
      const usedRandomFallback = !previousRankingTieBreak || previousRankingTieBreak.length === 0;
      config = { order, usedRandomFallback };
    }

    tx.set(secretRef, { ...secretData, type, config }, { merge: true });
    tx.set(publicRef, { gameweekId, mainRevealed: true, mainRevealedAt: serverTimestamp() }, { merge: true });
  });
}

export async function revealBonus(gameweekId) {
  const publicRef = doc(db, "weeklySurprises", gameweekId);
  const secretRef = doc(db, "weeklySurprises", gameweekId, "secret", "bonus");
  // Shuffle-ul (dacă tipul chiar e Penalty) se face AICI, în afara
  // tranzacției — la fel ca la revealMain, care citește activeUids
  // înainte de tx. Seed distinct de cel de la MAIN ("_bonus_penalty",
  // nu "_main"), ca cele două pairing-uri (dacă ambele tipuri active
  // simultan) să nu coreleze vizibil.
  const activeUidsForPenalty = await listActiveUserIds();
  const shuffledForPenalty = shuffleDeterministic([...activeUidsForPenalty], gameweekId + "_bonus_penalty");

  await runTransaction(db, async (tx) => {
    const pubSnap = await tx.get(publicRef);
    if (pubSnap.exists() && pubSnap.data().bonusRevealed) return;

    const secretSnap = await tx.get(secretRef);
    const type = secretSnap.exists() ? secretSnap.data().type : null;
    if (type === "mystery-box") {
      // Amestecăm o SINGURĂ dată, aici — poziția cutiei (indexul din
      // array) rămâne înghețată tot timpul alegerii. Fisher-Yates, nu
      // Math.random().sort() (acela e cunoscut ca statistic incorect).
      const boxValues = [...MYSTERY_BOX_VALUES];
      for (let i = boxValues.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [boxValues[i], boxValues[j]] = [boxValues[j], boxValues[i]];
      }
      tx.set(secretRef, { config: { boxValues } }, { merge: true });
    } else if (type === "penalty-pvp") {
      // Aceeași regulă de pairing/Bye ca la Duel Random (revealMain) —
      // consecutiv, din lista amestecată determinist. Bye = 50p, fără
      // meci (deja afișat explicit în PenaltyExperience.jsx).
      const pairings = [];
      let byePlayer = null;
      for (let i = 0; i < shuffledForPenalty.length; i += 2) {
        if (i + 1 < shuffledForPenalty.length) pairings.push({ playerA: shuffledForPenalty[i], playerB: shuffledForPenalty[i + 1] });
        else byePlayer = shuffledForPenalty[i];
      }
      tx.set(secretRef, { config: { pairings, byePlayer } }, { merge: true });
    }

    tx.set(publicRef, { gameweekId, bonusRevealed: true, bonusRevealedAt: serverTimestamp() }, { merge: true });
  });
}

// ══════════════════════════════════════════════════════════════════
// SABOTAJ — funcții PURE (fără Firestore), testabile independent.
//
// PROBLEMA "ULTIMULUI JUCĂTOR": alegerea secvențială (fiecare din `order`
// alege exact o țintă, diferită de el însuși, dintre cele încă libere)
// poate ajunge într-o stare fără ieșire dacă nu e restricționată corect.
// Exemplu concret: order=[A,B,C]. A îl alege pe B. Dacă B îl alege apoi
// pe A (opțiune altfel perfect validă — A≠B), rămâne C, cu SINGURA
// țintă liberă fiind el însuși — blocaj.
//
// Demonstrație corectă (teorema lui Hall, pe graful bipartit "cine mai
// are de ales" ↔ "ce ținte mai sunt libere", muchie = oricine, mai puțin
// propria identitate — verificată REAL, cu testare exhaustivă, nu doar
// pe hârtie: o primă versiune a acestei demonstrații a fost GREȘITĂ,
// vezi mai jos):
//   Pentru orice submulțime S de jucători-care-mai-au-de-ales, mulțimea
//   țintelor accesibile din S e ÎNTREAGA mulțime de ținte libere T',
//   CU O SINGURĂ EXCEPȚIE: dacă S conține un SINGUR jucător și acela e
//   și el însuși o țintă încă liberă, atunci acel jucător exclude
//   exact o țintă (pe sine) din opțiunile lui — dar dacă S are 2+
//   jucători, excluderile lor (fiecare diferită — propria identitate)
//   se ANULEAZĂ reciproc prin reuniune, deci T' rămâne întreg accesibil.
//   Condiția lui Hall (|vecini(S)| ≥ |S|) eșuează STRICT o singură dată:
//   când rămâne EXACT un jucător de ales și EXACT o țintă liberă, și
//   sunt ACEEAȘI persoană — blocajul terminal descris mai sus.
//   În orice altă stare (0 rămași, sau 2+ rămași, indiferent de
//   suprapunere), o completare există întotdeauna.
//
// Soluția: la fiecare alegere, se respinge DOAR acea țintă care ar lăsa
// exact un jucător față-n-față cu propria identitate ca ultimă opțiune.
// Nu există reroll, nu există blocaj, nu există intervenție manuală.
// ══════════════════════════════════════════════════════════════════

// Verifică dacă alegerea (picker → target) e SIGURĂ — adică nu lasă,
// pentru restul lanțului, o stare fără completare validă posibilă.
export function isSabotajChoiceSafe(order, chosenPickers, takenTargets, picker, target) {
  const nextChosen = new Set([...chosenPickers, picker]);
  const nextTaken = new Set([...takenTargets, target]);
  const remainingPickers = order.filter((uid) => !nextChosen.has(uid));
  const remainingTargets = order.filter((uid) => !nextTaken.has(uid));
  // Unicul caz nesigur: mai rămâne EXACT un jucător de ales și EXACT o
  // țintă liberă, și sunt ACEEAȘI persoană — obligat să se auto-aleagă.
  if (remainingPickers.length === 1 && remainingTargets.length === 1) {
    return remainingPickers[0] !== remainingTargets[0];
  }
  return true;
}

// Lista de ținte SELECTABILE pentru `picker`, ACUM — exclude auto-țintirea,
// țintele deja luate, ȘI orice țintă care ar produce blocajul de mai sus.
export function getSabotajSelectableTargets(order, chosenPickers, takenTargets, picker) {
  const takenSet = new Set(takenTargets);
  return order.filter((uid) => {
    if (uid === picker) return false;
    if (takenSet.has(uid)) return false;
    return isSabotajChoiceSafe(order, chosenPickers, takenTargets, picker, uid);
  });
}

// E rândul lui `picker` ACUM? — doar dacă nu a ales deja și TOȚI cei
// dinaintea lui, în ordinea înghețată, au ales deja (verificăm doar
// predecesorul direct — prin inducție, dacă regula se aplică mereu,
// asta garantează automat prefixul complet, fără decalaje posibile).
export function isSabotajPickersTurn(order, chosenPickers, picker) {
  const idx = order.indexOf(picker);
  if (idx < 0) return false;
  if (chosenPickers.includes(picker)) return false;
  if (idx === 0) return true;
  return chosenPickers.includes(order[idx - 1]);
}

// ── Starea PUBLICĂ, anonimă, a fazei de alegere — cine a ales deja
// (`chosenPickers`, pentru gating-ul rândului) și ce ținte sunt deja
// luate (`takenTargets`, pentru grilă). NICIUNA din ele nu spune CINE
// a ales CE — doar existența celor 2 marcaje separate, scrise atomic
// de submitSabotajChoice. Sigur de citit de oricine, oricând. ──
export async function getSabotajPublicProgress(gameweekId, order) {
  const [pickedSnaps, takenSnaps] = await Promise.all([
    Promise.all(order.map((uid) => getDoc(doc(db, "weeklySurprises", gameweekId, "sabotajPicked", uid)))),
    Promise.all(order.map((uid) => getDoc(doc(db, "weeklySurprises", gameweekId, "sabotajTaken", uid)))),
  ]);
  const chosenPickers = order.filter((uid, i) => pickedSnaps[i].exists());
  const takenTargets = order.filter((uid, i) => takenSnaps[i].exists());
  return { chosenPickers, takenTargets };
}

// ── Alegerea PROPRIE a userului curent — owner-only per regula
// Firestore (sau oricine, DUPĂ sabotajRevealed). ──
export async function getMySabotajChoice(gameweekId, uid) {
  try {
    const snap = await getDoc(doc(db, "weeklySurprises", gameweekId, "sabotajChoices", uid));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    return null; // permission-denied = normal, încă nedezvăluit și nu ești tu owner-ul
  }
}

// ── Toate alegerile — Admin ORICÂND, oricine DUPĂ sabotajRevealed.
// Întoarce { pickerUid: targetUid }. ──
export async function getAllSabotajChoices(gameweekId, order) {
  const snaps = await Promise.all(order.map((uid) => getDoc(doc(db, "weeklySurprises", gameweekId, "sabotajChoices", uid))));
  const map = {};
  order.forEach((uid, i) => { if (snaps[i].exists()) map[uid] = snaps[i].data().target; });
  return map;
}

// ── ALEGEREA ATOMICĂ — inima securității Sabotajului. Citește starea
// FRESH (predecesor + toate țintele) chiar în tranzacție, revalidează
// TOTUL (rândul e al lui, ținta nu-i el însuși, ținta e liberă, alegerea
// nu creează blocajul demonstrat mai sus), apoi scrie 3 documente atomic:
//   - sabotajChoices/{picker}  → SECRET (uid+target+pickerIndex)
//   - sabotajPicked/{picker}   → PUBLIC, anonim (doar "a ales")
//   - sabotajTaken/{target}    → PUBLIC, anonim (doar "e luată")
// Toate create-only — regula Firestore interzice update/delete, deci
// odată confirmată, alegerea e ireversibilă la nivel de bază de date,
// nu doar de UI. Dacă 2 dispozitive încearcă simultan, Firestore
// serializează tranzacțiile — a doua repetă cu starea proaspătă și
// respinge dacă rândul/ținta nu mai sunt valide.
// `pickerIndex` (poziția lui uid în `order`) e inclus explicit în
// document ca REGULA FIRESTORE însăși să poată verifica independent că
// rândul e cu adevărat al lui — nu doar tranzacția JS. Regula verifică
// atât `order[pickerIndex] == uid` (dovedește indexul corect), cât și
// că predecesorul (`order[pickerIndex-1]`) are deja `sabotajPicked` —
// deci un client care ar ocoli complet submitSabotajChoice și ar scrie
// direct în Firestore tot nu poate alege în afara rândului lui. ──
export async function submitSabotajChoice(gameweekId, uid, target) {
  const secretRef = doc(db, "weeklySurprises", gameweekId, "secret", "main");
  const secretSnap = await getDoc(secretRef);
  if (!secretSnap.exists() || secretSnap.data().type !== "sabotaj") {
    throw new Error("Sabotajul nu e activ pentru etapa asta.");
  }
  const order = secretSnap.data().config?.order || [];
  if (target === uid) throw new Error("Nu te poți sabota pe tine însuți.");
  if (!order.includes(uid) || !order.includes(target)) throw new Error("Participant invalid.");

  await runTransaction(db, async (tx) => {
    const myChoiceRef = doc(db, "weeklySurprises", gameweekId, "sabotajChoices", uid);
    const myPickedRef = doc(db, "weeklySurprises", gameweekId, "sabotajPicked", uid);
    const targetTakenRef = doc(db, "weeklySurprises", gameweekId, "sabotajTaken", target);

    const [myChoiceSnap, targetTakenSnap] = await Promise.all([tx.get(myChoiceRef), tx.get(targetTakenRef)]);
    if (myChoiceSnap.exists()) throw new Error("Ai ales deja — alegerea e definitivă.");
    if (targetTakenSnap.exists()) throw new Error("Ținta tocmai a fost luată de altcineva — alege alta.");

    // Re-citim TOATĂ starea proaspătă, ca verificarea de siguranță să
    // ruleze pe date curente, nu pe cele din momentul randării UI.
    const [pickedSnaps, takenSnaps] = await Promise.all([
      Promise.all(order.map((u) => tx.get(doc(db, "weeklySurprises", gameweekId, "sabotajPicked", u)))),
      Promise.all(order.map((u) => tx.get(doc(db, "weeklySurprises", gameweekId, "sabotajTaken", u)))),
    ]);
    const chosenPickers = order.filter((u, i) => pickedSnaps[i].exists());
    const takenTargets = order.filter((u, i) => takenSnaps[i].exists());

    if (!isSabotajPickersTurn(order, chosenPickers, uid)) {
      throw new Error("Nu e rândul tău încă.");
    }
    if (!isSabotajChoiceSafe(order, chosenPickers, takenTargets, uid, target)) {
      throw new Error("Alegerea asta ar bloca un jucător de mai târziu — alege altă țintă.");
    }

    tx.set(myChoiceRef, { uid, target, pickerIndex: order.indexOf(uid), createdAt: serverTimestamp() });
    tx.set(myPickedRef, { picked: true });
    tx.set(targetTakenRef, { taken: true });
  });
}

// ── Admin — RECOVERY: anulează DOAR ultima alegere din secvență (cea a
// ultimului picker din `chosenPickers`), atomic, folosind exact regula
// `allow delete: if isAdmin()` introdusă pentru exact acest scop. Șterge
// toate 3 documentele lui (choice+picked+taken) într-o SINGURĂ tranzacție
// — ori toate 3, ori niciunul, niciun orphan posibil. NU atinge targetul
// direct (Adminul nu poate alege în locul jucătorului) — doar întoarce
// tura la pickerul respectiv, ca s-o refacă el însuși. Refuzată explicit
// după sabotajRevealed sau mainResolved — recovery e valabilă STRICT în
// faza de alegere. ──
export async function undoLastSabotajChoice(gameweekId) {
  const publicRef = doc(db, "weeklySurprises", gameweekId);
  const secretRef = doc(db, "weeklySurprises", gameweekId, "secret", "main");

  const [pubSnap, secretSnap] = await Promise.all([getDoc(publicRef), getDoc(secretRef)]);
  if (pubSnap.exists() && pubSnap.data().sabotajRevealed) {
    throw new Error("Nu mai poți anula alegeri — rețeaua Sabotajului a fost deja dezvăluită.");
  }
  if (pubSnap.exists() && pubSnap.data().mainResolved) {
    throw new Error("Nu mai poți anula alegeri — Sabotajul a fost deja rezolvat.");
  }
  if (!secretSnap.exists() || secretSnap.data().type !== "sabotaj") {
    throw new Error("Sabotajul nu e configurat pentru etapa asta.");
  }
  const order = secretSnap.data().config?.order || [];
  const { chosenPickers } = await getSabotajPublicProgress(gameweekId, order);
  if (chosenPickers.length === 0) {
    throw new Error("Nu există nicio alegere de anulat.");
  }
  const lastPicker = chosenPickers[chosenPickers.length - 1];

  const choiceRef = doc(db, "weeklySurprises", gameweekId, "sabotajChoices", lastPicker);
  const pickedRef = doc(db, "weeklySurprises", gameweekId, "sabotajPicked", lastPicker);

  await runTransaction(db, async (tx) => {
    const choiceSnap = await tx.get(choiceRef);
    if (!choiceSnap.exists()) throw new Error("Alegerea nu mai există — poate a fost deja anulată.");
    const target = choiceSnap.data().target;
    const takenRef = doc(db, "weeklySurprises", gameweekId, "sabotajTaken", target);
    const takenSnap = await tx.get(takenRef);

    tx.delete(choiceRef);
    tx.delete(pickedRef);
    if (takenSnap.exists()) tx.delete(takenRef);
  });

  return { undonePicker: lastPicker };
}

// ── Admin — dezvăluie TOATĂ rețeaua Sabotajului simultan. Refuză dacă
// mai lipsește vreo alegere (nu poți dezvălui un lanț incomplet).
// Idempotent — al doilea apel nu face nimic. NU modifică nicio alegere,
// doar comută vizibilitatea lui sabotajChoices/*. ──
export async function revealSabotajNetwork(gameweekId) {
  const publicRef = doc(db, "weeklySurprises", gameweekId);
  const secretRef = doc(db, "weeklySurprises", gameweekId, "secret", "main");
  const secretSnap = await getDoc(secretRef);
  const order = secretSnap.exists() ? (secretSnap.data().config?.order || []) : [];
  const { chosenPickers } = await getSabotajPublicProgress(gameweekId, order);
  if (chosenPickers.length < order.length) {
    throw new Error(`Nu toți jucătorii și-au ales ținta încă (${chosenPickers.length}/${order.length}).`);
  }
  await runTransaction(db, async (tx) => {
    const pubSnap = await tx.get(publicRef);
    if (pubSnap.exists() && pubSnap.data().sabotajRevealed) return;
    tx.set(publicRef, { gameweekId, sabotajRevealed: true, sabotajRevealedAt: serverTimestamp() }, { merge: true });
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

  // Pentru Trivia — scorul de BAZĂ nu vine din meciuri, ci din răspunsuri
  // vs răspunsul corect marcat de Admin. Calculat DINAINTE de tranzacție
  // (multe citiri, nu se pretează la read-then-write strict). Verificăm
  // tipul printr-o citire simplă, în afara tranzacției — tranzacția însăși
  // tot recitește totul, idempotența nu are de suferit.
  const preSecretSnap = await getDoc(secretRef);
  const preType = preSecretSnap.exists() ? preSecretSnap.data().type : null;
  let triviaBaseByUid = {};
  if (preType === "trivia") {
    const questions = preSecretSnap.data().config?.questions || [];
    const activeUids = [...(await listActiveUserIds())];
    triviaBaseByUid = Object.fromEntries(activeUids.map((uid) => [uid, 0]));
    for (const uid of activeUids) {
      const answers = await getMyTriviaAnswers(gameweekId, uid, questions.map((q) => q.id));
      let base = 0;
      questions.forEach((q) => {
        if (q.correctAnswer && answers[q.id] === q.correctAnswer) base += 15;
      });
      triviaBaseByUid[uid] = base;
    }
  }

  // Pentru Zaruri — scorul de bază din suma aruncărilor vs ținta reală,
  // 30−5×distanță per întrebare, BUST (a depășit ținta) = 0, clamped la
  // 0 în jos. Totalul (indiferent dacă userul a apăsat explicit STOP —
  // aceeași filozofie ca la Ruletă: la Resolve se ia suma existentă,
  // "orice avea în acel moment").
  let zaruriBaseByUid = {};
  if (preType === "zaruri") {
    const questions = preSecretSnap.data().config?.questions || [];
    const activeUids = [...(await listActiveUserIds())];
    zaruriBaseByUid = Object.fromEntries(activeUids.map((uid) => [uid, 0]));
    for (const uid of activeUids) {
      let base = 0;
      for (const q of questions) {
        if (q.correctTarget == null) continue;
        const state = await getMyDiceState(gameweekId, uid, q.id);
        if (state.total > q.correctTarget) continue; // BUST = 0p pentru întrebarea asta
        const distance = q.correctTarget - state.total;
        base += Math.max(0, 30 - 5 * distance);
      }
      zaruriBaseByUid[uid] = base;
    }
  }

  // GARDĂ SABOTAJ — nu poți rezolva un lanț a cărui rețea nu a fost
  // încă dezvăluită (Admin trebuie să apese explicit "Dezvăluie
  // Sabotajele" înainte — altfel userii ar vedea direct rezultatul
  // final, fără să fi văzut vreodată cine pe cine a ales).
  if (preType === "sabotaj" && !preSecretSnap.exists()) {
    throw new Error("Sabotajul nu e configurat pentru etapa asta.");
  }
  let sabotajResultByUid = {};
  if (preType === "sabotaj") {
    const pubSnapPre = await getDoc(publicRef);
    if (!pubSnapPre.exists() || !pubSnapPre.data().sabotajRevealed) {
      throw new Error("Nu poți rezolva Sabotajul — rețeaua nu a fost dezvăluită încă (apasă mai întâi „🔥 Dezvăluie Sabotajele”).");
    }
    // TOATE confruntările se evaluează din ACELAȘI snapshot (scoreByUid,
    // luat mai sus) — NICIODATĂ în cascadă. Dacă A îl bate pe B și C îl
    // bate pe A, transferul lui C NU ține cont de cele +200p pe care A
    // tocmai le-a primit de la B — exact cerința explicită.
    const order = preSecretSnap.data().config?.order || [];
    const choicesMap = await getAllSabotajChoices(gameweekId, order); // picker → target
    const inverseMap = {}; // target → picker
    Object.entries(choicesMap).forEach(([picker, target]) => { inverseMap[target] = picker; });

    const net = Object.fromEntries(order.map((uid) => [uid, 0]));
    const detail = Object.fromEntries(order.map((uid) => [uid, {
      target: choicesMap[uid] || null, targetOutcome: null, targetTransfer: 0, targetScores: null,
      attacker: inverseMap[uid] || null, attackerOutcome: null, attackerTransfer: 0, attackerScores: null,
    }]));

    order.forEach((picker) => {
      const target = choicesMap[picker];
      if (!target) return; // defensiv — nu ar trebui să se-ntâmple dacă sabotajRevealed==true
      const rawAttacker = scoreByUid[picker] || 0;
      const rawVictim = scoreByUid[target] || 0;
      // transfer = min(200, punctele DISPONIBILE ale victimei) — victima
      // nu poate ajunge sub 0 DIN CAUZA Sabotajului; DRAW = transfer 0.
      const transfer = rawAttacker > rawVictim ? Math.min(200, rawVictim) : 0;
      net[picker] += transfer;
      net[target] -= transfer;
      detail[picker].targetOutcome = transfer > 0 ? "success" : "fail";
      detail[picker].targetTransfer = transfer;
      detail[picker].targetScores = { mine: rawAttacker, theirs: rawVictim };
      detail[target].attackerOutcome = transfer > 0 ? "success" : "fail";
      detail[target].attackerTransfer = transfer;
      detail[target].attackerScores = { mine: rawVictim, theirs: rawAttacker };
    });
    sabotajResultByUid = { net, detail };
  }

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
    } else if (mainType === "trivia") {
      // Scorul de bază (din triviaBaseByUid, precalculat mai sus) +
      // bonusul de duel: câștigător +50p, egalitate +25p fiecare,
      // pierdere +0p. Bye = bază + 25p (jumătate din maximul de duel,
      // aceeași convenție folosită și la celelalte tipuri).
      const { pairings = [], byePlayer = null } = config;
      pairings.forEach(({ playerA, playerB }) => {
        const baseA = triviaBaseByUid[playerA] || 0;
        const baseB = triviaBaseByUid[playerB] || 0;
        let bonusA, bonusB;
        if (baseA > baseB) { bonusA = 50; bonusB = 0; }
        else if (baseB > baseA) { bonusA = 0; bonusB = 50; }
        else { bonusA = 25; bonusB = 25; }
        toWrite.push({ uid: playerA, points: baseA + bonusA, matchScore: baseA, opponentMatchScore: baseB });
        toWrite.push({ uid: playerB, points: baseB + bonusB, matchScore: baseB, opponentMatchScore: baseA });
      });
      if (byePlayer) {
        const base = triviaBaseByUid[byePlayer] || 0;
        toWrite.push({ uid: byePlayer, points: base + 25, matchScore: base, opponentMatchScore: null });
      }
    } else if (mainType === "zaruri") {
      // Identic structural cu Trivia — doar sursa scorului de bază diferă
      // (zaruriBaseByUid, din aruncări vs țintă, nu din răspunsuri).
      const { pairings = [], byePlayer = null } = config;
      pairings.forEach(({ playerA, playerB }) => {
        const baseA = zaruriBaseByUid[playerA] || 0;
        const baseB = zaruriBaseByUid[playerB] || 0;
        let bonusA, bonusB;
        if (baseA > baseB) { bonusA = 50; bonusB = 0; }
        else if (baseB > baseA) { bonusA = 0; bonusB = 50; }
        else { bonusA = 25; bonusB = 25; }
        toWrite.push({ uid: playerA, points: baseA + bonusA, matchScore: baseA, opponentMatchScore: baseB });
        toWrite.push({ uid: playerB, points: baseB + bonusB, matchScore: baseB, opponentMatchScore: baseA });
      });
      if (byePlayer) {
        const base = zaruriBaseByUid[byePlayer] || 0;
        toWrite.push({ uid: byePlayer, points: base + 25, matchScore: base, opponentMatchScore: null });
      }
    } else if (mainType === "sabotaj") {
      // Transferurile au fost DEJA calculate mai sus (sabotajResultByUid),
      // dintr-un SINGUR snapshot comun — aici doar le transformăm în
      // scrieri. mainPoints poate fi NEGATIV (o victimă netă) — intenționat,
      // e un transfer real, nu un bonus, suma tuturor rămâne 0.
      const { net = {}, detail = {} } = sabotajResultByUid;
      Object.keys(net).forEach((uid) => {
        toWrite.push({ uid, points: net[uid], matchScore: null, opponentMatchScore: null, sabotaj: detail[uid] });
      });
    }

    // FAZA DE CITIRE — toate înaintea oricărei scrieri.
    // NOTĂ IMPORTANTĂ: NU se mai citește/scrie users.seasonPoints aici.
    // Premiul (mainPoints) se PERSISTĂ, dar se ADUNĂ în totalurile
    // cumulative STRICT o singură dată, la finalizeGameweek — altfel
    // riscul de dublare (Resolve + Finalize, ambele incrementând
    // seasonPoints separat) era exact sursa haosului raportat.
    // FAZA DE SCRIERE.
    toWrite.forEach((r) => {
      const payload = {
        uid: r.uid, mainPoints: r.points, mainMatchScore: r.matchScore, mainOpponentMatchScore: r.opponentMatchScore,
      };
      if (r.sabotaj) payload.sabotaj = r.sabotaj; // doar la tipul sabotaj — celelalte tipuri neatinse
      tx.set(doc(db, "weeklySurprises", gameweekId, "results", r.uid), payload, { merge: true });
    });
    tx.set(publicRef, { mainResolved: true }, { merge: true });
  });
}

// ── RESOLVE BONUS — rezultatul final per user e determinist, calculat
// din ULTIMA alegere (Ruletă: spin2 dacă există, altfel spin1 · Mystery
// Box: a doua cutie aleasă, dacă a rejucat, altfel prima). Nicio decizie
// "de câștigător" nu e necesară, doar aplicarea punctelor. Tot idempotent,
// tot tranzacțional. ──
export async function resolveBonus(gameweekId) {
  const publicRef = doc(db, "weeklySurprises", gameweekId);
  const activeUids = [...(await listActiveUserIds())];
  const secretSnap = await getDoc(doc(db, "weeklySurprises", gameweekId, "secret", "bonus"));
  const bonusType = secretSnap.exists() ? secretSnap.data().type : null;

  let resultsPerUser;
  let penaltyDetailByUid = {}; // doar pentru penalty-pvp — { uid: {myGoals,mySaves,opponentGoals,opponentSaves} }
  if (bonusType === "mystery-box") {
    const boxValues = secretSnap.exists() ? (secretSnap.data().config?.boxValues || []) : [];
    const picksSnap = await getDocs(collection(db, "weeklySurprises", gameweekId, "mysteryBoxPicks"));
    const finalPickByUid = {};
    picksSnap.docs.forEach((d) => {
      const data = d.data();
      const boxIndex = parseInt(d.id, 10);
      const existing = finalPickByUid[data.uid];
      if (!existing || (data.pickNumber || 1) > existing.pickNumber) {
        finalPickByUid[data.uid] = { boxIndex, pickNumber: data.pickNumber || 1 };
      }
    });
    resultsPerUser = activeUids.map((uid) => {
      const pick = finalPickByUid[uid];
      // Joker Extra NU e un premiu în puncte — dacă alegerea finală cade
      // pe o cutie Joker Extra (sentinel string, nu număr), contribuția
      // la scor e 0p. Eligibilitatea de folosire a Jokerului Extra se
      // verifică separat, live, direct din board+picks (vezi
      // checkJokerExtraEligibility mai jos) — NU depinde de rularea
      // acestei funcții.
      const rawValue = pick ? boxValues[pick.boxIndex] : 0;
      const points = typeof rawValue === "number" ? rawValue : 0;
      return { uid, points };
    });
  } else if (bonusType === "penalty-pvp") {
    // Determinist, din CHOICES persistate — NICIODATĂ dintr-un punctaj
    // trimis direct de client. Aceeași computePenaltyDuel ca la preview
    // — o singură sursă de adevăr, nu recalculată diferit aici.
    const { pairings = [], byePlayer = null } = secretSnap.exists() ? (secretSnap.data().config || {}) : {};
    const choicesSnap = await getDocs(collection(db, "weeklySurprises", gameweekId, "penaltyChoices"));
    const choicesByUid = {};
    choicesSnap.docs.forEach((d) => { choicesByUid[d.id] = d.data(); });

    resultsPerUser = [];
    pairings.forEach(({ playerA, playerB }) => {
      const cA = choicesByUid[playerA], cB = choicesByUid[playerB];
      // Cine nu a trimis alegerile pierde tot (0p) — cealaltă parte ia
      // punctaj maxim doar pe rolul pentru care ADVERSARUL lipsește
      // (5 lovituri automat "gol", n-are ce apăra pe bune) — aceeași
      // filozofie ca la celelalte tipuri de Duel din aplicație.
      if (cA && cB) {
        const result = computePenaltyDuel(cA, cB);
        resultsPerUser.push({ uid: playerA, points: result.myPoints });
        resultsPerUser.push({ uid: playerB, points: result.oppPoints });
        penaltyDetailByUid[playerA] = { myGoals: result.myGoals, mySaves: result.mySaves, opponentGoals: result.oppGoals, opponentSaves: result.oppSaves };
        penaltyDetailByUid[playerB] = { myGoals: result.oppGoals, mySaves: result.oppSaves, opponentGoals: result.myGoals, opponentSaves: result.mySaves };
      } else if (cA && !cB) {
        resultsPerUser.push({ uid: playerA, points: 50 });
        resultsPerUser.push({ uid: playerB, points: 0 });
        penaltyDetailByUid[playerA] = { myGoals: 5, mySaves: 0, opponentGoals: 0, opponentSaves: 0 };
      } else if (!cA && cB) {
        resultsPerUser.push({ uid: playerA, points: 0 });
        resultsPerUser.push({ uid: playerB, points: 50 });
        penaltyDetailByUid[playerB] = { myGoals: 5, mySaves: 0, opponentGoals: 0, opponentSaves: 0 };
      } else {
        resultsPerUser.push({ uid: playerA, points: 0 });
        resultsPerUser.push({ uid: playerB, points: 0 });
      }
    });
    if (byePlayer) resultsPerUser.push({ uid: byePlayer, points: 50 });
  } else {
    // Ruletă — neschimbat.
    resultsPerUser = await Promise.all(activeUids.map(async (uid) => {
      const [s1, s2] = await Promise.all([
        getDoc(doc(db, "weeklySurprises", gameweekId, "rouletteSpins", `1_${uid}`)),
        getDoc(doc(db, "weeklySurprises", gameweekId, "rouletteSpins", `2_${uid}`)),
      ]);
      const finalValue = s2.exists() ? s2.data().value : (s1.exists() ? s1.data().value : 0);
      return { uid, points: finalValue };
    }));
  }

  await runTransaction(db, async (tx) => {
    const pubSnap = await tx.get(publicRef);
    if (!pubSnap.exists() || !pubSnap.data().bonusRevealed) throw new Error("BONUS nu a fost dezvăluit încă.");
    if (pubSnap.data().bonusResolved) return;

    // Premiul se persistă, dar NU se mai adaugă la users.seasonPoints
    // aici — se consolidează o singură dată, la finalizeGameweek, exact
    // ca la Main (motivul e identic: evită dublarea la Resolve+Finalize).
    resultsPerUser.forEach((r) => {
      const extra = penaltyDetailByUid[r.uid] ? { penalty: penaltyDetailByUid[r.uid] } : {};
      tx.set(doc(db, "weeklySurprises", gameweekId, "results", r.uid), { uid: r.uid, bonusPoints: r.points, ...extra }, { merge: true });
    });
    tx.set(publicRef, { bonusResolved: true }, { merge: true });
  });
}

// ══════════════════════════════════════════════════════════════════
// PENALTY PVP — 1v1, 5 runde, fiecare jucător e și executant și portar
// în fiecare rundă (execută pe shots[i], apără pe defends[i]). Reguli
// de pairing IDENTICE cu Duel Random (revealBonus, mai sus) — perechi
// consecutive dintr-o listă amestecată determinist, Bye = 50p fără meci.
// ══════════════════════════════════════════════════════════════════

// ── Perechea userului curent — { opponentUid, isBye }. null dacă
// Bonusul ăsta nu e (încă) Penalty PvP dezvăluit. ──
export async function getMyPenaltyPairing(gameweekId, uid) {
  const secretSnap = await getDoc(doc(db, "weeklySurprises", gameweekId, "secret", "bonus"));
  if (!secretSnap.exists()) return null;
  const { pairings = [], byePlayer = null } = secretSnap.data().config || {};
  if (byePlayer === uid) return { opponentUid: null, isBye: true };
  const pair = pairings.find((p) => p.playerA === uid || p.playerB === uid);
  if (!pair) return null;
  return { opponentUid: pair.playerA === uid ? pair.playerB : pair.playerA, isBye: false };
}

// ── Alegerile PROPRII ale userului curent — null dacă nu a trimis
// încă. Regula Firestore permite owner-ul să-și citească oricând
// propriul document (vezi blocul de reguli din raport). ──
export async function getMyPenaltyChoices(gameweekId, uid) {
  try {
    const snap = await getDoc(doc(db, "weeklySurprises", gameweekId, "penaltyChoices", uid));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    return null;
  }
}

// ── Cine a trimis deja (indiferent de conținut) — folosit DOAR ca să
// arate "adversarul a trimis și el" în ecranul de așteptare, NU pentru
// a citi conținutul alegerilor lui. Regula Firestore permite citirea
// documentului penaltySubmitted/{uid} (doar flag boolean, fără zone)
// oricui e autentificat — nu scurge nimic secret. ──
export async function getPenaltySubmittedUids(gameweekId) {
  try {
    const snap = await getDocs(collection(db, "weeklySurprises", gameweekId, "penaltySubmitted"));
    return new Set(snap.docs.map((d) => d.id));
  } catch (err) {
    return new Set(); // permission-denied = regulile nu sunt încă live, nu blocăm ecranul
  }
}

// ── Trimite alegerile — validare completă client-side (Firestore
// Rules validează din nou, independent, nu se bazează doar pe asta).
// Scrie DOUĂ documente: penaltyChoices/{uid} (secretul real, create-only
// — Rules interzice update/delete, deci "definitiv după trimitere" e
// garantat STRUCTURAL, nu doar UI) și penaltySubmitted/{uid} (doar
// marcaj public "a trimis", fără conținut secret). ──
export async function submitPenaltyChoices(gameweekId, uid, shots, defends) {
  if (!validatePenaltyChoiceArray(shots)) throw new Error("Loviturile trebuie să fie exact 5 zone valide (left/center/right).");
  if (!validatePenaltyChoiceArray(defends)) throw new Error("Apărările trebuie să fie exact 5 zone valide (left/center/right).");

  const existing = await getDoc(doc(db, "weeklySurprises", gameweekId, "penaltyChoices", uid));
  if (existing.exists()) throw new Error("Ai trimis deja alegerile pentru duelul ăsta.");

  await Promise.all([
    setDoc(doc(db, "weeklySurprises", gameweekId, "penaltyChoices", uid), { uid, shots, defends, createdAt: serverTimestamp() }),
    setDoc(doc(db, "weeklySurprises", gameweekId, "penaltySubmitted", uid), { uid, submittedAt: serverTimestamp() }),
  ]);
}

// ── Preview LIVE al duelului — funcționează DOAR după ce AMBII au
// trimis (regula Firestore blochează citirea alegerilor adversarului
// altfel — vezi PRIVACY în raport). Folosește EXACT computePenaltyDuel,
// aceeași funcție ca resolveBonus — niciodată recalculată diferit. ──
export async function getPenaltyDuelPreview(gameweekId, myUid, opponentUid) {
  const [mySnap, oppSnap] = await Promise.all([
    getDoc(doc(db, "weeklySurprises", gameweekId, "penaltyChoices", myUid)),
    getDoc(doc(db, "weeklySurprises", gameweekId, "penaltyChoices", opponentUid)).catch(() => ({ exists: () => false })),
  ]);
  if (!mySnap.exists() || !oppSnap.exists()) return null;
  return computePenaltyDuel(mySnap.data(), oppSnap.data());
}


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

// ══════════════════════════════════════════════════════════════════
// MYSTERY BOX — 30 cutii cu poziții FIXE (amestecate o singură dată la
// revealBonus, vezi mai sus). Alegerile sunt PUBLICE imediat — nume +
// valoare vizibile tuturor, live, pe măsură ce oamenii aleg (nu suspans
// comun la final — asta a fost cerut explicit). Doar cutiile NEALESE
// rămân ascunse, până Adminul le dezvăluie pe toate deodată la final.
// Fiecare user: o alegere, plus opțional UNA în plus (rejoc, ca la
// Ruletă) — prima cutie rămâne marcată cu numele lui (vizibil ca
// "refuzată"), a doua devine cea finală pentru scor.
// ══════════════════════════════════════════════════════════════════

// ── Tabla — cele 30 de valori, în ordinea (amestecată) înghețată la
// reveal. null dacă Bonusul încă nu a fost dezvăluit sau nu e tipul
// mystery-box pentru etapa asta. ──
export async function getMysteryBoxBoard(gameweekId) {
  const snap = await getDoc(doc(db, "weeklySurprises", gameweekId, "secret", "bonus"));
  if (!snap.exists()) return null;
  return snap.data().config?.boxValues || null;
}

// ── Toate alegerile făcute până acum, pentru toată lumea — folosită
// pentru grila publică (cine a ales ce cutie, cu ce valoare). ──
export async function getAllMysteryBoxPicks(gameweekId) {
  const snap = await getDocs(collection(db, "weeklySurprises", gameweekId, "mysteryBoxPicks"));
  return snap.docs
    .map((d) => ({ boxIndex: parseInt(d.id, 10), ...d.data() }))
    .sort((a, b) => a.boxIndex - b.boxIndex);
}

// ── Alegerea unei cutii — create-only pe indexul cutiei (Firestore
// refuză al doilea create pe același ID, deci "o cutie = o singură
// alegere" e garantat structural, nu doar verificat în cod). Max 2
// alegeri per user (prima + un rejoc) — verificat printr-o interogare
// proaspătă chiar înainte de scriere (aceeași filozofie ca-n restul
// aplicației: grup de prieteni, nu adversarial). ──
export async function submitMysteryBoxPick(gameweekId, uid, boxIndex) {
  const existing = await getDocs(query(collection(db, "weeklySurprises", gameweekId, "mysteryBoxPicks"), where("uid", "==", uid)));
  if (existing.size >= 2) throw new Error("Ai folosit deja ambele alegeri — inclusiv rejocul.");
  const boxSnap = await getDoc(doc(db, "weeklySurprises", gameweekId, "mysteryBoxPicks", String(boxIndex)));
  if (boxSnap.exists()) throw new Error("Cutia asta a fost deja aleasă de altcineva.");

  const pickNumber = existing.size + 1;
  const ref = doc(db, "weeklySurprises", gameweekId, "mysteryBoxPicks", String(boxIndex));
  await setDoc(ref, { uid, pickNumber, createdAt: serverTimestamp() });
  return { boxIndex, pickNumber };
}

// ── Admin — dezvăluie valorile cutiilor NEALESE (cele alese sunt deja
// vizibile, live, din momentul alegerii — vezi mai sus). Un simplu flag
// public — nu mișcă date, doar comută ce arată aplicația pentru cutiile
// fără nume pe ele. Idempotent. ──
export async function revealRemainingMysteryBoxes(gameweekId) {
  const publicRef = doc(db, "weeklySurprises", gameweekId);
  await setDoc(publicRef, { mysteryBoxAllRevealed: true }, { merge: true });
}

// ── JOKER EXTRA — eligibilitate. Câștigat DOAR prin Mystery Box (cutii
// speciale, vezi JOKER_EXTRA_SENTINEL mai sus), NU printr-o colecție
// separată de "granturi" — se verifică live, direct din board + picks,
// exact ca punctajul normal. Regula e identică cu cea de la puncte:
// contează ALEGEREA FINALĂ (a doua cutie, dacă a rejucat, altfel prima).
// Dacă cineva ia Joker Extra prima dată și apoi rejoacă, îl pierde —
// exact cum ar pierde și punctele — comportament consecvent, nimic nou
// de învățat pentru jucători. Fiind calculată live din datele ETAPEI
// CURENTE, nu există nicio stocare separată care ar putea "rămâne" în
// etapele viitoare — la o etapă nouă, fără picks noi, eligibilitatea e
// automat false, deci Jokerul Extra nefolosit la deadline se pierde de
// la sine, fără nicio curățenie de date necesară. ──
export async function checkJokerExtraEligibility(gameweekId, uid) {
  const [board, picks] = await Promise.all([getMysteryBoxBoard(gameweekId), getAllMysteryBoxPicks(gameweekId)]);
  if (!board) return false;
  const myPicks = picks.filter((p) => p.uid === uid).sort((a, b) => (a.pickNumber || 1) - (b.pickNumber || 1));
  const finalPick = myPicks[myPicks.length - 1];
  if (!finalPick) return false;
  return board[finalPick.boxIndex] === JOKER_EXTRA_SENTINEL;
}

// ── Istoricul sezonului — o intrare per etapă, cu starea calculată. ──
// ══════════════════════════════════════════════════════════════════
// TRIVIA ETAPEI — 10 întrebări × 2 variante (A/B, etichete libere:
// "DA"/"NU", "Peste"/"Sub", "Barcelona"/"Real" etc.), 15p fiecare
// (max 150p bază) + Duel 1v1 (comparând scorul de bază): câștigător
// +50p, egalitate +25p fiecare, pierdere +0p. Bye (impar) = bază+25p.
// Total maxim posibil: 150+50 = 200p, exact regula generală.
// ══════════════════════════════════════════════════════════════════

// ── Admin — configurează cele 10 întrebări, ÎNAINTE de Dezvăluire (sau
// oricând, chiar și după — se pot ajusta din mers, cât nu s-a Rezolvat
// încă). Fiecare întrebare: { id, text, optionALabel, optionBLabel,
// correctAnswer: null|'A'|'B' }. correctAnswer pornește null — Admin îl
// marchează separat, după ce evenimentele din etapă s-au produs. ──
export async function configureTriviaQuestions(gameweekId, questions) {
  await setDoc(doc(db, "weeklySurprises", gameweekId, "secret", "main"), {
    config: { questions },
  }, { merge: true });
}

// ── Admin — marchează răspunsul corect pentru O întrebare (progresiv,
// pe măsură ce evenimentele se clarifică, nu neapărat toate deodată).
// Citește-modifică-scrie array-ul complet (Firestore nu suportă update
// pe un singur element din array direct). ──
export async function markTriviaCorrectAnswer(gameweekId, questionId, correctAnswer) {
  const secretRef = doc(db, "weeklySurprises", gameweekId, "secret", "main");
  const snap = await getDoc(secretRef);
  if (!snap.exists()) throw new Error("Trivia nu e configurată încă pentru etapa asta.");
  const questions = (snap.data().config?.questions || []).map((q) =>
    q.id === questionId ? { ...q, correctAnswer } : q
  );
  await setDoc(secretRef, { config: { ...snap.data().config, questions } }, { merge: true });
}

// ── User — răspunde la o întrebare. Editabil liber până la Resolve
// (fără lock intermediar, Trivia n-are "kickoff" per întrebare). ──
export async function submitTriviaAnswer(gameweekId, uid, questionId, answer) {
  await setDoc(doc(db, "weeklySurprises", gameweekId, "triviaAnswers", `${questionId}_${uid}`), {
    uid, questionId, answer, updatedAt: serverTimestamp(),
  }, { merge: true });
}

// ── Răspunsurile PROPRII ale userului curent — pentru pre-completarea
// formularului. Owner-only, per regula Firestore. ──
export async function getMyTriviaAnswers(gameweekId, uid, questionIds) {
  const snaps = await Promise.all(questionIds.map((qid) =>
    getDoc(doc(db, "weeklySurprises", gameweekId, "triviaAnswers", `${qid}_${uid}`))
  ));
  const answers = {};
  snaps.forEach((snap, i) => { if (snap.exists()) answers[questionIds[i]] = snap.data().answer; });
  return answers;
}

// ── Admin — status de completare per user (câte din 10 a răspuns),
// FĂRĂ să expună valorile răspunsurilor (nu e nevoie, Admin oricum are
// acces total, dar păstrăm funcția minimală — doar ce cere UI-ul). ──
export async function getTriviaSubmissionStatus(gameweekId, questionIds) {
  const activeUids = [...(await listActiveUserIds())];
  const results = await Promise.all(activeUids.map(async (uid) => {
    const answers = await getMyTriviaAnswers(gameweekId, uid, questionIds);
    return { uid, answeredCount: Object.keys(answers).length, total: questionIds.length };
  }));
  return results;
}

// ══════════════════════════════════════════════════════════════════
// ZARURILE — 5 întrebări numerice, fiecare cu propria secvență de zar
// (aruncă, alege mai dau/mă opresc, oricând). Scor per întrebare:
// 30 − 5×distanță față de ținta reală (introdusă de Admin după etapă),
// clamped la 0, BUST (a depășit ținta) = 0. Max 150p bază (5×30) +
// Duel (compară suma celor 5): câștigător +50p, egalitate +25p fiecare,
// pierdere +0p. Bye = bază+25p. Total maxim 200p.
// ══════════════════════════════════════════════════════════════════

// ── Admin — configurează cele 5 întrebări. { id, text, correctTarget:
// null|number }. correctTarget pornește null, Admin îl introduce separat,
// după ce evenimentele s-au produs. ──
export async function configureZaruriQuestions(gameweekId, questions) {
  await setDoc(doc(db, "weeklySurprises", gameweekId, "secret", "main"), {
    config: { questions },
  }, { merge: true });
}

export async function markZaruriTarget(gameweekId, questionId, correctTarget) {
  const secretRef = doc(db, "weeklySurprises", gameweekId, "secret", "main");
  const snap = await getDoc(secretRef);
  if (!snap.exists()) throw new Error("Zarurile nu sunt configurate încă pentru etapa asta.");
  const questions = (snap.data().config?.questions || []).map((q) =>
    q.id === questionId ? { ...q, correctTarget } : q
  );
  await setDoc(secretRef, { config: { ...snap.data().config, questions } }, { merge: true });
}

// ── User — starea curentă la o întrebare: toate aruncările + dacă s-a
// oprit. Owner-only, per regula Firestore. ──
export async function getMyDiceState(gameweekId, uid, questionId) {
  const rollsSnap = await getDocs(query(
    collection(db, "weeklySurprises", gameweekId, "diceRolls"),
    where("uid", "==", uid),
  ));
  const rolls = rollsSnap.docs
    .map((d) => d.data())
    .filter((r) => r.questionId === questionId)
    .sort((a, b) => a.rollNumber - b.rollNumber);
  const stopSnap = await getDoc(doc(db, "weeklySurprises", gameweekId, "diceStops", `${questionId}_${uid}`));
  return {
    rolls,
    total: rolls.reduce((sum, r) => sum + r.value, 0),
    stopped: stopSnap.exists(),
  };
}

// ── User — aruncă zarul o dată în plus, pentru o întrebare. Determină
// automat numărul următoarei aruncări (nu se poate arunca după STOP —
// verificat client-side, nu la nivel de regulă, aceeași limitare onestă
// ca la Ruletă). ──
export async function rollDice(gameweekId, uid, questionId) {
  const state = await getMyDiceState(gameweekId, uid, questionId);
  const nextRollNumber = state.rolls.length + 1;
  const value = Math.floor(Math.random() * 6) + 1;
  await setDoc(doc(db, "weeklySurprises", gameweekId, "diceRolls", `${questionId}_${uid}_${nextRollNumber}`), {
    uid, questionId, rollNumber: nextRollNumber, value, createdAt: serverTimestamp(),
  });
  return { value, total: state.total + value, rollNumber: nextRollNumber };
}

export async function stopRolling(gameweekId, uid, questionId) {
  await setDoc(doc(db, "weeklySurprises", gameweekId, "diceStops", `${questionId}_${uid}`), {
    uid, questionId, stoppedAt: serverTimestamp(),
  });
}

// ── Admin — status de completare per user (câte din 5 întrebări au un
// STOP înregistrat), ca la Trivia. ──
export async function getZaruriSubmissionStatus(gameweekId, questionIds) {
  const activeUids = [...(await listActiveUserIds())];
  const results = await Promise.all(activeUids.map(async (uid) => {
    const stops = await Promise.all(questionIds.map((qid) =>
      getDoc(doc(db, "weeklySurprises", gameweekId, "diceStops", `${qid}_${uid}`))
    ));
    return { uid, answeredCount: stops.filter((s) => s.exists()).length, total: questionIds.length };
  }));
  return results;
}

export async function listSeasonSurprises(seasonId) {
  const gameweeks = await listGameweeks(seasonId);
  const rows = await Promise.all(gameweeks.map(async (gw) => {
    const pub = await getWeeklySurprise(gw.id);
    return { gameweek: gw, public: pub, status: getSurpriseStatus(pub) };
  }));
  return rows.sort((a, b) => (a.gameweek.number || 0) - (b.gameweek.number || 0));
}
