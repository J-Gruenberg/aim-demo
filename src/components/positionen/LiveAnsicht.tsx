'use client';
import { useEffect, useRef, useState } from 'react';
import { CircleCheck, FileText, Maximize2, Minimize2, ScanLine, Sparkles, TriangleAlert, X } from 'lucide-react';
import { euro } from '@/lib/format';
import { stufe } from './Ampel';
import { LiveLvTabelle, type LiveZeile } from './LiveLvTabelle';

/** Ein Eintrag im Live-Protokoll. Alles hier kommt aus echten Ergebnissen der Lese-, Kalkulations- und Prüfschritte. */
export type LiveEreignis = {
  id: number;
  zeit: number;
  art: 'schritt' | 'position' | 'hinweis' | 'erfolg' | 'fehler' | 'info';
  titel: string;
  text?: string;
  wert?: string;
  menge?: string;
  sicherheit?: number | null;
  oz?: string | null;
};

export type LivePhase = 'lesen' | 'satz' | 'kalkulieren' | 'pruefen' | 'fertig';

export type LiveZustand = {
  phase: LivePhase;
  titel: string;
  datei?: string | null;
  blatt?: number | null;
  blaetter?: number | null;
  bild?: string | null;
  /** Beginn des aktuellen Schritts (für die Schrittanzeige) und des ganzen Laufs (für die Uhr) */
  start: number;
  beginn: number;
  ende?: number | null;
  laeuft: boolean;
  ereignisse: LiveEreignis[];
  /** Positionen, die gerade kalkuliert werden (aktuelles Paket) */
  aktiv?: string[] | null;
};

/** Arbeitsschritte je Phase, so wie AIM sie der KI vorgibt. Die Leuchtpunkte laufen zeitlich mit, die Ergebnisse rechts sind echt. */
const SCHRITTE: Record<'zeichnung' | 'lv', Record<LivePhase, { schritte: string[]; dauer: number }>> = {
  zeichnung: {
    lesen: { schritte: ['Schriftfeld', 'Stückliste', 'Profile und Gewichte', 'Bohrungen und Nähte', 'Oberfläche', 'Preis mit Ihren Sätzen'], dauer: 50_000 },
    satz: { schritte: ['Zusammenbau erkennen', 'Doppelte Teile raus', 'Mengen aus der Stückliste', 'Fehlende Zeichnungen', 'Kaufteile'], dauer: 30_000 },
    kalkulieren: { schritte: ['Ansatz wählen', 'Gewicht und Stunden', 'Ihre Stammdaten', 'Sicherheit bewerten'], dauer: 30_000 },
    pruefen: { schritte: ['Vorbemerkungen', 'Pläne gegen LV', 'Widersprüche', 'Bieterfragen'], dauer: 90_000 },
    fertig: { schritte: [], dauer: 1 },
  },
  lv: {
    lesen: { schritte: ['Seiten lesen', 'Positionen erkennen', 'Mengen und Einheiten', 'Vorbemerkungen'], dauer: 30_000 },
    satz: { schritte: [], dauer: 1 },
    kalkulieren: { schritte: ['Ansatz wählen', 'Gewicht und Stunden', 'Ihre Stammdaten', 'Archiv vergleichen', 'Sicherheit bewerten'], dauer: 35_000 },
    pruefen: { schritte: ['Vorbemerkungen', 'Pläne gegen LV', 'Widersprüche', 'Bieterfragen'], dauer: 100_000 },
    fertig: { schritte: [], dauer: 1 },
  },
};

const uhr = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/** Zahl zählt weich auf den neuen Wert hoch. */
function useZaehler(ziel: number) {
  const [wert, setWert] = useState(ziel);
  const aktuell = useRef(ziel);
  useEffect(() => {
    const von = aktuell.current;
    if (von === ziel) return;
    const t0 = performance.now();
    let raf = 0;
    const schritt = (t: number) => {
      const f = Math.min(1, (t - t0) / 900);
      const v = von + (ziel - von) * (1 - Math.pow(1 - f, 3));
      aktuell.current = v;
      setWert(v);
      if (f < 1) raf = requestAnimationFrame(schritt);
    };
    raf = requestAnimationFrame(schritt);
    return () => cancelAnimationFrame(raf);
  }, [ziel]);
  return wert;
}

/** Ampel auf dunklem Grund. */
function AmpelDunkel({ s }: { s: number | null | undefined }) {
  if (s === null || s === undefined) return null;
  const st = stufe(s);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] px-2 py-0.5 text-[12px] font-semibold text-white/85">
      <span className={`size-2 rounded-full ${st.punkt}`} />
      {Math.round(s * 100)} % · {st.label}
    </span>
  );
}

export function LiveAnsicht({
  zustand,
  modus,
  kennzahlen,
  zeilen,
  onZeile,
  onSchliessen,
}: {
  zustand: LiveZustand;
  modus: 'zeichnung' | 'lv' | 'bauteil';
  kennzahlen: { positionen: number; summe: number; sicherheit: number | null };
  /** LV-Zeilen: ohne Blattbild zeigt die Bühne das Leistungsverzeichnis, das live durchgerechnet wird */
  zeilen?: LiveZeile[];
  /** Klick auf eine fertige LV-Zeile: Position im Detail öffnen */
  onZeile?: (id: string) => void;
  onSchliessen: () => void;
}) {
  const wurzel = useRef<HTMLDivElement>(null);
  const liste = useRef<HTMLDivElement>(null);
  const [jetzt, setJetzt] = useState(() => Date.now());
  const [vollbild, setVollbild] = useState(false);
  const folgen = useRef(true);
  const summe = useZaehler(kennzahlen.summe);

  // Uhr und Schrittanzeige
  useEffect(() => {
    const t = setInterval(() => setJetzt(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  // Escape schließt, Seite dahinter scrollt nicht mit
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && !document.fullscreenElement && onSchliessen();
    document.addEventListener('keydown', esc);
    const alt = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const fs = () => setVollbild(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', fs);
    // Direkt nach dem Klick in den Vollbildmodus, wenn der Browser das erlaubt
    wurzel.current?.requestFullscreen?.().catch(() => {});
    return () => {
      document.removeEventListener('keydown', esc);
      document.removeEventListener('fullscreenchange', fs);
      document.body.style.overflow = alt;
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [onSchliessen]);

  // Neue Einträge: mitscrollen, solange man unten ist
  useEffect(() => {
    const el = liste.current;
    if (el && folgen.current) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [zustand.ereignisse.length]);

  const plan = SCHRITTE[modus === 'zeichnung' ? 'zeichnung' : 'lv'][zustand.phase];
  const anteil = (jetzt - zustand.start) / plan.dauer;
  const aktiv = zustand.laeuft ? Math.min(plan.schritte.length - 1, Math.floor(anteil * plan.schritte.length)) : plan.schritte.length;
  const laufzeit = (zustand.ende ?? jetzt) - zustand.beginn;

  return (
    <div ref={wurzel} role="dialog" aria-modal="true" aria-label="Live-Ansicht: AIM liest und kalkuliert" className="live-flaeche fixed inset-0 z-[200] flex flex-col">
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3 sm:gap-5 sm:px-8">
        <span className="flex items-center gap-2.5">
          <span className="relative grid size-10 place-items-center rounded-full bg-[#0E8C7C]/30 ring-1 ring-[#5EEAD4]/40">
            <ScanLine className="size-5 text-[#5EEAD4]" strokeWidth={1.75} aria-hidden />
            {zustand.laeuft && <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-[#5EEAD4] live-glimmen" />}
          </span>
          <span>
            <span className="block text-[16px] font-extrabold tracking-[-0.01em] text-white">AIM Live</span>
            <span className="block text-[12px] text-[#9FD9CF]">{zustand.laeuft ? 'KI arbeitet' : 'Fertig'}</span>
          </span>
        </span>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-[15px] font-bold text-white sm:text-[17px]">{zustand.titel}</p>
          <p className="truncate text-[12px] text-[#9FD9CF] sm:text-[13px]">
            {zustand.datei ?? ''}
            {zustand.blatt ? ` · Blatt ${zustand.blatt}${zustand.blaetter ? ` von ${zustand.blaetter}` : ''}` : ''}
          </p>
        </div>
        <span className="zahl hidden text-[15px] font-semibold text-[#9FD9CF] sm:inline">{uhr(laufzeit)}</span>
        <button
          type="button"
          className="hidden size-10 place-items-center rounded-full text-white/80 hover:bg-white/10 hover:text-white sm:grid"
          onClick={() => {
            const umschalten = document.fullscreenElement ? document.exitFullscreen() : wurzel.current?.requestFullscreen();
            umschalten?.catch(() => {});
          }}
          aria-label={vollbild ? 'Vollbild beenden' : 'Vollbild'}
          title={vollbild ? 'Vollbild beenden' : 'Vollbild'}
        >
          {vollbild ? <Minimize2 className="size-5" strokeWidth={1.75} aria-hidden /> : <Maximize2 className="size-5" strokeWidth={1.75} aria-hidden />}
        </button>
        <button type="button" className="grid size-10 place-items-center rounded-full text-white/80 hover:bg-white/10 hover:text-white" onClick={onSchliessen} aria-label="Live-Ansicht schließen" title="Schließen (Esc)">
          <X className="size-5" strokeWidth={1.75} aria-hidden />
        </button>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_460px] lg:grid-rows-1">
        {/* Bühne: das Blatt, das gerade gelesen wird */}
        <section className="flex min-h-0 flex-col gap-4 p-4 sm:p-7">
          <div className="live-raster relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.02] p-4 sm:p-8">
            {[
              'left-4 top-4 border-l-2 border-t-2 rounded-tl-xl',
              'right-4 top-4 border-r-2 border-t-2 rounded-tr-xl',
              'left-4 bottom-4 border-l-2 border-b-2 rounded-bl-xl',
              'right-4 bottom-4 border-r-2 border-b-2 rounded-br-xl',
            ].map((k) => (
              <span key={k} aria-hidden className={`pointer-events-none absolute size-7 border-[#5EEAD4]/70 ${k}`} />
            ))}
            {zustand.bild ? (
              <div className="relative max-h-full overflow-hidden rounded-xl bg-white shadow-[0_40px_100px_rgba(0,0,0,0.55)] ring-1 ring-white/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img key={zustand.bild} src={zustand.bild} alt={`Blatt ${zustand.blatt ?? ''} von ${zustand.datei ?? ''}`} className="live-rein block max-h-[calc(50dvh/var(--aim-zoom)_-_120px)] w-auto max-w-full object-contain lg:max-h-[calc(100dvh/var(--aim-zoom)_-_230px)]" />
                {zustand.laeuft && zustand.phase === 'lesen' && (
                  <>
                    <div className="live-fokus" />
                    <div className="live-strahl" />
                  </>
                )}
              </div>
            ) : zeilen && zeilen.length > 0 ? (
              <LiveLvTabelle zeilen={zeilen} aktiv={zustand.phase === 'kalkulieren' ? (zustand.aktiv ?? []) : []} laeuft={zustand.laeuft} takt={jetzt - zustand.start} onZeile={onZeile} />
            ) : (
              <div className="flex flex-col items-center gap-4 text-center">
                <span className="relative grid size-24 place-items-center rounded-[28px] bg-[#0E8C7C]/20 ring-1 ring-[#5EEAD4]/30">
                  {zustand.phase === 'pruefen' ? <Sparkles className="size-10 text-[#5EEAD4]" strokeWidth={1.5} aria-hidden /> : <FileText className="size-10 text-[#5EEAD4]" strokeWidth={1.5} aria-hidden />}
                  {zustand.laeuft && <span className="absolute inset-0 rounded-[28px] ring-2 ring-[#5EEAD4]/50 live-glimmen" />}
                </span>
                <p className="max-w-[40ch] text-[15px] text-white/70">
                  {zustand.phase === 'kalkulieren'
                    ? 'Jede Position bekommt einen Ansatz, Gewicht und Stunden, gerechnet mit Ihren Stammdaten.'
                    : zustand.phase === 'pruefen'
                      ? 'Vorbemerkungen und Pläne werden gegen das Leistungsverzeichnis geprüft.'
                      : zustand.phase === 'satz'
                        ? 'Der Zeichnungssatz wird als Ganzes geordnet: Zusammenbau, Unterbaugruppen, Kaufteile.'
                        : 'Unterlagen werden gelesen.'}
                </p>
              </div>
            )}
          </div>
          {plan.schritte.length > 0 && (
            <ol className="flex flex-wrap gap-2" aria-label="Arbeitsschritte">
              {plan.schritte.map((s, i) => {
                const fertig = i < aktiv;
                const jetztAktiv = i === aktiv && zustand.laeuft;
                return (
                  <li
                    key={s}
                    className={`inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold transition-colors duration-300 ${
                      jetztAktiv ? 'bg-[#5EEAD4] text-[#04211C] shadow-[0_0_24px_rgba(94,234,212,0.45)]' : fertig ? 'bg-[#0E8C7C]/35 text-[#BFF3EA]' : 'bg-white/[0.06] text-white/50'
                    }`}
                  >
                    {fertig ? <CircleCheck className="size-4" strokeWidth={2} aria-hidden /> : <span className={`size-2 rounded-full ${jetztAktiv ? 'bg-[#04211C] live-glimmen' : 'bg-white/30'}`} />}
                    {s}
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {/* Live-Protokoll: echte Ergebnisse, sobald sie da sind */}
        <aside className="flex min-h-0 flex-col border-t border-white/10 bg-black/20 lg:border-l lg:border-t-0">
          <div className="flex items-baseline justify-between px-5 pt-5">
            <h2 className="text-[15px] font-bold text-white">Live-Protokoll</h2>
            <span className="text-[12px] text-[#9FD9CF]">{zustand.ereignisse.length} Einträge</span>
          </div>
          <div
            ref={liste}
            className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-5 py-4"
            onScroll={(e) => {
              const el = e.currentTarget;
              folgen.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            }}
          >
            {zustand.ereignisse.map((e) => (
              <Eintrag key={e.id} e={e} beginn={zustand.beginn} />
            ))}
            {zustand.laeuft && <p className="live-cursor pl-1 text-[13px] text-[#9FD9CF]">arbeitet</p>}
          </div>
          <footer className="grid grid-cols-3 gap-3 border-t border-white/10 px-5 py-4">
            <div>
              <p className="text-[12px] text-[#9FD9CF]">Positionen</p>
              <p className="zahl text-[22px] font-extrabold text-white">{kennzahlen.positionen}</p>
            </div>
            <div>
              <p className="text-[12px] text-[#9FD9CF]">Summe netto</p>
              <p className="zahl text-[22px] font-extrabold text-white">{euro(summe, true)}</p>
            </div>
            <div>
              <p className="text-[12px] text-[#9FD9CF]">Ø Sicherheit</p>
              <p className="zahl text-[22px] font-extrabold text-white">{kennzahlen.sicherheit !== null ? `${Math.round(kennzahlen.sicherheit * 100)} %` : '–'}</p>
            </div>
          </footer>
        </aside>
      </main>
    </div>
  );
}

function Eintrag({ e, beginn }: { e: LiveEreignis; beginn: number }) {
  const zeit = <span className="zahl w-11 shrink-0 pt-0.5 text-[11px] text-[#6FB7AA]">{uhr(e.zeit - beginn)}</span>;
  if (e.art === 'position') {
    return (
      <div className="live-rein flex gap-2">
        {zeit}
        <div className="min-w-0 flex-1 rounded-2xl bg-white/[0.05] p-3 ring-1 ring-white/10">
          <div className="flex items-start gap-2.5">
            {e.oz && <span className="zahl shrink-0 rounded-full bg-[#0E8C7C]/35 px-2 py-0.5 text-[11px] font-semibold text-[#BFF3EA]">{e.oz}</span>}
            <p className="line-clamp-2 min-w-0 flex-1 text-[14px] font-semibold leading-snug text-white">{e.titel}</p>
            {e.wert && <span className="zahl shrink-0 text-[14px] font-bold text-white">{e.wert}</span>}
          </div>
          {(e.menge || e.sicherheit !== undefined) && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-white/60">
              {e.menge && <span>{e.menge}</span>}
              <AmpelDunkel s={e.sicherheit} />
            </div>
          )}
          {e.text && <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-white/55">{e.text}</p>}
        </div>
      </div>
    );
  }
  const stil =
    e.art === 'erfolg'
      ? 'bg-[#15803D]/25 text-[#BBF7D0] ring-1 ring-[#22C55E]/30'
      : e.art === 'fehler'
        ? 'bg-[#DC2626]/20 text-[#FECACA] ring-1 ring-[#EF4444]/30'
        : e.art === 'hinweis'
          ? 'border-l-2 border-[#F2B400] bg-[#F2B400]/[0.08] text-[#FDE68A]'
          : e.art === 'schritt'
            ? 'text-white'
            : 'text-white/70';
  const icon =
    e.art === 'erfolg' ? <CircleCheck className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden /> : e.art === 'fehler' || e.art === 'hinweis' ? <TriangleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden /> : <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#5EEAD4]" />;
  return (
    <div className="live-rein flex gap-2">
      {zeit}
      <div className={`flex min-w-0 flex-1 gap-2 rounded-xl px-3 py-2 ${stil}`}>
        {icon}
        <div className="min-w-0">
          <p className={`text-[13px] leading-snug ${e.art === 'schritt' ? 'font-bold' : 'font-semibold'}`}>{e.titel}</p>
          {e.text && <p className="mt-0.5 line-clamp-3 text-[12px] leading-relaxed opacity-75">{e.text}</p>}
        </div>
      </div>
    </div>
  );
}
