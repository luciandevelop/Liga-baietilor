import { useEffect, useState } from "react";
import { getCurrentSeason, getCurrentGameweek } from "../services/predictionsService";
import { listenLiveGameweekScores } from "../services/adminService";
import { getUserPublicProfiles } from "../services/profilesService";
import {
  getWeeklySurprise, getSecretMain, getSecretBonus, getSurpriseResult, getAllSurpriseResults,
  listSeasonSurprises, getSurpriseStatus, MAIN_CATALOG, BONUS_CATALOG,
} from "../services/surprisesService";
import PageHeader from "../components/PageHeader";
import PlayerAvatar from "../components/PlayerAvatar";
import DuelExperience from "../components/DuelExperience";
import DuelMiniCard from "../components/DuelMiniCard";
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

  useEffect(() => {
    let unsubScores = null;
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

        // TOATE profilele implicate în pairing — nu doar al meu — ca lista
        // de "alte dueluri" să poată afișa nickname/avatar pentru oricine.
        if (sm?.config?.pairings) {
          const uids = sm.config.pairings.flatMap((pr) => [pr.playerA, pr.playerB]);
          if (sm.config.byePlayer) uids.push(sm.config.byePlayer);
          getUserPublicProfiles(uids).then(setProfiles);
        }

        unsubScores = listenLiveGameweekScores(gw.id, (rows) => {
          const map = {};
          rows.forEach((r) => { map[r.userId] = r.totalPoints || 0; });
          setLiveScores(map);
        });

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

    return () => { if (unsubScores) unsubScores(); };
  }, [user.uid]);

  const status = getSurpriseStatus(pub);
  const myPairing = secretMain?.config?.pairings?.find((p) => p.playerA === user.uid || p.playerB === user.uid);
  const isMyBye = secretMain?.config?.byePlayer === user.uid;
  const myOpponent = myPairing ? (myPairing.playerA === user.uid ? myPairing.playerB : myPairing.playerA) : null;
  const otherPairings = (secretMain?.config?.pairings || []).filter((p) => p.playerA !== user.uid && p.playerB !== user.uid);

  const resultsByUid = {};
  (allResults || []).forEach((r) => { resultsByUid[r.uid] = r; });

  const deadlinePassed = gameweek?.status === "completed";

  // Panou de transparență — TOȚI jucătorii implicați, cu Main+Bonus, sortați
  // descrescător. Cerut explicit: "cine și ce a luat, să nu existe îndoieli".
  const allInvolvedUids = new Set([
    ...(secretMain?.config?.pairings || []).flatMap((p) => [p.playerA, p.playerB]),
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
                  {secretMain?.type === "duel-random" && (
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
                    <RouletteExperience
                      gameweekId={gameweek.id}
                      uid={user.uid}
                      deadlinePassed={deadlinePassed}
                      onResolvedChange={() => getSurpriseResult(gameweek.id, user.uid).then(setMyResult)}
                    />
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
};
