import { describe, expect, it } from 'vitest';
import { anwenden, vorschlagAus, type HalleGelesen } from '@/lib/halle-lesen';
import { LEERE_HALLE, berechneHalle, autokranVergleich } from '@/lib/engine/halle';
import { defaultStammdaten } from '@/lib/engine/stammdaten';

const leer: HalleGelesen = {
  objekt: '', kunde: '', ort: '', laenge_m: 0, breite_m: 0, traufhoehe_m: 0, firsthoehe_m: 0, neigung_grad: 0, rahmenabstand_m: 0,
  dachform: 'unbekannt', oberflaeche: 'unbekannt', dach: 'unbekannt', wand: 'unbekannt', wandseiten: 0, tore: [], tueren: 0, fenster: 0,
  lichtkuppeln: 0, lichtkuppeln_rwa: 0, firstlicht_m: 0, vordach_m2: 0, buero_m2: 0, trennwand_m2: 0, aussenanlagen_m2: 0, zaun_m: 0,
  hallenkran: 'unbekannt', kran_traglast_t: 0,
  leistungen: { erdarbeiten: 'unbekannt', statik: 'unbekannt', werkplanung: 'unbekannt', bauantrag: 'unbekannt', baugrund: 'unbekannt', elektro: 'unbekannt', heizung: 'unbekannt', maler: 'unbekannt' },
  fundstellen: [], unsicher: [], fehlend: [], hinweise: [],
};

describe('Halle aus Anfrage', () => {
  it('übersetzt eine Kunden-E-Mail in Vordruck-Eingaben', () => {
    const g: HalleGelesen = {
      ...leer,
      kunde: 'Agrar Müller',
      laenge_m: 15, // vertauscht: Länge ist immer die längere Seite
      breite_m: 30,
      traufhoehe_m: 5,
      firsthoehe_m: 5.79,
      dachform: 'satteldach',
      dach: 'trapez',
      wand: 'trapez',
      tore: [{ anzahl: 2, breite_m: 4, hoehe_m: 4.5, antrieb: true }],
      hallenkran: 'ja',
      kran_traglast_t: 5,
      leistungen: { ...leer.leistungen, erdarbeiten: 'nein', statik: 'ja' },
      fundstellen: [{ feld: 'laenge_m', fundstelle: "E-Mail: '30 x 15 m'" }],
      unsicher: ['traufhoehe_m'],
    };
    const v = vorschlagAus(g);
    const k = Object.fromEntries(v.erkannt.map((x) => [x.key, x]));
    expect(k.laenge.patch.laenge).toBe(30);
    expect(k.breite.patch.breite).toBe(15);
    expect(k.traufhoehe.unsicher).toBe(true);
    expect(k.neigung.patch.neigung).toBeCloseTo(6, 0); // aus Firsthöhe: atan(0,79 / 7,5)
    expect(k.neigung.unsicher).toBe(true);
    expect(k.opt_erdarbeiten.optionen).toEqual({ erdarbeiten: false });
    expect(v.meta.objekt).toBe('Halle 30 × 15 m');
    expect(v.hinweise.some((h) => h.includes('Hallenkran 5 t'))).toBe(true);

    const e = anwenden(LEERE_HALLE, v.erkannt, new Set(v.erkannt.map((x) => x.key).filter((x) => x !== 'kran')));
    expect(e.laenge).toBe(30);
    expect(e.tore).toEqual([{ anzahl: 2, breite: 4, hoehe: 4.5, antrieb: true }]);
    expect(e.optionen.erdarbeiten).toBe(false);
    expect(e.optionen.statik).toBe(true);
    expect(e.kran).toBe(false); // abgewählt
  });

  it('übernimmt nichts, was nicht dasteht', () => {
    const v = vorschlagAus({ ...leer, objekt: 'Unterstand' });
    expect(v.erkannt).toHaveLength(0);
    expect(v.meta.objekt).toBe('Unterstand');
  });

  it('zeigt beim Autokran die Hallen mit ähnlichem Stahlgewicht', () => {
    expect(autokranVergleich(14).map((k) => k.name)).toEqual(['Halle 13 t', 'Halle 16,5 t']);
    const erg = berechneHalle({ ...LEERE_HALLE, kran: true }, defaultStammdaten());
    expect(erg.zeilen.find((z) => z.key === 'autokran')!.herleitung).toContain('ähnliche Hallen');
    expect(erg.hinweise.some((h) => h.startsWith('Hallenkran'))).toBe(true);
  });
});
