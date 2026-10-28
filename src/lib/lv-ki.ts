import 'server-only';

/** Prompts und Schemas für das Lesen und Kalkulieren von Leistungsverzeichnissen. */

export const SYSTEM_LESEN = `Du liest Leistungsverzeichnisse (LV) aus öffentlichen und privaten Ausschreibungen für einen Stahl- und Metallbaubetrieb (Stahlkonstruktionen, Treppen, Geländer, Blechbearbeitung, Hallenbau).
Aufgabe: Übertrage jede Position exakt so, wie sie im LV steht. Nichts erfinden, nichts zusammenfassen, keine Mengen schätzen.
Regeln:
- Ordnungszahl (OZ) exakt übernehmen, inklusive führender Nullen und Punkte (z. B. "01.02.0030").
- Kurztext = erste Zeile bzw. fett gedruckte Überschrift der Position. Langtext = vollständiger Positionstext ohne Seitenköpfe und Fußzeilen.
- Menge als Zahl (deutsches Komma in Punkt umwandeln), Einheit wie im LV (Stck, m, m², kg, t, psch, h …). Ohne Menge: menge = 0 und einheit = "".
- Bedarfspositionen (Eventual, "nur auf Anordnung", "NEP", "Bedarf") mit bedarf = true. Alternativpositionen mit alternativ = true.
- Titel und Abschnittsüberschriften sind keine Positionen.
- Positionen, die auf den Seiten nach dem markierten Bereich weitergehen, vollständig ausgeben (der Folgetext ist mitgeliefert). Positionen, die vor dem markierten Bereich beginnen, NICHT ausgeben.
- In "hinweise" kurz festhalten, was aus Vorbemerkungen und Baubeschreibung für die Kalkulation wichtig ist: Montagehöhe, Kran/Hebezeuge, Zugänglichkeit, Ausführungsklasse (EXC), Korrosionsschutz, Fristen, Vertragsstrafen, Nachweise. Leer lassen, wenn nichts davon auf diesen Seiten steht.`;

export const SYSTEM_PLAN = `Du erstellst für einen Stahl- und Metallbaubetrieb (Stahlkonstruktionen, Treppen, Geländer, Gitterroste, Bühnen, Hallenbau) aus Zeichnungen (Werkplan, Ausführungsplan, Skizze, Stückliste) ein Leistungsverzeichnis, weil kein LV vorliegt.
Aufgabe: Lies die Zeichnung und lege für jedes Bauteil unseres Gewerks eine Position an. Nur was auf der Zeichnung steht, nichts dazuerfinden.
Regeln:
- OZ im Format "Z<Seite>.<laufende Nummer zweistellig>", z. B. "Z1.01", "Z1.02".
- Kurztext: Bauteil und Hauptprofil, z. B. "Stahlträger HEB 200", "Stahltreppe gerade, 16 Steigungen", "Geländer Flachstahl, Höhe 1,10 m".
- Langtext: alles Ablesbare für die Kalkulation: Profile und Abmessungen, Längen, Stückzahl, Werkstoff (S235/S355), Oberfläche (verzinkt, grundiert, pulverbeschichtet), Anschlüsse, Einbauort, Positionsnummern aus der Zeichnung.
- Menge und Einheit aus Bemaßung oder Stückliste: Stck für Einzelbauteile, m für Geländer und Handläufe, m² für Gitterroste und Bleche, kg nur wenn ein Gewicht angegeben ist. Nicht ablesbar: menge = 0, einheit = "" und in hinweise notieren.
- Gleiche Bauteile zu einer Position zusammenfassen und die Stückzahl als Menge nehmen.
- Fremdgewerke (Beton, Mauerwerk, Elektro) nicht als Position anlegen.
- seite = Seitennummer, auf der das Bauteil steht. bedarf und alternativ = false.
- In "hinweise": fehlende Maße, unklare Details, Maßstab, Planstand, Annahmen.`;

export const SCHEMA_LESEN = {
  type: 'object',
  properties: {
    positionen: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          oz: { type: 'string' },
          kurztext: { type: 'string' },
          langtext: { type: 'string' },
          menge: { type: 'number' },
          einheit: { type: 'string' },
          bedarf: { type: 'boolean' },
          alternativ: { type: 'boolean' },
          seite: { type: 'integer' },
        },
        required: ['oz', 'kurztext', 'langtext', 'menge', 'einheit', 'bedarf', 'alternativ', 'seite'],
        additionalProperties: false,
      },
    },
    hinweise: { type: 'array', items: { type: 'string' } },
  },
  required: ['positionen', 'hinweise'],
  additionalProperties: false,
} as const;

export type GelesenePosition = { oz: string; kurztext: string; langtext: string; menge: number; einheit: string; bedarf: boolean; alternativ: boolean; seite: number };

export const ARTEN = ['stahl_kg', 'gelaender_m', 'treppe_stk', 'gitterrost_m2', 'zukauf', 'stunden', 'prozent_be', 'manuell'] as const;

export function systemKalkulieren(stammText: string) {
  return `Du bist erfahrener Kalkulator in einem Stahl- und Metallbaubetrieb (Stahl S235/S355, Leistungen: Stahlkonstruktionen, Treppen, Geländer, Blechbearbeitung, Hallenbau).
Du legst für jede LV-Position den Kalkulationsansatz fest. Den Preis rechnet danach eine feste Formel mit den Stammdaten des Betriebs, nicht du.

So kalkuliert der Betrieb (verbindlich):
- Tonnage- und Gewichtspositionen (Stahlkonstruktion, Unterkonstruktion, Träger, Stützen, Bühnen, Konsolen, Zargen, Abdeckungen aus Blech): art = "stahl_kg", Feld "stahl" ausfüllen. kg_je_einheit = Stahlgewicht je LV-Einheit (bei Einheit kg: 1, bei t: 1000, bei Stck/psch/m: Gewicht je Stück bzw. Meter). Gewicht = Profil-Metergewicht × Länge × Stück. Kleinteile (+10 %) rechnet die Formel selbst, nicht doppelt aufschlagen. rohr = true bei Rund- oder Quadratrohren als Hauptbestandteil, s355 = true bei S355, blech = true bei Blechen, Riffelblech, Belägen und Abdeckungen (weniger Fertigungsaufwand je kg).
- Geländer nach laufendem Meter: art = "gelaender_m", Feld "gelaender" ausfüllen: Höhe, Pfostenprofil (z. B. "Fl 70x10"), Pfostenabstand, Füllung (staebe, knieleiste, lochblech, gitter, ohne), Handlauf (stahl oder edelstahl), cluster 1 einfach, 2 mittel, 3 aufwendig (viele Schweißnähte, Lochblech mit Rahmen, Bögen, Anpassungen), 0 wenn unklar.
- Treppen als Stück: art = "treppe_stk", Feld "treppe" ausfüllen: Geschosshöhe, Laufbreite, Podestfläche, Geländerseiten, Wangenprofil. Gitterroststufen sind Kaufteile, die Formel rechnet sie. Sind Stufen oder Geländer als eigene LV-Position ausgeschrieben, dann gelaender_seiten = 0 bzw. Stufen nicht doppelt.
- Gitterroste als Fläche: art = "gitterrost_m2".
- Fremdgewerke und Zukaufteile (Gitterroststufen als eigene Position, Sonderverglasung, HPL-Platten, Tore, Antriebe, Prüfungen durch Dritte, Gutachten): art = "zukauf", Feld "zukauf": "anfrage" kurz, was beim Lieferanten anzufragen ist, "richtpreis_eur" realistischer Einkaufspreis je LV-Einheit als Richtwert (für Gitterroststufen und Gitterroste die Werte aus den Stammdaten), 0 wenn nicht abschätzbar.
- Arbeiten am Bestand: am_bestand = true (nur bei art = "stahl_kg") nur dann, wenn das neue Bauteil vor Ort an vorhandene Bauteile angeschweißt, angeschraubt oder angedübelt wird (an vorhandene Stahlstützen oder Träger, über Anker- und Kopfplatten an vorhandene Stahlbetonstützen oder Wände, auf bestehende Dächer) oder wenn vorhandene Bauteile getrennt, verlängert oder verstärkt werden. Neue Träger, Unterzüge, Stürze oder Auflagerträger, die nur auf Auflager gelegt oder untergemauert werden, sind normale Montage, auch in einem Umbau oder einer Sanierung: am_bestand = false und keine Hebebühne, wenn sie nicht ausdrücklich genannt ist. Die Formel rechnet die Montage dann mit dem Bestandsfaktor aus den Stammdaten (typisch zwei- bis dreifache Neubau-Montage). Zusätzlich "bestand_stunden" je LV-Einheit nur für Arbeit, die nicht am Gewicht hängt: Trennen und Schleifen am vorhandenen Bauteil, Aufmaß am Bestand, Bohren in Beton oder Holz, Anpassen vor Ort. "geraet_eur" je LV-Einheit für Hebebühne oder Rollgerüst, wenn in der Höhe gearbeitet wird und kein Kran geht: Bühnen typisch 700 bis 3.000 € je Projekt, anteilig auf die Bauteile verteilen, die mit Bühne eingebaut werden. Eine freistehende neue Konstruktion in einer bestehenden Halle ist kein Bestand: am_bestand = false. Im Neubau am_bestand = false, bestand_stunden und geraet_eur = 0. Steht im Text "Wie vor", gilt die genannte Bezugsposition mit den beschriebenen Änderungen.
- Stundenlohnarbeiten, Demontagen, Anpassarbeiten, Bauteile ohne erkennbares Gewicht: art = "stunden", "stunden_je_einheit" realistisch; montage = true bei Arbeiten auf der Baustelle.
- Teile aus anderen Werkstoffen, die mit der Stahlkonstruktion eingebaut werden (Holzbalken oder Bohlen auf Stahlstützen, Elastomerlager, Anker und Dübel): unser_gewerk = true, art = "zukauf" mit Richtpreis, Einbau ist in der Stahlmontage enthalten.
- Baustelleneinrichtung: art = "prozent_be", "be_prozent" (typisch 3 bis 8 % der übrigen Summe, bei kleinen LVs eher höher). Ist eine BE-Position im LV, ist der Kran darin enthalten.
- Nur wenn gar keine Regel passt: art = "manuell".
- unser_gewerk = false für Leistungen, die ein Stahl- und Metallbauer nicht selbst ausführt (Erdbau, Beton, Pflaster, Dach- und Abdichtung, Elektro, Landschaftsbau, Abfallentsorgung, Verkehrssicherung). Diese Positionen trotzdem ausgeben, art = "manuell".
- oberflaeche aus Positionstext oder Vorbemerkungen (verzinkt, grundiert, verzinkt_pulver für verzinkt plus Pulver/Duplex, roh). montage = true, wenn Montage im Positionstext enthalten ist ("liefern und montieren", "einbauen").
- Felder, die nicht zur gewählten art gehören, sind null.
- Gibt es zu einer Position "Ähnliche Positionen aus Ihren Angeboten", nutze sie als Orientierung für Ansatz und Gewicht. Übernimm keinen Preis blind, der Preis kommt aus der Formel.

Ehrlichkeit vor Vollständigkeit:
- Fehlen Angaben (Profil, Blechdicke, Länge), schätze nachvollziehbar, nenne die Annahme knapp in "annahme" und setze sicherheit unter 0,9.
- sicherheit 0 bis 1: 0,95 nur, wenn Gewicht bzw. Ansatz eindeutig aus dem Text folgt.
- begruendung: der Rechenweg in einem kurzen Satz (höchstens 200 Zeichen), so dass der Kalkulator ihn in 10 Sekunden prüfen kann (z. B. "4 × HEA 160, je 3,20 m: 4 × 3,2 × 30,4 kg/m = 389 kg je Stück").

Aktuelle Stammdaten des Betriebs (nur zur Orientierung, die Preisrechnung macht die Formel):
${stammText}`;
}

const NULL = { type: 'null' } as const;
const objekt = (props: Record<string, unknown>) => ({ type: 'object', properties: props, required: Object.keys(props), additionalProperties: false });

/** Schlankes Antwortschema: je Ansatzart nur die passenden Felder, der Rest ist null. */
export const SCHEMA_KALKULIEREN = objekt({
  positionen: {
    type: 'array',
    items: objekt({
      id: { type: 'string' },
      unser_gewerk: { type: 'boolean' },
      art: { type: 'string', enum: [...ARTEN] },
      oberflaeche: { type: 'string', enum: ['roh', 'grundiert', 'verzinkt', 'verzinkt_pulver'] },
      montage: { type: 'boolean' },
      sicherheit: { type: 'number' },
      begruendung: { type: 'string' },
      annahme: { anyOf: [{ type: 'string' }, NULL] },
      stahl: { anyOf: [objekt({ kg_je_einheit: { type: 'number' }, rohr: { type: 'boolean' }, s355: { type: 'boolean' }, blech: { type: 'boolean' }, am_bestand: { type: 'boolean' }, bestand_stunden: { type: 'number' }, geraet_eur: { type: 'number' } }), NULL] },
      gelaender: {
        anyOf: [
          objekt({
            hoehe_m: { type: 'number' },
            pfosten: { type: 'string' },
            pfostenabstand_m: { type: 'number' },
            fuellung: { type: 'string', enum: ['staebe', 'knieleiste', 'lochblech', 'gitter', 'ohne'] },
            handlauf: { type: 'string', enum: ['stahl', 'edelstahl'] },
            cluster: { type: 'integer' },
          }),
          NULL,
        ],
      },
      treppe: {
        anyOf: [
          objekt({ geschosshoehe_m: { type: 'number' }, laufbreite_m: { type: 'number' }, podest_m2: { type: 'number' }, gelaender_seiten: { type: 'integer' }, wange: { type: 'string' } }),
          NULL,
        ],
      },
      stunden_je_einheit: { anyOf: [{ type: 'number' }, NULL] },
      zukauf: { anyOf: [objekt({ anfrage: { type: 'string' }, richtpreis_eur: { type: 'number' } }), NULL] },
      be_prozent: { anyOf: [{ type: 'number' }, NULL] },
    }),
  },
});

export type KiAntwort = {
  id: string;
  unser_gewerk: boolean;
  art: (typeof ARTEN)[number];
  oberflaeche: 'roh' | 'grundiert' | 'verzinkt' | 'verzinkt_pulver';
  montage: boolean;
  sicherheit: number;
  begruendung: string;
  annahme: string | null;
  stahl: { kg_je_einheit: number; rohr: boolean; s355: boolean; blech: boolean; am_bestand?: boolean; bestand_stunden?: number; geraet_eur?: number } | null;
  gelaender: { hoehe_m: number; pfosten: string; pfostenabstand_m: number; fuellung: 'staebe' | 'knieleiste' | 'lochblech' | 'gitter' | 'ohne'; handlauf: 'stahl' | 'edelstahl'; cluster: number } | null;
  treppe: { geschosshoehe_m: number; laufbreite_m: number; podest_m2: number; gelaender_seiten: number; wange: string } | null;
  stunden_je_einheit: number | null;
  zukauf: { anfrage: string; richtpreis_eur: number } | string | null;
  be_prozent: number | null;
};

export type KiAnsatz = {
  id: string;
  unser_gewerk: boolean;
  art: (typeof ARTEN)[number];
  kg_je_einheit: number;
  oberflaeche: 'roh' | 'grundiert' | 'verzinkt' | 'verzinkt_pulver';
  montage: boolean;
  rohr: boolean;
  s355: boolean;
  blech: boolean;
  bestand: boolean;
  bestand_h: number;
  geraet_eur: number;
  gel_hoehe_m: number;
  gel_pfosten: string;
  gel_pfostenabstand_m: number;
  gel_fuellung: 'staebe' | 'knieleiste' | 'lochblech' | 'gitter' | 'ohne';
  gel_handlauf: 'stahl' | 'edelstahl';
  gel_cluster: number;
  tr_geschosshoehe_m: number;
  tr_laufbreite_m: number;
  tr_podest_m2: number;
  tr_gelaender_seiten: number;
  tr_wange: string;
  stunden_je_einheit: number;
  zukauf_hinweis: string;
  zukauf_richtpreis?: number;
  be_prozent: number;
  sicherheit: number;
  begruendung: string;
  fehlende_angaben: string;
};

/** Übersetzt die schlanke Antwort in die flache Form, mit der die Formel arbeitet. */
export function flach(k: KiAntwort): KiAnsatz {
  const g = k.gelaender;
  const t = k.treppe;
  return {
    id: k.id,
    unser_gewerk: k.unser_gewerk,
    art: k.art,
    kg_je_einheit: k.stahl?.kg_je_einheit ?? 0,
    oberflaeche: k.oberflaeche,
    montage: k.montage,
    rohr: k.stahl?.rohr ?? false,
    s355: k.stahl?.s355 ?? false,
    blech: k.stahl?.blech ?? false,
    bestand: k.stahl?.am_bestand ?? false,
    bestand_h: k.stahl?.bestand_stunden ?? 0,
    geraet_eur: k.stahl?.geraet_eur ?? 0,
    gel_hoehe_m: g?.hoehe_m ?? 0,
    gel_pfosten: g?.pfosten ?? '',
    gel_pfostenabstand_m: g?.pfostenabstand_m ?? 0,
    gel_fuellung: g?.fuellung ?? 'staebe',
    gel_handlauf: g?.handlauf ?? 'stahl',
    gel_cluster: g?.cluster ?? 0,
    tr_geschosshoehe_m: t?.geschosshoehe_m ?? 0,
    tr_laufbreite_m: t?.laufbreite_m ?? 0,
    tr_podest_m2: t?.podest_m2 ?? 0,
    tr_gelaender_seiten: t?.gelaender_seiten ?? 0,
    tr_wange: t?.wange ?? '',
    stunden_je_einheit: k.stunden_je_einheit ?? 0,
    zukauf_hinweis: typeof k.zukauf === 'string' ? k.zukauf : (k.zukauf?.anfrage ?? ''),
    zukauf_richtpreis: typeof k.zukauf === 'object' && k.zukauf && k.zukauf.richtpreis_eur > 0 ? k.zukauf.richtpreis_eur : 0,
    be_prozent: k.be_prozent ?? 0,
    sicherheit: k.sicherheit,
    begruendung: k.begruendung,
    fehlende_angaben: k.annahme ?? '',
  };
}
