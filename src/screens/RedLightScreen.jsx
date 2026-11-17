import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { color } from "../theme";
import { subscribeToGameweekMatches } from "../services/matchesStore";
import { loadUserPredictions } from "../services/predictionsService";
import { getUserPublicProfiles } from "../services/profilesService";
import { computeMyRedLight, getRedLight, getRedLightShow, getRedLightState, listAdvancersForMatch, setMyChoice, stopMe } from "../services/redLightService";

// Scena 3D se încarcă doar la apăsarea „Vezi ultimul show”.
const RedLightShow3D = lazy(() => import("../components/RedLightShow3D"));
import { RL_FINISH_STEPS, RL_MAX_STRIKES, RL_OUTCOME, RL_POINTS_TABLE, RL_STATUS, lockAtFromKickoff, pointsForSteps } from "../services/redLightEngine";

// ══════════════════════════════════════════════════════════════════
// 🚦 LUMINĂ ROȘIE, LUMINĂ VERDE — ecranul jucătorului (ETAPA 2, simplu).
// Panoul de control: pași / greșeli / PCT, următorul meci evidențiat,
// AVANSEZ / STAU pe fiecare din cele 20 de meciuri, MĂ OPRESC.
// Progresul se calculează pe telefon, cu motorul unic (redLightEngine),
// din rezultatele OFICIALE deja publicate. Designul spectaculos și show-ul
// vin în etapele următoare.
// ══════════════════════════════════════════════════════════════════

const kick = (m) => (m?.kickoffAt?.toMillis ? m.kickoffAt.toMillis() : NaN);
const hm = (t) => (Number.isFinite(t) ? new Date(t).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" }) : "—");
const day = (t) => (Number.isFinite(t) ? new Date(t).toLocaleDateString("ro-RO", { weekday: "short", day: "2-digit", month: "2-digit" }) : "");

const OUTCOME_LABEL = {
  [RL_OUTCOME.EXACT]: { t: "⭐ Scor exact · +2 pași", c: "#F5C451" },
  [RL_OUTCOME.CORRECT]: { t: "✅ Corect · +1 pas", c: "#2FBF9A" },
  [RL_OUTCOME.WRONG]: { t: "❌ Prins de păpușă · +1 greșeală", c: "#ff6b6b" },
  [RL_OUTCOME.STAY]: { t: "— Ai stat pe loc", c: "#8B93A8" },
  [RL_OUTCOME.NO_PREDICTION]: { t: "— Fără pronostic → STAU", c: "#8B93A8" },
  [RL_OUTCOME.IGNORED_STOP]: { t: "— După oprire (nu contează)", c: "#8B93A8" },
  [RL_OUTCOME.OUT]: { t: "— Nu mai joci", c: "#8B93A8" },
  [RL_OUTCOME.VOID]: { t: "⚪ Amânat / anulat · fără efect", c: "#8B93A8" },
};

const BOARD_LABEL = { [RL_STATUS.ACTIVE]: "în joc", [RL_STATUS.SAFE]: "SAFE", [RL_STATUS.FINISHER]: "FINISHER", [RL_STATUS.ELIMINATED]: "ELIMINAT" };
const BOARD_COLOR = { [RL_STATUS.ACTIVE]: "#C9CFDD", [RL_STATUS.SAFE]: "#2FBF9A", [RL_STATUS.FINISHER]: "#F5C451", [RL_STATUS.ELIMINATED]: "#ff6b6b" };

export default function RedLightScreen({ gameweekId, uid }) {
  const [game, setGame] = useState(undefined);
  const [matches, setMatches] = useState([]);
  const [preds, setPreds] = useState({});
  const [mine, setMine] = useState(null); // { result, myAdvances, stopAt }
  const [busyId, setBusyId] = useState(null);
  const [msg, setMsg] = useState("");
  const [now, setNow] = useState(Date.now());
  const [names, setNames] = useState({});
  const [advancers, setAdvancers] = useState({});
  const recomputeSeq = useRef(0);

  useEffect(() => { getRedLight(gameweekId).then(setGame).catch(() => setGame(null)); }, [gameweekId]);
  useEffect(() => subscribeToGameweekMatches(gameweekId, setMatches), [gameweekId]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);

  const isParticipant = !!game?.participants?.includes(uid);
  const order = game?.order || [];
  const byId = useMemo(() => Object.fromEntries(matches.map((m) => [m.id, m])), [matches]);
  // Semnătura stărilor meciurilor — recalculăm doar când chiar se schimbă ceva.
  const statusSig = order.map((id) => `${id}:${byId[id]?.status || ""}`).join("|");

  // Pronosticurile proprii — DOAR pentru meciurile încă deschise (la cele
  // blocate alegerea nu se mai poate schimba), ca să economisim citiri.
  const openIdsSig = order.filter((id) => { const l = lockAtFromKickoff(kick(byId[id])); return Number.isFinite(l) && Date.now() < l; }).join(",");
  useEffect(() => {
    if (!game || !isParticipant || !openIdsSig) return;
    loadUserPredictions(uid, openIdsSig.split(",")).then(setPreds).catch(() => {});
  }, [game, uid, openIdsSig]); // eslint-disable-line react-hooks/exhaustive-deps

  const recompute = useCallback(async () => {
    if (!game || !isParticipant || !matches.length) return;
    const seq = ++recomputeSeq.current;
    try {
      const r = await computeMyRedLight(gameweekId, uid, game, matches);
      if (seq === recomputeSeq.current) setMine(r); // ignoră răspunsurile întârziate
    } catch (e) { setMsg(`Nu s-a putut încărca progresul: ${e.message || e.code}`); }
  }, [game, isParticipant, matches, gameweekId, uid]);

  useEffect(() => { recompute(); }, [statusSig, game]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clasamentul oficial (starea salvată de Admin la fiecare validare).
  const [board, setBoard] = useState(null);
  const [lastShow, setLastShow] = useState(null);
  const [watching, setWatching] = useState(false);
  useEffect(() => { if (game) getRedLightShow(gameweekId).then(setLastShow).catch(() => setLastShow(null)); }, [game, gameweekId, statusSig]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!game) return;
    getRedLightState(gameweekId).then((st0) => {
      setBoard(st0);
      if (st0?.rows?.length && !Object.keys(names).length) getUserPublicProfiles(game.participants).then(setNames).catch(() => {});
    }).catch(() => setBoard(null));
  }, [statusSig, game, gameweekId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (game === undefined) return <p style={st.hint}>Se încarcă…</p>;
  if (!game) return <p style={st.hint}>Jocul nu a fost încă publicat.</p>;
  if (!isParticipant) return <p style={st.hint}>Nu ești înscris în Lumină roșie, lumină verde pentru această etapă. Participanții au fost stabiliți la publicare.</p>;
  if (!mine) return <p style={st.hint}>Se încarcă progresul…</p>;

  const me = mine.result.byUid[uid];
  const out = me.status !== RL_STATUS.ACTIVE || me.stopRequested;
  const eventByIdx = Object.fromEntries(mine.result.events.map((e) => [e.index, e.entries[0]]));
  const lockOf = (id) => lockAtFromKickoff(kick(byId[id]));
  const nextIdx = order.findIndex((id) => Number.isFinite(lockOf(id)) && now < lockOf(id));

  async function toggle(id, advance) {
    setBusyId(id); setMsg("");
    try {
      await setMyChoice(gameweekId, id, uid, advance);
      setMine((x) => { const s = new Set(x.myAdvances); if (advance) s.add(id); else s.delete(id); return { ...x, myAdvances: s }; });
    } catch (e) {
      setMsg(e.code === "permission-denied" ? "Nu se poate: meciul e blocat, nu ai pronostic sau te-ai oprit." : `Eroare: ${e.message || e.code}`);
    }
    setBusyId(null);
  }

  async function doStop() {
    const keep = pointsForSteps(me.steps);
    if (!window.confirm(`MĂ OPRESC — definitiv.\n\nOprește-te acum și păstrezi ${keep} PCT (${me.steps} pași).\nNu mai poți avansa în această etapă. Continui?`)) return;
    setBusyId("stop"); setMsg("");
    try { await stopMe(gameweekId, uid); await recompute(); setMsg(`Te-ai oprit. Păstrezi ${keep} PCT.`); } catch (e) { setMsg(`Oprirea a eșuat: ${e.message || e.code}`); }
    setBusyId(null);
  }

  async function showAdvancers(id) {
    try {
      // Din starea oficială, dacă alegerile meciului sunt deja definitive acolo (zero citiri); altfel, citire la cerere.
      const list = board?.choicesLocked && id in board.choicesLocked ? board.choicesLocked[id] : await listAdvancersForMatch(gameweekId, id);
      if (!Object.keys(names).length) getUserPublicProfiles(game.participants).then(setNames).catch(() => {});
      setAdvancers((x) => ({ ...x, [id]: list }));
    } catch { setAdvancers((x) => ({ ...x, [id]: null })); }
  }

  const statusText = {
    [RL_STATUS.ACTIVE]: me.stopRequested ? "🛑 Oprire cerută — aștepți validarea meciurilor deja blocate" : "🟢 În joc",
    [RL_STATUS.SAFE]: "🛡️ SAFE — te-ai oprit, punctele sunt ale tale",
    [RL_STATUS.FINISHER]: "🏁 FINISHER — ai trecut linia!",
    [RL_STATUS.ELIMINATED]: "💀 ELIMINAT — prins a treia oară",
  }[me.status];

  return (
    <div style={st.wrap}>
      {/* ── Panoul de control ── */}
      <div style={st.panel}>
        <div style={st.status}>{statusText}</div>
        <div style={st.stats}>
          <div style={st.stat}><div style={st.big}>{me.steps}<span style={st.of}>/{RL_FINISH_STEPS}</span></div><div style={st.lbl}>pași</div></div>
          <div style={st.stat}><div style={st.big}>{"●".repeat(me.strikes)}<span style={{ opacity: 0.25 }}>{"●".repeat(Math.max(0, RL_MAX_STRIKES - me.strikes))}</span></div><div style={st.lbl}>greșeli (a 3-a elimină)</div></div>
          <div style={st.stat}><div style={{ ...st.big, color: color.goldLight }}>{me.pct}</div><div style={st.lbl}>PCT acum</div></div>
        </div>
        <div style={st.bar}><div style={{ ...st.barFill, width: `${(me.steps / RL_FINISH_STEPS) * 100}%` }} /></div>
        <p style={st.hint}>Punctele încep de la 7 pași ({RL_POINTS_TABLE[7]} PCT) · 14 pași = 200 PCT. Progresul se actualizează după validarea oficială a fiecărui meci.</p>
        {!mine.result.resolvedAll && mine.result.processed < order.length && Number.isFinite(lockOf(order[mine.result.processed])) && now >= lockOf(order[mine.result.processed]) && (
          <p style={st.hint}>⏳ Se așteaptă validarea meciului #{mine.result.processed + 1}.</p>
        )}
        {me.status === RL_STATUS.ACTIVE && !me.stopRequested && (
          <>
            <button type="button" style={{ ...st.stopBtn, opacity: me.canStop ? 1 : 0.45 }} disabled={!me.canStop || busyId === "stop"} onClick={doStop}>
              🛑 MĂ OPRESC · păstrez {pointsForSteps(me.steps)} PCT
            </button>
            {!me.canStop && me.pendingRisks > 0 && <p style={st.hint}>Disponibil după validarea celor {me.pendingRisks} meciuri pe care ai ales AVANSEZ și care sunt deja blocate.</p>}
          </>
        )}
        {msg && <p style={st.msg}>{msg}</p>}
      </div>

      {/* ── Ultimul Red Light Show (replay) ── */}
      {lastShow && (
        <button type="button" style={{ ...st.stopBtn, background: "linear-gradient(180deg,#2a2f3a,#141821)", border: "1px solid rgba(255,80,110,0.5)", opacity: lastShow.invalid ? 0.5 : 1 }} disabled={lastShow.invalid} onClick={() => setWatching(true)}>
          🎬 Vezi ultimul show · meciurile {lastShow.fromIndex + 1}–{lastShow.toIndex}{lastShow.invalid ? " (în curs de actualizare)" : ""}
        </button>
      )}
      {watching && lastShow && (
        <Suspense fallback={<p style={st.hint}>Se încarcă scena 3D…</p>}>
          <RedLightShow3D show={lastShow} onClose={() => setWatching(false)} />
        </Suspense>
      )}

      {/* ── Clasamentul oficial ── */}
      {board?.rows?.length > 0 && (
        <div style={st.card}>
          <div style={st.head}><span style={st.teams}>🏁 Clasament</span><span style={{ ...st.meta, marginLeft: "auto" }}>{board.processed}/{board.total} meciuri</span></div>
          {[...board.rows].sort((a, b) => (b.pct - a.pct) || (b.steps - a.steps) || (a.strikes - b.strikes)).map((r, k) => (
            <div key={r.uid} style={{ ...st.boardRow, ...(r.uid === uid ? st.boardMe : {}) }}>
              <span style={st.boardPos}>{k + 1}</span>
              <span style={st.boardName}>{names[r.uid]?.nickname || "…"}</span>
              <span style={st.boardMeta}>{r.steps} pași · {"●".repeat(r.strikes)}{"○".repeat(Math.max(0, RL_MAX_STRIKES - r.strikes))}</span>
              <span style={{ ...st.boardStatus, color: BOARD_COLOR[r.status] }}>{BOARD_LABEL[r.status]}{r.status !== RL_STATUS.ELIMINATED ? ` · ${r.pct}` : ""}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Cele 20 de meciuri, în ordinea fixă ── */}
      {order.map((id, i) => {
        const m = byId[id]; if (!m) return null;
        const lockAt = lockOf(id);
        const locked = Number.isFinite(lockAt) && now >= lockAt;
        const hasPred = !!preds[id];
        const adv = mine.myAdvances.has(id);
        const ev = eventByIdx[i];
        const isNext = i === nextIdx;
        const canEdit = !locked && !out && hasPred && busyId !== id;
        const others = advancers[id];
        return (
          <div key={id} style={{ ...st.card, ...(isNext ? st.cardNext : {}) }}>
            <div style={st.head}>
              <span style={st.num}>{i + 1}/{order.length}</span>
              <span style={st.teams}>{m.homeTeam} – {m.awayTeam}</span>
            </div>
            <div style={st.meta}>
              {day(kick(m))} · start {hm(kick(m))} · {locked ? "🔒 blocat" : `se blochează la ${hm(lockAt)}`}
              {hasPred ? ` · pronostic ${preds[id].scoreA}-${preds[id].scoreB}` : ""}
            </div>
            {isNext && <div style={st.nextTag}>URMĂTORUL MECI</div>}
            {ev ? (
              <div style={{ ...st.result, color: OUTCOME_LABEL[ev.outcome]?.c }}>{OUTCOME_LABEL[ev.outcome]?.t}</div>
            ) : locked ? (
              <div style={st.result}>{adv ? "🟢 Ai ales AVANSEZ · aștepți rezultatul" : "⚪ STAU"}</div>
            ) : (
              <>
                <div style={st.toggle}>
                  <button type="button" style={{ ...st.opt, ...(adv ? st.optGo : {}) }} disabled={!canEdit || adv} onClick={() => toggle(id, true)}>🟢 AVANSEZ</button>
                  <button type="button" style={{ ...st.opt, ...(!adv ? st.optStay : {}) }} disabled={!canEdit || !adv} onClick={() => toggle(id, false)}>⚪ STAU</button>
                </div>
                {!hasPred && !out && <p style={st.hint}>Pune întâi pronosticul la acest meci ca să poți alege AVANSEZ.</p>}
              </>
            )}
            {locked && (
              others === undefined
                ? <button type="button" style={st.link} onClick={() => showAdvancers(id)}>👁 Cine a avansat</button>
                : <p style={st.hint}>{others === null ? "Nu s-a putut încărca." : others.length ? `Au avansat: ${others.map((u) => names[u]?.nickname || "?").join(", ")}` : "Nimeni nu a avansat."}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

const st = {
  wrap: { display: "flex", flexDirection: "column", gap: 8, marginTop: 8 },
  panel: { position: "sticky", top: 0, zIndex: 2, background: "linear-gradient(180deg,#1a0d12,#0D1220)", border: "1px solid rgba(255,80,110,0.35)", borderRadius: 12, padding: 12 },
  status: { fontSize: 13, fontWeight: 800, color: color.textPrimary, marginBottom: 8 },
  stats: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 },
  stat: { textAlign: "center" },
  big: { fontSize: 22, fontWeight: 900, color: "#fff", lineHeight: 1.1, letterSpacing: 1 },
  of: { fontSize: 12, color: color.textMuted, fontWeight: 700 },
  lbl: { fontSize: 10, color: color.textMuted, marginTop: 2 },
  bar: { height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, margin: "10px 0 4px", overflow: "hidden" },
  barFill: { height: "100%", background: "linear-gradient(90deg,#2FBF9A,#F5C451)", borderRadius: 3 },
  hint: { fontSize: 11.5, color: color.textMuted, lineHeight: 1.45, margin: "6px 0 0" },
  msg: { fontSize: 12, color: color.goldLight, margin: "6px 0 0" },
  stopBtn: { width: "100%", marginTop: 8, background: "linear-gradient(180deg,#ff5a6e,#c2253b)", border: "none", borderRadius: 8, padding: "10px 12px", fontSize: 13, fontWeight: 900, color: "#fff", cursor: "pointer" },
  card: { background: color.surface, border: `1px solid ${color.border}`, borderRadius: 10, padding: 10 },
  cardNext: { borderColor: "rgba(47,191,154,0.8)", boxShadow: "0 0 0 1px rgba(47,191,154,0.35)" },
  head: { display: "flex", gap: 8, alignItems: "baseline" },
  num: { fontSize: 11, fontWeight: 900, color: color.goldLight, whiteSpace: "nowrap" },
  teams: { fontSize: 13.5, fontWeight: 800, color: color.textPrimary, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  meta: { fontSize: 11, color: color.textMuted, marginTop: 3 },
  nextTag: { display: "inline-block", marginTop: 6, fontSize: 9.5, fontWeight: 900, letterSpacing: ".08em", color: "#2FBF9A" },
  result: { fontSize: 12.5, fontWeight: 700, marginTop: 8, color: color.textSecondary },
  toggle: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 8 },
  opt: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 8, padding: "9px 6px", fontSize: 12.5, fontWeight: 800, color: "#fff", cursor: "pointer" },
  optGo: { background: "rgba(47,191,154,0.22)", borderColor: "#2FBF9A" },
  optStay: { background: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.4)" },
  boardRow: { display: "flex", alignItems: "center", gap: 8, padding: "6px 4px", borderTop: `1px solid ${color.border}`, fontSize: 12 },
  boardMe: { background: "rgba(224,188,74,0.08)", borderRadius: 6 },
  boardPos: { width: 18, textAlign: "right", fontWeight: 900, color: color.goldLight },
  boardName: { flex: 1, minWidth: 0, color: color.textPrimary, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  boardMeta: { fontSize: 11, color: color.textMuted, whiteSpace: "nowrap" },
  boardStatus: { fontSize: 11, fontWeight: 800, whiteSpace: "nowrap", minWidth: 70, textAlign: "right" },
  link: { background: "none", border: "none", color: color.goldLight, fontSize: 11.5, padding: 0, marginTop: 6, cursor: "pointer" },
};
