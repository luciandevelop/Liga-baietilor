import ClubLogo from "./ClubLogo";
import CompetitionLogo from "./CompetitionLogo";
import { getCompetitionTheme } from "../competitionThemes";
import { color, font, radius } from "../matchdayTheme";
import { usePrefersReducedMotion } from "../motion";

// Pattern de fundal FOARTE discret — doar în zona de conținut, nu peste
// banda de semnătură.
function BackgroundPattern({ type, tint }) {
  const style =
    type === "geometric"
      ? {
          backgroundImage: `
            repeating-linear-gradient(115deg, ${tint} 0 1px, transparent 1px 26px),
            repeating-linear-gradient(25deg, ${tint} 0 1px, transparent 1px 26px)
          `,
        }
      : { backgroundImage: `repeating-linear-gradient(135deg, ${tint} 0 1px, transparent 1px 18px)` };
  return <div aria-hidden="true" style={{ position: "absolute", inset: 0, opacity: 0.3, pointerEvents: "none", ...style }} />;
}

// Status — nu mai sunt etichete mici: padding generos, font mai mare,
// vizibile dintr-o privire.
const STATUS_BADGE = {
  live: { label: "LIVE", bg: "rgba(240,85,90,0.22)", text: "#FF6B70", pulse: true },
  finished: { label: "FINAL", bg: "rgba(255,255,255,0.08)", text: "#C4C9D4", pulse: false },
  postponed: { label: "AMÂNAT", bg: "rgba(240,147,12,0.18)", text: "#F0A94E", pulse: false },
  cancelled: { label: "ANULAT", bg: "rgba(139,146,165,0.18)", text: "#9099AC", pulse: false },
};

// Mobile-first — gândit exclusiv pentru ~390px lățime (telefon). Pe
// desktop cardul rămâne funcțional (grid-ul din demo îl încadrează
// natural), dar nu mai e ținta de optimizare.
export default function CompetitionMatchCard({
  competition,
  homeTeam,
  awayTeam,
  dateLabel,
  timeLabel,
  status = "scheduled",
  minute,
  homeScore,
  awayScore,
}) {
  const theme = getCompetitionTheme(competition);
  const reduced = usePrefersReducedMotion();
  const inactive = status === "postponed" || status === "cancelled";
  const badge = STATUS_BADGE[status];

  const homeWins = status === "finished" && homeScore != null && awayScore != null && homeScore > awayScore;
  const awayWins = status === "finished" && homeScore != null && awayScore != null && awayScore > homeScore;

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        overflow: "hidden",
        borderRadius: radius.lg,
        border: `1px solid ${theme.borderColor}`,
        boxShadow: `0 14px 34px -10px ${theme.glowColor}`,
        opacity: inactive ? 0.72 : 1,
      }}
    >
      {/* ── banda de semnătură ── */}
      <div
        style={{
          width: 48,
          flexShrink: 0,
          background: `linear-gradient(180deg, ${theme.primaryColor}, ${theme.secondaryColor})`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: 16,
        }}
      >
        <div style={{ background: "rgba(10,11,15,0.72)", borderRadius: 9, padding: 5 }}>
          <CompetitionLogo name={competition} size={24} />
        </div>
      </div>

      {/* ── conținut ── */}
      <div style={{ position: "relative", flex: 1, minWidth: 0, background: `${theme.backgroundGradient}, ${color.surface}` }}>
        <BackgroundPattern type={theme.pattern} tint={theme.borderColor} />

        <div style={{ position: "relative", padding: "18px 16px 22px" }}>
          {/* header — logo+nume pe un rând, dată/status în dreapta */}
          <div style={s.headerRow}>
            <div style={s.headerLeft}>
              <span style={{ ...s.compBadge, background: theme.badgeBackground, color: theme.badgeTextColor }}>{theme.name}</span>
            </div>

            {badge ? (
              <span style={{ ...s.statusBadge, background: badge.bg, color: badge.text }}>
                {badge.pulse && (
                  <span
                    aria-hidden="true"
                    style={{
                      width: 8, height: 8, borderRadius: "50%", background: badge.text,
                      boxShadow: `0 0 7px ${badge.text}`,
                      animation: reduced ? "none" : "liga-live-pulse 1.6s ease-in-out infinite",
                    }}
                  />
                )}
                {badge.label}
                {status === "live" && minute ? <span style={{ opacity: 0.85, fontWeight: 700 }}>{minute}'</span> : null}
              </span>
            ) : (
              <span style={{ ...s.date, color: theme.primaryColor }}>{dateLabel}</span>
            )}
          </div>

          {/* rândul principal — scorul/VS domină, numele nu se taie NICIODATĂ */}
          <div style={s.matchRow}>
            <div style={s.teamCol}>
              <ClubLogo teamName={homeTeam} size={50} />
              <span style={{ ...s.teamName, opacity: awayWins ? 0.7 : 1, fontWeight: homeWins ? 800 : 700 }}>{homeTeam}</span>
            </div>

            <div style={s.centerCol}>
              {status === "scheduled" && (
                <>
                  <span style={s.vs}>VS</span>
                  {timeLabel && <span style={{ ...s.centerSub, color: theme.primaryColor }}>{timeLabel}</span>}
                </>
              )}
              {(status === "live" || status === "finished") && (
                <span style={{ ...s.score, color: status === "live" ? "#FF6B70" : color.textPrimary }}>
                  {homeScore ?? 0}–{awayScore ?? 0}
                </span>
              )}
              {inactive && <span style={{ ...s.separator, background: theme.primaryColor, opacity: 0.4 }} />}
            </div>

            <div style={s.teamCol}>
              <ClubLogo teamName={awayTeam} size={50} />
              <span style={{ ...s.teamName, opacity: homeWins ? 0.7 : 1, fontWeight: awayWins ? 800 : 700 }}>{awayTeam}</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes liga-live-pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .4; transform: scale(1.35); } }`}</style>
    </div>
  );
}

const s = {
  headerRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 10 },
  headerLeft: { display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 },
  compBadge: {
    fontSize: 11, fontWeight: 700, letterSpacing: "0.02em",
    fontFamily: font.body, whiteSpace: "normal", lineHeight: 1.25,
  },
  date: { fontSize: 11.5, fontFamily: font.body, fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 },
  statusBadge: {
    display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, letterSpacing: "0.04em",
    padding: "6px 13px", borderRadius: 999, fontFamily: font.body, flexShrink: 0, whiteSpace: "nowrap",
  },

  // fiecare coloană de echipă are lățime FIXĂ (nu flex:1 nelimitat) —
  // asta e ce permite numelui să treacă pe două rânduri previzibil, în
  // loc să se întindă/taie. Centrat, nu aliniat la margine — mai robust
  // la wrapping pe 2 rânduri.
  matchRow: { display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 6 },
  teamCol: { display: "flex", flexDirection: "column", alignItems: "center", gap: 10, width: 104, flexShrink: 0 },
  teamName: {
    fontSize: 13.5, color: color.textPrimary, fontFamily: font.body, textAlign: "center",
    whiteSpace: "normal", lineHeight: 1.2, wordBreak: "normal", overflowWrap: "anywhere",
  },
  centerCol: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", gap: 6, flexShrink: 0, paddingTop: 8, minWidth: 64 },
  vs: { fontFamily: font.display, fontSize: 19, fontWeight: 700, color: color.textFaint },
  score: {
    fontFamily: font.display, fontSize: 46, fontWeight: 800, lineHeight: 1, letterSpacing: "0.01em",
    ...font.numericFeature,
  },
  centerSub: { fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" },
  separator: { width: 26, height: 2, borderRadius: 1, marginTop: 10 },
};
