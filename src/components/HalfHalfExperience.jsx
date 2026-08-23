import { color, font, radius } from "../matchdayTheme";

// ── Scor + exclus — DOAR din partea mai numeroasă (spre deosebire de
// Duel de Echipe, unde ambele părți pot exclude). Aceeași formulă,
// aplicată condiționat. ──
function halfScore(members, isLarger, liveScores) {
  if (!isLarger) return members.reduce((s, uid) => s + (liveScores[uid] ?? 0), 0);
  const sorted = [...members].sort((a, b) => (liveScores[b] ?? 0) - (liveScores[a] ?? 0));
  const excludeIdx = Math.floor(members.length / 2) + 1 - 1;
  return sorted.reduce((s, uid, i) => (i === excludeIdx ? s : s + (liveScores[uid] ?? 0)), 0);
}

function excludedUid(members, isLarger, liveScores) {
  if (!isLarger) return null;
  const sorted = [...members].sort((a, b) => (liveScores[b] ?? 0) - (liveScores[a] ?? 0));
  return sorted[Math.floor(members.length / 2) + 1 - 1];
}

export default function HalfHalfExperience({ myUid, top, bottom, isTopVariant, profiles, liveScores, resolved, myPoints }) {
  const topIsLarger = top.length > bottom.length;
  const bottomIsLarger = bottom.length > top.length;
  const sTop = halfScore(top, topIsLarger, liveScores);
  const sBottom = halfScore(bottom, bottomIsLarger, liveScores);
  const topExcluded = excludedUid(top, topIsLarger, liveScores);
  const bottomExcluded = excludedUid(bottom, bottomIsLarger, liveScores);

  const myInTop = top.includes(myUid);
  const leading = resolved ? null : (sTop > sBottom ? "top" : sTop < sBottom ? "bottom" : "tie");
  const myLeading = leading === (myInTop ? "top" : "bottom");
  const myPreview = resolved ? myPoints : (leading === "tie" ? 100 : myLeading ? 200 : 0);

  return (
    <div style={s.wrap}>
      <style>{`
        @keyframes hhPulse { 0%,100% { box-shadow: 0 0 0px 0px rgba(139,217,87,0.3); } 50% { box-shadow: 0 0 20px 3px rgba(139,217,87,0.3); } }
      `}</style>

      <div style={s.columns}>
        <HalfCol
          title={isTopVariant ? "🔵 SUS" : "🔵 Echipa 1"}
          members={top} excluded={topExcluded} score={sTop} leading={leading === "top"}
          mine={myInTop} profiles={profiles}
        />
        <HalfCol
          title={isTopVariant ? "🟠 JOS" : "🟠 Echipa 2"}
          members={bottom} excluded={bottomExcluded} score={sBottom} leading={leading === "bottom"}
          mine={!myInTop} profiles={profiles}
        />
      </div>

      {(topIsLarger || bottomIsLarger) && (
        <div style={s.excludeNote}>👑 = scor exclus din comparație (mijlocul clasamentului intern al taberei mai mari), rămâne în echipă</div>
      )}

      {!resolved && (
        <div style={s.previewRow}>
          <span style={s.previewLabel}>{leading === "tie" ? "Egalitate momentan" : "Dacă s-ar termina acum"}</span>
          <span style={s.previewPoints}>+{myPreview}p pentru tine</span>
        </div>
      )}

      {resolved && (
        <div style={s.resolvedBox}>
          {myPoints === 100 ? (
            <><div style={s.resolvedIcon}>🤝</div><div style={s.resolvedTitle}>EGALITATE</div><div style={s.resolvedPoints}>+100p</div></>
          ) : myPoints === 200 ? (
            <><div style={s.resolvedIcon}>🏆</div><div style={s.resolvedTitle}>TABĂRA TA A CÂȘTIGAT</div><div style={s.resolvedPoints}>+200p</div></>
          ) : (
            <><div style={s.resolvedIconLose}>💔</div><div style={s.resolvedTitleLose}>ÎNFRÂNGERE</div><div style={s.resolvedPointsLose}>+0p</div></>
          )}
        </div>
      )}
    </div>
  );
}

function HalfCol({ title, members, excluded, score, leading, mine, profiles }) {
  return (
    <div style={{ ...s.col, ...(leading ? s.colLeading : {}) }}>
      <div style={s.colTitle}>{title}{mine ? " (tabăra ta)" : ""}</div>
      <div style={s.colScore}>{score}<span style={s.colScoreUnit}>p</span></div>
      {leading && <div style={s.leadTag}>ÎN AVANTAJ</div>}
      <div style={s.memberList}>
        {members.map((uid) => (
          <div key={uid} style={s.memberRow}>
            <span style={s.memberName}>{profiles[uid]?.nickname || uid}</span>
            {excluded === uid && <span style={s.memberCrown}>👑</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

const s = {
  wrap: {
    background: "linear-gradient(180deg, rgba(212,175,55,0.08) 0%, rgba(18,20,28,0.97) 40%, rgba(8,9,13,0.99) 100%)",
    border: "1px solid rgba(212,175,55,0.3)", borderRadius: radius.lg, padding: "16px 12px",
    boxShadow: "0 0 40px -8px rgba(212,175,55,0.2)",
  },
  columns: { display: "flex", gap: 8 },
  col: { flex: 1, minWidth: 0, borderRadius: radius.md, padding: "12px 8px", background: "rgba(255,255,255,0.02)", border: `1px solid ${color.border}`, transition: "all 300ms" },
  colLeading: { background: "rgba(139,217,87,0.08)", border: "1px solid rgba(139,217,87,0.35)", animation: "hhPulse 2.4s ease-in-out infinite" },
  colTitle: { fontSize: 11, fontWeight: 800, color: color.textPrimary, fontFamily: font.body, textAlign: "center", marginBottom: 4 },
  colScore: { fontFamily: font.display, fontSize: 24, fontWeight: 800, color: color.goldLight, textAlign: "center", textShadow: "0 0 14px rgba(212,175,55,0.4)" },
  colScoreUnit: { fontSize: 12, opacity: 0.7 },
  leadTag: { fontSize: 8.5, fontWeight: 800, letterSpacing: "0.05em", color: "#8BD957", textAlign: "center", marginTop: 2, marginBottom: 6 },
  memberList: { marginTop: 8, display: "flex", flexDirection: "column", gap: 2 },
  memberRow: { display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 10, color: color.textSecondary, fontFamily: font.body, padding: "2px 4px" },
  memberName: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  memberCrown: { fontSize: 10, flexShrink: 0, marginLeft: 4 },

  excludeNote: { fontSize: 9.5, color: color.textFaint, fontFamily: font.body, textAlign: "center", marginTop: 12 },

  previewRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, paddingTop: 12, borderTop: "1px solid rgba(212,175,55,0.18)" },
  previewLabel: { fontSize: 10.5, color: color.textFaint, fontFamily: font.body },
  previewPoints: { fontSize: 12, fontWeight: 800, color: color.goldLight, fontFamily: font.body },

  resolvedBox: { textAlign: "center", marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(212,175,55,0.2)" },
  resolvedIcon: { fontSize: 32, marginBottom: 4, filter: "drop-shadow(0 0 10px rgba(212,175,55,0.6))" },
  resolvedTitle: { fontFamily: font.display, fontSize: 14, fontWeight: 800, color: color.goldLight, letterSpacing: "0.02em" },
  resolvedPoints: { fontFamily: font.display, fontSize: 22, fontWeight: 800, color: color.goldLight, marginTop: 2, textShadow: "0 0 20px rgba(212,175,55,0.5)" },
  resolvedIconLose: { fontSize: 28, marginBottom: 4, opacity: 0.55 },
  resolvedTitleLose: { fontFamily: font.display, fontSize: 13, fontWeight: 800, color: color.textFaint, letterSpacing: "0.02em" },
  resolvedPointsLose: { fontFamily: font.display, fontSize: 18, fontWeight: 800, color: color.textFaint, marginTop: 2 },
};
