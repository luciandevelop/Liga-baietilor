import { color, font, radius } from "../matchdayTheme";

// ── Panou de notificări — deschis din clopoțel. Fiecare item duce
// direct la ecranul relevant (predicții/surprize), nu doar informează.
// Fără nicio stare "citit/necitit" persistată — conținutul e mereu
// derivat live din ce chiar mai are userul de făcut, deci se
// actualizează singur, natural, fără mecanism separat de sincronizare. ──
export default function NotificationPanel({ items, loading, onClose, onOpenPredictions, onOpenSurprises }) {
  function handleItemClick(item) {
    if (item.kind === "unpredicted" || item.kind === "featured") onOpenPredictions?.();
    else if (item.kind === "surprise") onOpenSurprises?.();
    onClose?.();
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.panel} onClick={(e) => e.stopPropagation()}>
        <div style={s.header}>
          <span style={s.headerTitle}>🔔 Notificări</span>
          <button type="button" style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        {loading && <div style={s.emptyState}>Se încarcă…</div>}

        {!loading && items.length === 0 && (
          <div style={s.emptyState}>Ești la zi cu tot — nimic nou momentan.</div>
        )}

        {!loading && items.map((item) => (
          <button type="button" key={item.id} style={s.item} onClick={() => handleItemClick(item)}>
            <span style={s.itemIcon}>{iconFor(item.kind)}</span>
            <span style={s.itemBody}>
              <span style={s.itemTitle}>{item.title}</span>
              <span style={s.itemSubtitle}>{item.subtitle}</span>
            </span>
            <span style={s.itemArrow}>›</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function iconFor(kind) {
  if (kind === "unpredicted") return "⚽";
  if (kind === "surprise") return "🎭";
  if (kind === "featured") return "⭐";
  return "🔔";
}

const s = {
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", justifyContent: "flex-end" },
  panel: {
    width: "100%", maxWidth: 360, background: color.surface, borderLeft: `1px solid ${color.borderSubtle}`,
    padding: "16px 0", overflowY: "auto", animation: "slideIn 180ms ease-out",
  },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px 12px", borderBottom: `1px solid ${color.borderSubtle}` },
  headerTitle: { fontSize: 15, fontWeight: 800, color: color.textPrimary, fontFamily: font.display },
  closeBtn: { background: "none", border: "none", color: color.textFaint, fontSize: 18, cursor: "pointer", padding: 4 },
  emptyState: { padding: "40px 20px", textAlign: "center", fontSize: 12.5, color: color.textSecondary, fontFamily: font.body },
  item: {
    display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
    background: "none", border: "none", borderBottom: `1px solid ${color.borderSubtle}`,
    padding: "14px 16px", cursor: "pointer",
  },
  itemIcon: { fontSize: 20, flexShrink: 0 },
  itemBody: { flex: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 },
  itemTitle: { fontSize: 13, fontWeight: 700, color: color.textPrimary, fontFamily: font.body },
  itemSubtitle: { fontSize: 11, color: color.textSecondary, fontFamily: font.body },
  itemArrow: { fontSize: 18, color: color.textFaint, flexShrink: 0 },
};
