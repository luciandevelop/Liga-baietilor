import { PICK_TYPES } from "../specialDefinitions";
import { color, font, radius } from "../matchdayTheme";

function formatTimestamp(ts) {
  if (!ts?.toDate) return "—";
  const d = ts.toDate();
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function pickLabel(phaseDef, pick, options) {
  const optionLabel = (id) => options.find((o) => o.id === id)?.label || id;
  if (phaseDef.type === PICK_TYPES.SINGLE) return optionLabel(pick.choice);
  return (pick.choices || []).map(optionLabel).join(", ");
}

function formatCountdown(ms) {
  if (ms <= 0) return "S-a închis";
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  if (days > 0) return `${days}z ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}min`;
  return `${mins}min`;
}

export default function SpecialMonitoringPanel({ phaseDef, phaseState, allUsers, monitoring, now }) {
  const options = phaseState.options || [];
  const completedUids = new Set(monitoring.picks.map((p) => p.userId));
  const completed = monitoring.picks
    .map((p) => ({ ...p, user: allUsers.find((u) => u.uid === p.userId) }))
    .sort((a, b) => (a.submittedAt?.toMillis?.() ?? 0) - (b.submittedAt?.toMillis?.() ?? 0));
  const notCompleted = allUsers.filter((u) => !completedUids.has(u.uid));

  const dot = phaseState.status === "resolved" ? "✅" : phaseState.status === "closed" ? "🔴" : "🟢";
  let closesInLabel = null;
  if (phaseState.status === "open" && phaseState.closesAt) {
    const closesAtMs = phaseState.closesAt.toMillis ? phaseState.closesAt.toMillis() : phaseState.closesAt;
    closesInLabel = formatCountdown(closesAtMs - now);
  }

  return (
    <div style={s.wrap}>
      <div style={s.headRow}>
        <span>{dot} {phaseState.status.toUpperCase()}</span>
        {closesInLabel && <span style={s.closesIn}>Mai sunt: {closesInLabel}</span>}
      </div>

      {monitoring.loading ? (
        <p style={s.hint}>Se încarcă monitorizarea…</p>
      ) : (
        <>
          <div style={s.countRow}>
            <span style={s.countBig}>{completed.length} / {allUsers.length}</span>
            <span style={s.countLabel}>jucători au completat</span>
          </div>

          {completed.length > 0 && (
            <div style={s.section}>
              <div style={s.sectionLabel}>COMPLETAT</div>
              {completed.map((p) => (
                <div key={p.userId} style={s.row}>
                  <span style={s.rowName}>{p.user?.nickname || p.userId}</span>
                  <span style={s.rowPick}>{pickLabel(phaseDef, p, options)}</span>
                  <span style={s.rowTime}>{formatTimestamp(p.submittedAt)}</span>
                </div>
              ))}
            </div>
          )}

          {notCompleted.length > 0 && (
            <div style={s.section}>
              <div style={{ ...s.sectionLabel, color: "#F0A84E" }}>NU AU COMPLETAT ({notCompleted.length})</div>
              <div style={s.notCompletedList}>
                {notCompleted.map((u) => (
                  <span key={u.uid} style={s.notCompletedChip}>{u.nickname || u.uid}</span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const s = {
  wrap: {
    marginTop: 10, marginBottom: 4, padding: "12px 14px", background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)", borderRadius: radius.md,
  },
  headRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, fontSize: 11.5, fontWeight: 700, color: "#fff" },
  closesIn: { color: color.gold, fontSize: 11 },
  hint: { fontSize: 11, color: "#9099AC", fontFamily: font.body },

  countRow: { display: "flex", alignItems: "baseline", gap: 6, marginBottom: 12 },
  countBig: { fontSize: 18, fontWeight: 900, color: color.goldLight, fontFamily: font.display },
  countLabel: { fontSize: 11, color: "#9099AC" },

  section: { marginTop: 10 },
  sectionLabel: { fontSize: 9.5, fontWeight: 800, letterSpacing: "0.08em", color: "#67C58A", marginBottom: 6 },
  row: {
    display: "flex", alignItems: "center", gap: 8, padding: "6px 0",
    borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 11.5,
  },
  rowName: { fontWeight: 700, color: "#fff", flexShrink: 0, width: 84, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  rowPick: { flex: 1, color: "#C7CEDA", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  rowTime: { flexShrink: 0, color: "#6B7385", fontSize: 10 },

  notCompletedList: { display: "flex", flexWrap: "wrap", gap: 5 },
  notCompletedChip: {
    fontSize: 10.5, fontWeight: 600, color: "#F0A84E", background: "rgba(240,168,78,0.1)",
    border: "1px solid rgba(240,168,78,0.25)", borderRadius: 999, padding: "3px 9px",
  },
};
