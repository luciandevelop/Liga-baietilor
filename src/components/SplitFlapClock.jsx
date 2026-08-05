import { color, font, shadow } from "../matchdayTheme";

function FlapUnit({ value, label }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div
        style={{
          position: "relative", width: 45, height: 53, borderRadius: 9, overflow: "hidden",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: font.display, fontWeight: 700, fontSize: 25, color: color.textPrimary,
          background: "linear-gradient(180deg,#22262F,#15171D 48%,#101218)",
          boxShadow: `${shadow.card}, ${shadow.rim}`,
        }}
      >
        {value}
        <span
          aria-hidden="true"
          style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 1, background: "rgba(0,0,0,0.65)" }}
        />
      </div>
      <span style={{ fontSize: 8, color: "rgba(255,255,255,0.35)", letterSpacing: "0.12em", fontFamily: font.body, fontWeight: 700 }}>{label}</span>
    </div>
  );
}

// Countdown mecanic ("split-flap") — ORE : MIN. `remainingMs` vine din
// părinte (calculat cu useNow), componenta doar afișează — nu are timer
// intern, ca să nu existe două surse de adevăr pentru timp.
export default function SplitFlapClock({ remainingMs }) {
  const clamped = Math.max(0, remainingMs);
  const totalMin = Math.floor(clamped / 60000);
  const h = String(Math.floor(totalMin / 60)).padStart(2, "0");
  const m = String(totalMin % 60).padStart(2, "0");

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 5 }}>
      <FlapUnit value={h} label="ORE" />
      <span style={{ fontFamily: font.display, fontSize: 18, color: "rgba(255,255,255,0.22)", paddingBottom: 19 }}>:</span>
      <FlapUnit value={m} label="MIN" />
    </div>
  );
}
