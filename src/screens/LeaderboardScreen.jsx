import { useEffect, useState } from "react";
import { getCurrentSeason, getCurrentGameweek } from "../services/predictionsService";
import { subscribeToLiveSnapshot, isSnapshotStale, getOrRunFallback } from "../services/liveSnapshotStore";
import { computeRankingBonuses } from "../services/scoringEngine";
import {
  listGameweekScores,
  listSeasonLeaderboard,
  listSeasons,
  listGeneralLeaderboard,
  getLiveGameweekPoints,
  getLiveGameweekPointsDiagnostic,
  republishAllMatchPointsForGameweek,
  getLastCompletedGameweek,
  getPlayerCardStats,
  listGameweeks,
} from "../services/adminService";
import { getUserPublicProfiles } from "../services/profilesService";
import { getAllSurpriseResults } from "../services/surprisesService";
import PlayerCard from "../components/PlayerCard";
import PageHeader from "../components/PageHeader";
import PlayerRankRow from "../components/PlayerRankRow";
import StatusBadge from "../components/StatusBadge";
import EmptyState from "../components/EmptyState";
import { color, font, layout, radius } from "../theme";

// Normalizează rândurile la aceeași formă, indiferent dacă vin din
// gameweekLiveScores (userId, document sanitizat de admin) sau din
// gameweekScores (userId, scris definitiv la finalizare).
function normalizeRow(r) {
  return {
    uid: r.userId,
    rank: r.rank,
    pointsFromMatches: r.pointsFromMatches,
    rankingBonus: r.rankingBonus,
    totalPoints: r.totalPoints,
  };
}

export default function LeaderboardScreen({ onBack, user, isAdmin }) {
  const [tab, setTab] = useState("gameweek"); // gameweek | season | general
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [season, setSeason] = useState(null);
  // ── Selector de sezon pentru tab-ul SEZON — cerut explicit: sezoanele
  // încheiate trebuie să rămână vizibile permanent, cu clasamentul lor
  // final. listSeasons()/listSeasonLeaderboard(seasonId) există deja,
  // parametrizate corect — doar conectate acum la un selector în UI,
  // nicio structură nouă de stocare. ──
  const [allSeasons, setAllSeasons] = useState([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState(null);
  const [seasonRowsLoading, setSeasonRowsLoading] = useState(false);
  const [gameweek, setGameweek] = useState(null); // etapa curentă SAU ultima finalizată (fallback)
  const [usedFallback, setUsedFallback] = useState(false);
  const [gwRows, setGwRows] = useState([]);
  // ── Puncte live ale etapei curente, per user — REUTILIZATE de mai jos
  // pentru a îmbogăți SEZON și GENERAL cu progresul live (cerut explicit:
  // toate 3 clasamentele trebuie să fie live). Aceeași sursă unică
  // (getLiveGameweekPointsDiagnostic, matchPoints) deja folosită pentru
  // Etapă — nicio citire nouă, doar reutilizare la afișare. ──
  const [livePointsByUid, setLivePointsByUid] = useState({});
  const [surprisePointsByUid, setSurprisePointsByUid] = useState({});

  // Puncte din Surprizele Săptămânii pentru ETAPA afișată — DOAR citire
  // pentru afișare (badge lângă rând), nu atinge deloc totalPoints
  // stocat în gameweekScores. getAllSurpriseResults întoarce array gol
  // (nu eroare) dacă nimic nu e încă rezolvat — regula Firestore respinge
  // interogarea până la primul Resolve, exact ca la predicții/lock.
  useEffect(() => {
    if (!gameweek?.id) { setSurprisePointsByUid({}); return; }
    let cancelled = false;
    getAllSurpriseResults(gameweek.id).then((results) => {
      if (cancelled) return;
      const map = {};
      results.forEach((r) => { map[r.uid] = (r.mainPoints || 0) + (r.bonusPoints || 0); });
      setSurprisePointsByUid(map);
    }).catch(() => { if (!cancelled) setSurprisePointsByUid({}); });
    return () => { cancelled = true; };
  }, [gameweek?.id]);
  const [gwLive, setGwLive] = useState(false);
  // Stare SEPARATĂ pentru fetch-ul live de puncte — BUG REPARAT: "loading"
  // principal devenea false ÎNAINTE ca acest efect (independent) să termine,
  // deci gwRows era încă gol pentru o fracțiune de secundă -> mesajul
  // "nu are rezultate" apărea în fugă, apoi se înlocuia cu datele reale.
  // Acum, mesajul de gol se arată DOAR dacă și acest fetch s-a terminat.
  const [liveRowsLoading, setLiveRowsLoading] = useState(false);
  const [scoringDiagnostic, setScoringDiagnostic] = useState(null);
  const [republishLoading, setRepublishLoading] = useState(false);
  const [republishMsg, setRepublishMsg] = useState("");

  async function handleRepublish() {
    if (!gameweek) return;
    setRepublishLoading(true);
    setRepublishMsg("");
    try {
      const count = await republishAllMatchPointsForGameweek(gameweek.id);
      setRepublishMsg(`✓ Republicat pentru ${count} meciuri Final din "${gameweek.title}" (${gameweek.id}).`);
      const { pointsByUid, diagnostic } = await getLiveGameweekPointsDiagnostic(gameweek.id);
      setScoringDiagnostic(diagnostic);
      const rows = Object.entries(pointsByUid).map(([uid, pts]) => ({
        uid, pointsFromMatches: pts, rankingBonus: undefined, totalPoints: pts, rank: null,
      }));
      rows.sort((a, b) => b.pointsFromMatches - a.pointsFromMatches);
      let rank = 0, prevPts = null;
      rows.forEach((r, i) => {
        if (prevPts === null || r.pointsFromMatches !== prevPts) { rank = i + 1; prevPts = r.pointsFromMatches; }
        r.rank = rank;
      });
      setGwRows(rows);
      const names = await getUserPublicProfiles(rows.map((r) => r.uid));
      setProfiles((prev) => ({ ...prev, ...names }));
    } catch (err) {
      setRepublishMsg(`Eroare: ${err.message || err}`);
    } finally {
      setRepublishLoading(false);
    }
  }

  const [seasonRows, setSeasonRows] = useState([]);
  const [generalRows, setGeneralRows] = useState([]);
  const [profiles, setProfiles] = useState({});

  // Etape anterioare — sub etapa curentă, fiecare se deschide DOAR la
  // apăsare (nu se încarcă toate dinainte, ca să nu tragem degeaba date
  // pentru etape pe care nimeni nu le mai deschide).
  const [pastGameweeks, setPastGameweeks] = useState([]);
  const [expandedGwId, setExpandedGwId] = useState("");
  const [expandedGwRows, setExpandedGwRows] = useState({}); // cache: gwId -> rows
  const [expandedGwLoading, setExpandedGwLoading] = useState("");

  const [openUid, setOpenUid] = useState("");
  const [cardStats, setCardStats] = useState(null);
  const [cardScope, setCardScope] = useState("etapa");
  const [cardLoading, setCardLoading] = useState(false);

  // Setup inițial — sezon curent, etapă (curentă sau ultima finalizată,
  // dacă nu există una a cărei săptămână conține azi), clasament sezon,
  // clasament general. Etapa live e gestionată separat mai jos.
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const s = await getCurrentSeason();
        setSeason(s);
        // Lista tuturor sezoanelor — pentru selector, o singură dată.
        const seasons = await listSeasons();
        setAllSeasons(seasons);
        setSelectedSeasonId(s?.id || (seasons[0]?.id ?? null));

        if (s) {
          let gw = await getCurrentGameweek(s.id);
          let fallback = false;
          if (!gw) {
            gw = await getLastCompletedGameweek(s.id);
            fallback = true;
          }
          setGameweek(gw);
          setUsedFallback(fallback);

          if (gw && gw.status === "completed") {
            const rows = (await listGameweekScores(gw.id)).map(normalizeRow);
            setGwRows(rows);
            setGwLive(false);
            const p = await getUserPublicProfiles(rows.map((r) => r.uid));
            setProfiles((prev) => ({ ...prev, ...p }));
          }

          // Etape anterioare — doar lista (titlu + id), fără punctaje încă.
          // Punctajele fiecărei etape se aduc STRICT la apăsare (vezi
          // toggleExpandGw mai jos) — nu tragem degeaba date pentru etape
          // pe care nimeni nu le deschide.
          const allGws = await listGameweeks(s.id);
          const past = allGws
            .filter((g) => g.status === "completed" && g.id !== gw?.id)
            .sort((a, b) => Number(b.number) - Number(a.number));
          setPastGameweeks(past);
        }

        const general = await listGeneralLeaderboard();
        setGeneralRows(general);
      } catch (err) {
        console.error(err);
        setError(err.message || err.code);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.uid]);

  // ── Rândurile SEZON — reîncărcate strict la schimbarea sezonului
  // selectat, separat de efectul mare de mai sus (schimbarea sezonului
  // nu trebuie să retragă tot: etapa curentă, general, etc.). Pentru un
  // sezon ÎNCHEIAT, listSeasonLeaderboard(seasonId) întoarce direct
  // clasamentul lui final, deja corect — nimic de reconstruit separat. ──
  useEffect(() => {
    if (!selectedSeasonId) return;
    let cancelled = false;
    setSeasonRowsLoading(true);
    listSeasonLeaderboard(selectedSeasonId)
      .then(async (sRows) => {
        if (cancelled) return;
        setSeasonRows(sRows);
        const p = await getUserPublicProfiles(sRows.map((r) => r.uid));
        if (!cancelled) setProfiles((prev) => ({ ...prev, ...p }));
      })
      .catch((err) => console.error("Eroare la încărcarea clasamentului sezonului:", err))
      .finally(() => { if (!cancelled) setSeasonRowsLoading(false); });
    return () => { cancelled = true; };
  }, [selectedSeasonId]);

  // ── Clasament LIVE — REARHITECTURAT (aprobat explicit, reducere masivă
  // de citiri Firestore). Nu mai recalculează din matchPoints la fiecare
  // 2 minute, per user — un singur listener partajat pe snapshot-ul deja
  // calculat de Admin la validare (liveSnapshotStore.js). Diagnosticul
  // detaliat (matchPointsFound, etc.) rămâne DOAR pentru Admin, o
  // singură dată per etapă, NU mai polling — vezi efectul separat de
  // mai jos. ──
  useEffect(() => {
    if (!gameweek || gameweek.status === "completed") return;
    setGwLive(true);
    setLiveRowsLoading(true);
    let cancelled = false;

    async function applySnapshotRows(pointsByUid) {
      setLivePointsByUid(pointsByUid);
      const rows = Object.entries(pointsByUid).map(([uid, pts]) => ({
        uid, pointsFromMatches: pts, rankingBonus: undefined, totalPoints: pts, rank: null,
      }));
      rows.sort((a, b) => b.pointsFromMatches - a.pointsFromMatches);
      let rank = 0, prevPts = null;
      rows.forEach((r, i) => {
        if (prevPts === null || r.pointsFromMatches !== prevPts) { rank = i + 1; prevPts = r.pointsFromMatches; }
        r.rank = rank;
      });
      setGwRows(rows);
      const names = await getUserPublicProfiles(rows.map((r) => r.uid));
      if (!cancelled) setProfiles((prev) => ({ ...prev, ...names }));
    }

    const unsub = subscribeToLiveSnapshot(gameweek.id, async (data) => {
      if (cancelled) return;
      if (!isSnapshotStale(data)) {
        await applySnapshotRows(data.pointsByUid);
        if (!cancelled) setLiveRowsLoading(false);
        return;
      }
      // Promisiune PARTAJATĂ — REPARAT după regresia de producție din
      // 12 sept. TOȚI consumatorii (Header ȘI Clasament) așteaptă și
      // aplică ACELAȘI rezultat, indiferent cine a declanșat calculul.
      try {
        const { pointsByUid, diagnostic } = await getOrRunFallback(gameweek.id, data.resultsVersion, () => getLiveGameweekPointsDiagnostic(gameweek.id));
        if (cancelled) return;
        setScoringDiagnostic(diagnostic);
        await applySnapshotRows(pointsByUid);
        console.log(`[FS-TRACE] liveFallback DONE gw=${gameweek.id} users=${Object.keys(pointsByUid).length}`);
      } catch (err) {
        console.error("Eroare la fallback-ul clasamentului live:", err);
        if (!cancelled) setScoringDiagnostic({ gameweekId: gameweek.id, status: "ERROR", errorMessage: err.message || String(err), state: "error" });
      } finally {
        if (!cancelled) setLiveRowsLoading(false);
      }
    });

    return () => { cancelled = true; unsub(); };
  }, [gameweek?.id, gameweek?.status]);

  // ── Diagnostic DETALIAT (matchPointsFound, totalMatches etc.) — STRICT
  // pentru Admin, o singură dată per etapă, NU mai polling. Userii
  // normali nu declanșează deloc acest apel scump acum. ──
  useEffect(() => {
    if (!isAdmin || !gameweek || gameweek.status === "completed") return;
    let cancelled = false;
    getLiveGameweekPointsDiagnostic(gameweek.id)
      .then(({ diagnostic }) => { if (!cancelled) setScoringDiagnostic(diagnostic); })
      .catch((err) => console.error("Eroare la diagnosticul Admin:", err));
    return () => { cancelled = true; };
  }, [isAdmin, gameweek?.id, gameweek?.status]);

  // Un singur card, indiferent din ce tab a fost apăsat — aceleași
  // statistici (etapă/sezon/general), citite din aceeași sursă.
  // O etapă anterioară se deschide DOAR la apăsare — dacă e deja deschisă,
  // apăsarea o închide (accordion simplu). Rândurile se aduc o singură
  // dată per etapă (cache local) — a doua deschidere nu mai cere Firestore.
  async function toggleExpandGw(gw) {
    if (expandedGwId === gw.id) {
      setExpandedGwId("");
      return;
    }
    setExpandedGwId(gw.id);
    if (expandedGwRows[gw.id]) return; // deja în cache
    setExpandedGwLoading(gw.id);
    try {
      const rows = (await listGameweekScores(gw.id)).map(normalizeRow);
      setExpandedGwRows((prev) => ({ ...prev, [gw.id]: rows }));
      const p = await getUserPublicProfiles(rows.map((r) => r.uid));
      setProfiles((prev) => ({ ...prev, ...p }));
    } catch (err) {
      console.error("Eroare la încărcarea etapei anterioare:", err);
    } finally {
      setExpandedGwLoading("");
    }
  }

  // `contextGwId` — etapa DIN CARE s-a apăsat rândul, nu mereu etapa
  // curentă. BUG REPARAT: rândurile din accordion-ul "Etape anterioare"
  // apelau asta fără să spună din ce etapă vin, deci cardul încerca
  // mereu să arate meciurile etapei curente — dacă jucătorul ăla nu avea
  // date acolo, lista ieșea goală, chiar dacă chiar avea meciuri în etapa
  // pe care tocmai o deschisese.
  async function handleOpenPlayer(uid, rank, contextGwId = gameweek?.id, scope = "etapa") {
    // Card-ul de jucător e un sub-ecran din perspectiva Back-ului — Android
    // Back trebuie să-l închidă întâi, nu să sară direct la Home. Se
    // împinge o intrare de istoric LOCALĂ acestui ecran (nu afectează
    // App.jsx), simetrică cu popstate-ul de mai jos.
    window.history.pushState({ leaderboardPlayerCard: uid }, "");
    setOpenUid(uid);
    setCardStats(null);
    setCardScope(scope);
    setCardLoading(true);
    try {
      const stats = await getPlayerCardStats(uid, season?.id, contextGwId);
      setCardStats({ ...stats, rank });
    } catch (err) {
      console.error("Eroare la încărcarea cardului:", err);
    } finally {
      setCardLoading(false);
    }
  }

  // Închiderea din UI (✕) trece prin ACELAȘI drum ca Android Back —
  // history.back() — nu setOpenUid("") direct. Popstate-ul de mai jos
  // face efectiv închiderea, o singură sursă de adevăr pentru amândouă.
  function closePlayerCard() {
    window.history.back();
  }

  useEffect(() => {
    function onPopState(event) {
      if (!event.state?.leaderboardPlayerCard) {
        setOpenUid("");
      }
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const scoredCount = gwRows.length;

  // ── ÎMBOGĂȚIRE LIVE — cerut explicit: SEZON și GENERAL trebuie să
  // includă progresul live al etapei curente, nu doar etapele deja
  // finalizate. Reutilizează STRICT livePointsByUid (deja calculat mai
  // sus, din aceeași sursă ca Etapă — matchPoints) — zero citiri noi.
  //
  // FĂRĂ RISC DE DUBLARE: livePointsByUid rămâne gol ({}) exact atunci
  // când etapa curentă e deja "completed" (efectul de mai sus se oprește
  // explicit în acel caz) — moment în care punctele ei sunt deja incluse
  // în listSeasonLeaderboard/listGeneralLeaderboard (surse persistate).
  // Deci adăugarea de mai jos e mereu 0 exact quando ar risca să dubleze.
  //
  // Un user care are DEJA puncte live, dar ÎNCĂ nicio etapă finalizată
  // în sezon, nu apare deloc în seasonRows (listSeasonLeaderboard îl
  // exclude complet) — de-aia construim rândul din avatarId/nickname
  // deja disponibile în `profiles`, nu doar "adunăm peste un rând
  // existent". ──
  function mergeLiveSeasonRows() {
    const byUid = {};
    seasonRows.forEach((r) => { byUid[r.uid] = { uid: r.uid, totalPoints: r.totalPoints || 0 }; });
    // Progresul live se adaugă STRICT dacă sezonul afișat e cel curent —
    // un sezon istoric, deja încheiat, rămâne fix, exact clasamentul lui
    // final, fără nicio adăugare live (nu mai are nicio etapă în curs).
    const isViewingCurrentSeason = selectedSeasonId === season?.id;
    if (isViewingCurrentSeason) {
      Object.entries(livePointsByUid).forEach(([uid, livePts]) => {
        if (!byUid[uid]) byUid[uid] = { uid, totalPoints: 0 };
        byUid[uid].totalPoints += livePts || 0;
      });
    }
    return Object.values(byUid).sort((a, b) => b.totalPoints - a.totalPoints);
  }

  function mergeLiveGeneralRows() {
    const byUid = {};
    generalRows.forEach((r) => { byUid[r.uid] = { ...r, totalPoints: r.seasonPoints || 0 }; });
    Object.entries(livePointsByUid).forEach(([uid, livePts]) => {
      if (!byUid[uid]) byUid[uid] = { uid, totalPoints: 0 };
      byUid[uid].totalPoints += livePts || 0;
    });
    return Object.values(byUid).sort((a, b) => b.totalPoints - a.totalPoints);
  }

  const liveSeasonRows = mergeLiveSeasonRows();
  const liveGeneralRows = mergeLiveGeneralRows();

  return (
    <div style={{ ...layout.page, paddingBottom: 96 }}>
      <div style={layout.wrap}>
        {/* zIndex peste overlay-ul Player Card-ului (100) — Back trebuie
            să rămână complet vizibil și apăsabil chiar și cu modalul
            deschis, nu "spălat" de fundalul lui întunecat. */}
        <div style={{ position: "relative", zIndex: 101 }}>
          <PageHeader title="Clasament" onBack={onBack} />
        </div>

        <div style={s.tabRow}>
          <button style={{ ...s.tabBtn, ...(tab === "gameweek" ? s.tabBtnActive : {}) }} onClick={() => setTab("gameweek")}>
            Etapă
          </button>
          <button style={{ ...s.tabBtn, ...(tab === "season" ? s.tabBtnActive : {}) }} onClick={() => setTab("season")}>
            Sezon
          </button>
          <button style={{ ...s.tabBtn, ...(tab === "general" ? s.tabBtnActive : {}) }} onClick={() => setTab("general")}>
            General
          </button>
        </div>

        {loading && <div style={s.centerBox}>Se încarcă…</div>}
        {error && <div style={s.centerBox}>Eroare: {error}</div>}

        {!loading && !error && tab === "gameweek" && (
          <div style={s.list}>
            {isAdmin && gameweek && gwLive && (
              <div style={s.diagBox}>
                <div style={s.diagTitle}>🔧 DIAGNOSTIC SCORING (doar Admin)</div>
                <div style={s.diagRow}>Gameweek: <b>{scoringDiagnostic?.gameweekId || gameweek.id}</b> ({gameweek.title})</div>
                {scoringDiagnostic && (
                  <>
                    <div style={s.diagRow}>Meciuri totale: <b>{scoringDiagnostic.totalMatches}</b></div>
                    <div style={s.diagRow}>Meciuri FINAL: <b>{scoringDiagnostic.finalMatches}</b></div>
                    <div style={s.diagRow}>Documente matchPoints găsite: <b>{scoringDiagnostic.matchPointsFound}</b></div>
                    <div style={s.diagRow}>Useri calculați: <b>{scoringDiagnostic.usersComputed}</b></div>
                    <div style={s.diagRow}>Sursă: <b>{scoringDiagnostic.source || "matchPoints"}</b></div>
                    <div style={s.diagRow}>
                      Status: <b style={{ color: scoringDiagnostic.status === "ERROR" ? "#F0555A" : "#8BD957" }}>{scoringDiagnostic.status}</b>
                    </div>
                    {scoringDiagnostic.errorMessage && (
                      <div style={{ ...s.diagRow, color: "#F0555A" }}>Eroare: {scoringDiagnostic.errorMessage}</div>
                    )}
                    {scoringDiagnostic.state === "final-matches-unpublished" && (
                      <div style={{ ...s.diagRow, color: "#F0A94E" }}>⚠️ Există {scoringDiagnostic.finalMatches} meciuri Final, dar 0 documente matchPoints — apasă butonul de mai jos.</div>
                    )}
                  </>
                )}
                <button type="button" style={s.diagBtn} disabled={republishLoading} onClick={handleRepublish}>
                  {republishLoading ? "Se republică…" : "🔄 Republică punctele pentru ACEASTĂ etapă"}
                </button>
                {republishMsg && <div style={s.diagMsg}>{republishMsg}</div>}
              </div>
            )}
            {!gameweek && <EmptyState icon="📅" title="Încă nu există nicio etapă." />}
            {gameweek && gwLive && liveRowsLoading && <div style={s.centerBox}>Se încarcă…</div>}
            {gameweek && gwRows.length === 0 && !(gwLive && liveRowsLoading) && (
              <EmptyState
                icon="🏆"
                title={
                  scoringDiagnostic?.state === "final-matches-unpublished"
                    ? `Etapa "${gameweek.title}" are meciuri Final, dar punctele nu au fost încă publicate.`
                    : scoringDiagnostic?.state === "error"
                    ? `Eroare temporară la calculul Clasamentului — încearcă să reîncarci pagina.`
                    : `Etapa "${gameweek.title}" nu are încă rezultate introduse.`
                }
              />
            )}
            {gameweek && gwRows.length > 0 && (
              <div style={s.liveRow}>
                {gwLive ? (
                  <StatusBadge tone="live" dot>LIVE · {scoredCount} jucători</StatusBadge>
                ) : (
                  <StatusBadge tone="gold">{gameweek.title}{usedFallback ? " · ultima finalizată" : " · FINAL"}</StatusBadge>
                )}
              </div>
            )}
            {/* Preview bonus poziție — DOAR informativ, calculat client-side,
                pur (nu scrie nimic) — "dacă etapa s-ar încheia acum". */}
            {(() => {
              var previewBonusByUid = {};
              if (gwLive && gwRows.length > 0) {
                computeRankingBonuses(gwRows).forEach((r) => { previewBonusByUid[r.uid] = r.rankingBonus; });
              }
              return gwRows.map((r) => (
                <PlayerRankRow
                  key={r.uid}
                  rank={r.rank}
                  nickname={profiles[r.uid]?.nickname || r.uid}
                  avatarId={profiles[r.uid]?.avatarId}
                  pointsFromMatches={r.pointsFromMatches}
                  rankingBonus={r.rankingBonus}
                  totalPoints={r.totalPoints}
                  surprisePoints={surprisePointsByUid[r.uid]}
                  previewBonus={gwLive ? previewBonusByUid[r.uid] : undefined}
                  top3={r.rank <= 3}
                  showBonus={!gwLive}
                  onClick={() => handleOpenPlayer(r.uid, r.rank, undefined, "etapa")}
                />
              ));
            })()}

            {pastGameweeks.length > 0 && (
              <div style={s.pastSection}>
                <div style={s.pastSectionLabel}>Etape anterioare</div>
                {pastGameweeks.map((gw) => {
                  const isOpen = expandedGwId === gw.id;
                  const rows = expandedGwRows[gw.id] || [];
                  const isLoadingThis = expandedGwLoading === gw.id;
                  return (
                    <div key={gw.id} style={s.pastGwBlock}>
                      <button type="button" style={s.pastGwHeader} onClick={() => toggleExpandGw(gw)}>
                        <span>{gw.title}</span>
                        <span style={{ ...s.pastGwChevron, transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
                      </button>
                      {isOpen && (
                        <div style={s.pastGwBody}>
                          {isLoadingThis && <div style={s.centerBox}>Se încarcă…</div>}
                          {!isLoadingThis && rows.map((r) => (
                            <PlayerRankRow
                              key={r.uid}
                              rank={r.rank}
                              nickname={profiles[r.uid]?.nickname || r.uid}
                              avatarId={profiles[r.uid]?.avatarId}
                              pointsFromMatches={r.pointsFromMatches}
                              rankingBonus={r.rankingBonus}
                              totalPoints={r.totalPoints}
                              top3={r.rank <= 3}
                              showBonus={true}
                              onClick={() => handleOpenPlayer(r.uid, r.rank, gw.id, "etapa")}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {!loading && !error && tab === "season" && (
          <div style={s.list}>
            {allSeasons.length > 1 && (
              <select
                value={selectedSeasonId || ""}
                onChange={(e) => setSelectedSeasonId(e.target.value)}
                style={s.seasonSelect}
              >
                {allSeasons.map((sn) => (
                  <option key={sn.id} value={sn.id}>
                    {sn.name || sn.id}{sn.id === season?.id ? " (curent)" : ""}
                  </option>
                ))}
              </select>
            )}
            {seasonRowsLoading && <div style={s.centerBox}>Se încarcă…</div>}
            {!seasonRowsLoading && liveSeasonRows.length === 0 && <EmptyState icon="🏆" title="Sezonul ăsta nu are încă puncte." />}
            {!seasonRowsLoading && liveSeasonRows.map((r, i) => (
              <PlayerRankRow
                key={r.uid}
                rank={i + 1}
                nickname={profiles[r.uid]?.nickname || r.uid}
                avatarId={profiles[r.uid]?.avatarId}
                totalPoints={r.totalPoints}
                top3={i < 3}
                onClick={() => handleOpenPlayer(r.uid, i + 1, undefined, "sezon")}
              />
            ))}
          </div>
        )}

        {!loading && !error && tab === "general" && (
          <div style={s.list}>
            {liveGeneralRows.length === 0 && <EmptyState icon="🏆" title="Niciun user încă." />}
            {liveGeneralRows.map((r, i) => (
              <PlayerRankRow
                key={r.uid}
                rank={i + 1}
                nickname={r.nickname || r.uid}
                avatarId={r.avatarId}
                totalPoints={r.totalPoints}
                top3={i < 3}
                onClick={() => handleOpenPlayer(r.uid, i + 1, undefined, "general")}
              />
            ))}
          </div>
        )}
      </div>

      {openUid && !cardLoading && cardStats && (
        <PlayerCard
          uid={openUid}
          nickname={profiles[openUid]?.nickname || openUid}
          avatarId={profiles[openUid]?.avatarId}
          rank={cardStats.rank}
          scope={cardScope}
          stats={cardStats}
          onClose={closePlayerCard}
        />
      )}
    </div>
  );
}

const s = {
  tabRow: { display: "flex", gap: 8, marginBottom: 16 },
  tabBtn: {
    flex: 1, background: color.surfaceInset, border: `1px solid ${color.border}`, color: color.textMuted,
    borderRadius: radius.sm, padding: "10px 0", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: font.body,
  },
  tabBtnActive: { background: color.goldGradient, color: color.goldOn, border: "none" },
  centerBox: { textAlign: "center", color: color.textMuted, fontSize: 13.5, padding: "30px 16px" },
  seasonSelect: {
    width: "100%", padding: "10px 12px", marginBottom: 10, borderRadius: 10,
    background: color.surfaceInset, border: `1px solid ${color.border}`, color: color.textPrimary,
    fontSize: 13.5, fontFamily: font.body,
  },
  diagBox: {
    background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(255,255,255,0.25)", borderRadius: radius.sm,
    padding: 12, marginBottom: 14, fontFamily: "monospace",
  },
  diagTitle: { fontSize: 11, fontWeight: 800, color: "#D4AF37", marginBottom: 8, fontFamily: font.body },
  diagRow: { fontSize: 11, color: color.textSecondary, marginBottom: 3, lineHeight: 1.5 },
  diagBtn: {
    width: "100%", marginTop: 10, background: "linear-gradient(180deg, #F0D875, #C9A227)", border: "none",
    borderRadius: radius.sm, padding: "10px 0", fontSize: 12, fontWeight: 800, color: "#1A1200", cursor: "pointer", fontFamily: font.body,
  },
  diagMsg: { fontSize: 11, color: color.textPrimary, marginTop: 8, fontWeight: 700, fontFamily: font.body },
  liveRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  list: { display: "flex", flexDirection: "column", gap: 7 },

  pastSection: { marginTop: 14, display: "flex", flexDirection: "column", gap: 6 },
  pastSectionLabel: {
    fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase",
    color: color.textFaint, marginBottom: 2, fontFamily: font.body,
  },
  pastGwBlock: { background: color.surfaceInset, border: `1px solid ${color.border}`, borderRadius: radius.md, overflow: "hidden" },
  pastGwHeader: {
    width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
    background: "none", border: "none", padding: "11px 14px", cursor: "pointer",
    fontSize: 12.5, fontWeight: 700, color: color.textPrimary, fontFamily: font.body,
  },
  pastGwChevron: { color: color.textFaint, fontSize: 11, transition: "transform 200ms ease" },
  pastGwBody: { padding: "0 8px 8px", display: "flex", flexDirection: "column", gap: 6 },
};
