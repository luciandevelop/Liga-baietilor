import { useEffect, useState } from "react";
import { listGameweeks, getGameweekRegistry } from "../services/adminService";
import { getSurpriseTypeLabel } from "../services/surpriseLabels";
import PageHeader from "../components/PageHeader";
import { color, font, radius } from "../theme";

// ══════════════════════════════════════════════════════════════════
// 📖 REGISTRU PUBLIC — ETAPĂ → SURSA PUNCTELOR → JUCĂTORI → PUNCTE.
//
// Economic la Firestore, cerut explicit: încarcă doar LISTA de etape
// la deschidere (un query ieftin, deja folosit și în altă parte). Nu
// aduce NICIUN scor până userul alege explicit o etapă — abia atunci
// o SINGURĂ interogare (gameweekScores where gameweekId==X) aduce
// toți jucătorii acelei etape simultan. Schimbarea etapei re-fetch-uie
// din nou o singură dată; nicio subscripție permanentă, niciun query
// per jucător.
// ══════════════════════════════════════════════════════════════════
export default function SurpriseRegistryScreen({ seasonId, onBack }) {
  const [gameweeks, setGameweeks] = useState([]);
  const [selectedGwId, setSelectedGwId] = useState(null);
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!seasonId) return;
    listGameweeks(seasonId).then((gws) => {
      const completed = gws.filter((g) => g.status === "completed").sort((a, b) => Number(b.number) - Number(a.number));
      setGameweeks(completed);
      if (completed.length > 0) setSelectedGwId(completed[0].id);
    });
  }, [seasonId]);

  useEffect(() => {
    if (!selectedGwId) return;
    setLoading(true);
    setRows(null);
    getGameweekRegistry(selectedGwId).then((r) => { setRows(r); setLoading(false); });
  }, [selectedGwId]);

  const selectedGw = gameweeks.find((g) => g.id === selectedGwId);
  const mainLabel = rows?.[0] ? getSurpriseTypeLabel(rows[0].mainSurpriseType, "main", selectedGwId) : null;
  const bonusLabel = rows?.[0] ? getSurpriseTypeLabel(rows[0].bonusSurpriseType, "bonus", selectedGwId) : null;

  return (
    <div style={s.page}>
      <PageHeader title="📖 Registru public" onBack={onBack} />
      <div style={s.wrap}>
        <p style={s.intro}>Punctajele fiecărei etape, defalcate pe sursă — verificabile de oricine.</p>

        <div style={s.gwPicker}>
          {gameweeks.map((g) => (
            <button
              key={g.id} type="button"
              style={{ ...s.gwBtn, ...(g.id === selectedGwId ? s.gwBtnActive : {}) }}
              onClick={() => setSelectedGwId(g.id)}
            >
              Etapa {g.number}
            </button>
          ))}
        </div>

        {loading && <div style={s.loadingNote}>Se încarcă…</div>}

        {!loading && rows && rows.length > 0 && (
          <>
            <RegistrySection icon="⚽" title="Pronosticuri + Lupul Singuratic" rows={rows} pick={(r) => {
              const loneWolf = Object.values(r.breakdown || {}).reduce((s, m) => s + (m.loneWolfBonus || 0), 0);
              const pure = (r.pointsFromMatches || 0) - loneWolf;
              return loneWolf > 0 ? `+${pure}p (+${loneWolf}p 🐺)` : `+${pure}p`;
            }} />
            <RegistrySection icon="🔥" title={mainLabel ? `Surpriză Mare — ${mainLabel}` : "Surpriză Mare"} rows={rows} valueKey="mainSurprisePoints" />
            <RegistrySection icon="🎮" title={bonusLabel ? `Surpriză Mică — ${bonusLabel}` : "Surpriză Mică"} rows={rows} valueKey="bonusSurprisePoints" />
            {rows.some((r) => (r.jokerExtraBonus || 0) !== 0) && (
              <RegistrySection icon="🃏" title="Joker Extra (aplicat la finalul etapei)" rows={rows.filter((r) => (r.jokerExtraBonus || 0) !== 0)} valueKey="jokerExtraBonus" />
            )}
            <RegistrySection icon="🏆" title="Bonus / penalizare clasament" rows={rows.filter((r) => (r.rankingBonus || 0) !== 0)} valueKey="rankingBonus" signed />
          </>
        )}

        {!loading && rows && rows.length === 0 && (
          <div style={s.emptyNote}>Nicio dată persistată pentru {selectedGw ? `Etapa ${selectedGw.number}` : "această etapă"}.</div>
        )}
      </div>
    </div>
  );
}

function RegistrySection({ icon, title, rows, valueKey, pick, signed }) {
  const visible = valueKey ? rows.filter((r) => r[valueKey] != null) : rows;
  if (visible.length === 0) return null;
  return (
    <div style={s.section}>
      <div style={s.sectionTitle}>{icon} {title.toUpperCase()}</div>
      {visible
        .slice()
        .sort((a, b) => (valueKey ? (b[valueKey] || 0) - (a[valueKey] || 0) : 0))
        .map((r) => {
          const val = pick ? pick(r) : `${r[valueKey] >= 0 && signed ? "+" : r[valueKey] >= 0 ? "+" : ""}${r[valueKey]}p`;
          const isNegative = valueKey && (r[valueKey] || 0) < 0;
          return (
            <div key={r.userId} style={s.row}>
              <span style={s.rowName}>{r.nickname}</span>
              <span style={{ ...s.rowVal, ...(isNegative ? s.rowValNeg : {}) }}>{val}</span>
            </div>
          );
        })}
    </div>
  );
}

const s = {
  page: { minHeight: "100dvh", background: color.bgBase },
  wrap: { maxWidth: 480, margin: "0 auto", padding: "0 16px 24px" },
  intro: { fontSize: 12, color: color.textSecondary, fontFamily: font.body, marginBottom: 12, lineHeight: 1.4 },
  gwPicker: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 },
  gwBtn: {
    padding: "6px 12px", borderRadius: radius.pill, border: `1px solid ${color.border}`, background: "rgba(255,255,255,0.04)",
    color: color.textSecondary, fontSize: 11.5, fontWeight: 700, fontFamily: font.body, cursor: "pointer",
  },
  gwBtnActive: { background: color.goldGradient || color.gold, color: "#12141C", border: "none" },
  loadingNote: { textAlign: "center", fontSize: 12, color: color.textFaint, padding: "20px 0", fontFamily: font.body },
  emptyNote: { textAlign: "center", fontSize: 12, color: color.textFaint, padding: "20px 0", fontFamily: font.body },
  section: {
    background: "rgba(255,255,255,0.03)", border: `1px solid ${color.borderSubtle || color.border}`,
    borderRadius: radius.md, padding: "10px 12px", marginBottom: 10,
  },
  sectionTitle: { fontSize: 10.5, fontWeight: 800, letterSpacing: "0.04em", color: color.textFaint, marginBottom: 6, fontFamily: font.body },
  row: { display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12.5, fontFamily: font.body },
  rowName: { color: color.textPrimary, fontWeight: 600 },
  rowVal: { color: color.textPrimary, fontWeight: 800 },
  rowValNeg: { color: "#F0555A" },
};
