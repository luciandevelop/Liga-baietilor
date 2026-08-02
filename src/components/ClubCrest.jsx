import { useState } from "react";
import { getClubByName } from "../data/clubs";
import { color, font } from "../theme";

// Siglă cu fallback curat la inițiale — dacă echipa nu e în clubs.js sau
// imaginea eșuează la încărcare (onError), arată inițialele, niciodată un
// cerc gol. `size` controlează diametrul (px); `dense` scade și fontul.
export default function ClubCrest({ teamName, size = 40 }) {
  const [imgFailed, setImgFailed] = useState(false);
  const club = getClubByName(teamName);
  const displayName = club?.name || teamName || "?";
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const showLogo = Boolean(club?.logoUrl) && !imgFailed;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color.surfaceElevated,
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
          src={club.logoUrl}
          alt={displayName}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span style={{ fontSize: size * 0.32, fontWeight: 800, color: color.textMuted, fontFamily: font.display }}>
          {initials || "?"}
        </span>
      )}
    </div>
  );
}
