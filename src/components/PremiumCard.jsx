import { color, font, radius, shadow, blur } from "../matchdayTheme";

const TONES = {
  gold: { text: color.goldLight, glow: "rgba(212,175,55,0.28)", border: color.goldBorder },
  purple: { text: "#C4B5FD", glow: "rgba(139,92,246,0.30)", border: color.purpleBorder },
  green: { text: "#C3F09A", glow: "rgba(139,217,87,0.30)", border: color.greenBorder },
  blue: { text: "#A9C6FA", glow: "rgba(59,124,240,0.30)", border: color.blueBorder },
};

// Cardul-tip pentru dale de tip "Clasament / Dueluri / Zaruri / Team of
// the Week" — fiecare mod are propria culoare (glow difuz în colț +
// titlu colorat), fundal întunecat comun. `visual` e un slot opțional
// pentru conținut vizual central (siglă, avatar, iconiță custom).
//
// `locked` + `lockCondition` (+ opțional `lockContext`, ex. "1/3")
// activează starea de mod blocat — un panou de sticlă cu lacăt și
// condiția de deblocare, NU doar "În curând". Cardul de dedesubt rămâne
// vizibil (blur), ca într-un joc — vezi ce ratezi.
export default function PremiumCard({ tone = "gold", title, subtitle, visual, locked, lockCondition, lockContext, onClick, style }) {
  const t = TONES[tone] || TONES.gold;

  return (
    <button
      type="button"
      onClick={locked ? undefined : onClick}
      style={{ ...s.card, borderColor: t.border, cursor: locked ? "default" : "pointer", ...style }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: -30,
          right: -30,
          width: 120,
          height: 120,
          borderRadius: "50%",
          background: t.glow,
          filter: `blur(${blur.glow})`,
          pointerEvents: "none",
        }}
      />
      {visual && <div style={s.visual}>{visual}</div>}
      <div style={{ ...s.textBlock, filter: locked ? "blur(1.5px)" : "none" }}>
        <div style={{ ...s.title, color: t.text }}>{title}</div>
        {subtitle && <div style={s.subtitle}>{subtitle}</div>}
      </div>

      {locked && (
        <div style={s.lockPane}>
          <div style={s.lockSheen} />
          <div style={s.lockBadge}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ color: color.goldLight }}>
              <rect x="5" y="11" width="14" height="9" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
              <path d="M8 11V8a4 4 0 018 0v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <circle cx="12" cy="15.5" r="1.2" fill="currentColor" />
            </svg>
          </div>
          <div style={s.lockCond}>{lockCondition}</div>
          {lockContext && <div style={s.lockCtx}>{lockContext}</div>}
        </div>
      )}
    </button>
  );
}

const s = {
  card: {
    position: "relative",
    overflow: "hidden",
    background: color.surface,
    border: "1px solid",
    borderRadius: radius.lg,
    padding: "16px 14px",
    textAlign: "left",
    cursor: "pointer",
    boxShadow: shadow.card,
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
    minHeight: 108,
  },
  visual: { position: "relative", zIndex: 1, marginBottom: 10 },
  textBlock: { position: "relative", zIndex: 1 },
  title: { fontFamily: font.display, fontWeight: 700, fontSize: 14, letterSpacing: "0.02em", textTransform: "uppercase" },
  subtitle: { fontSize: 10.5, color: color.textFaint, marginTop: 3, fontFamily: font.body },

  lockPane: {
    position: "absolute", inset: 0, zIndex: 4, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center", gap: 8,
    background: "linear-gradient(155deg, rgba(10,11,15,0.35), rgba(10,11,15,0.62))",
    backdropFilter: "blur(2px)",
  },
  lockSheen: {
    position: "absolute", inset: 0,
    background: "linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.05) 48%, transparent 62%)",
  },
  lockBadge: {
    position: "relative", width: 38, height: 38, borderRadius: "50%", display: "flex",
    alignItems: "center", justifyContent: "center",
    background: "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.14), rgba(10,11,15,0.7))",
    border: "1px solid rgba(212,175,55,0.4)",
    boxShadow: `0 6px 16px rgba(0,0,0,0.5), 0 0 18px rgba(212,175,55,0.18), ${shadow.rim}`,
  },
  lockCond: { position: "relative", fontSize: 10.5, fontWeight: 700, color: "#fff", textAlign: "center", padding: "0 14px" },
  lockCtx: { position: "relative", fontSize: 8.5, color: "rgba(255,255,255,0.45)", letterSpacing: "0.06em", textTransform: "uppercase" },
};
