import { useState } from "react";
import { setLiveMinute, addMatchEvent, removeMatchEvent } from "../services/adminService";
import { processLiveMatchEvent } from "../services/feedService";
import { color, font, radius } from "../matchdayTheme";

export default function LiveEventPanel({ match }) {
  const [minuteInput, setMinuteInput] = useState(match.liveMinute ?? "");
  const [minuteSaving, setMinuteSaving] = useState(false);
  const [form, setForm] = useState(null); // { type: "goal"|"red_card" } | null
  const [team, setTeam] = useState("home");
  const [minute, setMinute] = useState("");
  const [player, setPlayer] = useState("");
  const [saving, setSaving] = useState(false);
  const [events, setEvents] = useState(match.matchEvents || []);

  async function handleSaveMinute() {
    const n = Number(minuteInput);
    if (!Number.isFinite(n) || n < 0) return;
    setMinuteSaving(true);
    try {
      await setLiveMinute(match.id, n);
    } catch (err) {
      console.error("Eroare la salvarea minutului:", err);
    } finally {
      setMinuteSaving(false);
    }
  }

  async function handleAddEvent() {
    const n = Number(minute);
    if (!Number.isFinite(n) || n < 0) return;
    setSaving(true);
    try {
      const event = await addMatchEvent(match.id, { type: form.type, team, minute: n, player: player.trim() || null });
      setEvents((prev) => [...prev, event]);
      // Scrie și în Feed — dată reală, introdusă acum de admin, nu inventată.
      await processLiveMatchEvent({ ...match, liveMinute: n }, event).catch((err) => console.error("Eroare Feed eveniment live:", err));
      setForm(null);
      setMinute("");
      setPlayer("");
    } catch (err) {
      console.error("Eroare la adăugarea evenimentului:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveEvent(eventId) {
    try {
      await removeMatchEvent(match.id, eventId);
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
    } catch (err) {
      console.error("Eroare la ștergerea evenimentului:", err);
    }
  }

  return (
    <div style={s.panel}>
      <div style={s.row}>
        <span style={s.label}>Minutul</span>
        <input
          type="number" min="0" style={s.minuteInput}
          value={minuteInput} onChange={(e) => setMinuteInput(e.target.value)}
        />
        <button type="button" style={s.smallBtn} disabled={minuteSaving} onClick={handleSaveMinute}>
          {minuteSaving ? "…" : "Salvează"}
        </button>
      </div>

      {events.length > 0 && (
        <div style={s.eventList}>
          {events.map((e) => (
            <div key={e.id} style={s.eventRow}>
              <span style={s.eventText}>
                {e.type === "goal" ? "⚽" : "🟥"} {e.player ? `${e.player} · ` : ""}
                {e.team === "home" ? match.homeTeam : match.awayTeam} · min. {e.minute}
              </span>
              <button type="button" style={s.removeBtn} onClick={() => handleRemoveEvent(e.id)}>✕</button>
            </div>
          ))}
        </div>
      )}

      {!form ? (
        <div style={s.addRow}>
          <button type="button" style={s.addBtn} onClick={() => setForm({ type: "goal" })}>⚽ Gol</button>
          <button type="button" style={s.addBtnRed} onClick={() => setForm({ type: "red_card" })}>🟥 Cartonaș roșu</button>
        </div>
      ) : (
        <div style={s.formBox}>
          <div style={s.formTitle}>{form.type === "goal" ? "Gol nou" : "Cartonaș roșu nou"}</div>
          <div style={s.formRow}>
            <select style={s.select} value={team} onChange={(e) => setTeam(e.target.value)}>
              <option value="home">{match.homeTeam}</option>
              <option value="away">{match.awayTeam}</option>
            </select>
            <input type="number" min="0" style={s.minuteInput} placeholder="Min." value={minute} onChange={(e) => setMinute(e.target.value)} />
          </div>
          <input style={s.playerInput} placeholder="Jucător (opțional)" value={player} onChange={(e) => setPlayer(e.target.value)} />
          <div style={s.formRow}>
            <button type="button" style={s.smallBtn} disabled={saving} onClick={handleAddEvent}>
              {saving ? "Se salvează…" : "Adaugă"}
            </button>
            <button type="button" style={s.cancelBtn} onClick={() => { setForm(null); setMinute(""); setPlayer(""); }}>Anulează</button>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  panel: {
    marginTop: -4, marginBottom: 10, padding: "10px 12px", borderRadius: radius.md,
    background: "rgba(220,38,38,0.05)", border: "1px solid rgba(220,38,38,0.25)",
  },
  row: { display: "flex", alignItems: "center", gap: 8 },
  label: { fontSize: 11, fontWeight: 700, color: color.textFaint, fontFamily: font.body },
  minuteInput: {
    width: 56, background: "rgba(255,255,255,0.05)", border: `1px solid ${color.border}`, borderRadius: 6,
    padding: "6px 8px", fontSize: 12, color: color.textPrimary, fontFamily: font.body,
  },
  smallBtn: {
    background: "rgba(212,175,55,0.12)", border: "1px solid rgba(212,175,55,0.4)", color: color.goldLight,
    borderRadius: 6, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: font.body,
  },
  eventList: { display: "flex", flexDirection: "column", gap: 5, marginTop: 8 },
  eventRow: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    background: "rgba(255,255,255,0.03)", borderRadius: 6, padding: "5px 8px",
  },
  eventText: { fontSize: 11, color: color.textSecondary, fontFamily: font.body },
  removeBtn: { background: "none", border: "none", color: color.textFaint, cursor: "pointer", fontSize: 11 },
  addRow: { display: "flex", gap: 8, marginTop: 8 },
  addBtn: {
    flex: 1, background: "rgba(255,255,255,0.04)", border: `1px solid ${color.border}`, color: color.textSecondary,
    borderRadius: 6, padding: "7px 0", fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: font.body,
  },
  addBtnRed: {
    flex: 1, background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.3)", color: "#F0555A",
    borderRadius: 6, padding: "7px 0", fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: font.body,
  },
  formBox: { marginTop: 8, padding: 10, background: "rgba(0,0,0,0.2)", borderRadius: 8 },
  formTitle: { fontSize: 11, fontWeight: 700, color: color.textPrimary, marginBottom: 8, fontFamily: font.body },
  formRow: { display: "flex", gap: 8, marginBottom: 8 },
  select: {
    flex: 1, background: "rgba(255,255,255,0.05)", border: `1px solid ${color.border}`, borderRadius: 6,
    padding: "6px 8px", fontSize: 11.5, color: color.textPrimary, fontFamily: font.body,
  },
  playerInput: {
    width: "100%", background: "rgba(255,255,255,0.05)", border: `1px solid ${color.border}`, borderRadius: 6,
    padding: "7px 10px", fontSize: 12, color: color.textPrimary, fontFamily: font.body, marginBottom: 8, boxSizing: "border-box",
  },
  cancelBtn: {
    background: "none", border: `1px solid ${color.border}`, color: color.textFaint,
    borderRadius: 6, padding: "6px 12px", fontSize: 11, cursor: "pointer", fontFamily: font.body,
  },
};
