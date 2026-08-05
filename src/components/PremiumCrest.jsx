import { useState } from "react";
import { getClubByName } from "../data/clubs";
import { color, shadow } from "../matchdayTheme";

const SHIELD_CLIP = "polygon(50% 0,96% 15%,96% 58%,50% 100%,4% 58%,4% 15%)";

// Paletă de gradient-uri "de tricou" — alese determinist din numele
// echipei (hash simplu), ca fiecare echipă fără siglă reală să primească
// totuși o culoare stabilă (nu una aleatoare la fiecare randare).
const KIT_GRADIENTS = [
  "linear-gradient(160deg,#3557D4,#0F1E4A)",
  "linear-gradient(160deg,#2178E0,#082C63)",
  "linear-gradient(160deg,#C2410C,#431407)",
  "linear-gradient(160deg,#475569,#0F172A)",
  "linear-gradient(160deg,#DC2626,#450A0A)",
  "linear-gradient(160deg,#0D9488,#022C22)",
  "linear-gradient(160deg,#16A34A,#052E16)",
  "linear-gradient(160deg,#9333EA,#2E1065)",
  "linear-gradient(160deg,#1D4ED8,#172554)",
  "linear-gradient(160deg,#B91C1C,#3F0A0A)",
];

function kitGradientFor(name) {
  let h = 0;
  for (let i = 0; i < (name || "").length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return KIT_GRADIENTS[h % KIT_GRADIENTS.length];
}

// `size` = lățimea scutului (înălțimea e ~1.12×). Siglă reală din
// clubs.js dacă există, altfel scut colorat + minge — niciodată un cerc
// gol sau un hexagon generic.
export default function PremiumCrest({ teamName, size = 40 }) {
  const [imgFailed, setImgFailed] = useState(false);
  const club = getClubByName(teamName);
  const showLogo = Boolean(club?.logoUrl) && !imgFailed;
  const h = Math.round(size * 1.12);

  return (
    <div style={{ position: "relative", width: size, height: h, flexShrink: 0, filter: `drop-shadow(0 ${size * 0.16}px ${size * 0.26}px rgba(0,0,0,0.45))` }}>
      <div
        style={{
          position: "absolute", inset: 0, clipPath: SHIELD_CLIP,
          background: showLogo ? color.surfaceElevated : kitGradientFor(club?.name || teamName || "?"),
          boxShadow: `${shadow.rimStrong}, inset 0 -${size * 0.22}px ${size * 0.28}px rgba(0,0,0,0.4)`,
        }}
      />
      <div
        style={{
          position: "absolute", inset: size * 0.08, clipPath: SHIELD_CLIP,
          border: "1px solid rgba(255,255,255,0.24)",
        }}
      />
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {showLogo ? (
          <img
            src={club.logoUrl}
            alt={club.name}
            style={{ width: "62%", height: "62%", objectFit: "contain" }}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <svg width={size * 0.36} height={size * 0.36} viewBox="0 0 24 24" fill="none" style={{ color: "rgba(255,255,255,0.9)" }}>
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
            <path d="M12 7l3 2.2-1.1 3.6H10.1L9 9.2 12 7z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </div>
  );
}
