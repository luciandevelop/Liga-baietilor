import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { getAvatarUrl, isS3Avatar } from "../assets/avatars";
import { RL_CHOICE, RL_FINISH_STEPS, RL_MAX_STRIKES, RL_OUTCOME, RL_POINTS_TABLE, RL_STATUS, computeRedLight, pointsForSteps } from "../services/redLightEngine";
import { loadBridgeAssets } from "../services/bridgeService";
import { getPlayerLooks, getSeasonNumbers } from "../services/seasonNumbersService";
import { getUserPublicProfiles } from "../services/profilesService";
import { createCharacterKit } from "./redLightCharacters";

// ══════════════════════════════════════════════════════════════════
// 🚦 RED LIGHT SHOW — v2 (regie cinematografică).
//
// STRICT AFIȘARE: joacă evenimentele DEJA calculate de motor (scenariul
// salvat în redLight/{gw}/meta/show). Nu recalculează reguli, nu scrie nimic,
// nu modifică puncte.
//
// • Decor exterior de zi: teren de nisip cu perspectivă, START/FINISH, ziduri
//   înalte, cer deschis, un copac generic, praf în aer.
// • SLOTURI (fișiere puse de Admin în public/redlight/): doll.glb (+ doll.json)
//   înlocuiește păpușa V2; song.mp3 se redă nemodificat la lumina verde.
// • Păpușa: design ORIGINAL — santinelă mecanică de porțelan crăpat și fier
//   oxidat, ~17 m, cap articulat cu mișcare sacadată, ochi care se aprind.
// • Participanții: personaje 3D (modelul CC0 deja folosit la Podul de Sticlă),
//   treninguri pe rolurile Sezonului 3, numărul pe spate; identitatea = avatarul
//   ORIGINAL nemodificat, într-un medalion și în cardul din prim-plan.
// • Regie: cadre generale, travelling, contraplonjeu pe păpușă, scanare peste
//   umărul ei, prim-planuri, eliminări, sprint, FINISHER — cu tranziții fluide.
// • Mod LOW automat: fără umbre/praf, mai puține straturi de ceață.
// ══════════════════════════════════════════════════════════════════

const T = THREE;
const STEP_LEN = 2.0;
const START_Z = 8;
const zForSteps = (s) => START_Z - Math.min(RL_FINISH_STEPS, s) * STEP_LEN;
const FINISH_Z = zForSteps(RL_FINISH_STEPS); // -20
const DOLL_Z = FINISH_Z - 13; // -33
const HEAD_Y = 14.6;
const LANE_W = 22;
const smooth = (t) => t * t * (3 - 2 * t);
const pad3 = (n) => (Number.isFinite(Number(n)) && n !== null && n !== "" ? String(n).padStart(3, "0") : "");
const roleForNumber = (n) => (n === 1 ? "boss" : n >= 2 && n <= 4 ? `vip${n}` : n >= 5 && n <= 10 ? "guard" : "player");
// culorile etichetei cu număr (aceleași roluri ca la Pod: 001 Leader, 002–004 Pretenders, 005–010 Gardieni, restul concurenți)
const ROLE_TAG = { boss: ["#0c0c0e", "#e0bc4a"], vip2: ["#4a1f17", "#ffffff"], vip3: ["#14203f", "#e0bc4a"], vip4: ["#3a1450", "#e0bc4a"], guard: ["#b0163c", "#ffffff"], player: ["#1b6b52", "#ffffff"] };
const ROLE_LABEL = { boss: "LEADER", vip2: "PRETENDER", vip3: "PRETENDER", vip4: "PRETENDER", guard: "GARDIAN", player: "" };

// ══════════════════════════════════════════════════════════════════
// SUNET — ambianță reală CC0 (din /bridge/sfx.json, deja în proiect) +
// sintetizator original (cutie muzicală compusă aici, alarme, scanare).
// ══════════════════════════════════════════════════════════════════
function createAudio(SFX, songBytes) {
  let ctx = null; let bus = null; let master = null; let on = true; let tune = null; const buf = {}; const amb = [];
  let fx = null; let voice = null; let songBuf = null; let songSrc = null; let songDone = true; const vol = { voice: 1, fx: 1 }; let duckF = 1;
  const AC = typeof window !== "undefined" ? (window.AudioContext || window.webkitAudioContext) : null;
  function init() {
    if (ctx || !AC) return;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 6;
    master = ctx.createGain(); master.gain.value = on ? 0.9 : 0; comp.connect(master); master.connect(ctx.destination);
    // canalul „efecte” (toate sunetele show-ului) și canalul „voce” (fișierul din slotul song.mp3), cu volume separate
    fx = ctx.createGain(); fx.gain.value = vol.fx; fx.connect(comp);
    voice = ctx.createGain(); voice.gain.value = vol.voice; voice.connect(master); // cântecul NU trece prin compresor: sunetele show-ului nu-l mai pot „îneca”
    if (songBytes) { try { const p = ctx.decodeAudioData(songBytes.slice(0), (x) => { songBuf = x; }, () => {}); if (p?.then) p.then((x) => { songBuf = x; }).catch(() => {}); } catch { /* fișier audio invalid */ } }
    bus = ctx.createGain(); const dry = ctx.createGain(); const wet = ctx.createGain(); wet.gain.value = 0.3;
    const rev = ctx.createConvolver(); const len = ctx.sampleRate * 3; const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    rev.buffer = b; bus.connect(dry); dry.connect(fx); bus.connect(rev); rev.connect(wet); wet.connect(fx);
    const toAB = (url) => { const s = atob(url.split(",")[1]); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; };
    Object.entries(SFX || {}).forEach(([k, url]) => { try { const p = ctx.decodeAudioData(toAB(url), (x) => { buf[k] = x; }, () => {}); if (p?.then) p.then((x) => { buf[k] = x; }).catch(() => {}); } catch { /* sunet indisponibil */ } });
  }
  const now = () => ctx.currentTime;
  function play(name, { vol = 1, rate = 1, delay = 0, loop = false } = {}) {
    if (!ctx || !buf[name]) return null; const s = ctx.createBufferSource(); s.buffer = buf[name]; s.playbackRate.value = rate; s.loop = loop;
    const g = ctx.createGain(); g.gain.value = vol; s.connect(g); g.connect(bus); s.start(now() + delay); return { s, g };
  }
  function drum(at, f0, f1, dur, peak) {
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(f0, at); o.frequency.exponentialRampToValueAtTime(f1, at + dur * 0.7);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(peak, at + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g); g.connect(bus); o.start(at); o.stop(at + dur + 0.05);
  }
  function env(node, at, a, d, peak) { const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(peak, at + a); g.gain.exponentialRampToValueAtTime(0.0001, at + a + d); node.connect(g); g.connect(bus); return g; }
  function tone(freq, at, dur, type = "sine", peak = 0.2, a = 0.005) { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, at); env(o, at, a, dur, peak); o.start(at); o.stop(at + a + dur + 0.05); return o; }
  function noise(at, dur, peak = 0.3, type = "lowpass", freq = 800) {
    const n = Math.max(1, Math.floor(ctx.sampleRate * dur)); const b = ctx.createBuffer(1, n, ctx.sampleRate); const ch = b.getChannelData(0);
    for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ctx.createBufferSource(); s.buffer = b; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; s.connect(f); env(f, at, 0.004, dur, peak); s.start(at); s.stop(at + dur + 0.05);
  }
  // Melodie ORIGINALĂ de cutie muzicală (compusă pentru PLAY LEAGUE).
  const MELODY = [0, 3, 7, 3, 5, 3, 0, null, 0, 3, 7, 10, 8, 7, 5, null];
  return {
    get on() { return on; },
    resume() { init(); if (ctx?.state === "suspended") ctx.resume(); },
    setOn(v) { on = v; if (master) master.gain.setTargetAtTime(v ? 0.9 : 0, now(), 0.05); },
    setVolume(ch, v) { vol[ch] = v; const g = ch === "voice" ? voice : fx; if (g) g.gain.setTargetAtTime(ch === "fx" ? v * duckF : v, now(), 0.05); },
    // cât timp cântă cântecul, efectele scad, ca vocea să rămână clară
    duck(v) { duckF = v ? 0.35 : 1; if (fx) fx.gain.setTargetAtTime(vol.fx * duckF, now(), 0.15); },
    // Slotul audio: redă fișierul NEMODIFICAT, o singură dată; întoarce durata (secunde) sau 0 dacă lipsește.
    playSong() { if (!ctx || !songBuf) return 0; this.stopSong(); const src = ctx.createBufferSource(); src.buffer = songBuf; src.connect(voice); songDone = false; src.onended = () => { if (songSrc === src) { songDone = true; songSrc = null; } }; src.start(); songSrc = src; return songBuf.duration; },
    stopSong() { if (songSrc) { const x = songSrc; songSrc = null; try { x.stop(); } catch { /* deja oprit */ } } songDone = true; },
    get songEnded() { return songDone; },
    get hasSong() { return !!songBuf; },
    ambience(v) {
      if (!ctx) return;
      if (v && !amb.length) { [["AMBInd_RoomToneMachineRoom_LOOP_01", 0.5, 1], ["DSGNDron_DroneCreepy_OS_01", 0.14, 0.8]].forEach(([k, vol, r]) => { const n = play(k, { vol: 0.0001, loop: true, rate: r }); if (n) { n.g.gain.setTargetAtTime(vol, now(), 1.5); amb.push(n); } }); }
      if (!v) amb.splice(0).forEach((n) => { n.g.gain.setTargetAtTime(0.0001, now(), 0.4); setTimeout(() => { try { n.s.stop(); } catch { /* oprit */ } }, 1800); });
    },
    melody(tempo = 1) {
      if (!ctx) return; this.stopMelody(); let i = 0; const base = 523.25; const beat = 0.26 / tempo;
      const tick = () => { const n = MELODY[i % MELODY.length]; const at = now() + 0.02; if (n !== null) { tone(base * Math.pow(2, n / 12), at, 0.6, "triangle", 0.14); tone(base * 2 * Math.pow(2, n / 12), at, 0.3, "sine", 0.04); } i++; };
      tick(); tune = setInterval(tick, beat * 1000);
    },
    stopMelody() { if (tune) { clearInterval(tune); tune = null; } },
    step() { play(Math.random() < 0.5 ? "FEETHmn_ShoeMetalWalk_OS_01" : "FEETHmn_ShoeMetalWalk_OS_02", { vol: 0.35, rate: 0.9 + Math.random() * 0.2 }); },
    whoosh(vol = 0.35) { play("WHSH_WhooshMedium_OS_01", { vol, rate: 0.8 }); },
    headTurn() {
      // TOBE DE SUSPANS (sintetizate aici, fără scârțâit): 4 lovituri care se grăbesc + o bubuitură când fața se fixează
      if (!ctx) return; const at = now();
      [0, 0.17, 0.31, 0.42].forEach((d, k) => { drum(at + d, 150, 52, 0.32, 0.5 + k * 0.08); noise(at + d, 0.06, 0.16, "lowpass", 900); });
      drum(at + 0.6, 95, 30, 1.6, 0.95); drum(at + 0.6, 48, 26, 2.2, 0.55); noise(at + 0.6, 0.25, 0.22, "lowpass", 380);
      tone(55, at + 0.6, 2.4, "sawtooth", 0.035); tone(58.3, at + 0.6, 2.4, "sawtooth", 0.03); // dronă joasă, tensionată
    },
    alarm() { if (!ctx) return; const at = now(); for (let k = 0; k < 3; k++) { tone(196, at + k * 0.34, 0.24, "square", 0.07); tone(98, at + k * 0.34, 0.24, "sawtooth", 0.05); } },
    eyes() { if (!ctx) return; const at = now(); const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(140, at); o.frequency.exponentialRampToValueAtTime(1400, at + 0.6); env(o, at, 0.05, 0.7, 0.08); o.start(at); o.stop(at + 0.8); },
    scan() { if (!ctx) return; const at = now(); for (let k = 0; k < 10; k++) tone(1200 + (k % 2) * 300, at + k * 0.3, 0.08, "sine", 0.03);
      for (let k = 0; k < 4; k++) { const d = k * 0.7; drum(at + d, 110, 45, 0.28, 0.45); drum(at + d + 0.2, 100, 42, 0.3, 0.32); } }, // „bătăi de inimă”
    caught() { if (!ctx) return; const at = now(); noise(at, 0.15, 0.3, "highpass", 2200); const o = tone(420, at, 0.3, "square", 0.07); o.frequency.exponentialRampToValueAtTime(110, at + 0.3); },
    heartbeat() { if (!ctx) return; const at = now(); tone(55, at, 0.13, "sine", 0.4); tone(48, at + 0.24, 0.15, "sine", 0.32); },
    eliminate() { if (!ctx) return; const at = now(); noise(at, 1.6, 0.45, "lowpass", 160); const o = tone(120, at, 1.8, "sine", 0.45, 0.02); o.frequency.exponentialRampToValueAtTime(28, at + 1.8); play("WHSH_WhooshMedium_OS_01", { vol: 0.5, rate: 0.5, delay: 0.3 }); },
    sprint(withVoice = true) { if (!ctx) return; const at = now(); [0, 4, 7, 12, 16].forEach((s, k) => tone(659 * Math.pow(2, s / 12), at + k * 0.07, 0.4, "triangle", 0.1)); if (withVoice) play("VOXEfrt_Male01Effort_OS_01", { vol: 0.35 }); },
    finisher() { if (!ctx) return; const at = now(); [0, 4, 7, 12, 16, 19].forEach((s, k) => { tone(392 * Math.pow(2, s / 12), at + k * 0.12, 0.9, "sawtooth", 0.045); tone(392 * Math.pow(2, s / 12), at + k * 0.12, 1.1, "triangle", 0.09); }); tone(98, at, 1.6, "sine", 0.25); },
    safe() { if (!ctx) return; const at = now(); [0, 7, 12, 19].forEach((s, k) => tone(587 * Math.pow(2, s / 12), at + k * 0.1, 0.9, "sine", 0.08)); },
    reveal() { if (!ctx) return; const at = now(); tone(82, at, 0.7, "sawtooth", 0.08); noise(at, 0.4, 0.25, "lowpass", 500); },
    dispose() { this.stopSong(); this.stopMelody(); this.ambience(false); if (ctx) { const c = ctx; ctx = null; setTimeout(() => c.close().catch(() => {}), 2000); } },
  };
}

// ══════════════════════════════════════════════════════════════════
// TEXTURI (desenate în cod — fără imagini externe)
// ══════════════════════════════════════════════════════════════════
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
  const t = new T.CanvasTexture(c); if (srgb) t.encoding = T.sRGBEncoding; t.anisotropy = 4; return t;
}
const radial = (stops) => (g, w, h) => { const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); stops.forEach(([o, c]) => r.addColorStop(o, c)); g.fillStyle = r; g.fillRect(0, 0, w, h); };

function floorTex(low) {
  const W = low ? 512 : 1024; const H = W * 2;
  return canvasTex(W, H, (g, w, h) => {
    g.fillStyle = "#d4bb92"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < (low ? 4000 : 14000); i++) { const v = 140 + Math.random() * 70; g.fillStyle = `rgba(${v + 22},${v + 10},${v - 4},${Math.random() * 0.35})`; const s = 1 + Math.random() * 5; g.fillRect(Math.random() * w, Math.random() * h, s, s); }
    for (let i = 0; i < 22; i++) { g.fillStyle = `rgba(120,90,50,${0.04 + Math.random() * 0.06})`; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 40 + Math.random() * 160, 20 + Math.random() * 90, Math.random() * 3, 0, Math.PI * 2); g.fill(); }
    // planul acoperă z ∈ [+30 (aproape), −40 (spre păpușă)]; partea de sus a texturii = capătul îndepărtat (−40)
    const zToY = (z) => ((z + 40) / 70) * h;
    g.textAlign = "center"; g.textBaseline = "middle";
    for (let s = 1; s < RL_FINISH_STEPS; s++) {
      const y = zToY(zForSteps(s)); const pts = s >= 7; g.fillStyle = pts ? "rgba(205,150,35,0.75)" : "rgba(95,72,45,0.2)"; g.fillRect(w * 0.12, y - (pts ? 3 : 1.5), w * 0.76, pts ? 6 : 3);
      g.font = `900 ${Math.round(w * 0.032)}px sans-serif`; g.fillStyle = "rgba(95,72,45,0.55)"; g.fillText(String(s), w * 0.09, y); g.fillText(String(s), w * 0.91, y);
    }
    const ys = zToY(START_Z); g.fillStyle = "#f3efe6"; g.fillRect(w * 0.08, ys - 7, w * 0.84, 14);
    g.font = `900 ${Math.round(w * 0.09)}px sans-serif`; g.fillStyle = "rgba(255,255,255,0.95)"; g.fillText("START", w / 2, ys + w * 0.075);
    const yf = zToY(FINISH_Z); g.font = `900 ${Math.round(w * 0.08)}px sans-serif`; g.fillStyle = "rgba(255,70,80,0.9)"; g.fillText("FINISH", w / 2, yf - w * 0.06);
  });
}

function rustTex() {
  return canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = "#4a4e52"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { const v = 50 + Math.random() * 50; g.fillStyle = `rgba(${v + 30},${v + 8},${v - 10},${Math.random() * 0.25})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2 + Math.random() * 3); }
    for (let i = 0; i < 70; i++) { const x = Math.random() * w; const y0 = Math.random() * h; const gr = g.createLinearGradient(0, y0, 0, y0 + 60 + Math.random() * 160); gr.addColorStop(0, "rgba(120,58,28,0.45)"); gr.addColorStop(1, "rgba(120,58,28,0)"); g.fillStyle = gr; g.fillRect(x, y0, 2 + Math.random() * 4, 220); }
  });
}

// Fața păpușii (porțelan crăpat, orbite adânci, gură cusută, ciobitură) — DESEN PROPRIU.
// Textura se întinde în jurul capului (u = unghiul), cu fața în centru (u = 0,5 → spre jucători).
function faceTextures() {
  const W = 1024; const H = 512; const cx = W / 2; const eyeY = H * 0.43; const eyeDX = W * 0.085;
  const map = canvasTex(W, H, (g) => {
    const base = g.createLinearGradient(0, 0, 0, H); base.addColorStop(0, "#e9e3d8"); base.addColorStop(1, "#cfc7b9"); g.fillStyle = base; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 6000; i++) { g.fillStyle = `rgba(90,80,70,${Math.random() * 0.05})`; g.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
    for (const sx of [-1, 1]) {
      const og = g.createRadialGradient(cx + sx * eyeDX, eyeY, 4, cx + sx * eyeDX, eyeY, 70); og.addColorStop(0, "rgba(20,10,10,0.95)"); og.addColorStop(0.55, "rgba(40,24,22,0.55)"); og.addColorStop(1, "rgba(60,40,36,0)");
      g.fillStyle = og; g.beginPath(); g.ellipse(cx + sx * eyeDX, eyeY, 68, 46, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#16090a"; g.beginPath(); g.ellipse(cx + sx * eyeDX, eyeY, 30, 22, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "rgba(25,15,15,0.8)"; g.lineWidth = 3; for (let k = 0; k < 7; k++) { const a = Math.PI * (1.1 + k * 0.11); g.beginPath(); g.moveTo(cx + sx * eyeDX + Math.cos(a) * 34, eyeY + Math.sin(a) * 26); g.lineTo(cx + sx * eyeDX + Math.cos(a) * 46, eyeY + Math.sin(a) * 38); g.stroke(); }
    }
    g.fillStyle = "rgba(70,40,40,0.35)"; g.beginPath(); g.ellipse(cx, H * 0.6, 10, 22, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#2a1414"; g.lineWidth = 6; g.beginPath(); g.moveTo(cx - 52, H * 0.73); g.quadraticCurveTo(cx, H * 0.75, cx + 52, H * 0.73); g.stroke();
    g.strokeStyle = "#5c5550"; g.lineWidth = 3; for (let k = -4; k <= 4; k++) { g.beginPath(); g.moveTo(cx + k * 12, H * 0.70); g.lineTo(cx + k * 12 + 3, H * 0.77); g.stroke(); }
    g.strokeStyle = "rgba(35,22,18,0.9)"; g.lineWidth = 2.5;
    const crack = (x, y, n, dx) => { g.beginPath(); g.moveTo(x, y); for (let i = 0; i < n; i++) { x += dx * (6 + Math.random() * 18) + (Math.random() - 0.5) * 14; y += 10 + Math.random() * 20; g.lineTo(x, y); } g.stroke(); };
    crack(cx + 30, 0, 14, 0.4); crack(cx - 120, H * 0.08, 10, -0.3); crack(cx + eyeDX + 20, eyeY + 30, 8, 0.6); crack(cx - 10, H * 0.52, 7, -0.5);
    g.fillStyle = "#120808"; g.beginPath(); g.moveTo(cx - eyeDX - 60, H * 0.55); g.lineTo(cx - eyeDX - 18, H * 0.58); g.lineTo(cx - eyeDX - 30, H * 0.66); g.lineTo(cx - eyeDX - 70, H * 0.63); g.closePath(); g.fill();
    g.fillStyle = "#3e3a37"; g.fillRect(0, 0, W * 0.2, H); g.fillRect(W * 0.8, 0, W * 0.2, H);
  });
  const emit = canvasTex(W, H, (g) => {
    g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
    for (const sx of [-1, 1]) { const r = g.createRadialGradient(cx + sx * eyeDX, eyeY, 0, cx + sx * eyeDX, eyeY, 26); r.addColorStop(0, "#ffffff"); r.addColorStop(0.3, "#ff3040"); r.addColorStop(1, "rgba(120,0,0,0)"); g.fillStyle = r; g.fillRect(cx + sx * eyeDX - 30, eyeY - 30, 60, 60); }
  });
  return { map, emit, eyeV: 1 - 0.43, eyeU: eyeDX / W };
}

function loadImage(src) {
  return new Promise((res) => {
    if (!src) return res(null);
    const im = new Image(); im.crossOrigin = "anonymous"; im.decoding = "async";
    const to = setTimeout(() => res(null), 6000);
    im.onload = () => { clearTimeout(to); res(im); }; im.onerror = () => { clearTimeout(to); res(null); }; im.src = src;
  });
}
// Medalionul de identitate: avatarul ORIGINAL, decupat circular (imaginea nu e modificată).
function medallionTex(img, p) {
  return canvasTex(256, 256, (g, w) => {
    g.clearRect(0, 0, w, w); g.save(); g.beginPath(); g.arc(w / 2, w / 2, w * 0.44, 0, Math.PI * 2); g.clip();
    if (img) { const s3 = isS3Avatar(p.avatarId); const side = Math.min(img.width, img.height); const sx = (img.width - side) / 2; const sy = s3 ? Math.max(0, img.height * 0.04) : (img.height - side) / 2; g.drawImage(img, sx, sy, side, side, w * 0.06, w * 0.06, w * 0.88, w * 0.88); }
    else { g.fillStyle = "#1d4a3c"; g.fillRect(0, 0, w, w); g.fillStyle = "#fff"; g.font = "900 110px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText((p.nick || "?").charAt(0).toUpperCase(), w / 2, w / 2 + 6); }
    g.restore();
  });
}

// Fascicul de lumină: con transparent, luminos în centru, stins spre margini și spre capăt.
function shaftMaterial(color, alpha) {
  return new T.ShaderMaterial({
    transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
    uniforms: { c: { value: new T.Color(color) }, a: { value: alpha } },
    vertexShader: "varying float vY; varying float vF; void main(){ vY = uv.y; vec4 mv = modelViewMatrix*vec4(position,1.); vec3 n = normalize(normalMatrix*normal); vF = abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix*mv; }",
    fragmentShader: "uniform vec3 c; uniform float a; varying float vY; varying float vF; void main(){ float k = pow(vY, 1.6) * pow(vF, 1.4) * a; gl_FragColor = vec4(c*k, k); }",
  });
}

// ══════════════════════════════════════════════════════════════════
// SCENA
// ══════════════════════════════════════════════════════════════════
export function createRedLightScene(container, assets, { low: forceLow, onFps } = {}) {
  const deviceLow = (navigator.hardwareConcurrency || 8) < 6 || (navigator.deviceMemory || 8) < 4;
  let LOW = forceLow ?? deviceLow;
  const canvas = document.createElement("canvas"); canvas.style.cssText = "display:block;width:100%;height:100%;touch-action:none";
  container.appendChild(canvas);
  let renderer;
  try { renderer = new T.WebGLRenderer({ canvas, antialias: !LOW, powerPreference: "high-performance" }); } catch { container.removeChild(canvas); return null; }
  renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const kit = createCharacterKit(assets);

  const scene = new T.Scene();
  const FOG = { base: new T.Color(0xe6dccb), red: new T.Color(0xd9b7a8), green: new T.Color(0xe2e2c6), gold: new T.Color(0xeedcae) };
  scene.background = FOG.base.clone(); scene.fog = new T.FogExp2(FOG.base.clone(), 0.006);
  const camera = new T.PerspectiveCamera(60, 1, 0.1, 400);
  const disposables = [];
  const keep = (x) => { disposables.push(x); return x; };

  // ── Mediu pentru reflexii metalice (panouri colorate, ca un studio) ──
  { const env = new T.Scene(); env.background = new T.Color(0x05080a);
    const pnl = (w, h, c, x, y, z) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: c, side: T.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m); };
    pnl(10, 2, 0xfff1dc, 0, 9, 0); pnl(3, 8, 0xff2a3a, -9, 2, -3); pnl(3, 8, 0x22d3c5, 9, 2, -3); pnl(8, 2, 0xffc070, 0, 1, 9);
    const pm = new T.PMREMGenerator(renderer); scene.environment = keep(pm.fromScene(env, 0.04).texture); pm.dispose();
    env.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); }); }

  // ── Lumini ──
  const hemi = new T.HemisphereLight(0xcfe6ff, 0xb8976a, 0.9); scene.add(hemi);
  const key = new T.DirectionalLight(0xfff0d8, 2.1); key.position.set(-16, 30, 20); key.target.position.set(0, 0, -8); scene.add(key, key.target);
  key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -16, right: 16, top: 30, bottom: -30, near: 5, far: 90 }); key.shadow.bias = -0.0005;
  const tealRim = new T.SpotLight(0xfff3e0, 0.6, 90, 0.55, 0.6, 1.2); tealRim.position.set(-18, 16, 14); tealRim.target.position.set(2, 0, -6); scene.add(tealRim, tealRim.target);
  const redBack = new T.SpotLight(0xff2a36, 2.4, 110, 0.6, 0.7, 1.0); redBack.position.set(0, 26, DOLL_Z - 14); redBack.target.position.set(0, 2, 0); scene.add(redBack, redBack.target);
  const dollUp = new T.SpotLight(0xffe7c8, 0.8, 60, 0.42, 0.7, 1.1); dollUp.position.set(0, 0.5, DOLL_Z + 13); dollUp.target.position.set(0, HEAD_Y * 0.62, DOLL_Z); scene.add(dollUp, dollUp.target);
  const eyeLight = new T.PointLight(0xff1a28, 0, 40, 2); eyeLight.position.set(0, HEAD_Y, DOLL_Z + 3.5); scene.add(eyeLight);
  const goldLight = new T.SpotLight(0xffc24a, 0, 30, 0.35, 0.6, 1.2); goldLight.position.set(0, 14, FINISH_Z + 4); scene.add(goldLight, goldLight.target);

  // ── Terenul ──
  const fTex = keep(floorTex(LOW));
  const floor = new T.Mesh(new T.PlaneGeometry(30, 70), new T.MeshStandardMaterial({ map: fTex, roughness: 0.92, metalness: 0.02 }));
  floor.rotation.x = -Math.PI / 2; floor.position.z = -5; floor.receiveShadow = true; scene.add(floor);
  const apron = new T.Mesh(new T.PlaneGeometry(140, 160), new T.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 }));
  apron.rotation.x = -Math.PI / 2; apron.position.set(0, -0.03, -20); apron.receiveShadow = true; scene.add(apron);
  Object.entries(RL_POINTS_TABLE).forEach(([s, pts]) => {
    const st = Number(s); const fin = st >= RL_FINISH_STEPS;
    const c = document.createElement("canvas"); c.width = 256; c.height = 128; const g = c.getContext("2d");
    g.fillStyle = fin ? "#c9142c" : "#111418"; g.strokeStyle = "#e0bc4a"; g.lineWidth = 6;
    g.beginPath(); g.roundRect ? g.roundRect(4, 4, 248, 120, 18) : g.rect(4, 4, 248, 120); g.fill(); g.stroke();
    g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#e0bc4a"; g.font = "700 34px Oswald, 'Arial Narrow', Arial, sans-serif";
    g.fillText(fin ? "FINISH" : `${st} PAȘI`, 128, 40); g.fillStyle = "#ffffff"; g.font = "800 50px Oswald, 'Arial Narrow', Arial, sans-serif"; g.fillText(`${pts} PCT`, 128, 88);
    const tt = keep(new T.CanvasTexture(c)); tt.encoding = T.sRGBEncoding;
    const sign = new T.Sprite(new T.SpriteMaterial({ map: tt, transparent: true, toneMapped: false }));
    sign.scale.set(2.3, 1.15, 1); sign.position.set(-13.4, 1.0, zForSteps(st)); scene.add(sign);
    const post = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 0.5, 6), new T.MeshStandardMaterial({ color: 0x2a2a2e })); post.position.set(-13.4, 0.25, zForSteps(st)); scene.add(post);
  });
  const neonMat = new T.MeshBasicMaterial({ color: 0xff2238, toneMapped: false });
  const neon = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, LANE_W + 2, 10), neonMat); neon.rotation.z = Math.PI / 2; neon.position.set(0, 0.09, FINISH_Z); scene.add(neon);
  const glowTex = keep(canvasTex(128, 128, radial([[0, "rgba(255,255,255,1)"], [0.4, "rgba(255,255,255,0.35)"], [1, "rgba(255,255,255,0)"]])));
  const neonGlow = new T.Mesh(new T.PlaneGeometry(LANE_W + 6, 3.2), new T.MeshBasicMaterial({ map: glowTex, color: 0xff2238, transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false }));
  neonGlow.rotation.x = -Math.PI / 2; neonGlow.position.set(0, 0.03, FINISH_Z); scene.add(neonGlow);
  const startNeon = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, LANE_W + 2, 8), new T.MeshBasicMaterial({ color: 0xbff8ff, toneMapped: false })); startNeon.rotation.z = Math.PI / 2; startNeon.position.set(0, 0.06, START_Z + 0.25); scene.add(startNeon);

  // ── DECOR EXTERIOR (zi): cer, ziduri înalte, nisip, un copac generic ──
  const rTex = keep(rustTex()); rTex.wrapS = rTex.wrapT = T.RepeatWrapping;
  const m4 = new T.Matrix4();
  // cerul: cupolă cu gradient (nu e afectată de ceață)
  const skyMat = new T.ShaderMaterial({ side: T.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new T.Color(0x5b9fe0) }, mid: { value: new T.Color(0xbfe0f7) }, bot: { value: new T.Color(0xf2e6cf) } },
    vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }",
    fragmentShader: "uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.08 ? mix(mid, top, smoothstep(0.08, 0.6, h)) : mix(bot, mid, smoothstep(-0.05, 0.08, h)); gl_FragColor = vec4(c, 1.); }" });
  const sky = new T.Mesh(new T.SphereGeometry(320, 32, 16), skyMat); sky.renderOrder = -1; scene.add(sky);
  // zidurile înalte care închid arena (tencuială deschisă la culoare, cu un brâu)
  const plasterTex = keep(canvasTex(256, 256, (g, w, h) => { g.fillStyle = "#d9cdb8"; g.fillRect(0, 0, w, h); for (let i = 0; i < 3000; i++) { const v = 170 + Math.random() * 50; g.fillStyle = `rgba(${v},${v - 12},${v - 30},${Math.random() * 0.25})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } for (let i = 0; i < 18; i++) { const x = Math.random() * w; const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "rgba(120,100,80,0.0)"); gr.addColorStop(1, "rgba(120,100,80,0.18)"); g.fillStyle = gr; g.fillRect(x, 0, 6 + Math.random() * 10, h); } }));
  plasterTex.wrapS = plasterTex.wrapT = T.RepeatWrapping; plasterTex.repeat.set(8, 2);
  const wallMat = new T.MeshStandardMaterial({ color: 0xffffff, map: plasterTex, roughness: 0.95, metalness: 0 });
  const trimMat = new T.MeshStandardMaterial({ color: 0x8c7a62, roughness: 0.8 });
  const WALL_H = 13;
  const wall = (w, x, z, ry) => { const m = new T.Mesh(new T.BoxGeometry(w, WALL_H, 1.2), wallMat); m.position.set(x, WALL_H / 2, z); m.rotation.y = ry; m.receiveShadow = true; scene.add(m); const t = new T.Mesh(new T.BoxGeometry(w, 0.5, 1.5), trimMat); t.position.set(x, WALL_H + 0.25, z); t.rotation.y = ry; scene.add(t); };
  wall(64, 0, DOLL_Z - 12, 0); wall(64, 0, 34, 0); wall(68, -31, 0, Math.PI / 2); wall(68, 31, 0, Math.PI / 2);
  // copac generic (trunchi + ramuri + coroane rare), lângă locul păpușii
  const tree = new T.Group(); tree.position.set(6.5, 0, DOLL_Z - 2.5); scene.add(tree);
  const barkMat = new T.MeshStandardMaterial({ color: 0x5a4636, roughness: 0.95 });
  const leafMat = new T.MeshStandardMaterial({ color: 0x6b7d3c, roughness: 0.9, flatShading: true });
  function branch(parent, len, rad, depth) {
    const g = new T.CylinderGeometry(rad * 0.62, rad, len, 7); g.translate(0, len / 2, 0);
    const b = new T.Mesh(g, barkMat); b.castShadow = !LOW; parent.add(b);
    if (depth <= 0) { const leaf = new T.Mesh(new T.IcosahedronGeometry(0.9 + Math.random() * 0.6, 0), leafMat); leaf.position.y = len; leaf.castShadow = !LOW; b.add(leaf); return; }
    const n = depth > 2 ? 3 : 2;
    for (let i = 0; i < n; i++) { const c = new T.Group(); c.position.y = len * (0.7 + Math.random() * 0.25); c.rotation.set((Math.random() - 0.5) * 1.3, (i / n) * Math.PI * 2 + Math.random(), 0.45 + Math.random() * 0.4); b.add(c); branch(c, len * 0.68, rad * 0.6, depth - 1); }
  }
  branch(tree, 5.5, 0.55, 4);
  // câmp exterior (nisip) dincolo de teren
  const sandTex = keep(canvasTex(256, 256, (g, w, h) => { g.fillStyle = "#cdb48b"; g.fillRect(0, 0, w, h); for (let i = 0; i < 5000; i++) { const v = 150 + Math.random() * 70; g.fillStyle = `rgba(${v + 30},${v + 10},${v - 30},${Math.random() * 0.4})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }));
  sandTex.wrapS = sandTex.wrapT = T.RepeatWrapping; sandTex.repeat.set(20, 20);
  apron.material.map = sandTex; apron.material.needsUpdate = true;
  // obiecte vechi păstrate ca „goale” (bucla de randare le folosește)
  const blades = new T.Group(); const fanGlowMat = keep(new T.MeshBasicMaterial());
  const fogCards = [];
  let dust = null;
  { const n = 300; const g = new T.BufferGeometry(); const a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = (Math.random() - 0.5) * 40; a[i * 3 + 1] = Math.random() * 8; a[i * 3 + 2] = 20 - Math.random() * 60; } g.setAttribute("position", new T.BufferAttribute(a, 3));
    dust = new T.Points(g, new T.PointsMaterial({ map: glowTex, color: 0xfff1d6, size: 0.08, transparent: true, opacity: 0.35, depthWrite: false })); scene.add(dust); }

  // ── Zonele SAFE și FINISHERS ──
  const safePad = new T.Mesh(new T.BoxGeometry(4.2, 0.18, 9), new T.MeshStandardMaterial({ color: 0x0b2a26, emissive: 0x0f6f5f, emissiveIntensity: 0.55, metalness: 0.5, roughness: 0.4 }));
  safePad.position.set(-14.2, 0.09, START_Z - 3); safePad.receiveShadow = true; scene.add(safePad);
  const finPad = new T.Mesh(new T.BoxGeometry(LANE_W, 0.22, 4.4), new T.MeshStandardMaterial({ color: 0x2a1e06, emissive: 0x7a5200, emissiveIntensity: 0.55, metalness: 0.8, roughness: 0.3 }));
  finPad.position.set(0, 0.11, FINISH_Z - 4.4); finPad.receiveShadow = true; scene.add(finPad);
  const signTex = (txt, fg) => keep(canvasTex(1024, 192, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = fg; g.font = "900 120px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(txt, w / 2, h / 2 + 6); }));
  const finSign = new T.Mesh(new T.PlaneGeometry(9, 1.7), new T.MeshBasicMaterial({ map: signTex("FINISHERS", "#ffcf4a"), transparent: true, toneMapped: false })); finSign.position.set(0, 3.6, FINISH_Z - 6.9); scene.add(finSign);
  const safeSign = new T.Mesh(new T.PlaneGeometry(4, 0.75), new T.MeshBasicMaterial({ map: signTex("SAFE", "#5dffd2"), transparent: true, toneMapped: false })); safeSign.position.set(-14.2, 2.6, START_Z - 7.8); safeSign.rotation.y = 0.5; scene.add(safeSign);

  // ── Semafoare laterale ──
  const tl = [];
  for (const sx of [-1, 1]) {
    const box = new T.Mesh(new T.BoxGeometry(1.8, 4, 0.9), new T.MeshStandardMaterial({ color: 0x111316, metalness: 0.8, roughness: 0.4 })); box.position.set(sx * 13.5, 9, FINISH_Z - 2); scene.add(box);
    const g = new T.Mesh(new T.CircleGeometry(0.62, 32), new T.MeshBasicMaterial({ color: 0x0c2a17, toneMapped: false })); g.position.set(sx * 13.5, 8.05, FINISH_Z - 1.53); scene.add(g);
    const r = new T.Mesh(new T.CircleGeometry(0.62, 32), new T.MeshBasicMaterial({ color: 0x2a0a0c, toneMapped: false })); r.position.set(sx * 13.5, 9.9, FINISH_Z - 1.53); scene.add(r);
    tl.push({ g, r });
  }

  // ══ PĂPUȘA — santinelă mecanică ORIGINALĂ (porțelan crăpat + fier oxidat) ══
  const doll = new T.Group(); doll.position.set(0, 0, DOLL_Z); scene.add(doll);
  const iron = new T.MeshStandardMaterial({ color: 0x3d4247, map: rTex, metalness: 0.82, roughness: 0.42 });
  const darkIron = new T.MeshStandardMaterial({ color: 0x1d2024, metalness: 0.75, roughness: 0.5 });
  const brass = new T.MeshStandardMaterial({ color: 0x8a6a34, metalness: 0.9, roughness: 0.35 });
  const add = (geo, mat, x, y, z, parent = doll, cast = true) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast && !LOW; m.receiveShadow = true; parent.add(m); return m; };
  const lathe = (pts, seg = 48, pleats = 0, amp = 0) => { const g = new T.LatheGeometry(pts.map(([r, y]) => new T.Vector2(r, y)), seg); if (pleats) { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i); const z = p.getZ(i); const a = Math.atan2(x, z); const k = 1 + amp * Math.sin(a * pleats); p.setX(i, x * k); p.setZ(i, z * k); } g.computeVertexNormals(); } return g; };
  add(new T.CylinderGeometry(5.6, 6.2, 1.0, 48), darkIron, 0, 0.5, 0);
  const ringLights = new T.Mesh(new T.TorusGeometry(5.9, 0.08, 6, 64), new T.MeshBasicMaterial({ color: 0xff2a36, toneMapped: false })); ringLights.rotation.x = Math.PI / 2; ringLights.position.y = 1.02; doll.add(ringLights);
  // rochia de plăci de fier, plisată
  add(lathe([[4.6, 1.0], [4.7, 1.3], [4.3, 2.6], [3.6, 4.6], [2.9, 6.4], [2.3, 7.8], [2.0, 8.4]], 64, 18, 0.045), iron, 0, 0, 0);
  for (const y of [2.0, 4.2, 6.2]) { const rr = 4.45 - (y - 1.3) * 0.36; const band = new T.Mesh(new T.TorusGeometry(rr, 0.09, 6, 64), brass); band.rotation.x = Math.PI / 2; band.position.y = y; doll.add(band); }
  // corsetul + „inima” de foc din piept
  add(lathe([[2.0, 8.4], [2.2, 9.4], [2.4, 10.5], [2.55, 11.2], [2.2, 11.8], [1.2, 12.3]], 48), iron, 0, 0, 0);
  const coreMat = new T.MeshBasicMaterial({ color: 0xff5a1e, toneMapped: false });
  const core = new T.Mesh(new T.CircleGeometry(0.85, 32), coreMat); core.position.set(0, 10.4, 2.43); doll.add(core);
  for (let k = -3; k <= 3; k++) add(new T.BoxGeometry(0.1, 1.9, 0.12), darkIron, k * 0.26, 10.4, 2.5, doll, false);
  { const rv = new T.InstancedMesh(new T.SphereGeometry(0.075, 6, 5), brass, 96); let i = 0;
    for (const [y, r] of [[8.7, 2.08], [9.8, 2.32], [11.0, 2.5]]) for (let k = 0; k < 32; k++) { const a = (k / 32) * Math.PI * 2; m4.makeTranslation(Math.sin(a) * r, y, Math.cos(a) * r); rv.setMatrixAt(i++, m4); }
    doll.add(rv); }
  // umerii și brațele lungi, articulate
  const arms = [];
  for (const sx of [-1, 1]) {
    add(new T.SphereGeometry(1.05, 24, 16), iron, sx * 2.55, 11.4, 0);
    const shoulder = new T.Group(); shoulder.position.set(sx * 2.75, 11.2, 0.1); doll.add(shoulder);
    add(new T.CylinderGeometry(0.42, 0.36, 3.6, 16), iron, 0, -1.9, 0, shoulder);
    const elbow = new T.Group(); elbow.position.set(0, -3.8, 0); shoulder.add(elbow);
    add(new T.SphereGeometry(0.5, 16, 12), brass, 0, 0, 0, elbow);
    add(new T.CylinderGeometry(0.34, 0.28, 3.4, 16), iron, 0, -1.8, 0, elbow);
    const hand = new T.Group(); hand.position.set(0, -3.6, 0); elbow.add(hand);
    add(new T.BoxGeometry(0.75, 0.6, 0.38), darkIron, 0, 0, 0, hand);
    for (let f = 0; f < 4; f++) { const fg = add(new T.CapsuleGeometry(0.07, 1.0, 4, 8), darkIron, (f - 1.5) * 0.17, -0.85, 0.04, hand); fg.rotation.x = 0.18 + f * 0.04; }
    shoulder.rotation.z = sx * 0.1; shoulder.rotation.x = -0.12; elbow.rotation.x = -0.32;
    arms.push({ shoulder, elbow, sx });
  }
  // gâtul: discuri, pistoane și un angrenaj care se rotește
  const neck = new T.Group(); neck.position.set(0, 12.3, 0); doll.add(neck);
  for (let k = 0; k < 4; k++) add(new T.CylinderGeometry(0.75 - k * 0.04, 0.8 - k * 0.04, 0.24, 24), k % 2 ? brass : darkIron, 0, 0.18 + k * 0.28, 0, neck);
  for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + 0.4; add(new T.CylinderGeometry(0.09, 0.09, 1.3, 8), brass, Math.sin(a) * 0.95, 0.7, Math.cos(a) * 0.95, neck); }
  const gear = new T.Group(); gear.position.y = 0.55; neck.add(gear);
  add(new T.TorusGeometry(1.15, 0.16, 8, 32), brass, 0, 0, 0, gear).rotation.x = Math.PI / 2;
  for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; const tth = add(new T.BoxGeometry(0.22, 0.24, 0.3), brass, Math.sin(a) * 1.36, 0, Math.cos(a) * 1.36, gear, false); tth.rotation.y = a; }
  // capul: craniu de porțelan (fața e pictată pe textură) + bonetă rigidă de metal
  const head = new T.Group(); head.position.set(0, HEAD_Y - 12.3, 0); neck.add(head);
  const face = faceTextures(); keep(face.map); keep(face.emit);
  const skullPts = []; for (let i = 0; i <= 24; i++) { const t = (i / 24) * Math.PI; const r = 1.62 * Math.sin(t) * (1 - 0.2 * Math.max(0, -Math.cos(t))); skullPts.push([Math.max(0.001, r), -1.95 * Math.cos(t)]); }
  const porcelain = new T.MeshStandardMaterial({ map: face.map, emissiveMap: face.emit, emissive: 0xff2030, emissiveIntensity: 0, roughness: 0.3, metalness: 0.02 });
  // LatheGeometry cu phiStart = π: u = 0,5 cade pe +z (fața, spre jucători)
  add(new T.LatheGeometry(skullPts.map(([r, y]) => new T.Vector2(r, y)), 64, Math.PI), porcelain, 0, 0, 0, head);
  const bonnetPts = skullPts.filter(([, y]) => y > -0.35).map(([r, y]) => new T.Vector2(r * 1.1 + 0.06, y * 1.06 + 0.1));
  add(new T.LatheGeometry(bonnetPts, 48, Math.PI * 0.42, Math.PI * 1.16), iron, 0, 0, 0, head); // centrată pe ceafă (−z)
  for (let k = 0; k < 9; k++) { const a = Math.PI * (0.48 + k * 0.13); add(new T.SphereGeometry(0.07, 6, 5), brass, Math.sin(a) * 1.85, 0.5, Math.cos(a) * 1.85, head, false); }
  add(new T.ConeGeometry(0.28, 1.1, 8), iron, 0, 2.55, -0.2, head);
  // halouri pentru ochi
  const eyeGlowMat = new T.SpriteMaterial({ map: glowTex, color: 0xff2030, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false });
  const eyeAng = face.eyeU * Math.PI * 2; const eyeLocalY = -1.95 * Math.cos(face.eyeV * Math.PI);
  for (const sx of [-1, 1]) { const sp = new T.Sprite(eyeGlowMat); sp.scale.set(2.0, 2.0, 1); sp.position.set(sx * Math.sin(eyeAng) * 1.7, eyeLocalY, Math.cos(eyeAng) * 1.7); head.add(sp); }
  // fasciculele de scanare din ochi
  const beamMat = shaftMaterial(0xff1e2e, 0); const beams = [];
  for (const sx of [-1, 1]) { const g = new T.ConeGeometry(1.7, 46, 24, 1, true); g.translate(0, -23, 0); g.rotateX(-Math.PI / 2); const b = new T.Mesh(g, beamMat); b.position.set(sx * 0.5, HEAD_Y + eyeLocalY, DOLL_Z + 1.5); scene.add(b); beams.push(b); }
  head.rotation.y = Math.PI; // pornește cu spatele (lumina verde)
  // ținta rotirii: capul păpușii V2 sau piesa configurată din modelul extern (slotul doll.glb)
  const turn = { obj: head, axis: "y", front: 0, back: Math.PI };
  let headY = HEAD_Y; let beamY = beams[0].position.y; let beamZ = beams[0].position.z;

  // ── Particule ──
  const bursts = [];
  function burst(pos, color, n = 60, speed = 4, life = 1.6, size = 0.18, up = 1) {
    if (LOW) n = Math.round(n / 2);
    const g = new T.BufferGeometry(); const a = new Float32Array(n * 3); const v = [];
    for (let i = 0; i < n; i++) { a.set([pos.x + (Math.random() - 0.5) * 0.5, pos.y + Math.random() * 1.7, pos.z + (Math.random() - 0.5) * 0.5], i * 3); v.push(new T.Vector3((Math.random() - 0.5) * speed, Math.random() * speed * Math.abs(up), (Math.random() - 0.5) * speed)); }
    g.setAttribute("position", new T.BufferAttribute(a, 3));
    const p = new T.Points(g, new T.PointsMaterial({ map: glowTex, color, size, transparent: true, opacity: 1, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }));
    scene.add(p); bursts.push({ p, v, life, max: life, grav: up > 0 ? 4 : -0.6 });
  }

  // ══ PARTICIPANȚII ══
  const players = new Map();
  let laneCount = 18;
  const laneX = (lane) => { const wd = Math.min(LANE_W - 1, laneCount * 1.25); return -wd / 2 + (lane + 0.5) * (wd / laneCount); };
  const shadowTex = keep(canvasTex(64, 64, radial([[0, "rgba(0,0,0,0.75)"], [1, "rgba(0,0,0,0)"]]), false));
  const medal = (() => {
    const grp = new T.Group(); grp.visible = false; scene.add(grp);
    const disc = new T.Mesh(new T.CircleGeometry(0.42, 40), new T.MeshBasicMaterial({ transparent: true, toneMapped: false, depthTest: false })); disc.renderOrder = 10; grp.add(disc);
    const ringMat = new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, depthTest: false }); const ring = new T.Mesh(new T.RingGeometry(0.43, 0.49, 48), ringMat); ring.renderOrder = 10; grp.add(ring);
    const halo = new T.Mesh(new T.PlaneGeometry(1.6, 1.6), new T.MeshBasicMaterial({ map: glowTex, color: 0xffffff, transparent: true, opacity: 0.35, blending: T.AdditiveBlending, depthWrite: false })); halo.position.z = -0.02; grp.add(halo);
    return { grp, disc, ringMat, halo, uid: null };
  })();
  let safeN = 0; let finN = 0;
  function homeOf(p) {
    if (p.status === RL_STATUS.SAFE) { if (p.safeSlot === undefined) p.safeSlot = safeN++; const i = p.safeSlot; return new T.Vector3(-15.2 + (i % 3) * 1.0, 0.18, START_Z - 6 + Math.floor(i / 3) * 1.5); }
    if (p.status === RL_STATUS.FINISHER) { if (p.finSlot === undefined) p.finSlot = finN++; const i = p.finSlot; return new T.Vector3(((i % 12) - 5.5) * 1.6, 0.22, FINISH_Z - 3.6 - Math.floor(i / 12) * 1.4); }
    return new T.Vector3(laneX(p.lane), 0, zForSteps(p.steps));
  }
  function addPlayer(uid, info, look, lane, state, mTex) {
    const n = Number(info.number);
    const h = kit.makeHuman({ num: pad3(info.number), name: info.nick || "", role: roleForNumber(n), hair: look?.bald ? "bald" : "buzzed", hairColor: "negru" });
    h.mesh.castShadow = !LOW; scene.add(h.root);
    const blob = new T.Mesh(new T.PlaneGeometry(1.1, 1.1), new T.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.8 }));
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.02; h.root.add(blob);
    if (info.number !== null && info.number !== undefined && info.number !== "") { // numărul mare, vizibil de departe
      const [bg, fg] = ROLE_TAG[roleForNumber(n)] || ROLE_TAG.player;
      const c = document.createElement("canvas"); c.width = 256; c.height = 128; const g = c.getContext("2d");
      g.fillStyle = bg; g.strokeStyle = fg; g.lineWidth = 8; g.beginPath(); g.roundRect ? g.roundRect(6, 6, 244, 116, 26) : g.rect(6, 6, 244, 116); g.fill(); g.stroke();
      g.fillStyle = fg; g.font = "800 92px Oswald, 'Arial Narrow', Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(pad3(info.number), 128, 70);
      const tt = keep(new T.CanvasTexture(c)); tt.encoding = T.sRGBEncoding;
      const tag = new T.Sprite(new T.SpriteMaterial({ map: tt, transparent: true, depthWrite: false, toneMapped: false }));
      tag.scale.set(0.84, 0.42, 1); tag.position.y = 2.12; tag.renderOrder = 5; h.root.add(tag);
    }
    const p = { uid, info, h, lane, mTex, steps: state.steps, strikes: state.strikes, status: state.status, pose: "idle", poseFrom: "idle", poseT: 1, walk: Math.random() * 6, moving: false, speed: 1.4, fade: 1, flinch: 0, kneel: 0, cheer: 0, glow: 0, glowColor: new T.Color(0xff2030), ghost: false, stepAcc: 0, faceYaw: 0 };
    p.h.root.position.copy(homeOf(p)); p.target = p.h.root.position.clone();
    p.mat = p.h.mesh.material; p.mat.emissive = new T.Color(0x000000);
    players.set(uid, p); return p;
  }
  function setPose(p, name) { if (p.pose === name) return; p.poseFrom = p.pose; p.pose = name; p.poseT = 0; }
  function moveTo(p, target, speed = 1.4) { p.target = target.clone(); p.speed = speed; p.moving = true; }
  function goHome(p, speed = 1.4) { moveTo(p, homeOf(p), speed); }

  // ── Tweens + timp de scenă + SARI PESTE ──
  const tweens = []; let sceneTime = 0; const waits = []; let skipping = false;
  function tween(dur, fn, done) { const tw = { dur: Math.max(0.0001, dur), t: 0, fn, done }; if (skipping) { fn(1); done?.(); return tw; } tweens.push(tw); return tw; }
  function wait(sec) { if (skipping) return Promise.resolve(); return new Promise((res) => waits.push({ at: sceneTime + sec, res })); }
  function skipNow() { skipping = true; tweens.splice(0).forEach((tw) => { tw.fn(1); tw.done?.(); }); waits.splice(0).forEach((x) => x.res()); }
  function endSkip() { skipping = false; }

  // ══ CAMERA — cadre cu mișcare (A → B), îmbinate fluid între ele ══
  const cam = { pos: new T.Vector3(0, 34, 46), look: new T.Vector3(0, 12, DOLL_Z), shot: null, blend: 1 };
  const blendFrom = { pos: cam.pos.clone(), look: cam.look.clone() };
  function shot(def) {
    blendFrom.pos.copy(cam.pos); blendFrom.look.copy(cam.look);
    cam.shot = { ...def, t: 0 }; cam.blend = skipping ? 1 : 0;
  }
  function updateCamera(dt) {
    const s = cam.shot; if (!s) return;
    s.t = Math.min(s.dur, s.t + dt); const k = smooth(s.t / s.dur);
    const tp = s.start.pos().lerp((s.end || s.start).pos(), k); const tlk = s.start.look().lerp((s.end || s.start).look(), k);
    cam.blend = Math.min(1, cam.blend + dt / (s.blendTime ?? 0.9)); const b = smooth(cam.blend);
    cam.pos.copy(blendFrom.pos).lerp(tp, b); cam.look.copy(blendFrom.look).lerp(tlk, b);
    camera.position.copy(cam.pos); camera.position.y += Math.sin(sceneTime * 0.6) * 0.04; camera.position.x += Math.sin(sceneTime * 0.43) * 0.03;
    camera.lookAt(cam.look);
    if (s.fov && Math.abs(camera.fov - s.fov) > 0.05) { camera.fov += (s.fov - camera.fov) * Math.min(1, dt * 2); camera.updateProjectionMatrix(); }
  }
  const V = (x, y, z) => () => new T.Vector3(x, y, z);
  const ofP = (p, dx, dy, dz) => () => p.h.root.position.clone().add(new T.Vector3(dx, dy, dz));
  const fieldFront = () => { let z = START_Z; players.forEach((p) => { if (p.status === RL_STATUS.ACTIVE && !p.ghost) z = Math.min(z, p.h.root.position.z); }); return z; };
  const fieldBack = () => { let z = -99; players.forEach((p) => { if (p.status === RL_STATUS.ACTIVE && !p.ghost) z = Math.max(z, p.h.root.position.z); }); return z > -99 ? z : START_Z; };
  const fieldMid = () => { let z = 0; let n = 0; players.forEach((p) => { if (p.status === RL_STATUS.ACTIVE && !p.ghost) { z += p.h.root.position.z; n++; } }); return n ? z / n : START_Z - 6; };
  const SHOTS = {
    establish: () => ({ dur: 6.5, start: { pos: V(0, 34, 46), look: V(0, 12, DOLL_Z) }, end: { pos: V(0, 6.5, 24), look: V(0, 9.5, DOLL_Z) }, fov: 58, blendTime: 0.01 }),
    lineup: () => { const z = fieldFront() - 5.5; const zm = fieldMid(); return { dur: 5.2, start: { pos: V(-6, 3.4, z), look: V(-2, 0.9, zm) }, end: { pos: V(6, 3.6, z - 0.5), look: V(2, 0.9, zm) }, fov: 66 }; },
    behind: () => { const z = fieldBack(); return { dur: 6, start: { pos: V(0, 3.4, z + 7.5), look: V(0, 6, DOLL_Z) }, end: { pos: V(0, 2.8, z + 5), look: V(0, 7, DOLL_Z) }, fov: 64 }; },
    dollTurn: () => ({ dur: 3.2, start: { pos: V(-7, 2.2, DOLL_Z + 21), look: V(0, headY - 1, DOLL_Z) }, end: { pos: V(-4.5, 3.2, DOLL_Z + 18), look: V(0, headY, DOLL_Z) }, fov: 46 }),
    dollEyes: () => ({ dur: 2.2, start: { pos: V(1.4, headY + 0.2, DOLL_Z + 10.5), look: V(0, headY + 0.1, DOLL_Z) }, end: { pos: V(0.6, headY + 0.1, DOLL_Z + 7.6), look: V(0, headY + 0.1, DOLL_Z) }, fov: 40 }),
    scan: () => { const z = fieldMid(); return { dur: 4, start: { pos: V(4.5, headY + 1.6, DOLL_Z + 4), look: V(-1.5, 0, z) }, end: { pos: V(-4.5, headY + 1.2, DOLL_Z + 4.5), look: V(1.5, 0, z) }, fov: 60 }; },
    close: (p) => ({ dur: 2.4, start: { pos: ofP(p, 1.4, 1.7, -4.4), look: ofP(p, 0, 1.15, 0) }, end: { pos: ofP(p, 0.9, 1.6, -3.6), look: ofP(p, 0, 1.2, 0) }, fov: 52 }),
    elim: (p) => ({ dur: 4.4, start: { pos: ofP(p, -1.4, 1.9, -4.8), look: ofP(p, 0, 1.1, 0) }, end: { pos: ofP(p, -0.8, 2.8, -3.6), look: ofP(p, 0, 0.6, 0) }, fov: 54 }),
    sprint: (p) => ({ dur: 3, start: { pos: ofP(p, 4.6, 1.8, 1.0), look: ofP(p, 0, 1.0, -0.3) }, end: { pos: ofP(p, 4.0, 1.7, 0.2), look: ofP(p, 0, 1.0, -0.4) }, fov: 56, blendTime: 0.6 }),
    finisher: (p) => ({ dur: 4.6, start: { pos: ofP(p, 1.6, 2.2, 5.2), look: ofP(p, 0, 1.1, -0.5) }, end: { pos: ofP(p, 1.2, 1.9, -4.6), look: ofP(p, 0, 1.3, 0) }, fov: 56, blendTime: 0.7 }),
    safe: (p) => ({ dur: 3, start: { pos: ofP(p, 3.4, 2.4, -3.6), look: ofP(p, 0, 1.1, 0) }, end: { pos: ofP(p, 2.6, 2.1, -3.0), look: ofP(p, 0, 1.1, 0) }, fov: 54 }),
    recap: () => ({ dur: 4, start: { pos: V(0, 16, 26), look: V(0, 2, -6) }, end: { pos: V(0, 13, 22), look: V(0, 3, -8) }, fov: 58 }),
    poster: () => ({ dur: 9, start: { pos: V(-6, 3, FINISH_Z + 10), look: V(0, 8, DOLL_Z) }, end: { pos: V(6, 4, FINISH_Z + 12), look: V(0, 9, DOLL_Z) }, fov: 54 }),
  };

  // ── Lumina verde / roșie ──
  let light = "idle"; let eyes = 0; let eyesTarget = 0; let scanOn = 0; let scanAngle = 0; let goldOn = 0;
  function setLight(mode) { light = mode; tl.forEach(({ g, r }) => { g.material.color.setHex(mode === "green" ? 0x31ff86 : 0x0c2a17); r.material.color.setHex(mode === "red" ? 0xff2a36 : 0x2a0a0c); }); }
  function setEyes(v) { eyesTarget = v; }
  function setScan(on, angle) { scanOn = on; if (angle !== undefined) scanAngle = angle; }
  function setGold(v, x = 0, z = FINISH_Z) { goldOn = v; goldLight.position.set(x, 14, z + 4); goldLight.target.position.set(x, 0, z); }
  // întoarcerea capului: mecanică, în 4 „clicuri”, cu abur la gât
  function turnHead(toFront, dur = 1.6) {
    const o = turn.obj; const ax = turn.axis; const from = o.rotation[ax]; const to = toFront ? turn.front : turn.back;
    const c2 = 0.55 * 1.525; // easeInOutBack, blând: pornire ușor înapoi, oprire cu o mică depășire → mișcare naturală
    const ease = (x) => (x < 0.5 ? (Math.pow(2 * x, 2) * ((c2 + 1) * 2 * x - c2)) / 2 : (Math.pow(2 * x - 2, 2) * ((c2 + 1) * (x * 2 - 2) + c2) + 2) / 2);
    tween(dur, (t) => { const e = ease(t); o.rotation[ax] = from + (to - from) * e; gear.rotation.y = e * 4; });
    if (doll.visible) for (let k = 0; k < (LOW ? 1 : 3); k++) burst(new T.Vector3((Math.random() - 0.5) * 2, 12.6, DOLL_Z + 0.5), 0xcfd6dc, 40, 1.4, 2.2, 0.5, 1); // praful „mecanismului” doar la păpușa V2 (la modelul din slot ar acoperi fața)
  }


  // ══ SLOT 3D: public/redlight/doll.glb (+ doll.json opțional) ══
  // Orice model GLB pus de Admin înlocuiește păpușa V2. Modelul NU e modificat:
  // doar poziționat, rotit și scalat după doll.json. Dacă lipsește → rămâne păpușa V2.
  async function loadDollSlot(base) {
    let cfg = {};
    try { const r = await fetch(`${base}doll.json`, { cache: "no-cache" }); if (r.ok) cfg = await r.json(); } catch { /* fără setări → valori implicite */ }
    let gltf;
    // "file" opțional în doll.json: alt nume de fișier (ex. "doll.gltf"); implicit doll.glb
    const file = typeof cfg.file === "string" && /^[\w.-]+$/.test(cfg.file) ? cfg.file : "doll.glb";
    try {
      const head = await fetch(`${base}${file}`, { method: "HEAD", cache: "no-cache" });
      if (!head.ok || /text\/html/.test(head.headers.get("content-type") || "")) return { loaded: false, reason: `lipsește ${file}` };
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      gltf = await new GLTFLoader().loadAsync(`${base}${file}`);
    } catch (e) { return { loaded: false, reason: `${file} nu s-a putut încărca (${e?.message || e})` }; }
    if (!running) return { loaded: false, reason: "închis" };
    const model = gltf.scene;
    const root = new T.Group(); root.add(model); scene.add(root);
    // scara: „scale” explicit sau potrivire automată la „height” metri (implicit 16)
    let box = new T.Box3().setFromObject(model); const size = box.getSize(new T.Vector3());
    const scale = Number(cfg.scale) > 0 ? Number(cfg.scale) : (Number(cfg.height) > 0 ? Number(cfg.height) : 16) / Math.max(0.001, size.y);
    model.scale.multiplyScalar(scale);
    box = new T.Box3().setFromObject(model); const c = box.getCenter(new T.Vector3());
    model.position.x -= c.x; model.position.z -= c.z; model.position.y -= box.min.y; // centrat, pe sol
    const off = Array.isArray(cfg.offset) ? cfg.offset : [0, 0, 0];
    root.position.set(Number(off[0]) || 0, Number(off[1]) || 0, DOLL_Z + (Number(off[2]) || 0));
    const rotY = ((Number(cfg.rotationY) || 0) * Math.PI) / 180; root.rotation.y = rotY;
    model.traverse((o) => { if (o.isMesh) { o.castShadow = cfg.castShadow !== false && !LOW; o.receiveShadow = true; } });
    const top = new T.Box3().setFromObject(root).max.y;
    doll.visible = false; // păpușa V2 se ascunde
    // piesa care se rotește
    const D = (d) => ((Number(d) || 0) * Math.PI) / 180;
    const node = cfg.headNode ? model.getObjectByName(String(cfg.headNode)) : null;
    const axis = ["x", "y", "z"].includes(cfg.headAxis) ? cfg.headAxis : "y";
    const splitF = cfg.headSplit === false ? null : (Number(cfg.headSplit) > 0.4 && Number(cfg.headSplit) < 0.97 ? Number(cfg.headSplit) : 0.78);
    const pivot = !node && splitF ? splitHead(model, root, splitF) : null;
    if (node) { const b0 = node.rotation[axis]; Object.assign(turn, { obj: node, axis, front: b0 + D(cfg.headFrontDeg ?? 0), back: b0 + D(cfg.headBackDeg ?? 180) }); }
    else if (pivot) Object.assign(turn, { obj: pivot, axis: "y", front: D(cfg.headFrontDeg ?? 0), back: D(cfg.headBackDeg ?? 180) });
    else Object.assign(turn, { obj: root, axis: "y", front: rotY + D(cfg.headFrontDeg ?? 0), back: rotY + D(cfg.headBackDeg ?? 180) });
    turn.obj.rotation[turn.axis] = turn.back; // începe cu spatele (lumina verde)
    headY = Number(cfg.headHeight) > 0 ? Number(cfg.headHeight) : top * 0.9;
    beamY = headY; beamZ = root.position.z + 1.5; eyeLight.position.set(root.position.x, headY, root.position.z + 3.5);
    return { loaded: true, headNode: node ? node.name : pivot ? `capul (tăiat automat la ${Math.round(splitF * 100)}% din înălțime)` : null, headRequested: cfg.headNode || null, nodes: listNames(model) };
  }
  // Taie modelul la gât: triunghiurile de deasupra lui „frac” din înălțime trec într-un grup separat
  // (pivot la gât), care se rotește singur. Restul corpului rămâne pe loc. Modelul original nu e modificat pe disc.
  function splitHead(model, root, frac) {
    root.updateMatrixWorld(true);
    const bb = new T.Box3().setFromObject(model); const cutY = bb.min.y + (bb.max.y - bb.min.y) * frac;
    const meshes = []; model.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh && o.geometry?.attributes?.position) meshes.push(o); });
    const v = new T.Vector3(); const headBox = new T.Box3(); const parts = [];
    const pick = (g, idx) => {
      const ng = new T.BufferGeometry();
      Object.entries(g.attributes).forEach(([name, a]) => {
        const sz = a.itemSize; const out = new Float32Array(idx.length * 3 * sz); const get = [a.getX, a.getY, a.getZ, a.getW];
        idx.forEach((i, j) => { for (let k = 0; k < 3; k++) for (let c = 0; c < sz; c++) out[(j * 3 + k) * sz + c] = get[c].call(a, i + k); });
        ng.setAttribute(name, new T.BufferAttribute(out, sz, a.normalized));
      });
      return ng;
    };
    meshes.forEach((o) => {
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry; const pos = g.attributes.position;
      const keep = []; const head = [];
      for (let i = 0; i + 2 < pos.count; i += 3) {
        let y = 0; for (let k = 0; k < 3; k++) { v.fromBufferAttribute(pos, i + k).applyMatrix4(o.matrixWorld); y += v.y; }
        (y / 3 > cutY ? head : keep).push(i);
      }
      if (!head.length) return;
      const hg = pick(g, head); hg.computeBoundingSphere();
      for (const i of head) for (let k = 0; k < 3; k++) headBox.expandByPoint(v.fromBufferAttribute(pos, i + k).applyMatrix4(o.matrixWorld));
      o.geometry = keep.length ? pick(g, keep) : new T.BufferGeometry();
      parts.push({ o, hg });
    });
    if (!parts.length) return null;
    const c = headBox.getCenter(new T.Vector3()); c.y = cutY;
    const pivot = new T.Group(); root.add(pivot); pivot.position.copy(root.worldToLocal(c.clone())); root.updateMatrixWorld(true);
    const inv = new T.Matrix4().copy(pivot.matrixWorld).invert();
    parts.forEach(({ o, hg }) => {
      const m = new T.Mesh(hg, o.material); m.castShadow = o.castShadow; m.receiveShadow = true;
      new T.Matrix4().multiplyMatrices(inv, o.matrixWorld).decompose(m.position, m.quaternion, m.scale); pivot.add(m);
    });
    return pivot;
  }
  function listNames(obj) { const out = []; obj.traverse((o) => { if (o.name) out.push(o.name); }); return out.slice(0, 60); }
  // ── Bucla de randare ──
  function resize() { const w = container.clientWidth || 1; const h = container.clientHeight || 1; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  function applyQuality() {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, LOW ? 1 : 1.6));
    renderer.shadowMap.enabled = !LOW; key.castShadow = !LOW;
    dust.visible = !LOW; fogCards.forEach((f, i) => { f.visible = !LOW || i % 2 === 0; });
    dollUp.visible = !LOW; tealRim.visible = true; resize();
  }
  const ro = new ResizeObserver(resize); ro.observe(container);
  // pas de timp maxim pe cadru (doar testele automate îl pot mări, prin window.__RL_MAX_DT)
  const MAX_DT = (typeof window !== "undefined" && window.__RL_MAX_DT) || 0.05;
  const clock = new T.Clock(); let raf = 0; let running = true; let fpsAcc = 0; let fpsN = 0; let slow = 0; let lastFps = 60;
  const fogCol = new T.Color(); const fogTint = new T.Color(0x1c272b); const tmp = new T.Vector3();
  const api = { onStep: null };
  function loop() {
    if (!running) return; raf = requestAnimationFrame(loop);
    const dt = Math.min(MAX_DT, clock.getDelta()); sceneTime += dt;
    for (let i = tweens.length - 1; i >= 0; i--) { const tw = tweens[i]; tw.t = Math.min(tw.dur, tw.t + dt); tw.fn(tw.t / tw.dur); if (tw.t >= tw.dur) { tweens.splice(i, 1); tw.done?.(); } }
    for (let i = waits.length - 1; i >= 0; i--) if (sceneTime >= waits[i].at) waits.splice(i, 1)[0].res();
    // personajele
    players.forEach((p) => {
      const r = p.h.root;
      if (p.moving && p.target) {
        tmp.copy(p.target).sub(r.position); tmp.y = 0; const d = tmp.length();
        if (d < 0.03) { r.position.x = p.target.x; r.position.z = p.target.z; p.moving = false; }
        else { const stp = Math.min(d, p.speed * dt); r.position.addScaledVector(tmp.normalize(), stp); p.walk += stp * (p.speed > 3 ? 4.2 : 3.4); p.stepAcc += stp; if (p.stepAcc > 1.4) { p.stepAcc = 0; api.onStep?.(); }
          const yaw = Math.atan2(-tmp.x, -tmp.z); r.rotation.y += (yaw - r.rotation.y) * Math.min(1, dt * 6); }
        r.position.y += ((p.target.y || 0) - r.position.y) * Math.min(1, dt * 6);
      } else { let dy = p.faceYaw - r.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); r.rotation.y += dy * Math.min(1, dt * 4); }
      p.poseT = Math.min(1, p.poseT + dt * 3);
      const want = p.kneel > 0 ? "kneel" : p.cheer > 0 ? "cheer" : p.flinch > 0 ? "flinch" : p.moving ? (p.speed > 3 ? "sprint" : "walk") : p.status === RL_STATUS.SAFE ? "safe" : light === "red" ? "freeze" : "idle";
      if (want !== p.pose) setPose(p, want);
      const A = kit.POSES[p.poseFrom] || kit.POSES.idle; const B = kit.POSES[p.pose] || kit.POSES.idle;
      kit.applyPose(p.h, kit.mixPose(A, B, kit.ease(p.poseT)), sceneTime * 2 + p.lane, p.moving ? p.walk : 0);
      if (p.flinch > 0) { p.flinch = Math.max(0, p.flinch - dt); p.h.inner.position.x = Math.sin(sceneTime * 60) * 0.03 * p.flinch; } else p.h.inner.position.x = 0;
      p.glow = Math.max(0, p.glow - dt * 0.6); p.mat.emissive.copy(p.glowColor).multiplyScalar(Math.min(1, p.glow) * 0.22); // doar o tentă, nu „vopsea”
      if (p.ghost) { r.visible = p.fade > 0.01; r.traverse((o) => { if (o.material && !o.isPoints) { o.material.transparent = true; o.material.opacity = p.fade * (o.material.map === shadowTex ? 0.8 : 1); o.material.depthWrite = p.fade > 0.6; } }); }
    });
    // medalionul (doar personajul în prim-plan)
    const mp = medal.uid ? players.get(medal.uid) : null;
    if (mp) { medal.grp.position.copy(mp.h.root.position).add(tmp.set(0, 2.95 - mp.kneel * 0.7, 0)); medal.grp.quaternion.copy(camera.quaternion); medal.grp.visible = mp.fade > 0.05; }
    else medal.grp.visible = false;
    updateCamera(dt);
    // păpușa
    eyes += (eyesTarget - eyes) * Math.min(1, dt * 5);
    porcelain.emissiveIntensity = eyes * 3.2; eyeGlowMat.opacity = eyes * 0.95; eyeLight.intensity = eyes * 3.5;
    beamMat.uniforms.a.value += ((scanOn ? 1.1 : 0) - beamMat.uniforms.a.value) * Math.min(1, dt * 5);
    beams.forEach((b, i) => { b.position.y = beamY; b.position.z = beamZ; b.rotation.set(0.5, scanAngle + (i ? 0.05 : -0.05), 0); b.visible = beamMat.uniforms.a.value > 0.01; });
    arms.forEach((a, i) => { a.shoulder.rotation.x = -0.12 + Math.sin(sceneTime * 0.7 + i) * 0.03 + (light === "red" ? -0.1 : 0); a.elbow.rotation.x = -0.32 + Math.sin(sceneTime * 0.9 + i * 2) * 0.04; });
    coreMat.color.setHSL(0.04, 1, 0.42 + Math.sin(sceneTime * (light === "red" ? 7 : 2)) * 0.1 + eyes * 0.12);
    // atmosferă
    const fc = light === "red" ? FOG.red : light === "green" ? FOG.green : goldOn ? FOG.gold : FOG.base;
    scene.fog.color.lerp(fc, Math.min(1, dt * 1.6)); scene.background.copy(scene.fog.color); skyMat.uniforms.bot.value.copy(scene.fog.color);
    fogCol.copy(scene.fog.color).multiplyScalar(3).add(fogTint);
    fogCards.forEach((f) => { f.material.color.lerp(fogCol, Math.min(1, dt)); f.position.x += f.userData.drift * dt; if (Math.abs(f.position.x) > 6) f.userData.drift *= -1; f.quaternion.copy(camera.quaternion); });
    redBack.intensity += ((light === "red" ? 2.2 : 0) - redBack.intensity) * Math.min(1, dt * 2);
    tealRim.intensity += ((light === "red" ? 0.2 : 0.6) - tealRim.intensity) * Math.min(1, dt * 2);
    key.intensity += ((light === "red" ? 1.4 : 2.1) - key.intensity) * Math.min(1, dt * 2);
    goldLight.intensity += ((goldOn ? 3.2 : 0) - goldLight.intensity) * Math.min(1, dt * 3);
    neonMat.color.setHSL(0.985, 1, 0.5 + Math.sin(sceneTime * 3) * 0.08);
    if (dust.visible) dust.rotation.y = Math.sin(sceneTime * 0.05) * 0.06;
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i]; b.life -= dt; const arr = b.p.geometry.attributes.position.array;
      b.v.forEach((v, j) => { v.y -= b.grav * dt; arr[j * 3] += v.x * dt; arr[j * 3 + 1] = Math.max(0.03, arr[j * 3 + 1] + v.y * dt); arr[j * 3 + 2] += v.z * dt; });
      b.p.geometry.attributes.position.needsUpdate = true; b.p.material.opacity = Math.max(0, b.life / b.max);
      if (b.life <= 0) { scene.remove(b.p); b.p.geometry.dispose(); b.p.material.dispose(); bursts.splice(i, 1); }
    }
    renderer.render(scene, camera);
    const nowMs = performance.now(); fpsN++;
    if (!fpsAcc) fpsAcc = nowMs;
    if (nowMs - fpsAcc >= 1000) { lastFps = (fpsN * 1000) / (nowMs - fpsAcc); onFps?.(lastFps, LOW); if (!LOW && lastFps < 28) { if (++slow >= 3) { LOW = true; applyQuality(); } } else slow = 0; fpsAcc = nowMs; fpsN = 0; }
  }
  const onVis = () => { const v = document.visibilityState === "visible"; if (v && !running) { running = true; clock.getDelta(); loop(); } if (!v) { running = false; cancelAnimationFrame(raf); } };
  document.addEventListener("visibilitychange", onVis);
  applyQuality();
  shot(SHOTS.establish()); cam.blend = 1; updateCamera(0);

  // getterele trebuie păstrate ca getteri (Object.assign le-ar copia o singură dată)
  Object.defineProperties(api, Object.getOwnPropertyDescriptors({
    renderer, scene, camera, get camDebug() { return cam.shot ? { t: cam.shot.t, dur: cam.shot.dur, blend: cam.blend, look: cam.look.toArray() } : null; }, get low() { return LOW; }, get fps() { return lastFps; },
    setLow(v) { LOW = !!v; applyQuality(); },
    players, addPlayer, homeOf, moveTo, goHome, setPose, burst, tween, wait, skipNow, endSkip, get skipping() { return skipping; },
    shot: (name, p) => shot(SHOTS[name](p)), setLight, setEyes, setScan, setGold, turnHead, loadDollSlot, get time() { return sceneTime; },
    focus(uid, color = 0xffffff) { medal.uid = uid; const p = uid ? players.get(uid) : null; if (p) { medal.disc.material.map = p.mTex; medal.disc.material.needsUpdate = true; } medal.ringMat.color.setHex(color); medal.halo.material.color.setHex(color); },
    setLaneCount(n) { laneCount = Math.max(1, n); },
    dispose() {
      running = false; cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener("visibilitychange", onVis);
      tweens.length = 0; waits.splice(0).forEach((x) => x.res());
      const mats = new Set(); const geos = new Set(); const texs = new Set(disposables);
      scene.traverse((o) => { if (o.geometry) geos.add(o.geometry); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach((x) => { mats.add(x); ["map", "emissiveMap"].forEach((k) => { if (x[k]) texs.add(x[k]); }); }); if (o.isSkinnedMesh) o.skeleton?.dispose?.(); });
      players.forEach((p) => texs.add(p.mTex));
      geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); texs.forEach((t) => t.dispose());
      renderer.renderLists.dispose(); renderer.dispose(); try { renderer.forceContextLoss(); } catch { /* ignorat */ }
      if (canvas.parentNode === container) container.removeChild(canvas);
    },
  }));
  loop();
  return api;
}

// ══════════════════════════════════════════════════════════════════
// DATE DEMO — 18 jucători cu avatarele Sezonului 3; evenimente generate de
// MOTORUL REAL (computeRedLight) pe alegeri/rezultate aleatorii.
// ══════════════════════════════════════════════════════════════════
const DEMO_NAMES = ["Lu", "Ghioca", "AdiReal", "Sexu", "Mihai", "Vlad", "Cristi", "Dani", "Bogdan", "Răzvan", "Tudor", "Ionuț", "Sorin", "Andrei", "Paul", "Radu", "Alex", "Marius"];
// Citește (o singură dată, fără scrieri) numerele Sezonului 3, poreclele și aspectul (chel/păr) — ca la Pod.
export async function loadDemoRoster() {
  const nums = await getSeasonNumbers().catch(() => null);
  const entries = Object.entries(nums?.numbers || {}).filter(([, n]) => Number.isFinite(n)).sort((a, b) => a[1] - b[1]).slice(0, 18);
  if (entries.length < 4) return null;
  const uids = entries.map(([u]) => u);
  const [profiles, looks] = await Promise.all([getUserPublicProfiles(uids).catch(() => ({})), getPlayerLooks().catch(() => ({ bald: {} }))]);
  return entries.map(([u, n]) => ({ nick: profiles?.[u]?.nickname || `Jucător ${pad3(n)}`, avatarId: profiles?.[u]?.avatarId || null, number: n, bald: !!looks?.bald?.[u] }));
}
export function buildDemoShow(seed = 7, roster = null) {
  let s = seed; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const R = roster?.length ? roster : DEMO_NAMES.map((nick, i) => ({ nick, avatarId: `s3/${i + 1}`, number: i + 1, bald: i % 4 === 2 }));
  const uids = R.map((_, i) => `demo${i + 1}`);
  const order = Array.from({ length: 20 }, (_, i) => `d${i + 1}`);
  const base = Date.now() - 40 * 3600e3;
  const matches = Object.fromEntries(order.map((id, i) => [id, { status: "finished", lockAtMs: base + i * 3600e3 }]));
  const advances = {}; const mainScores = {};
  const skill = uids.map(() => 0.45 + rnd() * 0.35);
  order.forEach((id) => {
    advances[id] = []; mainScores[id] = {};
    uids.forEach((u, k) => { if (rnd() < 0.62) { advances[id].push(u); const r = rnd(); mainScores[id][u] = r < 0.14 + skill[k] * 0.12 ? 120 : r < skill[k] + 0.16 ? 70 : 0; } });
  });
  const stops = { [uids[9]]: base + 7.5 * 3600e3 };
  const res = computeRedLight({ participants: uids, order, matches, advances, mainScores, stops, nowMs: Date.now() });
  const TEAMS = [["Arsenal", "Chelsea"], ["Bayern", "Köln"], ["Barcelona", "Getafe"], ["Lyon", "Nantes"], ["FCSB", "Rapid"], ["PSG", "Lille"], ["Inter", "Lecce"], ["Real Madrid", "Alavés"], ["Liverpool", "Everton"], ["Napoli", "Como"]];
  const from = 11; const to = 15; // eliminări multiple, FINISHERI și un jucător deja SAFE
  return {
    demo: true, fromIndex: from, toIndex: to, total: 20,
    events: res.events.filter((e) => e.index >= from && e.index < to), initialSafe: [],
    matches: order.slice(from, to).map((id, k) => { const t = TEAMS[(from + k) % TEAMS.length]; return { index: from + k, id, home: t[0], away: t[1], scoreA: Math.floor(rnd() * 4), scoreB: Math.floor(rnd() * 3), status: "finished" }; }),
    players: Object.fromEntries(uids.map((u, i) => [u, { nick: R[i].nick, avatarId: R[i].avatarId, number: R[i].number }])),
    looks: Object.fromEntries(uids.map((u, i) => [u, { bald: !!R[i].bald }])),
    corrected: false, invalid: false,
  };
}

// ══════════════════════════════════════════════════════════════════
// REGIA — joacă evenimentele motorului, meci cu meci, ca un film
// ══════════════════════════════════════════════════════════════════
async function direct(api, audio, show, ui, isCancelled) {
  const nick = (u) => show.players?.[u]?.nick || "?";
  const say = (patch) => !isCancelled() && ui((h) => ({ ...h, ...patch }));
  const toast = (text, tone) => say({ toast: { text, tone, id: Math.random() } });
  const card = (uid, kind, extra = {}) => { const p = api.players.get(uid); if (!p) return; say({ card: { uid, kind, steps: p.steps, strikes: p.strikes, ...extra, id: Math.random() } }); };
  const letterbox = (v) => say({ letterbox: v });
  if (!show.events[0]) return;
  const board = {};
  show.events[0].entries.forEach((x) => { board[x.uid] = { steps: x.stepsBefore ?? 0, strikes: x.strikesBefore ?? 0, status: x.statusBefore || RL_STATUS.ACTIVE, choice: null, outcome: null }; });
  (show.initialSafe || []).forEach((u) => { if (board[u]) board[u].status = RL_STATUS.SAFE; });

  // ── Deschiderea: cadru general care coboară din tavan spre păpușă ──
  audio.ambience(true); letterbox(true);
  api.shot("establish"); say({ caption: "LUMINĂ ROȘIE", sub: "LUMINĂ VERDE", meta: `Meciurile ${show.fromIndex + 1}–${show.toIndex} din ${show.total}`, tone: "red" });
  audio.whoosh(0.4);
  await api.wait(3.4); say({ caption: null, sub: null, meta: null }); await api.wait(2.6);
  if (show.initialSafe?.length) { toast(`🛡️ ${show.initialSafe.map(nick).join(", ")} s-au oprit înainte de start`, "safe"); await api.wait(1.6); }
  api.endSkip();

  for (let i = 0; i < show.events.length; i++) {
    if (isCancelled()) return;
    api.endSkip();
    const ev = show.events[i]; const m = show.matches?.[i] || {};
    const active = ev.entries.filter((x) => x.statusBefore === RL_STATUS.ACTIVE);
    const adv = active.filter((x) => x.choice === "AVANSEZ");
    say({ match: { no: ev.index + 1, home: m.home, away: m.away, score: null }, counts: null, card: null });
    api.setLight("idle"); api.focus(null); letterbox(false);

    // 1) Travelling pe lângă participanți, înainte de rezultat
    api.shot("lineup");
    await api.wait(1.6);
    if (ev.state === "void") { say({ caption: "AMÂNAT / ANULAT", sub: "Fără pași · fără greșeli", tone: null }); await api.wait(3); say({ caption: null, sub: null }); continue; }
    say({ counts: { adv: adv.length, stay: active.length - adv.length } });
    ev.entries.forEach((x) => { const b = board[x.uid]; if (!b) return; b.choice = x.statusBefore === RL_STATUS.ACTIVE ? x.choice : null; b.outcome = null; });
    say({ board: JSON.parse(JSON.stringify(board)) }); await api.wait(1.6);
    audio.reveal(); say({ match: { no: ev.index + 1, home: m.home, away: m.away, score: [m.scoreA, m.scoreB] }, caption: `${m.scoreA ?? "-"} – ${m.scoreB ?? "-"}`, sub: "REZULTAT FINAL", tone: null });
    await api.wait(1.8); say({ caption: null, sub: null });

    // 2) CÂNTECUL — păpușa cântă cu spatele, TOT cântecul; nimeni nu se mișcă încă
    api.setLight("idle"); api.turnHead(false, 0.45);
    const songDur = audio.playSong(); // slotul song.mp3; fără fișier → melodia V2
    const songEndAt = performance.now() + songDur * 1000;
    if (songDur) audio.duck(true); else audio.melody(1 + ev.index * 0.025);
    api.shot("behind");
    if (songDur) { while (!audio.songEnded && performance.now() < songEndAt + 250 && !api.skipping && !isCancelled()) await api.wait(0.05); } // până la ultima notă (ceas real)
    else await api.wait(3.4);
    audio.stopMelody(); audio.stopSong(); audio.duck(false);

    // 3) Cântecul s-a terminat → păpușa întoarce capul, ochii se aprind
    letterbox(true);
    api.shot("dollTurn"); api.turnHead(true, 0.6); audio.headTurn();
    await api.wait(1.1);
    api.shot("dollEyes"); api.setEyes(1); audio.eyes();
    await api.wait(1.3);

    // 4) SCANAREA — fasciculele mătură terenul
    const wrong = ev.entries.filter((x) => x.outcome === RL_OUTCOME.WRONG);
    api.shot("scan"); say({ caption: "SCANARE", tone: "red" }); audio.scan(); api.setScan(1, -0.5);
    await new Promise((resolve) => api.tween(2.6, (t) => api.setScan(1, -0.5 + t), resolve));
    api.setScan(0); say({ caption: null });

    // 5) LUMINĂ VERDE — cei care au nimerit fac pașii în față
    const fins = ev.entries.filter((x) => x.statusBefore === RL_STATUS.ACTIVE && x.statusAfter === RL_STATUS.FINISHER);
    const movers = ev.entries.filter((x) => (x.outcome === RL_OUTCOME.CORRECT || x.outcome === RL_OUTCOME.EXACT) && x.statusAfter !== RL_STATUS.FINISHER);
    const exact = movers.filter((x) => x.outcome === RL_OUTCOME.EXACT);
    if (movers.length) {
      api.setLight("green"); letterbox(false); api.shot("behind");
      say({ caption: "LUMINĂ VERDE", sub: `${movers.length} ${movers.length === 1 ? "jucător avansează" : "jucători avansează"}`, tone: "green" });
      const stepWalk = async (p, x, delay) => {
        await api.wait(delay);
        for (let s = (x.stepsBefore ?? p.steps) + 1; s <= x.stepsAfter; s++) {
          p.steps = s; api.goHome(p, 1.35); // un pas = o linie
          while (p.moving && !api.skipping && !isCancelled()) await api.wait(0.05);
          if (s < x.stepsAfter && !api.skipping) await api.wait(0.3); // mică oprire între pași
        }
        p.steps = x.stepsAfter;
      };
      const walking = movers.map((x, k) => { const p = api.players.get(x.uid); if (!p) return null; p.glowColor.setHex(x.outcome === RL_OUTCOME.EXACT ? 0xffc23a : 0x34e3a0); p.glow = 1; return stepWalk(p, x, 0.1 * k); }).filter(Boolean);
      await api.wait(1.6); say({ caption: null, sub: null });
      if (exact.length) {
        const p = api.players.get(exact[0].uid);
        if (p) {
          api.shot("sprint", p); audio.sprint(); p.glow = 1.4; api.focus(p.uid, 0xffc23a); card(p.uid, "exact", { steps: exact[0].stepsAfter });
          api.burst(p.h.root.position.clone(), 0xffc23a, 70, 3, 1.6, 0.16); await api.wait(2.4); api.focus(null); say({ card: null });
        }
      }
      await Promise.all(walking); await api.wait(0.5);
    }

    // 6) LUMINĂ ROȘIE — cei care au greșit sunt prinși
    if (wrong.length) {
      api.setLight("red"); letterbox(true); api.shot("scan"); audio.alarm();
      say({ caption: "LUMINĂ ROȘIE", sub: `${wrong.length} ${wrong.length === 1 ? "jucător prins" : "jucători prinși"}`, tone: "red" });
      for (const x of [...wrong].sort((a, b) => (api.players.get(a.uid)?.h.root.position.x ?? 0) - (api.players.get(b.uid)?.h.root.position.x ?? 0))) {
        const p = api.players.get(x.uid); if (!p) continue;
        p.strikes = x.strikesAfter; p.flinch = 0.9; p.glowColor.setHex(0xff2030); p.glow = 1.2; audio.caught();
        if (x.strikesAfter < RL_MAX_STRIKES) toast(`❌ ${nick(x.uid)} — prins ${x.strikesAfter}/${RL_MAX_STRIKES}`, "red");
        await api.wait(0.35);
      }
      await api.wait(1.2); say({ caption: null, sub: null });
    }

    // 5) Prim-plan cu cine a greșit (fără eliminare) — tensiune la 2/3
    const warned = wrong.filter((x) => x.strikesAfter < RL_MAX_STRIKES).sort((a, b) => b.strikesAfter - a.strikesAfter).slice(0, 1);
    for (const x of warned) {
      const p = api.players.get(x.uid); if (!p) continue;
      api.shot("close", p); api.focus(p.uid, 0xff4050); card(p.uid, "caught", { strikes: x.strikesAfter });
      if (x.strikesAfter === RL_MAX_STRIKES - 1) { audio.heartbeat(); api.tween(0.8, () => {}, () => audio.heartbeat()); }
      await api.wait(2.3);
    }
    api.focus(null); say({ card: null });

    // 6) ELIMINĂRILE — pauză, prim-plan, îngenunchere, dispariție în particule (fără violență)
    const elim = ev.entries.filter((x) => x.statusBefore === RL_STATUS.ACTIVE && x.statusAfter === RL_STATUS.ELIMINATED);
    for (let k = 0; k < elim.length; k++) {
      const x = elim[k]; const p = api.players.get(x.uid); if (!p) continue;
      if (k < 3) { api.shot("elim", p); api.focus(p.uid, 0xff2030); audio.heartbeat(); card(p.uid, "eliminating", { strikes: RL_MAX_STRIKES }); await api.wait(1.3); }
      audio.eliminate(); p.ghost = true; p.status = RL_STATUS.ELIMINATED;
      api.tween(1.1, (t) => { p.kneel = smooth(t); });
      api.tween(2.4, (t) => { p.fade = 1 - smooth(Math.max(0, t - 0.35) / 0.65); p.glowColor.setHex(0xff1626); p.glow = 1.5 * (1 - t); });
      api.burst(p.h.root.position.clone(), 0xff1626, 110, 1.2, 2.6, 0.2, -0.6);
      if (k < 3) { card(p.uid, "eliminated"); await api.wait(2.6); } else await api.wait(0.4);
      toast(`💀 ${nick(x.uid)} — ELIMINAT · 0 PCT`, "red");
    }
    api.focus(null); say({ card: null });

    // 7) FINISHERI — cameră urmăritoare, linia FINISH, lumină aurie, zona FINISHERS
    if (fins.length) { api.setLight("idle"); api.setEyes(0); letterbox(true); }
    for (let k = 0; k < fins.length; k++) {
      const x = fins[k]; const p = api.players.get(x.uid); if (!p) continue;
      p.steps = RL_FINISH_STEPS;
      if (k < 2) {
        api.shot("finisher", p); api.focus(p.uid, 0xffc23a);
        api.moveTo(p, new T.Vector3(p.h.root.position.x, 0, FINISH_Z - 1.2), 3.8); audio.sprint();
        await api.wait(1.6);
        api.setGold(1, p.h.root.position.x, FINISH_Z); audio.finisher(); p.cheer = 1; p.glowColor.setHex(0xffc23a); p.glow = 2;
        api.burst(new T.Vector3(p.h.root.position.x, 2.5, FINISH_Z - 1), 0xffd34d, 160, 6, 2.6, 0.22); api.burst(new T.Vector3(p.h.root.position.x, 2.5, FINISH_Z - 1), 0xfff2c0, 80, 5, 2.2, 0.14);
        card(p.uid, "finisher"); say({ caption: "FINISHER", sub: `${nick(p.uid)} · +200 PCT`, tone: "gold" });
        await api.wait(2.8); say({ caption: null, sub: null });
      }
      p.status = RL_STATUS.FINISHER; p.cheer = 0; api.goHome(p, 2.2); p.faceYaw = Math.PI;
      toast(`🏁 ${nick(p.uid)} — FINISHER · +200 PCT`, "gold");
    }
    api.setGold(0); api.focus(null); say({ card: null });

    // 8) MĂ OPRESC → SAFE (după meciul care i-a rezolvat ultimul risc)
    for (const uid of ev.newlySafe || []) {
      const p = api.players.get(uid); if (!p) continue;
      p.status = RL_STATUS.SAFE; api.goHome(p, 2); p.faceYaw = 0.6;
      api.shot("safe", p); api.focus(uid, 0x34f5c8); audio.safe(); card(uid, "safe", { pct: pointsForSteps(p.steps) });
      await api.wait(2.6);
    }
    api.focus(null); say({ card: null });

    // sincronizare exactă cu motorul (inclusiv după SARI PESTE)
    ev.entries.forEach((x) => {
      const p = api.players.get(x.uid); if (!p) return;
      p.steps = x.stepsAfter; p.strikes = x.strikesAfter;
      if (x.statusAfter === RL_STATUS.ELIMINATED && !p.ghost) { p.ghost = true; p.fade = 0; }
      if (p.status !== x.statusAfter) p.status = x.statusAfter;
      p.flinch = 0; p.cheer = 0; p.kneel = x.statusAfter === RL_STATUS.ELIMINATED ? 1 : 0;
      if (x.statusAfter === RL_STATUS.FINISHER) p.faceYaw = Math.PI;
      if (api.skipping) { p.h.root.position.copy(api.homeOf(p)); p.moving = false; } else if (x.statusAfter !== RL_STATUS.ELIMINATED) api.goHome(p, 2.4);
    });
    (ev.newlySafe || []).forEach((uid) => { const p = api.players.get(uid); if (p) { p.status = RL_STATUS.SAFE; p.faceYaw = 0.6; if (api.skipping) p.h.root.position.copy(api.homeOf(p)); } });
    api.setLight("idle"); api.setEyes(0); api.setScan(0); api.setGold(0); letterbox(false);
    ev.entries.forEach((x) => { const b = board[x.uid]; if (!b) return; Object.assign(b, { steps: x.stepsAfter, strikes: x.strikesAfter, status: x.statusAfter, outcome: x.statusBefore === RL_STATUS.ACTIVE ? x.outcome : null }); });
    (ev.newlySafe || []).forEach((u) => { if (board[u]) board[u].status = RL_STATUS.SAFE; });
    api.shot("recap"); say({ counts: null });
    say({ board: JSON.parse(JSON.stringify(board)) }); await api.wait(2.2);
  }
  audio.stopMelody(); api.endSkip(); letterbox(true); api.shot("poster");
}

// ══════════════════════════════════════════════════════════════════
// COMPONENTA — ecran complet, vertical 9:16 (pentru înregistrarea ecranului)
// ══════════════════════════════════════════════════════════════════
// mediaBase = folderul sloturilor (în aplicație: /redlight/ → fișierele din public/redlight/)
export default function RedLightShow3D({ show: showProp, demo = false, onClose, mediaBase = "/redlight/" }) {
  // DEMO: jucătorii reali ai Sezonului 3 (citire unică, fără scrieri); dacă nu se pot citi → nume demo
  const [roster, setRoster] = useState(demo ? undefined : null);
  useEffect(() => {
    if (!demo) return undefined;
    let gone = false; let settled = false;
    const fin = (r) => { if (gone || settled) return; settled = true; setRoster(r); };
    const timer = setTimeout(() => fin(null), 6000);
    loadDemoRoster().then(fin).catch(() => fin(null));
    return () => { gone = true; clearTimeout(timer); };
  }, [demo]);
  const show = useMemo(() => (demo ? (roster === undefined ? null : buildDemoShow(7, roster)) : showProp), [demo, showProp, roster]);
  const [mapOpen, setMapOpen] = useState(false);

  const boxRef = useRef(null); const apiRef = useRef(null); const audioRef = useRef(null); const assetsRef = useRef(null);
  const [ui, setUi] = useState({});
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [low, setLow] = useState(null);
  const [fps, setFps] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState(null);
  const cancelRef = useRef(null);
  const toastTimers = useRef([]);
  const songRef = useRef(null);
  const [slots, setSlots] = useState({ doll: "…", song: "…" });
  const [vols, setVols] = useState({ voice: 1, fx: 0.8 });
  const [mixOpen, setMixOpen] = useState(false);

  const summary = useMemo(() => {
    if (!show?.events?.length) return null;
    const last = show.events[show.events.length - 1];
    const rows = last.entries.map((x) => ({ uid: x.uid, steps: x.stepsAfter, strikes: x.strikesAfter, status: x.statusAfter, pct: x.statusAfter === RL_STATUS.ELIMINATED ? 0 : x.statusAfter === RL_STATUS.FINISHER ? 200 : pointsForSteps(x.stepsAfter) }));
    (last.newlySafe || []).forEach((u) => { const r = rows.find((y) => y.uid === u); if (r) r.status = RL_STATUS.SAFE; });
    rows.sort((a, b) => (b.pct - a.pct) || (b.steps - a.steps) || (a.strikes - b.strikes));
    const eliminatedHere = new Set(show.events.flatMap((e) => e.eliminated || []));
    return { rows, eliminatedHere };
  }, [show]);

  useEffect(() => {
    if (!ui.toast) return;
    const t = ui.toast; setToasts((x) => [...x.slice(-2), t]);
    toastTimers.current.push(setTimeout(() => setToasts((x) => x.filter((y) => y.id !== t.id)), 2800));
  }, [ui.toast]);
  useEffect(() => () => toastTimers.current.forEach(clearTimeout), []);

  // Scena + personajele (resursele 3D și avatarele se încarcă înainte de START).
  useEffect(() => {
    if (!show?.events?.length || !boxRef.current) return undefined;
    let cancelled = false; let api = null;
    (async () => {
      try {
        const looksP = show.looks ? Promise.resolve({ bald: Object.fromEntries(Object.entries(show.looks).map(([u, l]) => [u, l.bald])) }) : getPlayerLooks().catch(() => ({ bald: {} }));
        const [assets, looks] = await Promise.all([loadBridgeAssets(), looksP]);
        if (cancelled) return;
        assetsRef.current = assets;
        api = createRedLightScene(boxRef.current, assets, { onFps: (f, isLow) => { setFps(Math.round(f)); setLow(isLow); } });
        if (!api) { setErr("Telefonul nu poate afișa scena 3D (WebGL indisponibil)."); return; }
        // sloturile externe: modelul 3D și fișierul audio (lipsa lor nu blochează show-ul)
        const songP = fetch(`${mediaBase}song.mp3`, { cache: "no-cache" }).then((r) => (r.ok && !/text\/html/.test(r.headers.get("content-type") || "") ? r.arrayBuffer() : null)).catch(() => null);
        const dollP = api.loadDollSlot(mediaBase).catch((e) => ({ loaded: false, reason: String(e?.message || e) }));
        const [songBytes, dollRes] = await Promise.all([songP, dollP]);
        if (cancelled) return;
        songRef.current = songBytes;
        setSlots({ doll: dollRes.loaded ? (dollRes.headRequested && !dollRes.headNode ? `încărcat · piesa „${dollRes.headRequested}” negăsită, se rotește tot modelul` : dollRes.headNode ? `încărcat · se rotește „${dollRes.headNode}”` : "încărcat · se rotește tot modelul") : `păpușa V2 (${dollRes.reason})`, song: songBytes ? "încărcat" : "lipsă · melodia V2" });
        if (typeof window !== "undefined") window.__rlSlots = dollRes;
        apiRef.current = api; setLow(api.low);
        if (typeof window !== "undefined") window.__rlShow = api; // pentru testele de performanță/memorie
        const first = show.events[0];
        const lanes = first.entries.map((x) => x.uid); api.setLaneCount(lanes.length);
        const alive = first.entries.filter((x) => x.statusBefore !== RL_STATUS.ELIMINATED);
        const imgs = await Promise.all(alive.map((x) => loadImage(getAvatarUrl(show.players?.[x.uid]?.avatarId))));
        if (cancelled) return;
        alive.forEach((x, k) => {
          const info = show.players?.[x.uid] || {};
          const p = api.addPlayer(x.uid, info, { bald: !!looks?.bald?.[x.uid] }, lanes.indexOf(x.uid), { steps: x.stepsBefore, strikes: x.strikesBefore, status: x.statusBefore }, medallionTex(imgs[k], info));
          if (x.statusBefore === RL_STATUS.FINISHER) p.faceYaw = Math.PI;
          if (x.statusBefore === RL_STATUS.SAFE) p.faceYaw = 0.6;
        });
        setReady(true);
      } catch (e) { if (!cancelled) setErr(`Show-ul nu s-a putut încărca: ${e.message || e}`); }
    })();
    return () => { cancelled = true; cancelRef.current?.(); if (api) api.dispose(); apiRef.current = null; if (typeof window !== "undefined" && window.__rlShow === api) window.__rlShow = null; };
  }, [show, mediaBase]);
  useEffect(() => () => { audioRef.current?.dispose(); audioRef.current = null; }, []);

  async function start() {
    const api = apiRef.current; if (!api || started) return;
    const audio = createAudio(assetsRef.current?.sfx, songRef.current); audioRef.current = audio; audio.setOn(soundOn); audio.resume();
    audio.setVolume("voice", vols.voice); audio.setVolume("fx", vols.fx);
    let n = 0; api.onStep = () => { if (++n % 3 === 0) audio.step(); };
    setStarted(true);
    let cancelled = false; cancelRef.current = () => { cancelled = true; };
    await direct(api, audio, show, setUi, () => cancelled || !apiRef.current);
    if (!cancelled && apiRef.current) { audio.finisher(); setTimeout(() => { if (!cancelled) setDone(true); }, 1400); }
  }

  const skip = () => { audioRef.current?.stopSong(); apiRef.current?.skipNow(); };
  const setVol = (ch, v) => { setVols((x) => ({ ...x, [ch]: v })); audioRef.current?.setVolume(ch, v); };
  const toggleSound = () => { const v = !soundOn; setSoundOn(v); audioRef.current?.setOn(v); };
  const toggleLow = () => { const api = apiRef.current; if (!api) return; api.setLow(!api.low); setLow(api.low); };
  const P = (u) => show?.players?.[u] || {};

  if (demo && roster === undefined) {
    return <div style={sx.root}><div style={sx.center}><p style={sx.msg}>Se pregătesc jucătorii Sezonului 3…</p></div></div>;
  }
  if (!show?.events?.length) {
    return <div style={sx.root}><div style={sx.center}><p style={sx.msg}>Nu există încă un show de redat.</p><button type="button" style={sx.btn} onClick={onClose}>Închide</button></div></div>;
  }
  const c = ui.card; const cp = c ? P(c.uid) : null;
  const CARD = {
    exact: ["⭐ SCOR EXACT", "+2 PAȘI", "#ffcf4a"], caught: ["❌ PRINS", `${c?.strikes}/${RL_MAX_STRIKES} GREȘELI`, "#ff5a6a"],
    eliminating: ["🔴 IDENTIFICAT", "a 3-a greșeală", "#ff3048"], eliminated: ["ELIMINAT", "0 PCT", "#ff3048"],
    finisher: ["🏁 FINISHER", "+200 PCT", "#ffcf4a"], safe: ["🛡️ SAFE", `păstrează ${c?.pct ?? 0} PCT`, "#5dffd2"],
  };

  return (
    <div style={sx.root}>
      <div style={sx.frame}>
        <div ref={boxRef} style={sx.canvasBox} />
        <div style={sx.vignette} />
        <div style={{ ...sx.bar, top: 0, height: ui.letterbox ? "7%" : 0 }} />
        <div style={{ ...sx.bar, bottom: 0, height: ui.letterbox ? "7%" : 0 }} />
        {err && <div style={sx.center}><p style={sx.msg}>{err}</p></div>}

        {started && !done && ui.match && (
          <div style={sx.top}>
            <div style={sx.pill}>MECIUL {ui.match.no}/{show.total}</div>
            <div style={sx.matchRow}>
              <span style={sx.team}>{ui.match.home}</span>
              <span style={sx.score}>{ui.match.score ? `${ui.match.score[0] ?? "-"}–${ui.match.score[1] ?? "-"}` : "vs"}</span>
              <span style={{ ...sx.team, textAlign: "left" }}>{ui.match.away}</span>
            </div>
            {ui.counts && <div style={sx.counts}><span style={{ ...sx.chip, borderColor: "rgba(80,255,160,.6)", color: "#7dffbd" }}>AVANSEAZĂ {ui.counts.adv}</span><span style={{ ...sx.chip, color: "#d6dbe6" }}>STAU {ui.counts.stay}</span></div>}
            {(show.corrected || show.invalid) && <div style={sx.corrected}>{show.invalid ? `⚠️ ${show.invalidReason || "Replay invalid"}` : "♻️ Actualizat după o corectură de rezultat"}</div>}
          </div>
        )}

        {ui.caption && (
          <div style={sx.captionBox}>
            <div style={{ ...sx.caption, ...(ui.tone === "red" ? sx.capRed : ui.tone === "green" ? sx.capGreen : ui.tone === "gold" ? sx.capGold : {}) }}>{ui.caption}</div>
            {ui.sub && <div style={sx.sub}>{ui.sub}</div>}
            {ui.meta && <div style={sx.meta}>{ui.meta}</div>}
          </div>
        )}

        {c && cp && (
          <div key={c.id} style={{ ...sx.card, borderColor: CARD[c.kind]?.[2] }}>
            <Avatar p={cp} size={64} ring={CARD[c.kind]?.[2]} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={sx.cardName}>{cp.nick} <span style={sx.cardNum}>#{pad3(cp.number)}</span></div>
              <div style={{ ...sx.cardKind, color: CARD[c.kind]?.[2] }}>{CARD[c.kind]?.[0]} <span style={sx.cardSub}>· {CARD[c.kind]?.[1]}</span></div>
              <div style={sx.cardStats}>
                <div style={sx.track}><div style={{ ...sx.trackFill, width: `${(Math.min(RL_FINISH_STEPS, c.steps) / RL_FINISH_STEPS) * 100}%` }} /></div>
                <span style={sx.cardSteps}>{c.steps}/{RL_FINISH_STEPS}</span>
                <span style={sx.cardStrikes}>{Array.from({ length: RL_MAX_STRIKES }, (_, k) => <i key={k} style={{ ...sx.dot, background: k < c.strikes ? "#ff3048" : "rgba(255,255,255,.2)" }} />)}</span>
              </div>
            </div>
          </div>
        )}

        {started && !done && ui.board && (ui.boardOpen || mapOpen) && (
          <MapBoard show={show} board={ui.board} title={ui.boardOpen?.title || "HARTA JOCULUI"} sub={ui.boardOpen?.sub || "pași · vieți · alegerea de la ultimul meci"} onClose={mapOpen ? () => setMapOpen(false) : null} />
        )}

        {mixOpen && (
          <div style={sx.mix}>
            <label style={sx.mixRow}><span>Voce (song.mp3)</span><input id="rl-vol-voice" type="range" min="0" max="1" step="0.05" value={vols.voice} onChange={(e) => setVol("voice", Number(e.target.value))} /></label>
            <label style={sx.mixRow}><span>Efecte</span><input id="rl-vol-fx" type="range" min="0" max="1" step="0.05" value={vols.fx} onChange={(e) => setVol("fx", Number(e.target.value))} /></label>
          </div>
        )}
        <div style={sx.toasts}>{toasts.map((t) => <div key={t.id} style={{ ...sx.toast, ...(sx[`t_${t.tone}`] || {}) }}>{t.text}</div>)}</div>

        {!done && (
          <div style={sx.controls}>
            {started && <button type="button" style={sx.ctl} onClick={skip}>⏭ SARI</button>}
            {started && <button type="button" style={{ ...sx.ctl, ...(mapOpen ? { borderColor: "#7dffbd", color: "#7dffbd" } : {}) }} onClick={() => setMapOpen((x) => !x)}>🗺 HARTA</button>}
            <button type="button" style={sx.ctl} onClick={toggleSound}>{soundOn ? "🔊" : "🔇 MUTE"}</button>
            <button type="button" style={sx.ctl} onClick={() => setMixOpen((x) => !x)}>🎚</button>
            <button type="button" style={sx.ctl} onClick={toggleLow}>{low ? "LOW" : "HD"}{fps ? ` · ${fps}` : ""}</button>
            <button type="button" style={sx.ctl} onClick={onClose}>✕</button>
          </div>
        )}

        {!started && !err && (
          <div style={sx.center}>
            <div style={sx.startCard}>
              <div style={sx.startKick}>PLAY LEAGUE · SEZONUL 3</div>
              <div style={sx.startTitle}>LUMINĂ ROȘIE<br />LUMINĂ VERDE</div>
              <div style={sx.startSub}>Meciurile {show.fromIndex + 1}–{show.toIndex} din {show.total}{show.demo ? " · DEMO" : ""}</div>
              <p style={sx.startHint}>Pentru filmare: pornește înregistrarea ecranului, apoi apasă START.</p>
              <div style={sx.slots}><div>Model 3D: {slots.doll}</div><div>Cântec: {slots.song}</div></div>
              <button type="button" style={{ ...sx.btn, opacity: ready ? 1 : 0.5 }} disabled={!ready} onClick={start}>{ready ? "▶ START" : "Se pregătește arena…"}</button>
            </div>
          </div>
        )}

        {done && summary && <Poster show={show} summary={summary} onClose={onClose} />}
      </div>
    </div>
  );
}

// ── HARTA: toți jucătorii, după număr — alegerea la meci, pașii pe traseu, viețile, starea ──
const OUT_ICON = { [RL_OUTCOME.EXACT]: ["⭐", "+2"], [RL_OUTCOME.CORRECT]: ["✅", "+1"], [RL_OUTCOME.WRONG]: ["❌", "−♥"], [RL_OUTCOME.STAY]: ["⚪", "stă"], [RL_OUTCOME.NO_PREDICTION]: ["⚪", "stă"], [RL_OUTCOME.IGNORED_STOP]: ["⚪", "stă"], [RL_OUTCOME.VOID]: ["⚪", "—"] };
function MapBoard({ show, board, title, sub, onClose }) {
  const rows = Object.entries(board).map(([uid, b]) => ({ uid, ...b, info: show.players?.[uid] || {} }))
    .sort((a, b) => (Number(a.info.number) || 999) - (Number(b.info.number) || 999));
  return (
    <div style={mx.wrap} onClick={onClose || undefined}>
      <div style={mx.panel} onClick={(e) => e.stopPropagation()}>
        <div style={mx.head}><div><div style={mx.title}>{title}</div><div style={mx.sub}>{sub}</div></div>{onClose && <button type="button" style={mx.x} onClick={onClose}>✕</button>}</div>
        {rows.map((r) => {
          const role = roleForNumber(Number(r.info.number)); const [bg, fg] = ROLE_TAG[role] || ROLE_TAG.player;
          const out = r.status === RL_STATUS.ELIMINATED && !r.outcome ? null : r.outcome ? OUT_ICON[r.outcome] : r.choice ? (r.choice === RL_CHOICE.ADVANCE ? ["🟢", "AV"] : ["⚪", "stă"]) : null;
          const lives = RL_MAX_STRIKES - Math.min(RL_MAX_STRIKES, r.strikes || 0);
          const st = r.status === RL_STATUS.ELIMINATED ? ["ELIMINAT", "#ff5a6a"] : r.status === RL_STATUS.FINISHER ? ["FINISH", "#ffcf4a"] : r.status === RL_STATUS.SAFE ? ["SAFE", "#5dffd2"] : [`${pointsForSteps(r.steps)} PCT`, "#c9cfdd"];
          const dim = r.status === RL_STATUS.ELIMINATED;
          return (
            <div key={r.uid} style={{ ...mx.row, opacity: dim ? 0.5 : 1 }}>
              <span style={{ ...mx.num, background: bg, color: fg, borderColor: fg }}>{pad3(r.info.number) || "—"}</span>
              <span style={mx.nick}>{r.info.nick || "?"}</span>
              <span style={mx.act}>{out ? <>{out[0]}<small style={mx.actS}>{out[1]}</small></> : ""}</span>
              <span style={mx.track}>{Array.from({ length: RL_FINISH_STEPS }, (_, k) => <i key={k} style={{ ...mx.cell, background: k < r.steps ? (r.status === RL_STATUS.FINISHER ? "#ffcf4a" : k >= 6 ? "#34e3a0" : "#2a9d74") : "rgba(255,255,255,.12)", ...(k === 6 ? mx.cell7 : {}) }} />)}</span>
              <span style={mx.steps}>{r.steps}</span>
              <span style={mx.lives}>{Array.from({ length: RL_MAX_STRIKES }, (_, k) => <span key={k} style={{ color: k < lives ? "#ff4057" : "rgba(255,255,255,.2)" }}>♥</span>)}</span>
              <span style={{ ...mx.st, color: st[1] }}>{st[0]}</span>
            </div>
          );
        })}
        <div style={mx.legend}>🟢 avansează · ⚪ stă · ⭐ scor exact +2 pași · ✅ 1X2 +1 pas · ❌ prins −1 viață · ♥ vieți · de la pasul 7 se iau puncte</div>
      </div>
    </div>
  );
}

function Avatar({ p, size = 40, ring = "#fff", dim = false }) {
  const url = getAvatarUrl(p?.avatarId);
  const st = { width: size, height: size, borderRadius: "50%", border: `${Math.max(2, Math.round(size / 22))}px solid ${ring}`, boxShadow: `0 0 ${Math.round(size / 3)}px ${ring}66`, objectFit: "cover", objectPosition: isS3Avatar(p?.avatarId) ? "50% 22%" : "50% 50%", flexShrink: 0, opacity: dim ? 0.55 : 1, background: "#1d4a3c", boxSizing: "border-box" };
  return url ? <img alt="" src={url} style={st} /> : <span style={{ ...st, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: size * 0.4 }}>{(p?.nick || "?").charAt(0)}</span>;
}

// Rezumatul final — poster de competiție, 9:16
function Poster({ show, summary, onClose }) {
  const P = (u) => show.players?.[u] || {};
  const fin = summary.rows.filter((r) => r.status === RL_STATUS.FINISHER);
  const safe = summary.rows.filter((r) => r.status === RL_STATUS.SAFE);
  const elim = summary.rows.filter((r) => r.status === RL_STATUS.ELIMINATED && summary.eliminatedHere.has(r.uid));
  const alive = summary.rows.filter((r) => r.status === RL_STATUS.ACTIVE);
  return (
    <div style={px.root}>
      <div style={px.glow} />
      <div style={px.kick}>PLAY LEAGUE · SEZONUL 3 · SCAPĂ CINE POATE</div>
      <div style={px.title}>LUMINĂ ROȘIE</div>
      <div style={px.title2}>LUMINĂ VERDE</div>
      <div style={px.sub}>MECIURILE {show.fromIndex + 1}–{show.toIndex} DIN {show.total}</div>
      {fin.length > 0 && (
        <div style={px.block}>
          <div style={{ ...px.label, color: "#ffcf4a" }}>FINISHERS · +200 PCT</div>
          <div style={px.heroRow}>{fin.map((r) => <div key={r.uid} style={px.hero}><Avatar p={P(r.uid)} size={fin.length > 3 ? 52 : 68} ring="#ffcf4a" /><div style={px.heroName}>{P(r.uid).nick}</div><div style={px.heroNum}>#{pad3(P(r.uid).number)}</div></div>)}</div>
        </div>
      )}
      {(safe.length > 0 || elim.length > 0) && (
        <div style={px.twoCol}>
          {safe.length > 0 && <div style={px.col}><div style={{ ...px.label, color: "#5dffd2" }}>SAFE</div>{safe.map((r) => <div key={r.uid} style={px.mini}><Avatar p={P(r.uid)} size={26} ring="#5dffd2" /><span style={px.miniName}>{P(r.uid).nick}</span><b style={{ color: "#5dffd2" }}>{r.pct}</b></div>)}</div>}
          {elim.length > 0 && <div style={px.col}><div style={{ ...px.label, color: "#ff5a6a" }}>ELIMINAȚI</div>{elim.map((r) => <div key={r.uid} style={px.mini}><span style={px.elimWrap}><Avatar p={P(r.uid)} size={26} ring="#ff3048" dim /><i style={px.slash} /></span><span style={{ ...px.miniName, color: "#ffb3bb" }}>{P(r.uid).nick}</span><b style={{ color: "#ff5a6a" }}>0</b></div>)}</div>}
        </div>
      )}
      {alive.length > 0 && (
        <div style={px.block}>
          <div style={{ ...px.label, color: "#e8edf5" }}>ÎNCĂ ÎN JOC</div>
          {alive.slice(0, 8).map((r, k) => (
            <div key={r.uid} style={px.rank}>
              <span style={px.pos}>{k + 1}</span><Avatar p={P(r.uid)} size={24} ring="rgba(255,255,255,.5)" />
              <span style={px.rankName}>{P(r.uid).nick}</span>
              <span style={px.rankTrack}><i style={{ ...px.rankFill, width: `${(r.steps / RL_FINISH_STEPS) * 100}%` }} /></span>
              <span style={px.rankSteps}>{r.steps}/{RL_FINISH_STEPS}</span>
              <span style={px.rankDots}>{Array.from({ length: RL_MAX_STRIKES }, (_, i) => <i key={i} style={{ ...px.d, background: i < r.strikes ? "#ff3048" : "rgba(255,255,255,.18)" }} />)}</span>
              <b style={px.rankPts}>{r.pct}</b>
            </div>
          ))}
        </div>
      )}
      <button type="button" style={{ ...sx.btn, marginTop: 10, padding: "9px 18px", fontSize: 13 }} onClick={onClose}>Închide</button>
    </div>
  );
}

const F = "'Oswald','Arial Narrow',system-ui,sans-serif";
const mx = {
  wrap: { position: "absolute", inset: 0, zIndex: 6, display: "flex", alignItems: "center", justifyContent: "center", padding: "52px 8px 56px", boxSizing: "border-box", pointerEvents: "auto" },
  panel: { width: "100%", maxHeight: "100%", overflowY: "auto", background: "rgba(8,10,14,.88)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 14, padding: "10px 8px 8px", boxSizing: "border-box", backdropFilter: "blur(4px)" },
  head: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6, padding: "0 2px" },
  title: { fontFamily: F, fontSize: 15, fontWeight: 700, letterSpacing: ".08em", color: "#fff" },
  sub: { fontSize: 10.5, color: "#9aa3b5", marginTop: 1 },
  x: { background: "transparent", border: "1px solid rgba(255,255,255,.3)", color: "#fff", borderRadius: 8, padding: "2px 8px", fontSize: 13 },
  row: { display: "flex", alignItems: "center", gap: 5, height: 22, borderBottom: "1px solid rgba(255,255,255,.05)" },
  num: { fontFamily: F, fontWeight: 700, fontSize: 12, minWidth: 34, textAlign: "center", borderRadius: 5, border: "1px solid", padding: "0 2px", lineHeight: "16px", flexShrink: 0 },
  nick: { fontSize: 11.5, color: "#e8edf5", width: 62, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0 },
  act: { width: 34, fontSize: 12, textAlign: "center", flexShrink: 0, whiteSpace: "nowrap" },
  actS: { fontSize: 8.5, color: "#c9cfdd", marginLeft: 1 },
  track: { display: "flex", gap: 1.5, flex: 1, minWidth: 0 },
  cell: { flex: 1, height: 9, borderRadius: 2, display: "block" },
  cell7: { boxShadow: "-2px 0 0 #ffcf4a" },
  steps: { fontFamily: F, fontSize: 12, color: "#fff", width: 16, textAlign: "right", flexShrink: 0 },
  lives: { fontSize: 11, letterSpacing: -1, width: 30, textAlign: "center", flexShrink: 0 },
  st: { fontSize: 9, fontWeight: 800, width: 46, textAlign: "right", flexShrink: 0, letterSpacing: ".02em" },
  legend: { fontSize: 9.5, color: "#9aa3b5", marginTop: 6, lineHeight: 1.35, textAlign: "center" },
};
const sx = {
  root: { position: "fixed", inset: 0, zIndex: 9999, background: "#000", display: "flex", alignItems: "center", justifyContent: "center", height: "100dvh" },
  frame: { position: "relative", height: "100%", width: "min(100vw, calc(100dvh * 9 / 16))", overflow: "hidden", background: "#050607", fontFamily: "system-ui, sans-serif" },
  canvasBox: { position: "absolute", inset: 0 },
  vignette: { position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)" },
  bar: { position: "absolute", left: 0, right: 0, background: "#000", transition: "height .7s ease", pointerEvents: "none", zIndex: 2 },
  top: { position: "absolute", top: "max(10px, env(safe-area-inset-top))", left: 0, right: 0, textAlign: "center", pointerEvents: "none", zIndex: 3 },
  pill: { display: "inline-block", fontFamily: F, fontSize: 10.5, fontWeight: 700, letterSpacing: ".22em", color: "#ff5a6a", background: "rgba(0,0,0,.55)", border: "1px solid rgba(255,80,100,.45)", borderRadius: 12, padding: "3px 10px" },
  matchRow: { marginTop: 5, display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, alignItems: "center", padding: "0 14px" },
  team: { fontFamily: F, fontSize: 15, fontWeight: 700, letterSpacing: ".04em", color: "#fff", textAlign: "right", textShadow: "0 2px 8px #000", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textTransform: "uppercase" },
  score: { fontFamily: F, fontSize: 20, fontWeight: 700, color: "#fff", background: "rgba(10,10,14,.7)", border: "1px solid rgba(255,255,255,.18)", borderRadius: 6, padding: "1px 10px", minWidth: 56 },
  counts: { marginTop: 6, display: "flex", justifyContent: "center", gap: 6 },
  chip: { fontFamily: F, fontSize: 11, fontWeight: 700, letterSpacing: ".12em", background: "rgba(0,0,0,.55)", border: "1px solid rgba(255,255,255,.25)", borderRadius: 10, padding: "2px 8px" },
  corrected: { marginTop: 6, fontSize: 10.5, fontWeight: 800, color: "#ffd34d", background: "rgba(0,0,0,0.6)", borderRadius: 6, padding: "3px 8px", display: "inline-block" },
  captionBox: { position: "absolute", left: 0, right: 0, top: "38%", textAlign: "center", pointerEvents: "none", zIndex: 3 },
  caption: { fontFamily: F, fontSize: 34, fontWeight: 700, color: "#fff", letterSpacing: ".1em", whiteSpace: "nowrap", textShadow: "0 0 28px rgba(0,0,0,.9), 0 2px 6px #000" },
  capRed: { color: "#ff3a4e", textShadow: "0 0 30px rgba(255,30,50,.75), 0 2px 6px #000" },
  capGreen: { color: "#5dffa8", textShadow: "0 0 30px rgba(40,255,140,.55), 0 2px 6px #000" },
  capGold: { color: "#ffd34d", textShadow: "0 0 30px rgba(255,190,40,.7), 0 2px 6px #000" },
  sub: { marginTop: 4, fontFamily: F, fontSize: 17, fontWeight: 700, letterSpacing: ".2em", color: "#e8edf5", textShadow: "0 2px 8px #000" },
  meta: { marginTop: 8, fontSize: 12, fontWeight: 800, color: "#ffd34d", letterSpacing: ".08em" },
  card: { position: "absolute", left: 12, right: 12, bottom: "calc(7% + 54px)", display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "linear-gradient(90deg, rgba(8,10,14,.88), rgba(8,10,14,.6))", border: "1px solid", borderRadius: 14, backdropFilter: "blur(6px)", zIndex: 4 },
  cardName: { fontFamily: F, fontSize: 21, fontWeight: 700, color: "#fff", letterSpacing: ".04em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  cardNum: { fontSize: 13, color: "#9aa3b2", fontWeight: 600 },
  cardKind: { fontFamily: F, fontSize: 14, fontWeight: 700, letterSpacing: ".12em", marginTop: 1 },
  cardSub: { color: "#e8edf5", fontWeight: 600, letterSpacing: ".06em" },
  cardStats: { display: "flex", alignItems: "center", gap: 8, marginTop: 6 },
  track: { flex: 1, height: 5, background: "rgba(255,255,255,.12)", borderRadius: 3, overflow: "hidden" },
  trackFill: { height: "100%", background: "linear-gradient(90deg,#2fbf9a,#ffd34d)" },
  cardSteps: { fontFamily: F, fontSize: 13, color: "#fff", fontWeight: 700 },
  cardStrikes: { display: "flex", gap: 3 },
  dot: { width: 8, height: 8, borderRadius: "50%", display: "inline-block" },
  toasts: { position: "absolute", left: 10, right: 10, bottom: "calc(7% + 54px)", display: "flex", flexDirection: "column", gap: 5, alignItems: "center", pointerEvents: "none", zIndex: 3 },
  toast: { fontSize: 12, fontWeight: 800, color: "#fff", background: "rgba(8,10,14,0.8)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 16, padding: "5px 11px" },
  t_red: { borderColor: "rgba(255,60,80,0.8)", color: "#ffb3bb" },
  t_gold: { borderColor: "rgba(255,200,60,0.9)", color: "#ffe08a" },
  t_safe: { borderColor: "rgba(60,230,180,0.9)", color: "#a9ffe6" },
  controls: { position: "absolute", left: 0, right: 0, bottom: 0, padding: "6px 10px max(8px, env(safe-area-inset-bottom))", display: "flex", gap: 6, justifyContent: "center", zIndex: 5, opacity: 0.8 },
  ctl: { background: "rgba(10,12,16,0.65)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 16, color: "#fff", fontSize: 11, fontWeight: 800, padding: "6px 11px", cursor: "pointer" },
  center: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 6 },
  msg: { color: "#fff", fontSize: 14, textAlign: "center" },
  startCard: { background: "rgba(6,8,10,0.82)", border: "1px solid rgba(255,60,80,0.45)", borderRadius: 16, padding: "22px 20px", textAlign: "center", maxWidth: 300, backdropFilter: "blur(4px)" },
  startKick: { fontSize: 10, letterSpacing: ".24em", color: "#9aa3b2", fontWeight: 800 },
  startTitle: { fontFamily: F, fontSize: 30, lineHeight: 1.05, fontWeight: 700, color: "#ff3a4e", letterSpacing: ".08em", marginTop: 8 },
  startSub: { fontSize: 12.5, color: "#ffd34d", fontWeight: 800, marginTop: 8 },
  startHint: { fontSize: 12, color: "#b8c0cf", margin: "10px 0 14px", lineHeight: 1.4 },
  slots: { fontSize: 10.5, color: "#9aa3b2", margin: "0 0 12px", lineHeight: 1.5, textAlign: "left" },
  mix: { position: "absolute", left: 12, right: 12, bottom: 48, zIndex: 6, background: "rgba(8,10,14,.88)", border: "1px solid rgba(255,255,255,.18)", borderRadius: 12, padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6 },
  mixRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 12, fontWeight: 700, color: "#fff" },
  btn: { background: "linear-gradient(180deg,#ff4a5a,#b3192b)", border: "none", borderRadius: 10, color: "#fff", fontWeight: 900, fontSize: 15, padding: "12px 24px", cursor: "pointer", letterSpacing: ".06em" },
};
const px = {
  root: { position: "absolute", inset: 0, zIndex: 8, overflow: "hidden auto", padding: "max(16px, env(safe-area-inset-top)) 16px 16px", textAlign: "center", background: "radial-gradient(ellipse at 50% 0%, rgba(150,10,25,.55), rgba(0,0,0,0) 60%), linear-gradient(180deg, rgba(14,2,5,.92), rgba(3,4,7,.97))" },
  glow: { position: "absolute", left: "-20%", right: "-20%", top: "-10%", height: "40%", background: "repeating-linear-gradient(100deg, rgba(255,255,255,.03) 0 2px, rgba(0,0,0,0) 2px 14px)", pointerEvents: "none" },
  kick: { position: "relative", fontSize: 9.5, letterSpacing: ".26em", color: "#9aa3b2", fontWeight: 800 },
  title: { position: "relative", fontFamily: F, fontSize: 34, lineHeight: 1, fontWeight: 700, color: "#ff2f45", letterSpacing: ".1em", marginTop: 8, textShadow: "0 0 30px rgba(255,30,50,.5)" },
  title2: { position: "relative", fontFamily: F, fontSize: 34, lineHeight: 1, fontWeight: 700, color: "#3dffa0", letterSpacing: ".1em", textShadow: "0 0 30px rgba(40,255,140,.35)" },
  sub: { position: "relative", fontFamily: F, fontSize: 12, letterSpacing: ".24em", color: "#ffd34d", margin: "8px 0 12px" },
  block: { position: "relative", margin: "10px 0" },
  label: { fontFamily: F, fontSize: 13, fontWeight: 700, letterSpacing: ".22em", marginBottom: 8 },
  heroRow: { display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap" },
  hero: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4 },
  heroName: { fontFamily: F, fontSize: 15, fontWeight: 700, color: "#fff", letterSpacing: ".04em" },
  heroNum: { fontSize: 10.5, color: "#ffcf4a", fontWeight: 800 },
  twoCol: { position: "relative", display: "flex", gap: 10, justifyContent: "center", margin: "6px 0" },
  col: { flex: 1, background: "rgba(255,255,255,.035)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, padding: "8px 8px" },
  mini: { display: "flex", alignItems: "center", gap: 7, padding: "3px 0", fontSize: 12.5, color: "#fff" },
  miniName: { flex: 1, textAlign: "left", fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  elimWrap: { position: "relative", display: "inline-flex" },
  slash: { position: "absolute", left: -2, right: -2, top: "50%", height: 2, background: "#ff3048", transform: "rotate(-35deg)", boxShadow: "0 0 6px #ff3048" },
  rank: { display: "flex", alignItems: "center", gap: 7, padding: "4px 6px", fontSize: 12, color: "#fff", borderBottom: "1px solid rgba(255,255,255,.06)" },
  pos: { width: 14, textAlign: "right", fontFamily: F, fontWeight: 700, color: "#ffd34d" },
  rankName: { width: 70, textAlign: "left", fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  rankTrack: { flex: 1, height: 5, background: "rgba(255,255,255,.1)", borderRadius: 3, overflow: "hidden", display: "block" },
  rankFill: { display: "block", height: "100%", background: "linear-gradient(90deg,#2fbf9a,#ffd34d)" },
  rankSteps: { fontFamily: F, fontSize: 11.5, color: "#c7cfdb", width: 34 },
  rankDots: { display: "flex", gap: 2 },
  d: { width: 6, height: 6, borderRadius: "50%", display: "inline-block" },
  rankPts: { width: 30, textAlign: "right", fontFamily: F, color: "#ffd34d" },
};
