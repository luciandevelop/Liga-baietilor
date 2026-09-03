// ══════════════════════════════════════════════════════════════════
// api/football-sync.js — Vercel Serverless Function (plan Hobby,
// gratuit). Declanșată de GitHub Actions la ~10 minute, DAR decide
// SINGURĂ dacă merită să cheme API-Football — schedulerul poate bate
// des, asta NU înseamnă consum.
//
// Variabile de mediu necesare (Vercel → Settings → Environment Variables):
//   API_FOOTBALL_KEY          — cheia de la api-football.com (server-side EXCLUSIV)
//   CRON_SECRET                — orice string lung, generat de tine
//   FIREBASE_SERVICE_ACCOUNT_KEY — JSON-ul contului de service Firebase
//   FIREBASE_PROJECT_ID        — id-ul proiectului Firebase
// ══════════════════════════════════════════════════════════════════
import { getAdminDb } from "./_lib/firebaseAdmin.js";
import { Timestamp } from "firebase-admin/firestore";
import { normalizeFixture, matchFixture, detectDelta, normalizeLineup, normalizeH2H, normalizeStandings, normalizePrediction, normalizeInjuries, leagueSupports } from "./_lib/footballLogic.js";

const DAILY_LIMIT = 100;
const SAFETY_MARGIN = 85; // pentru matching (o singură dată/meci, nu urgent)
const MARGIN_LIVE = 98; // LIVE are prioritate ABSOLUTĂ — se oprește doar la limită
const RELEVANT_WINDOW_MS = 3 * 3600 * 1000; // 3h înainte/după kickoff = "relevant"

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

    // ── 2. Etapa curentă — OPTIMIZAT: nu mai citim TOATE etapele
    // sezonului la fiecare rulare (asta însemna N citiri, la 10 minute,
    // non-stop, 144×/zi — cost mare independent de orice meci live).
    // Firestore poate găsi direct candidatul corect cu O SINGURĂ
    // citire: cea mai recentă etapă al cărei weekStart <= acum. Dacă
    // și weekEnd-ul ei acoperă momentul curent, e etapa activă — exact
    // aceeași regulă ca înainte (fereastra weekStart/weekEnd), doar
    // găsită eficient, nu prin scanarea completă a colecției.
    const now = Date.now();
    const nowTs = Timestamp.fromMillis(now);
    const gwQuerySnap = await db.collection("gameweeks")
      .where("weekStart", "<=", nowTs)
      .orderBy("weekStart", "desc")
      .limit(1)
      .get();
    const candidate = gwQuerySnap.empty ? null : { id: gwQuerySnap.docs[0].id, ...gwQuerySnap.docs[0].data() };
    const currentGw = candidate && candidate.weekEnd?.toMillis && candidate.weekEnd.toMillis() >= now ? candidate : null;
    if (!currentGw) {
      return res.status(200).json({ skipped: true, reason: "no_gameweek_in_current_week_window", requestsUsedToday: quota.requestsUsed });
    }
    const gwId = currentGw.id;
    const featuredIds = new Set(currentGw.featuredMatchIds || []);

    const matchesSnap = await db.collection("matches").where("gameweekId", "==", gwId).get();
    const allMatches = matchesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    // ── Meciurile săptămânii (featured) intră în Match Intelligence cu
    // până la 48h înainte de kickoff — cerut explicit, ca H2H/formă/
    // predicții să nu aștepte ziua meciului. Restul rămân pe fereastra
    // îngustă (3h), pentru economie de request-uri. ──
    const FEATURED_WINDOW_MS = 48 * 3600 * 1000;
    const relevant = allMatches.filter((m) => {
      if (m.status === "finished") return false;
      const kickoffMs = m.kickoffAt?.toMillis ? m.kickoffAt.toMillis() : null;
      if (!kickoffMs) return false;
      const window = featuredIds.has(m.id) ? FEATURED_WINDOW_MS : RELEVANT_WINDOW_MS;
      return Math.abs(now - kickoffMs) <= window || (kickoffMs > now && kickoffMs - now <= window);
    });

    if (relevant.length === 0) {
      quota.lastSync = now;
      await quotaRef.set(quota, { merge: true });
      return res.status(200).json({ skipped: true, reason: "gameweek_found_but_no_match_in_sync_window", requestsUsedToday: quota.requestsUsed });
    }

    // ── BUG REAL GĂSIT ȘI REPARAT ACUM: fereastra ±3h ("relevant") era
    // folosită și pentru interogarea de scor LIVE, repetată la fiecare
    // sincronizare — nu doar pentru căutările o-singură-dată (lineup/
    // h2h/formă/predicții/accidentări, unde ±3h chiar are sens, ca să
    // prindem lineup-ul din timp). Rezultat: pe o zi cu 5 meciuri
    // eșalonate, ferestrele de ±3h se suprapun aproape toată ziua,
    // umflând artificial costul LIVE mult peste ținta de 75-80/zi.
    //
    // Separat acum: LIVE se interoghează DOAR de la 20 min înainte de
    // kickoff până la 150 min după (durata tipică a unui meci +
    // pauză + prelungiri) — sau dacă ULTIMA stare cunoscută din cache
    // era deja "live" (1H/2H/HT/ET), ca să nu ratăm finalul dacă
    // meciul a întârziat. Restul (lineup/H2H/formă/predicții) rămân
    // pe fereastra largă ±3h — sunt cereri O SINGURĂ DATĂ, ieftine,
    // indiferent de lățimea ferestrei. ──
    const LIVE_WINDOW_BEFORE_MS = 20 * 60 * 1000;
    const LIVE_WINDOW_AFTER_MS = 150 * 60 * 1000;
    const cachedStatusById = {}; // populat mai jos, înainte de secțiunea LIVE

    function isLiveRelevant(m, cachedStatus) {
      const kickoffMs = m.kickoffAt?.toMillis ? m.kickoffAt.toMillis() : null;
      if (!kickoffMs) return false;
      const withinWindow = now >= kickoffMs - LIVE_WINDOW_BEFORE_MS && now <= kickoffMs + LIVE_WINDOW_AFTER_MS;
      const stillLiveInCache = ["1H", "2H", "HT", "ET"].includes(cachedStatus);
      return withinWindow || stillLiveInCache;
    }

    // BUG REPARAT: acest prag global folosea SAFETY_MARGIN (85), oprind
    // ȘI polling-ul LIVE — contrazicea exact cerința "LIVE are
    // prioritate absolută". Acum oprirea completă vine doar la
    // MARGIN_LIVE (98), aproape de limita hard — restul (lineup/H2H/
    // formă/predicții/injuries) rămân protejate individual, mai jos.
    if (quota.requestsUsed >= MARGIN_LIVE) {
      quota.lastSync = now;
      quota.lastError = `Quota aproape epuizată (${quota.requestsUsed}/${DAILY_LIMIT}) — sincronizare oprită pentru azi.`;
      await quotaRef.set(quota, { merge: true });
      return res.status(200).json({ skipped: true, reason: "quota_safety_margin", requestsUsedToday: quota.requestsUsed });
    }

    let apiCallsThisRun = 0;
    const results = { matched: 0, unmatched: 0, ambiguous: 0, live: 0, errors: [] };

    // ── 3. Meciuri nemapate încă → o singură cerere /fixtures?date=
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

    // ── 4. Meciuri deja mapate și DOAR ÎN FEREASTRA LIVE (nu ±3h larg —
    // vezi bug-ul reparat mai sus) → UN SINGUR request batch
    const mappedRelevant = relevant.filter((m) => m.externalFixtureId);
    // Citim starea cache pentru fiecare, ca să aplicăm "stillLiveInCache"
    // (un meci care a intrat în prelungiri nu trebuie abandonat brusc
    // doar pentru că fereastra fixă s-a terminat).
    for (const m of mappedRelevant) {
      const snap = await db.collection("externalFootballCache").doc(String(m.externalFixtureId)).get();
      cachedStatusById[m.externalFixtureId] = snap.exists ? snap.data().status : null;
    }
    const mappedIds = mappedRelevant
      .filter((m) => isLiveRelevant(m, cachedStatusById[m.externalFixtureId]))
      .map((m) => m.externalFixtureId);
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
            const oldSnap = await cacheRef.get();
            const oldSnapshot = oldSnap.exists ? oldSnap.data() : null;
            const delta = detectDelta(oldSnapshot, newSnapshot);

            const ourMatch = relevant.find((m) => m.externalFixtureId === newSnapshot.fixtureId);
            await cacheRef.set({
              ...newSnapshot,
              matchId: ourMatch?.id || null,
              lastDeltaEvents: delta.newEvents,
              lastStatusChange: delta.statusChanged ? { from: oldSnapshot?.status || null, to: newSnapshot.status } : null,
              lastScoreChange: delta.scoreChanged ? { before: delta.oldScore || { home: 0, away: 0 }, after: delta.newScore || { home: newSnapshot.homeScore, away: newSnapshot.awayScore } } : null,
            }, { merge: true }); // merge:true — PĂSTREAZĂ lineup/h2h/form/injuries/apiPrediction scrise de secțiunea Match Intelligence la sincronizări anterioare. lastDeltaEvents etc. tot se suprascriu corect (sunt incluse explicit în fiecare scriere).

            if (["1H", "2H", "HT", "ET"].includes(newSnapshot.status)) results.live++;
          }
        } else {
          results.errors.push(`fixtures?ids=: HTTP ${resp.status}`);
        }
      } catch (err) {
        results.errors.push(`live fetch: ${String(err)}`);
      }
    }

    // ── 5. MATCH INTELLIGENCE — lineups → H2H → form/standings →
    // predictions → injuries, EXACT ordinea de prioritate cerută.
    // Fiecare verifică bugetul ÎNAINTE de apel, sare peste dacă lipsă.
    // Fiecare, o dată/fixture (sau /ligă la standings), cache PERMANENT
    // (nu se reia dacă avem deja — H2H/formă/predicții nu se schimbă
    // în timpul etapei). ──
    //
    // PRAGURI GRADUALE — nu mai folosim UN singur SAFETY_MARGIN pentru
    // toate. Ordinea de tăiere cerută explicit, de jos în sus:
    // injuries → predictions → form → h2h. LINEUP e aproape la fel de
    // protejat ca LIVE (mai ales aproape de kickoff). BUG REPARAT: toate
    // foloseau ACELAȘI prag (85), deci nu exista nicio prioritate reală
    // între ele — se tăiau toate deodată, nu în ordine. ──
    const MARGIN_LINEUP = 95;
    const MARGIN_H2H = 88;
    const MARGIN_FORM = 84;
    const MARGIN_PREDICTIONS = 80;
    const MARGIN_INJURIES = 75; // primul tăiat

    // LINEUP — MAXIM 3 încercări per fixture, în 3 ferestre fixe, ca
    // să nu consume request-uri la infinit dacă lineup-ul întârzie.
    // BUG REPARAT: varianta veche încerca la FIECARE sincronizare cât
    // timp eram în fereastra de 45 min (până la 4-5 încercări reale,
    // nu 1 cum raportasem inițial — găsit corect de tine).
    const LINEUP_WINDOWS = [
      [38, 50],  // încercarea 1 — 38 până la 50 min ÎNAINTE de kickoff
      [18, 30],  // încercarea 2
      [3, 15],   // încercarea 3, ultima șansă
    ];

    const standingsCache = {}; // per leagueId, evită re-fetch pt meciuri din aceeași ligă
    for (const m of relevant.filter((mm) => mm.externalFixtureId)) {
      const cacheRef = db.collection("externalFootballCache").doc(String(m.externalFixtureId));
      const cacheSnap = await cacheRef.get();
      const existing = cacheSnap.exists ? cacheSnap.data() : {};
      const coverage = existing.coverage || null;
      const kickoffMs = m.kickoffAt.toMillis();
      const minutesToKickoff = (kickoffMs - now) / 60000;
      const attempts = existing.lineupAttempts || 0;
      const inAnyLineupWindow = LINEUP_WINDOWS.some(([from, to]) => minutesToKickoff >= from && minutesToKickoff <= to);

      // LINEUP — max 3 încercări, STOP definitiv după primul succes SAU după a 3-a încercare eșuată.
      if (!existing.lineup && attempts < 3 && inAnyLineupWindow && leagueSupports(coverage, "lineups") && quota.requestsUsed + apiCallsThisRun < MARGIN_LINEUP) {
        try {
          const r = await fetch(`https://v3.football.api-sports.io/fixtures/lineups?fixture=${m.externalFixtureId}`, { headers: { "x-apisports-key": API_KEY } });
          apiCallsThisRun++;
          const newAttempts = attempts + 1;
          if (r.ok) {
            const d = await r.json();
            const lineup = normalizeLineup(d.response);
            if (lineup) await cacheRef.set({ lineup, lineupFoundAt: now, lineupAttempts: newAttempts }, { merge: true });
            else await cacheRef.set({ lineupAttempts: newAttempts }, { merge: true }); // 200 OK dar încă gol — numărăm încercarea
          } else {
            await cacheRef.set({ lineupAttempts: newAttempts }, { merge: true });
          }
        } catch (err) {
          results.errors.push(`lineup ${m.id}: ${String(err)}`);
          await cacheRef.set({ lineupAttempts: attempts + 1 }, { merge: true }).catch(() => {});
        }
      }

      // H2H — o singură dată, cache permanent.
      if (!existing.h2h && quota.requestsUsed + apiCallsThisRun < MARGIN_H2H) {
        try {
          const r = await fetch(`https://v3.football.api-sports.io/fixtures/headtohead?h2h=${m.externalFixtureId}`, { headers: { "x-apisports-key": API_KEY } });
          apiCallsThisRun++;
          if (r.ok) {
            const d = await r.json();
            const h2h = normalizeH2H(d.response, m.homeTeam);
            if (h2h) await cacheRef.set({ h2h }, { merge: true });
          }
        } catch (err) { results.errors.push(`h2h ${m.id}: ${String(err)}`); }
      }

      // FORM/STANDINGS — o dată per LIGĂ (reutilizat pt orice alt meci din aceeași ligă azi).
      if (m.externalLeagueId && !existing.form && leagueSupports(coverage, "standings") && quota.requestsUsed + apiCallsThisRun < MARGIN_FORM) {
        try {
          if (!standingsCache[m.externalLeagueId]) {
            const r = await fetch(`https://v3.football.api-sports.io/standings?league=${m.externalLeagueId}&season=${m.externalSeason}`, { headers: { "x-apisports-key": API_KEY } });
            apiCallsThisRun++;
            if (r.ok) { const d = await r.json(); standingsCache[m.externalLeagueId] = normalizeStandings(d.response); }
          }
          const table = standingsCache[m.externalLeagueId];
          if (table) await cacheRef.set({ form: { home: table[m.homeTeam] || null, away: table[m.awayTeam] || null } }, { merge: true });
        } catch (err) { results.errors.push(`standings ${m.id}: ${String(err)}`); }
      }

      // PREDICTIONS API — o singură dată, cache permanent.
      if (!existing.apiPrediction && leagueSupports(coverage, "predictions") && quota.requestsUsed + apiCallsThisRun < MARGIN_PREDICTIONS) {
        try {
          const r = await fetch(`https://v3.football.api-sports.io/predictions?fixture=${m.externalFixtureId}`, { headers: { "x-apisports-key": API_KEY } });
          apiCallsThisRun++;
          if (r.ok) {
            const d = await r.json();
            const pred = normalizePrediction(d.response);
            if (pred) await cacheRef.set({ apiPrediction: pred }, { merge: true });
          }
        } catch (err) { results.errors.push(`predictions ${m.id}: ${String(err)}`); }
      }

      // INJURIES — ultima prioritate, prima tăiată dacă bugetul e strâns.
      if (!existing.injuries && leagueSupports(coverage, "injuries") && quota.requestsUsed + apiCallsThisRun < MARGIN_INJURIES) {
        try {
          const r = await fetch(`https://v3.football.api-sports.io/injuries?fixture=${m.externalFixtureId}`, { headers: { "x-apisports-key": API_KEY } });
          apiCallsThisRun++;
          if (r.ok) { const d = await r.json(); await cacheRef.set({ injuries: normalizeInjuries(d.response) }, { merge: true }); }
        } catch (err) { results.errors.push(`injuries ${m.id}: ${String(err)}`); }
      }
    }

    // ── 6. Quota — actualizată o singură dată, la final. ──
    quota.requestsUsed += apiCallsThisRun;
    quota.lastSync = now;
    if (apiCallsThisRun > 0 && results.errors.length === 0) quota.lastSuccess = now;
    if (results.errors.length > 0) quota.lastError = results.errors[results.errors.length - 1];
    await quotaRef.set(quota, { merge: true });

    return res.status(200).json({
      skipped: false, apiCallsThisRun, requestsUsedToday: quota.requestsUsed, ...results,
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
