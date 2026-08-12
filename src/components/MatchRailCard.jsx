import { usePrefersReducedMotion } from "../motion";
import CompetitionHeaderStrip from "./CompetitionHeaderStrip";
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
// "Se blochează în" + countdown ÎN LOC de oră.
// `isFeatured` — meci din featuredMatchIds (Meciul Săptămânii/Punctaj
// Dublu) — tratament vizual auriu distinct, imposibil de ratat.
export default function MatchRailCard({ match, now, emphasizeCountdown = false, isFeatured = false, featuredIndex, onClick }) {
  const reduced = usePrefersReducedMotion();
  const status = getMatchStatus(match, now);
  const tone = MATCH_STATUS_TONE[status];
  const theme = getCompetitionTheme(match.competitionId);
  const timeLabel = match.kickoffAt?.toDate
    ? match.kickoffAt.toDate().toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })
    : "";
  const showScore = status === "finished";
  const countdown = status === "scheduled" && now != null ? formatCountdown(match.kickoffAt.toMillis() - LOCK_MS - now) : null;
  const statusTag = <span style={{ ...s.tag, background: tone.bg, color: tone.fg }}>{MATCH_STATUS_LABEL[status]}</span>;

  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={(e) => { if (!reduced) e.currentTarget.style.transform = "scale(0.97)"; }}
      onPointerUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
      onPointerLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
      style={{
        flexShrink: 0, minWidth: isFeatured ? 264 : 236, textAlign: "left", borderRadius: radius.lg,
        overflow: "hidden", position: "relative",
        background: isFeatured
          ? "linear-gradient(165deg, rgba(212,175,55,0.22) 0%, rgba(212,175,55,0.05) 45%, #12141C 100%)"
          : color.surface,
        border: `1px solid ${isFeatured ? "rgba(212,175,55,0.55)" : theme.borderColor}`,
        boxShadow: isFeatured
          ? "0 0 26px rgba(212,175,55,0.32), 0 16px 30px -12px rgba(0,0,0,0.55)"
          : `0 0 20px -4px ${theme.glowColor}, 0 16px 30px -14px rgba(0,0,0,0.6)`,
        cursor: "pointer", transition: "transform 90ms cubic-bezier(.4,0,.2,1)",
      }}
    >
      {isFeatured ? (
        <div style={s.motwStrip}>
          <span style={s.motwBadgeIcon}>⭐</span>
          <div style={s.motwTextCol}>
            <span style={s.motwTag}>Meci al săptămânii{featuredIndex ? ` · ${featuredIndex} din 3` : ""}</span>
            <span style={s.motwSub}>Punctaj dublat ×2</span>
          </div>
        </div>
      ) : (
        <CompetitionHeaderStrip match={match} rightSlot={statusTag} />
      )}

      <div style={{ padding: "14px 15px 16px" }}>
        {isFeatured && <div style={s.topRow}><span /><span>{statusTag}</span></div>}

        <div style={s.teamsRow}>
          <ClubLogo teamName={match.homeTeam} size={32} />
          <div style={s.namesCol}>
            <span style={s.teamName}>{match.homeTeam}</span>
            <span style={s.teamName}>{match.awayTeam}</span>
          </div>
          <ClubLogo teamName={match.awayTeam} size={32} />
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
  motwStrip: {
    padding: "12px 14px", display: "flex", alignItems: "center", gap: 9,
    background: "linear-gradient(90deg, rgba(212,175,55,0.4), rgba(212,175,55,0.14))",
    border: "1.5px solid #D4AF37", borderRadius: "14px 14px 0 0",
    boxShadow: "0 0 18px -4px rgba(212,175,55,0.6)",
  },
  motwBadgeIcon: { fontSize: 19, flexShrink: 0, filter: "drop-shadow(0 0 6px rgba(212,175,55,0.7))" },
  motwTextCol: { display: "flex", flexDirection: "column", gap: 1 },
  motwTag: { fontSize: 11.5, fontWeight: 800, letterSpacing: "0.02em", color: "#FFE9A8", fontFamily: font.display, textTransform: "uppercase" },
  motwSub: { fontSize: 9.5, fontWeight: 700, color: "rgba(255,233,168,0.75)", fontFamily: font.body },
  topRow: { display: "flex", alignItems: "center", justifyContent: "flex-end", marginBottom: 11 },
  tag: {
    fontSize: 8.5, fontWeight: 700, letterSpacing: "0.03em", padding: "3px 8px", borderRadius: 999,
    fontFamily: font.body, whiteSpace: "nowrap", flexShrink: 0,
  },
  teamsRow: { display: "flex", alignItems: "center", gap: 11, marginBottom: 12, marginTop: 3 },
  namesCol: { display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 0 },
  teamName: {
    fontSize: 12.5, color: color.textPrimary, fontWeight: 700, fontFamily: font.body,
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
  },
  bottomRow: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
  lockLabel: { fontSize: 9, color: color.textFaint, fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", marginBottom: 2 },
  countdownBig: { fontSize: 13.5, color: color.goldLight, fontWeight: 800, fontFamily: font.display },
  time: { fontSize: 11.5, color: color.textSecondary, fontWeight: 600, fontFamily: font.body },
  countdown: { fontSize: 10.5, color: color.goldLight, fontWeight: 700, fontFamily: font.body },
  lockedTag: {
    fontSize: 9.5, fontWeight: 800, letterSpacing: "0.03em", color: "#F0555A",
    background: "rgba(240,85,90,0.13)", borderRadius: 999, padding: "3px 9px", fontFamily: font.body,
  },
  score: { fontSize: 17, color: color.textPrimary, fontWeight: 800, fontFamily: font.display },
};
