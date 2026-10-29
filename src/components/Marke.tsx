/** Wortmarke als gesetzter Text, wie im toolwerk-Designsystem (kein Bildlogo). */
export function AimMarke({ hell = false, klein = false }: { hell?: boolean; klein?: boolean }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap leading-none">
      <span className={`font-extrabold tracking-[-0.02em] ${klein ? 'text-[13px]' : 'text-[18px]'} ${hell ? 'text-white' : 'text-ink-950'}`}>AIM</span>
      <span className={`${klein ? 'text-[11px]' : 'text-[12px]'} font-medium ${hell ? 'text-white/70' : 'text-ink-500'}`}>{klein ? '· Angebote in Minuten · toolwerk' : 'toolwerk'}</span>
    </span>
  );
}
