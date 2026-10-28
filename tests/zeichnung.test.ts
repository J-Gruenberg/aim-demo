import { describe, expect, it } from 'vitest';
import { baugruppeRechnen, teilart, zuschlagskalkulation, type BaugruppeAnsatz } from '../src/lib/engine/zeichnung';
import { defaultStammdaten } from '../src/lib/engine/stammdaten';

describe('Zuschlagskalkulation wie ERP-Kalkulationsschema', () => {
  it('rechnet ein ERP-Beispiel auf den Cent nach (MGK 5, FGK 100, VwGK 16, VtGK 13, Gewinn 12, Skonto 3)', () => {
    const stamm = { ...defaultStammdaten(), zs_mgk: 5, zs_fgk: 100, zs_vwgk: 16, zs_vtgk: 13, zs_gewinn: 12, zs_skonto: 3 };
    const z = zuschlagskalkulation(2.557, 7.33, 2.92 + 0.05, stamm);
    expect(z.hk).toBeCloseTo(20.31485, 4);
    expect(z.sk).toBeCloseTo(26.20616, 4);
    expect(z.bvp).toBeCloseTo(29.3509, 3);
    expect(z.zvp).toBeCloseTo(30.25866, 4);
  });
});

describe('Teilearten aus der Stückliste', () => {
  const t = (profil: string, bezeichnung = '', gewicht_kg: number | null = 10, stk = 1) => teilart({ profil, bezeichnung, gewicht_kg, stk });
  it('erkennt Profile, Bleche, Kleinteile und Kaufteile', () => {
    expect(t('HEB240', 'Traeger', 400)).toBe('profil_schwer');
    expect(t('IPE 300', 'Träger', 200)).toBe('profil_schwer');
    expect(t('HEB140', 'Stütze', 60)).toBe('profil_leicht');
    expect(t('L80*8', 'Winkel', 5)).toBe('profil_leicht');
    expect(t('U220', 'Riegel', 60)).toBe('profil_leicht');
    expect(t('ROHR219.1*10', 'Rohr', 100)).toBe('profil_leicht');
    expect(t('BL20*200*300', 'Stirnplatte', 9.4)).toBe('blech_dick');
    expect(t('BL10*150*250', 'Steife', 2.9)).toBe('blech');
    expect(t('BL5*80*80', 'Futterblech', 0.25)).toBe('kleinteil');
    expect(t('M20x60 10.9', 'HV-Garnitur', 0.4)).toBe('kaufteil');
    expect(t('FL 60x10', 'Lasche', 2)).toBe('profil_leicht');
  });
});

describe('Baugruppe nach Zeichnung', () => {
  const traeger: BaugruppeAnsatz = {
    art: 'baugruppe',
    zeichnung: 'Test 01',
    gewicht_zeichnung_kg: 497.06,
    teile: [
      { pos: '1', stk: 1, bezeichnung: 'Träger', profil: 'HEB240', werkstoff: 'S355J2', laenge_mm: 5035, gewicht_kg: 418.91 },
      { pos: '2', stk: 2, bezeichnung: 'Stirnplatte', profil: 'BL25*270*425', werkstoff: 'S355J2', laenge_mm: 425, gewicht_kg: 45.04 },
      { pos: '3', stk: 4, bezeichnung: 'Steife', profil: 'BL10*110*206', werkstoff: 'S355J2', laenge_mm: 206, gewicht_kg: 7.11 },
      { pos: '4', stk: 2, bezeichnung: 'Lasche', profil: 'BL15*120*220', werkstoff: 'S355J2', laenge_mm: 220, gewicht_kg: 6.0 },
    ],
    merkmale: { schweissbaugruppe: true, bohrungen_profil: 0, bohrungen_blech: 16, naht_m: 4.2, hv_naht_m: 1.9, kantungen: 0, oberflaeche: 'beschichtet' },
  };

  it('rechnet Verrechnungssatz-Betrieb (65 €/h, 1.000 €/t, keine Zuschläge) nachvollziehbar', () => {
    const stamm: Record<string, number> = { ...defaultStammdaten(), stahl_einkauf_kg: 1, blech_einkauf_kg: 1, zs_mgk: 0, zs_fgk: 0, zs_vwgk: 0, zs_vtgk: 0, zs_gewinn: 0, zs_skonto: 0 };
    for (const k of ['ks_saegen', 'ks_brennen', 'ks_bohren', 'ks_kanten', 'ks_schlosser', 'ks_schweissen', 'ks_hilfs', 'ks_montage']) stamm[k] = 65;
    const r = baugruppeRechnen({ ...traeger, merkmale: { ...traeger.merkmale, oberflaeche: 'roh' } }, stamm);
    expect(r.kennzahlen.kg).toBeCloseTo(477.06, 1);
    expect(r.kennzahlen.teile).toBe(9);
    // 0,30 Sägen + 6 × 0,08 + 2 × 0,12 + 16 × 0,03 + 8 × 0,25 + 4,2 × 0,18 + 1,9 × 0,324 + 0,5 + 0,477 × 1,5
    const h = 0.3 + 6 * 0.08 + 2 * 0.12 + 16 * 0.03 + 8 * 0.25 + 4.2 * 0.18 + 1.9 * 0.18 * 1.8 + 0.5 + 0.47706 * 1.5;
    expect(r.h_je_einheit).toBeCloseTo(h, 2);
    const material = 418.91 * 1.05 + (45.04 + 7.11 + 6.0) * 1.15;
    expect(r.ep).toBeCloseTo(material + h * 65, 0);
    expect(r.hinweise.some((x) => x.includes('Abweichung'))).toBe(true); // Stückliste 477 kg gegen 497 kg laut Zeichnung
  });

  it('Beispielbetrieb: Zuschläge und Fremdleistung landen im Preis, Bausteine ergeben den Einzelpreis', () => {
    const r = baugruppeRechnen(traeger, defaultStammdaten());
    const summe = r.bausteine.reduce((s, b) => s + b.betrag, 0);
    expect(Math.abs(summe - r.ep)).toBeLessThan(0.1);
    expect(r.kennzahlen.fremd).toBeGreaterThan(0);
    expect(r.kennzahlen.eur_kg).toBeGreaterThan(2.5);
    expect(r.kennzahlen.eur_kg).toBeLessThan(8);
  });
});
