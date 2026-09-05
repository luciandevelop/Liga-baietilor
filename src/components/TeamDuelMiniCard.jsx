import PlayerAvatar from "./PlayerAvatar";
import DuelFighterPortrait from "./DuelFighterPortrait";
import { color, font, radius } from "../matchdayTheme";
import { teamScore } from "../services/scoringEngine";

// ── Rând compact per confruntare de echipă — pentru grupurile care NU
// sunt al userului curent. Suportă echipe de 2, 3 sau 4 (Duel de Echipe
// nu mai are Bye/Duel separat, dar mărimea variază). Cu temă aleasă,
// avatarul rotund normal devine thumbnail dreptunghiular mic. ──
export default function TeamDuelMiniCard({ teamA, teamB, profiles, liveScores, resolved, results, duelTheme }) {
  const scoreA = teamScore(teamA, liveScores);
  const scoreB = teamScore(teamB, liveScores);
  const leading = resolved ? null : (scoreA > scoreB ? "a" : scoreA < scoreB ? "b" : "tie");
  const pointsA = results?.[teamA[0]]?.mainPoints;
  const pointsB = results?.[teamB[0]]?.mainPoints;

  const namesA = teamA.map((uid) => profiles[uid]?.nickname || uid).join(" & ");
  const namesB = teamB.map((uid) => profiles[uid]?.nickname || uid).join(" & ");

  return (
    <div style={s.row}>
      <div style={{ ...s.team, ...(leading === "a" ? s.teamLeading : {}) }}>
        <div style={s.avatarsInline}>
          {teamA.map((uid) => duelTheme ? (
            <DuelFighterPortrait key={uid} avatarId={profiles[uid]?.avatarId} nickname={profiles[uid]?.nickname} theme={duelTheme} width={16} height={20} fallbackSize={20} borderRadius={4} />
          ) : (
            <PlayerAvatar key={uid} avatarId={profiles[uid]?.avatarId} nickname={profiles[uid]?.nickname} size={20} />
          ))}
        </div>
        <span style={s.names}>{namesA}</span>
        <span style={s.score}>{resolved ? `${pointsA ?? 0}p` : `${scoreA}p`}</span>
      </div>
      <span style={s.vs}>vs</span>
      <div style={{ ...s.team, ...s.teamRight, ...(leading === "b" ? s.teamLeading : {}) }}>
        <span style={s.score}>{resolved ? `${pointsB ?? 0}p` : `${scoreB}p`}</span>
        <span style={s.names}>{namesB}</span>
        <div style={s.avatarsInline}>
          {teamB.map((uid) => duelTheme ? (
            <DuelFighterPortrait key={uid} avatarId={profiles[uid]?.avatarId} nickname={profiles[uid]?.nickname} theme={duelTheme} width={16} height={20} fallbackSize={20} borderRadius={4} />
          ) : (
            <PlayerAvatar key={uid} avatarId={profiles[uid]?.avatarId} nickname={profiles[uid]?.nickname} size={20} />
          ))}
        </div>
      </div>
    </div>
  );
}

const s = {
  row: {
    display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
    background: "rgba(255,255,255,0.025)", border: `1px solid ${color.border}`, borderRadius: radius.sm,
  },
  team: { display: "flex", alignItems: "center", gap: 4, flex: 1, minWidth: 0, borderRadius: 8, padding: "3px 5px" },
  teamRight: { flexDirection: "row-reverse" },
  teamLeading: { background: "rgba(139,217,87,0.1)" },
  avatarsInline: { display: "flex", gap: 1, flexShrink: 0 },
  names: {
    fontSize: 9.5, fontWeight: 600, color: color.textSecondary, fontFamily: font.body,
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
  },
  score: { fontSize: 11.5, fontWeight: 800, color: color.goldLight, fontFamily: font.body, flexShrink: 0 },
  vs: { fontSize: 9, color: color.textFaint, fontFamily: font.body, flexShrink: 0 },
};
