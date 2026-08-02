import { useEffect, useState } from "react";
import { logout } from "../services/authService";
import { getCurrentSeason, getCurrentGameweek, loadUserPredictions, loadUserJoker } from "../services/predictionsService";
import { listMatches, listenLiveGameweekScores, listGameweekScores } from "../services/adminService";
import { getUserPublicProfiles } from "../services/profilesService";
import { color, font, layout, radius, shadow } from "../theme";
import useNow from "../hooks/useNow";
import SectionCard from "../components/SectionCard";
import StatusBadge from "../components/StatusBadge";
import PlayerRankRow from "../components/PlayerRankRow";
import MatchCompactCard from "../components/MatchCompactCard";
import EmptyState from "../components/EmptyState";

function formatCountdown(ms) {
  if (ms <= 0) return "Blocat";
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}min`;
  return `${m} min`;
}

export default function WelcomeScreen({ user, profile, isAdmin, onOpenAdmin, onOpenPredictions, onOpenLeaderboard }) {
  const now = useNow(30000); // reface countdown-ul + "următorul lock" la fiecare 30s, fără polling Firestore

  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  // Eroare CRITICĂ (sezon/etapă/meciuri) — blochează hero-ul, are Retry.
  const [criticalError, setCriticalError] = useState("");
  // Eroare SECUNDARĂ (Joker/predicții/clasament/profile) — restul Home-ului
  // tot funcționează, doar acea secțiune arată o notă discretă.
  const [statsError, setStatsError] = useState("");

  const [gameweek, setGameweek] = useState(null);
  const [matches, setMatches] = useState([]);
  const [predictedCount, setPredictedCount] = useState(0);
  const [ownJoker, setOwnJoker] = useState(null);
  const [top3, setTop3] = useState([]);
  const [ownRow, setOwnRow] = useState(null);
  const [profiles, setProfiles] = useState({});

  function load() {
    let unsub = null;
    (async () => {
      setLoading(true);
      setCriticalError("");
      setStatsError("");

      let season, gw, m;
      try {
        season = await getCurrentSeason();
        if (!season) { setGameweek(null); setLoading(false); return; }
        gw = await getCurrentGameweek(season.id);
        setGameweek(gw);
        if (!gw) { setLoading(false); return; }
        m = await listMatches(gw.id);
        setMatches(m);
      } catch (err) {
        console.error("Eroare critică la încărcarea Home:", err);
        setCriticalError(err.message || err.code || "Eroare necunoscută");
        setLoading(false);
        return;
      }
      setLoading(false);

      // De-aici încolo — date secundare. O eroare aici NU blochează restul
      // Home-ului (hero-ul + CTA-ul principal rămân funcționale).
      try {
        const preds = await loadUserPredictions(user.uid, m.map((x) => x.id));
        setPredictedCount(Object.keys(preds).length);
        const joker = await loadUserJoker(gw.id, user.uid);
        setOwnJoker(joker);

        if (gw.status === "completed") {
          const rows = await listGameweekScores(gw.id);
          await applyRows(rows.map((r) => ({ ...r, uid: r.userId })));
        } else {
          unsub = listenLiveGameweekScores(gw.id, (rows) => {
            applyRows(rows.map((r) => ({ ...r, uid: r.userId }))).catch((err) => {
              console.error("Eroare la procesarea clasamentului live:", err);
              setStatsError("Clasamentul live nu s-a putut încărca complet.");
            });
          });
        }
      } catch (err) {
        console.error("Eroare la statisticile personale:", err);
        setStatsError("Unele statistici nu s-au putut încărca. " + (err.message || err.code || ""));
      }
    })();

    async function applyRows(rows) {
      const sorted = [...rows].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
      setTop3(sorted.slice(0, 3));
      setOwnRow(sorted.find((r) => r.uid === user.uid) || null);
      const p = await getUserPublicProfiles(sorted.map((r) => r.uid));
      setProfiles((prev) => ({ ...prev, ...p }));
    }

    return () => { if (unsub) unsub(); };
  }

  useEffect(load, [user.uid]);

  // Următorul meci neblocat — recalculat la fiecare tick (`now`) din
  // `matches` (stocate în state), nu doar o dată la încărcare. Așa avansează
  // singur către următorul meci în momentul în care cel curent se blochează,
  // fără refresh manual.
  const notYetLocked = matches
    .filter((m) => (m.kickoffAt?.toMillis ? m.kickoffAt.toMillis() : Infinity) - 1800000 > now)
    .sort((a, b) => a.kickoffAt.toMillis() - b.kickoffAt.toMillis());
  const nextLockMatch = notYetLocked[0] || null;
  const lockCountdown = nextLockMatch ? formatCountdown(nextLockMatch.kickoffAt.toMillis() - 1800000 - now) : null;

  if (criticalError) {
    return (
      <div style={layout.page}>
        <div style={layout.wrap}>
          <div style={s.errorBox}>
            <p style={s.errorTitle}>Nu s-a putut încărca Home</p>
            <p style={s.errorText}>{criticalError}</p>
            <button style={s.retryBtn} onClick={load} type="button">Încearcă din nou</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={layout.page}>
      <div style={layout.wrap}>
        <div style={s.headerRow}>
          <div>
            <div style={s.eyebrow}>Liga Băieților</div>
            <h1 style={s.h1}>
              {gameweek ? gameweek.title : "Bun venit"}
              {gameweek?.status !== "completed" && gameweek && (
                <StatusBadge tone="live" dot>LIVE</StatusBadge>
              )}
            </h1>
          </div>
          <div style={{ position: "relative" }}>
            <button style={s.menuBtn} onClick={() => setMenuOpen((v) => !v)} type="button" aria-label="Meniu">
              ⋯
            </button>
            {menuOpen && (
              <div style={s.menu}>
                {isAdmin && (
                  <button style={s.menuItem} onClick={onOpenAdmin} type="button">⚙️ Panou Admin</button>
                )}
                <button style={{ ...s.menuItem, color: color.red }} onClick={logout} type="button">
                  Deconectează-te
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Card principal — următorul lock */}
        <SectionCard style={s.heroCard}>
          {nextLockMatch ? (
            <>
              <div style={s.heroLabel}>URMĂTORUL LOCK</div>
              <MatchCompactCard
                homeTeam={nextLockMatch.homeTeam}
                awayTeam={nextLockMatch.awayTeam}
                right={<span style={s.heroCountdown}>{lockCountdown}</span>}
              />
            </>
          ) : (
            <div style={s.heroLabel}>
              {loading ? "Se încarcă…" : gameweek ? "Toate meciurile etapei sunt blocate." : "Nu există o etapă activă în această săptămână."}
            </div>
          )}
          <button style={s.ctaBtn} onClick={onOpenPredictions}>Pronosticuri</button>
        </SectionCard>

        {gameweek && (
          <>
            {statsError && <div style={s.statsErrorNote}>{statsError}</div>}

            {/* Statistici personale */}
            <SectionCard title="Punctele mele">
              <div style={s.statsGrid}>
                <div style={s.statBox}>
                  <span style={s.statValue}>{ownRow ? `#${ownRow.rank}` : "–"}</span>
                  <span style={s.statLabel}>Poziție</span>
                </div>
                <div style={s.statBox}>
                  <span style={s.statValue}>{ownRow ? `${ownRow.totalPoints}p` : "–"}</span>
                  <span style={s.statLabel}>Total etapă</span>
                </div>
                <div style={s.statBox}>
                  <span style={s.statValue}>{predictedCount}/{matches.length}</span>
                  <span style={s.statLabel}>Pontate</span>
                </div>
                <div style={s.statBox}>
                  <span style={s.statValue}>{ownJoker ? "🃏" : "—"}</span>
                  <span style={s.statLabel}>{ownJoker ? "Joker activ" : "Fără Joker"}</span>
                </div>
              </div>
            </SectionCard>

            {/* Top 3 live */}
            <SectionCard
              title="Clasament"
              right={
                top3.length > 0 && gameweek.status !== "completed" ? (
                  <StatusBadge tone="live" dot>LIVE</StatusBadge>
                ) : null
              }
            >
              {top3.length === 0 ? (
                <EmptyState icon="🏆" title="Încă niciun rezultat introdus" />
              ) : (
                <div style={s.rankList}>
                  {top3.map((r) => (
                    <PlayerRankRow
                      key={r.uid}
                      rank={r.rank}
                      nickname={profiles[r.uid]?.nickname || r.uid}
                      avatarId={profiles[r.uid]?.avatarId}
                      totalPoints={r.totalPoints}
                      top3
                      onClick={onOpenLeaderboard}
                    />
                  ))}
                </div>
              )}
              <button style={s.seeAllBtn} onClick={onOpenLeaderboard} type="button">Vezi clasamentul complet →</button>
            </SectionCard>
          </>
        )}
      </div>
    </div>
  );
}

const s = {
  headerRow: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 },
  eyebrow: { fontSize: 11, fontWeight: 700, color: color.gold, letterSpacing: "0.06em", textTransform: "uppercase" },
  h1: {
    fontSize: 21, fontWeight: 700, color: color.textPrimary, margin: "2px 0 0", fontFamily: font.display,
    display: "flex", alignItems: "center", gap: 8,
  },
  menuBtn: {
    width: 36, height: 36, borderRadius: radius.sm, background: color.surfaceInset,
    border: `1px solid ${color.border}`, color: color.textMuted, fontSize: 18, fontWeight: 800, cursor: "pointer",
  },
  menu: {
    position: "absolute", top: 42, right: 0, background: color.surfaceElevated,
    border: `1px solid ${color.border}`, borderRadius: radius.md, boxShadow: shadow.elevated,
    overflow: "hidden", zIndex: 10, minWidth: 170,
  },
  menuItem: {
    display: "block", width: "100%", textAlign: "left", background: "none", border: "none",
    color: color.textSecondary, fontSize: 13, fontWeight: 600, padding: "12px 14px", cursor: "pointer", fontFamily: font.body,
  },
  heroCard: { background: color.surfaceElevated, border: `1px solid rgba(201,162,39,0.25)` },
  heroLabel: { fontSize: 10.5, fontWeight: 800, color: color.textFaint, letterSpacing: "0.06em", marginBottom: 10 },
  heroCountdown: {
    fontFamily: font.display, fontSize: 15, fontWeight: 700, color: color.goldLight,
    background: "rgba(201,162,39,0.14)", border: "1px solid rgba(201,162,39,0.35)",
    borderRadius: radius.pill, padding: "3px 10px",
  },
  ctaBtn: {
    width: "100%", marginTop: 16, background: color.goldGradient, color: color.goldOn, border: "none",
    borderRadius: radius.sm, padding: "14px 0", fontSize: 14.5, fontWeight: 800, cursor: "pointer", fontFamily: font.body,
  },
  statsErrorNote: {
    fontSize: 11, color: color.textFaint, background: color.surfaceInset, border: `1px solid ${color.borderSubtle}`,
    borderRadius: radius.sm, padding: "8px 12px", marginBottom: 10,
  },
  // 2x2, mereu — aplicația e mobile-only (max 480px), 4 coloane înghesuiau
  // textul la 9px indiferent de lățime; 2x2 lasă loc de respirat.
  statsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  statBox: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "12px 6px",
    background: color.surfaceInset, borderRadius: radius.sm,
  },
  statValue: { fontSize: 18, fontWeight: 700, color: color.textPrimary, fontFamily: font.display },
  statLabel: { fontSize: 10.5, color: color.textFaint, fontWeight: 600, textAlign: "center" },
  rankList: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 },
  seeAllBtn: {
    width: "100%", background: "none", border: "none", color: color.gold, fontSize: 12.5,
    fontWeight: 700, cursor: "pointer", padding: "6px 0 0", fontFamily: font.body,
  },
  errorBox: {
    background: color.surface, border: `1px solid ${color.redBorder}`, borderRadius: radius.lg,
    padding: "24px 18px", textAlign: "center", marginTop: 40,
  },
  errorTitle: { fontSize: 15, fontWeight: 700, color: color.textPrimary, margin: "0 0 8px" },
  errorText: { fontSize: 12.5, color: color.red, margin: "0 0 16px", lineHeight: 1.5 },
  retryBtn: {
    background: color.goldGradient, color: color.goldOn, border: "none", borderRadius: radius.sm,
    padding: "10px 20px", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: font.body,
  },
};
