'use client';
import { useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import type { StammdatumZeile } from '@/lib/daten';
import { GRUPPEN } from '@/lib/engine/stammdaten';
import { ZahlFeld } from '@/components/Felder';
import { datum } from '@/lib/format';

export function StammdatenTabelle({ zeilen: start, darfSchreiben }: { zeilen: StammdatumZeile[]; darfSchreiben: boolean }) {
  const [zeilen, setZeilen] = useState(start);
  const [suche, setSuche] = useState('');
  const [nurOffen, setNurOffen] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);

  const gruppen = useMemo(() => {
    const q = suche.trim().toLowerCase();
    const f = zeilen.filter((z) => (!nurOffen || !z.bestaetigt) && (!q || z.bezeichnung.toLowerCase().includes(q) || (z.quelle ?? '').toLowerCase().includes(q)));
    const reihen = [...GRUPPEN, ...Array.from(new Set(f.map((z) => z.gruppe))).filter((g) => !(GRUPPEN as readonly string[]).includes(g))];
    return reihen.map((g) => ({ g, z: f.filter((x) => x.gruppe === g) })).filter((x) => x.z.length);
  }, [zeilen, suche, nurOffen]);

  async function aendern(z: StammdatumZeile, patch: Partial<StammdatumZeile>) {
    const sb = supabaseBrowser();
    const { data: u } = await sb.auth.getUser();
    const neu = { ...z, ...patch };
    setZeilen((alle) => alle.map((x) => (x.schluessel === z.schluessel ? neu : x)));
    const { error } = await sb.from('stammdaten').update({ ...patch, updated_by: u.user?.id }).eq('schluessel', z.schluessel);
    if (error) {
      setMeldung('Speichern ging nicht.');
      setZeilen((alle) => alle.map((x) => (x.schluessel === z.schluessel ? z : x)));
      return;
    }
    if (patch.wert !== undefined && patch.wert !== z.wert) {
      await sb.from('aenderungen').insert({ feld: `stammdaten:${z.schluessel}`, alt: String(z.wert ?? ''), neu: String(patch.wert ?? ''), user_id: u.user?.id });
    }
    setMeldung(`${z.bezeichnung} gespeichert.`);
    setTimeout(() => setMeldung(null), 2500);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input className="eingabe max-w-xs" placeholder="Suchen, z. B. Pfetten" value={suche} onChange={(e) => setSuche(e.target.value)} />
        <label className="flex items-center gap-2 text-sm text-grau"><input type="checkbox" checked={nurOffen} onChange={(e) => setNurOffen(e.target.checked)} /> nur unbestätigte</label>
        {meldung && <span className="text-sm text-gruen ml-auto">{meldung}</span>}
      </div>
      {gruppen.map(({ g, z }) => (
        <section key={g} className="karte overflow-x-auto">
          <h2 className="px-4 py-3 text-[16px] font-bold text-tiefblau border-b border-linie">{g}</h2>
          <table className="tabelle">
            <thead>
              <tr>
                <th>Bezeichnung</th>
                <th className="text-right w-[140px]">Wert</th>
                <th className="w-24">Einheit</th>
                <th>Quelle</th>
                <th className="w-28 text-center">Bestätigt</th>
              </tr>
            </thead>
            <tbody>
              {z.map((s) => (
                <tr key={s.schluessel}>
                  <td className={s.bestaetigt ? '' : 'shadow-[inset_3px_0_0_#e0a03a]'} title={s.bestaetigt ? undefined : 'Noch nicht bestätigt'}>
                    <div className="font-medium text-[13px]">{s.bezeichnung}</div>
                    {s.notiz && <div className="text-[11px] text-hell">{s.notiz}</div>}
                  </td>
                  <td>{darfSchreiben ? <ZahlFeld klein wert={s.wert} stellen={3} onWert={(v) => v !== s.wert && aendern(s, { wert: v })} ariaLabel={s.bezeichnung} /> : <span className="zahl">{s.wert}</span>}</td>
                  <td className="text-grau text-[12px] pt-3">{s.einheit}</td>
                  <td className="text-[12px] text-grau pt-3">
                    {s.quelle}
                    <span className="text-hell">, {datum(s.updated_at)}</span>
                  </td>
                  <td className="text-center pt-2.5">
                    <input type="checkbox" checked={s.bestaetigt} disabled={!darfSchreiben} onChange={(e) => aendern(s, { bestaetigt: e.target.checked })} aria-label={`${s.bezeichnung} bestätigt`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
