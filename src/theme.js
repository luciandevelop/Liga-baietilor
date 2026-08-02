// ── Design tokens — Liga Băieților ──────────────────────────────────────
// Dark premium, gold accent, sportiv. Un singur loc de adevăr pentru
// culori/tipografie/spațiere — restul componentelor importă de aici în
// loc să repete hex-uri.

export const color = {
  bg: "radial-gradient(ellipse at 50% -10%, #131A2E 0%, #080B14 60%)",
  surface: "#12182B",
  surfaceElevated: "#161D33",
  surfaceInset: "#0D1220",
  border: "#232B42",
  borderSubtle: "#1c2338",

  textPrimary: "#F5F5F0",
  textSecondary: "#C9CFE0",
  textMuted: "#8B93A8",
  textFaint: "#5A6280",

  gold: "#C9A227",
  goldLight: "#E0BC4A",
  goldGradient: "linear-gradient(180deg, #E0BC4A, #C9A227)",
  goldOn: "#0A0E1A", // text pe fundal auriu

  green: "#A9E0B8",
  greenBg: "rgba(63,168,92,0.12)",
  greenBorder: "rgba(63,168,92,0.35)",

  red: "#E08A82",
  redBg: "rgba(181,69,61,0.12)",
  redBorder: "rgba(181,69,61,0.4)",

  live: "#E08A82",
  liveBg: "rgba(181,69,61,0.10)",
  liveBorder: "rgba(181,69,61,0.3)",
};

export const font = {
  display: "'Oswald', 'Arial Narrow', sans-serif", // scoruri mari, titluri, cifre — condensat, sportiv
  body: "'Inter', system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
};

export const space = { xs: 8, sm: 12, md: 16, lg: 24 };
export const radius = { sm: 10, md: 14, lg: 18, pill: 999 };
export const shadow = {
  card: "0 4px 18px rgba(0,0,0,0.28)",
  elevated: "0 24px 70px rgba(0,0,0,0.55)",
  goldGlow: "0 0 0 1px rgba(201,162,39,0.35), 0 8px 24px rgba(201,162,39,0.12)",
};

// Container comun pentru fiecare ecran — lățime maximă mobilă, padding
// consistent. Fiecare screen își pune propriul `page` peste asta dacă are
// nevoie de alt background, dar maxWidth/padding rămân la fel peste tot.
export const layout = {
  page: {
    minHeight: "100vh",
    background: color.bg,
    padding: "20px 14px 40px",
    fontFamily: font.body,
  },
  wrap: { maxWidth: 480, margin: "0 auto" },
};
