import { color, font } from "../theme";

const TONES = {
  live: { bg: color.liveBg, border: color.liveBorder, text: color.live },
  gold: { bg: "rgba(201,162,39,0.14)", border: "rgba(201,162,39,0.4)", text: color.goldLight },
  green: { bg: color.greenBg, border: color.greenBorder, text: color.green },
  neutral: { bg: "rgba(139,147,168,0.12)", border: "rgba(139,147,168,0.25)", text: color.textMuted },
};

// dot=true adaugă un punct pulsatoriu în față (folosit pentru "● LIVE").
export default function StatusBadge({ children, tone = "neutral", dot }) {
  const t = TONES[tone] || TONES.neutral;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 10.5,
        fontWeight: 800,
        letterSpacing: "0.03em",
        color: t.text,
        background: t.bg,
        border: `1px solid ${t.border}`,
        borderRadius: 999,
        padding: "3px 9px",
        fontFamily: font.body,
        whiteSpace: "nowrap",
      }}
    >
      {dot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: t.text, flexShrink: 0 }} />}
      {children}
    </span>
  );
}
