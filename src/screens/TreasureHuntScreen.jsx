import { useEffect, useMemo, useRef, useState } from "react";
import {
  freshGameState, buildTreasureHuntPreview, applyOutcome, advanceAfterReveal, cashOut, continueAfterCashout,
  TOTAL_STEPS, TREASURE_BONUS, START_LIVES, MAX_POINTS,
} from "../treasureHuntMockData";
import {
  INTRO_TITLE, INTRO_LINES, SAFE_ARRIVAL, RISK_ARRIVAL, CURSED_ARRIVAL,
  POSSIBILITIES_SAFE_LINE, POSSIBILITIES_RISK_LINE, POSSIBILITIES_CURSED_LINE,
  RISK_DECISION_LINES, CURSED_DECISION_LINES,
  LAST_LIFE_WARNING_TITLE, LAST_LIFE_WARNING_BODY, lastLifeCashoutLine,
  bigPositiveLine, negativeLine, LIFE_LOST_FIRST, LIFE_LOST_SECOND,
  GAME_OVER_EARLY_LINES, gameOverLateLine, TREASURE_FOUND_LINES, PERFECT_100_LINES, cashoutLine,
  TRAVEL_LINES_SAFE, TRAVEL_LINES_RISK, TRAVEL_LINES_CURSED, FINAL_CROSSING_LINES,
} from "../treasureHuntTexts";
import { getMyTreasureRun, saveTreasureRun, publishTreasureResult, computeTreasureFinalPoints, treasureRunStatus } from "../services/surprisesService";
import PiratesLeaderboard from "../components/PiratesLeaderboard";
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
  { label: "START", top: 4, side: 0 }, { label: "1", top: 13, side: -0.3 }, { label: "2", top: 24, side: -0.6 },
  { label: "3", top: 35, side: -0.35 }, { label: "4", top: 46, side: 0.15 }, { label: "5", top: 57, side: 0.5 },
  { label: "6", top: 68, side: 0.6 }, { label: "7", top: 79, side: 0.25 }, { label: "TREASURE", top: 92, side: 0 },
];
const TREASURE_STATION_INDEX = STATIONS.length - 1;
function stationTopByIndex(idx) { return STATIONS[Math.max(0, Math.min(idx, STATIONS.length - 1))].top; }

// ── Durate de călătorie, escaladate pe zonă (cerut explicit: 1.7-2s /
// 2.2s / 2.5s / 3s spre comoară) — SINGURUL loc unde apar aceste valori. ──
const TRAVEL_MS = { 1: 1800, 2: 1800, 3: 2000, 4: 2200, 5: 2200, 6: 2500, 7: 2500, treasure: 3000 };
const ARRIVAL_PAUSE_MS = 700;
const CHAPTER_INTRO_MS = 1600;
const LIFE_REACTION_MS = 3000; // panoul „viață pierdută” rămâne ~3 s (butonul „Continuă” îl poate închide mai devreme)
function resultRevealMsFor(step) {
  if (step <= 3) return 2000;
  if (step <= 5) return 2500;
  return 2900;
}

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
// Modul REAL (jucători): primește user + gameweekId (+ resolved/myResult de la SurprisesScreen).
// Fiecare tranziție a motorului se SALVEAZĂ înainte să fie arătată (rezultatul unei alegeri nu se
// vede până nu e salvat — o reîncărcare nu poate „încerca din nou” un alt drum); la reintrare jocul
// se reia exact de unde a rămas; nu există „Reîncepe”. Previzualizarea din Admin rămâne 100% locală.
// Ecranul exportat: jocul + (doar în modul REAL) CLASAMENTUL PIRAȚILOR dedesubt, în aceeași pagină — nu atinge harta
// și nu e popup. După ce își termină aventura, jucătorul vede clasamentul deschis, cu rezultatul lui inclus.
export default function TreasureHuntScreen(props) {
  const realMode = !props.previewMode && !!props.gameweekId && !!props.user?.uid;
  const [finishedTick, setFinishedTick] = useState(0);
  if (!realMode) return <TreasureHuntGame {...props} />;
  return (
    <>
      <TreasureHuntGame {...props} onFinished={() => setFinishedTick((t) => t + 1)} />
      <PiratesLeaderboard gameweekId={props.gameweekId} myUid={props.user.uid} finishedTick={finishedTick} resolved={!!props.resolved} />
    </>
  );
}

function TreasureHuntGame({ onBack, previewMode, previewState, embedded, user, gameweekId, resolved, myResult, onFinished }) {
  const realMode = !previewMode && !!gameweekId && !!user?.uid;
  const [loadState, setLoadState] = useState(realMode ? "loading" : "ready"); // loading | ready | error
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [hasRun, setHasRun] = useState(false);
  const [syncNote, setSyncNote] = useState("");
  const [reloadTick, setReloadTick] = useState(0);
  const mountedRef = useRef(true);
  const pendingRef = useRef(null);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

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

  // Jocul salvat → starea motorului (fără câmpurile de evidență).
  function runToGame(run) {
    return {
      step: run.step, total: run.total, lives: run.lives, phase: run.phase,
      doors: run.doors, chosenIndex: run.chosenIndex ?? null,
      ...(run.preTreasureTotal != null ? { preTreasureTotal: run.preTreasureTotal } : {}),
    };
  }
  function sameGame(a, b) {
    return a.step === b.step && a.total === b.total && a.lives === b.lives && a.phase === b.phase
      && (a.chosenIndex ?? null) === (b.chosenIndex ?? null) && JSON.stringify(a.doors) === JSON.stringify(b.doors);
  }

  // Publică rezultatul propriu (doar când aventura e terminată). Nu blochează și nu strică nimic dacă eșuează:
  // se reia la următoarea deschidere, iar Admin îl completează la rezolvare.
  function publishMine() {
    if (!realMode) return;
    publishTreasureResult(gameweekId, user.uid).catch((err) => console.warn("Comoara: rezultatul public nu s-a putut publica acum:", err?.code || err?.message));
  }

  // Reia jocul din starea salvată: ajunge în faza vizuală corectă, fără să mai amestece nimic.
  function resumeFromGame(g) {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setGame(g);
    setShipStationIndex(null);
    setPulse(null);
    setHasRun(true);
    if (g.phase === "choosing") { setVisualPhase("choice"); return; }
    if (g.phase === "revealed") {
      if (g.doors[g.chosenIndex]?.outcome.type === "life") { setVisualPhase("lifeReaction"); return; }
      setVisualPhase("resultReveal");
      later(() => proceedAfterResult(g), resultRevealMsFor(g.step));
      return;
    }
    if (["treasure", "cashedout", "gameover"].includes(g.phase)) publishMine(); // reluare după final: publicare dacă lipsea
    setVisualPhase(resolveDirectPhase(g)); // cashout | cashedout | treasure | gameover
  }

  // Salvează o tranziție ÎNAINTE de a o arăta. „ok” = salvat (inclusiv când răspunsul s-a pierdut,
  // dar serverul are deja mutarea); „error” = rămâne pe loc, cu mesaj și buton de reîncercare;
  // { resync } = serverul a AVANSAT față de ce vedem noi (altă filă) → ne aliniem la el.
  // `current` = starea locală dinaintea mutării (null la începutul jocului).
  async function persist(next, retry, current) {
    setSaving(true);
    setSaveError("");
    try {
      await saveTreasureRun(gameweekId, user.uid, next);
      return "ok";
    } catch (err) {
      try {
        const run = await getMyTreasureRun(gameweekId, user.uid);
        if (run) {
          const server = runToGame(run);
          if (sameGame(server, next)) return "ok";
          if (!current || !sameGame(server, current)) return { resync: server };
          // serverul e tot unde eram noi → salvarea chiar a eșuat: arătăm eroarea mai jos
        }
      } catch (_) { /* fără rețea — arătăm eroarea de mai jos */ }
      if (mountedRef.current) setSaveError(err?.message || "Nu s-a putut salva. Încearcă din nou.");
      pendingRef.current = retry;
      return "error";
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }
  async function guard(next, retry, current) {
    const res = await persist(next, retry, current);
    if (res === "ok") return true;
    if (res !== "error" && mountedRef.current) {
      setSyncNote("Jocul a fost sincronizat cu ultima stare salvată.");
      later(() => setSyncNote(""), 4000);
      resumeFromGame(res.resync);
    }
    return false;
  }

  useEffect(() => {
    if (!realMode) return undefined;
    let cancelled = false;
    setLoadState("loading");
    getMyTreasureRun(gameweekId, user.uid)
      .then((run) => {
        if (cancelled) return;
        if (run) resumeFromGame(runToGame(run));
        setLoadState("ready");
      })
      .catch((err) => {
        console.error("Comoara: eroare la încărcarea jocului:", err);
        if (!cancelled) setLoadState("error");
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realMode, gameweekId, user?.uid, reloadTick]);

  function resolveDirectPhase(g) {
    if (g.phase === "revealed") {
      const isLife = g.doors[g.chosenIndex]?.outcome.type === "life";
      return isLife ? "lifeReaction" : "resultReveal";
    }
    if (g.phase === "choosing") return "choice";
    return g.phase; // cashout | treasure | gameover
  }

  // Anunță wrapper-ul când aventura s-a încheiat vizual (după animația finală) → clasamentul se deschide singur.
  useEffect(() => {
    if (realMode && onFinished && ["treasure", "cashedout", "gameover"].includes(visualPhase)) onFinished();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visualPhase, realMode]);

  const restartHandler = (previewMode || realMode) ? null : handleRestart; // modul real: o singură încercare
  const chosenOutcome = game.chosenIndex != null ? game.doors[game.chosenIndex]?.outcome : null;
  const isSecondLifeLoss = chosenOutcome?.type === "life" && game.lives <= 0;
  const zone = zoneForStep(game.step);

  // ══ INTRO → prima secvență de sosire ══
  async function handleRaiseAnchor() {
    if (realMode) {
      if (saving) return;
      if (!(await guard(game, handleRaiseAnchor, null))) return;
      setHasRun(true);
    }
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
  async function handlePick(doorIndex) {
    if (visualPhase !== "choice" || saving) return;
    const next = applyOutcome(game, doorIndex);
    if (realMode && !(await guard(next, () => handlePick(doorIndex), game))) return;
    const outcome = next.doors[doorIndex].outcome;
    setPulse(outcome.type === "life" ? "life" : outcome.value > 0 ? "up" : "down");
    setGame(next);
    setVisualPhase("resultReveal");
    later(() => setPulse(null), 650);
    later(() => {
      if (outcome.type === "life") setVisualPhase("lifeReaction");
      else proceedAfterResult(next);
    }, resultRevealMsFor(game.step));
  }

  // ══ Consecință: cash-out / navigare normală / navigare finală ══
  async function proceedAfterResult(state) {
    const next = advanceAfterReveal(state);
    if (realMode && !(await guard(next, () => proceedAfterResult(state), state))) return;
    if (next.phase === "cashout") { setGame(next); setVisualPhase("cashout"); return; }
    if (next.phase === "treasure") { publishMine(); beginFinalTravel(next, state.step); return; }
    beginTravel(next, next.step, TRAVEL_MS[next.step] ?? 2200, state.step);
  }

  async function handleReactionDone() {
    if (saving) return;
    if (isSecondLifeLoss) {
      const final = advanceAfterReveal(game);
      if (realMode && !(await guard(final, handleReactionDone, game))) return;
      publishMine();
      setGame(final);
      setVisualPhase("gameover");
    } else {
      proceedAfterResult(game);
    }
  }

  function beginTravel(nextState, toStationIndex, durationMs, fromStep = game.step) {
    setVisualPhase("travel");
    setTravelDurationMs(durationMs);
    setShipStationIndex(fromStep);
    requestAnimationFrame(() => requestAnimationFrame(() => setShipStationIndex(toStationIndex)));
    later(() => {
      setShipStationIndex(null);
      startArrivalSequence(nextState);
    }, durationMs + 150);
  }

  function beginFinalTravel(nextState, fromStep = game.step) {
    setVisualPhase("finalTravel");
    setTravelDurationMs(TRAVEL_MS.treasure);
    setShipStationIndex(fromStep);
    requestAnimationFrame(() => requestAnimationFrame(() => setShipStationIndex(TREASURE_STATION_INDEX)));
    later(() => {
      setGame(nextState);
      setShipStationIndex(null);
      setVisualPhase("treasure");
    }, TRAVEL_MS.treasure + 300);
  }

  async function handleCashOut() {
    if (realMode) {
      if (saving) return;
      const next = cashOut(game);
      if (!(await guard(next, handleCashOut, game))) return;
      publishMine();
      setGame(next);
      setVisualPhase("cashedout");
      return;
    }
    setGame((g) => cashOut(g));
    setVisualPhase("cashedout");
  }
  async function handleContinueRisk() {
    if (realMode && saving) return;
    const next = continueAfterCashout(game);
    if (realMode && !(await guard(next, handleContinueRisk, game))) return;
    beginTravel(next, next.step, TRAVEL_MS[next.step] ?? 2200, game.step);
  }

  function handleRestart() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const g = previewMode ? buildTreasureHuntPreview(previewState) : freshGameState();
    setGame(g);
    setShipStationIndex(null);
    setVisualPhase(previewMode ? (previewState === "A" ? "intro" : resolveDirectPhase(g)) : "intro");
  }

  // ── Modul real: banner de salvare / eroare, notă la final, ecrane de încărcare și „rezolvat”. ──
  const saveBanner = realMode && (saving || saveError || syncNote) ? (
    <div style={{ ...s.saveBanner, ...(saveError ? s.saveBannerErr : null) }}>
      {saveError ? (
        <>
          <span>⚠️ {saveError}</span>
          <button type="button" style={s.retryBtn} onClick={() => { const fn = pendingRef.current; if (fn) { setSaveError(""); fn(); } }}>↻ Reîncearcă</button>
        </>
      ) : saving ? "Se salvează…" : syncNote}
    </div>
  ) : null;
  const finalNote = realMode && ["treasure", "gameover", "cashedout"].includes(visualPhase)
    ? <div style={s.realNote}>Punctele intră în clasament după ce Adminul rezolvă Comoara.</div>
    : null;

  if (realMode && loadState === "loading") {
    return wrapPage(embedded, onBack, <div style={s.realNote}>Se încarcă Comoara…</div>);
  }
  if (realMode && loadState === "error") {
    return wrapPage(embedded, onBack, (
      <div style={s.realNote}>
        Nu s-a putut încărca Comoara Blestemată.
        <button type="button" style={s.retryBtn} onClick={() => setReloadTick((t) => t + 1)}>↻ Încearcă din nou</button>
      </div>
    ));
  }
  if (realMode && resolved) {
    const status = hasRun ? treasureRunStatus(game) : "not-played";
    const points = myResult?.bonusPoints ?? (hasRun ? computeTreasureFinalPoints(game) : 0);
    const detail = status === "treasure" ? "Ai găsit comoara!"
      : status === "cashedout" ? "Te-ai oprit la timp și ai păstrat punctele."
      : status === "gameover" ? "Ai pierdut ambele vieți — game over."
      : status === "unfinished" ? "Nu ai terminat jocul — ai primit punctele acumulate până la rezolvare."
      : "Nu ai jucat Comoara Blestemată.";
    return wrapPage(embedded, onBack, (
      <div style={s.resolvedWrap}>
        <SimpleCard icon="🏴‍☠️" title="COMOARA A FOST REZOLVATĂ" total={points} detail={detail} onRestart={null} />
      </div>
    ));
  }

  // ── Cinematice pline — SINGURELE faze fără hartă/corabie. ──
  if (visualPhase === "lifeReaction") {
    return wrapPage(embedded, onBack, <>{saveBanner}<Hud game={game} pulse="life" /><LifeReactionPanel isSecondLoss={isSecondLifeLoss} onDone={handleReactionDone} /></>);
  }
  if (visualPhase === "treasure") {
    return wrapPage(embedded, onBack, <>{saveBanner}<Hud game={game} pulse={null} /><TreasureCinematic game={game} onRestart={restartHandler} />{finalNote}</>);
  }
  if (visualPhase === "gameover") {
    return wrapPage(embedded, onBack, <>{saveBanner}<Hud game={game} pulse={null} /><GameOverCinematic step={game.step} onRestart={restartHandler} />{finalNote}</>);
  }
  if (visualPhase === "intro") {
    return wrapPage(embedded, onBack, <>{saveBanner}<IntroPanel onStart={handleRaiseAnchor} /></>);
  }

  // ── Restul călătoriei — HARTA e mereu montată, doar conținutul
  // panoului de deasupra se schimbă cu faza. ──
  return wrapPage(embedded, onBack,
    <>
      {saveBanner}
      <Hud game={game} pulse={pulse} />
      <MapPanel
        game={game} zone={zone} shipStationIndex={shipStationIndex} travelDurationMs={travelDurationMs}
        travelTag={visualPhase === "travel" || visualPhase === "finalTravel"}
        travelLine={visualPhase === "finalTravel" ? pickOnce(FINAL_CROSSING_LINES) : travelLineFor(zone)}
        dimmed={visualPhase === "cashout"}
        showPrey={visualPhase === "choice"}
      >
        {visualPhase === "arrival" && null}
        {visualPhase === "chapterIntro" && <ChapterIntroCard zone={zone} step={game.step} />}
        {visualPhase === "possibilitiesReveal" && <PossibilitiesRevealCard doors={game.doors} zone={zone} />}
        {visualPhase === "choice" && <ChoiceOverlay doors={game.doors} onPick={handlePick} step={game.step} lives={game.lives} />}
        {visualPhase === "resultReveal" && <ResultRevealCard doors={game.doors} chosenIndex={game.chosenIndex} />}
        {visualPhase === "cashout" && <CashoutOverlay total={game.total} lives={game.lives} onCashOut={handleCashOut} onContinue={handleContinueRisk} />}
        {visualPhase === "cashedout" && <SimpleCard icon="💰" title="TE-AI OPRIT LA TIMP" total={game.total} detail={`Ai păstrat ${game.total} PCT.`} onRestart={restartHandler} />}
      </MapPanel>
      {finalNote}
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
function stationSideByIndex(idx) {
  return STATIONS[Math.max(0, Math.min(idx, STATIONS.length - 1))].side;
}

function MapPanel({ game, zone, shipStationIndex, travelDurationMs, travelTag, travelLine, dimmed, showPrey, children }) {
  const idx = shipStationIndex != null ? shipStationIndex : Math.min(game.step, TOTAL_STEPS);
  const shipTop = stationTopByIndex(idx);
  const shipLeft = 50 + stationSideByIndex(idx) * 20; // aceeași curbă lină ca stațiile, swing mult redus
  const islandScale = 0.7 + Math.min(game.step, TOTAL_STEPS) * 0.045; // creștere graduală — se apropie
  return (
    <div style={{ ...s.map, ...ZONE_BG[zone] }}>
      {zone === "cursed" && <div className="th-lightning" style={s.lightning} />}

      <div style={{ ...s.mapLayer, ...(dimmed ? s.mapLayerDimmed : {}) }}>
        {STATIONS.map((st, i) => (
          <div key={i} style={{ ...s.stationWrap, top: `${st.top}%`, left: `${50 + st.side * 20}%` }}>
            <div style={{ ...s.stationDot, ...(i <= game.step ? s.stationDotPassed : {}), ...(st.label === "TREASURE" ? s.stationDotTreasure : {}) }}>
              {st.label === "TREASURE" ? "🏝️" : st.label === "START" ? "⚓" : st.label}
            </div>
          </div>
        ))}

        <img src={ASSET.island} alt="" style={{ ...s.islandImg, transform: `translateX(-50%) scale(${islandScale})` }} />
        <img
          src={ASSET.ship} alt="Corabia" className="th-ship-sway"
          style={{ ...s.shipImg, top: `${shipTop}%`, left: `${shipLeft}%`, transition: `top ${travelDurationMs}ms ease, left ${travelDurationMs}ms ease` }}
        />
      </div>

      {travelTag && <div style={s.travelLineTag}>⛵ {travelLine}</div>}

      {showPrey && <PreyMiniHud doors={game.doors} />}

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
// Ordine FIXĂ, independentă de ordinea ușilor (puncte descrescător, viața la final) —
// altfel poziția valorii ar trăda drumul corespunzător.
function canonicalLabels(doors) {
  const rank = (o) => (o.type === "life" ? -1000 : o.value);
  return [...doors].map((d) => d.outcome).sort((a, b) => rank(b) - rank(a)).map(outcomeLabel);
}

function PossibilitiesRevealCard({ doors, zone }) {
  const labels = useMemo(() => canonicalLabels(doors), [doors]);
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
// PRADĂ — mini-HUD PERSISTENT, colț sus-dreapta al hărții, cât timp
// jucătorul alege. Doar reminder de VALORI (nu de destinații) — nicio
// asociere spațială cu ușile, ordine amestecată independent, nu
// derivă/recalculează nimic din motor. Nu acoperă HUD-ul principal
// (care e DEASUPRA hărții) și nu se suprapune cu corabia (colț, mic). ──
function PreyMiniHud({ doors }) {
  const labels = useMemo(() => canonicalLabels(doors), [doors]);
  return (
    <div style={s.preyHud}>
      <div style={s.preyHudTitle}>PRADĂ</div>
      <div style={s.preyHudGrid}>
        {labels.map((l, i) => <span key={i} style={s.preyHudChip}>{l}</span>)}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// ALEGERE — integrate ca porți maritime, touch target mare. Aici
// revine tonul cu tupeu (decizia propriu-zisă), restaurat.
// ══════════════════════════════════════════════════════════════════
function ChoiceOverlay({ doors, onPick, step, lives }) {
  const isLast = step >= TOTAL_STEPS;
  const zone = zoneForStep(step);
  const decisionLine = zone === "danger" ? pickOnce(RISK_DECISION_LINES) : zone === "cursed" ? pickOnce(CURSED_DECISION_LINES) : null;
  return (
    <div className="th-pop" style={s.choiceCard}>
      <div style={s.miniCardTitle}>{isLast ? "☠️ ULTIMA TRECERE — ALEGE" : "🏴‍☠️ PE UNDE NAVIGHEZI?"}</div>
      {decisionLine && <div style={s.miniCardLine}>{decisionLine}</div>}
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
    const t = setTimeout(onDone, LIFE_REACTION_MS);
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
  // Bonusul ADĂUGAT efectiv: +25, dar plafonat la 100 PCT (la 100 atins mai devreme nu se mai adaugă nimic).
  const bonusAdded = Math.max(0, game.total - preTotal);
  const capped = preTotal + TREASURE_BONUS > MAX_POINTS;
  const line = isPerfect ? pickOnce(PERFECT_100_LINES) : pickOnce(TREASURE_FOUND_LINES);
  return (
    <div className="th-pop" style={s.cinematicPanel}>
      <img src={open ? ASSET.chestOpen : ASSET.chestClosed} alt="Comoara" className={open ? "th-chest-open" : "th-chest-shake"} style={s.treasureChestImg} />
      <div style={s.cinematicHeader}>{isPerfect ? "💯 MAXIM ABSOLUT!" : "🏆 COMOARA E A TA!"}</div>
      <div style={s.scoreBreakdown}>
        <div style={s.scoreBreakdownLine}><span>Puncte înainte de comoară</span><span style={s.scoreBreakdownVal}>{preTotal} PCT</span></div>
        <div style={s.scoreBreakdownLine}><span>Bonus comoară{capped ? " (plafon 100)" : ""}</span><span style={{ ...s.scoreBreakdownVal, color: color.green }}>+{bonusAdded} PCT</span></div>
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

  preyHud: {
    position: "absolute", top: 8, right: 8, zIndex: 2,
    background: "rgba(20,15,10,0.85)", border: `1px dashed ${color.goldBorder}`, borderRadius: radius.sm,
    padding: "5px 7px", maxWidth: 120,
  },
  preyHudTitle: { fontSize: 8, fontWeight: 800, color: color.goldLight, letterSpacing: "0.06em", fontFamily: font.body },
  preyHudGrid: { display: "flex", flexWrap: "wrap", gap: 3, marginTop: 3 },
  preyHudChip: { fontSize: 9.5, fontWeight: 800, color: color.textPrimary, background: "rgba(212,175,55,0.14)", borderRadius: 5, padding: "1px 5px", fontFamily: font.body },

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
  saveBanner: { margin: "8px 0", padding: "7px 10px", borderRadius: radius.md, fontSize: 11.5, textAlign: "center", fontFamily: font.body, color: color.textSecondary, background: "rgba(255,255,255,0.05)" },
  saveBannerErr: { color: "#FFC2C4", background: "rgba(240,85,90,0.14)", border: "1px solid rgba(240,85,90,0.35)" },
  retryBtn: { marginLeft: 8, padding: "4px 10px", borderRadius: radius.sm, border: `1px solid ${color.goldBorder}`, background: "transparent", color: color.goldLight, fontSize: 11.5, fontWeight: 700, fontFamily: font.body, cursor: "pointer" },
  realNote: { textAlign: "center", fontSize: 11.5, color: color.textFaint, fontFamily: font.body, padding: "14px 6px", lineHeight: 1.45 },
  resolvedWrap: { display: "flex", justifyContent: "center", padding: "24px 0" },

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
