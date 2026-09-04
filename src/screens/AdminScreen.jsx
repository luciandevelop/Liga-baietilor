import { useEffect, useState } from "react";
import { doc, getDoc, collection, getDocs, query, where } from "firebase/firestore";
import { db, auth } from "../firebase";
import { listAllSpecialCompetitions, listSpecialPhases, openSpecialPhase, resolveSpecialPhase, listAllSpecialPicksForPhases } from "../services/specialsService";
import { PICK_TYPES, getPhaseDefinition } from "../specialDefinitions";
import { resolveTeamOptions } from "../teamRegistry";
import SpecialResolvePicker from "../components/SpecialResolvePicker";
import SpecialsCompletionOverview from "../components/SpecialsCompletionOverview";
import useNow from "../hooks/useNow";
import { getMatchStatus } from "../utils/matchStatus";
import {
  createSeason,
  listSeasons,
  createOrGetWeeklyGameweek,
  listGameweeks,
  bulkCreateMatches,
  listMatches,
  resetAllTestData,
  setFeaturedMatches,
  deleteMatch,
  saveMatchResult,
  updateMatchStatus,
  previewGameweekResults,
  publishLiveScores,
  finalizeGameweek,
  listAllMatches,
  runMatchHealthCheck,
  updateMatch,
  listAllUsers, getPlayerStatus,
  getPlayerCardStats,
  republishAllMatchPointsForGameweek,
} from "../services/adminService";
import { getUserPublicProfiles, updateOwnAvatar } from "../services/profilesService";
import { claimNickname } from "../services/authService";
import { getCurrentSeason, getCurrentGameweek } from "../services/predictionsService";
import { COMPETITION_THEMES } from "../competitionThemes";
import CompetitionLogo from "../components/CompetitionLogo";
import MatchCard from "../components/MatchCard";
import MatchResultCard from "../components/MatchResultCard";
import PlayerCard from "../components/PlayerCard";
import PageHeader from "../components/PageHeader";
import SectionCard from "../components/SectionCard";
import StatusBadge from "../components/StatusBadge";
import PlayerRankRow from "../components/PlayerRankRow";
import EmptyState from "../components/EmptyState";
import {
  listRecentEventsForAdmin, listAdminFunItems, addFunItem, deleteFunItem, deleteAllLiveMatchEvents,
  regenerateCurrentGameweekFeed,
} from "../services/feedService";
import { EDITORIAL_ARTICLES } from "../feedContent/editorialContent";
import LiveEventPanel from "../components/LiveEventPanel";
import {
  listAllUsersWithStatus, approveUser, rejectUser, deactivateUser, reactivateUser, getMissingPredictionsForMatch,
} from "../services/adminService";
import {
  MAIN_CATALOG, BONUS_CATALOG, getWeeklySurprise, getSecretMain, getSecretBonus,
  configureSurprise, revealMain, revealBonus, resolveMain, resolveBonus, getSurpriseStatus, revealRemainingMysteryBoxes,
  configureTriviaQuestions, markTriviaCorrectAnswer, getTriviaSubmissionStatus,
  configureZaruriQuestions, markZaruriTarget, getZaruriSubmissionStatus,
  getSabotajPublicProgress, revealSabotajNetwork, undoLastSabotajChoice,
} from "../services/surprisesService";
import { DUEL_THEMES } from "../assets/fighters";
import { color, font, layout, radius } from "../theme";

// Ordonare operațională pentru secțiunea de Rezultate: meciurile FĂRĂ
// rezultat introdus încă vin primele (sortate după kickoffAt), apoi cele
// care au deja rezultat salvat (tot sortate după kickoffAt). Nu inventăm
// un status "live" — nu există sursă live, doar kickoffAt + existența
// rezultatului.
// Prioritate obligatorie pentru tab-ul Rezultate: LIVE/Pauză primele
// (permanent), apoi programate (cronologic), apoi finalizate — jos. Bug
// real semnalat: un meci LIVE "se pierdea" mai jos în listă în timpul
// serii, cât Admin actualiza manual scorurile și avea nevoie să ajungă
// instant la el. ACEASTA e funcția chiar folosită la randare (linia
// resultsOrderedMatches = sortForResults(filteredMatches)) — nu una nouă,
// separată, care ar fi fost calculată degeaba.
const STATUS_PRIORITY = { live: 0, paused: 0, scheduled: 1, finished: 2, postponed: 1, cancelled: 2 };
function sortForResults(matches) {
  return [...matches].sort((a, b) => {
    const pa = STATUS_PRIORITY[getMatchStatus(a)] ?? 1;
    const pb = STATUS_PRIORITY[getMatchStatus(b)] ?? 1;
    if (pa !== pb) return pa - pb;
    return a.kickoffAt.toMillis() - b.kickoffAt.toMillis();
  });
}

function matchesSearch(m, term) {
  if (!term.trim()) return true;
  const t = term.trim().toLowerCase();
  return (m.homeTeam || "").toLowerCase().includes(t) || (m.awayTeam || "").toLowerCase().includes(t);
}

const TABS = [
  { id: "results", label: "Rezultate" },
  { id: "live", label: "Live" },
  { id: "featured", label: "Săptămânii" },
  { id: "speciale", label: "Speciale" },
  { id: "surprises", label: "🎭 Surprize" },
  { id: "feed", label: "Feed" },
  { id: "players", label: "👥 Jucători" },
  { id: "health", label: "Health Check" },
  { id: "config", label: "Config" },
];

// Starea vizuală instant a unei faze — 🟢/🟡/🔴/⚪/✅, exact ca în
// exemplul lui Lu. Pură, testabilă separat de UI.
function specialPhaseStatusInfo(state, now) {
  if (!state) return { dot: "⚪", text: "Neactivată" };
  if (state.status === "resolved") return { dot: "✅", text: "Rezolvată" };
  if (state.status === "closed") return { dot: "🔴", text: "Închisă — în așteptarea rezultatului" };
  // "open"
  const closesAtMs = state.closesAt?.toMillis ? state.closesAt.toMillis() : state.closesAt;
  const msLeft = closesAtMs ? closesAtMs - now : null;
  if (msLeft != null && msLeft <= 0) return { dot: "🔴", text: "Închisă — în așteptarea rezultatului" };
  if (msLeft != null && msLeft < 3 * 86400000) {
    const days = Math.max(1, Math.round(msLeft / 86400000));
    return { dot: "🟡", text: `Se închide peste ${days} ${days === 1 ? "zi" : "zile"}` };
  }
  return { dot: "🟢", text: "Deschisă" };
}

export default function AdminScreen({ onBack }) {
  const [tab, setTab] = useState("results");
  const [seasons, setSeasons] = useState([]);
  const [gameweeks, setGameweeks] = useState([]);
  const [matches, setMatches] = useState([]);
  const [missingPredictions, setMissingPredictions] = useState({}); // matchId -> [{uid,nickname}] | "loading" | undefined
  const [openMissingFor, setOpenMissingFor] = useState(null); // matchId deschis, sau null
  const [selectedSeasonId, setSelectedSeasonId] = useState("");
  const [selectedGameweekId, setSelectedGameweekId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Auto-detecție sezon activ + etapă curentă la intrarea în Admin — fără
  // click-uri manuale. Selectoarele rămân disponibile mai jos, pentru
  // etape vechi/viitoare sau administrare manuală.
  const [autoDetecting, setAutoDetecting] = useState(true);
  const [autoDetectedLabel, setAutoDetectedLabel] = useState("");
  const [showManualSelectors, setShowManualSelectors] = useState(false);

  const [seasonName, setSeasonName] = useState("");
  const [seasonStart, setSeasonStart] = useState("");
  const [seasonEnd, setSeasonEnd] = useState("");

  const [matchesText, setMatchesText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [featuredIds, setFeaturedIds] = useState([]);
  const [featuredSaving, setFeaturedSaving] = useState(false);
  const [featuredMessage, setFeaturedMessage] = useState("");

  // ── Avatar utilizator (config) ──
  const [allUsers, setAllUsers] = useState([]);
  // ── Speciale (config) ──
  const now = useNow(60000); // "se închide peste 3 zile" nu are nevoie de secunde live, doar Home/SpecialsScreen
  const [specialCompId, setSpecialCompId] = useState("");
  const [specialPhaseId, setSpecialPhaseId] = useState("");
  const [specialPhasesForSeason, setSpecialPhasesForSeason] = useState([]);
  const [completionPicksByPhase, setCompletionPicksByPhase] = useState({});
  const [completionLoading, setCompletionLoading] = useState(false);
  const [completionActiveUsers, setCompletionActiveUsers] = useState([]);
  const [optionsText, setOptionsText] = useState("");
  const [closesAtInput, setClosesAtInput] = useState("");
  const [openSaving, setOpenSaving] = useState(false);
  const [openMsg, setOpenMsg] = useState("");
  const [resolveSelection, setResolveSelection] = useState(null);
  const [resolveSaving, setResolveSaving] = useState(false);
  const [resolveMsg, setResolveMsg] = useState("");

  // ── Jucători (Admin) ──
  const [players, setPlayers] = useState([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [playerActionUid, setPlayerActionUid] = useState(""); // uid-ul cu acțiune în curs, pt. disable pe buton

  // ── Surprizele Săptămânii (Admin) ──
  const [surprisesData, setSurprisesData] = useState({}); // gameweekId -> { public, secretMain, secretBonus }
  const [surprisesLoading, setSurprisesLoading] = useState(false);
  const [surpriseActionKey, setSurpriseActionKey] = useState(""); // "{gwId}_{action}" cu acțiune în curs
  const [sabotajProgress, setSabotajProgress] = useState({}); // gameweekId -> { chosenPickers, takenTargets }

  // ── Trivia — editor întrebări, validare răspunsuri, status completare ──
  const [triviaEditorOpen, setTriviaEditorOpen] = useState(null); // gwId cu editorul deschis, sau null
  const [triviaDraft, setTriviaDraft] = useState([]); // 10 randuri, in curs de editare
  const [triviaSaveMsg, setTriviaSaveMsg] = useState("");
  const [triviaSaving, setTriviaSaving] = useState(false);
  const [triviaMarking, setTriviaMarking] = useState(""); // questionId in curs de marcat
  const [triviaSubmissionPanel, setTriviaSubmissionPanel] = useState(null); // gwId cu panoul deschis
  const [triviaSubmissionRows, setTriviaSubmissionRows] = useState([]);
  const [triviaSubmissionLoading, setTriviaSubmissionLoading] = useState(false);

  function openTriviaEditor(gwId, existingQuestions) {
    if (triviaEditorOpen === gwId) { setTriviaEditorOpen(null); return; }
    const base = existingQuestions && existingQuestions.length > 0
      ? existingQuestions
      : Array.from({ length: 10 }, (_, i) => ({ id: `q${i + 1}`, text: "", optionALabel: "DA", optionBLabel: "NU", correctAnswer: null }));
    setTriviaDraft(base);
    setTriviaEditorOpen(gwId);
    setTriviaSaveMsg("");
  }

  function updateTriviaDraftField(idx, field, value) {
    setTriviaDraft((prev) => prev.map((q, i) => (i === idx ? { ...q, [field]: value } : q)));
  }

  async function handleSaveTriviaQuestions(gwId) {
    setTriviaSaving(true);
    setTriviaSaveMsg("");
    try {
      const cleaned = triviaDraft.map((q) => ({ ...q, text: q.text.trim(), optionALabel: q.optionALabel.trim() || "A", optionBLabel: q.optionBLabel.trim() || "B" }));
      await configureTriviaQuestions(gwId, cleaned);
      setTriviaSaveMsg("✓ Întrebări salvate.");
      const sm = await getSecretMain(gwId);
      setSurprisesData((prev) => ({ ...prev, [gwId]: { ...prev[gwId], secretMain: sm } }));
    } catch (err) {
      setTriviaSaveMsg(`Eroare: ${err.message || err}`);
    } finally {
      setTriviaSaving(false);
    }
  }

  async function handleMarkCorrect(gwId, questionId, answer) {
    setTriviaMarking(questionId);
    try {
      await markTriviaCorrectAnswer(gwId, questionId, answer);
      const sm = await getSecretMain(gwId);
      setSurprisesData((prev) => ({ ...prev, [gwId]: { ...prev[gwId], secretMain: sm } }));
    } catch (err) {
      console.error("Eroare la marcarea răspunsului corect:", err);
    } finally {
      setTriviaMarking("");
    }
  }

  // ── Zaruri — editor întrebări, introducere țintă reală, status ──
  const [zaruriEditorOpen, setZaruriEditorOpen] = useState(null);
  const [zaruriDraft, setZaruriDraft] = useState([]);
  const [zaruriSaveMsg, setZaruriSaveMsg] = useState("");
  const [zaruriSaving, setZaruriSaving] = useState(false);
  const [zaruriMarking, setZaruriMarking] = useState("");
  const [zaruriTargetDrafts, setZaruriTargetDrafts] = useState({}); // questionId -> valoare text in curs de editare
  const [zaruriSubmissionPanel, setZaruriSubmissionPanel] = useState(null);
  const [zaruriSubmissionRows, setZaruriSubmissionRows] = useState([]);
  const [zaruriSubmissionLoading, setZaruriSubmissionLoading] = useState(false);

  function openZaruriEditor(gwId, existingQuestions) {
    if (zaruriEditorOpen === gwId) { setZaruriEditorOpen(null); return; }
    const base = existingQuestions && existingQuestions.length > 0
      ? existingQuestions
      : Array.from({ length: 5 }, (_, i) => ({ id: `zq${i + 1}`, text: "", correctTarget: null }));
    setZaruriDraft(base);
    setZaruriEditorOpen(gwId);
    setZaruriSaveMsg("");
  }

  function updateZaruriDraftField(idx, field, value) {
    setZaruriDraft((prev) => prev.map((q, i) => (i === idx ? { ...q, [field]: value } : q)));
  }

  async function handleSaveZaruriQuestions(gwId) {
    setZaruriSaving(true);
    setZaruriSaveMsg("");
    try {
      const cleaned = zaruriDraft.map((q) => ({ ...q, text: q.text.trim() }));
      await configureZaruriQuestions(gwId, cleaned);
      setZaruriSaveMsg("✓ Întrebări salvate.");
      const sm = await getSecretMain(gwId);
      setSurprisesData((prev) => ({ ...prev, [gwId]: { ...prev[gwId], secretMain: sm } }));
    } catch (err) {
      setZaruriSaveMsg(`Eroare: ${err.message || err}`);
    } finally {
      setZaruriSaving(false);
    }
  }

  async function handleMarkTarget(gwId, questionId) {
    const raw = zaruriTargetDrafts[questionId];
    const value = Number(raw);
    if (raw === undefined || raw === "" || Number.isNaN(value) || value < 0) return;
    setZaruriMarking(questionId);
    try {
      await markZaruriTarget(gwId, questionId, value);
      const sm = await getSecretMain(gwId);
      setSurprisesData((prev) => ({ ...prev, [gwId]: { ...prev[gwId], secretMain: sm } }));
    } catch (err) {
      console.error("Eroare la marcarea țintei:", err);
    } finally {
      setZaruriMarking("");
    }
  }

  async function openZaruriSubmissionPanel(gwId, questions) {
    if (zaruriSubmissionPanel === gwId) { setZaruriSubmissionPanel(null); return; }
    setZaruriSubmissionPanel(gwId);
    setZaruriSubmissionLoading(true);
    try {
      const rows = await getZaruriSubmissionStatus(gwId, questions.map((q) => q.id));
      const names = await getUserPublicProfiles(rows.map((r) => r.uid));
      setZaruriSubmissionRows(rows.map((r) => ({ ...r, nickname: names[r.uid]?.nickname || r.uid })));
    } catch (err) {
      console.error("Eroare la statusul de completare:", err);
    } finally {
      setZaruriSubmissionLoading(false);
    }
  }


  async function openTriviaSubmissionPanel(gwId, questions) {
    if (triviaSubmissionPanel === gwId) { setTriviaSubmissionPanel(null); return; }
    setTriviaSubmissionPanel(gwId);
    setTriviaSubmissionLoading(true);
    try {
      const rows = await getTriviaSubmissionStatus(gwId, questions.map((q) => q.id));
      const names = await getUserPublicProfiles(rows.map((r) => r.uid));
      setTriviaSubmissionRows(rows.map((r) => ({ ...r, nickname: names[r.uid]?.nickname || r.uid })));
    } catch (err) {
      console.error("Eroare la statusul de completare:", err);
    } finally {
      setTriviaSubmissionLoading(false);
    }
  }

  useEffect(() => {
    if (tab !== "surprises" || gameweeks.length === 0) return;
    setSurprisesLoading(true);
    Promise.all(gameweeks.map(async (gw) => {
      const [pub, sm, sb] = await Promise.all([getWeeklySurprise(gw.id), getSecretMain(gw.id), getSecretBonus(gw.id)]);
      return [gw.id, { public: pub, secretMain: sm, secretBonus: sb }];
    })).then(async (entries) => {
      setSurprisesData(Object.fromEntries(entries));
      // Progresul Sabotajului — doar pentru etapele unde tipul chiar e
      // Sabotaj și a fost deja dezvăluit (altfel `order` nici nu există).
      const sabotajEntries = entries.filter(([, d]) => d.secretMain?.type === "sabotaj" && d.public?.mainRevealed);
      const progressPairs = await Promise.all(sabotajEntries.map(async ([gwId, d]) => {
        const order = d.secretMain?.config?.order || [];
        const prog = await getSabotajPublicProgress(gwId, order);
        return [gwId, prog];
      }));
      setSabotajProgress(Object.fromEntries(progressPairs));
    }).finally(() => setSurprisesLoading(false));
  }, [tab, gameweeks]);

  async function handleConfigureSurprise(gameweekId, field, value) {
    const key = `${gameweekId}_config`;
    setSurpriseActionKey(key);
    try {
      await configureSurprise(gameweekId, { [field]: value });
      setSurprisesData((prev) => ({
        ...prev,
        [gameweekId]: {
          ...prev[gameweekId],
          secretMain: field === "mainType"
          ? { ...prev[gameweekId]?.secretMain, type: value }
          : field === "duelTheme"
          ? { ...prev[gameweekId]?.secretMain, duelTheme: value || null }
          : prev[gameweekId]?.secretMain,
          secretBonus: field === "bonusType" ? { ...prev[gameweekId]?.secretBonus, type: value } : prev[gameweekId]?.secretBonus,
        },
      }));
    } catch (err) {
      console.error("Eroare la configurare Surpriză:", err);
    } finally {
      setSurpriseActionKey("");
    }
  }

  async function handleSurpriseAction(gameweekId, action) {
    const key = `${gameweekId}_${action}`;
    setSurpriseActionKey(key);
    try {
      if (action === "revealMain") await revealMain(gameweekId);
      else if (action === "revealBonus") await revealBonus(gameweekId);
      else if (action === "resolveMain") await resolveMain(gameweekId);
      else if (action === "resolveBonus") await resolveBonus(gameweekId);
      else if (action === "revealSabotaj") await revealSabotajNetwork(gameweekId);
      else if (action === "undoSabotaj") await undoLastSabotajChoice(gameweekId);
      else if (action === "revealRemainingMystery") await revealRemainingMysteryBoxes(gameweekId);
      const [pub, sm, sb] = await Promise.all([getWeeklySurprise(gameweekId), getSecretMain(gameweekId), getSecretBonus(gameweekId)]);
      setSurprisesData((prev) => ({ ...prev, [gameweekId]: { public: pub, secretMain: sm, secretBonus: sb } }));
      if (sm?.type === "sabotaj") {
        const order = sm.config?.order || [];
        const prog = await getSabotajPublicProgress(gameweekId, order);
        setSabotajProgress((prev) => ({ ...prev, [gameweekId]: prog }));
      }
    } catch (err) {
      console.error(`Eroare la ${action}:`, err);
      alert(err.message || "Eroare — vezi consola.");
    } finally {
      setSurpriseActionKey("");
    }
  }

  useEffect(() => {
    if (tab !== "players") return;
    setPlayersLoading(true);
    listAllUsersWithStatus()
      .then(setPlayers)
      .catch((err) => console.error("Eroare la încărcarea jucătorilor:", err))
      .finally(() => setPlayersLoading(false));
  }, [tab]);

  async function handlePlayerAction(uid, action) {
    setPlayerActionUid(uid);
    try {
      if (action === "approve") await approveUser(uid);
      else if (action === "reject") await rejectUser(uid);
      else if (action === "deactivate") await deactivateUser(uid);
      else if (action === "reactivate") await reactivateUser(uid);
      setPlayers((prev) => prev.map((p) => (p.uid === uid
        ? { ...p, status: action === "approve" || action === "reactivate" ? "active" : "disabled" }
        : p)));
    } catch (err) {
      console.error("Eroare la acțiunea asupra jucătorului:", err);
    } finally {
      setPlayerActionUid("");
    }
  }

  // ── Feed (Admin) ──
  const [feedEvents, setFeedEvents] = useState([]);
  const [liveDataQuota, setLiveDataQuota] = useState(null);
  const [liveDataDiagnostics, setLiveDataDiagnostics] = useState({ mapped: 0, unmatched: 0, ambiguous: 0, live: 0, lastEventTitle: null });
  const [liveDataLoading, setLiveDataLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testConnectionResult, setTestConnectionResult] = useState("");
  const [feedAdminFun, setFeedAdminFun] = useState([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [newFunLabel, setNewFunLabel] = useState("");
  const [newFunText, setNewFunText] = useState("");
  const [funSaving, setFunSaving] = useState(false);
  const [cleaningLiveEvents, setCleaningLiveEvents] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState("");
  const [regeneratingFeed, setRegeneratingFeed] = useState(false);
  const [regenerateMessage, setRegenerateMessage] = useState("");

  async function handleCleanupLiveEvents() {
    setCleaningLiveEvents(true);
    setCleanupMessage("");
    try {
      const count = await deleteAllLiveMatchEvents();
      setCleanupMessage(count > 0 ? `Șterse ${count} evenimente vechi (goluri/cartonașe).` : "Nu erau evenimente vechi de șters.");
      setFeedEvents((prev) => prev.filter((e) => !e.id.startsWith("liveevent_")));
    } catch (err) {
      console.error("Eroare la curățarea evenimentelor live:", err);
      setCleanupMessage("Eroare — vezi consola.");
    } finally {
      setCleaningLiveEvents(false);
    }
  }

  // ── LIVE DATA — citește O DATĂ, când tab-ul se deschide (nu poll
  // agresiv din Admin; datele reale se actualizează server-side, aici
  // e doar diagnostic). ──
  useEffect(() => {
    if (tab !== "feed") return;
    setLiveDataLoading(true);
    (async () => {
      try {
        const quotaSnap = await getDoc(doc(db, "externalFootballCache", "_quota"));
        setLiveDataQuota(quotaSnap.exists() ? quotaSnap.data() : null);

        if (!selectedGameweekId) return;
        const matchesSnap = await getDocs(query(collection(db, "matches"), where("gameweekId", "==", selectedGameweekId)));
        const gwMatches = matchesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const mapped = gwMatches.filter((m) => m.externalFixtureId).length;

        const diagSnap = await getDocs(collection(db, "externalFootballCache"));
        let unmatched = 0, ambiguous = 0, live = 0, lastEventTitle = null, lastEventTs = 0;
        diagSnap.docs.forEach((d) => {
          const data = d.data();
          if (d.id.startsWith("_diagnostic_")) {
            if (data.status === "UNMATCHED") unmatched++;
            if (data.status === "AMBIGUOUS") ambiguous++;
          } else if (d.id !== "_quota") {
            if (["1H", "2H", "HT", "ET"].includes(data.status)) live++;
            if (data.lastDeltaEvents?.length > 0 && data.updatedAt > lastEventTs) {
              lastEventTs = data.updatedAt;
              lastEventTitle = `${data.homeTeam} ${data.homeScore}-${data.awayScore} ${data.awayTeam} (${data.status})`;
            }
          }
        });
        setLiveDataDiagnostics({ mapped, unmatched, ambiguous, live, lastEventTitle });
      } catch (err) {
        console.error("Eroare la încărcarea diagnosticului Live Data:", err);
      } finally {
        setLiveDataLoading(false);
      }
    })();
  }, [tab, selectedGameweekId]);

  async function handleTestFootballConnection() {
    setTestingConnection(true);
    setTestConnectionResult("");
    try {
      const idToken = await auth.currentUser.getIdToken();
      const resp = await fetch("/api/football-test", { headers: { Authorization: `Bearer ${idToken}` } });
      const data = await resp.json();
      if (!resp.ok) { setTestConnectionResult(`Eroare: ${data.error || resp.status}`); return; }
      setTestConnectionResult(
        `${data.reachable ? "✅ Conectat" : "❌ Neconectat"} · Cotă rămasă azi: ${data.quotaRemaining ?? "necunoscută"} · Răspuns valid: ${data.responseValid ? "da" : "nu"}`
      );
    } catch (err) {
      setTestConnectionResult("Eroare — vezi consola.");
      console.error("Eroare Test Connection:", err);
    } finally {
      setTestingConnection(false);
    }
  }


  // Reconstruiește meciuri Final + scor exact + facts + starea CURENTĂ
  // a clasamentului etapei. NU inventează istoricul pas-cu-pas al
  // clasamentului (cine era lider după fiecare meci în parte) — dacă nu
  // avem snapshot-uri reale pentru fiecare pas, acea parte rămâne
  // needeterminată, semnalat explicit în mesaj, nu ascuns. ──
  async function handleRegenerateFeed() {
    if (!selectedGameweekId) { setRegenerateMessage("Alege o etapă întâi."); return; }
    const confirmed = window.confirm("Regenerezi Feed-ul pentru etapa curentă? Nu se șterge nimic existent, doar se completează ce lipsește (idempotent).");
    if (!confirmed) return;
    setRegeneratingFeed(true);
    setRegenerateMessage("");
    try {
      const gwMatches = await listMatches(selectedGameweekId);
      const result = await regenerateCurrentGameweekFeed(selectedGameweekId, gwMatches);
      setRegenerateMessage(
        `Reconstruit: ${result.reconstructed.matchFinalEvents} evenimente de meci, ${result.reconstructed.currentRankEvents} evenimente de clasament (stare curentă). ${result.note}`
      );
    } catch (err) {
      console.error("Eroare la regenerarea Feed-ului:", err);
      setRegenerateMessage("Eroare — vezi consola.");
    } finally {
      setRegeneratingFeed(false);
    }
  }

  useEffect(() => {
    if (tab !== "feed") return;
    setFeedLoading(true);
    Promise.all([listRecentEventsForAdmin(), listAdminFunItems()])
      .then(([events, adminFun]) => {
        setFeedEvents(events);
        setFeedAdminFun(adminFun);
      })
      .catch((err) => console.error("Eroare la încărcarea Feed-ului (admin):", err))
      .finally(() => setFeedLoading(false));
  }, [tab]);

  async function handleAddFun() {
    if (!newFunLabel.trim() || !newFunText.trim()) return;
    setFunSaving(true);
    try {
      const id = await addFunItem({ label: newFunLabel.trim(), text: newFunText.trim() });
      setFeedAdminFun((prev) => [...prev, { id, label: newFunLabel.trim(), text: newFunText.trim() }]);
      setNewFunLabel("");
      setNewFunText("");
    } catch (err) {
      console.error("Eroare la adăugarea FUN:", err);
    } finally {
      setFunSaving(false);
    }
  }

  async function handleDeleteFun(id) {
    try {
      await deleteFunItem(id);
      setFeedAdminFun((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      console.error("Eroare la ștergerea FUN:", err);
    }
  }


  const [avatarUserUid, setAvatarUserUid] = useState("");
  const [avatarIdInput, setAvatarIdInput] = useState("");
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarSaveMsg, setAvatarSaveMsg] = useState("");

  // ── Nickname utilizator (config) — remediu pentru userii deja afectați
  // de bug-ul Google Sign-In (nickname = numele real din cont, sărind
  // peste ecranul de alegere). Odată salvat orice text valid, userul nu
  // mai e retrimis automat la picker — are nevoie de o corecție directă.
  const [nicknameUserUid, setNicknameUserUid] = useState("");
  const [nicknameInput, setNicknameInput] = useState("");
  const [nicknameSaving, setNicknameSaving] = useState(false);
  const [nicknameSaveMsg, setNicknameSaveMsg] = useState("");

  // ── Health Check — doar detectare, nimic automat ──
  const [healthIssues, setHealthIssues] = useState(null); // null = neîncă rulat
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState("");
  const [editingMatchId, setEditingMatchId] = useState("");
  const [editDraft, setEditDraft] = useState({ kickoffAtWallClock: "", competitionSlug: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [editMessage, setEditMessage] = useState("");

  const [deletingMatchId, setDeletingMatchId] = useState("");
  const [deleteMessage, setDeleteMessage] = useState("");

  const [previewRows, setPreviewRows] = useState(null);
  const [previewIncomplete, setPreviewIncomplete] = useState(0);
  const [previewProfiles, setPreviewProfiles] = useState({});
  const [previewLoading, setPreviewLoading] = useState(false);
  const [republishLoading, setRepublishLoading] = useState(false);
  const [republishMessage, setRepublishMessage] = useState("");

  async function handleRepublishMatchPoints() {
    if (!currentGameweek) return;
    setRepublishLoading(true);
    setRepublishMessage("");
    try {
      const count = await republishAllMatchPointsForGameweek(currentGameweek.id);
      setRepublishMessage(`✓ Republicat pentru ${count} meciuri Final.`);
    } catch (err) {
      console.error("Eroare la republicarea punctelor:", err);
      setRepublishMessage("Eroare — vezi consola.");
    } finally {
      setRepublishLoading(false);
    }
  }
  const [previewMessage, setPreviewMessage] = useState("");
  const [finalizing, setFinalizing] = useState(false);
  const [openPlayerUid, setOpenPlayerUid] = useState("");
  const [openPlayerStats, setOpenPlayerStats] = useState(null);
  const [openPlayerLoading, setOpenPlayerLoading] = useState(false);

  async function refreshSeasons() {
    const data = await listSeasons();
    setSeasons(data);
    return data;
  }

  async function refreshGameweeks(seasonId) {
    if (!seasonId) return setGameweeks([]);
    const data = await listGameweeks(seasonId);
    setGameweeks(data);
    return data;
  }

  async function refreshMatches(gameweekId) {
    if (!gameweekId) return setMatches([]);
    const data = await listMatches(gameweekId);
    setMatches(data);
    return data;
  }

  // La montare: încarcă sezoanele, apoi detectează automat sezonul ACTIV
  // (cel a cărui interval de date conține azi — via getCurrentSeason) și
  // etapa CURENTĂ a acelui sezon (via getCurrentGameweek), le selectează
  // direct, și încarcă meciurile. Nu alege pur și simplu "cel mai mare ID".
  useEffect(() => {
    (async () => {
      setAutoDetecting(true);
      try {
        const allSeasons = await refreshSeasons();
        const current = await getCurrentSeason();
        if (current) {
          setSelectedSeasonId(current.id);
          await refreshGameweeks(current.id);
          const currentGw = await getCurrentGameweek(current.id);
          if (currentGw) {
            setSelectedGameweekId(currentGw.id);
            setAutoDetectedLabel(`${current.name} · ${currentGw.title}`);
          } else {
            setAutoDetectedLabel(`${current.name} · fără etapă activă săptămâna asta`);
          }
        } else if (allSeasons.length > 0) {
          setAutoDetectedLabel("Niciun sezon activ azi — alege manual mai jos.");
          setShowManualSelectors(true);
        }
      } catch (err) {
        console.error("Eroare la auto-detecție sezon/etapă:", err);
      } finally {
        setAutoDetecting(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedSeasonId) return;
    refreshGameweeks(selectedSeasonId);
  }, [selectedSeasonId]);

  useEffect(() => {
    refreshMatches(selectedGameweekId);
    const gw = gameweeks.find((g) => g.id === selectedGameweekId);
    setFeaturedIds(gw?.featuredMatchIds || []);
    setFeaturedMessage("");
    setPreviewRows(null);
    setPreviewIncomplete(0);
    setPreviewMessage("");
    setOpenPlayerUid("");
  }, [selectedGameweekId, gameweeks]);

  function toggleFeatured(matchId) {
    setFeaturedIds((prev) => {
      if (prev.includes(matchId)) return prev.filter((id) => id !== matchId);
      if (prev.length >= 3) return prev; // deja 3 alese, ignorăm click-ul
      return [...prev, matchId];
    });
  }

  async function handleSaveFeatured() {
    setFeaturedSaving(true);
    setFeaturedMessage("");
    try {
      await setFeaturedMatches(selectedGameweekId, featuredIds);
      await refreshGameweeks(selectedSeasonId);
      setFeaturedMessage("✓ Meciurile Săptămânii salvate.");
      if (currentGameweek?.status !== "completed") {
        await recomputeAndPublish();
      }
    } catch (err) {
      console.error(err);
      setFeaturedMessage("Eroare: " + (err.message || err.code));
    } finally {
      setFeaturedSaving(false);
    }
  }

  async function handleCreateSeason(e) {
    e.preventDefault();
    if (!seasonName || !seasonStart || !seasonEnd) return;
    setLoading(true);
    setMessage("");
    try {
      const id = await createSeason({ name: seasonName, startDate: seasonStart, endDate: seasonEnd });
      setSeasonName("");
      setSeasonStart("");
      setSeasonEnd("");
      await refreshSeasons();
      setSelectedSeasonId(id);
      setMessage("Sezon creat.");
    } catch (err) {
      console.error(err);
      setMessage("Eroare la crearea sezonului: " + (err.message || err.code));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateNextGameweek() {
    if (!selectedSeasonId) return;
    setLoading(true);
    setMessage("");

    let result;
    try {
      result = await createOrGetWeeklyGameweek(selectedSeasonId);
    } catch (err) {
      console.error("Eroare la crearea/deschiderea etapei:", err);
      setMessage("Eroare la crearea etapei: " + (err.message || err.code));
      setLoading(false);
      return;
    }

    const { id, number, existed } = result;
    setSelectedGameweekId(id);
    setMessage(
      existed
        ? `Etapa acestei săptămâni există deja — Etapa ${number}, deschisă.`
        : `Etapa ${number} creată pentru săptămâna curentă.`
    );

    try {
      await refreshGameweeks(selectedSeasonId);
    } catch (err) {
      console.error("Eroare la reîncărcarea listei de etape:", err);
      setMessage(
        (prev) => `${prev} (Atenție: lista de etape nu s-a putut reîncărca — ${err.message || err.code})`
      );
    }

    setLoading(false);
  }

  async function handleDeleteMatch(match) {
    const confirmed = window.confirm(
      `Ștergi meciul "${match.homeTeam} - ${match.awayTeam}"?\n\nSe șterg și predicțiile/Jokerii asociați. Ireversibil.`
    );
    if (!confirmed) return;

    setDeletingMatchId(match.id);
    setDeleteMessage("");
    try {
      await deleteMatch(match.id, selectedGameweekId);
      await refreshMatches(selectedGameweekId);
      setDeleteMessage(`✓ Meciul "${match.homeTeam} - ${match.awayTeam}" a fost șters.`);
      // Republică live scores — publishLiveScores rescrie complet (nu
      // adaugă) breakdown-ul fiecărui user din matches curente, deci
      // meciul șters nu mai poate rămâne orfan în gameweekLiveScores.
      if (currentGameweek?.status !== "completed") {
        await recomputeAndPublish();
      }
    } catch (err) {
      console.error(err);
      setDeleteMessage("Eroare la ștergere: " + (err.message || err.code));
    } finally {
      setDeletingMatchId("");
    }
  }

  async function handleSaveResult(matchId, values) {
    await saveMatchResult(matchId, values);
    await refreshMatches(selectedGameweekId);
    // Recalculează + republică automat clasamentul live — Lu nu mai trebuie
    // să apese separat "Calculează Preview" după fiecare rezultat.
    if (currentGameweek?.status !== "completed") {
      await recomputeAndPublish();
    }
  }

  async function toggleMissingPredictions(matchId) {
    if (openMissingFor === matchId) { setOpenMissingFor(null); return; }
    setOpenMissingFor(matchId);
    if (missingPredictions[matchId] === undefined) {
      setMissingPredictions((prev) => ({ ...prev, [matchId]: "loading" }));
      try {
        const list = await getMissingPredictionsForMatch(matchId);
        setMissingPredictions((prev) => ({ ...prev, [matchId]: list }));
      } catch (err) {
        console.error("Eroare la citirea pronosticurilor lipsă:", err);
        setMissingPredictions((prev) => ({ ...prev, [matchId]: "error" }));
      }
    }
  }

  async function handleChangeStatus(matchId, newStatus) {
    await updateMatchStatus(matchId, newStatus);
    await refreshMatches(selectedGameweekId);
    // ROOT CAUSE 2 din auditul Feed — reparat aici: schimbarea de status
    // (spre deosebire de salvarea scorului) NU republica niciodată
    // gameweekLiveScores. Un meci devine cu adevărat "final" (matchPoints
    // se publică) abia AICI, la schimbarea de status — dar clasamentul
    // live rămânea înghețat la starea de dinainte, deci Feed-ul nu mai
    // detecta NICIODATĂ schimbările de poziție reale, cauzate de acest
    // meci. Acum republicăm, exact ca la salvarea scorului.
    if (currentGameweek?.status !== "completed") {
      await recomputeAndPublish();
    }
  }

  async function recomputeAndPublish() {
    setPreviewLoading(true);
    setPreviewMessage("");
    try {
      const result = await previewGameweekResults(selectedGameweekId);
      setPreviewRows(result.rows);
      setPreviewIncomplete(result.incompleteMatchIds.length);
      const names = await getUserPublicProfiles(result.rows.map((r) => r.uid));
      setPreviewProfiles(names);

      if (result.rows.length > 0 && currentGameweek?.status !== "completed") {
        await publishLiveScores(selectedGameweekId);
      }

      if (result.incompleteMatchIds.length > 0) {
        setPreviewMessage(
          `⚠️ ${result.incompleteMatchIds.length}/${result.totalMatches} meciuri nu au rezultat complet — finalizarea va fi refuzată până le completezi pe toate.`
        );
      } else if (result.rows.length === 0) {
        setPreviewMessage("Niciun user în sistem — nimic de calculat.");
      }
    } catch (err) {
      console.error(err);
      setPreviewMessage("Eroare la calcul: " + (err.message || err.code));
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handlePreview() {
    await recomputeAndPublish();
  }

  async function handleFinalize() {
    const confirmed = window.confirm(
      "Finalizezi etapa? seasonPoints și gameweeksPlayed se actualizează pentru toți userii din clasament. Ireversibil (etapa devine 'completed')."
    );
    if (!confirmed) return;

    setFinalizing(true);
    setPreviewMessage("");
    try {
      const outcome = await finalizeGameweek(selectedGameweekId);
      if (outcome.alreadyCompleted) {
        setPreviewMessage("Etapa era deja finalizată — nu s-a modificat nimic (protecție anti-dublare).");
      } else {
        setPreviewMessage("✓ Etapa finalizată. Clasamentul general a fost actualizat.");
      }
      setPreviewRows(outcome.rows);
      await refreshGameweeks(selectedSeasonId);
    } catch (err) {
      console.error(err);
      setPreviewMessage("Eroare la finalizare: " + (err.message || err.code));
    } finally {
      setFinalizing(false);
    }
  }

  async function handleRunHealthCheck() {
    setHealthLoading(true);
    setHealthError("");
    setEditMessage("");
    try {
      const all = await listAllMatches();
      setHealthIssues(runMatchHealthCheck(all));
    } catch (err) {
      console.error(err);
      setHealthError(err.message || err.code);
    } finally {
      setHealthLoading(false);
    }
  }

  function startEditingMatch(m) {
    const d = m.kickoffAt?.toDate ? m.kickoffAt.toDate() : null;
    const wallClock = d
      ? new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Bucharest", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
          .format(d)
          .replace(",", "")
      : "";
    // căutăm slug-ul curent după numele deja salvat, ca select-ul să
    // pornească pe opțiunea corectă dacă meciul are deja o competiție
    const currentSlug = Object.entries(COMPETITION_THEMES).find(([, t]) => t.name === m.competitionName)?.[0] || "";
    setEditingMatchId(m.id);
    setEditDraft({ kickoffAtWallClock: wallClock, competitionSlug: currentSlug });
    setEditMessage("");
  }

  async function handleSaveMatchEdit(matchId) {
    setEditSaving(true);
    setEditMessage("");
    try {
      const preset = editDraft.competitionSlug ? COMPETITION_THEMES[editDraft.competitionSlug] : null;
      await updateMatch(matchId, {
        kickoffAtWallClock: editDraft.kickoffAtWallClock || undefined,
        // slug ales direct dintr-o listă — fără nicio ghicire de nume
        competitionName: editDraft.competitionSlug ? preset?.name ?? undefined : undefined,
        competitionId: editDraft.competitionSlug ? editDraft.competitionSlug : undefined,
        competitionColor: editDraft.competitionSlug ? preset?.primaryColor ?? undefined : undefined,
      });
      setEditingMatchId("");
      setEditMessage("Corectat.");
      await handleRunHealthCheck();
    } catch (err) {
      console.error(err);
      setEditMessage("Eroare: " + err.message);
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDeleteFromHealthCheck(m) {
    if (!window.confirm(`Ștergi definitiv meciul ${m.homeTeam} - ${m.awayTeam}?`)) return;
    try {
      await deleteMatch(m.id, m.gameweekId);
      await handleRunHealthCheck();
    } catch (err) {
      console.error(err);
      setEditMessage("Eroare la ștergere: " + err.message);
    }
  }

  useEffect(() => {
    if (tab !== "config") return;
    listAllUsers()
      .then(setAllUsers)
      .catch((err) => console.error("Eroare la încărcarea listei de utilizatori:", err));
  }, [tab]);

  // Aceeași sursă ca în Clasament — un singur card, indiferent de unde
  // e deschis (Live preview din Admin, sau oricare din cele 3 taburi).
  async function handleOpenPreviewPlayer(uid, rank) {
    setOpenPlayerUid(uid);
    setOpenPlayerStats(null);
    setOpenPlayerLoading(true);
    try {
      const stats = await getPlayerCardStats(uid, selectedSeasonId, selectedGameweekId);
      setOpenPlayerStats({ ...stats, rank });
    } catch (err) {
      console.error("Eroare la încărcarea cardului:", err);
    } finally {
      setOpenPlayerLoading(false);
    }
  }

  // ── Speciale ──
  useEffect(() => {
    if (tab !== "speciale" || !selectedSeasonId) return;
    listSpecialPhases(selectedSeasonId)
      .then(setSpecialPhasesForSeason)
      .catch((err) => console.error("Eroare la încărcarea fazelor speciale:", err));
    listAllUsers()
      .then((users) => setCompletionActiveUsers(users.filter((u) => getPlayerStatus(u) === "active")))
      .catch((err) => console.error("Eroare la lista de useri activi (overview Speciale):", err));
  }, [tab, selectedSeasonId, openMsg, resolveMsg]);

  // ── Overview agregat: cine a completat Specialele — peste TOATE
  // fazele deschise deja (nu cele blocate), recalculat ori de câte ori
  // se schimbă lista de faze sau se deschide/rezolvă ceva. ──
  useEffect(() => {
    if (tab !== "speciale" || specialPhasesForSeason.length === 0) { setCompletionPicksByPhase({}); return; }
    setCompletionLoading(true);
    const phaseIds = specialPhasesForSeason.map((p) => p.phaseId);
    listAllSpecialPicksForPhases(phaseIds)
      .then(setCompletionPicksByPhase)
      .catch((err) => console.error("Eroare la overview-ul de completare Speciale:", err))
      .finally(() => setCompletionLoading(false));
  }, [tab, specialPhasesForSeason]);

  const specialCompetitions = listAllSpecialCompetitions();
  const specialComp = specialCompetitions.find((c) => c.id === specialCompId) || null;
  const specialPhaseDef = specialComp?.phases.find((p) => p.id === specialPhaseId) || null;
  const specialPhaseState = specialPhasesForSeason.find((p) => p.phaseId === specialPhaseId) || null;
  const availableSpecialPhases = specialPhasesForSeason.map((p) => ({ id: p.phaseId, label: getPhaseDefinition(p.phaseId)?.phase?.label || p.phaseId }));

  function slugifyOption(label) {
    return label.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  async function handleOpenSpecialPhase() {
    if (!specialPhaseDef || !selectedSeasonId) return;
    const labels = optionsText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (labels.length === 0) { setOpenMsg("Introdu cel puțin o opțiune."); return; }
    if (!closesAtInput) { setOpenMsg("Setează data de închidere."); return; }
    const options = labels.map((label) => ({ id: slugifyOption(label), label }));
    setOpenSaving(true);
    setOpenMsg("");
    try {
      await openSpecialPhase({
        seasonId: selectedSeasonId,
        phaseId: specialPhaseDef.id,
        competitionId: specialComp.id,
        closesAt: new Date(closesAtInput),
        options,
      });
      setOpenMsg("Fază deschisă.");
      setOptionsText("");
      setClosesAtInput("");
    } catch (err) {
      console.error(err);
      setOpenMsg("Eroare: " + err.message);
    } finally {
      setOpenSaving(false);
    }
  }

  async function handleResolveSpecialPhase() {
    if (!specialPhaseDef || !specialPhaseState) return;
    const isComplete = specialPhaseDef.type === PICK_TYPES.SINGLE
      ? Boolean(resolveSelection)
      : Array.isArray(resolveSelection) && resolveSelection.length === (specialPhaseDef.type === PICK_TYPES.RANKED ? specialPhaseDef.rankedSize : specialPhaseDef.groupSize);
    if (!isComplete) { setResolveMsg("Completează rezultatul întâi."); return; }
    setResolveSaving(true);
    setResolveMsg("");
    try {
      const result = await resolveSpecialPhase(specialPhaseDef.id, resolveSelection);
      setResolveMsg(result.alreadyResolved ? "Era deja rezolvată." : `Rezolvat — ${result.scoredUsers} useri scorați.`);
      setResolveSelection(null);
    } catch (err) {
      console.error(err);
      setResolveMsg("Eroare: " + err.message);
    } finally {
      setResolveSaving(false);
    }
  }

  async function handleSetUserAvatar() {
    setAvatarSaving(true);
    setAvatarSaveMsg("");
    try {
      await updateOwnAvatar(avatarUserUid, avatarIdInput.trim());
      setAvatarSaveMsg("Salvat.");
      setAllUsers((prev) => prev.map((u) => (u.uid === avatarUserUid ? { ...u, avatarId: avatarIdInput.trim() } : u)));
      setAvatarUserUid("");
      setAvatarIdInput("");
    } catch (err) {
      console.error(err);
      setAvatarSaveMsg("Eroare: " + err.message);
    } finally {
      setAvatarSaving(false);
    }
  }

  // Refolosește claimNickname (aceeași validare + verificare de
  // disponibilitate ca la userul care-și alege singur nickname-ul) — doar
  // că aici e admin-ul care o declanșează, pentru cineva blocat cu numele
  // real din Google, fără nicio cale să se corecteze singur.
  async function handleSetUserNickname() {
    setNicknameSaving(true);
    setNicknameSaveMsg("");
    try {
      await claimNickname(nicknameUserUid, nicknameInput.trim());
      setNicknameSaveMsg("Salvat.");
      setAllUsers((prev) => prev.map((u) => (u.uid === nicknameUserUid ? { ...u, nickname: nicknameInput.trim() } : u)));
      setNicknameUserUid("");
      setNicknameInput("");
    } catch (err) {
      console.error(err);
      setNicknameSaveMsg("Eroare: " + err.message);
    } finally {
      setNicknameSaving(false);
    }
  }

  async function handleImportMatches(e) {
    e.preventDefault();
    if (!selectedGameweekId || !matchesText.trim()) return;
    setLoading(true);
    setMessage("");
    try {
      const { created, warnings } = await bulkCreateMatches(selectedGameweekId, matchesText);
      setMatchesText("");
      await refreshMatches(selectedGameweekId);
      const warnText = warnings.length ? ` ⚠️ ${warnings.length} avertismente:\n${warnings.join("\n")}` : "";
      setMessage(`${created} meciuri importate.${warnText}`);
    } catch (err) {
      console.error(err);
      setMessage("Eroare la import: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleReset() {
    const typed = window.prompt(
      'ATENȚIE — instrument doar de TEST. Șterge TOATE sezoanele, etapele, meciurile, predicțiile, jokerii, Feed-ul, toate Surprizele (Mystery Box/Duel/Sabotaj/Ruletă/Trivia/Zaruri/Penalty) ȘI RESETEAZĂ CLASAMENTUL (punctele fiecărui cont la 0) — ireversibil. Conturile userilor (nickname/avatar/status) și Specialele (Câștigătoare CL/Golgheter/etc.) NU se șterg.\n\nScrie exact "RESET" ca să confirmi:'
    );
    if (typed !== "RESET") {
      if (typed !== null) setMessage('Resetare anulată — trebuia scris exact "RESET".');
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const count = await resetAllTestData();
      setSeasons([]);
      setGameweeks([]);
      setMatches([]);
      setSelectedSeasonId("");
      setSelectedGameweekId("");
      setMessage(`Resetat — ${count} documente șterse.`);
    } catch (err) {
      console.error(err);
      setMessage("Eroare la resetare: " + (err.message || err.code));
    } finally {
      setLoading(false);
    }
  }

  const currentGameweek = gameweeks.find((g) => g.id === selectedGameweekId);
  const filteredMatches = matches.filter((m) => matchesSearch(m, searchTerm));
  const resultsOrderedMatches = sortForResults(filteredMatches);

  return (
    <div style={layout.page}>
      <div style={layout.wrap}>
        <PageHeader
          eyebrow="Panou Admin"
          title={currentGameweek ? currentGameweek.title : "Fără etapă selectată"}
          subtitle={autoDetecting ? "Se detectează…" : autoDetectedLabel}
          onBack={onBack}
          right={
            <button style={s.resetBtn} onClick={handleReset} disabled={loading} type="button">⚠️ Reset</button>
          }
        />

        {message && <div style={s.message}>{message}</div>}

        <button style={s.linkBtn} onClick={() => setShowManualSelectors((v) => !v)} type="button">
          {showManualSelectors ? "Ascunde selecția manuală" : "Schimbă sezon / etapă manual"}
        </button>

        {showManualSelectors && (
          <SectionCard style={{ marginTop: 8 }}>
            <select style={s.select} value={selectedSeasonId} onChange={(e) => setSelectedSeasonId(e.target.value)}>
              <option value="">— alege un sezon —</option>
              {seasons.map((s2) => (
                <option key={s2.id} value={s2.id}>{s2.name}</option>
              ))}
            </select>

            {selectedSeasonId && (
              <select style={s.select} value={selectedGameweekId} onChange={(e) => setSelectedGameweekId(e.target.value)}>
                <option value="">— alege o etapă —</option>
                {gameweeks.map((g) => (
                  <option key={g.id} value={g.id}>{g.title} · {g.status}</option>
                ))}
              </select>
            )}

            {selectedSeasonId && (
              <button style={s.btn} disabled={loading} onClick={handleCreateNextGameweek} type="button">
                Creează / deschide etapa săptămânii
              </button>
            )}

            <form onSubmit={handleCreateSeason} style={{ ...s.form, marginTop: 14 }}>
              <p style={s.hint}>+ Sezon nou</p>
              <input style={s.input} placeholder="Nume sezon (ex: Sezon 2026/27)" value={seasonName} onChange={(e) => setSeasonName(e.target.value)} />
              <div style={s.row}>
                <input style={s.input} type="date" value={seasonStart} onChange={(e) => setSeasonStart(e.target.value)} />
                <input style={s.input} type="date" value={seasonEnd} onChange={(e) => setSeasonEnd(e.target.value)} />
              </div>
              <button style={s.btn} disabled={loading} type="submit">+ Sezon nou</button>
            </form>
          </SectionCard>
        )}

        {selectedGameweekId && (
          <>
            <div style={s.tabRow}>
              {TABS.map((t) => (
                <button
                  key={t.id}
                  style={{ ...s.tabBtn, ...(tab === t.id ? s.tabBtnActive : {}) }}
                  onClick={() => setTab(t.id)}
                  type="button"
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "results" && (
              <div style={s.republishBox}>
                <button type="button" style={s.republishBtn} disabled={republishLoading || !currentGameweek} onClick={handleRepublishMatchPoints}>
                  {republishLoading ? "Se republică…" : "🔄 Republică punctele pentru toate meciurile Final"}
                </button>
                <div style={s.republishHint}>
                  Apasă O SINGURĂ DATĂ, dacă meciuri deja Final nu apar în Clasament pentru useri obișnuiți. Necesar doar pentru meciuri finalizate ÎNAINTE de acest sistem.
                </div>
                {republishMessage && <div style={s.republishMsg}>{republishMessage}</div>}
              </div>
            )}

            {(tab === "results" || tab === "featured") && matches.length > 0 && (
              <input
                style={s.searchInput}
                placeholder="Caută echipa…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            )}

            {/* ── Rezultate ─────────────────────────────────────────── */}
            {tab === "results" && (
              matches.length === 0 ? (
                <EmptyState icon="📋" title="Etapa nu are încă meciuri." subtitle="Adaugă-le din tab-ul Import / Config." />
              ) : (
                <div style={s.matchList}>
                  {resultsOrderedMatches.map((m) => (
                    <div key={m.id}>
                      <MatchResultCard
                        match={m}
                        onSave={(values) => handleSaveResult(m.id, values)}
                        onChangeStatus={(newStatus) => handleChangeStatus(m.id, newStatus)}
                        disabled={currentGameweek?.status === "completed"}
                      />
                      {m.status === "live" && <LiveEventPanel match={m} />}
                      <button type="button" style={s.missingPredBtn} onClick={() => toggleMissingPredictions(m.id)}>
                        {openMissingFor === m.id ? "▲ Ascunde" : "👀 Cine n-a pontat"}
                      </button>
                      {openMissingFor === m.id && (
                        <div style={s.missingPredPanel}>
                          {missingPredictions[m.id] === "loading" && <span style={s.hint}>Se încarcă…</span>}
                          {missingPredictions[m.id] === "error" && <span style={s.hint}>Eroare — încearcă din nou.</span>}
                          {Array.isArray(missingPredictions[m.id]) && (
                            missingPredictions[m.id].length === 0
                              ? <span style={s.missingPredAllDone}>✓ Toată lumea a pontat.</span>
                              : (
                                <>
                                  <span style={s.hint}>{missingPredictions[m.id].length} nu au pontat încă:</span>
                                  <div style={s.missingPredChips}>
                                    {missingPredictions[m.id].map((u) => (
                                      <span key={u.uid} style={s.missingPredChip}>{u.nickname}</span>
                                    ))}
                                  </div>
                                </>
                              )
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {resultsOrderedMatches.length === 0 && (
                    <EmptyState icon="🔍" title="Niciun meci nu corespunde căutării." />
                  )}
                </div>
              )
            )}

            {/* ── Clasament live ────────────────────────────────────── */}
            {tab === "live" && (
              <SectionCard>
                {currentGameweek?.status === "completed" ? (
                  <StatusBadge tone="gold">FINAL — etapă finalizată</StatusBadge>
                ) : previewRows ? (
                  <StatusBadge tone="live" dot>LIVE · provizoriu</StatusBadge>
                ) : null}

                <button style={{ ...s.btn, marginTop: 12 }} disabled={previewLoading} onClick={handlePreview} type="button">
                  {previewLoading ? "Se calculează…" : "Calculează / Previzualizează clasamentul"}
                </button>

                {previewMessage && <div style={s.message}>{previewMessage}</div>}

                {previewRows && previewRows.length > 0 && (
                  <div style={s.previewTable}>
                    {previewRows.map((r) => (
                      <PlayerRankRow
                        key={r.uid}
                        rank={r.rank}
                        nickname={previewProfiles[r.uid]?.nickname || r.uid}
                        avatarId={previewProfiles[r.uid]?.avatarId}
                        pointsFromMatches={r.pointsFromMatches}
                        rankingBonus={r.rankingBonus}
                        totalPoints={r.totalPoints}
                        top3={r.rank <= 3}
                        onClick={() => handleOpenPreviewPlayer(r.uid, r.rank)}
                      />
                    ))}
                  </div>
                )}

                {previewRows && currentGameweek?.status !== "completed" && (
                  <button style={s.finalizeBtn} disabled={finalizing || previewIncomplete > 0} onClick={handleFinalize} type="button">
                    {finalizing ? "Se finalizează…" : "Finalizează etapa"}
                  </button>
                )}
              </SectionCard>
            )}

            {/* ── Meciurile Săptămânii ──────────────────────────────── */}
            {tab === "featured" && (
              <>
                {deleteMessage && <div style={s.message}>{deleteMessage}</div>}

                {filteredMatches.length > 0 ? (
                  <div style={s.matchList}>
                    {filteredMatches.map((m) => (
                      <div key={m.id} style={s.matchRowWithDelete}>
                        <label style={s.featuredRow}>
                          <input
                            type="checkbox"
                            checked={featuredIds.includes(m.id)}
                            onChange={() => toggleFeatured(m.id)}
                            disabled={!featuredIds.includes(m.id) && featuredIds.length >= 3}
                            style={s.featuredCheckbox}
                          />
                          <div style={{ flex: 1 }}>
                            <MatchCard
                              homeTeam={m.homeTeam}
                              awayTeam={m.awayTeam}
                              kickoffAt={m.kickoffAt}
                              status={m.status}
                              competitionId={m.competitionId}
                              competitionName={m.competitionName}
                              competitionColor={m.competitionColor}
                            />
                          </div>
                        </label>
                        <button
                          type="button"
                          style={s.deleteBtn}
                          disabled={deletingMatchId === m.id}
                          onClick={() => handleDeleteMatch(m)}
                          title="Șterge meciul"
                        >
                          {deletingMatchId === m.id ? "…" : "🗑"}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState icon="⭐" title="Niciun meci nu corespunde căutării." />
                )}

                {matches.length > 0 && (
                  <SectionCard style={{ marginTop: 4 }}>
                    <p style={s.hint}>⭐ Meciurile Săptămânii: {featuredIds.length}/3 alese</p>
                    {featuredMessage && <div style={s.message}>{featuredMessage}</div>}
                    <button style={s.btn} disabled={featuredSaving || featuredIds.length !== 3} onClick={handleSaveFeatured} type="button">
                      {featuredSaving ? "Se salvează…" : "Salvează Meciurile Săptămânii"}
                    </button>
                  </SectionCard>
                )}
              </>
            )}

            {/* ── Speciale — deschide/rezolvă fazele Specialelor Sezonului ── */}
            {tab === "speciale" && (
              <SectionCard title="Specialele Sezonului">
                <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#fff", marginBottom: 4 }}>Cine a completat Specialele</div>
                  <SpecialsCompletionOverview
                    availablePhases={availableSpecialPhases}
                    allUsers={completionActiveUsers}
                    picksByPhase={completionPicksByPhase}
                    loading={completionLoading}
                  />
                </div>

                <select style={s.select} value={specialCompId} onChange={(e) => { setSpecialCompId(e.target.value); setSpecialPhaseId(""); }}>
                  <option value="">Alege competiția…</option>
                  {specialCompetitions.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                {/* ── Stare instant, toate fazele deodată — fără să intri
                    în fiecare una ca să vezi unde ești ── */}
                {specialComp && (
                  <div style={s.specialsOverview}>
                    {specialComp.phases.map((p) => {
                      const state = specialPhasesForSeason.find((s2) => s2.phaseId === p.id);
                      const info = specialPhaseStatusInfo(state, now);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          style={{ ...s.specialsOverviewRow, ...(specialPhaseId === p.id ? s.specialsOverviewRowActive : {}) }}
                          onClick={() => setSpecialPhaseId(p.id)}
                        >
                          <span>{info.dot}</span>
                          <span style={s.specialsOverviewLabel}>{p.label}</span>
                          <span style={s.specialsOverviewStatus}>{info.text}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {specialComp && (
                  <select style={s.select} value={specialPhaseId} onChange={(e) => setSpecialPhaseId(e.target.value)}>
                    <option value="">Alege faza…</option>
                    {specialComp.phases.map((p) => {
                      const state = specialPhasesForSeason.find((s2) => s2.phaseId === p.id);
                      return (
                        <option key={p.id} value={p.id}>
                          {p.label} {state ? `(${state.status})` : "(neîschisă)"}
                        </option>
                      );
                    })}
                  </select>
                )}

                {specialPhaseDef && !specialPhaseState && (
                  <>
                    <p style={s.hint}>
                      Deschide „{specialPhaseDef.label}" — o linie = o opțiune. Userii aleg STRICT din listă,
                      nu scriu liber (elimină potriviri greșite la scorare). Poți deschide orice fază, oricând —
                      nicio ordine impusă.
                      {specialPhaseDef.requiresPhase && (
                        <> (De obicei are sens după „{specialComp.phases.find((p) => p.id === specialPhaseDef.requiresPhase)?.label}", dar poți deschide și mai devreme.)</>
                      )}
                    </p>
                    {(() => {
                      const realOptions = resolveTeamOptions(specialComp.id, specialPhaseDef.id);
                      if (!realOptions) return null;
                      return (
                        <button
                          type="button" style={s.smallBtn}
                          onClick={() => setOptionsText(realOptions.map((o) => o.label).join("\n"))}
                        >
                          📋 Pre-completează cu lista reală ({realOptions.length})
                        </button>
                      );
                    })()}
                    <textarea
                      style={s.textarea}
                      rows={5}
                      placeholder={"PSG\nReal Madrid\nBayern\n..."}
                      value={optionsText}
                      onChange={(e) => setOptionsText(e.target.value)}
                    />
                    <input
                      style={s.input}
                      type="datetime-local"
                      value={closesAtInput}
                      onChange={(e) => setClosesAtInput(e.target.value)}
                    />
                    <button style={s.btn} disabled={openSaving} onClick={handleOpenSpecialPhase} type="button">
                      {openSaving ? "Se deschide…" : "Deschide faza"}
                    </button>
                    {openMsg && <p style={s.hint}>{openMsg}</p>}
                  </>
                )}

                {specialPhaseDef && specialPhaseState && specialPhaseState.status !== "resolved" && (
                  <>
                    <p style={s.hint}>
                      Stare: <b>{specialPhaseState.status}</b> · {specialPhaseState.options?.length || 0} opțiuni.
                      Introdu rezultatul real ca să rezolvi faza — punctele se adaugă automat în Clasamentul General.
                    </p>
                    <SpecialResolvePicker
                      phaseDef={specialPhaseDef}
                      options={specialPhaseState.options || []}
                      selection={resolveSelection}
                      onChange={setResolveSelection}
                    />
                    <button style={{ ...s.btn, marginTop: 10 }} disabled={resolveSaving} onClick={handleResolveSpecialPhase} type="button">
                      {resolveSaving ? "Se rezolvă…" : "Rezolvă faza"}
                    </button>
                    {resolveMsg && <p style={s.hint}>{resolveMsg}</p>}
                  </>
                )}

                {specialPhaseDef && specialPhaseState?.status === "resolved" && (
                  <p style={s.hint}>Fază deja rezolvată — punctele au fost adăugate în Clasamentul General.</p>
                )}
              </SectionCard>
            )}

            {/* ── Jucători — aprobare conturi noi, dezactivare/reactivare ── */}
            {tab === "players" && (
              <>
                {(() => {
                  const pending = players.filter((p) => p.status === "pending");
                  const active = players.filter((p) => p.status === "active");
                  const disabled = players.filter((p) => p.status === "disabled");
                  return (
                    <>
                      {pending.length > 0 && (
                        <SectionCard title={`Cereri noi (${pending.length})`}>
                          <div style={s.feedAdminList}>
                            {pending.map((p) => (
                              <div key={p.uid} style={s.playerRow}>
                                <div style={s.playerInfo}>
                                  <div style={s.feedAdminTitle}>{p.nickname || "(fără nickname încă)"}</div>
                                  <div style={s.feedAdminMeta}>{p.email || p.uid}</div>
                                </div>
                                <div style={s.playerActions}>
                                  <button type="button" style={s.approveBtn} disabled={playerActionUid === p.uid} onClick={() => handlePlayerAction(p.uid, "approve")}>
                                    Aprobă
                                  </button>
                                  <button type="button" style={s.rejectBtn} disabled={playerActionUid === p.uid} onClick={() => handlePlayerAction(p.uid, "reject")}>
                                    Respinge
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </SectionCard>
                      )}

                      <SectionCard title={`Jucători activi (${active.length})`}>
                        {playersLoading && <p style={s.hint}>Se încarcă…</p>}
                        <div style={s.feedAdminList}>
                          {active.map((p) => (
                            <div key={p.uid} style={s.playerRow}>
                              <div style={s.playerInfo}>
                                <div style={s.feedAdminTitle}>{p.nickname || p.uid}</div>
                                <div style={s.feedAdminMeta}>
                                  {p.email ? `${p.email} · ` : ""}{p.seasonPoints ?? 0}p · {p.gameweeksPlayed ?? 0} etape
                                </div>
                              </div>
                              <button type="button" style={s.smallBtn} disabled={playerActionUid === p.uid} onClick={() => handlePlayerAction(p.uid, "deactivate")}>
                                Dezactivează
                              </button>
                            </div>
                          ))}
                        </div>
                      </SectionCard>

                      {disabled.length > 0 && (
                        <SectionCard title={`Dezactivați (${disabled.length})`}>
                          <div style={s.feedAdminList}>
                            {disabled.map((p) => (
                              <div key={p.uid} style={{ ...s.playerRow, opacity: 0.6 }}>
                                <div style={s.playerInfo}>
                                  <div style={s.feedAdminTitle}>{p.nickname || p.uid}</div>
                                  <div style={s.feedAdminMeta}>{p.email || p.uid}</div>
                                </div>
                                <button type="button" style={s.smallBtn} disabled={playerActionUid === p.uid} onClick={() => handlePlayerAction(p.uid, "reactivate")}>
                                  Reactivează
                                </button>
                              </div>
                            ))}
                          </div>
                        </SectionCard>
                      )}
                    </>
                  );
                })()}
              </>
            )}

            {/* ── Surprizele Săptămânii ── */}
            {tab === "surprises" && (
              <SectionCard title="🎭 Surprizele Săptămânii — configurare pe tot sezonul">
                <p style={s.hint}>
                  Alege tipul pentru fiecare etapă din timp — userii NU văd tipul până apeși Dezvăluie.
                  „(în curând)" = mecanica nu e încă implementată, neselectabilă.
                </p>
                {surprisesLoading && <p style={s.hint}>Se încarcă…</p>}
                {gameweeks.length === 0 && <p style={s.hint}>Niciun sezon/etapă selectate — alege din tab-ul Config.</p>}

                {gameweeks.map((gw) => {
                  const data = surprisesData[gw.id] || {};
                  const status = getSurpriseStatus(data.public);
                  const statusLabel = status === "locked" ? "🔒 BLOCATĂ" : status === "active" ? "⚡ ACTIVĂ" : "✅ REZOLVATĂ";
                  const mainType = data.secretMain?.type || "";
                  const bonusType = data.secretBonus?.type || "";
                  const duelTheme = data.secretMain?.duelTheme || "";
                  const isDuelType = ["duel-random", "duel-extreme", "duel-rivali", "team-duel-random"].includes(mainType);
                  const mainRevealed = !!data.public?.mainRevealed;
                  const bonusRevealed = !!data.public?.bonusRevealed;
                  const mainResolved = !!data.public?.mainResolved;
                  const bonusResolved = !!data.public?.bonusResolved;

                  return (
                    <div key={gw.id} style={s.surpriseGwCard}>
                      <div style={s.surpriseGwHead}>
                        <span style={s.surpriseGwTitle}>{gw.title || `Etapa ${gw.number}`}</span>
                        <span style={s.surpriseGwStatus}>{statusLabel}</span>
                      </div>

                      <div style={s.surpriseRow}>
                        <label style={s.surpriseLabel}>🏆 MAIN</label>
                        <select
                          style={s.surpriseSelect}
                          value={mainType}
                          disabled={mainRevealed}
                          onChange={(e) => handleConfigureSurprise(gw.id, "mainType", e.target.value)}
                        >
                          <option value="">— alege —</option>
                          {MAIN_CATALOG.map((c) => (
                            <option key={c.id} value={c.id} disabled={!c.active}>{c.label}{!c.active ? " (în curând)" : ""}</option>
                          ))}
                        </select>
                        {!mainRevealed ? (
                          <button type="button" style={s.smallBtn} disabled={!mainType || surpriseActionKey === `${gw.id}_revealMain`}
                            onClick={() => handleSurpriseAction(gw.id, "revealMain")}>
                            🏆 Dezvăluie
                          </button>
                        ) : mainType === "sabotaj" && !data.public?.sabotajRevealed ? (
                          <span style={s.doneTag}>🕵️ alegeri în curs</span>
                        ) : !mainResolved ? (
                          <button type="button" style={s.approveBtn} disabled={surpriseActionKey === `${gw.id}_resolveMain`}
                            onClick={() => handleSurpriseAction(gw.id, "resolveMain")}>
                            Rezolvă
                          </button>
                        ) : (
                          <span style={s.doneTag}>✓ gata</span>
                        )}
                      </div>

                      {isDuelType && (
                        <div style={s.surpriseRow}>
                          <label style={s.surpriseLabel}>🥋 TEMĂ DUEL</label>
                          <select
                            style={s.surpriseSelect}
                            value={duelTheme}
                            disabled={mainRevealed}
                            onChange={(e) => handleConfigureSurprise(gw.id, "duelTheme", e.target.value)}
                          >
                            <option value="">— avatar normal (fără temă) —</option>
                            {DUEL_THEMES.map((t) => (
                              <option key={t.id} value={t.id}>{t.label}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {mainType === "sabotaj" && mainRevealed && (
                        <div style={s.triviaBox}>
                          {(() => {
                            const order = data.secretMain?.config?.order || [];
                            const prog = sabotajProgress[gw.id] || { chosenPickers: [], takenTargets: [] };
                            const done = prog.chosenPickers.length;
                            const total = order.length;
                            const allDone = total > 0 && done >= total;
                            return (
                              <>
                                <p style={s.hint}>
                                  Ordinea e înghețată din clasamentul etapei precedente. {done}/{total} agenți și-au ales deja ținta.
                                </p>
                                {!data.public?.sabotajRevealed ? (
                                  <>
                                    <button
                                      type="button" style={s.approveBtn}
                                      disabled={!allDone || surpriseActionKey === `${gw.id}_revealSabotaj`}
                                      onClick={() => handleSurpriseAction(gw.id, "revealSabotaj")}
                                    >
                                      🔥 Dezvăluie Sabotajele
                                    </button>
                                    {done > 0 && (
                                      <button
                                        type="button" style={s.ghostBtnSmall}
                                        disabled={surpriseActionKey === `${gw.id}_undoSabotaj`}
                                        onClick={() => {
                                          if (window.confirm("Anulezi ultima alegere din secvență? Tura revine la acel jucător.")) {
                                            handleSurpriseAction(gw.id, "undoSabotaj");
                                          }
                                        }}
                                      >
                                        ↩️ Anulează ultima alegere
                                      </button>
                                    )}
                                  </>
                                ) : (
                                  <span style={s.doneTag}>✓ rețea dezvăluită</span>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      )}

                      {mainType === "trivia" && (
                        <div style={s.triviaBox}>
                          <button type="button" style={s.smallBtn} onClick={() => openTriviaEditor(gw.id, data.secretMain?.config?.questions)}>
                            {triviaEditorOpen === gw.id ? "▲ Închide editorul" : "📝 Configurează întrebările"}
                          </button>

                          {triviaEditorOpen === gw.id && (
                            <div style={s.triviaEditor}>
                              {triviaDraft.map((q, i) => (
                                <div key={q.id} style={s.triviaQRow}>
                                  <div style={s.triviaQNum}>#{i + 1}</div>
                                  <input
                                    style={s.triviaTextInput}
                                    placeholder="Textul întrebării…"
                                    value={q.text}
                                    onChange={(e) => updateTriviaDraftField(i, "text", e.target.value)}
                                  />
                                  <div style={s.triviaOptRow}>
                                    <input style={s.triviaOptInput} placeholder="Opțiunea A (ex: DA)" value={q.optionALabel}
                                      onChange={(e) => updateTriviaDraftField(i, "optionALabel", e.target.value)} />
                                    <input style={s.triviaOptInput} placeholder="Opțiunea B (ex: NU)" value={q.optionBLabel}
                                      onChange={(e) => updateTriviaDraftField(i, "optionBLabel", e.target.value)} />
                                  </div>
                                </div>
                              ))}
                              <button type="button" style={s.approveBtn} disabled={triviaSaving} onClick={() => handleSaveTriviaQuestions(gw.id)}>
                                {triviaSaving ? "Se salvează…" : "💾 Salvează întrebările"}
                              </button>
                              {triviaSaveMsg && <div style={s.triviaSaveMsg}>{triviaSaveMsg}</div>}
                            </div>
                          )}

                          {mainRevealed && (data.secretMain?.config?.questions?.length > 0) && (
                            <div style={s.triviaValidate}>
                              <div style={s.triviaValidateLabel}>✅ Validează răspunsul corect</div>
                              {data.secretMain.config.questions.map((q) => (
                                <div key={q.id} style={s.triviaValidateRow}>
                                  <span style={s.triviaValidateText}>{q.text || "(fără text)"}</span>
                                  <div style={s.triviaValidateBtns}>
                                    <button type="button" disabled={triviaMarking === q.id}
                                      style={{ ...s.triviaValidateBtn, ...(q.correctAnswer === "A" ? s.triviaValidateBtnActive : {}) }}
                                      onClick={() => handleMarkCorrect(gw.id, q.id, "A")}>
                                      {q.optionALabel}
                                    </button>
                                    <button type="button" disabled={triviaMarking === q.id}
                                      style={{ ...s.triviaValidateBtn, ...(q.correctAnswer === "B" ? s.triviaValidateBtnActive : {}) }}
                                      onClick={() => handleMarkCorrect(gw.id, q.id, "B")}>
                                      {q.optionBLabel}
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {mainRevealed && (
                            <div style={s.triviaSubmissionSection}>
                              <button type="button" style={s.smallBtn} onClick={() => openTriviaSubmissionPanel(gw.id, data.secretMain?.config?.questions || [])}>
                                {triviaSubmissionPanel === gw.id ? "▲ Ascunde status" : "👥 Cine a răspuns"}
                              </button>
                              {triviaSubmissionPanel === gw.id && (
                                <div style={s.triviaSubmissionList}>
                                  {triviaSubmissionLoading ? <div style={s.hint}>Se încarcă…</div> : (
                                    triviaSubmissionRows.map((r) => (
                                      <div key={r.uid} style={s.triviaSubmissionRow}>
                                        <span>{r.nickname}</span>
                                        <span style={{ color: r.answeredCount === r.total ? "#8BD957" : "#F0A94E" }}>
                                          {r.answeredCount}/{r.total}
                                        </span>
                                      </div>
                                    ))
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {mainType === "zaruri" && (
                        <div style={s.triviaBox}>
                          <button type="button" style={s.smallBtn} onClick={() => openZaruriEditor(gw.id, data.secretMain?.config?.questions)}>
                            {zaruriEditorOpen === gw.id ? "▲ Închide editorul" : "🎲 Configurează întrebările"}
                          </button>

                          {zaruriEditorOpen === gw.id && (
                            <div style={s.triviaEditor}>
                              {zaruriDraft.map((q, i) => (
                                <div key={q.id} style={s.triviaQRow}>
                                  <div style={s.triviaQNum}>#{i + 1}</div>
                                  <input
                                    style={s.triviaTextInput}
                                    placeholder="Textul întrebării… (ex: Câte cornere în Real-Barca?)"
                                    value={q.text}
                                    onChange={(e) => updateZaruriDraftField(i, "text", e.target.value)}
                                  />
                                </div>
                              ))}
                              <button type="button" style={s.approveBtn} disabled={zaruriSaving} onClick={() => handleSaveZaruriQuestions(gw.id)}>
                                {zaruriSaving ? "Se salvează…" : "💾 Salvează întrebările"}
                              </button>
                              {zaruriSaveMsg && <div style={s.triviaSaveMsg}>{zaruriSaveMsg}</div>}
                            </div>
                          )}

                          {mainRevealed && (data.secretMain?.config?.questions?.length > 0) && (
                            <div style={s.triviaValidate}>
                              <div style={s.triviaValidateLabel}>✅ Introdu rezultatul real (după etapă)</div>
                              {data.secretMain.config.questions.map((q) => (
                                <div key={q.id} style={s.triviaValidateRow}>
                                  <span style={s.triviaValidateText}>{q.text || "(fără text)"}</span>
                                  <div style={s.triviaValidateBtns}>
                                    {q.correctTarget != null ? (
                                      <span style={s.doneTag}>{q.correctTarget}</span>
                                    ) : (
                                      <>
                                        <input
                                          style={s.zaruriTargetInput}
                                          type="number"
                                          placeholder="valoare"
                                          value={zaruriTargetDrafts[q.id] ?? ""}
                                          onChange={(e) => setZaruriTargetDrafts((prev) => ({ ...prev, [q.id]: e.target.value }))}
                                        />
                                        <button type="button" style={s.triviaValidateBtn} disabled={zaruriMarking === q.id}
                                          onClick={() => handleMarkTarget(gw.id, q.id)}>
                                          ✓
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {mainRevealed && (
                            <div style={s.triviaSubmissionSection}>
                              <button type="button" style={s.smallBtn} onClick={() => openZaruriSubmissionPanel(gw.id, data.secretMain?.config?.questions || [])}>
                                {zaruriSubmissionPanel === gw.id ? "▲ Ascunde status" : "👥 Cine s-a oprit"}
                              </button>
                              {zaruriSubmissionPanel === gw.id && (
                                <div style={s.triviaSubmissionList}>
                                  {zaruriSubmissionLoading ? <div style={s.hint}>Se încarcă…</div> : (
                                    zaruriSubmissionRows.map((r) => (
                                      <div key={r.uid} style={s.triviaSubmissionRow}>
                                        <span>{r.nickname}</span>
                                        <span style={{ color: r.answeredCount === r.total ? "#8BD957" : "#F0A94E" }}>
                                          {r.answeredCount}/{r.total}
                                        </span>
                                      </div>
                                    ))
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      <div style={s.surpriseRow}>
                        <label style={s.surpriseLabel}>🎁 BONUS</label>
                        <select
                          style={s.surpriseSelect}
                          value={bonusType}
                          disabled={bonusRevealed}
                          onChange={(e) => handleConfigureSurprise(gw.id, "bonusType", e.target.value)}
                        >
                          <option value="">— alege —</option>
                          {BONUS_CATALOG.map((c) => (
                            <option key={c.id} value={c.id} disabled={!c.active}>{c.label}{!c.active ? " (în curând)" : ""}</option>
                          ))}
                        </select>
                        {!bonusRevealed ? (
                          <button type="button" style={s.smallBtn} disabled={!bonusType || surpriseActionKey === `${gw.id}_revealBonus`}
                            onClick={() => handleSurpriseAction(gw.id, "revealBonus")}>
                            🎁 Dezvăluie
                          </button>
                        ) : !bonusResolved ? (
                          <button type="button" style={s.approveBtn} disabled={surpriseActionKey === `${gw.id}_resolveBonus`}
                            onClick={() => handleSurpriseAction(gw.id, "resolveBonus")}>
                            Rezolvă
                          </button>
                        ) : (
                          <span style={s.doneTag}>✓ gata</span>
                        )}
                      </div>

                      {bonusType === "mystery-box" && bonusRevealed && (
                        <div style={s.triviaBox}>
                          {data.public?.mysteryBoxAllRevealed ? (
                            <span style={s.doneTag}>✓ cutii rămase dezvăluite</span>
                          ) : (
                            <button
                              type="button" style={s.smallBtn}
                              disabled={surpriseActionKey === `${gw.id}_revealRemainingMystery`}
                              onClick={() => handleSurpriseAction(gw.id, "revealRemainingMystery")}
                            >
                              🎁 Dezvăluie cutiile rămase
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </SectionCard>
            )}

            {/* ── Feed — evenimente automate, articole editoriale, FUN ── */}
            {tab === "feed" && (
              <>
                <SectionCard title="🔴 LIVE DATA (API-Football)">
                  {liveDataLoading && <p style={s.hint}>Se încarcă…</p>}
                  {!liveDataLoading && !liveDataQuota && <p style={s.hint}>Niciun sync încă.</p>}
                  {!liveDataLoading && liveDataQuota && (
                    <div style={{ fontSize: 12, lineHeight: 1.8, color: "#C7CCDA" }}>
                      Provider: API-Football<br />
                      Ultimă sincronizare: {liveDataQuota.lastSync ? new Date(liveDataQuota.lastSync).toLocaleString("ro-RO") : "—"}<br />
                      Ultima reușită: {liveDataQuota.lastSuccess ? new Date(liveDataQuota.lastSuccess).toLocaleString("ro-RO") : "—"}<br />
                      Cotă folosită azi: {liveDataQuota.requestsUsed ?? 0}/100<br />
                      Meciuri relevante: {liveDataDiagnostics.mapped + liveDataDiagnostics.unmatched + liveDataDiagnostics.ambiguous}<br />
                      Mapate: {liveDataDiagnostics.mapped} · Nemapate: {liveDataDiagnostics.unmatched} · Ambigue: {liveDataDiagnostics.ambiguous}<br />
                      Live acum: {liveDataDiagnostics.live}<br />
                      Ultimul eveniment extern: {liveDataDiagnostics.lastEventTitle || "—"}<br />
                      Ultima eroare: {liveDataQuota.lastError || "—"}
                    </div>
                  )}
                  <button type="button" style={s.smallBtn} disabled={testingConnection} onClick={handleTestFootballConnection}>
                    {testingConnection ? "Se testează…" : "🔌 Test Connection"}
                  </button>
                  {testConnectionResult && <p style={s.hint}>{testConnectionResult}</p>}
                </SectionCard>

                <SectionCard title="Evenimente recente (automate)">
                  <button type="button" style={s.smallBtn} disabled={cleaningLiveEvents} onClick={handleCleanupLiveEvents}>
                    {cleaningLiveEvents ? "Se curăță…" : "🧹 Șterge golurile/cartonașele vechi (text greșit)"}
                  </button>
                  <button type="button" style={s.smallBtn} disabled={regeneratingFeed} onClick={handleRegenerateFeed}>
                    {regeneratingFeed ? "Se regenerează…" : "🔄 Regenerează Feed etapa curentă"}
                  </button>
                  {regenerateMessage && <p style={s.hint}>{regenerateMessage}</p>}
                  {cleanupMessage && <p style={s.hint}>{cleanupMessage}</p>}
                  {feedLoading && <p style={s.hint}>Se încarcă…</p>}
                  {!feedLoading && feedEvents.length === 0 && <p style={s.hint}>Niciun eveniment încă.</p>}
                  <div style={s.feedAdminList}>
                    {feedEvents.map((e) => (
                      <div key={e.id} style={s.feedAdminRow}>
                        <div style={s.feedAdminRowHead}>
                          <span style={s.feedAdminCategory}>{e.category}</span>
                          <span style={s.feedAdminPriority}>prioritate {e.priority}</span>
                        </div>
                        <div style={s.feedAdminTitle}>{e.title}</div>
                        <div style={s.feedAdminMeta}>{new Date(e.ts).toLocaleString("ro-RO")} · sursă: automat</div>
                      </div>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard title="Bancă de conținut editorial (context)">
                  <p style={s.hint}>
                    {EDITORIAL_ARTICLES.length} fragmente, pentru {new Set(EDITORIAL_ARTICLES.map((a) => a.teamId)).size} echipe.
                    Nu apar de sine stătător — se atașează AUTOMAT doar la meciurile reale, viitoare, ale echipelor
                    respective (fereastră de 7 zile), și dispar când meciul nu mai e "următor".
                  </p>
                </SectionCard>

                <SectionCard title="FUN — adăugat de Admin">
                  <p style={s.hint}>Astea se adaugă peste lista de bază (nu o înlocuiesc).</p>
                  <input style={s.input} placeholder="Etichetă (ex: GLUMĂ, PROVERB)" value={newFunLabel} onChange={(e) => setNewFunLabel(e.target.value)} />
                  <textarea style={s.textarea} rows={2} placeholder="Textul..." value={newFunText} onChange={(e) => setNewFunText(e.target.value)} />
                  <button style={s.btn} disabled={funSaving} onClick={handleAddFun} type="button">
                    {funSaving ? "Se salvează…" : "Adaugă"}
                  </button>

                  {feedAdminFun.length > 0 && (
                    <div style={{ ...s.feedAdminList, marginTop: 10 }}>
                      {feedAdminFun.map((f) => (
                        <div key={f.id} style={s.feedAdminRowBetween}>
                          <div>
                            <div style={s.feedAdminCategory}>{f.label}</div>
                            <div style={s.feedAdminTitle}>{f.text}</div>
                          </div>
                          <button type="button" style={s.smallBtn} onClick={() => handleDeleteFun(f.id)}>Șterge</button>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>
              </>
            )}

            {/* ── Health Check — doar detectare + corecție manuală ────── */}
            {tab === "health" && (
              <SectionCard title="Health Check — meciuri deja salvate">
                <p style={s.hint}>
                  Verifică meciurile deja existente în Firestore (toate etapele) — nu modifică nimic automat, doar
                  semnalează probleme probabile.
                </p>
                <button style={s.btn} disabled={healthLoading} onClick={handleRunHealthCheck} type="button">
                  {healthLoading ? "Se verifică…" : "Rulează Health Check"}
                </button>
                {healthError && <div style={{ ...s.message, background: "rgba(240,85,90,0.1)", borderColor: "rgba(240,85,90,0.3)", color: "#F0555A" }}>{healthError}</div>}
                {editMessage && <div style={s.message}>{editMessage}</div>}

                {healthIssues !== null && (
                  <p style={{ ...s.hint, marginTop: 12 }}>
                    {healthIssues.length === 0 ? "Nicio problemă găsită." : `${healthIssues.length} meciuri cu probleme.`}
                  </p>
                )}

                {healthIssues && healthIssues.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
                    {healthIssues.map(({ match: m, problems }) => (
                      <div key={m.id} style={s.healthCard}>
                        <div style={s.healthTop}>
                          <span style={s.healthTeams}>{m.homeTeam} - {m.awayTeam}</span>
                          <span style={s.healthGw}>etapă: {m.gameweekId}</span>
                        </div>
                        <ul style={s.healthList}>
                          {problems.map((p, i) => <li key={i} style={s.healthItem}>{p}</li>)}
                        </ul>

                        {editingMatchId === m.id ? (
                          <div style={s.editBox}>
                            <label style={s.editLabel}>Dată/oră (România, YYYY-MM-DD HH:mm)</label>
                            <input
                              style={s.editInput}
                              value={editDraft.kickoffAtWallClock}
                              onChange={(e) => setEditDraft((d) => ({ ...d, kickoffAtWallClock: e.target.value }))}
                              placeholder="2026-08-06 21:00"
                            />
                            <label style={s.editLabel}>Competiție</label>
                            <div style={s.compPickerGrid}>
                              {Object.entries(COMPETITION_THEMES).map(([slug, theme]) => {
                                const active = editDraft.competitionSlug === slug;
                                return (
                                  <button
                                    key={slug}
                                    type="button"
                                    onClick={() => setEditDraft((d) => ({ ...d, competitionSlug: slug }))}
                                    style={{
                                      ...s.compPickerItem,
                                      border: `1px solid ${active ? theme.primaryColor : color.border}`,
                                      background: active ? `${theme.primaryColor}22` : color.surface,
                                    }}
                                  >
                                    <CompetitionLogo name={slug} size={18} />
                                    <span style={{ ...s.compPickerLabel, color: active ? theme.primaryColor : color.textMuted }}>{theme.name}</span>
                                  </button>
                                );
                              })}
                            </div>
                            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                              <button style={s.btn} disabled={editSaving} onClick={() => handleSaveMatchEdit(m.id)} type="button">
                                {editSaving ? "Se salvează…" : "Salvează corecția"}
                              </button>
                              <button style={s.btnGhost} onClick={() => setEditingMatchId("")} type="button">Anulează</button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                            <button style={s.btnGhost} onClick={() => startEditingMatch(m)} type="button">Corectează manual</button>
                            <button style={{ ...s.btnGhost, color: "#F0555A" }} onClick={() => handleDeleteFromHealthCheck(m)} type="button">Șterge meciul</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            )}

            {/* ── Import / Config ───────────────────────────────────── */}
            {tab === "config" && (
              <>
              <SectionCard title="Import meciuri">
                <form onSubmit={handleImportMatches} style={s.form}>
                  <p style={s.hint}>
                    Lipește meciurile, un rând pe meci, format: <br />
                    <code style={s.code}>Echipa Gazdă - Echipa Oaspete | 2026-09-16 21:00</code>
                  </p>
                  <textarea
                    style={s.textarea}
                    rows={6}
                    placeholder={"Real Madrid - Arsenal | 2026-09-16 21:00\nInter - Barcelona | 2026-09-16 21:00"}
                    value={matchesText}
                    onChange={(e) => setMatchesText(e.target.value)}
                  />
                  <button style={s.btn} disabled={loading} type="submit">Importă meciurile</button>
                </form>
              </SectionCard>

              <SectionCard title="Avatar utilizator">
                <p style={s.hint}>
                  Alege utilizatorul din listă — niciun UID sau email tastat manual. Format avatarId:
                  „pachet/index" (ex: „adireal/1").
                </p>
                <select
                  style={s.select}
                  value={avatarUserUid}
                  onChange={(e) => setAvatarUserUid(e.target.value)}
                >
                  <option value="">Alege utilizator…</option>
                  {allUsers.map((u) => (
                    <option key={u.uid} value={u.uid}>
                      {u.nickname || u.uid} {u.avatarId ? `(are deja: ${u.avatarId})` : "(fără avatar)"}
                    </option>
                  ))}
                </select>
                <input
                  style={s.input}
                  placeholder="avatarId (ex: adireal/1)"
                  value={avatarIdInput}
                  onChange={(e) => setAvatarIdInput(e.target.value)}
                />
                <button style={s.btn} disabled={avatarSaving || !avatarUserUid || !avatarIdInput.trim()} onClick={handleSetUserAvatar} type="button">
                  {avatarSaving ? "Se salvează…" : "Setează avatarId"}
                </button>
                {avatarSaveMsg && <p style={s.hint}>{avatarSaveMsg}</p>}
              </SectionCard>

              <SectionCard title="Nickname utilizator">
                <p style={s.hint}>
                  Pentru useri blocați cu numele real din Google (bug reparat, dar cei deja
                  afectați nu se corectează singuri) — schimbă direct nickname-ul aici.
                </p>
                <select
                  style={s.select}
                  value={nicknameUserUid}
                  onChange={(e) => setNicknameUserUid(e.target.value)}
                >
                  <option value="">Alege utilizator…</option>
                  {allUsers.map((u) => (
                    <option key={u.uid} value={u.uid}>
                      {u.nickname || u.uid}
                    </option>
                  ))}
                </select>
                <input
                  style={s.input}
                  placeholder="nickname nou"
                  value={nicknameInput}
                  onChange={(e) => setNicknameInput(e.target.value)}
                />
                <button style={s.btn} disabled={nicknameSaving || !nicknameUserUid || !nicknameInput.trim()} onClick={handleSetUserNickname} type="button">
                  {nicknameSaving ? "Se salvează…" : "Setează nickname"}
                </button>
                {nicknameSaveMsg && <p style={s.hint}>{nicknameSaveMsg}</p>}
              </SectionCard>
              </>
            )}
          </>
        )}
      </div>

      {openPlayerUid && !openPlayerLoading && openPlayerStats && (
        <PlayerCard
          uid={openPlayerUid}
          nickname={previewProfiles[openPlayerUid]?.nickname || openPlayerUid}
          avatarId={previewProfiles[openPlayerUid]?.avatarId}
          rank={openPlayerStats.rank}
          scope="etapa"
          stats={openPlayerStats}
          onClose={() => setOpenPlayerUid("")}
        />
      )}
    </div>
  );
}

const s = {
  resetBtn: {
    background: color.redBg, border: `1px solid ${color.redBorder}`, color: color.red,
    borderRadius: radius.sm, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: font.body,
  },
  hint: { fontSize: 11.5, color: color.textMuted, lineHeight: 1.5, margin: "0 0 4px" },
  linkBtn: {
    background: "none", border: "none", color: color.textMuted, fontSize: 12,
    textDecoration: "underline", cursor: "pointer", padding: 0, marginBottom: 12, fontFamily: font.body,
  },
  code: { color: color.green, fontSize: 11 },
  textarea: {
    width: "100%", background: color.surfaceInset, border: `1px solid ${color.border}`, borderRadius: radius.sm,
    padding: "11px 12px", fontSize: 12.5, color: color.textPrimary, outline: "none", resize: "vertical",
    fontFamily: "monospace",
  },
  message: {
    background: color.greenBg, border: `1px solid ${color.greenBorder}`,
    color: color.green, borderRadius: radius.sm, padding: "10px 14px", fontSize: 12.5, marginBottom: 16,
    whiteSpace: "pre-line",
  },
  specialsOverview: { display: "flex", flexDirection: "column", gap: 4, margin: "10px 0" },
  feedAdminList: { display: "flex", flexDirection: "column", gap: 6, marginTop: 8 },
  feedAdminRow: {
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "9px 11px",
  },
  feedAdminRowHead: { display: "flex", justifyContent: "space-between", marginBottom: 3 },
  feedAdminRowBetween: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "9px 11px",
  },
  feedAdminCategory: { fontSize: 9.5, fontWeight: 800, letterSpacing: "0.06em", color: "#D4AF37", textTransform: "uppercase" },
  feedAdminPriority: { fontSize: 9.5, color: "#6B7385" },
  feedAdminTitle: { fontSize: 12, fontWeight: 600, color: "#fff", marginTop: 1 },
  feedAdminMeta: { fontSize: 10, color: "#6B7385", marginTop: 2 },
  smallBtn: {
    flexShrink: 0, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6,
    padding: "6px 10px", fontSize: 10.5, fontWeight: 700, color: "#fff", cursor: "pointer",
  },
  ghostBtnSmall: {
    display: "block", marginTop: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6,
    padding: "6px 10px", fontSize: 10, fontWeight: 600, color: "#8A93A6", cursor: "pointer",
  },
  missingPredBtn: {
    display: "block", width: "100%", marginTop: 6, background: "rgba(255,255,255,0.04)", border: `1px solid ${color.borderSubtle}`,
    borderRadius: 8, padding: "8px 10px", fontSize: 11, fontWeight: 700, color: "#B8BECC", cursor: "pointer", textAlign: "left",
  },
  missingPredPanel: {
    marginTop: 6, padding: "10px 12px", background: "rgba(255,255,255,0.03)", border: `1px solid ${color.borderSubtle}`, borderRadius: 8,
  },
  missingPredAllDone: { fontSize: 11.5, color: color.green || "#8BD957", fontWeight: 600 },
  missingPredChips: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 },
  missingPredChip: {
    fontSize: 10.5, fontWeight: 600, color: "#F0B54C", background: "rgba(240,181,76,0.12)",
    border: "1px solid rgba(240,181,76,0.3)", borderRadius: 999, padding: "3px 9px",
  },
  playerRow: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "10px 12px",
  },
  surpriseGwCard: {
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 12, marginBottom: 10,
  },
  surpriseGwHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  surpriseGwTitle: { fontSize: 12.5, fontWeight: 700, color: "#fff" },
  surpriseGwStatus: { fontSize: 10.5, fontWeight: 700, color: "#D4AF37" },
  surpriseRow: { display: "flex", alignItems: "center", gap: 6, marginBottom: 8 },
  surpriseLabel: { fontSize: 11, fontWeight: 700, color: "#B4BBC7", width: 62, flexShrink: 0 },
  surpriseSelect: {
    flex: 1, background: "#12141C", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6,
    padding: "8px 6px", fontSize: 11, color: "#fff",
  },
  doneTag: { fontSize: 10.5, fontWeight: 700, color: "#8BD957", flexShrink: 0 },

  triviaBox: { marginTop: 4, marginBottom: 8, paddingTop: 8, borderTop: "1px dashed rgba(255,255,255,0.1)" },
  triviaEditor: { marginTop: 8, display: "flex", flexDirection: "column", gap: 8 },
  triviaQRow: { background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: 8, display: "flex", flexDirection: "column", gap: 6 },
  triviaQNum: { fontSize: 10, fontWeight: 800, color: "#D4AF37" },
  triviaTextInput: {
    width: "100%", background: "#12141C", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6,
    padding: "7px 8px", fontSize: 11.5, color: "#fff", fontFamily: "inherit",
  },
  triviaOptRow: { display: "flex", gap: 6 },
  triviaOptInput: {
    flex: 1, background: "#12141C", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6,
    padding: "6px 8px", fontSize: 10.5, color: "#fff", fontFamily: "inherit",
  },
  triviaSaveMsg: { fontSize: 10.5, color: "#8BD957", fontWeight: 700, marginTop: 4 },

  triviaValidate: { marginTop: 10, paddingTop: 8, borderTop: "1px dashed rgba(255,255,255,0.1)" },
  triviaValidateLabel: { fontSize: 10.5, fontWeight: 800, color: "#B4BBC7", marginBottom: 6 },
  triviaValidateRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, padding: "5px 0" },
  triviaValidateText: { fontSize: 10.5, color: "#fff", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  triviaValidateBtns: { display: "flex", gap: 4, flexShrink: 0 },
  triviaValidateBtn: {
    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6,
    padding: "4px 8px", fontSize: 9.5, fontWeight: 700, color: "#B4BBC7", cursor: "pointer",
  },
  triviaValidateBtnActive: { background: "rgba(139,217,87,0.15)", border: "1px solid rgba(139,217,87,0.4)", color: "#8BD957" },
  zaruriTargetInput: {
    width: 56, background: "#12141C", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6,
    padding: "4px 6px", fontSize: 10.5, color: "#fff",
  },

  triviaSubmissionSection: { marginTop: 10, paddingTop: 8, borderTop: "1px dashed rgba(255,255,255,0.1)" },
  triviaSubmissionList: { marginTop: 8, display: "flex", flexDirection: "column", gap: 4 },
  triviaSubmissionRow: { display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "#fff", padding: "3px 0" },
  playerInfo: { minWidth: 0, flex: 1 },
  playerActions: { display: "flex", gap: 6, flexShrink: 0 },
  approveBtn: {
    background: "rgba(52,199,89,0.15)", border: "1px solid rgba(52,199,89,0.4)", color: "#34C759",
    borderRadius: 6, padding: "6px 12px", fontSize: 10.5, fontWeight: 700, cursor: "pointer",
  },
  rejectBtn: {
    background: "rgba(240,85,90,0.12)", border: "1px solid rgba(240,85,90,0.35)", color: "#F0555A",
    borderRadius: 6, padding: "6px 12px", fontSize: 10.5, fontWeight: 700, cursor: "pointer",
  },
  specialsOverviewRow: {
    display: "flex", alignItems: "center", gap: 8, width: "100%", background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "8px 10px", cursor: "pointer", textAlign: "left",
  },
  specialsOverviewRowActive: { border: "1px solid rgba(212,175,55,0.5)", background: "rgba(212,175,55,0.08)" },
  specialsOverviewLabel: { flex: 1, fontSize: 11.5, fontWeight: 600, color: "#fff" },
  specialsOverviewStatus: { fontSize: 10.5, color: "#9099AC" },

  select: {
    width: "100%", background: color.surfaceInset, border: `1px solid ${color.border}`, borderRadius: radius.sm,
    padding: "11px 12px", fontSize: 13.5, color: color.textPrimary, marginBottom: 10, fontFamily: font.body,
  },
  searchInput: {
    width: "100%", background: color.surfaceInset, border: `1px solid ${color.border}`, borderRadius: radius.sm,
    padding: "10px 14px", fontSize: 13.5, color: color.textPrimary, outline: "none", marginBottom: 12, fontFamily: font.body,
  },
  republishBox: {
    background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.3)", borderRadius: radius.sm,
    padding: 12, marginBottom: 14,
  },
  republishBtn: {
    width: "100%", background: "linear-gradient(180deg, #F0D875, #C9A227)", border: "none", borderRadius: radius.sm,
    padding: "11px 0", fontSize: 12.5, fontWeight: 800, color: "#1A1200", cursor: "pointer", fontFamily: font.body,
  },
  republishHint: { fontSize: 10.5, color: color.textFaint, fontFamily: font.body, marginTop: 8, lineHeight: 1.4 },
  republishMsg: { fontSize: 11.5, color: color.textPrimary, fontFamily: font.body, marginTop: 8, fontWeight: 700 },
  form: { display: "flex", flexDirection: "column", gap: 10 },
  row: { display: "flex", gap: 10 },
  input: {
    flex: 1, background: color.surfaceInset, border: `1px solid ${color.border}`, borderRadius: radius.sm,
    padding: "11px 12px", fontSize: 13.5, color: color.textPrimary, outline: "none", fontFamily: font.body,
  },
  btn: {
    background: color.goldGradient, color: color.goldOn, border: "none",
    borderRadius: radius.sm, padding: "11px 0", fontSize: 13.5, fontWeight: 800, cursor: "pointer", fontFamily: font.body,
  },
  btnGhost: {
    background: "none", border: `1px solid ${color.border}`, color: color.textMuted,
    borderRadius: radius.sm, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: font.body,
  },
  healthCard: {
    background: color.surfaceInset, border: "1px solid rgba(240,147,12,0.3)", borderRadius: radius.sm, padding: 12,
  },
  healthTop: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  healthTeams: { fontSize: 13, fontWeight: 700, color: color.textPrimary, fontFamily: font.body },
  healthGw: { fontSize: 10, color: color.textFaint, fontFamily: font.body },
  healthList: { margin: "0 0 0", paddingLeft: 18 },
  healthItem: { fontSize: 11.5, color: "#F0A94E", fontFamily: font.body, marginBottom: 3, lineHeight: 1.4 },
  editBox: { marginTop: 8, display: "flex", flexDirection: "column", gap: 6 },
  editLabel: { fontSize: 10, color: color.textFaint, fontWeight: 700, fontFamily: font.body },
  editInput: {
    background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.sm,
    padding: "8px 10px", fontSize: 12.5, color: color.textPrimary, fontFamily: font.body,
  },
  compPickerGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 },
  compPickerItem: {
    display: "flex", alignItems: "center", gap: 6, borderRadius: radius.sm, padding: "7px 8px", cursor: "pointer",
  },
  compPickerLabel: { fontSize: 10.5, fontWeight: 700, fontFamily: font.body, textAlign: "left" },
  tabRow: { display: "flex", gap: 6, marginBottom: 14, overflowX: "auto" },
  tabBtn: {
    flex: "1 0 auto", background: color.surfaceInset, border: `1px solid ${color.border}`, color: color.textMuted,
    borderRadius: radius.sm, padding: "9px 10px", fontSize: 11.5, fontWeight: 700, cursor: "pointer",
    whiteSpace: "nowrap", fontFamily: font.body,
  },
  tabBtnActive: { background: color.goldGradient, color: color.goldOn, border: "none" },
  matchList: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 },
  featuredRow: { display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", flex: 1, minWidth: 0 },
  matchRowWithDelete: { display: "flex", alignItems: "flex-start", gap: 8, flexWrap: "nowrap", width: "100%" },
  deleteBtn: {
    flexShrink: 0, marginTop: 14, width: 34, height: 34, borderRadius: radius.sm,
    background: color.redBg, border: `1px solid ${color.redBorder}`,
    color: color.red, fontSize: 15, cursor: "pointer",
  },
  featuredCheckbox: { width: 20, height: 20, marginTop: 14, flexShrink: 0, accentColor: color.gold },
  previewTable: { display: "flex", flexDirection: "column", gap: 6, marginTop: 12, marginBottom: 12 },
  finalizeBtn: {
    width: "100%", background: color.greenBg, border: `1px solid #3FA85C`, color: color.green,
    borderRadius: radius.sm, padding: "12px 0", fontSize: 13.5, fontWeight: 800, cursor: "pointer", fontFamily: font.body,
  },
};
