import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Lernschleife: Korrigiert der Kalkulator Preise einer Ansatzart wiederholt in dieselbe Richtung,
 * entsteht ein Vorschlag für den Erfahrungsfaktor dieser Art. Nie automatisch übernommen.
 */
const ART_KEY: Record<string, { key: string; name: string }> = {
  stahl_kg: { key: 'faktor_stahl_kg', name: 'Stahlpositionen nach Gewicht' },
  gelaender_m: { key: 'faktor_gelaender_m', name: 'Geländerpreise' },
  treppe_stk: { key: 'faktor_treppe_stk', name: 'Treppenpreise' },
  gitterrost_m2: { key: 'faktor_gitterrost_m2', name: 'Gitterrostpreise' },
  stunden: { key: 'faktor_stunden', name: 'Positionen nach Aufwand' },
};
const MINDEST_FAELLE = 5;
const MINDEST_ABWEICHUNG = 0.04;

const median = (l: number[]) => {
  const s = [...l].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export async function vorschlaegeAktualisieren(sb: SupabaseClient) {
  const seit = new Date(Date.now() - 180 * 86400_000).toISOString();
  const { data: aend } = await sb
    .from('aenderungen')
    .select('position_id,alt,neu,grund,created_at')
    .eq('feld', 'ep')
    .not('position_id', 'is', null)
    .gte('created_at', seit)
    .order('created_at', { ascending: false })
    .limit(2000);
  const letzte = new Map<string, { alt: number; neu: number }>();
  for (const a of aend ?? []) {
    if ((a.grund ?? '').startsWith('Neu gerechnet')) continue;
    const alt = Number(a.alt);
    const neu = Number(a.neu);
    if (!(alt > 0 && neu > 0) || letzte.has(a.position_id)) continue;
    // erste (älteste) Ausgangslage zählt nicht, nur die letzte Korrektur je Position
    letzte.set(a.position_id, { alt, neu });
  }
  if (!letzte.size) return 0;
  const { data: pos } = await sb.from('positionen').select('id,ansatz').in('id', [...letzte.keys()]);
  const jeArt = new Map<string, number[]>();
  for (const p of pos ?? []) {
    const art = (p.ansatz as { art?: string } | null)?.art;
    if (!art || !ART_KEY[art]) continue;
    const k = letzte.get(p.id)!;
    const q = k.neu / k.alt;
    if (q < 0.5 || q > 2) continue; // Ausreißer (Tippfehler, andere Leistung) nicht lernen
    jeArt.set(art, [...(jeArt.get(art) ?? []), q]);
  }
  const { data: stamm } = await sb.from('stammdaten').select('schluessel,wert').like('schluessel', 'faktor_%');
  const { data: offen } = await sb.from('stammdaten_vorschlaege').select('id,schluessel,status,neu,created_at').in('status', ['offen', 'verworfen']);
  let n = 0;
  for (const [art, qs] of jeArt) {
    if (qs.length < MINDEST_FAELLE) continue;
    const m = median(qs);
    if (Math.abs(m - 1) < MINDEST_ABWEICHUNG) continue;
    const { key, name } = ART_KEY[art];
    const aktuell = Number(stamm?.find((s) => s.schluessel === key)?.wert ?? 1);
    const neu = Math.round(aktuell * m * 100) / 100;
    const prozent = Math.round((m - 1) * 100);
    const begruendung = `Sie haben ${qs.length} ${name} im Schnitt um ${prozent > 0 ? '+' : ''}${prozent} % korrigiert. Vorschlag: Erfahrungsfaktor von ${String(aktuell).replace('.', ',')} auf ${String(neu).replace('.', ',')}.`;
    const kuerzlichVerworfen = (offen ?? []).some((o) => o.schluessel === key && o.status === 'verworfen' && Number(o.neu) === neu && Date.now() - new Date(o.created_at).getTime() < 30 * 86400_000);
    if (kuerzlichVerworfen) continue;
    const bestehend = (offen ?? []).find((o) => o.schluessel === key && o.status === 'offen');
    if (bestehend) await sb.from('stammdaten_vorschlaege').update({ alt: aktuell, neu, begruendung, faelle: qs.length }).eq('id', bestehend.id);
    else await sb.from('stammdaten_vorschlaege').insert({ schluessel: key, alt: aktuell, neu, begruendung, faelle: qs.length });
    n++;
  }
  return n;
}
