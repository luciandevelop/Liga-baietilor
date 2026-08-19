import NumericStepper from "./NumericStepper";
import ClubLogo from "./ClubLogo";
import CompetitionHeaderStrip from "./CompetitionHeaderStrip";
import FriendsPredictions from "./FriendsPredictions";
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
  isSaved,
  locked,
  isFeatured,
  featuredIndex,
  isJoker,
  onToggleJoker,
  jokerDisabled,
  jokerUsedElsewhereNote,
  currentUid,
}) {
  const p = prediction || {};
  const status = getMatchStatus(match);
  const tone = MATCH_STATUS_TONE[status];
  const theme = getCompetitionTheme(match.competitionId);
  const statusTag = <span style={{ ...s.statusBadge, background: tone.bg, color: tone.fg }}>{MATCH_STATUS_LABEL[status]}</span>;

  return (
    <div
      style={{
        ...s.card,
        border: `1px solid ${isFeatured ? "rgba(212,175,55,0.55)" : theme.borderColor}`,
        background: isFeatured
          ? "linear-gradient(165deg, rgba(212,175,55,0.2) 0%, rgba(212,175,55,0.04) 45%, #12141C 100%)"
          : color.surface,
        boxShadow: isFeatured
          ? "0 0 26px rgba(212,175,55,0.3), 0 18px 32px -14px rgba(0,0,0,0.55)"
          : `0 0 20px -4px ${theme.glowColor}, 0 18px 32px -16px rgba(0,0,0,0.6)`,
        ...(isJoker ? s.cardJoker : {}),
      }}
    >
      {isFeatured ? (
        <div style={s.motwStrip}>
          <span style={s.motwBadgeIcon}>⭐</span>
          <div style={s.motwTextCol}>
            <span style={s.motwTag}>Meci al săptămânii{featuredIndex ? ` · ${featuredIndex} din 3` : ""}</span>
            <span style={s.motwSub}>Punctaj dublat ×2</span>
          </div>
        </div>
      ) : (
        <CompetitionHeaderStrip match={match} rightSlot={statusTag} size="lg" />
      )}

      <div style={{ padding: "14px 14px 15px" }}>
        <div style={s.headRow}>
          {isFeatured ? statusTag : <span />}
          {isJoker && <span style={s.jokerBadge}>🃏 ×2</span>}
        </div>

        <div style={s.matchRow}>
          <div style={s.teamCol}>
            <ClubLogo teamName={match.homeTeam} size={46} />
            <span style={s.teamName}>{match.homeTeam}</span>
          </div>
          <span style={s.vs}>vs</span>
          <div style={s.teamCol}>
            <ClubLogo teamName={match.awayTeam} size={46} />
            <span style={s.teamName}>{match.awayTeam}</span>
          </div>
        </div>

        <div style={s.kickoff}>{formatKickoff(match)}</div>

        {locked ? (
          <div style={s.lockedBox}>
            {match.status === "finished" && match.realScoreA != null && match.realScoreB != null ? (
              <>
                <div style={s.lockedScore}>{match.realScoreA} – {match.realScoreB}</div>
                <span style={s.finalTag}>REZULTAT FINAL</span>
                {p.scoreA !== "" && p.scoreA !== undefined && (
                  <div style={s.ownPredictionNote}>
                    Pronosticul tău: {p.scoreA}–{p.scoreB}
                    {p.corners !== "" && p.corners !== undefined ? ` · C:${p.corners}` : ""}
                    {p.cards !== "" && p.cards !== undefined ? ` · Ct:${p.cards}` : ""}
                  </div>
                )}
              </>
            ) : (
              <>
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
              </>
            )}
            <FriendsPredictions matchId={match.id} currentUid={currentUid} homeTeam={match.homeTeam} awayTeam={match.awayTeam} />
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
                {isJoker ? "🃏 Renunță" : jokerUsedElsewhereNote ? "🃏 Folosit" : "🃏 Joker"}
              </button>

              <button
                type="button"
                style={{ ...s.saveBtn, ...(isSaved && saveStatus !== "success" ? s.saveBtnModify : {}) }}
                disabled={saving}
                onClick={onSave}
              >
                {saving ? "…" : saveStatus === "success" ? "✓ Salvat" : isSaved ? "Modifică" : "Salvează"}
              </button>
            </div>

            {jokerUsedElsewhereNote && <div style={s.jokerNote}>{jokerUsedElsewhereNote}</div>}

            {saveStatus === "error" && <div style={s.saveErr}>{saveError}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  card: { background: color.surface, borderRadius: radius.md, overflow: "hidden", boxShadow: shadow.sm },
  cardJoker: { border: "1px solid rgba(139,217,87,0.4)" },
  motwStrip: {
    padding: "13px 14px", display: "flex", alignItems: "center", gap: 10,
    background: "linear-gradient(90deg, rgba(212,175,55,0.4), rgba(212,175,55,0.14))",
    border: "1.5px solid #D4AF37", borderRadius: "14px 14px 0 0",
    boxShadow: "0 0 18px -4px rgba(212,175,55,0.6)",
  },
  motwBadgeIcon: { fontSize: 22, flexShrink: 0, filter: "drop-shadow(0 0 6px rgba(212,175,55,0.7))" },
  motwTextCol: { display: "flex", flexDirection: "column", gap: 1 },
  motwTag: { fontSize: 13, fontWeight: 800, letterSpacing: "0.02em", color: "#FFE9A8", fontFamily: font.display, textTransform: "uppercase" },
  motwSub: { fontSize: 10.5, fontWeight: 700, color: "rgba(255,233,168,0.75)", fontFamily: font.body },

  headRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 13, marginTop: 2, minHeight: 20 },
  statusBadge: { fontSize: 8.5, fontWeight: 700, letterSpacing: "0.03em", padding: "3px 8px", borderRadius: 999, fontFamily: font.body, flexShrink: 0 },
  jokerBadge: {
    fontSize: 9.5, fontWeight: 800, color: color.green, background: color.greenBg,
    border: `1px solid ${color.greenBorder}`, borderRadius: 999, padding: "2px 7px", whiteSpace: "nowrap",
  },

  matchRow: { display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 16, marginBottom: 4 },
  teamCol: { display: "flex", flexDirection: "column", alignItems: "center", gap: 7, width: 92 },
  teamName: {
    fontSize: 12, color: color.textPrimary, fontWeight: 700, fontFamily: font.body,
    textAlign: "center", whiteSpace: "normal", lineHeight: 1.2,
  },
  vs: { fontSize: 10.5, color: color.textFaint, paddingTop: 16, fontFamily: font.body },
  kickoff: { textAlign: "center", fontSize: 10.5, color: color.textFaint, fontFamily: font.body, marginBottom: 10 },

  inputsBox: { paddingTop: 11, borderTop: `1px solid ${color.borderSubtle}` },
  scoreRow: { display: "flex", alignItems: "center", justifyContent: "center", gap: 14 },
  dash: { fontSize: 15, color: color.textFaint, fontWeight: 800, fontFamily: font.display },
  smallRow: { display: "flex", justifyContent: "center", gap: 18, marginTop: 12 },
  actionsRow: { display: "flex", gap: 8, marginTop: 12 },
  jokerBtn: {
    flex: 1, background: color.surfaceInset, border: `1px solid ${color.border}`, color: color.textSecondary,
    borderRadius: radius.sm, padding: "9px 0", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: font.body,
  },
  jokerBtnActive: { background: color.greenBg, border: `1px solid ${color.greenBorder}`, color: color.green },
  jokerBtnDisabled: { opacity: 0.4, cursor: "not-allowed" },
  jokerNote: { fontSize: 9.5, color: color.textFaint, textAlign: "center", marginTop: 6, fontFamily: font.body },
  saveBtn: {
    flex: 1, background: color.goldGradient, color: color.goldOn, border: "none",
    borderRadius: radius.sm, padding: "9px 0", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: font.body,
  },
  saveBtnModify: {
    background: "none", border: `1.5px solid ${color.gold}`, color: color.goldLight,
  },
  saveErr: { marginTop: 6, fontSize: 11, color: "#F0555A", textAlign: "center", fontFamily: font.body },

  lockedBox: { paddingTop: 11, borderTop: `1px solid ${color.borderSubtle}`, textAlign: "center" },
  lockedScore: { fontSize: 23, fontWeight: 700, color: color.textPrimary, fontFamily: font.display },
  lockedMeta: { fontSize: 11, color: color.textSecondary, margin: "3px 0 8px", fontFamily: font.body },
  lockedTag: {
    display: "inline-block", fontSize: 9.5, fontWeight: 800, letterSpacing: "0.05em", color: "#F0555A",
    background: "rgba(240,85,90,0.12)", border: "1px solid rgba(240,85,90,0.35)", borderRadius: 999, padding: "3px 10px",
    fontFamily: font.body,
  },
  finalTag: {
    display: "inline-block", fontSize: 9.5, fontWeight: 800, letterSpacing: "0.05em", color: color.goldLight,
    background: "rgba(212,175,55,0.12)", border: "1px solid rgba(212,175,55,0.4)", borderRadius: 999, padding: "3px 10px",
    fontFamily: font.body,
  },
  ownPredictionNote: {
    fontSize: 10.5, color: color.textFaint, fontFamily: font.body, marginTop: 8,
  },
};
