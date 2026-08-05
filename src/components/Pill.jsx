import { color, font, radius } from "../matchdayTheme";

const TONES = {
  gold: { text: color.gold, bg: "transparent", border: color.goldBorder },
  purple: { text: color.purple, bg: color.purpleBg, border: color.purpleBorder },
  green: { text: color.green, bg: color.greenBg, border: color.greenBorder },
  blue: { text: color.blue, bg: color.blueBg, border: color.blueBorder },
};

export default function Pill({ children, tone = "gold" }) {
  const t = TONES[tone] || TONES.gold;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.03em",
        color: t.text,
        background: t.bg,
        border: `1px solid ${t.border}`,
        borderRadius: radius.pill,
        padding: "5px 12px",
        fontFamily: font.body,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}
