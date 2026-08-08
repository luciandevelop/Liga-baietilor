import { useState } from "react";
import { getAvatarUrl } from "../assets/avatars";
import { color, font } from "../theme";

// Sursă unică pentru avatarul unui jucător, oriunde apare în aplicație.
// Dacă avatarId rezolvă la o imagine reală, o arată; altfel (sau dacă
// imaginea eșuează la încărcare) cade pe inițiala nickname-ului — exact
// comportamentul dinainte, neschimbat pentru orice user fără avatar
// personalizat.
export default function PlayerAvatar({ avatarId, nickname, size = 32 }) {
  const [imgFailed, setImgFailed] = useState(false);
  const initial = (nickname || "?").trim().charAt(0).toUpperCase();
  const url = getAvatarUrl(avatarId);
  const showImg = Boolean(url) && !imgFailed;

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
        flexShrink: 0,
        overflow: "hidden",
        fontSize: size * 0.42,
        fontWeight: 800,
        color: color.textMuted,
        fontFamily: font.display,
      }}
    >
      {showImg ? (
        <img
          src={url}
          alt={nickname || "avatar"}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onError={() => setImgFailed(true)}
        />
      ) : (
        initial || "?"
      )}
    </div>
  );
}
