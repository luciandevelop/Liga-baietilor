import MatchCard from "./MatchCard";

function Stepper({ value, onChange, disabled }) {
  const num = value === "" || value === undefined || value === null ? 0 : Number(value);
  return (
    <div style={s.stepperWrap}>
      <button
        type="button"
        style={s.stepperBtn}
        disabled={disabled || num <= 0}
        onClick={() => onChange(String(Math.max(0, num - 1)))}
      >
        −
      </button>
      <span style={s.stepperValue}>{num}</span>
      <button type="button" style={s.stepperBtn} disabled={disabled} onClick={() => onChange(String(num + 1))}>
        +
      </button>
    </div>
  );
}

export default function MatchPredictionCard({
  match,
  prediction,
  onChange,
  onSave,
  saving,
  saveStatus, // "idle" | "success" | "error"
  saveError,
  locked,
  isFeatured,
  isJoker,
  onToggleJoker,
  jokerDisabled,
}) {
  const p = prediction || {};

  return (
    <div style={s.wrap}>
      <div style={s.cardShell}>
        <MatchCard
          homeTeam={match.homeTeam}
          awayTeam={match.awayTeam}
          kickoffAt={match.kickoffAt}
          status={match.status}
        />

        {isFeatured && (
          <div style={s.featuredBanner}>⭐ MECIUL SĂPTĂMÂNII — punctaj x2</div>
        )}

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
              <div style={s.scoreRow}>
                <Stepper value={p.scoreA} onChange={(v) => onChange({ scoreA: v })} disabled={saving} />
                <span style={s.dash}>–</span>
                <Stepper value={p.scoreB} onChange={(v) => onChange({ scoreB: v })} disabled={saving} />
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
                  disabled={saving}
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
                  disabled={saving}
                  style={s.smallInput}
                  value={p.cards ?? ""}
                  onChange={(e) => onChange({ cards: e.target.value })}
                />
              </div>
            </div>

            <div style={s.actionsRow}>
              <button
                type="button"
                style={{
                  ...s.jokerBtn,
                  ...(isJoker ? s.jokerBtnActive : {}),
                  ...(jokerDisabled ? s.jokerBtnDisabled : {}),
                }}
                disabled={jokerDisabled || saving}
                onClick={onToggleJoker}
              >
                {isJoker ? "🃏 Joker ales" : "🃏 Alege Joker"}
              </button>

              <button type="button" style={s.saveBtn} disabled={saving} onClick={onSave}>
                {saving ? "Se salvează…" : "Salvează"}
              </button>
            </div>

            {saveStatus === "success" && <div style={s.saveOk}>✓ Salvat</div>}
            {saveStatus === "error" && <div style={s.saveErr}>{saveError}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  wrap: { display: "flex", flexDirection: "column", gap: 0 },
  cardShell: { display: "flex", flexDirection: "column" },
  featuredBanner: {
    background: "rgba(201,162,39,0.14)",
    border: "1px solid rgba(201,162,39,0.4)",
    borderTop: "none",
    color: "#E0BC4A",
    fontSize: 10.5,
    fontWeight: 800,
    letterSpacing: "0.03em",
    textAlign: "center",
    padding: "5px 0",
    marginTop: -1,
  },
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
  scoreRow: { display: "flex", alignItems: "center", gap: 14 },
  stepperWrap: { display: "flex", alignItems: "center", gap: 8 },
  stepperBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    border: "1px solid #2A3350",
    background: "#161D33",
    color: "#F5F5F0",
    fontSize: 18,
    fontWeight: 800,
    cursor: "pointer",
    lineHeight: 1,
  },
  stepperValue: {
    width: 30,
    textAlign: "center",
    fontSize: 22,
    fontWeight: 800,
    color: "#F5F5F0",
  },
  dash: { fontSize: 16, color: "#4A5268", fontWeight: 800 },
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
  actionsRow: { display: "flex", gap: 8, marginTop: 14 },
  jokerBtn: {
    flex: 1,
    background: "#161D33",
    border: "1px solid #2A3350",
    color: "#8B93A8",
    borderRadius: 10,
    padding: "10px 0",
    fontSize: 11.5,
    fontWeight: 700,
    cursor: "pointer",
  },
  jokerBtnActive: {
    background: "rgba(201,162,39,0.15)",
    border: "1px solid #C9A227",
    color: "#E0BC4A",
  },
  jokerBtnDisabled: { opacity: 0.4, cursor: "not-allowed" },
  saveBtn: {
    flex: 1,
    background: "linear-gradient(180deg, #E0BC4A, #C9A227)",
    color: "#0A0E1A",
    border: "none",
    borderRadius: 10,
    padding: "10px 0",
    fontSize: 12.5,
    fontWeight: 800,
    cursor: "pointer",
  },
  saveOk: { marginTop: 8, fontSize: 11.5, color: "#A9E0B8", textAlign: "center" },
  saveErr: { marginTop: 8, fontSize: 11.5, color: "#E08A82", textAlign: "center" },
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
