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
  finalizeGameweek,
  getUserNicknames,
} from "../services/adminService";
import MatchCard from "../components/MatchCard";
import MatchResultCard from "../components/MatchResultCard";

export default function AdminScreen({ onBack }) {
  const [seasons, setSeasons] = useState([]);
  const [gameweeks, setGameweeks] = useState([]);
  const [matches, setMatches] = useState([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState("");
  const [selectedGameweekId, setSelectedGameweekId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [seasonName, setSeasonName] = useState("");
  const [seasonStart, setSeasonStart] = useState("");
  const [seasonEnd, setSeasonEnd] = useState("");

  const [matchesText, setMatchesText] = useState("");

  const [featuredIds, setFeaturedIds] = useState([]);
  const [featuredSaving, setFeaturedSaving] = useState(false);
  const [featuredMessage, setFeaturedMessage] = useState("");

  const [deletingMatchId, setDeletingMatchId] = useState("");
  const [deleteMessage, setDeleteMessage] = useState("");

  const [previewRows, setPreviewRows] = useState(null);
  const [previewIncomplete, setPreviewIncomplete] = useState(0);
  const [previewNicknames, setPreviewNicknames] = useState({});
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewMessage, setPreviewMessage] = useState("");
  const [finalizing, setFinalizing] = useState(false);

  async function refreshSeasons() {
    const data = await listSeasons();
    setSeasons(data);
  }

  async function refreshGameweeks(seasonId) {
    if (!seasonId) return setGameweeks([]);
    const data = await listGameweeks(seasonId);
    setGameweeks(data);
  }

  async function refreshMatches(gameweekId) {
    if (!gameweekId) return setMatches([]);
    const data = await listMatches(gameweekId);
    setMatches(data);
  }

  useEffect(() => {
    refreshSeasons();
  }, []);

  useEffect(() => {
    refreshGameweeks(selectedSeasonId);
    setSelectedGameweekId("");
  }, [selectedSeasonId]);

  useEffect(() => {
    refreshMatches(selectedGameweekId);
    const gw = gameweeks.find((g) => g.id === selectedGameweekId);
    setFeaturedIds(gw?.featuredMatchIds || []);
    setFeaturedMessage("");
    setPreviewRows(null);
    setPreviewIncomplete(0);
    setPreviewMessage("");
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

    // Pasul 1: creează SAU deschide etapa săptămânii — rezultatul ăsta e
    // sursa adevărului pentru "a mers sau nu a mers" crearea etapei.
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

    // Pasul 2: doar reîncarcă lista vizuală de etape. Dacă asta pică,
    // etapa tot s-a creat/deschis corect la pasul 1 — nu suprascriem
    // mesajul de succes cu o eroare de-a lui, doar o adăugăm distinct.
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
  }

  async function handlePreview() {
    setPreviewLoading(true);
    setPreviewMessage("");
    try {
      const result = await previewGameweekResults(selectedGameweekId);
      setPreviewRows(result.rows);
      setPreviewIncomplete(result.incompleteMatchIds.length);
      const names = await getUserNicknames(result.rows.map((r) => r.uid));
      setPreviewNicknames(names);
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

        {/* Sezon */}
        <section style={s.card}>
          <h2 style={s.cardTitle}>1. Sezon</h2>
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

          <form onSubmit={handleCreateSeason} style={s.form}>
            <input style={s.input} placeholder="Nume sezon (ex: Sezon 2026/27)" value={seasonName} onChange={(e) => setSeasonName(e.target.value)} />
            <div style={s.row}>
              <input style={s.input} type="date" value={seasonStart} onChange={(e) => setSeasonStart(e.target.value)} />
              <input style={s.input} type="date" value={seasonEnd} onChange={(e) => setSeasonEnd(e.target.value)} />
            </div>
            <button style={s.btn} disabled={loading} type="submit">+ Sezon nou</button>
          </form>
        </section>

        {/* Etapă */}
        {selectedSeasonId && (
          <section style={s.card}>
            <h2 style={s.cardTitle}>2. Etapă</h2>
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

            <button style={s.btn} disabled={loading} onClick={handleCreateNextGameweek}>
              Creează / deschide etapa săptămânii
            </button>
          </section>
        )}

        {/* Meciuri */}
        {selectedGameweekId && (
          <section style={s.card}>
            <h2 style={s.cardTitle}>3. Meciuri</h2>

            {deleteMessage && <div style={s.message}>{deleteMessage}</div>}

            {matches.length > 0 && (
              <div style={s.matchList}>
                {matches.map((m) => (
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
                <p style={s.hint}>
                  ⭐ Meciurile Săptămânii: {featuredIds.length}/3 alese
                </p>
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
          </section>
        )}

        {/* Rezultate */}
        {selectedGameweekId && matches.length > 0 && (
          <section style={s.card}>
            <h2 style={s.cardTitle}>4. Rezultate reale</h2>
            <div style={s.matchList}>
              {matches.map((m) => (
                <MatchResultCard
                  key={m.id}
                  match={m}
                  onSave={(values) => handleSaveResult(m.id, values)}
                  disabled={currentGameweek?.status === "completed"}
                />
              ))}
            </div>
          </section>
        )}

        {/* Clasament etapă + finalizare */}
        {selectedGameweekId && matches.length > 0 && (
          <section style={s.card}>
            <h2 style={s.cardTitle}>5. Clasament etapă</h2>

            {currentGameweek?.status === "completed" && (
              <div style={s.message}>Etapa e deja finalizată (status: completed).</div>
            )}

            <button style={s.btn} disabled={previewLoading} onClick={handlePreview}>
              {previewLoading ? "Se calculează…" : "Calculează / Previzualizează clasamentul"}
            </button>

            {previewMessage && <div style={s.message}>{previewMessage}</div>}

            {previewRows && previewRows.length > 0 && (
              <div style={s.previewTable}>
                {previewRows.map((r) => (
                  <div key={r.uid} style={s.previewRow}>
                    <span style={s.previewRank}>#{r.rank}</span>
                    <span style={s.previewName}>{previewNicknames[r.uid] || r.uid}</span>
                    <span style={s.previewPts}>{r.pointsFromMatches}p</span>
                    <span style={{ ...s.previewBonus, color: r.rankingBonus >= 0 ? "#A9E0B8" : "#E08A82" }}>
                      {r.rankingBonus >= 0 ? "+" : ""}{r.rankingBonus}p
                    </span>
                    <span style={s.previewTotal}>{r.totalPoints}p</span>
                  </div>
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
      </div>
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
  card: {
    background: "#12182B", border: "1px solid #232B42", borderRadius: 16,
    padding: "18px 16px", marginBottom: 16,
  },
  cardTitle: { fontSize: 14, fontWeight: 800, color: "#C9A227", margin: "0 0 12px" },
  select: {
    width: "100%", background: "#0D1220", border: "1px solid #232B42", borderRadius: 10,
    padding: "11px 12px", fontSize: 13.5, color: "#F5F5F0", marginBottom: 14,
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
  matchRow: {
    display: "flex", justifyContent: "space-between", background: "#0D1220",
    border: "1px solid #1c2338", borderRadius: 10, padding: "9px 12px", fontSize: 13, color: "#E8E4D8",
  },
  matchMeta: { color: "#5A6280", fontSize: 11.5 },
  previewTable: { display: "flex", flexDirection: "column", gap: 6, marginTop: 12, marginBottom: 12 },
  previewRow: {
    display: "flex", alignItems: "center", gap: 8, background: "#0D1220",
    border: "1px solid #1c2338", borderRadius: 10, padding: "9px 12px",
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
