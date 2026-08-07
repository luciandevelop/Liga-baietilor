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
  speciale: (c) => (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <path d="M12 3l2.6 5.9L21 9.6l-4.6 4.3L17.6 21 12 17.6 6.4 21l1.2-7.1L3 9.6l6.4-.7L12 3z" stroke={c} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  ),
  clasament: (c) => (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <path d="M7 4h10v5a5 5 0 01-10 0V4z" stroke={c} strokeWidth="1.6" />
      <path d="M7 6H4a3 3 0 003 3M17 6h3a3 3 0 01-3 3" stroke={c} strokeWidth="1.6" />
      <path d="M12 14v3M9 20h6M10 17h4" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  profil: (c) => (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="3.5" stroke={c} strokeWidth="1.6" />
      <path d="M5 20c1.5-4 4.5-6 7-6s5.5 2 7 6" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
};

const ITEMS = [
  { id: "home", label: "Home" },
  { id: "pronosticuri", label: "Pronosticuri" },
  { id: "speciale", label: "Speciale" },
  { id: "clasament", label: "Clasament" },
  { id: "profil", label: "Profil" },
];

export default function BottomTabBar({ active, onChange }) {
  return (
    <div style={s.bar}>
      {ITEMS.map((it) => {
        const isActive = active === it.id;
        const c = isActive ? color.gold : color.textFaint;
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
};
