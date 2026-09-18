import { useEffect, useMemo, useRef, useState } from "react";
import {
  freshGameState, buildTreasureHuntPreview, applyOutcome, advanceAfterReveal, cashOut, continueAfterCashout,
  TOTAL_STEPS, TREASURE_BONUS, START_LIVES,
} from "../treasureHuntMockData";
import {
  INTRO_TITLE, INTRO_LINES, SAFE_ARRIVAL, RISK_ARRIVAL, CURSED_ARRIVAL,
  POSSIBILITIES_SAFE_LINE, POSSIBILITIES_RISK_LINE, POSSIBILITIES_CURSED_LINE,
  LAST_LIFE_WARNING_TITLE, LAST_LIFE_WARNING_BODY, lastLifeCashoutLine,
  bigPositiveLine, negativeLine, LIFE_LOST_FIRST, LIFE_LOST_SECOND,
  GAME_OVER_EARLY_LINES, gameOverLateLine, TREASURE_FOUND_LINES, PERFECT_100_LINES, cashoutLine,
  TRAVEL_LINES_SAFE, TRAVEL_LINES_RISK, TRAVEL_LINES_CURSED, FINAL_CROSSING_LINES,
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
function outcomeLabel(o) { return o.type === "life" ? "❤️" : `${o.value > 0 ? "+" : ""}${o.value}`; }
function zoneForStep(step) { return step <= 3 ? "safe" : step <= 5 ? "danger" : "cursed"; }

const STATIONS = [
  { label: "START", top: 4, side: 0 }, { label: "1", top: 13, side: -1 }, { label: "2", top: 24, side: 1 },
  { label: "3", top: 35, side: -1 }, { label: "4", top: 46, side: 1 }, { label: "5", top: 57, side: -1 },
  { label: "6", top: 68, side: 1 }, { label: "7", top: 79, side: -1 }, { label: "TREASURE", top: 92, side: 0 },
];
const TREASURE_STATION_INDEX = STATIONS.length - 1;
function stationTopByIndex(idx) { return STATIONS[Math.max(0, Math.min(idx, STATIONS.length - 1))].top; }

// ── Durate de călătorie, escaladate pe zonă (cerut explicit: 1.7-2s /
// 2.2s / 2.5s / 3s spre comoară) — SINGURUL loc unde apar aceste valori. ──
const TRAVEL_MS = { 1: 1800, 2: 1800, 3: 2000, 4: 2200, 5: 2200, 6: 2500, 7: 2500, treasure: 3000 };
const ARRIVAL_PAUSE_MS = 700;
const CHAPTER_INTRO_MS = 1600;
const RESULT_REVEAL_MS = 1900;

// ══════════════════════════════════════════════════════════════════
// 🏴‍☠️ COMOARA BLESTEMATĂ — „MAP-FIRST PIRATE ADVENTURE”.
//
// Principiu: HARTA + CORABIA rămân montate și vizibile pe durata
// aproape întregii călătorii (sosire, intro de capitol, reveal de
// posibilități, alegere, reveal de rezultat, cash-out, navigare).
// Doar 3 momente ies complet din hartă, ca „acte" speciale:
// LifeReaction (neschimbat), Treasure, GameOver.
//
// Motorul matematic (treasureHuntMockData.js) NU e atins — doar
// secvențierea/prezentarea din acest fișier.
// ══════════════════════════════════════════════════════════════════
export default function TreasureHuntScreen({ onBack, previewMode, previewState, embedded }) {
  const [game, setGame] = useState(() => (previewMode ? buildTreasureHuntPreview(previewState) : freshGameState()));
  const [pulse, setPulse] = useState(null);
  const [visualPhase, setVisualPhase] = useState(previewMode ? "choice" : "intro");
  const [shipStationIndex, setShipStationIndex] = useState(null);
  const [travelDurationMs, setTravelDurationMs] = useState(TRAVEL_MS[1]);
  const timers = useRef([]);

  function later(fn, ms) { const t = setTimeout(fn, ms); timers.current.push(t); return t; }
  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (previewMode) {
      const g = buildTreasureHuntPreview(previewState);
      setGame(g);
      setShipStationIndex(null);
      // ── Starea "A" (pasul sigur, prima alegere) e și punctul de
      // pornire firesc — arată intro-ul complet. Restul (B-J) sar
      // direct la momentul cerut, pentru testare rapidă din Admin. ──
      if (previewState === "A") setVisualPhase("intro");
      else setVisualPhase(resolveDirectPhase(g));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewMode, previewState]);

  function resolveDirectPhase(g) {
    if (g.phase === "revealed") {
      const isLife = g.doors[g.chosenIndex]?.outcome.type === "life";
      return isLife ? "lifeReaction" : "resultReveal";
    }
    if (g.phase === "choosing") return "choice";
    return g.phase; // cashout | treasure | gameover
  }

  const chosenOutcome = game.chosenIndex != null ? game.doors[game.chosenIndex]?.outcome : null;
  const isSecondLifeLoss = chosenOutcome?.type === "life" && game.lives <= 0;
  const zone = zoneForStep(game.step);

  // ══ INTRO → prima secvență de sosire ══
  function handleRaiseAnchor() {
    startArrivalSequence(game);
  }

  // ══ SOSIRE → capitol → posibilități → alegere (auto) ══
  function startArrivalSequence(state) {
    setGame(state);
    setVisualPhase("arrival");
    later(() => {
      setVisualPhase("chapterIntro");
      later(() => {
        setVisualPhase("possibilitiesReveal");
        const doorsCount = state.doors.length;
        const revealMs = doorsCount === 3 ? 1800 : zoneForStep(state.step) === "cursed" ? 2600 : 2200;
        later(() => setVisualPhase("choice"), revealMs);
      }, CHAPTER_INTRO_MS);
    }, ARRIVAL_PAUSE_MS);
  }

  // ══ ALEGERE → rezultat (auto) ══
  function handlePick(doorIndex) {
    if (visualPhase !== "choice") return;
    const next = applyOutcome(game, doorIndex);
    const outcome = next.doors[doorIndex].outcome;
    setPulse(outcome.type === "life" ? "life" : outcome.value > 0 ? "up" : "down");
    setGame(next);
    setVisualPhase("resultReveal");
    later(() => setPulse(null), 650);
    later(() => {
      if (outcome.type === "life") setVisualPhase("lifeReaction");
      else proceedAfterResult(next);
    }, RESULT_REVEAL_MS);
  }

  // ══ Consecință: cash-out / navigare normală / navigare finală ══
  function proceedAfterResult(state) {
    const next = advanceAfterReveal(state);
    if (next.phase === "cashout") { setGame(next); setVisualPhase("cashout"); return; }
    if (next.phase === "treasure") { beginFinalTravel(next); return; }
    beginTravel(next, next.step, TRAVEL_MS[next.step] ?? 2200);
  }

  function handleReactionDone() {
    if (isSecondLifeLoss) {
      const final = advanceAfterReveal(game);
      setGame(final);
      setVisualPhase("gameover");
    } else {
      proceedAfterResult(game);
    }
  }

  function beginTravel(nextState, toStationIndex, durationMs) {
    setVisualPhase("travel");
    setTravelDurationMs(durationMs);
    setShipStationIndex(game.step);
    requestAnimationFrame(() => requestAnimationFrame(() => setShipStationIndex(toStationIndex)));
    later(() => {
      setShipStationIndex(null);
      startArrivalSequence(nextState);
    }, durationMs + 150);
  }

  function beginFinalTravel(nextState) {
    setVisualPhase("finalTravel");
    setTravelDurationMs(TRAVEL_MS.treasure);
    setShipStationIndex(game.step);
    requestAnimationFrame(() => requestAnimationFrame(() => setShipStationIndex(TREASURE_STATION_INDEX)));
    later(() => {
      setGame(nextState);
      setShipStationIndex(null);
      setVisualPhase("treasure");
    }, TRAVEL_MS.treasure + 300);
  }

  function handleCashOut() {
    setGame((g) => cashOut(g));
    setVisualPhase("cashedout");
  }
  function handleContinueRisk() {
    const next = continueAfterCashout(game);
    beginTravel(next, next.step, TRAVEL_MS[next.step] ?? 2200);
  }

  function handleRestart() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const g = previewMode ? buildTreasureHuntPreview(previewState) : freshGameState();
    setGame(g);
    setShipStationIndex(null);
    setVisualPhase(previewMode ? (previewState === "A" ? "intro" : resolveDirectPhase(g)) : "intro");
  }

  // ── Cinematice pline — SINGURELE faze fără hartă/corabie. ──
  if (visualPhase === "lifeReaction") {
    return wrapPage(embedded, onBack, <><Hud game={game} pulse="life" /><LifeReactionPanel isSecondLoss={isSecondLifeLoss} onDone={handleReactionDone} /></>);
  }
  if (visualPhase === "treasure") {
    return wrapPage(embedded, onBack, <><Hud game={game} pulse={null} /><TreasureCinematic game={game} onRestart={previewMode ? null : handleRestart} /></>);
  }
  if (visualPhase === "gameover") {
    return wrapPage(embedded, onBack, <><Hud game={game} pulse={null} /><GameOverCinematic step={game.step} onRestart={previewMode ? null : handleRestart} /></>);
  }
  if (visualPhase === "intro") {
    return wrapPage(embedded, onBack, <IntroPanel onStart={handleRaiseAnchor} />);
  }

  // ── Restul călătoriei — HARTA e mereu montată, doar conținutul
  // panoului de deasupra se schimbă cu faza. ──
  return wrapPage(embedded, onBack,
    <>
      <Hud game={game} pulse={pulse} />
      <MapPanel
        game={game} zone={zone} shipStationIndex={shipStationIndex} travelDurationMs={travelDurationMs}
        travelTag={visualPhase === "travel" || visualPhase === "finalTravel"}
        travelLine={visualPhase === "finalTravel" ? pickOnce(FINAL_CROSSING_LINES) : travelLineFor(zone)}
        dimmed={visualPhase === "cashout"}
      >
        {visualPhase === "arrival" && null}
        {visualPhase === "chapterIntro" && <ChapterIntroCard zone={zone} step={game.step} />}
        {visualPhase === "possibilitiesReveal" && <PossibilitiesRevealCard doors={game.doors} zone={zone} />}
        {visualPhase === "choice" && <ChoiceOverlay doors={game.doors} onPick={handlePick} step={game.step} lives={game.lives} />}
        {visualPhase === "resultReveal" && <ResultRevealCard doors={game.doors} chosenIndex={game.chosenIndex} />}
        {visualPhase === "cashout" && <CashoutOverlay total={game.total} lives={game.lives} onCashOut={handleCashOut} onContinue={handleContinueRisk} />}
        {visualPhase === "cashedout" && <SimpleCard icon="💰" title="TE-AI OPRIT LA TIMP" total={game.total} detail={`Ai păstrat ${game.total} PCT.`} onRestart={previewMode ? null : handleRestart} />}
      </MapPanel>
    </>
  );
}

function travelLineFor(zone) {
  return pickOnce(zone === "safe" ? TRAVEL_LINES_SAFE : zone === "danger" ? TRAVEL_LINES_RISK : TRAVEL_LINES_CURSED);
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
// INTRO — hartă/corabie/insulă în port, text scurt, RIDICĂ ANCORA.
// ══════════════════════════════════════════════════════════════════
function IntroPanel({ onStart }) {
  return (
    <div className="th-pop" style={s.introPanel}>
      <div style={s.introMapStrip}>
        <img src={ASSET.ship} alt="" style={s.introShip} />
        <div style={s.introDots}>{"⚓ 1 2 3 4 5 6 7"}</div>
        <img src={ASSET.island} alt="" style={s.introIsland} />
      </div>
      <div style={s.introTitle}>{INTRO_TITLE}</div>
      <div style={s.introLines}>
        {INTRO_LINES.map((l, i) => <div key={i} style={s.introLine}>{l}</div>)}
      </div>
      <button type="button" style={s.primaryBtn} onClick={onStart}>🏴‍☠️ RIDICĂ ANCORA</button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// MAP — persistă pe toată călătoria (mai puțin cele 3 cinematice).
// ══════════════════════════════════════════════════════════════════
function MapPanel({ game, zone, shipStationIndex, travelDurationMs, travelTag, travelLine, dimmed, children }) {
  const idx = shipStationIndex != null ? shipStationIndex : Math.min(game.step, TOTAL_STEPS);
  const shipTop = stationTopByIndex(idx);
  const islandScale = 0.7 + Math.min(game.step, TOTAL_STEPS) * 0.045; // creștere graduală — se apropie
  return (
    <div style={{ ...s.map, ...ZONE_BG[zone] }}>
      {zone === "cursed" && <div className="th-lightning" style={s.lightning} />}

      <div style={{ ...s.mapLayer, ...(dimmed ? s.mapLayerDimmed : {}) }}>
        {STATIONS.map((st, i) => (
          <div key={i} style={{ ...s.stationWrap, top: `${st.top}%`, left: `${50 + st.side * 16}%` }}>
            <div style={{ ...s.stationDot, ...(i <= game.step ? s.stationDotPassed : {}), ...(st.label === "TREASURE" ? s.stationDotTreasure : {}) }}>
              {st.label === "TREASURE" ? "🏝️" : st.label === "START" ? "⚓" : st.label}
            </div>
          </div>
        ))}

        <img src={ASSET.island} alt="" style={{ ...s.islandImg, transform: `translateX(-50%) scale(${islandScale})` }} />
        <img
          src={ASSET.ship} alt="Corabia" className="th-ship-sway"
          style={{ ...s.shipImg, top: `${shipTop}%`, transition: `top ${travelDurationMs}ms ease` }}
        />
      </div>

      {travelTag && <div style={s.travelLineTag}>⛵ {travelLine}</div>}

      {children && <div style={s.overlayZone}>{children}</div>}
    </div>
  );
}

const ZONE_BG = {
  safe: { background: "linear-gradient(180deg, #0E4C5C, #0A3348)" },
  danger: { background: "linear-gradient(180deg, #0A3348, #1A2233)" },
  cursed: { background: "linear-gradient(180deg, #14101F, #05060C)" },
};

// ══════════════════════════════════════════════════════════════════
// CHAPTER INTRO — mesaj scurt de sosire în noua zonă.
// ══════════════════════════════════════════════════════════════════
function ChapterIntroCard({ zone, step }) {
  const line = zone === "safe" ? pickOnce(SAFE_ARRIVAL) : zone === "danger" ? pickOnce(RISK_ARRIVAL) : pickOnce(CURSED_ARRIVAL);
  const title = zone === "safe" ? `🌊 APA ${step}` : zone === "danger" ? "☠️ APE PRIMEJDIOASE" : "☠️ APELE BLESTEMATE";
  return (
    <div className="th-pop" style={s.miniCard}>
      <div style={s.miniCardTitle}>{title}</div>
      <div style={s.miniCardLine}>{line}</div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// POSIBILITĂȚI — reveal secvențial, moment separat, FĂRĂ asociere
// spațială cu ușile (care nici nu sunt randate în această fază).
// ══════════════════════════════════════════════════════════════════
function PossibilitiesRevealCard({ doors, zone }) {
  const labels = useMemo(() => doors.map((d) => outcomeLabel(d.outcome)), [doors]);
  const line = zone === "safe" ? POSSIBILITIES_SAFE_LINE : zone === "danger" ? POSSIBILITIES_RISK_LINE : POSSIBILITIES_CURSED_LINE;
  return (
    <div className="th-pop" style={s.miniCard}>
      <div style={s.miniCardTitle}>🎒 SE ASCUNDE PE-AICI...</div>
      <div style={s.possibRow}>
        {labels.map((l, i) => (
          <span key={i} className="th-pop" style={{ ...s.possibChip, animationDelay: `${i * 0.35}s` }}>{l}</span>
        ))}
      </div>
      <div style={s.miniCardLine}>{line}</div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// ALEGERE — integrate ca porți maritime, touch target mare.
// ══════════════════════════════════════════════════════════════════
function ChoiceOverlay({ doors, onPick, step, lives }) {
  const isLast = step >= TOTAL_STEPS;
  return (
    <div className="th-pop" style={s.choiceCard}>
      <div style={s.miniCardTitle}>{isLast ? "☠️ ULTIMA TRECERE — ALEGE" : "🏴‍☠️ PE UNDE NAVIGHEZI?"}</div>
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
// REZULTAT — toate ușile, alegerea evidențiată, mesaj contextual,
// AUTO-avansare (fără CTA pentru cazul normal).
// ══════════════════════════════════════════════════════════════════
function ResultRevealCard({ doors, chosenIndex }) {
  const chosen = doors[chosenIndex]?.outcome;
  const line = chosen?.type === "life" ? null : chosen?.value > 0 ? bigPositiveLine(chosen.value) : negativeLine(chosen?.value);
  return (
    <div className="th-pop" style={s.miniCard}>
      {line && <div style={s.miniCardLine}>{line}</div>}
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
  );
}

// ══════════════════════════════════════════════════════════════════
// CASH-OUT — decizie dramatică, harta întunecată dar corabia vizibilă.
// ══════════════════════════════════════════════════════════════════
function CashoutOverlay({ total, lives, onCashOut, onContinue }) {
  const isLastLife = lives === 1;
  return (
    <div className="th-pop" style={s.choiceCard}>
      <div style={s.miniCardTitle}>💰 AI STRÂNS {total} PCT</div>
      <div style={s.miniCardLine}>{isLastLife ? lastLifeCashoutLine(total) : cashoutLine(total, false)}</div>
      {isLastLife && <LastLifeBanner />}
      <div style={s.cashoutRow}>
        <button type="button" style={{ ...s.primaryBtn, ...s.cashoutBtn }} onClick={onCashOut}>💰 MĂ OPRESC — {total} PCT</button>
        <button type="button" style={{ ...s.primaryBtn, ...s.continueBtn }} onClick={onContinue}>🏴‍☠️ CONTINUI SPRE COMOARĂ</button>
      </div>
    </div>
  );
}

function SimpleCard({ icon, title, total, detail, onRestart }) {
  return (
    <div className="th-pop" style={s.miniCard}>
      <div style={s.finalIcon}>{icon}</div>
      <div style={s.miniCardTitle}>{title}</div>
      <div style={s.finalTotal}>{total} PCT</div>
      <div style={s.miniCardLine}>{detail}</div>
      {onRestart && <button type="button" style={s.primaryBtn} onClick={onRestart}>Joacă din nou (mock)</button>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// LIFE REACTION — neschimbat (aprobat explicit ca fiind deja bun).
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
// GAME OVER — cinematic plin, text diferit dacă e „devreme" vs „aproape".
// ══════════════════════════════════════════════════════════════════
function GameOverCinematic({ step, onRestart }) {
  const late = step >= 6;
  const line = late ? gameOverLateLine(step, 0) : pickOnce(GAME_OVER_EARLY_LINES);
  return (
    <div className="th-pop" style={{ ...s.cinematicPanel, ...s.cinematicDark }}>
      <div style={s.cinematicHeader}>☠️ COMOARA TE-A ÎNVINS</div>
      <div style={s.finalTotal}>0 PCT</div>
      <div style={s.miniCardLine}>{line}</div>
      {onRestart && <button type="button" style={s.primaryBtn} onClick={onRestart}>Joacă din nou (mock)</button>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// TREASURE — cinematic plin, scor explicit (pre + bonus = total).
// ══════════════════════════════════════════════════════════════════
function TreasureCinematic({ game, onRestart }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOpen(true), 650);
    return () => clearTimeout(t);
  }, []);
  const preTotal = game.preTreasureTotal ?? Math.max(0, game.total - TREASURE_BONUS);
  const isPerfect = game.total >= 100;
  const line = isPerfect ? pickOnce(PERFECT_100_LINES) : pickOnce(TREASURE_FOUND_LINES);
  return (
    <div className="th-pop" style={s.cinematicPanel}>
      <img src={open ? ASSET.chestOpen : ASSET.chestClosed} alt="Comoara" className={open ? "th-chest-open" : "th-chest-shake"} style={s.treasureChestImg} />
      <div style={s.cinematicHeader}>{isPerfect ? "💯 MAXIM ABSOLUT!" : "🏆 COMOARA E A TA!"}</div>
      <div style={s.scoreBreakdown}>
        <div style={s.scoreBreakdownLine}><span>Puncte înainte de comoară</span><span style={s.scoreBreakdownVal}>{preTotal} PCT</span></div>
        <div style={s.scoreBreakdownLine}><span>Bonus comoară</span><span style={{ ...s.scoreBreakdownVal, color: color.green }}>+{TREASURE_BONUS} PCT</span></div>
        <div style={{ ...s.scoreBreakdownLine, ...s.scoreBreakdownTotal }}><span>TOTAL FINAL</span><span style={s.scoreBreakdownVal}>{game.total} PCT</span></div>
      </div>
      <div style={s.miniCardLine}>{line}</div>
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
.th-pop { animation: thPop 0.3s ease; }
.th-ship-sway { animation: thShipSway 3s ease-in-out infinite; }
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

  hud: { display: "flex", justifyContent: "space-between", alignItems: "center", background: color.surfaceElevated, border: `1px solid ${color.border}`, borderRadius: radius.md, padding: "10px 14px", margin: "12px 0", flexShrink: 0 },
  hudItem: { color: color.textPrimary, fontSize: 13, fontWeight: 800, fontFamily: font.body },
  hudPoints: { color: color.goldLight, fontSize: 15 },

  // ── INTRO ──
  introPanel: { borderRadius: radius.lg, border: `1px solid ${color.goldBorder}`, background: "linear-gradient(180deg, #0E4C5C, #0A3348)", padding: "20px 16px", textAlign: "center", minHeight: 420 },
  introMapStrip: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  introShip: { width: 70 },
  introIsland: { width: 80, opacity: 0.6 },
  introDots: { color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 800, letterSpacing: "0.15em", fontFamily: font.body },
  introTitle: { color: color.goldLight, fontSize: 19, fontWeight: 900, fontFamily: font.display, marginBottom: 12 },
  introLines: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 },
  introLine: { color: color.textSecondary, fontSize: 13, fontFamily: font.body, lineHeight: 1.4 },

  // ── MAP persistentă ──
  map: { position: "relative", borderRadius: radius.lg, overflow: "hidden", minHeight: 460, maxHeight: "66dvh", border: `1px solid ${color.border}` },
  lightning: { position: "absolute", inset: 0, background: "#FFFFFF", pointerEvents: "none" },
  mapLayer: { position: "absolute", inset: 0, transition: "opacity 0.4s ease, filter 0.4s ease" },
  mapLayerDimmed: { opacity: 0.4, filter: "blur(0.5px)" },
  stationWrap: { position: "absolute", transform: "translate(-50%, -50%)" },
  stationDot: { width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.25)", fontFamily: font.body },
  stationDotPassed: { background: color.gold, border: `1px solid ${color.goldLight}`, color: "#12141C" },
  stationDotTreasure: { fontSize: 15, background: "transparent", border: "none", width: 30, height: 30 },
  islandImg: { position: "absolute", top: "82%", left: "50%", width: "50%", maxWidth: 200, opacity: 0.9, transformOrigin: "center", transition: "transform 0.5s ease", filter: "drop-shadow(0 4px 14px rgba(0,0,0,0.5))" },
  shipImg: { position: "absolute", left: "50%", width: 88, transform: "translateX(-50%)", filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.6))" },
  travelLineTag: { position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", color: color.goldLight, fontSize: 11.5, fontWeight: 700, fontFamily: font.body, background: "rgba(5,6,12,0.6)", borderRadius: radius.pill, padding: "5px 12px", textAlign: "center", maxWidth: "88%" },

  overlayZone: { position: "absolute", left: 10, right: 10, bottom: 10, display: "flex", justifyContent: "center" },

  miniCard: { width: "100%", maxWidth: 380, background: "rgba(20,15,10,0.92)", border: `1px solid ${color.goldBorder}`, borderRadius: radius.md, padding: "12px 14px", textAlign: "center" },
  miniCardTitle: { color: color.goldLight, fontSize: 13.5, fontWeight: 800, fontFamily: font.display, letterSpacing: "0.02em" },
  miniCardLine: { color: color.textSecondary, fontSize: 11.5, fontFamily: font.body, marginTop: 5, lineHeight: 1.35 },

  possibRow: { display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap", margin: "8px 0" },
  possibChip: { fontSize: 15, fontWeight: 900, color: color.goldLight, background: "rgba(212,175,55,0.14)", border: `1px solid ${color.goldBorder}`, borderRadius: radius.sm, padding: "6px 12px", fontFamily: font.display },

  choiceCard: { width: "100%", maxWidth: 380, background: "rgba(20,15,10,0.94)", border: `1px solid ${color.goldBorder}`, borderRadius: radius.lg, padding: "14px 14px", textAlign: "center" },
  lastLifeBanner: { marginTop: 7, padding: "6px 8px", borderRadius: radius.sm, border: "1px solid rgba(220,60,60,0.5)", background: "rgba(220,60,60,0.14)" },
  lastLifeBannerCompact: { padding: "5px 7px" },
  lastLifeTitle: { color: "#F08080", fontSize: 11, fontWeight: 800, fontFamily: font.body },
  lastLifeBody: { color: "#F0A0A0", fontSize: 10, fontFamily: font.body, marginTop: 2, lineHeight: 1.3 },

  doorsGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginTop: 9 },
  doorsGrid4: { gridTemplateColumns: "repeat(2, 1fr)" },
  doorBtn: { display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "11px 6px", borderRadius: radius.md, border: `1px solid ${color.goldBorder}`, background: "rgba(212,175,55,0.1)", cursor: "pointer", minHeight: 54 },
  doorMark: { fontSize: 17 },
  doorLabel: { fontSize: 9, fontWeight: 800, color: color.goldLight, fontFamily: font.body },

  revealList: { display: "flex", flexDirection: "column", gap: 4, marginTop: 6 },
  revealRow: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 9px", borderRadius: radius.sm, background: "rgba(255,255,255,0.05)" },
  revealRowChosen: { background: "rgba(212,175,55,0.18)", border: `1px solid ${color.gold}` },
  revealLabel: { fontSize: 11, fontWeight: 700, color: color.textPrimary, fontFamily: font.body },
  revealValue: { fontSize: 12, fontWeight: 800, fontFamily: font.body, color: color.textSecondary },
  revealValuePos: { color: color.green },
  revealValueNeg: { color: "#E8837A" },
  revealValueLife: { color: "#E8837A" },

  cashoutRow: { display: "flex", flexDirection: "column", gap: 7, marginTop: 10 },
  cashoutBtn: { background: color.greenBg, border: `2px solid ${color.greenBorder}`, color: color.green },
  continueBtn: { background: "rgba(212,175,55,0.12)", border: `2px solid ${color.gold}`, color: color.goldLight },

  finalIcon: { fontSize: 30, marginBottom: 2 },
  finalTotal: { fontSize: 26, fontWeight: 900, color: color.goldLight, fontFamily: font.display, margin: "4px 0" },

  reactionPanel: { borderRadius: radius.lg, border: `1px solid ${color.border}`, background: "linear-gradient(180deg, #1C0F0F, #0A0505)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 16px", textAlign: "center", gap: 4, minHeight: 320 },
  reactionImg: { width: "auto", maxWidth: "min(90vw, 300px)", height: "auto", maxHeight: "56dvh", objectFit: "contain" },
  reactionLine: { color: "#F08080", fontSize: 14, fontWeight: 800, fontFamily: font.body, marginTop: 10, maxWidth: 300 },
  primaryBtnGhost: { marginTop: 14, padding: "10px 20px", borderRadius: radius.md, border: `1px solid ${color.goldBorder}`, background: "transparent", color: color.goldLight, fontWeight: 700, fontSize: 12, fontFamily: font.body, cursor: "pointer" },

  cinematicPanel: { borderRadius: radius.lg, border: `1px solid ${color.goldBorder}`, background: "linear-gradient(180deg, #2A2116, #1C1710)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, textAlign: "center", minHeight: 420 },
  cinematicDark: { background: "linear-gradient(180deg, #14101F, #05060C)" },
  cinematicHeader: { color: color.goldLight, fontSize: 17, fontWeight: 800, fontFamily: font.display, letterSpacing: "0.03em", marginTop: 4 },

  treasureChestImg: { width: "56%", maxWidth: 210, display: "block", marginBottom: 8 },
  scoreBreakdown: { width: "100%", maxWidth: 260, margin: "10px 0 4px", display: "flex", flexDirection: "column", gap: 5 },
  scoreBreakdownLine: { display: "flex", justifyContent: "space-between", fontSize: 12, color: color.textSecondary, fontFamily: font.body },
  scoreBreakdownVal: { fontWeight: 800, color: color.textPrimary },
  scoreBreakdownTotal: { borderTop: `1px solid ${color.border}`, paddingTop: 6, marginTop: 2, fontWeight: 800, color: color.goldLight, fontSize: 14 },

  primaryBtn: { width: "100%", padding: "12px 10px", borderRadius: radius.md, border: "none", background: color.goldGradient, color: "#12141C", fontWeight: 800, fontSize: 13, fontFamily: font.body, cursor: "pointer", marginTop: 10 },
};
