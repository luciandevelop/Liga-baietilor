import PlayerAvatar from "./PlayerAvatar";
import { color, font, radius } from "../matchdayTheme";

// ── Experiența Duelului — confruntare dramatică, 2 avataruri mari, VS
// central. Scorurile DIN ETAPĂ (nu seasonPoints), actualizate live din
// afară (props), nu recalculate aici. Rezolvarea (200/0 sau 100/100) vine
// tot din afară, ca sursă unică — componenta doar AFIȘEAZĂ. ──
export default function DuelExperience({ myUid, opponentUid, isBye, profiles, liveScores, resolved, myPoints }) {
  if (isBye) {
    return (
      <div style={s.byeWrap}>
        <div style={s.byeIcon}>🎟️</div>
        <div style={s.byeTitle}>BYE — număr impar de jucători</div>
        <div style={s.byePoints}>+100p garantat</div>
      </div>
    );
  }

  const myProfile = profiles[myUid] || {};
  const oppProfile = profiles[opponentUid] || {};
  const myScore = liveScores[myUid] ?? 0;
  const oppScore = liveScores[opponentUid] ?? 0;
  const leading = resolved ? null : (myScore > oppScore ? "me" : myScore < oppScore ? "opp" : "tie");

  return (
    <div style={s.wrap}>
      <div style={s.confrontation}>
        <div style={{ ...s.side, ...(leading === "me" ? s.sideLeading : {}) }}>
          <PlayerAvatar avatarId={myProfile.avatarId} nickname={myProfile.nickname} size={64} />
          <div style={s.name}>{myProfile.nickname || myUid} (tu)</div>
          <div style={s.score}>{myScore}p</div>
        </div>

        <div style={s.vsWrap}>
          <div style={s.vsCircle}>VS</div>
        </div>

        <div style={{ ...s.side, ...(leading === "opp" ? s.sideLeading : {}) }}>
          <PlayerAvatar avatarId={oppProfile.avatarId} nickname={oppProfile.nickname} size={64} />
          <div style={s.name}>{oppProfile.nickname || opponentUid}</div>
          <div style={s.score}>{oppScore}p</div>
        </div>
      </div>

      {!resolved && leading === "tie" && <div style={s.tieNote}>Egalitate momentan</div>}

      {resolved && (
        <div style={s.resolvedBox}>
          {myPoints === 100 ? (
            <>
              <div style={s.resolvedIcon}>🤝</div>
              <div style={s.resolvedTitle}>EGALITATE</div>
              <div style={s.resolvedPoints}>+100p</div>
            </>
          ) : myPoints === 200 ? (
            <>
              <div style={s.resolvedIcon}>🏆</div>
              <div style={s.resolvedTitle}>CÂȘTIGĂTOR</div>
              <div style={s.resolvedPoints}>+200p</div>
            </>
          ) : (
            <>
              <div style={s.resolvedIconLose}>💔</div>
              <div style={s.resolvedTitleLose}>ÎNFRÂNGERE</div>
              <div style={s.resolvedPointsLose}>+0p</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const s = {
  wrap: {
    background: "linear-gradient(180deg, rgba(212,175,55,0.08) 0%, rgba(18,20,28,0.95) 40%, rgba(10,11,16,0.98) 100%)",
    border: "1px solid rgba(212,175,55,0.3)", borderRadius: radius.lg, padding: "22px 16px",
    boxShadow: "0 0 40px -8px rgba(212,175,55,0.2)",
  },
  confrontation: { display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 4 },
  side: { display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: 120, padding: "8px 4px", borderRadius: radius.md, transition: "background 300ms" },
  sideLeading: { background: "rgba(139,217,87,0.08)", border: "1px solid rgba(139,217,87,0.3)" },
  name: { fontSize: 12, fontWeight: 700, color: color.textPrimary, fontFamily: font.body, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 110 },
  score: { fontFamily: font.display, fontSize: 22, fontWeight: 800, color: color.goldLight },
  vsWrap: { display: "flex", alignItems: "center", justifyContent: "center", height: 64, flexShrink: 0, width: 50 },
  vsCircle: {
    width: 38, height: 38, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
    background: "radial-gradient(circle, rgba(240,85,90,0.25), rgba(240,85,90,0.05))", border: "1.5px solid rgba(240,85,90,0.5)",
    fontFamily: font.display, fontWeight: 800, fontSize: 13, color: "#F0555A",
  },
  tieNote: { textAlign: "center", fontSize: 11, color: color.textFaint, fontFamily: font.body, marginTop: 14 },

  resolvedBox: { textAlign: "center", marginTop: 18, paddingTop: 16, borderTop: "1px solid rgba(212,175,55,0.2)" },
  resolvedIcon: { fontSize: 30, marginBottom: 4 },
  resolvedTitle: { fontFamily: font.display, fontSize: 15, fontWeight: 800, color: color.goldLight, letterSpacing: "0.03em" },
  resolvedPoints: { fontFamily: font.display, fontSize: 20, fontWeight: 800, color: color.goldLight, marginTop: 2 },
  resolvedIconLose: { fontSize: 30, marginBottom: 4, opacity: 0.6 },
  resolvedTitleLose: { fontFamily: font.display, fontSize: 15, fontWeight: 800, color: color.textFaint, letterSpacing: "0.03em" },
  resolvedPointsLose: { fontFamily: font.display, fontSize: 20, fontWeight: 800, color: color.textFaint, marginTop: 2 },

  byeWrap: {
    textAlign: "center", padding: "30px 16px", background: "rgba(212,175,55,0.06)",
    border: "1px solid rgba(212,175,55,0.25)", borderRadius: radius.lg,
  },
  byeIcon: { fontSize: 36, marginBottom: 8 },
  byeTitle: { fontSize: 13, fontWeight: 700, color: color.textPrimary, fontFamily: font.body },
  byePoints: { fontFamily: font.display, fontSize: 22, fontWeight: 800, color: color.goldLight, marginTop: 8 },
};
