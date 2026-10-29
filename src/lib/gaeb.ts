/**
 * GAEB DA XML (X81/X83/X86) lesen und X84 (Angebotsabgabe) schreiben.
 * Lesen: deterministisch, ohne KI. Schreiben: Einheitspreise in das Original einsetzen.
 */
import { XMLParser } from 'fast-xml-parser';

export type GaebPosition = {
  id: string | null;
  oz: string;
  kurztext: string;
  langtext: string;
  menge: number | null;
  einheit: string | null;
  pauschal: boolean;
  bedarf: boolean;
  alternativ: boolean;
  bereich: string;
};

export type GaebLv = { projekt: string | null; bezeichnung: string | null; lv: string | null; datenart: string | null; positionen: GaebPosition[] };

type Knoten = Record<string, unknown>;

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', preserveOrder: true, trimValues: false, processEntities: true, htmlEntities: true });

function kinder(k: Knoten): Knoten[] {
  const name = Object.keys(k).find((x) => x !== ':@');
  if (!name) return [];
  const v = k[name];
  return Array.isArray(v) ? (v as Knoten[]) : [];
}
function name(k: Knoten) {
  return Object.keys(k).find((x) => x !== ':@') ?? '';
}
function attr(k: Knoten, a: string): string | null {
  const at = k[':@'] as Record<string, string> | undefined;
  return at?.[`@_${a}`] ?? null;
}
function finde(k: Knoten[], n: string): Knoten | undefined {
  return k.find((x) => name(x) === n);
}
function alle(k: Knoten[], n: string): Knoten[] {
  return k.filter((x) => name(x) === n);
}

/** Text aus GAEB-Formatierung (p, span, br) mit Zeilenumbrüchen. */
function text(k: Knoten | undefined): string {
  if (!k) return '';
  const teile: string[] = [];
  const lauf = (x: Knoten) => {
    const n = name(x);
    if (n === '#text') {
      teile.push(String(x['#text']));
      return;
    }
    if (n === 'br') {
      teile.push('\n');
      return;
    }
    for (const c of kinder(x)) lauf(c);
    if (n === 'p') teile.push('\n');
  };
  for (const c of kinder(k)) lauf(c);
  return teile
    .join('')
    .replace(/[ \t\r]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function zahl(s: string): number | null {
  const n = Number(s.trim());
  return Number.isFinite(n) ? n : null;
}

/**
 * GAEB-Datei aus Bytes lesen: Zeichensatz aus der XML-Deklaration (viele AVA-Programme schreiben ISO-8859-1),
 * Byte-Order-Mark entfernen. Altes Format GAEB 90 / 2000 (D83, P83) ist kein XML und wird klar abgewiesen.
 */
export function gaebText(buf: Uint8Array): string {
  if (buf[0] === 0xff && buf[1] === 0xfe) return new TextDecoder('utf-16le').decode(buf.subarray(2));
  if (buf[0] === 0xfe && buf[1] === 0xff) return new TextDecoder('utf-16be').decode(buf.subarray(2));
  const start = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf ? 3 : 0;
  const kopf = new TextDecoder('latin1').decode(buf.subarray(start, start + 300));
  if (!kopf.trimStart().startsWith('<')) throw new GaebAltformat();
  const enc = (kopf.match(/encoding=["']([^"']+)["']/i)?.[1] ?? 'utf-8').toLowerCase();
  const kodierung = /8859-15/.test(enc) ? 'iso-8859-15' : /8859-1|latin|1252/.test(enc) ? 'windows-1252' : 'utf-8';
  return new TextDecoder(kodierung).decode(buf.subarray(start));
}

export class GaebAltformat extends Error {
  constructor() {
    super('Das ist eine GAEB-Datei im alten Format (D83 oder P83). Bitte beim Auftraggeber die X83 (GAEB XML) anfordern oder das LV als PDF hochladen.');
  }
}

export function leseGaeb(xml: string): GaebLv {
  const baum = parser.parse(xml) as Knoten[];
  const gaeb = finde(baum, 'GAEB');
  if (!gaeb) throw new Error('Keine GAEB-Datei');
  const g = kinder(gaeb);
  const prj = finde(g, 'PrjInfo');
  const projekt = prj ? text(finde(kinder(prj), 'NamePrj')) : null;
  const bezeichnung = prj ? text(finde(kinder(prj), 'LblPrj')) : null;
  const vergabe = finde(g, 'Award');
  if (!vergabe) throw new Error('Kein Leistungsverzeichnis (Award) gefunden');
  const dp = text(finde(kinder(vergabe), 'DP'));
  const boq = finde(kinder(vergabe), 'BoQ');
  const boqInfo = boq ? finde(kinder(boq), 'BoQInfo') : undefined;
  const lv = boqInfo ? text(finde(kinder(boqInfo), 'LblBoQ')) || null : null;
  const positionen: GaebPosition[] = [];
  const body = boq ? finde(kinder(boq), 'BoQBody') : undefined;

  const gehe = (b: Knoten | undefined, prefix: string[], bereich: string[]) => {
    if (!b) return;
    for (const c of kinder(b)) {
      const n = name(c);
      if (n === 'BoQCtgy') {
        const nr = attr(c, 'RNoPart') ?? '';
        const lbl = text(finde(kinder(c), 'LblTx'));
        gehe(finde(kinder(c), 'BoQBody'), [...prefix, nr], [...bereich, lbl]);
      } else if (n === 'Itemlist') {
        for (const it of alle(kinder(c), 'Item')) {
          const ik = kinder(it);
          const desc = finde(ik, 'Description');
          const ct = desc ? finde(kinder(desc), 'CompleteText') : undefined;
          const lang = ct ? text(finde(kinder(ct), 'DetailTxt')) : '';
          const ot = ct ? finde(kinder(ct), 'OutlineText') : undefined;
          let kurz = ot ? text(ot) : '';
          if (!kurz) kurz = lang.split('\n')[0]?.slice(0, 120) ?? '';
          const qty = finde(ik, 'Qty');
          positionen.push({
            id: attr(it, 'ID'),
            oz: [...prefix, attr(it, 'RNoPart') ?? ''].filter(Boolean).join('.'),
            kurztext: kurz.replace(/\n/g, ' · '),
            langtext: lang,
            menge: qty ? zahl(text(qty)) : null,
            einheit: text(finde(ik, 'QU')) || null,
            pauschal: text(finde(ik, 'LumpSumItem')) === 'Yes',
            bedarf: !!finde(ik, 'Provis'),
            // Wahlpositionen: ALNSerNo 1, 2, … sind Alternativen zur Grundposition (ALNSerNo 0 oder fehlend)
            alternativ: (() => {
              const s = text(finde(ik, 'ALNSerNo')).trim();
              return s !== '' && Number(s) !== 0;
            })(),
            bereich: bereich.filter(Boolean).join(' › '),
          });
        }
      } else if (n === 'BoQBody') {
        gehe(c, prefix, bereich);
      }
    }
  };
  gehe(body, [], []);
  return { projekt, bezeichnung, lv, datenart: dp || null, positionen };
}

/**
 * Vorbemerkungen aus einer GAEB-DA-XML: Zusatztexte (AddText) und Hinweistexte (Remark) als lesbarer Text.
 * Reicht für die Prüfung, wenn kein LV als PDF vorliegt.
 */
export function gaebVorbemerkungen(xml: string, max = 60_000): string {
  const bloecke = [...xml.matchAll(/<(AddText|Remark)\b[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => m[2]);
  const lesbar = bloecke.map((b) =>
    b
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|OutlineAddText|OutlineText|TextOutlTxt)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;|&#160;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n+/g, '\n')
      .trim(),
  );
  return lesbar.filter(Boolean).join('\n\n').slice(0, max);
}

/** Schreibt Einheitspreise in die Original-X83 und gibt eine X84 zurück. Preise je Item-ID. */
export function schreibeX84(xml: string, preise: Record<string, number>): { xml: string; gesetzt: number } {
  let gesetzt = 0;
  let out = xml.replace(/<DP>\s*8[0-9]\s*<\/DP>/, '<DP>84</DP>');
  // GAEB DA XML 3.x: Namensraum je Datenart (…/DA83/3.2 wird …/DA84/3.2); ausgegeben wird immer UTF-8
  out = out.replace(/(xmlns(?::\w+)?="[^"]*\/)DA8\d(\/)/g, '$1DA84$2');
  out = out.replace(/^(\uFEFF)?(<\?xml[^>]*encoding=["'])[^"']+(["'])/i, '$2UTF-8$3');
  out = out.replace(/<Item\s+([^>]*?)ID="([^"]+)"([^>]*)>([\s\S]*?)<\/Item>/g, (ganz, a, id: string, b, inhalt: string) => {
    const up = preise[id];
    if (up === undefined || up === null || !Number.isFinite(up)) return ganz;
    const qtyM = inhalt.match(/<Qty>([^<]*)<\/Qty>/);
    const menge = qtyM ? Number(qtyM[1]) : 1;
    const it = Math.round(up * (Number.isFinite(menge) ? menge : 1) * 100) / 100;
    let neu = inhalt.replace(/<UP>[^<]*<\/UP>\s*/g, '').replace(/<IT>[^<]*<\/IT>\s*/g, '');
    const einfuegen = `<UP>${up.toFixed(2)}</UP><IT>${it.toFixed(2)}</IT>`;
    if (/<\/QU>/.test(neu)) neu = neu.replace(/<\/QU>/, `</QU>${einfuegen}`);
    else if (/<\/Qty>/.test(neu)) neu = neu.replace(/<\/Qty>/, `</Qty>${einfuegen}`);
    else return ganz;
    gesetzt++;
    return `<Item ${a}ID="${id}"${b}>${neu}</Item>`;
  });
  return { xml: out, gesetzt };
}
