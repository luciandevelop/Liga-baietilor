import { useEffect, useState } from "react";
import { tryLoadPrediction } from "../services/predictionsService";
import ClubCrest from "./ClubCrest";
import PlayerAvatar from "./PlayerAvatar";
import PointsBadge from "./PointsBadge";
import { color, font, radius, shadow } from "../theme";

// Afișează, pentru un singur user, punctajul/pronosticul meci-cu-meci al
// etapei — sursă unică pentru puncte: scoringEngine (prin adminService).
//
// PRIVACY (neschimbată față de trecut):
// - `row.breakdown` vine fie din computeGameweekResults (Admin — acces
//   complet), fie din gameweekLiveScores (useri normali — sanitizat de
//   admin la scriere: fără pronostic/Joker pentru alții, pre-lock).
// - Pentru un meci încă marcat `predictionHidden`, componenta ÎNCEARCĂ o
//   citire directă prin `tryLoadPrediction` — securitatea reală vine din
//   firestore.rules (verifică timpul pe server), NU din ceasul telefonului.
//   Un refuz e tratat silențios ca "încă ascuns".
// - Pentru PROPRIUL rând (isOwn=true), `ownPredictions`/`ownJokerMatchId`
//   suprascriu afișarea — userul își vede mereu propriul pronostic/Joker.
export default function PlayerBreakdownModal({ nickname, avatarId, row, isOwn, showBonus = true, ownPredictions, ownJokerMatchId, onClose }) {
  if (!row) return null;
  const entries = Object.values(row.breakdown || {}).sort((a, b) => {
    const at = a.kickoffAt?.toMillis ? a.kickoffAt.toMillis() : 0;
    const bt = b.kickoffAt?.toMillis ? b.kickoffAt.toMillis() : 0;
    return at - bt;
  });

  // Statistici mari (stil card FIFA Ultimate Team) — agregate PUR vizual,
  // calculate din valorile deja existente în breakdown (scorePoints /
  // cornersPoints / cardsPoints / isJoker), NU o recalculare a punctajului.
  const scoredEntries = entries.filter((m) => m.status === "scored");
  const exactScores = scoredEntries.filter((m) => m.scorePoints === 120).length;
  const cornersTotal = scoredEntries.reduce((sum, m) => sum + (m.cornersPoints || 0), 0);
  const cardsTotal = scoredEntries.reduce((sum, m) => sum + (m.cardsPoints || 0), 0);
  const jokerUsed = entries.some((m) => m.isJoker || (isOwn && ownJokerMatchId === m.matchId));

  const displayTotal = showBonus ? row.totalPoints : row.pointsFromMatches;

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.sheet} onClick={(e) => e.stopPropagation()}>
        <div style={s.grabber} />

        {/* ── Card jucător, stil Ultimate Team ── */}
        <div style={s.playerCard}>
          <button style={s.closeBtn} onClick={onClose} type="button">✕</button>
          <PlayerAvatar avatarId={avatarId} nickname={nickname} size={56} />
          <h3 style={s.playerName}>{nickname}</h3>
          <span style={s.playerRank}>{row.rank ? `#${row.rank} în etapă` : "Fără rezultate încă"}</span>
          <div style={s.playerTotal}>
            <PointsBadge value={displayTotal} size={26} tone="gold" />
            <span style={s.playerTotalLabel}>{showBonus ? "TOTAL ETAPĂ" : "PUNCTE DIN MECIURI"}</span>
          </div>
        </div>

        {/* ── Statistici mari ── */}
        <div style={s.statsGrid}>
          <div style={s.statTile}>
            <span style={s.statValue}>{exactScores}</span>
            <span style={s.statLabel}>Scor exact</span>
          </div>
          <div style={s.statTile}>
            <span style={s.statValue}>{cornersTotal}</span>
            <span style={s.statLabel}>Cornere</span>
          </div>
          <div style={s.statTile}>
            <span style={s.statValue}>{cardsTotal}</span>
            <span style={s.statLabel}>Cartonașe</span>
          </div>
          <div style={s.statTile}>
            <span style={{ ...s.statValue, color: jokerUsed ? color.green : color.textFaint }}>{jokerUsed ? "Da" : "Nu"}</span>
            <span style={s.statLabel}>Joker</span>
          </div>
        </div>

        {showBonus && (
          <div style={s.bonusRow}>
            <span style={s.bonusRowLabel}>Bonus poziție</span>
            <span style={{ ...s.bonusRowValue, color: row.rankingBonus >= 0 ? color.green : color.red }}>
              {row.rankingBonus >= 0 ? "+" : ""}{row.rankingBonus}p
            </span>
          </div>
        )}

        <div style={s.list}>
          {entries.map((m) => (
            <MatchBreakdownRow
              key={m.matchId}
              m={m}
              viewedUid={row.uid}
              isOwn={isOwn}
              ownPrediction={isOwn ? ownPredictions?.[m.matchId] : null}
              isOwnJoker={isOwn && ownJokerMatchId === m.matchId}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function MatchBreakdownRow({ m, viewedUid, isOwn, ownPrediction, isOwnJoker }) {
  // Dacă avem deja pronosticul (din breakdown direct, sau din propriul
  // pronostic suprapus), îl folosim. Altfel — dacă e ascuns și NU e
  // propriul rând — încercăm o citire directă, o singură dată; Firestore
  // decide dacă e permisă (lock trecut) sau nu.
  const [revealed, setRevealed] = useState(null);
  const hasPredictionSlot = m.status === "pending" || m.status === "scored";
  const needsAttempt = hasPredictionSlot && m.predictionHidden && !isOwn && !revealed;

  useEffect(() => {
    let cancelled = false;
    if (needsAttempt) {
      tryLoadPrediction(m.matchId, viewedUid).then((data) => {
        if (!cancelled && data) setRevealed(data);
      });
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.matchId, viewedUid, m.predictionHidden]);

  // IMPORTANT: `prediction` poate fi null pentru "no-prediction" (userul
  // chiar n-a pontat) — NICIUN cod de mai jos trebuie să dereferențieze
  // prediction.* fără să verifice întâi. `predText` e calculat o singură
  // dată, în siguranță, și refolosit peste tot.
  const prediction = m.prediction || (isOwn ? ownPrediction : null) || revealed || null;
  const isJoker = m.isJoker || isOwnJoker;
  const predText = prediction ? `${prediction.scoreA}-${prediction.scoreB}` : null;
  const hidden = hasPredictionSlot && !prediction;

  // "no-prediction" — userul n-a pontat deloc, indiferent de status/lock.
  if (m.status === "no-prediction") {
    return (
      <div style={s.compactRow}>
        <ClubCrest teamName={m.homeTeam} size={20} />
        <span style={s.compactTeams}>{m.homeTeam} – {m.awayTeam}</span>
        <span style={s.compactStatus}>Fără pronostic · 0p</span>
      </div>
    );
  }

  // "pending" — meci fără rezultat real încă. Card compact, mult mai mic
  // decât un meci punctat.
  if (m.status === "pending") {
    return (
      <div style={s.compactRow}>
        <ClubCrest teamName={m.homeTeam} size={20} />
        <span style={s.compactTeams}>{m.homeTeam} – {m.awayTeam}</span>
        <span style={s.compactPred}>{hidden ? "Ascuns" : `Pron: ${predText}`}</span>
        <span style={s.compactStatus}>În așteptare</span>
      </div>
    );
  }

  // "scored" — meci complet, breakdown deplin.
  return (
    <div style={{ ...s.card, ...(isJoker ? s.cardJoker : {}), ...(m.isFeatured ? s.cardFeatured : {}) }}>
      {/* Linia 1 — echipe + total meci mare, vizibil instant */}
      <div style={s.cardTop}>
        <div style={s.teamsInline}>
          <ClubCrest teamName={m.homeTeam} size={26} />
          <span style={s.teamsText}>{m.homeTeam} vs {m.awayTeam}</span>
          <ClubCrest teamName={m.awayTeam} size={26} />
        </div>
        <span style={s.cardTotal}>{m.finalMatchPoints}p</span>
      </div>

      {(m.isFeatured || isJoker) && (
        <div style={s.badgeRow}>
          {m.isFeatured && <span style={s.tagFeatured}>⭐ ×2</span>}
          {isJoker && <span style={s.tagJoker}>🃏 ×2</span>}
        </div>
      )}

      {/* Linia 2 — predicție vs real, centrul vizual al cardului */}
      <div style={s.predVsReal}>
        <div style={s.predVsRealCol}>
          <span style={s.predVsRealLabel}>PREDICȚIE</span>
          <span style={s.predVsRealScore}>{hidden ? "Ascuns până la lock" : predText}</span>
        </div>
        <span style={s.predVsRealArrow}>vs</span>
        <div style={s.predVsRealCol}>
          <span style={s.predVsRealLabel}>REAL</span>
          <span style={{ ...s.predVsRealScore, color: color.goldLight }}>{m.real.scoreA}-{m.real.scoreB}</span>
        </div>
      </div>

      {/* Linia 3 — breakdown compact */}
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

  // ── Card jucător, stil Ultimate Team ──
  playerCard: {
    position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
    background: "linear-gradient(180deg, rgba(201,162,39,0.12), transparent)",
    border: "1px solid rgba(201,162,39,0.25)", borderRadius: radius.lg, padding: "22px 16px 16px", marginBottom: 12,
  },
  closeBtn: {
    position: "absolute", top: 10, right: 10,
    background: color.surfaceElevated, border: `1px solid ${color.border}`, color: color.textMuted,
    borderRadius: 8, width: 30, height: 30, fontSize: 13, cursor: "pointer", flexShrink: 0,
  },
  playerName: { fontSize: 17, fontWeight: 700, color: color.textPrimary, margin: "10px 0 0", fontFamily: font.display },
  playerRank: { fontSize: 11.5, color: color.gold, fontWeight: 700, marginBottom: 10 },
  playerTotal: { display: "flex", flexDirection: "column", alignItems: "center", gap: 3 },
  playerTotalLabel: { fontSize: 9, color: color.textFaint, fontWeight: 700, letterSpacing: "0.05em" },

  statsGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 10 },
  statTile: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
    background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.md, padding: "10px 2px",
  },
  statValue: { fontSize: 18, fontWeight: 800, color: color.textPrimary, fontFamily: font.display },
  statLabel: { fontSize: 8.5, color: color.textFaint, fontWeight: 700, letterSpacing: "0.01em", textAlign: "center" },

  bonusRow: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.md,
    padding: "9px 12px", marginBottom: 12,
  },
  bonusRowLabel: { fontSize: 11.5, color: color.textSecondary, fontWeight: 600 },
  bonusRowValue: { fontSize: 13, fontWeight: 800, fontFamily: font.display },

  list: { display: "flex", flexDirection: "column", gap: 8 },

  // Card compact — meciuri pending / fără pronostic
  compactRow: {
    display: "flex", alignItems: "center", gap: 8, background: color.surface,
    border: `1px solid ${color.borderSubtle}`, borderRadius: radius.sm, padding: "7px 10px",
  },
  compactTeams: {
    fontSize: 11.5, fontWeight: 600, color: color.textSecondary, flex: 1, minWidth: 0,
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  compactPred: { fontSize: 10.5, color: color.textFaint, flexShrink: 0 },
  compactStatus: {
    fontSize: 9.5, fontWeight: 700, color: color.textFaint, flexShrink: 0,
    background: color.surfaceInset, borderRadius: 999, padding: "2px 8px",
  },

  // Card complet — meciuri punctate
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
