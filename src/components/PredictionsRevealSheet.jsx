import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { listPredictionsForMatch } from "../services/predictionsService";
import { getUserPublicProfiles } from "../services/profilesService";
import { computeMainScore, computeMatchPoints } from "../services/scoringEngine";
import PlayerAvatar from "./PlayerAvatar";
import ClubLogo from "./ClubLogo";
import { color, font, radius } from "../matchdayTheme";

// ── Componentă UNICĂ pentru "cine mai e în joc?" — deschisă identic din
// Home (👁 pe hero, dacă meciul e LIVE) și din PredictionsScreen (👁 pe
// un meci live din listă, SAU accordion-ul de meciuri blocate). Nicio
// logică duplicată — un singur loc care citește predicțiile, calculează
// stările și le sortează.
//
// Date încărcate STRICT la deschidere (lazy) — niciodată la Home sau la
// lista de meciuri. onSnapshot pe matches/{id} DOAR cât panoul e deschis,
// dezabonare curată la închidere — exact strategia aprobată.
export default function PredictionsRevealSheet({ match, isFeatured, isJoker: isJokerMatch, currentUserId, isAdmin, onClose, inline = false }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]); // { uid, nickname, avatarId, scoreA, scoreB, corners, cards }
  const [liveMatch, setLiveMatch] = useState(match); // se actualizează realtime dacă e LIVE

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    (async () => {
      try {
        const preds = await listPredictionsForMatch(match.id);
        const profiles = await getUserPublicProfiles(preds.map((p) => p.userId));
        if (cancelled) return;
        setRows(preds.map((p) => ({
          uid: p.userId,
          nickname: profiles[p.userId]?.nickname || p.userId,
          avatarId: profiles[p.userId]?.avatarId ?? null,
          scoreA: p.scoreA, scoreB: p.scoreB,
        })));
      } catch (err) {
        // Cauza cea mai probabilă, dacă apare: meciul nu e de fapt blocat
        // încă — regula Firestore respinge corect interogarea (nu un bug).
        console.error("Eroare la încărcarea pronosticurilor:", err);
        if (!cancelled) setError("Pronosticurile nu sunt încă vizibile pentru acest meci.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [match.id]);

  // Realtime STRICT cât panoul e deschis — doar pentru meciuri LIVE (un
  // meci FINISHED nu-și mai schimbă scorul; SCHEDULED n-are sens aici).
  useEffect(() => {
    if (match.status !== "live") return;
    const unsub = onSnapshot(doc(db, "matches", match.id), (snap) => {
      if (snap.exists()) setLiveMatch((prev) => ({ ...prev, ...snap.data() }));
    });
    return () => unsub();
  }, [match.id, match.status]);

  const ownPrediction = rows.find((r) => r.uid === currentUserId) || null;
  const liveA = liveMatch.realScoreA;
  const liveB = liveMatch.realScoreB;
  const isLive = match.status === "live";
  const isFinished = match.status === "finished";

  // ── Categorizare + sortare — DOAR pentru LIVE. Regula matematică
  // exactă cerută: poți mai ajunge la scorul exact doar dacă predA>=liveA
  // ȘI predB>=liveB (golurile nu pot scădea). ──
  function tierFor(row) {
    if (!isLive || liveA == null || liveB == null) return null;
    if (row.scoreA === liveA && row.scoreB === liveB) return "exact";
    if (row.scoreA >= liveA && row.scoreB >= liveB) return "alive";
    return "dead";
  }

  const decorated = rows.map((r) => ({
    ...r,
    tier: tierFor(r),
    sameAsMine: ownPrediction ? (r.scoreA === ownPrediction.scoreA && r.scoreB === ownPrediction.scoreB) : false,
    finishedResult: isFinished ? computeMainScore(r.scoreA, r.scoreB, liveA, liveB) : null,
    finishedPoints: isFinished ? computeMatchPoints({
      prediction: { scoreA: r.scoreA, scoreB: r.scoreB }, match: liveMatch, isFeatured, isJoker: false,
    })?.finalMatchPoints ?? 0 : null,
  }));

  const TIER_ORDER = { exact: 0, alive: 1, dead: 2 };
  const sorted = isLive
    ? [...decorated].sort((a, b) => (TIER_ORDER[a.tier] - TIER_ORDER[b.tier]) || a.nickname.localeCompare(b.nickname))
    : isFinished
    ? [...decorated].sort((a, b) => (b.finishedPoints ?? 0) - (a.finishedPoints ?? 0))
    : decorated;

  const summary = isLive ? {
    exact: decorated.filter((r) => r.tier === "exact").length,
    alive: decorated.filter((r) => r.tier === "alive").length,
    dead: decorated.filter((r) => r.tier === "dead").length,
  } : null;

  const content = (
    <>
      {!inline && <div style={s.grabber} />}

      <div style={s.head}>
        <div style={s.headTeams}>
          <ClubLogo teamName={match.homeTeam} size={inline ? 24 : 30} />
          <span style={s.headScore}>
            {isLive || isFinished ? `${liveA ?? "–"} – ${liveB ?? "–"}` : "vs"}
          </span>
          <ClubLogo teamName={match.awayTeam} size={inline ? 24 : 30} />
        </div>
        {!inline && <button type="button" onClick={onClose} style={s.closeBtn}>✕</button>}
      </div>
      <div style={s.headSub}>
        {match.homeTeam} · {match.awayTeam}
        {isLive && <span style={s.liveTag}> · ● LIVE</span>}
        {isFinished && <span style={s.finalTag}> · Final</span>}
      </div>

      {isLive && summary && (
        <div style={s.summaryRow}>
          <span style={s.summaryItem}>🎯 {summary.exact} pe scor exact</span>
          <span style={s.summaryItem}>◉ {summary.alive} încă în joc</span>
          <span style={s.summaryItemFaint}>{summary.dead} eliminați</span>
        </div>
      )}

      {loading && <div style={s.centerNote}>Se încarcă…</div>}
      {!loading && error && <div style={s.centerNote}>{error}</div>}
      {!loading && !error && rows.length === 0 && <div style={s.centerNote}>Niciun pronostic încă pentru acest meci.</div>}

      {!loading && !error && !ownPrediction && rows.length > 0 && (
        <div style={s.noOwnNote}>Nu ai pronostic la acest meci.</div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div style={s.list}>
          {sorted.map((r) => (
            <PredictionRow key={r.uid} row={r} isLive={isLive} isFinished={isFinished} isMe={r.uid === currentUserId} />
          ))}
        </div>
      )}
    </>
  );

  if (inline) return <div style={s.inlineWrap}>{content}</div>;

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.sheet} onClick={(e) => e.stopPropagation()}>
        {content}
      </div>
    </div>
  );
}

function PredictionRow({ row, isLive, isFinished, isMe }) {
  const tierStyle = row.tier === "exact" ? s.rowExact : row.tier === "dead" ? s.rowDead : s.row;
  return (
    <div style={{ ...s.row, ...tierStyle }}>
      <PlayerAvatar avatarId={row.avatarId} nickname={row.nickname} size={30} />
      <div style={s.rowMain}>
        <div style={s.rowNameLine}>
          <span style={s.rowName}>{row.nickname}{isMe ? " (tu)" : ""}</span>
          {row.sameAsMine && !isMe && <span style={s.starBadge}>⭐</span>}
        </div>
        {isLive && row.tier === "exact" && <div style={s.tierLabelExact}>ACUM EXACT</div>}
        {isLive && row.tier === "alive" && <div style={s.tierLabelAlive}>Încă în joc</div>}
        {isLive && row.tier === "dead" && <div style={s.tierLabelDead}>Scor exact imposibil</div>}
        {isFinished && (
          <div style={row.finishedResult >= 120 ? s.tierLabelExact : row.finishedResult >= 50 ? s.tierLabelAlive : s.tierLabelDead}>
            {row.finishedResult >= 120 ? "🏆 Scor exact" : row.finishedResult >= 50 ? "✓ Rezultat corect" : "— Ratat"}
          </div>
        )}
      </div>
      <div style={s.rowRight}>
        <span style={s.rowScore}>{row.scoreA}-{row.scoreB}</span>
        {isFinished && <span style={s.rowPoints}>+{row.finishedPoints}p</span>}
      </div>
    </div>
  );
}

const s = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(5,7,14,0.78)",
    display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100,
  },
  sheet: {
    width: "100%", maxWidth: 480, maxHeight: "85vh", overflowY: "auto",
    background: color.surfaceInset, borderTop: `1px solid ${color.border}`, borderRadius: "20px 20px 0 0",
    padding: "10px 16px 24px",
  },
  grabber: { width: 40, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.2)", margin: "0 auto 14px" },
  inlineWrap: { padding: "10px 2px 4px" },
  head: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  headTeams: { display: "flex", alignItems: "center", gap: 12 },
  headScore: { fontFamily: font.display, fontSize: 18, fontWeight: 800, color: color.textPrimary },
  closeBtn: {
    width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: `1px solid ${color.border}`,
    color: color.textSecondary, fontSize: 14, cursor: "pointer",
  },
  headSub: { fontSize: 11.5, color: color.textFaint, fontFamily: font.body, marginTop: 6, marginBottom: 4 },
  liveTag: { color: "#8BD957", fontWeight: 700 },
  finalTag: { color: color.goldLight, fontWeight: 700 },

  summaryRow: { display: "flex", gap: 10, flexWrap: "wrap", margin: "10px 0 14px", fontSize: 11, fontFamily: font.body },
  summaryItem: { color: color.textSecondary, fontWeight: 700 },
  summaryItemFaint: { color: color.textFaint },

  centerNote: { textAlign: "center", color: color.textFaint, fontSize: 12.5, padding: "24px 0", fontFamily: font.body },
  noOwnNote: {
    fontSize: 11.5, color: color.textFaint, fontFamily: font.body, fontStyle: "italic",
    marginBottom: 10, textAlign: "center",
  },

  list: { display: "flex", flexDirection: "column", gap: 7, marginTop: 6 },
  row: {
    display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: radius.md,
    background: "rgba(255,255,255,0.03)", border: `1px solid ${color.border}`,
  },
  rowExact: {
    background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.4)",
    boxShadow: "0 0 14px -4px rgba(212,175,55,0.4)",
  },
  rowDead: { opacity: 0.5 },
  rowMain: { flex: 1, minWidth: 0 },
  rowNameLine: { display: "flex", alignItems: "center", gap: 5 },
  rowName: { fontSize: 12.5, fontWeight: 700, color: color.textPrimary, fontFamily: font.body, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  starBadge: { fontSize: 11 },
  tierLabelExact: { fontSize: 9.5, fontWeight: 800, color: color.goldLight, letterSpacing: "0.03em", marginTop: 1 },
  tierLabelAlive: { fontSize: 9.5, fontWeight: 700, color: color.textSecondary, marginTop: 1 },
  tierLabelDead: { fontSize: 9.5, color: color.textFaint, marginTop: 1 },
  rowRight: { display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 },
  rowScore: { fontFamily: font.display, fontSize: 14, fontWeight: 800, color: color.textPrimary },
  rowPoints: { fontSize: 10, fontWeight: 700, color: color.goldLight, marginTop: 1 },
};
