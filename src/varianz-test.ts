import { baugruppeRechnen, teilart } from './lib/engine/zeichnung';
import { readFileSync } from 'node:fs';
const rows = JSON.parse(readFileSync(process.argv[2], 'utf8'));
for (const r of rows) {
  const e = baugruppeRechnen(r.ansatz, {});
  console.log(r.projekt_id.slice(0, 8), e.ep, 'h', e.kennzahlen.stunden.toFixed(1), 'm2', e.kennzahlen.flaeche_m2.toFixed(1), r.ansatz.teile.map((t: any) => teilart(t).slice(0, 6)).join(','));
  for (const b of e.bausteine) if (b.betrag > 40) console.log('   ', b.betrag.toFixed(0).padStart(5), b.text.slice(0, 90));
}
