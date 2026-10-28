/**
 * Baubeschreibung für Hallenangebote im üblichen Wortlaut eines Stahl- und Hallenbauers.
 * Abschnitte erscheinen nur, wenn die Leistung in der Kalkulation aktiv ist.
 */
import type { HallenEingaben, HallenErgebnis } from '../engine/halle';

export type Abschnitt = { titel: string; absaetze: string[] };

const z = (v: number, s = 2) => new Intl.NumberFormat('de-DE', { minimumFractionDigits: s, maximumFractionDigits: s }).format(v);
const z0 = (v: number) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(v);

export function baubeschreibung(e: HallenEingaben, erg: HallenErgebnis): Abschnitt[] {
  const aktiv = (key: string) => erg.zeilen.some((x) => x.key === key && x.aktiv);
  const tore = e.tore.filter((t) => t.anzahl > 0);
  const out: Abschnitt[] = [];

  out.push({
    titel: 'Vorbemerkungen',
    absaetze: [
      aktiv('erdarbeiten')
        ? 'Es liegt kein Bodengutachten vor, so dass wir von einem ebenen Baufeld, 30 cm Mutterbodenabtrag und einer normalen Bodenklasse 3–4 ausgegangen sind. Sollten sich beim Bodengutachten andere Bodenwerte ergeben, muss nachkalkuliert werden.'
        : 'Die Fundamente und die Bodenplatte werden bauseits nach unseren Ankerplänen hergestellt.',
      'Prüf- und Genehmigungsgebühren für die Behörden und den Prüfstatiker entrichtet der Auftraggeber.',
    ],
  });

  if (aktiv('be')) {
    out.push({
      titel: 'Baustelleneinrichtung',
      absaetze: ['Baustellen-Sanitäreinrichtung, alle erforderlichen Maschinen, Geräte und Gerüste sowie sicherheitstechnische Einrichtungen stellen und vorhalten. Strom und Wasser kommen bauseits.'],
    });
  }

  if (aktiv('erdarbeiten')) {
    out.push({
      titel: 'Erdarbeiten',
      absaetze: [
        '30 cm Oberboden im Bereich des Baufeldes abschieben und entsorgen, Streifenfundamente und Einzelfundamente ausschachten, Boden abfahren, Schottertragschicht einbauen, Feinplanum der Oberfläche herstellen.',
      ],
    });
    out.push({
      titel: 'Betonarbeiten',
      absaetze: [
        'Streifen- und Einzelfundamente zur Aufnahme der Hallenkonstruktion gemäß Statik und den einschlägigen Vorschriften liefern und einbauen, einschließlich Sauberkeitsschicht, Bewehrungsstahl liefern, schneiden, biegen und verlegen.',
        'PE-Folie mit Überlappung unter der Hallensohle vollflächig liefern und einbauen. Fundamenterder aus verzinktem Flachstahl liefern und einbauen, einschließlich der Anschlussfahnen.',
        'Stahlbetonsohle d = 18 cm auf 3 cm Sauberkeitsschicht herstellen, Oberfläche geglättet mit Korundeinstreu, inklusive der erforderlichen 2 Lagen Bewehrung Q188. Vorab-Lieferung der Ankerbolzen, Einmessen und Setzen der Ankerbolzen. Abdecken der Sohle nach dem Betonieren mit Folie gegen Austrocknen, Fugen gemäß Vorschriften einbringen.',
      ],
    });
  }

  out.push({
    titel: 'Halle',
    absaetze: [
      `Maße: ${z(e.laenge)} m × ${z(e.breite)} m × ${z(e.traufhoehe)} m Traufhöhe`,
      `Grundfläche ${z0(erg.geometrie.grundflaeche)} m², Spannbreite ${z(e.breite)} m, Länge ${z(e.laenge)} m, Rahmenabstände ${z(e.laenge / erg.geometrie.felder)} m, Traufhöhe ${z(e.traufhoehe)} m, Dachneigung ca. ${z0(e.neigung)}°, Dachausbildung als ${e.dachform === 'satteldach' ? 'Satteldach' : 'Pultdach'}.`,
    ],
  });

  out.push({ titel: 'Lasten', absaetze: ['Bemessungsgrundlage ist die Statik.'] });

  out.push({
    titel: 'Tragkonstruktion',
    absaetze: [
      `Primärkonstruktion: Stützen und Binder, die beiden Giebel werden als Giebelwandkonstruktion ausgeführt. Stahlqualität nach EN 10025: S 235, Oberfläche ${e.oberflaeche === 'verzinkt' ? 'feuerverzinkt' : 'grundiert'}.`,
      'Sekundärkonstruktion: Wandriegel und Dachpfetten als L-, C- oder Z-Profile, kaltverformt aus verzinktem Stahl S 350 GD + Z 275 nach EN 10147.',
      ...(e.kran ? ['Die Konstruktion wird für eine Kranbahn mit Konsolen ausgelegt.'] : []),
    ],
  });

  out.push({
    titel: 'Dacheindeckung',
    absaetze: [
      e.dach === 'sandwich'
        ? 'Die Dacheindeckung erfolgt mit Sandwichpaneelen DL 120 der Fa. Fischerprofil oder gleichwertig, Farbe gemäß Lieferantenfarbkarte.'
        : 'Die Dacheindeckung erfolgt mit Trapezblech mit Kondensvlies auf der Unterseite, Farbe gemäß Lieferantenfarbkarte.',
    ],
  });

  if (e.wand !== 'ohne') {
    out.push({
      titel: 'Wandsystem Halle',
      absaetze: [
        e.wand === 'sandwich'
          ? 'Fußpunkt der Bleche auf ca. −50 mm, senkrecht verlegte Sandwichpaneele Fischerprofil LL 100, Oberflächenvergütung durch innen Kunststoffbeschichtung ähnlich RAL 9002, außen 25 µm Polyester-Beschichtung gemäß Farbkarte des Lieferanten. Verschraubung erfolgt sichtbar, einschließlich aller Kantteile.'
          : 'Unterkonstruktion aus horizontalen Wandriegeln, Trapezblech liefern und montieren, Kantteile als unteren und oberen Abschluss, einschließlich aller Kantteile.',
        ...(e.wandseiten < 4 ? [`Verkleidung ${e.wandseiten}-seitig.`] : []),
      ],
    });
  }

  out.push({
    titel: 'Dachentwässerung',
    absaetze: ['Außenliegende, halbrunde Dachrinne aus Zink, einschließlich der Dehner und der Fallrohre.'],
  });

  out.push({
    titel: 'Zubehör',
    absaetze: [
      'Ausrahmungen: Fenster- und Torausrahmungen für das unten aufgeführte Hallenzubehör als bandverzinkte C-Profile, dazugehörige Einfasskantteile aus verzinktem, kunststoffbeschichtetem Blech im Standard-Farbton gemäß Farbtafel.',
      'Fracht: Transportkosten der oben beschriebenen Halle frei Baustelle.',
      ...(aktiv('autokran') ? ['Kran: Krankosten zum Entladen der LKW bzw. Richten der Halle.'] : []),
      'Montage: Montagekosten der oben beschriebenen Halle in fix und fertiger Arbeit einschließlich der Montagenebenkosten wie Netze (Absturzsicherung), Montagehilfen wie Steiger, Gerüste usw.',
    ],
  });

  const oeffnungen: string[] = [];
  for (const t of tore) {
    oeffnungen.push(
      `${t.anzahl} Stck. Sektionaltor${t.anzahl > 1 ? 'e' : ''} liefern und montieren, Größe ${Math.round(t.breite * 1000)} × ${Math.round(t.hoehe * 1000)} mm, ${t.antrieb ? 'mit elektrischem Antrieb' : 'Bedienung mittels Handkettenzug'}, jedes Tor erhält 1 Stck. Lichtleiste.`,
    );
  }
  if (e.tueren > 0) oeffnungen.push(`${e.tueren} Stck. 1-flügelige Stahlblechtür${e.tueren > 1 ? 'en' : ''}, Größe 1000 × 2125 mm.`);
  if (e.fenster > 0) oeffnungen.push(`${e.fenster} Stck. Fenster aus Kunststoff liefern und montieren, außen und innen weiß.`);
  if (e.lichtkuppeln > 0) oeffnungen.push(`${e.lichtkuppeln} Stck. Lichtkuppeln 1000 × 1000 mm.`);
  if (e.lichtkuppeln_rwa > 0) oeffnungen.push(`${e.lichtkuppeln_rwa} Stck. Lichtkuppeln 1000 × 1000 mm als RWA-Anlage.`);
  if (e.firstlicht_m > 0) oeffnungen.push(`Firstlichtband ca. ${z0(e.firstlicht_m)} m.`);
  if (e.vordach_m2 > 0) oeffnungen.push(`Vordach ca. ${z0(e.vordach_m2)} m² herstellen und montieren.`);
  if (oeffnungen.length) out.push({ titel: 'Türen, Tore, Fenster', absaetze: oeffnungen });

  if (aktiv('elektro')) {
    out.push({
      titel: 'Elektroarbeiten',
      absaetze: ['Herstellen einer Unterverteilung im Hausanschlussraum, Kabelbahn in der Halle montieren, Steckdosenkombinationen mit Schuko- und 16 A-Kraftsteckdose liefern und montieren, Außenleuchten gesteuert über Dämmerungsschalter. Umfang nach Abstimmung.'],
    });
  }
  if (aktiv('heizung')) {
    out.push({ titel: 'Heizungsbauarbeiten', absaetze: ['Beheizung der Halle einschließlich Steuerung. System nach Abstimmung mit dem Auftraggeber.'] });
  }
  if (aktiv('buero')) {
    out.push({
      titel: 'Büroeinbauten',
      absaetze: [
        `Auf einer Fläche von ca. ${z0(e.buero_m2)} m² werden Büro- und Sozialräume eingebaut. Die Wände bestehen aus Trockenbau, hallenseitig wird die Wand weiß gestrichen, außer in den Nassbereichen werden die Wände mit Malervlies tapeziert und gestrichen, Nassbereiche werden 1,30 m hoch gefliest. Die Decke besteht aus Trockenbau, wird tapeziert und gestrichen.`,
        'Innentüren als Röhrenspan-Innentüren, weiß, mit Edelstahl-Drückergarnituren. Sanitärobjekte in Standard-Ausführung. Es werden ausreichend Licht und Steckdosen montiert, jeder Raum erhält eine Datendose. Die Räume erhalten einen PVC-Fußbodenbelag. Warmes Wasser mittels Durchlauferhitzer.',
      ],
    });
  }
  if (aktiv('trennwand')) out.push({ titel: 'Hallentrennwand', absaetze: [`Hallentrennwand aus Sandwichpaneelen, ca. ${z0(e.trennwand_m2)} m².`] });
  if (aktiv('aussenanlagen') || aktiv('zaun')) {
    out.push({
      titel: 'Außenanlagen',
      absaetze: [
        ...(aktiv('aussenanlagen') ? [`Pflasterflächen ca. ${z0(e.aussenanlagen_m2)} m².`] : []),
        ...(aktiv('zaun') ? [`Zaunanlage als Doppelstabmattenzaun, ca. ${z0(e.zaun_m)} m.`] : []),
      ],
    });
  }

  const ing: string[] = [];
  if (aktiv('bauantrag')) ing.push('Bauantrag erstellen und einreichen, Brand- und Wärmeschutznachweis.');
  if (aktiv('baugrund')) ing.push('Bodengutachten erstellen.');
  if (aktiv('statik')) ing.push('Prüffähige Hallenstatik, Schal- und Bewehrungspläne.');
  if (aktiv('werkplanung')) ing.push('Werkstatt- und Montagepläne für Stahlbau, Dach und Fassade liefern.');
  if (aktiv('erdarbeiten') && aktiv('statik')) ing.push('Prüffähige Fundamentstatik inklusive Stahllisten.');
  if (ing.length) out.push({ titel: 'Architekten- und Ingenieurleistungen', absaetze: ing });

  const nicht = ['Gebühren für Baugenehmigung, Prüfgebühren usw.', 'Beauflagungen durch das Bauamt, die zur Zeit der Angebotsabgabe nicht bekannt sind.', 'Zuleitungen der Versorger für Gas, Wasser, Strom und Telefon bis in den Hausanschlussraum, einschließlich der Zählerinstallationen.'];
  if (!aktiv('aussenanlagen')) nicht.push('Außenanlagen sind bisher nicht Angebotsbestandteil.');
  if (!aktiv('erdarbeiten')) nicht.push('Erdarbeiten, Fundamente und Bodenplatte.');
  if (aktiv('erdarbeiten')) nicht.push('Nach Erstellen des Baugrundgutachtens muss die Kalkulation für die Erdarbeiten geprüft werden.');
  out.push({ titel: 'Nicht im Lieferumfang enthalten', absaetze: nicht });

  return out;
}
