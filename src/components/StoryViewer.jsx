import { useEffect, useRef, useState } from "react";
import { color, font } from "../matchdayTheme";

const SLIDE_DURATION_MS = 6000;

// ══════════════════════════════════════════════════════════════════
// StoryViewer — full-screen, fără header/bottom nav (randat separat,
// în afara navigației normale — vezi App.jsx). Nu salvează progres
// intermediar — un Story reînceput pornește mereu de la slide 1.
// "Văzut" se marchează STRICT la finalul ultimului slide, o dată,
// via onComplete (apelantul face scrierea reală pe users/{uid}).
// ══════════════════════════════════════════════════════════════════
export default function StoryViewer({ slideUrls, onClose, onComplete, onOpenArchive, onOpenLeaderboard, isSeasonStory = false }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1, progresul slide-ului curent
  const [reachedEnd, setReachedEnd] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const startRef = useRef(null);
  const rafRef = useRef(null);
  const completedRef = useRef(false);

  const total = slideUrls.length;

  useEffect(() => {
    setProgress(0);
    setImgLoaded(false);
    if (index >= total - 1 && reachedEnd) return; // ultimul slide, deja oprit acolo
    startRef.current = null;

    function tick(ts) {
      if (paused) { rafRef.current = requestAnimationFrame(tick); return; }
      if (startRef.current == null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const p = Math.min(1, elapsed / SLIDE_DURATION_MS);
      setProgress(p);
      if (p >= 1) {
        if (index < total - 1) {
          setIndex((i) => i + 1);
        } else {
          setReachedEnd(true);
          if (!completedRef.current) { completedRef.current = true; onComplete?.(); }
        }
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, paused]);

  function goNext() {
    if (index < total - 1) { setIndex((i) => i + 1); }
    else {
      setReachedEnd(true);
      if (!completedRef.current) { completedRef.current = true; onComplete?.(); }
    }
  }
  function goPrev() {
    if (reachedEnd) { setReachedEnd(false); return; } // revino pe ultimul slide, nu inchide
    if (index > 0) setIndex((i) => i - 1);
  }

  return (
    <div style={s.overlay}>
      <div style={s.progressRow}>
        {slideUrls.map((_, i) => (
          <div key={i} style={s.progressTrack}>
            <div style={{
              ...s.progressFill,
              width: i < index || (i === index && reachedEnd) ? "100%" : i === index ? `${progress * 100}%` : "0%",
            }} />
          </div>
        ))}
      </div>

      <button type="button" style={s.closeBtn} onClick={onClose} aria-label="Închide">✕</button>

      <div style={s.imageWrap}>
        {!imgLoaded && <div style={s.imageSkeleton} />}
        <img
          src={slideUrls[index]}
          alt=""
          style={{ ...s.image, opacity: imgLoaded ? 1 : 0 }}
          onLoad={() => setImgLoaded(true)}
          draggable={false}
        />
        {/* preload discret pentru urmatorul slide */}
        {index < total - 1 && <link rel="preload" as="image" href={slideUrls[index + 1]} />}
      </div>

      {!reachedEnd && (
        <div style={s.tapZones}>
          <div
            style={s.tapLeft} onClick={goPrev}
            onMouseDown={() => setPaused(true)} onMouseUp={() => setPaused(false)}
            onTouchStart={() => setPaused(true)} onTouchEnd={() => setPaused(false)}
          />
          <div
            style={s.tapRight} onClick={goNext}
            onMouseDown={() => setPaused(true)} onMouseUp={() => setPaused(false)}
            onTouchStart={() => setPaused(true)} onTouchEnd={() => setPaused(false)}
          />
        </div>
      )}

      {reachedEnd && (
        <div style={s.endActions}>
          <button type="button" style={s.endBtnPrimary} onClick={onOpenLeaderboard}>🏆 Vezi Clasamentul</button>
          <button type="button" style={s.endBtnSecondary} onClick={onOpenArchive}>📖 Poveștile PLAY LEAGUE</button>
        </div>
      )}

      {isSeasonStory && <div style={s.seasonTag}>🏆 Povestea sezonului</div>}
    </div>
  );
}

const s = {
  overlay: { position: "fixed", inset: 0, background: "#000", zIndex: 9999, display: "flex", flexDirection: "column" },
  progressRow: { display: "flex", gap: 4, padding: "10px 10px 0", zIndex: 3 },
  progressTrack: { flex: 1, height: 2.5, borderRadius: 2, background: "rgba(255,255,255,0.25)", overflow: "hidden" },
  progressFill: { height: "100%", background: color.goldLight, transition: "width 60ms linear" },
  closeBtn: {
    position: "absolute", top: 18, right: 12, zIndex: 4, width: 40, height: 40, borderRadius: 20,
    background: "rgba(0,0,0,0.35)", border: "none", color: "#fff", fontSize: 16, cursor: "pointer",
  },
  imageWrap: { position: "relative", flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  imageSkeleton: { position: "absolute", inset: 0, background: "#0A0D14" },
  image: { maxWidth: "100%", maxHeight: "100%", objectFit: "contain", transition: "opacity 150ms ease" },
  tapZones: { position: "absolute", inset: 0, display: "flex", zIndex: 2 },
  tapLeft: { width: "35%", height: "100%", cursor: "pointer" },
  tapRight: { width: "65%", height: "100%", cursor: "pointer" },
  endActions: {
    position: "absolute", left: 0, right: 0, bottom: 28, zIndex: 4,
    display: "flex", flexDirection: "column", gap: 10, padding: "0 20px",
  },
  endBtnPrimary: {
    padding: "13px 0", borderRadius: 14, border: "none", background: color.goldLight,
    color: "#12141C", fontWeight: 700, fontSize: 14, fontFamily: font.body, cursor: "pointer",
  },
  endBtnSecondary: {
    padding: "13px 0", borderRadius: 14, border: "1px solid rgba(255,255,255,0.3)", background: "rgba(0,0,0,0.35)",
    color: "#fff", fontWeight: 600, fontSize: 13.5, fontFamily: font.body, cursor: "pointer",
  },
  seasonTag: {
    position: "absolute", top: 18, left: 12, zIndex: 4, background: "rgba(212,175,55,0.18)",
    border: `1px solid ${color.gold}`, borderRadius: 20, padding: "4px 10px", color: color.goldLight,
    fontSize: 10.5, fontWeight: 700, fontFamily: font.body,
  },
};
