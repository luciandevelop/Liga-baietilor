import { color, font, radius } from "../theme";
import PlayerAvatar from "./PlayerAvatar";

const MEDAL = { 1: "🥇", 2: "🥈", 3: "🥉" };

export default function PlayerRankRow({ rank, nickname, avatarId, pointsFromMatches, rankingBonus, totalPoints, onClick, top3 }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...s.row,
        ...(top3 ? s.rowTop3 : {}),
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <span style={s.rank}>{MEDAL[rank] || `#${rank ?? "–"}`}</span>
      <PlayerAvatar avatarId={avatarId} nickname={nickname} size={26} />
      <span style={s.name}>{nickname}</span>
      {pointsFromMatches !== undefined && <span style={s.pts}>{pointsFromMatches}p</span>}
      {rankingBonus !== undefined && (
        <span style={{ ...s.bonus, color: rankingBonus >= 0 ? color.green : color.red }}>
          {rankingBonus >= 0 ? "+" : ""}{rankingBonus}p
        </span>
      )}
      <span style={s.total}>{totalPoints}p</span>
    </button>
  );
}

const s = {
  row: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    background: color.surfaceInset,
    border: `1px solid ${color.borderSubtle}`,
    borderRadius: radius.md,
    padding: "10px 12px",
    width: "100%",
    cursor: "pointer",
    textAlign: "left",
    fontFamily: font.body,
  },
  rowTop3: {
    background: "linear-gradient(90deg, rgba(201,162,39,0.10), rgba(201,162,39,0.02))",
    border: "1px solid rgba(201,162,39,0.28)",
  },
  rank: { fontSize: 14, fontWeight: 800, color: color.gold, width: 30, flexShrink: 0, fontFamily: font.display },
  name: {
    fontSize: 13.5, fontWeight: 700, color: color.textPrimary, flex: 1, minWidth: 0,
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  pts: { fontSize: 11.5, color: color.textMuted, flexShrink: 0 },
  bonus: { fontSize: 11.5, fontWeight: 700, flexShrink: 0, width: 44, textAlign: "right" },
  total: {
    fontSize: 14.5, fontWeight: 700, color: color.goldLight, flexShrink: 0, width: 54,
    textAlign: "right", fontFamily: font.display,
  },
};
