import { useEffect, useMemo, useState } from "react";
import { getRouletteSpin, submitRouletteSpin } from "../services/surprisesService";
import { color, font, radius } from "../matchdayTheme";

// Ordine vizuală pe roată — REARANJATĂ față de ROULETTE_SEGMENTS brut,
// ca valorile identice să nu fie lipite una de alta (cerut explicit).
// Aceleași 16 valori, doar ordinea de afișare diferă.
const WHEEL_ORDER = [0, 25, 50, 75, 0, 25, 50, 100, 0, 25, 50, 75, 0, 25, 50, 25];
const SEGMENT_ANGLE = 360 / WHEEL_ORDER.length;
// ── Design ales: Direcția 1 (Casino Premium) ca bază, cu contrastul
// segmentelor crescut spre Direcția 2 (mai saturat, nu mai auriu-mut ca
// varianta inițială) — cerut explicit, "mix" între cele două. ──
const SEGMENT_COLOR = { 0: "#33251A", 25: "#7A5220", 50: "#1E5878", 75: "#5C2A78", 100: "#D4AF37" };
const SEGMENT_ICON = { 0: "🎁", 25: "🪙", 50: "💰", 75: "💎", 100: "👑" };

// ── Mesaj funny după oprire — STRICT pe baza valorii deja obținute
// (nu influențează și nu recalculează nimic, doar comentează rezultatul
// existent). Textele sunt exact cele cerute. ──
function resultMessage(value) {
  if (value === 0) return "Roata a zis pas 😅";
  if (value === 25) return "Merge și-așa";
  if (value === 50) return "Binișor!";
  if (value === 75) return "Aproape de jackpot";
  if (value === 100) return "JACKPOT! 👑";
  return "";
}

// ── 3 intensități de rotire — afectează STRICT animația (viteză/durată/
// număr de ture). Valoarea câștigată vine mereu din submitRouletteSpin
// (server-random, neatins de aici) — alegerea intensității se face
// ÎNAINTE de a ști rezultatul și nu poate influența în niciun fel unde
// se oprește roata (poziția finală se calculează din valoarea deja
// primită, nu invers). ──
const INTENSITY = {
  soft: { key: "soft", label: "🤏 Ușurel", spins: 3, duration: 1.7, easing: "cubic-bezier(0.22, 0.61, 0.36, 1)" },
  normal: { key: "normal", label: "💪 Serios", spins: 5, duration: 2.9, easing: "cubic-bezier(0.15, 0.75, 0.25, 1)" },
  hard: { key: "hard", label: "🚀 Rupe roata", spins: 9, duration: 4.4, easing: "cubic-bezier(0.1, 0.85, 0.15, 1)" },
};

function angleForValue(value) {
  // Primul segment din ordinea vizuală care are valoarea căutată —
  // determinist (același număr => aceeași poziție pe roată mereu).
  const idx = WHEEL_ORDER.findIndex((v) => v === value);
  return idx * SEGMENT_ANGLE + SEGMENT_ANGLE / 2;
}

// ── Confetti — doar la 100p, doar o dată, piese generate o singură
// dată (useMemo) ca să nu se reamestece la fiecare randare. Pur CSS,
// fără librărie nouă. ──
const CONFETTI_COLORS = ["#D4AF37", "#E8C766", "#F0555A", "#8BD957", "#FFF6D9"];
function useConfettiPieces(active) {
  return useMemo(() => {
    if (!active) return [];
    return Array.from({ length: 26 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.4,
      duration: 1.6 + Math.random() * 0.9,
      rotate: Math.random() * 360,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      drift: (Math.random() - 0.5) * 60,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}

export default function RouletteExperience({ gameweekId, uid, deadlinePassed, onResolvedChange }) {
  const [spin1, setSpin1] = useState(undefined); // undefined = se încarcă, null = nu există încă
  const [spin2, setSpin2] = useState(undefined);
  const [phase, setPhase] = useState("loading"); // loading | ready | spinning | settling | decide | final
  const [rotation, setRotation] = useState(0);
  const [transitionSpec, setTransitionSpec] = useState("none");
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [s1, s2] = await Promise.all([
        getRouletteSpin(gameweekId, uid, 1),
        getRouletteSpin(gameweekId, uid, 2),
      ]);
      if (cancelled) return;
      setSpin1(s1);
      setSpin2(s2);
      if (s2) { setPhase("final"); setRotation(angleForValueToRotation(s2.value)); }
      else if (s1) { setPhase("decide"); setRotation(angleForValueToRotation(s1.value)); }
      else { setPhase("ready"); }
    })();
    return () => { cancelled = true; };
  }, [gameweekId, uid]);

  function angleForValueToRotation(value) {
    // Pointer-ul e FIX sus — rotim roata ca segmentul țintă să ajungă sus.
    return -angleForValue(value);
  }

  async function handleSpin(spinNumber, intensityKey) {
    const intensity = INTENSITY[intensityKey] || INTENSITY.normal;
    setPhase("spinning");
    setTransitionSpec(`transform ${intensity.duration}s ${intensity.easing}`);
    const value = await submitRouletteSpin(gameweekId, uid, spinNumber);
    const baseTarget = angleForValueToRotation(value);
    setRotation((prev) => prev - intensity.spins * 360 + ((baseTarget - prev) % 360));
    const finalRotation = baseTarget - intensity.spins * 360;

    setTimeout(() => {
      // ── Tremur/frânare — un mic "du-te-vino" scurt chiar înainte de
      // poziția finală, senzația de roată care încă vibrează când
      // frânează, nu se oprește brusc-brusc. Doar cosmetic, poziția
      // finală rămâne exact aceeași (finalRotation), calculată o
      // singură dată mai sus, din valoarea deja primită de la server. ──
      setPhase("settling");
      setTransitionSpec("transform 130ms ease-out");
      setRotation(finalRotation + 2.2);
      setTimeout(() => {
        setRotation(finalRotation - 1.1);
        setTimeout(() => {
          setRotation(finalRotation);
          const data = { uid, value, spinNumber };
          if (spinNumber === 1) { setSpin1(data); setPhase("decide"); }
          else {
            setSpin2(data);
            setPhase("final");
            onResolvedChange?.();
          }
          if (value === 100 && typeof navigator !== "undefined" && navigator.vibrate) {
            navigator.vibrate([70, 40, 130]);
          }
        }, 130);
      }, 130);
    }, intensity.duration * 1000);
  }

  // ── FIX găsit la testare (bug pre-existent, dinainte de orice
  // modificare de-a mea): "displayedValue" citea DOAR din spin2 în faza
  // "final" — dar dacă userul apasă "Păstrează" (fără rejoc), spin2 nu
  // există niciodată, deci rezultatul final dispărea complet de pe
  // ecran. Fix minimal: spin2 dacă există (rejoc), altfel spin1
  // (păstrat) — acoperă ambele căi corect. ──
  const displayedValue = spin2?.value ?? spin1?.value;
  const showConfetti = phase === "final" && displayedValue === 100;
  const confettiPieces = useConfettiPieces(showConfetti);

  return (
    <div style={s.wrap}>
      <style>{`
        @keyframes rouletteGlowPulse { 0%,100% { box-shadow: 0 0 30px -4px rgba(212,175,55,0.45); } 50% { box-shadow: 0 0 55px -2px rgba(212,175,55,0.8); } }
        @keyframes rouletteLightChase { 0% { opacity: 0.3; } 50% { opacity: 1; } 100% { opacity: 0.3; } }
        @keyframes rouletteConfettiFall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(340px) translateX(var(--drift)) rotate(var(--rot)); opacity: 0; }
        }
      `}</style>

      {showConfetti && (
        <div style={s.confettiLayer}>
          {confettiPieces.map((p) => (
            <div
              key={p.id}
              style={{
                position: "absolute", top: 0, left: `${p.left}%`, width: 7, height: 11, borderRadius: 2,
                background: p.color, "--drift": `${p.drift}px`, "--rot": `${p.rotate}deg`,
                animation: `rouletteConfettiFall ${p.duration}s ease-in ${p.delay}s forwards`,
              }}
            />
          ))}
        </div>
      )}

      <div style={s.wheelArea}>
        <div style={s.pointer}>▼</div>
        <div style={s.outerRing}>
          {Array.from({ length: 24 }).map((_, i) => (
            <div
              key={i}
              style={{
                ...s.ringDot,
                transform: `rotate(${i * 15}deg) translateY(-118px)`,
                animation: `rouletteLightChase 1.6s ease-in-out ${(i % 6) * 0.12}s infinite`,
              }}
            />
          ))}
        </div>
        <div
          style={{
            ...s.wheel,
            ...((phase === "decide" || phase === "final") ? { animation: "rouletteGlowPulse 2.2s ease-in-out infinite" } : {}),
            background: `conic-gradient(${WHEEL_ORDER.map((v, i) => `${SEGMENT_COLOR[v]} ${i * SEGMENT_ANGLE}deg ${(i + 1) * SEGMENT_ANGLE}deg`).join(", ")})`,
            transform: `rotate(${rotation}deg)`,
            transition: (phase === "spinning" || phase === "settling") ? transitionSpec : "none",
          }}
        >
          <div style={s.glossOverlay} />
          {WHEEL_ORDER.map((v, i) => (
            <div
              key={i}
              style={{
                ...s.segmentLabel,
                transform: `rotate(${i * SEGMENT_ANGLE + SEGMENT_ANGLE / 2}deg) translateY(-100px)`,
              }}
            >
              <span style={s.segmentIcon}>{SEGMENT_ICON[v]}</span>
              <span style={s.segmentVal}>{v}</span>
            </div>
          ))}
        </div>
        <div style={s.centerHub}>🎰</div>
      </div>

      {phase === "ready" && !deadlinePassed && (
        <div style={s.intensityRow}>
          <div style={s.intensityHint}>Alege cât de tare învârți:</div>
          <div style={s.intensityBtns}>
            {Object.values(INTENSITY).map((it) => (
              <button key={it.key} type="button" style={s.intensityBtn} onClick={() => handleSpin(1, it.key)}>
                {it.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {phase === "ready" && deadlinePassed && (
        <div style={s.expiredNote}>Timpul pentru Ruletă a expirat — 0p</div>
      )}

      {(phase === "spinning" || phase === "settling") && <div style={s.spinningNote}>Se învârte…</div>}

      {(phase === "decide" || phase === "final") && displayedValue != null && (
        <div style={s.resultBox}>
          <div style={s.resultLabel}>{phase === "final" ? "REZULTAT FINAL" : "Rezultatul tău"}</div>
          <div style={s.resultValue}>{displayedValue}p</div>
          <div style={s.resultMsg}>{resultMessage(displayedValue)}</div>
        </div>
      )}

      {phase === "decide" && !deadlinePassed && (
        <div style={s.decideRow}>
          <button type="button" style={s.keepBtn} onClick={() => setPhase("final")}>✋ Păstrează {spin1?.value}p</button>
          <button type="button" style={s.rerollBtn} onClick={() => setConfirming(true)}>🎰 Mai învârt o dată</button>
        </div>
      )}

      {confirming && (
        <div style={s.confirmOverlay} onClick={() => setConfirming(false)}>
          <div style={s.confirmBox} onClick={(e) => e.stopPropagation()}>
            <div style={s.confirmTitle}>Sigur?</div>
            <div style={s.confirmBody}>
              Prima ta recompensă de <b>{spin1?.value}p</b> va fi pierdută definitiv.
              A doua rotire devine rezultatul final, chiar dacă e mai mică.
            </div>
            <button type="button" style={s.confirmDangerBtn} onClick={() => { setConfirming(false); handleSpin(2, "normal"); }}>
              🎰 DA, RISC
            </button>
            <button type="button" style={s.confirmCancelBtn} onClick={() => setConfirming(false)}>Renunță</button>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  wrap: {
    background: "radial-gradient(ellipse at 50% 15%, rgba(212,175,55,0.09), transparent 55%), linear-gradient(180deg, rgba(212,175,55,0.06) 0%, rgba(18,20,28,0.95) 45%, rgba(10,11,16,0.98) 100%)",
    border: "1px solid rgba(212,175,55,0.32)", borderRadius: radius.lg, padding: "22px 16px",
    display: "flex", flexDirection: "column", alignItems: "center", position: "relative", overflow: "hidden",
  },
  confettiLayer: { position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 10 },
  wheelArea: { position: "relative", width: 260, height: 260, marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "center" },
  pointer: { position: "absolute", top: 2, left: "50%", transform: "translateX(-50%)", fontSize: 26, color: "#D4AF37", zIndex: 3, filter: "drop-shadow(0 0 8px rgba(212,175,55,1))" },
  outerRing: { position: "absolute", top: "50%", left: "50%", width: 0, height: 0 },
  ringDot: {
    position: "absolute", top: 0, left: 0, width: 5, height: 5, marginLeft: -2.5, marginTop: -2.5,
    borderRadius: "50%", background: "#D4AF37", boxShadow: "0 0 6px 1px rgba(212,175,55,0.8)",
  },
  wheel: {
    position: "relative", width: 216, height: 216, borderRadius: "50%",
    border: "5px solid rgba(212,175,55,0.6)", boxShadow: "0 0 34px -4px rgba(212,175,55,0.45), inset 0 3px 8px rgba(0,0,0,0.5), inset 0 0 0 3px rgba(255,246,217,0.18)",
    zIndex: 1,
  },
  glossOverlay: {
    position: "absolute", inset: 0, borderRadius: "50%", pointerEvents: "none",
    background: "linear-gradient(160deg, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0.03) 35%, transparent 55%)",
  },
  centerHub: {
    position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 2,
    width: 50, height: 50, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
    background: "radial-gradient(circle at 35% 30%, #3A2E10, #12141C 70%)", border: "3px solid rgba(212,175,55,0.75)",
    fontSize: 20, boxShadow: "0 0 18px -2px rgba(212,175,55,0.7), inset 0 2px 4px rgba(255,255,255,0.15)",
  },
  segmentLabel: {
    position: "absolute", top: "50%", left: "50%", width: 30, height: 30, marginLeft: -15, marginTop: -15,
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 0,
    transformOrigin: "15px 15px",
  },
  segmentIcon: { fontSize: 13, lineHeight: 1, filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.6))" },
  segmentVal: { fontSize: 9.5, fontWeight: 800, color: "#fff", fontFamily: font.body, textShadow: "0 1px 2px rgba(0,0,0,0.7)", lineHeight: 1.2 },

  intensityRow: { width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 },
  intensityHint: { fontSize: 11, color: color.textFaint, fontFamily: font.body },
  intensityBtns: { display: "flex", gap: 8, width: "100%" },
  intensityBtn: {
    flex: 1, background: "linear-gradient(180deg, #FFF6D9, #E8C766 40%, #D4AF37 75%, #A9852A)",
    border: "none", borderRadius: 999, padding: "13px 6px", fontSize: 12.5, fontWeight: 800, color: "#241B04",
    cursor: "pointer", fontFamily: font.body, boxShadow: "0 4px 0 #6B5216, 0 8px 16px -6px rgba(212,175,55,0.6)",
    whiteSpace: "nowrap",
  },
  spinningNote: { fontSize: 12, color: color.textFaint, fontFamily: font.body },
  expiredNote: { fontSize: 12, color: "#F0555A", fontFamily: font.body, fontWeight: 700 },

  resultBox: { textAlign: "center", marginTop: 4 },
  resultLabel: { fontSize: 10.5, fontWeight: 800, letterSpacing: "0.05em", color: color.textFaint, fontFamily: font.body },
  resultValue: { fontFamily: font.display, fontSize: 34, fontWeight: 800, color: color.goldLight, marginTop: 2, textShadow: "0 0 16px rgba(212,175,55,0.5)" },
  resultMsg: { fontSize: 12.5, color: color.textSecondary, fontFamily: font.body, marginTop: 4, fontStyle: "italic" },

  decideRow: { display: "flex", gap: 10, marginTop: 16, width: "100%" },
  keepBtn: {
    flex: 1, background: "rgba(139,217,87,0.12)", border: "1px solid rgba(139,217,87,0.4)", color: "#8BD957",
    borderRadius: radius.sm, padding: "12px 0", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: font.body,
  },
  rerollBtn: {
    flex: 1, background: "rgba(240,85,90,0.1)", border: "1px solid rgba(240,85,90,0.4)", color: "#F0555A",
    borderRadius: radius.sm, padding: "12px 0", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: font.body,
  },

  confirmOverlay: { position: "fixed", inset: 0, background: "rgba(5,7,14,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 24 },
  confirmBox: { background: color.surfaceInset, border: "1px solid rgba(240,85,90,0.4)", borderRadius: radius.lg, padding: 24, maxWidth: 320, textAlign: "center" },
  confirmTitle: { fontFamily: font.display, fontSize: 17, fontWeight: 800, color: "#F0555A", marginBottom: 10 },
  confirmBody: { fontSize: 12.5, color: color.textSecondary, fontFamily: font.body, lineHeight: 1.5, marginBottom: 18 },
  confirmDangerBtn: {
    width: "100%", background: "#F0555A", border: "none", borderRadius: radius.sm, padding: "12px 0",
    fontSize: 13, fontWeight: 800, color: "#fff", cursor: "pointer", fontFamily: font.body, marginBottom: 8,
  },
  confirmCancelBtn: {
    width: "100%", background: "none", border: "none", padding: "8px 0",
    fontSize: 12, fontWeight: 700, color: color.textFaint, cursor: "pointer", fontFamily: font.body,
  },
};
