import { useState } from "react";
import { PICK_TYPES } from "../specialDefinitions";
import { saveSpecialPick } from "../services/specialsService";
import { color, font, radius } from "../matchdayTheme";

export default function SpecialPhasePicker({ phaseDef, phaseState, uid, ownPick, onSaved }) {
  const [selection, setSelection] = useState(() => {
    if (phaseDef.type === PICK_TYPES.SINGLE) return ownPick?.choice || null;
    return ownPick?.choices || [];
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const options = phaseState.options || [];
  const isRanked = phaseDef.type === PICK_TYPES.RANKED;
  const isGroup = phaseDef.type === PICK_TYPES.GROUP;
  const targetSize = isRanked ? phaseDef.rankedSize : isGroup ? phaseDef.groupSize : 1;

  function toggleMulti(optId) {
    setSelection((prev) => {
      const arr = Array.isArray(prev) ? prev : [];
      if (arr.includes(optId)) return arr.filter((id) => id !== optId);
      if (arr.length >= targetSize) return arr; // deja plin — trebuie scos unul întâi
      return [...arr, optId];
    });
  }

  async function handleSave() {
    const isComplete = phaseDef.type === PICK_TYPES.SINGLE ? Boolean(selection) : selection.length === targetSize;
    if (!isComplete || saving) return;
    setSaving(true);
    setError("");
    try {
      const payload = phaseDef.type === PICK_TYPES.SINGLE ? { choice: selection } : { choices: selection };
      await saveSpecialPick(phaseDef.id, uid, payload);
      onSaved?.();
    } catch (err) {
      console.error("Eroare la salvarea alegerii speciale:", err);
      setError(err.message || "Nu s-a putut salva.");
    } finally {
      setSaving(false);
    }
  }

  const isComplete = phaseDef.type === PICK_TYPES.SINGLE ? Boolean(selection) : selection.length === targetSize;

  return (
    <div style={s.wrap}>
      {(isRanked || isGroup) && (
        <div style={s.hint}>
          {isRanked
            ? `Alege și ordonează ${targetSize} echipe — apasă în ordinea în care crezi că vor termina. (${selection.length}/${targetSize})`
            : `Alege ${targetSize} echipe. (${selection.length}/${targetSize})`}
        </div>
      )}

      <div style={s.optionsList}>
        {options.map((opt) => {
          const isSingleSelected = phaseDef.type === PICK_TYPES.SINGLE && selection === opt.id;
          const rankIndex = Array.isArray(selection) ? selection.indexOf(opt.id) : -1;
          const isMultiSelected = rankIndex >= 0;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => (phaseDef.type === PICK_TYPES.SINGLE ? setSelection(opt.id) : toggleMulti(opt.id))}
              style={{
                ...s.optionBtn,
                ...(isSingleSelected || isMultiSelected ? s.optionBtnActive : {}),
              }}
            >
              <span>{opt.label}</span>
              {isRanked && isMultiSelected && <span style={s.rankBadge}>{rankIndex + 1}</span>}
              {isGroup && isMultiSelected && <span style={s.checkBadge}>✓</span>}
            </button>
          );
        })}
      </div>

      {error && <div style={s.error}>{error}</div>}

      <button type="button" onClick={handleSave} disabled={!isComplete || saving} style={{ ...s.saveBtn, opacity: !isComplete || saving ? 0.5 : 1 }}>
        {saving ? "Se salvează…" : ownPick ? "Actualizează alegerea" : "Salvează alegerea"}
      </button>
    </div>
  );
}

const s = {
  wrap: { display: "flex", flexDirection: "column", gap: 10 },
  hint: { fontSize: 11.5, color: color.textMuted, fontFamily: font.body, lineHeight: 1.4 },
  optionsList: { display: "flex", flexDirection: "column", gap: 6, maxHeight: 340, overflowY: "auto" },
  optionBtn: {
    display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
    background: color.surfaceInset, border: `1px solid ${color.border}`, borderRadius: radius.sm,
    padding: "11px 14px", fontSize: 13, fontWeight: 600, color: color.textPrimary, cursor: "pointer",
    fontFamily: font.body, textAlign: "left",
  },
  optionBtnActive: { border: `1.5px solid ${color.gold}`, background: "rgba(212,175,55,0.1)" },
  rankBadge: {
    width: 22, height: 22, borderRadius: "50%", background: color.gold, color: color.goldOn,
    fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  checkBadge: { color: color.gold, fontWeight: 800, fontSize: 15 },
  error: { fontSize: 11.5, color: "#F0555A", fontFamily: font.body },
  saveBtn: {
    background: color.goldGradient, border: "none", borderRadius: radius.sm, padding: "12px 0",
    fontSize: 13, fontWeight: 800, color: color.goldOn, cursor: "pointer", fontFamily: font.body,
  },
};
