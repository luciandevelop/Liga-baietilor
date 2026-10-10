import { useEffect, useRef, useState } from "react";
import { listSeasons, listGameweeks, getGameweekRegistry } from "../services/adminService";
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
// Etapele FINALIZATE ale unui sezon, cea mai recentă prima.
function completedSorted(gws) {
  return (gws || []).filter((g) => g.status === "completed").sort((a, b) => Number(b.number) - Number(a.number));
}
function seasonCreatedMs(sn) {
  return sn?.createdAt?.toMillis ? sn.createdAt.toMillis() : 0;
}

// Istoricul rămâne consultabil pentru TOATE sezoanele: selector de sezon (când sunt
// 2 sau mai multe) + etapele finalizate ale sezonului ales. Implicit se deschide mereu
// sezonul ACTIV (cel curent al aplicației), cu ultima lui etapă finalizată — fără să cauți
// tu sezonul curent printre cele vechi. Dacă sezonul activ nu are încă nicio etapă finalizată,
// apare mesajul aferent, iar sezoanele anterioare sunt la o apăsare distanță. Etapele fiecărui
// sezon se citesc o singură dată (la alegere) și rămân în memorie cât timp ecranul e montat.
// Fără listener, fără polling.
export default function SurpriseRegistryScreen({ seasonId, onBack }) {
  const [seasons, setSeasons] = useState(null); // null = se încarcă
  const [selectedSeasonId, setSelectedSeasonId] = useState(null);
  const [completedBySeason, setCompletedBySeason] = useState({}); // { [seasonId]: etape finalizate }
  const [seasonLoading, setSeasonLoading] = useState(false);
  const [selectedGwId, setSelectedGwId] = useState(null);
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const seasonReqRef = useRef(0);

  // 1) La intrare: sezoanele + etapele DOAR ale sezonului activ (primit din Clasament).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let list = [];
        try { list = await listSeasons(); } catch (err) { console.error("Registru: eroare la listarea sezoanelor:", err); }
        if (list.length === 0 && seasonId) list = [{ id: seasonId }]; // rezervă: comportamentul vechi
        const ordered = list.slice().sort((a, b) => seasonCreatedMs(b) - seasonCreatedMs(a));
        if (cancelled) return;
        setSeasons(ordered);
        if (ordered.length === 0) return;

        // Sezonul activ e preselectat chiar dacă nu are încă etape finalizate. Dacă nu a fost
        // primit sau nu e în listă, se ia cel mai recent creat.
        const startId = ordered.some((sn) => sn.id === seasonId) ? seasonId : ordered[0].id;
        const completed = completedSorted(await listGameweeks(startId));
        if (cancelled) return;
        setCompletedBySeason({ [startId]: completed });
        setSelectedSeasonId(startId);
        setSelectedGwId(completed[0]?.id || null);
      } catch (err) {
        console.error("Registru: eroare la încărcarea etapelor:", err);
        if (!cancelled) { setSeasons((prev) => prev || []); setLoadError("Nu s-au putut încărca etapele. Încearcă din nou."); }
      }
    })();
    return () => { cancelled = true; };
  }, [seasonId]);

  // 2) Schimbarea sezonului: din memorie dacă a fost deja încărcat, altfel o singură citire.
  async function handleSelectSeason(id) {
    if (id === selectedSeasonId) return;
    const req = ++seasonReqRef.current;
    setSeasonLoading(false);
    setLoadError("");
    setRows(null);
    setSelectedSeasonId(id);
    let completed = completedBySeason[id];
    if (!completed) {
      setSelectedGwId(null);
      setSeasonLoading(true);
      try {
        completed = completedSorted(await listGameweeks(id));
      } catch (err) {
        console.error("Registru: eroare la încărcarea etapelor sezonului:", err);
        if (req === seasonReqRef.current) { setSeasonLoading(false); setLoadError("Nu s-au putut încărca etapele sezonului."); }
        return;
      }
      if (req !== seasonReqRef.current) return; // între timp s-a ales alt sezon
      setCompletedBySeason((prev) => ({ ...prev, [id]: completed }));
      setSeasonLoading(false);
    }
    setSelectedGwId(completed[0]?.id || null);
  }

  // 3) Punctajele etapei alese: o singură interogare; răspunsurile întârziate sunt ignorate.
  useEffect(() => {
    if (!selectedGwId) { setRows(null); setLoading(false); return undefined; }
    let cancelled = false;
    setLoading(true);
    setRows(null);
    getGameweekRegistry(selectedGwId)
      .then((r) => { if (!cancelled) { setRows(r); setLoading(false); } })
      .catch((err) => {
        console.error("Registru: eroare la încărcarea punctajelor:", err);
        if (!cancelled) { setLoading(false); setLoadError("Nu s-au putut încărca punctajele etapei."); }
      });
    return () => { cancelled = true; };
  }, [selectedGwId]);

  const gameweeks = completedBySeason[selectedSeasonId] || [];
  const selectedGw = gameweeks.find((g) => g.id === selectedGwId);
  const mainLabel = rows?.[0] ? getSurpriseTypeLabel(rows[0].mainSurpriseType, "main", selectedGwId) : null;
  const bonusLabel = rows?.[0] ? getSurpriseTypeLabel(rows[0].bonusSurpriseType, "bonus", selectedGwId) : null;

  return (
    <div style={s.page}>
      <PageHeader title="📖 Registru public" onBack={onBack} />
      <div style={s.wrap}>
        <p style={s.intro}>Punctajele fiecărei etape, defalcate pe sursă — verificabile de oricine.</p>

        {seasons && seasons.length >= 2 && (
          <>
            <div style={s.pickerLabel}>Sezon</div>
            <div style={s.gwPicker}>
              {seasons.map((sn) => (
                <button
                  key={sn.id} type="button"
                  style={{ ...s.gwBtn, ...(sn.id === selectedSeasonId ? s.gwBtnActive : {}) }}
                  onClick={() => handleSelectSeason(sn.id)}
                >
                  {sn.name || "Sezon"}
                </button>
              ))}
            </div>
          </>
        )}

        {gameweeks.length > 0 && seasons && seasons.length >= 2 && <div style={s.pickerLabel}>Etapă</div>}
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

        {(seasons === null || seasonLoading) && <div style={s.loadingNote}>Se încarcă…</div>}
        {loadError && <div style={s.emptyNote}>{loadError}</div>}
        {seasons && seasons.length === 0 && !loadError && <div style={s.emptyNote}>Nu există încă niciun sezon.</div>}
        {seasons && seasons.length > 0 && selectedSeasonId && !seasonLoading && !loadError && gameweeks.length === 0 && (
          <div style={s.emptyNote}>Nicio etapă finalizată încă în acest sezon.</div>
        )}

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
  pickerLabel: { fontSize: 10.5, fontWeight: 800, letterSpacing: "0.04em", color: color.textFaint, marginBottom: 6, fontFamily: font.body, textTransform: "uppercase" },
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
