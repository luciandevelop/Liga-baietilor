import { useEffect, useState } from "react";
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
  previewGameweekResults,
  publishLiveScores,
  finalizeGameweek,
  getUserNicknames,
} from "../services/adminService";
import { getCurrentSeason, getCurrentGameweek } from "../services/predictionsService";
import MatchCard from "../components/MatchCard";
import MatchResultCard from "../components/MatchResultCard";
import PlayerBreakdownModal from "../components/PlayerBreakdownModal";

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

export default function AdminScreen({ onBack }) {
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
  const [showMatchList, setShowMatchList] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const [deletingMatchId, setDeletingMatchId] = useState("");
  const [deleteMessage, setDeleteMessage] = useState("");

  const [previewRows, setPreviewRows] = useState(null);
  const [previewIncomplete, setPreviewIncomplete] = useState(0);
  const [previewNicknames, setPreviewNicknames] = useState({});
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewMessage, setPreviewMessage] = useState("");
  const [finalizing, setFinalizing] = useState(false);
  const [openPlayerUid, setOpenPlayerUid] = useState("");

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
          const gws = await refreshGameweeks(current.id);
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

  async function recomputeAndPublish() {
    setPreviewLoading(true);
    setPreviewMessage("");
    try {
      const result = await previewGameweekResults(selectedGameweekId);
      setPreviewRows(result.rows);
      setPreviewIncomplete(result.incompleteMatchIds.length);
      const names = await getUserNicknames(result.rows.map((r) => r.uid));
      setPreviewNicknames(names);

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

  async function handleImportMatches(e) {
    e.preventDefault();
    if (!selectedGameweekId || !matchesText.trim()) return;
    setLoading(true);
    setMessage("");
    try {
      const count = await bulkCreateMatches(selectedGameweekId, matchesText);
      setMatchesText("");
      await refreshMatches(selectedGameweekId);
      setMessage(`${count} meciuri importate.`);
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
  const openPlayerRow = previewRows?.find((r) => r.uid === openPlayerUid) || null;

  return (
    <div style={s.page}>
      <div style={s.wrap}>
        <div style={s.headerRow}>
          <h1 style={s.title}>Panou Admin — test etapă</h1>
          <div style={s.headerBtns}>
            <button style={s.resetBtn} onClick={handleReset} disabled={loading}>⚠️ Reset TEST</button>
            <button style={s.backBtn} onClick={onBack}>Înapoi</button>
          </div>
        </div>

        {message && <div style={s.message}>{message}</div>}

        {/* Sezon/Etapă curentă — auto-detectate, cu opțiune manuală */}
        <section style={s.card}>
          <h2 style={s.cardTitle}>Sezon & etapă curentă</h2>
          {autoDetecting ? (
            <p style={s.hint}>Se detectează automat sezonul activ și etapa curentă…</p>
          ) : (
            <p style={s.autoLabel}>📍 {autoDetectedLabel || "Nimic detectat automat."}</p>
          )}
          <button style={s.linkBtn} onClick={() => setShowManualSelectors((v) => !v)}>
            {showManualSelectors ? "Ascunde selecția manuală" : "Schimbă sezon / etapă manual"}
          </button>

          {showManualSelectors && (
            <div style={{ marginTop: 12 }}>
              <select
                style={s.select}
                value={selectedSeasonId}
                onChange={(e) => setSelectedSeasonId(e.target.value)}
              >
                <option value="">— alege un sezon —</option>
                {seasons.map((s2) => (
                  <option key={s2.id} value={s2.id}>{s2.name}</option>
                ))}
              </select>

              {selectedSeasonId && (
                <select
                  style={s.select}
                  value={selectedGameweekId}
                  onChange={(e) => setSelectedGameweekId(e.target.value)}
                >
                  <option value="">— alege o etapă —</option>
                  {gameweeks.map((g) => (
                    <option key={g.id} value={g.id}>{g.title} · {g.status}</option>
                  ))}
                </select>
              )}

              {selectedSeasonId && (
                <button style={s.btn} disabled={loading} onClick={handleCreateNextGameweek}>
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
            </div>
          )}
        </section>

        {selectedGameweekId && (
          <>
            {matches.length > 0 && (
              <div style={s.searchBox}>
                <input
                  style={s.searchInput}
                  placeholder="Caută echipa…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            )}

            {/* 1. Rezultate reale */}
            {matches.length > 0 && (
              <section style={s.card}>
                <h2 style={s.cardTitle}>Rezultate reale</h2>
                <p style={s.hint}>Meciurile fără rezultat introdus apar primele.</p>
                <div style={s.matchList}>
                  {resultsOrderedMatches.map((m) => (
                    <MatchResultCard
                      key={m.id}
                      match={m}
                      onSave={(values) => handleSaveResult(m.id, values)}
                      disabled={currentGameweek?.status === "completed"}
                    />
                  ))}
                  {resultsOrderedMatches.length === 0 && (
                    <p style={s.hint}>Niciun meci nu corespunde căutării.</p>
                  )}
                </div>
              </section>
            )}

            {/* 2. Preview / Clasament live */}
            {matches.length > 0 && (
              <section style={s.card}>
                <h2 style={s.cardTitle}>Clasament live / Preview</h2>

                {currentGameweek?.status === "completed" && (
                  <div style={s.message}>Etapa e deja finalizată (status: completed) — clasamentul de mai jos e definitiv.</div>
                )}
                {currentGameweek?.status !== "completed" && previewRows && (
                  <div style={s.liveTag}>🔴 Clasament live — bonusurile de poziție sunt provizorii, se recalculează la fiecare rezultat nou.</div>
                )}

                <button style={s.btn} disabled={previewLoading} onClick={handlePreview}>
                  {previewLoading ? "Se calculează…" : "Calculează / Previzualizează clasamentul"}
                </button>

                {previewMessage && <div style={s.message}>{previewMessage}</div>}

                {previewRows && previewRows.length > 0 && (
                  <div style={s.previewTable}>
                    {previewRows.map((r) => (
                      <button
                        key={r.uid}
                        style={s.previewRow}
                        onClick={() => setOpenPlayerUid(r.uid)}
                        type="button"
                      >
                        <span style={s.previewRank}>#{r.rank}</span>
                        <span style={s.previewName}>{previewNicknames[r.uid] || r.uid}</span>
                        <span style={s.previewPts}>{r.pointsFromMatches}p</span>
                        <span style={{ ...s.previewBonus, color: r.rankingBonus >= 0 ? "#A9E0B8" : "#E08A82" }}>
                          {r.rankingBonus >= 0 ? "+" : ""}{r.rankingBonus}p
                        </span>
                        <span style={s.previewTotal}>{r.totalPoints}p</span>
                      </button>
                    ))}
                  </div>
                )}

                {previewRows && currentGameweek?.status !== "completed" && (
                  <button style={s.finalizeBtn} disabled={finalizing || previewIncomplete > 0} onClick={handleFinalize}>
                    {finalizing ? "Se finalizează…" : "Finalizează etapa"}
                  </button>
                )}
              </section>
            )}

            {/* 3. Meciuri & Meciurile Săptămânii (collapsible) */}
            <section style={s.card}>
              <button style={s.collapseHeader} onClick={() => setShowMatchList((v) => !v)} type="button">
                <h2 style={s.cardTitle}>Meciuri & Meciurile Săptămânii</h2>
                <span style={s.chevron}>{showMatchList ? "▲" : "▼"}</span>
              </button>

              {showMatchList && (
                <>
                  {deleteMessage && <div style={s.message}>{deleteMessage}</div>}

                  {filteredMatches.length > 0 && (
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
                  )}

                  {matches.length > 0 && (
                    <div style={s.featuredSaveBox}>
                      <p style={s.hint}>⭐ Meciurile Săptămânii: {featuredIds.length}/3 alese</p>
                      {featuredMessage && <div style={s.message}>{featuredMessage}</div>}
                      <button
                        style={s.btn}
                        disabled={featuredSaving || featuredIds.length !== 3}
                        onClick={handleSaveFeatured}
                      >
                        {featuredSaving ? "Se salvează…" : "Salvează Meciurile Săptămânii"}
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>

            {/* 4. Import meciuri (collapsible) */}
            <section style={s.card}>
              <button style={s.collapseHeader} onClick={() => setShowImport((v) => !v)} type="button">
                <h2 style={s.cardTitle}>Import meciuri</h2>
                <span style={s.chevron}>{showImport ? "▲" : "▼"}</span>
              </button>

              {showImport && (
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
              )}
            </section>
          </>
        )}
      </div>

      {openPlayerRow && (
        <PlayerBreakdownModal
          nickname={previewNicknames[openPlayerUid] || openPlayerUid}
          row={openPlayerRow}
          isOwn={true}
          onClose={() => setOpenPlayerUid("")}
        />
      )}
    </div>
  );
}

const s = {
  page: {
    minHeight: "100vh",
    background: "radial-gradient(ellipse at 50% -10%, #131A2E 0%, #080B14 60%)",
    padding: "24px 16px",
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
  },
  wrap: { maxWidth: 480, margin: "0 auto" },
  headerRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  headerBtns: { display: "flex", gap: 8 },
  title: { fontSize: 19, fontWeight: 800, color: "#F5F5F0", margin: 0 },
  backBtn: {
    background: "#0D1220", border: "1px solid #232B42", color: "#8B93A8",
    borderRadius: 10, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
  },
  resetBtn: {
    background: "rgba(181,69,61,0.12)", border: "1px solid rgba(181,69,61,0.4)", color: "#E08A82",
    borderRadius: 10, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
  },
  hint: { fontSize: 11.5, color: "#6B7390", lineHeight: 1.5, margin: "0 0 4px" },
  autoLabel: { fontSize: 13, color: "#E0BC4A", fontWeight: 700, margin: "0 0 8px" },
  linkBtn: {
    background: "none", border: "none", color: "#8B93A8", fontSize: 12,
    textDecoration: "underline", cursor: "pointer", padding: 0,
  },
  code: { color: "#A9E0B8", fontSize: 11 },
  textarea: {
    width: "100%", background: "#0D1220", border: "1px solid #232B42", borderRadius: 10,
    padding: "11px 12px", fontSize: 12.5, color: "#F5F5F0", outline: "none", resize: "vertical",
    fontFamily: "monospace",
  },
  message: {
    background: "rgba(63,168,92,0.12)", border: "1px solid rgba(63,168,92,0.35)",
    color: "#A9E0B8", borderRadius: 10, padding: "10px 14px", fontSize: 12.5, marginBottom: 16,
  },
  liveTag: {
    background: "rgba(181,69,61,0.10)", border: "1px solid rgba(181,69,61,0.3)",
    color: "#E08A82", borderRadius: 10, padding: "8px 12px", fontSize: 11.5, marginBottom: 12,
  },
  card: {
    background: "#12182B", border: "1px solid #232B42", borderRadius: 16,
    padding: "18px 16px", marginBottom: 16,
  },
  cardTitle: { fontSize: 14, fontWeight: 800, color: "#C9A227", margin: 0 },
  collapseHeader: {
    display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
    background: "none", border: "none", padding: 0, cursor: "pointer", marginBottom: 4,
  },
  chevron: { color: "#6B7390", fontSize: 12 },
  select: {
    width: "100%", background: "#0D1220", border: "1px solid #232B42", borderRadius: 10,
    padding: "11px 12px", fontSize: 13.5, color: "#F5F5F0", marginBottom: 10,
  },
  searchBox: { maxWidth: 480, margin: "0 auto 12px" },
  searchInput: {
    width: "100%", background: "#0D1220", border: "1px solid #232B42", borderRadius: 10,
    padding: "10px 14px", fontSize: 13.5, color: "#F5F5F0", outline: "none",
  },
  form: { display: "flex", flexDirection: "column", gap: 10 },
  row: { display: "flex", gap: 10 },
  input: {
    flex: 1, background: "#0D1220", border: "1px solid #232B42", borderRadius: 10,
    padding: "11px 12px", fontSize: 13.5, color: "#F5F5F0", outline: "none",
  },
  btn: {
    background: "linear-gradient(180deg, #E0BC4A, #C9A227)", color: "#0A0E1A", border: "none",
    borderRadius: 10, padding: "11px 0", fontSize: 13.5, fontWeight: 800, cursor: "pointer", marginTop: 2,
  },
  matchList: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 },
  featuredRow: {
    display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", flex: 1, minWidth: 0,
  },
  matchRowWithDelete: {
    display: "flex", alignItems: "flex-start", gap: 8,
  },
  deleteBtn: {
    flexShrink: 0, marginTop: 14, width: 34, height: 34, borderRadius: 10,
    background: "rgba(181,69,61,0.12)", border: "1px solid rgba(181,69,61,0.4)",
    color: "#E08A82", fontSize: 15, cursor: "pointer",
  },
  featuredCheckbox: { width: 20, height: 20, marginTop: 14, flexShrink: 0, accentColor: "#C9A227" },
  featuredSaveBox: { marginTop: 4, marginBottom: 14 },
  previewTable: { display: "flex", flexDirection: "column", gap: 6, marginTop: 12, marginBottom: 12 },
  previewRow: {
    display: "flex", alignItems: "center", gap: 8, background: "#0D1220",
    border: "1px solid #1c2338", borderRadius: 10, padding: "9px 12px", width: "100%",
    cursor: "pointer", textAlign: "left", fontFamily: "inherit",
  },
  previewRank: { fontSize: 12, fontWeight: 800, color: "#C9A227", width: 26, flexShrink: 0 },
  previewName: { fontSize: 13, fontWeight: 700, color: "#F5F5F0", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  previewPts: { fontSize: 12, color: "#8B93A8", flexShrink: 0 },
  previewBonus: { fontSize: 12, fontWeight: 700, flexShrink: 0, width: 46, textAlign: "right" },
  previewTotal: { fontSize: 13.5, fontWeight: 800, color: "#E0BC4A", flexShrink: 0, width: 52, textAlign: "right" },
  finalizeBtn: {
    width: "100%", background: "rgba(63,168,92,0.15)", border: "1px solid #3FA85C", color: "#A9E0B8",
    borderRadius: 10, padding: "12px 0", fontSize: 13.5, fontWeight: 800, cursor: "pointer",
  },
};
