import { useEffect, useState } from "react";
import { getCurrentSeason, getCurrentGameweek } from "../services/predictionsService";
import { listenLiveGameweekScores, listGameweekScores } from "../services/adminService";
import { getUserPublicProfiles } from "../services/profilesService";
import {
  getWeeklySurprise, getSecretMain, getSecretBonus, getSurpriseResult,
  listSeasonSurprises, getSurpriseStatus, MAIN_CATALOG, BONUS_CATALOG,
} from "../services/surprisesService";
import PageHeader from "../components/PageHeader";
import DuelExperience from "../components/DuelExperience";
import RouletteExperience from "../components/RouletteExperience";
import { color, font, radius } from "../matchdayTheme";

function catalogLabel(list, id) {
  return list.find((c) => c.id === id)?.label || id;
}

export default function SurprisesScreen({ user, onBack }) {
  const [loading, setLoading] = useState(true);
  const [season, setSeason] = useState(null);
  const [gameweek, setGameweek] = useState(null);
  const [pub, setPub] = useState(null);
  const [secretMain, setSecretMain] = useState(null);
  const [secretBonus, setSecretBonus] = useState(null);
  const [myResult, setMyResult] = useState(null);
  const [profiles, setProfiles] = useState({});
  const [liveScores, setLiveScores] = useState({});
  const [history, setHistory] = useState([]);

  useEffect(() => {
    let unsubScores = null;
    (async () => {
      setLoading(true);
      const s = await getCurrentSeason();
      setSeason(s);
      if (!s) { setLoading(false); return; }

      const gw = await getCurrentGameweek(s.id);
      setGameweek(gw);

      if (gw) {
        const [p, res] = await Promise.all([getWeeklySurprise(gw.id), getSurpriseResult(gw.id, user.uid)]);
        setPub(p);
        setMyResult(res);

        const [sm, sb] = await Promise.all([getSecretMain(gw.id), getSecretBonus(gw.id)]);
        setSecretMain(sm);
        setSecretBonus(sb);

        if (sm?.config?.pairings) {
          const uids = sm.config.pairings.flatMap((pr) => [pr.playerA, pr.playerB]);
          if (sm.config.byePlayer) uids.push(sm.config.byePlayer);
          getUserPublicProfiles(uids).then(setProfiles);
        }

        unsubScores = listenLiveGameweekScores(gw.id, (rows) => {
          const map = {};
          rows.forEach((r) => { map[r.userId] = r.totalPoints || 0; });
          setLiveScores(map);
        });
      }

      const hist = await listSeasonSurprises(s.id);
      setHistory(hist);
      setLoading(false);
    })();

    return () => { if (unsubScores) unsubScores(); };
  }, [user.uid]);

  const status = getSurpriseStatus(pub);
  const myPairing = secretMain?.config?.pairings?.find((p) => p.playerA === user.uid || p.playerB === user.uid);
  const isMyBye = secretMain?.config?.byePlayer === user.uid;
  const myOpponent = myPairing ? (myPairing.playerA === user.uid ? myPairing.playerB : myPairing.playerA) : null;

  const deadlinePassed = gameweek?.status === "completed";

  return (
    <div style={s.page}>
      <div style={s.wrap}>
        <PageHeader title="🎭 Surprizele Săptămânii" onBack={onBack} />

        {loading && <div style={s.hint}>Se încarcă…</div>}

        {!loading && !gameweek && <div style={s.hint}>Nu există etapă activă acum.</div>}

        {!loading && gameweek && (
          <>
            <div style={s.currentSection}>
              <div style={s.currentLabel}>{gameweek.title || `Etapa ${gameweek.number}`}</div>

              {/* ── MAIN ── */}
              <div style={s.block}>
                <div style={s.blockHead}>🏆 SURPRIZA PRINCIPALĂ</div>
                {!pub?.mainRevealed ? (
                  <div style={s.lockedCard}>🔒 <span>Încă secretă</span></div>
                ) : (
                  <>
                    <div style={s.revealedTypeLabel}>{catalogLabel(MAIN_CATALOG, secretMain?.type)}</div>
                    {secretMain?.type === "duel-random" && (
                      <DuelExperience
                        myUid={user.uid}
                        opponentUid={myOpponent}
                        isBye={isMyBye}
                        profiles={profiles}
                        liveScores={liveScores}
                        resolved={!!pub?.mainResolved}
                        myPoints={myResult?.mainPoints}
                      />
                    )}
                  </>
                )}
              </div>

              {/* ── BONUS ── */}
              <div style={s.block}>
                <div style={s.blockHead}>🎁 BONUSUL SĂPTĂMÂNII</div>
                {!pub?.bonusRevealed ? (
                  <div style={s.lockedCard}>🔒 <span>Încă secret</span></div>
                ) : (
                  <>
                    <div style={s.revealedTypeLabel}>{catalogLabel(BONUS_CATALOG, secretBonus?.type)}</div>
                    {secretBonus?.type === "roulette" && (
                      <RouletteExperience
                        gameweekId={gameweek.id}
                        uid={user.uid}
                        deadlinePassed={deadlinePassed}
                        onResolvedChange={() => getSurpriseResult(gameweek.id, user.uid).then(setMyResult)}
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )}

        <div style={s.historySection}>
          <div style={s.historyLabel}>📚 SEZONUL SURPRIZELOR</div>
          {history.length === 0 && !loading && <div style={s.hint}>Niciun sezon activ.</div>}
          {history.map((h) => (
            <div key={h.gameweek.id} style={s.historyRow}>
              <div style={s.historyTitle}>{h.gameweek.title || `Etapa ${h.gameweek.number}`}</div>
              <div style={s.historyLine}>
                🏆 {h.public?.mainRevealed ? "" : "?"}
                <span style={s.historyStatusTag}>
                  {h.status === "locked" ? "🔒 BLOCATĂ" : h.status === "active" ? "⚡ ACTIVĂ" : "✅ REZOLVATĂ"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const s = {
  page: { minHeight: "100vh", background: color.bg },
  wrap: { maxWidth: 480, margin: "0 auto", padding: "0 16px 32px" },
  hint: { fontSize: 12.5, color: color.textFaint, fontFamily: font.body, padding: "16px 0", textAlign: "center" },

  currentSection: { marginTop: 8 },
  currentLabel: { fontSize: 11, fontWeight: 800, letterSpacing: "0.05em", color: color.textFaint, fontFamily: font.body, marginBottom: 10, textTransform: "uppercase" },
  block: { marginBottom: 20 },
  blockHead: { fontFamily: font.display, fontSize: 14, fontWeight: 800, color: color.textPrimary, marginBottom: 10 },
  lockedCard: {
    display: "flex", alignItems: "center", gap: 8, justifyContent: "center", padding: "28px 16px",
    background: "rgba(255,255,255,0.03)", border: `1px dashed ${color.border}`, borderRadius: radius.lg,
    color: color.textFaint, fontSize: 13, fontFamily: font.body,
  },
  revealedTypeLabel: { fontSize: 11.5, color: color.goldLight, fontWeight: 700, fontFamily: font.body, marginBottom: 8, textAlign: "center" },

  historySection: { marginTop: 26 },
  historyLabel: { fontSize: 11, fontWeight: 800, letterSpacing: "0.05em", color: color.textFaint, fontFamily: font.body, marginBottom: 10, textTransform: "uppercase" },
  historyRow: {
    background: color.surfaceInset, border: `1px solid ${color.border}`, borderRadius: radius.md,
    padding: "12px 14px", marginBottom: 8,
  },
  historyTitle: { fontSize: 12.5, fontWeight: 700, color: color.textPrimary, fontFamily: font.body, marginBottom: 4 },
  historyLine: { fontSize: 11, color: color.textSecondary, fontFamily: font.body, display: "flex", alignItems: "center", justifyContent: "space-between" },
  historyStatusTag: { fontSize: 10, fontWeight: 700, color: color.textFaint },
};
