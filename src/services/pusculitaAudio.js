// ══════════════════════════════════════════════════════════════════
// 🐷 PUȘCULIȚA — SUNET (varianta aprobată, în stilul serialului)
//
// Totul e GENERAT în cod (Web Audio): fluier de școală, tobă, palme,
// gongul din difuzoare, cutie muzicală. Melodia marșului e originală;
// valsul de la podium e „Dunărea albastră” (J. Strauss II, 1866 —
// domeniu public). Vocea care anunță folosește sinteza vocală a
// telefonului, în engleză, ca în serial („Player 456. Eliminated.”).
// - Pornit/oprit dintr-un singur buton; preferința se păstrează pe telefon.
// - Browserele permit sunetul doar după o atingere.
// - Animațiile funcționează identic și fără sunet.
// ══════════════════════════════════════════════════════════════════

const PREF_KEY = "pusculita-sound";
let ctx = null, bus = null, music = null, loopT = null, roll = null;
let enabled = readPref();
const listeners = new Set();

function readPref() { try { return localStorage.getItem(PREF_KEY) === "on"; } catch { return false; } }
function writePref(on) { try { localStorage.setItem(PREF_KEY, on ? "on" : "off"); } catch { /* stocare indisponibilă */ } }

function init() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  ctx = new AC();
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3; comp.connect(ctx.destination);
  bus = ctx.createGain(); bus.gain.value = 0.9;
  const dry = ctx.createGain(); dry.gain.value = 0.9; const wet = ctx.createGain(); wet.gain.value = 0.22;
  const rev = ctx.createConvolver(); rev.buffer = impulse(1.6, 3.2);           // ecoul unei săli mari (dormitorul jucătorilor)
  bus.connect(dry); dry.connect(comp); bus.connect(rev); rev.connect(wet); wet.connect(comp);
  return ctx;
}
function impulse(sec, decay) { const len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); } return b; }
let nb = null; const noise = () => { if (nb) return nb; nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return nb; };
const now = () => ctx.currentTime;
const N = (n) => 440 * Math.pow(2, (n - 69) / 12); // MIDI → Hz
function env(t, a, peak, d) { const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); return g; }

// ── Instrumente ──
// Blockflöte (fluier de școală): ton moale, suflu, vibrato ușor
function recorder(t, f, dur, vol = 0.16, dest = bus) {
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.035);
  g.gain.setValueAtTime(vol, t + Math.max(0.04, dur - 0.06)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 3200; lp.connect(g); g.connect(dest);
  const o1 = ctx.createOscillator(); o1.type = "triangle"; o1.frequency.value = f;
  const o2 = ctx.createOscillator(); o2.type = "sine"; o2.frequency.value = f * 2; const g2 = ctx.createGain(); g2.gain.value = 0.18;
  const vib = ctx.createOscillator(); vib.frequency.value = 5.2; const vg = ctx.createGain(); vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.006, t + 0.2);
  vib.connect(vg); vg.connect(o1.frequency); vg.connect(o2.frequency);
  o1.connect(lp); o2.connect(g2); g2.connect(lp);
  const br = ctx.createBufferSource(); br.buffer = noise(); const bf = ctx.createBiquadFilter(); bf.type = "bandpass"; bf.frequency.value = f * 2; bf.Q.value = 6;
  const bg = ctx.createGain(); bg.gain.setValueAtTime(0.05, t); bg.gain.exponentialRampToValueAtTime(0.01, t + 0.12); br.connect(bf); bf.connect(bg); bg.connect(g);
  [o1, o2, vib, br].forEach((o) => { o.start(t); o.stop(t + dur + 0.1); });
}
function snare(t, vol = 0.32, dest = bus) {
  const s = ctx.createBufferSource(); s.buffer = noise(); const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 1400;
  const g = env(t, 0.002, vol, 0.14); s.connect(hp); hp.connect(g); g.connect(dest); s.start(t); s.stop(t + 0.2);
  const o = ctx.createOscillator(); o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.06);
  const og = env(t, 0.002, vol * 0.6, 0.07); o.connect(og); og.connect(dest); o.start(t); o.stop(t + 0.12);
}
function clap(t, vol = 0.28, dest = bus) {
  [0, 0.011, 0.022].forEach((o, i) => { const s = ctx.createBufferSource(); s.buffer = noise(); const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1150; bp.Q.value = 1.4;
    const g = env(t + o, 0.001, vol * (i === 2 ? 1 : 0.6), i === 2 ? 0.12 : 0.02); s.connect(bp); bp.connect(g); g.connect(dest); s.start(t + o); s.stop(t + o + 0.2); });
}
function pluckBass(t, f, vol = 0.22, dest = bus) { const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = f; const g = env(t, 0.004, vol, 0.25); o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.3); }
function musicBox(t, f, vol = 0.12, dest = bus) {
  [[1, 1], [3.01, 0.25], [5.4, 0.08]].forEach(([r, a]) => { const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f * r; const g = env(t, 0.002, vol * a, r === 1 ? 1.4 : 0.35); o.connect(g); g.connect(dest); o.start(t); o.stop(t + 1.5); });
}
function thud(t, vol = 0.8) { const o = ctx.createOscillator(); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.35); const g = env(t, 0.003, vol, 0.4); o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.5); }
function crash(t, vol = 0.25) { const s = ctx.createBufferSource(); s.buffer = noise(); s.loop = true; const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 5000; const g = env(t, 0.003, vol, 1.8); s.connect(hp); hp.connect(g); g.connect(bus); s.start(t); s.stop(t + 2); }
// Gongul de anunț din difuzoare (două note, ca într-o sală mare)
function chime(t, notes = [76, 72], vol = 0.16) { notes.forEach((n, i) => { [[1, 1], [2.0, 0.2], [3.0, 0.08]].forEach(([r, a]) => { const o = ctx.createOscillator(); o.frequency.value = N(n) * r; const g = env(t + i * 0.42, 0.006, vol * a, 1.3); o.connect(g); g.connect(bus); o.start(t + i * 0.42); o.stop(t + i * 0.42 + 1.4); }); }); }
// ── Marșul copilăresc (melodie ORIGINALĂ, la minor, fluier + tobă + palme) ──
const MARCH = [[69,1],[69,1],[72,1],[69,1],[67,1],[64,1],[67,2],[69,1],[69,1],[72,1],[74,1],[76,1],[74,1],[72,2],
               [76,1],[76,1],[74,1],[72,1],[69,1],[72,1],[74,2],[72,1],[69,1],[67,1],[64,1],[69,4]];
function march(t0, { vol = 1, dest = bus, bpm = 112 } = {}) {
  const beat = 60 / bpm / 2; let t = t0, step = 0;
  MARCH.forEach(([n, len]) => { recorder(t, N(n), len * beat * 0.92, 0.15 * vol, dest); t += len * beat; });
  const total = t - t0;
  for (let b = 0; b * beat < total - 0.01; b++) {
    const tb = t0 + b * beat;
    if (b % 2 === 0) pluckBass(tb, N(b % 4 === 0 ? 45 : 52), 0.2 * vol, dest);
    if (b % 2 === 1) { snare(tb, 0.2 * vol, dest); if (b % 4 === 3) clap(tb, 0.16 * vol, dest); }
    if (b % 8 === 7) { snare(tb + beat / 3, 0.1 * vol, dest); snare(tb + beat * 2 / 3, 0.13 * vol, dest); }
    step++;
  }
  return total;
}
// ── Dunărea albastră (Johann Strauss II, 1866 — domeniu public), cutie muzicală ──
const DANUBE = [[62,1],[62,1],[66,1],[69,1],[69,2],[81,1],[81,2],[78,1],[78,2],
                [62,1],[62,1],[66,1],[69,1],[69,2],[81,1],[81,2],[79,1],[79,2],
                [61,1],[61,1],[64,1],[71,1],[71,2],[83,1],[83,2],[79,1],[79,2],
                [61,1],[61,1],[64,1],[71,1],[71,2],[83,1],[83,2],[78,1],[78,3]];
function danube(t0, vol = 1) {
  const beat = 60 / 168; let t = t0;
  DANUBE.forEach(([n, len]) => { musicBox(t, N(n), 0.11 * vol); t += len * beat; });
  for (let b = 0; t0 + b * beat < t; b++) { const tb = t0 + b * beat; const bar = Math.floor(b / 3) % 8; const root = bar < 4 ? 50 : 45;
    if (b % 3 === 0) pluckBass(tb, N(root - 12), 0.14 * vol); else musicBox(tb, N(root + (b % 3 === 1 ? 4 : 7) + (bar < 4 ? 0 : 3)), 0.035 * vol); }
  return t - t0;
}


// ── Vocea din difuzoare (engleză, ca în serial) ──
const DIGITS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
function sayEn(text, delay = 0) {
  try {
    if (!window.speechSynthesis) return;
    setTimeout(() => {
      if (!enabled) return;
      const u = new SpeechSynthesisUtterance(text); u.lang = "en-US"; u.rate = 0.82; u.pitch = 0.55; u.volume = 1;
      const voices = speechSynthesis.getVoices();
      const v = voices.find((x) => /^en(-|_)(US|GB)/i.test(x.lang) && /male|david|daniel|guy/i.test(x.name)) || voices.find((x) => /^en/i.test(x.lang));
      if (v) u.voice = v;
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    }, delay);
  } catch { /* fără voce */ }
}
function playerWords(number) {
  const digits = String(number || "").replace(/\D/g, "");
  return digits ? digits.split("").map((d) => DIGITS[+d]).join(" ") : "";
}

function ready() {
  if (!enabled) return null;
  init();
  if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

// ══════════════════════════════════════════════════════════════════
// API folosit de ecranul Pușculiței
// ══════════════════════════════════════════════════════════════════
export function unlockAudio() {
  init();
  if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
  try { window.speechSynthesis?.getVoices(); } catch { /* fără voce */ }
}
export function isSoundOn() { return enabled; }
export function onSoundChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function setSoundOn(on) {
  enabled = !!on; writePref(enabled);
  if (enabled) { unlockAudio(); playIntro(); setTimeout(() => startAmbience(), 9000); }
  else { stopAmbience(); stopHeartbeat(); try { window.speechSynthesis?.cancel(); } catch { /* */ } }
  listeners.forEach((fn) => fn(enabled));
}

export function playIntro() {
  if (!ready()) return; const t = now() + 0.05;
  thud(t, 0.9); chime(t + 0.5); sayEn("Welcome, players. The game is about to begin.", 1400); march(t + 4.2);
}
// Muzica de fundal: marșul, în buclă, încet.
export function startAmbience() {
  if (!ready() || music) return;
  music = ctx.createGain(); music.gain.value = 0.4; music.connect(bus);
  const loop = () => { if (!music) return; const len = march(now() + 0.05, { dest: music, vol: 0.9, bpm: 104 }); loopT = setTimeout(loop, (len + 2.2) * 1000); };
  loop();
}
export function stopAmbience() {
  clearTimeout(loopT); if (!music || !ctx) { music = null; return; }
  const m = music; music = null; m.gain.setTargetAtTime(0.0001, now(), 0.3); setTimeout(() => m.disconnect(), 1500);
}
// Eliminare: gongul din difuzoare + „Player 456. Eliminated.”
export function playEliminated(number) {
  if (!ready()) return; const t = now();
  chime(t, [76, 72], 0.13);
  const w = playerWords(number);
  sayEn(w ? `Player ${w}. Eliminated.` : "Eliminated.", 800);
}
export function playWhoosh() {
  if (!ready()) return; const t = now();
  const s = ctx.createBufferSource(); s.buffer = noise(); const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 1.2;
  bp.frequency.setValueAtTime(400, t); bp.frequency.exponentialRampToValueAtTime(2200, t + 0.45);
  const g = env(t, 0.15, 0.16, 0.35); s.connect(bp); bp.connect(g); g.connect(bus); s.start(t); s.stop(t + 0.6);
}
export function playCoinImpact() {
  if (!ready()) return; const t = now(); thud(t, 0.8);
  [2637, 3520, 4186].forEach((f, i) => { const o = ctx.createOscillator(); o.frequency.value = f; const g = env(t + i * 0.015, 0.002, 0.06, 0.45); o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.6); });
}
export function playCoinSettle() {
  if (!ready()) return; const t = now();
  [1760, 2350, 2960].forEach((f, i) => { const o = ctx.createOscillator(); o.frequency.value = f; const g = env(t + i * 0.06, 0.002, 0.06, 0.25); o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.5); });
}
export function playClick() {
  if (!ready()) return; const t = now(); thud(t, 0.5);
  const s = ctx.createBufferSource(); s.buffer = noise(); const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 2800; bp.Q.value = 5;
  const g = env(t, 0.001, 0.4, 0.04); s.connect(bp); bp.connect(g); g.connect(bus); s.start(t); s.stop(t + 0.1);
  const o = ctx.createOscillator(); o.type = "square"; o.frequency.value = 1320; const og = env(t + 0.07, 0.002, 0.05, 0.08); o.connect(og); og.connect(bus); o.start(t + 0.07); o.stop(t + 0.2);
}
// Suspansul votului: rafală de tobă care crește (se oprește la ștampilă).
export function startHeartbeat() {
  stopHeartbeat(); if (!ready()) return;
  const t0 = now();
  const hit = () => { if (!roll) return; const k = Math.min(1, (now() - t0) / 3); snare(now(), 0.08 + k * 0.2); roll = setTimeout(hit, 70 - k * 25); };
  roll = true; hit();
}
export function stopHeartbeat() { if (roll) { clearTimeout(roll); roll = null; } }
export function playStamp(isContinue) {
  stopHeartbeat(); if (!ready()) return; const t = now();
  if (isContinue) { thud(t, 0.5); clap(t, 0.3); [72, 76, 79].forEach((n, i) => recorder(t + i * 0.09, N(n), 0.22, 0.14)); }
  else {
    thud(t, 0.8);
    const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = 92; const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900;
    const g = env(t, 0.005, 0.18, 0.55); o.connect(lp); lp.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.7);
  }
}
export function playStopVerdict() {
  if (!ready()) return; const t = now(); thud(t, 1); crash(t, 0.22); chime(t + 0.6, [72, 67], 0.14);
  sayEn("Voting is over. The game will stop.", 1500);
  [69, 67, 64, 62, 57].forEach((n, i) => recorder(t + 3.8 + i * 0.32, N(n), 0.3, 0.13));
}
export function playContinueVerdict() {
  if (!ready()) return; const t = now(); thud(t, 0.9); crash(t, 0.2); chime(t + 0.6, [72, 76], 0.14);
  sayEn("Voting is over. The game will continue.", 1500);
  march(t + 3.8, { bpm: 124, vol: 0.9 });
}
export function playPodiumHit() { if (!ready()) return; const t = now(); thud(t, 0.9); snare(t, 0.25); }
export function playVictory() {
  if (!ready()) return; const t = now(); crash(t, 0.25); thud(t, 1);
  for (let i = 0; i < 24; i++) clap(t + 0.2 + Math.random() * 2.4, 0.07 + Math.random() * 0.08);
  danube(t + 0.4);
}
