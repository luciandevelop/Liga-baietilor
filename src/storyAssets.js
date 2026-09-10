// ══════════════════════════════════════════════════════════════════
// Căi către imaginile Stories — STATICE, în public/stories/, încărcate
// manual de Lu în GitHub, deja comprimate WebP. Niciun upload, nicio
// citire Firestore pentru asta — doar construcție de URL, din numărul
// de sezon/etapă deja cunoscut.
//
// Structură pe disc (exact cum a cerut):
//   public/stories/sezon-{N}/etapa-{N}/01.webp, 02.webp, ...
//   public/stories/sezon-{N}/sezon/01.webp, 02.webp, ...        (Story de Sezon)
// ══════════════════════════════════════════════════════════════════

export function slideUrl({ seasonNumber, etapaNumber, slideIndex }) {
  const folder = etapaNumber != null
    ? `sezon-${seasonNumber}/etapa-${etapaNumber}`
    : `sezon-${seasonNumber}/sezon`;
  const num = String(slideIndex).padStart(2, "0");
  return `/stories/${folder}/${num}.webp`;
}

// ── seasons/{id} NU are un câmp numeric de sezon — numerotarea vine
// STRICT din poziția cronologică (listSeasons(), deja folosit oricum
// pentru arhivă/selector, nicio citire nouă). Sezonul cel mai vechi
// (createdAt cel mai mic) = Sezonul 1. ──
export function seasonNumberFromList(seasonId, allSeasons) {
  const sortedAsc = [...allSeasons].sort((a, b) => {
    const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    return ta - tb;
  });
  const idx = sortedAsc.findIndex((s) => s.id === seasonId);
  return idx >= 0 ? idx + 1 : null;
}
