import { useCallback, useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import { ensureUserProfile, translateAuthError, logout, consumePendingNickname, needsNicknamePrompt } from "./services/authService";
import { checkIsAdmin } from "./services/adminService";
import AuthScreen from "./screens/AuthScreen";
import WelcomeScreen from "./screens/WelcomeScreen";
import AdminScreen from "./screens/AdminScreen";
import PredictionsScreen from "./screens/PredictionsScreen";
import LeaderboardScreen from "./screens/LeaderboardScreen";
import SpecialsScreen from "./screens/SpecialsScreen";
import ProfileScreen from "./screens/ProfileScreen";
import NicknameScreen from "./screens/NicknameScreen";

// profileState: "idle" | "checking" | "ready" | "needs-nickname" | "error"
// Stare centrală, unică — nimic altceva din aplicație nu mai apelează
// ensureUserProfile. WelcomeScreen NU mai afișează nimic doar pentru că
// există un user Firebase Auth — trebuie explicit profileState === "ready".
// "needs-nickname" blochează TOATĂ aplicația (inclusiv Admin) până la
// alegerea definitivă a nickname-ului — vezi needsNicknamePrompt().
export default function App() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profileState, setProfileState] = useState("idle");
  const [profileError, setProfileError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [view, setView] = useState("welcome"); // "welcome" | "admin"
  // Meciul-țintă când "Progres etapă" e apăsat — PredictionsScreen derulează
  // automat la el, în loc să deschidă mereu lista de la început.
  const [predictionsTarget, setPredictionsTarget] = useState(null);

  // Incrementat la fiecare loadProfile() nou și la logout — orice cerere
  // în zbor care nu mai corespunde cu requestRef.current curent la momentul
  // în care revine din await e ignorată (user schimbat/delogat între timp).
  const requestRef = useRef(0);

  // BUG REPARAT — cauza reală a nickname-ului care nu se salva pentru
  // conturile email/parolă: onAuthStateChanged poate declanșa loadProfile()
  // de DOUĂ ori la înregistrare (comportament normal Firebase — o dată
  // imediat, o dată când tokenul se stabilizează). Fără protecție, ambele
  // apeluri porneau propriul ensureUserProfile() concurent; al doilea
  // găsea pendingNickname deja golit de primul (consumePendingNickname e
  // "citește o singură dată") și putea suprascrie scrierea corectă cu una
  // fără nickname. inFlightRef ține minte cererea în curs PER uid — un al
  // doilea apel pentru ACELAȘI user așteaptă exact aceeași promisiune, nu
  // mai pornește o scriere separată în Firestore.
  const inFlightRef = useRef(null); // { uid, promise } | null

  function loadProfileDeduped(u) {
    if (inFlightRef.current && inFlightRef.current.uid === u.uid) {
      return inFlightRef.current.promise;
    }
    const promise = loadProfile(u).finally(() => {
      if (inFlightRef.current?.promise === promise) inFlightRef.current = null;
    });
    inFlightRef.current = { uid: u.uid, promise };
    return promise;
  }

  const loadProfile = useCallback(async (u) => {
    const myRequestId = ++requestRef.current;
    setProfileState("checking");
    setProfileError("");
    try {
      // BUG REPARAT — varianta anterioară folosea `u.displayName ||
      // consumePendingNickname()`, presupunând greșit că displayName e gol
      // pentru conturile Google. NU e — Google Sign-In completează automat
      // displayName cu numele real din cont, deci orice user nou cu Google
      // primea acel nume direct ca nickname, sărind complet peste
      // NicknameScreen. Acum folosim STRICT consumePendingNickname() —
      // populat doar în fereastra scurtă de după registerWithEmail, null
      // pentru orice alt caz (Google sau login normal), ceea ce lasă
      // nickname-ul gol la primul profil și declanșează corect ecranul de
      // alegere, indiferent de metoda de autentificare.
      const data = await ensureUserProfile(u, consumePendingNickname());
      if (requestRef.current !== myRequestId) return; // cerere învechită, ignorăm
      setProfile(data);
      // Verificăm admin ÎNAINTE de a decide profileState — altfel linkul
      // "Continuă ca Admin" din NicknameScreen ar apărea cu o mică
      // întârziere la primul randare (isAdmin încă false).
      const adminStatus = await checkIsAdmin(u.uid);
      if (requestRef.current !== myRequestId) return;
      setIsAdmin(adminStatus);
      setProfileState(needsNicknamePrompt(data) ? "needs-nickname" : "ready");
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
        loadProfileDeduped(u);
      } else {
        requestRef.current++; // invalidează orice cerere rămasă în zbor
        setProfile(null);
        setProfileState("idle");
        setIsAdmin(false);
        setView("welcome");
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

  // Verificat ÎNAINTE de blocarea de nickname — admin trebuie să poată
  // intra în panou chiar dacă nu și-a ales încă nickname-ul (cerut explicit).
  if (view === "admin" && isAdmin) {
    return <AdminScreen onBack={() => setView("welcome")} />;
  }

  if (profileState === "needs-nickname") {
    return (
      <NicknameScreen
        user={user}
        isAdmin={isAdmin}
        onOpenAdmin={() => setView("admin")}
        onDone={(updated) => {
          setProfile((prev) => ({ ...prev, ...updated }));
          setProfileState("ready");
        }}
      />
    );
  }

  if (view === "predictions") {
    return <PredictionsScreen user={user} onBack={() => setView("welcome")} scrollToMatchId={predictionsTarget} />;
  }

  if (view === "leaderboard") {
    return <LeaderboardScreen user={user} onBack={() => setView("welcome")} />;
  }

  if (view === "specials") {
    return <SpecialsScreen user={user} onBack={() => setView("welcome")} />;
  }

  if (view === "profile") {
    return (
      <ProfileScreen
        user={user}
        profile={profile}
        isAdmin={isAdmin}
        onOpenAdmin={() => setView("admin")}
        onBack={() => setView("welcome")}
      />
    );
  }

  return (
    <WelcomeScreen
      user={user}
      profile={profile}
      isAdmin={isAdmin}
      onOpenAdmin={() => setView("admin")}
      onOpenPredictions={(matchId) => { setPredictionsTarget(matchId || null); setView("predictions"); }}
      onOpenLeaderboard={() => setView("leaderboard")}
      onOpenSpecials={() => setView("specials")}
      onOpenProfile={() => setView("profile")}
    />
  );
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
