import {
  collection, deleteDoc, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, setDoc, Timestamp, where, writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { computeRedLight, buildMainScoresFromRows, lockAtFromKickoff, diffRedLight, checkShowScript, RED_LIGHT_TYPE_ID } from "./redLightEngine";
import { previewGameweekResults, listMatches } from "./adminService";
import { getUserPublicProfiles } from "./profilesService";
import { getSeasonNumbers } from "./seasonNumbersService";

// ══════════════════════════════════════════════════════════════════
// 🚦 LUMINĂ ROȘIE, LUMINĂ VERDE — date Firestore (ETAPA 2).
// Calculele rămân EXCLUSIV în redLightEngine.js; aici doar citire/scriere.
//
// redLight/{gameweekId}                    (citit de toți; CREAT o singură dată
//   published, participants[], order[],     de Admin; NU se mai poate modifica —
//   firstLockAt, publishedAt                se poate doar anula înainte de
//                                           prima blocare)
// redLight/{gw}/choices/{matchId}_{uid}    există = AVANSEZ; lipsă = STAU.
//   { uid, matchId, at }                    Creat/șters doar de jucător, doar
//                                           înainte de blocare (30 min), doar
//                                           cu pronostic salvat, doar neoprit.
//                                           Ascuns celorlalți până la blocare.
// redLight/{gw}/stops/{uid}                MĂ OPRESC — creat o singură dată,
//   { uid, at }                             ora serverului, fără modificare.
// redLight/{gw}/meta/state                 STAREA OFICIALĂ (ETAPA 3) — scrisă DOAR
//   rows, events (jurnalul pentru show),    de Admin, la fiecare validare/corectare,
//   resultsVersion, computedAtMs, …         monoton (un calcul vechi nu suprascrie
//                                           unul mai nou). Citită de toți.
// ══════════════════════════════════════════════════════════════════

export const redLightRef = (gw) => doc(db, "redLight", gw);
const choicesCol = (gw) => collection(db, "redLight", gw, "choices");
const stopsCol = (gw) => collection(db, "redLight", gw, "stops");

const ms = (t) => (t?.toMillis ? t.toMillis() : Number.isFinite(t) ? t : null);

export async function getRedLight(gameweekId) {
  const snap = await getDoc(redLightRef(gameweekId));
  return snap.exists() ? snap.data() : null;
}

// ── Ordinea implicită: cronologică după ora de start; la aceeași oră,
// ordinea stabilă după id (Adminul o poate schimba înainte de publicare). ──
export function defaultOrder(matches) {
  return [...(matches || [])]
    .filter((m) => ms(m.kickoffAt) !== null)
    .sort((a, b) => (ms(a.kickoffAt) - ms(b.kickoffAt)) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((m) => m.id);
}

// Verifică o ordine propusă: toate meciurile etapei, o singură dată,
// cronologic (doar meciurile de la ACEEAȘI oră pot fi rearanjate).
export function validateOrder(order, matches) {
  const errors = [];
  const byId = Object.fromEntries((matches || []).map((m) => [m.id, m]));
  if (!Array.isArray(order) || order.length === 0) errors.push("Ordinea e goală.");
  if (new Set(order).size !== (order || []).length) errors.push("Un meci apare de două ori.");
  (order || []).forEach((id) => { if (!byId[id]) errors.push(`Meciul ${id} nu aparține etapei.`); else if (ms(byId[id].kickoffAt) === null) errors.push(`Meciul ${byId[id].homeTeam}–${byId[id].awayTeam} nu are oră de start.`); });
  (matches || []).forEach((m) => { if (!(order || []).includes(m.id)) errors.push(`Lipsește meciul ${m.homeTeam}–${m.awayTeam}.`); });
  for (let i = 1; i < (order || []).length; i++) {
    const a = ms(byId[order[i - 1]]?.kickoffAt); const b = ms(byId[order[i]]?.kickoffAt);
    if (a !== null && b !== null && b < a) { errors.push(`Ordinea nu e cronologică la poziția ${i + 1}.`); break; }
  }
  return { ok: errors.length === 0, errors };
}

// ── Publicare (o singură dată). Tranzacție: refuză dacă există deja. ──
export async function publishRedLight(gameweekId, { participants, order, matches }) {
  const check = validateOrder(order, matches);
  if (!check.ok) throw new Error(check.errors[0]);
  if (!Array.isArray(participants) || participants.length < 2) throw new Error("Sunt necesari cel puțin 2 participanți.");
  const byId = Object.fromEntries(matches.map((m) => [m.id, m]));
  const firstLockMs = Math.min(...order.map((id) => lockAtFromKickoff(ms(byId[id].kickoffAt))));
  if (Date.now() >= firstLockMs) throw new Error("Primul meci din ordine e deja blocat — publicarea trebuie făcută înainte.");
  await runTransaction(db, async (tx) => {
    const ref = redLightRef(gameweekId);
    const snap = await tx.get(ref);
    if (snap.exists()) throw new Error("Lumină roșie e deja publicată pentru această etapă.");
    tx.set(ref, {
      gameweekId, published: true, publishedAt: serverTimestamp(),
      participants: [...participants], order: [...order], firstLockAt: Timestamp.fromMillis(firstLockMs),
    });
  });
}

// ── Anulare (doar Admin, doar ÎNAINTE de prima blocare — impus și de reguli):
// șterge alegerile și opririle, apoi configurația. ──
export async function cancelRedLight(gameweekId) {
  const game = await getRedLight(gameweekId);
  if (!game) return;
  if (Date.now() >= ms(game.firstLockAt)) throw new Error("Jocul a început (primul meci e blocat) — configurația nu mai poate fi anulată.");
  const [c, s] = await Promise.all([getDocs(choicesCol(gameweekId)), getDocs(stopsCol(gameweekId))]);
  const refs = [...c.docs, ...s.docs].map((d) => d.ref);
  refs.push(stateRef(gameweekId), showRef(gameweekId));
  for (let i = 0; i < refs.length; i += 400) {
    const b = writeBatch(db); refs.slice(i, i + 400).forEach((r) => b.delete(r)); await b.commit();
  }
  await deleteDoc(redLightRef(gameweekId));
}

// ── Alegerile jucătorului ──
export async function setMyChoice(gameweekId, matchId, uid, advance) {
  const ref = doc(db, "redLight", gameweekId, "choices", `${matchId}_${uid}`);
  if (advance) await setDoc(ref, { uid, matchId, at: serverTimestamp() });
  else await deleteDoc(ref);
}

export async function listMyChoices(gameweekId, uid) {
  const snap = await getDocs(query(choicesCol(gameweekId), where("uid", "==", uid)));
  return snap.docs.map((d) => d.data().matchId);
}

// Cine a ales AVANSEZ la un meci — permis de reguli DOAR după blocare.
export async function listAdvancersForMatch(gameweekId, matchId) {
  const snap = await getDocs(query(choicesCol(gameweekId), where("matchId", "==", matchId)));
  return snap.docs.map((d) => d.data().uid);
}

// Toate alegerile (DOAR Admin).
export async function listAllChoices(gameweekId) {
  const snap = await getDocs(choicesCol(gameweekId));
  const out = {};
  snap.docs.forEach((d) => { const v = d.data(); (out[v.matchId] = out[v.matchId] || []).push(v.uid); });
  return out;
}

// ── MĂ OPRESC ──
export async function stopMe(gameweekId, uid) {
  await setDoc(doc(db, "redLight", gameweekId, "stops", uid), { uid, at: serverTimestamp() });
}

export async function getMyStop(gameweekId, uid) {
  const snap = await getDoc(doc(db, "redLight", gameweekId, "stops", uid));
  return snap.exists() ? ms(snap.data().at) : null;
}

export async function listStops(gameweekId) {
  const snap = await getDocs(stopsCol(gameweekId));
  const out = {};
  snap.docs.forEach((d) => { const at = ms(d.data().at); if (at !== null) out[d.id] = at; });
  return out;
}

// ══════════════════════════════════════════════════════════════════
// Intrarea pentru motor
// ══════════════════════════════════════════════════════════════════

// matches → { id: { status, lockAtMs, validated } }.
// validatedIds (opțional): meciurile pe care sursa de puncte le cunoaște
// deja ca finale — un meci „finished” dar încă necalculat în puncte NU e
// procesat (altfel ar fi tratat greșit ca „fără pronostic”).
export function buildMatchesMap(matches, validatedIds) {
  const out = {};
  (matches || []).forEach((m) => {
    out[m.id] = {
      status: m.status, lockAtMs: lockAtFromKickoff(ms(m.kickoffAt)),
      ...(validatedIds ? { validated: validatedIds.has(m.id) } : {}),
    };
  });
  return out;
}

// Meciurile pe care un breakdown le are deja calculate (status ≠ "pending").
export function validatedIdsFromBreakdown(breakdown) {
  return new Set(Object.entries(breakdown || {}).filter(([, b]) => b && b.status && b.status !== "pending").map(([id]) => id));
}

// ── Starea UNUI jucător, calculată pe telefonul lui, din datele lui
// (motorul nu are interacțiuni între jucători). Citiri: alegerile proprii,
// oprirea proprie și documentul public gameweekLiveScores/{gw}_{uid}. ──
export async function computeMyRedLight(gameweekId, uid, game, matches) {
  const [mine, stopAt, liveSnap] = await Promise.all([
    listMyChoices(gameweekId, uid),
    getMyStop(gameweekId, uid),
    getDoc(doc(db, "gameweekLiveScores", `${gameweekId}_${uid}`)),
  ]);
  const breakdown = liveSnap.exists() ? liveSnap.data().breakdown || {} : {};
  const order = game?.order || [];
  const mainScores = buildMainScoresFromRows([{ uid, breakdown }], order);
  const advances = Object.fromEntries(mine.map((id) => [id, [uid]]));
  const result = computeRedLight({
    participants: [uid], order,
    matches: buildMatchesMap(matches, validatedIdsFromBreakdown(breakdown)),
    advances, mainScores, stops: stopAt !== null ? { [uid]: stopAt } : {}, nowMs: Date.now(),
  });
  return { result, myAdvances: new Set(mine), stopAt };
}

// ── Starea COMPLETĂ (DOAR Admin): rezultatele oficiale calculate de
// aplicație (previewGameweekResults → rows), toate alegerile, toate opririle. ──
export function computeFullRedLight(game, gwResults, choicesByMatch, stops) {
  const order = game?.order || [];
  const firstRow = (gwResults?.rows || [])[0];
  const validated = firstRow ? validatedIdsFromBreakdown(firstRow.breakdown) : new Set();
  return computeRedLight({
    participants: game?.participants || [], order,
    matches: buildMatchesMap(gwResults?.matches || [], validated),
    advances: choicesByMatch || {},
    mainScores: buildMainScoresFromRows(gwResults?.rows || [], order),
    stops: stops || {}, nowMs: Date.now(),
  });
}

// ══════════════════════════════════════════════════════════════════
// ETAPA 3 — STAREA OFICIALĂ, salvată la fiecare validare / corectare
// ══════════════════════════════════════════════════════════════════
export const stateRef = (gw) => doc(db, "redLight", gw, "meta", "state");

// MEMORIA INTERNĂ A ALEGERILOR (doar economie de citiri — NU e o regulă de joc):
// alegerile se pot schimba DOAR până la limita reală de 30 de minute, impusă de
// SERVER (Firestore Rules, ora serverului). Ca să nu recitim la fiecare validare
// alegerile meciurilor deja definitive, le păstrăm în stare — dar NUMAI dacă e
// sigur că meciul chiar a început, independent de ceasul telefonului Admin:
//   • statusul meciului e Live / Pauză / Final (deci ora reală a trecut), ȘI
//   • limita de blocare a trecut de cel puțin 5 minute pe ceasul local, ȘI
//   • ora de start nu s-a schimbat de când au fost păstrate (reprogramare → recitire).
// Orice alt meci blocat se recitește la fiecare calcul. FINALIZEAZĂ recitește oricum TOTUL.
const CHOICE_CACHE_MARGIN_MS = 5 * 60 * 1000;
const STARTED_STATUSES = new Set(["live", "halftime", "finished"]);

async function fetchChoicesFor(gameweekId, matchIds) {
  const out = {};
  matchIds.forEach((id) => { out[id] = []; });
  for (let i = 0; i < matchIds.length; i += 30) {
    const chunk = matchIds.slice(i, i + 30);
    const snap = await getDocs(query(choicesCol(gameweekId), where("matchId", "in", chunk)));
    snap.docs.forEach((d) => { const v = d.data(); (out[v.matchId] = out[v.matchId] || []).push(v.uid); });
  }
  return out;
}

export async function getRedLightState(gameweekId) {
  const snap = await getDoc(stateRef(gameweekId));
  return snap.exists() ? snap.data() : null;
}

const asResult = (state) => (state?.rows ? { byUid: Object.fromEntries(state.rows.map((r) => [r.uid, r])) } : null);

// Schimbările IMPORTANTE față de starea salvată anterior (Q3): stare (FINISHER /
// ELIMINAT / SAFE) sau punctaj. Simplele avansări (+1 pas) nu sunt semnalate.
export function importantChanges(prevState, res) {
  const prev = asResult(prevState);
  if (!prev) return [];
  return diffRedLight(prev, res).filter((c) => c.from.status !== c.to.status || c.affectsPoints);
}

// Premiile deja acordate la FINALIZEAZĂ (results/{uid}.mainPoints) diferă de calculul actual?
async function prizeMismatches(gameweekId, res, participants) {
  const pub = await getDoc(doc(db, "weeklySurprises", gameweekId));
  if (!pub.exists() || !pub.data().mainResolved || !res.resolvedAll) return [];
  const snaps = await Promise.all(participants.map((u) => getDoc(doc(db, "weeklySurprises", gameweekId, "results", u))));
  const out = [];
  participants.forEach((u, i) => {
    const awarded = snaps[i].exists() ? snaps[i].data().mainPoints ?? null : null;
    const now = res.prizesByUid?.[u] ?? 0;
    if (awarded !== now) out.push({ uid: u, awarded, now });
  });
  return out;
}

// ── Recalculează și salvează starea oficială (DOAR Admin). ──
// capturedResultsVersion = versiunea rezultatelor citită ÎNAINTE de calcul
// (aceeași regulă ca snapshot-ul clasamentului). Scriere MONOTONĂ, în
// tranzacție: dacă există deja o stare pentru o versiune mai nouă — sau
// pentru aceeași versiune, dar calculată mai târziu — nu se suprascrie.
// gwResults = rezultatul deja calculat de aplicație (previewGameweekResults):
// zero citiri în plus de pronosticuri.
export async function publishRedLightState(gameweekId, capturedResultsVersion, gwResults) {
  const game = await getRedLight(gameweekId);
  if (!game?.published) return null;
  const computedAtMs = Date.now();
  const prev = await getRedLightState(gameweekId);

  const byId = Object.fromEntries((gwResults?.matches || []).map((m) => [m.id, m]));
  const plan = planChoiceReads(game.order, byId, prev, computedAtMs);
  const [fetched, fresh, stops] = await Promise.all([
    fetchChoicesFor(gameweekId, plan.toCache), fetchChoicesFor(gameweekId, plan.fresh), listStops(gameweekId),
  ]);
  const choicesLocked = Object.fromEntries(plan.settled.map((id) => [id, plan.reuse.has(id) ? prev.choicesLocked[id] : fetched[id] || []]));
  const choicesLockedKickoff = Object.fromEntries(plan.settled.map((id) => [id, ms(byId[id]?.kickoffAt)]));
  const res = computeFullRedLight(game, gwResults, { ...choicesLocked, ...fresh }, stops);
  const matchesInfo = showMatchesInfo(game.order, byId);
  const changes = importantChanges(prev, res);
  const mismatches = await prizeMismatches(gameweekId, res, game.participants);

  let skipped = false; let showUpdate = null;
  await runTransaction(db, async (tx) => {
    const cur = await tx.get(stateRef(gameweekId));
    const showSnap = await tx.get(showRef(gameweekId));
    const d = cur.exists() ? cur.data() : null;
    const curV = d?.resultsVersion ?? -1;
    const curAt = d?.computedAtMs ?? 0;
    if (curV > capturedResultsVersion || (curV === capturedResultsVersion && curAt > computedAtMs)) { skipped = true; return; }
    // Replay: dacă o corectură schimbă evenimentele (sau scorurile) prezentate în ultimul show,
    // scenariul se REGENEREAZĂ din evenimentele noi și e marcat „corectat”; dacă meciurile lui nu
    // mai sunt toate procesate, e marcat invalid (replay-ul afișează avertismentul, nu evenimente false).
    if (showSnap.exists()) {
      showUpdate = reconcileShow(showSnap.data(), res, matchesInfo, computedAtMs);
      if (showUpdate) tx.set(showRef(gameweekId), showUpdate);
    }
    tx.set(stateRef(gameweekId), {
      gameweekId, resultsVersion: capturedResultsVersion, computedAtMs, computedAt: serverTimestamp(),
      processed: res.processed, total: res.total, resolvedAll: res.resolvedAll,
      rows: res.rows.map((r) => ({
        uid: r.uid, steps: r.steps, strikes: r.strikes, status: r.status, pct: r.pct, stopRequested: r.stopRequested,
        finishedAt: r.finishedAt, eliminatedAt: r.eliminatedAt, safeAt: r.safeAt, stepsAtElimination: r.stepsAtElimination,
      })),
      events: res.events, initialSafe: res.initialSafe,
      prizesByUid: res.prizesByUid, choicesLocked, choicesLockedKickoff,
      lastChanges: changes.map((c) => ({ uid: c.uid, from: c.from, to: c.to })),
      prizeMismatches: mismatches,
    });
  });
  return { skipped, res, changes, mismatches, game, showUpdate };
}

// Care alegeri se citesc acum (vezi MEMORIA INTERNĂ mai sus). Exportat pentru teste.
export function planChoiceReads(order, byId, prev, nowMs) {
  const lockOf = (id) => lockAtFromKickoff(ms(byId[id]?.kickoffAt));
  const locked = order.filter((id) => { const l = lockOf(id); return l !== null && l <= nowMs; });
  const settled = locked.filter((id) => lockOf(id) <= nowMs - CHOICE_CACHE_MARGIN_MS && STARTED_STATUSES.has(byId[id]?.status));
  const cached = prev?.choicesLocked || {}; const cachedKick = prev?.choicesLockedKickoff || {};
  const reuse = new Set(settled.filter((id) => id in cached && cachedKick[id] === ms(byId[id]?.kickoffAt)));
  return { settled, reuse, toCache: settled.filter((id) => !reuse.has(id)), fresh: locked.filter((id) => !settled.includes(id)) };
}

// ── Cârligul apelat din AdminScreen după fiecare validare/corectare.
// Întoarce un mesaj scurt pentru Admin (sau null dacă jocul nu e activ). ──
export async function runRedLightAfterValidation(gameweekId, capturedResultsVersion, gwResults) {
  const out = await publishRedLightState(gameweekId, capturedResultsVersion, gwResults);
  if (!out) return null;
  if (out.skipped) return "🚦 Lumină roșie: există deja o stare mai nouă — nimic de suprascris.";
  const names = await getUserPublicProfiles(out.game.participants).catch(() => ({}));
  const nm = (u) => names[u]?.nickname || String(u).slice(0, 6);
  const parts = [`🚦 Lumină roșie: ${out.res.processed}/${out.res.total} meciuri procesate.`];
  if (out.changes.length) {
    parts.push("⚠️ Schimbări importante: " + out.changes.map((c) => `${nm(c.uid)} ${c.from.status}→${c.to.status} (${c.from.pct}→${c.to.pct} PCT)`).join("; ") + ".");
  }
  if (out.showUpdate) {
    parts.push(out.showUpdate.invalid
      ? "⚠️ Replay-ul ultimului show a fost marcat invalid (un meci prezentat nu mai e validat)."
      : "♻️ Replay-ul ultimului show a fost regenerat după corectură.");
  }
  if (out.mismatches.length) {
    parts.push(`⚠️ Premiile deja acordate diferă de calculul actual pentru ${out.mismatches.length} jucător(i) — folosește „Re-aplică premiile” din panoul Lumină roșie.`);
  }
  return parts.join(" ");
}

// ── FINALIZEAZĂ — premiile oficiale (folosit de resolveMain). Calcul complet,
// din sursele oficiale: rezultatele (previewGameweekResults), TOATE alegerile,
// TOATE opririle. Refuză dacă nu sunt rezolvate toate meciurile. ──
export async function computeRedLightPrizes(gameweekId) {
  const game = await getRedLight(gameweekId);
  if (!game?.published) throw new Error("Lumină roșie nu e publicată.");
  const [gwRes, choices, stops] = await Promise.all([previewGameweekResults(gameweekId), listAllChoices(gameweekId), listStops(gameweekId)]);
  const res = computeFullRedLight(game, gwRes, choices, stops);
  if (!res.resolvedAll || !res.prizesByUid) {
    throw new Error(`Lumină roșie nu s-a încheiat: ${res.processed}/${res.total} meciuri procesate (validează sau marchează Amânat/Anulat meciul #${res.processed + 1}).`);
  }
  return { prizes: res.prizesByUid, res, game };
}

// ── Re-aplică premiile după o corectură făcută DUPĂ FINALIZEAZĂ.
// Permis doar cât etapa NU e finalizată (la finalizarea etapei, premiile se
// adună o singură dată în totaluri). Atinge DOAR mainPoints ale participanților
// Lumină roșie, doar pentru această surpriză. ──
export async function reapplyRedLightPrizes(gameweekId) {
  const [gwSnap, secretSnap] = await Promise.all([getDoc(doc(db, "gameweeks", gameweekId)), getDoc(doc(db, "weeklySurprises", gameweekId, "secret", "main"))]);
  if (gwSnap.exists() && gwSnap.data().status === "completed") throw new Error("Etapa e deja finalizată — premiile nu mai pot fi modificate.");
  if (!secretSnap.exists() || secretSnap.data().type !== RED_LIGHT_TYPE_ID) throw new Error("Surpriza Mare a etapei nu e Lumină roșie.");
  const { prizes } = await computeRedLightPrizes(gameweekId);
  const publicRef = doc(db, "weeklySurprises", gameweekId);
  let changed = 0;
  await runTransaction(db, async (tx) => {
    const pub = await tx.get(publicRef);
    if (!pub.exists() || !pub.data().mainResolved) throw new Error("Surpriza nu a fost încă finalizată — folosește FINALIZEAZĂ.");
    const refs = Object.keys(prizes).map((u) => doc(db, "weeklySurprises", gameweekId, "results", u));
    const snaps = await Promise.all(refs.map((r) => tx.get(r)));
    snaps.forEach((sn, i) => {
      const u = Object.keys(prizes)[i];
      const cur = sn.exists() ? sn.data().mainPoints ?? null : null;
      if (cur !== prizes[u]) { changed += 1; tx.set(refs[i], { uid: u, mainPoints: prizes[u], mainMatchScore: null, mainOpponentMatchScore: null }, { merge: true }); }
    });
  });
  return changed;
}

// ══════════════════════════════════════════════════════════════════
// ETAPA 4 — RED LIGHT SHOW
// redLight/{gw}/meta/show — ULTIMUL show (înlocuit la fiecare show nou).
// Conține DOAR date de afișare, copiate din evenimentele calculate de motor
// (starea oficială). Show-ul și replay-ul NU scriu și NU recalculează puncte.
//   fromIndex/toIndex  meciurile prezentate (în ordinea fixă)
//   events             evenimentele motorului pentru aceste meciuri
//   matches            echipe + scor, pentru bannere
//   players            nume, avatar, număr de tricou (replay fără alte citiri)
//   corrected / invalid  după o corectură (vezi reconcileShow)
// ══════════════════════════════════════════════════════════════════
export const showRef = (gw) => doc(db, "redLight", gw, "meta", "show");

export async function getRedLightShow(gameweekId) {
  const snap = await getDoc(showRef(gameweekId));
  return snap.exists() ? snap.data() : null;
}

export function showMatchesInfo(order, byId) {
  return (order || []).map((id, index) => {
    const m = byId[id] || {};
    return {
      index, id, home: m.homeTeam || "?", away: m.awayTeam || "?", status: m.status || null,
      scoreA: Number.isFinite(m.realScoreA) ? m.realScoreA : null, scoreB: Number.isFinite(m.realScoreB) ? m.realScoreB : null,
    };
  });
}

// Întoarce show-ul actualizat (sau null dacă nu trebuie schimbat nimic). Exportat pentru teste.
export function reconcileShow(show, res, matchesInfo, nowMs) {
  const from = show.fromIndex; const to = show.toIndex;
  if (res.processed < to) {
    if (show.invalid) return null;
    return { ...show, invalid: true, invalidReason: "Un meci prezentat în acest show nu mai e validat.", invalidAtMs: nowMs };
  }
  const chk = checkShowScript({ fromIndex: from, events: (show.events || []) }, res);
  const newInfo = matchesInfo.slice(from, to);
  const infoChanged = JSON.stringify(newInfo) !== JSON.stringify(show.matches || []);
  const eventsChanged = !chk.valid || (show.events || []).length !== to - from;
  if (!eventsChanged && !infoChanged && !show.invalid) return null;
  return {
    ...show,
    events: res.events.filter((e) => e.index >= from && e.index < to),
    initialSafe: from === 0 ? res.initialSafe : [],
    matches: newInfo, invalid: false, invalidReason: null,
    corrected: true, correctedAtMs: nowMs,
    changedMatchIds: [...new Set([...(show.changedMatchIds || []), ...chk.changedMatchIds])],
  };
}

// ── PORNEȘTE SHOW-UL (DOAR Admin; regulile permit scrierea în meta/ doar Adminului).
// Ia automat meciurile validate, dar neprezentate: de la sfârșitul ultimului show
// până la ultimul meci procesat în starea oficială. Tranzacție: dacă între timp
// altcineva a pornit un show, refuză (nu se suprapun, nu se sare peste meciuri). ──
export async function startRedLightShow(gameweekId) {
  const [game, state, prevShow] = await Promise.all([getRedLight(gameweekId), getRedLightState(gameweekId), getRedLightShow(gameweekId)]);
  if (!game?.published) throw new Error("Lumină roșie nu e publicată.");
  if (!state) throw new Error("Nu există încă o stare calculată (validează un meci sau apasă Recalculează).");
  const from = prevShow ? prevShow.toIndex : 0;
  const to = state.processed;
  if (to <= from) throw new Error("Nu există meciuri validate și neprezentate încă.");
  const [matches, profiles, numbersDoc] = await Promise.all([
    listMatches(gameweekId), getUserPublicProfiles(game.participants), getSeasonNumbers().catch(() => null),
  ]);
  const byId = Object.fromEntries(matches.map((m) => [m.id, m]));
  const players = Object.fromEntries(game.participants.map((u) => [u, {
    nick: profiles[u]?.nickname || "?", avatarId: profiles[u]?.avatarId || null,
    number: Number.isFinite(numbersDoc?.numbers?.[u]) ? numbersDoc.numbers[u] : null,
  }]));
  const startedAtMs = Date.now();
  const show = {
    gameweekId, showId: `${from}-${to}-${startedAtMs}`, fromIndex: from, toIndex: to, total: state.total,
    startedAtMs, startedAt: serverTimestamp(), stateResultsVersion: state.resultsVersion ?? null,
    events: (state.events || []).filter((e) => e.index >= from && e.index < to),
    initialSafe: from === 0 ? state.initialSafe || [] : [],
    matches: showMatchesInfo(game.order, byId).slice(from, to), players,
    corrected: false, invalid: false, changedMatchIds: [],
  };
  await runTransaction(db, async (tx) => {
    const cur = await tx.get(showRef(gameweekId));
    if (cur.exists() && cur.data().toIndex !== from) throw new Error("Între timp a fost pornit un alt show — reîncarcă panoul.");
    if (!cur.exists() && from !== 0) throw new Error("Show-ul anterior lipsește — reîncarcă panoul.");
    tx.set(showRef(gameweekId), show);
  });
  return show;
}
