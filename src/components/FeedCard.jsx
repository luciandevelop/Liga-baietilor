import FeedIcon from "./FeedIcon";
import { color, font, radius } from "../matchdayTheme";

const CATEGORY_LABEL = {
  clasament: "CLASAMENT", meciuri: "MECIURI", "champions-league": "CHAMPIONS LEAGUE",
  liga: "LIGA", activitate: "ACTIVITATE", fun: "FUN", fotbal: "FOTBAL",
};

function relativeTime(ts, now) {
  const diffMin = Math.floor((now - ts) / 60000);
  if (diffMin < 1) return "acum";
  if (diffMin < 60) return `${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "ieri";
  if (diffD < 7) return `${diffD}z`;
  return new Date(ts).toLocaleDateString("ro-RO", { day: "numeric", month: "short" });
}

export default function FeedCard({ event, now, onClick, compact }) {
  return (
    <button type="button" onClick={() => onClick?.(event)} style={{ ...s.card, ...(compact ? s.cardCompact : {}), ...(event.important ? s.cardImportant : {}) }}>
      <span style={{ ...s.iconWrap, ...(event.important ? s.iconWrapImportant : {}) }}>
        <FeedIcon name={event.icon} size={compact ? 13 : 15} />
      </span>
      <span style={s.body}>
        {!compact && <span style={s.category}>{CATEGORY_LABEL[event.category] || ""}</span>}
        <span style={s.title}>{event.title}</span>
        {event.subtitle && <span style={s.subtitle}>{event.subtitle}</span>}
        {event.linkedSubtitle && <span style={s.linked}>📈 {event.linkedSubtitle}</span>}
      </span>
      <span style={s.time}>{relativeTime(event.ts, now)}</span>
    </button>
  );
}

const s = {
  card: {
    display: "flex", alignItems: "flex-start", gap: 10, width: "100%", textAlign: "left",
    background: color.surface, border: `1px solid ${color.borderSubtle}`, borderRadius: radius.md,
    padding: "11px 12px", cursor: "pointer",
  },
  cardCompact: { background: "none", border: "none", padding: "9px 0", borderRadius: 0, borderBottom: `1px solid ${color.borderSubtle}` },
  cardImportant: { border: `1px solid ${color.goldBorder}`, background: "rgba(212,175,55,0.06)" },
  iconWrap: {
    flexShrink: 0, width: 26, height: 26, borderRadius: "50%", background: color.surfaceInset,
    display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1,
  },
  iconWrapImportant: { background: "rgba(212,175,55,0.18)" },
  body: { flex: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 },
  category: { fontSize: 8.5, fontWeight: 800, letterSpacing: "0.07em", color: color.textFaint },
  title: { fontSize: 12.5, fontWeight: 700, color: color.textPrimary, fontFamily: font.body, lineHeight: 1.35 },
  subtitle: { fontSize: 10.5, color: color.textSecondary, fontFamily: font.body },
  linked: { fontSize: 10.5, color: color.goldLight, fontFamily: font.body, fontWeight: 600 },
  time: { flexShrink: 0, fontSize: 9.5, color: color.textFaint, fontFamily: font.body, marginTop: 2 },
};
