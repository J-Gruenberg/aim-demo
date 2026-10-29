import { NextResponse } from 'next/server';
import { supabaseServer, aktuellesProfil } from '@/lib/supabase/server';
import { kiStrukturiert, KiFehler } from '@/lib/ki';
import { ladeStammdaten } from '@/lib/daten';
import { automatischBenennen } from '@/lib/benennen';
import { SCHEMA_SATZ, SYSTEM_SATZ, type SatzKi } from '@/lib/satz-ki';
import { baugruppeRechnen, stuecklistenText, type BaugruppeAnsatz, type ZeichnungOberflaeche } from '@/lib/engine/zeichnung';
import { rechnePosition, type Ansatz, type Oberflaeche } from '@/lib/engine/bauteile';
import { summen, type Position } from '@/components/positionen/typen';

export const runtime = 'nodejs';
export const maxDuration = 300;

const OBER_ZNG: ZeichnungOberflaeche[] = ['roh', 'grundiert', 'verzinkt', 'beschichtet', 'verzinkt_beschichtet'];
const oberKg = (o: string): Oberflaeche => (o === 'verzinkt' ? 'verzinkt' : o === 'verzinkt_beschichtet' ? 'verzinkt_pulver' : o === 'grundiert' || o === 'beschichtet' ? 'grundiert' : 'roh');
const de = (v: number, n = 1) => v.toLocaleString('de-DE', { maximumFractionDigits: n });
const r2 = (v: number) => Math.round(v * 100) / 100;

type Zeile = { id: string; oz: string | null; kurztext: string | null; menge: number | null; einheit: string | null; ansatz: Record<string, unknown> | null; status: string; begruendung: string | null; quelle: string | null; sicherheit: number | null };

/**
 * Ordnet einen Zeichnungssatz nach dem Lesen: keine doppelten Unterbaugruppen, Mengen aus der Stückliste,
 * fehlende Zeichnungen rot, Kaufteile und Fremdleistungen als eigene Positionen, saubere Nummern und Namen.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profil = await aktuellesProfil();
  if (!profil || profil.rolle === 'leser') return NextResponse.json({ fehler: 'Keine Berechtigung.' }, { status: 403 });
  const sb = await supabaseServer();
  const [{ data: rohPos }, { data: pr }, { werte: stamm }] = await Promise.all([
    sb.from('positionen').select('id,oz,kurztext,menge,einheit,ansatz,status,begruendung,quelle,sicherheit').eq('projekt_id', id).order('sort'),
    sb.from('projekte').select('ergebnis').eq('id', id).single(),
    ladeStammdaten(sb),
  ]);
  const alle = (rohPos ?? []) as Zeile[];
  const gelesen = alle.filter((p) => (p.quelle ?? '').startsWith('zng:'));
  if (!gelesen.length) return NextResponse.json({ geaendert: 0, neu: 0, hinweise: [] });

  // Eingabe für die KI: je Position Blatt, Zeichnung, Menge und Stückliste
  const blaetter = (pr?.ergebnis?.blaetter ?? {}) as Record<
    string,
    { zeichnungsnummer?: string; titel?: string; projekt?: string; datei?: string; seite?: number; hinweise?: string[]; kaufteile?: { bezeichnung: string; norm: string; stk: number }[] }
  >;
  const blattText = Object.values(blaetter)
    .sort((a, b) => (a.datei ?? '').localeCompare(b.datei ?? '') || (a.seite ?? 0) - (b.seite ?? 0))
    .map((b) =>
      [
        `BLATT ${b.seite ?? '?'} der Datei ${b.datei ?? ''}: Zeichnung ${b.zeichnungsnummer ?? '?'}, ${b.titel ?? ''}`,
        b.kaufteile?.length ? `  Kaufteile je Baugruppe: ${b.kaufteile.map((k) => `${k.stk} × ${k.bezeichnung}${k.norm ? ` (${k.norm})` : ''}`).join('; ')}` : '',
        b.hinweise?.length ? `  Hinweise: ${b.hinweise.join(' | ')}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n');
  const text = gelesen
    .map((p) => {
      const a = (p.ansatz ?? {}) as Partial<BaugruppeAnsatz> & { kg_je_einheit?: number; nur_gewicht?: boolean };
      const [, datei, seite] = (p.quelle ?? '').split(':');
      const b = blaetter[`${datei}:${seite}`];
      const teile = (a.teile ?? []).map((t) => `    pos ${t.pos} | ${t.stk} Stk | ${t.bezeichnung} | ${t.profil} | ${t.werkstoff} | ${t.gewicht_kg ?? '?'} kg`).join('\n');
      return [
        `POSITION id=${p.id}`,
        `  Blatt ${seite ?? '?'} der Datei ${b?.datei ?? ''}, Zeichnung ${a.zeichnung ?? b?.zeichnungsnummer ?? '?'}, Titel ${b?.titel ?? ''}`,
        `  oz ${p.oz ?? ''} | ${p.kurztext ?? ''} | Menge ${p.menge ?? 1} ${p.einheit ?? ''} | Gewicht laut Zeichnung ${a.gewicht_zeichnung_kg ?? a.kg_je_einheit ?? '?'} kg | Oberfläche ${a.merkmale?.oberflaeche ?? (a as { oberflaeche?: string }).oberflaeche ?? '?'} | ${a.merkmale?.schweissbaugruppe ? 'Schweißbaugruppe' : a.art === 'baugruppe' ? 'nicht geschweißt (verschraubt oder Einzelteil)' : 'Gewichtsposition'}${a.nur_gewicht ? ' | nur über Gewicht geschätzt' : ''}`,
        teile ? `  Stückliste:\n${teile}` : '  keine Stückliste',
      ].join('\n');
    })
    .join('\n\n');
  const eingabe = `${blattText ? `BLÄTTER DES SATZES\n${blattText}\n\n` : ''}GELESENE POSITIONEN\n${text}`;

  let daten: SatzKi;
  try {
    ({ daten } = await kiStrukturiert<SatzKi>({ sb, projektId: id, zweck: 'Zeichnungssatz ordnen', stufe: 'standard', system: SYSTEM_SATZ, inhalt: [{ type: 'text', text: eingabe }], schema: SCHEMA_SATZ, maxTokens: 16000 }));
  } catch (e) {
    const msg = e instanceof KiFehler ? e.nutzerText : 'Der Zeichnungssatz ließ sich nicht ordnen.';
    console.error('satz', e);
    return NextResponse.json({ fehler: msg }, { status: 502 });
  }

  // 1. Gelesene Positionen anpassen
  // Gibt es im Satz echte Einzelzeichnungen, ist jede verbliebene reine Gewichtsschätzung eine fehlende Zeichnung.
  // Bei einer reinen Übersichtszeichnung bleibt es bei „über Gewicht geschätzt“.
  const detailliert = gelesen.some((p) => (p.ansatz as { art?: string; nur_gewicht?: boolean } | null)?.art === 'baugruppe' && !(p.ansatz as { nur_gewicht?: boolean }).nur_gewicht);
  let geaendert = 0;
  for (const k of daten.positionen) {
    const p = gelesen.find((x) => x.id === k.id);
    if (!p) continue;
    const a = { ...(p.ansatz ?? {}) } as Record<string, unknown>;
    // Doppelt gelesene Gewichtsposition: die genauere vom eigenen Blatt bleibt. Nur Schätzungen werden gelöscht.
    if ((k.entfernen || k.menge === 0) && a.nur_gewicht && gelesen.length > 1) {
      await sb.from('positionen').delete().eq('id', p.id);
      geaendert++;
      continue;
    }
    const fehlt = k.zeichnung_fehlt?.trim() || (detailliert && a.nur_gewicht ? 'ohne Nummer' : '');
    if (fehlt) a.zeichnung_fehlt = fehlt;
    const menge = k.menge > 0 ? k.menge : Number(p.menge ?? 1) || 1;
    let ep: number | null = null;
    let langtext: string | undefined;
    if (a.art === 'baugruppe') {
      const bg = a as unknown as BaugruppeAnsatz;
      const weg = new Set(k.teile_entfernen.map((x) => String(x).trim()));
      const teile = (bg.teile ?? []).filter((t) => !weg.has(String(t.pos).trim()));
      const ober = OBER_ZNG.includes(k.oberflaeche as ZeichnungOberflaeche) ? (k.oberflaeche as ZeichnungOberflaeche) : bg.merkmale?.oberflaeche ?? 'roh';
      const neu: BaugruppeAnsatz = { ...bg, teile, merkmale: { ...bg.merkmale, oberflaeche: ober, zusatz_h: k.zusammenbau_h > 0 ? r2(k.zusammenbau_h) : bg.merkmale?.zusatz_h ?? 0 } };
      // Zeichnungsgewicht gilt nicht mehr, wenn Unterbaugruppen herausgenommen sind
      if (weg.size) neu.gewicht_zeichnung_kg = null;
      Object.assign(a, neu);
      ep = baugruppeRechnen(neu, stamm).ep;
      langtext = stuecklistenText(neu);
    } else if (a.art === 'stahl_kg' && k.oberflaeche !== 'unveraendert') {
      a.oberflaeche = oberKg(k.oberflaeche);
      ep = rechnePosition(a as unknown as Ansatz, menge, stamm).ep;
    } else if (a.art) {
      ep = rechnePosition(a as unknown as Ansatz, menge, stamm).ep;
    }
    const grund = k.grund?.trim();
    await sb
      .from('positionen')
      .update({
        oz: k.oz || p.oz,
        kurztext: `${k.benennung || p.kurztext || ''}${fehlt && !/zeichnung fehlt/i.test(k.benennung) ? ', Zeichnung fehlt' : ''}`.slice(0, 200),
        ...(fehlt ? { sicherheit: Math.min(0.15, Number(p.sicherheit ?? 0.15)) } : {}),
        menge,
        ansatz: a,
        ...(ep !== null ? { ep, gp: r2(ep * menge) } : {}),
        ...(langtext ? { langtext } : {}),
        ...(grund ? { begruendung: `${p.begruendung ?? ''}${p.begruendung ? ' ' : ''}Satz: ${grund}`.slice(0, 2000), status: p.status === 'freigegeben' ? 'pruefen' : p.status } : {}),
      })
      .eq('id', p.id);
    geaendert++;
  }

  // 2. Frühere Satz-Positionen ersetzen, solange niemand sie freigegeben hat
  await sb.from('positionen').delete().eq('projekt_id', id).like('quelle', 'satz:%').neq('status', 'freigegeben');
  const zeilen: Record<string, unknown>[] = [];
  for (const f of daten.fehlende_zeichnungen) {
    const kg = Number(f.gewicht_kg ?? 0);
    const stk = f.stk > 0 ? f.stk : 1;
    const ansatz: Record<string, unknown> =
      kg > 0 ? { art: 'stahl_kg', kg_je_einheit: r2(kg), oberflaeche: oberKg(f.oberflaeche), montage: false, blech: true, zeichnung_fehlt: f.zeichnungsnummer } : { art: 'manuell', ep: null, zeichnung_fehlt: f.zeichnungsnummer };
    const ep = kg > 0 ? rechnePosition(ansatz as unknown as Ansatz, stk, stamm).ep : null;
    zeilen.push({
      oz: f.oz,
      kurztext: `${f.benennung}, Zeichnung fehlt`,
      langtext: `${f.benennung}${f.werkstoff ? `, ${f.werkstoff}` : ''}. Zeichnung ${f.zeichnungsnummer} liegt nicht bei.${kg > 0 ? ` Preis nur über ${de(kg)} kg je Stück laut Stückliste.` : ''}`,
      menge: stk,
      einheit: 'Stck',
      typ: ansatz.art,
      ansatz,
      ep,
      gp: ep !== null ? r2(ep * stk) : null,
      sicherheit: 0.15,
      status: 'pruefen',
      begruendung: `Zeichnung ${f.zeichnungsnummer} fehlt im Satz. ${kg > 0 ? `Nur über das Gewicht aus der Stückliste (${de(kg)} kg) mit Ihrer Gewichtsstaffel gerechnet. ` : ''}Bitte Zeichnung anfordern und neu kalkulieren.`,
      quelle: 'satz:fehlt',
    });
  }
  if (daten.zusammenbau?.anlegen && daten.zusammenbau.stunden > 0) {
    const ansatz = { art: 'stunden', stunden_je_einheit: r2(daten.zusammenbau.stunden), montage: false };
    const ep = rechnePosition(ansatz as unknown as Ansatz, 1, stamm).ep;
    zeilen.push({
      oz: daten.zusammenbau.oz || '1',
      kurztext: (daten.zusammenbau.benennung || 'Zusammenbau und Montage').slice(0, 200),
      langtext: 'Zusammenbauen aus den Unterbaugruppen und Kaufteilen: Verschrauben, Dichtungen einlegen, Verschlüsse setzen, Endkontrolle.',
      menge: 1,
      einheit: 'Stck',
      typ: 'stunden',
      ansatz,
      ep,
      gp: ep,
      sicherheit: 0.55,
      status: 'pruefen',
      begruendung: `${de(daten.zusammenbau.stunden, 2)} h geschätzt. ${daten.zusammenbau.grund}`.trim().slice(0, 2000),
      quelle: 'satz:zusammenbau',
    });
  }
  if (daten.kaufteile.length) {
    const stueck = daten.kaufteile.reduce((s, k) => s + (k.stk || 0), 0);
    zeilen.push({
      oz: 'K1',
      kurztext: `Kaufteile laut Stückliste, ${daten.kaufteile.length} Sorten, ${de(stueck, 0)} Stück`,
      langtext: daten.kaufteile.map((k) => `${de(k.stk, 0)} × ${k.bezeichnung}${k.norm && !k.bezeichnung.includes(k.norm) ? ` (${k.norm})` : ''}`).join('\n'),
      menge: 1,
      einheit: 'psch',
      typ: 'zukauf',
      ansatz: { art: 'zukauf', einkauf: null, aufschlag_prozent: 15 },
      ep: null,
      gp: null,
      sicherheit: 0.3,
      status: 'pruefen',
      begruendung: 'Normteile und Zukaufteile sind nicht im Stahlpreis enthalten. Preis beim Lieferanten anfragen und als Einkauf eintragen.',
      quelle: 'satz:kaufteile',
    });
  }
  daten.fremdleistungen.forEach((f, i) =>
    zeilen.push({
      oz: `F${i + 1}`,
      kurztext: `Fremdleistung: ${f.bezeichnung}`.slice(0, 200),
      langtext: f.hinweis,
      menge: 1,
      einheit: 'psch',
      typ: 'zukauf',
      ansatz: { art: 'zukauf', einkauf: null, aufschlag_prozent: 15 },
      ep: null,
      gp: null,
      sicherheit: 0.3,
      status: 'pruefen',
      begruendung: `Laut Zeichnung nötig, aber weder im Stahl noch in der Oberfläche enthalten: ${f.hinweis}`.slice(0, 2000),
      quelle: 'satz:fremd',
    }),
  );
  if (zeilen.length) await sb.from('positionen').insert(zeilen.map((z) => ({ ...z, projekt_id: id, sort: 0 })));

  // 3. Reihenfolge nach OZ (1, 1.1, 1.2, …, K1, F1) und Summe
  const { data: neuAlle } = await sb.from('positionen').select('id,oz,gp,typ,status,ansatz').eq('projekt_id', id);
  const rang = (oz: string | null) => (/^K/i.test(oz ?? '') ? 1 : /^F/i.test(oz ?? '') ? 2 : 0);
  const sortiert = [...(neuAlle ?? [])].sort((x, y) => rang(x.oz) - rang(y.oz) || (x.oz ?? '').localeCompare(y.oz ?? '', 'de', { numeric: true }));
  for (const [i, p] of sortiert.entries()) await sb.from('positionen').update({ sort: i * 10 }).eq('id', p.id);
  const summe = summen((neuAlle ?? []) as unknown as Position[]).gesamt;
  await sb.from('projekte').update({ summe_netto: r2(summe) }).eq('id', id);

  const satz = { datum: new Date().toISOString(), hinweise: daten.hinweise, fehlend: daten.fehlende_zeichnungen.length, kaufteile: daten.kaufteile.length, fremdleistungen: daten.fremdleistungen.length };
  await sb.rpc('ergebnis_setzen', { p_id: id, p_schluessel: 'satz', p_wert: satz });
  const benannt = await automatischBenennen(sb, id, { titel: daten.projektname });
  return NextResponse.json({ geaendert, neu: zeilen.length, benannt, hinweise: daten.hinweise, fehlend: daten.fehlende_zeichnungen.map((f) => `${f.benennung} (${f.zeichnungsnummer})`), kaufteile: daten.kaufteile.length, fremdleistungen: daten.fremdleistungen.map((f) => f.bezeichnung) });
}
