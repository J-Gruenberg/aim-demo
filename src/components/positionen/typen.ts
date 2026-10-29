import { rechnePosition, type Ansatz, type PositionsRechnung } from '@/lib/engine/bauteile';
import type { Stammdaten } from '@/lib/engine/stammdaten';

export type AnsatzGespeichert = Partial<Ansatz> & {
  art?: Ansatz['art'];
  ep_hand?: number | null;
  bereich?: string;
  bedarf?: boolean;
  alternativ?: boolean;
  pauschal?: boolean;
  ausgeblendet?: boolean;
  ki?: { sicherheit?: number; fehlende_angaben?: string; unser_gewerk?: boolean; zukauf?: string };
  archiv?: ArchivTreffer[];
  gleich_wie?: string;
};

export type ArchivTreffer = { projekt: string; datum: string | null; text: string; ep: number | null; einheit: string | null; menge?: number | null; kg_je_einheit?: number | null; aehnlichkeit: number; quelle?: string };

/** Ampel für Hinweise: kritisch = kostet Geld oder ist ein Risiko, beachten = sollte man wissen, info = Standard. */
export type HinweisStufe = 'kritisch' | 'beachten' | 'info';
export type HinweisThema = 'kosten' | 'termine' | 'technik' | 'baustelle' | 'nachweise' | 'vertrag';

export type PruefHinweis = {
  stufe: HinweisStufe;
  thema: HinweisThema;
  titel: string; // kurz, höchstens sieben Wörter
  text: string; // was gefordert ist, mit Zahlen
  folge: string; // was das für die Kalkulation heißt
  fundstelle: string; // z. B. "LV S. 8" oder "Vorbemerkung 2.3"
  oz: string[]; // betroffene Positionen, leer wenn allgemein
};

/** Fertig formulierte Frage an die Vergabestelle. Wird nur vorgeschlagen, nie selbst versendet. */
export type Bieterfrage = {
  frage: string;
  bezug: string; // OZ, Seite oder Plan
  begruendung: string; // warum fragen: was am Preis hängt
  stufe: 'kritisch' | 'beachten';
  quelle: 'vorbemerkungen' | 'plaene';
};

/** Abweichung zwischen LV-Text und Planbeschriftung, Merkmal für Merkmal. */
export type Widerspruch = {
  oz: string;
  merkmal: 'werkstoff' | 'oberflaeche' | 'profil' | 'abmessung' | 'befestigung' | 'anzahl' | 'sonstiges';
  lv: string; // was im LV steht
  plan: string; // was im Plan steht
  fundstelle: string;
  folge: string;
  stufe: 'kritisch' | 'beachten';
};

/** Prüfung der Vorbemerkungen: Hinweise mit Ampel und Bieterfragen, liegt in projekte.ergebnis.pruefung. */
export type Pruefung = {
  datum: string;
  zusammenfassung: string;
  hinweise: PruefHinweis[];
  bieterfragen: Bieterfrage[];
};

/** Plan gegen LV, liegt in projekte.ergebnis.abgleich. widersprueche und bieterfragen gibt es ab der gehärteten Prüfung. */
export type Abgleich = {
  datum: string;
  plaene: string[];
  zusammenfassung: string;
  fehlt_im_lv: { bauteil: string; fundstelle: string; menge_plan: number | null; einheit: string; hinweis: string }[];
  nicht_im_plan: { oz: string; hinweis: string }[];
  mengen: { oz: string; menge_lv: number; menge_plan: number; einheit: string; hinweis: string }[];
  widersprueche?: Widerspruch[];
  bieterfragen?: Bieterfrage[];
};

export type Position = {
  id: string;
  sort: number;
  oz: string | null;
  kurztext: string | null;
  langtext: string | null;
  menge: number | null;
  einheit: string | null;
  typ: string | null;
  ansatz: AnsatzGespeichert;
  ep: number | null;
  gp: number | null;
  sicherheit: number | null;
  status: 'offen' | 'berechnet' | 'pruefen' | 'freigegeben';
  begruendung: string | null;
  quelle: string | null;
};

export type Datei = { id: string; name: string; pfad: string; groesse: number | null; art: 'lv' | 'gaeb' | 'plan' | 'baubeschreibung' | 'zeichnung' | 'sonstiges'; seiten: number | null; created_at: string };

export function istGerechnet(p: Position) {
  return !!p.ansatz?.art;
}

export function zaehlt(p: Position) {
  return p.typ !== 'fremd' && !p.ansatz?.ausgeblendet && !p.ansatz?.bedarf && !p.ansatz?.alternativ;
}

/** Preis einer Position aus Ansatz und Stammdaten. BE wird in summen() nachgezogen. */
export function preis(p: Position, stamm: Stammdaten): PositionsRechnung {
  const a = p.ansatz;
  if (a?.ep_hand !== undefined && a.ep_hand !== null) return { ep: a.ep_hand, bausteine: [{ text: 'Preis von Hand', betrag: a.ep_hand }], hinweise: [] };
  if (!a?.art) return { ep: null, bausteine: [], hinweise: ['Noch nicht kalkuliert'] };
  return rechnePosition(a as Ansatz, Number(p.menge ?? 1), stamm);
}

export function mitPreisen(pos: Position[], stamm: Stammdaten): Position[] {
  const erst = pos.map((p) => {
    if (p.ansatz?.art === 'prozent_be' && (p.ansatz.ep_hand === undefined || p.ansatz.ep_hand === null)) return p;
    const r = preis(p, stamm);
    const ep = r.ep;
    return { ...p, ep, gp: ep !== null ? Math.round(ep * Number(p.menge ?? 1) * 100) / 100 : null };
  });
  const basis = erst.filter((p) => zaehlt(p) && p.ansatz?.art !== 'prozent_be').reduce((s, p) => s + Number(p.gp ?? 0), 0);
  return erst.map((p) => {
    if (p.ansatz?.art !== 'prozent_be' || (p.ansatz.ep_hand !== undefined && p.ansatz.ep_hand !== null)) return p;
    const prozent = Number((p.ansatz as { prozent?: number }).prozent ?? 5);
    const gp = Math.round(basis * prozent) / 100;
    const m = Number(p.menge ?? 1) || 1;
    return { ...p, ep: Math.round((gp / m) * 100) / 100, gp };
  });
}

export function summen(pos: Position[]) {
  const z = pos.filter(zaehlt);
  return {
    gesamt: z.reduce((s, p) => s + Number(p.gp ?? 0), 0),
    freigegeben: z.filter((p) => p.status === 'freigegeben').reduce((s, p) => s + Number(p.gp ?? 0), 0),
    anzahl: z.length,
    pruefen: z.filter((p) => p.status === 'pruefen').length,
    offen: z.filter((p) => p.status === 'offen').length,
    frei: z.filter((p) => p.status === 'freigegeben').length,
    fremd: pos.filter((p) => p.typ === 'fremd').length,
  };
}
