import { useEffect, useRef, useState } from "react";
import { logout } from "../services/authService";
import { getCurrentSeason, getCurrentGameweek, loadUserPredictions, loadUserJoker } from "../services/predictionsService";
import { listMatches, listenLiveGameweekScores, listGameweekScores } from "../services/adminService";
import { getUserPublicProfiles } from "../services/profilesService";
import useNow from "../hooks/useNow";
import { getMatchStatus } from "../utils/matchStatus";
import { color, font, radius, shadow } from "../matchdayTheme";
import CinematicBackdrop from "../components/CinematicBackdrop";
import AppHeader from "../components/AppHeader";
import TopTabNav from "../components/TopTabNav";
import BottomTabBar from "../components/BottomTabBar";
import PremiumCard from "../components/PremiumCard";
import PremiumButton from "../components/PremiumButton";
import ClubLogo from "../components/ClubLogo";
import CompetitionLogo from "../components/CompetitionLogo";
import SplitFlapClock from "../components/SplitFlapClock";
import MatchRailCard from "../components/MatchRailCard";
import Pill from "../components/Pill";

const LOCK_MS = 30 * 60 * 1000;

// Home — reconstruit pe sistemul vizual premium. NICIO logică nouă:
// aceleași apeluri către predictionsService/adminService/profilesService
// ca înainte, doar afișarea s-a schimbat.
export default function WelcomeScreen({ user, profile, isAdmin, onOpenAdmin, onOpenPredictions, onOpenLeaderboard }) {
  const now = useNow(1000); // tick la 1s — countdown-ul hero cere secunde, nu doar minute

  const [loading, setLoading] = useState(true);
  const [criticalError, setCriticalError] = useState("");
  const [statsError, setStatsError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState("");

  const [gameweek, setGameweek] = useState(null);
  const [matches, setMatches] = useState([]);
  const [predictedCount, setPredictedCount] = useState(0);
  const [ownJoker, setOwnJoker] = useState(null);
  const [ownRow, setOwnRow] = useState(null);
  const [profiles, setProfiles] = useState({});

  // Istoric de ranguri, DOAR din sesiunea curentă — folosit ca să
  // detectăm real depășiri în clasament (nu inventăm evenimente vechi,
  // nu există un jurnal de activitate persistat în date).
  const prevRanksRef = useRef(null);
  const [feed, setFeed] = useState([]);

  function pushFeed(text, icon) {
    setFeed((prev) => [{ id: `${Date.now()}-${Math.random()}`, text, icon, ts: Date.now() }, ...prev].slice(0, 6));
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
        setStatsError("Unele statistici nu s-au putut încărca.");
      }
    })();

    async function applyRows(rows) {
      const sorted = [...rows].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
      setOwnRow(sorted.find((r) => r.uid === user.uid) || null);
      const p = await getUserPublicProfiles(sorted.map((r) => r.uid));
      setProfiles((prev) => ({ ...prev, ...p }));

      // Depășiri reale, detectate din diff-ul față de ultimul snapshot LIVE
      // primit în sesiunea curentă (nu față de un istoric persistat).
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

  // Mesaje statice de feed (derby) — derivate din datele reale deja
  // încărcate, adăugate o singură dată per etapă, nu inventate.
  const staticFeedRef = useRef(false);
  useEffect(() => {
    if (staticFeedRef.current || !gameweek || matches.length === 0) return;
    staticFeedRef.current = true;
    const featuredIds = gameweek.featuredMatchIds || [];
    const derby = matches.find((m) => featuredIds.includes(m.id));
    if (derby) {
      pushFeed(`Derby-ul etapei: ${derby.homeTeam} – ${derby.awayTeam}`, "star");
    }
  }, [gameweek, matches]);

  // FIX: meciul principal (hero) trebuie să fie mereu primul meci al
  // etapei (cronologic), indiferent dacă e deja live/blocat/terminat —
  // NU se mai schimbă la alt meci doar pentru că primul a pornit. Doar
  // conținutul din interiorul hero-ului se adaptează la starea reală
  // (getMatchStatus), nu meciul afișat.
  const allSorted = matches.slice().sort((a, b) => a.kickoffAt.toMillis() - b.kickoffAt.toMillis());
  const featuredIds = gameweek?.featuredMatchIds || [];
  const derbyMatch = allSorted.find((m) => featuredIds.includes(m.id));
  const heroMatch = derbyMatch || allSorted[0] || null;
  const heroStatus = heroMatch ? getMatchStatus(heroMatch, now) : null;
  const railMatches = allSorted.filter((m) => m.id !== heroMatch?.id);

  const remainingMs = heroMatch ? heroMatch.kickoffAt.toMillis() - LOCK_MS - now : 0;

  function handleComingSoon(label) {
    setToast(`${label} — în curând`);
    setTimeout(() => setToast(""), 1800);
  }

  function handleTopTab(id) {
    if (id === "matchday") return;
    if (id === "clasament") return onOpenLeaderboard();
    handleComingSoon(id === "dueluri" ? "Dueluri" : id === "zaruri" ? "Zaruri" : "Profil");
  }

  function handleBottomTab(id) {
    if (id === "home") return;
    if (id === "pronosticuri" || id === "meciuri") return onOpenPredictions();
    if (id === "jucatori") return onOpenLeaderboard();
    if (id === "meniu") return setMenuOpen((v) => !v);
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

  return (
    <div style={{ minHeight: "100vh", background: color.bgBase, paddingBottom: 96 }}>
      {/* ── HERO — singura zonă cu atmosferă cinematică (76vh) ── */}
      <CinematicBackdrop crowd rain style={{ height: "76vh", display: "flex", flexDirection: "column" }}>
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
                <div style={s.stakes}>{gameweek.title}{derbyMatch && heroMatch === derbyMatch ? " · Derby-ul etapei" : ""}</div>
                <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                  {heroMatch.competition && (
                    <div style={s.compPill}>
                      <CompetitionLogo name={heroMatch.competition} size={14} />
                    </div>
                  )}
                  {derbyMatch && heroMatch === derbyMatch && <Pill tone="gold">★ Derby-ul etapei</Pill>}
                  {heroStatus === "live" && <Pill tone="green">● LIVE</Pill>}
                  {heroStatus === "finished" && <Pill tone="gold">Final</Pill>}
                </div>

                <div style={s.matchup}>
                  <div style={s.side}>
                    <ClubLogo teamName={heroMatch.homeTeam} size={60} />
                    <span style={s.tname}>{heroMatch.homeTeam}</span>
                  </div>
                  <span style={s.vsx}>VS</span>
                  <div style={s.side}>
                    <ClubLogo teamName={heroMatch.awayTeam} size={60} />
                    <span style={s.tname}>{heroMatch.awayTeam}</span>
                  </div>
                </div>

                {heroStatus === "scheduled" && <div style={s.flapWrap}><SplitFlapClock remainingMs={remainingMs} /></div>}
                {heroStatus === "live" && <div style={s.liveNote}>Meciul este în desfășurare</div>}
                {heroStatus === "finished" && (
                  <div style={s.finalScore}>{heroMatch.realScoreA} – {heroMatch.realScoreB}</div>
                )}

                <div style={s.ctaWrap}><PremiumButton onClick={onOpenPredictions}>Pronosticuri</PremiumButton></div>
              </>
            ) : (
              <div style={s.centerNote}>Etapa asta nu are încă meciuri adăugate.</div>
            )
          )}
        </div>
      </CinematicBackdrop>

      {/* ── restul scenei — fundal plat, nu mai concurează cu hero-ul ── */}
      {!loading && gameweek && (
        <div style={s.wrap}>
          {statsError && <div style={s.statsErrorNote}>{statsError}</div>}

          {railMatches.length > 0 && (
            <div style={s.railSection}>
              <div style={s.sectionLabel}>Etapa continuă</div>
              <div style={s.rail}>
                {railMatches.map((m) => (
                  <MatchRailCard
                    key={m.id}
                    homeTeam={m.homeTeam}
                    awayTeam={m.awayTeam}
                    kickoffAt={m.kickoffAt}
                    competition={m.competition}
                    status={getMatchStatus(m, now)}
                    onClick={onOpenPredictions}
                  />
                ))}
              </div>
            </div>
          )}

          {feed.length > 0 && (
            <div style={s.feedSection}>
              <div style={s.sectionLabel}>Live</div>
              <div style={s.feedList}>
                {feed.map((f) => (
                  <div key={f.id} style={s.feedRow}>
                    <span style={s.feedMark}><FeedIcon name={f.icon} /></span>
                    <span style={s.feedText}>{f.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

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

function FeedIcon({ name }) {
  const common = { width: 12, height: 12, viewBox: "0 0 24 24", fill: "none", stroke: color.goldLight, strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" };
  if (name === "medal") {
    return <svg {...common}><circle cx="12" cy="14" r="6" /><path d="M9 8L7 2M15 8l2-6" /></svg>;
  }
  if (name === "star") {
    return <svg {...common}><path d="M12 3l2.6 5.9L21 9.6l-4.6 4.3L17.6 21 12 17.6 6.4 21l1.2-7.1L3 9.6l6.4-.7L12 3z" /></svg>;
  }
  return <svg {...common}><path d="M7 4h10v4a5 5 0 01-10 0V4z" /><path d="M12 13v4M9 20h6M10 17h4" /></svg>;
}

const s = {
  wrap: { maxWidth: 480, margin: "0 auto", padding: "24px 16px 0" },
  centerNote: { textAlign: "center", color: color.textSecondary, fontSize: 13.5, padding: "50px 16px" },
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

  heroBody: { flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "10px 22px 26px", textAlign: "center" },
  stakes: { fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", color: color.goldLight, textTransform: "uppercase", marginBottom: 16, fontFamily: font.body },
  matchup: { display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 22, marginBottom: 6 },
  side: { display: "flex", flexDirection: "column", alignItems: "center", gap: 9, width: 92 },
  tname: { fontFamily: font.display, fontWeight: 600, fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.02em", color: color.textPrimary },
  vsx: { fontFamily: font.display, fontSize: 10, color: color.textFaint, fontWeight: 700, paddingTop: 21 },
  flapWrap: { margin: "24px 0" },
  liveNote: { fontSize: 12, color: "#8BD957", fontWeight: 700, margin: "20px 0", fontFamily: font.body },
  finalScore: { fontFamily: font.display, fontSize: 42, fontWeight: 800, color: color.textPrimary, margin: "16px 0" },
  compPill: {
    width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
    background: color.surfaceElevated, border: `1px solid ${color.border}`,
  },
  ctaWrap: { width: "100%", maxWidth: 300 },

  sectionLabel: {
    fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase",
    color: color.textFaint, marginBottom: 12, fontFamily: font.body,
  },

  railSection: { marginBottom: 30 },
  rail: { display: "flex", gap: 9, overflowX: "auto", paddingBottom: 4 },

  feedSection: { marginBottom: 30 },
  feedList: { display: "flex", flexDirection: "column" },
  feedRow: { display: "flex", alignItems: "center", gap: 12, padding: "10px 0" },
  feedMark: {
    width: 27, height: 27, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    background: "radial-gradient(circle at 35% 30%, rgba(212,175,55,0.22), rgba(212,175,55,0.06))", border: "1px solid rgba(212,175,55,0.32)",
    boxShadow: shadow.rim,
  },
  feedText: { fontSize: 12.5, color: color.textSecondary, fontFamily: font.body },

  shortcutsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 },

  errorWrap: { maxWidth: 420, margin: "80px auto", textAlign: "center", padding: "0 20px" },
  errorTitle: { fontSize: 16, fontWeight: 700, color: color.textPrimary, marginBottom: 8, fontFamily: font.body },
  errorText: { fontSize: 12.5, color: "#E5534B", marginBottom: 18, fontFamily: font.body },
};
