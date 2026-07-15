import { useCallback, useEffect, useState } from "react";
import {
  getCurrentSeason,
  getCurrentGameweek,
  loadUserPredictions,
  saveAllPredictions,
} from "../services/predictionsService";
import { listMatches } from "../services/adminService";
import MatchPredictionCard from "../components/MatchPredictionCard";

export default function PredictionsScreen({ user, onBack }) {
  const [loadState, setLoadState] = useState("loading"); // loading | ready | error | empty
  const [loadError, setLoadError] = useState("");
  const [season, setSeason] = useState(null);
  const [gameweek, setGameweek] = useState(null);
  const [matches, setMatches] = useState([]);
  const [predictions, setPredictions] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const load = useCallback(async () => {
    setLoadState("loading");
    setLoadError("");
    setSaveMessage("");

    let s, gw, m;

    try {
      s = await getCurrentSeason();
    } catch (err) {
      console.error("Eroare la încărcarea sezonului:", err);
      setLoadError("Încărcare sezon: " + (err.message || err.code));
      setLoadState("error");
      return;
    }
    if (!s) {
      setLoadState("empty");
      return;
    }

    try {
      gw = await getCurrentGameweek(s.id);
    } catch (err) {
      console.error("Eroare la încărcarea etapei:", err);
      setLoadError("Încărcare etapă: " + (err.message || err.code));
      setLoadState("error");
      return;
    }
    if (!gw) {
      setLoadState("empty");
      return;
    }

    try {
      m = await listMatches(gw.id);
    } catch (err) {
      console.error("Eroare la încărcarea meciurilor:", err);
      setLoadError("Încărcare meciuri: " + (err.message || err.code));
      setLoadState("error");
      return;
    }

    setSeason(s);
    setGameweek(gw);
    setMatches(m);

    let existing;
    try {
      existing = await loadUserPredictions(user.uid, m.map((x) => x.id));
    } catch (err) {
      console.error("Eroare la încărcarea predicțiilor proprii:", err);
      setLoadError("Încărcare predicții proprii: " + (err.message || err.code));
      setLoadState("error");
      return;
    }

    const initial = {};
    m.forEach((match) => {
      const p = existing[match.id];
      initial[match.id] = {
        scoreA: p?.scoreA ?? "",
        scoreB: p?.scoreB ?? "",
        corners: p?.corners ?? "",
        cards: p?.cards ?? "",
      };
    });
    setPredictions(initial);
    setLoadState("ready");
  }, [user.uid]);

  useEffect(() => {
    load();
  }, [load]);

  function updateMatch(matchId, patch) {
    setPredictions((prev) => ({ ...prev, [matchId]: { ...prev[matchId], ...patch } }));
  }

  async function handleSaveAll() {
    setSaving(true);
    setSaveMessage("");
    try {
      const { saved, skippedEmpty, invalid, errors } = await saveAllPredictions(user.uid, matches, predictions);
      const parts = [];
      if (saved > 0) parts.push(`${saved} salvate`);
      if (invalid > 0) parts.push(`${invalid} cu valori nevalide (verifică)`);
      if (errors.length > 0) parts.push(`${errors.length} erori: ${errors.join(" | ")}`);
      if (parts.length === 0) {
        setSaveMessage(skippedEmpty > 0 ? "Niciun meci cu scor completat de salvat." : "Nimic de salvat.");
      } else {
        setSaveMessage("✓ " + parts.join(" · "));
      }
    } catch (err) {
      console.error(err);
      setSaveMessage("Eroare la salvare: " + (err.message || err.code));
    } finally {
      setSaving(false);
    }
  }

  if (loadState === "loading") {
    return (
      <div style={s.page}>
        <div style={s.centerBox}>Se încarcă etapa…</div>
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div style={s.page}>
        <div style={s.centerBox}>
          <p style={s.errorText}>Eroare la încărcare: {loadError}</p>
          <button style={s.retryBtn} onClick={load}>Încearcă din nou</button>
          <button style={s.backLink} onClick={onBack}>Înapoi</button>
        </div>
      </div>
    );
  }

  if (loadState === "empty") {
    return (
      <div style={s.page}>
        <div style={s.headerRow}>
          <h1 style={s.title}>Pronosticuri</h1>
          <button style={s.backBtn} onClick={onBack}>Înapoi</button>
        </div>
        <div style={s.centerBox}>Nu există o etapă activă în această săptămână.</div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <div style={s.headerRow}>
        <div>
          <h1 style={s.title}>{gameweek.title}</h1>
          {season?.name && <p style={s.subtitle}>{season.name}</p>}
        </div>
        <button style={s.backBtn} onClick={onBack}>Înapoi</button>
      </div>

      {matches.length === 0 ? (
        <div style={s.centerBox}>Etapa asta nu are încă meciuri adăugate.</div>
      ) : (
        <div style={s.matchList}>
          {matches.map((m) => {
            const locked = m.kickoffAt?.toMillis ? m.kickoffAt.toMillis() <= Date.now() : false;
            return (
              <MatchPredictionCard
                key={m.id}
                match={m}
                prediction={predictions[m.id]}
                onChange={(patch) => updateMatch(m.id, patch)}
                locked={locked}
              />
            );
          })}
        </div>
      )}

      {matches.length > 0 && (
        <div style={s.saveArea}>
          {saveMessage && <div style={s.saveMessage}>{saveMessage}</div>}
          <button style={s.saveBtn} disabled={saving} onClick={handleSaveAll}>
            {saving ? "Se salvează…" : "SALVEAZĂ PRONOSTICURILE"}
          </button>
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
  headerRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  title: { fontSize: 19, fontWeight: 800, color: "#F5F5F0", margin: 0 },
  subtitle: { fontSize: 11.5, color: "#6B7390", margin: "3px 0 0" },
  backBtn: {
    background: "#0D1220",
    border: "1px solid #232B42",
    color: "#8B93A8",
    borderRadius: 10,
    padding: "8px 14px",
    fontSize: 12.5,
    fontWeight: 700,
    cursor: "pointer",
    flexShrink: 0,
  },
  centerBox: {
    textAlign: "center",
    color: "#8B93A8",
    fontSize: 13.5,
    padding: "40px 16px",
  },
  errorText: { color: "#E08A82", fontSize: 13, marginBottom: 14 },
  retryBtn: {
    background: "linear-gradient(180deg, #E0BC4A, #C9A227)",
    color: "#0A0E1A",
    border: "none",
    borderRadius: 10,
    padding: "10px 20px",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    marginRight: 8,
  },
  backLink: {
    background: "none",
    border: "none",
    color: "#8B93A8",
    fontSize: 12.5,
    cursor: "pointer",
    textDecoration: "underline",
  },
  matchList: { display: "flex", flexDirection: "column", gap: 14, maxWidth: 480, margin: "0 auto" },
  saveArea: {
    maxWidth: 480,
    margin: "20px auto 0",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  saveMessage: {
    fontSize: 12.5,
    color: "#A9E0B8",
    background: "rgba(63,168,92,0.1)",
    border: "1px solid rgba(63,168,92,0.3)",
    borderRadius: 10,
    padding: "10px 12px",
    lineHeight: 1.5,
  },
  saveBtn: {
    background: "linear-gradient(180deg, #E0BC4A, #C9A227)",
    color: "#0A0E1A",
    border: "none",
    borderRadius: 12,
    padding: "15px 0",
    fontSize: 14.5,
    fontWeight: 800,
    letterSpacing: "0.02em",
    cursor: "pointer",
  },
};
