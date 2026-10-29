import 'server-only';
import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Gedächtnis der KI: Dieselbe Unterlage liefert immer dieselbe Lesung und damit denselben Preis.
 * Der Schlüssel hängt am Inhalt (nicht am Projekt) und an der Version des Prompts:
 * Ändert sich der Prompt, wird neu gelesen, sonst nie von selbst.
 */

export const hash = (s: string | Buffer) => createHash('sha256').update(s).digest('hex');

/** Version aus Prompt und Schema: jede Änderung daran macht alte Lesungen ungültig. */
export const version = (...teile: unknown[]) => hash(teile.map((t) => (typeof t === 'string' ? t : JSON.stringify(t))).join('\u0000')).slice(0, 12);

/**
 * Fingerabdruck einer Zeichnungsseite: der normalisierte Text der Seite, wenn sie genug Text hat
 * (dann ist auch ein neuer PDF-Export derselben Zeichnung derselbe Abdruck), sonst die Datei plus Blatt.
 */
export function seitenAbdruck(datei: Buffer, seite: number, seitenText?: string | null) {
  const text = (seitenText ?? '').replace(/\s+/g, ' ').trim();
  return text.length >= 200 ? `text:${hash(text)}` : `datei:${hash(datei)}:${seite}`;
}

export async function erinnern<T>(sb: SupabaseClient, schluessel: string): Promise<{ daten: T; seiten: number | null } | null> {
  const { data } = await sb.from('ki_gedaechtnis').select('daten,seiten').eq('schluessel', schluessel).maybeSingle();
  return data ? { daten: data.daten as T, seiten: data.seiten as number | null } : null;
}

export async function merken(sb: SupabaseClient, schluessel: string, art: string, daten: unknown, opt: { seiten?: number | null; modell?: string | null } = {}) {
  await sb.from('ki_gedaechtnis').upsert({ schluessel, art, daten, seiten: opt.seiten ?? null, modell: opt.modell ?? null, updated_at: new Date().toISOString() });
}
