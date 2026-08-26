// Rulează AUTOMAT înainte de fiecare build (vite build), pe Vercel —
// Lu nu trebuie să facă nimic în plus față de ce face acum. Scanează
// public/avatars/{pachet}/, ia orice imagine găsește (orice nume, orice
// extensie din lista suportată), le sortează determinist, și scrie
// rezultatul ca modul JS static în src/assets/ (NU în public/ — trebuie
// să fie importabil sincron de avatars.js, iar public/ nu trece prin
// sistemul de module).
//
// NU atinge, NU redenumește, NU mută niciun fișier din public/avatars —
// doar CITEȘTE structura și scrie manifestul.
import { readdirSync, statSync, mkdirSync, writeFileSync } from "fs";
import { join, extname } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const AVATARS_DIR = join(__dirname, "..", "public", "avatars");
const OUTPUT_FILE = join(__dirname, "..", "src", "assets", "avatarManifest.generated.js");

const SUPPORTED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];
const EXPECTED_COUNT = 5;

function isSupportedImage(filename) {
  return SUPPORTED_EXTENSIONS.includes(extname(filename).toLowerCase());
}

function main() {
  let packDirs = [];
  try {
    packDirs = readdirSync(AVATARS_DIR).filter((name) => {
      const full = join(AVATARS_DIR, name);
      return statSync(full).isDirectory();
    });
  } catch (err) {
    console.warn(`[avatar-manifest] Folderul ${AVATARS_DIR} nu există încă — manifest gol.`);
    writeManifest({});
    return;
  }

  const manifest = {};
  const warnings = [];

  for (const pack of packDirs) {
    const packPath = join(AVATARS_DIR, pack);
    const allFiles = readdirSync(packPath).filter((name) => statSync(join(packPath, name)).isFile());
    const images = allFiles.filter(isSupportedImage);
    const ignored = allFiles.filter((f) => !isSupportedImage(f));

    // Sortare DETERMINISTĂ — alfabetică, case-insensitive, pe numele
    // fișierului (locale "en" fix, ca ordinea să nu depindă de mașina
    // pe care rulează build-ul — Vercel vs. orice altceva).
    images.sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));

    manifest[pack.toLowerCase()] = images;

    if (ignored.length > 0) {
      console.log(`[avatar-manifest] "${pack}": ignorate ${ignored.length} fișiere non-imagine (${ignored.join(", ")})`);
    }

    if (images.length < EXPECTED_COUNT) {
      warnings.push(`  ⚠️  "${pack}" are doar ${images.length}/${EXPECTED_COUNT} imagini (${images.join(", ") || "niciuna"})`);
    } else if (images.length > EXPECTED_COUNT) {
      warnings.push(`  ⚠️  "${pack}" are ${images.length} imagini (mai mult de ${EXPECTED_COUNT}: ${images.join(", ")}) — manifestul le păstrează pe TOATE (nimic tăiat/șters), dar aplicația arată doar primele ${EXPECTED_COUNT}, alfabetic: ${images.slice(0, EXPECTED_COUNT).join(", ")}.`);
    }
  }

  writeManifest(manifest);

  console.log(`[avatar-manifest] Generat pentru ${packDirs.length} pachete: ${packDirs.join(", ") || "(niciunul)"}`);
  if (warnings.length > 0) {
    console.log("\n[avatar-manifest] AVERTISMENTE:");
    warnings.forEach((w) => console.log(w));
    console.log("");
  }
}

function writeManifest(manifest) {
  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  const contents =
    "// FIȘIER GENERAT AUTOMAT — nu edita manual, se rescrie la fiecare build\n" +
    "// de scripts/generate-avatar-manifest.js. Cheile sunt numele pachetelor\n" +
    "// (foldere din public/avatars/, minuscule), valorile — numele reale ale\n" +
    "// imaginilor, în ordinea 1..N (index 0 = avatarul \"1\").\n" +
    `export default ${JSON.stringify(manifest, null, 2)};\n`;
  writeFileSync(OUTPUT_FILE, contents, "utf8");
}

main();
