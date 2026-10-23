import { useState } from "react";
import { color, font, radius, shadow } from "../matchdayTheme";
import { PrinceFrogGuide, TreasureGuide, DiceGuide, SabotageGuide, GameFaq, SurprisesOverview, DICE_FAQ, SABOTAGE_FAQ, PRINCE_FAQ } from "../components/RulesGuides";

// Pagină STATICĂ, fără Firestore — doar text + exemple. Conținutul e
// scris simplu, intenționat, ca să fie clar pentru toată gașca, nu doar
// pentru cine a citit codul. Numerele de mai jos sunt sursa de adevăr
// din scoringEngine.js / surprisesService.js — dacă formula se schimbă
// vreodată acolo, ACEST fișier trebuie actualizat manual în paralel (nu
// există o legătură automată, e conținut editorial, nu calcul live).
export default function RulesScreen({ onBack }) {
  return (
    <div style={s.page}>
      <div style={s.wrap}>
        <div style={s.head}>
          <button type="button" onClick={onBack} style={s.backBtn} aria-label="Înapoi">‹</button>
          <div style={s.headTitle}>Reguli · Cum se joacă</div>
        </div>

        <div style={s.introCard}>
          Ghidul complet, pe scurt: cum iei puncte din pronosticuri și cum funcționează
          Surprizele Săptămânii. Apasă pe orice secțiune ca s-o deschizi.
        </div>

        <SectionLabel text="Pronosticuri" />
        <Section icon="⚽" title="Cum faci un pronostic" defaultOpen>
          <P>
            Pentru fiecare meci alegi <B>scorul exact</B>, plus numărul de <B>cartonașe</B> și de
            <B> cornere</B>. Pronosticul se blochează cu <B>30 de minute înainte</B> de ora de
            start a meciului, nu la fluierul de start — după acel moment nu se mai poate schimba.
          </P>
          <P>
            Cartonașele și cornerele vin deja completate implicit cu <B>8 cornere</B> și
            <B> 3 cartonașe</B> — dacă nu le atingi deloc, astea rămân predicția ta la componentele
            respective. Dacă vrei alte valori, le schimbi înainte de blocare.
          </P>
          <P small>
            Contează STRICT primele <B>90 de minute</B> (plus prelungirile regulamentare de
            arbitru, adică minutele adăugate în fiecare repriză) — dacă meciul merge la
            prelungiri de 30 de minute (eliminatorii), orice se întâmplă acolo NU se ia în calcul:
            nici rezultatul, nici cartonașele, nici cornerele.
          </P>
        </Section>

        <Section icon="🎯" title="Punctele pe scor — cu exemple">
          <P>Scorul se punctează pe 4 nivele. Ia doar cel mai bun nivel atins, nu se adună:</P>
          <Table
            rows={[
              ["Scor exact", "120p"],
              ["Rezultat corect + diferența de goluri corectă", "70p"],
              ["Doar rezultatul corect (cine câștigă / egal)", "50p"],
              ["Doar totalul de goluri corect", "20p"],
              ["Nimic din toate astea", "0p"],
            ]}
          />
          <ExampleBox title="Exemplu — meciul se termină 3-2 (gazdele câștigă)">
            <ExRow pred="Ai prezis 3-2" res="Scor exact → 120p" tone="good" />
            <ExRow pred="Ai prezis 2-1" res="Gazdele câștigă la fel, diferența de gol e tot 1 → 70p" tone="good" />
            <ExRow pred="Ai prezis 3-0" res="Gazdele câștigă (corect), dar diferența e 3, nu 1 → 50p" tone="mid" />
            <ExRow pred="Ai prezis 1-4" res="Ai ratat rezultatul, dar 1+4=5 goluri, la fel ca real (3+2=5) → 20p" tone="mid" />
            <ExRow pred="Ai prezis 1-1" res="Nici rezultatul, nici totalul de goluri (2 ≠ 5) nu se potrivesc → 0p" tone="bad" />
          </ExampleBox>

          <P small>
            La egal, cei 70p au o regulă separată — diferența de goluri e mereu 0 la orice egal,
            deci nu contează ca la victorii. Contează în schimb <b>cât de aproape</b> e egalul real
            de cel pronosticat: maximum ±1 gol pentru fiecare echipă.
          </P>
          <ExampleBox title="Exemplu — ai prezis 1-1 (egal)">
            <ExRow pred="Rezultat real 1-1" res="Scor exact → 120p" tone="good" />
            <ExRow pred="Rezultat real 0-0 sau 2-2" res="Egal, la un gol distanță de 1-1 → 70p" tone="good" />
            <ExRow pred="Rezultat real 3-3 sau 4-4" res="Tot egal, dar prea departe de 1-1 (peste 1 gol) → 50p" tone="mid" />
          </ExampleBox>
        </Section>

        <Section icon="🟨" title="Cartonașe și cornere — punctate separat">
          <P>
            Astea sunt <B>bonusuri separate</B> de scor — se calculează după diferența dintre
            ce ai prezis (sau valoarea implicită 8/3, dacă n-ai schimbat-o) și numărul real,
            indiferent dacă ai ghicit scorul sau nu.
          </P>
          <MiniHeading>Cartonașe</MiniHeading>
          <Table rows={[["Exact", "15p"], ["Diferență de 1", "10p"], ["Diferență de 2", "5p"], ["Diferență mai mare", "0p"]]} />
          <P small>
            Un <B>cartonaș roșu direct</B> (fără galben înainte) se numără ca <B>2 cartonașe</B>,
            nu ca 1. Cartonașele primite <B>în afara terenului</B> (bancă tehnică, staff, rezerve)
            NU se numără — doar cele arătate jucătorilor de pe teren.
          </P>
          <MiniHeading>Cornere</MiniHeading>
          <Table rows={[["Exact", "15p"], ["Diferență de 1", "10p"], ["Diferență de 2", "5p"], ["Diferență de 3", "2p"], ["Diferență mai mare", "0p"]]} />
          <ExampleBox title="Exemplu">
            <ExRow pred="Ai prezis 5 cornere" res="Au fost 6 → diferență 1 → 10p" tone="good" />
            <ExRow pred="Ai prezis 3 cartonașe" res="Au fost 3 → exact → 15p" tone="good" />
          </ExampleBox>
          <P small>Punctele de scor + cartonașe + cornere se adună — ăsta e totalul de bază al meciului.</P>
        </Section>

        <Section icon="⭐" title="Meciurile Săptămânii și Jokerul (x2)">
          <P>
            În fiecare etapă există <B>3 Meciuri ale Săptămânii</B>, alese de Admin — toți
            jucătorii care au pronostic pe oricare din ele primesc <B>dublu</B> la punctele lui.
          </P>
          <P>
            Fiecare jucător are și un <B>Joker</B> personal — îl poți pune pe orice alt meci din
            etapă (unul singur, care nu e deja Meci al Săptămânii) ca să-i dublezi punctele ție,
            doar ție.
          </P>
          <P small>
            Nu poți pune Jokerul pe un meci care e deja Meci al Săptămânii — și oricum nu ar avea
            sens, căci multiplicatorul nu se adună (rămâne x2, nu x4).
          </P>
          <ExampleBox title="Exemplu">
            <ExRow pred="Total de bază pe meci: 90p (scor+cartonașe+cornere)" res="Meci al Săptămânii sau Joker → 180p" tone="good" />
          </ExampleBox>
        </Section>

        <Section icon="🏅" title="Bonus de clasament — doar la Finalizarea etapei">
          <P>
            La final de etapă (când Adminul o închide oficial), pe lângă punctele din meciuri se
            adaugă un bonus/penalizare după <B>locul din etapa respectivă</B>:
          </P>
          <Table
            rows={[
              ["Locul 1", "+300p"],
              ["Locul 2", "+150p"],
              ["Locul 3", "+100p"],
              ["Penultimul loc", "−50p"],
              ["Ultimul loc", "−100p"],
            ]}
          />
          <P small>
            Dacă doi jucători sunt la egalitate pe un loc premiat, iau AMÂNDOI bonusul întreg
            (nu se împarte). Acest bonus NU apare live, în timpul etapei — doar un mesaj
            informativ „+Xp dacă etapa s-ar termina acum".
          </P>
        </Section>

        <Section icon="📊" title="Clasamentele — Etapă / Sezon / General">
          <P>
            <B>Etapă</B> = punctele obținute doar în etapa (săptămâna) respectivă: pronosticuri +
            bonusul de poziție + Surprizele Săptămânii, toate adunate.
          </P>
          <P>
            <B>Sezon</B> = clasamentul sezonului curent (un sezon ține de obicei 4 etape, cam o
            lună) — suma etapelor din sezonul respectiv, tot cu bonus de poziție și Surprize
            incluse.
          </P>
          <P>
            <B>General</B> = punctajul total, acumulat pe tot parcursul competiției, din toate
            sezoanele de până acum (inclusiv Speciale).
          </P>
        </Section>

        <SectionLabel text="Surprizele Săptămânii" />
        <Section icon="🎭" title="Cum funcționează, pe scurt">
          <P>
            În fiecare etapă, Adminul poate activa o <B>Surpriză Mare</B> (max 200p) și una
            <B> Surpriză Mică</B> (max 100p) — mini-jocuri separate de pronosticuri, cu propriile puncte.
          </P>
          <P>
            Flux: Admin o <B>dezvăluie</B> (aici afli regulile ei și participanții) → dacă tipul
            cere ceva de la tine, interacționezi → Admin o <B>rezolvă</B> după ce se știu
            rezultatele → punctele intră automat în clasament la Finalizarea etapei.
          </P>
                  <MiniHeading>Toate Surprizele, pe scurt</MiniHeading>
          <SurprisesOverview />
          <GameFaq items={[
            ["Cine alege ce Surpriză apare?", "Adminul alege tipul pentru fiecare etapă și o dezvăluie când e gata. Până atunci nu se vede nimic."],
            ["Când intră punctele în clasament?", "La Finalizarea etapei, împreună cu restul punctelor etapei."],
            ["Pot pierde puncte la o Surpriză?", "Nu. Cel mai puțin e 0p. Singura excepție e Sabotajul, unde un coleg te poate fura."],
            ["Ce înseamnă „Bye”?", "Dacă numărul de jucători e impar, unul rămâne fără adversar și primește o valoare fixă, precizată la fiecare joc."],
            ["Ce se întâmplă dacă nu fac nimic?", "Iei 0 la partea ta din joc. La unele jocuri, adversarul tău poate lua automat bonusul de duel."],
            ["Pot trimite sau schimba după ce s-a închis?", "Nu. Fiecare joc are un moment în care se închide; după el nu mai poți trimite sau modifica."],
          ]} />
        </Section>

        <SectionLabel text="Surprize Mari (max 200p)" />
        <Section icon="🥊" title="Duel 1v1 (Random / Extreme / Rivali)">
          <P>Ești tras la sorți în pereche cu un alt jucător. Câștigă cine ia mai multe puncte din pronosticurile etapei.</P>
          <Table rows={[["Câștigi duelul", "+200p"], ["Egalitate", "+100p fiecare"], ["Pierzi", "+0p"], ["Rămâi fără pereche (nr. impar)", "+100p fix (Bye)"]]} />
          <P small>
            <B>Random</B> = perechi complet aleatorii. <B>Extreme</B> = locul 1 vs ultimul, locul 2
            vs penultimul etc., după clasamentul etapei trecute. <B>Rivali</B> = perechi vecine
            (1 vs 2, 3 vs 4...). Regula de puncte e identică la toate trei.
          </P>
          <GameFaq items={[
            ["Cu ce puncte se compară duelul?", "Cu punctele din pronosticurile etapei (cele 20 de meciuri). Bonusurile de clasament nu intră."],
            ["Pot pierde puncte?", "Nu. Dacă pierzi iei 0p la Surpriză; punctele din pronosticuri rămân ale tale."],
            ["Cine hotărăște perechile?", "Aplicația, la dezvăluire: Random = sorți, Extreme și Rivali = după clasamentul etapei trecute. Le vezi imediat ce Adminul dezvăluie Surpriza."],
            ["Dacă rămân fără pereche?", "Primești +100p fix (Bye)."],
          ]} />
        </Section>

        <Section icon="👥" title="Duel de Echipe">
          <P>Grupul se împarte în echipe de câte 2 (sau 3, dacă nu ies exact perechi), trase la sorți. Câștigă echipa cu suma mai mare de puncte.</P>
          <Table rows={[["Echipa câștigătoare", "+200p / membru"], ["Egalitate", "+100p / membru"], ["Echipa care pierde", "+0p"]]} />
          <P small>La echipele mai mari, un singur membru nu intră în calculul sumei (dar tot ia premiul dacă echipa câștigă) — un detaliu tehnic, nu schimbă strategia ta.</P>
          <GameFaq items={[
            ["Cum se calculează?", "Se adună punctele din etapă ale membrilor echipei. Echipa cu suma mai mare câștigă, iar fiecare membru primește +200p."],
            ["La egalitate?", "+100p fiecare membru."],
            ["Dacă nu ies exact echipe de 2?", "Unele echipe vor avea 3 jucători."],
            ["Dacă un jucător rămâne fără adversar?", "Primește +100p fix (Bye)."],
          ]} />
        </Section>

        <Section icon="🆚" title="Jumate-Jumate (Random / Top vs Bottom)">
          <P>Tot grupul se împarte în 2 tabere egale (±1 persoană). Câștigă tabăra cu suma mai mare de puncte din etapă.</P>
          <Table rows={[["Tabăra câștigătoare", "+200p / membru"], ["Egalitate", "+100p / membru"], ["Tabăra care pierde", "+0p"]]} />
          <P small><B>Random</B> = tabere trase la sorți. <B>Top vs Bottom</B> = jumătatea de sus a clasamentului vs jumătatea de jos, din etapa trecută.</P>
          <GameFaq items={[
            ["Cum se formează taberele?", "Random = sorți. Top vs Bottom = jumătatea de sus a clasamentului etapei trecute contra jumătății de jos."],
            ["Ce se compară?", "Suma punctelor din etapă ale fiecărei tabere. Tabăra cu suma mai mare câștigă, iar fiecare membru primește +200p."],
            ["Dacă numărul de jucători e impar?", "Taberele diferă cu cel mult o persoană."],
          ]} />
        </Section>

        <Section icon="❓" title="Trivia Etapei">
          <P>10 întrebări puse de Admin în timpul etapei (răspunzi A sau B). Fiecare răspuns corect = 15p.</P>
          <Table rows={[["10/10 corecte", "150p bază (maxim)"]]} />
          <P>Pe lângă asta, ești tras la sorți cu un adversar — se compară scorul de bază al vostru:</P>
          <Table rows={[["Câștigi duelul de Trivia", "+50p"], ["Egalitate", "+25p fiecare"], ["Pierzi", "+0p"], ["Bye (fără pereche)", "bază +25p"]]} />
          <P small>Răspunsurile tale sunt private până la Rezolvare — nimeni nu vede ce ai bifat înainte.</P>
          <GameFaq items={[
            ["Pot schimba un răspuns?", "Da, până când Adminul blochează Trivia. După blocare nu se mai poate trimite sau modifica nimic."],
            ["Văd răspunsurile adversarului?", "Nu înainte de blocare. După blocare, Adminul le poate publica, ca să vedeți alegerile; la Rezolvare apar oricum."],
            ["Dacă nu răspund la o întrebare?", "Acea întrebare valorează 0p. Celelalte se punctează normal."],
            ["Care e maximul?", "10 × 15p = 150p din întrebări, plus 50p dacă îți bați adversarul = 200p."],
          ]} />
        </Section>

        <Section icon="🎲" title="Zarurile">
          <DiceGuide />
          <MiniHeading>Detalii exacte</MiniHeading>
          <P>La o întrebare: <B>30p minus 5p</B> pentru fiecare unitate cu care rămâi sub rezultatul real (minim 0p). Dacă l-ai depășit (BUST) iei 0p, dar doar la acea întrebare.</P>
          <Table rows={[
            ["Te-ai oprit exact la rezultatul real", "30p"],
            ["Cu 1 sub rezultatul real", "25p"],
            ["Cu 2 sub", "20p"],
            ["Cu 3 sub", "15p"],
            ["Cu 4 sub", "10p"],
            ["Cu 5 sub", "5p"],
            ["Cu 6 sau mai mult sub", "0p"],
            ["Ai depășit rezultatul real (BUST)", "0p"],
          ]} />
          <ExampleBox title="Exemplu — rezultatul real era 9">
            <ExRow pred="Te-ai oprit la 9" res="Exact → 30p" tone="good" />
            <ExRow pred="Te-ai oprit la 8" res="1 sub → 25p" tone="good" />
            <ExRow pred="Te-ai oprit la 6" res="3 sub → 15p" tone="mid" />
            <ExRow pred="Te-ai oprit la 10" res="Ai depășit (BUST) → 0p" tone="bad" />
          </ExampleBox>
          <Table rows={[["5 întrebări × maxim 30p", "150p bază (maxim)"]]} />
          <P>
            <B>Duelul:</B> pe lângă asta, ești tras la sorți cu un adversar — se compară punctele de
            bază ale voastre (suma celor 5 întrebări):
          </P>
          <Table rows={[["Câștigi duelul", "+50p"], ["Egalitate", "+25p fiecare"], ["Pierzi", "+0p"], ["Bye (fără pereche)", "bază +25p"]]} />
          <P small>
            Poți arunca până când Adminul rezolvă Zarurile. Dacă nu ai apăsat STOP, la Rezolvare se ia
            suma pe care o aveai atunci (iar dacă erai deja peste rezultat, e BUST). Întrebările al căror
            rezultat real nu a fost încă stabilit nu se punctează.
          </P>
        
          <GameFaq items={DICE_FAQ} />
        </Section>

        <Section icon="🗡️" title="Sabotaj">
          <SabotageGuide />
          <MiniHeading>Detalii exacte</MiniHeading>
          <Table rows={[
            ["Ai MAI MULTE puncte decât ținta ta", "Furi min(200p, punctele țintei)"],
            ["Ai puncte egale sau mai puține", "Nu se întâmplă nimic"],
          ]} />
          <ExampleBox title="Exemplu — ținta ta e un coleg">
            <ExRow pred="Tu: 1250p · Ținta: 1100p" res="Furt reușit → tu +200p, ținta −200p" tone="good" />
            <ExRow pred="Tu: 1250p · Ținta: 1250p" res="Egalitate → nu se întâmplă nimic" tone="mid" />
            <ExRow pred="Tu: 1100p · Ținta: 1250p" res="Furt eșuat → nu se întâmplă nimic" tone="bad" />
          </ExampleBox>
          <P small>
            Ce furi se scade de la țintă, deci suma punctelor rămâne aceeași. Ca atacator câștigi cel
            mult 200p, iar dacă ținta are mai puțin de 200p, furi doar cât are — nu o poți duce sub 0p.
            Dacă nimeni nu te-a ales ca țintă, nu pierzi nimic.
          </P>
          <P small>
            Toate confruntările se calculează din ACELAȘI moment: dacă X îl fură pe Y și apoi Z îl fură
            pe X, furtul lui Z nu ține cont de ce a câștigat X de la Y.
          </P>
        
          <GameFaq items={SABOTAGE_FAQ} />
        </Section>

        <Section icon="🎟️" title="Bet Builder">
          <P>
            Jucătorii sunt împărțiți în dueluri 1v1, repartizate pe cele 3 ⭐ Meciuri ale Săptămânii.
            Pentru meciul tău, faci exact 5 selecții — fiecare corectă = +20p.
          </P>
          <Table rows={[["5/5 corecte", "100p din selecții + 50p bonus perfect = 150p"], ["Câștigi duelul", "+50p"], ["Maxim absolut", "200p"]]} />
          <P small>
            Deadline: 12 ore înainte de meciul tău. Dacă duelul e egal după cele 5 selecții,
            decide barajul (cea mai apropiată estimare de un rezultat real); la egalitate perfectă
            la baraj — 25p fiecare.
          </P>
          <GameFaq items={[
            ["Până când trebuie să-mi fac biletul?", "Cu cel puțin 12 ore înainte de meciul repartizat ție."],
            ["Pot schimba biletul?", "Da, până îl confirmi. După confirmare e definitiv."],
            ["Văd biletul adversarului?", "Doar după ce ți l-ai confirmat pe al tău."],
            ["Ce e barajul?", "Dacă duelul e egal după cele 5 selecții, decide cine estimează mai aproape o valoare reală, stabilită de Admin. La egalitate perfectă: +25p fiecare."],
          ]} />
        </Section>

        <Section icon="📈" title="Mai Mare / Mai Mic">
          <P>
            Jucătorii sunt împărțiți în dueluri 1v1, toți pe ACELAȘI panou: 6 runde, câte 2 din fiecare dintre
            cele 3 ⭐ Meciuri ale Săptămânii (un prag de tip X,5 — ex. „9,5 cornere").
          </P>
          <P>
            În fiecare duel, unul dintre voi doi are prioritate pe rundele 1/3/5, celălalt pe
            2/4/6 (stabilit random). Cine are prioritate alege 📈 Mai Mare sau 📉 Mai Mic —
            adversarul primește AUTOMAT varianta opusă. Fiecare ajunge să aleagă efectiv de 3 ori.
          </P>
          <Table rows={[["Fiecare rundă câștigată", "+25p (max 150p din 6 runde)"], ["Câștigi duelul", "+50p"], ["Maxim absolut", "200p"]]} />
          <P small>
            Deadline: 12 ore înainte de primul dintre cele 3 meciuri. La 3–3 după cele 6 runde,
            decide barajul secret (cine estimează mai aproape totalul real de goluri din cele 3
            meciuri); la egalitate perfectă — 25p fiecare.
          </P>
          <GameFaq items={[
            ["Mai mare sau mai mic față de ce?", "Față de pragul afișat la fiecare rundă (de exemplu 9,5 cornere). Rezultatul real se știe abia după meci."],
            ["Pot schimba o alegere?", "Nu. Alegerea e definitivă din momentul în care o trimiți."],
            ["Ce înseamnă „prioritate”?", "Pe rundele în care ai prioritate alegi tu Mai Mare sau Mai Mic, iar adversarul primește automat varianta opusă."],
            ["Până când joc?", "Cu cel puțin 12 ore înainte de primul dintre cele 3 meciuri."],
          ]} />
        </Section>

        <Section icon="👑" title="Prinț sau Broscoi?">
          <PrinceFrogGuide />
          <MiniHeading>Detalii, pentru cine vrea să știe tot</MiniHeading>
          <P small>
            Contează doar punctele din cele 20 de meciuri ale etapei (cu Joker, Meciul Săptămânii și Lupul Singuratic), fără
            bonusurile de clasament și fără alte surprize. Doar jucătorii activi intră în clasamentul acestui joc; un jucător
            activ care n-a pronosticat nimic rămâne în clasament, cu 0 puncte.
          </P>
          <P small>
            Locul se împarte la egalitate (1, 1, 3) și toți cei egali primesc aceeași valoare. Un grup de egalitate care trece
            granița dintre jumătatea de sus și cea de jos nu primește recompensa de 20p.
          </P>
          <P small>
            Dacă adversarul tău n-a ales nimic și tu ai ales: +50p automat. Dacă niciunul nu a ales: 0p. Dacă ești fără adversar
            (număr impar de jucători) și ai ales: +25p.
          </P>
          <P small>
            După închidere, toate alegerile devin publice, iar scorul duelului se actualizează LIVE după fiecare rezultat validat
            de Admin, chiar și la corectări. Punctele devin definitive când Adminul finalizează etapa.
          </P>
          <GameFaq items={PRINCE_FAQ} />
        </Section>

        <SectionLabel text="Surprize Mici (max 100p)" />
        <Section icon="🎰" title="Ruletă (Surpriză Mică)">
          <P>O singură învârtire, cu 16 segmente posibile. Poți învârti a doua oară, dar pierzi definitiv primul rezultat dacă o faci.</P>
          <Table rows={[["0p", "4 din 16 segmente"], ["25p", "5 din 16"], ["50p", "4 din 16"], ["75p", "2 din 16"], ["100p", "1 din 16"]]} />
          <P small>Maxim 100p — e o Surpriză Mică, separată de cea Mare.</P>
          <GameFaq items={[
            ["Pot învârti de două ori?", "Da, dar a doua învârtire anulează definitiv prima. Contează doar ultimul rezultat."],
            ["Pot pierde puncte?", "Nu. Cel mai puțin primești 0p."],
            ["Rezultatul e la întâmplare?", "Da, fiecare segment are șansele din tabelul de mai sus."],
          ]} />
        </Section>

        <Section icon="🎁" title="Mystery Box (Surpriză Mică)">
          <P>40 de cutii, cu valori ascunse până alegi. Alegi o cutie; poți rejuca o dată, dar dacă rejoci, pierzi complet prima alegere — contează doar ultima.</P>
          <Table
            rows={[
              ["5 cutii", "100p"],
              ["8 cutii", "75p"],
              ["9 cutii", "50p"],
              ["4 cutii", "40p"],
              ["3 cutii", "30p"],
              ["3 cutii", "20p"],
              ["6 cutii", "0p"],
              ["2 cutii", "🃏 Joker Extra"],
            ]}
          />
          <P small>
            Cele 2 cutii cu <B>Joker Extra</B> nu dau puncte — îți dau dreptul la un al doilea
            Joker în etapa asta, pe lângă cel normal (dacă rejoci pe o cutie Joker Extra, îl
            pierzi la fel ca orice altă valoare).
          </P>
          <P small>
            🃏 <B>Important despre Joker Extra:</B> nu se aplică instant — nu-ți dublează punctajul
            LIVE în momentul în care îl câștigi. Efectul lui (dublarea punctelor de la meciul unde
            îl folosești) se calculează abia la Finalizarea etapei, o dată cu toate punctele
            Surprizei Săptămânii.
          </P>
          <GameFaq items={[
            ["Pot alege din nou?", "Da, o dată, dar pierzi complet prima alegere. Contează doar ultima."],
            ["Pot pierde puncte?", "Nu. Cel mai puțin primești 0p (6 din 40 de cutii sunt goale)."],
            ["Ce e Joker Extra?", "O cutie fără puncte, care îți dă dreptul la un al doilea Joker în etapa asta. Se aplică abia la Finalizarea etapei."],
          ]} />
        </Section>

        <Section icon="🥅" title="Penalty (Surpriză Mică)">
          <P>Ești tras la sorți cu un adversar. Amândoi alegeți, în secret, 5 zone de șut (stânga/centru/dreapta) și 5 zone de apărare, înainte să vedeți alegerile celuilalt.</P>
          <Table rows={[["Fiecare gol marcat", "+10p"], ["Fiecare apărare reușită", "+10p"], ["Maxim posibil", "100p (5 goluri + 5 apărări)"]]} />
          <ExampleBox title="Exemplu — un șut">
            <ExRow pred="Tu tragi stânga, adversarul apără dreapta" res="Gol → +10p pentru tine" tone="good" />
            <ExRow pred="Tu tragi stânga, adversarul apără stânga" res="Apărat, 0p la lovitura asta" tone="bad" />
          </ExampleBox>
          <P small>Dacă adversarul nu trimite alegerile la timp, iei automat 50p (5 goluri, nimic de apărat), iar el 0p. Dacă niciunul nu trimite: 0p amândoi. Dacă n-ai adversar (număr impar de jucători): 50p fix.</P>
          <GameFaq items={[
            ["Când văd alegerile adversarului?", "Doar după ce amândoi le-ați trimis."],
            ["Pot schimba după ce am trimis?", "Nu. Alegerile sunt definitive."],
            ["Cum se calculează?", "La fiecare dintre cele 5 șuturi: dacă tragi într-o zonă pe care adversarul n-o apără, e gol (+10p). Dacă el trage exact în zona pe care o aperi tu, ai parat (+10p)."],
          ]} />
        </Section>

        <Section icon="🏴‍☠️" title="Comoara Blestemată (Surpriză Mică)">
          <TreasureGuide />
          <MiniHeading>Detaliile, pe ape</MiniHeading>
          <MiniHeading>Apele 1–3 — fără risc</MiniHeading>
          <P small>Exact 3 drumuri, ascund +5p / +10p / +15p. Niciun risc de puncte sau viață.</P>
          <MiniHeading>Apele 4–5</MiniHeading>
          <P small>Exact 4 drumuri, ascund +10p / +20p / −10p / −1 ❤️.</P>
          <MiniHeading>Apele 6–7 — Apele Blestemate</MiniHeading>
          <P small>Exact 4 drumuri — dar acum DOUĂ din patru iau o viață: +10p / +20p / −1 ❤️ / −1 ❤️.</P>
          <P>
            Prima ❤️ pierdută nu-ți ia punctele — poți continua. A DOUA ❤️ pierdută înseamnă
            GAME OVER — scorul final devine 0p, indiferent câte puncte aveai acumulate.
          </P>
          <P>
            După fiecare apă începând cu a 3-a, poți alege 💰 să te oprești (păstrezi punctele) sau
            🏴‍☠️ să continui mai departe, asumându-ți riscul următoarei ape.
          </P>
          <Table rows={[["Supraviețuiești și treci de apa 7", "+25p bonus comoară"], ["Maxim absolut", "100p"]]} />
          <MiniHeading>Regulile aventurii</MiniHeading>
          <P small>O singură încercare, fără restart. Progresul se salvează automat: dacă dai refresh sau închizi aplicația, aventura continuă exact de unde ai rămas, cu aceleași drumuri.</P>
          <P small>Dacă ajungi la 100p înainte de apa 7, aventura se încheie automat: comoara e a ta, fără alt drum și fără cash-out, iar bonusul de +25p nu se mai adaugă peste plafonul de 100p.</P>
          <P small>Dacă Adminul rezolvă Comoara înainte să termini, păstrezi punctele acumulate până atunci (dacă ai rămas fără vieți: 0p).</P>
          <P small>Rezultatele FINALE (după comoară, cash-out sau vieți pierdute) apar în „Clasamentul Piraților”, vizibil tuturor jucătorilor. Progresul în desfășurare și drumurile ascunse rămân private.</P>
          <GameFaq items={[
            ["Pot începe din nou?", "Nu. Ai o singură încercare."],
            ["Dacă închid aplicația?", "Aventura se salvează automat și continui exact de unde ai rămas."],
            ["Văd drumurile altor jucători?", "Nu. Se vede doar rezultatul final al celor care au terminat, în „Clasamentul Piraților”."],
            ["Când mă pot opri?", "După apa 3, 4, 5 sau 6, păstrând punctele de până atunci. Înainte de apa 3 nu te poți opri."],
            ["Dacă pierd ambele vieți?", "Aventura se termină și scorul tău devine 0p."],
            ["Dacă Adminul rezolvă Comoara înainte să termin?", "Păstrezi punctele acumulate până atunci (dacă ai rămas fără vieți: 0p)."],
          ]} />
        </Section>

        <div style={s.footerNote}>
          Ceva neclar? Întreabă-l pe Lu direct în grup — regulile de mai sus sunt actualizate
          cu ultima versiune a aplicației.
        </div>
      </div>
    </div>
  );
}

// ── Componente mici, locale — doar pentru conținutul acestei pagini ──

function SectionLabel({ text }) {
  return <div style={s.sectionLabel}>{text}</div>;
}

function Section({ icon, title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={s.card}>
      <button type="button" onClick={() => setOpen((v) => !v)} style={s.cardHead}>
        <span style={s.cardIcon}>{icon}</span>
        <span style={s.cardTitle}>{title}</span>
        <span style={{ ...s.chevron, transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>⌄</span>
      </button>
      {open && <div style={s.cardBody}>{children}</div>}
    </div>
  );
}

function P({ children, small }) {
  return <p style={small ? s.pSmall : s.p}>{children}</p>;
}

function B({ children }) {
  return <span style={s.bold}>{children}</span>;
}

function MiniHeading({ children }) {
  return <div style={s.miniHeading}>{children}</div>;
}

function Table({ rows }) {
  return (
    <div style={s.table}>
      {rows.map(([label, value], i) => (
        <div key={i} style={s.tableRow}>
          <span style={s.tableLabel}>{label}</span>
          <span style={s.tableValue}>{value}</span>
        </div>
      ))}
    </div>
  );
}

function ExampleBox({ title, children }) {
  return (
    <div style={s.exampleBox}>
      <div style={s.exampleTitle}>{title}</div>
      {children}
    </div>
  );
}

function ExRow({ pred, res, tone }) {
  const tintColor = tone === "good" ? color.green : tone === "bad" ? "#F0555A" : color.goldLight;
  return (
    <div style={s.exRow}>
      <span style={s.exPred}>{pred}</span>
      <span style={{ ...s.exRes, color: tintColor }}>{res}</span>
    </div>
  );
}

const s = {
  page: { minHeight: "100vh", background: color.bgBase, paddingBottom: 40 },
  wrap: { maxWidth: 480, margin: "0 auto", padding: "16px 16px 0" },

  head: { display: "flex", alignItems: "center", gap: 12, marginBottom: 16 },
  backBtn: {
    width: 32, height: 32, borderRadius: "50%", background: color.surfaceElevated, border: `1px solid ${color.border}`,
    color: color.textPrimary, fontSize: 18, cursor: "pointer", flexShrink: 0,
  },
  headTitle: { fontFamily: font.display, fontSize: 19, fontWeight: 700, color: color.textPrimary },

  introCard: {
    background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.lg,
    padding: "14px 16px", marginBottom: 20, fontSize: 12.5, color: color.textSecondary,
    lineHeight: 1.5, fontFamily: font.body,
  },

  sectionLabel: {
    fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase",
    color: color.gold, margin: "22px 2px 10px", fontFamily: font.body,
  },

  card: {
    background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.lg,
    marginBottom: 10, boxShadow: shadow.sm, overflow: "hidden",
  },
  cardHead: {
    display: "flex", alignItems: "center", gap: 10, width: "100%", background: "none", border: "none",
    padding: "13px 14px", cursor: "pointer", textAlign: "left",
  },
  cardIcon: { fontSize: 16, flexShrink: 0 },
  cardTitle: { flex: 1, fontSize: 13.5, fontWeight: 700, color: color.textPrimary, fontFamily: font.body },
  chevron: { fontSize: 14, color: color.textFaint, transition: "transform 160ms ease", flexShrink: 0 },
  cardBody: { padding: "0 14px 16px" },

  p: { fontSize: 12.5, color: color.textSecondary, lineHeight: 1.55, margin: "0 0 10px", fontFamily: font.body },
  pSmall: { fontSize: 11, color: color.textFaint, lineHeight: 1.5, margin: "0 0 10px", fontFamily: font.body },
  bold: { color: color.textPrimary, fontWeight: 700 },

  miniHeading: {
    fontSize: 10.5, fontWeight: 700, color: color.textFaint, textTransform: "uppercase",
    letterSpacing: "0.05em", margin: "10px 0 6px", fontFamily: font.body,
  },

  table: { display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 },
  tableRow: {
    display: "flex", justifyContent: "space-between", gap: 10, background: color.surfaceInset,
    border: `1px solid ${color.borderSubtle}`, borderRadius: radius.sm, padding: "8px 11px",
  },
  tableLabel: { fontSize: 11.5, color: color.textSecondary, fontFamily: font.body, flex: 1 },
  tableValue: { fontSize: 12, fontWeight: 800, color: color.goldLight, fontFamily: font.display, flexShrink: 0, textAlign: "right" },

  exampleBox: {
    background: "rgba(212,175,55,0.06)", border: `1px solid ${color.goldBorder}`, borderRadius: radius.md,
    padding: "11px 12px", marginBottom: 10,
  },
  exampleTitle: { fontSize: 10.5, fontWeight: 700, color: color.goldLight, marginBottom: 8, fontFamily: font.body },
  exRow: { display: "flex", flexDirection: "column", gap: 1, marginBottom: 7 },
  exPred: { fontSize: 11.5, color: color.textPrimary, fontFamily: font.body, fontWeight: 600 },
  exRes: { fontSize: 11, fontFamily: font.body },

  footerNote: {
    fontSize: 11, color: color.textFaint, textAlign: "center", lineHeight: 1.5,
    padding: "18px 12px 6px", fontFamily: font.body,
  },
};
