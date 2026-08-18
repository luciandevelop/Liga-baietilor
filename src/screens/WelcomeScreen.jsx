import { useEffect, useRef, useState } from "react";
import { getCurrentSeason, getCurrentGameweek, loadUserPredictions, loadUserJoker, isMatchLocked } from "../services/predictionsService";
import { listMatches, listenLiveGameweekScores, listGameweekScores, getUserSeasonPoints, listJokersForGameweek } from "../services/adminService";
import { getUserPublicProfiles } from "../services/profilesService";
import { processRankChanges, processFinishedMatches, processJokerActivation, processUpcomingMatches, loadFullFeed } from "../services/feedService";
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
import CompetitionHeaderStrip from "../components/CompetitionHeaderStrip";
import { getCompetitionTheme } from "../competitionThemes";
import SplitFlapClock from "../components/SplitFlapClock";
import MatchRailCard from "../components/MatchRailCard";
import Pill from "../components/Pill";
import FeedCard from "../components/FeedCard";
import FeedDetailModal from "../components/FeedDetailModal";
import PredictionsRevealSheet from "../components/PredictionsRevealSheet";

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
export default function WelcomeScreen({ user, profile, isAdmin, onOpenAdmin, onOpenPredictions, onOpenLeaderboard, onOpenSpecials, onOpenFeed, onOpenProfile }) {
  const now = useNow(1000);
  const reduced = usePrefersReducedMotion();

  const [loading, setLoading] = useState(true);
  const [criticalError, setCriticalError] = useState("");
  const [statsError, setStatsError] = useState("");
  const [resultsOpen, setResultsOpen] = useState(false);
  const [toast, setToast] = useState("");

  const [gameweek, setGameweek] = useState(null);
  const [matches, setMatches] = useState([]);
  const [predictions, setPredictions] = useState({});
  const [ownJoker, setOwnJoker] = useState(null);
  const [ownRow, setOwnRow] = useState(null);
  // Citit proaspăt, separat de `profile` (stale după login) — sursa
  // reală pentru header. Pornește din `profile.seasonPoints` (ca să nu
  // arate 0 o clipă la încărcare), apoi se suprascrie cu valoarea reală.
  const [freshSeasonPoints, setFreshSeasonPoints] = useState(profile?.seasonPoints ?? null);
  const [profiles, setProfiles] = useState({});

  const [feedTop, setFeedTop] = useState([]);
  const [selectedFeedEvent, setSelectedFeedEvent] = useState(null);
  const [revealMatch, setRevealMatch] = useState(null); // meciul LIVE deschis cu 👁, sau null
  const processedJokersRef = useRef(new Set());

  async function refreshFeedTop() {
    try {
      const { merged } = await loadFullFeed();
      setFeedTop(merged.slice(0, 8));
    } catch (err) {
      console.error("Eroare la reîmprospătarea Feed-ului:", err);
    }
  }

  function load() {
    let unsub = null;
    (async () => {
      setLoading(true);
      setCriticalError("");
      setStatsError("");
      refreshFeedTop();

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

        // Meciuri terminate → eveniment de scor final. Sigur de rulat de
        // fiecare dată (ID determinist per meci -> Firestore ignoră
        // duplicatele, nu se creează a doua oară).
        const finished = m.filter((x) => x.status === "finished" && x.realScoreA != null && x.realScoreB != null);
        if (finished.length > 0) {
          processFinishedMatches(finished).then((evs) => { if (evs.length > 0) refreshFeedTop(); }).catch((err) => console.error("Eroare Feed meciuri:", err));
        }

        // Jokerii TUTUROR jucătorilor, nu doar al userului curent —
        // `processedJokersRef` evită re-anunțarea în aceeași sesiune,
        // ID-ul determinist evită duplicarea în Firestore.
        listJokersForGameweek(gw.id).then(async (jokers) => {
          const newOnes = jokers.filter((j) => !processedJokersRef.current.has(`${j.gameweekId}_${j.userId}`));
          if (newOnes.length === 0) return;
          const profilesForJokers = await getUserPublicProfiles(newOnes.map((j) => j.userId));
          let any = false;
          for (const j of newOnes) {
            processedJokersRef.current.add(`${j.gameweekId}_${j.userId}`);
            const jm = m.find((x) => x.id === j.matchId);
            const nickname = profilesForJokers[j.userId]?.nickname || j.userId;
            if (jm) { await processJokerActivation(j, jm, nickname); any = true; }
          }
          if (any) refreshFeedTop();
        }).catch((err) => console.error("Eroare Feed jokeri:", err));

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

      // Clasamentul General (nu doar etapa curentă) — motorul de Feed
      // decide singur ce merită raportat (lider nou, podium, top 10,
      // salturi mari), nu textul de aici. Rezultatul se scrie o dată în
      // Firestore (ID determinist -> fără duplicate), apoi Feed-ul se
      // reîmprospătează din sursa unică (loadFullFeed).
      try {
        const { events } = await processRankChanges();
        if (events.length > 0) await refreshFeedTop();
      } catch (err) {
        console.error("Eroare la procesarea evenimentelor de clasament:", err);
      }
    }

    return () => { if (unsub) unsub(); };
  }

  useEffect(load, [user.uid]);

  // Punctajul general — reîmprospătat de fiecare dată când se deschide
  // Home, nu doar la login. Fără asta, dacă o etapă se finalizează cât
  // userul rămâne conectat, header-ul rămânea blocat la cifra veche.
  useEffect(() => {
    getUserSeasonPoints(user.uid)
      .then(setFreshSeasonPoints)
      .catch((err) => console.error("Eroare la reîmprospătarea punctajului din header:", err));
  }, [user.uid]);

  const staticFeedRef = useRef(false);
  useEffect(() => {
    if (staticFeedRef.current || !gameweek || matches.length === 0) return;
    staticFeedRef.current = true;
    const featuredIds = gameweek.featuredMatchIds || [];
    // Toate meciurile care urmează (fereastră 7 zile), nu doar Meciul
    // Săptămânii — fiecare primește context editorial STRICT dacă
    // există conținut pentru echipele respective (regula zero).
    processUpcomingMatches(matches, featuredIds)
      .then((events) => { if (events.length > 0) refreshFeedTop(); })
      .catch((err) => console.error("Eroare Feed meciuri viitoare:", err));
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
  // Hero = ÎNTOTDEAUNA meciul cel mai apropiat cronologic (heroPool[0],
  // deja sortat). "Meciul Săptămânii" NU mai forțează prioritate peste
  // ordinea cronologică — dacă e departe în timp, insigna lui apare
  // doar când chiar el ajunge să fie următorul meci, nu mai devreme.
  // Bug real, semnalat direct: Espanyol–Real Madrid (93h) bloca hero-ul
  // în fața unor meciuri cu mult mai apropiate (Celtic–LASK, 21h).
  const heroMatch = heroPool[0] || allSorted[0] || null;
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
    if (id === "profil") return onOpenProfile();
  }

  function handleBottomTab(id) {
    if (id === "home") return;
    if (id === "pronosticuri") return onOpenPredictions();
    if (id === "clasament") return onOpenLeaderboard();
    if (id === "speciale") return onOpenSpecials();
    if (id === "profil") return onOpenProfile();
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

  return (
    <div style={{ minHeight: "100vh", background: color.bgBase, paddingBottom: 96 }}>
      {/* ── HERO — comprimat, ~50% din ecran ── */}
      <CinematicBackdrop crowd rain style={{ minHeight: 480, display: "flex", flexDirection: "column" }}>
        <AppHeader
          nickname={profile?.nickname || "Jucător"}
          points={(freshSeasonPoints ?? profile?.seasonPoints ?? ownRow?.totalPoints ?? 0).toLocaleString("ro-RO")}
          avatarId={profile?.avatarId}
          hasNotification={feedTop.some((e) => e.important)}
          onAvatarClick={onOpenProfile}
          onBellClick={() => handleComingSoon("Notificări")}
        />
        <TopTabNav active="matchday" onChange={handleTopTab} />

        {toast && <div style={s.toast}>{toast}</div>}

        <div style={s.heroBody}>
          {loading && <div style={s.centerNote}>Se încarcă…</div>}
          {!loading && !gameweek && <div style={s.centerNote}>Nu există o etapă activă în această săptămână.</div>}

          {!loading && gameweek && (
            heroMatch ? (
              <div style={s.heroCard}>
                <CompetitionHeaderStrip match={heroMatch} size="lg" />

                <div style={s.heroCardBody}>
                  {(featuredMatch && heroMatch === featuredMatch) || heroStatus !== "scheduled" ? (
                    <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                      {featuredMatch && heroMatch === featuredMatch && <span style={s.motwBadge}>⭐ Meciul Săptămânii · Punctaj Dublu</span>}
                      {heroStatus === "live" && <Pill tone="green">● LIVE</Pill>}
                      {heroStatus === "paused" && <Pill tone="gold">Pauză</Pill>}
                      {heroStatus === "finished" && <Pill tone="gold">Final</Pill>}
                      {heroStatus === "postponed" && <Pill tone="gold">Amânat</Pill>}
                      {heroStatus === "cancelled" && <Pill tone="gold">Anulat</Pill>}
                    </div>
                  ) : null}

                  <div style={s.matchup}>
                    <div style={s.side}>
                      <div style={s.logoRing}><ClubLogo teamName={heroMatch.homeTeam} size={60} /></div>
                      <span style={s.tname}>{heroMatch.homeTeam}</span>
                    </div>
                    <span style={s.vsx}>VS</span>
                    <div style={s.side}>
                      <div style={s.logoRing}><ClubLogo teamName={heroMatch.awayTeam} size={60} /></div>
                      <span style={s.tname}>{heroMatch.awayTeam}</span>
                    </div>
                  </div>

                  {heroStatus === "scheduled" && (
                    <div style={s.flapWrap}>
                      <div style={s.lockLabel}>Se blochează în</div>
                      <SplitFlapClock remainingMs={remainingMs} />
                    </div>
                  )}
                  {heroStatus === "scheduled" && heroMatch && isMatchLocked(heroMatch) && (
                    <button type="button" style={s.eyeBtn} onClick={() => setRevealMatch(heroMatch)} aria-label="Vezi pronosticurile">
                      👁 <span style={s.eyeBtnLabel}>Vezi pronosticurile blocate</span>
                    </button>
                  )}
                  {heroStatus === "live" && (
                    <div style={s.liveRevealWrap}>
                      <div style={s.liveNote}>LIVE · rezultat neintrodus încă</div>
                      <button type="button" style={s.eyeBtn} onClick={() => setRevealMatch(heroMatch)} aria-label="Vezi pronosticurile">
                        👁 <span style={s.eyeBtnLabel}>Cine mai e în joc?</span>
                      </button>
                    </div>
                  )}
                  {heroStatus === "paused" && <div style={s.liveNote}>Meciul e la pauză</div>}
                  {heroStatus === "finished" && <div style={s.finalScore}>{heroMatch.realScoreA} – {heroMatch.realScoreB}</div>}
                  {heroStatus === "postponed" && <div style={s.liveNote}>Meci amânat — dată nouă în curând</div>}
                  {heroStatus === "cancelled" && <div style={s.liveNote}>Meci anulat</div>}

                  <div style={s.ctaWrap}><PremiumButton onClick={() => onOpenPredictions(heroMatch?.id)}>{CTA_LABEL[heroStatus]}</PremiumButton></div>
                </div>
              </div>
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
                    featuredIndex={featuredIds.includes(m.id) ? featuredIds.indexOf(m.id) + 1 : null}
                    onClick={() => onOpenPredictions(m.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {recentResults.length > 0 && (
            <div style={s.railSection}>
              <div style={s.sectionLabel}>Ultimele rezultate</div>
              <div style={s.resultsList}>
                {/* Implicit vizibil: DOAR ultimul meci terminat. */}
                <ResultRow match={recentResults[0]} onClick={() => onOpenPredictions(recentResults[0].id)} />

                {recentResults.length > 1 && (
                  <>
                    <div style={{ ...s.accordionBody, gridTemplateRows: resultsOpen ? "1fr" : "0fr" }}>
                      <div style={{ overflow: "hidden" }}>
                        {recentResults.slice(1).map((m) => (
                          <ResultRow key={m.id} match={m} onClick={() => onOpenPredictions(m.id)} />
                        ))}
                      </div>
                    </div>
                    <button type="button" onClick={() => setResultsOpen((v) => !v)} style={s.accordionToggle}>
                      <span>{resultsOpen ? "Arată mai puține" : `Încă ${recentResults.length - 1}`}</span>
                      <span style={{ ...s.accordionChevron, transform: resultsOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          <div style={s.feedSection}>
            <div style={s.feedSectionHead}>
              <div style={s.sectionLabel}>📰 Feed</div>
              {onOpenFeed && <button type="button" style={s.seeAllBtn} onClick={onOpenFeed}>Vezi tot →</button>}
            </div>
            <div style={s.feedList}>
              {feedTop.length === 0 && <div style={s.feedEmpty}>Niciun eveniment încă — revino după primele rezultate.</div>}
              {feedTop.map((e) => (
                <FeedCard key={e.id} event={e} now={now} onClick={setSelectedFeedEvent} compact />
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
      <FeedDetailModal event={selectedFeedEvent} onClose={() => setSelectedFeedEvent(null)} />
      {revealMatch && (
        <PredictionsRevealSheet
          match={revealMatch}
          isFeatured={(gameweek?.featuredMatchIds || []).includes(revealMatch.id)}
          currentUserId={user.uid}
          isAdmin={isAdmin}
          onClose={() => setRevealMatch(null)}
        />
      )}
    </div>
  );
}

// Un singur rând de rezultat — extras ca să fie refolosit atât pentru
// meciul mereu-vizibil, cât și pentru cele ascunse în accordion.
function ResultRow({ match: m, onClick }) {
  return (
    <button type="button" onClick={onClick} style={s.resultRow}>
      <ClubLogo teamName={m.homeTeam} size={24} />
      <span style={s.resultName}>{m.homeTeam}</span>
      <span style={s.resultScore}>{m.realScoreA} – {m.realScoreB}</span>
      <span style={s.resultName}>{m.awayTeam}</span>
      <ClubLogo teamName={m.awayTeam} size={24} />
    </button>
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

const s = {
  wrap: { maxWidth: 480, margin: "0 auto", padding: "16px 16px 0" },
  centerNote: { textAlign: "center", color: color.textSecondary, fontSize: 13.5, padding: "40px 16px" },
  statsErrorNote: {
    fontSize: 11, color: color.textFaint, background: color.surfaceInset, border: `1px solid ${color.border}`,
    borderRadius: radius.sm, padding: "8px 12px", marginBottom: 14,
  },

  toast: {
    position: "fixed", left: "50%", top: 92, transform: "translateX(-50%)", zIndex: 70,
    background: color.surfaceElevated, border: `1px solid ${color.goldBorder}`, color: color.goldLight,
    borderRadius: radius.pill, padding: "8px 16px", fontSize: 12, fontWeight: 700, fontFamily: font.body,
    boxShadow: shadow.elevated,
  },

  heroBody: { flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "8px 16px 16px", textAlign: "center" },

  // ── Cardul hero — compoziție unică (competiție + echipe + countdown +
  // CTA), cu profunzime reală: gradient discret + glow + bordură, nu
  // conținut plutind pe negru pur. Lățime plină, ca să domine ecranul. ──
  heroCard: {
    width: "100%", maxWidth: 400, borderRadius: radius.lg, overflow: "hidden",
    background: "linear-gradient(180deg, rgba(212,175,55,0.07) 0%, rgba(18,20,28,0.92) 35%, rgba(10,11,16,0.96) 100%)",
    border: "1px solid rgba(212,175,55,0.22)",
    boxShadow: "0 0 40px -8px rgba(212,175,55,0.18), 0 20px 45px -20px rgba(0,0,0,0.7)",
  },
  heroCardBody: { padding: "16px 18px 18px" },

  matchup: { display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 14, marginBottom: 6 },
  side: { display: "flex", flexDirection: "column", alignItems: "center", gap: 9, width: 108 },
  logoRing: {
    width: 76, height: 76, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
    background: "radial-gradient(circle, rgba(212,175,55,0.14) 0%, rgba(212,175,55,0.02) 70%)",
    border: "1px solid rgba(212,175,55,0.25)", boxShadow: "0 0 20px -4px rgba(212,175,55,0.3)",
  },
  tname: {
    fontFamily: font.display, fontWeight: 700, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.01em",
    color: color.textPrimary, lineHeight: 1.25, minHeight: 32, display: "flex", alignItems: "center", justifyContent: "center",
  },
  vsx: {
    fontFamily: font.display, fontSize: 12, color: color.goldLight, fontWeight: 800, letterSpacing: "0.05em",
    marginTop: 26, flexShrink: 0, width: 30, height: 30, borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.3)",
  },

  flapWrap: {
    margin: "14px auto 16px", transform: "scale(0.88)", display: "inline-block",
    padding: "10px 18px", borderRadius: radius.md, background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  lockLabel: { fontSize: 10, fontWeight: 700, color: color.textFaint, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6, fontFamily: font.body },
  liveNote: { fontSize: 11.5, color: "#8BD957", fontWeight: 700, margin: "12px 0", fontFamily: font.body },
  liveRevealWrap: { display: "flex", flexDirection: "column", alignItems: "center", gap: 8, margin: "12px 0" },
  eyeBtn: {
    display: "flex", alignItems: "center", gap: 6, background: "rgba(212,175,55,0.1)",
    border: "1px solid rgba(212,175,55,0.35)", borderRadius: 999, padding: "6px 14px",
    fontSize: 11.5, cursor: "pointer", color: color.goldLight, fontFamily: font.body, fontWeight: 700,
  },
  eyeBtnLabel: { fontSize: 11.5, fontWeight: 700 },
  finalScore: { fontFamily: font.display, fontSize: 30, fontWeight: 800, color: color.textPrimary, margin: "8px 0 12px" },
  ctaWrap: { width: "100%", maxWidth: 280, margin: "0 auto" },
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

  accordionToggle: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 5, width: "100%",
    background: "none", border: "none", borderTop: `1px solid ${color.borderSubtle}`,
    padding: "9px 0", cursor: "pointer", fontSize: 11, fontWeight: 700, color: color.textFaint, fontFamily: font.body,
  },
  accordionChevron: { fontSize: 11, transition: "transform 220ms ease" },
  accordionBody: { display: "grid", transition: "grid-template-rows 260ms ease" },

  resultsList: { display: "flex", flexDirection: "column", gap: 1, background: color.surface, borderRadius: radius.lg, overflow: "hidden", border: `1px solid ${color.border}` },
  resultRow: {
    display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "none", border: "none",
    borderBottom: `1px solid ${color.borderSubtle}`, cursor: "pointer", width: "100%", textAlign: "left",
  },
  resultName: { flex: 1, fontSize: 11.5, color: color.textSecondary, fontWeight: 600, fontFamily: font.body, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  resultScore: { fontSize: 13, color: color.textPrimary, fontWeight: 800, fontFamily: font.display, flexShrink: 0, padding: "0 4px" },

  feedSection: { marginBottom: 22 },
  feedSectionHead: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  seeAllBtn: { background: "none", border: "none", color: color.goldLight, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: font.body },
  feedList: { display: "flex", flexDirection: "column", gap: 6 },
  feedEmpty: { fontSize: 11.5, color: color.textFaint, fontFamily: font.body, padding: "8px 0" },

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
