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
    primaryColor: "#FF4B44",
    secondaryColor: "#FFB238",
    accentColor: "#1D2B53",
    borderColor: "rgba(255,75,68,0.4)",
    glowColor: "rgba(255,75,68,0.3)",
    backgroundGradient: "linear-gradient(135deg, rgba(255,75,68,0.18), rgba(255,178,56,0.04))",
    badgeBackground: "rgba(255,75,68,0.18)",
    badgeTextColor: "#FF8A85",
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
    primaryColor: "#00A8E8",
    secondaryColor: "#003459",
    accentColor: "#7FDBFF",
    borderColor: "rgba(0,168,232,0.4)",
    glowColor: "rgba(0,168,232,0.3)",
    backgroundGradient: "linear-gradient(135deg, rgba(0,168,232,0.18), rgba(0,52,89,0.06))",
    badgeBackground: "rgba(0,168,232,0.18)",
    badgeTextColor: "#6FD0F5",
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
    primaryColor: "#FCD116",
    secondaryColor: "#002B7F",
    accentColor: "#CE1126",
    borderColor: "rgba(252,209,22,0.4)",
    glowColor: "rgba(252,209,22,0.3)",
    backgroundGradient: "linear-gradient(135deg, rgba(252,209,22,0.18), rgba(0,43,127,0.08))",
    badgeBackground: "rgba(252,209,22,0.18)",
    badgeTextColor: "#F5DD6E",
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
