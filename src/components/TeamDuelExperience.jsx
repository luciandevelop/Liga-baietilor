import PlayerAvatar from "./PlayerAvatar";
import { color, font, radius } from "../matchdayTheme";

// ── Regula de scor a unei părți — identică cu ce se calculează la
// Resolve (surprisesService.js): sub 3 membri, suma tuturor; 3+, se
// exclude cel clasat la mijloc (floor(n/2)+1) din comparație — el
// rămâne vizibil în echipă, doar nu-i "contează" scorul aici. ──
function teamScore(members, liveScores) {
  if (members.length <= 2) return members.reduce((s, uid) => s + (liveScores[uid] ?? 0), 0);
  const sorted = [...members].sort((a, b) => (liveScores[b] ?? 0) - (liveScores[a] ?? 0));
  const excludeIdx = Math.floor(members.length / 2) + 1 - 1;
  return sorted.reduce((s, uid, i) => (i === excludeIdx ? s : s + (liveScores[uid] ?? 0)), 0);
}

function excludedUid(members, liveScores) {
  if (members.length <= 2) return null;
  const sorted = [...members].sort((a, b) => (liveScores[b] ?? 0) - (liveScores[a] ?? 0));
  return sorted[Math.floor(members.length / 2) + 1 - 1];
}

function TeamCol({ members, excluded, leading, score, profiles }) {
  return (
    <div style={{ ...s.side, ...(leading ? s.sideLeading : {}) }}>
      <div style={s.teamAvatars}>
        {members.map((uid) => (
          <div key={uid} style={s.avatarRing}>
            <PlayerAvatar avatarId={profiles[uid]?.avatarId} nickname={profiles[uid]?.nickname} size={members.length > 2 ? 42 : 54} />
            {excluded === uid && <span style={s.excludedCrown}>👑</span>}
          </div>
        ))}
      </div>
      <div style={s.teamNames}>{members.map((uid) => profiles[uid]?.nickname || uid).join(" & ")}</div>
      <div style={s.score}>{score}<span style={s.scoreUnit}>p</span></div>
      {leading && <div style={s.leadTag}>ÎN AVANTAJ</div>}
    </div>
  );
}

// ── Fallback pentru grupuri sub 4 jucători — Duel 1v1 clasic. ──
function SingleVsSingle({ myUid, opponentUid, profiles, liveScores, resolved, myPoints }) {
  const myProfile = profiles[myUid] || {};
  const oppProfile = profiles[opponentUid] || {};
  const myScore = liveScores[myUid] ?? 0;
  const oppScore = liveScores[opponentUid] ?? 0;
  const leading = resolved ? null : (myScore > oppScore ? "me" : myScore < oppScore ? "opp" : "tie");

  return (
    <>
      <div style={s.confrontation}>
        <div style={{ ...s.side, ...(leading === "me" ? s.sideLeading : {}) }}>
          <PlayerAvatar avatarId={myProfile.avatarId} nickname={myProfile.nickname} size={66} />
          <div style={s.teamNames}>{myProfile.nickname || myUid} (tu)</div>
          <div style={s.score}>{myScore}p</div>
        </div>
        <div style={s.vsWrap}><div style={s.vsCircle}>VS</div></div>
        <div style={{ ...s.side, ...(leading === "opp" ? s.sideLeading : {}) }}>
          <PlayerAvatar avatarId={oppProfile.avatarId} nickname={oppProfile.nickname} size={66} />
          <div style={s.teamNames}>{oppProfile.nickname || opponentUid}</div>
          <div style={s.score}>{oppScore}p</div>
        </div>
      </div>
      {resolved && (
        <div style={s.resolvedBox}>
          {myPoints === 100 ? (
            <><div style={s.resolvedIcon}>🤝</div><div style={s.resolvedTitle}>EGALITATE</div><div style={s.resolvedPoints}>+100p</div></>
          ) : myPoints === 200 ? (
            <><div style={s.resolvedIcon}>🏆</div><div style={s.resolvedTitle}>CÂȘTIGĂTOR</div><div style={s.resolvedPoints}>+200p</div></>
          ) : (
            <><div style={s.resolvedIconLose}>💔</div><div style={s.resolvedTitleLose}>ÎNFRÂNGERE</div><div style={s.resolvedPointsLose}>+0p</div></>
          )}
        </div>
      )}
    </>
  );
}

export default function TeamDuelExperience({ myUid, myTeam, opponentTeam, isFallbackDuel, fallbackOpponent, isFallbackBye, profiles, liveScores, resolved, myPoints }) {
  if (isFallbackBye) {
    return (
      <div style={s.byeWrap}>
        <div style={s.byeGlow} />
        <div style={s.byeIcon}>🎟️</div>
        <div style={s.byeTitle}>BYE — prea puțini jucători pentru echipe</div>
        <div style={s.byePoints}>+100p garantat</div>
      </div>
    );
  }

  if (isFallbackDuel) {
    return (
      <div style={s.wrap}>
        <div style={s.extraDuelNote}>Prea puțini jucători pentru echipe — Duel 1v1</div>
        <SingleVsSingle myUid={myUid} opponentUid={fallbackOpponent} profiles={profiles} liveScores={liveScores} resolved={resolved} myPoints={myPoints} />
      </div>
    );
  }

  const myScore = teamScore(myTeam, liveScores);
  const oppScore = teamScore(opponentTeam, liveScores);
  const leading = resolved ? null : (myScore > oppScore ? "me" : myScore < oppScore ? "opp" : "tie");
  const myPreview = resolved ? myPoints : (leading === "me" ? 200 : leading === "opp" ? 0 : 100);
  const myExcluded = excludedUid(myTeam, liveScores);
  const oppExcluded = excludedUid(opponentTeam, liveScores);

  return (
    <div style={s.wrap}>
      <style>{`
        @keyframes tduPulse { 0%,100% { box-shadow: 0 0 0px 0px rgba(139,217,87,0.4); } 50% { box-shadow: 0 0 24px 4px rgba(139,217,87,0.35); } }
        @keyframes tduGlowBg { 0%,100% { opacity: 0.5; } 50% { opacity: 0.9; } }
      `}</style>
      <div style={s.bgGlow} />

      <div style={s.confrontation}>
        <TeamCol members={myTeam} excluded={myExcluded} leading={leading === "me"} score={myScore} profiles={profiles} />
        <div style={s.vsWrap}><div style={s.vsCircle}><span style={s.vsShine} />VS</div></div>
        <TeamCol members={opponentTeam} excluded={oppExcluded} leading={leading === "opp"} score={oppScore} profiles={profiles} />
      </div>

      {(myTeam.length > 2 || opponentTeam.length > 2) && (
        <div style={s.excludeNote}>👑 = scor exclus din comparație (mijlocul clasamentului intern), rămâne în echipă</div>
      )}

      {!resolved && (
        <div style={s.previewRow}>
          <span style={s.previewLabel}>{leading === "tie" ? "Egalitate momentan" : "Dacă s-ar termina acum"}</span>
          <span style={s.previewPoints}>+{myPreview}p pentru fiecare din echipa ta</span>
        </div>
      )}

      {resolved && (
        <div style={s.resolvedBox}>
          {myPoints === 100 ? (
            <><div style={s.resolvedIcon}>🤝</div><div style={s.resolvedTitle}>EGALITATE</div><div style={s.resolvedPoints}>+100p</div></>
          ) : myPoints === 200 ? (
            <><div style={s.resolvedIcon}>🏆</div><div style={s.resolvedTitle}>ECHIPĂ CÂȘTIGĂTOARE</div><div style={s.resolvedPoints}>+200p</div></>
          ) : (
            <><div style={s.resolvedIconLose}>💔</div><div style={s.resolvedTitleLose}>ÎNFRÂNGERE</div><div style={s.resolvedPointsLose}>+0p</div></>
          )}
        </div>
      )}
    </div>
  );
}

const s = {
  wrap: {
    position: "relative", overflow: "hidden",
    background: "linear-gradient(180deg, rgba(212,175,55,0.1) 0%, rgba(18,20,28,0.97) 38%, rgba(8,9,13,0.99) 100%)",
    border: "1px solid rgba(212,175,55,0.35)", borderRadius: radius.lg, padding: "22px 14px 20px",
    boxShadow: "0 0 50px -6px rgba(212,175,55,0.25), inset 0 1px 0 rgba(255,255,255,0.06)",
  },
  bgGlow: {
    position: "absolute", top: "-20%", left: "50%", transform: "translateX(-50%)", width: 260, height: 260,
    background: "radial-gradient(circle, rgba(240,85,90,0.18), transparent 70%)", animation: "tduGlowBg 3s ease-in-out infinite",
    pointerEvents: "none",
  },
  extraDuelNote: { fontSize: 10.5, color: color.textFaint, fontFamily: font.body, textAlign: "center", marginBottom: 12 },
  confrontation: { position: "relative", display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 2 },
  side: { display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: 150, padding: "10px 4px", borderRadius: radius.md, transition: "all 300ms" },
  sideLeading: { background: "rgba(139,217,87,0.09)", border: "1px solid rgba(139,217,87,0.35)", animation: "tduPulse 2s ease-in-out infinite" },
  teamAvatars: { display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 2, maxWidth: 140 },
  avatarRing: {
    position: "relative", padding: 2, borderRadius: "50%",
    background: "linear-gradient(135deg, rgba(212,175,55,0.5), rgba(212,175,55,0.05))",
    marginLeft: -8, border: "2px solid rgba(10,11,16,0.9)",
  },
  excludedCrown: { position: "absolute", top: -8, right: -4, fontSize: 13 },
  teamNames: {
    fontSize: 10.5, fontWeight: 700, color: color.textPrimary, fontFamily: font.body, textAlign: "center",
    overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", maxWidth: 140,
  },
  score: { fontFamily: font.display, fontSize: 24, fontWeight: 800, color: color.goldLight, textShadow: "0 0 16px rgba(212,175,55,0.5)" },
  scoreUnit: { fontSize: 12, opacity: 0.7, marginLeft: 1 },
  leadTag: { fontSize: 8.5, fontWeight: 800, letterSpacing: "0.06em", color: "#8BD957" },

  vsWrap: { display: "flex", alignItems: "center", justifyContent: "center", height: 78, flexShrink: 0, width: 36 },
  vsCircle: {
    position: "relative", overflow: "hidden", width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
    background: "radial-gradient(circle, rgba(240,85,90,0.3), rgba(240,85,90,0.08))", border: "1.5px solid rgba(240,85,90,0.55)",
    fontFamily: font.display, fontWeight: 800, fontSize: 12, color: "#FF6B70", boxShadow: "0 0 18px -2px rgba(240,85,90,0.6)",
  },
  vsShine: { position: "absolute", top: 0, left: 0, width: "40%", height: "200%", background: "rgba(255,255,255,0.35)" },

  excludeNote: { fontSize: 9.5, color: color.textFaint, fontFamily: font.body, textAlign: "center", marginTop: 10 },

  previewRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 18, paddingTop: 14, borderTop: "1px solid rgba(212,175,55,0.18)" },
  previewLabel: { fontSize: 10.5, color: color.textFaint, fontFamily: font.body },
  previewPoints: { fontSize: 11.5, fontWeight: 800, color: color.goldLight, fontFamily: font.body },

  resolvedBox: { textAlign: "center", marginTop: 18, paddingTop: 16, borderTop: "1px solid rgba(212,175,55,0.2)" },
  resolvedIcon: { fontSize: 34, marginBottom: 4, filter: "drop-shadow(0 0 10px rgba(212,175,55,0.6))" },
  resolvedTitle: { fontFamily: font.display, fontSize: 15, fontWeight: 800, color: color.goldLight, letterSpacing: "0.03em" },
  resolvedPoints: { fontFamily: font.display, fontSize: 24, fontWeight: 800, color: color.goldLight, marginTop: 2, textShadow: "0 0 20px rgba(212,175,55,0.5)" },
  resolvedIconLose: { fontSize: 30, marginBottom: 4, opacity: 0.55 },
  resolvedTitleLose: { fontFamily: font.display, fontSize: 14, fontWeight: 800, color: color.textFaint, letterSpacing: "0.03em" },
  resolvedPointsLose: { fontFamily: font.display, fontSize: 20, fontWeight: 800, color: color.textFaint, marginTop: 2 },

  byeWrap: { position: "relative", overflow: "hidden", textAlign: "center", padding: "34px 16px", background: "rgba(212,175,55,0.07)", border: "1px solid rgba(212,175,55,0.3)", borderRadius: radius.lg },
  byeGlow: { position: "absolute", top: "-30%", left: "50%", transform: "translateX(-50%)", width: 200, height: 200, background: "radial-gradient(circle, rgba(212,175,55,0.2), transparent 70%)" },
  byeIcon: { fontSize: 38, marginBottom: 8, position: "relative" },
  byeTitle: { fontSize: 13, fontWeight: 700, color: color.textPrimary, fontFamily: font.body, position: "relative" },
  byePoints: { fontFamily: font.display, fontSize: 24, fontWeight: 800, color: color.goldLight, marginTop: 8, position: "relative", textShadow: "0 0 16px rgba(212,175,55,0.5)" },
};
