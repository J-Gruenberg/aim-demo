import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import { euro, datum } from '@/lib/format';
import { NeuKnoepfe } from '@/components/NeuKnoepfe';
import { ladeBetrieb } from '@/lib/betrieb';

export const dynamic = 'force-dynamic';

const TYP: Record<string, { label: string; pfad: string }> = {
  zeichnung: { label: 'Nach Zeichnung', pfad: 'zeichnung' },
  halle: { label: 'Hallenbau', pfad: 'halle' },
  lv: { label: 'Ausschreibung', pfad: 'lv' },
  bauteil: { label: 'Treppe · Geländer · Stahlbau', pfad: 'bauteil' },
};

const STATUS: Record<string, { label: string; klasse: string }> = {
  entwurf: { label: 'Entwurf', klasse: 'bg-papier text-grau border border-linie' },
  in_pruefung: { label: 'In Prüfung', klasse: 'bg-gelb-hell text-gelb' },
  freigegeben: { label: 'Freigegeben', klasse: 'bg-gruen-hell text-gruen' },
  abgegeben: { label: 'Abgegeben', klasse: 'bg-blau-hell text-tiefblau' },
};

const LABEL: Record<string, string> = { offen: '', beauftragt: 'Beauftragt', nicht_beauftragt: 'Nicht beauftragt' };

export default async function Uebersicht() {
  const sb = await supabaseServer();
  const { data } = await sb.from('projekte').select('id,typ,titel,kunde,ort,status,ergebnis_label,summe_netto,updated_at,abgabe').order('updated_at', { ascending: false }).limit(200);
  const projekte = data ?? [];
  const { count: refCount } = await sb.from('referenzen').select('id', { count: 'exact', head: true });
  const betrieb = await ladeBetrieb(sb);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12px] uppercase tracking-[0.16em] text-hell">{betrieb.firma}</p>
          <h1 className="text-[28px] font-semibold tracking-tight mt-1">Kalkulationen</h1>
        </div>
        <NeuKnoepfe />
      </div>

      {projekte.length === 0 ? (
        <div className="karte p-10 grid md:grid-cols-2 xl:grid-cols-4 gap-8">
          <EinstiegsKarte nummer="1" titel="Nach Zeichnung" text="Werkstattzeichnungen ablegen. AIM liest Stückliste, Bohrungen und Nähte und rechnet jede Position mit Ihren Kostenstellen und Zuschlägen." />
          <EinstiegsKarte nummer="2" titel="Ausschreibung" text="LV als PDF oder GAEB plus Pläne hochladen. Positionen werden erkannt, Massen vorgeschlagen, Sie prüfen und geben frei." />
          <EinstiegsKarte nummer="3" titel="Hallenbau" text="Länge, Breite, Höhe eingeben. Der Hallen-Vordruck füllt sich selbst, inklusive Stahlliste und Baubeschreibung." />
          <EinstiegsKarte nummer="4" titel="Treppe, Geländer, Stahlbau" text="Einzelbauteile mit Faustformeln: Geländer nach Meter und Aufwand, Treppen nach Steigungen, Stahl nach Gewicht." />
          <p className="md:col-span-2 xl:col-span-4 text-sm text-grau border-t border-linie pt-6">
            {refCount ? `${refCount} Referenzprojekte aus Ihrem Archiv sind bereits hinterlegt. ` : ''}Starten Sie oben rechts mit einer neuen Kalkulation.
          </p>
        </div>
      ) : (
        <div className="karte overflow-x-auto">
          <table className="tabelle">
            <thead>
              <tr>
                <th>Projekt</th>
                <th>Art</th>
                <th>Status</th>
                <th className="text-right">Summe netto</th>
                <th className="text-right">Geändert</th>
              </tr>
            </thead>
            <tbody>
              {projekte.map((p) => (
                <tr key={p.id} className="hover:bg-papier/60">
                  <td>
                    <Link href={`/${TYP[p.typ].pfad}/${p.id}`} className="font-medium hover:text-rot">{p.titel}</Link>
                    {(p.kunde || p.ort) && <div className="text-[12px] text-hell">{[p.kunde, p.ort].filter(Boolean).join(' · ')}</div>}
                  </td>
                  <td className="text-grau whitespace-nowrap">{TYP[p.typ].label}</td>
                  <td>
                    <span className={`marke ${STATUS[p.status].klasse}`}>{STATUS[p.status].label}</span>
                    {LABEL[p.ergebnis_label ?? 'offen'] && <span className="marke ml-1 text-grau">{LABEL[p.ergebnis_label ?? 'offen']}</span>}
                  </td>
                  <td className="text-right zahl whitespace-nowrap">{euro(p.summe_netto, true)}</td>
                  <td className="text-right text-grau whitespace-nowrap">{datum(p.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EinstiegsKarte({ nummer, titel, text }: { nummer: string; titel: string; text: string }) {
  return (
    <div>
      <div className="w-8 h-8 rounded-full bg-tiefblau text-white grid place-items-center text-sm font-semibold">{nummer}</div>
      <h3 className="font-semibold mt-4">{titel}</h3>
      <p className="text-sm text-grau mt-1 leading-relaxed">{text}</p>
    </div>
  );
}
