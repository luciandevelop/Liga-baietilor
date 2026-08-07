import { usePrefersReducedMotion } from "../motion";
import CompetitionBadge from "./CompetitionBadge";
import ClubLogo from "./ClubLogo";
import { getMatchStatus, MATCH_STATUS_LABEL, MATCH_STATUS_TONE } from "../utils/matchStatus";
import { getCompetitionTheme } from "../competitionThemes";
import { color, font, radius, shadow } from "../matchdayTheme";

const LOCK_MS = 30 * 60 * 1000;

function formatCountdown(ms) {
  if (ms <= 0) return null;
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// `now` — opțional; dacă lipsește, nu arată countdown-ul (doar ora).
// `emphasizeCountdown` — pentru primele 3 carduri din "Urmează": arată
// "Se blochează în" + countdown ÎN LOC de oră, cerut explicit.
// `isFeatured` — meci din featuredMatchIds (Meciul Săptămânii/Punctaj
// Dublu) — tratament vizual auriu distinct.
export default function MatchRailCard({ match, now, emphasizeCountdown = false, isFeatured = false, onClick }) {
  const reduced = usePrefersReducedMotion();
  const status = getMatchStatus(match, now);
  const tone = MATCH_STATUS_TONE[status];
  // Identitatea competiției — SINGURA sursă: competitionThemes.js, citită
  // prin match.competitionId. Meciul Săptămânii (isFeatured) rămâne auriu
  // (tratament separat, intenționat), restul cardurilor iau exact
  // culorile competiției — nu mai există gradient/bordură generice.
  const theme = getCompetitionTheme(match.competitionId);
  const timeLabel = match.kickoffAt?.toDate
    ? match.kickoffAt.toDate().toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })
    : "";
  const showScore = status === "finished";
  const countdown = status === "scheduled" && now != null ? formatCountdown(match.kickoffAt.toMillis() - LOCK_MS - now) : null;

  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={(e) => { if (!reduced) e.currentTarget.style.transform = "scale(0.97)"; }}
      onPointerUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
      onPointerLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
      style={{
        flexShrink: 0, minWidth: isFeatured ? 232 : 208, textAlign: "left", borderRadius: radius.lg,
        overflow: "hidden",
        background: isFeatured
          ? "linear-gradient(155deg, rgba(212,175,55,0.16), rgba(212,175,55,0.03))"
          : `${theme.backgroundGradient}, ${color.surface}`,
        border: `1px solid ${isFeatured ? "rgba(212,175,55,0.5)" : theme.borderColor}`,
        boxShadow: isFeatured ? `0 0 18px rgba(212,175,55,0.28), ${shadow.card}` : `0 10px 22px -10px ${theme.glowColor}, ${shadow.card}`,
        cursor: "pointer", transition: "transform 90ms cubic-bezier(.4,0,.2,1)",
      }}
    >
      {/* separator/accent — o singură linie subțire, culoarea competiției */}
      <div style={{ height: 2, width: "100%", background: isFeatured ? "linear-gradient(90deg,#FFF6D9,#D4AF37)" : `linear-gradient(90deg, ${theme.primaryColor}, ${theme.secondaryColor})` }} />

      <div style={{ padding: isFeatured ? 15 : 14 }}>
      {isFeatured && <div style={s.motwTag}>⭐ Meciul Săptămânii · ×2</div>}

      <div style={s.topRow}>
        <CompetitionBadge match={match} size="sm" />
        <span style={{ ...s.tag, background: tone.bg, color: tone.fg }}>{MATCH_STATUS_LABEL[status]}</span>
      </div>

      <div style={s.teamsRow}>
        <ClubLogo teamName={match.homeTeam} size={30} />
        <div style={s.namesCol}>
          <span style={s.teamName}>{match.homeTeam}</span>
          <span style={s.teamName}>{match.awayTeam}</span>
        </div>
        <ClubLogo teamName={match.awayTeam} size={30} />
      </div>

      {status === "scheduled" && (
        <div style={s.bottomRow}>
          {emphasizeCountdown ? (
            <div>
              {countdown ? (
                <>
                  <div style={s.lockLabel}>Se blochează în</div>
                  <span style={s.countdownBig}>{countdown}</span>
                </>
              ) : (
                <span style={s.lockedTag}>Blocat</span>
              )}
            </div>
          ) : (
            <>
              <span style={s.time}>{timeLabel}</span>
              {countdown ? <span style={s.countdown}>peste {countdown}</span> : <span style={s.lockedTag}>Blocat</span>}
            </>
          )}
        </div>
      )}
      {showScore && (
        <div style={s.bottomRow}>
          <span style={s.score}>{match.realScoreA} – {match.realScoreB}</span>
        </div>
      )}
      </div>
    </button>
  );
}

const s = {
  motwTag: {
    fontSize: 9.5, fontWeight: 800, color: "#241B05", background: "linear-gradient(180deg,#FFF6D9,#D4AF37)",
    borderRadius: 999, padding: "3px 9px", display: "inline-block", marginBottom: 9, fontFamily: font.body,
  },
  topRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 },
  tag: {
    fontSize: 9.5, fontWeight: 700, letterSpacing: "0.03em", padding: "2.5px 7px", borderRadius: 999,
    fontFamily: font.body, whiteSpace: "nowrap", flexShrink: 0,
  },
  teamsRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10 },
  namesCol: { display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 0 },
  teamName: {
    fontSize: 12, color: color.textPrimary, fontWeight: 700, fontFamily: font.body,
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
  },
  bottomRow: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
  lockLabel: { fontSize: 9, color: color.textFaint, fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", marginBottom: 2 },
  countdownBig: { fontSize: 13, color: color.goldLight, fontWeight: 800, fontFamily: font.display },
  time: { fontSize: 11, color: color.textSecondary, fontWeight: 600, fontFamily: font.body },
  countdown: { fontSize: 10, color: color.goldLight, fontWeight: 700, fontFamily: font.body },
  lockedTag: {
    fontSize: 9.5, fontWeight: 800, letterSpacing: "0.03em", color: "#F0555A",
    background: "rgba(240,85,90,0.13)", borderRadius: 999, padding: "3px 9px", fontFamily: font.body,
  },
  score: { fontSize: 16, color: color.textPrimary, fontWeight: 800, fontFamily: font.display },
};
