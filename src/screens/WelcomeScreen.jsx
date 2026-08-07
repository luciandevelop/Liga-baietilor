import { useEffect, useRef, useState } from "react";
import { logout } from "../services/authService";
import { getCurrentSeason, getCurrentGameweek, loadUserPredictions, loadUserJoker } from "../services/predictionsService";
import { listMatches, listenLiveGameweekScores, listGameweekScores } from "../services/adminService";
import { getUserPublicProfiles } from "../services/profilesService";
import useNow from "../hooks/useNow";
import { usePrefersReducedMotion } from "../motion";
import { getMatchStatus } from "../utils/matchStatus";
import { color, font, radius, shadow } from "../matchdayTheme";
import CinematicBackdrop from "../components/CinematicBackdrop";
import AppHeader from "../components/AppHeader";
import TopTabNav from "../components/TopTabNav";
import BottomTabBar from "../components/BottomTabBar";
import PremiumCard from "../components/PremiumCard";
import PremiumButton from "../components/PremiumButton";
import ClubLogo from "../components/ClubLogo";
import CompetitionBadge from "../components/CompetitionBadge";
import { getCompetitionTheme } from "../competitionThemes";
import SplitFlapClock from "../components/SplitFlapClock";
import MatchRailCard from "../components/MatchRailCard";
import Pill from "../components/Pill";

const LOCK_MS = 30 * 60 * 1000;

const CTA_LABEL = {
  scheduled: "Pune pronosticul",
  live: "Vezi LIVE",
  paused: "Vezi LIVE",
  finished: "Vezi rezultate",
  postponed: "Vezi meciul",
  cancelled: "Vezi meciul",
};

// Home — Sprint 1 "Home Premium". Aceeași logică de date ca înainte
// (niciun apel nou către Firestore) — doar experiența Home + navigarea
// s-au schimbat, cum a fost cerut explicit.
export default function WelcomeScreen({ user, profile, isAdmin, onOpenAdmin, onOpenPredictions, onOpenLeaderboard }) {
  const now = useNow(1000);
  const reduced = usePrefersReducedMotion();

  const [loading, setLoading] = useState(true);
  const [criticalError, setCriticalError] = useState("");
  const [statsError, setStatsError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [toast, setToast] = useState("");

  const [gameweek, setGameweek] = useState(null);
  const [matches, setMatches] = useState([]);
  const [predictions, setPredictions] = useState({});
  const [ownJoker, setOwnJoker] = useState(null);
  const [ownRow, setOwnRow] = useState(null);
  const [profiles, setProfiles] = useState({});

  const prevRanksRef = useRef(null);
  const [feed, setFeed] = useState([]);

  function pushFeed(text, icon) {
    setFeed((prev) => [{ id: `${Date.now()}-${Math.random()}`, text, icon, ts: Date.now(), mock: false }, ...prev].slice(0, 6));
  }

  function load() {
    let unsub = null;
    (async () => {
      setLoading(true);
      setCriticalError("");
      setStatsError("");
      prevRanksRef.current = null;
      setFeed([]);

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

      try {
        const preds = await loadUserPredictions(user.uid, m.map((x) => x.id));
        setPredictions(preds);
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
        setStatsError("Unele statistici nu s-au putut încărca.");
      }
    })();

    async function applyRows(rows) {
      const sorted = [...rows].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
      setOwnRow(sorted.find((r) => r.uid === user.uid) || null);
      const p = await getUserPublicProfiles(sorted.map((r) => r.uid));
      setProfiles((prev) => ({ ...prev, ...p }));

      const prevRanks = prevRanksRef.current;
      if (prevRanks) {
        sorted.forEach((r) => {
          const before = prevRanks[r.uid];
          if (before !== undefined && r.rank < before) {
            const meName = p[r.uid]?.nickname || r.uid;
            pushFeed(`${meName} a urcat pe locul #${r.rank}`, "medal");
          }
        });
      }
      const nextRanks = {};
      sorted.forEach((r) => { nextRanks[r.uid] = r.rank; });
      prevRanksRef.current = nextRanks;
    }

    return () => { if (unsub) unsub(); };
  }

  useEffect(load, [user.uid]);

  const staticFeedRef = useRef(false);
  useEffect(() => {
    if (staticFeedRef.current || !gameweek || matches.length === 0) return;
    staticFeedRef.current = true;
    const featuredIds = gameweek.featuredMatchIds || [];
    const motw = matches.find((m) => featuredIds.includes(m.id));
    if (motw) pushFeed(`Meciul Săptămânii: ${motw.homeTeam} – ${motw.awayTeam} (Punctaj Dublu)`, "star");
  }, [gameweek, matches]);

  // Meciul principal (hero) — prioritate STRICTĂ, cerută explicit:
  //   1. primul meci LIVE (sau Pauză — tot "în desfășurare")
  //   2. dacă nu există → primul PROGRAMAT (cel mai apropiat)
  //   3. dacă toate sunt FINAL/altceva → ultimul meci TERMINAT
  // Derby-ul are prioritate DOAR în interiorul bucket-ului ales — nu mai
  // poate scoate în față un meci FINAL cât timp mai există LIVE/PROGRAMAT.
  const allSorted = matches.slice().sort((a, b) => a.kickoffAt.toMillis() - b.kickoffAt.toMillis());
  const featuredIds = gameweek?.featuredMatchIds || [];

  const liveBucket = allSorted.filter((m) => ["live", "paused"].includes(getMatchStatus(m, now)));
  const scheduledBucket = allSorted.filter((m) => getMatchStatus(m, now) === "scheduled");
  const finishedBucket = allSorted
    .filter((m) => getMatchStatus(m, now) === "finished")
    .slice()
    .sort((a, b) => b.kickoffAt.toMillis() - a.kickoffAt.toMillis()); // cel mai recent primul

  const heroPool = liveBucket.length ? liveBucket : scheduledBucket.length ? scheduledBucket : finishedBucket;
  const featuredMatch = heroPool.find((m) => featuredIds.includes(m.id));
  const heroMatch = featuredMatch || heroPool[0] || allSorted[0] || null;
  const heroStatus = heroMatch ? getMatchStatus(heroMatch, now) : null;
  const heroTheme = heroMatch ? getCompetitionTheme(heroMatch.competitionId) : null;
  // Rail-ul "Urmează" — doar meciuri care CHIAR urmează: statusul real
  // (nu cel brut din Firestore) trebuie să fie "scheduled". Un meci rămas
  // pe status "scheduled" în bază dar cu ora deja trecută e tratat LIVE
  // de getMatchStatus și dispare automat de-aici, cum a fost cerut.
  const railMatches = allSorted.filter((m) => m.id !== heroMatch?.id && getMatchStatus(m, now) === "scheduled");
  const remainingMs = heroMatch ? heroMatch.kickoffAt.toMillis() - LOCK_MS - now : 0;

  const predictedCount = Object.keys(predictions).length;
  const totalMatches = matches.length;
  const firstUnpredicted = allSorted.find((m) => !predictions[m.id]);

  function handleComingSoon(label) {
    setToast(`${label} — în curând`);
    setTimeout(() => setToast(""), 1800);
  }

  function handleTopTab(id) {
    if (id === "matchday") return;
    if (id === "clasament") return onOpenLeaderboard();
    if (id === "profil") return setMenuOpen((v) => !v);
  }

  function handleBottomTab(id) {
    if (id === "home") return;
    if (id === "pronosticuri") return onOpenPredictions();
    if (id === "clasament") return onOpenLeaderboard();
    if (id === "profil") return setMenuOpen((v) => !v);
  }

  if (criticalError) {
    return (
      <div style={{ minHeight: "100vh", background: color.bgBase }}>
        <div style={s.errorWrap}>
          <p style={s.errorTitle}>Nu s-a putut încărca Home</p>
          <p style={s.errorText}>{criticalError}</p>
          <PremiumButton onClick={load}>Încearcă din nou</PremiumButton>
        </div>
      </div>
    );
  }

  const recentResults = matches
    .filter((m) => getMatchStatus(m, now) === "finished")
    .sort((a, b) => b.kickoffAt.toMillis() - a.kickoffAt.toMillis())
    .slice(0, 5);

  // Feed: evenimente REALE (depășiri de rang, derby) + câteva exemple
  // ilustrative, marcate explicit `mock: true` — cerute punctual pentru
  // acest sprint, până există un jurnal real de evenimente (Joker
  // folosit, scor exact ghicit). Nu se amestecă vizual ca fiind reale.
  const mockFeedExtra = [
    { id: "mock-1", text: "Cineva a activat Joker pe un meci al etapei", icon: "joker", mock: true },
    { id: "mock-2", text: "Cineva a ghicit un scor exact", icon: "star", mock: true },
  ];
  const feedItems = [...feed, ...mockFeedExtra].slice(0, 6);

  return (
    <div style={{ minHeight: "100vh", background: color.bgBase, paddingBottom: 96 }}>
      {/* ── HERO — comprimat, ~50% din ecran ── */}
      <CinematicBackdrop crowd rain style={{ height: "50vh", minHeight: 340, display: "flex", flexDirection: "column" }}>
        <AppHeader
          nickname={profile?.nickname || "Jucător"}
          points={(ownRow?.totalPoints ?? profile?.seasonPoints ?? 0).toLocaleString("ro-RO")}
          avatarInitial={(profile?.nickname || "?").charAt(0).toUpperCase()}
          hasNotification={feed.length > 0}
          onAvatarClick={() => setMenuOpen((v) => !v)}
          onBellClick={() => setMenuOpen((v) => !v)}
        />
        <TopTabNav active="matchday" onChange={handleTopTab} />

        {menuOpen && (
          <div style={s.menu}>
            {isAdmin && <button style={s.menuItem} onClick={onOpenAdmin} type="button">⚙️ Panou Admin</button>}
            <button style={{ ...s.menuItem, color: "#E5534B" }} onClick={logout} type="button">Deconectează-te</button>
          </div>
        )}

        {toast && <div style={s.toast}>{toast}</div>}

        <div style={s.heroBody}>
          {loading && <div style={s.centerNote}>Se încarcă…</div>}
          {!loading && !gameweek && <div style={s.centerNote}>Nu există o etapă activă în această săptămână.</div>}

          {!loading && gameweek && (
            heroMatch ? (
              <>
                <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                  <div style={{
                    padding: "5px 12px", borderRadius: 999,
                    border: `1px solid ${heroTheme.borderColor}`,
                    boxShadow: `0 0 14px ${heroTheme.glowColor}`,
                    background: heroTheme.badgeBackground,
                  }}>
                    <CompetitionBadge match={heroMatch} size="md" />
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                  {featuredMatch && heroMatch === featuredMatch && <span style={s.motwBadge}>⭐ Meciul Săptămânii · Punctaj Dublu</span>}
                  {heroStatus === "live" && <Pill tone="green">● LIVE</Pill>}
                  {heroStatus === "paused" && <Pill tone="gold">Pauză</Pill>}
                  {heroStatus === "finished" && <Pill tone="gold">Final</Pill>}
                  {heroStatus === "postponed" && <Pill tone="gold">Amânat</Pill>}
                  {heroStatus === "cancelled" && <Pill tone="gold">Anulat</Pill>}
                </div>

                <div style={s.matchup}>
                  <div style={s.side}>
                    <ClubLogo teamName={heroMatch.homeTeam} size={42} />
                    <span style={s.tname}>{heroMatch.homeTeam}</span>
                  </div>
                  <span style={s.vsx}>VS</span>
                  <div style={s.side}>
                    <ClubLogo teamName={heroMatch.awayTeam} size={42} />
                    <span style={s.tname}>{heroMatch.awayTeam}</span>
                  </div>
                </div>

                {heroStatus === "scheduled" && (
                  <div style={s.flapWrap}>
                    <div style={s.lockLabel}>Se blochează în</div>
                    <SplitFlapClock remainingMs={remainingMs} />
                  </div>
                )}
                {heroStatus === "live" && <div style={s.liveNote}>LIVE · rezultat neintrodus încă</div>}
                {heroStatus === "paused" && <div style={s.liveNote}>Meciul e la pauză</div>}
                {heroStatus === "finished" && <div style={s.finalScore}>{heroMatch.realScoreA} – {heroMatch.realScoreB}</div>}
                {heroStatus === "postponed" && <div style={s.liveNote}>Meci amânat — dată nouă în curând</div>}
                {heroStatus === "cancelled" && <div style={s.liveNote}>Meci anulat</div>}

                <div style={s.ctaWrap}><PremiumButton onClick={onOpenPredictions}>{CTA_LABEL[heroStatus]}</PremiumButton></div>
              </>
            ) : (
              <div style={s.centerNote}>Etapa asta nu are încă meciuri adăugate.</div>
            )
          )}
        </div>
      </CinematicBackdrop>

      {!loading && gameweek && (
        <div style={s.wrap}>
          {statsError && <div style={s.statsErrorNote}>{statsError}</div>}

          {totalMatches > 0 && (
            <PressableCard reduced={reduced} onClick={() => onOpenPredictions(firstUnpredicted?.id)} style={{ marginBottom: 18 }}>
              <div style={s.progressTop}>
                <span style={s.progressLabel}>Progres etapă</span>
                <span style={s.progressCount}>{predictedCount}/{totalMatches}</span>
              </div>
              <div style={s.progressTrack}>
                <div style={{ ...s.progressFill, width: `${totalMatches ? (predictedCount / totalMatches) * 100 : 0}%` }} />
              </div>
              <div style={s.progressNote}>
                {predictedCount >= totalMatches ? "Etapa este completă." : `Mai ai ${totalMatches - predictedCount} meciuri.`}
              </div>
            </PressableCard>
          )}

          {railMatches.length > 0 && (
            <div style={s.railSection}>
              <div style={s.sectionLabel}>Urmează</div>
              <div style={s.rail}>
                {railMatches.map((m, i) => (
                  <MatchRailCard
                    key={m.id}
                    match={m}
                    now={now}
                    emphasizeCountdown={i < 3}
                    isFeatured={featuredIds.includes(m.id)}
                    onClick={onOpenPredictions}
                  />
                ))}
              </div>
            </div>
          )}

          {recentResults.length > 0 && (
            <div style={s.railSection}>
              <button type="button" onClick={() => setResultsOpen((v) => !v)} style={s.accordionHeader}>
                <span style={s.sectionLabel}>Ultimele rezultate ({recentResults.length})</span>
                <span style={{ ...s.accordionChevron, transform: resultsOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
              </button>
              <div style={{ ...s.accordionBody, gridTemplateRows: resultsOpen ? "1fr" : "0fr" }}>
                <div style={{ overflow: "hidden" }}>
                  <div style={s.resultsList}>
                    {recentResults.map((m) => (
                      <button key={m.id} type="button" onClick={onOpenPredictions} style={s.resultRow}>
                        <ClubLogo teamName={m.homeTeam} size={24} />
                        <span style={s.resultName}>{m.homeTeam}</span>
                        <span style={s.resultScore}>{m.realScoreA} – {m.realScoreB}</span>
                        <span style={s.resultName}>{m.awayTeam}</span>
                        <ClubLogo teamName={m.awayTeam} size={24} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div style={s.feedSection}>
            <div style={s.sectionLabel}>Activitate</div>
            <div style={s.feedList}>
              {feedItems.map((f) => (
                <div key={f.id} style={s.feedRow}>
                  <span style={s.feedMark}><FeedIcon name={f.icon} /></span>
                  <span style={s.feedText}>{f.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={s.sectionLabel}>Specialul săptămânii</div>
          <PressableCard reduced={reduced} onClick={() => handleComingSoon("Surpriza Etapei")} style={{ marginBottom: 18 }}>
            <div style={s.specialTop}>
              <span style={s.specialName}>Surpriza Etapei</span>
              <span style={s.specialState}>Blocat</span>
            </div>
            <div style={s.specialDesc}>Un mod special diferit în fiecare etapă — puncte în plus, risc în plus.</div>
            <div style={s.specialBtn}>Vezi detalii</div>
          </PressableCard>

          <div style={s.sectionLabel}>Explorează</div>
          <div style={s.shortcutsGrid}>
            <PremiumCard tone="gold" title="Clasament" subtitle="Competiție" onClick={onOpenLeaderboard} />
            <PremiumCard tone="purple" title="Dueluri" subtitle="Rivalitate" locked lockCondition="În curând" onClick={() => handleComingSoon("Dueluri")} />
            <PremiumCard tone="green" title="Zaruri" subtitle="Risc" locked lockCondition="În curând" onClick={() => handleComingSoon("Zaruri")} />
            <PremiumCard tone="blue" title="Echipa Etapei" subtitle="Prestigiu" locked lockCondition="După primul meci" onClick={() => handleComingSoon("Echipa Etapei")} />
          </div>
        </div>
      )}

      <BottomTabBar active="home" onChange={handleBottomTab} />
    </div>
  );
}

// Wrapper unic pentru cardurile "de bloc" (progres, special) — aceeași
// rază, umbră, padding și animație de apăsare peste tot (cerința #9).
function PressableCard({ children, onClick, reduced, style }) {
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={(e) => { if (!reduced) e.currentTarget.style.transform = "scale(0.985)"; }}
      onPointerUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
      onPointerLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
      style={{
        display: "block", width: "100%", textAlign: "left", background: color.surface,
        border: `1px solid ${color.border}`, borderRadius: radius.lg, padding: 16,
        boxShadow: shadow.card, cursor: "pointer", transition: "transform 90ms cubic-bezier(.4,0,.2,1)",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function FeedIcon({ name }) {
  const common = { width: 12, height: 12, viewBox: "0 0 24 24", fill: "none", stroke: color.goldLight, strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" };
  if (name === "medal") return <svg {...common}><circle cx="12" cy="14" r="6" /><path d="M9 8L7 2M15 8l2-6" /></svg>;
  if (name === "star") return <svg {...common}><path d="M12 3l2.6 5.9L21 9.6l-4.6 4.3L17.6 21 12 17.6 6.4 21l1.2-7.1L3 9.6l6.4-.7L12 3z" /></svg>;
  if (name === "joker") return <svg {...common}><rect x="5" y="4" width="14" height="16" rx="2" /><path d="M9 9h6M9 13h6M9 17h3" /></svg>;
  return <svg {...common}><path d="M7 4h10v4a5 5 0 01-10 0V4z" /><path d="M12 13v4M9 20h6M10 17h4" /></svg>;
}

const s = {
  wrap: { maxWidth: 480, margin: "0 auto", padding: "16px 16px 0" },
  centerNote: { textAlign: "center", color: color.textSecondary, fontSize: 13.5, padding: "40px 16px" },
  statsErrorNote: {
    fontSize: 11, color: color.textFaint, background: color.surfaceInset, border: `1px solid ${color.border}`,
    borderRadius: radius.sm, padding: "8px 12px", marginBottom: 14,
  },

  menu: {
    position: "absolute", top: 62, right: 16, background: color.surfaceElevated,
    border: `1px solid ${color.border}`, borderRadius: radius.md, boxShadow: shadow.elevated,
    overflow: "hidden", zIndex: 60, minWidth: 180,
  },
  menuItem: {
    display: "block", width: "100%", textAlign: "left", background: "none", border: "none",
    color: color.textPrimary, fontSize: 13, fontWeight: 600, padding: "12px 14px", cursor: "pointer", fontFamily: font.body,
  },
  toast: {
    position: "fixed", left: "50%", top: 92, transform: "translateX(-50%)", zIndex: 70,
    background: color.surfaceElevated, border: `1px solid ${color.goldBorder}`, color: color.goldLight,
    borderRadius: radius.pill, padding: "8px 16px", fontSize: 12, fontWeight: 700, fontFamily: font.body,
    boxShadow: shadow.elevated,
  },

  heroBody: { flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "6px 20px 16px", textAlign: "center" },
  matchup: { display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 16, marginBottom: 4 },
  side: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: 78 },
  tname: { fontFamily: font.display, fontWeight: 600, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.02em", color: color.textPrimary },
  vsx: { fontFamily: font.display, fontSize: 9, color: color.textFaint, fontWeight: 700, paddingTop: 14 },
  flapWrap: { margin: "12px 0 14px", transform: "scale(0.82)" },
  lockLabel: { fontSize: 10, fontWeight: 700, color: color.textFaint, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6, fontFamily: font.body },
  liveNote: { fontSize: 11.5, color: "#8BD957", fontWeight: 700, margin: "12px 0", fontFamily: font.body },
  finalScore: { fontFamily: font.display, fontSize: 30, fontWeight: 800, color: color.textPrimary, margin: "8px 0 12px" },
  ctaWrap: { width: "100%", maxWidth: 280 },
  motwBadge: {
    display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 800, color: "#241B05",
    background: "linear-gradient(180deg, #FFF6D9, #D4AF37)", padding: "4px 10px", borderRadius: 999,
    fontFamily: font.body, boxShadow: "0 0 12px rgba(212,175,55,0.45)",
  },

  sectionLabel: {
    fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase",
    color: color.textFaint, marginBottom: 10, fontFamily: font.body,
  },

  progressTop: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  progressLabel: { fontSize: 12.5, fontWeight: 700, color: color.textPrimary, fontFamily: font.body },
  progressCount: { fontFamily: font.display, fontSize: 14, color: color.goldLight, fontWeight: 700 },
  progressTrack: { height: 6, borderRadius: 999, background: color.surfaceInset, overflow: "hidden", marginBottom: 8 },
  progressFill: { height: "100%", background: color.goldGradient, borderRadius: 999, transition: "width 300ms ease" },
  progressNote: { fontSize: 11.5, color: color.textSecondary, fontFamily: font.body },

  railSection: { marginBottom: 22 },
  rail: { display: "flex", gap: 9, overflowX: "auto", paddingBottom: 4 },

  accordionHeader: {
    display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
    background: "none", border: "none", padding: 0, marginBottom: 0, cursor: "pointer",
  },
  accordionChevron: { color: color.textFaint, fontSize: 13, transition: "transform 220ms ease", marginBottom: 10 },
  accordionBody: { display: "grid", transition: "grid-template-rows 260ms ease" },

  resultsList: { display: "flex", flexDirection: "column", gap: 1, background: color.surface, borderRadius: radius.lg, overflow: "hidden", border: `1px solid ${color.border}` },
  resultRow: {
    display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "none", border: "none",
    borderBottom: `1px solid ${color.borderSubtle}`, cursor: "pointer", width: "100%", textAlign: "left",
  },
  resultName: { flex: 1, fontSize: 11.5, color: color.textSecondary, fontWeight: 600, fontFamily: font.body, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  resultScore: { fontSize: 13, color: color.textPrimary, fontWeight: 800, fontFamily: font.display, flexShrink: 0, padding: "0 4px" },

  feedSection: { marginBottom: 22 },
  feedList: { display: "flex", flexDirection: "column" },
  feedRow: { display: "flex", alignItems: "center", gap: 12, padding: "9px 0" },
  feedMark: {
    width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    background: "radial-gradient(circle at 35% 30%, rgba(212,175,55,0.22), rgba(212,175,55,0.06))", border: "1px solid rgba(212,175,55,0.32)",
    boxShadow: shadow.rim,
  },
  feedText: { fontSize: 12, color: color.textSecondary, fontFamily: font.body },

  specialTop: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  specialName: { fontFamily: font.display, fontSize: 14, fontWeight: 700, color: color.textPrimary },
  specialState: {
    fontSize: 9.5, fontWeight: 800, letterSpacing: "0.04em", color: color.textFaint,
    background: color.surfaceInset, border: `1px solid ${color.border}`, borderRadius: 999, padding: "3px 9px",
  },
  specialDesc: { fontSize: 11.5, color: color.textSecondary, fontFamily: font.body, marginBottom: 12, lineHeight: 1.4 },
  specialBtn: { fontSize: 11.5, fontWeight: 700, color: color.goldLight, fontFamily: font.body },

  shortcutsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 },

  errorWrap: { maxWidth: 420, margin: "80px auto", textAlign: "center", padding: "0 20px" },
  errorTitle: { fontSize: 16, fontWeight: 700, color: color.textPrimary, marginBottom: 8, fontFamily: font.body },
  errorText: { fontSize: 12.5, color: "#E5534B", marginBottom: 18, fontFamily: font.body },
};
