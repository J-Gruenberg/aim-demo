import { NextResponse } from 'next/server';
import { supabaseServer, aktuellesProfil } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/** Kalkulation archivieren ({ archiviert: true }) oder wiederherstellen ({ archiviert: false }). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profil = await aktuellesProfil();
  if (!profil) return NextResponse.json({ fehler: 'Bitte anmelden.' }, { status: 401 });
  if (profil.rolle === 'leser') return NextResponse.json({ fehler: 'Keine Berechtigung.' }, { status: 403 });

  let archiviert: unknown;
  try {
    ({ archiviert } = (await req.json()) as { archiviert?: unknown });
  } catch {
    archiviert = undefined;
  }
  if (typeof archiviert !== 'boolean') return NextResponse.json({ fehler: 'Ungültige Anfrage.' }, { status: 400 });

  const sb = await supabaseServer();
  const { data, error } = await sb
    .from('projekte')
    .update({ archiviert_am: archiviert ? new Date().toISOString() : null })
    .eq('id', id)
    .select('id,archiviert_am')
    .maybeSingle();
  if (error) {
    console.error('projekt archivieren', id, error);
    return NextResponse.json({ fehler: archiviert ? 'Archivieren ging nicht. Bitte noch einmal versuchen.' : 'Wiederherstellen ging nicht. Bitte noch einmal versuchen.' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ fehler: 'Kalkulation nicht gefunden.' }, { status: 404 });
  return NextResponse.json({ ok: true, archiviert_am: data.archiviert_am as string | null });
}
