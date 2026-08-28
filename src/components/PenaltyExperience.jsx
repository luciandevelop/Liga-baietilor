import { useEffect, useRef, useState } from "react";
import {
  getMyPenaltyChoices, getPenaltySubmittedUids, submitPenaltyChoices,
  getMyPenaltyPairing, getPenaltyDuelPreview,
} from "../services/surprisesService";
import { getUserPublicProfiles } from "../services/profilesService";
import PlayerAvatar from "./PlayerAvatar";
import { color, font, radius } from "../matchdayTheme";

const ZONES = ["left", "center", "right"];
const ZONE_X = { left: 0.2, center: 0.5, right: 0.8 };

// ══════════════════════════════════════════════════════════════════
// SCENA — perspectivă reală din spatele mingii: gazon înclinat în 3D
// (perspective + rotateX, nu un dreptunghi plat), poartă cu bare
// cilindrice, plasă cu țesătură, lumini de reflector, tribună schițată.
// Un singur element static (nu se re-desenează la fiecare cadru) — tot
// ce se mișcă (minge, portar) sunt elemente separate, animate DOAR prin
// transform (GPU), niciodată prin left/top/bottom.
// ══════════════════════════════════════════════════════════════════
function Scene({ width, height }) {
  const postW = width * 0.045;
  const goalH = height * 0.62;
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: 12 }}>
      {/* cer/fundal stadion */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, #0a1410 0%, #0d1a12 55%, #14261a 100%)" }} />
      {/* tribună schițată, sus */}
      <svg width="100%" height={height * 0.16} viewBox={`0 0 ${width} ${height * 0.16}`} style={{ position: "absolute", top: 0, left: 0 }} preserveAspectRatio="none">
        <g fill="#03050600" >
          {Array.from({ length: 20 }, (_, i) => (
            <rect key={i} x={(width / 20) * i} y={0} width={width / 20 - 1} height={height * 0.05 + (i % 4) * 1.6} fill="#05080A" opacity={0.9} />
          ))}
        </g>
      </svg>
      {/* lumini de reflector */}
      <div style={{ position: "absolute", top: "-10%", left: "-10%", width: "55%", height: "60%", background: "radial-gradient(ellipse, rgba(255,250,220,0.28), transparent 70%)" }} />
      <div style={{ position: "absolute", top: "-10%", right: "-10%", width: "55%", height: "60%", background: "radial-gradient(ellipse, rgba(255,250,220,0.22), transparent 70%)" }} />

      {/* gazon — perspectivă 3D reală (nu doar dungi plate) */}
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0, height: height * 0.46,
        perspective: "340px", perspectiveOrigin: "50% 0%", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", left: "-15%", right: "-15%", top: 0, height: "220%",
          background: "repeating-linear-gradient(90deg, #1C3D22 0, #1C3D22 8%, #173318 8%, #173318 16%)",
          transform: "rotateX(58deg)", transformOrigin: "50% 0%",
        }} />
        {/* arcul careului — punctul de 11m NU se mai desenează separat aici:
            mingea reală (football.webp) stă exact pe punctul de 11m la idle,
            un al doilea marcaj alb rotund era redundant ȘI citit vizual ca
            o a doua minge la scară mică — găsit exact prin test vizual. */}
        <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, transform: "rotateX(58deg)", transformOrigin: "50% 0%" }} viewBox={`0 0 ${width} ${height * 0.9}`} preserveAspectRatio="none">
          <path d={`M ${width * 0.22} 0 L ${width * 0.14} ${height * 0.5} L ${width * 0.86} ${height * 0.5} L ${width * 0.78} 0`} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={2.5} />
        </svg>
      </div>

      {/* poartă */}
      <div style={{ position: "absolute", left: "50%", bottom: height * 0.44, width: width * 0.88, height: goalH, transform: "translateX(-50%)" }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${width * 0.88} ${goalH}`} preserveAspectRatio="none">
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
              const off = (i - 8) * (width * 0.88 / 10);
              return <line key={`d1-${i}`} x1={postW + off} y1={0} x2={postW + off + goalH * 0.85} y2={goalH} />;
            })}
            {Array.from({ length: 16 }, (_, i) => {
              const off = (i - 8) * (width * 0.88 / 10);
              return <line key={`d2-${i}`} x1={width * 0.88 - postW + off} y1={0} x2={width * 0.88 - postW + off - goalH * 0.85} y2={goalH} />;
            })}
          </g>
          <rect x={postW} y={0} width={width * 0.88 - postW * 2} height={goalH} fill="url(#netShade2)" />
          <rect x={0} y={0} width={width * 0.88} height={postW} fill="url(#postH)" />
          <rect x={0} y={0} width={postW} height={goalH} fill="url(#postV)" />
          <rect x={width * 0.88 - postW} y={0} width={postW} height={goalH} fill="url(#postV)" />
        </svg>
      </div>
    </div>
  );
}

// ── Minge — asset real (football.webp), animată DOAR prin transform
// (translate3d + scale + rotate), niciodată prin left/bottom. `opacity`
// controlează dispariția temporară exact în clipa de contact (vezi
// Stage) — aia e mecanismul prin care NU apar două mingi niciodată:
// mingea separată se ascunde exact când sprite-ul shooter-kick (care
// are o minge desenată lângă picior) e vizibil, și reapare abia după
// ce shooter revine la idle. ──
function Ball({ tx, ty, scale, rotate, blur, opacity }) {
  return (
    <img
      src="/assets/penalty/football.webp"
      alt=""
      style={{
        position: "absolute", left: "50%", bottom: "6%", width: 22, height: 22, marginLeft: 6,
        transform: `translate3d(${tx}px, ${ty}px, 0) scale(${scale}) rotate(${rotate}deg)`,
        transition: "transform 380ms cubic-bezier(.32,.6,.25,1), opacity 90ms linear",
        filter: blur ? "blur(0.6px) drop-shadow(0 3px 3px rgba(0,0,0,0.5))" : "drop-shadow(0 3px 3px rgba(0,0,0,0.5))",
        opacity, willChange: "transform, opacity",
      }}
    />
  );
}

// ── Executant — văzut din spate, la 2-3 pași de minge. Două sprite-uri
// (idle/kick), NICIODATĂ afișate simultan — swap instant prin toggle de
// `src` (ambele preîncărcate la mount, deci fără cerere de rețea în
// momentul critic = fără flicker). Aceeași ÎNĂLȚIME pentru amândouă
// (150px), ca scara personajului să nu "sară" la swap — doar lățimea
// diferă natural (poza de șut e mai lată, piciorul extins). ──
const SHOOTER_H = 120;
function Shooter({ pose, tx }) {
  const src = pose === "kick" ? "/assets/penalty/shooter-kick.webp" : "/assets/penalty/shooter-idle.webp";
  return (
    <img
      src={src}
      alt=""
      style={{
        position: "absolute", left: "50%", bottom: "2%", height: SHOOTER_H, marginLeft: -SHOOTER_H * 0.42,
        transform: `translate3d(${tx}px, 0, 0)`,
        transition: "transform 170ms cubic-bezier(.3,.5,.3,1)",
        willChange: "transform",
      }}
    />
  );
}

// ── Portar — keeper-idle.webp în poziție de bază, keeper-dive.webp în
// plonjon (swap de src, nu SVG). Pentru dreapta, ACELAȘI keeper-dive,
// oglindit cu scaleX(-1) — exact cum s-a stabilit, un singur asset de
// plonjon ajunge pentru ambele direcții. Mișcarea (translate3d lateral)
// separată de oglindire, ca să nu interfereze una cu alta. ──
const KEEPER_H = 78;
function Keeper({ tx, diving, side }) {
  // Pentru centru (side===0), NU comutăm pe sprite-ul de plonjon — ar
  // arăta anatomic ciudat (poziție orizontală de plonjon, dar fără nicio
  // deplasare laterală, ca și cum ar sta întins pe loc). Un portar care
  // apără pe centru rămâne în picioare, doar reacționează — folosim
  // keeper-idle cu o mică "săritură" reactivă (scale+translateY), nu
  // pose-ul complet de plonjon. Găsit exact prin test vizual (CENTER TEST).
  const divingToSide = diving && side !== 0;
  const src = divingToSide ? "/assets/penalty/keeper-dive.webp" : "/assets/penalty/keeper-idle.webp";
  const mirror = divingToSide && side > 0 ? -1 : 1;
  const centerReact = diving && side === 0;
  return (
    <img
      src={src}
      alt=""
      style={{
        position: "absolute", left: "50%", bottom: "40%", height: KEEPER_H, marginLeft: -KEEPER_H * 0.62,
        transform: `translate3d(${tx}px, ${centerReact ? -6 : 0}px, 0) scaleX(${mirror}) scale(${centerReact ? 1.08 : 1})`,
        transition: "transform 300ms cubic-bezier(.34,1.3,.4,1), left 300ms cubic-bezier(.34,1.3,.4,1)",
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
      position: "absolute", top: "34%", left: "50%", transform: "translate(-50%,-50%)",
      fontSize: 17, fontWeight: 900, fontFamily: font.display, whiteSpace: "nowrap", textAlign: "center",
      color: goal ? "#8BD957" : "#F0C24C", textShadow: "0 2px 10px rgba(0,0,0,0.85)",
      animation: "penaltyPop 320ms cubic-bezier(.3,1.5,.4,1)",
    }}>
      {goal ? "GOL! +10p" : `🧤 APĂRAT! +10p ${forWhom}`}
    </div>
  );
}

// ── Zonele de tap — invizibile, direct peste scenă (poartă), pentru
// faza de alegere. Un puls scurt (150ms) la selectare, apoi se
// blochează — exact cum a fost cerut, nu butoane separate. ──
function TapZones({ onPick, flashZone }) {
  return (
    <div style={{ position: "absolute", left: "6%", right: "6%", top: "6%", bottom: "38%", display: "flex" }}>
      {ZONES.map((z) => (
        <div
          key={z}
          onClick={() => onPick(z)}
          style={{
            flex: 1, cursor: "pointer",
            background: flashZone === z ? "rgba(212,175,55,0.32)" : "transparent",
            transition: "background 150ms ease",
            borderRadius: 6,
          }}
        />
      ))}
    </div>
  );
}

// ── Pips — progres vizual "● ● ● ● ●" per rol, umplut pe măsură ce
// se joacă. ──
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
// STAGE — combină Scene + Shooter + Ball + Keeper + zonele de tap sau
// rezultatul unei lovituri. Timing (spec: tap→100-200ms→șut→400-700ms
// zbor+plonjon→impact→~500ms rezultat):
//
//   0ms      tap (puls 130ms, existent)
//   130ms    APROPIERE — shooter-idle alunecă spre minge (translate3d)
//   280ms    CONTACT — swap shooter idle→kick; mingea separată devine
//            invizibilă (opacity 0) EXACT în acest instant — sprite-ul
//            kick are deja o minge desenată lângă picior, deci în acest
//            cadru se vede O SINGURĂ minge (cea din imagine). Portarul
//            își începe plonjonul simultan (regulă explicită: keeper
//            pornește aproape simultan cu șutul, nu după).
//   390ms    shooter revine la idle (poza de șut a fost vizibilă doar
//            ~110ms — destul cât să se "simtă" contactul, dar nu ținută
//            ca literă moartă) — ȘI, în ACELAȘI moment, mingea separată
//            devine vizibilă (opacity 1) și pornește să zboare. Pentru
//            că mingea din imagine nu mai există vizual (shooter e
//            înapoi pe idle, fără minge desenată) și mingea reală tocmai
//            a apărut la aceeași poziție, nu există niciun cadru cu
//            ambele vizibile simultan — verificat exact prin captură.
//   ~790ms   minge+portar ajung la destinație (zbor 400ms, în ținta
//            300-500ms)
//   ~1190ms  rezultat afișat
// ══════════════════════════════════════════════════════════════════
const STAGE_W = 340, STAGE_H = 300;
const PENALTY_ASSETS = [
  "/assets/penalty/shooter-idle.webp", "/assets/penalty/shooter-kick.webp",
  "/assets/penalty/keeper-idle.webp", "/assets/penalty/keeper-dive.webp",
  "/assets/penalty/football.webp",
];

// ── Preîncărcare — apelată o singură dată, la mount-ul componentei
// principale, ÎNAINTE ca primul penalty să poată începe (cerut explicit
// — fără asta, primul swap idle→kick ar avea un mic delay de rețea și
// ar arăta ca un "pop"). ──
function usePreloadPenaltyAssets() {
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

function Stage({ mode, onPick, animKick, assetsReady }) {
  // animKick: { zone, keeperZone, outcome } | null — null = faza de PICK
  const [phase, setPhase] = useState("idle"); // idle -> approach -> contact -> flying -> result
  const [flashZone, setFlashZone] = useState(null);
  const timeouts = useRef([]);

  useEffect(() => {
    timeouts.current.forEach(clearTimeout);
    timeouts.current = [];
    if (!animKick) { setPhase("idle"); return; }
    setPhase("approach");
    timeouts.current.push(setTimeout(() => setPhase("contact"), 150));
    timeouts.current.push(setTimeout(() => setPhase("flying"), 260));
    timeouts.current.push(setTimeout(() => setPhase("result"), 660));
    return () => timeouts.current.forEach(clearTimeout);
  }, [animKick]);

  function handleTap(zone) {
    setFlashZone(zone);
    setTimeout(() => { setFlashZone(null); onPick(zone); }, 130);
  }

  const isAnimating = !!animKick && phase !== "idle";
  const shooterPose = phase === "contact" ? "kick" : "idle";
  const shooterTx = phase === "approach" || phase === "contact" ? -6 : 0;

  const ballFlying = phase === "flying" || phase === "result";
  const ballTx = ballFlying ? (ZONE_X[animKick?.zone] - 0.5) * STAGE_W * 0.8 : 0;
  const ballTy = ballFlying ? -STAGE_H * 0.32 : 0;
  const ballScale = ballFlying ? 0.62 : 1;
  const ballRotate = ballFlying ? 260 : 0;
  // mecanismul anti-"două mingi": invizibilă EXACT în faza de contact
  // (când shooter-kick își arată propria minge desenată), vizibilă în
  // rest.
  const ballOpacity = phase === "contact" ? 0 : 1;

  const keeperDiving = phase === "contact" || phase === "flying" || phase === "result";
  const keeperTx = keeperDiving ? (ZONE_X[animKick?.keeperZone] - 0.5) * STAGE_W * 0.62 : 0;
  const keeperSide = animKick ? (animKick.keeperZone === "left" ? -1 : animKick.keeperZone === "right" ? 1 : 0) : 0;

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: STAGE_W, aspectRatio: `${STAGE_W}/${STAGE_H}`, margin: "0 auto", borderRadius: 12, boxShadow: "0 14px 36px -10px rgba(0,0,0,0.65)", overflow: "hidden" }}>
      <Scene width={STAGE_W} height={STAGE_H} />
      {!assetsReady && <div style={s.assetLoading}>Se încarcă…</div>}
      {assetsReady && (
        <>
          <Keeper tx={keeperTx} diving={keeperDiving} side={keeperSide} />
          <Shooter pose={isAnimating ? shooterPose : "idle"} tx={isAnimating ? shooterTx : 0} />
          <Ball tx={ballTx} ty={ballTy} scale={ballScale} rotate={ballRotate} blur={phase === "flying"} opacity={ballOpacity} />
          {phase === "result" && animKick && <ResultFlash show forWhom={animKick.forWhom || ""} outcome={animKick.outcome} />}
          {!animKick && <TapZones onPick={handleTap} flashZone={flashZone} />}
        </>
      )}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", borderRadius: 12, background: "radial-gradient(ellipse at 50% 40%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.45) 100%)" }} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// COMPONENTA PRINCIPALĂ
// ══════════════════════════════════════════════════════════════════
export default function PenaltyExperience({ gameweekId, uid, resolved, myResult }) {
  const assetsReady = usePreloadPenaltyAssets();
  const [myChoices, setMyChoices] = useState(undefined);
  const [pairing, setPairing] = useState(undefined);
  const [submittedUids, setSubmittedUids] = useState(new Set());
  const [profiles, setProfiles] = useState({});
  const [preview, setPreview] = useState(undefined);

  // faza de alegere — 10 pași (5 lovituri, apoi 5 apărări), un tap = un pas
  const [pickIdx, setPickIdx] = useState(0);
  const [shots, setShots] = useState([]);
  const [defends, setDefends] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function refreshAll() {
    const [choices, submitted, pair] = await Promise.all([
      getMyPenaltyChoices(gameweekId, uid),
      getPenaltySubmittedUids(gameweekId),
      getMyPenaltyPairing(gameweekId, uid),
    ]);
    setMyChoices(choices);
    setSubmittedUids(submitted);
    setPairing(pair);
    if (pair?.opponentUid) setProfiles(await getUserPublicProfiles([pair.opponentUid]));
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
        myPoints: myResult.bonusPoints, isFinal: true,
      }
    : preview
      ? { rounds: preview.rounds, myGoals: preview.myGoals, mySaves: preview.mySaves, oppGoals: preview.oppGoals, oppSaves: preview.oppSaves, myPoints: preview.myPoints, isFinal: false }
      : null;

  if (finalData) {
    return <ShootoutSequence data={finalData} myName="Tu" oppName={oppName} oppAvatarId={profiles[pairing?.opponentUid]?.avatarId} assetsReady={assetsReady} />;
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
      </div>
    );
  }

  // ── FAZA DE ALEGERE — tap direct pe scenă, un pas la un timp. ──
  const isShootingPhase = pickIdx < 5;
  const roundNum = isShootingPhase ? pickIdx + 1 : pickIdx - 5 + 1;

  return (
    <div style={s.wrap}>
      <div style={s.header}>🥅 PENALTY PVP <span style={s.vsOpp}>vs {oppName}</span></div>
      <div style={s.roleBanner}>
        <span style={{ color: isShootingPhase ? "#8BD957" : "#F0C24C" }}>
          {isShootingPhase ? "⚽ TU EXECUȚI" : "🧤 TU APERI"}
        </span>
        <span style={s.roleRound}>lovitura {roundNum}/5</span>
      </div>
      <Stage mode="pick" onPick={handlePick} animKick={null} assetsReady={assetsReady} />
      <div style={s.pickHint}>{isShootingPhase ? "Apasă pe poartă — stânga, mijloc sau dreapta" : "Ghicește unde va trage adversarul"}</div>
      {submitting && <div style={s.pickHint}>Se trimit alegerile…</div>}
      {error && <div style={s.errorText}>{error}</div>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// SECVENȚA DE REZULTAT — rundă cu rundă, tempo rapid, pips + scor live.
// ══════════════════════════════════════════════════════════════════
function ShootoutSequence({ data, myName, oppName, oppAvatarId, assetsReady }) {
  const hasRounds = Array.isArray(data.rounds) && data.rounds.length > 0;
  const [idx, setIdx] = useState(0); // 0..9
  const [skipped, setSkipped] = useState(!hasRounds);
  const [animKick, setAnimKick] = useState(null);
  const timeouts = useRef([]);

  const sequence = hasRounds
    ? data.rounds.flatMap((r) => [
        { shooter: "me", zone: r.aShot, keeperZone: r.bDefend, outcome: r.aScores ? "goal" : "save", forWhom: r.aScores ? "" : `pentru ${oppName}` },
        { shooter: "opp", zone: r.bShot, keeperZone: r.aDefend, outcome: r.bScores ? "goal" : "save", forWhom: r.bScores ? "" : "pentru tine" },
      ])
    : [];

  useEffect(() => {
    timeouts.current.forEach(clearTimeout);
    if (skipped || idx >= sequence.length) return;
    setAnimKick(sequence[idx]);
    timeouts.current = [setTimeout(() => setIdx((v) => v + 1), 1350)];
    return () => timeouts.current.forEach(clearTimeout);
  }, [idx, skipped]);

  const showingSummary = skipped || idx >= sequence.length;
  const myPips = Array.from({ length: 5 }, (_, i) => ((showingSummary || i * 2 < idx) ? (sequence[i * 2]?.outcome ?? null) : null));
  const oppPips = Array.from({ length: 5 }, (_, i) => ((showingSummary || i * 2 + 1 < idx) ? (sequence[i * 2 + 1]?.outcome ?? null) : null));
  const runningMy = sequence.slice(0, idx).filter((k) => k.shooter === "me" && k.outcome === "goal").length * 10;
  const runningOpp = sequence.slice(0, idx).filter((k) => k.shooter === "opp" && k.outcome === "goal").length * 10;

  return (
    <div style={s.wrap}>
      <style>{`@keyframes penaltyPop { 0% { opacity:0; transform: translate(-50%,-50%) scale(0.5);} 60% { opacity:1; transform: translate(-50%,-50%) scale(1.12);} 100% { opacity:1; transform: translate(-50%,-50%) scale(1);} }`}</style>
      <div style={s.header}>🥅 PENALTY PVP</div>

      <div style={s.scoreboard}>
        <div style={s.scoreboardCol}>
          <PlayerAvatar avatarId={null} nickname={myName} size={30} />
          <span style={s.scoreboardName}>{myName}</span>
          <Pips results={myPips} />
        </div>
        <div style={s.scoreboardMid}>
          <span style={s.scoreboardScore}>{showingSummary ? data.myGoals * 10 : runningMy}</span>
          <span style={s.scoreboardDash}>—</span>
          <span style={s.scoreboardScore}>{showingSummary ? data.oppGoals * 10 : runningOpp}</span>
        </div>
        <div style={s.scoreboardCol}>
          <PlayerAvatar avatarId={oppAvatarId} nickname={oppName} size={30} />
          <span style={s.scoreboardName}>{oppName}</span>
          <Pips results={oppPips} />
        </div>
      </div>

      {!showingSummary && (
        <>
          <div style={s.roleBanner}>
            <span style={{ color: sequence[idx].shooter === "me" ? "#8BD957" : "#F0C24C" }}>
              {sequence[idx].shooter === "me" ? `⚽ ${myName} execută` : `🧤 ${oppName} execută`}
            </span>
          </div>
          <Stage mode="reveal" onPick={() => {}} animKick={animKick} assetsReady={assetsReady} />
          <button type="button" style={s.skipBtn} onClick={() => setSkipped(true)}>Sari peste →</button>
        </>
      )}

      {showingSummary && (
        <div style={s.summaryCard}>
          <div style={s.summaryRow}>
            <div style={s.summaryBox}><div style={s.summaryLabel}>LOVITURILE TALE</div><div style={s.summaryValue}>{data.myGoals} gol{data.myGoals !== 1 ? "uri" : ""} / 5</div></div>
            <div style={s.summaryBox}><div style={s.summaryLabel}>APĂRĂRILE TALE</div><div style={s.summaryValue}>{data.mySaves} apărăr{data.mySaves !== 1 ? "i" : "e"} / 5</div></div>
          </div>
          <div style={s.finalScoreCard}>
            <div style={s.finalScoreLabel}>{data.isFinal ? "PUNCTAJ FINAL" : "PUNCTAJ (preview — se confirmă la Rezolvare)"}</div>
            <div style={s.finalScoreValue}>{data.myPoints}p</div>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
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

  skipBtn: {
    display: "block", margin: "10px auto 0", background: "transparent", border: "none",
    padding: "4px 10px", fontSize: 10, fontWeight: 500, color: color.textFaint, fontFamily: font.body, cursor: "pointer", opacity: 0.6,
  },

  summaryCard: { marginTop: 8 },
  summaryRow: { display: "flex", gap: 8, marginBottom: 4 },
  summaryBox: { flex: 1, background: "rgba(255,255,255,0.03)", border: `1px solid ${color.borderSubtle}`, borderRadius: radius.md, padding: "10px 8px", textAlign: "center" },
  summaryLabel: { fontSize: 9, fontWeight: 700, color: color.textFaint, fontFamily: font.body, marginBottom: 3, letterSpacing: "0.04em" },
  summaryValue: { fontSize: 13, fontWeight: 800, color: color.textPrimary, fontFamily: font.display },

  finalScoreCard: { marginTop: 16, textAlign: "center", background: "rgba(212,175,55,0.08)", border: `1px solid ${color.goldBorder}`, borderRadius: radius.md, padding: "14px 12px" },
  finalScoreLabel: { fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", color: color.textFaint, marginBottom: 4, fontFamily: font.body },
  finalScoreValue: { fontSize: 24, fontWeight: 900, color: color.goldLight || "#D4AF37", fontFamily: font.display },
};
