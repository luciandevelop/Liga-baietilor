import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { color, font } from "../theme";
import { getUserPublicProfiles } from "../services/profilesService";
import { getSeasonNumbers, getPlayerLooks } from "../services/seasonNumbersService";
import { getAvatarUrl, isS3Avatar, useS3AvatarsReady } from "../assets/avatars";
import { getHideSeek, hasMark, listenMarks, loadPairPicks, myPairIndex, submitTurn } from "../services/hideSeekService";
import { HS_BYE_POINTS, HS_LEVELS, HS_TURN_VALUES, HS_TURNS, computeDuel } from "../services/hideSeekEngine";
import { turnCardData, computeTitles, HS_TITLES } from "../hideseek/hsCommentator";

// Scena (alegerea ușilor, show-urile, cartonașul) se încarcă doar la cerere.
import HsLoading from "../hideseek/HsLoading";
const HideSeekStage = lazy(() => import("../components/HideSeekStage"));

// ══════════════════════════════════════════════════════════════════
// 🚪 ASCUNSELEA — ecranul jucătorului. Doar indicații scurte; regulamentul complet e în „Cum se joacă”.
// ══════════════════════════════════════════════════════════════════
const pad3 = (n) => (Number.isFinite(Number(n)) && n !== null && n !== "" ? String(n).padStart(3, "0") : "—");
const VC = { A: "#19b85a", B: "#2f6fff" };
const DC = { O: "#f27aa6", T: "#3fc9a8", S: "#f2c14c" };
const left = (ms) => { if (!(ms > 0)) return "a expirat"; const m = Math.floor(ms / 60000); if (m < 60) return `${m} min`; const h = Math.floor(m / 60); if (h < 24) return `${h}h ${m % 60}m`; return `${Math.floor(h / 24)}z ${h % 24}h`; };
const when = (d) => d.toLocaleString("ro-RO", { weekday: "long", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// Alegerea adversarului e secretă până confirm și eu, dar marcajul lui e public:
// „a confirmat” contează (ex. la termen îi aduce turele rămase). Ușile nu se folosesc niciodată
// când doar unul a confirmat, deci un substitut neutru e suficient.
const SECRET = { hide: ["O", "O", "O"], seek: ["O", "O", "O"], secret: true };
function withMarks(picks, marks, pi, p) {
  const o = {}; Object.entries(picks || {}).forEach(([t, v]) => { o[t] = { A: v.A, B: v.B }; });
  if (!p) return o;
  for (let t = 1; t <= HS_TURNS; t++) {
    const mA = hasMark(marks, pi, t, p.a); const mB = hasMark(marks, pi, t, p.b);
    if (mA && mB) continue;
    if (mA && !o[t]?.A) o[t] = { ...(o[t] || {}), A: SECRET };
    if (mB && !o[t]?.B) o[t] = { ...(o[t] || {}), B: SECRET };
  }
  return o;
}

export default function HideSeekScreen({ gameweekId, uid }) {
  const [game, setGame] = useState(undefined);
  const [marks, setMarks] = useState({});
  const [players, setPlayers] = useState({});
  const [picks, setPicks] = useState({});
  const [now, setNow] = useState(Date.now());
  const [titles, setTitles] = useState(null);
  const [msg, setMsg] = useState("");
  const [show, setShow] = useState(null); // { kind, data, title, onSubmit? }
  const [openPair, setOpenPair] = useState(null);
  const [otherPicks, setOtherPicks] = useState({});
  useS3AvatarsReady();

  useEffect(() => { getHideSeek(gameweekId).then(setGame).catch(() => setGame(null)); }, [gameweekId]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  useEffect(() => (game ? listenMarks(gameweekId, (m) => m && setMarks(m)) : undefined), [game, gameweekId]);
  useEffect(() => {
    if (!game?.participants?.length) return;
    Promise.all([getUserPublicProfiles(game.participants).catch(() => ({})), getSeasonNumbers().catch(() => null), getPlayerLooks().catch(() => ({ bald: {} }))])
      .then(([pr, nums, looks]) => setPlayers(Object.fromEntries(game.participants.map((u) => [u, { nick: pr?.[u]?.nickname || "?", avatarId: pr?.[u]?.avatarId || null, number: nums?.numbers?.[u] ?? null, bald: !!looks?.bald?.[u] }]))));
  }, [game]);

  const pairIdx = game ? myPairIndex(game, uid) : -1;
  const pair = pairIdx >= 0 ? game.pairs[pairIdx] : null;
  const side = pair ? (pair.a === uid ? "A" : "B") : null;
  const opp = pair ? (side === "A" ? pair.b : pair.a) : null;
  const endMs = game?.endAt?.toMillis ? game.endAt.toMillis() : NaN;
  const closed = Number.isFinite(endMs) && now >= endMs;
  const marksSig = pair ? Array.from({ length: HS_TURNS }, (_, i) => `${hasMark(marks, pairIdx, i + 1, pair.a) ? 1 : 0}${hasMark(marks, pairIdx, i + 1, pair.b) ? 1 : 0}`).join("") : "";

  const reloadPicks = useCallback(() => { if (game && pair) loadPairPicks(gameweekId, game, pairIdx, marks, uid).then(setPicks).catch(() => {}); }, [game, pair, pairIdx, marks, uid, gameweekId]);
  useEffect(() => { reloadPicks(); }, [marksSig, game]); // eslint-disable-line react-hooks/exhaustive-deps

  const enginePicks = useMemo(() => {
    return withMarks(picks, marks, pairIdx, pair);
  }, [picks, marks, pair, pairIdx]);
  const duel = useMemo(() => computeDuel(enginePicks, closed), [enginePicks, closed]);

  if (game === undefined) return <p style={st.hint}>Se încarcă…</p>;
  if (!game) return <p style={st.hint}>Perechile nu au fost încă trase. Revino după tragerea la sorți.</p>;

  const P = (u) => players[u] || { nick: "…" };
  const drawShow = () => setShow({ kind: "draw", data: { players, pairs: game.pairs, bye: game.bye }, title: "Tragerea la sorți" });
  const fullPairShow = (pi, pk, from = 1, to = 5) => setShow({ kind: "duel", data: { players, pair: game.pairs[pi], picks: pk, closed, fromTurn: from, toTurn: to, key: `${gameweekId}_${pi}` }, title: `${P(game.pairs[pi].a).nick} vs ${P(game.pairs[pi].b).nick}` });
  const stage = show && <Suspense fallback={<HsLoading />}><HideSeekStage kind={show.kind} data={show.data} title={show.title} onSubmit={show.onSubmit} onClose={() => { setShow(null); reloadPicks(); }} /></Suspense>;
  // 🏅 Titlurile săptămânii: doar din turele jucate de ambii (alegeri care se pot citi de toți după confirmare).
  async function loadTitles() {
    setTitles("…");
    const byPair = {}; await Promise.all(game.pairs.map((_, i) => loadPairPicks(gameweekId, game, i, marks, uid).then((r) => { byPair[i] = r; }).catch(() => { byPair[i] = {}; })));
    setTitles(computeTitles(game, byPair));
  }
  const titlesBox = closed && (
    <div style={st.card}>
      <div style={st.sectionT}>🏅 TITLURILE SĂPTĂMÂNII</div>
      {!titles ? <button type="button" style={st.link} onClick={loadTitles}>Arată titlurile</button> : titles === "…" ? <p style={st.hint}>Se calculează…</p> : HS_TITLES.map((tt) => (
        <p key={tt.key} style={{ ...st.hint, color: "#fff" }}>{tt.icon} <b>{tt.name}</b>: {titles[tt.key]?.length ? titles[tt.key].map((u) => P(u).nick).join(", ") : "nimeni"} <span style={{ color: color.textMuted }}>· {tt.rule}</span></p>
      ))}
      <p style={st.hint}>Doar pentru mișto: titlurile nu dau puncte.</p>
    </div>
  );

  // ── BYE ──
  if (!pair) {
    return (
      <div style={st.wrap}>
        <Header onDraw={drawShow} endMs={endMs} now={now} />
        <div style={st.card}><div style={st.big}>{game.bye === uid ? `🪑 Stai pe bancă săptămâna asta: primești ${HS_BYE_POINTS} PCT fix.` : "Nu ești în tragerea la sorți a acestei etape."}</div></div>
        <OtherDuels game={game} players={players} marks={marks} exclude={-1} closed={closed} openPair={openPair} setOpenPair={setOpenPair} otherPicks={otherPicks} setOtherPicks={setOtherPicks} gameweekId={gameweekId} uid={uid} onWatch={fullPairShow} />
        {titlesBox}
        {stage}
      </div>
    );
  }

  const cur = duel.turns.find((t) => ["open", "waitA", "waitB"].includes(t.status));
  const t = cur?.turn || null;
  const iConfirmed = t ? hasMark(marks, pairIdx, t, uid) : false;
  const oppConfirmed = t ? hasMark(marks, pairIdx, t, opp) : false;
  const myTot = side === "A" ? duel.totalA : duel.totalB; const oppTot = side === "A" ? duel.totalB : duel.totalA;
  // Alegerea se face în scenă; aici doar salvăm (aceeași funcție securizată ca înainte: create-only, reguli Firestore).
  async function saveTurn(hide, seek) {
    try { await submitTurn(gameweekId, game, uid, t, hide, seek); }
    catch (e) { throw new Error(e.code === "permission-denied" ? "Nu se poate: tura nu e deschisă sau termenul a trecut." : (e.message || e.code || "Eroare la salvare.")); }
    setMarks((m) => ({ ...m, [`${pairIdx}_${t}_${uid}`]: { uid, pair: pairIdx, turn: t } })); setMsg("✓ Tura confirmată.");
  }
  const openPicker = () => { setMsg(""); setShow({ kind: "pick", data: { players, uid, side, turn: t }, title: `TURA ${t} · ${HS_LEVELS[t - 1]}`, onSubmit: saveTurn }); };
  const openCard = (turn) => { const pa = game.pairs[pairIdx]; const d = turnCardData(enginePicks, closed, turn, { ...P(pa.a) }, { ...P(pa.b) }, `${gameweekId}_${pairIdx}`, HS_LEVELS[turn - 1]); if (d) setShow({ kind: "card", data: { card: d }, title: "Cartonașul rușinii" }); };

  const lastPlayed = [...duel.turns].reverse().find((x) => x.status === "played");

  return (
    <div style={st.wrap}>
      <Header onDraw={drawShow} endMs={endMs} now={now} />

      <style>{HS_KEYFRAMES}</style>
      {/* MAIN EVENT — duelul meu */}
      <div style={st.main}>
        <div style={st.mainKick}>⭐ MAIN EVENT · DUELUL TĂU</div>
        <div style={st.vsRow}>
          <Card p={P(uid)} vest={side} me />
          <div style={st.vsMid}><div style={st.vsWord}>VS</div><div style={st.vsScore}><span style={{ color: VC[side] }}>{myTot}</span>–<span style={{ color: VC[side === "A" ? "B" : "A"] }}>{oppTot}</span></div><div style={st.vsPct}>PCT</div></div>
          <Card p={P(opp)} vest={side === "A" ? "B" : "A"} />
        </div>
        <div style={st.ladder}>
          {duel.turns.map((x) => {
            const mine = side === "A" ? x.ptsA : x.ptsB; const his = side === "A" ? x.ptsB : x.ptsA;
            const won = x.status === "played" && mine > his; const lost = x.status === "played" && mine < his;
            const bg = x.status === "played" ? (won ? "rgba(25,184,90,.22)" : lost ? "rgba(255,59,107,.18)" : "rgba(242,193,76,.18)") : x.status.startsWith("forfeit") ? "rgba(255,255,255,.08)" : "rgba(255,255,255,.04)";
            return (
              <div key={x.turn} className="hs-anim" style={{ ...st.rung, background: bg, borderColor: t === x.turn ? "#ff3d8b" : "rgba(255,255,255,.1)", animation: t === x.turn && !duel.finished ? "hsRung 1.6s ease-in-out infinite" : "none" }}>
                <div style={st.rungN}>{x.turn}</div><div style={st.rungI} aria-hidden="true">{LV_ICON[x.turn - 1]}</div>
                <div style={st.rungL}>{HS_LEVELS[x.turn - 1]}</div>
                {x.status === "played" && <button type="button" aria-label={`Cartonașul turei ${x.turn}`} style={st.cardBtn} onClick={() => openCard(x.turn)}>🖕</button>}
                <div style={st.rungV}>{x.status === "played" ? `${side === "A" ? x.winsA : x.winsB}–${side === "A" ? x.winsB : x.winsA} · ${mine} PCT` : x.status.startsWith("forfeit") ? `din oficiu · ${mine} PCT` : x.status === "void" ? "0 PCT" : `${HS_TURN_VALUES[x.turn - 1]} PCT`}</div>
              </div>
            );
          })}
        </div>
        {lastPlayed && (
          <div style={st.row2}>
            <button type="button" style={st.btnShow} onClick={() => fullPairShow(pairIdx, enginePicks, lastPlayed.turn, lastPlayed.turn)}>▶ Vezi tura {lastPlayed.turn}</button>
            <button type="button" style={st.btnGhost} onClick={() => fullPairShow(pairIdx, enginePicks, 1, 5)}>🎬 Tot duelul</button>
          </div>
        )}
      </div>

      {/* TURA CURENTĂ */}
      {duel.finished ? (
        <div style={st.card}><div style={st.big}>{duel.winner === "T" ? "🤝 EGALITATE" : (duel.winner === side ? "🏆 AI CÂȘTIGAT DUELUL" : "💀 AI PIERDUT DUELUL")} · {myTot} PCT</div>
          <p style={st.hint}>{closed ? "Termenul a trecut. Punctele devin oficiale la rezolvarea surprizei." : "Toate cele 5 ture sunt jucate."}</p></div>
      ) : closed ? (
        <div style={st.card}><div style={st.big}>⏱ Termenul a trecut.</div><p style={st.hint}>Turele nejucate se socotesc la rezolvare: cine a confirmat tura la care a rămas blocat le ia pe toate.</p></div>
      ) : iConfirmed ? (
        <div style={st.card}>
          <div style={st.big}>✓ Ai confirmat tura {t}.</div>
          <p style={st.hint}>{oppConfirmed ? "Și adversarul a confirmat. Se încarcă rezultatul…" : `Aștepți pe ${P(opp).nick}. Rezultatul apare când confirmă și el. Termen: ${left(endMs - now)}.`}</p>
        </div>
      ) : (
        <div style={st.turnBox}>
          <div style={st.turnHead}><span style={st.turnN}>TURA {t} / 5</span><span style={st.turnLv}>{HS_LEVELS[t - 1]} · {HS_TURN_VALUES[t - 1]} PCT</span></div>
          <p style={st.hint}>{oppConfirmed ? `✓ ${P(opp).nick} a confirmat deja. Rândul tău.` : `${P(opp).nick} n-a confirmat încă.`} Intri în labirint și atingi ușile: 3 unde te ascunzi, 3 pe care le deschizi.</p>
          <button type="button" className="hs-anim" style={st.confirm} onClick={openPicker}>🚪 INTRĂ ÎN LABIRINT · TURA {t}</button>
          <p style={st.hint}>După confirmare nu se mai poate schimba nimic. Termen: {left(endMs - now)}.</p>
        </div>
      )}
      {msg && <p style={st.msg}>{msg}</p>}

      <OtherDuels game={game} players={players} marks={marks} exclude={pairIdx} closed={closed} openPair={openPair} setOpenPair={setOpenPair} otherPicks={otherPicks} setOtherPicks={setOtherPicks} gameweekId={gameweekId} uid={uid} onWatch={fullPairShow} />
      {titlesBox}
      {stage}
    </div>
  );
}

function Header({ onDraw, endMs, now }) {
  return (
    <div style={st.hero}>
      <div style={st.heroShapes} aria-hidden>○ △ □</div>
      <div style={st.heroT}>🚪 ASCUNSELEA</div>
      <div style={st.heroS}>5 niveluri · 3 uși · un singur vânător. Termen: {Number.isFinite(endMs) ? `${when(new Date(endMs))} (${left(endMs - now)})` : "—"}</div>
      <button type="button" style={st.btnGhost} onClick={onDraw}>🎬 Tragerea la sorți</button>
    </div>
  );
}

function OtherDuels({ game, players, marks, exclude, closed, openPair, setOpenPair, otherPicks, setOtherPicks, gameweekId, uid, onWatch }) {
  const P = (u) => players[u] || { nick: "…" };
  return (
    <div style={st.card}>
      <div style={st.sectionT}>⚔️ CELELALTE DUELURI</div>
      {game.pairs.map((p, i) => {
        if (i === exclude) return null;
        const prog = Array.from({ length: HS_TURNS }, (_, k) => [hasMark(marks, i, k + 1, p.a), hasMark(marks, i, k + 1, p.b)]);
        const done = prog.filter(([a, b]) => a && b).length;
        const pk = otherPicks[i] ? withMarks(otherPicks[i], marks, i, p) : null; const d = pk ? computeDuel(pk, closed) : null;
        return (
          <div key={i} style={st.other}>
            <div style={st.otherRow}>
              <Chip p={P(p.a)} vest="A" />
              <span style={st.otherMid}>{d ? `${d.totalA}–${d.totalB}` : `${done}/5`}</span>
              <Chip p={P(p.b)} vest="B" right />
            </div>
            {done > 0 && (
              openPair === i && pk
                ? <button type="button" style={st.link} onClick={() => onWatch(i, pk, 1, 5)}>▶ Vezi duelul</button>
                : <button type="button" style={st.link} onClick={async () => { setOpenPair(i); const r = await loadPairPicks(gameweekId, game, i, marks, uid).catch(() => ({})); setOtherPicks((x) => ({ ...x, [i]: r })); }}>👁 Rezultate</button>
            )}
          </div>
        );
      })}
      {game.bye && <p style={st.hint}>🪑 Pe bancă: {P(game.bye).nick} ({HS_BYE_POINTS} PCT)</p>}
    </div>
  );
}

function Av({ p, size, ring }) {
  const url = getAvatarUrl(p?.avatarId);
  const s = { width: size, height: size, borderRadius: 12, border: `2.5px solid ${ring}`, objectFit: "cover", objectPosition: isS3Avatar(p?.avatarId) ? "50% 22%" : "50% 50%", background: "#14202a", display: "block", boxSizing: "border-box", boxShadow: size > 40 ? `0 0 16px ${ring}99` : "none" };
  return url ? <img alt="" src={url} style={s} /> : <span style={{ ...s, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900 }}>{(p?.nick || "?").charAt(0)}</span>;
}
function Card({ p, vest, me }) {
  return (
    <div style={st.pcard}>
      <Av p={p} size={88} ring={VC[vest]} />
      <span style={{ ...st.pnum, background: VC[vest] }}>{pad3(p?.number)}</span>
      <span style={st.pnick}>{p?.nick}{me ? " (tu)" : ""}</span>
    </div>
  );
}
function Chip({ p, vest, right }) {
  return <span style={{ ...st.chip, flexDirection: right ? "row-reverse" : "row" }}><Av p={p} size={26} ring={VC[vest]} /><span style={st.chipN}>{pad3(p?.number)} {p?.nick}</span></span>;
}

const D = font.display; const B = font.body;
const LV_ICON = ["🚪", "🪜", "🌀", "🗼", "🚨"];
const HS_KEYFRAMES = "@keyframes hsCta{0%,100%{transform:scale(1);box-shadow:0 0 18px rgba(255,61,139,.45)}50%{transform:scale(1.025);box-shadow:0 0 32px rgba(255,61,139,.85)}}@keyframes hsRung{0%,100%{box-shadow:0 0 0 rgba(255,61,139,0)}50%{box-shadow:0 0 14px rgba(255,61,139,.6)}}@media (prefers-reduced-motion: reduce){.hs-anim{animation:none!important}}";
const st = {
  wrap: { display: "flex", flexDirection: "column", gap: 10, marginTop: 8, fontFamily: B },
  hint: { fontSize: 11.5, color: color.textMuted, lineHeight: 1.45, margin: "6px 0 0" },
  msg: { fontSize: 12, color: color.goldLight, margin: 0 },
  hero: { position: "relative", overflow: "hidden", borderRadius: 16, padding: 14, background: "radial-gradient(120% 90% at 85% 0%, rgba(255,61,139,.45), transparent 60%), radial-gradient(90% 80% at 0% 100%, rgba(31,227,194,.28), transparent 60%), linear-gradient(180deg,#1d0f2e,#0b0816)", border: "1px solid rgba(255,61,139,.55)", boxShadow: "0 0 24px rgba(255,61,139,.18)", color: "#fff" },
  heroShapes: { position: "absolute", right: 10, top: 4, fontSize: 44, letterSpacing: 8, color: "rgba(255,61,139,.35)", fontWeight: 900, textShadow: "0 0 18px rgba(255,61,139,.8)" },
  heroT: { fontFamily: D, fontSize: 28, fontWeight: 700, letterSpacing: ".04em", textShadow: "0 2px 0 rgba(0,0,0,.2)" },
  heroS: { fontSize: 12, margin: "4px 0 10px", lineHeight: 1.4, opacity: 0.95 },
  main: { borderRadius: 18, padding: 14, background: "radial-gradient(100% 60% at 50% 0%, rgba(255,61,139,.22), transparent 70%), linear-gradient(180deg,#1b0f2c,#0b0816)", border: "1.5px solid rgba(255,61,139,.6)", boxShadow: "0 0 28px rgba(255,61,139,.2), inset 0 0 30px rgba(0,0,0,.4)" },
  mainKick: { fontFamily: D, fontSize: 12, letterSpacing: ".24em", color: "#ffd23f", textAlign: "center", textShadow: "0 0 10px rgba(255,210,63,.6)" },
  vsWord: { fontFamily: D, fontSize: 13, letterSpacing: ".3em", color: "#ff3d8b", textShadow: "0 0 10px #ff3d8b" },
  vsRow: { display: "flex", alignItems: "center", justifyContent: "space-between", margin: "10px 0" },
  vsMid: { textAlign: "center" }, vsScore: { fontFamily: D, fontSize: 34, fontWeight: 700, color: "#fff" }, vsPct: { fontSize: 10, color: color.textMuted, letterSpacing: ".2em" },
  pcard: { display: "flex", flexDirection: "column", alignItems: "center", width: 104 },
  pnum: { marginTop: -10, fontFamily: D, fontSize: 13, fontWeight: 700, color: "#fff", borderRadius: 5, padding: "0 6px", border: "2px solid #fff", zIndex: 1 },
  pnick: { fontSize: 12.5, fontWeight: 800, color: "#fff", marginTop: 3, maxWidth: 104, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  ladder: { display: "flex", flexDirection: "column-reverse", gap: 4 },
  rung: { display: "flex", alignItems: "center", gap: 8, border: "1px solid", borderRadius: 12, padding: "7px 9px" },
  rungI: { fontSize: 17, width: 22, textAlign: "center" },
  rungN: { fontFamily: D, fontSize: 16, fontWeight: 700, color: "#f2c14c", width: 16 },
  rungL: { flex: 1, fontSize: 11.5, fontWeight: 800, color: "#e8edf5", letterSpacing: ".04em" },
  rungV: { fontSize: 11.5, color: "#c9cfdd", whiteSpace: "nowrap" },
  row2: { display: "flex", gap: 8, marginTop: 10 },
  btnShow: { flex: 1, background: "#ff3b6b", color: "#fff", border: "none", borderRadius: 12, padding: "11px 8px", fontFamily: D, fontSize: 15, fontWeight: 700, letterSpacing: ".04em" },
  btnGhost: { background: "rgba(0,0,0,.25)", color: "#fff", border: "1px solid rgba(255,255,255,.4)", borderRadius: 12, padding: "9px 12px", fontFamily: D, fontSize: 14, fontWeight: 700, letterSpacing: ".04em" },
  card: { background: color.surface, border: `1px solid ${color.border}`, borderRadius: 14, padding: 12 },
  big: { fontFamily: D, fontSize: 17, fontWeight: 700, color: "#fff", letterSpacing: ".02em" },
  turnBox: { borderRadius: 18, padding: 14, background: "radial-gradient(90% 70% at 50% 100%, rgba(31,227,194,.16), transparent 70%), linear-gradient(180deg,#26132a,#0b0816)", border: "1.5px solid rgba(31,227,194,.5)", boxShadow: "0 0 24px rgba(31,227,194,.14)" },
  turnHead: { display: "flex", alignItems: "baseline", justifyContent: "space-between" },
  turnN: { fontFamily: D, fontSize: 22, fontWeight: 700, color: "#fff" }, turnLv: { fontSize: 11.5, color: "#f2c14c", fontWeight: 800, letterSpacing: ".06em" },
  cardBtn: { background: "rgba(255,59,107,.18)", border: "1px solid rgba(255,59,107,.5)", borderRadius: 8, padding: "2px 6px", fontSize: 13, lineHeight: 1.2, cursor: "pointer" },
  confirm: { width: "100%", marginTop: 10, background: "linear-gradient(90deg,#ff3d8b,#c1349b)", color: "#fff", border: "none", borderRadius: 14, padding: "16px 8px", fontFamily: D, fontSize: 18, fontWeight: 700, letterSpacing: ".06em", boxShadow: "0 0 22px rgba(255,61,139,.55)", animation: "hsCta 1.4s ease-in-out infinite" },
  sectionT: { fontFamily: D, fontSize: 14, fontWeight: 700, letterSpacing: ".1em", color: "#e8edf5", marginBottom: 6 },
  other: { borderTop: `1px solid ${color.border}`, padding: "7px 0" },
  otherRow: { display: "flex", alignItems: "center", gap: 6 },
  otherMid: { fontFamily: D, fontSize: 14, color: "#f2c14c", minWidth: 40, textAlign: "center" },
  chip: { display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 },
  chipN: { fontSize: 12, fontWeight: 700, color: color.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  link: { background: "none", border: "none", color: color.goldLight, fontSize: 11.5, padding: 0, marginTop: 4, cursor: "pointer" },
};
