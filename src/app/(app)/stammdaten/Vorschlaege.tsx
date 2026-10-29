'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

export type Vorschlag = { id: string; schluessel: string; alt: number | null; neu: number | null; begruendung: string; faelle: number | null; bezeichnung: string };

export function Vorschlaege({ start, darfSchreiben }: { start: Vorschlag[]; darfSchreiben: boolean }) {
  const sb = supabaseBrowser();
  const [liste, setListe] = useState(start);
  if (!liste.length) return null;
  async function erledigen(v: Vorschlag, uebernehmen: boolean) {
    if (uebernehmen) {
      const { data: u } = await sb.auth.getUser();
      await sb.from('stammdaten').update({ wert: v.neu, quelle: `Aus Ihren Korrekturen (${v.faelle} Fälle)` }).eq('schluessel', v.schluessel);
      await sb.from('aenderungen').insert({ feld: `stammdaten:${v.schluessel}`, alt: String(v.alt ?? ''), neu: String(v.neu ?? ''), grund: 'Vorschlag aus Korrekturen übernommen', user_id: u.user?.id });
    }
    await sb.from('stammdaten_vorschlaege').update({ status: uebernehmen ? 'uebernommen' : 'verworfen', erledigt_at: new Date().toISOString() }).eq('id', v.id);
    setListe(liste.filter((x) => x.id !== v.id));
    if (uebernehmen) location.reload();
  }
  return (
    <section className="karte p-4 space-y-3 border-tiefblau/30">
      <div>
        <h2 className="text-[16px] font-bold text-ink-950">Vorschläge aus Ihren Korrekturen</h2>
        <p className="text-[12px] text-grau">Die Software lernt aus den Preisen, die Sie von Hand anpassen. Übernommen wird nichts ohne Ihr Okay.</p>
      </div>
      {liste.map((v) => (
        <div key={v.id} className="rounded-xl bg-blau-hell/60 p-3 flex flex-wrap items-center gap-3">
          <div className="text-[13px] flex-1 min-w-[260px]"><div className="font-medium">{v.bezeichnung}</div>{v.begruendung}</div>
          {darfSchreiben && (
            <div className="flex gap-2">
              <button className="knopf-primaer knopf-klein" onClick={() => erledigen(v, true)}>Übernehmen</button>
              <button className="knopf-leise knopf-klein" onClick={() => erledigen(v, false)}>Verwerfen</button>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
