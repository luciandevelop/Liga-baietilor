import { useEffect, useState } from "react";
import { submitTriviaAnswer, getMyTriviaAnswers } from "../services/surprisesService";
import { color, font, radius } from "../matchdayTheme";

export default function TriviaExperience({ gameweekId, myUid, opponentUid, isBye, questions, profiles, resolved, myPoints, myMatchScore, opponentMatchScore, deadlinePassed }) {
  const [myAnswers, setMyAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(null); // questionId în curs de trimitere

  useEffect(() => {
    let cancelled = false;
    getMyTriviaAnswers(gameweekId, myUid, questions.map((q) => q.id)).then((a) => {
      if (!cancelled) { setMyAnswers(a); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [gameweekId, myUid]);

  async function handleAnswer(questionId, answer) {
    if (deadlinePassed || resolved) return;
    setSubmitting(questionId);
    setMyAnswers((prev) => ({ ...prev, [questionId]: answer })); // optimist
    try {
      await submitTriviaAnswer(gameweekId, myUid, questionId, answer);
    } catch (err) {
      console.error("Eroare la trimiterea răspunsului:", err);
    } finally {
      setSubmitting(null);
    }
  }

  const answeredCount = questions.filter((q) => myAnswers[q.id]).length;
  const gradedQuestions = questions.filter((q) => q.correctAnswer);
  const myBaseScore = gradedQuestions.reduce((sum, q) => sum + (myAnswers[q.id] === q.correctAnswer ? 15 : 0), 0);

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <div style={s.progress}>{answeredCount}/{questions.length} răspunsuri date</div>
        {gradedQuestions.length > 0 && <div style={s.baseScore}>Scor de bază: {myBaseScore}p</div>}
      </div>

      {!loading && questions.map((q) => {
        const myAnswer = myAnswers[q.id];
        const isGraded = !!q.correctAnswer;
        const isCorrect = isGraded && myAnswer === q.correctAnswer;
        const isWrong = isGraded && myAnswer && myAnswer !== q.correctAnswer;
        return (
          <div key={q.id} style={s.questionCard}>
            <div style={s.questionText}>
              {q.text}
              {isCorrect && <span style={s.correctTag}> ✓</span>}
              {isWrong && <span style={s.wrongTag}> ✗</span>}
            </div>
            <div style={s.optionsRow}>
              <button
                type="button"
                disabled={deadlinePassed || resolved || submitting === q.id}
                onClick={() => handleAnswer(q.id, "A")}
                style={{ ...s.optionBtn, ...(myAnswer === "A" ? s.optionBtnSelected : {}) }}
              >
                {q.optionALabel}
              </button>
              <button
                type="button"
                disabled={deadlinePassed || resolved || submitting === q.id}
                onClick={() => handleAnswer(q.id, "B")}
                style={{ ...s.optionBtn, ...(myAnswer === "B" ? s.optionBtnSelected : {}) }}
              >
                {q.optionBLabel}
              </button>
            </div>
          </div>
        );
      })}

      {isBye ? (
        <div style={s.byeBox}>
          <div style={s.byeIcon}>🎟️</div>
          <div style={s.byeTitle}>BYE — număr impar de jucători</div>
          <div style={s.byePoints}>{resolved ? `${myPoints}p (bază + 25p bonus)` : "bază + 25p bonus garantat"}</div>
        </div>
      ) : (
        <div style={s.duelBox}>
          <div style={s.duelTitle}>🃏 Duel — vs {profiles[opponentUid]?.nickname || opponentUid}</div>
          {!resolved ? (
            <div style={s.duelPending}>Comparația se rezolvă după ce Admin validează toate răspunsurile.</div>
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
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  progress: { fontSize: 11, color: color.textFaint, fontFamily: font.body, fontWeight: 700 },
  baseScore: { fontSize: 12.5, color: color.goldLight, fontFamily: font.body, fontWeight: 800 },

  questionCard: { background: "rgba(255,255,255,0.03)", border: `1px solid ${color.border}`, borderRadius: radius.sm, padding: 10, marginBottom: 8 },
  questionText: { fontSize: 12, fontWeight: 700, color: color.textPrimary, fontFamily: font.body, marginBottom: 8 },
  correctTag: { color: "#8BD957", fontWeight: 800 },
  wrongTag: { color: "#F0555A", fontWeight: 800 },
  optionsRow: { display: "flex", gap: 8 },
  optionBtn: {
    flex: 1, background: "rgba(255,255,255,0.04)", border: `1px solid ${color.border}`, borderRadius: radius.sm,
    padding: "9px 6px", fontSize: 11.5, fontWeight: 700, color: color.textSecondary, cursor: "pointer", fontFamily: font.body,
  },
  optionBtnSelected: { background: "rgba(212,175,55,0.15)", border: "1px solid rgba(212,175,55,0.5)", color: color.goldLight },

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
