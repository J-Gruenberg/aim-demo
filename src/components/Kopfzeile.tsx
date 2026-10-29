'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { AimMarke } from './Marke';
import { Abmelden } from './Abmelden';

const NAV = [
  { href: '/', label: 'Kalkulationen', aktiv: (p: string) => p === '/' || p.startsWith('/halle') || p.startsWith('/lv') || p.startsWith('/bauteil') || p.startsWith('/zeichnung') },
  { href: '/referenzen', label: 'Referenzen', aktiv: (p: string) => p.startsWith('/referenzen') },
  { href: '/stammdaten', label: 'Stammdaten', aktiv: (p: string) => p.startsWith('/stammdaten') },
  { href: '/betrieb', label: 'Betrieb', aktiv: (p: string) => p.startsWith('/betrieb') },
  { href: '/hilfe', label: 'Hilfe', aktiv: (p: string) => p.startsWith('/hilfe') },
];

export function Kopfzeile({ name, rolle, betrieb }: { name: string; rolle: string; betrieb: string }) {
  const pfad = usePathname();
  const [offen, setOffen] = useState(false);
  return (
    <header className="nicht-drucken bg-tiefblau text-white sticky top-0 z-30">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 h-14 flex items-stretch gap-8">
        <Link href="/" className="flex items-center gap-3 shrink-0">
          <AimMarke hell />
          <span className="hidden sm:block w-px h-5 bg-white/25" />
          <span className="hidden sm:inline text-[13px] text-white/75 max-w-[220px] truncate schmal">{betrieb}</span>
        </Link>
        <nav className="hidden sm:flex items-stretch gap-6 overflow-x-auto">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`relative inline-flex items-center text-[14px] whitespace-nowrap transition-colors ${n.aktiv(pfad) ? 'text-white font-semibold after:absolute after:left-0 after:right-0 after:bottom-0 after:h-[3px] after:bg-rot' : 'text-white/60 hover:text-white'}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto relative flex items-center gap-2">
          {/* Auf dem Handy passt die Navigation nicht in die Zeile: dort steckt sie im Menü */}
          <button onClick={() => setOffen((o) => !o)} className="sm:hidden h-8 px-3 rounded-md bg-white/12 text-[13px] text-white" aria-label="Menü öffnen">Menü</button>
          <button onClick={() => setOffen((o) => !o)} className="flex items-center gap-2 text-[13px] text-white/80 hover:text-white">
            <span className="w-8 h-8 rounded-full border border-white/40 grid place-items-center text-[12px] font-bold">
              {name.split(/[\s@.]/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('')}
            </span>
            <span className="hidden md:inline max-w-[160px] truncate">{name}</span>
          </button>
          {offen && (
            <div className="absolute right-0 top-full mt-1 w-56 karte shadow-[0_12px_32px_-12px_rgba(14,40,64,0.35)] p-1 text-tinte" onMouseLeave={() => setOffen(false)}>
              <div className="sm:hidden border-b border-linie mb-1 pb-1">
                {NAV.map((n) => (
                  <Link key={n.href} href={n.href} className={`block px-3 py-2 text-sm rounded-md ${n.aktiv(pfad) ? 'bg-papier font-medium' : 'hover:bg-papier'}`} onClick={() => setOffen(false)}>
                    {n.label}
                  </Link>
                ))}
              </div>
              <div className="px-3 py-2 text-[12px] text-hell border-b border-linie mb-1">{rolle === 'admin' ? 'Administrator' : rolle === 'leser' ? 'Nur lesen' : 'Kalkulator'}</div>
              <Link href="/konto" className="block px-3 py-2 text-sm hover:bg-papier rounded-md" onClick={() => setOffen(false)}>Konto und Datenexport</Link>
              <Abmelden klein />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
