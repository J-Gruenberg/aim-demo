'use client';
import { GELAENDER_STANDARD, TREPPE_STANDARD, type Ansatz, type GelaenderParameter, type Oberflaeche } from '@/lib/engine/bauteile';
import { ART_LABEL } from '@/lib/engine/ansatz';
import { Feld, Schalter, ZahlFeld } from '@/components/Felder';
import type { AnsatzGespeichert } from './typen';
import { MERKMALE_STANDARD, teilart, type BaugruppeAnsatz, type BaugruppeMerkmale, type Teil, type ZeichnungOberflaeche } from '@/lib/engine/zeichnung';
import { zahl } from '@/lib/format';

const OBERFL: { wert: Oberflaeche; label: string }[] = [
  { wert: 'verzinkt', label: 'verzinkt' },
  { wert: 'grundiert', label: 'grundiert' },
  { wert: 'verzinkt_pulver', label: 'verzinkt + pulver' },
  { wert: 'roh', label: 'roh' },
];

export function standardAnsatz(art: Ansatz['art']): Ansatz {
  switch (art) {
    case 'stahl_kg':
      return { art, kg_je_einheit: 1, oberflaeche: 'verzinkt', montage: true };
    case 'gelaender_m':
      return { art, parameter: { ...GELAENDER_STANDARD } };
    case 'treppe_stk':
      return { art, parameter: { ...TREPPE_STANDARD } };
    case 'gitterrost_m2':
      return { art, montage: true };
    case 'zukauf':
      return { art, einkauf: null, aufschlag_prozent: 15 };
    case 'stunden':
      return { art, stunden_je_einheit: 1, montage: true };
    case 'prozent_be':
      return { art, prozent: 5 };
    case 'baugruppe':
      return { art, teile: [], merkmale: { ...MERKMALE_STANDARD } };
    default:
      return { art: 'manuell', ep: null };
  }
}

function Ober({ wert, onWert }: { wert: Oberflaeche | undefined; onWert: (v: Oberflaeche) => void }) {
  return (
    <Feld label="Oberfläche">
      <select className="eingabe eingabe-klein" value={wert ?? 'verzinkt'} onChange={(e) => onWert(e.target.value as Oberflaeche)}>
        {OBERFL.map((o) => <option key={o.wert} value={o.wert}>{o.label}</option>)}
      </select>
    </Feld>
  );
}

function GelaenderFelder({ p, onP }: { p: Partial<GelaenderParameter>; onP: (p: Partial<GelaenderParameter>) => void }) {
  const g = { ...GELAENDER_STANDARD, ...p };
  return (
    <div className="grid grid-cols-2 gap-2">
      <Feld label="Höhe" einheit="m"><ZahlFeld klein wert={g.hoehe_m} onWert={(v) => onP({ ...p, hoehe_m: v ?? 1.1 })} className="pr-6" /></Feld>
      <Feld label="Pfostenabstand" einheit="m"><ZahlFeld klein wert={g.pfostenabstand_m} onWert={(v) => onP({ ...p, pfostenabstand_m: v ?? 1.2 })} className="pr-6" /></Feld>
      <Feld label="Pfosten"><input className="eingabe eingabe-klein" value={g.pfosten} onChange={(e) => onP({ ...p, pfosten: e.target.value })} /></Feld>
      <Feld label="Gurte"><input className="eingabe eingabe-klein" value={g.gurte} onChange={(e) => onP({ ...p, gurte: e.target.value })} /></Feld>
      <Feld label="Anzahl Gurte"><ZahlFeld klein wert={g.anzahl_gurte} stellen={0} onWert={(v) => onP({ ...p, anzahl_gurte: v ?? 2 })} /></Feld>
      <Feld label="Füllung">
        <select className="eingabe eingabe-klein" value={g.fuellung} onChange={(e) => onP({ ...p, fuellung: e.target.value as GelaenderParameter['fuellung'] })}>
          <option value="staebe">Stäbe</option>
          <option value="knieleiste">Knieleisten</option>
          <option value="lochblech">Lochblech</option>
          <option value="gitter">Gitter</option>
          <option value="ohne">ohne</option>
        </select>
      </Feld>
      {g.fuellung === 'staebe' && (
        <>
          <Feld label="Stab Ø" einheit="mm"><ZahlFeld klein wert={g.stab_d_mm} stellen={0} onWert={(v) => onP({ ...p, stab_d_mm: v ?? 12 })} className="pr-8" /></Feld>
          <Feld label="Stababstand" einheit="mm"><ZahlFeld klein wert={g.stababstand_mm} stellen={0} onWert={(v) => onP({ ...p, stababstand_mm: v ?? 120 })} className="pr-8" /></Feld>
        </>
      )}
      <Feld label="Handlauf">
        <select className="eingabe eingabe-klein" value={g.handlauf} onChange={(e) => onP({ ...p, handlauf: e.target.value as 'stahl' | 'edelstahl' })}>
          <option value="stahl">Stahl</option>
          <option value="edelstahl">Edelstahl</option>
        </select>
      </Feld>
      <Feld label="Aufwand">
        <select className="eingabe eingabe-klein" value={g.cluster} onChange={(e) => onP({ ...p, cluster: Number(e.target.value) as 0 | 1 | 2 | 3 })}>
          <option value={0}>automatisch (Schweißnaht)</option>
          <option value={1}>1 einfach</option>
          <option value={2}>2 mittel</option>
          <option value={3}>3 aufwendig</option>
        </select>
      </Feld>
      <Ober wert={g.oberflaeche} onWert={(v) => onP({ ...p, oberflaeche: v })} />
      <div className="flex items-end pb-1"><Schalter an={g.fussplatten} onAn={(v) => onP({ ...p, fussplatten: v })} label="Fußplatten" /></div>
    </div>
  );
}

export function AnsatzEditor({ ansatz, onAnsatz }: { ansatz: AnsatzGespeichert; onAnsatz: (a: AnsatzGespeichert) => void }) {
  const art = ansatz.art ?? 'manuell';
  const setArt = (neu: Ansatz['art']) => {
    const { bereich, bedarf, alternativ, pauschal, ki, ausgeblendet } = ansatz;
    onAnsatz({ ...standardAnsatz(neu), bereich, bedarf, alternativ, pauschal, ki, ausgeblendet, ep_hand: null });
  };
  const a = ansatz as Record<string, unknown>;
  return (
    <div className="space-y-3">
      <Feld label="Kalkulationsansatz">
        <select className="eingabe" value={art} onChange={(e) => setArt(e.target.value as Ansatz['art'])}>
          {Object.entries(ART_LABEL)
            .filter(([k]) => k !== 'baugruppe' || art === 'baugruppe')
            .map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </Feld>
      {art === 'stahl_kg' && (
        <div className="grid grid-cols-2 gap-2">
          <Feld label="Gewicht je Einheit" einheit="kg"><ZahlFeld klein wert={a.kg_je_einheit as number} onWert={(v) => onAnsatz({ ...ansatz, kg_je_einheit: v ?? 0 } as AnsatzGespeichert)} className="pr-7" /></Feld>
          <Ober wert={a.oberflaeche as Oberflaeche} onWert={(v) => onAnsatz({ ...ansatz, oberflaeche: v } as AnsatzGespeichert)} />
          <Schalter an={!!a.montage} onAn={(v) => onAnsatz({ ...ansatz, montage: v } as AnsatzGespeichert)} label="mit Montage" />
          <Schalter an={!!a.rohr} onAn={(v) => onAnsatz({ ...ansatz, rohr: v } as AnsatzGespeichert)} label="Rohrprofile" />
          <Schalter an={!!a.s355} onAn={(v) => onAnsatz({ ...ansatz, s355: v } as AnsatzGespeichert)} label="S355" />
          <Schalter an={!!a.blech} onAn={(v) => onAnsatz({ ...ansatz, blech: v } as AnsatzGespeichert)} label="Blech / Belag" />
          <Schalter an={!!a.bestand} onAn={(v) => onAnsatz({ ...ansatz, bestand: v } as AnsatzGespeichert)} label="Montage am Bestand" />
          <span />
          <Feld label="Arbeit am Bestand je Einheit" einheit="h"><ZahlFeld klein wert={(a.bestand_h as number) ?? 0} onWert={(v) => onAnsatz({ ...ansatz, bestand_h: v ?? 0 } as AnsatzGespeichert)} className="pr-6" /></Feld>
          <Feld label="Hebebühne / Gerät je Einheit" einheit="€"><ZahlFeld klein wert={(a.geraet_eur as number) ?? 0} onWert={(v) => onAnsatz({ ...ansatz, geraet_eur: v ?? 0 } as AnsatzGespeichert)} className="pr-6" /></Feld>
        </div>
      )}
      {art === 'baugruppe' && <BaugruppeFelder a={ansatz as unknown as BaugruppeAnsatz} onA={(neu) => onAnsatz({ ...ansatz, ...neu } as unknown as AnsatzGespeichert)} />}
      {art === 'gelaender_m' && <GelaenderFelder p={(a.parameter as Partial<GelaenderParameter>) ?? {}} onP={(p) => onAnsatz({ ...ansatz, parameter: p } as AnsatzGespeichert)} />}
      {art === 'treppe_stk' && (() => {
        const t = { ...TREPPE_STANDARD, ...((a.parameter as object) ?? {}) } as typeof TREPPE_STANDARD;
        const setT = (patch: Partial<typeof TREPPE_STANDARD>) => onAnsatz({ ...ansatz, parameter: { ...((a.parameter as object) ?? {}), ...patch } } as AnsatzGespeichert);
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Feld label="Geschosshöhe" einheit="m"><ZahlFeld klein wert={t.geschosshoehe_m} onWert={(v) => setT({ geschosshoehe_m: v ?? 3 })} className="pr-6" /></Feld>
              <Feld label="Laufbreite" einheit="m"><ZahlFeld klein wert={t.laufbreite_m} onWert={(v) => setT({ laufbreite_m: v ?? 1 })} className="pr-6" /></Feld>
              <Feld label="Wange"><input className="eingabe eingabe-klein" value={t.wange} onChange={(e) => setT({ wange: e.target.value })} /></Feld>
              <Feld label="Podest" einheit="m²"><ZahlFeld klein wert={t.podest_m2} onWert={(v) => setT({ podest_m2: v ?? 0 })} className="pr-7" /></Feld>
              <Feld label="Stufen">
                <select className="eingabe eingabe-klein" value={t.stufenart} onChange={(e) => setT({ stufenart: e.target.value as typeof t.stufenart })}>
                  <option value="gitterrost">Gitterrost (Kaufteil)</option>
                  <option value="blech">Blech, eigene Fertigung</option>
                  <option value="bauseits">bauseits / eigene Position</option>
                </select>
              </Feld>
              <Feld label="Geländer">
                <select className="eingabe eingabe-klein" value={t.gelaender_seiten} onChange={(e) => setT({ gelaender_seiten: Number(e.target.value) as 0 | 1 | 2 })}>
                  <option value={0}>keins / eigene Position</option>
                  <option value={1}>einseitig</option>
                  <option value={2}>beidseitig</option>
                </select>
              </Feld>
              <Ober wert={t.oberflaeche} onWert={(v) => setT({ oberflaeche: v })} />
              <div className="flex items-end pb-1"><Schalter an={t.montage} onAn={(v) => setT({ montage: v })} label="mit Montage" /></div>
            </div>
            {t.gelaender_seiten > 0 && (
              <details className="rounded-lg border border-linie p-3">
                <summary className="text-sm cursor-pointer">Geländer der Treppe</summary>
                <div className="mt-3"><GelaenderFelder p={(t.gelaender as Partial<GelaenderParameter>) ?? {}} onP={(g) => setT({ gelaender: g as GelaenderParameter })} /></div>
              </details>
            )}
          </div>
        );
      })()}
      {art === 'gitterrost_m2' && (
        <div className="grid grid-cols-2 gap-2">
          <Feld label="Einkauf je m²" einheit="€"><ZahlFeld klein wert={(a.eur_m2 as number) ?? null} platzhalter="aus Stammdaten" onWert={(v) => onAnsatz({ ...ansatz, eur_m2: v ?? undefined } as AnsatzGespeichert)} className="pr-6" /></Feld>
          <div className="flex items-end pb-1"><Schalter an={!!a.montage} onAn={(v) => onAnsatz({ ...ansatz, montage: v } as AnsatzGespeichert)} label="mit Montage" /></div>
        </div>
      )}
      {art === 'zukauf' && (
        <div className="grid grid-cols-2 gap-2">
          <Feld label="Einkauf je Einheit" einheit="€"><ZahlFeld klein wert={(a.einkauf as number) ?? null} platzhalter="Preis anfragen" onWert={(v) => onAnsatz({ ...ansatz, einkauf: v } as AnsatzGespeichert)} className="pr-6" /></Feld>
          <Feld label="Aufschlag" einheit="%"><ZahlFeld klein wert={(a.aufschlag_prozent as number) ?? 15} onWert={(v) => onAnsatz({ ...ansatz, aufschlag_prozent: v ?? 0 } as AnsatzGespeichert)} className="pr-6" /></Feld>
          <div className="col-span-2"><Feld label="Lieferant / was anfragen"><input className="eingabe eingabe-klein" value={(a.lieferant as string) ?? ''} onChange={(e) => onAnsatz({ ...ansatz, lieferant: e.target.value } as AnsatzGespeichert)} /></Feld></div>
        </div>
      )}
      {art === 'stunden' && (
        <div className="grid grid-cols-2 gap-2">
          <Feld label="Stunden je Einheit" einheit="h"><ZahlFeld klein wert={a.stunden_je_einheit as number} onWert={(v) => onAnsatz({ ...ansatz, stunden_je_einheit: v ?? 0 } as AnsatzGespeichert)} className="pr-6" /></Feld>
          <Feld label="Material je Einheit" einheit="€"><ZahlFeld klein wert={(a.material_je_einheit as number) ?? null} onWert={(v) => onAnsatz({ ...ansatz, material_je_einheit: v ?? undefined } as AnsatzGespeichert)} className="pr-6" /></Feld>
          <Schalter an={!!a.montage} onAn={(v) => onAnsatz({ ...ansatz, montage: v } as AnsatzGespeichert)} label="Baustelle (Montagesatz)" />
        </div>
      )}
      {art === 'prozent_be' && (
        <Feld label="Anteil an der übrigen Summe" einheit="%" hinweis="Wird zuletzt aus allen anderen Positionen gerechnet.">
          <ZahlFeld klein wert={(a.prozent as number) ?? 5} onWert={(v) => onAnsatz({ ...ansatz, prozent: v ?? 5 } as AnsatzGespeichert)} className="pr-6" />
        </Feld>
      )}
      {art === 'manuell' && (
        <Feld label="Einzelpreis von Hand" einheit="€"><ZahlFeld klein wert={(a.ep as number) ?? null} onWert={(v) => onAnsatz({ ...ansatz, ep: v } as AnsatzGespeichert)} className="pr-6" /></Feld>
      )}
    </div>
  );
}

const TEILART: Record<string, string> = {
  profil_schwer: 'Profil schwer',
  profil_leicht: 'Profil leicht',
  blech: 'Blech',
  blech_dick: 'Blech ab 20 mm',
  kleinteil: 'Kleinteil',
  kaufteil: 'Kaufteil',
};

function BaugruppeFelder({ a, onA }: { a: BaugruppeAnsatz; onA: (a: BaugruppeAnsatz) => void }) {
  const m = { ...MERKMALE_STANDARD, ...(a.merkmale ?? {}) };
  const setM = (patch: Partial<BaugruppeMerkmale>) => onA({ ...a, merkmale: { ...m, ...patch } });
  const teile = a.teile ?? [];
  const setTeil = (i: number, patch: Partial<Teil>) => onA({ ...a, teile: teile.map((t, j) => (j === i ? { ...t, ...patch } : t)) });
  const summe = teile.reduce((s, t) => s + (t.gewicht_kg ?? 0), 0);
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-linie overflow-x-auto">
        <div className="px-3 py-2 text-[12px] font-medium schmal text-hell border-b border-linie flex">
          Stückliste je Stück{a.zeichnung ? ` · ${a.zeichnung}` : ''}
          <span className="ml-auto">
            Summe {zahl(summe, 2)} kg{a.gewicht_zeichnung_kg ? `, Zeichnung ${zahl(a.gewicht_zeichnung_kg, 2)} kg` : ''}
          </span>
        </div>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-hell text-left">
              <th className="px-2 py-1 font-normal">Pos</th>
              <th className="px-2 py-1 font-normal text-right">Stk</th>
              <th className="px-2 py-1 font-normal">Profil</th>
              <th className="px-2 py-1 font-normal text-right">Länge</th>
              <th className="px-2 py-1 font-normal text-right">kg</th>
              <th className="px-2 py-1 font-normal">Art</th>
            </tr>
          </thead>
          <tbody>
            {teile.map((t, i) => (
              <tr key={i} className="border-t border-linie">
                <td className="px-2 py-1 zahl">{t.pos}</td>
                <td className="px-1 py-1 w-14"><ZahlFeld klein wert={t.stk} stellen={0} onWert={(v) => setTeil(i, { stk: v ?? 0 })} /></td>
                <td className="px-2 py-1"><div>{t.profil}</div><div className="text-hell">{t.bezeichnung}{t.werkstoff ? `, ${t.werkstoff}` : ''}</div></td>
                <td className="px-2 py-1 text-right zahl">{t.laenge_mm ? zahl(t.laenge_mm, 0) : ''}</td>
                <td className="px-1 py-1 w-20"><ZahlFeld klein wert={t.gewicht_kg} onWert={(v) => setTeil(i, { gewicht_kg: v })} /></td>
                <td className="px-2 py-1 text-hell whitespace-nowrap">{TEILART[teilart(t)]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Feld label="Bohrungen im Profil"><ZahlFeld klein wert={m.bohrungen_profil} stellen={0} onWert={(v) => setM({ bohrungen_profil: v ?? 0 })} /></Feld>
        <Feld label="Bohrungen im Blech"><ZahlFeld klein wert={m.bohrungen_blech} stellen={0} onWert={(v) => setM({ bohrungen_blech: v ?? 0 })} /></Feld>
        <Feld label="Kehlnaht" einheit="m"><ZahlFeld klein wert={m.naht_m} onWert={(v) => setM({ naht_m: v ?? 0 })} className="pr-6" /></Feld>
        <Feld label="HV- und Stumpfnaht" einheit="m"><ZahlFeld klein wert={m.hv_naht_m} onWert={(v) => setM({ hv_naht_m: v ?? 0 })} className="pr-6" /></Feld>
        <Feld label="Kantungen"><ZahlFeld klein wert={m.kantungen} stellen={0} onWert={(v) => setM({ kantungen: v ?? 0 })} /></Feld>
        <Feld label="Oberfläche">
          <select className="eingabe eingabe-klein" value={m.oberflaeche} onChange={(e) => setM({ oberflaeche: e.target.value as ZeichnungOberflaeche })}>
            <option value="roh">roh</option>
            <option value="grundiert">grundiert</option>
            <option value="verzinkt">feuerverzinkt</option>
            <option value="beschichtet">gestrahlt und beschichtet</option>
            <option value="verzinkt_beschichtet">verzinkt und beschichtet</option>
          </select>
        </Feld>
        <Feld label="Montage je Stück" einheit="h"><ZahlFeld klein wert={m.montage_h ?? 0} onWert={(v) => setM({ montage_h: v ?? 0 })} className="pr-6" /></Feld>
        <Feld label="Sonderaufwand je Stück" einheit="h"><ZahlFeld klein wert={m.zusatz_h ?? 0} onWert={(v) => setM({ zusatz_h: v ?? 0 })} className="pr-6" /></Feld>
        <div className="col-span-2"><Schalter an={m.schweissbaugruppe} onAn={(v) => setM({ schweissbaugruppe: v })} label="Schweißbaugruppe (Teile werden verschweißt)" /></div>
      </div>
    </div>
  );
}
