import { color, font } from "../matchdayTheme";

const ICONS = {
  matchday: (c) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke={c} strokeWidth="1.6" />
      <path d="M12 7l3 2.2-1.1 3.6H10.1L9 9.2 12 7z" stroke={c} strokeWidth="1.3" />
    </svg>
  ),
  live: (c) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="4" fill={c} />
      <circle cx="12" cy="12" r="8" stroke={c} strokeWidth="1.4" opacity="0.5" />
    </svg>
  ),
  profil: (c) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="3.5" stroke={c} strokeWidth="1.6" />
      <path d="M5 20c1.5-4 4.5-6 7-6s5.5 2 7 6" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
};

// ── "Clasament" a fost înlocuit STRICT aici, în bara de SUS — cerut
// explicit, pentru că Clasamentul există deja în navigația de JOS
// (rămasă complet neatinsă). Ordinea/poziția tab-urilor rămâne fixă
// (LIVE nu apare/dispare din navigație — doar indicatorul de lângă el
// se schimbă, vezi hasLiveMatch mai jos). ──
const TABS = [
  { id: "matchday", label: "Matchday" },
  { id: "live", label: "LIVE" },
  { id: "profil", label: "Profil" },
];

// hasLiveMatch — calculat de apelant (WelcomeScreen, din `matches` deja
// încărcate prin listener-ul existent) — NICIO citire nouă aici, doar
// afișare condiționată a unui punct roșu discret, pulsând.
export default function TopTabNav({ active, onChange, hasLiveMatch = false }) {
  return (
    <div style={s.row}>
      <LivePulseKeyframes />
      {TABS.map((t) => {
        const isActive = active === t.id;
        const c = isActive ? color.gold : color.textFaint;
        return (
          <button key={t.id} type="button" onClick={() => onChange?.(t.id)} style={s.tab}>
            {ICONS[t.id](c)}
            <span style={{ ...s.label, color: isActive ? color.textPrimary : color.textFaint }}>
              {t.label}
              {t.id === "live" && hasLiveMatch && <span style={s.pulseDot} />}
            </span>
            <span style={{ ...s.underline, opacity: isActive ? 1 : 0 }} />
          </button>
        );
      })}
    </div>
  );
}

// ── Pulse FOARTE discret — doar punctul, niciodată textul. opacity +
// scale ușor, fără culori suplimentare, fără casino. ──
function LivePulseKeyframes() {
  return (
    <style>{`
      @keyframes topTabLivePulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.45; transform: scale(0.82); }
      }
    `}</style>
  );
}

const s = {
  row: {
    display: "flex",
    // Continuă exact din culoarea unde s-a oprit header-ul (#14161C),
    // fără linie de separare — aceeași suprafață, nu 2 bucăți alăturate.
    background: "linear-gradient(180deg, #14161C 0%, #15181F 100%)",
    overflowX: "auto",
  },
  tab: {
    position: "relative",
    flex: "1 0 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    background: "none",
    border: "none",
    padding: "13px 14px",
    cursor: "pointer",
  },
  label: { fontSize: 10.5, fontWeight: 700, letterSpacing: "0.04em", fontFamily: font.body, whiteSpace: "nowrap", position: "relative" },
  pulseDot: {
    display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#E24B4A",
    marginLeft: 5, verticalAlign: "middle", animation: "topTabLivePulse 1.8s ease-in-out infinite",
  },
  underline: { position: "absolute", left: "20%", right: "20%", bottom: 0, height: 2, background: color.gold, borderRadius: "2px 2px 0 0" },
};
