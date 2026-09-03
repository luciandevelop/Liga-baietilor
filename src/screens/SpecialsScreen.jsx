import { useEffect, useState } from "react";
import { PICK_TYPES } from "../specialDefinitions";
import {
  listSpecialPhases, getUserSpecialProgress, loadAllSpecialPicks, listAllSpecialCompetitions,
} from "../services/specialsService";
import { getUserPublicProfiles } from "../services/profilesService";
import CompetitionLogo from "../components/CompetitionLogo";
import PlayerAvatar from "../components/PlayerAvatar";
import SpecialPhasePicker from "../components/SpecialPhasePicker";
import PageHeader from "../components/PageHeader";
import useNow from "../hooks/useNow";
import { usePrefersReducedMotion } from "../motion";
import { color, font, radius, shadow } from "../matchdayTheme";

// Sezonul curent — folosit deja de restul aplicației (predictionsService).
// Reutilizez direct, nu recreez o a doua sursă de "care e sezonul activ".
import { getCurrentSeason } from "../services/predictionsService";

// Punctajul MAXIM al unei faze — afișat ÎNTOTDEAUNA, indiferent de stare
// ("utilizatorul trebuie să știe instant pentru ce joacă"). Format diferit
// per tip, exact cum a cerut Lu: single = cifra simplă; ranked = "prezent/exact";
// group = punctaj per echipă (nu totalul), ca în exemplul lui (Sferturi = 200p).
function maxPointsLabel(phaseDef) {
  if (phaseDef.type === PICK_TYPES.SINGLE) return `${phaseDef.points}p`;
  if (phaseDef.type === PICK_TYPES.RANKED) return `${phaseDef.pointsInSet} / ${phaseDef.pointsExact}p`;
  if (phaseDef.type === PICK_TYPES.GROUP) return `${phaseDef.pointsPerCorrect}p`;
  return "";
}

// Mesaj contextual în loc de "Coming Soon" — construit din `requiresPhase`
// (deja în configurare), niciodată hardcodat per competiție. Dacă faza nu
// are `requiresPhase` (independentă, ex. Winner/Golgheter), înseamnă doar
// că adminul nu a deschis-o încă — mesaj neutru, nu implică vreo ordine.
function lockMessage(phaseDef, comp) {
  if (phaseDef.requiresPhase) {
    const requiredDef = comp.phases.find((p) => p.id === phaseDef.requiresPhase);
    return `🔒 Se activează după rezolvarea fazei „${requiredDef?.label || phaseDef.requiresPhase}"`;
  }
  return "🔒 Nu a fost deschisă încă";
}

function CountdownBlock({ closesInMs, reduced }) {
  if (closesInMs <= 0) return <span style={s.countdownClosed}>S-a închis</span>;
  const days = Math.floor(closesInMs / 86400000);
  const hours = Math.floor((closesInMs % 86400000) / 3600000);
  const mins = Math.floor((closesInMs % 3600000) / 60000);
  const secs = Math.floor((closesInMs % 60000) / 1000);
  const pad = (n) => String(n).padStart(2, "0");

  const urgency = closesInMs < 3600000 ? "critical" : closesInMs < 86400000 ? "warning" : "normal";
  const tint = urgency === "critical" ? "#F0555A" : urgency === "warning" ? "#F0A84E" : color.gold;

  return (
    <div style={{ ...s.countdownBlock, borderColor: tint + "55", background: tint + "14" }}>
      <span style={{ ...s.countdownLabel, color: tint }}>⏳ Se închide peste</span>
      <div style={s.countdownNumbers}>
        {days > 0 && <span style={{ ...s.countdownDays, color: tint }}>{days} {days === 1 ? "zi" : "zile"}</span>}
        <span
          style={{
            ...s.countdownClock, color: tint,
            ...(urgency === "critical" && !reduced ? { animation: "specialsPulse 1.4s ease-in-out infinite" } : {}),
          }}
        >
          {days > 0 ? `${pad(hours)}:${pad(mins)}:${pad(secs)}` : `${pad(hours)}:${pad(mins)}:${pad(secs)}`}
        </span>
      </div>
    </div>
  );
}

export default function SpecialsScreen({ user, onBack }) {
  const now = useNow(1000); // secunde live pe cronometru — cerut explicit
  const reduced = usePrefersReducedMotion();
  const [season, setSeason] = useState(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedPhaseId, setExpandedPhaseId] = useState("");
  const [revealData, setRevealData] = useState({});
  const [revealLoading, setRevealLoading] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const s = await getCurrentSeason();
        setSeason(s);
        if (s) {
          const prog = await getUserSpecialProgress(user.uid, s.id);
          setProgress(prog);
        }
      } catch (err) {
        console.error(err);
        setError(err.message || err.code);
      } finally {
        setLoading(false);
      }
    })();
  }, [user.uid]);

  async function refreshProgress() {
    if (!season) return;
    const prog = await getUserSpecialProgress(user.uid, season.id);
    setProgress(prog);
  }

  async function handleExpand(phaseId, phaseState) {
    if (expandedPhaseId === phaseId) {
      setExpandedPhaseId("");
      return;
    }
    setExpandedPhaseId(phaseId);
    const isLocked = phaseState?.status === "closed" || phaseState?.status === "resolved";
    if (isLocked && !revealData[phaseId]) {
      setRevealLoading(phaseId);
      try {
        const rows = await loadAllSpecialPicks(phaseId);
        const profiles = await getUserPublicProfiles(rows.map((r) => r.userId));
        setRevealData((prev) => ({ ...prev, [phaseId]: { rows, profiles } }));
      } catch (err) {
        console.error("Eroare la încărcarea alegerilor:", err);
      } finally {
        setRevealLoading("");
      }
    }
  }

  if (loading) return <div style={s.page}><div style={s.centerBox}>Se încarcă…</div></div>;
  if (error) return <div style={s.page}><div style={s.centerBox}>Eroare: {error}</div></div>;
  if (!season || !progress) {
    return (
      <div style={s.page}>
        <div style={s.wrap}>
          <PageHeader title="Speciale" onBack={onBack} />
          <div style={s.centerBox}>Niciun sezon activ momentan.</div>
        </div>
      </div>
    );
  }

  const competitions = listAllSpecialCompetitions();
  const premium = competitions.filter((c) => c.tier === "primary");
  const standard = competitions.filter((c) => c.tier === "secondary");
  const leagues = competitions.filter((c) => c.tier === "league");

  return (
    <div style={s.page}>
      <style>{`
        @keyframes specialsPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
      `}</style>
      <div style={s.wrap}>
        <PageHeader title="🏆 Specialele Sezonului" onBack={onBack} />

        <div style={s.totalBanner}>
          <span style={s.totalLabel}>Puncte Speciale acumulate</span>
          <span style={s.totalValue}>{progress.totalPoints}p</span>
        </div>

        {premium.map((comp) => (
          <HeroCompetitionCard
            key={comp.id} comp={comp}
            progress={progress} now={now} reduced={reduced}
            expandedPhaseId={expandedPhaseId} onExpand={handleExpand}
            revealData={revealData} revealLoading={revealLoading}
            uid={user.uid} seasonId={season.id} onPickSaved={refreshProgress}
          />
        ))}

        {standard.length > 0 && (
          <div style={s.compactRow}>
            {standard.map((comp) => (
              <CompetitionCard
                key={comp.id} comp={comp} compact
                progress={progress} now={now} reduced={reduced}
                expandedPhaseId={expandedPhaseId} onExpand={handleExpand}
                revealData={revealData} revealLoading={revealLoading}
                uid={user.uid} seasonId={season.id} onPickSaved={refreshProgress}
              />
            ))}
          </div>
        )}

        {leagues.length > 0 && (
          <>
            <div style={s.sectionLabel}>Campionate</div>
            <div style={s.leagueGrid}>
              {leagues.map((comp) => (
                <CompetitionCard
                  key={comp.id} comp={comp} compact
                  progress={progress} now={now} reduced={reduced}
                  expandedPhaseId={expandedPhaseId} onExpand={handleExpand}
                  revealData={revealData} revealLoading={revealLoading}
                  uid={user.uid} seasonId={season.id} onPickSaved={refreshProgress}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Champions League — vedeta ecranului, tratament dedicat, nu doar un
// card "puțin mai mare". Fundal propriu, emblemă mare, etichetă explicită
// "COMPETIȚIA PRINCIPALĂ" — recognoscibilă instant, fără să citești nimic. ──
function HeroCompetitionCard(props) {
  const { comp, progress, now, reduced, expandedPhaseId, onExpand, revealData, revealLoading, uid, seasonId, onPickSaved } = props;
  const phaseStateById = Object.fromEntries(progress.phases.filter((p) => p.competitionId === comp.id).map((p) => [p.phaseId, p]));

  return (
    <div style={s.heroCard}>
      <div style={s.heroGlow} />
      <div style={s.heroBadgeRow}>
        <span style={s.heroBadge}>⭐ COMPETIȚIA PRINCIPALĂ</span>
      </div>
      <div style={s.heroHead}>
        <div style={s.heroLogoRing}><CompetitionLogo name={comp.name} size={44} /></div>
        <div>
          <div style={s.heroName}>{comp.name}</div>
          <div style={s.heroSub}>{comp.phases.length} faze speciale de urmărit</div>
        </div>
      </div>

      <div style={s.phaseList}>
        {comp.phases.map((phaseDef) => (
          <PhaseRow
            key={phaseDef.id} phaseDef={phaseDef} comp={comp}
            phaseState={phaseStateById[phaseDef.id]} progress={progress} now={now} reduced={reduced}
            isExpanded={expandedPhaseId === phaseDef.id} onExpand={onExpand}
            revealData={revealData} revealLoading={revealLoading}
            uid={uid} seasonId={seasonId} onPickSaved={onPickSaved}
            big
          />
        ))}
      </div>
    </div>
  );
}

function CompetitionCard({ comp, compact, progress, now, reduced, expandedPhaseId, onExpand, revealData, revealLoading, uid, seasonId, onPickSaved }) {
  const phaseStateById = Object.fromEntries(progress.phases.filter((p) => p.competitionId === comp.id).map((p) => [p.phaseId, p]));

  return (
    <div style={{ ...s.compCard, ...(compact ? s.compCardCompact : {}) }}>
      <div style={s.compHead}>
        <CompetitionLogo name={comp.name} size={22} />
        <span style={s.compName}>{comp.name}</span>
      </div>

      <div style={s.phaseList}>
        {comp.phases.map((phaseDef) => (
          <PhaseRow
            key={phaseDef.id} phaseDef={phaseDef} comp={comp}
            phaseState={phaseStateById[phaseDef.id]} progress={progress} now={now} reduced={reduced}
            isExpanded={expandedPhaseId === phaseDef.id} onExpand={onExpand}
            revealData={revealData} revealLoading={revealLoading}
            uid={uid} seasonId={seasonId} onPickSaved={onPickSaved}
          />
        ))}
      </div>
    </div>
  );
}

function PhaseRow({ phaseDef, comp, phaseState, progress, now, reduced, isExpanded, onExpand, revealData, revealLoading, uid, seasonId, onPickSaved, big }) {
  const notStarted = !phaseState;
  const status = phaseState?.status;
  const score = progress.scoresByPhase[phaseDef.id];
  const ownPick = progress.picksByPhase[phaseDef.id];
  const isOpen = status === "open";
  const isLocked = status === "closed" || status === "resolved";

  let closesInMs = null;
  if (isOpen && phaseState.closesAt) {
    const closesAtMs = phaseState.closesAt.toMillis ? phaseState.closesAt.toMillis() : phaseState.closesAt;
    closesInMs = closesAtMs - now;
  }

  return (
    <div style={s.phaseBlock}>
      <button
        type="button"
        style={{ ...s.phaseRow, ...(notStarted ? s.phaseRowDisabled : {}) }}
        onClick={() => !notStarted && onExpand(phaseDef.id, phaseState)}
        disabled={notStarted}
      >
        <div style={s.phaseTopLine}>
          <span style={s.phaseIcon}>{phaseDef.icon}</span>
          <span style={{ ...s.phaseLabel, fontSize: big ? 13.5 : 12 }}>{phaseDef.label}</span>
          <span style={s.phasePoints}>{maxPointsLabel(phaseDef)}</span>
        </div>

        {notStarted && <div style={s.lockNote}>{lockMessage(phaseDef, comp)}</div>}
        {status === "resolved" && (
          <div style={{ ...s.resultTag, color: score?.points > 0 ? color.green : color.textFaint }}>
            {score?.points > 0 ? "✅" : "❌"} +{score?.points ?? 0}p câștigate
          </div>
        )}
        {status === "closed" && <div style={s.resultTag}>🔒 Blocat — în așteptarea rezultatului</div>}
      </button>

      {isOpen && closesInMs != null && <CountdownBlock closesInMs={closesInMs} reduced={reduced} />}

      {phaseDef.type !== PICK_TYPES.SINGLE && <PhaseProgressBar phaseDef={phaseDef} score={score} ownPick={ownPick} />}

      {isExpanded && isOpen && (
        <SpecialPhasePicker phaseDef={phaseDef} phaseState={phaseState} uid={uid} ownPick={ownPick} onSaved={onPickSaved} />
      )}

      {isExpanded && isLocked && (
        <RevealList loading={revealLoading === phaseDef.id} data={revealData[phaseDef.id]} phaseDef={phaseDef} phaseState={phaseState} />
      )}
    </div>
  );
}

function PhaseProgressBar({ phaseDef, score, ownPick }) {
  if (!ownPick) return null;
  const targetSize = phaseDef.type === PICK_TYPES.RANKED ? phaseDef.rankedSize : phaseDef.groupSize;
  const chosenCount = (ownPick.choices || []).length;
  if (!score) {
    return <div style={s.progressNote}>{chosenCount}/{targetSize} alese</div>;
  }
  const maxPoints = phaseDef.type === PICK_TYPES.RANKED
    ? phaseDef.rankedSize * phaseDef.pointsExact
    : phaseDef.groupSize * phaseDef.pointsPerCorrect;
  const pct = maxPoints > 0 ? Math.min(100, Math.round((score.points / maxPoints) * 100)) : 0;
  return (
    <div style={s.progressWrap}>
      <div style={s.progressTrack}><div style={{ ...s.progressFill, width: `${pct}%` }} /></div>
      <span style={s.progressText}>+{score.points}p</span>
    </div>
  );
}

function RevealList({ loading, data, phaseDef, phaseState }) {
  if (loading) return <div style={s.centerNote}>Se încarcă…</div>;
  if (!data || data.rows.length === 0) return <div style={s.centerNote}>Niciun pronostic salvat.</div>;
  const optionLabel = (id) => phaseState.options?.find((o) => o.id === id)?.label || id;
  return (
    <div style={s.revealList}>
      {data.rows.map((r) => (
        <div key={r.userId} style={s.revealRow}>
          <PlayerAvatar avatarId={data.profiles[r.userId]?.avatarId} nickname={data.profiles[r.userId]?.nickname} size={22} />
          <span style={s.revealName}>{data.profiles[r.userId]?.nickname || r.userId}</span>
          <span style={s.revealPick}>
            {phaseDef.type === PICK_TYPES.SINGLE ? optionLabel(r.choice) : (r.choices || []).map(optionLabel).join(", ")}
          </span>
        </div>
      ))}
    </div>
  );
}

const s = {
  page: { minHeight: "100vh", background: color.bgBase, paddingBottom: 96 },
  wrap: { maxWidth: 480, margin: "0 auto", padding: "16px 16px 0" },

  centerBox: { textAlign: "center", color: color.textSecondary, fontSize: 13.5, padding: "40px 16px" },
  centerNote: { textAlign: "center", fontSize: 11, color: color.textFaint, padding: "10px 0", fontFamily: font.body },

  totalBanner: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    background: "linear-gradient(90deg, rgba(212,175,55,0.16), rgba(212,175,55,0.04))",
    border: `1px solid ${color.goldBorder}`, borderRadius: radius.lg, padding: "14px 16px", marginBottom: 18,
  },
  totalLabel: { fontSize: 12, fontWeight: 700, color: color.textSecondary, fontFamily: font.body },
  totalValue: { fontSize: 20, fontWeight: 900, color: color.goldLight, fontFamily: font.display },

  // ── Hero (Champions League) — tratament complet separat, nu o variantă
  // a cardului normal cu alt padding. ──
  heroCard: {
    position: "relative", overflow: "hidden",
    background: "linear-gradient(160deg, rgba(212,175,55,0.16) 0%, rgba(18,22,31,1) 45%)",
    border: "1.5px solid rgba(212,175,55,0.55)", borderRadius: radius.lg,
    padding: "18px 18px 16px", marginBottom: 18, boxShadow: "0 0 34px -8px rgba(212,175,55,0.5)",
  },
  heroGlow: {
    position: "absolute", top: -60, right: -60, width: 180, height: 180, borderRadius: "50%",
    background: "radial-gradient(circle, rgba(212,175,55,0.35), transparent 70%)", pointerEvents: "none",
  },
  heroBadgeRow: { marginBottom: 10 },
  heroBadge: {
    display: "inline-block", fontSize: 9.5, fontWeight: 800, letterSpacing: "0.06em",
    color: "#0A0A0B", background: color.goldGradient, borderRadius: 999, padding: "4px 10px",
  },
  heroHead: { display: "flex", alignItems: "center", gap: 12, marginBottom: 14, position: "relative" },
  heroLogoRing: {
    width: 60, height: 60, borderRadius: "50%", background: "rgba(212,175,55,0.12)",
    border: "1.5px solid rgba(212,175,55,0.5)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  heroName: { fontSize: 19, fontWeight: 900, color: color.textPrimary, fontFamily: font.display },
  heroSub: { fontSize: 11, color: color.textSecondary, fontFamily: font.body, marginTop: 2 },

  compCard: {
    background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.lg,
    padding: 16, marginBottom: 14, boxShadow: shadow.card,
  },
  compCardCompact: { padding: 12, flex: 1, minWidth: 0 },
  compactRow: { display: "flex", gap: 10, marginBottom: 14 },

  compHead: { display: "flex", alignItems: "center", gap: 8, marginBottom: 12 },
  compName: { fontWeight: 800, color: color.textPrimary, fontFamily: font.display, fontSize: 12.5 },

  sectionLabel: {
    fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase",
    color: color.textFaint, marginBottom: 10, fontFamily: font.body,
  },
  leagueGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 4 },

  phaseList: { display: "flex", flexDirection: "column", gap: 8, position: "relative" },
  phaseBlock: {},
  phaseRow: {
    display: "flex", flexDirection: "column", gap: 4, width: "100%", background: color.surfaceInset,
    border: `1px solid ${color.borderSubtle}`, borderRadius: radius.sm, padding: "10px 11px", cursor: "pointer",
  },
  phaseRowDisabled: { opacity: 0.6, cursor: "default" },
  phaseTopLine: { display: "flex", alignItems: "center", gap: 8, width: "100%" },
  phaseIcon: { fontSize: 14, flexShrink: 0 },
  phaseLabel: {
    flex: 1, fontWeight: 600, color: color.textPrimary, fontFamily: font.body, textAlign: "left",
    minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  phasePoints: { fontSize: 11.5, fontWeight: 800, color: color.goldLight, fontFamily: font.display, flexShrink: 0 },
  lockNote: { fontSize: 10, color: color.textFaint, fontFamily: font.body, textAlign: "left", lineHeight: 1.4 },
  resultTag: { fontSize: 10.5, fontWeight: 700, fontFamily: font.body, textAlign: "left" },

  // ── Cronometru — element central, nu o etichetă mică ──
  countdownBlock: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
    border: "1px solid", borderRadius: radius.sm, padding: "9px 12px",
  },
  countdownLabel: { fontSize: 10, fontWeight: 700, fontFamily: font.body, flexShrink: 0 },
  countdownNumbers: { display: "flex", alignItems: "baseline", gap: 8 },
  countdownDays: { fontSize: 13, fontWeight: 800, fontFamily: font.display },
  countdownClock: { fontSize: 15, fontWeight: 900, fontFamily: font.display, fontVariantNumeric: "tabular-nums" },
  countdownClosed: { fontSize: 11, fontWeight: 700, color: color.textFaint, fontFamily: font.body },

  progressWrap: { display: "flex", alignItems: "center", gap: 8, padding: "0 2px" },
  progressTrack: { flex: 1, height: 5, borderRadius: 999, background: color.surfaceInset, overflow: "hidden" },
  progressFill: { height: "100%", background: color.goldGradient },
  progressText: { fontSize: 10.5, fontWeight: 700, color: color.goldLight, fontFamily: font.body, flexShrink: 0 },
  progressNote: { fontSize: 10, color: color.textFaint, fontFamily: font.body, padding: "0 2px" },

  revealList: { display: "flex", flexDirection: "column", gap: 5, marginTop: 2, padding: "0 2px" },
  revealRow: {
    display: "flex", alignItems: "center", gap: 8, background: color.surface,
    border: `1px solid ${color.borderSubtle}`, borderRadius: radius.sm, padding: "7px 10px",
  },
  revealName: { fontSize: 11, fontWeight: 600, color: color.textPrimary, fontFamily: font.body, flexShrink: 0, width: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  revealPick: { fontSize: 10.5, color: color.textSecondary, fontFamily: font.body, textAlign: "right", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
};
