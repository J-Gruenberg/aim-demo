export const metadata = { title: 'Hilfe' };

const SCHRITTE = [
  ['Nach Zeichnung', '„+ Nach Zeichnung“, Werkstattzeichnungen hineinziehen, „Alle lesen und kalkulieren“. Jede Position zeigt Stückliste, Arbeitsgänge und den Rechenweg über Ihre Kostenstellen.'],
  ['Ausschreibung', '„+ Ausschreibung“, LV als PDF oder GAEB hineinziehen, „Positionen lesen“, „Offene kalkulieren“, prüfen und freigeben.'],
  ['Halle', '„+ Halle“, Maße und Ausführung links eingeben, Vordruck rechts prüfen, „Angebot ansehen“.'],
  ['Treppe und Geländer', '„+ Treppe / Geländer“, dann „+ Geländer“ oder „+ Treppe“ und die Werte rechts anpassen.'],
  ['Stammdaten', 'Kostenstellen, Zuschläge und Zeitwerte anpassen: Wert anklicken, neue Zahl, Enter. Danach in der Kalkulation „Neu rechnen“.'],
  ['Briefkopf', 'Unter „Betrieb“ Name und Anschrift eintragen. Jedes Angebot kommt dann auf diesem Briefkopf raus.'],
];

const BEISPIELE = [
  ['Beispiel_BSP-101_Stuetze_S1.pdf', 'Stütze HEB 200 mit Fuß- und Kopfplatte, 4 Stück, feuerverzinkt'],
  ['Beispiel_BSP-102_Traeger_T1.pdf', 'Träger IPE 300 mit Stirnplatten, 3 Stück, beschichtet'],
  ['Beispiel_BSP-103_Konsole_K1.pdf', 'Wandkonsole HEA 160 mit Ankerplatte, 6 Stück, feuerverzinkt'],
];

export default function HilfeSeite() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight">Hilfe</h1>
        <p className="text-grau text-sm mt-1">So arbeiten Sie mit AIM. Zum Ausprobieren liegen unten drei Beispielzeichnungen bereit.</p>
      </div>
      <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">
        <section className="karte p-5">
          <h2 className="font-semibold text-sm mb-3">Kurz und knapp</h2>
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
            <h2 className="font-semibold text-sm">Beispielzeichnungen</h2>
            <p className="text-[13px] text-grau">Ausgedachte Werkstattzeichnungen mit Stückliste. Herunterladen und unter „Nach Zeichnung“ wieder ablegen.</p>
            <ul className="space-y-2">
              {BEISPIELE.map(([datei, text]) => (
                <li key={datei}>
                  <a href={`/beispiele/${datei}`} download className="block rounded-lg border border-linie px-3 py-2 hover:border-tiefblau">
                    <div className="text-[13px] font-medium">{datei.replace('Beispiel_', '').replace('.pdf', '').replace(/_/g, ' ')}</div>
                    <div className="text-[12px] text-grau">{text}</div>
                  </a>
                </li>
              ))}
            </ul>
          </section>
          <section className="karte p-4 text-[13px]">
            <h2 className="font-semibold text-sm mb-1">Fragen?</h2>
            <p className="text-grau">Jonas Grünberg · <a className="underline" href="tel:+4915255604258">0152 55604258</a> · <a className="underline" href="mailto:kontakt@gruenbergsolutions.de">kontakt@gruenbergsolutions.de</a></p>
          </section>
        </aside>
      </div>
    </div>
  );
}
