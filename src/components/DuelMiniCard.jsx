import PlayerAvatar from "./PlayerAvatar";
import { color, font, radius } from "../matchdayTheme";

// ── Un rând compact per pereche — folosit pentru TOATE duelurile care NU
// sunt al userului curent (acela are propria experiență mare, dramatică,
// mai sus). Aceeași sursă de date (liveScores, resolved), doar prezentare
// mult mai mică. ──
export default function DuelMiniCard({ playerA, playerB, profiles, liveScores, resolved, results }) {
  const profA = profiles[playerA] || {};
  const profB = profiles[playerB] || {};
  const scoreA = liveScores[playerA] ?? 0;
  const scoreB = liveScores[playerB] ?? 0;
  const leading = resolved ? null : (scoreA > scoreB ? "a" : scoreA < scoreB ? "b" : "tie");
  const pointsA = results?.[playerA]?.mainPoints;
  const pointsB = results?.[playerB]?.mainPoints;

  return (
    <div style={s.row}>
      <div style={{ ...s.player, ...(leading === "a" ? s.playerLeading : {}) }}>
        <PlayerAvatar avatarId={profA.avatarId} nickname={profA.nickname} size={28} />
        <span style={s.name}>{profA.nickname || playerA}</span>
        <span style={s.score}>{resolved ? `${pointsA ?? 0}p` : `${scoreA}p`}</span>
      </div>
      <span style={s.vs}>vs</span>
      <div style={{ ...s.player, ...s.playerRight, ...(leading === "b" ? s.playerLeading : {}) }}>
        <span style={s.score}>{resolved ? `${pointsB ?? 0}p` : `${scoreB}p`}</span>
        <span style={s.name}>{profB.nickname || playerB}</span>
        <PlayerAvatar avatarId={profB.avatarId} nickname={profB.nickname} size={28} />
      </div>
    </div>
  );
}

const s = {
  row: {
    display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
    background: "rgba(255,255,255,0.025)", border: `1px solid ${color.border}`, borderRadius: radius.sm,
  },
  player: { display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0, borderRadius: 8, padding: "3px 5px" },
  playerRight: { flexDirection: "row-reverse" },
  playerLeading: { background: "rgba(139,217,87,0.1)" },
  name: {
    fontSize: 10.5, fontWeight: 600, color: color.textSecondary, fontFamily: font.body,
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
  },
  score: { fontSize: 11.5, fontWeight: 800, color: color.goldLight, fontFamily: font.body, flexShrink: 0 },
  vs: { fontSize: 9, color: color.textFaint, fontFamily: font.body, flexShrink: 0 },
};
