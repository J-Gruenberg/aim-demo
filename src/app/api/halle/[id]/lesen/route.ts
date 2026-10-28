import { NextResponse } from 'next/server';
import { supabaseServer, aktuellesProfil } from '@/lib/supabase/server';
import { kiStrukturiert, KiFehler } from '@/lib/ki';
import { SCHEMA_HALLE, SYSTEM_HALLE, vorschlagAus, type HalleGelesen } from '@/lib/halle-lesen';

export const runtime = 'nodejs';
export const maxDuration = 300;

const MAX_DATEIEN = 4;
const MAX_SEITEN = 6;
const MAX_BYTES = 30 * 1024 * 1024;

/** Liest eine Hallen-Anfrage (E-Mail-Text, Zeichnung, Skizze, Baubeschreibung) und schlägt die Eingaben für den Vordruck vor. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profil = await aktuellesProfil();
  if (!profil || profil.rolle === 'leser') return NextResponse.json({ fehler: 'Keine Berechtigung.' }, { status: 403 });
  const { datei_ids = [], text = '' } = (await req.json().catch(() => ({}))) as { datei_ids?: string[]; text?: string };
  const anfrage = String(text ?? '').trim().slice(0, 20000);
  if (!datei_ids.length && !anfrage) return NextResponse.json({ fehler: 'Bitte eine Zeichnung hochladen oder den Anfragetext einfügen.' }, { status: 400 });

  const sb = await supabaseServer();
  const { data: pr } = await sb.from('projekte').select('id,typ').eq('id', id).maybeSingle();
  if (!pr || pr.typ !== 'halle') return NextResponse.json({ fehler: 'Projekt nicht gefunden.' }, { status: 404 });
  const { data: dateien } = datei_ids.length
    ? await sb.from('dateien').select('id,name,pfad,groesse').eq('projekt_id', id).in('id', datei_ids.slice(0, MAX_DATEIEN))
    : { data: [] as { id: string; name: string; pfad: string; groesse: number | null }[] };
  if ((dateien ?? []).reduce((s, d) => s + Number(d.groesse ?? 0), 0) > MAX_BYTES) {
    return NextResponse.json({ fehler: 'Die Unterlagen sind zusammen zu groß (höchstens 30 MB). Bitte nur die Planseiten mit Grundriss, Schnitt und Ansichten hochladen.' }, { status: 413 });
  }

  const inhalt: Parameters<typeof kiStrukturiert>[0]['inhalt'] = [];
  const namen: string[] = [];
  let seitenFrei = MAX_SEITEN;
  for (const d of dateien ?? []) {
    const { data: blob } = await sb.storage.from('unterlagen').download(d.pfad);
    if (!blob) continue;
    const buf = Buffer.from(await blob.arrayBuffer());
    if (/\.pdf$/i.test(d.name) || buf.subarray(0, 4).toString() === '%PDF') {
      if (seitenFrei <= 0) continue;
      const { PDFDocument } = await import('pdf-lib');
      const quelle = await PDFDocument.load(buf, { ignoreEncryption: true });
      const anzahl = Math.min(quelle.getPageCount(), seitenFrei);
      let daten = buf;
      if (anzahl < quelle.getPageCount()) {
        const teil = await PDFDocument.create();
        (await teil.copyPages(quelle, Array.from({ length: anzahl }, (_, i) => i))).forEach((p) => teil.addPage(p));
        daten = Buffer.from(await teil.save());
      }
      seitenFrei -= anzahl;
      inhalt.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: daten.toString('base64') } });
      namen.push(`${d.name}${anzahl < quelle.getPageCount() ? ` (Seiten 1 bis ${anzahl})` : ''}`);
    } else if (/\.(jpe?g|png)$/i.test(d.name)) {
      const png = buf.subarray(0, 4).toString('hex') === '89504e47';
      inhalt.push({ type: 'image', source: { type: 'base64', media_type: png ? 'image/png' : 'image/jpeg', data: buf.toString('base64') } });
      namen.push(d.name);
    }
  }
  if (anfrage) inhalt.push({ type: 'text', text: `Anfragetext:\n"""\n${anfrage}\n"""` });
  if (!inhalt.length) return NextResponse.json({ fehler: 'Die Unterlagen ließen sich nicht öffnen. Bitte als PDF, JPG oder PNG hochladen.' }, { status: 422 });
  inhalt.push({ type: 'text', text: `Unterlagen: ${namen.length ? namen.join(', ') : 'nur Anfragetext'}. Gib die Eckdaten der Halle zurück.` });

  try {
    const { daten, kostenEur } = await kiStrukturiert<HalleGelesen>({
      sb,
      projektId: id,
      zweck: `Halle lesen: ${namen.join(', ') || 'Anfragetext'}`.slice(0, 200),
      // Eine Anfrage je Halle: das genauere Modell kostet hier nur wenige Cent und liest Ausschlüsse ("bauseits") zuverlässiger
      stufe: 'standard',
      system: SYSTEM_HALLE,
      inhalt,
      schema: SCHEMA_HALLE,
      maxTokens: 6000,
    });
    return NextResponse.json({ vorschlag: vorschlagAus(daten), quellen: namen.length ? namen : ['Anfragetext'], kosten: kostenEur });
  } catch (e) {
    console.error('halle lesen', e);
    const msg = e instanceof KiFehler ? e.nutzerText : 'Beim Lesen ist ein Fehler aufgetreten. Bitte erneut versuchen.';
    return NextResponse.json({ fehler: msg }, { status: 502 });
  }
}
