import { supabaseServer, aktuellesProfil } from '@/lib/supabase/server';
import { ladeBetrieb } from '@/lib/betrieb';
import { BetriebFormular } from './BetriebFormular';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Betrieb' };

export default async function BetriebSeite() {
  const sb = await supabaseServer();
  const [b, profil] = await Promise.all([ladeBetrieb(sb), aktuellesProfil()]);
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="breit text-[34px] font-bold text-tiefblau leading-tight">Betrieb und Briefkopf</h1>
        <p className="text-grau text-sm mt-1">Diese Angaben stehen auf jedem Angebot. Für eine Vorführung einfach Name und Anschrift des Interessenten eintragen, dann kommt das Angebot auf seinem Briefkopf raus.</p>
      </div>
      <BetriebFormular start={b} darf={profil?.rolle === 'admin'} />
    </div>
  );
}
