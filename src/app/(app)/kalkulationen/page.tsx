import Link from 'next/link';
import { Archive, MapPin } from 'lucide-react';
import { aktuellesProfil, supabaseServer } from '@/lib/supabase/server';
import { euro, datum } from '@/lib/format';
import { ArtLabel, StandAnzeige, TYP, type KalkZeile } from '@/components/KalkKarte';
import { ProjektAktionen } from '@/components/ProjektAktionen';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Kalkulationen' };

type Zeile = KalkZeile & { archiviert_am: string | null };

const SPALTEN = 'id,typ,titel,kunde,ort,status,ergebnis_label,summe_netto,updated_at,archiviert_am';

export default async function Kalkulationen({ searchParams }: { searchParams: Promise<{ ansicht?: string }> }) {
  const { ansicht } = await searchParams;
  const archiv = ansicht === 'archiv';
  const sb = await supabaseServer();

  const liste = sb.from('projekte').select(SPALTEN);
  const andere = sb.from('projekte').select('id', { count: 'exact', head: true });
  const [{ data }, { count: anzahlAndere }, profil] = await Promise.all([
    archiv
      ? liste.not('archiviert_am', 'is', null).order('archiviert_am', { ascending: false }).limit(500)
      : liste.is('archiviert_am', null).order('updated_at', { ascending: false }).limit(500),
    archiv ? andere.is('archiviert_am', null) : andere.not('archiviert_am', 'is', null),
    aktuellesProfil(),
  ]);
  const projekte = (data ?? []) as Zeile[];
  const darfSchreiben = !!profil && profil.rolle !== 'leser';
  const summe = projekte.reduce((s, p) => s + Number(p.summe_netto ?? 0), 0);
  const anzahl = { aktiv: archiv ? (anzahlAndere ?? 0) : projekte.length, archiv: archiv ? projekte.length : (anzahlAndere ?? 0) };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.02em]">Kalkulationen</h1>
          {archiv ? (
            <p className="mt-1 text-[15px] text-ink-600"><span className="zahl font-semibold text-ink-950">{projekte.length}</span> {projekte.length === 1 ? 'archivierte Kalkulation' : 'archivierte Kalkulationen'}. Die Preise bleiben im Archiv für spätere Vergleiche.</p>
          ) : (
            <p className="mt-1 text-[15px] text-ink-600"><span className="zahl font-semibold text-ink-950">{projekte.length}</span> {projekte.length === 1 ? 'Kalkulation' : 'Kalkulationen'}, zusammen <span className="zahl font-semibold text-ink-950">{euro(summe, true)}</span> netto.</p>
          )}
        </div>
        <nav className="flex rounded-full bg-sunken p-1 text-[13px]" aria-label="Ansicht">
          {(
            [
              ['aktiv', 'Aktiv', '/kalkulationen'],
              ['archiv', 'Archiv', '/kalkulationen?ansicht=archiv'],
            ] as const
          ).map(([wert, label, href]) => {
            const an = (wert === 'archiv') === archiv;
            return (
              <Link
                key={wert}
                href={href}
                aria-current={an ? 'page' : undefined}
                className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 font-semibold transition-colors ${an ? 'bg-surface text-ink-950 shadow-[0_1px_3px_rgba(15,28,26,0.12)]' : 'text-ink-600 hover:text-ink-950'}`}
              >
                {label}
                <span className={`zahl text-[12px] ${an ? 'text-ink-500' : 'text-ink-400'}`}>{anzahl[wert]}</span>
              </Link>
            );
          })}
        </nav>
      </div>
      {projekte.length === 0 ? (
        archiv ? (
          <div className="karte flex flex-col items-center gap-2 px-6 py-10 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-sunken text-ink-600"><Archive className="size-5" strokeWidth={1.75} aria-hidden /></span>
            <p className="max-w-[52ch] text-[15px] text-ink-600">Noch nichts archiviert. Geprüfte und freigegebene Kalkulationen landen hier, ihre Preise bleiben im Archiv für spätere Vergleiche.</p>
          </div>
        ) : (
          <div className="karte px-6 py-10 text-center text-[15px] text-ink-600">Noch keine Kalkulation. Oben rechts über „Neue Kalkulation“ anlegen.</div>
        )
      ) : (
        <div className="karte overflow-x-auto">
          <table className="tabelle">
            <thead>
              <tr>
                <th>Projekt</th>
                <th>Art</th>
                <th>Stand</th>
                <th className="text-right">Summe netto</th>
                <th className="text-right">{archiv ? 'Archiviert' : 'Geändert'}</th>
                {darfSchreiben && <th className="w-px"><span className="sr-only">Aktionen</span></th>}
              </tr>
            </thead>
            <tbody>
              {projekte.map((p) => (
                <tr key={p.id} className="hover:bg-[var(--bg-hover)]">
                  <td>
                    <Link href={`/${(TYP[p.typ] ?? TYP.zeichnung).pfad}/${p.id}`} className="text-[15px] font-bold text-ink-950 hover:text-brand-strong">{p.titel}</Link>
                    {(p.kunde || p.ort) && (
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[13px] text-ink-600">
                        {p.kunde && <span>{p.kunde}</span>}
                        {p.ort && <span className="inline-flex items-center gap-1"><MapPin className="size-3" strokeWidth={1.75} aria-hidden />{p.ort}</span>}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap"><ArtLabel typ={p.typ} /></td>
                  <td className="whitespace-nowrap"><StandAnzeige status={p.status} ergebnis={p.ergebnis_label} /></td>
                  <td className="zahl whitespace-nowrap text-right font-semibold">{p.summe_netto ? euro(p.summe_netto, true) : '–'}</td>
                  <td className="zahl whitespace-nowrap text-right text-[13px] text-ink-500">{datum(archiv ? p.archiviert_am : p.updated_at)}</td>
                  {darfSchreiben && (
                    <td className="w-px py-2.5 pl-0 pr-3 text-right align-middle">
                      <ProjektAktionen id={p.id} titel={p.titel} status={p.status} ergebnis_label={p.ergebnis_label} archiviert_am={p.archiviert_am} nachLoeschen="refresh" />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
