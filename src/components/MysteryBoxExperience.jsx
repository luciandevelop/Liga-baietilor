import { useEffect, useState } from "react";
import {
  getMysteryBoxBoard, getAllMysteryBoxPicks, submitMysteryBoxPick,
} from "../services/surprisesService";
import { getUserPublicProfiles } from "../services/profilesService";
import { getMysteryBoxMessage } from "../feedContent/mysteryBoxContent";
import PlayerAvatar from "./PlayerAvatar";
import { color, font, radius } from "../matchdayTheme";

const VALUE_COLOR = { 0: "#5B6270", 20: "#8A6A3A", 30: "#8A6A3A", 40: "#8A6A3A", 50: "#3A6E8A", 75: "#6B3A8A", 100: "#D4AF37" };

// Componentă auto-suficientă (ca TriviaExperience/DiceExperience) — nu
// depinde de `profiles` din SurprisesScreen (construit acolo doar pentru
// participanții CUNOSCUȚI dinainte — Duel, Sabotaj etc.). La Mystery Box
// oricine poate alege orice cutie, deci lista de nume necesare nu se
// știe în avans — se ia singură, pe măsură ce apar alegeri noi.
export default function MysteryBoxExperience({ gameweekId, uid, allBoxesRevealed, resolved, myResult }) {
  const [board, setBoard] = useState(null); // array de 30 valori, sau null cât se încarcă
  const [picks, setPicks] = useState([]); // toate alegerile publice
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [pendingBox, setPendingBox] = useState(null); // index cutie în curs de confirmare
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [justPickedMessage, setJustPickedMessage] = useState(null); // { value, message } — popup personal

  async function refresh() {
    const [b, p] = await Promise.all([getMysteryBoxBoard(gameweekId), getAllMysteryBoxPicks(gameweekId)]);
    setBoard(b);
    setPicks(p);
    const uids = [...new Set(p.map((pick) => pick.uid))];
    if (uids.length > 0) {
      const newProfiles = await getUserPublicProfiles(uids);
      setProfiles((prev) => ({ ...prev, ...newProfiles }));
    }
    setLoading(false);
  }

  useEffect(() => { refresh(); }, [gameweekId]);

  if (loading || !board) return <div style={s.centerNote}>Se încarcă…</div>;

  const picksByBox = Object.fromEntries(picks.map((p) => [p.boxIndex, p]));
  const myPicks = picks.filter((p) => p.uid === uid).sort((a, b) => a.pickNumber - b.pickNumber);
  const myPickCount = myPicks.length;
  const myFinalPick = myPicks[myPicks.length - 1];
  const canPickMore = myPickCount < 2;

  async function handleConfirmPick() {
    if (pendingBox === null) return;
    setSubmitting(true);
    setError("");
    try {
      await submitMysteryBoxPick(gameweekId, uid, pendingBox);
      const value = board[pendingBox];
      setJustPickedMessage({ value, message: getMysteryBoxMessage(value) });
      setPendingBox(null);
      await refresh();
    } catch (err) {
      console.error("Eroare la alegerea cutiei:", err);
      setError(err.message || "Eroare — încearcă din nou.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={s.wrap}>
      <style>{`
        @keyframes boxPop { 0% { transform: scale(0.85); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes boxWiggle { 0%,100% { transform: rotate(0deg); } 25% { transform: rotate(-4deg); } 75% { transform: rotate(4deg); } }
      `}</style>

      <div style={s.header}>🎁 MYSTERY BOX</div>
      <div style={s.subheader}>
        {resolved
          ? "Etapa s-a încheiat — toate cutiile au fost dezvăluite."
          : myPickCount === 0
            ? "Alege o cutie. O poți schimba o singură dată, dar cutia veche rămâne pe numele tău."
            : myPickCount === 1
              ? `Ai luat ${board[myPicks[0].boxIndex]}p din cutia ${myPicks[0].boxIndex + 1}. Poți încerca din nou (risc — o pierzi definitiv) sau te oprești aici.`
              : "Ai folosit ambele alegeri — aștepți restul grupului."}
      </div>

      {myPickCount === 1 && !resolved && (
        <div style={s.decideBar}>
          <div style={s.decideValue}>
            Ai <b style={{ color: VALUE_COLOR[board[myPicks[0].boxIndex]] || "#fff" }}>{board[myPicks[0].boxIndex]}p</b> — o păstrezi sau riști alta?
          </div>
          <div style={s.decideBtnRow}>
            <span style={s.keepNote}>Pentru păstrat, nu mai apăsa nimic — alege altă cutie doar dacă vrei să riști.</span>
          </div>
        </div>
      )}

      <div style={s.grid}>
        {board.map((value, idx) => {
          const pick = picksByBox[idx];
          const isMine = pick?.uid === uid;
          const isClickable = !resolved && canPickMore && !pick;
          const showValue = !!pick || (allBoxesRevealed && !pick);

          return (
            <button
              key={idx}
              type="button"
              disabled={!isClickable}
              onClick={() => isClickable && setPendingBox(idx)}
              style={{
                ...s.box,
                ...(pick ? (isMine ? s.boxMine : s.boxTaken) : {}),
                ...(allBoxesRevealed && !pick ? s.boxUnclaimedRevealed : {}),
                ...(isClickable ? { animation: "boxWiggle 2.2s ease-in-out infinite" } : {}),
              }}
            >
              <span style={s.boxNum}>{idx + 1}</span>
              {pick ? (
                <>
                  <PlayerAvatar avatarId={profiles[pick.uid]?.avatarId} nickname={profiles[pick.uid]?.nickname} size={26} />
                  <span style={s.boxName}>{profiles[pick.uid]?.nickname || pick.uid}</span>
                  <span style={{ ...s.boxValue, color: VALUE_COLOR[value] || "#fff" }}>{value}p</span>
                  {pick.pickNumber === 1 && myPicks.length > 1 && pick.uid === uid && <span style={s.refusedTag}>rejucată</span>}
                </>
              ) : showValue ? (
                <span style={{ ...s.boxValue, color: VALUE_COLOR[value] || "#fff", opacity: 0.5 }}>{value}p</span>
              ) : (
                <span style={s.boxMystery}>🎁</span>
              )}
            </button>
          );
        })}
      </div>

      {error && <div style={s.errorText}>{error}</div>}

      {resolved && myResult?.bonusPoints != null && (
        <div style={s.finalResultCard}>
          <div style={s.finalResultLabel}>REZULTATUL TĂU</div>
          <div style={{ ...s.finalResultValue, color: VALUE_COLOR[myResult.bonusPoints] || "#fff" }}>{myResult.bonusPoints}p</div>
        </div>
      )}

      {pendingBox !== null && (
        <div style={s.modalOverlay} onClick={() => !submitting && setPendingBox(null)}>
          <div style={s.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalIcon}>🎁</div>
            <div style={s.modalText}>
              {myPickCount === 0
                ? `Alegi cutia ${pendingBox + 1}?`
                : `Riști cutia ${pendingBox + 1} — pierzi definitiv cele ${board[myPicks[0].boxIndex]}p pe care le aveai?`}
            </div>
            <div style={s.modalWarn}>Alegerea e definitivă. Nu se poate anula.</div>
            <div style={s.modalBtnRow}>
              <button type="button" style={s.modalCancelBtn} disabled={submitting} onClick={() => setPendingBox(null)}>Anulează</button>
              <button type="button" style={s.modalConfirmBtn} disabled={submitting} onClick={handleConfirmPick}>
                {submitting ? "Se deschide…" : "Deschide cutia"}
              </button>
            </div>
          </div>
        </div>
      )}

      {justPickedMessage && (
        <div style={s.modalOverlay} onClick={() => setJustPickedMessage(null)}>
          <div style={{ ...s.modalCard, animation: "boxPop 350ms ease" }} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalIcon}>🎉</div>
            <div style={{ ...s.finalResultValue, color: VALUE_COLOR[justPickedMessage.value] || "#fff", marginBottom: 10 }}>
              {justPickedMessage.value}p
            </div>
            <div style={s.messageText}>{justPickedMessage.message}</div>
            <button type="button" style={s.modalConfirmBtn} onClick={() => setJustPickedMessage(null)}>Am înțeles</button>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  wrap: { position: "relative" },
  centerNote: { textAlign: "center", fontSize: 12, color: color.textFaint, padding: "16px 0", fontFamily: font.body },

  header: { fontSize: 15, fontWeight: 800, color: color.textPrimary, textAlign: "center", fontFamily: font.display, marginBottom: 4 },
  subheader: { fontSize: 11.5, color: color.textSecondary, textAlign: "center", fontFamily: font.body, marginBottom: 12, lineHeight: 1.5 },

  decideBar: {
    background: "rgba(212,175,55,0.08)", border: `1px solid ${color.goldBorder}`, borderRadius: radius.md,
    padding: "10px 12px", marginBottom: 12, textAlign: "center",
  },
  decideValue: { fontSize: 12.5, color: color.textPrimary, fontFamily: font.body, marginBottom: 4 },
  decideBtnRow: {},
  keepNote: { fontSize: 10, color: color.textFaint, fontFamily: font.body },

  grid: { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 7 },
  box: {
    position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
    aspectRatio: "1 / 1", borderRadius: radius.sm, border: "1px solid rgba(212,175,55,0.25)",
    background: "rgba(212,175,55,0.05)", padding: 4, cursor: "pointer", minWidth: 0, overflow: "hidden",
  },
  boxNum: { position: "absolute", top: 2, left: 4, fontSize: 8, color: color.textFaint, fontFamily: font.body },
  boxMystery: { fontSize: 18 },
  boxMine: { background: "rgba(139,217,87,0.10)", border: "1px solid rgba(139,217,87,0.4)" },
  boxTaken: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", cursor: "default" },
  boxUnclaimedRevealed: { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", cursor: "default" },
  boxName: {
    fontSize: 8, fontWeight: 700, color: color.textPrimary, fontFamily: font.body, textAlign: "center",
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%",
  },
  boxValue: { fontSize: 11, fontWeight: 800, fontFamily: font.display },
  refusedTag: { position: "absolute", bottom: 2, fontSize: 6.5, color: "#F0555A", fontFamily: font.body },

  errorText: { fontSize: 11.5, color: "#F0555A", textAlign: "center", marginTop: 10, fontFamily: font.body },

  finalResultCard: {
    marginTop: 14, textAlign: "center", background: "rgba(212,175,55,0.08)", border: `1px solid ${color.goldBorder}`,
    borderRadius: radius.md, padding: "14px 12px",
  },
  finalResultLabel: { fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", color: color.textFaint, marginBottom: 4, fontFamily: font.body },
  finalResultValue: { fontSize: 24, fontWeight: 900, fontFamily: font.display },

  modalOverlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center",
    justifyContent: "center", zIndex: 1000, padding: 20,
  },
  modalCard: {
    width: "100%", maxWidth: 340, background: "linear-gradient(160deg, #241a10, #12161F)", border: `1px solid ${color.goldBorder}`,
    borderRadius: radius.lg, padding: "26px 20px", textAlign: "center", boxShadow: "0 0 40px -6px rgba(212,175,55,0.5)",
  },
  modalIcon: { fontSize: 32, marginBottom: 10 },
  modalText: { fontSize: 14, color: color.textPrimary, fontFamily: font.body, marginBottom: 8 },
  modalWarn: { fontSize: 11, color: "#E08A82", fontFamily: font.body, marginBottom: 18 },
  modalBtnRow: { display: "flex", gap: 10 },
  modalCancelBtn: {
    flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", color: color.textSecondary,
    borderRadius: radius.sm, padding: "11px 0", fontSize: 12.5, fontWeight: 700, fontFamily: font.body, cursor: "pointer",
  },
  modalConfirmBtn: {
    flex: 1.4, background: "linear-gradient(180deg, #E8C468, #C89B3C)", border: "none", color: "#1a1400",
    borderRadius: radius.sm, padding: "11px 0", fontSize: 12.5, fontWeight: 800, fontFamily: font.body, cursor: "pointer",
  },
  messageText: { fontSize: 13, color: color.textSecondary, fontFamily: font.body, lineHeight: 1.5, marginBottom: 18 },
};
