import { useEffect, useState } from "react";
import { color } from "../theme";
import { getUserPublicProfiles } from "../services/profilesService";
import { BRIDGE_ERRORS, getBridge, listBridgePlayers, startBridge } from "../services/bridgeService";
import { finalPoints } from "../services/bridgeLogic";

// ══════════════════════════════════════════════════════════════════
// 🌉 Admin — Podul de Sticlă pentru etapa curentă.
//   1. Alegi termenul și apeși „Pornește Podul”: serverul formează perechile
//      și generează traseele secrete (o singură dată; nu se mai regenerează).
//   2. Apoi „Dezvăluie BONUS”, ca la orice Surpriză Mică.
//   3. Aici vezi starea fiecărui jucător (fără să vezi traseele — nici Adminul nu le vede).
//   4. La final, „Rezolvă” acordă punctele: doar cine a încasat sau a traversat.
// ══════════════════════════════════════════════════════════════════
const pad = (n) => String(n).padStart(2, "0");
const toLocal = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
function defaultDeadline() { // duminica viitoare, 23:59
  const d = new Date(); const add = (7 - d.getDay()) % 7 || 7; d.setDate(d.getDate() + add); d.setHours(23, 59, 0, 0); return d.getTime();
}

export default function BridgeAdminPanel({ gameweekId }) {
  const [bridge, setBridge] = useState(undefined);
  const [players, setPlayers] = useState([]);
  const [names, setNames] = useState({});
  const [deadline, setDeadline] = useState(toLocal(defaultDeadline()));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    try {
      const b = await getBridge(gameweekId); setBridge(b);
      if (b) {
        const ps = await listBridgePlayers(gameweekId); setPlayers(ps);
        setNames(await getUserPublicProfiles(ps.map((p) => p.uid)));
      }
    } catch (e) { setBridge(null); setMsg(`Nu pot citi Podul: ${e.code || e.message} (regulile Firestore sunt publicate?)`); }
  }
  useEffect(() => { load(); }, [gameweekId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function start() {
    const ms = new Date(deadline).getTime();
    if (!Number.isFinite(ms) || ms <= Date.now()) { setMsg("Alege un termen în viitor."); return; }
    if (!window.confirm(`Pornești Podul? Perechile și traseele se generează acum și NU se mai pot schimba. Termen: ${new Date(ms).toLocaleString("ro-RO")}.`)) return;
    setBusy(true); setMsg("");
    const r = await startBridge(gameweekId, ms);
    setBusy(false);
    if (!r.ok) { setMsg(BRIDGE_ERRORS[r.error] || `Eroare: ${r.error}`); return; }
    setMsg(r.already ? "Podul era deja pornit." : `Podul a pornit: ${r.pairs} perechi. Acum poți dezvălui BONUSUL.`);
    load();
  }

  const name = (u) => names[u]?.nickname || u;
  const label = { active: "pe pod", cashed: "a încasat", won: "a traversat", eliminated: "eliminat" };

  if (bridge === undefined) return <p style={st.hint}>Se încarcă Podul…</p>;
  return (
    <div style={st.box}>
      <div style={st.title}>🌉 Podul de Sticlă</div>
      {!bridge ? (
        <>
          <p style={st.hint}>Pornește Podul ÎNAINTE de „Dezvăluie BONUS”. Perechile se formează din jucătorii activi; la număr impar, unul joacă singur, cu 5 vieți.</p>
          <label style={st.field}>Termen (după el nu se mai sare și nu se mai încasează)
            <input type="datetime-local" style={st.input} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </label>
          <button type="button" style={st.btnGold} onClick={start} disabled={busy}>{busy ? "…" : "🔒 Pornește Podul"}</button>
        </>
      ) : (
        <>
          <p style={st.hint}>Termen: {new Date(bridge.deadlineMs).toLocaleString("ro-RO")} · {bridge.pairs?.length || 0} perechi. Traseele nu sunt vizibile nici pentru Admin.</p>
          {(bridge.pairs || []).map((p) => (
            <div key={p.id} style={st.pair}>
              {p.members.map((u) => {
                const s = players.find((x) => x.uid === u);
                return (
                  <div key={u} style={st.row}>
                    <span style={st.nick}>{name(u)}{p.solo ? " (singur)" : ""}</span>
                    <span style={st.val}>{s ? `treapta ${s.step} · ${"♥".repeat(Math.max(0, s.lives))} · ${label[s.status] || s.status}${finalPoints(s) ? ` · ${finalPoints(s)} PCT` : ""}` : "—"}</span>
                  </div>
                );
              })}
            </div>
          ))}
          <button type="button" style={st.btn} onClick={load}>↻ Actualizează</button>
        </>
      )}
      {msg && <p style={st.msg}>{msg}</p>}
    </div>
  );
}

const st = {
  box: { marginTop: 10, padding: 10, background: color.surfaceInset, borderRadius: 8 },
  title: { fontWeight: 800, fontSize: 14, color: color.textPrimary, marginBottom: 6 },
  hint: { fontSize: 11.5, color: color.textMuted, lineHeight: 1.5, margin: "4px 0 8px" },
  field: { display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, color: color.textSecondary, marginBottom: 8 },
  input: { background: color.surface, color: color.textPrimary, border: `1px solid ${color.border}`, borderRadius: 6, padding: "6px 8px", fontSize: 13 },
  pair: { border: `1px solid ${color.border}`, borderRadius: 8, padding: "4px 8px", marginBottom: 6 },
  row: { display: "flex", justifyContent: "space-between", gap: 8, padding: "3px 0", fontSize: 12 },
  nick: { color: color.textPrimary, fontWeight: 700, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  val: { color: color.textSecondary, whiteSpace: "nowrap" },
  msg: { fontSize: 12, color: color.goldLight, marginTop: 8 },
  btn: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, padding: "7px 10px", fontSize: 12, fontWeight: 700, color: "#fff", cursor: "pointer" },
  btnGold: { background: color.goldGradient, border: "none", borderRadius: 6, padding: "8px 12px", fontSize: 12, fontWeight: 800, color: color.goldOn, cursor: "pointer" },
};
