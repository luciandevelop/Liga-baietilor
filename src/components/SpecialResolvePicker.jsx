import { PICK_TYPES } from "../specialDefinitions";
import ClubLogo from "./ClubLogo";
import { color, font, radius } from "../matchdayTheme";

export default function SpecialResolvePicker({ phaseDef, options, selection, onChange }) {
  const showLogos = phaseDef.optionsSource === "teams" || phaseDef.id === "cl-golgheter";
  const isRanked = phaseDef.type === PICK_TYPES.RANKED;
  const isGroup = phaseDef.type === PICK_TYPES.GROUP;
  const targetSize = isRanked ? phaseDef.rankedSize : isGroup ? phaseDef.groupSize : 1;

  function toggleMulti(optId) {
    const arr = Array.isArray(selection) ? selection : [];
    if (arr.includes(optId)) { onChange(arr.filter((id) => id !== optId)); return; }
    if (arr.length >= targetSize) return;
    onChange([...arr, optId]);
  }

  return (
    <div style={s.wrap}>
      {(isRanked || isGroup) && (
        <div style={s.hint}>
          {isRanked ? `Ordinea reală de clasare — ${(Array.isArray(selection) ? selection.length : 0)}/${targetSize}` : `Echipele reale — ${(Array.isArray(selection) ? selection.length : 0)}/${targetSize}`}
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
              onClick={() => (phaseDef.type === PICK_TYPES.SINGLE ? onChange(opt.id) : toggleMulti(opt.id))}
              style={{ ...s.optionBtn, ...(isSingleSelected || isMultiSelected ? s.optionBtnActive : {}) }}
            >
              <span style={s.optionContent}>
                {showLogos && opt.id !== "alta" && opt.id !== "altul" && (
                  <ClubLogo teamName={opt.club || opt.label} size={20} />
                )}
                {opt.label}
              </span>
              {isRanked && isMultiSelected && <span style={s.rankBadge}>{rankIndex + 1}</span>}
              {isGroup && isMultiSelected && <span style={s.checkBadge}>✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const s = {
  wrap: { display: "flex", flexDirection: "column", gap: 8, marginTop: 8 },
  hint: { fontSize: 11, color: color.textSecondary, fontFamily: font.body },
  optionsList: { display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto" },
  optionBtn: {
    display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
    background: color.surfaceInset, border: `1px solid ${color.border}`, borderRadius: radius.sm,
    padding: "10px 12px", fontSize: 12.5, fontWeight: 600, color: color.textPrimary, cursor: "pointer",
    fontFamily: font.body, textAlign: "left",
  },
  optionBtnActive: { border: `1.5px solid ${color.gold}`, background: "rgba(212,175,55,0.1)" },
  optionContent: { display: "flex", alignItems: "center", gap: 8 },
  rankBadge: {
    width: 20, height: 20, borderRadius: "50%", background: color.gold, color: color.goldOn,
    fontSize: 10.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  checkBadge: { color: color.gold, fontWeight: 800, fontSize: 14 },
};
