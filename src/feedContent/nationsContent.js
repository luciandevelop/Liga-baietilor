// ══════════════════════════════════════════════════════════════════
// CURIOZITĂȚI DESPRE ECHIPELE NAȚIONALE — pentru meciurile de naționale
// (Liga Națiunilor, preliminarii, turnee finale). Doar fapte istorice
// stabile (titluri, recorduri vechi, legende, orașe), fără statistici care
// se schimbă de la o lună la alta. Aceeași formă ca EDITORIAL_ARTICLES:
// teamId = numele în română, „slug” (ex. „tara-galilor”). Nu se publică
// automat: apar în Admin → Feed → „Curiozități pentru meciurile etapei”.
// ══════════════════════════════════════════════════════════════════

const N = (teamId, n, title, subtitle, body) => ({ id: `nat-${teamId}-${n}`, teamId, title, subtitle, body, category: "nations" });

export const NATION_ARTICLES = [
  // ── TURCIA ──
  N("turcia", 1, "Despre țară", "Istanbul, orașul de pe două continente", "Cel mai mare oraș al Turciei se întinde și în Europa, și în Asia, despărțite de strâmtoarea Bosfor. Capitala țării nu e însă Istanbul, ci Ankara."),
  N("turcia", 2, "Palmares", "Locul 3 la Campionatul Mondial din 2002", "Cea mai mare performanță a Turciei: medalia de bronz la Mondialul din Coreea de Sud și Japonia, după 3-2 cu gazdele în finala mică."),
  N("turcia", 3, "Record mondial", "Cel mai rapid gol din istoria Mondialelor", "Hakan Șükür a marcat după aproximativ 11 secunde în meciul pentru locul 3 din 2002, cu Coreea de Sud. Recordul rezistă și azi."),
  N("turcia", 4, "Curiozitate", "Semifinalistă la EURO 2008", "Turcia a ajuns în semifinalele EURO 2008 după mai multe reveniri incredibile în ultimele minute, inclusiv cu Cehia și Croația."),

  // ── BELGIA ──
  N("belgia", 1, "Despre țară", "Bruxelles, capitala Europei", "Bruxelles găzduiește principalele instituții ale Uniunii Europene și sediul NATO. Simbolul orașului e Atomium, construit pentru Expoziția Universală din 1958."),
  N("belgia", 2, "Palmares", "Locul 3 la Mondialul din 2018", "Cea mai bună performanță a „Diavolilor Roșii”: bronzul din Rusia, după ce au eliminat Brazilia în sferturi."),
  N("belgia", 3, "Curiozitate", "Lideră în clasamentul FIFA ani la rând", "Generația lui Kevin De Bruyne, Eden Hazard și Romelu Lukaku a ocupat primul loc în clasamentul FIFA timp de mai mulți ani, între 2018 și 2022, fără să câștige un trofeu."),
  N("belgia", 4, "Istorie", "La prima ediție a Campionatului Mondial", "Belgia a fost una dintre cele patru echipe europene care au făcut drumul cu vaporul până în Uruguay pentru primul Mondial, în 1930, alături de România, Franța și Iugoslavia."),

  // ── ITALIA ──
  N("italia", 1, "Palmares", "Patru titluri mondiale", "Italia a câștigat Campionatul Mondial în 1934, 1938, 1982 și 2006, plus Campionatul European în 1968 și 2020."),
  N("italia", 2, "De ce „Azzurri”", "Albastrul vine de la o familie regală", "Tricoul albastru e un omagiu adus Casei de Savoia, familia regală care a unificat Italia. Albastrul era culoarea dinastiei."),
  N("italia", 3, "Legenda", "Gianluigi Buffon, recordul de selecții", "Portarul Gianluigi Buffon e jucătorul cu cele mai multe meciuri pentru Italia: 176. A câștigat Mondialul din 2006."),
  N("italia", 4, "Despre țară", "Roma, Orașul Etern", "Capitala Italiei are în interiorul ei un alt stat: Vaticanul, cea mai mică țară din lume."),

  // ── FRANȚA ──
  N("franta", 1, "Palmares", "Campioană mondială în 1998 și 2018", "Franța a câștigat Mondialul acasă în 1998, apoi în Rusia, în 2018. Are și două titluri europene: 1984 și 2000."),
  N("franta", 2, "Record", "13 goluri la un singur Mondial", "Just Fontaine a marcat 13 goluri la Campionatul Mondial din 1958, un record pentru un singur turneu care rezistă de aproape 70 de ani."),
  N("franta", 3, "Stadionul", "Stade de France, construit pentru Mondial", "Stadionul național din Saint-Denis, lângă Paris, a fost ridicat pentru Mondialul din 1998. Acolo Franța a învins Brazilia cu 3-0 în finală."),
  N("franta", 4, "Legenda", "Zinedine Zidane", "Zidane a marcat de două ori cu capul în finala din 1998 și a fost desemnat cel mai bun jucător al Mondialului din 2006."),

  // ── CEHIA ──
  N("cehia", 1, "Palmares", "Campioană europeană în 1976 (ca Cehoslovacia)", "Cehoslovacia a câștigat EURO 1976 în finala cu Germania de Vest, decisă la loviturile de departajare."),
  N("cehia", 2, "Penalty-ul care a dat nume unei lovituri", "Panenka, 1976", "Antonín Panenka a transformat penalty-ul decisiv din finala EURO 1976 cu o „lingură” pe mijlocul porții. De atunci, lovitura îi poartă numele."),
  N("cehia", 3, "Legenda", "Pavel Nedvěd, Balonul de Aur 2003", "Mijlocașul Juventusului a câștigat Balonul de Aur în 2003, după un sezon în care a dus echipa în finala Ligii Campionilor."),
  N("cehia", 4, "Despre țară", "Praga, orașul celor o sută de turnuri", "Capitala Cehiei e celebră pentru centrul vechi, Podul Carol și ceasul astronomic din secolul al XV-lea, încă funcțional."),

  // ── SPANIA ──
  N("spania", 1, "Palmares", "Record de titluri europene", "Spania a câștigat Campionatul European de patru ori (1964, 2008, 2012, 2024), mai mult decât orice altă națională, plus Mondialul din 2010."),
  N("spania", 2, "Golul istoric", "Iniesta, minutul 116", "Spania a câștigat primul Mondial din istorie în 2010, cu golul lui Andrés Iniesta în prelungirile finalei cu Olanda."),
  N("spania", 3, "Stil de joc", "Tiki-taka", "Între 2008 și 2012, Spania a câștigat trei turnee la rând (EURO, Mondial, EURO) cu un joc bazat pe pase scurte și posesie: „tiki-taka”."),
  N("spania", 4, "Despre țară", "Madrid, capitala cea mai înaltă din UE", "Madrid se află la peste 650 de metri altitudine, fiind cea mai înaltă capitală din Uniunea Europeană."),

  // ── ANGLIA ──
  N("anglia", 1, "Palmares", "Campioană mondială în 1966", "Anglia a câștigat Mondialul acasă, pe Wembley, în 1966, cu 4-2 după prelungiri în finala cu Germania de Vest. Geoff Hurst a marcat trei goluri."),
  N("anglia", 2, "Curiozitate", "Inventatorii fotbalului modern", "Regulile fotbalului au fost scrise în Anglia, în 1863, la înființarea Football Association, cea mai veche federație de fotbal din lume."),
  N("anglia", 3, "Legenda", "Harry Kane, golgheterul all-time", "Harry Kane a devenit cel mai bun marcator din istoria Angliei, depășindu-l pe Wayne Rooney."),
  N("anglia", 4, "Ghinion", "Două finale europene pierdute la rând", "Anglia a pierdut finalele EURO 2020 (cu Italia, la penalty-uri, pe Wembley) și EURO 2024 (cu Spania)."),

  // ── CROAȚIA ──
  N("croatia", 1, "Palmares", "Finalistă mondială în 2018", "Croația a jucat finala Mondialului din Rusia (pierdută cu Franța) și a luat bronzul în 1998 și 2022. Totul cu sub 4 milioane de locuitori."),
  N("croatia", 2, "Legenda", "Luka Modrić, Balonul de Aur 2018", "Modrić a întrerupt seria Messi–Ronaldo, câștigând Balonul de Aur în 2018, după ce a fost desemnat cel mai bun jucător al Mondialului."),
  N("croatia", 3, "Tricoul", "Carourile roșu-alb", "Celebrul tricou în carouri vine de la „šahovnica”, scutul cu pătrățele roșii și albe de pe stema Croației."),
  N("croatia", 4, "Debut de vis", "Golgheterul primului Mondial", "La primul Mondial ca țară independentă, în 1998, Croația a luat bronzul, iar Davor Šuker a câștigat Gheata de Aur, cu 6 goluri."),

  // ── OLANDA ──
  N("olanda", 1, "Ghinion", "Trei finale mondiale pierdute", "Olanda a jucat finala Mondialului în 1974, 1978 și 2010 și le-a pierdut pe toate trei."),
  N("olanda", 2, "Palmares", "Campioană europeană în 1988", "Singurul trofeu mare al Olandei: EURO 1988, cu voleul legendar al lui Marco van Basten în finala cu URSS."),
  N("olanda", 3, "Stil de joc", "Fotbalul total", "În anii '70, Olanda lui Johan Cruyff a revoluționat jocul cu „fotbalul total”, în care orice jucător putea juca pe orice post."),
  N("olanda", 4, "Despre țară", "O țară sub nivelul mării", "Aproximativ un sfert din Olanda se află sub nivelul mării, apărat de diguri și stăvilare, iar Amsterdamul e străbătut de peste o sută de canale."),

  // ── GRECIA ──
  N("grecia", 1, "Cea mai mare surpriză", "Campioană europeană în 2004", "Grecia a câștigat EURO 2004 ca mare outsider, învingând de două ori gazda Portugalia, inclusiv în finală, cu 1-0 (gol Charisteas)."),
  N("grecia", 2, "Antrenorul", "Otto Rehhagel", "Neamțul Otto Rehhagel a construit echipa campioană în 2004, pe o apărare foarte solidă, poreclit apoi „Rehhakles”."),
  N("grecia", 3, "Despre țară", "Atena și Jocurile Olimpice", "Jocurile Olimpice moderne au început la Atena, în 1896. Orașul le-a găzduit din nou în 2004, chiar în vara titlului european."),
  N("grecia", 4, "Curiozitate", "Fără gol primit în fazele eliminatorii", "La EURO 2004, Grecia a câștigat sferturile, semifinala și finala cu 1-0, fără să primească niciun gol în fazele eliminatorii."),

  // ── SERBIA ──
  N("serbia", 1, "Istorie", "Moștenitoarea Iugoslaviei", "Serbia preia istoria Iugoslaviei, care a ajuns în semifinale la primul Mondial, în 1930, și a jucat două finale de EURO (1960, 1968)."),
  N("serbia", 2, "Stadionul", "„Marakana” din Belgrad", "Stadionul Steaua Roșie din Belgrad e poreclit „Marakana”, după celebrul Maracanã din Rio, și e unul dintre cele mai fierbinți din Europa."),
  N("serbia", 3, "Despre țară", "Belgrad, unde se întâlnesc două fluvii", "Capitala Serbiei e construită la confluența Savei cu Dunărea, sub vechea cetate Kalemegdan."),
  N("serbia", 4, "Curiozitate", "Fabrica de talente", "Fostele echipe iugoslave erau numite „Brazilia Europei” pentru tehnica jucătorilor, iar Serbia exportă și azi fotbaliști în toată Europa."),

  // ── GERMANIA ──
  N("germania", 1, "Palmares", "Patru titluri mondiale", "Germania a câștigat Mondialul în 1954, 1974, 1990 și 2014, plus trei titluri europene (1972, 1980, 1996)."),
  N("germania", 2, "Record", "Klose, 16 goluri la Mondiale", "Miroslav Klose e cel mai bun marcator din istoria Campionatelor Mondiale, cu 16 goluri."),
  N("germania", 3, "Meciul istoric", "Brazilia – Germania 1-7", "În semifinala Mondialului din 2014, Germania a învins Brazilia acasă cu 7-1, unul dintre cele mai șocante rezultate din istorie."),
  N("germania", 4, "Minunea de la Berna", "Primul titlu mondial, 1954", "Germania de Vest a câștigat primul Mondial în 1954, învingând în finală marea Ungarie, care nu pierduse de patru ani."),

  // ── NORVEGIA ──
  N("norvegia", 1, "Meciul istoric", "Norvegia – Brazilia 2-1", "La Mondialul din 1998, Norvegia a învins Brazilia, campioana en-titre, cu 2-1, una dintre cele mai mari victorii din istoria ei."),
  N("norvegia", 2, "Vedeta", "Erling Haaland", "Atacantul lui Manchester City e unul dintre cei mai prolifici marcatori din lume și golgheterul generației actuale a Norvegiei."),
  N("norvegia", 3, "Despre țară", "Țara fiordurilor", "Norvegia are peste 1.000 de fiorduri, iar în nordul țării soarele nu apune deloc câteva săptămâni pe an, vara."),
  N("norvegia", 4, "Curiozitate", "Fotbal pe gazon artificial", "Din cauza iernilor lungi și reci, multe stadioane din campionatul norvegian au gazon artificial în loc de iarbă naturală."),

  // ── ȚARA GALILOR ──
  N("tara-galilor", 1, "Palmares", "Semifinalistă la EURO 2016", "Țara Galilor a ajuns în semifinalele EURO 2016, la primul ei turneu final după 58 de ani, eliminând Belgia în sferturi."),
  N("tara-galilor", 2, "Legenda", "Gareth Bale", "Gareth Bale e golgheterul all-time al Țării Galilor și jucătorul cu cele mai multe selecții. A câștigat cinci Ligi ale Campionilor cu Real Madrid."),
  N("tara-galilor", 3, "Curiozitate", "Primul gol al lui Pelé la un Mondial", "În sferturile Mondialului din 1958, Țara Galilor a pierdut cu Brazilia 0-1, golul fiind primul marcat vreodată de Pelé la un Mondial."),
  N("tara-galilor", 4, "Despre țară", "Cardiff și stadionul cu acoperiș", "Stadionul național din Cardiff are acoperiș retractabil, iar galezii sunt la fel de pasionați de rugby cât de fotbal."),

  // ── PORTUGALIA ──
  N("portugalia", 1, "Palmares", "Campioană europeană în 2016", "Portugalia a câștigat EURO 2016 la Paris, cu 1-0 în finala cu gazda Franța, golul fiind marcat de Éder în prelungiri."),
  N("portugalia", 2, "Liga Națiunilor", "Prima campioană a competiției", "Portugalia a câștigat prima ediție a Ligii Națiunilor, în 2019, pe teren propriu, și a câștigat-o din nou în 2025."),
  N("portugalia", 3, "Legenda", "Cristiano Ronaldo", "Ronaldo e cel mai bun marcator din istoria echipelor naționale din lume și jucătorul cu cele mai multe selecții pentru Portugalia."),
  N("portugalia", 4, "Istorie", "Eusébio, 9 goluri în 1966", "La primul Mondial al Portugaliei, în 1966, Eusébio a câștigat Gheata de Aur cu 9 goluri, iar echipa a terminat pe locul 3."),

  // ── DANEMARCA ──
  N("danemarca", 1, "Cea mai mare surpriză", "Campioană europeană fără să se fi calificat", "În 1992, Danemarca a intrat la EURO cu doar câteva zile înainte, în locul Iugoslaviei excluse, și a câștigat turneul, învingând Germania în finală."),
  N("danemarca", 2, "Legenda", "Peter Schmeichel", "Portarul campionatului european din 1992 a devenit apoi legendă la Manchester United, câștigând tripla în 1999."),
  N("danemarca", 3, "Despre țară", "Copenhaga, orașul bicicletelor", "În capitala Danemarcei sunt mai multe biciclete decât mașini, iar Mica Sirenă din port e unul dintre cele mai fotografiate simboluri ale Europei."),
  N("danemarca", 4, "Curiozitate", "Dinamita daneză", "Echipa din anii '80, cu frații Laudrup, era poreclită „Dinamita daneză” pentru jocul spectaculos și ofensiv."),

  // ── ROMÂNIA ──
  N("romania", 1, "Istorie", "La primul Campionat Mondial din istorie", "România a participat la prima ediție a Mondialului, în Uruguay, în 1930, una dintre doar patru echipe europene prezente."),
  N("romania", 2, "Cea mai mare performanță", "Sferturile Mondialului din 1994", "În SUA, România a ajuns în sferturi, după un 3-2 de neuitat cu Argentina în optimi. A fost eliminată de Suedia, la penalty-uri."),
  N("romania", 3, "Legenda", "Gheorghe Hagi, „Regele”", "Hagi e considerat cel mai mare fotbalist român. A jucat la Real Madrid și Barcelona, iar la Galatasaray a câștigat Cupa UEFA în 2000."),
  N("romania", 4, "Stadionul", "Arena Națională", "Stadionul național din București a fost inaugurat în 2011, are acoperiș retractabil și a găzduit finala Europa League din 2012 și meciuri la EURO 2020."),

  // ── POLONIA ──
  N("polonia", 1, "Palmares", "De două ori pe locul 3 la Mondiale", "Polonia a terminat pe locul 3 la Campionatul Mondial în 1974 și 1982, cea mai bună perioadă din istoria ei."),
  N("polonia", 2, "Legenda", "Robert Lewandowski", "Lewandowski e golgheterul all-time al Poloniei și unul dintre cei mai buni atacanți ai generației lui, cu titluri de golgheter în Germania și Spania."),
  N("polonia", 3, "Record", "Grzegorz Lato, Gheata de Aur 1974", "Grzegorz Lato a fost golgheterul Mondialului din 1974, cu 7 goluri, ajutând Polonia să ia bronzul."),
  N("polonia", 4, "Despre țară", "Varșovia, orașul reconstruit", "Centrul vechi al Varșoviei, distrus aproape complet în al Doilea Război Mondial, a fost reconstruit după picturi și planuri vechi și e acum în patrimoniul UNESCO."),

  // ── SUEDIA ──
  N("suedia", 1, "Palmares", "Finalistă mondială acasă, în 1958", "Suedia a jucat finala Mondialului organizat de ea în 1958, pierdută cu Brazilia lui Pelé, care avea doar 17 ani."),
  N("suedia", 2, "Legenda", "Zlatan Ibrahimović", "Zlatan e golgheterul all-time al Suediei și a câștigat campionatul în patru țări diferite: Olanda, Italia, Spania și Franța."),
  N("suedia", 3, "Istorie", "De două ori pe podium", "În afară de finala din 1958, Suedia a terminat pe locul 3 la Mondialele din 1950 și 1994. În 1994 a eliminat chiar România, în sferturi."),
  N("suedia", 4, "Despre țară", "Stockholm, construit pe 14 insule", "Capitala Suediei e construită pe 14 insule legate prin poduri, iar acolo se decernează în fiecare an majoritatea Premiilor Nobel."),

  // ── BOSNIA ȘI HERȚEGOVINA ──
  N("bosnia-si-hertegovina", 1, "Istorie", "Primul Mondial în 2014", "Bosnia și Herțegovina a jucat primul turneu final din istorie la Mondialul din Brazilia, în 2014."),
  N("bosnia-si-hertegovina", 2, "Legenda", "Edin Džeko", "Atacantul Edin Džeko e golgheterul all-time și jucătorul cu cele mai multe selecții din istoria Bosniei."),
  N("bosnia-si-hertegovina", 3, "Despre țară", "Sarajevo, gazda Olimpiadei din 1984", "Capitala Bosniei a găzduit Jocurile Olimpice de iarnă din 1984, iar podul vechi de la Mostar e unul dintre cele mai cunoscute simboluri ale Balcanilor."),
  N("bosnia-si-hertegovina", 4, "Curiozitate", "„Zmajevi”, Dragonii", "Naționala Bosniei e poreclită „Zmajevi” (Dragonii), iar jucători ca Miralem Pjanić au dus-o la cel mai bun moment al istoriei ei."),
];

// Numele echipelor naționale, în română și engleză → teamId-ul de mai sus.
export const NATION_ALIASES = {
  turkey: "turcia", turkiye: "turcia", belgium: "belgia", italy: "italia", france: "franta",
  czechia: "cehia", "czech-republic": "cehia", spain: "spania", england: "anglia", croatia: "croatia",
  netherlands: "olanda", holland: "olanda", "tarile-de-jos": "olanda", greece: "grecia", serbia: "serbia",
  germany: "germania", norway: "norvegia", wales: "tara-galilor", portugal: "portugalia", denmark: "danemarca",
  romania: "romania", poland: "polonia", sweden: "suedia", "bosnia-and-herzegovina": "bosnia-si-hertegovina",
  "bosnia-herzegovina": "bosnia-si-hertegovina", bosnia: "bosnia-si-hertegovina",
};
