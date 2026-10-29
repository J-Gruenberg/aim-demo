import { NextResponse } from 'next/server';
import { supabaseServer, aktuellesProfil } from '@/lib/supabase/server';
import { GaebAltformat, gaebText, leseGaeb } from '@/lib/gaeb';
import { kiStrukturiert, KiFehler } from '@/lib/ki';
import { SCHEMA_LESEN, SYSTEM_LESEN, SYSTEM_PLAN, type GelesenePosition } from '@/lib/lv-ki';
import { einheitNorm, mengenAusText } from '@/lib/lv-text';
import { automatischBenennen } from '@/lib/benennen';

export const runtime = 'nodejs';
export const maxDuration = 300;

// Klein halten, damit jede Anfrage deutlich unter einer Minute bleibt
const SEITEN_JE_DURCHGANG = 4;
const SEITEN_JE_DURCHGANG_PLAN = 2;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profil = await aktuellesProfil();
  if (!profil || profil.rolle === 'leser') return NextResponse.json({ fehler: 'Keine Berechtigung.' }, { status: 403 });
  const { datei_id, ab_seite = 1 } = (await req.json()) as { datei_id: string; ab_seite?: number };
  const sb = await supabaseServer();
  const { data: datei } = await sb.from('dateien').select('*').eq('id', datei_id).eq('projekt_id', id).maybeSingle();
  if (!datei) return NextResponse.json({ fehler: 'Datei nicht gefunden.' }, { status: 404 });
  const { data: blob, error } = await sb.storage.from('unterlagen').download(datei.pfad);
  if (error || !blob) return NextResponse.json({ fehler: 'Datei konnte nicht geladen werden.' }, { status: 500 });
  const buf = Buffer.from(await blob.arrayBuffer());

  // GAEB: deterministisch, ohne KI
  if (datei.art === 'gaeb' || /\.(x8[0-9]|d8[0-9]|p8[0-9])$/i.test(datei.name)) {
    try {
      const lv = leseGaeb(gaebText(buf));
      await sb.from('positionen').delete().eq('projekt_id', id).like('quelle', `gaeb:${datei_id}:%`);
      const zeilen = lv.positionen.map((p, i) => ({
        projekt_id: id,
        sort: i * 10,
        oz: p.oz,
        kurztext: p.kurztext,
        langtext: p.langtext,
        menge: p.menge,
        einheit: p.einheit,
        status: 'offen',
        quelle: `gaeb:${datei_id}:${p.id ?? ''}`,
        ansatz: { bereich: p.bereich, bedarf: p.bedarf, alternativ: p.alternativ, pauschal: p.pauschal },
      }));
      for (let i = 0; i < zeilen.length; i += 500) await sb.from('positionen').insert(zeilen.slice(i, i + 500));
      await sb.rpc('ergebnis_setzen', { p_id: id, p_schluessel: 'lv_titel', p_wert: lv.bezeichnung });
      await sb.rpc('ergebnis_setzen', { p_id: id, p_schluessel: 'lv_projekt', p_wert: lv.projekt });
      await sb.rpc('ergebnis_setzen', { p_id: id, p_schluessel: 'gaeb_datei', p_wert: datei_id });
      // Name sofort aus der GAEB-Datei, die Prüfung macht ihn danach noch sprechender
      const benannt = await automatischBenennen(sb, id, { titel: [lv.bezeichnung || lv.projekt, lv.lv].filter(Boolean).join(', ') });
      return NextResponse.json({ fertig: true, neu: zeilen.length, seiten: null, naechste: null, art: 'gaeb', benannt });
    } catch (e) {
      if (e instanceof GaebAltformat) return NextResponse.json({ fehler: e.message }, { status: 422 });
      return NextResponse.json({ fehler: `Die GAEB-Datei ließ sich nicht lesen (${(e as Error).message}).` }, { status: 422 });
    }
  }

  // PDF: Text je Seite, Scans als Bild an die KI
  const { getDocumentProxy, extractText } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  const seiten = text as string[];
  const von = Math.max(1, ab_seite);
  if (von > totalPages) return NextResponse.json({ fertig: true, neu: 0, seiten: totalPages, naechste: null, art: 'pdf' });
  const istPlan = datei.art === 'plan';
  const bis = Math.min(totalPages, von + (istPlan ? SEITEN_JE_DURCHGANG_PLAN : SEITEN_JE_DURCHGANG) - 1);
  const textBereich = seiten.slice(von - 1, bis).map((t, i) => `=== Seite ${von + i} ===\n${t}`).join('\n\n');
  const folge = bis < totalPages ? seiten[bis].split('\n').slice(0, 60).join('\n') : '';
  const istScan = istPlan || textBereich.replace(/=== Seite \d+ ===|\s/g, '').length < 200 * (bis - von + 1) * 0.3;

  const { data: bisher } = await sb.from('positionen').select('oz,sort').eq('projekt_id', id).like('quelle', `pdf:${datei_id}:%`).order('sort', { ascending: false }).limit(1);
  const letzteOz = bisher?.[0]?.oz ?? null;
  const sortStart = (bisher?.[0]?.sort ?? -10) + 10;

  const inhalt: Parameters<typeof kiStrukturiert>[0]['inhalt'] = [];
  if (istScan) {
    const { PDFDocument } = await import('pdf-lib');
    const quelle = await PDFDocument.load(buf);
    const teil = await PDFDocument.create();
    const kopien = await teil.copyPages(quelle, Array.from({ length: bis - von + 1 }, (_, i) => von - 1 + i));
    kopien.forEach((p) => teil.addPage(p));
    inhalt.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: Buffer.from(await teil.save()).toString('base64') } });
    inhalt.push({
      type: 'text',
      text: istPlan
        ? `Das Dokument enthält die Seiten ${von} bis ${bis} von ${totalPages} der Zeichnung "${datei.name}". Lege die Positionen für unser Gewerk an.`
        : `Das Dokument enthält die Seiten ${von} bis ${bis} von ${totalPages} des LV "${datei.name}". ${letzteOz ? `Zuletzt gelesene Position: ${letzteOz}.` : ''} Gib alle Positionen aus, die auf diesen Seiten beginnen.`,
    });
  } else {
    inhalt.push({
      type: 'text',
      text: `LV "${datei.name}", Seiten ${von} bis ${bis} von ${totalPages}.${letzteOz ? ` Zuletzt gelesene Position: ${letzteOz}.` : ''}\n\n${textBereich}${folge ? `\n\n=== Nur zur Vervollständigung: Anfang der Folgeseite ${bis + 1} ===\n${folge}` : ''}`,
    });
  }

  try {
    const { daten, kostenEur } = await kiStrukturiert<{ positionen: GelesenePosition[]; hinweise: string[]; projekt: { titel: string; auftraggeber: string; baustelle: string } }>({
      sb,
      projektId: id,
      zweck: `${istPlan ? 'Zeichnung lesen' : 'LV lesen'} ${datei.name} S. ${von}-${bis}`,
      stufe: istPlan ? 'standard' : 'schnell',
      system: istPlan ? SYSTEM_PLAN : SYSTEM_LESEN,
      inhalt,
      schema: SCHEMA_LESEN,
      maxTokens: 32000,
    });
    const gelesen = daten.positionen.filter((p) => p.oz && p.oz !== letzteOz);
    // Bei Text-PDFs Mengen aus der Zeile „Menge: …“ im Gesamttext übernehmen: eindeutig, auch wenn die Position über mehrere Seiten läuft
    const ausText = istScan || istPlan ? new Map() : mengenAusText(seiten.join('\n'), gelesen.map((p) => p.oz.trim()));
    const neu = gelesen
      .map((p, i) => ({
        projekt_id: id,
        sort: sortStart + i * 10,
        oz: p.oz.trim(),
        kurztext: p.kurztext.trim(),
        langtext: p.langtext.trim(),
        menge: ausText.get(p.oz.trim())?.menge ?? (p.menge > 0 ? p.menge : null),
        einheit: ausText.get(p.oz.trim())?.einheit ?? einheitNorm(p.einheit),
        status: 'offen',
        quelle: `pdf:${datei_id}:${p.seite}`,
        ansatz: { bedarf: p.bedarf, alternativ: p.alternativ },
      }));
    if (neu.length) await sb.from('positionen').insert(neu);
    if (daten.hinweise.length) {
      const { data: pr } = await sb.from('projekte').select('ergebnis').eq('id', id).single();
      const alt = (pr?.ergebnis?.hinweise as string[] | undefined) ?? [];
      await sb.rpc('ergebnis_setzen', { p_id: id, p_schluessel: 'hinweise', p_wert: Array.from(new Set([...alt, ...daten.hinweise])).slice(0, 40) });
    }
    const benannt = daten.projekt ? await automatischBenennen(sb, id, { titel: daten.projekt.titel, kunde: daten.projekt.auftraggeber, ort: daten.projekt.baustelle }) : null;
    // Fortschritt merken: der Browser kann bei abgerissener Verbindung hier weitermachen
    await sb.from('dateien').update({ seiten: totalPages, gelesen_bis: bis }).eq('id', datei_id);
    return NextResponse.json({ fertig: bis >= totalPages, neu: neu.length, seiten: totalPages, naechste: bis < totalPages ? bis + 1 : null, kosten: kostenEur, art: istScan ? 'scan' : 'text', benannt, positionen: neu.map((z) => ({ oz: z.oz, kurztext: z.kurztext, menge: z.menge, einheit: z.einheit })) });
  } catch (e) {
    const msg = e instanceof KiFehler ? e.nutzerText : 'Beim Lesen ist ein Fehler aufgetreten.';
    console.error('lesen', e);
    return NextResponse.json({ fehler: msg }, { status: 502 });
  }
}
