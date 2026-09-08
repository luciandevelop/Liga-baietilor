import { useEffect, useState } from "react";
import { getCurrentSeason, getCurrentGameweek } from "../services/predictionsService";
import { subscribeToGameweekMatches } from "../services/matchesStore";
import { getRevealData } from "../services/revealDataCache";
import { groupByTier } from "../utils/liveTiers";
import { getDisplayMatchState } from "../utils/matchStatus";
import PlayerAvatar from "../components/PlayerAvatar";
import ClubLogo from "../components/ClubLogo";
import PageHeader from "../components/PageHeader";
import useNow from "../hooks/useNow";
import { color, font, radius } from "../matchdayTheme";

// ── Ecranul LIVE — toate meciurile aflate acum în desfășurare din etapa
// curentă, cu situația jucătorilor pentru fiecare, vizibile simultan,
// scroll vertical natural. NICIO logică nouă de clasificare — reutilizează
// exact `getDisplayMatchState` (aceeași sursă ca MatchResultCard, pentru
// decizia "e live acum?") și `groupByTier`/`tierFor` din liveTiers.js
// (aceeași matematică extrasă din PredictionsRevealSheet — "ochiul").
//
// Un singur listener (listenMatches), propriu acestui ecran — se
// dezabonează la ieșire, exact ca la Home. Nu există niciodată 2
// instanțe simultane ale acestui listener + cel din Home, pentru că
// ecranele sunt exclusive în navigație (unul montat pe rând).
//
// Predicțiile fiecărui meci live vin din getRevealData — ACELAȘI cache
// în memorie folosit și de "ochi" — a doua vizită la LIVE, în aceeași
// sesiune, pentru un meci deja văzut, nu mai citește nimic din Firestore.
export default function LiveScreen({ onBack, onOpenFeaturedMatch }) {
  const now = useNow(30000);
  const [gameweek, setGameweek] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loadingGw, setLoadingGw] = useState(true);
  // matchId -> { rows, jokerUids, jokerExtraUids } | "loading" | "error"
  const [revealByMatch, setRevealByMatch] = useState({});

  useEffect(() => {
    let unsubMatches = null;
    let cancelled = false;
    (async () => {
      const season = await getCurrentSeason();
      if (!season) { setLoadingGw(false); return; }
      const gw = await getCurrentGameweek(season.id);
      if (cancelled) return;
      setGameweek(gw);
      setLoadingGw(false);
      if (!gw) return;
      unsubMatches = subscribeToGameweekMatches(gw.id, (list) => { if (!cancelled) setMatches(list); });
    })();
    return () => { cancelled = true; if (unsubMatches) unsubMatches(); };
  }, []);

  const liveMatches = matches.filter((m) => getDisplayMatchState(m, now).status === "live");

  // Încărcăm predicțiile DOAR pentru meciurile live, DOAR pe cele
  // nevăzute încă în această sesiune (getRevealData face cache-ul, dar
  // nu vrem nici măcar apelul repetat inutil din acest efect).
  useEffect(() => {
    const toLoad = liveMatches.filter((m) => !revealByMatch[m.id]);
    if (toLoad.length === 0) return;
    setRevealByMatch((prev) => {
      const next = { ...prev };
      toLoad.forEach((m) => { next[m.id] = "loading"; });
      return next;
    });
    toLoad.forEach((m) => {
      getRevealData(m.id)
        .then((data) => setRevealByMatch((prev) => ({ ...prev, [m.id]: data })))
        .catch((err) => {
          console.error("Eroare la încărcarea pronosticurilor pentru LIVE:", err);
          setRevealByMatch((prev) => ({ ...prev, [m.id]: "error" }));
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveMatches.map((m) => m.id).join(",")]);

  return (
    <div style={s.page}>
      <LiveChipKeyframes />
      <div style={s.wrap}>
        <PageHeader title="🔴 LIVE" onBack={onBack} />

        {loadingGw && <div style={s.centerNote}>Se încarcă…</div>}

        {!loadingGw && liveMatches.length === 0 && (
          <div style={s.centerNote}>Niciun meci live acum.</div>
        )}

        {!loadingGw && liveMatches.length > 0 && (
          <div style={s.list}>
            {liveMatches.map((m) => (
              <LiveMatchCard
                key={m.id}
                match={m}
                now={now}
                reveal={revealByMatch[m.id]}
                isFeatured={(gameweek?.featuredMatchIds || []).includes(m.id)}
                onOpenFeatured={onOpenFeaturedMatch ? () => onOpenFeaturedMatch(m, gameweek?.id) : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LiveMatchCard({ match, now, reveal, isFeatured, onOpenFeatured }) {
  const display = getDisplayMatchState(match, now);
  const liveA = display.scoreA;
  const liveB = display.scoreB;
  const minuteLabel = display.minute != null ? `${display.minute}'` : "●";

  const loading = reveal === "loading" || reveal === undefined;
  const errored = reveal === "error";
  const { groups, summary } = !loading && !errored
    ? groupByTier(reveal.rows, true, liveA, liveB)
    : { groups: { exact: [], alive: [], dead: [] }, summary: null };

  return (
    <div style={s.card}>
      <div style={s.cardHead}>
        <span style={s.competition}>{match.competitionName || "Meci"}</span>
        <span style={s.minute}>● {minuteLabel}</span>
      </div>
      {isFeatured && (
        <div
          style={{ ...s.featuredStrip, cursor: onOpenFeatured ? "pointer" : "default" }}
          onClick={onOpenFeatured}
        >
          ⭐ Meciul Săptămânii{onOpenFeatured ? " · Vezi meciul →" : ""}
        </div>
      )}
      <div style={s.teamsRow}>
        <ClubLogo teamName={match.homeTeam} size={22} />
        <span style={s.scoreText}>
          {match.homeTeam?.toUpperCase()} &nbsp;{liveA ?? "–"} — {liveB ?? "–"}&nbsp; {match.awayTeam?.toUpperCase()}
        </span>
        <ClubLogo teamName={match.awayTeam} size={22} />
      </div>

      {loading && <div style={s.smallNote}>Se încarcă pronosticurile…</div>}
      {errored && <div style={s.smallNote}>Pronosticurile nu sunt încă vizibile.</div>}

      {!loading && !errored && (
        <>
          <div style={s.summaryRow}>
            🎯 {summary.exact} &nbsp;·&nbsp; 🟢 {summary.alive} &nbsp;·&nbsp; ❌ {summary.dead}
          </div>
          <div style={s.zones}>
            <TierZone label="❌ IEȘIȚI" tone="dead" rows={groups.dead} />
            <TierZone label="🎯 EXACT" tone="exact" rows={groups.exact} />
            <TierZone label="🟢 ÎN JOC" tone="alive" rows={groups.alive} />
          </div>
        </>
      )}
    </div>
  );
}

function TierZone({ label, tone, rows }) {
  const labelColor = tone === "exact" ? color.goldLight : tone === "alive" ? color.green : color.textFaint;
  return (
    <div style={s.zone}>
      <div style={{ ...s.zoneLabel, color: labelColor }}>{label}</div>
      {rows.length === 0 && <div style={s.zoneEmpty}>{tone === "dead" ? "niciunul" : "—"}</div>}
      <div style={s.zoneGrid}>
        {rows.map((r) => <PlayerChip key={r.uid} row={r} tone={tone} />)}
      </div>
    </div>
  );
}

function PlayerChip({ row, tone }) {
  const isExact = tone === "exact";
  const isDead = tone === "dead";
  return (
    <div style={{ ...s.chip, ...(isExact ? s.chipExact : null), animation: "liveChipIn 280ms ease-out" }}>
      <div style={{ ...s.avatarWrap, ...(isExact ? s.avatarWrapExact : s.avatarWrapPlain) }}>
        <div style={isDead ? s.avatarDeadFilter : undefined}>
          <PlayerAvatar avatarId={row.avatarId} nickname={row.nickname} size={isExact ? 30 : 24} />
        </div>
        {isDead && (
          // X discret peste avatar — 20-30% mai subțire decât mockup-ul
          // inițial (cerut explicit), doar 2 linii subțiri, opacitate
          // redusă, ca avatarul de dedesubt să rămână distins.
          <svg width={24} height={24} viewBox="0 0 24 24" style={s.deadX}>
            <line x1="5" y1="5" x2="19" y2="19" stroke="#E24B4A" strokeWidth="1.6" strokeLinecap="round" opacity="0.62" />
            <line x1="19" y1="5" x2="5" y2="19" stroke="#E24B4A" strokeWidth="1.6" strokeLinecap="round" opacity="0.62" />
          </svg>
        )}
      </div>
      <div style={{ ...s.chipName, ...(isDead ? s.chipNameDead : null) }}>{row.nickname}</div>
      <div style={{ ...s.chipPred, ...(isExact ? s.chipPredExact : null) }}>{row.scoreA}-{row.scoreB}</div>
    </div>
  );
}

// ── Tranziție discretă la reclasificare (ex. cineva trece din "în joc"
// în "eliminat" la o schimbare de scor) — cerut explicit: simplă, CSS
// pur (opacity+transform), fără bibliotecă nouă. Un jucător care se
// mută între zone e, tehnic, demontat dintr-un grup și remontat în
// altul (grupuri = containere DOM diferite) — nu o "zburare" animată
// între coloane (ar necesita o soluție mult mai complexă/riscantă),
// ci o apariție discretă în noul loc, exact varianta "simplă și
// sigură" preferată explicit în locul uneia complicate. ──
function LiveChipKeyframes() {
  return (
    <style>{`
      @keyframes liveChipIn {
        from { opacity: 0; transform: translateY(4px) scale(0.94); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
    `}</style>
  );
}

const s = {
  page: { minHeight: "100vh", background: color.bgBase },
  wrap: { maxWidth: 480, margin: "0 auto", padding: "0 16px 24px" },
  centerNote: { textAlign: "center", color: color.textFaint, fontSize: 13, padding: "60px 20px", fontFamily: font.body },

  list: { display: "flex", flexDirection: "column", gap: 10, marginTop: 10 },
  card: {
    background: color.surface, borderRadius: radius.md, border: `0.5px solid ${color.border}`,
    padding: 12,
  },
  cardHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  competition: { color: color.textFaint, fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", fontFamily: font.body },
  minute: { color: "#E24B4A", fontSize: 11, fontWeight: 700, fontFamily: font.body },
  featuredStrip: {
    background: "rgba(212,175,55,0.12)", border: `1px solid ${color.goldBorder}`, borderRadius: radius.sm,
    padding: "5px 8px", fontSize: 10, fontWeight: 700, color: color.goldLight, textAlign: "center",
    marginBottom: 8, fontFamily: font.body,
  },

  teamsRow: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 6 },
  scoreText: { color: color.textPrimary, fontSize: 14.5, fontWeight: 700, fontFamily: font.display, textAlign: "center" },

  smallNote: { textAlign: "center", color: color.textFaint, fontSize: 11.5, fontFamily: font.body, padding: "8px 0" },

  summaryRow: { textAlign: "center", color: color.textFaint, fontSize: 11, fontFamily: font.body, marginBottom: 10 },

  zones: { display: "grid", gridTemplateColumns: "0.95fr 0.85fr 0.95fr", gap: 5, alignItems: "start" },
  zone: {},
  zoneLabel: { fontSize: 9, fontWeight: 700, textAlign: "center", marginBottom: 5, fontFamily: font.body },
  zoneEmpty: { color: "#3a3e48", fontSize: 9, textAlign: "center", paddingTop: 6, fontFamily: font.body },
  zoneGrid: { display: "flex", flexWrap: "wrap", gap: 5, justifyContent: "center" },

  chip: { width: 42, textAlign: "center" },
  chipExact: { width: 46, background: "rgba(232,199,102,0.1)", borderRadius: 8, padding: "4px 2px 3px" },
  avatarWrap: { position: "relative", margin: "0 auto 2px" },
  avatarWrapPlain: { width: 24, height: 24 },
  avatarWrapExact: { width: 30, height: 30, borderRadius: "50%", border: `1.5px solid ${color.goldLight}` },
  avatarDeadFilter: { filter: "grayscale(0.85) opacity(0.7)" },
  deadX: { position: "absolute", inset: 0 },
  chipName: { color: color.textPrimary, fontSize: 8.5, fontWeight: 600, fontFamily: font.body, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  chipNameDead: { color: color.textFaint },
  chipPred: { color: color.textSecondary, fontSize: 8, fontFamily: font.body },
  chipPredExact: { color: color.goldLight, fontWeight: 600 },
};
