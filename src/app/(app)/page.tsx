import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import { euro, datum } from '@/lib/format';
import { NeuAnlegen } from '@/components/NeuKnoepfe';
import { ladeBetrieb } from '@/lib/betrieb';

export const dynamic = 'force-dynamic';

const TYP: Record<string, { label: string; pfad: string }> = {
  zeichnung: { label: 'Nach Zeichnung', pfad: 'zeichnung' },
  halle: { label: 'Hallenbau', pfad: 'halle' },
  lv: { label: 'Ausschreibung', pfad: 'lv' },
  bauteil: { label: 'Treppe, Geländer, Stahlbau', pfad: 'bauteil' },
};

const STATUS: Record<string, { label: string; text: string; punkt: string }> = {
  entwurf: { label: 'Entwurf', text: 'text-grau', punkt: 'bg-linie-stark' },
  in_pruefung: { label: 'In Prüfung', text: 'text-gelb', punkt: 'bg-[#e0a03a]' },
  freigegeben: { label: 'Freigegeben', text: 'text-gruen', punkt: 'bg-gruen' },
  abgegeben: { label: 'Abgegeben', text: 'text-tiefblau', punkt: 'bg-tiefblau' },
};

const LABEL: Record<string, string> = { offen: '', beauftragt: 'Beauftragt', nicht_beauftragt: 'Nicht beauftragt' };

export default async function Uebersicht() {
  const sb = await supabaseServer();
  const { data } = await sb.from('projekte').select('id,typ,titel,kunde,ort,status,ergebnis_label,summe_netto,updated_at,abgabe').order('updated_at', { ascending: false }).limit(200);
  const projekte = data ?? [];
  const betrieb = await ladeBetrieb(sb);

  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <div>
          <p className="text-[14px] text-grau">{betrieb.firma}</p>
          <h1 className="breit text-[34px] font-bold text-tiefblau leading-tight">Kalkulationen</h1>
        </div>
        <NeuAnlegen />
      </div>

      <section className="space-y-3">
        <h2 className="breit text-[19px] font-bold text-tiefblau">Zuletzt bearbeitet</h2>
        {projekte.length === 0 ? (
          <div className="raster rounded-[6px] border border-linie px-6 py-10 text-center">
            <p className="text-[15px] font-semibold text-tiefblau">Noch keine Kalkulation angelegt.</p>
            <p className="text-[14px] text-grau mt-1">Am schnellsten geht es mit „Nach Zeichnung“: anlegen und die Beispielzeichnungen laden.</p>
          </div>
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
                {projekte.map((p) => {
                  const st = STATUS[p.status] ?? STATUS.entwurf;
                  return (
                    <tr key={p.id} className="hover:bg-blau-hell/40">
                      <td>
                        <Link href={`/${TYP[p.typ].pfad}/${p.id}`} className="text-[15px] font-semibold text-tiefblau hover:text-rot">{p.titel}</Link>
                        {(p.kunde || p.ort) && <div className="text-[13px] text-hell">{[p.kunde, p.ort].filter(Boolean).join(', ')}</div>}
                      </td>
                      <td className="text-grau whitespace-nowrap">{TYP[p.typ].label}</td>
                      <td className="whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 text-[13px] font-semibold ${st.text}`}><span className={`w-2 h-2 rounded-full ${st.punkt}`} />{st.label}</span>
                        {LABEL[p.ergebnis_label ?? 'offen'] && <div className="text-[12px] text-hell">{LABEL[p.ergebnis_label ?? 'offen']}</div>}
                      </td>
                      <td className="text-right zahl text-[15px] font-semibold whitespace-nowrap">{euro(p.summe_netto, true)}</td>
                      <td className="text-right text-grau whitespace-nowrap">{datum(p.updated_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
