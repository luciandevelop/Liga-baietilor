import { useEffect, useState } from "react";
import { color } from "../theme";
import { listGameweeks, listGameweekScoresForStats } from "../services/adminService";

// ══════════════════════════════════════════════════════════════════
// 📈📉 Admin — „Ups & Downs”: clasamentul SEZONULUI după etapa aleasă,
// comparat cu clasamentul de după etapa anterioară (din datele salvate,
// fără capturi). DOAR CITIRE. Același calcul ca clasamentul sezonului:
// suma totalurilor etapelor finalizate (meciuri + bonusuri + surprize).
// ══════════════════════════════════════════════════════════════════
function ranks(totals) {
  const arr = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const out = {}; let prev = null, pos = 0;
  arr.forEach(([uid, t], i) => { if (t !== prev) { pos = i + 1; prev = t; } out[uid] = pos; });
  return out;
}

export default function UpsDownsPanel({ players = [], seasons = [] }) {
  const [seasonId, setSeasonId] = useState(seasons[0]?.id || "");
  const [gws, setGws] = useState([]);
  const [gwNum, setGwNum] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState("gw"); // "gw" = etapă vs etapa anterioară · "season" = sezon vs sezonul anterior
  // sezoanele în ordine cronologică (lista vine de la cel mai nou la cel mai vechi)
  const chrono = [...seasons].reverse();
  const prevSeason = (sid) => { const i = chrono.findIndex((x) => x.id === sid); return i > 0 ? chrono[i - 1] : null; };

  async function seasonTotals(sid) {
    const list = (await listGameweeks(sid)).filter((g) => g.status === "completed");
    const all = await Promise.all(list.map((g) => listGameweekScoresForStats(g.id)));
    const t = {}; all.forEach((sc) => sc.forEach((r) => { t[r.userId] = (t[r.userId] || 0) + (r.totalPoints || 0); }));
    return t;
  }
  // CLASAMENTUL GENERAL: punctele adunate din toate sezoanele până la sezonul ales (inclusiv),
  // comparat cu generalul de la finalul sezonului anterior. Ex.: după S2 = S1+S2 vs după S1 = S1.
  async function runSeason() {
    setBusy(true); setErr(""); setRes(null);
    try {
      const prev = prevSeason(seasonId);
      if (!prev) throw new Error("Nu există un sezon anterior celui ales.");
      const idx = chrono.findIndex((x) => x.id === seasonId);
      const per = await Promise.all(chrono.slice(0, idx + 1).map((x) => seasonTotals(x.id)));
      const a = {}, b = {};
      per.forEach((t, i) => Object.entries(t).forEach(([u, v]) => { b[u] = (b[u] || 0) + v; if (i < idx) a[u] = (a[u] || 0) + v; }));
      const ra = ranks(a), rb = ranks(b);
      const rows = Object.keys(b).map((u) => ({ uid: u, before: ra[u] ?? null, after: rb[u], delta: ra[u] != null ? ra[u] - rb[u] : 0, total: b[u], prevTotal: a[u] ?? null, isNew: ra[u] == null }))
        .sort((x, y) => x.after - y.after || y.total - x.total);
      setRes({ season: true, rows, prevName: prev.name || prev.id });
    } catch (e) { setErr(e.message || String(e)); }
    setBusy(false);
  }
  const nick = (uid) => players.find((p) => p.uid === uid)?.nickname || uid.slice(0, 6);

  useEffect(() => {
    if (!seasonId) return;
    setRes(null); setGws([]);
    listGameweeks(seasonId).then((list) => {
      const done = list.filter((g) => g.status === "completed").sort((a, b) => Number(a.number) - Number(b.number));
      setGws(done); setGwNum(done.length ? String(done[done.length - 1].number) : "");
    }).catch((e) => setErr(e.message));
  }, [seasonId]);

  async function run() {
    setBusy(true); setErr(""); setRes(null);
    try {
      const n = Number(gwNum);
      const upto = gws.filter((g) => Number(g.number) <= n);
      const scores = await Promise.all(upto.map((g) => listGameweekScoresForStats(g.id)));
      const before = {}, after = {}, gwPts = {};
      upto.forEach((g, i) => scores[i].forEach((r) => {
        const t = r.totalPoints || 0;
        after[r.userId] = (after[r.userId] || 0) + t;
        if (Number(g.number) < n) before[r.userId] = (before[r.userId] || 0) + t;
        else gwPts[r.userId] = t;
      }));
      Object.keys(after).forEach((u) => { if (!(u in before)) before[u] = 0; });
      const rb = ranks(before), ra = ranks(after);
      const rows = Object.keys(after).map((u) => ({ uid: u, before: rb[u], after: ra[u], delta: n > Number(gws[0]?.number) ? rb[u] - ra[u] : 0, total: after[u], gw: gwPts[u] || 0 }))
        .sort((a, b) => a.after - b.after || b.total - a.total);
      setRes({ n, rows, first: n === Number(gws[0]?.number) });
    } catch (e) { setErr(e.message || String(e)); }
    setBusy(false);
  }

  const arrow = (d) => (d > 0 ? `▲${d}` : d < 0 ? `▼${-d}` : "=");
  const up = res ? [...res.rows].filter((r) => !r.isNew).sort((a, b) => b.delta - a.delta)[0] : null;
  const down = res ? [...res.rows].filter((r) => !r.isNew).sort((a, b) => a.delta - b.delta)[0] : null;
  const sName = seasons.find((s) => s.id === seasonId)?.name || "";
  const diffPts = (r) => (r.prevTotal == null ? "" : `${r.total - r.prevTotal >= 0 ? "+" : ""}${r.total - r.prevTotal}p`);
  const text = res && res.season ? [
    `📈📉 UPS & DOWNS — CLASAMENTUL GENERAL după ${sName} (față de finalul sezonului ${res.prevName})`,
    ...res.rows.map((r) => `${r.after}. ${nick(r.uid)} — ${r.total}p · ${r.isNew ? "nou" : `locul ${r.before} → ${r.after} (${arrow(r.delta)}) · în ${sName}: ${diffPts(r)}`}`),
    up && up.delta > 0 ? `🚀 Cel mai mare urcuș: ${nick(up.uid)} (${arrow(up.delta)})` : "",
    down && down.delta < 0 ? `🪂 Cea mai mare cădere: ${nick(down.uid)} (${arrow(down.delta)})` : "",
  ].filter(Boolean).join("\n") : res ? [
    `📈📉 UPS & DOWNS — ${seasons.find((s) => s.id === seasonId)?.name || ""}, după etapa ${res.n}`,
    ...res.rows.map((r) => `${r.after}. ${nick(r.uid)} — ${r.total}p (${arrow(r.delta)}${res.first ? "" : `, locul ${r.before} → ${r.after}`}) · etapa: +${r.gw}p`),
    up && up.delta > 0 ? `🚀 Cel mai mare urcuș: ${nick(up.uid)} (${arrow(up.delta)})` : "",
    down && down.delta < 0 ? `🪂 Cea mai mare cădere: ${nick(down.uid)} (${arrow(down.delta)})` : "",
  ].filter(Boolean).join("\n") : "";

  return (
    <div>
      <p style={st.hint}>Clasamentul sezonului după etapa aleasă, față de etapa anterioară. Doar citire.</p>
      <div style={st.row}>
        <select style={st.select} value={mode} onChange={(e) => { setMode(e.target.value); setRes(null); }}>
          <option value="gw">Etapă vs etapa anterioară</option>
          <option value="season">Clasament general: după sezon vs după sezonul anterior</option>
        </select>
      </div>
      <div style={st.row}>
        <select style={st.select} value={seasonId} onChange={(e) => setSeasonId(e.target.value)}>
          {seasons.map((s) => <option key={s.id} value={s.id}>{s.name || s.id}</option>)}
        </select>
        {mode === "gw" && (
          <select style={st.select} value={gwNum} onChange={(e) => setGwNum(e.target.value)}>
            {gws.map((g) => <option key={g.id} value={g.number}>după etapa {g.number}</option>)}
          </select>
        )}
        <button type="button" style={st.btn} onClick={mode === "gw" ? run : runSeason} disabled={busy || (mode === "gw" && !gwNum)}>{busy ? "…" : "📈 Arată"}</button>
      </div>
      {mode === "season" && <p style={st.hint}>Clasamentul GENERAL (toate sezoanele adunate) la finalul sezonului ales, față de generalul de la finalul sezonului anterior{prevSeason(seasonId) ? ` (${prevSeason(seasonId).name || ""})` : ""}. Lângă puncte: cât a adunat în sezonul ales.</p>}
      {mode === "gw" && !gws.length && <p style={st.hint}>Nicio etapă finalizată în sezonul ales.</p>}
      {err && <p style={{ ...st.hint, color: "#ff6b6b" }}>Eroare: {err}</p>}
      {res && (
        <div>
          {up && up.delta > 0 && <div style={st.hl}>🚀 Cel mai mare urcuș: <b>{nick(up.uid)}</b> {arrow(up.delta)}</div>}
          {down && down.delta < 0 && <div style={st.hl}>🪂 Cea mai mare cădere: <b>{nick(down.uid)}</b> {arrow(down.delta)}</div>}
          {res.rows.map((r) => (
            <div key={r.uid} style={st.item}>
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><b>{r.after}.</b> {nick(r.uid)}</span>
              <span style={{ whiteSpace: "nowrap" }}>
                <b style={{ color: r.delta > 0 ? "#2FBF9A" : r.delta < 0 ? "#ff6b6b" : color.textMuted, marginRight: 8 }}>{res.first || r.isNew ? (r.isNew ? "nou" : "—") : arrow(r.delta)}</b>
                {r.total}p <small style={{ color: color.textMuted }}>{res.season ? (r.isNew ? "" : `(${diffPts(r)})`) : `(+${r.gw})`}</small>
              </span>
            </div>
          ))}
          <button type="button" style={{ ...st.btn, marginTop: 8 }} onClick={() => navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}>
            {copied ? "✓ Copiat" : "📋 Copiază (pentru WhatsApp)"}
          </button>
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
  hl: { fontSize: 12.5, color: color.textPrimary, margin: "2px 0 6px" },
  item: { display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12.5, color: color.textPrimary, padding: "6px 2px", borderTop: `1px solid ${color.border}` },
};
