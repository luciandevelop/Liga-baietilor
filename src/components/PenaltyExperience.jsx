import { useEffect, useRef, useState } from "react";
import {
  getMyPenaltyChoices, getPenaltySubmittedUids, submitPenaltyChoices,
  getMyPenaltyPairing, getPenaltyDuelPreview, listOtherPenaltyPairings,
} from "../services/surprisesService";
import { getUserPublicProfiles } from "../services/profilesService";
import PlayerAvatar from "./PlayerAvatar";
import { color, font, radius } from "../matchdayTheme";
import {
  SAVE_LINES, SAVE_CENTER_LINES, GOAL_LINES, WRONG_GUESS_LINES,
  ROLE_SHOOT_TITLE, ROLE_DEFEND_TITLE, ROLE_SWITCH_TITLE, ROLE_SWITCH_LINE, finalLine,
} from "../penaltyTexts";

const ZONES = ["left", "center", "right"];
const ZONE_X = { left: 0.2, center: 0.5, right: 0.8 };
function pickOnce(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ══════════════════════════════════════════════════════════════════
// SCENA — REDESIGN: poarta acum e garantat COMPLET vizibilă (ambele
// bare + transversala) — în versiunea anterioară geometria (bottom +
// height) depășea 100% din înălțimea scenei, tăind transversala.
// Corectat aici: bottom 0.30 + height 0.55 = 0.85, cu margine sigură.
// ══════════════════════════════════════════════════════════════════
function Scene({ width, height, flashGoal }) {
  const postW = width * 0.05;
  const goalH = height * 0.55;
  const goalBottom = height * 0.30;
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: 12 }}>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, #08110D 0%, #0B1710 55%, #122417 100%)" }} />
      <svg width="100%" height={height * 0.16} viewBox={`0 0 ${width} ${height * 0.16}`} style={{ position: "absolute", top: 0, left: 0 }} preserveAspectRatio="none">
        <g>
          {Array.from({ length: 20 }, (_, i) => (
            <rect key={i} x={(width / 20) * i} y={0} width={width / 20 - 1} height={height * 0.05 + (i % 4) * 1.6} fill="#05080A" opacity={0.9} />
          ))}
        </g>
      </svg>
      <div style={{ position: "absolute", top: "-10%", left: "-10%", width: "55%", height: "60%", background: "radial-gradient(ellipse, rgba(255,250,220,0.3), transparent 70%)" }} />
      <div style={{ position: "absolute", top: "-10%", right: "-10%", width: "55%", height: "60%", background: "radial-gradient(ellipse, rgba(255,250,220,0.24), transparent 70%)" }} />

      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0, height: height * 0.46,
        perspective: "340px", perspectiveOrigin: "50% 0%", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", left: "-15%", right: "-15%", top: 0, height: "220%",
          background: "repeating-linear-gradient(90deg, #1C3D22 0, #1C3D22 8%, #173318 8%, #173318 16%)",
          transform: "rotateX(58deg)", transformOrigin: "50% 0%",
        }} />
        <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, transform: "rotateX(58deg)", transformOrigin: "50% 0%" }} viewBox={`0 0 ${width} ${height * 0.9}`} preserveAspectRatio="none">
          <path d={`M ${width * 0.22} 0 L ${width * 0.14} ${height * 0.5} L ${width * 0.86} ${height * 0.5} L ${width * 0.78} 0`} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={2.5} />
        </svg>
      </div>

      {/* poartă — DOMINANTĂ, garantat completă (bottom+height < 100%) */}
      <div style={{ position: "absolute", left: "50%", bottom: goalBottom, width: width * 0.9, height: goalH, transform: "translateX(-50%)" }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${width * 0.9} ${goalH}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="postV" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#6B7280" /><stop offset="40%" stopColor="#FAFBFC" /><stop offset="60%" stopColor="#FAFBFC" /><stop offset="100%" stopColor="#6B7280" />
            </linearGradient>
            <linearGradient id="postH" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6B7280" /><stop offset="45%" stopColor="#FAFBFC" /><stop offset="100%" stopColor="#6B7280" />
            </linearGradient>
            <radialGradient id="netShade2" cx="50%" cy="10%" r="95%">
              <stop offset="0%" stopColor="rgba(0,0,0,0)" /><stop offset="100%" stopColor="rgba(0,0,0,0.5)" />
            </radialGradient>
          </defs>
          <g stroke="rgba(255,255,255,0.28)" strokeWidth={0.6}>
            {Array.from({ length: 16 }, (_, i) => {
              const off = (i - 8) * (width * 0.9 / 10);
              return <line key={`d1-${i}`} x1={postW + off} y1={0} x2={postW + off + goalH * 0.85} y2={goalH} />;
            })}
            {Array.from({ length: 16 }, (_, i) => {
              const off = (i - 8) * (width * 0.9 / 10);
              return <line key={`d2-${i}`} x1={width * 0.9 - postW + off} y1={0} x2={width * 0.9 - postW + off - goalH * 0.85} y2={goalH} />;
            })}
          </g>
          <rect x={postW} y={0} width={width * 0.9 - postW * 2} height={goalH} fill="url(#netShade2)" />
          {/* transversala — SUS, lățime completă, garantat în cadru */}
          <rect x={0} y={0} width={width * 0.9} height={postW} fill="url(#postH)" />
          <rect x={0} y={0} width={postW} height={goalH} fill="url(#postV)" />
          <rect x={width * 0.9 - postW} y={0} width={postW} height={goalH} fill="url(#postV)" />
        </svg>
      </div>

      {flashGoal && <div style={{ position: "absolute", inset: 0, background: "rgba(139,217,87,0.16)", animation: "penaltyGoalFlash 420ms ease" }} />}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", borderRadius: 12, background: "radial-gradient(ellipse at 50% 38%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.4) 100%)" }} />
    </div>
  );
}

function Ball({ tx, ty, scale, rotate, blur, opacity }) {
  return (
    <img
      src="/assets/penalty/football.webp"
      alt=""
      style={{
        position: "absolute", left: "50%", bottom: "8%", width: 24, height: 24, marginLeft: 8,
        transform: `translate3d(${tx}px, ${ty}px, 0) scale(${scale}) rotate(${rotate}deg)`,
        transition: "transform 480ms cubic-bezier(.32,.6,.25,1), opacity 90ms linear",
        filter: blur ? "blur(0.6px) drop-shadow(0 3px 3px rgba(0,0,0,0.5))" : "drop-shadow(0 3px 3px rgba(0,0,0,0.5))",
        opacity, willChange: "transform, opacity",
      }}
    />
  );
}

// ── Executant — idle/kick, elan EXTINS (durată+distanță mai mari, ca
// să se citească apropierea, nu un swap brusc). Doar 2 cadre reale
// disponibile (idle/kick) — vezi raportul final pentru cadre lipsă
// (run-up cu pași intermediari). ──
const SHOOTER_H = 128;
function Shooter({ pose, tx }) {
  const src = pose === "kick" ? "/assets/penalty/shooter-kick.webp" : "/assets/penalty/shooter-idle.webp";
  return (
    <img
      src={src}
      alt=""
      style={{
        position: "absolute", left: "50%", bottom: "2%", height: SHOOTER_H,
        transform: `translate(-50%, 0) translate3d(${tx}px, 0, 0)`,
        transition: "transform 900ms cubic-bezier(.25,.4,.3,1)",
        willChange: "transform",
      }}
    />
  );
}

// ── Portar — REPARAT: ancorare prin translate(-50%) (relativă la
// propria lățime a elementului), NU printr-un marginLeft fix în px
// calibrat pe sprite-ul idle. Acela era motivul exact pentru care
// plonjonul (sprite asimetric, diagonal) părea deplasat/inversat pe
// una din direcții — un offset fix, calibrat pentru o poză simetrică,
// aplicat neschimbat și peste poza asimetrică (mirror inclus).
// translate(-50%) centrează corect elementul, identic pentru ambele
// direcții, indiferent de scaleX.
//
// CENTER — crouch REAL (coboară, nu sare în sus): translateY POZITIV
// (jos) + scaleY comprimat + scaleX ușor lățit — simulează flexarea
// genunchilor și coborârea centrului de greutate. Rămâne o
// APROXIMARE CSS pe sprite-ul idle (nu există o poză de prindere
// dedicată) — vezi raportul final. ──
const KEEPER_H = 100;
function Keeper({ tx, diving, side }) {
  const divingToSide = diving && side !== 0;
  const src = divingToSide ? "/assets/penalty/keeper-dive.webp" : "/assets/penalty/keeper-idle.webp";
  // ── FIX P0: mapping-ul mirror era INVERSAT — confirmat prin test
  // vizual real pe telefon (de două ori), peste analiza noastră de
  // pixeli. Schimbat: LEFT foloseşte acum varianta oglindită, RIGHT
  // varianta nativă — capul + mâna conducătoare trebuie să indice
  // spre bara țintă, nu spre centru. Rotația compensatorie de 7° din
  // runda trecută a fost ELIMINATĂ — nu mai e necesară odată ce
  // orientarea de bază e corectă, și ar fi dublat efectul. ──
  const mirror = divingToSide && side < 0 ? -1 : 1;
  const centerReact = diving && side === 0;
  return (
    <img
      src={src}
      alt=""
      style={{
        // ── Picioarele pe linia porții — 30%, exact goalBottom din
        // Scene (height*0.30), nu 38% (prea în față). Aceasta e originea
        // pentru toate plonjoanele. ──
        position: "absolute", left: "50%", bottom: "30%", height: KEEPER_H,
        transform: `translate(-50%, 0) translate3d(${tx}px, ${centerReact ? 10 : 0}px, 0) scaleX(${mirror}) scaleY(${centerReact ? 0.88 : 1}) scale(${centerReact ? 1.04 : 1})`,
        transformOrigin: "50% 85%",
        transition: "transform 420ms cubic-bezier(.3,1.15,.35,1)",
        willChange: "transform",
      }}
    />
  );
}

function ResultFlash({ show, outcome, forWhom }) {
  if (!show) return null;
  const goal = outcome === "goal";
  return (
    <div style={{
      position: "absolute", top: "30%", left: "50%", transform: "translate(-50%,-50%)",
      fontSize: 18, fontWeight: 900, fontFamily: font.display, whiteSpace: "nowrap", textAlign: "center",
      color: goal ? "#8BD957" : "#F0C24C", textShadow: "0 2px 10px rgba(0,0,0,0.85)",
      animation: "penaltyPop 320ms cubic-bezier(.3,1.5,.4,1)",
    }}>
      {goal ? "GOL! +10p" : `🧤 APĂRAT! +10p ${forWhom}`}
    </div>
  );
}

function TapZones({ onPick, flashZone, lockZone }) {
  return (
    <div style={{ position: "absolute", left: "6%", right: "6%", top: "6%", bottom: "38%", display: "flex" }}>
      {ZONES.map((z) => (
        <div
          key={z}
          onClick={() => onPick(z)}
          style={{
            flex: 1, cursor: "pointer", position: "relative",
            background: flashZone === z ? "rgba(212,175,55,0.32)" : "transparent",
            transition: "background 150ms ease", borderRadius: 6,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {lockZone === z && <span className="penalty-lock-pop" style={s.lockBadge}>🔒 ALES</span>}
        </div>
      ))}
    </div>
  );
}

function Pips({ results }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: "50%",
          background: results[i] === "goal" ? "#8BD957" : results[i] === "save" ? "#F0555A" : "rgba(255,255,255,0.18)",
          border: results[i] == null ? "1px solid rgba(255,255,255,0.3)" : "none",
        }} />
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// TIMING CINEMATIC — FAZA A-H, ținta explicit cerută. Motorul de
// rezultat (cine marchează) NU se schimbă aici — doar prezentarea.
// ══════════════════════════════════════════════════════════════════
const PREP_MS = 2000;      // FAZA A — pregătire
const ELAN_MS = 2000;      // FAZA C — apropiere executant
const MICRO_SUSPANS_MS = 500; // FAZA D — ezitare înainte de contact
const CONTACT_MS = 160;    // FAZA E — contact
const FLYING_MS = 520;     // FAZA F — zbor + portar
const FREEZE_MS = 1800;    // FAZA H — freeze pe rezultat
const KICK_TOTAL_MS = PREP_MS + ELAN_MS + MICRO_SUSPANS_MS + CONTACT_MS + FLYING_MS + FREEZE_MS; // ~6980ms

const STAGE_W = 340, STAGE_H = 300;
const PENALTY_ASSETS = [
  "/assets/penalty/shooter-idle.webp", "/assets/penalty/shooter-kick.webp",
  "/assets/penalty/keeper-idle.webp", "/assets/penalty/keeper-dive.webp",
  "/assets/penalty/football.webp",
];

export function usePreloadPenaltyAssets() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    Promise.all(PENALTY_ASSETS.map((src) => new Promise((resolve) => {
      const img = new Image();
      img.onload = resolve; img.onerror = resolve;
      img.src = src;
    }))).then(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, []);
  return ready;
}

// ── STAGE — mode="pick": tap → puls scurt → 🔒 ALES (450ms) → onPick
// (deliberat, nu instant). animKick prezent → secvența cinematică
// completă FAZA A/C/D/E/F/(G/H gestionate de caller via ResultFlash). ──
export function Stage({ mode, onPick, animKick, assetsReady }) {
  const [phase, setPhase] = useState("idle"); // idle -> prep -> elan -> microSuspans -> contact -> flying -> result
  const [flashZone, setFlashZone] = useState(null);
  const [lockZone, setLockZone] = useState(null);
  const timeouts = useRef([]);

  useEffect(() => {
    timeouts.current.forEach(clearTimeout);
    timeouts.current = [];
    if (!animKick) { setPhase("idle"); return; }
    setPhase("prep");
    timeouts.current.push(setTimeout(() => setPhase("elan"), PREP_MS));
    timeouts.current.push(setTimeout(() => setPhase("microSuspans"), PREP_MS + ELAN_MS));
    timeouts.current.push(setTimeout(() => setPhase("contact"), PREP_MS + ELAN_MS + MICRO_SUSPANS_MS));
    timeouts.current.push(setTimeout(() => setPhase("flying"), PREP_MS + ELAN_MS + MICRO_SUSPANS_MS + CONTACT_MS));
    timeouts.current.push(setTimeout(() => setPhase("result"), PREP_MS + ELAN_MS + MICRO_SUSPANS_MS + CONTACT_MS + FLYING_MS));
    return () => timeouts.current.forEach(clearTimeout);
  }, [animKick]);

  function handleTap(zone) {
    setFlashZone(zone);
    setTimeout(() => {
      setFlashZone(null);
      setLockZone(zone);
      setTimeout(() => { setLockZone(null); onPick(zone); }, 450);
    }, 130);
  }

  const isAnimating = !!animKick && phase !== "idle";
  const shooterPose = (phase === "contact") ? "kick" : "idle";
  const approaching = phase === "elan" || phase === "microSuspans" || phase === "contact";
  const shooterTx = approaching ? -16 : 0;

  const ballFlying = phase === "flying" || phase === "result";
  // ── Destinația mingii — calibrată pe geometria REALĂ a porții
  // (0.9×STAGE_W, minus grosimea barei), nu pe o fracțiune vagă din
  // toată scena. LEFT/RIGHT trebuie să ajungă clar lângă bară, nu
  // "aproape de centru". CENTER rămâne exact 0 (centrul porții). ──
  const goalHalfW = (STAGE_W * 0.9) / 2 - STAGE_W * 0.05; // jumătate poartă minus bara
  const ballTargetPx = goalHalfW * 0.82; // aproape de bară, cu marjă de siguranță sub grosimea ei
  const ballTx = ballFlying
    ? (animKick?.zone === "left" ? -ballTargetPx : animKick?.zone === "right" ? ballTargetPx : 0)
    : 0;
  // ── Fix chirurgical: traiectoria mingii era o înălțime FIXĂ
  // (-0.32×H), identică pentru toate combinațiile. La CENTER+plonjon
  // lateral, portarul traversează zona centrală chiar pe unde trecea
  // mingea, la aceeași înălțime — de-aici suprapunerea vizuală minge-
  // corp. Corectat STRICT pentru acest caz: arc mai înalt, doar când
  // shot===center ȘI keeper!==center. Toate celelalte combinații
  // (inclusiv center+center) rămân la -0.32×H, neschimbate. ──
  const isCenterOverLateralDive = animKick?.zone === "center" && animKick?.keeperZone && animKick.keeperZone !== "center";
  // ── Recalibrat ținând cont de RAZA reală a mingii (12px), nu doar
  // de centrul ei — 0.72 supracorecta (mingea ajungea la 3px sub bară,
  // citindu-se ca "peste poartă"). 0.66 lasă ~20px marjă simetrică:
  // sub bară ȘI peste portar. ──
  const ballTy = ballFlying ? (isCenterOverLateralDive ? -STAGE_H * 0.66 : -STAGE_H * 0.32) : 0;
  const ballScale = ballFlying ? 0.6 : 1;
  const ballRotate = ballFlying ? 280 : 0;
  const ballOpacity = phase === "contact" ? 0 : 1;

  const keeperDiving = phase === "contact" || phase === "flying" || phase === "result";
  // ── Distanța de plonjon REDUSĂ (0.62 → 0.42): analiza pixel-cu-pixel
  // a asset-ului arată mâna conducătoare deja la MARGINEA PROPRIE a
  // sprite-ului (x=0 din 475px) — cu translatarea veche (0.62×), mâna
  // ieșea aproape complet din cadru/dincolo de bară, lăsând vizibilă
  // predominant partea din spate (aproape de centru) => exact iluzia
  // "vine de la bară spre centru" + "iese absurd din poartă". ──
  const keeperTx = keeperDiving ? (ZONE_X[animKick?.keeperZone] - 0.5) * STAGE_W * 0.42 : 0;
  const keeperSide = animKick ? (animKick.keeperZone === "left" ? -1 : animKick.keeperZone === "right" ? 1 : 0) : 0;
  const flashGoal = phase === "result" && animKick?.outcome === "goal";

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: STAGE_W, aspectRatio: `${STAGE_W}/${STAGE_H}`, margin: "0 auto", borderRadius: 12, boxShadow: "0 14px 36px -10px rgba(0,0,0,0.65)", overflow: "hidden" }}>
      <Scene width={STAGE_W} height={STAGE_H} flashGoal={flashGoal} />
      {!assetsReady && <div style={s.assetLoading}>Se încarcă…</div>}
      {assetsReady && (
        <>
          <Keeper tx={keeperTx} diving={keeperDiving} side={keeperSide} />
          <Shooter pose={isAnimating ? shooterPose : "idle"} tx={isAnimating ? shooterTx : 0} />
          <Ball tx={ballTx} ty={ballTy} scale={ballScale} rotate={ballRotate} blur={phase === "flying"} opacity={ballOpacity} />
          {phase === "result" && animKick && <ResultFlash show forWhom={animKick.forWhom || ""} outcome={animKick.outcome} />}
          {!animKick && mode === "pick" && <TapZones onPick={handleTap} flashZone={flashZone} lockZone={lockZone} />}
        </>
      )}
      <div style={s.stagePhaseTag}>
        {phase === "prep" && "⚫ pregătire..."}
        {phase === "elan" && "⚫ elan..."}
        {phase === "microSuspans" && "⚫ ..."}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// SECVENȚA DE REZULTAT — fiecare lovitură e propriul mic eveniment,
// schimb de rol marcat explicit, final cu mesaj contextual.
// ══════════════════════════════════════════════════════════════════
export function ShootoutSequence({ data, myName, oppName, oppAvatarId, assetsReady, storageKey }) {
  const hasRounds = Array.isArray(data.rounds) && data.rounds.length > 0;
  const [idx, setIdx] = useState(0); // 0..9
  // ── Dacă acest duel a mai fost vizionat complet (localStorage, per
  // vizitator/telefon — nu Firestore), sărim direct la rezumat. Cheia
  // include gameweekId+uid (vine din storageKey), deci o etapă viitoare
  // NU moștenește starea "văzut" a etapei curente. ──
  const alreadySeen = (() => {
    if (!storageKey) return false;
    try { return localStorage.getItem(storageKey) === "1"; } catch { return false; }
  })();
  const [skipped, setSkipped] = useState(!hasRounds || alreadySeen);
  const [animKick, setAnimKick] = useState(null);
  const [showingRoleSwitch, setShowingRoleSwitch] = useState(false);
  const timeouts = useRef([]);

  const sequence = hasRounds
    ? data.rounds.flatMap((r) => [
        { shooter: "me", zone: r.aShot, keeperZone: r.bDefend, outcome: r.aScores ? "goal" : "save", forWhom: r.aScores ? "" : `pentru ${oppName}` },
        { shooter: "opp", zone: r.bShot, keeperZone: r.aDefend, outcome: r.bScores ? "goal" : "save", forWhom: r.bScores ? "" : "pentru tine" },
      ])
    : [];

  useEffect(() => {
    timeouts.current.forEach(clearTimeout);
    timeouts.current = [];
    if (skipped || idx >= sequence.length) return;
    // ── Schimb de rol — o singură dată, între lovitura 5 (index 4→5,
    // adversarul termină de executat/apărat pe rundă) — marcat explicit,
    // ținut suficient cât să fie înțeles. ──
    if (idx === 5) {
      setShowingRoleSwitch(true);
      timeouts.current.push(setTimeout(() => {
        setShowingRoleSwitch(false);
        setAnimKick(sequence[idx]);
      }, 2600));
    } else {
      setAnimKick(sequence[idx]);
    }
    timeouts.current.push(setTimeout(() => setIdx((v) => v + 1), idx === 5 ? KICK_TOTAL_MS + 2600 : KICK_TOTAL_MS));
    return () => timeouts.current.forEach(clearTimeout);
  }, [idx, skipped]);

  const showingSummary = skipped || idx >= sequence.length;

  // ── Odată ajunși la rezumat (natural sau prin "Sari peste"), marcăm
  // duelul ca vizionat — STRICT localStorage, zero Firestore. ──
  useEffect(() => {
    if (showingSummary && storageKey) {
      try { localStorage.setItem(storageKey, "1"); } catch { /* doar confort local, ignorăm eșecul */ }
    }
  }, [showingSummary, storageKey]);

  // ── "Revezi duelul" — REPLAY strict vizual: resetează idx la 0 și
  // skipped la false, pe ACELEAȘI date deja încărcate (data.rounds,
  // deja primite ca prop). Zero citire, zero scriere, zero recalculare
  // — doar redă din nou secvența pe baza rezultatelor deja existente. ──
  function handleReplay() {
    setIdx(0);
    setSkipped(false);
  }

  const myPips = Array.from({ length: 5 }, (_, i) => ((showingSummary || i * 2 < idx) ? (sequence[i * 2]?.outcome ?? null) : null));
  const oppPips = Array.from({ length: 5 }, (_, i) => ((showingSummary || i * 2 + 1 < idx) ? (sequence[i * 2 + 1]?.outcome ?? null) : null));
  // ── FIX P0: fiecare din cele 10 faze acordă 10 PCT UNUIA dintre cei
  // doi — fie golul executantului, fie apărarea portarului. Formula
  // veche număra STRICT golurile ca executant, ignorând complet
  // apărările => scor imposibil (nu suma la 100). Corect: pentru mine,
  // punct câștigat quando (eu execut și marchez) SAU (adversarul
  // execută și eu apăr) — simetric pentru adversar. ──
  const runningMy = sequence.slice(0, idx).filter((k) =>
    (k.shooter === "me" && k.outcome === "goal") || (k.shooter === "opp" && k.outcome === "save")
  ).length * 10;
  const runningOpp = sequence.slice(0, idx).filter((k) =>
    (k.shooter === "opp" && k.outcome === "goal") || (k.shooter === "me" && k.outcome === "save")
  ).length * 10;

  const currentKick = !showingSummary ? sequence[idx] : null;
  const isMyShotSeries = idx < 5;
  const reactionLine = currentKick && animKick
    ? (currentKick.shooter === "me"
        ? (currentKick.outcome === "goal" ? pickOnce(GOAL_LINES) : (currentKick.keeperZone === "center" ? pickOnce(SAVE_CENTER_LINES) : pickOnce(SAVE_LINES)))
        : (currentKick.outcome === "save" ? pickOnce(WRONG_GUESS_LINES) : (currentKick.keeperZone === "center" ? pickOnce(SAVE_CENTER_LINES) : pickOnce(SAVE_LINES))))
    : null;

  return (
    <div style={s.wrap}>
      <style>{ANIM_CSS}</style>
      <div style={s.header}>🥅 PENALTY PVP</div>

      <div style={s.scoreboard}>
        <div style={s.scoreboardCol}>
          <PlayerAvatar avatarId={null} nickname={myName} size={30} />
          <span style={s.scoreboardName}>{myName}</span>
          <Pips results={myPips} />
        </div>
        <div style={s.scoreboardMid}>
          <span style={s.scoreboardScore}>{showingSummary ? data.myPoints : runningMy}</span>
          <span style={s.scoreboardDash}>—</span>
          <span style={s.scoreboardScore}>{showingSummary ? (data.oppPoints ?? (100 - data.myPoints)) : runningOpp}</span>
        </div>
        <div style={s.scoreboardCol}>
          <PlayerAvatar avatarId={oppAvatarId} nickname={oppName} size={30} />
          <span style={s.scoreboardName}>{oppName}</span>
          <Pips results={oppPips} />
        </div>
      </div>

      {showingRoleSwitch && (
        <div className="penalty-pop" style={s.roleSwitchCard}>
          <div style={s.roleSwitchTitle}>{ROLE_SWITCH_TITLE}</div>
          <div style={s.roleSwitchLine}>{ROLE_SWITCH_LINE}</div>
        </div>
      )}

      {!showingSummary && !showingRoleSwitch && (
        <>
          <div style={s.roleBanner}>
            <span style={{ color: currentKick.shooter === "me" ? "#8BD957" : "#F0C24C" }}>
              {currentKick.shooter === "me" ? `⚽ ${myName} execută` : `🧤 ${oppName} execută`}
            </span>
          </div>
          <Stage mode="reveal" onPick={() => {}} animKick={animKick} assetsReady={assetsReady} />
          {reactionLine && animKick && <div className="penalty-pop" style={s.reactionLine}>{reactionLine}</div>}
          <button type="button" style={s.skipBtn} onClick={() => setSkipped(true)}>Sari peste →</button>
        </>
      )}

      {showingSummary && (
        <div className="penalty-pop" style={s.summaryCard}>
          <div style={s.fluierFinal}>🏁 FLUIER FINAL</div>
          <div style={s.summaryRow}>
            <div style={s.summaryBox}><div style={s.summaryLabel}>LOVITURILE TALE</div><div style={s.summaryValue}>{data.myGoals} gol{data.myGoals !== 1 ? "uri" : ""} / 5</div></div>
            <div style={s.summaryBox}><div style={s.summaryLabel}>APĂRĂRILE TALE</div><div style={s.summaryValue}>{data.mySaves} apărăr{data.mySaves !== 1 ? "i" : "e"} / 5</div></div>
          </div>
          <div style={s.finalScoreCard}>
            <div style={s.finalScoreLabel}>{data.isFinal ? "PUNCTAJ FINAL" : "PUNCTAJ (preview — se confirmă la Rezolvare)"}</div>
            <div style={s.finalScoreValue}>{data.myPoints}p</div>
            <div style={s.finalLine}>{finalLine(data.myGoals, data.mySaves)}</div>
          </div>
          {sequence.length > 0 && (
            <button type="button" style={s.replayBtn} onClick={handleReplay}>🔁 Revezi duelul</button>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// COMPONENTA PRINCIPALĂ — interfața/datele NESCHIMBATE.
// ══════════════════════════════════════════════════════════════════
export default function PenaltyExperience({ gameweekId, uid, resolved, myResult, results }) {
  const assetsReady = usePreloadPenaltyAssets();
  const [myChoices, setMyChoices] = useState(undefined);
  const [pairing, setPairing] = useState(undefined);
  const [submittedUids, setSubmittedUids] = useState(new Set());
  const [profiles, setProfiles] = useState({});
  const [preview, setPreview] = useState(undefined);
  const [otherPairings, setOtherPairings] = useState([]);

  const [pickIdx, setPickIdx] = useState(0);
  const [shots, setShots] = useState([]);
  const [defends, setDefends] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function refreshAll() {
    const [choices, submitted, pair, others] = await Promise.all([
      getMyPenaltyChoices(gameweekId, uid),
      getPenaltySubmittedUids(gameweekId),
      getMyPenaltyPairing(gameweekId, uid),
      listOtherPenaltyPairings(gameweekId, uid),
    ]);
    setMyChoices(choices);
    setSubmittedUids(submitted);
    setPairing(pair);
    setOtherPairings(others);
    const otherUids = others.flatMap((p) => [p.playerA, p.playerB]);
    const profileUids = pair?.opponentUid ? [pair.opponentUid, ...otherUids] : otherUids;
    if (profileUids.length > 0) setProfiles(await getUserPublicProfiles(profileUids));
    if (choices && pair?.opponentUid) {
      setPreview(await getPenaltyDuelPreview(gameweekId, uid, pair.opponentUid).catch(() => null));
    }
  }
  useEffect(() => { refreshAll(); }, [gameweekId, uid]);

  if (myChoices === undefined || pairing === undefined) return <div style={s.centerNote}>Se încarcă…</div>;

  if (pairing?.isBye) {
    return (
      <div style={s.wrap}>
        <div style={s.header}>🥅 PENALTY PVP</div>
        <div style={s.byeCard}>
          <div style={s.byeIcon}>🍀</div>
          <div style={s.byeText}>Număr impar de jucători — ai stat pe tușă etapa asta.</div>
          <div style={s.byeSub}>Primești 50p, fără meci.</div>
        </div>
      </div>
    );
  }

  const oppName = pairing?.opponentUid ? (profiles[pairing.opponentUid]?.nickname || "adversar") : "adversar";

  async function handlePick(zone) {
    if (pickIdx < 5) {
      const next = [...shots, zone];
      setShots(next);
      setPickIdx(pickIdx + 1);
    } else {
      const next = [...defends, zone];
      setDefends(next);
      if (pickIdx === 9) {
        setSubmitting(true);
        setError("");
        try {
          await submitPenaltyChoices(gameweekId, uid, shots, next);
          await refreshAll();
        } catch (err) {
          console.error("Eroare la trimiterea alegerilor de penalty:", err);
          setError(err.message || "Eroare — încearcă din nou.");
          setSubmitting(false);
          return;
        }
        setSubmitting(false);
      } else {
        setPickIdx(pickIdx + 1);
      }
    }
  }

  const finalData = resolved && myResult?.penalty
    ? {
        rounds: null,
        myGoals: myResult.penalty.myGoals, mySaves: myResult.penalty.mySaves,
        oppGoals: myResult.penalty.opponentGoals, oppSaves: myResult.penalty.opponentSaves,
        myPoints: myResult.bonusPoints, oppPoints: 100 - myResult.bonusPoints, isFinal: true,
      }
    : preview
      ? { rounds: preview.rounds, myGoals: preview.myGoals, mySaves: preview.mySaves, oppGoals: preview.oppGoals, oppSaves: preview.oppSaves, myPoints: preview.myPoints, oppPoints: preview.oppPoints, isFinal: false }
      : null;

  if (finalData) {
    return (
      <div style={s.wrap}>
        <ShootoutSequence
          data={finalData} myName="Tu" oppName={oppName} oppAvatarId={profiles[pairing?.opponentUid]?.avatarId}
          assetsReady={assetsReady} storageKey={`penalty-seen-${gameweekId}-${uid}`}
        />
        <OtherPenaltyPairings pairings={otherPairings} profiles={profiles} results={resolved ? results : null} />
      </div>
    );
  }

  if (myChoices) {
    const oppSubmitted = pairing?.opponentUid ? submittedUids.has(pairing.opponentUid) : false;
    return (
      <div style={s.wrap}>
        <div style={s.header}>🥅 PENALTY PVP</div>
        <div style={s.waitCard}>
          <div style={s.waitIcon}>⏳</div>
          <div style={s.waitText}>Alegerile tale sunt trimise.</div>
          <div style={s.waitSub}>{oppSubmitted ? "Adversarul a trimis și el — se pregătește shootout-ul…" : `Aștepți ca ${oppName} să-și trimită loviturile.`}</div>
        </div>
        <OtherPenaltyPairings pairings={otherPairings} profiles={profiles} />
      </div>
    );
  }

  const isShootingPhase = pickIdx < 5;
  const roundNum = isShootingPhase ? pickIdx + 1 : pickIdx - 5 + 1;

  return (
    <div style={s.wrap}>
      <style>{ANIM_CSS}</style>
      <div style={s.header}>🥅 PENALTY PVP <span style={s.vsOpp}>vs {oppName}</span></div>
      <div style={s.roleBanner}>
        <span style={{ color: isShootingPhase ? "#8BD957" : "#F0C24C" }}>
          {isShootingPhase ? ROLE_SHOOT_TITLE : ROLE_DEFEND_TITLE}
        </span>
        <span style={s.roleRound}>lovitura {roundNum}/5</span>
      </div>
      <Stage mode="pick" onPick={handlePick} animKick={null} assetsReady={assetsReady} />
      <div style={s.pickHint}>{isShootingPhase ? "Apasă pe poartă — stânga, mijloc sau dreapta" : "Ghicește unde va trage adversarul"}</div>
      {submitting && <div style={s.pickHint}>Se trimit alegerile…</div>}
      {error && <div style={s.errorText}>{error}</div>}
      <OtherPenaltyPairings pairings={otherPairings} profiles={profiles} />
    </div>
  );
}

// ── "Cine cu cine a picat" — cerut explicit, ca la Duel/Mai Mare-Mai
// Mic. Doar numele perechilor (fără scoruri live — Penalty se
// rezolvă dintr-o dată, nu incremental ca Duel-ul de tip Higher/Lower). ──
function OtherPenaltyPairings({ pairings, profiles, results }) {
  if (!pairings || pairings.length === 0) return null;
  return (
    <div style={s.otherPairsSection}>
      <div style={s.otherPairsLabel}>Celelalte perechi</div>
      <div style={s.otherPairsList}>
        {pairings.map((p, i) => {
          const scoreA = results?.[p.playerA]?.bonusPoints;
          const scoreB = results?.[p.playerB]?.bonusPoints;
          const hasScores = scoreA != null && scoreB != null;
          return (
            <div key={i} style={s.otherPairRow}>
              <span style={s.otherPairName}>{profiles[p.playerA]?.nickname || p.playerA}</span>
              {hasScores ? (
                <span style={s.otherPairScore}>{scoreA}–{scoreB}</span>
              ) : (
                <span style={s.otherPairVs}>vs</span>
              )}
              <span style={s.otherPairName}>{profiles[p.playerB]?.nickname || p.playerB}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ANIM_CSS = `
@keyframes penaltyPop { 0% { opacity:0; transform: translate(-50%,-50%) scale(0.5);} 60% { opacity:1; transform: translate(-50%,-50%) scale(1.12);} 100% { opacity:1; transform: translate(-50%,-50%) scale(1);} }
@keyframes penaltyGoalFlash { 0% { opacity: 0; } 30% { opacity: 1; } 100% { opacity: 0; } }
@keyframes penaltyLockPop { 0% { opacity:0; transform: scale(0.6); } 100% { opacity:1; transform: scale(1); } }
@keyframes penaltyCardPop { 0% { opacity:0; transform: scale(0.94); } 100% { opacity:1; transform: scale(1); } }
.penalty-lock-pop { animation: penaltyLockPop 150ms ease; }
.penalty-pop { animation: penaltyCardPop 250ms ease; }
@media (prefers-reduced-motion: reduce) {
  .penalty-lock-pop, .penalty-pop { animation: none !important; }
}
`;

const s = {
  otherPairsSection: { marginTop: 16 },
  otherPairsLabel: { fontSize: 10, fontWeight: 800, letterSpacing: "0.05em", color: color.textFaint, fontFamily: font.body, marginBottom: 8, textTransform: "uppercase" },
  otherPairsList: { display: "flex", flexDirection: "column", gap: 6 },
  otherPairRow: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.md,
    padding: "8px 12px", fontSize: 12, fontFamily: font.body,
  },
  otherPairName: { color: color.textSecondary, fontWeight: 600 },
  otherPairVs: { color: color.textFaint, fontSize: 10, fontWeight: 800 },
  otherPairScore: { color: color.textPrimary, fontWeight: 800, fontFamily: font.display, fontSize: 13 },
  replayBtn: {
    marginTop: 12, padding: "10px 18px", borderRadius: radius.pill, border: `1px solid ${color.border}`,
    background: "rgba(255,255,255,0.05)", color: color.textSecondary, fontSize: 12.5, fontWeight: 700,
    fontFamily: font.body, cursor: "pointer", display: "block", marginLeft: "auto", marginRight: "auto",
  },
  wrap: { position: "relative" },
  assetLoading: {
    position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: font.body,
  },
  centerNote: { textAlign: "center", fontSize: 12, color: color.textFaint, padding: "16px 0", fontFamily: font.body },
  header: { fontSize: 15, fontWeight: 800, color: color.textPrimary, textAlign: "center", fontFamily: font.display, marginBottom: 8 },
  vsOpp: { fontSize: 11, fontWeight: 600, color: color.textFaint, fontFamily: font.body },

  roleBanner: { display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 8, fontSize: 13, fontWeight: 800, fontFamily: font.display },
  roleRound: { fontSize: 10.5, fontWeight: 600, color: color.textFaint, fontFamily: font.body },
  pickHint: { textAlign: "center", fontSize: 11, color: color.textSecondary, fontFamily: font.body, marginTop: 8 },
  errorText: { fontSize: 11.5, color: "#F0555A", textAlign: "center", marginTop: 8, fontFamily: font.body },

  byeCard: { background: "rgba(212,175,55,0.08)", border: `1px solid ${color.goldBorder}`, borderRadius: radius.lg, padding: "24px 18px", textAlign: "center" },
  byeIcon: { fontSize: 28, marginBottom: 8 },
  byeText: { fontSize: 13, color: color.textPrimary, fontFamily: font.body, marginBottom: 4 },
  byeSub: { fontSize: 11, color: color.textFaint, fontFamily: font.body },

  waitCard: { background: "rgba(255,255,255,0.03)", border: `1px solid ${color.borderSubtle}`, borderRadius: radius.lg, padding: "24px 18px", textAlign: "center" },
  waitIcon: { fontSize: 26, marginBottom: 8 },
  waitText: { fontSize: 13, fontWeight: 700, color: color.textPrimary, fontFamily: font.body, marginBottom: 4 },
  waitSub: { fontSize: 11.5, color: color.textSecondary, fontFamily: font.body, lineHeight: 1.5 },

  scoreboard: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10, padding: "0 4px" },
  scoreboardCol: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4, width: 76 },
  scoreboardName: { fontSize: 10, fontWeight: 700, color: color.textPrimary, fontFamily: font.body, maxWidth: 76, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  scoreboardMid: { display: "flex", alignItems: "center", gap: 8, paddingTop: 4 },
  scoreboardScore: { fontSize: 28, fontWeight: 900, color: color.goldLight || "#D4AF37", fontFamily: font.display, minWidth: 32, textAlign: "center" },
  scoreboardDash: { fontSize: 18, color: color.textFaint, fontFamily: font.display },

  roleSwitchCard: {
    textAlign: "center", padding: "26px 16px", background: "rgba(212,175,55,0.08)", border: `1px solid ${color.goldBorder}`,
    borderRadius: radius.lg, margin: "6px 0",
  },
  roleSwitchTitle: { fontSize: 16, fontWeight: 900, color: color.goldLight, fontFamily: font.display },
  roleSwitchLine: { fontSize: 12, color: color.textSecondary, fontFamily: font.body, marginTop: 6 },

  reactionLine: { textAlign: "center", fontSize: 12.5, fontWeight: 700, color: color.textPrimary, fontFamily: font.body, marginTop: 8 },

  skipBtn: {
    display: "block", margin: "10px auto 0", background: "transparent", border: "none",
    padding: "4px 10px", fontSize: 10, fontWeight: 500, color: color.textFaint, fontFamily: font.body, cursor: "pointer", opacity: 0.6,
  },

  summaryCard: { marginTop: 8 },
  fluierFinal: { textAlign: "center", fontSize: 13, fontWeight: 800, color: color.goldLight, fontFamily: font.display, marginBottom: 8, letterSpacing: "0.04em" },
  summaryRow: { display: "flex", gap: 8, marginBottom: 4 },
  summaryBox: { flex: 1, background: "rgba(255,255,255,0.03)", border: `1px solid ${color.borderSubtle}`, borderRadius: radius.md, padding: "10px 8px", textAlign: "center" },
  summaryLabel: { fontSize: 9, fontWeight: 700, color: color.textFaint, fontFamily: font.body, marginBottom: 3, letterSpacing: "0.04em" },
  summaryValue: { fontSize: 13, fontWeight: 800, color: color.textPrimary, fontFamily: font.display },

  finalScoreCard: { marginTop: 16, textAlign: "center", background: "rgba(212,175,55,0.08)", border: `1px solid ${color.goldBorder}`, borderRadius: radius.md, padding: "14px 12px" },
  finalScoreLabel: { fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", color: color.textFaint, marginBottom: 4, fontFamily: font.body },
  finalScoreValue: { fontSize: 24, fontWeight: 900, color: color.goldLight || "#D4AF37", fontFamily: font.display },
  finalLine: { fontSize: 11.5, color: color.textSecondary, fontFamily: font.body, marginTop: 8 },

  lockBadge: {
    position: "absolute", fontSize: 10, fontWeight: 800, color: color.goldLight, fontFamily: font.body,
    background: "rgba(20,15,10,0.85)", border: `1px solid ${color.goldBorder}`, borderRadius: radius.pill, padding: "3px 8px",
  },
  stagePhaseTag: {
    position: "absolute", bottom: 4, left: "50%", transform: "translateX(-50%)",
    fontSize: 8, color: "rgba(255,255,255,0.25)", fontFamily: font.body,
  },
};
