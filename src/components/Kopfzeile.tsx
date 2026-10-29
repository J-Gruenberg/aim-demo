'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Building2, ChevronRight, ChevronsUpDown, FileStack, LayoutDashboard, Library, LifeBuoy, SlidersHorizontal, UserRound, type LucideIcon } from 'lucide-react';
import { AimMarke } from './Marke';
import { Abmelden } from './Abmelden';
import { NeuMenue } from './NeuKnoepfe';

type Nav = { href: string; label: string; icon: LucideIcon; aktiv: (p: string) => boolean };

const KALK = (p: string) => p.startsWith('/kalkulationen') || p.startsWith('/halle') || p.startsWith('/lv') || p.startsWith('/bauteil') || p.startsWith('/zeichnung');
export const NAV: Nav[] = [
  { href: '/', label: 'Start', icon: LayoutDashboard, aktiv: (p) => p === '/' },
  { href: '/kalkulationen', label: 'Kalkulationen', icon: FileStack, aktiv: KALK },
  { href: '/referenzen', label: 'Referenzen', icon: Library, aktiv: (p) => p.startsWith('/referenzen') },
  { href: '/stammdaten', label: 'Stammdaten', icon: SlidersHorizontal, aktiv: (p) => p.startsWith('/stammdaten') },
  { href: '/betrieb', label: 'Betrieb', icon: Building2, aktiv: (p) => p.startsWith('/betrieb') },
  { href: '/hilfe', label: 'Hilfe', icon: LifeBuoy, aktiv: (p) => p.startsWith('/hilfe') },
];

const ART: Record<string, string> = { zeichnung: 'Nach Zeichnung', lv: 'Ausschreibung', halle: 'Hallenbau', bauteil: 'Treppe, Geländer, Stahlbau' };

function seitenTitel(p: string): { titel: string; pfad?: { label: string; href: string } } {
  const t = p.split('/').filter(Boolean);
  if (!t.length) return { titel: 'Start' };
  if (ART[t[0]]) {
    if (t[2] === 'angebot') return { titel: 'Angebot', pfad: { label: ART[t[0]], href: `/${t[0]}/${t[1]}` } };
    return { titel: ART[t[0]], pfad: { label: 'Kalkulationen', href: '/kalkulationen' } };
  }
  const n = NAV.find((x) => x.href === `/${t[0]}`);
  if (n) return { titel: n.label };
  if (t[0] === 'konto') return { titel: 'Konto und Datenexport' };
  return { titel: '' };
}

function kuerzel(text: string) {
  return text.split(/[\s@.]/).filter((s) => s && !/^(gmbh|ag|kg|co)$/i.test(s)).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('');
}

/** Seitenleiste wie im Zuschlagsfinder: Betrieb oben, Pill-Navigation, Absender unten. */
export function Seitenleiste({ betrieb, ort }: { betrieb: string; ort: string }) {
  const pfad = usePathname();
  return (
    <aside className="nicht-drucken sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col border-r border-line bg-surface md:flex">
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-line px-3.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg text-[12px] font-extrabold tracking-[0.02em] text-white" style={{ background: 'var(--brand-gradient)' }}>{kuerzel(betrieb)}</span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[14px] font-bold leading-5 text-ink-950">{betrieb}</span>
          <span className="truncate text-[11px] leading-[14px] text-ink-500">{ort}</span>
        </span>
        <ChevronsUpDown className="ml-auto size-3.5 shrink-0 text-ink-400" strokeWidth={1.75} aria-hidden />
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2" aria-label="Hauptnavigation">
        {NAV.map((n) => {
          const aktiv = n.aktiv(pfad);
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={aktiv ? 'page' : undefined}
              className={`flex h-10 items-center gap-2.5 rounded-full px-3 text-[14px] font-semibold transition-colors ${aktiv ? 'bg-brand-tint text-brand-strong' : 'text-ink-600 hover:bg-[var(--bg-hover)] hover:text-ink-950'}`}
            >
              <n.icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="flex shrink-0 items-center border-t border-line px-3.5 py-3">
        <AimMarke klein />
      </div>
    </aside>
  );
}

/** Untere Tab-Leiste auf dem Handy, dieselben Punkte wie die Seitenleiste. */
export function MobilNav() {
  const pfad = usePathname();
  return (
    <nav className="nicht-drucken fixed inset-x-0 bottom-0 z-30 flex h-16 border-t border-line bg-surface px-1 pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Hauptnavigation">
      {NAV.slice(0, 5).map((n) => {
        const aktiv = n.aktiv(pfad);
        return (
          <Link key={n.href} href={n.href} aria-current={aktiv ? 'page' : undefined} className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${aktiv ? 'text-brand-strong' : 'text-ink-600'}`}>
            {aktiv && <span aria-hidden className="absolute left-1/2 top-0 h-[3px] w-7 -translate-x-1/2 rounded-b-[3px] bg-brand" />}
            <n.icon className="size-5" strokeWidth={1.75} aria-hidden />
            <span className="max-w-full truncate px-0.5">{n.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Kopfzeile: Seitentitel mit Pfad, „Neue Kalkulation“, Profil. */
export function Kopfzeile({ name, rolle, darfSchreiben }: { name: string; rolle: string; darfSchreiben: boolean }) {
  const pfad = usePathname();
  const t = seitenTitel(pfad);
  const [offen, setOffen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!offen) return;
    const zu = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOffen(false);
    document.addEventListener('mousedown', zu);
    return () => document.removeEventListener('mousedown', zu);
  }, [offen]);
  return (
    <header className="nicht-drucken sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur-sm md:px-6">
      <div className="md:hidden"><AimMarke /></div>
      <div className="hidden min-w-0 items-center gap-2 text-[16px] font-bold md:flex">
        {t.pfad && (
          <>
            <Link href={t.pfad.href} className="whitespace-nowrap font-normal text-ink-500 hover:text-ink-950">{t.pfad.label}</Link>
            <ChevronRight className="size-3.5 shrink-0 text-ink-400" strokeWidth={1.75} aria-hidden />
          </>
        )}
        <span className="truncate">{t.titel}</span>
      </div>
      <div className="ml-auto flex items-center gap-2" ref={ref}>
        {darfSchreiben && <NeuMenue />}
        <div className="relative">
          <button onClick={() => setOffen((o) => !o)} className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 text-[14px] font-semibold text-ink-950 hover:bg-[var(--bg-hover)]" aria-label="Profil">
            <span className="grid size-8 place-items-center rounded-full bg-brand-tint text-[12px] font-bold text-brand-strong">{kuerzel(name)}</span>
            <span className="hidden max-w-[160px] truncate lg:inline">{name}</span>
          </button>
          {offen && (
            <div className="absolute right-0 top-full z-40 mt-2 w-60 rounded-2xl border border-line bg-surface p-1.5 text-ink-950 shadow-[var(--shadow-float)]">
              <div className="px-3 py-2">
                <div className="truncate text-[14px] font-bold">{name}</div>
                <div className="text-[12px] text-ink-500">{rolle === 'admin' ? 'Administrator' : rolle === 'leser' ? 'Nur lesen' : 'Kalkulator'}</div>
              </div>
              <div className="my-1 h-px bg-line" />
              <Link href="/konto" className="flex items-center gap-2 rounded-xl px-3 py-2 text-[14px] font-semibold hover:bg-[var(--bg-hover)]" onClick={() => setOffen(false)}>
                <UserRound className="size-4 text-ink-500" strokeWidth={1.75} aria-hidden /> Konto und Datenexport
              </Link>
              <Abmelden klein />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
