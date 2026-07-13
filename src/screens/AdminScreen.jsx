import { useEffect, useState } from "react";
import {
  createSeason,
  listSeasons,
  createGameweek,
  listGameweeks,
  createMatch,
  listMatches,
} from "../services/adminService";

export default function AdminScreen({ onBack }) {
  const [seasons, setSeasons] = useState([]);
  const [gameweeks, setGameweeks] = useState([]);
  const [matches, setMatches] = useState([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState("");
  const [selectedGameweekId, setSelectedGameweekId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [seasonName, setSeasonName] = useState("");
  const [seasonStart, setSeasonStart] = useState("");
  const [seasonEnd, setSeasonEnd] = useState("");

  const [gwNumber, setGwNumber] = useState("");
  const [gwTitle, setGwTitle] = useState("");

  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [kickoffAt, setKickoffAt] = useState("");

  async function refreshSeasons() {
    const data = await listSeasons();
    setSeasons(data);
  }

  async function refreshGameweeks(seasonId) {
    if (!seasonId) return setGameweeks([]);
    const data = await listGameweeks(seasonId);
    setGameweeks(data);
  }

  async function refreshMatches(gameweekId) {
    if (!gameweekId) return setMatches([]);
    const data = await listMatches(gameweekId);
    setMatches(data);
  }

  useEffect(() => {
    refreshSeasons();
  }, []);

  useEffect(() => {
    refreshGameweeks(selectedSeasonId);
    setSelectedGameweekId("");
  }, [selectedSeasonId]);

  useEffect(() => {
    refreshMatches(selectedGameweekId);
  }, [selectedGameweekId]);

  async function handleCreateSeason(e) {
    e.preventDefault();
    if (!seasonName || !seasonStart || !seasonEnd) return;
    setLoading(true);
    setMessage("");
    try {
      const id = await createSeason({ name: seasonName, startDate: seasonStart, endDate: seasonEnd });
      setSeasonName("");
      setSeasonStart("");
      setSeasonEnd("");
      await refreshSeasons();
      setSelectedSeasonId(id);
      setMessage("Sezon creat.");
    } catch (err) {
      console.error(err);
      setMessage("Eroare la crearea sezonului: " + (err.code || err.message));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateGameweek(e) {
    e.preventDefault();
    if (!selectedSeasonId || !gwNumber || !gwTitle) return;
    setLoading(true);
    setMessage("");
    try {
      const id = await createGameweek({ seasonId: selectedSeasonId, number: gwNumber, title: gwTitle });
      setGwNumber("");
      setGwTitle("");
      await refreshGameweeks(selectedSeasonId);
      setSelectedGameweekId(id);
      setMessage("Etapă creată.");
    } catch (err) {
      console.error(err);
      setMessage("Eroare la crearea etapei: " + (err.code || err.message));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateMatch(e) {
    e.preventDefault();
    if (!selectedGameweekId || !homeTeam || !awayTeam || !kickoffAt) return;
    setLoading(true);
    setMessage("");
    try {
      await createMatch({ gameweekId: selectedGameweekId, homeTeam, awayTeam, kickoffAt });
      setHomeTeam("");
      setAwayTeam("");
      setKickoffAt("");
      await refreshMatches(selectedGameweekId);
      setMessage("Meci adăugat.");
    } catch (err) {
      console.error(err);
      setMessage("Eroare la adăugarea meciului: " + (err.code || err.message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.page}>
      <div style={s.wrap}>
        <div style={s.headerRow}>
          <h1 style={s.title}>Panou Admin — test etapă</h1>
          <button style={s.backBtn} onClick={onBack}>Înapoi</button>
        </div>

        {message && <div style={s.message}>{message}</div>}

        {/* Sezon */}
        <section style={s.card}>
          <h2 style={s.cardTitle}>1. Sezon</h2>
          <select
            style={s.select}
            value={selectedSeasonId}
            onChange={(e) => setSelectedSeasonId(e.target.value)}
          >
            <option value="">— alege un sezon —</option>
            {seasons.map((s2) => (
              <option key={s2.id} value={s2.id}>{s2.name}</option>
            ))}
          </select>

          <form onSubmit={handleCreateSeason} style={s.form}>
            <input style={s.input} placeholder="Nume sezon (ex: Sezon 2026/27)" value={seasonName} onChange={(e) => setSeasonName(e.target.value)} />
            <div style={s.row}>
              <input style={s.input} type="date" value={seasonStart} onChange={(e) => setSeasonStart(e.target.value)} />
              <input style={s.input} type="date" value={seasonEnd} onChange={(e) => setSeasonEnd(e.target.value)} />
            </div>
            <button style={s.btn} disabled={loading} type="submit">+ Sezon nou</button>
          </form>
        </section>

        {/* Etapă */}
        {selectedSeasonId && (
          <section style={s.card}>
            <h2 style={s.cardTitle}>2. Etapă</h2>
            <select
              style={s.select}
              value={selectedGameweekId}
              onChange={(e) => setSelectedGameweekId(e.target.value)}
            >
              <option value="">— alege o etapă —</option>
              {gameweeks.map((g) => (
                <option key={g.id} value={g.id}>{g.title} (#{g.number})</option>
              ))}
            </select>

            <form onSubmit={handleCreateGameweek} style={s.form}>
              <div style={s.row}>
                <input style={s.input} type="number" placeholder="Nr." value={gwNumber} onChange={(e) => setGwNumber(e.target.value)} />
                <input style={s.input} placeholder="Titlu (ex: Etapa 1)" value={gwTitle} onChange={(e) => setGwTitle(e.target.value)} />
              </div>
              <button style={s.btn} disabled={loading} type="submit">+ Etapă nouă</button>
            </form>
          </section>
        )}

        {/* Meciuri */}
        {selectedGameweekId && (
          <section style={s.card}>
            <h2 style={s.cardTitle}>3. Meciuri</h2>

            {matches.length > 0 && (
              <div style={s.matchList}>
                {matches.map((m) => (
                  <div key={m.id} style={s.matchRow}>
                    <span>{m.homeTeam} — {m.awayTeam}</span>
                    <span style={s.matchMeta}>{m.status}</span>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleCreateMatch} style={s.form}>
              <div style={s.row}>
                <input style={s.input} placeholder="Echipa gazdă" value={homeTeam} onChange={(e) => setHomeTeam(e.target.value)} />
                <input style={s.input} placeholder="Echipa oaspete" value={awayTeam} onChange={(e) => setAwayTeam(e.target.value)} />
              </div>
              <input style={s.input} type="datetime-local" value={kickoffAt} onChange={(e) => setKickoffAt(e.target.value)} />
              <button style={s.btn} disabled={loading} type="submit">+ Meci nou</button>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}

const s = {
  page: {
    minHeight: "100vh",
    background: "radial-gradient(ellipse at 50% -10%, #131A2E 0%, #080B14 60%)",
    padding: "24px 16px",
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
  },
  wrap: { maxWidth: 480, margin: "0 auto" },
  headerRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  title: { fontSize: 19, fontWeight: 800, color: "#F5F5F0", margin: 0 },
  backBtn: {
    background: "#0D1220", border: "1px solid #232B42", color: "#8B93A8",
    borderRadius: 10, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
  },
  message: {
    background: "rgba(63,168,92,0.12)", border: "1px solid rgba(63,168,92,0.35)",
    color: "#A9E0B8", borderRadius: 10, padding: "10px 14px", fontSize: 12.5, marginBottom: 16,
  },
  card: {
    background: "#12182B", border: "1px solid #232B42", borderRadius: 16,
    padding: "18px 16px", marginBottom: 16,
  },
  cardTitle: { fontSize: 14, fontWeight: 800, color: "#C9A227", margin: "0 0 12px" },
  select: {
    width: "100%", background: "#0D1220", border: "1px solid #232B42", borderRadius: 10,
    padding: "11px 12px", fontSize: 13.5, color: "#F5F5F0", marginBottom: 14,
  },
  form: { display: "flex", flexDirection: "column", gap: 10 },
  row: { display: "flex", gap: 10 },
  input: {
    flex: 1, background: "#0D1220", border: "1px solid #232B42", borderRadius: 10,
    padding: "11px 12px", fontSize: 13.5, color: "#F5F5F0", outline: "none",
  },
  btn: {
    background: "linear-gradient(180deg, #E0BC4A, #C9A227)", color: "#0A0E1A", border: "none",
    borderRadius: 10, padding: "11px 0", fontSize: 13.5, fontWeight: 800, cursor: "pointer", marginTop: 2,
  },
  matchList: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 },
  matchRow: {
    display: "flex", justifyContent: "space-between", background: "#0D1220",
    border: "1px solid #1c2338", borderRadius: 10, padding: "9px 12px", fontSize: 13, color: "#E8E4D8",
  },
  matchMeta: { color: "#5A6280", fontSize: 11.5 },
};
