// Sigle adăugate SEPARAT de src/assets/clubs/index.js (fișierul mare,
// generat) — special ca să nu mai fie nevoie să-l înlocuiești pe-ăla
// niciodată, doar acest fișier mic, nou.
import sabahBaku from "./clubs/sabah-baku.svg";
import hapoelBeerSheva from "./clubs/hapoel-beer-sheva.svg";
import hapoelTelAviv from "./clubs/hapoel-tel-aviv.svg";
import brann from "./clubs/brann.svg";
import tromso from "./clubs/tromso.svg";

export const EXTRA_CLUB_LOGOS = {
  "sabah-baku": sabahBaku,
  "hapoel-beer-sheva": hapoelBeerSheva,
  "hapoel-tel-aviv": hapoelTelAviv,
  "brann": brann,
  "tromso": tromso,
};

export const EXTRA_CLUB_NAMES = {
  "sabah-baku": "Sabah Baku",
  "hapoel-beer-sheva": "Hapoel Beer Sheva",
  "hapoel-tel-aviv": "Hapoel Tel Aviv",
  "brann": "Brann",
  "tromso": "Tromsø",
};

export const EXTRA_CLUB_ALIASES = {
  "h-beer-sheva": "hapoel-beer-sheva",
  "beer-sheva": "hapoel-beer-sheva",
  "h-tel-aviv": "hapoel-tel-aviv",
  "hapoel-tlv": "hapoel-tel-aviv",
  "troms": "tromso",
  "tromso-il": "tromso",
};
