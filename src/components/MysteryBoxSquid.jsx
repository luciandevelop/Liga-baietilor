import { useEffect, useRef, useState } from "react";

// ══════════════════════════════════════════════════════════════════
// 🦑 Mystery Box — tema SQUID GAME (doar GRAFICĂ și SUNET).
// Jocul, valorile, regulile și punctajul rămân EXACT cele din
// MysteryBoxExperience. Aici sunt doar piesele vizuale:
//   • SquidHall      — holul cu neon ○△□ și gardienii de pe margini
//   • SquidBox       — cutia neagră cu fundă roz (sau deschisă / sigilată)
//   • SquidReveal    — deschiderea cutiei (funda, capacul, ce iese)
//   • squidAudio     — cutia muzicală + efecte (fără fișiere, sintetizate)
// ══════════════════════════════════════════════════════════════════

export const SQ = { pink: "#ff2d7a", pinkSoft: "rgba(255,45,122,.35)", teal: "#22d3c5", gold: "#F5C451", ink: "#f4eef2", dim: "#9a8f98", bg: "#0b0710" };
export const pad3 = (n) => String(n).padStart(3, "0");
const SYMBOLS = ["○", "△", "□"];
export const symbolFor = (idx) => SYMBOLS[idx % 3];

// Ce iese din cutie, după valoare (aceleași valori ca jocul clasic).
export function squidPrize(value, jokerSentinel) {
  if (value === jokerSentinel) return { icon: "🎭", title: "MASCA LEADER-ULUI", sub: "Joker Extra", col: SQ.gold };
  if (value >= 100) return { icon: "💳", title: "CARDUL VIP", sub: `${value} PCT`, col: SQ.gold };
  if (value >= 75) return { icon: "💰", title: "SACUL CU BANI", sub: `${value} PCT`, col: "#c79ef0" };
  if (value >= 50) return { icon: "💵", title: "UN TEANC DE BANCNOTE", sub: `${value} PCT`, col: "#7fd0ff" };
  if (value > 0) return { icon: "🪙", title: "CÂTEVA MONEDE", sub: `${value} PCT`, col: "#d8b878" };
  return { icon: "card", title: "CARTEA DE VIZITĂ", sub: "0 PCT · „Mai vrei să joci?”", col: SQ.dim };
}

// ── Sunet: sintetizat cu Web Audio (fără fișiere, fără drepturi de autor) ──
function makeAudio() {
  let ctx = null, master = null, musicTimer = null, on = false;
  const ensure = () => {
    if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ctx = new C(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination); }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  };
  const bell = (f, t, d = 0.9, v = 0.18) => {
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o2.type = "sine"; o.frequency.value = f; o2.frequency.value = f * 2.01;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); o2.connect(g); g.connect(master); o.start(t); o2.start(t); o.stop(t + d + 0.05); o2.stop(t + d + 0.05);
  };
  // melodie originală de cutie muzicală (valț lent, minor), în buclă
  const TUNE = [[76, 1], [79, 1], [83, 1], [81, 2], [79, 1], [76, 1], [74, 1], [76, 2], [71, 1], [72, 1], [74, 1], [76, 1], [72, 1], [69, 3]];
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function playTune() {
    if (!on || !ensure()) return;
    let t = ctx.currentTime + 0.05; const beat = 0.34;
    TUNE.forEach(([m, d]) => { bell(hz(m), t, 0.8 + d * 0.2, 0.12); if (d >= 2) bell(hz(m - 12), t, 1.2, 0.06); t += d * beat; });
    musicTimer = setTimeout(playTune, (t - ctx.currentTime) * 1000 + 600);
  }
  const noise = (t, d, f, v) => {
    const len = Math.floor(ctx.sampleRate * d), b = ctx.createBuffer(1, len, ctx.sampleRate), ch = b.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = b; fl.type = "bandpass"; fl.frequency.value = f; g.gain.value = v; s.connect(fl); fl.connect(g); g.connect(master); s.start(t);
  };
  return {
    setOn(v) { on = v; clearTimeout(musicTimer); if (v) playTune(); },
    isOn: () => on,
    ribbon() { if (!on || !ensure()) return; noise(ctx.currentTime, 0.35, 2400, 0.35); },
    lid() { if (!on || !ensure()) return; const t = ctx.currentTime; const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "triangle"; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.25); g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.32); },
    win(big) { if (!on || !ensure()) return; const t = ctx.currentTime; const notes = big ? [72, 76, 79, 84, 88] : [72, 76, 79]; notes.forEach((m, i) => bell(hz(m), t + i * 0.09, 0.7, 0.16)); if (big) for (let i = 0; i < 10; i++) bell(hz(96 + (i % 4)), t + 0.4 + i * 0.05, 0.25, 0.05); },
    lose() { if (!on || !ensure()) return; const t = ctx.currentTime; [0, 0.18].forEach((d) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "square"; o.frequency.value = 880; g.gain.setValueAtTime(0.08, t + d); g.gain.setValueAtTime(0.0001, t + d + 0.1); o.connect(g); g.connect(master); o.start(t + d); o.stop(t + d + 0.12); }); },
    stop() { on = false; clearTimeout(musicTimer); },
  };
}
export function useSquidAudio() {
  const ref = useRef(null);
  if (!ref.current) ref.current = makeAudio();
  const [on, setOn] = useState(false);
  useEffect(() => () => ref.current.stop(), []);
  return { audio: ref.current, on, toggle: () => { const v = !on; setOn(v); ref.current.setOn(v); } };
}

// ── Gardian (SVG): salopetă roz, glugă, mască neagră cu simbol ──
export function Guard({ symbol = "○", size = 64, flip = false, style }) {
  return (
    <svg viewBox="0 0 60 110" width={size} height={size * 110 / 60} style={{ transform: flip ? "scaleX(-1)" : undefined, ...style }} aria-hidden>
      <defs>
        <linearGradient id="gsuit" x1="0" x2="1"><stop offset="0" stopColor="#b3134f" /><stop offset=".5" stopColor="#e2246a" /><stop offset="1" stopColor="#9c0f45" /></linearGradient>
      </defs>
      <ellipse cx="30" cy="106" rx="18" ry="3" fill="rgba(0,0,0,.5)" />
      <path d="M17 50 Q14 80 18 104 L27 104 L30 74 L33 104 L42 104 Q46 80 43 50 Z" fill="url(#gsuit)" />
      <path d="M12 34 Q30 22 48 34 L46 60 Q30 66 14 60 Z" fill="url(#gsuit)" />
      <path d="M12 36 Q8 56 11 72 L16 72 L18 42 Z" fill="#c11a59" /><path d="M48 36 Q52 56 49 72 L44 72 L42 42 Z" fill="#c11a59" />
      <rect x="22" y="52" width="16" height="3" fill="#1a1a1a" />
      <path d="M17 22 Q17 4 30 4 Q43 4 43 22 Q43 34 30 36 Q17 34 17 22 Z" fill="#d81f62" />
      <ellipse cx="30" cy="21" rx="10" ry="12" fill="#0d0d0f" />
      {symbol === "○" && <circle cx="30" cy="21" r="5.2" fill="none" stroke="#fff" strokeWidth="1.8" />}
      {symbol === "△" && <path d="M30 14 L36.5 26 L23.5 26 Z" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />}
      {symbol === "□" && <rect x="24.5" y="15.5" width="11" height="11" fill="none" stroke="#fff" strokeWidth="1.8" />}
    </svg>
  );
}

// ── Holul de sus: neon ○△□, gardieni, titlul ediției ──
export function SquidHall({ onToggleSound, soundOn }) {
  return (
    <div style={st.hall}>
      <div style={st.neonRow}>
        <span style={{ ...st.neon, animation: "sqFlick 3.2s infinite" }}>○</span>
        <span style={{ ...st.neon, animation: "sqFlick 2.6s .4s infinite" }}>△</span>
        <span style={{ ...st.neon, animation: "sqFlick 3.6s .9s infinite" }}>□</span>
      </div>
      <Guard symbol="△" size={46} style={{ position: "absolute", left: 6, bottom: 4, animation: "sqBreath 3.4s ease-in-out infinite" }} />
      <Guard symbol="○" size={52} style={{ position: "absolute", left: 40, bottom: 0, opacity: 0.85, animation: "sqBreath 3.8s .6s ease-in-out infinite" }} />
      <Guard symbol="□" size={46} flip style={{ position: "absolute", right: 6, bottom: 4, animation: "sqBreath 3.6s .3s ease-in-out infinite" }} />
      <Guard symbol="○" size={52} flip style={{ position: "absolute", right: 40, bottom: 0, opacity: 0.85, animation: "sqBreath 3.2s 1s ease-in-out infinite" }} />
      <div style={st.hallTitle}>
        <div style={st.hallKicker}>🎁 MYSTERY BOX</div>
        <div style={st.hallName}>EDIȚIA SQUID GAME</div>
      </div>
      <button type="button" style={st.sound} onClick={onToggleSound}>{soundOn ? "🔊" : "🔇"}</button>
    </div>
  );
}

// ── Fața unei cutii din grilă ──
export function SquidBox({ idx, state, prize, label, ownerName, mine, refused, finalPick, clickable, onClick }) {
  // state: "closed" | "opened" | "revealed"
  const opened = state !== "closed";
  return (
    <button type="button" disabled={!clickable} onClick={onClick}
      style={{ ...st.box, ...(opened ? st.boxOpen : {}), ...(mine ? st.boxMine : {}), ...(refused ? st.boxRefused : {}),
        ...(clickable ? { animation: "sqIdle 2.6s ease-in-out infinite", cursor: "pointer" } : { cursor: "default" }) }}>
      <span style={st.boxNum}>{pad3(idx + 1)}</span>
      {!opened && (
        <>
          <span style={st.ribbonV} /><span style={st.ribbonH} />
          <span style={st.bow}>🎀</span>
          <span style={st.boxSym}>{symbolFor(idx)}</span>
        </>
      )}
      {opened && (
        <>
          <span style={{ fontSize: 17, lineHeight: 1, filter: refused ? "grayscale(1)" : undefined }}>{prize.icon === "card" ? <MiniCard /> : prize.icon}</span>
          {ownerName && <span style={st.boxOwner}>{ownerName}</span>}
          <span style={{ ...st.boxVal, color: prize.col, ...(refused ? { textDecoration: "line-through", color: "#7d6a70" } : {}) }}>{label}</span>
        </>
      )}
      {refused && <span style={st.tape}>SIGILATĂ</span>}
      {finalPick && <span style={st.finalTag}>FINALĂ</span>}
    </button>
  );
}

function MiniCard() {
  return (
    <svg viewBox="0 0 40 24" width="30" height="18" aria-hidden><rect x="1" y="1" width="38" height="22" rx="2" fill="#c9a77a" stroke="#8a6e48" />
      <circle cx="11" cy="12" r="4" fill="none" stroke="#2a2a2a" strokeWidth="1.4" /><path d="M20 8 L24 16 L16 16 Z" fill="none" stroke="#2a2a2a" strokeWidth="1.4" /><rect x="27" y="8" width="7" height="8" fill="none" stroke="#2a2a2a" strokeWidth="1.4" /></svg>
  );
}

// ── Deschiderea cutiei (după confirmare): funda, capacul, lumina, premiul ──
export function SquidReveal({ idx, prize, message, big, onClose, audio }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = [
      setTimeout(() => { setStep(1); audio?.ribbon(); }, 350),
      setTimeout(() => { setStep(2); audio?.lid(); }, 1200),
      setTimeout(() => { setStep(3); prize.icon === "card" ? audio?.lose() : audio?.win(big); }, 1700),
    ];
    return () => t.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div style={st.overlay} onClick={() => step >= 3 && onClose()}>
      <div style={st.revealCard} onClick={(e) => e.stopPropagation()}>
        <Guard symbol={symbolFor(idx)} size={40} style={{ position: "absolute", left: 8, top: 10, opacity: 0.9 }} />
        <Guard symbol={symbolFor(idx + 1)} size={40} flip style={{ position: "absolute", right: 8, top: 10, opacity: 0.9 }} />
        <div style={st.revealNum}>CUTIA {pad3(idx + 1)}</div>
        <div style={st.stage}>
          {step >= 2 && <div style={{ ...st.glow, background: `radial-gradient(circle, ${prize.icon === "card" ? "rgba(160,150,150,.35)" : "rgba(255,214,120,.55)"}, transparent 65%)`, animation: "sqGlow .8s ease-out both" }} />}
          <div style={{ ...st.bigBox, ...(step >= 2 ? { transform: "translateY(18px) scale(.92)" } : {}) }}>
            <span style={{ ...st.bigRibbonV, opacity: step >= 1 ? 0 : 1 }} />
            <span style={{ ...st.bigRibbonH, opacity: step >= 1 ? 0 : 1 }} />
          </div>
          <div style={{ ...st.lid, ...(step >= 2 ? { transform: "translate(40px,-70px) rotate(28deg)", opacity: 0 } : {}) }}>
            <span style={{ ...st.bigBow, ...(step >= 1 ? { transform: "scale(0) rotate(90deg)", opacity: 0 } : {}) }}>🎀</span>
          </div>
          {step >= 3 && (
            <div style={st.prize}>
              <div style={{ fontSize: 54, lineHeight: 1, animation: "sqPop .5s cubic-bezier(.2,1.6,.4,1) both" }}>{prize.icon === "card" ? <BigCard /> : prize.icon}</div>
              {big && <div style={st.rain}>{Array.from({ length: 14 }, (_, i) => <span key={i} style={{ ...st.drop, left: `${(i * 7) % 100}%`, animationDelay: `${(i % 7) * 0.12}s` }}>💵</span>)}</div>}
            </div>
          )}
        </div>
        {step >= 3 ? (
          <div style={{ animation: "sqPop .4s both" }}>
            <div style={{ ...st.prizeTitle, color: prize.col }}>{prize.title}</div>
            <div style={st.prizeSub}>{prize.sub}</div>
            {message && <div style={st.msg}>{message}</div>}
            <button type="button" style={st.okBtn} onClick={onClose}>AM ÎNȚELES</button>
          </div>
        ) : (
          <div style={st.wait}>{step === 0 ? "Gardianul aduce cutia…" : step === 1 ? "Funda se desface…" : "Capacul se ridică…"}</div>
        )}
      </div>
    </div>
  );
}

function BigCard() {
  return (
    <svg viewBox="0 0 100 60" width="120" height="72" aria-hidden><rect x="2" y="2" width="96" height="56" rx="4" fill="#d6b88c" stroke="#8a6e48" strokeWidth="2" />
      <circle cx="26" cy="30" r="10" fill="none" stroke="#222" strokeWidth="3" /><path d="M50 19 L61 41 L39 41 Z" fill="none" stroke="#222" strokeWidth="3" strokeLinejoin="round" /><rect x="67" y="20" width="20" height="20" fill="none" stroke="#222" strokeWidth="3" /></svg>
  );
}

// ── Modalul de confirmare (înainte de deschidere), în stilul serialului ──
export function SquidConfirm({ idx, rerollFrom, submitting, onCancel, onConfirm }) {
  return (
    <div style={st.overlay} onClick={() => !submitting && onCancel()}>
      <div style={st.revealCard} onClick={(e) => e.stopPropagation()}>
        <Guard symbol={symbolFor(idx)} size={54} style={{ display: "block", margin: "0 auto 8px" }} />
        <div style={st.revealNum}>CUTIA {pad3(idx + 1)}</div>
        <div style={st.confirmText}>
          {rerollFrom == null ? "Alegi această cutie?" : `Arunci cutia cu ${rerollFrom} și o iei pe aceasta? Gardianul o sigilează pe cea veche. A doua cutie e DEFINITIVĂ.`}
        </div>
        <div style={st.confirmWarn}>Alegerea nu se mai poate anula.</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" style={st.cancelBtn} disabled={submitting} onClick={onCancel}>Înapoi</button>
          <button type="button" style={st.okBtn} disabled={submitting} onClick={onConfirm}>{submitting ? "…" : "DESCHIDE"}</button>
        </div>
      </div>
    </div>
  );
}

export const SQUID_KEYFRAMES = `
  @keyframes sqFlick { 0%,100%{opacity:1} 45%{opacity:.55} 48%{opacity:1} 70%{opacity:.8} }
  @keyframes sqBreath { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-1.5px)} }
  @keyframes sqIdle { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-2px)} }
  @keyframes sqGlow { 0%{opacity:0;transform:scale(.4)} 100%{opacity:1;transform:scale(1)} }
  @keyframes sqPop { 0%{opacity:0;transform:scale(.5)} 100%{opacity:1;transform:scale(1)} }
  @keyframes sqRain { 0%{transform:translateY(-30px) rotate(0);opacity:0} 15%{opacity:1} 100%{transform:translateY(150px) rotate(40deg);opacity:0} }
`;

const st = {
  hall: { position: "relative", height: 132, borderRadius: 14, overflow: "hidden", marginBottom: 12,
    background: "radial-gradient(ellipse at 50% 0%, rgba(255,45,122,.22), transparent 60%), linear-gradient(180deg, #1a0a14 0%, #0b0710 100%)",
    border: `1px solid ${SQ.pinkSoft}` },
  neonRow: { position: "absolute", top: 10, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 18 },
  neon: { fontSize: 30, color: SQ.pink, textShadow: `0 0 10px ${SQ.pink}, 0 0 24px rgba(255,45,122,.6)`, fontWeight: 300, lineHeight: 1 },
  hallTitle: { position: "absolute", left: 0, right: 0, bottom: 14, textAlign: "center" },
  hallKicker: { fontSize: 11, fontWeight: 800, letterSpacing: ".14em", color: SQ.dim },
  hallName: { fontSize: 19, fontWeight: 800, letterSpacing: ".08em", color: SQ.ink, textShadow: `0 0 14px ${SQ.pink}`, fontFamily: "Oswald, 'Arial Narrow', sans-serif" },
  sound: { position: "absolute", top: 8, right: 8, width: 32, height: 32, borderRadius: 16, border: `1px solid ${SQ.pinkSoft}`, background: "rgba(0,0,0,.45)", color: "#fff", fontSize: 14, zIndex: 2 },
  box: { position: "relative", aspectRatio: "1 / 1", borderRadius: 7, overflow: "hidden", minWidth: 0, padding: 3,
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1,
    background: "linear-gradient(150deg, #2a2a30 0%, #0d0d10 55%, #050506 100%)", border: "1px solid #2c2c33", boxShadow: "inset 0 1px 0 rgba(255,255,255,.08)" },
  boxOpen: { background: "linear-gradient(160deg, rgba(255,45,122,.10), rgba(0,0,0,.6))", border: `1px solid ${SQ.pinkSoft}` },
  boxMine: { outline: `1.5px solid ${SQ.teal}`, outlineOffset: "-1.5px" },
  boxRefused: { opacity: 0.6, border: "1px solid rgba(240,85,90,.35)" },
  boxNum: { position: "absolute", top: 2, left: 3, fontSize: 7.5, fontWeight: 800, color: "rgba(255,255,255,.55)", letterSpacing: ".04em", zIndex: 2 },
  ribbonV: { position: "absolute", top: 0, bottom: 0, left: "50%", width: 5, marginLeft: -2.5, background: `linear-gradient(90deg, #c2185b, ${SQ.pink}, #c2185b)` },
  ribbonH: { position: "absolute", left: 0, right: 0, top: "50%", height: 5, marginTop: -2.5, background: `linear-gradient(180deg, #c2185b, ${SQ.pink}, #c2185b)` },
  bow: { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-62%)", fontSize: 15, filter: "drop-shadow(0 1px 1px rgba(0,0,0,.6))", zIndex: 1 },
  boxSym: { position: "absolute", bottom: 2, right: 4, fontSize: 9, color: "rgba(255,45,122,.75)" },
  boxOwner: { fontSize: 7.5, fontWeight: 700, color: SQ.ink, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  boxVal: { fontSize: 10.5, fontWeight: 900, fontFamily: "Oswald, 'Arial Narrow', sans-serif" },
  tape: { position: "absolute", left: -6, right: -6, top: "44%", transform: "rotate(-14deg)", background: "#111", color: "#f0555a", fontSize: 6.5, fontWeight: 900, letterSpacing: ".1em", textAlign: "center", padding: "1px 0", borderTop: "1px solid #f0555a", borderBottom: "1px solid #f0555a" },
  finalTag: { position: "absolute", bottom: 1, fontSize: 6.5, fontWeight: 900, color: SQ.teal, letterSpacing: ".06em" },
  overlay: { position: "fixed", inset: 0, background: "rgba(5,2,6,.82)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 18 },
  revealCard: { position: "relative", width: "100%", maxWidth: 340, borderRadius: 16, padding: "22px 18px 18px", textAlign: "center",
    background: "radial-gradient(ellipse at 50% 0%, rgba(255,45,122,.25), transparent 60%), linear-gradient(180deg, #1c0b16, #0b0710)", border: `1px solid ${SQ.pinkSoft}`, boxShadow: "0 0 40px -6px rgba(255,45,122,.45)", color: SQ.ink },
  revealNum: { fontSize: 12, fontWeight: 800, letterSpacing: ".18em", color: SQ.pink, marginBottom: 6 },
  stage: { position: "relative", height: 170, margin: "4px 0 10px" },
  glow: { position: "absolute", left: "50%", top: "52%", width: 220, height: 220, marginLeft: -110, marginTop: -110, borderRadius: "50%" },
  bigBox: { position: "absolute", left: "50%", bottom: 6, width: 110, height: 78, marginLeft: -55, borderRadius: 6, overflow: "hidden", transition: "transform .5s",
    background: "linear-gradient(150deg, #34343c 0%, #0f0f12 60%, #050506 100%)", border: "1px solid #3a3a42" },
  bigRibbonV: { position: "absolute", top: 0, bottom: 0, left: "50%", width: 12, marginLeft: -6, background: `linear-gradient(90deg,#c2185b,${SQ.pink},#c2185b)`, transition: "opacity .4s" },
  bigRibbonH: { position: "absolute", left: 0, right: 0, top: "50%", height: 12, marginTop: -6, background: `linear-gradient(180deg,#c2185b,${SQ.pink},#c2185b)`, transition: "opacity .4s" },
  lid: { position: "absolute", left: "50%", bottom: 80, width: 122, height: 22, marginLeft: -61, borderRadius: 5, transition: "transform .55s cubic-bezier(.3,1.4,.5,1), opacity .55s",
    background: "linear-gradient(180deg, #3c3c44, #121216)", border: "1px solid #44444c" },
  bigBow: { position: "absolute", left: "50%", top: -24, marginLeft: -18, fontSize: 36, transition: "transform .5s, opacity .5s", display: "inline-block" },
  prize: { position: "absolute", left: 0, right: 0, top: 18, display: "flex", justifyContent: "center" },
  rain: { position: "absolute", inset: "-30px 0 0 0", pointerEvents: "none" },
  drop: { position: "absolute", top: 0, fontSize: 16, animation: "sqRain 1.4s ease-in infinite" },
  prizeTitle: { fontSize: 18, fontWeight: 800, letterSpacing: ".06em", fontFamily: "Oswald, 'Arial Narrow', sans-serif" },
  prizeSub: { fontSize: 13, color: SQ.ink, marginTop: 2, fontWeight: 700 },
  msg: { fontSize: 12.5, color: "#cdbfc8", lineHeight: 1.5, margin: "10px 0 14px" },
  wait: { fontSize: 12.5, color: SQ.dim, height: 40, display: "flex", alignItems: "center", justifyContent: "center" },
  confirmText: { fontSize: 14, lineHeight: 1.45, margin: "6px 0 8px" },
  confirmWarn: { fontSize: 11, color: "#f0a0a5", marginBottom: 16 },
  okBtn: { flex: 1.4, minHeight: 44, width: "100%", borderRadius: 10, border: `1px solid ${SQ.pink}`, background: "rgba(255,45,122,.22)", color: "#fff", fontWeight: 800, letterSpacing: ".1em", fontSize: 13 },
  cancelBtn: { flex: 1, minHeight: 44, borderRadius: 10, border: "1px solid rgba(255,255,255,.15)", background: "rgba(255,255,255,.05)", color: "#cfc6cc", fontWeight: 700, fontSize: 13 },
};
