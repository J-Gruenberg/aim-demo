// Erzeugt das SQL zum Anlegen bzw. Aktualisieren der Stammdaten (bestätigte Werte bleiben unangetastet).
import { STAMMDATEN_DEFS } from '../src/lib/engine/stammdaten.ts';
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const gruppen = [...new Set(STAMMDATEN_DEFS.map((d) => d.gruppe))];
const quellen = [...new Set(STAMMDATEN_DEFS.map((d) => d.quelle))];
const rows = STAMMDATEN_DEFS.map((d, i) => `(${q(d.schluessel)},${gruppen.indexOf(d.gruppe) + 1},${q(d.bezeichnung)},${d.wert},${q(d.einheit)},${quellen.indexOf(d.quelle) + 1},${d.notiz ? q(d.notiz) : 'null'},${i})`);
console.log(`with g(a) as (select array[${gruppen.map(q).join(',')}]), qu(a) as (select array[${quellen.map(q).join(',')}]),
v(schluessel,gi,bezeichnung,wert,einheit,qi,notiz,sort) as (values
${rows.join(',\n')})
insert into public.stammdaten (schluessel, gruppe, bezeichnung, wert, einheit, quelle, bestaetigt, notiz, sort)
select v.schluessel, (select a from g)[v.gi], v.bezeichnung, v.wert, v.einheit, (select a from qu)[v.qi], false, v.notiz, v.sort from v
on conflict (schluessel) do update set gruppe = excluded.gruppe, bezeichnung = excluded.bezeichnung, einheit = excluded.einheit, sort = excluded.sort, notiz = excluded.notiz, quelle = case when public.stammdaten.bestaetigt then public.stammdaten.quelle else excluded.quelle end, wert = case when public.stammdaten.bestaetigt then public.stammdaten.wert else excluded.wert end;`);
