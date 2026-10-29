import { NextResponse } from 'next/server';
import { supabaseServer, aktuellesProfil } from '@/lib/supabase/server';
import { kiStrukturiert, KiFehler } from '@/lib/ki';
import { gaebText, gaebVorbemerkungen } from '@/lib/gaeb';
import { automatischBenennen } from '@/lib/benennen';
import { SCHEMA_PRUEFUNG, SYSTEM_PRUEFUNG, pdfSeiten, type PruefungKi } from '@/lib/pruefung-ki';
import type { Pruefung } from '@/components/positionen/typen';
import { erinnern, hash, merken, version } from '@/lib/gedaechtnis';

const PRUEF_VERSION = version(SYSTEM_PRUEFUNG, SCHEMA_PRUEFUNG);

export const runtime = 'nodejs';
export const maxDuration = 300;

const MAX_TEXT = 90_000;
const STUFE = { kritisch: 0, beachten: 1, info: 2 } as const;

/**
 * Prüft Vorbemerkungen, Baubeschreibung und Positionstexte: Hinweise mit Ampel, Bieterfragen, Projektname.
 * Ergebnis liegt in projekte.ergebnis.pruefung.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profil = await aktuellesProfil();
  if (!profil || profil.rolle === 'leser') return NextResponse.json({ fehler: 'Keine Berechtigung.' }, { status: 403 });
  const { frisch = false } = (await req.json().catch(() => ({}))) as { frisch?: boolean };
  const sb = await supabaseServer();
  const [{ data: pr }, { data: pos }, { data: dateien }] = await Promise.all([
    sb.from('projekte').select('ergebnis').eq('id', id).single(),
    sb.from('positionen').select('oz,kurztext,langtext,menge,einheit,typ').eq('projekt_id', id).order('sort'),
    sb.from('dateien').select('id,name,pfad,art,groesse').eq('projekt_id', id).order('created_at'),
  ]);

  // Texte der Ausschreibung: PDF mit Seitenzahlen bevorzugt, sonst die Zusatztexte aus der GAEB-Datei
  const teile: string[] = [];
  let laenge = 0;
  const pdfs = (dateien ?? []).filter((d) => (d.art === 'lv' || d.art === 'baubeschreibung') && /\.pdf$/i.test(d.name) && (d.groesse ?? 0) < 25_000_000);
  // Baubeschreibung zuerst: dort stehen die Vorbemerkungen meist geballt
  pdfs.sort((a, b) => (a.art === 'baubeschreibung' ? -1 : 0) - (b.art === 'baubeschreibung' ? -1 : 0));
  for (const d of pdfs) {
    const { data: b } = await sb.storage.from('unterlagen').download(d.pfad);
    if (!b) continue;
    const seiten = await pdfSeiten(Buffer.from(await b.arrayBuffer()));
    for (const [i, t] of seiten.entries()) {
      const block = `=== ${d.name}, Seite ${i + 1} ===\n${t.trim()}`;
      if (t.trim().length < 20) continue;
      if (laenge + block.length > MAX_TEXT) break;
      teile.push(block);
      laenge += block.length;
    }
  }
  if (!teile.length) {
    const gaeb = (dateien ?? []).find((d) => d.art === 'gaeb');
    if (gaeb) {
      const { data: b } = await sb.storage.from('unterlagen').download(gaeb.pfad);
      if (b) {
        const v = gaebVorbemerkungen(gaebText(Buffer.from(await b.arrayBuffer())));
        if (v) teile.push(`=== Vorbemerkungen aus ${gaeb.name} ===\n${v}`);
      }
    }
  }
  const notiert = ((pr?.ergebnis?.hinweise as string[] | undefined) ?? []).slice(0, 60);
  if (!teile.length && !notiert.length && !pos?.length) return NextResponse.json({ fehler: 'Es liegen noch keine Texte zum Prüfen vor.' }, { status: 400 });

  const positionen = (pos ?? [])
    .filter((p) => p.typ !== 'fremd')
    .map((p) => `${p.oz ?? ''} | ${p.menge ?? '?'} ${p.einheit ?? ''} | ${p.kurztext ?? ''} ${(p.langtext ?? '').replace(/\s+/g, ' ').slice(0, 500)}`)
    .join('\n');

  const inhalt: Parameters<typeof kiStrukturiert>[0]['inhalt'] = [
    {
      type: 'text',
      text: [
        teile.length ? `UNTERLAGEN\n${teile.join('\n\n')}` : '',
        notiert.length ? `BEIM LESEN NOTIERT\n${notiert.map((h) => `- ${h}`).join('\n')}` : '',
        positionen ? `LV-POSITIONEN (OZ | Menge Einheit | Text)\n${positionen}` : '',
      ]
        .filter(Boolean)
        .join('\n\n'),
    },
  ];

  try {
    // Gleiche Unterlagen, gleicher Bericht. „Neu prüfen“ fragt bewusst frisch und ersetzt den gemerkten Bericht.
    const schluessel = `pruefung:${PRUEF_VERSION}:${hash(JSON.stringify(inhalt))}`;
    const bekannt = frisch ? null : await erinnern<PruefungKi>(sb, schluessel);
    let daten: PruefungKi;
    if (bekannt) daten = bekannt.daten;
    else {
      const r = await kiStrukturiert<PruefungKi>({ sb, projektId: id, zweck: 'Vorbemerkungen prüfen, Bieterfragen', stufe: 'standard', system: SYSTEM_PRUEFUNG, inhalt, schema: SCHEMA_PRUEFUNG, maxTokens: 32000 });
      daten = r.daten;
      await merken(sb, schluessel, 'pruefung', daten, { modell: r.modell });
    }
    const pruefung: Pruefung = {
      datum: new Date().toISOString(),
      zusammenfassung: daten.zusammenfassung,
      hinweise: [...daten.hinweise].sort((a, b) => STUFE[a.stufe] - STUFE[b.stufe]),
      bieterfragen: daten.bieterfragen.map((f) => ({ ...f, quelle: 'vorbemerkungen' as const })),
    };
    await sb.rpc('ergebnis_setzen', { p_id: id, p_schluessel: 'pruefung', p_wert: pruefung });
    const benannt = await automatischBenennen(sb, id, { titel: daten.projekt.titel, kunde: daten.projekt.auftraggeber, ort: daten.projekt.baustelle });
    return NextResponse.json({ pruefung, benannt });
  } catch (e) {
    const msg = e instanceof KiFehler ? e.nutzerText : 'Bei der Prüfung ist ein Fehler aufgetreten.';
    console.error('pruefen', e);
    return NextResponse.json({ fehler: msg }, { status: 502 });
  }
}
