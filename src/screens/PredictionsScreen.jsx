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
import { listenMatches } from "../services/adminService";
import { getMatchStatus } from "../utils/matchStatus";
import MatchPredictionCard from "../components/MatchPredictionCard";
import PredictionsRevealSheet from "../components/PredictionsRevealSheet";
import { color, font, radius } from "../matchdayTheme";
import useNow from "../hooks/useNow";

export default function PredictionsScreen({ user, isAdmin, onBack, scrollToMatchId }) {
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

  // ── Subtab nou: "mine" (implicit) vs "locked" (toate pronosticurile
  // meciurilor blocate, secundar, nu concurează cu restul aplicației). ──
  const [subtab, setSubtab] = useState("mine");
  const [expandedLockedId, setExpandedLockedId] = useState(null);
  const [revealMatch, setRevealMatch] = useState(null); // 👁 — meci LIVE deschis în sheet
  const [finishedExpanded, setFinishedExpanded] = useState(false); // acordeon "meciuri încheiate"

  const unsubMatchesRef = useRef(null);
  const formInitedRef = useRef(false);

  const load = useCallback(async () => {
    setLoadState("loading");
    setLoadError("");
    formInitedRef.current = false;

    let s, gw;

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

    setSeason(s);
    setGameweek(gw);

    let existingJoker = null;
    try {
      existingJoker = await loadUserJoker(gw.id, user.uid);
    } catch (err) {
      console.error("Eroare la încărcarea Jokerului:", err);
      // Nu blocăm toată pagina pentru asta — Jokerul e opțional, restul funcționează.
      setJokerError("Nu s-a putut încărca Jokerul: " + (err.message || err.code));
    }
    setJoker(existingJoker);

    // ── REALTIME pe meciuri — aceeași sursă unică (listenMatches) ca Home.
    // BUG P0 reparat aici: înainte, listMatches() era o citire O SINGURĂ
    // DATĂ (getDocs), deci scorul rămânea "înghețat" la momentul deschiderii
    // ecranului — de-aici valori diferite față de Admin/Home pentru
    // ACELAȘI meci. ──
    if (unsubMatchesRef.current) unsubMatchesRef.current();
    unsubMatchesRef.current = listenMatches(gw.id, async (m) => {
      setMatches(m);

      if (!formInitedRef.current) {
        formInitedRef.current = true;
        try {
          const existing = await loadUserPredictions(user.uid, m.map((x) => x.id));
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
          setLoadState("ready");
        } catch (err) {
          console.error("Eroare la încărcarea predicțiilor proprii:", err);
          setLoadError("Încărcare predicții proprii: " + (err.message || err.code));
          setLoadState("error");
        }
      }
    });
  }, [user.uid]);

  useEffect(() => {
    load();
    return () => { if (unsubMatchesRef.current) unsubMatchesRef.current(); };
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

  // Implicit: cel mai recent meci blocat (kickoff cel mai apropiat de
  // acum, dintre cele deja blocate) — deschis automat, o singură dată.
  const lockedDefaultRef = useRef(false);
  useEffect(() => {
    if (lockedDefaultRef.current || loadState !== "ready" || matches.length === 0) return;
    const locked = matches.filter((m) => isMatchLocked(m)).sort((a, b) => b.kickoffAt.toMillis() - a.kickoffAt.toMillis());
    if (locked.length > 0) {
      setExpandedLockedId(locked[0].id);
      lockedDefaultRef.current = true;
    }
  }, [loadState, matches]);

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

  const lockedMatches = matches.filter((m) => isMatchLocked(m)).sort((a, b) => b.kickoffAt.toMillis() - a.kickoffAt.toMillis());

  // ── Prioritate obligatorie pentru "Meciurile mele": LIVE > programate
  // (cronologic) > finalizate (jos, cu accordion). Bug real semnalat —
  // înainte, lista era doar ordinea brută din listenMatches (cronologică
  // simplă), deci un meci FINAL cu kickoff mai devreme apărea înaintea
  // unui meci LIVE cu kickoff mai târziu. ──
  const liveMatches = matches.filter((m) => ["live", "paused"].includes(getMatchStatus(m)));
  const scheduledMatches = matches
    .filter((m) => getMatchStatus(m) === "scheduled")
    .slice()
    .sort((a, b) => a.kickoffAt.toMillis() - b.kickoffAt.toMillis());
  const finishedMatches = matches
    .filter((m) => getMatchStatus(m) === "finished")
    .slice()
    .sort((a, b) => b.kickoffAt.toMillis() - a.kickoffAt.toMillis()); // cel mai recent primul

  const topMatches = [...liveMatches, ...scheduledMatches];
  const finishedVisible = finishedExpanded ? finishedMatches : finishedMatches.slice(0, 1);

  return (
    <div style={s.page}>
      <div style={s.wrap}>
        <PageHead eyebrow={season?.name} title={gameweek.title} subtitle={`${matches.length} meciuri`} onBack={onBack} />

        {jokerError && <div style={s.jokerErrorBanner}>Joker: {jokerError}</div>}

        {matches.length === 0 ? (
          <div style={s.emptyState}>Etapa asta nu are încă meciuri adăugate.</div>
        ) : (
          <>
            <div style={s.subtabRow}>
              <button type="button" style={{ ...s.subtabBtn, ...(subtab === "mine" ? s.subtabBtnActive : {}) }} onClick={() => setSubtab("mine")}>
                Meciurile mele
              </button>
              <button type="button" style={{ ...s.subtabBtn, ...(subtab === "locked" ? s.subtabBtnActive : {}) }} onClick={() => setSubtab("locked")}>
                Pronosticuri blocate {lockedMatches.length > 0 ? `(${lockedMatches.length})` : ""}
              </button>
            </div>

            {subtab === "mine" && (() => {
              const renderCard = (m) => {
                const locked = isMatchLocked(m);
                const isFeatured = featuredMatchIds.includes(m.id);
                const featuredIndex = isFeatured ? featuredMatchIds.indexOf(m.id) + 1 : null;
                const isJoker = joker?.matchId === m.id;
                const sState = saveState[m.id] || {};
                const isLive = getMatchStatus(m) === "live";

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
                      featuredIndex={featuredIndex}
                      isJoker={isJoker}
                      onToggleJoker={() => (isJoker ? handleRemoveJoker() : handleSetJoker(m))}
                      jokerDisabled={jokerDisabled}
                      jokerUsedElsewhereNote={!isJoker && joker && jokerMatch ? `Jokerul e activ pe ${jokerMatch.homeTeam} vs ${jokerMatch.awayTeam}` : null}
                      currentUid={user.uid}
                    />
                    {isLive && (
                      <button type="button" style={s.eyeInlineBtn} onClick={() => setRevealMatch(m)} aria-label="Vezi pronosticurile">
                        👁 Cine mai e în joc?
                      </button>
                    )}
                  </div>
                );
              };

              return (
                <div style={s.matchList}>
                  {topMatches.map(renderCard)}

                  {finishedMatches.length > 0 && (
                    <div style={s.finishedSection}>
                      <div style={s.finishedLabel}>Meciuri încheiate</div>
                      {finishedVisible.map(renderCard)}
                      {finishedMatches.length > 1 && (
                        <button type="button" style={s.finishedToggleBtn} onClick={() => setFinishedExpanded((v) => !v)}>
                          {finishedExpanded ? "Ascunde meciurile încheiate" : `Vezi toate meciurile încheiate (${finishedMatches.length})`}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {subtab === "locked" && (
              <div style={s.lockedList}>
                {lockedMatches.length === 0 && <div style={s.emptyState}>Niciun meci blocat încă.</div>}
                {lockedMatches.map((m) => {
                  const isExpanded = expandedLockedId === m.id;
                  return (
                    <div key={m.id} style={s.lockedItem}>
                      <button type="button" style={s.lockedHeader} onClick={() => setExpandedLockedId(isExpanded ? null : m.id)}>
                        <span style={s.lockedHeaderTeams}>{m.homeTeam} — {m.awayTeam}</span>
                        <span style={s.lockedHeaderChevron}>{isExpanded ? "▾" : "›"}</span>
                      </button>
                      {isExpanded && (
                        <div style={s.lockedInline}>
                          <PredictionsRevealSheet match={m} currentUserId={user.uid} isFeatured={featuredMatchIds.includes(m.id)} isAdmin={isAdmin} inline />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
      {revealMatch && (
        <PredictionsRevealSheet
          match={revealMatch}
          currentUserId={user.uid}
          isFeatured={featuredMatchIds.includes(revealMatch.id)}
          isAdmin={isAdmin}
          onClose={() => setRevealMatch(null)}
        />
      )}
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
  page: { minHeight: "100vh", background: color.bgBase, paddingBottom: 96 },
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
  finishedSection: { display: "flex", flexDirection: "column", gap: 10, marginTop: 6 },
  finishedLabel: { fontSize: 11, fontWeight: 800, letterSpacing: "0.05em", color: color.textFaint, fontFamily: font.body, textTransform: "uppercase" },
  finishedToggleBtn: {
    width: "100%", background: "rgba(255,255,255,0.03)", border: `1px solid ${color.border}`, borderRadius: radius.sm,
    padding: "10px 0", fontSize: 11.5, fontWeight: 700, color: color.textSecondary, cursor: "pointer", fontFamily: font.body,
  },

  subtabRow: { display: "flex", gap: 8, marginBottom: 16 },
  subtabBtn: {
    flex: 1, background: "rgba(255,255,255,0.03)", border: `1px solid ${color.border}`, color: color.textMuted,
    borderRadius: radius.sm, padding: "10px 8px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: font.body,
  },
  subtabBtnActive: { background: color.goldGradient, color: color.goldOn, border: "none" },

  eyeInlineBtn: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", marginTop: 6,
    background: "rgba(212,175,55,0.08)", border: "1px solid rgba(212,175,55,0.3)", borderRadius: radius.sm,
    padding: "8px 0", fontSize: 11.5, fontWeight: 700, color: color.goldLight, cursor: "pointer", fontFamily: font.body,
  },

  lockedList: { display: "flex", flexDirection: "column", gap: 8 },
  lockedItem: {
    background: color.surfaceElevated, border: `1px solid ${color.border}`, borderRadius: radius.md, overflow: "hidden",
  },
  lockedHeader: {
    display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
    background: "none", border: "none", padding: "12px 14px", cursor: "pointer",
  },
  lockedHeaderTeams: { fontSize: 12.5, fontWeight: 700, color: color.textPrimary, fontFamily: font.body },
  lockedHeaderChevron: { fontSize: 14, color: color.textFaint },
  lockedInline: { padding: "0 14px 14px" },
};
