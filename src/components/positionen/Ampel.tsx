import { CircleCheck } from 'lucide-react';
import type { Position } from './typen';

/** Fünf Stufen der Sicherheit, wie die KI ihre Kalkulation selbst einschätzt. */
export const STUFEN = [
  { ab: 0.8, label: 'Sehr sicher', punkt: 'bg-[#15803D]', text: 'text-[#14532D]', bg: 'bg-[#DCFCE7]' },
  { ab: 0.65, label: 'Sicher', punkt: 'bg-[#65C466]', text: 'text-[#2F6B1E]', bg: 'bg-[#ECFCCB]' },
  { ab: 0.5, label: 'Mittel', punkt: 'bg-[#EAB308]', text: 'text-[#7A5200]', bg: 'bg-[#FEF6C7]' },
  { ab: 0.35, label: 'Unsicher', punkt: 'bg-[#F97316]', text: 'text-[#9A3412]', bg: 'bg-[#FFEDD5]' },
  { ab: 0, label: 'Sehr unsicher', punkt: 'bg-[#DC2626]', text: 'text-[#991B1B]', bg: 'bg-[#FEE2E2]' },
] as const;

export function stufe(sicherheit: number | null | undefined) {
  const s = sicherheit ?? 1;
  return STUFEN.find((x) => s >= x.ab) ?? STUFEN[STUFEN.length - 1];
}

/** Sicherheit einer kalkulierten Position (Handeingaben gelten als sicher). */
export function sicherheitVon(p: Position): number {
  if (p.quelle === 'hand' || p.sicherheit === null || p.sicherheit === undefined) return 1;
  return Math.max(0, Math.min(1, Number(p.sicherheit)));
}

/** Durchschnittliche Sicherheit der kalkulierten Positionen, gewichtet nach Gesamtpreis. */
export function schnitt(pos: Position[]): number | null {
  const k = pos.filter((p) => p.status !== 'offen' && p.ep !== null);
  if (!k.length) return null;
  const gew = k.map((p) => Math.max(1, Math.abs(Number(p.gp ?? 0))));
  const summe = gew.reduce((a, b) => a + b, 0);
  return k.reduce((a, p, i) => a + sicherheitVon(p) * gew[i], 0) / summe;
}

/** Stand einer Position: offen, freigegeben oder die Sicherheits-Ampel mit Prozent. */
export function SicherheitsAmpel({ p }: { p: Position }) {
  if (p.status === 'offen') {
    return <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-500"><span className="size-2 rounded-full bg-ink-300" />Offen</span>;
  }
  if (p.status === 'freigegeben') {
    return <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-ok"><CircleCheck className="size-4" strokeWidth={2} aria-hidden />Freigegeben</span>;
  }
  const s = sicherheitVon(p);
  const st = stufe(s);
  return (
    <span className="inline-flex flex-col items-start gap-0.5" title={`Sicherheit der Kalkulation: ${Math.round(s * 100)} %`}>
      <span className={`inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 font-mono text-[13px] font-semibold ${st.bg} ${st.text}`}>
        <span className={`size-2 rounded-full ${st.punkt}`} />
        {Math.round(s * 100)} %
      </span>
      <span className={`whitespace-nowrap pl-1 text-[12px] font-semibold ${st.text}`}>{st.label}</span>
    </span>
  );
}

/** Kleine Legende der fünf Stufen. */
export function AmpelLegende() {
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-500">
      {STUFEN.map((x, i) => (
        <span key={x.label} className="inline-flex items-center gap-1.5">
          <span className={`size-2 rounded-full ${x.punkt}`} />
          {x.label} {i === 0 ? 'ab 80 %' : i === STUFEN.length - 1 ? 'unter 35 %' : `ab ${Math.round(x.ab * 100)} %`}
        </span>
      ))}
    </span>
  );
}
