import { color, font, radius } from "../matchdayTheme";
import PlayerAvatar from "./PlayerAvatar";
import playLeagueHero from "../assets/playLeagueHeroSeason1.webp";

// ── Identitatea PLAY LEAGUE — cele 10 sezoane, nume definitive.
// Pentru a trece la un sezon nou: schimbă DOAR CURRENT_SEASON_NUMBER,
// mai jos, cu numărul potrivit (1-10) — titlul și subtitlul se
// reconstruiesc singure din listă, nimic altceva de umblat. Dacă un
// sezon viitor are și o imagine nouă, schimbă și importul de mai sus
// (playLeagueHero) — imaginea de-acum e STRICT pentru Sezonul 1. ──
const SEASONS = [
  { emoji: "🔥", name: "Încălzirea" },
  { emoji: "⚔️", name: "Se Separă Apele" },
  { emoji: "🤡", name: "Experții de Serviciu" },
  { emoji: "🎄", name: "Goana după Puncte" },
  { emoji: "🍀", name: "Poate Anul Ăsta" },
  { emoji: "💔", name: "Fără Iubire, Doar Puncte" },
  { emoji: "😈", name: "Se Strânge Lațul" },
  { emoji: "🍀💀", name: "Unii Speră, Alții Disperă" },
  { emoji: "⚔️", name: "Care pe Care" },
  { emoji: "🏆", name: "Ultimul Dans" },
];
const CURRENT_SEASON_NUMBER = 1;
const CURRENT_SEASON = SEASONS[CURRENT_SEASON_NUMBER - 1];

const SEASON_TITLE = "PLAY LEAGUE";
const SEASON_NAME = `${CURRENT_SEASON.emoji} ${CURRENT_SEASON.name.toUpperCase()}`;
const SEASON_NUMBER_LABEL = `SEZONUL ${CURRENT_SEASON_NUMBER}`;
// ── Font-size responsive, calculat din lungimea numelui sezonului —
// cerut explicit: nu micșorăm tot header-ul permanent doar pentru cele
// 2 nume lungi din 10 ("Fără Iubire, Doar Puncte" / "Unii Speră, Alții
// Disperă"), dar alea chiar au nevoie de puțin mai mic ca să nu iasă
// din ecran pe mobil. Restul (8 din 10) rămân la dimensiunea mare. ──
const SEASON_NAME_SIZE = CURRENT_SEASON.name.length > 20 ? 11.5 : 14;

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
        <div style={s.heroGlow}>
          <div style={s.heroWrap}>
            <img src={playLeagueHero} alt="Play League" style={s.heroImg} />
          </div>
        </div>
        <div style={s.textBlock}>
          <div style={s.brand}>{SEASON_TITLE}</div>
          <div style={s.seasonName}>{SEASON_NAME}</div>
          <div style={s.seasonNumber}>{SEASON_NUMBER_LABEL}</div>
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
    padding: "10px 16px",
    // ── O singură suprafață, cerut explicit: navy/charcoal foarte
    // discret, NU negru plat — plus un glow auriu radial DOAR lângă
    // mascotă (stânga), aproape imperceptibil ("simțit, nu văzut").
    // Cele 2 straturi combinate ca fundal — glow-ul e primul (deasupra
    // vizual), gradientul de bază al doilea. ──
    background: "radial-gradient(circle at 10% 55%, rgba(212,175,55,0.05), transparent 50%), linear-gradient(135deg, #10141F 0%, #14161C 100%)",
    gap: 8,
    // Fără linie de separare — culoarea trebuie să curgă direct în
    // TopTabNav dedesubt, fără salt vizual.
  },
  // gap redus (12 -> 9) — imaginea și textul trebuie să se simtă un
  // singur bloc de identitate, nu "icon | text" separate.
  // flex:1 + minWidth:0 — cerut explicit (punctul 7): la nume lungi de
  // sezon, textul trebuie să se restrângă/treacă pe rând nou, NU să
  // intre peste zona utilizatorului din dreapta.
  logoGroup: { display: "flex", alignItems: "center", gap: 9, minWidth: 0, flex: 1 },
  // ── Mărită semnificativ (62 -> 86px, +24px) — cerut explicit: se
  // pierdeau fotoliul/berea/atmosfera la dimensiunea veche. Glow-ul din
  // jurul cadrului acum se extinde puțin ÎN AFARA cadrului (heroGlow),
  // ca lumina să "curgă" spre text, nu să se oprească brusc la margine —
  // exact legătura vizuală cerută, fără card/dreptunghi nou. ──
  heroGlow: {
    borderRadius: radius.md, flexShrink: 0,
    // Redus semnificativ — glow-ul ambiental din fundalul header-ului
    // (mai sus) face deja treaba; ăsta rămâne doar o urmă foarte fină
    // pe conturul imaginii, nu un inel vizibil.
    boxShadow: "0 0 10px 0px rgba(212,175,55,0.18)",
  },
  heroWrap: {
    width: 80, height: 80, borderRadius: radius.md, flexShrink: 0, overflow: "hidden",
    border: `1.5px solid ${color.goldBorder}`,
  },
  heroImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  textBlock: { display: "flex", flexDirection: "column", minWidth: 0, flex: 1 },
  // ── Ierarhie nouă, cerută explicit — 3 niveluri, nu 2 egale:
  // 1) PLAY LEAGUE = brandul, mic, discret, doar context
  // 2) 🔥 ÎNCĂLZIREA = identitatea sezonului, CEA MAI IMPORTANTĂ,
  //    mărită, cu glow cald — asta trebuie să sară în ochi primul
  // 3) SEZONUL 1 = informație secundară, cea mai mică ──
  brand: {
    fontFamily: font.body, fontWeight: 700, fontSize: 10, color: color.textFaint,
    letterSpacing: "0.08em", textTransform: "uppercase", whiteSpace: "nowrap",
  },
  seasonName: {
    fontFamily: font.display, fontWeight: 800, fontSize: SEASON_NAME_SIZE, color: "#F0B860",
    letterSpacing: "0.01em", lineHeight: 1.15, marginTop: 2, wordBreak: "break-word",
    textShadow: "0 0 16px rgba(232,148,60,0.55), 0 0 4px rgba(232,148,60,0.4)",
  },
  seasonNumber: {
    fontFamily: font.body, fontWeight: 700, fontSize: 9.5, color: color.textFaint,
    letterSpacing: "0.08em", marginTop: 2,
  },

  right: { display: "flex", alignItems: "center", gap: 10, flexShrink: 0 },
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
