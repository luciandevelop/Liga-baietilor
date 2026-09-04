// ══════════════════════════════════════════════════════════════════
// LOGICĂ PURĂ — normalizare, matching, delta detection. Fără fetch,
// fără Firestore — testabilă izolat, cu date mock, fără cheie reală.
// ══════════════════════════════════════════════════════════════════

// ── Normalizare — un obiect fixture API-Football → forma noastră,
// STRICT câmpurile cerute (status/minut/scor/eveniment), fără lineups/
// statistici/cornere (n-avem nevoie, ar fi risipă dacă le-am cere). ──
export function normalizeFixture(f) {
  const events = (f.events || [])
    .filter((e) => ["Goal", "Card"].includes(e.type))
    .map((e) => {
      let type = "GOAL";
      if (e.type === "Card") type = e.detail === "Red Card" ? "RED_CARD" : "CARD";
      else if (e.detail === "Own Goal") type = "OWN_GOAL";
      else if (e.detail === "Penalty") type = "PENALTY_GOAL";
      else if (e.detail === "Missed Penalty") type = "MISSED_PENALTY";
      return {
        id: `${f.fixture.id}_${e.time.elapsed}_${e.type}_${e.player?.id || e.player?.name || "x"}`,
        type, minute: e.time.elapsed, extraMinute: e.time.extra || null,
        team: e.team.name, player: e.player?.name || null, detail: e.detail || null,
      };
    });
  return {
    fixtureId: f.fixture.id,
    status: f.fixture.status.short,
    minute: f.fixture.status.elapsed,
    homeTeam: f.teams.home.name,
    awayTeam: f.teams.away.name,
    homeScore: f.goals.home,
    awayScore: f.goals.away,
    events,
    provider: "api-football",
    updatedAt: Date.now(),
  };
}

// ── Matching meci↔fixture — determinist, NU salvează dacă nu e sigur. ──
function slugTeam(name) {
  return (name || "").toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}
// Inițialele cuvintelor dintr-un nume — "Paris Saint Germain" → "psg".
// Fallback pentru acronime pe care substring-ul simplu nu le prinde
// (bug găsit concret: "PSG" nu apare ca subșir continuu în
// "parissaintgermain", deci potrivirea eșua deși meciul chiar exista).
function nameInitials(name) {
  return (name || "").trim().split(/\s+/).filter(Boolean).map((w) => w[0]).join("").toLowerCase();
}
function teamsLooselyMatch(ourName, apiName) {
  const a = slugTeam(ourName), b = slugTeam(apiName);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  // Fallback pe acronim — în oricare direcție (numele nostru scurt
  // faţă de inițialele celui lung de la API, sau invers).
  return a === nameInitials(apiName) || b === nameInitials(ourName);
}

// candidates = răspunsul API pentru o dată (f.fixture, f.teams etc.)
// match = documentul nostru {homeTeam, awayTeam, kickoffAtMs}
// Întoarce { status: "matched", fixtureId } | { status: "unmatched" } | { status: "ambiguous", candidateIds }
export function matchFixture(match, apiFixturesForDate) {
  const kickoffMs = match.kickoffAtMs;
  const candidates = apiFixturesForDate.filter((f) => {
    const homeOk = teamsLooselyMatch(match.homeTeam, f.teams.home.name);
    const awayOk = teamsLooselyMatch(match.awayTeam, f.teams.away.name);
    if (!homeOk || !awayOk) return false;
    if (kickoffMs) {
      const apiKickoffMs = new Date(f.fixture.date).getTime();
      if (Math.abs(apiKickoffMs - kickoffMs) > 4 * 3600 * 1000) return false; // >4h diferență = sigur nu-i el
    }
    return true;
  });
  if (candidates.length === 0) return { status: "unmatched" };
  if (candidates.length > 1) return { status: "ambiguous", candidateIds: candidates.map((c) => c.fixture.id) };
  return { status: "matched", fixtureId: candidates[0].fixture.id };
}


// ── Delta detection — CRITIC. Compară vechiul snapshot cu cel nou,
// întoarce STRICT ce-i nou (evenimente + tranziții de scor/stare),
// niciodată tot istoricul. ID-uri deterministe (deja pe evenimentul
// normalizat) — reprocesarea aceluiași snapshot => 0 noutăți. ──
export function detectDelta(oldSnapshot, newSnapshot) {
  const delta = { newEvents: [], statusChanged: false, scoreChanged: false };
  if (!oldSnapshot) {
    // Prima dată când vedem fixture-ul — orice eveniment deja petrecut
    // e "nou" din perspectiva noastră (altfel am pierde golurile produse
    // înainte de primul nostru sync), dar NU emitem MATCH_STARTED retroactiv
    // dacă am prins meciul deja în desfășurare.
    delta.newEvents = newSnapshot.events;
    delta.statusChanged = true;
    delta.scoreChanged = newSnapshot.homeScore > 0 || newSnapshot.awayScore > 0;
    delta.isFirstSeen = true;
    return delta;
  }
  const oldEventIds = new Set(oldSnapshot.events.map((e) => e.id));
  delta.newEvents = newSnapshot.events.filter((e) => !oldEventIds.has(e.id));
  delta.statusChanged = oldSnapshot.status !== newSnapshot.status;
  delta.scoreChanged = oldSnapshot.homeScore !== newSnapshot.homeScore || oldSnapshot.awayScore !== newSnapshot.awayScore;
  delta.oldScore = { home: oldSnapshot.homeScore, away: oldSnapshot.awayScore };
  delta.newScore = { home: newSnapshot.homeScore, away: newSnapshot.awayScore };
  return delta;
}

// ── Semantică scor — ÎNAINTE vs DUPĂ, nu doar "gol". ──
export function classifyScoreChange(before, after, scoringTeam) {
  const beforeDiff = before.home - before.away;
  const afterDiff = after.home - after.away;
  if (before.home === 0 && before.away === 0) return "opens"; // deschide scorul
  if (beforeDiff !== 0 && afterDiff === 0) return "equalizer"; // egalare
  if (beforeDiff === 0 && afterDiff !== 0) return "lead_change"; // preia conducerea (dintr-un egal)
  if ((beforeDiff > 0 && afterDiff < 0) || (beforeDiff < 0 && afterDiff > 0)) return "lead_change"; // întoarce scorul
  if (Math.abs(afterDiff) > Math.abs(beforeDiff)) return "extends_lead"; // mărește avantajul
  return "scores"; // generic — a marcat, dar echipa era deja condusă/conduce în continuare la fel
}

// ══════════════════════════════════════════════════════════════════
// MATCH INTELLIGENCE — normalizare pentru lineups/H2H/form/predictions/
// injuries. Fiecare STRICT ce ni-i cerut, fără payload inutil.
// ══════════════════════════════════════════════════════════════════

// /fixtures/lineups → { home: {formation, startingXI:[{name,pos}], coach}, away: {...} }
export function normalizeLineup(apiResponse) {
  if (!apiResponse || apiResponse.length < 2) return null;
  const [home, away] = apiResponse;
  const side = (t) => ({
    formation: t.formation || null,
    coach: t.coach?.name || null,
    startingXI: (t.startXI || []).map((p) => ({ name: p.player.name, pos: p.player.pos, number: p.player.number })),
  });
  return { home: side(home), away: side(away) };
}

// /fixtures/headtohead → { totalMatches, homeWins, awayWins, draws, avgGoals, lastResults:[{date,homeTeam,awayTeam,homeScore,awayScore}] }
export function normalizeH2H(apiResponse, ourHomeTeam) {
  if (!apiResponse || apiResponse.length === 0) return null;
  const last = apiResponse.slice(0, 5);
  let homeWins = 0, awayWins = 0, draws = 0, totalGoals = 0;
  const lastResults = last.map((f) => {
    const hs = f.goals.home, as = f.goals.away;
    totalGoals += (hs ?? 0) + (as ?? 0);
    const homeName = f.teams.home.name;
    if (hs === as) draws++;
    else if ((hs > as && homeName === ourHomeTeam) || (as > hs && homeName !== ourHomeTeam)) homeWins++;
    else awayWins++;
    return { date: f.fixture.date, homeTeam: homeName, awayTeam: f.teams.away.name, homeScore: hs, awayScore: as };
  });
  return { totalMatches: last.length, homeWins, awayWins, draws, avgGoals: last.length ? +(totalGoals / last.length).toFixed(1) : null, lastResults };
}

// /standings → { [teamName]: { rank, form: "WWDLW", points } }
export function normalizeStandings(apiResponse) {
  const out = {};
  const table = apiResponse?.[0]?.league?.standings?.[0] || [];
  for (const row of table) {
    out[row.team.name] = { rank: row.rank, form: row.form || null, points: row.points };
  }
  return out;
}

// /predictions?fixture= → { homePct, drawPct, awayPct, advice }
export function normalizePrediction(apiResponse) {
  const p = apiResponse?.[0]?.predictions;
  if (!p?.percent) return null;
  return {
    homePct: parseInt(p.percent.home), drawPct: parseInt(p.percent.draw), awayPct: parseInt(p.percent.away),
    advice: p.advice || null,
  };
}

// /injuries?fixture= → [{ player, team, reason }]
export function normalizeInjuries(apiResponse) {
  return (apiResponse || []).map((i) => ({ player: i.player.name, team: i.team.name, reason: i.player.reason || null }));
}

// ── Verifică `coverage` — dacă liga nu oferă un anumit tip de date,
// NU tratăm ca eroare, doar sărim peste (Story Engine nu produce
// cardul respectiv pentru meciul ăsta). ──
export function leagueSupports(coverage, feature) {
  if (!coverage) return true; // necunoscut → încercăm, tratăm eșecul normal (nu blocăm optimist)
  const map = { lineups: "lineups", standings: "standings", predictions: "predictions", injuries: "injuries" };
  const key = map[feature];
  return key ? coverage[key] !== false : true;
}
