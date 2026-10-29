import { useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { color } from "../theme";
import { PICK_TYPES, SPECIAL_COMPETITIONS } from "../specialDefinitions";
import { listSpecialPhases, SPECIALS_EDITION_ID } from "../services/specialsService";

// ══════════════════════════════════════════════════════════════════
// ⭐ Admin — TOATE pronosticurile speciale ale unui jucător, pe o singură
// pagină, grupate pe competiții. DOAR CITIRE (Adminul are deja voie să
// citească specialPicks). Util la înlocuirea unui jucător.
// ══════════════════════════════════════════════════════════════════
export default function PlayerSpecialsPanel({ players = [] }) {
  const active = players.filter((p) => p.status === "active");
  const [uid, setUid] = useState("");
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);

  async function load(u) {
    setUid(u); setRows(null); setErr(""); if (!u) return;
    setBusy(true);
    try {
      const [phases, picksSnap] = await Promise.all([
        listSpecialPhases(SPECIALS_EDITION_ID),
        getDocs(query(collection(db, "specialPicks"), where("userId", "==", u))),
      ]);
      const phaseById = Object.fromEntries(phases.map((p) => [p.phaseId || p.id, p]));
      const pickByPhase = Object.fromEntries(picksSnap.docs.map((d) => [d.data().phaseId, d.data()]));
      const out = [];
      SPECIAL_COMPETITIONS.forEach((comp) => {
        const items = [];
        comp.phases.forEach((ph) => {
          const phase = phaseById[ph.id];
          if (!phase) return; // faze încă nedeschise
          const def = ph; // definiția fazei (tipul: o alegere / clasament / grup)
          const options = phase.options || [];
          const lbl = (id) => options.find((o) => o.id === id)?.label || id;
          const pick = pickByPhase[ph.id];
          let answer = "— (nu a pronosticat)";
          if (pick) {
            if (def.type === PICK_TYPES.SINGLE) answer = lbl(pick.choice);
            else if (def.type === PICK_TYPES.RANKED) answer = (pick.choices || []).map((c, i) => `${i + 1}. ${lbl(c)}`).join("  ");
            else answer = (pick.choices || []).map(lbl).join(", ");
          }
          const state = phase.status === "open" ? "deschis" : phase.status === "resolved" ? "validat" : "închis";
          items.push({ label: ph.label, answer, state, has: !!pick });
        });
        if (items.length) out.push({ name: comp.name, items });
      });
      setRows(out);
    } catch (e) { setErr(e.message || String(e)); }
    setBusy(false);
  }

  const name = players.find((p) => p.uid === uid)?.nickname || "";
  const text = rows ? [`⭐ Specialele lui ${name}`, ...rows.flatMap((c) => [``, `🏆 ${c.name}`, ...c.items.map((i) => `• ${i.label}: ${i.answer}`)])].join("\n") : "";

  return (
    <div>
      <p style={st.hint}>Alege jucătorul și vezi toate pronosticurile lui speciale, una sub alta. Doar citire.</p>
      <select style={st.select} value={uid} onChange={(e) => load(e.target.value)}>
        <option value="">Alege jucătorul…</option>
        {active.map((p) => <option key={p.uid} value={p.uid}>{p.nickname || p.uid}</option>)}
      </select>
      {busy && <p style={st.hint}>Se încarcă…</p>}
      {err && <p style={{ ...st.hint, color: "#ff6b6b" }}>Eroare: {err}</p>}
      {rows && (
        <div style={{ marginTop: 10 }}>
          {rows.length === 0 && <p style={st.hint}>Nicio fază deschisă încă.</p>}
          {rows.map((c) => (
            <div key={c.name} style={st.comp}>
              <div style={st.compName}>🏆 {c.name}</div>
              {c.items.map((i) => (
                <div key={i.label} style={st.item}>
                  <span style={st.label}>{i.label} <small style={st.state}>({i.state})</small></span>
                  <span style={{ ...st.answer, color: i.has ? color.textPrimary : color.textMuted }}>{i.answer}</span>
                </div>
              ))}
            </div>
          ))}
          <button type="button" style={st.btn} onClick={() => { try { navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* fără clipboard */ } }}>
            {copied ? "Copiat ✓" : "📋 Copiază lista (pentru WhatsApp)"}
          </button>
        </div>
      )}
    </div>
  );
}

const st = {
  hint: { fontSize: 11.5, color: color.textMuted, margin: "0 0 8px" },
  select: { width: "100%", background: color.surfaceInset, color: color.textPrimary, border: `1px solid ${color.border}`, borderRadius: 6, padding: "8px", fontSize: 13 },
  comp: { border: `1px solid ${color.border}`, borderRadius: 8, padding: "6px 8px", marginBottom: 8 },
  compName: { fontSize: 13, fontWeight: 800, color: color.goldLight, marginBottom: 4 },
  item: { display: "flex", flexDirection: "column", padding: "4px 0", borderTop: `1px solid ${color.border}` },
  label: { fontSize: 11.5, color: color.textSecondary },
  state: { color: color.textMuted },
  answer: { fontSize: 13, fontWeight: 700 },
  btn: { marginTop: 4, background: color.goldGradient, border: "none", borderRadius: 6, padding: "8px 12px", fontSize: 12, fontWeight: 800, color: color.goldOn, cursor: "pointer" },
};
