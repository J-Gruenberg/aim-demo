import { RechtsSeite } from '@/components/RechtsSeite';

export const metadata = { title: 'Impressum' };

export default function Impressum() {
  return (
    <RechtsSeite titel="Impressum">
      <section>
        <h2 className="font-semibold">Anbieter dieser Anwendung</h2>
        <p>
          Grünberg Solutions GmbH<br />
          (toolwerk, eine Marke der Grünberg Solutions GmbH)<br />
          Großer Markt 16<br />
          19348 Perleberg
        </p>
      </section>
      <section>
        <h2 className="font-semibold">Vertreten durch</h2>
        <p>Jonas Grünberg, Geschäftsführer</p>
      </section>
      <section>
        <h2 className="font-semibold">Kontakt</h2>
        <p>Telefon: +49 152 55604258<br />E-Mail: kontakt@gruenbergsolutions.de</p>
      </section>
      <section>
        <h2 className="font-semibold">Registereintrag</h2>
        <p>Registergericht: Amtsgericht Neuruppin<br />Registernummer: HRB 14971</p>
      </section>
      <section>
        <h2 className="font-semibold">Umsatzsteuer-Identifikationsnummer</h2>
        <p>DE452419786</p>
      </section>
      <section>
        <h2 className="font-semibold">Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
        <p>Jonas Grünberg, Großer Markt 16, 19348 Perleberg</p>
      </section>
      <section>
        <h2 className="font-semibold">Hinweis zur Anwendung</h2>
        <p>
          Diese AIM-Instanz ist eine Vorführ- und Testumgebung von toolwerk, einer Marke der Grünberg Solutions GmbH. Der Beispielbetrieb und seine Werte sind ausgedacht. Der Zugang ist ausschließlich eingeladenen Nutzern vorbehalten. Kalkulationen, Preise und Angebote, die mit der Anwendung erstellt werden, verantwortet der jeweilige Nutzer.
        </p>
      </section>
    </RechtsSeite>
  );
}
