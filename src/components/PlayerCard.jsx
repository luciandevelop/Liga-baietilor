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
export default function PlayerCard({ uid, nickname, avatarId, rank, stats, onClose }) {
  const [flipped, setFlipped] = useState(false);

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
              {/* ══════════ FAȚĂ ══════════ */}
              <div style={{ ...s.flipFace, ...s.card, background: bgGradient, borderColor: series.primary, boxShadow: `0 0 34px ${series.primary}55, ${shadow.elevated}` }}>
                <button style={s.closeBtn} onClick={(e) => { e.stopPropagation(); onClose(); }} type="button">✕</button>

                {/* efect de cristale în spatele avatarului — pur CSS */}
                <div style={s.crystalField}>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      style={{
                        ...s.crystal,
                        background: i % 2 === 0 ? series.primary : series.secondary,
                        transform: `rotate(${i * 60}deg) translateY(-40px)`,
                        opacity: 0.16 + (i % 3) * 0.05,
                      }}
                    />
                  ))}
                </div>

                <div style={s.rankBadge}>#{rank ?? "–"}</div>
                <div style={{ ...s.seriesTag, borderColor: series.primary, color: series.secondary }}>{series.name}</div>

                <div style={s.avatarZone}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={nickname} style={s.avatarImg} />
                  ) : (
                    <div style={{ ...s.avatarFallback, color: series.secondary }}>{initial}</div>
                  )}
                  <div style={{ ...s.avatarFade, background: `linear-gradient(180deg, transparent 55%, ${series.bg[2]} 96%)` }} />
                </div>

                <div style={s.frontFooter}>
                  <div style={s.frontName}>{nickname}</div>
                  <div style={{ ...s.frontTitle, color: series.secondary }}>
                    <span>{title.icon}</span> {title.label}
                  </div>
                  <div style={{ ...s.frontScore, color: series.secondary }}>{stats.generalPoints}<span style={s.frontScoreUnit}>p</span></div>
                  <div style={s.frontMotto}>„{series.motto}"</div>
                </div>
              </div>

              {/* ══════════ VERSO ══════════ */}
              <div style={{ ...s.flipFace, ...s.card, ...s.backFace, background: bgGradient, borderColor: series.primary, boxShadow: `0 0 34px ${series.primary}55, ${shadow.elevated}` }}>
                <button style={s.closeBtn} onClick={(e) => { e.stopPropagation(); onClose(); }} type="button">✕</button>

                <div style={s.backHead}>
                  <span style={{ color: series.secondary }}>{series.icon}</span>
                  <span style={s.backName}>{nickname}</span>
                </div>

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
          <div style={s.flipHintOuter}>Apasă cardul {flipped ? "pentru a reveni" : "pentru statistici"}</div>
        </div>

        <div style={s.list}>
          {matches.length === 0 && (
            <div style={s.emptyMatches}>Etapa curentă nu e finalizată încă — meciurile apar aici după închidere.</div>
          )}
          {matches.map((m) => (
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

  card: {
    borderRadius: 22, overflow: "hidden", border: "1.5px solid",
    clipPath: "polygon(10% 0%, 90% 0%, 100% 6%, 100% 100%, 0% 100%, 0% 6%)",
  },

  closeBtn: {
    position: "absolute", top: 12, right: 12, zIndex: 5,
    background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.25)", color: "#fff",
    borderRadius: 8, width: 28, height: 28, fontSize: 12, cursor: "pointer",
  },

  crystalField: { position: "absolute", top: "8%", left: "50%", width: 0, height: 0, zIndex: 1 },
  crystal: { position: "absolute", width: 3, height: 90, borderRadius: 3, filter: "blur(0.5px)" },

  rankBadge: { position: "absolute", top: 14, left: 16, zIndex: 5, fontSize: 26, fontWeight: 900, color: "#fff", fontFamily: "Georgia, serif", textShadow: "0 2px 8px rgba(0,0,0,0.5)" },
  seriesTag: {
    position: "absolute", top: 16, right: 46, zIndex: 5, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.04em",
    textTransform: "uppercase", padding: "3px 8px", borderRadius: 999, border: "1px solid", background: "rgba(0,0,0,0.35)",
  },

  avatarZone: { position: "relative", width: "100%", height: "71%", zIndex: 2, overflow: "hidden" },
  avatarImg: { width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 15%" },
  avatarFallback: {
    width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 110, fontWeight: 900, fontFamily: font.display, opacity: 0.85,
  },
  avatarFade: { position: "absolute", inset: 0 },

  frontFooter: { position: "relative", zIndex: 4, textAlign: "center", padding: "0 12px 14px" },
  frontName: { fontSize: 19, fontWeight: 800, color: "#fff", textShadow: "0 2px 8px rgba(0,0,0,0.5)", fontFamily: font.display },
  frontTitle: { fontSize: 10.5, fontWeight: 700, marginTop: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 },
  frontScore: { fontSize: 32, fontWeight: 900, fontFamily: "Georgia, serif", marginTop: 2, lineHeight: 1 },
  frontScoreUnit: { fontSize: 15, fontWeight: 700, marginLeft: 2 },
  frontMotto: { fontSize: 9.5, color: "rgba(255,255,255,0.5)", fontStyle: "italic", marginTop: 5 },

  backHead: { display: "flex", alignItems: "center", gap: 8, padding: "20px 18px 12px", fontSize: 15, fontWeight: 800, color: "#fff" },
  backName: {},

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
};
