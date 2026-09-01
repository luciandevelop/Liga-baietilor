// Sigle adăugate SEPARAT de src/assets/clubs/index.js (fișierul mare,
// generat) — special ca să nu mai fie nevoie să-l înlocuiești pe-ăla
// niciodată, doar acest fișier mic, nou.
import sabahBaku from "./clubs/sabah-baku.svg";
import hapoelBeerSheva from "./clubs/hapoel-beer-sheva.svg";
import hapoelTelAviv from "./clubs/hapoel-tel-aviv.svg";
import brann from "./clubs/brann.svg";
import tromso from "./clubs/tromso.svg";
import borussiaDortmund from "./clubs/borussia-dortmund.svg";

export const EXTRA_CLUB_LOGOS = {
  "sabah-baku": sabahBaku,
  "hapoel-beer-sheva": hapoelBeerSheva,
  "hapoel-tel-aviv": hapoelTelAviv,
  "brann": brann,
  "tromso": tromso,
  "borussia-dortmund": borussiaDortmund,
};

export const EXTRA_CLUB_NAMES = {
  "sabah-baku": "Sabah Baku",
  "hapoel-beer-sheva": "Hapoel Beer Sheva",
  "hapoel-tel-aviv": "Hapoel Tel Aviv",
  "brann": "Brann",
  "tromso": "Tromsø",
  "borussia-dortmund": "Borussia Dortmund",
};

export const EXTRA_CLUB_ALIASES = {
  "h-beer-sheva": "hapoel-beer-sheva",
  "beer-sheva": "hapoel-beer-sheva",
  "h-tel-aviv": "hapoel-tel-aviv",
  "hapoel-tlv": "hapoel-tel-aviv",
  "troms": "tromso",
  "tromso-il": "tromso",
  // Nume scurte, uzuale — sigla EXISTĂ deja, doar înregistrată sub
  // numele complet oficial. Găsit exact: "Schalke"/"Mainz"/"AS Roma"
  // (numele pe care le tastez eu de obicei la meciuri) nu se potriveau
  // cu "schalke-04"/"mainz-05"/"roma" (slug-urile reale din fișiere).
  "schalke": "schalke-04",
  "mainz": "mainz-05",
  "as-roma": "roma",
  "dortmund": "borussia-dortmund",
  // ── Audit Speciale (Champions/Europa/Conference/ligi naționale) —
  // TOATE astea au sigla deja prezentă în clubs/, doar sub un nume
  // scurt diferit de eticheta folosită în teamRegistry.js. Nicio
  // imagine nouă necesară pentru acestea. ──
  "psv-eindhoven": "psv",
  "stuttgart": "vfb-stuttgart",
  "celta-vigo": "celta",
  "gnk-dinamo": "dinamo-zagreb",
  "ipswich-town": "ipswich",
  "racing-santander": "racing",
  "sepsi-osk": "sepsi",
  "uta-arad": "uta",
  "fc-voluntari": "voluntari",
  "sabah-fk": "sabah-baku",
  "braga": "sc-braga",
  "n-e-c": "nec-nijmegen",
  "viktoria-plze": "viktoria-plzen",
};
