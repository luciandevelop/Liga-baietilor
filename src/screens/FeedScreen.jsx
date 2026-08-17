import { useEffect, useState } from "react";
import { loadFullFeed } from "../services/feedService";
import { FEED_CATEGORIES } from "../services/feedEngine";
import FeedCard from "../components/FeedCard";
import FeedDetailModal from "../components/FeedDetailModal";
import PageHeader from "../components/PageHeader";
import useNow from "../hooks/useNow";
import { color, font, radius } from "../matchdayTheme";

const PAGE_SIZE = 15;

const FILTERS = [
  { id: "all", label: "Tot" },
  { id: FEED_CATEGORIES.CLASAMENT, label: "🔥 Clasament" },
  { id: FEED_CATEGORIES.MECIURI, label: "⚽ Meciuri" },
  { id: FEED_CATEGORIES.JOKERI, label: "🎯 Jokeri" },
  { id: "cl", label: "🏆 Champions League", competitionContains: "champions league" },
  { id: "el", label: "🏆 Europa League", competitionContains: "europa league" },
  { id: "uecl", label: "🏆 Conference League", competitionContains: "conference league" },
  { id: FEED_CATEGORIES.FUN, label: "😂 Fun" },
];

function matchesFilter(event, filterId) {
  if (filterId === "all") return true;
  const filter = FILTERS.find((f) => f.id === filterId);
  if (filter?.competitionContains) {
    const comp = (event.detail?.competitionName || event.subtitle || "").toLowerCase();
    return comp.includes(filter.competitionContains);
  }
  return event.category === filterId;
}

export default function FeedScreen({ onBack }) {
  const now = useNow(60000);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [events, setEvents] = useState([]);
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const { merged, users: u } = await loadFullFeed();
        setEvents(merged);
        setUsers(u);
      } catch (err) {
        console.error("Eroare la încărcarea Feed-ului:", err);
        setError("Nu s-a putut încărca feed-ul complet — încearcă din nou.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = events.filter((e) => matchesFilter(e, filter));
  const visible = filtered.slice(0, visibleCount);

  return (
    <div style={s.page}>
      <div style={s.wrap}>
        <PageHeader title="📰 Feed" onBack={onBack} />

        <div style={s.filterRow}>
          {FILTERS.map((f) => (
            <button
              key={f.id} type="button"
              style={{ ...s.filterChip, ...(filter === f.id ? s.filterChipActive : {}) }}
              onClick={() => { setFilter(f.id); setVisibleCount(PAGE_SIZE); }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading && <div style={s.centerBox}>Se încarcă…</div>}
        {error && <div style={s.centerBox}>{error}</div>}

        {!loading && !error && visible.length === 0 && (
          <div style={s.centerBox}>Niciun eveniment în categoria asta încă.</div>
        )}

        {!loading && !error && (
          <div style={s.list}>
            {visible.map((e) => (
              <FeedCard key={e.id} event={e} now={now} onClick={setSelected} />
            ))}
          </div>
        )}

        {!loading && visibleCount < filtered.length && (
          <button type="button" style={s.moreBtn} onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}>
            Vezi mai mult ({filtered.length - visibleCount} rămase)
          </button>
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

  filterRow: { display: "flex", gap: 6, overflowX: "auto", marginBottom: 16, paddingBottom: 2 },
  filterChip: {
    flexShrink: 0, fontSize: 11, fontWeight: 700, color: color.textSecondary, background: color.surfaceInset,
    border: `1px solid ${color.border}`, borderRadius: radius.pill, padding: "7px 12px", cursor: "pointer", fontFamily: font.body,
    whiteSpace: "nowrap",
  },
  filterChipActive: { color: color.goldOn, background: color.goldGradient, border: "none", fontWeight: 800 },

  list: { display: "flex", flexDirection: "column", gap: 8 },
  moreBtn: {
    width: "100%", marginTop: 14, background: color.surfaceInset, border: `1px solid ${color.border}`,
    borderRadius: radius.md, padding: "12px 0", fontSize: 12.5, fontWeight: 700, color: color.textSecondary,
    cursor: "pointer", fontFamily: font.body,
  },
};
