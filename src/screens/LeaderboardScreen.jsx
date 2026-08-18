import { useEffect, useState } from "react";
import { getCurrentSeason, getCurrentGameweek } from "../services/predictionsService";
import {
  listGameweekScores,
  listSeasonLeaderboard,
  listGeneralLeaderboard,
  listenLiveGameweekScores,
  getLastCompletedGameweek,
  getPlayerCardStats,
  listGameweeks,
} from "../services/adminService";
import { getUserPublicProfiles } from "../services/profilesService";
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

export default function LeaderboardScreen({ onBack, user }) {
  const [tab, setTab] = useState("gameweek"); // gameweek | season | general
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [season, setSeason] = useState(null);
  const [gameweek, setGameweek] = useState(null); // etapa curentă SAU ultima finalizată (fallback)
  const [usedFallback, setUsedFallback] = useState(false);
  const [gwRows, setGwRows] = useState([]);
  const [gwLive, setGwLive] = useState(false);

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

          const sRows = await listSeasonLeaderboard(s.id);
          setSeasonRows(sRows);
          const p2 = await getUserPublicProfiles(sRows.map((r) => r.uid));
          setProfiles((prev) => ({ ...prev, ...p2 }));
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

  // Clasament LIVE — doar dacă etapa "curentă" (nu fallback) e chiar
  // în desfășurare, nu deja finalizată.
  useEffect(() => {
    if (!gameweek || gameweek.status === "completed") return;
    setGwLive(true);
    const unsubscribe = listenLiveGameweekScores(gameweek.id, async (rawRows) => {
      const rows = rawRows.map(normalizeRow);
      setGwRows(rows);
      const names = await getUserPublicProfiles(rows.map((r) => r.uid));
      setProfiles((prev) => ({ ...prev, ...names }));
    });
    return unsubscribe;
  }, [gameweek?.id, gameweek?.status]);

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
  async function handleOpenPlayer(uid, rank, contextGwId = gameweek?.id) {
    // Card-ul de jucător e un sub-ecran din perspectiva Back-ului — Android
    // Back trebuie să-l închidă întâi, nu să sară direct la Home. Se
    // împinge o intrare de istoric LOCALĂ acestui ecran (nu afectează
    // App.jsx), simetrică cu popstate-ul de mai jos.
    window.history.pushState({ leaderboardPlayerCard: uid }, "");
    setOpenUid(uid);
    setCardStats(null);
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

  return (
    <div style={layout.page}>
      <div style={layout.wrap}>
        <PageHeader title="Clasament" onBack={onBack} />

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
            {!gameweek && <EmptyState icon="📅" title="Încă nu există nicio etapă." />}
            {gameweek && gwRows.length === 0 && (
              <EmptyState icon="🏆" title={`Etapa "${gameweek.title}" nu are încă rezultate introduse.`} />
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
            {gwRows.map((r) => (
              <PlayerRankRow
                key={r.uid}
                rank={r.rank}
                nickname={profiles[r.uid]?.nickname || r.uid}
                avatarId={profiles[r.uid]?.avatarId}
                pointsFromMatches={r.pointsFromMatches}
                rankingBonus={r.rankingBonus}
                totalPoints={r.totalPoints}
                top3={r.rank <= 3}
                showBonus={!gwLive}
                onClick={() => handleOpenPlayer(r.uid, r.rank)}
              />
            ))}

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
                              onClick={() => handleOpenPlayer(r.uid, r.rank, gw.id)}
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
            {seasonRows.length === 0 && <EmptyState icon="🏆" title="Sezonul ăsta nu are încă etape finalizate." />}
            {seasonRows.map((r, i) => (
              <PlayerRankRow
                key={r.uid}
                rank={i + 1}
                nickname={profiles[r.uid]?.nickname || r.uid}
                avatarId={profiles[r.uid]?.avatarId}
                totalPoints={r.totalPoints}
                top3={i < 3}
                onClick={() => handleOpenPlayer(r.uid, i + 1)}
              />
            ))}
          </div>
        )}

        {!loading && !error && tab === "general" && (
          <div style={s.list}>
            {generalRows.length === 0 && <EmptyState icon="🏆" title="Niciun user încă." />}
            {generalRows.map((r, i) => (
              <PlayerRankRow
                key={r.uid}
                rank={i + 1}
                nickname={r.nickname || r.uid}
                avatarId={r.avatarId}
                totalPoints={r.seasonPoints || 0}
                top3={i < 3}
                onClick={() => handleOpenPlayer(r.uid, i + 1)}
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
