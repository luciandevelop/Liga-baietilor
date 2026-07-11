import { useCallback, useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import { ensureUserProfile, translateAuthError, logout } from "./services/authService";
import AuthScreen from "./screens/AuthScreen";
import WelcomeScreen from "./screens/WelcomeScreen";

// profileState: "idle" | "checking" | "ready" | "error"
// Stare centrală, unică — nimic altceva din aplicație nu mai apelează
// ensureUserProfile. WelcomeScreen NU mai afișează nimic doar pentru că
// există un user Firebase Auth — trebuie explicit profileState === "ready".
export default function App() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profileState, setProfileState] = useState("idle");
  const [profileError, setProfileError] = useState("");

  // Incrementat la fiecare loadProfile() nou și la logout — orice cerere
  // în zbor care nu mai corespunde cu requestRef.current curent la momentul
  // în care revine din await e ignorată (user schimbat/delogat între timp).
  const requestRef = useRef(0);

  const loadProfile = useCallback(async (u) => {
    const myRequestId = ++requestRef.current;
    setProfileState("checking");
    setProfileError("");
    try {
      const data = await ensureUserProfile(u, u.displayName);
      if (requestRef.current !== myRequestId) return; // cerere învechită, ignorăm
      setProfile(data);
      setProfileState("ready");
    } catch (err) {
      if (requestRef.current !== myRequestId) return; // cerere învechită, ignorăm
      console.error("Profil indisponibil:", err);
      setProfileError(translateAuthError(err.code));
      setProfileState("error");
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthChecked(true);
      if (u) {
        loadProfile(u);
      } else {
        requestRef.current++; // invalidează orice cerere rămasă în zbor
        setProfile(null);
        setProfileState("idle");
      }
    });
    return unsubscribe;
  }, [loadProfile]);


  if (!authChecked) {
    return (
      <div style={loadingStyle}>
        <div style={spinnerStyle} />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (profileState === "checking" || profileState === "idle") {
    return (
      <div style={loadingStyle}>
        <div style={spinnerStyle} />
        <p style={loadingTextStyle}>Se pregătește contul…</p>
      </div>
    );
  }

  if (profileState === "error") {
    return (
      <div style={loadingStyle}>
        <div style={errorCardStyle}>
          <h2 style={errorTitleStyle}>Profilul nu s-a putut salva</h2>
          <p style={errorTextStyle}>{profileError}</p>
          <p style={errorTextMutedStyle}>
            Ești autentificat, dar contul tău nu e încă gata de folosit. Poți încerca din nou.
          </p>
          <div style={errorBtnRowStyle}>
            <button style={retryBtnStyle} onClick={() => loadProfile(user)}>
              Încearcă din nou
            </button>
            <button style={logoutBtnStyle} onClick={logout}>
              Deconectează-te
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <WelcomeScreen user={user} profile={profile} />;
}

const loadingStyle = {
  minHeight: "100vh",
  background: "#0A0E1A",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 14,
  padding: "24px 16px",
};

const spinnerStyle = {
  width: 34,
  height: 34,
  borderRadius: "50%",
  border: "3px solid #232B42",
  borderTopColor: "#C9A227",
  animation: "spin 0.8s linear infinite",
};

const loadingTextStyle = {
  color: "#8B93A8",
  fontSize: 13,
  fontFamily: "'Helvetica Neue', Arial, sans-serif",
};

const errorCardStyle = {
  width: "100%",
  maxWidth: 400,
  background: "#12182B",
  borderRadius: 20,
  padding: "28px 24px",
  border: "1px solid #232B42",
  textAlign: "center",
  fontFamily: "'Helvetica Neue', Arial, sans-serif",
};

const errorTitleStyle = { fontSize: 18, fontWeight: 800, color: "#F5F5F0", margin: "0 0 12px" };
const errorTextStyle = { fontSize: 13.5, color: "#E08A82", lineHeight: 1.5, margin: "0 0 10px" };
const errorTextMutedStyle = { fontSize: 12.5, color: "#5A6280", lineHeight: 1.5, margin: "0 0 22px" };
const errorBtnRowStyle = { display: "flex", gap: 10, justifyContent: "center" };

const retryBtnStyle = {
  background: "linear-gradient(180deg, #E0BC4A, #C9A227)",
  color: "#0A0E1A",
  border: "none",
  borderRadius: 10,
  padding: "11px 20px",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
};

const logoutBtnStyle = {
  background: "#0D1220",
  border: "1px solid #232B42",
  color: "#8B93A8",
  borderRadius: 10,
  padding: "11px 20px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};
