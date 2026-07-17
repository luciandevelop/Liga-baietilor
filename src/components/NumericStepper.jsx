// Componentă reutilizabilă [ − ] valoare [ + ], minim 0, gândită pentru
// input rapid pe mobil — fără tastare manuală ca metodă principală.
// value poate fi "" (gol) — tratat ca 0 pentru afișare, dar onChange
// primește mereu un număr valid (niciodată negativ).
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
          style={s.btn}
          disabled={disabled || num <= min}
          onClick={dec}
          aria-label="scade"
        >
          −
        </button>
        <span style={s.value}>{num}</span>
        <button type="button" style={s.btn} disabled={disabled} onClick={inc} aria-label="crește">
          +
        </button>
      </div>
    </div>
  );
}

const s = {
  wrap: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6 },
  label: { fontSize: 9.5, fontWeight: 700, letterSpacing: "0.04em", color: "#6B7390" },
  stepperRow: { display: "flex", alignItems: "center", gap: 8 },
  btn: {
    width: 32,
    height: 32,
    borderRadius: 9,
    border: "1px solid #2A3350",
    background: "#161D33",
    color: "#F5F5F0",
    fontSize: 16,
    fontWeight: 800,
    cursor: "pointer",
    lineHeight: 1,
    flexShrink: 0,
  },
  value: {
    minWidth: 26,
    textAlign: "center",
    fontSize: 17,
    fontWeight: 800,
    color: "#F5F5F0",
  },
};
