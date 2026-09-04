import { color, font } from "../matchdayTheme";
import { getDisplayMatchState } from "../utils/matchStatus";

// ── Detaliile unui meci LIVE/FINISHED — minut, marcatori, cartonașe
// roșii. Sursa e acum `getDisplayMatchState` (utils/matchStatus.js) —
// alege automat între rezultatul OFICIAL (validat de Admin) și datele
// LIVE din API-Football (dacă meciul nu e încă validat), niciodată
// amestecate. Randată identic din Home (hero + carduri live multiple)
// și din Pronosticuri (MatchPredictionCard) — o singură componentă, o
// singură interpretare posibilă pentru același meci.
export default function LiveMatchDetails({ match, compact = false }) {
  const display = getDisplayMatchState(match);
  const minute = display.minute;
  const events = display.events || [];
  const goals = events.filter((e) => e.type === "goal" || e.type === "GOAL" || e.type === "OWN_GOAL" || e.type === "PENALTY_GOAL").sort((a, b) => a.minute - b.minute);
  const redCards = events.filter((e) => e.type === "red_card" || e.type === "RED_CARD").sort((a, b) => a.minute - b.minute);

  if (goals.length === 0 && redCards.length === 0 && minute == null) return null;

  return (
    <div style={compact ? s.wrapCompact : s.wrap}>
      {display.isLiveUnofficial && <div style={s.liveBadge}>🔴 LIVE (API, neconfirmat oficial)</div>}
      {display.isFinalUnofficial && <div style={s.finalUnofficialBadge}>FINAL — în așteptarea validării</div>}
      {minute != null && display.status === "live" && (
        <div style={s.minute}>{minute}'</div>
      )}
      {goals.map((g, i) => (
        <div key={g.id || i} style={s.eventRow}>
          <span style={s.eventIcon}>⚽</span>
          <span style={s.eventText}>{g.player ? `${g.player} ` : ""}{g.minute}'{(g.team === "home" || g.team === match.homeTeam) ? ` · ${match.homeTeam}` : ` · ${match.awayTeam}`}</span>
        </div>
      ))}
      {redCards.map((r, i) => (
        <div key={r.id || i} style={s.eventRowRed}>
          <span style={s.eventIcon}>🟥</span>
          <span style={s.eventTextRed}>{r.player ? `${r.player} ` : ""}{r.minute}'{(r.team === "home" || r.team === match.homeTeam) ? ` · ${match.homeTeam}` : ` · ${match.awayTeam}`}</span>
        </div>
      ))}
    </div>
  );
}

const s = {
  wrap: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4, margin: "10px 0" },
  wrapCompact: { display: "flex", flexDirection: "column", gap: 3, margin: "6px 0" },
  liveBadge: {
    fontSize: 9.5, fontWeight: 800, color: "#F0555A", background: "rgba(240,85,90,0.12)",
    border: "1px solid rgba(240,85,90,0.35)", borderRadius: 999, padding: "2px 8px", fontFamily: font.body,
  },
  finalUnofficialBadge: {
    fontSize: 9.5, fontWeight: 800, color: "#F0930C", background: "rgba(240,147,12,0.12)",
    border: "1px solid rgba(240,147,12,0.35)", borderRadius: 999, padding: "2px 8px", fontFamily: font.body,
  },
  minute: { fontSize: 11, fontWeight: 800, color: "#8BD957", fontFamily: font.body, marginBottom: 2 },
  eventRow: { display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: color.textSecondary, fontFamily: font.body },
  eventIcon: { fontSize: 12 },
  eventText: { fontFamily: font.body },
  eventRowRed: { display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#F0555A", fontFamily: font.body },
  eventTextRed: { fontFamily: font.body },
};
