import { useEffect, useState } from "react";
import { getHomeFeedTop } from "../services/feedService";
import { getCurrentSeason, getCurrentGameweek } from "../services/predictionsService";
import { listMatches } from "../services/adminService";
import FeedCard from "../components/FeedCard";
import FeedDetailModal from "../components/FeedDetailModal";
import PageHeader from "../components/PageHeader";
import useNow from "../hooks/useNow";
import { color } from "../matchdayTheme";

// ── "Vezi tot" — NU mai e un ecran separat, cu tab-uri/filtre proprii
// (clasament/citate/meciuri etc., ca înainte). E ACELAȘI Feed ca Home,
// aceeași sursă (getHomeFeedTop), aceeași logică editorială de
// prioritate/dată/diversitate — doar `max` mai mare (~13, față de 8 pe
// Home). Utilizatorul dă scroll și descoperă conținutul, ca un feed
// normal, nu navighează pe categorii separate.
//
// Firestore: nu se mai citește NIMIC exclusiv pentru tab-uri — acelea
// nu mai există. Meciurile etapei curente se citesc o singură dată
// (listMatches, nu listener live — Feed-ul complet nu are nevoie de
// scor live, doar de kickoff-ul meciurilor pentru boost-ul pe dată),
// nu s-a adăugat nicio citire nouă în plus față de ce era deja necesar.
const VISIBLE_COUNT = 13;

export default function FeedScreen({ onBack }) {
  const now = useNow(60000);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [events, setEvents] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const season = await getCurrentSeason();
        const gw = season ? await getCurrentGameweek(season.id) : null;
        const matches = gw ? await listMatches(gw.id) : [];
        const { merged } = await getHomeFeedTop(matches, { max: VISIBLE_COUNT });
        setEvents(merged);
      } catch (err) {
        console.error("Eroare la încărcarea Feed-ului:", err);
        setError("Nu s-a putut încărca feed-ul — încearcă din nou.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div style={s.page}>
      <div style={s.wrap}>
        <PageHeader title="📰 Feed" onBack={onBack} />

        {loading && <div style={s.centerBox}>Se încarcă…</div>}
        {error && <div style={s.centerBox}>{error}</div>}

        {!loading && !error && events.length === 0 && (
          <div style={s.centerBox}>Niciun eveniment în Feed încă.</div>
        )}

        {!loading && !error && (
          <div style={s.list}>
            {events.map((e) => (
              <FeedCard key={e.id} event={e} now={now} onClick={setSelected} />
            ))}
          </div>
        )}
      </div>

      <FeedDetailModal event={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

const s = {
  page: { minHeight: "100vh", background: color.bgBase, paddingBottom: 40 },
  wrap: { maxWidth: 480, margin: "0 auto", padding: "16px 16px 0" },
  centerBox: { textAlign: "center", color: color.textSecondary, fontSize: 13, padding: "36px 16px" },
  list: { display: "flex", flexDirection: "column", gap: 8 },
};
