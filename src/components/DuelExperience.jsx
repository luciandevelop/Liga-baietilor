import PlayerAvatar from "./PlayerAvatar";
import DuelFighterPortrait from "./DuelFighterPortrait";
import { getFighterUrl } from "../assets/fighters";
import { color, font, radius } from "../matchdayTheme";
import { usePrefersReducedMotion, EASING } from "../motion";

// ── Animația de intrare — RULEAZĂ O SINGURĂ DATĂ, la montare (nu în
// buclă — spre deosebire de duelPulse/duelShine/duelGlowBg de mai jos,
// care sunt efecte continue existente, neatinse). Secvență cerută
// explicit: VS apare primul (flash scurt) → fighterul din stânga intră
// din stânga → cel din dreapta, puțin decalat → VS face un ultim puls
// subtil. Durate proprii acestei secvențe compuse (nu din DURATION,
// care acoperă tranziții atomice reutilizabile) — dar respectă restul
// regulilor din motion.js: doar transform/opacity (+ box-shadow o
// singură dată, explicit permis), EASING din sursa unică,
// prefers-reduced-motion sare direct la starea finală (fără
// `animation` deloc — elementele rămân pur și simplu la starea lor
// normală, fără fade/slide). ──
const ENTRANCE = { vs: 0.5, leftDelay: 0.5, leftDur: 0.6, rightDelay: 0.7, rightDur: 0.6, vsPulseDelay: 1.3, vsPulseDur: 0.35 };

// ── Experiența Duelului MEU — mare, sus, dramatică. Glow radial în spate,
// avataruri mari, indicator pulsatoriu pe cel care conduce, VS cu shine.
// Scorurile DIN ETAPĂ (nu seasonPoints), primite din afară — componenta
// doar afișează, nu recalculează nimic.
//
// STAGE B — MAIN EVENT: dacă Adminul a ales o temă de Duel (`duelTheme`)
// PENTRU etapa asta, avatarul rotund normal e înlocuit cu un portret de
// personaj de luptă, mare (vezi DuelFighterPortrait) — panou dreptunghiular
// cu ramă tematică, stil poster de fighting game. Fără temă (sau dacă
// imaginea lipsește pentru cineva), arată EXACT ca înainte de Stage B —
// avatarul rotund normal, aceeași dimensiune, același stil. ──
export default function DuelExperience({ myUid, opponentUid, isBye, profiles, liveScores, resolved, myPoints, duelTheme }) {
  const reducedMotion = usePrefersReducedMotion();

  if (isBye) {
    return (
      <div style={s.byeWrap}>
        <div style={s.byeGlow} />
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
  const myPreview = resolved ? myPoints : (leading === "me" ? 200 : leading === "opp" ? 0 : 100);
  // Fallback-ul e per-jucător, nu global — dacă tema e aleasă dar tocmai
  // ACEST jucător nu are imagine (temă necompletă încă), latura lui arată
  // 100% ca înainte de Stage B (ramă rotundă, avatar normal), nu ca un
  // hibrid "avatar rotund într-o ramă dreptunghiulară de fighter".
  const myFighterUrl = duelTheme ? getFighterUrl(duelTheme, myProfile.avatarId) : null;
  const oppFighterUrl = duelTheme ? getFighterUrl(duelTheme, oppProfile.avatarId) : null;

  const vsEntranceStyle = reducedMotion ? {} : {
    animation: `duelVsFlash ${ENTRANCE.vs}s ${EASING.overshoot} both, duelVsFinalPulse ${ENTRANCE.vsPulseDur}s ${EASING.inOut} ${ENTRANCE.vsPulseDelay}s both`,
  };
  const leftEntranceStyle = reducedMotion ? {} : {
    animation: `duelSideLeftIntro ${ENTRANCE.leftDur}s ${EASING.out} ${ENTRANCE.leftDelay}s both`,
  };
  const rightEntranceStyle = reducedMotion ? {} : {
    animation: `duelSideRightIntro ${ENTRANCE.rightDur}s ${EASING.out} ${ENTRANCE.rightDelay}s both`,
  };

  return (
    <div style={s.wrap}>
      <style>{`
        @keyframes duelPulse { 0%,100% { box-shadow: 0 0 0px 0px rgba(139,217,87,0.4); } 50% { box-shadow: 0 0 24px 4px rgba(139,217,87,0.35); } }
        @keyframes duelShine { 0% { transform: translateX(-120%) rotate(20deg); } 100% { transform: translateX(220%) rotate(20deg); } }
        @keyframes duelGlowBg { 0%,100% { opacity: 0.5; } 50% { opacity: 0.9; } }
        @keyframes duelVsFlash {
          0% { opacity: 0; transform: scale(0.4); box-shadow: 0 0 0px 0px rgba(240,85,90,0); }
          55% { opacity: 1; transform: scale(1.22); box-shadow: 0 0 30px 6px rgba(240,85,90,0.8); }
          100% { opacity: 1; transform: scale(1); box-shadow: 0 0 18px -2px rgba(240,85,90,0.6); }
        }
        @keyframes duelVsFinalPulse { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }
        @keyframes duelSideLeftIntro { 0% { opacity: 0; transform: translateX(-42px) scale(0.94); } 100% { opacity: 1; transform: translateX(0) scale(1); } }
        @keyframes duelSideRightIntro { 0% { opacity: 0; transform: translateX(42px) scale(0.94); } 100% { opacity: 1; transform: translateX(0) scale(1); } }
      `}</style>
      <div style={s.bgGlow} />
      {(!!myFighterUrl || !!oppFighterUrl) && <div style={s.mainEventTag}>⚔️ MAIN EVENT</div>}

      <div style={{ ...s.confrontation, ...(myFighterUrl || oppFighterUrl ? s.confrontationFighter : {}) }}>
        <div style={{ ...s.side, ...(myFighterUrl ? s.sideFighter : {}), ...(leading === "me" ? s.sideLeading : {}), ...leftEntranceStyle }}>
          {myFighterUrl ? (
            <div style={s.fighterFrame}>
              <DuelFighterPortrait avatarId={myProfile.avatarId} nickname={myProfile.nickname} theme={duelTheme} width={104} height={148} fallbackSize={78} borderRadius={9} />
            </div>
          ) : (
            <div style={s.avatarRing}>
              <PlayerAvatar avatarId={myProfile.avatarId} nickname={myProfile.nickname} size={78} />
            </div>
          )}
          <div style={s.name}>{myProfile.nickname || myUid} (tu)</div>
          <div style={s.score}>{myScore}<span style={s.scoreUnit}>p</span></div>
          {leading === "me" && <div style={s.leadTag}>ÎN AVANTAJ</div>}
        </div>

        <div style={s.vsWrap}>
          <div style={{ ...s.vsCircle, ...(myFighterUrl || oppFighterUrl ? s.vsCircleFighter : {}), ...vsEntranceStyle }}>
            <span style={s.vsShine} />
            VS
          </div>
        </div>

        <div style={{ ...s.side, ...(oppFighterUrl ? s.sideFighter : {}), ...(leading === "opp" ? s.sideLeading : {}), ...rightEntranceStyle }}>
          {oppFighterUrl ? (
            <div style={s.fighterFrame}>
              <DuelFighterPortrait avatarId={oppProfile.avatarId} nickname={oppProfile.nickname} theme={duelTheme} width={104} height={148} fallbackSize={78} borderRadius={9} />
            </div>
          ) : (
            <div style={s.avatarRing}>
              <PlayerAvatar avatarId={oppProfile.avatarId} nickname={oppProfile.nickname} size={78} />
            </div>
          )}
          <div style={s.name}>{oppProfile.nickname || opponentUid}</div>
          <div style={s.score}>{oppScore}<span style={s.scoreUnit}>p</span></div>
          {leading === "opp" && <div style={s.leadTag}>ÎN AVANTAJ</div>}
        </div>
      </div>

      {!resolved && (
        <div style={s.previewRow}>
          <span style={s.previewLabel}>{leading === "tie" ? "Egalitate momentan" : "Dacă s-ar termina acum"}</span>
          <span style={s.previewPoints}>+{myPreview}p pentru tine</span>
        </div>
      )}

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
    position: "relative", overflow: "hidden",
    background: "linear-gradient(180deg, rgba(212,175,55,0.1) 0%, rgba(18,20,28,0.97) 38%, rgba(8,9,13,0.99) 100%)",
    border: "1px solid rgba(212,175,55,0.35)", borderRadius: radius.lg, padding: "26px 16px 22px",
    boxShadow: "0 0 50px -6px rgba(212,175,55,0.25), inset 0 1px 0 rgba(255,255,255,0.06)",
  },
  bgGlow: {
    position: "absolute", top: "-20%", left: "50%", transform: "translateX(-50%)", width: 260, height: 260,
    background: "radial-gradient(circle, rgba(240,85,90,0.18), transparent 70%)", animation: "duelGlowBg 3s ease-in-out infinite",
    pointerEvents: "none",
  },
  mainEventTag: {
    position: "relative", textAlign: "center", fontFamily: font.display, fontSize: 11, fontWeight: 800,
    letterSpacing: "0.14em", color: "#FF6B70", marginBottom: 10, textShadow: "0 0 12px rgba(240,85,90,0.5)",
  },
  confrontation: { position: "relative", display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 2 },
  confrontationFighter: { alignItems: "center" },
  side: { display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: 128, padding: "10px 4px", borderRadius: radius.md, transition: "all 300ms" },
  sideFighter: { width: 130 },
  sideLeading: { background: "rgba(139,217,87,0.09)", border: "1px solid rgba(139,217,87,0.35)", animation: "duelPulse 2s ease-in-out infinite" },
  avatarRing: { padding: 3, borderRadius: "50%", background: "linear-gradient(135deg, rgba(212,175,55,0.5), rgba(212,175,55,0.05))" },
  // Ramă dreptunghiulară, stil poster de fighting game — pentru portretul
  // de personaj de luptă (MAIN EVENT). Glow auriu/roșiatic discret,
  // colțuri tăiate ușor prin borderRadius mic, nu rotund ca avatarul.
  fighterFrame: {
    padding: 3, borderRadius: 11,
    background: "linear-gradient(160deg, rgba(212,175,55,0.55), rgba(240,85,90,0.35))",
    boxShadow: "0 8px 22px -8px rgba(0,0,0,0.6), 0 0 20px -4px rgba(212,175,55,0.35)",
  },
  name: {
    fontSize: 12.5, fontWeight: 700, color: color.textPrimary, fontFamily: font.body, textAlign: "center",
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 118,
  },
  score: { fontFamily: font.display, fontSize: 26, fontWeight: 800, color: color.goldLight, textShadow: "0 0 16px rgba(212,175,55,0.5)" },
  scoreUnit: { fontSize: 13, opacity: 0.7, marginLeft: 1 },
  leadTag: { fontSize: 8.5, fontWeight: 800, letterSpacing: "0.06em", color: "#8BD957" },

  vsWrap: { display: "flex", alignItems: "center", justifyContent: "center", height: 78, flexShrink: 0, width: 46 },
  vsCircle: {
    position: "relative", overflow: "hidden", width: 42, height: 42, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
    background: "radial-gradient(circle, rgba(240,85,90,0.3), rgba(240,85,90,0.08))", border: "1.5px solid rgba(240,85,90,0.55)",
    fontFamily: font.display, fontWeight: 800, fontSize: 13.5, color: "#FF6B70", boxShadow: "0 0 18px -2px rgba(240,85,90,0.6)",
  },
  vsCircleFighter: { width: 50, height: 50, fontSize: 15.5, border: "2px solid rgba(240,85,90,0.7)" },
  vsShine: {
    position: "absolute", top: 0, left: 0, width: "40%", height: "200%", background: "rgba(255,255,255,0.35)",
    animation: "duelShine 2.6s ease-in-out infinite",
  },

  previewRow: {
    display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 18, paddingTop: 14,
    borderTop: "1px solid rgba(212,175,55,0.18)",
  },
  previewLabel: { fontSize: 10.5, color: color.textFaint, fontFamily: font.body },
  previewPoints: { fontSize: 12, fontWeight: 800, color: color.goldLight, fontFamily: font.body },

  resolvedBox: { textAlign: "center", marginTop: 18, paddingTop: 16, borderTop: "1px solid rgba(212,175,55,0.2)" },
  resolvedIcon: { fontSize: 34, marginBottom: 4, filter: "drop-shadow(0 0 10px rgba(212,175,55,0.6))" },
  resolvedTitle: { fontFamily: font.display, fontSize: 16, fontWeight: 800, color: color.goldLight, letterSpacing: "0.03em" },
  resolvedPoints: { fontFamily: font.display, fontSize: 24, fontWeight: 800, color: color.goldLight, marginTop: 2, textShadow: "0 0 20px rgba(212,175,55,0.5)" },
  resolvedIconLose: { fontSize: 30, marginBottom: 4, opacity: 0.55 },
  resolvedTitleLose: { fontFamily: font.display, fontSize: 15, fontWeight: 800, color: color.textFaint, letterSpacing: "0.03em" },
  resolvedPointsLose: { fontFamily: font.display, fontSize: 20, fontWeight: 800, color: color.textFaint, marginTop: 2 },

  byeWrap: {
    position: "relative", overflow: "hidden", textAlign: "center", padding: "34px 16px",
    background: "rgba(212,175,55,0.07)", border: "1px solid rgba(212,175,55,0.3)", borderRadius: radius.lg,
  },
  byeGlow: {
    position: "absolute", top: "-30%", left: "50%", transform: "translateX(-50%)", width: 200, height: 200,
    background: "radial-gradient(circle, rgba(212,175,55,0.2), transparent 70%)",
  },
  byeIcon: { fontSize: 38, marginBottom: 8, position: "relative" },
  byeTitle: { fontSize: 13, fontWeight: 700, color: color.textPrimary, fontFamily: font.body, position: "relative" },
  byePoints: { fontFamily: font.display, fontSize: 24, fontWeight: 800, color: color.goldLight, marginTop: 8, position: "relative", textShadow: "0 0 16px rgba(212,175,55,0.5)" },
};
