import { SERIES, ALL_SERIES_IDS, FUN_ATTRIBUTES, FUN_ATTRIBUTES_PER_CARD, FUN_VALUE_MIN, FUN_VALUE_MAX } from "../playerCardConfig";

// Hash simplu, stabil — ACEEAȘI intrare produce ÎNTOTDEAUNA ACEEAȘI
// ieșire, pe orice sesiune/dispozitiv. Nu e criptografic, nu trebuie
// să fie — doar determinist.
function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function rangeFromHash(seed, min, max) {
  return min + (hashString(seed) % (max - min + 1));
}

// Seria unui card — PERMANENTĂ per user, din hash, fără nicio legătură cu
// rangul sau performanța. Icon e doar o serie ca oricare alta, la fel de
// stabilă — statutul de "cel mai bun" se exprimă prin TITLU (vezi
// resolveTitle), care evoluează liber de la o etapă la alta, nu prin
// schimbarea identității cardului. Decizie explicită, luată după ce s-a
// observat riscul: dacă Icon ar fi legată de locul #1, un user și-ar
// "pierde" cardul de îndată ce cineva îl depășește — nedorit.
export function getCardSeries(uid) {
  const idx = hashString(`${uid}:series`) % ALL_SERIES_IDS.length;
  return SERIES[ALL_SERIES_IDS[idx]];
}

// 4 din cele 8 atribute posibile, plus valori 82-99 — totul determinist,
// deci același user vede mereu exact aceleași 4 atribute cu aceleași
// valori, dar diferă de la un user la altul.
export function getFunStats(uid) {
  const ranked = FUN_ATTRIBUTES.map((attr, i) => ({ attr, key: hashString(`${uid}:funpick:${i}`) }));
  ranked.sort((a, b) => a.key - b.key);
  return ranked.slice(0, FUN_ATTRIBUTES_PER_CARD).map(({ attr }) => ({
    ...attr,
    value: rangeFromHash(`${uid}:funval:${attr.id}`, FUN_VALUE_MIN, FUN_VALUE_MAX),
  }));
}

// Cod cosmetic de "ediție" — fără nicio funcție în joc, doar senzația
// de obiect de colecție numerotat. Anul se ia automat din data curentă,
// nu trebuie actualizat manual în fiecare an.
export function getCollectionId(uid) {
  const yy = String(new Date().getFullYear() % 100).padStart(2, "0");
  const num = hashString(`${uid}:collection`) % 10000;
  return `LB-${yy}-${String(num).padStart(4, "0")}`;
}
