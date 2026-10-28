/**
 * Deterministische Hilfen für LV-PDFs mit Textebene (ohne KI).
 * Viele AVA-Ausdrucke schreiben je Position eine Zeile „Menge: 2 Stck“. Läuft eine Position über mehrere Seiten,
 * sieht die KI beim seitenweisen Lesen die Menge nicht immer im selben Abschnitt. Aus dem Gesamttext ist sie eindeutig.
 */

/** Einheiten vereinheitlichen: abgeschnittene oder unterschiedlich geschriebene Stückangaben, m² und m³. */
export function einheitNorm(e: string | null | undefined): string | null {
  const t = (e ?? '').trim().replace(/\.$/, '');
  if (!t) return null;
  if (/^(st|stk|stck|stü|stüc|stück|stueck|stk\.)$/i.test(t)) return 'Stck';
  if (/^(m2|m²|qm)$/i.test(t)) return 'm²';
  if (/^(m3|m³|cbm)$/i.test(t)) return 'm³';
  if (/^(psch|pausch|pauschal|pschl)$/i.test(t)) return 'psch';
  return t;
}

const zahl = (s: string) => {
  const n = Number(s.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Menge und Einheit je OZ aus dem Gesamttext. Nur wenn zwischen dem Anfang der Position und dem Anfang der nächsten
 * genau eine Zeile „Menge: …“ steht. Sonst bleibt die Position außen vor (dann zählt, was die KI gelesen hat).
 */
export function mengenAusText(text: string, ozListe: string[]): Map<string, { menge: number; einheit: string | null }> {
  const ergebnis = new Map<string, { menge: number; einheit: string | null }>();
  const beispiel = ozListe.find((o) => (o.match(/[.\-/ ]/g) ?? []).length >= 2);
  if (!beispiel || !/Menge:/i.test(text)) return ergebnis;
  // Grenzen: jede Zeile, die mit einer OZ derselben Form beginnt (z. B. 5.1.080 → \d+\.\d+\.\d+)
  const form = beispiel.trim().split(/(\d+)/).map((t) => (/^\d+$/.test(t) ? '\\d+' : escape(t))).join('');
  const grenzen = [...text.matchAll(new RegExp(`(?:^|\\n)[ \\t]*(${form})(?=[ \\t\\n])`, 'g'))].map((m) => ({ oz: m[1], ab: m.index! }));
  for (const oz of ozListe) {
    const i = grenzen.findIndex((g) => g.oz === oz.trim());
    if (i < 0) continue;
    const span = text.slice(grenzen[i].ab, grenzen[i + 1]?.ab ?? text.length);
    const treffer = [...span.matchAll(/Menge:?[ \t]*([\d.,]+)[ \t]*([^\s\d.,][^\s]*)?/gi)];
    if (treffer.length !== 1) continue;
    const menge = zahl(treffer[0][1]);
    if (menge === null || menge <= 0) continue;
    ergebnis.set(oz, { menge, einheit: einheitNorm(treffer[0][2]) });
  }
  return ergebnis;
}

type MitText = { id: string; oz: string | null; kurztext: string | null; langtext: string | null };

/**
 * „Wie vor, jedoch …“ und „wie Pos. 5.1.030“: Solche Positionen beschreiben nur die Änderung. Ohne die Bezugsposition
 * fehlt der KI das Bauteil. Bezug ist die genannte OZ oder die letzte vorherige Position, die nicht selbst „wie vor“ ist.
 * Erwartet die Positionen in LV-Reihenfolge.
 */
export function bezuege<T extends MitText>(alle: T[]): Map<string, T> {
  const wieVor = (p: T) => /^\s*(wie\s+vor|wie\s+vorher|wie\s+zuvor|desgl|dto\b|jedoch\b)/i.test(`${p.kurztext ?? ''} ${p.langtext ?? ''}`.trim());
  const ergebnis = new Map<string, T>();
  let basis: T | null = null;
  for (const p of alle) {
    const genannt = `${p.kurztext ?? ''} ${p.langtext ?? ''}`.match(/wie\s+(?:in\s+)?Pos(?:ition)?\.?\s*(?:Nr\.?\s*)?(\d+(?:\.\d+)+)/i)?.[1];
    const ziel = genannt ? alle.find((x) => x.oz?.trim() === genannt && x.id !== p.id) : undefined;
    if (ziel) ergebnis.set(p.id, ziel);
    else if (wieVor(p) && basis) ergebnis.set(p.id, basis);
    if (!wieVor(p)) basis = p;
  }
  return ergebnis;
}
