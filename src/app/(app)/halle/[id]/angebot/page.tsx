import { notFound } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { ladeReferenzen, ladeStammdaten, referenzPunkte } from '@/lib/daten';
import { berechneHalle, LEERE_HALLE, type HallenEingaben } from '@/lib/engine/halle';
import { baubeschreibung } from '@/lib/angebot/baubeschreibung';
import { ladeBetrieb } from '@/lib/betrieb';
import { BriefFusszeile, BriefKopfzeile, DRUCK_CSS, Seite, type AngebotKopf } from '@/components/Briefbogen';
import { DruckLeiste } from '@/components/DruckLeiste';
import { euro, zahlFest, datum as datumFmt } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function HallenAngebot({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ansicht?: string }> }) {
  const { id } = await params;
  const { ansicht = 'angebot' } = await searchParams;
  const sb = await supabaseServer();
  const BRIEFKOPF = await ladeBetrieb(sb);
  const { data: p } = await sb.from('projekte').select('*').eq('id', id).maybeSingle();
  if (!p || p.typ !== 'halle') notFound();
  const [{ werte }, refs] = await Promise.all([ladeStammdaten(sb), ladeReferenzen(sb, 'halle')]);
  const e: HallenEingaben = { ...LEERE_HALLE, ...(p.eingaben ?? {}), optionen: { ...LEERE_HALLE.optionen, ...(p.eingaben?.optionen ?? {}) }, manuell: p.eingaben?.manuell ?? {} };
  const erg = berechneHalle(e, werte, referenzPunkte(refs));
  const kopf: AngebotKopf = { datum: new Date().toISOString().slice(0, 10), ...(p.angebot ?? {}) };
  const bauantrag = erg.zeilen.find((z) => z.key === 'bauantrag' && z.aktiv);
  // Bauantrag als eigene Position, Rest als Hallenposition
  const anteilBauantrag = bauantrag ? Math.round((bauantrag.gp * (1 + erg.zuschlag_prozent / 100)) / 100) * 100 : 0;
  const hallenpreis = erg.angebot_gerundet - anteilBauantrag;
  const positionen = [
    ...(bauantrag ? [{ pos: '010', menge: 1, einheit: 'Stück', text: 'Bauantrag für das Hallenprojekt erstellen und einreichen, einschließlich Brand- und Wärmeschutznachweis', ep: anteilBauantrag }] : []),
    {
      pos: bauantrag ? '020' : '010',
      menge: 1,
      einheit: 'Stück',
      text: `${p.titel && !/^neue halle$/i.test(p.titel) ? p.titel + ': ' : ''}Hallenbau gemäß nachfolgender Baubeschreibung herstellen und montieren, Oberfläche ${e.oberflaeche}, Größe: ${zahlFest(e.laenge)} × ${zahlFest(e.breite)} × ${zahlFest(e.traufhoehe)} m Traufhöhe`,
      ep: hallenpreis,
    },
  ];
  const netto = positionen.reduce((s, x) => s + x.ep * x.menge, 0);
  const mwst = Math.round(netto * 19) / 100;
  const abschnitte = baubeschreibung(e, erg);

  return (
    <div className="-mx-4 md:-mx-8 -mt-5 md:-mt-8 py-6 bg-papier min-h-dvh">
      <style>{DRUCK_CSS}</style>
      <DruckLeiste zurueck={`/halle/${id}`} projektId={id} kopf={kopf} ansicht={ansicht} ansichten={[{ wert: 'angebot', label: 'Angebot' }, { wert: 'zettel', label: 'Kalkulationsblatt (intern)' }]} />
      {ansicht === 'zettel' ? (
        <Seite>
          <h1 className="text-[18px] font-bold">Kalkulation Hallenbau</h1>
          <div className="flex justify-between text-[11px] mt-1 mb-3">
            <span>Objekt: {p.titel}{p.kunde ? ` · ${p.kunde}` : ''}</span>
            <span>Größe: {zahlFest(e.laenge)} × {zahlFest(e.breite)} × {zahlFest(e.traufhoehe)} m · {datumFmt(kopf.datum)}</span>
          </div>
          <table className="w-full text-[10.5px] border-collapse">
            <thead><tr className="border-b border-tinte"><th className="text-left py-1">Position</th><th className="text-right">Menge</th><th className="text-left pl-2">Einh.</th><th className="text-right">EP</th><th className="text-right">Gesamt</th></tr></thead>
            <tbody>
              {erg.zeilen.map((z) => (
                <tr key={z.key} className={`border-b border-linie ${z.aktiv ? '' : 'text-hell'}`}>
                  <td className="py-[3px]">{z.bezeichnung}</td>
                  <td className="text-right zahl">{z.aktiv ? zahlFest(z.menge, z.einheit === 'Stck' || z.einheit === 'psch' ? 0 : 2) : ''}</td>
                  <td className="pl-2">{z.aktiv ? z.einheit : ''}</td>
                  <td className="text-right zahl">{z.aktiv ? euro(z.ep) : ''}</td>
                  <td className="text-right zahl">{z.aktiv ? euro(z.gp) : '–'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-tinte font-semibold"><td className="py-1">Gesamt netto</td><td colSpan={3}></td><td className="text-right zahl">{euro(erg.summe_netto)}</td></tr>
              <tr><td>Zuschlag {zahlFest(erg.zuschlag_prozent, 1)} %</td><td colSpan={3}></td><td className="text-right zahl">{euro(erg.zuschlag)}</td></tr>
              <tr className="font-semibold"><td>Angebotspreis gerundet</td><td colSpan={3}></td><td className="text-right zahl">{euro(erg.angebot_gerundet)}</td></tr>
            </tfoot>
          </table>
          <div className="mt-4 text-[10px] text-grau space-y-0.5">
            <div>Stahl: {zahlFest(erg.stahl.kg / 1000, 2)} t ({zahlFest(erg.stahl.kg_m2, 1)} kg/m²), {erg.stahl.methode === 'stahlliste' && erg.stahl.liste ? 'Stahlliste: ' + erg.stahl.liste.positionen.map((p) => `${zahlFest(p.meter, 0)} m ${p.profil}`).join(', ') + ` + ${erg.stahl.liste.kleinteile_prozent} %` : erg.stahl.methode === 'referenzen' ? 'aus Referenzhallen ' + erg.stahl.referenzen.map((r) => r.name).join(', ') : erg.stahl.methode === 'manuell' ? 'von Hand' : 'Faustwert'}</div>
            <div>Grundfläche {zahlFest(erg.geometrie.grundflaeche, 0)} m² · Dach {zahlFest(erg.geometrie.dachflaeche, 0)} m² · Wand {zahlFest(erg.geometrie.wandflaeche, 0)} m² · {erg.geometrie.rahmen} Rahmen</div>
            {e.notiz && <div className="pt-2 text-tinte">Notiz: {e.notiz}</div>}
          </div>
        </Seite>
      ) : (
        <div className="space-y-6 print:space-y-0">
          <Seite>
            <BriefKopfzeile b={BRIEFKOPF} />
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
            <h1 className="text-[15px] font-bold mt-6">Hallenbau</h1>
            <p className="text-[11px] mt-2 leading-relaxed">{BRIEFKOPF.einleitung}</p>
            <table className="w-full text-[11px] mt-5 border-collapse">
              <thead><tr className="border-b border-tinte"><th className="text-left py-1 w-10">Pos.</th><th className="text-right w-14">Menge</th><th className="text-left pl-2 w-12">Einh.</th><th className="text-left pl-2">Text</th><th className="text-right w-24">Betrag</th><th className="text-right w-24">Gesamt</th></tr></thead>
              <tbody>
                {positionen.map((x) => (
                  <tr key={x.pos} className="border-b border-linie align-top">
                    <td className="py-1.5">{x.pos}</td>
                    <td className="text-right zahl">{zahlFest(x.menge)}</td>
                    <td className="pl-2">{x.einheit}</td>
                    <td className="pl-2 pr-3">{x.text}</td>
                    <td className="text-right zahl">{euro(x.ep)}</td>
                    <td className="text-right zahl">{euro(x.ep * x.menge)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="ml-auto w-72 mt-4 text-[11px] space-y-1">
              <div className="flex justify-between"><span>Nettobetrag EUR</span><span className="zahl">{euro(netto)}</span></div>
              <div className="flex justify-between"><span>19,00 % Mehrwertsteuer EUR</span><span className="zahl">{euro(mwst)}</span></div>
              <div className="flex justify-between font-bold border-t border-tinte pt-1"><span>Gesamtbetrag EUR</span><span className="zahl">{euro(netto + mwst)}</span></div>
            </div>
            <p className="text-[11px] mt-8">{BRIEFKOPF.schluss}</p>
            <p className="text-[11px] mt-4">Mit freundlichen Grüßen</p>
            <div className="flex-1" />
            <BriefFusszeile b={BRIEFKOPF} />
          </Seite>
          <Seite>
            <div className="flex justify-between text-[10px] text-grau border-b border-linie pb-2">
              <span>Neustadt-Glewe, den {datumFmt(kopf.datum)}</span>
              <span>Angebot {kopf.nr || ''}</span>
            </div>
            <h2 className="text-[14px] font-bold mt-4">BAUBESCHREIBUNG</h2>
            <p className="text-[11px] mt-1">{p.titel}: {zahlFest(e.laenge)} × {zahlFest(e.breite)} × {zahlFest(e.traufhoehe)} m Traufhöhe</p>
            <div className="mt-4 space-y-3 text-[10.5px] leading-relaxed">
              {abschnitte.map((a) => (
                <div key={a.titel} className="break-inside-avoid">
                  <h3 className="font-bold underline underline-offset-2">{a.titel}</h3>
                  {a.absaetze.map((t, i) => <p key={i} className="mt-0.5">{t}</p>)}
                </div>
              ))}
            </div>
            <div className="flex-1" />
            <BriefFusszeile b={BRIEFKOPF} />
          </Seite>
        </div>
      )}
    </div>
  );
}
