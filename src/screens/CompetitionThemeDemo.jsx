import { COMPETITION_THEMES } from "../competitionThemes";
import CompetitionMatchCard from "../components/CompetitionMatchCard";
import CompetitionLogo from "../components/CompetitionLogo";
import { color, font, radius } from "../matchdayTheme";

// Meciuri DEMO — doar pentru verificare vizuală, nu date reale, nu vine
// din Firestore. De șters/înlocuit la integrare.
const DEMO_MATCHES = [
  { competition: "uefa-champions-league", homeTeam: "Real Madrid", awayTeam: "Manchester City", dateLabel: "21 MAI", timeLabel: "22:00", status: "scheduled" },
  { competition: "uefa-champions-league", homeTeam: "Barcelona", awayTeam: "Bayern München", status: "live", minute: 67, homeScore: 2, awayScore: 1 },

  { competition: "uefa-europa-league", homeTeam: "Napoli", awayTeam: "Roma", dateLabel: "22 MAI", timeLabel: "22:00", status: "scheduled" },
  { competition: "uefa-europa-league", homeTeam: "Villarreal", awayTeam: "Sporting CP", status: "finished", homeScore: 3, awayScore: 1 },

  { competition: "uefa-conference-league", homeTeam: "Benfica", awayTeam: "FC Porto", dateLabel: "22 MAI", timeLabel: "19:45", status: "scheduled" },

  { competition: "fifa-club-world-cup", homeTeam: "Real Madrid", awayTeam: "Inter", status: "live", minute: 34, homeScore: 1, awayScore: 1 },
  { competition: "fifa-club-world-cup", homeTeam: "Manchester City", awayTeam: "Bayern München", dateLabel: "22 IUN", timeLabel: "18:00", status: "scheduled" },

  { competition: "english-premier-league", homeTeam: "Arsenal", awayTeam: "Tottenham", status: "finished", homeScore: 2, awayScore: 2 },
  { competition: "english-premier-league", homeTeam: "Liverpool", awayTeam: "Manchester City", dateLabel: "20 MAI", status: "postponed" },

  { competition: "la-liga", homeTeam: "Barcelona", awayTeam: "Real Madrid", dateLabel: "18 MAI", timeLabel: "17:15", status: "scheduled" },
  { competition: "la-liga", homeTeam: "Villarreal", awayTeam: "Real Madrid", dateLabel: "19 MAI", status: "cancelled" },

  { competition: "bundesliga", homeTeam: "Bayern München", awayTeam: "Bayer Leverkusen", status: "live", minute: 12, homeScore: 0, awayScore: 0 },
  { competition: "bundesliga", homeTeam: "Bayer Leverkusen", awayTeam: "Bayern München", dateLabel: "25 MAI", timeLabel: "18:30", status: "scheduled" },

  { competition: "serie-a", homeTeam: "Inter", awayTeam: "Juventus", dateLabel: "18 MAI", timeLabel: "21:45", status: "scheduled" },
  { competition: "serie-a", homeTeam: "Milan", awayTeam: "Napoli", status: "finished", homeScore: 1, awayScore: 0 },

  { competition: "ligue-1", homeTeam: "Paris Saint-Germain", awayTeam: "Olympique Marseille", dateLabel: "19 MAI", timeLabel: "22:00", status: "scheduled" },

  { competition: "eredivisie", homeTeam: "Ajax", awayTeam: "PSV", status: "live", minute: 78, homeScore: 1, awayScore: 2 },
  { competition: "eredivisie", homeTeam: "PSV", awayTeam: "Ajax", dateLabel: "24 MAI", status: "cancelled" },

  { competition: "superliga", homeTeam: "FCSB", awayTeam: "CFR Cluj", dateLabel: "19 MAI", timeLabel: "20:30", status: "scheduled" },
  { competition: "superliga", homeTeam: "CFR Cluj", awayTeam: "FCSB", dateLabel: "26 MAI", status: "postponed" },
];

export default function CompetitionThemeDemo() {
  const themeEntries = Object.entries(COMPETITION_THEMES);

  return (
    <div style={{ minHeight: "100vh", background: color.bgBase, padding: "24px 16px 60px" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <h1 style={s.h1}>Competition Themes</h1>

        <div style={s.swatchGrid}>
          {themeEntries.map(([slug, theme]) => (
            <div key={slug} style={{ ...s.swatchCard, borderColor: theme.borderColor }}>
              <CompetitionLogo name={slug} size={30} />
              <div style={s.swatchName}>{theme.name}</div>
              <div style={s.swatchRow}><span style={s.swatchLabel}>Primary</span><span style={{ ...s.dot, background: theme.primaryColor }} /></div>
              <div style={s.swatchRow}><span style={s.swatchLabel}>Secondary</span><span style={{ ...s.dot, background: theme.secondaryColor }} /></div>
              <div style={s.swatchRow}><span style={s.swatchLabel}>Accent</span><span style={{ ...s.dot, background: theme.accentColor }} /></div>
            </div>
          ))}
        </div>

        <h1 style={{ ...s.h1, marginTop: 36 }}>Match Cards — demo (20, toate stările)</h1>
        <div style={s.legendRow}>
          <span style={s.legendItem}>● programat</span>
          <span style={s.legendItem}>● live</span>
          <span style={s.legendItem}>● terminat</span>
          <span style={s.legendItem}>● amânat</span>
          <span style={s.legendItem}>● anulat</span>
        </div>
        <div style={s.matchGrid}>
          {DEMO_MATCHES.map((m, i) => (
            <CompetitionMatchCard key={i} {...m} />
          ))}
        </div>
      </div>
    </div>
  );
}

const s = {
  h1: { fontFamily: font.display, fontSize: 20, fontWeight: 700, color: color.textPrimary, marginBottom: 16, letterSpacing: "0.01em" },
  swatchGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 },
  swatchCard: {
    background: color.surface, border: "1px solid", borderRadius: radius.md, padding: "12px 12px 14px",
    display: "flex", flexDirection: "column", gap: 6,
  },
  swatchName: { fontFamily: font.display, fontSize: 12, fontWeight: 700, color: color.textPrimary, marginTop: 4, marginBottom: 4, lineHeight: 1.25 },
  swatchRow: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  swatchLabel: { fontSize: 9.5, color: color.textFaint, fontFamily: font.body },
  dot: { width: 14, height: 14, borderRadius: "50%", flexShrink: 0 },
  legendRow: { display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 14, fontSize: 10.5, color: color.textFaint, fontFamily: font.body },
  legendItem: {},
  matchGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: 12 },
};
