import { useEffect, useState } from "react";
import { subscribeToGameweekMatches } from "../services/matchesStore";
import { getFeaturedMatchContent } from "../featuredMatchContent";
import { getDisplayMatchState } from "../utils/matchStatus";
import ClubLogo from "../components/ClubLogo";
import PageHeader from "../components/PageHeader";
import useNow from "../hooks/useNow";
import { color, font, radius } from "../matchdayTheme";

// ══════════════════════════════════════════════════════════════════
// FeaturedMatchScreen — pagina ⭐ Meciul Săptămânii. O SINGURĂ
// componentă, accesibilă din toate cele 4 puncte reale de intrare
// (Home/Urmează, hero-ul din Home, Pronosticuri, LIVE) — header-ul
// își adaptează starea (Programat/Live/Final) din exact aceeași sursă
// ca restul aplicației (getDisplayMatchState), fără nicio logică nouă.
//
// GARANȚII, cerute explicit și respectate strict:
// - ZERO citiri Firestore noi la deschidere — `match` vine deja complet
//   din apelant (nu se re-citește), iar actualizările live vin prin
//   subscribeToGameweekMatches, care REUTILIZEAZĂ magazinul comun deja
//   existent (matchesStore) — dacă Home/LIVE au fost active, costul e
//   deja plătit; dacă nu, se creează UN SINGUR listener, exact ca la
//   Home/LIVE, nu unul suplimentar "al treilea tip".
// - ZERO request-uri API-Football — nimic de-aici nu atinge football-sync.
// - Lineup-ul afișat e ÎNTOTDEAUNA "ECHIPA PROBABILĂ", din conținutul
//   local (featuredMatchContent.js) — NU se citește externalFootballCache
//   (acolo scrie football-sync lineup-ul "oficial", dar aducerea lui
//   aici, cu cost zero, ar necesita o schimbare arhitecturală separată,
//   neaprobată acum). Structura de mai jos e pregătită să treacă simplu
//   pe `officialLineup` în ziua în care acel mecanism separat există —
//   vezi `lineupSource` mai jos, singurul loc care ar trebui atins.
// ══════════════════════════════════════════════════════════════════

const JERSEY_CLIP = "polygon(20% 0%,35% 0%,50% 16%,65% 0%,80% 0%,100% 26%,85% 36%,85% 100%,15% 100%,15% 36%,0% 26%)";

export default function FeaturedMatchScreen({ match: initialMatch, gameweekId, onBack }) {
  const now = useNow(30000);
  const [match, setMatch] = useState(initialMatch);
  const [side, setSide] = useState("home"); // "home" | "away" — echipa afișată pe teren

  useEffect(() => {
    if (!gameweekId) return;
    // Reutilizare STRICTĂ a magazinului comun — dacă Home sau LIVE sunt
    // deja active, aceasta e o abonare gratuită (fără citire nouă,
    // vezi matchesStore.js). Dacă niciunul nu e activ, se creează
    // exact UN listener (același mecanism, nu unul în plus).
    const unsub = subscribeToGameweekMatches(gameweekId, (rows) => {
      const fresh = rows.find((m) => m.id === initialMatch.id);
      if (fresh) setMatch(fresh);
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameweekId, initialMatch.id]);

  const display = getDisplayMatchState(match, now);
  const content = getFeaturedMatchContent(match.homeTeam, match.awayTeam);

  // ── Pregătit pentru viitor — singurul loc de atins dacă vreodată
  // lineup-ul oficial ajunge, cu cost zero, în starea comună (ex. ca
  // un câmp pe `match` însuși). Azi, `match.officialLineup` nu există
  // niciodată, deci cade mereu pe varianta probabilă locală. ──
  const lineupSource = match.officialLineup || content?.probableLineup || null;
  const isOfficialLineup = !!match.officialLineup;
  const activeLineup = lineupSource ? lineupSource[side] : null;

  const headerLine = display.status === "scheduled"
    ? formatKickoff(match.kickoffAt)
    : display.status === "live"
      ? `${display.scoreA ?? "–"} — ${display.scoreB ?? "–"}`
      : `${display.scoreA ?? "–"} — ${display.scoreB ?? "–"}`;

  return (
    <div style={s.page}>
      <div style={s.wrap}>
        <PageHeader title="" onBack={onBack} />

        <div style={s.headerBox}>
          <div style={s.eyebrow}>⭐ MECIUL SĂPTĂMÂNII</div>
          <div style={s.teamsRow}>
            <div style={s.teamCol}>
              <ClubLogo teamName={match.homeTeam} size={36} />
              <div style={s.teamName}>{match.homeTeam?.toUpperCase()}</div>
            </div>
            <div style={s.centerCol}>
              <div style={s.scoreLine}>{headerLine}</div>
              {display.status === "live" && (
                <div style={s.liveTag}>● {display.minute != null ? `${display.minute}'` : "LIVE"}</div>
              )}
              {display.status === "finished" && <div style={s.finalTag}>FINAL</div>}
            </div>
            <div style={s.teamCol}>
              <ClubLogo teamName={match.awayTeam} size={36} />
              <div style={s.teamName}>{match.awayTeam?.toUpperCase()}</div>
            </div>
          </div>
          <div style={s.metaLine}>
            {match.competitionName}
            {content?.stadium?.name ? ` · ${content.stadium.name}` : ""}
          </div>
        </div>

        <div style={s.body}>
          <div style={s.sideSwitch}>
            <button type="button" onClick={() => setSide("home")} style={{ ...s.sideBtn, ...(side === "home" ? s.sideBtnActive : null) }}>
              {match.homeTeam?.toUpperCase()}
            </button>
            <button type="button" onClick={() => setSide("away")} style={{ ...s.sideBtn, ...(side === "away" ? s.sideBtnActive : null) }}>
              {match.awayTeam?.toUpperCase()}
            </button>
          </div>

          {activeLineup ? (
            <>
              <div style={s.lineupLabel}>
                {isOfficialLineup ? "ECHIPA DE START" : "ECHIPA PROBABILĂ"}
                {content?.formation ? ` · ${content.formation}` : ""}
              </div>
              <div style={s.pitch}>
                <div style={s.pitchOutline} />
                <div style={s.pitchHalfway} />
                <div style={s.pitchCircle} />
                <div style={s.pitchBox} />
                {activeLineup.map((p) => (
                  <div key={p.name} style={{ position: "absolute", left: `${p.x}%`, top: `${p.y}%`, transform: "translate(-50%,-50%)", textAlign: "center" }}>
                    <div style={{ ...s.jersey, background: p.pos === "GK" ? color.goldLight : "#fff" }} />
                    <div style={s.jerseyName}>{p.name}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={s.emptyNote}>Echipa probabilă nu a fost încă pregătită pentru acest meci.</div>
          )}

          {content?.form && (
            <Section title="FORMĂ">
              <FormRow label={match.homeTeam} results={content.form.home} />
              <FormRow label={match.awayTeam} results={content.form.away} />
            </Section>
          )}

          {content?.h2h?.length > 0 && (
            <Section title="⚔️ ÎNTÂLNIRI DIRECTE">
              <div style={s.h2hBox}>
                {content.h2h.map((r, i) => (
                  <div key={i} style={s.h2hLine}>
                    {r.date && <span style={s.h2hDate}>{r.date} · </span>}
                    {r.home} {r.score} {r.away}
                    {r.note && <span style={s.h2hNote}> ({r.note})</span>}
                  </div>
                ))}
                {content.h2hSummary && <div style={s.h2hSummary}>{content.h2hSummary}</div>}
              </div>
            </Section>
          )}

          {content?.facts?.length > 0 && (
            <Section title="💡 DE ȘTIUT ÎNAINTE DE MECI">
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {content.facts.map((f, i) => <div key={i} style={s.factCard}>{f}</div>)}
              </div>
            </Section>
          )}

          {content?.stadium && (
            <div style={s.stadiumCard}>
              <div style={s.stadiumName}>🏟️ {content.stadium.name}</div>
              <div style={s.stadiumMeta}>
                {content.stadium.city ? `📍 ${content.stadium.city}` : ""}
                {content.stadium.capacity ? ` · 👥 ${content.stadium.capacity.toLocaleString("ro-RO")}` : ""}
              </div>
              {content.stadium.note && <div style={s.stadiumNote}>{content.stadium.note}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={s.sectionTitle}>{title}</div>
      {children}
    </div>
  );
}

function FormRow({ label, results }) {
  const icon = { W: "🟢", D: "🟡", L: "🔴" };
  return (
    <div style={s.formRow}>
      <span style={s.formLabel}>{label}</span>
      <span style={s.formDots}>{(results || []).map((r) => icon[r] || "⚪").join(" ")}</span>
    </div>
  );
}

function formatKickoff(kickoffAt) {
  const ms = kickoffAt?.toMillis ? kickoffAt.toMillis() : null;
  if (!ms) return "";
  const d = new Date(ms);
  return d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
}

const s = {
  page: { minHeight: "100vh", background: color.bgBase },
  wrap: { maxWidth: 480, margin: "0 auto", padding: "0 16px 24px" },

  headerBox: { textAlign: "center", padding: "8px 0 14px", borderBottom: `0.5px solid ${color.borderSubtle}` },
  eyebrow: { color: color.goldLight, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 10, fontFamily: font.body },
  teamsRow: { display: "flex", alignItems: "center", justifyContent: "center", gap: 16 },
  teamCol: { width: 84, textAlign: "center" },
  teamName: { fontSize: 10.5, fontWeight: 700, color: color.textPrimary, marginTop: 5, fontFamily: font.body },
  centerCol: { minWidth: 70, textAlign: "center" },
  scoreLine: { fontSize: 21, fontWeight: 800, color: color.goldLight, fontFamily: font.display },
  liveTag: { color: "#E24B4A", fontSize: 11, fontWeight: 700, marginTop: 3, fontFamily: font.body },
  finalTag: { color: color.textSecondary, fontSize: 11, fontWeight: 700, marginTop: 3, fontFamily: font.body },
  metaLine: { color: color.textFaint, fontSize: 11, marginTop: 10, fontFamily: font.body },

  body: { paddingTop: 14 },
  sideSwitch: { display: "flex", gap: 6, marginBottom: 8 },
  sideBtn: {
    flex: 1, textAlign: "center", padding: "7px 6px", borderRadius: radius.sm, border: "none",
    background: color.surfaceInset, color: color.textFaint, fontSize: 10.5, fontWeight: 700, fontFamily: font.body, cursor: "pointer",
  },
  sideBtnActive: { background: "rgba(212,175,55,0.14)", color: color.goldLight },

  lineupLabel: { color: color.textFaint, fontSize: 9.5, textAlign: "center", marginBottom: 6, fontFamily: font.body, letterSpacing: "0.03em" },
  pitch: {
    position: "relative", width: "100%", aspectRatio: "1.15", background: "#0F2818",
    borderRadius: radius.md, border: "1px solid #1c3d26", overflow: "hidden",
  },
  pitchOutline: { position: "absolute", left: "6%", right: "6%", top: "4%", bottom: "4%", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 4 },
  pitchHalfway: { position: "absolute", left: "6%", right: "6%", top: "50%", height: 1, background: "rgba(255,255,255,0.14)" },
  pitchCircle: { position: "absolute", left: "50%", top: "50%", width: 38, height: 38, border: "1px solid rgba(255,255,255,0.14)", borderRadius: "50%", transform: "translate(-50%,-50%)" },
  pitchBox: { position: "absolute", left: "32%", right: "32%", top: "4%", height: "11%", border: "1px solid rgba(255,255,255,0.14)", borderTop: "none" },
  jersey: { width: 18, height: 18, clipPath: JERSEY_CLIP, margin: "0 auto 2px" },
  jerseyName: { fontSize: 7.3, fontWeight: 600, color: "#fff", whiteSpace: "normal", lineHeight: 1.15, fontFamily: font.body, maxWidth: 50, textAlign: "center" },

  emptyNote: { textAlign: "center", color: color.textFaint, fontSize: 12, padding: "24px 12px", fontFamily: font.body },

  sectionTitle: { fontSize: 11, fontWeight: 700, color: color.textPrimary, marginBottom: 8, fontFamily: font.body },
  formRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  formLabel: { fontSize: 10, color: color.textSecondary, fontFamily: font.body },
  formDots: { fontSize: 12, letterSpacing: 2 },

  h2hBox: { background: color.surfaceInset, borderRadius: radius.sm, padding: "8px 10px" },
  h2hLine: { fontSize: 11, color: color.textSecondary, lineHeight: 1.9, fontFamily: font.body },
  h2hDate: { color: color.textFaint, fontSize: 10, fontWeight: 600 },
  h2hNote: { color: color.textFaint, fontSize: 10, fontStyle: "italic" },
  h2hSummary: { fontSize: 10.5, color: color.goldLight, fontWeight: 600, marginTop: 6, fontFamily: font.body },

  factCard: { background: color.surfaceInset, borderRadius: radius.sm, padding: "8px 10px", fontSize: 10.5, color: color.textSecondary, borderLeft: `2px solid ${color.gold}`, fontFamily: font.body },

  stadiumCard: { marginTop: 16, marginBottom: 4, background: color.surfaceInset, borderRadius: radius.sm, padding: 10 },
  stadiumName: { fontSize: 11, fontWeight: 700, color: color.textPrimary, fontFamily: font.body },
  stadiumMeta: { fontSize: 9.5, color: color.textFaint, marginTop: 2, fontFamily: font.body },
  stadiumNote: { fontSize: 10, color: color.textSecondary, marginTop: 6, fontFamily: font.body },
};
