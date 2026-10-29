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

const FELD = 'w-full bg-transparent text-[15px] font-medium text-tinte outline-none rounded-[3px] -mx-1 px-1 py-0.5 placeholder:text-hell/70 placeholder:font-normal hover:bg-papier focus:bg-blau-hell/60 disabled:hover:bg-transparent';

/**
 * Kopf einer Kalkulation, aufgebaut wie das Schriftfeld einer Werkstattzeichnung:
 * Benennung oben, darunter Kunde, Baustelle und Stand, optional eine Zeile mit Kennzahlen.
 */
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
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 text-[13px] text-hell">
        <Link href="/" className="hover:text-tiefblau">Kalkulationen</Link>
        <span aria-hidden>/</span>
        <span className="text-grau">{art}</span>
        <span className="ml-auto">{stand}</span>
      </div>
      <div className="schriftfeld">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 sm:px-5 py-4">
          <div className="min-w-0 flex-1 basis-[420px]">
            <span className="feldname">Benennung</span>
            <input
              className="w-full bg-transparent breit text-[26px] sm:text-[30px] font-bold leading-tight text-tiefblau outline-none rounded-[3px] -mx-1 px-1 hover:bg-papier focus:bg-blau-hell/60 disabled:hover:bg-transparent"
              value={meta.titel}
              disabled={gesperrt}
              onChange={(e) => onMeta({ ...meta, titel: e.target.value })}
              aria-label="Projektname"
            />
          </div>
          <div className="flex flex-wrap gap-2">{children}</div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-[1.4fr_1.2fr_1fr_1fr] gap-px bg-linie-stark border-t border-linie-stark">
          <label className="schriftfeld-zelle bg-flaeche">
            <span className="feldname">Kunde</span>
            <input className={FELD} placeholder="Name des Kunden" value={meta.kunde ?? ''} disabled={gesperrt} onChange={(e) => onMeta({ ...meta, kunde: e.target.value })} />
          </label>
          <label className="schriftfeld-zelle bg-flaeche">
            <span className="feldname">Baustelle</span>
            <input className={FELD} placeholder="Ort der Baustelle" value={meta.ort ?? ''} disabled={gesperrt} onChange={(e) => onMeta({ ...meta, ort: e.target.value })} />
          </label>
          <label className="schriftfeld-zelle bg-flaeche">
            <span className="feldname">Stand</span>
            <select className={`${FELD} cursor-pointer`} value={meta.status} disabled={gesperrt} onChange={(e) => onMeta({ ...meta, status: e.target.value as ProjektMeta['status'] })}>
              <option value="entwurf">Entwurf</option>
              <option value="in_pruefung">In Prüfung</option>
              <option value="freigegeben">Freigegeben</option>
              <option value="abgegeben">Abgegeben</option>
            </select>
          </label>
          <label className="schriftfeld-zelle bg-flaeche">
            <span className="feldname">Ausgang</span>
            <select className={`${FELD} cursor-pointer`} value={meta.ergebnis_label ?? 'offen'} disabled={gesperrt} onChange={(e) => onMeta({ ...meta, ergebnis_label: e.target.value as ProjektMeta['ergebnis_label'] })}>
              <option value="offen">Offen</option>
              <option value="beauftragt">Beauftragt</option>
              <option value="nicht_beauftragt">Nicht beauftragt</option>
            </select>
          </label>
        </div>
        {kennzahlen && <div className="border-t-[1.5px] border-tiefblau">{kennzahlen}</div>}
      </div>
    </div>
  );
}
