// Componentă reutilizabilă [ − ] valoare [ + ], minim 0, gândită pentru
// input rapid pe mobil — fără tastare manuală ca metodă principală.
// value poate fi "" (gol) — tratat ca 0 pentru afișare, dar onChange
// primește mereu un număr valid (niciodată negativ).
import { color, font } from "../theme";

export default function NumericStepper({ value, onChange, disabled, min = 0, label }) {
  const num = value === "" || value === undefined || value === null ? min : Number(value);

  function dec() {
    onChange(Math.max(min, num - 1));
  }
  function inc() {
    onChange(num + 1);
  }

  return (
    <div style={s.wrap}>
      {label && <span style={s.label}>{label}</span>}
      <div style={s.stepperRow}>
        <button
          type="button"
          style={{ ...s.btn, ...(disabled || num <= min ? s.btnDisabled : {}) }}
          disabled={disabled || num <= min}
          onClick={dec}
          aria-label="scade"
        >
          −
        </button>
        <span style={s.value}>{num}</span>
        <button
          type="button"
          style={{ ...s.btn, ...(disabled ? s.btnDisabled : {}) }}
          disabled={disabled}
          onClick={inc}
          aria-label="crește"
        >
          +
        </button>
      </div>
    </div>
  );
}

const s = {
  wrap: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6 },
  label: { fontSize: 9.5, fontWeight: 700, letterSpacing: "0.04em", color: color.textMuted, fontFamily: font.body },
  stepperRow: { display: "flex", alignItems: "center", gap: 8 },
  btn: {
    width: 36,
    height: 36,
    borderRadius: 9,
    border: `1px solid ${color.border}`,
    background: color.surfaceInset,
    color: color.textPrimary,
    fontSize: 16,
    fontWeight: 800,
    cursor: "pointer",
    lineHeight: 1,
    flexShrink: 0,
    fontFamily: font.body,
  },
  btnDisabled: { opacity: 0.4, cursor: "default" },
  value: {
    minWidth: 26,
    textAlign: "center",
    fontSize: 18,
    fontWeight: 700,
    color: color.textPrimary,
    fontFamily: font.display,
  },
};
