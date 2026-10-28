import { NextResponse } from 'next/server';
import { supabaseServer, aktuellesProfil } from '@/lib/supabase/server';
import { gaebText, schreibeX84 } from '@/lib/gaeb';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await aktuellesProfil())) return NextResponse.json({ fehler: 'Bitte anmelden.' }, { status: 401 });
  const sb = await supabaseServer();
  const { data: pos } = await sb.from('positionen').select('quelle,ep,status').eq('projekt_id', id).like('quelle', 'gaeb:%');
  if (!pos?.length) return NextResponse.json({ fehler: 'Dieses Projekt hat keine GAEB-Datei als Grundlage.' }, { status: 400 });
  const dateiId = pos[0].quelle!.split(':')[1];
  const { data: datei } = await sb.from('dateien').select('pfad,name').eq('id', dateiId).single();
  if (!datei) return NextResponse.json({ fehler: 'Original-GAEB nicht gefunden.' }, { status: 404 });
  const { data: blob } = await sb.storage.from('unterlagen').download(datei.pfad);
  if (!blob) return NextResponse.json({ fehler: 'Original-GAEB nicht ladbar.' }, { status: 500 });
  const preise: Record<string, number> = {};
  for (const p of pos) {
    const itemId = p.quelle!.split(':')[2];
    if (itemId && p.ep !== null && p.status === 'freigegeben') preise[itemId] = Number(p.ep);
  }
  const { xml } = schreibeX84(gaebText(new Uint8Array(await blob.arrayBuffer())), preise);
  const name = datei.name.replace(/\.[^.]+$/, '') + '.X84';
  return new NextResponse(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}` } });
}
