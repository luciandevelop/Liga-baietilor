// ══════════════════════════════════════════════════════════════════
// 🏗️ ASCUNSELEA — LUMEA 3D (CSS 3D, fără WebGL: ușor pentru telefon). Doar construiește DOM-ul;
// animațiile le face regizorul (hsStage.js). Unități: 1 = 1% din lățimea scenei.
// Sistem: x dreapta, y în jos (sus = negativ), z spre privitor. Podeaua e la y = 0.
// ══════════════════════════════════════════════════════════════════
export const DOOR_KEYS = ["O", "T", "S"];
export const DOOR_COLOR_VAR = { O: "--pink", T: "--mint", S: "--gold" };
export const DOOR_SVG = {
  O: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="34" fill="none" stroke="#fff" stroke-width="10"/></svg>',
  T: '<svg viewBox="0 0 100 100"><path d="M50 14 L88 82 L12 82 Z" fill="none" stroke="#fff" stroke-width="10" stroke-linejoin="round"/></svg>',
  S: '<svg viewBox="0 0 100 100"><rect x="18" y="18" width="64" height="64" fill="none" stroke="#fff" stroke-width="10"/></svg>',
};
export const SUIT = { boss: ["#2b2b33", "#121218"], vip: ["#d9b24a", "#8a6a1c"], guard: ["#ff4f8b", "#b3245a"], player: ["#1fa58f", "#0f6a5b"] };
export const VEST = { A: "#1fd46a", B: "#3d7bff" };
export const roleOf = (num) => { const n = Number(num); return n === 1 ? "boss" : n >= 2 && n <= 4 ? "vip" : n >= 5 && n <= 10 ? "guard" : "player"; };

// ── personaj „cap mare” ──
export function makeChar(p, vest) {
  const el = document.createElement("div"); el.className = "ch"; if (p.bald) el.dataset.bald = "1";
  const [s1, s2] = SUIT[p.role || roleOf(p.num)] || SUIT.player; el.style.setProperty("--suit", s1); el.style.setProperty("--suitD", s2);
  if (vest) { el.style.setProperty("--vest", VEST[vest]); el.style.setProperty("--ring", VEST[vest]); }
  el.innerHTML = `<div class="sh"></div><div class="inner"><i class="lg l"></i><i class="lg r"></i><i class="ar l"></i><i class="ar r"></i><div class="bd"><div class="vest"><span>${p.num || ""}</span></div></div><div class="hd"><img alt="" src="${p.av || ""}"></div><div class="sweat"><i></i><i></i><i></i></div><div class="nm">${p.num || ""} · ${(p.nick || "").toUpperCase()}</div><div class="bub"></div><div class="mark">!</div></div>`;
  return el;
}
export const setVest = (el, v) => { el.style.setProperty("--vest", VEST[v]); el.style.setProperty("--ring", VEST[v]); };

export function createWorld(s3d, stageEl) {
  let U = 4;
  const px = (v) => (v * U).toFixed(2) + "px";
  const tr = (x, y, z) => `translate3d(${px(x)},${px(y)},${px(z)})`;
  function plane(p, w, h, x, y, z, rot = "", style = {}, cls = "") {
    const e = document.createElement("div"); e.className = "p3 " + cls; e.style.width = px(w); e.style.height = px(h);
    e.style.transform = `${tr(x, y, z)} ${rot} translate(-50%,-50%)`; Object.assign(e.style, style); p.appendChild(e); return e;
  }
  function group(p, x, y, z) { const g = document.createElement("div"); g.className = "g3"; g._base = tr(x, y, z); g._pos = [x, y, z]; g.style.transform = g._base; p.appendChild(g); return g; }
  const flr = (p, w, d, x, y, z, bg) => plane(p, w, d, x, y, z, "rotateX(90deg)", { background: bg });
  const wB = (p, w, h, x, y, z, bg) => plane(p, w, h, x, y, z, "", { background: bg });
  function box3(p, cx, cz, w, d, yTop, h, c, glow) {
    const t = flr(p, w, d, cx, yTop, cz, c.top); if (glow) t.style.boxShadow = `inset 0 0 0 ${px(.5)} ${glow}, 0 0 ${px(3)} ${glow}`;
    wB(p, w, h, cx, yTop + h / 2, cz + d / 2, c.front);
    plane(p, d, h, cx - w / 2, yTop + h / 2, cz, "rotateY(-90deg)", { background: c.side }); plane(p, d, h, cx + w / 2, yTop + h / 2, cz, "rotateY(90deg)", { background: c.side });
  }
  const PAL = { pink: ["#f7a9c4", "#e98bb0", "#ff3d8b"], mint: ["#a6eadb", "#78cdb9", "#1fe3c2"], yellow: ["#f9df93", "#ebc65f", "#ffd23f"], lilac: ["#cfc0f4", "#a993e6", "#b99bff"], teal: ["#6fc7bb", "#3e9c90", "#1fe3c2"], wine: ["#5a1522", "#2e0810", "#ff2448"] };
  const wallBg = (k, fade = null) => { const [a, b, n] = PAL[k];
    return `${fade ? `linear-gradient(${fade}, rgba(10,6,24,0) 0%, rgba(10,6,24,.55) 100%),` : ""} linear-gradient(180deg, transparent 0 78%, rgba(30,10,40,.28) 95%, transparent 95.5%), linear-gradient(180deg, rgba(255,255,255,.16), transparent 22%), linear-gradient(180deg, transparent 0 64%, rgba(255,255,255,.85) 64% 65.4%, rgba(0,0,0,.06) 65.4% 100%), linear-gradient(180deg, transparent 0 96%, ${n} 96% 100%), repeating-linear-gradient(90deg, rgba(255,255,255,.07) 0 ${px(.4)}, transparent ${px(.4)} ${px(14)}), linear-gradient(180deg, ${a}, ${b})`; };
  const tiles = (a = "#f4ece2", b = "#e4d6c6", sz = 10) => `radial-gradient(120% 80% at 50% 0%, rgba(255,255,255,.35), transparent 60%), repeating-conic-gradient(${a} 0 25%, ${b} 0 50%) 0 0 / ${px(sz)} ${px(sz)}`;
  const ceilBg = (n) => `linear-gradient(90deg, transparent 0 22%, ${n} 22% 23%, transparent 23% 77%, ${n} 77% 78%, transparent 78%), #221a35`;
  function room(p, W, H, D, k, lvNo) {
    flr(p, W, D, 0, 0, -D / 2, k.floor || tiles());
    flr(p, W, D, 0, -.05, -D / 2, "radial-gradient(70% 60% at 50% 50%, transparent 55%, rgba(25,8,35,.45) 100%)");
    if (!k.noLights) [-.28, 0, .28].forEach((fx) => [.3, .62].forEach((fz) => flr(p, W * .34, D * .26, W * fx, -.1, -D * fz, "radial-gradient(closest-side, rgba(255,255,255,.22), rgba(255,220,240,.08) 60%, transparent)")));
    if (!k.noCeil) plane(p, W, D, 0, -H, -D / 2, "rotateX(-90deg)", { background: ceilBg(PAL[k.back][2]) });
    wB(p, W, H, 0, -H / 2, -D, wallBg(k.back));
    plane(p, D, H, -W / 2, -H / 2, -D / 2, "rotateY(90deg)", { background: wallBg(k.left, "90deg") });
    plane(p, D, H, W / 2, -H / 2, -D / 2, "rotateY(-90deg)", { background: wallBg(k.right, "270deg") });
    // marcaj pe podea: progresul vertical (aceeași clădire, alt etaj)
    const lab = plane(p, 44, 8, 0, -.2, -30, "rotateX(90deg)", { fontSize: px(4.2) }, ""); lab.textContent = `NIVELUL ${lvNo} ▲`;
    Object.assign(lab.style, { display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--hud)", fontWeight: 700, letterSpacing: ".2em", color: "rgba(255,255,255,.55)", border: `${px(.4)} solid rgba(255,255,255,.35)`, borderRadius: px(2) });
    if (!lvNo) lab.remove(); // sala de la parter nu are marcaj pe podea
  }
  function door3(p, sym, x, y, z, rot, w, normal, gateLabel) {
    const h = w * 50 / 24; const wr = plane(p, w, h, x, y - h / 2, z, rot, {}, "dwrap"); wr.dataset.door = sym;
    const d = document.createElement("div"); d.className = "door" + (w <= 19 ? " small" : ""); d.style.setProperty("--c", `var(${DOOR_COLOR_VAR[sym]})`); d.style.fontSize = (w * U / 24).toFixed(3) + "px";
    d.innerHTML = `<div class="plate">${gateLabel ? "IEȘIREA" : "UȘA"} ${sym === "O" ? "○" : sym === "T" ? "△" : "□"}</div><div class="frame"></div><div class="inside"><img class="peek" alt=""></div><div class="hinge"><div class="panel"><div class="sym">${DOOR_SVG[sym]}</div><div class="knob"></div><div class="led"></div></div></div><div class="spot"></div><div class="scanbox"></div><div class="badges"></div><div class="hit"></div>`;
    wr.appendChild(d);
    const gj = group(p, x, y - h / 2, z); gj.style.transform = `${gj._base} ${rot}`;
    const jamb = { background: "linear-gradient(90deg,#2a2140,#4a3d66 50%,#2a2140)" };
    plane(gj, 3.2, h + 1.6, -w / 2 - .4, 0, 1.6, "rotateY(90deg)", jamb); plane(gj, 3.2, h + 1.6, w / 2 + .4, 0, 1.6, "rotateY(90deg)", jamb);
    plane(gj, w + 1, 3.2, 0, -h / 2 - .6, 1.6, "rotateX(90deg)", { background: "#3a3052" });
    plane(gj, w + 4.2, h + 3.2, 0, -.6, 3.2, "", { border: `${px(1.4)} solid var(${DOOR_COLOR_VAR[sym]})`, borderBottom: "none", borderRadius: `${px(3)} ${px(3)} 0 0`, boxShadow: `0 0 ${px(3)} var(${DOOR_COLOR_VAR[sym]}), inset 0 0 ${px(2)} rgba(0,0,0,.5)` });
    const floor = plane(gj, w * 1.8, 30, 0, h / 2 - .15, 15, "rotateX(90deg)", { background: `radial-gradient(60% 55% at 50% 0%, color-mix(in srgb, var(${DOOR_COLOR_VAR[sym]}) 70%, transparent), transparent 75%)`, opacity: 0 });
    return { wrap: wr, el: d, sym, floor, panel: d.querySelector(".panel"), knob: d.querySelector(".knob"), scan: d.querySelector(".scanbox"), spot: d.querySelector(".spot"), peek: d.querySelector(".peek"), badges: d.querySelector(".badges"), pos: [x, y, z], n: normal };
  }
  const C = (top, front, side) => ({ top, front, side });
  const PINK = C("#fff3f8", "#f7a9c4", "#e98bb0"), MINT = C("#f6fffc", "#a6eadb", "#78cdb9"), YEL = C("#fffbe8", "#f9df93", "#ebc65f"), LIL = C("#f5f0ff", "#cfc0f4", "#a993e6");

  // ── cele 5 niveluri (aceeași clădire, urci câte un etaj) ──
  const BUILD = [
    // 1 · HOLUL: hol roz, trei uși în fund, lumini pe tavan care pâlpâie, scări pastel pe pereți
    (p) => {
      const W = 104, H = 72, D = 130; room(p, W, H, D, { back: "pink", left: "mint", right: "mint" }, 1);
      for (let i = 0; i < 5; i++) box3(p, -W / 2 + 6, -30 - i * 12, 12, 12, -6 - i * 9, 6 + i * 9, PINK);
      for (let i = 0; i < 5; i++) box3(p, W / 2 - 6, -78 + i * 12, 12, 12, -6 - i * 9, 6 + i * 9, YEL);
      const lights = [-30, 0, 30].map((x) => plane(p, 6, D * .8, x, -H + .5, -D / 2, "rotateX(-90deg)", { background: "linear-gradient(90deg,transparent,#fff 40%,#fff 60%,transparent)", boxShadow: `0 0 ${px(6)} #ff9ec4` }));
      const doors = [["O", -34], ["T", 0], ["S", 34]].map(([s, x]) => ({ d: door3(p, s, x, 0, -D + .4, "", 23, [0, 0, 1]), path: [[x * .6, 0, -70], [x, 0, -D + 12]] }));
      return { doors, lights, start: [[-24, 0, -66], [24, 0, -66]], cam: { x: 0, y: -38, z: 26, rx: -8 }, intro: { x: 0, y: -58, z: 110, rx: -14 } };
    },
    // 2 · SCĂRILE ÎNCRUCIȘATE: paliere la înălțimi diferite + un pod central care se rotește între confruntări
    (p) => {
      const W = 116, H = 110, D = 125; room(p, W, H, D, { back: "yellow", left: "lilac", right: "pink" }, 2);
      for (let i = 0; i < 7; i++) box3(p, -36, -34 - i * 8, 26, 8, -(i + 1) * 5, (i + 1) * 5, PINK, i === 6 ? "#ff3d8b" : null);
      box3(p, -36, -106, 30, 36, -35, 35, PINK, "#ff3d8b");
      for (let i = 0; i < 4; i++) box3(p, 36, -44 - i * 9, 26, 9, -(i + 1) * 4.5, (i + 1) * 4.5, MINT, i === 3 ? "#1fe3c2" : null);
      box3(p, 36, -102, 30, 40, -18, 18, MINT, "#1fe3c2");
      const spin = group(p, 0, -66, -78); // podul + treptele lui (decor care se rotește)
      box3(spin, 0, 0, 40, 9, 0, 4, LIL, "#b99bff"); for (let i = 0; i < 5; i++) box3(spin, 22 + i * 6, 0, 6, 9, i * 6, 4, LIL);
      for (let i = 0; i < 5; i++) box3(spin, -22 - i * 6, 0, 6, 9, -i * 6 - 6, 4, YEL);
      const doors = [
        { d: door3(p, "O", -36, -35, -D + .4, "", 21, [0, 0, 1]), path: [[-36, 0, -28], [-36, -35, -90], [-36, -35, -D + 10]] },
        { d: door3(p, "T", 0, 0, -D + .4, "", 21, [0, 0, 1]), path: [[0, 0, -60], [0, 0, -D + 10]] },
        { d: door3(p, "S", 36, -18, -D + .4, "", 21, [0, 0, 1]), path: [[36, 0, -36], [36, -18, -84], [36, -18, -D + 10]] },
      ];
      return { doors, spin, start: [[-14, 0, -64], [14, 0, -64]], cam: { x: 0, y: -52, z: 38, rx: -12 }, intro: { x: 0, y: -8, z: 60, rx: 10 } };
    },
    // 3 · LABIRINTUL: văzut de sus, pereți joși cu neon, pereți care alunecă, o pasarelă deasupra
    (p) => {
      const W = 136, H = 70, D = 175; room(p, W, H, D, { back: "teal", left: "mint", right: "mint", noCeil: true }, 3); const c = C("#eafff9", "#a6eadb", "#5fb8a5"), n = "#1fe3c2";
      box3(p, -42, -62, 52, 6, -42, 42, c, n); box3(p, 42, -62, 52, 6, -42, 42, c, n); box3(p, 0, -118, 64, 6, -42, 42, c, n); box3(p, 52, -126, 6, 44, -42, 42, c, n);
      const s1 = group(p, -50, 0, -146); box3(s1, 0, 0, 6, 52, -42, 42, c, n);
      const s2 = group(p, -16, 0, -150); box3(s2, 0, 0, 6, 40, -42, 42, c, n);
      const bridge = group(p, 0, -58, -92); box3(bridge, 0, 0, 120, 8, 0, 3, C("#fff", "#cfc0f4", "#a993e6"), "#b99bff");
      [-1, 1].forEach((sd) => plane(bridge, 120, 5, 0, -2.5, sd * 4, "", { background: "linear-gradient(180deg,rgba(185,155,255,.0),rgba(185,155,255,.7))", borderTop: `${px(.4)} solid #b99bff` }));
      const doors = [
        { d: door3(p, "O", -42, 0, -58.8, "", 19, [0, 0, 1]), path: [[-42, 0, -48]] },
        { d: door3(p, "T", 0, 0, -114.8, "", 19, [0, 0, 1]), path: [[0, 0, -50], [0, 0, -104]] },
        { d: door3(p, "S", 48.8, 0, -128, "rotateY(-90deg)", 19, [-1, 0, 0]), path: [[0, 0, -50], [22, 0, -90], [38, 0, -128]] },
      ];
      return { doors, slides: [s1, s2], topView: true, start: [[-12, 0, -28], [12, 0, -28]], cam: { x: 0, y: -112, z: 34, rx: -40 }, intro: { x: 0, y: -160, z: -50, rx: -80 } };
    },
    // 4 · TURNUL: trei etaje cu balcoane; liftul urcă între etaje
    (p) => {
      const W = 116, H = 180, D = 112; room(p, W, H, D, { back: "lilac", left: "pink", right: "yellow" }, 4);
      box3(p, -8, -100, 100, 24, -55, 7, LIL, "#b99bff"); box3(p, -8, -100, 100, 24, -110, 7, LIL, "#b99bff");
      for (let i = 0; i < 9; i++) box3(p, -50, -26 - i * 6, 14, 6, -(i + 1) * 5, 5, PINK, i === 8 ? "#ff3d8b" : null);
      // puțul liftului (șine luminoase) + cabina (se mișcă)
      [-10, 10].forEach((dx) => plane(p, 1.2, 160, 44 + dx, -80, -80, "", { background: "linear-gradient(180deg,#ffd23f,#ff3d8b)", boxShadow: `0 0 ${px(3)} #ffd23f` }));
      const lift = group(p, 44, 0, -80); box3(lift, 0, 0, 20, 16, -2, 2, C("#fffbe8", "#ffd23f", "#d8b04a"), "#ffd23f");
      plane(lift, 20, 30, 0, -17, -8, "", { background: "linear-gradient(180deg,rgba(255,210,63,.35),rgba(255,210,63,.05))", border: `${px(.5)} solid #ffd23f` }, "liftcab");
      lift._y = 0;
      const toLift = (y) => [[44, 0, -60], [44, 0, -80], { lift: y }];
      const doors = [
        { d: door3(p, "O", -34, -55, -D + .4, "", 18, [0, 0, 1]), path: [...toLift(-55), [44, -55, -97], [-34, -55, -98], [-34, -55, -D + 9]] },
        { d: door3(p, "T", 10, -110, -D + .4, "", 18, [0, 0, 1]), path: [...toLift(-110), [44, -110, -97], [10, -110, -98], [10, -110, -D + 9]] },
        { d: door3(p, "S", 0, 0, -D + .4, "", 18, [0, 0, 1]), path: [[0, 0, -60], [0, 0, -D + 9]] },
      ];
      return { doors, lift, start: [[-20, 0, -52], [20, 0, -52]], cam: { x: 0, y: -80, z: 78, rx: -2 }, intro: { x: 0, y: -12, z: 30, rx: 32 } };
    },
    // 5 · EXIT: sala roșie, coloane, girofaruri, semnul EXIT cu numărătoare, trei porți
    (p) => {
      const W = 124, H = 96, D = 175; room(p, W, H, D, { back: "wine", left: "wine", right: "wine", floor: `radial-gradient(60% 40% at 50% 100%, rgba(255,36,72,.35), transparent 70%), repeating-linear-gradient(90deg, rgba(255,255,255,.05) 0 ${px(.3)}, transparent ${px(.3)} ${px(12)}), linear-gradient(180deg, #2a0710, #12030a)` }, 5);
      for (let i = 0; i < 4; i++) [-1, 1].forEach((sd) => box3(p, sd * (W / 2 - 8), -30 - i * 38, 10, 10, -H, H, C("#3a0b14", "linear-gradient(90deg,#4a0f1b,#7a1a2a 50%,#4a0f1b)", "#2a0710"), "#ff2448"));
      const sign = plane(p, 62, 16, 0, -84, -D + 1, "", { fontSize: px(11) }, "exit3"); sign.textContent = "EXIT";
      const beacons = [-50, 50].map((x) => plane(p, 10, 10, x, -84, -D + 1, "", {}, "beacon"));
      const doors = [["O", -38], ["T", 0], ["S", 38]].map(([s, x]) => ({ d: door3(p, s, x, 0, -D + .4, "", 28, [0, 0, 1], true), path: [[x * .5, 0, -110], [x, 0, -D + 14]] }));
      return { doors, sign, beacons, start: [[-24, 0, -94], [24, 0, -94]], cam: { x: 0, y: -44, z: 12, rx: -6 }, intro: { x: 0, y: -40, z: 150, rx: -3 } };
    },
  ];

  let cam = null;
  return {
    get U() { return U; }, px, tr,
    get cam() { return cam; },
    build(lv) {
      s3d.innerHTML = ""; s3d.hidden = false; const r = stageEl.getBoundingClientRect(); U = (r.width || 400) / 100; s3d.style.perspective = (110 * U) + "px";
      cam = document.createElement("div"); cam.className = "cam"; s3d.appendChild(cam); const B = BUILD[lv](cam); B.lv = lv; return B;
    },
    buildHall() {
      s3d.innerHTML = ""; s3d.hidden = false; const r = stageEl.getBoundingClientRect(); U = (r.width || 400) / 100; s3d.style.perspective = (110 * U) + "px";
      cam = document.createElement("div"); cam.className = "cam"; s3d.appendChild(cam); const p = cam;
      const W = 140, H = 90, D = 160, cz = -86;
      const rings = "radial-gradient(ellipse 46% 40% at 50% 46%, transparent 0 60%, #ff3d8b 60% 62%, transparent 62% 74%, #1fe3c2 74% 76%, transparent 76% 88%, #ffd23f 88% 90%, transparent 90%), radial-gradient(ellipse 20% 17% at 50% 46%, rgba(255,61,139,.35), transparent 100%)";
      room(p, W, H, D, { back: "pink", left: "lilac", right: "mint", floor: `${rings}, ${tiles("#f1e6f0", "#e2d2e0", 12)}` }, 0);
      for (let i = 0; i < 6; i++) box3(p, -W / 2 + 8, -40 - i * 14, 16, 14, -6 - i * 10, 6 + i * 10, PINK);
      for (let i = 0; i < 6; i++) box3(p, W / 2 - 8, -110 + i * 14, 16, 14, -6 - i * 10, 6 + i * 10, YEL);
      for (let i = 0; i < 4; i++) box3(p, -30 + i * 20, -D + 10, 14, 12, -8 - (i % 2) * 8, 8 + (i % 2) * 8, i % 2 ? MINT : LIL);
      const sign = plane(p, 80, 14, 0, -H + 22, -D + 1, "", { fontSize: px(7) }, "exit3"); sign.textContent = "○ △ □"; sign.style.letterSpacing = ".5em";
      const step = 7, N = 24; for (let i = 0; i < N; i++) { const a = (30 + 300 * i / (N - 1)) * Math.PI / 180; const x = Math.sin(a) * 46 * 1.28, z = cz + Math.cos(a) * 34 * 1.28; box3(p, x, z, 15, 11, -step, step, i % 2 ? C("#fff3f8", "#f7a9c4", "#e98bb0") : C("#f6fffc", "#a6eadb", "#78cdb9"), i % 3 === 0 ? "#ff3d8b" : null); }
      return { cz, rx: 46, rz: 34, step, front: [[-12, 0, cz + 50], [12, 0, cz + 50]], cam: { x: 0, y: -74, z: 44, rx: -26 }, intro: { x: 0, y: -40, z: 120, rx: -8 } };
    },
    clear() { s3d.innerHTML = ""; s3d.hidden = true; cam = null; },
    camT(c) { return `translateZ(${110 * U}px) rotateX(${c.rx || 0}deg) rotateY(${c.ry || 0}deg) translate3d(${px(-c.x)},${px(-c.y)},${px(-c.z)})`; },
    // cameră care privește spre un punct (fără rotații complicate pentru regizor)
    look(pos, target) { const dx = target[0] - pos[0], dy = target[1] - pos[1], dz = target[2] - pos[2]; const ry = Math.atan2(dx, -dz) * 57.2958; const r = Math.hypot(dx, dz); const rx = -Math.atan2(dy, r) * 57.2958; return { x: pos[0], y: pos[1], z: pos[2], rx, ry }; },
    actor(pl, vest, scale = .92) {
      const bb = document.createElement("div"); bb.className = "bb"; bb.style.fontSize = (U * scale) + "px"; cam.appendChild(bb);
      const ch = makeChar(pl, vest); bb.appendChild(ch); bb._ch = ch; return bb;
    },
    at(bb, p) { bb._p = [p[0], p[1], p[2]]; bb.style.transform = `${tr(p[0], p[1], p[2])} translate(-50%,-100%)`; },
    bbT(p) { return `${tr(p[0], p[1], p[2])} translate(-50%,-100%)`; },
  };
}
