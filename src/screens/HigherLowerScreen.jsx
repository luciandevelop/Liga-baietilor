import { useEffect, useState } from "react";
import {
  getMyHigherLowerView, submitHigherLowerPick, submitHigherLowerTiebreaker,
  CHOICE_MORE, CHOICE_LESS,
} from "../services/higherLowerService";
import { buildMockView } from "../higherLowerMockData";
import { getUserPublicProfiles } from "../services/profilesService";
import PageHeader from "../components/PageHeader";
import PlayerAvatar from "../components/PlayerAvatar";
import { color, font, radius } from "../matchdayTheme";

// ══════════════════════════════════════════════════════════════════
// 📈📉 MAI MARE / MAI MIC — ecranul jucătorului. Reveal-ul per rundă e
// IMEDIAT (nu așteaptă deadline-ul) — exact mecanica aprobată: dacă
// adversarul (sau eu) am prioritate și am ales deja, confruntarea
// rundei e vizibilă pe loc; altfel doar "⏳ Așteptăm alegerea lui X...".
// ══════════════════════════════════════════════════════════════════
export default function HigherLowerScreen({ onBack, gameweekId, uid, previewMode, previewState, embedded }) {
  const [view, setView] = useState(null);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [tbInput, setTbInput] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (previewMode) {
      setView(buildMockView(previewState));
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getMyHigherLowerView(gameweekId, uid)
      .then(async (v) => {
        if (cancelled) return;
        setView(v);
        if (v) {
          const p = await getUserPublicProfiles([v.duel.playerA, v.duel.playerB]);
          if (!cancelled) setProfiles(p);
        }
      })
      .catch((err) => console.error("Eroare la încărcarea Mai Mare/Mai Mic:", err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [gameweekId, uid, previewMode, previewState]);

  async function handlePick(round, choice) {
    if (previewMode || busy) return;
    setBusy(true);
    setMsg("");
    try {
      await submitHigherLowerPick(gameweekId, view.duelId, uid, round.question.id, round.roundNumber, choice);
      const v = await getMyHigherLowerView(gameweekId, uid);
      setView(v);
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleTiebreaker() {
    if (previewMode || busy) return;
    const value = Number(tbInput);
    if (!Number.isInteger(value) || value < 0) { setMsg("Introdu un număr întreg ≥ 0."); return; }
    setBusy(true);
    setMsg("");
    try {
      await submitHigherLowerTiebreaker(gameweekId, uid, value);
      const v = await getMyHigherLowerView(gameweekId, uid);
      setView(v);
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  const content = (
    <div style={s.wrap}>
      {!embedded && <PageHeader title="📈📉 Mai Mare / Mai Mic" onBack={onBack} />}
      {loading && <div style={s.centerNote}>Se încarcă…</div>}
      {!loading && !view && <div style={s.centerNote}>Nu ești repartizat într-un duel pentru etapa asta.</div>}

      {!loading && view && (
        <>
          <VsHeader view={view} profiles={profiles} uid={previewMode ? "me" : uid} />
          <div style={s.roundsList}>
            {view.rounds.map((r) => (
              <RoundCard
                key={r.roundNumber} round={r} duel={view.duel} uid={previewMode ? "me" : uid}
                onPick={(choice) => handlePick(r, choice)} busy={busy}
              />
            ))}
          </div>

          <div style={s.tiebreakCard}>
            <div style={s.tiebreakTitle}>⚽ BARAJ — Total goluri în cele 3 meciuri</div>
            {view.myTiebreaker == null ? (
              <div style={s.tiebreakInputRow}>
                <input
                  type="number" min={0} style={s.tiebreakInput} placeholder="ex. 7"
                  value={tbInput} onChange={(e) => setTbInput(e.target.value)}
                />
                <button type="button" style={s.tiebreakBtn} disabled={busy} onClick={handleTiebreaker}>Trimite</button>
              </div>
            ) : (
              <div style={s.tiebreakMine}>Estimarea ta: <b>{view.myTiebreaker}</b> — secretă până la baraj/reveal.</div>
            )}
          </div>

          {msg && <p style={s.msg}>{msg}</p>}

          {view.final && (
            <div style={s.finalCard}>
              <div style={s.finalScore}>{view.winsMine}–{view.winsOpp}</div>
              <div style={s.finalPts}>+{view.final.total} PCT</div>
            </div>
          )}
        </>
      )}
    </div>
  );

  return embedded ? content : <div style={s.page}>{content}</div>;
}

function VsHeader({ view, profiles, uid }) {
  const me = view.me || profiles[uid] || {};
  const opp = view.opponent || profiles[view.opponentUid] || {};
  return (
    <div style={s.vsCard}>
      <div style={s.vsSide}>
        <PlayerAvatar avatarId={me.avatarId} nickname={me.nickname} size={44} />
        <div style={s.vsName}>{me.nickname || "Tu"}</div>
      </div>
      <div style={s.vsMid}>
        <div style={s.vsLabel}>VS</div>
        <div style={s.vsScore}>{view.winsMine}–{view.winsOpp}</div>
      </div>
      <div style={s.vsSide}>
        <PlayerAvatar avatarId={opp.avatarId} nickname={opp.nickname} size={44} />
        <div style={s.vsName}>{opp.nickname || "Adversar"}</div>
      </div>
    </div>
  );
}

function RoundCard({ round, duel, uid, onPick, busy }) {
  const isMine = round.priorityUid === uid;
  const myChoice = duel.playerA === uid ? round.choiceA : round.choiceB;
  const oppChoice = duel.playerA === uid ? round.choiceB : round.choiceA;
  const oppUid = round.priorityUid === uid ? round.otherUid : round.priorityUid;

  return (
    <div style={{ ...s.roundCard, ...(round.result ? s.roundCardDone : {}) }}>
      <div style={s.roundHead}>
        <span style={s.roundNum}>RUNDA {round.roundNumber}</span>
        <span style={s.roundCriteria}>{round.question.criteria} — {round.question.threshold}</span>
      </div>

      {isMine && !round.decided && (
        <div style={s.pickButtons}>
          <button type="button" disabled={busy} style={{ ...s.pickBtn, ...s.pickBtnMore }} onClick={() => onPick(CHOICE_MORE)}>📈 MAI MARE</button>
          <button type="button" disabled={busy} style={{ ...s.pickBtn, ...s.pickBtnLess }} onClick={() => onPick(CHOICE_LESS)}>📉 MAI MIC</button>
        </div>
      )}

      {!isMine && !round.decided && (
        <div style={s.waitingNote}>⏳ Așteptăm alegerea adversarului...</div>
      )}

      {round.decided && (
        <div style={s.faceoffRow}>
          <div style={s.faceoffSide}>
            <div style={s.faceoffLabel}>{isMine ? "TU" : "ADVERSAR"}</div>
            <ChoicePill choice={isMine ? myChoice : oppChoice} />
          </div>
          <div style={s.faceoffSide}>
            <div style={s.faceoffLabel}>{isMine ? "ADVERSAR" : "TU"}</div>
            <ChoicePill choice={isMine ? oppChoice : myChoice} />
          </div>
        </div>
      )}

      {round.result && (
        <div style={s.resultRow}>Rezultat: {round.result === CHOICE_MORE ? "📈 MAI MARE" : "📉 MAI MIC"}</div>
      )}
    </div>
  );
}

function ChoicePill({ choice }) {
  if (!choice) return null;
  const isMore = choice === CHOICE_MORE;
  return (
    <span style={{ ...s.choicePill, ...(isMore ? s.choicePillMore : s.choicePillLess) }}>
      {isMore ? "📈 MAI MARE" : "📉 MAI MIC"}
    </span>
  );
}

const s = {
  page: { minHeight: "100vh", background: color.bgBase },
  wrap: { maxWidth: 480, margin: "0 auto", padding: "0 16px 24px" },
  centerNote: { textAlign: "center", color: color.textFaint, fontSize: 13, padding: "60px 20px", fontFamily: font.body },

  vsCard: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.md,
    padding: "16px 14px", margin: "12px 0",
  },
  vsSide: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: 90 },
  vsName: { color: color.textPrimary, fontSize: 12, fontWeight: 700, fontFamily: font.body, textAlign: "center" },
  vsMid: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4 },
  vsLabel: { color: color.gold, fontSize: 13, fontWeight: 800, fontFamily: font.display, letterSpacing: "0.1em" },
  vsScore: { color: color.textPrimary, fontSize: 22, fontWeight: 800, fontFamily: font.display },

  roundsList: { display: "flex", flexDirection: "column", gap: 8 },
  roundCard: { background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.md, padding: 12 },
  roundCardDone: { borderColor: color.goldBorder || color.border },
  roundHead: { display: "flex", flexDirection: "column", gap: 2, marginBottom: 8 },
  roundNum: { color: color.gold, fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", fontFamily: font.body },
  roundCriteria: { color: color.textSecondary, fontSize: 12, fontFamily: font.body },

  pickButtons: { display: "flex", gap: 8 },
  pickBtn: { flex: 1, padding: "12px 8px", borderRadius: radius.sm, border: "none", fontWeight: 800, fontSize: 13, fontFamily: font.body, cursor: "pointer" },
  pickBtnMore: { background: color.greenBg, border: `1px solid ${color.greenBorder}`, color: color.green },
  pickBtnLess: { background: "rgba(194,68,68,0.14)", border: "1px solid #C24444", color: "#E8837A" },

  waitingNote: { color: color.textFaint, fontSize: 12, fontFamily: font.body, textAlign: "center", padding: "6px 0" },
  faceoffRow: { display: "flex", justifyContent: "space-around", gap: 8 },
  faceoffSide: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4 },
  faceoffLabel: { color: color.textFaint, fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", fontFamily: font.body },
  choicePill: { padding: "4px 10px", borderRadius: radius.pill, fontSize: 11, fontWeight: 700, fontFamily: font.body },
  choicePillMore: { background: color.greenBg, color: color.green },
  choicePillLess: { background: "rgba(194,68,68,0.14)", color: "#E8837A" },
  resultRow: { marginTop: 6, textAlign: "center", color: color.textFaint, fontSize: 11, fontFamily: font.body },

  tiebreakCard: { background: color.surfaceElevated, border: `1px solid ${color.goldBorder || color.border}`, borderRadius: radius.md, padding: 12, marginTop: 12 },
  tiebreakTitle: { color: color.goldLight, fontSize: 12, fontWeight: 700, fontFamily: font.body, marginBottom: 8 },
  tiebreakInputRow: { display: "flex", gap: 8 },
  tiebreakInput: { flex: 1, padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${color.border}`, background: color.surfaceInset, color: color.textPrimary, fontFamily: font.body },
  tiebreakBtn: { padding: "8px 14px", borderRadius: radius.sm, border: "none", background: color.gold, color: "#0A0D14", fontWeight: 700, fontFamily: font.body, cursor: "pointer" },
  tiebreakMine: { color: color.textSecondary, fontSize: 12, fontFamily: font.body },

  msg: { color: "#E8837A", fontSize: 12, fontFamily: font.body, marginTop: 8, textAlign: "center" },

  finalCard: { textAlign: "center", marginTop: 14, padding: 16, background: color.surfaceElevated, borderRadius: radius.md, border: `1px solid ${color.goldBorder || color.border}` },
  finalScore: { fontSize: 28, fontWeight: 800, color: color.textPrimary, fontFamily: font.display },
  finalPts: { fontSize: 16, fontWeight: 700, color: color.goldLight, fontFamily: font.display, marginTop: 4 },
};
