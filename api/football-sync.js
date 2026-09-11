// ══════════════════════════════════════════════════════════════════
// api/football-sync.js — Vercel Serverless Function (plan Hobby,
// gratuit). Declanșată de GitHub Actions la ~5 minute, DAR decide
// SINGURĂ dacă merită să cheme API-Football — schedulerul poate bate
// des, asta NU înseamnă consum.
//
// Variabile de mediu necesare (Vercel → Settings → Environment Variables):
//   API_FOOTBALL_KEY          — cheia de la api-football.com (server-side EXCLUSIV)
//   CRON_SECRET                — orice string lung, generat de tine
//   FIREBASE_SERVICE_ACCOUNT_KEY — JSON-ul contului de service Firebase
//   FIREBASE_PROJECT_ID        — id-ul proiectului Firebase
//
// ── REPARAT (audit Firestore reads, P0+P1) ──────────────────────────
// Firebase Admin SDK (folosit aici) NU are o cotă separată de restul
// aplicației — orice citire de-aici contează în ACEEAȘI limită zilnică
// de 50.000. Găsit și reparat:
// 1. Înainte: citea TOATE meciurile etapei (până la 20) la FIECARE
//    rulare, doar ca să afle dacă are ceva relevant de făcut. Acum:
//    interogare Firestore filtrată direct pe fereastra de timp
//    (server-side) — o zi fără niciun meci în fereastră costă ~0
//    citiri pentru pasul ăsta, nu 20.
// 2. Înainte: citea cache-ul extern (externalFootballCache) de DOUĂ ORI
//    per meci, separat — o dată pentru verificarea "e încă live?", a
//    doua oară pentru lineup. Acum: o singură citire per meci, per
//    rulare, reutilizată peste tot unde e nevoie.
// 3. Fereastra de monitorizare unificată la T-60 (o oră înainte de
//    kickoff) → T+150min (acoperă prelungiri/întârzieri) — înainte
//    erau 2 ferestre diferite (±3h pentru meciuri normale, ±48h pentru
//    Meciurile Săptămânii, rămasă dintr-o funcționalitate — H2H/formă —
//    deja eliminată).
// 4. După FT (sau alt status final — AET/PEN/PST/CANC/ABD/AWD/WO),
//    meciul e exclus explicit din verificările ulterioare ale zilei —
//    nu mai consumă nimic după ce s-a terminat.
//
// NIMIC din mecanismul de scoring/Joker/Feed/predicții nu a fost
// atins — strict citirile din bucla asta de sincronizare.
// ══════════════════════════════════════════════════════════════════
import { getAdminDb } from "./_lib/firebaseAdmin.js";
import { Timestamp } from "firebase-admin/firestore";
import { normalizeFixture, matchFixture, detectDelta } from "./_lib/footballLogic.js";

const DAILY_LIMIT = 100;
const SAFETY_MARGIN = 85; // pentru matching (o singură dată/meci, nu urgent)
const MARGIN_LIVE = 98; // LIVE are prioritate ABSOLUTĂ — se oprește doar la limită

// ── Fereastra unificată de monitorizare — cerut explicit: un meci
// intră în atenția sincronizării DOAR de la T-60 (o oră înainte de
// kickoff), nu mai devreme. Rămâne monitorizat până la 150 min după
// kickoff (durată tipică + pauză + prelungiri), ca să nu pierdem
// finalul dacă un meci a întârziat. ──
const MONITOR_BEFORE_MS = 60 * 60 * 1000; // T-60
const MONITOR_AFTER_MS = 150 * 60 * 1000;

// Statusuri API-Football care înseamnă "meciul s-a încheiat definitiv,
// nu mai are rost să-l verificăm în continuare azi".
const FINISHED_STATUSES = ["FT", "AET", "PEN", "PST", "CANC", "ABD", "AWD", "WO"];

export default async function handler(req, res) {
  const authHeader = req.headers["authorization"];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const API_KEY = process.env.API_FOOTBALL_KEY;
  if (!API_KEY) return res.status(500).json({ error: "API_FOOTBALL_KEY nu e configurată" });

  const db = getAdminDb();
  const todayKey = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD", UTC

  try {
    // ── 1. QUOTA — citit/inițializat ÎNTÂI, orice altceva depinde de el. ──
    const quotaRef = db.collection("externalFootballCache").doc("_quota");
    const quotaSnap = await quotaRef.get();
    let quota = quotaSnap.exists ? quotaSnap.data() : null;
    if (!quota || quota.date !== todayKey) {
      quota = { date: todayKey, requestsUsed: 0, lastSync: null, lastSuccess: null, lastError: null };
    }

    // ── 2. Etapa curentă — o singură citire, cea mai recentă etapă al
    // cărei weekStart <= acum, nefinalizată explicit din Admin. ──
    const now = Date.now();
    const nowTs = Timestamp.fromMillis(now);
    const gwQuerySnap = await db.collection("gameweeks")
      .where("weekStart", "<=", nowTs)
      .orderBy("weekStart", "desc")
      .limit(1)
      .get();
    const candidate = gwQuerySnap.empty ? null : { id: gwQuerySnap.docs[0].id, ...gwQuerySnap.docs[0].data() };
    const currentGw = candidate && candidate.status !== "completed" ? candidate : null;
    if (!currentGw) {
      return res.status(200).json({ skipped: true, reason: "no_gameweek_in_current_week_window", requestsUsedToday: quota.requestsUsed });
    }
    const gwId = currentGw.id;

    // ── 3. Meciurile RELEVANTE ACUM — filtrate direct de Firestore,
    // server-side, pe fereastra T-60 → T+150min. NU se mai citesc toate
    // cele ~20 de meciuri ale etapei ca să afle "am ceva de făcut?" —
    // dacă 0 meciuri sunt în fereastră, query-ul întoarce 0 documente,
    // cost aproape 0. (Necesită un index compus Firestore pe
    // gameweekId+kickoffAt — dacă prima rulare eșuează cu o eroare
    // despre index lipsă, link-ul din eroare îl creează automat,
    // durează câteva minute să se activeze, apoi funcționează
    // permanent.)
    const windowStart = Timestamp.fromMillis(now - MONITOR_AFTER_MS);
    const windowEnd = Timestamp.fromMillis(now + MONITOR_BEFORE_MS);
    const matchesSnap = await db.collection("matches")
      .where("gameweekId", "==", gwId)
      .where("kickoffAt", ">=", windowStart)
      .where("kickoffAt", "<=", windowEnd)
      .get();

    const relevant = matchesSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((m) => {
        if (m.status === "finished") return false; // validat oficial de Admin — gata
        if (FINISHED_STATUSES.includes(m.liveApiStatus)) return false; // FT/AET/etc. detectat automat — gata, nu mai verificăm azi
        return true;
      });

    if (relevant.length === 0) {
      quota.lastSync = now;
      await quotaRef.set(quota, { merge: true });
      return res.status(200).json({ skipped: true, reason: "no_match_in_monitoring_window", requestsUsedToday: quota.requestsUsed });
    }

    // BUG REPARAT (păstrat din auditul anterior): pragul global de
    // oprire completă folosea SAFETY_MARGIN (85), oprind ȘI LIVE-ul —
    // contrazicea "LIVE are prioritate absolută". Oprirea completă
    // vine doar la MARGIN_LIVE (98), aproape de limita hard.
    if (quota.requestsUsed >= MARGIN_LIVE) {
      quota.lastSync = now;
      quota.lastError = `Quota aproape epuizată (${quota.requestsUsed}/${DAILY_LIMIT}) — sincronizare oprită pentru azi.`;
      await quotaRef.set(quota, { merge: true });
      return res.status(200).json({ skipped: true, reason: "quota_safety_margin", requestsUsedToday: quota.requestsUsed });
    }

    let apiCallsThisRun = 0;
    const results = { matched: 0, unmatched: 0, ambiguous: 0, live: 0, updated: 0, errors: [] };

    // ── 4. Meciuri nemapate încă → o singură cerere /fixtures?date=
    // per dată unică necesară, DOAR dacă mai avem buget. ──
    const unmapped = relevant.filter((m) => !m.externalFixtureId);
    const uniqueDates = [...new Set(unmapped.map((m) => {
      const ms = m.kickoffAt.toMillis();
      return new Date(ms).toISOString().slice(0, 10);
    }))];

    for (const date of uniqueDates) {
      if (quota.requestsUsed + apiCallsThisRun >= SAFETY_MARGIN) break;
      try {
        const resp = await fetch(`https://v3.football.api-sports.io/fixtures?date=${date}`, {
          headers: { "x-apisports-key": API_KEY },
        });
        apiCallsThisRun++;
        if (!resp.ok) { results.errors.push(`fixtures?date=${date}: HTTP ${resp.status}`); continue; }
        const data = await resp.json();
        const candidatesForDate = data.response || [];
        for (const m of unmapped.filter((mm) => new Date(mm.kickoffAt.toMillis()).toISOString().slice(0, 10) === date)) {
          const matchResult = matchFixture({ homeTeam: m.homeTeam, awayTeam: m.awayTeam, kickoffAtMs: m.kickoffAt.toMillis() }, candidatesForDate);
          if (matchResult.status === "matched") {
            const matchedFixture = candidatesForDate.find((c) => c.fixture.id === matchResult.fixtureId);
            await db.collection("matches").doc(m.id).set({
              externalFixtureId: matchResult.fixtureId, externalProvider: "api-football",
              externalLeagueId: matchedFixture?.league?.id || null, externalSeason: matchedFixture?.league?.season || null,
              // ── Câmpuri mici, doar pentru diagnostic vizual în Admin —
              // ce a găsit API-ul, EXACT la momentul mapării, ca Adminul
              // să poată verifica ÎNAINTE de meci, fără o citire nouă. ──
              externalFixtureHomeTeam: matchedFixture?.teams?.home?.name || null,
              externalFixtureAwayTeam: matchedFixture?.teams?.away?.name || null,
              externalFixtureDate: matchedFixture?.fixture?.date || null,
            }, { merge: true });
            m.externalFixtureId = matchResult.fixtureId;
            m.externalLeagueId = matchedFixture?.league?.id || null;
            m.externalSeason = matchedFixture?.league?.season || null;
            results.matched++;
          } else if (matchResult.status === "ambiguous") {
            await db.collection("externalFootballCache").doc(`_diagnostic_${m.id}`).set({ matchId: m.id, status: "AMBIGUOUS", candidateIds: matchResult.candidateIds, checkedAt: now }, { merge: true });
            results.ambiguous++;
          } else {
            await db.collection("externalFootballCache").doc(`_diagnostic_${m.id}`).set({ matchId: m.id, status: "UNMATCHED", checkedAt: now }, { merge: true });
            results.unmatched++;
          }
        }
      } catch (err) {
        results.errors.push(`matching ${date}: ${String(err)}`);
      }
    }

    // ── 5. O SINGURĂ citire de cache per meci mapat, per rulare —
    // reutilizată mai jos ATÂT pentru decizia "e încă live?" CÂT ȘI
    // pentru verificarea lineup-ului (înainte erau 2 citiri separate
    // pe același document). ──
    const mappedRelevant = relevant.filter((m) => m.externalFixtureId);
    const cacheByFixtureId = {};
    for (const m of mappedRelevant) {
      const snap = await db.collection("externalFootballCache").doc(String(m.externalFixtureId)).get();
      cacheByFixtureId[m.externalFixtureId] = snap.exists ? snap.data() : {};
    }

    function isLiveNow(m) {
      const kickoffMs = m.kickoffAt?.toMillis ? m.kickoffAt.toMillis() : null;
      if (!kickoffMs) return false;
      const withinWindow = now >= kickoffMs && now <= kickoffMs + MONITOR_AFTER_MS;
      const stillLiveInCache = ["1H", "2H", "HT", "ET"].includes(cacheByFixtureId[m.externalFixtureId]?.status);
      return withinWindow || stillLiveInCache;
    }

    // ── 6. Scor live — DOAR meciurile chiar începute (kickoff trecut)
    // sau încă live conform ultimului cache. UN SINGUR request batch
    // pentru toate deodată, indiferent câte sunt live simultan. ──
    const mappedIds = mappedRelevant.filter(isLiveNow).map((m) => m.externalFixtureId);
    if (mappedIds.length > 0 && quota.requestsUsed + apiCallsThisRun < MARGIN_LIVE) {
      try {
        const resp = await fetch(`https://v3.football.api-sports.io/fixtures?ids=${mappedIds.join("-")}`, {
          headers: { "x-apisports-key": API_KEY },
        });
        apiCallsThisRun++;
        if (resp.ok) {
          const data = await resp.json();
          for (const f of data.response || []) {
            const newSnapshot = normalizeFixture(f);
            const cacheRef = db.collection("externalFootballCache").doc(String(newSnapshot.fixtureId));
            // Reutilizăm cache-ul deja citit mai sus (pasul 5) — nu mai
            // citim din nou același document.
            const oldSnapshot = cacheByFixtureId[newSnapshot.fixtureId] || null;
            const delta = detectDelta(oldSnapshot?.status ? oldSnapshot : null, newSnapshot);

            const ourMatch = relevant.find((m) => m.externalFixtureId === newSnapshot.fixtureId);
            await cacheRef.set({
              ...newSnapshot,
              matchId: ourMatch?.id || null,
              lastDeltaEvents: delta.newEvents,
              lastStatusChange: delta.statusChanged ? { from: oldSnapshot?.status || null, to: newSnapshot.status } : null,
              lastScoreChange: delta.scoreChanged ? { before: delta.oldScore || { home: 0, away: 0 }, after: delta.newScore || { home: newSnapshot.homeScore, away: newSnapshot.awayScore } } : null,
            }, { merge: true }); // merge:true — PĂSTREAZĂ lineup scris anterior.

            // ── SCRIERE DIRECTĂ pe documentul MECIULUI — câmpuri NOI,
            // separate ("liveApi*"), NICIODATĂ prin updateMatchStatus/
            // saveMatchResult (acelea rămân STRICT manuale, ale
            // Adminului, singurele care declanșează scoring). Exact
            // acest scris e cel pe care listenMatches (onSnapshot din
            // WelcomeScreen) îl "vede" automat, fără refresh — validat,
            // neschimbat față de înainte.
            if (ourMatch?.id) {
              await db.collection("matches").doc(ourMatch.id).set({
                liveApiStatus: newSnapshot.status,
                liveApiScoreA: newSnapshot.homeScore,
                liveApiScoreB: newSnapshot.awayScore,
                liveApiMinute: newSnapshot.minute,
                liveApiEvents: newSnapshot.events,
                liveApiUpdatedAt: now,
              }, { merge: true });
              results.updated++;
            }

            if (["1H", "2H", "HT", "ET"].includes(newSnapshot.status)) results.live++;
          }
        } else {
          results.errors.push(`fixtures?ids=: HTTP ${resp.status}`);
        }
      } catch (err) {
        results.errors.push(`live fetch: ${String(err)}`);
      }
    }

    // ── 7. LINEUP — ELIMINAT din sincronizarea automată (cerut explicit,
    // pct. 7: "scoate consumul API inutil"). Admin introduce echipele
    // manual. Codul de normalizare (normalizeLineup) rămâne neatins în
    // footballLogic.js, doar neapelat de aici — dacă e nevoie vreodată,
    // se poate reactiva fără nicio recuperare de logică pierdută. ──

    // ── 8. Quota — actualizată o singură dată, la final. ──
    quota.requestsUsed += apiCallsThisRun;
    quota.lastSync = now;
    if (apiCallsThisRun > 0 && results.errors.length === 0) quota.lastSuccess = now;
    if (results.errors.length > 0) quota.lastError = results.errors[results.errors.length - 1];
    await quotaRef.set(quota, { merge: true });

    // ── Sumar clar, cerut explicit — un 200 nu mai e singura informație
    // utilă. eligibleMatches/alreadyMapped/liveFixtures arată direct
    // dacă rularea a procesat efectiv ceva, nu doar că n-a crăpat. ──
    return res.status(200).json({
      skipped: false,
      eligibleMatches: relevant.length,
      alreadyMapped: mappedRelevant.length - results.matched,
      newlyMapped: results.matched,
      unmatched: results.unmatched,
      ambiguous: results.ambiguous,
      liveFixtures: mappedIds.length,
      updatedMatches: results.updated,
      apiRequestsUsed: apiCallsThisRun,
      requestsUsedToday: quota.requestsUsed,
      errors: results.errors,
    });
  } catch (err) {
    // Eroare neașteptată — NU lăsăm cererea nescrisă; Feed-ul intern
    // continuă normal indiferent (external e enhancement, nu dependency).
    try {
      await db.collection("externalFootballCache").doc("_quota").set({ lastError: String(err), lastSync: Date.now() }, { merge: true });
    } catch {}
    return res.status(500).json({ error: String(err) });
  }
}
