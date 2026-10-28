import { NextResponse } from 'next/server';
import { supabaseServer, aktuellesProfil } from '@/lib/supabase/server';
import { KiFehler } from '@/lib/ki';
import { blattLesen, merkmaleAus, type GeleseneBaugruppe } from '@/lib/zeichnung-ki';
import { baugruppeRechnen, stuecklistenText, teilart, type BaugruppeAnsatz } from '@/lib/engine/zeichnung';
import { ladeStammdaten } from '@/lib/daten';

export const runtime = 'nodejs';
export const maxDuration = 300;

/** Liest ein Blatt einer Werkstattzeichnung und legt je Position eine kalkulierte Baugruppe an. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profil = await aktuellesProfil();
  if (!profil || profil.rolle === 'leser') return NextResponse.json({ fehler: 'Keine Berechtigung.' }, { status: 403 });
  const { datei_id, seite = 1, gruendlich = false } = (await req.json()) as { datei_id: string; seite?: number; gruendlich?: boolean };
  const sb = await supabaseServer();
  const { data: datei } = await sb.from('dateien').select('*').eq('id', datei_id).eq('projekt_id', id).maybeSingle();
  if (!datei) return NextResponse.json({ fehler: 'Datei nicht gefunden.' }, { status: 404 });
  const { data: blob, error } = await sb.storage.from('unterlagen').download(datei.pfad);
  if (error || !blob) return NextResponse.json({ fehler: 'Datei konnte nicht geladen werden.' }, { status: 500 });
  const buf = Buffer.from(await blob.arrayBuffer());

  try {
    const { daten, kostenEur, seiten } = await blattLesen({ sb, projektId: id, buf, name: datei.name, seite, stufe: gruendlich ? 'premium' : 'standard' });
    const { werte: stamm } = await ladeStammdaten(sb);

    // Erneutes Lesen desselben Blatts ersetzt die Positionen daraus
    await sb.from('positionen').delete().eq('projekt_id', id).eq('quelle', `zng:${datei_id}:${seite}`);
    const { data: letzte } = await sb.from('positionen').select('sort').eq('projekt_id', id).order('sort', { ascending: false }).limit(1);
    let sort = (letzte?.[0]?.sort ?? -10) + 10;

    const zeichnung = daten.blatt.zeichnungsnummer || datei.name.replace(/\.[a-z0-9]+$/i, '');
    const neu = daten.positionen
      .filter((b) => b.teile.length > 0)
      .map((b: GeleseneBaugruppe) => {
        const ansatz: BaugruppeAnsatz = {
          art: 'baugruppe',
          zeichnung,
          gewicht_zeichnung_kg: b.gewicht_zeichnung_kg,
          teile: b.teile.map((t) => ({ ...t, stk: Math.max(0, t.stk || 0) })),
          merkmale: merkmaleAus(b),
        };
        const r = baugruppeRechnen(ansatz, stamm);
        const haupt = [...ansatz.teile].filter((t) => teilart(t) !== 'kaufteil').sort((x, y) => (y.gewicht_kg ?? 0) - (x.gewicht_kg ?? 0))[0];
        const abweichung = b.gewicht_zeichnung_kg ? Math.abs(r.kennzahlen.kg - b.gewicht_zeichnung_kg) / b.gewicht_zeichnung_kg : 0;
        const sicher = Math.max(0, Math.min(1, b.sicherheit ?? 0));
        const menge = b.anzahl > 0 ? b.anzahl : 1;
        const zeile = {
          projekt_id: id,
          sort,
          oz: b.pos,
          kurztext: `${b.benennung}${haupt ? ` ${haupt.profil.replace(/\*/g, '×')}` : ''}${b.abmessung ? `, ${b.abmessung}` : ''}`.slice(0, 200),
          langtext: stuecklistenText(ansatz),
          menge,
          einheit: 'Stck',
          typ: 'baugruppe',
          ansatz,
          ep: r.ep,
          gp: Math.round(r.ep * menge * 100) / 100,
          sicherheit: abweichung > 0.02 ? Math.min(sicher, 0.7) : sicher,
          status: sicher >= 0.9 && abweichung <= 0.02 ? 'berechnet' : 'pruefen',
          begruendung: b.loesungsweg,
          quelle: `zng:${datei_id}:${seite}`,
        };
        sort += 10;
        return zeile;
      });
    if (neu.length) await sb.from('positionen').insert(neu);

    const { data: pr } = await sb.from('projekte').select('ergebnis').eq('id', id).single();
    const alt = (pr?.ergebnis?.hinweise as string[] | undefined) ?? [];
    const blaetter = { ...((pr?.ergebnis?.blaetter as Record<string, unknown>) ?? {}), [`${datei_id}:${seite}`]: { ...daten.blatt, datei: datei.name, seite } };
    const blattHinweise = daten.hinweise.map((h) => `${zeichnung}: ${h}`);
    await sb.from('projekte').update({ ergebnis: { ...(pr?.ergebnis ?? {}), blaetter, hinweise: Array.from(new Set([...alt, ...blattHinweise])).slice(0, 60) } }).eq('id', id);
    await sb.from('dateien').update({ seiten, gelesen_bis: seite, art: 'zeichnung' }).eq('id', datei_id);
    return NextResponse.json({ fertig: seite >= seiten, neu: neu.length, seiten, naechste: seite < seiten ? seite + 1 : null, kosten: kostenEur, blatt: daten.blatt });
  } catch (e) {
    const msg = e instanceof KiFehler ? e.nutzerText : 'Beim Lesen ist ein Fehler aufgetreten.';
    console.error('zeichnung lesen', e);
    return NextResponse.json({ fehler: msg }, { status: 502 });
  }
}
