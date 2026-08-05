import PremiumCrest from "./PremiumCrest";
import { color, font, radius, shadow } from "../matchdayTheme";

export default function MatchRailCard({ homeTeam, awayTeam, kickoffAt, isLive, isLocked, onClick }) {
  const timeLabel = kickoffAt?.toDate
    ? kickoffAt.toDate().toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })
    : "";

  let tag = { text: timeLabel, bg: "rgba(255,255,255,0.06)", fg: color.textSecondary };
  if (isLive) tag = { text: "● LIVE", bg: "rgba(139,217,87,0.15)", fg: color.green };
  else if (isLocked) tag = { text: "LOCK", bg: "rgba(240,85,90,0.13)", fg: "#F0555A" };

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flexShrink: 0, width: 122, textAlign: "left", borderRadius: radius.md, padding: "13px 11px",
        background: "linear-gradient(155deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015))",
        border: `1px solid ${color.border}`, boxShadow: `${shadow.sm}, ${shadow.rim}`,
        fontFamily: font.body, cursor: "pointer",
      }}
    >
      <span
        style={{
          display: "inline-block", fontSize: 7.5, fontWeight: 800, letterSpacing: "0.06em",
          padding: "2.5px 7px", borderRadius: 999, marginBottom: 9, background: tag.bg, color: tag.fg,
        }}
      >
        {tag.text}
      </span>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, marginBottom: 7 }}>
        <PremiumCrest teamName={homeTeam} size={23} />
        <span style={{ fontSize: 8, color: color.textFaint }}>–</span>
        <PremiumCrest teamName={awayTeam} size={23} />
      </div>
      <div style={{ textAlign: "center", fontSize: 9.5, color: color.textSecondary, fontWeight: 600 }}>
        {homeTeam} · {awayTeam}
      </div>
    </button>
  );
}
