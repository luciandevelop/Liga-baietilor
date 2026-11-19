// ══════════════════════════════════════════════════════════════════
// 🚪 ASCUNSELEA — motorul (funcții PURE, fără Firestore, testabile).
// Aceeași sursă de adevăr pentru: ecranul jucătorului (live), show,
// panoul Admin și rezolvarea oficială a punctelor.
//
// Regulament aprobat (Sezonul 3, Surpriză Mică, max 100 PCT):
// • perechi aleatorii, trase o singură dată; număr impar → BYE = 50 PCT fix
// • 5 ture; în fiecare tură fiecare jucător se ascunde de 3 ori și caută de 3 ori
// • uși: ○ CERC · △ TRIUNGHI · □ PĂTRAT; aceeași ușă = PRINS (câștigă vânătorul),
//   altfel A SCĂPAT (câștigă cel ascuns) → 6 confruntări pe tură
// • câștigătorul turei (mai multe confruntări câștigate) ia toată valoarea turei:
//   15 · 15 · 20 · 20 · 30 = 100; la 3–3 fiecare ia jumătate, rotunjit în sus:
//   8 · 8 · 10 · 10 · 15; fără departajare, fără bonus de duel
// • tura următoare se deschide doar după ce AMÂNDOI au confirmat tura curentă
// • la termen: cine a confirmat tura la care a rămas blocat câștigă toate turele
//   rămase (valoare întreagă); cel absent ia 0; dacă lipsesc amândoi → 0 / 0
// ══════════════════════════════════════════════════════════════════

export const HS_TYPE_ID = "hide-seek";
export const HS_NAME = "🚪 Ascunselea";
export const HS_TURNS = 5;
export const HS_PER_TURN = 3; // ascunzători (și căutări) per jucător, per tură
export const HS_DOORS = ["O", "T", "S"]; // ○ cerc · △ triunghi · □ pătrat
export const HS_DOOR_SYMBOL = { O: "○", T: "△", S: "□" };
export const HS_DOOR_NAME = { O: "CERC", T: "TRIUNGHI", S: "PĂTRAT" };
export const HS_TURN_VALUES = [15, 15, 20, 20, 30];
export const HS_TIE_VALUES = HS_TURN_VALUES.map((v) => Math.ceil(v / 2)); // 8 · 8 · 10 · 10 · 15
export const HS_BYE_POINTS = 50;
export const HS_LEVELS = ["HOLUL DE INTRARE", "SCĂRILE ÎNCRUCIȘATE", "LABIRINTUL", "TURNUL", "EXIT"];

export const isDoor = (d) => HS_DOORS.includes(d);
export function isValidPick(p) {
  return !!p && Array.isArray(p.hide) && Array.isArray(p.seek)
    && p.hide.length === HS_PER_TURN && p.seek.length === HS_PER_TURN
    && p.hide.every(isDoor) && p.seek.every(isDoor);
}

// O tură între A și B. Ordinea celor 6 confruntări (pentru show): A se ascunde, B se ascunde, alternativ.
export function computeTurn(pickA, pickB) {
  // Două reprize: întâi B caută de 3 ori (A se ascunde), apoi A caută de 3 ori (B se ascunde).
  // A i-a ascunzătoare a lui A se întâlnește cu a i-a căutare a lui B (și invers). Ordinea nu schimbă punctajul.
  const events = [];
  for (let k = 0; k < HS_PER_TURN; k++) {
    const c = pickA.hide[k] === pickB.seek[k];
    events.push({ k: events.length, half: 1, round: k + 1, hider: "A", seeker: "B", hideDoor: pickA.hide[k], seekDoor: pickB.seek[k], caught: c, winner: c ? "B" : "A" });
  }
  for (let k = 0; k < HS_PER_TURN; k++) {
    const c = pickB.hide[k] === pickA.seek[k];
    events.push({ k: events.length, half: 2, round: k + 1, hider: "B", seeker: "A", hideDoor: pickB.hide[k], seekDoor: pickA.seek[k], caught: c, winner: c ? "A" : "B" });
  }
  const winsA = events.filter((e) => e.winner === "A").length;
  const winsB = events.length - winsA;
  return { events, winsA, winsB, result: winsA > winsB ? "A" : winsB > winsA ? "B" : "T" };
}

export function turnPoints(turnIndex, result) {
  const v = HS_TURN_VALUES[turnIndex]; const t = HS_TIE_VALUES[turnIndex];
  if (result === "A") return [v, 0];
  if (result === "B") return [0, v];
  if (result === "T") return [t, t];
  return [0, 0];
}

// Duelul complet. picks: { [turn 1..5]: { A?: pick, B?: pick } }. closed = termenul a trecut / rezolvat.
// status per tură: played · forfeitA (A prezent, B absent → câștigă A) · forfeitB · void (niciunul) · open · waitA (A a
// confirmat, așteaptă B) · waitB · locked (nu s-a ajuns încă).
export function computeDuel(picks, closed = false) {
  const turns = []; let totalA = 0; let totalB = 0; let stopped = null; let currentTurn = null;
  for (let t = 1; t <= HS_TURNS; t++) {
    const i = t - 1; const pa = picks?.[t]?.A; const pb = picks?.[t]?.B;
    const okA = isValidPick(pa); const okB = isValidPick(pb);
    if (stopped) {
      const [a, b] = stopped === "A" ? [HS_TURN_VALUES[i], 0] : stopped === "B" ? [0, HS_TURN_VALUES[i]] : [0, 0];
      turns.push({ turn: t, status: stopped === "A" ? "forfeitA" : stopped === "B" ? "forfeitB" : stopped === "none" ? "void" : "locked", ptsA: a, ptsB: b });
      totalA += a; totalB += b; continue;
    }
    if (okA && okB) {
      const r = computeTurn(pa, pb); const [a, b] = turnPoints(i, r.result);
      turns.push({ turn: t, status: "played", ...r, ptsA: a, ptsB: b }); totalA += a; totalB += b; continue;
    }
    currentTurn = t;
    if (!closed) {
      turns.push({ turn: t, status: okA ? "waitB" : okB ? "waitA" : "open", ptsA: 0, ptsB: 0 });
      stopped = "pending";
      continue;
    }
    // termenul a trecut: cine a confirmat tura la care a rămas blocat ia tura asta și toate cele rămase
    stopped = okA && !okB ? "A" : okB && !okA ? "B" : "none";
    const [a, b] = stopped === "A" ? [HS_TURN_VALUES[i], 0] : stopped === "B" ? [0, HS_TURN_VALUES[i]] : [0, 0];
    turns.push({ turn: t, status: stopped === "A" ? "forfeitA" : stopped === "B" ? "forfeitB" : "void", ptsA: a, ptsB: b });
    totalA += a; totalB += b;
  }
  const played = turns.filter((x) => x.status === "played").length;
  const finished = closed || played === HS_TURNS;
  return {
    turns, totalA, totalB, played, currentTurn, finished,
    winner: !finished ? null : totalA > totalB ? "A" : totalB > totalA ? "B" : "T",
  };
}

// Tragerea la sorți: Fisher-Yates cu o sursă de aleatoriu (implicit crypto). Perechi consecutive; impar → BYE.
export function drawPairs(uids, rand = cryptoRand) {
  const a = [...uids];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  const pairs = []; let bye = null;
  for (let i = 0; i < a.length; i += 2) {
    if (i + 1 < a.length) pairs.push({ a: a[i], b: a[i + 1] }); else bye = a[i];
  }
  return { pairs, bye };
}
function cryptoRand() {
  try { const x = new Uint32Array(1); globalThis.crypto.getRandomValues(x); return x[0] / 4294967296; } catch { return Math.random(); }
}

// Punctele oficiale pentru toți (la Rezolvă): { uid: points }. picksByPair: { [pairIndex]: picks (format computeDuel) }.
export function computeAllPoints(game, picksByPair, closed = true) {
  const out = {};
  (game?.pairs || []).forEach((p, idx) => {
    const d = computeDuel(picksByPair?.[idx] || {}, closed);
    out[p.a] = d.totalA; out[p.b] = d.totalB;
  });
  if (game?.bye) out[game.bye] = HS_BYE_POINTS;
  return out;
}

// ── REPLICI (caterincă între prieteni, adulți) — alese DETERMINIST după cheie, ca toată lumea să vadă aceeași replică ──
// {H} = cel ascuns · {S} = vânătorul · {W} = câștigătorul · {L} = pierzătorul · {A}/{B} = cei doi din pereche
export const HS_QUIPS = {
  caught: [
    "Te-ai ascuns ca pula, {H}. Mai bine stăteai acasă.",
    "Trei uși și te-a găsit. {H}, ești prost cu acte.",
    "{S} a deschis ușa și {H} era acolo, cu pantalonii în vine. Rușine națională!",
    "{H}, te-ai ascuns în spatele unei uși, nu în altă țară. Normal că te-a prins.",
    "PRINS! {H} respira mai tare ca un tractor. {S} nici n-a trebuit să ghicească.",
    "{S} te-a mirosit de la trei uși distanță, {H}. Spală-te.",
    "Ce ascunzătoare de căcat, {H}. Te găsea și bunică-mea cu cataractă.",
    "{H}, nu te ascunde unde te-ai ascunde tu. Asta a fost toată strategia. Și n-ai avut-o.",
    "{S} a intrat ca la el acasă. {H}, du-te și te culcă.",
  ],
  escaped: [
    "Nu-l găsești nici cu mandat, bă, {S}!",
    "{H} îți transmite un 🖕 din spatele ușii.",
    "Ai trei uși, {S}, nu 300. Ce dracu' cauți?",
    "{S} a deschis ușa greșită cu o încredere de parcă știa ceva. Nu știa nimic.",
    "A SCĂPAT! {H} e fantomă, {S} e doar un turist rătăcit.",
    "{S}, ușa e goală, ca și capul tău.",
    "{H} stă liniștit și râde. {S} caută ca la Lidl după reducere.",
    "{S}, ai ghicit ca la Loto: zero din trei. Bravo, campionule.",
    "{H} e invizibil. {S} e doar orb.",
  ],
  tie: [
    "3–3. Doi proști, același nivel. Împărțiți frățește.",
    "Egalitate. {A} și {B}, nici unul nu-i mai deștept, doar la fel de varză.",
    "3–3. Ați jucat ca la nunta lui văru': mult zgomot, niciun câștigător.",
    "Remiză. Nimeni nu moare azi, dar nici nu e cineva fericit.",
  ],
  rout: [
    "Asta nu e duel, e bătaie cu public. {W} l-a șters pe {L} de pe hartă.",
    "{L}, te-a jucat ca pe un copil la grădiniță. {W} nici n-a transpirat.",
    "Execuție publică. {L}, sună-ți mama și spune-i că ai pierdut demnitatea.",
  ],
  comeback: [
    "Revenire de film! {W} era mort și îngropat, acum dansează pe mormântul lui {L}.",
    "{L} deja își număra punctele. {W} i le-a luat din buzunar.",
  ],
  lastTurn: [
    "ULTIMA TURĂ. 30 de puncte. Cine se cacă pe el acum pierde tot.",
    "Tura 5. Ușa EXIT e acolo. Doar unul iese cu capul sus.",
  ],
  exit: [
    "{W} a ieșit pe EXIT și ți-a lăsat un 🖕 pe ușă, {L}.",
    "EXIT! {W} pleacă acasă. {L} rămâne în labirint să-și caute creierul.",
    "{W} trece pe ușa EXIT ca un boss. {L}, stinge lumina când pleci.",
  ],
  finalWin: [
    "{W} câștigă duelul. {L}, du-te și plânge pe WhatsApp.",
    "Victorie pentru {W}. {L} se întoarce la grupă cu coada între picioare.",
    "{W} e regele labirintului. {L} e doar decor.",
  ],
  finalTie: [
    "Egalitate totală. Ați stat o săptămână prin uși ca să rămâneți la fel de proști.",
    "Remiză finală. {A} și {B}, faceți-vă cadou unul altuia o hartă.",
  ],
  draw: [
    "{A} vs {B}. Unul se ascunde, celălalt plânge.",
    "{A} contra {B}. Pregătiți scuzele de pe acum.",
    "{A} și {B}: doi oameni, trei uși, zero creier.",
    "{A} vs {B}. Pariem că amândoi se ascund la cerc.",
    "{A} contra {B}. Cine pierde dă berea.",
    "{A} vs {B}. Ăsta nu e meci, e terapie de cuplu.",
    "{A} contra {B}. Labirintul are uși, voi aveți doar noroc.",
    "{A} vs {B}. Sunați-vă mamele, s-ar putea să nu mai ieșiți.",
    "{A} contra {B}. Fără milă, fără creier, fără scăpare.",
  ],
};
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function pickQuip(kind, key, names = {}) {
  const list = HS_QUIPS[kind] || []; if (!list.length) return "";
  const q = list[hash(`${kind}|${key}`) % list.length];
  return q.replace(/\{(\w)\}/g, (_, k) => names[k] || "");
}
