// ── Matchday Experience — Design System (v3, direcția din imaginea de
// referință) ──────────────────────────────────────────────────────────
//
// FIȘIER NOU, separat intenționat de `theme.js` (vechiul sistem, folosit
// încă de Home/Pronosticuri/Clasament/Admin/Player Detail — NEATINSE în
// această fază). Dacă aș fi schimbat valorile din `theme.js` direct,
// ecranele deja construite s-ar fi schimbat vizual automat, chiar fără
// să le ating fișierele — exact ce instrucțiunea "ÎNCĂ NU modifici Home"
// interzice în spirit, nu doar literal. Separarea asta e alegerea sigură:
// ecranele vechi rămân identice, componentele noi de Fază 1 (AppHeader,
// TopTabNav, BottomTabBar, PremiumCard, CinematicBackdrop) importă de
// aici. Când vom reconstrui Home/Pronosticuri/Clasament (fazele
// următoare), ele trec să importe din acest fișier, iar `theme.js` vechi
// poate fi șters.

export const color = {
  bgDeep: "#05070B",
  bgBase: "#0A0D14",
  headerBg: "#0B0E15",

  surface: "#12161F",
  surfaceElevated: "#1A1F2C",
  surfaceInset: "#0E1119",

  border: "rgba(255,255,255,0.08)",
  borderSubtle: "rgba(255,255,255,0.05)",

  textPrimary: "#FFFFFF",
  textSecondary: "#9099AC",
  textFaint: "#5A6275",

  gold: "#D4AF37",
  goldLight: "#E8C766",
  goldHi: "#FFF6D9",
  goldDeep: "#8A6A1E",
  goldGradient: "linear-gradient(180deg, #E8C766, #D4AF37)",
  // gradient metalic complet — 4 opriri (highlight/light/mid/deep), pentru
  // CTA/carduri premium unde e nevoie de senzația reală de metal turnat,
  // nu doar un gradient plat pe 2 culori.
  goldMetalGradient: "linear-gradient(180deg, #FFF6D9 0%, #E8C766 30%, #D4AF37 62%, #8A6A1E 100%)",
  goldOn: "#0A0A0B",
  goldBg: "rgba(212,175,55,0.14)",
  goldBorder: "rgba(212,175,55,0.4)",

  // Accente pe "mod" — fiecare secțiune specială (Dueluri/Joker, Zaruri,
  // Team of the Week) are propria culoare, distinctă de gold (care rămâne
  // rezervat pentru puncte/realizare/CTA principal).
  purple: "#8B5CF6",
  purpleBg: "rgba(139,92,246,0.14)",
  purpleBorder: "rgba(139,92,246,0.4)",

  green: "#8BD957",
  greenBg: "rgba(139,217,87,0.14)",
  greenBorder: "rgba(139,217,87,0.4)",

  blue: "#3B7CF0",
  blueBg: "rgba(59,124,240,0.14)",
  blueBorder: "rgba(59,124,240,0.4)",

  notification: "#E5484D",
};

export const font = {
  // Reutilizăm Oswald/Inter — deja încărcate (index.html), deja plătite
  // ca "investiție" de performanță. Citesc suficient de aproape de
  // tipografia din imagine (sans bold condensat pentru cifre/titluri,
  // sans curat pentru rest) încât nu se justifică un al treilea font.
  display: "'Oswald', 'Arial Narrow', sans-serif",
  body: "'Inter', system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
  numericFeature: { fontVariantNumeric: "tabular-nums" },
};

export const space = { xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 48 };
export const radius = { sm: 10, md: 14, lg: 18, xl: 24, pill: 999 };

export const shadow = {
  sm: "0 4px 10px rgba(0,0,0,0.35)",
  card: "0 8px 24px rgba(0,0,0,0.45)",
  lg: "0 24px 50px rgba(0,0,0,0.55)",
  elevated: "0 24px 70px rgba(0,0,0,0.6)",
  xl: "0 34px 70px rgba(0,0,0,0.6)",
  goldRing: "0 0 0 2px rgba(212,175,55,0.5)",
  // rim-light: o linie subțire, luminoasă, sus — simulează lumină care
  // lovește marginea superioară a unei suprafețe (crest, card, buton).
  rim: "inset 0 1px 0 rgba(255,255,255,0.16)",
  rimStrong: "inset 0 1px 0 rgba(255,255,255,0.28)",
};

export const blur = { glow: "60px" };
