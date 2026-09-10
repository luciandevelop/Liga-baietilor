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

// ── ▶ Story — înlocuiește complet clopoțelul (funcțional, dar rar
// declanșat — verificat: loadNotifications() rămâne intact, doar
// intrarea din header a fost redirecționată la Stories). Cerc auriu,
// discret în stare normală; inel + puls continuu când există un Story
// activ nevăzut — se oprește STRICT la terminarea Story-ului, nu la
// timeout sau la simpla deschidere a aplicației. ──
function PlayStoryIcon({ size = 20, lit }) {
  const c = lit ? color.goldLight : color.textSecondary;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke={c} strokeWidth="1.6" />
      <path d="M10 8.5l6 3.5-6 3.5v-7z" fill={c} />
    </svg>
  );
}

function StoryPulseKeyframes() {
  return (
    <style>{`
      @keyframes storyRingPulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(232,199,102,0.55); }
        50% { box-shadow: 0 0 0 6px rgba(232,199,102,0); }
      }
    `}</style>
  );
}

// `points` deja formatat de apelant (ex. "3.450") — componenta nu face
// formatare de numere, doar afișare.
export default function AppHeader({ nickname, points, avatarId, storyPulse, onAvatarClick, onStoryClick }) {
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

        <StoryPulseKeyframes />
        <button type="button" onClick={onStoryClick} style={{ ...s.bellBtn, ...(storyPulse ? s.storyBtnPulsing : null) }} aria-label="Poveștile PLAY LEAGUE">
          <PlayStoryIcon lit={storyPulse} />
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

  bellBtn: { position: "relative", background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", borderRadius: "50%" },
  storyBtnPulsing: {
    border: `1.5px solid ${color.goldLight}`, animation: "storyRingPulse 1.8s ease-in-out infinite",
  },
  dot: {
    position: "absolute", top: 2, right: 2, width: 7, height: 7, borderRadius: "50%",
    background: color.notification, border: `1.5px solid ${color.headerBg}`,
  },
};
