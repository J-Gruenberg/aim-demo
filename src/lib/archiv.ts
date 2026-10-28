import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { einbetten } from '@/lib/ki';
import { profile } from '@/lib/pruefung';

/**
 * Archiv seiner Angebotspositionen (Wissensbasis): semantische Suche nach ähnlichen Positionen,
 * Aufnahme freigegebener Positionen (das Archiv wächst mit jedem kalkulierten Projekt).
 */

export type ArchivTreffer = {
  id: string;
  quelle: string;
  projekt: string;
  datum: string | null;
  text: string;
  kategorie: string | null;
  menge: number | null;
  einheit: string | null;
  ep: number | null;
  kg_je_einheit: number | null;
  oberflaeche: string | null;
  aehnlichkeit: number;
};

export function suchtext(p: { kurztext?: string | null; langtext?: string | null }) {
  return `${p.kurztext ?? ''}\n${(p.langtext ?? '').slice(0, 600)}`.trim();
}

/** Normalisiert einen Positionstext, um identische Leistungen im selben LV zu erkennen. */
export function gleichSchluessel(p: { kurztext?: string | null; langtext?: string | null; einheit?: string | null }) {
  const n = (t: string | null | undefined) => (t ?? '').toLowerCase().replace(/\s+/g, ' ').replace(/[„“"'.,;:()-]/g, '').trim();
  return `${n(p.kurztext)}|${n(p.langtext).slice(0, 800)}|${n(p.einheit)}`;
}

/** Je Position bis zu `anzahl` ähnliche Archivpositionen mit Preis. */
export async function aehnlicheFuer(sb: SupabaseClient, positionen: { id: string; kurztext?: string | null; langtext?: string | null }[], projektId: string | null, anzahl = 3, mindest = 0.4) {
  const texte = positionen.map(suchtext);
  const vektoren = await einbetten(texte);
  const ergebnis: Record<string, ArchivTreffer[]> = {};
  await Promise.all(
    positionen.map(async (p, i) => {
      const { data } = await sb.rpc('aehnliche_positionen', {
        suchtext: texte[i],
        such_embedding: vektoren ? JSON.stringify(vektoren[i]) : null,
        anzahl: anzahl * 3,
        ohne_projekt: projektId,
      });
      // Gleiches Profil (HEB 200 zu HEB 200) nach oben, anderes Profil nach unten: Texte sind sonst oft fast gleich.
      const eigene = profile(texte[i]);
      ergebnis[p.id] = ((data ?? []) as ArchivTreffer[])
        .map((t) => {
          const fremd = profile(t.text);
          if (!eigene.size || !fremd.size) return t;
          const passt = [...eigene].some((x) => fremd.has(x));
          return { ...t, aehnlichkeit: Math.max(0, Math.min(1, t.aehnlichkeit + (passt ? 0.1 : -0.15))) };
        })
        .sort((a, b) => b.aehnlichkeit - a.aehnlichkeit)
        .slice(0, anzahl)
        .filter((t) => t.aehnlichkeit >= mindest);
    }),
  );
  // Ist die KI erreichbar, nebenbei fehlende Suchvektoren im Archiv nachtragen (eingelesene Altprojekte)
  if (vektoren) await archivNachfuellen(sb, 24).catch(() => 0);
  return ergebnis;
}

/** Trägt Suchvektoren für Archivzeilen ohne Vektor nach. Läuft in kleinen Portionen mit, bis alles gefüllt ist. */
export async function archivNachfuellen(sb: SupabaseClient, anzahl = 24) {
  const { data } = await sb.from('archiv_positionen').select('id,text').is('embedding', null).limit(anzahl);
  if (!data?.length) return 0;
  const v = await einbetten(data.map((d) => d.text));
  if (!v) return 0;
  await Promise.all(data.map((d, i) => sb.from('archiv_positionen').update({ embedding: JSON.stringify(v[i]) }).eq('id', d.id)));
  return data.length;
}

export function archivKontext(treffer: ArchivTreffer[]) {
  if (!treffer.length) return '';
  return (
    'Ähnliche Positionen aus Ihren Angeboten:\n' +
    treffer
      .map((t) => `  - "${t.text.replace(/\s+/g, ' ').slice(0, 160)}" | ${t.menge ?? '?'} ${t.einheit ?? ''} | EP ${t.ep?.toFixed(2)} €${t.kg_je_einheit ? ` | ${t.kg_je_einheit} kg je Einheit` : ''} | ${t.projekt}${t.datum ? ` ${t.datum.slice(0, 4)}` : ''}`)
      .join('\n')
  );
}

/** Freigegebene Positionen ins Archiv übernehmen (oder aktualisieren). */
export async function insArchiv(sb: SupabaseClient, projektId: string, positionIds: string[]) {
  if (!positionIds.length) return 0;
  const [{ data: pos }, { data: projekt }] = await Promise.all([
    sb.from('positionen').select('id,oz,kurztext,langtext,menge,einheit,ep,gp,typ,ansatz,status').in('id', positionIds).eq('projekt_id', projektId),
    sb.from('projekte').select('titel').eq('id', projektId).single(),
  ]);
  const frei = (pos ?? []).filter((p) => p.status === 'freigegeben' && p.ep !== null && p.typ !== 'fremd');
  if (!frei.length) return 0;
  const vektoren = await einbetten(frei.map(suchtext));
  const zeilen = frei.map((p, i) => {
    const a = (p.ansatz ?? {}) as Record<string, unknown>;
    return {
      quelle: 'freigabe',
      projekt: projekt?.titel ?? 'AIM',
      datum: new Date().toISOString().slice(0, 10),
      pos: p.oz,
      text: suchtext(p),
      kategorie: (a.art as string) ?? p.typ,
      oberflaeche: (a.oberflaeche as string) ?? null,
      montage: (a.montage as boolean) ?? null,
      menge: p.menge,
      einheit: p.einheit,
      ep: p.ep,
      gp: p.gp,
      kg_je_einheit: (a.kg_je_einheit as number) ?? null,
      projekt_id: projektId,
      position_id: p.id,
      embedding: vektoren ? JSON.stringify(vektoren[i]) : null,
    };
  });
  const { error } = await sb.from('archiv_positionen').upsert(zeilen, { onConflict: 'position_id' });
  if (error) console.error('insArchiv', error);
  return error ? 0 : zeilen.length;
}
