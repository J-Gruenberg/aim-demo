import type { Ansatz, Oberflaeche } from './bauteile';

/** Übersetzt den flachen KI-Vorschlag in einen Kalkulationsansatz der Formel. */
export function ansatzAusKi(k: {
  art: string;
  kg_je_einheit: number;
  oberflaeche: Oberflaeche;
  montage: boolean;
  rohr: boolean;
  s355: boolean;
  blech?: boolean;
  bestand?: boolean;
  bestand_h?: number;
  geraet_eur?: number;
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
}): Ansatz {
  const gel = {
    ...(k.gel_hoehe_m > 0 ? { hoehe_m: k.gel_hoehe_m } : {}),
    ...(k.gel_pfosten ? { pfosten: k.gel_pfosten } : {}),
    ...(k.gel_pfostenabstand_m > 0 ? { pfostenabstand_m: k.gel_pfostenabstand_m } : {}),
    fuellung: k.gel_fuellung,
    handlauf: k.gel_handlauf,
    oberflaeche: k.oberflaeche,
    cluster: (Math.min(Math.max(Math.round(k.gel_cluster || 0), 0), 3) as 0 | 1 | 2 | 3),
  };
  switch (k.art) {
    case 'stahl_kg':
      return {
        art: 'stahl_kg',
        kg_je_einheit: k.kg_je_einheit,
        oberflaeche: k.oberflaeche,
        montage: k.montage,
        rohr: k.rohr,
        s355: k.s355,
        blech: k.blech ?? false,
        ...(k.bestand ? { bestand: true } : {}),
        ...(k.bestand_h && k.bestand_h > 0 ? { bestand_h: Math.round(k.bestand_h * 10) / 10 } : {}),
        ...(k.geraet_eur && k.geraet_eur > 0 ? { geraet_eur: Math.round(k.geraet_eur) } : {}),
      };
    case 'gelaender_m':
      return { art: 'gelaender_m', parameter: gel };
    case 'treppe_stk':
      return {
        art: 'treppe_stk',
        parameter: {
          ...(k.tr_geschosshoehe_m > 0 ? { geschosshoehe_m: k.tr_geschosshoehe_m } : {}),
          ...(k.tr_laufbreite_m > 0 ? { laufbreite_m: k.tr_laufbreite_m } : {}),
          podest_m2: Math.max(k.tr_podest_m2 || 0, 0),
          gelaender_seiten: (Math.min(Math.max(Math.round(k.tr_gelaender_seiten || 0), 0), 2) as 0 | 1 | 2),
          ...(k.tr_wange ? { wange: k.tr_wange } : {}),
          oberflaeche: k.oberflaeche,
          montage: k.montage,
          gelaender: gel,
        },
      };
    case 'gitterrost_m2':
      return { art: 'gitterrost_m2', montage: k.montage };
    case 'zukauf':
      // Richtwert der KI als Startpreis, die Position bleibt zur Prüfung markiert
      return { art: 'zukauf', einkauf: k.zukauf_richtpreis && k.zukauf_richtpreis > 0 ? k.zukauf_richtpreis : null, aufschlag_prozent: 15, lieferant: k.zukauf_hinweis || undefined };
    case 'stunden':
      return { art: 'stunden', stunden_je_einheit: k.stunden_je_einheit, montage: k.montage };
    case 'prozent_be':
      return { art: 'prozent_be', prozent: k.be_prozent || 5 };
    default:
      return { art: 'manuell', ep: null };
  }
}

export const ART_LABEL: Record<string, string> = {
  baugruppe: 'Nach Zeichnung',
  stahl_kg: 'Stahl nach Gewicht',
  gelaender_m: 'Geländer je m',
  treppe_stk: 'Treppe',
  gitterrost_m2: 'Gitterrost je m²',
  zukauf: 'Zukauf / Fremdleistung',
  stunden: 'Stunden',
  prozent_be: 'Baustelleneinrichtung %',
  manuell: 'Preis von Hand',
};
