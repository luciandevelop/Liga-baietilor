import { useEffect, useRef, useState } from "react";
import { getCurrentSeason, getCurrentGameweek, loadUserPredictions, loadUserJoker, isMatchLocked } from "../services/predictionsService";
import { listenMatches, listenLiveGameweekScores, listGameweekScores, getUserSeasonPoints } from "../services/adminService";
import { getUserPublicProfiles } from "../services/profilesService";
import { processRankChanges, processFinishedMatches, processJokerActivation, processUpcomingMatches, loadFullFeed, processSurpriseCreated, processSurpriseMatchup, processSurpriseResult, processExternalMatchDelta, processMatchIntelligence, processDailyFillerIfQuiet, processClubFactsForMatch } from "../services/feedService";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import useNow from "../hooks/useNow";
import { usePrefersReducedMotion } from "../motion";
import { getMatchStatus } from "../utils/matchStatus";
import { color, font, radius, shadow } from "../matchdayTheme";
import CinematicBackdrop from "../components/CinematicBackdrop";
import AppHeader from "../components/AppHeader";
import TopTabNav from "../components/TopTabNav";
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
import LiveMatchDetails from "../components/LiveMatchDetails";
import { getWeeklySurprise, getSecretMain, getSecretBonus, MAIN_CATALOG, BONUS_CATALOG } from "../services/surprisesService";
import { loadNotifications } from "../services/notificationsService";
import NotificationPanel from "../components/NotificationPanel";

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
export default function WelcomeScreen({ user, profile, isAdmin, onOpenAdmin, onOpenPredictions, onOpenLeaderboard, onOpenSpecials, onOpenFeed, onOpenSurprises, onOpenProfile }) {
  const now = useNow(1000);
  const reduced = usePrefersReducedMotion();

  const [loading, setLoading] = useState(true);
  const [criticalError, setCriticalError] = useState("");
  const [statsError, setStatsError] = useState("");
  const [resultsOpen, setResultsOpen] = useState(false);
  const [toast, setToast] = useState("");

  const [gameweek, setGameweek] = useState(null);
  const [matches, setMatches] = useState([]);
  const [notifItems, setNotifItems] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
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
  const [surpriseTeaser, setSurpriseTeaser] = useState(null); // { mainLabel, bonusLabel } | null
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
    let unsubMatches = null;
    let unsubScores = null;
    (async () => {
      setLoading(true);
      setCriticalError("");
      setStatsError("");
      refreshFeedTop();

      let season, gw;
      try {
        season = await getCurrentSeason();
        if (!season) { setGameweek(null); setLoading(false); return; }
        gw = await getCurrentGameweek(season.id);
        setGameweek(gw);
        if (!gw) { setLoading(false); return; }
      } catch (err) {
        console.error("Eroare critică la încărcarea Home:", err);
        setCriticalError(err.message || err.code || "Eroare necunoscută");
        setLoading(false);
        return;
      }
      setLoading(false);

      // ── REALTIME pe meciuri — sursă unică cu Pronosticuri (listenMatches),
      // ca scorul/minutul/evenimentele LIVE să nu mai poată "îngheța" la
      // momentul deschiderii ecranului. BUG P0 reparat aici. ──
      const predictionsLoadedRef = { current: false };
      unsubMatches = listenMatches(gw.id, (m) => {
        setMatches(m);

        const finished = m.filter((x) => x.status === "finished" && x.realScoreA != null && x.realScoreB != null);
        if (finished.length > 0) {
          processFinishedMatches(finished).then((evs) => { if (evs.length > 0) refreshFeedTop(); }).catch((err) => console.error("Eroare Feed meciuri:", err));
        }

        // ── Joker în Feed — REPARAT. Varianta veche interoga TOATE
        // jokerele etapei într-un singur query (where gameweekId==) —
        // dar regula Firestore pentru /jokers/{jokerId} verifică
        // TIPARUL ID-ului (gameweekId_uid), nu câmpul gameweekId din
        // interogare. Exact același gen de nepotrivire găsită și
        // reparată mai devreme la specialPicks — Firestore refuză
        // interogări largi când regula depinde de altceva decât
        // filtrul propriu-zis. Pentru un user normal (non-admin),
        // interogarea probabil eșua silențios — de-asta Jokerul
        // "aproape că nu exista" în Feed.
        //
        // Reparat: fiecare user citește DOAR propriul Joker (id exact,
        // mereu permis de regulă, fără query), și-l publică în Feed
        // NUMAI după ce meciul s-a blocat — exact regula reală de
        // reveal, nu una nouă, inventată. Cu userii activi deschizând
        // aplicația de-a lungul etapei, toate jokerele ajung publicate
        // treptat, fiecare de pe propriul client.
        loadUserJoker(gw.id, user.uid).then(async (j) => {
          if (!j || processedJokersRef.current.has(`${j.gameweekId}_${j.userId}`)) return;
          const jm = m.find((x) => x.id === j.matchId);
          if (!jm || !isMatchLocked(jm)) return; // privacy: nedezvăluit înainte de lock
          processedJokersRef.current.add(`${j.gameweekId}_${j.userId}`);
          const nickname = profile?.nickname || user.uid;
          await processJokerActivation(j, jm, nickname);
          refreshFeedTop();
        }).catch((err) => console.error("Eroare Feed joker propriu:", err));

        // Predicțiile proprii — au nevoie de ID-urile reale ale meciurilor,
        // disponibile abia aici (realtime). O singură dată e suficient
        // (nu se schimbă predicțiile PROPRII quando altcineva actualizează
        // scorul altui meci) — refolosim predictionsLoadedRef ca gardă.
        if (!predictionsLoadedRef.current) {
          predictionsLoadedRef.current = true;
          loadUserPredictions(user.uid, m.map((x) => x.id)).then(setPredictions).catch((err) => console.error("Eroare predicții proprii:", err));
        }
      });

      try {
        const joker = await loadUserJoker(gw.id, user.uid);
        setOwnJoker(joker);

        if (gw.status === "completed") {
          const rows = await listGameweekScores(gw.id);
          await applyRows(rows.map((r) => ({ ...r, uid: r.userId })));
        } else {
          unsubScores = listenLiveGameweekScores(gw.id, (rows) => {
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

    return () => { if (unsubMatches) unsubMatches(); if (unsubScores) unsubScores(); };
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

  // Notificări — derivate live din ce chiar mai are userul de făcut
  // (meciuri fără pronostic azi, surprize dezvăluite dar neacționate,
  // Meciurile Săptămânii încă deschise). Fără stare "citit" persistată
  // — conținutul se auto-actualizează, nu are nevoie de sincronizare
  // separată. Se reîncarcă natural ori de câte ori se schimbă lista de
  // meciuri sau etapa curentă.
  useEffect(() => {
    if (!gameweek || matches.length === 0) { setNotifItems([]); return; }
    let cancelled = false;
    setNotifLoading(true);
    loadNotifications({ gameweekId: gameweek.id, matches, uid: user.uid, featuredMatchIds: gameweek.featuredMatchIds || [] })
      .then(({ items }) => { if (!cancelled) setNotifItems(items); })
      .catch((err) => console.error("Eroare la încărcarea notificărilor:", err))
      .finally(() => { if (!cancelled) setNotifLoading(false); });
    return () => { cancelled = true; };
  }, [gameweek, matches, user.uid]);

  // Teaser Surprizele Săptămânii — încărcat o dată per etapă, doar
  // starea publică (revealed/nu) + tipul, DACĂ e deja dezvăluit. Nu e
  // nimic secret aici — secret/main e oricum inaccesibil înainte de
  // reveal, la nivel de regulă Firestore, nu doar ascuns în UI.
  useEffect(() => {
    if (!gameweek) return;
    let cancelled = false;
    (async () => {
      const pub = await getWeeklySurprise(gameweek.id);
      if (!pub || cancelled) { if (!cancelled) setSurpriseTeaser(null); return; }
      const [sm, sb] = await Promise.all([
        pub.mainRevealed ? getSecretMain(gameweek.id) : null,
        pub.bonusRevealed ? getSecretBonus(gameweek.id) : null,
      ]);
      if (cancelled) return;
      setSurpriseTeaser({
        mainRevealed: !!pub.mainRevealed,
        bonusRevealed: !!pub.bonusRevealed,
        mainLabel: sm ? (MAIN_CATALOG.find((c) => c.id === sm.type)?.label || sm.type) : null,
        bonusLabel: sb ? (BONUS_CATALOG.find((c) => c.id === sb.type)?.label || sb.type) : null,
      });

      // ── Feed — CREATED nu adaugă nicio citire nouă (pub/sm/sb erau
      // deja încărcate pentru teaser). Id-ul evenimentului e stabil
      // (surprise_created_{gwId}_{kind}) — save-ul repetat, la fiecare
      // deschidere a Home-ului, e idempotent prin design, nu prin
      // verificare separată "am mai procesat asta?". ──
      if (sm) {
        const mainLabel = MAIN_CATALOG.find((c) => c.id === sm.type)?.label || sm.type;
        processSurpriseCreated(gameweek.id, "main", sm.type, mainLabel).catch((err) => console.error("Eroare Feed surpriză principală:", err));
        processSurpriseMatchup(gameweek.id, "main", sm.type, sm.config).catch((err) => console.error("Eroare Feed matchup principal:", err));
        if (pub.mainResolved) {
          processSurpriseResult(gameweek.id, "main", sm.type, sm.config, mainLabel).catch((err) => console.error("Eroare Feed rezultat principal:", err));
        }
      }
      if (sb) {
        const bonusLabel = BONUS_CATALOG.find((c) => c.id === sb.type)?.label || sb.type;
        processSurpriseCreated(gameweek.id, "bonus", sb.type, bonusLabel).catch((err) => console.error("Eroare Feed surpriză bonus:", err));
        processSurpriseMatchup(gameweek.id, "bonus", sb.type, sb.config).catch((err) => console.error("Eroare Feed matchup bonus:", err));
        if (pub.bonusResolved) {
          processSurpriseResult(gameweek.id, "bonus", sb.type, sb.config, bonusLabel).catch((err) => console.error("Eroare Feed rezultat bonus:", err));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [gameweek?.id]);

  const staticFeedRef = useRef(false);
  useEffect(() => {
    if (staticFeedRef.current || !gameweek || matches.length === 0) return;
    staticFeedRef.current = true;
    const featuredIds = gameweek.featuredMatchIds || [];
    // Toate meciurile care urmează (fereastră 7 zile), nu doar Meciul
    // Săptămânii — fiecare primește context editorial STRICT dacă
    // există conținut pentru echipele respective (regula zero).
    processUpcomingMatches(matches, featuredIds, gameweek.id)
      .then((events) => { if (events.length > 0) refreshFeedTop(); })
      .catch((err) => console.error("Eroare Feed meciuri viitoare:", err));

    // Filler zilnic — DOAR dacă etapa e genuin "tăcută" (nicio
    // activitate reală în ultimele ~20h). Verificarea internă a
    // funcției decide, nu publicăm orbește la fiecare deschidere.
    processDailyFillerIfQuiet()
      .then((ev) => { if (ev) refreshFeedTop(); })
      .catch((err) => console.error("Eroare filler zilnic:", err));

    // Fapte de club/oraș/competiție — DOAR pentru meciurile în
    // fereastra 08:00→23:59 ziua următoare (verificată intern per
    // meci); istoric persistent, deci refresh-ul nu repetă nimic.
    matches.forEach((m) => {
      processClubFactsForMatch(m)
        .then((events) => { if (events.length > 0) refreshFeedTop(); })
        .catch((err) => console.error(`Eroare fapte club (${m.homeTeam}-${m.awayTeam}):`, err));
    });
  }, [gameweek, matches]);

  // ── Date live externe (API-Football) — server-side (Vercel + GitHub
  // Actions) actualizează externalFootballCache la ~10 minute; clientul
  // doar CITEȘTE cache-ul (niciun apel direct la API-Football de-aici)
  // și transformă noutățile în povești Feed. "Enhancement, nu
  // dependency" — dacă cache-ul lipsește/e vechi, nu se întâmplă nimic
  // rău, Feed-ul intern continuă normal. Interval blând (2 min) cât
  // timp aplicația e deschisă — suficient pentru "aproximativ 5-10
  // minute", acceptat explicit. ──
  useEffect(() => {
    if (!gameweek || matches.length === 0) return;
    const mappedMatches = matches.filter((m) => m.externalFixtureId);
    if (mappedMatches.length === 0) return;

    let cancelled = false;
    async function pollExternal() {
      for (const m of mappedMatches) {
        try {
          const snap = await getDoc(doc(db, "externalFootballCache", String(m.externalFixtureId)));
          if (cancelled || !snap.exists()) continue;
          const cacheDoc = snap.data();
          const hasNews = (cacheDoc.lastDeltaEvents?.length > 0) || cacheDoc.lastStatusChange || cacheDoc.lastScoreChange;
          if (hasNews) {
            const events = await processExternalMatchDelta(m, cacheDoc);
            if (events.length > 0 && !cancelled) refreshFeedTop();
          }
          // Match Intelligence — ID-uri deterministe (o singură dată per
          // matchId), deci sigur de reapelat la fiecare ciclu de poll.
          const miEvents = await processMatchIntelligence(m, cacheDoc);
          if (miEvents.length > 0 && !cancelled) refreshFeedTop();
        } catch (err) {
          console.error("Eroare la citirea datelor live externe:", err);
        }
      }
    }
    pollExternal();
    const intervalId = setInterval(pollExternal, 2 * 60 * 1000);
    return () => { cancelled = true; clearInterval(intervalId); };
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
  // Meciuri LIVE suplimentare (dincolo de cel din hero) — BUG P0 reparat:
  // înainte dispăreau complet, nu apăreau nici în hero (doar heroPool[0]),
  // nici în "Urmează" (filtrat strict la "scheduled"). Acum au propria
  // secțiune, vizibilă imediat, fără să intre în Pronosticuri ca să afli
  // că mai există meciuri în desfășurare.
  const otherLiveMatches = liveBucket.slice(1);
  // Rail-ul "Urmează" — doar meciuri care CHIAR urmează: statusul real
  // (nu cel brut din Firestore) trebuie să fie "scheduled". Un meci rămas
  // pe status "scheduled" în bază dar cu ora deja trecută e tratat LIVE
  // de getMatchStatus și dispare automat de-aici, cum a fost cerut.
  const railMatches = allSorted.filter((m) => m.id !== heroMatch?.id && getMatchStatus(m, now) === "scheduled");
  const remainingMs = heroMatch ? heroMatch.kickoffAt.toMillis() - LOCK_MS - now : 0;

  const predictedCount = Object.keys(predictions).length;
  const totalMatches = matches.length;
  const firstUnpredicted = allSorted.find((m) => !predictions[m.id]);

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
          hasNotification={feedTop.some((e) => e.important) || notifItems.length > 0}
          onAvatarClick={onOpenProfile}
          onBellClick={() => setNotifOpen(true)}
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
                      {heroStatus === "live" && <Pill tone="green">● LIVE{heroMatch.liveMinute != null ? ` · ${heroMatch.liveMinute}'` : ""}</Pill>}
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
                    <>
                      {heroMatch.realScoreA != null && heroMatch.realScoreB != null ? (
                        <div style={s.finalScore}>{heroMatch.realScoreA} – {heroMatch.realScoreB}</div>
                      ) : (
                        <div style={s.liveNote}>LIVE · rezultat neintrodus încă</div>
                      )}
                      <LiveMatchDetails match={heroMatch} />
                      <div style={s.liveRevealWrap}>
                        <button type="button" style={s.eyeBtn} onClick={() => setRevealMatch(heroMatch)} aria-label="Vezi pronosticurile">
                          👁 <span style={s.eyeBtnLabel}>Cine mai e în joc?</span>
                        </button>
                      </div>
                    </>
                  )}
                  {heroStatus === "paused" && (
                    <>
                      {heroMatch.realScoreA != null && heroMatch.realScoreB != null && (
                        <div style={s.finalScore}>{heroMatch.realScoreA} – {heroMatch.realScoreB}</div>
                      )}
                      <div style={s.liveNote}>Meciul e la pauză</div>
                      <LiveMatchDetails match={heroMatch} />
                    </>
                  )}
                  {heroStatus === "finished" && (
                    <>
                      <div style={s.finalScore}>{heroMatch.realScoreA} – {heroMatch.realScoreB}</div>
                      <LiveMatchDetails match={heroMatch} />
                    </>
                  )}
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

          {surpriseTeaser && (
            <button type="button" style={s.surpriseCard} onClick={onOpenSurprises}>
              <div style={s.surpriseCardGlow} />
              <div style={s.surpriseCardHead}>
                <span style={s.surpriseCardTitle}>🎭 SURPRIZA SĂPTĂMÂNII</span>
                <span style={s.surpriseCardArrow}>→</span>
              </div>
              <div style={s.surpriseCardRows}>
                <span style={s.surpriseCardRow}>
                  <span style={s.surpriseCardIcon}>🏆</span>
                  <span style={s.surpriseCardRowText}>
                    {surpriseTeaser.mainRevealed ? surpriseTeaser.mainLabel : "Surpriza Principală"}
                  </span>
                  <span style={surpriseTeaser.mainRevealed ? s.surpriseCardStatusActive : s.surpriseCardStatusLocked}>
                    {surpriseTeaser.mainRevealed ? "Activ" : "🔒"}
                  </span>
                </span>
                <span style={s.surpriseCardRow}>
                  <span style={s.surpriseCardIcon}>🎁</span>
                  <span style={s.surpriseCardRowText}>
                    {surpriseTeaser.bonusRevealed ? surpriseTeaser.bonusLabel : "Bonusul Săptămânii"}
                  </span>
                  <span style={surpriseTeaser.bonusRevealed ? s.surpriseCardStatusActive : s.surpriseCardStatusLocked}>
                    {surpriseTeaser.bonusRevealed ? "Activ" : "🔒"}
                  </span>
                </span>
              </div>
            </button>
          )}

          {otherLiveMatches.length > 0 && (
            <div style={s.otherLiveSection}>
              <div style={s.otherLiveLabel}>🔴 ALTE MECIURI LIVE ({otherLiveMatches.length})</div>
              <div style={s.otherLiveList}>
                {otherLiveMatches.map((m) => (
                  <div key={m.id} style={s.otherLiveCard}>
                    <div style={s.otherLiveTop}>
                      <ClubLogo teamName={m.homeTeam} size={34} />
                      <div style={s.otherLiveMid}>
                        <div style={s.otherLiveTeams}>{m.homeTeam} – {m.awayTeam}</div>
                        <div style={s.otherLiveScoreRow}>
                          {m.realScoreA != null && m.realScoreB != null ? (
                            <span style={s.otherLiveScore}>{m.realScoreA} – {m.realScoreB}</span>
                          ) : (
                            <span style={s.otherLiveScorePending}>rezultat neintrodus</span>
                          )}
                          <span style={s.otherLiveMinute}>● LIVE{m.liveMinute != null ? ` ${m.liveMinute}'` : ""}</span>
                        </div>
                      </div>
                      <ClubLogo teamName={m.awayTeam} size={34} />
                    </div>
                    <LiveMatchDetails match={m} compact />
                    <button type="button" style={s.otherLiveEyeBtn} onClick={() => setRevealMatch(m)}>
                      👁 Cine mai e în joc?
                    </button>
                  </div>
                ))}
              </div>
            </div>
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
        </div>
      )}

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
      {notifOpen && (
        <NotificationPanel
          items={notifItems}
          loading={notifLoading}
          onClose={() => setNotifOpen(false)}
          onOpenPredictions={() => onOpenPredictions()}
          onOpenSurprises={onOpenSurprises}
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

  otherLiveSection: { marginBottom: 20 },
  // ── Card premium „Surpriza Săptămânii" — dark, glow auriu discret,
  // ierarhie clară (titlu mare sus, 2 rânduri de status dedesubt).
  // Aceeași țintă de click ca înainte (onOpenSurprises), doar cromatica
  // mult mai vizibilă. Înălțime ~110-120px, nu un hero. ──
  surpriseCard: {
    position: "relative", overflow: "hidden", display: "block", width: "100%", textAlign: "left",
    background: "linear-gradient(155deg, rgba(212,175,55,0.14), rgba(20,16,8,0.5) 60%, rgba(139,58,138,0.10))",
    border: "1px solid rgba(212,175,55,0.35)", borderRadius: radius.lg,
    padding: "14px 16px 16px", marginBottom: 16, cursor: "pointer", fontFamily: font.body,
    boxShadow: `${shadow.card}, ${shadow.rim}`,
  },
  surpriseCardGlow: {
    position: "absolute", top: -40, right: -40, width: 140, height: 140, borderRadius: "50%",
    background: "radial-gradient(circle, rgba(212,175,55,0.28), transparent 70%)", pointerEvents: "none",
  },
  surpriseCardHead: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, position: "relative" },
  surpriseCardTitle: {
    fontSize: 13.5, fontWeight: 800, letterSpacing: "0.03em", color: color.textPrimary, fontFamily: font.display,
  },
  surpriseCardArrow: { fontSize: 15, fontWeight: 800, color: color.goldLight },
  surpriseCardRows: { display: "flex", flexDirection: "column", gap: 8, position: "relative" },
  surpriseCardRow: { display: "flex", alignItems: "center", gap: 9 },
  surpriseCardIcon: { fontSize: 15, flexShrink: 0, width: 22, textAlign: "center" },
  surpriseCardRowText: {
    flex: 1, fontSize: 12.5, fontWeight: 600, color: color.textSecondary,
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  surpriseCardStatusActive: {
    fontSize: 9.5, fontWeight: 800, letterSpacing: "0.04em", color: "#0A0D14",
    background: color.goldGradient, borderRadius: 999, padding: "3px 9px", flexShrink: 0,
  },
  surpriseCardStatusLocked: {
    fontSize: 11, color: color.textFaint, flexShrink: 0,
  },
  otherLiveLabel: { fontSize: 11, fontWeight: 800, letterSpacing: "0.05em", color: "#F0555A", marginBottom: 10, fontFamily: font.body },
  otherLiveList: { display: "flex", flexDirection: "column", gap: 10 },
  otherLiveCard: {
    background: "rgba(240,85,90,0.05)", border: "1px solid rgba(240,85,90,0.25)", borderRadius: radius.md, padding: 14,
  },
  otherLiveTop: { display: "flex", alignItems: "center", gap: 10 },
  otherLiveMid: { flex: 1, minWidth: 0, textAlign: "center" },
  otherLiveTeams: { fontSize: 11.5, fontWeight: 700, color: color.textPrimary, fontFamily: font.body, marginBottom: 3 },
  otherLiveScoreRow: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8 },
  otherLiveScore: { fontFamily: font.display, fontSize: 18, fontWeight: 800, color: color.textPrimary },
  otherLiveScorePending: { fontSize: 10.5, color: color.textFaint, fontFamily: font.body },
  otherLiveMinute: { fontSize: 10, fontWeight: 800, color: "#8BD957", fontFamily: font.body },
  otherLiveEyeBtn: {
    width: "100%", marginTop: 8, background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.35)",
    borderRadius: 999, padding: "7px 0", fontSize: 11, fontWeight: 700, color: color.goldLight, cursor: "pointer", fontFamily: font.body,
  },
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

  errorWrap: { maxWidth: 420, margin: "80px auto", textAlign: "center", padding: "0 20px" },
  errorTitle: { fontSize: 16, fontWeight: 700, color: color.textPrimary, marginBottom: 8, fontFamily: font.body },
  errorText: { fontSize: 12.5, color: "#E5534B", marginBottom: 18, fontFamily: font.body },
};
