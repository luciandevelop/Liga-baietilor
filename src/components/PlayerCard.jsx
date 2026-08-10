import { useState } from "react";
import ClubCrest from "./ClubCrest";
import PlayerAvatar from "./PlayerAvatar";
import PointsBadge from "./PointsBadge";
import { color, font, radius, shadow } from "../theme";

// SINGURA componentă de card jucător din toată aplicația — folosită
// identic din Clasament (toate 3 taburi: Etapă/Sezon/General) și din
// Admin (preview Live). Nu există o a doua implementare nicăieri.
//
// `stats` vine din adminService.getPlayerCardStats(uid, seasonId,
// etapaGameweekId) — SINGURA sursă de citire pentru card, indiferent de
// unde a fost deschis. Conținutul cardului (etapă/sezon/general, toate
// statisticile) e deci mereu identic pentru același user; doar `rank`
// diferă firesc, în funcție de clasamentul din care ai apăsat.
//
// SIMPLIFICARE reală față de versiunea anterioară: `stats.matches` vine
// STRICT din gameweekScores (scris o singură dată, la finalizarea unei
// etape) — spre deosebire de gameweekLiveScores (folosit doar pe durata
// unei etape încă LIVE), acolo pronosticurile NU sunt niciodată ascunse
// (nu mai are sens să ascunzi pronosticul cuiva pentru un meci deja
// încheiat de mult). Toată mașinăria de "reveal" (tryLoadPrediction,
// predictionHidden, isOwn) a dispărut — cardul nou n-o mai are nevoie.
export default function PlayerCard({ nickname, avatarId, rank, stats, onClose }) {
  const [flipped, setFlipped] = useState(false);
  if (!stats) return null;

  const matches = (stats.matches || []).slice().sort((a, b) => {
    const at = a.kickoffAt?.toMillis ? a.kickoffAt.toMillis() : 0;
    const bt = b.kickoffAt?.toMillis ? b.kickoffAt.toMillis() : 0;
    return at - bt;
  });

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.sheet} onClick={(e) => e.stopPropagation()}>
        <div style={s.grabber} />

        {/* ── Card FIFA — flip 3D, apasă oriunde pe el ── */}
        <div style={s.flipScene}>
          <div style={{ ...s.flipInner, transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }} onClick={() => setFlipped((v) => !v)}>
            {/* FAȚĂ */}
            <div style={{ ...s.flipFace, ...s.playerCard }}>
              <button style={s.closeBtn} onClick={(e) => { e.stopPropagation(); onClose(); }} type="button">✕</button>
              <PlayerAvatar avatarId={avatarId} nickname={nickname} size={64} />
              <h3 style={s.playerName}>{nickname}</h3>
              <span style={s.playerRank}>{rank ? `#${rank}` : "Fără clasare încă"}</span>
              <div style={s.playerTotal}>
                <PointsBadge value={stats.generalPoints} size={26} tone="gold" />
                <span style={s.playerTotalLabel}>TOTAL GENERAL</span>
              </div>
              <span style={s.flipHint}>Apasă pentru statistici ⟳</span>
            </div>

            {/* VERSO */}
            <div style={{ ...s.flipFace, ...s.flipBack }}>
              <button style={s.closeBtn} onClick={(e) => { e.stopPropagation(); onClose(); }} type="button">✕</button>
              <div style={s.backTitle}>{nickname} · Statistici</div>

              <div style={s.pointsRow}>
                <div style={s.pointsTile}>
                  <span style={s.pointsValue}>{stats.etapaPoints ?? "–"}</span>
                  <span style={s.pointsLabel}>Etapă</span>
                </div>
                <div style={s.pointsTile}>
                  <span style={s.pointsValue}>{stats.seasonPoints}</span>
                  <span style={s.pointsLabel}>Sezon</span>
                </div>
                <div style={s.pointsTile}>
                  <span style={s.pointsValue}>{stats.generalPoints}</span>
                  <span style={s.pointsLabel}>General</span>
                </div>
              </div>

              <div style={s.statsGrid}>
                <div style={s.statTile}>
                  <span style={s.statValue}>{stats.exactScores}</span>
                  <span style={s.statLabel}>Scor exact</span>
                </div>
                <div style={s.statTile}>
                  <span style={s.statValue}>{stats.exactPct}%</span>
                  <span style={s.statLabel}>Reușită scor</span>
                </div>
                <div style={s.statTile}>
                  <span style={s.statValue}>{stats.cornersTotal}</span>
                  <span style={s.statLabel}>Cornere</span>
                </div>
                <div style={s.statTile}>
                  <span style={s.statValue}>{stats.cardsTotal}</span>
                  <span style={s.statLabel}>Cartonașe</span>
                </div>
                <div style={s.statTile}>
                  <span style={{ ...s.statValue, color: stats.jokerUsed ? color.green : color.textFaint }}>{stats.jokerUsed ? "Da" : "Nu"}</span>
                  <span style={s.statLabel}>Joker</span>
                </div>
                <div style={s.statTile}>
                  <span style={{ ...s.statValue, color: stats.bonusTotal >= 0 ? color.green : color.red }}>
                    {stats.bonusTotal >= 0 ? "+" : ""}{stats.bonusTotal}p
                  </span>
                  <span style={s.statLabel}>Bonus poziție</span>
                </div>
              </div>

              <span style={s.flipHint}>Apasă pentru a reveni ⟲</span>
            </div>
          </div>
        </div>

        <div style={s.list}>
          {matches.length === 0 && (
            <div style={s.emptyMatches}>Etapa curentă nu e finalizată încă — meciurile apar aici după închidere.</div>
          )}
          {matches.map((m) => (
            <MatchBreakdownRow key={m.matchId} m={m} />
          ))}
        </div>
      </div>
    </div>
  );
}

function MatchBreakdownRow({ m }) {
  const predText = m.prediction ? `${m.prediction.scoreA}-${m.prediction.scoreB}` : null;

  // "no-prediction" — userul n-a pontat deloc.
  if (m.status === "no-prediction") {
    return (
      <div style={s.compactRow}>
        <ClubCrest teamName={m.homeTeam} size={20} />
        <span style={s.compactTeams}>{m.homeTeam} – {m.awayTeam}</span>
        <span style={s.compactStatus}>Fără pronostic · 0p</span>
      </div>
    );
  }

  // "scored" — singurul caz posibil, altfel (breakdown-ul finalizat nu
  // conține meciuri "pending" — o etapă nu se finalizează cu meciuri
  // neîncheiate).
  return (
    <div style={{ ...s.card, ...(m.isJoker ? s.cardJoker : {}), ...(m.isFeatured ? s.cardFeatured : {}) }}>
      <div style={s.cardTop}>
        <div style={s.teamsInline}>
          <ClubCrest teamName={m.homeTeam} size={26} />
          <span style={s.teamsText}>{m.homeTeam} vs {m.awayTeam}</span>
          <ClubCrest teamName={m.awayTeam} size={26} />
        </div>
        <span style={s.cardTotal}>{m.finalMatchPoints}p</span>
      </div>

      {(m.isFeatured || m.isJoker) && (
        <div style={s.badgeRow}>
          {m.isFeatured && <span style={s.tagFeatured}>⭐ ×2</span>}
          {m.isJoker && <span style={s.tagJoker}>🃏 ×2</span>}
        </div>
      )}

      <div style={s.predVsReal}>
        <div style={s.predVsRealCol}>
          <span style={s.predVsRealLabel}>PREDICȚIE</span>
          <span style={s.predVsRealScore}>{predText || "–"}</span>
        </div>
        <span style={s.predVsRealArrow}>vs</span>
        <div style={s.predVsRealCol}>
          <span style={s.predVsRealLabel}>REAL</span>
          <span style={{ ...s.predVsRealScore, color: color.goldLight }}>{m.real.scoreA}-{m.real.scoreB}</span>
        </div>
      </div>

      <div style={s.breakdownRow}>
        <span>Scor <b style={s.breakdownVal}>+{m.scorePoints}</b></span>
        <span>Cornere <b style={s.breakdownVal}>+{m.cornersPoints}</b></span>
        <span>Cartonașe <b style={s.breakdownVal}>+{m.cardsPoints}</b></span>
      </div>
    </div>
  );
}

const s = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(5,7,14,0.72)",
    display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100,
  },
  sheet: {
    width: "100%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto",
    background: color.surfaceInset, borderTop: `1px solid ${color.border}`, borderRadius: "20px 20px 0 0",
    padding: "10px 14px 24px", fontFamily: font.body,
  },
  grabber: { width: 36, height: 4, borderRadius: 999, background: color.border, margin: "0 auto 14px" },

  flipScene: { perspective: "1400px", marginBottom: 12 },
  flipInner: {
    position: "relative", width: "100%", minHeight: 290, transformStyle: "preserve-3d",
    transition: "transform 620ms cubic-bezier(.4,.2,.2,1)", cursor: "pointer",
  },
  flipFace: {
    position: "absolute", inset: 0, backfaceVisibility: "hidden", borderRadius: radius.lg,
    display: "flex", flexDirection: "column",
  },
  flipBack: {
    transform: "rotateY(180deg)", background: "linear-gradient(180deg, rgba(201,162,39,0.1), transparent)",
    border: "1px solid rgba(201,162,39,0.25)", padding: "16px 14px 14px", alignItems: "center",
  },
  flipHint: {
    position: "absolute", bottom: 8, left: 0, right: 0, textAlign: "center",
    fontSize: 8.5, color: color.textFaint, fontWeight: 600, letterSpacing: "0.02em",
  },
  backTitle: { fontSize: 12.5, fontWeight: 700, color: color.textPrimary, marginBottom: 10, fontFamily: font.display },

  playerCard: {
    position: "relative", alignItems: "center", gap: 4,
    background: "linear-gradient(180deg, rgba(201,162,39,0.12), transparent)",
    border: "1px solid rgba(201,162,39,0.25)", padding: "22px 16px 16px",
  },
  closeBtn: {
    position: "absolute", top: 10, right: 10,
    background: color.surfaceElevated, border: `1px solid ${color.border}`, color: color.textMuted,
    borderRadius: 8, width: 30, height: 30, fontSize: 13, cursor: "pointer", flexShrink: 0, zIndex: 2,
  },
  playerName: { fontSize: 17, fontWeight: 700, color: color.textPrimary, margin: "10px 0 0", fontFamily: font.display },
  playerRank: { fontSize: 11.5, color: color.gold, fontWeight: 700, marginBottom: 10 },
  playerTotal: { display: "flex", flexDirection: "column", alignItems: "center", gap: 3 },
  playerTotalLabel: { fontSize: 9, color: color.textFaint, fontWeight: 700, letterSpacing: "0.05em" },

  pointsRow: { display: "flex", gap: 6, width: "100%", marginBottom: 8 },
  pointsTile: {
    flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
    background: "rgba(201,162,39,0.1)", border: "1px solid rgba(201,162,39,0.3)", borderRadius: radius.md, padding: "8px 2px",
  },
  pointsValue: { fontSize: 16, fontWeight: 800, color: color.goldLight, fontFamily: font.display },
  pointsLabel: { fontSize: 8, color: color.textFaint, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" },

  statsGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 8, width: "100%" },
  statTile: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
    background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.md, padding: "9px 2px",
  },
  statValue: { fontSize: 16, fontWeight: 800, color: color.textPrimary, fontFamily: font.display },
  statLabel: { fontSize: 8, color: color.textFaint, fontWeight: 700, letterSpacing: "0.01em", textAlign: "center" },

  list: { display: "flex", flexDirection: "column", gap: 8 },
  emptyMatches: {
    textAlign: "center", fontSize: 11.5, color: color.textFaint, padding: "16px 10px",
    background: color.surface, border: `1px solid ${color.borderSubtle}`, borderRadius: radius.sm,
  },

  compactRow: {
    display: "flex", alignItems: "center", gap: 8, background: color.surface,
    border: `1px solid ${color.borderSubtle}`, borderRadius: radius.sm, padding: "7px 10px",
  },
  compactTeams: {
    fontSize: 11.5, fontWeight: 600, color: color.textSecondary, flex: 1, minWidth: 0,
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  compactStatus: {
    fontSize: 9.5, fontWeight: 700, color: color.textFaint, flexShrink: 0,
    background: color.surfaceInset, borderRadius: 999, padding: "2px 8px",
  },

  card: {
    background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.md, padding: "12px 12px",
  },
  cardFeatured: { border: "1px solid rgba(201,162,39,0.35)" },
  cardJoker: { border: "1px solid rgba(63,168,92,0.4)" },
  cardTop: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
  teamsInline: { display: "flex", alignItems: "center", gap: 7, minWidth: 0, flex: 1 },
  teamsText: {
    fontSize: 12, fontWeight: 700, color: color.textPrimary,
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  cardTotal: { fontSize: 19, fontWeight: 700, color: color.goldLight, flexShrink: 0, fontFamily: font.display },

  badgeRow: { display: "flex", gap: 6, marginTop: 8 },
  tagFeatured: {
    fontSize: 9.5, fontWeight: 800, color: color.goldLight, background: "rgba(201,162,39,0.14)",
    border: "1px solid rgba(201,162,39,0.4)", borderRadius: 999, padding: "2px 7px",
  },
  tagJoker: {
    fontSize: 9.5, fontWeight: 800, color: color.green, background: color.greenBg,
    border: `1px solid ${color.greenBorder}`, borderRadius: 999, padding: "2px 7px",
  },

  predVsReal: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 14,
    marginTop: 12, paddingTop: 12, borderTop: `1px solid ${color.borderSubtle}`,
  },
  predVsRealCol: { display: "flex", flexDirection: "column", alignItems: "center", gap: 2 },
  predVsRealLabel: { fontSize: 9, fontWeight: 700, color: color.textFaint, letterSpacing: "0.05em" },
  predVsRealScore: { fontSize: 20, fontWeight: 700, color: color.textPrimary, fontFamily: font.display },
  predVsRealArrow: { fontSize: 11, color: color.textFaint, fontWeight: 700, marginTop: 12 },

  breakdownRow: {
    display: "flex", justifyContent: "space-between", fontSize: 11, color: color.textMuted,
    marginTop: 10, paddingTop: 10, borderTop: `1px solid ${color.borderSubtle}`,
  },
  breakdownVal: { color: color.textSecondary, fontWeight: 700 },
};
