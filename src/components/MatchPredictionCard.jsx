import NumericStepper from "./NumericStepper";
import ClubLogo from "./ClubLogo";
import CompetitionLogo from "./CompetitionLogo";
import { getMatchStatus, MATCH_STATUS_LABEL } from "../utils/matchStatus";
import { color, font, radius, shadow } from "../matchdayTheme";

const STATUS_TONE = {
  scheduled: { bg: "rgba(255,255,255,0.06)", fg: color.textSecondary },
  live: { bg: "rgba(139,217,87,0.16)", fg: color.green },
  finished: { bg: "rgba(255,255,255,0.07)", fg: color.textSecondary },
};

function formatKickoff(match) {
  const d = match.kickoffAt?.toDate ? match.kickoffAt.toDate() : null;
  if (!d) return "";
  return d.toLocaleDateString("ro-RO", { day: "numeric", month: "long" }) + " la " +
    d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
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
  const status = getMatchStatus(match);
  const tone = STATUS_TONE[status];

  return (
    <div style={{ ...s.card, ...(isJoker ? s.cardJoker : {}), ...(isFeatured ? s.cardFeatured : {}) }}>
      <div style={s.headRow}>
        <div style={s.headLeft}>
          {match.competition && <CompetitionLogo name={match.competition} size={18} />}
          <span style={{ ...s.statusBadge, background: tone.bg, color: tone.fg }}>{MATCH_STATUS_LABEL[status]}</span>
        </div>
        <div style={s.badgeCol}>
          {isFeatured && <span style={s.featuredBadge}>⭐ ×2</span>}
          {isJoker && <span style={s.jokerBadge}>🃏 ×2</span>}
        </div>
      </div>

      <div style={s.matchRow}>
        <div style={s.teamCol}>
          <ClubLogo teamName={match.homeTeam} size={38} />
          <span style={s.teamName}>{match.homeTeam}</span>
        </div>
        <span style={s.vs}>vs</span>
        <div style={s.teamCol}>
          <ClubLogo teamName={match.awayTeam} size={38} />
          <span style={s.teamName}>{match.awayTeam}</span>
        </div>
      </div>

      <div style={s.kickoff}>{formatKickoff(match)}</div>

      {locked ? (
        <div style={s.lockedBox}>
          <div style={s.lockedScore}>
            {p.scoreA !== "" && p.scoreA !== undefined ? p.scoreA : "–"}
            {" – "}
            {p.scoreB !== "" && p.scoreB !== undefined ? p.scoreB : "–"}
          </div>
          <div style={s.lockedMeta}>
            C:{p.corners !== "" && p.corners !== undefined ? p.corners : "–"} · Ct:{" "}
            {p.cards !== "" && p.cards !== undefined ? p.cards : "–"}
          </div>
          <span style={s.lockedTag}>PRONOSTIC BLOCAT</span>
        </div>
      ) : (
        <div style={s.inputsBox}>
          <div style={s.scoreRow}>
            <NumericStepper value={p.scoreA} onChange={(v) => onChange({ scoreA: v })} disabled={saving} />
            <span style={s.dash}>–</span>
            <NumericStepper value={p.scoreB} onChange={(v) => onChange({ scoreB: v })} disabled={saving} />
          </div>

          <div style={s.smallRow}>
            <NumericStepper label="CORNERE" value={p.corners} onChange={(v) => onChange({ corners: v })} disabled={saving} />
            <NumericStepper label="CARTONAȘE" value={p.cards} onChange={(v) => onChange({ cards: v })} disabled={saving} />
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
              {isJoker ? "🃏 Renunță" : "🃏 Joker"}
            </button>

            <button type="button" style={s.saveBtn} disabled={saving} onClick={onSave}>
              {saving ? "…" : saveStatus === "success" ? "✓ Salvat" : "Salvează"}
            </button>
          </div>

          {saveStatus === "error" && <div style={s.saveErr}>{saveError}</div>}
        </div>
      )}
    </div>
  );
}

const s = {
  card: {
    background: color.surface,
    border: `1px solid ${color.border}`,
    borderRadius: radius.lg,
    padding: "14px 14px 16px",
    boxShadow: shadow.sm,
  },
  cardFeatured: { border: "1px solid rgba(212,175,55,0.4)" },
  cardJoker: { border: "1px solid rgba(139,217,87,0.4)" },

  headRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  headLeft: { display: "flex", alignItems: "center", gap: 8 },
  statusBadge: { fontSize: 9.5, fontWeight: 700, letterSpacing: "0.03em", padding: "3px 8px", borderRadius: 999, fontFamily: font.body },
  badgeCol: { display: "flex", gap: 4, alignItems: "center" },
  featuredBadge: {
    fontSize: 9.5, fontWeight: 800, color: color.goldLight, background: color.goldBg,
    border: `1px solid ${color.goldBorder}`, borderRadius: 999, padding: "2px 7px", whiteSpace: "nowrap",
  },
  jokerBadge: {
    fontSize: 9.5, fontWeight: 800, color: color.green, background: color.greenBg,
    border: `1px solid ${color.greenBorder}`, borderRadius: 999, padding: "2px 7px", whiteSpace: "nowrap",
  },

  matchRow: { display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 14, marginBottom: 4 },
  teamCol: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: 86 },
  teamName: {
    fontSize: 11.5, color: color.textPrimary, fontWeight: 700, fontFamily: font.body,
    textAlign: "center", whiteSpace: "normal", lineHeight: 1.2,
  },
  vs: { fontSize: 10.5, color: color.textFaint, paddingTop: 14, fontFamily: font.body },
  kickoff: { textAlign: "center", fontSize: 10.5, color: color.textFaint, fontFamily: font.body, marginBottom: 10 },

  inputsBox: { paddingTop: 12, borderTop: `1px solid ${color.borderSubtle}` },
  scoreRow: { display: "flex", alignItems: "center", justifyContent: "center", gap: 16 },
  dash: { fontSize: 16, color: color.textFaint, fontWeight: 800, fontFamily: font.display },
  smallRow: { display: "flex", justifyContent: "center", gap: 20, marginTop: 14 },
  actionsRow: { display: "flex", gap: 8, marginTop: 14 },
  jokerBtn: {
    flex: 1, background: color.surfaceInset, border: `1px solid ${color.border}`, color: color.textSecondary,
    borderRadius: radius.sm, padding: "10px 0", fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: font.body,
  },
  jokerBtnActive: { background: color.greenBg, border: `1px solid ${color.greenBorder}`, color: color.green },
  jokerBtnDisabled: { opacity: 0.4, cursor: "not-allowed" },
  saveBtn: {
    flex: 1, background: color.goldGradient, color: color.goldOn, border: "none",
    borderRadius: radius.sm, padding: "10px 0", fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: font.body,
  },
  saveErr: { marginTop: 8, fontSize: 11.5, color: "#F0555A", textAlign: "center", fontFamily: font.body },

  lockedBox: { paddingTop: 12, borderTop: `1px solid ${color.borderSubtle}`, textAlign: "center" },
  lockedScore: { fontSize: 24, fontWeight: 700, color: color.textPrimary, fontFamily: font.display },
  lockedMeta: { fontSize: 11.5, color: color.textSecondary, margin: "4px 0 8px", fontFamily: font.body },
  lockedTag: {
    display: "inline-block", fontSize: 9.5, fontWeight: 800, letterSpacing: "0.05em", color: "#F0555A",
    background: "rgba(240,85,90,0.12)", border: "1px solid rgba(240,85,90,0.35)", borderRadius: 999, padding: "3px 10px",
    fontFamily: font.body,
  },
};
