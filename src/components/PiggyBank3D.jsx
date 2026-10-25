import { useEffect, useRef } from "react";
import * as THREE from "three";

// ══════════════════════════════════════════════════════════════════
// 🐷 PUȘCULIȚA 3D — componenta de prezentare (aprobată din prototip).
//
// DOAR afișare: primește lista jucătorilor eliminați și îi arată ca
// monede cu portrete în pușculița de sticlă. Nu calculează nimic, nu
// citește și nu scrie nimic în Firestore.
//
//   coins: [{ id, avatarSrc, number, name }] — în ordinea eliminării.
//   instant: true  → toate monedele apar direct pe locurile lor (fără cădere).
//            false → monedele NOI (față de randarea anterioară) cad una câte una.
//   onLanded(id): apelat când o monedă s-a așezat (ex. pentru contor).
//   onUnsupported(): apelat dacă telefonul nu poate afișa 3D.
//
// Three.js se încarcă doar unde e folosită componenta (ecranul Pușculiței),
// deci restul aplicației nu devine mai grea.
// ══════════════════════════════════════════════════════════════════

export function supportsWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch {
    return false;
  }
}

const R = 0.2;
const TH = 0.04;

// Locurile portretelor în burtă: rânduri în fagure, de jos în sus (23 locuri).
const SLOTS = (() => {
  const rows = [[-0.6, 5], [-0.22, 6], [0.16, 5], [0.48, 4], [0.74, 3]];
  const out = [];
  rows.forEach(([y, n], ri) => {
    const st = 0.385, span = (n - 1) * st;
    for (let k = 0; k < n; k++) out.push(new THREE.Vector3(-span / 2 + k * st - 0.05, y, 0.32 - ri * 0.04));
  });
  return out;
})();

export default function PiggyBank3D({ coins = [], instant = false, onLanded, onUnsupported, height = 340 }) {
  const wrapRef = useRef(null);
  const apiRef = useRef(null);
  const landedRef = useRef(onLanded);
  landedRef.current = onLanded;

  // ── Scena: se construiește o singură dată. ──
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return undefined;
    if (!supportsWebGL()) { onUnsupported?.(); return undefined; }
    const api = buildScene(wrap, (id) => landedRef.current?.(id));
    if (!api) { onUnsupported?.(); return undefined; }
    apiRef.current = api;
    return () => { api.dispose(); apiRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Monedele: sincronizare cu lista primită. ──
  useEffect(() => {
    apiRef.current?.sync(coins, instant);
  }, [coins, instant]);

  return <div ref={wrapRef} style={{ position: "relative", width: "100%", height, touchAction: "pan-y" }} aria-label="Pușculița 3D" role="img" />;
}

function buildScene(wrap, notifyLanded) {
  const T = THREE;
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "display:block;width:100%;height:100%";
  wrap.appendChild(canvas);
  let renderer;
  try {
    renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch {
    wrap.removeChild(canvas);
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.physicallyCorrectLights = true;
  renderer.setClearColor(0x000000, 0);

  const disposables = [];
  const track = (x) => { disposables.push(x); return x; };

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(32, 1, 0.1, 100);

  // Mediu pentru reflexii, fără fișiere externe.
  (function () {
    const env = new T.Scene();
    env.add(new T.Mesh(new T.SphereGeometry(10, 32, 16), new T.MeshBasicMaterial({ color: 0x0a1f1c, side: T.BackSide })));
    const panel = (w, h, col, x, y, z, ry, rx) => {
      const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: col, side: T.DoubleSide }));
      m.position.set(x, y, z); m.rotation.y = ry || 0; m.rotation.x = rx || 0; env.add(m);
    };
    panel(6, 2, 0xffe2a0, 0, 7, 0, 0, Math.PI / 2);
    panel(2.2, 5, 0xfff3d6, -6, 1, 2, Math.PI / 2.4);
    panel(1.4, 4, 0x7fe6cf, 6, 0.5, -1, -Math.PI / 2.2);
    panel(4, 1, 0xff6aa2, 0, -1, -7, 0);
    const pm = new T.PMREMGenerator(renderer);
    scene.environment = track(pm.fromScene(env, 0.03).texture);
    pm.dispose();
    env.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
  })();

  // Lumini
  scene.add(new T.HemisphereLight(0x9fe8d8, 0x050c0b, 0.35));
  const spot = new T.SpotLight(0xffd27a, 520, 0, Math.PI / 7, 0.55, 2);
  spot.position.set(0, 7.5, 1.2); spot.target.position.set(0, 0, 0); scene.add(spot, spot.target);
  const rim = new T.DirectionalLight(0x8ff0da, 2.2); rim.position.set(-4, 2, -5); scene.add(rim);
  const key = new T.DirectionalLight(0xfff0d0, 1.6); key.position.set(4, 3, 5); scene.add(key);

  // Conul vizibil de lumină
  const coneMat = track(new T.ShaderMaterial({
    transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
    uniforms: { c: { value: new T.Color(0xffcf6b) } },
    vertexShader: "varying float vY;void main(){vY=position.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: "uniform vec3 c;varying float vY;void main(){float a=smoothstep(-3.6,3.6,vY)*0.11;gl_FragColor=vec4(c,a);}",
  }));
  const cone = new T.Mesh(track(new T.CylinderGeometry(0.15, 2.6, 7.2, 48, 1, true)), coneMat);
  cone.position.set(0, 3.6, 0.4); scene.add(cone);

  // ── Porcul de sticlă ──
  const pig = new T.Group(); scene.add(pig);
  const holder = new T.Group(); pig.add(holder);
  const glass = track(new T.MeshPhysicalMaterial({
    color: 0xd9fff4, metalness: 0, roughness: 0.03, transparent: true, opacity: 0.08,
    clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 2.2, depthWrite: false, side: T.DoubleSide,
  }));
  const glassDark = track(new T.MeshPhysicalMaterial({ color: 0x0c3a33, roughness: 0.1, transparent: true, opacity: 0.45, clearcoat: 1, envMapIntensity: 1.5, depthWrite: false }));
  const rimMat = track(new T.ShaderMaterial({
    transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    uniforms: { c1: { value: new T.Color(0x9ff5df) }, c2: { value: new T.Color(0xffd27a) } },
    vertexShader: "varying vec3 vN;varying vec3 vV;varying float vY;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);vY=position.y;gl_Position=projectionMatrix*mv;}",
    fragmentShader: "uniform vec3 c1;uniform vec3 c2;varying vec3 vN;varying vec3 vV;varying float vY;void main(){float f=pow(1.-abs(dot(vN,vV)),2.6);vec3 c=mix(c1,c2,smoothstep(-0.2,1.0,vY));gl_FragColor=vec4(c,f*0.75);}",
  }));
  const gold = track(new T.MeshStandardMaterial({ color: 0xf5c451, metalness: 1, roughness: 0.22, envMapIntensity: 1.4 }));
  const glassMesh = (g) => {
    track(g);
    const grp = new T.Group();
    const m = new T.Mesh(g, glass); m.renderOrder = 2;
    const r = new T.Mesh(g, rimMat); r.renderOrder = 3;
    grp.add(m, r); return grp;
  };

  // corp
  (function () {
    const g = new T.SphereGeometry(1, 96, 64); const p = g.attributes.position; const v = new T.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      let x = v.x * 1.42, y = v.y * 1.02, z = v.z * 1.08;
      if (y < 0) y *= 0.92;
      x += (y > 0 ? 0.06 : 0) * (1 - Math.abs(v.x));
      if (v.x > 0.6) { y *= 1 - (v.x - 0.6) * 0.18; z *= 1 - (v.x - 0.6) * 0.12; }
      p.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals();
    holder.add(glassMesh(g));
  })();
  // bot
  const snout = glassMesh(new T.CylinderGeometry(0.36, 0.42, 0.34, 64, 1, false));
  snout.rotation.z = Math.PI / 2; snout.position.set(1.43, -0.05, 0); holder.add(snout);
  const snoutFace = new T.Mesh(track(new T.CircleGeometry(0.36, 48)), glassDark);
  snoutFace.rotation.y = Math.PI / 2; snoutFace.position.set(1.605, -0.05, 0); holder.add(snoutFace);
  const darkMat = track(new T.MeshStandardMaterial({ color: 0x02100e, roughness: 0.3 }));
  const nostril = track(new T.CapsuleGeometry(0.045, 0.08, 6, 12));
  [-0.11, 0.11].forEach((z) => { const n = new T.Mesh(nostril, darkMat); n.position.set(1.615, -0.05, z); n.rotation.x = Math.PI / 2; holder.add(n); });
  // ochi
  const eyeMat = track(new T.MeshStandardMaterial({ color: 0x030c0b, roughness: 0.15, metalness: 0.2 }));
  const eyeGeo = track(new T.SphereGeometry(0.07, 24, 16));
  [-0.36, 0.36].forEach((z) => { const e = new T.Mesh(eyeGeo, eyeMat); e.position.set(1.12, 0.36, z); holder.add(e); });
  // urechi
  [-1, 1].forEach((sd) => {
    const g = new T.ConeGeometry(0.24, 0.46, 40, 1); g.scale(1, 1, 0.42); g.translate(0, 0.2, 0);
    const ear = glassMesh(g); ear.position.set(0.78, 0.82, 0.44 * sd); ear.rotation.set(0.28 * sd, 0, -0.5); holder.add(ear);
  });
  // picioare
  const legGeo = new T.CapsuleGeometry(0.2, 0.42, 10, 24);
  [[0.8, 0.5], [0.8, -0.5], [-0.75, 0.5], [-0.75, -0.5]].forEach(([x, z]) => { const l = glassMesh(legGeo); l.position.set(x, -1.08, z); holder.add(l); });
  // codiță
  (function () {
    const pts = [];
    for (let i = 0; i <= 60; i++) { const t = i / 60, a = t * Math.PI * 3.2; pts.push(new T.Vector3(-1.42 - t * 0.32, 0.18 + Math.sin(a) * 0.11 + t * 0.12, Math.cos(a) * 0.11)); }
    holder.add(glassMesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 120, 0.035, 12, false)));
  })();
  // fanta aurie
  (function () {
    const w = 0.62, h = 0.15, r = 0.07; const outer = new T.Shape();
    const rr = (s, w2, h2, r2) => {
      s.moveTo(-w2 / 2 + r2, -h2 / 2); s.lineTo(w2 / 2 - r2, -h2 / 2); s.quadraticCurveTo(w2 / 2, -h2 / 2, w2 / 2, -h2 / 2 + r2);
      s.lineTo(w2 / 2, h2 / 2 - r2); s.quadraticCurveTo(w2 / 2, h2 / 2, w2 / 2 - r2, h2 / 2); s.lineTo(-w2 / 2 + r2, h2 / 2);
      s.quadraticCurveTo(-w2 / 2, h2 / 2, -w2 / 2, h2 / 2 - r2); s.lineTo(-w2 / 2, -h2 / 2 + r2); s.quadraticCurveTo(-w2 / 2, -h2 / 2, -w2 / 2 + r2, -h2 / 2);
    };
    rr(outer, w + 0.12, h + 0.12, r + 0.05); const hole = new T.Path(); rr(hole, w, h, r); outer.holes.push(hole);
    const g = track(new T.ExtrudeGeometry(outer, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 3 }));
    const ring = new T.Mesh(g, gold); ring.rotation.x = -Math.PI / 2; ring.position.set(-0.05, 1.0, 0); holder.add(ring);
    const dark = new T.Mesh(track(new T.PlaneGeometry(w, h)), track(new T.MeshBasicMaterial({ color: 0x010504 })));
    dark.rotation.x = -Math.PI / 2; dark.position.set(-0.05, 1.005, 0); holder.add(dark);
  })();
  const inner = new T.PointLight(0xffc860, 9, 3.4, 2); inner.position.set(0, -0.3, 0); holder.add(inner);
  const wire = new T.Mesh(track(new T.CylinderGeometry(0.006, 0.006, 6, 8)), track(new T.MeshStandardMaterial({ color: 0xcfe9e2, metalness: 1, roughness: 0.3 })));
  wire.position.set(-0.05, 4.0, 0); pig.add(wire);

  // ── Texturi ──
  const sparkTex = track((() => {
    const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d");
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, "rgba(255,240,190,1)"); r.addColorStop(0.3, "rgba(255,200,90,.8)"); r.addColorStop(1, "rgba(255,170,40,0)");
    g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c);
  })());
  const glowTex = track((() => {
    const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
    const r = g.createRadialGradient(64, 64, 30, 64, 64, 64); r.addColorStop(0, "rgba(255,214,120,.55)"); r.addColorStop(1, "rgba(255,190,60,0)");
    g.fillStyle = r; g.fillRect(0, 0, 128, 128); return new T.CanvasTexture(c);
  })());
  const glowMat = track(new T.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));

  const coinGeo = track(new T.CylinderGeometry(R, R, TH, 64));
  const rimGold = track(new T.MeshStandardMaterial({ color: 0xf1bf45, metalness: 1, roughness: 0.2, envMapIntensity: 1.6 }));
  const backGold = track(new T.MeshStandardMaterial({ color: 0xd9a637, metalness: 1, roughness: 0.3 }));

  function portraitMaterial(coin) {
    const c = document.createElement("canvas"); c.width = c.height = 320; const g = c.getContext("2d");
    const tex = new T.CanvasTexture(c); tex.encoding = T.sRGBEncoding; tex.anisotropy = 8; tex.center.set(0.5, 0.5); tex.rotation = Math.PI / 2;
    const draw = (img) => {
      g.clearRect(0, 0, 320, 320);
      const gr = g.createLinearGradient(0, 0, 320, 320); gr.addColorStop(0, "#fff1b8"); gr.addColorStop(0.5, "#e8b440"); gr.addColorStop(1, "#9c6a12");
      g.fillStyle = gr; g.beginPath(); g.arc(160, 160, 160, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "rgba(255,246,210,.9)"; g.lineWidth = 4; g.beginPath(); g.arc(160, 160, 150, 0, Math.PI * 2); g.stroke();
      g.save(); g.beginPath(); g.arc(160, 160, 140, 0, Math.PI * 2); g.clip();
      if (img) {
        g.drawImage(img, 20, 20, 280, 280);
      } else {
        g.fillStyle = "#123b35"; g.fillRect(0, 0, 320, 320);
        g.fillStyle = "#EAF6F2"; g.font = "700 120px Oswald, Arial"; g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText(String(coin.name || "?").trim().charAt(0).toUpperCase(), 160, 150);
      }
      g.restore();
      if (coin.number) {
        g.fillStyle = "#2FBF9A"; g.beginPath(); if (g.roundRect) g.roundRect(118, 262, 84, 34, 8); else g.rect(118, 262, 84, 34); g.fill();
        g.fillStyle = "#012"; g.font = "800 26px Oswald, Arial"; g.textAlign = "center"; g.textBaseline = "alphabetic"; g.fillText(coin.number, 160, 288);
      }
      tex.needsUpdate = true;
    };
    draw(null);
    if (coin.avatarSrc) { const im = new Image(); im.onload = () => draw(im); im.src = coin.avatarSrc; }
    const mat = new T.MeshBasicMaterial({ map: tex });
    return { mat, tex };
  }

  // ── Decor (nu sunt jucători) ──
  function tokenTex(kind) {
    const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
    const col = kind === "pct" ? "#e7b13c" : (kind.endsWith("p") ? "#FF2D7A" : "#2FBF9A");
    g.fillStyle = col; g.beginPath(); g.arc(64, 64, 64, 0, Math.PI * 2); g.fill(); g.strokeStyle = "rgba(255,255,255,.7)"; g.lineWidth = 7;
    if (kind.startsWith("c")) { g.beginPath(); g.arc(64, 64, 30, 0, Math.PI * 2); g.stroke(); }
    else if (kind.startsWith("t")) { g.beginPath(); g.moveTo(64, 30); g.lineTo(96, 90); g.lineTo(32, 90); g.closePath(); g.stroke(); }
    else if (kind.startsWith("s")) { g.strokeRect(36, 36, 56, 56); }
    else { g.fillStyle = "#5a3a06"; g.font = "800 40px Oswald, Arial"; g.textAlign = "center"; g.fillText("PCT", 64, 78); }
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return track(t);
  }
  (function () {
    const kinds = ["cp", "tg", "sp", "cg", "tp", "sg", "pct", "pct"];
    const tokenGeo = track(new T.CylinderGeometry(0.11, 0.11, 0.03, 40));
    for (let i = 0; i < 34; i++) {
      const y = -0.8 + ((i * 29) % 10) / 10 * 0.3;
      const z = -0.05 - ((i * 41) % 10) / 10 * 0.42;
      const hw = 1.42 * Math.sqrt(Math.max(0, 1 - (y / 0.92) ** 2 - (z / 1.05) ** 2)) - 0.2;
      const x = -0.05 + ((((i * 53) % 100) / 100) * 2 - 1) * Math.max(0.1, hw);
      let mesh;
      if (i % 3 === 0) { mesh = new T.Mesh(coinGeo, [rimGold, backGold, backGold]); mesh.scale.set(0.7, 1, 0.7); }
      else {
        const k = kinds[i % kinds.length];
        mesh = new T.Mesh(tokenGeo, [rimGold, track(new T.MeshStandardMaterial({ map: tokenTex(k), roughness: 0.4, metalness: k === "pct" ? 0.6 : 0.1 })), backGold]);
      }
      mesh.position.set(x, y, z);
      mesh.rotation.set(Math.PI / 2 + (((i * 7) % 10) - 5) * 0.12, (((i * 11) % 10) - 5) * 0.2, (((i * 13) % 10) - 5) * 0.3);
      holder.add(mesh);
    }
  })();

  // ── Scântei + praf ──
  const SP = 160; const sp = new Float32Array(SP * 3), sv = new Float32Array(SP * 3), sl = new Float32Array(SP);
  const sparkGeo = track(new T.BufferGeometry()); sparkGeo.setAttribute("position", new T.BufferAttribute(sp, 3));
  const sparks = new T.Points(sparkGeo, track(new T.PointsMaterial({ size: 0.09, map: sparkTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending, color: 0xffd27a })));
  holder.add(sparks); let sparkHead = 0;
  for (let i = 0; i < SP; i++) sp[i * 3 + 1] = -99;
  function burst(pos, n, power) {
    for (let i = 0; i < n; i++) {
      const k = sparkHead++ % SP; sp[k * 3] = pos.x; sp[k * 3 + 1] = pos.y; sp[k * 3 + 2] = pos.z;
      const a = Math.random() * Math.PI * 2, u = Math.random() * 0.9 + 0.2;
      sv[k * 3] = Math.cos(a) * u * power; sv[k * 3 + 1] = (Math.random() * 1.4 + 0.4) * power; sv[k * 3 + 2] = Math.sin(a) * u * power; sl[k] = 1;
    }
  }
  const innerGeo = track(new T.BufferGeometry());
  (function () { const n = 40, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 2.2; pos[i * 3 + 1] = -0.8 + Math.random() * 1.4; pos[i * 3 + 2] = (Math.random() - 0.5) * 0.9; } innerGeo.setAttribute("position", new T.BufferAttribute(pos, 3)); })();
  const innerPts = new T.Points(innerGeo, track(new T.PointsMaterial({ size: 0.05, map: sparkTex, transparent: true, opacity: 0.7, depthWrite: false, blending: T.AdditiveBlending, color: 0xffe7a8 })));
  holder.add(innerPts);
  const DN = 120; const dp = new Float32Array(DN * 3);
  for (let i = 0; i < DN; i++) { dp[i * 3] = (Math.random() - 0.5) * 7; dp[i * 3 + 1] = Math.random() * 7 - 2.4; dp[i * 3 + 2] = (Math.random() - 0.5) * 5; }
  const dustGeo = track(new T.BufferGeometry()); dustGeo.setAttribute("position", new T.BufferAttribute(dp, 3));
  scene.add(new T.Points(dustGeo, track(new T.PointsMaterial({ size: 0.03, map: sparkTex, transparent: true, opacity: 0.55, depthWrite: false, blending: T.AdditiveBlending, color: 0xffe3a0 }))));

  // ── Monedele cu portrete ──
  const coins = new Map(); // id -> coin state
  const queue = [];        // id-uri care așteaptă să cadă
  function addCoin(data, index, instantly) {
    const { mat, tex } = portraitMaterial(data);
    const grp = new T.Group();
    const m = new T.Mesh(coinGeo, [rimGold, mat, backGold]); m.rotation.x = Math.PI / 2; m.renderOrder = 1;
    const glow = new T.Sprite(glowMat); glow.scale.set(0.62, 0.62, 1); glow.position.z = -0.03;
    grp.add(glow, m);
    const base = SLOTS[index % SLOTS.length].clone();
    if (index >= SLOTS.length) base.z -= 0.12 * Math.floor(index / SLOTS.length);
    const c = { id: data.id, grp, mat, tex, target: base, phase: instantly ? "rest" : "wait", t: 0, vy: 0, spin: 0, yaw: 0 };
    if (instantly) grp.position.copy(base); else { grp.visible = false; queue.push(data.id); }
    holder.add(grp); coins.set(data.id, c);
  }
  function removeCoin(id) {
    const c = coins.get(id); if (!c) return;
    holder.remove(c.grp); c.mat.dispose(); c.tex.dispose(); coins.delete(id);
  }
  function startNext() {
    if (queue.some((id) => { const c = coins.get(id); return c && c.phase !== "wait" && c.phase !== "rest"; })) return;
    const id = queue.find((x) => coins.get(x)?.phase === "wait"); if (!id) return;
    const c = coins.get(id);
    c.grp.visible = true; c.grp.position.set(-0.05, 2.25, 0.25); c.grp.scale.setScalar(1.7); c.phase = "show"; c.t = 0;
  }

  // ── Interacțiune: rotire completă cu degetul (360°). După ~2,5 s fără
  // atingere, pușculița revine lin din profil, unde se văd toate portretele. ──
  let dragging = false, lastX = 0, userRot = 0, userVel = 0, idleSince = 0;
  const onDown = (e) => { dragging = true; lastX = e.clientX; };
  const onUp = () => { if (dragging) idleSince = performance.now(); dragging = false; };
  const onMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX; lastX = e.clientX; userVel = dx * 0.008;
    userRot += userVel;
  };
  canvas.addEventListener("pointerdown", onDown);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointermove", onMove);

  function resize() {
    const w = wrap.clientWidth || 1, h = wrap.clientHeight || 1;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    const narrow = w / h < 1.05;
    camera.fov = narrow ? 36 : 30;
    const d = narrow ? 8.2 / Math.max(0.6, w / h) * 0.9 : 7.0;
    camera.position.set(0, 1.9, d); camera.lookAt(0, 0.05, 0); camera.updateProjectionMatrix();
  }
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
  ro?.observe(wrap); resize();

  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  let wobble = 0, wobbleV = 0, shake = 0, flash = 0;
  const pq = new T.Quaternion(), yq = new T.Quaternion(), up = new T.Vector3(0, 1, 0);

  function step(dt) {
    const now = performance.now();
    if (!dragging) {
      userVel *= 0.92; userRot += userVel;
      if (now - idleSince > 2500 && Math.abs(userVel) < 0.002) {
        const home = Math.round(userRot / (Math.PI * 2)) * Math.PI * 2; // cel mai apropiat profil
        userRot += (home - userRot) * Math.min(1, dt * 1.6);
      }
    }
    holder.rotation.y = (reduce ? 0 : Math.sin(now / 5200) * 0.32) + userRot;
    wobbleV += (-wobble * 18 - wobbleV * 3.2) * dt; wobble += wobbleV * dt;
    pig.rotation.z = wobble * 0.5 + Math.sin(now / 2400) * 0.012;
    pig.position.y = Math.sin(now / 1900) * 0.04;

    startNext();
    coins.forEach((c) => {
      const g = c.grp; c.t += dt;
      if (c.phase === "show") {
        g.position.y = 2.25 + Math.sin(c.t * 3) * 0.03; c.yaw = Math.sin(c.t * 2) * 0.15;
        if (c.t > 0.9) { c.phase = "edge"; c.t = 0; }
      } else if (c.phase === "edge") {
        const k = Math.min(1, c.t / 0.35); g.scale.setScalar(1.7 - 0.7 * k); c.yaw = k * Math.PI / 2;
        g.position.z = 0.25 - 0.25 * k; if (k >= 1) { c.phase = "fall"; c.vy = -1.2; }
      } else if (c.phase === "fall") {
        c.vy -= 9.8 * dt * 0.7; g.position.y += c.vy * dt;
        if (g.position.y <= 1.02) { c.phase = "inside"; burst(new T.Vector3(-0.05, 1.04, 0.1), 30, 0.9); flash = 1; wobbleV += 0.9; shake = 0.06; }
      } else if (c.phase === "inside") {
        c.vy -= 9.8 * dt; g.position.y += c.vy * dt; c.spin += dt * 14; c.yaw = Math.PI / 2 + c.spin;
        g.position.x += (c.target.x - g.position.x) * Math.min(1, dt * 3);
        if (g.position.y <= c.target.y - 0.05) { burst(g.position.clone(), 16, 0.4); wobbleV += 0.35; c.phase = "settle"; c.t = 0; c.from = c.yaw; }
      } else if (c.phase === "settle") {
        const k = Math.min(1, c.t / 0.55), e = 1 - Math.pow(1 - k, 3);
        g.position.lerp(c.target, Math.min(1, dt * 10)); g.position.y = c.target.y + Math.sin(k * Math.PI) * 0.08 * (1 - k);
        const full = Math.ceil(c.from / (Math.PI * 2)) * Math.PI * 2; c.yaw = c.from + (full - c.from) * e;
        if (k >= 1) {
          g.position.copy(c.target); c.yaw = 0; c.phase = "rest";
          const qi = queue.indexOf(c.id); if (qi > -1) queue.splice(qi, 1);
          notifyLanded(c.id);
        }
      } else if (c.phase === "rest") {
        c.yaw = Math.sin(now / 1700 + c.target.x * 3) * 0.06;
      }
    });
    // portretele privesc mereu spre cameră
    holder.updateMatrixWorld(); holder.getWorldQuaternion(pq); pq.invert();
    coins.forEach((c) => { yq.setFromAxisAngle(up, c.yaw || 0); c.grp.quaternion.copy(pq).multiply(camera.quaternion).multiply(yq); });

    for (let i = 0; i < SP; i++) {
      if (sl[i] <= 0) { sp[i * 3 + 1] = -99; continue; }
      sl[i] -= dt * 1.3; sv[i * 3 + 1] -= dt * 3.2; sp[i * 3] += sv[i * 3] * dt; sp[i * 3 + 1] += sv[i * 3 + 1] * dt; sp[i * 3 + 2] += sv[i * 3 + 2] * dt;
    }
    sparkGeo.attributes.position.needsUpdate = true;
    for (let i = 0; i < DN; i++) { dp[i * 3 + 1] += dt * 0.05; if (dp[i * 3 + 1] > 4.6) dp[i * 3 + 1] = -2.4; }
    dustGeo.attributes.position.needsUpdate = true;
    innerPts.rotation.y += dt * 0.05;
    flash = Math.max(0, flash - dt * 2.2); inner.intensity = 9 + flash * 40; spot.intensity = 520 + flash * 300;
    shake = Math.max(0, shake - dt * 0.25); camera.position.x = (Math.random() - 0.5) * shake;
  }

  // ── Bucla: se oprește când ecranul nu e vizibil ──
  const clock = new T.Clock(); let raf = 0, running = true;
  function loop() {
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 1 / 30);
    step(dt); renderer.render(scene, camera); raf = requestAnimationFrame(loop);
  }
  const onVis = () => {
    const vis = document.visibilityState === "visible";
    if (vis && !running) { running = true; clock.getDelta(); loop(); }
    if (!vis) { running = false; cancelAnimationFrame(raf); }
  };
  document.addEventListener("visibilitychange", onVis);
  loop();

  return {
    // Sincronizează monedele cu lista: adaugă noile, scoate ce nu mai e în listă.
    sync(list, instantly) {
      const ids = new Set(list.map((c) => c.id));
      [...coins.keys()].forEach((id) => { if (!ids.has(id)) removeCoin(id); });
      queue.splice(0, queue.length, ...queue.filter((id) => ids.has(id)));
      list.forEach((data, index) => {
        const existing = coins.get(data.id);
        if (!existing) addCoin(data, index, instantly);
        else if (instantly && existing.phase !== "rest") {
          existing.grp.visible = true; existing.grp.scale.setScalar(1); existing.grp.position.copy(existing.target);
          existing.yaw = 0; existing.phase = "rest";
          const qi = queue.indexOf(data.id); if (qi > -1) queue.splice(qi, 1);
          notifyLanded(data.id);
        }
      });
    },
    dispose() {
      running = false; cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointermove", onMove);
      ro?.disconnect();
      [...coins.keys()].forEach(removeCoin);
      disposables.forEach((d) => d.dispose?.());
      renderer.dispose();
      if (canvas.parentNode === wrap) wrap.removeChild(canvas);
    },
  };
}
