import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { aktuellesProfil, supabaseServer } from '@/lib/supabase/server';
import { getVercelOidcToken } from '@vercel/oidc';
import { kiBetrieb, kiStrukturiert, nullSpeicherungPruefen, modellKette } from '@/lib/ki';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Wartungszugang ohne Anmeldung: nur mit dem Prüf-Token aus der Umgebung (KI_PRUEF_TOKEN), sonst gesperrt. */
function tokenOk(req: Request) {
  const soll = process.env.KI_PRUEF_TOKEN ?? '';
  const ist = req.headers.get('x-pruef-token') ?? '';
  if (soll.length < 24 || ist.length !== soll.length) return false;
  return timingSafeEqual(Buffer.from(soll), Buffer.from(ist));
}

/**
 * Technischer Selbsttest: Anmeldung, Region, Null-Speicherung. Gibt keine Geheimnisse aus.
 * Mit ?ping=1 zusätzlich ein echter Mini-Aufruf an das Sprachmodell (Bruchteil eines Cents, kein Kundeninhalt).
 */
export async function GET(req: Request) {
  const profil = await aktuellesProfil();
  if (!(profil?.rolle === 'admin' || tokenOk(req))) return NextResponse.json({ fehler: 'Keine Berechtigung.' }, { status: 403 });
  const status: Record<string, unknown> = { betrieb: kiBetrieb(), region: 'eu-central-1', rolle_gesetzt: Boolean(process.env.AWS_ROLE_ARN), schluessel_direkt_gesetzt: Boolean(process.env.ANTHROPIC_API_KEY), modelle: { premium: modellKette('premium'), standard: modellKette('standard') } };
  try {
    const t = await getVercelOidcToken();
    const nutzlast = JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString('utf8'));
    status.oidc = { iss: nutzlast.iss, aud: nutzlast.aud, sub: nutzlast.sub };
  } catch (e) {
    status.oidc = { fehler: (e as Error).message };
  }
  if (kiBetrieb() === 'eu') try {
    status.datenhaltung = await nullSpeicherungPruefen();
  } catch (e) {
    status.datenhaltung = { fehler: (e as Error).message };
  }
  if (new URL(req.url).searchParams.get('ping') === '1') {
    const t0 = Date.now();
    try {
      const sb = await supabaseServer();
      const stufe = (new URL(req.url).searchParams.get('stufe') ?? 'schnell') as 'schnell' | 'standard';
      const r = await kiStrukturiert<{ antwort: string }>({
        sb,
        projektId: null,
        zweck: 'Selbsttest',
        stufe: stufe === 'standard' ? 'standard' : 'schnell',
        system: 'Antworte knapp.',
        inhalt: [{ type: 'text', text: 'Antworte mit dem Wort "bereit".' }],
        schema: { type: 'object', properties: { antwort: { type: 'string' } }, required: ['antwort'], additionalProperties: false },
        maxTokens: 50,
        pruefeBudget: false,
      });
      status.ping = { ok: true, modell: r.modell, antwort: r.daten.antwort.slice(0, 20), ms: Date.now() - t0 };
    } catch (e) {
      status.ping = { ok: false, ms: Date.now() - t0, fehler: (e as Error).message.slice(0, 300) };
    }
  }
  return NextResponse.json(status);
}
