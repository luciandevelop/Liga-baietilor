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

function pickOnce(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function outcomeLabel(o) {
  if (o.type === "life") return "❤️";
  return `${o.value > 0 ? "+" : ""}${o.value}`;
}

// ══════════════════════════════════════════════════════════════════
// 🏴‍☠️ COMOARA BLESTEMATĂ — P0 FIX MOBIL. Randare condiționată REALĂ:
// fiecare fază vizuală (visualPhase) e un `return` complet separat.
// Corabia/harta există în DOM STRICT în "choice" și "travel" — în toate
// celelalte faze, componenta MapPanel nici nu e instanțiată (nu doar
// ascunsă/estompată CSS). Un singur focus per fază, mereu.
// ══════════════════════════════════════════════════════════════════
export default function TreasureHuntScreen({ onBack, previewMode, previewState, embedded }) {
  const [game, setGame] = useState(() => (previewMode ? buildTreasureHuntPreview(previewState) : freshGameState()));
  const [pulse, setPulse] = useState(null);
  const [visualPhase, setVisualPhase] = useState("choice"); // choice|reveal|lifeReaction|travel|cashout|cashedout|treasure|gameover

  useEffect(() => {
    if (previewMode) {
      const g = buildTreasureHuntPreview(previewState);
      setGame(g);
      setVisualPhase(resolveInitialPhase(g));
    }
  }, [previewMode, previewState]);

  function resolveInitialPhase(g) {
    if (g.phase === "revealed") {
      const isLife = g.doors[g.chosenIndex]?.outcome.type === "life";
      return isLife ? "lifeReaction" : "reveal";
    }
    if (g.phase === "choosing") return "choice";
    return g.phase; // cashout | cashedout | treasure | gameover
  }

  const chosenOutcome = game.chosenIndex != null ? game.doors[game.chosenIndex]?.outcome : null;
  const isSecondLifeLoss = chosenOutcome?.type === "life" && game.lives <= 0;

  function handlePick(doorIndex) {
    if (visualPhase !== "choice") return;
    const next = applyOutcome(game, doorIndex);
    const outcome = next.doors[doorIndex].outcome;
    setPulse(outcome.type === "life" ? "life" : outcome.value > 0 ? "up" : "down");
    setGame(next);
    setVisualPhase(outcome.type === "life" ? "lifeReaction" : "reveal");
    setTimeout(() => setPulse(null), 650);
  }

  // ── CAZ B din spec: a doua viață pierdută → DIRECT în gameover, fără
  // reveal, fără "Corabia avansează", fără travel. advanceAfterReveal
  // e funcția existentă a motorului (neschimbată) care pune total:0
  // când lives<=0 — o refolosim ca să nu duplicăm regula nicăieri. ──
  function handleReactionDone() {
    if (isSecondLifeLoss) {
      const final = advanceAfterReveal(game);
      setGame(final);
      setVisualPhase("gameover");
    } else {
      setVisualPhase("reveal");
    }
  }

  function travelThenCommit(nextState) {
    setVisualPhase("travel");
    setGame((g) => ({ ...g, step: nextState.step }));
    setTimeout(() => {
      setGame(nextState);
      setVisualPhase(nextState.phase === "choosing" ? "choice" : nextState.phase);
    }, 700);
  }

  function handleContinueAfterReveal() {
    const next = advanceAfterReveal(game);
    if (next.phase === "choosing" && next.step !== game.step) { travelThenCommit(next); return; }
    setGame(next);
    setVisualPhase(next.phase === "choosing" ? "choice" : next.phase);
  }

  function handleCashOut() {
    setGame((g) => cashOut(g));
    setVisualPhase("cashedout");
  }

  function handleContinueRisk() {
    travelThenCommit(continueAfterCashout(game));
  }

  function handleRestart() {
    const g = previewMode ? buildTreasureHuntPreview(previewState) : freshGameState();
    setGame(g);
    setVisualPhase(resolveInitialPhase(g));
  }

  return wrapPage(embedded, onBack,
    <>
      <Hud game={game} pulse={pulse} />
      {renderPhase()}
    </>
  );

  function renderPhase() {
    switch (visualPhase) {
      case "lifeReaction":
        return <LifeReactionPanel isSecondLoss={isSecondLifeLoss} onDone={handleReactionDone} />;
      case "reveal":
        return (
          <RevealPanel
            doors={game.doors} chosenIndex={game.chosenIndex}
            onContinue={handleContinueAfterReveal} isLastStep={game.step >= TOTAL_STEPS}
          />
        );
      case "cashout":
        return <CashoutPanel total={game.total} lives={game.lives} onCashOut={handleCashOut} onContinue={handleContinueRisk} />;
      case "cashedout":
        return <SimpleFinalPanel icon="💰" title="TE-AI OPRIT LA TIMP" total={game.total} detail={`Ai păstrat ${game.total} PCT.`} onRestart={previewMode ? null : handleRestart} />;
      case "treasure":
        return <TreasureCinematic game={game} onRestart={previewMode ? null : handleRestart} />;
      case "gameover":
        return <GameOverCinematic onRestart={previewMode ? null : handleRestart} />;
      case "travel":
        return <MapPanel game={game} zone={zoneForStep(game.step)} travelingTag />;
      case "choice":
      default:
        return (
          <MapPanel game={game} zone={zoneForStep(game.step)}>
            <ChoiceOverlay doors={game.doors} onPick={handlePick} step={game.step} lives={game.lives} />
          </MapPanel>
        );
    }
  }
}

function wrapPage(embedded, onBack, content) {
  const inner = (
    <div style={s.wrap}>
      <style>{ANIM_CSS}</style>
      {!embedded && <PageHeader title="🏴‍☠️ Comoara Blestemată" onBack={onBack} />}
      {content}
    </div>
  );
  return embedded ? inner : <div style={s.page}>{inner}</div>;
}

function zoneForStep(step) {
  if (step <= 3) return "safe";
  if (step <= 5) return "danger";
  return "cursed";
}

// ══════════════════════════════════════════════════════════════════
// HUD — permanent, indiferent de fază.
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
// MAP — SINGURUL loc unde corabia există în DOM. Folosit STRICT de
// fazele "choice" și "travel".
// ══════════════════════════════════════════════════════════════════
const STATIONS = [
  { label: "START", top: 4, side: 0 }, { label: "1", top: 13, side: -1 }, { label: "2", top: 24, side: 1 },
  { label: "3", top: 35, side: -1 }, { label: "4", top: 46, side: 1 }, { label: "5", top: 57, side: -1 },
  { label: "6", top: 68, side: 1 }, { label: "7", top: 79, side: -1 }, { label: "TREASURE", top: 92, side: 0 },
];
function stationTopForStep(step) {
  return STATIONS[Math.max(0, Math.min(step, TOTAL_STEPS))].top;
}

function MapPanel({ game, zone, travelingTag, children }) {
  const shipTop = stationTopForStep(game.step);
  return (
    <>
      <div style={{ ...s.map, ...ZONE_BG[zone] }}>
        {zone === "cursed" && <div className="th-lightning" style={s.lightning} />}

        {STATIONS.map((st, i) => (
          <div key={i} style={{ ...s.stationWrap, top: `${st.top}%`, left: `${50 + st.side * 16}%` }}>
            <div style={{ ...s.stationDot, ...(i <= game.step ? s.stationDotPassed : {}), ...(st.label === "TREASURE" ? s.stationDotTreasure : {}) }}>
              {st.label === "TREASURE" ? "🏝️" : st.label === "START" ? "⚓" : st.label}
            </div>
          </div>
        ))}

        <img src={ASSET.island} alt="" style={s.islandImg} />
        <img src={ASSET.ship} alt="Corabia" className="th-ship-sway" style={{ ...s.shipImg, top: `${shipTop}%` }} />

        {!travelingTag && game.doors && game.doors.length > 0 && <PossiblePouch doors={game.doors} />}

        {children && <div style={s.overlayBackdrop}>{children}</div>}
      </div>
      {travelingTag && <div style={s.travelingTag}>⛵ Corabia navighează...</div>}
    </>
  );
}

const ZONE_BG = {
  safe: { background: "linear-gradient(180deg, #0E4C5C, #0A3348)" },
  danger: { background: "linear-gradient(180deg, #0A3348, #1A2233)" },
  cursed: { background: "linear-gradient(180deg, #14101F, #05060C)" },
};

function PossiblePouch({ doors }) {
  const labels = useMemo(() => {
    const l = doors.map((d) => outcomeLabel(d.outcome));
    for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; }
    return l;
  }, [doors]);
  return (
    <div style={s.pouch}>
      <div style={s.pouchTitle}>🎒 PRADĂ POSIBILĂ</div>
      <div style={s.pouchRow}>{labels.join(" · ")}</div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// CHOICE — conținutul cardului de alegere (randat DOAR peste MapPanel
// din faza "choice").
// ══════════════════════════════════════════════════════════════════
function ChoiceOverlay({ doors, onPick, step, lives }) {
  const isLast = step >= TOTAL_STEPS;
  const isRisk = step >= 4 && step <= 5;
  const isCursed = step >= 6;
  const intro = isCursed ? pickOnce(CURSED_ZONE_INTRO) : isRisk ? pickOnce(RISK_ZONE_INTRO) : null;
  return (
    <div className="th-pop" style={s.overlayCard}>
      <div style={s.overlayHeader}>{isLast ? "☠️ ULTIMA TRECERE" : "🏴‍☠️ ALEGE-ȚI DRUMUL"}</div>
      {isLast && <div style={s.overlaySub}>Insula comorii e foarte aproape. Furtuna e puternică.</div>}
      {intro && !isLast && <div style={s.overlaySub}>{intro}</div>}
      {lives === 1 && step >= 4 && <LastLifeBanner compact />}
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

function LastLifeBanner({ compact }) {
  return (
    <div className="th-warn-pulse" style={{ ...s.lastLifeBanner, ...(compact ? s.lastLifeBannerCompact : {}) }}>
      <div style={s.lastLifeTitle}>{LAST_LIFE_WARNING_TITLE}</div>
      {!compact && <div style={s.lastLifeBody}>{pickOnce(LAST_LIFE_WARNING_BODY)}</div>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// LIFE REACTION — ecran PLIN, propriu, FĂRĂ hartă/corabie/reveal.
// Assetul mereu vizibil COMPLET: object-fit:contain, dimensionat în
// dvh, containerul NICIODATĂ overflow:hidden.
// ══════════════════════════════════════════════════════════════════
function LifeReactionPanel({ isSecondLoss, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1600);
    return () => clearTimeout(t);
  }, [onDone]);
  const line = pickOnce(isSecondLoss ? LIFE_LOST_SECOND : LIFE_LOST_FIRST);
  return (
    <div className="th-pop th-shake" style={s.reactionPanel}>
      <img src={ASSET.lifeLost} alt="Ai luat o muie!" style={s.reactionImg} />
      <div style={s.reactionLine}>{line}</div>
      <button type="button" style={s.primaryBtnGhost} onClick={onDone}>Continuă →</button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// REVEAL — ecran PLIN propriu, FĂRĂ hartă/corabie. Compact garantat:
// CTA într-un footer fix, doar lista rulează intern dacă e nevoie.
// ══════════════════════════════════════════════════════════════════
function RevealPanel({ doors, chosenIndex, onContinue, isLastStep }) {
  return (
    <div className="th-pop" style={s.revealPanel}>
      <div style={s.revealScroll}>
        <div style={s.overlayHeader}>🗺️ DRUMURILE DEZVĂLUITE</div>
        <div style={s.revealList}>
          {doors.map((d, i) => {
            const isChosen = i === chosenIndex;
            const positive = d.outcome.type === "points" && d.outcome.value > 0;
            const negative = d.outcome.type === "points" && d.outcome.value < 0;
            const isLife = d.outcome.type === "life";
            return (
              <div key={i} style={{ ...s.revealRow, ...(isChosen ? s.revealRowChosen : {}) }}>
                <span style={s.revealLabel}>{d.label}{isChosen ? " 🏴‍☠️" : ""}</span>
                <span style={{ ...s.revealValue, ...(positive ? s.revealValuePos : negative ? s.revealValueNeg : isLife ? s.revealValueLife : {}) }}>
                  {isLife ? "❤️ −1" : outcomeLabel(d.outcome) + " PCT"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <button type="button" style={s.primaryBtn} onClick={onContinue}>
        {isLastStep ? "Continuă →" : "Corabia avansează →"}
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// CASHOUT — ecran PLIN propriu, FĂRĂ hartă/corabie.
// ══════════════════════════════════════════════════════════════════
function CashoutPanel({ total, lives, onCashOut, onContinue }) {
  const isLastLife = lives === 1;
  return (
    <div className="th-pop" style={s.revealPanel}>
      <div style={s.revealScroll}>
        <div style={s.overlayHeader}>⚖️ O DECIZIE TE AȘTEAPTĂ</div>
        <div style={s.cashoutTotal}>{total} PCT</div>
        <div style={s.overlaySub}>{isLastLife ? lastLifeCashoutLine(total) : cashoutLine(total, false)}</div>
        {isLastLife && <LastLifeBanner />}
      </div>
      <div style={s.cashoutRow}>
        <button type="button" style={{ ...s.primaryBtn, ...s.cashoutBtn }} onClick={onCashOut}>💰 MĂ OPRESC — {total} PCT</button>
        <button type="button" style={{ ...s.primaryBtn, ...s.continueBtn }} onClick={onContinue}>🏴‍☠️ CONTINUI SPRE COMOARĂ</button>
      </div>
    </div>
  );
}

function SimpleFinalPanel({ icon, title, total, detail, onRestart }) {
  return (
    <div className="th-pop" style={s.revealPanel}>
      <div style={s.revealScroll}>
        <div style={s.finalIcon}>{icon}</div>
        <div style={s.overlayHeader}>{title}</div>
        <div style={s.finalTotal}>{total} PCT</div>
        <div style={s.overlaySub}>{detail}</div>
      </div>
      {onRestart && <button type="button" style={s.primaryBtn} onClick={onRestart}>Joacă din nou (mock)</button>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// GAME OVER — cinematic PLIN, propriu. FĂRĂ hartă/corabie/reveal.
// ══════════════════════════════════════════════════════════════════
function GameOverCinematic({ onRestart }) {
  const line = pickOnce(GAME_OVER_LINES);
  return (
    <div className="th-pop" style={{ ...s.revealPanel, ...s.cinematicDark }}>
      <div style={s.revealScroll}>
        <div style={s.cinematicHeader}>☠️ COMOARA TE-A ÎNVINS</div>
        <div style={s.finalTotal}>0 PCT</div>
        <div style={s.overlaySub}>{line}</div>
      </div>
      {onRestart && <button type="button" style={s.primaryBtn} onClick={onRestart}>Joacă din nou (mock)</button>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// TREASURE — cinematic PLIN, propriu. FĂRĂ hartă/corabie.
// ══════════════════════════════════════════════════════════════════
function TreasureCinematic({ game, onRestart }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOpen(true), 550);
    return () => clearTimeout(t);
  }, []);
  const preTotal = game.preTreasureTotal ?? Math.max(0, game.total - TREASURE_BONUS);
  const isPerfect = game.total >= 100;
  const line = isPerfect ? pickOnce(PERFECT_100_LINES) : pickOnce(TREASURE_FOUND_LINES);
  return (
    <div className="th-pop" style={s.revealPanel}>
      <div style={s.revealScroll}>
        <img
          src={open ? ASSET.chestOpen : ASSET.chestClosed} alt="Comoara"
          className={open ? "th-chest-open" : "th-chest-shake"} style={s.treasureChestImg}
        />
        <div style={s.overlayHeader}>{isPerfect ? "💯 MAXIM ABSOLUT!" : "🏆 COMOARA E A TA!"}</div>
        <div style={s.scoreBreakdown}>
          <div style={s.scoreBreakdownLine}><span>Puncte înainte de comoară</span><span style={s.scoreBreakdownVal}>{preTotal} PCT</span></div>
          <div style={s.scoreBreakdownLine}><span>Bonus comoară</span><span style={{ ...s.scoreBreakdownVal, color: color.green }}>+{TREASURE_BONUS} PCT</span></div>
          <div style={{ ...s.scoreBreakdownLine, ...s.scoreBreakdownTotal }}><span>TOTAL FINAL</span><span style={s.scoreBreakdownVal}>{game.total} PCT</span></div>
        </div>
        <div style={s.overlaySub}>{line}</div>
      </div>
      {onRestart && <button type="button" style={s.primaryBtn} onClick={onRestart}>Joacă din nou (mock)</button>}
    </div>
  );
}

const ANIM_CSS = `
@keyframes thPulseUp { 0% { transform: translateY(0) scale(1); } 40% { transform: translateY(-5px) scale(1.08); } 100% { transform: translateY(0) scale(1); } }
@keyframes thPulseDown { 0% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } 100% { transform: translateX(0); } }
@keyframes thShake { 0% { transform: translateX(0); } 20% { transform: translateX(-6px); } 40% { transform: translateX(6px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(4px); } 100% { transform: translateX(0); } }
@keyframes thPop { 0% { transform: scale(0.94); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
@keyframes thShipSway { 0%, 100% { transform: translateX(-50%) rotate(-2deg); } 50% { transform: translateX(-50%) rotate(2deg); } }
@keyframes thLightning { 0%, 92%, 100% { opacity: 0; } 94% { opacity: 0.9; } 96% { opacity: 0.15; } 98% { opacity: 0.7; } }
@keyframes thWarnPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(220,60,60,0.35); } 50% { box-shadow: 0 0 0 6px rgba(220,60,60,0); } }
@keyframes thChestShake { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(-2deg); } 75% { transform: rotate(2deg); } }
@keyframes thChestOpen { 0% { transform: scale(0.85); opacity: 0.4; } 100% { transform: scale(1); opacity: 1; } }
.th-pulse-up { animation: thPulseUp 0.5s ease; }
.th-pulse-down { animation: thPulseDown 0.4s ease; }
.th-shake { animation: thShake 0.5s ease; }
.th-pop { animation: thPop 0.25s ease; }
.th-ship-sway { animation: thShipSway 3s ease-in-out infinite; transition: top 0.7s ease; }
.th-lightning { animation: thLightning 4.5s linear infinite; }
.th-warn-pulse { animation: thWarnPulse 2s ease-in-out infinite; }
.th-chest-shake { animation: thChestShake 0.4s ease-in-out 2; }
.th-chest-open { animation: thChestOpen 0.4s ease; }
@media (prefers-reduced-motion: reduce) {
  .th-pulse-up, .th-pulse-down, .th-shake, .th-pop, .th-ship-sway, .th-lightning, .th-warn-pulse, .th-chest-shake, .th-chest-open { animation: none !important; }
}
`;

const s = {
  page: { minHeight: "100dvh", background: color.bgBase },
  wrap: { maxWidth: 460, margin: "0 auto", padding: "0 14px 24px" },

  hud: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    background: color.surfaceElevated, border: `1px solid ${color.border}`, borderRadius: radius.md,
    padding: "10px 14px", margin: "12px 0", flexShrink: 0,
  },
  hudItem: { color: color.textPrimary, fontSize: 13, fontWeight: 800, fontFamily: font.body },
  hudPoints: { color: color.goldLight, fontSize: 15 },

  // ── MAP — folosit STRICT de choice/travel. ──
  map: { position: "relative", borderRadius: radius.lg, overflow: "hidden", minHeight: 420, maxHeight: "62dvh", border: `1px solid ${color.border}` },
  lightning: { position: "absolute", inset: 0, background: "#FFFFFF", pointerEvents: "none" },
  stationWrap: { position: "absolute", transform: "translate(-50%, -50%)" },
  stationDot: {
    width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.5)",
    background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.25)", fontFamily: font.body,
  },
  stationDotPassed: { background: color.gold, border: `1px solid ${color.goldLight}`, color: "#12141C" },
  stationDotTreasure: { fontSize: 15, background: "transparent", border: "none", width: 30, height: 30 },
  islandImg: { position: "absolute", top: "82%", left: "50%", transform: "translateX(-50%)", width: "50%", maxWidth: 200, opacity: 0.9, filter: "drop-shadow(0 4px 14px rgba(0,0,0,0.5))" },
  shipImg: { position: "absolute", left: "50%", width: 92, transform: "translateX(-50%)", filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.6))" },

  pouch: {
    position: "absolute", top: 10, left: 10, maxWidth: 150,
    background: "rgba(20,15,8,0.82)", border: `1px dashed ${color.goldBorder}`, borderRadius: radius.sm, padding: "6px 8px",
  },
  pouchTitle: { fontSize: 8.5, fontWeight: 800, color: color.goldLight, letterSpacing: "0.04em", fontFamily: font.body },
  pouchRow: { fontSize: 11, fontWeight: 700, color: color.textPrimary, fontFamily: font.body, marginTop: 2 },

  travelingTag: { textAlign: "center", color: color.goldLight, fontSize: 12, fontWeight: 700, fontFamily: font.body, marginTop: 8 },

  overlayBackdrop: { position: "absolute", inset: 0, background: "rgba(5,6,12,0.9)", display: "flex", alignItems: "center", justifyContent: "center", padding: 14 },
  overlayCard: {
    width: "100%", maxWidth: 380, maxHeight: "90%", overflowY: "auto",
    background: "linear-gradient(180deg, #2A2116, #1C1710)", border: `1px solid ${color.goldBorder}`,
    borderRadius: radius.lg, padding: "16px 14px", textAlign: "center",
  },
  overlayHeader: { color: color.goldLight, fontSize: 14.5, fontWeight: 800, fontFamily: font.display, letterSpacing: "0.03em" },
  overlaySub: { color: color.textSecondary, fontSize: 11.5, fontFamily: font.body, marginTop: 5, lineHeight: 1.35 },

  lastLifeBanner: { marginTop: 8, padding: "7px 9px", borderRadius: radius.sm, border: "1px solid rgba(220,60,60,0.5)", background: "rgba(220,60,60,0.12)" },
  lastLifeBannerCompact: { padding: "5px 7px" },
  lastLifeTitle: { color: "#F08080", fontSize: 11.5, fontWeight: 800, fontFamily: font.body },
  lastLifeBody: { color: "#F0A0A0", fontSize: 10.5, fontFamily: font.body, marginTop: 2, lineHeight: 1.35 },

  doorsGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7, marginTop: 10 },
  doorsGrid4: { gridTemplateColumns: "repeat(2, 1fr)" },
  doorBtn: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "12px 6px",
    borderRadius: radius.md, border: `1px solid ${color.goldBorder}`, background: "rgba(212,175,55,0.08)",
    cursor: "pointer", minHeight: 58,
  },
  doorMark: { fontSize: 19 },
  doorLabel: { fontSize: 9.5, fontWeight: 800, color: color.goldLight, fontFamily: font.body, letterSpacing: "0.02em" },

  // ── REACTION — ecran plin, propriu. Fără overflow:hidden, fără
  // min-height mai mare decât conținutul — imaginea mereu întreagă. ──
  reactionPanel: {
    borderRadius: radius.lg, border: `1px solid ${color.border}`,
    background: "linear-gradient(180deg, #1C0F0F, #0A0505)",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    padding: "20px 16px", textAlign: "center", gap: 4, minHeight: 320,
  },
  reactionImg: { width: "auto", maxWidth: "min(90vw, 300px)", height: "auto", maxHeight: "56dvh", objectFit: "contain" },
  reactionLine: { color: "#F08080", fontSize: 14, fontWeight: 800, fontFamily: font.body, marginTop: 10, maxWidth: 300 },
  primaryBtnGhost: {
    marginTop: 14, padding: "10px 20px", borderRadius: radius.md, border: `1px solid ${color.goldBorder}`,
    background: "transparent", color: color.goldLight, fontWeight: 700, fontSize: 12, fontFamily: font.body, cursor: "pointer",
  },

  // ── REVEAL / CASHOUT / FINALURI — ecran plin propriu, structură
  // fixă: zonă scrollabilă sus + CTA GARANTAT vizibil jos (flex, nu
  // absolute — nu poate fi împins sub fold). ──
  revealPanel: {
    borderRadius: radius.lg, border: `1px solid ${color.goldBorder}`,
    background: "linear-gradient(180deg, #2A2116, #1C1710)",
    display: "flex", flexDirection: "column", padding: "16px 14px", textAlign: "center",
    minHeight: 320, maxHeight: "70dvh",
  },
  revealScroll: { overflowY: "auto", flex: 1 },
  cinematicDark: { background: "linear-gradient(180deg, #14101F, #05060C)" },
  cinematicHeader: { color: color.goldLight, fontSize: 17, fontWeight: 800, fontFamily: font.display, letterSpacing: "0.03em", marginTop: 4 },

  revealList: { display: "flex", flexDirection: "column", gap: 5, marginTop: 10 },
  revealRow: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 10px", borderRadius: radius.sm, background: "rgba(255,255,255,0.04)" },
  revealRowChosen: { background: "rgba(212,175,55,0.16)", border: `1px solid ${color.gold}` },
  revealLabel: { fontSize: 11.5, fontWeight: 700, color: color.textPrimary, fontFamily: font.body },
  revealValue: { fontSize: 12.5, fontWeight: 800, fontFamily: font.body, color: color.textSecondary },
  revealValuePos: { color: color.green },
  revealValueNeg: { color: "#E8837A" },
  revealValueLife: { color: "#E8837A" },

  cashoutTotal: { fontSize: 30, fontWeight: 900, color: color.goldLight, fontFamily: font.display, margin: "6px 0" },
  cashoutRow: { display: "flex", flexDirection: "column", gap: 7, marginTop: 12, flexShrink: 0 },
  cashoutBtn: { background: color.greenBg, border: `2px solid ${color.greenBorder}`, color: color.green },
  continueBtn: { background: "rgba(212,175,55,0.12)", border: `2px solid ${color.gold}`, color: color.goldLight },

  finalIcon: { fontSize: 34, marginBottom: 4 },
  finalTotal: { fontSize: 28, fontWeight: 900, color: color.goldLight, fontFamily: font.display, margin: "6px 0" },

  treasureChestImg: { width: "56%", maxWidth: 200, display: "block", margin: "0 auto 8px" },
  scoreBreakdown: { width: "100%", maxWidth: 260, margin: "10px auto 4px", display: "flex", flexDirection: "column", gap: 5 },
  scoreBreakdownLine: { display: "flex", justifyContent: "space-between", fontSize: 12, color: color.textSecondary, fontFamily: font.body },
  scoreBreakdownVal: { fontWeight: 800, color: color.textPrimary },
  scoreBreakdownTotal: { borderTop: `1px solid ${color.border}`, paddingTop: 6, marginTop: 2, fontWeight: 800, color: color.goldLight, fontSize: 14 },

  primaryBtn: {
    width: "100%", padding: "12px 10px", borderRadius: radius.md, border: "none",
    background: color.goldGradient, color: "#12141C", fontWeight: 800, fontSize: 13, fontFamily: font.body,
    cursor: "pointer", marginTop: 10, flexShrink: 0,
  },
};
