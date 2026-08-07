import { useState } from "react";
import { claimNickname, validateNickname, translateAuthError } from "../services/authService";
import { color, font, radius, shadow } from "../matchdayTheme";
import PremiumButton from "../components/PremiumButton";
import CinematicBackdrop from "../components/CinematicBackdrop";

// Ecran obligatoriu — fără buton "înapoi", fără "mai târziu", fără
// posibilitate de a-l închide. App.jsx îl randează în locul oricărui alt
// ecran cât timp needsNicknamePrompt(profile) e adevărat. După salvare cu
// succes, nickname-ul e DEFINITIV — nu există nicio funcție de schimbare
// ulterioară nicăieri în aplicație.
export default function NicknameScreen({ user, onDone }) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    const localErr = validateNickname(value);
    if (localErr) {
      setError(localErr);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const updated = await claimNickname(user.uid, value);
      onDone(updated);
    } catch (err) {
      console.error(err);
      setError(err.code ? translateAuthError(err.code) : err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <CinematicBackdrop style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={s.wrap}>
        <div style={s.card}>
          <div style={s.eyebrow}>Ultimul pas</div>
          <h1 style={s.title}>Alege-ți nickname-ul</h1>
          <p style={s.sub}>
            Va fi numele tău în toată aplicația — clasament, profil, activitate. Odată salvat, nu se mai poate schimba.
          </p>

          <form onSubmit={handleSubmit}>
            <input
              style={s.input}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="ex: Lucian"
              maxLength={20}
              autoFocus
              disabled={saving}
            />
            {error && <div style={s.error}>{error}</div>}

            <div style={{ marginTop: 16 }}>
              <PremiumButton onClick={handleSubmit} disabled={saving || !value.trim()}>
                {saving ? "Se salvează…" : "Salvează definitiv"}
              </PremiumButton>
            </div>
          </form>
        </div>
      </div>
    </CinematicBackdrop>
  );
}

const s = {
  wrap: { maxWidth: 420, margin: "0 auto", padding: "24px 20px" },
  card: {
    background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.lg,
    padding: "28px 22px", boxShadow: shadow.elevated,
  },
  eyebrow: { fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: color.goldLight, marginBottom: 8, fontFamily: font.body },
  title: { fontFamily: font.display, fontSize: 24, fontWeight: 700, color: color.textPrimary, margin: "0 0 10px" },
  sub: { fontSize: 13, color: color.textSecondary, lineHeight: 1.5, marginBottom: 20, fontFamily: font.body },
  input: {
    width: "100%", background: color.surfaceInset, border: `1px solid ${color.border}`, borderRadius: radius.sm,
    padding: "13px 14px", fontSize: 15, color: color.textPrimary, fontFamily: font.body, outline: "none",
  },
  error: { marginTop: 10, fontSize: 12.5, color: "#F0555A", fontFamily: font.body },
};
