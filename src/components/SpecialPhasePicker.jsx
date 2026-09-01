import { useState } from "react";
import { PICK_TYPES, GOLGHETER_ENRICHMENT } from "../specialDefinitions";
import { saveSpecialPick } from "../services/specialsService";
import ClubLogo from "./ClubLogo";
import { color, font, radius } from "../matchdayTheme";

export default function SpecialPhasePicker({ phaseDef, phaseState, uid, ownPick, onSaved }) {
  const showLogos = phaseDef.optionsSource === "teams" || phaseDef.id === "cl-golgheter";
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
          const isSelected = isSingleSelected || isMultiSelected;
          const isGolgheter = phaseDef.id === "cl-golgheter";
          const isAltul = opt.id === "altul" || opt.id === "alta";

          // ── Cardul de portret — DOAR pentru Golgheter, DOAR pentru
          // jucătorii reali (nu ALTUL). Restul fazelor (echipe) rămân
          // exact cum erau — nimic schimbat pentru ele. ──
          if (isGolgheter && !isAltul) {
            const enrichment = GOLGHETER_ENRICHMENT[opt.id] || null;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => (phaseDef.type === PICK_TYPES.SINGLE ? setSelection(opt.id) : toggleMulti(opt.id))}
                style={{ ...s.scorerCard, ...(isSelected ? s.scorerCardActive : {}) }}
              >
                <PlayerPortrait filename={enrichment?.filename} label={opt.label} />
                <span style={s.scorerInfo}>
                  <span style={s.scorerName}>{opt.label}</span>
                  {enrichment?.club && (
                    <span style={s.scorerClub}>
                      <ClubLogo teamName={enrichment.club} size={16} />
                      {enrichment.club}
                    </span>
                  )}
                </span>
                {isSelected && <span style={s.scorerCheck}>✓</span>}
              </button>
            );
          }

          if (isGolgheter && isAltul) {
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => (phaseDef.type === PICK_TYPES.SINGLE ? setSelection(opt.id) : toggleMulti(opt.id))}
                style={{ ...s.scorerCard, ...(isSelected ? s.scorerCardActive : {}) }}
              >
                <span style={s.scorerAltulIcon}>❓</span>
                <span style={s.scorerInfo}>
                  <span style={s.scorerName}>ALTUL</span>
                  <span style={s.scorerClubMuted}>Orice alt jucător</span>
                </span>
                {isSelected && <span style={s.scorerCheck}>✓</span>}
              </button>
            );
          }

          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => (phaseDef.type === PICK_TYPES.SINGLE ? setSelection(opt.id) : toggleMulti(opt.id))}
              style={{
                ...s.optionBtn,
                ...(isSelected ? s.optionBtnActive : {}),
              }}
            >
              <span style={s.optionContent}>
                {showLogos && !isAltul && (
                  <ClubLogo teamName={opt.club || opt.label} size={22} />
                )}
                <span style={s.optionText}>
                  {opt.label}
                  {opt.club && <span style={s.optionClub}> · {opt.club}</span>}
                </span>
              </span>
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

// ── Portret cu fallback — dacă imaginea lipsește (nu s-a urcat încă)
// SAU nu se încarcă (fișier corupt/lipsă), NU strică UI-ul: cade pe o
// siluetă generică, numele/clubul rămân vizibile la fel. ──
function PlayerPortrait({ filename, label }) {
  const [broken, setBroken] = useState(!filename);
  if (broken) {
    return (
      <span style={s.portraitFallback}>
        {(label || "?").trim().charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      src={`/assets/scorers/${filename}`}
      alt={label}
      style={s.portrait}
      onError={() => setBroken(true)}
    />
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
  optionContent: { display: "flex", alignItems: "center", gap: 10 },
  optionText: { display: "flex", flexDirection: "column" },
  optionClub: { fontSize: 10.5, fontWeight: 500, color: color.textFaint },
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
  // ── Golgheter — cardul de portret ──
  scorerCard: {
    display: "flex", alignItems: "center", gap: 12, width: "100%",
    background: color.surfaceInset, border: `1px solid ${color.border}`, borderRadius: radius.md,
    padding: "8px 12px", cursor: "pointer", textAlign: "left",
  },
  scorerCardActive: { border: `1.5px solid ${color.gold}`, background: "rgba(212,175,55,0.1)" },
  portrait: { width: 48, height: 48, borderRadius: "50%", objectFit: "cover", flexShrink: 0, background: color.surface },
  portraitFallback: {
    width: 48, height: 48, borderRadius: "50%", flexShrink: 0, background: color.surface,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 18, fontWeight: 800, color: color.textFaint, fontFamily: font.display,
  },
  scorerAltulIcon: {
    width: 48, height: 48, borderRadius: "50%", flexShrink: 0, background: color.surface,
    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
  },
  scorerInfo: { display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 0 },
  scorerName: { fontSize: 13.5, fontWeight: 700, color: color.textPrimary, fontFamily: font.body },
  scorerClub: { display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 500, color: color.textFaint, fontFamily: font.body },
  scorerClubMuted: { fontSize: 11, fontWeight: 500, color: color.textFaint, fontFamily: font.body },
  scorerCheck: { color: color.gold, fontWeight: 800, fontSize: 17, flexShrink: 0 },
};
