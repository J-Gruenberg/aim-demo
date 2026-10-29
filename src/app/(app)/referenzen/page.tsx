import { supabaseServer } from '@/lib/supabase/server';
import { ladeReferenzen } from '@/lib/daten';
import { euro, zahl, datum } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Referenzen' };

const n = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v !== '' ? Number(v) : NaN);

export default async function ReferenzenSeite() {
  const sb = await supabaseServer();
  const refs = await ladeReferenzen(sb);
  const { count: archivAnzahl } = await sb.from('archiv_positionen').select('id', { count: 'exact', head: true });
  const hallen = refs.filter((r) => r.typ === 'halle');
  const andere = refs.filter((r) => r.typ !== 'halle');
  return (
    <div className="space-y-8">
      <div>
        <h1 className="breit text-[34px] font-bold text-tiefblau leading-tight">Referenzen und Archiv</h1>
        <p className="text-grau text-sm mt-1 max-w-3xl">
          Im Echtbetrieb liest AIM hier Ihre Angebote, Auftragsbestätigungen, Kalkulationszettel und Nachkalkulationen ein. Sie werden zum Maßstab für Stahlgewicht, Zeiten und Preisvergleich. Der Beispielbetrieb startet mit leerem Archiv.
        </p>
      </div>
      <section className="karte p-4 text-[13px] text-grau">
        Ihr Archiv enthält {archivAnzahl ?? 0} freigegebene Positionen mit Preis. Jede Position, die Sie freigeben, landet hier und hilft bei der nächsten Anfrage mit ähnlichen Bauteilen.
      </section>
      {hallen.length > 0 && (
      <section className="karte overflow-x-auto">
        <h2 className="px-4 py-3 text-[16px] font-bold text-tiefblau border-b border-linie">Hallen ({hallen.length})</h2>
        <table className="tabelle">
          <thead>
            <tr>
              <th>Projekt</th>
              <th className="text-right">Datum</th>
              <th className="text-right">L × B × Traufe</th>
              <th className="text-right">Fläche</th>
              <th>Ausführung</th>
              <th className="text-right">Stahl</th>
              <th className="text-right">Hallenposition</th>
              <th className="text-right">€/m²</th>
            </tr>
          </thead>
          <tbody>
            {hallen.map((r) => {
              const d = r.daten as Record<string, unknown>;
              const A = n(d.grundflaeche_m2) || n(d.laenge_m) * n(d.breite_m);
              const haupt = n(d.hauptposition_netto);
              const kg = n(d.stahl_kg);
              return (
                <tr key={r.id} className="align-top">
                  <td>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-[11px] text-hell">{[r.angebot_nr ? `Nr. ${r.angebot_nr}` : null, d.hinweis as string | undefined].filter(Boolean).join(' · ')}</div>
                  </td>
                  <td className="text-right whitespace-nowrap text-grau">{datum(r.datum)}</td>
                  <td className="text-right whitespace-nowrap zahl">{Number.isFinite(n(d.laenge_m)) ? `${zahl(n(d.laenge_m))} × ${zahl(n(d.breite_m))}${Number.isFinite(n(d.traufhoehe_m)) ? ` × ${zahl(n(d.traufhoehe_m))}` : ''}` : '–'}</td>
                  <td className="text-right zahl whitespace-nowrap">{Number.isFinite(A) ? `${zahl(A, 0)} m²` : '–'}</td>
                  <td className="text-[12px] text-grau">{[d.oberflaeche, d.dach, d.wand].filter(Boolean).join(' · ')}</td>
                  <td className="text-right zahl whitespace-nowrap">{Number.isFinite(kg) ? `${zahl(kg / 1000, 1)} t` : '–'}{Number.isFinite(kg) && d.stahl_quelle ? <div className="text-[10px] text-hell">{String(d.stahl_quelle)}</div> : null}</td>
                  <td className="text-right zahl whitespace-nowrap">{euro(Number.isFinite(haupt) ? haupt : r.angebot_netto, true)}</td>
                  <td className="text-right zahl whitespace-nowrap">{Number.isFinite(haupt) && Number.isFinite(A) && A > 0 ? euro(haupt / A, true) : '–'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      )}
      {andere.length > 0 && (
        <section className="karte overflow-x-auto">
          <h2 className="px-4 py-3 text-[16px] font-bold text-tiefblau border-b border-linie">Ausschreibungen und Bauteile ({andere.length})</h2>
          <table className="tabelle">
            <thead><tr><th>Projekt</th><th className="text-right">Datum</th><th>Inhalt</th><th className="text-right">Angebot netto</th></tr></thead>
            <tbody>
              {andere.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="font-medium">{r.name}</td>
                  <td className="text-right text-grau whitespace-nowrap">{datum(r.datum)}</td>
                  <td className="text-[12px] text-grau">{String((r.daten as Record<string, unknown>).inhalt ?? '')}</td>
                  <td className="text-right zahl whitespace-nowrap">{euro(r.angebot_netto, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
