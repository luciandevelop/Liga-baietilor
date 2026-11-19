import { useEffect, useRef, useState } from "react";
import HsLoading from "../hideseek/HsLoading";
import { createStage } from "../hideseek/hsStage";
import { roleOf } from "../hideseek/hsWorld";
import { getAvatarUrl, s3Promise } from "../assets/avatars";

// ══════════════════════════════════════════════════════════════════
// 🚪 ASCUNSELEA — scena (ecran complet). Înlocuiește vechiul HideSeekShow3D.
// kind: "draw" | "duel" | "pick" | "cinema" | "titles" | "card"
// Nu scrie nimic în Firebase: alegerile le salvează părintele prin onSubmit(hide, seek).
// ══════════════════════════════════════════════════════════════════
const pad3 = (n) => (n === null || n === undefined || n === "" || !Number.isFinite(Number(n)) ? "" : String(n).padStart(3, "0"));
function letterAvatar(nick) {
  try { const c = document.createElement("canvas"); c.width = c.height = 160; const g = c.getContext("2d"); const gr = g.createLinearGradient(0, 0, 160, 160); gr.addColorStop(0, "#ff3d8b"); gr.addColorStop(1, "#3d2a6e"); g.fillStyle = gr; g.fillRect(0, 0, 160, 160); g.fillStyle = "#fff"; g.font = "700 90px system-ui"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText((nick || "?").charAt(0).toUpperCase(), 80, 88); return c.toDataURL("image/png"); } catch (e) { return ""; }
}
export function resolvePlayer(p) { const num = pad3(p?.number ?? p?.num); return { nick: p?.nick || "?", num, av: getAvatarUrl(p?.avatarId) || letterAvatar(p?.nick), role: roleOf(Number(num) || 99), bald: !!p?.bald }; }
export const resolvePlayers = (players) => Object.fromEntries(Object.entries(players || {}).map(([u, p]) => [u, resolvePlayer(p)]));

export default function HideSeekStage({ kind, data, title, onClose, onSubmit }) {
  const ref = useRef(null);
  const [ready, setReady] = useState(false);
  const cb = useRef({ onClose, onSubmit }); cb.current = { onClose, onSubmit };
  useEffect(() => {
    let st = null; let alive = true;
    const prevOverflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    s3Promise.catch(() => {}).then(() => {
      if (!alive || !ref.current) return;
      st = createStage(ref.current, { title, onClose: () => cb.current.onClose?.() }); setReady(true);
      const players = resolvePlayers(data?.players);
      if (kind === "draw") st.draw({ players, pairs: data.pairs || [], bye: data.bye || null });
      else if (kind === "duel") st.duel({ A: players[data.pair.a], B: players[data.pair.b], picks: data.picks || {}, closed: !!data.closed, from: data.fromTurn || 1, to: data.toTurn || 5, key: data.key || "duel" });
      else if (kind === "pick") st.pick({ me: players[data.uid], side: data.side, turn: data.turn, onSubmit: (h, s) => cb.current.onSubmit?.(h, s) }).then(() => { if (alive) cb.current.onClose?.(); });
      else if (kind === "cinema" || kind === "titles") st.cinema({ players, pairs: data.pairs || [], bye: data.bye || null, byPair: data.byPair || {}, closed: !!data.closed, gw: data.gw || "gw", onlyTitles: kind === "titles" });
      else if (kind === "card") st.openCard({ ...data.card, A: resolvePlayer(data.card.A), B: resolvePlayer(data.card.B) });
    });
    return () => { alive = false; st?.destroy(); document.body.style.overflow = prevOverflow; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <>{!ready && <HsLoading />}<div ref={ref} /></>;
}
