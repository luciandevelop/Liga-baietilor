import { useEffect, useState } from "react";
import { getCurrentSeason, getCurrentGameweek } from "../services/predictionsService";
import { getLiveGameweekPoints } from "../services/adminService";
import { getUserPublicProfiles } from "../services/profilesService";
import {
  getWeeklySurprise, getSecretMain, getSecretBonus, getSurpriseResult, getAllSurpriseResults,
  listSeasonSurprises, getSurpriseStatus, MAIN_CATALOG, BONUS_CATALOG, getAllRouletteSpinsStatus,
} from "../services/surprisesService";
import PageHeader from "../components/PageHeader";
import PlayerAvatar from "../components/PlayerAvatar";
import DuelExperience from "../components/DuelExperience";
import DuelMiniCard from "../components/DuelMiniCard";
import TeamDuelExperience from "../components/TeamDuelExperience";
import TeamDuelMiniCard from "../components/TeamDuelMiniCard";
import RouletteExperience from "../components/RouletteExperience";
import { color, font, radius } from "../matchdayTheme";

function catalogLabel(list, id) {
  return list.find((c) => c.id === id)?.label || id;
}

export default function SurprisesScreen({ user, onBack }) {
  const [loading, setLoading] = useState(true);
  const [season, setSeason] = useState(null);
  const [gameweek, setGameweek] = useState(null);
  const [pub, setPub] = useState(null);
  const [secretMain, setSecretMain] = useState(null);
  const [secretBonus, setSecretBonus] = useState(null);
  const [myResult, setMyResult] = useState(null);
  const [profiles, setProfiles] = useState({});
  const [liveScores, setLiveScores] = useState({});
  const [history, setHistory] = useState([]);
  const [allResults, setAllResults] = useState(null); // null = nu s-a incarcat / nu-i inca vizibil
  const [spinTick, setSpinTick] = useState(0); // forteaza reimprospatarea listei live de rotiri

  useEffect(() => {
    (async () => {
      setLoading(true);
      const s = await getCurrentSeason();
      setSeason(s);
      if (!s) { setLoading(false); return; }

      const gw = await getCurrentGameweek(s.id);
      setGameweek(gw);

      if (gw) {
        const [p, res] = await Promise.all([getWeeklySurprise(gw.id), getSurpriseResult(gw.id, user.uid)]);
        setPub(p);
        setMyResult(res);

        const [sm, sb] = await Promise.all([getSecretMain(gw.id), getSecretBonus(gw.id)]);
        setSecretMain(sm);
        setSecretBonus(sb);

        // TOATE profilele implicate — nu doar al meu — ca listele de
        // "alte dueluri"/"alte echipe" să poată afișa nickname/avatar
        // pentru oricine. Acoperă atât Duel (pairings) cât și 2v2 (teams
        // + extraDuel), oricare din ele fiind prezent în config.
        if (sm?.config) {
          const uids = new Set();
          (sm.config.pairings || []).forEach((pr) => { uids.add(pr.playerA); uids.add(pr.playerB); });
          (sm.config.groups || []).forEach((g) => { g.teamA.forEach((u) => uids.add(u)); g.teamB.forEach((u) => uids.add(u)); });
          (sm.config.pairings || []).forEach((p) => { uids.add(p.playerA); uids.add(p.playerB); });
          if (sm.config.byePlayer) uids.add(sm.config.byePlayer);
          if (uids.size > 0) getUserPublicProfiles([...uids]).then(setProfiles);
        }

        // Sursă unică (getLiveGameweekPoints) — BUG CRITIC REPARAT aici:
        // înainte citea gameweekLiveScores (colecție publicată manual,
        // deja contaminată cu bonus de poziție și valori negative de la
        // ultimele locuri) — exact cauza "haosului" de punctaje raportat
        // la Duel (1056p, -100p etc.). Acum: STRICT meciuri FINAL, aceeași
        // cifră ca în Clasament → Etapă, niciodată negativă.
        getLiveGameweekPoints(gw.id).then(({ pointsByUid }) => setLiveScores(pointsByUid));

        // Rezultatele TUTUROR — vizibile abia după primul Resolve (regula
        // Firestore respinge interogarea altfel, nu doar o ascunde în UI).
        if (p?.mainResolved || p?.bonusResolved) {
          getAllSurpriseResults(gw.id).then(setAllResults).catch(() => setAllResults(null));
        }
      }

      const hist = await listSeasonSurprises(s.id);
      setHistory(hist);
      setLoading(false);
    })();
  }, [user.uid]);

  const status = getSurpriseStatus(pub);
  const myPairing = secretMain?.config?.pairings?.find((p) => p.playerA === user.uid || p.playerB === user.uid);
  const isMyBye = secretMain?.config?.byePlayer === user.uid;
  const myOpponent = myPairing ? (myPairing.playerA === user.uid ? myPairing.playerB : myPairing.playerA) : null;
  const otherPairings = (secretMain?.config?.pairings || []).filter((p) => p.playerA !== user.uid && p.playerB !== user.uid);

  // ── Duel de Echipe — grupuri de mărime variabilă (2, 3 sau 4 pe
  // parte), formate cu regula "mereu partea cea mai mică". Fallback la
  // Duel 1v1/Bye DOAR dacă sunt sub 4 useri activi total (rar). ──
  const myGroupEntry = secretMain?.config?.groups?.find((g) => g.teamA.includes(user.uid) || g.teamB.includes(user.uid));
  const myTeamGroup = myGroupEntry ? (myGroupEntry.teamA.includes(user.uid) ? myGroupEntry.teamA : myGroupEntry.teamB) : null;
  const opponentTeamGroup = myGroupEntry ? (myGroupEntry.teamA.includes(user.uid) ? myGroupEntry.teamB : myGroupEntry.teamA) : null;
  const otherGroups = (secretMain?.config?.groups || []).filter((g) => g !== myGroupEntry);
  const isFallbackToDuel = !!secretMain?.config?.fallbackToDuel;
  const fallbackPairing = secretMain?.config?.pairings?.find((p) => p.playerA === user.uid || p.playerB === user.uid);
  const isFallbackBye = secretMain?.config?.byePlayer === user.uid;
  const fallbackOpponent = fallbackPairing ? (fallbackPairing.playerA === user.uid ? fallbackPairing.playerB : fallbackPairing.playerA) : null;

  const resultsByUid = {};
  (allResults || []).forEach((r) => { resultsByUid[r.uid] = r; });

  const deadlinePassed = gameweek?.status === "completed";

  // Panou de transparență — TOȚI jucătorii implicați, cu Main+Bonus, sortați
  // descrescător. Cerut explicit: "cine și ce a luat, să nu existe îndoieli".
  const allInvolvedUids = new Set([
    ...(secretMain?.config?.pairings || []).flatMap((p) => [p.playerA, p.playerB]),
    ...(secretMain?.config?.groups || []).flatMap((g) => [...g.teamA, ...g.teamB]),
    ...(secretMain?.config?.byePlayer ? [secretMain.config.byePlayer] : []),
    ...(allResults || []).map((r) => r.uid),
  ]);
  const resultsTable = [...allInvolvedUids].map((uid) => ({
    uid,
    mainPoints: resultsByUid[uid]?.mainPoints,
    bonusPoints: resultsByUid[uid]?.bonusPoints,
  })).sort((a, b) => ((b.mainPoints || 0) + (b.bonusPoints || 0)) - ((a.mainPoints || 0) + (a.bonusPoints || 0)));

  return (
    <div style={s.page}>
      <div style={s.wrap}>
        <PageHeader title="🎭 Surprizele Săptămânii" onBack={onBack} />

        {loading && <div style={s.hint}>Se încarcă…</div>}

        {!loading && !gameweek && <div style={s.hint}>Nu există etapă activă acum.</div>}

        {!loading && gameweek && (
          <div style={s.currentSection}>
            <div style={s.currentLabel}>{gameweek.title || `Etapa ${gameweek.number}`}</div>

            {/* ── MAIN ── */}
            <div style={s.block}>
              <div style={s.blockHead}>🏆 SURPRIZA PRINCIPALĂ</div>
              {!pub?.mainRevealed ? (
                <div style={s.lockedCard}>🔒 <span>Încă secretă</span></div>
              ) : (
                <>
                  <div style={s.revealedTypeLabel}>{catalogLabel(MAIN_CATALOG, secretMain?.type)}</div>
                  {secretMain?.config?.usedRandomFallback && (
                    <div style={s.fallbackNote}>Fără etapă anterioară finalizată încă — perechile sunt aleatorii de data asta.</div>
                  )}
                  {(secretMain?.type === "duel-random" || secretMain?.type === "duel-extreme" || secretMain?.type === "duel-rivali") && (
                    <>
                      <DuelExperience
                        myUid={user.uid}
                        opponentUid={myOpponent}
                        isBye={isMyBye}
                        profiles={profiles}
                        liveScores={liveScores}
                        resolved={!!pub?.mainResolved}
                        myPoints={myResult?.mainPoints}
                      />

                      {otherPairings.length > 0 && (
                        <div style={s.otherDuelsSection}>
                          <div style={s.otherDuelsLabel}>Celelalte dueluri</div>
                          <div style={s.otherDuelsList}>
                            {otherPairings.map((pr) => (
                              <DuelMiniCard
                                key={`${pr.playerA}_${pr.playerB}`}
                                playerA={pr.playerA}
                                playerB={pr.playerB}
                                profiles={profiles}
                                liveScores={liveScores}
                                resolved={!!pub?.mainResolved}
                                results={resultsByUid}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {secretMain?.type === "team-duel-random" && (
                    <>
                      <TeamDuelExperience
                        myUid={user.uid}
                        myTeam={myTeamGroup}
                        opponentTeam={opponentTeamGroup}
                        isFallbackDuel={isFallbackToDuel && !isFallbackBye && !!fallbackPairing}
                        fallbackOpponent={fallbackOpponent}
                        isFallbackBye={isFallbackToDuel && isFallbackBye}
                        profiles={profiles}
                        liveScores={liveScores}
                        resolved={!!pub?.mainResolved}
                        myPoints={myResult?.mainPoints}
                      />

                      {otherGroups.length > 0 && (
                        <div style={s.otherDuelsSection}>
                          <div style={s.otherDuelsLabel}>Celelalte echipe</div>
                          <div style={s.otherDuelsList}>
                            {otherGroups.map((g) => (
                              <TeamDuelMiniCard
                                key={`${g.teamA.join("_")}_${g.teamB.join("_")}`}
                                teamA={g.teamA}
                                teamB={g.teamB}
                                profiles={profiles}
                                liveScores={liveScores}
                                resolved={!!pub?.mainResolved}
                                results={resultsByUid}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>

            {/* ── BONUS ── */}
            <div style={s.block}>
              <div style={s.blockHead}>🎁 BONUSUL SĂPTĂMÂNII</div>
              {!pub?.bonusRevealed ? (
                <div style={s.lockedCard}>🔒 <span>Încă secret</span></div>
              ) : (
                <>
                  <div style={s.revealedTypeLabel}>{catalogLabel(BONUS_CATALOG, secretBonus?.type)}</div>
                  {secretBonus?.type === "roulette" && (
                    <>
                      <RouletteExperience
                        gameweekId={gameweek.id}
                        uid={user.uid}
                        deadlinePassed={deadlinePassed}
                        onResolvedChange={() => {
                          getSurpriseResult(gameweek.id, user.uid).then(setMyResult);
                          setSpinTick((t) => t + 1);
                        }}
                      />
                      <RouletteLiveList gameweekId={gameweek.id} profiles={profiles} myUid={user.uid} refreshKey={spinTick} />
                    </>
                  )}
                </>
              )}
            </div>

            {/* ── Transparență totală — cine ce a luat, fără îndoieli ── */}
            {(pub?.mainResolved || pub?.bonusResolved) && resultsTable.length > 0 && (
              <div style={s.block}>
                <div style={s.blockHead}>📋 Toate rezultatele etapei</div>
                <div style={s.resultsTable}>
                  {resultsTable.map((r) => {
                    const total = (r.mainPoints || 0) + (r.bonusPoints || 0);
                    return (
                      <div key={r.uid} style={{ ...s.resultRow, ...(r.uid === user.uid ? s.resultRowMe : {}) }}>
                        <PlayerAvatar avatarId={profiles[r.uid]?.avatarId} nickname={profiles[r.uid]?.nickname} size={26} />
                        <span style={s.resultName}>{profiles[r.uid]?.nickname || r.uid}{r.uid === user.uid ? " (tu)" : ""}</span>
                        <span style={s.resultMain}>{r.mainPoints != null ? `🏆 ${r.mainPoints}p` : "—"}</span>
                        <span style={s.resultBonus}>{r.bonusPoints != null ? `🎁 ${r.bonusPoints}p` : "—"}</span>
                        <span style={s.resultTotal}>{total}p</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <div style={s.historySection}>
          <div style={s.historyLabel}>📚 SEZONUL SURPRIZELOR</div>
          {history.length === 0 && !loading && <div style={s.hint}>Niciun sezon activ.</div>}
          {history.map((h) => (
            <div key={h.gameweek.id} style={s.historyRow}>
              <div style={s.historyTitle}>{h.gameweek.title || `Etapa ${h.gameweek.number}`}</div>
              <div style={s.historyLine}>
                🏆 {h.public?.mainRevealed ? "" : "?"}
                <span style={s.historyStatusTag}>
                  {h.status === "locked" ? "🔒 BLOCATĂ" : h.status === "active" ? "⚡ ACTIVĂ" : "✅ REZOLVATĂ"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Lista LIVE cu cine a învârtit și ce a păstrat — nu așteaptă Resolve.
// Cerută explicit pentru transparență totală: "să nu existe discuții".
// Reîmprospătare periodică (nu onSnapshot — sunt mai multe query-uri
// combinate, nu unul singur ușor de urmărit live). ──
function RouletteLiveList({ gameweekId, profiles, myUid, refreshKey }) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let cancelled = false;
    function load() {
      getAllRouletteSpinsStatus(gameweekId).then((r) => { if (!cancelled) setRows(r); }).catch(() => {});
    }
    load();
    const interval = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [gameweekId, refreshKey]);

  if (rows.length === 0) return null;

  return (
    <div style={s.rouletteLiveList}>
      <div style={s.rouletteLiveLabel}>Cine a învârtit</div>
      {rows.map((r) => (
        <div key={r.uid} style={{ ...s.rouletteLiveRow, ...(r.uid === myUid ? s.rouletteLiveRowMe : {}) }}>
          <span style={s.rouletteLiveName}>{profiles[r.uid]?.nickname || r.uid}{r.uid === myUid ? " (tu)" : ""}</span>
          {r.status === "not-spun" && <span style={s.rouletteLivePending}>încă n-a învârtit</span>}
          {r.status === "kept-first" && <span style={s.rouletteLiveValue}>{r.value}p</span>}
          {r.status === "final-after-reroll" && <span style={s.rouletteLiveValue}>{r.value}p <span style={s.rouletteLiveTag}>după reroll</span></span>}
        </div>
      ))}
    </div>
  );
}

const s = {
  page: { minHeight: "100vh", background: color.bg },
  wrap: { maxWidth: 480, margin: "0 auto", padding: "0 16px 32px" },
  hint: { fontSize: 12.5, color: color.textFaint, fontFamily: font.body, padding: "16px 0", textAlign: "center" },

  currentSection: { marginTop: 8 },
  currentLabel: { fontSize: 11, fontWeight: 800, letterSpacing: "0.05em", color: color.textFaint, fontFamily: font.body, marginBottom: 10, textTransform: "uppercase" },
  block: { marginBottom: 20 },
  blockHead: { fontFamily: font.display, fontSize: 14, fontWeight: 800, color: color.textPrimary, marginBottom: 10 },
  lockedCard: {
    display: "flex", alignItems: "center", gap: 8, justifyContent: "center", padding: "28px 16px",
    background: "rgba(255,255,255,0.03)", border: `1px dashed ${color.border}`, borderRadius: radius.lg,
    color: color.textFaint, fontSize: 13, fontFamily: font.body,
  },
  revealedTypeLabel: { fontSize: 11.5, color: color.goldLight, fontWeight: 700, fontFamily: font.body, marginBottom: 8, textAlign: "center" },
  fallbackNote: { fontSize: 10, color: color.textFaint, fontFamily: font.body, textAlign: "center", marginBottom: 10, fontStyle: "italic" },

  otherDuelsSection: { marginTop: 14 },
  otherDuelsLabel: { fontSize: 10, fontWeight: 800, letterSpacing: "0.05em", color: color.textFaint, fontFamily: font.body, marginBottom: 8, textTransform: "uppercase" },
  otherDuelsList: { display: "flex", flexDirection: "column", gap: 6 },

  resultsTable: { display: "flex", flexDirection: "column", gap: 6 },
  resultRow: {
    display: "flex", alignItems: "center", gap: 8, padding: "9px 10px",
    background: color.surfaceInset, border: `1px solid ${color.border}`, borderRadius: radius.sm,
  },
  resultRowMe: { border: "1px solid rgba(212,175,55,0.4)", background: "rgba(212,175,55,0.06)" },
  resultName: { flex: 1, fontSize: 11.5, fontWeight: 700, color: color.textPrimary, fontFamily: font.body, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  resultMain: { fontSize: 10.5, color: color.textSecondary, fontFamily: font.body, flexShrink: 0 },
  resultBonus: { fontSize: 10.5, color: color.textSecondary, fontFamily: font.body, flexShrink: 0 },
  resultTotal: { fontSize: 12.5, fontWeight: 800, color: color.goldLight, fontFamily: font.body, flexShrink: 0, minWidth: 40, textAlign: "right" },

  historySection: { marginTop: 26 },
  historyLabel: { fontSize: 11, fontWeight: 800, letterSpacing: "0.05em", color: color.textFaint, fontFamily: font.body, marginBottom: 10, textTransform: "uppercase" },
  historyRow: {
    background: color.surfaceInset, border: `1px solid ${color.border}`, borderRadius: radius.md,
    padding: "12px 14px", marginBottom: 8,
  },
  historyTitle: { fontSize: 12.5, fontWeight: 700, color: color.textPrimary, fontFamily: font.body, marginBottom: 4 },
  historyLine: { fontSize: 11, color: color.textSecondary, fontFamily: font.body, display: "flex", alignItems: "center", justifyContent: "space-between" },
  historyStatusTag: { fontSize: 10, fontWeight: 700, color: color.textFaint },

  rouletteLiveList: { marginTop: 14, display: "flex", flexDirection: "column", gap: 6 },
  rouletteLiveLabel: { fontSize: 10, fontWeight: 800, letterSpacing: "0.05em", color: color.textFaint, fontFamily: font.body, textTransform: "uppercase", marginBottom: 2 },
  rouletteLiveRow: {
    display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 10px",
    background: "rgba(255,255,255,0.03)", border: `1px solid ${color.border}`, borderRadius: radius.sm,
  },
  rouletteLiveRowMe: { border: "1px solid rgba(212,175,55,0.4)", background: "rgba(212,175,55,0.06)" },
  rouletteLiveName: { fontSize: 11.5, fontWeight: 700, color: color.textPrimary, fontFamily: font.body },
  rouletteLivePending: { fontSize: 10.5, color: color.textFaint, fontFamily: font.body, fontStyle: "italic" },
  rouletteLiveValue: { fontSize: 12, fontWeight: 800, color: color.goldLight, fontFamily: font.body },
  rouletteLiveTag: { fontSize: 9, fontWeight: 700, color: color.textFaint, marginLeft: 4 },
};
