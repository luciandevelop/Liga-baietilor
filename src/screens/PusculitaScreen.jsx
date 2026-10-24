import { useEffect, useMemo, useRef, useState } from "react";
import PlayerAvatar from "../components/PlayerAvatar";
import { font } from "../matchdayTheme";
import useNow from "../hooks/useNow";
import { auth } from "../firebase";
import { listActiveUserIds } from "../services/adminService";
import { getUserPublicProfiles } from "../services/profilesService";
import {
  PUSCULITA_STOP_POT, PUSCULITA_PODIUM_CAP, VOTE_CONTINUE,
} from "../services/pusculitaService";
import { buildPusculitaMockView, PUSCULITA_MOCK_PLAYERS, PUSCULITA_MOCK_ME } from "../pusculitaMockData";

// ══════════════════════════════════════════════════════════════════
// 🐷 PUȘCULIȚA — ECRANUL DE JOC (ETAPA 2: DOAR PREVIEW ADMIN / DEMO)
//
// Toate rezultatele vin din pusculitaService.js (prin datele DEMO). Ecranul
// doar le PREZINTĂ: animațiile nu calculează și nu schimbă nimic.
// Zero scrieri în Firestore. Singura citire: profilele jucătorilor activi
// (nume + avatar), o dată, din cache-ul existent — ca demo-ul să arate cu
// oamenii reali. Fără previewMode, ecranul nu face nimic (jocul nu e activ).
//
// AVATARE SEZONUL 3: deocamdată avatarele actuale. Când există avatarele
// oficiale (Front Man, VIP, gardieni, concurenți), se completează
// SEASON3_AVATAR_BY_UID / SEASON3_ROLE_BY_UID — restul ecranului nu se schimbă.
// ══════════════════════════════════════════════════════════════════

export const SEASON3_AVATAR_BY_UID = {};   // { uid: avatarId oficial S3 }
export const SEASON3_ROLE_BY_UID = {};     // { uid: "frontman" | "vip" | "gardian" | "concurent" }

const C = {
  bg: "#041614",
  floor: "#0A2724",
  panel: "rgba(9,38,35,0.82)",
  line: "rgba(173,255,230,0.10)",
  text: "#EAF6F2",
  dim: "#8DB3AA",
  faint: "#557A72",
  mint: "#2FBF9A",      // trening verde
  pink: "#FF2D7A",      // gardieni
  red: "#FF4053",       // zona de eliminare
  gold: "#F5C451",      // pragul + pușculița
  glass: "rgba(190,255,240,0.10)",
};

// Numerele de pe trening (decor, deterministe pe loc).
const SHIRT_NUMBERS = ["001", "067", "101", "199", "456", "218", "240", "322", "333", "388", "007", "119", "212", "278", "096"];

const STATE_TAB = { C: "arena", F: "arena", H: "arena", D: "vote", E: "vote", G: "vote", I: "vote", J: "podium" };

export default function PusculitaScreen({ previewMode, previewState = "A" }) {
  if (!previewMode) {
    return <div style={{ ...s.page, padding: 20 }}><p style={s.note}>Pușculița nu este încă activă.</p></div>;
  }
  return <PusculitaPreview stateId={previewState} />;
}

function PusculitaPreview({ stateId }) {
  const view = useMemo(() => buildPusculitaMockView(stateId), [stateId]);
  const who = useRoster();
  const [tab, setTab] = useState(STATE_TAB[stateId] || "arena");
  const [vertical, setVertical] = useState(false);
  useEffect(() => { setTab(STATE_TAB[stateId] || "arena"); }, [stateId]);

  const content = (
    <div style={{ ...s.page, ...(vertical ? s.pageVertical : {}) }}>
      <style>{CSS}</style>
      <Header view={view} who={who} />
      <div style={s.tabs}>
        {[["arena", "Arena"], ["vote", "Sala voturilor"], ["podium", "Podium"]].map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)} style={{ ...s.tab, ...(tab === k ? s.tabOn : {}) }}>{l}</button>
        ))}
      </div>
      {tab === "arena" && <Arena key={`a-${stateId}`} view={view} who={who} />}
      {tab === "vote" && <VoteHall key={`v-${stateId}`} view={view} who={who} />}
      {tab === "podium" && <Podium view={view} who={who} />}
    </div>
  );

  return (
    <>
      <div style={s.adminBar}>
        <span style={s.adminNote}>DEMO · nimic nu se salvează{who.real ? "" : " · nume de test"}</span>
        <button type="button" style={s.adminBtn} onClick={() => setVertical(true)}>📱 Mod 9:16</button>
      </div>
      {vertical ? (
        <div style={s.verticalBack}>
          <div style={s.verticalFrame}>{content}</div>
          <button type="button" aria-label="Ieși din modul 9:16" style={s.verticalExit} onClick={() => setVertical(false)}>✕</button>
        </div>
      ) : content}
    </>
  );
}

// ── Jucătorii activi reali pe locurile din scenariu (Adminul = „eu”). ──
function useRoster() {
  const [map, setMap] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const uids = [...(await listActiveUserIds())];
        const prof = await getUserPublicProfiles(uids);
        const me = auth.currentUser?.uid;
        const others = uids.filter((u) => u !== me)
          .sort((a, b) => String(prof[a]?.nickname || "").localeCompare(String(prof[b]?.nickname || ""), "ro"));
        const slots = PUSCULITA_MOCK_PLAYERS.map((p) => p.uid);
        const out = {};
        if (me && uids.includes(me)) out[PUSCULITA_MOCK_ME] = { nickname: prof[me]?.nickname || "Eu", avatarId: prof[me]?.avatarId ?? null, realUid: me };
        const queue = [...others];
        slots.forEach((sid) => {
          if (out[sid]) return;
          const u = queue.shift();
          if (u) out[sid] = { nickname: prof[u]?.nickname || "Jucător", avatarId: prof[u]?.avatarId ?? null, realUid: u };
        });
        if (alive) setMap(out);
      } catch (e) {
        console.warn("Pușculița DEMO: profilele nu s-au putut încărca, folosesc nume de test.", e?.message || e);
        if (alive) setMap({});
      }
    })();
    return () => { alive = false; };
  }, []);
  return useMemo(() => {
    const base = Object.fromEntries(PUSCULITA_MOCK_PLAYERS.map((p) => [p.uid, p]));
    const m = map || {};
    return {
      real: Object.keys(m).length > 0,
      name: (uid) => m[uid]?.nickname || base[uid]?.nickname || "Jucător",
      avatar: (uid) => {
        const real = m[uid]?.realUid;
        return (real && SEASON3_AVATAR_BY_UID[real]) || m[uid]?.avatarId || null;
      },
      number: (uid) => SHIRT_NUMBERS[PUSCULITA_MOCK_PLAYERS.findIndex((p) => p.uid === uid)] || "000",
      me: PUSCULITA_MOCK_ME,
    };
  }, [map]);
}

function Avatar({ uid, who, size = 36, ring }) {
  return (
    <span style={{ position: "relative", display: "inline-flex", borderRadius: "50%", boxShadow: ring ? `0 0 0 2px ${ring}` : "none", flexShrink: 0 }}>
      <PlayerAvatar avatarId={who.avatar(uid)} nickname={who.name(uid)} size={size} />
      {size >= 30 && <span style={{ ...s.shirt, fontSize: Math.max(8, size * 0.2) }}>{who.number(uid)}</span>}
    </span>
  );
}

// ── Starea curentă, citită din rezultatul motorului. ──
function currentStage(view) {
  const { timeline, outcome } = view.result;
  const last = timeline[timeline.length - 1];
  return { last, outcome, roundIndex: last ? last.index : 0 };
}

function Header({ view, who }) {
  const { last, outcome, roundIndex } = currentStage(view);
  const now = useNow(1000);
  const startRef = useRef(Date.now());
  const remaining = Math.max(0, startRef.current + (outcome.reason === "vote_open" ? 9 * 3600e3 + 14 * 60e3 : 3 * 3600e3 + 20 * 60e3) - now);
  const h = Math.floor(remaining / 3600e3), m = Math.floor((remaining % 3600e3) / 60e3), sec = Math.floor((remaining % 60e3) / 1000);
  const timerLabel = outcome.status === "ended" ? "Joc încheiat"
    : outcome.reason === "vote_open" ? "Votul se închide în"
      : "Următorul meci în";
  const rounds = view.input.rounds;
  return (
    <header style={s.header}>
      <div style={s.brandRow}>
        <span style={s.shapes} aria-hidden="true"><i style={s.shCircle} /><i style={s.shTri} /><i style={s.shSquare} /></span>
        <h1 style={s.title}>Pușculița</h1>
      </div>
      <div style={s.program}>
        {rounds.map((r, i) => {
          const t = view.result.timeline[i];
          const state = !t ? "next" : t.complete ? "done" : "live";
          const ended = outcome.status === "ended" && !t;
          return (
            <div key={i} style={{ ...s.roundChip, ...(state === "live" ? s.roundLive : {}), ...(state === "done" ? s.roundDone : {}), ...(ended ? s.roundOff : {}) }}>
              <span style={s.roundNo}>Runda {i + 1}</span>
              <span style={s.roundMeta}>{r.matchIds.length} meciuri · prag {r.thresholdPerMatch * r.matchIds.length}</span>
            </div>
          );
        })}
      </div>
      <div style={s.timerRow}>
        <span style={s.timerLabel}>{timerLabel}</span>
        {outcome.status !== "ended" && (
          <span style={s.timer}>{String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(sec).padStart(2, "0")}</span>
        )}
        <span style={s.roundNow}>Runda {roundIndex + 1}{last?.provisional ? ` · ${view.input.validatedInRound ?? 0}/${view.input.rounds[roundIndex].matchIds.length} meciuri validate` : ""}</span>
      </div>
    </header>
  );
}

// ══════════════════════════════════════════════════════════════════
// ARENA: pușculița + clasamentul rundei + animația eliminărilor
// ══════════════════════════════════════════════════════════════════
function Arena({ view, who }) {
  const { last, outcome } = currentStage(view);
  const timeline = view.result.timeline;
  const prevFallen = timeline.slice(0, last ? last.index : 0).flatMap((t) => t.eliminated);
  const current = last?.complete ? last.eliminated : [];
  const [step, setStep] = useState(0); // câți din eliminații rundei au căzut deja
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return undefined;
    if (step >= current.length) { setPlaying(false); return undefined; }
    const t = setTimeout(() => setStep((x) => x + 1), step === 0 ? 700 : 1100);
    return () => clearTimeout(t);
  }, [playing, step, current.length]);

  const fallen = [...prevFallen, ...current.slice(0, step)];
  const justFell = step > 0 ? current[step - 1] : null;
  const potLabel = outcome.reason === "final" ? `${PUSCULITA_PODIUM_CAP}` : `${PUSCULITA_STOP_POT}`;

  return (
    <section>
      <PiggyBank fallen={fallen} justFell={playing || step > 0 ? justFell : null} who={who} value={potLabel} />

      {current.length > 0 && (
        <div style={s.controls}>
          <button type="button" style={s.ctrlMain} onClick={() => { setStep(0); setPlaying(true); }}>
            {step === 0 ? "▶ Pornește eliminările" : "↺ Reia eliminările"}
          </button>
          <button type="button" style={s.ctrlGhost} onClick={() => { setPlaying(false); setStep(current.length); }}>Sari la final</button>
        </div>
      )}

      <SpecialBanner outcome={outcome} who={who} />

      {last && <Ranking entry={last} who={who} revealed={step} current={current} />}
    </section>
  );
}

function PiggyBank({ fallen, justFell, who, value }) {
  return (
    <div style={s.piggyWrap}>
      <div style={s.spot} aria-hidden="true" />
      <div style={s.wire} aria-hidden="true" />
      <div style={s.piggy}>
        <svg viewBox="0 0 320 220" style={s.piggySvg} aria-hidden="true">
          <defs>
            <radialGradient id="pgGlass" cx="45%" cy="35%" r="70%">
              <stop offset="0%" stopColor="rgba(255,240,200,0.20)" />
              <stop offset="60%" stopColor="rgba(190,255,240,0.07)" />
              <stop offset="100%" stopColor="rgba(190,255,240,0.03)" />
            </radialGradient>
          </defs>
          {/* picioare */}
          {[95, 135, 195, 235].map((x) => <rect key={x} x={x - 12} y="168" width="24" height="34" rx="8" fill="rgba(190,255,240,0.06)" stroke="rgba(220,255,245,0.35)" />)}
          {/* corp */}
          <ellipse cx="165" cy="118" rx="128" ry="78" fill="url(#pgGlass)" stroke="rgba(220,255,245,0.55)" strokeWidth="2" />
          {/* bot */}
          <ellipse cx="298" cy="112" rx="18" ry="24" fill="rgba(190,255,240,0.08)" stroke="rgba(220,255,245,0.5)" strokeWidth="2" />
          <circle cx="294" cy="106" r="3" fill="rgba(220,255,245,0.5)" /><circle cx="294" cy="120" r="3" fill="rgba(220,255,245,0.5)" />
          {/* urechi */}
          <path d="M210 52 L232 22 L244 60 Z" fill="rgba(190,255,240,0.06)" stroke="rgba(220,255,245,0.45)" strokeWidth="2" />
          {/* fanta pentru monede */}
          <rect x="130" y="40" width="56" height="8" rx="4" fill="#020a09" stroke={C.gold} strokeWidth="1.5" />
          {/* reflexie */}
          <path d="M70 80 Q90 55 130 50" stroke="rgba(255,255,255,0.35)" strokeWidth="5" fill="none" strokeLinecap="round" />
        </svg>
        <div style={s.belly}>
          {fallen.map((uid) => (
            <span key={uid} className={uid === justFell ? "pg-fall" : ""} style={s.bellyItem} title={who.name(uid)}>
              <Avatar uid={uid} who={who} size={26} />
            </span>
          ))}
        </div>
        <div style={s.potValue}>
          <span style={s.potNum}>{value}</span>
          <span style={s.potUnit}>PCT</span>
        </div>
      </div>
      <div style={s.potCaption}>{fallen.length === 0 ? "Pușculița e goală. Încă." : `${fallen.length} ${fallen.length === 1 ? "jucător a căzut" : "jucători au căzut"} în pușculiță`}</div>
    </div>
  );
}

function Ranking({ entry, who, revealed, current }) {
  const thresholdIdx = entry.ranking.findIndex((r) => r.belowThreshold);
  const zoneIdx = entry.ranking.findIndex((r) => r.inEliminationZone);
  return (
    <div style={s.board}>
      <div style={s.boardHead}>
        <span style={s.boardTitle}>Clasamentul rundei {entry.index + 1}</span>
        <span style={s.boardMeta}>{entry.provisional ? "provizoriu · doar meciuri validate" : "definitiv"}</span>
      </div>
      {entry.ranking.map((r, i) => {
        const shownOut = entry.complete && current.indexOf(r.uid) > -1 && current.indexOf(r.uid) < revealed;
        const finalOut = entry.complete && r.inEliminationZone;
        return (
          <div key={r.uid}>
            {i === zoneIdx && zoneIdx !== thresholdIdx && <Line color={C.red} label="Zona de eliminare" />}
            {i === thresholdIdx && <Line color={C.gold} label={`Prag minim: ${entry.threshold} PCT`} sub={zoneIdx === thresholdIdx ? "și zona de eliminare" : null} />}
            <div className={shownOut ? "pg-out" : ""} style={{ ...s.row, ...(r.inEliminationZone ? s.rowZone : {}), ...(r.uid === who.me ? s.rowMe : {}) }}>
              <span style={s.rank}>{r.rank}</span>
              <Avatar uid={r.uid} who={who} size={34} ring={r.inEliminationZone ? C.red : C.mint} />
              <span style={s.rowName}>{who.name(r.uid)}{r.uid === who.me ? " (tu)" : ""}</span>
              <span style={s.rowPts}>{r.points}</span>
              {entry.complete ? (
                <span style={{ ...s.badge, ...(finalOut ? s.badgeOut : s.badgeIn) }}>{finalOut ? "ELIMINAT" : "CALIFICAT"}</span>
              ) : (
                <span style={{ ...s.badge, ...s.badgeWait, ...(r.inEliminationZone ? { color: C.red, borderColor: C.red } : {}) }}>{r.inEliminationZone ? "în pericol" : "în joc"}</span>
              )}
            </div>
          </div>
        );
      })}
      {thresholdIdx === -1 && <Line color={C.gold} label={`Prag minim: ${entry.threshold} PCT · toți l-au depășit`} />}
    </div>
  );
}

function Line({ color, label, sub }) {
  return (
    <div style={s.lineWrap}>
      <div style={{ ...s.lineBar, background: color, boxShadow: `0 0 10px ${color}` }} />
      <span style={{ ...s.lineLabel, color }}>{label}{sub ? ` ${sub}` : ""}</span>
    </div>
  );
}

function SpecialBanner({ outcome, who }) {
  const map = {
    zero_survivors: { t: "Nimeni nu a supraviețuit", d: "Jocul se termină fără premii.", c: C.red },
    one_survivor: { t: "Un singur supraviețuitor", d: "Primește automat 200 PCT.", c: C.gold },
    two_survivors: { t: "Doar doi supraviețuitori", d: "Primesc automat câte 200 PCT.", c: C.gold },
    stop: { t: "Jocul s-a oprit", d: "Pușculița se împarte între supraviețuitori.", c: C.pink },
  };
  const m = map[outcome.reason];
  if (!m) return null;
  const winners = Object.entries(outcome.prizes || {}).filter(([, v]) => v > 0);
  return (
    <div style={{ ...s.banner, borderColor: m.c }}>
      <div style={{ ...s.bannerTitle, color: m.c }}>{m.t}</div>
      <div style={s.bannerText}>{m.d}</div>
      {winners.length > 0 && (
        <div style={s.bannerWinners}>
          {winners.map(([uid, v]) => (
            <span key={uid} style={s.winner}><Avatar uid={uid} who={who} size={30} /> <b>{v}</b></span>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// SALA VOTURILOR
// ══════════════════════════════════════════════════════════════════
function VoteHall({ view, who }) {
  const voteEntry = [...view.result.timeline].reverse().find((t) => t.vote);
  if (!voteEntry) return <p style={s.note}>În această stare nu există vot.</p>;
  if (!voteEntry.vote.closed) return <VoteOpen entry={voteEntry} who={who} view={view} />;
  return <VoteReveal entry={voteEntry} who={who} outcome={view.result.outcome} />;
}

function VoteOpen({ entry, who, view }) {
  const [myVote, setMyVote] = useState(null);
  const [copied, setCopied] = useState(false);
  const voters = entry.vote.rows;
  const raw = view.input.votes?.[entry.index] || {};
  const voted = voters.filter((r) => raw[r.uid]);
  const missing = voters.filter((r) => !raw[r.uid]);
  const meIn = voters.some((r) => r.uid === who.me);
  const need = Math.floor(voters.length / 2) + 1;

  function copyMissing() {
    const text = `🐷 Pușculița — votul după runda ${entry.index + 1} se închide curând. Încă n-au votat: ${missing.map((r) => who.name(r.uid)).join(", ")}. Cine nu votează e trecut automat la STOP.`;
    try { navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* fără clipboard */ }
  }

  return (
    <section>
      <div style={s.voteIntro}>
        <div style={s.voteTitle}>Votul după runda {entry.index + 1}</div>
        <div style={s.voteRule}>Jocul continuă doar dacă cel puțin <b>{need} din {voters.length}</b> votează CONTINUĂ. Cine nu votează e trecut la STOP.</div>
      </div>
      {meIn && (
        <div style={s.voteBtns}>
          <button type="button" className="pg-press" onClick={() => setMyVote(VOTE_CONTINUE)} disabled={!!myVote}
            style={{ ...s.voteBtn, ...s.voteO, ...(myVote === VOTE_CONTINUE ? s.voteChosen : {}), ...(myVote && myVote !== VOTE_CONTINUE ? s.voteDim : {}) }}>
            <span style={s.voteSym}>○</span><span>CONTINUĂ</span>
          </button>
          <button type="button" className="pg-press" onClick={() => setMyVote("X")} disabled={!!myVote}
            style={{ ...s.voteBtn, ...s.voteX, ...(myVote === "X" ? s.voteChosen : {}), ...(myVote && myVote !== "X" ? s.voteDim : {}) }}>
            <span style={s.voteSym}>✕</span><span>STOP</span>
          </button>
        </div>
      )}
      {myVote && <p style={s.note}>Vot confirmat (demo). Votul e definitiv și rămâne secret până la dezvăluire.</p>}

      <div style={s.board}>
        <div style={s.boardHead}>
          <span style={s.boardTitle}>Cine a votat</span>
          <span style={s.boardMeta}>{voted.length}/{voters.length} · alegerile rămân secrete</span>
        </div>
        <div style={s.voterGrid}>
          {voters.map((r) => (
            <span key={r.uid} style={{ ...s.voter, opacity: raw[r.uid] ? 1 : 0.45 }}>
              <Avatar uid={r.uid} who={who} size={34} ring={raw[r.uid] ? C.mint : C.faint} />
              <span style={s.voterName}>{who.name(r.uid)}</span>
              <span style={s.voterState}>{raw[r.uid] ? "✓ a votat" : "nu a votat"}</span>
            </span>
          ))}
        </div>
        {missing.length > 0 && (
          <button type="button" style={s.ctrlGhost} onClick={copyMissing}>{copied ? "Copiat ✓" : "Copiază mesajul pentru nevotanți"}</button>
        )}
      </div>
    </section>
  );
}

function seededShuffle(list, seed) {
  const a = [...list]; let x = seed || 7;
  for (let i = a.length - 1; i > 0; i--) { x = (x * 1103515245 + 12345) & 0x7fffffff; const j = x % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function VoteReveal({ entry, who, outcome }) {
  const order = useMemo(() => seededShuffle(entry.vote.rows, entry.index * 97 + entry.vote.rows.length), [entry]);
  const [n, setN] = useState(0);
  const [auto, setAuto] = useState(false);
  useEffect(() => {
    if (!auto) return undefined;
    if (n >= order.length) { setAuto(false); return undefined; }
    const t = setTimeout(() => setN((x) => x + 1), n === 0 ? 600 : 1300);
    return () => clearTimeout(t);
  }, [auto, n, order.length]);

  const shown = order.slice(0, n);
  const cur = n > 0 ? order[n - 1] : null;
  const cont = shown.filter((r) => r.vote === VOTE_CONTINUE);
  const stop = shown.filter((r) => r.vote !== VOTE_CONTINUE);
  const done = n >= order.length;
  const need = Math.floor(order.length / 2) + 1;
  const decisionContinue = entry.vote.decision === "continue";
  const stopEach = !decisionContinue ? (Object.values(outcome.prizes || {})[0] || 0) : 0;

  return (
    <section>
      <div style={s.voteIntro}>
        <div style={s.voteTitle}>Dezvăluirea votului · după runda {entry.index + 1}</div>
        <div style={s.voteRule}>Pentru CONTINUĂ e nevoie de <b>{need} din {order.length}</b>.</div>
      </div>

      <div style={s.hall}>
        <div style={{ ...s.hallCol, borderColor: C.mint }}>
          <div style={{ ...s.hallSym, color: C.mint }}>○</div>
          <div style={{ ...s.hallCount, color: C.mint }}>{cont.length}</div>
          <div style={s.hallStack}>{cont.map((r) => <span key={r.uid} className="pg-slide-l"><Avatar uid={r.uid} who={who} size={28} /></span>)}</div>
        </div>
        <div style={s.hallCenter}>
          {cur ? (
            <div key={cur.uid} className="pg-stand" style={s.standing}>
              <Avatar uid={cur.uid} who={who} size={72} ring={cur.vote === VOTE_CONTINUE ? C.mint : C.red} />
              <div style={s.standName}>{who.name(cur.uid)}</div>
              <div style={{ ...s.standVote, color: cur.vote === VOTE_CONTINUE ? C.mint : C.red }}>
                {cur.vote === VOTE_CONTINUE ? "○ CONTINUĂ" : "✕ STOP"}
              </div>
              {cur.auto && <div style={s.autoTag}>VOT AUTOMAT</div>}
            </div>
          ) : (
            <div style={s.standEmpty}>Voturile sunt sigilate</div>
          )}
        </div>
        <div style={{ ...s.hallCol, borderColor: C.red }}>
          <div style={{ ...s.hallSym, color: C.red }}>✕</div>
          <div style={{ ...s.hallCount, color: C.red }}>{stop.length}</div>
          <div style={s.hallStack}>{stop.map((r) => <span key={r.uid} className="pg-slide-r" style={{ position: "relative" }}><Avatar uid={r.uid} who={who} size={28} />{r.auto && <i style={s.autoDot} />}</span>)}</div>
        </div>
      </div>

      <div style={s.controls}>
        {!done && <button type="button" style={s.ctrlMain} onClick={() => setAuto(true)} disabled={auto}>▶ Redare automată</button>}
        {!done && <button type="button" style={s.ctrlGhost} onClick={() => { setAuto(false); setN((x) => Math.min(order.length, x + 1)); }}>Următorul vot</button>}
        {(done || n > 0) && <button type="button" style={s.ctrlGhost} onClick={() => { setAuto(false); setN(0); }}>↺ Reia</button>}
      </div>

      {done && (
        <div className="pg-verdict" style={{ ...s.verdict, borderColor: decisionContinue ? C.mint : C.red }}>
          <div style={{ ...s.verdictTitle, color: decisionContinue ? C.mint : C.red }}>{decisionContinue ? "Jocul continuă" : "STOP"}</div>
          <div style={s.verdictText}>
            {decisionContinue
              ? `${cont.length} din ${order.length} au ales să meargă mai departe. Runda ${entry.index + 2} începe la ora programată.`
              : `Pușculița de ${PUSCULITA_STOP_POT} PCT se împarte la ${order.length}: ${stopEach} PCT fiecare.`}
          </div>
        </div>
      )}

      {done && (
        <div style={s.board}>
          <div style={s.boardHead}><span style={s.boardTitle}>Cine ce a votat</span></div>
          {order.map((r) => (
            <div key={r.uid} style={s.rowSmall}>
              <Avatar uid={r.uid} who={who} size={26} />
              <span style={s.rowName}>{who.name(r.uid)}</span>
              <span style={{ color: r.vote === VOTE_CONTINUE ? C.mint : C.red, fontWeight: 800 }}>{r.vote === VOTE_CONTINUE ? "○ CONTINUĂ" : "✕ STOP"}</span>
              {r.auto && <span style={s.autoTagSmall}>automat</span>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════
// PODIUM (finala)
// ══════════════════════════════════════════════════════════════════
function Podium({ view, who }) {
  const { outcome } = view.result;
  if (outcome.reason !== "final") return <p style={s.note}>Podiumul apare după finală (starea J).</p>;
  const finalEntry = view.result.timeline[3];
  const places = outcome.podium || [];
  const ranksByCol = [2, 1, 3]; // stânga: locul 2, centru: locul 1, dreapta: locul 3
  const heights = [120, 160, 96];
  const medal = ["🥇", "🥈", "🥉"];
  return (
    <section>
      <div style={s.podium}>
        {ranksByCol.map((rk, k) => {
          const g = places.find((p) => p.rank === rk) || null;
          return (
            <div key={k} style={s.podCol}>
              <div style={s.podPeople}>
                {g ? g.uids.map((uid) => (
                  <div key={uid} className="pg-rise" style={s.podPerson}>
                    <Avatar uid={uid} who={who} size={rk === 1 ? 64 : 48} ring={C.gold} />
                    <div style={s.podName}>{who.name(uid)}</div>
                    <div style={s.podPrize}>{outcome.prizes[uid]} PCT</div>
                  </div>
                )) : <div style={s.podEmpty}>—</div>}
              </div>
              <div style={{ ...s.podStep, height: heights[k] }}>
                <span style={s.podMedal}>{g ? medal[g.rank - 1] : ""}</span>
                <span style={s.podPlace}>{g ? `Locul ${g.rank}` : ""}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div style={s.board}>
        <div style={s.boardHead}><span style={s.boardTitle}>Finala · prag {finalEntry.threshold} PCT</span></div>
        {finalEntry.ranking.map((r) => (
          <div key={r.uid} style={s.rowSmall}>
            <Avatar uid={r.uid} who={who} size={26} />
            <span style={s.rowName}>{who.name(r.uid)}</span>
            <span style={s.rowPts}>{r.points}</span>
            <span style={{ fontWeight: 800, color: outcome.prizes[r.uid] ? C.gold : C.faint }}>
              {outcome.prizes[r.uid] ? `+${outcome.prizes[r.uid]}` : r.belowThreshold ? "sub prag" : "fără premiu"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

const CSS = `
@keyframes pgFall { 0% { transform: translateY(-170px) scale(1.6); opacity: 0; } 15% { opacity: 1; } 70% { transform: translateY(6px) scale(1); } 85% { transform: translateY(-4px); } 100% { transform: translateY(0); } }
@keyframes pgOut { 0% { background: rgba(255,64,83,0.35); } 100% { background: rgba(255,64,83,0.08); opacity: 0.55; } }
@keyframes pgStand { from { transform: translateY(18px) scale(0.9); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes pgSlideL { from { transform: translateX(60px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes pgSlideR { from { transform: translateX(-60px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes pgVerdict { 0% { transform: scale(0.8); opacity: 0; } 60% { transform: scale(1.04); opacity: 1; } 100% { transform: none; } }
@keyframes pgRise { from { transform: translateY(24px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes pgSway { 0%,100% { transform: rotate(-1.2deg); } 50% { transform: rotate(1.2deg); } }
@keyframes pgSpot { 0%,100% { opacity: 0.55; } 50% { opacity: 0.8; } }
.pg-fall { animation: pgFall 900ms cubic-bezier(.3,.7,.3,1) both; }
.pg-out { animation: pgOut 900ms ease-out both; }
.pg-stand { animation: pgStand 420ms ease-out both; }
.pg-slide-l { display: inline-flex; animation: pgSlideL 420ms ease-out both; }
.pg-slide-r { display: inline-flex; animation: pgSlideR 420ms ease-out both; }
.pg-verdict { animation: pgVerdict 600ms ease-out both; }
.pg-rise { animation: pgRise 600ms ease-out both; }
.pg-sway { animation: pgSway 6s ease-in-out infinite; transform-origin: 50% -40px; }
.pg-press:active { transform: scale(0.96); }
@media (prefers-reduced-motion: reduce) {
  .pg-fall, .pg-out, .pg-stand, .pg-slide-l, .pg-slide-r, .pg-verdict, .pg-rise, .pg-sway { animation: none !important; }
}
`;

const s = {
  page: { background: `radial-gradient(120% 60% at 50% 0%, #0E3B35 0%, ${C.bg} 60%)`, color: C.text, fontFamily: font.body, borderRadius: 18, padding: "14px 12px 18px", minHeight: 420, overflow: "hidden" },
  pageVertical: { borderRadius: 0, height: "100%", overflowY: "auto", padding: "16px 12px" },
  note: { color: C.dim, fontSize: 13, lineHeight: 1.45 },

  adminBar: { display: "flex", justifyContent: "space-between", alignItems: "center", margin: "6px 0 10px", gap: 8, fontFamily: font.body },
  adminNote: { fontSize: 11.5, color: "#8a93a6" },
  adminBtn: { background: "transparent", border: "1px solid rgba(255,255,255,0.18)", color: "#e9eef7", borderRadius: 999, padding: "7px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" },
  verticalBack: { position: "fixed", inset: 0, zIndex: 20000, background: "#000", display: "flex", alignItems: "center", justifyContent: "center" },
  verticalFrame: { height: "100vh", maxWidth: "100vw", aspectRatio: "9 / 16", overflow: "hidden", background: C.bg },
  verticalExit: { position: "fixed", top: 10, right: 10, zIndex: 20001, width: 34, height: 34, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.12)", color: "#fff", fontSize: 16, opacity: 0.5, cursor: "pointer" },

  header: { marginBottom: 12 },
  brandRow: { display: "flex", alignItems: "center", gap: 10 },
  shapes: { display: "inline-flex", gap: 5, alignItems: "center" },
  shCircle: { width: 14, height: 14, borderRadius: "50%", border: `2.5px solid ${C.pink}`, display: "inline-block" },
  shTri: { width: 0, height: 0, borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderBottom: `14px solid ${C.pink}`, display: "inline-block" },
  shSquare: { width: 13, height: 13, border: `2.5px solid ${C.pink}`, display: "inline-block" },
  title: { margin: 0, fontFamily: font.display, fontSize: 32, fontWeight: 700, letterSpacing: 0.5, lineHeight: 1 },
  program: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginTop: 12 },
  roundChip: { border: `1px solid ${C.line}`, borderRadius: 10, padding: "6px 6px", display: "flex", flexDirection: "column", gap: 2, background: "rgba(0,0,0,0.2)" },
  roundLive: { borderColor: C.pink, boxShadow: `0 0 12px rgba(255,45,122,0.35)` },
  roundDone: { borderColor: "rgba(47,191,154,0.5)" },
  roundOff: { opacity: 0.35 },
  roundNo: { fontFamily: font.display, fontSize: 13.5, fontWeight: 700 },
  roundMeta: { fontSize: 10, color: C.dim, lineHeight: 1.25 },
  timerRow: { display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginTop: 10 },
  timerLabel: { fontSize: 12, color: C.dim },
  timer: { fontFamily: font.display, fontSize: 24, fontWeight: 700, color: C.pink, fontVariantNumeric: "tabular-nums", letterSpacing: 1 },
  roundNow: { fontSize: 12, color: C.dim, marginLeft: "auto" },

  tabs: { display: "flex", gap: 6, marginBottom: 12, background: "rgba(0,0,0,0.25)", padding: 4, borderRadius: 12 },
  tab: { flex: 1, background: "transparent", border: "none", color: C.dim, padding: "9px 6px", borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: "pointer" },
  tabOn: { background: C.floor, color: C.text, boxShadow: `inset 0 0 0 1px ${C.line}` },

  piggyWrap: { position: "relative", display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 0 6px" },
  spot: { position: "absolute", top: -30, left: "50%", transform: "translateX(-50%)", width: 260, height: 300, background: "radial-gradient(closest-side, rgba(245,196,81,0.22), rgba(245,196,81,0))", pointerEvents: "none", animation: "pgSpot 5s ease-in-out infinite" },
  wire: { width: 2, height: 26, background: "linear-gradient(rgba(220,255,245,0), rgba(220,255,245,0.6))" },
  piggy: { position: "relative", width: "100%", maxWidth: 330, aspectRatio: "320 / 220" },
  piggySvg: { position: "absolute", inset: 0, width: "100%", height: "100%" },
  belly: { position: "absolute", left: "16%", right: "22%", top: "38%", bottom: "22%", display: "flex", flexWrap: "wrap-reverse", alignContent: "flex-start", justifyContent: "center", gap: 3, overflow: "hidden" },
  bellyItem: { display: "inline-flex", opacity: 0.92 },
  potValue: { position: "absolute", top: "24%", left: 0, right: "10%", display: "flex", justifyContent: "center", alignItems: "baseline", gap: 4, pointerEvents: "none" },
  potNum: { fontFamily: font.display, fontSize: 34, fontWeight: 700, color: C.gold, textShadow: "0 0 18px rgba(245,196,81,0.55)", fontVariantNumeric: "tabular-nums" },
  potUnit: { fontSize: 12, fontWeight: 800, color: C.gold },
  potCaption: { fontSize: 12, color: C.dim, marginTop: 6 },

  controls: { display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0" },
  ctrlMain: { flex: "1 1 auto", padding: "11px 12px", borderRadius: 10, border: "none", background: C.pink, color: "#fff", fontWeight: 800, fontSize: 13.5, cursor: "pointer" },
  ctrlGhost: { flex: "0 1 auto", padding: "11px 12px", borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", color: C.text, fontWeight: 700, fontSize: 13, cursor: "pointer", marginTop: 8 },

  board: { background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 10, marginTop: 12 },
  boardHead: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 6 },
  boardTitle: { fontFamily: font.display, fontSize: 16, fontWeight: 700 },
  boardMeta: { fontSize: 11, color: C.dim },
  row: { display: "flex", alignItems: "center", gap: 9, padding: "7px 6px", borderRadius: 9, marginBottom: 3 },
  rowZone: { background: "rgba(255,64,83,0.08)" },
  rowMe: { boxShadow: `inset 3px 0 0 ${C.gold}` },
  rowSmall: { display: "flex", alignItems: "center", gap: 9, padding: "6px 4px", borderTop: `1px solid ${C.line}` },
  rank: { width: 20, textAlign: "center", fontFamily: font.display, fontSize: 15, color: C.dim, fontVariantNumeric: "tabular-nums" },
  rowName: { flex: 1, minWidth: 0, fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  rowPts: { fontFamily: font.display, fontSize: 18, fontWeight: 700, fontVariantNumeric: "tabular-nums", minWidth: 40, textAlign: "right" },
  badge: { fontSize: 10, fontWeight: 800, letterSpacing: 0.4, border: "1px solid", borderRadius: 999, padding: "3px 7px", minWidth: 66, textAlign: "center" },
  badgeIn: { color: C.mint, borderColor: C.mint },
  badgeOut: { color: "#fff", background: C.red, borderColor: C.red },
  badgeWait: { color: C.dim, borderColor: C.line },
  lineWrap: { position: "relative", margin: "6px 0", display: "flex", alignItems: "center", gap: 8 },
  lineBar: { flex: 1, height: 2, borderRadius: 2 },
  lineLabel: { fontSize: 10.5, fontWeight: 800, whiteSpace: "nowrap" },
  shirt: { position: "absolute", bottom: -4, left: "50%", transform: "translateX(-50%)", background: C.mint, color: "#022", borderRadius: 4, padding: "0 3px", fontWeight: 900, lineHeight: 1.3, fontFamily: font.display },

  banner: { border: "1.5px solid", borderRadius: 14, padding: 12, margin: "10px 0", background: "rgba(0,0,0,0.25)", textAlign: "center" },
  bannerTitle: { fontFamily: font.display, fontSize: 22, fontWeight: 700 },
  bannerText: { fontSize: 13, color: C.dim, marginTop: 4 },
  bannerWinners: { display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", marginTop: 10 },
  winner: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, color: C.gold },

  voteIntro: { textAlign: "center", marginBottom: 10 },
  voteTitle: { fontFamily: font.display, fontSize: 20, fontWeight: 700 },
  voteRule: { fontSize: 12.5, color: C.dim, marginTop: 4, lineHeight: 1.45 },
  voteBtns: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, margin: "8px 0" },
  voteBtn: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "16px 8px", borderRadius: 16, border: "2px solid", background: "rgba(0,0,0,0.3)", color: C.text, fontWeight: 800, fontSize: 14, cursor: "pointer", transition: "transform 120ms, opacity 200ms" },
  voteO: { borderColor: C.mint, color: C.mint },
  voteX: { borderColor: C.red, color: C.red },
  voteSym: { fontSize: 44, lineHeight: 1, fontWeight: 300 },
  voteChosen: { background: "rgba(255,255,255,0.08)", boxShadow: "0 0 24px rgba(255,255,255,0.15)" },
  voteDim: { opacity: 0.3 },
  voterGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 6 },
  voter: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "6px 2px" },
  voterName: { fontSize: 12, fontWeight: 700, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  voterState: { fontSize: 10.5, color: C.dim },

  hall: { display: "grid", gridTemplateColumns: "1fr 1.25fr 1fr", gap: 8, alignItems: "stretch", minHeight: 260 },
  hallCol: { border: "1.5px solid", borderRadius: 14, padding: "8px 4px", display: "flex", flexDirection: "column", alignItems: "center", background: "rgba(0,0,0,0.25)" },
  hallSym: { fontSize: 38, lineHeight: 1, fontWeight: 300 },
  hallCount: { fontFamily: font.display, fontSize: 30, fontWeight: 700, fontVariantNumeric: "tabular-nums" },
  hallStack: { display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "center", marginTop: 6 },
  hallCenter: { display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(closest-side, rgba(245,196,81,0.12), rgba(0,0,0,0))", borderRadius: 14 },
  standing: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textAlign: "center" },
  standName: { fontWeight: 800, fontSize: 15 },
  standVote: { fontFamily: font.display, fontSize: 18, fontWeight: 700 },
  standEmpty: { color: C.faint, fontSize: 13, textAlign: "center", padding: 10 },
  autoTag: { fontSize: 10, fontWeight: 800, color: "#fff", background: C.red, borderRadius: 4, padding: "2px 6px" },
  autoTagSmall: { fontSize: 10, color: C.dim, border: `1px solid ${C.line}`, borderRadius: 4, padding: "1px 5px" },
  autoDot: { position: "absolute", top: -2, right: -2, width: 8, height: 8, borderRadius: "50%", background: "#fff", boxShadow: `0 0 0 2px ${C.red}` },
  verdict: { border: "2px solid", borderRadius: 16, padding: 14, margin: "12px 0", textAlign: "center", background: "rgba(0,0,0,0.3)" },
  verdictTitle: { fontFamily: font.display, fontSize: 30, fontWeight: 700 },
  verdictText: { fontSize: 13.5, color: C.text, marginTop: 6, lineHeight: 1.45 },

  podium: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, alignItems: "end", padding: "10px 0" },
  podCol: { display: "flex", flexDirection: "column", alignItems: "center" },
  podPeople: { display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginBottom: 8 },
  podPerson: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4 },
  podName: { fontWeight: 800, fontSize: 13, textAlign: "center", maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  podPrize: { fontFamily: font.display, fontSize: 17, fontWeight: 700, color: C.gold },
  podEmpty: { color: C.faint, fontSize: 20, marginBottom: 20 },
  podStep: { width: "100%", borderRadius: "10px 10px 0 0", background: "linear-gradient(180deg, rgba(245,196,81,0.35), rgba(245,196,81,0.08))", border: `1px solid rgba(245,196,81,0.4)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", paddingTop: 8 },
  podMedal: { fontSize: 26 },
  podPlace: { fontSize: 12, fontWeight: 800, color: C.gold },
};
