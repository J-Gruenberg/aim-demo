import { NextResponse } from 'next/server';
import { supabaseServer, aktuellesProfil } from '@/lib/supabase/server';
import { darfLoeschen, NUR_ARCHIVIEREN } from '@/lib/projekt-aktionen';
import { vorschauPfad } from '@/lib/vorschau';

export const runtime = 'nodejs';

type Sb = Awaited<ReturnType<typeof supabaseServer>>;

const SEITE = 100;

/** Alle Objekte unter einem Präfix im Bucket „unterlagen“, seitenweise und mit Unterordnern. */
async function alleObjekte(sb: Sb, praefix: string, tiefe = 0): Promise<string[]> {
  const pfade: string[] = [];
  for (let offset = 0; ; offset += SEITE) {
    const { data, error } = await sb.storage.from('unterlagen').list(praefix, { limit: SEITE, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw error;
    if (!data?.length) break;
    for (const o of data) {
      const pfad = `${praefix}/${o.name}`;
      // Ordner haben keine id
      if (o.id === null) {
        if (tiefe < 3) pfade.push(...(await alleObjekte(sb, pfad, tiefe + 1)));
      } else {
        pfade.push(pfad);
      }
    }
    if (data.length < SEITE) break;
  }
  return pfade;
}

/** Kalkulation endgültig löschen, nur Entwürfe mit offenem Ausgang. Hochgeladene Unterlagen werden mit entfernt. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profil = await aktuellesProfil();
  if (!profil) return NextResponse.json({ fehler: 'Bitte anmelden.' }, { status: 401 });
  if (profil.rolle === 'leser') return NextResponse.json({ fehler: 'Keine Berechtigung.' }, { status: 403 });
  const sb = await supabaseServer();

  const { data: p } = await sb.from('projekte').select('id,status,ergebnis_label').eq('id', id).maybeSingle();
  if (!p) return NextResponse.json({ fehler: 'Kalkulation nicht gefunden.' }, { status: 404 });
  if (!darfLoeschen(p)) return NextResponse.json({ fehler: NUR_ARCHIVIEREN }, { status: 409 });

  // Pfade vor dem Löschen sammeln, die Dateizeilen verschwinden mit dem Projekt
  const pfade = new Set<string>();
  try {
    for (const pfad of await alleObjekte(sb, id)) pfade.add(pfad);
  } catch (e) {
    console.error('projekt loeschen: unterlagen auflisten', id, e);
    return NextResponse.json({ fehler: 'Die Unterlagen konnten nicht geprüft werden. Bitte noch einmal versuchen.' }, { status: 502 });
  }
  const { data: dateien } = await sb.from('dateien').select('pfad').eq('projekt_id', id);
  for (const d of dateien ?? []) {
    if (!d.pfad) continue;
    pfade.add(d.pfad);
    pfade.add(vorschauPfad(d.pfad));
  }

  // Regel auch im Löschbefehl selbst, falls der Stand gerade parallel geändert wurde
  const { data: weg, error } = await sb
    .from('projekte')
    .delete()
    .eq('id', id)
    .eq('status', 'entwurf')
    .or('ergebnis_label.is.null,ergebnis_label.eq.offen')
    .select('id');
  if (error) {
    console.error('projekt loeschen', id, error);
    return NextResponse.json({ fehler: 'Löschen ging nicht. Bitte noch einmal versuchen.' }, { status: 500 });
  }
  if (!weg?.length) return NextResponse.json({ fehler: NUR_ARCHIVIEREN }, { status: 409 });

  // Erst nach dem Löschen der Zeile die Dateien entfernen: schlimmstenfalls bleiben verwaiste Dateien, nie ein Projekt ohne Unterlagen
  const liste = [...pfade];
  for (let i = 0; i < liste.length; i += SEITE) {
    const { error: e } = await sb.storage.from('unterlagen').remove(liste.slice(i, i + SEITE));
    if (e) console.error('projekt loeschen: unterlagen entfernen', id, e);
  }
  return NextResponse.json({ ok: true });
}
