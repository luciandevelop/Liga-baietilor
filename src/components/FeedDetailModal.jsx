import FeedIcon from "./FeedIcon";
import { color, font, radius, shadow } from "../matchdayTheme";

export default function FeedDetailModal({ event, onClose }) {
  if (!event) return null;
  const isMatch = event.id.startsWith("match-final_");
  const isEditorial = event.id.startsWith("editorial_");
  const isFun = event.id.startsWith("fun_");
  const isRank = event.id.startsWith("rank_");
  const isJoker = event.id.startsWith("joker_");
  const isMotw = event.id.startsWith("motw_");
  const d = event.detail || {};

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.sheet} onClick={(e) => e.stopPropagation()}>
        <div style={s.head}>
          <span style={s.iconBig}><FeedIcon name={event.icon} size={20} /></span>
          <button type="button" onClick={onClose} style={s.closeBtn}>✕</button>
        </div>

        <div style={s.title}>{event.title}</div>
        {event.subtitle && <div style={s.subtitle}>{event.subtitle}</div>}

        {isRank && (
          <>
            {(d.pointsBefore != null || d.pointsAfter != null) && (
              <div style={s.factRow}>
                <span style={s.factLabel}>Puncte</span>
                <span style={s.factValue}>{d.pointsBefore ?? "—"} → {d.pointsAfter ?? "—"}</span>
              </div>
            )}
            {d.rankBefore != null && (
              <div style={s.factRow}>
                <span style={s.factLabel}>Poziție</span>
                <span style={s.factValue}>Locul {d.rankBefore} → Locul {d.rankAfter}</span>
              </div>
            )}
            {d.overtaken && d.overtaken.length > 0 && (
              <div style={s.factRow}>
                <span style={s.factLabel}>Jucători depășiți</span>
                <span style={s.factValue}>{d.overtaken.join(", ")}</span>
              </div>
            )}
            <div style={s.note}>Bazat pe Clasamentul General, actualizat la fiecare finalizare de etapă.</div>
          </>
        )}

        {(isMatch || isJoker || isMotw) && d.competitionName && (
          <div style={s.factRow}>
            <span style={s.factLabel}>Competiție</span>
            <span style={s.factValue}>{d.competitionName}</span>
          </div>
        )}
        {isMatch && d.status && (
          <div style={s.factRow}>
            <span style={s.factLabel}>Status</span>
            <span style={s.factValue}>Final</span>
          </div>
        )}
        {isJoker && (
          <>
            <div style={s.factRow}>
              <span style={s.factLabel}>Multiplicator</span>
              <span style={s.factValue}>{d.multiplier || "×2"}</span>
            </div>
            {d.matchStatus && (
              <div style={s.factRow}>
                <span style={s.factLabel}>Statusul meciului</span>
                <span style={s.factValue}>{d.matchStatus === "finished" ? "Terminat" : "Programat"}</span>
              </div>
            )}
          </>
        )}

        {isEditorial && event.article && (
          <>
            <div style={s.articleBody}>{event.article.body}</div>
            <div style={s.sourceRow}>Sursă: {event.article.source}</div>
          </>
        )}

        {isFun && (
          <div style={s.funBadge}>{event.subtitle}</div>
        )}

        <button type="button" onClick={onClose} style={s.doneBtn}>Închide</button>
      </div>
    </div>
  );
}

const s = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100,
    display: "flex", alignItems: "flex-end",
  },
  sheet: {
    width: "100%", maxWidth: 480, margin: "0 auto", background: color.surfaceElevated,
    borderRadius: "18px 18px 0 0", padding: "18px 18px 24px", boxShadow: shadow.elevated,
    maxHeight: "80vh", overflowY: "auto",
  },
  head: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  iconBig: {
    width: 40, height: 40, borderRadius: "50%", background: "rgba(212,175,55,0.15)",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  closeBtn: {
    width: 30, height: 30, borderRadius: "50%", background: color.surfaceInset, border: `1px solid ${color.border}`,
    color: color.textPrimary, fontSize: 13, cursor: "pointer",
  },
  title: { fontSize: 17, fontWeight: 800, color: color.textPrimary, fontFamily: font.display, marginBottom: 4, lineHeight: 1.3 },
  subtitle: { fontSize: 13, color: color.textSecondary, fontFamily: font.body, marginBottom: 12 },
  note: { fontSize: 11, color: color.textFaint, fontFamily: font.body, marginBottom: 12 },
  factRow: {
    display: "flex", justifyContent: "space-between", padding: "9px 0", borderTop: `1px solid ${color.borderSubtle}`,
  },
  factLabel: { fontSize: 11.5, color: color.textFaint, fontFamily: font.body },
  factValue: { fontSize: 12.5, color: color.textPrimary, fontWeight: 600, fontFamily: font.body },
  articleBody: { fontSize: 13, color: color.textSecondary, fontFamily: font.body, lineHeight: 1.55, marginBottom: 10 },
  sourceRow: { fontSize: 10.5, color: color.textFaint, fontFamily: font.body, fontStyle: "italic", marginBottom: 8 },
  funBadge: {
    fontSize: 11, fontWeight: 800, color: color.gold, background: "rgba(212,175,55,0.1)",
    border: `1px solid ${color.goldBorder}`, borderRadius: radius.pill, padding: "4px 10px",
    display: "inline-block", marginBottom: 8,
  },
  doneBtn: {
    width: "100%", marginTop: 12, background: color.goldGradient, border: "none", borderRadius: radius.sm,
    padding: "11px 0", fontSize: 13, fontWeight: 800, color: color.goldOn, cursor: "pointer", fontFamily: font.body,
  },
};
