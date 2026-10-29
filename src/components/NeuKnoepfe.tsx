'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { LEERE_HALLE } from '@/lib/engine/halle';

type Typ = 'halle' | 'lv' | 'bauteil' | 'zeichnung';
const PFAD: Record<Typ, string> = { halle: 'halle', lv: 'lv', bauteil: 'bauteil', zeichnung: 'zeichnung' };
const TITEL: Record<Typ, string> = { halle: 'Neue Halle', lv: 'Neue Ausschreibung', zeichnung: 'Neue Anfrage nach Zeichnung', bauteil: 'Neues Angebot Bauteile' };

const NEBEN: { typ: Typ; titel: string; text: string }[] = [
  { typ: 'lv', titel: 'Ausschreibung', text: 'LV als PDF oder GAEB plus Pläne. Positionen werden erkannt, Sie prüfen und geben frei.' },
  { typ: 'halle', titel: 'Hallenbau', text: 'Länge, Breite, Höhe. Vordruck, Stahlliste und Baubeschreibung füllen sich selbst.' },
  { typ: 'bauteil', titel: 'Treppe, Geländer, Stahlbau', text: 'Einzelbauteile nach Meter, Steigungen oder Gewicht.' },
];

/** Neue Kalkulation anlegen: „Nach Zeichnung“ groß, die übrigen Arten daneben. */
export function NeuAnlegen() {
  const router = useRouter();
  const [laedt, setLaedt] = useState<Typ | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  async function neu(typ: Typ) {
    setLaedt(typ);
    setFehler(null);
    const sb = supabaseBrowser();
    const { data: u } = await sb.auth.getUser();
    const { data, error } = await sb
      .from('projekte')
      .insert({ typ, titel: TITEL[typ], eingaben: typ === 'halle' ? LEERE_HALLE : {}, created_by: u.user?.id })
      .select('id')
      .single();
    if (error || !data) {
      setLaedt(null);
      setFehler('Anlegen ging nicht. Haben Sie Schreibrechte?');
      return;
    }
    router.push(`/${PFAD[typ]}/${data.id}`);
  }

  return (
    <div className="space-y-2">
      <div className="schriftfeld grid lg:grid-cols-[1.5fr_1fr_1fr_1fr] gap-px bg-linie-stark">
        <button
          type="button"
          onClick={() => neu('zeichnung')}
          disabled={!!laedt}
          className="group relative bg-tiefblau text-white text-left p-6 min-h-[200px] flex flex-col overflow-hidden hover:bg-tiefblau-2 transition-colors"
        >
          <ZeichnungsStrich />
          <span className="feldname text-white/60 relative">Neue Kalkulation</span>
          <span className="breit text-[28px] font-bold leading-tight mt-1 relative">Nach Zeichnung</span>
          <span className="text-[15px] text-white/75 mt-2 max-w-[44ch] relative">Werkstattzeichnungen ablegen. AIM liest Stückliste, Bohrungen und Nähte und rechnet jede Position mit Ihren Kostenstellen und Zuschlägen.</span>
          <span className="mt-auto pt-5 relative">
            <span className="knopf-primaer pointer-events-none">{laedt === 'zeichnung' ? 'Lege an …' : 'Anfrage anlegen'}</span>
          </span>
        </button>
        {NEBEN.map((n) => (
          <button
            key={n.typ}
            type="button"
            onClick={() => neu(n.typ)}
            disabled={!!laedt}
            className="bg-flaeche text-left p-5 flex flex-col hover:bg-blau-hell/50 transition-colors"
          >
            <span className="text-[17px] font-bold text-tiefblau">{n.titel}</span>
            <span className="text-[14px] text-grau mt-1.5">{n.text}</span>
            <span className="mt-auto pt-4 text-[14px] font-semibold text-rot">{laedt === n.typ ? 'Lege an …' : 'Anlegen'}</span>
          </button>
        ))}
      </div>
      {fehler && <p className="text-[14px] text-rot font-medium">{fehler}</p>}
    </div>
  );
}

/** Feine Konstruktionslinien eines Trägers mit Maßkette, als Hintergrund der Hauptkachel. */
function ZeichnungsStrich() {
  return (
    <svg className="absolute right-[-30px] bottom-[-18px] w-[300px] opacity-[0.16] pointer-events-none" viewBox="0 0 300 170" aria-hidden>
      <g fill="none" stroke="#fff" strokeWidth="1.4">
        <path d="M20 40 H280 M20 52 H280 M20 118 H280 M20 130 H280" />
        <path d="M20 40 V52 M280 40 V52 M20 118 V130 M280 118 V130" />
        <path d="M144 52 V118 M156 52 V118" />
        <circle cx="70" cy="85" r="7" /><circle cx="230" cy="85" r="7" />
      </g>
      <g fill="none" stroke="#fff" strokeWidth="0.9">
        <path d="M20 150 H280 M20 144 V156 M280 144 V156" />
        <path d="M14 40 V130 M8 40 H20 M8 130 H20" />
      </g>
    </svg>
  );
}
