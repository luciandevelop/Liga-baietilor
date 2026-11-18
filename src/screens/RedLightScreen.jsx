import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { color, font } from "../theme";
import { subscribeToGameweekMatches } from "../services/matchesStore";
import { loadUserPredictions } from "../services/predictionsService";
import { getUserPublicProfiles } from "../services/profilesService";
import { getAvatarUrl, isS3Avatar, useS3AvatarsReady } from "../assets/avatars";
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
const left = (ms) => { if (!(ms > 0)) return "acum"; const m = Math.round(ms / 60000); if (m < 60) return `${m} min`; const h = Math.floor(m / 60); if (h < 24) return `${h}h ${m % 60}m`; return `${Math.floor(h / 24)}z ${h % 24}h`; };
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
  const [predTick, setPredTick] = useState(0);
  useEffect(() => {
    const again = () => { if (document.visibilityState === "visible") setPredTick((x) => x + 1); };
    document.addEventListener("visibilitychange", again); window.addEventListener("focus", again);
    return () => { document.removeEventListener("visibilitychange", again); window.removeEventListener("focus", again); };
  }, []);
  useEffect(() => {
    if (!game || !isParticipant || !openIdsSig) return;
    loadUserPredictions(uid, openIdsSig.split(",")).then(setPreds).catch(() => {});
  }, [game, uid, openIdsSig, predTick]); // eslint-disable-line react-hooks/exhaustive-deps

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
  useEffect(() => { if (game?.participants?.length) getUserPublicProfiles(game.participants).then(setNames).catch(() => {}); }, [game]);
  useS3AvatarsReady();
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

  // ── Semaforul din antet: VERDE = poți alege · ROȘU = păpușa se uită (ai risc în joc / totul e blocat) ──
  const nextLock = nextIdx >= 0 ? lockOf(order[nextIdx]) : null;
  const light = out ? (me.status === RL_STATUS.ELIMINATED ? "red" : "gold")
    : me.pendingRisks > 0 ? "red" : nextIdx >= 0 ? "green" : "red";
  const lightTitle = out ? statusText
    : me.pendingRisks > 0 ? "LUMINĂ ROȘIE" : nextIdx >= 0 ? "LUMINĂ VERDE" : "LUMINĂ ROȘIE";
  const lightSub = out ? (me.status === RL_STATUS.FINISHER ? "Ai trecut linia. 200 PCT sunt ai tăi." : me.status === RL_STATUS.SAFE ? `Păstrezi ${me.pct} PCT.` : me.status === RL_STATUS.ELIMINATED ? "Prins a 3-a oară. Ieși din joc." : "Aștepți validarea meciurilor deja blocate.")
    : me.pendingRisks > 0 ? `Păpușa se uită: ai ${me.pendingRisks} ${me.pendingRisks === 1 ? "meci" : "meciuri"} cu AVANSEZ în desfășurare.`
    : nextIdx >= 0 ? `Poți alege. Următoarea blocare în ${left(nextLock - now)} (${m0(byId[order[nextIdx]])}).` : "Toate meciurile sunt blocate. Aștepți rezultatele.";
  const lives = RL_MAX_STRIKES - Math.min(RL_MAX_STRIKES, me.strikes);
  const canKeep = pointsForSteps(me.steps) > 0;

  return (
    <div style={st.wrap}>
      <style>{`@keyframes rlPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.55;transform:scale(.9)}}@keyframes rlWalk{0%,100%{margin-top:0}50%{margin-top:-3px}}@keyframes rlScan{0%{left:-34%}100%{left:100%}}@keyframes rlGlow{0%,100%{box-shadow:0 0 0 0 rgba(47,191,154,.0)}50%{box-shadow:0 0 18px 2px rgba(47,191,154,.35)}}`}</style>

      {/* ── ANTET: semafor + păpușă (imagine opțională din public/redlight/doll.png) ── */}
      <div style={{ ...st.hero, ...(light === "green" ? st.heroGreen : light === "gold" ? st.heroGold : st.heroRed) }}>
        <div style={st.shapes} aria-hidden>○ △ □</div>
        <div style={st.heroRow}>
          <div style={st.lamp}>
            <span style={{ ...st.bulb, background: light === "red" ? "#ff2a43" : "#3a1018", boxShadow: light === "red" ? "0 0 18px #ff2a43" : "none", animation: light === "red" ? "rlPulse 1.4s infinite" : "none" }} />
            <span style={{ ...st.bulb, background: light === "green" ? "#2cff9a" : "#0f2a1f", boxShadow: light === "green" ? "0 0 18px #2cff9a" : "none", animation: light === "green" ? "rlPulse 1.8s infinite" : "none" }} />
          </div>
          <div style={st.heroText}>
            <div style={{ ...st.heroTitle, color: light === "green" ? "#7dffbd" : light === "gold" ? "#F5C451" : "#ff5a6a" }}>{lightTitle}</div>
            <div style={st.heroSub}>{lightSub}</div>
          </div>
          <img src="/redlight/doll.png" alt="" style={st.dollImg} onError={(e) => { e.currentTarget.style.display = "none"; }} />
        </div>

        <Arena light={light} rows={board?.rows?.length ? board.rows : game.participants.map((u) => ({ uid: u, steps: 0, strikes: 0, status: RL_STATUS.ACTIVE }))} names={names} me={uid} />

        {/* pista: 14 pași, pragurile de puncte, tu pe traseu */}
        <div style={st.track}>
          {Array.from({ length: RL_FINISH_STEPS }, (_, k) => {
            const s = k + 1; const done = s <= me.steps; const pts = RL_POINTS_TABLE[s];
            return (
              <div key={s} style={st.cellWrap}>
                <div style={{ ...st.cell, background: done ? (s >= 7 ? "linear-gradient(180deg,#F5C451,#c99a2e)" : "linear-gradient(180deg,#2FBF9A,#1f8c70)") : "rgba(255,255,255,0.07)", borderLeft: s === 7 ? "2px solid #F5C451" : "none" }}>
                  {s === me.steps && <span style={st.me}>TU</span>}
                </div>
                <div style={{ ...st.cellLbl, color: s >= 7 ? "#F5C451" : "rgba(255,255,255,0.3)" }}>{s === RL_FINISH_STEPS ? "🏁" : pts ? pts : s}</div>
              </div>
            );
          })}
        </div>
        <div style={st.trackLegend}><span>START</span><span style={{ color: "#F5C451" }}>de la 7 pași = PCT</span><span>FINISH 200</span></div>

        <div style={st.stats}>
          <div style={st.stat}><div style={st.big}>{me.steps}<span style={st.of}>/{RL_FINISH_STEPS}</span></div><div style={st.lbl}>pași</div></div>
          <div style={st.stat}><div style={{ ...st.big, letterSpacing: 3 }}>{Array.from({ length: RL_MAX_STRIKES }, (_, k) => <span key={k} style={{ color: k < lives ? "#ff4057" : "rgba(255,255,255,0.18)" }}>♥</span>)}</div><div style={st.lbl}>vieți</div></div>
          <div style={st.stat}><div style={{ ...st.big, color: color.goldLight }}>{me.pct}</div><div style={st.lbl}>PCT acum</div></div>
        </div>

        {!mine.result.resolvedAll && mine.result.processed < order.length && Number.isFinite(lockOf(order[mine.result.processed])) && now >= lockOf(order[mine.result.processed]) && (
          <p style={st.hint}>⏳ Se așteaptă validarea meciului #{mine.result.processed + 1}.</p>
        )}
        {me.status === RL_STATUS.ACTIVE && !me.stopRequested && (canKeep ? (
          <>
            <button type="button" style={{ ...st.stopBtn, opacity: me.canStop ? 1 : 0.45 }} disabled={!me.canStop || busyId === "stop"} onClick={doStop}>
              🛑 MĂ OPRESC · păstrez {pointsForSteps(me.steps)} PCT
            </button>
            {!me.canStop && me.pendingRisks > 0 && <p style={st.hint}>Disponibil după validarea celor {me.pendingRisks} meciuri pe care ai ales AVANSEZ și care sunt deja blocate.</p>}
          </>
        ) : <p style={st.hint}>🛑 MĂ OPRESC apare de la 7 pași ({RL_POINTS_TABLE[7]} PCT), când ai ce păstra.</p>)}
        {msg && <p style={st.msg}>{msg}</p>}
      </div>

      {/* ── Ultimul Red Light Show (replay) ── */}
      {lastShow && (
        <button type="button" style={{ ...st.showBtn, opacity: lastShow.invalid ? 0.5 : 1 }} disabled={lastShow.invalid} onClick={() => setWatching(true)}>
          <span style={st.showIcon}>🎬</span>
          <span style={{ textAlign: "left" }}><b>RED LIGHT SHOW</b><br /><small style={{ opacity: 0.75 }}>meciurile {lastShow.fromIndex + 1}–{lastShow.toIndex}{lastShow.invalid ? " · în curs de actualizare" : " · apasă să vezi cine a fost prins"}</small></span>
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
          <div style={st.head}><span style={st.sectionT}>🏁 CLASAMENT</span><span style={{ ...st.meta, marginLeft: "auto" }}>{board.processed}/{board.total} meciuri</span></div>
          {[...board.rows].sort((a, b) => (b.pct - a.pct) || (b.steps - a.steps) || (a.strikes - b.strikes)).map((r, k) => (
            <div key={r.uid} style={{ ...st.boardRow, ...(r.uid === uid ? st.boardMe : {}), opacity: r.status === RL_STATUS.ELIMINATED ? 0.55 : 1 }}>
              <span style={st.boardPos}>{k + 1}</span>
              <span style={st.boardName}>{names[r.uid]?.nickname || "…"}</span>
              <span style={st.boardMeta}>{r.steps}/{RL_FINISH_STEPS} · {Array.from({ length: RL_MAX_STRIKES }, (_, j) => <span key={j} style={{ color: j < RL_MAX_STRIKES - r.strikes ? "#ff4057" : "rgba(255,255,255,0.2)" }}>♥</span>)}</span>
              <span style={{ ...st.boardStatus, color: BOARD_COLOR[r.status] }}>{BOARD_LABEL[r.status]}{r.status !== RL_STATUS.ELIMINATED ? ` · ${r.pct}` : ""}</span>
            </div>
          ))}
        </div>
      )}

      <div style={st.sectionT}>🚦 CELE {order.length} MECIURI · alege la fiecare</div>

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
        const oc = ev ? OUTCOME_LABEL[ev.outcome] : null;
        const tone = ev ? (ev.outcome === RL_OUTCOME.WRONG ? st.cardRed : (ev.outcome === RL_OUTCOME.EXACT || ev.outcome === RL_OUTCOME.CORRECT) ? st.cardGreen : st.cardDim)
          : locked ? (adv ? st.cardRisk : st.cardDim) : adv ? st.cardGo : isNext ? st.cardNext : {};
        return (
          <div key={id} style={{ ...st.card, ...tone }}>
            <div style={st.head}>
              <span style={st.num}>{String(i + 1).padStart(2, "0")}</span>
              <span style={st.teams}>{m.homeTeam} – {m.awayTeam}</span>
              {locked && !ev && <span style={st.lockChip}>🔒</span>}
            </div>
            <div style={st.meta}>
              {day(kick(m))} · {hm(kick(m))} · {locked ? "blocat" : isNext ? <b style={{ color: "#7dffbd" }}>se blochează în {left(lockAt - now)}</b> : `se blochează la ${hm(lockAt)}`}
              {hasPred ? <> · pronostic <b style={{ color: "#fff" }}>{preds[id].scoreA}-{preds[id].scoreB}</b></> : ""}
            </div>
            {ev ? (
              <div style={{ ...st.result, color: oc?.c, borderColor: oc?.c }}>{oc?.t}</div>
            ) : locked ? (
              <div style={{ ...st.result, ...(adv ? { color: "#ff8a98", borderColor: "rgba(255,64,87,.5)" } : {}) }}>
                {adv ? <><span style={{ ...st.dot, background: "#ff2a43", animation: "rlPulse 1.2s infinite" }} /> AVANSEZ · păpușa se uită, aștepți rezultatul</> : "⚪ Stai pe loc la acest meci"}
              </div>
            ) : (
              <>
                {!hasPred && !out ? (
                  <div style={st.noPred}>✏️ <span><b>Fără pronostic</b> — pune-l în <b>Pronosticuri</b>, apoi revino aici ca să poți alege AVANSEZ. Până atunci stai pe loc.</span></div>
                ) : (
                  <div style={st.toggle}>
                    <button type="button" style={{ ...st.opt, ...(adv ? st.optGo : {}) }} disabled={!canEdit || adv} onClick={() => toggle(id, true)}>
                      <span style={{ ...st.dot, background: "#2cff9a", boxShadow: adv ? "0 0 10px #2cff9a" : "none" }} /> {adv ? "✓ AVANSEZ" : "AVANSEZ"}
                    </button>
                    <button type="button" style={{ ...st.opt, ...(!adv ? st.optStay : {}) }} disabled={!canEdit || !adv} onClick={() => toggle(id, false)}>
                      <span style={{ ...st.dot, background: "#e8edf5" }} /> {!adv ? "✓ STAU" : "STAU"}
                    </button>
                  </div>
                )}
                {busyId === id && <p style={st.hint}>Se salvează…</p>}
                {adv && hasPred && <p style={st.risk}>Mergi pe <b>{preds[id].scoreA}-{preds[id].scoreB}</b>: ⭐ scor exact +2 pași · ✅ 1X2 +1 pas · ❌ greșit −1 ♥</p>}
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

// ── TERENUL din antet: nisip, zid, linia de puncte (7 pași) și FINISH; fiecare jucător (avatarul lui)
// stă pe pasul lui. VERDE = jucătorii „merg” · ROȘU = o rază de scanare mătură terenul.
// Imaginea păpușii e OPȚIONALĂ: public/redlight/doll.png (pusă de Admin) — fără ea apare doar FINISH.
function Arena({ light, rows, names, me }) {
  const n = Math.max(1, rows.length); const H = 190; const top = 34; const bottom = 18;
  const yOf = (s) => H - bottom - ((H - top - bottom) * Math.min(RL_FINISH_STEPS, s)) / RL_FINISH_STEPS;
  const sorted = [...rows].sort((a, b) => (a.uid === me) - (b.uid === me)); // „tu” desenat ultimul, deasupra
  const lane = Object.fromEntries(rows.map((r, i) => [r.uid, i]));
  return (
    <div style={{ ...ar.box, height: H }}>
      <div style={ar.wall} />
      <div style={ar.sand} />
      {[7, RL_FINISH_STEPS].map((s) => (
        <div key={s} style={{ ...ar.line, top: yOf(s), borderTop: s === RL_FINISH_STEPS ? "3px solid #ff2a43" : "2px dashed rgba(201,154,46,.9)" }}>
          <span style={{ ...ar.lineLbl, color: s === RL_FINISH_STEPS ? "#ff2a43" : "#8a6414" }}>{s === RL_FINISH_STEPS ? "FINISH · 200" : `${s} PAȘI · ${RL_POINTS_TABLE[s]} PCT`}</span>
        </div>
      ))}
      <img src="/redlight/doll.png" alt="" style={ar.doll} onError={(e) => { e.currentTarget.style.display = "none"; }} />
      {sorted.map((r) => {
        const p = names[r.uid] || {}; const url = getAvatarUrl(p.avatarId); const isMe = r.uid === me;
        const dead = r.status === RL_STATUS.ELIMINATED; const fin = r.status === RL_STATUS.FINISHER; const safe = r.status === RL_STATUS.SAFE;
        const ring = isMe ? "#F5C451" : dead ? "#555" : fin ? "#F5C451" : safe ? "#5dffd2" : "#2FBF9A";
        const size = isMe ? 26 : 20; const x = ((lane[r.uid] + 0.5) / n) * 100; const y = yOf(r.steps);
        return (
          <div key={r.uid} style={{ ...ar.pl, left: `${x}%`, top: y - size / 2, zIndex: isMe ? 3 : 2, animation: light === "green" && !dead ? `rlWalk ${0.9 + (lane[r.uid] % 5) * 0.12}s ease-in-out infinite` : "none", opacity: dead ? 0.45 : 1 }}>
            {url ? <img alt="" src={url} style={{ ...ar.av, width: size, height: size, borderColor: ring, objectPosition: isS3Avatar(p.avatarId) ? "50% 22%" : "50% 50%", filter: dead ? "grayscale(1)" : "none" }} />
              : <span style={{ ...ar.av, width: size, height: size, borderColor: ring, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.42, fontWeight: 900, color: "#fff" }}>{(p.nickname || "?").charAt(0)}</span>}
            {dead && <span style={ar.x}>✕</span>}
            {isMe && <span style={ar.tu}>TU</span>}
          </div>
        );
      })}
      {light === "red" && <div style={ar.scan} />}
      <div style={{ ...ar.tint, background: light === "red" ? "rgba(255,30,50,.13)" : light === "green" ? "rgba(44,255,154,.06)" : "transparent" }} />
      <div style={ar.start}>START</div>
    </div>
  );
}
const ar = {
  box: { position: "relative", overflow: "hidden", borderRadius: 12, marginTop: 12, border: "1px solid rgba(255,255,255,0.12)" },
  wall: { position: "absolute", left: 0, right: 0, top: 0, height: 26, background: "linear-gradient(180deg,#f1e6d2,#d9c7a6)", borderBottom: "2px solid #b89c6e" },
  sand: { position: "absolute", left: 0, right: 0, top: 26, bottom: 0, background: "repeating-linear-gradient(90deg,rgba(0,0,0,.025) 0 2px,transparent 2px 9px), linear-gradient(180deg,#e9d4a3,#d2b47a)" },
  line: { position: "absolute", left: 0, right: 0, height: 0 },
  lineLbl: { position: "absolute", left: 6, top: -14, fontSize: 9, fontWeight: 900, letterSpacing: ".06em" },
  doll: { position: "absolute", left: "50%", top: 0, height: 44, transform: "translateX(-50%)", zIndex: 1, filter: "drop-shadow(0 3px 4px rgba(0,0,0,.5))" },
  pl: { position: "absolute", transform: "translateX(-50%)", transition: "top 1s ease" },
  av: { display: "block", borderRadius: "50%", border: "2px solid", objectFit: "cover", background: "#1d4a3c", boxSizing: "border-box", boxShadow: "0 2px 5px rgba(0,0,0,.45)" },
  x: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#ff2a43", fontWeight: 900, fontSize: 16 },
  tu: { position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", fontSize: 8.5, fontWeight: 900, color: "#0b0f18", background: "#F5C451", borderRadius: 4, padding: "0 4px", whiteSpace: "nowrap" },
  scan: { position: "absolute", top: 26, bottom: 0, width: "34%", background: "linear-gradient(90deg,transparent,rgba(255,40,60,.35),transparent)", animation: "rlScan 2.6s ease-in-out infinite alternate", zIndex: 4, pointerEvents: "none" },
  tint: { position: "absolute", inset: 0, pointerEvents: "none", zIndex: 4 },
  start: { position: "absolute", left: 0, right: 0, bottom: 0, height: 14, background: "rgba(255,255,255,.55)", color: "#6b5326", fontSize: 9, fontWeight: 900, letterSpacing: ".3em", textAlign: "center", lineHeight: "14px" },
};

const m0 = (m) => (m ? `${m.homeTeam} – ${m.awayTeam}` : "");
const D = font.display; const B = font.body;
const st = {
  wrap: { display: "flex", flexDirection: "column", gap: 8, marginTop: 8, fontFamily: B },
  hero: { position: "relative", overflow: "hidden", borderRadius: 16, padding: 12, border: "1px solid rgba(255,255,255,0.12)" },
  heroGreen: { background: "radial-gradient(120% 90% at 0% 0%, rgba(44,255,154,0.18), transparent 60%), linear-gradient(180deg,#0e1a17,#0b0f18)", borderColor: "rgba(44,255,154,0.35)" },
  heroRed: { background: "radial-gradient(120% 90% at 0% 0%, rgba(255,42,67,0.22), transparent 60%), linear-gradient(180deg,#1a0d12,#0b0f18)", borderColor: "rgba(255,42,67,0.4)" },
  heroGold: { background: "radial-gradient(120% 90% at 0% 0%, rgba(245,196,81,0.2), transparent 60%), linear-gradient(180deg,#1a160d,#0b0f18)", borderColor: "rgba(245,196,81,0.4)" },
  shapes: { position: "absolute", right: 10, bottom: 6, fontSize: 40, letterSpacing: 6, color: "rgba(255,255,255,0.04)", fontWeight: 900, pointerEvents: "none" },
  heroRow: { display: "flex", alignItems: "center", gap: 12 },
  lamp: { display: "flex", flexDirection: "column", gap: 6, background: "#07090d", border: "1px solid #2a2f3a", borderRadius: 14, padding: "7px 6px", flexShrink: 0 },
  bulb: { width: 22, height: 22, borderRadius: "50%", display: "block" },
  heroText: { flex: 1, minWidth: 0 },
  heroTitle: { fontFamily: D, fontSize: 24, fontWeight: 700, letterSpacing: ".06em", lineHeight: 1.05 },
  heroSub: { fontSize: 12, color: "#c9cfdd", marginTop: 4, lineHeight: 1.35 },
  dollImg: { width: 64, height: 80, objectFit: "contain", flexShrink: 0, filter: "drop-shadow(0 4px 10px rgba(0,0,0,.6))" },
  track: { display: "flex", gap: 2, marginTop: 14 },
  cellWrap: { flex: 1, minWidth: 0, textAlign: "center" },
  cell: { position: "relative", height: 16, borderRadius: 3 },
  me: { position: "absolute", top: -17, left: "50%", transform: "translateX(-50%)", fontSize: 9, fontWeight: 900, color: "#0b0f18", background: "#fff", borderRadius: 4, padding: "1px 4px", whiteSpace: "nowrap" },
  cellLbl: { fontSize: 8.5, fontWeight: 800, marginTop: 3, fontFamily: D },
  trackLegend: { display: "flex", justifyContent: "space-between", fontSize: 9.5, color: "rgba(255,255,255,0.45)", marginTop: 2, letterSpacing: ".04em" },
  stats: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginTop: 10, background: "rgba(0,0,0,0.25)", borderRadius: 12, padding: "8px 4px" },
  stat: { textAlign: "center" },
  big: { fontFamily: D, fontSize: 24, fontWeight: 700, color: "#fff", lineHeight: 1.1 },
  of: { fontSize: 13, color: color.textMuted, fontWeight: 700 },
  lbl: { fontSize: 10, color: color.textMuted, marginTop: 2, textTransform: "uppercase", letterSpacing: ".08em" },
  hint: { fontSize: 11.5, color: color.textMuted, lineHeight: 1.45, margin: "6px 0 0" },
  msg: { fontSize: 12, color: color.goldLight, margin: "6px 0 0" },
  stopBtn: { width: "100%", marginTop: 10, background: "transparent", border: "1.5px solid #ff4057", borderRadius: 10, padding: "9px 12px", fontSize: 13, fontWeight: 800, color: "#ff8a98", cursor: "pointer" },
  showBtn: { display: "flex", alignItems: "center", gap: 12, width: "100%", background: "linear-gradient(90deg,#2a0f16,#141821 70%)", border: "1px solid rgba(255,80,110,0.5)", borderRadius: 14, padding: "12px 14px", color: "#fff", fontSize: 14, cursor: "pointer", fontFamily: B },
  showIcon: { fontSize: 28 },
  sectionT: { fontFamily: D, fontSize: 14, fontWeight: 700, letterSpacing: ".1em", color: "#e8edf5", margin: "8px 2px 0" },
  card: { background: color.surface, border: `1px solid ${color.border}`, borderRadius: 14, padding: 12, transition: "border-color .2s" },
  cardNext: { borderColor: "rgba(47,191,154,0.8)", animation: "rlGlow 2.4s infinite" },
  cardGo: { borderColor: "#2FBF9A", background: "linear-gradient(180deg,rgba(47,191,154,0.12),rgba(0,0,0,0) 70%)," + color.surface },
  cardRisk: { borderColor: "rgba(255,64,87,0.6)", background: "linear-gradient(180deg,rgba(255,64,87,0.1),rgba(0,0,0,0) 70%)," + color.surface },
  cardGreen: { borderColor: "rgba(47,191,154,0.5)" },
  cardRed: { borderColor: "rgba(255,64,87,0.55)" },
  cardDim: { opacity: 0.8 },
  head: { display: "flex", gap: 10, alignItems: "center" },
  num: { fontFamily: D, fontSize: 18, fontWeight: 700, color: color.goldLight, minWidth: 24 },
  teams: { fontFamily: D, fontSize: 17, fontWeight: 700, color: color.textPrimary, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: ".02em" },
  lockChip: { marginLeft: "auto", fontSize: 13 },
  meta: { fontSize: 11.5, color: color.textMuted, marginTop: 4 },
  result: { fontSize: 13, fontWeight: 800, marginTop: 10, color: color.textSecondary, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "9px 10px", display: "flex", alignItems: "center", gap: 8 },
  toggle: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 },
  opt: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 12, padding: "12px 6px", fontFamily: D, fontSize: 16, fontWeight: 700, letterSpacing: ".06em", color: "#fff", cursor: "pointer" },
  optGo: { background: "rgba(44,255,154,0.16)", borderColor: "#2cff9a", color: "#b9ffdc" },
  optStay: { background: "rgba(255,255,255,0.1)", borderColor: "rgba(255,255,255,0.45)" },
  dot: { width: 12, height: 12, borderRadius: "50%", display: "inline-block", flexShrink: 0 },
  noPred: { display: "flex", gap: 8, alignItems: "flex-start", marginTop: 10, padding: "10px 12px", borderRadius: 12, border: "1px dashed rgba(245,196,81,.55)", background: "rgba(245,196,81,.06)", color: "#e8d9b0", fontSize: 12.5, lineHeight: 1.4 },
  risk: { fontSize: 11.5, color: "#b9ffdc", margin: "8px 0 0", lineHeight: 1.4 },
  boardRow: { display: "flex", alignItems: "center", gap: 8, padding: "7px 4px", borderTop: `1px solid ${color.border}`, fontSize: 12 },
  boardMe: { background: "rgba(224,188,74,0.08)", borderRadius: 6 },
  boardPos: { width: 18, textAlign: "right", fontFamily: D, fontWeight: 700, color: color.goldLight },
  boardName: { flex: 1, minWidth: 0, color: color.textPrimary, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  boardMeta: { fontSize: 11, color: color.textMuted, whiteSpace: "nowrap" },
  boardStatus: { fontSize: 11, fontWeight: 800, whiteSpace: "nowrap", minWidth: 70, textAlign: "right" },
  link: { background: "none", border: "none", color: color.goldLight, fontSize: 11.5, padding: 0, marginTop: 8, cursor: "pointer" },
};
