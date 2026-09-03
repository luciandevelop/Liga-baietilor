// ══════════════════════════════════════════════════════════════════
// CLUB FACTS ENGINE — selecția inteligentă a faptelor de club/oraș/
// competiție pentru Feed, exact conform specificației lui Lu:
//
// 1. Fereastră: 08:00 (ziua meciului) → 23:59:59 (ziua următoare),
//    calculată pe data LOCALĂ (Europe/Bucharest), nu "24h înainte/după".
// 2. MATCHUP FACT (tag pentru AMBELE echipe) > TEAM+opponent context >
//    TEAM FACT > COMPETITION FACT.
// 3. Maximum 1 fapt static per echipă per fereastră (sau 1 MATCHUP care
//    consumă sloturile ambelor echipe deodată).
// 4. exclusiveGroup — variante ale aceleiași povești (Istanbul 2005,
//    93:20 etc.) nu se afișează împreună / recent una după alta.
// 5. Celebrity fans — maxim 1 per echipă per fereastră, alternative
//    între ele (fiecare cu exclusiveGroup propriu, ex ARS_CELEBRITY).
// ══════════════════════════════════════════════════════════════════

const TEAM_SLUG_ALIASES = {
  "arsenal": "arsenal",
  "manchester united": "manchester-united", "man united": "manchester-united", "man utd": "manchester-united", "manchester utd": "manchester-united",
  "liverpool": "liverpool",
  "manchester city": "manchester-city", "man city": "manchester-city",
  "chelsea": "chelsea",
  "tottenham": "tottenham", "tottenham hotspur": "tottenham", "spurs": "tottenham",
  "newcastle": "newcastle", "newcastle united": "newcastle",
  "aston villa": "aston-villa", "villa": "aston-villa",
  "everton": "everton",
  "nottingham forest": "nottingham-forest", "nott'm forest": "nottingham-forest", "forest": "nottingham-forest",
  "crystal palace": "crystal-palace", "palace": "crystal-palace",
  "brighton": "brighton", "brighton & hove albion": "brighton", "brighton and hove albion": "brighton",
  "fulham": "fulham",
  "brentford": "brentford",
  "bournemouth": "bournemouth", "afc bournemouth": "bournemouth",
  "leeds": "leeds", "leeds united": "leeds",
  "sunderland": "sunderland",
  "coventry": "coventry", "coventry city": "coventry",
  "hull": "hull", "hull city": "hull",
  "ipswich": "ipswich", "ipswich town": "ipswich",
  "real madrid": "real-madrid",
  "ac milan": "ac-milan", "milan": "ac-milan",
  "barcelona": "barcelona", "fc barcelona": "barcelona",
  "bayern munchen": "bayern-munchen", "bayern münchen": "bayern-munchen", "bayern": "bayern-munchen",
  "psg": "psg", "paris saint-germain": "psg", "paris saint germain": "psg",
  "juventus": "juventus",
  "inter": "inter", "inter milan": "inter", "internazionale": "inter",
  "atletico madrid": "atletico-madrid", "atlético madrid": "atletico-madrid",
  "ajax": "ajax",
  "porto": "porto", "fc porto": "porto",
  "steaua bucuresti": "steaua-bucuresti", "steaua": "steaua-bucuresti", "fcsb": "steaua-bucuresti",
  "benfica": "benfica",
  "real betis": "real-betis", "betis": "real-betis",
  "rb leipzig": "rb-leipzig",
  "monaco": "monaco", "as monaco": "monaco",
  "qpr": "qpr", "queens park rangers": "qpr",
  "watford": "watford",
  "huddersfield": "huddersfield", "huddersfield town": "huddersfield",
  "west ham": "west-ham", "west ham united": "west-ham",
  "birmingham": "birmingham-city", "birmingham city": "birmingham-city",
  "derby": "derby", "derby county": "derby",
  "sunderland afc": "sunderland",
  "norwich": "norwich", "norwich city": "norwich",
};

export function teamSlugFor(teamName) {
  if (!teamName) return null;
  const normalized = teamName.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return TEAM_SLUG_ALIASES[normalized] || normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ── Fereastra de eligibilitate — 08:00 ziua meciului → 23:59:59 ziua
// următoare, pe data LOCALĂ (Europe/Bucharest), formula EXACTĂ cerută. ──
export function isClubFactWindowActive(kickoffMs, nowMs, timeZone = "Europe/Bucharest") {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  const kickoffDateStr = fmt.format(new Date(kickoffMs)); // "YYYY-MM-DD" local
  const [y, m, d] = kickoffDateStr.split("-").map(Number);
  // Construim windowStart/windowEnd ca UTC ms echivalent orei locale dorite,
  // folosind offsetul zonei la data respectivă (evită probleme DST).
  const localToUtcMs = (year, month, day, hour, minute, second) => {
    // Găsim offsetul TZ la acea dată aproximativă, apoi ajustăm.
    const guessUtc = Date.UTC(year, month - 1, day, hour, minute, second);
    const asLocalStr = new Intl.DateTimeFormat("en-US", {
      timeZone, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).format(new Date(guessUtc));
    const [datePart, timePart] = asLocalStr.split(", ");
    const [mm, dd, yy] = datePart.split("/").map(Number);
    const [hh, mi, ss] = timePart.split(":").map(Number);
    const shownAsLocal = Date.UTC(yy, mm - 1, dd, hh, mi, ss);
    const offsetMs = shownAsLocal - guessUtc;
    return guessUtc - offsetMs;
  };
  const windowStartMs = localToUtcMs(y, m, d, 8, 0, 0);
  const nextDay = new Date(Date.UTC(y, m - 1, d + 1));
  const windowEndMs = localToUtcMs(nextDay.getUTCFullYear(), nextDay.getUTCMonth() + 1, nextDay.getUTCDate(), 23, 59, 59);
  return nowMs >= windowStartMs && nowMs <= windowEndMs;
}

// ── Scor de relevanță — logica din specificație, nu neapărat cifrele
// exacte (Lu a precizat explicit că logica contează, nu numerele). ──
const SCORE = { MATCHUP: 100, TEAM_PLUS_COMPETITION: 70, TEAM: 50, COMPETITION: 30, CITY: 15, CELEBRITY: 10 };
const PENALTY_RECENT_EXCLUSIVE_GROUP = -300;
const PENALTY_RECENTLY_SHOWN = -200;

function scoreFact(fact, homeSlug, awaySlug, history) {
  const tagsSet = new Set(fact.tags);
  let score;
  const isMatchup = tagsSet.has(homeSlug) && tagsSet.has(awaySlug) && fact.club === null;
  if (isMatchup) score = SCORE.MATCHUP;
  else if (fact.club && (tagsSet.has(homeSlug) || tagsSet.has(awaySlug)) && fact.category === "competition") score = SCORE.TEAM_PLUS_COMPETITION;
  else if (fact.club) score = fact.isCelebrity ? SCORE.CELEBRITY : SCORE.TEAM;
  else if (fact.category === "competition") score = SCORE.COMPETITION;
  else score = SCORE.CITY;

  // Bonus dacă e contextual pentru adversarul EXACT din acest meci.
  const opponentSlug = fact.club === homeSlug ? awaySlug : fact.club === awaySlug ? homeSlug : null;
  if (opponentSlug && tagsSet.has(opponentSlug)) score += 40;

  const hist = history[fact.id];
  if (hist?.exclusiveGroupRecentlyUsed) score += PENALTY_RECENT_EXCLUSIVE_GROUP;
  if (hist?.shownCount > 0) score += PENALTY_RECENTLY_SHOWN / (hist.shownCount); // scade tot mai puțin cu cât a trecut mai mult timp de la ultima folosire (aplicat de apelant)
  return { fact, score, isMatchup };
}

// ── Selecție principală — întoarce { matchup: fact|null, home: fact|null, away: fact|null } ──
// `history`: { [factId]: { lastShownAt, shownCount, exclusiveGroupRecentlyUsed } }
export function selectClubFactsForMatch(allFacts, homeTeamName, awayTeamName, history) {
  const homeSlug = teamSlugFor(homeTeamName);
  const awaySlug = teamSlugFor(awayTeamName);

  const eligible = allFacts.filter((f) => !(history[f.id]?.usedInThisWindow));

  // PASUL 1 — MATCHUP FACT (tag pentru ambele echipe, fapt de competiție).
  const matchupCandidates = eligible
    .filter((f) => f.club === null && f.tags.includes(homeSlug) && f.tags.includes(awaySlug))
    .map((f) => scoreFact(f, homeSlug, awaySlug, history))
    .sort((a, b) => b.score - a.score);

  if (matchupCandidates.length > 0 && matchupCandidates[0].score > 0) {
    return { matchup: matchupCandidates[0].fact, home: null, away: null };
  }

  // PASUL 2 — maximum 1 fapt per echipă, prioritizat contextual pe adversar.
  function bestForTeam(teamSlug, otherSlug) {
    const candidates = eligible
      .filter((f) => f.club === teamSlug)
      .map((f) => scoreFact(f, teamSlug === homeSlug ? homeSlug : awaySlug, teamSlug === homeSlug ? awaySlug : homeSlug, history))
      .sort((a, b) => b.score - a.score);
    return candidates.length > 0 ? candidates[0].fact : null;
  }

  const homeFact = bestForTeam(homeSlug, awaySlug);
  const awayFact = bestForTeam(awaySlug, homeSlug);

  // BUG REAL GĂSIT PRIN TESTARE: "North London Derby" există ca fapt
  // SEPARAT în datele Arsenal ȘI în datele Tottenham — aceeași poveste,
  // ID-uri diferite, deci exclusiveGroup nu-l prindea. Exact "două
  // carduri care spun practic aceeași poveste" interzis explicit
  // (regula 26). Dacă titlurile coincid, păstrăm doar unul.
  if (homeFact && awayFact && homeFact.title === awayFact.title) {
    return { matchup: null, home: homeFact, away: null };
  }
  return { matchup: null, home: homeFact, away: awayFact };
}
