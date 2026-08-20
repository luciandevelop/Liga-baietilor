import { color, font, radius } from "../theme";
import PlayerAvatar from "./PlayerAvatar";

const MEDAL = { 1: "🥇", 2: "🥈", 3: "🥉" };

export default function PlayerRankRow({ rank, nickname, avatarId, pointsFromMatches, rankingBonus, totalPoints, surprisePoints, onClick, top3, showBonus = true }) {
  // Când etapa e activă (showBonus=false), "punctele reale" sunt DOAR cele
  // din meciuri — bonusul de poziție nu există încă vizual, nu doar
  // ascuns ca cifră separată în timp ce totalul îl include pe ascuns.
  const displayTotal = showBonus ? totalPoints : pointsFromMatches;

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
      {showBonus && pointsFromMatches !== undefined && <span style={s.pts}>{pointsFromMatches}p</span>}
      {showBonus && rankingBonus !== undefined && (
        <span style={{ ...s.bonus, color: rankingBonus >= 0 ? color.green : color.red }}>
          {rankingBonus >= 0 ? "+" : ""}{rankingBonus}p
        </span>
      )}
      {surprisePoints !== undefined && surprisePoints > 0 && (
        <span style={s.surpriseBadge}>🎭 +{surprisePoints}p</span>
      )}
      <span style={s.total}>{displayTotal}p</span>
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
  surpriseBadge: {
    fontSize: 10, fontWeight: 800, color: "#D4AF37", flexShrink: 0,
    background: "rgba(212,175,55,0.12)", border: "1px solid rgba(212,175,55,0.35)", borderRadius: 999, padding: "2px 6px",
  },
  total: {
    fontSize: 14.5, fontWeight: 700, color: color.goldLight, flexShrink: 0, width: 54,
    textAlign: "right", fontFamily: font.display,
  },
};
