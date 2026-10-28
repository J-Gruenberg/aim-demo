'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

export function KontoFormular() {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null);
  async function speichern(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 12) return setMeldung({ ok: false, text: 'Bitte mindestens 12 Zeichen.' });
    if (pw !== pw2) return setMeldung({ ok: false, text: 'Die beiden Passwörter sind nicht gleich.' });
    const { error } = await supabaseBrowser().auth.updateUser({ password: pw });
    setMeldung(error ? { ok: false, text: 'Ändern ging nicht. Bitte erneut anmelden und noch einmal versuchen.' } : { ok: true, text: 'Passwort geändert.' });
    if (!error) {
      setPw('');
      setPw2('');
    }
  }
  return (
    <form onSubmit={speichern} className="karte p-5 space-y-3">
      <h2 className="font-semibold">Passwort ändern</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        <div><label className="label">Neues Passwort</label><input type="password" autoComplete="new-password" className="eingabe" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        <div><label className="label">Wiederholen</label><input type="password" autoComplete="new-password" className="eingabe" value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
      </div>
      {meldung && <p className={`text-sm ${meldung.ok ? 'text-gruen' : 'text-rot'}`}>{meldung.text}</p>}
      <button className="knopf-blau">Passwort speichern</button>
    </form>
  );
}
