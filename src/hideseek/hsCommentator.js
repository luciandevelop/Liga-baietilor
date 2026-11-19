// ══════════════════════════════════════════════════════════════════
// 🎙️ ASCUNSELEA — COMENTATORUL (pur, fără React/DOM, testat în scripts/hideSeekExtras.test.mjs)
// Replicile țin cont de ce s-a întâmplat EFECTIV în duel (uși, serii, scor), nu sunt la întâmplare.
// Nu inventează nimic: folosește doar numele și alegerile reale ale celor doi.
// Alegerea e deterministă (aceeași cheie → aceeași replică la toată lumea), fără repetări în același show.
// {H} ascunsul · {S} vânătorul · {W} câștigătorul · {L} pierzătorul · {A}/{B} perechea
// {D} ușa (cerc/triunghi/pătrat) · {Ds} simbolul · {N} un număr real (de câte ori)
// ══════════════════════════════════════════════════════════════════
import { computeTurn, computeDuel } from "../services/hideSeekEngine.js";

export const DOOR_WORD = { O: "cerc", T: "triunghi", S: "pătrat" };
export const DOOR_SYM = { O: "○", T: "△", S: "□" };

export const HS_LINES = {
  caught: [
    "Te-ai ascuns ca pula, {H}. Mai bine stăteai acasă.",
    "Trei uși și te-a găsit. {H}, ești prost cu acte.",
    "Nu te-a prins ANAF-ul, nu te-a prins Poliția… te-a prins {S}. Rușine, {H}!",
    "{S} a deschis ușa ca procurorul la percheziție. {H}, ai dreptul să taci.",
    "{S} a deschis ușa și {H} era acolo, cu pantalonii în vine.",
    "{H} s-a ascuns cu atâta talent că îl vedeai și pe Google Maps.",
    "Ce ascunzătoare de căcat, {H}. Te găsea și bunică-mea cu cataractă.",
    "PRINS! {H} respira mai tare ca un tractor.",
    "{H}, nici fosta nu te-a găsit așa repede. Bravo, {S}.",
    "{S} te-a mirosit de la trei uși distanță, {H}. Spală-te.",
    "{H} stătea după {D} ca un ficus. Decorativ și inutil.",
    "Cucu-bau, {H}! Ai fost găsit mai repede ca o factură.",
    "{H}, te-ai ascuns ca struțul: capul în nisip, curul la vedere.",
    "Bravo, {H}. Acum toată lumea știe unde te ascunzi și de nevastă."
  ],
  escaped: [
    "Nu-l găsești nici cu mandat, bă, {S}!",
    "{H} îți transmite un 🖕 din spatele ușii, {S}.",
    "{H} a dispărut mai repede decât salariul pe 15.",
    "Ai trei uși, {S}, nu trei sute. Ce dracu' cauți?",
    "{S} caută de zor. {H} deja și-a comandat shaorma.",
    "{S}, ușa e goală. Ca și capul tău.",
    "{H} stă liniștit și râde. {S} caută ca la Lidl după reducere.",
    "{S}, te-a dus de nas ca pe turiști la Vama Veche.",
    "{S} a ghicit ca la Loto: zero din trei. Bravo, campionule.",
    "{H} e invizibil. {S} e doar orb.",
    "{S} a deschis {D} și a găsit doar praf și rușine.",
    "Gol. Pustiu. Ca portofelul lui {S} după weekend.",
    "{S} a nimerit ușa greșită cu o precizie de chirurg beat.",
    "Nimic după {D}, {S}. Doar ecoul prostiei tale."
  ],
  // ── replici pe context (statistici reale) ──
  sameDoorCatch: [
    "A {N}-a oară când {S} prinde pe cineva la {D}. Ușa aia e a lui acum.",
    "{S} la {D}: {N} prinderi. Ăsta nu mai e noroc, e abonament.",
    "Iar la {D}! {N} prinderi acolo. {H}, nu înveți nimic?",
  ],
  predictableCaught: [
    "{H} s-a ascuns de {N} ori la {D}. Ți-a luat {S} și buletinul.",
    "{N} ori la {D}, {H}? Previzibil ca un meci al Rapidului cu arbitrajul.",
    "{H} are o relație serioasă cu {D}. {N} întâlniri. {S} a venit la nuntă.",
  ],
  predictableEscaped: [
    "{H} stă iar la {D}, a {N}-a oară. Și {S} tot nu se prinde. Jale.",
    "De {N} ori la {D} și {S} nu l-a căutat acolo. Orb cu certificat.",
  ],
  escapeStreak: [
    "{N} evadări la rând pentru {H}. Houdini de Pantelimon.",
    "{H} a scăpat de {N} ori la rând. {S}, ia-ți ochelari.",
    "Seria lui {H}: {N} scăpări. {S} caută mai prost ca un GPS fără semnal.",
  ],
  blindSeeker: [
    "{S} n-a nimerit nimic de {N} ori la rând. Bastonul alb e pe drum.",
    "{N} uși greșite la rând. {S}, ăsta nu e joc, e terapie.",
    "{S}: {N} încercări, {N} ratări. Statistică de Dinamo.",
    "{S} deschide uși ca un portar de bloc beat: {N} la rând, nimic.",
  ],
  firstCatchAfterDrought: [
    "În sfârșit! După {N} ratări, {S} prinde și el ceva. Mai puțin covid.",
    "{S} a nimerit după {N} încercări. Până și ceasul stricat are dreptate de două ori pe zi.",
  ],
  // ── finaluri de tură ──
  shutout: [
    "6–0. Ăsta nu e duel, e bătaie cu public.",
    "6–0! {L}, sună-ți mama și spune-i că ți-ai pierdut demnitatea.",
    "Curat 6–0. {W} l-a șters pe {L} de pe hartă.",
  ],
  rout: [
    "{W} câștigă tura la scor de neprezentare. {L}, ai fost măcar acolo?",
    "Execuție publică. {W} a făcut din {L} preș de intrare.",
    "5–1 pentru {W}. {L} a luat un punct din milă."
  ],
  tie: [
    "3–3. Doi proști, același nivel. Împărțiți frățește.",
    "3–3. Ați jucat ca la nunta lui văru': mult zgomot, niciun câștigător.",
    "Egalitate. Nici unul nu-i mai deștept, doar la fel de varză.",
    "3–3. Remiză de cartier: nimeni nu pleacă acasă mândru."
  ],
  comebackTurn: [
    "Revenire! {W} era la pământ și a întors tura. {L}, ai adormit la volan.",
    "{L} conducea și s-a apucat de cântat. {W} a luat tot.",
  ],
  turnWin: [
    "{W} ia tura. {L}, mai încearcă, poate la anul.",
    "{W} câștigă tura. {L} e încă în labirint și caută ieșirea de la baie.",
    "Tura e a lui {W}. {L} pleacă acasă cu ochii în pământ.",
    "{W} ia tura. {L} cere VAR, dar VAR-ul râde.",
    "Tura merge la {W}. {L}, du-te și te ascunde de rușine."
  ],
  lastTurn: [
    "ULTIMA TURĂ. 30 de puncte. Cine se cacă pe el acum pierde tot.",
    "EXIT-ul e aproape. 30 de puncte pe masă și nervii la pământ.",
  ],
  exit: [
    "{W} a ieșit pe EXIT și ți-a lăsat un 🖕 pe ușă, {L}.",
    "EXIT! {W} pleacă acasă. {L} rămâne în labirint să-și caute creierul.",
  ],
  forfeit: [
    "{L} n-a mai apărut. {W} ia turele rămase din oficiu. Fricosule!",
    "{L} a fugit de-acasă. Turele rămase sunt ale lui {W}.",
    "{L} a dispărut ca tatăl care a ieșit după țigări. {W} încasează tot."
  ],
  finalWin: [
    "{W} e regele labirintului. {L} e doar decor.",
    "{W} câștigă duelul. {L}, du-te și plânge pe WhatsApp.",
    "{W} a câștigat. {L} e invitat oficial să dea berea."
  ],
  finalRout: [
    "{W} {N}, {L} aproape nimic. Asta a fost o umilință cu acte în regulă.",
  ],
  finalComeback: [
    "Revenirea săptămânii! {L} conducea și a dat cu bâta-n baltă. {W} câștigă.",
  ],
  finalTie: [
    "Egalitate pe toată linia. V-ați meritat unul pe altul.",
    "Egalitate. Doi luptători, zero glorie, o bere împărțită."
  ],
  draw: [
    "{A} vs {B}. Unul se ascunde, celălalt dă vina pe arbitru.",
    "{A} contra {B}. Pregătiți scuzele de pe acum.",
    "{A} și {B}: doi oameni, trei uși, zero creier.",
    "{A} vs {B}. Pariem că amândoi se ascund la cerc.",
    "{A} vs {B}. Unul iese pe EXIT, celălalt din grupul de WhatsApp.",
    "{A} contra {B}. Nici ANAF-ul nu v-ar găsi, da' unul tot pică.",
    "{A} vs {B}. Duelul rușinii începe acum.",
    "{A} și {B}. Cine pierde dă berea. Și scuzele.",
    "{A} vs {B}. Unul e vânător, celălalt e cină.",
    "{A} contra {B}. Să curgă rușinea.",
  ],
};

// Baloane scurte de vorbă (deasupra personajelor)
export const HS_BUBBLES = {
  hiderCaught: ["Nu e ce pare!", "Mă scărpinam!", "Futu-i…", "Mamăăă!", "Era să fie!"],
  seekerCatch: ["TE-AM VĂZUT!", "Cucu-bau!", "Gata, ești al meu!", "Hai afară!"],
  hiderEscape: ["🖕", "Pa, fraiere!", "Caută-mă la mama!", "Ha-ha!", "Rece, rece…"],
  seekerMiss: ["Unde pula mea ești?!", "Nu se poate!", "Trișează!", "Ce dracu'…"],
  turnWin: ["Cine e tata?!", "Ușor!", "La fel și la anul!"],
  turnLose: ["Arbitru!", "M-a durut burta…", "Revanșa!"],
};

const fnv = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const fill = (tpl, v) => tpl.replace(/\{(\w+)\}/g, (_, k) => (v[k] !== undefined ? String(v[k]) : ""));

// Comentatorul unui duel. names = { A: "Lu", B: "Cristi" }, key = cheie stabilă (ex. "gw9_0").
export function createCommentator(names, key = "x") {
  const used = {};
  const st = {
    catchAtDoor: { A: {}, B: {} },  // prinderi făcute de X (ca vânător), pe ușă
    hideAt: { A: {}, B: {} },       // de câte ori s-a ascuns X la ușă
    escStreak: { A: 0, B: 0 },      // evadări consecutive ale lui X (ca ascuns)
    missStreak: { A: 0, B: 0 },     // ratări consecutive ale lui X (ca vânător)
    totals: { A: 0, B: 0 }, leadHist: [],
  };
  function pick(cat, vars, salt = "") {
    const list = HS_LINES[cat]; if (!list?.length) return "";
    used[cat] = used[cat] || new Set();
    if (used[cat].size >= list.length) used[cat].clear();
    let i = fnv(`${key}|${cat}|${salt}`) % list.length;
    for (let n = 0; n < list.length && used[cat].has(i); n++) i = (i + 1) % list.length;
    used[cat].add(i);
    return fill(list[i], vars);
  }
  const nm = (side) => names[side] || side;
  return {
    // Confruntarea unei ture: { hider, seeker, hideDoor, seekDoor, caught }, turn (1–5), k (0–5)
    event(ev, turn, k) {
      const H = ev.hider, S = ev.seeker, d = ev.hideDoor;
      st.hideAt[H][d] = (st.hideAt[H][d] || 0) + 1;
      const vars = { H: nm(H), S: nm(S), D: DOOR_WORD[d], Ds: DOOR_SYM[d] };
      const salt = `${turn}.${k}`;
      let cat; let n;
      if (ev.caught) {
        const prevMiss = st.missStreak[S];
        st.catchAtDoor[S][d] = (st.catchAtDoor[S][d] || 0) + 1; st.escStreak[H] = 0; st.missStreak[S] = 0;
        if (st.catchAtDoor[S][d] >= 3) { cat = "sameDoorCatch"; n = st.catchAtDoor[S][d]; }
        else if (st.hideAt[H][d] >= 3) { cat = "predictableCaught"; n = st.hideAt[H][d]; }
        else if (prevMiss >= 3) { cat = "firstCatchAfterDrought"; n = prevMiss; }
        else cat = "caught";
      } else {
        st.escStreak[H] += 1; st.missStreak[S] += 1;
        vars.D = DOOR_WORD[ev.seekDoor]; vars.Ds = DOOR_SYM[ev.seekDoor];
        if (st.escStreak[H] >= 3 && st.escStreak[H] % 2 === 1) { cat = "escapeStreak"; n = st.escStreak[H]; }
        else if (st.missStreak[S] >= 3 && st.missStreak[S] % 2 === 0) { cat = "blindSeeker"; n = st.missStreak[S]; }
        else if (st.hideAt[H][d] >= 3) { cat = "predictableEscaped"; n = st.hideAt[H][d]; vars.D = DOOR_WORD[d]; }
        else cat = "escaped";
      }
      return { category: cat, text: pick(cat, { ...vars, N: n }, salt) };
    },
    // Finalul unei ture: winsA/winsB, ptsA/ptsB, timeline = câștigătorii celor 6 confruntări ["A","B",...]
    turnEnd(turn, winsA, winsB, ptsA, ptsB, timeline = []) {
      st.totals.A += ptsA; st.totals.B += ptsB; st.leadHist.push(st.totals.A - st.totals.B);
      if (winsA === winsB) return { category: "tie", text: pick("tie", {}, `t${turn}`) };
      const W = winsA > winsB ? "A" : "B"; const L = W === "A" ? "B" : "A";
      const v = { W: nm(W), L: nm(L) };
      if (Math.max(winsA, winsB) === 6) return { category: "shutout", text: pick("shutout", v, `t${turn}`) };
      // revenire: câștigătorul a fost condus cu 2 confruntări în timpul turei
      let a = 0, b = 0, behind = 0; timeline.forEach((x) => { if (x === "A") a++; else b++; behind = Math.max(behind, W === "A" ? b - a : a - b); });
      if (behind >= 2) return { category: "comebackTurn", text: pick("comebackTurn", v, `t${turn}`) };
      if (turn === 5) return { category: "exit", text: pick("exit", v, `t${turn}`) };
      if (Math.max(winsA, winsB) === 5) return { category: "rout", text: pick("rout", v, `t${turn}`) };
      return { category: "turnWin", text: pick("turnWin", v, `t${turn}`) };
    },
    lastTurn() { return { category: "lastTurn", text: pick("lastTurn", {}, "last") }; },
    forfeit(winnerSide) { const W = winnerSide, L = W === "A" ? "B" : "A"; return { category: "forfeit", text: pick("forfeit", { W: nm(W), L: nm(L) }, "ff") }; },
    // Final: totaluri reale; comeback = câștigătorul a fost în urmă la puncte după o tură jucată
    final(totalA, totalB) {
      if (totalA === totalB) return { category: "finalTie", text: pick("finalTie", {}, "fin") };
      const W = totalA > totalB ? "A" : "B"; const L = W === "A" ? "B" : "A"; const v = { W: nm(W), L: nm(L), N: Math.max(totalA, totalB) };
      const wasBehind = st.leadHist.some((x) => (W === "A" ? x < 0 : x > 0));
      if (wasBehind) return { category: "finalComeback", text: pick("finalComeback", v, "fin") };
      if (Math.abs(totalA - totalB) >= 70) return { category: "finalRout", text: pick("finalRout", v, "fin") };
      return { category: "finalWin", text: pick("finalWin", v, "fin") };
    },
    draw(a, b, i) { return pick("draw", { A: a, B: b }, `d${i}`); },
  };
}

export function pickBubble(kind, salt) { const l = HS_BUBBLES[kind] || [""]; return l[fnv(`${kind}|${salt}`) % l.length]; }

// ══════════════════════════════════════════════════════════════════
// 🏅 TITLURI (decorative, fără puncte). Se calculează DOAR din turele jucate de ambii
// (alegeri reale ale amândurora). Turele câștigate din oficiu nu contează la prinderi.
//  👻 FANTOMA — a jucat toate cele 5 ture și n-a fost prins niciodată. Pot fi mai mulți (titlu împărțit).
//  🐕 CÂINELE DE VÂNĂTOARE — cele mai multe prinderi (minimum 1). Egalitate → rata de prindere
//     (prinderi / căutări) mai mare; dacă tot e egal → titlu împărțit.
//  🤡 FRAIERUL SĂPTĂMÂNII — prins de cele mai multe ori (minimum 1). Egalitate → rata de prindere
//     (prins / ascunderi) mai mare; dacă tot e egal → titlu împărțit.
// byPair = { [pairIdx]: { [turn]: { A: {hide,seek}, B: {hide,seek} } } }
// ══════════════════════════════════════════════════════════════════
const okPick = (p) => !!p && Array.isArray(p.hide) && Array.isArray(p.seek) && p.hide.length === 3 && p.seek.length === 3 && !p.secret;
export function computeStats(game, byPair) {
  const s = {};
  const z = () => ({ played: 0, hides: 0, caught: 0, escapes: 0, seeks: 0, catches: 0 });
  (game?.pairs || []).forEach((p, i) => {
    s[p.a] = s[p.a] || z(); s[p.b] = s[p.b] || z();
    for (let t = 1; t <= 5; t++) {
      const x = byPair?.[i]?.[t]; if (!okPick(x?.A) || !okPick(x?.B)) continue;
      s[p.a].played++; s[p.b].played++;
      for (let k = 0; k < 3; k++) {
        const c1 = x.A.hide[k] === x.B.seek[k]; // A ascuns, B caută
        const c2 = x.B.hide[k] === x.A.seek[k]; // B ascuns, A caută
        s[p.a].hides++; s[p.b].seeks++; if (c1) { s[p.a].caught++; s[p.b].catches++; } else s[p.a].escapes++;
        s[p.b].hides++; s[p.a].seeks++; if (c2) { s[p.b].caught++; s[p.a].catches++; } else s[p.b].escapes++;
      }
    }
  });
  return s;
}
function best(stats, val, rate) {
  const c = Object.entries(stats).filter(([, x]) => x.played > 0 && val(x) >= 1);
  if (!c.length) return [];
  const top = Math.max(...c.map(([, x]) => val(x))); let tied = c.filter(([, x]) => val(x) === top);
  if (tied.length > 1) { const r = Math.max(...tied.map(([, x]) => rate(x))); tied = tied.filter(([, x]) => Math.abs(rate(x) - r) < 1e-9); }
  return tied.map(([u]) => u);
}
export function computeTitles(game, byPair) {
  const stats = computeStats(game, byPair);
  const ghost = Object.entries(stats).filter(([, x]) => x.played === 5 && x.caught === 0).map(([u]) => u);
  const hunter = best(stats, (x) => x.catches, (x) => (x.seeks ? x.catches / x.seeks : 0));
  const loser = best(stats, (x) => x.caught, (x) => (x.hides ? x.caught / x.hides : 0));
  return { stats, ghost, hunter, loser };
}
export const HS_TITLES = [
  { key: "ghost", icon: "👻", name: "FANTOMA", rule: "A jucat toate cele 5 ture și n-a fost prins niciodată." },
  { key: "hunter", icon: "🐕", name: "CÂINELE DE VÂNĂTOARE", rule: "Cele mai multe prinderi." },
  { key: "loser", icon: "🤡", name: "FRAIERUL SĂPTĂMÂNII", rule: "Prins de cele mai multe ori." },
];

// Datele cartonașului pentru o tură JUCATĂ (aceeași replică pe care o dă și show-ul).
export function turnCardData(picks, closed, t, A, B, key, level) {
  const duel = computeDuel(picks || {}, closed); const x = duel.turns[t - 1]; if (!x || x.status !== "played") return null;
  const com = createCommentator({ A: A.nick, B: B.nick }, key); let te = null;
  for (let n = 1; n <= t; n++) {
    const y = duel.turns[n - 1]; if (y.status !== "played") continue;
    const r = computeTurn(picks[n].A, picks[n].B); r.events.forEach((ev, k) => com.event(ev, n, k));
    const e = com.turnEnd(n, r.winsA, r.winsB, y.ptsA, y.ptsB, r.events.map((v) => v.winner)); if (n === t) te = { r, e };
  }
  return { A, B, turn: t, level, winsA: te.r.winsA, winsB: te.r.winsB, ptsA: x.ptsA, ptsB: x.ptsB, result: te.r.result, quip: te.e.text };
}
