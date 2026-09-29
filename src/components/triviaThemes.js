// ══════════════════════════════════════════════════════════════════
// Trivia — identificarea temei VIZUALE a unei întrebări, STRICT după
// conținut (text + variante), NICIODATĂ după poziție (q1..q10 sunt
// generate după rândul din editorul Admin). Pur, fără Firestore.
// Ordinea regulilor contează: cele specifice înaintea celor generale
// (ex. întrebarea de penalty conține și „România" → penalty câștigă).
// ══════════════════════════════════════════════════════════════════
export function normalizeTriviaText(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // diacritice
    .replace(/[șş]/g, "s").replace(/[țţ]/g, "t");
}

const COUNTRY_KEYS = [
  { key: "portugalia", team: "Portugalia" },
  { key: "olanda", team: "Olanda" },
  { key: "tarile de jos", team: "Olanda" },
  { key: "anglia", team: "Anglia" },
  { key: "germania", team: "Germania" },
  { key: "franta", team: "Franța" },
  { key: "spania", team: "Spania" },
  { key: "romania", team: "România" },
  { key: "argentina", team: "Argentina" },
  { key: "italia", team: "Italia" },
];

// Echipele menționate într-un text, în ordinea apariției, fără duplicate.
export function teamsInText(s) {
  const t = normalizeTriviaText(s);
  const found = [];
  COUNTRY_KEYS
    .map((c) => ({ ...c, at: t.indexOf(c.key) }))
    .filter((c) => c.at >= 0)
    .sort((a, b) => a.at - b.at)
    .forEach((c) => { if (!found.includes(c.team)) found.push(c.team); });
  return found;
}

export function detectTriviaTheme(q) {
  const text = normalizeTriviaText(q?.text);
  const all = normalizeTriviaText(`${q?.text || ""} ${q?.optionALabel || ""} ${q?.optionBLabel || ""}`);
  const has = (...keys) => keys.some((k) => all.includes(k));
  const hasText = (...keys) => keys.some((k) => text.includes(k));

  if (has("messi", "benin")) return "goat";
  if (has("ronaldo", "cr7", "goncalo ramos", "ramos")) return "cr7";
  if (has("penalty", "penalti", "lovitura de la 11")) return "penalty";
  if (has("cartonas") && has("rosu", "rosii")) return "redcard";
  if (has("eliminat")) return "redcard";
  if (hasText("rasturnare") || (hasText("pauza") && hasText("pierde", "castiga"))) return "comeback";

  const duelTeams = ["portugalia", "olanda", "tarile de jos", "anglia", "germania"].filter((k) => all.includes(k));
  if (new Set(duelTeams.map((k) => (k === "tarile de jos" ? "olanda" : k))).size >= 3) return "duel2v2";
  if (has("franta") && has("spania")) return "vs";
  if (has("romania")) return "romania";
  if (hasText("zid", "netrecut", "fara gol primit", "clean sheet")) return "wall";
  if (hasText("festival") || (hasText("goluri") && hasText("minimum", "peste", "cel putin"))) return "goals";
  if (has("argentina")) return "goat";
  return "generic";
}
