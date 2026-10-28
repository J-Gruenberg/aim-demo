import { describe, expect, it } from 'vitest';
import { profile, pruefePosition } from '@/lib/pruefung';

const basis = { oz: '1', menge: 2, einheit: 'Stk', sicherheit: 0.9, status: 'berechnet', typ: 'stahl_kg', quelle: 'ki' };

describe('Prüfbericht gegen das Archiv', () => {
  it('erkennt Profilangaben', () => {
    expect([...profile('Stahlunterzug 2x HEB 200, Trägerlänge 6000 mm')]).toEqual(['HEB200']);
    expect([...profile('Riegel UPE 400 und QRo 180x8')].sort()).toEqual(['QRO180x8', 'UPE400']);
  });

  it('vergleicht Stahl über €/kg statt über den Stückpreis', () => {
    // HEB 240 (998 kg) gegen HEB 200 (736 kg) aus dem Archiv: gleicher €/kg-Satz, also keine Warnung
    const b = pruefePosition({ ...basis, ep: 4413, kurztext: 'Stahlunterzug 2x HEB 240', ansatz: { art: 'stahl_kg', kg_je_einheit: 998, archiv: [{ projekt: 'Schule Archivprojekt', text: 'Stahlunterzug 2x HEB 200', ep: 3250.8, einheit: 'Stk', aehnlichkeit: 0.74, kg_je_einheit: 736 }] } });
    expect(b.filter((x) => x.text.includes('Archivprojekt'))).toHaveLength(0);
  });

  it('warnt bei deutlich anderem €/kg', () => {
    const b = pruefePosition({ ...basis, ep: 2000, kurztext: 'Stahlunterzug 2x HEB 240', ansatz: { art: 'stahl_kg', kg_je_einheit: 998, archiv: [{ projekt: 'Schule Archivprojekt', ep: 4386, einheit: 'Stk', aehnlichkeit: 0.8, kg_je_einheit: 998 }] } });
    expect(b.some((x) => x.text.includes('€/kg') && x.text.includes('Archivprojekt'))).toBe(true);
  });

  it('vergleicht keine Stückpreise über verschiedene Profile', () => {
    const b = pruefePosition({ ...basis, typ: 'stunden', ep: 900, kurztext: 'Stütze HEA 120', ansatz: { art: 'stunden', archiv: [{ projekt: 'Halle', text: 'Stütze HEA 200', ep: 2000, einheit: 'Stk', aehnlichkeit: 0.7 }] } });
    expect(b.some((x) => x.text.includes('Halle'))).toBe(false);
  });

  it('warnt bei gleicher Leistung mit stark abweichendem Preis', () => {
    const b = pruefePosition({ ...basis, typ: 'stunden', ep: 5157, kurztext: 'Senkkasten, Stahl, Aufzug', ansatz: { art: 'stunden', archiv: [{ projekt: 'Schule Archivprojekt', text: 'Senkkasten, Stahl, Aufzug', ep: 8504, einheit: 'Stk', aehnlichkeit: 0.66 }] } });
    expect(b.some((x) => x.text.startsWith('-39 %'))).toBe(true);
  });
});

describe('Prüfbericht bei Arbeit am Bestand', () => {
  it('warnt nicht über hohe €/kg, sondern weist auf den Aufwand vor Ort hin', () => {
    const b = pruefePosition({ oz: '5.1.050', menge: 2, einheit: 'Stck', ep: 853.76, sicherheit: 0.85, status: 'pruefen', typ: 'stahl_kg', ansatz: { art: 'stahl_kg', kg_je_einheit: 66, bestand_h: 6, geraet_eur: 100 } });
    expect(b.some((x) => x.text.includes('sehr hoch'))).toBe(false);
    expect(b.some((x) => x.stufe === 'hinweis' && x.text.includes('6 h vor Ort') && x.text.includes('100 €'))).toBe(true);
  });
});
