import { aktuellesProfil, supabaseServer } from '@/lib/supabase/server';
import { type KalkZeile } from '@/components/KalkKarte';
import { StartAnsicht } from '@/components/StartAnsicht';

export const dynamic = 'force-dynamic';

function begruessung(name: string | null) {
  const jetzt = new Date();
  const stunde = Number(new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', hourCycle: 'h23' }).formatToParts(jetzt).find((t) => t.type === 'hour')?.value ?? 12);
  const gruss = stunde < 11 ? 'Guten Morgen' : stunde < 18 ? 'Guten Tag' : 'Guten Abend';
  const vorname = (name ?? '').split(/\s+/)[0];
  return {
    gruss: vorname ? `${gruss}, ${vorname}.` : `${gruss}.`,
    datum: new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(jetzt),
    uhrzeit: new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }).format(jetzt),
  };
}

export default async function Start() {
  const sb = await supabaseServer();
  const profil = await aktuellesProfil();
  const monatsAnfang = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const [{ data }, { data: kalkuliert }, { data: stamm }] = await Promise.all([
    sb.from('projekte').select('id,typ,titel,kunde,ort,status,ergebnis_label,summe_netto,updated_at,created_at').is('archiviert_am', null).order('updated_at', { ascending: false }).limit(200),
    sb.from('positionen').select('sicherheit,gp,quelle,status,typ').in('status', ['berechnet', 'pruefen', 'freigegeben']).limit(5000),
    sb.from('stammdaten').select('gruppe,bestaetigt'),
  ]);
  const projekte = (data ?? []) as (KalkZeile & { created_at: string })[];
  const k = begruessung(profil?.name ?? null);

  const kp = (kalkuliert ?? []).filter((p) => p.typ !== 'fremd');
  const gew = kp.map((p) => Math.max(1, Math.abs(Number(p.gp ?? 0))));
  const schnitt = kp.length ? kp.reduce((a, p, i) => a + (p.quelle === 'hand' || p.sicherheit === null ? 1 : Number(p.sicherheit)) * gew[i], 0) / gew.reduce((a, b) => a + b, 0) : null;
  const offen = projekte.filter((p) => p.status !== 'abgegeben' && p.ergebnis_label !== 'beauftragt' && p.ergebnis_label !== 'nicht_beauftragt');
  const summeOffen = offen.reduce((s, p) => s + Number(p.summe_netto ?? 0), 0);
  const imMonat = projekte.filter((p) => p.created_at >= monatsAnfang);
  const volumenMonat = imMonat.reduce((s, p) => s + Number(p.summe_netto ?? 0), 0);
  const beauftragt = projekte.filter((p) => p.ergebnis_label === 'beauftragt').length;
  const grundlagen = (stamm ?? []) as { gruppe: string; bestaetigt: boolean }[];
  const monat = new Intl.DateTimeFormat('de-DE', { month: 'long' }).format(new Date());

  return (
    <StartAnsicht
      gruss={k.gruss}
      datum={k.datum}
      uhrzeit={k.uhrzeit}
      offen={offen.length}
      summeOffen={summeOffen}
      schnitt={schnitt}
      darfSchreiben={profil?.rolle !== 'leser'}
      projekte={projekte}
      monat={monat}
      anzahlMonat={imMonat.length}
      volumenMonat={volumenMonat}
      beauftragt={beauftragt}
      grundlagen={grundlagen}
    />
  );
}
