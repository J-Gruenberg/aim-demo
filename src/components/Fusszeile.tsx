import Link from 'next/link';

export function Fusszeile({ ohneAbstand = false }: { ohneAbstand?: boolean }) {
  return (
    <footer className={`nicht-drucken ${ohneAbstand ? '' : 'mt-10'}`}>
      <div className="mx-auto flex w-full max-w-[1400px] 2xl:max-w-[1760px] flex-wrap items-center justify-center gap-x-2.5 gap-y-1 px-4 py-5 text-center text-[12px] text-ink-500 md:px-8">
        <span>AIM, Angebote in Minuten</span>
        <span aria-hidden className="text-ink-300">·</span>
        <span>toolwerk, eine Marke der Grünberg Solutions GmbH</span>
        <span aria-hidden className="text-ink-300">·</span>
        <Link href="/impressum" className="hover:text-ink-950">Impressum</Link>
        <span aria-hidden className="text-ink-300">·</span>
        <Link href="/datenschutz" className="hover:text-ink-950">Datenschutz</Link>
      </div>
    </footer>
  );
}
