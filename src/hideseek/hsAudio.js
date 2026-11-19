// ══════════════════════════════════════════════════════════════════
// 🔊 ASCUNSELEA — SUNET. Trei magistrale separate (VOCE · MUZICĂ · EFECTE) + mute + volum salvat pe telefon.
// • Efectele și muzica sunt generate în cod (originale, fără drepturi de autor).
// • Fișiere externe (voce, muzică, efecte) se adaugă FĂRĂ cod: le pui în public/audio/hideseek/
//   și le treci în public/audio/hideseek/manifest.json → ex. { "voice": { "prins": "prins.mp3" } }.
//   Un efect care are fișier în manifest îl înlocuiește pe cel generat. Vocea coboară automat muzica.
// • Fără manifest / fără fișiere → totul merge cu efectele generate și replicile scrise pe ecran.
// ══════════════════════════════════════════════════════════════════
export const HS_AUDIO_BASE = "/audio/hideseek/";

// Replicile vocale pregătite (fișierele vin ulterior). id → text + când se aude.
export const HS_VOICE_LINES = [
  { id: "rhyme", text: "Unu, doi, trei, patru, cinci, șase, șapte, opt, nouă, zece! Cine nu-i gata, îl iau cu lopata!", when: "Vânătorul numără (prima confruntare a fiecărei ture) și intro-ul tragerii" },
  { id: "count_3", text: "Trei…", when: "Numărătoare scurtă" }, { id: "count_2", text: "Doi…", when: "Numărătoare scurtă" }, { id: "count_1", text: "Unu!", when: "Numărătoare scurtă" },
  { id: "ready", text: "Gata sau nu, vin!", when: "Vânătorul pornește să caute" },
  { id: "level_1", text: "Nivelul unu. Holul de intrare.", when: "Intro nivel 1" },
  { id: "level_2", text: "Nivelul doi. Scările încrucișate.", when: "Intro nivel 2" },
  { id: "level_3", text: "Nivelul trei. Labirintul.", when: "Intro nivel 3" },
  { id: "level_4", text: "Nivelul patru. Turnul.", when: "Intro nivel 4" },
  { id: "level_5", text: "Ultimul nivel. EXIT.", when: "Intro nivel 5" },
  { id: "last_turn", text: "Ultima tură. Treizeci de puncte.", when: "Înainte de nivelul 5" },
  { id: "prins", text: "PRINS!", when: "Ușa deschisă, ascunsul e acolo" },
  { id: "scapat", text: "A SCĂPAT!", when: "Ușa deschisă e goală" },
  { id: "tie", text: "Egalitate! Trei la trei.", when: "Tură 3–3" },
  { id: "turn_win", text: "Tura e câștigată!", when: "Poster de tură" },
  { id: "shutout", text: "Șase la zero! Umilință!", when: "Tură 6–0" },
  { id: "exit", text: "EXIT!", when: "Câștigătorul iese pe ușa finală" },
  { id: "final", text: "Și câștigătorul duelului este…", when: "Posterul final" },
  { id: "draw_intro", text: "Tragerea la sorți. Nouă dueluri. Cinci niveluri.", when: "Începutul show-ului perechilor" },
  { id: "hunt", text: "Let the hunt begin!", when: "Finalul show-ului perechilor" },
  { id: "cinema_intro", text: "Bine ați venit la seara de proiecție!", when: "Începutul modului cinema" },
  { id: "titles", text: "Și acum… titlurile săptămânii!", when: "Finalul modului cinema" },
  // Reacții generice pe categorii de replici (fără nume — numele rămân scrise pe ecran)
  { id: "quip_caught", text: "(râs batjocoritor) Te-ai ascuns ca pula!", when: "Replică la PRINS" },
  { id: "quip_escaped", text: "(râs) Nu-l găsești nici cu mandat!", when: "Replică la A SCĂPAT" },
  { id: "quip_streak", text: "Iar a scăpat! Houdini!", when: "Serie de evadări" },
  { id: "quip_blind", text: "Bastonul alb e pe drum!", when: "Vânător care nu nimerește" },
  { id: "quip_same_door", text: "Iar la aceeași ușă?!", when: "Prinderi repetate la aceeași ușă" },
];
export const HS_SFX_IDS = ["step", "door_open", "door_close", "handle", "heart", "riser", "impact", "whoosh", "escape", "victory", "fail", "siren", "lift", "lift_ding", "tick", "beep", "confetti", "shutter", "box", "flicker", "slide"];
export const HS_MUSIC_IDS = ["loop_0", "loop_1", "loop_2", "loop_3", "draw", "cinema"];

const LS = "hs_audio_v1";
const loadPrefs = () => { try { return { master: 1, music: .7, sfx: .9, voice: 1, muted: false, ...JSON.parse(localStorage.getItem(LS) || "{}") }; } catch (e) { return { master: 1, music: .7, sfx: .9, voice: 1, muted: false }; } };
const savePrefs = (p) => { try { localStorage.setItem(LS, JSON.stringify(p)); } catch (e) { /* fără stocare: nu e grav */ } };

let manifestPromise = null;
function loadManifest() {
  if (!manifestPromise) manifestPromise = fetch(HS_AUDIO_BASE + "manifest.json", { cache: "no-cache" }).then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then((m) => ({ voice: {}, sfx: {}, music: {}, ...(m && typeof m === "object" ? m : {}) }));
  return manifestPromise;
}

export function createAudio() {
  const prefs = loadPrefs();
  let ac = null, master = null, rev = null, bus = {}, man = { voice: {}, sfx: {}, music: {} }, buffers = {}, nb = null;
  let musicNode = null, seq = null, intensity = 0, voiceCount = 0;
  loadManifest().then((m) => { man = m; });

  function ctx() {
    if (ac) return ac; const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
    ac = new C(); master = ac.createGain(); const comp = ac.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 4; master.connect(comp); comp.connect(ac.destination);
    ["music", "sfx", "voice"].forEach((k) => { bus[k] = ac.createGain(); bus[k].connect(master); });
    rev = ac.createConvolver(); const len = Math.floor(ac.sampleRate * 2.6); const ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    rev.buffer = ir; const rg = ac.createGain(); rg.gain.value = .5; rev.connect(rg); rg.connect(bus.sfx);
    nb = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate); const nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    apply(); return ac;
  }
  function apply() { if (!ac) return; const m = prefs.muted ? 0 : prefs.master; master.gain.setTargetAtTime(m, ac.currentTime, .03); ["music", "sfx", "voice"].forEach((k) => bus[k].gain.setTargetAtTime(prefs[k] * (k === "music" && voiceCount > 0 ? .28 : 1), ac.currentTime, .12)); }
  const T = () => ac.currentTime;
  const out = (n, wet = .35, b = "sfx") => { n.connect(bus[b]); if (wet) { const w = ac.createGain(); w.gain.value = wet; n.connect(w); w.connect(rev); } };
  const noise = (dur, t0 = T()) => { const s = ac.createBufferSource(); s.buffer = nb; s.loop = true; s.start(t0); s.stop(t0 + dur + .05); return s; };
  const osc = (type, f, t0, dur) => { const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t0); o.start(t0); o.stop(t0 + dur + .05); return o; };
  const env = (node, t0, a, d, v, wet, b) => { const g = ac.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(v, t0 + a); g.gain.exponentialRampToValueAtTime(.0005, t0 + a + d); node.connect(g); out(g, wet, b); return g; };
  const filt = (type, f, q = 1) => { const x = ac.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q; return x; };

  // ── efecte generate ──
  const SY = {
    step(t0) { const n = noise(.08, t0); const f = filt("bandpass", 900 + Math.random() * 500, 2); n.connect(f); env(f, t0, .004, .07, .22, .1); },
    box(t0, f = 659.3, dur = 1.6, v = .15) { [[1, v], [2.01, v * .35], [3.98, v * .12]].forEach(([m, vv]) => env(osc("sine", f * m, t0, dur), t0, .004, dur / m ** .5, vv, .7)); },
    door_open(t0) { const n = noise(.5, t0); const f = filt("highpass", 2200); n.connect(f); env(f, t0, .01, .42, .4, .3); const o = osc("sine", 120, t0, .35); o.frequency.exponentialRampToValueAtTime(38, t0 + .25); env(o, t0, .005, .3, .8, .25); },
    door_close(t0) { const o = osc("sine", 95, t0, .3); o.frequency.exponentialRampToValueAtTime(40, t0 + .2); env(o, t0, .003, .25, .9, .2); const n = noise(.15, t0); const f = filt("lowpass", 1200); n.connect(f); env(f, t0, .002, .12, .3, .2); },
    handle(t0) { for (let i = 0; i < 6; i++) { const t = t0 + i * .07; const o = osc("square", 1900 + (i % 2) * 400, t, .04); const f = filt("bandpass", 2600, 6); o.connect(f); env(f, t, .001, .035, .09, .15); } },
    heart(t0, n = 4, gap = .6) { for (let i = 0; i < n; i++) [0, .17].forEach((dt, j) => { const t = t0 + i * gap * (1 - i * .04) + dt; const o = osc("sine", j ? 58 : 66, t, .25); o.frequency.exponentialRampToValueAtTime(32, t + .16); env(o, t, .012, .2, j ? .7 : 1, .1); }); },
    riser(t0, dur = 1.4) { const n = noise(dur, t0); const f = filt("bandpass", 200, 3); f.frequency.setValueAtTime(200, t0); f.frequency.exponentialRampToValueAtTime(5000, t0 + dur); n.connect(f); const g = ac.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.3, t0 + dur); g.gain.linearRampToValueAtTime(0, t0 + dur + .05); f.connect(g); out(g, .4); },
    impact(t0, big = true) {
      const o = osc("sine", 140, t0, 1.2); o.frequency.exponentialRampToValueAtTime(28, t0 + .9); env(o, t0, .004, 1.1, big ? 1.3 : .8, .3);
      const n = noise(1, t0); const f = filt("lowpass", 6000); f.frequency.exponentialRampToValueAtTime(200, t0 + .8); n.connect(f); env(f, t0, .003, .9, big ? .7 : .4, .6);
      if (big) [110, 116.5, 164.8, 233].forEach((fr) => { const s = osc("sawtooth", fr, t0, 1.6); const l = filt("lowpass", 2400); l.frequency.exponentialRampToValueAtTime(300, t0 + 1.4); s.connect(l); env(l, t0, .01, 1.5, .1, .8); });
    },
    whoosh(t0, dur = .7, up = true) { const n = noise(dur, t0); const f = filt("bandpass", up ? 300 : 3000, 1.4); f.frequency.exponentialRampToValueAtTime(up ? 3200 : 300, t0 + dur); n.connect(f); const g = ac.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.45, t0 + dur * .6); g.gain.linearRampToValueAtTime(0, t0 + dur); f.connect(g); out(g, .5); },
    escape(t0) { [523.3, 659.3, 784, 987.8, 1318.5].forEach((f, i) => SY.box(t0 + i * .06, f, 1.5, .08)); SY.whoosh(t0, .6, true); },
    victory(t0) { [[261.6, 329.6, 392], [293.7, 370, 440], [392, 493.9, 587.3, 784]].forEach((ch, i) => ch.forEach((f) => { const o = osc("sawtooth", f, t0 + i * .3, 2); const l = filt("lowpass", 1800); o.connect(l); env(l, t0 + i * .3, .03, i === 2 ? 1.7 : .35, .055, .6); })); SY.impact(t0, false); },
    fail(t0) { [392, 370, 349.2, 311.1].forEach((f, i) => { const t = t0 + i * .32; const o = osc("sawtooth", f, t, i === 3 ? 1 : .3); if (i === 3) { o.frequency.linearRampToValueAtTime(f * .94, t + .9); } const l = filt("lowpass", 1100, 3); o.connect(l); env(l, t, .02, i === 3 ? .9 : .26, .09, .3); }); },
    siren(t0, dur = 2) { const o = osc("sawtooth", 600, t0, dur); for (let i = 0; i < dur / .5; i++) { o.frequency.linearRampToValueAtTime(i % 2 ? 600 : 950, t0 + (i + 1) * .5); } const l = filt("lowpass", 2200); o.connect(l); const g = ac.createGain(); g.gain.setValueAtTime(.05, t0); g.gain.setValueAtTime(.05, t0 + dur - .1); g.gain.linearRampToValueAtTime(0, t0 + dur); l.connect(g); out(g, .4); },
    lift(t0, dur = 1.6) { const o = osc("sawtooth", 55, t0, dur); const l = filt("lowpass", 240, 4); o.connect(l); const g = ac.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.18, t0 + .2); g.gain.setValueAtTime(.18, t0 + dur - .2); g.gain.linearRampToValueAtTime(0, t0 + dur); l.connect(g); out(g, .2); o.frequency.linearRampToValueAtTime(70, t0 + dur); },
    lift_ding(t0) { SY.box(t0, 1318.5, 1.4, .12); SY.box(t0 + .18, 1046.5, 1.6, .12); },
    tick(t0, hi = false) { env(osc("sine", hi ? 1760 : 1046, t0, .2), t0, .002, .16, .16, .5); },
    beep(t0) { env(osc("square", 880, t0, .15), t0, .002, .12, .07, .3); },
    confetti(t0) { for (let i = 0; i < 10; i++) { const t = t0 + Math.random() * .6; const n = noise(.05, t); const f = filt("bandpass", 1500 + Math.random() * 3000, 3); n.connect(f); env(f, t, .001, .05, .25, .3); } },
    shutter(t0) { const n = noise(.12, t0); const f = filt("highpass", 3000); n.connect(f); env(f, t0, .001, .06, .4, .05); },
    flicker(t0) { for (let i = 0; i < 5; i++) { const t = t0 + i * (.05 + Math.random() * .08); const o = osc("square", 120, t, .03); const f = filt("bandpass", 3000, 1); o.connect(f); env(f, t, .001, .03, .05, .1); } },
    slide(t0) { const n = noise(1, t0); const f = filt("lowpass", 400, 2); n.connect(f); const g = ac.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.35, t0 + .2); g.gain.linearRampToValueAtTime(0, t0 + 1); f.connect(g); out(g, .2); SY.door_close(t0 + .95); },
  };

  async function buffer(kind, id) {
    const file = man?.[kind]?.[id]; if (!file || !ctx()) return null;
    const key = kind + "/" + file; if (buffers[key] !== undefined) return buffers[key];
    buffers[key] = null;
    try { const r = await fetch(HS_AUDIO_BASE + file); if (!r.ok) return null; buffers[key] = await ac.decodeAudioData(await r.arrayBuffer()); } catch (e) { buffers[key] = null; }
    return buffers[key];
  }
  function playBuf(buf, b, loop = false) { const s = ac.createBufferSource(); s.buffer = buf; s.loop = loop; s.connect(bus[b]); s.start(); return s; }

  // ── muzică originală adaptivă (secvențiator): intensitate 0 (atmosferă) … 3 (moment mare) ──
  const BASS = [55, 55, 43.65, 49, 55, 55, 41.2, 41.2]; // la · fa · sol · mi (minor, tensionat)
  const ARP = [[440, 523.3, 659.3, 523.3], [349.2, 440, 523.3, 440], [392, 493.9, 587.3, 493.9], [329.6, 415.3, 493.9, 415.3]];
  function startSeq() {
    if (seq || !ctx()) return; let step = 0; let next = T() + .05;
    const tick = () => {
      if (!ac || ac.state !== "running") return;
      const bpm = [84, 96, 112, 128][intensity]; const st = 60 / bpm / 2; // optimi
      while (next < T() + .15) {
        const bar = Math.floor(step / 8) % 4; const t = next; const b = BASS[(step >> 1) % 8];
        if (step % 2 === 0) { const o = osc("sawtooth", b, t, st * 1.8); const l = filt("lowpass", 180 + intensity * 90, 5); o.connect(l); env(l, t, .01, st * 1.6, .12 + intensity * .03, .1, "music"); }
        if (intensity >= 1) { const f = ARP[bar][step % 4] * (intensity >= 3 ? 2 : 1); env(osc("triangle", f, t, st), t, .003, st * .9, .035, .5, "music"); }
        if (intensity >= 2 && step % 4 === 0) { const k = osc("sine", 110, t, .2); k.frequency.exponentialRampToValueAtTime(40, t + .12); env(k, t, .002, .16, .45, 0, "music"); }
        if (intensity >= 2) { const n = noise(.04, t); const f = filt("highpass", 7000); n.connect(f); env(f, t, .001, .03, step % 2 ? .05 : .1, 0, "music"); }
        if (intensity >= 3 && step % 8 === 4) { const n = noise(.15, t); const f = filt("bandpass", 1800, 1); n.connect(f); env(f, t, .002, .14, .25, .2, "music"); }
        if (step % 32 === 0) { [220, 261.6, 329.6].forEach((f) => { const o = osc("sine", f * (bar === 1 ? .8 : 1), t, st * 30); env(o, t, 1.2, st * 28, .025, .8, "music"); }); }
        step++; next += st;
      }
    };
    seq = setInterval(tick, 40); tick();
  }
  function stopSeq() { if (seq) clearInterval(seq); seq = null; }

  return {
    prefs,
    unlock() { const c = ctx(); if (c && c.state === "suspended") c.resume().catch(() => {}); },
    sfx(id, ...args) {
      if (!ctx() || prefs.muted) return;
      if (man.sfx?.[id]) { buffer("sfx", id).then((b) => { if (b) playBuf(b, "sfx"); else SY[id]?.(T(), ...args); }); return; }
      try { SY[id]?.(T(), ...args); } catch (e) { /* un efect ratat nu oprește show-ul */ }
    },
    box(f, at, dur, v) { if (ctx() && !prefs.muted) SY.box(at ?? T(), f, dur, v); },
    now() { return ctx() ? T() : 0; },
    // Vocea: dacă există fișier, îl cântă (și coboară muzica); altfel nu face nimic (textul rămâne pe ecran).
    async voice(id) {
      if (!ctx() || prefs.muted || !man.voice?.[id]) return false;
      const b = await buffer("voice", id); if (!b) return false;
      voiceCount++; apply(); const s = playBuf(b, "voice");
      return new Promise((res) => { s.onended = () => { voiceCount = Math.max(0, voiceCount - 1); apply(); res(true); }; });
    },
    hasVoice(id) { return !!man.voice?.[id]; },
    music(level) {
      if (!ctx()) return;
      if (level === null || level === undefined || level < 0) { stopSeq(); if (musicNode) { try { musicNode.stop(); } catch (e) { /* */ } musicNode = null; } return; }
      intensity = Math.max(0, Math.min(3, level));
      const id = "loop_" + intensity;
      if (man.music?.[id]) { buffer("music", id).then((b) => { if (!b) return startSeq(); stopSeq(); if (musicNode) try { musicNode.stop(); } catch (e) { /* */ } musicNode = playBuf(b, "music", true); }); return; }
      startSeq();
    },
    set(k, v) { prefs[k] = v; savePrefs(prefs); apply(); },
    pause() { if (ac && ac.state === "running") ac.suspend().catch(() => {}); },
    resume() { if (ac && ac.state === "suspended") ac.resume().catch(() => {}); },
    destroy() { stopSeq(); try { ac?.close(); } catch (e) { /* */ } ac = null; },
  };
}
