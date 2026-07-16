import { useEffect, useState } from "react";
import { getCurrentSeason, getCurrentGameweek } from "../services/predictionsService";
import { listGameweekScores, listGeneralLeaderboard, getUserNicknames } from "../services/adminService";

export default function LeaderboardScreen({ onBack }) {
  const [tab, setTab] = useState("gameweek"); // gameweek | general
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [gameweek, setGameweek] = useState(null);
  const [gwRows, setGwRows] = useState([]);
  const [gwNicknames, setGwNicknames] = useState({});
  const [generalRows, setGeneralRows] = useState([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const season = await getCurrentSeason();
        if (season) {
          const gw = await getCurrentGameweek(season.id);
          setGameweek(gw);
          if (gw) {
            const rows = await listGameweekScores(gw.id);
            setGwRows(rows);
            const names = await getUserNicknames(rows.map((r) => r.userId));
            setGwNicknames(names);
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
  }, []);

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
            <div style={s.centerBox}>Etapa "{gameweek.title}" nu a fost finalizată încă.</div>
          )}
          {gwRows.map((r) => (
            <div key={r.userId} style={s.row}>
              <span style={s.pos}>#{r.rank ?? "–"}</span>
              <span style={s.name}>{gwNicknames[r.userId] || r.userId}</span>
              <span style={s.pts}>{r.pointsFromMatches}p</span>
              <span style={{ ...s.bonus, color: r.rankingBonus >= 0 ? "#A9E0B8" : "#E08A82" }}>
                {r.rankingBonus >= 0 ? "+" : ""}{r.rankingBonus}p
              </span>
              <span style={s.total}>{r.totalPoints}p</span>
            </div>
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
  list: { display: "flex", flexDirection: "column", gap: 8, maxWidth: 480, margin: "0 auto" },
  row: {
    display: "flex", alignItems: "center", gap: 8, background: "#12182B",
    border: "1px solid #232B42", borderRadius: 12, padding: "12px 14px",
  },
  pos: { fontSize: 13, fontWeight: 800, color: "#C9A227", width: 28, flexShrink: 0 },
  name: { fontSize: 14, fontWeight: 700, color: "#F5F5F0", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  pts: { fontSize: 12, color: "#8B93A8", flexShrink: 0 },
  bonus: { fontSize: 12, fontWeight: 700, flexShrink: 0, width: 48, textAlign: "right" },
  total: { fontSize: 14.5, fontWeight: 800, color: "#E0BC4A", flexShrink: 0, width: 56, textAlign: "right" },
  gwPlayed: { fontSize: 11.5, color: "#6B7390", flexShrink: 0 },
};
