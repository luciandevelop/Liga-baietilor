// ══════════════════════════════════════════════════════════════════
// 🎬 ASCUNSELEA — REGIZORUL. Vanilla JS (fără React), folosit identic în aplicație și în demo.
//   stage.draw(data)    show-ul perechilor (nu reface tragerea: primește perechile salvate)
//   stage.duel(data)    redă turele JUCATE (alegeri reale ale ambilor), cu suspans și comentator
//   stage.pick(data)    jucătorul își alege ușile DIRECT în scenă (doar ale lui; nimic despre adversar)
//   stage.cinema(data)  seara de proiecție: toate duelurile la rând, doar vizionare
// Nu scrie nimic în Firebase. Salvarea alegerilor o face aplicația, prin onSubmit.
// ══════════════════════════════════════════════════════════════════
import { injectHsStyles } from "./hsStyles";
import { createAudio } from "./hsAudio";
import { createCommentator, pickBubble, computeTitles, HS_TITLES, DOOR_SYM } from "./hsCommentator";
import { makeCard, shareCard } from "./hsCard";
import { createWorld, makeChar, setVest, VEST, DOOR_KEYS } from "./hsWorld";
import { computeTurn, computeDuel, computeAllPoints, HS_TURN_VALUES, HS_TIE_VALUES, HS_LEVELS, HS_BYE_POINTS } from "../services/hideSeekEngine";

const LV_SUB = ["TREI UȘI ÎN LINIE. LUMINILE NU-S DE ÎNCREDERE.", "PALIERE SUS, JOS. PODUL SE ÎNVÂRTE.", "PEREȚI CARE SE MIȘCĂ. FIECARE COLȚ MINTE.", "TREI ETAJE. UN LIFT. UN SINGUR VÂNĂTOR.", "ULTIMA TURĂ. CINE IESE, IESE CU CAPUL SUS."];
const RHYME = [["U", 659.3, 1], ["nu,", 659.3, 1], ["doi,", 523.3, 2], ["trei,", 659.3, 2], ["pa", 659.3, 1], ["tru,", 587.3, 1], ["cinci,", 523.3, 2], ["șa", 587.3, 1], ["se,", 587.3, 1], ["șap", 493.9, 1], ["te,", 493.9, 1], ["opt,", 392, 2], ["no", 440, 1], ["uă,", 440, 1], ["ze", 523.3, 1], ["ce!", 440, 3], ["Ci", 659.3, 1], ["ne", 659.3, 1], ["nu-i", 587.3, 1], ["ga", 523.3, 1], ["ta,", 493.9, 2], ["îl", 440, 1], ["iau", 440, 1], ["cu", 523.3, 1], ["lo", 493.9, 1], ["pa", 415.3, 1], ["ta!", 440, 4]];
const JOIN = new Set([0, 4, 7, 9, 12, 14, 16, 19, 24, 25]);
const sym = (d) => DOOR_SYM[d] || "?";
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
class Ctl extends Error { constructor(kind) { super(kind); this.kind = kind; } }

export function createStage(host, { title = "ASCUNSELEA", onClose, speed = 1 } = {}) {
  injectHsStyles();
  host.classList.add("hsx");
  host.innerHTML = `
  <div class="hsx-top"><b>${esc(title)}</b><button type="button" data-k="close" aria-label="Închide">✕</button></div>
  <div class="hsx-stage">
    <div class="hsx-world"><canvas class="bg"></canvas><div class="hsx-scene2d"></div><div class="s3d" hidden></div></div>
    <div class="dark"></div><div class="alarm"></div>
    <div class="hsx-ui">
      <div class="hud"><div class="pl" data-p="A" style="--c:var(--vestA)"><img alt=""><div><b></b><small></small></div></div><div class="score"><span class="sa">0</span>:<span class="sb">0</span><small>PCT</small></div><div class="pl r" data-p="B" style="--c:var(--vestB)"><img alt=""><div><b></b><small></small></div></div></div>
      <div class="strip"><span class="live">LIVE</span><span class="stT">TURA 1 / 5</span><span class="stV">15 PCT</span></div>
      <div class="alti"></div>
      <div class="duelbar"></div><div class="level"><small></small><b></b><span></span></div>
      <div class="karaoke"></div><div class="role"><img alt=""><div><small></small><b></b></div></div>
      <div class="big"></div><div class="vs"></div><div class="poster"></div><div class="grid"></div><div class="hunt">LET THE HUNT BEGIN!</div>
      <div class="verdict"></div><div class="quip"></div><div class="confetti"></div><div class="slow"></div><div class="flash"></div>
      <div class="pickbar" hidden></div><div class="pickact tap" hidden></div><div class="tray" hidden></div>
      <div class="scanl"></div><div class="vig"></div>
    </div>
    <div class="lift" hidden><i></i><i></i><div class="lbl"><span class="arrow">▲</span><b></b><small></small></div></div>
    <div class="menu" hidden></div><div class="modal" hidden></div>
  </div>
  <div class="hsx-ctrl">
    <button type="button" data-k="pause">⏸ Pauză</button><button type="button" data-k="skip">⏭ Skip</button><button type="button" data-k="replay">↺ Replay</button><button type="button" data-k="speed">⏩ ×1</button>
    <span class="ctrlwrap"><button type="button" data-k="mix">🔊 Sunet</button><div class="mixer" hidden></div></span>
  </div>`;
  const q = (s) => host.querySelector(s);
  const stage = q(".hsx-stage"), ui = q(".hsx-ui"), cv = q("canvas.bg"), g = cv.getContext("2d"), scene2d = q(".hsx-scene2d"), s3d = q(".s3d");
  const E = Object.fromEntries(["hud", "strip", "alti", "duelbar", "level", "karaoke", "role", "big", "vs", "poster", "grid", "hunt", "verdict", "quip", "confetti", "slow", "flash", "pickbar", "pickact", "tray"].map((k) => [k, ui.querySelector("." + k)]));
  E.dark = q(".dark"); E.alarm = q(".alarm"); E.menu = q(".menu"); E.modal = q(".modal");
  const world = createWorld(s3d, stage);
  const audio = createAudio();
  let SPEED = speed, paused = false, ctl = null, destroyed = false, mode = "void", tint = 0, raf = 0, segRunning = false, lastSegs = null;
  const reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ───────── control: pauză / skip / replay / viteză / sunet ─────────
  const all = () => stage.getAnimations ? stage.getAnimations({ subtree: true }) : [];
  const isCss = (a) => (typeof CSSAnimation !== "undefined" && a instanceof CSSAnimation) || (typeof CSSTransition !== "undefined" && a instanceof CSSTransition);
  const scripted = () => all().filter((a) => !isCss(a));
  function request(kind) { ctl = kind; scripted().forEach((a) => { try { a.finish(); } catch (e) { a.cancel(); } }); if (paused) setPaused(false); }
  function setPaused(v) { paused = v; all().forEach((a) => (v ? a.pause() : a.play())); v ? audio.pause() : audio.resume(); const b = q('[data-k="pause"]'); if (b) b.textContent = v ? "▶ Continuă" : "⏸ Pauză"; }
  async function wait(s) {
    let left = s * SPEED * 1000;
    while (left > 0) { if (ctl) throw new Ctl(ctl); if (destroyed) throw new Ctl("close"); const step = Math.min(50, left); await new Promise((r) => setTimeout(r, step)); if (!paused) left -= step; }
    while (paused && !ctl && !destroyed) await new Promise((r) => setTimeout(r, 80));
    if (ctl) throw new Ctl(ctl); if (destroyed) throw new Ctl("close");
  }
  const A = (el, kf, o = {}) => { if (!el || destroyed) return Promise.resolve(); const a = el.animate(kf, { easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards", ...o, duration: ctl ? 1 : Math.max(1, (o.duration ?? 400) * SPEED), ...(ctl ? { delay: 0 } : {}) }); if (paused) a.pause(); return a.finished.catch(() => {}); };
  const show = (el, ms = 300) => A(el, [{ opacity: 0, transform: el.dataset.t0 || "translateY(1.5cqh)" }, { opacity: 1, transform: "none" }], { duration: ms });
  const hide = (el, ms = 220) => A(el, [{ opacity: getComputedStyle(el).opacity }, { opacity: 0 }], { duration: ms });
  const setOp = (el, v) => { el.getAnimations().forEach((a) => a.cancel()); el.style.opacity = v; };
  host.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-k]"); if (!b) return; audio.unlock(); const k = b.dataset.k;
    if (k === "close") { destroy(); onClose?.(); }
    else if (k === "pause") setPaused(!paused);
    else if (k === "skip" && segRunning) request("skip");
    else if (k === "replay") { if (segRunning) request("replay"); else if (lastSegs) runSegs(lastSegs.segs, lastSegs.start); }
    else if (k === "speed") { SPEED = SPEED === 1 ? .5 : 1; b.textContent = SPEED === 1 ? "⏩ ×1" : "⏩ ×2"; }
    else if (k === "mix") { const m = q(".mixer"); m.hidden = !m.hidden; }
  });
  // mixer: voce / muzică / efecte + mute
  const mix = q(".mixer"); const P = audio.prefs;
  mix.innerHTML = [["voice", "VOCE"], ["music", "MUZICĂ"], ["sfx", "EFECTE"]].map(([k, l]) => `<label>${l}<input type="range" min="0" max="1" step="0.05" value="${P[k]}" data-v="${k}"></label>`).join("") + `<button type="button" data-mute>${P.muted ? "🔇 Pornește sunetul" : "🔇 Mute"}</button><button type="button" data-vib>${P.vibrate === false ? "📳 Vibrație: OPRITĂ" : "📳 Vibrație: PORNITĂ"}</button>`;
  mix.addEventListener("input", (e) => { const k = e.target.dataset.v; if (k) audio.set(k, Number(e.target.value)); });
  mix.querySelector("[data-mute]").addEventListener("click", (e) => { e.stopPropagation(); audio.set("muted", !audio.prefs.muted); e.target.textContent = audio.prefs.muted ? "🔇 Pornește sunetul" : "🔇 Mute"; q('[data-k="mix"]').textContent = audio.prefs.muted ? "🔇 Sunet" : "🔊 Sunet"; if (audio.prefs.muted) audio.music(-1); });
  if (P.muted) q('[data-k="mix"]').textContent = "🔇 Sunet";
  mix.querySelector("[data-vib]").addEventListener("click", (e) => { e.stopPropagation(); audio.set("vibrate", audio.prefs.vibrate === false); e.target.textContent = audio.prefs.vibrate === false ? "📳 Vibrație: OPRITĂ" : "📳 Vibrație: PORNITĂ"; buzz(30); });

  // ───────── fundal 2D (sala tragerii / gol) ─────────
  let W = 0, H = 0;
  function size() { const r = stage.getBoundingClientRect(); const dpr = Math.min(2, devicePixelRatio || 1); W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); }
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(size) : null; ro?.observe(stage); size();
  const COLS = [["#ffb3d1", "#e0709c", "#ff3d8b"], ["#a8f5e4", "#4fbfa6", "#1fe3c2"], ["#ffe8a3", "#d8b04a", "#ffd23f"], ["#d6c6ff", "#8f78d9", "#b99bff"]];
  const dust = Array.from({ length: 60 }, () => ({ x: Math.random(), y: Math.random(), r: .5 + Math.random() * 1.8, v: .004 + Math.random() * .012, a: Math.random() }));
  function box(x, y, w, h, d, [top, side, edge], alpha) {
    const dx = d * .62, dy = d * .42; g.globalAlpha = alpha; g.fillStyle = side; g.beginPath(); g.moveTo(x + w, y); g.lineTo(x + w + dx, y - dy); g.lineTo(x + w + dx, y - dy + h); g.lineTo(x + w, y + h); g.fill();
    const fr = g.createLinearGradient(0, y, 0, y + h); fr.addColorStop(0, top); fr.addColorStop(1, side); g.fillStyle = fr; g.fillRect(x, y, w, h);
    g.fillStyle = "#fff"; g.globalAlpha = alpha * .9; g.beginPath(); g.moveTo(x, y); g.lineTo(x + dx, y - dy); g.lineTo(x + w + dx, y - dy); g.lineTo(x + w, y); g.fill();
    g.globalAlpha = alpha; g.strokeStyle = edge; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w + dx, y - dy); g.stroke(); g.globalAlpha = 1;
  }
  function stairs(x, y, n, s, dir, c, a, t, ph) { const bob = Math.sin(t * .0005 + ph) * H * .005; for (let i = 0; i < n; i++) box(x + (dir > 0 ? i : n - 1 - i) * s * .95, y + bob - i * s * .62, s, s * .5 + i * s * .62, s * .9, COLS[c], a); }
  function frame(t) {
    if (destroyed) return; raf = requestAnimationFrame(frame); if (paused || W === 0) return;
    if (mode === "draw") {
      const hz = H * .46; let s = g.createLinearGradient(0, 0, 0, hz); s.addColorStop(0, "#0a0718"); s.addColorStop(1, "#251036"); g.fillStyle = s; g.fillRect(0, 0, W, hz + 1);
      for (let i = 0; i < 5; i++) { const bx = W * (.12 + i * .19) + Math.sin(t * .0003 + i) * W * .04; const l = g.createLinearGradient(0, 0, 0, hz); l.addColorStop(0, "rgba(255,200,235,.13)"); l.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = l; g.beginPath(); g.moveTo(bx - W * .03, 0); g.lineTo(bx + W * .03, 0); g.lineTo(bx + W * .12, hz); g.lineTo(bx - W * .12, hz); g.fill(); }
      stairs(-W * .02, H * .26, 6, W * .05, 1, 0, .55, t, 0); stairs(W * .7, H * .2, 6, W * .048, -1, 1, .5, t, 2); stairs(W * .36, H * .12, 4, W * .036, 1, 2, .32, t, 1);
      const f = g.createLinearGradient(0, hz - H * .18, 0, hz + H * .05); f.addColorStop(0, "rgba(0,0,0,0)"); f.addColorStop(1, "rgba(55,18,75,.95)"); g.fillStyle = f; g.fillRect(0, hz - H * .18, W, H * .23);
      s = g.createLinearGradient(0, hz, 0, H); s.addColorStop(0, "#170b28"); s.addColorStop(1, "#06050d"); g.fillStyle = s; g.fillRect(0, hz, W, H - hz);
      g.strokeStyle = "rgba(255,61,139,.28)"; g.lineWidth = 1; for (let i = -10; i <= 10; i++) { g.globalAlpha = .55 - Math.abs(i) * .04; g.beginPath(); g.moveTo(W / 2 + i * W * .03, hz); g.lineTo(W / 2 + i * W * .32, H); g.stroke(); } g.globalAlpha = 1;
      const cx = W / 2, cy = H * .66, rx = W * .44, ry = H * .14;
      [["#ff3d8b", 1], ["#1fe3c2", .82], ["#ffd23f", .64]].forEach(([c, k]) => { g.globalAlpha = .55; g.strokeStyle = c; g.lineWidth = 3; g.shadowColor = c; g.shadowBlur = 16; g.beginPath(); g.ellipse(cx, cy, rx * k, ry * k, 0, 0, 7); g.stroke(); g.shadowBlur = 0; });
      g.globalAlpha = .22; g.fillStyle = "#ff3d8b"; g.beginPath(); g.ellipse(cx, cy, rx * .5, ry * .5, 0, 0, 7); g.fill(); g.globalAlpha = 1;
    } else { const s = g.createLinearGradient(0, 0, 0, H); s.addColorStop(0, "#120a22"); s.addColorStop(1, "#06050d"); g.fillStyle = s; g.fillRect(0, 0, W, H); }
    dust.forEach((d) => { if (!reduce) { d.y -= d.v * .016; if (d.y < 0) { d.y = 1; d.x = Math.random(); } } g.globalAlpha = .2 + .4 * Math.abs(Math.sin(t * .001 + d.a * 9)); g.fillStyle = "#ffd6ea"; g.beginPath(); g.arc(d.x * W, d.y * H, d.r, 0, 7); g.fill(); }); g.globalAlpha = 1;
    if (tint > .01) { g.fillStyle = `rgba(255,36,72,${tint * .25})`; g.fillRect(0, 0, W, H); tint *= .95; }
  }
  raf = requestAnimationFrame(frame);

  // ───────── unelte comune ─────────
  function resetUI() {
    scripted().forEach((a) => a.cancel());
    ["hud", "strip", "alti", "duelbar", "level", "karaoke", "role", "big", "vs", "poster", "grid", "hunt", "verdict", "quip", "slow", "flash"].forEach((k) => { E[k].style.opacity = 0; });
    E.dark.style.opacity = 0; E.alarm.classList.remove("on"); E.alarm.style.opacity = 0; E.confetti.innerHTML = ""; E.big.className = "big";
    ["pickbar", "pickact", "tray"].forEach((k) => { E[k].hidden = true; }); E.menu.hidden = true; E.modal.hidden = true; const lf = q(".lift"); if (lf && !lf.dataset.keep) lf.hidden = true;
    host.querySelectorAll(".trail").forEach((e) => e.remove()); stage.style.transform = "";
  }
  const shake = () => A(stage, [0, 1, 2, 3, 4, 5, 6].map((i) => ({ transform: i === 6 ? "none" : `translate(${(Math.random() - .5) * 14}px,${(Math.random() - .5) * 14}px)` })), { duration: 420, easing: "linear" });
  const flash = (o = .7) => A(E.flash, [{ opacity: o }, { opacity: 0 }], { duration: 600 });
  async function quip(text, sec = 2.4, voiceId, head = "") { if (!text && !head) return; E.quip.innerHTML = `${head ? `<div class="vh">${head}</div>` : ""}<div class="qt">${esc(text)}</div>`; E.quip.classList.toggle("withv", !!head); if (voiceId) audio.voice(voiceId); await show(E.quip, 260); await wait(sec); await hide(E.quip, 180); }
  // 📳 vibrație (Android); se poate opri din meniul de sunet
  const buzz = (pat) => { try { if (audio.prefs.vibrate !== false && navigator.vibrate) navigator.vibrate(pat); } catch (e) { /* fără vibrație */ } };
  function bubble(bb, text, sec = 1.6) { const b = bb._ch.querySelector(".bub"); b.textContent = text; b.classList.add("on"); setTimeout(() => b.classList.remove("on"), sec * 1000 * SPEED); }
  const pose = (bb, ...cls) => { const c = bb._ch.classList; ["run", "sneak", "cheer", "dance", "scared", "sad", "eyes", "look", "sweaty", "alert"].forEach((x) => c.remove(x)); cls.forEach((x) => x && c.add(x)); };
  function confetti(n = 70) { const cols = ["#ff3d8b", "#1fe3c2", "#ffd23f", "#b99bff", "#fff"]; for (let i = 0; i < n; i++) { const p = document.createElement("i"); p.style.left = Math.random() * 100 + "%"; p.style.background = cols[i % 5]; E.confetti.appendChild(p); p.animate([{ transform: `translateY(0) rotate(0)` }, { transform: `translateY(110cqh) rotate(${720 * (Math.random() - .5)}deg) translateX(${(Math.random() - .5) * 30}cqw)` }], { duration: (2000 + Math.random() * 1600) * SPEED, delay: Math.random() * 600, easing: "cubic-bezier(.3,.1,.6,1)", fill: "forwards" }); } audio.sfx("confetti"); }
  async function sing(beat = .3, one = false) {
    beat *= SPEED; const k = E.karaoke; k.classList.toggle("one", one);
    k.innerHTML = RHYME.map(([s], i) => `<span>${s}</span>${JOIN.has(i) ? "" : " "}`).join(""); const spans = k.querySelectorAll("span");
    // „one”: un singur cuvânt mare, pe o linie (în duel nu acoperă scena)
    const words = []; let cur = ""; RHYME.forEach(([s], i) => { cur += s; if (!JOIN.has(i)) { words.push({ w: cur, end: i }); cur = ""; } });
    show(k, 250); const usedVoice = audio.hasVoice("rhyme"); if (usedVoice) audio.voice("rhyme");
    else { const t0 = audio.now() + .05; let acc = 0; RHYME.forEach(([, f, b], i) => { audio.box(f, t0 + acc, 1.8, .16); if (i % 4 === 0) audio.box(f / 2, t0 + acc, 2.2, .06); acc += b * beat; }); }
    for (let i = 0; i < RHYME.length; i++) {
      if (one) { const w = words.find((x) => x.end >= i); k.innerHTML = `<span class="on${i >= 16 ? " last" : ""}">${esc(w.w.toUpperCase())}</span>`; }
      else spans[i].className = i >= 16 ? "on last" : "on";
      await wait(RHYME[i][2] * beat / SPEED);
    }
    await wait(.2); hide(k, 250);
  }
  function hudSet(A_, B_, tot, t) {
    const set = (side, p) => { const el = E.hud.querySelector(`[data-p="${side}"]`); el.querySelector("img").src = p.av || ""; el.querySelector("b").textContent = (p.nick || "").toUpperCase(); el.querySelector("small").textContent = `${p.num || ""} · ${side === "A" ? "VERDE" : "ALBASTRU"}`; };
    set("A", A_); set("B", B_); E.hud.querySelector(".sa").textContent = tot.A; E.hud.querySelector(".sb").textContent = tot.B;
    E.strip.querySelector(".stT").textContent = `TURA ${t} / 5`; E.strip.querySelector(".stV").textContent = `${HS_TURN_VALUES[t - 1]} PCT`;
    E.alti.innerHTML = [1, 2, 3, 4, 5].map((n) => `<span class="${n === t ? "on" : n < t ? "done" : ""}">${n}</span>`).join("");
  }
  const bump = (sel, v) => { const el = E.hud.querySelector(sel); el.textContent = v; A(el, [{ transform: "scale(1.8)" }, { transform: "scale(1)" }], { duration: 500 }); };

  // ───────── mișcare 3D ─────────
  async function moveCam(c, ms) { const camEl = world.cam; if (!camEl) return; const from = camEl._c || c; camEl._c = c; camEl.style.transform = world.camT(c); await A(camEl, [{ transform: world.camT(from) }, { transform: world.camT(c) }], { duration: ms, easing: "cubic-bezier(.4,0,.2,1)" }); }
  function setCam(c) { const camEl = world.cam; camEl._c = c; camEl.style.transform = world.camT(c); }
  async function path3(B, bb, pts, speed = 70, opts = {}) {
    let cur = bb._p; bb._ch.classList.add(opts.sneak ? "sneak" : "run"); if (opts.sneak) bb._ch.classList.add("run");
    let stepT = 0; const stepper = setInterval(() => { if (!paused && stepT++ % 3 === 0) audio.sfx("step"); }, 120 * SPEED);
    try {
      for (const pt of pts) {
        if (pt.lift !== undefined) { // urcă/coboară cu liftul
          const lift = B.lift; const dy = pt.lift - lift._y; const dur = Math.abs(dy) / 38 * 1000; audio.sfx("lift", dur / 1000 * SPEED + .3);
          bb._ch.classList.remove("run"); const to = [cur[0], pt.lift, cur[2]];
          const fromL = `${lift._base} translate3d(0px,${world.px(lift._y)},0px)`, toL = `${lift._base} translate3d(0px,${world.px(pt.lift)},0px)`;
          if (opts.follow) moveCam({ ...B.cam, y: pt.lift - 40 + (B.cam.y + 80) * .3 }, dur);
          await Promise.all([A(lift, [{ transform: fromL }, { transform: toL }], { duration: dur, easing: "ease-in-out" }), A(bb, [{ transform: world.bbT(cur) }, { transform: world.bbT(to) }], { duration: dur, easing: "ease-in-out" })]);
          lift._y = pt.lift; lift.style.transform = toL; world.at(bb, to); cur = to; audio.sfx("lift_ding"); bb._ch.classList.add("run"); continue;
        }
        const d = Math.hypot(pt[0] - cur[0], pt[1] - cur[1], pt[2] - cur[2]); if (d < .01) continue;
        face(bb, pt[0] - cur[0], pt[2] - cur[2]);
        await A(bb, [{ transform: world.bbT(cur) }, { transform: world.bbT(pt) }], { duration: d / speed * 1000, easing: "linear" });
        world.at(bb, pt); cur = pt;
      }
    } finally { clearInterval(stepper); bb._ch.classList.remove("run", "sneak", "back", "goL", "goR"); bb.getAnimations().forEach((a) => a.cancel()); world.at(bb, cur); }
  }
  function face(bb, dx, dz) { const c = bb._ch.classList; c.remove("back", "goL", "goR"); if (dz < -Math.abs(dx) * .8) c.add("back"); else if (Math.abs(dx) > Math.abs(dz) * .8) c.add(dx < 0 ? "goL" : "goR"); }
  async function liftHome(B) { if (!B.lift || B.lift._y === 0) return; const L = B.lift; const f = `${L._base} translate3d(0px,${world.px(L._y)},0px)`, t = `${L._base} translate3d(0px,0px,0px)`; audio.sfx("lift", 1); await A(L, [{ transform: f }, { transform: t }], { duration: 900 }); L._y = 0; L.style.transform = t; }
  const openDoor = async (d, ms = 380, deg = -108) => { audio.sfx("door_open"); if (d.floor) A(d.floor, [{ opacity: 0 }, { opacity: .95 }], { duration: ms * 1.4 }); await A(d.panel, [{ transform: "rotateY(0deg)" }, { transform: `rotateY(${deg}deg)` }], { duration: ms, easing: "cubic-bezier(.3,1.4,.4,1)" }); };
  const closeDoor = async (d, ms = 280) => { audio.sfx("door_close"); if (d.floor) A(d.floor, [{ opacity: getComputedStyle(d.floor).opacity }, { opacity: 0 }], { duration: ms }); await A(d.panel, [{ transform: getComputedStyle(d.panel).transform === "none" ? "rotateY(-108deg)" : getComputedStyle(d.panel).transform }, { transform: "rotateY(0deg)" }], { duration: ms, easing: "cubic-bezier(.6,0,.4,1)" }); d.panel.getAnimations().forEach((a) => a.cancel()); };
  const fade = async (el, to, ms = 200) => { await A(el, [{ opacity: getComputedStyle(el).opacity }, { opacity: to }], { duration: ms }); setOp(el, to); };
  const frontOf = (d, extra = 0) => [d.pos[0] + d.n[0] * (3 + extra), d.pos[1], d.pos[2] + d.n[2] * (3 + extra)];
  const inDoor = (d) => [d.pos[0] + d.n[0] * 1.2, d.pos[1], d.pos[2] + d.n[2] * 1.2]; // în cadrul ușii

  // ───────── lift între niveluri ─────────
  const liftEl = q(".lift");
  async function liftClose(t) {
    liftEl.hidden = false; liftEl.querySelector("b").textContent = `▲ NIVELUL ${t}`; liftEl.querySelector("small").textContent = HS_LEVELS[t - 1];
    const [l, r_] = liftEl.querySelectorAll("i"); audio.sfx("door_close"); buzz(20);
    await Promise.all([A(l, [{ transform: "translateX(-100%)" }, { transform: "none" }], { duration: 420, easing: "cubic-bezier(.6,0,.3,1)" }), A(r_, [{ transform: "translateX(100%)" }, { transform: "none" }], { duration: 420, easing: "cubic-bezier(.6,0,.3,1)" })]);
    audio.sfx("lift", 1.1); A(liftEl.querySelector(".lbl"), [{ opacity: 0, transform: "translateY(3cqh)" }, { opacity: 1, transform: "none" }], { duration: 300 });
    await A(liftEl.querySelector(".arrow"), [{ transform: "translateY(4cqh)", opacity: .2 }, { transform: "translateY(-4cqh)", opacity: 1 }], { duration: 900, easing: "ease-in-out" });
    audio.sfx("lift_ding");
  }
  async function liftOpen() {
    const [l, r_] = liftEl.querySelectorAll("i"); audio.sfx("door_open");
    await Promise.all([A(l, [{ transform: "none" }, { transform: "translateX(-100%)" }], { duration: 520, easing: "cubic-bezier(.6,0,.3,1)" }), A(r_, [{ transform: "none" }, { transform: "translateX(100%)" }], { duration: 520, easing: "cubic-bezier(.6,0,.3,1)" }), A(liftEl.querySelector(".lbl"), [{ opacity: 1 }, { opacity: 0 }], { duration: 300 })]);
    liftEl.hidden = true;
  }
  // ───────── START (deblochează sunetul) ─────────
  function startMenu(kicker, h1, btn = "▶ START") {
    return new Promise((res) => { E.menu.hidden = false; E.menu.innerHTML = `<p>${esc(kicker)}</p><div class="syms">○△□</div><h1>${esc(h1)}</h1><button type="button" class="go">${esc(btn)}</button><p>PLAY LEAGUE · SEZONUL 3</p>`; E.menu.querySelector("button").onclick = () => { audio.unlock(); E.menu.hidden = true; res(); }; });
  }
  async function runSegs(segs, start = 0) {
    if (segRunning) return; segRunning = true; lastSegs = { segs, start }; let i = start;
    try {
      while (i < segs.length && !destroyed) {
        ctl = null;
        try { await segs[i](); i++; }
        catch (e) { if (!(e instanceof Ctl)) { console.error(e); i++; continue; } const k = e.kind; ctl = null; resetUI(); if (k === "close") break; if (k === "skip") i++; }
      }
    } finally { segRunning = false; ctl = null; audio.music(-1); }
  }

  // ═════════════════════ 1) TRAGEREA LA SORȚI (sala rotundă 3D de la parter) ═════════════════════
  async function draw({ players, pairs, bye }) {
    const ids = Object.keys(players); const pl = (u) => players[u] || { nick: "?", num: "" };
    const com = createCommentator({}, "draw");
    let chars = {}, spots = {}, H0 = null;
    const order = pairs.flatMap((p) => [p.a, p.b]).concat(bye ? [bye] : []);
    const setup = () => {
      resetUI(); scene2d.innerHTML = ""; mode = "void"; chars = {}; spots = {};
      H0 = world.buildHall(); setCam(H0.intro);
      const n = order.length;
      order.forEach((u, i) => { const row = i % 2; const a = (30 + (300 * i) / Math.max(1, n - 1)) * Math.PI / 180; const k = row ? 1.28 : .92; const pt = [Math.sin(a) * H0.rx * k, row ? -H0.step : 0, H0.cz + Math.cos(a) * H0.rz * k]; spots[u] = pt; const bb = world.actor(pl(u), null, .74); world.at(bb, pt); bb.style.opacity = 0; chars[u] = bb; });
    };
    const main = async () => {
      setup(); await startMenu("TRAGEREA LA SORȚI", "ASCUNSELEA");
      audio.music(0); audio.voice("draw_intro"); moveCam(H0.cam, 2600);
      E.level.querySelector("small").textContent = "PLAY LEAGUE · SEZONUL 3"; E.level.querySelector("b").textContent = "TRAGEREA LA SORȚI"; E.level.querySelector("span").textContent = `${ids.length} JUCĂTORI · ${pairs.length} DUELURI · 5 NIVELURI`; E.level.style.top = "20cqh";
      show(E.level, 500); audio.sfx("riser", 1.4);
      for (const u of order) { A(chars[u], [{ opacity: 0 }, { opacity: 1 }], { duration: 240 }).then(() => setOp(chars[u], 1)); await wait(.04); }
      await sing(.2, true);
      audio.sfx("impact"); shake(); buzz(40); await hide(E.level, 240); E.level.style.top = ""; audio.music(1);
      for (let i = 0; i < pairs.length; i++) {
        const { a, b } = pairs[i]; const ca = chars[a], cb = chars[b];
        ca._ch.classList.add("named"); cb._ch.classList.add("named"); audio.sfx("whoosh", .5, true);
        await Promise.all([path3({}, ca, [H0.front[0]], 120), path3({}, cb, [H0.front[1]], 120)]);
        setVest(ca._ch, "A"); setVest(cb._ch, "B"); pose(ca, "cheer"); pose(cb, "cheer"); audio.sfx("impact", false); buzz(25);
        E.vs.innerHTML = `<div class="k">DUELUL ${i + 1} / ${pairs.length}</div><div class="p" style="--c:${VEST.A}"><img alt="" src="${pl(a).av || ""}"><b>${esc(pl(a).nick)}</b><small>${esc(pl(a).num)} · VERDE</small></div><div class="x">VS</div><div class="p" style="--c:${VEST.B}"><img alt="" src="${pl(b).av || ""}"><b>${esc(pl(b).nick)}</b><small>${esc(pl(b).num)} · ALBASTRU</small></div>`;
        show(E.vs, 220); E.quip.innerHTML = `<div class="qt">${esc(com.draw(pl(a).nick, pl(b).nick, i))}</div>`; E.quip.classList.remove("withv"); show(E.quip, 220);
        await wait(1.5); pose(ca); pose(cb); ca._ch.classList.remove("named"); cb._ch.classList.remove("named"); hide(E.vs, 150); hide(E.quip, 150);
        path3({}, ca, [spots[a]], 140); path3({}, cb, [spots[b]], 140); await wait(.3);
      }
      if (bye) { const c = chars[bye]; c._ch.classList.add("named"); pose(c, "sad"); E.quip.innerHTML = `<div class="qt">🪑 ${esc(pl(bye).nick)} stă pe bancă: ${HS_BYE_POINTS} PCT fix și zero rușine.</div>`; await show(E.quip, 220); await wait(1.5); await hide(E.quip, 150); }
    };
    const final = async () => {
      if (!H0 || !world.cam) setup(); mode = "void"; audio.music(2); setCam(H0.cam);
      pairs.forEach((p) => { if (chars[p.a]) setVest(chars[p.a]._ch, "A"); if (chars[p.b]) setVest(chars[p.b]._ch, "B"); });
      Object.values(chars).forEach((c) => { setOp(c, 1); pose(c, "dance"); });
      audio.sfx("victory"); buzz([40, 60, 40]);
      E.grid.innerHTML = `<h3>${pairs.length} DUELURI. 5 NIVELURI.<br>NICIUNDE SĂ FUGI, BĂ!</h3>` + pairs.map(({ a, b }) => `<div class="row"><span style="--c:${VEST.A}"><img alt="" src="${pl(a).av || ""}">${esc(pl(a).nick)}</span><i>VS</i><span style="--c:${VEST.B}"><img alt="" src="${pl(b).av || ""}">${esc(pl(b).nick)}</span></div>`).join("") + (bye ? `<div class="row"><span>🪑 ${esc(pl(bye).nick)}</span><i>BANCĂ</i><span>${HS_BYE_POINTS} PCT</span></div>` : "");
      await show(E.grid, 400); await wait(1); E.hunt.dataset.t0 = "scale(1.6)"; E.hunt.textContent = "FIGHT! LET THE HUNT BEGIN!"; show(E.hunt, 400); audio.voice("hunt"); audio.sfx("impact"); shake(); flash(.35);
      await wait(3.2); audio.music(-1);
    };
    await runSegs([main, final]);
  }

  // ═════════════════════ 2) DUELUL (redare) ═════════════════════
  // data = { A, B (jucători), picks {turn:{A,B}}, closed, from, to, key, cinema }
  function duelSegments(data) {
    const { A: PA, B: PB, picks = {}, closed = false, from = 1, to = 5, key = "duel" } = data;
    const duel = computeDuel(picks, closed); const com = createCommentator({ A: PA.nick, B: PB.nick }, key);
    const tot = { A: 0, B: 0 }; const P = { A: PA, B: PB };
    // istoricul turelor dinainte (pentru statistici reale ale comentatorului și scor)
    for (let t = 1; t < from; t++) { const x = duel.turns[t - 1]; if (x.status === "played") { const r = computeTurn(picks[t].A, picks[t].B); r.events.forEach((ev, k) => com.event(ev, t, k)); com.turnEnd(t, r.winsA, r.winsB, x.ptsA, x.ptsB, r.events.map((e) => e.winner)); } tot.A += x.ptsA; tot.B += x.ptsB; }
    const segs = []; let shownBefore = false;
    for (let t = from; t <= to; t++) {
      const x = duel.turns[t - 1];
      if (x.status === "played") { const first = !shownBefore; segs.push(() => playTurn(t, computeTurn(picks[t].A, picks[t].B), x, P, tot, com, { first, key, cinema: data.cinema })); shownBefore = true; }
      else if (x.status === "forfeitA" || x.status === "forfeitB" || x.status === "void") { segs.push(() => noShowCard(t, x, P, tot, com)); }
      else { segs.push(() => pendingCard(t, x, P, tot)); break; }
    }
    if (to === 5 && duel.finished) segs.push(() => finalPoster(P, duel, com));
    return segs;
  }
  async function noShowCard(t, x, P, tot, com) {
    resetUI(); world.clear(); mode = "void"; hudSet(P.A, P.B, tot, t); show(E.hud, 200);
    tot.A += x.ptsA; tot.B += x.ptsB;
    const win = x.status === "forfeitA" ? "A" : x.status === "forfeitB" ? "B" : null;
    E.poster.innerHTML = `<small>TURA ${t} · ${HS_LEVELS[t - 1]}</small><div class="res"><img alt="" src="${P.A.av || ""}" style="--c:${VEST.A}"><b><span class="sa">${x.ptsA}</span>–<span class="sb">${x.ptsB}</span></b><img alt="" src="${P.B.av || ""}" style="--c:${VEST.B}"></div><div class="pts">${win ? `🚫 NEPREZENTARE · ${esc(P[win].nick.toUpperCase())} IA ${win === "A" ? x.ptsA : x.ptsB} PCT` : "🚫 NIMENI N-A JUCAT · 0 PCT"}</div><p>${win ? esc(com.forfeit(win).text) : "Niciunul n-a confirmat tura până la termen. Nu se acordă nimic."}</p>`;
    audio.sfx(win ? "fail" : "beep"); await show(E.poster, 350); bump(".sa", tot.A); bump(".sb", tot.B); await wait(3); await hide(E.poster, 200);
  }
  async function pendingCard(t, x, P, tot) {
    resetUI(); world.clear(); mode = "void"; hudSet(P.A, P.B, tot, t); show(E.hud, 200);
    const who = x.status === "waitA" ? `${P.B.nick} a confirmat, ${P.A.nick} încă nu` : x.status === "waitB" ? `${P.A.nick} a confirmat, ${P.B.nick} încă nu` : "niciunul n-a confirmat încă";
    E.poster.innerHTML = `<small>TURA ${t} · ${HS_LEVELS[t - 1]}</small><div class="pts" style="margin-top:2cqh">⏳ DUEL ÎN DESFĂȘURARE</div><p>Tura ${t}: ${esc(who)}. Rezultatul apare după ce confirmă amândoi. Nimic nu se inventează.</p>`;
    await show(E.poster, 350); await wait(3); await hide(E.poster, 200);
  }

  // o tură jucată, cu cele 6 confruntări
  async function playTurn(t, r, x, P, tot, com, { first, key, cinema }) {
    resetUI(); mode = "void"; scene2d.innerHTML = ""; const lv = t - 1;
    if (!first) await liftClose(t);
    const B = world.build(lv); const doors = Object.fromEntries(B.doors.map((o) => [o.d.sym, o]));
    const ch = { A: world.actor(P.A, "A"), B: world.actor(P.B, "B") }; const home = { A: B.start[0], B: B.start[1] }; world.at(ch.A, home.A); world.at(ch.B, home.B);
    if (B.topView) Object.values(ch).forEach((bb) => bb.classList.add("top"));
    hudSet(P.A, P.B, tot, t); E.big.className = "big";
    // urcare între niveluri (aceeași clădire): camera urcă, altimetrul se aprinde
    setCam(B.intro); if (!first) liftOpen();
    moveCam(B.cam, lv === 3 ? 3000 : 2200);
    show(E.hud, 300); show(E.alti, 300);
    E.level.querySelector("small").textContent = `NIVELUL ${t} / 5 · ${HS_TURN_VALUES[lv]} PCT`; E.level.querySelector("b").textContent = HS_LEVELS[lv]; E.level.querySelector("span").textContent = LV_SUB[lv]; E.level.dataset.t0 = "scale(1.12)";
    audio.music(t === 5 ? 2 : 1); audio.sfx("riser", 1.3); audio.voice(`level_${t}`);
    await show(E.level, 500);
    if (lv === 0 && B.lights) { audio.sfx("flicker"); B.lights.forEach((l) => A(l, [{ opacity: 1 }, { opacity: .1 }, { opacity: 1 }, { opacity: .2 }, { opacity: 1 }], { duration: 900 })); A(E.dark, [{ opacity: 0 }, { opacity: .7 }, { opacity: 0 }, { opacity: .5 }, { opacity: 0 }], { duration: 900 }); }
    if (lv === 4) { E.alarm.classList.add("on"); audio.sfx("siren", 2.4); for (let n = 5; n >= 1; n--) { B.sign.textContent = `EXIT 0${n}`; audio.sfx("beep"); await wait(.3); } B.sign.textContent = "EXIT"; }
    await wait(lv === 4 ? .4 : 1.1); audio.sfx("impact"); shake(); await hide(E.level, 260);
    if (t === 5) await quip(com.lastTurn().text, 1.8, "last_turn");
    const wins = { A: 0, B: 0 }; const timeline = [];
    // confruntarea care decide tura (primul care ajunge la 4); la 3–3, ultima
    let decisive = 5; { let a = 0, b = 0; for (let k = 0; k < 6; k++) { if (r.events[k].winner === "A") a++; else b++; if (a === 4 || b === 4) { decisive = k; break; } } }
    const CAMS = [{}, { x: -18, ry: -7 }, { x: 18, ry: 7 }, { y: -14, rx: -5 }, { z: -16 }, { y: 8, rx: 3 }];
    for (let k = 0; k < 6; k++) {
      const ev = r.events[k]; const Hs = ev.hider, Ss = ev.seeker; const Hb = ch[Hs], Sb = ch[Ss]; const HP = P[Hs], SP = P[Ss];
      const hd = doors[ev.hideDoor], sd = doors[ev.seekDoor];
      const full = k === 0 || k === 3 || k === decisive; const v = (t * 3 + k) % 3;
      const half = k < 3 ? 1 : 2; const rnd = (k % 3) + 1; const hs = half === 1 ? 0 : 3;
      if (k === 0 || k === 3) { // începutul reprizei: cine caută acum de 3 ori (bara de sus ascunsă cât ține anunțul)
        hide(E.duelbar, 150);
        if (k === 3) { const c1 = timeline.slice(0, 3).filter((w) => w === r.events[0].seeker).length; await quip(`Acum se schimbă rolurile: ${SP.nick} caută, ${HP.nick} se ascunde.`, 2.2, null, `⏸ PAUZĂ · ${esc(P[r.events[0].seeker].nick)} a prins <em class="c">${c1} din 3</em>`); }
        E.level.querySelector("small").textContent = `REPRIZA ${half} / 2 · TURA ${t}`; E.level.querySelector("b").textContent = `${SP.nick.toUpperCase()} CAUTĂ`; E.level.querySelector("span").textContent = `${HP.nick.toUpperCase()} SE ASCUNDE DE 3 ORI · 3 UȘI DE DESCHIS`; E.level.dataset.t0 = "scale(1.12)";
        audio.sfx("impact", false); buzz(30); await show(E.level, 340); await wait(1.3); await hide(E.level, 220);
      }
      const caughtSoFar = timeline.slice(hs, k).filter((w) => w === Ss).length;
      E.duelbar.innerHTML = `<b><i class="lv">● LIVE · T${t}/5 · ${HS_TURN_VALUES[lv]} PCT</i> REPRIZA ${half}/2 · CĂUTAREA ${rnd}/3</b><span><i style="color:${VEST[Ss]}">●</i> ${esc(SP.nick.toUpperCase())} CAUTĂ <span class="cnt">🔦 <b>${caughtSoFar}/3</b></span> · <i style="color:${VEST[Hs]}">●</i> ${esc(HP.nick.toUpperCase())} SE ASCUNDE</span><em>${[0, 1, 2, 3, 4, 5].map((j) => `${j === 3 ? '<i class="sep">|</i>' : ""}<u class="${j < k ? timeline[j].toLowerCase() : j === k ? "cur" : ""}"></u>`).join("")}</em>`;
      if (getComputedStyle(E.duelbar).opacity < .5) show(E.duelbar, 220); else A(E.duelbar, [{ transform: "scale(1.05)" }, { transform: "none" }], { duration: 260 });
      // decor viu între confruntări
      if (k > 0 && lv === 1 && B.spin && k % 2 === 1) { const sp = B.spin; const a0 = sp._a || 0, a1 = a0 + 180; sp._a = a1; audio.sfx("slide"); A(sp, [{ transform: `${sp._base} rotateY(${a0}deg)` }, { transform: `${sp._base} rotateY(${a1}deg)` }], { duration: 1200, easing: "cubic-bezier(.6,0,.3,1)" }).then(() => { sp.style.transform = `${sp._base} rotateY(${a1}deg)`; }); }
      if (k > 0 && lv === 2 && B.slides) { audio.sfx("slide"); B.slides.forEach((sl, i) => { const o0 = sl._o || 0; const o1 = o0 ? 0 : (i ? 14 : -14); sl._o = o1; A(sl, [{ transform: `${sl._base} translate3d(0px,0px,${world.px(o0)})` }, { transform: `${sl._base} translate3d(0px,0px,${world.px(o1)})` }], { duration: 1000 }).then(() => { sl.style.transform = `${sl._base} translate3d(0px,0px,${world.px(o1)})`; }); }); }
      if (k > 0 && lv === 0 && k % 3 === 0) { audio.sfx("flicker"); A(E.dark, [{ opacity: 0 }, { opacity: .6 }, { opacity: 0 }], { duration: 500 }); }
      if (k > 0) moveCam({ ...B.cam, ...Object.fromEntries(Object.entries(CAMS[(t + k) % 6]).map(([a, b]) => [a, (B.cam[a] || 0) + b])) }, 600);
      if (full) {
        // 1) vânătorul numără, ascunsul fuge la ușă (se vede tot drumul)
        E.role.style.setProperty("--c", VEST[Hs]); E.role.querySelector("img").src = HP.av || ""; E.role.querySelector("small").textContent = `CĂUTAREA ${rnd} / 3 · SE ASCUNDE`; E.role.querySelector("b").textContent = `${HP.num} · ${HP.nick.toUpperCase()}`;
        await show(E.role, 220); pose(Sb, "eyes"); A(E.dark, [{ opacity: 0 }, { opacity: .62 }], { duration: 380 });
        const counting = k === 0 ? sing(.15, true) : (async () => { for (const n of ["3", "2", "1"]) { E.big.className = "big count"; E.big.textContent = n; show(E.big, 100); audio.sfx("tick", n === "1"); audio.voice("count_" + n); await wait(.36); hide(E.big, 80); } E.big.className = "big"; })();
        hide(E.role, 220); audio.sfx("whoosh", .7, true);
        const sneaky = v === 1; pose(Hb);
        await path3(B, Hb, hd.path, sneaky ? 75 : 95, { sneak: sneaky });
        await openDoor(hd.d, 200); await path3(B, Hb, [[hd.d.pos[0] - hd.d.n[0] * 5, hd.d.pos[1], hd.d.pos[2] - hd.d.n[2] * 5]], 60); await fade(Hb, 0, 140); await closeDoor(hd.d, 180);
        await counting; if (B.lift) liftHome(B);
        // 2) caută cu lanterna; dacă trece pe lângă ascunzătoarea reală, se vede o clipă prin crăpătură
        pose(Sb, "look"); A(E.dark, [{ opacity: .62 }, { opacity: .2 }], { duration: 380 }); audio.voice("ready");
        audio.music(2); audio.sfx("heart", 4, .5);
        const others = DOOR_KEYS.filter((d) => d !== ev.seekDoor); const hops = k === 0 ? [others[0], others[1], ev.seekDoor] : [others[k % 2], ev.seekDoor];
        for (const dk of hops) {
          const dd = doors[dk].d; dd.spot.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: 480 * SPEED }); dd.scan.animate([{ opacity: 0 }, { opacity: .9 }, { opacity: 0 }], { duration: 480 * SPEED });
          if (dk === ev.hideDoor && !ev.caught) { dd.peek.src = HP.av || ""; dd.peek.style.borderColor = VEST[Hs]; dd.panel.animate([{ transform: "rotateY(0)" }, { transform: "rotateY(-16deg)" }, { transform: "rotateY(0)" }], { duration: 480 * SPEED }); dd.peek.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: 480 * SPEED }); audio.sfx("handle"); buzz(15); }
          await wait(.46);
        }
        pose(Sb); sd.d.scan.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, fill: "forwards" }); sd.d.spot.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, fill: "forwards" });
        const last = sd.path[sd.path.length - 1]; const sideOff = sd.d.n[0] ? [0, 0, 11] : [11, 0, 2];
        await path3(B, Sb, [...sd.path.slice(0, -1), [last[0] + sideOff[0], last[1], last[2] + sideOff[2]]], 95, { follow: lv === 3 });
        // 3) suspans: camera se apropie de ușă, clanța tremură, încetinire
        const doorC = [sd.d.pos[0], sd.d.pos[1] - 18, sd.d.pos[2]];
        if (v !== 1 || k === decisive) {
          const near = [doorC[0] * .45 + sd.d.n[0] * 90, doorC[1] - 20, doorC[2] + sd.d.n[2] * 90];
          audio.sfx("heart", 3, .4); await moveCam(world.look(near, doorC), 800);
          A(E.slow, [{ opacity: 0 }, { opacity: 1 }], { duration: 280 }); audio.sfx("handle"); buzz([10, 60, 10]); sd.d.knob.animate([{ transform: "rotate(0)" }, { transform: "rotate(-25deg)" }, { transform: "rotate(10deg)" }, { transform: "rotate(-25deg)" }, { transform: "rotate(0)" }], { duration: 650 * SPEED });
          await wait(k === decisive ? .95 : .65);
        } else { audio.sfx("riser", .7); bubble(Sb, "Hmm…", .9); await wait(.6); }
      } else {
        // confruntare rapidă: fără plimbare, dar tot cu ușa, PRINS/A SCĂPAT și scorul
        pose(Sb, "eyes"); A(E.dark, [{ opacity: 0 }, { opacity: .55 }, { opacity: .2 }], { duration: 700 }); await fade(Hb, 0, 160); bubble(Sb, `${rnd}…`, .5); audio.sfx("tick", true); await wait(.55); pose(Sb, "look");
        audio.music(2); audio.sfx("heart", 2, .4);
        sd.d.scan.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, fill: "forwards" }); sd.d.spot.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, fill: "forwards" });
        const last = sd.path[sd.path.length - 1]; const sideOff = sd.d.n[0] ? [0, 0, 11] : [11, 0, 2];
        world.at(Sb, [last[0] + sideOff[0], last[1], last[2] + sideOff[2]]); await wait(.35); pose(Sb);
      }
      // 4) deschide
      audio.music(3); await openDoor(sd.d, full && v === 0 ? 480 : 280); A(E.slow, [{ opacity: 1 }, { opacity: 0 }], { duration: 260 });
      sd.d.scan.getAnimations().forEach((a) => a.cancel()); sd.d.spot.getAnimations().forEach((a) => a.cancel());
      wins[ev.winner]++; timeline.push(ev.winner);
      const c = com.event(ev, t, k);
      const head = `${esc(HP.nick)} era la <b>${sym(ev.hideDoor)}</b> · ${esc(SP.nick)} a deschis <b>${sym(ev.seekDoor)}</b> <em class="${ev.caught ? "c" : "e"}">${ev.caught ? "PRINS → punct " + esc(SP.nick) : "A SCĂPAT → punct " + esc(HP.nick)}</em>`;
      if (ev.caught) {
        world.at(Hb, inDoor(sd.d)); await fade(Hb, 1, 80); pose(Hb, "scared", "sweaty", "alert"); pose(Sb, k % 2 ? "dance" : "cheer");
        audio.sfx("impact"); audio.voice("prins"); shake(); tint = 1; flash(); buzz([70, 40, 140]);
        E.big.className = "big caught"; E.big.textContent = "PRINS!"; A(E.big, [{ opacity: 0, transform: "scale(2.4) skewX(-12deg)", filter: "blur(8px)" }, { opacity: 1, transform: "scale(.94) skewX(-4deg)", filter: "blur(0)", offset: .6 }, { opacity: 1, transform: "none" }], { duration: 400 });
        bubble(Hb, pickBubble("hiderCaught", `${key}${t}${k}`)); setTimeout(() => !destroyed && bubble(Sb, pickBubble("seekerCatch", `${key}${t}${k}`)), 650 * SPEED);
      } else {
        audio.sfx("whoosh", .5, false); pose(Sb, "sad", "sweaty"); bubble(Sb, pickBubble("seekerMiss", `${key}${t}${k}`)); await wait(full ? .4 : .2);
        await openDoor(hd.d, 260); world.at(Hb, inDoor(hd.d)); await fade(Hb, 1, 80); pose(Hb, v === 2 ? "dance" : "cheer"); audio.sfx("escape"); audio.voice("scapat"); buzz([30, 50, 30]);
        bubble(Hb, pickBubble("hiderEscape", `${key}${t}${k}`), 1.7);
        E.big.className = "big esc"; E.big.textContent = "A SCĂPAT!"; A(E.big, [{ opacity: 0, transform: "translateY(4cqh) scale(.8)" }, { opacity: 1, transform: "none" }], { duration: 360 });
      }
      E.duelbar.querySelectorAll("u")[k].className = ev.winner.toLowerCase();
      { const cnt = E.duelbar.querySelector(".cnt b"); if (cnt) { cnt.textContent = `${timeline.slice(hs, k + 1).filter((w) => w === Ss).length}/3`; A(cnt, [{ transform: "scale(1.7)" }, { transform: "none" }], { duration: 420 }); } }
      moveCam(B.cam, 600);
      const vId = { sameDoorCatch: "quip_same_door", escapeStreak: "quip_streak", blindSeeker: "quip_blind", caught: "quip_caught", escaped: "quip_escaped" }[c.category];
      audio.music(1); await wait(.3); await quip(c.text, full ? 2.3 : 1.7, vId, head);
      hide(E.big, 180); pose(Hb); pose(Sb);
      await Promise.all([closeDoor(sd.d, 200), hd !== sd ? closeDoor(hd.d, 200) : null]);
      await Promise.all([fade(ch.A, 0, 120), fade(ch.B, 0, 120)]); world.at(ch.A, home.A); world.at(ch.B, home.B); if (B.lift) liftHome(B); await Promise.all([fade(ch.A, 1, 140), fade(ch.B, 1, 140)]);
    }
    hide(E.duelbar, 200);
    // poster de tură + cartonașul rușinii
    const res = r.result; tot.A += x.ptsA; tot.B += x.ptsB;
    const te = com.turnEnd(t, r.winsA, r.winsB, x.ptsA, x.ptsB, timeline);
    if (res !== "T") { pose(ch[res], "dance"); pose(ch[res === "A" ? "B" : "A"], "sad", "sweaty"); bubble(ch[res], pickBubble("turnWin", `${key}${t}`), 2.2); bubble(ch[res === "A" ? "B" : "A"], pickBubble("turnLose", `${key}${t}`), 2.2); }
    if (t === 5 && res !== "T") { const wb = ch[res]; const gd = doors.T; openDoor(gd.d, 500); audio.voice("exit"); path3(B, wb, gd.path, 60).then(() => fade(wb, 0, 300)); confetti(); }
    audio.music(-1); res === "T" ? audio.sfx("impact", false) : audio.sfx(t === 5 ? "victory" : "impact", false); if (res !== "T") setTimeout(() => !destroyed && audio.sfx("fail"), 600 * SPEED);
    audio.voice(res === "T" ? "tie" : Math.max(r.winsA, r.winsB) === 6 ? "shutout" : "turn_win");
    const W_ = res === "T" ? null : P[res];
    E.poster.innerHTML = `<small>TURA ${t} · ${HS_LEVELS[lv]}</small><div class="res"><img alt="" src="${P.A.av || ""}" style="--c:${VEST.A}"><b><span class="sa">${r.winsA}</span>–<span class="sb">${r.winsB}</span></b><img alt="" src="${P.B.av || ""}" style="--c:${VEST.B}"></div><div class="halves"><span>Repriza 1 · <b style="color:${VEST.B}">${esc(P.B.nick)}</b> a prins ${r.events.slice(0, 3).filter((e) => e.caught).length}/3 · <b style="color:${VEST.A}">${esc(P.A.nick)}</b> a scăpat ${r.events.slice(0, 3).filter((e) => !e.caught).length}</span><span>Repriza 2 · <b style="color:${VEST.A}">${esc(P.A.nick)}</b> a prins ${r.events.slice(3).filter((e) => e.caught).length}/3 · <b style="color:${VEST.B}">${esc(P.B.nick)}</b> a scăpat ${r.events.slice(3).filter((e) => !e.caught).length}</span></div><div class="pts">${res === "T" ? `EGALITATE · ${HS_TIE_VALUES[lv]} PCT FIECARE` : `${esc(W_.nick.toUpperCase())} IA ${HS_TURN_VALUES[lv]} PCT`}</div><p>${esc(te.text)}</p><button type="button" class="go cardbtn tap">SALVEAZĂ CARTONAȘUL 🖕</button>`;
    E.poster.querySelector(".cardbtn").onclick = () => openCard({ A: P.A, B: P.B, turn: t, level: HS_LEVELS[lv], winsA: r.winsA, winsB: r.winsB, ptsA: x.ptsA, ptsB: x.ptsB, result: res, quip: te.text });
    E.poster.style.pointerEvents = "auto";
    await show(E.poster, 380); bump(".sa", tot.A); bump(".sb", tot.B);
    await wait(cinema ? 3.4 : 4.2); await hide(E.poster, 250); E.poster.style.pointerEvents = "";
  }
  async function finalPoster(P, duel, com) {
    resetUI(); world.clear(); mode = "void"; const w = duel.winner; const f = com.final(duel.totalA, duel.totalB);
    hudSet(P.A, P.B, { A: duel.totalA, B: duel.totalB }, 5); show(E.hud, 200);
    E.poster.innerHTML = `<small>FINAL · ASCUNSELEA</small><div class="res"><img alt="" src="${P.A.av || ""}" style="--c:${VEST.A}"><b><span class="sa">${duel.totalA}</span>–<span class="sb">${duel.totalB}</span></b><img alt="" src="${P.B.av || ""}" style="--c:${VEST.B}"></div><div class="pts">${w === "T" ? "🤝 EGALITATE" : `🏆 ${esc(P[w].nick.toUpperCase())} CÂȘTIGĂ DUELUL`}</div><p>${esc(f.text)}</p>`;
    audio.voice("final"); audio.sfx("victory"); if (w !== "T") confetti(90); await show(E.poster, 420); await wait(4.2);
  }
  async function duel(data) {
    const segs = duelSegments(data);
    const intro = async () => { resetUI(); mode = "void"; const H1 = world.buildHall(); setCam(H1.cam); const ca = world.actor(data.A, "A", .9), cb = world.actor(data.B, "B", .9); world.at(ca, H1.front[0]); world.at(cb, H1.front[1]); pose(ca, "cheer"); pose(cb, "cheer"); await startMenu(`${data.A.nick} vs ${data.B.nick}`, "ASCUNSELEA"); };
    if (!segs.length) { resetUI(); E.poster.innerHTML = `<small>ASCUNSELEA</small><p style="margin-top:2cqh">Nicio tură jucată încă de amândoi. Nu e nimic de arătat.</p>`; show(E.poster, 300); return; }
    await runSegs([intro, ...segs]);
  }

  // ═════════════════════ 3) ALEGEREA UȘILOR ÎN SCENĂ ═════════════════════
  // data = { me (jucător), side "A"|"B", turn, onSubmit(hide, seek) → Promise }
  function pick({ me, side = "A", turn, onSubmit }) {
    return new Promise((resolve) => {
      resetUI(); world.clear(); mode = "void"; scene2d.innerHTML = ""; q(".hsx-ctrl").querySelectorAll('[data-k="skip"],[data-k="replay"],[data-k="speed"],[data-k="pause"]').forEach((b) => { b.hidden = true; });
      const lv = turn - 1; const B = world.build(lv); setCam(B.intro); moveCam(B.cam, 1400);
      const doors = Object.fromEntries(B.doors.map((o) => [o.d.sym, o])); const meB = world.actor(me, side); const home = B.start[side === "A" ? 0 : 1]; world.at(meB, home); if (B.topView) meB.classList.add("top");
      const hide_ = [], seek_ = []; let busy = false;
      E.pickbar.hidden = false; E.tray.hidden = false; E.pickact.hidden = false; audio.music(0);
      const step = () => hide_.length + seek_.length;
      function render() {
        const n = step(); const phaseHide = hide_.length < 3;
        E.pickbar.innerHTML = n < 6 ? `<small>TURA ${turn} / 5 · ${HS_LEVELS[lv]} · ${HS_TURN_VALUES[lv]} PCT</small><b>${phaseHide ? `🫣 ASCUNZĂTOAREA ${hide_.length + 1} / 3` : `🔦 CAUȚI ${seek_.length + 1} / 3`}</b><span>${phaseHide ? "Atinge ușa în spatele căreia te ascunzi." : "Atinge ușa pe care o deschizi ca să-l cauți."}</span>`
          : `<small>TURA ${turn} / 5 · ${HS_LEVELS[lv]}</small><b>✅ GATA. Verifică și confirmă.</b><span>Alegerile tale rămân secrete până confirmă și adversarul.</span>`;
        const slots = [...[0, 1, 2].map((i) => ["🫣", hide_[i]]), ...[0, 1, 2].map((i) => ["🔦", seek_[i]])];
        E.tray.innerHTML = slots.map(([ic, d], i) => `<div class="${i === n ? "cur" : d ? "f" : ""}">${ic} ${i % 3 + 1}<b>${d ? sym(d) : ""}</b></div>`).join("");
        E.pickact.innerHTML = `${n > 0 ? `<button type="button" data-a="undo">↶ Înapoi</button>` : ""}${n === 6 ? `<button type="button" class="go" data-a="ok">🔒 CONFIRMĂ TURA ${turn}</button>` : ""}`;
        Object.values(doors).forEach((o) => { o.d.el.classList.toggle("pickable", n < 6); const b = []; hide_.forEach((d, i) => d === o.d.sym && b.push(`🫣${i + 1}`)); seek_.forEach((d, i) => d === o.d.sym && b.push(`🔦${i + 1}`)); o.d.badges.innerHTML = b.map((x) => `<span>${x}</span>`).join(""); });
      }
      async function choose(dk) {
        if (busy || destroyed) { buzz(8); return; } const n = step(); if (n >= 6) return; busy = true; audio.unlock(); buzz(18); const o = doors[dk];
        try {
          o.d.el.classList.add("chosen");
          if (hide_.length < 3) {
            hide_.push(dk); render(); audio.sfx("whoosh", .5, true);
            await path3(B, meB, o.path, 130); await openDoor(o.d, 200); await fade(meB, 0, 120); await closeDoor(o.d, 180); bubble(meB, "Shh…", .8);
            world.at(meB, home); await fade(meB, 1, 140);
          } else {
            seek_.push(dk); render(); const last = o.path[o.path.length - 1]; const off = o.d.n[0] ? [0, 0, 11] : [11, 0, 2];
            await path3(B, meB, [...o.path.slice(0, -1), [last[0] + off[0], last[1], last[2] + off[2]]], 130);
            o.d.spot.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: .35 }], { duration: 500, fill: "forwards" }); audio.sfx("handle"); await new Promise((r) => setTimeout(r, 420));
            await fade(meB, 0, 120); world.at(meB, home); await fade(meB, 1, 140);
          }
        } catch (e) { /* închis în timpul animației */ }
        o.d.el.classList.remove("chosen"); if (B.lift) liftHome(B).catch(() => {}); busy = false; render();
      }
      Object.values(doors).forEach((o) => { o.d.wrap.addEventListener("click", () => choose(o.d.sym)); o.d.wrap.setAttribute("role", "button"); o.d.wrap.setAttribute("tabindex", "0"); o.d.wrap.setAttribute("aria-label", `Ușa ${o.d.sym === "O" ? "cerc" : o.d.sym === "T" ? "triunghi" : "pătrat"}`); o.d.wrap.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") choose(o.d.sym); }); });
      E.pickact.onclick = (e) => {
        const a = e.target.closest("[data-a]")?.dataset.a; if (!a || busy) return;
        if (a === "undo") { if (seek_.length) { const d = seek_.pop(); doors[d].d.spot.getAnimations().forEach((x) => x.cancel()); } else hide_.pop(); render(); }
        if (a === "ok") confirmModal();
      };
      function confirmModal() {
        E.modal.hidden = false; E.modal.innerHTML = `<div><h4>Confirmi tura ${turn}?</h4><p>🫣 Mă ascund:</p><div class="doorsline">${hide_.map(sym).join(" ")}</div><p>🔦 Caut:</p><div class="doorsline">${seek_.map(sym).join(" ")}</div><p>După confirmare NU se mai poate schimba.</p><p class="err" style="color:#ff6b8b"></p><div class="btns"><button type="button" data-m="back">↶ Modific</button><button type="button" class="go" data-m="ok">🔒 CONFIRM</button></div></div>`;
        E.modal.onclick = async (e) => {
          const m = e.target.closest("[data-m]")?.dataset.m; if (!m) return;
          if (m === "back") { E.modal.hidden = true; return; }
          const btn = e.target; btn.disabled = true; btn.textContent = "Se salvează…";
          try { await onSubmit?.([...hide_], [...seek_]); audio.sfx("victory"); buzz([40, 50, 90]); E.modal.innerHTML = `<div><h4>✓ Tura ${turn} confirmată</h4><p>Rezultatul apare când confirmă și adversarul.</p></div>`; setTimeout(() => { resolve(true); }, 1300); }
          catch (err) { btn.disabled = false; btn.textContent = "🔒 CONFIRM"; E.modal.querySelector(".err").textContent = err?.message || "Nu s-a putut salva. Încearcă din nou."; }
        };
      }
      render();
    });
  }

  // ═════════════════════ 4) SEARA DE PROIECȚIE ═════════════════════
  // data = { players, pairs, bye, byPair {pairIdx:{turn:{A,B}}}, closed, gw }
  async function cinema({ players, pairs, bye, byPair = {}, closed = false, gw = "gw", onlyTitles = false }) {
    const pl = (u) => players[u] || { nick: "?", num: "" };
    const game = { pairs, bye }; const points = computeAllPoints(game, byPair, closed); const titles = computeTitles(game, byPair);
    const intro = async () => {
      resetUI(); mode = "void"; const H1 = world.buildHall(); setCam(H1.intro); Object.keys(players).forEach((u, i, arr) => { const a = (28 + (304 * i) / Math.max(1, arr.length - 1)) * Math.PI / 180; const bb = world.actor(pl(u), null, .82); world.at(bb, [Math.sin(a) * H1.rx, 0, H1.cz + Math.cos(a) * H1.rz]); });
      await startMenu("SEARA DE PROIECȚIE", "ASCUNSELEA", "🎬 ÎNCEPE"); moveCam(H1.cam, 2600);
      audio.music(1); audio.voice("cinema_intro");
      E.level.querySelector("small").textContent = "PLAY LEAGUE · SEZONUL 3"; E.level.querySelector("b").textContent = "SEARA DE PROIECȚIE"; E.level.querySelector("span").textContent = `${pairs.length} DUELURI · ÎN ORDINE · FĂRĂ MILĂ`;
      E.level.dataset.t0 = "scale(1.3)"; await show(E.level, 600); audio.sfx("riser", 1.4); await wait(1.4); audio.sfx("impact"); shake(); await hide(E.level, 300);
      await sing(.2, true);
    };
    const pairSeg = (p, i) => async () => {
      resetUI(); mode = "void"; const PA = pl(p.a), PB = pl(p.b); { const H1 = world.buildHall(); setCam(H1.cam); const ca = world.actor(PA, "A", .9), cb = world.actor(PB, "B", .9); world.at(ca, H1.front[0]); world.at(cb, H1.front[1]); pose(ca, "cheer"); pose(cb, "cheer"); }
      E.vs.innerHTML = `<div class="k">DUELUL ${i + 1} / ${pairs.length}</div><div class="p" style="--c:${VEST.A}"><img alt="" src="${PA.av || ""}"><b>${esc(PA.nick)}</b><small>${esc(PA.num)} · VERDE</small></div><div class="x">VS</div><div class="p" style="--c:${VEST.B}"><img alt="" src="${PB.av || ""}"><b>${esc(PB.nick)}</b><small>${esc(PB.num)} · ALBASTRU</small></div>`;
      E.vs.style.top = "30cqh"; audio.sfx("impact"); await show(E.vs, 350); await wait(1.8); await hide(E.vs, 220); E.vs.style.top = "";
      const dd = computeDuel(byPair[i] || {}, closed); const nothing = dd.turns.every((x) => x.status === "void");
      const segs = nothing ? [] : duelSegments({ A: PA, B: PB, picks: byPair[i] || {}, closed, from: 1, to: 5, key: `${gw}_${i}`, cinema: true });
      if (!segs.length) { E.poster.innerHTML = `<small>DUELUL ${i + 1}</small><div class="pts" style="margin-top:2cqh">⏳ ÎNCĂ NU S-A JUCAT</div><p>${nothing ? "Niciunul n-a confirmat vreo tură până la termen: 0 PCT amândoi." : "Nicio tură confirmată de amândoi până acum."}</p>`; await show(E.poster, 300); await wait(2.4); await hide(E.poster, 200); return; }
      for (const s of segs) await s(); // skip sare la duelul următor
    };
    const finale = async () => {
      resetUI(); mode = "void"; { const H2 = world.buildHall(); setCam(H2.cam); } audio.music(2); audio.voice("titles");
      const rows = Object.entries(points).sort((a, b) => b[1] - a[1]);
      E.grid.innerHTML = `<h3>${closed ? "REZULTATE" : "REZULTATE PROVIZORII"} · ASCUNSELEA</h3>` + rows.map(([u, v]) => `<div class="row"><span style="--c:#fff"><img alt="" src="${pl(u).av || ""}">${esc(pl(u).nick)}</span><i></i><span><b>${v} PCT</b></span></div>`).join("") + (closed ? "" : `<p style="font:700 2.6cqw/1.3 var(--txt);color:var(--muted);margin:1cqh 0 0">Termenul nu a trecut: turele nejucate nu sunt încă socotite.</p>`);
      await show(E.grid, 400); await wait(4.5); await hide(E.grid, 250);
      const tl = HS_TITLES.map((tt) => { const us = titles[tt.key] || []; return `<div class="t"><big>${tt.icon}</big><div><b>${tt.name}</b><small>${us.length ? us.map((u) => esc(pl(u).nick)).join(", ") : "nimeni anul ăsta… adică săptămâna asta"}</small><small style="color:var(--muted);font-size:2.6cqw">${tt.rule}</small></div></div>`; }).join("");
      E.grid.innerHTML = `<h3>🏅 TITLURILE SĂPTĂMÂNII</h3>${tl}<p style="font:700 2.5cqw/1.3 var(--txt);color:var(--muted);margin:1cqh 0 0">Titlurile sunt doar pentru mișto: nu dau puncte.</p>`;
      audio.sfx("victory"); confetti(90); await show(E.grid, 400); await wait(6);
    };
    await runSegs(onlyTitles ? [async () => { resetUI(); await startMenu("TITLURILE SĂPTĂMÂNII", "ASCUNSELEA", "🏅 ARATĂ"); }, finale] : [intro, ...pairs.map(pairSeg), finale]);
  }

  // ═════════════════════ cartonașul ═════════════════════
  async function openCard(d) {
    const wasPaused = paused; setPaused(true); audio.sfx("shutter");
    E.modal.hidden = false; E.modal.innerHTML = `<div><h4>🖕 Cartonașul rușinii</h4><p>Se desenează…</p></div>`;
    let blob = null; try { blob = await makeCard(d); } catch (e) { blob = null; }
    const url = blob ? URL.createObjectURL(blob) : "";
    E.modal.innerHTML = `<div>${url ? `<img class="card" alt="Cartonașul turei" src="${url}">` : "<p>Nu s-a putut desena cartonașul.</p>"}<p class="msg" style="font-size:2.8cqw;color:var(--muted)">Se trimite pe WhatsApp din meniul telefonului.</p><div class="btns"><button type="button" data-c="close">Închide</button>${blob ? `<button type="button" class="go" data-c="share">📤 Salvează / trimite</button>` : ""}</div></div>`;
    E.modal.onclick = async (e) => {
      const c = e.target.closest("[data-c]")?.dataset.c; if (!c) return;
      if (c === "close") { E.modal.hidden = true; if (url) URL.revokeObjectURL(url); if (!wasPaused) setPaused(false); return; }
      const r = await shareCard(blob, `ascunselea_tura${d.turn}_${(d.A.nick || "").replace(/\W+/g, "")}_vs_${(d.B.nick || "").replace(/\W+/g, "")}.png`);
      E.modal.querySelector(".msg").textContent = r === "shared" ? "✓ Trimis." : r === "downloaded" ? "✓ Salvat în Descărcări." : r === "cancelled" ? "Anulat." : "Aici nu se poate salva (ex. în pagina demo). În aplicație merge.";
    };
  }

  function destroy() { if (destroyed) return; destroyed = true; ctl = "close"; cancelAnimationFrame(raf); ro?.disconnect(); scripted().forEach((a) => a.cancel()); audio.music(-1); audio.destroy(); host.innerHTML = ""; host.classList.remove("hsx"); }
  return { draw, duel, pick, cinema, openCard, destroy, get audio() { return audio; } };
}
