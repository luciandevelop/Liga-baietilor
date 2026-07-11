import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import AuthScreen from "./screens/AuthScreen";
import WelcomeScreen from "./screens/WelcomeScreen";

export default function App() {
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setCheckingAuth(false);
    });
    return unsubscribe;
  }, []);

  if (checkingAuth) {
    return (
      <div style={loadingStyle}>
        <div style={spinnerStyle} />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onAuthenticated={setUser} />;
  }

  return <WelcomeScreen user={user} />;
}

const loadingStyle = {
  minHeight: "100vh",
  background: "#0A0E1A",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const spinnerStyle = {
  width: 34,
  height: 34,
  borderRadius: "50%",
  border: "3px solid #232B42",
  borderTopColor: "#C9A227",
  animation: "spin 0.8s linear infinite",
};
