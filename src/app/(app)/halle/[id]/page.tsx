import { notFound } from 'next/navigation';
import { supabaseServer, aktuellesProfil } from '@/lib/supabase/server';
import { ladeReferenzen, ladeStammdaten, referenzPunkte } from '@/lib/daten';
import { projektTitel } from '@/lib/projekt-laden';
import { HallenEditor } from './HallenEditor';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  return projektTitel((await params).id);
}

export default async function HallenSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await supabaseServer();
  const { data: p } = await sb.from('projekte').select('*').eq('id', id).maybeSingle();
  if (!p || p.typ !== 'halle') notFound();
  const [{ werte }, refs, profil] = await Promise.all([ladeStammdaten(sb), ladeReferenzen(sb, 'halle'), aktuellesProfil()]);
  return (
    <HallenEditor
      projekt={{ id: p.id, titel: p.titel, kunde: p.kunde, ort: p.ort, status: p.status, ergebnis_label: p.ergebnis_label, eingaben: p.eingaben ?? {} }}
      stamm={werte}
      punkte={referenzPunkte(refs)}
      referenzen={refs}
      darfSchreiben={profil?.rolle !== 'leser'}
    />
  );
}
