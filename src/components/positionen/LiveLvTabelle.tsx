'use client';
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { euro, zahl } from '@/lib/format';
import { stufe } from './Ampel';

/** Eine Zeile des Leistungsverzeichnisses in der Live-Ansicht. Werte kommen direkt aus den gespeicherten Positionen. */
export type LiveZeile = {
  id: string;
  oz: string | null;
  kurztext: string | null;
  menge: number | null;
  einheit: string | null;
  ep: number | null;
  gp: number | null;
  fertig: boolean;
  sicherheit: number | null;
  /** Bedarf, Wahl, Fremdgewerk: gerechnet, aber nicht in der Summe */
  hinweis: string | null;
};

const SCHRITTE = ['Ansatz wählen', 'Gewicht und Stunden', 'Ihre Stammdaten', 'Archiv vergleichen', 'Sicherheit bewerten'];
const VERSATZ_MS = 170;

/**
 * Das LV rattert durch: Zeilen laufen beim Lesen ein, die Positionen im aktuellen Paket werden abgetastet,
 * fertige Preise zählen hoch und blitzen kurz auf. Die Zahlen sind die echten Ergebnisse, nur das Hochzählen ist Animation.
 */
export function LiveLvTabelle({ zeilen, aktiv, laeuft, takt }: { zeilen: LiveZeile[]; aktiv: string[]; laeuft: boolean; takt: number }) {
  const scroller = useRef<HTMLDivElement>(null);
  const reihen = useRef(new Map<string, HTMLDivElement>());
  const paketIndex = useRef(new Map<string, number>());
  const fertig = zeilen.filter((z) => z.fertig).length;
  const aktivSet = new Set(laeuft ? aktiv : []);

  // Position im aktuellen Paket merken: daraus ergibt sich, in welcher Reihenfolge die Preise aufblitzen
  aktiv.forEach((id, i) => paketIndex.current.set(id, i));

  // Das aktuelle Paket in die Mitte holen
  const erstes = laeuft ? aktiv.find((id) => reihen.current.has(id)) : undefined;
  useEffect(() => {
    const el = scroller.current;
    const reihe = erstes ? reihen.current.get(erstes) : null;
    if (!el || !reihe) return;
    el.scrollTo({ top: Math.max(0, reihe.offsetTop - el.clientHeight / 3), behavior: 'smooth' });
  }, [erstes]);

  let titel = '';
  return (
    <div className="relative flex h-full min-h-0 w-full flex-col">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 px-1 pb-4">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#5EEAD4]">Leistungsverzeichnis</p>
          <p className="mt-1 text-[22px] font-extrabold tracking-[-0.01em] text-white sm:text-[26px]">
            <span className="zahl">{fertig}</span> von <span className="zahl">{zeilen.length}</span> Positionen kalkuliert
          </p>
        </div>
        <div className="h-2.5 w-full max-w-[360px] overflow-hidden rounded-full bg-white/[0.08]">
          <div className="h-full rounded-full bg-[#5EEAD4] shadow-[0_0_18px_rgba(94,234,212,0.6)] transition-[width] duration-700" style={{ width: `${zeilen.length ? (fertig / zeilen.length) * 100 : 0}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-[84px_minmax(0,1fr)_112px_120px_136px] gap-3 border-b border-white/10 px-4 pb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#6FB7AA] max-sm:grid-cols-[72px_minmax(0,1fr)_110px]">
        <span>OZ</span>
        <span>Position</span>
        <span className="text-right max-sm:hidden">Menge</span>
        <span className="text-right max-sm:hidden">EP</span>
        <span className="text-right">GP</span>
      </div>

      <div ref={scroller} className="relative min-h-0 flex-1 overflow-y-auto pr-1 pt-2 [scrollbar-width:thin]">
        {zeilen.map((z, i) => {
          const neuerTitel = (z.oz ?? '').split('.')[0];
          const trenner = neuerTitel && neuerTitel !== titel && (z.oz ?? '').includes('.');
          titel = neuerTitel || titel;
          return (
            <Fragment key={z.id}>
              {trenner && (
                <div className="live-rein flex items-center gap-3 px-4 pb-1.5 pt-4" style={{ animationDelay: `${Math.min(i, 45) * 28}ms` }}>
                  <span className="zahl text-[12px] font-bold text-[#5EEAD4]">Titel {neuerTitel}</span>
                  <span className="h-px flex-1 bg-white/10" />
                </div>
              )}
              <Zeile
                z={z}
                index={i}
                aktiv={aktivSet.has(z.id)}
                schritt={SCHRITTE[(Math.floor(takt / 1300) + (paketIndex.current.get(z.id) ?? 0)) % SCHRITTE.length]}
                verzoegerung={(paketIndex.current.get(z.id) ?? 0) * VERSATZ_MS}
                anmelden={(el) => (el ? reihen.current.set(z.id, el) : reihen.current.delete(z.id))}
              />
            </Fragment>
          );
        })}
        <div className="h-[30vh]" aria-hidden />
      </div>
    </div>
  );
}

function Zeile({ z, index, aktiv, schritt, verzoegerung, anmelden }: { z: LiveZeile; index: number; aktiv: boolean; schritt: string; verzoegerung: number; anmelden: (el: HTMLDivElement | null) => void }) {
  const schonFertig = useRef(z.fertig);
  // f: Fortschritt des Hochzählens, 1 = Endwert. Fertig beim Öffnen: sofort 1, frisch fertig: zählt nach Versatz hoch
  const [f, setF] = useState(z.fertig ? 1 : 0);
  const [blitz, setBlitz] = useState(false);

  useLayoutEffect(() => {
    if (!z.fertig) {
      setF(0);
      return;
    }
    if (schonFertig.current) return;
    let raf = 0;
    const t0 = performance.now() + verzoegerung;
    const lauf = (t: number) => {
      const anteil = Math.max(0, Math.min(1, (t - t0) / 650));
      if (anteil > 0) setBlitz(true);
      setF(anteil === 0 ? 0 : 1 - Math.pow(1 - anteil, 3));
      if (anteil < 1) raf = requestAnimationFrame(lauf);
    };
    raf = requestAnimationFrame(lauf);
    return () => cancelAnimationFrame(raf);
    // verzoegerung bewusst nur beim Wechsel auf fertig
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [z.fertig, z.ep, z.gp]);

  const rechnet = (aktiv && !z.fertig) || (z.fertig && f === 0 && !schonFertig.current);
  const st = z.fertig && z.sicherheit !== null && f > 0 ? stufe(z.sicherheit) : null;
  const betrag = (w: number | null) => (w === null ? <span className="text-white/40">–</span> : euro(w * f));

  return (
    <div
      ref={anmelden}
      className={`live-rein relative mb-1 grid grid-cols-[84px_minmax(0,1fr)_112px_120px_136px] items-center gap-3 overflow-hidden rounded-xl px-4 py-2.5 transition-colors duration-300 max-sm:grid-cols-[72px_minmax(0,1fr)_110px] ${
        rechnet ? 'live-zeile-scan bg-[#5EEAD4]/[0.09] ring-1 ring-[#5EEAD4]/45' : z.fertig ? 'bg-white/[0.035]' : 'bg-transparent'
      } ${blitz ? 'live-blitz' : ''}`}
      style={{ animationDelay: blitz ? '0ms' : `${Math.min(index, 45) * 28}ms` }}
    >
      <span className={`zahl justify-self-start rounded-full px-2 py-0.5 text-[13px] font-semibold ${rechnet ? 'bg-[#5EEAD4] text-[#04211C]' : 'bg-[#0E8C7C]/35 text-[#BFF3EA]'}`}>{z.oz ?? '·'}</span>
      <span className="min-w-0">
        <span className={`block truncate text-[16px] font-semibold leading-snug ${z.fertig || rechnet ? 'text-white' : 'text-white/55'}`}>{z.kurztext}</span>
        <span className="mt-0.5 flex h-[18px] items-center gap-2 text-[12px]">
          {rechnet ? (
            <span className="live-cursor font-semibold text-[#5EEAD4]">{schritt}</span>
          ) : st ? (
            <span className="inline-flex items-center gap-1.5 font-semibold text-white/75">
              <span className={`size-2 rounded-full ${st.punkt}`} />
              {Math.round((z.sicherheit ?? 0) * 100)} % · {st.label}
            </span>
          ) : null}
          {z.hinweis && <span className="rounded-full bg-white/[0.08] px-2 py-px font-semibold text-white/60">{z.hinweis}</span>}
        </span>
      </span>
      <span className="zahl text-right text-[14px] text-white/70 max-sm:hidden">{z.menge !== null ? `${zahl(z.menge, 3)} ${z.einheit ?? ''}` : ''}</span>
      <span className="zahl text-right text-[15px] font-semibold text-white/85 max-sm:hidden">{rechnet ? <span className="live-schimmer" /> : z.fertig ? betrag(z.ep) : <span className="text-white/25">·</span>}</span>
      <span className={`zahl text-right text-[16px] font-bold ${z.hinweis ? 'text-white/45' : 'text-white'}`}>{rechnet ? <span className="live-schimmer" /> : z.fertig ? (z.hinweis ? 'nur EP' : betrag(z.gp)) : <span className="text-white/25">·</span>}</span>
    </div>
  );
}
