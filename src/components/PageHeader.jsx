import { color, font } from "../theme";

export default function PageHeader({ eyebrow, title, subtitle, onBack, right }) {
  return (
    <div style={s.row}>
      <div style={{ minWidth: 0 }}>
        {eyebrow && <div style={s.eyebrow}>{eyebrow}</div>}
        <h1 style={s.title}>{title}</h1>
        {subtitle && <p style={s.subtitle}>{subtitle}</p>}
      </div>
      <div style={s.right}>
        {right}
        {onBack && (
          <button style={s.backBtn} onClick={onBack} type="button">
            <span style={s.backArrow}>←</span> Înapoi
          </button>
        )}
      </div>
    </div>
  );
}

const s = {
  row: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 18,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: 700,
    color: color.gold,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: color.textPrimary,
    margin: 0,
    fontFamily: font.display,
    letterSpacing: "0.01em",
  },
  subtitle: { fontSize: 12.5, color: color.textMuted, margin: "3px 0 0" },
  right: { display: "flex", alignItems: "center", gap: 8, flexShrink: 0 },
  backBtn: {
    display: "flex", alignItems: "center", gap: 6,
    background: "rgba(212,175,55,0.14)",
    border: "1px solid rgba(212,175,55,0.55)",
    color: "#F0D875",
    borderRadius: 10,
    padding: "8px 14px",
    fontSize: 12.5,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: font.body,
  },
  backArrow: { fontSize: 14, lineHeight: 1, color: "#F0D875" },
};
