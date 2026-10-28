import { describe, expect, it } from 'vitest';
import { bezuege, einheitNorm, mengenAusText } from '@/lib/lv-text';
import { rechnePosition } from '@/lib/engine/bauteile';
import { defaultStammdaten } from '@/lib/engine/stammdaten';

// Aufbau wie ein AVA-Ausdruck: Position über mehrere Seiten, Menge erst am Ende
const lv = [
  '5.1.060 Wie vor, jedoch L= ca. 2,85 m',
  'Menge: 4 Stck EP: ....... GB: .......',
  '5.1.070 Zulage für Brandschutzanstrich F30',
  'Hinweis: siehe Pos. 5.1.030, ca. 4 Stück je Träger',
  'Seite 158',
  'Menge: 25 m EP: ....... GB: .......',
  '5.1.080 Unterkonstruktion für Basketballkorb Typ 1',
  '- 4 Stück je Kopfplatte',
  'Seite 159', 'Seite 160', 'Seite 161',
  'Menge: 4 Stck EP: ....... GB: .......',
  '5.1.090 Unterkonstruktion Typ 2',
  'Menge: 2 Stüc EP: .......',
  '5.1.100 Ohne Mengenzeile',
  '5.1.110 Zwei Mengenzeilen',
  'Menge: 1 Stck', 'Menge: 2 Stck',
  '5.1.120 Sprossenwand',
  'Menge:                 6m           EP: .......',
  '5.1.130 Große Menge',
  'Menge: 1.250,50 m2',
].join('\n');

describe('Mengen aus dem LV-Text', () => {
  it('ordnet jede Menge der Position zu, in der sie steht, auch über Seitengrenzen', () => {
    const m = mengenAusText(lv, ['5.1.060', '5.1.070', '5.1.080', '5.1.090', '5.1.100', '5.1.110', '5.1.120', '5.1.130']);
    expect(m.get('5.1.060')).toEqual({ menge: 4, einheit: 'Stck' });
    expect(m.get('5.1.070')).toEqual({ menge: 25, einheit: 'm' });
    expect(m.get('5.1.080')).toEqual({ menge: 4, einheit: 'Stck' });
    expect(m.get('5.1.090')).toEqual({ menge: 2, einheit: 'Stck' });
    expect(m.has('5.1.100')).toBe(false); // keine Mengenzeile: KI-Wert bleibt
    expect(m.has('5.1.110')).toBe(false); // nicht eindeutig: KI-Wert bleibt
    expect(m.get('5.1.120')).toEqual({ menge: 6, einheit: 'm' });
    expect(m.get('5.1.130')).toEqual({ menge: 1250.5, einheit: 'm²' });
  });

  it('lässt LVs ohne Mengenzeile unverändert', () => {
    expect(mengenAusText('01.02.0010 Träger\n12,000 m', ['01.02.0010']).size).toBe(0);
  });

  it('vereinheitlicht Einheiten', () => {
    expect(['Stüc', 'Stk', 'St.', 'Stück', 'qm', 'm³', 'Std', 'kg'].map(einheitNorm)).toEqual(['Stck', 'Stck', 'Stck', 'Stck', 'm²', 'm³', 'Std', 'kg']);
  });
});

describe('Bezug bei „wie vor“', () => {
  it('findet die Grundposition, auch über mehrere „wie vor“ hinweg, und genannte OZ', () => {
    const p = (id: string, oz: string, kurztext: string, langtext = '') => ({ id, oz, kurztext, langtext });
    const liste = [
      p('a', '5.1.050', 'Stützenverlängerung aus Stahl, 1/2 IPE 240', 'an vorhandene Stütze anschweißen'),
      p('b', '5.1.060', 'Wie vor, jedoch L= ca. 2,85 m'),
      p('c', '5.1.070', 'Zulage für Brandschutzanstrich F30'),
      p('d', '5.1.160', 'Stahlunterkonstruktion (L-Form), HEB 160'),
      p('e', '5.1.170', 'Wie vor, jedoch wie vor jedoch Typ 2'),
      p('f', '5.1.180', 'Wie vor, jedoch wie vor jedoch Typ 3'),
      p('g', '5.1.200', 'Brandschutz', 'Ausführung wie Pos. 5.1.070, jedoch R60'),
    ];
    const b = bezuege(liste);
    expect(b.get('b')?.oz).toBe('5.1.050');
    expect(b.get('e')?.oz).toBe('5.1.160');
    expect(b.get('f')?.oz).toBe('5.1.160');
    expect(b.get('g')?.oz).toBe('5.1.070');
    expect(b.has('a')).toBe(false);
    expect(b.has('c')).toBe(false);
  });
});

describe('Stahl am Bestand', () => {
  it('rechnet Stunden vor Ort und Hebebühne zusätzlich zum Gewicht', () => {
    const st = defaultStammdaten();
    const ohne = rechnePosition({ art: 'stahl_kg', kg_je_einheit: 66, oberflaeche: 'grundiert', montage: true }, 2, st);
    const mit = rechnePosition({ art: 'stahl_kg', kg_je_einheit: 66, oberflaeche: 'grundiert', montage: true, bestand_h: 10, geraet_eur: 200 }, 2, st);
    expect(mit.ep! - ohne.ep!).toBeCloseTo(10 * st.satz_montage + 200, 1);
    expect(mit.bausteine.some((b) => b.text.startsWith('Arbeiten am Bestand 10 h'))).toBe(true);
    expect(mit.bausteine.some((b) => b.text === 'Hebebühne / Gerät')).toBe(true);
  });
});

describe('Montage am Bestand', () => {
  it('rechnet die Montage mit dem Bestandsfaktor statt mit dem Neubaufaktor', () => {
    const st = defaultStammdaten();
    const neu = rechnePosition({ art: 'stahl_kg', kg_je_einheit: 136, oberflaeche: 'grundiert', montage: true }, 2, st);
    const alt = rechnePosition({ art: 'stahl_kg', kg_je_einheit: 136, oberflaeche: 'grundiert', montage: true, bestand: true }, 2, st);
    const m = (r: typeof neu) => r.bausteine.find((b) => b.text.startsWith('Montage'))!;
    expect(m(alt).text).toContain('am Bestand');
    expect(m(alt).betrag / m(neu).betrag).toBeCloseTo(st.kg_montage_faktor_bestand / st.kg_montage_faktor, 1);
    expect(alt.ep!).toBeGreaterThan(neu.ep!);
  });
});
