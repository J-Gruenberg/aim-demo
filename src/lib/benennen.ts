import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Titel, die beim Anlegen vergeben werden. Solange einer davon dasteht, darf AIM das Projekt selbst benennen. */
export const STANDARD_TITEL = ['Neue Ausschreibung', 'Neue Anfrage nach Zeichnung', 'Neues Angebot Bauteile', 'Neue Halle', 'Neue Kalkulation'];

const sauber = (t: string | null | undefined, max: number) =>
  (t ?? '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,.;:]+|[\s,.;:]+$/g, '')
    .slice(0, max)
    .trim();

/**
 * Benennt ein Projekt aus den Unterlagen. Der Titel wird nur ersetzt, solange er noch der Standardtitel ist
 * oder AIM ihn selbst gesetzt hat (ergebnis.titel_auto). Kunde und Baustelle nur, wenn sie leer sind.
 * Was der Nutzer selbst eingetragen hat, bleibt immer stehen.
 */
export async function automatischBenennen(
  sb: SupabaseClient,
  projektId: string,
  vorschlag: { titel?: string | null; kunde?: string | null; ort?: string | null },
  opt: { nurStandard?: boolean } = {},
) {
  const { data: p } = await sb.from('projekte').select('titel,kunde,ort,ergebnis').eq('id', projektId).maybeSingle();
  if (!p) return null;
  const patch: { titel?: string; kunde?: string; ort?: string } = {};
  const titel = sauber(vorschlag.titel, 120);
  const auto = (p.ergebnis as { titel_auto?: string } | null)?.titel_auto;
  if (titel.length >= 3 && titel !== p.titel && (STANDARD_TITEL.includes(p.titel) || (!opt.nurStandard && p.titel === auto))) patch.titel = titel;
  const kunde = sauber(vorschlag.kunde, 120);
  if (kunde && !p.kunde) patch.kunde = kunde;
  const ort = sauber(vorschlag.ort, 120);
  if (ort && !p.ort) patch.ort = ort;
  if (!Object.keys(patch).length) return null;
  await sb.from('projekte').update(patch).eq('id', projektId);
  if (patch.titel) await sb.rpc('ergebnis_setzen', { p_id: projektId, p_schluessel: 'titel_auto', p_wert: patch.titel });
  return patch;
}
