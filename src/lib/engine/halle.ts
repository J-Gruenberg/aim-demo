/**
 * Hallen-Vordruck "Kalkulation Hallenbau", deterministisch.
 * Zeilen und Reihenfolge exakt wie auf seinem Papierzettel.
 * Mengen werden aus der Geometrie abgeleitet und sind einzeln überschreibbar.
 */
import { sd, type Stammdaten } from './stammdaten';
import { stahlliste, type Stahlliste } from './stahlliste';

export type Dachform = 'satteldach' | 'pultdach';
export type Huelle = 'sandwich' | 'trapez' | 'ohne';

export type Tor = { anzahl: number; breite: number; hoehe: number; antrieb: boolean };

export type HallenEingaben = {
  objekt: string;
  laenge: number;
  breite: number;
  traufhoehe: number;
  dachform: Dachform;
  neigung: number;
  rahmenabstand: number;
  oberflaeche: 'grundiert' | 'verzinkt';
  dach: Exclude<Huelle, 'ohne'>;
  wand: Huelle;
  wandseiten: number; // 4 = rundum, 3 = eine Giebelseite offen/Bestand
  tore: Tor[];
  tueren: number;
  fenster: number;
  lichtkuppeln: number;
  lichtkuppeln_rwa: number;
  firstlicht_m: number;
  vordach_m2: number;
  kran: boolean;
  buero_m2: number;
  trennwand_m2: number;
  aussenanlagen_m2: number;
  zaun_m: number;
  optionen: {
    erdarbeiten: boolean;
    be: boolean;
    autokran: boolean;
    buehnen: boolean;
    profilfueller: boolean;
    statik: boolean;
    werkplanung: boolean;
    bauantrag: boolean;
    baugrund: boolean;
    maler: boolean;
    elektro: boolean;
    heizung: boolean;
    entsorgung: boolean;
    reinigung: boolean;
  };
  /** Manuelle Überschreibungen je Zeile: Menge, Einzelpreis, aktiv */
  manuell: Record<string, { menge?: number | null; ep?: number | null; aktiv?: boolean }>;
  /** Stahlgewicht manuell in kg (überschreibt Referenzschätzung) */
  stahl_kg_manuell?: number | null;
  /** Anzahl Giebel, die als Giebelrahmen (leichter) ausgeführt werden: 2, 1 oder 0 */
  giebelrahmen?: number;
  zuschlag_prozent?: number | null;
  notiz?: string;
  /** Zuletzt aus Anfrage oder Zeichnung übernommen */
  gelesen?: { datum: string; quellen: string[]; hinweise: string[]; fehlend: string[] };
};

export const LEERE_HALLE: HallenEingaben = {
  objekt: '',
  laenge: 30,
  breite: 15,
  traufhoehe: 5,
  dachform: 'satteldach',
  neigung: 5,
  rahmenabstand: 6,
  oberflaeche: 'grundiert',
  dach: 'sandwich',
  wand: 'sandwich',
  wandseiten: 4,
  tore: [{ anzahl: 1, breite: 4, hoehe: 4, antrieb: false }],
  tueren: 1,
  fenster: 0,
  lichtkuppeln: 0,
  lichtkuppeln_rwa: 0,
  firstlicht_m: 0,
  vordach_m2: 0,
  kran: false,
  buero_m2: 0,
  trennwand_m2: 0,
  aussenanlagen_m2: 0,
  zaun_m: 0,
  optionen: {
    erdarbeiten: true,
    be: true,
    autokran: true,
    buehnen: true,
    profilfueller: true,
    statik: true,
    werkplanung: true,
    bauantrag: false,
    baugrund: false,
    maler: false,
    elektro: false,
    heizung: false,
    entsorgung: true,
    reinigung: true,
  },
  manuell: {},
  stahl_kg_manuell: null,
  zuschlag_prozent: null,
};

export type ReferenzPunkt = {
  name: string;
  breite: number;
  traufhoehe: number;
  grundflaeche: number;
  stahl_kg: number;
  kran?: boolean;
  datum?: string | null;
};

export type Zeile = {
  key: string;
  bezeichnung: string;
  einheit: string;
  menge: number;
  ep: number;
  gp: number;
  aktiv: boolean;
  auto_menge: number;
  auto_ep: number;
  manuell_menge: boolean;
  manuell_ep: boolean;
  herleitung: string;
};

export type Geometrie = {
  grundflaeche: number;
  firsthoehe: number;
  umfang: number;
  rahmen: number;
  felder: number;
  dachflaeche: number;
  wandflaeche_brutto: number;
  oeffnungen_m2: number;
  wandflaeche: number;
  pfettenreihen: number;
  riegelreihen: number;
  rinnenlaenge: number;
  fallrohre: number;
  dachlaenge_schraeg: number;
};

export type StahlSchaetzung = {
  kg: number;
  kg_m2: number;
  methode: 'manuell' | 'stahlliste' | 'referenzen' | 'faustwert';
  referenzen: { name: string; kg_m2: number; gewicht: number; breite: number; traufhoehe: number }[];
  /** Stahlliste wie auf dem Kalkulationsblatt */
  liste?: Stahlliste;
  /** Gegenprobe über ähnliche gebaute Hallen */
  gegenprobe?: { kg: number; kg_m2: number } | null;
};

export type HallenErgebnis = {
  geometrie: Geometrie;
  stahl: StahlSchaetzung;
  zeilen: Zeile[];
  summe_netto: number;
  zuschlag_prozent: number;
  zuschlag: number;
  angebot_roh: number;
  angebot_gerundet: number;
  eur_m2: number;
  hinweise: string[];
};

/** Autokran auf den Kalkulationsblättern: Stahlgewicht und angesetzter Betrag. */
export const AUTOKRAN_REFERENZEN: { name: string; t: number; eur: number }[] = [
  { name: 'Halle 5,5 t', t: 5.5, eur: 4000 },
  { name: 'Halle 6 t', t: 6, eur: 4800 },
  { name: 'Halle 13 t', t: 13.2, eur: 6400 },
  { name: 'Halle 16,5 t', t: 16.5, eur: 7200 },
  { name: 'Halle 23 t', t: 23, eur: 8000 },
  { name: 'Halle 25 t', t: 25, eur: 6400 },
  { name: 'Halle 29 t', t: 29, eur: 8800 },
];

/** Die zwei Hallen mit dem ähnlichsten Stahlgewicht, als Gegenprobe für den Autokran. */
export function autokranVergleich(t: number) {
  return [...AUTOKRAN_REFERENZEN].sort((a, b) => Math.abs(Math.log(a.t / Math.max(t, 0.5))) - Math.abs(Math.log(b.t / Math.max(t, 0.5)))).slice(0, 2);
}

/** Dezimalpunkte in Texten in deutsche Kommas umwandeln (16.9 t → 16,9 t). */
const dezimal = (t: string) => t.replace(/(\d)\.(\d{1,2})(?!\d)/g, '$1,$2');
const rad = (g: number) => (g * Math.PI) / 180;
const r2 = (v: number) => Math.round(v * 100) / 100;
const r0 = (v: number) => Math.round(v);
const pos = (v: number) => (Number.isFinite(v) && v > 0 ? v : 0);

export function geometrie(e: HallenEingaben, stamm: Stammdaten): Geometrie {
  const L = pos(e.laenge);
  const B = pos(e.breite);
  const H = pos(e.traufhoehe);
  const a = rad(Math.min(Math.max(e.neigung || 0, 0), 45));
  const sattel = e.dachform === 'satteldach';
  const firsthoehe = sattel ? H + (B / 2) * Math.tan(a) : H + B * Math.tan(a);
  const dachlaenge_schraeg = B / Math.cos(a); // Summe beider Dachseiten bzw. Pultfläche
  const grundflaeche = L * B;
  const felder = Math.max(1, Math.ceil(L / Math.max(e.rahmenabstand || 6, 1)));
  const rahmen = felder + 1;
  const umfang = 2 * (L + B);
  const ueberstand = 2 * Math.max(sd(stamm, 'geo_dach_ueberstand'), 0);
  const dachflaeche = L * (dachlaenge_schraeg + ueberstand);

  // Wandflächen: Längsseiten + Giebel (Dreieck bzw. Trapez beim Pultdach)
  let laengs: number;
  let giebel: number;
  if (sattel) {
    laengs = 2 * L * H;
    giebel = 2 * (B * H + (B * B * Math.tan(a)) / 4);
  } else {
    laengs = L * H + L * firsthoehe;
    giebel = 2 * (B * H + (B * B * Math.tan(a)) / 2);
  }
  const anteil = Math.min(Math.max(e.wandseiten || 4, 0), 4) / 4;
  const wandflaeche_brutto = e.wand === 'ohne' ? 0 : (laengs + giebel) * anteil;
  const torflaeche = e.tore.reduce((s, t) => s + pos(t.anzahl) * pos(t.breite) * pos(t.hoehe), 0);
  const oeffnungen_m2 = torflaeche + pos(e.tueren) * 2.2 + pos(e.fenster) * 1.35;
  const wandflaeche = Math.max(0, wandflaeche_brutto - oeffnungen_m2);

  // Wie auf dem Kalkulationsblatt nachgerechnet: Reihen ≈ Dachbreite ÷ Pfettenabstand, Riegel ≈ Traufhöhe ÷ Riegelabstand
  const pfettenreihen = Math.max(2, Math.round(dachlaenge_schraeg / Math.max(sd(stamm, 'geo_pfettenabstand'), 0.5)));
  const riegelreihen = e.wand === 'ohne' ? 0 : r2(Math.max(2, H / Math.max(sd(stamm, 'geo_wandriegelabstand'), 0.5)));
  const rinnenlaenge = sattel ? 2 * L : L;
  const fallrohre = (sattel ? 2 : 1) * Math.max(1, Math.ceil(L / Math.max(sd(stamm, 'geo_fallrohr_abstand'), 1)));

  return {
    grundflaeche: r2(grundflaeche),
    firsthoehe: r2(firsthoehe),
    umfang: r2(umfang),
    rahmen,
    felder,
    dachflaeche: r2(dachflaeche),
    wandflaeche_brutto: r2(wandflaeche_brutto),
    oeffnungen_m2: r2(oeffnungen_m2),
    wandflaeche: r2(wandflaeche),
    pfettenreihen,
    riegelreihen,
    rinnenlaenge: r2(rinnenlaenge),
    fallrohre,
    dachlaenge_schraeg: r2(dachlaenge_schraeg),
  };
}

/** Stahlgewicht wie im Kalkulationsblatt: ähnliche gebaute Hallen (Spannweite, Höhe) als Maßstab. */
/** Stahlgewicht: 1. von Hand, 2. Stahlliste wie im Kalkulationsblatt (Profile × Meter + 10 %), Gegenprobe über ähnliche Hallen. */
export function stahlSchaetzen(e: HallenEingaben, geo: Geometrie, refs: ReferenzPunkt[], stamm: Stammdaten): StahlSchaetzung {
  const knn = stahlAusReferenzen(e, geo, refs, stamm);
  const gegenprobe = knn.methode === 'referenzen' ? { kg: knn.kg, kg_m2: knn.kg_m2 } : null;
  let liste: Stahlliste | undefined;
  if (pos(e.laenge) > 0 && pos(e.breite) > 0 && pos(e.traufhoehe) > 0) {
    liste = stahlliste({ laenge: e.laenge, breite: e.breite, traufhoehe: e.traufhoehe, dachform: e.dachform, neigung: e.neigung, rahmenabstand: e.rahmenabstand, giebelrahmen: e.giebelrahmen ?? 2 }, stamm);
    if (e.kran) {
      const kg = Math.round(sd(stamm, 'geo_kran_kg_m2') * geo.grundflaeche);
      liste.positionen.push({ text: 'Kranbahn und Konsolen (Faustwert)', profil: '', meter: 0, kg_m: 0, kg });
      liste.summe_kg += kg;
      liste.gesamt_kg = Math.ceil((liste.summe_kg * (1 + liste.kleinteile_prozent / 100)) / 100) * 100;
    }
  }
  if (e.stahl_kg_manuell && e.stahl_kg_manuell > 0) {
    return { kg: e.stahl_kg_manuell, kg_m2: geo.grundflaeche ? r2(e.stahl_kg_manuell / geo.grundflaeche) : 0, methode: 'manuell', referenzen: knn.referenzen, liste, gegenprobe };
  }
  if (liste) {
    return { kg: liste.gesamt_kg, kg_m2: geo.grundflaeche ? r2(liste.gesamt_kg / geo.grundflaeche) : 0, methode: 'stahlliste', referenzen: knn.referenzen, liste, gegenprobe };
  }
  return knn;
}

function stahlAusReferenzen(e: HallenEingaben, geo: Geometrie, refs: ReferenzPunkt[], stamm: Stammdaten): StahlSchaetzung {
  const nutzbar = refs.filter((r) => r.grundflaeche > 0 && r.stahl_kg > 0 && r.breite > 0);
  const krank = e.kran ? sd(stamm, 'geo_kran_kg_m2') : 0;
  if (nutzbar.length === 0) {
    const kg_m2 = sd(stamm, 'geo_kg_m2_fallback') + krank;
    return { kg: r0(kg_m2 * geo.grundflaeche), kg_m2, methode: 'faustwert', referenzen: [] };
  }
  const bewertet = nutzbar
    .map((r) => {
      const d = Math.hypot((r.breite - e.breite) / 4, (r.traufhoehe - e.traufhoehe) / 1.5, Math.log(r.grundflaeche / Math.max(geo.grundflaeche, 1)) / 0.8);
      const kg_m2 = r.stahl_kg / r.grundflaeche - (r.kran ? sd(stamm, 'geo_kran_kg_m2') : 0);
      return { r, d, kg_m2 };
    })
    .sort((x, y) => x.d - y.d)
    .slice(0, 4);
  const w = bewertet.map((b) => 1 / (b.d * b.d + 0.25));
  const sw = w.reduce((s, v) => s + v, 0);
  let kg_m2 = bewertet.reduce((s, b, i) => s + b.kg_m2 * w[i], 0) / sw;
  kg_m2 += krank;
  return {
    kg: r0(kg_m2 * geo.grundflaeche),
    kg_m2: r2(kg_m2),
    methode: 'referenzen',
    referenzen: bewertet.map((b, i) => ({
      name: b.r.name,
      kg_m2: r2(b.kg_m2),
      gewicht: r2(w[i] / sw),
      breite: b.r.breite,
      traufhoehe: b.r.traufhoehe,
    })),
  };
}

type ZeilenDef = { key: string; bezeichnung: string; einheit: string; menge: number; ep: number; aktiv: boolean; herleitung: string };

export function berechneHalle(e: HallenEingaben, stamm: Stammdaten, refs: ReferenzPunkt[] = []): HallenErgebnis {
  const geo = geometrie(e, stamm);
  const stahl = stahlSchaetzen(e, geo, refs, stamm);
  const o = e.optionen;
  const t = stahl.kg / 1000;
  const hinweise: string[] = [];
  const L = pos(e.laenge);
  const B = pos(e.breite);
  const H = pos(e.traufhoehe);

  const tore_stk = e.tore.reduce((s, x) => s + pos(x.anzahl), 0);
  const tor_mehr = e.tore.reduce((s, x) => s + pos(x.anzahl) * Math.max(0, pos(x.breite) * pos(x.hoehe) - 16), 0);
  const tor_antriebe = e.tore.reduce((s, x) => s + (x.antrieb ? pos(x.anzahl) : 0), 0);
  const tor_ep = tore_stk > 0 ? sd(stamm, 'halle_tor_stk') + (tor_mehr * sd(stamm, 'halle_tor_m2_zuschlag') + tor_antriebe * sd(stamm, 'halle_torantrieb_stk')) / tore_stk : sd(stamm, 'halle_tor_stk');
  const torbreiten = e.tore.reduce((s, x) => s + pos(x.anzahl) * pos(x.breite), 0) + pos(e.tueren) * 1.0;

  const sattel = e.dachform === 'satteldach';
  const klein = geo.grundflaeche > 0 && geo.grundflaeche <= sd(stamm, 'halle_klein_grenze_m2');
  const kf = klein ? 1 + sd(stamm, 'halle_klein_zuschlag_prozent') / 100 : 1;
  const kh = klein ? ` (Kleinhalle +${sd(stamm, 'halle_klein_zuschlag_prozent')} %)` : '';
  const ortgang = 2 * geo.dachlaenge_schraeg; // beide Giebel
  const kanten_faktor = Math.max(sd(stamm, 'geo_kantteile_faktor'), 1);
  const kanten_basis =
    geo.rinnenlaenge + // Traufe
    (sattel ? L : 0) + // First
    ortgang +
    (e.wand === 'ohne' ? 0 : 4 * H) + // Ecken
    (e.wand === 'ohne' ? 0 : geo.umfang) + // Sockel
    e.tore.reduce((s, x) => s + pos(x.anzahl) * (pos(x.breite) + 2 * pos(x.hoehe)), 0) +
    pos(e.tueren) * 5.2 +
    pos(e.fenster) * 4.8;
  const kanten = kanten_basis * kanten_faktor;

  const erd_m2 = sd(stamm, 'halle_erd_basis_m2') + sd(stamm, 'halle_erd_faktor') / Math.sqrt(Math.max(geo.grundflaeche, 1));

  const defs: ZeilenDef[] = [
    {
      key: 'stahlbau',
      bezeichnung: `Stahlbau ${e.oberflaeche}`,
      einheit: 't',
      menge: r2(t),
      ep: e.oberflaeche === 'verzinkt' ? sd(stamm, 'halle_stahl_verzinkt_kg') * 1000 : sd(stamm, 'halle_stahl_grundiert_kg') * 1000,
      aktiv: true,
      herleitung:
        stahl.methode === 'manuell'
          ? 'Gewicht von Hand eingetragen'
          : stahl.methode === 'stahlliste' && stahl.liste
            ? `Stahlliste: ${stahl.liste.hauptrahmen} Hauptrahmen ${stahl.liste.positionen[0]?.profil}/${stahl.liste.positionen[1]?.profil}, ${stahl.liste.giebelrahmen} Giebelrahmen, Verbände + ${stahl.liste.kleinteile_prozent} %`
          : stahl.methode === 'referenzen'
            ? `${stahl.kg_m2} kg/m² aus ähnlichen gebauten Hallen × ${geo.grundflaeche} m²`
            : `Faustwert ${stahl.kg_m2} kg/m² × ${geo.grundflaeche} m²`,
    },
    { key: 'traufriegel', bezeichnung: 'Traufriegel', einheit: 'm', menge: r2(2 * L), ep: r2(sd(stamm, 'halle_traufriegel_m') * kf), aktiv: true, herleitung: '2 × Hallenlänge' + kh },
    {
      key: 'pfetten',
      bezeichnung: 'Pfetten',
      einheit: 'm',
      menge: r2(geo.pfettenreihen * L),
      ep: r2(sd(stamm, 'halle_pfetten_m') * kf),
      aktiv: true,
      herleitung: `${geo.pfettenreihen} Reihen (Abstand ${sd(stamm, 'geo_pfettenabstand')} m) × ${L} m${kh}`,
    },
    {
      key: 'pfettenschuhe',
      bezeichnung: 'Pfettenschuhe',
      einheit: 'Stck',
      menge: geo.pfettenreihen * geo.rahmen,
      ep: r2(sd(stamm, 'halle_pfettenschuhe_stk') * kf),
      aktiv: true,
      herleitung: `${geo.pfettenreihen} Reihen × ${geo.rahmen} Rahmen${kh}`,
    },
    {
      key: 'wandriegel',
      bezeichnung: 'Wandriegel',
      einheit: 'm',
      menge: r2(e.wand === 'ohne' ? 0 : geo.riegelreihen * geo.umfang * (Math.min(e.wandseiten, 4) / 4)),
      ep: r2(sd(stamm, 'halle_wandriegel_m') * kf),
      aktiv: e.wand !== 'ohne',
      herleitung: `Umfang ${geo.umfang} m × Traufhöhe ${H} m ÷ ${sd(stamm, 'geo_wandriegelabstand')} m Riegelabstand${kh}`,
    },
    {
      key: 'fusswinkel',
      bezeichnung: 'Fußwinkel',
      einheit: 'm',
      menge: r2(e.wand === 'ohne' ? 0 : Math.max(0, geo.umfang * (Math.min(e.wandseiten, 4) / 4) - torbreiten)),
      ep: r2(sd(stamm, 'halle_fusswinkel_m') * kf),
      aktiv: e.wand !== 'ohne',
      herleitung: 'Umfang abzüglich Tor- und Türbreiten' + kh,
    },
    { key: 'kantteile', bezeichnung: 'Kantteile', einheit: 'm', menge: r2(kanten), ep: r2(sd(stamm, 'halle_kantteile_m') * kf), aktiv: true, herleitung: `Traufe, First, Ortgang, Ecken, Sockel, Öffnungen × ${kanten_faktor} für Anschlüsse${kh}` },
    {
      key: 'dachrinne',
      bezeichnung: 'Dachrinne und Fallrohr',
      einheit: 'm',
      menge: r2(geo.rinnenlaenge + geo.fallrohre * H),
      ep: sd(stamm, 'halle_dachrinne_m'),
      aktiv: true,
      herleitung: `${geo.rinnenlaenge} m Rinne + ${geo.fallrohre} Fallrohre × ${H} m`,
    },
    { key: 'vordach', bezeichnung: 'Vordach', einheit: 'm²', menge: r2(pos(e.vordach_m2)), ep: sd(stamm, 'halle_vordach_m2'), aktiv: pos(e.vordach_m2) > 0, herleitung: 'aus Eingabe' },
    {
      key: 'dach',
      bezeichnung: `Dacheindeckung ${e.dach === 'sandwich' ? 'Sandwich' : 'Trapezblech'}`,
      einheit: 'm²',
      menge: r2(geo.dachflaeche),
      ep: e.dach === 'sandwich' ? sd(stamm, 'halle_dach_sandwich_m2') : sd(stamm, 'halle_dach_trapez_m2'),
      aktiv: true,
      herleitung: `${L} m × (${geo.dachlaenge_schraeg} m in Dachneigung + ${r2(2 * sd(stamm, 'geo_dach_ueberstand'))} m Überstand)`,
    },
    {
      key: 'wand',
      bezeichnung: `Wandverkleidung ${e.wand === 'sandwich' ? 'Sandwich' : e.wand === 'trapez' ? 'Trapezblech' : ''}`.trim(),
      einheit: 'm²',
      menge: r2(geo.wandflaeche),
      ep: e.wand === 'trapez' ? sd(stamm, 'halle_wand_trapez_m2') : sd(stamm, 'halle_wand_sandwich_m2'),
      aktiv: e.wand !== 'ohne',
      herleitung: `${geo.wandflaeche_brutto} m² Wand abzüglich ${geo.oeffnungen_m2} m² Öffnungen`,
    },
    { key: 'tueren', bezeichnung: 'kl. Tür', einheit: 'Stck', menge: pos(e.tueren), ep: sd(stamm, 'halle_tuer_stk'), aktiv: pos(e.tueren) > 0, herleitung: 'aus Eingabe' },
    {
      key: 'tore',
      bezeichnung: 'Tor',
      einheit: 'Stck',
      menge: tore_stk,
      ep: r2(tor_ep),
      aktiv: tore_stk > 0,
      herleitung: tor_mehr > 0 || tor_antriebe > 0 ? 'Grundpreis plus Mehrgröße und Antriebe' : 'Grundpreis Sektionaltor',
    },
    {
      key: 'erdarbeiten',
      bezeichnung: 'Erdarbeiten, Fundamente, Sohle',
      einheit: 'm²',
      menge: r2(geo.grundflaeche),
      ep: r2(erd_m2),
      aktiv: o.erdarbeiten,
      herleitung: `Preis je m² sinkt mit der Größe: ${sd(stamm, 'halle_erd_basis_m2')} + ${sd(stamm, 'halle_erd_faktor')} / √${geo.grundflaeche}`,
    },
    { key: 'be', bezeichnung: 'Baustelleneinrichtung (Netz, Container)', einheit: 'psch', menge: 1, ep: sd(stamm, 'halle_be_pauschal'), aktiv: o.be, herleitung: 'Pauschale' },
    { key: 'autokran', bezeichnung: 'Autokran', einheit: 'psch', menge: 1, ep: r0(sd(stamm, 'halle_kran_basis') + sd(stamm, 'halle_kran_t') * t), aktiv: o.autokran, herleitung: `${sd(stamm, 'halle_kran_basis')} € + ${sd(stamm, 'halle_kran_t')} € × ${String(r2(t)).replace('.', ',')} t · ähnliche Hallen: ${autokranVergleich(t).map((k) => `${k.name} ${String(k.t).replace('.', ',')} t ${k.eur.toLocaleString('de-DE')} €`).join(', ')}` },
    { key: 'buehnen', bezeichnung: 'Bühnen', einheit: 'psch', menge: 1, ep: r0(sd(stamm, 'halle_buehnen_basis') + sd(stamm, 'halle_buehnen_m2') * geo.grundflaeche), aktiv: o.buehnen, herleitung: `${sd(stamm, 'halle_buehnen_basis')} € + ${sd(stamm, 'halle_buehnen_m2')} € × ${geo.grundflaeche} m²` },
    { key: 'profilfueller', bezeichnung: 'Profilfüller', einheit: 'm', menge: r2(geo.rinnenlaenge), ep: sd(stamm, 'halle_profilfueller_m'), aktiv: o.profilfueller, herleitung: 'Traufenlänge' },
    {
      key: 'statik',
      bezeichnung: 'Statik',
      einheit: 'psch',
      menge: 1,
      ep: sd(stamm, 'halle_statik_pauschal'),
      aktiv: o.statik,
      herleitung: 'Pauschale',
    },
    { key: 'werkplanung', bezeichnung: 'Werkplanung', einheit: 'psch', menge: 1, ep: sd(stamm, 'halle_werkplanung_pauschal'), aktiv: o.werkplanung, herleitung: 'Pauschale' },
    { key: 'bauantrag', bezeichnung: 'Bauantrag, Brand- und Wärmeschutz', einheit: 'psch', menge: 1, ep: sd(stamm, 'halle_bauantrag_pauschal'), aktiv: o.bauantrag, herleitung: 'Pauschale' },
    { key: 'baugrund', bezeichnung: 'Baugrundgutachten', einheit: 'psch', menge: 1, ep: sd(stamm, 'halle_baugrund_pauschal'), aktiv: o.baugrund, herleitung: 'Pauschale' },
    { key: 'maler', bezeichnung: 'Malerarbeiten, Stahlbau', einheit: 'psch', menge: 1, ep: r0(sd(stamm, 'halle_maler_basis') + sd(stamm, 'halle_maler_t') * t), aktiv: o.maler, herleitung: `${sd(stamm, 'halle_maler_basis')} € + ${sd(stamm, 'halle_maler_t')} € × ${String(r2(t)).replace('.', ',')} t` },
    { key: 'elektro', bezeichnung: 'Elektroarbeiten Halle', einheit: 'psch', menge: 1, ep: r0(sd(stamm, 'halle_elektro_basis') + sd(stamm, 'halle_elektro_m2') * geo.grundflaeche), aktiv: o.elektro, herleitung: `${sd(stamm, 'halle_elektro_basis')} € + ${sd(stamm, 'halle_elektro_m2')} € × ${geo.grundflaeche} m²` },
    { key: 'heizung', bezeichnung: 'Heizungsbauarbeiten Halle', einheit: 'psch', menge: 1, ep: r0(sd(stamm, 'halle_heizung_basis') + sd(stamm, 'halle_heizung_m2') * geo.grundflaeche), aktiv: o.heizung, herleitung: `${sd(stamm, 'halle_heizung_basis')} € + ${sd(stamm, 'halle_heizung_m2')} € × ${geo.grundflaeche} m²` },
    { key: 'fenster', bezeichnung: 'Fenster', einheit: 'Stck', menge: pos(e.fenster), ep: sd(stamm, 'halle_fenster_stk'), aktiv: pos(e.fenster) > 0, herleitung: 'aus Eingabe' },
    {
      key: 'oberlichtkuppeln',
      bezeichnung: 'Oberlichtkuppeln',
      einheit: 'Stck',
      menge: pos(e.lichtkuppeln) + pos(e.lichtkuppeln_rwa),
      ep:
        pos(e.lichtkuppeln) + pos(e.lichtkuppeln_rwa) > 0
          ? r2(
              (pos(e.lichtkuppeln) * sd(stamm, 'halle_lichtkuppel_stk') + pos(e.lichtkuppeln_rwa) * sd(stamm, 'halle_lichtkuppel_rwa_stk')) /
                (pos(e.lichtkuppeln) + pos(e.lichtkuppeln_rwa)),
            )
          : sd(stamm, 'halle_lichtkuppel_stk'),
      aktiv: pos(e.lichtkuppeln) + pos(e.lichtkuppeln_rwa) > 0,
      herleitung: 'aus Eingabe, RWA-Kuppeln mit eigenem Preis',
    },
    { key: 'firstlicht', bezeichnung: 'Firstlichtstraße', einheit: 'm', menge: r2(pos(e.firstlicht_m)), ep: sd(stamm, 'halle_firstlicht_m'), aktiv: pos(e.firstlicht_m) > 0, herleitung: 'aus Eingabe' },
    { key: 'trennwand', bezeichnung: 'Hallentrennwand', einheit: 'm²', menge: r2(pos(e.trennwand_m2)), ep: sd(stamm, 'halle_trennwand_m2'), aktiv: pos(e.trennwand_m2) > 0, herleitung: 'aus Eingabe' },
    { key: 'buero', bezeichnung: 'Büroausbau gem. Extrablatt', einheit: 'm²', menge: r2(pos(e.buero_m2)), ep: sd(stamm, 'halle_buero_m2'), aktiv: pos(e.buero_m2) > 0, herleitung: 'aus Eingabe' },
    { key: 'aussenanlagen', bezeichnung: 'Außenanlagen', einheit: 'm²', menge: r2(pos(e.aussenanlagen_m2)), ep: sd(stamm, 'halle_aussenanlagen_m2'), aktiv: pos(e.aussenanlagen_m2) > 0, herleitung: 'aus Eingabe' },
    { key: 'zaun', bezeichnung: 'Zaunbauarbeiten', einheit: 'm', menge: r2(pos(e.zaun_m)), ep: sd(stamm, 'halle_zaun_m'), aktiv: pos(e.zaun_m) > 0, herleitung: 'aus Eingabe' },
    { key: 'entsorgung', bezeichnung: 'Entsorgung', einheit: 'psch', menge: 1, ep: sd(stamm, 'halle_entsorgung_pauschal'), aktiv: o.entsorgung, herleitung: 'Pauschale' },
    {
      key: 'ausschnitte',
      bezeichnung: 'Fenster- und Türausschnitte',
      einheit: 'Stck',
      menge: pos(e.fenster) + pos(e.tueren) + tore_stk,
      ep: sd(stamm, 'halle_ausschnitt_stk'),
      aktiv: pos(e.fenster) + pos(e.tueren) + tore_stk > 0,
      herleitung: 'Fenster, Türen und Tore',
    },
    { key: 'reinigung', bezeichnung: 'Reinigung', einheit: 'psch', menge: 1, ep: sd(stamm, 'halle_reinigung_pauschal'), aktiv: o.reinigung, herleitung: 'Pauschale' },
  ];

  const zeilen: Zeile[] = defs.map((d) => {
    const m = e.manuell[d.key] ?? {};
    const menge = m.menge !== undefined && m.menge !== null ? m.menge : d.menge;
    const ep = m.ep !== undefined && m.ep !== null ? m.ep : d.ep;
    const aktiv = m.aktiv !== undefined ? m.aktiv : d.aktiv;
    return {
      key: d.key,
      bezeichnung: d.bezeichnung,
      einheit: d.einheit,
      menge,
      ep,
      gp: aktiv ? r2(menge * ep) : 0,
      aktiv,
      auto_menge: d.menge,
      auto_ep: d.ep,
      manuell_menge: m.menge !== undefined && m.menge !== null,
      manuell_ep: m.ep !== undefined && m.ep !== null,
      herleitung: dezimal(d.herleitung),
    };
  });

  const summe_netto = r2(zeilen.reduce((s, z) => s + z.gp, 0));
  const zuschlag_prozent = e.zuschlag_prozent ?? sd(stamm, 'halle_zuschlag_prozent');
  const zuschlag = r2((summe_netto * zuschlag_prozent) / 100);
  const angebot_roh = summe_netto + zuschlag;
  const rundung = Math.max(sd(stamm, 'halle_rundung'), 1);
  const angebot_gerundet = Math.round(angebot_roh / rundung) * rundung;

  if (B > sd(stamm, 'geo_spannweite_hinweis')) hinweise.push(`Spannweite ${B} m: Fachwerkbinder oder Mittelstütze prüfen, Stahlgewicht steigt deutlich.`);
  if (stahl.methode === 'stahlliste' && stahl.gegenprobe && stahl.kg > 0 && Math.abs(stahl.gegenprobe.kg / stahl.kg - 1) > 0.25)
    hinweise.push(`Gegenprobe: ähnliche gebaute Hallen liegen bei ${stahl.gegenprobe.kg_m2} kg/m² (${Math.round(stahl.gegenprobe.kg / 100) / 10} t). Stahlgewicht prüfen.`);
  if (stahl.liste) hinweise.push(...stahl.liste.hinweise);
  if (stahl.methode === 'faustwert') hinweise.push('Keine passende Referenzhalle gefunden: Stahlgewicht ist ein Faustwert. Nach Statik gegenprüfen.');
  if (e.wandseiten < 4 && e.wand !== 'ohne') hinweise.push(`Nur ${e.wandseiten} Wandseiten verkleidet.`);
  if (e.kran) {
    const mitKran = refs.filter((r) => r.kran && r.grundflaeche > 0 && r.stahl_kg > 0);
    hinweise.push(
      `Hallenkran: Kranbahn mit ${sd(stamm, 'geo_kran_kg_m2')} kg/m² Mehrgewicht eingerechnet. Kran, Kranbahnträger und Abnahme beim Lieferanten anfragen.` +
        (mitKran.length ? ` Vergleich: ${mitKran.map((r) => `${r.name} ${String(Math.round((r.stahl_kg / r.grundflaeche) * 10) / 10).replace('.', ',')} kg/m² mit Kranbahn`).join(', ')}.` : ''),
    );
  }
  if (geo.grundflaeche > 0 && stahl.kg_m2 > 45) hinweise.push(`${stahl.kg_m2} kg/m² ist sehr schwer für eine Halle. Eingaben prüfen.`);

  return {
    geometrie: geo,
    stahl,
    zeilen,
    summe_netto,
    zuschlag_prozent,
    zuschlag,
    angebot_roh: r2(angebot_roh),
    angebot_gerundet,
    eur_m2: geo.grundflaeche ? r2(angebot_gerundet / geo.grundflaeche) : 0,
    hinweise: hinweise.map(dezimal),
  };
}
