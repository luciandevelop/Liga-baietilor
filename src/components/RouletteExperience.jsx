import { useEffect, useRef, useState } from "react";
import { getRouletteSpin, submitRouletteSpin, ROULETTE_SEGMENTS } from "../services/surprisesService";
import { color, font, radius } from "../matchdayTheme";

// Ordine vizuală pe roată — REARANJATĂ față de ROULETTE_SEGMENTS brut,
// ca valorile identice să nu fie lipite una de alta (cerut explicit).
// Aceleași 16 valori, doar ordinea de afișare diferă.
const WHEEL_ORDER = [0, 25, 50, 75, 0, 25, 50, 100, 0, 25, 50, 75, 0, 25, 50, 25];
const SEGMENT_ANGLE = 360 / WHEEL_ORDER.length;
const SEGMENT_COLOR = { 0: "#3A3F4B", 25: "#8A6A3A", 50: "#3A6E8A", 75: "#6B3A8A", 100: "#D4AF37" };

function angleForValue(value) {
  // Primul segment din ordinea vizuală care are valoarea căutată —
  // determinist (același număr => aceeași poziție pe roată mereu).
  const idx = WHEEL_ORDER.findIndex((v) => v === value);
  return idx * SEGMENT_ANGLE + SEGMENT_ANGLE / 2;
}

export default function RouletteExperience({ gameweekId, uid, deadlinePassed, onResolvedChange }) {
  const [spin1, setSpin1] = useState(undefined); // undefined = se încarcă, null = nu există încă
  const [spin2, setSpin2] = useState(undefined);
  const [phase, setPhase] = useState("loading"); // loading | ready | spinning | decide | confirmReroll | rerolling | final
  const [rotation, setRotation] = useState(0);
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
    // +N ture complete, pentru senzația de învârtire, chiar la încărcare
    // din refresh (fără ture, doar poziția finală, dacă nu e prima animație).
    return -angleForValue(value);
  }

  async function handleSpin(spinNumber) {
    setPhase("spinning");
    const value = await submitRouletteSpin(gameweekId, uid, spinNumber);
    const targetAngle = angleForValueToRotation(value);
    const spins = 5; // ture complete, doar cosmetic
    setRotation((prev) => prev - spins * 360 + ((targetAngle - prev) % 360));
    setTimeout(() => {
      setRotation(targetAngle - spins * 360);
      const data = { uid, value, spinNumber };
      if (spinNumber === 1) { setSpin1(data); setPhase("decide"); }
      else { setSpin2(data); setPhase("final"); onResolvedChange?.(); }
    }, 3200);
  }

  const displayedValue = phase === "final" ? spin2?.value : spin1?.value;

  return (
    <div style={s.wrap}>
      <style>{`
        @keyframes rouletteGlowPulse { 0%,100% { box-shadow: 0 0 30px -4px rgba(212,175,55,0.4); } 50% { box-shadow: 0 0 50px -2px rgba(212,175,55,0.7); } }
        @keyframes rouletteLightChase { 0% { opacity: 0.3; } 50% { opacity: 1; } 100% { opacity: 0.3; } }
      `}</style>
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
            transition: phase === "spinning" ? "transform 3.2s cubic-bezier(0.15, 0.75, 0.25, 1)" : "none",
          }}
        >
          <div style={s.glossOverlay} />
          {WHEEL_ORDER.map((v, i) => (
            <div
              key={i}
              style={{
                ...s.segmentLabel,
                transform: `rotate(${i * SEGMENT_ANGLE + SEGMENT_ANGLE / 2}deg) translateY(-102px)`,
              }}
            >
              {v}
            </div>
          ))}
        </div>
        <div style={s.centerHub}>🎰</div>
      </div>

      {phase === "ready" && !deadlinePassed && (
        <button type="button" style={s.spinBtn} onClick={() => handleSpin(1)}>🎰 Învârte roata</button>
      )}
      {phase === "ready" && deadlinePassed && (
        <div style={s.expiredNote}>Timpul pentru Ruletă a expirat — 0p</div>
      )}

      {phase === "spinning" && <div style={s.spinningNote}>Se învârte…</div>}

      {(phase === "decide" || phase === "final") && displayedValue != null && (
        <div style={s.resultBox}>
          <div style={s.resultLabel}>{phase === "final" ? "REZULTAT FINAL" : "Rezultatul tău"}</div>
          <div style={s.resultValue}>{displayedValue}p</div>
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
            <button type="button" style={s.confirmDangerBtn} onClick={() => { setConfirming(false); handleSpin(2); }}>
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
    background: "linear-gradient(180deg, rgba(212,175,55,0.06) 0%, rgba(18,20,28,0.95) 45%, rgba(10,11,16,0.98) 100%)",
    border: "1px solid rgba(212,175,55,0.3)", borderRadius: radius.lg, padding: "20px 16px",
    display: "flex", flexDirection: "column", alignItems: "center",
  },
  wheelArea: { position: "relative", width: 260, height: 260, marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "center" },
  pointer: { position: "absolute", top: 4, left: "50%", transform: "translateX(-50%)", fontSize: 24, color: "#D4AF37", zIndex: 3, filter: "drop-shadow(0 0 6px rgba(212,175,55,0.9))" },
  outerRing: { position: "absolute", top: "50%", left: "50%", width: 0, height: 0 },
  ringDot: {
    position: "absolute", top: 0, left: 0, width: 5, height: 5, marginLeft: -2.5, marginTop: -2.5,
    borderRadius: "50%", background: "#D4AF37", boxShadow: "0 0 6px 1px rgba(212,175,55,0.8)",
  },
  wheel: {
    position: "relative", width: 216, height: 216, borderRadius: "50%",
    border: "4px solid rgba(212,175,55,0.55)", boxShadow: "0 0 30px -4px rgba(212,175,55,0.4), inset 0 2px 6px rgba(0,0,0,0.4)",
    zIndex: 1,
  },
  glossOverlay: {
    position: "absolute", inset: 0, borderRadius: "50%", pointerEvents: "none",
    background: "linear-gradient(160deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.02) 35%, transparent 55%)",
  },
  centerHub: {
    position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 2,
    width: 46, height: 46, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
    background: "radial-gradient(circle, #2A2110, #12141C)", border: "2px solid rgba(212,175,55,0.6)",
    fontSize: 18, boxShadow: "0 0 14px -2px rgba(212,175,55,0.6)",
  },
  segmentLabel: {
    position: "absolute", top: "50%", left: "50%", width: 24, height: 24, marginLeft: -12, marginTop: -12,
    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 800, color: "#fff", fontFamily: font.body,
    transformOrigin: "12px 12px",
  },
  spinBtn: {
    background: "linear-gradient(180deg, #F0D875, #C9A227)", border: "none", borderRadius: 999,
    padding: "14px 32px", fontSize: 14, fontWeight: 800, color: "#1A1200", cursor: "pointer", fontFamily: font.body,
    boxShadow: "0 4px 16px -4px rgba(212,175,55,0.6)",
  },
  spinningNote: { fontSize: 12, color: color.textFaint, fontFamily: font.body },
  expiredNote: { fontSize: 12, color: "#F0555A", fontFamily: font.body, fontWeight: 700 },

  resultBox: { textAlign: "center", marginTop: 4 },
  resultLabel: { fontSize: 10.5, fontWeight: 800, letterSpacing: "0.05em", color: color.textFaint, fontFamily: font.body },
  resultValue: { fontFamily: font.display, fontSize: 34, fontWeight: 800, color: color.goldLight, marginTop: 2 },

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
