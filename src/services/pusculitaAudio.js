// ══════════════════════════════════════════════════════════════════
// 🐷 PUȘCULIȚA — SUNET (Web Audio, generat în cod)
//
// Toate sunetele și muzica sunt SINTETIZATE aici, în timp real: nu există
// fișiere audio, nimic copiat din serial, nimic de licențiat.
// - Pornit/oprit dintr-un singur buton; preferința se păstrează pe telefon.
// - Browserele permit sunetul doar după o atingere: contextul audio se
//   deblochează la prima atingere a utilizatorului.
// - Animațiile funcționează identic și fără sunet.
// ══════════════════════════════════════════════════════════════════

const PREF_KEY = "pusculita-sound";
let ctx = null;
let master = null;
let enabled = readPref();
let ambience = null;
let heartbeat = null;
const listeners = new Set();

function readPref() {
  try { return localStorage.getItem(PREF_KEY) === "on"; } catch { return false; }
}
function writePref(on) {
  try { localStorage.setItem(PREF_KEY, on ? "on" : "off"); } catch { /* stocare indisponibilă */ }
}

function ensureCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 4;
  master.connect(comp); comp.connect(ctx.destination);
  return ctx;
}

// Deblocare la prima atingere (cerință a browserelor pentru sunet).
export function unlockAudio() {
  const c = ensureCtx();
  if (c && c.state === "suspended") c.resume().catch(() => {});
}

export function isSoundOn() { return enabled; }
export function onSoundChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function setSoundOn(on) {
  enabled = !!on; writePref(enabled);
  if (enabled) { unlockAudio(); playIntro(); startAmbience(); }
  else { stopAmbience(); stopHeartbeat(); }
  listeners.forEach((fn) => fn(enabled));
}

function ready() {
  if (!enabled) return null;
  const c = ensureCtx();
  if (!c) return null;
  if (c.state === "suspended") c.resume().catch(() => {});
  return c;
}

// ── Blocuri de bază ──
function env(g, t, a, peak, d, end = 0.0001) {
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(end, t + a + d);
}
function tone(freq, { type = "sine", t = 0, a = 0.005, d = 0.4, peak = 0.3, detune = 0, dest } = {}) {
  const c = ready(); if (!c) return;
  const now = c.currentTime + t;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, now); o.detune.value = detune;
  env(g, now, a, peak, d);
  o.connect(g); g.connect(dest || master);
  o.start(now); o.stop(now + a + d + 0.05);
}
let noiseBuf = null;
function noise(c) {
  if (noiseBuf) return noiseBuf;
  noiseBuf = c.createBuffer(1, c.sampleRate * 1.5, c.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}
function noiseHit({ t = 0, d = 0.2, peak = 0.3, type = "bandpass", freq = 1200, q = 1, sweepTo = null } = {}) {
  const c = ready(); if (!c) return;
  const now = c.currentTime + t;
  const src = c.createBufferSource(); src.buffer = noise(c);
  const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, now); f.Q.value = q;
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, now + d);
  const g = c.createGain(); env(g, now, 0.004, peak, d);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(now); src.stop(now + d + 0.05);
}
function boom({ t = 0, from = 110, to = 38, d = 0.7, peak = 0.7 } = {}) {
  const c = ready(); if (!c) return;
  const now = c.currentTime + t;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = "sine"; o.frequency.setValueAtTime(from, now); o.frequency.exponentialRampToValueAtTime(to, now + d);
  env(g, now, 0.006, peak, d);
  o.connect(g); g.connect(master); o.start(now); o.stop(now + d + 0.05);
}

// ══════════════════════════════════════════════════════════════════
// SUNETELE JOCULUI
// ══════════════════════════════════════════════════════════════════

// Introducere: motiv scurt, ca o melodie de joacă de copii, ușor stranie (original).
export function playIntro() {
  const notes = [659, 587, 523, 587, 659, 659, 659, 0, 587, 587, 659, 587, 523];
  notes.forEach((f, i) => { if (f) tone(f, { type: "triangle", t: 0.15 + i * 0.17, d: 0.32, peak: 0.16 }); });
  boom({ t: 0.05, from: 90, to: 40, d: 1.1, peak: 0.45 });
}

// Ambianță tensionată în buclă: dronă grea + vânt.
export function startAmbience() {
  const c = ready(); if (!c || ambience) return;
  const out = c.createGain(); out.gain.value = 0.0001; out.connect(master);
  out.gain.exponentialRampToValueAtTime(0.07, c.currentTime + 2.5);
  const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 420; lp.Q.value = 2; lp.connect(out);
  const oscs = [55, 55.4, 82.4].map((f, i) => { const o = c.createOscillator(); o.type = i === 2 ? "triangle" : "sawtooth"; o.frequency.value = f; o.connect(lp); o.start(); return o; });
  const lfo = c.createOscillator(); const lfoG = c.createGain(); lfo.frequency.value = 0.08; lfoG.gain.value = 180; lfo.connect(lfoG); lfoG.connect(lp.frequency); lfo.start();
  const wind = c.createBufferSource(); wind.buffer = noise(c); wind.loop = true;
  const wf = c.createBiquadFilter(); wf.type = "bandpass"; wf.frequency.value = 500; wf.Q.value = 0.6;
  const wg = c.createGain(); wg.gain.value = 0.25; wind.connect(wf); wf.connect(wg); wg.connect(out); wind.start();
  ambience = { out, nodes: [...oscs, lfo, wind] };
}
export function stopAmbience() {
  if (!ambience || !ctx) { ambience = null; return; }
  const a = ambience; ambience = null;
  const now = ctx.currentTime;
  a.out.gain.cancelScheduledValues(now); a.out.gain.setValueAtTime(a.out.gain.value, now); a.out.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
  setTimeout(() => { a.nodes.forEach((n) => { try { n.stop(); } catch { /* deja oprit */ } }); a.out.disconnect(); }, 900);
}

// Bătăi de inimă (suspans), din ce în ce mai rapide. Returnează nimic; se oprește cu stopHeartbeat.
export function startHeartbeat(intense = false) {
  stopHeartbeat();
  if (!ready()) return;
  let period = intense ? 520 : 760;
  const beat = () => {
    boom({ from: 70, to: 40, d: 0.22, peak: 0.55 });
    boom({ t: 0.16, from: 60, to: 38, d: 0.2, peak: 0.35 });
    period = Math.max(360, period - 25);
    heartbeat = setTimeout(beat, period);
  };
  beat();
}
export function stopHeartbeat() { if (heartbeat) { clearTimeout(heartbeat); heartbeat = null; } }

// Apăsarea mecanică a butonului de vot.
export function playClick() {
  noiseHit({ d: 0.05, peak: 0.5, freq: 2600, q: 3 });
  noiseHit({ t: 0.03, d: 0.08, peak: 0.35, freq: 900, q: 2 });
  boom({ t: 0.01, from: 160, to: 80, d: 0.1, peak: 0.3 });
}

// Ștampila votului: CONTINUĂ = clopoțel luminos; STOP = sonerie aspră.
export function playStamp(isContinue) {
  boom({ from: 120, to: 50, d: 0.3, peak: 0.5 });
  if (isContinue) {
    tone(784, { type: "sine", t: 0.02, d: 0.9, peak: 0.22 });
    tone(988, { type: "sine", t: 0.06, d: 0.9, peak: 0.18 });
    tone(1568, { type: "sine", t: 0.06, d: 0.5, peak: 0.06 });
  } else {
    tone(110, { type: "square", t: 0.02, d: 0.55, peak: 0.12, detune: -12 });
    tone(116, { type: "square", t: 0.02, d: 0.55, peak: 0.12, detune: 12 });
  }
}

// Zbor (avatar spre pușculiță / spre tabără).
export function playWhoosh() { noiseHit({ d: 0.55, peak: 0.28, type: "bandpass", freq: 400, q: 1.2, sweepTo: 2800 }); }

// Moneda intră prin fantă: impact + scântei metalice.
export function playCoinImpact() {
  boom({ from: 140, to: 45, d: 0.45, peak: 0.6 });
  [2637, 3520, 4186].forEach((f, i) => tone(f, { type: "sine", t: 0.01 + i * 0.015, d: 0.35, peak: 0.08 }));
  noiseHit({ d: 0.25, peak: 0.18, type: "highpass", freq: 5000 });
}
// Moneda se așază: clinchet de monede pe sticlă.
export function playCoinSettle() {
  [1760, 2350, 2960].forEach((f, i) => tone(f, { type: "sine", t: i * 0.06, d: 0.22, peak: 0.07 }));
  tone(523, { type: "triangle", t: 0, d: 0.5, peak: 0.05 });
}

// Verdict: STOP = gong + acord grav; CONTINUĂ = urcare + acord luminos.
export function playStopVerdict() {
  boom({ from: 80, to: 30, d: 2.2, peak: 0.9 });
  [65.4, 77.8, 98].forEach((f) => tone(f, { type: "sawtooth", a: 0.05, d: 2.4, peak: 0.09 }));
  [233, 311, 466].forEach((f, i) => tone(f, { type: "sine", t: 0.02 * i, d: 3.2, peak: 0.07 }));
}
export function playContinueVerdict() {
  noiseHit({ d: 0.8, peak: 0.2, type: "bandpass", freq: 300, q: 0.8, sweepTo: 4000 });
  [523, 659, 784, 1047].forEach((f, i) => tone(f, { type: "triangle", t: 0.5 + i * 0.09, d: 1.4, peak: 0.12 }));
  boom({ t: 0.5, from: 100, to: 45, d: 0.8, peak: 0.6 });
}

// Podium: lovituri de timpan pentru locurile 3 și 2, fanfară pentru locul 1.
export function playPodiumHit() {
  boom({ from: 100, to: 42, d: 0.9, peak: 0.7 });
  noiseHit({ d: 0.3, peak: 0.12, type: "lowpass", freq: 600 });
}
export function playVictory() {
  const seq = [[523, 0], [659, 0.14], [784, 0.28], [1047, 0.42], [784, 0.62], [1047, 0.76]];
  seq.forEach(([f, t]) => { tone(f, { type: "sawtooth", t, d: 0.35, peak: 0.07 }); tone(f, { type: "triangle", t, d: 0.5, peak: 0.12 }); });
  [523, 659, 784, 1047].forEach((f) => tone(f, { type: "triangle", t: 0.95, a: 0.02, d: 2.2, peak: 0.1 }));
  boom({ t: 0.95, from: 90, to: 40, d: 1.4, peak: 0.7 });
  for (let i = 0; i < 10; i++) tone(2000 + Math.random() * 3000, { type: "sine", t: 1.0 + i * 0.12, d: 0.25, peak: 0.04 });
}
