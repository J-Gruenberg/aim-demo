import Link from 'next/link';
import { AimMarke } from './Marke';
import { Fusszeile } from './Fusszeile';

export function RechtsSeite({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <div className="min-h-schirm flex flex-col">
      <header className="bg-tiefblau">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/"><AimMarke hell /></Link>
          <Link href="/" className="text-[13px] text-white/70 hover:text-white">Zur Anwendung</Link>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 sm:px-6 py-10">
        <h1 className="text-[28px] font-semibold tracking-tight">{titel}</h1>
        <div className="recht mt-6 space-y-5 text-[15px] leading-relaxed text-tinte/90">{children}</div>
      </main>
      <Fusszeile />
    </div>
  );
}
