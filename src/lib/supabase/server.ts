import { SUPABASE_URL, SUPABASE_KEY } from '@/lib/supabase/konfig';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(list: { name: string; value: string; options: CookieOptions }[]) {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Aufruf aus einer Server-Komponente: Middleware erneuert die Sitzung.
        }
      },
    },
  });
}

export type Profil = { id: string; email: string; name: string | null; rolle: 'admin' | 'kalkulator' | 'leser' };

export async function aktuellesProfil(): Promise<Profil | null> {
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return null;
  const { data } = await sb.from('profile').select('id,email,name,rolle').eq('id', auth.user.id).maybeSingle();
  return (data as Profil) ?? null;
}
