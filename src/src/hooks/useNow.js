import { useEffect, useState } from "react";

// Întoarce timestamp-ul curent (ms) și forțează un re-render la fiecare
// `intervalMs` — folosit DOAR ca să reactualizeze UI-ul (countdown, "meciul
// X e acum locked"), nu ca sursă de securitate. Securitatea reală a
// lock-ului rămâne firestore.rules (request.time), independent de acest
// hook și de ceasul telefonului.
export default function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
