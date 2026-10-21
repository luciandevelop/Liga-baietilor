import { useEffect, useState } from "react";
import { getPlayerSpecialsBreakdown } from "../services/specialsService";
import { color, font } from "../theme";

// EVENIMENTE SPECIALE pe SPATELE cardului jucătorului (Clasament → General).
//
// Spatele cardului are înălțime FIXĂ (aspect-ratio) și overflow: hidden, iar conținutul lui existent
// umple deja cardul. De aceea nu adăugăm nimic în fluxul normal:
//   • RESTRÂNS: un singur rând compact — același loc și aceeași înălțime ca rândul „Puncte speciale” pe care
//     îl înlocuiește (totalul special rămâne vizibil permanent, fără rezumat duplicat) — cu butonul
//     „VEZI TOATE EVENIMENTELE ▼”;
//   • EXTINS: un panou INTERN, poziționat absolut în interiorul cardului (nu iese din el, nu mărește cardul),
//     cu înălțime controlată și scroll propriu. Stă sub butonul de închidere (z-index mai mic) și nu îl acoperă.
// Toate atingerile din rând/panou opresc propagarea, ca să nu întoarcă cardul din greșeală.
//
// Datele se încarcă o singură dată, la deschiderea fișei (aceleași citiri ca înainte); extinderea/restrângerea
// nu citește nimic. Totalurile vin din ACELEAȘI date ca Clasamentul General (stats.generalPoints =
// seasonPoints + specialPoints, stats.specialPoints = users.specialPoints) — nu se recalculează aici.
// Starea evenimentului: +X PCT · 0 PCT · Fără pronostic · În așteptare · Pronosticuri deschise.
const fmt = (n) => Number(n || 0).toLocaleString("ro-RO");
const stop = (e) => e.stopPropagation();

// Fără diacritice / majuscule, ca să recunoaștem „Champions League” și în „Câștigătoare Champions League”.
const plain = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const showCompetition = (row) => !plain(row.label).includes(plain(row.competition));

function stateText(row) {
  switch (row.state) {
    case "won": return { text: `+${fmt(row.points)} PCT`, tone: "win" };
    case "zero": return { text: "0 PCT", tone: "plain" };
    case "nopick": return { text: "Fără pronostic", tone: "muted" };
    case "open": return { text: "Pronosticuri deschise", tone: "muted" };
    default: return { text: "În așteptare", tone: "muted" };
  }
}

export default function PlayerSpecialsBreakdown({ uid, stats, accent, flipped, onFlipBack }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(false);
    getPlayerSpecialsBreakdown(uid)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((err) => { console.error("Eroare la detaliile Specialelor:", err); if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [uid]);

  // Cardul s-a întors pe față → la următoarea întoarcere pe spate secțiunea e din nou restrânsă.
  useEffect(() => { if (flipped === false) setOpen(false); }, [flipped]);

  const specialTotal = stats?.specialPoints || 0;
  const generalTotal = stats?.generalPoints || 0;
  const seasonsTotal = generalTotal - specialTotal; // = users.seasonPoints (puncte din sezoane)
  const accentColor = accent || color.gold;

  return (
    <>
      <button type="button" style={s.row} onClick={(e) => { stop(e); setOpen((v) => !v); }} aria-expanded={open}>
        <span style={s.rowLeft}>
          <span style={s.rowTitle}>🏆 EVENIMENTE SPECIALE</span>
          <span style={{ ...s.rowToggle, color: accentColor }}>{open ? "RESTRÂNGE ▲" : "VEZI TOATE EVENIMENTELE ▼"}</span>
        </span>
        <span style={{ ...s.rowTotal, color: accentColor }}>+{fmt(specialTotal)} PCT</span>
      </button>

      {open && (
        <div style={s.sheet} onClick={stop} role="dialog" aria-label="Evenimente speciale">
          <div style={s.sheetHead}>
            <span style={s.sheetTitle}>🏆 EVENIMENTE SPECIALE</span>
            <span style={{ ...s.sheetTotal, color: accentColor }}>+{fmt(specialTotal)} PCT</span>
          </div>
          <div style={s.sheetActions}>
            <button type="button" style={s.pill} onClick={(e) => { stop(e); setOpen(false); }}>▲ RESTRÂNGE</button>
            {onFlipBack && <button type="button" style={s.pill} onClick={(e) => { stop(e); onFlipBack(); }}>↩ FAȚA CARDULUI</button>}
          </div>

          <div style={s.list}>
            {!data && !error && <div style={s.note}>Se încarcă evenimentele speciale…</div>}
            {error && <div style={s.note}>Nu s-au putut încărca evenimentele speciale.</div>}
            {data && data.rows.length === 0 && <div style={s.note}>Niciun eveniment special deschis încă.</div>}
            {data && data.rows.map((r) => {
              const st = stateText(r);
              return (
                <div key={r.phaseId} style={s.item}>
                  <span style={s.itemLabel}>
                    {r.label}
                    {showCompetition(r) && <span style={s.itemSub}> · {r.competition}</span>}
                  </span>
                  <span style={{ ...s.itemState, ...(st.tone === "win" ? { color: accentColor } : null), ...(st.tone === "muted" ? s.itemStateMuted : null) }}>{st.text}</span>
                </div>
              );
            })}
          </div>

          <div style={s.sheetFoot}>
            <span>Din sezoane <b style={s.footVal}>{fmt(seasonsTotal)} PCT</b></span>
            <span>TOTAL GENERAL <b style={s.footVal}>{fmt(generalTotal)} PCT</b></span>
            {data && data.sumPoints !== specialTotal && (
              <span style={s.footNote}>Suma evenimentelor ({fmt(data.sumPoints)} PCT) diferă de total — Admin poate apăsa „Recalculează puncte Speciale".</span>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const s = {
  // Rândul compact: aceeași „cutie” ca StatRow-ul din PlayerCard (separator jos, înălțime ~34px) — două linii
  // mici în stânga (titlu + buton), totalul în dreapta.
  row: {
    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, width: "100%",
    padding: "5px 4px", borderTop: "none", borderLeft: "none", borderRight: "none",
    borderBottom: "1px solid rgba(255,255,255,0.08)", background: "transparent", cursor: "pointer", textAlign: "left", minHeight: 34,
    fontFamily: font.body,
  },
  rowLeft: { display: "flex", flexDirection: "column", gap: 1, minWidth: 0, overflow: "hidden" },
  rowTitle: { fontSize: 10, fontWeight: 800, letterSpacing: "0.07em", color: "rgba(255,255,255,0.85)", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  rowToggle: { fontSize: 8.5, fontWeight: 800, letterSpacing: "0.05em", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  rowTotal: { fontSize: 14, fontWeight: 800, fontFamily: font.display, flexShrink: 0, whiteSpace: "nowrap" },

  // Panoul extins: în interiorul feței cardului (cardInner e position: absolute), sub butonul de închidere
  // (z-index 20 în PlayerCard), cu înălțime controlată și scroll intern.
  sheet: {
    position: "absolute", left: 8, right: 8, top: 58, bottom: 8, zIndex: 15,
    display: "flex", flexDirection: "column", overflow: "hidden",
    background: "#090C16", border: "1px solid rgba(255,255,255,0.13)", borderRadius: 12,
    boxShadow: "0 8px 26px rgba(0,0,0,0.55)", cursor: "default", textAlign: "left",
  },
  sheetHead: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "10px 12px 6px", flexShrink: 0 },
  sheetTitle: { fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", color: "#fff", fontFamily: font.display },
  sheetTotal: { fontSize: 14, fontWeight: 800, fontFamily: font.display },
  sheetActions: { display: "flex", gap: 6, padding: "0 12px 8px", flexShrink: 0 },
  pill: {
    background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.16)", borderRadius: 999, color: "#fff",
    fontSize: 9, fontWeight: 800, letterSpacing: "0.05em", padding: "6px 10px", cursor: "pointer", fontFamily: font.body,
  },
  list: {
    flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", touchAction: "pan-y",
    WebkitOverflowScrolling: "touch", borderTop: "1px solid rgba(255,255,255,0.08)",
  },
  item: {
    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
    padding: "9px 12px", borderBottom: "1px solid rgba(255,255,255,0.07)",
  },
  itemLabel: { fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,0.88)", lineHeight: 1.3, minWidth: 0 },
  itemSub: { fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.38)" },
  itemState: { fontSize: 12, fontWeight: 800, color: "#fff", fontFamily: font.display, textAlign: "right", flexShrink: 0, maxWidth: "42%" },
  itemStateMuted: { fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,0.5)", fontFamily: font.body },
  note: { fontSize: 10.5, color: "rgba(255,255,255,0.45)", padding: "12px", lineHeight: 1.45 },
  sheetFoot: {
    display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "2px 10px", flexShrink: 0,
    padding: "8px 12px", borderTop: "1px solid rgba(255,255,255,0.1)", fontSize: 9.5, color: "rgba(255,255,255,0.55)", fontWeight: 600,
  },
  footVal: { color: "#fff", fontFamily: font.display, fontWeight: 800 },
  footNote: { width: "100%", fontSize: 9, color: "rgba(255,255,255,0.4)", lineHeight: 1.4 },
};
