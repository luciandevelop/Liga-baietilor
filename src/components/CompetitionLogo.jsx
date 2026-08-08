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
// Siglă reală: plutește direct, fără cutie/fundal — citește mai clar la
// dimensiuni mari și seamănă cu tratamentul din aplicații sportive
// premium. Fallback (fără siglă): păstrează un cerc colorat cu inițiale,
// pentru că acolo chiar are nevoie de o formă vizibilă.
export default function CompetitionLogo({ name, size = 32 }) {
  const [imgFailed, setImgFailed] = useState(false);
  const match = getCompetitionLogo(name);
  const showLogo = Boolean(match?.url) && !imgFailed;

  if (showLogo) {
    return (
      <img
        src={match.url}
        alt={match.name}
        style={{
          width: size, height: size, objectFit: "contain", flexShrink: 0,
          filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.45))",
        }}
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0,
        background: color.goldBg, border: `1px solid ${color.goldBorder}`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <span style={{ fontSize: size * 0.32, fontWeight: 800, color: color.goldLight, fontFamily: font.display }}>
        {initialsOf(match?.name || name)}
      </span>
    </div>
  );
}
