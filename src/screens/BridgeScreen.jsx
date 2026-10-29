import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import useNow from "../hooks/useNow";
import { getUserPublicProfiles } from "../services/profilesService";
import { getSeasonNumbers, formatPlayerNumber, getPlayerLooks } from "../services/seasonNumbersService";
import { BRIDGE_ERRORS, cashoutBridge, getBridge, jumpBridge, listBridgePlayers, loadBridgeAssets } from "../services/bridgeService";
import { BRIDGE_MIN_CASHOUT_STEP, BRIDGE_ROWS, cashoutValue } from "../services/bridgeLogic";

// Scena 3D (Three.js) se încarcă doar aici — restul aplicației nu o descarcă.
const GlassBridge3D = lazy(() => import("../components/GlassBridge3D"));

// ══════════════════════════════════════════════════════════════════
// 🌉 PODUL DE STICLĂ — ecranul jucătorului (Surprize → Bonus).
// Starea proprie și a partenerului vin din Firestore (documente PUBLICE,
// fără trasee), urmărite live doar cât ecranul e deschis. Săriturile și
// încasarea trec EXCLUSIV prin serverul /api/bridge.
// ══════════════════════════════════════════════════════════════════
const SOUND_KEY = "bridge-sound";
// Costumul pe pod, după numărul înghețat (clasamentul general dinaintea sezonului):
// 001 The Leader (negru, glugă) · 002–004 The Pretenders (costume colorate) · 005–010 The Guards (roșu, glugă) · restul verde.
function roleForNumber(n) {
  if (n === 1) return "boss";
  if (n >= 2 && n <= 4) return `vip${n}`;
  if (n >= 5 && n <= 10) return "guard";
  return "player";
}
const C = { gold: "#F5C451", red: "#FF4053", mint: "#2FBF9A", dim: "#8DB3AA", ink: "#EAF6F2", line: "rgba(173,255,230,.16)" };

export default function BridgeScreen({ gameweekId, uid }) {
  const [bridge, setBridge] = useState(undefined);
  const [mine, setMine] = useState(null);
  const [partnerState, setPartnerState] = useState(null);
  const [profiles, setProfiles] = useState({});
  const [numbers, setNumbers] = useState({});
  const [assets, setAssets] = useState(null);
  const [assetErr, setAssetErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmCash, setConfirmCash] = useState(false);
  const [msg, setMsg] = useState("");
  const [sound, setSound] = useState(() => { try { return localStorage.getItem(SOUND_KEY) === "on"; } catch { return false; } });
  const now = useNow(1000);
  const sceneApi = useRef(null);
  const [apiReady, setApiReady] = useState(0);
  const introKey = `bridge-intro-${gameweekId}-${uid}`;
  const [introDone, setIntroDone] = useState(() => { try { return localStorage.getItem(introKey) === "1"; } catch { return true; } });
  const [allPlayers, setAllPlayers] = useState([]);
  // Toți jucătorii Podului (pentru panoul „SUPRAVIEȚUITORI” și anunțurile vocale): o citire la deschidere.
  useEffect(() => { listBridgePlayers(gameweekId).then(setAllPlayers).catch(() => {}); }, [gameweekId, mine?.status]);

  useEffect(() => { getBridge(gameweekId).then(setBridge).catch(() => setBridge(null)); }, [gameweekId]);
  useEffect(() => { loadBridgeAssets().then(setAssets).catch((e) => setAssetErr(e.message)); }, []);
  useEffect(() => { getSeasonNumbers().then((d) => setNumbers(d?.numbers || {})).catch(() => {}); }, []);
  const [bald, setBald] = useState({});
  useEffect(() => { getPlayerLooks().then((d) => setBald(d?.bald || {})).catch(() => {}); }, []);

  const pair = useMemo(() => (bridge?.pairs || []).find((p) => p.members.includes(uid)) || null, [bridge, uid]);
  const partnerUid = pair && !pair.solo ? pair.members.find((m) => m !== uid) : null;

  // Starea mea și a partenerului: live, doar cât ecranul e deschis (2 documente mici).
  useEffect(() => {
    if (!bridge || !pair) return undefined;
    const offs = [onSnapshot(doc(db, "bridge", gameweekId, "players", uid), (s) => setMine(s.exists() ? s.data() : null), () => {})];
    if (partnerUid) offs.push(onSnapshot(doc(db, "bridge", gameweekId, "players", partnerUid), (s) => setPartnerState(s.exists() ? s.data() : null), () => {}));
    return () => offs.forEach((f) => f());
  }, [bridge, pair, partnerUid, gameweekId, uid]);

  useEffect(() => {
    const ids = [uid, partnerUid].filter(Boolean);
    getUserPublicProfiles(ids).then(setProfiles).catch(() => {});
  }, [uid, partnerUid]);

  useEffect(() => { try { localStorage.setItem(SOUND_KEY, sound ? "on" : "off"); } catch { /* fără stocare */ } }, [sound]);

  const meInfo = useMemo(() => ({ num: formatPlayerNumber(numbers[uid]), role: roleForNumber(Number(numbers[uid])), hair: bald[uid] ? "bald" : "buzzed", hairColor: "negru" }), [numbers, uid, bald]);
  const partnerInfo = useMemo(() => (partnerUid && partnerState ? {
    num: formatPlayerNumber(numbers[partnerUid]), name: profiles[partnerUid]?.nickname || "Partener",
    role: roleForNumber(Number(numbers[partnerUid])), hair: bald[partnerUid] ? "bald" : "buzzed", hairColor: "negru", step: partnerState.step, status: partnerState.status,
  } : null), [partnerUid, partnerState, numbers, profiles, bald]);

  // Panoul „SUPRAVIEȚUITORI” + anunțul vocal al eliminărilor noi (de la ultima vizită, maximum 3).
  useEffect(() => {
    const api = sceneApi.current; if (!api || !allPlayers.length) return;
    const alive = allPlayers.filter((p) => p.status !== "eliminated").length;
    api.setSurvivors(alive, allPlayers.length);
    if (!sound) return;
    const key = `bridge-elim-${gameweekId}-${uid}`;
    let seen = []; try { seen = JSON.parse(localStorage.getItem(key) || "[]"); } catch { /* */ }
    const fresh = allPlayers.filter((p) => p.status === "eliminated" && p.uid !== uid && !seen.includes(p.uid));
    const dig = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
    fresh.slice(0, 3).forEach((p, i) => {
      const n = formatPlayerNumber(numbers[p.uid]); if (!n) return;
      api.say(`Player ${n.split("").map((d) => dig[+d]).join(" ")}. Eliminated.`, 1200 + i * 2600);
    });
    try { localStorage.setItem(key, JSON.stringify([...seen, ...fresh.map((p) => p.uid)])); } catch { /* */ }
  }, [allPlayers, numbers, sound, gameweekId, uid, apiReady]);

  if (bridge === undefined) return <Box><p style={st.note}>Se încarcă Podul…</p></Box>;
  if (!bridge) return <Box><p style={st.note}>Podul nu a fost pornit încă pentru această etapă.</p></Box>;
  if (!pair) return <Box><p style={st.note}>Nu ești înscris în Podul acestei etape.</p></Box>;
  if (assetErr) return <Box><p style={st.note}>Nu s-au putut încărca resursele Podului ({assetErr}).</p></Box>;

  const left = Math.max(0, (bridge.deadlineMs || 0) - now);
  const closed = left <= 0;
  const status = mine?.status || "active";
  const step = mine?.step || 0;
  const lives = mine?.lives ?? 0;
  const maxLives = mine?.maxLives || 3;
  const avail = cashoutValue(step);
  const canCash = !closed && !busy && status === "active" && step >= BRIDGE_MIN_CASHOUT_STEP;
  const partnerStatusLabel = { active: "pe pod", cashed: `a încasat ${partnerState?.points || 0} PCT`, won: "a traversat · 100 PCT", eliminated: "eliminat" };

  async function onPick(row, side) {
    setMsg("");
    const r = await jumpBridge(gameweekId, row, side);
    if (!r.ok && r.error && !["stale"].includes(r.error)) setMsg(BRIDGE_ERRORS[r.error] || BRIDGE_ERRORS.server);
    return r;
  }
  async function doCash() {
    setConfirmCash(false); setBusy(true); setMsg("");
    const r = await cashoutBridge(gameweekId);
    setBusy(false);
    if (!r.ok) setMsg(BRIDGE_ERRORS[r.error] || BRIDGE_ERRORS.server);
    else sceneApi.current?.cashOut(r.points ?? r.state?.points ?? avail);
  }
  function startIntro() {
    setSound(true); sceneApi.current?.setSound(true);
    try { localStorage.setItem(introKey, "1"); } catch { /* fără stocare */ }
    setIntroDone(true);
    setTimeout(() => sceneApi.current?.playIntro(), 150);
  }

  const h = Math.floor(left / 3600e3), m = Math.floor((left % 3600e3) / 60e3);
  return (
    <Box>
      <div style={st.top}>
        <span style={st.brand}>PODUL DE <i style={{ color: "#FF2D7A", fontStyle: "normal" }}>STICLĂ</i></span>
        <button type="button" style={st.snd} onClick={() => setSound((v) => !v)} aria-label="Sunet">{sound ? "🔊" : "🔇"}</button>
      </div>
      <div style={st.hud}>
        <span style={st.pill}>Treapta <b style={{ color: C.gold }}>{step}</b>/{BRIDGE_ROWS}</span>
        <span style={{ ...st.pill, color: C.red, letterSpacing: 2 }}>{"♥".repeat(Math.max(0, lives))}{"♡".repeat(Math.max(0, maxLives - lives))}</span>
        <span style={st.pill}>De încasat <b style={{ color: C.gold }}>{avail}</b> PCT</span>
        <span style={st.pill}>{closed ? "Închis" : `${h}h ${m}m`}</span>
      </div>
      {partnerUid ? (
        <div style={st.partner}>👥 {partnerInfo?.num ? `${partnerInfo.num} · ` : ""}{profiles[partnerUid]?.nickname || "Partener"} · treapta {partnerState?.step ?? 0} · {"♥".repeat(Math.max(0, partnerState?.lives ?? 0))} · {partnerStatusLabel[partnerState?.status] || ""}</div>
      ) : (
        <div style={st.partner}>Joci singur: ai {maxLives} vieți.</div>
      )}

      {assets ? (
        <Suspense fallback={<div style={st.loading}>Se pregătește podul…</div>}>
          <GlassBridge3D assets={assets} me={meInfo} partner={partnerInfo} state={mine} onPick={onPick}
            onReady={(api) => { sceneApi.current = api; setApiReady((x) => x + 1); }} onBusy={setBusy} onState={(x) => { if (x) setMine((m) => ({ ...(m || {}), ...x })); }} soundOn={sound} height={Math.min(620, Math.round(window.innerHeight * 0.66))} />
        </Suspense>
      ) : <div style={st.loading}>Se încarcă podul…</div>}

      {!introDone && status === "active" && step === 0 && assets && (
        <button type="button" style={st.intro} onClick={startIntro}>▶ INTRĂ ÎN PROBĂ</button>
      )}
      {msg && <p style={{ ...st.note, color: C.gold }}>{msg}</p>}
      {status === "active" && !closed && <p style={st.hint}>{busy ? "" : step === 0 ? "Atinge panoul pe care vrei să sari" : "Alege următorul panou"}</p>}
      {status === "active" && !closed && (
        <div style={st.ladder} aria-label="Punctele pe trepte">
          {[5, 6, 7, 8, 9].map((t) => (
            <span key={t} style={{ ...st.rung, ...(step >= t ? st.rungOn : {}), ...(step + 1 === t ? st.rungNext : {}) }}>
              <b>{t}</b><small>{cashoutValue(t)}</small>
            </span>
          ))}
        </div>
      )}
      {status === "active" && !closed && step < BRIDGE_MIN_CASHOUT_STEP && <p style={st.hint}>Poți încasa de la treapta {BRIDGE_MIN_CASHOUT_STEP} (20 PCT).</p>}
      {canCash && <button type="button" style={st.cash} onClick={() => setConfirmCash(true)}>ÎNCASEAZĂ {avail} PCT</button>}

      {status !== "active" && (
        <div style={st.end}>
          {status === "won" && <><b style={{ color: C.gold }}>POD TRAVERSAT</b> · 100 PCT</>}
          {status === "cashed" && <><b style={{ color: C.gold }}>AI ÎNCASAT</b> · {mine?.points || 0} PCT</>}
          {status === "eliminated" && <><b style={{ color: C.red }}>ELIMINAT</b> · 0 PCT</>}
        </div>
      )}
      {status === "active" && closed && <div style={st.end}>Termenul a expirat. Fără încasare, rezultatul e 0 PCT.</div>}

      {confirmCash && (
        <div style={st.sheetBack} onClick={() => setConfirmCash(false)}>
          <div style={st.sheet} onClick={(e) => e.stopPropagation()}>
            <div style={st.sheetTitle}>ÎNCASEZI {avail} PCT?</div>
            <p style={st.note}>Ieși definitiv din joc cu punctele acestea. Nu mai poți reveni pentru mai mult.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" style={st.btnGhost} onClick={() => setConfirmCash(false)}>Continui</button>
              <button type="button" style={st.btnGold} onClick={doCash}>Încasez</button>
            </div>
          </div>
        </div>
      )}
    </Box>
  );
}

function Box({ children }) {
  return <div style={st.box}>{children}</div>;
}

const st = {
  box: { background: "#041211", border: `1px solid ${C.line}`, borderRadius: 16, padding: 12, color: C.ink, fontFamily: "Inter, system-ui, sans-serif" },
  top: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  brand: { font: "700 20px/1 Oswald, 'Arial Narrow', sans-serif", letterSpacing: 0.5 },
  snd: { minWidth: 40, height: 34, borderRadius: 999, border: `1px solid ${C.line}`, background: "rgba(0,0,0,.4)", color: C.ink, fontSize: 15 },
  hud: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 },
  pill: { background: "rgba(10,30,30,.6)", border: `1px solid ${C.line}`, borderRadius: 999, padding: "4px 10px", fontSize: 12.5, fontWeight: 700 },
  partner: { fontSize: 12.5, color: C.dim, margin: "2px 0 8px" },
  loading: { height: 420, display: "flex", alignItems: "center", justifyContent: "center", color: C.dim, fontSize: 13 },
  note: { fontSize: 13, color: C.dim, lineHeight: 1.45, margin: "8px 0" },
  hint: { textAlign: "center", fontSize: 13, color: C.dim, margin: "8px 0" },
  ladder: { display: "flex", gap: 6, justifyContent: "center", margin: "6px 0" },
  rung: { display: "flex", flexDirection: "column", alignItems: "center", minWidth: 48, padding: "4px 6px", borderRadius: 10, border: `1px solid ${C.line}`, color: C.dim, fontSize: 12 },
  rungOn: { borderColor: C.gold, color: C.gold, background: "rgba(245,196,81,.12)" },
  rungNext: { borderStyle: "dashed", borderColor: C.ink, color: C.ink },
  intro: { width: "100%", minHeight: 54, marginTop: 8, borderRadius: 14, border: "1px solid #ff2d7a", background: "rgba(255,45,122,.15)", color: "#fff", font: "800 17px Oswald, 'Arial Narrow', sans-serif", letterSpacing: 2 },
  cash: { width: "100%", minHeight: 50, borderRadius: 14, border: "none", background: "linear-gradient(180deg,#ffd978,#e7a92e)", color: "#2a1a00", font: "800 16px Inter, sans-serif", marginTop: 6 },
  end: { textAlign: "center", fontSize: 16, marginTop: 10, padding: 10, borderRadius: 12, background: "rgba(0,0,0,.35)", border: `1px solid ${C.line}` },
  sheetBack: { position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 3000, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "0 14px 18px" },
  sheet: { width: "100%", maxWidth: 440, background: "#0b1a18", border: `1px solid ${C.line}`, borderRadius: 18, padding: 16 },
  sheetTitle: { font: "700 24px Oswald, sans-serif", color: C.gold, marginBottom: 4 },
  btnGhost: { flex: 1, minHeight: 48, borderRadius: 12, border: `1px solid ${C.line}`, background: "transparent", color: C.ink, fontWeight: 800 },
  btnGold: { flex: 1, minHeight: 48, borderRadius: 12, border: "none", background: "linear-gradient(180deg,#ffd978,#e7a92e)", color: "#2a1a00", fontWeight: 800 },
};
