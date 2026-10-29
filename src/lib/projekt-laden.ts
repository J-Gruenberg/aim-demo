import 'server-only';
import { supabaseServer, aktuellesProfil } from '@/lib/supabase/server';
import { ladeStammdaten } from '@/lib/daten';
import type { Datei, Position } from '@/components/positionen/typen';

export async function ladePositionsProjekt(id: string, typ: 'lv' | 'bauteil' | 'zeichnung') {
  const sb = await supabaseServer();
  const { data: p } = await sb.from('projekte').select('*').eq('id', id).maybeSingle();
  if (!p || p.typ !== typ) return null;
  const [{ data: pos }, { data: dateien }, { werte }, profil] = await Promise.all([
    sb.from('positionen').select('*').eq('projekt_id', id).order('sort'),
    sb.from('dateien').select('*').eq('projekt_id', id).order('created_at'),
    ladeStammdaten(sb),
    aktuellesProfil(),
  ]);
  return {
    projekt: p,
    positionen: (pos ?? []) as Position[],
    dateien: (dateien ?? []) as Datei[],
    stamm: werte,
    darfSchreiben: profil?.rolle !== 'leser',
  };
}

/** Projektname für den Browser-Tab. */
export async function projektTitel(id: string) {
  const sb = await supabaseServer();
  const { data } = await sb.from('projekte').select('titel').eq('id', id).maybeSingle();
  return { title: data?.titel ?? 'Kalkulation' };
}
