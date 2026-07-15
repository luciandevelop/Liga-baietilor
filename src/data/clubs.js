// Mapping central de cluburi — nume standard, aliasuri acceptate, URL direct
// de siglă. Aplicație privată, între prieteni — sigle preluate temporar de pe
// o sursă publică externă (Logowik), verificate manual (fiecare URL a fost
// testat efectiv, răspunde cu imagine reală, nu pagină HTML).
export const CLUBS = {
  inter: {
    name: "Inter",
    aliases: ["inter", "inter milan", "internazionale", "fc internazionale"],
    logoUrl: "https://logowik.com/content/uploads/images/fc-internazionale-milano8706.logowik.com.webp",
  },
  barcelona: {
    name: "Barcelona",
    aliases: ["barcelona", "fc barcelona", "barça", "barca"],
    logoUrl: "https://logowik.com/content/uploads/images/802_fcbarcelona.jpg",
  },
  "real-madrid": {
    name: "Real Madrid",
    aliases: ["real madrid", "real madrid cf", "madrid"],
    logoUrl: "https://logowik.com/content/uploads/images/545_realmadridfc.jpg",
  },
  arsenal: {
    name: "Arsenal",
    aliases: ["arsenal", "arsenal fc"],
    logoUrl: "https://logowik.com/content/uploads/images/721_arsenalfc.jpg",
  },
};

function normalize(str) {
  return String(str || "").trim().toLowerCase().replace(/\s+/g, " ");
}

// Găsește clubul după orice denumire (nume standard sau alias), fără
// sensibilitate la majuscule/spații. Nu aruncă niciodată eroare — dacă
// echipa nu e încă în mapping, întoarce null, iar componenta care
// folosește asta trebuie să trateze cazul cu un fallback vizual.
export function getClubByName(teamName) {
  const n = normalize(teamName);
  if (!n) return null;
  for (const key of Object.keys(CLUBS)) {
    const club = CLUBS[key];
    if (club.aliases.some((alias) => normalize(alias) === n)) {
      return { key, ...club };
    }
  }
  return null;
}
