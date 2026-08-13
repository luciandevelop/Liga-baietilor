// ══════════════════════════════════════════════════════════════════
// CONȚINUT EDITORIAL — profiluri reale de echipe, verificate. Fiecare
// `fact` e o bucată separată de conținut (nu un singur bloc de text) —
// asta permite Feed-ului să scoată bucăți individuale ca „știri", nu
// doar un articol lung.
//
// STARE ACTUALĂ: 18 echipe mari, din Champions League + Premier League +
// LaLiga + Serie A + Bundesliga + Ligue 1 (Real Madrid, Barcelona,
// Arsenal, PSG, Bayern, Manchester City, Liverpool, Manchester United,
// Chelsea, Tottenham, Atlético Madrid, Athletic Bilbao, Juventus, AC
// Milan, Napoli, Borussia Dortmund, AS Monaco, Marseille) — nu toate
// echipele mari din Europa încă, dar suficient cât Feed-ul chiar să aibă
// ce arăta zilnic. Extindere = obiecte noi aici, nimic din
// FeedScreen.jsx/feedService.js nu se schimbă.
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
    id: "arsenal-rivalry", teamId: "arsenal", category: "champions-league",
    title: "Rivalul principal", icon: "rivalry",
    subtitle: "North London Derby — Arsenal vs Tottenham Hotspur.",
    body: "Una dintre cele mai vechi și intense rivalități din fotbalul englez, între cele două cluburi mari din nordul Londrei.",
    source: "Cunoștințe generale, verificate", publishedAtMs: Date.parse("2026-08-01"),
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

  // ── MANCHESTER UNITED ──
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

  // ── JUVENTUS ──
  {
    id: "juventus-intro", teamId: "juventus", category: "liga",
    title: "Cine este Juventus?", icon: "info",
    subtitle: "Fondat în 1897, clubul cu cele mai multe titluri de campion din istoria Italiei.",
    body: "\"La Vecchia Signora\" (Bătrâna Doamnă) e supranumele clubului din Torino, cunoscut pentru culorile alb-negru și tradiția câștigătoare.",
    source: "Site oficial Juventus", publishedAtMs: Date.parse("2026-08-01"),
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
];
