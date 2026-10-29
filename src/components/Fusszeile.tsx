import Link from 'next/link';

export function Fusszeile({ ohneAbstand = false }: { ohneAbstand?: boolean }) {
  return (
    <footer className={`nicht-drucken border-t border-linie bg-papier ${ohneAbstand ? '' : 'mt-16'}`}>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-6 flex flex-wrap items-center justify-between gap-3 text-[13px] text-hell">
        <span>AIM, Angebote in Minuten. toolwerk, eine Marke der Grünberg Solutions GmbH</span>
        <nav className="flex gap-4">
          <Link href="/impressum" className="hover:text-tiefblau">Impressum</Link>
          <Link href="/datenschutz" className="hover:text-tiefblau">Datenschutz</Link>
        </nav>
      </div>
    </footer>
  );
}
