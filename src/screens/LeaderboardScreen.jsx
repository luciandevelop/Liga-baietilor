import { useEffect, useState } from "react";
import { getCurrentSeason, getCurrentGameweek, loadUserPredictions, loadUserJoker } from "../services/predictionsService";
import { listGameweekScores, listGeneralLeaderboard, listenLiveGameweekScores, listMatches } from "../services/adminService";
import { getUserPublicProfiles } from "../services/profilesService";
import PlayerBreakdownModal from "../components/PlayerBreakdownModal";
import PageHeader from "../components/PageHeader";
import PlayerRankRow from "../components/PlayerRankRow";
import StatusBadge from "../components/StatusBadge";
import EmptyState from "../components/EmptyState";
import { color, font, layout, radius } from "../theme";

// Normalizează rândurile la aceeași formă, indiferent dacă vin din
// gameweekLiveScores (userId, document deja sanitizat de admin) sau din
// gameweekScores (userId, scris definitiv la finalizare).
function normalizeRow(r) {
  return {
    uid: r.userId,
    rank: r.rank,
    pointsFromMatches: r.pointsFromMatches,
    rankingBonus: r.rankingBonus,
    totalPoints: r.totalPoints,
    breakdown: r.breakdown || {},
  };
}

export default function LeaderboardScreen({ onBack, user }) {
  const [tab, setTab] = useState("gameweek"); // gameweek | general
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [gameweek, setGameweek] = useState(null);
  const [gwRows, setGwRows] = useState([]);
  const [gwLive, setGwLive] = useState(false);
  const [gwProfiles, setGwProfiles] = useState({});
  const [generalRows, setGeneralRows] = useState([]);
  const [openUid, setOpenUid] = useState("");
  const [ownPredictions, setOwnPredictions] = useState({});
  const [ownJokerMatchId, setOwnJokerMatchId] = useState(null);

  // Setup inițial: sezon curent, etapă curentă, clasament general (o
  // singură dată). Clasamentul de etapă e gestionat separat mai jos —
  // one-shot dacă etapa e finalizată, LIVE (onSnapshot) dacă nu e.
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const season = await getCurrentSeason();
        if (season) {
          const gw = await getCurrentGameweek(season.id);
          setGameweek(gw);

          if (gw && gw.status === "completed") {
            const rows = (await listGameweekScores(gw.id)).map(normalizeRow);
            setGwRows(rows);
            setGwLive(false);
            const p = await getUserPublicProfiles(rows.map((r) => r.uid));
            setGwProfiles(p);
          }

          // Propriul pronostic — citire directă, mereu permisă pentru
          // owner, indiferent de lock — folosită să "dezvăluim" înapoi
          // rândul propriu în Player Detail chiar și pentru meciuri pe
          // care gameweekLiveScores le-a ascuns (nu știe cine se uită).
          if (gw && user?.uid) {
            const m = await listMatches(gw.id);
            const preds = await loadUserPredictions(user.uid, m.map((x) => x.id));
            setOwnPredictions(preds);
            const ownJoker = await loadUserJoker(gw.id, user.uid);
            setOwnJokerMatchId(ownJoker?.matchId || null);
          }
        }
        const general = await listGeneralLeaderboard();
        setGeneralRows(general);
      } catch (err) {
        console.error(err);
        setError(err.message || err.code);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.uid]);

  // Clasament LIVE — subscripție real-time la gameweekLiveScores (nu
  // predictions/jokers direct — acelea nu sunt niciodată citite de aici).
  // Se actualizează singur ori de câte ori adminul republică, fără
  // polling și fără request manual.
  useEffect(() => {
    if (!gameweek || gameweek.status === "completed") return;
    setGwLive(true);
    const unsubscribe = listenLiveGameweekScores(gameweek.id, async (rawRows) => {
      const rows = rawRows.map(normalizeRow);
      setGwRows(rows);
      const names = await getUserPublicProfiles(rows.map((r) => r.uid));
      setGwProfiles((prev) => ({ ...prev, ...names }));
    });
    return unsubscribe;
  }, [gameweek?.id, gameweek?.status]);

  const openRow = gwRows.find((r) => r.uid === openUid) || null;
  const isOwnOpenRow = openUid && user?.uid === openUid;

  // "X/Y meciuri punctate" — derivat din breakdown-ul oricărui rând (toți
  // userii au același set de meciuri în etapă), doar pentru afișare.
  const anyBreakdown = gwRows[0]?.breakdown || {};
  const breakdownEntries = Object.values(anyBreakdown);
  const scoredCount = breakdownEntries.filter((m) => m.status !== "pending").length;
  const totalCount = breakdownEntries.length;

  return (
    <div style={layout.page}>
      <div style={layout.wrap}>
        <PageHeader title="Clasament" onBack={onBack} />

        <div style={s.tabRow}>
          <button style={{ ...s.tabBtn, ...(tab === "gameweek" ? s.tabBtnActive : {}) }} onClick={() => setTab("gameweek")}>
            Etapă
          </button>
          <button style={{ ...s.tabBtn, ...(tab === "general" ? s.tabBtnActive : {}) }} onClick={() => setTab("general")}>
            General
          </button>
        </div>

        {loading && <div style={s.centerBox}>Se încarcă…</div>}
        {error && <div style={s.centerBox}>Eroare: {error}</div>}

        {!loading && !error && tab === "gameweek" && (
          <div style={s.list}>
            {!gameweek && <EmptyState icon="📅" title="Nu există o etapă activă în această săptămână." />}
            {gameweek && gwRows.length === 0 && (
              <EmptyState icon="🏆" title={`Etapa "${gameweek.title}" nu are încă rezultate introduse.`} />
            )}
            {gameweek && gwRows.length > 0 && (
              <div style={s.liveRow}>
                {gwLive ? (
                  <StatusBadge tone="live" dot>LIVE · {scoredCount}/{totalCount} meciuri punctate</StatusBadge>
                ) : (
                  <StatusBadge tone="gold">FINAL</StatusBadge>
                )}
                <span style={s.bonusNote}>{gwLive ? "Bonus poziție la închiderea etapei" : "Bonus final"}</span>
              </div>
            )}
            {gwRows.map((r) => (
              <PlayerRankRow
                key={r.uid}
                rank={r.rank}
                nickname={gwProfiles[r.uid]?.nickname || r.uid}
                avatarId={gwProfiles[r.uid]?.avatarId}
                pointsFromMatches={r.pointsFromMatches}
                rankingBonus={r.rankingBonus}
                totalPoints={r.totalPoints}
                top3={r.rank <= 3}
                showBonus={!gwLive}
                onClick={() => setOpenUid(r.uid)}
              />
            ))}
          </div>
        )}

        {!loading && !error && tab === "general" && (
          <div style={s.list}>
            {generalRows.length === 0 && <EmptyState icon="🏆" title="Niciun user încă." />}
            {generalRows.map((r, i) => (
              <PlayerRankRow
                key={r.uid}
                rank={i + 1}
                nickname={r.nickname || r.uid}
                avatarId={r.avatarId}
                totalPoints={r.seasonPoints || 0}
                top3={i < 3}
              />
            ))}
          </div>
        )}
      </div>

      {openRow && (
        <PlayerBreakdownModal
          nickname={gwProfiles[openUid]?.nickname || openUid}
          avatarId={gwProfiles[openUid]?.avatarId}
          row={openRow}
          isOwn={isOwnOpenRow}
          showBonus={!gwLive}
          ownPredictions={isOwnOpenRow ? ownPredictions : null}
          ownJokerMatchId={isOwnOpenRow ? ownJokerMatchId : null}
          onClose={() => setOpenUid("")}
        />
      )}
    </div>
  );
}

const s = {
  tabRow: { display: "flex", gap: 8, marginBottom: 16 },
  tabBtn: {
    flex: 1, background: color.surfaceInset, border: `1px solid ${color.border}`, color: color.textMuted,
    borderRadius: radius.sm, padding: "10px 0", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: font.body,
  },
  tabBtnActive: { background: color.goldGradient, color: color.goldOn, border: "none" },
  centerBox: { textAlign: "center", color: color.textMuted, fontSize: 13.5, padding: "30px 16px" },
  liveRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  bonusNote: { fontSize: 10.5, color: color.textFaint, fontWeight: 600 },
  list: { display: "flex", flexDirection: "column", gap: 7 },
};
