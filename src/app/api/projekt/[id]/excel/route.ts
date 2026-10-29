import { NextResponse } from 'next/server';
import { supabaseServer, aktuellesProfil } from '@/lib/supabase/server';
import { ladeReferenzen, ladeStammdaten, referenzPunkte } from '@/lib/daten';
import { baueKalkulationsExcel } from '@/lib/excel/kalkulation-excel';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await aktuellesProfil())) return NextResponse.json({ fehler: 'Bitte anmelden.' }, { status: 401 });
  const sb = await supabaseServer();
  const { data: p } = await sb.from('projekte').select('*').eq('id', id).maybeSingle();
  if (!p) return NextResponse.json({ fehler: 'Nicht gefunden.' }, { status: 404 });

  const halle = p.typ === 'halle';
  const [{ werte }, refs, pos] = await Promise.all([
    ladeStammdaten(sb),
    halle ? ladeReferenzen(sb, 'halle') : Promise.resolve([]),
    halle ? Promise.resolve({ data: [] as unknown[] }) : sb.from('positionen').select('*').eq('projekt_id', id).order('sort'),
  ]);

  const buf = await baueKalkulationsExcel({
    projekt: p,
    positionen: (pos.data ?? []) as unknown[],
    stamm: werte,
    referenzen: halle ? referenzPunkte(refs) : [],
  });

  const name = `${p.titel.replace(/×/g, 'x').replace(/[^\wäöüÄÖÜß\-,. ]+/g, '').replace(/\s+/g, ' ').trim() || 'Kalkulation'}.xlsx`;
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
    },
  });
}
