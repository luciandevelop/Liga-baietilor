import { Suspense, lazy, useEffect, useState } from "react";
import { color } from "../theme";
import { getUserPublicProfiles } from "../services/profilesService";
import { getSeasonNumbers, getPlayerLooks } from "../services/seasonNumbersService";
import { cancelHideSeek, computeHideSeekPoints, getHideSeek, hasMark, listenMarks, startHideSeek } from "../services/hideSeekService";
import { HS_BYE_POINTS, HS_TURNS } from "../services/hideSeekEngine";
import { demoCard, demoCinema, demoDraw, demoDuel, demoPlayers } from "../hideseek/hsDemo";

import HsLoading from "../hideseek/HsLoading";
const HideSeekStage = lazy(() => import("./HideSeekStage"));

// ══════════════════════════════════════════════════════════════════
// 🚪 ASCUNSELEA — panoul Admin. Tragerea se face O SINGURĂ dată (tranzacție), înainte de Dezvăluire.
// „Rezolvă” (butonul obișnuit al surprizei) calculează punctele DOAR după termen.
// Demo-urile nu scriu nimic în Firebase.
// ══════════════════════════════════════════════════════════════════
const DEMOS = [
  ["draw", "draw", "🎲 Tragerea la sorți"], ["pick", "pick", "🎮 Alegerea ușilor (3D)"],
  ["duel", "level1", "1 · Holul"], ["duel", "level2", "2 · Scările (3–3)"], ["duel", "level3", "3 · Labirintul (6–0)"],
  ["duel", "level4", "4 · Turnul (lift)"], ["duel", "exit", "5 · EXIT"], ["duel", "forfeit", "🚫 Neprezentare"],
  ["duel", "full", "🏁 Duel complet + final"], ["card", "card", "🖕 Cartonașul rușinii"],
  ["titles", "titles", "🏅 Titlurile"], ["cinema", "cinema", "🎬 Seara de proiecție"],
];
// Datele demo: nimic nu ajunge în Firebase (alegerea „se salvează” doar în pagină).
function demoInput(k, v) {
  if (k === "draw") return demoDraw();
  if (k === "duel") return demoDuel(v);
  if (k === "pick") return { players: demoPlayers(), uid: "d1", side: "A", turn: 2 };
  if (k === "card") { const c = demoCard(); return { card: c.base }; }
  return demoCinema();
}
export function HideSeekDemoButtons() {
  const [demo, setDemo] = useState(null);
  return (
    <>
      <div style={s.demoGrid}>{DEMOS.map(([k, v, l]) => <button key={v} type="button" style={s.demoBtn} onClick={() => setDemo({ k, v, l, data: demoInput(k, v) })}>{l}</button>)}</div>
      {demo && <Suspense fallback={<HsLoading />}><HideSeekStage kind={demo.k} data={demo.data} title={`DEMO · ${demo.l}`} onSubmit={() => new Promise((r) => setTimeout(r, 700))} onClose={() => setDemo(null)} /></Suspense>}
    </>
  );
}

function nextSundayEnd() {
  const d = new Date(); const add = (7 - d.getDay()) % 7; d.setDate(d.getDate() + add); d.setHours(23, 59, 0, 0);
  if (d.getTime() < Date.now()) d.setDate(d.getDate() + 7);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function HideSeekAdminPanel({ gameweekId }) {
  const [game, setGame] = useState(undefined);
  const [marks, setMarks] = useState({});
  const [names, setNames] = useState({});
  const [players, setPlayers] = useState({});
  const [endAt, setEndAt] = useState(nextSundayEnd());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [preview, setPreview] = useState(null);
  const [replay, setReplay] = useState(false);
  const [cinema, setCinema] = useState(null);

  const endMs = game?.endAt?.toMillis ? game.endAt.toMillis() : NaN;
  const load = () => getHideSeek(gameweekId).then(setGame).catch(() => setGame(null));
  useEffect(() => { load(); }, [gameweekId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => (game ? listenMarks(gameweekId, (m) => m && setMarks(m)) : undefined), [game, gameweekId]);
  useEffect(() => {
    if (!game?.participants?.length) return;
    Promise.all([getUserPublicProfiles(game.participants).catch(() => ({})), getSeasonNumbers().catch(() => null), getPlayerLooks().catch(() => ({ bald: {} }))]).then(([pr, nums, looks]) => {
      setNames(pr || {});
      setPlayers(Object.fromEntries(game.participants.map((u) => [u, { nick: pr?.[u]?.nickname || "?", avatarId: pr?.[u]?.avatarId || null, number: nums?.numbers?.[u] ?? null, bald: !!looks?.bald?.[u] }])));
    });
  }, [game]);

  async function draw() {
    const d = new Date(endAt);
    if (!(d.getTime() > Date.now())) { setMsg("Termenul trebuie să fie în viitor."); return; }
    if (!window.confirm(`Trag perechile ACUM?\n\nTermen: ${d.toLocaleString("ro-RO")}\nPerechile se salvează definitiv (un replay nu le schimbă).`)) return;
    setBusy(true); setMsg("");
    try { const g = await startHideSeek(gameweekId, d); setMsg(g.already ? "Perechile erau deja trase — nu s-a schimbat nimic." : `✅ ${g.pairs.length} perechi trase.`); await load(); }
    catch (e) { setMsg(`Eroare: ${e.message || e.code}`); }
    setBusy(false);
  }
  async function cancel() {
    if (!window.confirm("Anulezi tragerea? Merge DOAR dacă nimeni n-a confirmat încă nicio tură.")) return;
    setBusy(true); setMsg("");
    try { await cancelHideSeek(gameweekId); setGame(null); setMarks({}); setMsg("Tragerea a fost anulată."); } catch (e) { setMsg(`Eroare: ${e.message || e.code}`); }
    setBusy(false);
  }
  // 🎬 Seara de proiecție: doar citire (Admin vede toate alegerile). Nu scrie nimic.
  async function openCinema() {
    setBusy(true); setMsg("");
    try { const r = await computeHideSeekPoints(gameweekId); const closedNow = Number.isFinite(endMs) && Date.now() >= endMs; setCinema({ players, pairs: game.pairs, bye: game.bye, byPair: r.byPair || {}, closed: closedNow, gw: gameweekId }); }
    catch (e) { setMsg(`Eroare: ${e.message || e.code}`); }
    setBusy(false);
  }
  async function calc() {
    setBusy(true); setMsg("");
    try { const r = await computeHideSeekPoints(gameweekId); setPreview(r.points); } catch (e) { setMsg(`Eroare: ${e.message || e.code}`); }
    setBusy(false);
  }

  const nick = (u) => names?.[u]?.nickname || u?.slice(0, 6) || "?";

  return (
    <div style={s.box}>
      <div style={s.title}>🚪 Ascunselea</div>
      {game === undefined ? <p style={s.hint}>Se încarcă…</p> : !game ? (
        <>
          <p style={s.hint}>Pasul 1: trage perechile (o singură dată, cu toți jucătorii activi). Pasul 2: Dezvăluie surpriza. „Rezolvă” merge doar după termen.</p>
          <label style={s.lbl}>Termen final (ora României)</label>
          <input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} style={s.input} />
          <button type="button" style={s.btnGold} disabled={busy} onClick={draw}>🎲 Trage perechile</button>
        </>
      ) : (
        <>
          <p style={s.hint}>Termen: <b>{Number.isFinite(endMs) ? new Date(endMs).toLocaleString("ro-RO") : "—"}</b>{Number.isFinite(endMs) && Date.now() >= endMs ? " · ⏱ a trecut (poți Rezolva)" : ""}</p>
          <div style={s.table}>
            {game.pairs.map((p, i) => (
              <div key={i} style={s.pr}>
                <span style={s.pn}>{nick(p.a)} <span style={{ color: "#19b85a" }}>●</span> vs <span style={{ color: "#2f6fff" }}>●</span> {nick(p.b)}</span>
                <span style={s.turns}>{Array.from({ length: HS_TURNS }, (_, k) => {
                  const a = hasMark(marks, i, k + 1, p.a); const b = hasMark(marks, i, k + 1, p.b);
                  return <span key={k} title={`Tura ${k + 1}`} style={{ ...s.dot, background: a && b ? "#19b85a" : a || b ? "#f2c14c" : "rgba(255,255,255,.12)" }}>{k + 1}</span>;
                })}</span>
              </div>
            ))}
            {game.bye && <p style={s.hint}>Pe bancă: {nick(game.bye)} · {HS_BYE_POINTS} PCT</p>}
          </div>
          <p style={s.hint}>🟢 ambii au confirmat · 🟡 doar unul · gri = încă nimeni. Seara de proiecție doar arată (nu schimbă puncte, alegeri sau rezultate).</p>
          <div style={s.row}>
            <button type="button" style={s.btn} onClick={() => setReplay(true)}>🎬 Replay tragere</button>
            <button type="button" style={s.btn} disabled={busy} onClick={calc}>🧮 Previzualizare puncte</button>
            <button type="button" style={{ ...s.btn, background: "#ff3b6b", borderColor: "#ff3b6b" }} disabled={busy} onClick={openCinema}>🎬 SEARA DE PROIECȚIE</button>
            {!Object.keys(marks).length && <button type="button" style={s.btn} disabled={busy} onClick={cancel}>Anulează tragerea</button>}
          </div>
          {preview && (
            <div style={s.table}>
              {Object.entries(preview).sort((a, b) => b[1] - a[1]).map(([u, v]) => <div key={u} style={s.pr}><span style={s.pn}>{nick(u)}</span><b>{v} PCT</b></div>)}
              <p style={s.hint}>Calcul la termen (turele nejucate = câștigate de cine a confirmat). Punctele se scriu oficial doar la „Rezolvă”.</p>
            </div>
          )}
        </>
      )}
      {msg && <p style={{ ...s.hint, color: color.goldLight }}>{msg}</p>}
      <div style={s.sub}>🧪 Demo (fără Firebase)</div>
      <HideSeekDemoButtons />
      {replay && game && <Suspense fallback={<HsLoading />}><HideSeekStage kind="draw" data={{ players, pairs: game.pairs, bye: game.bye }} title="Replay tragere (perechile salvate)" onClose={() => setReplay(false)} /></Suspense>}
      {cinema && <Suspense fallback={<HsLoading />}><HideSeekStage kind="cinema" data={cinema} title="🎬 Seara de proiecție" onClose={() => setCinema(null)} /></Suspense>}
    </div>
  );
}

const s = {
  box: { background: "rgba(242,122,166,.06)", border: "1px solid rgba(242,122,166,.4)", borderRadius: 12, padding: 12, marginTop: 10 },
  title: { fontSize: 15, fontWeight: 900, color: "#fff", marginBottom: 4 },
  sub: { fontSize: 12.5, fontWeight: 800, color: "#ffd0dc", margin: "12px 0 6px" },
  hint: { fontSize: 12, color: color.textMuted, lineHeight: 1.45, margin: "6px 0" },
  lbl: { fontSize: 12, color: color.textSecondary, display: "block", margin: "8px 0 4px" },
  input: { width: "100%", boxSizing: "border-box", background: "#0f1424", color: "#fff", border: `1px solid ${color.border}`, borderRadius: 8, padding: "8px 10px", fontSize: 14 },
  btnGold: { width: "100%", marginTop: 10, background: "linear-gradient(180deg,#f5c451,#c99a2e)", color: "#1a1408", border: "none", borderRadius: 10, padding: "11px", fontSize: 14, fontWeight: 900 },
  btn: { background: "rgba(255,255,255,.06)", color: "#fff", border: `1px solid ${color.border}`, borderRadius: 8, padding: "8px 10px", fontSize: 12.5, fontWeight: 800 },
  row: { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 },
  table: { background: "rgba(0,0,0,.2)", borderRadius: 8, padding: "4px 8px", marginTop: 6 },
  pr: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, padding: "5px 0", borderTop: `1px solid ${color.border}`, fontSize: 12.5, color: "#e8edf5" },
  pn: { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  turns: { display: "flex", gap: 3 },
  dot: { width: 18, height: 18, borderRadius: 4, fontSize: 10, color: "#0b0f18", fontWeight: 900, display: "inline-flex", alignItems: "center", justifyContent: "center" },
  demoGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 },
  demoBtn: { background: "rgba(255,255,255,.05)", color: "#fff", border: `1px solid ${color.border}`, borderRadius: 8, padding: "9px 6px", fontSize: 12, fontWeight: 800, textAlign: "left" },
};
