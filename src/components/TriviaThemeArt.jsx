// ══════════════════════════════════════════════════════════════════
// Trivia — embleme tematice (strict vizual). CSS + SVG inline + steagurile
// LOCALE deja existente (getClubLogo). Anglia = SVG local gb-eng (crucea
// Sfântului Gheorghe), NICIODATĂ emoji. Zero Firestore.
// ══════════════════════════════════════════════════════════════════
import { getClubLogo } from "../assets/lookup";

export const TRIVIA_THEMES = {
  goat:     { label: "GOAT",               accent: "#75AADB", bg: "linear-gradient(135deg, rgba(117,170,219,0.16), rgba(255,255,255,0.02) 60%)" },
  cr7:      { label: "CR7",                accent: "#E03A2F", bg: "linear-gradient(135deg, rgba(218,41,28,0.16), rgba(4,106,56,0.10) 70%)" , onAccent: "#FFFFFF" },
  duel2v2:  { label: "DUEL 2 vs 2",        accent: "#D4AF37", bg: "linear-gradient(135deg, rgba(212,175,55,0.14), rgba(255,255,255,0.02) 70%)" },
  vs:       { label: "FRANȚA vs SPANIA",   accent: "#4F8BEF", bg: "linear-gradient(135deg, rgba(0,85,164,0.18), rgba(241,191,0,0.08) 75%)" , onAccent: "#FFFFFF" },
  romania:  { label: "ROMÂNIA",            accent: "#FCD116", bg: "linear-gradient(135deg, rgba(0,43,127,0.18), rgba(252,209,22,0.06) 50%, rgba(206,17,38,0.12))" },
  penalty:  { label: "PENALTY",            accent: "#8BD957", bg: "linear-gradient(135deg, rgba(139,217,87,0.13), rgba(255,255,255,0.02) 70%)" },
  redcard:  { label: "CARTONAȘE ROȘII",    accent: "#E23B3B", bg: "linear-gradient(135deg, rgba(226,59,59,0.16), rgba(255,255,255,0.02) 70%)" , onAccent: "#FFFFFF" },
  comeback: { label: "RĂSTURNARE DE SCOR", accent: "#F0A94E", bg: "linear-gradient(135deg, rgba(240,169,78,0.15), rgba(255,255,255,0.02) 70%)" },
  goals:    { label: "FESTIVALUL GOLURILOR", accent: "#F5C542", bg: "linear-gradient(135deg, rgba(245,197,66,0.15), rgba(255,255,255,0.02) 70%)" },
  wall:     { label: "ZIDUL DE NETRECUT",  accent: "#9AA8C4", bg: "linear-gradient(135deg, rgba(154,168,196,0.16), rgba(255,255,255,0.02) 70%)" },
  generic:  { label: "TRIVIA",             accent: "#D4AF37", bg: "linear-gradient(135deg, rgba(212,175,55,0.10), rgba(255,255,255,0.02) 70%)" },
};

export function Flag({ team, w = 22, h = 15, style }) {
  const src = getClubLogo(team);
  if (!src) return null;
  return <img src={src} alt={team} width={w} height={h} style={{ width: w, height: h, objectFit: "cover", borderRadius: 3, boxShadow: "0 0 0 1px rgba(255,255,255,0.25)", display: "block", ...style }} />;
}

const box = { width: 58, height: 58, borderRadius: 12, overflow: "hidden", position: "relative", flexShrink: 0, boxShadow: "0 4px 14px rgba(0,0,0,0.35)" };
const center = { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" };

export default function TriviaEmblem({ theme }) {
  switch (theme) {
    case "goat":
      return (
        <div style={{ ...box, background: "linear-gradient(180deg, #75AADB 0 33%, #FFFFFF 33% 67%, #75AADB 67% 100%)" }}>
          <div style={{ ...center, fontSize: 34, filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.35))" }}>🐐</div>
          <div style={{ position: "absolute", bottom: 3, left: "50%", transform: "translateX(-50%)", background: "#D4AF37", color: "#12141C", fontSize: 8, fontWeight: 900, letterSpacing: 1, padding: "1px 5px", borderRadius: 4 }}>GOAT</div>
        </div>
      );
    case "cr7":
      return (
        <div style={{ ...box, background: "#0E1A12" }}>
          <svg viewBox="0 0 58 58" width="58" height="58" style={{ position: "absolute", inset: 0 }}>
            <defs>
              <linearGradient id="ptshirt" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#046A38" /><stop offset="0.45" stopColor="#046A38" />
                <stop offset="0.45" stopColor="#DA291C" /><stop offset="1" stopColor="#B81F14" />
              </linearGradient>
            </defs>
            <path d="M19 9 L25 7 Q29 11 33 7 L39 9 L50 17 L45 25 L41 22 L41 51 L17 51 L17 22 L13 25 L8 17 Z" fill="url(#ptshirt)" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
            <text x="29" y="41" textAnchor="middle" fontSize="20" fontWeight="900" fill="#FFFFFF" stroke="#8A6D1B" strokeWidth="0.6" fontFamily="Arial Black, Arial, sans-serif">7</text>
          </svg>
          <div style={{ position: "absolute", top: 2, right: 4, color: "#F5C542", fontSize: 8, fontWeight: 900 }}>CR7</div>
        </div>
      );
    case "duel2v2":
      return (
        <div style={{ ...box, background: "#151823", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 5px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}><Flag team="Portugalia" w={18} h={12} /><Flag team="Olanda" w={18} h={12} /></div>
          <div style={{ fontSize: 9, fontWeight: 900, color: "#D4AF37" }}>VS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}><Flag team="Anglia" w={18} h={12} /><Flag team="Germania" w={18} h={12} /></div>
        </div>
      );
    case "vs": {
      const fr = getClubLogo("Franța"); const es = getClubLogo("Spania");
      return (
        <div style={{ ...box, background: "#151823" }}>
          {fr && <img src={fr} alt="Franța" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", clipPath: "polygon(0 0, 100% 0, 0 100%)" }} />}
          {es && <img src={es} alt="Spania" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", clipPath: "polygon(100% 0, 100% 100%, 0 100%)" }} />}
          <div style={{ ...center }}><span style={{ background: "#12141C", color: "#fff", fontSize: 10, fontWeight: 900, padding: "2px 5px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.4)" }}>VS</span></div>
        </div>
      );
    }
    case "romania":
      return (
        <div style={{ ...box, background: "linear-gradient(90deg, #002B7F 0 33.3%, #FCD116 33.3% 66.6%, #CE1126 66.6% 100%)" }}>
          <div style={{ position: "absolute", bottom: 3, left: "50%", transform: "translateX(-50%)", background: "rgba(18,20,28,0.85)", color: "#FCD116", fontSize: 9, fontWeight: 900, letterSpacing: 1, padding: "1px 5px", borderRadius: 4 }}>ROU</div>
        </div>
      );
    case "penalty":
      return (
        <div style={{ ...box, background: "linear-gradient(180deg, #1B3A22, #2E6B38)" }}>
          <svg viewBox="0 0 58 58" width="58" height="58" style={{ position: "absolute", inset: 0 }}>
            <path d="M9 30 L9 12 L49 12 L49 30" fill="none" stroke="#FFFFFF" strokeWidth="2.5" />
            <path d="M13 12 L13 28 M19 12 L19 28 M25 12 L25 28 M31 12 L31 28 M37 12 L37 28 M43 12 L43 28 M9 18 L49 18 M9 24 L49 24" stroke="rgba(255,255,255,0.28)" strokeWidth="0.8" />
            <ellipse cx="29" cy="46" rx="14" ry="3" fill="rgba(255,255,255,0.18)" />
          </svg>
          <div style={{ position: "absolute", left: "50%", bottom: 6, transform: "translateX(-50%)", fontSize: 17 }}>⚽</div>
        </div>
      );
    case "redcard":
      return (
        <div style={{ ...box, background: "#1A1417" }}>
          <div style={{ position: "absolute", left: 14, top: 11, width: 22, height: 31, borderRadius: 4, background: "#7A1E22", transform: "rotate(-14deg)" }} />
          <div style={{ position: "absolute", left: 21, top: 12, width: 24, height: 33, borderRadius: 4, background: "linear-gradient(160deg, #FF4B4B, #C81D25)", transform: "rotate(10deg)", boxShadow: "0 3px 8px rgba(0,0,0,0.45)" }} />
        </div>
      );
    case "comeback":
      return (
        <div style={{ ...box, background: "#0C0E14", border: "1px solid rgba(240,169,78,0.4)", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 1 }}>
          <div style={{ fontSize: 7, fontWeight: 800, color: "#8B93A8", letterSpacing: 0.5 }}>PAUZĂ</div>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#8B93A8", fontFamily: "monospace" }}>0-1</div>
          <div style={{ fontSize: 8, color: "#F0A94E", lineHeight: 1 }}>▼</div>
          <div style={{ fontSize: 13, fontWeight: 900, color: "#F0A94E", fontFamily: "monospace" }}>2-1</div>
        </div>
      );
    case "goals":
      return (
        <div style={{ ...box, background: "#0C0E14", border: "1px solid rgba(245,197,66,0.45)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#F5C542", fontFamily: "monospace", textShadow: "0 0 8px rgba(245,197,66,0.6)", lineHeight: 1 }}>4+</div>
          <div style={{ fontSize: 9, letterSpacing: -1, marginTop: 3 }}>⚽⚽⚽</div>
        </div>
      );
    case "wall":
      return (
        <div style={{ ...box, background: "repeating-linear-gradient(0deg, #4A5570 0 9px, #2A3142 9px 10px)" }}>
          <svg viewBox="0 0 58 58" width="58" height="58" style={{ position: "absolute", inset: 0 }}>
            <path d="M29 9 L45 15 L45 28 Q45 42 29 50 Q13 42 13 28 L13 15 Z" fill="#12141C" stroke="#9AA8C4" strokeWidth="2" />
            <text x="29" y="36" textAnchor="middle" fontSize="16" fontWeight="900" fill="#FFFFFF" fontFamily="Arial Black, Arial, sans-serif">0</text>
          </svg>
        </div>
      );
    default:
      return (
        <div style={{ ...box, background: "linear-gradient(135deg, #D4AF37, #8A6D1B)" }}>
          <div style={{ ...center, fontSize: 24, fontWeight: 900, color: "#12141C" }}>?</div>
        </div>
      );
  }
}
