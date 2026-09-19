import { useState } from "react";
import { Stage, ShootoutSequence, usePreloadPenaltyAssets } from "../components/PenaltyExperience";
import { computePenaltyDuel } from "../services/surprisesService";
import PageHeader from "../components/PageHeader";
import { color, font, radius } from "../matchdayTheme";

// ══════════════════════════════════════════════════════════════════
// ⚽ PENALTY PvP — Admin Preview / MOCK.
// Reutilizează 100%: Stage, ShootoutSequence, computePenaltyDuel() —
// exact motorul/animațiile reale. ZERO Firestore.
//
// Scenariile rapide de mai jos există STRICT în acest Preview — nu
// ating jocul real, nu apar jucătorilor, nu schimbă motorul. Doar
// construiesc un `data` cu prima lovitură forțată la scenariul cerut,
// ca să poți verifica rapid GOL/APĂRAT pe fiecare zonă fără să aștepți
// tot ciclul de 10 alegeri.
// ══════════════════════════════════════════════════════════════════
const ZONES = ["left", "center", "right"];
function randomZone() { return ZONES[Math.floor(Math.random() * ZONES.length)]; }
function randomFive() { return Array.from({ length: 5 }, randomZone); }

const DEBUG_SCENARIOS = [
  { id: "goal-left", label: "GOL — stânga", shot: "left", defend: "center" },
  { id: "goal-center", label: "GOL — centru", shot: "center", defend: "left" },
  { id: "goal-right", label: "GOL — dreapta", shot: "right", defend: "center" },
  { id: "save-left", label: "APĂRAT — stânga", shot: "left", defend: "left" },
  { id: "save-center", label: "APĂRAT — centru", shot: "center", defend: "center" },
  { id: "save-right", label: "APĂRAT — dreapta", shot: "right", defend: "right" },
];

export default function PenaltyPreviewScreen({ onBack, embedded }) {
  const assetsReady = usePreloadPenaltyAssets();
  const [pickIdx, setPickIdx] = useState(0);
  const [shots, setShots] = useState([]);
  const [defends, setDefends] = useState([]);
  const [data, setData] = useState(null);

  function handlePick(zone) {
    if (pickIdx < 5) {
      const next = [...shots, zone];
      setShots(next);
      setPickIdx(pickIdx + 1);
    } else {
      const next = [...defends, zone];
      setDefends(next);
      if (pickIdx === 9) {
        const opp = { shots: randomFive(), defends: randomFive() };
        const result = computePenaltyDuel({ shots, defends: next }, opp);
        setData({ ...result, isFinal: false });
      } else {
        setPickIdx(pickIdx + 1);
      }
    }
  }

  // ── Scenariu rapid de debug — prima lovitură forțată, restul random.
  // Bypass complet al fazei interactive de alegere — DOAR pentru test
  // vizual rapid, nu există în jocul real. ──
  function handleDebugScenario(scen) {
    const myShots = [scen.shot, ...randomFive().slice(1)];
    const myDefends = randomFive();
    const oppShots = randomFive();
    const oppDefends = [scen.defend, ...randomFive().slice(1)];
    const result = computePenaltyDuel({ shots: myShots, defends: myDefends }, { shots: oppShots, defends: oppDefends });
    setData({ ...result, isFinal: false });
  }

  function handleRestart() {
    setPickIdx(0);
    setShots([]);
    setDefends([]);
    setData(null);
  }

  const content = (
    <div style={s.wrap}>
      {!embedded && <PageHeader title="⚽ Penalty PvP — Preview" onBack={onBack} />}
      <div style={s.mockBanner}>👁 PREVIEW — mock, adversar generat local, nimic salvat</div>

      {!data && (
        <div style={s.debugBox}>
          <div style={s.debugTitle}>🛠 Scenarii rapide (doar debug, nu apare la jucători)</div>
          <div style={s.debugGrid}>
            {DEBUG_SCENARIOS.map((scen) => (
              <button key={scen.id} type="button" style={s.debugBtn} onClick={() => handleDebugScenario(scen)}>
                {scen.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {data ? (
        <>
          <ShootoutSequence data={data} myName="JUCĂTOR A" oppName="JUCĂTOR B (mock)" oppAvatarId={null} assetsReady={assetsReady} />
          <button type="button" style={s.restartBtn} onClick={handleRestart}>🔄 RESET / RESTART PREVIEW</button>
        </>
      ) : (
        <>
          <div style={s.header}>🥅 PENALTY PVP <span style={s.vsOpp}>vs JUCĂTOR B (mock)</span></div>
          <div style={s.roleBanner}>
            <span style={{ color: pickIdx < 5 ? "#8BD957" : "#F0C24C" }}>
              {pickIdx < 5 ? "🎯 UNDE TRAGI?" : "🧤 UNDE TE ARUNCI?"}
            </span>
            <span style={s.roleRound}>lovitura {(pickIdx < 5 ? pickIdx + 1 : pickIdx - 5 + 1)}/5</span>
          </div>
          <Stage mode="pick" onPick={handlePick} animKick={null} assetsReady={assetsReady} />
          <div style={s.pickHint}>{pickIdx < 5 ? "Apasă pe poartă — stânga, mijloc sau dreapta" : "Ghicește unde va trage adversarul"}</div>
          <button type="button" style={s.restartBtn} onClick={handleRestart}>🔄 RESET / RESTART PREVIEW</button>
        </>
      )}
    </div>
  );

  return embedded ? content : <div style={s.page}>{content}</div>;
}

const s = {
  page: { minHeight: "100dvh", background: color.bgBase },
  wrap: { maxWidth: 420, margin: "0 auto", padding: "0 14px 24px" },
  mockBanner: {
    textAlign: "center", fontSize: 11, fontWeight: 700, color: color.goldLight, fontFamily: font.body,
    background: "rgba(212,175,55,0.1)", border: `1px solid ${color.goldBorder}`, borderRadius: radius.sm,
    padding: "6px 10px", margin: "10px 0",
  },
  debugBox: { background: "rgba(255,255,255,0.03)", border: `1px dashed ${color.border}`, borderRadius: radius.md, padding: "8px 10px", marginBottom: 12 },
  debugTitle: { fontSize: 9.5, fontWeight: 700, color: color.textFaint, fontFamily: font.body, marginBottom: 6 },
  debugGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 },
  debugBtn: {
    padding: "7px 4px", borderRadius: radius.sm, border: `1px solid ${color.border}`, background: "rgba(255,255,255,0.04)",
    color: color.textSecondary, fontSize: 9.5, fontWeight: 700, fontFamily: font.body, cursor: "pointer",
  },
  header: { fontSize: 15, fontWeight: 800, color: color.textPrimary, textAlign: "center", fontFamily: font.display, marginBottom: 8 },
  vsOpp: { fontSize: 11, fontWeight: 600, color: color.textFaint, fontFamily: font.body },
  roleBanner: { display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 8, fontSize: 13, fontWeight: 800, fontFamily: font.display },
  roleRound: { fontSize: 10.5, fontWeight: 600, color: color.textFaint, fontFamily: font.body },
  pickHint: { textAlign: "center", fontSize: 11, color: color.textSecondary, fontFamily: font.body, marginTop: 8 },
  restartBtn: {
    display: "block", width: "100%", marginTop: 14, padding: "11px 10px", borderRadius: radius.md, border: "none",
    background: color.goldGradient, color: "#12141C", fontWeight: 800, fontSize: 13, fontFamily: font.body, cursor: "pointer",
  },
};
