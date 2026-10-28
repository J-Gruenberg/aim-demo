import { describe, it, expect } from 'vitest';
import { berechneHalle, LEERE_HALLE } from '../src/lib/engine/halle';
import { defaultStammdaten } from '../src/lib/engine/stammdaten';
import { gelaenderJeM, GELAENDER_STANDARD, treppeJeStk, TREPPE_STANDARD, stahlJeKg, rechnePosition } from '../src/lib/engine/bauteile';
import { metergewicht } from '../src/lib/engine/profile';

const stamm = defaultStammdaten();

describe('Hallen-Vordruck', () => {
  it('rechnet eine Halle 45 × 18 × 4,5 m plausibel', () => {
    const e = { ...LEERE_HALLE, laenge: 45, breite: 18, traufhoehe: 4.5, neigung: 5, rahmenabstand: 7.5, tore: [{ anzahl: 2, breite: 3.5, hoehe: 3.5, antrieb: false }], tueren: 3, fenster: 10, buero_m2: 120, optionen: { ...LEERE_HALLE.optionen, elektro: true, heizung: true } };
    const r = berechneHalle(e, stamm, [{ name: '5f', breite: 12, traufhoehe: 4.5, grundflaeche: 480, stahl_kg: 10547 }, { name: 'Nordgut', breite: 25.8, traufhoehe: 4.2, grundflaeche: 1409, stahl_kg: 28487 }]);
    console.log(r.zeilen.filter((z) => z.aktiv).map((z) => `${z.bezeichnung}: ${z.menge} ${z.einheit} × ${z.ep} = ${z.gp}`).join('\n'));
    console.log('Summe', r.summe_netto, 'Angebot', r.angebot_gerundet, 'Stahl', r.stahl);
    expect(r.geometrie.grundflaeche).toBe(810);
    expect(r.geometrie.rahmen).toBe(7);
    expect(r.angebot_gerundet % 100).toBe(0);
  });
  it('manuelle Menge überschreibt', () => {
    const e = { ...LEERE_HALLE, manuell: { pfetten: { menge: 100 } } };
    const r = berechneHalle(e, stamm, []);
    expect(r.zeilen.find((z) => z.key === 'pfetten')!.menge).toBe(100);
  });
});

describe('Bauteile', () => {
  it('Profile', () => {
    expect(metergewicht('IPE 200')).toBe(22.4);
    expect(metergewicht('Fl 70x10')!).toBeCloseTo(5.5, 1);
    expect(metergewicht('HEA200')).toBe(42.3);
  });
  it('Geländer', () => {
    const r = gelaenderJeM(GELAENDER_STANDARD, stamm);
    console.log('Geländer', r);
    expect(r.ep).toBeGreaterThan(200);
    expect(r.ep).toBeLessThan(600);
  });
  it('Treppe', () => {
    const r = treppeJeStk(TREPPE_STANDARD, stamm);
    console.log('Treppe', r);
    expect(r.details.stufen).toBe(16);
  });
  it('Stahl je kg', () => {
    const r = stahlJeKg({ kg_gesamt: 2000, oberflaeche: 'verzinkt', montage: true }, stamm);
    console.log('Stahl kg', r);
    expect(r.ep).toBeGreaterThan(3);
    expect(r.ep).toBeLessThan(6);
    const p = rechnePosition({ art: 'stahl_kg', kg_je_einheit: 250, oberflaeche: 'verzinkt', montage: true }, 4, stamm);
    expect(p.kg_gesamt).toBe(1000);
  });
});
