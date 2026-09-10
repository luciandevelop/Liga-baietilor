import { useEffect, useState } from "react";
import { listSeasons, listGameweeks } from "../services/adminService";
import { slideUrl, seasonNumberFromList } from "../storyAssets";
import StoryViewer from "../components/StoryViewer";
import PageHeader from "../components/PageHeader";
import { color, font, radius } from "../matchdayTheme";

const SEASON_LABELS = [
  { emoji: "🔥", name: "Încălzirea" }, { emoji: "⚔️", name: "Se Separă Apele" },
  { emoji: "🤡", name: "Experții de Serviciu" }, { emoji: "🎄", name: "Goana după Puncte" },
  { emoji: "🍀", name: "Poate Anul Ăsta" }, { emoji: "💔", name: "Fără Iubire, Doar Puncte" },
  { emoji: "😈", name: "Se Strânge Lațul" }, { emoji: "🍀💀", name: "Unii Speră, Alții Disperă" },
  { emoji: "⚔️", name: "Care pe Care" }, { emoji: "🏆", name: "Ultimul Dans" },
];

// ══════════════════════════════════════════════════════════════════
// 📖 POVEȘTILE PLAY LEAGUE — arhivă vizuală, grupată pe sezoane. O
// singură încărcare, la deschidere (navigare inițiată de user, nu
// automată) — listSeasons() + listGameweeks() per sezon, cost mic și
// fix (≤10 sezoane, ≤40 etape vreodată). Afișează STRICT Stories
// publicate (storyActive true) — nimic gol/placeholder pentru sloturi
// neîncă publicate.
// ══════════════════════════════════════════════════════════════════
export default function StoriesArchiveScreen({ onBack, onOpenLeaderboard }) {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState([]); // [{ seasonId, seasonNumber, label, etapaStories: [], seasonStory: null|{} }]
  const [viewerSlides, setViewerSlides] = useState(null); // { slideUrls, isSeasonStory } | null

  function openStory(story) {
    const slideUrls = Array.from({ length: story.slideCount }, (_, i) =>
      slideUrl({ seasonNumber: story.seasonNumber, etapaNumber: story.etapaNumber, slideIndex: i + 1 }));
    setViewerSlides({ slideUrls, isSeasonStory: story.kind === "season" });
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const seasons = await listSeasons();
        const groupsRaw = await Promise.all(seasons.map(async (sn) => {
          const gws = await listGameweeks(sn.id);
          const seasonNumber = seasonNumberFromList(sn.id, seasons);
          const etapaStories = gws
            .filter((g) => g.storyActive)
            .sort((a, b) => (a.number || 0) - (b.number || 0))
            .map((g) => ({ kind: "gw", id: g.id, seasonId: sn.id, seasonNumber, etapaNumber: g.number, slideCount: g.storySlideCount || 0, version: g.storyVersion || 1, title: `Etapa ${g.number}` }));
          const seasonStory = sn.storyActive
            ? { kind: "season", id: sn.id, seasonId: sn.id, seasonNumber, etapaNumber: null, slideCount: sn.storySlideCount || 0, version: sn.storyVersion || 1, title: "Povestea sezonului" }
            : null;
          return { seasonId: sn.id, seasonNumber, label: SEASON_LABELS[(seasonNumber || 1) - 1] || { emoji: "⭐", name: sn.name }, etapaStories, seasonStory };
        }));
        // doar sezoanele care au măcar un Story publicat, sezon curent primul
        const filtered = groupsRaw
          .filter((g) => g.etapaStories.length > 0 || g.seasonStory)
          .sort((a, b) => (b.seasonNumber || 0) - (a.seasonNumber || 0));
        if (!cancelled) setGroups(filtered);
      } catch (err) {
        console.error("Eroare la încărcarea arhivei Stories:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={s.page}>
      <div style={s.wrap}>
        <PageHeader title="📖 Poveștile PLAY LEAGUE" subtitle="Ediția 2026/27" onBack={onBack} />

        {loading && <div style={s.centerNote}>Se încarcă…</div>}
        {!loading && groups.length === 0 && <div style={s.centerNote}>Încă nu există Stories publicate.</div>}

        {!loading && groups.map((g) => (
          <div key={g.seasonId} style={s.seasonBlock}>
            <div style={s.seasonTitle}>{g.label.emoji} {g.label.name}</div>
            <div style={s.row}>
              {g.etapaStories.map((story) => (
                <StoryCard key={story.id} story={story} onClick={() => openStory(story)} />
              ))}
              {g.seasonStory && <StoryCard story={g.seasonStory} onClick={() => openStory(g.seasonStory)} special />}
            </div>
          </div>
        ))}
      </div>

      {viewerSlides && (
        <StoryViewer
          slideUrls={viewerSlides.slideUrls}
          isSeasonStory={viewerSlides.isSeasonStory}
          onClose={() => setViewerSlides(null)}
          onComplete={() => {}}
          onOpenArchive={() => setViewerSlides(null)}
          onOpenLeaderboard={() => { setViewerSlides(null); onOpenLeaderboard?.(); }}
        />
      )}
    </div>
  );
}

function StoryCard({ story, onClick, special }) {
  const cover = story.slideCount > 0 ? slideUrl({ seasonNumber: story.seasonNumber, etapaNumber: story.etapaNumber, slideIndex: 1 }) : null;
  return (
    <button type="button" onClick={onClick} style={{ ...s.card, ...(special ? s.cardSpecial : null) }}>
      {cover && <img src={cover} alt="" loading="lazy" style={s.cardImg} />}
      <div style={s.cardOverlay} />
      <div style={s.cardLabel}>{story.title}</div>
      {special && <div style={s.cardCrown}>🏆</div>}
    </button>
  );
}

const s = {
  page: { minHeight: "100vh", background: color.bgBase },
  wrap: { maxWidth: 480, margin: "0 auto", padding: "0 16px 24px" },
  centerNote: { textAlign: "center", color: color.textFaint, fontSize: 13, padding: "50px 20px", fontFamily: font.body },
  seasonBlock: { marginTop: 18 },
  seasonTitle: { color: color.textPrimary, fontSize: 14, fontWeight: 700, marginBottom: 10, fontFamily: font.body },
  row: { display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 },
  card: {
    position: "relative", flexShrink: 0, width: 92, aspectRatio: "9/16", borderRadius: radius.md,
    border: `1.5px solid ${color.border}`, background: color.surfaceInset, overflow: "hidden", padding: 0, cursor: "pointer",
  },
  cardSpecial: { borderColor: color.gold, boxShadow: "0 0 14px -4px rgba(212,175,55,0.6)" },
  cardImg: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" },
  cardOverlay: { position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.75) 100%)" },
  cardLabel: { position: "absolute", left: 6, right: 6, bottom: 6, color: "#fff", fontSize: 9.5, fontWeight: 700, fontFamily: font.body, textAlign: "left" },
  cardCrown: { position: "absolute", top: 5, right: 5, fontSize: 12 },
};
