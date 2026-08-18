// ── Competition Theme System v2 ──────────────────────────────────────
// Cheile sunt EXACT slug-urile din src/assets/competitions — nicio
// schimbare de slug, nicio atingere a lookup.js.
//
// Fiecare temă:
//   primaryColor      — accent principal (linie sus, border, glow, badge text)
//   secondaryColor    — accent secundar (gradient, detalii)
//   accentColor       — un al treilea ton, distinctiv, din identitatea
//                       reală a competiției (ex. auriul UCL, negrul
//                       Bundesligii, bleumarinul Ligue 1, culorile
//                       drapelului pentru SuperLiga) — asta separă
//                       vizual competițiile care altfel ar cădea în
//                       aceeași "familie" de culoare (ex. albastru)
//   borderColor       — conturul cardului (derivat din primary, opac redus)
//   glowColor         — culoare pentru glow-ul discret din spatele cardului
//   backgroundGradient — gradient foarte transparent, sugestie de fundal
//   badgeBackground / badgeTextColor — eticheta cu numele competiției
//   pattern           — 'geometric' (competiții UEFA/FIFA — linii+stadion)
//                       sau 'diagonal' (campionate naționale) — folosit
//                       de card pentru un micro-pattern discret de fundal
export const COMPETITION_THEMES = {
  "uefa-champions-league": {
    name: "Champions League",
    primaryColor: "#0C2AAB",
    secondaryColor: "#5B7FFF",
    accentColor: "#F4C430",
    borderColor: "rgba(12,42,171,0.4)",
    glowColor: "rgba(12,42,171,0.35)",
    backgroundGradient: "linear-gradient(135deg, rgba(12,42,171,0.20), rgba(244,196,48,0.03))",
    badgeBackground: "rgba(12,42,171,0.18)",
    badgeTextColor: "#8CA3FF",
    pattern: "geometric",
  },
  "uefa-europa-league": {
    name: "Europa League",
    primaryColor: "#F0930C",
    secondaryColor: "#FFC857",
    accentColor: "#4A3AFF",
    borderColor: "rgba(240,147,12,0.4)",
    glowColor: "rgba(240,147,12,0.32)",
    backgroundGradient: "linear-gradient(135deg, rgba(240,147,12,0.18), rgba(74,58,255,0.04))",
    badgeBackground: "rgba(240,147,12,0.18)",
    badgeTextColor: "#FFB84D",
    pattern: "geometric",
  },
  "uefa-conference-league": {
    name: "Conference League",
    primaryColor: "#00D46A",
    secondaryColor: "#6FFFB0",
    accentColor: "#003D2E",
    borderColor: "rgba(0,212,106,0.4)",
    glowColor: "rgba(0,212,106,0.32)",
    backgroundGradient: "linear-gradient(135deg, rgba(0,212,106,0.18), rgba(0,61,46,0.05))",
    badgeBackground: "rgba(0,212,106,0.18)",
    badgeTextColor: "#5CFFA8",
    pattern: "geometric",
  },
  "fifa-club-world-cup": {
    name: "Club World Cup",
    primaryColor: "#00B8A9",
    secondaryColor: "#FFD23F",
    accentColor: "#6A00F4",
    borderColor: "rgba(0,184,169,0.4)",
    glowColor: "rgba(0,184,169,0.32)",
    backgroundGradient: "linear-gradient(135deg, rgba(0,184,169,0.18), rgba(106,0,244,0.05))",
    badgeBackground: "rgba(0,184,169,0.18)",
    badgeTextColor: "#5CE8DA",
    pattern: "geometric",
  },
  "english-premier-league": {
    name: "Premier League",
    primaryColor: "#3D195B",
    secondaryColor: "#E90052",
    accentColor: "#04F5FF",
    borderColor: "rgba(61,25,91,0.45)",
    glowColor: "rgba(233,0,82,0.28)",
    backgroundGradient: "linear-gradient(135deg, rgba(61,25,91,0.22), rgba(233,0,82,0.04))",
    badgeBackground: "rgba(61,25,91,0.22)",
    badgeTextColor: "#C48CFF",
    pattern: "diagonal",
  },
  "la-liga": {
    name: "LaLiga",
    primaryColor: "#FFC72C",
    secondaryColor: "#C8102E",
    accentColor: "#1D2B53",
    borderColor: "rgba(255,199,44,0.4)",
    glowColor: "rgba(255,199,44,0.3)",
    backgroundGradient: "linear-gradient(135deg, rgba(255,199,44,0.18), rgba(200,16,46,0.06))",
    badgeBackground: "rgba(255,199,44,0.18)",
    badgeTextColor: "#FFDD7A",
    pattern: "diagonal",
  },
  "bundesliga": {
    name: "Bundesliga",
    primaryColor: "#D3010C",
    secondaryColor: "#1C1C1C",
    accentColor: "#FFFFFF",
    borderColor: "rgba(211,1,12,0.4)",
    glowColor: "rgba(211,1,12,0.3)",
    backgroundGradient: "linear-gradient(135deg, rgba(211,1,12,0.20), rgba(28,28,28,0.10))",
    badgeBackground: "rgba(211,1,12,0.18)",
    badgeTextColor: "#FF6B6B",
    pattern: "diagonal",
  },
  "serie-a": {
    name: "Serie A",
    primaryColor: "#16213E",
    secondaryColor: "#4A6FA5",
    accentColor: "#7FDBFF",
    borderColor: "rgba(74,111,165,0.4)",
    glowColor: "rgba(22,33,62,0.4)",
    backgroundGradient: "linear-gradient(135deg, rgba(74,111,165,0.16), rgba(22,33,62,0.12))",
    badgeBackground: "rgba(74,111,165,0.18)",
    badgeTextColor: "#8FB1DC",
    pattern: "diagonal",
  },
  "ligue-1": {
    name: "Ligue 1",
    primaryColor: "#DAE000",
    secondaryColor: "#001E62",
    accentColor: "#DAE000",
    borderColor: "rgba(218,224,0,0.35)",
    glowColor: "rgba(218,224,0,0.28)",
    backgroundGradient: "linear-gradient(135deg, rgba(218,224,0,0.14), rgba(0,30,98,0.10))",
    badgeBackground: "rgba(218,224,0,0.18)",
    badgeTextColor: "#E8ED5C",
    pattern: "diagonal",
  },
  "eredivisie": {
    name: "Eredivisie",
    primaryColor: "#E8480C",
    secondaryColor: "#003DA5",
    accentColor: "#FFFFFF",
    borderColor: "rgba(232,72,12,0.4)",
    glowColor: "rgba(232,72,12,0.3)",
    backgroundGradient: "linear-gradient(135deg, rgba(232,72,12,0.18), rgba(0,61,165,0.06))",
    badgeBackground: "rgba(232,72,12,0.18)",
    badgeTextColor: "#FF8A5C",
    pattern: "diagonal",
  },
  "superliga": {
    name: "SuperLiga",
    primaryColor: "#8B1E3F",
    secondaryColor: "#002B7F",
    accentColor: "#FCD116",
    borderColor: "rgba(139,30,63,0.4)",
    glowColor: "rgba(139,30,63,0.3)",
    backgroundGradient: "linear-gradient(135deg, rgba(139,30,63,0.2), rgba(0,43,127,0.06))",
    badgeBackground: "rgba(139,30,63,0.2)",
    badgeTextColor: "#E888A3",
    pattern: "diagonal",
  },
  "primeira-liga": {
    name: "Liga Portugal",
    primaryColor: "#046A38",
    secondaryColor: "#DA020E",
    accentColor: "#FFE900",
    borderColor: "rgba(4,106,56,0.4)",
    glowColor: "rgba(4,106,56,0.3)",
    backgroundGradient: "linear-gradient(135deg, rgba(4,106,56,0.2), rgba(218,2,14,0.06))",
    badgeBackground: "rgba(4,106,56,0.2)",
    badgeTextColor: "#5CD98E",
    pattern: "diagonal",
  },
  "cupa-romaniei": {
    name: "Cupa României",
    primaryColor: "#D4AF37",
    secondaryColor: "#8B1E3F",
    accentColor: "#002B7F",
    borderColor: "rgba(212,175,55,0.4)",
    glowColor: "rgba(212,175,55,0.32)",
    backgroundGradient: "linear-gradient(135deg, rgba(212,175,55,0.2), rgba(139,30,63,0.05))",
    badgeBackground: "rgba(212,175,55,0.2)",
    badgeTextColor: "#F0D875",
    pattern: "diagonal",
  },
  "liga-2-romania": {
    name: "Liga 2",
    primaryColor: "#5A6472",
    secondaryColor: "#8B1E3F",
    accentColor: "#FCD116",
    borderColor: "rgba(90,100,114,0.4)",
    glowColor: "rgba(90,100,114,0.3)",
    backgroundGradient: "linear-gradient(135deg, rgba(90,100,114,0.2), rgba(139,30,63,0.05))",
    badgeBackground: "rgba(90,100,114,0.2)",
    badgeTextColor: "#B4BBC7",
    pattern: "diagonal",
  },
};

// Fallback neutru — pentru orice slug de competiție fără temă definită.
export const NEUTRAL_COMPETITION_THEME = {
  name: "Competiție",
  primaryColor: "#8B92A5",
  secondaryColor: "#9099AC",
  accentColor: "#C4C9D4",
  borderColor: "rgba(139,146,165,0.25)",
  glowColor: "rgba(139,146,165,0.2)",
  backgroundGradient: "linear-gradient(135deg, rgba(139,146,165,0.10), rgba(139,146,165,0.02))",
  badgeBackground: "rgba(139,146,165,0.12)",
  badgeTextColor: "#9099AC",
  pattern: "diagonal",
};

export function getCompetitionTheme(slug) {
  return COMPETITION_THEMES[slug] || NEUTRAL_COMPETITION_THEME;
}

// Rezolvă un nume liber de competiție (scris de admin la import, ex.
// "Champions League", "Europa League") la un preset existent — folosește
// aceeași normalizare ca lookup.js pentru cluburi (slugify), plus câteva
// alias-uri uzuale. Dacă nu găsește nimic, întoarce null — apelantul
// decide fallback-ul (nu inventăm o culoare aleatorie).
const COMPETITION_NAME_ALIASES = {
  "champions-league": "uefa-champions-league",
  "ucl": "uefa-champions-league",
  "europa-league": "uefa-europa-league",
  "uel": "uefa-europa-league",
  "conference-league": "uefa-conference-league",
  "uecl": "uefa-conference-league",
  "club-world-cup": "fifa-club-world-cup",
  "cwc": "fifa-club-world-cup",
  "premier-league": "english-premier-league",
  "epl": "english-premier-league",
  "laliga": "la-liga",
  "superliga-romania": "superliga",
  "liga-1": "superliga",
  "liga-i": "superliga",
  "liga-portugal": "primeira-liga",
  "cupa-romaniei-betano": "cupa-romaniei",
  "liga-2": "liga-2-romania",
  "liga-ii": "liga-2-romania",
  "liga-2-casa-pariurilor": "liga-2-romania",
};

export function resolveCompetitionPreset(rawName) {
  if (!rawName) return null;
  const slug = rawName
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const resolvedSlug = COMPETITION_THEMES[slug] ? slug : COMPETITION_NAME_ALIASES[slug];
  if (!resolvedSlug) return null;
  return { id: resolvedSlug, ...COMPETITION_THEMES[resolvedSlug] };
}
