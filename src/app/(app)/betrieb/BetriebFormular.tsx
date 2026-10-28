'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { BETRIEB_STANDARD, type Betrieb } from '@/lib/betrieb';

const FELDER: { key: keyof Betrieb; label: string; mehrzeilig?: boolean; liste?: boolean }[] = [
  { key: 'firma', label: 'Firmenname' },
  { key: 'kurz', label: 'Kurzname (Kopfzeile der Anwendung)' },
  { key: 'strasse', label: 'Straße' },
  { key: 'ort', label: 'PLZ und Ort' },
  { key: 'tel', label: 'Telefon' },
  { key: 'fax', label: 'Fax' },
  { key: 'web', label: 'Webseite' },
  { key: 'mail', label: 'E-Mail' },
  { key: 'zeilen', label: 'Zeilen unter dem Namen (eine je Zeile, z. B. Zertifizierung)', liste: true },
  { key: 'leistungen', label: 'Leistungen im Briefkopf (eine je Zeile)', liste: true },
  { key: 'fuss', label: 'Fußzeile (Bank, Register, Geschäftsführung; eine je Zeile)', liste: true },
  { key: 'einleitung', label: 'Einleitungstext im Angebot', mehrzeilig: true },
  { key: 'schluss', label: 'Schlusssatz im Angebot', mehrzeilig: true },
];

export function BetriebFormular({ start, darf }: { start: Betrieb; darf: boolean }) {
  const [b, setB] = useState<Betrieb>(start);
  const [stand, setStand] = useState<string | null>(null);
  const router = useRouter();

  async function speichern(neu: Betrieb) {
    setStand('Speichere …');
    const { error } = await supabaseBrowser().from('betrieb').update({ daten: neu }).eq('id', 1);
    setStand(error ? 'Nicht gespeichert. Nur Administratoren dürfen den Briefkopf ändern.' : 'Gespeichert');
    if (!error) router.refresh();
  }

  return (
    <div className="karte p-5 space-y-4">
      {FELDER.map((f) => {
        const wert = b[f.key];
        return (
          <div key={f.key}>
            <label className="label">{f.label}</label>
            {f.liste ? (
              <textarea className="eingabe h-20 py-2 text-[13px]" disabled={!darf} value={(wert as string[]).join('\n')} onChange={(e) => setB({ ...b, [f.key]: e.target.value.split('\n') })} />
            ) : f.mehrzeilig ? (
              <textarea className="eingabe h-20 py-2 text-[13px]" disabled={!darf} value={wert as string} onChange={(e) => setB({ ...b, [f.key]: e.target.value })} />
            ) : (
              <input className="eingabe" disabled={!darf} value={wert as string} onChange={(e) => setB({ ...b, [f.key]: e.target.value })} />
            )}
          </div>
        );
      })}
      {darf && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-linie">
          <button className="knopf-primaer" onClick={() => speichern({ ...b, zeilen: b.zeilen.filter(Boolean), leistungen: b.leistungen.filter(Boolean), fuss: b.fuss.filter(Boolean) })}>Speichern</button>
          <button
            className="knopf-leise"
            onClick={() => {
              if (!confirm('Briefkopf auf den Beispielbetrieb zurücksetzen?')) return;
              setB(BETRIEB_STANDARD);
              speichern(BETRIEB_STANDARD);
            }}
          >
            Auf Beispielbetrieb zurücksetzen
          </button>
          {stand && <span className="text-[13px] text-grau ml-2">{stand}</span>}
        </div>
      )}
    </div>
  );
}
