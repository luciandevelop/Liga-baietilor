import MatchCard from "./MatchCard";

export default function MatchPredictionCard({ match, prediction, onChange, locked }) {
  const p = prediction || {};

  return (
    <div style={s.wrap}>
      <MatchCard
        homeTeam={match.homeTeam}
        awayTeam={match.awayTeam}
        kickoffAt={match.kickoffAt}
        status={match.status}
      />

      {locked ? (
        <div style={s.lockedBox}>
          <div style={s.lockedScoreRow}>
            <span style={s.lockedLabel}>Pronosticul tău</span>
            <span style={s.lockedScore}>
              {p.scoreA !== "" && p.scoreA !== undefined ? p.scoreA : "–"}
              {" – "}
              {p.scoreB !== "" && p.scoreB !== undefined ? p.scoreB : "–"}
            </span>
          </div>
          <div style={s.lockedMeta}>
            Cornere: {p.corners !== "" && p.corners !== undefined ? p.corners : "–"} · Cartonașe:{" "}
            {p.cards !== "" && p.cards !== undefined ? p.cards : "–"}
          </div>
          <div style={s.lockedTag}>PRONOSTIC BLOCAT</div>
        </div>
      ) : (
        <div style={s.inputsBox}>
          <div style={s.scoreSection}>
            <span style={s.fieldLabel}>PRONOSTIC SCOR</span>
            <div style={s.scoreInputsRow}>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                placeholder="–"
                style={s.scoreInput}
                value={p.scoreA ?? ""}
                onChange={(e) => onChange({ scoreA: e.target.value })}
              />
              <span style={s.dash}>–</span>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                placeholder="–"
                style={s.scoreInput}
                value={p.scoreB ?? ""}
                onChange={(e) => onChange({ scoreB: e.target.value })}
              />
            </div>
          </div>

          <div style={s.smallRow}>
            <div style={s.smallField}>
              <span style={s.smallLabel}>CORNERE TOTALE</span>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                placeholder="–"
                style={s.smallInput}
                value={p.corners ?? ""}
                onChange={(e) => onChange({ corners: e.target.value })}
              />
            </div>
            <div style={s.smallField}>
              <span style={s.smallLabel}>CARTONAȘE TOTALE</span>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                placeholder="–"
                style={s.smallInput}
                value={p.cards ?? ""}
                onChange={(e) => onChange({ cards: e.target.value })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  wrap: { display: "flex", flexDirection: "column", gap: 0 },
  inputsBox: {
    background: "#0D1220",
    border: "1px solid #1c2338",
    borderTop: "none",
    borderRadius: "0 0 14px 14px",
    padding: "12px",
    marginTop: -1,
  },
  scoreSection: { display: "flex", flexDirection: "column", alignItems: "center", gap: 8 },
  fieldLabel: { fontSize: 10.5, fontWeight: 800, letterSpacing: "0.05em", color: "#C9A227" },
  scoreInputsRow: { display: "flex", alignItems: "center", gap: 10 },
  scoreInput: {
    width: 56,
    height: 48,
    background: "#161D33",
    border: "1px solid #2A3350",
    borderRadius: 12,
    color: "#F5F5F0",
    fontSize: 22,
    fontWeight: 800,
    textAlign: "center",
    outline: "none",
  },
  dash: { fontSize: 18, color: "#4A5268", fontWeight: 800 },
  smallRow: { display: "flex", gap: 10, marginTop: 14 },
  smallField: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 },
  smallLabel: { fontSize: 9.5, fontWeight: 700, letterSpacing: "0.04em", color: "#6B7390" },
  smallInput: {
    width: "100%",
    maxWidth: 90,
    height: 38,
    background: "#161D33",
    border: "1px solid #2A3350",
    borderRadius: 10,
    color: "#F5F5F0",
    fontSize: 15,
    fontWeight: 700,
    textAlign: "center",
    outline: "none",
  },
  lockedBox: {
    background: "#0D1220",
    border: "1px solid #1c2338",
    borderTop: "none",
    borderRadius: "0 0 14px 14px",
    padding: "12px",
    marginTop: -1,
    textAlign: "center",
  },
  lockedScoreRow: { display: "flex", flexDirection: "column", gap: 4, marginBottom: 6 },
  lockedLabel: { fontSize: 10.5, color: "#6B7390", fontWeight: 700 },
  lockedScore: { fontSize: 20, fontWeight: 800, color: "#E8E4D8" },
  lockedMeta: { fontSize: 11.5, color: "#8B93A8", marginBottom: 8 },
  lockedTag: {
    display: "inline-block",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.05em",
    color: "#E08A82",
    background: "rgba(181,69,61,0.12)",
    border: "1px solid rgba(181,69,61,0.35)",
    borderRadius: 999,
    padding: "3px 10px",
  },
};
