'use client';
import { useEffect, useState } from 'react';
import { parseZahl } from '@/lib/format';

function anzeigen(v: number | null | undefined, stellen: number) {
  if (v === null || v === undefined || Number.isNaN(v)) return '';
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: stellen, useGrouping: false }).format(v);
}

export function ZahlFeld({
  wert,
  onWert,
  stellen = 2,
  klein = false,
  className = '',
  platzhalter,
  rechts = true,
  ausgegraut = false,
  ariaLabel,
}: {
  wert: number | null | undefined;
  onWert: (v: number | null) => void;
  stellen?: number;
  klein?: boolean;
  className?: string;
  platzhalter?: string;
  rechts?: boolean;
  ausgegraut?: boolean;
  ariaLabel?: string;
}) {
  const [text, setText] = useState(anzeigen(wert, stellen));
  const [fokus, setFokus] = useState(false);
  // Nur echte Änderungen melden: Reinklicken und wieder Rausgehen darf keinen Wert „von Hand“ setzen
  const [start, setStart] = useState('');
  useEffect(() => {
    if (!fokus) setText(anzeigen(wert, stellen));
  }, [wert, stellen, fokus]);
  const uebernehmen = () => {
    if (text.trim() === start.trim()) {
      setText(anzeigen(wert, stellen));
      return;
    }
    const n = parseZahl(text);
    onWert(n);
    setText(anzeigen(n, stellen));
  };
  return (
    <input
      inputMode="decimal"
      aria-label={ariaLabel}
      className={`eingabe ${klein ? 'eingabe-klein' : ''} ${rechts ? 'text-right' : ''} zahl ${ausgegraut ? 'text-hell' : ''} ${className}`}
      value={text}
      placeholder={platzhalter}
      onFocus={(e) => {
        setFokus(true);
        setStart(e.currentTarget.value);
        e.currentTarget.select();
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        setFokus(false);
        uebernehmen();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

export function Feld({ label, einheit, children, hinweis }: { label: string; einheit?: string; children: React.ReactNode; hinweis?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        {children}
        {einheit && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-hell">{einheit}</span>}
      </div>
      {hinweis && <p className="text-[11px] text-hell mt-1">{hinweis}</p>}
    </div>
  );
}

export function Schalter({ an, onAn, label }: { an: boolean; onAn: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center justify-between gap-3 py-1.5 cursor-pointer select-none">
      <span className="text-sm">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={an}
        onClick={() => onAn(!an)}
        className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${an ? 'bg-tiefblau' : 'bg-linie-stark'}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${an ? 'left-[18px]' : 'left-0.5'}`} />
      </button>
    </label>
  );
}

export function Auswahl<T extends string>({ wert, onWert, optionen }: { wert: T; onWert: (v: T) => void; optionen: { wert: T; label: string }[] }) {
  return (
    <div className="flex rounded-lg border border-linie-stark p-0.5 bg-papier">
      {optionen.map((o) => (
        <button
          key={o.wert}
          type="button"
          onClick={() => onWert(o.wert)}
          className={`flex-1 h-8 rounded-md text-[13px] px-2 whitespace-nowrap ${wert === o.wert ? 'bg-flaeche shadow-sm text-tinte font-medium' : 'text-grau hover:text-tinte'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function useAutoSpeichern<T>(wert: T, speichern: (w: T) => Promise<boolean>, verzoegerung = 900) {
  const [stand, setStand] = useState<'gespeichert' | 'ungespeichert' | 'speichert' | 'fehler'>('gespeichert');
  // Inhalt statt Objekt vergleichen: ein neu erzeugtes, aber gleiches Objekt löst kein Speichern aus
  const schluessel = JSON.stringify(wert);
  const [gespeichert, setGespeichert] = useState(schluessel);
  useEffect(() => {
    if (schluessel === gespeichert) {
      setStand('gespeichert');
      return;
    }
    setStand('ungespeichert');
    const t = setTimeout(async () => {
      setStand('speichert');
      const ok = await speichern(wert);
      setStand(ok ? 'gespeichert' : 'fehler');
      if (ok) setGespeichert(schluessel);
    }, verzoegerung);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schluessel]);
  return stand;
}

export function SpeicherStand({ stand }: { stand: 'gespeichert' | 'ungespeichert' | 'speichert' | 'fehler' }) {
  const t = { gespeichert: 'Gespeichert', ungespeichert: 'Änderungen …', speichert: 'Speichert …', fehler: 'Nicht gespeichert' }[stand];
  return <span className={`text-[12px] ${stand === 'fehler' ? 'text-rot' : 'text-hell'}`}>{t}</span>;
}
