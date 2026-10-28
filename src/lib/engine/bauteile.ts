/**
 * Kalkulationsansätze für LV-Positionen, Einzelbauteile und Baugruppen nach Zeichnung.
 * Werte kommen ausschließlich aus den Stammdaten des Betriebs.
 */
import { sd, type Stammdaten } from './stammdaten';
import { baugruppeRechnen, type BaugruppeAnsatz } from './zeichnung';
import { metergewicht, rundKgM } from './profile';

export type Oberflaeche = 'roh' | 'grundiert' | 'verzinkt' | 'verzinkt_pulver';

export type Baustein = { text: string; betrag: number };
export type AnsatzErgebnis = { ep: number; einheit: string; bausteine: Baustein[]; hinweise: string[]; kg_je_einheit?: number; h_je_einheit?: number; lohn?: number };

/**
 * Zuschläge wie in seiner Preisermittlung (Formblatt 221): Auf Stoffkosten (Material, Oberfläche, Kaufteile, Geräte)
 * kommt der Materialzuschlag. Im Verrechnungssatz je Stunde sind Gemeinkosten, Wagnis und Gewinn schon enthalten,
 * deshalb auf Lohn standardmäßig kein weiterer Zuschlag.
 */
function zuschlaege(stoff: number, lohn: number, stamm: Stammdaten) {
  const pm = sd(stamm, 'zuschlag_wg_prozent');
  const pl = sd(stamm, 'zuschlag_lohn_prozent');
  const zm = (stoff * pm) / 100;
  const zl = (lohn * pl) / 100;
  const bausteine: Baustein[] = [];
  if (zm) bausteine.push({ text: `Zuschlag auf Material ${pm} %`, betrag: r2(zm) });
  if (zl) bausteine.push({ text: `Zuschlag auf Lohn ${pl} %`, betrag: r2(zl) });
  return { summe: zm + zl, bausteine };
}

const r2 = (v: number) => Math.round(v * 100) / 100;
/** Zahl für Texte im Rechenweg: deutsches Komma, Tausenderpunkt */
const de = (v: number, stellen = 2) => v.toLocaleString('de-DE', { maximumFractionDigits: stellen });
const pos = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);

export function fertigungStunden100kg(kgPosition: number, stamm: Stammdaten): number {
  if (kgPosition <= 300) return sd(stamm, 'kg_fertigung_h_0_300');
  if (kgPosition <= 1000) return sd(stamm, 'kg_fertigung_h_300_1000');
  if (kgPosition <= 3000) return sd(stamm, 'kg_fertigung_h_1000_3000');
  if (kgPosition <= 10000) return sd(stamm, 'kg_fertigung_h_3000_10000');
  return sd(stamm, 'kg_fertigung_h_ueber_10000');
}

export function materialEurKg(stamm: Stammdaten, opt: { rohr?: boolean; s355?: boolean }) {
  let m = sd(stamm, 'stahl_einkauf_kg');
  if (opt.rohr) m *= 1 + sd(stamm, 'rohr_aufschlag_prozent') / 100;
  if (opt.s355) m *= 1 + sd(stamm, 's355_aufschlag_prozent') / 100;
  return m;
}

export function oberflaecheEurKg(o: Oberflaeche, stamm: Stammdaten) {
  if (o === 'verzinkt') return sd(stamm, 'verzinkung_eur_kg');
  if (o === 'grundiert') return sd(stamm, 'grundierung_eur_kg');
  if (o === 'verzinkt_pulver') return sd(stamm, 'verzinkung_eur_kg') + sd(stamm, 'pulver_eur_m2') / 35; // rund 35 kg Stahl je m² Oberfläche
  return 0;
}

export type StahlKgParameter = {
  kg_gesamt: number; // Gewicht der ganzen Position
  oberflaeche: Oberflaeche;
  montage: boolean;
  rohr?: boolean;
  s355?: boolean;
  blech?: boolean; // Bleche, Riffelblech, Beläge: weniger Fertigungsaufwand je kg
  bestand?: boolean; // Montage am Bestand: anschweißen, anschrauben, verstärken an vorhandenen Bauteilen
  kran_je_t?: boolean;
  zuschlag?: boolean;
};

/**
 * Preis je kg (Nettogewicht laut Profilliste) für Stahlkonstruktion nach Gewicht.
 * Wie auf seinen Blättern: Gewicht + Kleinteile-Zuschlag ergibt das Bruttogewicht, darauf Material, Oberfläche und Stunden.
 * Stunden gestaffelt nach Gewicht der ganzen Position.
 */
export function stahlJeKg(p: StahlKgParameter, stamm: Stammdaten): AnsatzErgebnis {
  const kgNetto = Math.max(pos(p.kg_gesamt), 1);
  const brutto = 1 + sd(stamm, 'kleinteile_prozent') / 100;
  const material = materialEurKg(stamm, p) * brutto * (1 + sd(stamm, 'befestigung_prozent') / 100);
  const hf = fertigungStunden100kg(kgNetto * brutto, stamm) * (p.blech ? sd(stamm, 'kg_blech_faktor') : 1);
  const fertigung = (hf / 100) * brutto * sd(stamm, 'satz_werkstatt');
  const hm = p.montage ? hf * sd(stamm, p.bestand ? 'kg_montage_faktor_bestand' : 'kg_montage_faktor') : 0;
  const montage = (hm / 100) * brutto * sd(stamm, 'satz_montage');
  const oberfl = oberflaecheEurKg(p.oberflaeche, stamm) * brutto;
  const kran = p.kran_je_t ? sd(stamm, 'kg_kran_t') / 1000 : 0;
  const z = p.zuschlag === false ? { summe: 0, bausteine: [] } : zuschlaege(material + oberfl + kran, fertigung + montage, stamm);
  const bausteine: Baustein[] = [
    { text: `Material inkl. ${sd(stamm, 'kleinteile_prozent')} % Kleinteile und ${sd(stamm, 'befestigung_prozent')} % Befestigung`, betrag: r2(material * 1000) / 1000 },
    { text: `Fertigung ${de(hf)} h je 100 kg (Staffel für ${de(kgNetto * brutto, 0)} kg)`, betrag: r2(fertigung * 1000) / 1000 },
  ];
  if (p.montage) bausteine.push({ text: `Montage${p.bestand ? ' am Bestand' : ''} ${de(hm)} h je 100 kg`, betrag: r2(montage * 1000) / 1000 });
  if (oberfl) bausteine.push({ text: `Oberfläche ${p.oberflaeche}`, betrag: r2(oberfl * 1000) / 1000 });
  if (kran) bausteine.push({ text: 'Kran je t (keine BE-Position)', betrag: r2(kran * 1000) / 1000 });
  for (const zb of z.bausteine) bausteine.push({ text: zb.text, betrag: r2(zb.betrag * 1000) / 1000 });
  const ep = material + fertigung + montage + oberfl + kran + z.summe;
  return {
    ep: Math.round(ep * 1000) / 1000,
    einheit: 'kg',
    bausteine,
    hinweise: [],
    kg_je_einheit: 1,
    h_je_einheit: ((hf + hm) / 100) * brutto,
    lohn: fertigung + montage,
  };
}

export type GelaenderParameter = {
  hoehe_m: number;
  pfosten: string; // z. B. "Fl 70x10"
  pfostenabstand_m: number;
  gurte: string; // Ober-/Untergurt, z. B. "Fl 40x10"
  anzahl_gurte: number;
  fuellung: 'staebe' | 'knieleiste' | 'lochblech' | 'gitter' | 'ohne';
  stab_d_mm: number;
  stababstand_mm: number;
  knieleisten: number;
  handlauf: 'stahl' | 'edelstahl';
  handlauf_profil: string; // z. B. "Rohr 42,4x2,6"
  fussplatten: boolean;
  oberflaeche: Oberflaeche;
  cluster: 0 | 1 | 2 | 3; // 0 = automatisch
  zuschlag?: boolean;
};

export const GELAENDER_STANDARD: GelaenderParameter = {
  hoehe_m: 1.1,
  pfosten: 'Fl 70x10',
  pfostenabstand_m: 1.2,
  gurte: 'Fl 40x10',
  anzahl_gurte: 2,
  fuellung: 'staebe',
  stab_d_mm: 12,
  stababstand_mm: 120,
  knieleisten: 2,
  handlauf: 'stahl',
  handlauf_profil: 'Rohr 42,4x2,6',
  fussplatten: true,
  oberflaeche: 'verzinkt',
  cluster: 0,
};

export function gelaenderKgM(p: GelaenderParameter) {
  const pf = metergewicht(p.pfosten) ?? 5.5;
  const gu = metergewicht(p.gurte) ?? 3.14;
  const hl = metergewicht(p.handlauf_profil) ?? 2.55;
  const pfosten = (pf * (p.hoehe_m + 0.1)) / Math.max(p.pfostenabstand_m, 0.3);
  const gurte = gu * pos(p.anzahl_gurte);
  const handlauf = p.handlauf === 'edelstahl' ? 0 : hl;
  let fuellung = 0;
  let schweiss = 0;
  if (p.fuellung === 'staebe') {
    const n = 1000 / Math.max(p.stababstand_mm, 60);
    fuellung = n * (p.hoehe_m - 0.2) * rundKgM(p.stab_d_mm);
    schweiss += n * 2 * Math.PI * (p.stab_d_mm / 1000);
  } else if (p.fuellung === 'knieleiste') {
    fuellung = pos(p.knieleisten) * gu;
    schweiss += pos(p.knieleisten) * 0.08;
  } else if (p.fuellung === 'lochblech') {
    fuellung = (p.hoehe_m - 0.25) * 3 * 7.85 * 0.6; // 3 mm, 40 % Lochanteil
    schweiss += 2 * (p.hoehe_m - 0.25) + 2;
  } else if (p.fuellung === 'gitter') {
    fuellung = (p.hoehe_m - 0.25) * 9;
    schweiss += 2.2;
  }
  const fuss = p.fussplatten ? 2.4 / Math.max(p.pfostenabstand_m, 0.3) : 0;
  schweiss += (1 / Math.max(p.pfostenabstand_m, 0.3)) * (pos(p.anzahl_gurte) * 0.2 + (p.fussplatten ? 0.4 : 0));
  const kg = pfosten + gurte + handlauf + fuellung + fuss;
  return { kg: Math.round(kg * 10) / 10, schweiss_m: Math.round(schweiss * 100) / 100 };
}

export function gelaenderJeM(p: GelaenderParameter, stamm: Stammdaten): AnsatzErgebnis {
  const { kg, schweiss_m } = gelaenderKgM(p);
  let cluster = p.cluster;
  if (!cluster) cluster = schweiss_m > sd(stamm, 'gel_cluster3_schweiss_m') ? 3 : schweiss_m > sd(stamm, 'gel_cluster2_schweiss_m') ? 2 : 1;
  const h = sd(stamm, `gel_h_m_cluster${cluster}`) + (p.handlauf === 'edelstahl' ? sd(stamm, 'gel_edelstahl_h_m') : 0);
  const satz = (sd(stamm, 'satz_werkstatt') + sd(stamm, 'satz_montage')) / 2;
  const material = kg * materialEurKg(stamm, { rohr: true }) * (1 + sd(stamm, 'befestigung_prozent') / 100);
  const edelstahl = p.handlauf === 'edelstahl' ? sd(stamm, 'gel_edelstahl_handlauf_m') : 0;
  const arbeit = h * satz;
  const oberfl = kg * oberflaecheEurKg(p.oberflaeche, stamm);
  const netto = material + edelstahl + arbeit + oberfl;
  const z = p.zuschlag === false ? { summe: 0, bausteine: [] as Baustein[] } : zuschlaege(material + edelstahl + oberfl, arbeit, stamm);
  const zuschlag = z.summe;
  const bausteine: Baustein[] = [
    { text: `Material ${de(kg, 1)} kg/m Stahl`, betrag: r2(material) },
    ...(edelstahl ? [{ text: 'Edelstahl-Handlauf', betrag: r2(edelstahl) }] : []),
    { text: `Herstellung und Montage ${de(h)} h/m (Aufwand ${cluster}${p.cluster ? '' : ', automatisch'})`, betrag: r2(arbeit) },
    ...(oberfl ? [{ text: `Oberfläche ${p.oberflaeche}`, betrag: r2(oberfl) }] : []),
    ...z.bausteine,
  ];
  return {
    ep: r2(netto + zuschlag),
    lohn: arbeit,
    einheit: 'm',
    bausteine,
    hinweise: [`Schweißnaht rund ${de(schweiss_m, 1)} m je Meter Geländer`],
    kg_je_einheit: kg,
    h_je_einheit: h,
  };
}

export type TreppenParameter = {
  geschosshoehe_m: number;
  laufbreite_m: number;
  steigung_m: number;
  auftritt_m: number;
  wange: string; // z. B. "UPN 200" oder "Fl 250x15"
  podest_m2: number;
  podest_kg_m2: number;
  stufenart: 'gitterrost' | 'blech' | 'bauseits';
  gelaender_seiten: 0 | 1 | 2;
  gelaender: GelaenderParameter;
  oberflaeche: Oberflaeche;
  montage: boolean;
};

export const TREPPE_STANDARD: TreppenParameter = {
  geschosshoehe_m: 3.0,
  laufbreite_m: 1.0,
  steigung_m: 0.18,
  auftritt_m: 0.27,
  wange: 'UPN 240',
  podest_m2: 0,
  podest_kg_m2: 45,
  stufenart: 'gitterrost',
  gelaender_seiten: 2,
  gelaender: { ...GELAENDER_STANDARD },
  oberflaeche: 'verzinkt',
  montage: true,
};

export function treppeJeStk(p: TreppenParameter, stamm: Stammdaten): AnsatzErgebnis & { details: Record<string, number> } {
  const steigungen = Math.max(2, Math.round(p.geschosshoehe_m / Math.max(p.steigung_m, 0.12)));
  const stufen = steigungen - 1;
  const lauflaenge = stufen * p.auftritt_m;
  const wangenlaenge = Math.hypot(p.geschosshoehe_m, lauflaenge) + 0.3;
  const wangeKgM = metergewicht(p.wange) ?? 25.3;
  const kgWangen = 2 * wangenlaenge * wangeKgM;
  const kgPodest = pos(p.podest_m2) * pos(p.podest_kg_m2);
  const kgStufenBlech = p.stufenart === 'blech' ? stufen * p.laufbreite_m * 0.3 * 0.005 * 7850 : 0;
  const kgNetto = kgWangen + kgPodest + kgStufenBlech;
  const kgStahl = kgNetto * (1 + sd(stamm, 'kleinteile_prozent') / 100);
  const stahl = stahlJeKg({ kg_gesamt: kgNetto, oberflaeche: p.oberflaeche, montage: p.montage, zuschlag: false }, stamm);
  const stahlBetrag = stahl.ep * kgNetto;
  const stahlLohn = (stahl.lohn ?? 0) * kgNetto;
  const stufePreis = p.laufbreite_m > 1.0 ? sd(stamm, 'tr_gitterrost_stufe_breit_stk') : sd(stamm, 'tr_gitterrost_stufe_stk');
  const stufenKauf = p.stufenart === 'gitterrost' ? stufen * stufePreis : 0;
  const podestRost = p.stufenart === 'gitterrost' ? pos(p.podest_m2) * sd(stamm, 'tr_gitterrost_m2') : 0;
  const stufenArbeit = (p.stufenart === 'bauseits' ? 0 : stufen) * sd(stamm, 'tr_h_je_stufe') * sd(stamm, 'satz_montage');
  const grundH = sd(stamm, 'tr_grund_h') + sd(stamm, 'tr_grund_h_je_m') * pos(p.geschosshoehe_m);
  const grund = p.montage ? grundH * sd(stamm, 'satz_montage') : 0;
  const gelLaenge = p.gelaender_seiten * (wangenlaenge + Math.sqrt(pos(p.podest_m2)));
  const gel = gelaenderJeM({ ...p.gelaender, zuschlag: false }, stamm);
  const gelBetrag = gelLaenge * gel.ep;
  const netto = stahlBetrag + stufenKauf + podestRost + stufenArbeit + gelBetrag + grund;
  const lohn = stahlLohn + stufenArbeit + gelLaenge * (gel.lohn ?? 0) + grund;
  const z = zuschlaege(netto - lohn, lohn, stamm);
  const zuschlag = z.summe;
  const bausteine: Baustein[] = [
    { text: `Wangen 2 × ${de(wangenlaenge)} m ${p.wange}${kgPodest ? ' und Podest' : ''}: ${de(kgStahl, 0)} kg Stahl`, betrag: r2(stahlBetrag) },
    ...(stufenKauf ? [{ text: `${stufen} Gitterroststufen (Kaufteil)`, betrag: r2(stufenKauf) }] : []),
    ...(podestRost ? [{ text: `Gitterrost Podest ${p.podest_m2} m²`, betrag: r2(podestRost) }] : []),
    ...(stufenArbeit ? [{ text: `Stufen montieren ${stufen} × ${de(sd(stamm, 'tr_h_je_stufe'))} h`, betrag: r2(stufenArbeit) }] : []),
    ...(gelBetrag ? [{ text: `Geländer ${de(gelLaenge)} m (${p.gelaender_seiten}-seitig)`, betrag: r2(gelBetrag) }] : []),
    ...(grund ? [{ text: `Grundaufwand ${de(grundH)} h (Anschlüsse, Ausrichten, Höhe)`, betrag: r2(grund) }] : []),
    ...z.bausteine,
  ];
  return {
    ep: r2(netto + zuschlag),
    lohn,
    einheit: 'Stck',
    bausteine,
    hinweise: [`${steigungen} Steigungen à ${de((p.geschosshoehe_m / steigungen) * 100)} cm, ${stufen} Stufen, Lauflänge ${de(lauflaenge)} m`],
    kg_je_einheit: Math.round(kgStahl),
    details: { steigungen, stufen, lauflaenge: r2(lauflaenge), wangenlaenge: r2(wangenlaenge), kg_stahl: Math.round(kgStahl), gelaender_m: r2(gelLaenge) },
  };
}

/** Ansatz einer LV-Position (von der KI vorgeschlagen, vom Nutzer änderbar). */
export type Ansatz =
  | { art: 'stahl_kg'; kg_je_einheit: number; oberflaeche: Oberflaeche; montage: boolean; rohr?: boolean; s355?: boolean; blech?: boolean; bestand?: boolean; bestand_h?: number; geraet_eur?: number }
  | { art: 'gelaender_m'; parameter: Partial<GelaenderParameter> }
  | { art: 'treppe_stk'; parameter: Partial<Omit<TreppenParameter, 'gelaender'>> & { gelaender?: Partial<GelaenderParameter> } }
  | { art: 'gitterrost_m2'; eur_m2?: number; montage: boolean }
  | { art: 'zukauf'; einkauf: number | null; aufschlag_prozent: number; lieferant?: string }
  | { art: 'stunden'; stunden_je_einheit: number; montage: boolean; material_je_einheit?: number }
  | { art: 'prozent_be' ; prozent: number }
  | BaugruppeAnsatz
  | { art: 'manuell'; ep: number | null };

export type PositionsRechnung = { ep: number | null; bausteine: Baustein[]; hinweise: string[]; kg_gesamt?: number; offen?: string };

const ERFAHRUNG: Partial<Record<Ansatz['art'], string>> = {
  baugruppe: 'faktor_baugruppe',
  stahl_kg: 'faktor_stahl_kg',
  gelaender_m: 'faktor_gelaender_m',
  treppe_stk: 'faktor_treppe_stk',
  gitterrost_m2: 'faktor_gitterrost_m2',
  stunden: 'faktor_stunden',
};

/** Preis einer Position. Ein Erfahrungsfaktor je Ansatzart (Lernschleife, Standard 1,0) wird zuletzt angewendet. */
export function rechnePosition(ansatz: Ansatz, menge: number, stamm: Stammdaten): PositionsRechnung {
  const r = rechneRoh(ansatz, menge, stamm);
  const key = ERFAHRUNG[ansatz.art];
  const f = key ? stamm[key] : undefined;
  if (r.ep === null || f === undefined || f === null || !Number.isFinite(f) || f <= 0 || Math.abs(f - 1) < 0.0005) return r;
  const delta = r2(r.ep * (f - 1));
  return { ...r, ep: r2(r.ep + delta), bausteine: [...r.bausteine, { text: `Erfahrungsfaktor ${String(f).replace('.', ',')} (aus Ihren Korrekturen)`, betrag: delta }] };
}

function rechneRoh(ansatz: Ansatz, menge: number, stamm: Stammdaten): PositionsRechnung {
  const m = pos(menge) || 1;
  switch (ansatz.art) {
    case 'stahl_kg': {
      const kgGesamt = pos(ansatz.kg_je_einheit) * m;
      const r = stahlJeKg({ kg_gesamt: kgGesamt, oberflaeche: ansatz.oberflaeche, montage: ansatz.montage, rohr: ansatz.rohr, s355: ansatz.s355, blech: ansatz.blech, bestand: ansatz.bestand }, stamm);
      // Arbeiten am Bestand (Trennen, Schleifen, Anpassen, Schweißen vor Ort) und Hebebühne hängen nicht am Gewicht
      const bh = pos(ansatz.bestand_h ?? 0);
      const bestand = r2(bh * sd(stamm, 'satz_montage'));
      const geraet = r2(pos(ansatz.geraet_eur ?? 0));
      const bausteine = r.bausteine.map((b) => ({ text: b.text, betrag: r2(b.betrag * pos(ansatz.kg_je_einheit)) }));
      if (bestand > 0) bausteine.push({ text: `Arbeiten am Bestand ${de(bh)} h × ${sd(stamm, 'satz_montage')} €/h`, betrag: bestand });
      if (geraet > 0) bausteine.push({ text: 'Hebebühne / Gerät', betrag: geraet });
      return {
        ep: r2(r.ep * pos(ansatz.kg_je_einheit) + bestand + geraet),
        bausteine,
        hinweise: [`${de(ansatz.kg_je_einheit)} kg je Einheit × ${r.ep.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €/kg${bestand + geraet > 0 ? ' plus Bestand und Gerät' : ''}`],
        kg_gesamt: kgGesamt,
      };
    }
    case 'gelaender_m': {
      const r = gelaenderJeM({ ...GELAENDER_STANDARD, ...ansatz.parameter }, stamm);
      return { ep: r.ep, bausteine: r.bausteine, hinweise: r.hinweise, kg_gesamt: (r.kg_je_einheit ?? 0) * m };
    }
    case 'treppe_stk': {
      const p = { ...TREPPE_STANDARD, ...ansatz.parameter, gelaender: { ...GELAENDER_STANDARD, ...(ansatz.parameter.gelaender ?? {}) } };
      const r = treppeJeStk(p, stamm);
      return { ep: r.ep, bausteine: r.bausteine, hinweise: r.hinweise, kg_gesamt: (r.kg_je_einheit ?? 0) * m };
    }
    case 'gitterrost_m2': {
      const kauf = ansatz.eur_m2 ?? sd(stamm, 'tr_gitterrost_m2');
      const hm2 = sd(stamm, 'gr_montage_h_m2');
      const arbeit = ansatz.montage ? hm2 * sd(stamm, 'satz_montage') : 0;
      const netto = kauf + arbeit;
      const z = zuschlaege(kauf, arbeit, stamm);
      return {
        ep: r2(netto + z.summe),
        bausteine: [
          { text: 'Gitterrost Kaufteil', betrag: r2(kauf) },
          ...(arbeit ? [{ text: `Montage ${String(hm2).replace('.', ',')} h/m²`, betrag: r2(arbeit) }] : []),
          ...z.bausteine,
        ],
        hinweise: [],
      };
    }
    case 'zukauf': {
      if (ansatz.einkauf === null || ansatz.einkauf === undefined) {
        return { ep: null, bausteine: [], hinweise: ['Zukaufteil: Lieferantenpreis fehlt'], offen: 'Preis anfragen' };
      }
      const z = (ansatz.einkauf * ansatz.aufschlag_prozent) / 100;
      return {
        ep: r2(ansatz.einkauf + z),
        bausteine: [
          { text: `Einkauf${ansatz.lieferant ? ' ' + ansatz.lieferant : ''}`, betrag: r2(ansatz.einkauf) },
          { text: `Aufschlag ${ansatz.aufschlag_prozent} %`, betrag: r2(z) },
        ],
        hinweise: [],
      };
    }
    case 'stunden': {
      const satz = ansatz.montage ? sd(stamm, 'satz_montage') : sd(stamm, 'satz_werkstatt');
      const lohn = pos(ansatz.stunden_je_einheit) * satz;
      const mat = pos(ansatz.material_je_einheit);
      const z = zuschlaege(mat, lohn, stamm);
      return {
        ep: r2(lohn + mat + z.summe),
        bausteine: [
          { text: `${de(ansatz.stunden_je_einheit)} h × ${satz} €/h`, betrag: r2(lohn) },
          ...(mat ? [{ text: 'Material', betrag: r2(mat) }] : []),
          ...z.bausteine,
        ],
        hinweise: [],
      };
    }
    case 'baugruppe': {
      const r = baugruppeRechnen(ansatz, stamm);
      return { ep: r.ep, bausteine: r.bausteine, hinweise: r.hinweise, kg_gesamt: r.kg_je_einheit * m };
    }
    case 'prozent_be':
      return { ep: null, bausteine: [], hinweise: [`Baustelleneinrichtung: ${ansatz.prozent} % der übrigen Summe, wird zuletzt gerechnet`] };
    case 'manuell':
      return { ep: ansatz.ep, bausteine: ansatz.ep !== null ? [{ text: 'Preis von Hand', betrag: ansatz.ep }] : [], hinweise: [], offen: ansatz.ep === null ? 'Preis eintragen' : undefined };
  }
}
