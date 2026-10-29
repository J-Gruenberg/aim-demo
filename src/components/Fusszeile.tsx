import Link from 'next/link';

export function Fusszeile({ ohneAbstand = false }: { ohneAbstand?: boolean }) {
  return (
    <footer className={`nicht-drucken ${ohneAbstand ? '' : 'mt-10'}`}>
      <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-5 text-[12px] text-ink-500 md:px-8">
        <span>AIM, Angebote in Minuten. toolwerk, eine Marke der Grünberg Solutions GmbH</span>
        <nav className="flex gap-4">
          <Link href="/impressum" className="hover:text-ink-950">Impressum</Link>
          <Link href="/datenschutz" className="hover:text-ink-950">Datenschutz</Link>
        </nav>
      </div>
    </footer>
  );
}
