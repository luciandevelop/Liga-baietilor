import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, runTransaction, serverTimestamp,
  query, where, orderBy, limit as fbLimit,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  detectRankChangeEvents, aggregateRankStory, buildMatchFinalEvent, buildJokerEvent,
  buildUpcomingMatchEvent, buildLiveMatchEvent, buildExternalLiveEvent, attachBanter, mergeFeedEvents, TYPE,
  buildCityFactEvent, buildSurpriseCreatedEvent, buildSurpriseMatchupEvent,
  buildSurpriseProgressEvent, buildSurpriseResultEvent, buildSurpriseRewardEvent, pick,
  buildLineupEvent, buildH2HFact, buildFormFact, buildInjuryEvent, buildApiPredictionEvent,
} from "./feedEngine";
import { canRevealPredictions } from "./matchLockRule";
// Logică pură, PARTAJATĂ cu api/football-sync.js (sursă unică de
// adevăr pentru semantica de scor — "deschide/egalează/preia/mărește"
// trebuie să fie IDENTICĂ pe server și pe client, nu recalculată diferit).
import { classifyScoreChange } from "../../api/_lib/footballLogic";
import {
  buildPredictionDistributionFact, buildSurpriseFact, buildTopExactScorerFact, buildStandingsGapFact,
  buildBiggestMoveOfGameweekFact,
} from "./feedFactsEngine";
import {
  emptyStageMemory, updateStageMemoryWithRanking, updateStageMemoryWithMatchScoring,
  detectLeaderStory, detectPodiumStory, detectBottomStory, detectMomentumAndStreaks, detectRivalry,
  detectConsensusStory, applyEditorialBudget, buildRecap, buildMatchPreviewCard,
} from "./feedStoryEngine";
import { listGeneralLeaderboard, listAllUsers, listActiveUserIds } from "./adminService";
import { getAllSurpriseResults } from "./surprisesService";
import { getUserPublicProfiles } from "./profilesService";
import { EDITORIAL_ARTICLES } from "../feedContent/editorialContent";
import { FUN_ITEMS } from "../feedContent/funContent";
import { CLUB_ALIASES } from "../assets/clubs/index.js";
import { slugify } from "../utils/slugify";

const RANK_SNAPSHOT_DOC = doc(db, "feedState", "rankSnapshot");
const RECENT_BANTER_DOC = doc(db, "feedState", "recentBanter");
const RECENT_VARIANTS_DOC = doc(db, "feedState", "recentVariants");
const UPCOMING_WINDOW_MS = 7 * 24 * 3600 * 1000;
const MAX_RECENT_BANTER = 12; // cooldown — nu repeta o glumă folosită în ultimele N
const MAX_RECENT_VARIANTS_PER_SUBTYPE = 3; // anti-repetiție — nu repeta ULTIMELE N variante ale aceluiași subtip

export async function saveFeedEvents(events) {
  await Promise.all(events.map((e) => setDoc(doc(db, "feedEvents", e.id), { ...e }, { merge: true })));
}

export async function listLiveFeedEvents({ max = 150 } = {}) {
  const snap = await getDocs(query(collection(db, "feedEvents"), orderBy("ts", "desc"), fbLimit(max)));
  return snap.docs.map((d) => d.data());
}

export async function deleteAllLiveMatchEvents() {
  const snap = await getDocs(collection(db, "feedEvents"));
  const staleIds = snap.docs.map((d) => d.id).filter((id) => id.startsWith("liveevent_"));
  await Promise.all(staleIds.map((id) => deleteDoc(doc(db, "feedEvents", id))));
  return staleIds.length;
}

// ── Banter cu cooldown — persistat (nu doar per-sesiune), ca doi useri
// diferiți să nu vadă aceeași glumă repetată des. Ține ultimele N chei
// folosite; verifică ÎNAINTE de a atașa, actualizează DUPĂ. ──
async function getRecentBanterKeys() {
  const snap = await getDoc(RECENT_BANTER_DOC);
  return new Set(snap.exists() ? snap.data().keys || [] : []);
}
async function markBanterUsed(key, recentSet) {
  const next = [key, ...[...recentSet].filter((k) => k !== key)].slice(0, MAX_RECENT_BANTER);
  await setDoc(RECENT_BANTER_DOC, { keys: next, updatedAt: serverTimestamp() });
}

// ── Anti-repetiție DETERMINISTĂ — persistată, per subtip. Întoarce
// { [subtype]: Set<index> } — ultimele MAX_RECENT_VARIANTS_PER_SUBTYPE
// indexuri folosite pentru fiecare subtip frecvent, ca pickAvoiding
// (feedEngine.js) să le evite. ──
async function getRecentVariantsMap() {
  const snap = await getDoc(RECENT_VARIANTS_DOC);
  const raw = snap.exists() ? snap.data().bySubtype || {} : {};
  const out = {};
  Object.entries(raw).forEach(([subtype, arr]) => { out[subtype] = new Set(arr); });
  return out;
}
async function markVariantUsed(subtype, index, currentMap) {
  if (index == null) return currentMap;
  const existing = currentMap[subtype] ? [...currentMap[subtype]] : [];
  const next = [index, ...existing.filter((i) => i !== index)].slice(0, MAX_RECENT_VARIANTS_PER_SUBTYPE);
  const snap = await getDoc(RECENT_VARIANTS_DOC);
  const raw = snap.exists() ? snap.data().bySubtype || {} : {};
  raw[subtype] = next;
  await setDoc(RECENT_VARIANTS_DOC, { bySubtype: raw, updatedAt: serverTimestamp() });
  currentMap[subtype] = new Set(next);
  return currentMap;
}

// ── Schimbări de clasament GENERAL — cu agregare (nu 10 carduri, 1-2
// povești). ──
export async function processRankChanges() {
  const rowsRaw = await listGeneralLeaderboard();
  const rows = rowsRaw.map((r, i) => ({ ...r, rank: i + 1 }));

  const events = await runTransaction(db, async (tx) => {
    const snap = await tx.get(RANK_SNAPSHOT_DOC);
    const prevState = snap.exists() ? snap.data().ranks : null;

    const raw = detectRankChangeEvents(prevState, rows);
    const detected = aggregateRankStory(raw);

    const nextState = {};
    rows.forEach((r) => { nextState[r.uid] = { rank: r.rank, points: r.seasonPoints || 0 }; });
    tx.set(RANK_SNAPSHOT_DOC, { ranks: nextState, updatedAt: serverTimestamp() });

    detected.forEach((e) => tx.set(doc(db, "feedEvents", e.id), e, { merge: true }));
    return detected;
  });

  return { events };
}

// ── ROOT CAUSE confirmat — funcția era deja corectă dar NU era apelată
// de nicăieri (verificat cu grep pe tot src/, cod mort). Conectată acum
// din WelcomeScreen.jsx, în listener-ul care oricum se declanșează după
// fiecare republicare de gameweekLiveScores. Extinsă aici cu agregare +
// facts + captura snapshot-ului de ÎNCEPUT de etapă (necesar pentru
// "cea mai mare urcare/cădere de la începutul etapei"). ──
export async function processLiveRankChanges(gameweekId) {
  if (!gameweekId) return { events: [], observability: null };
  const snap = await getDocs(query(collection(db, "gameweekLiveScores"), where("gameweekId", "==", gameweekId)));
  if (snap.empty) return { events: [], observability: null };

  const activeUids = await listActiveUserIds();
  const rawRows = snap.docs.map((d) => d.data()).filter((r) => activeUids.has(r.userId));
  if (rawRows.length === 0) return { events: [], observability: null };

  const sorted = [...rawRows].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
  const profiles = await getUserPublicProfiles(sorted.map((r) => r.userId));
  const rows = sorted.map((r, i) => ({
    uid: r.userId, rank: typeof r.rank === "number" ? r.rank : i + 1,
    nickname: profiles[r.userId]?.nickname || r.userId, seasonPoints: r.totalPoints,
  }));

  const snapshotRef = doc(db, "feedState", `rankSnapshotEtapa_${gameweekId}`);
  const gwStartRef = doc(db, "feedState", `gwStartRanks_${gameweekId}`);
  const stageMemRef = doc(db, "feedState", `stageMemory_${gameweekId}`);
  const recentVariants = await getRecentVariantsMap();

  const { events: baseEvents, prevState, gwStartRanks, stageMem, oldMem } = await runTransaction(db, async (tx) => {
    const prevSnap = await tx.get(snapshotRef);
    const prevState = prevSnap.exists() ? prevSnap.data().ranks : null;
    const gwStartSnap = await tx.get(gwStartRef);
    const stageMemSnap = await tx.get(stageMemRef);
    const mem = stageMemSnap.exists() ? stageMemSnap.data() : emptyStageMemory(gameweekId);

    const raw = detectRankChangeEvents(prevState, rows, { idPrefix: `rank_etapa_${gameweekId}`, scopeLabel: " etapei", recentVariants });
    const detected = aggregateRankStory(raw);

    const nextState = {};
    rows.forEach((r) => { nextState[r.uid] = { rank: r.rank, points: r.seasonPoints || 0 }; });
    tx.set(snapshotRef, { ranks: nextState, gameweekId, updatedAt: serverTimestamp() });
    if (!gwStartSnap.exists()) tx.set(gwStartRef, { ranks: nextState, gameweekId, capturedAt: serverTimestamp() });

    // IDEMPOTENȚĂ — memoria etapei (matchesProcessed, istoricul de
    // lider) se actualizează DOAR dacă s-a schimbat ceva cu adevărat
    // (raw.length>0) sau e prima procesare vreodată. O reprocesare a
    // EXACT aceleiași stări nu trebuie să incrementeze contorul — altfel
    // ID-urile poveștilor bazate pe matchesProcessed (leader_count etc.)
    // s-ar schimba la fiecare reluare, rupând deduplicarea.
    const somethingChanged = raw.length > 0 || !prevState;
    const nextMem = somethingChanged ? updateStageMemoryWithRanking(mem, rows) : mem;
    if (somethingChanged) tx.set(stageMemRef, nextMem, { merge: false });

    detected.forEach((e) => tx.set(doc(db, "feedEvents", e.id), e, { merge: true }));
    return { events: detected, prevState, gwStartRanks: gwStartSnap.exists() ? gwStartSnap.data().ranks : nextState, stageMem: nextMem, oldMem: mem };
  });

  // Poveștile din Story Engine — scrise separat (nu au nevoie de
  // aceeași tranzacție, sunt derivate, nu autoritate primară).
  //
  // BUG REPARAT: leader/podium/bottom "tocmai s-a schimbat" TREBUIE
  // comparate cu memoria DINAINTE de actualizare (oldMem) — dacă
  // foloseau memoria deja actualizată (stageMem), liderul curent era
  // deja înregistrat ca ultima intrare din istoric ÎNAINTE de
  // comparație, deci "tocmai a devenit lider" era mereu FALSE. Asta
  // explica de ce leader_return nu se declanșa niciodată. Momentum/
  // streak-urile rămân pe memoria NOUĂ (au nevoie de valorile proaspăt
  // actualizate — bestRank/worstRank/streak curent).
  const storyEvents = [
    ...detectLeaderStory(oldMem, rows, oldMem.lastDetachGapReported || 0),
    ...detectPodiumStory(oldMem, rows),
    ...detectBottomStory(oldMem, rows),
    ...detectMomentumAndStreaks(stageMem, rows),
    ...detectRivalry(stageMem),
  ];

  // Dacă "se desprinde" tocmai s-a spus, ținem minte avansul raportat,
  // ca reprocesările următoare să compare împotriva ACESTEI valori
  // (nu 0) — altfel pragul de creștere semnificativă e mereu îndeplinit
  // și povestea tot se repetă la fiecare meci, exact bug-ul semnalat.
  const detachEvent = storyEvents.find((e) => e.subtype === "leader_detach");
  if (detachEvent) {
    const stageMemRef2 = doc(db, "feedState", `stageMemory_${gameweekId}`);
    await setDoc(stageMemRef2, { lastDetachGapReported: detachEvent.metadata.gap }, { merge: true }).catch(() => {});
  }

  // Când Story Engine produce leader_return PENTRU ACEEAȘI persoană ÎN
  // ACEEAȘI reprocesare, cardul de bază "new_leader" (generic) devine
  // redundant — "revine pe primul loc" spune povestea mai bine.
  // Filtrare LOCALĂ, doar în acest apel (nu prin storyKey global, care
  // ar coliza greșit momente diferite ale ACELUIAȘI utilizator).
  const returningUids = new Set(storyEvents.filter((e) => e.subtype === "leader_return").flatMap((e) => e.actors));
  const baseEventsFiltered = baseEvents.filter((e) => !(e.subtype === "new_leader" && returningUids.has(e.actors[0])));

  // Marchează variantele efectiv folosite (anti-repetiție viitoare).
  for (const e of baseEventsFiltered) {
    if (e.variantIndex != null) await markVariantUsed(e.subtype, e.variantIndex, recentVariants);
  }

  const factEvents = [];
  try {
    const gapFact = buildStandingsGapFact(gameweekId, rows);
    if (gapFact) factEvents.push(gapFact);
    const moveFact = buildBiggestMoveOfGameweekFact(gameweekId, gwStartRanks, rows);
    if (moveFact) factEvents.push(moveFact);
  } catch (err) {
    console.error("Eroare la facts de clasament:", err);
  }

  const { events: budgeted, observability } = applyEditorialBudget([...baseEventsFiltered, ...storyEvents, ...factEvents]);
  const newOnes = budgeted.filter((e) => !baseEvents.some((b) => b.id === e.id)); // baseEvents deja scrise în tranzacție
  if (newOnes.length > 0) await saveFeedEvents(newOnes);

  return { events: budgeted, observability };
}

async function getExactScorersUidsForMatch(matchId) {
  const snap = await getDocs(query(collection(db, "matchPoints"), where("matchId", "==", matchId)));
  return snap.docs.map((d) => d.data()).filter((p) => p.scorePoints === 120).map((p) => p.uid);
}
async function getExactScorersForMatch(matchId) {
  const exactUids = await getExactScorersUidsForMatch(matchId);
  if (exactUids.length === 0) return [];
  const profiles = await getUserPublicProfiles(exactUids);
  return exactUids.map((uid) => profiles[uid]?.nickname || uid);
}

// ── Meciuri terminate — AGREGAT într-un singur card (meci final + scor
// exact), PLUS facts derivate (distribuția predicțiilor, "nimeni n-a
// nimerit"), PLUS banter atașat dacă subtipul se pretează, cu cooldown
// persistat. ──
export async function processFinishedMatches(matches, allGwMatches) {
  const recentBanter = await getRecentBanterKeys();
  const recentVariants = await getRecentVariantsMap();
  const usedThisRun = [];

  const events = [];
  for (const m of matches) {
    const exactScorers = await getExactScorersForMatch(m.id).catch(() => []);
    let ev = buildMatchFinalEvent(m, exactScorers, recentVariants);
    if (!ev) continue;
    if (ev.exactScoreVariantIndex != null) await markVariantUsed("exact_score_single", ev.exactScoreVariantIndex, recentVariants);
    if (exactScorers.length >= 4) {
      ev = attachBanter(ev, recentBanter);
      if (ev.banterKey) usedThisRun.push(ev.banterKey);
    }
    events.push(ev);

    try {
      const [predSnap, mpSnap] = await Promise.all([
        getDocs(query(collection(db, "predictions"), where("matchId", "==", m.id))),
        getDocs(query(collection(db, "matchPoints"), where("matchId", "==", m.id))),
      ]);
      const preds = predSnap.docs.map((d) => d.data());
      const mpRows = mpSnap.docs.map((d) => d.data());
      const exactUids = mpRows.filter((p) => p.scorePoints === 120).map((p) => p.uid);
      const zeroUids = mpRows.filter((p) => p.scorePoints === 0).map((p) => p.uid);

      if (preds.length > 0) {
        const uids = preds.map((p) => p.userId);
        const profiles = await getUserPublicProfiles(uids);
        const predsWithNames = preds.map((p) => ({ ...p, nickname: profiles[p.userId]?.nickname || p.userId }));
        const distFact = buildPredictionDistributionFact(m, predsWithNames);
        if (distFact) events.push(distFact);
        const surpriseFact = buildSurpriseFact(m, preds, exactScorers.length);
        if (surpriseFact) events.push(surpriseFact);
        const consensusEvs = detectConsensusStory(m, predsWithNames, recentVariants);
        for (const ce of consensusEvs) { if (ce.variantIndex != null) await markVariantUsed(ce.subtype, ce.variantIndex, recentVariants); }
        events.push(...consensusEvs);
      }

      // Streak-uri de scor exact/zero — actualizare IDEMPOTENTĂ (guard
      // pe matchId, ca reprocesarea aceluiași meci să nu incrementeze
      // streak-ul de două ori).
      if (exactUids.length > 0 || zeroUids.length > 0) {
        const stageMemRef = doc(db, "feedState", `stageMemory_${m.gameweekId}`);
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(stageMemRef);
          const mem = snap.exists() ? snap.data() : emptyStageMemory(m.gameweekId);
          const processedMatchIds = mem.processedMatchIdsForScoring || [];
          if (processedMatchIds.includes(m.id)) return; // deja procesat — no-op
          const nextMem = updateStageMemoryWithMatchScoring(mem, exactUids, zeroUids);
          nextMem.processedMatchIdsForScoring = [...processedMatchIds, m.id];
          tx.set(stageMemRef, nextMem, { merge: false });
        });
      }
    } catch (err) {
      console.error("Eroare la facts/story de predicții pentru meci:", m.id, err);
    }
  }

  if (events.length > 0) {
    await saveFeedEvents(events);
    await Promise.all(matches.map((m) => deleteDoc(doc(db, "feedEvents", `upcoming_${m.id}`)).catch(() => {})));
  }
  if (usedThisRun.length > 0) {
    for (const key of usedThisRun) await markBanterUsed(key, recentBanter);
  }

  // RECAP — o singură dată per etapă, DOAR când toate meciurile etapei
  // sunt Final. Idempotent: verifică flag-ul din memoria etapei într-o
  // tranzacție, înainte de a genera.
  if (allGwMatches && allGwMatches.length > 0) {
    const allFinal = allGwMatches.every((m) => m.status === "finished" || m.status === "cancelled" || m.status === "postponed");
    if (allFinal) {
      const recapEvent = await maybeGenerateRecap(matches[0]?.gameweekId || allGwMatches[0].gameweekId);
      if (recapEvent) events.push(recapEvent);
    }
  }

  return events;
}

async function maybeGenerateRecap(gameweekId) {
  if (!gameweekId) return null;
  const stageMemRef = doc(db, "feedState", `stageMemory_${gameweekId}`);
  const shouldGenerate = await runTransaction(db, async (tx) => {
    const snap = await tx.get(stageMemRef);
    const mem = snap.exists() ? snap.data() : emptyStageMemory(gameweekId);
    if (mem.recapGenerated) return false;
    tx.set(stageMemRef, { ...mem, recapGenerated: true }, { merge: false });
    return true;
  });
  if (!shouldGenerate) return null;

  const memSnap = await getDoc(stageMemRef);
  const mem = memSnap.data();
  const finalRankSnap = await getDoc(doc(db, "feedState", `rankSnapshotEtapa_${gameweekId}`));
  if (!finalRankSnap.exists()) return null;
  const ranks = finalRankSnap.data().ranks;
  const profiles = await getUserPublicProfiles(Object.keys(ranks));
  const finalRows = Object.entries(ranks).map(([uid, r]) => ({ uid, nickname: profiles[uid]?.nickname || uid, seasonPoints: r.points, rank: r.rank })).sort((a, b) => a.rank - b.rank);
  const exactCounts = {};
  Object.entries(mem.byUid || {}).forEach(([uid, s]) => { if (s.exactCountTotal > 0) exactCounts[uid] = s.exactCountTotal; });

  const recap = buildRecap(gameweekId, mem, finalRows, exactCounts);
  await saveFeedEvents([recap]);
  return recap;
}

// ── MATCH PREVIEW — apelabilă separat, DOAR după ce predicțiile devin
// legal vizibile (lock), conform regulilor deja existente ale
// aplicației. Funcția însăși nu decide CÂND — primește predicțiile deja
// filtrate corect de apelant. ──
export async function processMatchPreview(match) {
  const predSnap = await getDocs(query(collection(db, "predictions"), where("matchId", "==", match.id)));
  const preds = predSnap.docs.map((d) => d.data());
  if (preds.length === 0) return null;
  const profiles = await getUserPublicProfiles(preds.map((p) => p.userId));
  const predsWithNames = preds.map((p) => ({ ...p, nickname: profiles[p.userId]?.nickname || p.userId }));
  const preview = buildMatchPreviewCard(match, predsWithNames);
  if (preview) await saveFeedEvents([preview]);
  return preview;
}

// ── HEALTH CHECK — Admin, diagnostic simplu, la cerere (nu polling
// permanent). ──
export async function getFeedHealthCheck() {
  try {
    const [feedSnap, stateSnap] = await Promise.all([
      getDocs(query(collection(db, "feedEvents"), orderBy("ts", "desc"), fbLimit(1))),
      getDoc(RECENT_BANTER_DOC),
    ]);
    const lastEvent = feedSnap.docs[0]?.data();
    return {
      firestoreReachable: true,
      lastEventId: lastEvent?.id || null,
      lastEventTs: lastEvent?.ts || null,
      feedStateReachable: true,
      recentBanterCount: stateSnap.exists() ? (stateSnap.data().keys || []).length : 0,
      lastError: null,
    };
  } catch (err) {
    return { firestoreReachable: false, lastError: err.message || String(err) };
  }
}

export async function processLiveMatchEvent(match, event) {
  const feedEvent = buildLiveMatchEvent(match, event);
  if (feedEvent) await saveFeedEvents([feedEvent]);
  return feedEvent;
}

export async function processJokerActivation(joker, match, nickname) {
  const event = buildJokerEvent(joker, match, nickname);
  if (event) await saveFeedEvents([event]);
  return event;
}

function resolveTeamId(rawName) {
  const slug = slugify(rawName);
  const aliased = CLUB_ALIASES[slug];
  return aliased ? slugify(aliased) : slug;
}
function hashSeedLocal(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}
function pickRotating(arr, count, seed) {
  if (arr.length <= count) return arr;
  const start = seed % arr.length;
  const result = [];
  for (let i = 0; i < count; i++) result.push(arr[(start + i) % arr.length]);
  return result;
}
function getEditorialSnippetsForMatch(match) {
  const homeId = resolveTeamId(match.homeTeam);
  const awayId = resolveTeamId(match.awayTeam);
  const forTeam = (teamId) => {
    const all = EDITORIAL_ARTICLES.filter((a) => a.teamId === teamId);
    const football = all.filter((a) => a.title !== "Despre oraș");
    const city = all.filter((a) => a.title === "Despre oraș");
    const seed = hashSeedLocal(match.id + teamId);
    return [...pickRotating(football, 2, seed), ...pickRotating(city, 2, seed)];
  };
  return [...forTeam(homeId), ...forTeam(awayId)];
}

export async function processUpcomingMatches(matches, featuredMatchIds = [], gameweekId = null) {
  const now = Date.now();
  const upcoming = matches.filter((m) => {
    if (m.status !== "scheduled") return false;
    const kickoffMs = m.kickoffAt?.toMillis ? m.kickoffAt.toMillis() : null;
    return kickoffMs && kickoffMs > now && kickoffMs - now < UPCOMING_WINDOW_MS;
  });

  const events = upcoming.map((m) => {
    const snippets = getEditorialSnippetsForMatch(m);
    return buildUpcomingMatchEvent(m, snippets, featuredMatchIds.includes(m.id));
  });

  // ── Fapt de oraș — card propriu, DOAR pentru echipe cu fapt de oraș
  // disponibil, DEDUPLICAT pe etapă (dacă "Despre oraș" al lui Real
  // Madrid a apărut deja, nu se repetă chiar dacă Real Madrid mai
  // joacă o dată în aceeași etapă). Fără persistare, dacă gameweekId
  // lipsește (apelant vechi/test) — degradează elegant, nu crapă. ──
  const cityEvents = [];
  if (gameweekId) {
    const usedRef = doc(db, "feedState", `usedCityFacts_${gameweekId}`);
    const usedSnap = await getDoc(usedRef);
    const used = new Set(usedSnap.exists() ? usedSnap.data().ids || [] : []);
    for (const m of upcoming) {
      const homeId = resolveTeamId(m.homeTeam), awayId = resolveTeamId(m.awayTeam);
      const candidates = EDITORIAL_ARTICLES.filter((a) => a.title === "Despre oraș" && (a.teamId === homeId || a.teamId === awayId) && !used.has(a.id));
      if (candidates.length === 0) continue;
      const chosen = candidates[hashSeedLocal(m.id) % candidates.length];
      used.add(chosen.id);
      cityEvents.push(buildCityFactEvent(m, chosen));
    }
    if (cityEvents.length > 0) await setDoc(usedRef, { ids: [...used] });
  }

  const allEvents = [...events, ...cityEvents];
  if (allEvents.length > 0) await saveFeedEvents(allEvents);
  return allEvents;
}

// ══════════════════════════════════════════════════════════════════
// SURPRIZE ÎN FEED — generic, extensibil la orice mod existent/viitor.
// CREATED nu are nevoie de nicio citire nouă (reutilizează exact
// pub/sm/sb deja încărcate pentru teaser-ul din Home). MATCHUP e
// construit DOAR pentru tipurile cu perechi (Duel*) — celelalte moduri
// (individuale: Trivia/Zaruri/Ruletă/Sabotaj) nu au un "matchup" de
// descris, rămân doar cu evenimentul CREATED.
// ══════════════════════════════════════════════════════════════════
export async function processSurpriseCreated(gameweekId, kind, type, label) {
  if (!type) return null;
  const ev = buildSurpriseCreatedEvent(gameweekId, kind, type, label);
  await saveFeedEvents([ev]);
  return ev;
}

const PAIRING_MODES = new Set(["duel-random", "duel-extreme", "duel-rivali", "team-duel-random"]);

export async function processSurpriseMatchup(gameweekId, kind, type, config) {
  if (!PAIRING_MODES.has(type) || !config?.pairings) return null;
  const uidsInvolved = config.pairings.flatMap((p) =>
    p.playerA ? [p.playerA, p.playerB] : (p.teamA || []).concat(p.teamB || [])
  );
  if (uidsInvolved.length === 0) return null;
  const profiles = await getUserPublicProfiles(uidsInvolved);
  const nameOf = (uid) => profiles[uid]?.nickname || uid;

  const descriptions = config.pairings.map((p) => {
    if (p.teamA && p.teamB) {
      return `${p.teamA.map(nameOf).join(" & ")} vs ${p.teamB.map(nameOf).join(" & ")}`;
    }
    return `${nameOf(p.playerA)} vs ${nameOf(p.playerB)}`;
  });
  const main = descriptions[0];
  const extra = descriptions.length > 1 ? ` (+${descriptions.length - 1} ${descriptions.length - 1 === 1 ? "duel" : "dueluri"})` : "";
  const ev = buildSurpriseMatchupEvent(gameweekId, kind, type, `⚔️ Duelul etapei e gata: ${main}${extra}.`);
  await saveFeedEvents([ev]);
  return ev;
}

// ── RESULT — o singură dată per surpriză rezolvată (id stabil pe
// gameweekId+kind, deci idempotent la reapelare/refresh). Citirea
// tuturor rezultatelor e SIGURĂ ca query larg — regula Firestore
// pentru results/{uid} verifică mainResolved/bonusResolved pe
// documentul PĂRINTE (aceeași condiție pentru toate documentele din
// colecție), nu un tipar de id per-document — deci nu are problema de
// "query refuzat" găsită la jokers/specialPicks. ──
// ── Mystery Box — un eveniment per cutie DESCHISĂ (aleasă), niciodată
// pentru cutiile încă nealese. Apelat chiar de clientul care tocmai a
// ales (submitMysteryBoxPick), cu propriul nickname — fiecare user
// publică DOAR propria alegere, nu pe ale altora. ID stabil pe
// gameweekId+boxIndex, deci idempotent la orice reîncercare. ──
// ══════════════════════════════════════════════════════════════════
// EXTERNAL LIVE — citește delta-ul deja calculat SERVER-SIDE (funcția
// Vercel api/football-sync.js scrie în externalFootballCache/{fixtureId}
// exact ce-i NOU la fiecare sincronizare). Clientul NU reface delta
// detection — doar transformă noutățile în povești Feed, refolosind
// EXACT Story Engine-ul existent (niciun motor nou). ID-uri complet
// deterministe (din buildExternalLiveEvent) — de-i citește 1 user sau
// 16, simultan, rezultatul-i identic, fără duplicate.
//
// Corelare cu date proprii (predicții/scoruri exacte) — DOAR dacă
// meciul e deja blocat (dublă verificare: aici ȘI în interiorul
// buildExternalLiveEvent, defense in depth, ca la restul faptelor).
// ══════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════
// MATCH INTELLIGENCE — citește cache-ul (lineup/H2H/form/predicții
// API/accidentări), publică STRICT ce merită (max câteva per meci —
// "aceste date sunt RAW MATERIAL, nu fiecare informație devine
// automat card", cerut explicit). Fiecare funcție de construcție
// (buildH2HFact etc.) DEJA întoarce null dacă datele nu susțin o
// afirmație clară — aici doar le colectăm și publicăm o dată, idempotent
// (ID-uri deterministe pe matchId, deci fără duplicate la reprocesare).
// ══════════════════════════════════════════════════════════════════
export async function processMatchIntelligence(match, cacheDoc) {
  if (!cacheDoc) return [];

  // BUG REPARAT: fiecare informație disponibilă (lineup/H2H/formă/
  // predicție) se publica necondiționat — un meci cu toate datele
  // disponibile producea 4 carduri deodată, exact "log tehnic" nu
  // "editorial" semnalat explicit. Acum construim TOATE candidatele,
  // apoi alegem STRICT primele 3, în ordinea de prioritate cerută:
  // lineup > H2H > formă > predicție API. Injuries rămân separat
  // (compact, nu intră în acest cap — deja tratate ca prioritate cea
  // mai joasă la nivel de buget, nu doar editorial).
  const MAX_INTELLIGENCE_STORIES = 3;
  const candidates = [];

  if (cacheDoc.lineup) {
    const ev = buildLineupEvent(match, cacheDoc.lineup);
    if (ev) candidates.push(ev);
  }
  if (cacheDoc.h2h) {
    const ev = buildH2HFact(match, cacheDoc.h2h);
    if (ev) candidates.push(ev);
  }
  if (cacheDoc.form?.home && cacheDoc.form?.away) {
    const ev = buildFormFact(match, cacheDoc.form.home, cacheDoc.form.away);
    if (ev) candidates.push(ev);
  }
  if (cacheDoc.apiPrediction) {
    let ourConsensus = null;
    if (canRevealPredictions(match)) {
      try {
        const predsSnap = await getDocs(query(collection(db, "predictions"), where("matchId", "==", match.id)));
        const rows = predsSnap.docs.map((d) => d.data());
        ourConsensus = { homeCount: rows.filter((p) => p.scoreA > p.scoreB).length, awayCount: rows.filter((p) => p.scoreA < p.scoreB).length };
      } catch { ourConsensus = null; }
    }
    const ev = buildApiPredictionEvent(match, cacheDoc.apiPrediction, ourConsensus);
    if (ev) candidates.push(ev);
  }

  // `candidates` e deja în ordinea de prioritate cerută (push-uite în
  // ordinea lineup→h2h→form→prediction) — tăiem doar la coadă, nu
  // re-sortăm (lineup rămâne mereu primul dacă există).
  const events = candidates.slice(0, MAX_INTELLIGENCE_STORIES);

  // Injuries — SEPARAT de cap-ul editorial (deja e prioritatea cea mai
  // joasă la buget; dacă a ajuns să existe în cache, tot merită
  // spusă, dar nu concurează cu lineup/H2H/formă/predicție pentru cele
  // 3 sloturi).
  if (cacheDoc.injuries?.length > 0) {
    const ev = buildInjuryEvent(match, cacheDoc.injuries);
    if (ev) events.push(ev);
  }

  if (events.length > 0) await saveFeedEvents(events);
  return events;
}

export async function processExternalMatchDelta(match, cacheDoc) {
  if (!cacheDoc) return [];
  const events = [];
  const snapshot = { fixtureId: cacheDoc.fixtureId, status: cacheDoc.status, minute: cacheDoc.minute, homeScore: cacheDoc.homeScore, awayScore: cacheDoc.awayScore };

  // Corelare internă — doar dacă privacy permite, calculat O SINGURĂ
  // dată aici (nu la fiecare tip de eveniment).
  let internal = null;
  if (canRevealPredictions(match)) {
    try {
      const mpSnap = await getDocs(query(collection(db, "matchPoints"), where("matchId", "==", match.id)));
      const mpRows = mpSnap.docs.map((d) => d.data());
      internal = { exactCount: mpRows.filter((p) => p.scorePoints === 120).length, jokerCount: 0 };
    } catch { internal = null; }
  }

  if (cacheDoc.lastStatusChange?.to === "1H" && cacheDoc.lastStatusChange?.from !== "1H") {
    const ev = buildExternalLiveEvent("MATCH_STARTED", match, snapshot, {}, internal);
    if (ev) events.push(ev);
  }
  if (cacheDoc.lastStatusChange?.to === "HT") {
    const ev = buildExternalLiveEvent("HALFTIME", match, snapshot, {}, internal);
    if (ev) events.push(ev);
  }
  if (cacheDoc.lastStatusChange?.to === "FT") {
    // INFORMATIV — NU acordă puncte, NU înlocuiește Admin Final.
    const ev = buildExternalLiveEvent("FULLTIME", match, snapshot, {}, internal);
    if (ev) events.push(ev);
  }
  for (const rawEvent of cacheDoc.lastDeltaEvents || []) {
    if (rawEvent.type === "GOAL" || rawEvent.type === "OWN_GOAL" || rawEvent.type === "PENALTY_GOAL") {
      const before = cacheDoc.lastScoreChange?.before || { home: 0, away: 0 };
      const after = cacheDoc.lastScoreChange?.after || snapshot;
      const semantic = classifyScoreChange(before, after);
      const ev = buildExternalLiveEvent("GOAL", match, snapshot,
        { eventId: rawEvent.id, before, after, team: rawEvent.team, player: rawEvent.player, minute: rawEvent.minute, semantic }, internal);
      if (ev) events.push(ev);
    } else if (rawEvent.type === "RED_CARD") {
      const ev = buildExternalLiveEvent("RED_CARD", match, snapshot, { eventId: rawEvent.id, team: rawEvent.team, player: rawEvent.player, minute: rawEvent.minute }, internal);
      if (ev) events.push(ev);
    } else if (rawEvent.type === "MISSED_PENALTY") {
      const ev = buildExternalLiveEvent("MISSED_PENALTY", match, snapshot, { eventId: rawEvent.id, team: rawEvent.team, player: rawEvent.player, minute: rawEvent.minute }, internal);
      if (ev) events.push(ev);
    }
  }

  if (events.length > 0) await saveFeedEvents(events);
  return events;
}

export async function processMysteryBoxOpened(gameweekId, boxIndex, boxValue, nickname, totalBoxes) {
  const id = `surprise_progress_${gameweekId}_bonus_box${boxIndex}`;
  const description = pick([
    `🎁 ${nickname} a deschis cutia #${boxIndex + 1}. 💰 Înăuntru: +${boxValue}p.`,
    `🎁 Cutia #${boxIndex + 1}, deschisă de ${nickname}: +${boxValue}p.`,
  ], id);
  const ev = buildSurpriseProgressEvent(gameweekId, "bonus", "mystery-box", `box${boxIndex}`, description);
  await saveFeedEvents([ev]);
  return ev;
}

export async function processSurpriseResult(gameweekId, kind, type, config, label) {
  const results = await getAllSurpriseResults(gameweekId);
  if (results.length === 0) return null;
  const pointsField = kind === "main" ? "mainPoints" : "bonusPoints";

  let description;
  if (config?.pairings && config.pairings.length > 0 && config.pairings[0].playerA) {
    // Tip cu perechi individuale (Duel Random/Extreme/Rivali) — găsim
    // perechea câștigătoare (suma cea mai mare).
    const byUid = Object.fromEntries(results.map((r) => [r.uid, r[pointsField] || 0]));
    const pairs = config.pairings.map((p) => ({ a: p.playerA, b: p.playerB, total: (byUid[p.playerA] || 0) + (byUid[p.playerB] || 0) }));
    const winner = pairs.sort((x, y) => y.total - x.total)[0];
    if (!winner) return null;
    const profiles = await getUserPublicProfiles([winner.a, winner.b]);
    const nameOf = (uid) => profiles[uid]?.nickname || uid;
    description = pick([
      `🏆 ${nameOf(winner.a)} & ${nameOf(winner.b)} câștigă ${label} cu ${winner.total}p.`,
      `🏆 Duelul e decis: ${nameOf(winner.a)} & ${nameOf(winner.b)} iau bonusul, cu ${winner.total}p.`,
    ], `surprise_result_${gameweekId}_${kind}`);
  } else if (config?.pairings && config.pairings[0]?.teamA) {
    // Duel de Echipe — perechi de grupuri.
    const byUid = Object.fromEntries(results.map((r) => [r.uid, r[pointsField] || 0]));
    const pairs = config.pairings.map((p) => ({
      teamA: p.teamA, teamB: p.teamB,
      totalA: (p.teamA || []).reduce((s, u) => s + (byUid[u] || 0), 0),
      totalB: (p.teamB || []).reduce((s, u) => s + (byUid[u] || 0), 0),
    }));
    const winner = pairs.sort((x, y) => Math.max(y.totalA, y.totalB) - Math.max(x.totalA, x.totalB))[0];
    if (!winner) return null;
    const winTeam = winner.totalA >= winner.totalB ? winner.teamA : winner.teamB;
    const winScore = Math.max(winner.totalA, winner.totalB);
    const profiles = await getUserPublicProfiles(winTeam);
    const names = winTeam.map((u) => profiles[u]?.nickname || u).join(" & ");
    description = pick([`🏆 ${names} câștigă ${label} cu ${winScore}p și iau bonusul.`], `surprise_result_${gameweekId}_${kind}`);
  } else {
    // Individual (Mystery Box, Ruletă, Trivia, Zaruri, Sabotaj) — cel
    // mai mare premiu individual.
    const top = [...results].sort((a, b) => (b[pointsField] || 0) - (a[pointsField] || 0))[0];
    if (!top || !top[pointsField]) return null;
    const profiles = await getUserPublicProfiles([top.uid]);
    const name = profiles[top.uid]?.nickname || top.uid;
    description = pick([
      `🏁 ${label} s-a încheiat. Cel mai mare premiu: ${name}, cu ${top[pointsField]}p.`,
      `🏁 S-a terminat ${label} — ${name} a avut cel mai mult noroc, +${top[pointsField]}p.`,
    ], `surprise_result_${gameweekId}_${kind}`);
  }

  const ev = buildSurpriseResultEvent(gameweekId, kind, type, description);
  await saveFeedEvents([ev]);
  return ev;
}

export async function listAdminFunItems() {
  const snap = await getDocs(collection(db, "feedFunItems"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function addFunItem({ label, text }) {
  const id = `custom-${Date.now()}`;
  await setDoc(doc(db, "feedFunItems", id), { label, text, createdAt: serverTimestamp() });
  return id;
}
export async function deleteFunItem(id) {
  await deleteDoc(doc(db, "feedFunItems", id));
}

export async function loadFullFeed() {
  const [live, users, adminFun] = await Promise.all([listLiveFeedEvents(), listAllUsers(), listAdminFunItems()]);

  // ── FUN filler — capat la câteva bucăți, NU tot poolul deodată.
  // Cu tot poolul inclus mereu, orice etapă mai liniștită se termina
  // cu un bloc lung, monoton, de proverbe/glume la coadă — exact
  // "carduri similare consecutive" semnalat. Eșantion mic, rotativ
  // determinist pe zi (stabil în aceeași zi, se schimbă a doua zi). ──
  const daySeed = new Date().toISOString().slice(0, 10);
  const allFun = [
    ...FUN_ITEMS.map((f) => ({ id: `fun_${f.id}`, label: f.label, text: f.text })),
    ...adminFun.map((f) => ({ id: `fun_${f.id}`, label: f.label, text: f.text })),
  ];
  const FUN_SAMPLE_SIZE = 3;
  const startIdx = hashSeedLocal(daySeed) % Math.max(allFun.length, 1);
  const sampledFun = allFun.length <= FUN_SAMPLE_SIZE ? allFun
    : Array.from({ length: FUN_SAMPLE_SIZE }, (_, i) => allFun[(startIdx + i) % allFun.length]);

  const fun = sampledFun.map((f) => ({
    id: f.id, type: TYPE.FACT, category: "fun", priority: 15, ts: Date.now(),
    icon: "fun", important: false, title: f.text, subtitle: f.label,
  }));

  return { merged: mergeFeedEvents(live, fun), users };
}

export async function listRecentEventsForAdmin({ max = 50 } = {}) {
  return listLiveFeedEvents({ max });
}

// ══════════════════════════════════════════════════════════════════
// ADMIN — "Regenerează Feed etapa curentă". DETERMINIST, IDEMPOTENT.
// Reconstruiește DOAR ce se poate ști cu certitudine din starea
// ACTUALĂ: meciuri Final + scor exact + facts. NU inventează istoricul
// de clasament (cine a fost lider ACUM 3 meciuri) — dacă nu există
// snapshot istoric real pentru fiecare pas intermediar, acea parte
// rămâne needeterminată și NU se generează. Documentat clar în
// rezultat, nu ascuns.
// ══════════════════════════════════════════════════════════════════
export async function regenerateCurrentGameweekFeed(gameweekId, allMatchesForGw) {
  const finished = allMatchesForGw.filter((m) => m.status === "finished" && m.realScoreA != null && m.realScoreB != null);
  const matchEvents = await processFinishedMatches(finished, allMatchesForGw);

  // Clasamentul etapei ACUM (starea curentă, nu istoricul pas-cu-pas) —
  // singurul lucru determinabil cu certitudine fără snapshot-uri
  // istorice complete pentru fiecare meci în parte.
  const { events: currentRankEvents } = await processLiveRankChanges(gameweekId).catch(() => ({ events: [] }));

  return {
    reconstructed: { matchFinalEvents: matchEvents.length, currentRankEvents: currentRankEvents.length },
    note: "Istoricul EXACT de clasament (cine era lider după fiecare meci în parte) NU a fost reconstruit — necesită snapshot-uri istorice per-meci pe care nu le avem retroactiv. Doar starea curentă a clasamentului etapei a fost comparată și inserată ca eveniment nou, dacă diferă de ultimul snapshot cunoscut.",
  };
}
