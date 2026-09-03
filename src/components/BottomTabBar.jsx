import { color, font, shadow } from "../matchdayTheme";

const ICONS = {
  home: (c) => (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <path d="M4 11l8-7 8 7v8a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1v-8z" stroke={c} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  ),
  pronosticuri: (c) => (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="5" width="16" height="16" rx="2" stroke={c} strokeWidth="1.6" />
      <path d="M4 10h16M9 3v4M15 3v4" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  clasament: (c) => (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <path d="M7 4h10v5a5 5 0 01-10 0V4z" stroke={c} strokeWidth="1.6" />
      <path d="M7 6H4a3 3 0 003 3M17 6h3a3 3 0 01-3 3" stroke={c} strokeWidth="1.6" />
      <path d="M12 14v3M9 20h6M10 17h4" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  speciale: (c) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M12 2l2.6 5.9 6.4.6-4.8 4.3 1.4 6.2L12 15.9 6.4 19l1.4-6.2-4.8-4.3 6.4-.6L12 2z" stroke={c} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  ),
  surpriza: (c) => (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="9" width="16" height="11" rx="1.5" stroke={c} strokeWidth="1.6" />
      <path d="M4 13h16" stroke={c} strokeWidth="1.6" />
      <path d="M12 9v11" stroke={c} strokeWidth="1.6" />
      <path d="M12 9c-1.2-3-3-4-4.2-3.2C6.4 6.6 7 9 12 9zM12 9c1.2-3 3-4 4.2-3.2C17.6 6.6 17 9 12 9z" stroke={c} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  ),
};

const ITEMS = [
  { id: "home", label: "Home" },
  { id: "pronosticuri", label: "Pronosticuri" },
  { id: "clasament", label: "Clasament" },
  { id: "speciale", label: "Speciale" },
  { id: "surpriza", label: "Surpriza" },
];

export default function BottomTabBar({ active, onChange }) {
  return (
    <div style={s.bar}>
      {ITEMS.map((it) => {
        const isActive = active === it.id;
        const c = isActive ? color.gold : color.textFaint;
        const isSpeciale = it.id === "speciale";

        // Tratament special DOAR pe tab-ul Speciale — restul taburilor
        // rămân exact ca înainte, nicio schimbare de layout/dimensiune.
        if (isSpeciale) {
          return (
            <button key={it.id} type="button" onClick={() => onChange?.(it.id)} style={s.item}>
              <span style={s.specialeIconWrap}>
                <span style={{ ...s.specialeGlow, opacity: isActive ? 0.9 : 0.45 }} />
                <span style={{ position: "relative", filter: isActive ? "drop-shadow(0 0 4px rgba(212,175,55,0.7))" : "none" }}>
                  {ICONS.speciale(c)}
                </span>
              </span>
              <span style={{ ...s.label, color: c, ...(isActive ? s.specialeLabelActive : {}) }}>{it.label}</span>
            </button>
          );
        }

        return (
          <button key={it.id} type="button" onClick={() => onChange?.(it.id)} style={s.item}>
            {ICONS[it.id](c)}
            <span style={{ ...s.label, color: c }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

const s = {
  bar: {
    position: "fixed", left: 0, right: 0, bottom: 0, display: "flex",
    background: color.headerBg, borderTop: `1px solid ${color.borderSubtle}`,
    boxShadow: shadow.elevated, paddingBottom: "env(safe-area-inset-bottom, 0px)", zIndex: 40,
  },
  item: {
    flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
    background: "none", border: "none", padding: "10px 4px 8px", cursor: "pointer",
  },
  label: { fontSize: 9.5, fontWeight: 700, fontFamily: font.body, letterSpacing: "0.01em" },

  // ── Doar pentru tab-ul Speciale ──
  specialeIconWrap: { position: "relative", display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 22 },
  specialeGlow: {
    position: "absolute", width: 30, height: 30, borderRadius: "50%",
    background: "radial-gradient(circle, rgba(212,175,55,0.55) 0%, transparent 70%)",
    pointerEvents: "none",
  },
  specialeLabelActive: { fontWeight: 800, textShadow: "0 0 6px rgba(212,175,55,0.5)" },
};
