# Liga Băieților — ghid de pornire

## 1. Urcă fișierele pe GitHub

1. Deschide repo-ul tău gol (`liga-baietilor`) pe github.com
2. Apasă **"uploading an existing file"** (sau "Add file" → "Upload files")
3. Trage/selectează **toate fișierele și folderele** din acest pachet (păstrează structura de foldere — `src/`, `public/` trebuie să rămână foldere, nu totul aruncat plat)
4. Scrie un mesaj de commit (ex: "Primul commit — schela aplicației") și apasă **"Commit changes"**

## 2. Conectează la Vercel

1. Mergi pe **vercel.com**, loghează-te cu contul de GitHub
2. **"Add New" → "Project"**
3. Alege repo-ul **liga-baietilor**
4. Framework Preset: **Vite** (ar trebui să-l detecteze automat)
5. Build command: `npm run build` (implicit)
6. Output directory: `dist` (implicit)
7. Apasă **Deploy**

După 1-2 minute primești un link live (ceva de genul `liga-baietilor.vercel.app`) — ăla e site-ul, gata de folosit.

## 3. Aplică regulile de securitate Firestore

1. În Firebase Console → **Firestore Database → Rules**
2. Șterge tot ce e acolo, înlocuiește cu conținutul fișierului **`firestore.rules`** din acest pachet
3. Apasă **Publish**

## 4. Fă-ți cont de admin

1. Deschide aplicația live, **creează-ți cont normal** (email+parolă sau Google) — folosește contul tău real
2. În Firebase Console → **Firestore Database → Data**, deschide colecția **`users`**
3. Găsește documentul cu **email-ul tău**
4. Apasă pe el, apoi pe câmpul **`isAdmin`** — schimbă valoarea din `false` în **`true`** (tip boolean, nu text)
5. Salvează

De acum, contul tău are drepturi de admin — restul userilor rămân `isAdmin: false` automat la înregistrare, exact cum trebuie.

## Ce face aplicația acum

Doar autentificare — login, register, resetare parolă, Google Sign-In — plus un ecran simplu de "bun venit" după login. E fundația pe care construim etapele, punctajul, feed-ul și restul, pas cu pas, în sesiunile următoare.
