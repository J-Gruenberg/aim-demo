'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase/client';
import { berechneHalle, LEERE_HALLE, type HallenEingaben, type ReferenzPunkt, type Tor, type Zeile } from '@/lib/engine/halle';
import type { Stammdaten } from '@/lib/engine/stammdaten';
import type { Referenz } from '@/lib/daten';
import { euro, zahl, datum } from '@/lib/format';
import { Auswahl, Feld, Schalter, SpeicherStand, ZahlFeld, useAutoSpeichern } from '@/components/Felder';
import { ProjektKopf, type ProjektMeta } from '@/components/ProjektKopf';
import { anwenden } from '@/lib/halle-lesen';
import { AnfrageEinlesen } from './AnfrageEinlesen';

type Props = {
  projekt: ProjektMeta & { eingaben: Partial<HallenEingaben> };
  stamm: Stammdaten;
  punkte: ReferenzPunkt[];
  referenzen: Referenz[];
  darfSchreiben: boolean;
};

const UMFANG_LABEL: Record<string, string> = {
  erdarbeiten: 'Erdarbeiten', fundamente: 'Fundamente', sohle: 'Sohle', statik: 'Statik', werkplanung: 'Werkplanung', bauantrag: 'Bauantrag',
  tore: 'Tore', fenster: 'Fenster', tueren: 'Türen', elektro: 'Elektro', heizung: 'Heizung', buero: 'Büro', kran: 'Kran', vordach: 'Vordach',
  lichtkuppeln: 'Lichtkuppeln', dachrinne: 'Dachrinne', aussenanlagen: 'Außenanlagen', zaun: 'Zaun', brandschutz: 'Brandschutz',
};

export function HallenEditor({ projekt, stamm, punkte, referenzen, darfSchreiben }: Props) {
  const [e, setE] = useState<HallenEingaben>({ ...LEERE_HALLE, ...projekt.eingaben, optionen: { ...LEERE_HALLE.optionen, ...(projekt.eingaben.optionen ?? {}) }, manuell: projekt.eingaben.manuell ?? {} });
  const [meta, setMeta] = useState<ProjektMeta>(projekt);
  const erg = useMemo(() => berechneHalle(e, stamm, punkte), [e, stamm, punkte]);

  const stand = useAutoSpeichern({ e, meta }, async ({ e, meta }) => {
    if (!darfSchreiben) return true;
    const { error } = await supabaseBrowser()
      .from('projekte')
      .update({
        titel: meta.titel || e.objekt || 'Halle',
        kunde: meta.kunde,
        ort: meta.ort,
        status: meta.status,
        ergebnis_label: meta.ergebnis_label,
        eingaben: e,
        ergebnis: { angebot: erg.angebot_gerundet, summe_netto: erg.summe_netto, stahl_kg: erg.stahl.kg, eur_m2: erg.eur_m2, grundflaeche: erg.geometrie.grundflaeche },
        summe_netto: erg.angebot_gerundet,
      })
      .eq('id', projekt.id);
    return !error;
  });

  const setze = <K extends keyof HallenEingaben>(k: K, v: HallenEingaben[K]) => setE((x) => ({ ...x, [k]: v }));
  const setzeOpt = (k: keyof HallenEingaben['optionen'], v: boolean) => setE((x) => ({ ...x, optionen: { ...x.optionen, [k]: v } }));
  const setzeManuell = (key: string, feld: 'menge' | 'ep' | 'aktiv', v: number | boolean | null) =>
    setE((x) => {
      const m = { ...(x.manuell[key] ?? {}) } as { menge?: number | null; ep?: number | null; aktiv?: boolean };
      if (v === null) delete m[feld as 'menge'];
      else (m as Record<string, unknown>)[feld] = v;
      return { ...x, manuell: { ...x.manuell, [key]: m } };
    });
  const zuruecksetzen = (key: string) => setE((x) => {
    const m = { ...x.manuell };
    delete m[key];
    return { ...x, manuell: m };
  });

  const aehnliche = useMemo(() => {
    return referenzen
      .filter((r) => r.typ === 'halle' && Number(r.daten.laenge_m) > 0 && Number(r.daten.breite_m) > 0 && (Number(r.daten.hauptposition_netto) > 0 || Number(r.angebot_netto) > 0))
      .map((r) => {
        const L = Number(r.daten.laenge_m);
        const B = Number(r.daten.breite_m);
        const H = Number(r.daten.traufhoehe_m) || 0;
        const A = Number(r.daten.grundflaeche_m2) || L * B;
        const d = Math.hypot((B - e.breite) / 4, (L - e.laenge) / 12, H && e.traufhoehe ? (H - e.traufhoehe) / 1.5 : 0.5);
        const haupt = Number(r.daten.hauptposition_netto) || r.angebot_netto || 0;
        return { r, L, B, H, A, d, haupt, eur_m2: A ? haupt / A : 0 };
      })
      .sort((a, b) => a.d - b.d)
      .slice(0, 5);
  }, [referenzen, e.breite, e.laenge, e.traufhoehe]);

  const gesperrt = !darfSchreiben;

  return (
    <div className="space-y-6">
      <ProjektKopf meta={meta} onMeta={setMeta} art="Hallenbau" stand={<SpeicherStand stand={stand} />} gesperrt={gesperrt}>
        <Link href={`/halle/${projekt.id}/angebot`} className="knopf-blau">Angebot ansehen</Link>
        <a href={`/api/projekt/${projekt.id}/excel`} className="knopf-zweit">Excel</a>
      </ProjektKopf>

      {darfSchreiben && (
        <AnfrageEinlesen
          projektId={projekt.id}
          offen={!projekt.eingaben.gelesen && !projekt.eingaben.objekt && /^neue halle$/i.test(projekt.titel.trim())}
          onUebernehmen={(v, keys, quellen) => {
            setE((x) => ({
              ...anwenden(x, v.erkannt, keys),
              objekt: x.objekt || v.meta.objekt,
              gelesen: { datum: new Date().toISOString(), quellen, hinweise: v.hinweise, fehlend: v.fehlend },
            }));
            setMeta((m) => ({
              ...m,
              titel: !m.titel || /^(neue halle|halle)$/i.test(m.titel.trim()) ? v.meta.objekt || m.titel : m.titel,
              kunde: m.kunde || v.meta.kunde || m.kunde,
              ort: m.ort || v.meta.ort || m.ort,
            }));
          }}
        />
      )}

      {e.gelesen && (e.gelesen.hinweise.length > 0 || e.gelesen.fehlend.length > 0) && (
        <div className="rounded-xl border border-linie bg-flaeche px-4 py-3 text-[13px] space-y-1">
          <div className="text-[11px] uppercase tracking-wider text-hell">
            Aus {e.gelesen.quellen.join(', ')} übernommen am {datum(e.gelesen.datum)}
            <button className="ml-3 normal-case tracking-normal text-hell hover:text-rot" onClick={() => setze('gelesen', undefined)}>ausblenden</button>
          </div>
          {e.gelesen.fehlend.length > 0 && <p><span className="font-medium">Fehlt noch:</span> {e.gelesen.fehlend.join(' · ')}</p>}
          {e.gelesen.hinweise.length > 0 && <p><span className="font-medium">Hinweise:</span> {e.gelesen.hinweise.join(' · ')}</p>}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kennzahl label="Angebotspreis netto" wert={euro(erg.angebot_gerundet, true)} gross />
        <Kennzahl label="Je m² Grundfläche" wert={euro(erg.eur_m2, true)} />
        <Kennzahl label="Stahl" wert={`${zahl(erg.stahl.kg / 1000, 1)} t`} sub={`${zahl(erg.stahl.kg_m2, 1)} kg/m²`} />
        <Kennzahl label="Grundfläche" wert={`${zahl(erg.geometrie.grundflaeche, 0)} m²`} sub={`Firsthöhe ${zahl(erg.geometrie.firsthoehe, 2)} m`} />
        <Kennzahl label="Rahmen" wert={`${erg.geometrie.rahmen}`} sub={`${erg.geometrie.felder} Felder à ${zahl(e.laenge / erg.geometrie.felder, 2)} m`} />
      </div>

      {erg.hinweise.length > 0 && (
        <div className="rounded-xl border border-gelb/30 bg-gelb-hell px-4 py-3 text-sm text-gelb space-y-1">
          {erg.hinweise.map((h) => <p key={h}>{h}</p>)}
        </div>
      )}

      <div className="grid lg:grid-cols-[340px_1fr] gap-6 items-start">
        <aside className="space-y-4 lg:sticky lg:top-20">
          <section className="karte p-4 space-y-3">
            <h2 className="font-semibold text-sm">Maße</h2>
            <div className="grid grid-cols-3 gap-2">
              <Feld label="Länge" einheit="m"><ZahlFeld wert={e.laenge} onWert={(v) => setze('laenge', v ?? 0)} className="pr-7" /></Feld>
              <Feld label="Breite" einheit="m"><ZahlFeld wert={e.breite} onWert={(v) => setze('breite', v ?? 0)} className="pr-7" /></Feld>
              <Feld label="Traufe" einheit="m"><ZahlFeld wert={e.traufhoehe} onWert={(v) => setze('traufhoehe', v ?? 0)} className="pr-7" /></Feld>
            </div>
            <Auswahl wert={e.dachform} onWert={(v) => setze('dachform', v)} optionen={[{ wert: 'satteldach', label: 'Satteldach' }, { wert: 'pultdach', label: 'Pultdach' }]} />
            <div className="grid grid-cols-2 gap-2">
              <Feld label="Dachneigung" einheit="°"><ZahlFeld wert={e.neigung} onWert={(v) => setze('neigung', v ?? 0)} className="pr-7" /></Feld>
              <Feld label="Rahmenabstand" einheit="m"><ZahlFeld wert={e.rahmenabstand} onWert={(v) => setze('rahmenabstand', v ?? 6)} className="pr-7" /></Feld>
            </div>
          </section>

          <section className="karte p-4 space-y-3">
            <h2 className="font-semibold text-sm">Ausführung</h2>
            <div>
              <label className="label">Stahlbau</label>
              <Auswahl wert={e.oberflaeche} onWert={(v) => setze('oberflaeche', v)} optionen={[{ wert: 'grundiert', label: 'grundiert' }, { wert: 'verzinkt', label: 'verzinkt' }]} />
            </div>
            <div>
              <label className="label">Dach</label>
              <Auswahl wert={e.dach} onWert={(v) => setze('dach', v)} optionen={[{ wert: 'sandwich', label: 'Sandwich' }, { wert: 'trapez', label: 'Trapezblech' }]} />
            </div>
            <div>
              <label className="label">Wand</label>
              <Auswahl wert={e.wand} onWert={(v) => setze('wand', v)} optionen={[{ wert: 'sandwich', label: 'Sandwich' }, { wert: 'trapez', label: 'Trapez' }, { wert: 'ohne', label: 'offen' }]} />
            </div>
            {e.wand !== 'ohne' && (
              <Feld label="Verkleidete Seiten" hinweis="4 = rundum, 3 = eine Giebelseite an Bestand">
                <Auswahl<string> wert={String(e.wandseiten)} onWert={(v) => setze('wandseiten', Number(v))} optionen={['4', '3', '2', '1'].map((w) => ({ wert: w, label: w }))} />
              </Feld>
            )}
            <Schalter an={e.kran} onAn={(v) => setze('kran', v)} label="Kranbahn (Mehrgewicht)" />
          </section>

          <section className="karte p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">Tore</h2>
              <button className="knopf-leise knopf-klein" onClick={() => setze('tore', [...e.tore, { anzahl: 1, breite: 4, hoehe: 4, antrieb: false }])}>+ Tor</button>
            </div>
            {e.tore.length === 0 && <p className="text-[12px] text-hell">Keine Tore.</p>}
            {e.tore.map((t, i) => (
              <div key={i} className="grid grid-cols-[52px_1fr_1fr_auto] gap-2 items-end">
                <Feld label="Stk"><ZahlFeld klein wert={t.anzahl} stellen={0} onWert={(v) => setze('tore', e.tore.map((x, j) => (j === i ? { ...x, anzahl: v ?? 0 } : x)))} /></Feld>
                <Feld label="Breite m"><ZahlFeld klein wert={t.breite} onWert={(v) => setze('tore', e.tore.map((x, j) => (j === i ? { ...x, breite: v ?? 0 } : x)))} /></Feld>
                <Feld label="Höhe m"><ZahlFeld klein wert={t.hoehe} onWert={(v) => setze('tore', e.tore.map((x, j) => (j === i ? { ...x, hoehe: v ?? 0 } : x)))} /></Feld>
                <div className="flex flex-col items-center gap-1 pb-1">
                  <label className="text-[10px] text-hell uppercase">Motor</label>
                  <input type="checkbox" checked={t.antrieb} onChange={(ev) => setze('tore', e.tore.map((x, j): Tor => (j === i ? { ...x, antrieb: ev.target.checked } : x)))} />
                </div>
                <button className="col-span-4 text-left text-[11px] text-hell hover:text-rot -mt-1" onClick={() => setze('tore', e.tore.filter((_, j) => j !== i))}>Tor entfernen</button>
              </div>
            ))}
          </section>

          <section className="karte p-4 space-y-3">
            <h2 className="font-semibold text-sm">Öffnungen und Ausbau</h2>
            <div className="grid grid-cols-3 gap-2">
              <Feld label="Türen"><ZahlFeld wert={e.tueren} stellen={0} onWert={(v) => setze('tueren', v ?? 0)} /></Feld>
              <Feld label="Fenster"><ZahlFeld wert={e.fenster} stellen={0} onWert={(v) => setze('fenster', v ?? 0)} /></Feld>
              <Feld label="Kuppeln"><ZahlFeld wert={e.lichtkuppeln} stellen={0} onWert={(v) => setze('lichtkuppeln', v ?? 0)} /></Feld>
              <Feld label="RWA"><ZahlFeld wert={e.lichtkuppeln_rwa} stellen={0} onWert={(v) => setze('lichtkuppeln_rwa', v ?? 0)} /></Feld>
              <Feld label="Firstlicht" einheit="m"><ZahlFeld wert={e.firstlicht_m} onWert={(v) => setze('firstlicht_m', v ?? 0)} className="pr-7" /></Feld>
              <Feld label="Vordach" einheit="m²"><ZahlFeld wert={e.vordach_m2} onWert={(v) => setze('vordach_m2', v ?? 0)} className="pr-8" /></Feld>
              <Feld label="Büro" einheit="m²"><ZahlFeld wert={e.buero_m2} onWert={(v) => setze('buero_m2', v ?? 0)} className="pr-8" /></Feld>
              <Feld label="Trennwand" einheit="m²"><ZahlFeld wert={e.trennwand_m2} onWert={(v) => setze('trennwand_m2', v ?? 0)} className="pr-8" /></Feld>
              <Feld label="Außenanl." einheit="m²"><ZahlFeld wert={e.aussenanlagen_m2} onWert={(v) => setze('aussenanlagen_m2', v ?? 0)} className="pr-8" /></Feld>
              <Feld label="Zaun" einheit="m"><ZahlFeld wert={e.zaun_m} onWert={(v) => setze('zaun_m', v ?? 0)} className="pr-7" /></Feld>
            </div>
          </section>

          <section className="karte p-4">
            <h2 className="font-semibold text-sm mb-1">Leistungsumfang</h2>
            <div className="divide-y divide-linie">
              <Schalter an={e.optionen.erdarbeiten} onAn={(v) => setzeOpt('erdarbeiten', v)} label="Erdarbeiten, Fundamente, Sohle" />
              <Schalter an={e.optionen.statik} onAn={(v) => setzeOpt('statik', v)} label="Statik" />
              <Schalter an={e.optionen.werkplanung} onAn={(v) => setzeOpt('werkplanung', v)} label="Werkplanung" />
              <Schalter an={e.optionen.bauantrag} onAn={(v) => setzeOpt('bauantrag', v)} label="Bauantrag, Brand- und Wärmeschutz" />
              <Schalter an={e.optionen.baugrund} onAn={(v) => setzeOpt('baugrund', v)} label="Baugrundgutachten" />
              <Schalter an={e.optionen.be} onAn={(v) => setzeOpt('be', v)} label="Baustelleneinrichtung" />
              <Schalter an={e.optionen.autokran} onAn={(v) => setzeOpt('autokran', v)} label="Autokran" />
              <Schalter an={e.optionen.buehnen} onAn={(v) => setzeOpt('buehnen', v)} label="Bühnen" />
              <Schalter an={e.optionen.profilfueller} onAn={(v) => setzeOpt('profilfueller', v)} label="Profilfüller" />
              <Schalter an={e.optionen.maler} onAn={(v) => setzeOpt('maler', v)} label="Malerarbeiten Stahlbau" />
              <Schalter an={e.optionen.elektro} onAn={(v) => setzeOpt('elektro', v)} label="Elektroarbeiten Halle" />
              <Schalter an={e.optionen.heizung} onAn={(v) => setzeOpt('heizung', v)} label="Heizung Halle" />
              <Schalter an={e.optionen.entsorgung} onAn={(v) => setzeOpt('entsorgung', v)} label="Entsorgung" />
              <Schalter an={e.optionen.reinigung} onAn={(v) => setzeOpt('reinigung', v)} label="Reinigung" />
            </div>
          </section>
        </aside>

        <div className="space-y-6 min-w-0">
          <section className="karte overflow-hidden">
            <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 border-b border-linie">
              <h2 className="font-semibold">Kalkulation Hallenbau</h2>
              <span className="text-[12px] text-hell">Größe {zahl(e.laenge)} × {zahl(e.breite)} × {zahl(e.traufhoehe)} m · Mengen und Preise anklicken zum Ändern</span>
            </div>
            <div className="overflow-x-auto">
              <table className="tabelle">
                <thead>
                  <tr>
                    <th className="w-8"></th>
                    <th>Position</th>
                    <th className="text-right w-[120px]">Menge</th>
                    <th className="w-14">Einh.</th>
                    <th className="text-right w-[130px]">Einzelpreis</th>
                    <th className="text-right w-[130px]">Gesamt</th>
                  </tr>
                </thead>
                <tbody>
                  {erg.zeilen.map((z) => (
                    <VordruckZeile key={z.key} z={z} gesperrt={gesperrt} onMenge={(v) => setzeManuell(z.key, 'menge', v)} onEp={(v) => setzeManuell(z.key, 'ep', v)} onAktiv={(v) => setzeManuell(z.key, 'aktiv', v)} onReset={() => zuruecksetzen(z.key)} />
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-tinte/80">
                    <td></td>
                    <td className="font-semibold">Gesamt netto</td>
                    <td colSpan={3}></td>
                    <td className="text-right zahl font-semibold">{euro(erg.summe_netto, true)}</td>
                  </tr>
                  <tr>
                    <td></td>
                    <td>Zuschlag</td>
                    <td className="text-right"><ZahlFeld klein wert={erg.zuschlag_prozent} onWert={(v) => setze('zuschlag_prozent', v)} /></td>
                    <td className="text-grau">%</td>
                    <td></td>
                    <td className="text-right zahl">{euro(erg.zuschlag, true)}</td>
                  </tr>
                  <tr className="bg-tiefblau text-white">
                    <td></td>
                    <td className="font-semibold">Angebotspreis netto, gerundet</td>
                    <td colSpan={3}></td>
                    <td className="text-right zahl font-semibold text-[15px]">{euro(erg.angebot_gerundet, true)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <div className="grid xl:grid-cols-2 gap-6">
            <section className="karte p-4">
              <h2 className="font-semibold text-sm">Stahlgewicht</h2>
              <p className="text-[12px] text-grau mt-1">
                {erg.stahl.methode === 'stahlliste'
                  ? 'Stahlliste wie auf Ihrem Zettel: Stiele und Riegel der Hauptrahmen, Giebelrahmen, Verbände, Rundstahl, plus Kleinteile. Pfetten und Riegel stehen extra im Vordruck.'
                  : erg.stahl.methode === 'referenzen'
                    ? 'Geschätzt aus Ihren gebauten Hallen mit ähnlicher Spannweite und Höhe.'
                    : erg.stahl.methode === 'manuell'
                      ? 'Von Hand eingetragen, zum Beispiel aus der Statik.'
                      : 'Faustwert, weil keine passende Referenz vorliegt.'}
              </p>
              {erg.stahl.liste && (
                <table className="tabelle mt-3">
                  <thead><tr><th>Bauteil</th><th>Profil</th><th className="text-right">m</th><th className="text-right">kg</th></tr></thead>
                  <tbody>
                    {erg.stahl.liste.positionen.map((p) => (
                      <tr key={p.text}><td>{p.text}</td><td className="whitespace-nowrap">{p.profil}</td><td className="text-right zahl">{p.meter ? zahl(p.meter, 1) : ''}</td><td className="text-right zahl">{zahl(p.kg, 0)}</td></tr>
                    ))}
                    <tr><td colSpan={3} className="text-grau">+ {zahl(erg.stahl.liste.kleinteile_prozent, 0)} % Kleinteile, aufgerundet</td><td className="text-right zahl font-semibold">{zahl(erg.stahl.liste.gesamt_kg, 0)}</td></tr>
                  </tbody>
                </table>
              )}
              <div className="mt-3 grid grid-cols-2 gap-3 items-end">
                <Feld label="Giebel als Giebelrahmen" hinweis="0 = beide Giebel als Hauptrahmen (erweiterbar)">
                  <Auswahl<string> wert={String(e.giebelrahmen ?? 2)} onWert={(v) => setze('giebelrahmen', Number(v))} optionen={['2', '1', '0'].map((w) => ({ wert: w, label: w }))} />
                </Feld>
                <Feld label="Stahl von Hand (z. B. Statik)" einheit="kg">
                  <ZahlFeld wert={e.stahl_kg_manuell ?? null} stellen={0} platzhalter={zahl(erg.stahl.liste?.gesamt_kg ?? erg.stahl.kg, 0)} onWert={(v) => setze('stahl_kg_manuell', v)} className="pr-9" />
                </Feld>
              </div>
              {e.stahl_kg_manuell ? <button className="knopf-leise knopf-klein mt-2" onClick={() => setze('stahl_kg_manuell', null)}>Zurück auf Stahlliste</button> : null}
              {erg.stahl.gegenprobe && (
                <div className="mt-4 rounded-lg bg-papier border border-linie p-3">
                  <div className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="font-medium">Gegenprobe ähnliche Hallen</span>
                    <span className="zahl">{zahl(erg.stahl.gegenprobe.kg_m2, 1)} kg/m² · {zahl(erg.stahl.gegenprobe.kg / 1000, 1)} t</span>
                  </div>
                  {erg.stahl.referenzen.length > 0 && (
                    <div className="text-[11px] text-grau mt-1">
                      {erg.stahl.referenzen.map((r) => `${r.name} ${zahl(r.kg_m2, 1)} kg/m²`).join(' · ')}
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="karte p-4">
              <h2 className="font-semibold text-sm">Ähnliche Hallen aus Ihrem Archiv</h2>
              <p className="text-[12px] text-grau mt-1">Hauptposition Ihres damaligen Angebots. Umfang beachten, Preise sind nicht indexiert.</p>
              <div className="mt-3 divide-y divide-linie">
                {aehnliche.length === 0 && <p className="text-sm text-hell py-2">Noch keine Referenzhallen hinterlegt.</p>}
                {aehnliche.map(({ r, L, B, H, A, haupt, eur_m2 }) => (
                  <div key={r.id} className="py-2.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium text-sm">{r.name}</span>
                      <span className="zahl text-sm">{euro(haupt, true)}</span>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 text-[12px] text-grau">
                      <span>{zahl(L)} × {zahl(B)}{H ? ` × ${zahl(H)}` : ''} m · {zahl(A, 0)} m² · {datum(r.datum)}</span>
                      <span className="zahl">{euro(eur_m2, true)}/m²</span>
                    </div>
                    {Array.isArray(r.daten.umfang) && (r.daten.umfang as string[]).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(r.daten.umfang as string[]).map((u) => <span key={u} className="marke h-5 text-[11px] bg-papier text-grau border border-linie">{UMFANG_LABEL[u] ?? u}</span>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="karte p-4">
            <h2 className="font-semibold text-sm">Notiz zur Kalkulation</h2>
            <textarea className="eingabe h-24 py-2 mt-2" value={e.notiz ?? ''} onChange={(ev) => setze('notiz', ev.target.value)} placeholder="z. B. Bodengutachten fehlt, Kran bauseits, Abweichung nach Statik …" />
          </section>
        </div>
      </div>
    </div>
  );
}

function Kennzahl({ label, wert, sub, gross = false }: { label: string; wert: string; sub?: string; gross?: boolean }) {
  return (
    <div className={`rounded-xl px-4 py-3 ${gross ? 'bg-tiefblau text-white' : 'karte'}`}>
      <div className={`text-[11px] uppercase tracking-wider ${gross ? 'text-white/60' : 'text-hell'}`}>{label}</div>
      <div className={`zahl mt-1 font-semibold ${gross ? 'text-[24px]' : 'text-[20px]'}`}>{wert}</div>
      {sub && <div className={`text-[12px] ${gross ? 'text-white/60' : 'text-grau'}`}>{sub}</div>}
    </div>
  );
}

function VordruckZeile({ z, gesperrt, onMenge, onEp, onAktiv, onReset }: { z: Zeile; gesperrt: boolean; onMenge: (v: number | null) => void; onEp: (v: number | null) => void; onAktiv: (v: boolean) => void; onReset: () => void }) {
  const geaendert = z.manuell_menge || z.manuell_ep;
  return (
    <tr className={z.aktiv ? '' : 'opacity-45'}>
      <td className="pr-0">
        <input type="checkbox" checked={z.aktiv} disabled={gesperrt} onChange={(ev) => onAktiv(ev.target.checked)} aria-label={`${z.bezeichnung} einrechnen`} />
      </td>
      <td>
        <div className="font-medium text-[13px]">{z.bezeichnung}</div>
        <div className="text-[11px] text-hell leading-snug">
          {z.herleitung}
          {geaendert && (
            <>
              {' · '}
              <button className="text-rot hover:underline" onClick={onReset}>von Hand geändert, zurücksetzen</button>
            </>
          )}
        </div>
      </td>
      <td className="text-right">
        <ZahlFeld klein wert={z.menge} onWert={onMenge} className={z.manuell_menge ? 'border-rot/50 bg-rot-hell/40' : ''} ariaLabel={`Menge ${z.bezeichnung}`} />
      </td>
      <td className="text-grau text-[12px] pt-3">{z.einheit}</td>
      <td className="text-right">
        <ZahlFeld klein wert={z.ep} onWert={onEp} className={z.manuell_ep ? 'border-rot/50 bg-rot-hell/40' : ''} ariaLabel={`Einzelpreis ${z.bezeichnung}`} />
      </td>
      <td className="text-right zahl pt-3">{z.aktiv ? euro(z.gp, true) : '–'}</td>
    </tr>
  );
}
