// Ecranul de încărcare ASCUNSELEA (ușor: nu încarcă scena; stilurile vin inline ca să apară imediat).
const wrap = { position: "fixed", inset: 0, zIndex: 9998, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, background: "radial-gradient(60% 40% at 50% 45%, rgba(255,61,139,.25), #07060f 70%)", color: "#f4f1ff", font: '700 13px/1.4 "Chakra Petch", system-ui, sans-serif', letterSpacing: ".24em" };
const sym = (c, d) => ({ display: "inline-block", fontSize: 40, color: c, textShadow: `0 0 18px ${c}`, animation: `hsLoad 1s ease-in-out ${d}s infinite` });
export default function HsLoading({ text = "SE DESCHIDE LABIRINTUL…" }) {
  return (
    <div style={wrap} role="status" aria-live="polite">
      <style>{"@keyframes hsLoad{0%,100%{transform:translateY(0);opacity:.5}50%{transform:translateY(-12px);opacity:1}}"}</style>
      <div style={{ display: "flex", gap: 18 }}><span style={sym("#ff3d8b", 0)}>○</span><span style={sym("#1fe3c2", .15)}>△</span><span style={sym("#ffd23f", .3)}>□</span></div>
      <div>{text}</div>
    </div>
  );
}
