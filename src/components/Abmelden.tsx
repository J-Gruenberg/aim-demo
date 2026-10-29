'use client';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';

export function Abmelden({ klein = false }: { klein?: boolean }) {
  const router = useRouter();
  return (
    <button
      className={klein ? 'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[14px] font-semibold hover:bg-[var(--bg-hover)]' : 'knopf-zweit'}
      onClick={async () => {
        await supabaseBrowser().auth.signOut();
        router.replace('/login');
        router.refresh();
      }}
    >
      {klein && <LogOut className="size-4 text-ink-500" strokeWidth={1.75} aria-hidden />}
      Abmelden
    </button>
  );
}
