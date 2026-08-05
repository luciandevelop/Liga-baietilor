import { useState } from "react";
import { getCompetitionLogo } from "../assets/lookup";
import { color, font } from "../matchdayTheme";

function initialsOf(name) {
  return (name || "?")
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 3)
    .join("")
    .toUpperCase();
}

// `name` — orice variantă de nume de competiție ("Champions League",
// "UEFA Champions League", "UCL"...) — rezolvată prin getCompetitionLogo().
// Fallback: inițiale pe fundal auriu discret (nu o siglă inventată).
export default function CompetitionLogo({ name, size = 32 }) {
  const [imgFailed, setImgFailed] = useState(false);
  const match = getCompetitionLogo(name);
  const showLogo = Boolean(match?.url) && !imgFailed;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        background: showLogo ? color.surfaceElevated : color.goldBg,
        border: `1px solid ${showLogo ? color.border : color.goldBorder}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {showLogo ? (
        <img
          src={match.url}
          alt={match.name}
          style={{ width: "80%", height: "80%", objectFit: "contain" }}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span style={{ fontSize: size * 0.28, fontWeight: 800, color: color.goldLight, fontFamily: font.display }}>
          {initialsOf(match?.name || name)}
        </span>
      )}
    </div>
  );
}
