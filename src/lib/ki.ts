import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { BedrockClient, GetAccountDataRetentionCommand } from '@aws-sdk/client-bedrock';
import { awsCredentialsProvider } from '@vercel/oidc-aws-credentials-provider';

/**
 * KI-Aufrufe mit strukturierter Ausgabe (JSON-Schema), Kostenprotokoll und Budget je Projekt.
 *
 * Zwei Betriebsarten, gewählt über die Umgebung:
 * - "eu" (Ziel, sobald AWS_ROLE_ARN gesetzt ist): siehe unten.
 * - "direkt" (Übergang im ersten Testbetrieb, nur ANTHROPIC_API_KEY gesetzt): Aufruf direkt beim Modellanbieter,
 *   Verarbeitung in den USA, kein Training mit den Daten, aber keine Null-Speicherung. Oberfläche und
 *   Datenschutzseite zeigen das ehrlich an.
 *
 * Datenschutz im Betrieb "eu" (Angebot 1595 und AVV):
 * - Verarbeitung ausschließlich in EU-Rechenzentren: Aufruf aus Frankfurt (eu-central-1) über das
 *   EU-Inferenzprofil, Zielregionen nur innerhalb der EU.
 * - Zero-Data-Retention: Vor dem ersten Aufruf (und danach alle 10 Minuten) wird geprüft, dass das Konto
 *   in Frankfurt auf Datenhaltung "none" steht. Ist das nicht der Fall, geht kein Inhalt raus.
 * - Kein Zugriff des Modellanbieters auf Eingaben oder Ausgaben, kein Training.
 * - Anmeldung ohne gespeicherte Schlüssel über eine Vertrauensstellung (OIDC) zwischen Hosting und Rechenzentrum.
 * - Austauschbar: Modelle kommen aus Umgebungsvariablen, bei Ausfall springt das Ausweichmodell ein.
 * Anbieter- und Modellnamen erscheinen nie in der Oberfläche, nur hier und im Protokoll.
 */

/** schnell: Lesen und erster Vorschlag (kleines Modell), standard: Nachrechnen unsicherer Positionen, premium: auf ausdrücklichen Wunsch. */
export type Stufe = 'schnell' | 'standard' | 'premium';

const REGION = 'eu-central-1';

export type Betrieb = 'eu' | 'direkt' | 'gateway' | 'aus';
/**
 * Welche Verbindung die KI gerade nutzt. EU hat Vorrang, sobald sie eingerichtet ist.
 * "gateway": Aufruf über das KI-Gateway des Hostings mit der Vertrauensstellung (OIDC) der Anwendung,
 * ohne gespeicherten Schlüssel. Greift nur, wenn kein eigener Schlüssel hinterlegt ist.
 */
export function kiBetrieb(): Betrieb {
  if (process.env.AWS_ROLE_ARN) return 'eu';
  if (process.env.ANTHROPIC_API_KEY) return 'direkt';
  if (process.env.VERCEL || process.env.VERCEL_OIDC_TOKEN || process.env.KI_GATEWAY === '1') return 'gateway';
  return 'aus';
}

// Modellnamen ohne Präfix; das Präfix für das EU-Inferenzprofil kommt beim Aufruf dazu.
const MODELL_PREMIUM = () => basisName(process.env.KI_MODELL_PREMIUM || 'claude-opus-5-5');
const MODELL_STANDARD = () => basisName(process.env.KI_MODELL_STANDARD || 'claude-sonnet-5-5');
const MODELL_SCHNELL = () => basisName(process.env.KI_MODELL_SCHNELL || 'claude-haiku-5-5');

/** Listenpreise in USD je Mio. Token (EU-Profil mit 10 % Regionalaufschlag, unten als Faktor). */
const PREISE_USD_MTOK: Record<string, { ein: number; aus: number; lang?: { ein: number; aus: number } }> = {
  'claude-haiku-5-5': { ein: 0.1, aus: 0.5, lang: { ein: 0.5, aus: 2.5 } }, // lang: Eingaben über 100.000 Token
  'claude-sonnet-5-5': { ein: 2, aus: 10 },
  'claude-opus-5-5': { ein: 4, aus: 20 },
};
const REGIONAL_FAKTOR = 1.1;

export function modell(stufe: Stufe) {
  return stufe === 'premium' ? MODELL_PREMIUM() : stufe === 'schnell' ? MODELL_SCHNELL() : MODELL_STANDARD();
}

/** Reihenfolge der Modelle je Stufe: erst das gewünschte, dann das Ausweichmodell. */
export function modellKette(stufe: Stufe): string[] {
  const kette =
    stufe === 'premium' ? [MODELL_PREMIUM(), MODELL_STANDARD()] : stufe === 'schnell' ? [MODELL_SCHNELL(), MODELL_STANDARD()] : [MODELL_STANDARD(), MODELL_PREMIUM()];
  const extra = process.env.KI_MODELL_AUSWEICH;
  if (extra) kette.push(basisName(extra));
  return [...new Set(kette)];
}

function basisName(m: string) {
  return m.replace(/^(eu|us|global|apac)\./, '').replace(/^anthropic\./, '');
}

/** Kosten in Euro. Cache-Schreiben kostet 1,25-fach, Cache-Lesen ein Zehntel (Haiku) bzw. ein Zwanzigstel. */
export function kostenEur(m: string, ein: number, aus: number, cacheSchreiben = 0, cacheLesen = 0) {
  const basis = PREISE_USD_MTOK[basisName(m)] ?? { ein: 4, aus: 20 };
  const p = basis.lang && ein + cacheSchreiben + cacheLesen > 100_000 ? basis.lang : basis;
  const leseFaktor = basisName(m).includes('haiku') ? 0.1 : 0.05;
  const kurs = Number(process.env.KI_USD_EUR || '0.87');
  const usd = (ein * p.ein + cacheSchreiben * p.ein * 1.25 + cacheLesen * p.ein * leseFaktor + aus * p.aus) / 1_000_000;
  // EU-Profil und US-Verarbeitung (inference_geo "us") kosten beide 10 % Aufschlag
  return usd * REGIONAL_FAKTOR * kurs;
}

export class KiFehler extends Error {
  constructor(public nutzerText: string, technisch?: string) {
    super(technisch ?? nutzerText);
  }
}

export async function budgetPruefen(sb: SupabaseClient, projektId: string) {
  const [{ data: p }, { data: k }] = await Promise.all([
    sb.from('projekte').select('ki_budget_eur').eq('id', projektId).single(),
    sb.from('ki_aufrufe').select('kosten_eur').eq('projekt_id', projektId),
  ]);
  const verbraucht = (k ?? []).reduce((s, r) => s + Number(r.kosten_eur ?? 0), 0);
  const budget = Number(p?.ki_budget_eur ?? 25);
  return { verbraucht, budget, frei: budget - verbraucht };
}

type Inhalt =
  | { type: 'text'; text: string }
  | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } }
  | { type: 'image'; source: { type: 'base64'; media_type: 'image/png' | 'image/jpeg'; data: string } };

// ---------- Verbindung ins Rechenzentrum Frankfurt ----------

let _laufzeit: BedrockRuntimeClient | null = null;
let _steuerung: BedrockClient | null = null;

function zugang() {
  const roleArn = process.env.AWS_ROLE_ARN;
  if (!roleArn) {
    throw new KiFehler('Die KI-Auswertung ist gerade nicht eingerichtet. Alles andere funktioniert wie gewohnt.', 'AWS_ROLE_ARN fehlt');
  }
  return awsCredentialsProvider({ roleArn, roleSessionName: 'aim-demo' });
}

function laufzeit() {
  if (!_laufzeit) _laufzeit = new BedrockRuntimeClient({ region: REGION, credentials: zugang(), requestHandler: { requestTimeout: 280_000 } as never });
  return _laufzeit;
}
function steuerung() {
  if (!_steuerung) _steuerung = new BedrockClient({ region: REGION, credentials: zugang() });
  return _steuerung;
}

let _geprueft: { modus: string; bis: number } | null = null;

/** Prüft, dass in Frankfurt nichts gespeichert wird (Datenhaltung "none"). Ergebnis 10 Minuten gültig. */
export async function nullSpeicherungPruefen(): Promise<{ modus: string; ok: boolean }> {
  if (_geprueft && _geprueft.bis > Date.now()) return { modus: _geprueft.modus, ok: _geprueft.modus === 'none' };
  const r = await steuerung().send(new GetAccountDataRetentionCommand({}));
  const modus = String(r.mode ?? 'unbekannt');
  _geprueft = { modus, bis: Date.now() + 10 * 60_000 };
  return { modus, ok: modus === 'none' };
}

const AUSWEICHEN_BEI = new Set([
  'ThrottlingException',
  'ServiceUnavailableException',
  'ModelNotReadyException',
  'InternalServerException',
  'ModelTimeoutException',
  'ModelErrorException',
  'ResourceNotFoundException',
  'AccessDeniedException',
]);

/**
 * Suchvektoren für den Archiv-Abgleich (semantische Ähnlichkeit). Läuft direkt in Frankfurt.
 * Gibt null zurück, wenn die Verbindung (noch) nicht eingerichtet ist; dann sucht die Datenbank per Textähnlichkeit.
 */
export async function einbetten(texte: string[]): Promise<number[][] | null> {
  if (!process.env.AWS_ROLE_ARN || !texte.length) return null;
  try {
    const p = await nullSpeicherungPruefen();
    if (!p.ok) return null;
    const ergebnis: number[][] = [];
    for (let i = 0; i < texte.length; i += 8) {
      const teil = await Promise.all(
        texte.slice(i, i + 8).map(async (t) => {
          const r = await laufzeit().send(
            new InvokeModelCommand({
              modelId: process.env.KI_MODELL_SUCHE || 'amazon.titan-embed-text-v2:0',
              contentType: 'application/json',
              accept: 'application/json',
              body: JSON.stringify({ inputText: t.slice(0, 7000) || '-', dimensions: 1024, normalize: true }),
            }),
          );
          return (JSON.parse(new TextDecoder().decode(r.body)) as { embedding: number[] }).embedding;
        }),
      );
      ergebnis.push(...teil);
    }
    return ergebnis;
  } catch {
    return null;
  }
}

export async function kiStrukturiert<T>(opts: {
  sb: SupabaseClient | null;
  projektId: string | null;
  zweck: string;
  stufe: Stufe;
  system: string;
  inhalt: Inhalt[];
  schema: Record<string, unknown>;
  maxTokens?: number;
  pruefeBudget?: boolean;
}): Promise<{ daten: T; kostenEur: number; modell: string }> {
  if (opts.sb && opts.projektId && opts.pruefeBudget !== false) {
    const b = await budgetPruefen(opts.sb, opts.projektId);
    if (b.frei <= 0) throw new KiFehler(`Das KI-Budget dieses Projekts (${b.budget.toFixed(2).replace('.', ',')} €) ist aufgebraucht. Im Projekt erhöhen, dann weiter.`);
  }

  const betrieb = kiBetrieb();
  if (betrieb === 'aus') throw new KiFehler('Die KI-Auswertung ist gerade nicht eingerichtet. Alles andere funktioniert wie gewohnt.', 'weder AWS_ROLE_ARN noch ANTHROPIC_API_KEY');

  // Betrieb "eu": harte Sperre, ohne bestätigte Null-Speicherung verlässt kein Inhalt die Anwendung.
  if (betrieb === 'eu') {
    let pruefung: { modus: string; ok: boolean };
    try {
      pruefung = await nullSpeicherungPruefen();
    } catch (e) {
      if (e instanceof KiFehler) throw e;
      throw new KiFehler('Die KI-Auswertung ist gerade nicht erreichbar. Bitte in einer Minute erneut versuchen.', `Datenhaltung nicht prüfbar: ${(e as Error).message}`);
    }
    if (!pruefung.ok) {
      throw new KiFehler('Die KI-Auswertung ist gesperrt, weil die Null-Speicherung im Rechenzentrum nicht bestätigt ist. Bitte kurz bei Jonas melden.', `Datenhaltung ist "${pruefung.modus}" statt "none"`);
    }
  }

  const nutzlast = {
    max_tokens: opts.maxTokens ?? 16000,
    system: [{ type: 'text', text: opts.system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: opts.inhalt }],
    output_config: { format: { type: 'json_schema', schema: opts.schema } },
  };

  let letzterFehler = '';
  // Ohne Zufall: gleiche Eingabe, möglichst gleiche Antwort. Lehnt ein Modell die Einstellung ab, ohne sie weiter.
  let ohneZufall = true;
  for (const basis of modellKette(opts.stufe)) {
    const m = betrieb === 'eu' ? `eu.anthropic.${basis}` : basis;
    for (let versuch = 0; versuch < 2; versuch++) {
      const r = await rufeAuf(betrieb, m, ohneZufall ? { ...nutzlast, temperature: 0 } : nutzlast);
      if (!r.ok && ohneZufall && /temperature/i.test(r.text)) {
        ohneZufall = false;
        versuch--;
        continue;
      }
      if (!r.ok) {
        letzterFehler = `${m}: ${r.name}: ${r.text}`;
        await opts.sb?.from('ki_aufrufe').insert({ projekt_id: opts.projektId, zweck: opts.zweck, modell: m, ok: false, fehler: letzterFehler.slice(0, 2000) });
        if (r.drosselung && versuch === 0) {
          await new Promise((res) => setTimeout(res, 2500));
          continue;
        }
        if (r.ausweichen) break; // nächstes Modell
        throw new KiFehler('Die KI-Auswertung konnte diese Unterlage nicht verarbeiten. Bitte erneut versuchen oder kleinere Seitenbereiche wählen.', letzterFehler);
      }
      const d = r.antwort;
      const cs = d.usage?.cache_creation_input_tokens ?? 0;
      const cl = d.usage?.cache_read_input_tokens ?? 0;
      const ein = (d.usage?.input_tokens ?? 0) + cs + cl;
      const aus = d.usage?.output_tokens ?? 0;
      const kosten = kostenEur(m, d.usage?.input_tokens ?? 0, aus, cs, cl);
      const werkzeug = (d.content ?? []).find((c) => c.type === 'tool_use') as { input?: unknown } | undefined;
      const text = (d.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join('');
      try {
        const daten = (werkzeug?.input ?? JSON.parse(text)) as T;
        await opts.sb?.from('ki_aufrufe').insert({ projekt_id: opts.projektId, zweck: opts.zweck, modell: m, input_tokens: ein, output_tokens: aus, kosten_eur: kosten, ok: true });
        return { daten, kostenEur: kosten, modell: m };
      } catch {
        await opts.sb?.from('ki_aufrufe').insert({ projekt_id: opts.projektId, zweck: opts.zweck, modell: m, input_tokens: ein, output_tokens: aus, kosten_eur: kosten, ok: false, fehler: `stop=${d.stop_reason}` });
        throw new KiFehler(d.stop_reason === 'max_tokens' ? 'Der Abschnitt war zu lang für einen Durchgang. Bitte kleinere Seitenbereiche lesen.' : 'Die KI-Antwort war unvollständig. Bitte erneut versuchen.');
      }
    }
  }
  throw new KiFehler('Die KI-Auswertung ist gerade nicht erreichbar. Bitte in einer Minute erneut versuchen.', letzterFehler);
}

type Antwort = {
  content: { type: string; text?: string; input?: unknown }[];
  usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
  stop_reason: string;
};
type Ergebnis = { ok: true; antwort: Antwort } | { ok: false; name: string; text: string; drosselung: boolean; ausweichen: boolean };

/** Ein Aufruf in der jeweiligen Betriebsart, Fehler einheitlich aufbereitet. */
async function rufeAuf(betrieb: Betrieb, m: string, nutzlast: Record<string, unknown>): Promise<Ergebnis> {
  if (betrieb === 'eu') {
    try {
      const r = await laufzeit().send(
        new InvokeModelCommand({ modelId: m, contentType: 'application/json', accept: 'application/json', body: JSON.stringify({ anthropic_version: 'bedrock-2023-05-31', ...nutzlast }) }),
      );
      return { ok: true, antwort: JSON.parse(new TextDecoder().decode(r.body)) as Antwort };
    } catch (e) {
      const name = (e as { name?: string }).name ?? 'Fehler';
      return { ok: false, name, text: (e as Error).message, drosselung: name === 'ThrottlingException', ausweichen: AUSWEICHEN_BEI.has(name) };
    }
  }
  if (betrieb === 'gateway') {
    try {
      const { getVercelOidcToken } = await import('@vercel/oidc');
      const token = process.env.AI_GATEWAY_API_KEY || (await getVercelOidcToken());
      // Strukturierte Antwort über einen erzwungenen Werkzeugaufruf: funktioniert über jedes Gateway gleich
      const { output_config, ...rest } = nutzlast as { output_config?: { format?: { schema?: unknown } } } & Record<string, unknown>;
      const body = {
        model: `anthropic/${m}`,
        ...rest,
        tools: [{ name: 'antwort', description: 'Gib das Ergebnis ausschließlich über dieses Werkzeug zurück.', input_schema: output_config?.format?.schema }],
        tool_choice: { type: 'tool', name: 'antwort' },
        providerOptions: { gateway: { disallowPromptTraining: true } },
      };
      const r = await fetch('https://ai-gateway.vercel.sh/v1/messages', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(280_000),
      });
      if (r.ok) return { ok: true, antwort: (await r.json()) as Antwort };
      const text = (await r.text()).slice(0, 1500);
      const drosselung = r.status === 429 || r.status === 529;
      return { ok: false, name: `HTTP ${r.status}`, text, drosselung, ausweichen: drosselung || r.status === 404 || r.status >= 500 };
    } catch (e) {
      return { ok: false, name: (e as { name?: string }).name ?? 'Fehler', text: (e as Error).message, drosselung: false, ausweichen: true };
    }
  }
  // Übergang: direkt beim Modellanbieter, Verarbeitung in den USA
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY ?? '', 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: m, inference_geo: 'us', ...nutzlast }),
      signal: AbortSignal.timeout(280_000),
    });
    if (r.ok) return { ok: true, antwort: (await r.json()) as Antwort };
    const text = (await r.text()).slice(0, 1500);
    const drosselung = r.status === 429 || r.status === 529;
    return { ok: false, name: `HTTP ${r.status}`, text, drosselung, ausweichen: drosselung || r.status === 404 || r.status >= 500 };
  } catch (e) {
    return { ok: false, name: (e as { name?: string }).name ?? 'Fehler', text: (e as Error).message, drosselung: false, ausweichen: true };
  }
}
