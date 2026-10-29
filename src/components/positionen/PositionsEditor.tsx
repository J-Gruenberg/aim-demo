'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { CircleCheck, Download, FileText, Maximize2, MoreHorizontal, RefreshCw, ScanLine, Trash2, TriangleAlert, Upload } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import type { Stammdaten } from '@/lib/engine/stammdaten';
import type { Ansatz } from '@/lib/engine/bauteile';
import { ART_LABEL } from '@/lib/engine/ansatz';
import { euro, zahl } from '@/lib/format';
import { ProjektKopf, type ProjektMeta } from '@/components/ProjektKopf';
import { ZahlFeld } from '@/components/Felder';
import { AnsatzEditor, standardAnsatz } from './AnsatzEditor';
import { mitPreisen, preis, summen, zaehlt, type Datei, type Position, type AnsatzGespeichert, type Abgleich, type ArchivTreffer, type Pruefung } from './typen';
import { pruefbericht, pruefePosition } from '@/lib/pruefung';
import { baugruppeRechnen, type BaugruppeAnsatz } from '@/lib/engine/zeichnung';
import { losStaffel } from '@/lib/engine/staffel';
import { vorschauPfad } from '@/lib/vorschau';
import { AmpelLegende, SicherheitsAmpel, schnitt, sicherheitVon } from './Ampel';
import { Pruefbericht } from './Pruefbericht';
import { LiveAnsicht, type LiveEreignis, type LivePhase, type LiveZustand } from './LiveAnsicht';
import { stahlJeKg } from '@/lib/engine/bauteile';

type Props = {
  modus: 'lv' | 'bauteil' | 'zeichnung';
  projekt: ProjektMeta;
  positionen: Position[];
  dateien: Datei[];
  hinweise: string[];
  abgleich?: Abgleich | null;
  pruefung?: Pruefung | null;
  stamm: Stammdaten;
  darfSchreiben: boolean;
};

type Filter = 'alle' | 'pruefen' | 'offen' | 'freigegeben' | 'fremd';


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

export function PositionsEditor({ modus, projekt, positionen: start, dateien: dStart, hinweise: hStart, abgleich: aStart = null, pruefung: pStart = null, stamm, darfSchreiben }: Props) {
  const sb = supabaseBrowser();
  const [meta, setMeta] = useState<ProjektMeta>(projekt);
  const [pos, setPos] = useState<Position[]>(() => mitPreisen(start, stamm));
  const [dateien, setDateien] = useState<Datei[]>(dStart);
  const [filter, setFilter] = useState<Filter>('alle');
  const [unsicherZuerst, setUnsicherZuerst] = useState(false);
  const [offenId, setOffenId] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null);
  const [mitPlaenen, setMitPlaenen] = useState(false);
  const [metaStand, setMetaStand] = useState('');
  const [abgleich, setAbgleich] = useState<Abgleich | null>(aStart);
  const [pruefung, setPruefung] = useState<Pruefung | null>(pStart);
  const [hinweise, setHinweise] = useState<string[]>(hStart);
  const [pruefLaeuft, setPruefLaeuft] = useState(false);
  const [abgleichLaeuft, setAbgleichLaeuft] = useState(false);
  const [live, setLive] = useState<LiveZustand | null>(null);
  const [liveOffen, setLiveOffen] = useState(false);
  const liveNr = useRef(0);
  const [vorschau, setVorschau] = useState<Record<string, string>>({});
  const [liestId, setLiestId] = useState<string | null>(null);
  const [schritt, setSchritt] = useState<string | null>(null);
  const dateiInput = useRef<HTMLInputElement>(null);

  /** Live-Ansicht: neuer Lauf, neuer Schritt, neuer Eintrag. Nur echte Ergebnisse landen im Protokoll. */
  function liveBeginnen(titel: string, phase: LivePhase) {
    const t = Date.now();
    setLive({ phase, titel, start: t, beginn: t, laeuft: true, ereignisse: [], bild: null, datei: null, blatt: null, blaetter: null, ende: null });
  }
  function liveSchritt(patch: Partial<LiveZustand> & { titel: string; phase: LivePhase }) {
    setLive((l) => (l ? { ...l, ...patch, start: Date.now(), laeuft: true } : { start: Date.now(), beginn: Date.now(), laeuft: true, ereignisse: [], ...patch }));
  }
  function liveLog(e: Omit<LiveEreignis, 'id' | 'zeit'>) {
    liveNr.current += 1;
    const neu: LiveEreignis = { ...e, id: liveNr.current, zeit: Date.now() };
    setLive((l) => (l ? { ...l, ereignisse: [...l.ereignisse, neu].slice(-300) } : l));
  }
  function liveEnde(titel?: string) {
    setLive((l) => (l ? { ...l, laeuft: false, phase: 'fertig', titel: titel ?? l.titel, ende: Date.now() } : l));
  }
  /** Bild des Blatts, das gerade gelesen wird (wird bei Bedarf einmal gerendert). */
  async function liveBild(d: Datei, seite: number) {
    if (!/\.(pdf|png|jpe?g)$/i.test(d.name)) return;
    if (seite === 1 && vorschau[d.id]) {
      setLive((l) => (l ? { ...l, bild: vorschau[d.id] } : l));
      return;
    }
    const r = await fetch(`/api/zeichnung/${projekt.id}/vorschau`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ datei_id: d.id, seite }) })
      .then((x) => x.json())
      .catch(() => ({}));
    if (r.url) setLive((l) => (l && l.datei === d.name && (l.blatt ?? 1) === seite ? { ...l, bild: r.url } : l));
  }
  const logPosition = (p: { oz?: string | null; kurztext?: string | null; menge?: number | null; einheit?: string | null; gp?: number | null; ep?: number | null; sicherheit?: number | null; begruendung?: string | null }) =>
    liveLog({
      art: 'position',
      oz: p.oz ?? null,
      titel: p.kurztext ?? '',
      menge: p.menge !== null && p.menge !== undefined ? `${zahl(p.menge, 3)} ${p.einheit ?? ''}`.trim() : undefined,
      wert: p.gp !== null && p.gp !== undefined ? euro(p.gp) : p.ep !== null && p.ep !== undefined ? euro(p.ep) : undefined,
      sicherheit: p.sicherheit ?? undefined,
      text: p.begruendung ?? undefined,
    });

  /** AIM hat das Projekt aus den Unterlagen benannt: Kopf aktualisieren, ohne die anderen Felder zu verlieren. */
  function benannt(b: { titel?: string; kunde?: string; ort?: string } | null | undefined) {
    if (!b || !Object.keys(b).length) return;
    setMeta((m) => ({ ...m, ...b }));
    if (b.titel) liveLog({ art: 'info', titel: `Projekt benannt: ${b.titel}`, text: [b.kunde, b.ort].filter(Boolean).join(', ') || undefined });
  }
  useEffect(() => {
    document.title = `${meta.titel} · Angebote in Minuten`;
  }, [meta.titel]);

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
      if (!zaehlt(p)) continue;
      // Zusammenbauzeichnung ohne Einzelteile: über das geschätzte Gewicht
      if (p.ansatz?.art === 'stahl_kg') {
        const a = p.ansatz as unknown as { kg_je_einheit?: number; oberflaeche?: 'roh'; montage?: boolean; blech?: boolean };
        const m = Number(p.menge ?? 1) || 1;
        const kgP = Number(a.kg_je_einheit ?? 0) * m;
        kg += kgP;
        h += stahlJeKg({ kg_gesamt: Math.max(kgP, 1), oberflaeche: a.oberflaeche ?? 'roh', montage: !!a.montage, blech: a.blech }, stamm).h_je_einheit! * kgP;
        continue;
      }
      if (p.ansatz?.art !== 'baugruppe') continue;
      const r = baugruppeRechnen(p.ansatz as unknown as BaugruppeAnsatz, stamm);
      const m = Number(p.menge ?? 1) || 1;
      kg += r.kennzahlen.kg * m;
      h += r.kennzahlen.stunden * m;
      teile += r.kennzahlen.teile * m;
    }
    return { kg, h, teile };
  }, [pos, stamm]);
  const bericht = useMemo(() => pruefbericht(pos), [pos]);

  /**
   * Losgrößen-Staffel für Serienteile: Der kalkulierte Preis gilt für einen Satz. Die Rüstzeit je Zeichnung
   * (Stammdaten) fällt einmal je Los an und verteilt sich bei 10 und 50 Sätzen auf alle Stück.
   */
  const staffel = useMemo(() => (modus === 'zeichnung' ? losStaffel(pos, stamm) : null), [modus, pos, stamm]);
  const hatGaeb = pos.some((p) => p.quelle?.startsWith('gaeb:'));

  const sichtbar = useMemo(() => {
    let l = pos;
    if (filter === 'pruefen') l = l.filter((p) => p.status !== 'offen' && p.status !== 'freigegeben' && sicherheitVon(p) < 0.5);
    if (filter === 'offen') l = l.filter((p) => p.status === 'offen');
    if (filter === 'freigegeben') l = l.filter((p) => p.status === 'freigegeben');
    if (filter === 'fremd') l = l.filter((p) => p.typ === 'fremd' || p.ansatz?.ausgeblendet);
    if (unsicherZuerst) l = [...l].sort((a, b) => sicherheitVon(a) - sicherheitVon(b));
    return l;
  }, [pos, filter, unsicherZuerst]);

  const liveSchliessen = useCallback(() => setLiveOffen(false), []);

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

  async function freigabeZuruecknehmen() {
    const ids = pos.filter((p) => p.status === 'freigegeben').map((p) => p.id);
    const neu = mitPreisen(pos.map((p) => (ids.includes(p.id) ? { ...p, status: (sicherheitVon(p) >= 0.9 ? 'berechnet' : 'pruefen') as Position['status'] } : p)), stamm);
    setPos(neu);
    await speichereZeilen(neu.filter((p) => ids.includes(p.id)), neu);
  }

  /**
   * Wartet auf ein Ergebnis in projekte.ergebnis, falls die Verbindung abreißt. Der Server rechnet meist fertig.
   */
  async function ergebnisAbwarten<T extends { datum: string }>(schluessel: 'pruefung' | 'abgleich', seit: number): Promise<T | null> {
    return warte(async () => {
      const { data } = await sb.from('projekte').select('ergebnis').eq('id', projekt.id).single();
      const e = data?.ergebnis?.[schluessel] as T | undefined;
      return e && new Date(e.datum).getTime() >= seit - 5000 ? e : null;
    });
  }

  /** Vorbemerkungen prüfen: Hinweise mit Ampel, Bieterfragen, Projektname. */
  async function pruefen(still = false): Promise<Pruefung | null> {
    setPruefLaeuft(true);
    const seit = Date.now();
    let ergebnis: Pruefung | null = null;
    try {
      const r = await fetch(`/api/lv/${projekt.id}/pruefen`, { method: 'POST' }).catch(() => null);
      const j = r ? await r.json().catch(() => ({})) : {};
      if (r?.ok && j.pruefung) {
        ergebnis = j.pruefung;
        benannt(j.benannt);
      } else if (r && j.fehler) {
        if (!still) zeige(false, j.fehler);
      } else ergebnis = await ergebnisAbwarten<Pruefung>('pruefung', seit);
      if (ergebnis) {
        setPruefung(ergebnis);
        const k = ergebnis.hinweise.filter((h) => h.stufe === 'kritisch');
        liveLog({ art: 'erfolg', titel: `Vorbemerkungen geprüft: ${k.length} kritisch, ${ergebnis.hinweise.length - k.length} weitere Hinweise, ${ergebnis.bieterfragen.length} Bieterfragen` });
        k.slice(0, 6).forEach((h) => liveLog({ art: 'hinweis', titel: h.titel, text: h.folge }));
        if (!still) zeige(true, 'Prüfung fertig. Ergebnis im Prüfbericht.');
      }
    } finally {
      setPruefLaeuft(false);
    }
    return ergebnis;
  }

  /** Pläne gegen LV, Merkmal für Merkmal, mit Bieterfragen. */
  async function planAbgleich(still = false): Promise<Abgleich | null> {
    setAbgleichLaeuft(true);
    const seit = Date.now();
    let ergebnis: Abgleich | null = null;
    try {
      const r = await fetch(`/api/lv/${projekt.id}/abgleich`, { method: 'POST' }).catch(() => null);
      const j = r ? await r.json().catch(() => ({})) : {};
      if (r?.ok && j.abgleich) ergebnis = j.abgleich;
      else if (r && j.fehler) {
        if (!still) zeige(false, j.fehler);
      } else ergebnis = await ergebnisAbwarten<Abgleich>('abgleich', seit);
      if (ergebnis) {
        setAbgleich(ergebnis);
        const w = ergebnis.widersprueche ?? [];
        liveLog({ art: 'erfolg', titel: `Plan gegen LV geprüft: ${w.length} Widersprüche, ${ergebnis.fehlt_im_lv.length} fehlen im LV, ${ergebnis.bieterfragen?.length ?? 0} Bieterfragen` });
        w.slice(0, 6).forEach((x) => liveLog({ art: 'hinweis', titel: `${x.oz}: im LV ${x.lv}, im Plan ${x.plan}`, text: x.folge }));
        if (!still) zeige(true, 'Plan gegen LV fertig. Ergebnis im Prüfbericht.');
      }
    } finally {
      setAbgleichLaeuft(false);
    }
    return ergebnis;
  }

  /** Beide Prüfungen parallel, so schnell wie die langsamere. */
  async function allesPruefen(still = false, plaene?: boolean) {
    const mitPlaenen = plaene ?? dateien.some((d) => d.art === 'plan');
    await Promise.allSettled([pruefen(still), mitPlaenen ? planAbgleich(still) : Promise.resolve(null)]);
  }

  /** Zeichnungssatz als Ganzes ordnen: keine doppelten Unterbaugruppen, Mengen, fehlende Zeichnungen, Kaufteile. */
  async function satzOrdnen() {
    liveSchritt({ titel: 'Zeichnungssatz wird geordnet', phase: 'satz' });
    setLaeuft('Ordne den Zeichnungssatz: Zusammenbau, Unterbaugruppen, Mengen, Kaufteile …');
    const r = await fetch(`/api/zeichnung/${projekt.id}/satz`, { method: 'POST' }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    const liste = await neuLaden();
    if (r?.ok) {
      benannt(j.benannt);
      if (j.geaendert || j.neu) {
        liveLog({ art: 'erfolg', titel: `Satz geordnet: ${j.geaendert} Positionen angepasst${j.neu ? `, ${j.neu} ergänzt` : ''}` });
        (j.fehlend as string[] | undefined)?.forEach((f) => liveLog({ art: 'fehler', titel: `Zeichnung fehlt: ${f}`, text: 'Nur über das Gewicht aus der Stückliste gerechnet, bitte Zeichnung anfordern.' }));
        if (j.kaufteile) liveLog({ art: 'hinweis', titel: `${j.kaufteile} Sorten Kaufteile als eigene Position`, text: 'Preis beim Lieferanten anfragen.' });
        (j.fremdleistungen as string[] | undefined)?.forEach((f) => liveLog({ art: 'hinweis', titel: `Fremdleistung: ${f}`, text: 'Preis anfragen.' }));
        (j.hinweise as string[] | undefined)?.slice(0, 3).forEach((h) => liveLog({ art: 'info', titel: h }));
      }
      await summeSpeichern(liste);
    } else if (j.fehler) liveLog({ art: 'fehler', titel: j.fehler });
    return liste;
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

  /** Hinweise aus den Unterlagen neu holen (sie werden beim Lesen ergänzt). */
  async function hinweiseLaden() {
    const { data } = await sb.from('projekte').select('ergebnis').eq('id', projekt.id).single();
    setHinweise(((data?.ergebnis?.hinweise as string[] | undefined) ?? []).slice(0, 60));
  }

  async function neuLaden() {
    const { data } = await sb.from('positionen').select('*').eq('projekt_id', projekt.id).order('sort');
    const neu = mitPreisen((data ?? []) as Position[], stamm);
    setPos(neu);
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
    if (!still) liveBeginnen(`${d.name} wird gelesen`, 'lesen');
    while (ab !== null) {
      setLaeuft(`Lese ${d.name}${ab > 1 ? `, ab Seite ${ab}` : ''} …`);
      setLiestId(d.id);
      const vonSeite: number = ab;
      liveSchritt({ titel: d.art === 'baubeschreibung' ? 'Vorbemerkungen werden gelesen' : d.art === 'gaeb' ? 'GAEB-Datei wird eingelesen' : 'Leistungsverzeichnis wird gelesen', phase: 'lesen', datei: d.name, blatt: d.art === 'gaeb' ? null : vonSeite, blaetter: d.seiten, bild: null });
      if (d.art !== 'gaeb') void liveBild(d, vonSeite);
      let r: Response | null = null;
      let j: { fehler?: string; neu: number; naechste: number | null; seiten?: number | null; art?: string; benannt?: Record<string, string> | null; positionen?: { oz: string; kurztext: string; menge: number | null; einheit: string | null }[] } = { neu: 0, naechste: null };
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
        liveLog({ art: 'fehler', titel: j.fehler ?? 'Lesen fehlgeschlagen.' });
        break;
      }
      neuGesamt += j.neu;
      ab = j.naechste;
      const liste = await neuLaden();
      benannt(j.benannt);
      if (j.art === 'gaeb') {
        liveLog({ art: 'schritt', titel: `GAEB-Datei gelesen: ${j.neu} Positionen mit Ordnungszahl, Menge und Einheit` });
        liste.filter((p) => (p.quelle ?? '').startsWith(`gaeb:${d.id}:`)).slice(0, 60).forEach((p) => logPosition({ oz: p.oz, kurztext: p.kurztext, menge: p.menge, einheit: p.einheit }));
      } else {
        liveLog({ art: 'schritt', titel: `Seite ${vonSeite}${j.naechste ? ` bis ${j.naechste - 1}` : j.seiten && j.seiten > vonSeite ? ` bis ${j.seiten}` : ''} gelesen${d.art === 'baubeschreibung' ? '' : `: ${j.neu} ${j.neu === 1 ? 'Position' : 'Positionen'}`}` });
        (j.positionen ?? []).forEach((p) => logPosition(p));
      }
    }
    setLiestId(null);
    if (d.art === 'baubeschreibung' || d.art === 'lv') await hinweiseLaden();
    if (!still) {
      setLaeuft(null);
      liveEnde();
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
    let blaetter = d.seiten ?? null;
    setLiestId(d.id);
    if (!still) liveBeginnen(`${d.name} wird gelesen`, 'lesen');
    while (seite !== null) {
      setLaeuft(`Lese ${d.name}${seite > 1 ? `, Blatt ${seite}` : ''} … Stückliste, Bohrungen, Nähte (rund 30 bis 90 Sekunden je Blatt)`);
      const blatt: number = seite;
      liveSchritt({ titel: 'Zeichnung wird gelesen', phase: 'lesen', datei: d.name, blatt, blaetter, bild: null });
      void liveBild(d, blatt);
      let r: Response | null = null;
      let j: {
        fehler?: string;
        neu: number;
        naechste: number | null;
        seiten?: number;
        blatt?: { zeichnungsnummer?: string; titel?: string; gesamtgewicht_kg?: number | null };
        benannt?: Record<string, string> | null;
        positionen?: { oz: string; kurztext: string; menge: number; einheit: string; ep: number; gp: number; sicherheit: number; begruendung: string }[];
        hinweise?: string[];
      } = { neu: 0, naechste: null };
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
        liveLog({ art: 'fehler', titel: j.fehler ?? 'Lesen fehlgeschlagen.' });
        break;
      }
      neuGesamt += j.neu;
      seite = j.naechste;
      if (j.seiten) {
        blaetter = j.seiten;
        setDateien((l) => l.map((x) => (x.id === d.id ? { ...x, seiten: j.seiten ?? x.seiten } : x)));
      }
      const b = j.blatt;
      liveLog({
        art: 'schritt',
        titel: `Blatt ${blatt}${blaetter ? ` von ${blaetter}` : ''} gelesen${b?.zeichnungsnummer ? `: Zeichnung ${b.zeichnungsnummer}` : ''}${b?.titel ? `, ${b.titel}` : ''}`,
        text: b?.gesamtgewicht_kg ? `Gewicht laut Schriftfeld ${zahl(b.gesamtgewicht_kg, 1)} kg` : undefined,
      });
      (j.positionen ?? []).forEach((p) => logPosition(p));
      if (!j.positionen?.length) liveLog({ art: 'info', titel: 'Keine eigene Fertigungsposition auf diesem Blatt', text: j.hinweise?.[0] });
      (j.hinweise ?? []).slice(j.positionen?.length ? 0 : 1, 3).forEach((h) => liveLog({ art: 'hinweis', titel: h }));
      benannt(j.benannt);
      await neuLaden();
    }
    setLiestId(null);
    if (neuGesamt) await summeSpeichern(await neuLaden());
    if (!still) {
      if (neuGesamt) await satzOrdnen();
      await hinweiseLaden();
      setLaeuft(null);
      liveEnde('Fertig gelesen und kalkuliert');
      if (neuGesamt) zeige(true, `${neuGesamt} Positionen aus ${d.name} gelesen und kalkuliert. Unsichere bitte prüfen.`);
    }
    return neuGesamt;
  }

  async function alleZeichnungenLesen() {
    const offen = dateien.filter((d) => d.art === 'zeichnung' && !pos.some((p) => (p.quelle ?? '').startsWith(`zng:${d.id}:`)));
    if (!offen.length) return zeige(true, 'Alle Zeichnungen sind gelesen.');
    let n = 0;
    liveBeginnen('Zeichnungen werden gelesen', 'lesen');
    for (const d of offen) n += await zeichnungLesen(d, true);
    if (n) await satzOrdnen();
    await hinweiseLaden();
    setLaeuft(null);
    liveEnde('Fertig gelesen und kalkuliert');
    zeige(true, `${offen.length} Zeichnungen gelesen, ${n} Positionen kalkuliert. Unsichere bitte prüfen.`);
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
    if (!still) liveBeginnen('Positionen werden kalkuliert', 'kalkulieren');
    for (let i = 0; i < ziel.length; i += paket) {
      setLaeuft(`Kalkuliere ${Math.min(i + paket, ziel.length)} von ${ziel.length} Positionen …`);
      const ids = ziel.slice(i, i + paket);
      liveSchritt({ titel: `Kalkuliere Positionen ${i + 1} bis ${Math.min(i + paket, ziel.length)} von ${ziel.length}`, phase: 'kalkulieren', bild: null, blatt: null, blaetter: null, datei: null });
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
      const liste = await neuLaden();
      for (const id of ids) {
        const p = liste.find((x) => x.id === id);
        if (p && p.status !== 'offen') logPosition({ ...p, sicherheit: sicherheitVon(p), begruendung: p.typ === 'fremd' ? 'Fremdgewerk, nicht in der Summe' : p.begruendung });
      }
    }
    const neu = await neuLaden();
    await speichereZeilen([], neu);
    if (!still) {
      setLaeuft(null);
      liveEnde('Fertig kalkuliert');
      if (fertig) zeige(true, `${fertig} Positionen kalkuliert. Unsichere bitte prüfen.`);
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
    liveBeginnen(modus === 'zeichnung' ? 'Zeichnungen werden gelesen' : 'Ausschreibung wird gelesen', 'lesen');
    try {
      if (modus === 'zeichnung') {
        const z = neu.filter((d) => d.art === 'zeichnung');
        let n = 0;
        for (const [i, d] of z.entries()) {
          setSchritt(z.length > 1 ? `Zeichnung ${i + 1} von ${z.length}` : 'Zeichnung wird gelesen und kalkuliert');
          n += await zeichnungLesen(d, true);
        }
        if (n) {
          setSchritt('Zeichnungssatz wird geordnet');
          await satzOrdnen();
        }
        await hinweiseLaden();
        const ende = await neuLaden();
        const sch = schnitt(ende.filter(zaehlt));
        liveEnde('Fertig gelesen und kalkuliert');
        if (z.length) zeige(true, `${z.length} ${z.length === 1 ? 'Zeichnung' : 'Zeichnungen'} gelesen, ${ende.length} Positionen kalkuliert${sch !== null ? `, durchschnittliche Sicherheit ${Math.round(sch * 100)} %` : ''}.`);
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

      const schritte = (quelle.length ? 1 : 0) + 2;
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
      // Prüfbericht läuft parallel zur Kalkulation: er braucht nur die gelesenen Positionen
      const pruefLauf = liste.length ? allesPruefen(true, alle.some((d) => d.art === 'plan')) : Promise.resolve();
      const offen = liste.filter((p) => p.status === 'offen' && !p.ansatz?.ausgeblendet).map((p) => p.id);
      if (offen.length) {
        setSchritt(`Schritt ${nr + 1} von ${schritte}: Preise werden kalkuliert`);
        await kalkulieren(offen, false, true);
      }
      setSchritt(`Schritt ${nr + 2} von ${schritte}: Vorbemerkungen und Pläne werden geprüft`);
      setLaeuft('Prüfbericht wird fertig: kritische Hinweise, Widersprüche, Bieterfragen …');
      liveSchritt({ titel: 'Prüfbericht wird erstellt', phase: 'pruefen', bild: null, datei: null, blatt: null, blaetter: null });
      await pruefLauf;
      const ende = await neuLaden();
      const sch = schnitt(ende.filter(zaehlt));
      liveEnde('Fertig gelesen, kalkuliert und geprüft');
      if (gelesen || offen.length) zeige(true, `Fertig: ${ende.length} Positionen gelesen und kalkuliert${sch !== null ? `, durchschnittliche Sicherheit ${Math.round(sch * 100)} %` : ''}. Der Prüfbericht steht unten.`);
    } finally {
      setSchritt(null);
      setLaeuft(null);
      setLive((l) => (l && l.laeuft ? { ...l, laeuft: false, ende: Date.now() } : l));
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
  const alleFreigebbar = pos.filter((p) => (p.status === 'berechnet' || p.status === 'pruefen') && p.ep !== null && p.typ !== 'fremd' && !p.ansatz?.ausgeblendet);
  const sch = schnitt(pos.filter(zaehlt));
  const unsicher = pos.filter((p) => zaehlt(p) && p.status !== 'offen' && p.status !== 'freigegeben' && sicherheitVon(p) < 0.5).length;
  const sicherAnzahl = pos.filter((p) => zaehlt(p) && p.status !== 'offen' && sicherheitVon(p) >= 0.65).length;

  const kritisch = (pruefung?.hinweise.filter((h) => h.stufe === 'kritisch').length ?? 0) + (abgleich?.widersprueche?.filter((w) => w.stufe === 'kritisch').length ?? 0);
  const fragenAnzahl = (pruefung?.bieterfragen.length ?? 0) + (abgleich?.bieterfragen?.length ?? 0);
  const zeichnungen = dateien.filter((d) => d.art === 'zeichnung');
  const fehlend = pos.filter((p) => (p.ansatz as { zeichnung_fehlt?: string } | null)?.zeichnung_fehlt).length;
  const zngKz = fehlend
    ? { label: 'Zeichnungen', wert: `${zeichnungen.length}`, sub: `${fehlend} ${fehlend === 1 ? 'fehlt' : 'fehlen'} im Satz`, warn: true }
    : { label: 'Zeichnungen', wert: `${zeichnungen.length}`, sub: `${zeichnungen.filter((d) => pos.some((p) => (p.quelle ?? '').startsWith(`zng:${d.id}:`))).length} gelesen` };
  const kzHero: { label: string; wert: string; sub?: string; warn?: boolean }[] =
    modus === 'zeichnung'
      ? [
          { label: 'Stahlgewicht', wert: `${zahl(zk.kg, 0)} kg`, sub: `${zahl(zk.teile, 0)} Teile` },
          { label: 'Fertigung', wert: `${zahl(zk.h, 1)} h`, sub: zk.kg > 0 ? `${zahl((zk.h / zk.kg) * 1000, 1)} h je Tonne` : 'aus den Arbeitsgängen' },
          { label: 'Preis je kg', wert: zk.kg > 0 ? `${zahl(s.gesamt / zk.kg, 2)} €` : '–', sub: 'Summe durch Gewicht' },
          zngKz,
        ]
      : [
          { label: 'Positionen', wert: `${s.anzahl}`, sub: `${s.frei} freigegeben` },
          { label: 'Ø Sicherheit', wert: sch !== null ? `${Math.round(sch * 100)} %` : '–', sub: s.offen ? `${s.offen} noch offen` : 'alle kalkuliert' },
          { label: 'Fremdgewerke', wert: `${s.fremd}`, sub: 'nicht in der Summe' },
          modus === 'lv' && pruefung
            ? { label: 'Prüfbericht', wert: `${kritisch} kritisch`, sub: `${fragenAnzahl} Bieterfragen vorbereitet`, warn: kritisch > 0 }
            : { label: 'Freigegeben', wert: euro(s.freigegeben, true), sub: `${s.frei} von ${s.anzahl} Positionen` },
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
                    {sch !== null ? <>, <b>{sicherAnzahl}</b> davon sicher kalkuliert. Durchschnittliche Sicherheit <b>{Math.round(sch * 100)} %</b>.</> : '.'}
                    {s.freigegeben > 0 && <> Freigegeben: <b>{euro(s.freigegeben, true)}</b>.</>}
                  </>
                )}
              </p>
              <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-white/20 pt-5 sm:grid-cols-4">
                {kzHero.map((k) => (
                  <div key={k.label} className="min-w-0">
                    <dt className="text-[13px] text-white/70">{k.label}</dt>
                    <dd className="mt-0.5 text-[22px] font-extrabold leading-tight tracking-[-0.015em]">{k.wert}</dd>
                    {k.sub && <dd className={`truncate text-[12px] ${k.warn ? 'font-semibold text-[#FDE68A]' : 'text-white/65'}`}>{k.sub}</dd>}
                  </div>
                ))}
              </dl>
              {staffel && (
                <div className="mt-5 rounded-2xl bg-white/10 px-4 py-3.5 ring-1 ring-white/15">
                  <p className="text-[13px] font-semibold text-white/80">Preis je Satz nach Losgröße</p>
                  <div className="mt-2 grid grid-cols-3 gap-3">
                    {staffel.zeilen.map((z) => (
                      <div key={z.n} className="min-w-0">
                        <p className="text-[12px] text-white/65">{z.n === 1 ? '1 Satz' : `ab ${z.n} Sätzen`}</p>
                        <p className="zahl text-[18px] font-bold leading-tight text-white">{euro(z.jeSatz)}</p>
                        {z.n > 1 && <p className="text-[11px] text-white/60">Los {euro(z.jeSatz * z.n, true)}</p>}
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] leading-snug text-white/60">
                    Rüsten und Programmieren {zahl(staffel.stunden, 1)} h je Los ({euro(staffel.ruesten)}), verteilt auf die Losgröße. Wert unter Stammdaten änderbar.
                  </p>
                </div>
              )}
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
          {live && (
            <button type="button" className="knopf-primaer knopf-klein ml-auto shrink-0 self-center" onClick={() => setLiveOffen(true)}>
              <Maximize2 className="size-3.5" strokeWidth={2} aria-hidden /> Live ansehen
            </button>
          )}
        </div>
      )}
      {!laeuft && live && live.ereignisse.length > 0 && (
        <button type="button" className="knopf-leise knopf-klein self-start" onClick={() => setLiveOffen(true)}>
          <ScanLine className="size-3.5" strokeWidth={2} aria-hidden /> Protokoll des letzten Laufs ansehen
        </button>
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
          {dateien.length === 0 && darfSchreiben ? (
            <button
              type="button"
              className="flex min-h-[300px] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-line-strong bg-surface/60 p-8 text-center transition-colors hover:border-brand hover:bg-brand-tint/40"
              onClick={() => dateiInput.current?.click()}
              disabled={!!laeuft}
            >
              <span className="grid size-14 place-items-center rounded-full bg-brand-tint text-brand-strong"><Upload className="size-6" strokeWidth={1.75} aria-hidden /></span>
              <span className="text-[20px] font-bold text-ink-950">Zeichnungen hier ablegen</span>
              <span className="max-w-[56ch] text-[15px] text-ink-600">PDF, Scan oder Foto hierher ziehen oder klicken. Mehrere gehen auf einmal, AIM liest und kalkuliert dann von selbst.</span>
            </button>
          ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {dateien.map((d) => {
              const aus = pos.filter((p) => (p.quelle ?? '').startsWith(`zng:${d.id}:`));
              const n = aus.length;
              const nummer = (aus[0]?.ansatz as { zeichnung?: string } | null)?.zeichnung;
              const liest = liestId === d.id;
              return (
                <article key={d.id} className="karte flex flex-col overflow-hidden">
                  <button type="button" className={`group relative aspect-[1.414] border-b border-line bg-white ${liest ? 'abtasten' : ''}`} onClick={() => (liest && live ? setLiveOffen(true) : dateiOeffnen(d))} title={liest ? 'Live ansehen' : 'Zeichnung öffnen'}>
                    {vorschau[d.id] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={vorschau[d.id]} alt={`Vorschau ${d.name}`} className="absolute inset-0 h-full w-full object-contain p-2" />
                    ) : (
                      <BlattPlatzhalter />
                    )}
                    {n > 0 && <span className="marke absolute left-3 top-3 h-[22px] bg-brand px-2 text-[11px] text-white">{n} {n === 1 ? 'Position' : 'Positionen'}</span>}
                    {liest && live && (
                      <span className="absolute inset-x-0 bottom-3 z-10 flex justify-center">
                        <span className="marke h-8 gap-1.5 bg-ink-950/85 px-3.5 text-[13px] text-white shadow-[var(--shadow-float)] transition-transform group-hover:scale-105"><Maximize2 className="size-3.5" strokeWidth={2} aria-hidden />Live ansehen</span>
                      </span>
                    )}
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
                <span className="text-[14px] text-ink-600">Weitere Zeichnungen hierher ziehen oder klicken.</span>
              </button>
            )}
          </div>
          )}
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
                    : (d.art === 'gaeb' || d.art === 'lv') && pos.some((p) => /^(gaeb|pdf):/.test(p.quelle ?? ''))
                      ? { text: 'Nicht nötig, das LV ist schon gelesen', ton: 'text-ink-500', punkt: 'bg-ink-300' }
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
        </section>
      )}

      {modus === 'lv' && (pos.length > 0 || pruefung || hinweise.length > 0) && (
        <Pruefbericht
          pruefung={pruefung}
          abgleich={abgleich}
          altHinweise={hinweise}
          befunde={bericht.je}
          positionen={pos}
          pruefLaeuft={pruefLaeuft}
          abgleichLaeuft={abgleichLaeuft}
          hatPlaene={dateien.some((d) => d.art === 'plan')}
          darfSchreiben={darfSchreiben}
          gesperrt={!!laeuft && !pruefLaeuft && !abgleichLaeuft}
          onPruefen={() => {
            liveBeginnen('Vorbemerkungen werden geprüft', 'pruefen');
            void pruefen().then(() => liveEnde('Prüfung fertig'));
          }}
          onAbgleich={() => {
            liveBeginnen('Pläne werden gegen das LV geprüft', 'pruefen');
            void planAbgleich().then(() => liveEnde('Plan gegen LV fertig'));
          }}
          onPosition={(id) => setOffenId(id)}
        />
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
                ['pruefen', `Unsicher ${unsicher}`],
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
            {darfSchreiben && alleFreigebbar.length > 0 && (
              <button
                className="knopf-primaer knopf-klein"
                onClick={() => {
                  const summe = alleFreigebbar.reduce((x, p) => x + (zaehlt(p) ? Number(p.gp ?? 0) : 0), 0);
                  const wenig = alleFreigebbar.filter((p) => sicherheitVon(p) < 0.5).length;
                  if (confirm(`Alle ${alleFreigebbar.length} kalkulierten Positionen mit zusammen ${euro(summe, true)} freigeben?${wenig ? `\n\n${wenig} davon liegen unter 50 % Sicherheit.` : ''}`)) freigeben(alleFreigebbar.map((p) => p.id));
                }}
              >
                <CircleCheck className="size-4" strokeWidth={2} aria-hidden /> Alle freigeben
              </button>
            )}
            {darfSchreiben && alleFreigebbar.length === 0 && s.frei > 0 && (
              <button className="knopf-leise knopf-klein" onClick={() => confirm('Alle Freigaben zurücknehmen? Das Angebot zeigt dann wieder „Entwurf“.') && freigabeZuruecknehmen()}>Freigaben zurücknehmen</button>
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
                  <th className="w-36">Sicherheit</th>
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
                          {(p.ansatz as { zeichnung_fehlt?: string } | null)?.zeichnung_fehlt && <span className="font-semibold text-[#B91C1C]">Zeichnung {(p.ansatz as { zeichnung_fehlt?: string }).zeichnung_fehlt} fehlt</span>}
                          {(p.ansatz as { nur_gewicht?: boolean } | null)?.nur_gewicht && <span className="font-semibold text-[#9A3412]">über Gewicht geschätzt, rund {zahl(Number((p.ansatz as { kg_geschaetzt?: number }).kg_geschaetzt ?? 0), 0)} kg je Stück</span>}
                          {p.ansatz?.art === 'zukauf' && p.ep === null && <span className="font-semibold text-[#9A3412]">Preis anfragen</span>}
                          {p.ansatz?.bedarf && <span className="text-gelb">Bedarfsposition</span>}
                          {p.ansatz?.alternativ && <span className="text-gelb">Alternative</span>}
                        </div>
                      </td>
                      <td className="text-right zahl text-[14px] whitespace-nowrap">{zahl(p.menge, 3)}</td>
                      <td className="text-[13px] text-grau">{p.einheit}</td>
                      {modus !== 'zeichnung' && <td className="text-[13px] text-grau">{fremd ? 'Fremdgewerk' : p.ansatz?.art ? ART_LABEL[p.ansatz.art] : '–'}{p.ansatz?.ep_hand !== undefined && p.ansatz?.ep_hand !== null ? ', von Hand' : ''}</td>}
                      <td className="text-right zahl text-[14px] whitespace-nowrap">{p.ep === null && p.ansatz?.art === 'zukauf' ? <span className="font-sans text-[13px] font-semibold text-[#9A3412]">anfragen</span> : euro(p.ep)}</td>
                      <td className="text-right zahl text-[14px] font-semibold whitespace-nowrap">{euro(p.gp)}</td>
                      <td>
                        <SicherheitsAmpel p={p} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="border-t border-line px-4 py-3"><AmpelLegende /></div>
          </div>
        )}
        </div>
      </section>

      {liveOffen && live && (
        <LiveAnsicht
          zustand={live}
          modus={modus}
          kennzahlen={{ positionen: pos.filter((p) => p.status !== 'offen').length, summe: s.gesamt, sicherheit: sch }}
          onSchliessen={liveSchliessen}
        />
      )}

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
