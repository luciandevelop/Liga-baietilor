import { useState } from "react";
import MatchCompactCard from "./MatchCompactCard";
import NumericStepper from "./NumericStepper";
import CompetitionBadge from "./CompetitionBadge";
import { MATCH_STATUSES, MATCH_STATUS_LABEL, MATCH_STATUS_TONE, getMatchStatus } from "../utils/matchStatus";
import { getCompetitionTheme } from "../competitionThemes";
import { color, font, radius } from "../theme";

export default function MatchResultCard({ match, onSave, onChangeStatus, disabled }) {
  const [scoreA, setScoreA] = useState(match.realScoreA ?? 0);
  const [scoreB, setScoreB] = useState(match.realScoreB ?? 0);
  const [corners, setCorners] = useState(match.realCorners ?? 0);
  const [cards, setCards] = useState(match.realCards ?? 0);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | success | error
  const [error, setError] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState("");

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

  // Orice tranziție e permisă, fără flux impus — status și scor rămân
  // independente (schimbarea statusului NU atinge realScoreA/B/etc).
  async function handleStatusClick(newStatus) {
    if (newStatus === matchStatus || statusSaving || disabled) return;
    setStatusSaving(true);
    setStatusError("");
    try {
      await onChangeStatus(newStatus);
    } catch (err) {
      console.error(err);
      setStatusError(err.message || err.code);
    } finally {
      setStatusSaving(false);
    }
  }

  const hasResult = match.realScoreA !== null && match.realScoreA !== undefined;
  const matchStatus = getMatchStatus(match);
  // Aceeași identitate ca în Home — o singură sursă (competitionThemes.js).
  const theme = getCompetitionTheme(match.competitionId);

  return (
    <div style={{ ...s.card, border: `1px solid ${theme.borderColor}`, boxShadow: `0 8px 20px -10px ${theme.glowColor}` }}>
      <div style={{ height: 2, margin: "-12px -12px 10px", background: `linear-gradient(90deg, ${theme.primaryColor}, ${theme.secondaryColor})` }} />
      <div style={{ marginBottom: 8 }}>
        <CompetitionBadge match={match} size="sm" />
      </div>
      <MatchCompactCard
        homeTeam={match.homeTeam}
        awayTeam={match.awayTeam}
        right={hasResult ? <span style={s.savedTag}>Salvat</span> : null}
      />

      <div style={s.statusRow}>
        {MATCH_STATUSES.map((st) => {
          const tone = MATCH_STATUS_TONE[st];
          const active = st === matchStatus;
          return (
            <button
              key={st}
              type="button"
              disabled={disabled || statusSaving}
              onClick={() => handleStatusClick(st)}
              style={{
                ...s.statusBtn,
                background: active ? tone.bg : "transparent",
                color: active ? tone.fg : color.textMuted,
                border: `1px solid ${active ? tone.fg : color.border}`,
              }}
            >
              {MATCH_STATUS_LABEL[st]}
            </button>
          );
        })}
      </div>
      {statusError && <div style={s.err}>{statusError}</div>}

      <div style={s.inputsBox}>
        <div style={s.scoreRow}>
          <NumericStepper value={scoreA} onChange={(v) => setScoreA(v)} disabled={disabled || saving} />
          <span style={s.dash}>–</span>
          <NumericStepper value={scoreB} onChange={(v) => setScoreB(v)} disabled={disabled || saving} />
        </div>
        <div style={s.smallRow}>
          <NumericStepper label="CORNERE" value={corners} onChange={(v) => setCorners(v)} disabled={disabled || saving} />
          <NumericStepper label="CARTONAȘE" value={cards} onChange={(v) => setCards(v)} disabled={disabled || saving} />
        </div>
        <button type="button" style={s.saveBtn} disabled={disabled || saving} onClick={handleSave}>
          {saving ? "…" : status === "success" ? "✓ Salvat" : "Salvează"}
        </button>
        {status === "error" && <div style={s.err}>{error}</div>}
      </div>
    </div>
  );
}

const s = {
  card: {
    background: color.surface, borderRadius: radius.lg, padding: "12px 12px 14px", overflow: "hidden",
  },
  savedTag: {
    fontSize: 9.5, fontWeight: 800, color: color.green, background: color.greenBg,
    border: `1px solid ${color.greenBorder}`, borderRadius: 999, padding: "3px 8px", whiteSpace: "nowrap",
  },
  inputsBox: { marginTop: 12, paddingTop: 12, borderTop: `1px solid ${color.borderSubtle}` },
  statusRow: { display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10 },
  statusBtn: {
    fontSize: 9.5, fontWeight: 700, letterSpacing: "0.02em", borderRadius: 999, padding: "4px 9px",
    cursor: "pointer", fontFamily: font.body, whiteSpace: "nowrap",
  },
  scoreRow: { display: "flex", alignItems: "center", justifyContent: "center", gap: 16 },
  dash: { fontSize: 16, color: color.textFaint, fontWeight: 800, fontFamily: font.display },
  smallRow: { display: "flex", justifyContent: "center", gap: 20, marginTop: 14 },
  saveBtn: {
    width: "100%", marginTop: 14, background: color.goldGradient, color: color.goldOn,
    border: "none", borderRadius: radius.sm, padding: "10px 0", fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: font.body,
  },
  err: { marginTop: 8, fontSize: 11.5, color: color.red, textAlign: "center" },
};
