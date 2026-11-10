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
    heartbeat(n = 4) { if (!on || !ensure()) return; const t = ctx.currentTime; for (let i = 0; i < n; i++) { [0, 0.16].forEach((d, k) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine"; o.frequency.setValueAtTime(k ? 52 : 62, t + i * 0.62 + d); g.gain.setValueAtTime(0.0001, t + i * 0.62 + d); g.gain.exponentialRampToValueAtTime(k ? 0.35 : 0.5, t + i * 0.62 + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.62 + d + 0.18); o.connect(g); g.connect(master); o.start(t + i * 0.62 + d); o.stop(t + i * 0.62 + d + 0.2); }); } },
    drumroll(dur = 1.1) { if (!on || !ensure()) return; const t = ctx.currentTime; for (let i = 0; i < dur / 0.045; i++) noise(t + i * 0.045, 0.05, 900 + i * 6, 0.05 + i * 0.004); },
    burst() { if (!on || !ensure()) return; const t = ctx.currentTime; noise(t, 0.6, 3000, 0.4); const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sawtooth"; o.frequency.setValueAtTime(200, t); o.frequency.exponentialRampToValueAtTime(900, t + 0.35); g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.5); },
    alarm() { if (!on || !ensure()) return; const t = ctx.currentTime; for (let i = 0; i < 3; i++) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "square"; o.frequency.setValueAtTime(620, t + i * 0.42); o.frequency.linearRampToValueAtTime(420, t + i * 0.42 + 0.38); g.gain.setValueAtTime(0.07, t + i * 0.42); g.gain.setValueAtTime(0.0001, t + i * 0.42 + 0.38); o.connect(g); g.connect(master); o.start(t + i * 0.42); o.stop(t + i * 0.42 + 0.4); } },
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

// ── Holul: scările roz (Escher, ca în serial), reflectoare, ceață, Leader-ul în spate, gardienii ──
export function SquidHall({ onToggleSound, soundOn }) {
  return (
    <div style={st.hall}>
      <svg viewBox="0 0 390 170" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} aria-hidden>
        <defs>
          <linearGradient id="hWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2a0f22" /><stop offset="1" stopColor="#0b0710" /></linearGradient>
          <linearGradient id="hStair" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#ff6fae" /><stop offset="1" stopColor="#c2185b" /></linearGradient>
          <linearGradient id="hStairS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7a0f3c" /><stop offset="1" stopColor="#3a0720" /></linearGradient>
          <radialGradient id="hSpot" cx=".5" cy="0" r=".9"><stop offset="0" stopColor="rgba(255,230,240,.45)" /><stop offset="1" stopColor="rgba(255,230,240,0)" /></radialGradient>
        </defs>
        <rect width="390" height="170" fill="url(#hWall)" />
        {/* scări în zigzag, stânga și dreapta */}
        {[0, 1].map((side) => (
          <g key={side} transform={side ? "translate(390,0) scale(-1,1)" : undefined} opacity=".9">
            {Array.from({ length: 7 }, (_, i) => (
              <g key={i}>
                <rect x={8 + i * 16} y={150 - i * 14} width="34" height="7" fill="url(#hStair)" />
                <rect x={8 + i * 16} y={157 - i * 14} width="34" height="7" fill="url(#hStairS)" />
              </g>
            ))}
            <rect x="120" y="44" width="40" height="7" fill="url(#hStair)" /><rect x="120" y="51" width="40" height="5" fill="url(#hStairS)" />
          </g>
        ))}
        {/* balconul Leader-ului */}
        <rect x="160" y="18" width="70" height="40" rx="3" fill="rgba(20,10,18,.85)" stroke="rgba(255,45,122,.5)" />
        <g transform="translate(195,26)">
          <path d="M-9 30 Q-10 14 0 12 Q10 14 9 30 Z" fill="#050505" />
          <circle cx="0" cy="6" r="6.5" fill="#050505" />
          <path d="M-4 4 L4 4 L5 9 L-5 9 Z" fill="#2c2c30" />
        </g>
        {/* reflectoare */}
        <path d="M110 0 L60 170 L170 170 Z" fill="url(#hSpot)" style={{ animation: "sqSweepL 7s ease-in-out infinite", transformOrigin: "110px 0px" }} />
        <path d="M280 0 L220 170 L330 170 Z" fill="url(#hSpot)" style={{ animation: "sqSweepR 8s ease-in-out infinite", transformOrigin: "280px 0px" }} />
      </svg>
      <div style={st.fog} />
      <div style={st.neonRow}>
        <span style={{ ...st.neon, animation: "sqFlick 3.2s infinite" }}>○</span>
        <span style={{ ...st.neon, animation: "sqFlick 2.6s .4s infinite" }}>△</span>
        <span style={{ ...st.neon, animation: "sqFlick 3.6s .9s infinite" }}>□</span>
      </div>
      <Guard symbol="△" size={44} style={{ position: "absolute", left: 4, bottom: 6, animation: "sqBreath 3.4s ease-in-out infinite" }} />
      <Guard symbol="○" size={50} style={{ position: "absolute", left: 38, bottom: 2, animation: "sqBreath 3.8s .6s ease-in-out infinite" }} />
      <Guard symbol="□" size={44} flip style={{ position: "absolute", right: 4, bottom: 6, animation: "sqBreath 3.6s .3s ease-in-out infinite" }} />
      <Guard symbol="○" size={50} flip style={{ position: "absolute", right: 38, bottom: 2, animation: "sqBreath 3.2s 1s ease-in-out infinite" }} />
      <div style={st.hallTitle}>
        <div style={st.hallKicker}>🎁 MYSTERY BOX</div>
        <div style={st.hallName}>EDIȚIA SQUID GAME</div>
      </div>
      <button type="button" style={st.sound} onClick={onToggleSound}>{soundOn ? "🔊" : "🔇"}</button>
    </div>
  );
}

// ── Cutia din grilă: cub 3D (față + capac + lateral), lac negru, fundă roz, reflex care trece ──
export function SquidBox({ idx, state, prize, label, ownerName, mine, refused, finalPick, clickable, onClick }) {
  const opened = state !== "closed";
  return (
    <button type="button" disabled={!clickable} onClick={onClick}
      style={{ ...st.cell, animation: `sqDrop .5s ${Math.min(idx, 39) * 0.025}s both`, cursor: clickable ? "pointer" : "default" }}>
      <div style={{ ...st.cube, ...(clickable ? { animation: "sqIdle 3s ease-in-out infinite", animationDelay: `${(idx % 7) * 0.2}s` } : {}) }}>
        {/* capacul (văzut de sus) */}
        <div style={{ ...st.top, ...(opened ? st.topOpen : {}) }}>
          {!opened && <><span style={st.topRibV} /><span style={st.topRibH} /><span style={st.topBow}>🎀</span></>}
        </div>
        {/* fața */}
        <div style={{ ...st.front, ...(opened ? st.frontOpen : {}), ...(mine ? st.mine : {}), ...(refused ? st.refused : {}) }}>
          <span style={st.num}>{pad3(idx + 1)}</span>
          {!opened ? (
            <>
              <span style={st.ribV} />
              <span style={st.sym}>{symbolFor(idx)}</span>
              <span style={st.gloss} />
            </>
          ) : (
            <>
              <span style={{ fontSize: 15, lineHeight: 1, marginTop: 6, filter: refused ? "grayscale(1)" : `drop-shadow(0 0 6px ${prize.col}aa)` }}>{prize.icon === "card" ? <MiniCard /> : prize.icon}</span>
              {ownerName && <span style={st.owner}>{ownerName}</span>}
              <span style={{ ...st.val, color: prize.col, ...(refused ? { textDecoration: "line-through", color: "#7d6a70" } : {}) }}>{label}</span>
            </>
          )}
          {refused && <span style={st.tape}>SIGILATĂ</span>}
          {finalPick && <span style={st.finalTag}>FINALĂ</span>}
        </div>
        {/* lateral (adâncime) */}
        <div style={st.side} />
      </div>
    </button>
  );
}

// ── Particule (bancnote / monede / aur / scântei) pe canvas ──
function Particles({ kind, run }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!run) return undefined;
    const cv = ref.current; if (!cv) return undefined;
    const dpr = Math.min(window.devicePixelRatio || 1, 2), W = cv.clientWidth, H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr; const g = cv.getContext("2d"); g.scale(dpr, dpr);
    const N = kind === "jackpot" ? 90 : kind === "cash" ? 55 : kind === "coins" ? 30 : kind === "dust" ? 26 : 40;
    const ps = Array.from({ length: N }, () => ({
      x: W / 2 + (Math.random() - 0.5) * 40, y: H * 0.55, vx: (Math.random() - 0.5) * (kind === "dust" ? 1.2 : 9), vy: kind === "dust" ? 0.4 + Math.random() : -6 - Math.random() * 9,
      r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3, s: 0.7 + Math.random() * 0.6, life: 1,
      c: kind === "jackpot" ? (Math.random() < 0.5 ? "#F5C451" : "#2fbf6a") : kind === "cash" ? "#2fbf6a" : kind === "coins" ? "#e6c26b" : kind === "dust" ? "#9a8f98" : "#ff4fa0",
    }));
    let raf, t0 = performance.now();
    const draw = (now) => {
      const dt = Math.min(2, (now - t0) / 16.7); t0 = now; g.clearRect(0, 0, W, H);
      ps.forEach((p) => {
        p.vy += (kind === "dust" ? 0.02 : 0.32) * dt; p.vx *= 0.99; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt; p.life -= 0.006 * dt;
        if (p.life <= 0 || p.y > H + 30) return;
        g.save(); g.globalAlpha = Math.max(0, Math.min(1, p.life * 1.4)); g.translate(p.x, p.y); g.rotate(p.r); g.scale(p.s, p.s);
        if (kind === "cash" || (kind === "jackpot" && p.c === "#2fbf6a")) { g.fillStyle = "#2c9a57"; g.fillRect(-11, -6, 22, 12); g.strokeStyle = "#bdf5cf"; g.strokeRect(-9, -4, 18, 8); g.fillStyle = "#bdf5cf"; g.fillRect(-2, -2, 4, 4); }
        else if (kind === "coins" || kind === "jackpot") { g.fillStyle = p.c; g.beginPath(); g.ellipse(0, 0, 7, 7 * Math.abs(Math.cos(p.r * 2)) + 1, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = "rgba(120,80,0,.6)"; g.stroke(); }
        else { g.fillStyle = p.c; g.fillRect(-2, -2, 4, 4); }
        g.restore();
      });
      if (ps.some((p) => p.life > 0 && p.y < H + 30)) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [run, kind]);
  return <canvas ref={ref} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />;
}

function Counter({ to, run }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run || typeof to !== "number") return undefined;
    let raf; const t0 = performance.now(), D = 900;
    const tick = (n) => { const k = Math.min(1, (n - t0) / D); setV(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [to, run]);
  return <>{v}</>;
}

// ── Deschiderea: scena cinematică (reflector, piedestal, inimă, tobe, funda, capacul, explozia de lumină) ──
export function SquidReveal({ idx, prize, message, big, onClose, audio, value }) {
  const [step, setStep] = useState(0);
  const lose = prize.icon === "card";
  const kind = big ? "jackpot" : lose ? "dust" : typeof value === "number" && value >= 50 ? "cash" : "coins";
  useEffect(() => {
    audio?.heartbeat(3);
    const t = [
      setTimeout(() => { setStep(1); audio?.drumroll(1.1); }, 1300),            // cutia tremură
      setTimeout(() => { setStep(2); audio?.ribbon(); }, 2400),                  // funda se rupe
      setTimeout(() => { setStep(3); audio?.lid(); lose ? audio?.alarm() : audio?.burst(); }, 2900), // capacul zboară
      setTimeout(() => { setStep(4); if (!lose) audio?.win(big); }, 3300),       // premiul
    ];
    return () => t.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const skip = () => { if (step < 4) setStep(4); };
  return (
    <div style={{ ...st.overlay, background: lose && step >= 3 ? "rgba(40,0,6,.9)" : st.overlay.background }} onClick={skip}>
      {lose && step >= 3 && <div style={st.redAlarm} />}
      <div style={{ ...st.scene, animation: big && step === 3 ? "sqShake .5s" : "none" }} onClick={(e) => { e.stopPropagation(); skip(); }}>
        <div style={st.spot} />
        {step >= 3 && !lose && <div style={st.rays} />}
        <Guard symbol={symbolFor(idx)} size={58} style={{ position: "absolute", left: 4, bottom: 120, opacity: 0.95 }} />
        <Guard symbol={symbolFor(idx + 1)} size={58} flip style={{ position: "absolute", right: 4, bottom: 120, opacity: 0.95 }} />
        <div style={st.sceneNum}>CUTIA {pad3(idx + 1)}</div>

        <div style={st.stage}>
          <div style={st.pedestal} />
          <div style={{ ...st.bigCube, animation: step === 1 ? "sqRattle .12s linear infinite" : step >= 3 ? "sqSink .5s both" : "sqHover 2.4s ease-in-out infinite" }}>
            <div style={st.bigFront}>
              <span style={{ ...st.bigRibV, ...(step >= 2 ? { transform: "scaleY(0)", opacity: 0 } : {}) }} />
              <span style={st.bigNum}>{pad3(idx + 1)}</span>
              <span style={st.bigGloss} />
            </div>
            <div style={{ ...st.bigLid, ...(step >= 3 ? { transform: "translate(70px,-160px) rotate(55deg)", opacity: 0 } : {}) }}>
              <span style={{ ...st.bigRibLid, ...(step >= 2 ? { opacity: 0 } : {}) }} />
              <span style={{ ...st.bigBow, ...(step >= 2 ? { transform: "translate(-30px,-60px) rotate(-120deg) scale(.4)", opacity: 0 } : {}) }}>🎀</span>
            </div>
            {step >= 3 && <div style={{ ...st.innerGlow, background: lose ? "radial-gradient(circle, rgba(255,60,60,.55), transparent 70%)" : `radial-gradient(circle, ${prize.col}, transparent 70%)` }} />}
          </div>
          <Particles kind={kind} run={step >= 3} />
          {step >= 4 && (
            <div style={st.prizeFloat}>
              <div style={{ fontSize: 64, lineHeight: 1, animation: lose ? "sqFlutter 1.6s ease-in-out both" : "sqRise .7s cubic-bezier(.2,1.5,.4,1) both", filter: lose ? "none" : `drop-shadow(0 0 18px ${prize.col})` }}>
                {lose ? <BigCard /> : prize.icon}
              </div>
            </div>
          )}
        </div>

        {step >= 4 ? (
          <div style={{ position: "relative", animation: "sqPop .45s both" }}>
            <div style={{ ...st.prizeTitle, color: prize.col }}>{prize.title}</div>
            <div style={{ ...st.bigValue, color: lose ? "#ff6b6b" : prize.col }}>
              {typeof value === "number" ? <><Counter to={value} run />{" "}PCT</> : prize.sub}
            </div>
            {message && <div style={st.msg}>{message}</div>}
            <button type="button" style={st.okBtn} onClick={(e) => { e.stopPropagation(); onClose(); }}>AM ÎNȚELES</button>
          </div>
        ) : (
          <div style={st.wait}>{step === 0 ? "Gardienii aduc cutia…" : step === 1 ? "…" : step === 2 ? "Funda se rupe…" : ""}<span style={st.tapHint}>atinge ca să sari</span></div>
        )}
      </div>
    </div>
  );
}

// ── Confirmarea (înainte de deschidere) ──
export function SquidConfirm({ idx, rerollFrom, submitting, onCancel, onConfirm }) {
  return (
    <div style={st.overlay} onClick={() => !submitting && onCancel()}>
      <div style={st.confirmCard} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 6 }}>
          <Guard symbol="○" size={40} /><Guard symbol={symbolFor(idx)} size={52} /><Guard symbol="□" size={40} flip />
        </div>
        <div style={st.sceneNum}>CUTIA {pad3(idx + 1)}</div>
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
  @keyframes sqIdle { 0%,100%{transform:rotateX(14deg) rotateY(-10deg) translateY(0)} 50%{transform:rotateX(14deg) rotateY(-10deg) translateY(-3px)} }
  @keyframes sqDrop { 0%{opacity:0;transform:translateY(-24px) scale(.8)} 100%{opacity:1;transform:none} }
  @keyframes sqGloss { 0%{left:-80%} 60%,100%{left:140%} }
  @keyframes sqSweepL { 0%,100%{transform:rotate(-8deg)} 50%{transform:rotate(10deg)} }
  @keyframes sqSweepR { 0%,100%{transform:rotate(8deg)} 50%{transform:rotate(-10deg)} }
  @keyframes sqFog { 0%{transform:translateX(-10%)} 100%{transform:translateX(10%)} }
  @keyframes sqHover { 0%,100%{transform:translateY(0) rotateX(12deg) rotateY(-14deg)} 50%{transform:translateY(-6px) rotateX(12deg) rotateY(-8deg)} }
  @keyframes sqRattle { 0%{transform:translate(0,0) rotateX(12deg) rotateY(-14deg) rotate(0)} 25%{transform:translate(-3px,1px) rotateX(12deg) rotateY(-14deg) rotate(-2deg)} 75%{transform:translate(3px,-1px) rotateX(12deg) rotateY(-14deg) rotate(2deg)} 100%{transform:translate(0,0) rotateX(12deg) rotateY(-14deg) rotate(0)} }
  @keyframes sqSink { 0%{transform:rotateX(12deg) rotateY(-14deg)} 100%{transform:translateY(16px) scale(.9) rotateX(12deg) rotateY(-14deg)} }
  @keyframes sqRise { 0%{opacity:0;transform:translateY(40px) scale(.3)} 100%{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes sqFlutter { 0%{opacity:0;transform:translateY(-60px) rotate(-30deg)} 40%{opacity:1;transform:translateY(-10px) rotate(18deg)} 70%{transform:translateY(6px) rotate(-8deg)} 100%{transform:translateY(0) rotate(3deg)} }
  @keyframes sqPop { 0%{opacity:0;transform:scale(.6)} 100%{opacity:1;transform:scale(1)} }
  @keyframes sqRays { 0%{transform:translate(-50%,-50%) rotate(0)} 100%{transform:translate(-50%,-50%) rotate(360deg)} }
  @keyframes sqShake { 0%,100%{transform:translate(0,0)} 20%{transform:translate(-6px,4px)} 40%{transform:translate(5px,-5px)} 60%{transform:translate(-4px,3px)} 80%{transform:translate(3px,-2px)} }
  @keyframes sqAlarm { 0%,100%{opacity:.15} 50%{opacity:.55} }
`;

const st = {
  hall: { position: "relative", height: 170, borderRadius: 16, overflow: "hidden", marginBottom: 12, border: `1px solid ${SQ.pinkSoft}`, boxShadow: "0 12px 30px -14px rgba(255,45,122,.6)" },
  fog: { position: "absolute", left: "-20%", right: "-20%", bottom: 0, height: 70, background: "radial-gradient(ellipse at 50% 100%, rgba(255,190,220,.18), transparent 70%)", animation: "sqFog 9s ease-in-out infinite alternate", pointerEvents: "none" },
  neonRow: { position: "absolute", top: 66, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 20 },
  neon: { fontSize: 26, color: SQ.pink, textShadow: `0 0 10px ${SQ.pink}, 0 0 26px rgba(255,45,122,.7)`, fontWeight: 300, lineHeight: 1 },
  hallTitle: { position: "absolute", left: 0, right: 0, bottom: 12, textAlign: "center" },
  hallKicker: { fontSize: 10.5, fontWeight: 800, letterSpacing: ".18em", color: "#d7b9c9" },
  hallName: { fontSize: 21, fontWeight: 800, letterSpacing: ".1em", color: "#fff", textShadow: `0 0 16px ${SQ.pink}, 0 2px 0 #000`, fontFamily: "Oswald, 'Arial Narrow', sans-serif" },
  sound: { position: "absolute", top: 8, right: 8, width: 34, height: 34, borderRadius: 17, border: `1px solid ${SQ.pinkSoft}`, background: "rgba(0,0,0,.55)", color: "#fff", fontSize: 15, zIndex: 3 },

  cell: { position: "relative", aspectRatio: "1 / 1.08", background: "transparent", border: "none", padding: 0, minWidth: 0, perspective: 260 },
  cube: { position: "absolute", inset: "10% 6% 0 6%", transformStyle: "preserve-3d", transform: "rotateX(14deg) rotateY(-10deg)" },
  top: { position: "absolute", left: 0, right: 0, top: "-14%", height: "22%", transform: "skewX(-20deg)", transformOrigin: "bottom", borderRadius: "4px 4px 0 0", overflow: "hidden",
    background: "linear-gradient(180deg, #3d3d46, #1c1c22)", border: "1px solid #4a4a54" },
  topOpen: { background: "linear-gradient(180deg, rgba(255,214,120,.55), rgba(255,45,122,.2))", border: "1px solid rgba(255,214,120,.5)", boxShadow: "0 -8px 18px -4px rgba(255,214,120,.6)" },
  topRibV: { position: "absolute", top: 0, bottom: 0, left: "50%", width: 5, marginLeft: -2.5, background: SQ.pink },
  topRibH: { position: "absolute", left: 0, right: 0, top: "40%", height: 3, background: "#c2185b" },
  topBow: { position: "absolute", left: "50%", top: -10, transform: "translateX(-50%) skewX(20deg)", fontSize: 14, filter: "drop-shadow(0 2px 2px rgba(0,0,0,.7))" },
  front: { position: "absolute", left: 0, right: 0, top: "8%", bottom: 0, borderRadius: "0 0 5px 5px", overflow: "hidden",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1,
    background: "linear-gradient(155deg, #2f2f37 0%, #121216 45%, #050506 100%)", border: "1px solid #2e2e36", boxShadow: "inset 0 1px 0 rgba(255,255,255,.12), 0 6px 10px -4px rgba(0,0,0,.8)" },
  frontOpen: { background: "linear-gradient(160deg, rgba(255,45,122,.14), rgba(0,0,0,.75))", border: `1px solid ${SQ.pinkSoft}` },
  side: { position: "absolute", top: "8%", bottom: 0, right: -5, width: 5, transform: "skewY(-30deg)", transformOrigin: "left", background: "linear-gradient(90deg, #0a0a0c, #1d1d22)" },
  mine: { outline: `1.5px solid ${SQ.teal}`, outlineOffset: "-1.5px", boxShadow: `0 0 12px -2px ${SQ.teal}` },
  refused: { opacity: 0.6, border: "1px solid rgba(240,85,90,.35)" },
  num: { position: "absolute", top: 3, left: 4, fontSize: 7.5, fontWeight: 900, color: "rgba(255,255,255,.75)", letterSpacing: ".05em", zIndex: 2, textShadow: "0 0 4px rgba(255,45,122,.8)" },
  ribV: { position: "absolute", top: 0, bottom: 0, left: "50%", width: 5, marginLeft: -2.5, background: `linear-gradient(90deg, #a3124a, ${SQ.pink}, #a3124a)` },
  sym: { position: "absolute", bottom: 2, right: 4, fontSize: 9, color: "rgba(255,45,122,.85)" },
  gloss: { position: "absolute", top: 0, bottom: 0, width: "45%", left: "-80%", background: "linear-gradient(100deg, transparent, rgba(255,255,255,.16), transparent)", animation: "sqGloss 4.5s ease-in-out infinite" },
  owner: { fontSize: 7.5, fontWeight: 700, color: SQ.ink, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  val: { fontSize: 10.5, fontWeight: 900, fontFamily: "Oswald, 'Arial Narrow', sans-serif" },
  tape: { position: "absolute", left: -6, right: -6, top: "44%", transform: "rotate(-14deg)", background: "#111", color: "#f0555a", fontSize: 6.5, fontWeight: 900, letterSpacing: ".1em", textAlign: "center", padding: "1px 0", borderTop: "1px solid #f0555a", borderBottom: "1px solid #f0555a" },
  finalTag: { position: "absolute", bottom: 1, fontSize: 6.5, fontWeight: 900, color: SQ.teal, letterSpacing: ".06em" },

  overlay: { position: "fixed", inset: 0, background: "radial-gradient(ellipse at 50% 30%, rgba(60,10,35,.92), rgba(3,1,4,.96) 70%)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 14 },
  redAlarm: { position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 40%, rgba(255,0,0,.35), transparent 70%)", animation: "sqAlarm .42s ease-in-out infinite", pointerEvents: "none" },
  scene: { position: "relative", width: "100%", maxWidth: 380, textAlign: "center", color: SQ.ink, paddingTop: 8 },
  spot: { position: "absolute", left: "50%", top: -40, width: 260, height: 380, marginLeft: -130, background: "linear-gradient(180deg, rgba(255,240,248,.28), rgba(255,240,248,0) 80%)", clipPath: "polygon(42% 0, 58% 0, 100% 100%, 0 100%)", pointerEvents: "none" },
  rays: { position: "absolute", left: "50%", top: 190, width: 420, height: 420, background: "repeating-conic-gradient(rgba(255,214,120,.18) 0deg 8deg, transparent 8deg 22deg)", borderRadius: "50%", animation: "sqRays 14s linear infinite", pointerEvents: "none", maskImage: "radial-gradient(circle, #000 20%, transparent 65%)", WebkitMaskImage: "radial-gradient(circle, #000 20%, transparent 65%)" },
  sceneNum: { position: "relative", fontSize: 13, fontWeight: 900, letterSpacing: ".24em", color: SQ.pink, textShadow: `0 0 10px ${SQ.pink}`, marginBottom: 4 },
  stage: { position: "relative", height: 270, perspective: 600 },
  pedestal: { position: "absolute", left: "50%", bottom: 10, width: 190, height: 34, marginLeft: -95, borderRadius: "50%", background: "radial-gradient(ellipse, #3a1d2c 0%, #12070d 70%)", boxShadow: "0 0 30px -6px rgba(255,45,122,.6)" },
  bigCube: { position: "absolute", left: "50%", bottom: 30, width: 130, height: 120, marginLeft: -65, transformStyle: "preserve-3d" },
  bigFront: { position: "absolute", left: 0, right: 0, top: 18, bottom: 0, borderRadius: "0 0 8px 8px", overflow: "hidden",
    background: "linear-gradient(155deg, #393943 0%, #141418 45%, #050506 100%)", border: "1px solid #3a3a44", boxShadow: "inset 0 1px 0 rgba(255,255,255,.14), 0 18px 30px -10px rgba(0,0,0,.9)" },
  bigRibV: { position: "absolute", top: 0, bottom: 0, left: "50%", width: 16, marginLeft: -8, background: `linear-gradient(90deg,#a3124a,${SQ.pink},#a3124a)`, transformOrigin: "top", transition: "transform .35s, opacity .35s" },
  bigNum: { position: "absolute", left: 8, top: 6, fontSize: 13, fontWeight: 900, color: "#fff", letterSpacing: ".08em", textShadow: `0 0 8px ${SQ.pink}` },
  bigGloss: { position: "absolute", top: 0, bottom: 0, width: "40%", left: "-80%", background: "linear-gradient(100deg, transparent, rgba(255,255,255,.18), transparent)", animation: "sqGloss 3.5s ease-in-out infinite" },
  bigLid: { position: "absolute", left: -7, right: -7, top: 0, height: 24, borderRadius: 6, background: "linear-gradient(180deg, #4a4a54, #18181d)", border: "1px solid #50505a",
    transition: "transform .6s cubic-bezier(.3,1.3,.5,1), opacity .6s", boxShadow: "0 4px 8px rgba(0,0,0,.6)" },
  bigRibLid: { position: "absolute", top: 0, bottom: 0, left: "50%", width: 18, marginLeft: -9, background: SQ.pink, transition: "opacity .3s" },
  bigBow: { position: "absolute", left: "50%", top: -34, marginLeft: -24, fontSize: 48, display: "inline-block", transition: "transform .6s, opacity .6s", filter: "drop-shadow(0 4px 4px rgba(0,0,0,.7))" },
  innerGlow: { position: "absolute", left: "50%", top: -60, width: 220, height: 160, marginLeft: -110, borderRadius: "50%", filter: "blur(6px)", opacity: 0.9, pointerEvents: "none" },
  prizeFloat: { position: "absolute", left: 0, right: 0, top: 20, display: "flex", justifyContent: "center" },
  prizeTitle: { fontSize: 19, fontWeight: 900, letterSpacing: ".1em", fontFamily: "Oswald, 'Arial Narrow', sans-serif" },
  bigValue: { fontSize: 40, fontWeight: 900, lineHeight: 1.05, fontFamily: "Oswald, 'Arial Narrow', sans-serif", textShadow: "0 0 18px currentColor" },
  msg: { fontSize: 12.5, color: "#e2d3dc", lineHeight: 1.5, margin: "8px 6px 14px" },
  wait: { position: "relative", fontSize: 13, color: "#cdbfc8", minHeight: 56, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, letterSpacing: ".06em" },
  tapHint: { fontSize: 10, color: "rgba(255,255,255,.35)", letterSpacing: ".1em" },
  confirmCard: { position: "relative", width: "100%", maxWidth: 340, borderRadius: 18, padding: "18px 18px 16px", textAlign: "center",
    background: "radial-gradient(ellipse at 50% 0%, rgba(255,45,122,.28), transparent 60%), linear-gradient(180deg, #1c0b16, #0b0710)", border: `1px solid ${SQ.pinkSoft}`, boxShadow: "0 0 50px -8px rgba(255,45,122,.55)", color: SQ.ink },
  confirmText: { fontSize: 14, lineHeight: 1.45, margin: "6px 0 8px" },
  confirmWarn: { fontSize: 11, color: "#f0a0a5", marginBottom: 16 },
  okBtn: { flex: 1.4, minHeight: 46, width: "100%", borderRadius: 12, border: `1px solid ${SQ.pink}`, background: "linear-gradient(180deg, rgba(255,45,122,.45), rgba(255,45,122,.18))", color: "#fff", fontWeight: 900, letterSpacing: ".14em", fontSize: 13, boxShadow: "0 0 16px -4px rgba(255,45,122,.7)" },
  cancelBtn: { flex: 1, minHeight: 46, borderRadius: 12, border: "1px solid rgba(255,255,255,.15)", background: "rgba(255,255,255,.05)", color: "#cfc6cc", fontWeight: 700, fontSize: 13 },
};

function MiniCard() {
  return (
    <svg viewBox="0 0 40 24" width="30" height="18" aria-hidden><rect x="1" y="1" width="38" height="22" rx="2" fill="#c9a77a" stroke="#8a6e48" />
      <circle cx="11" cy="12" r="4" fill="none" stroke="#2a2a2a" strokeWidth="1.4" /><path d="M20 8 L24 16 L16 16 Z" fill="none" stroke="#2a2a2a" strokeWidth="1.4" /><rect x="27" y="8" width="7" height="8" fill="none" stroke="#2a2a2a" strokeWidth="1.4" /></svg>
  );
}
function BigCard() {
  return (
    <svg viewBox="0 0 100 60" width="120" height="72" aria-hidden><rect x="2" y="2" width="96" height="56" rx="4" fill="#d6b88c" stroke="#8a6e48" strokeWidth="2" />
      <circle cx="26" cy="30" r="10" fill="none" stroke="#222" strokeWidth="3" /><path d="M50 19 L61 41 L39 41 Z" fill="none" stroke="#222" strokeWidth="3" strokeLinejoin="round" /><rect x="67" y="20" width="20" height="20" fill="none" stroke="#222" strokeWidth="3" /></svg>
  );
}
