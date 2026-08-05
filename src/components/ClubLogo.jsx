import { useState } from "react";
import { getClubLogo } from "../assets/lookup";
import { color, font } from "../matchdayTheme";

// Deterministic fallback color (same team always gets the same color,
// not a random one on every render) — used only when no real logo exists.
const FALLBACK_PALETTE = ["#3557D4", "#C2410C", "#0D9488", "#9333EA", "#DC2626", "#16A34A", "#475569", "#B45309"];
function fallbackColorFor(name) {
  let h = 0;
  for (let i = 0; i < (name || "").length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return FALLBACK_PALETTE[h % FALLBACK_PALETTE.length];
}
function initialsOf(name) {
  return (name || "?")
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// `teamName` — orice variantă de nume (din Firestore, admin, import) —
// rezolvată prin getClubLogo() cu suport de alias-uri. Dacă nu există
// siglă reală, arată inițialele pe un fundal colorat determinist —
// NICIODATĂ un cerc gol, dar și niciodată o siglă inventată.
export default function ClubLogo({ teamName, size = 40, shape = "circle" }) {
  const [imgFailed, setImgFailed] = useState(false);
  const match = getClubLogo(teamName);
  const showLogo = Boolean(match?.url) && !imgFailed;
  const borderRadius = shape === "circle" ? "50%" : 8;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius,
        background: showLogo ? color.surfaceElevated : fallbackColorFor(match?.name || teamName),
        border: `1px solid ${color.border}`,
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
          style={{ width: "78%", height: "78%", objectFit: "contain" }}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span style={{ fontSize: size * 0.34, fontWeight: 800, color: "#fff", fontFamily: font.display }}>
          {initialsOf(match?.name || teamName)}
        </span>
      )}
    </div>
  );
}
