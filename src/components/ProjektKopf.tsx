'use client';
import { Archive, Building2, ChevronDown, CircleDot, Flag, MapPin, type LucideIcon } from 'lucide-react';
import { ProjektAktionen, useArchiviertAm } from '@/components/ProjektAktionen';

export type ProjektMeta = {
  id: string;
  titel: string;
  kunde: string | null;
  ort: string | null;
  status: 'entwurf' | 'in_pruefung' | 'freigegeben' | 'abgegeben';
  ergebnis_label: 'offen' | 'beauftragt' | 'nicht_beauftragt' | null;
  abgabe?: string | null;
};

const PILL = 'h-9 rounded-full border border-line bg-surface pl-9 pr-3.5 text-[14px] font-semibold text-ink-950 outline-none transition-colors placeholder:font-medium placeholder:text-ink-400 hover:border-line-strong focus:border-brand disabled:hover:border-line';

function Feld({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <label className="relative inline-flex items-center">
      <Icon className="pointer-events-none absolute left-3.5 size-4 text-ink-500" strokeWidth={1.75} aria-hidden />
      {children}
    </label>
  );
}

/** Kopf einer Kalkulation: Titel, Kunde, Baustelle, Stand. Kennzahlen und Hauptaktion folgen darunter im Hero. */
export function ProjektKopf({
  meta,
  onMeta,
  art,
  stand,
  gesperrt,
  kennzahlen,
  children,
}: {
  meta: ProjektMeta;
  onMeta: (m: ProjektMeta) => void;
  art: string;
  stand: React.ReactNode;
  gesperrt?: boolean;
  kennzahlen?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const [archiviertAm, setArchiviertAm] = useArchiviertAm(meta.id);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1 basis-[420px]">
          <div className="flex items-center gap-2 text-[13px] text-ink-500">
            <span className="marke h-[22px] bg-label-teal-bg px-2 text-[11px] text-label-teal-fg">{art}</span>
            {archiviertAm && (
              <span className="marke h-[22px] bg-label-grey-bg px-2 text-[11px] text-label-grey-fg">
                <Archive className="size-3" strokeWidth={2} aria-hidden />
                Archiviert
              </span>
            )}
            <span>{stand}</span>
            {!gesperrt && (
              <div className="-my-1.5 ml-auto flex">
                <ProjektAktionen
                  id={meta.id}
                  titel={meta.titel}
                  status={meta.status}
                  ergebnis_label={meta.ergebnis_label}
                  archiviert_am={archiviertAm ?? null}
                  nachLoeschen="liste"
                  onArchiviert={setArchiviertAm}
                />
              </div>
            )}
          </div>
          <input
            className="mt-2 w-full rounded-lg bg-transparent text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-ink-950 outline-none -mx-1.5 px-1.5 hover:bg-[var(--bg-hover)] focus:bg-surface focus:shadow-[0_0_0_3px_var(--brand-tint)] disabled:hover:bg-transparent sm:text-[30px]"
            value={meta.titel}
            disabled={gesperrt}
            onChange={(e) => onMeta({ ...meta, titel: e.target.value })}
            aria-label="Projektname"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Feld icon={Building2}>
              <input className={`${PILL} w-56`} placeholder="Kunde" aria-label="Kunde" value={meta.kunde ?? ''} disabled={gesperrt} onChange={(e) => onMeta({ ...meta, kunde: e.target.value })} />
            </Feld>
            <Feld icon={MapPin}>
              <input className={`${PILL} w-48`} placeholder="Baustelle" aria-label="Baustelle" value={meta.ort ?? ''} disabled={gesperrt} onChange={(e) => onMeta({ ...meta, ort: e.target.value })} />
            </Feld>
            <Feld icon={CircleDot}>
              <select className={`${PILL} appearance-none pr-8 cursor-pointer`} aria-label="Stand" value={meta.status} disabled={gesperrt} onChange={(e) => onMeta({ ...meta, status: e.target.value as ProjektMeta['status'] })}>
                <option value="entwurf">Entwurf</option>
                <option value="in_pruefung">In Prüfung</option>
                <option value="freigegeben">Freigegeben</option>
                <option value="abgegeben">Abgegeben</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 size-3.5 text-ink-500" strokeWidth={2} aria-hidden />
            </Feld>
            <Feld icon={Flag}>
              <select className={`${PILL} appearance-none pr-8 cursor-pointer`} aria-label="Ausgang" value={meta.ergebnis_label ?? 'offen'} disabled={gesperrt} onChange={(e) => onMeta({ ...meta, ergebnis_label: e.target.value as ProjektMeta['ergebnis_label'] })}>
                <option value="offen">Ausgang offen</option>
                <option value="beauftragt">Beauftragt</option>
                <option value="nicht_beauftragt">Nicht beauftragt</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 size-3.5 text-ink-500" strokeWidth={2} aria-hidden />
            </Feld>
          </div>
        </div>
        {children && <div className="flex flex-wrap gap-2">{children}</div>}
      </div>
      {kennzahlen}
    </div>
  );
}
