import { SUPABASE_URL, SUPABASE_KEY } from '@/lib/supabase/konfig';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const OEFFENTLICH = ['/login', '/impressum', '/datenschutz', '/favicon.ico', '/icon.svg'];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const sb = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(list: { name: string; value: string; options: CookieOptions }[]) {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await sb.auth.getUser();
  const pfad = request.nextUrl.pathname;
  // Wartungs-Selbsttest mit Prüf-Token: die Route prüft das Token selbst
  const offen = OEFFENTLICH.some((p) => pfad === p || pfad.startsWith(p + '/')) || (pfad === '/api/ki/status' && request.headers.has('x-pruef-token'));
  if (!data.user && !offen) {
    if (pfad.startsWith('/api/')) return NextResponse.json({ fehler: 'Bitte anmelden.' }, { status: 401 });
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }
  if (data.user && pfad === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|ico|pdf|woff2?)$).*)'],
};
