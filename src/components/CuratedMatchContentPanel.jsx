import { useEffect, useState } from "react";
import { auth } from "../firebase";
import { color } from "../theme";
import { listMatches } from "../services/adminService";
import { getMatchContentCandidates, getCuratedStatuses, publishCuratedItem, unpublishCuratedItem } from "../services/feedService";

// ══════════════════════════════════════════════════════════════════
// 🏙️ Admin — curiozități pentru meciurile etapei (orașe, echipe, rivalități).
// Pentru fiecare meci: tot conținutul existent despre cele două echipe.
// Adminul apasă „📣 Publică” pe ce vrea să apară în Feed; „↩ Retrage” îl scoate.
// ══════════════════════════════════════════════════════════════════
const KIND = { city: { l: "🏙️ Oraș / țară", c: "#7fd0ff" }, team: { l: "📖 Echipă", c: "#F5C451" }, fact: { l: "🧠 Curiozitate", c: "#c79ef0" }, matchup: { l: "⚔️ Meciul direct", c: "#ff7aa8" } };

export default function CuratedMatchContentPanel({ gameweekId }) {
  const [rows, setRows] = useState(null);
  const [statusOf, setStatusOf] = useState(() => () => null);
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  async function load() {
    setErr(""); setRows(null);
    try {
      const ms = await listMatches(gameweekId);
      const r = getMatchContentCandidates(ms);
      setRows(r);
      const st = await getCuratedStatuses(r.flatMap((x) => x.items.map((it) => [x.match, it])));
      setStatusOf(() => st.statusOf);
    } catch (e) { setErr(e.message || String(e)); setRows([]); }
  }
  useEffect(() => { if (gameweekId) load(); }, [gameweekId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggle(m, it, published) {
    const k = `${m.id}_${it.key}`; setBusy(k);
    try {
      if (published) await unpublishCuratedItem(m, it); else await publishCuratedItem(m, it, auth.currentUser?.uid);
      const st = await getCuratedStatuses(rows.flatMap((x) => x.items.map((i) => [x.match, i])));
      setStatusOf(() => st.statusOf);
    } catch (e) { window.alert("Eroare: " + (e.message || String(e))); }
    setBusy("");
  }

  if (!gameweekId) return <p style={st.hint}>Alege etapa din selectorul de mai sus.</p>;
  if (rows === null) return <p style={st.hint}>Se încarcă…</p>;
  const withContent = rows.filter((r) => r.items.length > 0);
  return (
    <div>
      <p style={st.hint}>Pentru fiecare meci al etapei: tot ce avem despre cele două echipe (orașul, echipa, curiozități, meciul direct). Nimic nu apare în Feed până nu apeși 📣 Publică.</p>
      {err && <p style={{ ...st.hint, color: "#ff6b6b" }}>{err}</p>}
      {withContent.length === 0 && <p style={st.hint}>Nu avem conținut pentru echipele din meciurile acestei etape.</p>}
      {rows.map(({ match: m, items }) => {
        const pub = items.filter((it) => statusOf(m, it) === "published").length;
        return (
          <div key={m.id} style={st.match}>
            <button type="button" style={st.matchHead} onClick={() => setOpen(open === m.id ? null : m.id)} disabled={items.length === 0}>
              <span style={{ fontWeight: 800 }}>{m.homeTeam} – {m.awayTeam}</span>
              <span style={{ color: items.length ? color.goldLight : color.textMuted, fontSize: 11.5 }}>
                {items.length ? `${items.length} texte${pub ? ` · ${pub} publicate` : ""} ${open === m.id ? "▲" : "▼"}` : "fără conținut"}
              </span>
            </button>
            {open === m.id && items.map((it) => {
              const published = statusOf(m, it) === "published";
              const k = `${m.id}_${it.key}`;
              return (
                <div key={it.key} style={{ ...st.item, ...(published ? { borderColor: "rgba(139,217,87,.5)" } : {}) }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 10.5, fontWeight: 800, color: KIND[it.kind].c }}>{KIND[it.kind].l} · {it.teamName}</span>
                    <button type="button" style={{ ...st.btn, ...(published ? st.btnOff : {}) }} disabled={busy === k} onClick={() => toggle(m, it, published)}>
                      {busy === k ? "…" : published ? "↩ Retrage" : "📣 Publică"}
                    </button>
                  </div>
                  <div style={st.title}>{it.title}</div>
                  {it.text && <div style={st.text}>{it.text}</div>}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

const st = {
  hint: { fontSize: 11.5, color: color.textMuted, margin: "0 0 8px", lineHeight: 1.5 },
  match: { borderTop: `1px solid ${color.border}`, padding: "6px 0" },
  matchHead: { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, background: "transparent", border: "none", color: color.textPrimary, padding: "6px 2px", fontSize: 13, textAlign: "left", cursor: "pointer" },
  item: { border: `1px solid ${color.border}`, borderRadius: 8, padding: "8px 10px", margin: "6px 0", background: "rgba(255,255,255,.02)" },
  title: { fontSize: 12.5, fontWeight: 700, color: color.textPrimary, marginTop: 4 },
  text: { fontSize: 11.5, color: color.textSecondary, marginTop: 3, lineHeight: 1.45 },
  btn: { background: color.goldGradient, border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11.5, fontWeight: 800, color: color.goldOn, cursor: "pointer", flexShrink: 0 },
  btnOff: { background: "rgba(255,255,255,.06)", color: "#fff", border: "1px solid rgba(255,255,255,.2)" },
};
