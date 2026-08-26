import { useEffect, useState } from "react";
import {
  getMySabotajChoice, getSabotajPublicProgress, getSabotajSelectableTargets,
  isSabotajPickersTurn, submitSabotajChoice, getAllSabotajChoices,
} from "../services/surprisesService";
import PlayerAvatar from "./PlayerAvatar";
import { color, font, radius } from "../matchdayTheme";

// ── SABOTAJ — self-contained, ca Trivia/Zaruri: își gestionează singur
// starea de alegere (owner-only + progres public anonim). Părintele
// (SurprisesScreen) doar dă contextul static: ordinea înghețată,
// profilele, scorurile live, și flag-urile de reveal/resolve. ──
export default function SabotajExperience({
  gameweekId, myUid, order, profiles, liveScores, sabotajRevealed, resolved, myResult,
}) {
  const [myChoice, setMyChoice] = useState(null);
  const [progress, setProgress] = useState({ chosenPickers: [], takenTargets: [] });
  const [allChoices, setAllChoices] = useState(null); // picker -> target, doar după reveal
  const [loading, setLoading] = useState(true);
  const [pendingTarget, setPendingTarget] = useState(null); // pentru modalul de confirmare
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [revealStep, setRevealStep] = useState(0); // pentru animația progresivă a rețelei

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [choice, prog] = await Promise.all([
        getMySabotajChoice(gameweekId, myUid),
        getSabotajPublicProgress(gameweekId, order),
      ]);
      if (cancelled) return;
      setMyChoice(choice);
      setProgress(prog);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [gameweekId, myUid, order]);

  useEffect(() => {
    if (!sabotajRevealed) return;
    let cancelled = false;
    getAllSabotajChoices(gameweekId, order).then((map) => { if (!cancelled) setAllChoices(map); });
    return () => { cancelled = true; };
  }, [sabotajRevealed, gameweekId, order]);

  // Reveal-ul rețelei apare progresiv, o legătură pe rând — impactul
  // vizual cerut explicit, robust pe mobil (listă, nu graf de noduri).
  useEffect(() => {
    if (!allChoices) return;
    setRevealStep(0);
    const total = Object.keys(allChoices).length;
    if (total === 0) return;
    let i = 0;
    const interval = setInterval(() => {
      i += 1;
      setRevealStep(i);
      if (i >= total) clearInterval(interval);
    }, 260);
    return () => clearInterval(interval);
  }, [allChoices]);

  if (loading) return <div style={s.centerNote}>Se încarcă…</div>;

  const myIdx = order.indexOf(myUid);
  const isMyTurn = !myChoice && isSabotajPickersTurn(order, progress.chosenPickers, myUid);
  const selectable = isMyTurn
    ? getSabotajSelectableTargets(order, progress.chosenPickers, progress.takenTargets, myUid)
    : [];
  const totalDone = progress.chosenPickers.length;

  async function handleConfirm() {
    if (!pendingTarget) return;
    setSubmitting(true);
    setError("");
    try {
      await submitSabotajChoice(gameweekId, myUid, pendingTarget);
      setMyChoice({ uid: myUid, target: pendingTarget });
      setProgress((prev) => ({
        chosenPickers: [...prev.chosenPickers, myUid],
        takenTargets: [...prev.takenTargets, pendingTarget],
      }));
      setPendingTarget(null);
    } catch (err) {
      console.error("Eroare la confirmarea sabotajului:", err);
      setError(err.message || "Eroare — încearcă din nou.");
    } finally {
      setSubmitting(false);
    }
  }

  // ══════════════════════════════════════════════════════════════
  // ETAPA DE REVEAL / REZULTAT — rețeaua completă + rezumatul meu.
  // ══════════════════════════════════════════════════════════════
  if (sabotajRevealed) {
    const entries = Object.entries(allChoices || {});
    const myTargetUid = allChoices?.[myUid];
    const myAttackerEntry = entries.find(([, target]) => target === myUid);
    const myAttackerUid = myAttackerEntry ? myAttackerEntry[0] : null;

    const myDetail = resolved ? myResult?.sabotaj : null;

    return (
      <div style={s.wrap}>
        <style>{`
          @keyframes sabotajFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes sabotajGlowPulse { 0%,100% { opacity: 0.55; } 50% { opacity: 1; } }
        `}</style>
        <div style={s.opHeader}>🕵️ REȚEAUA DE SABOTAJ</div>

        {/* ── Rezumatul meu — prioritate vizuală maximă ── */}
        <div style={s.myResultCard}>
          <div style={s.myResultRow}>
            <div style={s.myResultCol}>
              <div style={s.myResultLabel}>ȚINTA TA</div>
              {myTargetUid && (
                <>
                  <PlayerAvatar avatarId={profiles[myTargetUid]?.avatarId} nickname={profiles[myTargetUid]?.nickname} size={52} />
                  <div style={s.myResultName}>{profiles[myTargetUid]?.nickname || myTargetUid}</div>
                </>
              )}
            </div>
            <div style={s.myResultCol}>
              <div style={s.myResultLabel}>TE-A SABOTAT</div>
              {myAttackerUid && (
                <>
                  <PlayerAvatar avatarId={profiles[myAttackerUid]?.avatarId} nickname={profiles[myAttackerUid]?.nickname} size={52} />
                  <div style={s.myResultName}>{profiles[myAttackerUid]?.nickname || myAttackerUid}</div>
                </>
              )}
            </div>
          </div>

          {resolved && myDetail ? (
            <>
              <div style={s.outcomeRow}>
                <div style={{ ...s.outcomeBox, ...(myDetail.targetOutcome === "success" ? s.outcomeGood : s.outcomeBad) }}>
                  {myDetail.targetOutcome === "success" ? "✅ SABOTAJ REUȘIT" : "❌ SABOTAJ EȘUAT"}
                  <div style={s.outcomeSub}>
                    {myDetail.targetScores ? `${myDetail.targetScores.mine}p vs ${myDetail.targetScores.theirs}p` : ""}
                  </div>
                  <div style={s.outcomeTransfer}>
                    {myDetail.targetOutcome === "success" ? `AI FURAT ${myDetail.targetTransfer}p` : "ȚINTA A REZISTAT"}
                  </div>
                </div>
                <div style={{ ...s.outcomeBox, ...(myDetail.attackerOutcome === "success" ? s.outcomeBadForMe : s.outcomeGoodForMe) }}>
                  {myDetail.attackerOutcome === "success" ? "💥 AI FOST JEFUIT" : "🛡️ AI REZISTAT"}
                  <div style={s.outcomeSub}>
                    {myDetail.attackerScores ? `${myDetail.attackerScores.mine}p vs ${myDetail.attackerScores.theirs}p` : ""}
                  </div>
                  <div style={s.outcomeTransfer}>
                    {myDetail.attackerOutcome === "success" ? `ȚI S-AU FURAT ${myDetail.attackerTransfer}p` : "NU ȚI S-A FURAT NIMIC"}
                  </div>
                </div>
              </div>
              <div style={s.balanceCard}>
                <div style={s.balanceLabel}>BALANȚĂ SABOTAJ</div>
                <div style={s.balanceLine}>Ai furat: <b style={{ color: color.green }}>+{myDetail.targetTransfer}p</b></div>
                <div style={s.balanceLine}>Ți s-au furat: <b style={{ color: "#F0555A" }}>−{myDetail.attackerTransfer}p</b></div>
                <div style={s.balanceDivider} />
                <div style={s.balanceNet}>
                  NET: <span style={{ color: myDetail.targetTransfer - myDetail.attackerTransfer >= 0 ? color.green : "#F0555A" }}>
                    {myDetail.targetTransfer - myDetail.attackerTransfer >= 0 ? "+" : ""}{myDetail.targetTransfer - myDetail.attackerTransfer}p
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div style={s.liveNote}>
              {myTargetUid && liveScores[myUid] !== undefined && liveScores[myTargetUid] !== undefined && (
                <div>
                  {liveScores[myUid] > liveScores[myTargetUid] ? "🟢 Momentan sabotaj reușit" : "🟡 Momentan ținta rezistă"}
                  {" — "}{liveScores[myUid] || 0}p vs {liveScores[myTargetUid] || 0}p
                </div>
              )}
              <div style={s.liveNoteSmall}>Punctele reale se acordă la finalizarea etapei.</div>
            </div>
          )}
        </div>

        {/* ── Rețeaua completă, progresiv ── */}
        <div style={s.networkLabel}>Toate confruntările</div>
        <div style={s.networkList}>
          {entries.map(([picker, target], i) => (
            <div
              key={picker}
              style={{
                ...s.networkRow,
                opacity: i < revealStep ? 1 : 0,
                animation: i < revealStep ? "sabotajFadeIn 400ms ease both" : "none",
              }}
            >
              <PlayerAvatar avatarId={profiles[picker]?.avatarId} nickname={profiles[picker]?.nickname} size={30} />
              <span style={s.networkName}>{profiles[picker]?.nickname || picker}</span>
              <span style={s.networkArrow}>→</span>
              <PlayerAvatar avatarId={profiles[target]?.avatarId} nickname={profiles[target]?.nickname} size={30} />
              <span style={s.networkName}>{profiles[target]?.nickname || target}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // FAZA DE ALEGERE — încă nedezvăluită rețeaua.
  // ══════════════════════════════════════════════════════════════
  if (myChoice) {
    return (
      <div style={s.wrap}>
        <div style={s.lockedTargetCard}>
          <div style={s.lockedIcon}>🎯</div>
          <div style={s.lockedTitle}>ȚINTĂ BLOCATĂ</div>
          <PlayerAvatar avatarId={profiles[myChoice.target]?.avatarId} nickname={profiles[myChoice.target]?.nickname} size={64} />
          <div style={s.lockedName}>{profiles[myChoice.target]?.nickname || myChoice.target}</div>
          <div style={s.progressNote}>{totalDone}/{order.length} agenți și-au ales deja ținta</div>
          <div style={s.waitingNote}>Așteptăm dezvăluirea rețelei de la Admin.</div>
        </div>
      </div>
    );
  }

  if (!isMyTurn) {
    const position = myIdx + 1;
    return (
      <div style={s.wrap}>
        <div style={s.waitCard}>
          <div style={s.waitIcon}>🔒</div>
          <div style={s.waitTitle}>AȘTEAPTĂ</div>
          <div style={s.waitText}>Ești #{position} în ordinea operațiunii.</div>
          <div style={s.progressNote}>{totalDone}/{order.length} agenți și-au ales deja ținta</div>
        </div>
      </div>
    );
  }

  // E rândul meu.
  return (
    <div style={s.wrap}>
      <style>{`
        @keyframes sabotajTitlePulse { 0%,100% { text-shadow: 0 0 12px rgba(139,92,246,0.5); } 50% { text-shadow: 0 0 22px rgba(139,92,246,0.9); } }
      `}</style>
      <div style={s.opHeader}>🕵️ OPERAȚIUNEA SABOTAJ</div>
      <div style={s.chooseTitle}>🎯 ALEGE-ȚI ȚINTA</div>
      <div style={s.progressNote}>{totalDone}/{order.length} agenți și-au ales deja ținta</div>

      <div style={s.targetGrid}>
        {order.filter((uid) => uid !== myUid).map((uid) => {
          const isTaken = progress.takenTargets.includes(uid);
          const isSelectable = selectable.includes(uid);
          return (
            <button
              key={uid}
              type="button"
              disabled={!isSelectable}
              onClick={() => setPendingTarget(uid)}
              style={{ ...s.targetCard, ...(isTaken || !isSelectable ? s.targetCardBlocked : {}) }}
            >
              <PlayerAvatar avatarId={profiles[uid]?.avatarId} nickname={profiles[uid]?.nickname} size={46} />
              <span style={s.targetName}>{profiles[uid]?.nickname || uid}</span>
              {isTaken && <span style={s.targetLockIcon}>🔒</span>}
            </button>
          );
        })}
      </div>

      {error && <div style={s.errorText}>{error}</div>}

      {pendingTarget && (
        <div style={s.modalOverlay} onClick={() => !submitting && setPendingTarget(null)}>
          <div style={s.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalGlow} />
            <div style={s.modalIcon}>🎯</div>
            <div style={s.modalText}>
              Ținta ta este <b>{profiles[pendingTarget]?.nickname || pendingTarget}</b>.
            </div>
            <div style={s.modalWarn}>Alegerea este definitivă. Confirmi sabotajul?</div>
            <div style={s.modalBtnRow}>
              <button type="button" style={s.modalCancelBtn} disabled={submitting} onClick={() => setPendingTarget(null)}>
                Anulează
              </button>
              <button type="button" style={s.modalConfirmBtn} disabled={submitting} onClick={handleConfirm}>
                {submitting ? "Se confirmă…" : "Confirmă sabotajul"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  wrap: { position: "relative" },
  centerNote: { textAlign: "center", fontSize: 12, color: color.textFaint, padding: "16px 0", fontFamily: font.body },

  opHeader: {
    fontSize: 13, fontWeight: 800, letterSpacing: "0.06em", color: "#B98CFF", textAlign: "center",
    marginBottom: 10, fontFamily: font.display, textTransform: "uppercase",
    animation: "sabotajTitlePulse 2.4s ease-in-out infinite",
  },

  // ── Fază: aștept rândul ──
  waitCard: {
    background: "linear-gradient(160deg, rgba(139,92,246,0.10), #12161F)", border: "1px solid rgba(139,92,246,0.3)",
    borderRadius: radius.lg, padding: "26px 18px", textAlign: "center",
  },
  waitIcon: { fontSize: 30, marginBottom: 8 },
  waitTitle: { fontSize: 15, fontWeight: 800, color: color.textPrimary, fontFamily: font.display, letterSpacing: "0.04em", marginBottom: 6 },
  waitText: { fontSize: 12.5, color: color.textSecondary, fontFamily: font.body, marginBottom: 10 },
  progressNote: { fontSize: 11, color: color.textFaint, fontFamily: font.body },

  // ── Fază: rândul meu ──
  chooseTitle: {
    fontSize: 17, fontWeight: 800, color: color.textPrimary, textAlign: "center", fontFamily: font.display,
    marginBottom: 6,
  },
  targetGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, marginTop: 14 },
  targetCard: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: 6, position: "relative",
    minWidth: 0, overflow: "hidden",
    background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.35)", borderRadius: radius.md,
    padding: "12px 6px", cursor: "pointer",
  },
  targetCardBlocked: { opacity: 0.35, filter: "grayscale(1)", cursor: "not-allowed" },
  targetName: {
    fontSize: 10.5, fontWeight: 600, color: color.textPrimary, fontFamily: font.body, textAlign: "center",
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%",
  },
  targetLockIcon: { position: "absolute", top: 4, right: 6, fontSize: 12 },
  errorText: { fontSize: 11.5, color: "#F0555A", textAlign: "center", marginTop: 10, fontFamily: font.body },

  // ── Modal de confirmare ──
  modalOverlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center",
    justifyContent: "center", zIndex: 1000, padding: 20,
  },
  modalCard: {
    position: "relative", overflow: "hidden", width: "100%", maxWidth: 340,
    background: "linear-gradient(160deg, #1a1030, #12161F)", border: "1px solid rgba(139,92,246,0.5)",
    borderRadius: radius.lg, padding: "26px 20px", textAlign: "center",
    boxShadow: "0 0 40px -6px rgba(139,92,246,0.6)",
  },
  modalGlow: {
    position: "absolute", top: -40, left: "50%", transform: "translateX(-50%)", width: 160, height: 160,
    borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.35), transparent 70%)", pointerEvents: "none",
  },
  modalIcon: { fontSize: 30, marginBottom: 10, position: "relative" },
  modalText: { fontSize: 14, color: color.textPrimary, fontFamily: font.body, marginBottom: 8, position: "relative" },
  modalWarn: { fontSize: 11.5, color: "#E08A82", fontFamily: font.body, marginBottom: 18, position: "relative" },
  modalBtnRow: { display: "flex", gap: 10, position: "relative" },
  modalCancelBtn: {
    flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", color: color.textSecondary,
    borderRadius: radius.sm, padding: "11px 0", fontSize: 12.5, fontWeight: 700, fontFamily: font.body, cursor: "pointer",
  },
  modalConfirmBtn: {
    flex: 1.4, background: "linear-gradient(180deg, #A855F7, #7C3AED)", border: "none", color: "#fff",
    borderRadius: radius.sm, padding: "11px 0", fontSize: 12.5, fontWeight: 800, fontFamily: font.body, cursor: "pointer",
  },

  // ── Fază: ținta blocată, aștept reveal ──
  lockedTargetCard: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
    background: "linear-gradient(160deg, rgba(139,92,246,0.10), #12161F)", border: "1px solid rgba(139,92,246,0.3)",
    borderRadius: radius.lg, padding: "24px 18px", textAlign: "center",
  },
  lockedIcon: { fontSize: 26 },
  lockedTitle: { fontSize: 13, fontWeight: 800, letterSpacing: "0.06em", color: "#B98CFF", fontFamily: font.display, marginBottom: 6 },
  lockedName: { fontSize: 14, fontWeight: 700, color: color.textPrimary, fontFamily: font.body, marginBottom: 6 },
  waitingNote: { fontSize: 11, color: color.textFaint, fontFamily: font.body, marginTop: 6 },

  // ── Rezultat / reveal ──
  myResultCard: {
    background: "linear-gradient(160deg, rgba(139,92,246,0.12), #12161F)", border: "1px solid rgba(139,92,246,0.4)",
    borderRadius: radius.lg, padding: "18px 16px", marginBottom: 18,
  },
  myResultRow: { display: "flex", justifyContent: "space-around", marginBottom: 14 },
  myResultCol: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6 },
  myResultLabel: { fontSize: 9.5, fontWeight: 800, letterSpacing: "0.07em", color: color.textFaint, fontFamily: font.body },
  myResultName: { fontSize: 12, fontWeight: 700, color: color.textPrimary, fontFamily: font.body },

  outcomeRow: { display: "flex", gap: 8, marginBottom: 12 },
  outcomeBox: { flex: 1, borderRadius: radius.md, padding: "10px 8px", textAlign: "center", border: "1px solid" },
  outcomeGood: { background: "rgba(139,217,87,0.12)", borderColor: "rgba(139,217,87,0.4)", color: color.green },
  outcomeBad: { background: "rgba(240,85,90,0.10)", borderColor: "rgba(240,85,90,0.35)", color: "#F0555A" },
  outcomeGoodForMe: { background: "rgba(139,217,87,0.12)", borderColor: "rgba(139,217,87,0.4)", color: color.green },
  outcomeBadForMe: { background: "rgba(240,85,90,0.10)", borderColor: "rgba(240,85,90,0.35)", color: "#F0555A" },
  outcomeSub: { fontSize: 10, color: color.textSecondary, marginTop: 4, fontFamily: font.body },
  outcomeTransfer: { fontSize: 11, fontWeight: 800, marginTop: 4, fontFamily: font.body },

  balanceCard: { background: "rgba(0,0,0,0.25)", borderRadius: radius.md, padding: "12px 14px" },
  balanceLabel: { fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", color: color.textFaint, marginBottom: 6, fontFamily: font.body },
  balanceLine: { fontSize: 12, color: color.textSecondary, fontFamily: font.body, marginBottom: 3 },
  balanceDivider: { height: 1, background: "rgba(255,255,255,0.1)", margin: "6px 0" },
  balanceNet: { fontSize: 14, fontWeight: 800, color: color.textPrimary, fontFamily: font.display },

  liveNote: { textAlign: "center", fontSize: 12.5, color: color.textSecondary, fontFamily: font.body },
  liveNoteSmall: { fontSize: 10.5, color: color.textFaint, marginTop: 4, fontFamily: font.body },

  networkLabel: {
    fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
    color: color.textFaint, marginBottom: 8, fontFamily: font.body,
  },
  networkList: { display: "flex", flexDirection: "column", gap: 6 },
  networkRow: {
    display: "flex", alignItems: "center", gap: 6, background: "rgba(139,92,246,0.06)",
    border: "1px solid rgba(139,92,246,0.2)", borderRadius: radius.sm, padding: "7px 10px",
  },
  networkName: { fontSize: 11, fontWeight: 600, color: color.textPrimary, fontFamily: font.body, flexShrink: 0, maxWidth: 78, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  networkArrow: { fontSize: 13, color: "#B98CFF", fontWeight: 800, flexShrink: 0 },
};
