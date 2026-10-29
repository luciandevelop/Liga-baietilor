import { useState } from "react";
import { color } from "../theme";
import { listGameweeks, listGameweekScoresForStats, listSeasonLeaderboard } from "../services/adminService";

// ══════════════════════════════════════════════════════════════════
// 🔍 Admin — verificarea clasamentului. DOAR CITIRE, nu modifică nimic.
//   1. Fiecare rând de etapă: total = meciuri + bonus poziție + Joker Extra
//      + Surpriza Mare + Surpriza Mică.
//   2. Totalul de sezon al fiecărui jucător = suma etapelor finalizate.
//   3. Clasamentul general (punctele din profil) = suma TUTUROR etapelor
//      finalizate din toate sezoanele.
// Plus, pe jucător, detaliul pe etape: locul pe etapă e calculat din punctele
// din MECIURI, iar sezonul adună TOTALUL (cu surprizele) — de aici pot apărea
// diferențe aparente între locurile pe etape și locul în sezon.
// ══════════════════════════════════════════════════════════════════
export default function SeasonCheckPanel({ players = [], seasons = [] }) {
  const [seasonId, setSeasonId] = useState(seasons[0]?.id || "");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState("");

  const nick = (uid) => players.find((p) => p.uid === uid)?.nickname || uid.slice(0, 6);

  async function run() {
    setBusy(true); setErr(""); setRes(null);
    try {
      const sid = seasonId || seasons[0]?.id;
      // toate sezoanele (pentru verificarea clasamentului general)
      const perSeason = await Promise.all(seasons.map(async (s) => {
        const gws = (await listGameweeks(s.id)).filter((g) => g.status === "completed")
          .sort((a, b) => Number(a.number) - Number(b.number));
        const rows = await Promise.all(gws.map(async (g) => ({ gw: g, scores: await listGameweekScoresForStats(g.id) })));
        return { season: s, gws: rows };
      }));
      const rowErrors = []; const allTotals = {};
      perSeason.forEach(({ gws }) => gws.forEach(({ gw, scores }) => scores.forEach((r) => {
        const sum = (r.pointsFromMatches || 0) + (r.rankingBonus || 0) + (r.jokerExtraBonus || 0) + (r.mainSurprisePoints || 0) + (r.bonusSurprisePoints || 0);
        if (sum !== (r.totalPoints || 0)) rowErrors.push({ uid: r.userId, gw: gw.number, total: r.totalPoints || 0, sum });
        allTotals[r.userId] = (allTotals[r.userId] || 0) + (r.totalPoints || 0);
      })));
      // sezonul ales: recalcul independent vs clasamentul afișat
      const cur = perSeason.find((x) => x.season.id === sid);
      const mine = {};
      (cur?.gws || []).forEach(({ gw, scores }) => scores.forEach((r) => {
        if (!mine[r.userId]) mine[r.userId] = { uid: r.userId, total: 0, gws: [] };
        mine[r.userId].total += r.totalPoints || 0;
        mine[r.userId].gws.push({ n: gw.number, rank: r.rank, matches: (r.pointsFromMatches || 0) + (r.rankingBonus || 0) + (r.jokerExtraBonus || 0), surprises: (r.mainSurprisePoints || 0) + (r.bonusSurprisePoints || 0), total: r.totalPoints || 0 });
      }));
      const shown = await listSeasonLeaderboard(sid);
      const seasonErrors = shown.filter((r) => (mine[r.uid]?.total ?? 0) !== r.totalPoints).map((r) => ({ uid: r.uid, shown: r.totalPoints, real: mine[r.uid]?.total ?? 0 }));
      const orderOk = shown.every((r, i) => i === 0 || shown[i - 1].totalPoints >= r.totalPoints);
      // general: punctele din profil vs suma tuturor etapelor
      const generalErrors = players.filter((p) => p.status === "active")
        .filter((p) => (p.seasonPoints || 0) !== (allTotals[p.uid] || 0))
        .map((p) => ({ uid: p.uid, profile: p.seasonPoints || 0, sum: allTotals[p.uid] || 0 }));
      const table = shown.map((r, i) => ({ pos: i + 1, ...mine[r.uid], uid: r.uid }));
      setRes({ rowErrors, seasonErrors, orderOk, generalErrors, table, gwCount: cur?.gws.length || 0 });
    } catch (e) { setErr(e.message || String(e)); }
    setBusy(false);
  }

  const Ok = ({ ok, label }) => <div style={{ ...st.line, color: ok ? "#2FBF9A" : "#ff6b6b" }}>{ok ? "✅" : "❌"} {label}</div>;

  return (
    <div>
      <p style={st.hint}>Doar citește datele și verifică totalurile. Nu modifică nimic.</p>
      <div style={st.row}>
        <select style={st.select} value={seasonId} onChange={(e) => setSeasonId(e.target.value)}>
          {seasons.map((s) => <option key={s.id} value={s.id}>{s.name || s.id}</option>)}
        </select>
        <button type="button" style={st.btn} onClick={run} disabled={busy}>{busy ? "Se verifică…" : "🔍 Verifică"}</button>
      </div>
      {err && <p style={{ ...st.line, color: "#ff6b6b" }}>Eroare: {err}</p>}
      {res && (
        <div>
          <Ok ok={res.rowErrors.length === 0} label={`Totalul fiecărei etape (meciuri + bonusuri + surprize) — ${res.rowErrors.length ? `${res.rowErrors.length} greșeli` : "corect"}`} />
          {res.rowErrors.map((e, i) => <div key={i} style={st.err}>{nick(e.uid)} · etapa {e.gw}: salvat {e.total}, corect {e.sum}</div>)}
          <Ok ok={res.seasonErrors.length === 0 && res.orderOk} label={`Clasamentul sezonului (${res.gwCount} etape finalizate) — ${res.seasonErrors.length ? `${res.seasonErrors.length} diferențe` : res.orderOk ? "corect" : "ordine greșită"}`} />
          {res.seasonErrors.map((e, i) => <div key={i} style={st.err}>{nick(e.uid)}: afișat {e.shown}, corect {e.real}</div>)}
          <Ok ok={res.generalErrors.length === 0} label={`Clasamentul general (puncte din profil = suma tuturor etapelor) — ${res.generalErrors.length ? `${res.generalErrors.length} diferențe` : "corect"}`} />
          {res.generalErrors.map((e, i) => <div key={i} style={st.err}>{nick(e.uid)}: profil {e.profile}, suma etapelor {e.sum}</div>)}

          <div style={st.sub}>Detaliu pe jucător (atinge un nume)</div>
          {res.table.map((r) => (
            <div key={r.uid} style={st.player}>
              <button type="button" style={st.pbtn} onClick={() => setOpen(open === r.uid ? "" : r.uid)}>
                <span>{r.pos}. {nick(r.uid)}</span><b>{r.total}</b>
              </button>
              {open === r.uid && (r.gws || []).sort((a, b) => Number(a.n) - Number(b.n)).map((g) => (
                <div key={g.n} style={st.gw}>Etapa {g.n}: locul {g.rank ?? "—"} pe meciuri · meciuri {g.matches} + surprize {g.surprises} = <b>{g.total}</b></div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const st = {
  hint: { fontSize: 11.5, color: color.textMuted, margin: "0 0 8px" },
  row: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 },
  select: { background: color.surfaceInset, color: color.textPrimary, border: `1px solid ${color.border}`, borderRadius: 6, padding: "6px 8px", fontSize: 12 },
  btn: { background: color.goldGradient, border: "none", borderRadius: 6, padding: "8px 12px", fontSize: 12, fontWeight: 800, color: color.goldOn, cursor: "pointer" },
  line: { fontSize: 12.5, fontWeight: 700, margin: "6px 0 2px" },
  err: { fontSize: 11.5, color: "#ff9b9b", marginLeft: 18 },
  sub: { fontSize: 12, fontWeight: 800, color: color.textPrimary, margin: "12px 0 6px" },
  player: { borderTop: `1px solid ${color.border}` },
  pbtn: { width: "100%", display: "flex", justifyContent: "space-between", background: "transparent", border: "none", color: color.textPrimary, fontSize: 12.5, padding: "7px 2px", cursor: "pointer" },
  gw: { fontSize: 11.5, color: color.textSecondary, padding: "2px 8px 4px" },
};
