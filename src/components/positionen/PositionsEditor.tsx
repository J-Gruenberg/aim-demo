'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { CircleCheck, Download, FileStack, FileText, MoreHorizontal, RefreshCw, ScanLine, Trash2, TriangleAlert, Upload } from 'lucide-react';
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
  offen: { label: 'Offen', text: 'text-ink-600', punkt: 'bg-ink-300' },
  berechnet: { label: 'Berechnet', text: 'text-brand-strong', punkt: 'bg-brand' },
  pruefen: { label: 'Prüfen', text: 'text-check', punkt: 'bg-check-dot' },
  freigegeben: { label: 'Freigegeben', text: 'text-ok', punkt: 'bg-ok-dot' },
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
  const [schritt, setSchritt] = useState<string | null>(null);
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

  async function lesen(d: Datei, still = false): Promise<number> {
    // GAEB wird komplett neu eingelesen: vorher fragen, sonst sind Kalkulation und Freigaben weg
    const ausGaeb = pos.filter((p) => (p.quelle ?? '').startsWith(`gaeb:${d.id}:`)).length;
    if (ausGaeb && !still && !confirm(`Diese GAEB-Datei ist schon gelesen. Neu lesen ersetzt alle ${ausGaeb} Positionen daraus, samt Kalkulation und Freigaben. Wirklich neu lesen?`)) return 0;
    let ab: number | null = 1;
    // Schon gelesen? Dann hinter der letzten gelesenen Seite weitermachen statt doppelt einzulesen
    const gelesen = pos.map((p) => p.quelle ?? '').filter((q) => q.startsWith(`pdf:${d.id}:`)).map((q) => Number(q.split(':')[2]) || 0);
    if (gelesen.length) {
      const bis = Math.max(...gelesen);
      if (still || !confirm(`Aus dieser Datei sind schon ${gelesen.length} Positionen bis Seite ${bis} gelesen. Ab Seite ${bis + 1} weiterlesen?`)) return 0;
      ab = bis + 1;
    }
    let neuGesamt = 0;
    while (ab !== null) {
      setLaeuft(`Lese ${d.name}${ab > 1 ? `, ab Seite ${ab}` : ''} …`);
      setLiestId(d.id);
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
    setLiestId(null);
    if (!still) {
      setLaeuft(null);
      if (neuGesamt) zeige(true, `${neuGesamt} Positionen erkannt. Jetzt kalkulieren lassen.`);
    }
    return neuGesamt;
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
    if (neuGesamt) await summeSpeichern(await neuLaden());
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

  async function kalkulieren(nur?: string[], gruendlich = false, still = false): Promise<number> {
    const ziel = (nur ?? pos.filter((p) => p.status === 'offen' && !p.ansatz?.ausgeblendet).map((p) => p.id));
    if (!ziel.length) {
      if (!still) zeige(true, 'Keine offenen Positionen.');
      return 0;
    }
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
    if (!still) {
      setLaeuft(null);
      if (fertig) zeige(true, `${fertig} Positionen kalkuliert. Gelb markierte bitte prüfen.`);
    }
    return fertig;
  }

  /**
   * Unterlagen ablegen und AIM macht den Rest: hochladen, das LV genau einmal lesen
   * (GAEB vor PDF, ohne LV die Pläne), Vorbemerkungen lesen, alle offenen Positionen kalkulieren.
   */
  async function ablegen(files: FileList | File[]) {
    const neu = await hochladen(files);
    if (!neu.length || !darfSchreiben) return;
    await automatisch(neu);
  }

  /** Liest und kalkuliert die übergebenen Unterlagen von selbst (siehe ablegen). */
  async function automatisch(neu: Datei[]) {
    try {
      if (modus === 'zeichnung') {
        const z = neu.filter((d) => d.art === 'zeichnung');
        let n = 0;
        for (const [i, d] of z.entries()) {
          setSchritt(z.length > 1 ? `Zeichnung ${i + 1} von ${z.length}` : 'Zeichnung wird gelesen und kalkuliert');
          n += await zeichnungLesen(d, true);
        }
        if (z.length) zeige(true, `${z.length} ${z.length === 1 ? 'Zeichnung' : 'Zeichnungen'} gelesen, ${n} Positionen kalkuliert. Gelb markierte bitte prüfen.`);
        return;
      }
      if (modus !== 'lv') return;

      const { data: dl } = await sb.from('dateien').select('*').eq('projekt_id', projekt.id);
      const alle = (dl ?? []) as Datei[];
      const vorher = await neuLaden();
      const istNeu = (d: Datei) => neu.some((x) => x.id === d.id);
      const gaeb = alle.filter((d) => d.art === 'gaeb');
      const lvPdf = alle.filter((d) => d.art === 'lv');

      // Welche Datei liefert die Positionen? Immer nur eine Quelle, damit nichts doppelt kommt.
      let quelle: Datei[] = [];
      if (!vorher.length) {
        if (gaeb.length) quelle = [gaeb.find(istNeu) ?? gaeb[0]];
        else if (lvPdf.length) quelle = [lvPdf.find(istNeu) ?? lvPdf[0]];
        else {
          const pdfs = alle.filter((d) => /\.pdf$/i.test(d.name) && (d.art === 'plan' || d.art === 'sonstiges'));
          const kandidat = pdfs.find((d) => /(leistung|ausschreib|positionen|angebot|lv)/i.test(d.name)) ?? [...pdfs].filter((d) => (d.groesse ?? 0) < 3_000_000).sort((a, b) => (a.groesse ?? 0) - (b.groesse ?? 0))[0];
          if (kandidat) {
            await dateiArt(kandidat, 'lv');
            quelle = [{ ...kandidat, art: 'lv' }];
          } else quelle = alle.filter((d) => d.art === 'plan');
        }
      } else {
        const neuGaeb = neu.filter((d) => d.art === 'gaeb');
        quelle = neuGaeb.length ? neuGaeb : neu.filter((d) => d.art === 'lv');
      }

      const schritte = (quelle.length ? 1 : 0) + 1;
      let nr = 0;
      let gelesen = 0;
      for (const d of quelle) {
        nr = 1;
        setSchritt(`Schritt 1 von ${schritte}: ${d.art === 'plan' ? 'Positionen aus den Plänen' : 'Leistungsverzeichnis'} wird gelesen`);
        gelesen += await lesen(d, true);
      }
      for (const d of neu.filter((x) => x.art === 'baubeschreibung')) {
        setSchritt('Vorbemerkungen werden gelesen');
        await lesen(d, true);
      }
      const liste = await neuLaden();
      const offen = liste.filter((p) => p.status === 'offen' && !p.ansatz?.ausgeblendet).map((p) => p.id);
      if (offen.length) {
        setSchritt(`Schritt ${nr + 1} von ${schritte}: Preise werden kalkuliert`);
        await kalkulieren(offen, false, true);
      }
      const ende = await neuLaden();
      const zuPruefen = ende.filter((p) => p.status === 'pruefen').length;
      if (gelesen || offen.length) zeige(true, `Fertig: ${ende.length} Positionen gelesen und kalkuliert${zuPruefen ? `, ${zuPruefen} davon bitte prüfen (gelb markiert)` : ''}.`);
    } finally {
      setSchritt(null);
      setLaeuft(null);
    }
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

  const kzHero: { label: string; wert: string; sub?: string; warn?: boolean }[] =
    modus === 'zeichnung'
      ? [
          { label: 'Stahlgewicht', wert: `${zahl(zk.kg, 0)} kg`, sub: `${zahl(zk.teile, 0)} Teile` },
          { label: 'Fertigung', wert: `${zahl(zk.h, 1)} h`, sub: zk.kg > 0 ? `${zahl((zk.h / zk.kg) * 1000, 1)} h je Tonne` : 'aus den Arbeitsgängen' },
          { label: 'Preis je kg', wert: zk.kg > 0 ? `${zahl(s.gesamt / zk.kg, 2)} €` : '–', sub: 'Summe durch Gewicht' },
          { label: 'KI-Kosten', wert: euro(kiKosten), sub: `Budget ${euro(projekt.ki_budget_eur, true)}` },
        ]
      : [
          { label: 'Positionen', wert: `${s.anzahl}`, sub: `${s.frei} freigegeben` },
          { label: 'Zu prüfen', wert: `${s.pruefen}`, sub: s.offen ? `${s.offen} noch offen` : 'alle kalkuliert' },
          { label: 'Fremdgewerke', wert: `${s.fremd}`, sub: 'nicht in der Summe' },
          { label: 'KI-Kosten', wert: euro(kiKosten), sub: `Budget ${euro(projekt.ki_budget_eur, true)}` },
        ];

  return (
    <div className="flex flex-col gap-7">
      <ProjektKopf
        meta={meta}
        onMeta={metaSpeichern}
        art={modus === 'lv' ? 'Ausschreibung' : modus === 'zeichnung' ? 'Nach Zeichnung' : 'Treppe, Geländer, Stahlbau'}
        stand={metaStand}
        gesperrt={!darfSchreiben}
        kennzahlen={
          <section aria-label="Summe und Kennzahlen" className="aim-hero grid min-w-0 gap-6 px-5 py-6 sm:px-8 sm:py-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:px-9">
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-white/75">Summe netto</p>
              <p className="mt-1 text-[44px] font-extrabold leading-none tracking-[-0.03em] sm:text-[56px]">{euro(s.gesamt, true)}</p>
              <p className="mt-3 text-[16px] text-white/85 sm:text-[18px] [&_b]:font-bold [&_b]:text-white">
                {!s.anzahl ? (
                  modus === 'zeichnung' ? 'Noch keine Positionen. Legen Sie unten Zeichnungen ab.' : 'Noch keine Positionen.'
                ) : (
                  <>
                    <b>{s.anzahl}</b> {s.anzahl === 1 ? 'Position' : 'Positionen'}
                    {s.pruefen ? <>, <b>{s.pruefen}</b> {s.pruefen === 1 ? 'wartet' : 'warten'} auf Ihre Prüfung.</> : ', alles geprüft.'}
                    {s.freigegeben > 0 && <> Freigegeben: <b>{euro(s.freigegeben, true)}</b>.</>}
                  </>
                )}
              </p>
              <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-white/20 pt-5 sm:grid-cols-4">
                {kzHero.map((k) => (
                  <div key={k.label} className="min-w-0">
                    <dt className="text-[13px] text-white/70">{k.label}</dt>
                    <dd className="mt-0.5 text-[22px] font-extrabold leading-tight tracking-[-0.015em]">{k.wert}</dd>
                    {k.sub && <dd className="truncate text-[12px] text-white/65">{k.sub}</dd>}
                  </div>
                ))}
              </dl>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:flex-col lg:items-stretch">
              <Link href={`/${modus}/${projekt.id}/angebot`} className="knopf-hell knopf-gross">
                <FileText className="size-[18px]" strokeWidth={1.75} aria-hidden /> Angebot ansehen
              </Link>
              <a href={`/api/projekt/${projekt.id}/excel`} className="knopf-hell-rand knopf-gross">
                <Download className="size-[18px]" strokeWidth={1.75} aria-hidden /> Als Excel
              </a>
              {hatGaeb && (
                <a
                  href={`/api/lv/${projekt.id}/x84`}
                  className="knopf-hell-rand knopf-gross"
                  title="Nur freigegebene Positionen erhalten einen Preis"
                  onClick={(e) => {
                    const ohne = pos.filter((p) => zaehlt(p) && p.status !== 'freigegeben').length;
                    if (ohne && !confirm(`${ohne} ${ohne === 1 ? 'Position ist' : 'Positionen sind'} noch nicht freigegeben und ${ohne === 1 ? 'bleibt' : 'bleiben'} in der X84 ohne Preis. Trotzdem exportieren?`)) e.preventDefault();
                  }}
                >
                  GAEB X84
                </a>
              )}
            </div>
          </section>
        }
      />

      {meldung && (
        <div role="status" className={`flex items-center gap-2.5 rounded-2xl px-4 py-3 text-[14px] font-semibold ${meldung.ok ? 'bg-ok-tint text-ok' : 'bg-signal-tint text-signal'}`}>
          {meldung.ok ? <CircleCheck className="size-[18px] shrink-0" strokeWidth={1.75} aria-hidden /> : <TriangleAlert className="size-[18px] shrink-0" strokeWidth={1.75} aria-hidden />}
          {meldung.text}
        </div>
      )}
      {laeuft && (
        <div role="status" className="flex items-start gap-3 rounded-2xl bg-brand-tint px-5 py-4 text-brand-strong">
          <span className="mt-0.5 size-5 shrink-0 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          <span className="min-w-0">
            {schritt && <span className="block text-[15px] font-bold">{schritt}</span>}
            <span className={`block ${schritt ? 'text-[13px] font-medium text-brand-strong/80' : 'text-[14px] font-semibold'}`}>{laeuft}</span>
            {schritt && <span className="mt-1 block text-[12px] text-brand-strong/70">AIM arbeitet von selbst weiter. Lassen Sie diese Seite bitte geöffnet, bis es fertig ist.</span>}
          </span>
        </div>
      )}

      {modus === 'zeichnung' && (
        <section
          aria-labelledby="zng"
          className="flex min-w-0 flex-col gap-3"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files.length) ablegen(e.dataTransfer.files);
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="zng" className="flex items-center gap-2 text-[18px] font-bold tracking-[-0.01em]">
              Zeichnungen
              {dateien.length > 0 && <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-sunken px-2 font-mono text-[12px] font-medium text-ink-600">{dateien.length}</span>}
            </h2>
            {darfSchreiben && (
              <div className="flex flex-wrap gap-2">
                <input ref={dateiInput} type="file" multiple className="hidden" accept=".pdf,.png,.jpg,.jpeg,.PDF,.PNG,.JPG,.JPEG" onChange={(e) => { if (e.target.files) ablegen(e.target.files); e.target.value = ''; }} />
                {dateien.length > 0 && (
                  <button className="knopf-zweit" onClick={() => dateiInput.current?.click()} disabled={!!laeuft}>
                    <Upload className="size-4" strokeWidth={1.75} aria-hidden /> Hinzufügen
                  </button>
                )}
                {dateien.some((d) => d.art === 'zeichnung' && !pos.some((p) => (p.quelle ?? '').startsWith(`zng:${d.id}:`))) && (
                  <button className="knopf-primaer" onClick={alleZeichnungenLesen} disabled={!!laeuft}>
                    <ScanLine className="size-4" strokeWidth={1.75} aria-hidden /> Alle lesen und kalkulieren
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {dateien.map((d) => {
              const aus = pos.filter((p) => (p.quelle ?? '').startsWith(`zng:${d.id}:`));
              const n = aus.length;
              const nummer = (aus[0]?.ansatz as { zeichnung?: string } | null)?.zeichnung;
              const liest = liestId === d.id;
              return (
                <article key={d.id} className="karte flex flex-col overflow-hidden">
                  <button type="button" className={`relative aspect-[1.414] border-b border-line bg-white ${liest ? 'abtasten' : ''}`} onClick={() => dateiOeffnen(d)} title="Zeichnung öffnen">
                    {vorschau[d.id] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={vorschau[d.id]} alt={`Vorschau ${d.name}`} className="absolute inset-0 h-full w-full object-contain p-2" />
                    ) : (
                      <BlattPlatzhalter />
                    )}
                    {n > 0 && <span className="marke absolute left-3 top-3 h-[22px] bg-brand px-2 text-[11px] text-white">{n} {n === 1 ? 'Position' : 'Positionen'}</span>}
                  </button>
                  <div className="flex flex-1 flex-col gap-3 p-4">
                    <div className="min-w-0">
                      <div className="truncate text-[15px] font-bold text-ink-950">{nummer ?? d.name}</div>
                      <div className="truncate text-[12px] text-ink-500">{nummer ? `${d.name}, ` : ''}{groesse(d.groesse)}{d.seiten ? `, ${d.seiten} ${d.seiten === 1 ? 'Blatt' : 'Blätter'}` : ''}</div>
                    </div>
                    <div className="mt-auto flex items-center gap-1">
                      {liest ? (
                        <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-brand-strong"><span className="puls size-2 rounded-full bg-brand" />Wird gelesen</span>
                      ) : n ? (
                        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ok"><span className="size-2 rounded-full bg-ok-dot" />Gelesen</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-600"><span className="size-2 rounded-full bg-ink-300" />Noch nicht gelesen</span>
                      )}
                      <span className="ml-auto" />
                      {darfSchreiben && d.art === 'zeichnung' && !liest && (
                        <button className={n ? 'knopf-leise knopf-klein' : 'knopf-blau knopf-klein'} disabled={!!laeuft} onClick={() => zeichnungLesen(d)}>{n ? 'Neu lesen' : 'Lesen'}</button>
                      )}
                      {darfSchreiben && !liest && (
                        <button className="grid size-8 place-items-center rounded-full text-ink-500 hover:bg-[var(--bg-hover)] hover:text-signal" disabled={!!laeuft} onClick={() => dateiLoeschen(d)} aria-label={`${d.name} entfernen`} title="Entfernen">
                          <Trash2 className="size-4" strokeWidth={1.75} aria-hidden />
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
            {darfSchreiben && (
              <button
                type="button"
                className="flex min-h-[250px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-line-strong bg-surface/60 p-6 text-center transition-colors hover:border-brand hover:bg-brand-tint/40"
                onClick={() => dateiInput.current?.click()}
                disabled={!!laeuft}
              >
                <span className="grid size-12 place-items-center rounded-full bg-brand-tint text-brand-strong"><Upload className="size-5" strokeWidth={1.75} aria-hidden /></span>
                <span className="text-[16px] font-bold text-ink-950">Zeichnungen ablegen</span>
                <span className="text-[14px] text-ink-600">PDF, Scan oder Foto hierher ziehen<br />oder klicken. Mehrere gehen auf einmal.</span>
              </button>
            )}
            {darfSchreiben && dateien.length === 0 && (
              <button
                type="button"
                className="flex min-h-[250px] flex-col items-start justify-between gap-4 rounded-2xl border border-brand-tint-2 p-6 text-left transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[var(--shadow-float)]"
                style={{ background: 'var(--brand-gradient-soft)' }}
                disabled={!!laeuft}
                onClick={beispieleLaden}
              >
                <span className="grid size-12 place-items-center rounded-full bg-white text-brand-strong shadow-[var(--shadow-card)]"><FileStack className="size-5" strokeWidth={1.75} aria-hidden /></span>
                <span>
                  <span className="block text-[18px] font-extrabold leading-tight tracking-[-0.01em] text-ink-950">Mit Beispielzeichnungen ausprobieren</span>
                  <span className="mt-1.5 block text-[14px] text-ink-600">Stütze, Träger und Konsole. AIM liest alle drei und kalkuliert, in rund zwei Minuten.</span>
                </span>
                <span className="knopf-primaer knopf-klein pointer-events-none">Beispiel laden</span>
              </button>
            )}
          </div>
          {hinweise.length > 0 && (
            <details className="karte px-5 py-3.5">
              <summary className="cursor-pointer text-[14px] font-bold text-ink-950">Hinweise aus den Zeichnungen ({hinweise.length})</summary>
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[13px] text-ink-600">{hinweise.map((h) => <li key={h}>{h}</li>)}</ul>
            </details>
          )}
        </section>
      )}

      {modus === 'lv' && (
        <section
          aria-labelledby="unterlagen"
          className="flex min-w-0 flex-col gap-3"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files.length) ablegen(e.dataTransfer.files);
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="unterlagen" className="flex items-center gap-2 text-[18px] font-bold tracking-[-0.01em]">
              Unterlagen
              {dateien.length > 0 && <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-sunken px-2 font-mono text-[12px] font-medium text-ink-600">{dateien.length}</span>}
            </h2>
            {darfSchreiben && (
              <>
                <input ref={dateiInput} type="file" multiple className="hidden" accept=".pdf,.x83,.x81,.x86,.X83,.X81,.X86,.d83,.D83,.p83,.P83" onChange={(e) => { if (e.target.files) ablegen(e.target.files); e.target.value = ''; }} />
                {dateien.length > 0 && (
                  <button className="knopf-zweit" onClick={() => dateiInput.current?.click()} disabled={!!laeuft}>
                    <Upload className="size-4" strokeWidth={1.75} aria-hidden /> Hinzufügen
                  </button>
                )}
              </>
            )}
          </div>

          {dateien.length === 0 && darfSchreiben && (
            <button
              type="button"
              className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-line-strong bg-surface/60 p-8 text-center transition-colors hover:border-brand hover:bg-brand-tint/40"
              onClick={() => dateiInput.current?.click()}
              disabled={!!laeuft}
            >
              <span className="grid size-12 place-items-center rounded-full bg-brand-tint text-brand-strong"><Upload className="size-5" strokeWidth={1.75} aria-hidden /></span>
              <span className="text-[18px] font-bold text-ink-950">Ausschreibung hier ablegen</span>
              <span className="max-w-[52ch] text-[14px] text-ink-600">Leistungsverzeichnis als GAEB oder PDF, gern mit Plänen und Baubeschreibung. Alles auf einmal hineinziehen, AIM liest und kalkuliert dann von selbst.</span>
            </button>
          )}

          {modus === 'lv' && darfSchreiben && dateien.length > 0 && pos.length === 0 && !laeuft && (
            <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-brand-tint-2 px-5 py-4" style={{ background: 'var(--brand-gradient-soft)' }}>
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-bold text-ink-950">Unterlagen liegen bereit</p>
                <p className="text-[14px] text-ink-600">AIM liest das Leistungsverzeichnis und kalkuliert alle Positionen in einem Durchgang.</p>
              </div>
              <button className="knopf-primaer knopf-gross" onClick={() => automatisch(dateien)}>
                <ScanLine className="size-[18px]" strokeWidth={1.75} aria-hidden /> Lesen und kalkulieren
              </button>
            </div>
          )}

          {dateien.length > 0 && (
            <div className="karte divide-y divide-line">
              {dateien.map((d) => {
                const n = pos.filter((p) => { const q = p.quelle ?? ''; return q.startsWith(`gaeb:${d.id}:`) || q.startsWith(`pdf:${d.id}:`); }).length;
                const liest = liestId === d.id;
                const gaebDa = dateien.some((x) => x.art === 'gaeb');
                const ART: Record<Datei['art'], string> = { gaeb: 'Leistungsverzeichnis (GAEB)', lv: 'Leistungsverzeichnis (PDF)', plan: 'Plan', baubeschreibung: 'Baubeschreibung', zeichnung: 'Zeichnung', sonstiges: 'Sonstiges' };
                const stand = liest
                  ? { text: 'Wird gelesen', ton: 'text-brand-strong', punkt: 'puls bg-brand' }
                  : n
                    ? { text: `Gelesen, ${n} ${n === 1 ? 'Position' : 'Positionen'}`, ton: 'text-ok', punkt: 'bg-ok-dot' }
                    : d.art === 'lv' && gaebDa
                      ? { text: 'Nicht nötig, das LV kommt aus der GAEB-Datei', ton: 'text-ink-500', punkt: 'bg-ink-300' }
                      : d.art === 'plan'
                        ? { text: 'Als Plan hinterlegt', ton: 'text-ink-600', punkt: 'bg-label-sky-fg/40' }
                        : d.art === 'baubeschreibung'
                          ? { text: 'Vorbemerkungen', ton: 'text-ink-600', punkt: 'bg-ink-300' }
                          : { text: 'Noch nicht gelesen', ton: 'text-ink-600', punkt: 'bg-ink-300' };
                return (
                  <div key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                    <div className="min-w-0 flex-1 basis-[260px]">
                      <button className="block max-w-full truncate text-left text-[14px] font-bold text-ink-950 hover:text-brand-strong" onClick={() => dateiOeffnen(d)}>{d.name}</button>
                      <div className="flex flex-wrap items-center gap-x-3 text-[12px] text-ink-500">
                        <span>{ART[d.art]}</span>
                        <span>{groesse(d.groesse)}{d.seiten ? `, ${d.seiten} Seiten` : ''}</span>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-2 text-[13px] font-semibold ${stand.ton}`}><span className={`size-2 rounded-full ${stand.punkt}`} />{stand.text}</span>
                    {darfSchreiben && !liest && (
                      <details className="relative">
                        <summary className="grid size-8 cursor-pointer list-none place-items-center rounded-full text-ink-500 hover:bg-[var(--bg-hover)] [&::-webkit-details-marker]:hidden" aria-label="Mehr">
                          <MoreHorizontal className="size-4" strokeWidth={1.75} aria-hidden />
                        </summary>
                        <div className="absolute right-0 top-full z-30 mt-1 w-64 rounded-2xl border border-line bg-surface p-2 shadow-[var(--shadow-float)]">
                          <label className="label px-1">Art der Datei</label>
                          <select className="eingabe eingabe-klein" value={d.art} onChange={(e) => dateiArt(d, e.target.value as Datei['art'])}>
                            <option value="gaeb">Leistungsverzeichnis (GAEB)</option>
                            <option value="lv">Leistungsverzeichnis (PDF)</option>
                            <option value="plan">Plan</option>
                            <option value="baubeschreibung">Baubeschreibung</option>
                            <option value="sonstiges">Sonstiges</option>
                          </select>
                          {(d.art === 'lv' || d.art === 'gaeb' || d.art === 'baubeschreibung' || d.art === 'plan') && (
                            <button className="mt-2 flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-[14px] font-semibold hover:bg-[var(--bg-hover)]" disabled={!!laeuft} onClick={() => lesen(d)}>
                              <RefreshCw className="size-4 text-ink-500" strokeWidth={1.75} aria-hidden />
                              {d.art === 'baubeschreibung' ? 'Vorbemerkungen lesen' : d.art === 'plan' ? 'Positionen aus diesem Plan lesen' : n ? 'Neu lesen' : 'Positionen lesen'}
                            </button>
                          )}
                          <button className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-[14px] font-semibold text-signal hover:bg-signal-tint" onClick={() => dateiLoeschen(d)}>
                            <Trash2 className="size-4" strokeWidth={1.75} aria-hidden /> Entfernen
                          </button>
                        </div>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {hinweise.length > 0 && (
            <details className="karte px-5 py-3.5">
              <summary className="cursor-pointer text-[14px] font-bold text-ink-950">Hinweise aus den Vorbemerkungen ({hinweise.length})</summary>
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[13px] text-ink-600">{hinweise.map((h) => <li key={h}>{h}</li>)}</ul>
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
                <div className="rounded-xl border border-linie p-3 space-y-2 text-[13px]">
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

      <section aria-labelledby="pos" className="flex min-w-0 flex-col gap-3">
        <h2 id="pos" className="flex items-center gap-2 text-[18px] font-bold tracking-[-0.01em]">
          Positionen
          {pos.length > 0 && <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-brand px-2 font-mono text-[12px] font-medium text-white">{pos.length}</span>}
        </h2>
        <div className="karte overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
          <div className="flex rounded-full bg-sunken p-1 text-[13px]" role="tablist" aria-label="Positionen filtern">
            {(
              [
                ['alle', `Alle ${pos.length}`],
                ['pruefen', `Prüfen ${s.pruefen}`],
                ['offen', `Offen ${s.offen}`],
                ['freigegeben', `Freigegeben ${s.frei}`],
                ['fremd', `Fremd ${s.fremd}`],
              ] as [Filter, string][]
            ).map(([f, l]) => (
              <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} className={`h-8 whitespace-nowrap rounded-full px-3.5 font-semibold transition-colors ${filter === f ? 'bg-surface text-ink-950 shadow-[0_1px_3px_rgba(15,28,26,0.12)]' : 'text-ink-600 hover:text-ink-950'}`}>{l}</button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-600"><input type="checkbox" className="accent-[var(--brand)]" checked={unsicherZuerst} onChange={(e) => setUnsicherZuerst(e.target.checked)} /> unsichere zuerst</label>
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
          <div className="px-6 py-12 text-center text-[15px] text-ink-600">
            {modus === 'lv'
              ? 'Noch keine Positionen. Legen Sie oben die Ausschreibung ab, AIM liest und kalkuliert dann von selbst.'
              : modus === 'zeichnung'
                ? 'Noch keine Positionen. Legen Sie oben Zeichnungen ab, AIM liest und kalkuliert dann von selbst.'
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
                  <th className="w-36">Status</th>
                </tr>
              </thead>
              <tbody>
                {sichtbar.map((p) => {
                  const fremd = p.typ === 'fremd' || p.ansatz?.ausgeblendet;
                  return (
                    <tr key={p.id} className={`cursor-pointer hover:bg-[var(--bg-hover)] ${fremd ? 'opacity-50' : ''} ${offenId === p.id ? 'bg-brand-tint/50' : ''}`} onClick={() => setOffenId(p.id)}>
                      <td className="whitespace-nowrap">{modus === 'lv' ? <span className="zahl text-[13px] text-grau">{p.oz}</span> : <span className="ballon">{p.oz}</span>}</td>
                      <td>
                        <div className="line-clamp-2 text-[15px] font-bold text-ink-950">{p.kurztext}</div>
                        <div className="mt-0.5 flex flex-wrap gap-x-2 text-[13px] text-ink-500">
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
                        {pruefePosition(p).some((f) => f.stufe === 'warnung') && <TriangleAlert className="ml-1 inline size-3.5 text-check" strokeWidth={2} aria-label={pruefePosition(p).map((f) => f.text).join(' ')} />}
                        {p.sicherheit !== null && p.status !== 'offen' && p.quelle !== 'hand' && <div className="mt-0.5 whitespace-nowrap text-[12px] text-ink-500">Sicherheit {Math.round((p.sicherheit ?? 0) * 100)} %</div>}
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
      {a.zeichnung ? `${a.zeichnung}, ` : ''}
      {zahl(r.kennzahlen.kg, 1)} kg, {zahl(r.kennzahlen.teile, 0)} Teile, {zahl(r.kennzahlen.stunden, 1)} h je Stück
    </span>
  );
}

/** Leeres Zeichnungsblatt mit Rahmen und Schriftfeld, solange es noch kein Vorschaubild gibt. */
function BlattPlatzhalter() {
  return (
    <svg className="absolute inset-0 h-full w-full bg-sunken" viewBox="0 0 297 210" preserveAspectRatio="xMidYMid meet" aria-hidden>
      <rect x="14" y="12" width="269" height="186" rx="3" fill="#fff" stroke="#CBD5D2" strokeWidth="0.8" />
      <rect x="187" y="163" width="92" height="31" fill="none" stroke="#CBD5D2" strokeWidth="0.8" />
      <path d="M187 174 H279 M187 184 H279 M225 163 V194" stroke="#D3DBD8" strokeWidth="0.6" />
      <path d="M50 70 H160 M50 80 H160" stroke="#B4C0BC" strokeWidth="1.4" strokeLinecap="round" />
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
              <p className="text-[13px] whitespace-pre-line leading-relaxed max-h-56 overflow-y-auto rounded-xl bg-papier p-3">{p.langtext || p.kurztext}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">Menge</label><ZahlFeld wert={menge} stellen={3} onWert={setMenge} /></div>
            <div><label className="label">Einheit</label><input className="eingabe" value={einheit} onChange={(e) => setEinheit(e.target.value)} /></div>
          </div>

          {p.begruendung && (
            <div className="rounded-xl border border-tiefblau/20 bg-blau-hell/50 p-3">
              <div className="text-[12px] font-medium schmal text-tiefblau font-medium mb-1">Vorschlag der KI {p.sicherheit !== null ? `· Sicherheit ${Math.round((p.sicherheit ?? 0) * 100)} %` : ''}</div>
              <p className="text-[13px] leading-relaxed">{p.begruendung}</p>
            </div>
          )}
          {pruefePosition(p).length > 0 && (
            <div className="rounded-xl bg-gelb-hell p-3 text-[13px] text-gelb space-y-1">
              {pruefePosition(p).map((f, i) => <div key={i}>{f.stufe === 'warnung' ? '⚠ ' : ''}{f.text}</div>)}
            </div>
          )}
          {p.ansatz?.gleich_wie && <div className="text-[12px] text-grau">Gleiche Leistung wie OZ {p.ansatz.gleich_wie}, Ansatz übernommen.</div>}
          {!fremd && <ArchivListe p={p} onUebernehmen={(ep) => setAnsatz({ ...ansatz, ep_hand: ep })} darfSchreiben={darfSchreiben} />}
          {fremd && (
            <div className="rounded-xl bg-gelb-hell p-3 text-[13px] text-gelb">
              Als Fremdgewerk erkannt, zählt nicht zur Summe. Wenn Sie die Leistung doch anbieten: unten einen Ansatz wählen und freigeben.
            </div>
          )}

          <AnsatzEditor ansatz={ansatz} onAnsatz={setAnsatz} />

          <div className="rounded-xl border border-linie">
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
    <div className="rounded-xl border border-linie">
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
