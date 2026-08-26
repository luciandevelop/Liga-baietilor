// avatarId e stocat pe users/{uid} ca string compus "pachet/index"
// (ex: "adireal/3") — refolosește câmpul avatarId deja existent în
// schema Firestore/regulile reale, fără niciun câmp nou.
//
// Numele fișierelor reale (orice nume, orice extensie din lista
// suportată) vin din manifestul generat automat de
// scripts/generate-avatar-manifest.js la fiecare build (vezi acolo) —
// index 1 = prima imagine găsită în folder, alfabetic, index 2 = a
// doua, etc. Nimic manual de întreținut aici.
import manifest from "./avatarManifest.generated.js";

const VARIANTS_PER_PACK = 5;

// FALLBACK pentru compatibilitate — dacă un pachet nu apare (încă) în
// manifest (ex: manifestul nu s-a regenerat dintr-un motiv oarecare),
// presupunem convenția veche {index}.png, exact cum funcționa înainte.
// Pachetele vechi (adireal, luck87, sexu-ciobanu — deja numite 1.png…
// 5.png) apar oricum corect în manifest, cu exact aceleași nume, deci
// fallback-ul e doar o plasă de siguranță, nu calea normală pentru ele.
function filenamesForPack(pack) {
  const fromManifest = manifest[pack];
  if (fromManifest && fromManifest.length > 0) return fromManifest;
  return Array.from({ length: VARIANTS_PER_PACK }, (_, i) => `${i + 1}.png`);
}

// Parsează "pachet/index" — întoarce null dacă lipsește, e gol, sau nu
// respectă formatul (userii fără avatar personalizat au avatarId: null,
// exact cazul care trebuie să cadă pe fallback-ul cu inițiala).
//
// Normalizează mereu pachetul la minuscule (nickname-urile pot avea
// majuscule, folderele nu).
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
  if (!parsed) return null;
  const filenames = filenamesForPack(parsed.pack);
  const filename = filenames[parsed.index - 1];
  if (!filename) return null;
  return `/avatars/${parsed.pack}/${encodeURIComponent(filename)}`;
}

// Toate variantele unui pachet — pentru grila din "Alege avatarul".
export function getAvatarPackVariants(pack) {
  if (!pack) return [];
  const filenames = filenamesForPack(pack);
  return filenames.slice(0, VARIANTS_PER_PACK).map((filename, i) => ({
    index: i + 1,
    avatarId: `${pack}/${i + 1}`,
    url: `/avatars/${pack}/${encodeURIComponent(filename)}`,
  }));
}

