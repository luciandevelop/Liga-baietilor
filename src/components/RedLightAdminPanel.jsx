import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { color } from "../theme";
import { listActiveUserIds, listMatches, previewGameweekResults } from "../services/adminService";
import { getUserPublicProfiles } from "../services/profilesService";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import {
  cancelRedLight, defaultOrder, getRedLight, getRedLightShow, getRedLightState, publishRedLight, reapplyRedLightPrizes, runRedLightAfterValidation, startRedLightShow, validateOrder,
} from "../services/redLightService";

// Scena 3D se încarcă DOAR când se deschide show-ul (nu îngreunează aplicația).
const RedLightShow3D = lazy(() => import("./RedLightShow3D"));
import { getWeeklySurprise, resolveMain } from "../services/surprisesService";
import { RL_STATUS, lockAtFromKickoff, matchState } from "../services/redLightEngine";

// ══════════════════════════════════════════════════════════════════
// 🚦 Admin — Lumină roșie, lumină verde (ETAPA 2: configurare + control).
//   A. Configurare (o singură dată): participanții și ordinea celor 20 de
//      meciuri (cronologic; doar meciurile de la aceeași oră se pot
//      rearanja) → „Publică și blochează”.
//   B. În joc: starea oficială (salvată automat la fiecare validare),
//      cauza așteptării, schimbările importante, FINALIZEAZĂ, Re-aplică premiile.
// Show-ul 3D vine în etapa următoare.
// ══════════════════════════════════════════════════════════════════

const kick = (m) => (m?.kickoffAt?.toMillis ? m.kickoffAt.toMillis() : NaN);
const fmt = (t) => (Number.isFinite(t) ? new Date(t).toLocaleString("ro-RO", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
const STATUS_LABEL = { scheduled: "Programat", live: "Live", halftime: "Pauză", finished: "Final", postponed: "Amânat", cancelled: "Anulat" };

export default function RedLightAdminPanel({ gameweekId }) {
  const [game, setGame] = useState(undefined);
  const [matches, setMatches] = useState([]);
  const [names, setNames] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [tick, setTick] = useState(0);
  const [viewer, setViewer] = useState(null); // { demo } | { show }
  const reload = () => setTick((x) => x + 1);

  useEffect(() => { getRedLight(gameweekId).then(setGame).catch((e) => { setGame(null); setMsg(`Eroare la citire: ${e.message}`); }); }, [gameweekId, tick]);
  useEffect(() => { listMatches(gameweekId).then(setMatches).catch(() => {}); }, [gameweekId, tick]);

  if (game === undefined) return <p style={st.hint}>Se încarcă Lumină roșie…</p>;
  return (
    <div style={st.box}>
      <div style={st.title}>🚦 Lumină roșie, lumină verde</div>
      <button type="button" style={st.btn} onClick={() => setViewer({ demo: true })}>🧪 Previzualizare show (demo, 18 jucători)</button>
      {viewer && (
        <Suspense fallback={<p style={st.hint}>Se încarcă scena 3D…</p>}>
          <RedLightShow3D demo={!!viewer.demo} show={viewer.show} onClose={() => setViewer(null)} />
        </Suspense>
      )}
      {!game
        ? <Configurator gameweekId={gameweekId} matches={matches} names={names} setNames={setNames} busy={busy} setBusy={setBusy} setMsg={setMsg} onDone={reload} />
        : <Running gameweekId={gameweekId} game={game} matches={matches} names={names} setNames={setNames} busy={busy} setBusy={setBusy} setMsg={setMsg} onChange={reload} onPlay={(show) => setViewer({ show })} />}
      {msg && <p style={st.msg}>{msg}</p>}
    </div>
  );
}

// ── A. Configurare ──
function Configurator({ gameweekId, matches, names, setNames, busy, setBusy, setMsg, onDone }) {
  const [order, setOrder] = useState([]);
  const [active, setActive] = useState([]);
  const [picked, setPicked] = useState({});

  useEffect(() => { setOrder(defaultOrder(matches)); }, [matches]);
  useEffect(() => {
    listActiveUserIds().then((set) => {
      const uids = [...set]; setActive(uids); setPicked(Object.fromEntries(uids.map((u) => [u, true])));
      getUserPublicProfiles(uids).then(setNames).catch(() => {});
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const byId = useMemo(() => Object.fromEntries(matches.map((m) => [m.id, m])), [matches]);
  const check = validateOrder(order, matches);
  const participants = active.filter((u) => picked[u]);

  // Mută un meci cu o poziție, DOAR în grupul de meciuri de la aceeași oră.
  function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    if (kick(byId[order[i]]) !== kick(byId[order[j]])) return;
    const next = [...order]; [next[i], next[j]] = [next[j], next[i]]; setOrder(next);
  }

  async function publish() {
    if (!window.confirm(`Publici Lumină roșie pentru ${participants.length} participanți și ${order.length} meciuri? Ordinea și participanții nu mai pot fi modificați.`)) return;
    setBusy(true); setMsg("");
    try {
      await publishRedLight(gameweekId, { participants, order, matches });
      setMsg(`Publicat: ${participants.length} participanți, ${order.length} meciuri. Acum poți dezvălui Surpriza Mare.`);
      onDone();
    } catch (e) { setMsg(`Nu s-a putut publica: ${e.message || e.code}`); }
    setBusy(false);
  }

  if (!matches.length) return <p style={st.hint}>Etapa nu are încă meciuri.</p>;
  return (
    <div>
      <p style={st.hint}>Ordinea e cronologică. Meciurile care încep la aceeași oră (marcate ⏱) le poți rearanja cu ↑ ↓. După publicare, ordinea și participanții rămân ficși.</p>
      <div style={st.round}>
        <b style={st.sub}>Ordinea meciurilor ({order.length})</b>
        {order.map((id, i) => {
          const m = byId[id]; if (!m) return null;
          const same = (k) => order[k] && kick(byId[order[k]]) === kick(m);
          const simul = same(i - 1) || same(i + 1);
          return (
            <div key={id} style={st.matchRow}>
              <span style={st.num}>{i + 1}</span>
              <span style={st.matchTime}>{simul ? "⏱ " : ""}{fmt(kick(m))}</span>
              <span style={st.matchName}>{m.homeTeam} – {m.awayTeam}</span>
              {simul && (
                <span style={{ display: "flex", gap: 4 }}>
                  <button type="button" style={st.mini} disabled={!same(i - 1)} onClick={() => move(i, -1)}>↑</button>
                  <button type="button" style={st.mini} disabled={!same(i + 1)} onClick={() => move(i, 1)}>↓</button>
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div style={st.round}>
        <b style={st.sub}>Participanți ({participants.length}/{active.length} activi)</b>
        <div style={st.chips}>
          {active.map((u) => (
            <label key={u} style={{ ...st.chip, opacity: picked[u] ? 1 : 0.45 }}>
              <input type="checkbox" checked={!!picked[u]} onChange={(e) => setPicked((x) => ({ ...x, [u]: e.target.checked }))} />
              {names[u]?.nickname || u.slice(0, 6)}
            </label>
          ))}
        </div>
      </div>
      {check.errors.map((e) => <p key={e} style={st.err}>⛔ {e}</p>)}
      <button type="button" style={st.btnGold} onClick={publish} disabled={busy || !check.ok || participants.length < 2}>🔒 Publică și blochează</button>
    </div>
  );
}

// ── B. În joc ──
// Arată STAREA OFICIALĂ salvată (redLight/{gw}/meta/state), care se actualizează
// automat la fiecare validare/corectare de rezultat. Butoane: recalcul manual
// (rezervă), FINALIZEAZĂ (premiile, doar după rezolvarea tuturor meciurilor),
// Re-aplică premiile (doar după o corectură făcută după FINALIZEAZĂ).
function Running({ gameweekId, game, matches, names, setNames, busy, setBusy, setMsg, onChange, onPlay }) {
  const [state, setState] = useState(undefined);
  const [lastShow, setLastShow] = useState(null);
  const [pub, setPub] = useState(null);
  const [gwStatus, setGwStatus] = useState(null);
  const [tick, setTick] = useState(0);
  const byId = useMemo(() => Object.fromEntries(matches.map((m) => [m.id, m])), [matches]);
  const now = Date.now();
  const firstLock = game.firstLockAt?.toMillis ? game.firstLockAt.toMillis() : null;
  const started = firstLock !== null && now >= firstLock;
  const name = (u) => names[u]?.nickname || u.slice(0, 6);

  useEffect(() => { if (game.participants?.length) getUserPublicProfiles(game.participants).then(setNames).catch(() => {}); }, [game.participants?.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    getRedLightState(gameweekId).then(setState).catch(() => setState(null));
    getRedLightShow(gameweekId).then(setLastShow).catch(() => setLastShow(null));
    getWeeklySurprise(gameweekId).then(setPub).catch(() => setPub(null));
    getDoc(doc(db, "gameweeks", gameweekId)).then((g) => setGwStatus(g.exists() ? g.data().status : null)).catch(() => {});
  }, [gameweekId, tick]);

  async function recompute() {
    setBusy(true); setMsg("");
    try {
      const pre = await getDoc(doc(db, "gameweeks", gameweekId));
      const version = pre.exists() ? (pre.data().resultsVersion || 0) : 0;
      const gwRes = await previewGameweekResults(gameweekId);
      const m = await runRedLightAfterValidation(gameweekId, version, gwRes);
      setMsg(m || "Nimic de calculat."); setTick((x) => x + 1);
    } catch (e) { setMsg(`Calculul a eșuat: ${e.message || e.code}`); }
    setBusy(false);
  }

  async function finalize() {
    if (!window.confirm("FINALIZEAZĂ Lumină roșie? Premiile se acordă acum, din rezultatele oficiale. Corecturile ulterioare vor fi semnalate și pot fi re-aplicate cât timp etapa nu e finalizată.")) return;
    setBusy(true); setMsg("");
    try { await resolveMain(gameweekId); setMsg("✅ Premiile Lumină roșie au fost acordate."); setTick((x) => x + 1); } catch (e) { setMsg(`FINALIZEAZĂ a eșuat: ${e.message || e.code}`); }
    setBusy(false);
  }

  async function reapply() {
    if (!window.confirm("Re-aplici premiile? Se rescriu punctele Lumină roșie ale participanților, după calculul actual.")) return;
    setBusy(true); setMsg("");
    try { const n = await reapplyRedLightPrizes(gameweekId); setMsg(`✅ Premii re-aplicate (${n} modificări).`); await recompute(); } catch (e) { setMsg(`Re-aplicarea a eșuat: ${e.message || e.code}`); }
    setBusy(false);
  }

  async function startShow() {
    setBusy(true); setMsg("");
    try { const sh = await startRedLightShow(gameweekId); setLastShow(sh); onPlay(sh); } catch (e) { setMsg(`Show-ul nu a pornit: ${e.message || e.code}`); }
    setBusy(false);
  }

  async function cancel() {
    if (!window.confirm("Anulezi publicarea? Se șterg configurația, alegerile și opririle. Se poate doar înainte de primul meci blocat.")) return;
    setBusy(true);
    try { await cancelRedLight(gameweekId); setMsg("Publicarea a fost anulată."); onChange(); } catch (e) { setMsg(`Anularea a eșuat: ${e.message || e.code}`); }
    setBusy(false);
  }

  const resolved = !!pub?.mainResolved;
  let waiting = null;
  if (state && !state.resolvedAll) {
    const id = game.order[state.processed]; const m = byId[id];
    const laterValidated = game.order.slice(state.processed + 1).filter((x) => matchState(byId[x]) !== "pending").length;
    waiting = { index: state.processed, m, laterValidated };
  }
  const rows = state?.rows ? [...state.rows].sort((a, b) => (b.pct - a.pct) || (b.steps - a.steps) || (a.strikes - b.strikes)) : [];
  const advCount = (id) => (state?.choicesLocked?.[id] || []).filter((u) => game.participants.includes(u)).length;

  return (
    <div>
      <p style={st.line}>Publicat · {game.participants.length} participanți · {game.order.length} meciuri · prima blocare {fmt(firstLock)}</p>
      <div style={st.row}>
        <button type="button" style={st.btn} onClick={recompute} disabled={busy}>🔄 Recalculează și salvează</button>
        {!started && <button type="button" style={st.btn} onClick={cancel} disabled={busy}>Anulează publicarea</button>}
      </div>
      <p style={st.hint}>Starea se recalculează automat la fiecare validare sau corectare de rezultat. Butonul e doar rezervă (ex. după o oprire sau un meci marcat Amânat).</p>

      {state === undefined && <p style={st.hint}>Se încarcă starea…</p>}
      {state === null && <p style={st.hint}>Încă nu există o stare salvată — se creează la prima validare (sau apasă Recalculează).</p>}
      {state && (
        <>
          <p style={st.line}>Procesate: <b>{state.processed}/{state.total}</b> meciuri · versiunea rezultatelor {state.resultsVersion} · calculat {fmt(state.computedAtMs)}</p>
          {waiting && (
            <p style={waiting.laterValidated ? st.warn : st.line}>
              ⏳ Procesarea așteaptă meciul #{waiting.index + 1}: {waiting.m ? `${waiting.m.homeTeam} – ${waiting.m.awayTeam} (${STATUS_LABEL[waiting.m.status] || waiting.m.status || "Programat"})` : "—"}.
              {waiting.laterValidated > 0 && ` ${waiting.laterValidated} meci(uri) validate după el așteaptă. Validează-l sau marchează-l Amânat/Anulat.`}
            </p>
          )}
          {state.lastChanges?.length > 0 && (
            <p style={st.warn}>⚠️ Ultima recalculare a schimbat: {state.lastChanges.map((c) => `${name(c.uid)} ${c.from.status}→${c.to.status} (${c.from.pct}→${c.to.pct} PCT)`).join("; ")}.</p>
          )}
          {resolved && state.prizeMismatches?.length > 0 && (
            <p style={st.err}>⛔ Premiile acordate diferă de calculul actual: {state.prizeMismatches.map((x) => `${name(x.uid)} ${x.awarded ?? "—"}→${x.now}`).join("; ")}.</p>
          )}

          <div style={st.round}>
            <div style={st.thead}><span style={{ flex: 1 }}>Jucător</span><span style={st.c}>Pași</span><span style={st.c}>Greș.</span><span style={st.c}>PCT</span><span style={st.cw}>Stare</span></div>
            {rows.map((r) => (
              <div key={r.uid} style={st.trow}>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{name(r.uid)}</span>
                <span style={st.c}>{r.steps}</span>
                <span style={st.c}>{r.strikes}</span>
                <span style={st.c}>{r.pct}</span>
                <span style={{ ...st.cw, color: r.status === RL_STATUS.ELIMINATED ? "#ff6b6b" : r.status === RL_STATUS.FINISHER ? "#F5C451" : r.status === RL_STATUS.SAFE ? "#2FBF9A" : color.textSecondary }}>
                  {r.status}{r.stopRequested && r.status === RL_STATUS.ACTIVE ? " (oprire în așteptare)" : ""}
                </span>
              </div>
            ))}
          </div>

          <div style={st.round}>
            <b style={st.sub}>🎬 Red Light Show</b>
            {(() => { const from = lastShow ? lastShow.toIndex : 0; const n = Math.max(0, state.processed - from); return (
              <>
                <p style={st.hint}>{n > 0 ? `Meciuri validate neprezentate: ${n} (meciurile ${from + 1}–${state.processed}).` : "Niciun meci validat nou de prezentat."} Show-ul doar afișează evenimentele deja calculate — nu modifică puncte.</p>
                <div style={st.row}>
                  <button type="button" style={{ ...st.btnGold, opacity: n > 0 ? 1 : 0.45 }} onClick={startShow} disabled={busy || n === 0}>▶ PORNEȘTE SHOW-UL</button>
                  {lastShow && <button type="button" style={st.btn} onClick={() => onPlay(lastShow)} disabled={lastShow.invalid}>🎬 Replay ultimul show</button>}
                </div>
                {lastShow?.corrected && <p style={st.warn}>♻️ Ultimul show a fost regenerat după o corectură.</p>}
                {lastShow?.invalid && <p style={st.err}>⛔ Replay invalid: {lastShow.invalidReason}</p>}
              </>
            ); })()}
          </div>

          <div style={st.row}>
            {!resolved ? (
              <button type="button" style={{ ...st.btnGold, opacity: state.resolvedAll ? 1 : 0.45 }} onClick={finalize} disabled={busy || !state.resolvedAll || !pub?.mainRevealed}>🏁 FINALIZEAZĂ (acordă premiile)</button>
            ) : (
              <span style={st.done}>✓ Premii acordate</span>
            )}
            {resolved && state.prizeMismatches?.length > 0 && gwStatus !== "completed" && (
              <button type="button" style={st.btnGold} onClick={reapply} disabled={busy}>♻️ Re-aplică premiile</button>
            )}
          </div>
          {!resolved && !state.resolvedAll && <p style={st.hint}>FINALIZEAZĂ devine disponibil după ce toate cele {state.total} meciuri sunt validate (sau marcate Amânat/Anulat).</p>}
          {!resolved && state.resolvedAll && !pub?.mainRevealed && <p style={st.hint}>Dezvăluie mai întâi Surpriza Mare.</p>}

          <div style={st.round}>
            <b style={st.sub}>Meciuri</b>
            {game.order.map((id, i) => {
              const m = byId[id];
              const locked = m && now >= lockAtFromKickoff(kick(m));
              const known = id in (state.choicesLocked || {});
              return (
                <div key={id} style={st.matchRow}>
                  <span style={st.num}>{i + 1}</span>
                  <span style={st.matchName}>{m ? `${m.homeTeam} – ${m.awayTeam}` : id}</span>
                  <span style={st.meta}>{locked ? (known ? `🔒 ${advCount(id)} avansează` : "🔒 blocat") : "deschis"}</span>
                  <span style={st.meta}>{i < state.processed ? "✓" : STATUS_LABEL[m?.status] || ""}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

const st = {
  box: { marginTop: 10, padding: 10, background: color.surfaceInset, borderRadius: 8 },
  title: { fontWeight: 800, fontSize: 14, color: color.textPrimary, marginBottom: 6 },
  sub: { fontSize: 12.5, color: color.textPrimary },
  hint: { fontSize: 11.5, color: color.textMuted, lineHeight: 1.5, margin: "4px 0 8px" },
  msg: { fontSize: 12, color: color.goldLight, marginTop: 8 },
  err: { fontSize: 12, color: "#ff6b6b", margin: "4px 0" },
  warn: { fontSize: 12, color: color.goldLight, margin: "4px 0" },
  line: { fontSize: 12, color: color.textSecondary, margin: "4px 0" },
  round: { border: `1px solid ${color.border}`, borderRadius: 8, padding: 8, margin: "8px 0" },
  matchRow: { display: "flex", alignItems: "center", gap: 6, padding: "4px 0", borderTop: `1px solid ${color.border}` },
  num: { fontSize: 11, fontWeight: 800, color: color.goldLight, minWidth: 18, textAlign: "right" },
  matchTime: { fontSize: 10.5, color: color.textMuted, minWidth: 96 },
  matchName: { flex: 1, minWidth: 0, fontSize: 12, color: color.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  meta: { fontSize: 10.5, color: color.textMuted, whiteSpace: "nowrap" },
  mini: { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 5, color: "#fff", fontSize: 12, padding: "2px 8px", cursor: "pointer" },
  chips: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 },
  chip: { display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: color.textPrimary, background: color.surface, border: `1px solid ${color.border}`, borderRadius: 14, padding: "3px 8px" },
  row: { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 },
  thead: { display: "flex", gap: 6, fontSize: 10.5, color: color.textMuted, fontWeight: 800, paddingBottom: 4 },
  trow: { display: "flex", gap: 6, fontSize: 12, color: color.textPrimary, padding: "4px 0", borderTop: `1px solid ${color.border}` },
  c: { width: 34, textAlign: "center" },
  cw: { width: 92, textAlign: "right", fontSize: 11 },
  btn: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, padding: "7px 10px", fontSize: 12, fontWeight: 700, color: "#fff", cursor: "pointer", marginTop: 6 },
  done: { fontSize: 12, fontWeight: 800, color: "#2FBF9A", marginTop: 10 },
  btnGold: { background: color.goldGradient, border: "none", borderRadius: 6, padding: "8px 12px", fontSize: 12, fontWeight: 800, color: color.goldOn, cursor: "pointer", marginTop: 6 },
};
