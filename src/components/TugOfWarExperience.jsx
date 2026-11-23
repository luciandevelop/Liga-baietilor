import { useEffect, useMemo, useRef, useState } from "react";
import { getAvatarUrl, useS3AvatarsReady } from "../assets/avatars";
import { getSeasonNumbers } from "../services/seasonNumbersService";

// ══════════════════════════════════════════════════════════════════
// 🪢 TRASUL DE FRÂNGHIE — tema Squid Game pentru JUMATE-JUMATE.
// DOAR grafică și sunet. Taberele, formula, excluderea și punctajul sunt
// EXACT cele din HalfHalfExperience / resolveMain (surprisesService):
//   • scor = suma punctelor live ale taberei;
//   • excludere DOAR din tabăra mai numeroasă: jucătorul de pe locul
//     floor(n/2)+1 din clasamentul ei intern (👑, rămâne în echipă);
//   • 200 / 0, egal 100 / 100 — premiul îl scrie serverul la „Rezolvă”.
// Frânghia doar ARATĂ diferența. Nimic de aici nu scrie în Firebase.
// ══════════════════════════════════════════════════════════════════

// — aceeași formulă ca în HalfHalfExperience (copiată 1:1, nu modificată) —
export function halfScore(members, isLarger, liveScores) {
  if (!isLarger) return members.reduce((s, uid) => s + (liveScores[uid] ?? 0), 0);
  const sorted = [...members].sort((a, b) => (liveScores[b] ?? 0) - (liveScores[a] ?? 0));
  const excludeIdx = Math.floor(members.length / 2) + 1 - 1;
  return sorted.reduce((s, uid, i) => (i === excludeIdx ? s : s + (liveScores[uid] ?? 0)), 0);
}
export function excludedUid(members, isLarger, liveScores) {
  if (!isLarger) return null;
  const sorted = [...members].sort((a, b) => (liveScores[b] ?? 0) - (liveScores[a] ?? 0));
  return sorted[Math.floor(members.length / 2) + 1 - 1];
}

const T = { pink: "#ff2d7a", teal: "#22d3c5", red: "#ff2a3d", gold: "#F5C451", ink: "#f4eef2", dim: "#9a8f98", bg: "#07060d", A: "#22d3c5", B: "#ff2d7a" };
const FONT = '"Chakra Petch", "Oswald", "Arial Narrow", sans-serif';
const pad3 = (n) => (n == null ? "" : String(n).padStart(3, "0"));
const TILT = 48;           // înclinarea lumii 3D (grade)
const GAP = 60;            // jumătate din golul dintre platforme
let numbersCache = null;

function ensureFont() {
  if (typeof document === "undefined" || document.getElementById("tw-font")) return;
  const l = document.createElement("link"); l.id = "tw-font"; l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;700&display=swap"; document.head.appendChild(l);
}

// ── sunet: fișiere ORIGINALE (fără muzica serialului), pornesc doar după o atingere ──
function useTugAudio(base) {
  const ref = useRef(null);
  const [on, setOn] = useState(() => { try { return localStorage.getItem("tw_sound") === "1"; } catch (e) { return false; } });
  function ctx() {
    if (!ref.current) {
      const AC = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext); if (!AC) return null;
      const c = new AC(); const out = c.createGain(); out.gain.value = .85; out.connect(c.destination);
      ref.current = { c, out, buf: {}, loading: null, loop: null };
    }
    const a = ref.current; if (a.c.state === "suspended") a.c.resume();
    if (!a.loading) {
      a.loading = Promise.all(["drums_pull", "tension", "number_hit", "whoosh", "elim", "survive", "tick", "door_slam"].map(async (k) => {
        const f = k === "tension" ? "music_tension.mp3" : `sfx_${k}.mp3`;
        try { const r = await fetch(base + f); a.buf[k] = await a.c.decodeAudioData(await r.arrayBuffer()); } catch (e) { /* lipsă: liniște */ }
      }));
    }
    return a;
  }
  const play = (k, gain = 1, loop = false) => {
    if (!on) return null; const a = ctx(); if (!a || !a.buf[k]) return null;
    const s = a.c.createBufferSource(); s.buffer = a.buf[k]; s.loop = loop; const g = a.c.createGain(); g.gain.value = gain; s.connect(g); g.connect(a.out); s.start();
    return { s, g };
  };
  return {
    on,
    toggle: async () => { const n = !on; setOn(n); try { localStorage.setItem("tw_sound", n ? "1" : "0"); } catch (e) { /* */ } if (n) { const a = ctx(); await a?.loading; } else ref.current?.loop?.s.stop(); },
    prime: async () => { if (!on) return; const a = ctx(); await a?.loading; },
    play,
    loopStart: () => { if (!on) return; const a = ctx(); if (!a || a.loop) return; a.loop = play("tension", .55, true); },
    loopStop: () => { const a = ref.current; if (a?.loop) { try { a.loop.g.gain.setTargetAtTime(0, a.c.currentTime, .3); a.loop.s.stop(a.c.currentTime + 1.2); } catch (e) { /* */ } a.loop = null; } },
    vibrate: (p) => { try { navigator.vibrate?.(p); } catch (e) { /* */ } },
  };
}

export default function TugOfWarExperience({
  myUid, top = [], bottom = [], isTopVariant, profiles = {}, liveScores = {}, resolved, myPoints, gameweekId,
  playerInfo = null, audioBase = "/audio/tug/", forceFinal = 0,
}) {
  ensureFont();
  useS3AvatarsReady();
  const audio = useTugAudio(audioBase);
  const [nums, setNums] = useState(numbersCache);
  useEffect(() => { if (playerInfo || numbersCache) return; getSeasonNumbers().then((n) => { numbersCache = n?.numbers || {}; setNums(numbersCache); }).catch(() => {}); }, [playerInfo]);

  const info = (uid) => {
    if (playerInfo?.[uid]) return playerInfo[uid];
    const p = profiles[uid] || {};
    return { nick: p.nickname || "?", num: pad3(nums?.[uid]), av: getAvatarUrl(p.avatarId) };
  };

  // ── scor: formula identică ──
  const topIsLarger = top.length > bottom.length, bottomIsLarger = bottom.length > top.length;
  const sTop = halfScore(top, topIsLarger, liveScores), sBottom = halfScore(bottom, bottomIsLarger, liveScores);
  const topEx = excludedUid(top, topIsLarger, liveScores), bottomEx = excludedUid(bottom, bottomIsLarger, liveScores);
  const myInTop = top.includes(myUid); const mySide = myInTop ? "top" : bottom.includes(myUid) ? "bottom" : null;
  const leading = sTop > sBottom ? "top" : sTop < sBottom ? "bottom" : "tie";
  const myPreview = leading === "tie" ? 100 : leading === mySide ? 200 : 0;
  // câștigătorul show-ului = premiul OFICIAL scris de server (200/100/0); doar fără premiu (ex. Admin) se calculează din puncte
  const otherSide = mySide === "top" ? "bottom" : "top";
  const finalWinner = !resolved ? null : (mySide && myPoints != null) ? (myPoints === 100 ? "tie" : myPoints === 200 ? mySide : otherSide) : leading;
  const nameA = isTopVariant ? "SUS" : "ECHIPA ○", nameB = isTopVariant ? "JOS" : "ECHIPA △";

  // ── tragerea finală (show) — o singură dată, apoi „Revezi” ──
  const seenKey = `tw_seen_${gameweekId || "demo"}`;
  const [phase, setPhase] = useState(() => { if (!resolved) return "live"; try { return localStorage.getItem(seenKey) === "1" ? "done" : "ready"; } catch (e) { return "ready"; } });
  const [pull, setPull] = useState(0);     // -1 … 1 în timpul show-ului
  const [fallen, setFallen] = useState(0); // câți din tabăra învinsă au căzut
  const [count, setCount] = useState(null);
  const timers = useRef([]);
  useEffect(() => { if (resolved && phase === "live") setPhase("ready"); if (!resolved) setPhase("live"); }, [resolved]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (forceFinal) startFinal(); }, [forceFinal]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { timers.current.forEach(clearTimeout); audio.loopStop(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const at = (ms, fn) => timers.current.push(setTimeout(fn, ms));

  async function startFinal() {
    timers.current.forEach(clearTimeout); timers.current = [];
    await audio.prime(); setFallen(0); setPull(0); setPhase("show");
    audio.play("number_hit", .9); audio.vibrate([60, 40, 60]);
    [3, 2, 1].forEach((n, i) => at(400 + i * 800, () => { setCount(n); audio.play("tick", .7); }));
    at(2800, () => { setCount("TRAGEȚI!"); audio.play("drums_pull", 1); });
    // tensiune: frânghia se smucește într-o parte și în alta
    const sway = [.18, -.14, .22, -.1, .26, -.06];
    sway.forEach((v, i) => at(3200 + i * 700, () => { setCount(null); setPull(finalWinner === "tie" ? v * .6 : (finalWinner === "top" ? -1 : 1) * Math.abs(v) * (i % 2 ? .4 : 1)); }));
    if (finalWinner === "tie") {
      at(7600, () => { setPull(0); audio.play("door_slam", .7); });
      at(8600, () => { setPhase("done"); audio.play("survive", .8); try { localStorage.setItem(seenKey, "1"); } catch (e) { /* */ } });
      return;
    }
    at(7400, () => { setPull(finalWinner === "top" ? -1 : 1); audio.play("whoosh", .9); });
    const losers = finalWinner === "top" ? bottom.length : top.length;
    for (let i = 1; i <= losers; i++) at(7900 + i * 260, () => { setFallen(i); if (i === 1) { audio.play("elim", 1); audio.vibrate([120, 60, 200]); } });
    at(8600 + losers * 260, () => { setPhase("done"); audio.play("survive", .8); try { localStorage.setItem(seenKey, "1"); } catch (e) { /* */ } });
  }
  function skipFinal() { timers.current.forEach(clearTimeout); setCount(null); setPull(finalWinner === "tie" ? 0 : finalWinner === "top" ? -1 : 1); setFallen(99); setPhase("done"); try { localStorage.setItem(seenKey, "1"); } catch (e) { /* */ } }

  useEffect(() => { if (phase === "live" && !resolved) audio.loopStart(); else audio.loopStop(); }, [phase, resolved, audio.on]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── poziția frânghiei: arată diferența (live: maxim ±70 px; final: tragere completă) ──
  const diff = sTop - sBottom;
  const liveOff = Math.tanh(diff / 260) * -46; // negativ = spre echipa de sus
  const ropeOff = phase === "live" || phase === "ready" ? (phase === "ready" ? 0 : liveOff) : pull * 92;
  const loserSide = phase === "done" || phase === "show" ? (finalWinner === "top" ? "bottom" : finalWinner === "bottom" ? "top" : null) : null;

  // formație pe 3 coloane (frânghia trece prin mijloc); TU ești în primul rând, la centru
  const lineup = (members, side) => {
    const ord = members.includes(myUid) ? [members.filter((u) => u !== myUid)[0], myUid, ...members.filter((u) => u !== myUid).slice(1)].filter(Boolean) : members;
    const n = ord.length, cols = 3, rows = Math.ceil(n / cols), rowGap = rows > 3 ? 46 : 58;
    return ord.map((uid, i) => {
      const row = Math.floor(i / cols), col = i % cols, inRow = Math.min(cols, n - row * cols);
      const x = (col - (inRow - 1) / 2) * 62; const dist = 46 + row * rowGap;
      return { uid, side, i, row, x, y0: side === "top" ? -(GAP + dist) : GAP + dist };
    });
  };
  const cards = [...lineup(top, "top"), ...lineup(bottom, "bottom")];

  const roster = (members, side, ex, score, name, colr) => (
    <div style={{ ...st.rCol, borderColor: colr + "66", ...(leading === side && !resolved ? { boxShadow: `0 0 18px ${colr}44` } : {}) }}>
      <div style={st.rHead}><b style={{ color: colr }}>{name}</b>{mySide === side && <span style={st.yours}>TABĂRA TA</span>}</div>
      <div style={{ ...st.rScore, color: colr }}>{score}<small>p</small></div>
      {[...members].sort((a, b) => (liveScores[b] ?? 0) - (liveScores[a] ?? 0)).map((uid) => { const p = info(uid); return (
        <div key={uid} style={{ ...st.rRow, ...(uid === myUid ? st.rMe : {}), ...(ex === uid ? { opacity: .6 } : {}) }}>
          <span style={{ ...st.face, backgroundImage: p.av ? `url("${p.av}")` : "none", borderColor: colr }}>{p.av ? "" : (p.nick || "?")[0]}</span>
          <span style={st.rNick}>{p.num ? <i style={st.rNum}>{p.num}</i> : null}{p.nick}</span>
          {ex === uid && <span title="scor exclus din comparație">👑</span>}
          <em style={st.rPts}>{liveScores[uid] ?? 0}</em>
        </div>); })}
    </div>
  );

  const showResult = resolved && phase === "done";
  return (
    <div style={st.wrap}>
      <style>{CSS}</style>
      <div style={st.head}>
        <div><div style={st.kick}>JUMATE-JUMATE · SEZONUL 3</div><div style={st.title}>🪢 TRASUL DE FRÂNGHIE</div></div>
        <button type="button" style={st.snd} onClick={audio.toggle} aria-label="Sunet">{audio.on ? "🔊" : "🔇"}</button>
      </div>

      {/* tabelă de scor */}
      <div style={st.board}>
        <div style={st.bSide}><span style={{ color: T.A }}>{nameA}</span><b style={{ color: T.A }}>{sTop}</b></div>
        <div style={st.bMid}>{resolved ? (showResult ? (finalWinner === "tie" ? "EGAL" : "FINAL") : "REZULTAT GATA") : <><i style={st.liveDot} />LIVE</>}<small>{diff === 0 ? "egalitate" : `${Math.abs(diff)} p diferență`}</small></div>
        <div style={{ ...st.bSide, alignItems: "flex-end" }}><span style={{ color: T.B }}>{nameB}</span><b style={{ color: T.B }}>{sBottom}</b></div>
      </div>

      {/* scena 3D */}
      <div style={st.stage} className="tw-stage">
        <div className="tw-fog" />
        <div className="tw-world" style={{ transform: `translate(-50%,-50%) translateY(${-ropeOff * .62}px) rotateX(${TILT}deg)`, transition: phase === "show" ? "transform .55s cubic-bezier(.3,1.6,.4,1)" : "transform 1.2s cubic-bezier(.2,.8,.2,1)" }}>
          <div className="tw-abyss" />
          <div className="tw-tower top"><div className="tw-edge" /><div className="tw-face" /></div>
          <div className="tw-tower bottom"><div className="tw-edge" /></div>
          <div className="tw-rope" style={{ transform: `translate3d(-50%, ${ropeOff}px, 16px)`, transition: phase === "show" ? "transform .55s cubic-bezier(.3,1.6,.4,1)" : "transform 1.2s cubic-bezier(.2,.8,.2,1)" }}>
            <div className="tw-marker" />
          </div>
          {cards.map((c) => {
            const p = info(c.uid); const lost = loserSide === c.side; const isFallen = lost && fallen > c.i;
            const pullShift = ropeOff; // toți țin frânghia
            const y = c.y0 + pullShift;
            const fall = isFallen ? `translate3d(${c.x * 1.3}px, ${c.side === "top" ? -10 : 10}px, -460px) rotateX(${-TILT}deg) rotateZ(${c.x >= 0 ? 35 : -35}deg) scale(.55)` : `translate3d(${c.x}px, ${y}px, 0) rotateX(${-TILT}deg)`;
            const cheer = phase === "done" && finalWinner && finalWinner !== "tie" && c.side === finalWinner;
            const colr = c.side === "top" ? T.A : T.B;
            const ex = c.uid === topEx || c.uid === bottomEx;
            return (
              <div key={c.uid} className={`tw-card${c.uid === myUid ? " me" : ""}${phase === "live" ? " sway" : ""}${cheer ? " cheer" : ""}`} style={{ transform: fall, opacity: isFallen ? 0 : 1, transition: isFallen ? "transform 1.1s cubic-bezier(.5,0,.9,.5), opacity 1.1s ease-in .3s" : phase === "show" ? "transform .55s cubic-bezier(.3,1.6,.4,1)" : "transform 1.2s cubic-bezier(.2,.8,.2,1)", animationDelay: `${(c.i % 4) * .18}s` }}>
                <div className="tw-pic" style={{ backgroundImage: p.av ? `url("${p.av}")` : "none", borderColor: c.uid === myUid ? T.gold : colr, boxShadow: `0 0 12px ${colr}66` }}>{p.av ? "" : (p.nick || "?")[0]}</div>
                <div className="tw-tag" style={{ borderColor: colr }}>{ex ? "👑 " : ""}{p.nick}</div>
              </div>
            );
          })}
        </div>
        <div className="tw-lab top" style={{ color: T.A }}>{nameA}</div>
        <div className="tw-lab bottom" style={{ color: T.B }}>{nameB}</div>
        {count != null && <div className="tw-count" key={String(count)}>{count}</div>}
        {phase === "ready" && (
          <div className="tw-ready">
            <div>REZULTATUL OFICIAL E GATA</div>
            <button type="button" onClick={startFinal}>▶ VEZI TRAGEREA FINALĂ</button>
            <small>Pornește sunetul din 🔇 pentru efect complet</small>
          </div>
        )}
        {phase === "show" && <button type="button" className="tw-skip" onClick={skipFinal}>SARI PESTE ⏭</button>}
      </div>

      {/* rezultatul tău */}
      {!resolved && mySide && (
        <div style={st.preview}><span>{leading === "tie" ? "Egalitate momentan" : "Dacă s-ar termina acum"}</span><b>+{myPreview}p pentru tine</b></div>
      )}
      {showResult && (
        <div style={st.result}>
          {myPoints === 200 ? <><div style={st.rIcon}>🏆</div><div style={st.rTitle}>TABĂRA TA A TRAS MAI TARE</div><div style={st.rPtsBig}>+200p</div></>
            : myPoints === 100 ? <><div style={st.rIcon}>🤝</div><div style={st.rTitle}>EGALITATE · FRÂNGHIA A RĂMAS LA MIJLOC</div><div style={st.rPtsBig}>+100p</div></>
            : myPoints === 0 ? <><div style={{ ...st.rIcon, opacity: .6 }}>🕳️</div><div style={{ ...st.rTitle, color: T.dim }}>TABĂRA TA A FOST TRASĂ ÎN GOL</div><div style={{ ...st.rPtsBig, color: T.dim }}>+0p</div></>
            : <div style={st.rTitle}>{finalWinner === "tie" ? "EGALITATE" : `A CÂȘTIGAT ${finalWinner === "top" ? nameA : nameB}`}</div>}
          <button type="button" style={st.replay} onClick={startFinal}>↺ Revezi tragerea finală</button>
        </div>
      )}

      <div style={st.roster}>
        {roster(top, "top", topEx, sTop, nameA, T.A)}
        {roster(bottom, "bottom", bottomEx, sBottom, nameB, T.B)}
      </div>
      {(topIsLarger || bottomIsLarger) && <div style={st.note}>👑 = scor exclus din comparație (mijlocul clasamentului intern al taberei mai mari) · rămâne în echipă și primește premiul echipei</div>}
    </div>
  );
}

const CSS = `
.tw-stage{position:relative;overflow:hidden;perspective:760px;perspective-origin:50% 18%}
.tw-fog{position:absolute;inset:0;pointer-events:none;background:radial-gradient(60% 30% at 50% 52%,rgba(255,42,61,.28),transparent 70%),radial-gradient(90% 60% at 50% 0%,rgba(34,211,197,.10),transparent 60%);z-index:2;mix-blend-mode:screen}
.tw-world{position:absolute;left:50%;top:50%;width:260px;height:660px;transform-style:preserve-3d}
.tw-abyss{position:absolute;left:-200px;right:-200px;top:270px;height:120px;transform:translateZ(-330px);background:radial-gradient(50% 60% at 50% 50%,rgba(255,42,61,.55),rgba(60,0,10,.4) 50%,transparent 75%);filter:blur(6px)}
.tw-tower{position:absolute;left:0;right:0;transform-style:preserve-3d;background:linear-gradient(90deg,#141a33,#1c2446 50%,#141a33);box-shadow:inset 0 0 0 2px rgba(255,255,255,.04)}
.tw-tower::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,.035) 0 2px,transparent 2px 40px),repeating-linear-gradient(90deg,rgba(255,255,255,.03) 0 2px,transparent 2px 50px)}
.tw-tower.top{top:0;height:270px}.tw-tower.bottom{top:390px;height:270px}
.tw-edge{position:absolute;left:0;right:0;height:4px;background:#ff2a3d;box-shadow:0 0 14px #ff2a3d,0 0 30px rgba(255,42,61,.6)}
.tw-tower.top .tw-edge{bottom:0}.tw-tower.bottom .tw-edge{top:0}
.tw-face{position:absolute;left:0;right:0;bottom:0;height:260px;transform-origin:50% 100%;transform:rotateX(90deg);background:linear-gradient(180deg,#1a2042,#07060d 90%);box-shadow:inset 0 2px 0 rgba(255,42,61,.6)}
.tw-face::after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(90deg,rgba(255,255,255,.05) 0 3px,transparent 3px 44px)}
.tw-rope{position:absolute;left:50%;top:40px;width:9px;height:580px;border-radius:5px;background:repeating-linear-gradient(160deg,#d8c08a 0 5px,#9f8455 5px 9px);box-shadow:0 0 8px rgba(0,0,0,.6);transform-style:preserve-3d}
.tw-marker{position:absolute;left:50%;top:50%;width:26px;height:26px;margin:-13px 0 0 -13px;background:#ff2d7a;clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%);box-shadow:0 0 20px #ff2d7a;filter:drop-shadow(0 0 8px #ff2d7a)}
.tw-card{position:absolute;left:50%;top:50%;width:52px;margin-left:-26px;margin-top:-76px;transform-origin:50% 100%;display:flex;flex-direction:column;align-items:center;gap:2px}
.tw-card.sway{animation:twSway 2.2s ease-in-out infinite}
@keyframes twSway{50%{margin-top:-79px}}
.tw-card.cheer{animation:twCheer .7s ease-in-out infinite}
@keyframes twCheer{50%{margin-top:-92px}}
.tw-pic{width:52px;height:62px;border-radius:9px;border:2px solid;background:#141832 center 12% / 170% auto no-repeat;color:#fff;font:700 20px ${FONT};display:flex;align-items:center;justify-content:center}
.tw-card.me .tw-pic{box-shadow:0 0 0 2px #F5C451,0 0 18px rgba(245,196,81,.8)!important}
.tw-tag{max-width:70px;padding:1px 5px;border-radius:5px;border:1px solid;background:rgba(7,6,13,.85);color:#fff;font:700 9px ${FONT};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:.03em}
.tw-lab{position:absolute;left:12px;font:700 11px ${FONT};letter-spacing:.2em;z-index:3;text-shadow:0 0 10px currentColor}
.tw-lab.top{top:10px}.tw-lab.bottom{bottom:10px}
.tw-count{position:absolute;left:0;right:0;top:34%;text-align:center;z-index:5;font:700 64px ${FONT};color:#fff;text-shadow:0 0 30px #ff2d7a,0 3px 0 #000;animation:twPop .7s ease-out}
@keyframes twPop{0%{transform:scale(2);opacity:0}30%{opacity:1}100%{transform:scale(1)}}
.tw-ready{position:absolute;inset:0;z-index:6;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:rgba(7,6,13,.72);color:#f4eef2;font:700 13px ${FONT};letter-spacing:.16em;text-align:center;padding:16px}
.tw-ready button{height:50px;padding:0 22px;border:0;border-radius:14px;background:linear-gradient(90deg,#ff2d7a,#ff6aa8);color:#fff;font:700 15px ${FONT};letter-spacing:.12em;box-shadow:0 0 26px rgba(255,45,122,.55);cursor:pointer}
.tw-ready small{font:500 10.5px ${FONT};letter-spacing:.06em;color:#9a8f98}
.tw-skip{position:absolute;right:10px;bottom:10px;z-index:6;padding:7px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.25);background:rgba(7,6,13,.7);color:#fff;font:700 10px ${FONT};letter-spacing:.14em;cursor:pointer}
@media (prefers-reduced-motion: reduce){.tw-card.sway{animation:none}}
`;

const st = {
  wrap: { background: "linear-gradient(180deg,#0b0a18,#07060d)", border: "1px solid rgba(255,45,122,.35)", borderRadius: 18, padding: "12px 10px 14px", color: T.ink, fontFamily: FONT, boxShadow: "0 0 40px -10px rgba(255,45,122,.35)" },
  head: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 },
  kick: { fontSize: 9.5, letterSpacing: ".22em", color: T.teal },
  title: { fontSize: 19, fontWeight: 700, letterSpacing: ".06em", color: "#fff", textShadow: "0 0 14px rgba(255,45,122,.6)" },
  snd: { width: 36, height: 36, borderRadius: 11, border: "1px solid rgba(255,255,255,.18)", background: "rgba(255,255,255,.04)", color: "#fff", fontSize: 16, cursor: "pointer" },
  board: { display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 12, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)", marginBottom: 8 },
  bSide: { display: "flex", flexDirection: "column", gap: 1, fontSize: 10, letterSpacing: ".16em" },
  bMid: { display: "flex", flexDirection: "column", alignItems: "center", fontSize: 11, letterSpacing: ".18em", color: "#fff", textAlign: "center" },
  liveDot: { display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: T.red, boxShadow: `0 0 8px ${T.red}`, marginRight: 6, verticalAlign: "middle" },
  stage: { height: 420, borderRadius: 14, background: "radial-gradient(120% 80% at 50% 40%,#11142a,#05040a)", border: "1px solid rgba(255,255,255,.06)" },
  preview: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, padding: "9px 12px", borderRadius: 12, background: "rgba(245,196,81,.07)", border: "1px solid rgba(245,196,81,.3)", fontSize: 11, color: T.dim },
  result: { textAlign: "center", marginTop: 10, padding: "12px 10px", borderRadius: 14, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.1)" },
  rIcon: { fontSize: 30 }, rTitle: { fontSize: 13, letterSpacing: ".12em", color: T.gold, marginTop: 2 }, rPtsBig: { fontSize: 30, color: T.gold, textShadow: "0 0 18px rgba(245,196,81,.5)" },
  replay: { marginTop: 8, padding: "7px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,.18)", background: "transparent", color: "#fff", fontFamily: FONT, fontSize: 11, letterSpacing: ".1em", cursor: "pointer" },
  roster: { display: "flex", gap: 8, marginTop: 10 },
  rCol: { flex: 1, minWidth: 0, borderRadius: 12, border: "1px solid", padding: "8px 6px", background: "rgba(255,255,255,.02)" },
  rHead: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4, fontSize: 10.5, letterSpacing: ".12em" },
  yours: { fontSize: 8, letterSpacing: ".08em", padding: "2px 5px", borderRadius: 999, background: "rgba(245,196,81,.15)", color: T.gold },
  rScore: { fontSize: 22, fontWeight: 700, margin: "2px 0 6px" },
  rRow: { display: "flex", alignItems: "center", gap: 5, padding: "3px 4px", borderRadius: 8, fontSize: 10.5 },
  rMe: { background: "rgba(245,196,81,.12)", boxShadow: "inset 0 0 0 1px rgba(245,196,81,.5)" },
  face: { flex: "none", width: 22, height: 22, borderRadius: 6, border: "1.5px solid", background: "#141832 center 12% / 170% auto no-repeat", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 },
  rNick: { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  rNum: { fontStyle: "normal", color: T.gold, marginRight: 4, fontSize: 9.5 },
  rPts: { fontStyle: "normal", fontVariantNumeric: "tabular-nums", color: "#fff" },
  note: { fontSize: 9.5, color: T.dim, textAlign: "center", marginTop: 8, lineHeight: 1.35 },
};
