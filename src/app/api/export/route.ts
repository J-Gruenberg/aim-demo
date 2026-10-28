import { NextResponse } from 'next/server';
import { supabaseServer, aktuellesProfil } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const profil = await aktuellesProfil();
  if (!profil) return NextResponse.json({ fehler: 'Bitte anmelden.' }, { status: 401 });
  const sb = await supabaseServer();
  const tabellen = ['projekte', 'positionen', 'dateien', 'stammdaten', 'stammdaten_vorschlaege', 'referenzen', 'archiv_positionen', 'aenderungen', 'ki_aufrufe'] as const;
  const out: Record<string, unknown> = { exportiert_am: new Date().toISOString(), betrieb: 'AIM Beispielbetrieb (Vorführinstanz toolwerk)', hinweis: 'Hochgeladene Dateien stehen in "dateien" mit Download-Link (7 Tage gültig) und sind im jeweiligen Projekt einzeln herunterladbar.' };
  // In Blöcken zu 1.000 Zeilen lesen, die Datenbank liefert je Abfrage höchstens so viele
  for (const t of tabellen) {
    const zeilen: Record<string, unknown>[] = [];
    for (let ab = 0; ; ab += 1000) {
      const spalten = t === 'archiv_positionen' ? 'id,quelle,projekt,datum,pos,text,kategorie,oberflaeche,montage,menge,einheit,ep,gp,kg_je_einheit,kalkulation,projekt_id,position_id,created_at' : '*';
      // Feste Reihenfolge, damit beim Blättern nichts doppelt oder verloren geht
      const ordnung = t === 'stammdaten' ? 'schluessel' : t === 'positionen' ? 'id' : 'created_at';
      const { data } = await sb.from(t).select(spalten).order(ordnung, { ascending: true }).range(ab, ab + 999);
      zeilen.push(...((data ?? []) as unknown as Record<string, unknown>[]));
      if (!data || data.length < 1000) break;
    }
    out[t] = zeilen;
  }
  // Hochgeladene Dateien: Download-Links, 7 Tage gültig
  const dateien = (out.dateien ?? []) as { pfad: string }[];
  for (const d of dateien) {
    const { data } = await sb.storage.from('unterlagen').createSignedUrl(d.pfad, 7 * 24 * 3600);
    (d as Record<string, unknown>).download = data?.signedUrl ?? null;
  }
  return new NextResponse(JSON.stringify(out, null, 1), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="aim-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
