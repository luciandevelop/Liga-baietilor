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
// 📈📉 MAI MARE / MAI MIC — identitate GAME SHOW / VS / ARENĂ.
// Runda activă domină ecranul (hero card); celelalte 5 sunt un rând
// compact de puncte, navigabile. Reveal-ul per rundă rămâne IMEDIAT
// (mecanica NU s-a schimbat) — doar prezentarea e nouă. CSS/HTML
// pur, fără librării grafice, animații scurte via <style> local,
// respectă prefers-reduced-motion.
// ══════════════════════════════════════════════════════════════════
export default function HigherLowerScreen({ onBack, gameweekId, uid, previewMode, previewState, embedded }) {
  const [view, setView] = useState(null);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [tbInput, setTbInput] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedRound, setSelectedRound] = useState(null); // null = urmează activeRoundIndex
  const [justPicked, setJustPicked] = useState(null); // pt. micro-animația de impuls

  useEffect(() => {
    if (previewMode) {
      setView(buildMockView(previewState));
      setLoading(false);
      setSelectedRound(null);
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
    setJustPicked(choice);
    try {
      await submitHigherLowerPick(gameweekId, view.duelId, uid, round.question.id, round.roundNumber, choice);
      const v = await getMyHigherLowerView(gameweekId, uid);
      setView(v);
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy(false);
      setTimeout(() => setJustPicked(null), 500);
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

  if (loading || !view) {
    const content = (
      <div style={s.wrap}>
        {!embedded && <PageHeader title="📈📉 Mai Mare / Mai Mic" onBack={onBack} />}
        <div style={s.centerNote}>{loading ? "Se încarcă…" : "Nu ești repartizat într-un duel pentru etapa asta."}</div>
      </div>
    );
    return embedded ? content : <div style={s.page}>{content}</div>;
  }

  const activeIdx = view.activeRoundIndex ?? view.rounds.findIndex((r) => !r.result);
  const shownIdx = selectedRound != null ? selectedRound : (activeIdx === -1 ? view.rounds.length - 1 : activeIdx);
  const shownRound = view.rounds[shownIdx];
  const effectiveUid = previewMode ? "me" : uid;
  const isLastRound = shownRound?.roundNumber === 6;
  const isDecidingRound = isLastRound && !shownRound?.decided && shownRound?.priorityUid === effectiveUid;

  const content = (
    <div style={s.wrap}>
      <style>{ANIM_CSS}</style>
      {!embedded && <PageHeader title="📈📉 Mai Mare / Mai Mic" onBack={onBack} />}

      <ArenaHeader view={view} profiles={profiles} uid={effectiveUid} />

      <DotProgress rounds={view.rounds} shownIdx={shownIdx} onSelect={setSelectedRound} />

      {isDecidingRound && <div style={s.lastRoundBanner}>⚔️ DUELUL SE DECIDE ACUM</div>}

      {shownRound && (
        <HeroRoundCard
          round={shownRound} duel={view.duel} uid={effectiveUid}
          opponentName={(view.opponent || profiles[view.opponentUid])?.nickname || "adversar"}
          isActive={shownIdx === activeIdx}
          onPick={(choice) => handlePick(shownRound, choice)} busy={busy} justPicked={justPicked}
        />
      )}

      {activeIdx === -1 && (
        <TiebreakSection
          view={view} tbInput={tbInput} setTbInput={setTbInput} onSubmit={handleTiebreaker} busy={busy}
        />
      )}

      {msg && <p style={s.msg}>{msg}</p>}

      {view.final && <FinalCard view={view} />}
    </div>
  );

  return embedded ? content : <div style={s.page}>{content}</div>;
}

// ══════════════════════════════════════════════════════════════════
// A — ARENA HEADER
// ══════════════════════════════════════════════════════════════════
function ArenaHeader({ view, profiles, uid }) {
  const me = view.me || profiles[uid] || {};
  const opp = view.opponent || profiles[view.opponentUid] || {};
  const resolvedCount = view.rounds.filter((r) => r.result != null).length;
  return (
    <div style={s.arena}>
      <div style={s.arenaSide}>
        <div style={s.avatarRing}>
          <PlayerAvatar avatarId={me.avatarId} nickname={me.nickname} size={56} />
        </div>
        <div style={s.arenaName}>{me.nickname || "Tu"}</div>
      </div>

      <div style={s.arenaMid}>
        <div className="hl-vs-pulse" style={s.vsBadge}>VS</div>
        <div style={s.arenaScore}>{view.winsMine}–{view.winsOpp}</div>
        <div style={s.arenaSub}>{resolvedCount === 6 ? "TOATE RUNDELE VALIDATE" : `PROGRES DUEL — ${resolvedCount}/6 RUNDE VALIDATE`}</div>
      </div>

      <div style={s.arenaSide}>
        <div style={s.avatarRing}>
          <PlayerAvatar avatarId={opp.avatarId} nickname={opp.nickname} size={56} />
        </div>
        <div style={s.arenaName}>{opp.nickname || "Adversar"}</div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// B — PROGRES COMPACT, 6 NODURI NAVIGABILE
// ══════════════════════════════════════════════════════════════════
function DotProgress({ rounds, shownIdx, onSelect }) {
  return (
    <div style={s.dotsRow}>
      {rounds.map((r, i) => {
        let dotStyle = s.dotPending;
        let mark = String(r.roundNumber);
        if (r.decided && !r.result) { dotStyle = s.dotWaiting; mark = "•"; }
        if (r.result != null) {
          const won = r.choiceA === r.result; // choiceA = "eu" mereu, în view-ul propriu
          dotStyle = won ? s.dotWin : s.dotLoss;
          mark = won ? "✓" : "✕";
        }
        return (
          <button
            key={r.roundNumber} type="button"
            style={{ ...s.dot, ...dotStyle, ...(i === shownIdx ? s.dotActive : {}) }}
            onClick={() => onSelect(i)}
          >
            {mark}
          </button>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// C + D + F — HERO CARD (runda selectată/activă)
// ══════════════════════════════════════════════════════════════════
function HeroRoundCard({ round, duel, uid, opponentName, isActive, onPick, busy, justPicked }) {
  const isMine = round.priorityUid === uid;
  const myChoice = duel.playerA === uid ? round.choiceA : round.choiceB;
  const oppChoice = duel.playerA === uid ? round.choiceB : round.choiceA;

  return (
    <div style={s.hero}>
      <div style={s.heroTag}>{isActive ? `RUNDA ACTIVĂ ${round.roundNumber} / 6` : `REVEZI RUNDA ${round.roundNumber} / 6`}</div>
      <div style={s.heroMatch}>⚽ {round.question.matchLabel || round.question.criteria}</div>
      <div style={s.heroCriteria}>{round.question.criteria}{round.question.unit ? ` (${round.question.unit})` : ""}</div>
      <div style={s.heroThreshold}>{round.question.threshold}</div>

      {!round.decided && (
        isMine ? (
          <div style={s.pickRow}>
            <button
              type="button" disabled={busy}
              className={justPicked === CHOICE_LESS ? "hl-pulse-down" : ""}
              style={{ ...s.pickBtn, ...s.pickBtnLess }}
              onClick={() => onPick(CHOICE_LESS)}
            >
              <span style={s.pickIcon}>📉</span><span>MAI MIC</span>
            </button>
            <div style={s.pickVs}>VS</div>
            <button
              type="button" disabled={busy}
              className={justPicked === CHOICE_MORE ? "hl-pulse-up" : ""}
              style={{ ...s.pickBtn, ...s.pickBtnMore }}
              onClick={() => onPick(CHOICE_MORE)}
            >
              <span style={s.pickIcon}>📈</span><span>MAI MARE</span>
            </button>
          </div>
        ) : (
          <div style={s.waitingBox}>⏳ Așteptăm alegerea lui {opponentName}...</div>
        )
      )}

      {round.decided && (
        <div className="hl-pop" style={s.faceoff}>
          <div style={s.faceoffCol}>
            <div style={s.faceoffLabel}>TU</div>
            <ChoiceBadge choice={myChoice} />
          </div>
          <div style={s.faceoffDivider}>VS</div>
          <div style={s.faceoffCol}>
            <div style={s.faceoffLabel}>ADVERSAR</div>
            <ChoiceBadge choice={oppChoice} />
          </div>
        </div>
      )}

      {round.result && (
        <div style={s.resultBlock}>
          <div style={s.resultLabel}>REZULTAT REAL</div>
          <ChoiceBadge choice={round.result} big />
          <WinnerLine myChoice={myChoice} result={round.result} />
        </div>
      )}
    </div>
  );
}

function ChoiceBadge({ choice, big }) {
  if (!choice) return null;
  const isMore = choice === CHOICE_MORE;
  return (
    <span style={{ ...s.choiceBadge, ...(isMore ? s.choiceBadgeMore : s.choiceBadgeLess), ...(big ? s.choiceBadgeBig : {}) }}>
      {isMore ? "📈 MAI MARE" : "📉 MAI MIC"}
    </span>
  );
}

function WinnerLine({ myChoice, result }) {
  const won = myChoice === result;
  return (
    <div style={{ ...s.winnerLine, ...(won ? s.winnerLineWin : s.winnerLineLoss) }}>
      {won ? <>TU · +25 PCT ✓</> : <>ADVERSAR · +25 PCT</>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// G — BARAJ
// ══════════════════════════════════════════════════════════════════
function TiebreakSection({ view, tbInput, setTbInput, onSubmit, busy }) {
  if (!view.tiebreakNeeded && view.myTiebreaker == null) return null;
  return (
    <div style={s.tiebreak}>
      <div style={s.tiebreakHeader}>⚽ BARAJ</div>
      <div style={s.tiebreakScore}>{view.winsMine}–{view.winsOpp}</div>
      <div style={s.tiebreakSub}>TOTAL GOLURI ÎN CELE 3 MECIURI</div>

      {view.myTiebreaker == null ? (
        <div style={s.tiebreakInputRow}>
          <input
            type="number" min={0} style={s.tiebreakInput} placeholder="ex. 7"
            value={tbInput} onChange={(e) => setTbInput(e.target.value)}
          />
          <button type="button" style={s.tiebreakBtn} disabled={busy} onClick={onSubmit}>Trimite</button>
        </div>
      ) : !view.tbRevealed ? (
        <div style={s.tiebreakRow}>
          <div style={s.tiebreakCol}>
            <div style={s.tiebreakColLabel}>ESTIMAREA TA</div>
            <div style={s.tiebreakValue}>{view.myTiebreaker}</div>
          </div>
          <div style={s.tiebreakCol}>
            <div style={s.tiebreakColLabel}>ADVERSAR</div>
            <div style={s.tiebreakValueSecret}>SECRETĂ</div>
          </div>
        </div>
      ) : (
        <div style={s.tiebreakRow}>
          <div style={s.tiebreakCol}>
            <div style={s.tiebreakColLabel}>ESTIMAREA TA</div>
            <div style={s.tiebreakValue}>{view.myTiebreaker}</div>
          </div>
          <div style={s.tiebreakCol}>
            <div style={s.tiebreakColLabel}>REAL</div>
            <div style={s.tiebreakValueReal}>{view.realGoalsTotal}</div>
          </div>
          <div style={s.tiebreakCol}>
            <div style={s.tiebreakColLabel}>ADVERSAR</div>
            <div style={s.tiebreakValue}>{view.oppTiebreaker}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// H — FINALUL DUELULUI, transparent, verificabil
// ══════════════════════════════════════════════════════════════════
function FinalCard({ view }) {
  const f = view.final;
  const won = f.totalMine > f.totalOpp;
  const perfectTie = f.tiebreakUsed && f.tiebreakWinner === "tie";
  return (
    <div className="hl-pop" style={s.finalCard}>
      <div style={s.finalHeadline}>
        {perfectTie ? "🤝 EGALITATE PERFECTĂ LA BARAJ" : won ? (f.tiebreakUsed ? "🏆 AI CÂȘTIGAT BARAJUL" : "🏆 AI CÂȘTIGAT DUELUL") : "DUEL ÎNCHEIAT"}
      </div>
      <div style={s.finalScoreBig}>{f.winsMine}–{f.winsOpp}</div>

      <div style={s.finalBreakdown}>
        <div style={s.finalLine}><span>RUNDE</span><span style={s.finalLineVal}>{f.winsMine} × 25 = {f.winsMine * 25} PCT</span></div>
        {f.bonusMine > 0 && (
          <div style={s.finalLine}>
            <span>{perfectTie ? "EGALITATE BARAJ" : f.tiebreakUsed ? "BONUS BARAJ" : "BONUS VICTORIE"}</span>
            <span style={s.finalLineVal}>+{f.bonusMine} PCT</span>
          </div>
        )}
        <div style={{ ...s.finalLine, ...s.finalLineTotal }}><span>TOTAL</span><span style={s.finalLineVal}>{f.totalMine} PCT</span></div>
      </div>
    </div>
  );
}

const ANIM_CSS = `
@keyframes hlPulseUp { 0% { transform: translateY(0); } 40% { transform: translateY(-4px); } 100% { transform: translateY(0); } }
@keyframes hlPulseDown { 0% { transform: translateY(0); } 40% { transform: translateY(4px); } 100% { transform: translateY(0); } }
@keyframes hlPop { 0% { transform: scale(0.9); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
@keyframes hlVsPulse { 0%, 100% { opacity: 0.7; } 50% { opacity: 1; } }
.hl-pulse-up { animation: hlPulseUp 0.35s ease; }
.hl-pulse-down { animation: hlPulseDown 0.35s ease; }
.hl-pop { animation: hlPop 0.25s ease; }
.hl-vs-pulse { animation: hlVsPulse 1.8s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .hl-pulse-up, .hl-pulse-down, .hl-pop, .hl-vs-pulse { animation: none !important; }
}
`;

const s = {
  page: { minHeight: "100vh", background: color.bgBase },
  wrap: { maxWidth: 460, margin: "0 auto", padding: "0 14px 24px" },
  centerNote: { textAlign: "center", color: color.textFaint, fontSize: 13, padding: "60px 20px", fontFamily: font.body },

  arena: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    background: `linear-gradient(180deg, ${color.surfaceElevated}, ${color.surface})`,
    border: `1px solid ${color.goldBorder || color.border}`, borderRadius: radius.lg,
    padding: "18px 10px", margin: "12px 0",
  },
  arenaSide: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: 84 },
  avatarRing: { borderRadius: "50%", padding: 3, border: `2px solid ${color.goldBorder || color.gold}` },
  arenaName: { color: color.textPrimary, fontSize: 11.5, fontWeight: 700, fontFamily: font.body, textAlign: "center" },
  arenaMid: { display: "flex", flexDirection: "column", alignItems: "center", gap: 2 },
  vsBadge: {
    fontSize: 13, fontWeight: 900, color: "#0A0D14", fontFamily: font.display, letterSpacing: "0.08em",
    background: color.goldGradient || color.gold, borderRadius: radius.pill, padding: "3px 12px", marginBottom: 4,
  },
  arenaScore: { color: color.textPrimary, fontSize: 30, fontWeight: 900, fontFamily: font.display, lineHeight: 1 },
  arenaSub: { color: color.textFaint, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.06em", fontFamily: font.body, marginTop: 2 },

  dotsRow: { display: "flex", justifyContent: "center", gap: 8, margin: "4px 0 12px" },
  dot: {
    width: 30, height: 30, borderRadius: "50%", border: "none", fontSize: 12, fontWeight: 800,
    fontFamily: font.body, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  },
  dotPending: { background: color.surface, color: color.textFaint, border: `1px solid ${color.border}` },
  dotWaiting: { background: "rgba(255,255,255,0.06)", color: color.textFaint, border: `1px solid ${color.border}` },
  dotWin: { background: color.greenBg, color: color.green, border: `1px solid ${color.greenBorder}` },
  dotLoss: { background: "rgba(194,68,68,0.14)", color: "#E8837A", border: "1px solid #C24444" },
  dotActive: { boxShadow: `0 0 0 2px ${color.gold}`, transform: "scale(1.12)" },

  lastRoundBanner: {
    textAlign: "center", color: "#0A0D14", background: color.goldGradient || color.gold, fontWeight: 800,
    fontSize: 12, fontFamily: font.body, borderRadius: radius.pill, padding: "6px 10px", marginBottom: 10,
  },

  hero: {
    background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.lg,
    padding: "18px 16px", textAlign: "center", marginBottom: 12,
  },
  heroTag: { color: color.gold, fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", fontFamily: font.body },
  heroMatch: { color: color.textPrimary, fontSize: 14, fontWeight: 700, fontFamily: font.body, marginTop: 6 },
  heroCriteria: { color: color.textSecondary, fontSize: 12, fontFamily: font.body, marginTop: 2 },
  heroThreshold: { color: color.textPrimary, fontSize: 46, fontWeight: 900, fontFamily: font.display, margin: "8px 0 14px", lineHeight: 1 },

  pickRow: { display: "flex", alignItems: "center", gap: 8 },
  pickVs: { color: color.textFaint, fontSize: 11, fontWeight: 800, fontFamily: font.body },
  pickBtn: {
    flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
    padding: "16px 8px", borderRadius: radius.md, border: "none", fontWeight: 800, fontSize: 13,
    fontFamily: font.body, cursor: "pointer",
  },
  pickIcon: { fontSize: 22 },
  pickBtnMore: { background: color.greenBg, border: `2px solid ${color.greenBorder}`, color: color.green },
  pickBtnLess: { background: "rgba(194,68,68,0.14)", border: "2px solid #C24444", color: "#E8837A" },

  waitingBox: { color: color.textFaint, fontSize: 13, fontFamily: font.body, padding: "18px 0" },

  faceoff: { display: "flex", alignItems: "center", justifyContent: "center", gap: 14 },
  faceoffCol: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6 },
  faceoffLabel: { color: color.textFaint, fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", fontFamily: font.body },
  faceoffDivider: { color: color.gold, fontSize: 12, fontWeight: 800, fontFamily: font.body },

  choiceBadge: { padding: "6px 12px", borderRadius: radius.pill, fontSize: 12, fontWeight: 800, fontFamily: font.body },
  choiceBadgeMore: { background: color.greenBg, color: color.green },
  choiceBadgeLess: { background: "rgba(194,68,68,0.14)", color: "#E8837A" },
  choiceBadgeBig: { fontSize: 15, padding: "8px 16px" },

  resultBlock: { marginTop: 14, paddingTop: 14, borderTop: `1px dashed ${color.border}` },
  resultLabel: { color: color.textFaint, fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", fontFamily: font.body, marginBottom: 6 },
  winnerLine: { marginTop: 8, fontSize: 12.5, fontWeight: 800, fontFamily: font.body },
  winnerLineWin: { color: color.green },
  winnerLineLoss: { color: color.textFaint },

  msg: { color: "#E8837A", fontSize: 12, fontFamily: font.body, marginTop: 8, textAlign: "center" },

  tiebreak: {
    background: `linear-gradient(180deg, ${color.surfaceElevated}, ${color.surface})`,
    border: `1px solid ${color.goldBorder || color.gold}`, borderRadius: radius.lg,
    padding: "16px", textAlign: "center", marginBottom: 12,
  },
  tiebreakHeader: { color: color.goldLight, fontSize: 13, fontWeight: 800, letterSpacing: "0.06em", fontFamily: font.body },
  tiebreakScore: { color: color.textPrimary, fontSize: 26, fontWeight: 900, fontFamily: font.display, margin: "4px 0" },
  tiebreakSub: { color: color.textFaint, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.04em", fontFamily: font.body, marginBottom: 12 },
  tiebreakInputRow: { display: "flex", gap: 8, justifyContent: "center" },
  tiebreakInput: { width: 100, padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${color.border}`, background: color.surfaceInset, color: color.textPrimary, fontFamily: font.body, textAlign: "center", fontSize: 16 },
  tiebreakBtn: { padding: "10px 16px", borderRadius: radius.sm, border: "none", background: color.gold, color: "#0A0D14", fontWeight: 800, fontFamily: font.body, cursor: "pointer" },
  tiebreakRow: { display: "flex", justifyContent: "center", gap: 20 },
  tiebreakCol: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4 },
  tiebreakColLabel: { color: color.textFaint, fontSize: 9.5, fontWeight: 800, letterSpacing: "0.05em", fontFamily: font.body },
  tiebreakValue: { color: color.textPrimary, fontSize: 22, fontWeight: 800, fontFamily: font.display },
  tiebreakValueReal: { color: color.gold, fontSize: 22, fontWeight: 800, fontFamily: font.display },
  tiebreakValueSecret: { color: color.textFaint, fontSize: 12, fontWeight: 700, fontFamily: font.body, fontStyle: "italic" },

  finalCard: {
    textAlign: "center", padding: "20px 16px",
    background: `linear-gradient(180deg, ${color.surfaceElevated}, ${color.surface})`,
    borderRadius: radius.lg, border: `1px solid ${color.goldBorder || color.gold}`,
  },
  finalHeadline: { color: color.goldLight, fontSize: 14, fontWeight: 800, fontFamily: font.body, marginBottom: 6 },
  finalScoreBig: { color: color.textPrimary, fontSize: 34, fontWeight: 900, fontFamily: font.display, marginBottom: 14 },
  finalBreakdown: { display: "flex", flexDirection: "column", gap: 6, maxWidth: 220, margin: "0 auto" },
  finalLine: { display: "flex", justifyContent: "space-between", color: color.textSecondary, fontSize: 12.5, fontFamily: font.body },
  finalLineVal: { color: color.textPrimary, fontWeight: 700 },
  finalLineTotal: { borderTop: `1px solid ${color.border}`, paddingTop: 8, marginTop: 4, fontWeight: 800, color: color.goldLight, fontSize: 15 },
};
