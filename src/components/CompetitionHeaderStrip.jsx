import { getCompetitionLogo } from "../assets/lookup";
import { getCompetitionTheme } from "../competitionThemes";
import { color, font } from "../matchdayTheme";

// Header dedicat al competiției — designul final, aprobat după 3 runde de
// rafinare (mockup-uri comparate direct de Lu). Aceeași structură pentru
// toate competițiile, fără tratament special pentru vreuna (Champions
// League inclus) — doar datele diferă (culori, logo, nume).
//
// `rightSlot` — de regulă badge-ul de status (LIVE/Programat/Final),
// randat mic și discret, ca să nu concureze vizual cu competiția.
export default function CompetitionHeaderStrip({ match, rightSlot, size = "md" }) {
  if (!match?.competitionId && !match?.competitionName) return null;
  const theme = getCompetitionTheme(match.competitionId);
  const logo = match.competitionId ? getCompetitionLogo(match.competitionId) : null;
  const logoSize = size === "lg" ? 46 : 42;
  const nameFontSize = size === "lg" ? 20 : 19;

  // Gradient radial — mai luminos în colțul stânga-sus, se stinge spre
  // culoarea de bază a cardului la margini. Nu un dreptunghi colorat plin.
  const headerGradient = `radial-gradient(120% 160% at 30% 15%, ${theme.secondaryColor} 0%, ${theme.primaryColor} 55%, #0d0e14 130%)`;

  return (
    <div style={{ position: "relative", overflow: "hidden", height: size === "lg" ? 64 : 58 }}>
      <div
        style={{
          position: "absolute", inset: 0, background: headerGradient,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "0 14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 13, minWidth: 0, position: "relative", zIndex: 2 }}>
          {logo?.url && (
            <img
              src={logo.url}
              alt={logo.name}
              style={{
                width: logoSize, height: logoSize, objectFit: "contain", flexShrink: 0,
                // Halou alb discret care urmărește silueta logo-ului — NU o
                // placă/fundal — garantează contrast chiar și pentru sigle
                // monocrome închise (ex: Champions League), fără să pară
                // un sticker lipit peste header.
                filter: "drop-shadow(0 0 2px rgba(255,255,255,0.85)) drop-shadow(0 0 7px rgba(255,255,255,0.45)) drop-shadow(0 2px 5px rgba(0,0,0,0.35))",
              }}
            />
          )}
          {match.competitionName && (
            <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
              <span
                style={{
                  fontSize: nameFontSize, fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1.1, color: "#fff",
                  textShadow: "0 1px 4px rgba(0,0,0,0.35)", fontFamily: font.display,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}
              >
                {match.competitionName}
              </span>
            </div>
          )}
        </div>
        {rightSlot && (
          <div style={{ position: "relative", zIndex: 2, flexShrink: 0 }}>
            {rightSlot}
          </div>
        )}
        {/* tranziție lină spre corpul cardului — nu o linie bruscă */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 20, background: `linear-gradient(180deg, transparent, ${color.surface})` }} />
      </div>
    </div>
  );
}
