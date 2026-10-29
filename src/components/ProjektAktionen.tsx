'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Archive, ArchiveRestore, MoreHorizontal, Trash2 } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { darfLoeschen } from '@/lib/projekt-aktionen';

type Aktion = 'archivieren' | 'wiederherstellen' | 'loeschen';
type Lage = { top?: number; bottom?: number; right: number };

/** archiviert_am einer Kalkulation mit dem Browser-Client lesen (null bei Fehler). */
async function ladeArchiviertAm(id: string): Promise<string | null> {
  const { data } = await supabaseBrowser().from('projekte').select('archiviert_am').eq('id', id).maybeSingle();
  return (data as { archiviert_am: string | null } | null)?.archiviert_am ?? null;
}

/** Lädt archiviert_am einer Kalkulation im Browser. undefined, solange es lädt. */
export function useArchiviertAm(id: string) {
  const [wert, setWert] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let aktiv = true;
    ladeArchiviertAm(id).then((w) => aktiv && setWert(w));
    return () => {
      aktiv = false;
    };
  }, [id]);
  return [wert, setWert] as const;
}

const TEXT: Record<Aktion, { titel: string; text: (name: string) => string; knopf: string; laeuft: string }> = {
  loeschen: {
    titel: 'Kalkulation endgültig löschen?',
    text: (n) => `${n} wird mit allen Positionen und den hochgeladenen Unterlagen dauerhaft gelöscht. Das lässt sich nicht rückgängig machen.`,
    knopf: 'Endgültig löschen',
    laeuft: 'Lösche …',
  },
  archivieren: {
    titel: 'Kalkulation archivieren?',
    text: (n) => `${n} verschwindet aus den aktiven Kalkulationen. Die Preise bleiben im Archiv für spätere Vergleiche. Unter Kalkulationen im Reiter „Archiv“ lässt sie sich jederzeit wiederherstellen.`,
    knopf: 'Archivieren',
    laeuft: 'Archiviere …',
  },
  wiederherstellen: {
    titel: 'Kalkulation wiederherstellen',
    text: (n) => `${n} erscheint wieder unter den aktiven Kalkulationen.`,
    knopf: 'Wiederherstellen',
    laeuft: 'Stelle wieder her …',
  },
};

const MENUE_HOEHE = 210;

/**
 * „…“-Menü einer Kalkulation: Archivieren, Wiederherstellen, Löschen (nur Entwürfe mit offenem Ausgang).
 * archiviert_am weglassen, dann lädt die Komponente den Wert selbst.
 * nachLoeschen: 'liste' auf der Projektseite (nach dem Löschen zur Übersicht), 'refresh' in Listen (Liste neu laden, auch nach dem Archivieren).
 */
export function ProjektAktionen({
  id,
  status,
  ergebnis_label,
  archiviert_am,
  titel,
  nachLoeschen = 'refresh',
  onArchiviert,
}: {
  id: string;
  status: string;
  ergebnis_label: string | null;
  archiviert_am?: string | null;
  titel?: string;
  nachLoeschen?: 'liste' | 'refresh';
  onArchiviert?: (archiviert_am: string | null) => void;
}) {
  const router = useRouter();
  const [archiviert, setArchiviert] = useState<string | null>(archiviert_am ?? null);
  const [lage, setLage] = useState<Lage | null>(null);
  const [frage, setFrage] = useState<{ aktion: Aktion; fehler?: string; nurSchliessen?: boolean } | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const knopf = useRef<HTMLButtonElement>(null);
  const menue = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const loeschbar = darfLoeschen({ status, ergebnis_label });

  // Vorgabe von außen übernehmen, sonst selbst laden
  useEffect(() => {
    if (archiviert_am !== undefined) {
      setArchiviert(archiviert_am);
      return;
    }
    let aktiv = true;
    ladeArchiviertAm(id).then((w) => aktiv && setArchiviert(w));
    return () => {
      aktiv = false;
    };
  }, [id, archiviert_am]);

  // Menü schließen: Klick daneben, Escape, Scrollen, Fenstergröße
  useEffect(() => {
    if (!lage) return;
    const zu = () => setLage(null);
    const klick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menue.current?.contains(t) || knopf.current?.contains(t)) return;
      zu();
    };
    const taste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        zu();
        knopf.current?.focus();
      }
    };
    document.addEventListener('mousedown', klick);
    document.addEventListener('keydown', taste);
    window.addEventListener('scroll', zu, true);
    window.addEventListener('resize', zu);
    menue.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener('mousedown', klick);
      document.removeEventListener('keydown', taste);
      window.removeEventListener('scroll', zu, true);
      window.removeEventListener('resize', zu);
    };
  }, [lage]);

  // Rückfrage als modaler Dialog
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (frage && !d.open) d.showModal();
    if (!frage && d.open) d.close();
  }, [frage]);

  function umschalten() {
    if (lage) return setLage(null);
    const r = knopf.current?.getBoundingClientRect();
    if (!r) return;
    const { clientWidth: breite, clientHeight: hoehe } = document.documentElement;
    const right = Math.max(8, breite - r.right);
    const platzUnten = hoehe - r.bottom;
    setLage(platzUnten < MENUE_HOEHE && r.top > platzUnten ? { bottom: hoehe - r.top + 6, right } : { top: r.bottom + 6, right });
  }

  function pfeile(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const punkte = Array.from(menue.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
    const i = punkte.indexOf(document.activeElement as HTMLButtonElement);
    punkte[(i + (e.key === 'ArrowDown' ? 1 : -1) + punkte.length) % punkte.length]?.focus();
  }

  async function ausfuehren(aktion: Aktion) {
    setLaeuft(true);
    try {
      const res =
        aktion === 'loeschen'
          ? await fetch(`/api/projekt/${id}`, { method: 'DELETE' })
          : await fetch(`/api/projekt/${id}/archiv`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ archiviert: aktion === 'archivieren' }) });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; fehler?: string; archiviert_am?: string | null };
      if (!res.ok || !j.ok) {
        // Bei fehlender Berechtigung, unbekannter Kalkulation oder Löschsperre hilft kein zweiter Versuch
        setFrage({ aktion, fehler: j.fehler ?? 'Das ging nicht. Bitte noch einmal versuchen.', nurSchliessen: [401, 403, 404, 409].includes(res.status) });
        return;
      }
      setFrage(null);
      if (aktion === 'loeschen') {
        if (nachLoeschen === 'liste') router.replace('/kalkulationen');
        else router.refresh();
        return;
      }
      const neu = aktion === 'archivieren' ? (j.archiviert_am ?? new Date().toISOString()) : null;
      setArchiviert(neu);
      onArchiviert?.(neu);
      if (nachLoeschen === 'refresh') router.refresh();
    } catch {
      setFrage({ aktion, fehler: 'Keine Verbindung. Bitte noch einmal versuchen.' });
    } finally {
      setLaeuft(false);
    }
  }

  function waehlen(aktion: Aktion) {
    setLage(null);
    if (aktion === 'wiederherstellen') ausfuehren(aktion);
    else setFrage({ aktion });
  }

  const t = frage ? TEXT[frage.aktion] : null;
  const name = titel?.trim() ? `„${titel.trim()}“` : 'Die Kalkulation';
  const PUNKT = 'flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left outline-none hover:bg-[var(--bg-hover)] focus-visible:bg-[var(--bg-hover)]';

  return (
    <>
      <button
        ref={knopf}
        type="button"
        onClick={umschalten}
        aria-label="Weitere Aktionen"
        title="Weitere Aktionen"
        aria-haspopup="menu"
        aria-expanded={!!lage}
        className={`grid size-8 shrink-0 place-items-center rounded-full text-ink-500 transition-colors hover:bg-[var(--bg-active)] hover:text-ink-950 ${lage ? 'bg-[var(--bg-active)] text-ink-950' : ''}`}
      >
        <MoreHorizontal className="size-[18px]" strokeWidth={2} aria-hidden />
      </button>

      {lage &&
        createPortal(
          <div
            ref={menue}
            role="menu"
            aria-label="Aktionen zur Kalkulation"
            onKeyDown={pfeile}
            style={{ position: 'fixed', top: lage.top, bottom: lage.bottom, right: lage.right }}
            className="z-50 w-64 rounded-2xl border border-line bg-surface p-1.5 text-left shadow-[var(--shadow-float)]"
          >
            {archiviert ? (
              <button role="menuitem" type="button" className={PUNKT} onClick={() => waehlen('wiederherstellen')}>
                <ArchiveRestore className="mt-0.5 size-4 shrink-0 text-ink-600" strokeWidth={1.75} aria-hidden />
                <span className="min-w-0">
                  <span className="block text-[14px] font-bold text-ink-950">Wiederherstellen</span>
                  <span className="block text-[13px] leading-[18px] text-ink-600">Zurück in die aktive Liste</span>
                </span>
              </button>
            ) : (
              <button role="menuitem" type="button" className={PUNKT} onClick={() => waehlen('archivieren')}>
                <Archive className="mt-0.5 size-4 shrink-0 text-ink-600" strokeWidth={1.75} aria-hidden />
                <span className="min-w-0">
                  <span className="block text-[14px] font-bold text-ink-950">Archivieren</span>
                  <span className="block text-[13px] leading-[18px] text-ink-600">Preise bleiben im Archiv</span>
                </span>
              </button>
            )}
            {loeschbar ? (
              <>
                <div className="mx-3 my-1 h-px bg-line" aria-hidden />
                <button role="menuitem" type="button" className={`${PUNKT} hover:bg-signal-tint focus-visible:bg-signal-tint`} onClick={() => waehlen('loeschen')}>
                  <Trash2 className="mt-0.5 size-4 shrink-0 text-signal" strokeWidth={1.75} aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-[14px] font-bold text-signal">Löschen</span>
                    <span className="block text-[13px] leading-[18px] text-ink-600">Endgültig, mit allen Unterlagen</span>
                  </span>
                </button>
              </>
            ) : (
              <p className="mx-3 mb-1.5 mt-1 border-t border-line pt-2.5 text-[12px] leading-[17px] text-ink-500">Löschen geht nur bei Entwürfen ohne Ausgang. Alles andere bleibt für den Preisvergleich erhalten.</p>
            )}
          </div>,
          document.body,
        )}

      <dialog
        ref={dialog}
        aria-labelledby={`aktion-${id}`}
        onClose={() => setFrage(null)}
        onCancel={(e) => {
          e.preventDefault();
          if (!laeuft) setFrage(null);
        }}
        onClick={(e) => {
          // Klick auf den abgedunkelten Hintergrund
          if (e.target === dialog.current && !laeuft) setFrage(null);
        }}
        className="m-auto w-[min(440px,calc(100vw-32px))] rounded-2xl border border-line bg-surface p-0 text-left text-ink-950 shadow-[var(--shadow-float)] backdrop:bg-[rgba(15,28,26,0.45)]"
      >
        {frage && t && (
          <div className="p-6">
            <span className={`grid size-11 place-items-center rounded-full ${frage.aktion === 'loeschen' ? 'bg-signal-tint text-signal' : 'bg-brand-tint text-brand-strong'}`}>
              {frage.aktion === 'loeschen' ? <Trash2 className="size-5" strokeWidth={1.75} aria-hidden /> : frage.aktion === 'archivieren' ? <Archive className="size-5" strokeWidth={1.75} aria-hidden /> : <ArchiveRestore className="size-5" strokeWidth={1.75} aria-hidden />}
            </span>
            <h2 id={`aktion-${id}`} className="mt-4 text-[18px] font-bold leading-snug tracking-[-0.01em]">{t.titel}</h2>
            <p className="mt-2 text-[15px] leading-[22px] text-ink-600">{t.text(name)}</p>
            {frage.fehler && <p role="alert" className="mt-3 rounded-xl bg-signal-tint px-3 py-2 text-[14px] font-semibold text-signal">{frage.fehler}</p>}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" className="knopf-zweit" disabled={laeuft} onClick={() => setFrage(null)}>{frage.nurSchliessen ? 'Schließen' : 'Abbrechen'}</button>
              {!frage.nurSchliessen && (
                <button
                  type="button"
                  disabled={laeuft}
                  onClick={() => ausfuehren(frage.aktion)}
                  className={frage.aktion === 'loeschen' ? 'knopf bg-signal text-white hover:bg-[var(--signal-hover)]' : 'knopf-primaer'}
                >
                  {laeuft ? t.laeuft : frage.fehler ? 'Noch einmal versuchen' : t.knopf}
                </button>
              )}
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
