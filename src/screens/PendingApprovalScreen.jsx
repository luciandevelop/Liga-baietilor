import { logout } from "../services/authService";
import { color, font, radius } from "../matchdayTheme";

export default function PendingApprovalScreen({ status }) {
  const isDisabled = status === "disabled";
  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.icon}>{isDisabled ? "🚫" : "⏳"}</div>
        <div style={s.title}>
          {isDisabled ? "Cont dezactivat" : "Contul tău a fost creat"}
        </div>
        <div style={s.body}>
          {isDisabled
            ? "Acest cont a fost dezactivat de administrator. Dacă e o greșeală, scrie-i lui Lu."
            : "Așteaptă aprobarea administratorului pentru a intra în Liga Băieților."}
        </div>
        <button type="button" style={s.logoutBtn} onClick={() => logout()}>Delogare</button>
      </div>
    </div>
  );
}

const s = {
  page: {
    minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
    background: color.bg, padding: 24,
  },
  card: {
    width: "100%", maxWidth: 340, textAlign: "center", background: color.surfaceInset,
    border: `1px solid ${color.border}`, borderRadius: radius.lg, padding: "36px 24px",
  },
  icon: { fontSize: 40, marginBottom: 16 },
  title: { fontFamily: font.display, fontSize: 18, fontWeight: 800, color: color.textPrimary, marginBottom: 10 },
  body: { fontSize: 13, color: color.textSecondary, fontFamily: font.body, lineHeight: 1.5, marginBottom: 24 },
  logoutBtn: {
    background: "rgba(255,255,255,0.05)", border: `1px solid ${color.border}`, color: color.textSecondary,
    borderRadius: radius.sm, padding: "10px 20px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: font.body,
  },
};
