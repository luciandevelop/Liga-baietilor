import { useEffect, useMemo, useState } from "react";
import {
  freshGameState, buildTreasureHuntPreview, applyOutcome, advanceAfterReveal, cashOut, continueAfterCashout,
  TOTAL_STEPS, TREASURE_BONUS, START_LIVES,
} from "../treasureHuntMockData";
import {
  RISK_ZONE_INTRO, CURSED_ZONE_INTRO, LAST_LIFE_WARNING_TITLE, LAST_LIFE_WARNING_BODY, lastLifeCashoutLine,
  bigPositiveLine, negativeLine, LIFE_LOST_FIRST, LIFE_LOST_SECOND, GAME_OVER_LINES, TREASURE_FOUND_LINES,
  PERFECT_100_LINES, cashoutLine,
} from "../treasureHuntTexts";
import PageHeader from "../components/PageHeader";
import { color, font, radius } from "../matchdayTheme";

const ASSET = {
  ship: "/treasure-hunt/ship.webp",
  island: "/treasure-hunt/treasure-island.webp",
  chestClosed: "/treasure-hunt/chest-closed.webp",
  chestOpen: "/treasure-hunt/chest-open.webp",
  lifeLost: "/treasure-hunt/life-lost.webp",
};

function pickOnce(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ══════════════════════════════════════════════════════════════════
// 🏴‍☠️ COMOARA BLESTEMATĂ — Surpriză Mică, max 100 PCT.
// REDESIGN VIZUAL — motorul (treasureHuntMockData.js) e neschimbat în
// reguli/valori; doar SECVENȚIEREA fazei "gameover" a fost mutată după
// reveal (cerut explicit, "momentul de reacție" înainte de game over).
// 100% MOCK, ZERO Firestore.
// ══════════════════════════════════════════════════════════════════
export default function TreasureHuntScreen({ onBack, previewMode, previewState, embedded }) {
  const [game, setGame] = useState(() => (previewMode ? buildTreasureHuntPreview(previewState) : freshGameState()));
  const [pulse, setPulse] = useState(null);
  const [traveling, setTraveling] = useState(false);

  useEffect(() => {
    if (previewMode) { setGame(buildTreasureHuntPreview(previewState)); setTraveling(false); }
  }, [previewMode, previewState]);

  function handlePick(doorIndex) {
    if (game.phase !== "choosing") return;
    const next = applyOutcome(game, doorIndex);
    const outcome = next.doors[doorIndex].outcome;
    setPulse(outcome.type === "life" ? "life" : outcome.value > 0 ? "up" : "down");
    setGame(next);
    setTimeout(() => setPulse(null), 650);
  }

  // ── Navigarea efectivă a corăbiei: overlay-ul se retrage, harta
  // rămâne vizibilă, corabia se mută (transition CSS pe poziție),
  // ABIA APOI intră faza reală următoare (alegere/cash-out/etc). ──
  function travelThenCommit(nextState) {
    setTraveling(true);
    setGame((g) => ({ ...g, step: nextState.step })); // doar poziția se schimbă acum
    setTimeout(() => {
      setGame(nextState);
      setTraveling(false);
    }, 700);
  }

  function handleContinueAfterReveal() {
    const next = advanceAfterReveal(game);
    if (next.phase === "choosing" && next.step !== game.step) travelThenCommit(next);
    else setGame(next);
  }

  function handleCashOut() {
    setGame((g) => cashOut(g));
  }

  function handleContinueRisk() {
    const next = continueAfterCashout(game);
    travelThenCommit(next);
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

      <MapPanel game={game} zone={zone} traveling={traveling}>
        {!traveling && game.phase === "choosing" && (
          <ChoiceOverlay doors={game.doors} onPick={handlePick} step={game.step} lives={game.lives} />
        )}
        {!traveling && game.phase === "revealed" && (
          <RevealOverlay
            doors={game.doors} chosenIndex={game.chosenIndex} lives={game.lives}
            onContinue={handleContinueAfterReveal} isLastStep={game.step >= TOTAL_STEPS}
          />
        )}
        {!traveling && game.phase === "cashout" && (
          <CashoutOverlay total={game.total} lives={game.lives} onCashOut={handleCashOut} onContinue={handleContinueRisk} />
        )}
        {!traveling && game.phase === "cashedout" && (
          <FinalOverlay kind="cashedout" total={game.total} onRestart={previewMode ? null : handleRestart} />
        )}
        {!traveling && game.phase === "treasure" && (
          <TreasureFinalOverlay total={game.total} onRestart={previewMode ? null : handleRestart} />
        )}
        {!traveling && game.phase === "gameover" && (
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
// HARTA — assets reale, corabia se deplasează efectiv (transition CSS
// pe poziție), overlay-urile apar DEASUPRA, dar harta rămâne mereu
// vizibilă dedesubt — inclusiv în faza de navigare (fără overlay).
// ══════════════════════════════════════════════════════════════════
function MapPanel({ game, zone, traveling, children }) {
  const shipTopPct = 6 + (Math.min(game.step, TOTAL_STEPS) - 1) * (72 / (TOTAL_STEPS - 1));
  const sinking = game.phase === "gameover" && !traveling;
  return (
    <div style={{ ...s.map, ...ZONE_BG[zone] }}>
      {zone === "cursed" && <div className="th-lightning" style={s.lightning} />}

      <img
        src={ASSET.island} alt="" style={{ ...s.islandImg, opacity: 0.55 + Math.min(game.step, TOTAL_STEPS) * 0.06 }}
      />

      {Array.from({ length: TOTAL_STEPS }, (_, i) => {
        const top = 6 + i * (72 / (TOTAL_STEPS - 1));
        const passed = i + 1 < game.step;
        return <div key={i} style={{ ...s.stationDot, top: `${top}%`, ...(passed ? s.stationDotPassed : {}) }} />;
      })}

      <img
        src={ASSET.ship} alt="Corabia"
        className={sinking ? "th-ship-sink" : "th-ship-sway"}
        style={{ ...s.shipImg, top: `${shipTopPct}%` }}
      />

      {traveling && <div style={s.travelingTag}>⛵ Corabia navighează...</div>}

      {children && !traveling && <div style={s.overlayBackdrop}>{children}</div>}
    </div>
  );
}

const ZONE_BG = {
  safe: { background: "linear-gradient(180deg, #0E4C5C, #0A3348)" },
  danger: { background: "linear-gradient(180deg, #0A3348, #1A2233)" },
  cursed: { background: "linear-gradient(180deg, #14101F, #05060C)" },
};

// ══════════════════════════════════════════════════════════════════
// OVERLAY — ALEGERE. Recompensele posibile ("🎒 POSIBILE") sunt un
// panou SEPARAT, cu ordine amestecată INDEPENDENT de uși — zero
// asociere spațială cu destinațiile.
// ══════════════════════════════════════════════════════════════════
function ChoiceOverlay({ doors, onPick, step, lives }) {
  const isLast = step >= TOTAL_STEPS;
  const isRisk = step >= 4 && step <= 5;
  const isCursed = step >= 6;
  const rewardLabels = useMemo(() => shuffledLabels(doors), [doors]);
  const intro = isCursed ? pickOnce(CURSED_ZONE_INTRO) : isRisk ? pickOnce(RISK_ZONE_INTRO) : null;

  return (
    <div className="th-pop" style={s.overlayCard}>
      <div style={s.overlayHeader}>{isLast ? "☠️ ULTIMA TRECERE" : "🏴‍☠️ ALEGE-ȚI DRUMUL"}</div>
      {isLast && <div style={s.overlaySub}>Insula comorii e foarte aproape. Furtuna e puternică.</div>}
      {intro && !isLast && <div style={s.overlaySub}>{intro}</div>}

      {lives === 1 && step >= 4 && <LastLifeBanner compact />}

      <div style={s.rewardsPouch}>
        <div style={s.rewardsPouchTitle}>🎒 POSIBILE ÎN ACEST PAS</div>
        <div style={s.rewardsPouchRow}>{rewardLabels.join("  ·  ")}</div>
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

function shuffledLabels(doors) {
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

function LastLifeBanner({ compact }) {
  return (
    <div className="th-warn-pulse" style={{ ...s.lastLifeBanner, ...(compact ? s.lastLifeBannerCompact : {}) }}>
      <div style={s.lastLifeTitle}>{LAST_LIFE_WARNING_TITLE}</div>
      {!compact && <div style={s.lastLifeBody}>{pickOnce(LAST_LIFE_WARNING_BODY)}</div>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// OVERLAY — REVEAL. Dacă alegerea a fost o viață pierdută, momentul e
// MARE (asset life-lost, mesaj), apoi lista completă a celor N uși.
// ══════════════════════════════════════════════════════════════════
function RevealOverlay({ doors, chosenIndex, lives, onContinue, isLastStep }) {
  const chosenOutcome = doors[chosenIndex]?.outcome;
  const isLifeLoss = chosenOutcome?.type === "life";
  const isSecondLifeLoss = isLifeLoss && lives <= 0;
  const bigLine = isLifeLoss
    ? pickOnce(isSecondLifeLoss ? LIFE_LOST_SECOND : LIFE_LOST_FIRST)
    : chosenOutcome?.value > 0 ? bigPositiveLine(chosenOutcome.value) : negativeLine(chosenOutcome?.value);

  return (
    <div className="th-pop" style={s.overlayCard}>
      {isLifeLoss && (
        <div className="th-shake" style={s.lifeLostBlock}>
          <img src={ASSET.lifeLost} alt="Ai luat o muie!" style={s.lifeLostImg} />
          <div style={s.lifeLostLine}>{bigLine}</div>
        </div>
      )}
      {!isLifeLoss && <div style={s.smallReactionLine}>{bigLine}</div>}

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
        {isSecondLifeLoss ? "Vezi ce ai pățit →" : isLastStep ? "Continuă →" : "Corabia avansează →"}
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// OVERLAY — CASH OUT
// ══════════════════════════════════════════════════════════════════
function CashoutOverlay({ total, lives, onCashOut, onContinue }) {
  const isLastLife = lives === 1;
  return (
    <div className="th-pop" style={s.overlayCard}>
      <div style={s.overlayHeader}>⚖️ O DECIZIE TE AȘTEAPTĂ</div>
      <div style={s.cashoutTotal}>{total} PCT</div>
      <div style={s.overlaySub}>{isLastLife ? lastLifeCashoutLine(total) : cashoutLine(total, false)}</div>

      {isLastLife && <LastLifeBanner />}

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
// FINAL — cashed-out / game over (fără asset dedicat)
// ══════════════════════════════════════════════════════════════════
function FinalOverlay({ kind, total, onRestart }) {
  const config = {
    cashedout: { icon: "💰", title: "TE-AI OPRIT LA TIMP", detail: `Ai păstrat ${total} PCT.` },
    gameover: { icon: "☠️", title: "COMOARA TE-A ÎNVINS", detail: pickOnce(GAME_OVER_LINES) },
  }[kind];
  return (
    <div className={`th-pop ${kind === "gameover" ? "th-darken" : ""}`} style={{ ...s.overlayCard, ...s.finalCard }}>
      <div style={s.finalIcon}>{config.icon}</div>
      <div style={s.overlayHeader}>{config.title}</div>
      <div style={s.finalTotal}>{total} PCT</div>
      <div style={s.overlaySub}>{config.detail}</div>
      {onRestart && <button type="button" style={s.primaryBtn} onClick={onRestart}>Joacă din nou (mock)</button>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// FINAL — COMOARA — moment cinematic, cufăr închis → deschis, MARE.
// ══════════════════════════════════════════════════════════════════
function TreasureFinalOverlay({ total, onRestart }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOpen(true), 550);
    return () => clearTimeout(t);
  }, []);
  const isPerfect = total >= 100;
  const line = isPerfect ? pickOnce(PERFECT_100_LINES) : pickOnce(TREASURE_FOUND_LINES);

  return (
    <div className="th-pop" style={{ ...s.overlayCard, ...s.treasureCard }}>
      <img
        src={open ? ASSET.chestOpen : ASSET.chestClosed} alt="Comoara"
        className={open ? "th-chest-open" : "th-chest-shake"}
        style={s.treasureChestImg}
      />
      <div style={s.overlayHeader}>{isPerfect ? "💯 MAXIM ABSOLUT!" : "🏆 COMOARA E A TA!"}</div>
      <div style={s.treasureBonusLine}>+{TREASURE_BONUS} PCT</div>
      <div style={s.finalTotal}>{total} PCT</div>
      <div style={s.overlaySub}>{line}</div>
      {onRestart && <button type="button" style={s.primaryBtn} onClick={onRestart}>Joacă din nou (mock)</button>}
    </div>
  );
}

const ANIM_CSS = `
@keyframes thPulseUp { 0% { transform: translateY(0) scale(1); } 40% { transform: translateY(-5px) scale(1.08); } 100% { transform: translateY(0) scale(1); } }
@keyframes thPulseDown { 0% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } 100% { transform: translateX(0); } }
@keyframes thShake { 0% { transform: translateX(0); } 20% { transform: translateX(-6px); } 40% { transform: translateX(6px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(4px); } 100% { transform: translateX(0); } }
@keyframes thPop { 0% { transform: scale(0.92); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
@keyframes thShipSway { 0%, 100% { transform: translateX(-50%) rotate(-2deg); } 50% { transform: translateX(-50%) rotate(2deg); } }
@keyframes thShipSink { 0% { transform: translateX(-50%) rotate(0deg) translateY(0); opacity: 1; } 100% { transform: translateX(-50%) rotate(18deg) translateY(40px); opacity: 0.15; } }
@keyframes thLightning { 0%, 92%, 100% { opacity: 0; } 94% { opacity: 0.9; } 96% { opacity: 0.15; } 98% { opacity: 0.7; } }
@keyframes thWarnPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(220,60,60,0.35); } 50% { box-shadow: 0 0 0 6px rgba(220,60,60,0); } }
@keyframes thChestShake { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(-2deg); } 75% { transform: rotate(2deg); } }
@keyframes thChestOpen { 0% { transform: scale(0.85); opacity: 0.4; } 100% { transform: scale(1); opacity: 1; } }
.th-pulse-up { animation: thPulseUp 0.5s ease; }
.th-pulse-down { animation: thPulseDown 0.4s ease; }
.th-shake { animation: thShake 0.5s ease; }
.th-pop { animation: thPop 0.25s ease; }
.th-darken { filter: brightness(0.9); }
.th-ship-sway { animation: thShipSway 3s ease-in-out infinite; transition: top 0.7s ease; }
.th-ship-sink { animation: thShipSink 1.1s ease forwards; }
.th-lightning { animation: thLightning 4.5s linear infinite; }
.th-warn-pulse { animation: thWarnPulse 2s ease-in-out infinite; }
.th-chest-shake { animation: thChestShake 0.4s ease-in-out 2; }
.th-chest-open { animation: thChestOpen 0.4s ease; }
@media (prefers-reduced-motion: reduce) {
  .th-pulse-up, .th-pulse-down, .th-shake, .th-pop, .th-ship-sway, .th-ship-sink, .th-lightning, .th-warn-pulse, .th-chest-shake, .th-chest-open { animation: none !important; }
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
    minHeight: 440, border: `1px solid ${color.border}`,
  },
  lightning: { position: "absolute", inset: 0, background: "#FFFFFF", pointerEvents: "none" },
  islandImg: { position: "absolute", bottom: "1%", left: "50%", transform: "translateX(-50%)", width: "62%", maxWidth: 260, transition: "opacity 0.6s ease", filter: "drop-shadow(0 4px 14px rgba(0,0,0,0.5))" },
  stationDot: {
    position: "absolute", left: "50%", transform: "translateX(-50%)", width: 9, height: 9, borderRadius: "50%",
    background: "rgba(255,255,255,0.25)", border: "1px solid rgba(255,255,255,0.4)", zIndex: 1,
  },
  stationDotPassed: { background: color.gold, border: `1px solid ${color.goldLight}` },
  shipImg: { position: "absolute", left: "50%", width: 108, zIndex: 2, filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.6))" },
  travelingTag: {
    position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)",
    color: color.goldLight, fontSize: 12, fontWeight: 700, fontFamily: font.body,
    background: "rgba(5,6,12,0.6)", borderRadius: radius.pill, padding: "5px 12px",
  },

  overlayBackdrop: {
    position: "absolute", inset: 0, background: "rgba(5,6,12,0.72)",
    display: "flex", alignItems: "center", justifyContent: "center", padding: 14, overflowY: "auto",
  },
  overlayCard: {
    width: "100%", maxWidth: 380, background: "linear-gradient(180deg, #2A2116, #1C1710)",
    border: `1px solid ${color.goldBorder}`, borderRadius: radius.lg, padding: "18px 16px", textAlign: "center",
  },
  overlayHeader: { color: color.goldLight, fontSize: 15, fontWeight: 800, fontFamily: font.display, letterSpacing: "0.03em" },
  overlaySub: { color: color.textSecondary, fontSize: 12, fontFamily: font.body, marginTop: 6, lineHeight: 1.4 },

  lastLifeBanner: {
    marginTop: 10, padding: "8px 10px", borderRadius: radius.sm, border: "1px solid rgba(220,60,60,0.5)",
    background: "rgba(220,60,60,0.12)",
  },
  lastLifeBannerCompact: { padding: "6px 8px" },
  lastLifeTitle: { color: "#F08080", fontSize: 12, fontWeight: 800, fontFamily: font.body },
  lastLifeBody: { color: "#F0A0A0", fontSize: 11, fontFamily: font.body, marginTop: 3, lineHeight: 1.4 },

  rewardsPouch: {
    margin: "12px 0", padding: "8px 10px", borderRadius: radius.md,
    background: "rgba(255,255,255,0.06)", border: `1px dashed ${color.goldBorder}`,
  },
  rewardsPouchTitle: { fontSize: 10, fontWeight: 800, color: color.goldLight, letterSpacing: "0.05em", fontFamily: font.body },
  rewardsPouchRow: { fontSize: 12, fontWeight: 700, color: color.textPrimary, fontFamily: font.body, marginTop: 4 },

  doorsGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 6 },
  doorsGrid4: { gridTemplateColumns: "repeat(2, 1fr)" },
  doorBtn: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "14px 6px",
    borderRadius: radius.md, border: `1px solid ${color.goldBorder}`, background: "rgba(212,175,55,0.08)",
    cursor: "pointer", minHeight: 64,
  },
  doorMark: { fontSize: 22 },
  doorLabel: { fontSize: 10, fontWeight: 800, color: color.goldLight, fontFamily: font.body, letterSpacing: "0.03em" },

  lifeLostBlock: { marginBottom: 10 },
  lifeLostImg: { width: "78%", maxWidth: 230, filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.6))" },
  lifeLostLine: { color: "#F08080", fontSize: 13, fontWeight: 800, fontFamily: font.body, marginTop: 6 },
  smallReactionLine: { color: color.goldLight, fontSize: 13, fontWeight: 700, fontFamily: font.body, marginBottom: 8 },

  revealList: { display: "flex", flexDirection: "column", gap: 6, marginTop: 10, marginBottom: 14 },
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

  treasureCard: { maxWidth: 400 },
  treasureChestImg: { width: "70%", maxWidth: 260, margin: "0 auto 10px", display: "block" },
  treasureBonusLine: { fontSize: 16, fontWeight: 800, color: color.green, fontFamily: font.body, marginTop: 4 },

  primaryBtn: {
    width: "100%", padding: "13px 10px", borderRadius: radius.md, border: "none",
    background: color.goldGradient, color: "#12141C", fontWeight: 800, fontSize: 13, fontFamily: font.body,
    cursor: "pointer", marginTop: 10,
  },
};
