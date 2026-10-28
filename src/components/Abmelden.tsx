'use client';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';

export function Abmelden({ klein = false }: { klein?: boolean }) {
  const router = useRouter();
  return (
    <button
      className={klein ? 'text-left w-full px-3 py-2 text-sm hover:bg-papier rounded-md' : 'knopf-zweit'}
      onClick={async () => {
        await supabaseBrowser().auth.signOut();
        router.replace('/login');
        router.refresh();
      }}
    >
      Abmelden
    </button>
  );
}
