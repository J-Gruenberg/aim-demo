import type { SupabaseClient } from '@supabase/supabase-js';

/** Briefkopf und Stammdaten des Betriebs. In der Vorführung live auf den Interessenten umstellbar (Seite „Betrieb“). */
export type Betrieb = {
  firma: string;
  kurz: string;
  strasse: string;
  ort: string;
  tel: string;
  fax: string;
  web: string;
  mail: string;
  zeilen: string[];
  leistungen: string[];
  fuss: string[];
  einleitung: string;
  schluss: string;
};

export const BETRIEB_STANDARD: Betrieb = {
  firma: 'Beispiel Metallbau GmbH',
  kurz: 'Beispiel Metallbau',
  strasse: 'Musterstraße 1',
  ort: '12345 Musterstadt',
  tel: '',
  fax: '',
  web: '',
  mail: '',
  zeilen: ['Schweißfachbetrieb nach DIN EN 1090, EXC2'],
  leistungen: ['Stahlkonstruktionen', 'Treppen + Geländer', 'Hallenbau', 'Blechbearbeitung'],
  fuss: ['Beispiel Metallbau GmbH, Musterstraße 1, 12345 Musterstadt', 'Vorführ-Briefbogen: In Ihrer AIM-Instanz stehen hier Ihre Bankverbindung und Registerangaben.'],
  einleitung:
    'Wir danken Ihnen für Ihre Anfrage und bieten Ihnen auf Grundlage der übergebenen Zeichnungen und Unterlagen die folgenden Leistungen an. Alle Preise sind freibleibend und gelten 6 Wochen.',
  schluss: 'Für Rückfragen stehen wir Ihnen gern zur Verfügung.',
};

export async function ladeBetrieb(sb: SupabaseClient): Promise<Betrieb> {
  const { data } = await sb.from('betrieb').select('daten').eq('id', 1).maybeSingle();
  const d = (data?.daten ?? {}) as Partial<Betrieb>;
  const b = { ...BETRIEB_STANDARD };
  for (const k of Object.keys(BETRIEB_STANDARD) as (keyof Betrieb)[]) {
    const v = d[k];
    if (v === undefined || v === null) continue;
    if (Array.isArray(BETRIEB_STANDARD[k])) (b as Record<string, unknown>)[k] = Array.isArray(v) ? v.filter(Boolean) : [];
    else (b as Record<string, unknown>)[k] = String(v);
  }
  if (!b.kurz) b.kurz = b.firma.replace(/\s+(GmbH|AG|KG|e\.K\.|GmbH & Co\. KG|UG.*)$/i, '');
  return b;
}
