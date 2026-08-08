import ClubLogo from "./ClubLogo";
import { color, font } from "../theme";

export default function MatchCompactCard({ homeTeam, awayTeam, variant = "stacked", sub, right }) {
  if (variant === "inline") {
    return (
      <div style={s.inlineRow}>
        <div style={s.inlineTeams}>
          <ClubLogo teamName={homeTeam} size={22} />
          <span style={s.inlineNames}>{homeTeam} – {awayTeam}</span>
          <ClubLogo teamName={awayTeam} size={22} />
        </div>
        {right && <div style={s.inlineRight}>{right}</div>}
      </div>
    );
  }

  return (
    <div>
      {/* Rând rezervat pentru badge-uri/countdown — NICIODATĂ absolute, deci
          nu poate suprapune siglele/numele indiferent de cât de lungi sunt
          sau câte badge-uri sunt (⭐ + 🃏 simultan se aliniază unul lângă
          altul și trec pe rând nou dacă nu încap, prin flexWrap). */}
      {right && <div style={s.rightRow}>{right}</div>}

      <div style={s.stackedRow}>
        <div style={s.teamCol}>
          <ClubLogo teamName={homeTeam} size={46} />
          <span style={s.teamName}>{homeTeam}</span>
        </div>
        <span style={s.vs}>VS</span>
        <div style={s.teamCol}>
          <ClubLogo teamName={awayTeam} size={46} />
          <span style={s.teamName}>{awayTeam}</span>
        </div>
      </div>
      {sub && <div style={s.sub}>{sub}</div>}
    </div>
  );
}

const s = {
  rightRow: {
    display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 4, marginBottom: 6,
  },
  stackedRow: { display: "flex", alignItems: "center", gap: 6 },
  teamCol: { display: "flex", flexDirection: "column", alignItems: "center", gap: 5, flex: 1, minWidth: 0 },
  teamName: {
    fontSize: 11.5, fontWeight: 700, color: color.textPrimary, textAlign: "center",
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%", fontFamily: font.body,
  },
  vs: { fontSize: 10, fontWeight: 800, color: color.textFaint, flexShrink: 0, padding: "0 4px", fontFamily: font.display },
  sub: { fontSize: 11, color: color.textMuted, textAlign: "center", marginTop: 8, fontFamily: font.body },

  inlineRow: { display: "flex", alignItems: "center", gap: 8 },
  inlineTeams: { display: "flex", alignItems: "center", gap: 7, flex: 1, minWidth: 0 },
  inlineNames: {
    fontSize: 12.5, fontWeight: 700, color: color.textPrimary,
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: font.body,
  },
  inlineRight: { flexShrink: 0 },
};
