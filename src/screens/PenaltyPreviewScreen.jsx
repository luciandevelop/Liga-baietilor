import { useState } from "react";
import { Stage, ShootoutSequence, usePreloadPenaltyAssets } from "../components/PenaltyExperience";
import { computePenaltyDuel } from "../services/surprisesService";
import PageHeader from "../components/PageHeader";
import { color, font, radius } from "../matchdayTheme";

// ══════════════════════════════════════════════════════════════════
// ⚽ PENALTY PvP — Admin Preview / MOCK.
//
// Nu re-desenăm nimic vizual — reutilizăm 100% componentele reale:
// Stage (scenă+shooter+minge+portar+zonele de tap) și ShootoutSequence
// (secvența de reveal rundă-cu-rundă), ambele exportate acum din
// PenaltyExperience.jsx, plus computePenaltyDuel — funcția PURĂ care
// calculează rezultatul, IDENTICĂ cu cea folosită live/la Rezolvare.
// Nicio duplicare de logică/animație, ZERO Firestore.
//
// Flux: aici jucăm interactiv cele 10 alegeri (5 șuturi + 5 apărări,
// exact ca în jocul real), generăm un adversar random local, calculăm
// rezultatul cu computePenaltyDuel(), apoi redăm ShootoutSequence —
// exact ce ar vedea un jucător real, doar cu date locale.
// ══════════════════════════════════════════════════════════════════
const ZONES = ["left", "center", "right"];
function randomZone() { return ZONES[Math.floor(Math.random() * ZONES.length)]; }
function randomFive() { return Array.from({ length: 5 }, randomZone); }

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
        // ── Adversar MOCK, generat local — NU e trimis nicăieri,
        // există doar cât durează acest Preview. ──
        const opp = { shots: randomFive(), defends: randomFive() };
        const result = computePenaltyDuel({ shots, defends: next }, opp);
        setData({ ...result, isFinal: false });
      } else {
        setPickIdx(pickIdx + 1);
      }
    }
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
              {pickIdx < 5 ? "⚽ TU EXECUȚI" : "🧤 TU APERI"}
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
