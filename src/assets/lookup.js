import { slugify } from "../utils/slugify";
import { CLUB_LOGOS, CLUB_NAMES, CLUB_ALIASES } from "./clubs/index.js";
import { EXTRA_CLUB_LOGOS, EXTRA_CLUB_NAMES, EXTRA_CLUB_ALIASES } from "./extra-logos.js";
import { COMPETITION_LOGOS, COMPETITION_NAMES, COMPETITION_ALIASES } from "./competitions/index.js";

// Combinate cu sigle adăugate separat (extra-logos.js) — nu mai trebuie
// niciodată atins clubs/index.js (fișierul mare, generat) pentru sigle noi.
const ALL_CLUB_LOGOS = { ...CLUB_LOGOS, ...EXTRA_CLUB_LOGOS };
const ALL_CLUB_NAMES = { ...CLUB_NAMES, ...EXTRA_CLUB_NAMES };
const ALL_CLUB_ALIASES = { ...CLUB_ALIASES, ...EXTRA_CLUB_ALIASES };

// Rezolvă orice variantă de nume ("Inter", "Inter Milan", "FC Internazionale")
// la același logo real. Ordinea de căutare:
//   1. slug direct (numele e deja identic cu slug-ul din assets)
//   2. tabela de alias-uri (variante de nume cunoscute)
// Întoarce { url, slug, name } dacă găsește, altfel null — NU decide
// fallback-ul vizual, asta e treaba componentei (<ClubLogo />).
export function getClubLogo(rawName) {
  if (!rawName) return null;
  const slug = slugify(rawName);
  const resolvedSlug = ALL_CLUB_LOGOS[slug] ? slug : ALL_CLUB_ALIASES[slug];
  if (!resolvedSlug || !ALL_CLUB_LOGOS[resolvedSlug]) return null;
  return { url: ALL_CLUB_LOGOS[resolvedSlug], slug: resolvedSlug, name: ALL_CLUB_NAMES[resolvedSlug] };
}

export function getCompetitionLogo(rawName) {
  if (!rawName) return null;
  const slug = slugify(rawName);
  const resolvedSlug = COMPETITION_LOGOS[slug] ? slug : COMPETITION_ALIASES[slug];
  if (!resolvedSlug || !COMPETITION_LOGOS[resolvedSlug]) return null;
  return { url: COMPETITION_LOGOS[resolvedSlug], slug: resolvedSlug, name: COMPETITION_NAMES[resolvedSlug] };
}

export { ALL_CLUB_LOGOS as CLUB_LOGOS, ALL_CLUB_NAMES as CLUB_NAMES, ALL_CLUB_ALIASES as CLUB_ALIASES, COMPETITION_LOGOS, COMPETITION_NAMES, COMPETITION_ALIASES };
