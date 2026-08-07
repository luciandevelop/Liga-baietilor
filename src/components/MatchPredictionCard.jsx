import NumericStepper from "./NumericStepper";
import ClubLogo from "./ClubLogo";
import CompetitionBadge from "./CompetitionBadge";
import { getMatchStatus, MATCH_STATUS_LABEL, MATCH_STATUS_TONE } from "../utils/matchStatus";
import { getCompetitionTheme } from "../competitionThemes";
import { color, font, radius, shadow } from "../matchdayTheme";

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
  const tone = MATCH_STATUS_TONE[status];
  // Identitate competiție — aceeași sursă unică (competitionThemes.js),
  // aplicată ca fundal/glow implicit. Featured/Joker rămân stări
  // speciale, cu prioritate vizuală peste identitatea de competiție.
  const theme = getCompetitionTheme(match.competitionId);

  return (
    <div
      style={{
        ...s.card,
        border: `1px solid ${isFeatured ? "rgba(212,175,55,0.55)" : theme.borderColor}`,
        background: isFeatured
          ? "linear-gradient(155deg, rgba(212,175,55,0.14), rgba(212,175,55,0.02))"
          : `${theme.backgroundGradient}, ${color.surface}`,
        boxShadow: isFeatured
          ? "0 0 22px rgba(212,175,55,0.3), 0 8px 20px -10px rgba(0,0,0,0.4)"
          : `0 8px 20px -10px ${theme.glowColor}, ${shadow.sm}`,
        padding: isFeatured ? "14px 14px 15px" : "12px 12px 13px",
        ...(isJoker ? s.cardJoker : {}),
      }}
    >
      <div style={{
        height: isFeatured ? 3 : 2, margin: isFeatured ? "-14px -14px 11px" : "-12px -12px 10px",
        background: isFeatured
          ? "linear-gradient(90deg, #FFF6D9, #D4AF37)"
          : `linear-gradient(90deg, ${theme.primaryColor}, ${theme.secondaryColor})`,
      }} />
      {isFeatured && <div style={s.motwBanner}>⭐ Meciul Săptămânii · Punctaj Dublu</div>}
      <div style={s.headRow}>
        <div style={s.headLeft}>
          <CompetitionBadge match={match} size="sm" />
          <span style={{ ...s.statusBadge, background: tone.bg, color: tone.fg }}>{MATCH_STATUS_LABEL[status]}</span>
        </div>
        <div style={s.badgeCol}>
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
    borderRadius: radius.md,
    padding: "12px 12px 13px",
    boxShadow: shadow.sm,
    overflow: "hidden",
  },
  cardJoker: { border: "1px solid rgba(139,217,87,0.4)" },
  motwBanner: {
    fontSize: 10, fontWeight: 800, color: "#241B05", textAlign: "center",
    background: "linear-gradient(180deg,#FFF6D9,#D4AF37)", borderRadius: 999,
    padding: "3px 10px", marginBottom: 9, display: "inline-block", fontFamily: font.body,
  },

  headRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 },
  headLeft: { display: "flex", alignItems: "center", gap: 8, minWidth: 0 },
  statusBadge: { fontSize: 9.5, fontWeight: 700, letterSpacing: "0.03em", padding: "3px 8px", borderRadius: 999, fontFamily: font.body, flexShrink: 0 },
  badgeCol: { display: "flex", gap: 4, alignItems: "center", flexShrink: 0 },
  jokerBadge: {
    fontSize: 9.5, fontWeight: 800, color: color.green, background: color.greenBg,
    border: `1px solid ${color.greenBorder}`, borderRadius: 999, padding: "2px 7px", whiteSpace: "nowrap",
  },

  matchRow: { display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 12, marginBottom: 2 },
  teamCol: { display: "flex", flexDirection: "column", alignItems: "center", gap: 5, width: 84 },
  teamName: {
    fontSize: 11.5, color: color.textPrimary, fontWeight: 700, fontFamily: font.body,
    textAlign: "center", whiteSpace: "normal", lineHeight: 1.15,
  },
  vs: { fontSize: 10, color: color.textFaint, paddingTop: 12, fontFamily: font.body },
  kickoff: { textAlign: "center", fontSize: 10, color: color.textFaint, fontFamily: font.body, marginBottom: 8 },

  inputsBox: { paddingTop: 9, borderTop: `1px solid ${color.borderSubtle}` },
  scoreRow: { display: "flex", alignItems: "center", justifyContent: "center", gap: 14 },
  dash: { fontSize: 15, color: color.textFaint, fontWeight: 800, fontFamily: font.display },
  smallRow: { display: "flex", justifyContent: "center", gap: 18, marginTop: 10 },
  actionsRow: { display: "flex", gap: 8, marginTop: 10 },
  jokerBtn: {
    flex: 1, background: color.surfaceInset, border: `1px solid ${color.border}`, color: color.textSecondary,
    borderRadius: radius.sm, padding: "8px 0", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: font.body,
  },
  jokerBtnActive: { background: color.greenBg, border: `1px solid ${color.greenBorder}`, color: color.green },
  jokerBtnDisabled: { opacity: 0.4, cursor: "not-allowed" },
  saveBtn: {
    flex: 1, background: color.goldGradient, color: color.goldOn, border: "none",
    borderRadius: radius.sm, padding: "8px 0", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: font.body,
  },
  saveErr: { marginTop: 6, fontSize: 11, color: "#F0555A", textAlign: "center", fontFamily: font.body },

  lockedBox: { paddingTop: 9, borderTop: `1px solid ${color.borderSubtle}`, textAlign: "center" },
  lockedScore: { fontSize: 21, fontWeight: 700, color: color.textPrimary, fontFamily: font.display },
  lockedMeta: { fontSize: 11, color: color.textSecondary, margin: "3px 0 7px", fontFamily: font.body },
  lockedTag: {
    display: "inline-block", fontSize: 9.5, fontWeight: 800, letterSpacing: "0.05em", color: "#F0555A",
    background: "rgba(240,85,90,0.12)", border: "1px solid rgba(240,85,90,0.35)", borderRadius: 999, padding: "3px 10px",
    fontFamily: font.body,
  },
};
