import Link from 'next/link';
import { Cpu, FileStack, SlidersHorizontal } from 'lucide-react';
import { aktuellesProfil, supabaseServer } from '@/lib/supabase/server';
import { euro } from '@/lib/format';
import { HeroKnoepfe, NeuKarten } from '@/components/NeuKnoepfe';
import { KalkKarte, type KalkZeile } from '@/components/KalkKarte';

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
  const [{ data }, { data: kalkuliert }, { data: stamm }, { data: ki }] = await Promise.all([
    sb.from('projekte').select('id,typ,titel,kunde,ort,status,ergebnis_label,summe_netto,updated_at,created_at').order('updated_at', { ascending: false }).limit(200),
    sb.from('positionen').select('sicherheit,gp,quelle,status,typ').in('status', ['berechnet', 'pruefen', 'freigegeben']).limit(5000),
    sb.from('stammdaten').select('bestaetigt'),
    sb.from('ki_aufrufe').select('kosten_eur').gte('created_at', monatsAnfang),
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
  const bestaetigt = (stamm ?? []).filter((s) => s.bestaetigt).length;
  const stammGesamt = (stamm ?? []).length;
  const kiMonat = (ki ?? []).reduce((s, r) => s + Number(r.kosten_eur ?? 0), 0);
  const monat = new Intl.DateTimeFormat('de-DE', { month: 'long' }).format(new Date());

  return (
    <div className="flex flex-col gap-7">
      <section aria-labelledby="gruss" className="aim-hero grid min-w-0 gap-6 px-5 py-6 sm:px-8 sm:py-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-8 lg:px-10 lg:py-9">
        <div className="min-w-0">
          <h1 id="gruss" className="text-[30px] font-extrabold leading-[1.12] tracking-[-0.02em] text-white sm:text-[38px] lg:text-[44px] lg:leading-[1.08]">{k.gruss}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 text-[14px] text-white/80 sm:text-[16px]">
            <span>{k.datum}</span>
            <span aria-hidden className="opacity-60">·</span>
            <span className="zahl text-[0.95em]">{k.uhrzeit} Uhr</span>
          </p>
          <p className="mt-4 max-w-[680px] text-[17px] leading-[1.4] text-white/85 sm:mt-5 sm:text-[20px] lg:text-[22px] lg:leading-[1.36] [&_b]:font-bold [&_b]:text-white">
            {offen.length ? (
              <>
                <b>{offen.length}</b> {offen.length === 1 ? 'Kalkulation' : 'Kalkulationen'} in Arbeit, zusammen <b>{euro(summeOffen, true)}</b>.{' '}
                {schnitt !== null && <>Durchschnittliche Sicherheit der Kalkulation <b>{Math.round(schnitt * 100)} %</b>.</>}
              </>
            ) : (
              <>Legen Sie eine Werkstattzeichnung ab. AIM liest Stückliste, Bohrungen und Nähte und rechnet das Angebot mit Ihren Sätzen, in <b>wenigen Minuten</b>.</>
            )}
          </p>
        </div>
        {profil?.rolle !== 'leser' && <HeroKnoepfe />}
      </section>

      <div className="grid min-w-0 grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-7">
          <section aria-labelledby="zuletzt" className="flex min-w-0 flex-col gap-3">
            <AbschnittKopf id="zuletzt" titel="Zuletzt bearbeitet" zaehler={projekte.length} rechts={projekte.length > 4 ? <Link href="/kalkulationen" className="text-[14px] font-bold text-brand-strong hover:underline">Alle Kalkulationen</Link> : null} />
            {projekte.length === 0 ? (
              <div className="karte flex flex-col items-center gap-2 px-6 py-10 text-center">
                <span className="grid size-12 place-items-center rounded-full bg-brand-tint text-brand-strong"><FileStack className="size-5" strokeWidth={1.75} aria-hidden /></span>
                <p className="text-[16px] font-bold">Noch keine Kalkulation</p>
                <p className="max-w-[46ch] text-[14px] text-ink-600">Am schnellsten geht es mit „Zeichnung kalkulieren“. Keine Zeichnung zur Hand? In der neuen Anfrage liegen Beispielzeichnungen bereit.</p>
              </div>
            ) : (
              <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                {projekte.slice(0, 4).map((p) => <KalkKarte key={p.id} p={p} />)}
              </div>
            )}
          </section>

          {profil?.rolle !== 'leser' && (
            <section aria-labelledby="neu" className="flex min-w-0 flex-col gap-3">
              <AbschnittKopf id="neu" titel="Neue Kalkulation" />
              <NeuKarten />
            </section>
          )}
        </div>

        <aside aria-label="Überblick" className="flex min-w-0 flex-col gap-4">
          <section className="karte p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-bold">Diesen Monat</h2>
              <span className="zahl text-[12px] text-ink-500">{monat}</span>
            </div>
            <p className="mt-3 text-[40px] font-extrabold leading-none tracking-[-0.025em] text-ink-950">{imMonat.length}</p>
            <p className="mt-1 text-[14px] text-ink-600">{imMonat.length === 1 ? 'Kalkulation angelegt' : 'Kalkulationen angelegt'}</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4">
              <div><dt className="text-[12px] text-ink-500">Angebotsvolumen</dt><dd className="zahl mt-0.5 text-[15px] font-semibold">{euro(volumenMonat, true)}</dd></div>
              <div><dt className="text-[12px] text-ink-500">Beauftragt</dt><dd className="zahl mt-0.5 text-[15px] font-semibold">{beauftragt}</dd></div>
            </dl>
          </section>

          <section className="karte p-5">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-full bg-brand-tint text-brand-strong"><SlidersHorizontal className="size-4" strokeWidth={1.75} aria-hidden /></span>
              <h2 className="text-[16px] font-bold">Kalkulationsgrundlagen</h2>
            </div>
            <p className="mt-3 text-[14px] text-ink-600"><b className="text-ink-950">{bestaetigt} von {stammGesamt}</b> Werten bestätigt. Je mehr Ihrer eigenen Zahlen drin sind, desto genauer rechnet AIM.</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-sunken" role="progressbar" aria-valuemin={0} aria-valuemax={stammGesamt} aria-valuenow={bestaetigt}>
              <div className="h-full rounded-full bg-brand" style={{ width: `${stammGesamt ? Math.max(3, (bestaetigt / stammGesamt) * 100) : 0}%` }} />
            </div>
            <Link href="/stammdaten" className="mt-3 inline-block text-[14px] font-bold text-brand-strong hover:underline">Stammdaten prüfen</Link>
          </section>

          <section className="karte p-5">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-full bg-label-sky-bg text-label-sky-fg"><Cpu className="size-4" strokeWidth={1.75} aria-hidden /></span>
              <h2 className="text-[16px] font-bold">KI-Verbrauch</h2>
            </div>
            <p className="zahl mt-3 text-[24px] font-semibold text-ink-950">{euro(kiMonat)}</p>
            <p className="text-[14px] text-ink-600">im {monat}, rund 5 Cent je Zeichnungsblatt.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function AbschnittKopf({ id, titel, zaehler, rechts }: { id: string; titel: string; zaehler?: number; rechts?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <h2 id={id} className="flex min-w-0 items-center gap-2 text-[18px] font-bold leading-tight tracking-[-0.01em] text-ink-950">
        <span className="truncate">{titel}</span>
        {zaehler !== undefined && <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-brand px-2 font-mono text-[12px] font-medium text-white">{zaehler}</span>}
      </h2>
      {rechts}
    </div>
  );
}
