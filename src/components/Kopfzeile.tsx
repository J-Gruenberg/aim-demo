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
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 h-14 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-3 shrink-0">
          <AimMarke hell />
          <span className="hidden sm:inline text-white/40">|</span>
          <span className="hidden sm:inline text-[13px] text-white/80 tracking-tight max-w-[220px] truncate">{betrieb}</span>
        </Link>
        <nav className="hidden sm:flex items-center gap-1 overflow-x-auto">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`px-3 h-8 inline-flex items-center rounded-md text-[13px] whitespace-nowrap ${n.aktiv(pfad) ? 'bg-white/12 text-white' : 'text-white/65 hover:text-white'}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto relative flex items-center gap-2">
          {/* Auf dem Handy passt die Navigation nicht in die Zeile: dort steckt sie im Menü */}
          <button onClick={() => setOffen((o) => !o)} className="sm:hidden h-8 px-3 rounded-md bg-white/12 text-[13px] text-white" aria-label="Menü öffnen">Menü</button>
          <button onClick={() => setOffen((o) => !o)} className="flex items-center gap-2 text-[13px] text-white/80 hover:text-white">
            <span className="w-7 h-7 rounded-full bg-white/15 grid place-items-center text-[12px] font-semibold">
              {name.split(/[\s@.]/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('')}
            </span>
            <span className="hidden md:inline max-w-[160px] truncate">{name}</span>
          </button>
          {offen && (
            <div className="absolute right-0 top-full mt-2 w-56 karte shadow-lg p-1 text-tinte" onMouseLeave={() => setOffen(false)}>
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
