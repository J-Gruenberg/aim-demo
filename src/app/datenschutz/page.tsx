import { RechtsSeite } from '@/components/RechtsSeite';
import { kiBetrieb } from '@/lib/ki';

export const metadata = { title: 'Datenschutz' };
// Der Abschnitt zur KI richtet sich nach der tatsächlich genutzten Verbindung
export const dynamic = 'force-dynamic';

export default function Datenschutz() {
  const eu = kiBetrieb() === 'eu';
  return (
    <RechtsSeite titel="Datenschutzhinweise">
      <p className="text-grau text-sm">Stand: Oktober 2026</p>
      <section>
        <h2 className="font-semibold">1. Wer ist verantwortlich?</h2>
        <p>
          Diese AIM-Instanz ist eine Vorführ- und Testumgebung. Verantwortlich ist die Grünberg Solutions GmbH (toolwerk), Großer Markt 16, 19348 Perleberg. In Kundeninstanzen ist der jeweilige Betrieb verantwortlich, toolwerk betreibt die Anwendung dann als Auftragsverarbeiter nach Art. 28 DSGVO.
        </p>
      </section>
      <section>
        <h2 className="font-semibold">2. Welche Daten verarbeiten wir?</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Nutzerkonto: Name, E-Mail-Adresse, Rolle und ein verschlüsselt gespeichertes Passwort.</li>
          <li>Technische Protokolldaten beim Aufruf der Anwendung: IP-Adresse, Zeitpunkt, aufgerufene Adresse, Browserangaben. Sie dienen dem sicheren Betrieb und werden kurzfristig gelöscht.</li>
          <li>Inhalte: Kalkulationen, Stammdaten, Referenzprojekte und hochgeladene Unterlagen wie Leistungsverzeichnisse und Pläne. Diese können Namen und Kontaktdaten von Ansprechpartnern enthalten.</li>
          <li>Änderungsprotokoll: Wer hat wann welchen Wert geändert. Das dient der Nachvollziehbarkeit der Kalkulation.</li>
        </ul>
      </section>
      <section>
        <h2 className="font-semibold">3. Zwecke und Rechtsgrundlagen</h2>
        <p>
          Wir verarbeiten die Daten, um die Anwendung bereitzustellen und die vereinbarten Leistungen zu erbringen (Art. 6 Abs. 1 lit. b DSGVO) sowie zur Gewährleistung von Sicherheit und Stabilität (Art. 6 Abs. 1 lit. f DSGVO).
        </p>
      </section>
      <section>
        <h2 className="font-semibold">4. Cookies</h2>
        <p>
          AIM setzt ausschließlich technisch notwendige Cookies, die Ihre Anmeldung aufrechterhalten (§ 25 Abs. 2 Nr. 2 TDDDG). Es gibt keine Analyse-, Tracking- oder Werbe-Cookies und keine Einbindung von Social-Media-Diensten.
        </p>
      </section>
      <section>
        <h2 className="font-semibold">5. Wo liegen die Daten?</h2>
        <p>
          Datenbank und Dateiablage liegen in Rechenzentren in Frankfurt am Main. Die Anwendung wird über Server in Frankfurt am Main ausgeliefert. Daten werden bei der Übertragung und im gespeicherten Zustand verschlüsselt. Die Daten dieses Betriebs liegen in einer eigenen, von anderen Kunden getrennten Datenbank.
        </p>
      </section>
      <section>
        <h2 className="font-semibold">6. Auswertung durch Künstliche Intelligenz</h2>
        {eu ? (
          <>
            <p>
              Wenn Sie Leistungsverzeichnisse, Pläne oder Anfragen auswerten lassen, werden die dafür nötigen Inhalte zur Auswertung an eine KI-Plattform in der Europäischen Union übermittelt. Die Anfrage geht von Frankfurt am Main aus und wird ausschließlich in Rechenzentren innerhalb der EU verarbeitet.
            </p>
            <p>
              Die Plattform ist auf Null-Speicherung eingestellt: Eingaben und Ergebnisse werden dort nicht gespeichert, nicht protokolliert und nicht zum Training von KI-Modellen verwendet. Der Hersteller des Sprachmodells hat keinen Zugriff auf Ihre Inhalte. Die Anwendung prüft diese Einstellung vor jeder Auswertung selbst und sendet keine Inhalte, solange die Null-Speicherung nicht bestätigt ist. Gespeichert wird das Ergebnis nur in Ihrer eigenen Datenbank in Frankfurt.
            </p>
          </>
        ) : (
          <>
            <p>
              Wenn Sie Leistungsverzeichnisse, Pläne oder Anfragen auswerten lassen, werden die dafür nötigen Inhalte verschlüsselt an einen KI-Dienst übermittelt. Im aktuellen Testbetrieb erfolgt die Auswertung übergangsweise direkt beim Anbieter des Sprachmodells in den USA. Die Übermittlung ist über die EU-Standardvertragsklauseln abgesichert (Art. 46 DSGVO).
            </p>
            <p>
              Eingaben und Ergebnisse werden vom Anbieter nicht zum Training von KI-Modellen verwendet. Gespeichert wird das Ergebnis in Ihrer eigenen Datenbank in Frankfurt. Nach dem Testbetrieb wird die Auswertung auf Rechenzentren in der Europäischen Union mit Null-Speicherung umgestellt. Diese Hinweise werden dann entsprechend angepasst.
            </p>
          </>
        )}
        <p>
          Die KI liefert ausschließlich Vorschläge. Vorschläge sind in der Anwendung als solche gekennzeichnet und werden erst durch Ihre Freigabe übernommen. Es finden keine automatisierten Entscheidungen im Sinne von Art. 22 DSGVO statt.
        </p>
      </section>
      <section>
        <h2 className="font-semibold">7. Empfänger</h2>
        <p>
          Wir setzen sorgfältig ausgewählte Dienstleister für Hosting, Datenbank und KI-Auswertung ein, die als Unterauftragsverarbeiter vertraglich gebunden sind. {eu ? 'Ihre Inhalte werden ausschließlich in der EU gespeichert und verarbeitet.' : 'Ihre Inhalte werden in der EU gespeichert. Für die KI-Auswertung im Testbetrieb gilt Abschnitt 6.'} Soweit ein Dienstleister zu einer Unternehmensgruppe mit Sitz außerhalb der EU gehört, sind zusätzlich geeignete Garantien nach Art. 44 ff. DSGVO vereinbart, insbesondere die EU-Standardvertragsklauseln. Die vollständige Liste der Unterauftragsverarbeiter mit Anschrift und Ort der Verarbeitung erhalten Sie von uns jederzeit auf Anfrage.
        </p>
      </section>
      <section>
        <h2 className="font-semibold">8. Speicherdauer</h2>
        <p>
          Inhalte werden gespeichert, solange der Vertrag besteht oder bis sie gelöscht werden. Nach Vertragsende werden sie nach Herausgabe gelöscht. Ein vollständiger Export aller Daten ist jederzeit unter „Konto und Datenexport“ möglich.
        </p>
      </section>
      <section>
        <h2 className="font-semibold">9. Ihre Rechte</h2>
        <p>
          Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch (Art. 15 bis 21 DSGVO) sowie das Recht, sich bei einer Datenschutzaufsichtsbehörde zu beschweren. Wenden Sie sich dazu an uns: kontakt@gruenbergsolutions.de.
        </p>
      </section>
    </RechtsSeite>
  );
}
