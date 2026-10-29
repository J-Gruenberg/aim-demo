import { NextResponse } from 'next/server';
import { supabaseServer, aktuellesProfil } from '@/lib/supabase/server';
import { ladeStammdaten } from '@/lib/daten';
import { kiStrukturiert, KiFehler, type Stufe } from '@/lib/ki';
import { SCHEMA_KALKULIEREN, systemKalkulieren, flach, type KiAntwort, type KiAnsatz } from '@/lib/lv-ki';
import { ansatzAusKi } from '@/lib/engine/ansatz';
import { rechnePosition } from '@/lib/engine/bauteile';
import { STAMMDATEN_DEFS } from '@/lib/engine/stammdaten';
import { aehnlicheFuer, archivKontext, gleichSchluessel, type ArchivTreffer } from '@/lib/archiv';
import { bezuege } from '@/lib/lv-text';
import { hash, merken, version } from '@/lib/gedaechtnis';

export const runtime = 'nodejs';
export const maxDuration = 300;

/** Unter dieser Sicherheit rechnet das größere Modell die Position automatisch nach. */
const NACHRECHNEN_UNTER = 0.85;

/** Gedächtnis: gleiche Position (Text, Menge, Einheit, Bezug), gleicher Ansatz, gleicher Preis. Neue Prompt-Version liest neu. */
const KALK_VERSION = version(systemKalkulieren(''), SCHEMA_KALKULIEREN);

type Pos = { id: string; oz: string | null; kurztext: string | null; langtext: string | null; menge: number | null; einheit: string | null; ansatz: Record<string, unknown> | null; status: string; typ: string | null; sicherheit: number | null; begruendung: string | null; ep: number | null; sort?: number | null };


export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profil = await aktuellesProfil();
  if (!profil || profil.rolle === 'leser') return NextResponse.json({ fehler: 'Keine Berechtigung.' }, { status: 403 });
  const { ids, mit_plaenen = false, gruendlich = false } = (await req.json()) as { ids: string[]; mit_plaenen?: boolean; gruendlich?: boolean };
  if (!ids?.length) return NextResponse.json({ fehler: 'Keine Positionen gewählt.' }, { status: 400 });
  const sb = await supabaseServer();
  const [{ data: alle }, { data: projekt }, { werte }] = await Promise.all([
    sb.from('positionen').select('id,oz,kurztext,langtext,menge,einheit,ansatz,status,typ,sicherheit,begruendung,ep,sort').eq('projekt_id', id).order('sort'),
    sb.from('projekte').select('titel,ergebnis').eq('id', id).single(),
    ladeStammdaten(sb),
  ]);
  const pos = ((alle ?? []) as Pos[]).filter((p) => ids.slice(0, 25).includes(p.id));
  if (!pos.length) return NextResponse.json({ fehler: 'Positionen nicht gefunden.' }, { status: 404 });
  const bezugVon = bezuege((alle ?? []) as Pos[]);

  const speichern = async (p: Pos, k: KiAnsatz, extra: Record<string, unknown> = {}) => {
    const ansatz = ansatzAusKi(k);
    const r = rechnePosition(ansatz, Number(p.menge ?? 1), werte);
    // Zukaufteile bleiben zur Prüfung markiert, bis ein echter Lieferantenpreis da ist
    const unsicher = k.sicherheit < 0.9 || r.ep === null || !k.unser_gewerk || ansatz.art === 'zukauf';
    const alt = (p.ansatz ?? {}) as Record<string, unknown>;
    await sb
      .from('positionen')
      .update({
        typ: k.unser_gewerk ? k.art : 'fremd',
        ansatz: { ...ansatz, bereich: alt.bereich, bedarf: alt.bedarf, alternativ: alt.alternativ, pauschal: alt.pauschal, ki: { sicherheit: k.sicherheit, fehlende_angaben: k.fehlende_angaben, unser_gewerk: k.unser_gewerk, zukauf: k.zukauf_hinweis, roh: k }, ...extra },
        ep: r.ep,
        gp: r.ep !== null ? Math.round(r.ep * Number(p.menge ?? 1) * 100) / 100 : null,
        sicherheit: Math.max(0, Math.min(1, k.sicherheit)),
        begruendung: [k.begruendung, k.fehlende_angaben ? `Annahme: ${k.fehlende_angaben}` : '', k.zukauf_hinweis ? `Anfragen: ${k.zukauf_hinweis}` : '', ansatz.art === 'zukauf' && k.zukauf_richtpreis ? `Einkaufspreis ${k.zukauf_richtpreis} € ist ein Richtwert, bitte durch den Lieferantenpreis ersetzen.` : ''].filter(Boolean).join(' '),
        status: unsicher ? 'pruefen' : 'berechnet',
      })
      .eq('id', p.id);
  };

  // 1. Gleiche Leistungen: Ist dieselbe Position im LV schon kalkuliert, Ansatz übernehmen statt neu fragen.
  const vorlage = new Map<string, Pos>();
  for (const p of (alle ?? []) as Pos[]) {
    const ki = (p.ansatz as { ki?: { roh?: KiAnsatz } } | null)?.ki?.roh;
    if (ki && !ids.includes(p.id)) vorlage.set(gleichSchluessel(p), p);
  }
  let gesetzt = 0;
  const gruppen = new Map<string, Pos[]>();
  for (const p of pos) {
    const s = gleichSchluessel(p);
    const v = gruendlich ? undefined : vorlage.get(s);
    if (v) {
      const k = (v.ansatz as { ki: { roh: KiAnsatz } }).ki.roh;
      await speichern(p, { ...k, id: p.id }, { gleich_wie: v.oz });
      gesetzt++;
      continue;
    }
    gruppen.set(s, [...(gruppen.get(s) ?? []), p]);
  }
  // 1b. Gedächtnis: Diese Position hat AIM schon einmal kalkuliert (auch in einem anderen Projekt)
  const norm = (t: string | null | undefined) => (t ?? '').replace(/\s+/g, ' ').trim();
  const schluesselVon = (p: Pos) => {
    const b = bezugVon.get(p.id);
    return `pos:${KALK_VERSION}:${mit_plaenen ? 'plan' : 'text'}:${hash([norm(p.kurztext), norm(p.langtext), p.menge ?? '', norm(p.einheit), b ? `${norm(b.kurztext)} ${norm(b.langtext)}` : ''].join('|'))}`;
  };
  const kandidaten = [...gruppen.values()].map((g) => g[0]);
  const bekannt = new Map<string, KiAnsatz>();
  if (!gruendlich && kandidaten.length) {
    const { data: g } = await sb.from('ki_gedaechtnis').select('schluessel,daten').in('schluessel', kandidaten.map(schluesselVon));
    for (const z of g ?? []) bekannt.set(z.schluessel, z.daten as KiAnsatz);
  }
  for (const p of kandidaten) {
    const k = bekannt.get(schluesselVon(p));
    if (!k) continue;
    await speichern(p, { ...k, id: p.id }, { gedaechtnis: true });
    gesetzt++;
    for (const g of gruppen.get(gleichSchluessel(p))!.slice(1)) {
      await speichern(g, { ...k, id: g.id }, { gleich_wie: p.oz, gedaechtnis: true });
      gesetzt++;
    }
  }
  const vertreter = kandidaten.filter((p) => !bekannt.has(schluesselVon(p)));
  if (!vertreter.length) return NextResponse.json({ gesetzt, kosten: 0, uebernommen: gesetzt });

  // 2. Wissen aus dem Archiv: ähnliche Positionen aus seinen Angeboten
  let archiv: Record<string, ArchivTreffer[]> = {};
  try {
    archiv = await aehnlicheFuer(sb, vertreter, id, 3);
  } catch (e) {
    console.error('archiv', e);
  }

  const stammText = STAMMDATEN_DEFS.filter((d) => /^(satz_|stahl_|kleinteile|befestigung|verzinkung|grundierung|gel_|tr_|kg_)/.test(d.schluessel))
    .map((d) => `- ${d.bezeichnung}: ${werte[d.schluessel]} ${d.einheit}`)
    .join('\n');
  const hinweise = (projekt?.ergebnis?.hinweise as string[] | undefined) ?? [];

  const plaene: Parameters<typeof kiStrukturiert>[0]['inhalt'] = [];
  if (mit_plaenen) {
    const { data: pl } = await sb.from('dateien').select('pfad,name,groesse').eq('projekt_id', id).eq('art', 'plan').order('created_at').limit(3);
    for (const d of pl ?? []) {
      if ((d.groesse ?? 0) > 15_000_000) continue;
      const { data: b } = await sb.storage.from('unterlagen').download(d.pfad);
      if (!b) continue;
      plaene.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: Buffer.from(await b.arrayBuffer()).toString('base64') } });
    }
  }

  const frage = async (liste: Pos[], stufe: Stufe) => {
    const inhalt: Parameters<typeof kiStrukturiert>[0]['inhalt'] = [
      ...plaene,
      {
        type: 'text',
        text: `Projekt: ${projekt?.titel ?? ''}\n${hinweise.length ? `Hinweise aus Vorbemerkungen und Baubeschreibung:\n${hinweise.map((h) => '- ' + h).join('\n')}\n` : ''}${mit_plaenen ? 'Die beigefügten Pläne gehören zum Projekt. Ziehe Massen und Profile aus den Plänen, wenn der Positionstext sie nicht nennt (erst Legende, dann Maßstab, dann Massen).\n' : ''}\nPositionen (id | OZ | Menge Einheit | Text):\n${liste
          .map((p) => {
            const b = bezugVon.get(p.id);
            const bezug = b ? `\nBezugsposition für „wie vor“ (OZ ${b.oz ?? ''}, ${b.menge ?? '?'} ${b.einheit ?? ''}):\n${b.kurztext ?? ''}\n${(b.langtext ?? '').slice(0, 2500)}` : '';
            return `### id=${p.id} | OZ ${p.oz ?? ''} | ${p.menge ?? '?'} ${p.einheit ?? ''}\n${p.kurztext ?? ''}\n${(p.langtext ?? '').slice(0, 3500)}${bezug}${archiv[p.id]?.length ? `\n${archivKontext(archiv[p.id])}` : ''}`;
          })
          .join('\n\n')}`,
      },
    ];
    const r = await kiStrukturiert<{ positionen: KiAntwort[] }>({
      sb,
      projektId: id,
      zweck: `Kalkulieren ${liste.length} Positionen${mit_plaenen ? ' mit Plänen' : ''} (${stufe})`,
      stufe,
      system: systemKalkulieren(stammText),
      inhalt,
      schema: SCHEMA_KALKULIEREN,
      maxTokens: 12000,
    });
    return { liste: r.daten.positionen.map(flach), kosten: r.kostenEur };
  };

  try {
    // 3. Erster Vorschlag mit dem schnellen Modell (oder gründlich auf ausdrücklichen Wunsch)
    const erst = await frage(vertreter, gruendlich ? 'premium' : 'schnell');
    let kosten = erst.kosten;
    const ergebnis = new Map(erst.liste.map((k) => [k.id, k]));
    // 4. Unsichere Positionen rechnet das größere Modell automatisch nach
    if (!gruendlich) {
      const nach = vertreter.filter((p) => (ergebnis.get(p.id)?.sicherheit ?? 0) < NACHRECHNEN_UNTER && ergebnis.get(p.id)?.unser_gewerk !== false);
      if (nach.length) {
        try {
          const zweit = await frage(nach, 'standard');
          kosten += zweit.kosten;
          for (const k of zweit.liste) ergebnis.set(k.id, k);
        } catch (e) {
          console.error('nachrechnen', e);
        }
      }
    }
    for (const p of vertreter) {
      const k = ergebnis.get(p.id);
      if (!k) continue;
      const treffer = (archiv[p.id] ?? []).map((t) => ({ projekt: t.projekt, datum: t.datum, text: t.text.slice(0, 200), ep: t.ep, einheit: t.einheit, kg_je_einheit: t.kg_je_einheit, aehnlichkeit: Math.round(t.aehnlichkeit * 100) / 100 }));
      await speichern(p, k, { archiv: treffer });
      await merken(sb, schluesselVon(p), 'position', { ...k, id: undefined });
      gesetzt++;
      // gleiche Positionen derselben Gruppe bekommen denselben Ansatz
      for (const g of gruppen.get(gleichSchluessel(p))!.slice(1)) {
        await speichern(g, { ...k, id: g.id }, { gleich_wie: p.oz, archiv: treffer });
        gesetzt++;
      }
    }
    return NextResponse.json({ gesetzt, kosten });
  } catch (e) {
    const msg = e instanceof KiFehler ? e.nutzerText : 'Beim Kalkulieren ist ein Fehler aufgetreten.';
    console.error('kalkulieren', e);
    return NextResponse.json({ fehler: msg }, { status: 502 });
  }
}
