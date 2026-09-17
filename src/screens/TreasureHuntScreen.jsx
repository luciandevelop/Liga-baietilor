import { useEffect, useMemo, useState } from "react";
import {
  freshGameState, buildTreasureHuntPreview, applyOutcome, advanceAfterReveal, cashOut, continueAfterCashout,
  TOTAL_STEPS, MAX_POINTS, TREASURE_BONUS, START_LIVES,
} from "../treasureHuntMockData";
import PageHeader from "../components/PageHeader";
import { color, font, radius } from "../matchdayTheme";

// ══════════════════════════════════════════════════════════════════
// 🏴‍☠️ COMOARA BLESTEMATĂ — Surpriză Mică, max 100 PCT.
// ACEASTĂ RUNDĂ: doar experiența, 100% MOCK — motorul din
// treasureHuntMockData.js e pur (fără Firestore); tranzițiile sunt
// identice cu ce va rula real mai târziu, doar persistența lipsește.
// Harta = progres (atmosferă graduală pe 3 zone). Overlay-ul = decizia
// (destinații ascunse, pre-amestecate înainte de click). CSS/SVG/emoji
// pur, fără librării grafice, fără assets reale (loc rezervat pentru
// /public/treasure-hunt/*.webp ulterior).
// ══════════════════════════════════════════════════════════════════
export default function TreasureHuntScreen({ onBack, previewMode, previewState, embedded }) {
  const [game, setGame] = useState(() => (previewMode ? buildTreasureHuntPreview(previewState) : freshGameState()));
  const [pulse, setPulse] = useState(null); // "up" | "down" | "life" | null, pt. micro-animații scurte

  useEffect(() => {
    if (previewMode) setGame(buildTreasureHuntPreview(previewState));
  }, [previewMode, previewState]);

  function handlePick(doorIndex) {
    if (game.phase !== "choosing") return;
    const next = applyOutcome(game, doorIndex);
    const outcome = next.doors[doorIndex].outcome;
    setPulse(outcome.type === "life" ? "life" : outcome.value > 0 ? "up" : "down");
    setGame(next);
    setTimeout(() => setPulse(null), 650);
  }

  function handleContinueAfterReveal() {
    setGame((g) => advanceAfterReveal(g));
  }

  function handleCashOut() {
    setGame((g) => cashOut(g));
  }

  function handleContinueRisk() {
    setGame((g) => continueAfterCashout(g));
  }

  function handleRestart() {
    setGame(previewMode ? buildTreasureHuntPreview(previewState) : freshGameState());
  }

  const zone = zoneForStep(game.step);

  const content = (
    <div style={s.wrap}>
      <style>{ANIM_CSS}</style>
      {!embedded && <PageHeader title="🏴‍☠️ Comoara Blestemată" onBack={onBack} />}

      <Hud game={game} pulse={pulse} />

      <MapPanel game={game} zone={zone}>
        {game.phase === "choosing" && (
          <ChoiceOverlay doors={game.doors} onPick={handlePick} step={game.step} />
        )}
        {game.phase === "revealed" && (
          <RevealOverlay
            doors={game.doors} chosenIndex={game.chosenIndex}
            onContinue={handleContinueAfterReveal} isLastStep={game.step >= TOTAL_STEPS}
          />
        )}
        {game.phase === "cashout" && (
          <CashoutOverlay total={game.total} onCashOut={handleCashOut} onContinue={handleContinueRisk} />
        )}
        {game.phase === "cashedout" && (
          <FinalOverlay kind="cashedout" total={game.total} onRestart={previewMode ? null : handleRestart} />
        )}
        {game.phase === "treasure" && (
          <FinalOverlay kind="treasure" total={game.total} onRestart={previewMode ? null : handleRestart} />
        )}
        {game.phase === "gameover" && (
          <FinalOverlay kind="gameover" total={0} onRestart={previewMode ? null : handleRestart} />
        )}
      </MapPanel>
    </div>
  );

  return embedded ? content : <div style={s.page}>{content}</div>;
}

function zoneForStep(step) {
  if (step <= 3) return "safe";
  if (step <= 5) return "danger";
  return "cursed";
}

// ══════════════════════════════════════════════════════════════════
// HUD
// ══════════════════════════════════════════════════════════════════
function Hud({ game, pulse }) {
  return (
    <div style={s.hud}>
      <div style={s.hudItem}>🏴‍☠️ PAS {Math.min(game.step, TOTAL_STEPS)}/{TOTAL_STEPS}</div>
      <div className={pulse === "up" ? "th-pulse-up" : pulse === "down" ? "th-pulse-down" : ""} style={{ ...s.hudItem, ...s.hudPoints }}>
        💰 {game.total} PCT
      </div>
      <div className={pulse === "life" ? "th-shake" : ""} style={s.hudItem}>
        {Array.from({ length: START_LIVES }, (_, i) => (i < game.lives ? "❤️" : "🖤")).join("")}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// HARTA — o singură coloană, 7 stații, atmosferă graduală, corabia
// se deplasează cu translateY. Overlay-urile de decizie/reveal/final
// apar DEASUPRA hărții, harta rămâne mereu vizibilă dedesubt.
// ══════════════════════════════════════════════════════════════════
function MapPanel({ game, zone, children }) {
  const shipTopPct = 8 + (Math.min(game.step, TOTAL_STEPS) - 1) * (78 / (TOTAL_STEPS - 1));
  return (
    <div style={{ ...s.map, ...ZONE_BG[zone] }}>
      {zone === "cursed" && <div className="th-lightning" style={s.lightning} />}

      <div style={s.islandFinal}>🏟️🏝️</div>

      {Array.from({ length: TOTAL_STEPS }, (_, i) => {
        const top = 8 + i * (78 / (TOTAL_STEPS - 1));
        const passed = i + 1 < game.step || (i + 1 === game.step && game.phase !== "choosing" && game.phase !== "cashout");
        return <div key={i} style={{ ...s.stationDot, top: `${top}%`, ...(passed ? s.stationDotPassed : {}) }} />;
      })}

      <div className="th-ship" style={{ ...s.ship, top: `${shipTopPct}%` }}>🚢</div>

      {children && <div style={s.overlayBackdrop}>{children}</div>}
    </div>
  );
}

const ZONE_BG = {
  safe: { background: "linear-gradient(180deg, #0E4C5C, #0A3348)" },
  danger: { background: "linear-gradient(180deg, #0A3348, #1A2233)" },
  cursed: { background: "linear-gradient(180deg, #14101F, #05060C)" },
};

// ══════════════════════════════════════════════════════════════════
// OVERLAY — ALEGERE (❓ x3/x4, pre-amestecate)
// ══════════════════════════════════════════════════════════════════
function ChoiceOverlay({ doors, onPick, step }) {
  const isLast = step >= TOTAL_STEPS;
  const rewardLabels = useMemo(() => allOutcomeLabels(doors), [doors]);
  return (
    <div className="th-pop" style={s.overlayCard}>
      <div style={s.overlayHeader}>{isLast ? "☠️ ULTIMA TRECERE" : "🏴‍☠️ ALEGE-ȚI DRUMUL"}</div>
      {isLast && <div style={s.overlaySub}>Insula comorii e foarte aproape. Furtuna e puternică.</div>}

      <div style={s.rewardsRow}>
        {rewardLabels.map((label, i) => (
          <span key={i} style={s.rewardChip}>{label}</span>
        ))}
      </div>

      <div style={{ ...s.doorsGrid, ...(doors.length === 4 ? s.doorsGrid4 : {}) }}>
        {doors.map((d, i) => (
          <button key={i} type="button" style={s.doorBtn} onClick={() => onPick(i)}>
            <span style={s.doorMark}>❓</span>
            <span style={s.doorLabel}>{d.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── STRICT toate cele N sloturi — FĂRĂ deduplicare (două ❤️ −1 VIAȚĂ
// identice trebuie afișate de DOUĂ ori) și amestecate INDEPENDENT de
// ordinea reală a ușilor, ca ordinea afișată să nu trădeze poziția. ──
function allOutcomeLabels(doors) {
  const labels = doors.map((d) => outcomeLabel(d.outcome));
  for (let i = labels.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [labels[i], labels[j]] = [labels[j], labels[i]];
  }
  return labels;
}
function outcomeLabel(o) {
  if (o.type === "life") return "❤️ −1 VIAȚĂ";
  return `${o.value > 0 ? "+" : ""}${o.value} PCT`;
}

// ══════════════════════════════════════════════════════════════════
// OVERLAY — REVEAL (toate simultan, alegerea evidențiată)
// ══════════════════════════════════════════════════════════════════
function RevealOverlay({ doors, chosenIndex, onContinue, isLastStep }) {
  return (
    <div className="th-pop" style={s.overlayCard}>
      <div style={s.overlayHeader}>🗺️ DRUMURILE DEZVĂLUITE</div>
      <div style={s.revealList}>
        {doors.map((d, i) => {
          const isChosen = i === chosenIndex;
          const positive = d.outcome.type === "points" && d.outcome.value > 0;
          const negative = d.outcome.type === "points" && d.outcome.value < 0;
          const isLife = d.outcome.type === "life";
          return (
            <div key={i} style={{ ...s.revealRow, ...(isChosen ? s.revealRowChosen : {}) }}>
              <span style={s.revealLabel}>{d.label}</span>
              <span style={{
                ...s.revealValue,
                ...(positive ? s.revealValuePos : negative ? s.revealValueNeg : isLife ? s.revealValueLife : {}),
              }}>
                {outcomeLabel(d.outcome)}
              </span>
              {isChosen && <span style={s.chosenTag}>🏴‍☠️ AI ALES AICI</span>}
            </div>
          );
        })}
      </div>
      <button type="button" style={s.primaryBtn} onClick={onContinue}>
        {isLastStep ? "Continuă →" : "Corabia avansează →"}
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// OVERLAY — CASH OUT
// ══════════════════════════════════════════════════════════════════
function CashoutOverlay({ total, onCashOut, onContinue }) {
  return (
    <div className="th-pop" style={s.overlayCard}>
      <div style={s.overlayHeader}>⚖️ O DECIZIE TE AȘTEAPTĂ</div>
      <div style={s.cashoutTotal}>{total} PCT</div>
      <div style={s.overlaySub}>Poți păstra ce ai strâns, sau riști mai departe spre comoară.</div>
      <div style={s.cashoutRow}>
        <button type="button" style={{ ...s.primaryBtn, ...s.cashoutBtn }} onClick={onCashOut}>
          💰 MĂ OPRESC — {total} PCT
        </button>
        <button type="button" style={{ ...s.primaryBtn, ...s.continueBtn }} onClick={onContinue}>
          🏴‍☠️ CONTINUI SPRE COMOARĂ
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// OVERLAY — FINAL (cashed-out / comoară / game over)
// ══════════════════════════════════════════════════════════════════
function FinalOverlay({ kind, total, onRestart }) {
  const config = {
    cashedout: { icon: "💰", title: "TE-AI OPRIT LA TIMP", detail: `Ai păstrat ${total} PCT.` },
    treasure: { icon: "🏆", title: "COMOARA GĂSITĂ", detail: `+${TREASURE_BONUS} PCT bonus — total ${total} PCT.` },
    gameover: { icon: "☠️", title: "COMOARA TE-A ÎNVINS", detail: "0 PCT" },
  }[kind];
  return (
    <div className="th-pop" style={{ ...s.overlayCard, ...s.finalCard }}>
      <div style={s.finalIcon}>{config.icon}</div>
      <div style={s.overlayHeader}>{config.title}</div>
      <div style={s.finalTotal}>{total} PCT</div>
      <div style={s.overlaySub}>{config.detail}</div>
      {onRestart && (
        <button type="button" style={s.primaryBtn} onClick={onRestart}>Joacă din nou (mock)</button>
      )}
    </div>
  );
}

const ANIM_CSS = `
@keyframes thPulseUp { 0% { transform: translateY(0) scale(1); } 40% { transform: translateY(-5px) scale(1.08); } 100% { transform: translateY(0) scale(1); } }
@keyframes thPulseDown { 0% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } 100% { transform: translateX(0); } }
@keyframes thShake { 0% { transform: translateX(0); } 20% { transform: translateX(-5px); } 40% { transform: translateX(5px); } 60% { transform: translateX(-3px); } 80% { transform: translateX(3px); } 100% { transform: translateX(0); } }
@keyframes thPop { 0% { transform: scale(0.92); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
@keyframes thShipSway { 0%, 100% { transform: translateX(-50%) rotate(-2deg); } 50% { transform: translateX(-50%) rotate(2deg); } }
@keyframes thLightning { 0%, 92%, 100% { opacity: 0; } 94% { opacity: 0.9; } 96% { opacity: 0.15; } 98% { opacity: 0.7; } }
.th-pulse-up { animation: thPulseUp 0.5s ease; }
.th-pulse-down { animation: thPulseDown 0.4s ease; }
.th-shake { animation: thShake 0.5s ease; }
.th-pop { animation: thPop 0.25s ease; }
.th-ship { animation: thShipSway 3s ease-in-out infinite; transition: top 0.6s ease; }
.th-lightning { animation: thLightning 4.5s linear infinite; }
@media (prefers-reduced-motion: reduce) {
  .th-pulse-up, .th-pulse-down, .th-shake, .th-pop, .th-ship, .th-lightning { animation: none !important; }
}
`;

const s = {
  page: { minHeight: "100vh", background: color.bgBase },
  wrap: { maxWidth: 460, margin: "0 auto", padding: "0 14px 24px" },

  hud: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    background: color.surfaceElevated, border: `1px solid ${color.border}`, borderRadius: radius.md,
    padding: "10px 14px", margin: "12px 0",
  },
  hudItem: { color: color.textPrimary, fontSize: 13, fontWeight: 800, fontFamily: font.body },
  hudPoints: { color: color.goldLight, fontSize: 15 },

  map: {
    position: "relative", borderRadius: radius.lg, overflow: "hidden",
    minHeight: 420, border: `1px solid ${color.border}`,
  },
  lightning: { position: "absolute", inset: 0, background: "#FFFFFF", pointerEvents: "none" },
  islandFinal: { position: "absolute", top: "2%", left: "50%", transform: "translateX(-50%)", fontSize: 30, filter: "drop-shadow(0 0 10px rgba(255,215,0,0.4))" },
  stationDot: {
    position: "absolute", left: "50%", transform: "translateX(-50%)", width: 10, height: 10, borderRadius: "50%",
    background: "rgba(255,255,255,0.25)", border: "1px solid rgba(255,255,255,0.4)",
  },
  stationDotPassed: { background: color.gold, border: `1px solid ${color.goldLight}` },
  ship: { position: "absolute", left: "50%", fontSize: 30, filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))" },

  overlayBackdrop: {
    position: "absolute", inset: 0, background: "rgba(5,6,12,0.72)",
    display: "flex", alignItems: "center", justifyContent: "center", padding: 14,
  },
  overlayCard: {
    width: "100%", maxWidth: 380, background: "linear-gradient(180deg, #2A2116, #1C1710)",
    border: `1px solid ${color.goldBorder}`, borderRadius: radius.lg, padding: "18px 16px", textAlign: "center",
  },
  overlayHeader: { color: color.goldLight, fontSize: 15, fontWeight: 800, fontFamily: font.display, letterSpacing: "0.03em" },
  overlaySub: { color: color.textSecondary, fontSize: 12, fontFamily: font.body, marginTop: 6, lineHeight: 1.4 },

  rewardsRow: { display: "flex", justifyContent: "center", gap: 6, flexWrap: "wrap", margin: "12px 0" },
  rewardChip: { fontSize: 11, fontWeight: 700, color: color.textPrimary, background: "rgba(255,255,255,0.08)", borderRadius: radius.pill, padding: "4px 10px", fontFamily: font.body },

  doorsGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 6 },
  doorsGrid4: { gridTemplateColumns: "repeat(2, 1fr)" },
  doorBtn: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "14px 6px",
    borderRadius: radius.md, border: `1px solid ${color.goldBorder}`, background: "rgba(212,175,55,0.08)",
    cursor: "pointer", minHeight: 64,
  },
  doorMark: { fontSize: 22 },
  doorLabel: { fontSize: 10, fontWeight: 800, color: color.goldLight, fontFamily: font.body, letterSpacing: "0.03em" },

  revealList: { display: "flex", flexDirection: "column", gap: 6, marginTop: 12, marginBottom: 14 },
  revealRow: {
    display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 4,
    padding: "8px 10px", borderRadius: radius.sm, background: "rgba(255,255,255,0.04)",
  },
  revealRowChosen: { background: "rgba(212,175,55,0.16)", border: `1px solid ${color.gold}` },
  revealLabel: { fontSize: 12, fontWeight: 700, color: color.textPrimary, fontFamily: font.body },
  revealValue: { fontSize: 13, fontWeight: 800, fontFamily: font.body, color: color.textSecondary },
  revealValuePos: { color: color.green },
  revealValueNeg: { color: "#E8837A" },
  revealValueLife: { color: "#E8837A" },
  chosenTag: { width: "100%", fontSize: 10, fontWeight: 800, color: color.gold, fontFamily: font.body },

  cashoutTotal: { fontSize: 32, fontWeight: 900, color: color.goldLight, fontFamily: font.display, margin: "8px 0" },
  cashoutRow: { display: "flex", flexDirection: "column", gap: 8, marginTop: 14 },
  cashoutBtn: { background: color.greenBg, border: `2px solid ${color.greenBorder}`, color: color.green },
  continueBtn: { background: "rgba(212,175,55,0.12)", border: `2px solid ${color.gold}`, color: color.goldLight },

  finalCard: {},
  finalIcon: { fontSize: 38, marginBottom: 4 },
  finalTotal: { fontSize: 30, fontWeight: 900, color: color.goldLight, fontFamily: font.display, margin: "8px 0" },

  primaryBtn: {
    width: "100%", padding: "13px 10px", borderRadius: radius.md, border: "none",
    background: color.goldGradient, color: "#12141C", fontWeight: 800, fontSize: 13, fontFamily: font.body,
    cursor: "pointer", marginTop: 10,
  },
};
