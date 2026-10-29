'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase/client';
import type { Stammdaten } from '@/lib/engine/stammdaten';
import type { Ansatz } from '@/lib/engine/bauteile';
import { ART_LABEL } from '@/lib/engine/ansatz';
import { euro, zahl } from '@/lib/format';
import { ProjektKopf, type ProjektMeta } from '@/components/ProjektKopf';
import { ZahlFeld } from '@/components/Felder';
import { AnsatzEditor, standardAnsatz } from './AnsatzEditor';
import { mitPreisen, preis, summen, zaehlt, type Datei, type Position, type AnsatzGespeichert, type Abgleich, type ArchivTreffer } from './typen';
import { pruefbericht, pruefePosition } from '@/lib/pruefung';
import { baugruppeRechnen, type BaugruppeAnsatz } from '@/lib/engine/zeichnung';
import { vorschauPfad } from '@/lib/vorschau';

type Props = {
  modus: 'lv' | 'bauteil' | 'zeichnung';
  projekt: ProjektMeta & { ki_budget_eur: number };
  positionen: Position[];
  dateien: Datei[];
  hinweise: string[];
  abgleich?: Abgleich | null;
  stamm: Stammdaten;
  kiKosten: number;
  darfSchreiben: boolean;
};

type Filter = 'alle' | 'pruefen' | 'offen' | 'freigegeben' | 'fremd';

const STATUS: Record<Position['status'], { label: string; text: string; punkt: string }> = {
  offen: { label: 'Offen', text: 'text-grau', punkt: 'bg-linie-stark' },
  berechnet: { label: 'Berechnet', text: 'text-tiefblau', punkt: 'bg-tiefblau' },
  pruefen: { label: 'Prüfen', text: 'text-gelb', punkt: 'bg-[#e0a03a]' },
  freigegeben: { label: 'Freigegeben', text: 'text-gruen', punkt: 'bg-gruen' },
};

function groesse(b: number | null | undefined) {
  if (!b) return '';
  return b < 1_000_000 ? `${Math.max(1, Math.round(b / 1000))} KB` : `${zahl(b / 1_000_000, 1)} MB`;
}

function artErkennen(name: string, modus: Props['modus']): Datei['art'] {
  const n = name.toLowerCase();
  if (modus === 'zeichnung') return /\.(pdf|png|jpe?g)$/.test(n) ? 'zeichnung' : 'sonstiges';
  if (/\.(x8[0-9]|d8[0-9]|p8[0-9])$/.test(n)) return 'gaeb';
  if (/(lv|leistungsverzeichnis|leistungsbeschreibung|ausschreibung)/.test(n)) return 'lv';
  if (/(baubeschreibung|vorbemerkung)/.test(n)) return 'baubeschreibung';
  if (/\.pdf$/.test(n)) return 'plan';
  return 'sonstiges';
}

export function PositionsEditor({ modus, projekt, positionen: start, dateien: dStart, hinweise, abgleich: aStart = null, stamm, kiKosten: kStart, darfSchreiben }: Props) {
  const sb = supabaseBrowser();
  const [meta, setMeta] = useState<ProjektMeta>(projekt);
  const [pos, setPos] = useState<Position[]>(() => mitPreisen(start, stamm));
  const [dateien, setDateien] = useState<Datei[]>(dStart);
  const [filter, setFilter] = useState<Filter>('alle');
  const [unsicherZuerst, setUnsicherZuerst] = useState(false);
  const [offenId, setOffenId] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null);
  const [kiKosten, setKiKosten] = useState(kStart);
  const [mitPlaenen, setMitPlaenen] = useState(false);
  const [metaStand, setMetaStand] = useState('');
  const [abgleich, setAbgleich] = useState<Abgleich | null>(aStart);
  const [berichtOffen, setBerichtOffen] = useState(false);
  const [vorschau, setVorschau] = useState<Record<string, string>>({});
  const [liestId, setLiestId] = useState<string | null>(null);
  const dateiInput = useRef<HTMLInputElement>(null);

  /** Vorschaubilder der Zeichnungen holen, fehlende einmal rendern lassen. */
  async function vorschauLaden(liste: Datei[]) {
    const z = liste.filter((d) => d.art === 'zeichnung' && /\.(pdf|png|jpe?g)$/i.test(d.name));
    if (!z.length) return;
    const { data } = await sb.storage.from('unterlagen').createSignedUrls(z.map((d) => vorschauPfad(d.pfad)), 3600);
    const gefunden: Record<string, string> = {};
    const fehlt: Datei[] = [];
    z.forEach((d, i) => {
      const u = data?.[i];
      if (u?.signedUrl && !u.error) gefunden[d.id] = u.signedUrl;
      else fehlt.push(d);
    });
    setVorschau((v) => ({ ...v, ...gefunden }));
    for (const d of fehlt) {
      const r = await fetch(`/api/zeichnung/${projekt.id}/vorschau`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ datei_id: d.id }) })
        .then((x) => x.json())
        .catch(() => ({}));
      if (r.url) setVorschau((v) => ({ ...v, [d.id]: r.url }));
    }
  }

  useEffect(() => {
    if (modus === 'zeichnung') vorschauLaden(dStart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const s = useMemo(() => summen(pos), [pos]);
  const zk = useMemo(() => {
    let kg = 0;
    let h = 0;
    let teile = 0;
    for (const p of pos) {
      if (p.ansatz?.art !== 'baugruppe' || !zaehlt(p)) continue;
      const r = baugruppeRechnen(p.ansatz as unknown as BaugruppeAnsatz, stamm);
      const m = Number(p.menge ?? 1) || 1;
      kg += r.kennzahlen.kg * m;
      h += r.kennzahlen.stunden * m;
      teile += r.kennzahlen.teile * m;
    }
    return { kg, h, teile };
  }, [pos, stamm]);
  const bericht = useMemo(() => pruefbericht(pos), [pos]);
  const hatGaeb = pos.some((p) => p.quelle?.startsWith('gaeb:'));

  const sichtbar = useMemo(() => {
    let l = pos;
    if (filter === 'pruefen') l = l.filter((p) => p.status === 'pruefen');
    if (filter === 'offen') l = l.filter((p) => p.status === 'offen');
    if (filter === 'freigegeben') l = l.filter((p) => p.status === 'freigegeben');
    if (filter === 'fremd') l = l.filter((p) => p.typ === 'fremd' || p.ansatz?.ausgeblendet);
    if (unsicherZuerst) l = [...l].sort((a, b) => (a.sicherheit ?? 2) - (b.sicherheit ?? 2));
    return l;
  }, [pos, filter, unsicherZuerst]);

  const zeige = (ok: boolean, text: string) => {
    setMeldung({ ok, text });
    setTimeout(() => setMeldung(null), 5000);
  };

  async function metaSpeichern(m: ProjektMeta) {
    setMeta(m);
    setMetaStand('…');
    const { error } = await sb.from('projekte').update({ titel: m.titel, kunde: m.kunde, ort: m.ort, status: m.status, ergebnis_label: m.ergebnis_label }).eq('id', projekt.id);
    setMetaStand(error ? 'Nicht gespeichert' : 'Gespeichert');
  }

  const summeSpeichern = useCallback(
    async (liste: Position[]) => {
      const t = summen(liste).gesamt;
      await sb.from('projekte').update({ summe_netto: Math.round(t * 100) / 100 }).eq('id', projekt.id);
    },
    [sb, projekt.id],
  );

  async function speichereZeilen(geaendert: Position[], alleNeu: Position[], grund?: string) {
    const { data: u } = await sb.auth.getUser();
    for (const p of geaendert) {
      const alt = pos.find((x) => x.id === p.id);
      await sb.from('positionen').update({ ansatz: p.ansatz, ep: p.ep, gp: p.gp, status: p.status, typ: p.typ, menge: p.menge, kurztext: p.kurztext, langtext: p.langtext, oz: p.oz, einheit: p.einheit }).eq('id', p.id);
      if (alt && alt.ep !== p.ep) await sb.from('aenderungen').insert({ projekt_id: projekt.id, position_id: p.id, feld: 'ep', alt: String(alt.ep ?? ''), neu: String(p.ep ?? ''), grund: grund ?? null, user_id: u.user?.id });
    }
    // BE-Positionen hängen an der Summe: mitspeichern
    const be = alleNeu.filter((p) => p.ansatz?.art === 'prozent_be' && !geaendert.some((g) => g.id === p.id));
    for (const p of be) await sb.from('positionen').update({ ep: p.ep, gp: p.gp }).eq('id', p.id);
    await summeSpeichern(alleNeu);
  }

  /** Lernschleife: freigegebene Positionen wandern ins Archiv und helfen bei der nächsten Ausschreibung. */
  function insArchiv(ids: string[]) {
    if (!ids.length) return;
    fetch('/api/archiv/aufnehmen', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projekt_id: projekt.id, ids }) }).catch(() => {});
  }

  async function aktualisiere(id: string, patch: Partial<Position>, grund?: string) {
    const neu = mitPreisen(pos.map((p) => (p.id === id ? { ...p, ...patch } : p)), stamm);
    setPos(neu);
    const g = neu.find((p) => p.id === id)!;
    await speichereZeilen([g], neu, grund);
    if (g.status === 'freigegeben') insArchiv([id]);
  }

  async function freigeben(ids: string[]) {
    const neu = mitPreisen(pos.map((p) => (ids.includes(p.id) && p.ep !== null ? { ...p, status: 'freigegeben' as const } : p)), stamm);
    setPos(neu);
    await speichereZeilen(neu.filter((p) => ids.includes(p.id)), neu);
    insArchiv(ids);
  }

  async function planAbgleich() {
    setLaeuft('Pläne werden gegen das LV geprüft … (dauert bis zu zwei Minuten)');
    try {
      const r = await fetch(`/api/lv/${projekt.id}/abgleich`, { method: 'POST' });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.abgleich) {
        setAbgleich(j.abgleich);
        setBerichtOffen(true);
        zeige(true, 'Abgleich fertig. Ergebnis im Prüfbericht.');
      } else zeige(false, j.fehler ?? 'Der Abgleich hat nicht geklappt. Bitte erneut versuchen.');
    } catch {
      zeige(false, 'Verbindung unterbrochen. Bitte erneut versuchen.');
    }
    setLaeuft(null);
  }

  async function neuRechnen() {
    const neu = mitPreisen(pos, stamm);
    const geaendert = neu.filter((p, i) => p.ep !== pos[i].ep);
    setPos(neu);
    await speichereZeilen(geaendert, neu, 'Neu gerechnet mit aktuellen Stammdaten');
    zeige(true, `${geaendert.length} Preise mit den aktuellen Stammdaten neu gerechnet.`);
  }

  /** Fragt alle 4 s nach, bis das Ergebnis da ist (höchstens 3 Minuten). */
  async function warte<T>(pruefe: () => Promise<T | null>): Promise<T | null> {
    for (let n = 0; n < 45; n++) {
      await new Promise((ok) => setTimeout(ok, 4000));
      const x = await pruefe();
      if (x) return x;
    }
    return null;
  }

  async function neuLaden() {
    const { data } = await sb.from('positionen').select('*').eq('projekt_id', projekt.id).order('sort');
    const neu = mitPreisen((data ?? []) as Position[], stamm);
    setPos(neu);
    const { data: k } = await sb.from('ki_aufrufe').select('kosten_eur').eq('projekt_id', projekt.id);
    setKiKosten((k ?? []).reduce((x, r) => x + Number(r.kosten_eur ?? 0), 0));
    return neu;
  }

  async function hochladen(files: FileList | File[]): Promise<Datei[]> {
    const neu: Datei[] = [];
    if (!darfSchreiben) return neu;
    setLaeuft('Lade hoch …');
    for (const f of Array.from(files)) {
      const sicher = f.name
        .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue').replace(/ß/g, 'ss')
        .normalize('NFKD').replace(/[^\w.\-]+/g, '_').slice(-120);
      const pfad = `${projekt.id}/${crypto.randomUUID()}-${sicher}`;
      const { error } = await sb.storage.from('unterlagen').upload(pfad, f, { contentType: f.type || 'application/octet-stream' });
      if (error) {
        zeige(false, `${f.name}: Hochladen ging nicht (${error.message}).`);
        continue;
      }
      const { data } = await sb.from('dateien').insert({ projekt_id: projekt.id, pfad, name: f.name, groesse: f.size, art: artErkennen(f.name, modus) }).select('*').single();
      if (data) {
        setDateien((d) => [...d, data as Datei]);
        neu.push(data as Datei);
      }
    }
    setLaeuft(null);
    if (modus === 'zeichnung' && neu.length) void vorschauLaden(neu);
    return neu;
  }

  /** Vorführung ohne eigene Zeichnung: drei ausgedachte Werkstattzeichnungen hochladen und direkt lesen. */
  async function beispieleLaden() {
    setLaeuft('Lade Beispielzeichnungen …');
    const namen = ['Beispiel_BSP-101_Stuetze_S1.pdf', 'Beispiel_BSP-102_Traeger_T1.pdf', 'Beispiel_BSP-103_Konsole_K1.pdf'];
    try {
      const files = await Promise.all(
        namen.map(async (n) => {
          const r = await fetch(`/beispiele/${n}`);
          if (!r.ok) throw new Error(n);
          return new File([await r.blob()], n, { type: 'application/pdf' });
        }),
      );
      if (meta.titel.startsWith('Neue Anfrage')) await metaSpeichern({ ...meta, titel: 'Lagererweiterung Halle 3 (Beispiel)', kunde: meta.kunde || 'Muster Bau GmbH', ort: meta.ort || 'Musterstadt' });
      const neu = await hochladen(files);
      let n = 0;
      for (const d of neu) n += await zeichnungLesen(d, true);
      setLaeuft(null);
      zeige(true, `${neu.length} Beispielzeichnungen gelesen, ${n} Positionen kalkuliert.`);
    } catch {
      setLaeuft(null);
      zeige(false, 'Beispielzeichnungen konnten nicht geladen werden.');
    }
  }

  async function dateiArt(d: Datei, art: Datei['art']) {
    setDateien((l) => l.map((x) => (x.id === d.id ? { ...x, art } : x)));
    await sb.from('dateien').update({ art }).eq('id', d.id);
  }

  async function dateiLoeschen(d: Datei) {
    if (!confirm(`${d.name} entfernen? Bereits gelesene Positionen bleiben erhalten.`)) return;
    await sb.storage.from('unterlagen').remove([d.pfad, vorschauPfad(d.pfad)]);
    await sb.from('dateien').delete().eq('id', d.id);
    setDateien((l) => l.filter((x) => x.id !== d.id));
  }

  async function dateiOeffnen(d: Datei) {
    const { data } = await sb.storage.from('unterlagen').createSignedUrl(d.pfad, 300);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener');
  }

  async function lesen(d: Datei) {
    // GAEB wird komplett neu eingelesen: vorher fragen, sonst sind Kalkulation und Freigaben weg
    const ausGaeb = pos.filter((p) => (p.quelle ?? '').startsWith(`gaeb:${d.id}:`)).length;
    if (ausGaeb && !confirm(`Diese GAEB-Datei ist schon gelesen. Neu lesen ersetzt alle ${ausGaeb} Positionen daraus, samt Kalkulation und Freigaben. Wirklich neu lesen?`)) return;
    let ab: number | null = 1;
    // Schon gelesen? Dann hinter der letzten gelesenen Seite weitermachen statt doppelt einzulesen
    const gelesen = pos.map((p) => p.quelle ?? '').filter((q) => q.startsWith(`pdf:${d.id}:`)).map((q) => Number(q.split(':')[2]) || 0);
    if (gelesen.length) {
      const bis = Math.max(...gelesen);
      if (!confirm(`Aus dieser Datei sind schon ${gelesen.length} Positionen bis Seite ${bis} gelesen. Ab Seite ${bis + 1} weiterlesen?`)) return;
      ab = bis + 1;
    }
    let neuGesamt = 0;
    while (ab !== null) {
      setLaeuft(`Lese ${d.name}${ab > 1 ? `, ab Seite ${ab}` : ''} …`);
      let r: Response | null = null;
      let j: { fehler?: string; neu: number; naechste: number | null } = { neu: 0, naechste: null };
      try {
        r = await fetch(`/api/lv/${projekt.id}/lesen`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ datei_id: d.id, ab_seite: ab }) });
        j = await r.json().catch(() => ({ neu: 0, naechste: null }));
      } catch {
        r = null;
      }
      if (!r || (!r.ok && !j.fehler)) {
        // Verbindung oder Proxy hat abgebrochen, der Server liest meist trotzdem fertig: Fortschritt abfragen
        const vorher: number = ab;
        const zaehle = async () => (await sb.from('positionen').select('id', { count: 'exact', head: true }).eq('projekt_id', projekt.id).like('quelle', `pdf:${d.id}:%`)).count ?? 0;
        const anzahlVorher = await zaehle();
        setLaeuft(`Lese ${d.name} ab Seite ${vorher} … (Verbindung langsam, warte auf Ergebnis)`);
        const stand = await warte(async () => {
          const { data } = await sb.from('dateien').select('gelesen_bis, seiten').eq('id', d.id).single();
          return data && Number(data.gelesen_bis) >= vorher ? data : null;
        });
        await neuLaden();
        if (!stand) {
          zeige(false, 'Verbindung unterbrochen. Bitte „Positionen lesen“ noch einmal klicken, bereits gelesene Positionen bleiben erhalten.');
          break;
        }
        neuGesamt += Math.max(0, (await zaehle()) - anzahlVorher);
        ab = Number(stand.gelesen_bis) < Number(stand.seiten) ? Number(stand.gelesen_bis) + 1 : null;
        continue;
      }
      if (!r.ok) {
        zeige(false, j.fehler ?? 'Lesen fehlgeschlagen.');
        break;
      }
      neuGesamt += j.neu;
      ab = j.naechste;
      await neuLaden();
    }
    setLaeuft(null);
    if (neuGesamt) zeige(true, `${neuGesamt} Positionen erkannt. Jetzt kalkulieren lassen.`);
  }

  /** Liest eine Werkstattzeichnung Blatt für Blatt. Jedes Blatt ist ein eigener Aufruf, damit nichts in eine Zeitgrenze läuft. */
  async function zeichnungLesen(d: Datei, still = false): Promise<number> {
    const schon = pos.filter((p) => (p.quelle ?? '').startsWith(`zng:${d.id}:`)).length;
    if (schon && !still && !confirm(`Aus dieser Zeichnung sind schon ${schon} Positionen gelesen. Neu lesen ersetzt sie samt Änderungen. Weiter?`)) return 0;
    let seite: number | null = 1;
    let neuGesamt = 0;
    setLiestId(d.id);
    while (seite !== null) {
      setLaeuft(`Lese ${d.name}${seite > 1 ? `, Blatt ${seite}` : ''} … Stückliste, Bohrungen, Nähte (rund 30 bis 90 Sekunden je Blatt)`);
      let r: Response | null = null;
      let j: { fehler?: string; neu: number; naechste: number | null; seiten?: number } = { neu: 0, naechste: null };
      try {
        r = await fetch(`/api/zeichnung/${projekt.id}/lesen`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ datei_id: d.id, seite }) });
        j = await r.json().catch(() => ({ neu: 0, naechste: null }));
      } catch {
        r = null;
      }
      if (!r || (!r.ok && !j.fehler)) {
        const vorher: number = seite;
        setLaeuft(`Lese ${d.name}, Blatt ${vorher} … (Verbindung langsam, warte auf Ergebnis)`);
        const stand = await warte(async () => {
          const { data } = await sb.from('dateien').select('gelesen_bis, seiten').eq('id', d.id).single();
          return data && Number(data.gelesen_bis) >= vorher ? data : null;
        });
        const liste = await neuLaden();
        if (!stand) {
          zeige(false, 'Verbindung unterbrochen. Bitte „Zeichnung lesen“ noch einmal klicken.');
          break;
        }
        neuGesamt = liste.filter((p) => (p.quelle ?? '').startsWith(`zng:${d.id}:`)).length;
        seite = Number(stand.gelesen_bis) < Number(stand.seiten) ? Number(stand.gelesen_bis) + 1 : null;
        continue;
      }
      if (!r.ok) {
        zeige(false, j.fehler ?? 'Lesen fehlgeschlagen.');
        break;
      }
      neuGesamt += j.neu;
      seite = j.naechste;
      if (j.seiten) setDateien((l) => l.map((x) => (x.id === d.id ? { ...x, seiten: j.seiten ?? x.seiten } : x)));
      await neuLaden();
    }
    setLiestId(null);
    if (!still) {
      setLaeuft(null);
      if (neuGesamt) zeige(true, `${neuGesamt} Positionen aus ${d.name} gelesen und kalkuliert. Gelb markierte bitte prüfen.`);
    }
    return neuGesamt;
  }

  async function alleZeichnungenLesen() {
    const offen = dateien.filter((d) => d.art === 'zeichnung' && !pos.some((p) => (p.quelle ?? '').startsWith(`zng:${d.id}:`)));
    if (!offen.length) return zeige(true, 'Alle Zeichnungen sind gelesen.');
    let n = 0;
    for (const d of offen) n += await zeichnungLesen(d, true);
    setLaeuft(null);
    zeige(true, `${offen.length} Zeichnungen gelesen, ${n} Positionen kalkuliert. Gelb markierte bitte prüfen.`);
  }

  async function kalkulieren(nur?: string[], gruendlich = false) {
    const ziel = (nur ?? pos.filter((p) => p.status === 'offen' && !p.ansatz?.ausgeblendet).map((p) => p.id));
    if (!ziel.length) return zeige(true, 'Keine offenen Positionen.');
    // Kleine Pakete: jede Anfrage bleibt unter einer Minute, auch bei wackeliger Verbindung
    const paket = 6;
    let fertig = 0;
    for (let i = 0; i < ziel.length; i += paket) {
      setLaeuft(`Kalkuliere ${Math.min(i + paket, ziel.length)} von ${ziel.length} Positionen …`);
      const ids = ziel.slice(i, i + paket);
      let r: Response | null = null;
      let j: { fehler?: string; gesetzt?: number } = {};
      try {
        r = await fetch(`/api/lv/${projekt.id}/kalkulieren`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ids, mit_plaenen: mitPlaenen, gruendlich }) });
        j = await r.json().catch(() => ({}));
      } catch {
        r = null;
      }
      if (r && r.ok) {
        fertig += j.gesetzt ?? 0;
      } else if (r && j.fehler) {
        zeige(false, j.fehler);
        break;
      } else {
        // Verbindung oder Proxy hat abgebrochen, der Server rechnet meist trotzdem fertig: Ergebnis abfragen
        setLaeuft(`Kalkuliere ${Math.min(i + paket, ziel.length)} von ${ziel.length} Positionen … (Verbindung langsam, warte auf Ergebnis)`);
        let zuletzt = -1;
        const geschafft = await warte(async () => {
          const { data } = await sb.from('positionen').select('id,status').in('id', ids);
          const n = (data ?? []).filter((p) => p.status !== 'offen').length;
          // fertig, wenn alle gesetzt sind oder sich die Zahl nicht mehr ändert
          const stabil = n > 0 && n === zuletzt;
          zuletzt = n;
          return n >= ids.length || stabil ? n : null;
        });
        if (!geschafft) {
          await neuLaden();
          zeige(false, 'Verbindung unterbrochen. Bitte „Offene kalkulieren“ noch einmal klicken.');
          break;
        }
        fertig += geschafft;
      }
      await neuLaden();
    }
    const neu = await neuLaden();
    await speichereZeilen([], neu);
    setLaeuft(null);
    if (fertig) zeige(true, `${fertig} Positionen kalkuliert. Gelb markierte bitte prüfen.`);
  }

  async function neuePosition(art: Ansatz['art']) {
    const sort = (pos.at(-1)?.sort ?? 0) + 10;
    const nr = String(pos.length + 1).padStart(2, '0');
    const titel: Record<string, string> = { gelaender_m: 'Geländer', treppe_stk: 'Stahltreppe', stahl_kg: 'Stahlkonstruktion', gitterrost_m2: 'Gitterroste', stunden: 'Arbeiten nach Aufwand', zukauf: 'Zukaufteil', prozent_be: 'Baustelleneinrichtung', manuell: 'Position' };
    const einheit: Record<string, string> = { gelaender_m: 'm', treppe_stk: 'Stck', stahl_kg: 'kg', gitterrost_m2: 'm²', stunden: 'h', zukauf: 'Stck', prozent_be: 'psch', manuell: 'Stck' };
    const { data, error } = await sb
      .from('positionen')
      .insert({ projekt_id: projekt.id, sort, oz: nr, kurztext: titel[art], menge: 1, einheit: einheit[art], typ: art, ansatz: standardAnsatz(art), status: 'berechnet', sicherheit: 1, quelle: 'hand' })
      .select('*')
      .single();
    if (error || !data) return zeige(false, 'Anlegen ging nicht.');
    const neu = mitPreisen([...pos, data as Position], stamm);
    setPos(neu);
    setOffenId(data.id);
    await speichereZeilen([neu.find((p) => p.id === data.id)!], neu);
  }

  async function loeschen(id: string) {
    if (!confirm('Position löschen?')) return;
    await sb.from('positionen').delete().eq('id', id);
    const neu = mitPreisen(pos.filter((p) => p.id !== id), stamm);
    setPos(neu);
    setOffenId(null);
    await summeSpeichern(neu);
  }

  const offen = pos.find((p) => p.id === offenId) ?? null;
  const freigebbar = pos.filter((p) => zaehlt(p) && p.status === 'berechnet' && (p.sicherheit ?? 0) >= 0.9 && p.ep !== null);

  return (
    <div className="space-y-6">
      <ProjektKopf
        meta={meta}
        onMeta={metaSpeichern}
        art={modus === 'lv' ? 'Ausschreibung' : modus === 'zeichnung' ? 'Nach Zeichnung' : 'Treppe, Geländer, Stahlbau'}
        stand={<span className="text-[13px] text-hell">{metaStand}</span>}
        gesperrt={!darfSchreiben}
        kennzahlen={
          <div className="grid grid-cols-2 lg:grid-cols-[1.7fr_1fr_1fr_1fr_1fr] gap-px bg-linie-stark">
            <div className="col-span-2 lg:col-span-1 bg-tiefblau text-white px-5 py-4">
              <span className="feldname text-white/60">Summe netto</span>
              <div className="zahl breit text-[36px] font-bold leading-none mt-1.5">{euro(s.gesamt, true)}</div>
              <div className="text-[13px] text-white/65 mt-2">davon freigegeben {euro(s.freigegeben, true)}</div>
            </div>
            {modus === 'zeichnung' ? (
              <>
                <Kz label="Stahlgewicht" wert={`${zahl(zk.kg, 0)} kg`} sub={`${s.anzahl} Positionen, ${zahl(zk.teile, 0)} Teile`} />
                <Kz label="Fertigung" wert={`${zahl(zk.h, 1)} h`} sub={zk.kg > 0 ? `${zahl((zk.h / zk.kg) * 1000, 1)} h je Tonne` : 'aus den Arbeitsgängen'} />
                <Kz label="Preis je kg" wert={zk.kg > 0 ? `${zahl(s.gesamt / zk.kg, 2)} €` : '–'} sub={s.pruefen ? `${s.pruefen} zu prüfen` : 'alles geprüft'} warn={s.pruefen > 0} />
              </>
            ) : (
              <>
                <Kz label="Positionen" wert={`${s.anzahl}`} sub={`${s.frei} freigegeben`} />
                <Kz label="Zu prüfen" wert={`${s.pruefen}`} sub={s.offen ? `${s.offen} noch offen` : 'alle kalkuliert'} warn={s.pruefen > 0} />
                <Kz label="Fremdgewerke" wert={`${s.fremd}`} sub="nicht in der Summe" />
              </>
            )}
            <Kz label="KI-Kosten" wert={euro(kiKosten)} sub={`Budget ${euro(projekt.ki_budget_eur, true)}`} />
          </div>
        }
      >
        <a href={`/api/projekt/${projekt.id}/excel`} className="knopf-zweit">Excel</a>
        {hatGaeb && (
          <a
            href={`/api/lv/${projekt.id}/x84`}
            className="knopf-zweit"
            title="Nur freigegebene Positionen erhalten einen Preis"
            onClick={(e) => {
              const ohne = pos.filter((p) => zaehlt(p) && p.status !== 'freigegeben').length;
              if (ohne && !confirm(`${ohne} ${ohne === 1 ? 'Position ist' : 'Positionen sind'} noch nicht freigegeben und ${ohne === 1 ? 'bleibt' : 'bleiben'} in der X84 ohne Preis. Trotzdem exportieren?`)) e.preventDefault();
            }}
          >
            GAEB X84
          </a>
        )}
        <Link href={`/${modus}/${projekt.id}/angebot`} className="knopf-primaer">Angebot ansehen</Link>
      </ProjektKopf>

      {meldung && <div role="status" className={`rounded-[6px] border-l-4 px-4 py-3 text-[14px] font-medium ${meldung.ok ? 'bg-gruen-hell border-gruen text-gruen' : 'bg-rot-hell border-rot text-rot'}`}>{meldung.text}</div>}
      {laeuft && (
        <div role="status" className="rounded-[6px] border-l-4 border-tiefblau px-4 py-3 text-[14px] bg-blau-hell text-tiefblau flex items-center gap-3">
          <span className="w-4 h-4 shrink-0 rounded-full border-2 border-tiefblau border-t-transparent animate-spin" />
          {laeuft}
        </div>
      )}

      {modus === 'zeichnung' && (
        <section
          className="space-y-3"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files.length) hochladen(e.dataTransfer.files);
          }}
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="breit text-[19px] font-bold text-tiefblau">Zeichnungen</h2>
              <p className="text-[14px] text-grau max-w-[68ch]">PDF, Scan oder Foto. AIM liest Stückliste, Bohrungen und Nähte und rechnet jede Position mit Ihren Kostenstellen.</p>
            </div>
            {darfSchreiben && (
              <div className="flex flex-wrap gap-2">
                <input ref={dateiInput} type="file" multiple className="hidden" accept=".pdf,.png,.jpg,.jpeg,.PDF,.PNG,.JPG,.JPEG" onChange={(e) => e.target.files && hochladen(e.target.files)} />
                {dateien.length > 0 && <button className="knopf-zweit" onClick={() => dateiInput.current?.click()} disabled={!!laeuft}>Zeichnungen hinzufügen</button>}
                {dateien.some((d) => d.art === 'zeichnung' && !pos.some((p) => (p.quelle ?? '').startsWith(`zng:${d.id}:`))) && (
                  <button className="knopf-primaer" onClick={alleZeichnungenLesen} disabled={!!laeuft}>Alle lesen und kalkulieren</button>
                )}
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {dateien.map((d) => {
              const aus = pos.filter((p) => (p.quelle ?? '').startsWith(`zng:${d.id}:`));
              const n = aus.length;
              const nummer = (aus[0]?.ansatz as { zeichnung?: string } | null)?.zeichnung;
              const liest = liestId === d.id;
              return (
                <article key={d.id} className="bg-flaeche border border-linie rounded-[6px] overflow-hidden flex flex-col">
                  <button type="button" className={`relative aspect-[1.414] border-b border-linie bg-white ${liest ? 'abtasten' : ''}`} onClick={() => dateiOeffnen(d)} title="Zeichnung öffnen">
                    {vorschau[d.id] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={vorschau[d.id]} alt={`Vorschau ${d.name}`} className="absolute inset-0 w-full h-full object-contain p-1.5" />
                    ) : (
                      <BlattPlatzhalter />
                    )}
                    {n > 0 && <span className="absolute top-2 left-2 marke bg-tiefblau text-white">{n} {n === 1 ? 'Position' : 'Positionen'}</span>}
                  </button>
                  <div className="p-3 flex-1 flex flex-col gap-2">
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold text-tinte truncate">{nummer ?? d.name}</div>
                      <div className="text-[12px] text-hell truncate">{nummer ? `${d.name}, ` : ''}{groesse(d.groesse)}{d.seiten ? `, ${d.seiten} ${d.seiten === 1 ? 'Blatt' : 'Blätter'}` : ''}</div>
                    </div>
                    <div className="mt-auto flex items-center gap-1">
                      <span className={`text-[13px] font-semibold ${liest ? 'text-rot' : n ? 'text-gruen' : 'text-hell'}`}>{liest ? 'Wird gelesen …' : n ? 'Gelesen' : 'Noch nicht gelesen'}</span>
                      <span className="ml-auto" />
                      {darfSchreiben && d.art === 'zeichnung' && !liest && (
                        <button className={n ? 'knopf-leise knopf-klein' : 'knopf-blau knopf-klein'} disabled={!!laeuft} onClick={() => zeichnungLesen(d)}>{n ? 'Neu lesen' : 'Lesen'}</button>
                      )}
                      {darfSchreiben && !liest && <button className="knopf-leise knopf-klein" disabled={!!laeuft} onClick={() => dateiLoeschen(d)} aria-label={`${d.name} entfernen`}>Entfernen</button>}
                    </div>
                  </div>
                </article>
              );
            })}
            {darfSchreiben && (
              <button
                type="button"
                className="raster rounded-[6px] border-[1.5px] border-dashed border-tusche/50 hover:border-tiefblau min-h-[220px] flex flex-col items-center justify-center gap-2 p-6 text-center transition-colors"
                onClick={() => dateiInput.current?.click()}
                disabled={!!laeuft}
              >
                <span className="ballon text-[16px]">+</span>
                <span className="text-[15px] font-semibold text-tiefblau">Zeichnungen ablegen</span>
                <span className="text-[13px] text-grau">Hierher ziehen oder klicken.<br />Mehrere Dateien auf einmal gehen.</span>
              </button>
            )}
            {darfSchreiben && dateien.length === 0 && (
              <button
                type="button"
                className="rounded-[6px] bg-tiefblau text-white min-h-[220px] flex flex-col justify-between p-5 text-left hover:bg-tiefblau-2 transition-colors"
                disabled={!!laeuft}
                onClick={beispieleLaden}
              >
                <span className="text-[13px] text-white/60 schmal">Keine Zeichnung zur Hand?</span>
                <span>
                  <span className="block breit text-[20px] font-bold leading-tight">Mit Beispielzeichnungen ausprobieren</span>
                  <span className="block text-[14px] text-white/70 mt-2">Stütze, Träger und Konsole. AIM liest alle drei und kalkuliert, in rund zwei Minuten.</span>
                </span>
              </button>
            )}
          </div>
          {hinweise.length > 0 && (
            <details className="rounded-[6px] border border-linie bg-flaeche px-4 py-2.5">
              <summary className="text-[14px] cursor-pointer font-semibold text-tiefblau">Hinweise aus den Zeichnungen ({hinweise.length})</summary>
              <ul className="mt-2 list-disc pl-5 text-[13px] text-grau space-y-0.5">{hinweise.map((h) => <li key={h}>{h}</li>)}</ul>
            </details>
          )}
        </section>
      )}

      {modus === 'lv' && (
        <section
          className="karte p-4"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files.length) hochladen(e.dataTransfer.files);
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-sm">Unterlagen</h2>
              <p className="text-[12px] text-grau">LV als GAEB (X83) oder PDF, dazu Pläne und Baubeschreibung. Kein LV? Zeichnung hochladen, Art „Plan“ wählen und „Positionen aus Zeichnung“ klicken.</p>
            </div>
            {darfSchreiben && (
              <>
                <input ref={dateiInput} type="file" multiple className="hidden" accept=".pdf,.x83,.x81,.x86,.X83,.X81,.X86,.d83,.D83,.p83,.P83" onChange={(e) => e.target.files && hochladen(e.target.files)} />
                <button className="knopf-zweit" onClick={() => dateiInput.current?.click()} disabled={!!laeuft}>Dateien wählen</button>
              </>
            )}
          </div>
          {dateien.length > 0 && (
            <div className="overflow-x-auto mt-3">
            <table className="tabelle">
              <tbody>
                {dateien.map((d) => (
                  <tr key={d.id}>
                    <td><button className="text-left hover:text-rot font-medium text-[13px]" onClick={() => dateiOeffnen(d)}>{d.name}</button>
                      <div className="text-[11px] text-hell">{d.groesse ? `${zahl(d.groesse / 1_000_000, 1)} MB` : ''}{d.seiten ? ` · ${d.seiten} Seiten` : ''}</div></td>
                    <td className="w-44">
                      <select className="eingabe eingabe-klein" value={d.art} disabled={!darfSchreiben} onChange={(e) => dateiArt(d, e.target.value as Datei['art'])}>
                        <option value="gaeb">GAEB-LV</option>
                        <option value="lv">LV (PDF)</option>
                        <option value="plan">Plan</option>
                        <option value="baubeschreibung">Baubeschreibung</option>
                        <option value="sonstiges">Sonstiges</option>
                      </select>
                    </td>
                    <td className="w-64 text-right whitespace-nowrap">
                      {(d.art === 'lv' || d.art === 'gaeb' || d.art === 'baubeschreibung' || d.art === 'plan') && darfSchreiben && (
                        <button className="knopf-blau knopf-klein" disabled={!!laeuft} onClick={() => lesen(d)}>{d.art === 'baubeschreibung' ? 'Hinweise lesen' : d.art === 'plan' ? 'Positionen aus Zeichnung' : 'Positionen lesen'}</button>
                      )}
                      {darfSchreiben && <button className="knopf-leise knopf-klein" onClick={() => dateiLoeschen(d)}>Entfernen</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
          {hinweise.length > 0 && (
            <details className="mt-3 rounded-lg bg-papier px-3 py-2">
              <summary className="text-sm cursor-pointer font-medium">Hinweise aus Vorbemerkungen ({hinweise.length})</summary>
              <ul className="mt-2 list-disc pl-5 text-[13px] text-grau space-y-0.5">{hinweise.map((h) => <li key={h}>{h}</li>)}</ul>
            </details>
          )}
        </section>
      )}

      {modus === 'lv' && pos.length > 0 && (
        <section className="karte p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <h2 className="font-semibold text-sm">Prüfbericht</h2>
              <p className="text-[12px] text-grau">
                {bericht.warnungen ? `${bericht.warnungen} Positionen mit Auffälligkeiten` : 'Keine Auffälligkeiten bei Preisen, Gewichten und Mengen'}
                {bericht.hinweise > bericht.warnungen ? `, ${bericht.hinweise - bericht.warnungen} mit Hinweisen` : ''}
                {abgleich ? ` · Plan gegen LV geprüft am ${new Date(abgleich.datum).toLocaleDateString('de-DE')}` : ''}
              </p>
            </div>
            <div className="ml-auto flex gap-2">
              {(bericht.hinweise > 0 || abgleich) && <button className="knopf-leise knopf-klein" onClick={() => setBerichtOffen(!berichtOffen)}>{berichtOffen ? 'Zuklappen' : 'Anzeigen'}</button>}
              {darfSchreiben && dateien.some((d) => d.art === 'plan') && (
                <button className="knopf-zweit knopf-klein" disabled={!!laeuft} onClick={planAbgleich} title="Pläne und LV gegeneinander prüfen: fehlende Positionen, Mengenabweichungen">Plan gegen LV prüfen</button>
              )}
            </div>
          </div>
          {berichtOffen && (
            <div className="space-y-3">
              {abgleich && (
                <div className="rounded-lg border border-linie p-3 space-y-2 text-[13px]">
                  <div className="text-[12px] font-medium schmal text-tiefblau font-medium">Plan gegen LV · {abgleich.plaene.join(', ')}</div>
                  <p>{abgleich.zusammenfassung}</p>
                  {abgleich.fehlt_im_lv.length > 0 && (
                    <div><div className="font-medium">Auf den Plänen, aber ohne LV-Position</div>
                      <ul className="list-disc pl-5 text-grau">{abgleich.fehlt_im_lv.map((f, i) => <li key={i}>{f.bauteil}{f.menge_plan ? ` (${zahl(f.menge_plan, 2)} ${f.einheit})` : ''}, {f.fundstelle}. {f.hinweis}</li>)}</ul></div>
                  )}
                  {abgleich.mengen.length > 0 && (
                    <div><div className="font-medium">Mengen weichen ab</div>
                      <ul className="list-disc pl-5 text-grau">{abgleich.mengen.map((m, i) => <li key={i}>OZ {m.oz}: LV {zahl(m.menge_lv, 2)} {m.einheit}, Plan {zahl(m.menge_plan, 2)} {m.einheit}. {m.hinweis}</li>)}</ul></div>
                  )}
                  {abgleich.nicht_im_plan.length > 0 && (
                    <div><div className="font-medium">Im LV, aber auf keinem Plan gefunden</div>
                      <ul className="list-disc pl-5 text-grau">{abgleich.nicht_im_plan.map((n, i) => <li key={i}>OZ {n.oz}: {n.hinweis}</li>)}</ul></div>
                  )}
                </div>
              )}
              {bericht.je.length > 0 && (
                <table className="tabelle">
                  <tbody>
                    {bericht.je.map(({ p, befunde }) => (
                      <tr key={p.id} className="cursor-pointer hover:bg-papier/70" onClick={() => setOffenId(p.id)}>
                        <td className="zahl text-[12px] w-24 whitespace-nowrap">{p.oz}</td>
                        <td className="text-[13px]"><div className="font-medium line-clamp-1">{p.kurztext}</div>
                          {befunde.map((f, i) => <div key={i} className={`text-[12px] ${f.stufe === 'warnung' ? 'text-gelb' : 'text-grau'}`}>{f.stufe === 'warnung' ? '⚠ ' : ''}{f.text}</div>)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </section>
      )}

      <section className="space-y-3">
        {modus === 'zeichnung' && <h2 className="breit text-[19px] font-bold text-tiefblau">Positionen</h2>}
        <div className="karte overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-linie">
          <div className="flex rounded-[6px] border border-linie-stark overflow-hidden text-[13px]">
            {(
              [
                ['alle', `Alle ${pos.length}`],
                ['pruefen', `Prüfen ${s.pruefen}`],
                ['offen', `Offen ${s.offen}`],
                ['freigegeben', `Freigegeben ${s.frei}`],
                ['fremd', `Fremd ${s.fremd}`],
              ] as [Filter, string][]
            ).map(([f, l]) => (
              <button key={f} onClick={() => setFilter(f)} className={`px-3 h-8 whitespace-nowrap border-l border-linie first:border-l-0 ${filter === f ? 'bg-tiefblau text-white font-semibold' : 'text-grau hover:text-tiefblau bg-flaeche'}`}>{l}</button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-[13px] text-grau ml-2"><input type="checkbox" checked={unsicherZuerst} onChange={(e) => setUnsicherZuerst(e.target.checked)} /> unsichere zuerst</label>
          <div className="ml-auto flex flex-wrap gap-2">
            {modus === 'lv' && darfSchreiben && (
              <>
                <label className="flex items-center gap-1.5 text-[13px] text-grau" title="Pläne werden mitgelesen, um Massen und Profile zu ziehen. Kostet mehr."><input type="checkbox" checked={mitPlaenen} onChange={(e) => setMitPlaenen(e.target.checked)} /> Pläne einbeziehen</label>
                <button className="knopf-primaer knopf-klein" disabled={!!laeuft || s.offen === 0} onClick={() => kalkulieren()}>Offene kalkulieren</button>
              </>
            )}
            {modus === 'bauteil' && darfSchreiben && (
              <div className="flex flex-wrap gap-1">
                {(['gelaender_m', 'treppe_stk', 'stahl_kg', 'gitterrost_m2', 'stunden', 'zukauf', 'manuell'] as Ansatz['art'][]).map((a) => (
                  <button key={a} className="knopf-zweit knopf-klein" onClick={() => neuePosition(a)}>+ {ART_LABEL[a].replace(' je m', '').replace(' je m²', '')}</button>
                ))}
              </div>
            )}
            {darfSchreiben && freigebbar.length > 0 && (
              <button className="knopf-zweit knopf-klein" onClick={() => confirm(`${freigebbar.length} sichere Positionen (ab 90 %) mit zusammen ${euro(freigebbar.reduce((x, p) => x + Number(p.gp ?? 0), 0), true)} freigeben?`) && freigeben(freigebbar.map((p) => p.id))}>
                {freigebbar.length} sichere freigeben
              </button>
            )}
            {darfSchreiben && pos.length > 0 && <button className="knopf-leise knopf-klein" onClick={neuRechnen} title="Alle Preise mit den aktuellen Stammdaten neu rechnen">Neu rechnen</button>}
          </div>
        </div>
        {pos.length === 0 ? (
          <div className="p-10 text-center text-grau text-sm">
            {modus === 'lv'
              ? 'Noch keine Positionen. Laden Sie oben das LV oder eine Zeichnung hoch und klicken Sie auf „Positionen lesen“ bzw. „Positionen aus Zeichnung“.'
              : modus === 'zeichnung'
                ? 'Noch keine Positionen. Zeichnungen oben ablegen und „Lesen und kalkulieren“ klicken.'
                : 'Noch keine Positionen. Oben ein Bauteil hinzufügen, z. B. ein Geländer oder eine Treppe.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabelle">
              <thead>
                <tr>
                  <th className="w-24">{modus === 'lv' ? 'OZ' : 'Pos.'}</th>
                  <th>Bezeichnung</th>
                  <th className="text-right w-24">Menge</th>
                  <th className="w-12">Einh.</th>
                  {modus !== 'zeichnung' && <th className="w-36">Ansatz</th>}
                  <th className="text-right w-28">EP</th>
                  <th className="text-right w-32">GP</th>
                  <th className="w-28">Status</th>
                </tr>
              </thead>
              <tbody>
                {sichtbar.map((p) => {
                  const fremd = p.typ === 'fremd' || p.ansatz?.ausgeblendet;
                  return (
                    <tr key={p.id} className={`cursor-pointer hover:bg-blau-hell/40 ${fremd ? 'opacity-50' : ''} ${offenId === p.id ? 'bg-blau-hell/60' : ''}`} onClick={() => setOffenId(p.id)}>
                      <td className="whitespace-nowrap">{modus === 'lv' ? <span className="zahl text-[13px] text-grau">{p.oz}</span> : <span className="ballon">{p.oz}</span>}</td>
                      <td>
                        <div className="text-[14px] font-semibold text-tinte line-clamp-2">{p.kurztext}</div>
                        <div className="text-[12px] text-hell flex flex-wrap gap-x-2 mt-0.5">
                          {p.ansatz?.bereich && <span className="truncate max-w-[340px]">{p.ansatz.bereich}</span>}
                          {p.ansatz?.art === 'baugruppe' && <BaugruppeKurz p={p} stamm={stamm} />}
                          {p.ansatz?.bedarf && <span className="text-gelb">Bedarfsposition</span>}
                          {p.ansatz?.alternativ && <span className="text-gelb">Alternative</span>}
                        </div>
                      </td>
                      <td className="text-right zahl text-[14px] whitespace-nowrap">{zahl(p.menge, 3)}</td>
                      <td className="text-[13px] text-grau">{p.einheit}</td>
                      {modus !== 'zeichnung' && <td className="text-[13px] text-grau">{fremd ? 'Fremdgewerk' : p.ansatz?.art ? ART_LABEL[p.ansatz.art] : '–'}{p.ansatz?.ep_hand !== undefined && p.ansatz?.ep_hand !== null ? ', von Hand' : ''}</td>}
                      <td className="text-right zahl text-[14px] whitespace-nowrap">{euro(p.ep)}</td>
                      <td className="text-right zahl text-[14px] font-semibold whitespace-nowrap">{euro(p.gp)}</td>
                      <td>
                        <span className={`inline-flex items-center gap-1.5 text-[13px] font-semibold ${STATUS[p.status].text}`}><span className={`w-2 h-2 rounded-full ${STATUS[p.status].punkt}`} />{STATUS[p.status].label}</span>
                        {pruefePosition(p).some((f) => f.stufe === 'warnung') && <span className="ml-1 text-gelb" title={pruefePosition(p).map((f) => f.text).join(' ')}>⚠</span>}
                        {p.sicherheit !== null && p.status !== 'offen' && p.quelle !== 'hand' && <div className="text-[12px] text-hell mt-0.5">Sicherheit {Math.round((p.sicherheit ?? 0) * 100)} %</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        </div>
      </section>

      {offen && (
        <PositionsDetail
          key={offen.id}
          p={offen}
          stamm={stamm}
          darfSchreiben={darfSchreiben}
          modus={modus}
          onSchliessen={() => setOffenId(null)}
          onSpeichern={(patch, grund) => aktualisiere(offen.id, patch, grund)}
          onKalkulieren={() => kalkulieren([offen.id], true)}
          onLoeschen={() => loeschen(offen.id)}
          laeuft={!!laeuft}
        />
      )}
    </div>
  );
}

function BaugruppeKurz({ p, stamm }: { p: Position; stamm: Stammdaten }) {
  const a = p.ansatz as unknown as BaugruppeAnsatz;
  const r = baugruppeRechnen(a, stamm);
  return (
    <span>
      {a.zeichnung ? `${a.zeichnung} · ` : ''}
      {zahl(r.kennzahlen.kg, 1)} kg · {zahl(r.kennzahlen.teile, 0)} Teile · {zahl(r.kennzahlen.stunden, 1)} h je Stück
    </span>
  );
}

function Kz({ label, wert, sub, warn = false }: { label: string; wert: string; sub?: string; warn?: boolean }) {
  return (
    <div className={`px-4 py-4 ${warn ? 'bg-gelb-hell' : 'bg-flaeche'}`}>
      <span className="feldname">{label}</span>
      <div className="zahl text-[23px] font-semibold leading-tight mt-1 text-tiefblau">{wert}</div>
      {sub && <div className={`text-[13px] mt-1 ${warn ? 'text-gelb font-semibold' : 'text-grau'}`}>{sub}</div>}
    </div>
  );
}

/** Leeres Zeichnungsblatt mit Rahmen und Schriftfeld, solange es noch kein Vorschaubild gibt. */
function BlattPlatzhalter() {
  return (
    <svg className="absolute inset-0 w-full h-full raster" viewBox="0 0 297 210" preserveAspectRatio="xMidYMid meet" aria-hidden>
      <rect x="10" y="8" width="277" height="194" fill="none" stroke="#2a4a6b" strokeWidth="0.8" />
      <rect x="187" y="167" width="100" height="35" fill="#fff" stroke="#2a4a6b" strokeWidth="0.8" />
      <path d="M187 179 H287 M187 191 H287 M227 167 V202" stroke="#2a4a6b" strokeWidth="0.5" />
      <path d="M60 60 V150 M48 60 H72 M48 150 H72" stroke="#7d8b99" strokeWidth="1.4" />
      <path d="M100 120 H170" stroke="#7d8b99" strokeWidth="1.4" />
    </svg>
  );
}

function PositionsDetail({
  p,
  stamm,
  darfSchreiben,
  modus,
  onSchliessen,
  onSpeichern,
  onKalkulieren,
  onLoeschen,
  laeuft,
}: {
  p: Position;
  stamm: Stammdaten;
  darfSchreiben: boolean;
  modus: 'lv' | 'bauteil' | 'zeichnung';
  onSchliessen: () => void;
  onSpeichern: (patch: Partial<Position>, grund?: string) => Promise<void>;
  onKalkulieren: () => void;
  onLoeschen: () => void;
  laeuft: boolean;
}) {
  const [ansatz, setAnsatz] = useState<AnsatzGespeichert>(p.ansatz ?? {});
  const [menge, setMenge] = useState<number | null>(p.menge);
  const [kurztext, setKurztext] = useState(p.kurztext ?? '');
  const [langtext, setLangtext] = useState(p.langtext ?? '');
  const [oz, setOz] = useState(p.oz ?? '');
  const [einheit, setEinheit] = useState(p.einheit ?? '');
  const [grund, setGrund] = useState('');
  const vorschau = preis({ ...p, ansatz, menge }, stamm);
  const istBe = ansatz.art === 'prozent_be';
  const fremd = p.typ === 'fremd';

  const patch = (status?: Position['status']): Partial<Position> => ({
    ansatz,
    menge,
    kurztext,
    langtext,
    oz,
    einheit,
    typ: fremd && ansatz.art && ansatz.art !== 'manuell' ? ansatz.art : p.typ === 'fremd' ? 'fremd' : (ansatz.art ?? p.typ),
    ...(status ? { status } : {}),
  });

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-tinte/20" onClick={onSchliessen}>
      <aside className="h-full w-full max-w-[560px] bg-flaeche shadow-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-flaeche border-b border-linie px-5 py-3 flex items-center gap-3 z-10">
          <span className={modus === 'lv' ? 'zahl text-[13px] text-grau' : 'ballon'}>{p.oz}</span>
          <span className="font-semibold text-tiefblau truncate">{p.kurztext}</span>
          <button className="ml-auto knopf-leise knopf-klein" onClick={onSchliessen} aria-label="Schließen">✕</button>
        </div>
        <div className="p-5 space-y-5">
          {modus !== 'lv' || p.quelle === 'hand' ? (
            <div className="grid grid-cols-[90px_1fr] gap-2">
              <div><label className="label">Pos.</label><input className="eingabe eingabe-klein" value={oz} onChange={(e) => setOz(e.target.value)} /></div>
              <div><label className="label">Kurztext</label><input className="eingabe eingabe-klein" value={kurztext} onChange={(e) => setKurztext(e.target.value)} /></div>
              <div className="col-span-2"><label className="label">Langtext für das Angebot</label><textarea className="eingabe h-24 py-2 text-[13px]" value={langtext} onChange={(e) => setLangtext(e.target.value)} /></div>
            </div>
          ) : (
            <div>
              {p.ansatz?.bereich && <div className="text-[11px] text-hell mb-1">{p.ansatz.bereich}</div>}
              <p className="text-[13px] whitespace-pre-line leading-relaxed max-h-56 overflow-y-auto rounded-lg bg-papier p-3">{p.langtext || p.kurztext}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">Menge</label><ZahlFeld wert={menge} stellen={3} onWert={setMenge} /></div>
            <div><label className="label">Einheit</label><input className="eingabe" value={einheit} onChange={(e) => setEinheit(e.target.value)} /></div>
          </div>

          {p.begruendung && (
            <div className="rounded-lg border border-tiefblau/20 bg-blau-hell/50 p-3">
              <div className="text-[12px] font-medium schmal text-tiefblau font-medium mb-1">Vorschlag der KI {p.sicherheit !== null ? `· Sicherheit ${Math.round((p.sicherheit ?? 0) * 100)} %` : ''}</div>
              <p className="text-[13px] leading-relaxed">{p.begruendung}</p>
            </div>
          )}
          {pruefePosition(p).length > 0 && (
            <div className="rounded-lg bg-gelb-hell p-3 text-[13px] text-gelb space-y-1">
              {pruefePosition(p).map((f, i) => <div key={i}>{f.stufe === 'warnung' ? '⚠ ' : ''}{f.text}</div>)}
            </div>
          )}
          {p.ansatz?.gleich_wie && <div className="text-[12px] text-grau">Gleiche Leistung wie OZ {p.ansatz.gleich_wie}, Ansatz übernommen.</div>}
          {!fremd && <ArchivListe p={p} onUebernehmen={(ep) => setAnsatz({ ...ansatz, ep_hand: ep })} darfSchreiben={darfSchreiben} />}
          {fremd && (
            <div className="rounded-lg bg-gelb-hell p-3 text-[13px] text-gelb">
              Als Fremdgewerk erkannt, zählt nicht zur Summe. Wenn Sie die Leistung doch anbieten: unten einen Ansatz wählen und freigeben.
            </div>
          )}

          <AnsatzEditor ansatz={ansatz} onAnsatz={setAnsatz} />

          <div className="rounded-lg border border-linie">
            <div className="px-3 py-2 text-[12px] font-medium schmal text-hell border-b border-linie">Rechenweg je Einheit</div>
            {istBe ? (
              <p className="px-3 py-2 text-[13px] text-grau">Prozentsatz der übrigen Summe, wird nach dem Speichern aktualisiert.</p>
            ) : vorschau.bausteine.length ? (
              <table className="w-full text-[13px]">
                <tbody>
                  {vorschau.bausteine.map((b, i) => (
                    <tr key={i} className="border-b border-linie last:border-0"><td className="px-3 py-1.5">{b.text}</td><td className="px-3 py-1.5 text-right zahl whitespace-nowrap">{euro(b.betrag)}</td></tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="px-3 py-2 text-[13px] text-grau">{vorschau.hinweise.join(' ') || 'Noch kein Preis.'}</p>
            )}
            {vorschau.hinweise.length > 0 && vorschau.bausteine.length > 0 && <p className="px-3 py-2 text-[12px] text-hell border-t border-linie">{vorschau.hinweise.join(' · ')}</p>}
            <div className="px-3 py-2 border-t border-linie flex justify-between font-semibold text-[14px] bg-papier">
              <span>Einzelpreis{vorschau.ep !== null && menge ? ` · Gesamt ${euro(vorschau.ep * menge)}` : ''}</span>
              <span className="zahl">{istBe ? '–' : euro(vorschau.ep)}</span>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
            <div>
              <label className="label">Einzelpreis überschreiben (optional)</label>
              <ZahlFeld wert={ansatz.ep_hand ?? null} platzhalter="nach Ansatz" onWert={(v) => setAnsatz({ ...ansatz, ep_hand: v })} />
            </div>
            {ansatz.ep_hand !== null && ansatz.ep_hand !== undefined && <button className="knopf-leise knopf-klein" onClick={() => setAnsatz({ ...ansatz, ep_hand: null })}>zurück</button>}
          </div>
          <div>
            <label className="label">Grund der Änderung (optional, hilft beim Lernen)</label>
            <input className="eingabe" value={grund} onChange={(e) => setGrund(e.target.value)} placeholder="z. B. Montage über Kopf, Zugang schwierig" />
          </div>

          {darfSchreiben && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-linie">
              <button className="knopf-primaer" onClick={async () => { await onSpeichern(patch('freigegeben'), grund || undefined); onSchliessen(); }} disabled={vorschau.ep === null && !istBe}>Speichern und freigeben</button>
              <button className="knopf-zweit" onClick={async () => { await onSpeichern(patch(p.status === 'offen' && ansatz.art ? 'berechnet' : p.status === 'freigegeben' ? 'pruefen' : undefined), grund || undefined); }}>Nur speichern</button>
              {modus === 'lv' && <button className="knopf-leise" disabled={laeuft} onClick={onKalkulieren}>Gründlich neu vorschlagen</button>}
              <button
                className="knopf-leise"
                onClick={() =>
                  p.ansatz?.ausgeblendet || fremd
                    ? onSpeichern({ ansatz: { ...ansatz, ausgeblendet: false }, typ: ansatz.art ?? null })
                    : onSpeichern({ ansatz: { ...ansatz, ausgeblendet: true }, typ: 'fremd' })
                }
              >
                {p.ansatz?.ausgeblendet || fremd ? 'Wieder einrechnen' : 'Nicht anbieten'}
              </button>
              <button className="knopf-leise text-rot ml-auto" onClick={onLoeschen}>Löschen</button>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function ArchivListe({ p, onUebernehmen, darfSchreiben }: { p: Position; onUebernehmen: (ep: number) => void; darfSchreiben: boolean }) {
  const [treffer, setTreffer] = useState<ArchivTreffer[] | null>(p.ansatz?.archiv?.length ? p.ansatz.archiv : null);
  const [laedt, setLaedt] = useState(false);
  async function suchen() {
    setLaedt(true);
    const r = await fetch(`/api/archiv/aehnlich?position_id=${p.id}`).then((x) => x.json()).catch(() => ({ treffer: [] }));
    setTreffer(r.treffer ?? []);
    setLaedt(false);
  }
  return (
    <div className="rounded-lg border border-linie">
      <div className="px-3 py-2 text-[12px] font-medium schmal text-hell border-b border-linie flex items-center">
        Ähnlich aus Ihren Angeboten
        {!treffer && <button className="ml-auto knopf-leise knopf-klein" onClick={suchen} disabled={laedt}>{laedt ? 'Suche …' : 'Archiv durchsuchen'}</button>}
      </div>
      {treffer && treffer.length === 0 && <p className="px-3 py-2 text-[13px] text-grau">Keine ähnliche Position im Archiv.</p>}
      {treffer && treffer.length > 0 && (
        <table className="w-full text-[12px]">
          <tbody>
            {treffer.map((t, i) => (
              <tr key={i} className="border-b border-linie last:border-0 align-top">
                <td className="px-3 py-1.5"><div className="line-clamp-2">{t.text}</div><div className="text-hell">{t.projekt}{t.datum ? ` · ${t.datum.slice(0, 4)}` : ''} · Ähnlichkeit {Math.round(t.aehnlichkeit * 100)} %</div></td>
                <td className="px-3 py-1.5 text-right zahl whitespace-nowrap">{euro(t.ep)}{t.einheit ? <span className="text-hell"> /{t.einheit}</span> : null}
                  {t.ep !== null && t.kg_je_einheit ? <div className="text-hell">{(t.ep / t.kg_je_einheit).toFixed(2).replace('.', ',')} €/kg</div> : null}
                  {darfSchreiben && t.ep !== null && <div><button className="knopf-leise knopf-klein" onClick={() => onUebernehmen(t.ep!)}>übernehmen</button></div>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
