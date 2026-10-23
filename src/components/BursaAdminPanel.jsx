import { useState } from "react";
import PlayerAvatar from "./PlayerAvatar";
import { closeBursa, reopenBursa, getBursaEntryStatus } from "../services/bursaGame";
import { BURSA_PUBLIC_NAME } from "../services/bursaService";
import { color, radius } from "../theme";

// Admin → Surprize → PRINȚ SAU BROSCOI? (după „Dezvăluie”): cine și-a completat portofoliul și cine nu, ora primului meci
// (blocare automată), închidere manuală (dezvăluie imediat portofoliile tuturor) și redeschidere — DOAR înainte de
// primul meci. Se încarcă la apăsare (o singură dată + „Actualizează”): fără listener, fără polling.
const fmtTime = (ms) => (ms ? new Date(ms).toLocaleString("ro-RO", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");

export default function BursaAdminPanel({ gameweekId }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState(null);
  const [msg, setMsg] = useState("");

  async function refresh() {
    setBusy(true);
    try { setInfo(await getBursaEntryStatus(gameweekId)); setMsg(""); }
    catch (err) { console.error("Bursa — status:", err); setMsg("Nu s-a putut încărca: " + (err.message || err.code)); }
    finally { setBusy(false); }
  }
  function toggle() { const n = !open; setOpen(n); if (n && !info) refresh(); }

  async function doClose() {
    if (!window.confirm("Închizi înscrierile ACUM? Portofoliile tuturor devin vizibile imediat și nu se mai pot modifica. Redeschiderea e posibilă doar înainte de primul meci.")) return;
    setBusy(true);
    try { await closeBursa(gameweekId); setMsg("Închis — portofoliile sunt acum vizibile."); setInfo(await getBursaEntryStatus(gameweekId)); }
    catch (err) { setMsg("Eroare: " + (err.message || err.code)); }
    finally { setBusy(false); }
  }
  async function doReopen() {
    setBusy(true);
    try { await reopenBursa(gameweekId); setMsg("Redeschis — jucătorii pot modifica din nou."); setInfo(await getBursaEntryStatus(gameweekId)); }
    catch (err) { setMsg("Eroare: " + (err.message || err.code)); }
    finally { setBusy(false); }
  }

  const label = { done: "✓ a completat", missing: "încă nu", inactive: "dezactivat" };
  const tone = { done: "#33E38A", missing: "#F0A94E", inactive: "rgba(255,255,255,0.35)" };

  return (
    <div style={st.box}>
      <button type="button" style={st.btn} onClick={toggle}>{open ? `👑🐸 Ascunde ${BURSA_PUBLIC_NAME}` : `👑🐸 ${BURSA_PUBLIC_NAME} — înscrieri`}</button>
      {open && (
        <div style={st.body}>
          {busy && !info && <div style={st.hint}>Se încarcă…</div>}
          {msg && <div style={st.hint}>{msg}</div>}
          {info && (
            <>
              <div style={st.summary}>
                Au completat: <b>{info.counts.done}</b> · Încă nu: <b>{info.counts.missing}</b> · Dezactivați: <b>{info.counts.inactive}</b><br />
                Primul meci (blocare automată): <b>{fmtTime(info.lockAtMs)}</b> · Stare: <b>{info.resolved ? "rezolvat" : info.locked ? (info.closed ? "închis de Admin" : "blocat (a început primul meci)") : "deschis"}</b>
              </div>
              <div style={st.list}>
                {info.rows.map((r) => (
                  <div key={r.uid} style={st.row}>
                    <span style={st.who}><PlayerAvatar avatarId={r.avatarId} nickname={r.nickname} size={22} /> {r.nickname}</span>
                    <span style={{ color: tone[r.status], fontWeight: 700 }}>{label[r.status]}</span>
                  </div>
                ))}
              </div>
              <div style={st.actions}>
                {!info.resolved && !info.closed && !info.locked && <button type="button" style={st.act} disabled={busy} onClick={doClose}>Închide acum (dezvăluie)</button>}
                {!info.resolved && info.closed && !info.locked && <button type="button" style={st.act} disabled={busy} onClick={doReopen}>Redeschide (înainte de primul meci)</button>}
                {info.locked && !info.resolved && <span style={st.hint}>Blocat: redeschiderea e interzisă după începerea primului meci.</span>}
                <button type="button" style={st.link} disabled={busy} onClick={refresh}>↻ Actualizează</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const st = {
  box: { marginTop: 8 },
  btn: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, padding: "6px 10px", fontSize: 10.5, fontWeight: 700, color: "#fff", cursor: "pointer" },
  body: { marginTop: 8, display: "flex", flexDirection: "column", gap: 8 },
  hint: { fontSize: 11.5, color: color.textMuted, lineHeight: 1.5 },
  summary: { fontSize: 12, color: "#fff", lineHeight: 1.6 },
  list: { background: "rgba(255,255,255,0.04)", borderRadius: radius.sm, padding: "6px 10px", maxHeight: 280, overflowY: "auto", overscrollBehavior: "contain" },
  row: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, fontSize: 12, color: "#fff", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" },
  who: { display: "inline-flex", alignItems: "center", gap: 8 },
  actions: { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" },
  act: { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 6, padding: "7px 12px", fontSize: 11, fontWeight: 800, color: "#fff", cursor: "pointer" },
  link: { background: "none", border: "none", color: "#C9A227", fontSize: 11, fontWeight: 800, cursor: "pointer", padding: "6px 4px" },
};
