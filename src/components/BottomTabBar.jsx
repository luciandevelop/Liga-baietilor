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
  meciuri: (c) => (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="7" width="18" height="12" rx="2" stroke={c} strokeWidth="1.6" />
      <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" stroke={c} strokeWidth="1.6" />
    </svg>
  ),
  jucatori: (c) => (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="8" r="3" stroke={c} strokeWidth="1.6" />
      <circle cx="17" cy="9" r="2.4" stroke={c} strokeWidth="1.6" />
      <path d="M3 20c1-3.5 3.5-5.5 6-5.5s5 2 6 5.5M15.5 20c.6-2.4 1.9-3.9 3.5-4.7" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  meniu: (c) => (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <path d="M4 7h16M4 12h16M4 17h16" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
};

const ITEMS = [
  { id: "home", label: "Home" },
  { id: "pronosticuri", label: "Pronosticuri" },
  { id: "meciuri", label: "Meciuri" },
  { id: "jucatori", label: "Jucători" },
  { id: "meniu", label: "Meniu" },
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
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    display: "flex",
    background: color.headerBg,
    borderTop: `1px solid ${color.borderSubtle}`,
    boxShadow: shadow.elevated,
    paddingBottom: "env(safe-area-inset-bottom, 0px)",
    zIndex: 40,
  },
  item: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    background: "none",
    border: "none",
    padding: "10px 4px 8px",
    cursor: "pointer",
  },
  label: { fontSize: 9.5, fontWeight: 700, fontFamily: font.body, letterSpacing: "0.01em" },
};
