import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { auth } from "../firebase";
import { BRIDGE_ERRORS, loadBridgeAssets, resetTestBridge, startBridge, getBridge } from "../services/bridgeService";
import { applyCashout, applyJump, cashoutValue, initialPlayerState, makeRoute, publicView } from "../services/bridgeLogic";
import BridgeScreen from "../screens/BridgeScreen";

const GlassBridge3D = lazy(() => import("./GlassBridge3D"));

// ══════════════════════════════════════════════════════════════════
// 🌉 Admin — testarea Podului FĂRĂ etapă de test și fără să-i afecteze pe jucători.
//   A. DEMO local: totul pe telefonul tău (traseu local, fără Firebase, fără server).
//      Butoane „Forțează sigur / spart” ca să vezi ambele animații.
//   B. Test pe server: Podul REAL (server + reguli), dar pe un id separat
//      „test-bridge”, care nu e legat de nicio etapă și nu apare la jucători.
//      Se poate reseta oricând (doar podurile „test-…” se pot reseta).
// ══════════════════════════════════════════════════════════════════
const TEST_ID = "test-bridge";

export default function BridgeTestLab() {
  const [mode, setMode] = useState("local");
  return (
    <div>
      <div style={st.tabs}>
        <button type="button" style={{ ...st.tab, ...(mode === "local" ? st.tabOn : {}) }} onClick={() => setMode("local")}>A · DEMO local</button>
        <button type="button" style={{ ...st.tab, ...(mode === "server" ? st.tabOn : {}) }} onClick={() => setMode("server")}>B · Test pe server</button>
      </div>
      {mode === "local" ? <LocalDemo /> : <ServerTest />}
    </div>
  );
}

function LocalDemo() {
  const [assets, setAssets] = useState(null);
  const [err, setErr] = useState("");
  const [force, setForce] = useState("auto");
  const [sound, setSound] = useState(false);
  const [run, setRun] = useState(0);
  const [role, setRole] = useState("player");
  const sim = useRef(null);
  const [state, setState] = useState(null);
  const forceRef = useRef(force); forceRef.current = force;

  useEffect(() => { loadBridgeAssets().then(setAssets).catch((e) => setErr(e.message)); }, []);
  useEffect(() => { sim.current = { route: makeRoute(Math.random), st: initialPlayerState("demo", "p1") }; setState(publicView(sim.current.st)); }, [run]);

  async function onPick(row, side) {
    await new Promise((r) => setTimeout(r, 600)); // ca un server real
    const s = sim.current;
    if (forceRef.current !== "auto") s.route[row] = forceRef.current === "safe" ? side : 1 - side;
    const r = applyJump(s.st, s.route, row, side);
    if (r.ok) s.st = r.state;
    return { ...r, state: publicView(r.state || s.st) };
  }
  function cash() {
    const r = applyCashout(sim.current.st);
    if (r.ok) { sim.current.st = r.state; setState(publicView(r.state)); }
  }

  if (err) return <p style={st.note}>Lipsesc resursele: {err}</p>;
  const s = state || {};
  return (
    <div>
      <div style={st.row}>
        <span style={st.pill}>Treapta {s.step || 0}/9</span>
        <span style={st.pill}>{"♥".repeat(Math.max(0, s.lives || 0))}</span>
        <span style={st.pill}>{s.status || "active"}</span>
        <button type="button" style={st.small} onClick={() => setSound((v) => !v)}>{sound ? "🔊" : "🔇"}</button>
      </div>
      {assets ? (
        <Suspense fallback={<p style={st.note}>Se încarcă…</p>}>
          <GlassBridge3D key={run} assets={assets} me={{ num: "456", role }} partner={{ num: "067", name: "Partener", step: 3, status: "active" }}
            state={state} onPick={onPick} onState={(x) => x && setState(x)} soundOn={sound} height={Math.min(560, Math.round(window.innerHeight * 0.6))} />
        </Suspense>
      ) : <p style={st.note}>Se încarcă resursele…</p>}
      <div style={st.row}>
        <span style={st.lbl}>COSTUM</span>
        <select style={st.small} value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="player">Nobody (verde)</option>
          <option value="guard">Guard (roșu)</option>
          <option value="vip2">Pretender 002</option>
          <option value="vip3">Pretender 003</option>
          <option value="vip4">Pretender 004</option>
          <option value="boss">Leader 001 (negru)</option>
        </select>
      </div>
      <div style={st.row}>
        <span style={st.lbl}>TEST</span>
        {[["auto", "Aleator"], ["safe", "Forțează sigur"], ["fail", "Forțează spart"]].map(([k, l]) => (
          <button key={k} type="button" style={{ ...st.small, ...(force === k ? st.on : {}) }} onClick={() => setForce(k)}>{l}</button>
        ))}
      </div>
      <div style={st.row}>
        {s.status === "active" && (s.step || 0) >= 5 && <button type="button" style={st.gold} onClick={cash}>Încasează {cashoutValue(s.step)} PCT</button>}
        <button type="button" style={st.small} onClick={() => setRun((x) => x + 1)}>↺ Joc nou</button>
      </div>
    </div>
  );
}

function ServerTest() {
  const [bridge, setBridge] = useState(undefined);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(0);
  const load = () => getBridge(TEST_ID).then(setBridge).catch((e) => { setBridge(null); setMsg(`Nu pot citi: ${e.code || e.message} (regulile Firestore sunt publicate?)`); });
  useEffect(() => { load(); }, []);

  async function start() {
    setBusy(true); setMsg("");
    const r = await startBridge(TEST_ID, Date.now() + 2 * 86400e3);
    setBusy(false);
    setMsg(r.ok ? (r.already ? "Era deja pornit." : `Pornit: ${r.pairs} perechi (toți jucătorii activi, dar NU apare la ei).`) : (BRIDGE_ERRORS[r.error] || r.error));
    await load(); setKey((x) => x + 1);
  }
  async function reset() {
    if (!window.confirm("Ștergi Podul de test? (Nu atinge nimic real.)")) return;
    setBusy(true); setMsg("");
    const r = await resetTestBridge(TEST_ID);
    setBusy(false);
    setMsg(r.ok ? "Podul de test a fost șters. Îl poți porni din nou." : (BRIDGE_ERRORS[r.error] || r.error));
    await load(); setKey((x) => x + 1);
  }

  return (
    <div>
      <p style={st.note}>Folosește serverul și regulile REALE, pe un pod separat („test-bridge”), care nu e legat de nicio etapă și nu apare la jucători. Funcționează după publicarea regulilor Firestore.</p>
      <div style={st.row}>
        {!bridge && <button type="button" style={st.gold} onClick={start} disabled={busy}>Pornește Podul de test</button>}
        {bridge && <button type="button" style={st.small} onClick={reset} disabled={busy}>🗑 Resetează Podul de test</button>}
      </div>
      {msg && <p style={{ ...st.note, color: "#F5C451" }}>{msg}</p>}
      {bridge && auth.currentUser && <BridgeScreen key={key} gameweekId={TEST_ID} uid={auth.currentUser.uid} />}
    </div>
  );
}

const st = {
  tabs: { display: "flex", gap: 6, marginBottom: 10 },
  tab: { flex: 1, padding: "9px 6px", borderRadius: 9, border: "1px solid rgba(255,255,255,.15)", background: "transparent", color: "#cfd8dc", fontWeight: 800, fontSize: 12.5 },
  tabOn: { background: "rgba(245,196,81,.15)", borderColor: "#F5C451", color: "#F5C451" },
  row: { display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", margin: "8px 0" },
  pill: { background: "rgba(10,30,30,.6)", border: "1px solid rgba(173,255,230,.16)", borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 700, color: "#EAF6F2" },
  lbl: { fontSize: 11, color: "#8DB3AA" },
  small: { padding: "8px 10px", borderRadius: 10, border: "1px solid rgba(173,255,230,.16)", background: "rgba(0,0,0,.45)", color: "#EAF6F2", fontWeight: 700, fontSize: 12 },
  on: { borderColor: "#F5C451", color: "#F5C451" },
  gold: { padding: "9px 12px", borderRadius: 10, border: "none", background: "linear-gradient(180deg,#ffd978,#e7a92e)", color: "#2a1a00", fontWeight: 800, fontSize: 12.5 },
  note: { fontSize: 12.5, color: "#8DB3AA", lineHeight: 1.45 },
};
