export function AimMarke({ hell = false }: { hell?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="7" fill={hell ? '#ffffff' : '#0e2840'} />
        <path d="M8 23 L16 8 L24 23" fill="none" stroke={hell ? '#0e2840' : '#fff'} strokeWidth="3" strokeLinejoin="round" />
        <rect x="11" y="18" width="10" height="3" fill="#c5301f" />
      </svg>
      <span className={`font-semibold tracking-tight text-[15px] ${hell ? 'text-white' : 'text-tinte'}`}>AIM</span>
    </span>
  );
}
