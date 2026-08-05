// Normalizează orice nume (echipă/competiție) la același format de slug
// folosit pentru fișierele de assets — lowercase, fără diacritice, fără
// spații/caractere speciale, kebab-case. Folosită atât la generarea
// hărților de alias-uri, cât și la runtime, quando primim un nume din
// Firestore (ex. "U Cluj", "FC Barcelona", "Inter Milan").
const DIACRITICS = {
  ă: "a", â: "a", î: "i", ș: "s", ş: "s", ț: "t", ţ: "t",
  é: "e", è: "e", ê: "e", ë: "e", á: "a", à: "a", ä: "a",
  ö: "o", ó: "o", ò: "o", ü: "u", ú: "u", ù: "u", ñ: "n",
  ç: "c", ı: "i",
};

export function slugify(name) {
  // Gardă de tip — dacă ajunge altceva decât string (număr, obiect,
  // undefined), NU crăpăm ecranul; tratăm ca "fără nume", fallback-ul
  // își face treaba normal.
  if (name === null || name === undefined) return "";
  const str = typeof name === "string" ? name : String(name);
  let s = str.toLowerCase().trim();
  for (const [from, to] of Object.entries(DIACRITICS)) {
    s = s.split(from).join(to);
  }
  s = s.replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return s;
}
