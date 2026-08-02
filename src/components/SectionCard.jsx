import { color, font, radius, shadow } from "../theme";

export default function SectionCard({ title, right, children, style, tight }) {
  return (
    <section style={{ ...s.card, ...(tight ? { padding: "12px 12px" } : {}), ...style }}>
      {(title || right) && (
        <div style={s.headerRow}>
          {title && <h2 style={s.title}>{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

const s = {
  card: {
    background: color.surface,
    border: `1px solid ${color.border}`,
    borderRadius: radius.lg,
    padding: "16px 14px",
    marginBottom: 14,
    boxShadow: shadow.card,
  },
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  title: {
    fontSize: 13,
    fontWeight: 700,
    color: color.gold,
    margin: 0,
    letterSpacing: "0.02em",
    fontFamily: font.body,
  },
};
