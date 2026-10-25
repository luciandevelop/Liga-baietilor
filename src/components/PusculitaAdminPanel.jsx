import { useEffect, useMemo, useState } from "react";
import { color } from "../theme";
import { listActiveUserIds, listMatches } from "../services/adminService";
import { getUserPublicProfiles } from "../services/profilesService";
import { subscribeToLiveSnapshot } from "../services/liveSnapshotStore";
import { buildPusculitaInput, confirmRound, getPusculita, listVoted, publishPusculita, revealVote } from "../services/pusculitaGame";
import {
  computePusculita, PUSCULITA_DEFAULT_THRESHOLD_PER_MATCH, PUSCULITA_ROUNDS, validateSchedule, voteTimeAlert,
} from "../services/pusculitaService";

// ══════════════════════════════════════════════════════════════════
// 🐷 Admin — Pușculița pentru etapa curentă.
//   A. Configurare (o singură dată): ce meciuri intră în fiecare rundă,
//      pragurile, termenele voturilor → „Publică și blochează”.
//   B. În joc: starea rundelor, cine a votat, alerte de timp, dezvăluirea
//      votului. Confirmarea rundelor se face AUTOMAT la validarea
//      rezultatelor (butonul de aici e doar rezervă).
// Premiile se acordă la „Rezolvă” (Surpriza Mare), ca la celelalte jocuri.
// ══════════════════════════════════════════════════════════════════

const pad = (n) => String(n).padStart(2, "0");
const toLocalInput = (ms) => { if (!Number.isFinite(ms)) return ""; const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const fmt = (ms) => (Number.isFinite(ms) ? new Date(ms).toLocaleString("ro-RO", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
const kick = (m) => (m.kickoffAt?.toMillis ? m.kickoffAt.toMillis() : NaN);

export default function PusculitaAdminPanel({ gameweekId }) {
  const [game, setGame] = useState(undefined);
  const [matches, setMatches] = useState([]);
  const [live, setLive] = useState(null);
  const [names, setNames] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [tick, setTick] = useState(0);
  const reload = () => setTick((x) => x + 1);

  useEffect(() => { getPusculita(gameweekId).then(setGame).catch((e) => { setGame(null); setMsg(`Eroare la citire: ${e.message}`); }); }, [gameweekId, tick]);
  useEffect(() => { listMatches(gameweekId).then((ms) => setMatches([...ms].sort((a, b) => kick(a) - kick(b)))).catch(() => {}); }, [gameweekId]);
  useEffect(() => subscribeToLiveSnapshot(gameweekId, (d) => setLive(d?.pusculita || null)), [gameweekId]);
  useEffect(() => {
    const uids = game?.participants;
    if (uids?.length) getUserPublicProfiles(uids).then(setNames).catch(() => {});
  }, [game?.participants?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (game === undefined) return <p style={st.hint}>Se încarcă Pușculița…</p>;
  return (
    <div style={st.box}>
      <div style={st.title}>🐷 Pușculița</div>
      {!game?.published
        ? <Configurator gameweekId={gameweekId} matches={matches} busy={busy} setBusy={setBusy} setMsg={setMsg} onDone={reload} />
        : <Running gameweekId={gameweekId} game={game} live={live} names={names} busy={busy} setBusy={setBusy} setMsg={setMsg} onChange={reload} tick={tick} />}
      {msg && <p style={st.msg}>{msg}</p>}
    </div>
  );
}

// ── A. Configurare ──
function Configurator({ gameweekId, matches, busy, setBusy, setMsg, onDone }) {
  const [assign, setAssign] = useState({});        // matchId -> round index
  const [thresholds, setThresholds] = useState({}); // round -> număr (gol = implicit)
  const [deadlines, setDeadlines] = useState({});   // round -> "yyyy-mm-ddThh:mm"

  // Implicit: meciurile, în ordinea orei de start, împărțite în 4 grupe egale.
  useEffect(() => {
    if (!matches.length) return;
    const a = {}; const per = matches.length / PUSCULITA_ROUNDS;
    matches.forEach((m, i) => { a[m.id] = Math.min(PUSCULITA_ROUNDS - 1, Math.floor(i / per)); });
    setAssign(a);
  }, [matches]);

  const rounds = useMemo(() => Array.from({ length: PUSCULITA_ROUNDS }, (_, k) => {
    const ms = matches.filter((m) => assign[m.id] === k);
    const kickoffs = ms.map(kick).filter(Number.isFinite);
    return { k, matches: ms, matchIds: ms.map((m) => m.id), kickoffs };
  }), [matches, assign]);

  // Termen implicit: cu 2 ore înaintea primului meci din runda următoare.
  const deadlineMs = (k) => {
    if (k >= PUSCULITA_ROUNDS - 1) return null;
    if (deadlines[k]) return new Date(deadlines[k]).getTime();
    const next = rounds[k + 1]?.kickoffs; return next?.length ? Math.min(...next) - 2 * 3600e3 : null;
  };
  const thresholdOf = (k) => (thresholds[k] !== undefined && thresholds[k] !== "" ? Number(thresholds[k]) : PUSCULITA_DEFAULT_THRESHOLD_PER_MATCH[k] * rounds[k].matchIds.length);
  const check = validateSchedule(rounds.map((r) => ({ kickoffs: r.kickoffs, voteDeadline: deadlineMs(r.k) })));

  async function publish() {
    if (!window.confirm("Publici Pușculița? Configurația se blochează și nu mai poate fi modificată.")) return;
    setBusy(true); setMsg("");
    try {
      const participants = [...(await listActiveUserIds())];
      await publishPusculita(gameweekId, {
        participants,
        rounds: rounds.map((r) => ({ matchIds: r.matchIds, threshold: thresholdOf(r.k), voteDeadlineMs: deadlineMs(r.k) })),
      });
      setMsg(`Publicată pentru ${participants.length} jucători. Acum poți dezvălui Surpriza Mare.`);
      onDone();
    } catch (e) { setMsg(`Nu s-a putut publica: ${e.message || e.code}`); }
    setBusy(false);
  }

  if (!matches.length) return <p style={st.hint}>Etapa nu are încă meciuri.</p>;
  return (
    <div>
      <p style={st.hint}>Alege runda fiecărui meci, verifică pragurile și termenele voturilor, apoi publică. După publicare nu se mai poate modifica.</p>
      {rounds.map((r) => (
        <div key={r.k} style={st.round}>
          <div style={st.roundHead}>
            <b>Runda {r.k + 1}</b>
            <span style={st.meta}>{r.matchIds.length} meciuri</span>
          </div>
          {r.matches.map((m) => (
            <div key={m.id} style={st.matchRow}>
              <span style={st.matchTime}>{fmt(kick(m))}</span>
              <span style={st.matchName}>{m.homeTeam} – {m.awayTeam}</span>
              <select style={st.select} value={assign[m.id]} onChange={(e) => setAssign((x) => ({ ...x, [m.id]: Number(e.target.value) }))}>
                {[0, 1, 2, 3].map((i) => <option key={i} value={i}>R{i + 1}</option>)}
              </select>
            </div>
          ))}
          <label style={st.field}>
            Prag (puncte în rundă)
            <input type="number" inputMode="numeric" style={st.input} value={thresholds[r.k] ?? ""} placeholder={String(PUSCULITA_DEFAULT_THRESHOLD_PER_MATCH[r.k] * r.matchIds.length)} onChange={(e) => setThresholds((x) => ({ ...x, [r.k]: e.target.value }))} />
          </label>
          {r.k < PUSCULITA_ROUNDS - 1 && (
            <label style={st.field}>
              Termenul votului de după rundă
              <input type="datetime-local" style={st.input} value={deadlines[r.k] || toLocalInput(deadlineMs(r.k))} onChange={(e) => setDeadlines((x) => ({ ...x, [r.k]: e.target.value }))} />
            </label>
          )}
        </div>
      ))}
      {check.errors.map((e) => <p key={e} style={st.err}>⛔ {e}</p>)}
      {check.warnings.map((w) => <p key={w} style={st.warn}>⚠️ {w}</p>)}
      <button type="button" style={st.btnGold} onClick={publish} disabled={busy || !check.ok}>🔒 Publică și blochează</button>
    </div>
  );
}

// ── B. În joc ──
function Running({ gameweekId, game, live, names, busy, setBusy, setMsg, onChange, tick }) {
  const [voted, setVoted] = useState({});
  const input = buildPusculitaInput(game, live);
  const res = computePusculita(input);
  const now = Date.now();
  const name = (u) => names[u]?.nickname || u;

  useEffect(() => {
    const open = [0, 1, 2].filter((k) => game.voteOpen?.[`r${k}`]);
    Promise.all(open.map((k) => listVoted(gameweekId, k).then((v) => [k, v]))).then((pairs) => setVoted(Object.fromEntries(pairs))).catch(() => {});
  }, [gameweekId, game, tick]);

  async function doConfirm(k) {
    const t = res.timeline[k];
    if (!t?.complete) { setMsg("Runda nu e complet validată."); return; }
    setBusy(true);
    try { await confirmRound(gameweekId, k, t.survivors, t.survivors.length >= 3); onChange(); setMsg(`Runda ${k + 1} confirmată.`); } catch (e) { setMsg(e.message); }
    setBusy(false);
  }
  async function doReveal(k) {
    if (!window.confirm(`Dezvălui votul de după runda ${k + 1}? Votul se închide definitiv.`)) return;
    setBusy(true);
    try { const r = await revealVote(gameweekId, k); onChange(); setMsg(`Vot dezvăluit (${Object.keys(r).length} voturi).`); } catch (e) { setMsg(`Dezvăluirea a eșuat: ${e.message || e.code}`); }
    setBusy(false);
  }

  return (
    <div>
      {game.rounds.map((r, k) => {
        const t = res.timeline[k];
        const validated = live?.validated?.[`r${k}`] ?? 0;
        const alive = game.alive?.[`r${k}`];
        const open = !!game.voteOpen?.[`r${k}`];
        const revealed = !!game.voteRevealed?.[`r${k}`];
        const dl = r.voteDeadline?.toMillis ? r.voteDeadline.toMillis() : null;
        const v = voted[k] || [];
        const missing = (alive || []).filter((u) => !v.includes(u));
        const alert = open ? voteTimeAlert({ validatedAt: now, voteDeadline: dl, now }) : null;
        const canReveal = open && ((dl && now >= dl) || (alive && missing.length === 0));
        return (
          <div key={k} style={st.round}>
            <div style={st.roundHead}><b>Runda {k + 1}</b><span style={st.meta}>{validated}/{r.matchIds.length} validate · prag {r.threshold}</span></div>
            {t?.complete && <p style={st.line}>Eliminați: {t.eliminated.length} · Rămân: {t.survivors.length}</p>}
            {k < PUSCULITA_ROUNDS - 1 && (
              <>
                <p style={st.line}>Vot: {revealed ? "dezvăluit" : open ? `deschis · ${v.length}/${(alive || []).length} au votat · termen ${fmt(dl)}` : alive ? "nu e cazul" : `se deschide automat după validarea rundei · termen ${fmt(dl)}`}</p>
                {alert && <p style={alert.level === "critical" ? st.err : st.warn}>⚠️ {alert.message}</p>}
                <div style={st.row}>
                  {t?.complete && !alive && <button type="button" style={st.btn} onClick={() => doConfirm(k)} disabled={busy}>Confirmă runda</button>}
                  {open && <button type="button" style={st.btnGold} onClick={() => doReveal(k)} disabled={busy || !canReveal}>Dezvăluie votul</button>}
                  {open && missing.length > 0 && (
                    <button type="button" style={st.btn} onClick={() => { try { navigator.clipboard?.writeText(`🐷 Pușculița — votul după runda ${k + 1} se închide ${fmt(dl)}. Încă n-au votat: ${missing.map(name).join(", ")}. Cine nu votează e trecut automat la STOP.`); setMsg("Mesaj copiat."); } catch { /* */ } }}>Copiază mesaj nevotanți</button>
                  )}
                </div>
                {open && !canReveal && <p style={st.hint}>Dezvăluirea se poate face după termen sau mai devreme, dacă au votat toți.</p>}
              </>
            )}
          </div>
        );
      })}
      <div style={st.round}>
        <b>Stare</b>
        <p style={st.line}>
          {res.outcome.status === "ended"
            ? `Joc încheiat (${{ stop: "STOP", final: "finala", zero_survivors: "niciun supraviețuitor", one_survivor: "un supraviețuitor", two_survivors: "doi supraviețuitori" }[res.outcome.reason] || res.outcome.reason}). Premiile se acordă la „Rezolvă” (Surpriza Mare).`
            : "În desfășurare."}
        </p>
        {res.outcome.status === "ended" && Object.entries(res.prizesByUid).filter(([, p]) => p > 0).map(([u, p]) => <p key={u} style={st.line}>{name(u)}: +{p}</p>)}
      </div>
    </div>
  );
}

const st = {
  box: { marginTop: 10, padding: 10, background: color.surfaceInset, borderRadius: 8 },
  title: { fontWeight: 800, fontSize: 14, color: color.textPrimary, marginBottom: 6 },
  hint: { fontSize: 11.5, color: color.textMuted, lineHeight: 1.5, margin: "4px 0 8px" },
  msg: { fontSize: 12, color: color.goldLight, marginTop: 8 },
  err: { fontSize: 12, color: "#ff6b6b", margin: "4px 0" },
  warn: { fontSize: 12, color: color.goldLight, margin: "4px 0" },
  round: { border: `1px solid ${color.border}`, borderRadius: 8, padding: 8, marginBottom: 8 },
  roundHead: { display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 13, color: color.textPrimary, marginBottom: 4 },
  meta: { fontSize: 11, color: color.textMuted },
  line: { fontSize: 12, color: color.textSecondary, margin: "3px 0" },
  matchRow: { display: "flex", alignItems: "center", gap: 6, padding: "3px 0", borderTop: `1px solid ${color.border}` },
  matchTime: { fontSize: 10.5, color: color.textMuted, minWidth: 92 },
  matchName: { flex: 1, minWidth: 0, fontSize: 12, color: color.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  select: { background: color.surface, color: color.textPrimary, border: `1px solid ${color.border}`, borderRadius: 6, padding: "4px 6px", fontSize: 12 },
  field: { display: "flex", flexDirection: "column", gap: 3, fontSize: 11.5, color: color.textSecondary, marginTop: 6 },
  input: { background: color.surface, color: color.textPrimary, border: `1px solid ${color.border}`, borderRadius: 6, padding: "6px 8px", fontSize: 13 },
  row: { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 },
  btn: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, padding: "7px 10px", fontSize: 12, fontWeight: 700, color: "#fff", cursor: "pointer" },
  btnGold: { background: color.goldGradient, border: "none", borderRadius: 6, padding: "8px 12px", fontSize: 12, fontWeight: 800, color: color.goldOn, cursor: "pointer", marginTop: 6 },
};
