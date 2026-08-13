import { useEffect, useState } from "react";
import { listAllSpecialCompetitions, listSpecialPhases, openSpecialPhase, resolveSpecialPhase, loadAllSpecialPicks } from "../services/specialsService";
import { PICK_TYPES } from "../specialDefinitions";
import { resolveTeamOptions } from "../teamRegistry";
import { resolveGolgheterOptions, GOLGHETER_ID } from "../golgheterRegistry";
import SpecialResolvePicker from "../components/SpecialResolvePicker";
import SpecialMonitoringPanel from "../components/SpecialMonitoringPanel";
import ClubLogo from "../components/ClubLogo";
import useNow from "../hooks/useNow";
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
  listAllUsers,
  getPlayerCardStats,
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
import { color, font, layout, radius } from "../theme";

// Ordonare operațională pentru secțiunea de Rezultate: meciurile FĂRĂ
// rezultat introdus încă vin primele (sortate după kickoffAt), apoi cele
// care au deja rezultat salvat (tot sortate după kickoffAt). Nu inventăm
// un status "live" — nu există sursă live, doar kickoffAt + existența
// rezultatului.
function sortForResults(matches) {
  const hasResult = (m) => m.realScoreA !== null && m.realScoreA !== undefined;
  return [...matches].sort((a, b) => {
    const aDone = hasResult(a);
    const bDone = hasResult(b);
    if (aDone !== bDone) return aDone ? 1 : -1;
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
  const [optionsText, setOptionsText] = useState("");
  const [closesAtInput, setClosesAtInput] = useState("");
  const [specialMonitoring, setSpecialMonitoring] = useState({ picks: [], loading: false });
  const [openSaving, setOpenSaving] = useState(false);
  const [openMsg, setOpenMsg] = useState("");
  const [resolveSelection, setResolveSelection] = useState(null);
  const [resolveSaving, setResolveSaving] = useState(false);
  const [resolveMsg, setResolveMsg] = useState("");

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

  async function handleChangeStatus(matchId, newStatus) {
    await updateMatchStatus(matchId, newStatus);
    await refreshMatches(selectedGameweekId);
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
    if (tab !== "config" && tab !== "speciale") return;
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
  }, [tab, selectedSeasonId, openMsg, resolveMsg]);

  // Monitorizare — cine a ales, ce a ales, când. Se încarcă doar când
  // faza chiar există (a fost deschisă) — pe fazele "neîschisă" nu are
  // rost, nimeni nu poate avea încă un pick.
  useEffect(() => {
    if (!specialPhaseId || !specialPhasesForSeason.find((p) => p.phaseId === specialPhaseId)) {
      setSpecialMonitoring({ picks: [], loading: false });
      return;
    }
    setSpecialMonitoring({ picks: [], loading: true });
    loadAllSpecialPicks(specialPhaseId)
      .then((picks) => setSpecialMonitoring({ picks, loading: false }))
      .catch((err) => {
        console.error("Eroare la încărcarea monitorizării:", err);
        setSpecialMonitoring({ picks: [], loading: false });
      });
  }, [specialPhaseId, specialPhasesForSeason, resolveMsg]);

  const specialCompetitions = listAllSpecialCompetitions();
  const specialComp = specialCompetitions.find((c) => c.id === specialCompId) || null;
  const specialPhaseDef = specialComp?.phases.find((p) => p.id === specialPhaseId) || null;
  const specialPhaseState = specialPhasesForSeason.find((p) => p.phaseId === specialPhaseId) || null;

  function slugifyOption(label) {
    return label.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  // Opțiunile pentru faza selectată — din registrul de echipe (STRICT,
  // niciun text liber) pentru optionsSource === "teams", sau din
  // textarea (mecanismul existent, neschimbat) pentru "players" (Golgheter).
  // Opțiuni din registru — DOAR dacă resolveTeamOptions/resolveGolgheterOptions
  // întorc ceva (null = fază eliminatorie, admin introduce manual echipele
  // reale calificate — vezi comentariul din teamRegistry.js).
  const registryOptions = specialPhaseDef && specialComp
    ? (specialPhaseDef.optionsSource === "teams"
        ? resolveTeamOptions(specialComp.id, specialPhaseDef.id)
        : specialPhaseDef.id === GOLGHETER_ID
          ? resolveGolgheterOptions()
          : null)
    : null;
  const isRegistryPhase = registryOptions !== null;
  const teamOptionsPreview = registryOptions || [];

  async function handleOpenSpecialPhase() {
    if (!specialPhaseDef || !selectedSeasonId) return;
    if (!closesAtInput) { setOpenMsg("Setează data de închidere."); return; }

    const options = isRegistryPhase
      ? teamOptionsPreview
      : optionsText.split("\n").map((l) => l.trim()).filter(Boolean).map((label) => ({ id: slugifyOption(label), label }));

    if (options.length === 0) { setOpenMsg(isRegistryPhase ? "Niciun candidat în registru pentru faza asta." : "Introdu cel puțin o opțiune."); return; }
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
      'ATENȚIE — instrument doar de TEST. Șterge TOATE sezoanele, etapele și meciurile, ireversibil.\n\nScrie exact "RESET" ca să confirmi:'
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
                    <MatchResultCard
                      key={m.id}
                      match={m}
                      onSave={(values) => handleSaveResult(m.id, values)}
                      onChangeStatus={(newStatus) => handleChangeStatus(m.id, newStatus)}
                      disabled={currentGameweek?.status === "completed"}
                    />
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
                      Deschide „{specialPhaseDef.label}"
                      {specialPhaseDef.requiresPhase && (
                        <> (de obicei are sens după „{specialComp.phases.find((p) => p.id === specialPhaseDef.requiresPhase)?.label}", dar poți deschide și mai devreme — nicio ordine impusă)</>
                      )}
                      .
                    </p>

                    {isRegistryPhase ? (
                      <>
                        <p style={s.hint}>
                          Opțiuni — direct din registru, {teamOptionsPreview.length} candidați.
                          Userii aleg STRICT din listă, fără text liber.
                        </p>
                        <div style={s.teamsPreview}>
                          {teamOptionsPreview.map((t) => (
                            <span key={t.id} style={s.teamsPreviewChip}>
                              {t.club && <ClubLogo teamName={t.club} size={16} />}
                              {t.club ? `${t.label} (${t.club})` : t.label}
                            </span>
                          ))}
                        </div>
                      </>
                    ) : (
                      <>
                        <p style={s.hint}>
                          {specialPhaseDef.optionsSource === "teams"
                            ? "Echipele reale calificate în faza asta (necunoscute dinainte — depind de tragerea la sorți). O linie = o echipă."
                            : "O linie = un candidat."}
                          {" "}Userii aleg STRICT din listă, nu scriu liber (elimină potriviri greșite la scorare).
                        </p>
                        <textarea
                          style={s.textarea}
                          rows={5}
                          placeholder={specialPhaseDef.optionsSource === "teams" ? "PSG\nBayern\nInter\n..." : "Mbappé\nHaaland\nLewandowski\n..."}
                          value={optionsText}
                          onChange={(e) => setOptionsText(e.target.value)}
                        />
                      </>
                    )}

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

                {specialPhaseDef && specialPhaseState && (
                  <SpecialMonitoringPanel
                    phaseDef={specialPhaseDef}
                    phaseState={specialPhaseState}
                    allUsers={allUsers}
                    monitoring={specialMonitoring}
                    now={now}
                  />
                )}

                {specialPhaseDef && specialPhaseState && specialPhaseState.status !== "resolved" && (
                  <>
                    <p style={s.hint}>
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
  teamsPreview: { display: "flex", flexWrap: "wrap", gap: 5, margin: "8px 0" },
  teamsPreviewChip: {
    display: "flex", alignItems: "center", gap: 5,
    fontSize: 10.5, fontWeight: 600, color: "#C7CEDA", background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)", borderRadius: 999, padding: "4px 10px",
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
  matchRowWithDelete: { display: "flex", alignItems: "flex-start", gap: 8 },
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
