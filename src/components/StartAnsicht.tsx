import Link from 'next/link';
import { ArrowRight, CalendarDays, FileStack, SlidersHorizontal } from 'lucide-react';
import { euro } from '@/lib/format';
import { HeroKnoepfe, NeuKarten } from '@/components/NeuKnoepfe';
import { KalkKarte, type KalkZeile } from '@/components/KalkKarte';

export type StartDaten = {
  gruss: string;
  datum: string;
  uhrzeit: string;
  offen: number;
  summeOffen: number;
  schnitt: number | null;
  darfSchreiben: boolean;
  projekte: KalkZeile[];
  monat: string;
  anzahlMonat: number;
  volumenMonat: number;
  beauftragt: number;
  grundlagen: { gruppe: string; bestaetigt: boolean }[];
};

/** Startseite: Begrüßung, zuletzt bearbeitet, Überblick und neue Kalkulation. Auf großen Schirmen wächst alles mit (siehe --aim-zoom). */
export function StartAnsicht({ gruss, datum, uhrzeit, offen, summeOffen, schnitt, darfSchreiben, projekte, monat, anzahlMonat, volumenMonat, beauftragt, grundlagen }: StartDaten) {
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="gruss" className="aim-hero grid min-w-0 gap-6 px-5 py-6 sm:px-8 sm:py-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-8 lg:px-10 lg:py-8">
        <div className="min-w-0">
          <h1 id="gruss" className="text-[30px] font-extrabold leading-[1.12] tracking-[-0.02em] text-white sm:text-[38px] lg:text-[44px] lg:leading-[1.08]">{gruss}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 text-[14px] text-white/80 sm:text-[16px]">
            <span>{datum}</span>
            <span aria-hidden className="opacity-60">·</span>
            <span className="zahl text-[0.95em]">{uhrzeit} Uhr</span>
          </p>
          <p className="mt-4 max-w-[680px] text-[17px] leading-[1.4] text-white/85 sm:mt-5 sm:text-[20px] lg:text-[22px] lg:leading-[1.36] [&_b]:font-bold [&_b]:text-white">
            {offen ? (
              <>
                <b>{offen}</b> {offen === 1 ? 'Kalkulation' : 'Kalkulationen'} in Arbeit, zusammen <b>{euro(summeOffen, true)}</b>.{' '}
                {schnitt !== null && <>Durchschnittliche Sicherheit der Kalkulation <b>{Math.round(schnitt * 100)} %</b>.</>}
              </>
            ) : (
              <>Legen Sie eine Werkstattzeichnung ab. AIM liest Stückliste, Bohrungen und Nähte und rechnet das Angebot mit Ihren Sätzen, in <b>wenigen Minuten</b>.</>
            )}
          </p>
        </div>
        {darfSchreiben && <HeroKnoepfe />}
      </section>

      <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
        <section aria-labelledby="zuletzt" className="flex min-w-0 flex-col gap-3">
          <AbschnittKopf id="zuletzt" titel="Zuletzt bearbeitet" zaehler={projekte.length} rechts={projekte.length > 4 ? <Link href="/kalkulationen" className="text-[14px] font-bold text-brand-strong hover:underline">Alle Kalkulationen</Link> : null} />
          {projekte.length === 0 ? (
            <div className="karte flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
              <span className="grid size-12 place-items-center rounded-full bg-brand-tint text-brand-strong"><FileStack className="size-5" strokeWidth={1.75} aria-hidden /></span>
              <p className="text-[16px] font-bold">Noch keine Kalkulation</p>
              <p className="max-w-[46ch] text-[14px] text-ink-600">Am schnellsten geht es mit „Zeichnung kalkulieren“: Zeichnung ablegen, AIM liest und kalkuliert von selbst.</p>
            </div>
          ) : (
            <div className="grid min-w-0 flex-1 auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2">
              {projekte.slice(0, 4).map((p) => <KalkKarte key={p.id} p={p} />)}
            </div>
          )}
        </section>

        <aside aria-labelledby="ueberblick" className="flex min-w-0 flex-col gap-3">
          <AbschnittKopf id="ueberblick" titel="Überblick" />
          <div className="flex flex-1 flex-col gap-4">
            <MonatKarte monat={monat} anzahl={anzahlMonat} volumen={volumenMonat} beauftragt={beauftragt} />
            <GrundlagenKarte werte={grundlagen} />
          </div>
        </aside>
      </div>

      {darfSchreiben && (
        <section aria-labelledby="neu" className="flex min-w-0 flex-col gap-3">
          <AbschnittKopf id="neu" titel="Neue Kalkulation" />
          <NeuKarten />
        </section>
      )}
    </div>
  );
}

/** Diesen Monat: angelegte Kalkulationen, Volumen und Aufträge auf einen Blick. */
function MonatKarte({ monat, anzahl, volumen, beauftragt }: { monat: string; anzahl: number; volumen: number; beauftragt: number }) {
  return (
    <section aria-label="Diesen Monat" className="karte flex flex-col p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-label-sky-bg text-label-sky-fg"><CalendarDays className="size-4" strokeWidth={1.75} aria-hidden /></span>
        <h3 className="text-[16px] font-bold text-ink-950">Diesen Monat</h3>
        <span className="marke ml-auto h-[24px] bg-sunken px-2.5 text-[12px] text-ink-600">{monat}</span>
      </div>
      <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)_auto] divide-x divide-line">
        <div className="pr-4">
          <dt className="text-[12px] font-semibold text-ink-500">Angelegt</dt>
          <dd className="mt-0.5 text-[24px] font-extrabold leading-8 tracking-[-0.02em] text-ink-950">{anzahl}</dd>
        </div>
        <div className="min-w-0 px-4">
          <dt className="text-[12px] font-semibold text-ink-500">Angebotsvolumen</dt>
          <dd className="mt-0.5 truncate text-[24px] font-extrabold leading-8 tracking-[-0.02em] text-ink-950">{euro(volumen, true)}</dd>
        </div>
        <div className="pl-4">
          <dt className="text-[12px] font-semibold text-ink-500">Beauftragt</dt>
          <dd className="mt-0.5 text-[24px] font-extrabold leading-8 tracking-[-0.02em] text-ink-950">{beauftragt}<span className="text-[14px] font-semibold text-ink-500"> / {anzahl}</span></dd>
        </div>
      </dl>
    </section>
  );
}

const WICHTIG: { gruppe: string; label: string }[] = [
  { gruppe: 'Kostenstellen (Fertigungslohn je Stunde)', label: 'Stundensätze' },
  { gruppe: 'Kalkulationsschema (Zuschläge)', label: 'Zuschläge' },
];

/** Kalkulationsgrundlagen: wie viele eigene Zahlen schon drin sind, die wichtigsten zuerst. */
function GrundlagenKarte({ werte }: { werte: { gruppe: string; bestaetigt: boolean }[] }) {
  const gesamt = werte.length;
  const bestaetigt = werte.filter((w) => w.bestaetigt).length;
  const anteil = gesamt ? bestaetigt / gesamt : 0;
  const zeilen = [
    ...WICHTIG.map((w) => {
      const g = werte.filter((x) => x.gruppe === w.gruppe);
      return { label: w.label, n: g.length, b: g.filter((x) => x.bestaetigt).length };
    }),
    (() => {
      const g = werte.filter((x) => !WICHTIG.some((w) => w.gruppe === x.gruppe));
      return { label: 'Übrige Werte', n: g.length, b: g.filter((x) => x.bestaetigt).length };
    })(),
  ].filter((z) => z.n > 0);
  const umfang = 2 * Math.PI * 21;
  const fertig = gesamt > 0 && bestaetigt === gesamt;

  return (
    <section aria-label="Kalkulationsgrundlagen" className="karte flex flex-1 flex-col p-5">
      <div className="flex items-center gap-3">
        <span className="relative grid size-[52px] shrink-0 place-items-center" role="img" aria-label={`${Math.round(anteil * 100)} Prozent bestätigt`}>
          <svg viewBox="0 0 52 52" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx="26" cy="26" r="21" fill="none" stroke="var(--ink-200)" strokeWidth="5" />
            {anteil > 0 && <circle cx="26" cy="26" r="21" fill="none" stroke="var(--brand)" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${anteil * umfang} ${umfang}`} />}
          </svg>
          <span className="text-[13px] font-extrabold text-ink-950">{Math.round(anteil * 100)}%</span>
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[16px] font-bold text-ink-950">Kalkulationsgrundlagen</h3>
          <p className="text-[14px] text-ink-600"><b className="font-bold text-ink-950">{bestaetigt} von {gesamt}</b> Werten bestätigt</p>
        </div>
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-tint text-brand-strong"><SlidersHorizontal className="size-4" strokeWidth={1.75} aria-hidden /></span>
      </div>

      <ul className="mt-4 flex flex-col gap-2.5">
        {zeilen.map((z) => {
          const segmente = Math.min(z.n, 16);
          const voll = Math.round((z.b / z.n) * segmente);
          return (
            <li key={z.label} className="grid grid-cols-[96px_minmax(0,1fr)_52px] items-center gap-3 text-[13px]">
              <span className="truncate font-semibold text-ink-800">{z.label}</span>
              <span className="flex gap-[3px]" aria-hidden>
                {Array.from({ length: segmente }, (_, i) => (
                  <span key={i} className={`h-[7px] flex-1 rounded-full ${i < voll ? 'bg-brand' : 'bg-ink-200'}`} />
                ))}
              </span>
              <span className="zahl text-right text-[12px] text-ink-500">{z.b}/{z.n}</span>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
        <p className="text-[12px] leading-4 text-ink-500">{fertig ? 'AIM rechnet mit Ihren Zahlen.' : 'Bis dahin rechnet AIM mit Startwerten.'}</p>
        <Link href="/stammdaten" className="knopf-blau knopf-klein shrink-0">
          Stammdaten prüfen
          <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
        </Link>
      </div>
    </section>
  );
}

export function AbschnittKopf({ id, titel, zaehler, rechts }: { id: string; titel: string; zaehler?: number; rechts?: React.ReactNode }) {
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
