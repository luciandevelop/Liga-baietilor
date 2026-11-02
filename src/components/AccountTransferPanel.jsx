import { useState } from "react";
import { auth } from "../firebase";
import { color } from "../theme";

// ══════════════════════════════════════════════════════════════════
// 👤 Admin — transferul unui cont către jucătorul care îl înlocuiește.
// Același cont (puncte, număr, istoric), dar email + parolă noi.
// Parola merge direct în Firebase Authentication (serverul /api/account),
// NU se salvează în Firestore. Numele și avatarul se schimbă ca până acum.
// ══════════════════════════════════════════════════════════════════
const ERR = {
  email_in_use: "Emailul are deja un alt cont în aplicație.", email: "Email invalid.", password_short: "Parola: minimum 6 caractere.",
  password_required: "Pune o parolă: altfel, fără Google, contul ar rămâne fără logare.", not_found: "Contul nu există.",
  admin_only: "Doar Adminul.", auth: "Sesiune expirată — reîncarcă.", self: "Nu-ți poți transfera propriul cont.", server: "Eroare pe server.",
};

export default function AccountTransferPanel({ players = [] }) {
  const [uid, setUid] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [unlinkGoogle, setUnlinkGoogle] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const p = players.find((x) => x.uid === uid);

  async function run() {
    if (!p) return;
    if (!window.confirm(`Transferi contul „${p.nickname}” pe ${email}?\nPunctele, numărul și istoricul rămân. Vechiul jucător nu se mai poate loga.`)) return;
    setBusy(true); setMsg("");
    try {
      const token = await auth.currentUser.getIdToken();
      const r = await fetch("/api/account", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "transfer", uid, email, password, unlinkGoogle }) });
      const d = await r.json().catch(() => ({ ok: false, error: "server" }));
      if (d.ok) { setMsg(`✓ Gata. Logare: ${d.email}${d.passwordSet ? " + parola nouă" : ""} (metode: ${d.providers.join(", ") || "—"}).`); setPassword(""); }
      else setMsg(`❌ ${ERR[d.error] || d.error}`);
    } catch { setMsg("❌ Fără conexiune."); }
    setBusy(false);
  }

  return (
    <div>
      <p style={st.hint}>Pentru un jucător care îl înlocuiește pe altul. Fă transferul ÎNAINTE să-i dai datele noului jucător.</p>
      <select style={st.in} value={uid} onChange={(e) => { setUid(e.target.value); setMsg(""); }}>
        <option value="">Contul care se transferă…</option>
        {players.filter((x) => x.status === "active").map((x) => <option key={x.uid} value={x.uid}>{x.nickname} — {x.email || "fără email"}</option>)}
      </select>
      <input style={st.in} type="email" placeholder="Emailul noului jucător" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
      <input style={st.in} type="text" placeholder="Parola nouă (min. 6) — o dai tu jucătorului" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
      <label style={st.chk}><input type="checkbox" checked={unlinkGoogle} onChange={(e) => setUnlinkGoogle(e.target.checked)} /> Scoate logarea cu Google a vechiului jucător</label>
      <button type="button" style={st.gold} onClick={run} disabled={busy || !p || !email}>{busy ? "…" : "👤 Transferă contul"}</button>
      {msg && <p style={{ ...st.hint, color: msg.startsWith("✓") ? "#2FBF9A" : "#ff7b7b", marginTop: 8 }}>{msg}</p>}
    </div>
  );
}

const st = {
  hint: { fontSize: 11.5, color: color.textMuted, lineHeight: 1.5, margin: "0 0 8px" },
  in: { display: "block", width: "100%", boxSizing: "border-box", marginBottom: 8, background: color.surfaceInset, color: color.textPrimary, border: `1px solid ${color.border}`, borderRadius: 6, padding: "9px 10px", fontSize: 13 },
  chk: { display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: color.textSecondary, marginBottom: 8 },
  gold: { background: color.goldGradient, border: "none", borderRadius: 6, padding: "9px 14px", fontSize: 12.5, fontWeight: 800, color: color.goldOn, cursor: "pointer" },
};
