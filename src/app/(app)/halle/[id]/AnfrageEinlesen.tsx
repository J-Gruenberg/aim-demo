'use client';
import { useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import type { HallenVorschlag } from '@/lib/halle-lesen';

type Props = {
  projektId: string;
  offen: boolean;
  onUebernehmen: (v: HallenVorschlag, keys: Set<string>, quellen: string[]) => void;
};

const sicherName = (n: string) =>
  n
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[^\w.\-]+/g, '_').slice(-120);

/** Fotos vom Handy sind oft riesig: vor dem Hochladen auf höchstens 2400 px verkleinern. */
async function verkleinern(f: File): Promise<File> {
  if (!/^image\/(jpeg|png)$/.test(f.type) || f.size < 1.5 * 1024 * 1024) return f;
  try {
    const bild = await createImageBitmap(f);
    const faktor = Math.min(1, 2400 / Math.max(bild.width, bild.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bild.width * faktor);
    c.height = Math.round(bild.height * faktor);
    c.getContext('2d')!.drawImage(bild, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/jpeg', 0.85));
    return blob ? new File([blob], f.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }) : f;
  } catch {
    return f;
  }
}

export function AnfrageEinlesen({ projektId, offen: offenStart, onUebernehmen }: Props) {
  const [offen, setOffen] = useState(offenStart);
  const [dateien, setDateien] = useState<File[]>([]);
  const [text, setText] = useState('');
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ergebnis, setErgebnis] = useState<{ v: HallenVorschlag; quellen: string[] } | null>(null);
  const [auswahl, setAuswahl] = useState<Set<string>>(new Set());
  const input = useRef<HTMLInputElement>(null);

  function hinzu(files: FileList | File[]) {
    const ok = Array.from(files).filter((f) => /\.(pdf|jpe?g|png)$/i.test(f.name));
    if (ok.length < Array.from(files).length) setFehler('Nur PDF, JPG und PNG. Andere Dateien wurden weggelassen.');
    setDateien((d) => [...d, ...ok].slice(0, 4));
  }

  async function lesen() {
    setFehler(null);
    setErgebnis(null);
    const sb = supabaseBrowser();
    const ids: string[] = [];
    try {
      for (const roh of dateien) {
        setLaeuft(`Lade ${roh.name} hoch …`);
        const f = await verkleinern(roh);
        const pfad = `${projektId}/${crypto.randomUUID()}-${sicherName(f.name)}`;
        const { error } = await sb.storage.from('unterlagen').upload(pfad, f, { contentType: f.type || 'application/octet-stream' });
        if (error) throw new Error(`${roh.name}: Hochladen ging nicht (${error.message}).`);
        const { data } = await sb.from('dateien').insert({ projekt_id: projektId, pfad, name: f.name, groesse: f.size, art: 'plan' }).select('id').single();
        if (data) ids.push(data.id);
      }
      setLaeuft(dateien.length ? 'Zeichnung wird gelesen … (dauert bis zu einer Minute)' : 'Anfrage wird gelesen …');
      const r = await fetch(`/api/halle/${projektId}/lesen`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ datei_ids: ids, text }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.vorschlag) throw new Error(j.fehler ?? 'Das Lesen hat nicht geklappt. Bitte erneut versuchen.');
      const v = j.vorschlag as HallenVorschlag;
      setErgebnis({ v, quellen: j.quellen ?? [] });
      setAuswahl(new Set(v.erkannt.map((x) => x.key)));
      setDateien([]);
    } catch (e) {
      setFehler((e as Error).message);
    }
    setLaeuft(null);
  }

  if (!offen) {
    return (
      <button className="knopf-zweit" onClick={() => setOffen(true)}>
        Aus Anfrage oder Zeichnung übernehmen
      </button>
    );
  }

  return (
    <section
      className="karte p-4 space-y-3"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length) hinzu(e.dataTransfer.files);
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-sm">Aus Anfrage oder Zeichnung übernehmen</h2>
          <p className="text-[12px] text-grau max-w-[640px]">
            Zeichnung, Skizze oder Baubeschreibung hochladen (PDF, Foto) oder den Text der Kundenanfrage einfügen. Die KI liest Maße, Dach, Wand, Tore und Leistungsumfang ab. Sie sehen jeden Wert mit Fundstelle und entscheiden, was übernommen wird.
          </p>
        </div>
        <button className="knopf-leise knopf-klein" onClick={() => setOffen(false)}>Schließen</button>
      </div>

      {!ergebnis && (
        <>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="rounded-lg border border-dashed border-linie-stark p-3 flex flex-col gap-2">
              <input ref={input} type="file" multiple className="hidden" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(e) => e.target.files && hinzu(e.target.files)} />
              <button className="knopf-zweit knopf-klein self-start" onClick={() => input.current?.click()} disabled={!!laeuft}>Zeichnung wählen</button>
              <p className="text-[12px] text-hell">oder hierher ziehen. Bis zu 4 Dateien, die ersten 6 Seiten werden gelesen.</p>
              {dateien.length > 0 && (
                <ul className="text-[13px] space-y-1">
                  {dateien.map((f, i) => (
                    <li key={i} className="flex items-center justify-between gap-2">
                      <span className="truncate">{f.name}</span>
                      <button className="text-[12px] text-hell hover:text-rot" onClick={() => setDateien((d) => d.filter((_, j) => j !== i))}>entfernen</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <textarea className="eingabe h-[120px] py-2" value={text} onChange={(e) => setText(e.target.value)} placeholder="Anfragetext einfügen, z. B.: „Wir brauchen eine Kalthalle 30 x 15 m, Traufe 5 m, Trapezblech, 2 Sektionaltore 4 x 4,5 m elektrisch, Fundamente bauseits …“" />
          </div>
          <div className="flex items-center gap-3">
            <button className="knopf-blau" onClick={lesen} disabled={!!laeuft || (!dateien.length && !text.trim())}>{laeuft ? 'Läuft …' : 'Lesen'}</button>
            {laeuft && <span className="text-[13px] text-grau">{laeuft}</span>}
          </div>
        </>
      )}

      {fehler && <p className="rounded-lg bg-rot-hell text-rot text-[13px] px-3 py-2">{fehler}</p>}

      {ergebnis && (
        <div className="space-y-3">
          <p className="text-[12px] text-grau">Gelesen aus: {ergebnis.quellen.join(', ')}. Häkchen entfernen, was nicht übernommen werden soll. Gelb markiert ist geschätzt oder abgeleitet.</p>
          {ergebnis.v.erkannt.length === 0 ? (
            <p className="text-sm text-grau">Keine verwertbaren Angaben gefunden.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="tabelle">
                <thead>
                  <tr><th className="w-8"></th><th>Feld</th><th>Wert</th><th>Fundstelle</th></tr>
                </thead>
                <tbody>
                  {ergebnis.v.erkannt.map((x) => (
                    <tr key={x.key} className={x.unsicher ? 'bg-gelb-hell/60' : ''}>
                      <td className="pr-0">
                        <input
                          type="checkbox"
                          checked={auswahl.has(x.key)}
                          aria-label={`${x.label} übernehmen`}
                          onChange={(e) => setAuswahl((s) => { const n = new Set(s); if (e.target.checked) n.add(x.key); else n.delete(x.key); return n; })}
                        />
                      </td>
                      <td className="text-[13px] font-medium whitespace-nowrap">{x.label}</td>
                      <td className="text-[13px]">{x.wert}{x.unsicher && <span className="text-gelb"> · geschätzt</span>}</td>
                      <td className="text-[12px] text-grau">{x.fundstelle}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {ergebnis.v.fehlend.length > 0 && (
            <div className="rounded-lg border border-linie p-3">
              <div className="text-[12px] font-medium schmal text-hell mb-1">Fehlt noch für ein belastbares Angebot</div>
              <ul className="text-[13px] list-disc pl-5 space-y-0.5">{ergebnis.v.fehlend.map((h) => <li key={h}>{h}</li>)}</ul>
            </div>
          )}
          {ergebnis.v.hinweise.length > 0 && (
            <div className="rounded-lg border border-linie p-3">
              <div className="text-[12px] font-medium schmal text-hell mb-1">Hinweise</div>
              <ul className="text-[13px] list-disc pl-5 space-y-0.5">{ergebnis.v.hinweise.map((h) => <li key={h}>{h}</li>)}</ul>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="knopf-blau"
              disabled={!auswahl.size && !ergebnis.v.meta.objekt}
              onClick={() => {
                onUebernehmen(ergebnis.v, auswahl, ergebnis.quellen);
                setErgebnis(null);
                setText('');
                setOffen(false);
              }}
            >
              {auswahl.size} Werte übernehmen
            </button>
            <button className="knopf-leise" onClick={() => setErgebnis(null)}>Verwerfen</button>
          </div>
        </div>
      )}
    </section>
  );
}
