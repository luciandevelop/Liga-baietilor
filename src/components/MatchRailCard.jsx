import ClubLogo from "./ClubLogo";
import CompetitionLogo from "./CompetitionLogo";
import { MATCH_STATUS_LABEL } from "../utils/matchStatus";
import { color, font, radius, shadow } from "../matchdayTheme";

const STATUS_TAG = {
  scheduled: null, // arătăm ora, nu un tag redundant
  live: { bg: "rgba(139,217,87,0.16)", fg: color.green },
  finished: { bg: "rgba(255,255,255,0.07)", fg: color.textSecondary },
};

export default function MatchRailCard({ homeTeam, awayTeam, kickoffAt, competition, status = "scheduled", onClick }) {
  const timeLabel = kickoffAt?.toDate
    ? kickoffAt.toDate().toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })
    : "";
  const tag = STATUS_TAG[status];

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flexShrink: 0, width: 148, textAlign: "left", borderRadius: radius.md, padding: "14px 12px",
        background: "linear-gradient(155deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015))",
        border: `1px solid ${color.border}`, boxShadow: `${shadow.sm}, ${shadow.rim}`,
        cursor: "pointer",
      }}
    >
      <div style={s.topRow}>
        {competition ? <CompetitionLogo name={competition} size={16} /> : <span />}
        <span style={{ ...s.tag, background: tag?.bg ?? "rgba(255,255,255,0.06)", color: tag?.fg ?? color.textSecondary }}>
          {tag ? MATCH_STATUS_LABEL[status] : timeLabel}
        </span>
      </div>

      <div style={s.teamsRow}>
        <div style={s.teamCol}>
          <ClubLogo teamName={homeTeam} size={32} />
          <span style={s.teamName}>{homeTeam}</span>
        </div>
        <span style={s.vs}>–</span>
        <div style={s.teamCol}>
          <ClubLogo teamName={awayTeam} size={32} />
          <span style={s.teamName}>{awayTeam}</span>
        </div>
      </div>
    </button>
  );
}

const s = {
  topRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  tag: {
    fontSize: 9.5, fontWeight: 700, letterSpacing: "0.03em", padding: "2.5px 7px", borderRadius: 999,
    fontFamily: font.body, whiteSpace: "nowrap",
  },
  teamsRow: { display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 6 },
  teamCol: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: 60 },
  teamName: {
    fontSize: 10, color: color.textSecondary, fontWeight: 600, fontFamily: font.body,
    textAlign: "center", whiteSpace: "normal", lineHeight: 1.2, overflowWrap: "anywhere",
  },
  vs: { fontSize: 10, color: color.textFaint, paddingTop: 12, flexShrink: 0 },
};
