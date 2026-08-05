import { slugify } from "../utils/slugify";
import { CLUB_LOGOS, CLUB_NAMES, CLUB_ALIASES } from "./clubs/index.js";
import { COMPETITION_LOGOS, COMPETITION_NAMES, COMPETITION_ALIASES } from "./competitions/index.js";

// Rezolvă orice variantă de nume ("Inter", "Inter Milan", "FC Internazionale")
// la același logo real. Ordinea de căutare:
//   1. slug direct (numele e deja identic cu slug-ul din assets)
//   2. tabela de alias-uri (variante de nume cunoscute)
// Întoarce { url, slug, name } dacă găsește, altfel null — NU decide
// fallback-ul vizual, asta e treaba componentei (<ClubLogo />).
export function getClubLogo(rawName) {
  if (!rawName) return null;
  const slug = slugify(rawName);
  const resolvedSlug = CLUB_LOGOS[slug] ? slug : CLUB_ALIASES[slug];
  if (!resolvedSlug || !CLUB_LOGOS[resolvedSlug]) return null;
  return { url: CLUB_LOGOS[resolvedSlug], slug: resolvedSlug, name: CLUB_NAMES[resolvedSlug] };
}

export function getCompetitionLogo(rawName) {
  if (!rawName) return null;
  const slug = slugify(rawName);
  const resolvedSlug = COMPETITION_LOGOS[slug] ? slug : COMPETITION_ALIASES[slug];
  if (!resolvedSlug || !COMPETITION_LOGOS[resolvedSlug]) return null;
  return { url: COMPETITION_LOGOS[resolvedSlug], slug: resolvedSlug, name: COMPETITION_NAMES[resolvedSlug] };
}

export { CLUB_LOGOS, CLUB_NAMES, CLUB_ALIASES, COMPETITION_LOGOS, COMPETITION_NAMES, COMPETITION_ALIASES };
