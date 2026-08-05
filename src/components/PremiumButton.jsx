import { useState } from "react";
import { color, font, radius } from "../matchdayTheme";
import { DURATION, EASING, usePrefersReducedMotion, ms } from "../motion";

const TONE_GRADIENTS = {
  gold: { grad: color.goldMetalGradient, on: "#241B05", glow: "rgba(212,175,55,0.4)" },
  green: { grad: "linear-gradient(180deg,#B7FBD1 0%, #7FF0AE 30%, #3ED98D 62%, #1D8A55 100%)", on: "#0A2013", glow: "rgba(62,217,141,0.4)" },
};

export default function PremiumButton({ children, onClick, disabled, type = "button", tone = "gold", style }) {
  const reduced = usePrefersReducedMotion();
  const [pressed, setPressed] = useState(false);
  const t = TONE_GRADIENTS[tone] || TONE_GRADIENTS.gold;

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <div
        aria-hidden="true"
        style={{
          position: "absolute", left: "6%", right: "6%", bottom: -9, height: 16,
          background: `radial-gradient(ellipse, ${t.glow}, transparent 72%)`, filter: "blur(8px)", zIndex: 0,
          opacity: disabled ? 0 : 1,
        }}
      />
      <button
        type={type}
        onClick={onClick}
        disabled={disabled}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
        style={{
          position: "relative", zIndex: 1, display: "block", width: "100%", height: 56,
          border: "none", borderRadius: radius.lg, cursor: disabled ? "default" : "pointer",
          fontFamily: font.body, fontSize: 14.5, fontWeight: 800, letterSpacing: "0.01em",
          color: t.on, background: t.grad, overflow: "hidden",
          opacity: disabled ? 0.5 : 1,
          boxShadow:
            "inset 0 1.5px 0 rgba(255,255,255,0.55)," +
            "inset 0 -8px 12px -4px rgba(0,0,0,0.35)," +
            "0 1px 0 rgba(0,0,0,0.25)," +
            `0 18px 30px -10px ${t.glow},` +
            "0 4px 12px rgba(0,0,0,0.4)",
          transform: pressed && !disabled ? "scale(0.965)" : "scale(1)",
          transition: `transform ${ms(DURATION.instant, reduced)}ms ${EASING.inOut}`,
        }}
      >
        {children}
        {!reduced && !disabled && (
          <span
            aria-hidden="true"
            style={{
              position: "absolute", top: 0, bottom: 0, width: "36%", left: "-55%",
              background: "linear-gradient(100deg, transparent, rgba(255,255,255,0.5), transparent)",
              animation: "liga-cta-shimmer 3.2s ease-in-out infinite",
            }}
          />
        )}
      </button>
      <style>{`@keyframes liga-cta-shimmer { 0% { left:-55%; } 40%,100% { left:130%; } }`}</style>
    </div>
  );
}
