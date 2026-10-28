/**
 * Deterministische Plausibilitätsprüfungen je Position (ohne KI, sofort, kostenlos).
 * Grenzen sind bewusst weit gefasst: Sie sollen Ausreißer finden, nicht jede Position anmeckern.
 */
import { GELAENDER_STANDARD, gelaenderKgM, type GelaenderParameter } from '@/lib/engine/bauteile';

export type Befund = { stufe: 'warnung' | 'hinweis'; text: string };

type PosLike = {
  oz: string | null;
  menge: number | null;
  einheit: string | null;
  ep: number | null;
  sicherheit: number | null;
  status: string;
  typ: string | null;
  quelle?: string | null;
  ansatz: {
    art?: string;
    kg_je_einheit?: number;
    bestand?: boolean;
    bestand_h?: number;
    geraet_eur?: number;
    parameter?: Partial<GelaenderParameter>;
    ausgeblendet?: boolean;
    bedarf?: boolean;
    alternativ?: boolean;
    archiv?: { projekt: string; text?: string; ep: number | null; einheit: string | null; aehnlichkeit: number; kg_je_einheit?: number | null }[];
    gleich_wie?: string;
  } | null;
  kurztext?: string | null;
  langtext?: string | null;
};

const prozent = (a: number, b: number) => Math.round(((a - b) / b) * 100);

/** Profilangaben wie „HEB 200“, „IPE 240“, „UPE 400“, „QRo 180x8“: unterscheiden sich die, ist der Preisvergleich sinnlos. */
export function profile(t: string | null | undefined) {
  const s = new Set<string>();
  for (const m of (t ?? '').matchAll(/\b(HE[ABM]|IPE|UPE|UPN|U|HEB|QRo|RRo|Ro|L|Fl)\s?(\d{2,3}(?:\s?[x/]\s?\d{1,3})?)/gi)) s.add(`${m[1].toUpperCase()}${m[2].replace(/\s/g, '')}`);
  return s;
}
export const gleicheProfile = (a: Set<string>, b: Set<string>) => !a.size || !b.size || [...a].some((x) => b.has(x));
const komma = (x: number) => x.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function pruefePosition(p: PosLike): Befund[] {
  const b: Befund[] = [];
  const a = p.ansatz ?? {};
  if (p.typ === 'fremd' || a.ausgeblendet) return b;
  if (p.status === 'offen') return b;
  if (!p.menge || p.menge <= 0) b.push({ stufe: 'warnung', text: 'Menge fehlt oder ist 0.' });
  if (p.ep === null) b.push({ stufe: 'warnung', text: 'Kein Einzelpreis.' });
  if (p.sicherheit !== null && p.sicherheit < 0.6 && p.quelle !== 'hand') b.push({ stufe: 'warnung', text: `Die KI ist unsicher (${Math.round(p.sicherheit * 100)} %). Ansatz bitte prüfen.` });

  if (a.art === 'stahl_kg' && p.ep !== null && a.kg_je_einheit && a.kg_je_einheit > 0) {
    const eurKg = p.ep / a.kg_je_einheit;
    // Arbeiten am Bestand und Hebebühne hängen nicht am Gewicht: dann ist ein hoher €/kg-Wert gewollt
    const bestand = !!a.bestand || (a.bestand_h ?? 0) > 0 || (a.geraet_eur ?? 0) > 0;
    if (eurKg < 2.8) b.push({ stufe: 'warnung', text: `Nur ${eurKg.toFixed(2).replace('.', ',')} €/kg. Üblich sind bei Ihnen etwa 3,50 bis 6 €/kg.` });
    if (eurKg > 9 && !bestand) b.push({ stufe: 'warnung', text: `${eurKg.toFixed(2).replace('.', ',')} €/kg ist sehr hoch. Gewicht je Einheit prüfen.` });
    if (bestand) b.push({ stufe: 'hinweis', text: `Montage am Bestand${a.bestand_h ? `, dazu ${String(a.bestand_h).replace('.', ',')} h vor Ort` : ''}${a.geraet_eur ? ` und ${Math.round(a.geraet_eur)} € Hebebühne` : ''} je Einheit. Aufwand vor Ort bitte prüfen.` });
    if (/^(stk|stck|st|psch)$/i.test(p.einheit ?? '') && a.kg_je_einheit > 15000) b.push({ stufe: 'hinweis', text: `${Math.round(a.kg_je_einheit)} kg je Stück ist ungewöhnlich schwer.` });
  }
  if (a.art === 'gelaender_m') {
    if (p.ep !== null && (p.ep < 140 || p.ep > 700)) b.push({ stufe: 'warnung', text: `Geländer mit ${Math.round(p.ep)} €/m liegt außerhalb des üblichen Rahmens (140 bis 700 €/m).` });
    try {
      const { kg } = gelaenderKgM({ ...GELAENDER_STANDARD, ...(a.parameter ?? {}) } as GelaenderParameter);
      if (kg < 6 || kg > 50) b.push({ stufe: 'hinweis', text: `Gewicht ${kg.toFixed(1).replace('.', ',')} kg/m ist ungewöhnlich, Profile prüfen.` });
    } catch {
      // Parameter unvollständig: keine Gewichtsprüfung
    }
  }
  if (a.art === 'treppe_stk' && p.ep !== null && (p.ep < 1500 || p.ep > 60000)) b.push({ stufe: 'hinweis', text: `Treppe mit ${Math.round(p.ep)} € je Stück, bitte Geschosshöhe und Umfang prüfen.` });

  // Abgleich mit dem Archiv: sehr ähnliche Position mit deutlich anderem Preis.
  // Stahl mit bekanntem Gewicht wird über €/kg verglichen, sonst nur bei gleicher Einheit und gleichen Profilen.
  if (p.ep !== null) {
    const eigene = profile(`${p.kurztext ?? ''} ${p.langtext ?? ''}`);
    const kgEigen = a.art === 'stahl_kg' && !(a.bestand || (a.bestand_h ?? 0) > 0 || (a.geraet_eur ?? 0) > 0) ? a.kg_je_einheit : undefined;
    for (const t of (a.archiv ?? []).filter((x) => x.aehnlichkeit >= 0.6 && x.ep)) {
      if (kgEigen && t.kg_je_einheit) {
        const ich = p.ep / kgEigen;
        const dort = t.ep! / t.kg_je_einheit;
        const d = prozent(ich, dort);
        if (Math.abs(d) >= 25) b.push({ stufe: 'warnung', text: `${komma(ich)} €/kg, bei „${t.projekt}“ waren es ${komma(dort)} €/kg (${d > 0 ? '+' : ''}${d} %).` });
        break;
      }
      const gleicheEinheit = (t.einheit ?? '').toLowerCase().slice(0, 2) === (p.einheit ?? '').toLowerCase().slice(0, 2);
      if (!gleicheEinheit || !gleicheProfile(eigene, profile(t.text))) continue;
      const d = prozent(p.ep, t.ep!);
      if (Math.abs(d) >= 25) b.push({ stufe: 'warnung', text: `${d > 0 ? '+' : ''}${d} % gegenüber einer sehr ähnlichen Position aus „${t.projekt}“ (${komma(t.ep!)} €).` });
      break;
    }
  }
  return b;
}

export function pruefbericht<T extends PosLike>(liste: T[]) {
  const je = liste.map((p) => ({ p, befunde: pruefePosition(p) })).filter((x) => x.befunde.length);
  return { je, warnungen: je.filter((x) => x.befunde.some((f) => f.stufe === 'warnung')).length, hinweise: je.length };
}
