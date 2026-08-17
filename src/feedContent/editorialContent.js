// ══════════════════════════════════════════════════════════════════
// CONȚINUT EDITORIAL — profiluri reale de echipe, verificate. Fiecare
// `fact` e o bucată separată de conținut (nu un singur bloc de text) —
// asta permite Feed-ului să scoată bucăți individuale ca „știri", nu
// doar un articol lung.
//
// STARE ACTUALĂ: toate cele 29 de echipe calificate direct în Champions
// League (lista dată de Lu, confirmată — play-off-urile încă în
// desfășurare pentru restul), plus 7 echipe mari suplimentare din
// Premier League/LaLiga/Serie A/Ligue 1, pentru context bogat pe meciuri
// din campionatele naționale (Chelsea, Tottenham, Athletic Bilbao,
// Juventus, AC Milan, AS Monaco, Marseille). Antrenorii incluși DOAR
// unde au fost verificați explicit acum (Bayern, Man City, Man Utd,
// Arsenal, Barcelona, Inter, PSG) — pentru restul, necunoscut sau încă
// în schimbare la data cercetării (ex. Real Madrid, Liverpool), lăsat
// necompletat, nu ghicit.
//
// Surse: informații istorice stabile (an fondare, stadion, palmares
// până la un punct verificabil, legende retrase din activitate,
// rivalități consacrate) — evitat deliberat orice detaliu recent care
// s-ar putea schimba (lot curent complet, antrenor curent), cu excepția
// a ce am verificat deja explicit în această sesiune (ex. Mbappé la
// Real Madrid, Kane la Bayern — confirmate prin căutare reală).
// ══════════════════════════════════════════════════════════════════

export const EDITORIAL_ARTICLES = [
  // ── REAL MADRID ──
  {
    id: "real-madrid-intro", teamId: "real-madrid", category: "champions-league",
    title: "Cine este Real Madrid?", icon: "info",
    subtitle: "Cel mai titrat club din istoria Champions League — 15 trofee europene.",
    body: "Fondat în 1902, Real Madrid e clubul cu cele mai multe trofee de Champions League/Cupa Campionilor din istorie (15), aproape dublu față de următorul club din clasament.",
    source: "Istoric UEFA", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "real-madrid-stadium", teamId: "real-madrid", category: "champions-league",
    title: "Stadionul", icon: "stadium",
    subtitle: "Santiago Bernabéu — unul dintre cele mai cunoscute stadioane din lume.",
    body: "Casa lui Real Madrid din 1947, recent renovat complet, cu acoperiș retractabil și suprafață de joc care poate fi retrasă electric.",
    source: "Site oficial Real Madrid", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "real-madrid-rivalry", teamId: "real-madrid", category: "champions-league",
    title: "Rivalul principal", icon: "rivalry",
    subtitle: "El Clásico — Real Madrid vs Barcelona, unul dintre cele mai urmărite meciuri din lume.",
    body: "Rivalitatea depășește fotbalul — reflectă istoric și tensiuni regionale între Madrid și Catalonia, urmărită de sute de milioane de oameni la fiecare ediție.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "real-madrid-legend", teamId: "real-madrid", category: "champions-league",
    title: "O legendă a clubului", icon: "legend",
    subtitle: "Alfredo Di Stéfano — a câștigat primele 5 ediții ale Cupei Campionilor (1956-1960).",
    body: "Considerat unul dintre cei mai buni jucători din istorie, Di Stéfano a fost figura centrală a dominației inițiale a lui Real Madrid în Europa.",
    source: "Istoric UEFA", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "real-madrid-star-now", teamId: "real-madrid", category: "champions-league",
    title: "Vedeta de urmărit", icon: "star",
    subtitle: "Kylian Mbappé — a terminat sezonul trecut ca golgheter al Champions League, cu 15 goluri.",
    body: "Verificat direct: Mbappé a fost golgheter al ediției 2025/26 a Champions League, cu 15 goluri în 11 meciuri.",
    source: "UEFA.com", publishedAtMs: Date.parse("2026-08-12"),
  },
  {
    id: "real-madrid-coach-2026", teamId: "real-madrid", category: "champions-league",
    title: "Antrenorul", icon: "info",
    subtitle: "José Mourinho, revenit la conducerea tehnică pentru 2026/27.",
    body: "Verificat direct: după plecarea lui Xabi Alonso și o perioadă interimară cu Álvaro Arbeloa, Mourinho a revenit pe banca lui Real Madrid, cu obiectivul declarat de a readuce echipa la vârf după două sezoane fără trofee.",
    source: "GiveMeSport", publishedAtMs: Date.parse("2026-08-12"),
  },
  {
    id: "real-madrid-transfers-2026", teamId: "real-madrid", category: "champions-league",
    title: "Transferuri importante", icon: "info",
    subtitle: "Marc Cucurella (de la Chelsea) și Denzel Dumfries (de la Inter), printre cele 6 semnări noi ale verii.",
    body: "Verificat direct: Cucurella a venit contra a aproximativ 52 milioane de lire, iar Dumfries e văzut ca succesorul pe termen lung al lui Dani Carvajal, plecat liber de la club.",
    source: "GiveMeSport", publishedAtMs: Date.parse("2026-08-12"),
  },
  {
    id: "real-madrid-free-transfers-2026", teamId: "real-madrid", category: "champions-league",
    title: "Transferuri libere de contract", icon: "info",
    subtitle: "Bernardo Silva (de la Manchester City) și Ibrahima Konaté (de la Liverpool), ambii veniți liberi de contract.",
    body: "Verificat direct din Wikipedia: Bernardo Silva a semnat un contract pe 2 ani, după Campionatul Mondial; Konaté a semnat pe 4 ani. Antonio Rüdiger și-a prelungit contractul până în 2027.",
    source: "Wikipedia — 2026-27 Real Madrid CF season", publishedAtMs: Date.parse("2026-08-12"),
  },
  {
    id: "real-madrid-key-players", teamId: "real-madrid", category: "champions-league",
    title: "Jucători importanți", icon: "star",
    subtitle: "Courtois, Bellingham, Valverde, Vinícius Júnior, Rodrygo, Mbappé — coloana vertebrală a echipei.",
    body: "Verificat direct din lotul oficial 2026/27: Mbappé poartă numărul 10, Bellingham numărul 5, Vinícius Júnior numărul 7.",
    source: "Real Madrid — site oficial", publishedAtMs: Date.parse("2026-08-12"),
  },

  // ── BARCELONA ──
  {
    id: "barcelona-intro", teamId: "barcelona", category: "champions-league",
    title: "Cine este Barcelona?", icon: "info",
    subtitle: "„Més que un club\" — mai mult decât un club, sub acest motto joacă din 1899.",
    body: "Fondat în 1899, FC Barcelona e unul dintre cele mai identitare cluburi din lume, strâns legat de cultura și identitatea catalană.",
    source: "Site oficial FC Barcelona", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "barcelona-academy", teamId: "barcelona", category: "champions-league",
    title: "La Masia", icon: "academy",
    subtitle: "Academia de tineret a clubului — una dintre cele mai respectate din lume.",
    body: "A produs jucători precum Messi, Xavi, Iniesta — generația care a definit stilul de joc al clubului („tiki-taka\") la începutul anilor 2010.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "barcelona-legend", teamId: "barcelona", category: "champions-league",
    title: "O legendă a clubului", icon: "legend",
    subtitle: "Johan Cruyff — jucător și apoi antrenor, a definit filozofia de joc a clubului.",
    body: "Ca antrenor (1988-1996), Cruyff a pus bazele stilului de joc pe care Barcelona îl urmează și azi, câștigând primul Cupă Campionilor al clubului, în 1992.",
    source: "Istoric UEFA", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "barcelona-coach-2026", teamId: "barcelona", category: "champions-league",
    title: "Antrenorul", icon: "info",
    subtitle: "Hansi Flick, la conducerea tehnică a echipei.",
    body: "Verificat direct: Flick rămâne antrenorul Barcelonei pentru sezonul 2026/27.",
    source: "Wikipedia — 2026-27 FC Barcelona season", publishedAtMs: Date.parse("2026-08-12"),
  },
  {
    id: "barcelona-recent-form", teamId: "barcelona", category: "champions-league",
    title: "Performanțe recente", icon: "record",
    subtitle: "Campioană en-titre a Spaniei, două sezoane la rând.",
    body: "Verificat direct: Barcelona intră în 2026/27 ca deținătoare a titlului de campioană La Liga, pentru al doilea sezon consecutiv sub Hansi Flick.",
    source: "GiveMeSport", publishedAtMs: Date.parse("2026-08-12"),
  },
  {
    id: "barcelona-transfers-2026", teamId: "barcelona", category: "champions-league",
    title: "Transferuri importante", icon: "info",
    subtitle: "Robert Lewandowski a plecat liber de contract, spre MLS (Chicago Fire).",
    body: "Verificat direct: Lewandowski a marcat 120 de goluri în 193 de meciuri pentru Barcelona, în toate competițiile, înainte de plecare. Ansu Fati a fost transferat definitiv la AS Monaco.",
    source: "GiveMeSport", publishedAtMs: Date.parse("2026-08-12"),
  },
  {
    id: "barcelona-worldcup-2026", teamId: "barcelona", category: "champions-league",
    title: "O curiozitate", icon: "info",
    subtitle: "8 jucători din lot au câștigat Campionatul Mondial cu Spania, vara lui 2026.",
    body: "Verificat direct: Spania a câștigat al doilea ei titlu mondial din istorie, iar 8 dintre campioni joacă la Barcelona.",
    source: "GiveMeSport", publishedAtMs: Date.parse("2026-08-12"),
  },

  // ── ARSENAL ──
  {
    id: "arsenal-intro", teamId: "arsenal", category: "champions-league",
    title: "Cine este Arsenal?", icon: "info",
    subtitle: "„The Gunners\" — fondat în 1886, din nordul Londrei.",
    body: "Unul dintre cele mai vechi cluburi din Anglia, Arsenal a fost fondat de muncitori de la o fabrică de armament — de-aici emblema tunului și porecla.",
    source: "Site oficial Arsenal", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "arsenal-invincibles", teamId: "arsenal", category: "champions-league",
    title: "Un record al clubului", icon: "record",
    subtitle: "„The Invincibles\" — sezonul 2003/04, neînvinsă în tot campionatul Premier League.",
    body: "Sub Arsène Wenger, Arsenal a parcurs toate cele 38 de etape ale sezonului 2003/04 fără nicio înfrângere — un record unic în era Premier League modernă.",
    source: "Istoric Premier League", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "arsenal-cl-final-2026", teamId: "arsenal", category: "champions-league",
    title: "Un moment recent", icon: "record",
    subtitle: "Finalista Champions League 2026 — învinsă de PSG.",
    body: "Verificat direct: Arsenal a jucat finala Champions League 2026, pierdută în fața lui Paris Saint-Germain, condus de Luis Enrique.",
    source: "Sporting News", publishedAtMs: Date.parse("2026-08-12"),
  },
  {
    id: "arsenal-coach-2026", teamId: "arsenal", category: "champions-league",
    title: "Antrenorul", icon: "info",
    subtitle: "Mikel Arteta, cu un nou contract până în 2027.",
    body: "Verificat direct: Arteta a semnat prelungirea în vara 2026, după ce a condus Arsenal la primul titlu de campioană a Angliei din ultimii 22 de ani.",
    source: "Sports Illustrated", publishedAtMs: Date.parse("2026-08-12"),
  },
  {
    id: "arsenal-recent-form", teamId: "arsenal", category: "champions-league",
    title: "Performanțe recente", icon: "record",
    subtitle: "Campioană en-titre a Premier League — primul titlu în 22 de ani.",
    body: "Verificat direct: Arsenal a câștigat Premier League 2025/26, încheind o așteptare de peste două decenii pentru trofeul de campioană a Angliei.",
    source: "Football FanCast", publishedAtMs: Date.parse("2026-08-12"),
  },
  {
    id: "arsenal-transfers-2026", teamId: "arsenal", category: "champions-league",
    title: "Transferuri importante", icon: "info",
    subtitle: "Bruno Guimarães (de la Newcastle, ~75 milioane de lire) — cea mai mare semnare a verii.",
    body: "Verificat direct: Piero Hincapié și-a transformat împrumutul de la Bayer Leverkusen într-un transfer definitiv (~34.5 milioane de lire).",
    source: "GiveMeSport", publishedAtMs: Date.parse("2026-08-12"),
  },
  {
    id: "arsenal-key-player-saka", teamId: "arsenal", category: "champions-league",
    title: "Jucătorul cheie", icon: "star",
    subtitle: "Bukayo Saka — și-a prelungit contractul până în 2027.",
    body: "Verificat direct: Arteta l-a descris pe Saka drept un „jucător crucial\" pentru proiectul clubului.",
    source: "Soccerway", publishedAtMs: Date.parse("2026-08-12"),
  },

  // ── MANCHESTER CITY (extins) ──
  {
    id: "mancity-coach-2026", teamId: "manchester-city", category: "champions-league",
    title: "Antrenorul", icon: "info",
    subtitle: "Enzo Maresca — începutul unei noi ere, după plecarea lui Pep Guardiola.",
    body: "Verificat direct: Guardiola a părăsit clubul după un deceniu de succese, iar Maresca a preluat echipa pentru sezonul 2026/27.",
    source: "Wikipedia — 2026-27 Manchester City season", publishedAtMs: Date.parse("2026-08-12"),
  },
  {
    id: "mancity-recent-form", teamId: "manchester-city", category: "champions-league",
    title: "Performanțe recente", icon: "record",
    subtitle: "A pierdut titlul de campioană în fața lui Arsenal, dar a câștigat dublă de cupe interne.",
    body: "Verificat direct: City a fost eliminată devreme din Champions League de Real Madrid — un rezultat pe care conducerea clubului nu vrea să-l repete.",
    source: "GiveMeSport", publishedAtMs: Date.parse("2026-08-12"),
  },
  {
    id: "mancity-transfers-2026", teamId: "manchester-city", category: "champions-league",
    title: "Transferuri importante", icon: "info",
    subtitle: "Elliot Anderson (de la Nottingham Forest) — transfer-record de club, ~116 milioane de lire.",
    body: "Verificat direct: au plecat trei jucători importanți — Bernardo Silva, John Stones și Nathan Aké.",
    source: "Wikipedia — 2026-27 Manchester City season", publishedAtMs: Date.parse("2026-08-12"),
  },
  {
    id: "mancity-key-players", teamId: "manchester-city", category: "champions-league",
    title: "Jucători cheie", icon: "star",
    subtitle: "Erling Haaland rămâne vârful de atac principal.",
    body: "Verificat direct: viitorul lui Rodri la club era incert la data cercetării, cu contractul aproape de expirare.",
    source: "GiveMeSport", publishedAtMs: Date.parse("2026-08-12"),
  },
  {
    id: "arsenal-rivalry", teamId: "arsenal", category: "champions-league",
    title: "Rivalul principal", icon: "rivalry",
    subtitle: "North London Derby — Arsenal vs Tottenham Hotspur.",
    body: "Una dintre cele mai vechi și intense rivalități din fotbalul englez, între cele două cluburi mari din nordul Londrei.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "arsenal-pl-champion-2026", teamId: "arsenal", category: "champions-league",
    title: "Performanțe recente", icon: "record",
    subtitle: "Campioana en-titre a Premier League — primul titlu al clubului în peste 20 de ani.",
    body: "Verificat direct: Arsenal a câștigat Premier League 2025/26, sub Mikel Arteta, și a pierdut finala Champions League 2026 la penalty-uri, în fața lui PSG.",
    source: "Football FanCast", publishedAtMs: Date.parse("2026-08-12"),
  },
  {
    id: "arsenal-key-players", teamId: "arsenal", category: "champions-league",
    title: "Jucători importanți", icon: "star",
    subtitle: "Bukayo Saka, William Saliba, Declan Rice, Martin Ødegaard, David Raya — coloana vertebrală a echipei.",
    body: "Verificat direct: Declan Rice rămâne cel mai scump transfer din istoria clubului.",
    source: "Wikipedia — 2026-27 Arsenal F.C. season", publishedAtMs: Date.parse("2026-08-12"),
  },

  // ── PARIS SAINT-GERMAIN ──
  {
    id: "psg-intro", teamId: "paris-saint-germain", category: "champions-league",
    title: "Cine este Paris Saint-Germain?", icon: "info",
    subtitle: "Fondat în 1970, clubul-far al fotbalului francez modern.",
    body: "Din 2011, sub proprietatea Qatar Sports Investments, PSG a devenit una dintre forțele financiare dominante ale fotbalului european.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "psg-stadium", teamId: "paris-saint-germain", category: "champions-league",
    title: "Stadionul", icon: "stadium",
    subtitle: "Parc des Princes — casa clubului din 1974.",
    body: "Situat chiar în Paris, nu în afara orașului, Parc des Princes are o atmosferă intensă, foarte aproape de teren.",
    source: "Site oficial PSG", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "psg-cl-champion-2026", teamId: "paris-saint-germain", category: "champions-league",
    title: "Campioana en-titre", icon: "record",
    subtitle: "PSG a câștigat finala Champions League 2026, împotriva lui Arsenal.",
    body: "Verificat direct: sub Luis Enrique, PSG a învins Arsenal în finala din 2026 — al doilea titlu consecutiv de Champions League pentru antrenorul spaniol.",
    source: "Sporting News", publishedAtMs: Date.parse("2026-08-12"),
  },
  {
    id: "psg-key-players-2026", teamId: "paris-saint-germain", category: "champions-league",
    title: "Jucători cheie", icon: "star",
    subtitle: "Ousmane Dembélé, Khvicha Kvaratskhelia, Désiré Doué — atacul care a dus PSG pe culmea Europei.",
    body: "Verificat direct din lotul oficial 2026/27: Achraf Hakimi și Nuno Mendes rămân fundașii laterali titulari, iar João Neves și Vitinha formează miezul de mijloc.",
    source: "Transfermarkt / Goal.com", publishedAtMs: Date.parse("2026-08-12"),
  },
  {
    id: "psg-coach-2026", teamId: "paris-saint-germain", category: "champions-league",
    title: "Antrenorul", icon: "info",
    subtitle: "Luis Enrique, arhitectul celor două titluri consecutive de Champions League.",
    body: "Verificat direct: Enrique a condus PSG la titlul Champions League atât în 2025, cât și în 2026.",
    source: "Sporting News", publishedAtMs: Date.parse("2026-08-12"),
  },
  {
    id: "psg-transfers-2026", teamId: "paris-saint-germain", category: "champions-league",
    title: "Un transfer recent", icon: "info",
    subtitle: "Maghnes Akliouche, adus de la AS Monaco, pe un contract de 5 ani.",
    body: "Verificat direct: PSG și-a întărit atacul cu tânărul internațional francez, chiar în postura de campioană en-titre.",
    source: "ESPN", publishedAtMs: Date.parse("2026-08-12"),
  },

  // ── BAYERN MÜNCHEN ──
  {
    id: "bayern-intro", teamId: "bayern-munchen", category: "champions-league",
    title: "Cine este Bayern München?", icon: "info",
    subtitle: "Cel mai titrat club din Germania, fondat în 1900.",
    body: "Bayern domină fotbalul german ca niciun alt club în alt campionat mare european — cu un număr copleșitor de titluri de Bundesliga.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "bayern-legend", teamId: "bayern-munchen", category: "champions-league",
    title: "O legendă a clubului", icon: "legend",
    subtitle: "Franz Beckenbauer — „Der Kaiser\", căpitan și apoi antrenor campion mondial.",
    body: "Beckenbauer a câștigat Cupa Campionilor ca jucător al lui Bayern (anii '70) și apoi Campionatul Mondial ca selecționer al Germaniei (1990) — unul din puținii oameni care au câștigat Mondialul și ca jucător, și ca antrenor.",
    source: "Istoric FIFA/UEFA", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "bayern-star-now", teamId: "bayern-munchen", category: "champions-league",
    title: "Vedeta de urmărit", icon: "star",
    subtitle: "Harry Kane — a terminat sezonul trecut cu 8 goluri în Champions League pentru Bayern.",
    body: "Verificat direct: Kane a fost pe locul 2 la golgheteri în ediția 2025/26, cu 8 goluri în 13 meciuri pentru Bayern.",
    source: "UEFA.com", publishedAtMs: Date.parse("2026-08-12"),
  },
  {
    id: "bayern-coach-2026", teamId: "bayern-munchen", category: "champions-league",
    title: "Antrenorul", icon: "info",
    subtitle: "Vincent Kompany, fost mare fundaș, acum la conducerea tehnică.",
    body: "Verificat direct: Kompany a condus Bayern la un sezon 2025/26 cu recordul de goluri marcate într-un sezon de Bundesliga (122) și dublă domestică.",
    source: "Bundesliga.com", publishedAtMs: Date.parse("2026-08-12"),
  },
  {
    id: "bayern-transfers-2026", teamId: "bayern-munchen", category: "champions-league",
    title: "Transferuri importante", icon: "info",
    subtitle: "Ismael Saibari (de la PSV) și Nathaniel Brown (de la Eintracht Frankfurt), ~50 milioane de euro fiecare.",
    body: "Verificat direct: ambii sunt așteptați să prindă loc de start încă din primele meciuri ale sezonului.",
    source: "Bavarian Football Works", publishedAtMs: Date.parse("2026-08-12"),
  },

  // ── MANCHESTER CITY ──
  {
    id: "mancity-intro", teamId: "manchester-city", category: "champions-league",
    title: "Cine este Manchester City?", icon: "info",
    subtitle: "Fondat în 1880, transformat radical din 2008 sub proprietatea Abu Dhabi United Group.",
    body: "City a trecut de la un club mijlociu englez la una dintre forțele dominante ale fotbalului european în doar un deceniu și jumătate.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "mancity-treble", teamId: "manchester-city", category: "champions-league",
    title: "Un moment istoric", icon: "record",
    subtitle: "Sezonul 2022/23 — primul \"treble\" din istoria clubului (Premier League, FA Cup, Champions League).",
    body: "City a devenit al doilea club englez, după Manchester United (1999), care câștigă toate cele trei trofee majore în același sezon.",
    source: "Istoric UEFA/Premier League", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "mancity-stadium", teamId: "manchester-city", category: "champions-league",
    title: "Stadionul", icon: "stadium",
    subtitle: "Etihad Stadium — casa lui City din 2003.",
    body: "Construit inițial pentru Jocurile de la Commonwealth din 2002, stadionul a fost adaptat pentru fotbal și e casa clubului de peste 20 de ani.",
    source: "Site oficial Manchester City", publishedAtMs: Date.parse("2026-08-01"),
  },

  // ── LIVERPOOL ──
  {
    id: "liverpool-intro", teamId: "liverpool", category: "champions-league",
    title: "Cine este Liverpool?", icon: "info",
    subtitle: "Fondat în 1892, unul dintre cele mai titrate cluburi din istoria fotbalului englez.",
    body: "Liverpool are un palmares bogat atât pe plan intern cât și european, cu o cultură a suporterilor recunoscută în toată lumea.",
    source: "Site oficial Liverpool FC", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "liverpool-anthem", teamId: "liverpool", category: "champions-league",
    title: "O curiozitate", icon: "info",
    subtitle: "\"You'll Never Walk Alone\" — imnul cântat de suporteri înainte de fiecare meci pe Anfield.",
    body: "Piesa, adoptată din anii '60, a devenit unul dintre cele mai recognoscibile ritualuri din fotbalul mondial.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "liverpool-istanbul", teamId: "liverpool", category: "champions-league",
    title: "Un meci memorabil", icon: "legend",
    subtitle: "Finala din Istanbul, 2005 — Liverpool a revenit de la 0-3 la 3-3 împotriva lui AC Milan și a câștigat la penalty-uri.",
    body: "Considerată una dintre cele mai mari revenirii din istoria finalelor europene.",
    source: "Istoric UEFA", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "liverpool-coach-2026", teamId: "liverpool", category: "champions-league",
    title: "Antrenorul", icon: "info",
    subtitle: "Andoni Iraola, venit de la Bournemouth — Arne Slot a plecat la doar un an după titlu.",
    body: "Verificat direct: un sezon fără trofee și un final de sezon pe locul 5 au dus la schimbarea de antrenor pentru 2026/27.",
    source: "Football FanCast", publishedAtMs: Date.parse("2026-08-12"),
  },
  {
    id: "liverpool-salah-departure", teamId: "liverpool", category: "champions-league",
    title: "O plecare majoră", icon: "info",
    subtitle: "Mohamed Salah a părăsit clubul, liber de contract, după un deceniu.",
    body: "Verificat direct: Salah pleacă cu 257 de goluri și 442 de meciuri jucate pentru Liverpool — unul dintre cei mai mari jucători din istoria clubului. Andy Robertson a plecat și el, la Tottenham.",
    source: "Football FanCast / Soccernews", publishedAtMs: Date.parse("2026-08-12"),
  },

  // ── MANCHESTER UNITED (extins) ──
  {
    id: "manutd-coach-2026", teamId: "manchester-united", category: "champions-league",
    title: "Antrenorul", icon: "info",
    subtitle: "Michael Carrick, fost mijlocaș al clubului, acum antrenor principal.",
    body: "Verificat direct: Carrick a fost numit antrenor permanent după ce a condus echipa pe finalul sezonului trecut.",
    source: "Sporting Tribune", publishedAtMs: Date.parse("2026-08-12"),
  },
  {
    id: "manutd-transfer-in-2026", teamId: "manchester-united", category: "champions-league",
    title: "Transfer important", icon: "info",
    subtitle: "Andrey Santos, venit de la Chelsea pentru aproape 50 de milioane de lire.",
    body: "Verificat direct: mijlocașul brazilian a fost una dintre semnările notabile ale verii 2026 pentru United.",
    source: "GiveMeSport", publishedAtMs: Date.parse("2026-08-12"),
  },

  // ── CHELSEA (extins) ──
  {
    id: "chelsea-coach-2026", teamId: "chelsea", category: "liga",
    title: "Antrenorul", icon: "info",
    subtitle: "Xabi Alonso, contract pe 4 ani — venit direct de la Real Madrid.",
    body: "Verificat direct: Enzo Maresca a fost demis în cursul sezonului trecut, iar Alonso a preluat echipa pentru 2026/27, după o despărțire scurtă de Real Madrid.",
    source: "Wikipedia — 2026-27 Chelsea season", publishedAtMs: Date.parse("2026-08-12"),
  },
  {
    id: "chelsea-transfers-2026", teamId: "chelsea", category: "liga",
    title: "Transferuri importante", icon: "info",
    subtitle: "Marc Cucurella a plecat la Real Madrid — Andrey Santos, la Manchester United.",
    body: "Verificat direct: Cucurella făcuse peste 150 de meciuri pentru Chelsea și fusese parte din lotul câștigător de Conference League și Cupa Mondială a Cluburilor.",
    source: "GiveMeSport", publishedAtMs: Date.parse("2026-08-12"),
  },

  // ── NAPOLI (extins) ──
  {
    id: "napoli-coach-2026", teamId: "napoli", category: "champions-league",
    title: "Antrenorul", icon: "info",
    subtitle: "Antonio Conte — cunoscut pentru echipe disciplinate, bine organizate defensiv.",
    body: "Verificat direct din meciuri recente Napoli.",
    source: "UEFA.com (raport meci)", publishedAtMs: Date.parse("2026-08-12"),
  },
  {
    id: "napoli-key-players-2026", teamId: "napoli", category: "champions-league",
    title: "Jucători cheie", icon: "star",
    subtitle: "Romelu Lukaku în atac, Scott McTominay și Stanislav Lobotka la mijlocul terenului, Di Lorenzo căpitan.",
    body: "Verificat direct din alinierea unui meci recent — Alex Meret rămâne portarul titular.",
    source: "UEFA.com (raport meci)", publishedAtMs: Date.parse("2026-08-12"),
  },
  {
    id: "manutd-intro", teamId: "manchester-united", category: "champions-league",
    title: "Cine este Manchester United?", icon: "info",
    subtitle: "Fondat în 1878, unul dintre cele mai populare cluburi din lume.",
    body: "United are cea mai mare bază globală de suporteri dintre cluburile engleze, construită și prin succesul din era Sir Alex Ferguson.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "manutd-99", teamId: "manchester-united", category: "champions-league",
    title: "Un moment istoric", icon: "record",
    subtitle: "1999 — primul \"treble\" din istoria fotbalului englez, cu un gol în prelungirile finalei Champions League.",
    body: "United a marcat de două ori în ultimele minute ale finalei împotriva lui Bayern München, întorcând un scor nefavorabil.",
    source: "Istoric UEFA", publishedAtMs: Date.parse("2026-08-01"),
  },

  // ── CHELSEA ──
  {
    id: "chelsea-intro", teamId: "chelsea", category: "liga",
    title: "Cine este Chelsea?", icon: "info",
    subtitle: "Fondat în 1905, din vestul Londrei — stadionul Stamford Bridge.",
    body: "Chelsea a cunoscut o perioadă de succes major după 2003, odată cu investițiile care au transformat clubul într-o forță europeană.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "chelsea-2012", teamId: "chelsea", category: "liga",
    title: "Un moment istoric", icon: "record",
    subtitle: "2012 — primul trofeu de Champions League al clubului, câștigat la penalty-uri împotriva lui Bayern München, pe teren propriu al bavarezilor.",
    body: "Un rezultat surprinzător, având în vedere că Bayern juca finala pe propriul stadion (Allianz Arena).",
    source: "Istoric UEFA", publishedAtMs: Date.parse("2026-08-01"),
  },

  // ── TOTTENHAM ──
  {
    id: "tottenham-intro", teamId: "tottenham", category: "liga",
    title: "Cine este Tottenham Hotspur?", icon: "info",
    subtitle: "Fondat în 1882, din nordul Londrei — rival istoric al lui Arsenal.",
    body: "Tottenham joacă pe unul dintre cele mai moderne stadioane din Europa, deschis în 2019.",
    source: "Site oficial Tottenham", publishedAtMs: Date.parse("2026-08-01"),
  },

  // ── ATLÉTICO MADRID ──
  {
    id: "atletico-intro", teamId: "atletico-madrid", category: "liga",
    title: "Cine este Atlético Madrid?", icon: "info",
    subtitle: "Fondat în 1903, al treilea mare club al capitalei spaniole, după Real Madrid.",
    body: "Sub Diego Simeone (din 2011), Atlético a devenit recunoscut pentru un stil de joc defensiv, disciplinat, care a adus rezultate constante în Europa.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },

  // ── ATHLETIC BILBAO ──
  {
    id: "athletic-intro", teamId: "athletic-club", category: "liga",
    title: "Cine este Athletic Bilbao?", icon: "info",
    subtitle: "O politică unică — folosește exclusiv jucători formați în Țara Bascilor.",
    body: "Athletic e singurul club mare european care a refuzat constant să transfere jucători străini, mizând integral pe formarea locală.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "athletic-coach-2026", teamId: "athletic-club", category: "liga",
    title: "Antrenorul", icon: "info",
    subtitle: "Edin Terzić — o schimbare majoră, după Ernesto Valverde.",
    body: "Verificat direct: Terzić începe un nou proiect la Bilbao, preluând echipa pentru sezonul 2026/27.",
    source: "FIFPlay — LaLiga 2026-27 Managers", publishedAtMs: Date.parse("2026-08-12"),
  },

  // ── JUVENTUS ──
  {
    id: "juventus-intro", teamId: "juventus", category: "liga",
    title: "Cine este Juventus?", icon: "info",
    subtitle: "Fondat în 1897, clubul cu cele mai multe titluri de campion din istoria Italiei.",
    body: "\"La Vecchia Signora\" (Bătrâna Doamnă) e supranumele clubului din Torino, cunoscut pentru culorile alb-negru și tradiția câștigătoare.",
    source: "Site oficial Juventus", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "juventus-coach-2026", teamId: "juventus", category: "liga",
    title: "Antrenorul", icon: "info",
    subtitle: "Luciano Spalletti, la conducerea tehnică pentru 2026/27.",
    body: "Verificat direct din presa italiană, în plin pregătire de sezon.",
    source: "Juvefc.com", publishedAtMs: Date.parse("2026-08-12"),
  },
  {
    id: "juventus-transfer-2026", teamId: "juventus", category: "liga",
    title: "Transfer important", icon: "info",
    subtitle: "Randal Kolo Muani, transferat definitiv de la PSG, după un împrumut reușit.",
    body: "Verificat direct: Kolo Muani revine la Torino după un sezon dificil la Tottenham, cu obiectivul de a repeta forma bună din prima sa perioadă la Juventus (10 goluri în 22 de meciuri).",
    source: "Juvefc.com", publishedAtMs: Date.parse("2026-08-12"),
  },

  // ── AC MILAN ──
  {
    id: "milan-intro", teamId: "milan", category: "liga",
    title: "Cine este AC Milan?", icon: "info",
    subtitle: "Fondat în 1899, unul dintre cele mai titrate cluburi din istoria Champions League/Cupei Campionilor.",
    body: "Milan a dominat fotbalul european la finalul anilor '80 și începutul anilor '90, sub Arrigo Sacchi, cu un stil de joc considerat revoluționar la vremea lui.",
    source: "Istoric UEFA", publishedAtMs: Date.parse("2026-08-01"),
  },

  // ── NAPOLI ──
  {
    id: "napoli-intro", teamId: "napoli", category: "liga",
    title: "Cine este Napoli?", icon: "info",
    subtitle: "Legat de numele lui Diego Maradona, care a adus clubului primele două titluri de campion (1987, 1990).",
    body: "Maradona rămâne o figură venerată la Napoli — stadionul clubului îi poartă numele din 2020.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },

  // ── BORUSSIA DORTMUND ──
  {
    id: "dortmund-intro", teamId: "borussia-dortmund", category: "liga",
    title: "Cine este Borussia Dortmund?", icon: "info",
    subtitle: "Fondat în 1909, celebru pentru atmosfera de pe \"Zidul Galben\" (Südtribüne).",
    body: "Peluza sudă a stadionului Signal Iduna Park, cu peste 24.000 de locuri în picioare, e considerată una dintre cele mai impresionante atmosfere din fotbalul mondial.",
    source: "Site oficial Borussia Dortmund", publishedAtMs: Date.parse("2026-08-01"),
  },

  // ── AS MONACO ──
  {
    id: "monaco-intro", teamId: "as-monaco", category: "liga",
    title: "Cine este AS Monaco?", icon: "info",
    subtitle: "Un club francez, dar din statul independent Monaco — joacă totuși în campionatul Franței.",
    body: "Monaco a fost o rampă de lansare pentru mulți jucători tineri, deveniți ulterior vedete internaționale.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },

  // ── OLYMPIQUE MARSEILLE ──
  {
    id: "marseille-intro", teamId: "marseille", category: "liga",
    title: "Cine este Olympique Marseille?", icon: "info",
    subtitle: "Singurul club francez care a câștigat vreodată Champions League/Cupa Campionilor — în 1993.",
    body: "Marseille rămâne unul dintre cele mai pasionale cluburi din Franța, cu un suport masiv în sud.",
    source: "Istoric UEFA", publishedAtMs: Date.parse("2026-08-01"),
  },

  // ── INTER MILAN ──
  {
    id: "inter-intro", teamId: "inter", category: "champions-league",
    title: "Cine este Inter Milan?", icon: "info",
    subtitle: "Fondat în 1908, joacă pe San Siro, alături de rivalul AC Milan.",
    body: "Inter e unul dintre puținele cluburi italiene mari care nu a retrogradat niciodată din prima ligă.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "inter-coach-2026", teamId: "inter", category: "champions-league",
    title: "Antrenorul", icon: "info",
    subtitle: "Cristian Chivu, fost internațional român, la conducerea tehnică.",
    body: "Verificat direct: Chivu e antrenorul lui Inter pentru sezonul 2026/27.",
    source: "Wikipedia — 2026-27 Inter Milan season", publishedAtMs: Date.parse("2026-08-12"),
  },
  {
    id: "inter-recent-form", teamId: "inter", category: "champions-league",
    title: "Performanțe recente", icon: "record",
    subtitle: "Campioana en-titre a Serie A, 11 puncte peste Napoli.",
    body: "Verificat direct: în Champions League, Inter a fost eliminată de Bodo/Glimt în baraj, ratând un posibil treble istoric.",
    source: "Football Today", publishedAtMs: Date.parse("2026-08-12"),
  },
  {
    id: "inter-transfers-2026", teamId: "inter", category: "champions-league",
    title: "Transferuri importante", icon: "info",
    subtitle: "John Stones (de la Manchester City, liber de contract) — cea mai importantă semnare a verii.",
    body: "Verificat direct: printre plecări se numără Denzel Dumfries (la Real Madrid) și Yann Sommer.",
    source: "Football Today", publishedAtMs: Date.parse("2026-08-12"),
  },

  // ── PSV EINDHOVEN ──
  {
    id: "psv-intro", teamId: "psv", category: "champions-league",
    title: "Cine este PSV Eindhoven?", icon: "info",
    subtitle: "Fondat de angajați Philips în 1913 — de-aici și numele (Philips Sport Vereniging).",
    body: "Unul dintre cele 3 mari cluburi din Olanda, alături de Ajax și Feyenoord.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "psv-recent-form", teamId: "psv", category: "champions-league",
    title: "Performanțe recente", icon: "record",
    subtitle: "Campioană en-titre a Olandei, sub Peter Bosz.",
    body: "Verificat direct: PSV a câștigat Eredivisie 2025/26, cu Ricardo Pepi golgheter al echipei (16 goluri în campionat). Luuk de Jong a venit liber de la Porto.",
    source: "Wikipedia — 2025-26 PSV Eindhoven season", publishedAtMs: Date.parse("2026-08-12"),
  },

  // ── FC PORTO ──
  {
    id: "porto-intro", teamId: "fc-porto", category: "champions-league",
    title: "Cine este FC Porto?", icon: "info",
    subtitle: "Câștigătoarea Champions League 2004, sub José Mourinho.",
    body: "Porto a produs una dintre cele mai surprinzătoare campanii europene din istorie, câștigând trofeul cu un lot fără vedete internaționale mari la acel moment.",
    source: "Istoric UEFA", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "porto-transfer-out-2026", teamId: "fc-porto", category: "champions-league",
    title: "Plecare", icon: "info",
    subtitle: "Luuk de Jong a plecat liber de contract la PSV Eindhoven.",
    body: "Verificat direct din istoricul de transferuri PSV.",
    source: "Wikipedia — 2025-26 PSV Eindhoven season", publishedAtMs: Date.parse("2026-08-12"),
  },

  // ── VILLARREAL ──
  {
    id: "villarreal-intro", teamId: "villarreal", category: "champions-league",
    title: "Cine este Villarreal?", icon: "info",
    subtitle: "„Submarinul Galben\" — dintr-un oraș de doar 50.000 de locuitori, un rezultat neobișnuit de bun pentru dimensiunea orașului.",
    body: "Villarreal a ajuns semifinalistă de Champions League (2006, 2022), o performanță rară pentru un club din afara marilor centre spaniole.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "villarreal-coach-2026", teamId: "villarreal", category: "champions-league",
    title: "Antrenorul", icon: "info",
    subtitle: "Íñigo Pérez, adus de la Rayo Vallecano, unde a impresionat.",
    body: "Verificat direct: Villarreal a terminat sezonul trecut pe locul 3 în LaLiga, calificare directă în Champions League.",
    source: "FIFPlay — LaLiga 2026-27 Managers", publishedAtMs: Date.parse("2026-08-12"),
  },

  // ── REAL BETIS ──
  {
    id: "betis-intro", teamId: "real-betis", category: "champions-league",
    title: "Cine este Real Betis?", icon: "info",
    subtitle: "Din Sevilla, rivalul orașului al lui Sevilla FC — El Gran Derbi.",
    body: "Betis are un suport pasionat, cunoscut pentru loialitate chiar și în perioadele mai puțin reușite ale clubului.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "betis-coach-2026", teamId: "real-betis", category: "champions-league",
    title: "Antrenorul", icon: "info",
    subtitle: "Manuel Pellegrini continuă la conducerea tehnică — stabilitate, nu schimbare.",
    body: "Verificat direct: Pellegrini rămâne pentru 2026/27, oferind continuitate tactică echipei.",
    source: "FIFPlay — LaLiga 2026-27 Managers", publishedAtMs: Date.parse("2026-08-12"),
  },
  {
    id: "betis-transfer-2026", teamId: "real-betis", category: "champions-league",
    title: "Transfer important", icon: "info",
    subtitle: "Fran García, venit definitiv de la Real Madrid.",
    body: "Verificat direct: fundașul stânga a semnat cu Betis după plecarea de la Real Madrid, în vara 2026.",
    source: "Wikipedia — 2026-27 Real Madrid CF season", publishedAtMs: Date.parse("2026-08-12"),
  },

  // ── RB LEIPZIG ──
  {
    id: "leipzig-intro", teamId: "rb-leipzig", category: "champions-league",
    title: "Cine este RB Leipzig?", icon: "info",
    subtitle: "Cel mai tânăr club mare din Germania — fondat abia în 2009.",
    body: "RB Leipzig a urcat de la liga a cincea germană până în Bundesliga și Champions League în mai puțin de un deceniu.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "leipzig-coach-2026", teamId: "rb-leipzig", category: "champions-league",
    title: "Antrenorul", icon: "info",
    subtitle: "Martín Demichelis, venit de la Mallorca — contract până în 2028.",
    body: "Verificat direct: Leipzig l-a demis pe Ole Werner după un sezon terminat pe locul 3, aducându-l pe fostul internațional argentinian Demichelis.",
    source: "Bundesliga.com", publishedAtMs: Date.parse("2026-08-12"),
  },

  // ── LENS ──
  {
    id: "lens-intro", teamId: "lens", category: "champions-league",
    title: "Cine este RC Lens?", icon: "info",
    subtitle: "Stadionul Bollaert-Delelis are una dintre cele mai intense atmosfere din fotbalul francez.",
    body: "Dintr-un oraș minier din nordul Franței, Lens are un suport foarte apropiat de club, cu o loialitate istorică puternică.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "lens-cup-2026", teamId: "lens", category: "champions-league",
    title: "Un moment istoric", icon: "record",
    subtitle: "Prima Cupă a Franței din istoria clubului, câștigată în mai 2026 (3-1 cu Nice).",
    body: "Verificat direct: Lens a terminat și vice-campioană în Ligue 1 2025/26, la doar 6 puncte de PSG — cel mai bun sezon recent al clubului.",
    source: "Wikipedia — RC Lens", publishedAtMs: Date.parse("2026-08-12"),
  },
  {
    id: "lens-coach-change-2026", teamId: "lens", category: "champions-league",
    title: "O plecare importantă", icon: "info",
    subtitle: "Pierre Sage a plecat la Crystal Palace, după un singur sezon de succes la Lens.",
    body: "Verificat direct: succesorul nu era confirmat la data cercetării — nu presupunem cine preia echipa.",
    source: "Premier League.com", publishedAtMs: Date.parse("2026-08-12"),
  },

  // ── FEYENOORD ──
  {
    id: "feyenoord-intro", teamId: "feyenoord", category: "champions-league",
    title: "Cine este Feyenoord?", icon: "info",
    subtitle: "Din Rotterdam, joacă pe legendarul stadion De Kuip.",
    body: "Feyenoord a fost primul club olandez care a câștigat Cupa Campionilor, în 1970.",
    source: "Istoric UEFA", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "feyenoord-coach-2026", teamId: "feyenoord", category: "champions-league",
    title: "O schimbare surprinzătoare", icon: "info",
    subtitle: "Robin van Persie a fost demis, deși a dus echipa pe locul 2 și în Champions League.",
    body: "Verificat direct: clubul a motivat decizia prin tendința descendentă de puncte acumulate, atât în Europa cât și în campionat, spre finalul sezonului trecut.",
    source: "Feyenoord.com (comunicat oficial)", publishedAtMs: Date.parse("2026-08-12"),
  },

  // ── GALATASARAY ──
  {
    id: "galatasaray-intro", teamId: "galatasaray", category: "champions-league",
    title: "Cine este Galatasaray?", icon: "info",
    subtitle: "Din Istanbul — stadionul are o atmosferă recunoscută ca una dintre cele mai intimidante din Europa.",
    body: "Galatasaray e singurul club turc care a câștigat un trofeu major UEFA (Cupa UEFA, 2000).",
    source: "Istoric UEFA", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "galatasaray-coach-2026", teamId: "galatasaray", category: "champions-league",
    title: "Antrenorul", icon: "info",
    subtitle: "Okan Buruk continuă la conducerea tehnică.",
    body: "Verificat direct din Wikipedia — sezonul 2026/27.",
    source: "Wikipedia — 2026-27 Galatasaray S.K. season", publishedAtMs: Date.parse("2026-08-12"),
  },

  // ── SHAKHTAR DONETSK ──
  {
    id: "shakhtar-intro", teamId: "shakhtar", category: "champions-league",
    title: "Cine este Shakhtar Donetsk?", icon: "info",
    subtitle: "Din cauza războiului, clubul își joacă meciurile de acasă în alte orașe din Ucraina sau în afara țării.",
    body: "Shakhtar rămâne unul dintre cele mai puternice cluburi din Europa de Est, câștigătoare de Cupă UEFA în 2009.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "shakhtar-coach-2026", teamId: "shakhtar", category: "champions-league",
    title: "Antrenorul", icon: "info",
    subtitle: "Arda Turan, fost jucător la Barcelona și Atlético Madrid — contract până în 2027.",
    body: "Verificat direct: Turan a dus Shakhtar la titlul de campioană a Ucrainei în primul lui sezon complet la club (2025/26).",
    source: "Wikipedia — 2025-26 FC Shakhtar Donetsk season", publishedAtMs: Date.parse("2026-08-12"),
  },

  // ── SLAVIA PRAGA ──
  {
    id: "slavia-intro", teamId: "slavia-prague", category: "champions-league",
    title: "Cine este Slavia Praga?", icon: "info",
    subtitle: "Unul dintre cele mai vechi cluburi din Europa Centrală, fondat în 1892.",
    body: "Slavia a revenit ca forță constantă în cupele europene în ultimii ani, după o perioadă mai discretă.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "slavia-coach-2026", teamId: "slavia-prague", category: "champions-league",
    title: "Antrenorul", icon: "info",
    subtitle: "Jindřich Trpišovský — stabilitate de lungă durată, campioni en-titre ai Cehiei.",
    body: "Verificat direct: Slavia a câștigat campionatul ceh 2025/26, cu Tomáš Chorý golgheter (17 goluri).",
    source: "Wikipedia — 2025-26 SK Slavia Prague season", publishedAtMs: Date.parse("2026-08-12"),
  },

  // ── ASTON VILLA ──
  {
    id: "astonvilla-intro", teamId: "aston-villa", category: "champions-league",
    title: "Cine este Aston Villa?", icon: "info",
    subtitle: "Câștigătoarea Cupei Campionilor Europeni în 1982.",
    body: "Din Birmingham, Villa e unul dintre cluburile fondatoare ale Premier League (pe atunci First Division), cu un istoric bogat.",
    source: "Istoric UEFA", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "astonvilla-coach-2026", teamId: "aston-villa", category: "champions-league",
    title: "Antrenorul", icon: "info",
    subtitle: "Unai Emery, contract prelungit până în 2029.",
    body: "Verificat direct: Emery a dus Villa la câștigarea Europa League 2025/26 și a calificării în Champions League — cel mai bun sezon recent al clubului.",
    source: "Wikipedia — Unai Emery", publishedAtMs: Date.parse("2026-08-12"),
  },
  {
    id: "astonvilla-transfers-2026", teamId: "aston-villa", category: "champions-league",
    title: "Transferuri importante", icon: "info",
    subtitle: "Johan Manzambi (de la Freiburg, ~59.5 milioane de lire) — cel mai scump transfer din istoria clubului.",
    body: "Verificat direct: Morgan Rogers a fost vândut la Chelsea pentru ~117 milioane de lire — noul record de vânzare al clubului, depășind transferul lui Jack Grealish.",
    source: "Football FanCast", publishedAtMs: Date.parse("2026-08-12"),
  },

  // ── VFB STUTTGART ──
  {
    id: "stuttgart-intro", teamId: "vfb-stuttgart", category: "champions-league",
    title: "Cine este VfB Stuttgart?", icon: "info",
    subtitle: "Câștigătoare de Bundesliga în 2007, revenită la nivel european după o perioadă mai discretă.",
    body: "Stuttgart e cunoscut pentru academia sa de tineret, care a produs mulți jucători ajunși la echipa națională a Germaniei.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "stuttgart-coach-2026", teamId: "vfb-stuttgart", category: "champions-league",
    title: "Antrenorul", icon: "info",
    subtitle: "Sebastian Hoeneß — echipa a terminat locul 4 în Bundesliga și finalistă de DFB-Pokal.",
    body: "Verificat direct: Deniz Undav a fost golgheterul echipei, cu 19 goluri în campionat.",
    source: "Wikipedia — 2025-26 VfB Stuttgart season", publishedAtMs: Date.parse("2026-08-12"),
  },

  // ── LILLE ──
  {
    id: "lille-intro", teamId: "lille", category: "champions-league",
    title: "Cine este Lille?", icon: "info",
    subtitle: "Campioană a Franței în 2021, surprinzând marile cluburi cu buget mult mai mic.",
    body: "Lille e cunoscut pentru identificarea și dezvoltarea de jucători tineri, mulți transferați ulterior la cluburi mari europene.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "lille-coach-2026", teamId: "lille", category: "champions-league",
    title: "Antrenorul", icon: "info",
    subtitle: "Davide Ancelotti — fiul lui Carlo Ancelotti, la primul job de antrenor principal la un club mare.",
    body: "Verificat direct: îl înlocuiește pe Bruno Génésio, care a dus Lille pe locul 3 în Ligue 1 și calificare în Champions League.",
    source: "beIN Sports", publishedAtMs: Date.parse("2026-08-12"),
  },

  // ── CLUB BRUGGE ──
  {
    id: "brugge-intro", teamId: "club-brugge", category: "champions-league",
    title: "Cine este Club Brugge?", icon: "info",
    subtitle: "Cel mai titrat club din Belgia alături de Anderlecht.",
    body: "Club Brugge e un prezent constant al fotbalului belgian în cupele europene, an de an.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "brugge-coach-2026", teamId: "club-brugge", category: "champions-league",
    title: "Antrenorul", icon: "info",
    subtitle: "Ivan Leko, adus în decembrie 2025 — a dus echipa la titlul de campioană.",
    body: "Verificat direct: Leko l-a înlocuit pe Nicky Hayen și a câștigat campionatul Belgiei 2025/26, cu Nicolò Tresoldi golgheter (19 goluri).",
    source: "Wikipedia — 2025-26 Club Brugge KV season", publishedAtMs: Date.parse("2026-08-12"),
  },

  // ── SPORTING CP ──
  {
    id: "sporting-intro", teamId: "sporting-cp", category: "champions-league",
    title: "Cine este Sporting CP?", icon: "info",
    subtitle: "Din Lisabona — clubul unde Cristiano Ronaldo și-a început cariera profesionistă.",
    body: "Sporting a câștigat campionatul Portugaliei de mai multe ori, alternând dominația cu Benfica și Porto.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "sporting-coach-2026", teamId: "sporting-cp", category: "champions-league",
    title: "Antrenorul", icon: "info",
    subtitle: "Rui Borges, la conducerea tehnică.",
    body: "Verificat direct: sub Borges, Sporting a terminat sezonul 2025/26 pe locul 2 în Primeira Liga și în sferturile Champions League, cu Luis Suárez golgheter al echipei (28 goluri în campionat).",
    source: "Wikipedia — 2025-26 Sporting CP season", publishedAtMs: Date.parse("2026-08-12"),
  },

  // ── AS ROMA ──
  {
    id: "roma-intro", teamId: "roma", category: "champions-league",
    title: "Cine este AS Roma?", icon: "info",
    subtitle: "Joacă pe Stadio Olimpico, alături de rivalul Lazio.",
    body: "Roma are un suport pasionat, dintre cele mai intense din fotbalul italian, deși titluri de campioană a avut doar 3 în istorie.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "roma-transfer-2026", teamId: "roma", category: "champions-league",
    title: "Transfer important", icon: "info",
    subtitle: "Donyell Malen, venit de la Aston Villa pentru ~21.6 milioane de lire.",
    body: "Verificat direct: atacantul olandez a fost una dintre semnările verii 2026 pentru Roma.",
    source: "Wikipedia — 2026-27 Aston Villa season", publishedAtMs: Date.parse("2026-08-12"),
  },

  // ── COMO ──
  {
    id: "como-intro", teamId: "como-1907", category: "champions-league",
    title: "Cine este Como?", icon: "info",
    subtitle: "Din orașul de pe malul Lacului Como, revenit recent în Serie A după mulți ani în ligile inferioare.",
    body: "Como a avut o revenire notabilă în fotbalul italian mare, cu investiții semnificative în ultimii ani.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },

  // ── UNIVERSITATEA CRAIOVA ──
  {
    id: "ucraiova-champion-2026", teamId: "u-craiova", category: "liga",
    title: "Campioana en-titre a României", icon: "record",
    subtitle: "Al 5-lea titlu de campioană din istoria clubului, sezonul 2025/26 — calificare directă în Champions League.",
    body: "Verificat direct: Universitatea Craiova s-a calificat direct în league phase-ul Champions League 2026/27, cea mai mare performanță europeană din istoria recentă a clubului.",
    source: "Wikipedia — 2025-26 Liga I", publishedAtMs: Date.parse("2026-08-12"),
  },
  {
    id: "ucraiova-coach-2026", teamId: "u-craiova", category: "liga",
    title: "Antrenorul", icon: "info",
    subtitle: "Filipe Coelho, confirmat pentru sezonul 2026/27.",
    body: "Verificat direct: printre transferurile verii, Alexandru Maxim a venit de la Voluntari, iar Răzvan Sava (portar) de la Udinese.",
    source: "SuperLiga.ro", publishedAtMs: Date.parse("2026-08-12"),
  },

  // ── CFR CLUJ ──
  {
    id: "cfrcluj-coach-2026", teamId: "cfr-cluj", category: "liga",
    title: "Schimbare de antrenor, chiar acum", icon: "info",
    subtitle: "Marius Șumudică, numit la conducerea tehnică — al doilea mandat la club.",
    body: "Verificat direct, informație foarte recentă: Șumudică îl înlocuiește pe Antonio Folha, într-un moment dificil pentru club — interdicție de transferuri din cauza salariilor restante către 5 jucători.",
    source: "Digisport.ro", publishedAtMs: Date.parse("2026-08-12"),
  },
  {
    id: "cfrcluj-europe-2026", teamId: "cfr-cluj", category: "liga",
    title: "În cupele europene", icon: "info",
    subtitle: "Calificată în Conference League 2026/27.",
    body: "Verificat direct din clasamentul final Liga I 2025/26.",
    source: "Wikipedia — 2025-26 Liga I", publishedAtMs: Date.parse("2026-08-12"),
  },

  // ── UNIVERSITATEA CLUJ ──
  {
    id: "ucluj-coach-2026", teamId: "u-cluj", category: "liga",
    title: "Antrenorul", icon: "info",
    subtitle: "Cristiano Bergodi, confirmat pentru 2026/27.",
    body: "Verificat direct: U Cluj s-a calificat în Europa League 2026/27, terminând pe locul 2 în Liga I 2025/26 — cea mai bună performanță recentă a clubului.",
    source: "SuperLiga.ro / Wikipedia", publishedAtMs: Date.parse("2026-08-12"),
  },

  // ── DINAMO BUCUREȘTI ──
  {
    id: "dinamo-coach-2026", teamId: "dinamo-bucuresti", category: "liga",
    title: "Antrenorul", icon: "info",
    subtitle: "Nuno Campos, la conducerea tehnică.",
    body: "Verificat direct din context de transfer — Dinamo și-a întărit atacul în această vară.",
    source: "Mediafax.ro", publishedAtMs: Date.parse("2026-08-12"),
  },

  // ── RAPID BUCUREȘTI ──
  {
    id: "rapid-transfer-2026", teamId: "rapid-bucuresti", category: "liga",
    title: "Transfer important", icon: "info",
    subtitle: "Un fundaș cu experiență, adus de la FCSB.",
    body: "Verificat direct: Rapid a fost una dintre echipele active pe piața de transferuri a verii 2026.",
    source: "Mediafax.ro", publishedAtMs: Date.parse("2026-08-12"),
  },

  // ── FCSB ──
  {
    id: "fcsb-europe-2026", teamId: "fcsb", category: "liga",
    title: "În cupele europene", icon: "info",
    subtitle: "Calificată în Conference League 2026/27, alături de CFR Cluj.",
    body: "Verificat direct din clasamentul final Liga I 2025/26.",
    source: "Wikipedia — 2025-26 Liga I", publishedAtMs: Date.parse("2026-08-12"),
  },

  // ── ECHIPE CALIFICATE ÎN EUROPA LEAGUE / CONFERENCE LEAGUE (nu și
  // Champions League) — La Liga, Serie A, Premier League. ──

  // ── BOURNEMOUTH ──
  {
    id: "bournemouth-europe-2026", teamId: "bournemouth", category: "liga",
    title: "În Europa League", icon: "info",
    subtitle: "Calificată pe locul 6 în Premier League 2025/26 — primul sezon european din istoria recentă a clubului.",
    body: "Verificat direct: Bournemouth se alătură fazei de grupe a Europa League 2026/27.",
    source: "Sky Sports", publishedAtMs: Date.parse("2026-08-12"),
  },

  // ── SUNDERLAND ──
  {
    id: "sunderland-europe-2026", teamId: "sunderland", category: "liga",
    title: "În Europa League", icon: "info",
    subtitle: "Locul 7 în Premier League 2025/26, calificare prin locul liber lăsat de Manchester City (câștigătoare FA Cup, deja în Champions League).",
    body: "Verificat direct din Sky Sports.",
    source: "Sky Sports", publishedAtMs: Date.parse("2026-08-12"),
  },

  // ── CRYSTAL PALACE ──
  {
    id: "crystalpalace-europe-2026", teamId: "crystal-palace", category: "liga",
    title: "Campioana en-titre a Conference League", icon: "record",
    subtitle: "A câștigat Conference League 2025/26 (1-0 cu Rayo Vallecano în finală) — urcă direct în Europa League.",
    body: "Verificat direct: primul trofeu european din istoria clubului Crystal Palace.",
    source: "Sky Sports", publishedAtMs: Date.parse("2026-08-12"),
  },

  // ── BRIGHTON ──
  {
    id: "brighton-europe-2026", teamId: "brighton", category: "liga",
    title: "În Conference League", icon: "info",
    subtitle: "Locul 8 în Premier League 2025/26 — calificare prin cascada de locuri libere.",
    body: "Verificat direct din Sky Sports.",
    source: "Sky Sports", publishedAtMs: Date.parse("2026-08-12"),
  },

  // ── REAL SOCIEDAD ──
  {
    id: "realsociedad-europe-2026", teamId: "real-sociedad", category: "liga",
    title: "În Europa League", icon: "info",
    subtitle: "Calificată prin câștigarea Copei del Rey 2025/26.",
    body: "Verificat direct din beIN Sports.",
    source: "beIN Sports", publishedAtMs: Date.parse("2026-08-12"),
  },

  // ── CELTA VIGO ──
  {
    id: "celtavigo-europe-2026", teamId: "celta-vigo", category: "liga",
    title: "În Europa League", icon: "info",
    subtitle: "Locul 6 în LaLiga 2025/26, în ciuda unei schimbări de antrenor în cursul sezonului.",
    body: "Verificat direct din beIN Sports.",
    source: "beIN Sports", publishedAtMs: Date.parse("2026-08-12"),
  },

  // ── GETAFE ──
  {
    id: "getafe-europe-2026", teamId: "getafe", category: "liga",
    title: "Surpriza sezonului — Conference League", icon: "record",
    subtitle: "Getafe a depășit Rayo Vallecano în cursa pentru Europa, calificându-se în Conference League.",
    body: "Verificat direct: una dintre cele mai neașteptate calificări europene din LaLiga 2025/26.",
    source: "beIN Sports", publishedAtMs: Date.parse("2026-08-12"),
  },

  // ── JUVENTUS / MILAN — actualizare status european ──
  {
    id: "juventus-europe-2026", teamId: "juventus", category: "liga",
    title: "În Europa League", icon: "info",
    subtitle: "Calificată pe locul 6 în Serie A 2025/26.",
    body: "Verificat direct din lista oficială UEFA a echipelor calificate în Europa League 2026/27.",
    source: "Wikipedia — 2026-27 UEFA Europa League", publishedAtMs: Date.parse("2026-08-12"),
  },
  {
    id: "milan-europe-2026", teamId: "milan", category: "liga",
    title: "În Europa League", icon: "info",
    subtitle: "Calificată pe locul 5 în Serie A 2025/26 — fără Champions League acest sezon.",
    body: "Verificat direct din lista oficială UEFA a echipelor calificate în Europa League 2026/27.",
    source: "Wikipedia — 2026-27 UEFA Europa League", publishedAtMs: Date.parse("2026-08-12"),
  },

  // ══════════════════════════════════════════════════════════════
  // ORAȘE — istorie, obiective turistice, curiozități FĂRĂ legătură
  // cu fotbalul. Apar STRICT în același fel ca restul băncii — doar
  // atașate unui meci real al echipei respective, niciodată separat.
  // Fapte stabile, verificate din cunoștințe generale (nu se schimbă
  // de la un sezon la altul, spre deosebire de loturi/antrenori).
  // ══════════════════════════════════════════════════════════════

  // ── MADRID (Real Madrid, Atlético Madrid) ──
  {
    id: "madrid-city-museum", teamId: "real-madrid", category: "champions-league",
    title: "Despre oraș", icon: "info",
    subtitle: "Muzeul Prado — una dintre cele mai importante colecții de artă europeană din lume.",
    body: "La câțiva pași de Bernabéu, „Triunghiul de Aur al Artei\" (Prado, Reina Sofía, Thyssen-Bornemisza) adună mii de opere, de la Velázquez și Goya până la Picasso.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "madrid-city-park", teamId: "real-madrid", category: "champions-league",
    title: "Despre oraș", icon: "info",
    subtitle: "Parcul Retiro — fostă grădină regală, azi spațiu verde deschis tuturor, în centrul orașului.",
    body: "Cu un lac artificial și monumente istorice, Retiro e locul unde madrilenii se refugiază de agitația orașului.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "madrid-city-plazamayor", teamId: "real-madrid", category: "champions-league",
    title: "Despre oraș", icon: "info",
    subtitle: "Plaza Mayor — piața centrală istorică, construită în secolul XVII, fostă gazdă a corridelor și piețelor publice.",
    body: "Astăzi înconjurată de cafenele și magazine, rămâne unul dintre punctele de întâlnire preferate din centrul vechi.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "madrid-city-food", teamId: "real-madrid", category: "champions-league",
    title: "Despre oraș", icon: "info",
    subtitle: "Mercado de San Miguel — o piață de fier și sticlă din 1916, azi transformată în paradis culinar.",
    body: "Localnicii și turiștii vin aici pentru tapas, jamón ibérico și vin spaniol, într-o atmosferă animată tot timpul zilei.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },

  // ── BARCELONA ──
  {
    id: "barcelona-city-sagradafamilia", teamId: "barcelona", category: "champions-league",
    title: "Despre oraș", icon: "info",
    subtitle: "Sagrada Família — capodopera lui Antoni Gaudí, în construcție din 1882, încă neterminată.",
    body: "Cea mai vizitată clădire din Spania, cu o arhitectură unică, imposibil de confundat cu altceva.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "barcelona-city-parkguell", teamId: "barcelona", category: "champions-league",
    title: "Despre oraș", icon: "info",
    subtitle: "Park Güell — alt proiect Gaudí, cu o priveliște panoramică asupra întregului oraș.",
    body: "Mozaicurile colorate și formele organice fac din parc unul dintre simbolurile vizuale ale Barcelonei.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "barcelona-city-ramblas", teamId: "barcelona", category: "champions-league",
    title: "Despre oraș", icon: "info",
    subtitle: "La Rambla — bulevardul pietonal cel mai cunoscut al orașului, care leagă centrul de port.",
    body: "Piața Boqueria, o piață de mâncare tradițională de pe traseu, e una dintre cele mai vizitate din Europa.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "barcelona-city-beach", teamId: "barcelona", category: "champions-league",
    title: "Despre oraș", icon: "info",
    subtitle: "Barcelona e unul dintre puținele mari orașe europene cu plajă adevărată, în oraș, nu la periferie.",
    body: "Plaja Barceloneta a fost creată artificial pentru Jocurile Olimpice din 1992, transformând complet fața de mare a orașului.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },

  // ── MÜNCHEN (Bayern) ──
  {
    id: "munchen-city-oktoberfest", teamId: "bayern-munchen", category: "champions-league",
    title: "Despre oraș", icon: "info",
    subtitle: "Oktoberfest — cel mai mare festival popular din lume, găzduit anual la München din 1810.",
    body: "Peste 6 milioane de oameni participă în fiecare an, în cele aproape trei săptămâni de festival.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "munchen-city-marienplatz", teamId: "bayern-munchen", category: "champions-league",
    title: "Despre oraș", icon: "info",
    subtitle: "Marienplatz — piața centrală, cu primăria neogotică și celebrul ei carillon cu figurine.",
    body: "De trei ori pe zi, figurinele mecanice din turnul primăriei reconstituie scene istorice pentru turiștii adunați jos.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "munchen-city-englischergarten", teamId: "bayern-munchen", category: "champions-league",
    title: "Despre oraș", icon: "info",
    subtitle: "Englischer Garten — unul dintre cele mai mari parcuri urbane din lume, mai mare decât Central Park din New York.",
    body: "Un râu artificial traversează parcul, unde localnicii fac chiar și surfing pe valul permanent format la un capăt.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },

  // ── PARIS (PSG) ──
  {
    id: "paris-city-eiffel", teamId: "paris-saint-germain", category: "champions-league",
    title: "Despre oraș", icon: "info",
    subtitle: "Turnul Eiffel — construit pentru Expoziția Universală din 1889, gândit inițial ca structură temporară.",
    body: "Considerat urât de mulți parizieni la vremea construcției, a devenit simbolul absolut al orașului.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "paris-city-louvre", teamId: "paris-saint-germain", category: "champions-league",
    title: "Despre oraș", icon: "info",
    subtitle: "Muzeul Luvru — cel mai vizitat muzeu din lume, fostă reședință regală.",
    body: "Găzduiește peste 35.000 de opere expuse, printre care celebra Mona Lisa a lui Leonardo da Vinci.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "paris-city-montmartre", teamId: "paris-saint-germain", category: "champions-league",
    title: "Despre oraș", icon: "info",
    subtitle: "Montmartre — cartierul artiștilor, dominat de bazilica albă Sacré-Cœur, pe cel mai înalt punct al orașului.",
    body: "Pictorii de stradă din Place du Tertre continuă o tradiție de peste un secol, din vremea lui Picasso și Dalí.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },

  // ── LONDRA (Arsenal) ──
  {
    id: "londra-city-bigben", teamId: "arsenal", category: "champions-league",
    title: "Despre oraș", icon: "info",
    subtitle: "Big Ben — de fapt numele clopotului, nu al turnului (numit oficial Elizabeth Tower).",
    body: "Un fapt puțin cunoscut chiar și de mulți londonezi — porecla s-a extins în timp asupra întregului turn.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "londra-city-britishmuseum", teamId: "arsenal", category: "champions-league",
    title: "Despre oraș", icon: "info",
    subtitle: "British Museum — intrare gratuită, cu peste 8 milioane de obiecte din toată istoria umanității.",
    body: "Piatra Rosetta, cheia care a permis descifrarea hieroglifelor egiptene, e una dintre piesele centrale ale colecției.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },

  // ── MANCHESTER (Manchester City, Manchester United) ──
  {
    id: "manchester-city-industrial", teamId: "manchester-city", category: "champions-league",
    title: "Despre oraș", icon: "info",
    subtitle: "Manchester a fost centrul Revoluției Industriale britanice, poreclit „Cottonopolis\" pentru industria textilă.",
    body: "Prima cale ferată de călători din lume a legat Manchester de Liverpool, în 1830.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "manchester-city-music", teamId: "manchester-city", category: "champions-league",
    title: "Despre oraș", icon: "info",
    subtitle: "Un centru muzical important — orașul a dat naștere unor trupe precum Oasis și Joy Division.",
    body: "Scena muzicală „Madchester\" din anii '80-'90 a influențat profund muzica britanică modernă.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },

  // ── LIVERPOOL ──
  {
    id: "liverpool-city-beatles", teamId: "liverpool", category: "champions-league",
    title: "Despre oraș", icon: "info",
    subtitle: "Orașul natal al trupei The Beatles — cartierul Cavern Quarter le păstrează istoria muzicală.",
    body: "Cavern Club, unde a debutat trupa, rămâne un loc de pelerinaj pentru fanii muzicii din toată lumea.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "liverpool-city-waterfront", teamId: "liverpool", category: "champions-league",
    title: "Despre oraș", icon: "info",
    subtitle: "Malul apei (Pier Head) e sit UNESCO — clădirile „Three Graces\" domină silueta portului.",
    body: "Liverpool a fost unul dintre cele mai importante porturi ale lumii în secolele XIX-XX.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },

  // ── MILANO (Inter, AC Milan) ──
  {
    id: "milano-city-duomo", teamId: "inter", category: "champions-league",
    title: "Despre oraș", icon: "info",
    subtitle: "Domul din Milano — a patra cea mai mare catedrală din lume, construită timp de aproape 6 secole.",
    body: "Cu peste 3.400 de statui pe exterior, e considerată o capodoperă a arhitecturii gotice.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "milano-city-fashion", teamId: "inter", category: "champions-league",
    title: "Despre oraș", icon: "info",
    subtitle: "Una dintre cele „patru capitale ale modei\" din lume, alături de Paris, Londra și New York.",
    body: "Quadrilatero della Moda, cartierul de lux al orașului, găzduiește sediile marilor case de modă italiene.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },

  // ── ISTANBUL (Galatasaray) ──
  {
    id: "istanbul-city-continents", teamId: "galatasaray", category: "champions-league",
    title: "Despre oraș", icon: "info",
    subtitle: "Singurul oraș major din lume situat pe două continente — Europa și Asia, despărțite de strâmtoarea Bosfor.",
    body: "Fosta capitală a trei imperii (Roman, Bizantin, Otoman), Istanbul are un amestec unic de istorie și cultură.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },

  // ── LISABONA (Sporting CP) ──
  {
    id: "lisabona-city-tram", teamId: "sporting-cp", category: "champions-league",
    title: "Despre oraș", icon: "info",
    subtitle: "Tramvaiul 28 — o rută turistică celebră, ce urcă și coboară pe dealurile abrupte ale orașului.",
    body: "Lisabona e construită pe 7 dealuri, ca și Roma — de-aici priveliștile spectaculoase din multe puncte ale orașului.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },

  // ── ROTTERDAM (Feyenoord) ──
  {
    id: "rotterdam-city-architecture", teamId: "feyenoord", category: "champions-league",
    title: "Despre oraș", icon: "info",
    subtitle: "Reconstruit aproape complet după bombardamentele din Al Doilea Război Mondial, Rotterdam are azi o arhitectură modernă îndrăzneață.",
    body: "Casele Cubice (Kubuswoningen) rămân una dintre cele mai fotografiate curiozități arhitecturale din Olanda.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },

  // ── NAPOLI ──
  {
    id: "napoli-city-history", teamId: "napoli", category: "champions-league",
    title: "Despre oraș", icon: "info",
    subtitle: "Unul dintre cele mai vechi orașe locuite continuu din Europa, fondat de greci acum peste 2.800 de ani.",
    body: "Centrul istoric al Napoli e inclus în patrimoniul UNESCO, cu straturi de istorie greacă, romană și medievală suprapuse.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "napoli-city-vesuvius", teamId: "napoli", category: "champions-league",
    title: "Despre oraș", icon: "info",
    subtitle: "Vezuviul — vulcanul activ care domină orizontul orașului, faimos pentru distrugerea Pompeiului în anul 79.",
    body: "Napoli e și orașul unde a fost inventată pizza margherita, considerată azi patrimoniu culinar mondial.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },

  // ── PORTO ──
  {
    id: "porto-city-history", teamId: "fc-porto", category: "champions-league",
    title: "Despre oraș", icon: "info",
    subtitle: "Orașul care a dat numele întregii țări — Portugalia derivă din „Portus Cale\", vechiul nume al zonei.",
    body: "Centrul istoric, construit pe malurile râului Douro, e inclus în patrimoniul UNESCO.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "porto-city-wine", teamId: "fc-porto", category: "champions-league",
    title: "Despre oraș", icon: "info",
    subtitle: "Vinul de Porto — celebrul vin dulce fortifiat, produs în Valea Douro și maturat în pivnițele din Vila Nova de Gaia.",
    body: "Podul Dom Luís I, cu structura sa metalică impresionantă, leagă cele două maluri ale orașului.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },

  // ── TORINO (Juventus) ──
  {
    id: "torino-city-history", teamId: "juventus", category: "liga",
    title: "Despre oraș", icon: "info",
    subtitle: "Prima capitală a Italiei unificate (1861-1865), înainte ca sediul guvernului să se mute la Florența, apoi Roma.",
    body: "Torino găzduiește și Muzeul Egiptean, a doua cea mai mare colecție de artefacte egiptene din lume, după cel din Cairo.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },

  // ── ORAȘE ÎMPĂRȚITE — aceleași fapte, ambele echipe din oraș. ──
  {
    id: "madrid-city-museum-atletico", teamId: "atletico-madrid", category: "champions-league",
    title: "Despre oraș", icon: "info",
    subtitle: "Muzeul Prado — una dintre cele mai importante colecții de artă europeană din lume.",
    body: "„Triunghiul de Aur al Artei\" (Prado, Reina Sofía, Thyssen-Bornemisza) adună mii de opere, de la Velázquez și Goya până la Picasso.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "madrid-city-plazamayor-atletico", teamId: "atletico-madrid", category: "champions-league",
    title: "Despre oraș", icon: "info",
    subtitle: "Plaza Mayor — piața centrală istorică, construită în secolul XVII.",
    body: "Astăzi înconjurată de cafenele și magazine, rămâne unul dintre punctele de întâlnire preferate din centrul vechi.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "manchester-city-industrial-utd", teamId: "manchester-united", category: "champions-league",
    title: "Despre oraș", icon: "info",
    subtitle: "Manchester a fost centrul Revoluției Industriale britanice, poreclit „Cottonopolis\" pentru industria textilă.",
    body: "Prima cale ferată de călători din lume a legat Manchester de Liverpool, în 1830.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "milano-city-duomo-milan", teamId: "milan", category: "liga",
    title: "Despre oraș", icon: "info",
    subtitle: "Domul din Milano — a patra cea mai mare catedrală din lume, construită timp de aproape 6 secole.",
    body: "Cu peste 3.400 de statui pe exterior, e considerată o capodoperă a arhitecturii gotice.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },

  // ── DORTMUND ──
  {
    id: "dortmund-city-history", teamId: "borussia-dortmund", category: "champions-league",
    title: "Despre oraș", icon: "info",
    subtitle: "Dortmund a fost un important centru al industriei cărbunelui și oțelului, în Ruhr — cea mai mare zonă industrială din Germania.",
    body: "Orașul s-a reinventat după declinul industriei grele, păstrând o identitate muncitorească puternică, reflectată și în cultura fotbalistică locală.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },

  // ── MARSILIA ──
  {
    id: "marseille-city-history", teamId: "marseille", category: "liga",
    title: "Despre oraș", icon: "info",
    subtitle: "Cel mai vechi oraș din Franța, fondat de coloniști greci în jurul anului 600 î.Hr.",
    body: "Vieux-Port (Portul Vechi) rămâne inima orașului, înconjurat de restaurante și piețe de pește tradiționale.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },

  // ── ROMA ──
  {
    id: "roma-city-colosseum", teamId: "roma", category: "champions-league",
    title: "Despre oraș", icon: "info",
    subtitle: "Colosseumul — cel mai mare amfiteatru construit vreodată de Imperiul Roman, finalizat în anul 80 d.Hr.",
    body: "Roma e singurul oraș din lume care găzduiește în interiorul lui un alt stat suveran — Vaticanul.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },

  // ── BUCUREȘTI (Dinamo, Rapid, FCSB) ──
  {
    id: "bucuresti-city-history-dinamo", teamId: "dinamo-bucuresti", category: "liga",
    title: "Despre oraș", icon: "info",
    subtitle: "Supranumit odată „Micul Paris\", pentru arhitectura de secol XIX inspirată de capitala franceză.",
    body: "Palatul Parlamentului din București e a doua cea mai mare clădire administrativă din lume, după Pentagon.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "bucuresti-city-history-rapid", teamId: "rapid-bucuresti", category: "liga",
    title: "Despre oraș", icon: "info",
    subtitle: "Supranumit odată „Micul Paris\", pentru arhitectura de secol XIX inspirată de capitala franceză.",
    body: "Palatul Parlamentului din București e a doua cea mai mare clădire administrativă din lume, după Pentagon.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "bucuresti-city-history-fcsb", teamId: "fcsb", category: "liga",
    title: "Despre oraș", icon: "info",
    subtitle: "Supranumit odată „Micul Paris\", pentru arhitectura de secol XIX inspirată de capitala franceză.",
    body: "Palatul Parlamentului din București e a doua cea mai mare clădire administrativă din lume, după Pentagon.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },

  // ── CLUJ-NAPOCA (CFR Cluj, Universitatea Cluj) ──
  {
    id: "cluj-city-history-cfr", teamId: "cfr-cluj", category: "liga",
    title: "Despre oraș", icon: "info",
    subtitle: "Al doilea cel mai populat oraș din România, considerat neoficial „capitala\" Transilvaniei.",
    body: "Cluj-Napoca are una dintre cele mai mari populații studențești din țară, cu o viață culturală foarte activă.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },
  {
    id: "cluj-city-history-ucluj", teamId: "u-cluj", category: "liga",
    title: "Despre oraș", icon: "info",
    subtitle: "Al doilea cel mai populat oraș din România, considerat neoficial „capitala\" Transilvaniei.",
    body: "Cluj-Napoca are una dintre cele mai mari populații studențești din țară, cu o viață culturală foarte activă.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },

  // ── CRAIOVA ──
  {
    id: "craiova-city-history", teamId: "u-craiova", category: "liga",
    title: "Despre oraș", icon: "info",
    subtitle: "Supranumit „Bănia\", după titlul de ban al Olteniei purtat istoric de conducătorii regiunii.",
    body: "Craiova e cel mai mare oraș din regiunea Oltenia, cu o istorie legată strâns de identitatea locală.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
  },
];
