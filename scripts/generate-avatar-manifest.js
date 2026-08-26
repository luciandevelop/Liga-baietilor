// Rulează AUTOMAT înainte de fiecare build (vite build) ȘI e rulat de
// GitHub Action-ul .github/workflows/avatar-manifest.yml la fiecare push
// care atinge public/avatars/**.
//
// CRITIC pentru stabilitate: citește manifestul EXISTENT (deja commis în
// git) ca punct de plecare, NU regenerează totul de la zero din sortare
// alfabetică. Un index o dată alocat unui fișier RĂMÂNE alocat acelui
// fișier pentru totdeauna, cât timp fișierul respectiv există pe disc —
// indiferent unde ar cădea alfabetic un fișier nou adăugat ulterior.
// Fișierele noi (nevăzute în manifestul vechi) primesc următorul index
// liber, în ordine (alfabetică între ele, dacă sunt mai multe deodată).
//
// De ce contează asta: Vercel clonează repo-ul din git la fiecare build —
// dacă manifestul generat n-ar fi PERSISTAT în git, fiecare build ar
// porni "orb", fără să știe ce indexuri au fost deja atribuite, și ar
// risca să realoce alt fișier la un index deja folosit de cineva
// (avatarId salvat în Firestore ar ajunge să arate altă poză). De-aia
// GitHub Action-ul comite manifestul înapoi în repo după fiecare
// modificare — acest script, rulat DOAR la build (fără Action), nu ar
// garanta persistență reală.
import { readdirSync, statSync, mkdirSync, writeFileSync, existsSync } from "fs";
import { join, extname } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const AVATARS_DIR = join(__dirname, "..", "public", "avatars");
const OUTPUT_FILE = join(__dirname, "..", "src", "assets", "avatarManifest.generated.js");

const SUPPORTED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];

function isSupportedImage(filename) {
  return SUPPORTED_EXTENSIONS.includes(extname(filename).toLowerCase());
}

// Citește manifestul deja generat (commis în git, din build-ul anterior)
// ca să pornim de la el, nu de la zero — un import ES module normal
// (fișierul e cod JS valid, generat de noi înșine), nu parsare fragilă
// de text. Dacă nu există încă (primul build vreodată) sau nu poate fi
// încărcat, pornim de la un manifest gol — fiecare pachet se comportă
// atunci ca "nou", exact ca la prima generare.
async function readExistingManifest() {
  if (!existsSync(OUTPUT_FILE)) return {};
  try {
    // Cache-bust cu un query param, ca să nu citim o versiune veche din
    // cache-ul de module ESM dacă scriptul rulează de mai multe ori în
    // același proces (nu se întâmplă la rularea normală CLI, dar e
    // ieftin să fim siguri).
    const mod = await import(pathToFileURL(OUTPUT_FILE).href + "?t=" + Date.now());
    return mod.default || {};
  } catch {
    console.warn("[avatar-manifest] Manifestul existent nu a putut fi citit — pornesc de la unul gol pentru pachetele afectate.");
    return {};
  }
}

async function main() {
  const existing = await readExistingManifest();

  let packDirs = [];
  try {
    packDirs = readdirSync(AVATARS_DIR).filter((name) => statSync(join(AVATARS_DIR, name)).isDirectory());
  } catch {
    console.warn(`[avatar-manifest] Folderul ${AVATARS_DIR} nu există încă — manifest gol.`);
    writeManifest({});
    return;
  }

  const manifest = {};
  const warnings = [];
  const additions = [];

  for (const packRaw of packDirs) {
    const pack = packRaw.toLowerCase();
    const packPath = join(AVATARS_DIR, packRaw);
    const allFiles = readdirSync(packPath).filter((name) => statSync(join(packPath, name)).isFile());
    const images = allFiles.filter(isSupportedImage);
    const ignored = allFiles.filter((f) => !isSupportedImage(f));

    if (ignored.length > 0) {
      console.log(`[avatar-manifest] "${pack}": ignorate ${ignored.length} fișiere non-imagine (${ignored.join(", ")})`);
    }

    // Pornim de la ce exista deja pentru acest pachet (STABIL).
    const prev = existing[pack] && typeof existing[pack] === "object" && existing[pack].files
      ? existing[pack]
      : { nextIndex: 1, files: {} };

    const files = { ...prev.files };
    let nextIndex = prev.nextIndex || (Object.keys(files).length + 1);

    // Ce fișiere sunt deja alocate (indiferent la ce index)?
    const alreadyMapped = new Set(Object.values(files));

    // Elimină indexurile ale căror fișiere au fost șterse de pe disc —
    // NU realocăm niciodată acel număr unui fișier diferit.
    for (const [idx, filename] of Object.entries(files)) {
      if (!images.includes(filename)) {
        delete files[idx];
      }
    }

    // Fișiere genuin noi (nu erau în manifestul vechi) — sortate
    // alfabetic ÎNTRE ELE (determinist dacă se adaugă mai multe deodată),
        // primesc index-uri NOI, consecutive, pornind de la nextIndex.
    const newFiles = images.filter((f) => !alreadyMapped.has(f))
      .sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));

    for (const filename of newFiles) {
      files[String(nextIndex)] = filename;
      additions.push(`  + "${pack}/${nextIndex}" ← ${filename}`);
      nextIndex += 1;
    }

    manifest[pack] = { nextIndex, files };

    const count = Object.keys(files).length;
    if (count === 0) {
      warnings.push(`  ⚠️  "${pack}" nu are nicio imagine validă (png/jpg/jpeg/webp).`);
    }
  }

  writeManifest(manifest);

  console.log(`[avatar-manifest] Generat pentru ${packDirs.length} pachete: ${packDirs.map((p) => p.toLowerCase()).join(", ") || "(niciunul)"}`);
  if (additions.length > 0) {
    console.log("\n[avatar-manifest] AVATARURI NOI ATRIBUITE:");
    additions.forEach((a) => console.log(a));
  }
  if (warnings.length > 0) {
    console.log("\n[avatar-manifest] AVERTISMENTE:");
    warnings.forEach((w) => console.log(w));
  }
  console.log("");
}

function writeManifest(manifest) {
  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  const contents =
    "// FIȘIER GENERAT AUTOMAT — nu edita manual. Actualizat de\n" +
    "// scripts/generate-avatar-manifest.js, comis automat de\n" +
    "// .github/workflows/avatar-manifest.yml după fiecare push care\n" +
    "// atinge public/avatars/**. Indexurile o dată alocate NU se mai\n" +
    "// schimbă niciodată — un fișier nou primește mereu următorul index\n" +
    "// liber (nextIndex), indiferent unde ar cădea alfabetic.\n" +
    `export default ${JSON.stringify(manifest, null, 2)};\n`;
  writeFileSync(OUTPUT_FILE, contents, "utf8");
}

main();
