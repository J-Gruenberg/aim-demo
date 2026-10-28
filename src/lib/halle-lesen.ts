/**
 * Halle aus Anfrage oder Zeichnung: Prompt, Antwortschema und die Übersetzung in die Hallen-Eingaben.
 * Die KI liest nur ab, was dasteht. Rechnen tut weiterhin der Hallen-Vordruck.
 */
import type { HallenEingaben, Tor } from '@/lib/engine/halle';

export const SYSTEM_HALLE = `Du liest Anfragen und Zeichnungen für Stahlhallen und gibst die Eckdaten für den Kalkulationszettel "Kalkulation Hallenbau" eines Stahl- und Hallenbaubetriebs zurück.
Typische Unterlagen: Kunden-E-Mail ("Halle 30 x 15 m, 5 m hoch, 2 Tore"), Bauantragsplan, Grundriss, Schnitt, Ansicht, Handskizze, Baubeschreibung.

Lesen:
- Erst Planköpfe, Maßstab und Bemaßung lesen, dann Grundriss (Länge, Breite, Achsraster), Schnitt (Traufhöhe, Firsthöhe, Dachneigung), Ansichten (Tore, Türen, Fenster, Lichtbänder).
- Maße immer in Metern (mm und cm umrechnen). Länge = längere Seite, Breite = Spannweite der Binder. Außenmaße bzw. Achsmaße des Stahlbaus nehmen, keine Grundstücksmaße.
- Nur Bemaßung und Text verwenden. Nicht aus der Zeichnung herausmessen, außer ein Maßstab ist angegeben und es gibt keine andere Angabe; dann in "unsicher" aufnehmen.
- Rahmenabstand = Achsabstand der Hauptrahmen (Binderabstand, Achsraster). Firsthöhe und Traufhöhe getrennt halten. Ist nur eine Höhe genannt ("5 m hoch"), ist das die Traufhöhe; in "unsicher" aufnehmen.
- Dach und Wand: Sandwich (Paneel, gedämmt, Isopaneel, warm) oder Trapez (Trapezblech, Kalthalle, ungedämmt). Offene Halle oder Unterstand ohne Wände: wand = "ohne". Anbau an eine bestehende Halle: wandseiten = 3.
- Stahl: verzinkt nur, wenn so geschrieben oder Außenstahl ohne Verkleidung (Unterstand) klar erkennbar; sonst grundiert, wenn genannt, sonst "unbekannt".
- Tore: Anzahl, lichte Breite und Höhe in m, antrieb = true bei elektrisch, Motor, Antrieb, Funk. Rolltor und Sektionaltor gleich behandeln.
- Hallenkran, Brückenkran, Kranbahn: hallenkran = "ja" und Traglast in t, wenn genannt. Ein Autokran für die Montage ist kein Hallenkran.
- Leistungen: "ja" nur, wenn ausdrücklich gewünscht (z. B. "inkl. Fundamente", "mit Statik", "Bauantrag durch Sie"), "nein" wenn ausdrücklich ausgeschlossen ("Fundamente bauseits", "Statik liegt vor"), sonst "unbekannt".

Ausgabe:
- Was nicht dasteht: Zahl 0, Auswahl "unbekannt", leere Liste. Nichts erfinden.
- fundstellen: für jedes gelesene Feld kurz, wo es steht (z. B. "Grundriss, Bemaßung unten", "E-Mail: '30 x 15 m'").
- unsicher: Feldnamen, bei denen du schätzen oder ableiten musstest.
- fehlend: was für ein belastbares Angebot noch fehlt, in kurzen Sätzen (höchstens 5).
- hinweise: Besonderheiten für die Kalkulation in kurzen Sätzen (Spannweite über 30 m, Mittelstützen, Vordach, Anbau, Schneelast, Bauort, Termin), höchstens 6.
- objekt: kurze Bezeichnung wie "Kalthalle 30 × 15 m" oder "Lagerhalle Müller". kunde und ort nur, wenn genannt.
Alles auf Deutsch.`;

const ZAHL = { type: 'number' } as const;
const GANZ = { type: 'integer' } as const;
const TEXT = { type: 'string' } as const;
const LISTE = { type: 'array', items: { type: 'string' } } as const;
const JNU = { type: 'string', enum: ['ja', 'nein', 'unbekannt'] } as const;
const objekt = (props: Record<string, unknown>) => ({ type: 'object', properties: props, required: Object.keys(props), additionalProperties: false });

export const LEISTUNGEN = ['erdarbeiten', 'statik', 'werkplanung', 'bauantrag', 'baugrund', 'elektro', 'heizung', 'maler'] as const;
type Leistung = (typeof LEISTUNGEN)[number];

export const SCHEMA_HALLE = objekt({
  objekt: TEXT,
  kunde: TEXT,
  ort: TEXT,
  laenge_m: ZAHL,
  breite_m: ZAHL,
  traufhoehe_m: ZAHL,
  firsthoehe_m: ZAHL,
  neigung_grad: ZAHL,
  rahmenabstand_m: ZAHL,
  dachform: { type: 'string', enum: ['satteldach', 'pultdach', 'unbekannt'] },
  oberflaeche: { type: 'string', enum: ['grundiert', 'verzinkt', 'unbekannt'] },
  dach: { type: 'string', enum: ['sandwich', 'trapez', 'unbekannt'] },
  wand: { type: 'string', enum: ['sandwich', 'trapez', 'ohne', 'unbekannt'] },
  wandseiten: GANZ,
  tore: { type: 'array', items: objekt({ anzahl: GANZ, breite_m: ZAHL, hoehe_m: ZAHL, antrieb: { type: 'boolean' } }) },
  tueren: GANZ,
  fenster: GANZ,
  lichtkuppeln: GANZ,
  lichtkuppeln_rwa: GANZ,
  firstlicht_m: ZAHL,
  vordach_m2: ZAHL,
  buero_m2: ZAHL,
  trennwand_m2: ZAHL,
  aussenanlagen_m2: ZAHL,
  zaun_m: ZAHL,
  hallenkran: JNU,
  kran_traglast_t: ZAHL,
  leistungen: objekt(Object.fromEntries(LEISTUNGEN.map((l) => [l, JNU]))),
  fundstellen: { type: 'array', items: objekt({ feld: TEXT, fundstelle: TEXT }) },
  unsicher: LISTE,
  fehlend: LISTE,
  hinweise: LISTE,
});

export type JaNein = 'ja' | 'nein' | 'unbekannt';
export type HalleGelesen = {
  objekt: string;
  kunde: string;
  ort: string;
  laenge_m: number;
  breite_m: number;
  traufhoehe_m: number;
  firsthoehe_m: number;
  neigung_grad: number;
  rahmenabstand_m: number;
  dachform: 'satteldach' | 'pultdach' | 'unbekannt';
  oberflaeche: 'grundiert' | 'verzinkt' | 'unbekannt';
  dach: 'sandwich' | 'trapez' | 'unbekannt';
  wand: 'sandwich' | 'trapez' | 'ohne' | 'unbekannt';
  wandseiten: number;
  tore: { anzahl: number; breite_m: number; hoehe_m: number; antrieb: boolean }[];
  tueren: number;
  fenster: number;
  lichtkuppeln: number;
  lichtkuppeln_rwa: number;
  firstlicht_m: number;
  vordach_m2: number;
  buero_m2: number;
  trennwand_m2: number;
  aussenanlagen_m2: number;
  zaun_m: number;
  hallenkran: JaNein;
  kran_traglast_t: number;
  leistungen: Record<Leistung, JaNein>;
  fundstellen: { feld: string; fundstelle: string }[];
  unsicher: string[];
  fehlend: string[];
  hinweise: string[];
};

/** Eine Zeile der Vorschau: was übernommen würde, woher es kommt, wie sicher. */
export type Erkannt = { key: string; label: string; wert: string; fundstelle: string; unsicher: boolean; patch: Partial<HallenEingaben>; optionen?: Partial<HallenEingaben['optionen']> };

export type HallenVorschlag = {
  erkannt: Erkannt[];
  meta: { objekt: string; kunde: string; ort: string };
  fehlend: string[];
  hinweise: string[];
};

const komma = (x: number, s = 2) => x.toLocaleString('de-DE', { maximumFractionDigits: s });
const r2 = (x: number) => Math.round(x * 100) / 100;

const LABEL_LEISTUNG: Record<Leistung, string> = {
  erdarbeiten: 'Erdarbeiten, Fundamente, Sohle',
  statik: 'Statik',
  werkplanung: 'Werkplanung',
  bauantrag: 'Bauantrag, Brand- und Wärmeschutz',
  baugrund: 'Baugrundgutachten',
  elektro: 'Elektroarbeiten Halle',
  heizung: 'Heizung Halle',
  maler: 'Malerarbeiten Stahlbau',
};

/** Übersetzt die gelesenen Daten in einzelne, abwählbare Vorschläge für den Hallen-Vordruck. */
export function vorschlagAus(g: HalleGelesen): HallenVorschlag {
  const fund = (...felder: string[]) => {
    const f = g.fundstellen.find((x) => felder.some((k) => x.feld.toLowerCase().includes(k)));
    return f?.fundstelle ?? '';
  };
  const unsicher = (...felder: string[]) => g.unsicher.some((u) => felder.some((k) => u.toLowerCase().includes(k)));
  const erkannt: Erkannt[] = [];
  const add = (key: string, label: string, wert: string, felder: string[], patch: Partial<HallenEingaben>, optionen?: Partial<HallenEingaben['optionen']>) =>
    erkannt.push({ key, label, wert, fundstelle: fund(...felder), unsicher: unsicher(...felder), patch, optionen });

  // Länge ist die längere Seite
  let L = g.laenge_m > 0 ? g.laenge_m : 0;
  let B = g.breite_m > 0 ? g.breite_m : 0;
  if (L && B && B > L) [L, B] = [B, L];
  if (L) add('laenge', 'Länge', `${komma(L)} m`, ['laenge', 'länge'], { laenge: r2(L) });
  if (B) add('breite', 'Breite (Spannweite)', `${komma(B)} m`, ['breite'], { breite: r2(B) });
  if (g.traufhoehe_m > 0) add('traufhoehe', 'Traufhöhe', `${komma(g.traufhoehe_m)} m`, ['traufhoehe', 'traufe', 'hoehe'], { traufhoehe: r2(g.traufhoehe_m) });
  if (g.dachform !== 'unbekannt') add('dachform', 'Dachform', g.dachform === 'satteldach' ? 'Satteldach' : 'Pultdach', ['dachform'], { dachform: g.dachform });

  // Dachneigung: gelesen oder aus Trauf- und Firsthöhe abgeleitet
  let neigung = g.neigung_grad > 0 ? g.neigung_grad : 0;
  let abgeleitet = false;
  if (!neigung && g.firsthoehe_m > g.traufhoehe_m && g.traufhoehe_m > 0 && B > 0) {
    const lauf = g.dachform === 'pultdach' ? B : B / 2;
    neigung = (Math.atan((g.firsthoehe_m - g.traufhoehe_m) / lauf) * 180) / Math.PI;
    abgeleitet = true;
  }
  if (neigung > 0 && neigung <= 45) {
    erkannt.push({
      key: 'neigung',
      label: 'Dachneigung',
      wert: `${komma(neigung, 1)}°${abgeleitet ? ` (aus Firsthöhe ${komma(g.firsthoehe_m)} m)` : ''}`,
      fundstelle: fund('neigung', 'firsthoehe', 'first'),
      unsicher: abgeleitet || unsicher('neigung'),
      patch: { neigung: Math.round(neigung * 10) / 10 },
    });
  }
  if (g.rahmenabstand_m >= 2 && g.rahmenabstand_m <= 12) add('rahmenabstand', 'Rahmenabstand', `${komma(g.rahmenabstand_m)} m`, ['rahmen', 'achs', 'binder'], { rahmenabstand: r2(g.rahmenabstand_m) });
  if (g.oberflaeche !== 'unbekannt') add('oberflaeche', 'Stahlbau', g.oberflaeche, ['oberflaeche', 'verzinkt', 'grundiert'], { oberflaeche: g.oberflaeche });
  if (g.dach !== 'unbekannt') add('dach', 'Dach', g.dach === 'sandwich' ? 'Sandwich' : 'Trapezblech', ['dach'], { dach: g.dach });
  if (g.wand !== 'unbekannt') add('wand', 'Wand', g.wand === 'sandwich' ? 'Sandwich' : g.wand === 'trapez' ? 'Trapezblech' : 'offen', ['wand'], { wand: g.wand });
  if (g.wandseiten >= 1 && g.wandseiten <= 3) add('wandseiten', 'Verkleidete Seiten', String(g.wandseiten), ['wandseiten', 'seiten', 'anbau'], { wandseiten: g.wandseiten });

  const tore: Tor[] = g.tore.filter((t) => t.anzahl > 0).map((t) => ({ anzahl: t.anzahl, breite: r2(t.breite_m || 4), hoehe: r2(t.hoehe_m || 4), antrieb: t.antrieb }));
  if (tore.length) {
    add('tore', 'Tore', tore.map((t) => `${t.anzahl} × ${komma(t.breite)} × ${komma(t.hoehe)} m${t.antrieb ? ' mit Antrieb' : ''}`).join(', '), ['tor'], { tore });
  }
  const stueck: [keyof HallenEingaben, string, string[]][] = [
    ['tueren', 'Türen', ['tuer', 'tür']],
    ['fenster', 'Fenster', ['fenster']],
    ['lichtkuppeln', 'Lichtkuppeln', ['lichtkuppel', 'kuppel']],
    ['lichtkuppeln_rwa', 'RWA-Kuppeln', ['rwa']],
  ];
  for (const [k, label, felder] of stueck) {
    const v = g[k as keyof HalleGelesen] as number;
    if (v > 0) add(k, label, `${v} Stk`, felder, { [k]: Math.round(v) } as Partial<HallenEingaben>);
  }
  const flaechen: [keyof HallenEingaben, string, string, string[]][] = [
    ['firstlicht_m', 'Firstlicht', 'm', ['firstlicht', 'lichtband']],
    ['vordach_m2', 'Vordach', 'm²', ['vordach']],
    ['buero_m2', 'Büro- und Sozialausbau', 'm²', ['buero', 'büro', 'sozial']],
    ['trennwand_m2', 'Hallentrennwand', 'm²', ['trennwand']],
    ['aussenanlagen_m2', 'Außenanlagen', 'm²', ['aussen', 'außen', 'pflaster']],
    ['zaun_m', 'Zaun', 'm', ['zaun']],
  ];
  for (const [k, label, einheit, felder] of flaechen) {
    const v = g[k as keyof HalleGelesen] as number;
    if (v > 0) add(k, label, `${komma(v)} ${einheit}`, felder, { [k]: r2(v) } as Partial<HallenEingaben>);
  }
  if (g.hallenkran !== 'unbekannt') {
    add('kran', 'Hallenkran', g.hallenkran === 'ja' ? `ja${g.kran_traglast_t > 0 ? `, ${komma(g.kran_traglast_t, 1)} t` : ''}` : 'nein', ['kran'], { kran: g.hallenkran === 'ja' });
  }
  for (const l of LEISTUNGEN) {
    const v = g.leistungen[l];
    if (v === 'unbekannt') continue;
    add(`opt_${l}`, LABEL_LEISTUNG[l], v === 'ja' ? 'ja, einrechnen' : 'nein, bauseits', [l], {}, { [l]: v === 'ja' });
  }

  const hinweise = [...g.hinweise];
  if (g.hallenkran === 'ja') {
    hinweise.push(`Hallenkran${g.kran_traglast_t > 0 ? ` ${komma(g.kran_traglast_t, 1)} t` : ''}: Kranbahn als Mehrgewicht eingerechnet, Kran selbst beim Lieferanten anfragen.`);
  }
  return {
    erkannt,
    meta: { objekt: g.objekt.trim() || (L && B ? `Halle ${komma(L)} × ${komma(B)} m` : ''), kunde: g.kunde.trim(), ort: g.ort.trim() },
    fehlend: g.fehlend.slice(0, 5),
    hinweise: hinweise.slice(0, 8),
  };
}

/** Wendet die ausgewählten Vorschläge auf die Eingaben an. */
export function anwenden(e: HallenEingaben, erkannt: Erkannt[], keys: Set<string>): HallenEingaben {
  let neu: HallenEingaben = { ...e, optionen: { ...e.optionen } };
  for (const x of erkannt) {
    if (!keys.has(x.key)) continue;
    neu = { ...neu, ...x.patch };
    if (x.optionen) neu.optionen = { ...neu.optionen, ...x.optionen } as HallenEingaben['optionen'];
  }
  return neu;
}
