import { NextResponse } from 'next/server';
import { supabaseServer, aktuellesProfil } from '@/lib/supabase/server';
import { KiFehler } from '@/lib/ki';
import { blattLesen, merkmaleAus, type GeleseneBaugruppe } from '@/lib/zeichnung-ki';
import { baugruppeRechnen, stuecklistenText, teilart, type BaugruppeAnsatz } from '@/lib/engine/zeichnung';
import { ladeStammdaten } from '@/lib/daten';
import { rechnePosition, type Ansatz, type Oberflaeche } from '@/lib/engine/bauteile';
import { automatischBenennen } from '@/lib/benennen';
import { summen, type Position } from '@/components/positionen/typen';

export const runtime = 'nodejs';
export const maxDuration = 300;

/** Kurztext ohne Dopplung: das Hauptprofil nur anhängen, wenn es nicht schon in der Benennung steht. */
function kurztextAus(benennung: string, profil?: string, abmessung?: string | null) {
  const norm = (x: string) => x.toLowerCase().replace(/[\s*×x-]/g, '');
  const p = profil ? profil.replace(/\*/g, '×') : '';
  const mitProfil = p && !norm(benennung).includes(norm(p)) ? `${benennung} ${p}` : benennung;
  return `${mitProfil}${abmessung ? `, ${abmessung}` : ''}`.slice(0, 200);
}

/** Oberfläche der Zeichnung auf die Oberflächen der Gewichtskalkulation abbilden. */
function oberflaecheKg(o: string): Oberflaeche {
  if (o === 'verzinkt') return 'verzinkt';
  if (o === 'verzinkt_beschichtet') return 'verzinkt_pulver';
  if (o === 'grundiert' || o === 'beschichtet') return 'grundiert';
  return 'roh';
}

/** Fläche je Stück aus "Gitterrost 1000x1000" (mm) in m², sonst null. */
function rostFlaeche(text: string): number | null {
  const m = text.replace(/,/g, '.').match(/(\d{3,4})\s*[x×*]\s*(\d{3,4})/);
  if (!m) return null;
  const f = (Number(m[1]) * Number(m[2])) / 1_000_000;
  return f > 0.05 && f < 20 ? Math.round(f * 1000) / 1000 : null;
}

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
    const de = (v: number, n = 0) => v.toLocaleString('de-DE', { maximumFractionDigits: n });

    /** Zusammenbauzeichnung ohne Einzelteile: Vorkalkulation über das geschätzte Gewicht (Staffel aus den Stammdaten). */
    const nachGewicht = (b: GeleseneBaugruppe) => {
      const t = b.teile[0];
      const kg = Math.max(0, Number(t?.gewicht_kg ?? b.gewicht_zeichnung_kg ?? 0));
      const anzahl = b.anzahl > 0 ? b.anzahl : 1;
      const text = `${b.benennung} ${t?.profil ?? ''}`;
      const rost = /gitterrost|rost\b/i.test(text) ? rostFlaeche(text) : null;
      const sicher = Math.min(0.5, Math.max(0.2, Number(b.sicherheit ?? 0.4)));
      const basis = { zeichnung, nur_gewicht: true, kg_geschaetzt: kg };
      let ansatz: Ansatz & Record<string, unknown>;
      let menge = anzahl;
      let einheit = 'Stck';
      if (rost) {
        ansatz = { art: 'gitterrost_m2', montage: false, ...basis };
        menge = Math.round(anzahl * rost * 100) / 100;
        einheit = 'm²';
      } else {
        ansatz = { art: 'stahl_kg', kg_je_einheit: Math.round(kg * 10) / 10, oberflaeche: oberflaecheKg(b.oberflaeche), montage: false, blech: /blech|riffel/i.test(text), ...basis };
      }
      const r = rechnePosition(ansatz as Ansatz, menge, stamm);
      const ep = r.ep ?? 0;
      return {
        projekt_id: id,
        oz: b.pos,
        kurztext: kurztextAus(b.benennung, undefined, b.abmessung),
        langtext: `${b.benennung}${t?.profil && t.profil !== b.benennung ? `, ${t.profil}` : ''}. Zeichnung ${zeichnung}, ${anzahl} Stück. Zusammenbauzeichnung ohne Einzelteile, Gewicht geschätzt: rund ${de(kg)} kg je Stück.`,
        menge,
        einheit,
        typ: ansatz.art,
        ansatz,
        ep,
        gp: Math.round(ep * menge * 100) / 100,
        sicherheit: sicher,
        status: 'pruefen',
        begruendung: `${b.loesungsweg} Preis über die Gewichtsstaffel mit Ihren Stammdaten, Einzelteile bitte mit den Fertigungszeichnungen nachrechnen.`.trim(),
        quelle: `zng:${datei_id}:${seite}`,
      };
    };

    const neu = daten.positionen
      .filter((b) => b.teile.length > 0)
      .map((b: GeleseneBaugruppe) => {
        if (b.nur_gewicht) {
          const z = { ...nachGewicht(b), sort };
          sort += 10;
          return z;
        }
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
          kurztext: kurztextAus(b.benennung, haupt?.profil, b.abmessung),
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
    // Summe der Kalkulation mitführen, damit Übersicht und Startseite stimmen
    const { data: alle } = await sb.from('positionen').select('gp,typ,status,ansatz').eq('projekt_id', id);
    const summe = summen((alle ?? []) as unknown as Position[]).gesamt;
    await sb.from('projekte').update({ summe_netto: Math.round(summe * 100) / 100 }).eq('id', id);

    // Hinweise gehören zum Blatt: erneutes Lesen ersetzt sie, statt sie zu stapeln
    const { data: pr } = await sb.from('projekte').select('ergebnis').eq('id', id).single();
    type BlattInfo = { datei?: string; seite?: number; zeichnungsnummer?: string; hinweise?: string[]; kaufteile?: { bezeichnung: string; norm: string; stk: number }[] };
    const blaetter: Record<string, BlattInfo> = { ...((pr?.ergebnis?.blaetter as Record<string, BlattInfo>) ?? {}), [`${datei_id}:${seite}`]: { ...daten.blatt, datei: datei.name, seite, hinweise: daten.hinweise.slice(0, 10), kaufteile: daten.kaufteile ?? [] } };
    const hinweise = Array.from(new Set(Object.values(blaetter).flatMap((b) => (b.hinweise ?? []).map((h) => `${b.zeichnungsnummer || b.datei || ''}: ${h}`)))).slice(0, 60);
    await sb.rpc('ergebnis_setzen', { p_id: id, p_schluessel: 'blaetter', p_wert: blaetter });
    await sb.rpc('ergebnis_setzen', { p_id: id, p_schluessel: 'hinweise', p_wert: hinweise });
    // Nur das erste gelesene Blatt benennt das Projekt, den endgültigen Namen setzt der Zeichnungssatz
    const benannt = await automatischBenennen(sb, id, { titel: daten.blatt.projektname || daten.blatt.projekt || daten.blatt.titel, kunde: daten.blatt.kunde }, { nurStandard: true });
    await sb.from('dateien').update({ seiten, gelesen_bis: seite, art: 'zeichnung' }).eq('id', datei_id);
    return NextResponse.json({ fertig: seite >= seiten, neu: neu.length, seiten, naechste: seite < seiten ? seite + 1 : null, kosten: kostenEur, blatt: daten.blatt, benannt, positionen: neu.map((z) => ({ oz: z.oz, kurztext: z.kurztext, menge: z.menge, einheit: z.einheit, ep: z.ep, gp: z.gp, sicherheit: z.sicherheit, begruendung: z.begruendung })), hinweise: daten.hinweise.slice(0, 10) });
  } catch (e) {
    const msg = e instanceof KiFehler ? e.nutzerText : 'Beim Lesen ist ein Fehler aufgetreten.';
    console.error('zeichnung lesen', e);
    return NextResponse.json({ fehler: msg }, { status: 502 });
  }
}
