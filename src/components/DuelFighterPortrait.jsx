import { useEffect, useState } from "react";
import PlayerAvatar from "./PlayerAvatar";
import { getFighterUrl } from "../assets/fighters";

// ── Portretul de personaj de luptă — folosit STRICT în ecranul de Duel
// (1v1 și 2v2). Avatarul normal (PlayerAvatar) rămâne complet neatins,
// peste tot în restul aplicației.
//
// Fallback automat, pe 3 niveluri, fiecare la fel de sigur:
//   1. Nicio temă aleasă de Admin pentru etapa asta (`theme` null/gol)
//      → avatarul normal, mereu, exact ca înainte de Stage B.
//   2. Tema există, dar jucătorul n-are avatar propriu setat, sau
//      pachetul lui n-are nicio imagine pentru tema asta → avatarul
//      normal (getFighterUrl întoarce null, verificat exhaustiv).
//   3. Fișierul imagine e listat în manifest, dar nu se încarcă din
//      vreun motiv (lipsă efectivă pe disc, URL stricat) → onError
//      comută pe avatarul normal, LA FEL DE MARE (fallbackSize), ca
//      să nu sară layout-ul.
//
// `loading="lazy"` — nativ, fără nicio librărie, zero cost de bundle.
export default function DuelFighterPortrait({ avatarId, nickname, theme, width, height, fallbackSize, borderRadius = 10 }) {
  const url = theme ? getFighterUrl(theme, avatarId) : null;
  const [failed, setFailed] = useState(false);

  // Resetează starea de eroare dacă se schimbă URL-ul (temă schimbată
  // de Admin cât ecranul e deschis, sau alt jucător) — altfel un
  // fallback anterior ar putea rămâne "blocat" pe noul URL, valid.
  useEffect(() => { setFailed(false); }, [url]);

  if (!url || failed) {
    return <PlayerAvatar avatarId={avatarId} nickname={nickname} size={fallbackSize} />;
  }

  return (
    <img
      src={url}
      alt={nickname || "Fighter"}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      style={{ width, height, objectFit: "cover", objectPosition: "top center", borderRadius, display: "block" }}
    />
  );
}
