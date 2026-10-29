/**
 * Excel-Export einer Kalkulation zum Nachprüfen.
 * Reiner Baustein: bekommt Projekt, Positionen und Stammdaten als Daten und liefert die xlsx-Datei.
 * Jede Formelzelle trägt ihr Ergebnis mit, damit Betrachter ohne Neuberechnung die Zahlen zeigen.
 */
import ExcelJS from 'exceljs';
import { mitPreisen, preis, zaehlt, type Abgleich, type Bieterfrage, type Position, type PruefHinweis, type Pruefung, type Widerspruch } from '@/components/positionen/typen';
import { ART_LABEL } from '@/lib/engine/ansatz';
import { GELAENDER_STANDARD, TREPPE_STANDARD, gelaenderJeM, rechnePosition, stahlJeKg, treppeJeStk, type Ansatz, type Baustein } from '@/lib/engine/bauteile';
import { STAMMDATEN_DEFS, sd, type Stammdaten } from '@/lib/engine/stammdaten';
import { berechneHalle, LEERE_HALLE, type HallenEingaben, type ReferenzPunkt } from '@/lib/engine/halle';

/* ------------------------------------------------------------------ */
/* Eingabe                                                             */
/* ------------------------------------------------------------------ */

export type ExcelProjekt = {
  id?: string;
  typ: string;
  titel: string;
  kunde?: string | null;
  ort?: string | null;
  status?: string | null;
  ergebnis_label?: string | null;
  abgabe?: string | null;
  eingaben?: Partial<HallenEingaben> | null;
  ergebnis?: Record<string, unknown> | null;
  updated_at?: string | null;
};

export type KalkulationsDaten = {
  projekt: ExcelProjekt;
  /** Zeilen aus der Tabelle positionen, egal ob Zahlen als number oder string kommen */
  positionen?: unknown[];
  /** Stammdaten-Werte wie aus ladeStammdaten().werte */
  stamm: Stammdaten;
  /** Nur Hallenbau: Referenzpunkte für die Stahlschätzung */
  referenzen?: ReferenzPunkt[];
  /** Zeitpunkt des Exports, Standard jetzt */
  stand?: Date;
};

/* ------------------------------------------------------------------ */
/* Gestaltung (toolwerk)                                               */
/* ------------------------------------------------------------------ */

const F = {
  brand: '0B7F70',
  strong: '0A5C51',
  tint: 'DDF3EF',
  ink: '0F1C1A',
  muted: '5B6B68',
  linie: 'E1E8E6',
  flaeche: 'F4F7F6',
  grau: '8A9794',
  weiss: 'FFFFFF',
  ok: '197A4A',
  bandText: 'CDEDE7',
};

const STUFEN = [
  { ab: 0.8, label: 'Sehr sicher', bereich: 'ab 80 %', bg: 'DCFCE7', fg: '14532D' },
  { ab: 0.65, label: 'Sicher', bereich: '65 bis 79 %', bg: 'ECFCCB', fg: '2F6B1E' },
  { ab: 0.5, label: 'Mittel', bereich: '50 bis 64 %', bg: 'FEF6C7', fg: '7A5200' },
  { ab: 0.35, label: 'Unsicher', bereich: '35 bis 49 %', bg: 'FFEDD5', fg: '9A3412' },
  { ab: 0, label: 'Sehr unsicher', bereich: 'unter 35 %', bg: 'FEE2E2', fg: '991B1B' },
] as const;
type StufeDef = (typeof STUFEN)[number];

const HINWEIS_STUFE: Record<string, { label: string; bg: string; fg: string; rang: number }> = {
  kritisch: { label: 'Kritisch', bg: 'FEE2E2', fg: '991B1B', rang: 0 },
  beachten: { label: 'Beachten', bg: 'FEF6C7', fg: '7A5200', rang: 1 },
  info: { label: 'Info', bg: 'DCFCE7', fg: '14532D', rang: 2 },
};

const THEMA: Record<string, string> = { kosten: 'Kosten', termine: 'Termine', technik: 'Technik', baustelle: 'Baustelle', nachweise: 'Nachweise', vertrag: 'Vertrag' };
const MERKMAL: Record<string, string> = { werkstoff: 'Werkstoff', oberflaeche: 'Oberfläche', profil: 'Profil', abmessung: 'Abmessung', befestigung: 'Befestigung', anzahl: 'Anzahl', sonstiges: 'Sonstiges' };
const PROJEKT_TYP: Record<string, string> = { zeichnung: 'Nach Zeichnung', halle: 'Hallenbau', lv: 'Ausschreibung', bauteil: 'Treppe, Geländer, Stahlbau' };
const PROJEKT_STAND: Record<string, string> = { entwurf: 'Entwurf', in_pruefung: 'In Prüfung', freigegeben: 'Freigegeben', abgegeben: 'Abgegeben' };
const POS_STATUS: Record<string, string> = { offen: 'Offen', berechnet: 'Berechnet', pruefen: 'Prüfen', freigegeben: 'Freigegeben' };

const FONT = 'Arial';
const EUR = '#,##0.00 "€"';
/** Wie EUR, Nullbeträge bleiben leer (Preisbausteine einer Position, die nicht vorkommen). */
const EUR_OHNE_NULL = '#,##0.00 "€";-#,##0.00 "€";;@';
const EUR_KG = '#,##0.00 "€/kg"';
const PROZENT = '0 %';

const argb = (hex: string) => `FF${hex}`;

type Stil = {
  fett?: boolean;
  kursiv?: boolean;
  groesse?: number;
  farbe?: string;
  fuellung?: string;
  format?: string;
  h?: 'left' | 'center' | 'right';
  v?: 'top' | 'middle' | 'bottom';
  umbruch?: boolean;
  einzug?: number;
  unten?: string;
  oben?: string;
  obenDick?: boolean;
};

function stil(c: ExcelJS.Cell, s: Stil) {
  c.font = { name: FONT, size: s.groesse ?? 10, bold: !!s.fett, italic: !!s.kursiv, color: { argb: argb(s.farbe ?? F.ink) } };
  if (s.fuellung) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(s.fuellung) } };
  if (s.format) c.numFmt = s.format;
  c.alignment = { horizontal: s.h ?? 'left', vertical: s.v ?? 'top', wrapText: !!s.umbruch, ...(s.einzug ? { indent: s.einzug } : {}) };
  const border: Partial<ExcelJS.Borders> = {};
  if (s.unten) border.bottom = { style: 'thin', color: { argb: argb(s.unten) } };
  if (s.oben) border.top = { style: s.obenDick ? 'medium' : 'thin', color: { argb: argb(s.oben) } };
  if (border.bottom || border.top) c.border = border;
}

function setze(ws: ExcelJS.Worksheet, zeile: number, spalte: number, wert: ExcelJS.CellValue, s: Stil = {}) {
  const c = ws.getCell(zeile, spalte);
  c.value = wert;
  stil(c, s);
  return c;
}

/** Füllt einen Bereich (für Bänder und Kacheln), ohne Werte zu setzen. */
function flaeche(ws: ExcelJS.Worksheet, zeile: number, von: number, bis: number, s: Stil) {
  for (let sp = von; sp <= bis; sp++) stil(ws.getCell(zeile, sp), s);
}

function verbinde(ws: ExcelJS.Worksheet, zeile: number, von: number, bis: number, zeileBis = zeile) {
  if (bis > von || zeileBis > zeile) ws.mergeCells(zeile, von, zeileBis, bis);
}

const sp = (n: number) => {
  let s = '';
  let x = n;
  while (x > 0) {
    const m = (x - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
};

/**
 * Zeilen, die ein Text bei gegebener Spaltenbreite (Excel-Zeichen) und Schriftgröße braucht.
 * Excel passt die Höhe verbundener Zellen nicht selbst an, deshalb schätzen wir mit Wortumbruch.
 */
function textZeilen(text: string | null | undefined, breite: number, groesse = 10): number {
  if (!text) return 1;
  const proZeile = Math.max(6, Math.floor(breite * (11 / groesse)));
  let zeilen = 0;
  for (const absatz of String(text).split('\n')) {
    let n = 1;
    let laenge = 0;
    for (const wort of absatz.split(/\s+/).filter(Boolean)) {
      if (laenge > 0 && laenge + 1 + wort.length <= proZeile) {
        laenge += 1 + wort.length;
        continue;
      }
      if (laenge > 0) n++;
      laenge = wort.length;
      while (laenge > proZeile) {
        n++;
        laenge -= proZeile;
      }
    }
    zeilen += n;
  }
  return zeilen;
}
const hoehe = (zeilen: number, groesse = 10) => Math.round(zeilen * groesse * 1.3 + 4);

const r2 = (v: number) => Math.round(v * 100) / 100;
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};
const deZahl = (v: number, stellen = 2) => v.toLocaleString('de-DE', { maximumFractionDigits: stellen });
const deEuro = (v: number) => `${v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const mengenFormat = (v: number) => (Number.isInteger(v) ? '#,##0' : '#,##0.0##');
const kgFormat = (v: number) => (v < 10 ? '#,##0.00 "kg"' : '#,##0.0 "kg"');

function datumZeit(d: Date) {
  return d.toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fusszeile(ws: ExcelJS.Worksheet, titel: string) {
  const t = titel.replace(/&/g, '&&');
  ws.headerFooter = { oddFooter: `&L&8${t}&C&8Seite &P von &N&R&8AIM, Angebote in Minuten` };
}

function druck(ws: ExcelJS.Worksheet, papier: 'A4' | 'A3' = 'A4', titelZeilen?: string) {
  ws.pageSetup = {
    ...ws.pageSetup,
    // 8 = A3, 9 = A4 (OOXML); A3 fehlt in der Aufzählung von exceljs
    paperSize: (papier === 'A3' ? 8 : 9) as unknown as ExcelJS.PaperSize,
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.2, footer: 0.25 },
    ...(titelZeilen ? { printTitlesRow: titelZeilen } : {}),
  };
}

/** Setzt Seitenumbrüche nur vor Abschnitten, damit keine Tabelle mitten auf der Seite zerreißt (A4 quer, 100 %). */
function seitenumbrueche(ws: ExcelJS.Worksheet, abschnitte: number[], letzte: number, seite = 480) {
  const h = (von: number, bis: number) => {
    let s = 0;
    for (let i = von; i <= bis; i++) s += ws.getRow(i).height ?? 15;
    return s;
  };
  const grenzen = [1, ...abschnitte.filter((a) => a > 1), letzte + 1];
  let summe = 0;
  for (let i = 0; i < grenzen.length - 1; i++) {
    const teil = h(grenzen[i], grenzen[i + 1] - 1);
    if (summe > 0 && summe + teil > seite) {
      ws.getRow(grenzen[i] - 1).addPageBreak();
      summe = teil;
    } else summe += teil;
  }
}

/** Kopfband in Markenfarbe über die angegebenen Spalten. */
function kopfband(ws: ExcelJS.Worksheet, von: number, bis: number, titel: string, unterzeilen: string[], textSpalte = von): number {
  let z = 1;
  const einzug = textSpalte === von ? 1 : undefined;
  ws.getRow(z).height = 8;
  flaeche(ws, z, von, bis, { fuellung: F.brand });
  z++;
  flaeche(ws, z, von, bis, { fuellung: F.brand });
  setze(ws, z, textSpalte, titel, { fett: true, groesse: 18, farbe: F.weiss, fuellung: F.brand, v: 'middle', einzug });
  ws.getRow(z).height = 30;
  z++;
  unterzeilen.forEach((u, i) => {
    flaeche(ws, z, von, bis, { fuellung: F.brand });
    setze(ws, z, textSpalte, u, { groesse: i === 0 ? 11 : 10, farbe: i === 0 ? F.weiss : F.bandText, fuellung: F.brand, v: 'middle', einzug });
    ws.getRow(z).height = 17;
    z++;
  });
  ws.getRow(z).height = 8;
  flaeche(ws, z, von, bis, { fuellung: F.brand });
  return z + 1;
}

function abschnitt(ws: ExcelJS.Worksheet, zeile: number, von: number, bis: number, titel: string, hinweis?: string) {
  setze(ws, zeile, von, titel, { fett: true, groesse: 12, farbe: F.strong, v: 'bottom' });
  for (let s = von; s <= bis; s++) {
    const c = ws.getCell(zeile, s);
    c.border = { bottom: { style: 'medium', color: { argb: argb(F.brand) } } };
    if (s > von) c.font = { name: FONT, size: 9, color: { argb: argb(F.muted) } };
  }
  if (hinweis) {
    const c = ws.getCell(zeile, bis);
    c.value = hinweis;
    c.alignment = { horizontal: 'right', vertical: 'bottom' };
    c.font = { name: FONT, size: 9, italic: true, color: { argb: argb(F.muted) } };
  }
  ws.getRow(zeile).height = 22;
}

/** Kopfzeile einer Tabelle: weiß fett auf Marke. Spalten können über mehrere Excel-Spalten gehen. */
type TSpalte = { titel: string; von: number; bis?: number; h?: Stil['h'] };
function tabellenKopf(ws: ExcelJS.Worksheet, zeile: number, spalten: TSpalte[], hoeheZeile = 20) {
  for (const s of spalten) {
    const bis = s.bis ?? s.von;
    flaeche(ws, zeile, s.von, bis, { fuellung: F.brand });
    setze(ws, zeile, s.von, s.titel, { fett: true, groesse: 9, farbe: F.weiss, fuellung: F.brand, v: 'middle', h: s.h ?? 'left', umbruch: true });
    verbinde(ws, zeile, s.von, bis);
  }
  ws.getRow(zeile).height = hoeheZeile;
}

type TZelle = { wert: ExcelJS.CellValue; von: number; bis?: number; stil?: Stil };
function tabellenZeile(ws: ExcelJS.Worksheet, zeile: number, zellen: TZelle[], breiten: number[], maxZeilen = 40) {
  let h = hoehe(1);
  for (const z of zellen) {
    const bis = z.bis ?? z.von;
    const s: Stil = { unten: F.linie, umbruch: true, ...z.stil };
    for (let k = z.von; k <= bis; k++) stil(ws.getCell(zeile, k), s);
    setze(ws, zeile, z.von, z.wert, s);
    verbinde(ws, zeile, z.von, bis);
    if (typeof z.wert === 'string') {
      let b = 0;
      for (let k = z.von; k <= bis; k++) b += breiten[k - 1] ?? 10;
      const g = s.groesse ?? 10;
      h = Math.max(h, hoehe(Math.min(textZeilen(z.wert, b * (s.fett ? 0.92 : 1), g), maxZeilen), g));
    }
  }
  ws.getRow(zeile).height = h;
}

function breitenSetzen(ws: ExcelJS.Worksheet, breiten: number[]) {
  breiten.forEach((b, i) => (ws.getColumn(i + 1).width = b));
}

/* ------------------------------------------------------------------ */
/* Positionen aufbereiten                                              */
/* ------------------------------------------------------------------ */

type Topf = 'material' | 'lohn' | 'sonstiges' | 'zuschlag';
const TOPF_LABEL: Record<Topf, string> = { material: 'Material & Kaufteile', lohn: 'Lohn', sonstiges: 'Oberfläche & Sonstiges', zuschlag: 'Zuschläge' };

/** Ordnet einen Baustein der Preisformel einer Spalte zu. Reihenfolge ist wichtig: "Materialgemeinkosten" ist ein Zuschlag. */
export function topfVon(text: string): Topf {
  const t = text.trim();
  if (/gemeinkosten|^gewinn|skonto|^zuschlag|^aufschlag|erfahrungsfaktor/i.test(t)) return 'zuschlag';
  if (/^(fremdleistung|oberfläche|kran|hebebühne|preis von hand|baustelleneinrichtung)/i.test(t)) return 'sonstiges';
  if (/^(material|einkauf|edelstahl)|kaufteil|gitterrost/i.test(t)) return 'material';
  if (/^(fertigung|montage|herstellung|arbeiten am bestand|stufen montieren|grundaufwand)|h ×|\bstd\b/i.test(t)) return 'lohn';
  return 'sonstiges';
}

type Teil = { text: string; betrag: number; topf: Topf; unter?: Teil[] };

/** Verteilt einen Sammelbaustein (z. B. Treppenwangen, die Material, Fertigung und Montage enthalten) auf seine Bestandteile. */
function aufteilen(b: Baustein, teile: Baustein[]): Teil {
  const summe = teile.reduce((s, t) => s + t.betrag, 0);
  if (!(summe > 0) || teile.length < 2) return { text: b.text, betrag: b.betrag, topf: topfVon(b.text) };
  const faktor = b.betrag / summe;
  const unter: Teil[] = teile.map((t) => ({ text: t.text, betrag: r2(t.betrag * faktor), topf: topfVon(t.text) }));
  const rest = r2(b.betrag - unter.reduce((s, t) => s + t.betrag, 0));
  if (rest !== 0) {
    const groesster = unter.reduce((a, x) => (x.betrag > a.betrag ? x : a), unter[0]);
    groesster.betrag = r2(groesster.betrag + rest);
  }
  return { text: b.text, betrag: b.betrag, topf: 'sonstiges', unter };
}

function zerlege(b: Baustein, p: Position, stamm: Stammdaten): Teil {
  const a = (p.ansatz ?? {}) as { art?: string; ep_hand?: number | null; parameter?: Extract<Ansatz, { art: 'treppe_stk' }>['parameter'] };
  if (a.art === 'treppe_stk' && (a.ep_hand === undefined || a.ep_hand === null)) {
    const par = a.parameter ?? {};
    const t = { ...TREPPE_STANDARD, ...par, gelaender: { ...GELAENDER_STANDARD, ...(par.gelaender ?? {}) } };
    if (/^Wangen/i.test(b.text)) {
      const kgNetto = treppeJeStk(t, stamm).details.kg_stahl / (1 + sd(stamm, 'kleinteile_prozent') / 100);
      const st = stahlJeKg({ kg_gesamt: kgNetto, oberflaeche: t.oberflaeche, montage: t.montage, zuschlag: false }, stamm);
      return aufteilen(b, st.bausteine);
    }
    if (/^Geländer/i.test(b.text)) {
      const gel = gelaenderJeM({ ...t.gelaender, zuschlag: false }, stamm);
      return aufteilen(b, gel.bausteine);
    }
  }
  return { text: b.text, betrag: b.betrag, topf: topfVon(b.text) };
}

type Zeile = {
  p: Position;
  zaehlt: boolean;
  grund: string | null;
  artLabel: string;
  menge: number;
  mengeFehlt: boolean;
  ep: number | null;
  gp: number | null;
  kg: number | null;
  toepfe: Record<Topf, number> | null;
  teile: Teil[];
  hinweise: string[];
  offen: string | null;
  sicherheit: number | null;
  stufe: StufeDef | null;
  status: string;
  hand: boolean;
  gerechnet: boolean;
  vergleichEp: number | null;
  fehlend: string;
  annahmen: string;
};

function stufeVon(s: number): StufeDef {
  return STUFEN.find((x) => s >= x.ab) ?? STUFEN[STUFEN.length - 1];
}

function normPosition(x: unknown, i: number): Position {
  const o = (x ?? {}) as Record<string, unknown>;
  return {
    ...(o as unknown as Position),
    id: String(o.id ?? `pos-${i}`),
    sort: num(o.sort) ?? i,
    oz: (o.oz as string) ?? null,
    kurztext: (o.kurztext as string) ?? null,
    langtext: (o.langtext as string) ?? null,
    menge: num(o.menge),
    einheit: (o.einheit as string) ?? null,
    typ: (o.typ as string) ?? null,
    ansatz: (o.ansatz as Position['ansatz']) ?? {},
    ep: num(o.ep),
    gp: num(o.gp),
    sicherheit: num(o.sicherheit),
    status: ((o.status as string) ?? 'offen') as Position['status'],
    begruendung: (o.begruendung as string) ?? null,
    quelle: (o.quelle as string) ?? null,
  };
}

function aufbereiten(roh: unknown[], stamm: Stammdaten): { zeilen: Zeile[]; basisBE: number } {
  const pos = roh.map(normPosition).sort((a, b) => a.sort - b.sort);
  const preise = mitPreisen(pos, stamm);
  const basisBE = preise.filter((p) => zaehlt(p) && p.ansatz?.art !== 'prozent_be').reduce((s, p) => s + Number(p.gp ?? 0), 0);

  const zeilen = preise.map((p): Zeile => {
    const a = p.ansatz ?? {};
    const hand = a.ep_hand !== undefined && a.ep_hand !== null;
    const art = a.art;
    const z = zaehlt(p);
    const grund = p.typ === 'fremd' ? 'Fremdgewerk' : a.ausgeblendet ? 'ausgeblendet' : a.bedarf ? 'Bedarfsposition' : a.alternativ ? 'Alternativposition' : null;
    const mengeFehlt = p.menge === null || p.menge === undefined;
    const menge = mengeFehlt ? 1 : Number(p.menge);
    const ep = p.ep === null || p.ep === undefined ? null : Number(p.ep);
    const gp = p.gp === null || p.gp === undefined ? null : Number(p.gp);

    let teile: Teil[] = [];
    let hinweise: string[] = [];
    let offen: string | null = null;
    let kgGesamt: number | undefined;
    let vergleichEp: number | null = null;

    if (art === 'prozent_be' && !hand) {
      const prozent = Number((a as { prozent?: number }).prozent ?? 5);
      teile = ep === null ? [] : [{ text: `Baustelleneinrichtung ${deZahl(prozent)} % von ${deEuro(basisBE)}${menge !== 1 ? `, geteilt durch Menge ${deZahl(menge, 3)}` : ''}`, betrag: ep, topf: 'sonstiges' }];
      hinweise = [`Basis ist die Summe aller übrigen Positionen, die zur Summe zählen. Die Baustelleneinrichtung wird zuletzt gerechnet.`];
    } else {
      const r = preis(p, stamm);
      teile = r.bausteine.map((b) => zerlege(b, p, stamm));
      hinweise = r.hinweise;
      offen = r.offen ?? null;
      kgGesamt = r.kg_gesamt;
      if (hand && art && art !== 'manuell' && art !== 'prozent_be') {
        try {
          const f = rechnePosition(a as Ansatz, menge, stamm);
          vergleichEp = f.ep;
          kgGesamt = f.kg_gesamt;
        } catch {
          vergleichEp = null;
        }
      }
    }

    // Gewicht je Einheit
    const mKg = menge > 0 ? menge : 1;
    let kg: number | null = null;
    if (art === 'stahl_kg' && Number(a.kg_je_einheit) > 0) kg = Number(a.kg_je_einheit);
    else if (kgGesamt && kgGesamt > 0) kg = kgGesamt / mKg;

    // Preisaufbau je Einheit, auf den Cent genau gleich dem EP der App
    let toepfe: Record<Topf, number> | null = null;
    if (ep !== null) {
      const t: Record<Topf, number> = { material: 0, lohn: 0, sonstiges: 0, zuschlag: 0 };
      if (art === 'prozent_be' && !hand) t.sonstiges = ep;
      else for (const x of teile) for (const b of x.unter ?? [x]) t[b.topf] += b.betrag;
      (Object.keys(t) as Topf[]).forEach((k) => (t[k] = r2(t[k])));
      const diff = r2(ep - (t.material + t.lohn + t.sonstiges + t.zuschlag));
      if (diff !== 0) t.sonstiges = r2(t.sonstiges + diff);
      toepfe = t;
      const diffTeile = r2(ep - teile.reduce((s, x) => s + x.betrag, 0));
      if (diffTeile !== 0) teile.push({ text: 'Rundungsausgleich auf den Einheitspreis', betrag: diffTeile, topf: 'sonstiges' });
    }

    const sicherheit = p.status === 'offen' ? null : p.quelle === 'hand' || p.sicherheit === null || p.sicherheit === undefined ? 1 : Math.max(0, Math.min(1, Number(p.sicherheit)));
    const artLabel = hand ? 'Preis von Hand' : art ? ART_LABEL[art] ?? art : p.typ === 'fremd' ? 'Fremdgewerk' : 'Noch nicht kalkuliert';

    return {
      p,
      zaehlt: z,
      grund,
      artLabel: grund && grund !== 'Fremdgewerk' ? `${artLabel}, ${grund}` : artLabel,
      menge,
      mengeFehlt,
      ep,
      gp,
      kg,
      toepfe,
      teile,
      hinweise,
      offen,
      sicherheit,
      stufe: sicherheit === null ? null : stufeVon(sicherheit),
      status: POS_STATUS[p.status] ?? p.status,
      hand,
      gerechnet: !!art || hand,
      vergleichEp,
      fehlend: (a.ki?.fehlende_angaben ?? '').trim(),
      annahmen: (p.begruendung ?? '').trim(),
    };
  });
  return { zeilen, basisBE };
}

/* ------------------------------------------------------------------ */
/* Blatt Kalkulation                                                   */
/* ------------------------------------------------------------------ */

const KS = { oz: 1, kurz: 2, menge: 3, einheit: 4, ansatz: 5, kg: 6, mat: 7, lohn: 8, sonst: 9, zus: 10, ep: 11, gp: 12, eurkg: 13, sich: 14, stufe: 15, status: 16, summe: 17, annahmen: 18, fehlt: 19 };
const K_BREITEN = [9, 36, 9, 7, 20, 11, 12, 11, 12, 11, 12, 14, 10, 11, 12, 12, 8, 64, 46];
const K_ERSTE = 5;

type KalkInfo = { erste: number; letzte: number; summeZeile: number; zeileVon: Map<string, number> };

function blattKalkulation(wb: ExcelJS.Workbook, projekt: ExcelProjekt, zeilen: Zeile[]): KalkInfo {
  const ws = wb.addWorksheet('Kalkulation', { properties: { tabColor: { argb: argb(F.strong) } } });
  breitenSetzen(ws, K_BREITEN);
  const letzteSpalte = K_BREITEN.length;

  // Zeile 1 und 2: kurzer Titel (bleibt links neben der Fixierung lesbar)
  flaeche(ws, 1, 1, letzteSpalte, { fuellung: F.brand });
  setze(ws, 1, 1, 'Kalkulation zum Nachprüfen', { fett: true, groesse: 13, farbe: F.weiss, fuellung: F.brand, v: 'middle' });
  ws.getRow(1).height = 24;
  setze(ws, 2, 1, projekt.titel || 'Kalkulation', { groesse: 10, farbe: F.muted, v: 'middle' });
  setze(ws, 2, KS.mat, 'Alle Beträge netto. Je Einheit: Material & Kaufteile + Lohn + Oberfläche & Sonstiges + Zuschläge = EP. GP = Menge × EP, auf den Cent gerundet.', { groesse: 9, farbe: F.muted, kursiv: true, v: 'middle' });
  ws.getRow(2).height = 18;

  // Zeile 3: Gruppen
  const gruppen: [number, number, string][] = [
    [KS.oz, KS.kurz, 'Position'],
    [KS.menge, KS.kg, 'Menge und Ansatz'],
    [KS.mat, KS.ep, 'Preisaufbau je Einheit'],
    [KS.gp, KS.eurkg, 'Gesamt'],
    [KS.sich, KS.summe, 'Sicherheit und Stand'],
    [KS.annahmen, KS.fehlt, 'Annahmen und offene Punkte der KI'],
  ];
  for (const [von, bis, t] of gruppen) {
    flaeche(ws, 3, von, bis, { fuellung: F.tint });
    setze(ws, 3, von, t, { fett: true, groesse: 9, farbe: F.strong, fuellung: F.tint, v: 'middle', h: von === KS.oz ? 'left' : 'center' });
    verbinde(ws, 3, von, bis);
    ws.getCell(3, bis).border = { right: { style: 'thin', color: { argb: argb(F.weiss) } } };
  }
  ws.getRow(3).height = 18;

  // Zeile 4: Spaltenköpfe
  const koepfe: [number, string, Stil['h']][] = [
    [KS.oz, 'OZ', 'left'],
    [KS.kurz, 'Kurztext', 'left'],
    [KS.menge, 'Menge', 'right'],
    [KS.einheit, 'Einheit', 'left'],
    [KS.ansatz, 'Ansatz', 'left'],
    [KS.kg, 'kg je Einheit', 'right'],
    [KS.mat, 'Material & Kaufteile €/E', 'right'],
    [KS.lohn, 'Lohn €/E', 'right'],
    [KS.sonst, 'Oberfläche & Sonstiges €/E', 'right'],
    [KS.zus, 'Zuschläge €/E', 'right'],
    [KS.ep, 'EP', 'right'],
    [KS.gp, 'GP', 'right'],
    [KS.eurkg, '€/kg', 'right'],
    [KS.sich, 'Sicherheit %', 'right'],
    [KS.stufe, 'Stufe', 'left'],
    [KS.status, 'Status', 'left'],
    [KS.summe, 'In Summe', 'center'],
    [KS.annahmen, 'Annahmen der KI', 'left'],
    [KS.fehlt, 'Fehlende Angaben', 'left'],
  ];
  for (const [s, t, h] of koepfe) setze(ws, 4, s, t, { fett: true, groesse: 9, farbe: F.weiss, fuellung: F.brand, v: 'middle', h, umbruch: true });
  ws.getRow(4).height = 30;
  ws.getCell(4, KS.sich).note = 'Wie sicher die KI ihre Kalkulation selbst einschätzt. Handeingaben gelten als 100 %.';
  ws.getCell(4, KS.summe).note = 'Nein bei Bedarfs- und Alternativpositionen, Fremdgewerken und ausgeblendeten Positionen. Sie zählen nicht zur Summe netto.';
  ws.getCell(4, KS.ep).note = 'Formel: Summe der vier Spalten je Einheit davor.';

  const zeileVon = new Map<string, number>();
  let r = K_ERSTE;
  for (const z of zeilen) {
    zeileVon.set(z.p.id, r);
    const grau = !z.zaehlt;
    const basis: Stil = { unten: F.linie, farbe: grau ? F.grau : F.ink, kursiv: grau };
    const zahl = (s: number, wert: ExcelJS.CellValue, format?: string, extra: Stil = {}) => setze(ws, r, s, wert, { ...basis, h: 'right', format, ...extra });

    setze(ws, r, KS.oz, z.p.oz ?? '', { ...basis, fett: !grau });
    setze(ws, r, KS.kurz, z.p.kurztext ?? '', { ...basis, umbruch: true });
    const mc = zahl(KS.menge, z.menge, mengenFormat(z.menge));
    if (z.mengeFehlt) mc.note = 'Menge fehlt in der Position, mit 1 gerechnet wie in der App.';
    setze(ws, r, KS.einheit, z.p.einheit ?? '', { ...basis, einzug: 1 });
    setze(ws, r, KS.ansatz, z.artLabel, { ...basis, umbruch: true, farbe: grau || !z.gerechnet ? F.grau : F.ink });
    zahl(KS.kg, z.kg ?? null, z.kg ? kgFormat(z.kg) : undefined);

    if (z.toepfe && z.ep !== null) {
      zahl(KS.mat, z.toepfe.material, EUR_OHNE_NULL);
      zahl(KS.lohn, z.toepfe.lohn, EUR_OHNE_NULL);
      zahl(KS.sonst, z.toepfe.sonstiges, EUR_OHNE_NULL);
      zahl(KS.zus, z.toepfe.zuschlag, EUR_OHNE_NULL);
      zahl(KS.ep, { formula: `SUM(${sp(KS.mat)}${r}:${sp(KS.zus)}${r})`, result: z.ep }, EUR, { fett: !grau });
      zahl(KS.gp, { formula: `ROUND(${sp(KS.menge)}${r}*${sp(KS.ep)}${r},2)`, result: r2(z.menge * z.ep) }, EUR, { fett: !grau });
      if (z.kg && z.kg > 0) zahl(KS.eurkg, { formula: `${sp(KS.ep)}${r}/${sp(KS.kg)}${r}`, result: z.ep / z.kg }, EUR_KG);
      else zahl(KS.eurkg, null);
    } else {
      for (const s of [KS.mat, KS.lohn, KS.sonst, KS.zus, KS.ep, KS.gp, KS.eurkg]) zahl(s, null);
      if (z.offen) {
        setze(ws, r, KS.ep, z.offen, { ...basis, h: 'right', farbe: F.grau, kursiv: true });
      }
    }

    if (z.sicherheit !== null && z.stufe) {
      const farbig: Stil = grau ? {} : { fuellung: z.stufe.bg, farbe: z.stufe.fg, fett: true };
      zahl(KS.sich, z.sicherheit, PROZENT, farbig);
      setze(ws, r, KS.stufe, z.stufe.label, { ...basis, ...farbig });
    } else {
      zahl(KS.sich, null);
      setze(ws, r, KS.stufe, '', basis);
    }
    const statusStil: Stil = z.p.status === 'freigegeben' && !grau ? { farbe: F.ok, fett: true } : z.p.status === 'offen' ? { farbe: F.grau } : {};
    setze(ws, r, KS.status, z.status, { ...basis, ...statusStil });
    setze(ws, r, KS.summe, z.zaehlt ? 'Ja' : 'Nein', { ...basis, h: 'center' });
    setze(ws, r, KS.annahmen, z.annahmen, { ...basis, umbruch: true, groesse: 9 });
    setze(ws, r, KS.fehlt, z.fehlend, { ...basis, umbruch: true, groesse: 9 });

    // Lange KI-Texte höchstens acht Zeilen hoch, der volle Text steht im Rechenweg
    ws.getRow(r).height = Math.max(
      hoehe(textZeilen(z.p.kurztext, K_BREITEN[KS.kurz - 1])),
      hoehe(textZeilen(z.artLabel, K_BREITEN[KS.ansatz - 1])),
      hoehe(Math.min(textZeilen(z.annahmen, K_BREITEN[KS.annahmen - 1], 9), 8), 9),
      hoehe(Math.min(textZeilen(z.fehlend, K_BREITEN[KS.fehlt - 1], 9), 8), 9),
    );
    r++;
  }
  if (!zeilen.length) {
    setze(ws, r, KS.kurz, 'Keine Positionen vorhanden', { farbe: F.grau, kursiv: true });
    r++;
  }
  const erste = K_ERSTE;
  const letzte = r - 1;

  // Summen
  const L = (s: number) => `$${sp(s)}$${erste}:$${sp(s)}$${letzte}`;
  const summe = zeilen.filter((z) => z.zaehlt).reduce((s, z) => s + (z.ep !== null ? r2(z.menge * z.ep) : 0), 0);
  const frei = zeilen.filter((z) => z.zaehlt && z.p.status === 'freigegeben').reduce((s, z) => s + (z.ep !== null ? r2(z.menge * z.ep) : 0), 0);
  const nicht = zeilen.filter((z) => !z.zaehlt).reduce((s, z) => s + (z.ep !== null ? r2(z.menge * z.ep) : 0), 0);

  r++;
  const summeZeile = r;
  const summen: [string, string, number, boolean][] = [
    ['Summe netto', `SUMIFS(${L(KS.gp)},${L(KS.summe)},"Ja")`, summe, true],
    ['davon freigegeben', `SUMIFS(${L(KS.gp)},${L(KS.summe)},"Ja",${L(KS.status)},"Freigegeben")`, frei, false],
    ['Nicht in der Summe (Bedarf, Alternativ, Fremdgewerk, ausgeblendet)', `SUMIFS(${L(KS.gp)},${L(KS.summe)},"Nein")`, nicht, false],
  ];
  for (const [label, formel, wert, haupt] of summen) {
    const s: Stil = haupt ? { fett: true, groesse: 11, fuellung: F.tint, farbe: F.strong, oben: F.brand, obenDick: true, v: 'middle' } : { farbe: F.muted, v: 'middle' };
    flaeche(ws, r, 1, letzteSpalte, haupt ? { fuellung: F.tint, oben: F.brand, obenDick: true } : {});
    setze(ws, r, KS.kurz, label, { ...s, umbruch: true });
    setze(ws, r, KS.gp, { formula: formel, result: r2(wert) }, { ...s, h: 'right', format: EUR });
    ws.getRow(r).height = haupt ? 22 : 18;
    r++;
  }

  ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 4, topLeftCell: 'C5', activeCell: 'C5', showGridLines: false }];
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: letzte, column: letzteSpalte } };
  druck(ws, 'A3', '3:4');
  fusszeile(ws, `${projekt.titel}, Kalkulation`);
  return { erste, letzte, summeZeile, zeileVon };
}

/* ------------------------------------------------------------------ */
/* Blatt Rechenweg                                                     */
/* ------------------------------------------------------------------ */

const R_BREITEN = [88, 26, 16];

function blattRechenweg(wb: ExcelJS.Workbook, projekt: ExcelProjekt, zeilen: Zeile[], kalk: KalkInfo) {
  const ws = wb.addWorksheet('Rechenweg');
  breitenSetzen(ws, R_BREITEN);
  const breite = R_BREITEN.reduce((a, b) => a + b, 0);

  flaeche(ws, 1, 1, 3, { fuellung: F.brand });
  setze(ws, 1, 1, 'Rechenweg je Position', { fett: true, groesse: 13, farbe: F.weiss, fuellung: F.brand, v: 'middle' });
  ws.getRow(1).height = 24;
  setze(ws, 2, 1, 'So entsteht jeder Einheitspreis: Bausteine aus Ansatz und Stammdaten, zusammen der EP, mal Menge der GP. Die Zuordnung zeigt, in welcher Spalte der Kalkulation der Betrag steht.', { groesse: 9, farbe: F.muted, kursiv: true, umbruch: true, v: 'middle' });
  verbinde(ws, 2, 1, 3);
  ws.getRow(2).height = hoehe(textZeilen('So entsteht jeder Einheitspreis: Bausteine aus Ansatz und Stammdaten, zusammen der EP, mal Menge der GP. Die Zuordnung zeigt, in welcher Spalte der Kalkulation der Betrag steht.', breite, 9), 9);
  tabellenKopf(ws, 3, [
    { titel: 'Baustein', von: 1 },
    { titel: 'Zuordnung in der Kalkulation', von: 2 },
    { titel: '€ je Einheit', von: 3, h: 'right' },
  ]);

  let r = 5;
  const offen: string[] = [];
  const textZeile = (inhalt: ExcelJS.CellValue, laenge: string, s: Stil = {}) => {
    const g = s.groesse ?? 9;
    setze(ws, r, 1, inhalt, { umbruch: true, groesse: 9, ...s });
    verbinde(ws, r, 1, 3);
    ws.getRow(r).height = hoehe(Math.min(textZeilen(laenge, breite, g), 40), g);
    r++;
  };

  for (const z of zeilen) {
    if (!z.gerechnet && z.ep === null) {
      if (z.p.typ !== 'fremd') offen.push(z.p.oz || z.p.kurztext || '?');
      continue;
    }
    const kz = kalk.zeileVon.get(z.p.id) ?? kalk.erste;

    // Kopf des Blocks
    const kopf = `${z.p.oz ? `${z.p.oz}   ` : ''}${z.p.kurztext ?? ''}`;
    setze(ws, r, 1, kopf, { fett: true, groesse: 10, fuellung: F.tint, farbe: F.ink, v: 'middle', umbruch: true });
    setze(ws, r, 2, z.artLabel, { fuellung: F.tint, farbe: F.strong, groesse: 9, v: 'middle', umbruch: true });
    if (z.p.status === 'freigegeben') setze(ws, r, 3, 'Freigegeben', { fuellung: 'DCFCE7', farbe: F.ok, fett: true, groesse: 9, h: 'right', v: 'middle' });
    else if (z.stufe && z.sicherheit !== null) setze(ws, r, 3, `${Math.round(z.sicherheit * 100)} %  ${z.stufe.label}`, { fuellung: z.stufe.bg, farbe: z.stufe.fg, fett: true, groesse: 9, h: 'right', v: 'middle' });
    else setze(ws, r, 3, z.status, { fuellung: F.tint, farbe: F.muted, groesse: 9, h: 'right', v: 'middle' });
    ws.getRow(r).height = Math.max(20, hoehe(textZeilen(kopf, R_BREITEN[0] * 0.92)));
    r++;

    // Bausteine
    const oben: string[] = [];
    for (const t of z.teile) {
      setze(ws, r, 1, t.text, { umbruch: true, unten: F.linie });
      if (t.unter?.length) {
        setze(ws, r, 2, 'aufgeteilt, siehe darunter', { farbe: F.muted, kursiv: true, groesse: 9, unten: F.linie });
        const von = r + 1;
        const bis = r + t.unter.length;
        setze(ws, r, 3, { formula: `SUM(C${von}:C${bis})`, result: t.betrag }, { h: 'right', format: EUR, unten: F.linie });
        oben.push(`C${r}`);
        ws.getRow(r).height = hoehe(textZeilen(t.text, R_BREITEN[0]));
        r++;
        for (const u of t.unter) {
          setze(ws, r, 1, `davon ${u.text}`, { umbruch: true, farbe: F.muted, einzug: 2, unten: F.linie });
          setze(ws, r, 2, TOPF_LABEL[u.topf], { farbe: F.muted, groesse: 9, unten: F.linie });
          setze(ws, r, 3, u.betrag, { h: 'right', format: EUR, farbe: F.muted, unten: F.linie });
          ws.getRow(r).height = hoehe(textZeilen(`davon ${u.text}`, R_BREITEN[0] - 4));
          r++;
        }
      } else {
        setze(ws, r, 2, TOPF_LABEL[t.topf], { farbe: F.muted, groesse: 9, unten: F.linie });
        setze(ws, r, 3, t.betrag, { h: 'right', format: EUR, unten: F.linie });
        oben.push(`C${r}`);
        ws.getRow(r).height = hoehe(textZeilen(t.text, R_BREITEN[0]));
        r++;
      }
    }

    // EP, Menge, GP
    let epZelle: string | null = null;
    if (z.ep !== null) {
      setze(ws, r, 1, 'Einheitspreis (EP)', { fett: true, oben: F.brand });
      setze(ws, r, 2, '', { oben: F.brand });
      setze(ws, r, 3, oben.length ? { formula: `SUM(${oben.join(',')})`, result: z.ep } : z.ep, { fett: true, h: 'right', format: EUR, oben: F.brand });
      epZelle = `C${r}`;
      r++;
      setze(ws, r, 1, z.mengeFehlt ? 'Menge (fehlt in der Position, mit 1 gerechnet)' : 'Menge');
      setze(ws, r, 2, z.p.einheit ?? '', { farbe: F.muted });
      setze(ws, r, 3, { formula: `'Kalkulation'!${sp(KS.menge)}${kz}`, result: z.menge }, { h: 'right', format: mengenFormat(z.menge) });
      const mengeZelle = `C${r}`;
      r++;
      setze(ws, r, 1, 'Gesamtpreis (GP)', { fett: true });
      setze(ws, r, 2, z.zaehlt ? '' : `zählt nicht zur Summe`, { farbe: F.grau, kursiv: true, groesse: 9 });
      setze(ws, r, 3, { formula: `ROUND(${mengeZelle}*${epZelle},2)`, result: r2(z.menge * z.ep) }, { fett: true, h: 'right', format: EUR });
      r++;
      if (z.kg && z.kg > 0) {
        setze(ws, r, 1, `Preis je kg (${deZahl(z.kg, 2)} kg je Einheit)`, { farbe: F.muted });
        setze(ws, r, 3, { formula: `${epZelle}/'Kalkulation'!${sp(KS.kg)}${kz}`, result: z.ep / z.kg }, { h: 'right', format: EUR_KG, farbe: F.muted });
        r++;
      }
    } else {
      textZeile(`Noch kein Preis${z.offen ? `: ${z.offen}` : ''}.`, 'x', { farbe: F.grau, kursiv: true, groesse: 10 });
    }

    // Erläuterungen
    const formelText = z.hinweise.filter(Boolean).join('\n');
    if (formelText) textZeile({ richText: [{ text: 'Aus der Formel: ', font: { name: FONT, size: 9, bold: true, color: { argb: argb(F.muted) } } }, { text: formelText, font: { name: FONT, size: 9, color: { argb: argb(F.muted) } } }] }, `Aus der Formel: ${formelText}`);
    if (z.vergleichEp !== null) {
      const t = `Zum Vergleich: Die Formel (${ART_LABEL[z.p.ansatz.art ?? ''] ?? z.p.ansatz.art}) ergäbe ${deEuro(z.vergleichEp)} je Einheit, der Preis von Hand liegt bei ${deEuro(z.ep ?? 0)}.`;
      textZeile(t, t, { farbe: F.muted });
    }
    const label = (titel: string, text: string, farbe = F.ink) => ({
      richText: [
        { text: `${titel}: `, font: { name: FONT, size: 9, bold: true, color: { argb: argb(F.strong) } } },
        { text, font: { name: FONT, size: 9, color: { argb: argb(farbe) } } },
      ],
    });
    if (z.annahmen) textZeile(label('Annahmen der KI', z.annahmen), `Annahmen der KI: ${z.annahmen}`);
    if (z.fehlend) textZeile(label('Fehlende Angaben', z.fehlend), `Fehlende Angaben: ${z.fehlend}`);
    if (z.p.langtext) textZeile(label('Langtext', z.p.langtext, F.muted), `Langtext: ${z.p.langtext}`);
    r++;
  }

  if (offen.length) {
    const t = `Noch nicht kalkuliert: ${offen.join(', ')}`;
    textZeile(t, t, { farbe: F.muted, kursiv: true, groesse: 10 });
  }

  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 3, topLeftCell: 'A4', activeCell: 'A5', showGridLines: false }];
  druck(ws, 'A4', '3:3');
  fusszeile(ws, `${projekt.titel}, Rechenweg`);
}

/* ------------------------------------------------------------------ */
/* Prüfbericht und Bieterfragen                                        */
/* ------------------------------------------------------------------ */

type PruefDaten = {
  pruefung: Pruefung | null;
  abgleich: Abgleich | null;
  altHinweise: string[];
  bieterfragen: Bieterfrage[];
};

function pruefDaten(ergebnis: Record<string, unknown> | null | undefined): PruefDaten {
  const e = (ergebnis ?? {}) as { pruefung?: Pruefung; abgleich?: Abgleich; hinweise?: unknown };
  const pruefung = e.pruefung && typeof e.pruefung === 'object' ? e.pruefung : null;
  const abgleich = e.abgleich && typeof e.abgleich === 'object' ? e.abgleich : null;
  const altHinweise = Array.isArray(e.hinweise)
    ? (e.hinweise as unknown[])
        .map((h) => (typeof h === 'string' ? h : h && typeof h === 'object' ? String((h as { text?: string; titel?: string }).text ?? (h as { titel?: string }).titel ?? '') : ''))
        .filter((h) => h.trim())
    : [];
  const bieterfragen = [...(pruefung?.bieterfragen ?? []), ...(abgleich?.bieterfragen ?? [])].filter((b) => b && b.frage);
  bieterfragen.sort((a, b) => (a.stufe === 'kritisch' ? 0 : 1) - (b.stufe === 'kritisch' ? 0 : 1));
  return { pruefung, abgleich, altHinweise, bieterfragen };
}

const P_BREITEN = [12, 14, 14, 30, 42, 40, 18, 22];

function blattPruefbericht(wb: ExcelJS.Workbook, projekt: ExcelProjekt, d: PruefDaten) {
  const ws = wb.addWorksheet('Prüfbericht', { properties: { tabColor: { argb: argb('DC2626') } } });
  breitenSetzen(ws, P_BREITEN);
  const n = P_BREITEN.length;
  const breiteAlle = P_BREITEN.reduce((a, b) => a + b, 0);
  let r = kopfband(ws, 1, n, 'Prüfbericht', [projekt.titel, 'Was in Vorbemerkungen und Plänen auffällt und was das für die Kalkulation heißt.']);
  r++;

  const freitext = (text: string, s: Stil = {}) => {
    setze(ws, r, 1, text, { umbruch: true, ...s });
    verbinde(ws, r, 1, n);
    ws.getRow(r).height = hoehe(textZeilen(text, breiteAlle), s.groesse ?? 10);
    r++;
  };
  const stufenZelle = (stufe: string, von: number): TZelle => {
    const st = HINWEIS_STUFE[stufe] ?? HINWEIS_STUFE.info;
    return { wert: st.label, von, stil: { fuellung: st.bg, farbe: st.fg, fett: true } };
  };
  const datum = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' }) : '');

  if (d.pruefung) {
    const hinweise = [...(d.pruefung.hinweise ?? [])].sort((a, b) => (HINWEIS_STUFE[a.stufe]?.rang ?? 3) - (HINWEIS_STUFE[b.stufe]?.rang ?? 3));
    const k = hinweise.filter((h) => h.stufe === 'kritisch').length;
    abschnitt(ws, r, 1, n, 'Prüfung der Vorbemerkungen', `${hinweise.length} Hinweise, davon ${k} kritisch${d.pruefung.datum ? `, geprüft am ${datum(d.pruefung.datum)}` : ''}`);
    r++;
    if (d.pruefung.zusammenfassung) freitext(d.pruefung.zusammenfassung, { farbe: F.ink });
    r++;
    if (hinweise.length) {
      tabellenKopf(ws, r, [
        { titel: 'Stufe', von: 1 },
        { titel: 'Thema', von: 2 },
        { titel: 'Titel', von: 3, bis: 4 },
        { titel: 'Was gefordert ist', von: 5 },
        { titel: 'Für die Kalkulation', von: 6 },
        { titel: 'Fundstelle', von: 7 },
        { titel: 'Positionen', von: 8 },
      ]);
      r++;
      for (const h of hinweise as PruefHinweis[]) {
        tabellenZeile(ws, r, [
          stufenZelle(h.stufe, 1),
          { wert: THEMA[h.thema] ?? h.thema ?? '', von: 2 },
          { wert: h.titel ?? '', von: 3, bis: 4, stil: { fett: true } },
          { wert: h.text ?? '', von: 5 },
          { wert: h.folge ?? '', von: 6 },
          { wert: h.fundstelle ?? '', von: 7, stil: { farbe: F.muted } },
          { wert: (h.oz ?? []).join(', '), von: 8 },
        ], P_BREITEN);
        r++;
      }
    }
    r++;
  } else if (d.altHinweise.length) {
    const titel = projekt.typ === 'zeichnung' ? 'Hinweise aus den Zeichnungen' : projekt.typ === 'lv' ? 'Hinweise aus den Vorbemerkungen' : 'Hinweise';
    abschnitt(ws, r, 1, n, titel, `${d.altHinweise.length} Hinweise`);
    r++;
    tabellenKopf(ws, r, [
      { titel: 'Nr', von: 1 },
      { titel: 'Hinweis', von: 2, bis: n },
    ]);
    r++;
    d.altHinweise.forEach((h, i) => {
      tabellenZeile(ws, r, [
        { wert: i + 1, von: 1, stil: { farbe: F.muted, h: 'left' } },
        { wert: h, von: 2, bis: n },
      ], P_BREITEN);
      r++;
    });
    r++;
  }

  const a = d.abgleich;
  if (a) {
    abschnitt(ws, r, 1, n, 'Plan gegen LV', a.datum ? `geprüft am ${datum(a.datum)}` : undefined);
    r++;
    if (a.plaene?.length) freitext(`Geprüfte Pläne: ${a.plaene.join(', ')}`, { farbe: F.muted, groesse: 9 });
    if (a.zusammenfassung) freitext(a.zusammenfassung);
    r++;

    const unter = (titel: string) => {
      setze(ws, r, 1, titel, { fett: true, farbe: F.strong, v: 'bottom' });
      ws.getRow(r).height = 20;
      r++;
    };
    const leer = (text: string) => {
      setze(ws, r, 1, text, { farbe: F.muted, kursiv: true, groesse: 9 });
      r++;
      r++;
    };

    if (Array.isArray(a.widersprueche)) {
      unter('Widersprüche Plan gegen LV');
      if (a.widersprueche.length) {
        tabellenKopf(ws, r, [
          { titel: 'Stufe', von: 1 },
          { titel: 'OZ', von: 2 },
          { titel: 'Merkmal', von: 3 },
          { titel: 'Im LV', von: 4 },
          { titel: 'Im Plan', von: 5 },
          { titel: 'Fundstelle', von: 6 },
          { titel: 'Folge', von: 7, bis: 8 },
        ]);
        r++;
        const liste = [...a.widersprueche].sort((x, y) => (x.stufe === 'kritisch' ? 0 : 1) - (y.stufe === 'kritisch' ? 0 : 1));
        for (const w of liste as Widerspruch[]) {
          tabellenZeile(ws, r, [
            stufenZelle(w.stufe, 1),
            { wert: w.oz ?? '', von: 2, stil: { fett: true } },
            { wert: MERKMAL[w.merkmal] ?? w.merkmal ?? '', von: 3 },
            { wert: w.lv ?? '', von: 4 },
            { wert: w.plan ?? '', von: 5 },
            { wert: w.fundstelle ?? '', von: 6, stil: { farbe: F.muted } },
            { wert: w.folge ?? '', von: 7, bis: 8 },
          ], P_BREITEN);
          r++;
        }
        r++;
      } else leer('Keine Widersprüche zwischen Plan und LV gefunden.');
    }

    unter('Im Plan, aber nicht im LV');
    if (a.fehlt_im_lv?.length) {
      tabellenKopf(ws, r, [
        { titel: 'Bauteil', von: 1, bis: 3 },
        { titel: 'Hinweis', von: 4, bis: 5 },
        { titel: 'Fundstelle', von: 6 },
        { titel: 'Menge im Plan', von: 7, h: 'right' },
        { titel: 'Einheit', von: 8 },
      ]);
      r++;
      for (const f of a.fehlt_im_lv) {
        const m = num(f.menge_plan);
        tabellenZeile(ws, r, [
          { wert: f.bauteil ?? '', von: 1, bis: 3, stil: { fett: true } },
          { wert: f.hinweis ?? '', von: 4, bis: 5 },
          { wert: f.fundstelle ?? '', von: 6, stil: { farbe: F.muted } },
          { wert: m, von: 7, stil: { h: 'right', format: m !== null ? mengenFormat(m) : undefined } },
          { wert: f.einheit ?? '', von: 8 },
        ], P_BREITEN);
        r++;
      }
      r++;
    } else leer('Nichts gefunden.');

    unter('Im LV, aber nicht im Plan');
    if (a.nicht_im_plan?.length) {
      tabellenKopf(ws, r, [
        { titel: 'OZ', von: 1 },
        { titel: 'Hinweis', von: 2, bis: n },
      ]);
      r++;
      for (const f of a.nicht_im_plan) {
        tabellenZeile(ws, r, [
          { wert: f.oz ?? '', von: 1, stil: { fett: true } },
          { wert: f.hinweis ?? '', von: 2, bis: n },
        ], P_BREITEN);
        r++;
      }
      r++;
    } else leer('Nichts gefunden.');

    unter('Mengen Plan gegen LV');
    if (a.mengen?.length) {
      tabellenKopf(ws, r, [
        { titel: 'OZ', von: 1 },
        { titel: 'Menge im LV', von: 2, h: 'right' },
        { titel: 'Menge im Plan', von: 3, h: 'right' },
        { titel: 'Einheit', von: 4 },
        { titel: 'Hinweis', von: 5, bis: n },
      ]);
      r++;
      for (const m of a.mengen) {
        const lv = num(m.menge_lv);
        const pl = num(m.menge_plan);
        tabellenZeile(ws, r, [
          { wert: m.oz ?? '', von: 1, stil: { fett: true } },
          { wert: lv, von: 2, stil: { h: 'right', format: lv !== null ? mengenFormat(lv) : undefined } },
          { wert: pl, von: 3, stil: { h: 'right', format: pl !== null ? mengenFormat(pl) : undefined } },
          { wert: m.einheit ?? '', von: 4 },
          { wert: m.hinweis ?? '', von: 5, bis: n },
        ], P_BREITEN);
        r++;
      }
      r++;
    } else leer('Keine Mengenabweichungen gemeldet.');
  }

  ws.views = [{ showGridLines: false }];
  druck(ws, 'A4');
  fusszeile(ws, `${projekt.titel}, Prüfbericht`);
}

const B_BREITEN = [6, 12, 18, 72, 52];

function blattBieterfragen(wb: ExcelJS.Workbook, projekt: ExcelProjekt, fragen: Bieterfrage[]) {
  const ws = wb.addWorksheet('Bieterfragen', { properties: { tabColor: { argb: argb('EAB308') } } });
  breitenSetzen(ws, B_BREITEN);
  const n = B_BREITEN.length;
  let r = kopfband(ws, 1, n, 'Bieterfragen', [projekt.titel, `${fragen.length} ${fragen.length === 1 ? 'Frage' : 'Fragen'} an die Vergabestelle, fertig formuliert`]);
  r++;
  flaeche(ws, r, 1, n, { fuellung: 'FEF6C7' });
  setze(ws, r, 1, 'Vorschläge von AIM. Vor dem Absenden selbst prüfen.', { fett: true, farbe: '7A5200', fuellung: 'FEF6C7', v: 'middle' });
  ws.getRow(r).height = 22;
  r += 2;
  tabellenKopf(ws, r, [
    { titel: 'Nr', von: 1 },
    { titel: 'Stufe', von: 2 },
    { titel: 'Bezug', von: 3 },
    { titel: 'Frage', von: 4 },
    { titel: 'Warum fragen', von: 5 },
  ]);
  const kopfZeile = r;
  r++;
  fragen.forEach((f, i) => {
    const st = HINWEIS_STUFE[f.stufe] ?? HINWEIS_STUFE.beachten;
    tabellenZeile(ws, r, [
      { wert: i + 1, von: 1, stil: { farbe: F.muted, h: 'left' } },
      { wert: st.label, von: 2, stil: { fuellung: st.bg, farbe: st.fg, fett: true } },
      { wert: f.bezug ?? '', von: 3, stil: { fett: true } },
      { wert: f.frage ?? '', von: 4 },
      { wert: f.begruendung ?? '', von: 5, stil: { farbe: F.muted } },
    ], B_BREITEN);
    r++;
  });
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: kopfZeile, showGridLines: false }];
  druck(ws, 'A4', `${kopfZeile}:${kopfZeile}`);
  fusszeile(ws, `${projekt.titel}, Bieterfragen`);
}

/* ------------------------------------------------------------------ */
/* Blatt Übersicht                                                     */
/* ------------------------------------------------------------------ */

const U_BREITEN = [2, 16, 15, 14, 14, 16, 14, 15, 15, 2];

const GRUNDLAGEN: { key: string; label: string }[] = [
  { key: 'satz_werkstatt', label: 'Stundensatz Werkstatt' },
  { key: 'satz_montage', label: 'Stundensatz Montage' },
  { key: 'stahl_einkauf_kg', label: 'Stahl Einkauf' },
  { key: 'zuschlag_wg_prozent', label: 'Materialzuschlag' },
  { key: 'zuschlag_lohn_prozent', label: 'Lohnzuschlag' },
  { key: 'kleinteile_prozent', label: 'Kleinteile' },
  { key: 'befestigung_prozent', label: 'Befestigung' },
  { key: 'verzinkung_eur_kg', label: 'Verzinkung' },
  { key: 'grundierung_eur_kg', label: 'Grundierung' },
];
const GRUNDLAGEN_ZEICHNUNG: { key: string; label: string }[] = [
  { key: 'zs_mgk', label: 'Materialgemeinkosten' },
  { key: 'zs_fgk', label: 'Fertigungsgemeinkosten' },
  { key: 'zs_vwgk', label: 'Verwaltungsgemeinkosten' },
  { key: 'zs_vtgk', label: 'Vertriebsgemeinkosten' },
  { key: 'zs_gewinn', label: 'Gewinn' },
  { key: 'zs_skonto', label: 'Kundenskonto' },
];

function blattUebersicht(ws: ExcelJS.Worksheet, projekt: ExcelProjekt, zeilen: Zeile[], kalk: KalkInfo, stamm: Stammdaten, pd: PruefDaten, stand: Date, mitPruefbericht: boolean) {
  breitenSetzen(ws, U_BREITEN);
  const B = 2;
  const I = 9;
  const abschnitte: number[] = [];
  const kopf = [
    [PROJEKT_TYP[projekt.typ] ?? 'Kalkulation', projekt.kunde ? `Kunde: ${projekt.kunde}` : null, projekt.ort ? `Baustelle: ${projekt.ort}` : null].filter(Boolean).join('   ·   '),
    `Stand: ${PROJEKT_STAND[projekt.status ?? ''] ?? projekt.status ?? 'Entwurf'}   ·   Export vom ${datumZeit(stand)} Uhr${projekt.abgabe ? `   ·   Abgabe ${new Date(projekt.abgabe).toLocaleDateString('de-DE')}` : ''}`,
  ];
  let r = kopfband(ws, 1, U_BREITEN.length, projekt.titel || 'Kalkulation', kopf, B);
  r++;

  const Kx = (s: number) => `'Kalkulation'!$${sp(s)}$${kalk.erste}:$${sp(s)}$${kalk.letzte}`;
  const zaehlende = zeilen.filter((z) => z.zaehlt);
  const summe = r2(zaehlende.reduce((s, z) => s + (z.ep !== null ? r2(z.menge * z.ep) : 0), 0));
  const gew = zaehlende.filter((z) => z.stufe && z.ep !== null);
  const gewNenner = gew.reduce((s, z) => s + r2(z.menge * (z.ep ?? 0)), 0);
  const schnitt = gewNenner > 0 ? gew.reduce((s, z) => s + (z.sicherheit ?? 0) * r2(z.menge * (z.ep ?? 0)), 0) / gewNenner : null;
  const kgSumme = zaehlende.reduce((s, z) => s + (z.kg ? z.kg * z.menge : 0), 0);

  // Kacheln
  abschnitte.push(r);
  abschnitt(ws, r, B, I, 'Auf einen Blick');
  r += 2;
  const kacheln: { label: string; wert: ExcelJS.CellValue; format: string; unter: ExcelJS.CellValue; haupt?: boolean }[] = [
    {
      label: 'Summe netto',
      wert: { formula: `'Kalkulation'!$${sp(KS.gp)}$${kalk.summeZeile}`, result: summe },
      format: EUR,
      unter: zeilen.some((z) => !z.zaehlt) ? 'ohne Bedarf und Alternativen' : 'alle Positionen',
      haupt: true,
    },
    {
      label: 'Positionen in der Summe',
      wert: { formula: `COUNTIF(${Kx(KS.summe)},"Ja")`, result: zaehlende.length },
      format: '0',
      unter: `von ${zeilen.length} ${zeilen.length === 1 ? 'Position' : 'Positionen'} gesamt`,
    },
    {
      label: 'Sicherheit im Schnitt',
      wert: {
        formula: `IFERROR(SUMPRODUCT((${Kx(KS.summe)}="Ja")*(${Kx(KS.stufe)}<>"")*${Kx(KS.sich)}*${Kx(KS.gp)})/SUMPRODUCT((${Kx(KS.summe)}="Ja")*(${Kx(KS.stufe)}<>"")*${Kx(KS.gp)}),"")`,
        result: schnitt ?? '',
      },
      format: PROZENT,
      unter: schnitt === null ? 'noch nichts kalkuliert' : `${stufeVon(schnitt).label}, gewichtet nach GP`,
    },
    {
      label: 'Stahlgewicht',
      wert: { formula: `SUMPRODUCT((${Kx(KS.summe)}="Ja")*${Kx(KS.menge)}*${Kx(KS.kg)})`, result: kgSumme },
      format: '#,##0 "kg"',
      unter: 'nur Positionen mit bekanntem Gewicht',
    },
  ];
  const kachelStart = r;
  kacheln.forEach((k, i) => {
    const von = B + i * 2;
    const bis = von + 1;
    const bg = k.haupt ? F.tint : F.flaeche;
    for (let z = kachelStart; z <= kachelStart + 2; z++) flaeche(ws, z, von, bis, { fuellung: bg });
    for (let s = von; s <= bis; s++) ws.getCell(kachelStart, s).border = { top: { style: 'medium', color: { argb: argb(k.haupt ? F.brand : F.linie) } } };
    setze(ws, kachelStart, von, k.label, { groesse: 9, farbe: F.muted, fuellung: bg, v: 'bottom', einzug: 1, oben: k.haupt ? F.brand : F.linie, obenDick: true });
    setze(ws, kachelStart + 1, von, k.wert, { groesse: 18, fett: true, farbe: k.haupt ? F.strong : F.ink, fuellung: bg, format: k.format, v: 'middle', h: 'left', einzug: 1 });
    setze(ws, kachelStart + 2, von, k.unter, { groesse: 9, farbe: F.muted, fuellung: bg, v: 'top', einzug: 1 });
    for (let z = kachelStart; z <= kachelStart + 2; z++) verbinde(ws, z, von, bis);
    if (i === 2 && schnitt !== null) {
      const st = stufeVon(schnitt);
      ws.getCell(kachelStart + 1, von).font = { name: FONT, size: 18, bold: true, color: { argb: argb(st.fg) } };
    }
  });
  ws.getRow(kachelStart).height = 20;
  ws.getRow(kachelStart + 1).height = 30;
  ws.getRow(kachelStart + 2).height = 18;
  r = kachelStart + 4;

  // Ampel
  abschnitte.push(r);
  abschnitt(ws, r, B, I, 'Sicherheit der Kalkulation', 'Wie sicher die KI jede Position selbst einschätzt');
  r += 2;
  tabellenKopf(ws, r, [
    { titel: 'Stufe', von: 2 },
    { titel: 'Bereich', von: 3 },
    { titel: 'Positionen', von: 4, h: 'right' },
    { titel: 'davon freigegeben', von: 5, h: 'right' },
    { titel: 'Summe netto', von: 6, bis: 7, h: 'right' },
    { titel: 'Anteil', von: 8, bis: 9, h: 'right' },
  ]);
  r++;
  const ampelStart = r;
  const ampelZeilen = STUFEN.length + 1;
  const gesamtZeile = ampelStart + ampelZeilen;
  for (let i = 0; i < ampelZeilen; i++) {
    const st = STUFEN[i];
    const label = st ? st.label : 'Noch nicht kalkuliert';
    const passend = st ? zaehlende.filter((z) => z.stufe?.label === st.label) : zaehlende.filter((z) => z.p.status === 'offen');
    const anzahl = passend.length;
    const frei = st ? passend.filter((z) => z.p.status === 'freigegeben').length : 0;
    const betrag = r2(passend.reduce((s, z) => s + (z.ep !== null ? r2(z.menge * z.ep) : 0), 0));
    const bg = st ? st.bg : F.flaeche;
    const fg = st ? st.fg : F.muted;
    const zelle: Stil = { fuellung: bg, farbe: fg, unten: F.weiss, v: 'middle' };
    const kriterium = st ? `${Kx(KS.stufe)},$B${r}` : `${Kx(KS.status)},"Offen"`;
    setze(ws, r, 2, label, { ...zelle, fett: true });
    setze(ws, r, 3, st ? st.bereich : '', zelle);
    setze(ws, r, 4, { formula: `COUNTIFS(${kriterium},${Kx(KS.summe)},"Ja")`, result: anzahl }, { ...zelle, h: 'right', format: '0' });
    setze(ws, r, 5, st ? { formula: `COUNTIFS(${kriterium},${Kx(KS.summe)},"Ja",${Kx(KS.status)},"Freigegeben")`, result: frei } : '', { ...zelle, h: 'right', format: '0' });
    flaeche(ws, r, 6, 7, zelle);
    setze(ws, r, 6, { formula: `SUMIFS(${Kx(KS.gp)},${kriterium},${Kx(KS.summe)},"Ja")`, result: betrag }, { ...zelle, h: 'right', format: EUR });
    verbinde(ws, r, 6, 7);
    flaeche(ws, r, 8, 9, zelle);
    setze(ws, r, 8, { formula: `IF($F$${gesamtZeile}>0,F${r}/$F$${gesamtZeile},0)`, result: summe > 0 ? betrag / summe : 0 }, { ...zelle, h: 'right', format: PROZENT });
    verbinde(ws, r, 8, 9);
    ws.getRow(r).height = 20;
    r++;
  }
  const gs: Stil = { fett: true, oben: F.brand, v: 'middle' };
  setze(ws, r, 2, 'Gesamt', gs);
  setze(ws, r, 3, '', gs);
  setze(ws, r, 4, { formula: `SUM(D${ampelStart}:D${r - 1})`, result: zaehlende.length }, { ...gs, h: 'right', format: '0' });
  setze(ws, r, 5, { formula: `SUM(E${ampelStart}:E${r - 1})`, result: zaehlende.filter((z) => z.stufe && z.p.status === 'freigegeben').length }, { ...gs, h: 'right', format: '0' });
  flaeche(ws, r, 6, 7, gs);
  setze(ws, r, 6, { formula: `SUM(F${ampelStart}:F${r - 1})`, result: summe }, { ...gs, h: 'right', format: EUR });
  verbinde(ws, r, 6, 7);
  flaeche(ws, r, 8, 9, gs);
  setze(ws, r, 8, { formula: `SUM(H${ampelStart}:H${r - 1})`, result: summe > 0 ? 1 : 0 }, { ...gs, h: 'right', format: PROZENT });
  verbinde(ws, r, 8, 9);
  ws.getRow(r).height = 20;
  r += 2;

  // Prüfbericht in Zahlen
  if (mitPruefbericht) {
    abschnitte.push(r);
    abschnitt(ws, r, B, I, 'Prüfbericht in Zahlen', pd.bieterfragen.length ? 'Details in den Blättern Prüfbericht und Bieterfragen' : 'Details im Blatt Prüfbericht');
    r += 2;
    const zahlen: { label: string; wert: number; warn?: boolean }[] = [];
    if (pd.pruefung) {
      const h = pd.pruefung.hinweise ?? [];
      zahlen.push({ label: 'Kritische Hinweise', wert: h.filter((x) => x.stufe === 'kritisch').length, warn: true });
      zahlen.push({ label: 'Hinweise zum Beachten', wert: h.filter((x) => x.stufe === 'beachten').length });
      zahlen.push({ label: 'Hinweise zur Info', wert: h.filter((x) => x.stufe === 'info').length });
    } else if (pd.altHinweise.length) {
      zahlen.push({ label: projekt.typ === 'zeichnung' ? 'Hinweise aus den Zeichnungen' : 'Hinweise aus den Vorbemerkungen', wert: pd.altHinweise.length });
    }
    if (pd.abgleich) {
      if (Array.isArray(pd.abgleich.widersprueche)) zahlen.push({ label: 'Widersprüche Plan gegen LV', wert: pd.abgleich.widersprueche.length, warn: true });
      zahlen.push({ label: 'Im Plan, aber nicht im LV', wert: pd.abgleich.fehlt_im_lv?.length ?? 0, warn: true });
      zahlen.push({ label: 'Im LV, aber nicht im Plan', wert: pd.abgleich.nicht_im_plan?.length ?? 0 });
      zahlen.push({ label: 'Mengenabweichungen', wert: pd.abgleich.mengen?.length ?? 0 });
    }
    zahlen.push({ label: 'Vorgeschlagene Bieterfragen', wert: pd.bieterfragen.length });
    for (const z of zahlen) {
      const rot = z.warn && z.wert > 0;
      const s: Stil = { unten: F.linie, v: 'middle', farbe: rot ? '991B1B' : F.ink, fett: rot };
      flaeche(ws, r, 2, 5, s);
      setze(ws, r, 2, z.label, s);
      verbinde(ws, r, 2, 4);
      setze(ws, r, 5, z.wert, { ...s, h: 'right', format: '0', fuellung: rot ? 'FEE2E2' : undefined });
      ws.getRow(r).height = 18;
      r++;
    }
    r++;
  }

  // Kalkulationsgrundlagen
  abschnitte.push(r);
  abschnitt(ws, r, B, I, 'Kalkulationsgrundlagen', 'Werte aus den Stammdaten, mit denen gerechnet wurde');
  r += 2;
  tabellenKopf(ws, r, [
    { titel: 'Wert', von: 2, bis: 3 },
    { titel: 'Betrag', von: 4, h: 'right' },
    { titel: 'Einheit', von: 5 },
    { titel: 'Was dahinter steht', von: 6, bis: 9 },
  ]);
  r++;
  const liste = [...GRUNDLAGEN];
  if (zeilen.some((z) => z.p.ansatz?.art === 'baugruppe')) liste.push(...GRUNDLAGEN_ZEICHNUNG);
  for (const d of STAMMDATEN_DEFS) if (d.schluessel.startsWith('faktor_') && Math.abs(sd(stamm, d.schluessel) - 1) >= 0.0005) liste.push({ key: d.schluessel, label: d.bezeichnung });
  const breiteText = U_BREITEN.slice(5, 9).reduce((a, b) => a + b, 0);
  for (const g of liste) {
    const def = STAMMDATEN_DEFS.find((d) => d.schluessel === g.key);
    const wert = sd(stamm, g.key);
    const beschreibung = def ? def.bezeichnung : '';
    tabellenZeile(ws, r, [
      { wert: g.label, von: 2, bis: 3, stil: { fett: true, v: 'middle' } },
      { wert, von: 4, stil: { h: 'right', format: Number.isInteger(wert) ? '#,##0' : '#,##0.00', v: 'middle' } },
      { wert: def?.einheit ?? '', von: 5, stil: { farbe: F.muted, v: 'middle' } },
      { wert: beschreibung, von: 6, bis: 9, stil: { farbe: F.muted, groesse: 9, v: 'middle' } },
    ], U_BREITEN);
    ws.getRow(r).height = Math.max(18, hoehe(textZeilen(beschreibung, breiteText, 9), 9));
    r++;
  }
  r++;

  // Lesehilfe
  abschnitte.push(r);
  abschnitt(ws, r, B, I, 'So lesen Sie diese Datei');
  r += 2;
  const lesen: [string, string][] = [
    ['Kalkulation', 'Eine Zeile je Position. EP = Material & Kaufteile + Lohn + Oberfläche & Sonstiges + Zuschläge, jeweils je Einheit. GP = Menge × EP. Die Formeln rechnen mit: Wer einen Betrag ändert, sieht sofort EP, GP und Summe neu.'],
    ['Rechenweg', 'Jede kalkulierte Position mit allen Bausteinen der Formel, dazu die Annahmen der KI, fehlende Angaben und der Langtext.'],
    ['Sicherheit', 'Die KI schätzt jede Position selbst ein. Rot und orange zuerst prüfen. Handeingaben zählen als 100 %.'],
    ['Grau und kursiv', 'Bedarfs- und Alternativpositionen, Fremdgewerke und ausgeblendete Positionen. Sie stehen in der Liste, zählen aber nicht zur Summe.'],
  ];
  if (mitPruefbericht) lesen.push(['Prüfbericht', 'Was in Vorbemerkungen und Plänen auffällt. Bieterfragen sind Vorschläge von AIM und werden nie selbst versendet.']);
  const breiteLesen = U_BREITEN.slice(3, 9).reduce((a, b) => a + b, 0);
  for (const [t, text] of lesen) {
    setze(ws, r, 2, t, { fett: true, farbe: F.strong, v: 'top' });
    verbinde(ws, r, 2, 3);
    setze(ws, r, 4, text, { umbruch: true, farbe: F.ink, v: 'top' });
    verbinde(ws, r, 4, 9);
    ws.getRow(r).height = Math.max(18, hoehe(textZeilen(text, breiteLesen)));
    r++;
  }
  r++;
  setze(ws, r, 2, 'Erstellt mit AIM, Angebote in Minuten. Alle Beträge netto in Euro.', { groesse: 8, farbe: F.grau, kursiv: true });

  ws.views = [{ showGridLines: false }];
  // Übersicht in Originalgröße drucken und nur zwischen Abschnitten umbrechen
  druck(ws, 'A4');
  ws.pageSetup.fitToPage = false;
  ws.pageSetup.scale = 100;
  seitenumbrueche(ws, abschnitte, r);
  fusszeile(ws, `${projekt.titel}, Übersicht`);
}

/* ------------------------------------------------------------------ */
/* Hallenbau                                                           */
/* ------------------------------------------------------------------ */

const H_BREITEN = [42, 11, 8, 14, 15, 18, 72];

function blattHalle(wb: ExcelJS.Workbook, projekt: ExcelProjekt, stamm: Stammdaten, refs: ReferenzPunkt[], stand: Date) {
  const ws = wb.addWorksheet('Kalkulation Hallenbau', { properties: { tabColor: { argb: argb(F.brand) } } });
  breitenSetzen(ws, H_BREITEN);
  const n = H_BREITEN.length;
  const ein = (projekt.eingaben ?? {}) as Partial<HallenEingaben>;
  const e: HallenEingaben = { ...LEERE_HALLE, ...ein, optionen: { ...LEERE_HALLE.optionen, ...(ein.optionen ?? {}) }, manuell: ein.manuell ?? {} };
  const erg = berechneHalle(e, stamm, refs);

  let r = kopfband(ws, 1, n, projekt.titel || 'Hallenbau', [
    ['Hallenbau', projekt.kunde ? `Kunde: ${projekt.kunde}` : null, projekt.ort ? `Baustelle: ${projekt.ort}` : null].filter(Boolean).join('   ·   '),
    `Stand: ${PROJEKT_STAND[projekt.status ?? ''] ?? projekt.status ?? 'Entwurf'}   ·   Export vom ${datumZeit(stand)} Uhr`,
  ]);
  r++;

  abschnitt(ws, r, 1, n, 'Eckdaten');
  r += 2;
  const methode: Record<string, string> = { manuell: 'von Hand', stahlliste: 'aus der Stahlliste', referenzen: 'aus ähnlichen gebauten Hallen', faustwert: 'Faustwert' };
  const eck: [string, ExcelJS.CellValue, string?][] = [
    ['Abmessungen', `${deZahl(e.laenge)} × ${deZahl(e.breite)} m, Traufhöhe ${deZahl(e.traufhoehe)} m`],
    ['Dach', `${e.dachform === 'pultdach' ? 'Pultdach' : 'Satteldach'}, ${deZahl(e.neigung)}°, ${e.dach === 'trapez' ? 'Trapezblech' : 'Sandwich'}`],
    ['Wand', e.wand === 'ohne' ? 'ohne Wandverkleidung' : `${e.wand === 'trapez' ? 'Trapezblech' : 'Sandwich'}, ${e.wandseiten} Seiten`],
    ['Grundfläche', erg.geometrie.grundflaeche, '#,##0.0 "m²"'],
    ['Stahlgewicht', erg.stahl.kg, '#,##0 "kg"'],
    ['Stahl je m² Grundfläche', `${deZahl(erg.stahl.kg_m2, 1)} kg/m², ${methode[erg.stahl.methode] ?? erg.stahl.methode}`],
    ['Angebotspreis je m²', erg.eur_m2, EUR],
  ];
  for (const [label, wert, format] of eck) {
    setze(ws, r, 1, label, { farbe: F.muted, unten: F.linie });
    setze(ws, r, 2, wert, { fett: true, unten: F.linie, format, h: 'left' });
    verbinde(ws, r, 2, 4);
    ws.getRow(r).height = 18;
    r++;
  }
  r++;

  abschnitt(ws, r, 1, n, 'Positionen');
  r += 2;
  tabellenKopf(ws, r, [
    { titel: 'Position', von: 1 },
    { titel: 'Menge', von: 2, h: 'right' },
    { titel: 'Einheit', von: 3 },
    { titel: 'Einzelpreis', von: 4, h: 'right' },
    { titel: 'Gesamt', von: 5, h: 'right' },
    { titel: 'Angepasst', von: 6 },
    { titel: 'Herleitung', von: 7 },
  ], 22);
  const kopfZeile = r;
  r++;
  const erste = r;
  for (const z of erg.zeilen) {
    const grau = !z.aktiv;
    const basis: Stil = { unten: F.linie, farbe: grau ? F.grau : F.ink, kursiv: grau, umbruch: true };
    setze(ws, r, 1, z.bezeichnung, { ...basis, fett: !grau });
    setze(ws, r, 2, z.menge, { ...basis, h: 'right', format: mengenFormat(z.menge) });
    setze(ws, r, 3, z.einheit, { ...basis, einzug: 1 });
    setze(ws, r, 4, z.ep, { ...basis, h: 'right', format: EUR });
    setze(ws, r, 5, z.aktiv ? { formula: `ROUND(B${r}*D${r},2)`, result: z.gp } : null, { ...basis, h: 'right', format: EUR, fett: !grau });
    const angepasst = [z.manuell_menge ? 'Menge von Hand' : '', z.manuell_ep ? 'Preis von Hand' : ''].filter(Boolean).join(', ');
    setze(ws, r, 6, grau ? 'nicht enthalten' : angepasst, { ...basis, farbe: grau ? F.grau : angepasst ? '9A3412' : F.ink, groesse: 9 });
    setze(ws, r, 7, z.herleitung, { ...basis, farbe: grau ? F.grau : F.muted, groesse: 9 });
    ws.getRow(r).height = Math.max(hoehe(Math.min(textZeilen(z.herleitung, H_BREITEN[6], 9), 6), 9), hoehe(textZeilen(z.bezeichnung, H_BREITEN[0] * 0.92)));
    r++;
  }
  const letzte = r - 1;
  r++;
  const sZeile = r;
  const zZeile = r + 1;
  const rohZeile = r + 2;
  const rund = Math.max(sd(stamm, 'halle_rundung'), 1);
  const summen: [string, string, number, boolean][] = [
    ['Gesamt netto', `SUM(E${erste}:E${letzte})`, erg.summe_netto, false],
    [`Zuschlag ${deZahl(erg.zuschlag_prozent)} %`, `ROUND(E${sZeile}*${erg.zuschlag_prozent}/100,2)`, erg.zuschlag, false],
    ['Angebotspreis netto', `E${sZeile}+E${zZeile}`, erg.angebot_roh, false],
    [`Angebotspreis netto, gerundet auf ${deZahl(rund, 0)} €`, `ROUND(E${rohZeile}/${rund},0)*${rund}`, erg.angebot_gerundet, true],
  ];
  for (const [label, formel, wert, haupt] of summen) {
    const s: Stil = haupt ? { fett: true, groesse: 11, fuellung: F.tint, farbe: F.strong, oben: F.brand, obenDick: true, v: 'middle' } : { v: 'middle', unten: F.linie };
    flaeche(ws, r, 1, n, haupt ? { fuellung: F.tint, oben: F.brand, obenDick: true } : { unten: F.linie });
    setze(ws, r, 1, label, s);
    setze(ws, r, 5, { formula: formel, result: wert }, { ...s, h: 'right', format: EUR });
    ws.getRow(r).height = haupt ? 22 : 18;
    r++;
  }
  r++;

  if (erg.hinweise.length) {
    abschnitt(ws, r, 1, n, 'Hinweise');
    r += 2;
    const breite = H_BREITEN.reduce((a, b) => a + b, 0);
    for (const h of erg.hinweise) {
      setze(ws, r, 1, h, { umbruch: true, unten: F.linie });
      verbinde(ws, r, 1, n);
      ws.getRow(r).height = hoehe(textZeilen(h, breite));
      r++;
    }
  }

  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: kopfZeile, showGridLines: false }];
  druck(ws, 'A4', `${kopfZeile}:${kopfZeile}`);
  fusszeile(ws, `${projekt.titel}, Hallenbau`);
}

/* ------------------------------------------------------------------ */
/* Einstieg                                                            */
/* ------------------------------------------------------------------ */

export async function baueKalkulationsExcel(daten: KalkulationsDaten): Promise<Buffer> {
  const { projekt, stamm } = daten;
  const stand = daten.stand ?? new Date();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'AIM';
  wb.lastModifiedBy = 'AIM';
  wb.created = stand;
  wb.modified = stand;
  wb.title = projekt.titel;
  wb.subject = 'Kalkulation zum Nachprüfen';
  wb.calcProperties = { fullCalcOnLoad: true };

  if (projekt.typ === 'halle') {
    blattHalle(wb, projekt, stamm, daten.referenzen ?? [], stand);
  } else {
    const { zeilen } = aufbereiten(daten.positionen ?? [], stamm);
    const pd = pruefDaten(projekt.ergebnis);
    const mitPruefbericht = !!(pd.pruefung || pd.abgleich || pd.altHinweise.length);
    // Übersicht zuerst anlegen, damit sie das erste Blatt ist; befüllt wird sie, wenn die Zeilen der Kalkulation feststehen.
    const uebersicht = wb.addWorksheet('Übersicht', { properties: { tabColor: { argb: argb(F.brand) } } });
    const kalk = blattKalkulation(wb, projekt, zeilen);
    blattRechenweg(wb, projekt, zeilen, kalk);
    if (mitPruefbericht) blattPruefbericht(wb, projekt, pd);
    if (pd.bieterfragen.length) blattBieterfragen(wb, projekt, pd.bieterfragen);
    blattUebersicht(uebersicht, projekt, zeilen, kalk, stamm, pd, stand, mitPruefbericht);
  }
  wb.views = [{ x: 0, y: 0, width: 28000, height: 16000, firstSheet: 0, activeTab: 0, visibility: 'visible' }];

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}
