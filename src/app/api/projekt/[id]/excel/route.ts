import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { supabaseServer, aktuellesProfil } from '@/lib/supabase/server';
import { ladeReferenzen, ladeStammdaten, referenzPunkte } from '@/lib/daten';
import { berechneHalle, LEERE_HALLE } from '@/lib/engine/halle';

export const runtime = 'nodejs';

const EUR = '#,##0.00 "€"';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await aktuellesProfil())) return NextResponse.json({ fehler: 'Bitte anmelden.' }, { status: 401 });
  const sb = await supabaseServer();
  const { data: p } = await sb.from('projekte').select('*').eq('id', id).maybeSingle();
  if (!p) return NextResponse.json({ fehler: 'Nicht gefunden.' }, { status: 404 });
  const wb = new ExcelJS.Workbook();
  wb.creator = 'AIM';
  const ws = wb.addWorksheet(p.typ === 'halle' ? 'Kalkulation Hallenbau' : 'Leistungsverzeichnis');
  ws.addRow([p.titel]).font = { bold: true, size: 14 };
  ws.addRow([[p.kunde, p.ort].filter(Boolean).join(' · ')]);
  ws.addRow([]);

  if (p.typ === 'halle') {
    const [{ werte }, refs] = await Promise.all([ladeStammdaten(sb), ladeReferenzen(sb, 'halle')]);
    const e = { ...LEERE_HALLE, ...(p.eingaben ?? {}), optionen: { ...LEERE_HALLE.optionen, ...(p.eingaben?.optionen ?? {}) }, manuell: p.eingaben?.manuell ?? {} };
    const erg = berechneHalle(e, werte, referenzPunkte(refs));
    ws.addRow([`Größe: ${e.laenge} × ${e.breite} × ${e.traufhoehe} m Traufhöhe, ${e.dachform}, ${e.neigung}°`]);
    ws.addRow([]);
    const kopf = ws.addRow(['Position', 'Menge', 'Einheit', 'Einzelpreis', 'Gesamt', 'Herleitung']);
    kopf.font = { bold: true };
    for (const z of erg.zeilen) {
      const r = ws.addRow([z.bezeichnung, z.aktiv ? z.menge : null, z.einheit, z.aktiv ? z.ep : null, z.aktiv ? z.gp : null, z.herleitung]);
      if (!z.aktiv) r.font = { color: { argb: 'FF999999' } };
    }
    ws.addRow([]);
    ws.addRow(['Gesamt netto', null, null, null, erg.summe_netto]).font = { bold: true };
    ws.addRow([`Zuschlag ${erg.zuschlag_prozent} %`, null, null, null, erg.zuschlag]);
    ws.addRow(['Angebotspreis netto, gerundet', null, null, null, erg.angebot_gerundet]).font = { bold: true };
    ws.getColumn(1).width = 42;
    ws.getColumn(2).width = 12;
    ws.getColumn(3).width = 9;
    ws.getColumn(4).width = 14;
    ws.getColumn(5).width = 16;
    ws.getColumn(6).width = 60;
    ws.getColumn(4).numFmt = EUR;
    ws.getColumn(5).numFmt = EUR;
  } else {
    const { data: pos } = await sb.from('positionen').select('*').eq('projekt_id', id).order('sort');
    const kopf = ws.addRow(['OZ', 'Kurztext', 'Menge', 'Einheit', 'EP', 'GP', 'Status', 'Ansatz / Rechenweg', 'Langtext']);
    kopf.font = { bold: true };
    let summe = 0;
    for (const x of pos ?? []) {
      if (x.typ !== 'fremd' && x.gp) summe += Number(x.gp);
      ws.addRow([x.oz, x.kurztext, x.menge !== null ? Number(x.menge) : null, x.einheit, x.ep !== null ? Number(x.ep) : null, x.gp !== null ? Number(x.gp) : null, x.status, x.begruendung, x.langtext]);
    }
    ws.addRow([]);
    ws.addRow([null, 'Summe netto (ohne Fremdgewerke)', null, null, null, summe]).font = { bold: true };
    [10, 48, 10, 8, 13, 15, 12, 60, 80].forEach((w, i) => (ws.getColumn(i + 1).width = w));
    ws.getColumn(5).numFmt = EUR;
    ws.getColumn(6).numFmt = EUR;
    ws.getColumn(9).alignment = { wrapText: false };
  }
  const buf = await wb.xlsx.writeBuffer();
  const name = `${p.titel.replace(/×/g, 'x').replace(/[^\wäöüÄÖÜß\-,. ]+/g, '').replace(/\s+/g, ' ').trim() || 'Kalkulation'}.xlsx`;
  return new NextResponse(Buffer.from(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
    },
  });
}
