import { useEffect, useState } from "react";

// ── Motion System — Liga Băieților ───────────────────────────────────────
// Sursă unică pentru durate și curbe. Nicio componentă nu hardcodează ms
// sau cubic-bezier direct — importă de aici, ca toate animațiile din
// aplicație să respire în același ritm.
//
// REGULI OBLIGATORII (impuse aici, respectate de fiecare componentă):
// - se animă DOAR transform / opacity / (filter, static, niciodată în
//   buclă) — niciodată height/width/top/left/margin/padding;
// - box-shadow NU se animă niciodată în buclă (poate apărea/dispărea o
//   singură dată la mount, atât);
// - orice animație respectă prefers-reduced-motion — vezi
//   usePrefersReducedMotion() mai jos; când e activ, componentele trebuie
//   să sară direct la starea finală, fără tranziție;
// - maximum O animație HERO simultană pe ecran — asta e o regulă de
//   COMPOZIȚIE (cum se folosesc componentele într-un ecran), nu ceva ce
//   o primitivă poate impune singură; se respectă în Fazele următoare,
//   când compunem ecranele.

export const DURATION = {
  instant: 80, // press/tap feedback
  fast: 150, // hover, schimbări mici de stare
  base: 220, // enter/exit standard (carduri, rânduri)
  slow: 400, // count-up, rise-trail la urcare în clasament
  hero: 600, // momente rare: fluierul, linia de centru, finalizare etapă
};

export const EASING = {
  // Ieșire lină, fără efect de arc — pentru enter/exit standard.
  out: "cubic-bezier(0.16, 1, 0.3, 1)",
  // Simetrică, pentru tranziții de stare (hover/press).
  inOut: "cubic-bezier(0.4, 0, 0.2, 1)",
  // UN SINGUR loc unde se permite un mic "overshoot" — count-up de puncte
  // și flip de cifre, ca senzația să fie vie, nu mecanică rece. Folosită
  // cu maximă zgârcenie, niciodată pe elemente mari/frecvente.
  overshoot: "cubic-bezier(0.34, 1.56, 0.64, 1)",
};

// Verificare directă (non-reactivă) — utilă în cod care nu e component
// React (ex. decizia dacă pornim deloc o animație imperativă).
export function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Hook reactiv — folosit în componente ca să decidă între tranziție
// completă și "sari direct la final". Se actualizează dacă userul
// schimbă setarea de sistem în timp ce aplicația e deschisă.
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(prefersReducedMotion);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e) => setReduced(e.matches);
    mq.addEventListener ? mq.addEventListener("change", handler) : mq.addListener(handler);
    return () => {
      mq.removeEventListener ? mq.removeEventListener("change", handler) : mq.removeListener(handler);
    };
  }, []);

  return reduced;
}

// Helper: durata efectivă de folosit într-un style/CSS — 0 dacă userul a
// cerut reduced motion, altfel valoarea cerută. Simplifică fiecare
// componentă la `transitionDuration: ms(DURATION.base, reduced)`.
export function ms(duration, reduced) {
  return reduced ? 0 : duration;
}
