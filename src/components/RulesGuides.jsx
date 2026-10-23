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

// Întrebările frecvente ale jocurilor cu ghid vizual (afișate la finalul secțiunii, după „Detalii exacte”).
export const DICE_FAQ = [
  ["Pot arunca oricâte ori?", "Da, până apeși STOP sau până când Adminul rezolvă Zarurile."],
  ["Pot anula o aruncare?", "Nu. Fiecare aruncare se înregistrează și rămâne."],
  ["Ce se întâmplă dacă depășesc?", "Primești 0 doar la întrebarea aceea. Celelalte întrebări rămân neatinse."],
  ["Dacă nu apăs STOP?", "La Rezolvare se ia suma pe care o aveai în acel moment (iar dacă erai deja peste rezultat, e BUST)."],
  ["Și dacă rezultatul unei întrebări nu e încă stabilit?", "Întrebarea aceea nu se punctează."],
  ["Fără adversar?", "Dacă numărul de jucători e impar, primești punctele tale din întrebări + 25."],
];

export const SABOTAGE_FAQ = [
  ["Pot pierde puncte?", "Da. Dacă un coleg te alege și are mai multe puncte decât tine, pierzi până la 200p la Surpriza asta. Dacă nimeni nu te alege, nu pierzi nimic."],
  ["Pot fi ales de mai mulți?", "Nu. Fiecare jucător poate fi ales de cel mult un atacator."],
  ["Pot să mă aleg pe mine?", "Nu."],
  ["Când văd cine pe cine a ales?", "Alegerea ta rămâne secretă până când Adminul dezvăluie toate alegerile."],
  ["Cu ce puncte se compară?", "Cu punctele din pronosticurile etapei, la momentul rezolvării, nu cu clasamentul general."],
  ["Dacă nu aleg nimic?", "Alegerile se fac pe rând, iar Adminul poate dezvălui rezultatele abia după ce au ales toți. Cei din spatele tău în ordine nu pot alege până nu alegi tu, așa că alege cât mai repede."],
];

export const PRINCE_FAQ = [
  ["Când se închide?", "Când începe primul meci al etapei, sau mai devreme dacă Adminul o închide."],
  ["Pot schimba alegerile?", "Da, oricând până la închidere. Rămâne ultima variantă salvată."],
  ["Văd alegerile celorlalți?", "Abia după închidere. Atunci le vede toată lumea."],
  ["Nu am ales nimic?", "Iei 0, iar adversarul tău, dacă a ales, primește +50 automat."],
  ["Nu am adversar?", "Dacă numărul de jucători e impar, primești +25 dacă ai ales."],
];

// ═══════════════════ ELEMENTE REUTILIZABILE ═══════════════════
// „Mai ai întrebări?” — listă de întrebări/răspunsuri, folosită la fiecare surpriză.
export function GameFaq({ items }) {
  return (
    <div style={g.faq}>
      <div style={g.faqTitle}>Mai ai întrebări?</div>
      {items.map(([q, a], i) => (
        <div key={i} style={g.faqRow}><b>{q}</b> {a}</div>
      ))}
    </div>
  );
}

// Toate surprizele, pe scurt (tabel de orientare).
export function SurprisesOverview() {
  const big = [
    ["🥊", "Duel 1v1", "compari punctele etapei cu un adversar", "200"],
    ["👥", "Duel de Echipe", "echipe de 2–3, contează suma", "200"],
    ["🆚", "Jumate-Jumate", "două tabere, contează suma", "200"],
    ["❓", "Trivia", "10 întrebări A/B + duel", "200"],
    ["🎲", "Zarurile", "arunci zarul, te apropii de rezultat fără să-l depășești", "200"],
    ["🗡️", "Sabotaj", "alegi un coleg și încerci să-i furi puncte", "±200"],
    ["🎟️", "Bet Builder", "5 selecții pe un meci + duel", "200"],
    ["📈", "Mai Mare / Mai Mic", "6 runde în duel pe praguri", "200"],
    ["👑", "Prinț sau Broscoi?", "ghicești cine face multe și cine face puține puncte", "200"],
  ];
  const small = [
    ["🎰", "Ruletă", "o învârtire (sau două)", "100"],
    ["🎁", "Mystery Box", "alegi o cutie din 40", "100"],
    ["🥅", "Penalty", "duel de șuturi și parări", "100"],
    ["🏴‍☠️", "Comoara Blestemată", "aventură pe 7 ape", "100"],
  ];
  const Row = ({ r }) => (
    <div style={g.ovRow}>
      <span style={g.ovIcon}>{r[0]}</span>
      <span style={g.ovMain}><b style={{ color: color.textPrimary }}>{r[1]}</b><span style={g.ovSub}>{r[2]}</span></span>
      <span style={g.ovMax}>{r[3]}p</span>
    </div>
  );
  return (
    <div style={g.guide}>
      <div style={g.ovHead}>Surprize Mari <span style={g.ovHeadSub}>max 200p</span></div>
      <div style={g.ovList}>{big.map((r) => <Row key={r[1]} r={r} />)}</div>
      <div style={g.ovHead}>Surprize Mici <span style={g.ovHeadSub}>max 100p</span></div>
      <div style={g.ovList}>{small.map((r) => <Row key={r[1]} r={r} />)}</div>
    </div>
  );
}

function DieFace({ n, tone }) {
  return <span style={{ ...g.die, borderColor: tone || "rgba(255,255,255,0.25)", color: tone || color.textPrimary }}>{n}</span>;
}

// ═══════════════════ ZARURILE ═══════════════════
export function DiceGuide() {
  const cells = [
    ["3", "0", false], ["4", "5", false], ["5", "10", false], ["6", "15", false], ["7", "20", false],
    ["8", "25", false], ["9", "30", true], ["10", "✖", false, true], ["11", "✖", false, true],
  ];
  return (
    <div style={g.guide}>
      <div style={g.oneLine}>
        Primești <b>5 întrebări cu răspuns numeric</b>. Aruncând zarul, aduni un număr. Scopul: să te{" "}
        <b style={{ color: UP }}>apropii cât mai mult</b> de rezultatul real, dar{" "}
        <b style={{ color: DOWN }}>fără să-l depășești</b>.
      </div>

      <StepHead n="1">O întrebare cu număr</StepHead>
      <div style={g.qCard}>
        <div style={g.qText}>„Câte cornere vor fi în meciul X?”</div>
        <div style={g.qNote}>Rezultatul real nu-l știi. Îl află Adminul după meci.</div>
      </div>

      <StepHead n="2">Arunci zarul de câte ori vrei</StepHead>
      <div style={g.diceRow}>
        <DieFace n="4" /><span style={g.plus}>+</span><DieFace n="3" /><span style={g.plus}>+</span><DieFace n="2" />
        <span style={g.plus}>=</span><span style={g.sum}>9</span>
      </div>
      <div style={g.stopRow}>
        <span style={g.stopBtn}>STOP</span>
        <span style={g.note}>Când ești mulțumit apeși STOP. Suma ta rămâne cea de atunci și nu mai poți arunca la întrebarea asta.</span>
      </div>

      <StepHead n="3">Se află rezultatul real — cât primești</StepHead>
      <div style={g.scaleTitle}>Exemplu: rezultatul real a fost <b>9</b> cornere</div>
      <div style={g.scale}>
        {cells.map(([stop, pts, exact, bust]) => (
          <div key={stop} style={{ ...g.scaleCell, borderColor: bust ? "rgba(255,90,106,0.45)" : exact ? UP : "rgba(255,255,255,0.1)", background: bust ? "rgba(255,90,106,0.10)" : exact ? "rgba(51,227,138,0.12)" : "transparent" }}>
            <div style={g.scaleStop}>{stop}</div>
            <div style={{ ...g.scalePts, color: bust ? DOWN : exact ? UP : color.textSecondary }}>{pts}</div>
          </div>
        ))}
      </div>
      <div style={g.scaleLegend}>
        <span>sus: unde te-ai oprit</span><span>jos: puncte</span>
        <span style={{ color: DOWN }}>✖ = ai depășit (BUST) → 0 la întrebarea aceea</span>
      </div>
      <div style={g.note}>Pierzi <b>5 puncte</b> pentru fiecare unitate cu care rămâi sub rezultat. Maximum <b>30</b> la o întrebare, <b>5 × 30 = 150</b> în total.</div>

      <StepHead n="4">Duelul</StepHead>
      <div style={g.duelRules}>
        <div style={g.chip}>Ești pus în pereche cu un adversar. Se compară punctele de bază ale voastre (suma celor 5 întrebări, maxim 150).</div>
        <div style={g.chip}><b>Mai mult</b> câștigă → <b style={{ color: UP }}>+50</b> · <b>Egal</b> → <b style={{ color: AMBER }}>+25</b> fiecare · <b>Mai puțin</b> → <b style={{ color: DOWN }}>+0</b></div>
        <div style={g.capTotal}>Maxim: 150 + 50 = <b>200 puncte</b></div>
      </div>

      <div style={g.example}>
        <div style={g.exTitle}>Exemplu — la o întrebare, rezultatul real: 9</div>
        <div style={g.exRow}><span style={g.exTxt}>Te oprești la <b>9</b></span><b style={{ color: UP }}>30</b></div>
        <div style={g.exRow}><span style={g.exTxt}>Te oprești la <b>8</b> (1 sub)</span><b style={{ color: UP }}>25</b></div>
        <div style={g.exRow}><span style={g.exTxt}>Te oprești la <b>6</b> (3 sub)</span><b style={{ color: AMBER }}>15</b></div>
        <div style={g.exRow}><span style={g.exTxt}>Te oprești la <b>10</b> (ai depășit)</span><b style={{ color: DOWN }}>0</b></div>
      </div>

    </div>
  );
}

// ═══════════════════ SABOTAJ ═══════════════════
function Node({ x, y, label, tone }) {
  return (
    <g>
      <circle cx={x} cy={y} r="19" fill="#12161F" stroke={tone} strokeWidth="2.5" />
      <text x={x} y={y + 5} textAnchor="middle" fontSize="14" fontWeight="700" fill="#fff" fontFamily="Inter, Arial, sans-serif">{label}</text>
    </g>
  );
}

export function SabotageGuide() {
  return (
    <div style={g.guide}>
      <div style={g.oneLine}>
        Alegi un coleg și încerci să-i <b style={{ color: DOWN }}>furi puncte</b>. Dacă ai <b>mai multe puncte în etapă</b> decât el, furtul reușește (până la <b>200p</b>).
        Dar și tu poți fi ales de altcineva.
      </div>

      <StepHead n="1">Se alege pe rând</StepHead>
      <div style={g.queue}>
        {["1", "2", "3", "4", "5"].map((n, i) => (
          <div key={n} style={g.queueItem}>
            <span style={{ ...g.queueDot, borderColor: i === 0 ? UP : "rgba(255,255,255,0.25)" }}>{n}</span>
            {i < 4 && <span style={g.queueArrow}>›</span>}
          </div>
        ))}
        <span style={g.queueEtc}>…</span>
      </div>
      <div style={g.note}>Ordinea e cea din <b>clasamentul etapei trecute</b>: cel mai bine clasat alege primul. Poți alege doar după ce a ales cel dinaintea ta. La prima etapă a unui sezon, ordinea o stabilește aplicația.</div>

      <StepHead n="2">Fiecare alege o țintă</StepHead>
      <svg viewBox="0 0 320 130" width="100%" role="img" aria-label="Exemplu: A îl alege pe B, B îl alege pe C, C îl alege pe D" style={{ display: "block", maxWidth: 380, margin: "0 auto" }}>
        <defs>
          <marker id="sbArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="#FF5A6A" />
          </marker>
        </defs>
        <Node x={36} y={60} label="A" tone="#8FB8FF" />
        <Node x={124} y={60} label="B" tone="#8FB8FF" />
        <Node x={212} y={60} label="C" tone="#8FB8FF" />
        <Node x={292} y={60} label="D" tone="#8FB8FF" />
        <path d="M 55 52 Q 80 26 105 52" fill="none" stroke="#FF5A6A" strokeWidth="2.2" markerEnd="url(#sbArrow)" />
        <path d="M 143 52 Q 168 26 193 52" fill="none" stroke="#FF5A6A" strokeWidth="2.2" markerEnd="url(#sbArrow)" />
        <path d="M 231 52 Q 252 26 273 52" fill="none" stroke="#FF5A6A" strokeWidth="2.2" markerEnd="url(#sbArrow)" />
        <text x="160" y="112" textAnchor="middle" fontSize="11" fill="#9099AC" fontFamily="Inter, Arial, sans-serif">săgeată = „încerc să-i fur puncte”</text>
        <text x="160" y="126" textAnchor="middle" fontSize="10" fill="#5A6275" fontFamily="Inter, Arial, sans-serif">un jucător poate fi ales de cel mult un atacator</text>
      </svg>

      <StepHead n="3">Cine câștigă furtul?</StepHead>
      <div style={g.duel}>
        <div style={g.duelSide}>
          <div style={g.duelWho}>TU (atacator)</div>
          <div style={{ ...g.duelNum, color: UP }}>1250</div>
          <div style={g.duelSub}>puncte din etapă</div>
        </div>
        <div style={g.duelVs}>VS</div>
        <div style={g.duelSide}>
          <div style={g.duelWho}>ȚINTA TA</div>
          <div style={{ ...g.duelNum, color: "#8FB8FF" }}>1100</div>
          <div style={g.duelSub}>puncte din etapă</div>
        </div>
      </div>
      <div style={g.duelRules}>
        <div style={g.chip}><b>Ai mai multe</b> → furi <b>min(200, punctele țintei)</b>. Tu <b style={{ color: UP }}>+200</b>, ținta <b style={{ color: DOWN }}>−200</b></div>
        <div style={g.chip}><b>Ai egal sau mai puține</b> → <b>nu se întâmplă nimic</b></div>
      </div>
      <div style={g.note}>Ce furi se scade de la țintă, deci suma punctelor rămâne aceeași. Dacă ținta are sub 200p, furi doar cât are: nu o poți duce sub 0.</div>

      <StepHead n="4">Totul se calculează din același moment</StepHead>
      <div style={g.note}>Dacă A îl fură pe B și apoi C îl fură pe A, furtul lui C <b>nu ține cont</b> de ce a câștigat A de la B. Toate confruntările se compară cu punctele de la momentul rezolvării, nu în lanț.</div>

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

  ovHead: { fontSize: 12, fontWeight: 700, color: color.goldLight, fontFamily: font.body, letterSpacing: 0.4, marginTop: 4 },
  ovHeadSub: { color: color.textFaint, fontWeight: 600, marginLeft: 6 },
  ovList: { display: "flex", flexDirection: "column", gap: 4 },
  ovRow: { display: "flex", alignItems: "center", gap: 8, background: color.surfaceInset, border: `1px solid ${color.border}`, borderRadius: radius.sm, padding: "6px 9px" },
  ovIcon: { fontSize: 16, width: 22, textAlign: "center", flexShrink: 0 },
  ovMain: { flex: 1, display: "flex", flexDirection: "column", gap: 1, minWidth: 0, fontSize: 12, fontFamily: font.body },
  ovSub: { fontSize: 10.5, color: color.textSecondary, lineHeight: 1.35 },
  ovMax: { fontFamily: font.display, fontWeight: 700, fontSize: 14, color: color.goldLight, flexShrink: 0 },

  qCard: { background: color.surfaceInset, border: `1px solid ${color.border}`, borderRadius: radius.md, padding: "10px 12px", textAlign: "center" },
  qText: { fontSize: 13.5, fontWeight: 700, color: color.textPrimary, fontFamily: font.body },
  qNote: { fontSize: 11, color: color.textFaint, marginTop: 4, fontFamily: font.body },
  diceRow: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, flexWrap: "wrap" },
  die: { width: 38, height: 38, borderRadius: 9, border: "2px solid", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: font.display, fontWeight: 700, fontSize: 20, background: "#1A1F2C" },
  plus: { color: color.textFaint, fontWeight: 700, fontSize: 16 },
  sum: { fontFamily: font.display, fontWeight: 700, fontSize: 30, color: UP },
  stopRow: { display: "flex", alignItems: "center", gap: 10 },
  stopBtn: { background: DOWN, color: "#fff", fontWeight: 800, fontSize: 12, letterSpacing: 1, borderRadius: radius.sm, padding: "8px 12px", flexShrink: 0, fontFamily: font.body },
  scaleTitle: { fontSize: 12, color: color.textSecondary, fontFamily: font.body, textAlign: "center" },
  scale: { display: "grid", gridTemplateColumns: "repeat(9, minmax(0,1fr))", gap: 3 },
  scaleCell: { border: "1px solid", borderRadius: 7, padding: "5px 0", textAlign: "center" },
  scaleStop: { fontSize: 13, fontWeight: 700, color: color.textPrimary, fontFamily: font.display },
  scalePts: { fontSize: 11.5, fontWeight: 700, marginTop: 2, fontFamily: font.body },
  scaleLegend: { display: "flex", flexWrap: "wrap", gap: "2px 12px", justifyContent: "center", fontSize: 10.5, color: color.textFaint, fontFamily: font.body },

  queue: { display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 2 },
  queueItem: { display: "inline-flex", alignItems: "center" },
  queueDot: { width: 30, height: 30, borderRadius: "50%", border: "2px solid", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, color: color.textPrimary, background: "#1A1F2C", fontFamily: font.body },
  queueArrow: { color: color.textFaint, fontSize: 18, margin: "0 3px" },
  queueEtc: { color: color.textFaint, fontSize: 16, marginLeft: 4 },
};
