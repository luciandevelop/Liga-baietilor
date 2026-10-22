import { useCallback, useEffect, useState } from "react";
import { getTreasureResults } from "../services/surprisesService";

// 🏴‍☠️ CLASAMENTUL PIRAȚILOR — rezultatele PUBLICE ale Comorii Blestemate, în aceeași pagină cu jocul (sub el,
// nu peste hartă, fără popup). Citește DOAR documentele publice treasureResults (uid, poreclă, puncte, stare) —
// niciodată jocul privat al cuiva (drumuri, pași, viețile rămase). Fiecare rezultat apare doar când aventura
// jucătorului e încheiată; ceilalți sunt „încă pe mare” (nu se afișează punctaje intermediare și nici cine a început).
//
// Consum: ZERO citiri cât timp e restrâns. La deschidere: UN singur query (≤ numărul de jucători). Se reîncarcă doar
// când își termină jucătorul aventura (ca să-și vadă rezultatul) sau la apăsarea „Actualizează”.

export const STATE_LABEL = {
  treasure: "Comoară găsită",
  cashout: "Cash-out",
  "lives-lost": "Vieți pierdute",
  ended: "Aventură încheiată",
  "not-started": "Nu a început",
};

// Sortare descrescătoare după puncte. Punctaje egale = același loc (rang „competiție”: 1, 1, 3) și aceeași medalie —
// nicio departajare inventată; în cadrul aceluiași punctaj ordinea e alfabetică (doar pentru afișare stabilă).
export function rankTreasureResults(rows) {
  const sorted = [...rows].sort((a, b) => (b.points - a.points) || a.nickname.localeCompare(b.nickname, "ro"));
  return sorted.map((r) => ({ ...r, rank: 1 + sorted.filter((x) => x.points > r.points).length }));
}

const MEDAL = { 1: "🥇", 2: "🥈", 3: "🥉" };
const fmt = (n) => Number(n || 0).toLocaleString("ro-RO");

export default function PiratesLeaderboard({ gameweekId, myUid, finishedTick = 0, resolved = false }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | loading | ready | error
  const [rows, setRows] = useState([]);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setRows(await getTreasureResults(gameweekId));
      setStatus("ready");
    } catch (err) {
      console.error("Clasamentul Piraților: eroare la încărcare:", err);
      setStatus("error");
    }
  }, [gameweekId]);

  // Prima deschidere încarcă datele (o singură dată); restrângerea/redeschiderea refolosește ce e deja încărcat.
  useEffect(() => { if (open && status === "idle") load(); }, [open, status, load]);

  // Aventura proprie s-a încheiat → după momentul final (cufărul), clasamentul se deschide singur, cu rezultatul tău.
  useEffect(() => {
    if (finishedTick <= 0) return undefined;
    const t = setTimeout(() => { setOpen(true); load(); }, 1800);
    return () => clearTimeout(t);
  }, [finishedTick, load]);

  const ranked = rankTreasureResults(rows);

  return (
    <section style={s.box}>
      <button type="button" style={s.head} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span style={s.headTitle}>🏴‍☠️ CLASAMENTUL PIRAȚILOR</span>
        <span style={s.headChevron}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={s.parchment}>
          {status === "loading" && <div style={s.note}>Se citesc pergamentele…</div>}
          {status === "error" && (
            <div style={s.note}>
              Nu s-a putut încărca clasamentul.{" "}
              <button type="button" style={s.linkBtn} onClick={load}>Încearcă din nou</button>
            </div>
          )}
          {status === "ready" && ranked.length === 0 && (
            <div style={s.note}>Niciun pirat nu și-a încheiat încă aventura. ⚓</div>
          )}
          {status === "ready" && ranked.length > 0 && (
            <div style={s.list}>
              {ranked.map((r) => {
                const mine = r.uid === myUid;
                return (
                  <div key={r.uid} style={{ ...s.row, ...(r.rank === 1 ? s.rowGold : r.rank === 2 ? s.rowSilver : r.rank === 3 ? s.rowBronze : null), ...(mine ? s.rowMine : null) }}>
                    <span style={s.rank}>{MEDAL[r.rank] || `${r.rank}.`}</span>
                    <span style={s.who}>
                      <span style={s.name}>{r.nickname || "Pirat"}{mine ? <span style={s.me}> (tu)</span> : null}</span>
                      <span style={s.state}>{STATE_LABEL[r.state] || STATE_LABEL.ended}</span>
                    </span>
                    <span style={s.points}>{fmt(r.points)} PCT</span>
                  </div>
                );
              })}
            </div>
          )}
          {(status === "ready" || status === "error") && (
            <div style={s.foot}>
              <span>{resolved ? "Rezultate finale." : "Ceilalți piraţi sunt încă pe mare ⚓ — apar aici când își termină aventura."}</span>
              <button type="button" style={s.linkBtn} onClick={load}>↻ Actualizează</button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

const s = {
  box: { marginTop: 16, border: "2px solid #5a3b1e", borderRadius: 14, overflow: "hidden", background: "#150e07", boxShadow: "0 4px 18px rgba(0,0,0,0.45)" },
  head: {
    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, width: "100%", cursor: "pointer",
    padding: "13px 14px", border: "none", borderBottom: "2px solid #3a2410",
    background: "linear-gradient(180deg, #7a4f27 0%, #4a2f16 100%)", color: "#F4D27A", textAlign: "left",
  },
  headTitle: { fontSize: 14, fontWeight: 900, letterSpacing: "0.07em", textShadow: "0 1px 0 rgba(0,0,0,0.5)" },
  headChevron: { fontSize: 13, fontWeight: 900 },
  parchment: { background: "linear-gradient(180deg, #f3e5bd 0%, #e3ca8c 100%)", color: "#2a1a0a", padding: "8px 10px 10px" },
  list: { maxHeight: 360, overflowY: "auto", overscrollBehavior: "contain", touchAction: "pan-y", WebkitOverflowScrolling: "touch" },
  row: {
    display: "flex", alignItems: "center", gap: 10, padding: "10px 8px", borderBottom: "1px solid rgba(90,59,30,0.28)",
    borderLeft: "4px solid transparent",
  },
  rowGold: { background: "rgba(212,160,23,0.20)", borderLeft: "4px solid #d4a017" },
  rowSilver: { background: "rgba(150,150,160,0.18)", borderLeft: "4px solid #9a9aa6" },
  rowBronze: { background: "rgba(176,110,60,0.18)", borderLeft: "4px solid #b06e3c" },
  rowMine: { outline: "2px solid #7a1f1f", outlineOffset: -2, borderRadius: 6 },
  rank: { width: 34, fontSize: 20, fontWeight: 900, textAlign: "center", flexShrink: 0 },
  who: { display: "flex", flexDirection: "column", minWidth: 0, flex: 1 },
  name: { fontSize: 16, fontWeight: 800, lineHeight: 1.2, wordBreak: "break-word" },
  me: { fontSize: 11, fontWeight: 800, color: "#7a1f1f" },
  state: { fontSize: 11, fontWeight: 700, color: "#6b4a26", marginTop: 1 },
  points: { fontSize: 18, fontWeight: 900, flexShrink: 0, color: "#2a1a0a", whiteSpace: "nowrap" },
  note: { fontSize: 13, fontWeight: 600, color: "#4a2f16", padding: "14px 8px", lineHeight: 1.45 },
  foot: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "8px 8px 0", fontSize: 11, color: "#5a3b1e", fontWeight: 600, lineHeight: 1.35 },
  linkBtn: { background: "none", border: "none", color: "#7a1f1f", fontWeight: 800, fontSize: 11, cursor: "pointer", textDecoration: "underline", padding: "8px 4px", flexShrink: 0 },
};
