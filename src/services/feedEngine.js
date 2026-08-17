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
  MATCH_RESULT: 70,    // rezultat final de meci
  JOKER: 60,           // Joker activat
  UPCOMING_IMPORTANT: 50, // meci important care urmează (ex. Meciul Săptămânii)
  PREVIEW: 35,         // context/analiză despre un meci care urmează
  FUN: 15,
};

// ── prevState: { uid: { rank, points } } — snapshot-ul persistent
// anterior (din feedService.js). currentRows: din listGeneralLeaderboard,
// cu `.rank` deja calculat (index+1) ȘI `.seasonPoints`. ──
export function detectRankChangeEvents(prevState, currentRows) {
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
    const id = `rank_${row.uid}_${before.rank}to${row.rank}`;

    if (becameLeader) {
      const overtakenText = overtaken.length > 0 ? ` — l-a depășit pe ${overtaken.join(" și ")}` : "";
      events.push({
        id, category: FEED_CATEGORIES.CLASAMENT, priority: PRIORITY.RANK_MAXIMA, ts: Date.now(),
        icon: "crown", important: true,
        title: `${row.nickname} este noul lider al clasamentului!${overtakenText}`,
        subtitle: `Locul ${before.rank} → Locul 1`,
        detail: { rankBefore: before.rank, rankAfter: row.rank, pointsBefore, pointsAfter, overtaken },
      });
    } else if (moved > 0) {
      const overtakenText = overtaken.length > 0 ? ` — l-a depășit pe ${overtaken.join(" și ")}` : "";
      events.push({
        id, category: FEED_CATEGORIES.CLASAMENT, priority, ts: Date.now(),
        icon: "up", important: priority === PRIORITY.RANK_MAXIMA,
        title: moved === 1
          ? `${row.nickname} a urcat pe locul ${row.rank}${overtakenText}`
          : `${row.nickname} a urcat ${moved} poziții, de pe locul ${before.rank} pe ${row.rank}${overtakenText}`,
        subtitle: `Locul ${before.rank} → Locul ${row.rank}`,
        detail: { rankBefore: before.rank, rankAfter: row.rank, pointsBefore, pointsAfter, overtaken },
      });
    } else {
      events.push({
        id, category: FEED_CATEGORIES.CLASAMENT, priority, ts: Date.now(),
        icon: "down", important: priority === PRIORITY.RANK_MAXIMA,
        title: Math.abs(moved) === 1
          ? `${row.nickname} a coborât pe locul ${row.rank}`
          : `${row.nickname} a coborât ${Math.abs(moved)} poziții, de pe locul ${before.rank} pe ${row.rank}`,
        subtitle: `Locul ${before.rank} → Locul ${row.rank}`,
        detail: { rankBefore: before.rank, rankAfter: row.rank, pointsBefore, pointsAfter },
      });
    }
  });

  return events.sort((a, b) => b.priority - a.priority);
}

// ── Un meci ajuns la final — singurul eveniment de scor construibil
// onest (aplicația nu ține scor live, gol-cu-gol — verificat în audit). ──
export function buildMatchFinalEvent(match) {
  if (match.realScoreA == null || match.realScoreB == null) return null;
  return {
    id: `match-final_${match.id}`,
    category: FEED_CATEGORIES.MECIURI, priority: PRIORITY.MATCH_RESULT, ts: Date.now(),
    icon: "whistle", important: false,
    title: `${match.homeTeam} ${match.realScoreA}–${match.realScoreB} ${match.awayTeam}`,
    subtitle: "Final de meci",
    detail: {
      competitionName: match.competitionName, status: match.status,
      kickoffAt: match.kickoffAt?.toMillis ? match.kickoffAt.toMillis() : null,
      matchId: match.id,
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

export function mergeFeedEvents(...groups) {
  const all = groups.flat().filter(Boolean);
  return all.sort((a, b) => (b.priority - a.priority) || (b.ts - a.ts));
}
