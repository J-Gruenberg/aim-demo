const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2, minimumFractionDigits: 2 });
const eur0 = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

export function euro(v: number | null | undefined, ganz = false): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '–';
  return (ganz ? eur0 : eur).format(v);
}

export function zahl(v: number | null | undefined, stellen = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '–';
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: stellen, minimumFractionDigits: 0 }).format(v);
}

export function zahlFest(v: number | null | undefined, stellen = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '–';
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: stellen, minimumFractionDigits: stellen }).format(v);
}

export function datum(v: string | null | undefined): string {
  if (!v) return '–';
  const d = new Date(v);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Akzeptiert deutsche Schreibweise ("1.234,5") und Punkt-Dezimal ("1234.5"). */
export function parseZahl(s: string | number | null | undefined): number | null {
  if (s === null || s === undefined) return null;
  if (typeof s === 'number') return Number.isFinite(s) ? s : null;
  const t = s.trim().replace(/\s|€|%/g, '');
  if (!t) return null;
  let n: number;
  if (t.includes(',')) n = Number(t.replace(/\./g, '').replace(',', '.'));
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) n = Number(t.replace(/\./g, ''));
  else n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function runde(v: number, stellen = 2): number {
  const f = 10 ** stellen;
  return Math.round(v * f) / f;
}
