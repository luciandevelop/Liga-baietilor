import { useState } from "react";
import {
  loginWithEmail,
  registerWithEmail,
  loginWithGoogle,
  resetPassword,
  translateAuthError,
} from "../services/authService";

const MODES = { LOGIN: "login", REGISTER: "register", RESET: "reset" };

// Nu mai primește/apelează onAuthenticated — App.jsx navighează singur,
// prin propriul listener onAuthStateChanged, o dată ce Firebase Auth
// confirmă sign-in-ul (indiferent dacă a venit de-aici sau dintr-o sesiune
// persistată). Ecranul ăsta doar pornește autentificarea și arată erori
// specifice de credențiale — nu mai gestionează erori de profil Firestore.
export default function AuthScreen() {
  const [mode, setMode] = useState(MODES.LOGIN);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  function resetMessages() {
    setError("");
    setInfo("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      if (mode === MODES.LOGIN) {
        await loginWithEmail(email, password);
      } else if (mode === MODES.REGISTER) {
        if (!nickname.trim()) {
          setError("Alege un nickname înainte de a continua.");
          setLoading(false);
          return;
        }
        await registerWithEmail(email, password, nickname.trim());
      } else if (mode === MODES.RESET) {
        await resetPassword(email);
        setInfo("Ți-am trimis un email cu instrucțiuni de resetare a parolei.");
      }
    } catch (err) {
      setError(translateAuthError(err.code));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    resetMessages();
    setLoading(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      setError(translateAuthError(err.code));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.badge}>LB</div>
        <h1 style={s.title}>Liga Băieților</h1>
        <p style={s.subtitle}>
          {mode === MODES.LOGIN && "Intră în cont"}
          {mode === MODES.REGISTER && "Creează-ți contul"}
          {mode === MODES.RESET && "Recuperează parola"}
        </p>

        <form onSubmit={handleSubmit} style={s.form}>
          {mode === MODES.REGISTER && (
            <input
              style={s.input}
              type="text"
              placeholder="Nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              autoComplete="nickname"
            />
          )}

          <input
            style={s.input}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />

          {mode !== MODES.RESET && (
            <input
              style={s.input}
              type="password"
              placeholder="Parolă"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === MODES.LOGIN ? "current-password" : "new-password"}
              required
              minLength={6}
            />
          )}

          {error && <div style={s.errorBox}>{error}</div>}
          {info && <div style={s.infoBox}>{info}</div>}

          <button type="submit" style={s.primaryBtn} disabled={loading}>
            {loading
              ? "Se procesează…"
              : mode === MODES.LOGIN
              ? "Intră în cont"
              : mode === MODES.REGISTER
              ? "Creează cont"
              : "Trimite email de resetare"}
          </button>
        </form>

        {mode !== MODES.RESET && (
          <>
            <div style={s.divider}>
              <span style={s.dividerLine} />
              <span style={s.dividerText}>sau</span>
              <span style={s.dividerLine} />
            </div>
            <button style={s.googleBtn} onClick={handleGoogle} disabled={loading}>
              <GoogleIcon />
              Continuă cu Google
            </button>
          </>
        )}

        <div style={s.links}>
          {mode === MODES.LOGIN && (
            <>
              <button style={s.linkBtn} onClick={() => { resetMessages(); setMode(MODES.RESET); }}>
                Ai uitat parola?
              </button>
              <button style={s.linkBtn} onClick={() => { resetMessages(); setMode(MODES.REGISTER); }}>
                Nu ai cont? Creează unul
              </button>
            </>
          )}
          {mode === MODES.REGISTER && (
            <button style={s.linkBtn} onClick={() => { resetMessages(); setMode(MODES.LOGIN); }}>
              Ai deja cont? Intră
            </button>
          )}
          {mode === MODES.RESET && (
            <button style={s.linkBtn} onClick={() => { resetMessages(); setMode(MODES.LOGIN); }}>
              Înapoi la login
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.84 2.09-1.8 2.73v2.27h2.92c1.7-1.57 2.68-3.88 2.68-6.64z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.27c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34C2.44 15.98 5.48 18 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.71a5.4 5.4 0 010-3.42V4.95H.96a9 9 0 000 8.1l3.01-2.34z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.95l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

const s = {
  page: {
    minHeight: "100vh",
    background: "radial-gradient(ellipse at 50% -10%, #131A2E 0%, #080B14 60%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px 16px",
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: 400,
    background: "#12182B",
    borderRadius: 20,
    padding: "32px 26px",
    border: "1px solid #232B42",
    boxShadow: "0 24px 70px rgba(0,0,0,0.55)",
  },
  badge: {
    width: 52,
    height: 52,
    borderRadius: 14,
    background: "#0A0E1A",
    border: "2px solid #C9A227",
    color: "#C9A227",
    fontWeight: 800,
    fontSize: 18,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 16px",
  },
  title: {
    fontSize: 24,
    fontWeight: 800,
    color: "#F5F5F0",
    textAlign: "center",
    margin: "0 0 4px",
  },
  subtitle: {
    fontSize: 13,
    color: "#8B93A8",
    textAlign: "center",
    margin: "0 0 24px",
  },
  form: { display: "flex", flexDirection: "column", gap: 12 },
  input: {
    background: "#0D1220",
    border: "1px solid #232B42",
    borderRadius: 10,
    padding: "13px 14px",
    fontSize: 14,
    color: "#F5F5F0",
    outline: "none",
  },
  errorBox: {
    background: "rgba(181,69,61,0.12)",
    border: "1px solid rgba(181,69,61,0.4)",
    color: "#E08A82",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 12.5,
    lineHeight: 1.4,
  },
  infoBox: {
    background: "rgba(201,162,39,0.1)",
    border: "1px solid rgba(201,162,39,0.35)",
    color: "#D9BE6B",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 12.5,
    lineHeight: 1.4,
  },
  primaryBtn: {
    background: "linear-gradient(180deg, #E0BC4A, #C9A227)",
    color: "#0A0E1A",
    border: "none",
    borderRadius: 10,
    padding: "13px 0",
    fontSize: 14.5,
    fontWeight: 800,
    cursor: "pointer",
    marginTop: 4,
  },
  divider: { display: "flex", alignItems: "center", gap: 10, margin: "20px 0" },
  dividerLine: { flex: 1, height: 1, background: "#232B42" },
  dividerText: { fontSize: 11.5, color: "#4A5268" },
  googleBtn: {
    width: "100%",
    background: "#F5F5F0",
    color: "#1A1A1A",
    border: "none",
    borderRadius: 10,
    padding: "12px 0",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  links: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
    marginTop: 22,
  },
  linkBtn: {
    background: "none",
    border: "none",
    color: "#8B93A8",
    fontSize: 12.5,
    cursor: "pointer",
    textDecoration: "underline",
    textUnderlineOffset: 3,
  },
};
