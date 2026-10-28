import { NextResponse } from 'next/server';
import { supabaseServer, aktuellesProfil } from '@/lib/supabase/server';
import { kiStrukturiert, KiFehler } from '@/lib/ki';

export const runtime = 'nodejs';
export const maxDuration = 300;

const NULL = { type: 'null' } as const;
const objekt = (props: Record<string, unknown>) => ({ type: 'object', properties: props, required: Object.keys(props), additionalProperties: false });

const SCHEMA = objekt({
  fehlt_im_lv: { type: 'array', items: objekt({ bauteil: { type: 'string' }, fundstelle: { type: 'string' }, menge_plan: { anyOf: [{ type: 'number' }, NULL] }, einheit: { type: 'string' }, hinweis: { type: 'string' } }) },
  nicht_im_plan: { type: 'array', items: objekt({ oz: { type: 'string' }, hinweis: { type: 'string' } }) },
  mengen: { type: 'array', items: objekt({ oz: { type: 'string' }, menge_lv: { type: 'number' }, menge_plan: { type: 'number' }, einheit: { type: 'string' }, hinweis: { type: 'string' } }) },
  zusammenfassung: { type: 'string' },
});

const SYSTEM = `Du prüfst für einen Stahl- und Metallbaubetrieb eine Ausschreibung auf Vollständigkeit und Konsistenz: Pläne gegen Leistungsverzeichnis (LV).
Vorgehen: erst Legende und Planköpfe, dann Maßstab, dann die Bauteile unseres Gewerks (Stahlbau, Treppen, Geländer, Gitterroste, Bühnen, Stützen, Träger, Unterkonstruktionen) auf den Plänen erfassen.
Melde nur, was für die Kalkulation relevant ist:
- fehlt_im_lv: Bauteile unseres Gewerks, die auf den Plänen zu sehen sind, aber keine LV-Position haben (mit Fundstelle: Plan und Bereich).
- nicht_im_plan: LV-Positionen unseres Gewerks, die auf keinem Plan zu finden sind.
- mengen: deutliche Abweichungen zwischen LV-Menge und der aus den Plänen ablesbaren Menge (mehr als 10 %), nur wenn die Planmenge eindeutig ablesbar ist.
Nichts erfinden. Wenn ein Plan unleserlich ist oder der Maßstab fehlt, sag das in der Zusammenfassung. Fremdgewerke (Beton, Erdbau, Elektro, Dach) ignorieren.
zusammenfassung: zwei bis drei kurze Sätze auf Deutsch.`;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profil = await aktuellesProfil();
  if (!profil || profil.rolle === 'leser') return NextResponse.json({ fehler: 'Keine Berechtigung.' }, { status: 403 });
  const sb = await supabaseServer();
  const [{ data: plaene }, { data: pos }, { data: pr }] = await Promise.all([
    sb.from('dateien').select('pfad,name,groesse').eq('projekt_id', id).eq('art', 'plan').order('created_at').limit(4),
    sb.from('positionen').select('oz,kurztext,langtext,menge,einheit,typ').eq('projekt_id', id).order('sort'),
    sb.from('projekte').select('ergebnis').eq('id', id).single(),
  ]);
  if (!plaene?.length) return NextResponse.json({ fehler: 'Für den Abgleich bitte mindestens einen Plan hochladen und als Art „Plan“ markieren.' }, { status: 400 });
  if (!pos?.length) return NextResponse.json({ fehler: 'Erst die Positionen lesen, dann abgleichen.' }, { status: 400 });

  const inhalt: Parameters<typeof kiStrukturiert>[0]['inhalt'] = [];
  const namen: string[] = [];
  for (const d of plaene) {
    if ((d.groesse ?? 0) > 15_000_000) continue;
    const { data: b } = await sb.storage.from('unterlagen').download(d.pfad);
    if (!b) continue;
    inhalt.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: Buffer.from(await b.arrayBuffer()).toString('base64') } });
    namen.push(d.name);
  }
  if (!inhalt.length) return NextResponse.json({ fehler: 'Die Pläne sind zu groß für den Abgleich (höchstens 15 MB je Plan).' }, { status: 400 });
  inhalt.push({
    type: 'text',
    text: `Pläne in Reihenfolge: ${namen.join(', ')}\n\nLV-Positionen (OZ | Menge Einheit | Text):\n${pos
      .filter((p) => p.typ !== 'fremd')
      .map((p) => `${p.oz ?? ''} | ${p.menge ?? '?'} ${p.einheit ?? ''} | ${p.kurztext ?? ''} ${(p.langtext ?? '').replace(/\s+/g, ' ').slice(0, 260)}`)
      .join('\n')}`,
  });
  try {
    const { daten, kostenEur } = await kiStrukturiert<Record<string, unknown>>({ sb, projektId: id, zweck: `Abgleich Plan gegen LV (${namen.length} Pläne)`, stufe: 'standard', system: SYSTEM, inhalt, schema: SCHEMA, maxTokens: 8000 });
    const abgleich = { ...daten, datum: new Date().toISOString(), plaene: namen };
    await sb.from('projekte').update({ ergebnis: { ...(pr?.ergebnis ?? {}), abgleich } }).eq('id', id);
    return NextResponse.json({ abgleich, kosten: kostenEur });
  } catch (e) {
    const msg = e instanceof KiFehler ? e.nutzerText : 'Beim Abgleich ist ein Fehler aufgetreten.';
    console.error('abgleich', e);
    return NextResponse.json({ fehler: msg }, { status: 502 });
  }
}
