import { useState } from "react";
import { color, font, radius } from "../matchdayTheme";

// ══════════════════════════════════════════════════════════════════
// AGREGAT — cine a completat SPECIALELE, peste toate fazele
// DISPONIBILE (nu blocate). "Disponibilă" = Admin a deschis-o deja
// (există document specialPhases pentru acel phaseId) — o fază încă
// nedeschisă (requiresPhase neîndeplinit) NU intră în numărătoare,
// exact cerut: nu transformă pe nimeni în "incomplet" pentru ceva ce
// încă nu poate fi completat.
//
// Numărul total NU e hardcodat — vine din câte faze au fost deschise
// efectiv (phases.length), deci funcționează indiferent câte Speciale
// se adaugă ulterior.
// ══════════════════════════════════════════════════════════════════
export default function SpecialsCompletionOverview({ availablePhases, allUsers, picksByPhase, loading }) {
  const [expandedUid, setExpandedUid] = useState(null);

  if (loading) return <p style={s.hint}>Se încarcă…</p>;
  if (availablePhases.length === 0) return <p style={s.hint}>Nicio fază Specială deschisă încă.</p>;

  const total = availablePhases.length;
  const rows = allUsers.map((u) => {
    const completedIds = availablePhases.filter((p) => (picksByPhase[p.id] || []).some((pick) => pick.userId === u.uid)).map((p) => p.id);
    const missing = availablePhases.filter((p) => !completedIds.includes(p.id));
    const status = completedIds.length === total ? "complete" : completedIds.length === 0 ? "none" : "partial";
    return { uid: u.uid, nickname: u.nickname || u.uid, completedCount: completedIds.length, missing, status };
  }).sort((a, b) => {
    const order = { none: 0, partial: 1, complete: 2 };
    return order[a.status] - order[b.status] || a.completedCount - b.completedCount;
  });

  const completeCount = rows.filter((r) => r.status === "complete").length;
  const partialCount = rows.filter((r) => r.status === "partial").length;
  const noneCount = rows.filter((r) => r.status === "none").length;

  return (
    <div style={s.wrap}>
      <div style={s.summaryRow}>
        <span style={{ ...s.summaryChip, color: "#67C58A" }}>✅ {completeCount} complete</span>
        <span style={{ ...s.summaryChip, color: "#F0A84E" }}>⚠️ {partialCount} parțial</span>
        <span style={{ ...s.summaryChip, color: "#E0616B" }}>❌ {noneCount} fără Speciale</span>
      </div>
      <p style={s.hint}>{total} {total === 1 ? "fază disponibilă" : "faze disponibile"} momentan (fazele blocate nu contează).</p>

      <div style={s.list}>
        {rows.map((r) => (
          <div key={r.uid} style={s.userRow}>
            <button type="button" style={s.userRowBtn} onClick={() => setExpandedUid(expandedUid === r.uid ? null : r.uid)}>
              <span style={s.statusIcon}>{r.status === "complete" ? "✅" : r.status === "partial" ? "⚠️" : "❌"}</span>
              <span style={s.userName}>{r.nickname}</span>
              <span style={s.userProgress}>{r.completedCount}/{total}</span>
              <span style={s.chevron}>{expandedUid === r.uid ? "▲" : "▼"}</span>
            </button>
            {expandedUid === r.uid && r.missing.length > 0 && (
              <div style={s.missingBox}>
                <div style={s.missingLabel}>Lipsesc:</div>
                {r.missing.map((p) => <div key={p.id} style={s.missingItem}>— {p.label}</div>)}
              </div>
            )}
            {expandedUid === r.uid && r.missing.length === 0 && (
              <div style={s.missingBox}><div style={{ ...s.missingItem, color: "#67C58A" }}>Toate completate ✅</div></div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const s = {
  wrap: { marginTop: 10 },
  hint: { fontSize: 11, color: "#9099AC", fontFamily: font.body, marginBottom: 8 },
  summaryRow: { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 6 },
  summaryChip: { fontSize: 12, fontWeight: 800, fontFamily: font.display },
  list: { display: "flex", flexDirection: "column", gap: 6, marginTop: 8 },
  userRow: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: radius.md, overflow: "hidden" },
  userRowBtn: {
    display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 12px",
    background: "none", border: "none", cursor: "pointer", textAlign: "left",
  },
  statusIcon: { fontSize: 14, flexShrink: 0 },
  userName: { flex: 1, fontSize: 12.5, fontWeight: 700, color: "#fff", fontFamily: font.body, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  userProgress: { fontSize: 12, fontWeight: 800, color: color.goldLight, fontFamily: font.display, flexShrink: 0 },
  chevron: { fontSize: 10, color: "#6B7385", flexShrink: 0 },
  missingBox: { padding: "0 12px 10px 34px", display: "flex", flexDirection: "column", gap: 3 },
  missingItem: { fontSize: 11, color: "#E0616B", fontFamily: font.body },
  missingLabel: { fontSize: 10, fontWeight: 700, color: "#9099AC", marginBottom: 2 },
};
