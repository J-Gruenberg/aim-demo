'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';

export function LoginFormular() {
  const [email, setEmail] = useState('');
  const [passwort, setPasswort] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);
  const router = useRouter();

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    setFehler(null);
    setLaedt(true);
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email: email.trim().toLowerCase(), password: passwort });
    setLaedt(false);
    if (error) {
      setFehler('E-Mail oder Passwort stimmt nicht.');
      return;
    }
    router.replace('/');
    router.refresh();
  }

  return (
    <form onSubmit={absenden} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">E-Mail</label>
        <input id="email" type="email" autoComplete="username" required className="eingabe" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="pw">Passwort</label>
        <input id="pw" type="password" autoComplete="current-password" required className="eingabe" value={passwort} onChange={(e) => setPasswort(e.target.value)} />
      </div>
      {fehler && <p className="rounded-xl bg-signal-tint px-3 py-2 text-[14px] font-semibold text-signal">{fehler}</p>}
      <button type="submit" className="knopf-primaer knopf-gross w-full" disabled={laedt}>{laedt ? 'Anmelden …' : 'Anmelden'}</button>
      <p className="pt-2 text-[13px] text-ink-500">Passwort vergessen? Kurze Nachricht an Ihren Ansprechpartner bei toolwerk, wir setzen es zurück.</p>
    </form>
  );
}
