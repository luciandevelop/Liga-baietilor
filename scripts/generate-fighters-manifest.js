// Oglindă EXACTĂ a scripts/generate-avatar-manifest.js — aceeași logică
// de stabilitate a indexurilor, doar pentru biblioteca de personaje de
// luptă a Duelului (public/fighters/{tema}/{pachet}/), care are un nivel
// suplimentar de imbricare față de avataruri (temă → pachet → fișiere).
//
// Rulează AUTOMAT înainte de fiecare build (vite build) ȘI e rulat de
// GitHub Action-ul .github/workflows/fighters-manifest.yml la fiecare
// push care atinge public/fighters/**.
//
// STABILITATE: la fel ca la avataruri — un index o dată alocat unui
// fișier, pentru un pachet dintr-o temă, rămâne alocat acelui fișier
// pentru totdeauna cât timp fișierul există pe disc. Fișiere noi (sau
// pachete/teme noi) primesc următorul index liber, nu resortare de la
// zero. Manifestul generat e COMIS în git (nu doar generat la build) ca
// Vercel să nu pornească "orb" la fiecare clonare de repo.
//
// CONVENȚIE DE DENUMIRE (oficială): {pachetJucător}.webp — ex.
// public/fighters/kombat/utzy/utzy.webp — aleasă explicit ca fișierele
// descărcate pe telefon să nu se suprascrie/redenumească accidental
// unele pe altele (toate ar fi fost "1.webp" cu convenția veche). NU e
// o cerință tehnică strictă — orice nume de fișier funcționează, e citit
// din manifest, nu presupus în cod — dar generatorul avertizează (fără
// să blocheze) dacă un fișier nu respectă convenția, ca greșelile să se
// vadă imediat în log, nu abia când personajul nu apare.
//
// FALLBACK: dacă o temă sau un pachet nu are nicio imagine (încă),
// manifestul pur și simplu nu conține acea cheie — getFighterUrl()
// (src/assets/fighters.js) întoarce null pentru orice lookup eșuat, iar
// UI-ul Duelului cade automat pe avatarul normal al jucătorului. Nu
// există nicio eroare de build sau de rulare dacă lipsesc imagini —
// biblioteca poate fi complet goală la început și completată treptat,
// temă cu temă, jucător cu jucător.
import { readdirSync, statSync, mkdirSync, writeFileSync, existsSync } from "fs";
import { join, extname } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIGHTERS_DIR = join(__dirname, "..", "public", "fighters");
const OUTPUT_FILE = join(__dirname, "..", "src", "assets", "fightersManifest.generated.js");

const SUPPORTED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];

function isSupportedImage(filename) {
  return SUPPORTED_EXTENSIONS.includes(extname(filename).toLowerCase());
}

async function readExistingManifest() {
  if (!existsSync(OUTPUT_FILE)) return {};
  try {
    const mod = await import(pathToFileURL(OUTPUT_FILE).href + "?t=" + Date.now());
    return mod.default || {};
  } catch {
    console.warn("[fighters-manifest] Manifestul existent nu a putut fi citit — pornesc de la unul gol.");
    return {};
  }
}

function listSubdirs(path) {
  try {
    return readdirSync(path).filter((name) => statSync(join(path, name)).isDirectory());
  } catch {
    return [];
  }
}

async function main() {
  const existing = await readExistingManifest();

  const themeDirs = listSubdirs(FIGHTERS_DIR);
  if (themeDirs.length === 0) {
    console.warn(`[fighters-manifest] Folderul ${FIGHTERS_DIR} nu există încă sau e gol — manifest gol (fallback total la avatarul normal, comportament corect).`);
    writeManifest({});
    return;
  }

  const manifest = {};
  const warnings = [];
  const additions = [];

  for (const themeRaw of themeDirs) {
    const theme = themeRaw.toLowerCase();
    const themePath = join(FIGHTERS_DIR, themeRaw);
    const packDirs = listSubdirs(themePath);
    const existingTheme = existing[theme] && typeof existing[theme] === "object" ? existing[theme] : {};
    const themeManifest = {};

    for (const packRaw of packDirs) {
      const pack = packRaw.toLowerCase();
      const packPath = join(themePath, packRaw);
      const allFiles = readdirSync(packPath).filter((name) => statSync(join(packPath, name)).isFile());
      const images = allFiles.filter(isSupportedImage);
      const ignored = allFiles.filter((f) => !isSupportedImage(f));

      if (ignored.length > 0) {
        console.log(`[fighters-manifest] "${theme}/${pack}": ignorate ${ignored.length} fișiere non-imagine (${ignored.join(", ")})`);
      }

      const prev = existingTheme[pack] && existingTheme[pack].files ? existingTheme[pack] : { nextIndex: 1, files: {} };
      const files = { ...prev.files };
      let nextIndex = prev.nextIndex || (Object.keys(files).length + 1);
      const alreadyMapped = new Set(Object.values(files));

      for (const [idx, filename] of Object.entries(files)) {
        if (!images.includes(filename)) delete files[idx];
      }

      const newFiles = images.filter((f) => !alreadyMapped.has(f))
        .sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));

      for (const filename of newFiles) {
        files[String(nextIndex)] = filename;
        additions.push(`  + "${theme}/${pack}/${nextIndex}" ← ${filename}`);
        // Convenție oficială: fișierul ar trebui să se numească
        // exact "{pachet}.webp" (ex: utzy/utzy.webp) — ales special
        // ca fișierele descărcate pe telefon să nu se suprascrie
        // între ele. NU e obligatoriu tehnic (orice nume funcționează,
        // e citit din manifest, nu presupus în cod) — doar un
        // avertisment, ca să prinzi din prima o greșeală de denumire.
        const expectedName = `${pack}.webp`;
        if (filename.toLowerCase() !== expectedName.toLowerCase()) {
          warnings.push(`  ⚠️  "${theme}/${pack}/${filename}" — nume neconform convenției (așteptat "${expectedName}"). Funcționează oricum, dar verifică dacă nu e o confuzie.`);
        }
        nextIndex += 1;
      }

      if (Object.keys(files).length > 0) {
        themeManifest[pack] = { nextIndex, files };
      } else {
        warnings.push(`  ⚠️  "${theme}/${pack}" nu are nicio imagine validă — acel jucător cade pe avatarul normal în tema "${theme}".`);
      }
    }

    if (Object.keys(themeManifest).length > 0) {
      manifest[theme] = themeManifest;
    } else {
      warnings.push(`  ⚠️  Tema "${theme}" nu are niciun pachet cu imagini — toți jucătorii cad pe avatarul normal în ea.`);
    }
  }

  writeManifest(manifest);

  console.log(`[fighters-manifest] Generat pentru ${themeDirs.length} teme: ${themeDirs.map((t) => t.toLowerCase()).join(", ") || "(niciuna)"}`);
  if (additions.length > 0) {
    console.log("\n[fighters-manifest] PERSONAJE NOI ATRIBUITE:");
    additions.forEach((a) => console.log(a));
  }
  if (warnings.length > 0) {
    console.log("\n[fighters-manifest] AVERTISMENTE (informativ — fallback automat, nu blochează build-ul):");
    warnings.forEach((w) => console.log(w));
  }
  console.log("");
}

function writeManifest(manifest) {
  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  const contents =
    "// FIȘIER GENERAT AUTOMAT — nu edita manual. Actualizat de\n" +
    "// scripts/generate-fighters-manifest.js, comis automat de\n" +
    "// .github/workflows/fighters-manifest.yml după fiecare push care\n" +
    "// atinge public/fighters/**. Indexurile o dată alocate NU se mai\n" +
    "// schimbă niciodată. Structură: { tema: { pachetJucător: { nextIndex, files } } }.\n" +
    `export default ${JSON.stringify(manifest, null, 2)};\n`;
  writeFileSync(OUTPUT_FILE, contents, "utf8");
}

main();
