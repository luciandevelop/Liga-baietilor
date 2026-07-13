import { logout } from "../services/authService";

// Componentă pur de afișare — nu mai citește Firestore și nu mai apelează
// ensureUserProfile. Primește `profile` deja încărcat și confirmat de
// App.jsx (profileState === "ready"), ca să nu existe niciun risc de
// apel duplicat sau de afișare falsă a unui cont "gata" înainte de vreme.
export default function WelcomeScreen({ user, profile, isAdmin, onOpenAdmin }) {
  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.badge}>LB</div>
        <h1 style={s.title}>Bun venit, {profile?.nickname || user.displayName || "campionule"}!</h1>
        <p style={s.text}>
          Contul tău e gata. Sezonul <b>Liga Băieților</b> începe odată cu prima etapă din Champions
          League, în septembrie.
        </p>
        <p style={s.textMuted}>
          Restul aplicației (etape, clasament, moduri speciale) apare aici pe măsură ce se
          construiește — revino curând.
        </p>
        {isAdmin && (
          <button style={s.adminBtn} onClick={onOpenAdmin}>
            Panou Admin
          </button>
        )}
        <button style={s.logoutBtn} onClick={logout}>
          Deconectează-te
        </button>
      </div>
    </div>
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
    maxWidth: 420,
    background: "#12182B",
    borderRadius: 20,
    padding: "32px 26px",
    border: "1px solid #232B42",
    boxShadow: "0 24px 70px rgba(0,0,0,0.55)",
    textAlign: "center",
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
    margin: "0 auto 20px",
  },
  title: { fontSize: 21, fontWeight: 800, color: "#F5F5F0", margin: "0 0 14px" },
  text: { fontSize: 14, color: "#C9CFE0", lineHeight: 1.6, margin: "0 0 10px" },
  textMuted: { fontSize: 12.5, color: "#5A6280", lineHeight: 1.6, margin: "0 0 26px" },
  logoutBtn: {
    background: "#0D1220",
    border: "1px solid #232B42",
    color: "#8B93A8",
    borderRadius: 10,
    padding: "11px 22px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
  adminBtn: {
    background: "linear-gradient(180deg, #E0BC4A, #C9A227)",
    color: "#0A0E1A",
    border: "none",
    borderRadius: 10,
    padding: "11px 22px",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    marginBottom: 10,
    display: "block",
    width: "100%",
  },
};
