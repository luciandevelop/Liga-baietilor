import { usePrefersReducedMotion } from "../motion";
import CompetitionBadge from "./CompetitionBadge";
import ClubLogo from "./ClubLogo";
import { getMatchStatus, MATCH_STATUS_LABEL, MATCH_STATUS_TONE } from "../utils/matchStatus";
import { color, font, radius, shadow } from "../matchdayTheme";

const LOCK_MS = 30 * 60 * 1000;

function formatCountdown(ms) {
  if (ms <= 0) return null;
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// `now` — opțional; dacă lipsește, nu arată countdown-ul (doar ora).
export default function MatchRailCard({ match, now, onClick }) {
  const reduced = usePrefersReducedMotion();
  const status = getMatchStatus(match);
  const tone = MATCH_STATUS_TONE[status];
  const timeLabel = match.kickoffAt?.toDate
    ? match.kickoffAt.toDate().toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })
    : "";
  const showScore = status === "finished" || status === "live" || status === "paused";
  const countdown = status === "scheduled" && now != null ? formatCountdown(match.kickoffAt.toMillis() - LOCK_MS - now) : null;

  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={(e) => { if (!reduced) e.currentTarget.style.transform = "scale(0.97)"; }}
      onPointerUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
      onPointerLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
      style={{
        flexShrink: 0, minWidth: 208, textAlign: "left", borderRadius: radius.lg, padding: 14,
        background: "linear-gradient(155deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015))",
        border: `1px solid ${color.border}`, boxShadow: `${shadow.card}, ${shadow.rim}`,
        cursor: "pointer", transition: "transform 90ms cubic-bezier(.4,0,.2,1)",
      }}
    >
      <div style={s.topRow}>
        <CompetitionBadge match={match} size="sm" />
        <span style={{ ...s.tag, background: tone.bg, color: tone.fg }}>{MATCH_STATUS_LABEL[status]}</span>
      </div>

      <div style={s.teamsRow}>
        <ClubLogo teamName={match.homeTeam} size={30} />
        <div style={s.namesCol}>
          <span style={s.teamName}>{match.homeTeam}</span>
          <span style={s.teamName}>{match.awayTeam}</span>
        </div>
        <ClubLogo teamName={match.awayTeam} size={30} />
      </div>

      <div style={s.bottomRow}>
        {showScore ? (
          <span style={s.score}>{match.realScoreA ?? "–"} – {match.realScoreB ?? "–"}</span>
        ) : (
          <>
            <span style={s.time}>{timeLabel}</span>
            {countdown && <span style={s.countdown}>peste {countdown}</span>}
          </>
        )}
      </div>
    </button>
  );
}

const s = {
  topRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 },
  tag: {
    fontSize: 9.5, fontWeight: 700, letterSpacing: "0.03em", padding: "2.5px 7px", borderRadius: 999,
    fontFamily: font.body, whiteSpace: "nowrap", flexShrink: 0,
  },
  teamsRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10 },
  namesCol: { display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 0 },
  teamName: {
    fontSize: 12, color: color.textPrimary, fontWeight: 700, fontFamily: font.body,
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
  },
  bottomRow: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
  time: { fontSize: 11, color: color.textSecondary, fontWeight: 600, fontFamily: font.body },
  countdown: { fontSize: 10, color: color.goldLight, fontWeight: 700, fontFamily: font.body },
  score: { fontSize: 16, color: color.textPrimary, fontWeight: 800, fontFamily: font.display },
};
