import { color, font } from "../theme";

// tone: "gold" (total/neutral), "signed" (verde dacă >=0, roșu dacă <0)
export default function PointsBadge({ value, size = 20, tone = "gold", suffix = "p" }) {
  let textColor = color.goldLight;
  if (tone === "signed") textColor = value >= 0 ? color.green : color.red;

  const display = tone === "signed" && value >= 0 ? `+${value}` : String(value);

  return (
    <span
      style={{
        fontFamily: font.display,
        fontWeight: 700,
        fontSize: size,
        color: textColor,
        letterSpacing: "0.01em",
        whiteSpace: "nowrap",
      }}
    >
      {display}
      <span style={{ fontSize: size * 0.6, fontWeight: 600, opacity: 0.75 }}>{suffix}</span>
    </span>
  );
}
