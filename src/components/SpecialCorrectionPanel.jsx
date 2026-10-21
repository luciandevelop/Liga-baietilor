import { useState } from "react";
import { PICK_TYPES } from "../specialDefinitions";
import { correctSpecialPhase, previewSpecialCorrection } from "../services/specialsService";
import { getUserNicknames } from "../services/adminService";
import SpecialResolvePicker from "./SpecialResolvePicker";
import { color, font, radius } from "../theme";

// Admin → Speciale → faza DEJA rezolvată: arată rezultatul oficial validat și permite corectarea lui.
// Fluxul: alegi rezultatul corect → „Verifică și corectează” → vezi EXACT ce se schimbă (jucători, puncte,
// total) într-o confirmare explicită → abia apoi se aplică, atomic. Etapa și Sezonul nu sunt afectate.
// Aceeași confirmare repetată nu modifică nimic (totalurile se ajustează doar cu diferența).
const sign = (n) => (n > 0 ? `+${n}` : `${n}`);

export default function SpecialCorrectionPanel({ phaseDef, phaseState, onChanged }) {
  const options = phaseState.options || [];
  const current = phaseState.correctAnswer;
  const [editing, setEditing] = useState(false);
  const [selection, setSelection] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const labelOf = (id) => options.find((o) => o.id === id)?.label || id;
  const describe = (answer) => {
    if (answer == null) return "—";
    if (!Array.isArray(answer)) return labelOf(answer);
    const names = answer.map(labelOf);
    return phaseDef.type === PICK_TYPES.RANKED ? names.map((n, i) => `${i + 1}. ${n}`).join(", ") : names.join(", ");
  };

  const targetSize = phaseDef.type === PICK_TYPES.RANKED ? phaseDef.rankedSize : phaseDef.groupSize;
  const isComplete = phaseDef.type === PICK_TYPES.SINGLE
    ? Boolean(selection)
    : Array.isArray(selection) && selection.length === targetSize;

  function startEditing() {
    setSelection(Array.isArray(current) ? [...current] : current);
    setMsg("");
    setEditing(true);
  }

  async function runCorrection() {
    if (!isComplete) { setMsg("Completează rezultatul corect înainte."); return; }
    setBusy(true);
    setMsg("");
    try {
      const preview = await previewSpecialCorrection(phaseDef.id, selection);
      if (preview.unchanged) {
        setMsg("Rezultatul ales e identic cu cel validat — nu e nimic de modificat.");
        return;
      }
      let names = {};
      try { names = await getUserNicknames(preview.rows.map((r) => r.uid)); } catch (_) { /* doar afișare */ }
      const lines = preview.rows
        .filter((r) => r.delta !== 0)
        .slice(0, 8)
        .map((r) => `• ${names[r.uid] || r.uid}: ${r.oldPoints} → ${r.newPoints} (${sign(r.delta)})`);
      const more = preview.changedUsers > lines.length ? `\n… și încă ${preview.changedUsers - lines.length}` : "";
      const ok = window.confirm(
        `Corectezi rezultatul oficial al fazei „${phaseDef.label}”?\n\n`
        + `Rezultat validat acum: ${describe(current)}\n`
        + `Rezultat corectat: ${describe(selection)}\n\n`
        + `${preview.changedUsers} ${preview.changedUsers === 1 ? "jucător afectat" : "jucători afectați"} · total ${sign(preview.totalDelta)} PCT în Clasamentul General.\n`
        + `${lines.join("\n")}${more}\n\n`
        + `Clasamentele Etapei și Sezonului NU se modifică. Operația e atomică; confirmată din nou, nu mai schimbă nimic.\n\nContinui?`
      );
      if (!ok) return;
      const res = await correctSpecialPhase(phaseDef.id, selection, current);
      setMsg(res.unchanged
        ? "Nimic de modificat."
        : `Corectat — ${res.changedUsers} ${res.changedUsers === 1 ? "jucător actualizat" : "jucători actualizați"} (total ${sign(res.totalDelta)} PCT în Clasamentul General).`);
      setEditing(false);
      setSelection(null);
      if (onChanged) onChanged();
    } catch (err) {
      console.error("Corectare Special:", err);
      setMsg("Eroare: " + (err.message || err.code));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <p style={s.hint}>Fază deja rezolvată — punctele au fost adăugate în Clasamentul General.</p>
      <p style={s.hint}><b>Rezultat oficial validat:</b> {describe(current)}</p>
      {!editing && (
        <button type="button" style={s.smallBtn} disabled={busy} onClick={startEditing}>✏️ Corectează rezultatul</button>
      )}
      {editing && (
        <>
          <p style={s.hint}>Alege rezultatul corect. Înainte de aplicare vei vedea exact ce se schimbă și vei confirma.</p>
          <SpecialResolvePicker phaseDef={phaseDef} options={options} selection={selection} onChange={setSelection} />
          <div style={s.btnRow}>
            <button type="button" style={s.btn} disabled={busy} onClick={runCorrection}>
              {busy ? "Se verifică…" : "Verifică și corectează"}
            </button>
            <button type="button" style={s.smallBtn} disabled={busy} onClick={() => { setEditing(false); setSelection(null); setMsg(""); }}>Anulează</button>
          </div>
        </>
      )}
      {msg && <p style={s.hint}>{msg}</p>}
    </>
  );
}

const s = {
  hint: { fontSize: 11.5, color: color.textMuted, lineHeight: 1.5, margin: "0 0 4px" },
  btn: {
    flex: 1, background: color.goldGradient, color: color.goldOn, border: "none",
    borderRadius: radius.sm, padding: "11px 0", fontSize: 13.5, fontWeight: 800, cursor: "pointer", fontFamily: font.body,
  },
  smallBtn: {
    flexShrink: 0, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6,
    padding: "6px 10px", fontSize: 10.5, fontWeight: 700, color: "#fff", cursor: "pointer",
  },
  btnRow: { display: "flex", gap: 8, alignItems: "center", marginTop: 10 },
};
