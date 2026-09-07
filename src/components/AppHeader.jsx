import { color, font, radius } from "../matchdayTheme";
import PlayerAvatar from "./PlayerAvatar";
import playLeagueHero from "../assets/playLeagueHeroSeason1.webp";

// ── Identitatea PLAY LEAGUE — text pregătit ca să fie ușor de schimbat
// la fiecare sezon nou (10 sezoane, 4 etape fiecare), fără să umbli
// prin restul componentei. Doar aceste 2 constante se schimbă la
// începutul fiecărui sezon nou — restul (imagine, layout) rămâne.
// Imaginea de-aici e STRICT pentru Sezonul 1 ("Încălzirea") — dacă un
// sezon viitor are altă imagine, se schimbă importul de mai sus.
const SEASON_TITLE = "PLAY LEAGUE";
const SEASON_SUBTITLE = "🔥 SEZONUL 1 · ÎNCĂLZIREA";

function BellIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3C9.5 3 7.5 5 7.5 7.5V11C7.5 12.5 7 13.5 6 14.5C5.7 14.8 5.9 15.5 6.4 15.5H17.6C18.1 15.5 18.3 14.8 18 14.5C17 13.5 16.5 12.5 16.5 11V7.5C16.5 5 14.5 3 12 3Z"
        stroke={color.textSecondary}
        strokeWidth="1.6"
      />
      <path d="M10 18a2 2 0 004 0" stroke={color.textSecondary} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

// `points` deja formatat de apelant (ex. "3.450") — componenta nu face
// formatare de numere, doar afișare.
export default function AppHeader({ nickname, points, avatarId, hasNotification, onAvatarClick, onBellClick }) {
  return (
    <div style={s.row}>
      <div style={s.logoGroup}>
        <div style={s.heroWrap}>
          <img src={playLeagueHero} alt="Play League" style={s.heroImg} />
        </div>
        <div>
          <div style={s.title}>{SEASON_TITLE}</div>
          <div style={s.eyebrow}>{SEASON_SUBTITLE}</div>
        </div>
      </div>

      <div style={s.right}>
        <button type="button" onClick={onAvatarClick} style={s.profileBtn}>
          <div style={s.avatarRing}>
            <PlayerAvatar avatarId={avatarId} nickname={nickname} size={30} />
          </div>
          <span style={s.profileText}>
            <span style={s.nickname}>{nickname}</span>
            <span style={s.points}>{points} PCT</span>
          </span>
          <span style={s.chevron}>›</span>
        </button>

        <button type="button" onClick={onBellClick} style={s.bellBtn} aria-label="Notificări">
          <BellIcon />
          {hasNotification && <span style={s.dot} />}
        </button>
      </div>
    </div>
  );
}

const s = {
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 16px",
    background: color.headerBg,
    borderBottom: `1px solid ${color.borderSubtle}`,
  },
  logoGroup: { display: "flex", alignItems: "center", gap: 12 },
  // ── Mărit moderat față de vechiul pătrățel de 38px (cerut explicit —
  // personajul trebuie să aibă prezență, fără să devină banner). Colț
  // rotunjit + inel auriu + glow discret, ca imaginea originală (care
  // are deja un cadru auriu) să se integreze natural în temă, nu să
  // pară "lipită". ──
  heroWrap: {
    width: 62, height: 62, borderRadius: radius.md, flexShrink: 0, overflow: "hidden",
    border: `1.5px solid ${color.goldBorder}`,
    boxShadow: "0 0 14px -2px rgba(212,175,55,0.5)",
  },
  heroImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  title: { fontFamily: font.display, fontWeight: 800, fontSize: 16.5, color: color.textPrimary, letterSpacing: "0.02em" },
  // ── Glow portocaliu discret pe subtitlu — ecoul focului din imagine
  // ("Sezonul 1 · Încălzirea"), fără nicio animație/particule — cerut
  // explicit: premium, nu kitsch, zero cost de performanță. ──
  eyebrow: {
    fontSize: 9.5, fontWeight: 700, color: "#E8A455", letterSpacing: "0.03em", marginTop: 2, whiteSpace: "nowrap",
    textShadow: "0 0 8px rgba(232,164,85,0.45)",
  },

  right: { display: "flex", alignItems: "center", gap: 10 },
  profileBtn: {
    display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: 0,
  },
  avatarRing: {
    width: 34, height: 34, borderRadius: "50%", border: `2px solid ${color.gold}`,
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 1,
  },
  profileText: { display: "flex", flexDirection: "column", alignItems: "flex-start" },
  nickname: { fontSize: 11, fontWeight: 700, color: color.textPrimary, letterSpacing: "0.02em" },
  points: { fontFamily: font.display, fontSize: 12.5, fontWeight: 700, color: color.goldLight },
  chevron: { fontSize: 16, color: color.textFaint, marginLeft: 2 },

  bellBtn: { position: "relative", background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" },
  dot: {
    position: "absolute", top: 2, right: 2, width: 7, height: 7, borderRadius: "50%",
    background: color.notification, border: `1.5px solid ${color.headerBg}`,
  },
};
