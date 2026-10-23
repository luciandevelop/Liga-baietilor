import { color, font, radius } from "../matchdayTheme";

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
// GHIDURI VIZUALE pentru Regulament — doar desene și text, fără date din Firestore, fără logică de joc.
// Scrise pentru ca TOATĂ gașca să înțeleagă din prima: pași scurți, scheme, un exemplu.
// Numerele de aici trebuie să rămână în acord cu motorul jocurilor (bursaService.js / treasureHuntMockData.js).
// ═══════════════════════════════════════════════════════════════════════════════════════════════════

const UP = "#33E38A";
const DOWN = "#FF5A6A";
const AMBER = "#F0A94E";

// ── Iconițe (aceleași ca în joc) ──
function Crown({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M8 46 L5 20 L20 32 L32 12 L44 32 L59 20 L56 46 Z" fill="#F2C94C" stroke="#B8860B" strokeWidth="3" strokeLinejoin="round" />
      <rect x="8" y="46" width="48" height="9" rx="3" fill="#E0A81E" stroke="#B8860B" strokeWidth="3" />
      <circle cx="32" cy="12" r="4.6" fill="#FF6B81" stroke="#B8860B" strokeWidth="2" />
      <circle cx="5" cy="20" r="3.6" fill="#6BE3FF" stroke="#B8860B" strokeWidth="2" />
      <circle cx="59" cy="20" r="3.6" fill="#6BE3FF" stroke="#B8860B" strokeWidth="2" />
    </svg>
  );
}

function Frog({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" style={{ flexShrink: 0 }}>
      <ellipse cx="32" cy="41" rx="25" ry="19" fill="#5BD16A" stroke="#2E8B3E" strokeWidth="3" />
      <circle cx="19" cy="23" r="11" fill="#5BD16A" stroke="#2E8B3E" strokeWidth="3" />
      <circle cx="45" cy="23" r="11" fill="#5BD16A" stroke="#2E8B3E" strokeWidth="3" />
      <circle cx="19" cy="22.5" r="7.6" fill="#fff" /><circle cx="45" cy="22.5" r="7.6" fill="#fff" />
      <circle cx="21" cy="24" r="3.7" fill="#17261a" /><circle cx="43" cy="24" r="3.7" fill="#17261a" />
      <path d="M17 42 Q32 55 47 42" stroke="#2E8B3E" strokeWidth="3.2" fill="none" strokeLinecap="round" />
      <path d="M29.5 49.5 Q32 58 34.5 49.5 Z" fill="#FF6B81" />
    </svg>
  );
}

// Cerc „coleg” (siluetă) cu coroană sau broscoi deasupra.
function Mate({ label, kind }) {
  const tone = kind === "prince" ? UP : DOWN;
  return (
    <div style={g.mate}>
      <div style={{ position: "relative", width: 44, height: 44 }}>
        <div style={{ ...g.mateCircle, borderColor: tone }}>
          <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="8" r="4.2" fill="#6B7488" />
            <path d="M3.5 21c.8-4.6 4.2-7 8.5-7s7.7 2.4 8.5 7z" fill="#6B7488" />
          </svg>
        </div>
        <div style={kind === "prince" ? g.crownPos : g.frogPos}>{kind === "prince" ? <Crown size={22} /> : <Frog size={20} />}</div>
      </div>
      <span style={g.mateLabel}>{label}</span>
    </div>
  );
}

function StepHead({ n, children }) {
  return (
    <div style={g.stepHead}>
      <span style={g.stepNum}>{n}</span>
      <span style={g.stepTitle}>{children}</span>
    </div>
  );
}

// ═══════════════════ PRINȚ SAU BROSCOI? ═══════════════════
export function PrinceFrogGuide() {
  return (
    <div style={g.guide}>
      <div style={g.oneLine}>
        Ghicești care colegi <b style={{ color: UP }}>vor face multe puncte</b> și care{" "}
        <b style={{ color: DOWN }}>vor face puține</b>, în clasamentul etapei. Cine ghicește mai bine, câștigă.
      </div>

      {/* PASUL 1 */}
      <StepHead n="1">Alegi 4 colegi</StepHead>
      <div style={g.twoCol}>
        <div style={{ ...g.pickCard, borderColor: "rgba(51,227,138,0.35)", background: "rgba(51,227,138,0.06)" }}>
          <div style={{ ...g.pickTitle, color: UP }}>2 PRINȚI</div>
          <div style={g.pickMates}>
            <Mate label="Coleg A" kind="prince" />
            <Mate label="Coleg B" kind="prince" />
          </div>
          <div style={g.pickText}>Crezi că vor face <b>MULTE</b> puncte</div>
        </div>
        <div style={{ ...g.pickCard, borderColor: "rgba(255,90,106,0.35)", background: "rgba(255,90,106,0.06)" }}>
          <div style={{ ...g.pickTitle, color: DOWN }}>2 BROSCOI</div>
          <div style={g.pickMates}>
            <Mate label="Coleg C" kind="frog" />
            <Mate label="Coleg D" kind="frog" />
          </div>
          <div style={g.pickText}>Crezi că vor face <b>PUȚINE</b> puncte</div>
        </div>
      </div>
      <div style={g.note}>Poți alege și adversarul tău din duel. Pe tine nu te poți alege.</div>

      {/* PASUL 2 */}
      <StepHead n="2">Se termină etapa — se uită la clasament</StepHead>
      <div style={g.ladder} aria-label="Cât primești după locul din clasamentul etapei">
        <div style={g.rail} />
        <LadderRow icon={<Crown size={20} />} where="Locul 1" pts="+75" tone={UP} strong />
        <LadderRow icon={<Crown size={20} />} where="Locurile 2 și 3" pts="+45" tone={UP} />
        <LadderRow icon={<Crown size={20} />} where="Restul jumătății de sus" pts="+20" tone={UP} soft />
        <div style={g.ladderMid}>mijlocul clasamentului · nimic</div>
        <LadderRow icon={<Frog size={20} />} where="Restul jumătății de jos" pts="+20" tone={DOWN} soft />
        <LadderRow icon={<Frog size={20} />} where="Cei de dinaintea ultimului (2 grupuri)" pts="+45" tone={DOWN} />
        <LadderRow icon={<Frog size={20} />} where="Ultimul loc" pts="+75" tone={DOWN} strong />
      </div>
      <div style={g.note}>
        <b>Prinții</b> primesc puncte dacă sunt SUS. <b>Broscoii</b> primesc puncte dacă sunt JOS. Fiecare alegere primește o singură recompensă.
        Dacă mai mulți au același punctaj, stau pe același loc și primesc la fel.
      </div>

      {/* PASUL 3 */}
      <StepHead n="3">Aduni cele 4 recompense — apoi duelul</StepHead>
      <div style={g.duel}>
        <div style={g.duelSide}>
          <div style={g.duelWho}>TU</div>
          <div style={{ ...g.duelNum, color: UP }}>240</div>
          <div style={g.duelSub}>puncte din alegeri</div>
        </div>
        <div style={g.duelVs}>VS</div>
        <div style={g.duelSide}>
          <div style={g.duelWho}>ADVERSARUL</div>
          <div style={{ ...g.duelNum, color: "#8FB8FF" }}>160</div>
          <div style={g.duelSub}>puncte din alegeri</div>
        </div>
      </div>
      <div style={g.duelRules}>
        <div style={g.chip}><b>Mai mult</b> câștigă duelul → <b style={{ color: UP }}>+50</b></div>
        <div style={g.chip}><b>Egal</b> → <b style={{ color: AMBER }}>+25</b> fiecare</div>
        <div style={g.chip}><b>Mai puțin</b> → <b style={{ color: DOWN }}>+0</b></div>
      </div>
      <div style={g.capBox}>
        <div style={g.capLine}>
          <span style={g.capBar}><i style={{ ...g.capFill, width: "100%" }} /></span>
          <span style={g.capText}>În clasament intră maximum <b>150</b> din alegeri</span>
        </div>
        <div style={g.capLine}>
          <span style={g.capBar}><i style={{ ...g.capFill, width: "100%", background: "linear-gradient(90deg,#33E38A,#F2C94C)" }} /></span>
          <span style={g.capText}>Duelul se decide pe punctele <b>întregi</b> (și peste 150)</span>
        </div>
        <div style={g.capTotal}>Cu duelul câștigat: 150 + 50 = <b>200 puncte</b> maxim</div>
      </div>

      {/* EXEMPLU */}
      <div style={g.example}>
        <div style={g.exTitle}>Exemplu</div>
        <div style={g.exRow}><Crown size={18} /><span style={g.exTxt}>Colegul A a fost pe <b>locul 1</b></span><b style={{ color: UP }}>+75</b></div>
        <div style={g.exRow}><Crown size={18} /><span style={g.exTxt}>Colegul B a fost pe <b>locul 3</b></span><b style={{ color: UP }}>+45</b></div>
        <div style={g.exRow}><Frog size={18} /><span style={g.exTxt}>Colegul C a fost <b>ultimul</b></span><b style={{ color: UP }}>+75</b></div>
        <div style={g.exRow}><Frog size={18} /><span style={g.exTxt}>Colegul D a fost pe penultimul loc</span><b style={{ color: UP }}>+45</b></div>
        <div style={g.exSum}>75 + 45 + 75 + 45 = <b>240</b> puncte. Adversarul are 160 → <b style={{ color: UP }}>câștigi duelul</b>.
          În clasament primești 150 + 50 = <b>200</b>.</div>
      </div>

      {/* ÎNTREBĂRI */}
      <div style={g.faq}>
        <div style={g.faqTitle}>Mai ai întrebări?</div>
        <div style={g.faqRow}><b>Când se închide?</b> Când începe primul meci al etapei, sau mai devreme dacă Adminul o închide.</div>
        <div style={g.faqRow}><b>Pot schimba alegerile?</b> Da, oricând până la închidere. Rămâne ultima variantă salvată.</div>
        <div style={g.faqRow}><b>Văd alegerile celorlalți?</b> Abia după închidere. Atunci le vede toată lumea.</div>
        <div style={g.faqRow}><b>Nu am ales nimic?</b> Iei 0, iar adversarul tău, dacă a ales, primește +50 automat.</div>
        <div style={g.faqRow}><b>Nu am adversar?</b> Dacă numărul de jucători e impar, primești +25 dacă ai ales.</div>
      </div>
    </div>
  );
}

function LadderRow({ icon, where, pts, tone, strong, soft }) {
  return (
    <div style={{ ...g.ladderRow, borderColor: strong ? tone : "rgba(255,255,255,0.08)", background: strong ? `${tone}18` : "transparent", opacity: soft ? 0.88 : 1 }}>
      <span style={g.ladderIcon}>{icon}</span>
      <span style={g.ladderWhere}>{where}</span>
      <span style={{ ...g.ladderPts, color: UP }}>{pts}</span>   {/* puncte CÂȘTIGATE: mereu verzi (roșul rămâne doar pe cadru/iconiță) */}
    </div>
  );
}

// ═══════════════════ COMOARA BLESTEMATĂ ═══════════════════
const NODE_X = [24, 66, 108, 150, 192, 234, 276];
const NODE_Y = [78, 70, 78, 70, 78, 70, 78];

export function TreasureGuide() {
  return (
    <div style={g.guide}>
      <div style={g.oneLine}>
        O aventură doar a ta, pe hartă. Treci prin <b>7 ape</b>, aduni puncte și încerci să ajungi la <b>comoară</b>. Ai <b>2 vieți</b>.
      </div>

      <StepHead n="1">Harta aventurii</StepHead>
      <svg viewBox="0 0 340 168" width="100%" role="img" aria-label="Harta celor 7 ape: 3 liniștite, 2 agitate, 2 blestemate, apoi comoara" style={{ display: "block", maxWidth: 420, margin: "0 auto" }}>
        {/* zone */}
        <rect x="6" y="40" width="122" height="64" rx="12" fill="rgba(51,227,138,0.10)" stroke="rgba(51,227,138,0.35)" />
        <rect x="128" y="40" width="84" height="64" rx="12" fill="rgba(240,169,78,0.10)" stroke="rgba(240,169,78,0.35)" />
        <rect x="212" y="40" width="84" height="64" rx="12" fill="rgba(255,90,106,0.10)" stroke="rgba(255,90,106,0.35)" />
        {/* drum */}
        <path d={`M ${NODE_X[0]} ${NODE_Y[0]} ` + NODE_X.slice(1).map((x, i) => `Q ${(NODE_X[i] + x) / 2} ${NODE_Y[i + 1] - 18} ${x} ${NODE_Y[i + 1]}`).join(" ") + ` L 316 74`} fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="3" strokeDasharray="2 6" strokeLinecap="round" />
        {/* noduri */}
        {NODE_X.map((x, i) => {
          const tone = i < 3 ? UP : i < 5 ? AMBER : DOWN;
          return (
            <g key={i}>
              <circle cx={x} cy={NODE_Y[i]} r="14" fill="#0E1119" stroke={tone} strokeWidth="2.5" />
              <text x={x} y={NODE_Y[i] + 5} textAnchor="middle" fontSize="14" fontWeight="700" fill="#fff" fontFamily="Inter, Arial, sans-serif">{i + 1}</text>
            </g>
          );
        })}
        {/* comoara */}
        <g transform="translate(300 52)">
          <rect x="0" y="12" width="30" height="20" rx="3" fill="#B8791C" stroke="#7A4E0B" strokeWidth="2" />
          <path d="M0 14 Q15 -4 30 14 Z" fill="#D69A2D" stroke="#7A4E0B" strokeWidth="2" />
          <rect x="12" y="16" width="6" height="8" rx="1.5" fill="#F2C94C" stroke="#7A4E0B" strokeWidth="1.5" />
        </g>
        {/* titluri zone */}
        <text x="67" y="30" textAnchor="middle" fontSize="10" fontWeight="700" fill={UP} fontFamily="Inter, Arial, sans-serif">LINIȘTITE</text>
        <text x="170" y="30" textAnchor="middle" fontSize="10" fontWeight="700" fill={AMBER} fontFamily="Inter, Arial, sans-serif">AGITATE</text>
        <text x="254" y="30" textAnchor="middle" fontSize="10" fontWeight="700" fill={DOWN} fontFamily="Inter, Arial, sans-serif">BLESTEMATE</text>
        <text x="67" y="124" textAnchor="middle" fontSize="9.5" fill="#9099AC" fontFamily="Inter, Arial, sans-serif">fără pericol</text>
        <text x="170" y="124" textAnchor="middle" fontSize="9.5" fill="#9099AC" fontFamily="Inter, Arial, sans-serif">poți pierde puncte</text>
        <text x="254" y="124" textAnchor="middle" fontSize="9.5" fill="#9099AC" fontFamily="Inter, Arial, sans-serif">pierzi vieți</text>
        <text x="315" y="48" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#F2C94C" fontFamily="Inter, Arial, sans-serif">COMOARA</text>
        {/* oprire */}
        <g>
          <line x1="128" y1="104" x2="128" y2="140" stroke="#F2C94C" strokeWidth="1.5" strokeDasharray="3 3" />
          <text x="128" y="154" textAnchor="middle" fontSize="10" fontWeight="700" fill="#F2C94C" fontFamily="Inter, Arial, sans-serif">💰 După apa 3 poți să te oprești</text>
        </g>
        {/* vieți */}
        <text x="10" y="14" fontSize="14" fontFamily="Inter, Arial, sans-serif">❤️❤️</text>
        <text x="48" y="13" fontSize="9.5" fill="#9099AC" fontFamily="Inter, Arial, sans-serif">2 vieți · începi cu 0 puncte</text>
      </svg>

      <StepHead n="2">La fiecare apă alegi UN drum</StepHead>
      <div style={g.doors}>
        {["?", "?", "?"].map((q, i) => (<div key={i} style={g.door}><span style={g.doorQ}>{q}</span></div>))}
      </div>
      <div style={g.note}>În spatele drumurilor sunt <b>puncte</b> sau <b>pericole</b>. Nu știi ce e în spate. Abia după ce alegi, se arată toate drumurile, ca să vezi ce ai ratat.</div>

      <StepHead n="3">Ce se poate întâmpla</StepHead>
      <div style={g.threeCol}>
        <div style={{ ...g.miniCard, borderColor: "rgba(51,227,138,0.35)" }}><div style={{ ...g.miniBig, color: UP }}>+10</div><div style={g.miniTxt}>Primești puncte</div></div>
        <div style={{ ...g.miniCard, borderColor: "rgba(240,169,78,0.35)" }}><div style={{ ...g.miniBig, color: AMBER }}>−10</div><div style={g.miniTxt}>Pierzi puncte (doar la apele 4–5)</div></div>
        <div style={{ ...g.miniCard, borderColor: "rgba(255,90,106,0.35)" }}><div style={{ ...g.miniBig, color: DOWN }}>−❤️</div><div style={g.miniTxt}>Pierzi o viață (apele 4–7)</div></div>
      </div>

      <StepHead n="4">Vieți: ce contează</StepHead>
      <div style={g.lives}>
        <div style={g.liveBox}>
          <div style={g.liveHearts}>❤️ 🖤</div>
          <div style={g.liveTxt}><b>O viață pierdută:</b> nu pierzi punctele. Continui.</div>
        </div>
        <div style={g.liveBox}>
          <div style={g.liveHearts}>🖤 🖤</div>
          <div style={g.liveTxt}><b>Ambele pierdute:</b> aventura se termină, iar scorul devine <b style={{ color: DOWN }}>0</b>.</div>
        </div>
      </div>

      <StepHead n="5">Cum se termină</StepHead>
      <div style={g.endList}>
        <div style={g.endRow}><span style={g.endIcon}>💰</span><span><b>Te oprești</b> după apa 3, 4, 5 sau 6 → păstrezi punctele de până atunci.</span></div>
        <div style={g.endRow}><span style={g.endIcon}>🏴‍☠️</span><span><b>Treci de apa 7</b> cu cel puțin o viață → primești <b style={{ color: UP }}>+25</b> bonus comoară.</span></div>
        <div style={g.endRow}><span style={g.endIcon}>🏆</span><span><b>Ajungi la 100</b> puncte → aventura se încheie singură: comoara e a ta.</span></div>
      </div>
      <div style={g.note}>Maxim: <b>100 puncte</b>. Ai o singură încercare. Dacă închizi aplicația, continui exact de unde ai rămas.</div>
    </div>
  );
}

const g = {
  guide: { display: "flex", flexDirection: "column", gap: 10, margin: "4px 0 12px" },
  oneLine: { fontSize: 13, color: color.textPrimary, lineHeight: 1.55, fontFamily: font.body, background: color.surfaceInset, border: `1px solid ${color.border}`, borderRadius: radius.md, padding: "10px 12px" },
  stepHead: { display: "flex", alignItems: "center", gap: 8, marginTop: 6 },
  stepNum: { width: 22, height: 22, borderRadius: "50%", background: color.goldGradient, color: "#1a1204", fontWeight: 800, fontSize: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: font.body },
  stepTitle: { fontSize: 13.5, fontWeight: 700, color: color.textPrimary, fontFamily: font.body },
  twoCol: { display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 8 },
  pickCard: { border: "1px solid", borderRadius: radius.md, padding: "10px 6px 10px", textAlign: "center" },
  pickTitle: { fontFamily: font.display, fontWeight: 700, fontSize: 15, letterSpacing: 0.4, marginBottom: 6 },
  pickMates: { display: "flex", justifyContent: "center", gap: 10, paddingTop: 10 },
  pickText: { fontSize: 11, color: color.textSecondary, marginTop: 8, lineHeight: 1.4, fontFamily: font.body },
  mate: { display: "flex", flexDirection: "column", alignItems: "center", gap: 3 },
  mateCircle: { width: 44, height: 44, borderRadius: "50%", border: "2px solid", background: "#1A1F2C", display: "flex", alignItems: "center", justifyContent: "center" },
  crownPos: { position: "absolute", top: -13, left: "50%", marginLeft: -11, transform: "rotate(-10deg)" },
  frogPos: { position: "absolute", right: -9, bottom: -7 },
  mateLabel: { fontSize: 10, color: color.textFaint, marginTop: 4, fontFamily: font.body },
  note: { fontSize: 11.5, color: color.textSecondary, lineHeight: 1.55, fontFamily: font.body },

  ladder: { position: "relative", display: "flex", flexDirection: "column", gap: 5, paddingLeft: 14 },
  rail: { position: "absolute", left: 3, top: 4, bottom: 4, width: 4, borderRadius: 2, background: `linear-gradient(180deg, ${UP}, rgba(255,255,255,0.15) 45%, rgba(255,255,255,0.15) 55%, ${DOWN})` },
  ladderRow: { display: "flex", alignItems: "center", gap: 8, border: "1px solid", borderRadius: radius.sm, padding: "7px 9px" },
  ladderIcon: { display: "inline-flex", width: 22, justifyContent: "center", flexShrink: 0 },
  ladderWhere: { flex: 1, fontSize: 12, color: color.textPrimary, lineHeight: 1.3, fontFamily: font.body },
  ladderPts: { fontFamily: font.display, fontWeight: 700, fontSize: 17, minWidth: 44, textAlign: "right" },
  ladderMid: { textAlign: "center", fontSize: 10.5, color: color.textFaint, padding: "2px 0", fontFamily: font.body },

  duel: { display: "grid", gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr)", alignItems: "center", gap: 6, background: color.surfaceInset, border: `1px solid ${color.border}`, borderRadius: radius.md, padding: "10px 8px" },
  duelSide: { textAlign: "center" },
  duelWho: { fontSize: 10.5, fontWeight: 700, letterSpacing: 0.8, color: color.textSecondary, fontFamily: font.body },
  duelNum: { fontFamily: font.display, fontWeight: 700, fontSize: 34, lineHeight: 1.1 },
  duelSub: { fontSize: 10, color: color.textFaint, fontFamily: font.body },
  duelVs: { fontSize: 11, fontWeight: 700, color: color.textFaint, fontFamily: font.body },
  duelRules: { display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 5 },
  chip: { fontSize: 12, color: color.textPrimary, background: color.surfaceElevated, border: `1px solid ${color.border}`, borderRadius: radius.sm, padding: "7px 10px", fontFamily: font.body },
  capBox: { background: color.surfaceInset, border: `1px solid ${color.border}`, borderRadius: radius.md, padding: "9px 10px", display: "flex", flexDirection: "column", gap: 7 },
  capLine: { display: "flex", alignItems: "center", gap: 8 },
  capBar: { width: 56, height: 8, borderRadius: 4, background: "rgba(255,255,255,0.08)", overflow: "hidden", flexShrink: 0, display: "inline-block" },
  capFill: { display: "block", height: "100%", background: UP },
  capText: { fontSize: 11.5, color: color.textSecondary, lineHeight: 1.4, fontFamily: font.body },
  capTotal: { fontSize: 12, color: color.textPrimary, fontFamily: font.body, paddingTop: 2, borderTop: `1px solid ${color.borderSubtle}` },

  example: { background: color.surfaceElevated, border: `1px solid ${color.border}`, borderRadius: radius.md, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 },
  exTitle: { fontSize: 10.5, fontWeight: 700, color: color.goldLight, fontFamily: font.body, letterSpacing: 0.5 },
  exRow: { display: "flex", alignItems: "center", gap: 8, fontSize: 12 },
  exTxt: { flex: 1, color: color.textSecondary, fontFamily: font.body, lineHeight: 1.35 },
  exSum: { fontSize: 12, color: color.textPrimary, lineHeight: 1.55, paddingTop: 6, borderTop: `1px solid ${color.borderSubtle}`, fontFamily: font.body },

  faq: { display: "flex", flexDirection: "column", gap: 6, marginTop: 2 },
  faqTitle: { fontSize: 12.5, fontWeight: 700, color: color.goldLight, fontFamily: font.body },
  faqRow: { fontSize: 12, color: color.textSecondary, lineHeight: 1.5, fontFamily: font.body, paddingLeft: 10, borderLeft: `2px solid ${color.border}` },

  doors: { display: "flex", justifyContent: "center", gap: 10 },
  door: { width: 64, height: 78, borderRadius: "30px 30px 6px 6px", background: "linear-gradient(180deg,#2A2F3F,#171B26)", border: `2px solid ${color.border}`, display: "flex", alignItems: "center", justifyContent: "center" },
  doorQ: { fontFamily: font.display, fontSize: 30, fontWeight: 700, color: color.goldLight },
  threeCol: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 6 },
  miniCard: { border: "1px solid", borderRadius: radius.md, padding: "9px 4px", textAlign: "center", background: color.surfaceInset },
  miniBig: { fontFamily: font.display, fontWeight: 700, fontSize: 24, lineHeight: 1.1 },
  miniTxt: { fontSize: 10.5, color: color.textSecondary, marginTop: 4, lineHeight: 1.35, fontFamily: font.body },
  lives: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 6 },
  liveBox: { background: color.surfaceInset, border: `1px solid ${color.border}`, borderRadius: radius.md, padding: "9px 8px", textAlign: "center" },
  liveHearts: { fontSize: 20, letterSpacing: 2 },
  liveTxt: { fontSize: 11.5, color: color.textSecondary, lineHeight: 1.45, marginTop: 5, fontFamily: font.body },
  endList: { display: "flex", flexDirection: "column", gap: 6 },
  endRow: { display: "flex", alignItems: "flex-start", gap: 9, fontSize: 12, color: color.textSecondary, lineHeight: 1.5, fontFamily: font.body, background: color.surfaceInset, border: `1px solid ${color.border}`, borderRadius: radius.sm, padding: "8px 10px" },
  endIcon: { fontSize: 17, lineHeight: 1.2, flexShrink: 0 },
};
