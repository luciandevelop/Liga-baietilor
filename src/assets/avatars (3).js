// avatarId e stocat pe users/{uid} ca string compus "pachet/index"
// (ex: "adireal/3") — refolosește câmpul avatarId deja existent în
// schema Firestore/regulile reale, fără niciun câmp nou.
//
// Numele fișierelor reale (orice nume, orice extensie din lista
// suportată) vin din manifestul generat automat de
// scripts/generate-avatar-manifest.js — comis în git de
// .github/workflows/avatar-manifest.yml, pentru stabilitate reală între
// build-uri Vercel (vezi comentariile din script pentru detalii). NU
// există limită de câte avataruri poate avea un pachet — un jucător
// poate ajunge la 5, 8, 20, oricâte, fără nicio schimbare de cod aici.
import manifest from "./avatarManifest.generated.js";
import { S3_AVATARS } from "./s3Avatars.js";

// FALLBACK pentru compatibilitate — dacă un pachet nu apare deloc în
// manifest (ex: fișierul nu s-a regenerat încă dintr-un motiv oarecare),
// presupunem convenția veche {index}.png pentru primele 5, exact cum
// funcționa la început. Pachetele reale apar oricum corect în manifest,
// deci fallback-ul e doar o plasă de siguranță, nu calea normală.
const FALLBACK_COUNT = 5;

function filesForPack(pack) {
  const entry = manifest[pack];
  if (entry && entry.files && Object.keys(entry.files).length > 0) return entry.files;
  const fallback = {};
  for (let i = 1; i <= FALLBACK_COUNT; i++) fallback[String(i)] = `${i}.png`;
  return fallback;
}

// Parsează "pachet/index" — întoarce null dacă lipsește, e gol, sau nu
// respectă formatul (userii fără avatar personalizat au avatarId: null,
// exact cazul care trebuie să cadă pe fallback-ul cu inițiala).
// NU mai limitează indexul la un maxim fix — orice index pozitiv e
// sintactic valid; dacă acel index chiar există pentru pachet se decide
// la getAvatarUrl (unde manifestul e consultat), nu aici.
//
// Normalizează mereu pachetul la minuscule (nickname-urile pot avea
// majuscule, folderele nu).
export function parseAvatarId(avatarId) {
  if (!avatarId || typeof avatarId !== "string") return null;
  const m = /^([a-z0-9_-]+)\/([1-9][0-9]*)$/i.exec(avatarId.trim());
  if (!m) return null;
  return { pack: m[1].toLowerCase(), index: parseInt(m[2], 10) };
}

// URL-ul real, gata de pus într-un <img src>. null dacă avatarId nu
// rezolvă la nimic valid (indexul respectiv nu există în manifest —
// PlayerAvatar cade pe inițială prin onError, ca înainte).
// ══ SEZONUL 3 („Scapă cine poate”): avatarele Squid Game ══
// avatarId = "s3/<număr>" (ex. "s3/11" = Player 011). Fișierele stau în public/avatars/s3/
// și încep cu NUMĂRUL: 001.png sau 001_ghioca.png … 018_… (orice extensie de imagine).
// Se caută întâi în manifest (după numele fișierului, oricare extensie), apoi se presupune .png.
export const S3_PACK = "s3";
export const isS3Avatar = (avatarId) => parseAvatarId(avatarId)?.pack === S3_PACK;
export const s3AvatarId = (num) => `${S3_PACK}/${parseInt(num, 10)}`;
function s3Url(index) {
  const base = String(index).padStart(3, "0");
  // întâi varianta MICȘORATĂ, inclusă în cod (~30 KB); fișierele mari din public/avatars/s3 rămân doar rezervă
  if (S3_AVATARS[base]) return S3_AVATARS[base];
  const files = (manifest[S3_PACK] && manifest[S3_PACK].files) || {};
  // acceptă și nume cu text după număr: „001_ghioca.png”, „001-ghioca.jpg”, „001.webp”
  const hit = Object.values(files).find((f) => new RegExp(`^${base}(?![0-9])`).test(f));
  return `/avatars/${S3_PACK}/${encodeURIComponent(hit || `${base}.png`)}`;
}

export function getAvatarUrl(avatarId) {
  const parsed = parseAvatarId(avatarId);
  if (!parsed) return null;
  if (parsed.pack === S3_PACK) return s3Url(parsed.index);
  const files = filesForPack(parsed.pack);
  const filename = files[String(parsed.index)];
  if (!filename) return null;
  return `/avatars/${parsed.pack}/${encodeURIComponent(filename)}`;
}

// Toate variantele unui pachet — pentru grila din "Alege avatarul".
// Numărul de variante întoarse = numărul REAL de imagini din manifest
// pentru acest pachet (oricât ar fi) — grila din ProfileScreen e deja
// dinamică (`variants.map(...)` într-un CSS grid responsive), deci nu
// mai trebuie atinsă nimic acolo pentru orice număr de avataruri.
export function getAvatarPackVariants(pack) {
  if (!pack) return [];
  const files = filesForPack(pack);
  return Object.keys(files)
    .map((idx) => parseInt(idx, 10))
    .sort((a, b) => a - b)
    .map((index) => ({
      index,
      avatarId: `${pack}/${index}`,
      url: `/avatars/${pack}/${encodeURIComponent(files[String(index)])}`,
    }));
}
