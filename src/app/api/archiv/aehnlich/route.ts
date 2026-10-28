import { NextResponse } from 'next/server';
import { supabaseServer, aktuellesProfil } from '@/lib/supabase/server';
import { aehnlicheFuer } from '@/lib/archiv';

export const runtime = 'nodejs';

/** Ähnliche Positionen aus dem Archiv für eine Position (Seitenansicht). */
export async function GET(req: Request) {
  const profil = await aktuellesProfil();
  if (!profil) return NextResponse.json({ fehler: 'Keine Berechtigung.' }, { status: 403 });
  const id = new URL(req.url).searchParams.get('position_id');
  if (!id) return NextResponse.json({ treffer: [] });
  const sb = await supabaseServer();
  const { data: p } = await sb.from('positionen').select('id,projekt_id,kurztext,langtext').eq('id', id).single();
  if (!p) return NextResponse.json({ treffer: [] });
  const r = await aehnlicheFuer(sb, [p], p.projekt_id, 5, 0.35);
  return NextResponse.json({
    treffer: (r[p.id] ?? []).map((t) => ({ projekt: t.projekt, datum: t.datum, text: t.text.slice(0, 220), ep: t.ep, einheit: t.einheit, menge: t.menge, kg_je_einheit: t.kg_je_einheit, aehnlichkeit: Math.round(t.aehnlichkeit * 100) / 100, quelle: t.quelle })),
  });
}
