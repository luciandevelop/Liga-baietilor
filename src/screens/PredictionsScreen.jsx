import { useCallback, useEffect, useRef, useState } from "react";
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
import { color, font, radius } from "../matchdayTheme";
import useNow from "../hooks/useNow";

export default function PredictionsScreen({ user, onBack, scrollToMatchId }) {
  // Re-render la fiecare 30s — face ca isMatchLocked(m) să reflecte mereu
  // ora reală curentă, fără refresh manual. Nu e sursa de securitate
  // (aceea rămâne firestore.rules), doar sincronizează UI-ul cu ea.
  useNow(30000);

  const [loadState, setLoadState] = useState("loading"); // loading | ready | error | empty
  const [loadError, setLoadError] = useState("");
  const [season, setSeason] = useState(null);
  const [gameweek, setGameweek] = useState(null);
  const [matches, setMatches] = useState([]);
  const [predictions, setPredictions] = useState({});
  const [saveState, setSaveState] = useState({}); // { [matchId]: { saving, status, error } }
  // Meciuri cu pronostic DEJA salvat în Firestore — spre deosebire de
  // saveState (tranzitoriu, dispare la reîncărcare), asta rămâne stabil
  // cât timp ești pe ecran, ca butonul să arate "Modifică" de la bun
  // început, nu doar imediat după un salvare proaspătă.
  const [savedMatchIds, setSavedMatchIds] = useState(new Set());
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
        corners: p?.corners ?? 8,
        cards: p?.cards ?? 3,
      };
    });
    setPredictions(initial);
    setSavedMatchIds(new Set(Object.keys(existing)));
    setJoker(existingJoker);
    setLoadState("ready");
  }, [user.uid]);

  useEffect(() => {
    load();
  }, [load]);

  // Derulează automat la meciul-țintă (venit din "Progres etapă" pe Home),
  // o singură dată, după ce lista chiar există în pagină — nu la fiecare
  // randare, altfel ar sări înapoi de fiecare dată când userul scrollează
  // manual în altă parte.
  const scrolledRef = useRef(false);
  useEffect(() => {
    if (scrolledRef.current || !scrollToMatchId || loadState !== "ready") return;
    const el = document.querySelector(`[data-match-id="${scrollToMatchId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      scrolledRef.current = true;
    }
  }, [scrollToMatchId, loadState, matches]);

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
      setSavedMatchIds((prev) => new Set(prev).add(matchId));
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
        <div style={s.wrap}>
          <PageHead title="Pronosticuri" onBack={onBack} />
          <div style={s.emptyState}>Nu există o etapă activă în această săptămână.</div>
        </div>
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
      <div style={s.wrap}>
        <PageHead eyebrow={season?.name} title={gameweek.title} subtitle={`${matches.length} meciuri`} onBack={onBack} />

        {jokerError && <div style={s.jokerErrorBanner}>Joker: {jokerError}</div>}

        {matches.length === 0 ? (
          <div style={s.emptyState}>Etapa asta nu are încă meciuri adăugate.</div>
        ) : (
          <div style={s.matchList}>
            {matches.map((m) => {
              const locked = isMatchLocked(m);
              const isFeatured = featuredMatchIds.includes(m.id);
              const isJoker = joker?.matchId === m.id;
              const sState = saveState[m.id] || {};

              // Meciul care ARE deja Jokerul: poate fi doar renunțat, și doar
              // dacă nu e locked. Orice alt meci: butonul e dezactivat COMPLET
              // cât timp Jokerul e activ altundeva — nu se mai poate "muta"
              // silențios dintr-un click; userul trebuie să se întoarcă la
              // meciul original și să apese "Renunță" acolo, explicit.
              const jokerDisabled = isJoker
                ? locked || jokerSaving
                : isFeatured || locked || jokerSaving || Boolean(joker);

              return (
                <div key={m.id} data-match-id={m.id}>
                  <MatchPredictionCard
                    match={m}
                    prediction={predictions[m.id]}
                    onChange={(patch) => updateMatch(m.id, patch)}
                    onSave={() => handleSaveMatch(m)}
                    saving={!!sState.saving}
                    saveStatus={sState.status}
                    saveError={sState.error}
                    isSaved={savedMatchIds.has(m.id)}
                    locked={locked}
                    isFeatured={isFeatured}
                    isJoker={isJoker}
                    onToggleJoker={() => (isJoker ? handleRemoveJoker() : handleSetJoker(m))}
                    jokerDisabled={jokerDisabled}
                    jokerUsedElsewhereNote={!isJoker && joker && jokerMatch ? `Jokerul e activ pe ${jokerMatch.homeTeam} vs ${jokerMatch.awayTeam}` : null}
                    currentUid={user.uid}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Header inline, pe matchdayTheme — înlocuiește PageHeader (rămas pe
// theme.js vechi) doar pentru acest ecran.
function PageHead({ eyebrow, title, subtitle, onBack }) {
  return (
    <div style={s.head}>
      <button type="button" onClick={onBack} style={s.backBtn} aria-label="Înapoi">‹</button>
      <div>
        {eyebrow && <div style={s.headEyebrow}>{eyebrow}</div>}
        <div style={s.headTitle}>{title}</div>
        {subtitle && <div style={s.headSubtitle}>{subtitle}</div>}
      </div>
    </div>
  );
}

const s = {
  page: { minHeight: "100vh", background: color.bgBase },
  wrap: { maxWidth: 480, margin: "0 auto", padding: "18px 16px 40px" },

  head: { display: "flex", alignItems: "center", gap: 12, marginBottom: 20 },
  backBtn: {
    width: 32, height: 32, borderRadius: "50%", background: color.surfaceElevated, border: `1px solid ${color.border}`,
    color: color.textPrimary, fontSize: 18, cursor: "pointer", flexShrink: 0,
  },
  headEyebrow: { fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: color.textFaint, fontFamily: font.body },
  headTitle: { fontFamily: font.display, fontSize: 19, fontWeight: 700, color: color.textPrimary },
  headSubtitle: { fontSize: 11.5, color: color.textSecondary, marginTop: 2, fontFamily: font.body },

  centerBox: { textAlign: "center", color: color.textSecondary, fontSize: 13.5, padding: "40px 16px", fontFamily: font.body },
  emptyState: { textAlign: "center", color: color.textSecondary, fontSize: 13, padding: "40px 16px", fontFamily: font.body },
  errorText: { color: "#F0555A", fontSize: 13, marginBottom: 14, fontFamily: font.body },
  retryBtn: {
    background: color.goldGradient, color: color.goldOn, border: "none", borderRadius: 10,
    padding: "10px 20px", fontSize: 13, fontWeight: 800, cursor: "pointer", marginRight: 8, fontFamily: font.body,
  },
  backLink: {
    background: "none", border: "none", color: color.textSecondary, fontSize: 12.5,
    cursor: "pointer", textDecoration: "underline", fontFamily: font.body,
  },
  jokerErrorBanner: {
    fontSize: 11.5, color: "#F0555A", background: "rgba(240,85,90,0.1)", border: "1px solid rgba(240,85,90,0.3)",
    borderRadius: 10, padding: "8px 12px", marginBottom: 14, fontFamily: font.body,
  },
  matchList: { display: "flex", flexDirection: "column", gap: 10 },
};
