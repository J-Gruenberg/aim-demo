import type { Betrieb } from '@/lib/betrieb';

export type AngebotKopf = { nr?: string; datum?: string; empfaenger?: string; betreff?: string; gueltig_wochen?: number };

export function BriefKopfzeile({ b }: { b: Betrieb }) {
  const kontakt = [b.tel && `Tel.: ${b.tel}`, b.fax && `Fax: ${b.fax}`].filter(Boolean).join(' · ');
  const online = [b.web, b.mail].filter(Boolean).join(' · ');
  return (
    <div className="flex justify-between items-start border-b-2 border-tinte pb-3">
      <div>
        <div className="text-[20px] font-bold tracking-tight leading-none">{b.firma}</div>
        <div className="text-[9.5px] text-grau mt-2 leading-snug">
          {b.zeilen.map((z) => <div key={z}>{z}</div>)}
        </div>
      </div>
      <div className="text-[9.5px] text-right leading-snug">
        <div>{b.strasse} · {b.ort}</div>
        {kontakt && <div>{kontakt}</div>}
        {online && <div>{online}</div>}
        {b.leistungen.length > 0 && <div className="mt-2 text-grau">{b.leistungen.map((l) => `+ ${l}`).join('   ')}</div>}
      </div>
    </div>
  );
}

export function BriefFusszeile({ b }: { b: Betrieb }) {
  return (
    <div className="border-t border-linie-stark pt-2 text-[8.5px] text-grau text-center leading-snug">
      {b.fuss.map((z) => <div key={z}>{z}</div>)}
    </div>
  );
}

export function Seite({ children }: { children: React.ReactNode }) {
  return (
    <section className="seite bg-white text-tinte mx-auto shadow-sm print:shadow-none flex flex-col" style={{ width: '210mm', minHeight: '297mm', padding: '14mm 16mm 12mm' }}>
      {children}
    </section>
  );
}

export const DRUCK_CSS = `
@page { size: A4; margin: 0; }
@media print {
  html, body { background: #fff !important; }
  .seite { box-shadow: none !important; margin: 0 !important; page-break-after: always; break-after: page; }
  .seite:last-child { page-break-after: auto; break-after: auto; }
  header, footer { display: none !important; }
  main { padding: 0 !important; max-width: none !important; }
}
`;
