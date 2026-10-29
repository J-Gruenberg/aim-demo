import { NextResponse } from 'next/server';
import { supabaseServer, aktuellesProfil } from '@/lib/supabase/server';
import { vorschauPfad } from '@/lib/vorschau';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Rendert ein Blatt einer Zeichnung (Standard Blatt 1) als JPEG, für die Übersicht und die Live-Ansicht. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profil = await aktuellesProfil();
  if (!profil || profil.rolle === 'leser') return NextResponse.json({ fehler: 'Keine Berechtigung.' }, { status: 403 });
  const { datei_id, seite: gewuenscht = 1 } = (await req.json()) as { datei_id: string; seite?: number };
  const seite = Math.max(1, Math.floor(Number(gewuenscht) || 1));
  const sb = await supabaseServer();
  const { data: datei } = await sb.from('dateien').select('id,pfad,name').eq('id', datei_id).eq('projekt_id', id).maybeSingle();
  if (!datei) return NextResponse.json({ fehler: 'Datei nicht gefunden.' }, { status: 404 });
  const ziel = vorschauPfad(datei.pfad, seite);

  const vorhanden = await sb.storage.from('unterlagen').createSignedUrl(ziel, 3600);
  if (vorhanden.data?.signedUrl) return NextResponse.json({ url: vorhanden.data.signedUrl });

  const { data: blob, error } = await sb.storage.from('unterlagen').download(datei.pfad);
  if (error || !blob) return NextResponse.json({ fehler: 'Datei konnte nicht geladen werden.' }, { status: 500 });
  const buf = Buffer.from(await blob.arrayBuffer());

  try {
    const { createCanvas, loadImage } = await import('@napi-rs/canvas');
    let bild: Awaited<ReturnType<typeof loadImage>>;
    if (/\.pdf$/i.test(datei.name)) {
      const { getDocumentProxy, renderPageAsImage } = await import('unpdf');
      const daten = new Uint8Array(buf);
      const pdf = await getDocumentProxy(daten.slice());
      if (seite > pdf.numPages) return NextResponse.json({ fehler: 'Dieses Blatt gibt es nicht.' }, { status: 404 });
      const vp = (await pdf.getPage(seite)).getViewport({ scale: 1 });
      const scale = 1400 / Math.max(vp.width, vp.height, 1);
      const png = await renderPageAsImage(daten.slice(), seite, { canvasImport: () => import('@napi-rs/canvas'), scale });
      bild = await loadImage(Buffer.from(png as ArrayBuffer));
    } else {
      if (seite > 1) return NextResponse.json({ fehler: 'Dieses Blatt gibt es nicht.' }, { status: 404 });
      bild = await loadImage(buf);
    }
    const f = Math.min(1, 1400 / Math.max(bild.width, bild.height));
    const c = createCanvas(Math.round(bild.width * f), Math.round(bild.height * f));
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(bild, 0, 0, c.width, c.height);
    const jpg = await c.encode('jpeg', 82);
    await sb.storage.from('unterlagen').upload(ziel, jpg, { contentType: 'image/jpeg' });
    const { data } = await sb.storage.from('unterlagen').createSignedUrl(ziel, 3600);
    return NextResponse.json({ url: data?.signedUrl ?? null });
  } catch (e) {
    console.error('vorschau', e);
    return NextResponse.json({ fehler: 'Vorschau nicht möglich.' }, { status: 500 });
  }
}
