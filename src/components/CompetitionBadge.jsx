import CompetitionLogo from "./CompetitionLogo";
import { font } from "../matchdayTheme";

const SIZES = {
  sm: { logo: 30, font: 10, padY: 3, padX: 8 },
  md: { logo: 36, font: 11, padY: 4, padX: 10 },
  lg: { logo: 48, font: 12.5, padY: 5, padX: 12 },
};

// `match` — obiectul de meci, citește direct competitionId/competitionName/
// competitionColor (denormalizate pe fiecare meci în Firestore, nu deduse).
// Dacă meciul nu are competiție salvată (import vechi, fără antet), nu
// afișează nimic — nu inventăm o competiție.
export default function CompetitionBadge({ match, size = "md" }) {
  if (!match?.competitionId && !match?.competitionName) return null;
  const s = SIZES[size] || SIZES.md;
  const c = match.competitionColor || "#9099AC";

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      {match.competitionId && <CompetitionLogo name={match.competitionId} size={s.logo} />}
      {match.competitionName && (
        <span
          style={{
            fontSize: s.font, fontWeight: 800, letterSpacing: "0.02em", color: c,
            background: `${c}22`, border: `1px solid ${c}55`,
            padding: `${s.padY}px ${s.padX}px`, borderRadius: 999,
            fontFamily: font.body, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}
        >
          {match.competitionName}
        </span>
      )}
    </div>
  );
}
