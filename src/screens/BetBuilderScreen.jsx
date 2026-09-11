import { useEffect, useState } from "react";
import {
  getMyBetBuilderView, saveMyPicks, confirmMyTicket, canRevealOpponent, getOpponentPick,
  computeDuelResult, isBetBuilderLocked,
} from "../services/betBuilderService";
import { buildMockView } from "../betBuilderMockData";
import PageHeader from "../components/PageHeader";
import ClubLogo from "../components/ClubLogo";
import { color, font, radius } from "../matchdayTheme";

// ══════════════════════════════════════════════════════════════════
// 🎟️ BET BUILDER — biletul jucătorului. Stil bookmaker old-school:
// hârtie, ștampilă, bifă de pix. O singură încărcare la deschidere
// (getMyBetBuilderView — un document comun + propriul bilet). Biletul
// adversarului NU se citește NICIODATĂ până propriul bilet nu e
// confirmat (canRevealOpponent) — aceeași convenție ca la predicții.
//
// previewMode — folosit STRICT de Admin (👁 Preview). Când e true:
// ZERO Firestore, în ambele direcții — nici citire, nici scriere.
// Datele vin din betBuilderMockData.js, iar acțiunile (save/confirm)
// modifică STRICT state local. Aceeași componentă exactă pe care o
// vede jucătorul — nicio machetă separată. ──
// ══════════════════════════════════════════════════════════════════
export default function BetBuilderScreen({ user, gameweekId, onBack, embedded = false, previewMode = false, previewState = "A" }) {
  const [loading, setLoading] = useState(!previewMode);
  const [error, setError] = useState("");
  const [view, setView] = useState(previewMode ? buildMockView(previewState) : null); // { duel, matchGroup, opponentUid, myPick, match }
  const [picks, setPicks] = useState(previewMode ? (buildMockView(previewState).myPick?.picks || {}) : {});
  const [tiebreaker, setTiebreaker] = useState(previewMode ? (buildMockView(previewState).myPick?.tiebreakerAnswer ?? "") : "");
  const [saving, setSaving] = useState(false);
  const [opponentPick, setOpponentPick] = useState(previewMode ? buildMockView(previewState).opponentPick || null : null);
  const [stampAnim, setStampAnim] = useState(false);

  // ── Preview: la schimbarea stării simulate (A/B/C/D din Admin),
  // reconstruim TOT din mock, fără nicio interacțiune Firestore. ──
  useEffect(() => {
    if (!previewMode) return;
    const v = buildMockView(previewState);
    setView(v);
    setPicks(v.myPick?.picks || {});
    setTiebreaker(v.myPick?.tiebreakerAnswer ?? "");
    setOpponentPick(v.opponentPick || null);
    setLoading(false);
  }, [previewMode, previewState]);

  useEffect(() => {
    if (previewMode) return; // preview nu citește NICIODATĂ din Firestore
    let cancelled = false;
    (async () => {
      try {
        const v = await getMyBetBuilderView(gameweekId, user.uid);
        if (cancelled) return;
        setView(v);
        if (v?.myPick) {
          setPicks(v.myPick.picks || {});
          setTiebreaker(v.myPick.tiebreakerAnswer ?? "");
          if (canRevealOpponent(v.myPick)) {
            const opp = await getOpponentPick(gameweekId, v.opponentUid);
            if (!cancelled) setOpponentPick(opp);
          }
        }
      } catch (err) {
        console.error("Eroare la încărcarea Bet Builder:", err);
        if (!cancelled) setError("Nu s-a putut încărca Bet Builder-ul.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [gameweekId, user?.uid, previewMode]);


  if (loading) return <div style={s.centerNote}>Se încarcă…</div>;
  if (error || !view) return <div style={s.centerNote}>{error || "Nu ești repartizat într-un duel Bet Builder."}</div>;

  const { duel, matchGroup, opponentUid, myPick, match } = view;
  const locked = isBetBuilderLocked(match) || myPick?.confirmed;
  const questions = matchGroup.questions || [];
  const allAnswered = questions.every((q) => picks[q.id] != null) && tiebreaker !== "";

  async function handleSave(nextPicks, nextTiebreaker) {
    setPicks(nextPicks);
    if (nextTiebreaker !== undefined) setTiebreaker(nextTiebreaker);
    if (previewMode) return; // ZERO Firestore în preview — doar state local
    try {
      await saveMyPicks(gameweekId, user.uid, {
        matchId: matchGroup.matchId, duelId: duel.id, opponentUid,
        picks: nextPicks, tiebreakerAnswer: nextTiebreaker !== undefined ? nextTiebreaker : tiebreaker,
      });
    } catch (err) {
      console.error("Eroare la salvarea biletului:", err);
    }
  }

  async function handleConfirm() {
    if (!allAnswered || saving) return;
    if (previewMode) {
      // Simulare locală, pentru UX — ZERO Firestore.
      setStampAnim(true);
      setView((v) => ({ ...v, myPick: { ...v.myPick, picks, tiebreakerAnswer: tiebreaker, confirmed: true } }));
      setTimeout(() => setStampAnim(false), 900);
      return;
    }
    setSaving(true);
    try {
      await confirmMyTicket(gameweekId, user.uid, questions.length);
      setStampAnim(true);
      setView((v) => ({ ...v, myPick: { ...v.myPick, confirmed: true } }));
      setTimeout(() => setStampAnim(false), 900);
    } catch (err) {
      window.alert(err.message || "Eroare la confirmare.");
    } finally {
      setSaving(false);
    }
  }

  const revealed = !!(myPick?.confirmed && opponentPick?.confirmed);

  return (
    <div style={embedded ? undefined : s.page}>
      <div style={embedded ? undefined : s.wrap}>
        {!embedded && <PageHeader title="🎟️ Bet Builder" subtitle={`${match.homeTeam} vs ${match.awayTeam}`} onBack={onBack} />}

        <div style={s.ticket}>
          <div style={s.ticketHead}>
            <ClubLogo teamName={match.homeTeam} size={26} />
            <span style={s.ticketVs}>VS</span>
            <ClubLogo teamName={match.awayTeam} size={26} />
          </div>
          <div style={s.perforation} />

          {questions.map((q, i) => (
            <QuestionRow
              key={q.id}
              question={q}
              index={i + 1}
              myChoice={picks[q.id]}
              opponentChoice={revealed ? opponentPick.picks[q.id] : undefined}
              result={matchGroup.results[q.id]}
              locked={locked}
              onPick={(optionIdx) => handleSave({ ...picks, [q.id]: optionIdx })}
            />
          ))}

          <div style={s.tiebreakerBox}>
            <div style={s.tiebreakerLabel}>🎯 BARAJ: {matchGroup.tiebreakerText}</div>
            <input
              type="number" disabled={locked} value={tiebreaker}
              onChange={(e) => handleSave(picks, e.target.value === "" ? "" : Number(e.target.value))}
              style={s.tiebreakerInput}
              placeholder="Răspunsul tău"
            />
            {revealed && <div style={s.tiebreakerOpponent}>Adversar: {opponentPick.tiebreakerAnswer}</div>}
          </div>

          {!myPick?.confirmed ? (
            <button type="button" style={{ ...s.confirmBtn, opacity: allAnswered ? 1 : 0.5 }} disabled={!allAnswered || saving} onClick={handleConfirm}>
              ✍️ CONFIRMĂ BILETUL
            </button>
          ) : (
            <div style={{ ...s.stampBox, ...(stampAnim ? s.stampAnimating : null) }}>🔴 BILET ÎNREGISTRAT</div>
          )}
        </div>

        {myPick?.confirmed && !revealed && (
          <div style={s.waitingNote}>⏳ Aștepți adversarul — biletele se dezvăluie imediat ce confirmă și el.</div>
        )}

        {revealed && (
          <RevealSummary myPick={myPick} opponentPick={opponentPick} matchGroup={matchGroup} />
        )}
      </div>
    </div>
  );
}

function QuestionRow({ question, index, myChoice, opponentChoice, result, locked, onPick }) {
  return (
    <div style={s.qRow}>
      <div style={s.qText}>{index}. {question.text}</div>
      <div style={s.qOptions}>
        {question.options.map((opt, optIdx) => {
          const mine = myChoice === optIdx;
          const theirs = opponentChoice === optIdx;
          const isCorrect = result === "hit" ? optIdx === 0 : result === "miss" ? optIdx === 1 : null;
          return (
            <button
              key={optIdx} type="button" disabled={locked}
              onClick={() => onPick(optIdx)}
              style={{
                ...s.qOptionBtn,
                ...(mine ? s.qOptionMine : null),
                ...(isCorrect === true ? s.qOptionHit : isCorrect === false && mine ? s.qOptionMiss : null),
              }}
            >
              {opt}{mine ? " ✏️" : ""}{theirs && !mine ? " (advers.)" : ""}
            </button>
          );
        })}
      </div>
      {result && result !== "pending" && (
        <div style={s.qStatus}>
          {myChoice == null ? "⏳" : (result === "hit" ? myChoice === 0 : myChoice === 1) ? "✅" : "❌"}
        </div>
      )}
    </div>
  );
}

function RevealSummary({ myPick, opponentPick, matchGroup }) {
  const result = computeDuelResult({
    myPicks: myPick.picks, opponentPicks: opponentPick.picks, results: matchGroup.results,
    myTiebreaker: myPick.tiebreakerAnswer, opponentTiebreaker: opponentPick.tiebreakerAnswer,
    tiebreakerRealAnswer: matchGroup.tiebreakerRealAnswer,
  });
  return (
    <div style={s.revealBox}>
      <div style={s.revealScore}>{result.myHits} — {result.oppHits}</div>
      {result.perfect && <div style={s.perfectTag}>🔥 PERFECT BET BUILDER +50</div>}
      {result.allResolved && (
        <div style={s.revealOutcome}>
          {result.duelOutcome === "win" && "⚔️ AI CÂȘTIGAT DUELUL +50"}
          {result.duelOutcome === "lose" && "Adversarul a câștigat duelul"}
          {result.duelOutcome === "draw" && result.duelBonus > 0 && "⚔️ Baraj câștigat +50"}
        </div>
      )}
      <div style={s.revealTotal}>{result.totalPoints != null ? `${result.totalPoints} PCT` : "Se așteaptă rezolvarea"}</div>
    </div>
  );
}

const s = {
  page: { minHeight: "100vh", background: color.bgBase },
  wrap: { maxWidth: 480, margin: "0 auto", padding: "0 16px 32px" },
  centerNote: { textAlign: "center", color: color.textFaint, fontSize: 13, padding: "60px 20px", fontFamily: font.body },

  ticket: {
    background: "#F4EDE0", borderRadius: radius.md, padding: 16, marginTop: 10,
    boxShadow: "0 8px 24px -8px rgba(0,0,0,0.5)", border: "1px dashed #8a7a5c",
  },
  ticketHead: { display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 8 },
  ticketVs: { fontSize: 11, fontWeight: 700, color: "#5a4a30", fontFamily: font.body },
  perforation: { height: 1, background: "repeating-linear-gradient(90deg,#8a7a5c 0 6px,transparent 6px 12px)", margin: "8px 0 14px" },

  qRow: { marginBottom: 14, position: "relative" },
  qText: { fontSize: 12, fontWeight: 700, color: "#2b2418", fontFamily: font.body, marginBottom: 6 },
  qOptions: { display: "flex", gap: 6 },
  qOptionBtn: {
    flex: 1, padding: "8px 6px", borderRadius: 6, border: "1.5px solid #8a7a5c", background: "#fff",
    color: "#2b2418", fontSize: 11.5, fontWeight: 600, fontFamily: font.body, cursor: "pointer",
  },
  qOptionMine: { background: "#2b2418", color: "#F4EDE0", borderColor: "#2b2418" },
  qOptionHit: { background: color.green, borderColor: color.green, color: "#0A0D14" },
  qOptionMiss: { background: "#C24444", borderColor: "#C24444", color: "#fff" },
  qStatus: { position: "absolute", right: -4, top: -6, fontSize: 14 },

  tiebreakerBox: { marginTop: 6, marginBottom: 14, padding: 10, background: "rgba(212,175,55,0.12)", borderRadius: 8 },
  tiebreakerLabel: { fontSize: 11, fontWeight: 700, color: "#5a4a30", marginBottom: 6, fontFamily: font.body },
  tiebreakerInput: { width: "100%", padding: "8px 10px", borderRadius: 6, border: "1.5px solid #8a7a5c", fontSize: 12, fontFamily: font.body },
  tiebreakerOpponent: { fontSize: 10.5, color: "#5a4a30", marginTop: 6, fontFamily: font.body },

  confirmBtn: {
    width: "100%", padding: "13px 0", borderRadius: 10, border: "none", background: color.gold,
    color: "#12141C", fontWeight: 800, fontSize: 13.5, fontFamily: font.body, cursor: "pointer",
  },
  stampBox: {
    width: "100%", textAlign: "center", padding: "12px 0", borderRadius: 10, border: "3px solid #C24444",
    color: "#C24444", fontWeight: 800, fontSize: 14, fontFamily: font.body, transform: "rotate(-3deg)",
  },
  stampAnimating: { animation: "none" },

  waitingNote: { textAlign: "center", color: color.textFaint, fontSize: 12, marginTop: 14, fontFamily: font.body },

  revealBox: { marginTop: 16, background: color.surfaceInset, borderRadius: radius.md, padding: 16, textAlign: "center" },
  revealScore: { fontSize: 26, fontWeight: 800, color: color.textPrimary, fontFamily: font.display },
  perfectTag: { marginTop: 8, color: color.goldLight, fontWeight: 700, fontSize: 12.5, fontFamily: font.body },
  revealOutcome: { marginTop: 6, color: color.textSecondary, fontSize: 12, fontFamily: font.body },
  revealTotal: { marginTop: 10, color: color.goldLight, fontWeight: 800, fontSize: 16, fontFamily: font.body },
};
