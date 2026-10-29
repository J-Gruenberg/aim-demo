import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { euro, datum } from '@/lib/format';

export const TYP: Record<string, { label: string; pfad: string; ton: string }> = {
  zeichnung: { label: 'Nach Zeichnung', pfad: 'zeichnung', ton: 'bg-label-teal-bg text-label-teal-fg' },
  halle: { label: 'Hallenbau', pfad: 'halle', ton: 'bg-label-violet-bg text-label-violet-fg' },
  lv: { label: 'Ausschreibung', pfad: 'lv', ton: 'bg-label-sky-bg text-label-sky-fg' },
  bauteil: { label: 'Treppe, Geländer, Stahlbau', pfad: 'bauteil', ton: 'bg-label-yellow-bg text-label-yellow-fg' },
};

export const STAND: Record<string, { label: string; punkt: string; text: string }> = {
  entwurf: { label: 'Entwurf', punkt: 'bg-ink-300', text: 'text-ink-600' },
  in_pruefung: { label: 'In Prüfung', punkt: 'bg-check-dot', text: 'text-check' },
  freigegeben: { label: 'Freigegeben', punkt: 'bg-ok-dot', text: 'text-ok' },
  abgegeben: { label: 'Abgegeben', punkt: 'bg-brand', text: 'text-brand-strong' },
};

export type KalkZeile = { id: string; typ: string; titel: string; kunde: string | null; ort: string | null; status: string; ergebnis_label: string | null; summe_netto: number | null; updated_at: string };

/** Ampel als Punkt plus Wort. */
export function StandAnzeige({ status, ergebnis }: { status: string; ergebnis?: string | null }) {
  if (ergebnis === 'beauftragt') return <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ok"><span className="size-2 rounded-full bg-ok-dot" />Beauftragt</span>;
  if (ergebnis === 'nicht_beauftragt') return <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-600"><span className="size-2 rounded-full bg-ink-300" />Nicht beauftragt</span>;
  const s = STAND[status] ?? STAND.entwurf;
  return <span className={`inline-flex items-center gap-1.5 text-[13px] font-semibold ${s.text}`}><span className={`size-2 rounded-full ${s.punkt}`} />{s.label}</span>;
}

export function ArtLabel({ typ }: { typ: string }) {
  const t = TYP[typ] ?? TYP.zeichnung;
  return <span className={`marke h-[22px] px-2 text-[11px] ${t.ton}`}>{t.label}</span>;
}

/** Kalkulation als Karte: Art, Stand, Titel, Kunde, Summe. */
export function KalkKarte({ p }: { p: KalkZeile }) {
  const t = TYP[p.typ] ?? TYP.zeichnung;
  return (
    <article className="karte relative flex min-h-[176px] flex-col gap-2.5 p-5 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-px hover:border-line-strong hover:shadow-[var(--shadow-float)]">
      <div className="flex items-center gap-2">
        <ArtLabel typ={p.typ} />
        <span className="ml-auto"><StandAnzeige status={p.status} ergebnis={p.ergebnis_label} /></span>
      </div>
      <h3 className="line-clamp-2 text-[16px] font-bold leading-snug text-ink-950">
        <Link href={`/${t.pfad}/${p.id}`} className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none">{p.titel}</Link>
      </h3>
      {(p.kunde || p.ort) && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-ink-600">
          {p.kunde && <span className="truncate">{p.kunde}</span>}
          {p.ort && <span className="inline-flex items-center gap-1"><MapPin className="size-3 shrink-0" strokeWidth={1.75} aria-hidden />{p.ort}</span>}
        </p>
      )}
      <div className="mt-auto flex items-end justify-between gap-3 border-t border-line pt-3">
        <span>
          <span className="block text-[12px] text-ink-500">Summe netto</span>
          <span className="zahl text-[17px] font-semibold text-ink-950">{p.summe_netto ? euro(p.summe_netto, true) : '–'}</span>
        </span>
        <span className="zahl text-[12px] text-ink-500">{datum(p.updated_at)}</span>
      </div>
    </article>
  );
}
