import { NextResponse } from 'next/server';
import { supabaseServer, aktuellesProfil } from '@/lib/supabase/server';
import { kiStrukturiert, KiFehler } from '@/lib/ki';
import { SCHEMA_ABGLEICH, SYSTEM_ABGLEICH, planBeschriftungen, type AbgleichKi } from '@/lib/pruefung-ki';
import type { Abgleich, Widerspruch } from '@/components/positionen/typen';

export const runtime = 'nodejs';
export const maxDuration = 300;

const MERKMALE: Widerspruch['merkmal'][] = ['werkstoff', 'oberflaeche', 'profil', 'abmessung', 'befestigung', 'anzahl', 'sonstiges'];

/**
 * Plan gegen LV: Merkmal für Merkmal (Werkstoff, Oberfläche, Profil, Befestigung, Anzahl), fehlende Positionen,
 * Mengen und Bieterfragen. Die Pläne gehen als PDF an die KI, ihre Beschriftungen zusätzlich als Text mit Fundstellen,
 * damit Wörter wie „Edelstahl“ nicht in der Grafik untergehen.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profil = await aktuellesProfil();
  if (!profil || profil.rolle === 'leser') return NextResponse.json({ fehler: 'Keine Berechtigung.' }, { status: 403 });
  const sb = await supabaseServer();
  const [{ data: plaene }, { data: pos }] = await Promise.all([
    sb.from('dateien').select('pfad,name,groesse').eq('projekt_id', id).eq('art', 'plan').order('created_at').limit(4),
    sb.from('positionen').select('oz,kurztext,langtext,menge,einheit,typ').eq('projekt_id', id).order('sort'),
  ]);
  if (!plaene?.length) return NextResponse.json({ fehler: 'Für den Abgleich bitte mindestens einen Plan hochladen und als Art „Plan“ markieren.' }, { status: 400 });
  if (!pos?.length) return NextResponse.json({ fehler: 'Erst die Positionen lesen, dann abgleichen.' }, { status: 400 });

  const inhalt: Parameters<typeof kiStrukturiert>[0]['inhalt'] = [];
  const namen: string[] = [];
  const geladen: { name: string; buf: Buffer }[] = [];
  for (const d of plaene) {
    if ((d.groesse ?? 0) > 15_000_000) continue;
    const { data: b } = await sb.storage.from('unterlagen').download(d.pfad);
    if (!b) continue;
    const buf = Buffer.from(await b.arrayBuffer());
    geladen.push({ name: d.name, buf });
    inhalt.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buf.toString('base64') } });
    namen.push(d.name);
  }
  if (!inhalt.length) return NextResponse.json({ fehler: 'Die Pläne sind zu groß für den Abgleich (höchstens 15 MB je Plan).' }, { status: 400 });
  const beschriftungen = await planBeschriftungen(geladen);

  inhalt.push({
    type: 'text',
    text: [
      `Pläne in Reihenfolge: ${namen.join(', ')}`,
      beschriftungen ? `BESCHRIFTUNGEN AUS DER TEXTEBENE DER PLÄNE (Wortlaut  [Plan Seite; Häufigkeit])\n${beschriftungen}` : 'Die Pläne haben keine lesbare Textebene, nur die Grafik auswerten.',
      `LV-POSITIONEN (OZ | Menge Einheit | Kurztext | Langtext)\n${pos
        .filter((p) => p.typ !== 'fremd')
        .map((p) => `${p.oz ?? ''} | ${p.menge ?? '?'} ${p.einheit ?? ''} | ${p.kurztext ?? ''} | ${(p.langtext ?? '').replace(/\s+/g, ' ').slice(0, 900)}`)
        .join('\n')}`,
    ].join('\n\n'),
  });

  try {
    const { daten, kostenEur } = await kiStrukturiert<AbgleichKi>({ sb, projektId: id, zweck: `Abgleich Plan gegen LV (${namen.length} Pläne)`, stufe: 'standard', system: SYSTEM_ABGLEICH, inhalt, schema: SCHEMA_ABGLEICH, maxTokens: 20000 });
    const abgleich: Abgleich = {
      datum: new Date().toISOString(),
      plaene: namen,
      zusammenfassung: daten.zusammenfassung,
      fehlt_im_lv: daten.fehlt_im_lv,
      nicht_im_plan: daten.nicht_im_plan,
      mengen: daten.mengen,
      widersprueche: daten.widersprueche
        .map((w) => ({ ...w, merkmal: MERKMALE.includes(w.merkmal as Widerspruch['merkmal']) ? (w.merkmal as Widerspruch['merkmal']) : 'sonstiges' }))
        .sort((a, b) => (a.stufe === b.stufe ? 0 : a.stufe === 'kritisch' ? -1 : 1)),
      bieterfragen: daten.bieterfragen.map((f) => ({ ...f, quelle: 'plaene' as const })),
    };
    await sb.rpc('ergebnis_setzen', { p_id: id, p_schluessel: 'abgleich', p_wert: abgleich });
    return NextResponse.json({ abgleich, kosten: kostenEur });
  } catch (e) {
    const msg = e instanceof KiFehler ? e.nutzerText : 'Beim Abgleich ist ein Fehler aufgetreten.';
    console.error('abgleich', e);
    return NextResponse.json({ fehler: msg }, { status: 502 });
  }
}
