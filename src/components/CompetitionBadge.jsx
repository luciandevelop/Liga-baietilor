import CompetitionLogo from "./CompetitionLogo";
import { font } from "../matchdayTheme";

// `match` — obiectul de meci, citește direct competitionId/competitionName/
// competitionColor (denormalizate pe fiecare meci în Firestore, nu deduse).
// Dacă meciul nu are competiție salvată (import vechi, fără antet), nu
// afișează nimic — nu inventăm o competiție.
export default function CompetitionBadge({ match, size = "md" }) {
  if (!match?.competitionId && !match?.competitionName) return null;

  const logoSize = size === "sm" ? 16 : size === "lg" ? 24 : 18;
  const fontSize = size === "sm" ? 9.5 : size === "lg" ? 11 : 10;
  const color = match.competitionColor || "#9099AC";

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {match.competitionId && <CompetitionLogo name={match.competitionId} size={logoSize} />}
      {match.competitionName && (
        <span
          style={{
            fontSize, fontWeight: 700, letterSpacing: "0.02em", color,
            fontFamily: font.body, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}
        >
          {match.competitionName}
        </span>
      )}
    </div>
  );
}
