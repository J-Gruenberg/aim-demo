import { notFound } from 'next/navigation';
import { ladePositionsProjekt, projektTitel } from '@/lib/projekt-laden';
import { PositionsEditor } from '@/components/positionen/PositionsEditor';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  return projektTitel((await params).id);
}

export default async function Seite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await ladePositionsProjekt(id, 'zeichnung');
  if (!d) notFound();
  const p = d.projekt;
  return (
    <PositionsEditor
      modus="zeichnung"
      projekt={{ id: p.id, titel: p.titel, kunde: p.kunde, ort: p.ort, status: p.status, ergebnis_label: p.ergebnis_label }}
      positionen={d.positionen}
      dateien={d.dateien}
      hinweise={(p.ergebnis?.hinweise as string[] | undefined) ?? []}
      stamm={d.stamm}
      darfSchreiben={d.darfSchreiben}
    />
  );
}
