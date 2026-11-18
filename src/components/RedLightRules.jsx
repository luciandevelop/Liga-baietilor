import { useState } from "react";
import { RL_POINTS_TABLE, RL_LOCK_MINUTES, RL_FINISH_STEPS, RL_MAX_STRIKES } from "../services/redLightEngine";

// ══════════════════════════════════════════════════════════════════
// 🚦 Ghid interactiv „Lumină roșie, lumină verde” — pentru pagina de Reguli.
// Doar text și desene, fără Firestore. Se vede DOAR când jucătorul
// deschide secțiunea din Reguli (nu apare în joc / în show).
// Cifrele vin direct din motor (redLightEngine.js) → nu pot rămâne în urmă.
// ══════════════════════════════════════════════════════════════════

const F = "'Oswald','Arial Narrow',system-ui,sans-serif";

export default function RedLightGuide() {
  const [i, setI] = useState(0);
  const pts = Object.entries(RL_POINTS_TABLE);
  const pages = [
    { t: "1 · ALEGI LA FIECARE MECI", body: (
      <>
        <p style={x.p}>În Surprize → Lumină roșie vezi toate meciurile etapei, în ordine. La fiecare meci alegi:</p>
        <div style={x.match}>
          <div style={x.mTop}>5/20 · sâmbătă 19:30 · pronosticul tău <b>2-1</b></div>
          <div style={x.mTeams}>ARSENAL – CHELSEA</div>
          <div style={x.mBtns}><span style={{ ...x.b, ...x.bOn }}>🟢 AVANSEZ</span><span style={x.b}>⚪ STAU</span></div>
        </div>
        <p style={x.p}><b>AVANSEZ</b> = mergi pe pronosticul tău de la meciul ăla. <b>STAU</b> = nu riști nimic.</p>
        <p style={x.small}>Alegerea se blochează cu {RL_LOCK_MINUTES} de minute înainte de start, ca pronosticurile. Fără alegere = STAU. AVANSEZ fără pronostic valid = STAU.</p>
      </>) },
    { t: "2 · REZULTATUL DECIDE", body: (
      <>
        <div style={x.rule}><span style={x.ic}>⭐</span><span><b>Scor exact</b><br />+2 pași</span></div>
        <div style={x.rule}><span style={x.ic}>✅</span><span><b>1X2 corect</b> (doar câștigătorul / egalul)<br />+1 pas</span></div>
        <div style={x.rule}><span style={x.ic}>❌</span><span><b>Greșit</b> — te prinde păpușa<br />pierzi o viață, pașii rămân</span></div>
        <div style={x.rule}><span style={x.ic}>⚪</span><span><b>Ai stat</b><br />nimic nu se schimbă</span></div>
        <p style={x.small}>Jokerul și Meciul Săptămânii nu contează aici. Meci amânat sau anulat = fără pași, fără greșeli.</p>
      </>) },
    { t: `3 · ${RL_MAX_STRIKES} VIEȚI · ${RL_FINISH_STEPS} PAȘI`, body: (
      <>
        <p style={x.p}><span style={{ color: "#ff4057", fontSize: 20 }}>♥ ♥ ♥</span> — ai {RL_MAX_STRIKES} vieți. <b>A {RL_MAX_STRIKES}-a greșeală te elimină</b> și pierzi tot (0 PCT).</p>
        <p style={x.p}>🏁 <b>{RL_FINISH_STEPS} pași = FINISHER · {RL_POINTS_TABLE[RL_FINISH_STEPS]} PCT</b></p>
        <p style={x.small}>Punctele după câți pași ai la final (sau când te oprești):</p>
        <div style={x.pts}>{pts.map(([s, v]) => <span key={s} style={x.pt}><b>{s}</b> pași<br />{v} PCT</span>)}</div>
        <p style={x.small}>Sub 7 pași = 0 PCT. Cine nu e eliminat își păstrează la final punctele pașilor.</p>
      </>) },
    { t: "4 · MĂ OPRESC", body: (
      <>
        <p style={x.p}>Poți apăsa <b>🛑 MĂ OPRESC</b>: devii <b style={{ color: "#5dffd2" }}>SAFE</b> și păstrezi punctele pașilor făcuți până atunci. Nu mai riști nimic la meciurile următoare.</p>
        <p style={x.p}>Butonul merge doar când nu ai niciun meci cu AVANSEZ deja blocat și încă nevalidat. Oprirea e <b>definitivă</b>.</p>
        <p style={x.small}>Riști pentru {RL_POINTS_TABLE[RL_FINISH_STEPS]} PCT sau te oprești cu ce ai? Asta e toată tensiunea jocului.</p>
      </>) },
    { t: "5 · SHOW-UL", body: (
      <>
        <p style={x.p}>După ce meciurile sunt validate, Adminul pornește show-ul. Pentru fiecare meci:</p>
        <p style={x.p}>🎵 păpușa cântă cu spatele<br />👀 se întoarce și scanează terenul<br />🟢 <b>Lumină verde</b> — cine a nimerit face pașii în față<br />🔴 <b>Lumină roșie</b> — cine a greșit e prins</p>
        <p style={x.small}>În show, butonul 🗺 HARTA arată oricând pașii, viețile și alegerile fiecăruia. Show-ul se poate revedea din ecranul jocului.</p>
      </>) },
  ];
  const pg = pages[i];
  return (
    <div style={x.panel}>
      <div style={x.kick}>CUM SE JOACĂ · {i + 1}/{pages.length}</div>
      <div style={x.title}>{pg.t}</div>
      <div style={x.body}>{pg.body}</div>
      <div style={x.dots}>{pages.map((_, k) => <button key={k} type="button" aria-label={`Pagina ${k + 1}`} onClick={() => setI(k)} style={{ ...x.dot, ...(k === i ? x.dotOn : {}) }} />)}</div>
      <div style={x.nav}>
        <button type="button" style={{ ...x.navB, opacity: i ? 1 : 0.35 }} disabled={!i} onClick={() => setI(i - 1)}>‹ Înapoi</button>
        <button type="button" style={{ ...x.navB, ...x.navP, opacity: i < pages.length - 1 ? 1 : 0.35 }} disabled={i >= pages.length - 1} onClick={() => setI(i + 1)}>Următorul ›</button>
      </div>
    </div>
  );
}

const x = {
  panel: { background: "#10141c", border: "1px solid rgba(255,255,255,.12)", borderRadius: 14, padding: 14, color: "#e8edf5", marginBottom: 10 },
  kick: { fontSize: 10, letterSpacing: ".2em", color: "#ff5a6a", fontWeight: 700 },
  title: { fontFamily: F, fontSize: 20, fontWeight: 700, margin: "4px 0 10px", color: "#fff" },
  body: { minHeight: 240 },
  p: { fontSize: 14, lineHeight: 1.45, margin: "0 0 10px" },
  small: { fontSize: 12, color: "#9aa3b5", lineHeight: 1.4, margin: "0 0 8px" },
  match: { background: "#161d2b", border: "1px solid #2a3348", borderRadius: 12, padding: 10, margin: "4px 0 12px" },
  mTop: { fontSize: 11, color: "#9aa3b5" },
  mTeams: { fontFamily: F, fontSize: 18, fontWeight: 700, margin: "4px 0 8px", color: "#fff" },
  mBtns: { display: "flex", gap: 8 },
  b: { flex: 1, textAlign: "center", padding: "8px 0", borderRadius: 10, border: "1px solid #3a4560", fontWeight: 800, fontSize: 13, color: "#c9cfdd" },
  bOn: { background: "rgba(47,191,154,.18)", borderColor: "#2fbf9a", color: "#7dffbd" },
  rule: { display: "flex", gap: 12, alignItems: "center", background: "#161d2b", borderRadius: 10, padding: "9px 12px", marginBottom: 8, fontSize: 14, lineHeight: 1.35 },
  ic: { fontSize: 24, width: 30, textAlign: "center" },
  pts: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, margin: "4px 0 8px" },
  pt: { background: "#161d2b", borderRadius: 8, padding: "6px 2px", fontSize: 11, textAlign: "center", lineHeight: 1.3 },
  dots: { display: "flex", justifyContent: "center", gap: 6, margin: "8px 0 4px" },
  dot: { width: 8, height: 8, borderRadius: 4, border: "none", background: "rgba(255,255,255,.2)", padding: 0 },
  dotOn: { background: "#d81f3c", width: 20 },
  nav: { display: "flex", gap: 10, marginTop: 8 },
  navB: { flex: 1, padding: "11px 0", borderRadius: 12, border: "1px solid #3a4560", background: "transparent", color: "#e8edf5", fontWeight: 800, fontSize: 14 },
  navP: { background: "#d81f3c", borderColor: "#d81f3c", color: "#fff" },
};
