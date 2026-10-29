'use client';
import Link from 'next/link';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import type { AngebotKopf } from './Briefbogen';
import { useRouter } from 'next/navigation';

export function DruckLeiste({ zurueck, projektId, kopf, ansichten, ansicht }: { zurueck: string; projektId: string; kopf: AngebotKopf; ansichten?: { wert: string; label: string }[]; ansicht?: string }) {
  const [k, setK] = useState<AngebotKopf>(kopf);
  const [stand, setStand] = useState('');
  const router = useRouter();
  async function speichern() {
    setStand('Speichert …');
    const { error } = await supabaseBrowser().from('projekte').update({ angebot: k }).eq('id', projektId);
    setStand(error ? 'Nicht gespeichert' : 'Gespeichert');
    router.refresh();
  }
  return (
    <div className="nicht-drucken karte p-4 mb-6 space-y-3 max-w-[210mm] mx-auto">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={zurueck} className="knopf-leise knopf-klein">← Zur Kalkulation</Link>
        {ansichten && (
          <div className="flex rounded-[6px] border border-linie-stark overflow-hidden">
            {ansichten.map((a) => (
              <Link key={a.wert} href={`?ansicht=${a.wert}`} className={`px-3 h-8 inline-flex items-center text-[13px] border-l border-linie first:border-l-0 ${ansicht === a.wert ? 'bg-tiefblau text-white font-semibold' : 'text-grau bg-flaeche hover:text-tiefblau'}`}>{a.label}</Link>
            ))}
          </div>
        )}
        <span className="ml-auto text-[13px] text-hell">{stand}</span>
        <button className="knopf-primaer knopf-klein" onClick={() => window.print()}>Drucken / als PDF speichern</button>
      </div>
      <div className="grid sm:grid-cols-[120px_130px_1fr_auto] gap-2 items-end">
        <div><label className="label">Angebots-Nr.</label><input className="eingabe eingabe-klein" value={k.nr ?? ''} onChange={(e) => setK({ ...k, nr: e.target.value })} /></div>
        <div><label className="label">Datum</label><input type="date" className="eingabe eingabe-klein" value={k.datum ?? ''} onChange={(e) => setK({ ...k, datum: e.target.value })} /></div>
        <div><label className="label">Empfänger (eine Zeile je Adresszeile)</label><textarea className="eingabe eingabe-klein h-16 py-1" value={k.empfaenger ?? ''} onChange={(e) => setK({ ...k, empfaenger: e.target.value })} /></div>
        <button className="knopf-zweit knopf-klein" onClick={speichern}>Übernehmen</button>
      </div>
    </div>
  );
}
