import { useMemo, useRef, useState } from "react";
import TugOfWarExperience, { halfScore } from "./TugOfWarExperience";
import { getAvatarUrl, useS3AvatarsReady } from "../assets/avatars";
import { demoPlayers } from "../hideseek/hsDemo";

// ══════════════════════════════════════════════════════════════════
// 🪢 Admin — DEMO TRASUL DE FRÂNGHIE · ZERO SCRIERI.
// Componenta REALĂ TugOfWarExperience, cu 18 jucători fictivi (aceiași ca în
// demo-ul Ascunselea). Punctele sunt simulate local; „Rezolvă” aici doar
// imită ce face serverul (200 / 0, egal 100 / 100). Nu citește și nu scrie Firestore.
// ══════════════════════════════════════════════════════════════════
const ME = "d1";
const DEMO_GW = "admin-demo";
function teams(ids) { // Jumate-Jumate Random: amestec + prima tabără primește jucătorul în plus
  const sh = ids.slice().sort(() => Math.random() - 0.5);
  const topSize = Math.ceil(sh.length / 2);
  return { top: sh.slice(0, topSize), bottom: sh.slice(topSize) };
}
const matchPts = () => {
  const r = Math.random(); const sc = r < 0.08 ? 120 : r < 0.2 ? 70 : r < 0.5 ? 50 : r < 0.6 ? 20 : 0;
  return sc + [15, 10, 5, 2, 0][Math.floor(Math.random() * 5)] + [15, 10, 5, 0][Math.floor(Math.random() * 4)];
};
const clearSeen = () => { try { localStorage.removeItem(`tw_seen_${DEMO_GW}`); } catch (e) { /* fără stocare */ } };

export default function TugOfWarDemo({ onClose }) {
  const ready = useS3AvatarsReady();
  const players = useMemo(() => demoPlayers(), []);
  const allIds = useMemo(() => Object.keys(players), [players]);
  const playerInfo = useMemo(() => Object.fromEntries(Object.entries(players).map(([uid, p]) => [uid, {
    nick: p.nick, num: String(p.number).padStart(3, "0"), av: getAvatarUrl(p.avatarId),
  }])), [players, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const [n, setN] = useState(18);
  const [variant, setVariant] = useState("random"); // random | topbottom
  const [tm, setTm] = useState(() => teams(allIds));
  const [scores, setScores] = useState({});
  const [resolved, setResolved] = useState(false);
  const [myPoints, setMyPoints] = useState(null);
  const [running, setRunning] = useState(false);
  const [round, setRound] = useState(0);
  const [msg, setMsg] = useState("Apasă „Simulează meciurile” ca să vezi frânghia mișcându-se LIVE.");
  const tRef = useRef(0);

  function reset(nn = n) {
    clearInterval(tRef.current); setRunning(false);
    setTm(teams(allIds.slice(0, nn))); setScores({}); setResolved(false); setMyPoints(null); clearSeen(); setRound((r) => r + 1);
    setMsg("Etapă nouă: tabere trase la sorți.");
  }
  function simulate() {
    if (running) return;
    setRunning(true); let k = 0;
    setMsg("Meciurile se termină unul câte unul — în aplicație punctele vin din pronosticuri (aici: simulate).");
    tRef.current = setInterval(() => {
      k++;
      setScores((s) => { const nx = { ...s }; [...tm.top, ...tm.bottom].forEach((u) => { nx[u] = (nx[u] || 0) + matchPts(); }); return nx; });
      if (k >= 10) { clearInterval(tRef.current); setRunning(false); setMsg("Toate meciurile s-au terminat. Apasă „Rezolvă” (ce face Adminul)."); }
    }, 1300);
  }
  function resolve(force) {
    clearInterval(tRef.current); setRunning(false);
    const s = { ...scores }; [...tm.top, ...tm.bottom].forEach((u) => { if (s[u] == null) s[u] = 300 + Math.floor(Math.random() * 300); });
    const myTop = tm.top.includes(ME); const mine = myTop ? tm.top : tm.bottom; const other = myTop ? tm.bottom : tm.top;
    const sc = (side) => halfScore(side, side.length > (side === tm.top ? tm.bottom : tm.top).length, s);
    if (force === "win" && sc(mine) <= sc(other)) s[mine[0]] += sc(other) - sc(mine) + 40 + (mine.length > other.length ? 400 : 0);
    if (force === "lose" && sc(mine) >= sc(other)) s[other[0]] += sc(mine) - sc(other) + 40 + (other.length > mine.length ? 400 : 0);
    if (force === "tie") {
      for (let i = 0; i < 3 && sc(mine) !== sc(other); i++) {
        const d = sc(mine) - sc(other); const tgt = d > 0 ? other : mine;
        s[tgt.slice().sort((a, b) => s[a] - s[b])[0]] += Math.abs(d);
      }
    }
    setScores(s);
    const a = sc(mine), b = sc(other);
    setMyPoints(a > b ? 200 : a < b ? 0 : 100); // exact regula din resolveMain
    clearSeen(); setResolved(true);
    setMsg("Adminul a apăsat „Rezolvă”: premiile sunt scrise. Jucătorul vede tragerea finală.");
  }

  const btn = (label, fn, on) => <button type="button" onClick={fn} style={{ ...S.b, ...(on ? S.bOn : {}) }}>{label}</button>;
  return (
    <div style={S.overlay}>
      <div style={S.bar}>
        <span style={S.barLbl}>🪢 DEMO TRASUL DE FRÂNGHIE — nimic salvat</span>
        <button type="button" style={S.close} onClick={() => { clearInterval(tRef.current); onClose?.(); }}>✕ Închide</button>
      </div>
      <div style={S.page}>
        <div style={S.ctrl}>
          <div style={S.row}>{btn("▶ Simulează meciurile", simulate, running)}{btn("↺ Etapă nouă", () => reset())}</div>
          <div style={S.row}>{btn("Rezolvă (normal)", () => resolve())}{btn("…tabăra mea câștigă", () => resolve("win"))}</div>
          <div style={S.row}>{btn("…tabăra mea pierde", () => resolve("lose"))}{btn("…egalitate", () => resolve("tie"))}</div>
          <div style={S.row}>{btn("18 jucători (9 vs 9)", () => { setN(18); reset(18); }, n === 18)}{btn("17 jucători (9 vs 8, cu 👑)", () => { setN(17); reset(17); }, n === 17)}</div>
          <div style={S.row}>{btn("Random (○ / △)", () => setVariant("random"), variant === "random")}{btn("Top vs Bottom (SUS / JOS)", () => setVariant("topbottom"), variant === "topbottom")}</div>
          <div style={S.msg}>{msg}</div>
        </div>
        <TugOfWarExperience key={`${round}_${n}`} myUid={ME} top={tm.top} bottom={tm.bottom} isTopVariant={variant === "topbottom"}
          profiles={{}} liveScores={scores} resolved={resolved} myPoints={myPoints} gameweekId={DEMO_GW} playerInfo={playerInfo} />
        <div style={S.foot}>Joci ca Lu #001 · jucători fictivi · sunete originale create pentru PLAY LEAGUE (instrumente FluidR3 GM, CC BY 3.0)</div>
      </div>
    </div>
  );
}

const S = {
  overlay: { position: "fixed", inset: 0, zIndex: 9999, background: "#07060d", overflowY: "auto", WebkitOverflowScrolling: "touch" },
  bar: { position: "sticky", top: 0, zIndex: 2, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "max(10px, env(safe-area-inset-top)) 12px 10px", background: "rgba(7,6,13,.94)", borderBottom: "1px solid rgba(255,255,255,.08)" },
  barLbl: { fontSize: 12, fontWeight: 800, color: "#f4eef2" },
  close: { background: "rgba(255,255,255,.08)", color: "#fff", border: "1px solid rgba(255,255,255,.18)", borderRadius: 9, padding: "7px 11px", fontSize: 12, fontWeight: 800, cursor: "pointer" },
  page: { maxWidth: 440, margin: "0 auto", padding: "12px 12px 32px", color: "#f4eef2" },
  ctrl: { display: "flex", flexDirection: "column", gap: 6, padding: 10, borderRadius: 14, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)", marginBottom: 12 },
  row: { display: "flex", gap: 6 },
  b: { flex: 1, minHeight: 38, borderRadius: 10, border: "1px solid rgba(255,255,255,.16)", background: "rgba(255,255,255,.05)", color: "#fff", fontSize: 11.5, cursor: "pointer" },
  bOn: { borderColor: "#ff2d7a", background: "rgba(255,45,122,.18)" },
  msg: { fontSize: 11, color: "#9a8f98", textAlign: "center", lineHeight: 1.35 },
  foot: { fontSize: 9.5, color: "#6f6672", textAlign: "center", marginTop: 14 },
};
