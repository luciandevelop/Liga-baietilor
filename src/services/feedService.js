import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, runTransaction, serverTimestamp,
  query, where, orderBy, limit as fbLimit,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  detectRankChangeEvents, aggregateRankStory, buildMatchFinalEvent, buildJokerEvent,
  buildUpcomingMatchEvent, buildLiveMatchEvent, attachBanter, mergeFeedEvents, TYPE,
} from "./feedEngine";
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
    ...detectLeaderStory(oldMem, rows),
    ...detectPodiumStory(oldMem, rows),
    ...detectBottomStory(oldMem, rows),
    ...detectMomentumAndStreaks(stageMem, rows),
    ...detectRivalry(stageMem),
  ];

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

export async function processUpcomingMatches(matches, featuredMatchIds = []) {
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

  if (events.length > 0) await saveFeedEvents(events);
  return events;
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

  const fun = [
    ...FUN_ITEMS.map((f) => ({ id: `fun_${f.id}`, label: f.label, text: f.text })),
    ...adminFun.map((f) => ({ id: `fun_${f.id}`, label: f.label, text: f.text })),
  ].map((f) => ({
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
