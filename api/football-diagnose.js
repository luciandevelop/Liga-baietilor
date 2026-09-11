// ══════════════════════════════════════════════════════════════════
// api/football-diagnose.js — "🔄 Verifică API meciurile", apelat DOAR
// din Admin (buton, on-demand, NU automat). Autentificare ca la
// football-test.js — tokenul Firebase al userului conectat, verificat
// admin via admins/{uid} (același criteriu ca regula Firestore).
//
// STRICT mapping — descoperă fixtureId pentru meciurile care NU au
// încă unul. NU face live polling (asta rămâne treaba football-sync.js,
// automat, la 5 minute). NU reîncearcă meciurile deja conectate — 0
// request API pentru ele, doar raportate din ce au deja salvat.
//
// Folosește ACEEAȘI logică de matching (matchFixture, footballLogic.js)
// și ACELAȘI contor de cotă zilnică (externalFootballCache/_quota) ca
// football-sync.js — nu există două surse de adevăr pentru consum.
// ══════════════════════════════════════════════════════════════════
import { getAdminDb } from "./_lib/firebaseAdmin.js";
import { getAuth } from "firebase-admin/auth";
import { matchFixture } from "./_lib/footballLogic.js";

export default async function handler(req, res) {
  const authHeader = req.headers["authorization"];
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ error: "lipsă token" });

  const db = getAdminDb();
  let uid;
  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    uid = decoded.uid;
  } catch {
    return res.status(401).json({ error: "token invalid" });
  }
  const adminSnap = await db.collection("admins").doc(uid).get();
  if (!adminSnap.exists) return res.status(403).json({ error: "doar admin" });

  const API_KEY = process.env.API_FOOTBALL_KEY;
  if (!API_KEY) return res.status(500).json({ error: "API_FOOTBALL_KEY nu e configurată" });

  const gameweekId = req.query?.gameweekId || (req.body && req.body.gameweekId);
  if (!gameweekId) return res.status(400).json({ error: "gameweekId lipsă" });

  const todayKey = new Date().toISOString().slice(0, 10);

  try {
    // ── Cotă COMUNĂ cu football-sync.js — un verificat manual + un run
    // automat, în aceeași zi, nu pot depăși împreună limita reală. ──
    const quotaRef = db.collection("externalFootballCache").doc("_quota");
    const quotaSnap = await quotaRef.get();
    let quota = quotaSnap.exists ? quotaSnap.data() : null;
    if (!quota || quota.date !== todayKey) {
      quota = { date: todayKey, requestsUsed: 0, lastSync: null, lastSuccess: null, lastError: null };
    }

    const matchesSnap = await db.collection("matches").where("gameweekId", "==", gameweekId).get();
    const allMatches = matchesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const already = allMatches.filter((m) => m.externalFixtureId);
    const toCheck = allMatches.filter((m) => !m.externalFixtureId && m.kickoffAt);

    const uniqueDates = [...new Set(toCheck.map((m) => new Date(m.kickoffAt.toMillis()).toISOString().slice(0, 10)))];
    let apiCallsUsed = 0;
    const results = [];

    for (const date of uniqueDates) {
      if (quota.requestsUsed + apiCallsUsed >= 95) break; // margine de siguranță, ca la sincronizarea automată
      const matchesForDate = toCheck.filter((mm) => new Date(mm.kickoffAt.toMillis()).toISOString().slice(0, 10) === date);
      let candidatesForDate = [];
      try {
        const resp = await fetch(`https://v3.football.api-sports.io/fixtures?date=${date}`, { headers: { "x-apisports-key": API_KEY } });
        apiCallsUsed++;
        if (resp.ok) {
          const data = await resp.json();
          candidatesForDate = data.response || [];
        } else {
          for (const m of matchesForDate) results.push({ matchId: m.id, homeTeam: m.homeTeam, awayTeam: m.awayTeam, status: "ERROR", error: `HTTP ${resp.status}` });
          continue;
        }
      } catch (err) {
        for (const m of matchesForDate) results.push({ matchId: m.id, homeTeam: m.homeTeam, awayTeam: m.awayTeam, status: "ERROR", error: String(err) });
        continue;
      }

      for (const m of matchesForDate) {
        const matchResult = matchFixture({ homeTeam: m.homeTeam, awayTeam: m.awayTeam, kickoffAtMs: m.kickoffAt.toMillis() }, candidatesForDate);
        if (matchResult.status === "matched") {
          const matchedFixture = candidatesForDate.find((c) => c.fixture.id === matchResult.fixtureId);
          await db.collection("matches").doc(m.id).set({
            externalFixtureId: matchResult.fixtureId, externalProvider: "api-football",
            externalLeagueId: matchedFixture?.league?.id || null, externalSeason: matchedFixture?.league?.season || null,
            externalFixtureHomeTeam: matchedFixture?.teams?.home?.name || null,
            externalFixtureAwayTeam: matchedFixture?.teams?.away?.name || null,
            externalFixtureDate: matchedFixture?.fixture?.date || null,
          }, { merge: true });
          results.push({
            matchId: m.id, homeTeam: m.homeTeam, awayTeam: m.awayTeam, status: "CONNECTED",
            fixtureId: matchResult.fixtureId,
            apiHomeTeam: matchedFixture?.teams?.home?.name || null,
            apiAwayTeam: matchedFixture?.teams?.away?.name || null,
            apiDate: matchedFixture?.fixture?.date || null,
          });
        } else if (matchResult.status === "ambiguous") {
          await db.collection("externalFootballCache").doc(`_diagnostic_${m.id}`).set({ matchId: m.id, status: "AMBIGUOUS", candidateIds: matchResult.candidateIds, checkedAt: Date.now() }, { merge: true });
          results.push({ matchId: m.id, homeTeam: m.homeTeam, awayTeam: m.awayTeam, status: "AMBIGUOUS", candidateIds: matchResult.candidateIds });
        } else {
          await db.collection("externalFootballCache").doc(`_diagnostic_${m.id}`).set({ matchId: m.id, status: "UNMATCHED", checkedAt: Date.now() }, { merge: true });
          results.push({ matchId: m.id, homeTeam: m.homeTeam, awayTeam: m.awayTeam, status: "UNMATCHED" });
        }
      }
    }

    // ── Meciurile deja conectate — raportate din ce au deja salvat,
    // ZERO request API pentru ele (cerut explicit: nu remapăm inutil). ──
    for (const m of already) {
      results.push({
        matchId: m.id, homeTeam: m.homeTeam, awayTeam: m.awayTeam, status: "CONNECTED",
        fixtureId: m.externalFixtureId,
        apiHomeTeam: m.externalFixtureHomeTeam || null,
        apiAwayTeam: m.externalFixtureAwayTeam || null,
        apiDate: m.externalFixtureDate || null,
        alreadyMapped: true,
      });
    }

    quota.requestsUsed += apiCallsUsed;
    quota.lastSync = Date.now();
    await quotaRef.set(quota, { merge: true });

    return res.status(200).json({
      totalMatches: allMatches.length,
      alreadyMapped: already.length,
      checkedNow: toCheck.length,
      apiRequestsUsed: apiCallsUsed,
      requestsUsedToday: quota.requestsUsed,
      results,
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
