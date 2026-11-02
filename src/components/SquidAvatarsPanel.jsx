import { useEffect, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { color } from "../theme";
import { getAvatarUrl, isS3Avatar, s3AvatarId } from "../assets/avatars";
import { getSeasonNumbers, formatPlayerNumber } from "../services/seasonNumbersService";
import SeasonIntro from "./SeasonIntro";

// ══════════════════════════════════════════════════════════════════
// 🦑 Admin — avatarele Squid Game ale Sezonului 3.
//   • Fiecare jucător primește avatarul cu NUMĂRUL lui înghețat (s3/<număr>).
//   • Avatarul personal se păstrează în „avatarBackup” și revine la final.
//   • „avatarLocked” blochează schimbarea (în aplicație ȘI în regulile Firestore).
//   • Adminul poate corecta asocierea pentru orice jucător (alt număr de imagine).
// Imaginile: public/avatars/s3/001.png … 018.png (sau .jpg/.webp).
// ══════════════════════════════════════════════════════════════════
const RANK = (n) => (n === 1 ? "The Leader" : n <= 4 ? "The Pretenders" : n <= 10 ? "The Guards" : "The Nobodies");

export default function SquidAvatarsPanel({ players = [], onChanged }) {
  const [numbers, setNumbers] = useState({});
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [imgOk, setImgOk] = useState({});
  const [introFor, setIntroFor] = useState(null);
  const active = players.filter((p) => p.status === "active");

  useEffect(() => { getSeasonNumbers().then((d) => setNumbers(d?.numbers || {})).catch(() => {}); }, []);
  const frozen = Object.keys(numbers).length > 0;

  async function applyOne(p, num) {
    const n = parseInt(num, 10);
    if (!Number.isFinite(n)) return;
    const backup = isS3Avatar(p.avatarId) ? p.avatarBackup ?? null : p.avatarId ?? null;
    await updateDoc(doc(db, "users", p.uid), { avatarId: s3AvatarId(n), avatarBackup: backup, avatarLocked: true });
  }
  async function applyAll() {
    if (!window.confirm("Aplici avatarele Squid Game tuturor jucătorilor cu număr înghețat? Avatarele personale se păstrează și revin la final.")) return;
    setBusy("all"); setMsg("");
    let n = 0;
    try { for (const p of active) { if (numbers[p.uid]) { await applyOne(p, numbers[p.uid]); n++; } } setMsg(`✓ Aplicat la ${n} jucători.`); onChanged?.(); }
    catch (e) { setMsg(`Eroare: ${e.code || e.message} (după ${n} jucători)`); }
    setBusy("");
  }
  async function restoreAll() {
    if (!window.confirm("Restaurezi avatarele personale pentru toți (final de sezon)?")) return;
    setBusy("restore"); setMsg("");
    try {
      for (const p of active) { if (isS3Avatar(p.avatarId) || p.avatarLocked) await updateDoc(doc(db, "users", p.uid), { avatarId: p.avatarBackup ?? null, avatarLocked: false }); }
      setMsg("✓ Avatarele personale au fost restaurate."); onChanged?.();
    } catch (e) { setMsg(`Eroare: ${e.code || e.message}`); }
    setBusy("");
  }
  async function fixOne(p, num) {
    setBusy(p.uid); setMsg("");
    try { await applyOne(p, num); setMsg(`✓ ${p.nickname}: avatarul ${formatPlayerNumber(parseInt(num, 10))}.`); onChanged?.(); }
    catch (e) { setMsg(`Eroare: ${e.code || e.message}`); }
    setBusy("");
  }

  const sorted = [...active].sort((a, b) => (numbers[a.uid] || 99) - (numbers[b.uid] || 99));
  return (
    <div>
      <p style={st.hint}>
        Imaginile se urcă în GitHub în <b>public/avatars/s3/</b>, denumite după număr: <b>001.png … 018.png</b>.
        {frozen ? "" : " ⚠️ Numerele nu sunt încă înghețate."}
      </p>
      <div style={st.row}>
        <button type="button" style={st.gold} onClick={applyAll} disabled={!!busy || !frozen}>{busy === "all" ? "…" : "🦑 Aplică avatarele Sezonului 3"}</button>
        <button type="button" style={st.btn} onClick={restoreAll} disabled={!!busy}>{busy === "restore" ? "…" : "↩ Restaurează avatarele personale"}</button>
      </div>
      {msg && <p style={{ ...st.hint, color: color.goldLight }}>{msg}</p>}
      <div style={st.row}>
        <select style={st.sel} value="" onChange={(e) => { const p = active.find((x) => x.uid === e.target.value); if (p) setIntroFor(p); }}>
          <option value="">▶ Testează intro-ul pentru…</option>
          {sorted.map((p) => <option key={p.uid} value={p.uid}>{numbers[p.uid] ? formatPlayerNumber(numbers[p.uid]) + " · " : ""}{p.nickname}</option>)}
        </select>
      </div>
      {introFor && <SeasonIntro preview uid={introFor.uid} nickname={introFor.nickname}
        avatarId={numbers[introFor.uid] ? s3AvatarId(numbers[introFor.uid]) : introFor.avatarId} onClose={() => setIntroFor(null)} />}
      {sorted.map((p) => {
        const num = numbers[p.uid];
        const cur = isS3Avatar(p.avatarId) ? parseInt(p.avatarId.split("/")[1], 10) : null;
        const want = cur || num;
        const url = want ? getAvatarUrl(s3AvatarId(want)) : null;
        const ok = cur && num && cur === num;
        return (
          <div key={p.uid} style={st.item}>
            <div style={st.thumb}>{url ? <img src={url} alt="" style={st.img} onError={() => setImgOk((m) => ({ ...m, [p.uid]: false }))} onLoad={() => setImgOk((m) => ({ ...m, [p.uid]: true }))} /> : "—"}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={st.nick}>{num ? formatPlayerNumber(num) : "---"} · {p.nickname}</div>
              <div style={st.sub}>
                {num ? RANK(num) : "fără număr"} · {cur ? (ok ? "✓ avatar S3 aplicat" : `⚠️ avatar ${formatPlayerNumber(cur)}`) : "avatar personal"}
                {imgOk[p.uid] === false ? " · ❌ imaginea lipsește" : ""}{p.avatarLocked ? " · 🔒" : ""}
              </div>
            </div>
            <select style={st.sel} value="" onChange={(e) => e.target.value && fixOne(p, e.target.value)} disabled={!!busy}>
              <option value="">Corectează</option>
              {Array.from({ length: 18 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{formatPlayerNumber(n)}</option>)}
            </select>
          </div>
        );
      })}
    </div>
  );
}

const st = {
  hint: { fontSize: 11.5, color: color.textMuted, lineHeight: 1.5, margin: "0 0 8px" },
  row: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 },
  gold: { background: color.goldGradient, border: "none", borderRadius: 6, padding: "8px 12px", fontSize: 12, fontWeight: 800, color: color.goldOn, cursor: "pointer" },
  btn: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, padding: "8px 12px", fontSize: 12, fontWeight: 700, color: "#fff", cursor: "pointer" },
  item: { display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: `1px solid ${color.border}` },
  thumb: { width: 40, height: 56, borderRadius: 6, overflow: "hidden", background: color.surfaceInset, display: "flex", alignItems: "center", justifyContent: "center", color: color.textMuted, flexShrink: 0 },
  img: { width: "100%", height: "100%", objectFit: "cover" },
  nick: { fontSize: 12.5, fontWeight: 800, color: color.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  sub: { fontSize: 11, color: color.textMuted },
  sel: { background: color.surfaceInset, color: color.textPrimary, border: `1px solid ${color.border}`, borderRadius: 6, padding: "5px 4px", fontSize: 11.5 },
};
