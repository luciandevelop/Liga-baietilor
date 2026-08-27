// ══════════════════════════════════════════════════════════════════
// FEED ENGINE v2 — transformă date reale (clasament, meciuri, jokeri)
// în evenimente concrete. NIMIC hardcodat — fiecare funcție primește
// date reale ca parametru. Funcții pure, fără Firestore aici — I/O-ul
// real e în feedService.js.
//
// IMPORTANT — ID-uri determinist pe TRANZIȚIE, nu pe timestamp:
// `rank_{uid}_{before}to{after}` — dacă aceeași schimbare exactă e
// detectată de două ori (ex. două device-uri deschid Home aproape
// simultan, înainte ca vreunul să apuce să scrie snapshot-ul nou),
// scrierea a doua e no-op (același ID, Firestore merge). Combinat cu
// snapshot-ul persistent din feedService.js, asta rezolvă exact
// problema semnalată: deduplicare reală, nu doar per-sesiune.
// ══════════════════════════════════════════════════════════════════

export const FEED_CATEGORIES = {
  CLASAMENT: "clasament",
  MECIURI: "meciuri",
  CL: "champions-league",
  LIGA: "liga",
  JOKERI: "jokeri",
  FUN: "fun",
  FOTBAL: "fotbal",
};

// Priorități — ordinea EXACTĂ cerută: clasament > rezultate meciuri >
// jokeri > meciuri importante care urmează > preview/analiză > FUN.
// În interiorul "clasament", păstrez sub-nivelele MAXIMA/MARE (lider
// nou/podium vs intrare în top10/depășire) — tot mai sus decât orice
// altă categorie, dar nu toate schimbările de clasament sunt la fel
// de importante între ele.
export const PRIORITY = {
  RANK_MAXIMA: 100,   // schimbare de lider, intrare/ieșire din TOP 3, salt foarte mare (5+)
  RANK_MARE: 90,       // intrare/ieșire din TOP 10, depășire directă, salt 3-4
  LIVE_EVENT_MAJOR: 73, // gol/eveniment cu greutate reală: prim gol, egalizare, schimbare de lider, gol târziu decisiv
  LIVE_EVENT: 65,      // gol/cartonaș "banal" — extinde un avantaj deja clar, fără să schimbe situația
  MATCH_RESULT: 70,    // rezultat final de meci
  JOKER: 60,           // Joker activat
  UPCOMING_IMPORTANT: 50, // meci important care urmează (ex. Meciul Săptămânii)
  PREVIEW: 35,         // context/analiză despre un meci care urmează
  FUN: 15,
};

// ── prevState: { uid: { rank, points } } — snapshot-ul persistent
// anterior (din feedService.js). currentRows: din listGeneralLeaderboard
// SAU din clasamentul live al etapei (vezi processLiveRankChanges),
// cu `.rank` deja calculat (index+1) ȘI `.seasonPoints`.
// `opts.idPrefix`/`opts.scopeLabel` — permit reutilizarea EXACT a
// acestei funcții pentru sursa de etapă (id-uri separate, ca să nu se
// suprapună cu evenimentele de clasament general), fără nicio schimbare
// de comportament când nu sunt date (implicit = comportamentul vechi,
// neatins). ──
export function detectRankChangeEvents(prevState, currentRows, opts = {}) {
  const idPrefix = opts.idPrefix || "rank";
  const scopeLabel = opts.scopeLabel || "";
  if (!prevState) return []; // primul snapshot care există vreodată — nimic de comparat
  const events = [];

  currentRows.forEach((row) => {
    const before = prevState[row.uid];
    if (!before || before.rank === row.rank) return;
    const moved = before.rank - row.rank; // pozitiv = a urcat
    if (moved === 0) return;

    const enteredTop3 = row.rank <= 3 && before.rank > 3;
    const leftTop3 = row.rank > 3 && before.rank <= 3;
    const enteredTop10 = row.rank <= 10 && before.rank > 10;
    const leftTop10 = row.rank > 10 && before.rank <= 10;
    const becameLeader = row.rank === 1 && before.rank !== 1;
    const hugeJump = Math.abs(moved) >= 5;
    const bigJump = Math.abs(moved) >= 3;

    const worthReporting = becameLeader || enteredTop3 || leftTop3 || enteredTop10 || leftTop10 || bigJump;
    if (!worthReporting) return;

    // Cine a fost depășit — orice jucător care ERA înaintea acestuia
    // (poziție mai bună) și ACUM e în urma lui. Listăm până la 2 nume,
    // ca subtitlul să rămână citibil, nu o înșiruire lungă.
    const overtaken = moved > 0
      ? currentRows
          .filter((other) => {
            const otherBefore = prevState[other.uid];
            if (!otherBefore || other.uid === row.uid) return false;
            return otherBefore.rank < before.rank && other.rank > row.rank;
          })
          .map((other) => other.nickname)
          .slice(0, 2)
      : [];

    const priority = becameLeader || enteredTop3 || leftTop3 || hugeJump ? PRIORITY.RANK_MAXIMA
      : PRIORITY.RANK_MARE;

    const pointsBefore = before.points;
    const pointsAfter = row.seasonPoints;
    const id = `${idPrefix}_${row.uid}_${before.rank}to${row.rank}`;

    if (becameLeader) {
      const overtakenText = overtaken.length > 0 ? ` — l-a depășit pe ${overtaken.join(" și ")}` : "";
      events.push({
        id, category: FEED_CATEGORIES.CLASAMENT, priority: PRIORITY.RANK_MAXIMA, ts: Date.now(),
        icon: "crown", important: true,
        title: `${row.nickname} este noul lider al clasamentului${scopeLabel}!${overtakenText}`,
        subtitle: `Locul ${before.rank} → Locul 1`,
        detail: { rankBefore: before.rank, rankAfter: row.rank, pointsBefore, pointsAfter, overtaken },
      });
    } else if (moved > 0) {
      const overtakenText = overtaken.length > 0 ? ` — l-a depășit pe ${overtaken.join(" și ")}` : "";
      events.push({
        id, category: FEED_CATEGORIES.CLASAMENT, priority, ts: Date.now(),
        icon: "up", important: priority === PRIORITY.RANK_MAXIMA,
        title: moved === 1
          ? `${row.nickname} a urcat pe locul ${row.rank}${scopeLabel}${overtakenText}`
          : `${row.nickname} a urcat ${moved} poziții${scopeLabel}, de pe locul ${before.rank} pe ${row.rank}${overtakenText}`,
        subtitle: `Locul ${before.rank} → Locul ${row.rank}`,
        detail: { rankBefore: before.rank, rankAfter: row.rank, pointsBefore, pointsAfter, overtaken },
      });
    } else {
      events.push({
        id, category: FEED_CATEGORIES.CLASAMENT, priority, ts: Date.now(),
        icon: "down", important: priority === PRIORITY.RANK_MAXIMA,
        title: Math.abs(moved) === 1
          ? `${row.nickname} a coborât pe locul ${row.rank}${scopeLabel}`
          : `${row.nickname} a coborât ${Math.abs(moved)} poziții${scopeLabel}, de pe locul ${before.rank} pe ${row.rank}`,
        subtitle: `Locul ${before.rank} → Locul ${row.rank}`,
        detail: { rankBefore: before.rank, rankAfter: row.rank, pointsBefore, pointsAfter },
      });
    }
  });

  return events.sort((a, b) => b.priority - a.priority);
}

// ── Un meci ajuns la final — scorul, PLUS cine a nimerit scorul exact
// (dacă cineva a nimerit) — sursa e matchPoints (scorePoints===120),
// aceeași colecție folosită peste tot în aplicație pentru scoring, nu
// predicțiile brute recitite separat. `exactScorers` = listă de
// nickname-uri, calculată de apelant (feedService.js — are nevoie de
// Firestore, funcția asta rămâne pură). ──
export function buildMatchFinalEvent(match, exactScorers = []) {
  if (match.realScoreA == null || match.realScoreB == null) return null;
  const scorersText = exactScorers.length === 0
    ? "Final de meci"
    : exactScorers.length === 1
      ? `🎯 ${exactScorers[0]} a nimerit scorul exact!`
      : exactScorers.length <= 3
        ? `🎯 ${exactScorers.join(", ")} au nimerit scorul exact!`
        : `🎯 ${exactScorers.slice(0, 2).join(", ")} și încă ${exactScorers.length - 2} au nimerit scorul exact!`;
  return {
    id: `match-final_${match.id}`,
    category: FEED_CATEGORIES.MECIURI, priority: PRIORITY.MATCH_RESULT, ts: Date.now(),
    icon: "whistle", important: exactScorers.length > 0,
    title: `${match.homeTeam} ${match.realScoreA}–${match.realScoreB} ${match.awayTeam}`,
    subtitle: scorersText,
    detail: {
      competitionName: match.competitionName, status: match.status,
      kickoffAt: match.kickoffAt?.toMillis ? match.kickoffAt.toMillis() : null,
      matchId: match.id, exactScorers,
    },
  };
}

// ── Joker activat — date reale, niciodată generic. Include tot ce
// există în date (competiție, moment, status meci) — nimic inventat
// dacă lipsește (multiplicatorul e mereu ×2, singura constantă
// cunoscută din regulile jocului, nu o presupunere). ──
export function buildJokerEvent(joker, match, nickname) {
  if (!match) return null;
  return {
    id: `joker_${joker.gameweekId}_${joker.userId}`,
    category: FEED_CATEGORIES.JOKERI, priority: PRIORITY.JOKER, ts: Date.now(),
    icon: "joker", important: false,
    title: `${nickname} a activat Jokerul pe ${match.homeTeam} – ${match.awayTeam}`,
    detail: {
      competitionName: match.competitionName, multiplier: "×2", matchStatus: match.status,
      matchId: match.id, gameweekId: joker.gameweekId,
    },
  };
}

// ── Meci care urmează — REGULA ZERO: apare doar dacă e chiar un meci
// real, programat, din datele aplicației (matches, status "scheduled").
// Niciun articol de club de sine stătător — orice fragment editorial
// atașat aici (`editorialSnippets`) e STRICT legat de echipele din
// ACEST meci, dispare din Feed când meciul nu mai e relevant (a
// început/s-a terminat).
//
// isImportant = e Meciul Săptămânii (Punctaj Dublu) -> prioritate mai
// mare (UPCOMING_IMPORTANT), altfel doar PREVIEW.
export function buildUpcomingMatchEvent(match, editorialSnippets, isImportant) {
  return {
    id: `upcoming_${match.id}`,
    category: FEED_CATEGORIES.MECIURI, priority: isImportant ? PRIORITY.UPCOMING_IMPORTANT : PRIORITY.PREVIEW,
    ts: Date.now(), icon: isImportant ? "star" : "whistle", important: isImportant,
    title: isImportant
      ? `${match.homeTeam} – ${match.awayTeam}: Meciul Săptămânii (Punctaj Dublu)`
      : `${match.homeTeam} – ${match.awayTeam}`,
    subtitle: match.competitionName || null,
    detail: {
      competitionName: match.competitionName, matchId: match.id,
      kickoffAt: match.kickoffAt?.toMillis ? match.kickoffAt.toMillis() : null,
      editorialSnippets: editorialSnippets || [],
    },
  };
}

// ── Eveniment LIVE (gol / cartonaș roșu) — introdus MANUAL de admin, în
// timp real, cât meciul se joacă. Date reale, nu inventate: minutul,
// tipul și echipa vin exact din ce a scris admin, nimic presupus sau
// generat automat. ID determinist pe evenimentul propriu-zis (nu pe
// timestamp) — reprocesarea aceluiași eveniment nu-l dublează. ──
export function buildLiveMatchEvent(match, event) {
  const teamName = event.team === "home" ? match.homeTeam : match.awayTeam;
  // Scor calculat PROGRESIV din golurile deja marcate până la (și inclusiv)
  // acest eveniment — NU din match.realScoreA/B curent. Motiv real, găsit
  // la testare: Admin adaugă adesea marcatorul ÎNAINTE să incrementeze
  // scorul din stepper, deci snapshot-ul "curent" arăta 0-0 chiar și după
  // 2-3 goluri deja introduse. Calculul de aici e corect indiferent de
  // ordinea în care Admin apasă butoanele.
  const allGoals = (match.matchEvents || []).filter((e) => e.type === "goal");
  const goalsUpToNow = allGoals.filter((g) => g.minute < event.minute || (g.minute === event.minute && g.id <= event.id));
  const scoreA = goalsUpToNow.filter((g) => g.team === "home").length;
  const scoreB = goalsUpToNow.filter((g) => g.team === "away").length;
  const scoreLine = ` · ${match.homeTeam} ${scoreA}-${scoreB} ${match.awayTeam}`;

  if (event.type === "goal") {
    // ── Context narativ — nu doar "GOL! X (Echipă)" sec. Calculat din
    // scorul ÎNAINTE de acest gol (progresiv, aceeași sursă ca mai sus),
    // ca să știm dacă deschide scorul, egalează, aduce în avantaj sau
    // doar mărește diferența deja existentă. Variante multiple per
    // situație, ca Feed-ul să nu sune identic la fiecare gol. ──
    const beforeA = scoreA - (event.team === "home" ? 1 : 0);
    const beforeB = scoreB - (event.team === "away" ? 1 : 0);
    const wasTied = beforeA === beforeB;
    const teamWasBehind = event.team === "home" ? beforeA < beforeB : beforeB < beforeA;
    const nowTied = scoreA === scoreB;
    const late = event.minute >= 85;

    let phrase;
    let goalIsImportant;
    if (beforeA === 0 && beforeB === 0) {
      phrase = pick([`deschide scorul`, `punctează primul`, `trece echipa în avantaj de la 0-0`]);
      goalIsImportant = true; // primul gol al meciului contează mereu
    } else if (wasTied) {
      phrase = pick([`aduce ${teamName} în avantaj`, `trece ${teamName} în frunte`, `duce ${teamName} în avantaj`]);
      goalIsImportant = true; // schimbare de lider pe tabelă — mereu relevant
    } else if (teamWasBehind && nowTied) {
      phrase = late
        ? pick([`egalează dramatic, aproape de final`, `restabilește egalitatea în prelungiri`])
        : pick([`egalează pentru ${teamName}`, `readuce ${teamName} la egalitate`]);
      goalIsImportant = true; // egalizare — mereu relevantă
    } else if (teamWasBehind) {
      phrase = pick([`reduce din diferență pentru ${teamName}`, `apropie ${teamName} pe tabelă`]);
      goalIsImportant = late; // relevant doar dacă vine târziu, altfel gol banal
    } else {
      phrase = late
        ? pick([`sigilează victoria pentru ${teamName}`, `închide meciul în prelungiri`])
        : pick([`mărește avantajul lui ${teamName}`, `dublează diferența pentru ${teamName}`, `își continuă recitalul ${teamName}`]);
      goalIsImportant = late; // extinde un avantaj deja clar — banal, exceptând finalul de meci
    }

    return {
      id: `liveevent_${event.id}`,
      category: FEED_CATEGORIES.MECIURI, priority: goalIsImportant ? PRIORITY.LIVE_EVENT_MAJOR : PRIORITY.LIVE_EVENT, ts: Date.now(),
      icon: "goal", important: goalIsImportant,
      title: event.player ? `⚽ ${event.player} ${phrase}` : `⚽ ${teamName} ${phrase}`,
      subtitle: `Minutul ${event.minute}${scoreLine}`,
      detail: { competitionName: match.competitionName, matchId: match.id, minute: event.minute, team: event.team, player: event.player || null },
    };
  }
  if (event.type === "red_card") {
    return {
      id: `liveevent_${event.id}`,
      category: FEED_CATEGORIES.MECIURI, priority: PRIORITY.LIVE_EVENT_MAJOR, ts: Date.now(),
      icon: "redcard", important: true,
      title: event.player ? `🟥 Cartonaș roșu — ${event.player} (${teamName})` : `🟥 Cartonaș roșu — ${teamName}`,
      subtitle: `Minutul ${event.minute}${scoreLine}`,
      detail: { competitionName: match.competitionName, matchId: match.id, minute: event.minute, team: event.team, player: event.player || null },
    };
  }
  return null;
}

// Alegere determinist-variată — bazată pe id-ul evenimentului, nu Math.random()
// (același gol arată mereu identic la re-randare, dar goluri diferite nu
// sună toate la fel).
function pick(options) {
  let hash = 0;
  for (let i = 0; i < options.length; i++) hash = (hash + options[i].length) % 997;
  return options[hash % options.length];
}

// ── Anti-spam — regula 4 din audit: nu îngropăm Feed-ul în goluri
// banale ale aceluiași meci. Evenimentele IMPORTANTE (prim gol,
// egalizare, schimbare de lider, cartonaș roșu, gol târziu decisiv)
// rămân ÎNTOTDEAUNA — doar golurile "banale" (extinde un avantaj deja
// clar, fără context) se limitează la maximum 2 per meci, păstrând cele
// mai recente. Filtrare DOAR la afișare — nu șterge nimic din Firestore,
// deci nimic nu se pierde dacă regulile de importanță se rafinează mai
// târziu. ──
export function mergeFeedEvents(...groups) {
  const all = groups.flat().filter(Boolean);
  const sorted = all.sort((a, b) => (b.priority - a.priority) || (b.ts - a.ts));

  const routineGoalCountByMatch = {};
  const result = [];
  for (const ev of sorted) {
    const isRoutineGoal = ev.category === FEED_CATEGORIES.MECIURI && ev.icon === "goal" && !ev.important;
    if (isRoutineGoal) {
      const mid = ev.detail?.matchId || "unknown";
      routineGoalCountByMatch[mid] = (routineGoalCountByMatch[mid] || 0) + 1;
      if (routineGoalCountByMatch[mid] > 2) continue;
    }
    result.push(ev);
  }
  return result;
}
