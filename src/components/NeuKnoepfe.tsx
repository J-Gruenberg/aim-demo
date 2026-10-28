'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { LEERE_HALLE } from '@/lib/engine/halle';

const PFAD = { halle: 'halle', lv: 'lv', bauteil: 'bauteil', zeichnung: 'zeichnung' } as const;

export function NeuKnoepfe() {
  const router = useRouter();
  const [laedt, setLaedt] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  async function neu(typ: 'halle' | 'lv' | 'bauteil' | 'zeichnung') {
    setLaedt(typ);
    setFehler(null);
    const sb = supabaseBrowser();
    const { data: u } = await sb.auth.getUser();
    const titel = typ === 'halle' ? 'Neue Halle' : typ === 'lv' ? 'Neue Ausschreibung' : typ === 'zeichnung' ? 'Neue Anfrage nach Zeichnung' : 'Neues Angebot Bauteile';
    const { data, error } = await sb
      .from('projekte')
      .insert({ typ, titel, eingaben: typ === 'halle' ? LEERE_HALLE : {}, created_by: u.user?.id })
      .select('id')
      .single();
    setLaedt(null);
    if (error || !data) {
      setFehler('Anlegen ging nicht. Haben Sie Schreibrechte?');
      return;
    }
    router.push(`/${PFAD[typ]}/${data.id}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {fehler && <span className="text-sm text-rot mr-2">{fehler}</span>}
      <button className="knopf-zweit" onClick={() => neu('bauteil')} disabled={!!laedt}>{laedt === 'bauteil' ? 'Lege an …' : '+ Treppe / Geländer'}</button>
      <button className="knopf-zweit" onClick={() => neu('lv')} disabled={!!laedt}>{laedt === 'lv' ? 'Lege an …' : '+ Ausschreibung'}</button>
      <button className="knopf-zweit" onClick={() => neu('halle')} disabled={!!laedt}>{laedt === 'halle' ? 'Lege an …' : '+ Halle'}</button>
      <button className="knopf-primaer" onClick={() => neu('zeichnung')} disabled={!!laedt}>{laedt === 'zeichnung' ? 'Lege an …' : '+ Nach Zeichnung'}</button>
    </div>
  );
}
