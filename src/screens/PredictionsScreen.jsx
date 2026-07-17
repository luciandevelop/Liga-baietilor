import { useCallback, useEffect, useState } from "react";
import {
  getCurrentSeason,
  getCurrentGameweek,
  loadUserPredictions,
  savePredictionForMatch,
  loadUserJoker,
  saveJoker,
  deleteJoker,
  isMatchLocked,
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
  const [saveState, setSaveState] = useState({}); // { [matchId]: { saving, status, error } }
  const [joker, setJoker] = useState(null); // { matchId } | null
  const [jokerSaving, setJokerSaving] = useState(false);
  const [jokerError, setJokerError] = useState("");

  const load = useCallback(async () => {
    setLoadState("loading");
    setLoadError("");

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

    let existingJoker = null;
    try {
      existingJoker = await loadUserJoker(gw.id, user.uid);
    } catch (err) {
      console.error("Eroare la încărcarea Jokerului:", err);
      // Nu blocăm toată pagina pentru asta — Jokerul e opțional, restul funcționează.
      setJokerError("Nu s-a putut încărca Jokerul: " + (err.message || err.code));
    }

    const initial = {};
    m.forEach((match) => {
      const p = existing[match.id];
      initial[match.id] = {
        scoreA: p?.scoreA ?? 0,
        scoreB: p?.scoreB ?? 0,
        corners: p?.corners ?? 0,
        cards: p?.cards ?? 0,
      };
    });
    setPredictions(initial);
    setJoker(existingJoker);
    setLoadState("ready");
  }, [user.uid]);

  useEffect(() => {
    load();
  }, [load]);

  function updateMatch(matchId, patch) {
    setPredictions((prev) => ({ ...prev, [matchId]: { ...prev[matchId], ...patch } }));
  }

  async function handleSaveMatch(match) {
    const matchId = match.id;
    setSaveState((prev) => ({ ...prev, [matchId]: { saving: true, status: "idle", error: "" } }));
    try {
      const p = predictions[matchId] || {};
      await savePredictionForMatch({
        matchId,
        uid: user.uid,
        scoreA: p.scoreA,
        scoreB: p.scoreB,
        corners: p.corners,
        cards: p.cards,
      });
      setSaveState((prev) => ({ ...prev, [matchId]: { saving: false, status: "success", error: "" } }));
    } catch (err) {
      console.error(`Eroare la salvarea meciului ${matchId}:`, err);
      setSaveState((prev) => ({
        ...prev,
        [matchId]: { saving: false, status: "error", error: err.message || err.code },
      }));
    }
  }

  async function handleSetJoker(match) {
    setJokerSaving(true);
    setJokerError("");
    try {
      await saveJoker({ gameweekId: gameweek.id, uid: user.uid, matchId: match.id });
      setJoker({ userId: user.uid, gameweekId: gameweek.id, matchId: match.id });
    } catch (err) {
      console.error("Eroare la salvarea Jokerului:", err);
      setJokerError(err.message || err.code);
    } finally {
      setJokerSaving(false);
    }
  }

  // Renunțare la Joker — șterge alegerea complet, doar dacă meciul care
  // avea Jokerul nu e deja locked (verificat și la nivel de firestore.rules,
  // nu doar aici).
  async function handleRemoveJoker() {
    setJokerSaving(true);
    setJokerError("");
    try {
      await deleteJoker(gameweek.id, user.uid);
      setJoker(null);
    } catch (err) {
      console.error("Eroare la renunțarea Jokerului:", err);
      setJokerError(err.message || err.code);
    } finally {
      setJokerSaving(false);
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

  const featuredMatchIds = gameweek.featuredMatchIds || [];

  // Meciul care deține Jokerul acum (dacă există) — folosit ca să blocăm
  // ORICE schimbare (mutare SAU renunțare) odată ce acel meci s-a locked,
  // nu doar mutarea către un meci nou deja locked.
  const jokerMatch = joker ? matches.find((x) => x.id === joker.matchId) : null;
  const jokerMatchLocked = jokerMatch ? isMatchLocked(jokerMatch) : false;

  return (
    <div style={s.page}>
      <div style={s.headerRow}>
        <div>
          <h1 style={s.title}>{gameweek.title}</h1>
          {season?.name && <p style={s.subtitle}>{season.name}</p>}
        </div>
        <button style={s.backBtn} onClick={onBack}>Înapoi</button>
      </div>

      {jokerError && <div style={s.jokerErrorBanner}>Joker: {jokerError}</div>}

      {matches.length === 0 ? (
        <div style={s.centerBox}>Etapa asta nu are încă meciuri adăugate.</div>
      ) : (
        <div style={s.matchList}>
          {matches.map((m) => {
            const locked = isMatchLocked(m);
            const isFeatured = featuredMatchIds.includes(m.id);
            const isJoker = joker?.matchId === m.id;
            const sState = saveState[m.id] || {};

            // Meciul care ARE deja Jokerul: poate fi doar renunțat, și doar
            // dacă nu e locked. Orice alt meci: poate DEVENI noul Joker
            // (mutare A→B), dar numai dacă meciul nou nu e featured/locked
            // ȘI meciul vechi al Jokerului (dacă există) nu e deja locked.
            const jokerDisabled = isJoker
              ? locked || jokerSaving
              : isFeatured || locked || jokerSaving || jokerMatchLocked;

            return (
              <MatchPredictionCard
                key={m.id}
                match={m}
                prediction={predictions[m.id]}
                onChange={(patch) => updateMatch(m.id, patch)}
                onSave={() => handleSaveMatch(m)}
                saving={!!sState.saving}
                saveStatus={sState.status}
                saveError={sState.error}
                locked={locked}
                isFeatured={isFeatured}
                isJoker={isJoker}
                onToggleJoker={() => (isJoker ? handleRemoveJoker() : handleSetJoker(m))}
                jokerDisabled={jokerDisabled}
              />
            );
          })}
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
  jokerErrorBanner: {
    fontSize: 11.5,
    color: "#E08A82",
    background: "rgba(181,69,61,0.1)",
    border: "1px solid rgba(181,69,61,0.3)",
    borderRadius: 10,
    padding: "8px 12px",
    marginBottom: 14,
    maxWidth: 480,
    marginLeft: "auto",
    marginRight: "auto",
  },
  matchList: { display: "flex", flexDirection: "column", gap: 14, maxWidth: 480, margin: "0 auto" },
};
