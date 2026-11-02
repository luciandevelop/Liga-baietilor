import { useEffect, useState } from "react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { getAvatarUrl, isS3Avatar } from "../assets/avatars";
import { getSeasonNumbers, formatPlayerNumber } from "../services/seasonNumbersService";

// ══════════════════════════════════════════════════════════════════
// 🦑 Intro-ul Sezonului 3 „SCAPĂ CINE POATE” — o singură dată per jucător.
// Apare doar după ce Adminul a aplicat avatarele Squid Game (avatarId „s3/…”).
// Confirmarea se salvează în Firestore: seasonIntro/{uid} = { s3: true }.
// În Admin se poate testa oricând (preview), fără să salveze nimic.
// ══════════════════════════════════════════════════════════════════
export const RANK_INFO = (n) =>
  n === 1 ? { title: "THE LEADER", sub: "Front Man", col: "#F5C451" }
  : n <= 4 ? { title: "THE PRETENDERS", sub: "VIP", col: "#F5C451" }
  : n <= 10 ? { title: "THE GUARDS", sub: "Gardian", col: "#ff2d7a" }
  : { title: "THE NOBODIES", sub: "Jucător", col: "#2FBF9A" };

export default function SeasonIntro({ uid, avatarId, nickname, preview = false, onClose }) {
  const [show, setShow] = useState(preview);
  // numărul: din avatar („s3/11” → 11), confirmat apoi din numerele înghețate
  const [num, setNum] = useState(isS3Avatar(avatarId) ? parseInt(avatarId.split("/")[1], 10) : null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    let alive = true;
    getSeasonNumbers().then((d) => { if (alive && d?.numbers?.[uid]) setNum(d.numbers[uid]); }).catch(() => {});
    if (!preview && uid && isS3Avatar(avatarId)) {
      getDoc(doc(db, "seasonIntro", uid)).then((s) => { if (alive && !(s.exists() && s.data().s3)) setShow(true); }).catch(() => {});
    }
    return () => { alive = false; };
  }, [uid, avatarId, preview]);

  useEffect(() => {
    if (!show) return undefined;
    const t = [setTimeout(() => setStep(1), 1900), setTimeout(() => setStep(2), 3600), setTimeout(() => setStep(3), 5200)];
    return () => t.forEach(clearTimeout);
  }, [show]);

  if (!show) return null;
  const n = Number(num) || null;
  const r = n ? RANK_INFO(n) : { title: "", sub: "", col: "#fff" };
  const url = getAvatarUrl(avatarId);

  async function close() {
    setShow(false);
    if (!preview) { try { await setDoc(doc(db, "seasonIntro", uid), { s3: true, at: serverTimestamp() }); } catch { /* reapare data viitoare */ } }
    onClose?.();
  }

  return (
    <div style={st.wrap} onClick={() => step < 3 && setStep(3)}>
      <style>{`
        @keyframes siShape { 0%{opacity:0;transform:scale(.6)} 30%{opacity:1;transform:scale(1.08)} 100%{opacity:.9;transform:scale(1)} }
        @keyframes siFlick { 0%,100%{opacity:1} 45%{opacity:.35} 50%{opacity:1} 70%{opacity:.6} }
        @keyframes siTitle { 0%{opacity:0;letter-spacing:.6em;filter:blur(6px)} 100%{opacity:1;letter-spacing:.12em;filter:blur(0)} }
        @keyframes siRise { 0%{opacity:0;transform:translateY(40px) scale(.94)} 100%{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes siBeam { 0%{opacity:0} 100%{opacity:1} }
        @keyframes siNum { 0%{opacity:0;transform:scale(1.8)} 60%{opacity:1;transform:scale(.96)} 100%{transform:scale(1)} }
      `}</style>
      {step < 2 && (
        <div style={st.shapes}>
          {["○", "△", "□"].map((c, i) => (
            <span key={c} style={{ ...st.shape, animation: `siShape .7s ${i * 0.35}s both, siFlick 2.4s ${1.2 + i * 0.2}s infinite` }}>{c}</span>
          ))}
        </div>
      )}
      {step >= 1 && step < 2 && <div style={{ ...st.title, animation: "siTitle 1.2s both" }}>SCAPĂ CINE POATE</div>}
      {step >= 2 && (
        <div style={st.reveal}>
          <div style={{ ...st.beam, animation: "siBeam 1s both" }} />
          <div style={{ ...st.portrait, animation: "siRise 1.1s cubic-bezier(.2,.8,.2,1) both" }}>
            {url ? <img src={url} alt="" style={st.img} /> : <div style={st.noImg}>{(nickname || "?").charAt(0)}</div>}
          </div>
          {n && <div style={{ ...st.num, color: r.col, animation: "siNum .8s .5s both" }}>{formatPlayerNumber(n)}</div>}
          <div style={{ ...st.rank, color: r.col, animation: "siTitle 1s .9s both" }}>{r.title}</div>
          <div style={{ ...st.nick, animation: "siTitle 1s 1.2s both" }}>{nickname}</div>
          {step >= 3 && <button type="button" style={st.btn} onClick={(e) => { e.stopPropagation(); close(); }}>INTRĂ ÎN JOC</button>}
        </div>
      )}
      {step < 3 && <button type="button" style={st.skip} onClick={(e) => { e.stopPropagation(); setStep(3); }}>Sari ›</button>}
    </div>
  );
}

const st = {
  wrap: { position: "fixed", inset: 0, zIndex: 5000, background: "radial-gradient(circle at 50% 30%, #1a0610 0%, #050206 70%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden", fontFamily: "Oswald, 'Arial Narrow', sans-serif", color: "#fff", padding: "env(safe-area-inset-top,0px) 16px env(safe-area-inset-bottom,0px)" },
  shapes: { display: "flex", gap: 22, marginBottom: 18 },
  shape: { fontSize: 64, lineHeight: 1, color: "#ff2d7a", textShadow: "0 0 18px #ff2d7a, 0 0 42px rgba(255,45,122,.6)", fontWeight: 300 },
  title: { fontSize: "clamp(28px,9vw,44px)", fontWeight: 700, color: "#fff", textShadow: "0 0 24px rgba(255,45,122,.8)", textAlign: "center" },
  reveal: { position: "relative", display: "flex", flexDirection: "column", alignItems: "center" },
  beam: { position: "absolute", top: -260, width: 320, height: 640, background: "linear-gradient(180deg, rgba(255,246,230,.28), rgba(255,246,230,0) 75%)", clipPath: "polygon(42% 0, 58% 0, 100% 100%, 0 100%)", pointerEvents: "none" },
  portrait: { width: "min(62vw, 250px)", aspectRatio: "600 / 840", borderRadius: 16, overflow: "hidden", border: "2px solid rgba(255,255,255,.18)", boxShadow: "0 20px 60px rgba(0,0,0,.7), 0 0 40px rgba(255,45,122,.35)", background: "#111" },
  img: { width: "100%", height: "100%", objectFit: "cover" },
  noImg: { width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 80, color: "#555" },
  num: { marginTop: 14, fontSize: "clamp(46px,14vw,70px)", fontWeight: 700, lineHeight: 1, textShadow: "0 0 24px currentColor" },
  rank: { marginTop: 4, fontSize: 20, fontWeight: 700, letterSpacing: ".12em" },
  nick: { marginTop: 4, fontSize: 15, color: "#cfd8dc", letterSpacing: ".08em" },
  btn: { marginTop: 22, minWidth: 220, minHeight: 50, borderRadius: 14, border: "1px solid #ff2d7a", background: "rgba(255,45,122,.18)", color: "#fff", fontFamily: "inherit", fontSize: 18, fontWeight: 700, letterSpacing: ".14em" },
  skip: { position: "absolute", right: 16, bottom: "calc(env(safe-area-inset-bottom,0px) + 18px)", background: "transparent", border: "none", color: "rgba(255,255,255,.55)", fontSize: 14 },
};
