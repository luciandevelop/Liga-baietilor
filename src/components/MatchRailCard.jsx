import ClubLogo from "./ClubLogo";
import CompetitionBadge from "./CompetitionBadge";
import { getMatchStatus, MATCH_STATUS_LABEL, MATCH_STATUS_TONE } from "../utils/matchStatus";
import { color, font, radius, shadow } from "../matchdayTheme";

export default function MatchRailCard({ match, onClick }) {
  const status = getMatchStatus(match);
  const tone = MATCH_STATUS_TONE[status];
  const timeLabel = match.kickoffAt?.toDate
    ? match.kickoffAt.toDate().toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })
    : "";
  const showScore = status === "finished" || status === "live" || status === "paused";

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flexShrink: 0, width: 150, textAlign: "left", borderRadius: radius.md, padding: "14px 12px",
        background: "linear-gradient(155deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015))",
        border: `1px solid ${color.border}`, boxShadow: `${shadow.sm}, ${shadow.rim}`,
        cursor: "pointer",
      }}
    >
      <div style={s.topRow}>
        <CompetitionBadge match={match} size="sm" />
        <span style={{ ...s.tag, background: tone.bg, color: tone.fg }}>
          {status === "scheduled" ? timeLabel : MATCH_STATUS_LABEL[status]}
        </span>
      </div>

      <div style={s.teamsRow}>
        <div style={s.teamCol}>
          <ClubLogo teamName={match.homeTeam} size={32} />
          <span style={s.teamName}>{match.homeTeam}</span>
        </div>
        {showScore ? (
          <span style={s.scoreMini}>{match.realScoreA ?? "–"}–{match.realScoreB ?? "–"}</span>
        ) : (
          <span style={s.vs}>–</span>
        )}
        <div style={s.teamCol}>
          <ClubLogo teamName={match.awayTeam} size={32} />
          <span style={s.teamName}>{match.awayTeam}</span>
        </div>
      </div>
    </button>
  );
}

const s = {
  topRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginBottom: 10 },
  tag: {
    fontSize: 9.5, fontWeight: 700, letterSpacing: "0.03em", padding: "2.5px 7px", borderRadius: 999,
    fontFamily: font.body, whiteSpace: "nowrap", flexShrink: 0,
  },
  teamsRow: { display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 6 },
  teamCol: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: 60 },
  teamName: {
    fontSize: 10, color: color.textSecondary, fontWeight: 600, fontFamily: font.body,
    textAlign: "center", whiteSpace: "normal", lineHeight: 1.2, overflowWrap: "anywhere",
  },
  vs: { fontSize: 10, color: color.textFaint, paddingTop: 12, flexShrink: 0 },
  scoreMini: { fontSize: 13, color: color.textPrimary, fontWeight: 800, fontFamily: font.display, paddingTop: 9, flexShrink: 0 },
};
