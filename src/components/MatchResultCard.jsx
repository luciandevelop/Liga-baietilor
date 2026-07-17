import { useState } from "react";
import MatchCard from "./MatchCard";
import NumericStepper from "./NumericStepper";

export default function MatchResultCard({ match, onSave, disabled }) {
  const [scoreA, setScoreA] = useState(match.realScoreA ?? 0);
  const [scoreB, setScoreB] = useState(match.realScoreB ?? 0);
  const [corners, setCorners] = useState(match.realCorners ?? 0);
  const [cards, setCards] = useState(match.realCards ?? 0);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | success | error
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    setStatus("idle");
    setError("");
    try {
      await onSave({
        realScoreA: scoreA === "" ? undefined : Number(scoreA),
        realScoreB: scoreB === "" ? undefined : Number(scoreB),
        realCorners: corners === "" ? undefined : Number(corners),
        realCards: cards === "" ? undefined : Number(cards),
      });
      setStatus("success");
    } catch (err) {
      console.error(err);
      setStatus("error");
      setError(err.message || err.code);
    } finally {
      setSaving(false);
    }
  }

  const hasResult = match.realScoreA !== null && match.realScoreA !== undefined;

  return (
    <div style={s.wrap}>
      <MatchCard homeTeam={match.homeTeam} awayTeam={match.awayTeam} kickoffAt={match.kickoffAt} status={match.status} />
      <div style={s.box}>
        {hasResult && <div style={s.hasResultTag}>Rezultat salvat — poate fi corectat</div>}
        <div style={s.row}>
          <div style={s.field}>
            <span style={s.label}>SCOR</span>
            <div style={s.scoreInputs}>
              <NumericStepper value={scoreA} onChange={(v) => setScoreA(v)} disabled={disabled || saving} />
              <span style={s.dash}>–</span>
              <NumericStepper value={scoreB} onChange={(v) => setScoreB(v)} disabled={disabled || saving} />
            </div>
          </div>
        </div>
        <div style={s.row}>
          <NumericStepper label="CORNERE TOTALE" value={corners} onChange={(v) => setCorners(v)} disabled={disabled || saving} />
          <NumericStepper label="CARTONAȘE TOTALE" value={cards} onChange={(v) => setCards(v)} disabled={disabled || saving} />
        </div>
        <button type="button" style={s.saveBtn} disabled={disabled || saving} onClick={handleSave}>
          {saving ? "Se salvează…" : "Salvează rezultat"}
        </button>
        {status === "success" && <div style={s.ok}>✓ Salvat</div>}
        {status === "error" && <div style={s.err}>{error}</div>}
      </div>
    </div>
  );
}

const s = {
  wrap: { display: "flex", flexDirection: "column" },
  box: {
    background: "#0D1220", border: "1px solid #1c2338", borderTop: "none",
    borderRadius: "0 0 14px 14px", padding: 12, marginTop: -1,
  },
  hasResultTag: {
    fontSize: 10.5, color: "#A9E0B8", background: "rgba(63,168,92,0.1)",
    border: "1px solid rgba(63,168,92,0.3)", borderRadius: 8, padding: "4px 8px",
    marginBottom: 10, textAlign: "center",
  },
  row: { display: "flex", justifyContent: "center", gap: 10, marginBottom: 10 },
  field: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6 },
  label: { fontSize: 10.5, fontWeight: 800, letterSpacing: "0.05em", color: "#C9A227" },
  scoreInputs: { display: "flex", alignItems: "center", gap: 10 },
  scoreInput: {
    width: 52, height: 42, background: "#161D33", border: "1px solid #2A3350",
    borderRadius: 10, color: "#F5F5F0", fontSize: 18, fontWeight: 800, textAlign: "center", outline: "none",
  },
  dash: { fontSize: 15, color: "#4A5268", fontWeight: 800 },
  smallField: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, maxWidth: 130 },
  smallLabel: { fontSize: 9.5, fontWeight: 700, letterSpacing: "0.04em", color: "#6B7390" },
  smallInput: {
    width: "100%", height: 36, background: "#161D33", border: "1px solid #2A3350",
    borderRadius: 10, color: "#F5F5F0", fontSize: 14, fontWeight: 700, textAlign: "center", outline: "none",
  },
  saveBtn: {
    width: "100%", background: "linear-gradient(180deg, #E0BC4A, #C9A227)", color: "#0A0E1A",
    border: "none", borderRadius: 10, padding: "10px 0", fontSize: 12.5, fontWeight: 800, cursor: "pointer",
  },
  ok: { marginTop: 8, fontSize: 11.5, color: "#A9E0B8", textAlign: "center" },
  err: { marginTop: 8, fontSize: 11.5, color: "#E08A82", textAlign: "center" },
};
