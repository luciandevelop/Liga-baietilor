import { color, font } from "../theme";

// NU EXISTĂ ÎNCĂ un mapping avatarId → imagine în proiect. Câmpul
// avatarId există pe users/{uid} (vezi firestore.rules), dar authService
// îl setează mereu `null` la crearea profilului, și nu există niciun
// fișier de assets/URL-uri pentru avataruri (spre deosebire de clubs.js
// pentru echipe). Nu inventăm URL-uri.
//
// Componenta e pregătită pentru când mapping-ul va exista: un singur loc
// de adăugat (marcat mai jos), fallback-ul rămâne identic la eroare.
// Până atunci, arată ÎNTOTDEAUNA inițiala nickname-ului.
export default function PlayerAvatar({ avatarId, nickname, size = 32 }) {
  const initial = (nickname || "?").trim().charAt(0).toUpperCase();

  // TODO: când există un AVATAR_MAP (avatarId -> URL), verifică aici
  // AVATAR_MAP[avatarId] și randează <img> cu fallback identic la onError.

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
        fontSize: size * 0.42,
        fontWeight: 800,
        color: color.textMuted,
        fontFamily: font.display,
      }}
    >
      {initial || "?"}
    </div>
  );
}
