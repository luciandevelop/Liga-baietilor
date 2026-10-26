import { useState } from "react";
import { doc, runTransaction } from "firebase/firestore";
import { db } from "../firebase";
import { getTreasureRunStatus } from "../services/surprisesService";
import { getUserNicknames } from "../services/adminService";
import { color, font, radius } from "../theme";

// Admin → Surprize → Comoara Blestemată (după „Dezvăluie”): cine a început, cine e în progres, cine a făcut cash-out,
// cine a pierdut viețile, cine a găsit comoara, cine a ajuns la 100 PCT + punctajele. DOAR la apăsare (o citire pe
// jucător activ + porecle), fără listener, fără polling. Singura acțiune: „↺ Reset” pentru jocurile în progres. Adminul vede și progresul în curs
// (pas, vieți, puncte acumulate) — jucătorii NU (ei văd doar rezultatele încheiate, în Clasamentul Piraților).
const GROUPS = [
  { id: "treasure", label: "🏆 Comoară găsită" },
  { id: "cashedout", label: "💰 Cash-out" },
  { id: "gameover", label: "💀 Vieți pierdute" },
  { id: "unfinished", label: "⛵ În progres" },
  { id: "not-played", label: "⚓ Nu au început" },
];

// ↺ Reset DOAR pentru jocurile ÎN PROGRES (neterminate, cu cel puțin o viață): șterge jocul privat al
// jucătorului, care poate începe din nou de la pasul 1, cu 2 vieți și 0 PCT. Verificat în tranzacție:
// dacă între timp jocul s-a terminat (comoară, cash-out, vieți pierdute) sau are deja rezultat public,
// resetarea e REFUZATĂ. Regulile Firestore permit deja ștergerea doar Adminului.
async function resetUnfinishedRun(gameweekId, uid) {
  const runRef = doc(db, "weeklySurprises", gameweekId, "treasureRuns", uid);
  const resRef = doc(db, "weeklySurprises", gameweekId, "treasureResults", uid);
  await runTransaction(db, async (tx) => {
    const run = await tx.get(runRef);
    const res = await tx.get(resRef);
    if (!run.exists()) throw new Error("jocul nu mai există");
    const r = run.data();
    if (r.finished || ["treasure", "cashedout", "gameover"].includes(r.phase) || Number(r.lives) <= 0) throw new Error("jocul s-a terminat între timp — nu se resetează");
    if (res.exists()) throw new Error("are deja rezultat public — nu se resetează");
    tx.delete(runRef);
  });
}

export default function TreasureRunsAdminPanel({ gameweekId }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState(null);
  const [busyUid, setBusyUid] = useState("");
  const [msg, setMsg] = useState("");

  async function doReset(r) {
    if (!window.confirm(`Resetezi jocul lui ${r.nickname}? Pierde progresul actual (pas ${r.step}/7, ${r.points} PCT) și începe de la zero, cu 2 vieți.`)) return;
    setBusyUid(r.uid); setMsg("");
    try { await resetUnfinishedRun(gameweekId, r.uid); setMsg(`✓ ${r.nickname} poate relua jocul de la început.`); await load(); }
    catch (err) { setMsg(`${r.nickname}: ${err.message || err.code}`); }
    finally { setBusyUid(""); }
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const status = await getTreasureRunStatus(gameweekId);
      let names = {};
      try { names = await getUserNicknames(status.map((r) => r.uid)); } catch (_) { /* doar afișare */ }
      setRows(status.map((r) => ({ ...r, nickname: names[r.uid] || r.uid })));
    } catch (err) {
      console.error("Comoara — status jucători:", err);
      setError("Nu s-a putut încărca statusul: " + (err.message || err.code));
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !rows) load();
  }

  const byGroup = (g) => (rows || []).filter((r) => r.status === g).sort((a, b) => a.nickname.localeCompare(b.nickname, "ro"));
  const count = (g) => byGroup(g).length;

  return (
    <div style={st.box}>
      <button type="button" style={st.btn} onClick={toggle}>{open ? "🏴‍☠️ Ascunde starea jucătorilor" : "🏴‍☠️ Starea jucătorilor (Comoara)"}</button>
      {open && (
        <div style={st.body}>
          {loading && <div style={st.hint}>Se încarcă…</div>}
          {error && <div style={{ ...st.hint, color: "#F0A94E" }}>{error}</div>}
          {rows && !loading && (
            <>
              <div style={st.summary}>
                Terminat: <b>{count("treasure") + count("cashedout") + count("gameover")}</b> · În progres: <b>{count("unfinished")}</b> · Nu au început: <b>{count("not-played")}</b>
                {" · "}La 100 PCT: <b>{rows.filter((r) => r.at100).length}</b>
              </div>
              {GROUPS.map((g) => {
                const list = byGroup(g.id);
                if (list.length === 0) return null;
                return (
                  <div key={g.id} style={st.group}>
                    <div style={st.groupTitle}>{g.label} ({list.length})</div>
                    {list.map((r) => (
                      <div key={r.uid} style={st.row}>
                        <span>{r.nickname}{r.at100 ? " 🌟 100 PCT" : ""}</span>
                        <span style={st.val}>
                          {g.id === "unfinished" ? `pas ${r.step}/7 · ${"❤️".repeat(Math.max(0, r.lives))}${"🖤".repeat(Math.max(0, 2 - r.lives))} · ${r.points} PCT acum` : g.id === "not-played" ? "—" : `${r.points} PCT`}
                          {g.id === "unfinished" && (
                            <button type="button" style={st.reset} onClick={() => doReset(r)} disabled={!!busyUid}>{busyUid === r.uid ? "…" : "↺ Reset"}</button>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })}
              {msg && <div style={{ ...st.hint, color: "#C9A227" }}>{msg}</div>}
              <button type="button" style={st.refresh} onClick={load} disabled={loading}>↻ Actualizează</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const st = {
  box: { marginTop: 8 },
  btn: {
    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6,
    padding: "6px 10px", fontSize: 10.5, fontWeight: 700, color: "#fff", cursor: "pointer",
  },
  body: { marginTop: 8, display: "flex", flexDirection: "column", gap: 8 },
  hint: { fontSize: 11.5, color: color.textMuted, lineHeight: 1.5 },
  summary: { fontSize: 12, color: "#fff", lineHeight: 1.5 },
  group: { background: "rgba(255,255,255,0.04)", borderRadius: radius.sm, padding: "8px 10px" },
  groupTitle: { fontSize: 11, fontWeight: 800, letterSpacing: "0.04em", color: "rgba(255,255,255,0.75)", marginBottom: 4 },
  row: { display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, color: "#fff", padding: "3px 0", fontFamily: font.body },
  val: { fontWeight: 700, color: "rgba(255,255,255,0.85)", textAlign: "right" },
  reset: { marginLeft: 8, background: "rgba(240,169,78,0.15)", border: "1px solid #F0A94E", borderRadius: 6, color: "#F0A94E", fontSize: 10.5, fontWeight: 800, padding: "2px 7px", cursor: "pointer" },
  refresh: { alignSelf: "flex-start", background: "none", border: "none", color: "#C9A227", fontSize: 11, fontWeight: 800, cursor: "pointer", padding: 0 },
};
