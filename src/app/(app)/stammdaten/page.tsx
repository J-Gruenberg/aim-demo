import { supabaseServer, aktuellesProfil } from '@/lib/supabase/server';
import { ladeStammdaten } from '@/lib/daten';
import { StammdatenTabelle } from './StammdatenTabelle';
import { Vorschlaege, type Vorschlag } from './Vorschlaege';
import { vorschlaegeAktualisieren } from '@/lib/lernen';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Stammdaten' };

export default async function StammdatenSeite() {
  const sb = await supabaseServer();
  const profil0 = await aktuellesProfil();
  if (profil0 && profil0.rolle !== 'leser') await vorschlaegeAktualisieren(sb).catch(() => 0);
  const [{ zeilen }, profil, { data: vs }] = await Promise.all([ladeStammdaten(sb), Promise.resolve(profil0), sb.from('stammdaten_vorschlaege').select('*').eq('status', 'offen').order('created_at')]);
  const vorschlaege: Vorschlag[] = (vs ?? []).map((v) => ({ ...v, bezeichnung: zeilen.find((z) => z.schluessel === v.schluessel)?.bezeichnung ?? v.schluessel }));
  const offen = zeilen.filter((z) => !z.bestaetigt).length;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Stammdaten</h1>
          <p className="text-grau text-sm mt-1 max-w-2xl">
            Ihre Kalkulationsgrundlagen. Jede Kalkulation rechnet mit diesen Werten. Was aus Ihren Zetteln und Angeboten stammt, steht in der Quelle. Annahmen sind gelb markiert, bis Sie sie bestätigen.
          </p>
        </div>
        <div className="karte px-4 py-3 text-sm">
          <span className="zahl font-semibold">{zeilen.length - offen}</span> von <span className="zahl">{zeilen.length}</span> Werten bestätigt
        </div>
      </div>
      <Vorschlaege start={vorschlaege} darfSchreiben={profil?.rolle !== 'leser'} />
      <StammdatenTabelle zeilen={zeilen} darfSchreiben={profil?.rolle !== 'leser'} />
    </div>
  );
}
