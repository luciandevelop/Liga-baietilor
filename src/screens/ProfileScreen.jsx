import { useState } from "react";
import { logout } from "../services/authService";
import { updateOwnAvatar } from "../services/profilesService";
import { parseAvatarId, getAvatarPackVariants } from "../assets/avatars";
import { color, font, radius, shadow } from "../matchdayTheme";
import PlayerAvatar from "../components/PlayerAvatar";

export default function ProfileScreen({ user, profile, isAdmin, onOpenAdmin, onBack }) {
  const [avatarId, setAvatarId] = useState(profile?.avatarId || null);
  const [saving, setSaving] = useState(null); // avatarId în curs de salvare, sau null
  const [error, setError] = useState("");

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
          <div style={s.nickname}>{profile?.nickname || "Jucător"}</div>
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
