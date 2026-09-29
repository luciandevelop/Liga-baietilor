import { useEffect, useState } from "react";
import { submitTriviaAnswer, getMyTriviaAnswers } from "../services/surprisesService";
import { color, font, radius } from "../matchdayTheme";
import TriviaEmblem, { TRIVIA_THEMES, Flag } from "./TriviaThemeArt";
import { detectTriviaTheme, teamsInText } from "./triviaThemes";

export default function TriviaExperience({ gameweekId, myUid, opponentUid, isBye, questions, profiles, resolved, myPoints, myMatchScore, opponentMatchScore, deadlinePassed, triviaLocked }) {
  const [myAnswers, setMyAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(null); // questionId în curs de trimitere
  // ── Blocare manuală Admin: din documentul public (prop) SAU detectată
  // la salvare (ecran deschis dinainte de blocare — refuzul serverului
  // comută imediat interfața pe închis, fără reîncărcare). ──
  const [lockedNow, setLockedNow] = useState(false);
  const [saveError, setSaveError] = useState("");
  const isLocked = deadlinePassed || !!triviaLocked || lockedNow;

  useEffect(() => {
    let cancelled = false;
    getMyTriviaAnswers(gameweekId, myUid, questions.map((q) => q.id)).then((a) => {
      if (!cancelled) { setMyAnswers(a); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [gameweekId, myUid]);

  async function handleAnswer(questionId, answer) {
    if (isLocked || resolved) return;
    setSubmitting(questionId);
    setSaveError("");
    const previous = myAnswers[questionId];
    setMyAnswers((prev) => ({ ...prev, [questionId]: answer })); // optimist
    try {
      await submitTriviaAnswer(gameweekId, myUid, questionId, answer);
    } catch (err) {
      console.error("Eroare la trimiterea răspunsului:", err);
      // Revert — altfel jucătorul ar vedea selectată o variantă NEsalvată.
      setMyAnswers((prev) => {
        const next = { ...prev };
        if (previous === undefined) delete next[questionId]; else next[questionId] = previous;
        return next;
      });
      if (String(err?.message || "").includes("Trivia închisă")) setLockedNow(true);
      else setSaveError("Răspunsul nu s-a salvat. Încearcă din nou.");
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
        <div style={s.progress}>
          {answeredCount === questions.length && questions.length > 0 ? "✅ Toate răspunsurile date" : `${answeredCount}/${questions.length} · mai ai ${questions.length - answeredCount}`}
        </div>
        {gradedQuestions.length > 0 && <div style={s.baseScore}>Scor de bază: {myBaseScore}p</div>}
      </div>
      {/* Progres vizual — teren cu câte o poziție per întrebare; STRICT din myAnswers (zero citiri). */}
      <div style={s.pitch}>
        <div style={s.pitchMidline} />
        {questions.map((q) => (
          <div key={q.id} style={{ ...s.pitchSlot, ...(myAnswers[q.id] ? s.pitchSlotOn : {}) }}>
            {myAnswers[q.id] ? "⚽" : ""}
          </div>
        ))}
        <svg viewBox="0 0 16 22" width="14" height="20" style={{ flexShrink: 0 }} aria-hidden="true">
          <path d="M14 1 L3 1 L3 21 L14 21" fill="none" stroke="#FFFFFF" strokeWidth="1.8" />
          <path d="M6 1 L6 21 M9 1 L9 21 M3 6 L14 6 M3 11 L14 11 M3 16 L14 16" stroke="rgba(255,255,255,0.35)" strokeWidth="0.7" />
        </svg>
      </div>
      {isLocked && !resolved && <div style={s.lockedMsg}>🔒 Trivia închisă</div>}
      {saveError && <div style={s.saveErrorMsg}>{saveError}</div>}

      {!loading && questions.map((q, idx) => {
        const myAnswer = myAnswers[q.id];
        const isGraded = !!q.correctAnswer;
        const isCorrect = isGraded && myAnswer === q.correctAnswer;
        const isWrong = isGraded && myAnswer && myAnswer !== q.correctAnswer;
        // Tema — după CONȚINUT (text + variante), nu după poziție.
        const themeKey = detectTriviaTheme(q);
        const theme = TRIVIA_THEMES[themeKey] || TRIVIA_THEMES.generic;
        const showFlags = themeKey === "duel2v2" || themeKey === "vs";
        const disabled = isLocked || resolved || submitting === q.id;
        const renderOption = (key, label) => {
          const selected = myAnswer === key;
          const gradedCorrect = isGraded && q.correctAnswer === key;
          const optStyle = {
            ...s.optionBtn,
            ...(selected ? { ...s.optionBtnSelected, color: theme.onAccent || "#12141C", background: theme.accent, borderColor: theme.accent, boxShadow: `0 0 0 2px rgba(255,255,255,0.12), 0 6px 16px ${theme.accent}55` } : {}),
            ...(isGraded && selected && !gradedCorrect ? s.optionBtnWrong : {}),
            ...(gradedCorrect ? s.optionBtnCorrect : {}),
            ...(disabled && !selected ? { opacity: 0.55 } : {}),
          };
          return (
            <button type="button" disabled={disabled} onClick={() => handleAnswer(q.id, key)} style={optStyle}>
              {showFlags && (
                <span style={s.optionFlags}>
                  {teamsInText(label).slice(0, 2).map((t) => <Flag key={t} team={t} w={18} h={12} />)}
                </span>
              )}
              <span>{selected ? "✓ " : ""}{label}</span>
            </button>
          );
        };
        return (
          <div key={q.id} style={{ ...s.questionCard, background: theme.bg, borderLeft: `4px solid ${theme.accent}` }}>
            <div style={s.qTop}>
              <TriviaEmblem theme={themeKey} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...s.qChip, color: theme.accent }}>Q{idx + 1} · {theme.label}</div>
                <div style={s.questionText}>
                  {q.text}
                  {isCorrect && <span style={s.correctTag}> ✓</span>}
                  {isWrong && <span style={s.wrongTag}> ✗</span>}
                </div>
              </div>
            </div>
            <div style={s.optionsRow}>
              {renderOption("A", q.optionALabel)}
              {renderOption("B", q.optionBLabel)}
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
  lockedMsg: {
    textAlign: "center", fontSize: 13, fontWeight: 800, color: "#F0A94E", padding: "8px 10px", marginBottom: 12,
    background: "rgba(240,169,78,0.08)", border: "1px solid rgba(240,169,78,0.3)", borderRadius: 8,
  },
  saveErrorMsg: { textAlign: "center", fontSize: 12, color: "#F0555A", marginBottom: 10 },
  wrap: {
    background: "linear-gradient(180deg, rgba(212,175,55,0.08) 0%, rgba(18,20,28,0.97) 30%, rgba(8,9,13,0.99) 100%)",
    border: "1px solid rgba(212,175,55,0.3)", borderRadius: radius.lg, padding: "14px 12px",
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  progress: { fontSize: 11, color: color.textFaint, fontFamily: font.body, fontWeight: 700 },
  baseScore: { fontSize: 12.5, color: color.goldLight, fontFamily: font.body, fontWeight: 800 },

  pitch: {
    position: "relative", display: "flex", alignItems: "center", gap: 3, marginBottom: 12, padding: "6px 8px", borderRadius: 10,
    background: "repeating-linear-gradient(90deg, #1F5A2B 0 18px, #246632 18px 36px)", border: "1px solid rgba(255,255,255,0.18)",
  },
  pitchMidline: { position: "absolute", left: "50%", top: 4, bottom: 4, width: 1, background: "rgba(255,255,255,0.35)" },
  pitchSlot: {
    flex: 1, height: 20, borderRadius: 10, border: "1.5px dashed rgba(255,255,255,0.35)", display: "flex",
    alignItems: "center", justifyContent: "center", fontSize: 12, position: "relative", zIndex: 1,
  },
  pitchSlotOn: { border: "1.5px solid rgba(255,255,255,0.85)", background: "rgba(255,255,255,0.12)" },
  questionCard: { border: `1px solid ${color.border}`, borderRadius: 12, padding: "10px 10px 10px 9px", marginBottom: 9 },
  qTop: { display: "flex", gap: 10, alignItems: "center", marginBottom: 9 },
  qChip: { fontSize: 9.5, fontWeight: 900, letterSpacing: 0.8, fontFamily: font.body, marginBottom: 3, textTransform: "uppercase" },
  questionText: { fontSize: 12.5, fontWeight: 700, color: color.textPrimary, fontFamily: font.body, lineHeight: 1.35 },
  correctTag: { color: "#8BD957", fontWeight: 800 },
  wrongTag: { color: "#F0555A", fontWeight: 800 },
  optionsRow: { display: "flex", gap: 8 },
  optionBtn: {
    flex: 1, minHeight: 42, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
    background: "rgba(18,20,28,0.75)", border: "1.5px solid rgba(255,255,255,0.16)", borderRadius: 10,
    padding: "8px 8px", fontSize: 12, fontWeight: 800, color: color.textPrimary, cursor: "pointer", fontFamily: font.body,
    textAlign: "center", lineHeight: 1.25, transition: "transform 120ms ease, box-shadow 160ms ease",
  },
  optionBtnSelected: { color: "#12141C", transform: "translateY(-1px)" },
  optionBtnCorrect: { background: "rgba(139,217,87,0.22)", borderColor: "#8BD957", color: "#CFF5B5", boxShadow: "none" },
  optionBtnWrong: { background: "rgba(240,85,90,0.22)", borderColor: "#F0555A", color: "#FFC2C4", boxShadow: "none" },
  optionFlags: { display: "flex", gap: 4 },

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
