'use client';
import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Calculator,
  CalendarClock,
  Check,
  ClipboardCopy,
  FileCheck2,
  FileWarning,
  HardHat,
  MessageSquareText,
  RefreshCw,
  Scale,
  ShieldAlert,
  Sparkles,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { zahl } from '@/lib/format';
import type { Abgleich, Bieterfrage, HinweisStufe, HinweisThema, Position, PruefHinweis, Pruefung } from './typen';
import type { Befund } from '@/lib/pruefung';

const STUFE: Record<HinweisStufe, { label: string; punkt: string; pill: string; kante: string; kachel: string }> = {
  kritisch: { label: 'Kritisch', punkt: 'bg-[#DC2626]', pill: 'bg-[#FEE2E2] text-[#991B1B]', kante: 'before:bg-[#DC2626]', kachel: 'text-[#991B1B]' },
  beachten: { label: 'Beachten', punkt: 'bg-[#EAB308]', pill: 'bg-[#FEF6C7] text-[#7A5200]', kante: 'before:bg-[#EAB308]', kachel: 'text-[#7A5200]' },
  info: { label: 'Info', punkt: 'bg-[#22A565]', pill: 'bg-[#DCFCE7] text-[#14532D]', kante: 'before:bg-[#22A565]', kachel: 'text-[#14532D]' },
};

const THEMA: Record<HinweisThema, { label: string; icon: LucideIcon }> = {
  kosten: { label: 'Kosten', icon: Calculator },
  termine: { label: 'Termine', icon: CalendarClock },
  technik: { label: 'Technik', icon: Wrench },
  baustelle: { label: 'Baustelle', icon: HardHat },
  nachweise: { label: 'Nachweise', icon: FileCheck2 },
  vertrag: { label: 'Vertrag', icon: Scale },
};

const MERKMAL: Record<string, string> = { werkstoff: 'Werkstoff', oberflaeche: 'Oberfläche', profil: 'Profil', abmessung: 'Abmessung', befestigung: 'Befestigung', anzahl: 'Anzahl', sonstiges: 'Sonstiges' };

type Filter = 'alle' | HinweisStufe;

export function Pruefbericht({
  pruefung,
  abgleich,
  altHinweise,
  befunde,
  positionen,
  pruefLaeuft,
  abgleichLaeuft,
  hatPlaene,
  darfSchreiben,
  gesperrt,
  onPruefen,
  onAbgleich,
  onPosition,
}: {
  pruefung: Pruefung | null;
  abgleich: Abgleich | null;
  altHinweise: string[];
  befunde: { p: Position; befunde: Befund[] }[];
  positionen: Position[];
  pruefLaeuft: boolean;
  abgleichLaeuft: boolean;
  hatPlaene: boolean;
  darfSchreiben: boolean;
  gesperrt: boolean;
  onPruefen: () => void;
  onAbgleich: () => void;
  onPosition: (id: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>('alle');
  const [infosOffen, setInfosOffen] = useState(false);
  const [befundeOffen, setBefundeOffen] = useState(false);

  const hinweise = useMemo(() => pruefung?.hinweise ?? [], [pruefung]);
  const zahlen = { kritisch: 0, beachten: 0, info: 0 } as Record<HinweisStufe, number>;
  hinweise.forEach((h) => (zahlen[h.stufe] = (zahlen[h.stufe] ?? 0) + 1));
  const widersprueche = abgleich?.widersprueche ?? [];
  const fragen: Bieterfrage[] = [...(abgleich?.bieterfragen ?? []), ...(pruefung?.bieterfragen ?? [])].sort((a, b) => (a.stufe === b.stufe ? 0 : a.stufe === 'kritisch' ? -1 : 1));
  const kritischGesamt = zahlen.kritisch + widersprueche.filter((w) => w.stufe === 'kritisch').length;

  const sichtbar = hinweise.filter((h) => (filter === 'alle' ? h.stufe !== 'info' || infosOffen : h.stufe === filter));
  const infosVersteckt = filter === 'alle' && !infosOffen ? zahlen.info : 0;
  const idVon = (oz: string) => positionen.find((p) => (p.oz ?? '').replace(/\s/g, '') === oz.replace(/\s/g, ''))?.id;
  const warnBefunde = befunde.filter((x) => x.befunde.some((b) => b.stufe === 'warnung')).length;
  const laeuft = pruefLaeuft || abgleichLaeuft;

  return (
    <section aria-labelledby="pruefbericht" className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id="pruefbericht" className="flex items-center gap-2 text-[18px] font-bold tracking-[-0.01em]">
            Prüfbericht
            {kritischGesamt > 0 && <span className="inline-flex h-[22px] items-center rounded-full bg-[#DC2626] px-2 font-mono text-[12px] font-medium text-white">{kritischGesamt} kritisch</span>}
          </h2>
          <p className="mt-0.5 text-[14px] text-ink-600">
            {laeuft
              ? 'AIM prüft gerade Vorbemerkungen und Pläne …'
              : pruefung || abgleich
                ? `Vorbemerkungen${abgleich ? ', Pläne' : ''} und Preise geprüft${pruefung ? ` am ${new Date(pruefung.datum).toLocaleDateString('de-DE')}` : ''}.`
                : 'Noch nicht geprüft. AIM liest Vorbemerkungen und Pläne und sagt, worauf Sie achten müssen.'}
          </p>
        </div>
        {darfSchreiben && (
          <div className="flex flex-wrap gap-2">
            <button className="knopf-zweit knopf-klein" disabled={gesperrt || laeuft} onClick={onPruefen}>
              {pruefLaeuft ? <span className="size-3.5 animate-spin rounded-full border-2 border-brand border-t-transparent" /> : pruefung ? <RefreshCw className="size-3.5" strokeWidth={2} aria-hidden /> : <Sparkles className="size-3.5" strokeWidth={2} aria-hidden />}
              {pruefung ? 'Neu prüfen' : altHinweise.length ? 'Hinweise einordnen' : 'Vorbemerkungen prüfen'}
            </button>
            {hatPlaene && (
              <button className="knopf-zweit knopf-klein" disabled={gesperrt || laeuft} onClick={onAbgleich}>
                {abgleichLaeuft ? <span className="size-3.5 animate-spin rounded-full border-2 border-brand border-t-transparent" /> : <FileWarning className="size-3.5" strokeWidth={2} aria-hidden />}
                {abgleich ? 'Plan gegen LV neu prüfen' : 'Plan gegen LV prüfen'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Ampel-Kacheln, zugleich Filter */}
      {pruefung && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(['kritisch', 'beachten', 'info'] as HinweisStufe[]).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setFilter(filter === st ? 'alle' : st)}
              aria-pressed={filter === st}
              className={`karte flex items-center gap-3 p-4 text-left transition-[box-shadow,border-color] hover:border-line-strong ${filter === st ? 'border-brand shadow-[0_0_0_3px_var(--brand-tint)]' : ''}`}
            >
              <span className={`size-3.5 shrink-0 rounded-full ${STUFE[st].punkt}`} />
              <span>
                <span className={`block text-[26px] font-extrabold leading-none tracking-[-0.02em] ${STUFE[st].kachel}`}>{zahlen[st]}</span>
                <span className="mt-1 block text-[13px] font-semibold text-ink-600">{st === 'kritisch' ? 'Kritisch' : st === 'beachten' ? 'Beachten' : 'Info'}</span>
              </span>
            </button>
          ))}
          <a href="#bieterfragen" className="karte flex items-center gap-3 p-4 transition-[border-color] hover:border-line-strong">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-tint text-brand-strong"><MessageSquareText className="size-4" strokeWidth={1.75} aria-hidden /></span>
            <span>
              <span className="block text-[26px] font-extrabold leading-none tracking-[-0.02em] text-brand-strong">{fragen.length}</span>
              <span className="mt-1 block text-[13px] font-semibold text-ink-600">Bieterfragen</span>
            </span>
          </a>
        </div>
      )}

      {(pruefung?.zusammenfassung || abgleich?.zusammenfassung) && (
        <div className="rounded-2xl border border-brand-tint-2 px-5 py-4" style={{ background: 'var(--brand-gradient-soft)' }}>
          <p className="flex items-center gap-2 text-[13px] font-bold text-brand-strong"><Sparkles className="size-4" strokeWidth={1.75} aria-hidden />Auf einen Blick</p>
          {pruefung?.zusammenfassung && <p className="mt-1.5 text-[15px] leading-relaxed text-ink-950">{pruefung.zusammenfassung}</p>}
          {abgleich?.zusammenfassung && <p className="mt-1.5 text-[15px] leading-relaxed text-ink-950">{abgleich.zusammenfassung}</p>}
        </div>
      )}

      {/* Hinweise als Karten, kritisch zuerst */}
      {pruefung && sichtbar.length > 0 && (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {sichtbar.map((h, i) => (
            <HinweisKarte key={`${h.titel}-${i}`} h={h} idVon={idVon} onPosition={onPosition} />
          ))}
        </div>
      )}
      {pruefung && infosVersteckt > 0 && (
        <button className="knopf-leise knopf-klein self-start" onClick={() => setInfosOffen(true)}>
          {infosVersteckt} {infosVersteckt === 1 ? 'Info' : 'Infos'} ohne Preiswirkung anzeigen
        </button>
      )}

      {/* Noch nicht eingeordnet: alte Hinweise lesbar zeigen */}
      {!pruefung && altHinweise.length > 0 && (
        <div className="karte p-5">
          <p className="text-[14px] font-bold text-ink-950">Notiert beim Lesen der Vorbemerkungen ({altHinweise.length})</p>
          <p className="mt-0.5 text-[13px] text-ink-600">Mit „Hinweise einordnen“ sortiert AIM sie nach kritisch, beachten und info und schlägt Bieterfragen vor.</p>
          <ul className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
            {altHinweise.map((h) => (
              <li key={h} className="rounded-xl bg-sunken px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-700">{h}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Plan gegen LV */}
      {abgleich && (widersprueche.length > 0 || abgleich.fehlt_im_lv.length > 0 || abgleich.nicht_im_plan.length > 0 || abgleich.mengen.length > 0) && (
        <div className="flex flex-col gap-3">
          <h3 className="text-[16px] font-bold text-ink-950">Plan gegen LV</h3>
          {widersprueche.map((w, i) => {
            const id = idVon(w.oz);
            return (
              <article key={i} className={`karte relative overflow-hidden p-5 before:absolute before:inset-y-0 before:left-0 before:w-1 ${STUFE[w.stufe].kante}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`marke h-6 px-2.5 text-[12px] ${STUFE[w.stufe].pill}`}>{STUFE[w.stufe].label}</span>
                  <span className="marke h-6 bg-sunken px-2.5 text-[12px] text-ink-700">{MERKMAL[w.merkmal] ?? w.merkmal}</span>
                  {w.oz && (id ? <button className="ballon hover:bg-brand hover:text-white" onClick={() => onPosition(id)}>{w.oz}</button> : <span className="ballon">{w.oz}</span>)}
                  <span className="zahl ml-auto text-[12px] text-ink-500">{w.fundstelle}</span>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
                  <div className="rounded-xl bg-sunken px-4 py-3">
                    <p className="text-[12px] font-semibold text-ink-500">Im LV</p>
                    <p className="mt-0.5 text-[15px] font-semibold text-ink-950">{w.lv}</p>
                  </div>
                  <span className="hidden place-items-center text-ink-400 sm:grid"><ArrowRight className="size-4" strokeWidth={2} aria-hidden /></span>
                  <div className={`rounded-xl px-4 py-3 ${w.stufe === 'kritisch' ? 'bg-[#FEE2E2]' : 'bg-[#FEF6C7]'}`}>
                    <p className="text-[12px] font-semibold text-ink-600">Im Plan</p>
                    <p className="mt-0.5 text-[15px] font-semibold text-ink-950">{w.plan}</p>
                  </div>
                </div>
                {w.folge && <p className="mt-3 flex gap-2 text-[14px] text-ink-700"><Calculator className="mt-0.5 size-4 shrink-0 text-brand-strong" strokeWidth={1.75} aria-hidden />{w.folge}</p>}
              </article>
            );
          })}
          {(abgleich.fehlt_im_lv.length > 0 || abgleich.nicht_im_plan.length > 0 || abgleich.mengen.length > 0) && (
            <div className="karte divide-y divide-line">
              {abgleich.fehlt_im_lv.map((f, i) => (
                <ListenZeile key={`f${i}`} marke="Fehlt im LV" ton="bg-[#FEE2E2] text-[#991B1B]" titel={`${f.bauteil}${f.menge_plan ? `, ${zahl(f.menge_plan, 2)} ${f.einheit}` : ''}`} text={f.hinweis} fundstelle={f.fundstelle} />
              ))}
              {abgleich.mengen.map((m, i) => (
                <ListenZeile key={`m${i}`} marke="Menge" ton="bg-[#FEF6C7] text-[#7A5200]" oz={m.oz} id={idVon(m.oz)} onPosition={onPosition} titel={`LV ${zahl(m.menge_lv, 2)} ${m.einheit}, Plan ${zahl(m.menge_plan, 2)} ${m.einheit}`} text={m.hinweis} />
              ))}
              {abgleich.nicht_im_plan.map((n, i) => (
                <ListenZeile key={`n${i}`} marke="Auf keinem Plan" ton="bg-sunken text-ink-700" oz={n.oz} id={idVon(n.oz)} onPosition={onPosition} titel={n.hinweis} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bieterfragen */}
      {fragen.length > 0 && <Bieterfragen fragen={fragen} />}

      {/* Preise und Mengen, ohne KI */}
      {befunde.length > 0 && (
        <div className="karte">
          <button className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left" onClick={() => setBefundeOffen(!befundeOffen)} aria-expanded={befundeOffen}>
            <span>
              <span className="block text-[15px] font-bold text-ink-950">Preise und Mengen</span>
              <span className="block text-[13px] text-ink-600">{warnBefunde ? `${warnBefunde} Positionen mit Auffälligkeiten` : 'Keine Ausreißer'}{befunde.length > warnBefunde ? `, ${befunde.length - warnBefunde} mit Hinweisen` : ''}</span>
            </span>
            <span className="text-[13px] font-bold text-brand-strong">{befundeOffen ? 'Zuklappen' : 'Anzeigen'}</span>
          </button>
          {befundeOffen && (
            <ul className="divide-y divide-line border-t border-line">
              {befunde.map(({ p, befunde: bs }) => (
                <li key={p.id}>
                  <button className="flex w-full gap-3 px-5 py-3 text-left hover:bg-[var(--bg-hover)]" onClick={() => onPosition(p.id)}>
                    <span className="ballon shrink-0">{p.oz ?? '–'}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-semibold text-ink-950">{p.kurztext}</span>
                      {bs.map((b, i) => (
                        <span key={i} className={`block text-[13px] ${b.stufe === 'warnung' ? 'font-semibold text-[#9A3412]' : 'text-ink-600'}`}>{b.text}</span>
                      ))}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function HinweisKarte({ h, idVon, onPosition }: { h: PruefHinweis; idVon: (oz: string) => string | undefined; onPosition: (id: string) => void }) {
  const st = STUFE[h.stufe] ?? STUFE.info;
  const th = THEMA[h.thema] ?? THEMA.technik;
  return (
    <article className={`karte relative flex flex-col gap-2.5 overflow-hidden p-5 before:absolute before:inset-y-0 before:left-0 before:w-1 ${st.kante}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`marke h-6 gap-1.5 px-2.5 text-[12px] ${st.pill}`}><span className={`size-1.5 rounded-full ${st.punkt}`} />{st.label}</span>
        <span className="marke h-6 gap-1.5 bg-sunken px-2.5 text-[12px] text-ink-700"><th.icon className="size-3.5" strokeWidth={1.75} aria-hidden />{th.label}</span>
        {h.fundstelle && <span className="zahl ml-auto text-[12px] text-ink-500">{h.fundstelle}</span>}
      </div>
      <h4 className="text-[16px] font-bold leading-snug text-ink-950">{h.titel}</h4>
      <p className="text-[14px] leading-relaxed text-ink-700">{h.text}</p>
      {h.folge && (
        <p className={`mt-auto flex gap-2 rounded-xl px-3.5 py-2.5 text-[14px] font-semibold leading-snug ${h.stufe === 'kritisch' ? 'bg-[#FEF2F2] text-[#7F1D1D]' : 'bg-brand-tint/60 text-brand-strong'}`}>
          {h.stufe === 'kritisch' ? <ShieldAlert className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden /> : <Calculator className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden />}
          {h.folge}
        </p>
      )}
      {h.oz?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {h.oz.map((oz) => {
            const id = idVon(oz);
            return id ? <button key={oz} className="ballon hover:bg-brand hover:text-white" onClick={() => onPosition(id)}>{oz}</button> : <span key={oz} className="ballon">{oz}</span>;
          })}
        </div>
      )}
    </article>
  );
}

function ListenZeile({ marke, ton, titel, text, fundstelle, oz, id, onPosition }: { marke: string; ton: string; titel: string; text?: string; fundstelle?: string; oz?: string; id?: string; onPosition?: (id: string) => void }) {
  return (
    <div className="flex flex-wrap items-start gap-x-3 gap-y-1 px-5 py-3.5">
      <span className={`marke h-6 shrink-0 px-2.5 text-[12px] ${ton}`}>{marke}</span>
      {oz && (id && onPosition ? <button className="ballon shrink-0 hover:bg-brand hover:text-white" onClick={() => onPosition(id)}>{oz}</button> : <span className="ballon shrink-0">{oz}</span>)}
      <div className="min-w-0 flex-1 basis-[240px]">
        <p className="text-[14px] font-semibold text-ink-950">{titel}</p>
        {text && <p className="text-[13px] text-ink-600">{text}</p>}
      </div>
      {fundstelle && <span className="zahl text-[12px] text-ink-500">{fundstelle}</span>}
    </div>
  );
}

function Bieterfragen({ fragen }: { fragen: Bieterfrage[] }) {
  const [kopiert, setKopiert] = useState<number | 'alle' | null>(null);
  const kopiere = async (text: string, schluessel: number | 'alle') => {
    try {
      await navigator.clipboard.writeText(text);
      setKopiert(schluessel);
      setTimeout(() => setKopiert(null), 1800);
    } catch {
      // Zwischenablage gesperrt: Text bleibt markierbar
    }
  };
  const alle = fragen.map((f, i) => `${i + 1}. ${f.bezug ? `${f.bezug}: ` : ''}${f.frage}`).join('\n\n');
  return (
    <div id="bieterfragen" className="flex scroll-mt-24 flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-[16px] font-bold text-ink-950">Bieterfragen</h3>
          <p className="text-[13px] text-ink-600">Vorschläge von AIM, fertig formuliert. Sie entscheiden, was Sie an die Vergabestelle schicken.</p>
        </div>
        <button className="knopf-zweit knopf-klein" onClick={() => kopiere(alle, 'alle')}>
          {kopiert === 'alle' ? <Check className="size-3.5" strokeWidth={2} aria-hidden /> : <ClipboardCopy className="size-3.5" strokeWidth={2} aria-hidden />}
          {kopiert === 'alle' ? 'Kopiert' : 'Alle kopieren'}
        </button>
      </div>
      <ol className="flex flex-col gap-3">
        {fragen.map((f, i) => (
          <li key={i} className="karte flex gap-4 p-5">
            <span className={`grid size-8 shrink-0 place-items-center rounded-full font-mono text-[13px] font-semibold ${f.stufe === 'kritisch' ? 'bg-[#FEE2E2] text-[#991B1B]' : 'bg-brand-tint text-brand-strong'}`}>{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-500">
                {f.bezug && <span className="zahl font-semibold text-ink-700">{f.bezug}</span>}
                <span>{f.quelle === 'plaene' ? 'aus Plan gegen LV' : 'aus den Vorbemerkungen'}</span>
              </div>
              <p className="mt-1 text-[15px] leading-relaxed text-ink-950">{f.frage}</p>
              {f.begruendung && <p className="mt-1.5 text-[13px] text-ink-600">Warum fragen: {f.begruendung}</p>}
            </div>
            <button className="grid size-9 shrink-0 place-items-center self-start rounded-full text-ink-500 hover:bg-[var(--bg-hover)] hover:text-brand-strong" onClick={() => kopiere(`${f.bezug ? `${f.bezug}: ` : ''}${f.frage}`, i)} aria-label={`Frage ${i + 1} kopieren`} title="Kopieren">
              {kopiert === i ? <Check className="size-4" strokeWidth={2} aria-hidden /> : <ClipboardCopy className="size-4" strokeWidth={1.75} aria-hidden />}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
