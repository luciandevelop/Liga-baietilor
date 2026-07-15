import { useState } from "react";
import { getClubByName } from "../data/clubs";

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

// Siglă cu fallback curat la inițiale, dacă imaginea lipsește sau clubul
// nu e încă în mapping — nu se blochează niciodată pagina.
function ClubBadge({ teamName }) {
  const [imgFailed, setImgFailed] = useState(false);
  const club = getClubByName(teamName);
  const displayName = club?.name || teamName || "?";
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Fallback-ul (inițiale) apare DOAR dacă nu există club în mapping, sau
  // dacă imaginea chiar eșuează la încărcare (onError) — niciodată implicit
  // cât timp există un URL de încercat.
  const showLogo = Boolean(club?.logoUrl) && !imgFailed;

  return (
    <div style={s.clubCol}>
      <div style={s.crestWrap}>
        {showLogo ? (
          <img
            src={club.logoUrl}
            alt={displayName}
            style={s.crestImg}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <span style={s.crestFallback}>{initials || "?"}</span>
        )}
      </div>
      <span style={s.clubName}>{displayName}</span>
    </div>
  );
}

export default function MatchCard({ homeTeam, awayTeam, kickoffAt, status }) {
  return (
    <div style={s.card}>
      <div style={s.teamsRow}>
        <ClubBadge teamName={homeTeam} />
        <span style={s.vs}>VS</span>
        <ClubBadge teamName={awayTeam} />
      </div>
      <div style={s.metaRow}>
        <span style={s.kickoff}>{formatKickoff(kickoffAt)}</span>
        <StatusBadge status={status} />
      </div>
    </div>
  );
}

const s = {
  card: {
    background: "#0D1220",
    border: "1px solid #1c2338",
    borderRadius: 14,
    padding: "14px 12px 12px",
  },
  teamsRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  clubCol: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  crestWrap: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    background: "#161D33",
    border: "1px solid #232B42",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  crestImg: { width: "100%", height: "100%", objectFit: "contain" },
  crestFallback: { fontSize: 13, fontWeight: 800, color: "#8B93A8" },
  clubName: {
    fontSize: 12,
    fontWeight: 700,
    color: "#E8E4D8",
    textAlign: "center",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "100%",
  },
  vs: {
    fontSize: 11,
    fontWeight: 800,
    color: "#4A5268",
    flexShrink: 0,
    padding: "0 6px",
  },
  metaRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 10,
    paddingTop: 10,
    borderTop: "1px solid #1c2338",
  },
  kickoff: { fontSize: 11.5, color: "#8B93A8" },
  badge: {
    fontSize: 10.5,
    fontWeight: 700,
    borderRadius: 999,
    padding: "3px 9px",
    letterSpacing: "0.02em",
  },
  badgeTone: {
    neutral: { background: "rgba(139,147,168,0.12)", color: "#8B93A8" },
    live: { background: "rgba(181,69,61,0.15)", color: "#E08A82" },
    done: { background: "rgba(63,168,92,0.14)", color: "#A9E0B8" },
  },
};
