export const metadata = { title: 'Hilfe' };

const SCHRITTE = [
  ['Nach Zeichnung', '„Neue Kalkulation“, dann „Nach Zeichnung“. Werkstattzeichnungen hineinziehen, AIM liest und kalkuliert von selbst. Jede Position zeigt Stückliste, Arbeitsgänge und den Rechenweg über Ihre Kostenstellen.'],
  ['Ausschreibung', '„Neue Kalkulation“, dann „Ausschreibung“. LV als GAEB oder PDF, gern mit Plänen, alles auf einmal hineinziehen. AIM liest und kalkuliert von selbst, Sie prüfen und geben frei.'],
  ['Halle', '„Neue Kalkulation“, dann „Hallenbau“. Maße und Ausführung links eingeben, Vordruck rechts prüfen, „Angebot ansehen“.'],
  ['Treppe und Geländer', '„Neue Kalkulation“, dann „Treppe, Geländer, Stahlbau“. Bauteil hinzufügen und die Werte anpassen.'],
  ['Stammdaten', 'Kostenstellen, Zuschläge und Zeitwerte anpassen: Wert anklicken, neue Zahl, Enter. Danach in der Kalkulation „Neu rechnen“.'],
  ['Briefkopf', 'Unter „Betrieb“ Name und Anschrift eintragen. Jedes Angebot kommt dann auf diesem Briefkopf raus.'],
];

const BEISPIELE: { gruppe: string; text: string; dateien: [string, string][] }[] = [
  {
    gruppe: 'Nach Zeichnung',
    text: 'Unter „Nach Zeichnung“ ablegen.',
    dateien: [
      ['zeichnung/Stahltreppe_ST-01.pdf', 'Stahltreppe mit Podest, Zusammenbau, 19 Stücklistenpositionen, 660 kg'],
      ['zeichnung/Lagerbuehne_LB-01_Satz.pdf', 'Lagerbühne als Zeichnungssatz, 5 Blätter, eine Unterzeichnung fehlt absichtlich'],
    ],
  },
  {
    gruppe: 'Ausschreibung',
    text: 'Alle vier Dateien zusammen unter „Ausschreibung“ ablegen.',
    dateien: [
      ['ausschreibung/LV_Los12_Stahlbau_Schlosser.X83', 'LV als GAEB-Datei, 39 Positionen'],
      ['ausschreibung/LV_Los12_Stahlbau_Schlosser.pdf', 'LV als PDF mit Vorbemerkungen'],
      ['ausschreibung/Plan_TW-01_Treppe_Gelaender.pdf', 'Plan Treppe und Geländer'],
      ['ausschreibung/Plan_TW-02_Vordach_Details.pdf', 'Plan Vordach und Details'],
    ],
  },
];

export default function HilfeSeite() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-ink-950">Hilfe</h1>
        <p className="text-grau text-sm mt-1">So arbeiten Sie mit AIM. Zum Ausprobieren liegen rechts Beispielunterlagen bereit, alle frei erfunden.</p>
      </div>
      <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">
        <section className="karte p-5">
          <h2 className="text-[16px] font-bold text-ink-950 mb-3">Kurz und knapp</h2>
          <ol className="space-y-3">
            {SCHRITTE.map(([t, x], i) => (
              <li key={t} className="flex gap-3 text-[13px]">
                <span className="shrink-0 w-6 h-6 rounded-full bg-tiefblau text-white text-[11px] font-semibold inline-flex items-center justify-center">{i + 1}</span>
                <span><b className="font-medium">{t}:</b> <span className="text-grau">{x}</span></span>
              </li>
            ))}
          </ol>
        </section>
        <aside className="space-y-4">
          <section className="karte p-4 space-y-3">
            <h2 className="text-[16px] font-bold text-ink-950">Beispielunterlagen</h2>
            <p className="text-[13px] text-grau">Ausgedachte Zeichnungen und eine ausgedachte Ausschreibung zum Ausprobieren. Herunterladen und wieder ablegen.</p>
            {BEISPIELE.map((g) => (
              <div key={g.gruppe} className="space-y-2">
                <p className="pt-1 text-[13px] font-bold text-ink-950">{g.gruppe} <span className="font-normal text-grau">· {g.text}</span></p>
                <ul className="space-y-2">
                  {g.dateien.map(([datei, text]) => (
                    <li key={datei}>
                      <a href={`/beispiele/${datei}`} download className="block rounded-xl border border-linie px-3 py-2 hover:border-tiefblau">
                        <div className="text-[13px] font-medium">{datei.split('/').pop()}</div>
                        <div className="text-[12px] text-grau">{text}</div>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
          <section className="karte p-4 text-[13px]">
            <h2 className="text-[16px] font-bold text-ink-950 mb-1">Fragen?</h2>
            <p className="text-grau">Jonas Grünberg · <a className="underline" href="tel:+4915255604258">0152 55604258</a> · <a className="underline" href="mailto:kontakt@gruenbergsolutions.de">kontakt@gruenbergsolutions.de</a></p>
          </section>
        </aside>
      </div>
    </div>
  );
}
