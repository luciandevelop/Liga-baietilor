import { color, blur } from "../matchdayTheme";
import { usePrefersReducedMotion } from "../motion";

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E\")";

// Fundal cinematic — placeholder premium 100% CSS până avem o fotografie
// reală de stadion licențiată. Straturi, de jos în sus:
//  1. bază navy-negru (sau `photoUrl`, când există)
//  2. siluetă de tribună (rânduri de puncte întunecate) — opțional, `crowd`
//  3. două reflectoare radiale calde (floodlights)
//  4. fum/ceață — două straturi mari, blurate, care derivă foarte lent
//     (transform + opacity, GPU-friendly, respectă prefers-reduced-motion)
//  5. ploaie discretă — opțional, `rain` (streak-uri fine, nu stropi)
//  6. grain fin (texturi SVG turbulence, static)
//  7. vignetă — întunecă marginile, concentrează atenția pe centru
//  8. overlay de contrast peste fotografie (dacă există), pentru lizibilitate text
// `photoUrl`: un singur prop de adăugat când există poză reală — restul
// straturilor rămân neschimbate deasupra ei.
export default function CinematicBackdrop({ photoUrl, intensity = 1, crowd = true, rain = false, children, style }) {
  const reduced = usePrefersReducedMotion();

  return (
    <div
      style={{
        position: "relative",
        isolation: "isolate",
        overflow: "hidden",
        background: photoUrl ? `url(${photoUrl}) center/cover no-repeat` : color.bgBase,
        ...style,
      }}
    >
      {crowd && (
        <>
          <div
            aria-hidden="true"
            style={{
              position: "absolute", top: 0, left: 0, right: 0, height: "16%", zIndex: 0, opacity: 0.6,
              backgroundImage: "repeating-linear-gradient(90deg, rgba(0,0,0,0.5) 0 3px, rgba(20,22,28,0.35) 3px 6px)",
              WebkitMaskImage: "linear-gradient(180deg, #000 0%, #000 40%, transparent 100%)",
              maskImage: "linear-gradient(180deg, #000 0%, #000 40%, transparent 100%)",
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: "absolute", top: "3%", left: 0, right: 0, height: "10%", zIndex: 0, opacity: 0.4,
              backgroundImage: "repeating-linear-gradient(90deg, rgba(240,212,136,0.05) 0 2px, transparent 2px 9px)",
            }}
          />
        </>
      )}

      {/* reflector stânga */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute", top: "-12%", left: "-15%", width: "75%", height: "58%",
          background: `radial-gradient(ellipse at top left, rgba(232,199,102,${0.12 * intensity}), transparent 65%)`,
          filter: `blur(${blur.glow})`, pointerEvents: "none", zIndex: 0,
        }}
      />
      {/* reflector dreapta */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute", top: "-12%", right: "-15%", width: "75%", height: "58%",
          background: `radial-gradient(ellipse at top right, rgba(212,175,55,${0.10 * intensity}), transparent 65%)`,
          filter: `blur(${blur.glow})`, pointerEvents: "none", zIndex: 0,
        }}
      />

      {/* fum / ceață — două straturi, derivă lent, opacitate mică */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute", inset: "-20%", zIndex: 0, pointerEvents: "none",
          background:
            "radial-gradient(ellipse 55% 40% at 30% 70%, rgba(255,255,255,0.05), transparent 70%)," +
            "radial-gradient(ellipse 45% 35% at 75% 60%, rgba(255,255,255,0.035), transparent 70%)",
          filter: "blur(30px)",
          animation: reduced ? "none" : "liga-smoke-drift-1 26s ease-in-out infinite",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute", inset: "-20%", zIndex: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse 60% 45% at 60% 85%, rgba(255,255,255,0.03), transparent 70%)",
          filter: "blur(36px)",
          animation: reduced ? "none" : "liga-smoke-drift-2 34s ease-in-out infinite",
        }}
      />

      {/* ploaie discretă — streak-uri fine, nu stropi; câteva, nu ecran plin */}
      {rain && !reduced && (
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
          {[
            { left: "12%", h: 16, dur: "2.1s", delay: ".1s" },
            { left: "27%", h: 13, dur: "1.7s", delay: ".6s" },
            { left: "41%", h: 18, dur: "2.4s", delay: ".2s" },
            { left: "63%", h: 14, dur: "1.9s", delay: ".9s" },
            { left: "78%", h: 17, dur: "2.2s", delay: ".4s" },
            { left: "88%", h: 12, dur: "1.6s", delay: ".7s" },
          ].map((r, i) => (
            <div
              key={i}
              style={{
                position: "absolute", left: r.left, top: 0, width: 1, height: r.h,
                background: "linear-gradient(180deg, transparent, rgba(180,205,255,0.32))",
                animation: `liga-rain-fall ${r.dur} linear infinite`, animationDelay: r.delay,
              }}
            />
          ))}
        </div>
      )}

      {/* grain fin, static */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
          backgroundImage: GRAIN, opacity: 0.025, mixBlendMode: "overlay",
        }}
      />

      {/* vignetă */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
          background: `radial-gradient(ellipse at 50% 30%, transparent 38%, ${color.bgDeep}D9 100%)`,
        }}
      />

      {/* contrast peste fotografie reală, dacă există */}
      {photoUrl && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
            background: "linear-gradient(180deg, rgba(5,7,11,0.55) 0%, rgba(5,7,11,0.78) 100%)",
          }}
        />
      )}

      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>

      <style>{`
        @keyframes liga-smoke-drift-1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(3%, -2%) scale(1.05); }
        }
        @keyframes liga-smoke-drift-2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-4%, 2%) scale(1.04); }
        }
        @keyframes liga-rain-fall {
          from { transform: translateY(-60px); }
          to { transform: translateY(140px); }
        }
      `}</style>
    </div>
  );
}
