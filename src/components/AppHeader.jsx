import { color, font, radius } from "../matchdayTheme";

function CrownIcon({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M3 18L2 8L7.5 12L12 5L16.5 12L22 8L21 18H3Z"
        fill={color.goldOn}
      />
    </svg>
  );
}

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
export default function AppHeader({ nickname, points, avatarInitial, hasNotification, onAvatarClick, onBellClick }) {
  return (
    <div style={s.row}>
      <div style={s.logoGroup}>
        <div style={s.badge}>
          <div style={s.crownWrap}><CrownIcon /></div>
          <span style={s.badgeText}>LB</span>
        </div>
        <div>
          <div style={s.title}>Liga Băieților</div>
          <div style={s.eyebrow}>Matchday Experience</div>
        </div>
      </div>

      <div style={s.right}>
        <button type="button" onClick={onAvatarClick} style={s.profileBtn}>
          <span style={s.avatar}>{avatarInitial}</span>
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
    padding: "16px 16px",
    background: color.headerBg,
    borderBottom: `1px solid ${color.borderSubtle}`,
  },
  logoGroup: { display: "flex", alignItems: "center", gap: 10 },
  badge: {
    position: "relative",
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    background: color.goldGradient,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  crownWrap: { position: "absolute", top: -6, left: "50%", transform: "translateX(-50%)" },
  badgeText: { fontFamily: font.display, fontWeight: 700, fontSize: 15, color: color.goldOn },
  title: { fontFamily: font.body, fontWeight: 800, fontSize: 14.5, color: color.textPrimary, letterSpacing: "0.01em" },
  eyebrow: { fontSize: 9, fontWeight: 700, color: color.textFaint, letterSpacing: "0.12em", marginTop: 1 },

  right: { display: "flex", alignItems: "center", gap: 10 },
  profileBtn: {
    display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: 0,
  },
  avatar: {
    width: 34, height: 34, borderRadius: "50%",
    background: color.surfaceElevated,
    border: `2px solid ${color.gold}`,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: font.display, fontWeight: 700, fontSize: 13, color: color.textPrimary,
    flexShrink: 0,
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
