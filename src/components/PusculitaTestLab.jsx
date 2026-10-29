import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, getDocs, Timestamp, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { listActiveUserIds } from "../services/adminService";
import { getPusculita, confirmRound, revealVote, buildPusculitaInput, listVoted, setPusculitaDoc } from "../services/pusculitaGame";
import { computePusculita, PUSCULITA_DEFAULT_THRESHOLD_PER_MATCH, PUSCULITA_ROUNDS } from "../services/pusculitaService";
import PusculitaScreen from "../screens/PusculitaScreen";

// ══════════════════════════════════════════════════════════════════
// 🐷 Admin — TESTUL Pușculiței pe Firebase-ul REAL (reguli reale, vot real),
// pe un joc separat „test-pusculita”, nelegat de nicio etapă și invizibil
// pentru jucători. Meciurile și punctele sunt SIMULATE (fără etapă reală).
// Voturile: al tău e real (trece prin regulile Firestore); ale celorlalți se
// pot simula la dezvăluire (doar în test).
// ══════════════════════════════════════════════════════════════════
const TEST_ID = "test-pusculita";
const PTS = [0, 20, 50, 70, 120];                       // punctele posibile pe meci (ca în PLAY LEAGUE)
const rk = (k) => `r${k}`;

function randomRoundPoints(uids, matches) {
  const out = {};
  uids.forEach((u) => {
    let s = 0;
    for (let m = 0; m < matches; m++) { const r = Math.random(); s += r < 0.3 ? 0 : r < 0.45 ? PTS[1] : r < 0.75 ? PTS[2] : r < 0.9 ? PTS[3] : PTS[4]; }
    out[u] = s;
  });
  return out;
}

export default function PusculitaTestLab() {
  const [game, setGame] = useState(undefined);
  // Valorile se țin ca TEXT, ca să poți șterge câmpul și scrie liber; se validează la pornire.
  const [matchesTxt, setMatchesTxt] = useState(["5", "5", "5", "5"]);
  const [perMatchTxt, setPerMatchTxt] = useState(PUSCULITA_DEFAULT_THRESHOLD_PER_MATCH.map(String));
  const [voteMinTxt, setVoteMinTxt] = useState("15");
  const num = (t) => (/^\d+$/.test(String(t).trim()) ? parseInt(t, 10) : NaN);
  const matches = matchesTxt.map(num), perMatch = perMatchTxt.map(num), voteMin = num(voteMinTxt);
  const totalMatches = matches.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
  const MAX_TOTAL = 20; // meciurile unei etape
  const configErr = matches.some((m) => !Number.isFinite(m) || m < 1) ? "Fiecare rundă trebuie să aibă cel puțin 1 meci."
    : totalMatches > MAX_TOTAL ? `Maximum ${MAX_TOTAL} meciuri în total (câte are etapa). Acum: ${totalMatches}.`
    : perMatch.some((p) => !Number.isFinite(p)) ? "Completează pragul pe meci la fiecare rundă."
    : !Number.isFinite(voteMin) || voteMin < 2 ? "Durata votului: minimum 2 minute." : "";
  const [simOthers, setSimOthers] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [key, setKey] = useState(0);
  const me = auth.currentUser?.uid;

  const load = async () => { try { setGame(await getPusculita(TEST_ID)); } catch (e) { setGame(null); setMsg(`Nu pot citi: ${e.code || e.message}`); } setKey((x) => x + 1); };
  useEffect(() => { load(); }, []);

  const live = game?.testLive || null;
  const res = game ? computePusculita(buildPusculitaInput(game, live)) : null;
  const done = (k) => !!live?.complete?.[rk(k)];
  const nextRound = [0, 1, 2, 3].find((k) => !done(k));

  async function wrap(fn) { setBusy(true); setMsg(""); try { await fn(); } catch (e) { setMsg(`Eroare: ${e.code || e.message}`); } setBusy(false); await load(); }

  const start = () => wrap(async () => {
    const participants = [...(await listActiveUserIds())];
    const rounds = matches.map((n, k) => ({
      matchIds: Array.from({ length: n }, (_, i) => `test-r${k + 1}-m${i + 1}`),
      threshold: perMatch[k] * n,
      voteDeadline: null,
    }));
    await setPusculitaDoc(TEST_ID, {
      gameweekId: TEST_ID, published: true, participants, rounds,
      alive: {}, voteOpen: {}, voteRevealed: {}, voteResults: {},
      testLive: { points: {}, complete: {}, validated: {} },
    });
    setMsg(`Test pornit cu ${participants.length} jucători (doar tu îl vezi).`);
  });

  // Simulează toate meciurile rundei k: puncte aleatorii, runda completă, apoi
  // confirmarea supraviețuitorilor + deschiderea votului (exact ca la validarea reală).
  const simulate = (k) => wrap(async () => {
    const g = await getPusculita(TEST_ID);
    const alive = k === 0 ? g.participants : (g.alive?.[rk(k - 1)] || g.participants);
    const pts = randomRoundPoints(alive, g.rounds[k].matchIds.length);
    const tl = g.testLive || { points: {}, complete: {}, validated: {} };
    tl.points[rk(k)] = pts; tl.complete[rk(k)] = true; tl.validated[rk(k)] = g.rounds[k].matchIds.length;
    const rounds = g.rounds.map((r, i) => (i === k && k < PUSCULITA_ROUNDS - 1 ? { ...r, voteDeadline: Timestamp.fromMillis(Date.now() + voteMin * 60e3) } : r));
    await updateDoc(doc(db, "pusculita", TEST_ID), { testLive: tl, rounds });
    const r = computePusculita(buildPusculitaInput({ ...g, rounds, testLive: tl }, tl));
    const t = r.timeline[k];
    if (t && k < PUSCULITA_ROUNDS - 1) {
      await confirmRound(TEST_ID, k, t.survivors, t.survivors.length >= 3);
      setMsg(`Runda ${k + 1}: ${t.eliminated.length} eliminați, ${t.survivors.length} rămân.${t.survivors.length >= 3 ? ` Votul e deschis ${voteMin} minute.` : ""}`);
    } else setMsg(`Finala simulată.`);
  });

  // Dezvăluirea: votul TĂU real (citit prin regulile reale) + opțional voturi simulate pentru ceilalți.
  const reveal = (k) => wrap(async () => {
    const real = await revealVote(TEST_ID, k);
    if (simOthers) {
      const g = await getPusculita(TEST_ID);
      const merged = { ...real };
      (g.alive?.[rk(k)] || []).forEach((u) => { if (!(u in merged)) merged[u] = Math.random() < 0.55 ? "O" : "X"; });
      await updateDoc(doc(db, "pusculita", TEST_ID), { [`voteResults.${rk(k)}`]: merged });
    }
    setMsg(`Vot dezvăluit (votul tău ${real[me] ? "a fost înregistrat real" : "lipsă"}).`);
  });

  const reset = () => wrap(async () => {
    if (!window.confirm("Ștergi testul Pușculiței? (Nu atinge nimic real.)")) return;
    // Voturile secrete nu se pot LISTA (regula le ascunde până la dezvăluire), dar fiecare
    // vot are un marcaj public „voted” cu ACELAȘI id → ștergem voturile după aceste id-uri.
    const voted = await getDocs(collection(db, "pusculita", TEST_ID, "voted"));
    await Promise.all(voted.docs.map((d) => deleteDoc(doc(db, "pusculita", TEST_ID, "votes", d.id)).catch(() => {})));
    await Promise.all(voted.docs.map((d) => deleteDoc(d.ref)));
    await deleteDoc(doc(db, "pusculita", TEST_ID));
    setMsg("Testul a fost șters.");
  });

  const [votedCount, setVotedCount] = useState(null);
  useEffect(() => {
    const open = [0, 1, 2].find((k) => game?.voteOpen?.[rk(k)]);
    if (open === undefined) { setVotedCount(null); return; }
    listVoted(TEST_ID, open).then((v) => setVotedCount({ k: open, n: v.length, alive: (game.alive?.[rk(open)] || []).length })).catch(() => {});
  }, [game]);

  if (game === undefined) return <p style={st.note}>Se încarcă…</p>;
  return (
    <div>
      <p style={st.note}>Pușculița pe serverul și regulile REALE, pe jocul separat „test-pusculita”, invizibil pentru jucători. Punctele meciurilor sunt simulate.</p>
      {!game ? (
        <div style={st.box}>
          <b style={st.t}>Configurare</b>
          {[0, 1, 2, 3].map((k) => (
            <div key={k} style={st.row}>
              <span style={st.lbl}>Runda {k + 1}</span>
              <label style={st.lbl}>meciuri <input type="text" inputMode="numeric" style={st.in} value={matchesTxt[k]} onChange={(e) => setMatchesTxt((m) => m.map((x, i) => (i === k ? e.target.value.replace(/\D/g, "").slice(0, 2) : x)))} /></label>
              <label style={st.lbl}>prag/meci <input type="text" inputMode="numeric" style={st.in} value={perMatchTxt[k]} onChange={(e) => setPerMatchTxt((m) => m.map((x, i) => (i === k ? e.target.value.replace(/\D/g, "").slice(0, 3) : x)))} /></label>
              <span style={st.lbl}>= {Number.isFinite(matches[k] * perMatch[k]) ? matches[k] * perMatch[k] : "—"} p</span>
            </div>
          ))}
          <div style={st.row}><label style={st.lbl}>Durata votului (minute) <input type="text" inputMode="numeric" style={st.in} value={voteMinTxt} onChange={(e) => setVoteMinTxt(e.target.value.replace(/\D/g, "").slice(0, 3))} /></label></div>
          <p style={{ ...st.note, color: totalMatches > MAX_TOTAL ? "#ff6b6b" : "#8DB3AA" }}>Total meciuri: {totalMatches} / {MAX_TOTAL}</p>
          {configErr && <p style={{ ...st.note, color: "#ff6b6b" }}>{configErr}</p>}
          <button type="button" style={{ ...st.gold, opacity: configErr ? 0.5 : 1 }} onClick={start} disabled={busy || !!configErr}>Pornește testul</button>
        </div>
      ) : (
        <div style={st.box}>
          <b style={st.t}>Pași</b>
          <div style={st.row}>
            {nextRound !== undefined && res?.outcome.status !== "ended" && !Object.values(game.voteOpen || {}).some(Boolean) && (
              <button type="button" style={st.gold} onClick={() => simulate(nextRound)} disabled={busy}>▶ Simulează runda {nextRound + 1}</button>
            )}
            {[0, 1, 2].filter((k) => game.voteOpen?.[rk(k)]).map((k) => (
              <button key={k} type="button" style={st.gold} onClick={() => reveal(k)} disabled={busy}>Dezvăluie votul rundei {k + 1}</button>
            ))}
            <button type="button" style={st.btn} onClick={reset} disabled={busy}>🗑 Resetează testul</button>
          </div>
          <label style={st.lbl}><input type="checkbox" checked={simOthers} onChange={(e) => setSimOthers(e.target.checked)} /> la dezvăluire, simulează voturile celorlalți</label>
          {votedCount && <p style={st.note}>Votul rundei {votedCount.k + 1}: {votedCount.n}/{votedCount.alive} au votat (real). Votează și tu în „Sala voturilor” de mai jos.</p>}
          {res?.outcome.status === "ended" && <p style={{ ...st.note, color: "#F5C451" }}>Joc încheiat ({res.outcome.reason}). Premii: {Object.values(res.prizesByUid).filter((v) => v > 0).join(", ") || "niciunul"}.</p>}
        </div>
      )}
      {msg && <p style={{ ...st.note, color: "#F5C451" }}>{msg}</p>}
      {game && me && <PusculitaScreen gameweekId={TEST_ID} uid={me} refreshKey={key} />}
    </div>
  );
}

const st = {
  note: { fontSize: 12.5, color: "#8DB3AA", lineHeight: 1.45 },
  box: { border: "1px solid rgba(173,255,230,.16)", borderRadius: 10, padding: 10, margin: "8px 0" },
  t: { color: "#EAF6F2", fontSize: 13 },
  row: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", margin: "6px 0" },
  lbl: { fontSize: 12, color: "#cfd8dc" },
  in: { width: 56, background: "rgba(0,0,0,.4)", color: "#fff", border: "1px solid rgba(255,255,255,.2)", borderRadius: 6, padding: "4px 6px", marginLeft: 4 },
  gold: { padding: "9px 12px", borderRadius: 10, border: "none", background: "linear-gradient(180deg,#ffd978,#e7a92e)", color: "#2a1a00", fontWeight: 800, fontSize: 12.5 },
  btn: { padding: "8px 10px", borderRadius: 10, border: "1px solid rgba(173,255,230,.16)", background: "rgba(0,0,0,.45)", color: "#EAF6F2", fontWeight: 700, fontSize: 12 },
};
