import FeedIcon from "./FeedIcon";
import { color, font, radius } from "../matchdayTheme";

// ── Diferențe SUBTILE per categorie — nu curcubeu. Un accent de
// culoare + o etichetă mică, restul cardului rămâne consistent cu
// tema aplicației. ──
const CATEGORY_META = {
  rank: { label: "CLASAMENT", accent: "#D4AF37" },
  match: { label: "MECI", accent: "#5B9BD5" },
  prediction: { label: "PREDICȚII", accent: "#8BD957" },
  fact: { label: "FACT", accent: "#B98CFF" },
  banter: { label: "MOMENT", accent: "#F0A94C" },
  surprise: { label: "SURPRIZĂ", accent: "#F0555A" },
  // compat cu evenimentele vechi (category string, nu type)
  clasament: { label: "CLASAMENT", accent: "#D4AF37" },
  meciuri: { label: "MECI", accent: "#5B9BD5" },
  jokeri: { label: "SURPRIZĂ", accent: "#F0555A" },
  fun: { label: "FACT", accent: "#B98CFF" },
};

function metaFor(event) {
  return CATEGORY_META[event.type] || CATEGORY_META[event.category] || { label: "", accent: color.textFaint };
}

function relativeTime(ts, now) {
  const diffMin = Math.floor((now - ts) / 60000);
  if (diffMin < 1) return "ACUM";
  if (diffMin < 60) return `acum ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `acum ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  const d = new Date(ts);
  if (diffD === 1) return `ieri, ${d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}`;
  if (diffD < 7) return `${d.toLocaleDateString("ro-RO", { weekday: "short" })}, ${d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}`;
  return d.toLocaleDateString("ro-RO", { day: "numeric", month: "short" });
}

export default function FeedCard({ event, now, onClick, compact }) {
  const meta = metaFor(event);
  return (
    <button
      type="button" onClick={() => onClick?.(event)}
      style={{
        ...s.card, ...(compact ? s.cardCompact : {}),
        ...(event.important ? { ...s.cardImportant, borderColor: meta.accent + "55", background: meta.accent + "0F" } : {}),
        borderLeftColor: meta.accent,
      }}
    >
      <span style={{ ...s.iconWrap, background: event.important ? meta.accent + "26" : color.surfaceInset }}>
        <FeedIcon name={event.icon} size={compact ? 13 : 15} />
      </span>
      <span style={s.body}>
        {!compact && <span style={{ ...s.category, color: meta.accent }}>{meta.label}</span>}
        <span style={s.title}>{event.title}</span>
        {event.subtitle && <span style={s.subtitle}>{event.subtitle}</span>}
        {event.banter && <span style={s.banterLine}>💬 {event.banter}</span>}
        {event.linkedSubtitle && <span style={s.linked}>📈 {event.linkedSubtitle}</span>}
      </span>
      <span style={s.time}>{relativeTime(event.ts, now)}</span>
    </button>
  );
}

// ── Empty state — cerut explicit: nu o pagină moartă. ──
const EMPTY_STATE_MESSAGES = [
  "Liniște momentan. Următorul meci sigur strică prietenii.",
  "Nimic nou — dar clasamentul stă la pândă.",
  "Calmul dinaintea următorului gol.",
];
export function FeedEmptyState({ seed = 0 }) {
  const msg = EMPTY_STATE_MESSAGES[seed % EMPTY_STATE_MESSAGES.length];
  return <div style={s.emptyState}>{msg}</div>;
}

const s = {
  card: {
    display: "flex", alignItems: "flex-start", gap: 10, width: "100%", textAlign: "left",
    background: color.surface, border: `1px solid ${color.borderSubtle}`, borderLeft: "3px solid transparent",
    borderRadius: radius.md, padding: "11px 12px", cursor: "pointer",
  },
  cardCompact: { background: "none", border: "none", borderLeft: "3px solid transparent", padding: "9px 0 9px 8px", borderRadius: 0, borderBottom: `1px solid ${color.borderSubtle}` },
  cardImportant: { borderWidth: 1, borderStyle: "solid" },
  iconWrap: {
    flexShrink: 0, width: 26, height: 26, borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1,
  },
  body: { flex: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 0, overflowWrap: "break-word", wordBreak: "break-word" },
  category: { fontSize: 8.5, fontWeight: 800, letterSpacing: "0.07em" },
  title: { fontSize: 12.5, fontWeight: 700, color: color.textPrimary, fontFamily: font.body, lineHeight: 1.35 },
  subtitle: { fontSize: 10.5, color: color.textSecondary, fontFamily: font.body, whiteSpace: "pre-line" },
  banterLine: { fontSize: 10.5, color: "#F0A94C", fontFamily: font.body, fontStyle: "italic", marginTop: 1 },
  linked: { fontSize: 10.5, color: color.goldLight, fontFamily: font.body, fontWeight: 600 },
  time: { flexShrink: 0, fontSize: 9.5, color: color.textFaint, fontFamily: font.body, marginTop: 2, textTransform: "uppercase" },
  emptyState: {
    textAlign: "center", padding: "28px 16px", fontSize: 12.5, color: color.textSecondary,
    fontFamily: font.body, fontStyle: "italic",
  },
};
