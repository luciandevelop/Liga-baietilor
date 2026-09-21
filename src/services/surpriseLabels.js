// ── Mapping central type → nume afișat, pentru transparența
// punctajului. Reutilizează STRICT cataloagele existente
// (MAIN_CATALOG/BONUS_CATALOG din surprisesService.js) — nu inventează
// denumiri noi. Fișier NEUTRU (nu importă din adminService.js și nu e
// importat de el) — evită orice risc de dependință circulară; e
// folosit STRICT din stratul UI (PlayerCard, registrul general), care
// poate importa liber din ambele servicii. ──
import { MAIN_CATALOG, BONUS_CATALOG } from "./surprisesService";
import { LONE_WOLF_EXCLUDED_GAMEWEEK_IDS } from "./scoringEngine";

const LABEL_BY_TYPE = {};
[...MAIN_CATALOG, ...BONUS_CATALOG].forEach((c) => { LABEL_BY_TYPE[c.id] = c.label; });

// Etapa 1 — singura excepție istorică (documentul `secret` nu mai
// există pentru ea, confirmat manual în Firestore). Folosim EXACT
// același ID deja verificat manual cu Lu (scoringEngine.js), nu un
// hardcode separat. STRICT etichetă — punctajele rămân întotdeauna
// din gameweekScores, niciodată din acest fallback.
const GAMEWEEK_1_ID = [...LONE_WOLF_EXCLUDED_GAMEWEEK_IDS][0];

/**
 * Numele afișat al unei Surprize, din type-ul persistat.
 * kind: "main" | "bonus" — folosit STRICT pentru fallback-ul Etapei 1.
 * Returnează null dacă tipul e necunoscut/lipsă și nu există fallback
 * — UI-ul decide cum arată eticheta generică în acest caz.
 */
export function getSurpriseTypeLabel(type, kind, gameweekId) {
  if (type && LABEL_BY_TYPE[type]) return LABEL_BY_TYPE[type];
  if (gameweekId === GAMEWEEK_1_ID) {
    if (kind === "main") return "Duel 1 vs 1";
    if (kind === "bonus") return "Roata Norocului";
  }
  return null;
}
