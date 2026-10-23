import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import PlayerAvatar from "../components/PlayerAvatar";
import { font } from "../matchdayTheme";
import {
  computeBursaResults, buildDuelSeries, buildBursaRanking, validatePortfolio, buildHistoryFromEntries, normalizePortfolio,
  BURSA_CATEGORY_PERF, BURSA_CATEGORY_CONTRA, BURSA_BASE_CAP, BURSA_PUBLIC_NAME,
} from "../services/bursaService";
import { loadBursaGame, loadBursaHistoryEntries, saveBursaPortfolio } from "../services/bursaGame";
import { subscribeToLiveSnapshot } from "../services/liveSnapshotStore";
import { getBursaMockScenario, BURSA_MOCK_PLAYERS } from "../bursaMockData";

// ══════════════════════════════════════════════════════════════════
// 📈📉 BURSA PRIETENILOR — PLAY LEAGUE STOCK EXCHANGE (ETAPA 1B)
//
// DOAR Admin Preview: date simulate din bursaMockData.js, calculate
// CU bursaService.js (aceleași funcții ca jocul real). ZERO Firestore:
// nicio citire, nicio scriere, niciun listener, niciun polling.
// Fără previewMode, ecranul nu face nimic (Bursa nu e activă încă).
//
// Avatare: PlayerAvatar + avatarId real („pachet/index”) — exact
// mecanismul aplicației (assets/avatars.js → public/avatars).
//
// Culori: verde = PERFORMANȚĂ, roșu = CONTRAPERFORMANȚĂ. Liniile
// duelului NU folosesc verde/roșu (ar amesteca sensul): auriu = tu,
// albastru-gheață = adversarul.
// ══════════════════════════════════════════════════════════════════

const C = {
  bg: "#06090F",
  panel: "#0C1119",
  panelHi: "#121A26",
  line: "rgba(255,255,255,0.07)",
  text: "#EEF2F7",
  dim: "#8792A6",
  faint: "#4E586B",
  up: "#33E38A",
  upBg: "rgba(51,227,138,0.10)",
  upBorder: "rgba(51,227,138,0.45)",
  down: "#FF4D61",
  downBg: "rgba(255,77,97,0.10)",
  downBorder: "rgba(255,77,97,0.45)",
  me: "#F2C94C",
  opp: "#8FC2FF",
};

// 👑 Prinț = alegi un coleg care va PERFORMA (verde) · 🐸 Broscoi = alegi un coleg care va RATA (roșu).
const CAT = {
  [BURSA_CATEGORY_PERF]: { label: "Prinț", icon: (z = 16, anim = false) => <PrinceIcon size={z} anim={anim} />, color: C.up, bg: C.upBg, border: C.upBorder },
  [BURSA_CATEGORY_CONTRA]: { label: "Broscoi", icon: (z = 16, anim = false) => <FrogIcon size={z} anim={anim} />, color: C.down, bg: C.downBg, border: C.downBorder },
};

const EMPTY = { perf: [null, null], contra: [null, null] };

// Numele și avatarele vin DOAR din context: în Preview = mock, în jocul real = profilele reale (users/{uid}),
// aceeași sursă ca Clasamentul. Nu mai există niciun nume hardcodat folosit în jocul real.
const PlayersCtx = createContext(BURSA_MOCK_PLAYERS);
function usePlayers() {
  const players = useContext(PlayersCtx);
  return { nameOf: (uid) => players?.[uid]?.nickname || uid, avatarOf: (uid) => players?.[uid]?.avatarId || null };
}
function compact(p) { return { perf: (p?.perf || []).filter(Boolean), contra: (p?.contra || []).filter(Boolean) }; }
function toSlots(p) {
  return { perf: [p?.perf?.[0] || null, p?.perf?.[1] || null], contra: [p?.contra?.[0] || null, p?.contra?.[1] || null] };
}

export default function BursaScreen({ previewMode, previewState = "A", gameweekId, uid }) {
  if (previewMode) {
    return (
      <PlayersCtx.Provider value={BURSA_MOCK_PLAYERS}>
        <BursaPreview key={previewState} stateId={previewState} />
      </PlayersCtx.Provider>
    );
  }
  if (gameweekId && uid) return <BursaLive gameweekId={gameweekId} uid={uid} />;
  return (
    <div style={s.page}>
      <p style={s.note}>{BURSA_PUBLIC_NAME} nu este încă activ.</p>
    </div>
  );
}

function BursaPreview({ stateId }) {
  const { nameOf, avatarOf } = usePlayers();
  const scen = useMemo(() => getBursaMockScenario(stateId), [stateId]);
  const me = scen.myUid;
  const lastStep = scen.history.length - 1;

  const [phase, setPhase] = useState(scen.phase);
  const [slots, setSlots] = useState(toSlots(scen.myPortfolio));
  const [step, setStep] = useState(scen.historyUpTo);
  const [picker, setPicker] = useState(null); // { cat, idx } | null
  const [justFilled, setJustFilled] = useState(null); // "perf-0" etc.
  const [revealKey, setRevealKey] = useState(stateId === "E" ? 1 : 0);
  const [reversalKey, setReversalKey] = useState(0);
  const [showAll, setShowAll] = useState(stateId === "E");
  const [toast, setToast] = useState("");

  const myPortfolio = compact(slots);
  const myValid = validatePortfolio(myPortfolio, me, scen.eligibleUids).ok;
  const live = phase === "live" || phase === "final";
  const revealed = phase === "revealed" || live;

  // Portofoliile folosite în calcul: ale celorlalți din scenariu, al meu
  // = cel construit acum (incomplet → neparticipant, ca în realitate).
  const picksByUid = useMemo(() => {
    const out = { ...scen.picksByUid };
    if (myValid) out[me] = myPortfolio; else delete out[me];
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scen, slots]);

  const history = scen.history.slice(0, step + 1);
  const pointsByUid = history[history.length - 1].pointsByUid;
  const results = useMemo(() => computeBursaResults({
    pairings: scen.pairings, byePlayer: scen.byePlayer, eligibleUids: scen.eligibleUids, picksByUid, pointsByUid,
  }), [scen, picksByUid, pointsByUid]);

  const mine = results.byUid[me] || null;
  const myPair = scen.pairings.find((p) => p.playerA === me || p.playerB === me) || null;
  const oppUid = myPair ? (myPair.playerA === me ? myPair.playerB : myPair.playerA) : null;
  const opp = oppUid ? results.byUid[oppUid] : null;
  const series = useMemo(() => buildDuelSeries(history, {
    playerA: me, playerB: oppUid, eligibleUids: scen.eligibleUids, picksByUid,
  }), [history, me, oppUid, scen, picksByUid]);

  // „RĂSTURNARE DE SITUAȚIE!” — doar când liderul chiar se schimbă la
  // pasul curent (calcul din bursaService.isLeadReversal).
  const lastSeries = series[series.length - 1];
  const prevStepRef = useRef(null);
  useEffect(() => {
    if (!live) { prevStepRef.current = step; return; }
    if (prevStepRef.current !== step && lastSeries?.reversal) setReversalKey((k) => k + 1);
    prevStepRef.current = step;
  }, [step, live, lastSeries?.reversal]);

  useEffect(() => {
    if (!reversalKey) return undefined;
    const t = setTimeout(() => setReversalKey(0), 2600);
    return () => clearTimeout(t);
  }, [reversalKey]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(""), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  function choose(uid) {
    if (!picker) return;
    setSlots((prev) => {
      const next = { perf: [...prev.perf], contra: [...prev.contra] };
      next[picker.cat][picker.idx] = uid;
      return next;
    });
    setJustFilled(`${picker.cat}-${picker.idx}-${uid}`);
    setPicker(null);
  }
  function clearSlot(cat, idx) {
    setSlots((prev) => {
      const next = { perf: [...prev.perf], contra: [...prev.contra] };
      next[cat][idx] = null;
      return next;
    });
  }

  const ranking = useMemo(() => buildBursaRanking(pointsByUid, scen.eligibleUids), [pointsByUid, scen]);
  const editable = phase === "open";

  return (
    <div style={s.page}>
      <style>{CSS}</style>

      {live && <Ticker ranking={ranking} validated={step} live={live} />}

      <header style={s.head}>
        <div>
          <div style={s.brand}>Play League Stock Exchange</div>
          <h1 style={s.title}>{BURSA_PUBLIC_NAME}</h1>
        </div>
        <PhaseBadge phase={phase} step={step} />
      </header>

      {/* ── PORTOFOLIUL MEU ── */}
      {!live && (
        <section style={s.block}>
          <div style={s.blockHead}>
            <span style={s.blockTitle}>Portofoliul tău</span>
            <span style={s.blockMeta}>{myPortfolio.perf.length + myPortfolio.contra.length}/4</span>
          </div>
          {[BURSA_CATEGORY_PERF, BURSA_CATEGORY_CONTRA].map((cat) => (
            <div key={cat} style={{ marginBottom: 10 }}>
              <div style={{ ...s.catLabel, color: CAT[cat].color, display: "flex", alignItems: "center", gap: 6 }}>
                {CAT[cat].icon(20)}
                <span>{cat === BURSA_CATEGORY_PERF ? "PRINȚI" : "BROSCOI"}</span>
                <span style={{ color: C.dim, fontWeight: 500 }}>· {cat === BURSA_CATEGORY_PERF ? "crezi că performează" : "crezi că ratează"}</span>
              </div>
              <div style={s.slotRow}>
                {[0, 1].map((idx) => (
                  <SlotCard
                    key={idx} cat={cat} uid={slots[cat][idx]} editable={editable}
                    pop={justFilled?.startsWith(`${cat}-${idx}-`)}
                    onOpen={() => editable && setPicker({ cat, idx })}
                    onClear={() => clearSlot(cat, idx)}
                  />
                ))}
              </div>
            </div>
          ))}

          {phase === "open" && (
            <button
              type="button" style={{ ...s.cta, ...(myValid ? {} : s.ctaOff) }} disabled={!myValid}
              onClick={() => { setPhase("saved"); setToast("Portofoliu salvat"); }}
            >
              {myValid ? "Salvează portofoliul" : `Mai alege ${4 - myPortfolio.perf.length - myPortfolio.contra.length}`}
            </button>
          )}
          {phase === "saved" && (
            <div style={s.savedBox}>
              <div style={s.savedTitle}>✓ Portofoliu salvat</div>
              <div style={s.savedText}>Alegerile tale rămân secrete până la închiderea înscrierilor. Le poți schimba până atunci.</div>
              <button type="button" style={s.ghostBtn} onClick={() => setPhase("open")}>Modifică</button>
            </div>
          )}
        </section>
      )}

      {/* ── DUELUL ── */}
      {live && (
        <>
          <DuelHero
            me={me} oppUid={oppUid} mine={mine} opp={opp} isBye={!!mine?.isBye}
            final={phase === "final"}
          />
          <section style={s.block}>
            <div style={s.blockHead}>
              <span style={s.blockTitle}>Evoluția duelului</span>
              <span style={s.blockMeta}>scor brut după fiecare validare</span>
            </div>
            <DuelChart series={series} totalSteps={scen.history.length} hasOpp={!!oppUid} />
            <div style={s.legend}>
              <span><i style={{ ...s.legendDot, background: C.me }} /> {nameOf(me)}</span>
              {oppUid && <span><i style={{ ...s.legendDot, background: C.opp }} /> {nameOf(oppUid)}</span>}
              <span style={{ color: C.faint }}>- - plafon {BURSA_BASE_CAP}</span>
            </div>
          </section>

          <PortfolioTable title="Portofoliul tău" who={me} data={mine} tone={C.me} />
          {oppUid && <PortfolioTable title={`Portofoliul lui ${nameOf(oppUid)}`} who={oppUid} data={opp} tone={C.opp} />}
        </>
      )}

      {/* ── TOATE SELECȚIILE ── */}
      {revealed && (
        <section style={s.block}>
          <button type="button" style={s.toggleRow} onClick={() => setShowAll((v) => !v)}>
            <span style={s.blockTitle}>Toate portofoliile</span>
            <span style={s.blockMeta}>{showAll ? "ascunde" : "arată"}</span>
          </button>
          {showAll && (
            <AllPortfolios
              eligibleUids={scen.eligibleUids} picksByUid={picksByUid} me={me}
              ranking={ranking} live={live} revealKey={revealKey}
            />
          )}
        </section>
      )}

      {/* ── CONTROALE DE SIMULARE (Admin) ── */}
      <section style={s.simBox}>
        <div style={s.simTitle}>Simulare Admin · nimic nu se salvează</div>
        <div style={s.simRow}>
          {phase === "saved" && (
            <button type="button" style={s.simBtn} onClick={() => { setPhase("revealed"); setShowAll(true); setRevealKey((k) => k + 1); }}>
              Închide înscrierile și dezvăluie
            </button>
          )}
          {phase === "open" && <span style={s.simHint}>Completează și salvează portofoliul pentru pasul următor.</span>}
          {phase === "revealed" && (
            <button type="button" style={s.simBtn} onClick={() => { setPhase("live"); setStep(0); }}>
              Pornește etapa
            </button>
          )}
          {phase === "live" && step < lastStep && (
            <button type="button" style={s.simBtn} onClick={() => setStep((x) => Math.min(lastStep, x + 1))}>
              Validează următorul meci ({step + 1}/{lastStep})
            </button>
          )}
          {phase === "live" && step > 0 && (
            <button type="button" style={s.simBtnGhost} onClick={() => setStep((x) => Math.max(0, x - 1))}>
              Pas înapoi
            </button>
          )}
          {phase === "live" && step === lastStep && (
            <button type="button" style={s.simBtn} onClick={() => setPhase("final")}>Finalizează etapa</button>
          )}
          {phase === "final" && (
            <button type="button" style={s.simBtnGhost} onClick={() => { setPhase("live"); setStep(0); }}>
              Reia etapa de la început
            </button>
          )}
        </div>
      </section>

      {picker && (
        <PickerSheet
          cat={picker.cat} me={me} eligibleUids={scen.eligibleUids} slots={slots}
          current={slots[picker.cat][picker.idx]}
          onPick={choose} onClose={() => setPicker(null)}
        />
      )}

      {reversalKey > 0 && (
        <div key={reversalKey} className="bx-rev" style={s.revWrap} aria-live="assertive">
          <div style={s.revCard}>
            <div style={s.revKicker}>Liderul s-a schimbat</div>
            <div style={s.revText}>RĂSTURNARE DE SITUAȚIE!</div>
            <div style={s.revWho}>
              <PlayerAvatar avatarId={avatarOf(lastSeries?.leader === "A" ? me : oppUid)} nickname={nameOf(lastSeries?.leader === "A" ? me : oppUid)} size={34} />
              <span>{nameOf(lastSeries?.leader === "A" ? me : oppUid)} trece în față</span>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="bx-toast" style={s.toast}>{toast}</div>}
    </div>
  );
}

// ── Bandă de cotații — locul + punctele din meciuri, în ordinea clasamentului. ──
function Ticker({ ranking, validated, live }) {
  const { nameOf, avatarOf } = usePlayers();
  const items = ranking.order.map((uid) => {
    const e = ranking.byUid[uid];
    const up = e.inTopHalf && !ranking.allEqual;
    const down = e.inBottomHalf && !ranking.allEqual;
    return { uid, rank: e.rank, pts: e.points, up, down };
  });
  const content = (
    <>
      {items.map((it) => (
        <span key={it.uid} style={s.tick}>
          <span style={{ color: it.up ? C.up : it.down ? C.down : C.dim }}>{it.up ? "▲" : it.down ? "▼" : "■"}</span>
          {" "}{it.rank}. {nameOf(it.uid)} <b style={s.tickPts}>{it.pts}</b>
        </span>
      ))}
    </>
  );
  return (
    <div style={s.tickerWrap} aria-label="Clasamentul etapei">
      <div className={live && validated > 0 ? "bx-ticker" : ""} style={s.tickerTrack}>
        {content}
        {live && validated > 0 && content}
      </div>
    </div>
  );
}

function PhaseBadge({ phase, step }) {
  const map = {
    open: { t: "Înscrieri deschise", c: C.up },
    saved: { t: "Salvat · secret", c: C.me },
    revealed: { t: "Înscrieri închise", c: C.opp },
    live: { t: step === 0 ? "Live · 0 validări" : `Live · ${step} ${step === 1 ? "validare" : "validări"}`, c: C.down },
    final: { t: "Definitiv", c: C.me },
  };
  const m = map[phase] || map.open;
  return (
    <span style={{ ...s.badge, color: m.c, borderColor: m.c }}>
      {phase === "live" && <i className="bx-blink" style={{ ...s.badgeDot, background: m.c }} />}
      {m.t}
    </span>
  );
}

function SlotCard({ cat, uid, editable, pop, onOpen, onClear }) {
  const { nameOf, avatarOf } = usePlayers();
  const k = CAT[cat];
  if (!uid) {
    return (
      <button type="button" style={{ ...s.slot, ...s.slotEmpty, borderColor: k.border }} onClick={onOpen} disabled={!editable}>
        <span style={{ ...s.slotPlus, color: k.color }}>+</span>
        <span style={s.slotEmptyText}>Alege</span>
      </button>
    );
  }
  return (
    <div className={pop ? "bx-pop" : ""} style={{ ...s.slot, background: k.bg, borderColor: k.border }}>
      <button type="button" style={s.slotMain} onClick={onOpen} disabled={!editable}>
        <span style={{ ...s.slotRing, boxShadow: `0 0 0 2px ${k.color}, 0 0 18px ${k.border}` }}>
          <AvatarWithBadge uid={uid} size={52} cat={cat} anim={pop} />
        </span>
        <span style={s.slotName}>{nameOf(uid)}</span>
        <span style={{ ...s.slotCat, color: k.color, display: "inline-flex", alignItems: "center", gap: 4 }}>{cat === BURSA_CATEGORY_PERF ? "Prinț" : "Broscoi"}</span>
      </button>
      {editable && (
        <button type="button" style={s.slotX} onClick={onClear} aria-label={`Scoate ${nameOf(uid)}`}>×</button>
      )}
    </div>
  );
}

function PickerSheet({ cat, me, eligibleUids, slots, current, onPick, onClose }) {
  const { nameOf, avatarOf } = usePlayers();
  const k = CAT[cat];
  const taken = new Set([...slots.perf, ...slots.contra].filter((u) => u && u !== current));
  // Doar ELIGIBILII (activi), fără mine. Dezactivații nu apar deloc.
  const list = eligibleUids.filter((u) => u !== me).sort((a, b) => nameOf(a).localeCompare(nameOf(b), "ro"));
  return (
    <div style={s.sheetBack} onClick={onClose}>
      <div className="bx-sheet" style={s.sheet} onClick={(e) => e.stopPropagation()}>
        <div style={s.sheetGrip} />
        <div style={{ ...s.sheetTitle, color: k.color, display: "flex", alignItems: "center", gap: 8 }}>{k.icon(22)} Alege {cat === BURSA_CATEGORY_PERF ? "un Prinț" : "un Broscoi"}</div>
        <div style={s.sheetSub}>{list.length} colegi activi. Un coleg poate fi ales o singură dată.</div>
        <div style={s.grid}>
          {list.map((uid) => {
            const isTaken = taken.has(uid);
            const isCur = uid === current;
            return (
              <button
                key={uid} type="button" disabled={isTaken}
                className="bx-cell"
                style={{ ...s.cell, ...(isCur ? { borderColor: k.color, background: k.bg } : {}), ...(isTaken ? s.cellTaken : {}) }}
                onClick={() => onPick(uid)}
              >
                <PlayerAvatar avatarId={avatarOf(uid)} nickname={nameOf(uid)} size={48} />
                <span style={s.cellName}>{nameOf(uid)}</span>
                {isTaken && <span style={s.cellTag}>ales deja</span>}
              </button>
            );
          })}
        </div>
        <button type="button" style={s.ghostBtnWide} onClick={onClose}>Închide</button>
      </div>
    </div>
  );
}

function AnimatedNumber({ value, style }) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return undefined;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setShown(value); fromRef.current = value; return undefined; }
    let raf; const t0 = performance.now(); const dur = 650;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(from + (value - from) * e));
      if (p < 1) raf = requestAnimationFrame(tick); else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); fromRef.current = value; };
  }, [value]);
  return <span style={style}>{shown}</span>;
}

function outcomeText(r, isBye) {
  if (!r?.participated) return "n-a participat · 0 PCT";
  if (isBye) return "fără adversar · +25";
  return {
    win: "conduce · +50", lose: "în urmă · +0", tie: "egalitate · +25",
    walkover: "adversar absent · +50", unpaired: "fără duel",
  }[r.outcome] || "";
}

function DuelHero({ me, oppUid, mine, opp, isBye, final }) {
  const { nameOf, avatarOf } = usePlayers();
  const side = (uid, r, tone, align) => (
    <div style={{ ...s.side, alignItems: align, opacity: r?.participated ? 1 : 0.55 }}>
      <span style={{ ...s.sideRing, boxShadow: `0 0 0 2px ${tone}` }}>
        <PlayerAvatar avatarId={avatarOf(uid)} nickname={nameOf(uid)} size={58} />
      </span>
      <span style={s.sideName}>{nameOf(uid)}</span>
      <AnimatedNumber value={r?.raw || 0} style={{ ...s.raw, color: tone }} />
      <span style={s.rawLbl}>scor brut</span>
      <span style={s.sideOutcome}>{outcomeText(r, isBye && uid === me)}</span>
    </div>
  );
  const diff = (mine?.raw || 0) - (opp?.raw || 0);
  const span = Math.max(1, Math.abs(diff), 75);
  const pos = oppUid ? Math.max(4, Math.min(96, 50 + (diff / span) * 46)) : 50;

  return (
    <section style={s.hero}>
      <div style={s.heroTop}>
        {side(me, mine, C.me, "flex-start")}
        <div style={s.vs}>{oppUid ? "vs" : "bye"}</div>
        {oppUid ? side(oppUid, opp, C.opp, "flex-end") : (
          <div style={{ ...s.side, alignItems: "flex-end", justifyContent: "center" }}>
            <span style={s.byeText}>Fără adversar în etapa asta. Joci normal și primești +25 dacă ai participat.</span>
          </div>
        )}
      </div>

      {oppUid && (
        <div style={s.tug} aria-label="Cine conduce duelul">
          <div style={s.tugTrack}>
            <div style={{ ...s.tugFillMe, width: `${pos}%` }} />
            <div style={{ ...s.tugKnob, left: `calc(${pos}% - 7px)` }} />
          </div>
          <div style={s.tugLbl}>
            {diff === 0 ? "Egal la scor brut" : `${nameOf(diff > 0 ? me : oppUid)} conduce cu ${Math.abs(diff)}`}
          </div>
        </div>
      )}

      <div style={s.scoreGrid}>
        <ScoreCol r={mine} tone={C.me} />
        {oppUid && <ScoreCol r={opp} tone={C.opp} />}
      </div>
      <div style={s.heroFoot}>
        {final ? "Punctaj definitiv — etapa a fost finalizată." : "Provizoriu până la finalizarea etapei."}
      </div>
    </section>
  );
}

function ScoreCol({ r, tone }) {
  const rows = [
    ["Bază (max 150)", r?.participated ? r.base : 0],
    ["Bonus duel", r?.participated ? r.duelBonus : 0],
  ];
  return (
    <div style={s.scoreCol}>
      {rows.map(([l, v]) => (
        <div key={l} style={s.scoreRow}><span style={s.scoreL}>{l}</span><span style={s.scoreV}>{v}</span></div>
      ))}
      <div style={{ ...s.scoreRow, borderTop: `1px solid ${C.line}`, paddingTop: 6 }}>
        <span style={{ ...s.scoreL, color: C.text }}>Total</span>
        <AnimatedNumber value={r?.total || 0} style={{ ...s.scoreTotal, color: tone }} />
      </div>
    </div>
  );
}

// ── Grafic SVG pur, fără librării. Axa X are toate validările
// scenariului; liniile cresc pe măsură ce se validează meciuri. ──
function DuelChart({ series, totalSteps, hasOpp }) {
  const W = 340, H = 180, padL = 30, padR = 14, padT = 12, padB = 22;
  const maxRaw = Math.max(BURSA_BASE_CAP, ...series.map((p) => Math.max(p.rawA, p.rawB)));
  const yMax = Math.min(300, Math.ceil((maxRaw + 1) / 75) * 75);
  const x = (i) => padL + (totalSteps <= 1 ? 0 : (i / (totalSteps - 1)) * (W - padL - padR));
  const y = (v) => padT + (1 - v / yMax) * (H - padT - padB);
  const path = (key) => series.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");
  const area = series.length > 1
    ? `${path("rawA")} L${x(series.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z` : "";
  const ticks = [];
  for (let v = 0; v <= yMax; v += 75) ticks.push(v);
  const last = series[series.length - 1];
  const k = series.length; // cheie: redesenează la fiecare validare nouă

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={s.chart} role="img" aria-label="Graficul duelului">
      <defs>
        <linearGradient id="bxAreaMe" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.me} stopOpacity="0.28" />
          <stop offset="100%" stopColor={C.me} stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke={C.line} />
          <text x={padL - 6} y={y(v) + 3} fill={C.faint} fontSize="9" textAnchor="end">{v}</text>
        </g>
      ))}
      <line x1={padL} x2={W - padR} y1={y(BURSA_BASE_CAP)} y2={y(BURSA_BASE_CAP)} stroke={C.faint} strokeDasharray="4 4" />
      {Array.from({ length: totalSteps }).map((_, i) => (
        <text key={i} x={x(i)} y={H - 6} fill={i < series.length ? C.dim : C.faint} fontSize="9" textAnchor="middle">{i === 0 ? "start" : `#${i}`}</text>
      ))}
      {area && <path key={`a${k}`} className="bx-fade" d={area} fill="url(#bxAreaMe)" />}
      {hasOpp && <path key={`o${k}`} className="bx-draw" pathLength="1000" d={path("rawB")} fill="none" stroke={C.opp} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />}
      <path key={`m${k}`} className="bx-draw" pathLength="1000" d={path("rawA")} fill="none" stroke={C.me} strokeWidth="2.8" strokeLinejoin="round" strokeLinecap="round" />
      {last && hasOpp && <circle cx={x(series.length - 1)} cy={y(last.rawB)} r="4" fill={C.opp} className="bx-pulse" />}
      {last && <circle cx={x(series.length - 1)} cy={y(last.rawA)} r="4.5" fill={C.me} className="bx-pulse" />}
    </svg>
  );
}

function rewardColor(cat, reward) {
  if (!reward) return C.faint;
  return CAT[cat].color;
}

function PortfolioTable({ title, who, data, tone }) {
  const { nameOf, avatarOf } = usePlayers();
  if (!data?.participated) {
    return (
      <section style={s.block}>
        <div style={s.blockHead}><span style={{ ...s.blockTitle, color: tone }}>{title}</span></div>
        <p style={s.note}>{nameOf(who)} nu a participat la {BURSA_PUBLIC_NAME} în etapa asta.</p>
      </section>
    );
  }
  return (
    <section style={s.block}>
      <div style={s.blockHead}>
        <span style={{ ...s.blockTitle, color: tone }}>{title}</span>
        <span style={s.blockMeta}>brut {data.raw}</span>
      </div>
      {data.selections.map((sel) => {
        const k = CAT[sel.category];
        return (
          <div key={`${sel.category}-${sel.slot}`} style={{ ...s.posRow, borderLeftColor: k.color }}>
            <AvatarWithBadge uid={sel.uid} size={36} cat={sel.category} />
            <div style={s.posMid}>
              <span style={s.posName}>{nameOf(sel.uid)}</span>
              <span style={{ ...s.posCat, color: k.color, display: "inline-flex", alignItems: "center", gap: 4 }}>{k.label}</span>
            </div>
            <div style={s.posRank}>
              <span style={s.posRankN}>{sel.rank ?? "—"}</span>
              <span style={s.posRankL}>loc</span>
            </div>
            <span key={`${sel.uid}-${sel.reward}`} className="bx-flash" style={{ ...s.posReward, color: rewardColor(sel.category, sel.reward) }}>
              +{sel.reward}
            </span>
          </div>
        );
      })}
    </section>
  );
}

function AllPortfolios({ eligibleUids, picksByUid, me, ranking, live, revealKey }) {
  const { nameOf, avatarOf } = usePlayers();
  const owners = eligibleUids.filter((u) => picksByUid[u]).sort((a, b) => (a === me ? -1 : b === me ? 1 : nameOf(a).localeCompare(nameOf(b), "ro")));
  const absent = eligibleUids.filter((u) => !picksByUid[u]);
  return (
    <div>
      {owners.map((owner, oi) => {
        const pf = picksByUid[owner];
        const picks = [
          ...pf.perf.map((u) => ({ u, cat: BURSA_CATEGORY_PERF })),
          ...pf.contra.map((u) => ({ u, cat: BURSA_CATEGORY_CONTRA })),
        ];
        return (
          <div key={owner} style={s.allRow}>
            <div style={s.allOwner}>
              <PlayerAvatar avatarId={avatarOf(owner)} nickname={nameOf(owner)} size={26} />
              <span style={{ ...s.allOwnerName, color: owner === me ? C.me : C.text }}>{nameOf(owner)}</span>
            </div>
            <div style={s.allPicks}>
              {picks.map(({ u, cat }, i) => (
                <div
                  key={`${revealKey}-${u}-${cat}`}
                  className={revealKey ? (cat === BURSA_CATEGORY_PERF ? "bx-flip bx-shine" : "bx-flip bx-plop") : ""}
                  style={{ ...s.flipCard, borderColor: CAT[cat].border, background: CAT[cat].bg, animationDelay: `${Math.min(oi, 8) * 90 + i * 70}ms` }}
                  title={`${nameOf(u)} · ${CAT[cat].label}`}
                >
                  <PlayerAvatar avatarId={avatarOf(u)} nickname={nameOf(u)} size={24} />
                  <span style={{ ...s.flipArrow, color: CAT[cat].color, display: "inline-flex" }}>{CAT[cat].icon(14)}</span>
                  {live && <span style={s.flipRank}>{ranking.byUid[u]?.rank ?? "—"}</span>}
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {absent.length > 0 && (
        <p style={s.note}>Nu au participat: {absent.map(nameOf).join(", ")}.</p>
      )}
    </div>
  );
}

// ══ ICONIȚE: 👑 coroană aurie (Prinț) și 🐸 broscoi simpatic (Broscoi) — SVG inline, fără fișiere noi ══
function PrinceIcon({ size = 16, anim = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={anim ? "bx-crown" : ""} style={{ flexShrink: 0, overflow: "visible" }}>
      <path d="M8 46 L5 20 L20 32 L32 12 L44 32 L59 20 L56 46 Z" fill="#F2C94C" stroke="#B8860B" strokeWidth="3" strokeLinejoin="round" />
      <rect x="8" y="46" width="48" height="9" rx="3" fill="#E0A81E" stroke="#B8860B" strokeWidth="3" />
      <circle cx="32" cy="12" r="4.6" fill="#FF6B81" stroke="#B8860B" strokeWidth="2" />
      <circle cx="5" cy="20" r="3.6" fill="#6BE3FF" stroke="#B8860B" strokeWidth="2" />
      <circle cx="59" cy="20" r="3.6" fill="#6BE3FF" stroke="#B8860B" strokeWidth="2" />
      <circle cx="32" cy="50.5" r="2.6" fill="#FFF3B0" /><circle cx="19" cy="50.5" r="2" fill="#FFF3B0" /><circle cx="45" cy="50.5" r="2" fill="#FFF3B0" />
    </svg>
  );
}

function FrogIcon({ size = 16, anim = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={anim ? "bx-frog" : ""} style={{ flexShrink: 0, overflow: "visible" }}>
      <ellipse cx="32" cy="41" rx="25" ry="19" fill="#5BD16A" stroke="#2E8B3E" strokeWidth="3" />
      <circle cx="19" cy="23" r="11" fill="#5BD16A" stroke="#2E8B3E" strokeWidth="3" />
      <circle cx="45" cy="23" r="11" fill="#5BD16A" stroke="#2E8B3E" strokeWidth="3" />
      <circle cx="19" cy="22.5" r="7.6" fill="#fff" /><circle cx="45" cy="22.5" r="7.6" fill="#fff" />
      <circle cx="21" cy="24" r="3.7" fill="#17261a" /><circle cx="43" cy="24" r="3.7" fill="#17261a" />
      <circle cx="22.3" cy="22.5" r="1.3" fill="#fff" /><circle cx="44.3" cy="22.5" r="1.3" fill="#fff" />
      <path d="M17 42 Q32 55 47 42" stroke="#2E8B3E" strokeWidth="3.2" fill="none" strokeLinecap="round" />
      <path d="M29.5 49.5 Q32 58 34.5 49.5 Z" fill="#FF6B81" />
      <ellipse cx="13.5" cy="44" rx="4.6" ry="3" fill="#FF9AA8" opacity="0.7" /><ellipse cx="50.5" cy="44" rx="4.6" ry="3" fill="#FF9AA8" opacity="0.7" />
    </svg>
  );
}

// Avatarul REAL al jucătorului + coroană (Prinț) sau broscoi (Broscoi).
function AvatarWithBadge({ uid, size, cat, anim }) {
  const { nameOf, avatarOf } = usePlayers();
  const badge = Math.max(15, Math.round(size * 0.5));
  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <PlayerAvatar avatarId={avatarOf(uid)} nickname={nameOf(uid)} size={size} />
      {cat === BURSA_CATEGORY_PERF ? (
        <span style={{ position: "absolute", top: -badge * 0.7, left: "50%", marginLeft: -badge / 2, transform: "rotate(-10deg)", pointerEvents: "none" }}>
          <PrinceIcon size={badge} anim={anim} />
        </span>
      ) : (
        <span style={{ position: "absolute", right: -badge * 0.4, bottom: -badge * 0.32, pointerEvents: "none" }}>
          <FrogIcon size={badge} anim />
        </span>
      )}
    </span>
  );
}

// ══ JOCUL REAL ═══════════════════════════════════════════════════════════════════════════════════════════
// Date: bursaGame.loadBursaGame (la deschidere) + instantaneul LIVE partizan (liveSnapshotStore, UN listener comun,
// doar după blocare) + istoricul validărilor (1 citire, reîncărcat doar când se schimbă versiunea instantaneului).
// Fără polling: un singur timer până la ora primului meci, ca să treacă singur în modul „blocat/dezvăluit”.
function BursaLive({ gameweekId, uid }) {
  const [game, setGame] = useState(null);
  const [error, setError] = useState("");
  const [snap, setSnap] = useState(null);
  const [entries, setEntries] = useState({});
  const [slots, setSlots] = useState(toSlots(null));
  const [editing, setEditing] = useState(false);
  const [picker, setPicker] = useState(null);
  const [justFilled, setJustFilled] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [revealKey, setRevealKey] = useState(0);
  const [reversalKey, setReversalKey] = useState(0);
  const dirtyRef = useRef(false);
  const wasLockedRef = useRef(null);
  const prevStepRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const g = await loadBursaGame(gameweekId, uid);
      setGame(g);
      setEntries(g.entries || {});
      if (!dirtyRef.current) setSlots(toSlots(g.myPortfolio));
      if (g.locked && wasLockedRef.current === false) { setShowAll(true); setRevealKey((k) => k + 1); } // tocmai s-a închis → dezvăluire
      wasLockedRef.current = g.locked;
      setError("");
    } catch (e) {
      console.error("Prinț sau Broscoi?: eroare la încărcare:", e);
      setError(e?.code === "permission-denied" ? "Jocul nu e disponibil încă (permisiuni)." : (e?.message || "Eroare la încărcare."));
    }
  }, [gameweekId, uid]);

  useEffect(() => { load(); }, [load]);

  // UN singur timer până la primul meci (nu polling) → ecranul trece singur în modul dezvăluit.
  useEffect(() => {
    if (!game || game.locked || game.resolved || !game.lockAtMs) return undefined;
    const ms = game.lockAtMs - Date.now() + 1500;
    if (ms <= 0) { load(); return undefined; }
    const t = setTimeout(load, Math.min(ms, 2147483000));
    return () => clearTimeout(t);
  }, [game, load]);

  // Instantaneul LIVE (listener COMUN, deja folosit de Header/Clasament) — doar după blocare.
  useEffect(() => {
    if (!game?.locked) return undefined;
    return subscribeToLiveSnapshot(gameweekId, setSnap);
  }, [game?.locked, gameweekId]);

  // Istoricul real: reîncărcat (1 citire) când apare o versiune nouă de instantaneu; Adminul îl scrie imediat după publicare.
  const snapVersion = snap?.snapshotVersion ?? null;
  useEffect(() => {
    if (!game?.locked || snapVersion == null) return undefined;
    let cancelled = false;
    const t = setTimeout(async () => {
      try { const e = await loadBursaHistoryEntries(gameweekId); if (!cancelled) setEntries(e); } catch (err) { /* grafic: rămâne ultimul cunoscut */ }
    }, 4000);
    return () => { cancelled = true; clearTimeout(t); };
  }, [snapVersion, game?.locked, gameweekId]);

  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(""), 1800); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { if (!reversalKey) return undefined; const t = setTimeout(() => setReversalKey(0), 2600); return () => clearTimeout(t); }, [reversalKey]);

  const players = game?.players || {};
  const nameOf = (u) => players[u]?.nickname || u;
  const avatarOf = (u) => players[u]?.avatarId || null;

  const locked = !!game?.locked;
  const resolved = !!game?.resolved;
  const rankingUids = game?.rankingUids || [];
  const amIn = rankingUids.includes(uid);
  const config = game?.config || { pairings: [], byePlayer: null };
  const myPortfolio = compact(slots);
  const myValid = validatePortfolio(myPortfolio, uid, rankingUids).ok;
  const stored = game?.myPortfolio ? compact(game.myPortfolio) : null;
  const storedValid = !!stored && validatePortfolio(stored, uid, rankingUids).ok;
  const dirty = JSON.stringify(myPortfolio) !== JSON.stringify(stored || { perf: [], contra: [] });
  const phase = resolved ? "final" : locked ? "live" : (storedValid && !dirty && !editing ? "saved" : "open");
  const live = phase === "live" || phase === "final";
  const editable = phase === "open" && amIn;

  const history = useMemo(
    () => buildHistoryFromEntries(entries, snap?.pointsByUid ? { version: snap.snapshotVersion, pointsByUid: snap.pointsByUid } : null),
    [entries, snap],
  );
  const step = history.length - 1;
  const pointsByUid = history[step].pointsByUid;
  const picksByUid = game?.picksByUid || {};

  const results = useMemo(() => (game && game.isBursa ? computeBursaResults({
    pairings: config.pairings, byePlayer: config.byePlayer, eligibleUids: rankingUids, validUids: game.frozenUids, picksByUid, pointsByUid,
  }) : null), [game, picksByUid, pointsByUid]); // eslint-disable-line react-hooks/exhaustive-deps
  const ranking = useMemo(() => buildBursaRanking(pointsByUid, rankingUids), [pointsByUid, game]); // eslint-disable-line react-hooks/exhaustive-deps
  const mine = results?.byUid?.[uid] || null;
  const myPair = (config.pairings || []).find((p) => p.playerA === uid || p.playerB === uid) || null;
  const oppUid = myPair ? (myPair.playerA === uid ? myPair.playerB : myPair.playerA) : null;
  const opp = oppUid ? results?.byUid?.[oppUid] || null : null;
  const series = useMemo(() => (live && game ? buildDuelSeries(history, {
    playerA: uid, playerB: oppUid, eligibleUids: rankingUids, validUids: game.frozenUids, picksByUid,
  }) : []), [live, history, uid, oppUid, game, picksByUid]); // eslint-disable-line react-hooks/exhaustive-deps
  const lastSeries = series[series.length - 1];

  useEffect(() => {
    if (!live) { prevStepRef.current = step; return; }
    if (prevStepRef.current !== null && prevStepRef.current !== step && lastSeries?.reversal) setReversalKey((k) => k + 1);
    prevStepRef.current = step;
  }, [step, live, lastSeries?.reversal]);

  function choose(u) {
    if (!picker) return;
    dirtyRef.current = true;
    setSlots((prev) => {
      const next = { perf: [...prev.perf], contra: [...prev.contra] };
      next[picker.cat][picker.idx] = u;
      return next;
    });
    setJustFilled(`${picker.cat}-${picker.idx}-${u}`);
    setPicker(null);
  }
  function clearSlot(cat, idx) {
    dirtyRef.current = true;
    setSlots((prev) => {
      const next = { perf: [...prev.perf], contra: [...prev.contra] };
      next[cat][idx] = null;
      return next;
    });
  }
  async function save() {
    if (!myValid || saving) return;
    setSaving(true);
    try {
      const saved = await saveBursaPortfolio(gameweekId, uid, myPortfolio, rankingUids);
      dirtyRef.current = false;
      setEditing(false);
      setGame((g) => ({ ...g, myPortfolio: normalizePortfolio(saved), picksByUid: { ...g.picksByUid, [uid]: normalizePortfolio(saved) } }));
      setError("");
      setToast("Portofoliu salvat");
    } catch (e) {
      console.error("Prinț sau Broscoi?: eroare la salvare:", e);
      setError(e?.code === "permission-denied" ? "Înscrierile s-au închis sau nu ai permisiunea să salvezi." : (e?.message || "Nu s-a putut salva."));
      if (/închis|rezolvat|permission|permisiun/i.test(String(e?.message || e?.code))) { dirtyRef.current = false; load(); }
    } finally {
      setSaving(false);
    }
  }

  if (!game) {
    return (
      <div style={s.page}>
        <style>{CSS}</style>
        <p style={s.note}>{error || "Se încarcă…"}</p>
      </div>
    );
  }
  if (!game.isBursa) {
    return <div style={s.page}><p style={s.note}>Jocul nu e configurat pentru etapa asta.</p></div>;
  }

  return (
    <PlayersCtx.Provider value={players}>
      <div style={s.page}>
        <style>{CSS}</style>
        {live && <Ticker ranking={ranking} validated={step} live={live} />}

        <header style={s.head}>
          <div>
            <div style={s.brand}>Play League Stock Exchange</div>
            <h1 style={s.title}>{BURSA_PUBLIC_NAME}</h1>
          </div>
          <PhaseBadge phase={phase} step={step} />
        </header>

        {error && <p style={{ ...s.note, color: C.down }}>{error}</p>}
        {!amIn && !locked && <p style={s.note}>Nu ești în lista de participanți a acestei etape.</p>}

        {!live && amIn && (
          <section style={s.block}>
            <div style={s.blockHead}>
              <span style={s.blockTitle}>Portofoliul tău</span>
              <span style={s.blockMeta}>{myPortfolio.perf.length + myPortfolio.contra.length}/4</span>
            </div>
            {[BURSA_CATEGORY_PERF, BURSA_CATEGORY_CONTRA].map((cat) => (
              <div key={cat} style={{ marginBottom: 10 }}>
                <div style={{ ...s.catLabel, color: CAT[cat].color, display: "flex", alignItems: "center", gap: 6 }}>
                  {CAT[cat].icon(20)}
                  <span>{cat === BURSA_CATEGORY_PERF ? "PRINȚI" : "BROSCOI"}</span>
                  <span style={{ color: C.dim, fontWeight: 500 }}>· {cat === BURSA_CATEGORY_PERF ? "crezi că performează" : "crezi că ratează"}</span>
                </div>
                <div style={s.slotRow}>
                  {[0, 1].map((idx) => (
                    <SlotCard
                      key={idx} cat={cat} uid={slots[cat][idx]} editable={editable}
                      pop={justFilled?.startsWith(`${cat}-${idx}-`)}
                      onOpen={() => editable && setPicker({ cat, idx })}
                      onClear={() => clearSlot(cat, idx)}
                    />
                  ))}
                </div>
              </div>
            ))}
            {phase === "open" && (
              <button type="button" style={{ ...s.cta, ...((myValid && !saving) ? {} : s.ctaOff) }} disabled={!myValid || saving} onClick={save}>
                {saving ? "Se salvează…" : myValid ? "Salvează portofoliul" : `Mai alege ${4 - myPortfolio.perf.length - myPortfolio.contra.length}`}
              </button>
            )}
            {phase === "saved" && (
              <div style={s.savedBox}>
                <div style={s.savedTitle}>✓ Portofoliu salvat</div>
                <div style={s.savedText}>Alegerile tale rămân secrete până la închiderea înscrierilor. Le poți schimba până atunci.</div>
                <button type="button" style={s.ghostBtn} onClick={() => setEditing(true)}>Modific</button>
              </div>
            )}
          </section>
        )}

        {live && !amIn && (
          <p style={s.note}>Nu ai fost în lista de participanți a acestei etape — poți vedea însă portofoliile și clasamentul celorlalți.</p>
        )}
        {live && amIn && (
          <>
            <DuelHero me={uid} oppUid={oppUid} mine={mine} opp={opp} isBye={!!mine?.isBye} final={phase === "final"} />
            <section style={s.block}>
              <div style={s.blockHead}>
                <span style={s.blockTitle}>Evoluția duelului</span>
                <span style={s.blockMeta}>scor brut după fiecare validare</span>
              </div>
              <DuelChart series={series} totalSteps={Math.max(series.length, 2)} hasOpp={!!oppUid} />
              <div style={s.legend}>
                <span><i style={{ ...s.legendDot, background: C.me }} /> {nameOf(uid)}</span>
                {oppUid && <span><i style={{ ...s.legendDot, background: C.opp }} /> {nameOf(oppUid)}</span>}
                <span style={{ color: C.faint }}>- - plafon {BURSA_BASE_CAP}</span>
              </div>
            </section>
            <PortfolioTable title="Portofoliul tău" who={uid} data={mine} tone={C.me} />
            {oppUid && <PortfolioTable title={`Portofoliul lui ${nameOf(oppUid)}`} who={oppUid} data={opp} tone={C.opp} />}
          </>
        )}

        {live && (
          <section style={s.block}>
            <button type="button" style={s.toggleRow} onClick={() => setShowAll((v) => !v)}>
              <span style={s.blockTitle}>Toate portofoliile</span>
              <span style={s.blockMeta}>{showAll ? "ascunde" : "arată"}</span>
            </button>
            {showAll && (
              <AllPortfolios eligibleUids={rankingUids} picksByUid={picksByUid} me={uid} ranking={ranking} live={live} revealKey={revealKey} />
            )}
          </section>
        )}

        {picker && (
          <PickerSheet
            cat={picker.cat} me={uid} eligibleUids={rankingUids} slots={slots}
            current={slots[picker.cat][picker.idx]} onPick={choose} onClose={() => setPicker(null)}
          />
        )}

        {reversalKey > 0 && (
          <div key={reversalKey} className="bx-rev" style={s.revWrap} aria-live="assertive">
            <div style={s.revCard}>
              <div style={s.revKicker}>Liderul s-a schimbat</div>
              <div style={s.revText}>RĂSTURNARE DE SITUAȚIE!</div>
              <div style={s.revWho}>
                <PlayerAvatar avatarId={avatarOf(lastSeries?.leader === "A" ? uid : oppUid)} nickname={nameOf(lastSeries?.leader === "A" ? uid : oppUid)} size={34} />
                <span>{nameOf(lastSeries?.leader === "A" ? uid : oppUid)} trece în față</span>
              </div>
            </div>
          </div>
        )}

        {toast && <div className="bx-toast" style={s.toast}>{toast}</div>}
      </div>
    </PlayersCtx.Provider>
  );
}

const CSS = `
@keyframes bxPop { 0% { transform: scale(0.82); } 60% { transform: scale(1.06); } 100% { transform: scale(1); } }
@keyframes bxSheet { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes bxDraw { from { stroke-dashoffset: 1000; } to { stroke-dashoffset: 0; } }
@keyframes bxFade { from { opacity: 0; } to { opacity: 1; } }
@keyframes bxPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.45; } }
@keyframes bxFlip { 0% { transform: perspective(400px) rotateY(90deg); opacity: 0; } 100% { transform: perspective(400px) rotateY(0); opacity: 1; } }
@keyframes bxFlash { 0% { transform: scale(1.35); filter: brightness(1.6); } 100% { transform: scale(1); filter: none; } }
@keyframes bxTicker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@keyframes bxBlink { 0%,100% { opacity: 1; } 50% { opacity: 0.2; } }
@keyframes bxRev { 0% { opacity: 0; transform: scale(0.6) rotate(-4deg); } 18% { opacity: 1; transform: scale(1.08) rotate(1deg); } 30% { transform: scale(1) rotate(0); } 82% { opacity: 1; } 100% { opacity: 0; transform: scale(0.96); } }
@keyframes bxCrown { 0% { transform: translateY(-14px) rotate(-18deg) scale(0.7); opacity: 0; } 60% { transform: translateY(2px) rotate(-8deg) scale(1.12); opacity: 1; } 100% { transform: none; } }
@keyframes bxFail { 0%, 72%, 100% { transform: none; } 78% { transform: rotate(-16deg) translateY(1px); } 85% { transform: rotate(11deg); } 92% { transform: rotate(-5deg); } }
@keyframes bxPlop { 0% { transform: perspective(400px) rotateY(90deg) scale(0.7); opacity: 0; } 55% { transform: perspective(400px) rotateY(0) scale(1.14, 0.86); opacity: 1; } 80% { transform: scale(0.96, 1.06); } 100% { transform: none; } }
@keyframes bxShine { 0% { box-shadow: 0 0 0 rgba(242,201,76,0); } 45% { box-shadow: 0 0 16px rgba(242,201,76,0.65); } 100% { box-shadow: 0 0 0 rgba(242,201,76,0); } }
@keyframes bxToast { 0% { opacity: 0; transform: translate(-50%, 12px); } 15%,85% { opacity: 1; transform: translate(-50%, 0); } 100% { opacity: 0; } }
.bx-pop { animation: bxPop 380ms ease-out; }
.bx-crown { animation: bxCrown 520ms ease-out both; }
.bx-frog { animation: bxFail 4.6s ease-in-out infinite; transform-origin: 50% 88%; }
.bx-plop { animation: bxPlop 620ms ease-out both; }
.bx-shine { animation: bxFlip 480ms ease-out both, bxShine 1100ms ease-out 480ms 1; }
.bx-sheet { animation: bxSheet 260ms ease-out; }
.bx-draw { stroke-dasharray: 1000; animation: bxDraw 900ms ease-out both; }
.bx-fade { animation: bxFade 700ms ease-out both; }
.bx-pulse { animation: bxPulse 1.6s ease-in-out infinite; }
.bx-flip { animation: bxFlip 480ms ease-out both; }
.bx-flash { display: inline-block; animation: bxFlash 600ms ease-out; }
.bx-ticker { animation: bxTicker 38s linear infinite; }
.bx-blink { animation: bxBlink 1.2s ease-in-out infinite; }
.bx-rev { animation: bxRev 2600ms ease-out both; }
.bx-toast { animation: bxToast 1800ms ease-out both; }
.bx-cell:active { transform: scale(0.94); }
@media (prefers-reduced-motion: reduce) {
  .bx-pop, .bx-sheet, .bx-draw, .bx-fade, .bx-pulse, .bx-flip, .bx-flash, .bx-ticker, .bx-blink, .bx-crown, .bx-frog, .bx-plop, .bx-shine { animation: none !important; stroke-dashoffset: 0 !important; }
}
`;

const s = {
  page: { background: C.bg, color: C.text, fontFamily: font.body, borderRadius: 18, padding: "0 12px 18px", position: "relative", overflow: "hidden", minHeight: 400 },
  note: { color: C.dim, fontSize: 13, lineHeight: 1.45, margin: "6px 0" },

  tickerWrap: { margin: "0 -12px 12px", borderBottom: `1px solid ${C.line}`, background: "#04060A", overflow: "hidden", whiteSpace: "nowrap" },
  tickerTrack: { display: "inline-flex", gap: 18, padding: "7px 12px", fontSize: 11.5, color: C.dim, fontVariantNumeric: "tabular-nums" },
  tick: { flexShrink: 0 },
  tickPts: { color: C.text, fontWeight: 700 },

  head: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 14 },
  brand: { fontSize: 11, color: C.dim, letterSpacing: 0.4 },
  title: { margin: "2px 0 0", fontFamily: font.display, fontSize: 25, fontWeight: 700, lineHeight: 1.05, letterSpacing: 0.3 },
  badge: { display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid", borderRadius: 999, padding: "5px 10px", fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap", marginTop: 4 },
  badgeDot: { width: 7, height: 7, borderRadius: "50%", display: "inline-block" },

  block: { background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 12, marginBottom: 12 },
  blockHead: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10, gap: 8 },
  blockTitle: { fontFamily: font.display, fontSize: 17, fontWeight: 600 },
  blockMeta: { fontSize: 11.5, color: C.dim },
  catLabel: { fontSize: 12.5, fontWeight: 700, marginBottom: 6 },

  slotRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  slot: { position: "relative", border: "1px solid", borderRadius: 14, minHeight: 128, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" },
  slotEmpty: { background: "transparent", borderStyle: "dashed", color: C.dim, cursor: "pointer", gap: 4 },
  slotPlus: { fontSize: 30, lineHeight: 1, fontWeight: 300 },
  slotEmptyText: { fontSize: 12.5 },
  slotMain: { background: "none", border: "none", color: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 6px", width: "100%", cursor: "pointer" },
  slotRing: { borderRadius: "50%", display: "inline-flex" },
  slotName: { fontWeight: 700, fontSize: 14, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  slotCat: { fontSize: 11.5, fontWeight: 700 },
  slotX: { position: "absolute", top: 4, right: 6, background: "none", border: "none", color: C.dim, fontSize: 20, lineHeight: 1, padding: 6, cursor: "pointer" },

  cta: { width: "100%", marginTop: 4, padding: "14px 16px", borderRadius: 12, border: "none", background: C.up, color: "#04140B", fontWeight: 800, fontSize: 15, cursor: "pointer" },
  ctaOff: { background: C.panelHi, color: C.faint, cursor: "default" },
  savedBox: { border: `1px solid ${C.upBorder}`, background: C.upBg, borderRadius: 12, padding: 12, marginTop: 4 },
  savedTitle: { fontWeight: 800, color: C.up, marginBottom: 4 },
  savedText: { fontSize: 13, color: C.dim, lineHeight: 1.45, marginBottom: 10 },
  ghostBtn: { background: "transparent", border: `1px solid ${C.line}`, color: C.text, borderRadius: 10, padding: "9px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer" },
  ghostBtnWide: { width: "100%", marginTop: 12, background: "transparent", border: `1px solid ${C.line}`, color: C.text, borderRadius: 12, padding: "12px", fontWeight: 700, cursor: "pointer" },

  hero: { background: `linear-gradient(180deg, ${C.panelHi}, ${C.panel})`, border: `1px solid ${C.line}`, borderRadius: 18, padding: 14, marginBottom: 12 },
  heroTop: { display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 6 },
  side: { display: "flex", flexDirection: "column", gap: 2, minWidth: 0 },
  sideRing: { borderRadius: "50%", display: "inline-flex", marginBottom: 4 },
  sideName: { fontWeight: 700, fontSize: 14, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  raw: { fontFamily: font.display, fontSize: 46, fontWeight: 700, lineHeight: 1, fontVariantNumeric: "tabular-nums" },
  rawLbl: { fontSize: 11, color: C.dim },
  sideOutcome: { fontSize: 11.5, color: C.text, marginTop: 4, fontWeight: 600 },
  vs: { fontFamily: font.display, fontSize: 15, color: C.faint, padding: "0 4px" },
  byeText: { fontSize: 12.5, color: C.dim, textAlign: "right", lineHeight: 1.45 },

  tug: { marginTop: 14 },
  tugTrack: { position: "relative", height: 8, borderRadius: 999, background: "rgba(143,194,255,0.35)", overflow: "visible" },
  tugFillMe: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 999, background: C.me, transition: "width 700ms cubic-bezier(.2,.8,.2,1)" },
  tugKnob: { position: "absolute", top: -3, width: 14, height: 14, borderRadius: "50%", background: C.text, boxShadow: "0 0 10px rgba(255,255,255,0.5)", transition: "left 700ms cubic-bezier(.2,.8,.2,1)" },
  tugLbl: { fontSize: 12, color: C.dim, marginTop: 7, textAlign: "center" },

  scoreGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 },
  scoreCol: { background: "rgba(0,0,0,0.25)", borderRadius: 12, padding: "8px 10px" },
  scoreRow: { display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 12.5, padding: "2px 0" },
  scoreL: { color: C.dim },
  scoreV: { fontWeight: 700, fontVariantNumeric: "tabular-nums" },
  scoreTotal: { fontFamily: font.display, fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" },
  heroFoot: { fontSize: 11.5, color: C.faint, marginTop: 10, textAlign: "center" },

  chart: { width: "100%", height: "auto", display: "block" },
  legend: { display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11.5, color: C.dim, marginTop: 6 },
  legendDot: { display: "inline-block", width: 9, height: 9, borderRadius: 2, marginRight: 4, verticalAlign: "-1px" },

  posRow: { display: "flex", alignItems: "center", gap: 10, padding: "8px 8px 8px 10px", borderLeft: "3px solid", borderRadius: 8, background: "rgba(255,255,255,0.02)", marginBottom: 6 },
  posMid: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column" },
  posName: { fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  posCat: { fontSize: 11, fontWeight: 700 },
  posRank: { display: "flex", flexDirection: "column", alignItems: "center", minWidth: 34 },
  posRankN: { fontFamily: font.display, fontSize: 19, fontWeight: 700, lineHeight: 1, fontVariantNumeric: "tabular-nums" },
  posRankL: { fontSize: 10, color: C.faint },
  posReward: { fontFamily: font.display, fontSize: 22, fontWeight: 700, minWidth: 48, textAlign: "right", fontVariantNumeric: "tabular-nums" },

  toggleRow: { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "baseline", background: "none", border: "none", color: C.text, padding: 0, cursor: "pointer" },
  allRow: { display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderTop: `1px solid ${C.line}` },
  allOwner: { display: "flex", alignItems: "center", gap: 6, width: 104, flexShrink: 0, minWidth: 0 },
  allOwnerName: { fontSize: 12.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  allPicks: { display: "flex", gap: 5, flex: 1, justifyContent: "flex-end" },
  flipCard: { position: "relative", display: "flex", alignItems: "center", gap: 2, border: "1px solid", borderRadius: 999, padding: "2px 6px 2px 2px" },
  flipArrow: { fontSize: 10, fontWeight: 800 },
  flipRank: { fontSize: 10, color: C.dim, fontVariantNumeric: "tabular-nums" },

  simBox: { border: `1px dashed ${C.faint}`, borderRadius: 14, padding: 10, marginTop: 4 },
  simTitle: { fontSize: 11.5, color: C.dim, marginBottom: 8 },
  simRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  simBtn: { flex: "1 1 auto", padding: "11px 12px", borderRadius: 10, border: "none", background: C.opp, color: "#06101E", fontWeight: 800, fontSize: 13, cursor: "pointer" },
  simBtnGhost: { flex: "0 1 auto", padding: "11px 12px", borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", color: C.text, fontWeight: 700, fontSize: 13, cursor: "pointer" },
  simHint: { fontSize: 12.5, color: C.dim },

  sheetBack: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 2000, display: "flex", alignItems: "flex-end", justifyContent: "center" },
  sheet: { width: "100%", maxWidth: 480, maxHeight: "82vh", overflowY: "auto", background: C.panel, borderTop: `1px solid ${C.line}`, borderRadius: "20px 20px 0 0", padding: "8px 14px calc(16px + env(safe-area-inset-bottom, 0px))" },
  sheetGrip: { width: 40, height: 4, borderRadius: 4, background: C.faint, margin: "4px auto 12px" },
  sheetTitle: { fontFamily: font.display, fontSize: 20, fontWeight: 700 },
  sheetSub: { fontSize: 12.5, color: C.dim, margin: "4px 0 12px" },
  grid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 },
  cell: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "10px 4px", borderRadius: 12, border: `1px solid ${C.line}`, background: C.panelHi, color: C.text, cursor: "pointer", transition: "transform 120ms" },
  cellTaken: { opacity: 0.35, cursor: "default" },
  cellName: { fontSize: 12.5, fontWeight: 700, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  cellTag: { fontSize: 10, color: C.dim },

  revWrap: { position: "fixed", inset: 0, zIndex: 2100, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", background: "radial-gradient(circle, rgba(242,201,76,0.18), rgba(0,0,0,0) 60%)" },
  revCard: { textAlign: "center", padding: "18px 20px", borderRadius: 18, background: "rgba(6,9,15,0.92)", border: `1px solid ${C.me}`, boxShadow: `0 0 40px rgba(242,201,76,0.35)`, maxWidth: 320 },
  revKicker: { fontSize: 12, color: C.dim },
  revText: { fontFamily: font.display, fontSize: 30, fontWeight: 700, color: C.me, lineHeight: 1.05, margin: "6px 0 10px" },
  revWho: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 13.5, fontWeight: 700 },

  toast: { position: "fixed", left: "50%", bottom: 28, zIndex: 2100, background: C.up, color: "#04140B", padding: "10px 16px", borderRadius: 999, fontWeight: 800, fontSize: 13.5 },
};
