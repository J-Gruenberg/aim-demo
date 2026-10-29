import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { supabaseServer } from '@/lib/supabase/server';
import { euro, datum } from '@/lib/format';
import { ArtLabel, StandAnzeige, TYP, type KalkZeile } from '@/components/KalkKarte';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Kalkulationen' };

export default async function Kalkulationen() {
  const sb = await supabaseServer();
  const { data } = await sb.from('projekte').select('id,typ,titel,kunde,ort,status,ergebnis_label,summe_netto,updated_at').order('updated_at', { ascending: false }).limit(500);
  const projekte = (data ?? []) as KalkZeile[];
  const summe = projekte.reduce((s, p) => s + Number(p.summe_netto ?? 0), 0);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.02em]">Kalkulationen</h1>
          <p className="mt-1 text-[15px] text-ink-600"><span className="zahl font-semibold text-ink-950">{projekte.length}</span> Kalkulationen, zusammen <span className="zahl font-semibold text-ink-950">{euro(summe, true)}</span> netto.</p>
        </div>
      </div>
      {projekte.length === 0 ? (
        <div className="karte px-6 py-10 text-center text-[15px] text-ink-600">Noch keine Kalkulation. Oben rechts über „Neue Kalkulation“ anlegen.</div>
      ) : (
        <div className="karte overflow-x-auto">
          <table className="tabelle">
            <thead>
              <tr>
                <th>Projekt</th>
                <th>Art</th>
                <th>Stand</th>
                <th className="text-right">Summe netto</th>
                <th className="text-right">Geändert</th>
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
                  <td className="zahl whitespace-nowrap text-right text-[13px] text-ink-500">{datum(p.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
