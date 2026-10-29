import { notFound } from 'next/navigation';
import { ladePositionsProjekt } from '@/lib/projekt-laden';
import { ladeBetrieb } from '@/lib/betrieb';
import { supabaseServer } from '@/lib/supabase/server';
import { BriefFusszeile, BriefKopfzeile, DRUCK_CSS, Seite, type AngebotKopf } from '@/components/Briefbogen';
import { DruckLeiste } from '@/components/DruckLeiste';
import { mitPreisen, zaehlt } from '@/components/positionen/typen';
import { euro, zahlFest, datum as datumFmt } from '@/lib/format';
import { losStaffel } from '@/lib/engine/staffel';

export async function PositionsAngebot({ id, typ }: { id: string; typ: 'lv' | 'bauteil' | 'zeichnung' }) {
  const d = await ladePositionsProjekt(id, typ);
  if (!d) notFound();
  const BRIEFKOPF = await ladeBetrieb(await supabaseServer());
  const p = d.projekt;
  const kopf: AngebotKopf = { datum: new Date().toISOString().slice(0, 10), ...(p.angebot ?? {}) };
  const pos = mitPreisen(d.positionen, d.stamm).filter((x) => x.typ !== 'fremd' && !x.ansatz?.ausgeblendet);
  const netto = pos.filter(zaehlt).reduce((s, x) => s + Number(x.gp ?? 0), 0);
  const mwst = Math.round(netto * 19) / 100;
  const staffel = typ === 'zeichnung' ? losStaffel(pos, d.stamm) : null;
  const ohnePreis = (x: (typeof pos)[number]) => x.ep === null && x.ansatz?.art === 'zukauf';
  // Ausschreibung: alles muss freigegeben sein. Bauteile: nur offene, zu prüfende oder preislose Positionen zählen.
  const offen = pos.filter((x) => (typ === 'lv' ? x.status !== 'freigegeben' : x.status === 'offen' || x.status === 'pruefen' || x.ep === null)).length;
  return (
    <div className="-mx-4 md:-mx-8 -mt-5 md:-mt-8 py-6 bg-papier min-h-schirm">
      <style>{DRUCK_CSS}</style>
      <DruckLeiste zurueck={`/${typ}/${id}`} projektId={id} kopf={kopf} />
      {offen > 0 && (
        <p className="nicht-drucken max-w-[210mm] mx-auto -mt-3 mb-4 rounded-xl border-l-4 border-[#e0a03a] bg-gelb-hell text-gelb text-[14px] font-medium px-4 py-2.5">
          {offen} {offen === 1 ? 'Position ist' : 'Positionen sind'} noch nicht freigegeben. Bis dahin steht auf dem Ausdruck „Entwurf“.
        </p>
      )}
      <Seite>
        <BriefKopfzeile b={BRIEFKOPF} />
        {offen > 0 && <div className="mt-3 text-[11px] font-bold text-rot border border-rot px-2 py-1 inline-block">ENTWURF · {offen} {offen === 1 ? 'Position' : 'Positionen'} noch nicht freigegeben</div>}
        <div className="grid grid-cols-[1fr_auto] gap-6 mt-8 text-[11px]">
          <div className="min-h-[34mm]">
            <div className="text-[8px] text-grau underline mb-1">{BRIEFKOPF.firma} · {BRIEFKOPF.strasse} · {BRIEFKOPF.ort}</div>
            <div className="whitespace-pre-line">{kopf.empfaenger || [p.kunde, p.ort].filter(Boolean).join('\n')}</div>
          </div>
          <div className="text-right leading-relaxed">
            <div>Angebot: <b>{kopf.nr || '—'}</b></div>
            <div>Datum: {datumFmt(kopf.datum)}</div>
          </div>
        </div>
        <h1 className="text-[15px] font-bold mt-6">{p.titel}</h1>
        <p className="text-[11px] mt-2 leading-relaxed">{BRIEFKOPF.einleitung}</p>
        <table className="w-full text-[10.5px] mt-5 border-collapse">
          <thead>
            <tr className="border-b border-tinte">
              <th className="text-left py-1 w-16">Pos.</th>
              <th className="text-right w-16">Menge</th>
              <th className="text-left pl-2 w-10">Einh.</th>
              <th className="text-left pl-2">Text</th>
              <th className="text-right w-24">Betrag</th>
              <th className="text-right w-24">Gesamt</th>
            </tr>
          </thead>
          <tbody>
            {pos.map((x) => {
              const ep = x.ansatz?.bedarf || x.ansatz?.alternativ;
              return (
                <tr key={x.id} className="border-b border-linie align-top break-inside-avoid">
                  <td className="py-1.5 zahl">{x.oz}</td>
                  <td className="text-right zahl">{x.menge !== null ? zahlFest(Number(x.menge), 2) : ''}</td>
                  <td className="pl-2">{x.einheit}</td>
                  <td className="pl-2 pr-3">
                    <div className="font-medium">{x.kurztext}</div>
                    {typ !== 'lv' && x.langtext && <div className="whitespace-pre-line text-grau mt-0.5">{x.langtext}</div>}
                  </td>
                  <td className="text-right zahl">{ohnePreis(x) ? 'folgt' : euro(x.ep)}</td>
                  <td className="text-right zahl">{ohnePreis(x) ? 'folgt' : ep ? 'E.P.' : euro(x.gp)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="ml-auto w-72 mt-4 text-[11px] space-y-1 break-inside-avoid">
          <div className="flex justify-between"><span>Nettobetrag EUR</span><span className="zahl">{euro(netto)}</span></div>
          <div className="flex justify-between"><span>19,00 % Mehrwertsteuer EUR</span><span className="zahl">{euro(mwst)}</span></div>
          <div className="flex justify-between font-bold border-t border-tinte pt-1"><span>Gesamtbetrag EUR</span><span className="zahl">{euro(netto + mwst)}</span></div>
        </div>
        {staffel && (
          <div className="mt-6 text-[10.5px] break-inside-avoid">
            <div className="font-bold">Preis je Satz nach Losgröße, netto</div>
            <table className="w-full border-collapse mt-1.5">
              <thead>
                <tr className="border-b border-tinte">
                  <th className="text-left py-1">Losgröße</th>
                  <th className="text-right">Preis je Satz</th>
                  <th className="text-right">Los gesamt</th>
                </tr>
              </thead>
              <tbody>
                {staffel.zeilen.map((z) => (
                  <tr key={z.n} className="border-b border-linie">
                    <td className="py-1">{z.n === 1 ? '1 Satz' : `ab ${z.n} Sätzen`}</td>
                    <td className="text-right zahl">{euro(z.jeSatz)}</td>
                    <td className="text-right zahl">{euro(z.jeSatz * z.n)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-grau mt-1">Rüsten und Programmieren fallen einmal je Los an und sind auf die Sätze verteilt.</div>
          </div>
        )}
        <p className="text-[11px] mt-8">{BRIEFKOPF.schluss}</p>
        <p className="text-[11px] mt-4">Mit freundlichen Grüßen</p>
        <div className="flex-1 min-h-8" />
        <BriefFusszeile b={BRIEFKOPF} />
      </Seite>
    </div>
  );
}
