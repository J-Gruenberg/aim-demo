import { aktuellesProfil, supabaseServer } from '@/lib/supabase/server';
import { KontoFormular } from './KontoFormular';
import { euro } from '@/lib/format';
import { kiBetrieb, nullSpeicherungPruefen } from '@/lib/ki';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Konto' };

export default async function KontoSeite() {
  const profil = await aktuellesProfil();
  const sb = await supabaseServer();
  const monat = new Date();
  monat.setDate(1);
  monat.setHours(0, 0, 0, 0);
  const { data: ki } = await sb.from('ki_aufrufe').select('kosten_eur').gte('created_at', monat.toISOString());
  const kosten = (ki ?? []).reduce((s, r) => s + Number(r.kosten_eur ?? 0), 0);
  const betrieb = kiBetrieb();
  let schutz: { stufe: 'gut' | 'hinweis' | 'aus'; text: string; erklaerung: string };
  if (betrieb === 'eu') {
    try {
      const p = await nullSpeicherungPruefen();
      schutz = p.ok
        ? { stufe: 'gut', text: 'Verarbeitung in EU-Rechenzentren ab Frankfurt, Null-Speicherung bestätigt.', erklaerung: 'Unterlagen werden nur in der EU ausgewertet und dort nicht gespeichert. Die Anwendung prüft das vor jeder Auswertung selbst.' }
        : { stufe: 'aus', text: 'Null-Speicherung nicht bestätigt, KI-Auswertung ist gesperrt.', erklaerung: 'Ohne bestätigte Null-Speicherung verlässt kein Inhalt die Anwendung.' };
    } catch {
      schutz = { stufe: 'aus', text: 'Die KI-Auswertung ist gerade nicht erreichbar.', erklaerung: 'Alles andere funktioniert wie gewohnt.' };
    }
  } else if (betrieb === 'direkt') {
    schutz = {
      stufe: 'hinweis',
      text: 'Testbetrieb: KI-Auswertung übergangsweise direkt beim Modellanbieter.',
      erklaerung: 'Ausgewertete Unterlagen werden verschlüsselt übertragen, außerhalb der EU verarbeitet und nicht zum Trainieren genutzt. Die Umstellung auf EU-Rechenzentren mit Null-Speicherung folgt nach dem Test.',
    };
  } else {
    schutz = { stufe: 'aus', text: 'Die KI-Auswertung ist gerade nicht eingerichtet.', erklaerung: 'Alles andere funktioniert wie gewohnt.' };
  }
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-ink-950">Konto</h1>
      <section className="karte p-5 grid sm:grid-cols-[1fr_1.6fr_1fr] gap-4 text-sm">
        <div><div className="label">Name</div>{profil?.name ?? '–'}</div>
        <div className="min-w-0 break-all"><div className="label">E-Mail</div>{profil?.email}</div>
        <div><div className="label">Rolle</div>{profil?.rolle === 'admin' ? 'Administrator' : profil?.rolle === 'leser' ? 'Nur lesen' : 'Kalkulator'}</div>
      </section>
      <KontoFormular />
      <section className="karte p-5 space-y-3">
        <h2 className="font-semibold">Datenexport</h2>
        <p className="text-sm text-grau">Alle Kalkulationen, Positionen, Stammdaten, Referenzen und das Änderungsprotokoll als eine Datei. Die Daten gehören Ihnen und sind jederzeit vollständig exportierbar.</p>
        <a href="/api/export" className="knopf-zweit">Vollexport herunterladen</a>
      </section>
      <section className="karte p-5 space-y-1">
        <h2 className="font-semibold">KI-Kosten diesen Monat</h2>
        <p className="zahl text-xl">{euro(kosten)}</p>
        <p className="text-sm text-grau">Für das Auslesen von Leistungsverzeichnissen und Plänen. Jede Auswertung zeigt ihre Kosten auch im Projekt.</p>
      </section>
      <section className="karte p-5 space-y-1">
        <h2 className="font-semibold">Datenschutz der KI-Auswertung</h2>
        <p className={`text-sm font-medium ${schutz.stufe === 'gut' ? 'text-gruen' : schutz.stufe === 'hinweis' ? 'text-gelb' : 'text-rot'}`}>{schutz.stufe === 'gut' ? '✓ ' : ''}{schutz.text}</p>
        <p className="text-sm text-grau">{schutz.erklaerung}</p>
      </section>
    </div>
  );
}
