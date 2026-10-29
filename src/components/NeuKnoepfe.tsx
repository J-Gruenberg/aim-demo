'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, FileScan, FileSpreadsheet, Plus, Ruler, Warehouse, type LucideIcon } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { LEERE_HALLE } from '@/lib/engine/halle';

export type Typ = 'halle' | 'lv' | 'bauteil' | 'zeichnung';
const PFAD: Record<Typ, string> = { halle: 'halle', lv: 'lv', bauteil: 'bauteil', zeichnung: 'zeichnung' };
const TITEL: Record<Typ, string> = { halle: 'Neue Halle', lv: 'Neue Ausschreibung', zeichnung: 'Neue Anfrage nach Zeichnung', bauteil: 'Neues Angebot Bauteile' };

export const ARTEN: { typ: Typ; titel: string; text: string; icon: LucideIcon; ton: string }[] = [
  { typ: 'zeichnung', titel: 'Nach Zeichnung', text: 'Werkstattzeichnungen ablegen, AIM liest Stückliste, Bohrungen und Nähte.', icon: FileScan, ton: 'bg-label-teal-bg text-label-teal-fg' },
  { typ: 'lv', titel: 'Ausschreibung', text: 'LV als PDF oder GAEB. Positionen werden erkannt, Sie prüfen und geben frei.', icon: FileSpreadsheet, ton: 'bg-label-sky-bg text-label-sky-fg' },
  { typ: 'halle', titel: 'Hallenbau', text: 'Länge, Breite, Höhe. Vordruck, Stahlliste und Baubeschreibung entstehen selbst.', icon: Warehouse, ton: 'bg-label-violet-bg text-label-violet-fg' },
  { typ: 'bauteil', titel: 'Treppe, Geländer, Stahlbau', text: 'Einzelbauteile nach Meter, Steigungen oder Gewicht.', icon: Ruler, ton: 'bg-label-yellow-bg text-label-yellow-fg' },
];

/** Legt eine neue Kalkulation an und öffnet sie. */
export function useNeuAnlegen() {
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
  return { neu, laedt, fehler };
}

/** Knopf „Neue Kalkulation“ mit Auswahl der Art, für die Kopfzeile. */
export function NeuMenue() {
  const { neu, laedt } = useNeuAnlegen();
  const [offen, setOffen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!offen) return;
    const zu = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOffen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOffen(false);
    document.addEventListener('mousedown', zu);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', zu);
      document.removeEventListener('keydown', esc);
    };
  }, [offen]);
  return (
    <div className="relative" ref={ref}>
      <button type="button" className="knopf-primaer" onClick={() => setOffen((o) => !o)} aria-expanded={offen} aria-haspopup="menu">
        <Plus className="size-4" strokeWidth={2} aria-hidden />
        <span className="hidden sm:inline">{laedt ? 'Lege an …' : 'Neue Kalkulation'}</span>
        <ChevronDown className="size-3.5 opacity-80 hidden sm:block" strokeWidth={2} aria-hidden />
      </button>
      {offen && (
        <div role="menu" className="absolute right-0 top-full z-40 mt-2 w-80 rounded-2xl border border-line bg-surface p-1.5 shadow-[var(--shadow-float)]">
          {ARTEN.map((a) => (
            <button
              key={a.typ}
              role="menuitem"
              type="button"
              disabled={!!laedt}
              onClick={() => neu(a.typ)}
              className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-[var(--bg-hover)]"
            >
              <span className={`grid size-9 shrink-0 place-items-center rounded-full ${a.ton}`}><a.icon className="size-[18px]" strokeWidth={1.75} aria-hidden /></span>
              <span className="min-w-0">
                <span className="block text-[14px] font-bold text-ink-950">{a.titel}</span>
                <span className="block text-[13px] leading-[18px] text-ink-600">{a.text}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Die vier Arten als Karten, für die Startseite. */
export function NeuKarten() {
  const { neu, laedt, fehler } = useNeuAnlegen();
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {ARTEN.map((a) => (
          <button
            key={a.typ}
            type="button"
            disabled={!!laedt}
            onClick={() => neu(a.typ)}
            className="karte group flex flex-col items-start gap-3 p-5 text-left transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-px hover:border-line-strong hover:shadow-[var(--shadow-float)]"
          >
            <span className={`grid size-11 place-items-center rounded-full ${a.ton}`}><a.icon className="size-5" strokeWidth={1.75} aria-hidden /></span>
            <span>
              <span className="block text-[16px] font-bold text-ink-950">{a.titel}</span>
              <span className="mt-1 block text-[14px] leading-5 text-ink-600">{a.text}</span>
            </span>
            <span className="mt-auto inline-flex items-center gap-1 pt-1 text-[14px] font-bold text-brand-strong">
              <Plus className="size-4" strokeWidth={2} aria-hidden />
              {laedt === a.typ ? 'Lege an …' : 'Anlegen'}
            </span>
          </button>
        ))}
      </div>
      {fehler && <p className="text-[14px] font-semibold text-signal">{fehler}</p>}
    </div>
  );
}

/** Hauptaktion in der Begrüßung: direkt eine Anfrage nach Zeichnung anlegen. */
export function HeroKnoepfe() {
  const { neu, laedt } = useNeuAnlegen();
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:justify-end">
      <button type="button" className="knopf-hell knopf-gross" disabled={!!laedt} onClick={() => neu('zeichnung')}>
        <FileScan className="size-[18px]" strokeWidth={1.75} aria-hidden />
        {laedt === 'zeichnung' ? 'Lege an …' : 'Zeichnung kalkulieren'}
      </button>
      <button type="button" className="knopf-hell-rand knopf-gross" disabled={!!laedt} onClick={() => neu('lv')}>
        <FileSpreadsheet className="size-[18px]" strokeWidth={1.75} aria-hidden />
        {laedt === 'lv' ? 'Lege an …' : 'Ausschreibung kalkulieren'}
      </button>
    </div>
  );
}
