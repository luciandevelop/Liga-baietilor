import { useEffect, useState } from "react";
import { getPlayerSpecialsBreakdown } from "../services/specialsService";
import { color, font } from "../theme";

// Secțiune din FIȘA jucătorului (componenta PlayerCard existentă), afișată DOAR când fișa e deschisă din
// Clasament → General. Detaliile se încarcă o singură dată, la deschiderea fișei (fără listener, fără polling,
// nimic la randări sau la revenirea pe Home).
//
// Totalurile vin din ACELEAȘI date ca Clasamentul General (stats.generalPoints = seasonPoints + specialPoints,
// stats.specialPoints = users.specialPoints) — nu se recalculează aici, deci coincid mereu cu clasamentul.
// Lista pe evenimente vine din specialScores; dacă suma lor diferă de totalul jucătorului (ex. scoruri
// șterse manual), se afișează discret o notă — nimic nu se „ghicește”.
//
// Stări afișate:  +X PCT (validat, cu puncte) · 0 PCT (validat, fără puncte) · Fără pronostic (validat, dar
// jucătorul n-a pronosticat) · În așteptare (pronosticuri blocate sau încă nevalidat) · Pronosticuri deschise.
// Evenimentele pe care Admin nu le-a deschis încă nu apar (nu există nimic de arătat pentru ele).
const fmt = (n) => Number(n || 0).toLocaleString("ro-RO");

function stateText(row) {
  switch (row.state) {
    case "won": return { text: `+${fmt(row.points)} PCT`, tone: "win" };
    case "zero": return { text: "0 PCT", tone: "plain" };
    case "nopick": return { text: "Fără pronostic", tone: "muted" };
    case "open": return { text: "Pronosticuri deschise", tone: "muted" };
    default: return { text: "În așteptare", tone: "muted" };
  }
}

export default function PlayerSpecialsBreakdown({ uid, stats, accent }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(false);
    getPlayerSpecialsBreakdown(uid)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((err) => { console.error("Eroare la detaliile Specialelor:", err); if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [uid]);

  const specialTotal = stats?.specialPoints || 0;
  const generalTotal = stats?.generalPoints || 0;
  const seasonsTotal = generalTotal - specialTotal; // = users.seasonPoints (puncte din sezoane)
  const accentColor = accent || color.gold;

  return (
    <div style={s.wrap}>
      <div style={s.title}>EVENIMENTE SPECIALE</div>
      <div style={s.row}>
        <span style={s.label}>Puncte din sezoane</span>
        <span style={s.val}>{fmt(seasonsTotal)} PCT</span>
      </div>

      {!data && !error && <div style={s.note}>Se încarcă evenimentele speciale…</div>}
      {error && <div style={s.note}>Nu s-au putut încărca evenimentele speciale.</div>}

      {data && data.rows.length === 0 && <div style={s.note}>Niciun eveniment special deschis încă.</div>}
      {data && data.rows.map((r) => {
        const st = stateText(r);
        return (
          <div key={r.phaseId} style={s.row}>
            <span style={s.label}>
              {r.label}
              <span style={s.sub}>{r.competition}</span>
            </span>
            <span style={{ ...s.val, ...(st.tone === "win" ? { color: accentColor } : null), ...(st.tone === "muted" ? s.valMuted : null) }}>{st.text}</span>
          </div>
        );
      })}

      <div style={{ ...s.row, ...s.totalRow }}>
        <span style={s.totalLabel}>TOTAL SPECIALE</span>
        <span style={{ ...s.val, color: accentColor }}>+{fmt(specialTotal)} PCT</span>
      </div>
      <div style={{ ...s.row, ...s.totalRow, borderBottom: "none" }}>
        <span style={s.totalLabel}>TOTAL GENERAL</span>
        <span style={s.val}>{fmt(generalTotal)} PCT</span>
      </div>
      {data && data.sumPoints !== specialTotal && (
        <div style={s.note}>Suma evenimentelor ({fmt(data.sumPoints)} PCT) diferă de total — Admin poate apăsa „Recalculează puncte Speciale".</div>
      )}
    </div>
  );
}

const s = {
  wrap: { padding: "14px 16px 4px" },
  title: { fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", color: color.textPrimary, marginBottom: 6, fontFamily: font.display },
  row: {
    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
    padding: "7px 4px", borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
  label: { fontSize: 11.5, color: "rgba(255,255,255,0.65)", fontWeight: 600, display: "flex", flexDirection: "column", minWidth: 0 },
  sub: { fontSize: 9.5, color: "rgba(255,255,255,0.35)", fontWeight: 600, marginTop: 1 },
  val: { fontSize: 13, fontWeight: 800, color: color.textPrimary, fontFamily: font.display, textAlign: "right", flexShrink: 0 },
  valMuted: { fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,0.5)" },
  totalRow: { padding: "9px 4px" },
  totalLabel: { fontSize: 11.5, fontWeight: 800, color: "#fff", fontFamily: font.display, letterSpacing: "0.03em" },
  note: { fontSize: 10.5, color: "rgba(255,255,255,0.45)", padding: "8px 4px", lineHeight: 1.45 },
};
