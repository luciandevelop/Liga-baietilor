import { color, font } from "../matchdayTheme";

// ── Detaliile unui meci LIVE/FINISHED — minut, marcatori, cartonașe
// roșii. Sursă unică (match.matchEvents, match.liveMinute), citite
// direct din documentul deja scris de Admin — nicio structură nouă.
// Randată identic din Home (hero + carduri live multiple) și din
// Pronosticuri (MatchPredictionCard) — o singură componentă, o singură
// interpretare posibilă pentru același meci.
export default function LiveMatchDetails({ match, compact = false }) {
  const minute = match.liveMinute;
  const events = match.matchEvents || [];
  const goals = events.filter((e) => e.type === "goal").sort((a, b) => a.minute - b.minute);
  const redCards = events.filter((e) => e.type === "red_card").sort((a, b) => a.minute - b.minute);

  if (goals.length === 0 && redCards.length === 0 && minute == null) return null;

  return (
    <div style={compact ? s.wrapCompact : s.wrap}>
      {minute != null && match.status === "live" && (
        <div style={s.minute}>{minute}'</div>
      )}
      {goals.map((g) => (
        <div key={g.id} style={s.eventRow}>
          <span style={s.eventIcon}>⚽</span>
          <span style={s.eventText}>{g.player ? `${g.player} ` : ""}{g.minute}'{g.team === "home" ? ` · ${match.homeTeam}` : ` · ${match.awayTeam}`}</span>
        </div>
      ))}
      {redCards.map((r) => (
        <div key={r.id} style={s.eventRowRed}>
          <span style={s.eventIcon}>🟥</span>
          <span style={s.eventTextRed}>{r.player ? `${r.player} ` : ""}{r.minute}'{r.team === "home" ? ` · ${match.homeTeam}` : ` · ${match.awayTeam}`}</span>
        </div>
      ))}
    </div>
  );
}

const s = {
  wrap: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4, margin: "10px 0" },
  wrapCompact: { display: "flex", flexDirection: "column", gap: 3, margin: "6px 0" },
  minute: { fontSize: 11, fontWeight: 800, color: "#8BD957", fontFamily: font.body, marginBottom: 2 },
  eventRow: { display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: color.textSecondary, fontFamily: font.body },
  eventIcon: { fontSize: 12 },
  eventText: { fontFamily: font.body },
  eventRowRed: { display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#F0555A", fontFamily: font.body },
  eventTextRed: { fontFamily: font.body },
};
