import { NextResponse } from 'next/server';
import { supabaseServer, aktuellesProfil } from '@/lib/supabase/server';
import { insArchiv } from '@/lib/archiv';

export const runtime = 'nodejs';

/** Freigegebene Positionen wandern ins Archiv: Die Wissensbasis wächst mit jedem Projekt. */
export async function POST(req: Request) {
  const profil = await aktuellesProfil();
  if (!profil || profil.rolle === 'leser') return NextResponse.json({ fehler: 'Keine Berechtigung.' }, { status: 403 });
  const { projekt_id, ids } = (await req.json()) as { projekt_id: string; ids: string[] };
  if (!projekt_id || !ids?.length) return NextResponse.json({ aufgenommen: 0 });
  const sb = await supabaseServer();
  const n = await insArchiv(sb, projekt_id, ids.slice(0, 500));
  return NextResponse.json({ aufgenommen: n });
}
