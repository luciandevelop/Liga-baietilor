import { useState } from "react";
import ClubCrest from "./ClubCrest";
import { getAvatarUrl } from "../assets/avatars";
import { getCardSeries, getFunStats, getCollectionId } from "../utils/deterministicHash";
import { resolveTitle } from "../playerCardConfig";
import { color, font, radius, shadow } from "../theme";

// SINGURA componentă de card jucător din toată aplicația — Clasament
// (toate 3 taburi) și Admin (preview Live) o folosesc identic. Conținutul
// (serie, titlu, statistici) depinde STRICT de `stats` (din
// adminService.getPlayerCardStats) și de `uid` — niciodată de tab-ul din
// care a fost deschis cardul. Doar `rank`-ul AFIȘAT pe față e contextual
// (poziția din clasamentul din care ai apăsat) — seria "Icon" citește
// separat `stats.isTopGeneral`, nu acest rank, ca să nu se schimbe
// identitatea cardului după din ce clasament îl deschizi.
// ── Textura ramei — nu doar culoare diferită, ci un TIP de tratament
// diferit per serie (cerut explicit: "recognoscibil prin tipul de glow,
// textura ramei, nu doar culoare"). Benzi de lumină late = metal auriu;
// benzi înguste și dese = electric; unghi diagonal + trepte = cristal;
// tranziție lină cu un vârf alb central = marmură.
function getFrameGradient(series) {
  const { primary: p, secondary: s2 } = series;
  switch (series.texture) {
    case "metal":
      return `linear-gradient(120deg, ${s2} 0%, ${p} 10%, #FFFCF0 14%, ${p} 18%, ${s2} 36%, ${p} 58%, #FFFCF0 62%, ${p} 66%, ${s2} 84%, ${p} 100%)`;
    case "electric":
      return `linear-gradient(105deg, ${p} 0%, ${s2} 14%, ${p} 22%, ${s2} 32%, ${p} 46%, #EAF6FF 50%, ${p} 54%, ${s2} 68%, ${p} 78%, ${s2} 90%, ${p} 100%)`;
    case "crystal":
      return `linear-gradient(140deg, ${s2} 0%, ${p} 22%, ${s2} 38%, #FFFFFF 42%, ${s2} 46%, ${p} 64%, ${s2} 80%, ${p} 100%)`;
    case "marble":
      return `linear-gradient(155deg, ${s2} 0%, ${p} 24%, #FFFFFF 40%, ${p} 46%, ${s2} 58%, ${p} 76%, #F5F5F5 88%, ${p} 100%)`;
    default:
      return `linear-gradient(135deg, ${s2}, ${p}, ${s2}, ${p}, ${s2})`;
  }
}

// ── Atmosfera din spatele pozei — al doilea strat de personalitate.
function getAtmosphereGradient(series) {
  const { primary: p, secondary: s2 } = series;
  switch (series.texture) {
    case "electric": // inele concentrice de energie, ca un puls
      return `radial-gradient(35% 30% at 50% 20%, ${s2}88, transparent 60%), radial-gradient(60% 45% at 50% 20%, ${p}55, transparent 70%), radial-gradient(90% 65% at 50% 15%, ${p}25, transparent 75%)`;
    case "crystal": // schimbare de culoare pe diagonală, futurist
      return `linear-gradient(125deg, ${p}66 0%, transparent 35%, ${s2}44 55%, transparent 80%)`;
    case "marble": // glow neutru, mai alb, foarte discret
      return `radial-gradient(80% 55% at 40% 10%, ${s2}40, transparent 65%), radial-gradient(60% 40% at 80% 30%, ${p}25, transparent 70%)`;
    case "metal":
    default:
      return `radial-gradient(70% 55% at 30% 10%, ${p}55, transparent 65%)`;
  }
}

// ── Particule — un singur strat de fundal cu mai multe radial-gradient
// mici, poziții fixe (determinist, nu aleator la fiecare randare) — fără
// elemente DOM suplimentare, cost aproape zero.
function getParticlesLayer(series) {
  const c = series.secondary;
  const dots = [
    [12, 18, 2], [78, 10, 1.5], [88, 32, 2.5], [8, 44, 1.5], [92, 58, 2],
    [15, 66, 1.5], [70, 72, 2], [35, 8, 1.5], [55, 28, 1.5], [25, 52, 2],
  ];
  return dots
    .map(([x, y, r]) => `radial-gradient(${r}px ${r}px at ${x}% ${y}%, ${c}CC, transparent 100%)`)
    .join(", ");
}

export default function PlayerCard({ uid, nickname, avatarId, rank, stats, onClose }) {
  const [flipped, setFlipped] = useState(false);
  // Când meciurile arătate sunt dintr-o etapă anterioară (fallback, nu
  // etapa cerută), lista pornește închisă — "eventual se deschid la
  // apăsare, dar tot trebuie să fie", nu ocupă spațiu implicit pentru o
  // etapă care nu e cea din context.
  const [matchesOpen, setMatchesOpen] = useState(!stats?.matchesIsFallback);

  if (!stats) return null;

  const series = getCardSeries(uid);
  const title = resolveTitle(stats);
  const funStats = getFunStats(uid);
  const collectionId = getCollectionId(uid);
  const avatarUrl = getAvatarUrl(avatarId);
  const initial = (nickname || "?").trim().charAt(0).toUpperCase();

  // Cel mai nou meci primul — "primul lucru pe care vor userii să-l vadă".
  const matches = (stats.matches || []).slice().sort((a, b) => {
    const at = a.kickoffAt?.toMillis ? a.kickoffAt.toMillis() : 0;
    const bt = b.kickoffAt?.toMillis ? b.kickoffAt.toMillis() : 0;
    return bt - at;
  });

  const bgGradient = `radial-gradient(140% 100% at 30% 0%, ${series.primary}33, transparent 55%), linear-gradient(165deg, ${series.bg[0]} 0%, ${series.bg[1]} 60%, ${series.bg[2]} 100%)`;
  const frameGradient = getFrameGradient(series);
  const atmosphereGradient = getAtmosphereGradient(series);
  const particlesLayer = getParticlesLayer(series);

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.sheet} onClick={(e) => e.stopPropagation()}>
        <div style={s.grabber} />

        <div style={s.cardWrap}>
          <div style={s.flipScene}>
            <div
              style={{ ...s.flipInner, transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
              onClick={() => setFlipped((v) => !v)}
            >
              {/* ══════════ FAȚĂ — ramă dublă, formă cu vârfuri (nu dreptunghi tăiat) ══════════ */}
              <div style={{ ...s.flipFace, ...s.cardOuter, background: frameGradient, boxShadow: `0 0 40px ${series.primary}66, ${shadow.elevated}` }}>
                {/* rama exterioară — "metalul" cardului, se vede ca o bandă în jurul întregului conținut */}
                <div style={{ ...s.cardInner, background: bgGradient }}>
                  {/* strat de atmosferă — personalitate proprie per serie, sub poză */}
                  <div style={{ ...s.atmosphereLayer, background: atmosphereGradient }} />
                  {/* particule discrete — aceleași poziții mereu, doar culoarea seriei diferă */}
                  <div style={{ ...s.particlesLayer, backgroundImage: particlesLayer }} />

                  <button style={s.closeBtn} onClick={(e) => { e.stopPropagation(); onClose(); }} type="button">✕</button>

                  {/* cristale la colțuri — peste ramă ȘI peste poză, fără graniță */}
                  <div style={{ ...s.shard, ...s.shardTL, background: series.secondary }} />
                  <div style={{ ...s.shard, ...s.shardTR, background: series.primary }} />
                  <div style={{ ...s.shard, ...s.shardBL, background: series.primary }} />

                  {/* emblemă centrală sus — mică, discretă */}
                  <div style={{ ...s.crest, borderColor: series.secondary, color: series.secondary }}>{series.icon}</div>

                  {/* rank — mare, fundal închis fix (nu culoarea seriei — altfel se pierde pe poze deschise la culoare) */}
                  <div style={s.rankZone}>
                    <div style={{ ...s.rankShield, borderColor: series.secondary }} />
                    <span style={s.rankNum}>#{rank ?? "–"}</span>
                  </div>

                  {/* serie — panglică, nu chip */}
                  <div style={{ ...s.seriesRibbon, background: `linear-gradient(90deg, ${series.secondary}, ${series.primary})` }}>
                    <span style={s.seriesRibbonText}>{series.name}</span>
                  </div>

                  {/* poza — umple aproape tot cardul; masca estompează marginile treptat,
                      nu le taie drept — asta o "imprimă" în card, nu o lipește peste el */}
                  <div style={s.avatarZone}>
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={nickname} style={s.avatarImg} />
                    ) : (
                      <div style={{ ...s.avatarFallback, color: series.secondary }}>{initial}</div>
                    )}
                    {/* leagă tonul pozei de culoarea seriei, indiferent ce fotografie reală e încărcată */}
                    <div style={{ ...s.photoWash, background: `radial-gradient(120% 90% at 30% 15%, ${series.primary}4D, transparent 60%), radial-gradient(90% 70% at 85% 85%, ${series.secondary}33, transparent 65%)` }} />
                  </div>
                  {/* voal care contopește poza cu fundalul seriei — nicio linie dură */}
                  <div style={{ ...s.blendVeil, background: `linear-gradient(180deg, ${series.bg[0]}00 0%, ${series.bg[0]}22 40%, ${series.bg[2]}CC 78%, ${series.bg[2]} 100%)` }} />
                  <div style={{ ...s.blendVeilTop, background: `linear-gradient(180deg, ${series.bg[0]}55, transparent)` }} />

                  <div style={s.frontFooter}>
                    <div style={{ ...s.footerDivider, background: `linear-gradient(90deg, transparent, ${series.secondary}, transparent)` }} />
                    <div style={s.frontName}>{nickname}</div>
                    <div style={{ ...s.frontTitle, color: series.secondary }}>
                      <span>{title.icon}</span> {title.label}
                    </div>
                    <div style={{ ...s.frontScore, color: series.secondary, textShadow: `0 0 18px ${series.primary}` }}>
                      {stats.generalPoints}<span style={s.frontScoreUnit}>p</span>
                    </div>
                    <div style={s.frontMotto}>„{series.motto}"</div>
                    <div style={s.lbCrest}>LB</div>
                  </div>
                </div>
              </div>

              {/* ══════════ VERSO — aceeași ramă, conținut dens ══════════ */}
              <div style={{ ...s.flipFace, ...s.cardOuter, ...s.backFace, background: frameGradient, boxShadow: `0 0 40px ${series.primary}66, ${shadow.elevated}` }}>
                <div style={{ ...s.cardInner, background: bgGradient }}>
                <button style={s.closeBtn} onClick={(e) => { e.stopPropagation(); onClose(); }} type="button">✕</button>

                <div style={s.backHead}>
                  <span style={{ color: series.secondary }}>{series.icon}</span>
                  <span style={s.backName}>{nickname}</span>
                </div>

                <div style={s.pointsRow}>
                  <div style={s.pointsTile}>
                    <span style={s.pointsValue}>{stats.etapaPoints ?? "–"}</span>
                    <span style={s.pointsLabel}>Etapă{stats.etapaPointsIsLive ? " · live" : ""}</span>
                  </div>
                  <div style={s.pointsTile}>
                    <span style={s.pointsValue}>{stats.seasonPoints}</span>
                    <span style={s.pointsLabel}>Sezon</span>
                  </div>
                  <div style={s.pointsTile}>
                    <span style={s.pointsValue}>{stats.generalPoints}</span>
                    <span style={s.pointsLabel}>General</span>
                  </div>
                </div>
                {stats.etapaPointsIsLive && (
                  <div style={s.liveNote}>Etapa curentă încă nu e finalizată — punctajul e provizoriu, se recalculează la fiecare meci încheiat.</div>
                )}

                {stats.etapaIsCompleted && (
                  <div style={s.summaryBox}>
                    <div style={s.summaryLabel}>REZUMAT ETAPĂ</div>
                    <div style={s.summaryRow}>
                      <span>⚽ Pronosticuri meciuri</span>
                      <span style={s.summaryVal}>{stats.etapaMatchPoints ?? 0}p</span>
                    </div>
                    {stats.etapaRankingBonus != null && stats.etapaRankingBonus !== 0 && (
                      <div style={s.summaryRow}>
                        <span>🟢 Bonus etapă</span>
                        <span style={s.summaryVal}>{stats.etapaRankingBonus > 0 ? "+" : ""}{stats.etapaRankingBonus}p</span>
                      </div>
                    )}
                    {stats.etapaMainSurprisePoints != null && (
                      <div style={s.summaryRow}>
                        <span>🏆 Surpriza Principală</span>
                        <span style={s.summaryVal}>{stats.etapaMainSurprisePoints > 0 ? "+" : ""}{stats.etapaMainSurprisePoints}p</span>
                      </div>
                    )}
                    {stats.etapaBonusSurprisePoints != null && (
                      <div style={s.summaryRow}>
                        <span>🎰 Bonusul Săptămânii</span>
                        <span style={s.summaryVal}>{stats.etapaBonusSurprisePoints > 0 ? "+" : ""}{stats.etapaBonusSurprisePoints}p</span>
                      </div>
                    )}
                    <div style={s.summaryDivider} />
                    <div style={s.summaryTotalRow}>
                      <span>TOTAL ETAPĂ</span>
                      <span style={s.summaryTotalVal}>
                        {(stats.etapaMatchPoints || 0) + (stats.etapaRankingBonus || 0) + (stats.etapaMainSurprisePoints || 0) + (stats.etapaBonusSurprisePoints || 0)}p
                      </span>
                    </div>
                  </div>
                )}

                <div style={s.realStatsList}>
                  <StatRow label="Scoruri exacte" value={stats.exactScores} accent={series.secondary} />
                  <StatRow label="Procent pronosticuri corecte" value={`${stats.correctPct}%`} accent={series.secondary} />
                  <StatRow label="Bonusuri câștigate" value={stats.bonusWinsCount} accent={series.secondary} />
                  <StatRow label="Meciuri fără puncte" value={stats.noPointsCount} accent={series.secondary} />
                  <StatRow label="Puncte speciale" value={`+${stats.specialPoints}p`} accent={series.secondary} strong />
                </div>

                <div style={s.funDivider}>
                  <span style={s.funLabel}>FUN</span>
                </div>
                <div style={s.funGrid}>
                  {funStats.map((f) => (
                    <div key={f.id} style={s.funTile}>
                      <span style={s.funIcon}>{f.icon}</span>
                      <span style={s.funText}>{f.label}</span>
                      <span style={{ ...s.funValue, color: series.secondary }}>{f.value}</span>
                    </div>
                  ))}
                </div>

                <div style={s.backFooter}>
                  <span style={s.backQuote}>„{series.quote}"</span>
                  <span style={s.collectionId}>{collectionId}</span>
                </div>
                </div>
              </div>
            </div>
          </div>
          <div style={s.flipHintOuter}>Apasă cardul {flipped ? "pentru a reveni" : "pentru statistici"}</div>
        </div>

        <div style={s.list}>
          {matches.length === 0 && (
            <div style={s.emptyMatches}>Nu există încă niciun meci finalizat pentru acest jucător.</div>
          )}

          {matches.length > 0 && stats.matchesIsFallback && (
            <button type="button" style={s.matchesFallbackHeader} onClick={() => setMatchesOpen((v) => !v)}>
              <span>Meciuri din {stats.matchesFallbackTitle || "ultima etapă jucată"} · etapa curentă nu are date pentru acest jucător</span>
              <span style={{ transform: matchesOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 200ms ease" }}>▾</span>
            </button>
          )}

          {matches.length > 0 && matchesOpen && matches.map((m) => (
            <MatchBreakdownRow key={m.matchId} m={m} />
          ))}
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value, accent, strong }) {
  return (
    <div style={s.statRow}>
      <span style={s.statRowLabel}>{label}</span>
      <span style={{ ...s.statRowValue, color: strong ? accent : color.textPrimary }}>{value}</span>
    </div>
  );
}

// Etichete clare pentru fiecare prag de punctaj — traduc cifra în
// cuvinte, exact din pragurile reale ale scoringEngine.js (120/70/50/20/0
// pentru scor; 15/10/5/2/0 pentru cornere/cartonașe), ca să nu existe loc
// de interpretare sau discuție între jucători despre "de ce atâtea puncte".
function scoreTierLabel(points) {
  if (points === 120) return "scor exact";
  if (points === 70) return "rezultat + diferență corectă";
  if (points === 50) return "doar rezultatul corect";
  if (points === 20) return "doar totalul de goluri";
  return "fără reușită";
}
function sideStatTierLabel(points) {
  if (points === 15) return "exact";
  if (points === 10) return "diferență de 1";
  if (points === 5) return "diferență de 2";
  if (points === 2) return "diferență de 3";
  return "fără reușită";
}

function MatchBreakdownRow({ m }) {
  const predText = m.prediction ? `${m.prediction.scoreA}-${m.prediction.scoreB}` : null;

  if (m.status === "no-prediction") {
    return (
      <div style={s.compactRow}>
        <ClubCrest teamName={m.homeTeam} size={20} />
        <span style={s.compactTeams}>{m.homeTeam} – {m.awayTeam}</span>
        <span style={s.compactStatus}>Fără pronostic · 0p</span>
      </div>
    );
  }

  return (
    <div style={{ ...s.matchCard, ...(m.isJoker ? s.matchCardJoker : {}), ...(m.isFeatured ? s.matchCardFeatured : {}) }}>
      <div style={s.matchTop}>
        <div style={s.matchTeamsInline}>
          <ClubCrest teamName={m.homeTeam} size={26} />
          <span style={s.matchTeamsText}>{m.homeTeam} vs {m.awayTeam}</span>
          <ClubCrest teamName={m.awayTeam} size={26} />
        </div>
        <span style={s.matchTotal}>{m.finalMatchPoints}p</span>
      </div>

      {(m.isFeatured || m.isJoker) && (
        <div style={s.matchBadgeRow}>
          {m.isFeatured && <span style={s.tagFeatured}>⭐ ×2</span>}
          {m.isJoker && <span style={s.tagJoker}>🃏 ×2</span>}
        </div>
      )}

      <div style={s.predVsReal}>
        <div style={s.predVsRealCol}>
          <span style={s.predVsRealLabel}>PREDICȚIE</span>
          <span style={s.predVsRealScore}>{predText || "–"}</span>
        </div>
        <span style={s.predVsRealArrow}>vs</span>
        <div style={s.predVsRealCol}>
          <span style={s.predVsRealLabel}>REAL</span>
          <span style={{ ...s.predVsRealScore, color: color.goldLight }}>{m.real.scoreA}-{m.real.scoreB}</span>
        </div>
      </div>

      {/* defalcare pe surse de puncte, CU eticheta pragului — nu doar
          cifra, ca să nu existe loc de discuție despre "de ce atâtea puncte" */}
      <div style={s.breakdownGrid}>
        <div style={s.breakdownCell}>
          <span style={s.breakdownHead}>Scor <b style={s.breakdownVal}>+{m.scorePoints ?? 0}</b></span>
          <span style={s.breakdownTier}>{scoreTierLabel(m.scorePoints ?? 0)}</span>
        </div>
        <div style={s.breakdownCell}>
          <span style={s.breakdownHead}>Cornere <b style={s.breakdownVal}>+{m.cornersPoints ?? 0}</b></span>
          <span style={s.breakdownTier}>{sideStatTierLabel(m.cornersPoints ?? 0)}</span>
        </div>
        <div style={s.breakdownCell}>
          <span style={s.breakdownHead}>Cartonașe <b style={s.breakdownVal}>+{m.cardsPoints ?? 0}</b></span>
          <span style={s.breakdownTier}>{sideStatTierLabel(m.cardsPoints ?? 0)}</span>
        </div>
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
    width: "100%", maxWidth: 480, maxHeight: "92vh", overflowY: "auto",
    background: color.surfaceInset, borderTop: `1px solid ${color.border}`, borderRadius: "20px 20px 0 0",
    padding: "10px 16px 24px", fontFamily: font.body,
  },
  grabber: { width: 36, height: 4, borderRadius: 999, background: color.border, margin: "0 auto 14px" },

  cardWrap: { marginBottom: 14 },
  flipScene: { perspective: "1600px" },
  flipInner: {
    position: "relative", width: "100%", aspectRatio: "0.68", transformStyle: "preserve-3d",
    transition: "transform 650ms cubic-bezier(.4,.2,.2,1)", cursor: "pointer",
  },
  flipFace: { position: "absolute", inset: 0, backfaceVisibility: "hidden" },
  backFace: { transform: "rotateY(180deg)" },

  // Forma cardului — "scut" cu umeri tăiați și vârf central, nu un
  // dreptunghi cu colțuri rotunjite. Aplicată direct pe cardOuter/cardInner
  // mai jos (cardInner ușor mai mic, pentru banda metalică de 7px vizibilă
  // de jur-împrejur).
  cardOuter: { clipPath: "polygon(0% 5%, 15% 5%, 20% 0%, 80% 0%, 85% 5%, 100% 5%, 100% 100%, 0% 100%)" },
  cardInner: {
    position: "absolute", inset: 7, overflow: "hidden",
    clipPath: "polygon(0% 4.5%, 15% 4.5%, 20% 0%, 80% 0%, 85% 4.5%, 100% 4.5%, 100% 100%, 0% 100%)",
    // adâncime — umbră închisă spre interior (senzație de "groapă" în care
    // stă poza) + un contur luminos subțire chiar la margine (bevel).
    boxShadow: "inset 0 0 22px 6px rgba(0,0,0,0.55), inset 0 2px 0 rgba(255,255,255,0.25), inset 0 -2px 0 rgba(0,0,0,0.4)",
  },
  shard: { position: "absolute", width: 4, borderRadius: 4, zIndex: 6, filter: "blur(0.4px)", boxShadow: "0 0 8px rgba(255,255,255,0.5)" },
  shardTL: { height: 95, top: -8, left: 34, transform: "rotate(-22deg)", opacity: 0.9 },
  shardTR: { height: 75, top: -4, right: 46, transform: "rotate(26deg)", opacity: 0.75 },
  shardBL: { height: 55, top: "30%", left: -6, transform: "rotate(68deg)", opacity: 0.55 },

  crest: {
    position: "absolute", top: 2, left: "50%", transform: "translateX(-50%)", zIndex: 7,
    width: 26, height: 26, borderRadius: "50%", border: "1.5px solid",
    background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13,
  },

  rankZone: { position: "absolute", top: 18, left: 16, zIndex: 7, width: 46, height: 50 },
  rankShield: {
    position: "absolute", inset: 0, clipPath: "polygon(50% 0%, 100% 20%, 100% 75%, 50% 100%, 0% 75%, 0% 20%)",
    background: "rgba(6,8,14,0.72)", border: "1.5px solid", boxShadow: "0 3px 10px rgba(0,0,0,0.5)",
  },
  rankNum: {
    position: "relative", zIndex: 2, display: "flex", alignItems: "center", justifyContent: "center",
    width: "100%", height: "100%", fontSize: 19, fontWeight: 900, color: "#fff",
    fontFamily: "Georgia, serif", textShadow: "0 1px 4px rgba(0,0,0,0.6)",
  },

  seriesRibbon: {
    position: "absolute", top: 18, right: -6, zIndex: 7, padding: "5px 20px 5px 14px", maxWidth: 170,
    clipPath: "polygon(0% 0%, 100% 0%, 94% 50%, 100% 100%, 0% 100%)",
    boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
  },
  seriesRibbonText: { fontSize: 9, fontWeight: 800, letterSpacing: "0.02em", color: "#0A0E1A", textTransform: "uppercase", whiteSpace: "nowrap" },
  closeBtn: {
    position: "absolute", top: 12, right: 12, zIndex: 20,
    background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.25)", color: "#fff",
    borderRadius: 8, width: 28, height: 28, fontSize: 12, cursor: "pointer",
  },

  // Poza umple aproape tot cardul (78%, mărit — cerut explicit, "prefer să
  // fie prea mare decât prea mic"), poziționată absolut sus. Masca e
  // schimbarea cea mai importantă din acest sprint: estompează marginile
  // treptat (jos + lateral), nu le taie drept — asta face poza să pară
  // "imprimată" în card, nu lipită peste el.
  avatarZone: {
    position: "absolute", top: 0, left: 0, right: 0, height: "78%", zIndex: 2, overflow: "hidden",
    maskImage: "radial-gradient(115% 85% at 50% 32%, black 52%, transparent 94%)",
    WebkitMaskImage: "radial-gradient(115% 85% at 50% 32%, black 52%, transparent 94%)",
  },
  avatarImg: { width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 10%" },
  avatarFallback: {
    width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 120, fontWeight: 900, fontFamily: font.display, opacity: 0.85,
  },
  // strat de atmosferă, SUB poză — personalitatea seriei se vede și acolo
  // unde poza nu acoperă (marginile estompate de mască).
  atmosphereLayer: { position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none" },
  particlesLayer: { position: "absolute", inset: 0, zIndex: 5, pointerEvents: "none", backgroundRepeat: "no-repeat" },
  // voal — leagă tonul pozei de culoarea seriei
  photoWash: { position: "absolute", inset: 0, mixBlendMode: "soft-light", opacity: 0.55, pointerEvents: "none" },
  // voal jos — contopește poza cu fundalul seriei, gradual, fără muchie
  blendVeil: { position: "absolute", left: 0, right: 0, top: "34%", bottom: 0, zIndex: 3, pointerEvents: "none" },
  // voal sus, discret — ca badge-urile/emblema să rămână lizibile pe poză
  blendVeilTop: { position: "absolute", left: 0, right: 0, top: 0, height: "22%", zIndex: 3, pointerEvents: "none" },

  frontFooter: { position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 4, textAlign: "center", padding: "0 12px 12px" },
  footerDivider: { height: 1, width: "60%", margin: "0 auto 8px" },
  frontName: { fontSize: 19, fontWeight: 800, color: "#fff", textShadow: "0 2px 8px rgba(0,0,0,0.6)", fontFamily: font.display },
  frontTitle: { fontSize: 10.5, fontWeight: 700, marginTop: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 },
  frontScore: { fontSize: 34, fontWeight: 900, fontFamily: "Georgia, serif", marginTop: 2, lineHeight: 1 },
  frontScoreUnit: { fontSize: 16, fontWeight: 700, marginLeft: 2 },
  frontMotto: { fontSize: 9.5, color: "rgba(255,255,255,0.5)", fontStyle: "italic", marginTop: 5 },
  lbCrest: {
    marginTop: 8, display: "inline-block", fontSize: 8, fontWeight: 800, letterSpacing: "0.08em",
    color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 4, padding: "2px 6px",
  },

  backHead: { display: "flex", alignItems: "center", gap: 8, padding: "20px 18px 12px", fontSize: 15, fontWeight: 800, color: "#fff" },
  backName: {},

  pointsRow: { display: "flex", gap: 6, padding: "0 16px", marginBottom: 8 },
  pointsTile: {
    flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
    background: "rgba(255,255,255,0.06)", borderRadius: radius.md, padding: "8px 2px",
  },
  pointsValue: { fontSize: 16, fontWeight: 800, color: "#fff", fontFamily: font.display },
  pointsLabel: { fontSize: 8, color: "rgba(255,255,255,0.55)", fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase" },
  liveNote: {
    fontSize: 9, color: color.textFaint, textAlign: "center", padding: "0 16px", marginBottom: 8, lineHeight: 1.4,
  },
  summaryBox: {
    margin: "0 16px 12px", padding: "10px 12px", background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
  },
  summaryLabel: {
    fontSize: 9, fontWeight: 800, letterSpacing: "0.05em", color: "rgba(255,255,255,0.5)", marginBottom: 6,
  },
  summaryRow: {
    display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(255,255,255,0.85)",
    padding: "3px 0", fontFamily: font.body,
  },
  summaryVal: { fontWeight: 700, color: "#fff" },
  summaryDivider: { height: 1, background: "rgba(255,255,255,0.15)", margin: "6px 0" },
  summaryTotalRow: {
    display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 800, color: "#fff",
    fontFamily: font.display,
  },
  summaryTotalVal: { fontWeight: 800 },
  realStatsList: { padding: "0 16px", display: "flex", flexDirection: "column", gap: 2 },
  statRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "8px 4px", borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
  statRowLabel: { fontSize: 11.5, color: "rgba(255,255,255,0.65)", fontWeight: 600 },
  statRowValue: { fontSize: 14, fontWeight: 800, fontFamily: font.display },

  funDivider: { display: "flex", alignItems: "center", gap: 8, padding: "14px 18px 8px" },
  funLabel: { fontSize: 9.5, fontWeight: 800, letterSpacing: "0.12em", color: "rgba(255,255,255,0.4)" },
  funGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, padding: "0 16px" },
  funTile: {
    display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.06)",
    borderRadius: 10, padding: "7px 9px",
  },
  funIcon: { fontSize: 13 },
  funText: { fontSize: 10, color: "rgba(255,255,255,0.7)", flex: 1, fontWeight: 600 },
  funValue: { fontSize: 12, fontWeight: 800, fontFamily: font.display },

  backFooter: { position: "absolute", bottom: 12, left: 18, right: 18, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 8 },
  backQuote: { fontSize: 9, fontStyle: "italic", color: "rgba(255,255,255,0.4)", flex: 1 },
  collectionId: { fontSize: 8.5, color: "rgba(255,255,255,0.35)", fontWeight: 700, letterSpacing: "0.04em", flexShrink: 0 },

  flipHintOuter: { textAlign: "center", fontSize: 10.5, color: color.textFaint, fontWeight: 600, marginTop: 8 },

  list: { display: "flex", flexDirection: "column", gap: 8 },
  emptyMatches: {
    textAlign: "center", fontSize: 11.5, color: color.textFaint, padding: "16px 10px",
    background: color.surface, border: `1px solid ${color.borderSubtle}`, borderRadius: radius.sm,
  },
  matchesFallbackHeader: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, width: "100%",
    background: "rgba(212,175,55,0.08)", border: "1px solid rgba(212,175,55,0.25)", borderRadius: radius.sm,
    padding: "9px 12px", cursor: "pointer", fontSize: 10.5, fontWeight: 600, color: color.textSecondary,
    fontFamily: font.body, textAlign: "left",
  },
  compactRow: {
    display: "flex", alignItems: "center", gap: 8, background: color.surface,
    border: `1px solid ${color.borderSubtle}`, borderRadius: radius.sm, padding: "7px 10px",
  },
  compactTeams: { fontSize: 11.5, fontWeight: 600, color: color.textSecondary, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  compactStatus: { fontSize: 9.5, fontWeight: 700, color: color.textFaint, flexShrink: 0, background: color.surfaceInset, borderRadius: 999, padding: "2px 8px" },

  matchCard: { background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.md, padding: "12px 12px" },
  matchCardFeatured: { border: "1px solid rgba(201,162,39,0.35)" },
  matchCardJoker: { border: "1px solid rgba(63,168,92,0.4)" },
  matchTop: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
  matchTeamsInline: { display: "flex", alignItems: "center", gap: 7, minWidth: 0, flex: 1 },
  matchTeamsText: { fontSize: 12, fontWeight: 700, color: color.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  matchTotal: { fontSize: 19, fontWeight: 700, color: color.goldLight, flexShrink: 0, fontFamily: font.display },
  matchBadgeRow: { display: "flex", gap: 6, marginTop: 8 },
  tagFeatured: { fontSize: 9.5, fontWeight: 800, color: color.goldLight, background: "rgba(201,162,39,0.14)", border: "1px solid rgba(201,162,39,0.4)", borderRadius: 999, padding: "2px 7px" },
  tagJoker: { fontSize: 9.5, fontWeight: 800, color: color.green, background: color.greenBg, border: `1px solid ${color.greenBorder}`, borderRadius: 999, padding: "2px 7px" },
  predVsReal: { display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${color.borderSubtle}` },
  predVsRealCol: { display: "flex", flexDirection: "column", alignItems: "center", gap: 2 },
  predVsRealLabel: { fontSize: 9, fontWeight: 700, color: color.textFaint, letterSpacing: "0.05em" },
  predVsRealScore: { fontSize: 20, fontWeight: 700, color: color.textPrimary, fontFamily: font.display },
  predVsRealArrow: { fontSize: 11, color: color.textFaint, fontWeight: 700, marginTop: 12 },

  breakdownGrid: {
    display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4,
    marginTop: 10, paddingTop: 10, borderTop: `1px solid ${color.borderSubtle}`,
  },
  breakdownCell: { display: "flex", flexDirection: "column", gap: 2 },
  breakdownVal: { color: color.textSecondary, fontWeight: 700 },
  breakdownHead: { fontSize: 10.5, color: color.textMuted, fontFamily: font.body },
  breakdownTier: { fontSize: 8.5, color: color.textFaint, fontStyle: "italic", fontFamily: font.body },
};
