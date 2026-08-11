// avatarId e stocat pe users/{uid} ca string compus "pachet/index"
// (ex: "adireal/3") — refolosește câmpul avatarId deja existent în
// schema Firestore/regulile reale, fără niciun câmp nou. Fiecare pachet
// are, implicit, 5 variante (public/avatars/{pachet}/1.png ... 5.png).
const VARIANTS_PER_PACK = 5;

// Parsează "pachet/index" — întoarce null dacă lipsește, e gol, sau nu
// respectă formatul (userii fără avatar personalizat au avatarId: null,
// exact cazul care trebuie să cadă pe fallback-ul cu inițiala).
//
// BUG REPARAT: regexul accepta litere mari (case-insensitive, /i), dar
// nu normaliza pachetul înainte să construiască URL-ul — "Luck87/1" (cu
// majusculă, exact cum arată nickname-ul) genera "/avatars/Luck87/1.png",
// care NU se potrivea cu folderul real "luck87" (minuscule) pe un server
// sensibil la majuscule. Acum normalizează mereu la minuscule.
export function parseAvatarId(avatarId) {
  if (!avatarId || typeof avatarId !== "string") return null;
  const m = /^([a-z0-9_-]+)\/([1-9][0-9]*)$/i.exec(avatarId.trim());
  if (!m) return null;
  const index = parseInt(m[2], 10);
  if (index < 1 || index > VARIANTS_PER_PACK) return null;
  return { pack: m[1].toLowerCase(), index };
}

// URL-ul real, gata de pus într-un <img src>. null dacă avatarId nu
// rezolvă la nimic valid.
export function getAvatarUrl(avatarId) {
  const parsed = parseAvatarId(avatarId);
  return parsed ? `/avatars/${parsed.pack}/${parsed.index}.png` : null;
}

// Toate variantele unui pachet — pentru grila din "Alege avatarul".
export function getAvatarPackVariants(pack) {
  if (!pack) return [];
  return Array.from({ length: VARIANTS_PER_PACK }, (_, i) => ({
    index: i + 1,
    avatarId: `${pack}/${i + 1}`,
    url: `/avatars/${pack}/${i + 1}.png`,
  }));
}
