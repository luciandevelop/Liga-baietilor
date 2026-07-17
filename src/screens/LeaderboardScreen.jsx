import { useEffect, useState } from "react";
import { getCurrentSeason, getCurrentGameweek, loadUserPredictions, loadUserJoker } from "../services/predictionsService";
import { listGameweekScores, listGeneralLeaderboard, getUserNicknames, listenLiveGameweekScores, listMatches } from "../services/adminService";
import PlayerBreakdownModal from "../components/PlayerBreakdownModal";

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
  const [gwNicknames, setGwNicknames] = useState({});
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
            const names = await getUserNicknames(rows.map((r) => r.uid));
            setGwNicknames(names);
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
      const names = await getUserNicknames(rows.map((r) => r.uid));
      setGwNicknames((prev) => ({ ...prev, ...names }));
    });
    return unsubscribe;
  }, [gameweek?.id, gameweek?.status]);

  const openRow = gwRows.find((r) => r.uid === openUid) || null;
  const isOwnOpenRow = openUid && user?.uid === openUid;

  return (
    <div style={s.page}>
      <div style={s.headerRow}>
        <h1 style={s.title}>Clasament</h1>
        <button style={s.backBtn} onClick={onBack}>Înapoi</button>
      </div>

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
          {!gameweek && <div style={s.centerBox}>Nu există o etapă activă în această săptămână.</div>}
          {gameweek && gwRows.length === 0 && (
            <div style={s.centerBox}>Etapa "{gameweek.title}" nu are încă rezultate introduse.</div>
          )}
          {gameweek && gwRows.length > 0 && gwLive && (
            <div style={s.liveTag}>🔴 Clasament live — bonusul de poziție e provizoriu, se actualizează automat pe măsură ce adminul introduce rezultate noi.</div>
          )}
          {gwRows.map((r) => (
            <button key={r.uid} style={s.row} onClick={() => setOpenUid(r.uid)} type="button">
              <span style={s.pos}>#{r.rank ?? "–"}</span>
              <span style={s.name}>{gwNicknames[r.uid] || r.uid}</span>
              <span style={s.pts}>{r.pointsFromMatches}p</span>
              <span style={{ ...s.bonus, color: r.rankingBonus >= 0 ? "#A9E0B8" : "#E08A82" }}>
                {r.rankingBonus >= 0 ? "+" : ""}{r.rankingBonus}p
              </span>
              <span style={s.total}>{r.totalPoints}p</span>
            </button>
          ))}
        </div>
      )}

      {!loading && !error && tab === "general" && (
        <div style={s.list}>
          {generalRows.length === 0 && <div style={s.centerBox}>Niciun user încă.</div>}
          {generalRows.map((r, i) => (
            <div key={r.uid} style={s.row}>
              <span style={s.pos}>#{i + 1}</span>
              <span style={s.name}>{r.nickname || r.uid}</span>
              <span style={s.gwPlayed}>{r.gameweeksPlayed || 0} etape</span>
              <span style={s.total}>{r.seasonPoints || 0}p</span>
            </div>
          ))}
        </div>
      )}

      {openRow && (
        <PlayerBreakdownModal
          nickname={gwNicknames[openUid] || openUid}
          row={openRow}
          isOwn={isOwnOpenRow}
          ownPredictions={isOwnOpenRow ? ownPredictions : null}
          ownJokerMatchId={isOwnOpenRow ? ownJokerMatchId : null}
          onClose={() => setOpenUid("")}
        />
      )}
    </div>
  );
}

const s = {
  page: {
    minHeight: "100vh",
    background: "radial-gradient(ellipse at 50% -10%, #131A2E 0%, #080B14 60%)",
    padding: "20px 14px 32px",
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
  },
  headerRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  title: { fontSize: 19, fontWeight: 800, color: "#F5F5F0", margin: 0 },
  backBtn: {
    background: "#0D1220", border: "1px solid #232B42", color: "#8B93A8",
    borderRadius: 10, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
  },
  tabRow: { display: "flex", gap: 8, marginBottom: 16, maxWidth: 480, marginLeft: "auto", marginRight: "auto" },
  tabBtn: {
    flex: 1, background: "#0D1220", border: "1px solid #232B42", color: "#8B93A8",
    borderRadius: 10, padding: "10px 0", fontSize: 13, fontWeight: 700, cursor: "pointer",
  },
  tabBtnActive: {
    background: "linear-gradient(180deg, #E0BC4A, #C9A227)", color: "#0A0E1A", border: "none",
  },
  centerBox: { textAlign: "center", color: "#8B93A8", fontSize: 13.5, padding: "30px 16px" },
  liveTag: {
    background: "rgba(181,69,61,0.10)", border: "1px solid rgba(181,69,61,0.3)",
    color: "#E08A82", borderRadius: 10, padding: "8px 12px", fontSize: 11.5, marginBottom: 10,
    maxWidth: 480, marginLeft: "auto", marginRight: "auto",
  },
  list: { display: "flex", flexDirection: "column", gap: 8, maxWidth: 480, margin: "0 auto" },
  row: {
    display: "flex", alignItems: "center", gap: 8, background: "#12182B",
    border: "1px solid #232B42", borderRadius: 12, padding: "12px 14px",
    width: "100%", cursor: "pointer", textAlign: "left", fontFamily: "inherit",
  },
  pos: { fontSize: 13, fontWeight: 800, color: "#C9A227", width: 28, flexShrink: 0 },
  name: { fontSize: 14, fontWeight: 700, color: "#F5F5F0", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  pts: { fontSize: 12, color: "#8B93A8", flexShrink: 0 },
  bonus: { fontSize: 12, fontWeight: 700, flexShrink: 0, width: 48, textAlign: "right" },
  total: { fontSize: 14.5, fontWeight: 800, color: "#E0BC4A", flexShrink: 0, width: 56, textAlign: "right" },
  gwPlayed: { fontSize: 11.5, color: "#6B7390", flexShrink: 0 },
};
