import { redirect } from 'next/navigation';
import { aktuellesProfil, supabaseServer } from '@/lib/supabase/server';
import { ladeBetrieb } from '@/lib/betrieb';
import { Kopfzeile, MobilNav, Seitenleiste } from '@/components/Kopfzeile';
import { Fusszeile } from '@/components/Fusszeile';
import { Abmelden } from '@/components/Abmelden';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profil = await aktuellesProfil();
  if (!profil) {
    return (
      <main className="aim-flaeche grid min-h-dvh place-items-center p-6">
        <div className="karte max-w-md p-8 text-center">
          <h1 className="text-[20px] font-extrabold">Kein Zugang freigeschaltet</h1>
          <p className="mt-2 text-[14px] text-ink-600">Ihr Konto ist angemeldet, aber noch nicht für diesen Betrieb freigegeben.</p>
          <div className="mt-6"><Abmelden /></div>
        </div>
      </main>
    );
  }
  if (!profil) redirect('/login');
  const betrieb = await ladeBetrieb(await supabaseServer());
  return (
    <div className="aim-flaeche flex min-h-dvh">
      <Seitenleiste betrieb={betrieb.firma} ort={betrieb.ort.replace(/^\d{5}\s*/, '')} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Kopfzeile name={profil.name ?? profil.email} rolle={profil.rolle} darfSchreiben={profil.rolle !== 'leser'} />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-24 pt-5 md:px-8 md:pb-8 md:pt-8">{children}</main>
        <Fusszeile />
      </div>
      <MobilNav />
    </div>
  );
}
