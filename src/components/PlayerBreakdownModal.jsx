import { useEffect, useState } from "react";
import { tryLoadPrediction } from "../services/predictionsService";

// Afișează, pentru un singur user, punctajul/pronosticul meci-cu-meci al
// etapei — sursă unică pentru puncte: scoringEngine (prin adminService).
//
// PRIVACY:
// - `row.breakdown` vine fie din computeGameweekResults (Admin — acces
//   complet, folosit doar de admin), fie din gameweekLiveScores (useri
//   normali — sanitizat de admin la scriere: fără pronostic/Joker pentru
//   alții, pre-lock).
// - Pentru un meci încă marcat `predictionHidden` la citire (posibil ca
//   documentul public să fie "vechi" — adminul nu a republicat de la lock
//   încoace), componenta ÎNCEARCĂ o citire directă a pronosticului prin
//   `tryLoadPrediction` — securitatea reală vine din firestore.rules
//   (permite/refuză citirea în funcție de timpul serverului), NU din
//   ceasul telefonului cuiva. Un refuz e tratat silențios ca "încă ascuns".
// - Pentru PROPRIUL rând (isOwn=true), `ownPredictions`/`ownJokerMatchId`
//   (citiri separate, mereu permise pentru owner) suprascriu afișarea —
//   userul își vede mereu propriul pronostic și propriul Joker, indiferent
//   ce conține documentul public.
export default function PlayerBreakdownModal({ nickname, row, isOwn, ownPredictions, ownJokerMatchId, onClose }) {
  if (!row) return null;
  const entries = Object.values(row.breakdown || {}).sort((a, b) => {
    const at = a.kickoffAt?.toMillis ? a.kickoffAt.toMillis() : 0;
    const bt = b.kickoffAt?.toMillis ? b.kickoffAt.toMillis() : 0;
    return at - bt;
  });

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.sheet} onClick={(e) => e.stopPropagation()}>
        <div style={s.header}>
          <h3 style={s.title}>{nickname}</h3>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={s.summaryRow}>
          <span>Puncte din meciuri: <b>{row.pointsFromMatches}p</b></span>
          <span style={{ color: row.rankingBonus >= 0 ? "#A9E0B8" : "#E08A82" }}>
            Bonus/Malus poziție: {row.rankingBonus >= 0 ? "+" : ""}{row.rankingBonus}p
          </span>
          <span style={s.totalLine}>TOTAL ETAPĂ: {row.totalPoints}p</span>
        </div>

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
  const needsAttempt = m.predictionHidden && !isOwn && !revealed;

  useEffect(() => {
    let cancelled = false;
    if (needsAttempt && (m.status === "pending" || m.status === "scored")) {
      tryLoadPrediction(m.matchId, viewedUid).then((data) => {
        if (!cancelled && data) setRevealed(data);
      });
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.matchId, viewedUid, m.predictionHidden]);

  const prediction = m.prediction || (isOwn ? ownPrediction : null) || revealed || null;
  const hidden = (m.status === "pending" || m.status === "scored") && !prediction;
  const isJoker = m.isJoker || isOwnJoker;

  return (
    <div style={s.row}>
      <div style={s.rowHeader}>
        <span style={s.teams}>{m.homeTeam} – {m.awayTeam}</span>
        {m.isFeatured && <span style={s.tagFeatured}>⭐ Meciul Săptămânii</span>}
        {isJoker && <span style={s.tagJoker}>🃏 Joker</span>}
      </div>

      {(m.status === "pending" || m.status === "scored") && (
        <div style={s.predRealRow}>
          <div style={s.col}>
            <span style={s.colLabel}>Pronostic</span>
            <span style={s.colVal}>
              {hidden
                ? "Ascuns până la lock"
                : `${prediction.scoreA}–${prediction.scoreB} · C:${prediction.corners ?? "–"} · Ct:${prediction.cards ?? "–"}`}
            </span>
          </div>
          <div style={s.col}>
            <span style={s.colLabel}>Rezultat</span>
            <span style={s.colVal}>
              {m.status === "pending" ? "În așteptare" : `${m.real.scoreA}–${m.real.scoreB} · C:${m.real.corners} · Ct:${m.real.cards}`}
            </span>
          </div>
        </div>
      )}

      {m.status === "no-prediction" && (
        <div style={s.noPrediction}>
          {m.real ? `Rezultat: ${m.real.scoreA}–${m.real.scoreB}` : ""} · fără pronostic → 0p
        </div>
      )}

      {m.status === "scored" && (
        <>
          <div style={s.pointsRow}>
            <span>Scor: +{m.scorePoints}</span>
            <span>Cornere: +{m.cornersPoints}</span>
            <span>Cartonașe: +{m.cardsPoints}</span>
          </div>
          <div style={s.subtotalRow}>
            <span>Subtotal: {m.baseTotal}</span>
            {m.multiplier > 1 && (
              <span style={s.multBadge}>
                {m.multiplierReason === "featured" ? "Meciul Săptămânii ×2" : "Joker ×2"}
              </span>
            )}
            <span style={s.matchTotal}>TOTAL MECI: {m.finalMatchPoints}</span>
          </div>
        </>
      )}
    </div>
  );
}

const s = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(5,7,14,0.72)",
    display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100,
  },
  sheet: {
    width: "100%", maxWidth: 480, maxHeight: "86vh", overflowY: "auto",
    background: "#0D1220", borderTop: "1px solid #232B42", borderRadius: "18px 18px 0 0",
    padding: "16px 14px 24px", fontFamily: "'Helvetica Neue', Arial, sans-serif",
  },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  title: { fontSize: 16, fontWeight: 800, color: "#F5F5F0", margin: 0 },
  closeBtn: {
    background: "#161D33", border: "1px solid #2A3350", color: "#8B93A8",
    borderRadius: 8, width: 30, height: 30, fontSize: 13, cursor: "pointer",
  },
  summaryRow: {
    display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5, color: "#8B93A8",
    background: "#12182B", border: "1px solid #232B42", borderRadius: 10, padding: "10px 12px", marginBottom: 12,
  },
  totalLine: { color: "#E0BC4A", fontWeight: 800, fontSize: 13.5, marginTop: 2 },
  list: { display: "flex", flexDirection: "column", gap: 8 },
  row: {
    background: "#12182B", border: "1px solid #1c2338", borderRadius: 12, padding: "10px 12px",
  },
  rowHeader: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, marginBottom: 6 },
  teams: { fontSize: 12.5, fontWeight: 700, color: "#F5F5F0" },
  tagFeatured: {
    fontSize: 9.5, fontWeight: 800, color: "#E0BC4A", background: "rgba(201,162,39,0.14)",
    border: "1px solid rgba(201,162,39,0.4)", borderRadius: 999, padding: "2px 7px",
  },
  tagJoker: {
    fontSize: 9.5, fontWeight: 800, color: "#A9E0B8", background: "rgba(63,168,92,0.12)",
    border: "1px solid rgba(63,168,92,0.35)", borderRadius: 999, padding: "2px 7px",
  },
  noPrediction: { fontSize: 11.5, color: "#6B7390" },
  predRealRow: { display: "flex", gap: 14, marginBottom: 6 },
  col: { display: "flex", flexDirection: "column", gap: 2 },
  colLabel: { fontSize: 9.5, fontWeight: 700, color: "#6B7390", letterSpacing: "0.03em" },
  colVal: { fontSize: 11.5, color: "#E8E4D8", fontWeight: 600 },
  pointsRow: { display: "flex", gap: 10, fontSize: 11, color: "#8B93A8", marginBottom: 4 },
  subtotalRow: { display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "#8B93A8", flexWrap: "wrap" },
  multBadge: {
    fontSize: 10, fontWeight: 800, color: "#0A0E1A", background: "linear-gradient(180deg, #E0BC4A, #C9A227)",
    borderRadius: 999, padding: "2px 8px",
  },
  matchTotal: { marginLeft: "auto", fontSize: 12.5, fontWeight: 800, color: "#E0BC4A" },
};
