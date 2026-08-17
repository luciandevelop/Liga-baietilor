import ClubLogo from "./ClubLogo";
import CompetitionHeaderStrip from "./CompetitionHeaderStrip";
import { getCompetitionTheme } from "../competitionThemes";
import { color, font, radius } from "../matchdayTheme";

// Formatează un kickoffAt sigur, indiferent de forma în care vine:
// Firestore Timestamp (are .toDate()), Date nativ, string, sau lipsă/invalid.
function formatKickoff(kickoffAt) {
  let date = null;
  if (kickoffAt && typeof kickoffAt.toDate === "function") {
    date = kickoffAt.toDate();
  } else if (kickoffAt instanceof Date) {
    date = kickoffAt;
  } else if (kickoffAt) {
    const parsed = new Date(kickoffAt);
    if (!isNaN(parsed.getTime())) date = parsed;
  }
  if (!date || isNaN(date.getTime())) return "Dată nestabilită";

  try {
    return new Intl.DateTimeFormat("ro-RO", {
      timeZone: "Europe/Bucharest",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date).replace(",", " •");
  } catch {
    return "Dată nestabilită";
  }
}

const STATUS_LABELS = {
  scheduled: { label: "Programat", tone: "neutral" },
  live: { label: "Live", tone: "live" },
  paused: { label: "Pauză", tone: "live" },
  finished: { label: "Încheiat", tone: "done" },
};

function StatusBadge({ status }) {
  const info = STATUS_LABELS[status] || { label: status || "—", tone: "neutral" };
  return <span style={{ ...s.badge, ...s.badgeTone[info.tone] }}>{info.label}</span>;
}

export default function MatchCard({ homeTeam, awayTeam, kickoffAt, status, competitionId, competitionName, competitionColor }) {
  // Aceeași sursă unică ca peste tot — competitionThemes.js, prin
  // competitionId. Fără fallback vizibil dacă meciul n-are competiție
  // salvată, cardul rămâne pe stilul neutru implicit.
  const theme = getCompetitionTheme(competitionId);
  const hasCompetition = Boolean(competitionId || competitionName);

  return (
    <div style={{
      ...s.card,
      border: `1px solid ${hasCompetition ? theme.borderColor : color.border}`,
      background: color.surface,
      boxShadow: hasCompetition ? `0 0 14px -4px ${theme.glowColor}` : "none",
      overflow: "hidden",
    }}>
      {hasCompetition && <CompetitionHeaderStrip match={{ competitionId, competitionName, competitionColor }} />}
      <div style={{ padding: hasCompetition ? "14px 12px 12px" : "14px 12px 12px" }}>
      <div style={s.teamsRow}>
        <div style={s.clubCol}>
          <ClubLogo teamName={homeTeam} size={38} />
          <span style={s.clubName}>{homeTeam}</span>
        </div>
        <span style={s.vs}>VS</span>
        <div style={s.clubCol}>
          <ClubLogo teamName={awayTeam} size={38} />
          <span style={s.clubName}>{awayTeam}</span>
        </div>
      </div>
      <div style={s.metaRow}>
        <span style={s.kickoff}>{formatKickoff(kickoffAt)}</span>
        <StatusBadge status={status} />
      </div>
      </div>
    </div>
  );
}

const s = {
  card: { borderRadius: radius.lg, minWidth: 0 },
  teamsRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
  clubCol: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1, minWidth: 0 },
  clubName: {
    fontSize: 12, fontWeight: 700, color: color.textPrimary, textAlign: "center",
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%", fontFamily: font.body,
  },
  vs: { fontSize: 11, fontWeight: 800, color: color.textFaint, flexShrink: 0, padding: "0 6px", fontFamily: font.display },
  metaRow: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
    marginTop: 10, paddingTop: 10, borderTop: `1px solid ${color.borderSubtle}`,
  },
  kickoff: { fontSize: 11.5, color: color.textSecondary, fontFamily: font.body },
  badge: { fontSize: 10.5, fontWeight: 700, borderRadius: 999, padding: "3px 9px", letterSpacing: "0.02em", fontFamily: font.body },
  badgeTone: {
    neutral: { background: "rgba(144,153,172,0.13)", color: color.textFaint },
    live: { background: "rgba(240,85,90,0.15)", color: "#E08A82" },
    done: { background: "rgba(139,217,87,0.14)", color: "#A9E0B8" },
  },
};
