import { useEffect, useRef, useState } from "react";
import { claimNickname, validateNickname, isNicknameAvailable, translateAuthError } from "../services/authService";
import { usePrefersReducedMotion } from "../motion";
import { color, font, radius, shadow } from "../matchdayTheme";
import PremiumButton from "../components/PremiumButton";
import CinematicBackdrop from "../components/CinematicBackdrop";

const CHECK_DEBOUNCE_MS = 450;

// Ecran obligatoriu pentru experiența normală de joc — fără buton
// "înapoi", fără "mai târziu". Dacă userul e admin, apare și un link
// discret care ocolește blocarea direct spre Admin (cerut explicit —
// blocarea nu trebuie să-l țină departe de panou).
export default function NicknameScreen({ user, isAdmin, onDone, onOpenAdmin }) {
  const reduced = usePrefersReducedMotion();
  const [value, setValue] = useState("");
  const [checkState, setCheckState] = useState("idle"); // idle | checking | available | taken | invalid
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const debounceRef = useRef(null);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    const trimmed = value.trim();
    if (!trimmed) {
      setCheckState("idle");
      return;
    }
    const localErr = validateNickname(trimmed);
    if (localErr) {
      setCheckState("invalid");
      return;
    }
    setCheckState("checking");
    debounceRef.current = setTimeout(async () => {
      try {
        const ok = await isNicknameAvailable(trimmed, user.uid);
        setCheckState(ok ? "available" : "taken");
      } catch (err) {
        console.error(err);
        setCheckState("idle");
      }
    }, CHECK_DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
  }, [value, user.uid]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (checkState !== "available" || saving) return;
    setSaving(true);
    setError("");
    try {
      await claimNickname(user.uid, value);
      setSaved(true);
      setTimeout(() => onDone({ nickname: value.trim() }), reduced ? 0 : 650);
    } catch (err) {
      console.error(err);
      setError(err.code ? translateAuthError(err.code) : err.message);
      setSaving(false);
    }
  }

  const statusCopy = {
    idle: null,
    checking: { text: "Verific disponibilitatea…", color: color.textFaint },
    available: { text: "✓ Disponibil", color: color.green },
    taken: { text: "✕ Deja folosit — alege altul", color: "#F0555A" },
    invalid: { text: validateNickname(value) || "", color: "#F0555A" },
  }[checkState];

  const canSubmit = checkState === "available" && !saving;

  return (
    <CinematicBackdrop crowd style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={s.wrap}>
        {/* ── caricatură placeholder — fără generator de imagini, dar cu volum/glow real ── */}
        <div style={s.avatarWrap}>
          <div style={s.avatarGlow} />
          <div style={s.avatarRing}>
            <svg width="46" height="46" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="4" stroke={color.goldLight} strokeWidth="1.6" />
              <path d="M4 20c1.8-4.8 5.4-7 8-7s6.2 2.2 8 7" stroke={color.goldLight} strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        <div style={s.card}>
          <h1 style={s.title}>Bine ai venit în Liga Băieților!</h1>
          <p style={s.sub}>
            Acesta va fi numele cu care vei apărea în clasamente și pe care ceilalți jucători îl vor vedea.
          </p>

          <form onSubmit={handleSubmit}>
            <div style={s.inputWrap}>
              <input
                style={{ ...s.input, borderColor: checkState === "taken" || checkState === "invalid" ? "#F0555A" : checkState === "available" ? color.greenBorder : color.border }}
                value={value}
                onChange={(e) => { setValue(e.target.value); setError(""); }}
                placeholder="ex: Lucky87"
                maxLength={20}
                autoFocus
                disabled={saving || saved}
              />
              {statusCopy && <span style={{ ...s.statusText, color: statusCopy.color }}>{statusCopy.text}</span>}
            </div>

            {value.trim() && checkState !== "invalid" && (
              <div style={s.preview}>
                🏆 <span style={s.previewName}>{value.trim()}</span>
                <span style={s.previewNote}> — așa vei apărea în joc</span>
              </div>
            )}

            {error && <div style={s.error}>{error}</div>}

            <div style={{ marginTop: 18, transform: saved && !reduced ? "scale(1.02)" : "scale(1)", transition: "transform 260ms ease" }}>
              <PremiumButton onClick={handleSubmit} disabled={!canSubmit}>
                {saving ? (saved ? "✓ Identitate creată" : "Se salvează…") : "Creează-ți identitatea"}
              </PremiumButton>
            </div>
          </form>

          {isAdmin && (
            <button type="button" onClick={onOpenAdmin} style={s.adminLink}>
              Continuă ca Admin →
            </button>
          )}
        </div>
      </div>
    </CinematicBackdrop>
  );
}

const s = {
  wrap: { maxWidth: 420, margin: "0 auto", padding: "24px 20px", textAlign: "center" },
  avatarWrap: { position: "relative", width: 92, height: 92, margin: "0 auto 18px" },
  avatarGlow: {
    position: "absolute", inset: -10, borderRadius: "50%",
    background: "radial-gradient(circle, rgba(212,175,55,0.35), transparent 70%)", filter: "blur(6px)",
  },
  avatarRing: {
    position: "relative", width: 92, height: 92, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
    background: "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.08), rgba(10,11,15,0.7))",
    border: `2px solid ${color.goldBorder}`, boxShadow: shadow.elevated,
  },
  card: {
    background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.lg,
    padding: "24px 22px 20px", boxShadow: shadow.elevated, textAlign: "left",
  },
  title: { fontFamily: font.display, fontSize: 21, fontWeight: 700, color: color.textPrimary, margin: "0 0 10px", textAlign: "center" },
  sub: { fontSize: 13, color: color.textSecondary, lineHeight: 1.5, marginBottom: 20, textAlign: "center", fontFamily: font.body },
  inputWrap: { display: "flex", flexDirection: "column", gap: 6 },
  input: {
    width: "100%", background: color.surfaceInset, border: "1px solid", borderRadius: radius.sm,
    padding: "13px 14px", fontSize: 16, color: color.textPrimary, fontFamily: font.body, outline: "none",
    transition: "border-color 160ms ease",
  },
  statusText: { fontSize: 11.5, fontWeight: 700, fontFamily: font.body, minHeight: 14 },
  preview: {
    marginTop: 14, padding: "10px 14px", borderRadius: radius.sm, background: color.goldBg,
    border: `1px solid ${color.goldBorder}`, fontSize: 13, color: color.textSecondary, fontFamily: font.body,
  },
  previewName: { fontWeight: 800, color: color.goldLight, fontFamily: font.display, fontSize: 14 },
  previewNote: { color: color.textFaint },
  error: { marginTop: 10, fontSize: 12.5, color: "#F0555A", fontFamily: font.body },
  adminLink: {
    display: "block", width: "100%", textAlign: "center", background: "none", border: "none",
    color: color.textFaint, fontSize: 12, fontWeight: 600, marginTop: 16, cursor: "pointer",
    textDecoration: "underline", fontFamily: font.body,
  },
};
