// Mesaje absurde/glume seci pentru Mystery Box — generate COMBINATORIC
// (opener × closer, per nivel de valoare), nu scrise unul câte unul.
// ~16 openeri × ~16 closere per nivel = 256 combinații per nivel, ×4
// niveluri = peste 1000 posibile — mult peste "câteva sute" cerute, fără
// să repete des în practică (30 de cutii per etapă, șansă mică de
// coincidență). getMysteryBoxMessage() alege un opener + un closer la
// întâmplare, din nivelul potrivit valorii — nu se persistă nicăieri
// (text decorativ, nu afectează scorul), deci nici nu trebuie să fie
// determinist.

const OPENERS_ZERO = [
  "Ai deschis cutia cu speranță.",
  "Universul a avut o întâlnire urgentă.",
  "Cutia a tușit ușor și a rămas goală.",
  "S-a auzit un greier undeva, departe.",
  "Norocul tău a ieșit la o țigară.",
  "Cutia ți-a zâmbit, apoi te-a refuzat politicos.",
  "Ai câștigat experiența, nu premiul.",
  "Undeva, un contabil a bifat \"predictibil\".",
  "Cutia era, din păcate, la regim.",
  "Ai deschis-o cu ambele mâini, degeaba.",
  "Zarurile universului au căzut pe muchie.",
  "Cutia a preferat să rămână misterioasă până la capăt.",
  "Ai atins fundul sacului — la propriu.",
  "S-a activat modul \"lecție de viață\".",
  "Cutia ți-a oferit doar tăcere.",
  "Norocul a fost, din câte se pare, epuizat stoc.",
];
const CLOSERS_ZERO = [
  "0 puncte, dar experiență infinită.",
  "Măcar ai încercat — asta contează, teoretic.",
  "Universul îți dă o lecție de umilință gratuită.",
  "Poți povesti nepoților cum a fost.",
  "Zero puncte, maximă demnitate.",
  "Ai pierdut, dar ai câștigat un anecdot.",
  "Cel puțin nu ți-a explodat în față.",
  "Ai adus onoare familiei prin participare.",
  "Consolare: n-ai fost singurul azi.",
  "Ține minte ziua asta — pentru motive greșite.",
  "Zero e și el un număr, tehnic vorbind.",
  "Ai bifat \"experiență\" pe CV-ul de jucător.",
  "Poate cutia următoare te iubește mai mult.",
  "Ai demonstrat curaj — rezultatul, mai puțin.",
  "Un moment de reculegere, te rog.",
  "Măcar ai fost consistent cu așteptările.",
];

const OPENERS_LOW = [
  "Cutia a fost avară, dar corectă.",
  "Ai primit un premiu de consolare cu demnitate.",
  "Universul a decis să fie doar puțin generos.",
  "Cutia ți-a dat exact atât cât să nu te superi.",
  "S-a auzit un \"ei, măcar ceva\" colectiv.",
  "Norocul a trecut pe la tine, scurt.",
  "Cutia a decis să nu fie total crudă azi.",
  "Ai primit un semnal slab, dar un semnal.",
  "Cutia a zis \"na, ia și tu ceva\".",
  "Un pic de speranță, servit rece.",
  "Universul a fost generos cu zgârcenia.",
  "Cutia a avut o zi mediocră, la fel ca tine azi.",
  "Ai primit exact cât să nu regreți că ai jucat.",
  "S-a auzit un aplauz timid, de curtoazie.",
  "Cutia a preferat calea de mijloc-mijloc.",
  "Ai luat ceva, nu mult, dar ceva.",
];
const CLOSERS_LOW = [
  "Nu-i mult, dar e onest.",
  "Un premiu discret, ca și tine azi.",
  "Măcar nu-i zero — apreciază micile victorii.",
  "Puncte puține, orgoliu intact.",
  "Ai evitat rușinea totală, felicitări.",
  "E ceva. Tehnic. Din punct de vedere numeric.",
  "Un rezultat pe care-l uiți repede, și bine faci.",
  "Nu strălucești, dar nici nu te stingi.",
  "Puțin, dar sigur — ca o cafea slabă.",
  "Îți ajunge cât să nu te enervezi prea tare.",
  "Un pas mic pentru clasament, un pas mic pentru tine.",
  "Nici erou, nici victimă — doar prezent.",
  "Se numără, chiar dacă abia.",
  "Un rezultat modest, ca o scuză jumătate sinceră.",
  "Ai supraviețuit cu demnitate minimă.",
  "Nu-i festival, dar nici înmormântare.",
];

const OPENERS_MID = [
  "Cutia a decis să fie rezonabilă azi.",
  "Ai nimerit o cutie cu simț practic.",
  "Universul a avut o zi echilibrată, din fericire pentru tine.",
  "Cutia a zis \"hai să fim adulți despre asta\".",
  "S-a auzit un \"ia uite, nu-i rău deloc\".",
  "Norocul a trecut pe la tine cu un rezultat solid.",
  "Cutia a fost generoasă, dar nu exagerat.",
  "Ai primit exact tipul de premiu de care te poți lăuda moderat.",
  "Cutia ți-a oferit un rezultat de care nu te ferești la povestit.",
  "Universul a decis să te trateze ca pe un adult responsabil.",
  "S-a auzit un aplauz onest, nu unul de milă.",
  "Cutia a jucat corect, fără trucuri.",
  "Ai primit un rezultat despre care poți vorbi cu fruntea sus.",
  "Norocul a fost rezonabil, ca o factură pe care o poți plăti.",
  "Cutia a avut încredere în tine, moderat.",
  "Ai luat un premiu solid, fără dramă inutilă.",
];
const CLOSERS_MID = [
  "Un rezultat de care te poți lăuda, moderat.",
  "Solid, onest, fără explicații necesare.",
  "Ai ieșit cu fruntea sus și buzunarul mai plin.",
  "E genul de premiu care nu cere scuze.",
  "Bun rezultat — poți sărbători cu moderație.",
  "Nici mare, nici mic — exact cât trebuie.",
  "Ai câștigat respectul temporar al grupului.",
  "Un premiu pe care-l accepți fără să clipești.",
  "Rezultat de calitate medie-bună, accept total.",
  "Poți să te lauzi discret, fără să exagerezi.",
  "Un pas ferm în direcția corectă.",
  "Ai făcut treabă bună, universul a observat.",
  "Rezultatul e ca o zi de luni surprinzător de OK.",
  "Ai câștigat dreptul la o poză de profil mulțumită.",
  "E genul de victorie care nu cere sărbătoare, dar merită un zâmbet.",
  "Un rezultat care nu strică nimănui seara.",
];

const OPENERS_HIGH = [
  "Cutia a explodat de entuziasm.",
  "Universul a decis că astăzi ești ALES.",
  "S-a auzit un cor de îngeri, la propriu.",
  "Cutia asta a fost creată special pentru momentul ăsta.",
  "Norocul a venit cu toată familia lui azi.",
  "Cutia ți-a zis direct: \"tu meritai asta\".",
  "Universul și-a scos pălăria în fața ta.",
  "S-a auzit un tunet de aprobare cosmică.",
  "Cutia a decis să fie legendă, nu doar cutie.",
  "Ai fost binecuvântat de zeul pronosticurilor.",
  "Norocul a venit cu confetti și tot tacâmul.",
  "Cutia a strălucit ca și cum ar fi știut cine ești.",
  "Universul a bifat \"generozitate maximă\" azi.",
  "S-a auzit direct o fanfară, undeva în cer.",
  "Cutia ți-a oferit tot ce avea, fără reținere.",
  "Ai fost ales dintre muritori pentru asta.",
];
const CLOSERS_HIGH = [
  "Restul, invidiați în tăcere.",
  "Ai fost ales. Restul — doar spectatori.",
  "Legendele se vor scrie despre seara asta.",
  "Poți renunța la job, ai găsit chemarea.",
  "Numele tău va fi șoptit cu respect în grup.",
  "Asta se pune pe CV, la secțiunea \"realizări\".",
  "Statuia ta urmează, discutăm detaliile mai încolo.",
  "Restul jucătorilor pot pleca acasă, s-a decis totul.",
  "Ai atins apogeul — coboară cu grijă.",
  "Ăsta-i motivul pentru care ai continuat să joci.",
  "Uite, ăsta-i sentimentul pentru care merită totul.",
  "Bucură-te — momentele astea nu vin des.",
  "Ai câștigat dreptul la lăudăroșenie nelimitată.",
  "Asta e povestea pe care o spui la fiecare bere.",
  "Universul ți-a validat existența, oficial.",
  "Savurează — mâine redevii om obișnuit.",
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function tierFor(value) {
  if (value === 0) return { openers: OPENERS_ZERO, closers: CLOSERS_ZERO };
  if (value <= 40) return { openers: OPENERS_LOW, closers: CLOSERS_LOW };
  if (value <= 75) return { openers: OPENERS_MID, closers: CLOSERS_MID };
  return { openers: OPENERS_HIGH, closers: CLOSERS_HIGH };
}

// ── Mesaj complet pentru o valoare dată — un opener + un closer, alese
// la întâmplare din nivelul potrivit. Text decorativ, regenerat la
// fiecare afișare (nu se persistă, nu afectează scorul). ──
export function getMysteryBoxMessage(value) {
  const { openers, closers } = tierFor(value);
  return `${pick(openers)} ${pick(closers)}`;
}
