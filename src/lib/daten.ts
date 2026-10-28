import type { SupabaseClient } from '@supabase/supabase-js';
import { defaultStammdaten, type Stammdaten } from './engine/stammdaten';
import type { ReferenzPunkt } from './engine/halle';

export type StammdatumZeile = {
  schluessel: string;
  gruppe: string;
  bezeichnung: string;
  wert: number | null;
  einheit: string | null;
  quelle: string | null;
  bestaetigt: boolean;
  notiz: string | null;
  sort: number;
  updated_at: string;
};

export async function ladeStammdaten(sb: SupabaseClient): Promise<{ werte: Stammdaten; zeilen: StammdatumZeile[] }> {
  const { data } = await sb.from('stammdaten').select('*').order('sort');
  const zeilen = (data ?? []) as StammdatumZeile[];
  const werte = defaultStammdaten();
  for (const z of zeilen) if (z.wert !== null && z.wert !== undefined) werte[z.schluessel] = Number(z.wert);
  return { werte, zeilen };
}

export type Referenz = {
  id: string;
  typ: 'halle' | 'lv' | 'bauteil' | 'zeichnung';
  name: string;
  datum: string | null;
  kunde: string | null;
  angebot_nr: string | null;
  angebot_netto: number | null;
  daten: Record<string, unknown>;
  quelle: string | null;
};

export async function ladeReferenzen(sb: SupabaseClient, typ?: Referenz['typ']): Promise<Referenz[]> {
  let q = sb.from('referenzen').select('*').order('datum', { ascending: false, nullsFirst: false });
  if (typ) q = q.eq('typ', typ);
  const { data } = await q;
  return (data ?? []) as Referenz[];
}

const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);

export function referenzPunkte(refs: Referenz[]): ReferenzPunkt[] {
  return refs
    .filter((r) => r.typ === 'halle' && !r.daten.nicht_fuer_stahl)
    .map((r) => ({
      name: r.name,
      breite: num(r.daten.breite_m),
      traufhoehe: num(r.daten.traufhoehe_m),
      grundflaeche: num(r.daten.grundflaeche_m2) || num(r.daten.laenge_m) * num(r.daten.breite_m),
      stahl_kg: num(r.daten.stahl_kg),
      kran: Array.isArray(r.daten.umfang) && (r.daten.umfang as string[]).includes('kran'),
      datum: r.datum,
    }))
    .filter((p) => Number.isFinite(p.breite) && Number.isFinite(p.grundflaeche) && Number.isFinite(p.stahl_kg) && p.stahl_kg > 0);
}
