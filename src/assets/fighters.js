// Bibliotecă SEPARATĂ de personaje de luptă pentru ecranul de Duel —
// avatarurile normale ale jucătorilor (src/assets/avatars.js) rămân
// complet neatinse. Aceeași arhitectură (manifest generat automat,
// index stabil, fallback pe null dacă lipsește ceva), doar cu un nivel
// suplimentar: temă → pachetul PERSONAL al jucătorului (același nume de
// pachet ca la avatarul lui normal) → fișier.
//
// UN SINGUR personaj per jucător per temă (index "1") — nu variante
// multiple ca la avataruri. Convenție oficială de denumire a fișierului:
// {pachetJucător}.webp (ex: utzy/utzy.webp) — ales explicit ca fișierele
// descărcate pe telefon să nu se suprascrie/redenumească accidental între
// ele (toate ar fi fost "1.webp" altfel). Rezolvarea de mai jos NU
// depinde de numele exact al fișierului — citește orice imagine găsită
// în folder, indiferent cum se numește — dar convenția {pachet}.webp e
// cea folosită și verificată de generator (vezi
// scripts/generate-fighters-manifest.js).
import manifest from "./fightersManifest.generated.js";
import { parseAvatarId } from "./avatars.js";

// Catalog FIX de teme — independent de ce imagini există deja în
// manifest. Adminul poate alege orice temă din listă chiar înainte să
// existe vreo imagine pentru ea; până se adaugă imagini, TOȚI jucătorii
// cad automat pe avatarul normal (comportament corect, nu o eroare).
export const DUEL_THEMES = [
  { id: "kombat", label: "KOMBAT" },
  { id: "tekken", label: "TEKKEN / FIGHTERS" },
  { id: "gladiators", label: "GLADIATORS" },
  { id: "samurai", label: "SAMURAI" },
  { id: "historical", label: "HISTORICAL" },
];

// URL-ul personajului de luptă al unui jucător, pentru o temă dată.
// null dacă tema nu există în catalog, jucătorul nu are avatarId
// personal setat, pachetul lui nu are nicio imagine pentru tema asta,
// sau orice altă combinație lipsă — DuelExperience/DuelMiniCard cad pe
// PlayerAvatar (avatarul normal) exact ca înainte, prin același
// mecanism onError deja existent.
export function getFighterUrl(theme, avatarId) {
  if (!theme) return null;
  const parsed = parseAvatarId(avatarId);
  if (!parsed) return null;
  const themeManifest = manifest[theme];
  if (!themeManifest) return null;
  const entry = themeManifest[parsed.pack];
  if (!entry || !entry.files) return null;
  const filename = entry.files["1"];
  if (!filename) return null;
  return `/fighters/${theme}/${parsed.pack}/${encodeURIComponent(filename)}`;
}
