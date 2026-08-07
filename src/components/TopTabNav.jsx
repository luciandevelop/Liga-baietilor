import { color, font } from "../matchdayTheme";

const ICONS = {
  matchday: (c) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke={c} strokeWidth="1.6" />
      <path d="M12 7l3 2.2-1.1 3.6H10.1L9 9.2 12 7z" stroke={c} strokeWidth="1.3" />
    </svg>
  ),
  clasament: (c) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M7 4h10v5a5 5 0 01-10 0V4z" stroke={c} strokeWidth="1.6" />
      <path d="M7 6H4a3 3 0 003 3M17 6h3a3 3 0 01-3 3" stroke={c} strokeWidth="1.6" />
      <path d="M12 14v3M9 20h6M10 17h4" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  profil: (c) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="3.5" stroke={c} strokeWidth="1.6" />
      <path d="M5 20c1.5-4 4.5-6 7-6s5.5 2 7 6" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
};

const TABS = [
  { id: "matchday", label: "Matchday" },
  { id: "clasament", label: "Clasament" },
  { id: "profil", label: "Profil" },
];

export default function TopTabNav({ active, onChange }) {
  return (
    <div style={s.row}>
      {TABS.map((t) => {
        const isActive = active === t.id;
        const c = isActive ? color.gold : color.textFaint;
        return (
          <button key={t.id} type="button" onClick={() => onChange?.(t.id)} style={s.tab}>
            {ICONS[t.id](c)}
            <span style={{ ...s.label, color: isActive ? color.textPrimary : color.textFaint }}>{t.label}</span>
            <span style={{ ...s.underline, opacity: isActive ? 1 : 0 }} />
          </button>
        );
      })}
    </div>
  );
}

const s = {
  row: {
    display: "flex",
    background: color.headerBg,
    borderBottom: `1px solid ${color.borderSubtle}`,
    overflowX: "auto",
  },
  tab: {
    position: "relative",
    flex: "1 0 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    background: "none",
    border: "none",
    padding: "13px 14px",
    cursor: "pointer",
  },
  label: { fontSize: 10.5, fontWeight: 700, letterSpacing: "0.04em", fontFamily: font.body, whiteSpace: "nowrap" },
  underline: { position: "absolute", left: "20%", right: "20%", bottom: 0, height: 2, background: color.gold, borderRadius: "2px 2px 0 0" },
};
