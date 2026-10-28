import { redirect } from 'next/navigation';
import { aktuellesProfil, supabaseServer } from '@/lib/supabase/server';
import { ladeBetrieb } from '@/lib/betrieb';
import { Kopfzeile } from '@/components/Kopfzeile';
import { Fusszeile } from '@/components/Fusszeile';
import { Abmelden } from '@/components/Abmelden';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profil = await aktuellesProfil();
  if (!profil) {
    return (
      <main className="min-h-dvh grid place-items-center p-6">
        <div className="karte p-8 max-w-md text-center">
          <h1 className="text-lg font-semibold">Kein Zugang freigeschaltet</h1>
          <p className="text-grau text-sm mt-2">Ihr Konto ist angemeldet, aber noch nicht für diesen Betrieb freigegeben.</p>
          <div className="mt-6"><Abmelden /></div>
        </div>
      </main>
    );
  }
  if (!profil) redirect('/login');
  const betrieb = await ladeBetrieb(await supabaseServer());
  return (
    <div className="min-h-dvh flex flex-col">
      <Kopfzeile name={profil.name ?? profil.email} rolle={profil.rolle} betrieb={betrieb.kurz} />
      <main className="flex-1 mx-auto w-full max-w-[1400px] px-4 sm:px-6 py-6 sm:py-8">{children}</main>
      <Fusszeile />
    </div>
  );
}
