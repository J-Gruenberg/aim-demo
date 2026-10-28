'use client';
import Link from 'next/link';

export type ProjektMeta = {
  id: string;
  titel: string;
  kunde: string | null;
  ort: string | null;
  status: 'entwurf' | 'in_pruefung' | 'freigegeben' | 'abgegeben';
  ergebnis_label: 'offen' | 'beauftragt' | 'nicht_beauftragt' | null;
  abgabe?: string | null;
};

export function ProjektKopf({
  meta,
  onMeta,
  art,
  stand,
  gesperrt,
  children,
}: {
  meta: ProjektMeta;
  onMeta: (m: ProjektMeta) => void;
  art: string;
  stand: React.ReactNode;
  gesperrt?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[12px] text-hell">
        <Link href="/" className="hover:text-tinte">Kalkulationen</Link>
        <span>/</span>
        <span>{art}</span>
        <span className="ml-auto">{stand}</span>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <input
            className="w-full bg-transparent text-[26px] font-semibold tracking-tight outline-none border-b border-transparent focus:border-linie-stark"
            value={meta.titel}
            disabled={gesperrt}
            onChange={(e) => onMeta({ ...meta, titel: e.target.value })}
            aria-label="Projektname"
          />
          <div className="flex flex-wrap gap-2 mt-2">
            <input className="eingabe eingabe-klein w-56" placeholder="Kunde" value={meta.kunde ?? ''} disabled={gesperrt} onChange={(e) => onMeta({ ...meta, kunde: e.target.value })} />
            <input className="eingabe eingabe-klein w-44" placeholder="Ort / Baustelle" value={meta.ort ?? ''} disabled={gesperrt} onChange={(e) => onMeta({ ...meta, ort: e.target.value })} />
            <select className="eingabe eingabe-klein w-36" value={meta.status} disabled={gesperrt} onChange={(e) => onMeta({ ...meta, status: e.target.value as ProjektMeta['status'] })}>
              <option value="entwurf">Entwurf</option>
              <option value="in_pruefung">In Prüfung</option>
              <option value="freigegeben">Freigegeben</option>
              <option value="abgegeben">Abgegeben</option>
            </select>
            <select className="eingabe eingabe-klein w-40" value={meta.ergebnis_label ?? 'offen'} disabled={gesperrt} onChange={(e) => onMeta({ ...meta, ergebnis_label: e.target.value as ProjektMeta['ergebnis_label'] })}>
              <option value="offen">Ausgang offen</option>
              <option value="beauftragt">Beauftragt</option>
              <option value="nicht_beauftragt">Nicht beauftragt</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">{children}</div>
      </div>
    </div>
  );
}
