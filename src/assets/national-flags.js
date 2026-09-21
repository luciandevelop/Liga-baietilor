// Steaguri de echipe NAȚIONALE — SEPARAT de src/assets/clubs/ (fișierul
// mare, generat, exclusiv cluburi) — cerut explicit, ca să nu amestecăm
// cele două seturi. Assets: flag-icons (MIT, github.com/lipis/flag-icons),
// copiate local în src/assets/national-flags/, redenumite după numele
// englez uzual al țării (slug), fără nicio dependență nouă în proiect —
// pachetul a fost folosit STRICT ca sursă temporară, nu e adăugat în
// package.json.
import netherlands from "./national-flags/netherlands.svg";
import germany from "./national-flags/germany.svg";
import serbia from "./national-flags/serbia.svg";
import greece from "./national-flags/greece.svg";
import norway from "./national-flags/norway.svg";
import denmark from "./national-flags/denmark.svg";
import portugal from "./national-flags/portugal.svg";
import wales from "./national-flags/wales.svg";
import italy from "./national-flags/italy.svg";
import belgium from "./national-flags/belgium.svg";
import turkey from "./national-flags/turkey.svg";
import france from "./national-flags/france.svg";
import poland from "./national-flags/poland.svg";
import bosniaAndHerzegovina from "./national-flags/bosnia-and-herzegovina.svg";
import sweden from "./national-flags/sweden.svg";
import romania from "./national-flags/romania.svg";
import czechia from "./national-flags/czechia.svg";
import croatia from "./national-flags/croatia.svg";
import england from "./national-flags/england.svg";
import spain from "./national-flags/spain.svg";
import scotland from "./national-flags/scotland.svg";
import switzerland from "./national-flags/switzerland.svg";

export const NATIONAL_FLAG_LOGOS = {
  netherlands, germany, serbia, greece, norway, denmark, portugal, wales,
  italy, belgium, turkey, france, poland,
  "bosnia-and-herzegovina": bosniaAndHerzegovina,
  sweden, romania, czechia, croatia, england, spain, scotland, switzerland,
};

// Numele AFIȘATE — în română, cerut explicit ("interfața trebuie să
// continue să afișeze numele în română").
export const NATIONAL_FLAG_NAMES = {
  netherlands: "Olanda",
  germany: "Germania",
  serbia: "Serbia",
  greece: "Grecia",
  norway: "Norvegia",
  denmark: "Danemarca",
  portugal: "Portugalia",
  wales: "Țara Galilor",
  italy: "Italia",
  belgium: "Belgia",
  turkey: "Turcia",
  france: "Franța",
  poland: "Polonia",
  "bosnia-and-herzegovina": "Bosnia și Herțegovina",
  sweden: "Suedia",
  romania: "România",
  czechia: "Cehia",
  croatia: "Croația",
  england: "Anglia",
  spain: "Spania",
  scotland: "Scoția",
  switzerland: "Elveția",
};

// Alias-uri — românește (cu/fără diacritice, slugify le normalizează
// oricum) + englezește, ca meciurile introduse cu orice variantă de
// nume să rezolve la același steag.
export const NATIONAL_FLAG_ALIASES = {
  "olanda": "netherlands",
  "netherlands": "netherlands",
  "tarile-de-jos": "netherlands",
  "germania": "germany",
  "serbia": "serbia",
  "grecia": "greece",
  "greece": "greece",
  "norvegia": "norway",
  "norway": "norway",
  "danemarca": "denmark",
  "denmark": "denmark",
  "portugalia": "portugal",
  "portugal": "portugal",
  "tara-galilor": "wales",
  "wales": "wales",
  "italia": "italy",
  "italy": "italy",
  "belgia": "belgium",
  "belgium": "belgium",
  "turcia": "turkey",
  "turkey": "turkey",
  "franta": "france",
  "france": "france",
  "polonia": "poland",
  "poland": "poland",
  "bosnia-si-hertegovina": "bosnia-and-herzegovina",
  "bosnia-herzegovina": "bosnia-and-herzegovina",
  "bosnia-and-herzegovina": "bosnia-and-herzegovina",
  "suedia": "sweden",
  "sweden": "sweden",
  "romania": "romania",
  "cehia": "czechia",
  "czechia": "czechia",
  "czech-republic": "czechia",
  "croatia": "croatia",
  "anglia": "england",
  "england": "england",
  "spania": "spain",
  "spain": "spain",
  "scotia": "scotland",
  "scotland": "scotland",
  "elvetia": "switzerland",
  "switzerland": "switzerland",
};
