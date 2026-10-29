import { notFound } from 'next/navigation';
import { ladePositionsProjekt, projektTitel } from '@/lib/projekt-laden';
import { PositionsEditor } from '@/components/positionen/PositionsEditor';
import type { Abgleich, Pruefung } from '@/components/positionen/typen';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  return projektTitel((await params).id);
}

export default async function Seite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await ladePositionsProjekt(id, 'lv');
  if (!d) notFound();
  const p = d.projekt;
  return (
    <PositionsEditor
      modus="lv"
      projekt={{ id: p.id, titel: p.titel, kunde: p.kunde, ort: p.ort, status: p.status, ergebnis_label: p.ergebnis_label }}
      positionen={d.positionen}
      dateien={d.dateien}
      hinweise={(p.ergebnis?.hinweise as string[] | undefined) ?? []}
      abgleich={(p.ergebnis?.abgleich as Abgleich | undefined) ?? null}
      pruefung={(p.ergebnis?.pruefung as Pruefung | undefined) ?? null}
      stamm={d.stamm}
      darfSchreiben={d.darfSchreiben}
    />
  );
}
