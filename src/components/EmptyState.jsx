import { color, font } from "../theme";

export default function EmptyState({ icon = "⚽", title, subtitle }) {
  return (
    <div style={s.wrap}>
      <div style={s.icon}>{icon}</div>
      {title && <p style={s.title}>{title}</p>}
      {subtitle && <p style={s.subtitle}>{subtitle}</p>}
    </div>
  );
}

const s = {
  wrap: { textAlign: "center", padding: "36px 20px", fontFamily: font.body },
  icon: { fontSize: 30, marginBottom: 10, opacity: 0.6 },
  title: { fontSize: 14, fontWeight: 700, color: color.textSecondary, margin: "0 0 4px" },
  subtitle: { fontSize: 12, color: color.textFaint, margin: 0, lineHeight: 1.5 },
};
