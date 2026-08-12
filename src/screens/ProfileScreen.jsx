import { useEffect, useRef, useState } from "react";
import { logout, claimNickname, validateNickname, isNicknameAvailable } from "../services/authService";
import { updateOwnAvatar } from "../services/profilesService";
import { parseAvatarId, getAvatarPackVariants } from "../assets/avatars";
import { color, font, radius, shadow } from "../matchdayTheme";
import PlayerAvatar from "../components/PlayerAvatar";

const CHECK_DEBOUNCE_MS = 450;

export default function ProfileScreen({ user, profile, isAdmin, onOpenAdmin, onBack }) {
  const [avatarId, setAvatarId] = useState(profile?.avatarId || null);
  const [saving, setSaving] = useState(null); // avatarId în curs de salvare, sau null
  const [error, setError] = useState("");

  // Schimbare nickname — refolosește STRICT aceeași verificare de
  // disponibilitate ca pickerul inițial (claimNickname/validateNickname/
  // isNicknameAvailable din authService.js), nu o reimplementez separat.
  // Necesar pentru useri cu cont mai vechi (dinainte de picker) sau care
  // au ales din greșeală numele real în loc de un nickname — acum au o
  // cale de-a reveni asupra alegerii, fără să depindă de Admin.
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameValue, setNicknameValue] = useState(profile?.nickname || "");
  const [nickCheckState, setNickCheckState] = useState("idle"); // idle | checking | available | taken | invalid | same
  const [nickSaving, setNickSaving] = useState(false);
  const [nickError, setNickError] = useState("");
  const nickDebounceRef = useRef(null);
  const currentNickname = profile?.nickname || "";

  useEffect(() => {
    if (!editingNickname) return;
    clearTimeout(nickDebounceRef.current);
    const trimmed = nicknameValue.trim();
    if (!trimmed) { setNickCheckState("idle"); return; }
    if (trimmed === currentNickname) { setNickCheckState("same"); return; }
    const localErr = validateNickname(trimmed);
    if (localErr) { setNickCheckState("invalid"); return; }
    setNickCheckState("checking");
    nickDebounceRef.current = setTimeout(async () => {
      try {
        const ok = await isNicknameAvailable(trimmed, user.uid);
        setNickCheckState(ok ? "available" : "taken");
      } catch (err) {
        console.error(err);
        setNickCheckState("idle");
      }
    }, CHECK_DEBOUNCE_MS);
    return () => clearTimeout(nickDebounceRef.current);
  }, [nicknameValue, editingNickname, user.uid, currentNickname]);

  async function handleSaveNickname() {
    if (nickCheckState !== "available" || nickSaving) return;
    setNickSaving(true);
    setNickError("");
    try {
      await claimNickname(user.uid, nicknameValue);
      setEditingNickname(false);
    } catch (err) {
      console.error("Eroare la schimbarea nickname-ului:", err);
      setNickError(err.message || "Nu s-a putut salva.");
    } finally {
      setNickSaving(false);
    }
  }

  const parsed = parseAvatarId(avatarId);
  const variants = parsed ? getAvatarPackVariants(parsed.pack) : [];

  async function handlePick(candidateId) {
    if (candidateId === avatarId || saving) return;
    const previous = avatarId;
    setAvatarId(candidateId); // optimist — apare instant peste tot, cerut explicit
    setSaving(candidateId);
    setError("");
    try {
      await updateOwnAvatar(user.uid, candidateId);
    } catch (err) {
      console.error("Eroare la salvarea avatarului:", err);
      setAvatarId(previous); // revenim dacă scrierea a eșuat
      setError("Nu s-a putut salva avatarul. Încearcă din nou.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div style={s.page}>
      <div style={s.wrap}>
        <div style={s.head}>
          <button type="button" onClick={onBack} style={s.backBtn} aria-label="Înapoi">‹</button>
          <div style={s.headTitle}>Profil</div>
        </div>

        <div style={s.heroCard}>
          <PlayerAvatar avatarId={avatarId} nickname={profile?.nickname} size={84} />

          {!editingNickname ? (
            <div style={s.nicknameRow}>
              <div style={s.nickname}>{profile?.nickname || "Jucător"}</div>
              <button
                type="button"
                onClick={() => { setNicknameValue(profile?.nickname || ""); setNickCheckState("idle"); setNickError(""); setEditingNickname(true); }}
                style={s.changeNickBtn}
              >
                Schimbă
              </button>
            </div>
          ) : (
            <div style={s.nickEditWrap}>
              <input
                style={{
                  ...s.nickInput,
                  borderColor: nickCheckState === "taken" || nickCheckState === "invalid" ? "#F0555A" : nickCheckState === "available" ? color.greenBorder : color.border,
                }}
                value={nicknameValue}
                onChange={(e) => setNicknameValue(e.target.value)}
                maxLength={20}
                autoFocus
                disabled={nickSaving}
              />
              {nickCheckState === "checking" && <span style={{ ...s.nickStatus, color: color.textFaint }}>Verific disponibilitatea…</span>}
              {nickCheckState === "available" && <span style={{ ...s.nickStatus, color: color.green }}>✓ Disponibil</span>}
              {nickCheckState === "taken" && <span style={{ ...s.nickStatus, color: "#F0555A" }}>✕ Deja folosit</span>}
              {nickCheckState === "invalid" && <span style={{ ...s.nickStatus, color: "#F0555A" }}>{validateNickname(nicknameValue)}</span>}
              {nickError && <span style={{ ...s.nickStatus, color: "#F0555A" }}>{nickError}</span>}
              <div style={s.nickBtnRow}>
                <button type="button" onClick={() => setEditingNickname(false)} disabled={nickSaving} style={s.nickCancelBtn}>Renunță</button>
                <button
                  type="button"
                  onClick={handleSaveNickname}
                  disabled={nickCheckState !== "available" || nickSaving}
                  style={{ ...s.nickSaveBtn, opacity: nickCheckState !== "available" || nickSaving ? 0.5 : 1 }}
                >
                  {nickSaving ? "Se salvează…" : "Salvează"}
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={s.sectionLabel}>Alege avatarul</div>
        {variants.length > 0 ? (
          <div style={s.grid}>
            {variants.map((v) => {
              const active = v.avatarId === avatarId;
              return (
                <button
                  key={v.avatarId}
                  type="button"
                  onClick={() => handlePick(v.avatarId)}
                  disabled={saving !== null}
                  style={{ ...s.variantBtn, border: `2px solid ${active ? color.gold : "transparent"}` }}
                >
                  <img src={v.url} alt={`Variantă ${v.index}`} style={s.variantImg} />
                  {active && <span style={s.activeCheck}>✓</span>}
                  {saving === v.avatarId && <span style={s.savingOverlay}>…</span>}
                </button>
              );
            })}
          </div>
        ) : (
          <div style={s.emptyNote}>
            Nu ai încă un pachet de avataruri alocat — scrie-i lui Lu ca să ți-l seteze din Admin.
          </div>
        )}
        {error && <div style={s.error}>{error}</div>}

        <div style={s.sectionLabel}>Cont</div>
        <div style={s.accountCard}>
          {isAdmin && (
            <button type="button" onClick={onOpenAdmin} style={s.accountItem}>⚙️ Panou Admin</button>
          )}
          <button type="button" onClick={logout} style={{ ...s.accountItem, color: "#E5534B" }}>Deconectează-te</button>
        </div>
      </div>
    </div>
  );
}

const s = {
  page: { minHeight: "100vh", background: color.bgBase, paddingBottom: 40 },
  wrap: { maxWidth: 480, margin: "0 auto", padding: "16px 16px 0" },

  head: { display: "flex", alignItems: "center", gap: 12, marginBottom: 20 },
  backBtn: {
    width: 32, height: 32, borderRadius: "50%", background: color.surfaceElevated, border: `1px solid ${color.border}`,
    color: color.textPrimary, fontSize: 18, cursor: "pointer", flexShrink: 0,
  },
  headTitle: { fontFamily: font.display, fontSize: 19, fontWeight: 700, color: color.textPrimary },

  heroCard: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
    background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.lg,
    padding: "26px 16px", marginBottom: 22, boxShadow: shadow.card,
  },
  nickname: { fontFamily: font.display, fontSize: 18, fontWeight: 700, color: color.textPrimary },
  nicknameRow: { display: "flex", alignItems: "center", gap: 8 },
  changeNickBtn: {
    background: "none", border: `1px solid ${color.border}`, borderRadius: 999, padding: "3px 10px",
    fontSize: 10.5, fontWeight: 700, color: color.textFaint, cursor: "pointer", fontFamily: font.body,
  },
  nickEditWrap: { width: "100%", display: "flex", flexDirection: "column", gap: 6 },
  nickInput: {
    width: "100%", background: color.surfaceInset, border: "1px solid", borderRadius: radius.sm,
    padding: "11px 12px", fontSize: 15, color: color.textPrimary, fontFamily: font.body, outline: "none", textAlign: "center",
  },
  nickStatus: { fontSize: 11, fontWeight: 700, fontFamily: font.body, textAlign: "center" },
  nickBtnRow: { display: "flex", gap: 8, marginTop: 2 },
  nickCancelBtn: {
    flex: 1, background: "none", border: `1px solid ${color.border}`, borderRadius: radius.sm,
    padding: "9px 0", fontSize: 12.5, fontWeight: 700, color: color.textSecondary, cursor: "pointer", fontFamily: font.body,
  },
  nickSaveBtn: {
    flex: 1, background: color.goldGradient, border: "none", borderRadius: radius.sm,
    padding: "9px 0", fontSize: 12.5, fontWeight: 800, color: color.goldOn, cursor: "pointer", fontFamily: font.body,
  },

  sectionLabel: {
    fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase",
    color: color.textFaint, marginBottom: 10, fontFamily: font.body,
  },
  grid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 8 },
  variantBtn: {
    position: "relative", borderRadius: radius.md, overflow: "hidden", padding: 0, cursor: "pointer",
    background: color.surfaceInset, aspectRatio: "1 / 1",
  },
  variantImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  activeCheck: {
    position: "absolute", top: 6, right: 6, width: 20, height: 20, borderRadius: "50%",
    background: color.gold, color: color.goldOn, fontSize: 12, fontWeight: 800,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  savingOverlay: {
    position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", color: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
  },
  emptyNote: {
    fontSize: 12.5, color: color.textSecondary, background: color.surfaceInset, border: `1px solid ${color.border}`,
    borderRadius: radius.sm, padding: "12px 14px", marginBottom: 8, lineHeight: 1.5, fontFamily: font.body,
  },
  error: { fontSize: 11.5, color: "#F0555A", marginBottom: 8, fontFamily: font.body },

  accountCard: {
    background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.lg, overflow: "hidden", marginBottom: 20,
  },
  accountItem: {
    display: "block", width: "100%", textAlign: "left", background: "none", border: "none",
    borderBottom: `1px solid ${color.borderSubtle}`, color: color.textPrimary, fontSize: 13.5, fontWeight: 600,
    padding: "14px 16px", cursor: "pointer", fontFamily: font.body,
  },
};
