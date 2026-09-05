import { useState } from "react";
import { color, font, radius, shadow } from "../matchdayTheme";

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
            În fiecare etapă, Adminul poate activa o <B>Surpriză Principală</B> (max 200p) și una
            <B> Bonus</B> (max 100p) — mini-jocuri separate de pronosticuri, cu propriile puncte.
          </P>
          <P>
            Flux: Admin o <B>dezvăluie</B> (aici afli regulile ei și participanții) → dacă tipul
            cere ceva de la tine, interacționezi → Admin o <B>rezolvă</B> după ce se știu
            rezultatele → punctele intră automat în clasament la Finalizarea etapei.
          </P>
        </Section>

        <Section icon="🥊" title="Duel 1v1 (Random / Extreme / Rivali)">
          <P>Ești tras la sorți în pereche cu un alt jucător. Câștigă cine ia mai multe puncte din pronosticurile etapei.</P>
          <Table rows={[["Câștigi duelul", "+200p"], ["Egalitate", "+100p fiecare"], ["Pierzi", "+0p"], ["Rămâi fără pereche (nr. impar)", "+100p fix (Bye)"]]} />
          <P small>
            <B>Random</B> = perechi complet aleatorii. <B>Extreme</B> = locul 1 vs ultimul, locul 2
            vs penultimul etc., după clasamentul etapei trecute. <B>Rivali</B> = perechi vecine
            (1 vs 2, 3 vs 4...). Regula de puncte e identică la toate trei.
          </P>
        </Section>

        <Section icon="👥" title="Duel de Echipe">
          <P>Grupul se împarte în echipe de câte 2 (sau 3, dacă nu ies exact perechi), trase la sorți. Câștigă echipa cu suma mai mare de puncte.</P>
          <Table rows={[["Echipa câștigătoare", "+200p / membru"], ["Egalitate", "+100p / membru"], ["Echipa care pierde", "+0p"]]} />
          <P small>La echipele mai mari, un singur membru nu intră în calculul sumei (dar tot ia premiul dacă echipa câștigă) — un detaliu tehnic, nu schimbă strategia ta.</P>
        </Section>

        <Section icon="🆚" title="Jumate-Jumate (Random / Top vs Bottom)">
          <P>Tot grupul se împarte în 2 tabere egale (±1 persoană). Câștigă tabăra cu suma mai mare de puncte din etapă.</P>
          <Table rows={[["Tabăra câștigătoare", "+200p / membru"], ["Egalitate", "+100p / membru"], ["Tabăra care pierde", "+0p"]]} />
          <P small><B>Random</B> = tabere trase la sorți. <B>Top vs Bottom</B> = jumătatea de sus a clasamentului vs jumătatea de jos, din etapa trecută.</P>
        </Section>

        <Section icon="❓" title="Trivia Etapei">
          <P>10 întrebări puse de Admin în timpul etapei (răspunzi A sau B). Fiecare răspuns corect = 15p.</P>
          <Table rows={[["10/10 corecte", "150p bază (maxim)"]]} />
          <P>Pe lângă asta, ești tras la sorți cu un adversar — se compară scorul de bază al vostru:</P>
          <Table rows={[["Câștigi duelul de Trivia", "+50p"], ["Egalitate", "+25p fiecare"], ["Pierzi", "+0p"], ["Bye (fără pereche)", "bază +25p"]]} />
          <P small>Răspunsurile tale sunt private până la Rezolvare — nimeni nu vede ce ai bifat înainte.</P>
        </Section>

        <Section icon="🎲" title="Zarurile">
          <P>
            5 întrebări numerice (ex: „câte cornere?"). Pentru fiecare, arunci zarul de câte ori
            vrei, adunând — tu alegi când te oprești. Dacă treci de rezultatul real, iei 0 la acea
            întrebare (BUST).
          </P>
          <P><B>Formula:</B> 30 − 5 × (cât de departe ești de rezultatul real), minim 0.</P>
          <ExampleBox title="Exemplu — la o întrebare">
            <ExRow pred="Rezultatul real era 6, tu ai oprit la 6" res="Exact → 30p" tone="good" />
            <ExRow pred="Rezultatul real era 6, tu ai oprit la 4" res="Diferență 2 → 30−10 = 20p" tone="mid" />
            <ExRow pred="Rezultatul real era 6, tu ai oprit la 9" res="Ai depășit (BUST) → 0p" tone="bad" />
          </ExampleBox>
          <Table rows={[["5/5 perfect", "150p bază (maxim)"]]} />
          <P small>Plus același bonus de duel ca la Trivia: +50p / +25p egalitate / +0p pierdere / bază+25p Bye.</P>
        </Section>

        <Section icon="🎰" title="Ruletă (Surpriza Bonus)">
          <P>O singură învârtire, cu 16 segmente posibile. Poți învârti a doua oară, dar pierzi definitiv primul rezultat dacă o faci.</P>
          <Table rows={[["Segmente posibile", "0, 25 sau 50 (cele mai dese) · 75 (mai rar) · 100 (cel mai rar)"]]} />
          <P small>Maxim 100p — e Surpriza Bonus, separată de cea Principală.</P>
        </Section>

        <Section icon="🎁" title="Mystery Box (Surpriza Bonus)">
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
        </Section>

        <Section icon="🥅" title="Penalty (Surpriza Bonus)">
          <P>Ești tras la sorți cu un adversar. Amândoi alegeți, în secret, 5 zone de șut (stânga/centru/dreapta) și 5 zone de apărare, înainte să vedeți alegerile celuilalt.</P>
          <Table rows={[["Fiecare gol marcat", "+10p"], ["Fiecare apărare reușită", "+10p"], ["Maxim posibil", "100p (5 goluri + 5 apărări)"]]} />
          <ExampleBox title="Exemplu — un șut">
            <ExRow pred="Tu tragi stânga, adversarul apără dreapta" res="Gol → +10p pentru tine" tone="good" />
            <ExRow pred="Tu tragi stânga, adversarul apără stânga" res="Apărat, 0p la lovitura asta" tone="bad" />
          </ExampleBox>
          <P small>Dacă adversarul nu trimite alegerile la timp, iei automat 50p (5 goluri, nimic de apărat), iar el 0p.</P>
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
