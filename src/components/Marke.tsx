export function AimMarke({ hell = false }: { hell?: boolean }) {
  const tusche = hell ? '#ffffff' : '#0e2840';
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden>
        <circle cx="16" cy="16" r="14.5" fill="none" stroke={tusche} strokeWidth="2" />
        <path d="M9.5 22.5 L16 9 L22.5 22.5" fill="none" stroke={tusche} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
        <path d="M12 18.2 H20" stroke="#c5301f" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
      <span className={`breit font-bold text-[17px] ${hell ? 'text-white' : 'text-tiefblau'}`}>AIM</span>
    </span>
  );
}
