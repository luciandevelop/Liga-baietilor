import { useEffect, useState } from "react";
import { getPlayerLooks, setPlayerBald } from "../services/seasonNumbersService";
import { color } from "../theme";
import { computeNumberOrder, freezeSeasonNumbers, formatPlayerNumber, getSeasonNumbers } from "../services/seasonNumbersService";

// ══════════════════════════════════════════════════════════════════
// 🔢 Admin — Numerele Sezonului 3.
//   1. Înainte de înghețare: previzualizare (clasament general, departajare
//      după sezonul ales) + buton „Îngheață numerele”.
//   2. După înghețare: lista fixă număr → jucător, copiabilă.
// Înlocuitorii folosesc contul jucătorului înlocuit (același uid), deci
// preiau automat locul lui în clasament și numărul.
// players: lista din tab-ul Jucători ({ uid, nickname, status }).
// seasons: lista sezoanelor (cel mai nou primul).
// ══════════════════════════════════════════════════════════════════
function SeasonNumbersCore({ players = [], seasons = [] }) {
  const [data, setData] = useState(undefined);   // undefined = se încarcă, null = neînghețat
  const [tieSeasonId, setTieSeasonId] = useState(seasons[0]?.id || "");
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = () => getSeasonNumbers().then(setData).catch((e) => { setData(null); setMsg(`Eroare la citire: ${e.message}`); });
  useEffect(() => { load(); }, []);
  useEffect(() => { if (!tieSeasonId && seasons[0]?.id) setTieSeasonId(seasons[0].id); }, [seasons, tieSeasonId]);

  const byUid = Object.fromEntries(players.map((p) => [p.uid, p]));
  const name = (uid) => byUid[uid]?.nickname || uid;

  async function showPreview() {
    setBusy(true); setMsg("");
    try { setPreview(await computeNumberOrder(tieSeasonId)); } catch (e) { setMsg(e.message); }
    setBusy(false);
  }
  async function freeze() {
    if (!window.confirm("Înghețați numerele Sezonului 3? După asta nu se mai recalculează.")) return;
    setBusy(true); setMsg("");
    try { await freezeSeasonNumbers(tieSeasonId); await load(); setMsg("Numerele au fost înghețate."); } catch (e) { setMsg(e.message); }
    setBusy(false);
  }
  if (data === undefined) return <p style={st.hint}>Se încarcă…</p>;

  // ── Neînghețat: previzualizare + înghețare ──
  if (!data || !data.numbers) {
    return (
      <div>
        <p style={st.hint}>
          Numerele se dau după <b>clasamentul general</b> (doar jucători activi): primul primește 001. La egalitate de puncte decide clasamentul sezonului ales mai jos. Apasă butonul <b>după ultima etapă a Sezonului 2</b>, când lista jucătorilor e cea finală (înlocuirile făcute, cei care pleacă dezactivați).
        </p>
        <label style={st.label}>
          Departajare după sezonul:{" "}
          <select style={st.select} value={tieSeasonId} onChange={(e) => { setTieSeasonId(e.target.value); setPreview(null); }}>
            {seasons.map((s) => <option key={s.id} value={s.id}>{s.name || s.id}</option>)}
          </select>
        </label>
        <div style={st.row}>
          <button type="button" style={st.btn} onClick={showPreview} disabled={busy}>Previzualizează</button>
          <button type="button" style={st.btnGold} onClick={freeze} disabled={busy}>🔒 Îngheață numerele</button>
        </div>
        {preview && (
          <div style={st.list}>
            {preview.map((r) => (
              <div key={r.uid} style={st.item}>
                <b style={st.num}>{formatPlayerNumber(r.number)}</b>
                <span style={st.nick}>{r.nickname}</span>
                <span style={st.meta}>{r.total}p</span>
              </div>
            ))}
          </div>
        )}
        {msg && <p style={st.msg}>{msg}</p>}
      </div>
    );
  }

  // ── Înghețat: lista fixă + înlocuiri ──
  const entries = Object.entries(data.numbers).map(([uid, n]) => ({ uid, n })).sort((a, b) => a.n - b.n);
  const listText = entries.map((e) => `${formatPlayerNumber(e.n)} — ${name(e.uid)}`).join("\n");

  return (
    <div>
      <p style={st.hint}>Numerele sunt <b>înghețate</b>. Folosește lista de mai jos când faci avatarele.</p>
      <div style={st.list}>
        {entries.map((e) => {
          const p = byUid[e.uid];
          const inactive = p && p.status !== "active";
          return (
            <div key={e.uid} style={{ ...st.item, opacity: inactive ? 0.55 : 1 }}>
              <b style={st.num}>{formatPlayerNumber(e.n)}</b>
              <span style={st.nick}>{name(e.uid)}</span>
              {inactive && <span style={st.tag}>dezactivat</span>}
            </div>
          );
        })}
      </div>
      <button type="button" style={st.btn} onClick={() => { try { navigator.clipboard?.writeText(listText); setMsg("Lista a fost copiată."); } catch { /* fără clipboard */ } }}>Copiază lista</button>

      {msg && <p style={st.msg}>{msg}</p>}
    </div>
  );
}

const st = {
  hint: { fontSize: 11.5, color: color.textMuted, lineHeight: 1.5, margin: "0 0 8px" },
  label: { display: "block", fontSize: 12, color: color.textSecondary, marginBottom: 8 },
  select: { background: color.surfaceInset, color: color.textPrimary, border: `1px solid ${color.border}`, borderRadius: 6, padding: "6px 8px", fontSize: 12, maxWidth: "100%" },
  row: { display: "flex", gap: 8, flexWrap: "wrap", margin: "6px 0 10px" },
  btn: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, padding: "8px 12px", fontSize: 12, fontWeight: 700, color: "#fff", cursor: "pointer" },
  btnGold: { background: color.goldGradient, border: "none", borderRadius: 6, padding: "8px 12px", fontSize: 12, fontWeight: 800, color: color.goldOn, cursor: "pointer" },
  list: { display: "flex", flexDirection: "column", gap: 4, margin: "8px 0 10px" },
  item: { display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", background: color.surfaceInset, borderRadius: 6 },
  num: { fontFamily: "monospace", fontSize: 14, color: color.goldLight, minWidth: 34 },
  nick: { flex: 1, minWidth: 0, fontSize: 13, color: color.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  meta: { fontSize: 11, color: color.textMuted },
  tag: { fontSize: 10.5, color: color.textMuted, border: `1px solid ${color.border}`, borderRadius: 4, padding: "1px 5px" },
  msg: { fontSize: 12, color: color.goldLight, marginTop: 8 },
};


// ── 👨‍🦲 Aspectul pe Pod: chel / cu păr, setat de Admin pe fiecare jucător ──
function LooksSection({ players = [] }) {
  const [bald, setBald] = useState(null);
  const [busyUid, setBusyUid] = useState("");
  useEffect(() => { getPlayerLooks().then((d) => setBald(d?.bald || {})).catch(() => setBald({})); }, []);
  const active = players.filter((p) => p.status === "active");
  async function toggle(uid) {
    const next = !bald?.[uid];
    setBusyUid(uid);
    try { await setPlayerBald(uid, next); setBald((b) => ({ ...b, [uid]: next })); } catch (e) { window.alert(`Nu s-a salvat: ${e.code || e.message}`); }
    setBusyUid("");
  }
  if (!bald) return null;
  return (
    <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,.1)" }}>
      <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 4 }}>👨‍🦲 Aspectul pe Podul de Sticlă</div>
      <p style={{ fontSize: 11.5, opacity: 0.7, margin: "0 0 8px" }}>Implicit toți au păr scurt. Apasă pe cei care trebuie să apară cheli.</p>
      {active.map((p) => (
        <div key={p.uid} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", fontSize: 12.5 }}>
          <span>{p.nickname || p.uid}</span>
          <button type="button" onClick={() => toggle(p.uid)} disabled={busyUid === p.uid}
            style={{ minWidth: 92, padding: "5px 8px", borderRadius: 8, fontWeight: 800, fontSize: 12, cursor: "pointer",
              border: bald[p.uid] ? "1px solid #F5C451" : "1px solid rgba(255,255,255,.2)",
              background: bald[p.uid] ? "rgba(245,196,81,.15)" : "transparent", color: bald[p.uid] ? "#F5C451" : "#fff" }}>
            {busyUid === p.uid ? "…" : bald[p.uid] ? "👨‍🦲 Chel" : "🧑 Păr"}
          </button>
        </div>
      ))}
    </div>
  );
}

export default function SeasonNumbersPanel(props) {
  return (
    <div>
      <SeasonNumbersCore {...props} />
      <LooksSection players={props.players} />
    </div>
  );
}
