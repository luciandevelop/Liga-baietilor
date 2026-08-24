import { useEffect, useState } from "react";
import { rollDice, stopRolling, getMyDiceState } from "../services/surprisesService";
import { color, font, radius } from "../matchdayTheme";

const DICE_FACE = { 1: "⚀", 2: "⚁", 3: "⚂", 4: "⚃", 5: "⚄", 6: "⚅" };

function scoreForDistance(total, target) {
  if (target == null) return null;
  if (total > target) return 0; // BUST
  const distance = target - total;
  return Math.max(0, 30 - 5 * distance);
}

function QuestionDice({ gameweekId, myUid, question, resolved, deadlinePassed }) {
  const [state, setState] = useState({ rolls: [], total: 0, stopped: false });
  const [loading, setLoading] = useState(true);
  const [rolling, setRolling] = useState(false);
  const [lastRoll, setLastRoll] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getMyDiceState(gameweekId, myUid, question.id).then((s) => {
      if (!cancelled) { setState(s); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [gameweekId, myUid, question.id]);

  async function handleRoll() {
    if (deadlinePassed || resolved || state.stopped) return;
    setRolling(true);
    try {
      const result = await rollDice(gameweekId, myUid, question.id);
      setLastRoll(result.value);
      setState((prev) => ({ ...prev, rolls: [...prev.rolls, { value: result.value }], total: result.total }));
    } catch (err) {
      console.error("Eroare la aruncarea zarului:", err);
    } finally {
      setRolling(false);
    }
  }

  async function handleStop() {
    if (deadlinePassed || resolved || state.stopped) return;
    try {
      await stopRolling(gameweekId, myUid, question.id);
      setState((prev) => ({ ...prev, stopped: true }));
    } catch (err) {
      console.error("Eroare la oprire:", err);
    }
  }

  const myScore = resolved ? scoreForDistance(state.total, question.correctTarget) : null;
  const isBust = resolved && question.correctTarget != null && state.total > question.correctTarget;

  return (
    <div style={s.questionCard}>
      <div style={s.questionText}>{question.text}</div>

      {!loading && (
        <>
          <div style={s.diceRow}>
            {state.rolls.map((r, i) => (
              <span key={i} style={s.diceFace}>{DICE_FACE[r.value]}</span>
            ))}
          </div>
          <div style={s.totalRow}>
            Total: <span style={s.totalValue}>{state.total}</span>
            {resolved && question.correctTarget != null && (
              <span style={s.targetNote}> · Real: {question.correctTarget}</span>
            )}
          </div>

          {resolved ? (
            <div style={{ ...s.resultTag, color: isBust ? "#F0555A" : "#8BD957" }}>
              {isBust ? `💥 BUST — 0p` : `✓ ${myScore}p`}
            </div>
          ) : state.stopped ? (
            <div style={s.stoppedTag}>✋ Te-ai oprit la {state.total}</div>
          ) : deadlinePassed ? (
            <div style={s.stoppedTag}>Timpul a expirat — rămâne {state.total}</div>
          ) : state.rolls.length === 0 ? (
            <button type="button" style={s.rollBtn} disabled={rolling} onClick={handleRoll}>
              {rolling ? "Se aruncă…" : "🎲 Aruncă zarul"}
            </button>
          ) : (
            <div style={s.decideRow}>
              <button type="button" style={s.keepBtn} disabled={rolling} onClick={handleStop}>✋ Mă opresc</button>
              <button type="button" style={s.rerollBtn} disabled={rolling} onClick={handleRoll}>
                {rolling ? "…" : "🎲 Mai dau"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function DiceExperience({ gameweekId, myUid, opponentUid, isBye, questions, profiles, resolved, myPoints, myMatchScore, opponentMatchScore, deadlinePassed }) {
  return (
    <div style={s.wrap}>
      {questions.map((q) => (
        <QuestionDice key={q.id} gameweekId={gameweekId} myUid={myUid} question={q} resolved={resolved} deadlinePassed={deadlinePassed} />
      ))}

      {isBye ? (
        <div style={s.byeBox}>
          <div style={s.byeIcon}>🎟️</div>
          <div style={s.byeTitle}>BYE — număr impar de jucători</div>
          <div style={s.byePoints}>{resolved ? `${myPoints}p (bază + 25p bonus)` : "bază + 25p bonus garantat"}</div>
        </div>
      ) : (
        <div style={s.duelBox}>
          <div style={s.duelTitle}>🎲 Duel — vs {profiles[opponentUid]?.nickname || opponentUid}</div>
          {!resolved ? (
            <div style={s.duelPending}>Comparația se rezolvă după ce Admin introduce rezultatele reale.</div>
          ) : (
            <>
              <div style={s.duelScores}>
                <span>Tu: <b style={{ color: color.goldLight }}>{myMatchScore}p</b> bază</span>
                <span>Adversar: <b>{opponentMatchScore}p</b> bază</span>
              </div>
              <div style={s.duelResult}>
                {myPoints === myMatchScore + 25 ? (
                  <>🤝 <b>EGALITATE</b> — total {myPoints}p</>
                ) : myPoints === myMatchScore + 50 ? (
                  <>🏆 <b>AI CÂȘTIGAT DUELUL</b> — total {myPoints}p</>
                ) : (
                  <>💔 <b>AI PIERDUT DUELUL</b> — total {myPoints}p</>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const s = {
  wrap: {
    background: "linear-gradient(180deg, rgba(212,175,55,0.08) 0%, rgba(18,20,28,0.97) 30%, rgba(8,9,13,0.99) 100%)",
    border: "1px solid rgba(212,175,55,0.3)", borderRadius: radius.lg, padding: "14px 12px",
  },
  questionCard: { background: "rgba(255,255,255,0.03)", border: `1px solid ${color.border}`, borderRadius: radius.sm, padding: 10, marginBottom: 8 },
  questionText: { fontSize: 12, fontWeight: 700, color: color.textPrimary, fontFamily: font.body, marginBottom: 8 },
  diceRow: { display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 4, minHeight: 22 },
  diceFace: { fontSize: 20, color: color.goldLight },
  totalRow: { fontSize: 11, color: color.textSecondary, fontFamily: font.body, marginBottom: 8 },
  totalValue: { fontWeight: 800, color: color.textPrimary, fontSize: 13 },
  targetNote: { color: color.textFaint },
  resultTag: { fontSize: 12, fontWeight: 800, fontFamily: font.body },
  stoppedTag: { fontSize: 11, color: color.textFaint, fontFamily: font.body, fontStyle: "italic" },
  rollBtn: {
    background: "linear-gradient(180deg, #F0D875, #C9A227)", border: "none", borderRadius: radius.sm,
    padding: "9px 0", width: "100%", fontSize: 12, fontWeight: 800, color: "#1A1200", cursor: "pointer", fontFamily: font.body,
  },
  decideRow: { display: "flex", gap: 8 },
  keepBtn: {
    flex: 1, background: "rgba(139,217,87,0.12)", border: "1px solid rgba(139,217,87,0.4)", color: "#8BD957",
    borderRadius: radius.sm, padding: "9px 0", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: font.body,
  },
  rerollBtn: {
    flex: 1, background: "rgba(240,85,90,0.1)", border: "1px solid rgba(240,85,90,0.4)", color: "#F0555A",
    borderRadius: radius.sm, padding: "9px 0", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: font.body,
  },

  byeBox: { textAlign: "center", padding: "16px 12px", marginTop: 8, background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.25)", borderRadius: radius.md },
  byeIcon: { fontSize: 26, marginBottom: 4 },
  byeTitle: { fontSize: 11.5, fontWeight: 700, color: color.textPrimary, fontFamily: font.body },
  byePoints: { fontFamily: font.display, fontSize: 16, fontWeight: 800, color: color.goldLight, marginTop: 6 },

  duelBox: { marginTop: 8, padding: "12px 10px", background: "rgba(139,58,138,0.06)", border: "1px solid rgba(139,58,138,0.25)", borderRadius: radius.md },
  duelTitle: { fontSize: 11.5, fontWeight: 800, color: color.textPrimary, fontFamily: font.body, marginBottom: 6 },
  duelPending: { fontSize: 10.5, color: color.textFaint, fontFamily: font.body, fontStyle: "italic" },
  duelScores: { display: "flex", justifyContent: "space-between", fontSize: 11, color: color.textSecondary, fontFamily: font.body, marginBottom: 6 },
  duelResult: { fontSize: 12, color: color.textPrimary, fontFamily: font.body, textAlign: "center" },
};
