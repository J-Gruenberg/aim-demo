import { PositionsAngebot } from '@/components/PositionsAngebot';

export const dynamic = 'force-dynamic';

export default async function Seite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PositionsAngebot id={id} typ="bauteil" />;
}
