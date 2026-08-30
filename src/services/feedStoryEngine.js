// ══════════════════════════════════════════════════════════════════
// STORY ENGINE v4 — strat conceptual PESTE feedEngine.js (v3):
//   RAW EVENTS → CONTEXT → STORY DETECTION → IMPORTANCE → AGGREGATION
//   → NARRATIVE → FEED
//
// v3 (feedEngine.js) rămâne sursa pentru evenimente de bază (schimbare
// de rank, meci final, gol live) — NU rescris aici. Acest fișier
// adaugă STRAT DE MEMORIE (ce s-a întâmplat mai devreme în etapă) și
// POVEȘTI DERIVATE din acea memorie: momentum, comeback/collapse,
// streak-uri, rivalități, poveste de lider/podium/coadă, recap,
// preview meci, dedup semantic, buget editorial.
//
// Toate funcțiile de-aici sunt PURE (primesc memoria + date curente,
// întorc memoria nouă + evenimente noi) — I/O-ul (citit/scris
// feedState/stageMemory) rămâne exclusiv în feedService.js.
// ══════════════════════════════════════════════════════════════════
import { IMPORTANCE as V3_IMPORTANCE, pick, pickAvoiding } from "./feedEngine";
import { canRevealPredictions } from "./matchLockRule";

export const SCHEMA_VERSION = 2;
export const ENGINE_VERSION = 4;

export const IMPORTANCE = {
  ...V3_IMPORTANCE,
  COMEBACK: 92, COLLAPSE: 88,
  LEADER_RETURN: 97, LEADER_CHANGE_COUNT: 65,
  MOMENTUM: 62, STREAK_EXACT: 68, STREAK_RISE: 60, STREAK_FALL: 58, STREAK_ZERO: 57,
  TIGHT_BATTLE: 66, RIVALRY_SWAP: 64,
  CONSENSUS_UPSET: 79, LONE_WOLF_SUCCESS: 77, LONE_WOLF_FAIL: 42,
  RECAP: 100, MATCH_PREVIEW: 55,
  PODIUM_SHUFFLE: 82, BOTTOM_ESCAPE: 63, BOTTOM_TAKEOVER: 61,
  RECORD_SO_FAR: 66,
};

const THRESH = {
  STREAK_RISE_MIN: 3, STREAK_FALL_MIN: 3, STREAK_EXACT_MIN: 2, STREAK_ZERO_MIN: 3,
  COMEBACK_MIN_RANGE: 6, COLLAPSE_MIN_RANGE: 6,
  TIGHT_TOP3_POINTS: 15, TIGHT_BOTTOM3_POINTS: 15,
  RIVALRY_MIN_SWAPS: 2, RIVALRY_MAX_GAP: 20,
  CONSENSUS_UPSET_MIN_SHARE: 0.7,
};

export function emptyStageMemory(gameweekId) {
  return {
    gameweekId, schemaVersion: SCHEMA_VERSION,
    leaderHistory: [], matchesProcessed: 0, byUid: {}, recapGenerated: false,
    swapPairs: {}, updatedAt: Date.now(),
  };
}

function ensureUserSlot(mem, uid) {
  if (!mem.byUid[uid]) mem.byUid[uid] = { bestRank: null, worstRank: null, currentRank: null, riseStreak: 0, fallStreak: 0, exactStreak: 0, zeroStreak: 0, exactCountTotal: 0 };
  return mem.byUid[uid];
}

export function updateStageMemoryWithRanking(mem, rows) {
  const next = { ...mem, byUid: { ...mem.byUid }, leaderHistory: [...mem.leaderHistory], swapPairs: { ...mem.swapPairs } };
  next.matchesProcessed += 1;

  const currentLeader = rows.find((r) => r.rank === 1);
  const lastLeader = next.leaderHistory[next.leaderHistory.length - 1];
  if (currentLeader && (!lastLeader || lastLeader.uid !== currentLeader.uid)) {
    next.leaderHistory.push({ uid: currentLeader.uid, nickname: currentLeader.nickname, atMatchIndex: next.matchesProcessed });
  }

  rows.forEach((row) => {
    const slot = ensureUserSlot(next, row.uid);
    const prevRank = slot.currentRank;
    slot.bestRank = slot.bestRank == null ? row.rank : Math.min(slot.bestRank, row.rank);
    slot.worstRank = slot.worstRank == null ? row.rank : Math.max(slot.worstRank, row.rank);
    if (prevRank != null) {
      if (row.rank < prevRank) { slot.riseStreak += 1; slot.fallStreak = 0; }
      else if (row.rank > prevRank) { slot.fallStreak += 1; slot.riseStreak = 0; }
      else { slot.riseStreak = 0; slot.fallStreak = 0; }
    }
    slot.currentRank = row.rank;
  });

  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i], b = rows[j];
      if (Math.abs((a.seasonPoints ?? 0) - (b.seasonPoints ?? 0)) > THRESH.RIVALRY_MAX_GAP) continue;
      const key = [a.uid, b.uid].sort().join("|");
      const prevA = mem.byUid[a.uid]?.currentRank, prevB = mem.byUid[b.uid]?.currentRank;
      if (prevA == null || prevB == null) continue;
      const wasAAhead = prevA < prevB;
      const isAAhead = a.rank < b.rank;
      if (wasAAhead !== isAAhead) next.swapPairs[key] = (next.swapPairs[key] || 0) + 1;
    }
  }

  next.updatedAt = Date.now();
  return next;
}

export function updateStageMemoryWithMatchScoring(mem, exactUids, zeroUids) {
  const next = { ...mem, byUid: { ...mem.byUid } };
  const exactSet = new Set(exactUids), zeroSet = new Set(zeroUids);
  const allTouched = new Set([...exactUids, ...zeroUids]);
  allTouched.forEach((uid) => {
    const slot = ensureUserSlot(next, uid);
    if (exactSet.has(uid)) { slot.exactStreak += 1; slot.exactCountTotal += 1; slot.zeroStreak = 0; }
    else if (zeroSet.has(uid)) { slot.zeroStreak += 1; slot.exactStreak = 0; }
  });
  Object.keys(next.byUid).forEach((uid) => {
    if (!allTouched.has(uid)) next.byUid[uid] = { ...next.byUid[uid], exactStreak: 0, zeroStreak: 0 };
  });
  return next;
}

export function detectLeaderStory(mem, rows) {
  const events = [];
  const leader = rows.find((r) => r.rank === 1);
  if (!leader) return events;
  const history = mem.leaderHistory;
  const wasLeaderBefore = history.some((h) => h.uid === leader.uid);
  const justBecameLeader = history.length === 0 || history[history.length - 1].uid !== leader.uid;

  if (justBecameLeader && wasLeaderBefore && history.length > 1) {
    const id = `story_leaderreturn_${mem.gameweekId}_${leader.uid}_${mem.matchesProcessed + 1}`;
    events.push(mkStory(id, "leader_story", "leader_return", IMPORTANCE.LEADER_RETURN, [leader.uid],
      pick([`👑 ${leader.nickname} revine pe primul loc etapei.`, `👑 ${leader.nickname} recuperează fruntea clasamentului.`], id),
      null, { leaderCount: history.length }));
  } else if (justBecameLeader && history.length >= 4) {
    const id = `story_leadercount_${mem.gameweekId}_${history.length}`;
    events.push(mkStory(id, "leader_story", "leader_count", IMPORTANCE.LEADER_CHANGE_COUNT, [leader.uid],
      pick([`👑 Al ${ordinalRo(history.length)} lider diferit al serii.`], id), null, { count: history.length }));
  }

  const second = rows.find((r) => r.rank === 2);
  if (second) {
    const gap = (leader.seasonPoints ?? 0) - (second.seasonPoints ?? 0);
    if (gap >= 25) {
      const id = `story_leadgap_${mem.gameweekId}_${mem.matchesProcessed + 1}_big`;
      events.push(mkStory(id, "leader_story", "leader_detach", IMPORTANCE.RANK_MAXIMA, [leader.uid],
        pick([`🏃 ${leader.nickname} se desprinde: +${gap} față de locul 2.`, `🏃 ${leader.nickname} începe să fugă de restul: avans de ${gap}p.`], id), null, { gap }));
    } else if (gap <= 3) {
      const id = `story_leadgap_${mem.gameweekId}_${mem.matchesProcessed + 1}_tight`;
      events.push(mkStory(id, "leader_story", "leader_threatened", IMPORTANCE.TIGHT_BATTLE, [leader.uid, second.uid],
        pick([`🚨 ${leader.nickname} mai are doar ${gap}p avans față de ${second.nickname}.`], id), null, { gap }));
    }
  }
  return events;
}

export function detectPodiumStory(mem, rows) {
  const events = [];
  const podiumUids = rows.filter((r) => r.rank <= 3).map((r) => r.uid).sort();
  const prevPodium = Object.entries(mem.byUid).filter(([, s]) => s.currentRank != null && s.currentRank <= 3).map(([uid]) => uid).sort();
  const changedCount = podiumUids.filter((u) => !prevPodium.includes(u)).length;
  // Reshuffle = cel puțin 2 din 3 locuri schimbate — exemplul cerut
  // explicit (1:A→2:A rămâne, dar B și C sunt înlocuiți de D și E)
  // ar trebui să conteze drept "modificat masiv", nu doar cazul rar în
  // care TOȚI 3 sunt complet noi.
  if (prevPodium.length === 3 && changedCount >= 2) {
    const id = `story_podiumshuffle_${mem.gameweekId}_${mem.matchesProcessed + 1}`;
    events.push(mkStory(id, "podium_story", "podium_reshuffle", IMPORTANCE.PODIUM_SHUFFLE, podiumUids,
      pick([`🔥 Podiumul s-a schimbat complet.`, `🔥 Podium aproape complet nou.`], id), null, { podiumUids, changedCount }));
  }
  const p1 = rows.find((r) => r.rank === 1), p3 = rows.find((r) => r.rank === 3);
  if (p1 && p3 && (p1.seasonPoints ?? 0) - (p3.seasonPoints ?? 0) <= THRESH.TIGHT_TOP3_POINTS) {
    const id = `story_podiumtight_${mem.gameweekId}_${mem.matchesProcessed + 1}`;
    events.push(mkStory(id, "podium_story", "podium_tight", IMPORTANCE.TIGHT_BATTLE, rows.filter((r) => r.rank <= 3).map((r) => r.uid),
      pick([`🔥 Nebunie în față: primii trei sunt despărțiți de doar ${(p1.seasonPoints ?? 0) - (p3.seasonPoints ?? 0)}p.`], id), null, {}));
  }
  return events;
}

export function detectBottomStory(mem, rows) {
  const events = [];
  const total = rows.length;
  const last = rows.find((r) => r.rank === total);
  const prevLastEntry = Object.entries(mem.byUid).find(([, s]) => s.currentRank === total);
  if (last && prevLastEntry && prevLastEntry[0] !== last.uid) {
    const escapee = rows.find((r) => r.uid === prevLastEntry[0]);
    const idEscape = `story_bottomescape_${mem.gameweekId}_${prevLastEntry[0]}_${mem.matchesProcessed + 1}`;
    if (escapee) events.push(mkStory(idEscape, "bottom_story", "escape_last", IMPORTANCE.BOTTOM_ESCAPE, [escapee.uid],
      pick([`🪦 ${escapee.nickname} scapă în sfârșit de ultimul loc.`], idEscape), null, {}));
    const idTake = `story_bottomtake_${mem.gameweekId}_${last.uid}_${mem.matchesProcessed + 1}`;
    events.push(mkStory(idTake, "bottom_story", "bottom_takeover", IMPORTANCE.BOTTOM_TAKEOVER, [last.uid],
      pick([`🚨 ${last.nickname} preia lanterna roșie.`], idTake), null, {}));
  }
  const bottom3 = rows.filter((r) => r.rank > total - 3);
  if (bottom3.length === 3) {
    const spread = Math.max(...bottom3.map((r) => r.seasonPoints ?? 0)) - Math.min(...bottom3.map((r) => r.seasonPoints ?? 0));
    if (spread <= THRESH.TIGHT_BOTTOM3_POINTS) {
      const id = `story_bottomtight_${mem.gameweekId}_${mem.matchesProcessed + 1}`;
      events.push(mkStory(id, "bottom_story", "bottom_battle", IMPORTANCE.TIGHT_BATTLE, bottom3.map((r) => r.uid),
        pick([`🥊 Ultimii trei sunt despărțiți de doar ${spread}p. Lupta e aprigă și acolo.`], id), null, {}));
    }
  }
  return events;
}

export function detectMomentumAndStreaks(mem, rows) {
  const events = [];
  rows.forEach((row) => {
    const slot = mem.byUid[row.uid];
    if (!slot) return;
    if (slot.riseStreak >= THRESH.STREAK_RISE_MIN) {
      const id = `story_risestreak_${mem.gameweekId}_${row.uid}_${slot.riseStreak}`;
      events.push(mkStory(id, "momentum", "rise_streak", IMPORTANCE.STREAK_RISE, [row.uid],
        pick([`🔥 ${row.nickname} e omul momentului: urcă de ${slot.riseStreak} meciuri la rând.`], id), null, { streak: slot.riseStreak }));
    }
    if (slot.fallStreak >= THRESH.STREAK_FALL_MIN) {
      const id = `story_fallstreak_${mem.gameweekId}_${row.uid}_${slot.fallStreak}`;
      events.push(mkStory(id, "momentum", "fall_streak", IMPORTANCE.STREAK_FALL, [row.uid],
        pick([`🧊 ${row.nickname} n-a mai câștigat teren de ${slot.fallStreak} meciuri.`], id), null, { streak: slot.fallStreak }));
    }
    if (slot.exactStreak >= THRESH.STREAK_EXACT_MIN) {
      const id = `story_exactstreak_${mem.gameweekId}_${row.uid}_${slot.exactStreak}`;
      events.push(mkStory(id, "momentum", "exact_streak", IMPORTANCE.STREAK_EXACT, [row.uid],
        slot.exactStreak === 2 ? `🎯🎯 ${row.nickname} o face din nou.` : pick([`🔥 ${slot.exactStreak} scoruri exacte la rând pentru ${row.nickname}.`], id),
        null, { streak: slot.exactStreak }));
    }
    if (slot.zeroStreak >= THRESH.STREAK_ZERO_MIN) {
      const id = `story_zerostreak_${mem.gameweekId}_${row.uid}_${slot.zeroStreak}`;
      events.push(mkStory(id, "momentum", "zero_streak", IMPORTANCE.STREAK_ZERO, [row.uid],
        pick([`🥶 Al ${ordinalRo(slot.zeroStreak)} meci consecutiv fără puncte pentru ${row.nickname}.`], id), null, { streak: slot.zeroStreak }));
    }
    if (slot.worstRank != null && slot.worstRank - row.rank >= THRESH.COMEBACK_MIN_RANGE && row.rank <= 3) {
      const id = `story_comeback_${mem.gameweekId}_${row.uid}_${slot.worstRank}to${row.rank}`;
      events.push(mkStory(id, "comeback", "comeback", IMPORTANCE.COMEBACK, [row.uid],
        pick([`🚀 De pe locul ${slot.worstRank} pe ${row.rank <= 1 ? "primul loc" : "podium"}. ${row.nickname} tocmai a întors etapa.`], id), null, { from: slot.worstRank, to: row.rank }));
    }
    if (slot.bestRank != null && row.rank - slot.bestRank >= THRESH.COLLAPSE_MIN_RANGE && slot.bestRank <= 3) {
      const id = `story_collapse_${mem.gameweekId}_${row.uid}_${slot.bestRank}to${row.rank}`;
      events.push(mkStory(id, "collapse", "collapse", IMPORTANCE.COLLAPSE, [row.uid],
        pick([`📉 ${row.nickname} era ${slot.bestRank === 1 ? "lider" : "pe podium"} acum câteva meciuri. Acum e pe locul ${row.rank}.`], id), null, { from: slot.bestRank, to: row.rank }));
    }
  });
  return events;
}

export function detectRivalry(mem) {
  const events = [];
  Object.entries(mem.swapPairs).forEach(([key, count]) => {
    if (count < THRESH.RIVALRY_MIN_SWAPS) return;
    const [uidA, uidB] = key.split("|");
    const id = `story_rivalry_${mem.gameweekId}_${key}_${count}`;
    events.push(mkStory(id, "rivalry", "rivalry_swap", IMPORTANCE.RIVALRY_SWAP, [uidA, uidB],
      pick([`⚔️ Încă o schimbare de locuri — a ${count}-a oară în seara asta.`], id), null, { count, uidA, uidB }));
  });
  return events;
}

export function detectConsensusStory(match, predsWithNames, recentVariants = {}) {
  if (!canRevealPredictions(match)) return [];
  const events = [];
  const total = predsWithNames.length;
  if (total < 4) return events;
  const realOutcome = match.realScoreA > match.realScoreB ? "home" : match.realScoreA < match.realScoreB ? "away" : "draw";
  const outcomeOf = (p) => (p.scoreA > p.scoreB ? "home" : p.scoreA < p.scoreB ? "away" : "draw");
  const counts = { home: 0, away: 0, draw: 0 };
  predsWithNames.forEach((p) => { counts[outcomeOf(p)] += 1; });
  const majorityOutcome = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  const majorityShare = counts[majorityOutcome] / total;
  const label = { home: match.homeTeam, away: match.awayTeam, draw: "egal" };

  if (majorityOutcome !== realOutcome && majorityShare >= THRESH.CONSENSUS_UPSET_MIN_SHARE) {
    const id = `story_upset_${match.id}`;
    const winLabel = label[realOutcome] === "egal" ? "a fost egal" : `${label[realOutcome]} a câștigat`;
    const { text: upsetTitle, index: upsetIdx } = pickAvoiding([
      `😂 ${counts[majorityOutcome]} din ${total} au mers pe ${label[majorityOutcome]}. Nu așa a ieșit.`,
      `🤡 Aproape toată Liga Băieților a mers pe ${label[majorityOutcome]}. ${winLabel}.`,
      `💣 ${counts[majorityOutcome]} din ${total} au mers pe ${label[majorityOutcome]}. Fotbalul a decis altfel.`,
      `Consens aproape total pe ${label[majorityOutcome]} — și ${winLabel}.`,
      `😅 Majoritatea a nimerit-o pe lângă: ${label[majorityOutcome]}, iar ${winLabel}.`,
      `${label[majorityOutcome]} părea sigur pentru toată lumea. N-a fost.`,
      `🎢 Etapa asta a răsturnat calculele — ${winLabel}, nu ${label[majorityOutcome]}.`,
      `Biletele pe ${label[majorityOutcome]} au fost aruncate la coș.`,
      `😬 ${label[majorityOutcome]} — alegerea aproape unanimă. Rezultatul, altul.`,
      `Nimeni nu se aștepta să vadă ${winLabel} după atâtea voturi pe ${label[majorityOutcome]}.`,
      `Meci care a păcălit majoritatea: ${label[majorityOutcome]} nu a fost răspunsul.`,
      `${counts[majorityOutcome]}/${total} au crezut în ${label[majorityOutcome]}. Rezultatul le-a dat lecție.`,
    ], id, recentVariants.upset);
    const ev = mkStory(id, "consensus", "upset", IMPORTANCE.CONSENSUS_UPSET, [], upsetTitle, null, { majorityOutcome, majorityShare, realOutcome });
    ev.variantIndex = upsetIdx;
    events.push(ev);
  }

  const loneCorrect = predsWithNames.filter((p) => outcomeOf(p) === realOutcome);
  if (loneCorrect.length === 1 && counts[realOutcome] === 1) {
    const id = `story_lonewolf_${match.id}`;
    events.push(mkStory(id, "consensus", "lone_wolf_success", IMPORTANCE.LONE_WOLF_SUCCESS, [loneCorrect[0].userId],
      pick([
        `🐺 Singur împotriva tuturor — și a avut dreptate: ${loneCorrect[0].nickname}.`,
        `🐺 ${loneCorrect[0].nickname} a mers singur pe varianta corectă.`,
        `Toată lumea râdea de ${loneCorrect[0].nickname}. Nu mai râde nimeni.`,
        `🐺 ${loneCorrect[0].nickname} a văzut ce n-a văzut nimeni altcineva.`,
        `Un singur pariu diferit — al lui ${loneCorrect[0].nickname}. Cel corect.`,
        `🐺 ${loneCorrect[0].nickname} a jucat singur împotriva grupului și a câștigat.`,
        `Instinct solitar, rezultat corect: ${loneCorrect[0].nickname}.`,
        `🐺 Toți ceilalți au greșit. ${loneCorrect[0].nickname}, nu.`,
        `${loneCorrect[0].nickname} a avut curajul să meargă altfel. Și a avut dreptate.`,
        `🐺 O predicție singulară, exact cea corectă: ${loneCorrect[0].nickname}.`,
      ], id), null, {}));
  }
  return events;
}

function mkStory(id, type, subtype, importance, actors, title, subtitle, metadata) {
  return {
    id, type: "story", subtype, ts: Date.now(), importance, actors, metadata: metadata || {},
    narrativeKey: id, version: SCHEMA_VERSION, engineVersion: ENGINE_VERSION,
    icon: iconFor(type), important: importance >= 75,
    title, subtitle: subtitle || null,
    category: categoryFor(type), priority: importance, storyKey: storyKeyFor(type, subtype, actors),
  };
}
function iconFor(type) {
  return { leader_story: "up", podium_story: "up", bottom_story: "down", momentum: "up", comeback: "up", collapse: "down", rivalry: "fun", consensus: "fun" }[type] || "fun";
}
function categoryFor(type) {
  return { leader_story: "clasament", podium_story: "clasament", bottom_story: "clasament", momentum: "clasament", comeback: "clasament", collapse: "clasament", rivalry: "fun", consensus: "prediction" }[type] || "fun";
}
function storyKeyFor(type, subtype, actors) {
  const actorKey = [...actors].sort().join(",");
  if (subtype === "leader_return" || subtype === "leader_count") return `leader-change:${actorKey}`;
  return `${type}:${subtype}:${actorKey}`;
}
export function ordinalRo(n) {
  const map = { 1: "primul", 2: "al doilea", 3: "al treilea", 4: "al patrulea", 5: "al cincilea", 6: "al șaselea", 7: "al șaptelea", 8: "al optulea" };
  return map[n] || `al ${n}-lea`;
}

export function applyEditorialBudget(events) {
  const observability = { rawEvents: events.length, storiesDetected: events.length, storiesPublished: 0, suppressed: { duplicate: 0, lowImportance: 0, aggregation: 0 }, suppressedDetail: [] };

  const byStoryKey = new Map();
  events.forEach((e) => {
    const key = e.storyKey || e.id;
    const existing = byStoryKey.get(key);
    if (!existing || e.importance > existing.importance) {
      if (existing) { observability.suppressed.duplicate += 1; observability.suppressedDetail.push({ id: existing.id, title: existing.title, reason: "duplicate", supersededBy: e.id }); }
      byStoryKey.set(key, e);
    } else {
      observability.suppressed.duplicate += 1;
      observability.suppressedDetail.push({ id: e.id, title: e.title, reason: "duplicate", supersededBy: existing.id });
    }
  });

  const deduped = [...byStoryKey.values()];
  const kept = deduped.filter((e) => {
    if (e.importance >= 55) return true;
    observability.suppressed.lowImportance += 1;
    observability.suppressedDetail.push({ id: e.id, title: e.title, reason: "lowImportance", importance: e.importance });
    return false;
  });

  observability.storiesPublished = kept.length;
  return { events: kept.sort((a, b) => b.importance - a.importance), observability };
}

export function buildRecap(gameweekId, mem, finalRows, exactCounts) {
  const id = `recap_${gameweekId}`;
  const top3 = finalRows.slice(0, 3);
  const riseEntries = Object.entries(mem.byUid).filter(([, s]) => s.bestRank != null && s.worstRank != null);
  const biggestRise = riseEntries.map(([uid, s]) => ({ uid, delta: s.worstRank - s.bestRank })).sort((a, b) => b.delta - a.delta)[0];
  const biggestFall = riseEntries.map(([uid, s]) => ({ uid, delta: s.bestRank - s.worstRank })).sort((a, b) => b.delta - a.delta)[0];
  const kingOfExact = Object.entries(exactCounts).sort((a, b) => b[1] - a[1])[0];

  const nameOf = (uid) => finalRows.find((r) => r.uid === uid)?.nickname || uid;
  const lines = [`🏆 Câștigător etapă: ${top3[0]?.nickname || "—"} — ${top3[0]?.seasonPoints ?? 0}p`];
  if (top3[1]) lines.push(`🥈 ${top3[1].nickname} — ${top3[1].seasonPoints}p`);
  if (top3[2]) lines.push(`🥉 ${top3[2].nickname} — ${top3[2].seasonPoints}p`);
  if (biggestRise && biggestRise.delta >= 3) lines.push(`🚀 Urcarea etapei: ${nameOf(biggestRise.uid)}, +${biggestRise.delta} locuri`);
  if (biggestFall && biggestFall.delta >= 3) lines.push(`📉 Căderea etapei: ${nameOf(biggestFall.uid)}, -${biggestFall.delta} locuri`);
  if (kingOfExact && kingOfExact[1] >= 2) lines.push(`🎯 Regele scorurilor exacte: ${nameOf(kingOfExact[0])} — ${kingOfExact[1]}`);

  return {
    id, type: "recap", subtype: "gameweek_recap", ts: Date.now(), importance: IMPORTANCE.RECAP,
    actors: top3.map((r) => r.uid), metadata: { top3, biggestRise, biggestFall, kingOfExact },
    narrativeKey: id, version: SCHEMA_VERSION, engineVersion: ENGINE_VERSION,
    icon: "star", important: true, title: "🏁 RECAP ETAPĂ", subtitle: lines.join("\n"),
    category: "clasament", priority: IMPORTANCE.RECAP, storyKey: `recap:${gameweekId}`,
  };
}

export function buildMatchPreviewCard(match, predsWithNames) {
  if (!canRevealPredictions(match)) return null;
  const total = predsWithNames.length;
  if (total < 3) return null;
  const homeCount = predsWithNames.filter((p) => p.scoreA > p.scoreB).length;
  const drawCount = predsWithNames.filter((p) => p.scoreA === p.scoreB).length;
  const awayCount = total - homeCount - drawCount;
  const scoreCounts = {};
  predsWithNames.forEach((p) => { const k = `${p.scoreA}-${p.scoreB}`; scoreCounts[k] = (scoreCounts[k] || 0) + 1; });
  const popular = Object.entries(scoreCounts).sort((a, b) => b[1] - a[1])[0];
  const id = `preview_${match.id}`;
  return {
    id, type: "prediction", subtype: "match_preview", ts: Date.now(), importance: IMPORTANCE.MATCH_PREVIEW,
    actors: [], metadata: { matchId: match.id, homeCount, drawCount, awayCount, total, popular },
    narrativeKey: id, version: SCHEMA_VERSION, engineVersion: ENGINE_VERSION,
    icon: "fun", important: false, title: `👀 LIGA A DECIS — ${match.homeTeam} – ${match.awayTeam}`,
    subtitle: `${homeCount}/${total} → ${match.homeTeam} · ${drawCount}/${total} → Egal · ${awayCount}/${total} → ${match.awayTeam}${popular ? ` · Cel mai popular scor: ${popular[0]} (${popular[1]})` : ""}`,
    category: "prediction", priority: IMPORTANCE.MATCH_PREVIEW, storyKey: `preview:${match.id}`,
  };
}
