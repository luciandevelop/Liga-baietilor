import { useState } from "react";
import { getMatchPredictions } from "../services/adminService";
import { getUserPublicProfiles } from "../services/profilesService";
import PlayerAvatar from "./PlayerAvatar";
import { color, font, radius } from "../matchdayTheme";

// Randată STRICT pe meciuri deja blocate (verificat de apelant, dar
// oricum garantat de firestore.rules — o interogare înainte de blocare
// ar întoarce permission-denied, niciodată date). Deschisă/închisă la
// cerere — nu se încarcă nimic până nu apeși.
export default function FriendsPredictions({ matchId, currentUid, homeTeam, awayTeam }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null); // { rows, consensus }
  const [profiles, setProfiles] = useState({});

  async function handleToggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (data) return; // deja încărcat, nu mai cerem Firestore a doua oară
    setLoading(true);
    setError("");
    try {
      const result = await getMatchPredictions(matchId);
      setData(result);
      const p = await getUserPublicProfiles(result.rows.map((r) => r.userId));
      setProfiles(p);
    } catch (err) {
      console.error("Eroare la încărcarea pronosticurilor:", err);
      setError("Nu s-au putut încărca — meciul poate să nu fie încă blocat.");
    } finally {
      setLoading(false);
    }
  }

  const total = data?.rows.length || 0;

  return (
    <div style={s.wrap}>
      <button type="button" style={s.toggleBtn} onClick={handleToggle}>
        <span>👥 Vezi pronosticurile prietenilor{total > 0 ? ` (${total})` : ""}</span>
        <span style={{ ...s.chevron, transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
      </button>

      {open && (
        <div style={s.body}>
          {loading && <div style={s.centerNote}>Se încarcă…</div>}
          {error && <div style={s.centerNote}>{error}</div>}

          {data && data.rows.length === 0 && (
            <div style={s.centerNote}>Niciun pronostic salvat pentru acest meci.</div>
          )}

          {data && data.rows.length > 0 && (
            <>
              <div style={s.consensusRow}>
                <div style={s.consensusItem}>
                  <span style={s.consensusCount}>{data.consensus.home}</span>
                  <span style={s.consensusLabel}>{homeTeam}</span>
                </div>
                <div style={s.consensusItem}>
                  <span style={s.consensusCount}>{data.consensus.draw}</span>
                  <span style={s.consensusLabel}>Egal</span>
                </div>
                <div style={s.consensusItem}>
                  <span style={s.consensusCount}>{data.consensus.away}</span>
                  <span style={s.consensusLabel}>{awayTeam}</span>
                </div>
              </div>

              <div style={s.list}>
                {data.rows
                  .slice()
                  .sort((a, b) => (a.userId === currentUid ? -1 : b.userId === currentUid ? 1 : 0))
                  .map((r) => {
                    const isMe = r.userId === currentUid;
                    return (
                      <div key={r.userId} style={{ ...s.row, ...(isMe ? s.rowMe : {}) }}>
                        <PlayerAvatar avatarId={profiles[r.userId]?.avatarId} nickname={profiles[r.userId]?.nickname} size={26} />
                        <span style={{ ...s.rowName, ...(isMe ? { color: color.goldLight, fontWeight: 800 } : {}) }}>
                          {profiles[r.userId]?.nickname || r.userId}
                        </span>
                        <span style={s.rowScore}>{r.scoreA} – {r.scoreB}</span>
                        <span style={s.rowMeta}>
                          C:{r.corners ?? "–"} · Ct:{r.cards ?? "–"}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const s = {
  wrap: { marginTop: 10 },
  toggleBtn: {
    display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
    background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.35)", borderRadius: radius.sm,
    padding: "9px 12px", cursor: "pointer", fontSize: 11.5, fontWeight: 700, color: color.goldLight, fontFamily: font.body,
  },
  chevron: { color: color.goldLight, fontSize: 11, transition: "transform 200ms ease" },
  body: { marginTop: 8 },
  centerNote: { textAlign: "center", fontSize: 11, color: color.textFaint, padding: "10px 0", fontFamily: font.body },

  consensusRow: {
    display: "flex", gap: 6, marginBottom: 8, background: color.surface,
    border: `1px solid ${color.borderSubtle}`, borderRadius: radius.sm, padding: "9px 6px",
  },
  consensusItem: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 },
  consensusCount: { fontSize: 16, fontWeight: 800, color: color.goldLight, fontFamily: font.display },
  consensusLabel: {
    fontSize: 9, color: color.textFaint, fontWeight: 600, textAlign: "center",
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%",
  },

  list: { display: "flex", flexDirection: "column", gap: 5 },
  row: {
    display: "flex", alignItems: "center", gap: 8, background: color.surface,
    border: `1px solid ${color.borderSubtle}`, borderRadius: radius.sm, padding: "7px 10px",
  },
  rowMe: { border: `1px solid ${color.goldBorder}`, background: color.goldBg },
  rowName: {
    flex: 1, fontSize: 11.5, fontWeight: 600, color: color.textPrimary, fontFamily: font.body,
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
  },
  rowScore: { fontSize: 13.5, fontWeight: 800, color: color.textPrimary, fontFamily: font.display, flexShrink: 0 },
  rowMeta: { fontSize: 9.5, color: color.textFaint, fontFamily: font.body, flexShrink: 0, minWidth: 62, textAlign: "right" },
};
