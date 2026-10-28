/**
 * Kalkulation nach Werkstattzeichnung (Baugruppe oder Einzelteil mit Stückliste).
 *
 * Ablauf wie in der Arbeitsvorbereitung:
 * 1. Stückliste in Teilearten einteilen (schweres Profil, leichtes Profil, Blech, dickes Blech, Kleinteil, Kaufteil).
 * 2. Arbeitsgänge je Teil und je Merkmal (Bohrungen, Naht, Kantungen) mit Zeitwerten aus den Stammdaten.
 * 3. Jeder Arbeitsgang läuft über eine Kostenstelle mit eigenem Stundensatz (Fertigungseinzelkosten).
 * 4. Zuschlagskalkulation wie im ERP: MEK + MGK, FEK + FGK, Fremdleistung, Herstellkosten,
 *    Verwaltungs- und Vertriebsgemeinkosten, Gewinn, Kundenskonto.
 *
 * Wer mit einem einzigen Verrechnungssatz rechnet (Gemeinkosten und Gewinn im Stundensatz), setzt alle Kostenstellen
 * auf diesen Satz und die Zuschläge auf 0. Das Ergebnis ist dann Stunden × Satz plus Material.
 */
import { metergewicht } from './profile';
import { sd, type Stammdaten } from './stammdaten';

export type Teilart = 'profil_schwer' | 'profil_leicht' | 'blech' | 'blech_dick' | 'kleinteil' | 'kaufteil';

/** Eine Zeile der Stückliste, bezogen auf EINE Baugruppe. gewicht_kg = Gewicht der ganzen Zeile (alle Stück). */
export type Teil = {
  pos: string;
  stk: number;
  bezeichnung: string;
  profil: string;
  werkstoff: string;
  laenge_mm: number | null;
  gewicht_kg: number | null;
};

export type ZeichnungOberflaeche = 'roh' | 'grundiert' | 'verzinkt' | 'beschichtet' | 'verzinkt_beschichtet';

export type BaugruppeMerkmale = {
  schweissbaugruppe: boolean;
  bohrungen_profil: number;
  bohrungen_blech: number;
  naht_m: number;
  hv_naht_m: number;
  kantungen: number;
  oberflaeche: ZeichnungOberflaeche;
  flaeche_m2?: number | null;
  montage_h?: number;
  zusatz_h?: number;
};

export type BaugruppeAnsatz = {
  art: 'baugruppe';
  zeichnung?: string;
  gewicht_zeichnung_kg?: number | null;
  teile: Teil[];
  merkmale: BaugruppeMerkmale;
};

export const MERKMALE_STANDARD: BaugruppeMerkmale = {
  schweissbaugruppe: true,
  bohrungen_profil: 0,
  bohrungen_blech: 0,
  naht_m: 0,
  hv_naht_m: 0,
  kantungen: 0,
  oberflaeche: 'roh',
  flaeche_m2: null,
  montage_h: 0,
  zusatz_h: 0,
};

export const KOSTENSTELLEN = [
  { key: 'ks_saegen', label: 'Sägen' },
  { key: 'ks_brennen', label: 'Brennen / Laser' },
  { key: 'ks_bohren', label: 'Bohren' },
  { key: 'ks_kanten', label: 'Kanten' },
  { key: 'ks_schlosser', label: 'Schlosserei' },
  { key: 'ks_schweissen', label: 'Schweißen' },
  { key: 'ks_hilfs', label: 'Transport / Verladen' },
  { key: 'ks_montage', label: 'Montage' },
] as const;

export type Kostenstelle = (typeof KOSTENSTELLEN)[number]['key'];

const KAUFTEIL = /\b(schraube|mutter|scheibe|hv[- ]?garnitur|garnitur|kopfbolzen|anker|d[üu]bel|niet|bolzen|gewindestange|din\s?\d{3,4}|iso\s?\d{3,4})\b/i;
const BLECH = /^(bl|blech|pl|platte|riffel|tr[äa]nen|-)\b|^(bl|pl)\s?\d|\b(blech|platte|stirnplatte|kopfplatte|fu(ß|ss)platte|rippe|steife|knotenblech|lasche|futter)\b/i;
const WALZ = /\b(he[abm]|hd|hl|ipe|ipn|upe|upn|u|l|t|rohr|ro|rro|qro|qr|rhs|shs|chs|vkt)\s?\d/i;
const FLACH = /\b(fl|flach|flachstahl|rd|rund|rundstahl)\s?\d/i;

/** Blechdicke aus Angaben wie "BL20*200*300", "Bl 10x150x250", "-15x120", "PL 12". Bei mehreren Maßen das kleinste. */
export function blechdicke(profil: string): number | null {
  const zahlen = (profil.replace(/,/g, '.').match(/\d+(?:\.\d+)?/g) ?? []).map(Number).filter((n) => n > 0);
  if (!zahlen.length) return null;
  return Math.min(...zahlen);
}

/** Profilhöhe aus "HEB240", "IPE 300", "U220", "Rohr 219,1x10", "L150x75x11". */
function profilHoehe(profil: string): number | null {
  const m = profil.replace(/,/g, '.').match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

export function teilart(t: Pick<Teil, 'bezeichnung' | 'profil' | 'gewicht_kg' | 'stk'>): Teilart {
  const text = `${t.profil} ${t.bezeichnung}`;
  if (KAUFTEIL.test(text) && !BLECH.test(t.profil)) return 'kaufteil';
  const einzel = t.gewicht_kg && t.stk > 0 ? t.gewicht_kg / t.stk : null;
  const istProfil = WALZ.test(t.profil) && !/^(bl|pl)/i.test(t.profil.trim());
  if (istProfil) {
    const norm = t.profil.replace(/\*/g, 'x');
    const kgm = metergewicht(norm);
    const h = profilHoehe(norm);
    const traeger = /\b(he[abm]|ipe|ipn|hd|hl)\s?\d/i.test(norm);
    const uprofil = /\b(upe|upn|u)\s?\d/i.test(norm);
    if (traeger && ((h !== null && h >= 200) || (kgm !== null && kgm >= 40))) return 'profil_schwer';
    if (uprofil && kgm !== null && kgm >= 40) return 'profil_schwer';
    return 'profil_leicht';
  }
  if (FLACH.test(t.profil)) return einzel !== null && einzel < 0.5 ? 'kleinteil' : 'profil_leicht';
  if (BLECH.test(t.profil) || BLECH.test(t.bezeichnung)) {
    const d = blechdicke(t.profil);
    if (/futter|unterleg/i.test(text) || (einzel !== null && einzel < 1) || (d !== null && d < 5)) return 'kleinteil';
    if (d !== null && d >= 20) return 'blech_dick';
    return 'blech';
  }
  // Unklar: nach Gewicht einordnen
  if (einzel !== null && einzel < 1) return 'kleinteil';
  return 'profil_leicht';
}

/** Gewicht einer Stücklistenzeile: angegeben oder aus Profil und Länge gerechnet. */
export function teilGewicht(t: Teil): { kg: number; geschaetzt: boolean } {
  if (t.gewicht_kg !== null && t.gewicht_kg !== undefined && t.gewicht_kg > 0) return { kg: t.gewicht_kg, geschaetzt: false };
  const kgm = metergewicht(t.profil.replace(/\*/g, 'x'));
  if (kgm && t.laenge_mm) return { kg: (kgm * t.laenge_mm * Math.max(t.stk, 1)) / 1000, geschaetzt: true };
  return { kg: 0, geschaetzt: true };
}

export type Arbeitsgang = { text: string; kostenstelle: Kostenstelle; menge: number; einheit: string; h_je: number; stunden: number };

export type BaugruppeErgebnis = {
  ep: number;
  einheit: string;
  bausteine: { text: string; betrag: number }[];
  hinweise: string[];
  kg_je_einheit: number;
  h_je_einheit: number;
  lohn: number;
  arbeitsgaenge: Arbeitsgang[];
  kennzahlen: {
    kg: number;
    kg_material: number;
    teile: number;
    stunden: number;
    flaeche_m2: number;
    mek: number;
    fek: number;
    fremd: number;
    herstellkosten: number;
    selbstkosten: number;
    eur_kg: number;
  };
};

const r2 = (v: number) => Math.round(v * 100) / 100;
const de = (v: number, stellen = 2) => v.toLocaleString('de-DE', { maximumFractionDigits: stellen });
const p0 = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);

/** Zuschlagskalkulation wie im ERP-Kalkulationsschema. Alle Werte je Stück. */
export function zuschlagskalkulation(mek: number, fek: number, fremd: number, stamm: Stammdaten) {
  const mgk = (mek * sd(stamm, 'zs_mgk')) / 100;
  const fgk = (fek * sd(stamm, 'zs_fgk')) / 100;
  const hk = mek + mgk + fek + fgk + fremd;
  const vwgk = (hk * sd(stamm, 'zs_vwgk')) / 100;
  const vtgk = (hk * sd(stamm, 'zs_vtgk')) / 100;
  const sk = hk + vwgk + vtgk;
  const gewinn = (sk * sd(stamm, 'zs_gewinn')) / 100;
  const bvp = sk + gewinn;
  // Kundenskonto im Hundert: der Zielverkaufspreis enthält das Skonto, das der Kunde abziehen darf
  const skontoSatz = sd(stamm, 'zs_skonto');
  const zvp = skontoSatz > 0 && skontoSatz < 100 ? bvp / (1 - skontoSatz / 100) : bvp;
  return { mgk, fgk, hk, vwgk, vtgk, sk, gewinn, bvp, skonto: zvp - bvp, zvp };
}

/** Preis je Baugruppe (Stück). */
export function baugruppeRechnen(a: BaugruppeAnsatz, stamm: Stammdaten): BaugruppeErgebnis {
  const m = { ...MERKMALE_STANDARD, ...(a.merkmale ?? {}) };
  const teile = (a.teile ?? []).filter((t) => t && (t.stk ?? 0) > 0);
  const hinweise: string[] = [];

  // 1. Mengen aus der Stückliste
  let kgProfil = 0;
  let kgBlech = 0;
  let kgKauf = 0;
  let geschaetzt = 0;
  const anzahl: Record<Teilart, number> = { profil_schwer: 0, profil_leicht: 0, blech: 0, blech_dick: 0, kleinteil: 0, kaufteil: 0 };
  for (const t of teile) {
    const art = teilart(t);
    const g = teilGewicht(t);
    if (g.geschaetzt && g.kg > 0) geschaetzt++;
    anzahl[art] += t.stk;
    if (art === 'kaufteil') kgKauf += g.kg;
    else if (art === 'blech' || art === 'blech_dick' || art === 'kleinteil') kgBlech += g.kg;
    else kgProfil += g.kg;
  }
  const kg = kgProfil + kgBlech;
  const teileGefertigt = anzahl.profil_schwer + anzahl.profil_leicht + anzahl.blech + anzahl.blech_dick + anzahl.kleinteil;
  const einzelprofile = anzahl.profil_schwer + anzahl.profil_leicht;
  if (geschaetzt) hinweise.push(`${geschaetzt} Stücklistenzeilen ohne Gewicht, aus Profil und Länge gerechnet`);
  if (a.gewicht_zeichnung_kg && kg > 0) {
    const abw = Math.abs(kg - a.gewicht_zeichnung_kg) / a.gewicht_zeichnung_kg;
    if (abw > 0.02) hinweise.push(`Stückliste ${de(kg, 1)} kg, Zeichnung ${de(a.gewicht_zeichnung_kg, 1)} kg: Abweichung ${de(abw * 100, 0)} %, bitte prüfen`);
  }

  // 2. Material (Einzelkosten) mit Verschnitt
  const vProfil = sd(stamm, 'zg_verschnitt_profil') / 100;
  const vBlech = sd(stamm, 'zg_verschnitt_blech') / 100;
  const kgMaterial = kgProfil * (1 + vProfil) + kgBlech * (1 + vBlech);
  const matProfil = kgProfil * (1 + vProfil) * sd(stamm, 'stahl_einkauf_kg');
  const matBlech = kgBlech * (1 + vBlech) * sd(stamm, 'blech_einkauf_kg');
  const mek = matProfil + matBlech;

  // 3. Arbeitsgänge
  const ag: Arbeitsgang[] = [];
  const add = (text: string, kostenstelle: Kostenstelle, menge: number, einheit: string, h_je: number) => {
    if (menge > 0 && h_je > 0) ag.push({ text, kostenstelle, menge, einheit, h_je, stunden: menge * h_je });
  };
  add('Sägen schwere Profile', 'ks_saegen', anzahl.profil_schwer, 'Stk', sd(stamm, 'zg_saegen_schwer_h'));
  add('Sägen leichte Profile, Flach, Rohr', 'ks_saegen', anzahl.profil_leicht, 'Stk', sd(stamm, 'zg_saegen_leicht_h'));
  add('Blechzuschnitt bis 15 mm', 'ks_brennen', anzahl.blech, 'Stk', sd(stamm, 'zg_blech_h'));
  add('Blechzuschnitt ab 20 mm, mit Fase', 'ks_brennen', anzahl.blech_dick, 'Stk', sd(stamm, 'zg_blech_dick_h'));
  add('Kleinteile, Futterbleche', 'ks_brennen', anzahl.kleinteil, 'Stk', sd(stamm, 'zg_kleinteil_h'));
  add('Bohren im Profil', 'ks_bohren', p0(m.bohrungen_profil), 'Bohrung', sd(stamm, 'zg_bohr_profil_h'));
  add('Bohren im Blech', 'ks_bohren', p0(m.bohrungen_blech), 'Bohrung', sd(stamm, 'zg_bohr_blech_h'));
  add('Kanten', 'ks_kanten', p0(m.kantungen), 'Kantung', sd(stamm, 'zg_kanten_h'));
  if (m.schweissbaugruppe && teileGefertigt > 1) {
    const anbau = teileGefertigt - 1;
    add('Zusammenbau je Anbauteil (Anreißen, Anpassen, Heften)', 'ks_schlosser', anbau, 'Stk', sd(stamm, 'zg_zusammenbau_h'));
    let naht = p0(m.naht_m);
    if (naht === 0) {
      naht = anbau * sd(stamm, 'zg_naht_je_anbauteil_m');
      hinweise.push(`Nahtlänge nicht angegeben, mit ${de(sd(stamm, 'zg_naht_je_anbauteil_m'))} m je Anbauteil angesetzt`);
    }
    add('Schweißen Kehlnaht', 'ks_schweissen', naht, 'm', sd(stamm, 'zg_schweiss_h_m'));
    add('Schweißen HV- und Stumpfnaht', 'ks_schweissen', p0(m.hv_naht_m), 'm', sd(stamm, 'zg_schweiss_h_m') * sd(stamm, 'zg_hv_faktor'));
    add('Richten, Schleifen, Kontrolle, Kennzeichnen', 'ks_schlosser', 1, 'Baugruppe', sd(stamm, 'zg_richten_bg_h'));
  } else {
    add('Kontrolle, Kennzeichnen je Profil', 'ks_schlosser', einzelprofile, 'Stk', sd(stamm, 'zg_richten_einzel_h'));
    add('Kontrolle, Kennzeichnen je Blech', 'ks_schlosser', anzahl.blech + anzahl.blech_dick + anzahl.kleinteil, 'Stk', sd(stamm, 'zg_richten_klein_h'));
  }
  add('Innerbetrieblicher Transport, Verladen', 'ks_hilfs', kg / 1000, 't', sd(stamm, 'zg_transport_h_t'));
  add('Sonderaufwand laut Zeichnung', 'ks_schlosser', p0(m.zusatz_h), 'h', 1);
  add('Montage', 'ks_montage', p0(m.montage_h), 'h', 1);

  const stunden = ag.reduce((s, x) => s + x.stunden, 0);
  const fekJe = (x: Arbeitsgang) => x.stunden * sd(stamm, x.kostenstelle);
  const fek = ag.reduce((s, x) => s + fekJe(x), 0);

  // 4. Fremdleistung Oberfläche
  const flaeche = p0(m.flaeche_m2) || (kg / 1000) * sd(stamm, 'zg_flaeche_m2_t');
  let fremd = 0;
  const fremdText: string[] = [];
  if (m.oberflaeche === 'verzinkt' || m.oberflaeche === 'verzinkt_beschichtet') {
    const v = kg * sd(stamm, 'verzinkung_eur_kg');
    fremd += v;
    fremdText.push(`Feuerverzinken ${de(kg, 0)} kg × ${de(sd(stamm, 'verzinkung_eur_kg'))} €/kg`);
  }
  if (m.oberflaeche === 'beschichtet' || m.oberflaeche === 'verzinkt_beschichtet') {
    const b = flaeche * sd(stamm, 'beschichtung_eur_m2');
    fremd += b;
    fremdText.push(`Strahlen und Beschichten ${de(flaeche, 1)} m² × ${de(sd(stamm, 'beschichtung_eur_m2'))} €/m²`);
  }
  if (m.oberflaeche === 'grundiert') {
    const g = kg * sd(stamm, 'grundierung_eur_kg');
    fremd += g;
    fremdText.push(`Grundieren ${de(kg, 0)} kg × ${de(sd(stamm, 'grundierung_eur_kg'))} €/kg`);
  }

  // 5. Zuschlagskalkulation
  const z = zuschlagskalkulation(mek, fek, fremd, stamm);

  const bausteine: { text: string; betrag: number }[] = [];
  bausteine.push({ text: `Material ${de(kgMaterial, 1)} kg inkl. Verschnitt (Profile ${de(vProfil * 100, 0)} %, Bleche ${de(vBlech * 100, 0)} %)`, betrag: r2(mek) });
  if (z.mgk) bausteine.push({ text: `Materialgemeinkosten ${de(sd(stamm, 'zs_mgk'))} %`, betrag: r2(z.mgk) });
  for (const x of ag) {
    bausteine.push({
      text: `${x.text}: ${de(x.menge, 2)} ${x.einheit}${x.einheit === 'h' ? '' : ` × ${de(x.h_je, 3)} h`} = ${de(x.stunden, 2)} h × ${de(sd(stamm, x.kostenstelle))} €/h`,
      betrag: r2(fekJe(x)),
    });
  }
  if (z.fgk) bausteine.push({ text: `Fertigungsgemeinkosten ${de(sd(stamm, 'zs_fgk'))} %`, betrag: r2(z.fgk) });
  if (fremd) bausteine.push({ text: `Fremdleistung: ${fremdText.join(', ')}`, betrag: r2(fremd) });
  if (z.vwgk) bausteine.push({ text: `Verwaltungsgemeinkosten ${de(sd(stamm, 'zs_vwgk'))} %`, betrag: r2(z.vwgk) });
  if (z.vtgk) bausteine.push({ text: `Vertriebsgemeinkosten ${de(sd(stamm, 'zs_vtgk'))} %`, betrag: r2(z.vtgk) });
  if (z.gewinn) bausteine.push({ text: `Gewinn ${de(sd(stamm, 'zs_gewinn'))} %`, betrag: r2(z.gewinn) });
  if (z.skonto) bausteine.push({ text: `Kundenskonto ${de(sd(stamm, 'zs_skonto'))} %`, betrag: r2(z.skonto) });
  if (kgKauf) hinweise.push(`Kaufteile (${de(kgKauf, 1)} kg) nicht im Stahlgewicht, bitte gesondert anfragen`);

  const ep = r2(z.zvp);
  hinweise.unshift(`${de(kg, 1)} kg · ${teileGefertigt} Teile · ${de(stunden, 1)} h · Herstellkosten ${de(z.hk, 2)} € · Selbstkosten ${de(z.sk, 2)} €${kg > 0 ? ` · ${de(ep / kg, 2)} €/kg` : ''}`);

  return {
    ep,
    einheit: 'Stck',
    bausteine,
    hinweise,
    kg_je_einheit: r2(kg),
    h_je_einheit: Math.round(stunden * 1000) / 1000,
    lohn: fek + z.fgk,
    arbeitsgaenge: ag,
    kennzahlen: {
      kg: r2(kg),
      kg_material: r2(kgMaterial),
      teile: teileGefertigt,
      stunden: Math.round(stunden * 1000) / 1000,
      flaeche_m2: r2(flaeche),
      mek: r2(mek),
      fek: r2(fek),
      fremd: r2(fremd),
      herstellkosten: r2(z.hk),
      selbstkosten: r2(z.sk),
      eur_kg: kg > 0 ? r2(ep / kg) : 0,
    },
  };
}

/** Kurzbeschreibung der Stückliste für den Angebotstext. */
export function stuecklistenText(a: BaugruppeAnsatz): string {
  const teile = (a.teile ?? []).filter((t) => t.stk > 0 && teilart(t) !== 'kaufteil');
  const haupt = [...teile].sort((x, y) => teilGewicht(y).kg - teilGewicht(x).kg)[0];
  const kg = teile.reduce((s, t) => s + teilGewicht(t).kg, 0);
  const werkstoffe = Array.from(new Set(teile.map((t) => t.werkstoff).filter(Boolean)));
  const ober: Record<ZeichnungOberflaeche, string> = {
    roh: 'unbehandelt',
    grundiert: 'grundiert',
    verzinkt: 'feuerverzinkt',
    beschichtet: 'gestrahlt und beschichtet',
    verzinkt_beschichtet: 'feuerverzinkt und beschichtet',
  };
  const teileText = [
    haupt ? `Hauptteil ${haupt.profil}${haupt.laenge_mm ? `, L = ${de(haupt.laenge_mm, 0)} mm` : ''}` : '',
    teile.length > 1 ? `${teile.reduce((s, t) => s + t.stk, 0) - 1} Anbauteile` : '',
    werkstoffe.length ? `Werkstoff ${werkstoffe.join(', ')}` : '',
    `Gewicht ca. ${de(kg, 1)} kg je Stück`,
    `Oberfläche ${ober[a.merkmale?.oberflaeche ?? 'roh']}`,
  ].filter(Boolean);
  return `${a.zeichnung ? `Nach Zeichnung ${a.zeichnung}. ` : ''}${teileText.join(', ')}.`;
}
