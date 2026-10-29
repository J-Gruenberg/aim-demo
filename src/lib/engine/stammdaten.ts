/**
 * Stammdaten (Kalkulationsgrundlagen) mit Startwerten.
 * Alle Werte sind Startwerte des Beispielbetriebs. Im echten Betrieb ersetzen wir sie
 * im Einrichtungsgespräch durch die Zahlen des Kunden (Kalkulationsblätter, Nachkalkulation, ERP-Schema).
 */
export type StammdatumDef = {
  schluessel: string;
  gruppe: string;
  bezeichnung: string;
  einheit: string;
  wert: number;
  quelle: string;
  notiz?: string;
};

export type Stammdaten = Record<string, number>;

export const GRUPPEN = [
  'Allgemein',
  'Kostenstellen (Fertigungslohn je Stunde)',
  'Kalkulationsschema (Zuschläge)',
  'Fertigung nach Zeichnung',
  'Hallenbau: Stahl und Profile',
  'Hallenbau: Hülle',
  'Hallenbau: Öffnungen',
  'Hallenbau: Nebenleistungen',
  'Hallenbau: Ausbau und Gewerke',
  'Hallenbau: Geometrie-Regeln',
  'Stahlbau nach Gewicht',
  'Geländer',
  'Treppen',
  'Lernen aus Korrekturen',
] as const;

const B = 'Startwert Beispielbetrieb';
const BR = 'Branchenwert, im Einrichtungsgespräch mit Ihren Zahlen ersetzen';
const AIM = 'AIM Standardwert je Arbeitsgang, wird mit Ihrer Nachkalkulation eingestellt';

export const STAMMDATEN_DEFS: StammdatumDef[] = [
  // Allgemein
  { schluessel: 'satz_werkstatt', gruppe: 'Allgemein', bezeichnung: 'Verrechnungssatz Werkstatt (Ausschreibung, Bauteile)', einheit: '€/h', wert: 68, quelle: `${B}: Satz inkl. Gemeinkosten, Wagnis und Gewinn` },
  { schluessel: 'satz_montage', gruppe: 'Allgemein', bezeichnung: 'Verrechnungssatz Montage (Ausschreibung, Bauteile)', einheit: '€/h', wert: 68, quelle: `${B}: Satz inkl. Gemeinkosten, Wagnis und Gewinn` },
  { schluessel: 'stahl_einkauf_kg', gruppe: 'Allgemein', bezeichnung: 'Stahl Einkauf Profile, Flach, Winkel', einheit: '€/kg', wert: 1.05, quelle: `${B}, Marktpreis S235 frei Werk` },
  { schluessel: 'blech_einkauf_kg', gruppe: 'Allgemein', bezeichnung: 'Stahl Einkauf Bleche', einheit: '€/kg', wert: 1.15, quelle: `${B}, Marktpreis Grobblech frei Werk` },
  { schluessel: 'rohr_aufschlag_prozent', gruppe: 'Allgemein', bezeichnung: 'Mehrpreis Rund- und Quadratrohr', einheit: '%', wert: 15, quelle: BR },
  { schluessel: 's355_aufschlag_prozent', gruppe: 'Allgemein', bezeichnung: 'Mehrpreis S355 gegenüber S235', einheit: '%', wert: 5, quelle: BR },
  { schluessel: 'kleinteile_prozent', gruppe: 'Allgemein', bezeichnung: 'Kleinteile (Bleche, Rippen, Laschen) auf Tonnage', einheit: '%', wert: 10, quelle: BR },
  { schluessel: 'befestigung_prozent', gruppe: 'Allgemein', bezeichnung: 'Befestigungsmittel auf Material', einheit: '%', wert: 5, quelle: BR },
  { schluessel: 'verzinkung_eur_kg', gruppe: 'Allgemein', bezeichnung: 'Feuerverzinkung (Fremdleistung)', einheit: '€/kg', wert: 0.6, quelle: BR },
  { schluessel: 'grundierung_eur_kg', gruppe: 'Allgemein', bezeichnung: 'Grundierung', einheit: '€/kg', wert: 0.35, quelle: BR },
  { schluessel: 'pulver_eur_m2', gruppe: 'Allgemein', bezeichnung: 'Pulverbeschichtung', einheit: '€/m²', wert: 28, quelle: BR },
  { schluessel: 'beschichtung_eur_m2', gruppe: 'Allgemein', bezeichnung: 'Strahlen und Nassbeschichtung (Fremdleistung)', einheit: '€/m²', wert: 28, quelle: BR },
  { schluessel: 'zuschlag_wg_prozent', gruppe: 'Allgemein', bezeichnung: 'Zuschlag auf Material, Oberfläche und Kaufteile (Ausschreibung, Bauteile)', einheit: '%', wert: 15, quelle: `${B}, wie Formblatt 221 der Preisermittlung` },
  { schluessel: 'zuschlag_lohn_prozent', gruppe: 'Allgemein', bezeichnung: 'Zuschlag auf Lohn (Ausschreibung, Bauteile)', einheit: '%', wert: 0, quelle: 'Gemeinkosten, Wagnis und Gewinn stecken im Verrechnungssatz' },
  { schluessel: 'preisindex_jahr_prozent', gruppe: 'Allgemein', bezeichnung: 'Preissteigerung je Jahr für alte Referenzpreise', einheit: '%', wert: 5, quelle: BR },

  // Kostenstellen: Fertigungslohn (Einzelkosten). Gemeinkosten kommen über das Kalkulationsschema dazu.
  { schluessel: 'ks_saegen', gruppe: 'Kostenstellen (Fertigungslohn je Stunde)', bezeichnung: 'Sägen', einheit: '€/h', wert: 22, quelle: `${B}, Kostenstellenstruktur nach Praxisbetrieb Metallbau` },
  { schluessel: 'ks_brennen', gruppe: 'Kostenstellen (Fertigungslohn je Stunde)', bezeichnung: 'Brennen, Plasma, Laser (Maschine)', einheit: '€/h', wert: 38, quelle: `${B}, Kostenstellenstruktur nach Praxisbetrieb Metallbau` },
  { schluessel: 'ks_bohren', gruppe: 'Kostenstellen (Fertigungslohn je Stunde)', bezeichnung: 'Bohren', einheit: '€/h', wert: 22, quelle: `${B}, Kostenstellenstruktur nach Praxisbetrieb Metallbau` },
  { schluessel: 'ks_kanten', gruppe: 'Kostenstellen (Fertigungslohn je Stunde)', bezeichnung: 'Kanten', einheit: '€/h', wert: 24, quelle: `${B}, Kostenstellenstruktur nach Praxisbetrieb Metallbau` },
  { schluessel: 'ks_schlosser', gruppe: 'Kostenstellen (Fertigungslohn je Stunde)', bezeichnung: 'Schlosserei (Zusammenbau, Richten, Kontrolle)', einheit: '€/h', wert: 22, quelle: `${B}, Kostenstellenstruktur nach Praxisbetrieb Metallbau` },
  { schluessel: 'ks_schweissen', gruppe: 'Kostenstellen (Fertigungslohn je Stunde)', bezeichnung: 'Schweißen', einheit: '€/h', wert: 24, quelle: `${B}, Kostenstellenstruktur nach Praxisbetrieb Metallbau` },
  { schluessel: 'ks_hilfs', gruppe: 'Kostenstellen (Fertigungslohn je Stunde)', bezeichnung: 'Transport, Verladen', einheit: '€/h', wert: 19, quelle: `${B}, Kostenstellenstruktur nach Praxisbetrieb Metallbau` },
  { schluessel: 'ks_montage', gruppe: 'Kostenstellen (Fertigungslohn je Stunde)', bezeichnung: 'Montage', einheit: '€/h', wert: 24, quelle: `${B}, Kostenstellenstruktur nach Praxisbetrieb Metallbau` },

  // Kalkulationsschema wie im ERP (Zuschlagskalkulation)
  { schluessel: 'zs_mgk', gruppe: 'Kalkulationsschema (Zuschläge)', bezeichnung: 'Materialgemeinkosten auf Material', einheit: '%', wert: 5, quelle: `${B}, Schema wie ERP-Kalkulation` },
  { schluessel: 'zs_fgk', gruppe: 'Kalkulationsschema (Zuschläge)', bezeichnung: 'Fertigungsgemeinkosten auf Fertigungslohn', einheit: '%', wert: 110, quelle: `${B}, Schema wie ERP-Kalkulation` },
  { schluessel: 'zs_vwgk', gruppe: 'Kalkulationsschema (Zuschläge)', bezeichnung: 'Verwaltungsgemeinkosten auf Herstellkosten', einheit: '%', wert: 12, quelle: `${B}, Schema wie ERP-Kalkulation` },
  { schluessel: 'zs_vtgk', gruppe: 'Kalkulationsschema (Zuschläge)', bezeichnung: 'Vertriebsgemeinkosten auf Herstellkosten', einheit: '%', wert: 8, quelle: `${B}, Schema wie ERP-Kalkulation` },
  { schluessel: 'zs_gewinn', gruppe: 'Kalkulationsschema (Zuschläge)', bezeichnung: 'Gewinnaufschlag auf Selbstkosten', einheit: '%', wert: 10, quelle: `${B}, Schema wie ERP-Kalkulation` },
  { schluessel: 'zs_skonto', gruppe: 'Kalkulationsschema (Zuschläge)', bezeichnung: 'Kundenskonto (im Hundert)', einheit: '%', wert: 2, quelle: `${B}, Schema wie ERP-Kalkulation` },

  // Fertigung nach Zeichnung: Zeitwerte je Arbeitsgang
  { schluessel: 'zg_saegen_schwer_h', gruppe: 'Fertigung nach Zeichnung', bezeichnung: 'Sägen schweres Profil (ab 200 mm bzw. 40 kg/m)', einheit: 'h/Stk', wert: 0.3, quelle: AIM },
  { schluessel: 'zg_saegen_leicht_h', gruppe: 'Fertigung nach Zeichnung', bezeichnung: 'Sägen leichtes Profil, Flach, Rohr, Winkel', einheit: 'h/Stk', wert: 0.15, quelle: AIM },
  { schluessel: 'zg_blech_h', gruppe: 'Fertigung nach Zeichnung', bezeichnung: 'Blechzuschnitt bis 15 mm (Brennen, Entgraten, Kennzeichnen)', einheit: 'h/Stk', wert: 0.08, quelle: AIM },
  { schluessel: 'zg_blech_dick_h', gruppe: 'Fertigung nach Zeichnung', bezeichnung: 'Blechzuschnitt ab 20 mm, inkl. Fase', einheit: 'h/Stk', wert: 0.12, quelle: AIM },
  { schluessel: 'zg_kleinteil_h', gruppe: 'Fertigung nach Zeichnung', bezeichnung: 'Kleinteile und Futterbleche (Scheren)', einheit: 'h/Stk', wert: 0.04, quelle: AIM },
  { schluessel: 'zg_bohr_profil_h', gruppe: 'Fertigung nach Zeichnung', bezeichnung: 'Bohren im Profil', einheit: 'h/Bohrung', wert: 0.06, quelle: AIM },
  { schluessel: 'zg_bohr_blech_h', gruppe: 'Fertigung nach Zeichnung', bezeichnung: 'Bohren im Blech', einheit: 'h/Bohrung', wert: 0.03, quelle: AIM },
  { schluessel: 'zg_kanten_h', gruppe: 'Fertigung nach Zeichnung', bezeichnung: 'Kanten je Kantung', einheit: 'h/Kantung', wert: 0.05, quelle: AIM },
  { schluessel: 'zg_zusammenbau_h', gruppe: 'Fertigung nach Zeichnung', bezeichnung: 'Zusammenbau je Anbauteil (Anreißen, Anpassen, Heften)', einheit: 'h/Stk', wert: 0.25, quelle: AIM },
  { schluessel: 'zg_schweiss_h_m', gruppe: 'Fertigung nach Zeichnung', bezeichnung: 'Schweißen Kehlnaht a 3 bis 5 mm (MAG), inkl. Nebenzeiten', einheit: 'h/m', wert: 0.18, quelle: AIM },
  { schluessel: 'zg_hv_faktor', gruppe: 'Fertigung nach Zeichnung', bezeichnung: 'Faktor HV- und Stumpfnaht (Nahtvorbereitung, mehrlagig)', einheit: '×', wert: 1.8, quelle: AIM },
  { schluessel: 'zg_naht_je_anbauteil_m', gruppe: 'Fertigung nach Zeichnung', bezeichnung: 'Nahtlänge je Anbauteil, wenn auf der Zeichnung nicht ablesbar', einheit: 'm', wert: 0.6, quelle: AIM },
  { schluessel: 'zg_richten_bg_h', gruppe: 'Fertigung nach Zeichnung', bezeichnung: 'Richten, Schleifen, Maßkontrolle je Schweißbaugruppe (inkl. WPK)', einheit: 'h/Stk', wert: 0.5, quelle: AIM },
  { schluessel: 'zg_ruesten_h', gruppe: 'Fertigung nach Zeichnung', bezeichnung: 'Rüsten und Programmieren je Zeichnung, einmal je Los (für die Losgrößen-Staffel)', einheit: 'h', wert: 1.5, quelle: AIM },
  { schluessel: 'zg_richten_einzel_h', gruppe: 'Fertigung nach Zeichnung', bezeichnung: 'Kontrolle, Kennzeichnen je Einzelprofil', einheit: 'h/Stk', wert: 0.1, quelle: AIM },
  { schluessel: 'zg_richten_klein_h', gruppe: 'Fertigung nach Zeichnung', bezeichnung: 'Kontrolle, Kennzeichnen je Einzelblech', einheit: 'h/Stk', wert: 0.02, quelle: AIM },
  { schluessel: 'zg_transport_h_t', gruppe: 'Fertigung nach Zeichnung', bezeichnung: 'Innerbetrieblicher Transport, Verladen', einheit: 'h/t', wert: 1.5, quelle: AIM },
  { schluessel: 'zg_verschnitt_profil', gruppe: 'Fertigung nach Zeichnung', bezeichnung: 'Verschnitt Profile auf Stücklistengewicht', einheit: '%', wert: 5, quelle: BR },
  { schluessel: 'zg_verschnitt_blech', gruppe: 'Fertigung nach Zeichnung', bezeichnung: 'Verschnitt Bleche auf Stücklistengewicht', einheit: '%', wert: 15, quelle: BR },
  { schluessel: 'zg_flaeche_m2_t', gruppe: 'Fertigung nach Zeichnung', bezeichnung: 'Beschichtungsfläche je t, wenn nicht angegeben', einheit: 'm²/t', wert: 20, quelle: BR },

  // Hallenbau Stahl
  { schluessel: 'halle_stahl_grundiert_kg', gruppe: 'Hallenbau: Stahl und Profile', bezeichnung: 'Stahlbau grundiert, fertig montiert', einheit: '€/kg', wert: 3.5, quelle: BR },
  { schluessel: 'halle_stahl_verzinkt_kg', gruppe: 'Hallenbau: Stahl und Profile', bezeichnung: 'Stahlbau verzinkt, fertig montiert', einheit: '€/kg', wert: 3.8, quelle: BR },
  { schluessel: 'halle_traufriegel_m', gruppe: 'Hallenbau: Stahl und Profile', bezeichnung: 'Traufriegel', einheit: '€/m', wert: 30, quelle: BR },
  { schluessel: 'halle_pfetten_m', gruppe: 'Hallenbau: Stahl und Profile', bezeichnung: 'Pfetten (Z/C-Profil verzinkt)', einheit: '€/m', wert: 25, quelle: BR },
  { schluessel: 'halle_pfettenschuhe_stk', gruppe: 'Hallenbau: Stahl und Profile', bezeichnung: 'Pfettenschuhe', einheit: '€/Stck', wert: 15, quelle: BR },
  { schluessel: 'halle_wandriegel_m', gruppe: 'Hallenbau: Stahl und Profile', bezeichnung: 'Wandriegel (C-Profil verzinkt)', einheit: '€/m', wert: 25, quelle: BR },
  { schluessel: 'halle_fusswinkel_m', gruppe: 'Hallenbau: Stahl und Profile', bezeichnung: 'Fußwinkel', einheit: '€/m', wert: 15, quelle: BR },
  { schluessel: 'halle_klein_grenze_m2', gruppe: 'Hallenbau: Stahl und Profile', bezeichnung: 'Kleinhalle bis Grundfläche', einheit: 'm²', wert: 250, quelle: BR },
  { schluessel: 'halle_klein_zuschlag_prozent', gruppe: 'Hallenbau: Stahl und Profile', bezeichnung: 'Kleinhalle: Mehrpreis auf Riegel, Pfetten, Fußwinkel, Kantteile', einheit: '%', wert: 20, quelle: BR },

  // Hülle
  { schluessel: 'halle_kantteile_m', gruppe: 'Hallenbau: Hülle', bezeichnung: 'Kantteile', einheit: '€/m', wert: 22, quelle: BR },
  { schluessel: 'halle_dachrinne_m', gruppe: 'Hallenbau: Hülle', bezeichnung: 'Dachrinne und Fallrohr', einheit: '€/m', wert: 40, quelle: BR },
  { schluessel: 'halle_vordach_m2', gruppe: 'Hallenbau: Hülle', bezeichnung: 'Vordach komplett mit Trägern', einheit: '€/m²', wert: 200, quelle: BR },
  { schluessel: 'halle_dach_sandwich_m2', gruppe: 'Hallenbau: Hülle', bezeichnung: 'Dacheindeckung Sandwich (DL 100–120) montiert', einheit: '€/m²', wert: 52, quelle: BR },
  { schluessel: 'halle_dach_trapez_m2', gruppe: 'Hallenbau: Hülle', bezeichnung: 'Dacheindeckung Trapezblech mit Vlies montiert', einheit: '€/m²', wert: 35.2, quelle: BR },
  { schluessel: 'halle_wand_sandwich_m2', gruppe: 'Hallenbau: Hülle', bezeichnung: 'Wandverkleidung Sandwich (LL 80–100) montiert', einheit: '€/m²', wert: 52, quelle: BR },
  { schluessel: 'halle_wand_trapez_m2', gruppe: 'Hallenbau: Hülle', bezeichnung: 'Wandverkleidung Trapezblech montiert', einheit: '€/m²', wert: 32, quelle: BR },
  { schluessel: 'halle_profilfueller_m', gruppe: 'Hallenbau: Hülle', bezeichnung: 'Profilfüller (Traufe)', einheit: '€/m', wert: 15, quelle: BR },
  { schluessel: 'halle_buehnen_basis', gruppe: 'Hallenbau: Hülle', bezeichnung: 'Arbeitsbühnen (Steiger): Grundbetrag', einheit: '€', wert: 2500, quelle: BR },
  { schluessel: 'halle_buehnen_m2', gruppe: 'Hallenbau: Hülle', bezeichnung: 'Arbeitsbühnen: je m² Grundfläche', einheit: '€/m²', wert: 2.5, quelle: BR },

  // Öffnungen
  { schluessel: 'halle_tor_stk', gruppe: 'Hallenbau: Öffnungen', bezeichnung: 'Sektionaltor bis 4 × 4 m, Handkette', einheit: '€/Stck', wert: 4800, quelle: BR },
  { schluessel: 'halle_tor_m2_zuschlag', gruppe: 'Hallenbau: Öffnungen', bezeichnung: 'Mehrpreis Tor je m² über 16 m²', einheit: '€/m²', wert: 180, quelle: BR },
  { schluessel: 'halle_torantrieb_stk', gruppe: 'Hallenbau: Öffnungen', bezeichnung: 'Elektrischer Torantrieb', einheit: '€/Stck', wert: 800, quelle: BR },
  { schluessel: 'halle_tuer_stk', gruppe: 'Hallenbau: Öffnungen', bezeichnung: 'Stahlblechtür 1-flg.', einheit: '€/Stck', wert: 1000, quelle: BR },
  { schluessel: 'halle_fenster_stk', gruppe: 'Hallenbau: Öffnungen', bezeichnung: 'Fenster Kunststoff ca. 2,0 × 1,0 m', einheit: '€/Stck', wert: 900, quelle: BR },
  { schluessel: 'halle_ausschnitt_stk', gruppe: 'Hallenbau: Öffnungen', bezeichnung: 'Fenster- und Türausschnitte', einheit: '€/Stck', wert: 100, quelle: BR },
  { schluessel: 'halle_lichtkuppel_stk', gruppe: 'Hallenbau: Öffnungen', bezeichnung: 'Lichtkuppel 1 × 1 m', einheit: '€/Stck', wert: 1250, quelle: BR },
  { schluessel: 'halle_lichtkuppel_rwa_stk', gruppe: 'Hallenbau: Öffnungen', bezeichnung: 'Lichtkuppel als RWA', einheit: '€/Stck', wert: 3460, quelle: BR },
  { schluessel: 'halle_firstlicht_m', gruppe: 'Hallenbau: Öffnungen', bezeichnung: 'Firstlichtband 1,50 m breit inkl. Anschlüsse', einheit: '€/m', wert: 1100, quelle: BR },

  // Nebenleistungen
  { schluessel: 'halle_erd_basis_m2', gruppe: 'Hallenbau: Nebenleistungen', bezeichnung: 'Erdarbeiten, Fundamente, Sohle: Grundpreis', einheit: '€/m²', wert: 100, quelle: BR, notiz: 'Preis je m² = Grundpreis + Größenfaktor / √Fläche' },
  { schluessel: 'halle_erd_faktor', gruppe: 'Hallenbau: Nebenleistungen', bezeichnung: 'Erdarbeiten: Größenfaktor', einheit: '€·m', wert: 2500, quelle: BR },
  { schluessel: 'halle_be_pauschal', gruppe: 'Hallenbau: Nebenleistungen', bezeichnung: 'Baustelleneinrichtung (Netz, Container)', einheit: '€', wert: 2500, quelle: BR },
  { schluessel: 'halle_kran_basis', gruppe: 'Hallenbau: Nebenleistungen', bezeichnung: 'Autokran: Grundbetrag', einheit: '€', wert: 3500, quelle: BR },
  { schluessel: 'halle_kran_t', gruppe: 'Hallenbau: Nebenleistungen', bezeichnung: 'Autokran: je t Stahl', einheit: '€/t', wert: 180, quelle: BR },
  { schluessel: 'halle_statik_pauschal', gruppe: 'Hallenbau: Nebenleistungen', bezeichnung: 'Statik Halle', einheit: '€', wert: 5000, quelle: BR },
  { schluessel: 'halle_werkplanung_pauschal', gruppe: 'Hallenbau: Nebenleistungen', bezeichnung: 'Werkplanung', einheit: '€', wert: 5000, quelle: BR },
  { schluessel: 'halle_bauantrag_pauschal', gruppe: 'Hallenbau: Nebenleistungen', bezeichnung: 'Bauantrag, Brand- und Wärmeschutz', einheit: '€', wert: 8000, quelle: BR },
  { schluessel: 'halle_baugrund_pauschal', gruppe: 'Hallenbau: Nebenleistungen', bezeichnung: 'Baugrundgutachten', einheit: '€', wert: 2500, quelle: BR },
  { schluessel: 'halle_maler_basis', gruppe: 'Hallenbau: Nebenleistungen', bezeichnung: 'Malerarbeiten Stahlbau: Grundbetrag', einheit: '€', wert: 2000, quelle: BR },
  { schluessel: 'halle_maler_t', gruppe: 'Hallenbau: Nebenleistungen', bezeichnung: 'Malerarbeiten Stahlbau: je t Stahl', einheit: '€/t', wert: 120, quelle: BR },
  { schluessel: 'halle_entsorgung_pauschal', gruppe: 'Hallenbau: Nebenleistungen', bezeichnung: 'Entsorgung', einheit: '€', wert: 2000, quelle: BR },
  { schluessel: 'halle_reinigung_pauschal', gruppe: 'Hallenbau: Nebenleistungen', bezeichnung: 'Reinigung', einheit: '€', wert: 1000, quelle: BR },
  { schluessel: 'halle_zuschlag_prozent', gruppe: 'Hallenbau: Nebenleistungen', bezeichnung: 'Zuschlag auf Gesamt netto', einheit: '%', wert: 5, quelle: BR },
  { schluessel: 'halle_rundung', gruppe: 'Hallenbau: Nebenleistungen', bezeichnung: 'Angebotspreis runden auf', einheit: '€', wert: 100, quelle: BR },

  // Ausbau und Gewerke
  { schluessel: 'halle_elektro_basis', gruppe: 'Hallenbau: Ausbau und Gewerke', bezeichnung: 'Elektro Halle: Grundbetrag', einheit: '€', wert: 5000, quelle: BR },
  { schluessel: 'halle_elektro_m2', gruppe: 'Hallenbau: Ausbau und Gewerke', bezeichnung: 'Elektro Halle: je m² Grundfläche', einheit: '€/m²', wert: 25, quelle: BR },
  { schluessel: 'halle_heizung_basis', gruppe: 'Hallenbau: Ausbau und Gewerke', bezeichnung: 'Heizung Halle: Grundbetrag', einheit: '€', wert: 5000, quelle: BR },
  { schluessel: 'halle_heizung_m2', gruppe: 'Hallenbau: Ausbau und Gewerke', bezeichnung: 'Heizung Halle: je m² Grundfläche', einheit: '€/m²', wert: 15, quelle: BR },
  { schluessel: 'halle_buero_m2', gruppe: 'Hallenbau: Ausbau und Gewerke', bezeichnung: 'Büro- und Sozialausbau gem. Extrablatt', einheit: '€/m²', wert: 1000, quelle: BR },
  { schluessel: 'halle_trennwand_m2', gruppe: 'Hallenbau: Ausbau und Gewerke', bezeichnung: 'Hallentrennwand Sandwich', einheit: '€/m²', wert: 85, quelle: BR },
  { schluessel: 'halle_aussenanlagen_m2', gruppe: 'Hallenbau: Ausbau und Gewerke', bezeichnung: 'Außenanlagen (Pflaster)', einheit: '€/m²', wert: 76.6, quelle: BR },
  { schluessel: 'halle_zaun_m', gruppe: 'Hallenbau: Ausbau und Gewerke', bezeichnung: 'Doppelstabmattenzaun', einheit: '€/m', wert: 95, quelle: BR },

  // Geometrie-Regeln
  { schluessel: 'geo_pfettenabstand', gruppe: 'Hallenbau: Geometrie-Regeln', bezeichnung: 'Pfettenabstand (in Dachneigung)', einheit: 'm', wert: 2.2, quelle: BR },
  { schluessel: 'geo_wandriegelabstand', gruppe: 'Hallenbau: Geometrie-Regeln', bezeichnung: 'Wandriegelabstand', einheit: 'm', wert: 2.0, quelle: BR },
  { schluessel: 'geo_fallrohr_abstand', gruppe: 'Hallenbau: Geometrie-Regeln', bezeichnung: 'Ein Fallrohr je angefangene Rinnenlänge', einheit: 'm', wert: 15, quelle: BR },
  { schluessel: 'geo_dach_ueberstand', gruppe: 'Hallenbau: Geometrie-Regeln', bezeichnung: 'Dachüberstand je Traufe', einheit: 'm', wert: 0.25, quelle: BR },
  { schluessel: 'geo_kantteile_faktor', gruppe: 'Hallenbau: Geometrie-Regeln', bezeichnung: 'Kantteile: Zuschlag für Anschlüsse und Überlappungen', einheit: '×', wert: 1.2, quelle: BR },
  { schluessel: 'geo_kg_m2_fallback', gruppe: 'Hallenbau: Geometrie-Regeln', bezeichnung: 'Stahl je m² Grundfläche, wenn keine Referenz passt', einheit: 'kg/m²', wert: 24, quelle: BR },
  { schluessel: 'geo_kran_kg_m2', gruppe: 'Hallenbau: Geometrie-Regeln', bezeichnung: 'Mehrgewicht Kranbahn und Konsolen', einheit: 'kg/m²', wert: 9, quelle: BR },
  { schluessel: 'geo_spannweite_hinweis', gruppe: 'Hallenbau: Geometrie-Regeln', bezeichnung: 'Ab dieser Spannweite Fachwerk oder Mittelstütze prüfen', einheit: 'm', wert: 30, quelle: BR },

  // Stahlbau nach Gewicht (LV-Positionen)
  { schluessel: 'kg_fertigung_h_0_300', gruppe: 'Stahlbau nach Gewicht', bezeichnung: 'Fertigung bis 300 kg je Position', einheit: 'h/100 kg', wert: 2.55, quelle: BR },
  { schluessel: 'kg_fertigung_h_300_1000', gruppe: 'Stahlbau nach Gewicht', bezeichnung: 'Fertigung 300 bis 1.000 kg', einheit: 'h/100 kg', wert: 2.15, quelle: BR },
  { schluessel: 'kg_fertigung_h_1000_3000', gruppe: 'Stahlbau nach Gewicht', bezeichnung: 'Fertigung 1 bis 3 t', einheit: 'h/100 kg', wert: 2.05, quelle: BR },
  { schluessel: 'kg_fertigung_h_3000_10000', gruppe: 'Stahlbau nach Gewicht', bezeichnung: 'Fertigung 3 bis 10 t', einheit: 'h/100 kg', wert: 1.95, quelle: BR },
  { schluessel: 'kg_fertigung_h_ueber_10000', gruppe: 'Stahlbau nach Gewicht', bezeichnung: 'Fertigung über 10 t', einheit: 'h/100 kg', wert: 2.0, quelle: BR },
  { schluessel: 'kg_blech_faktor', gruppe: 'Stahlbau nach Gewicht', bezeichnung: 'Aufwand Bleche, Riffelblech und Beläge im Verhältnis zu Profilen', einheit: '×', wert: 0.65, quelle: BR },
  { schluessel: 'kg_montage_faktor', gruppe: 'Stahlbau nach Gewicht', bezeichnung: 'Montagezeit im Verhältnis zur Fertigung', einheit: '×', wert: 0.65, quelle: BR },
  { schluessel: 'kg_montage_faktor_bestand', gruppe: 'Stahlbau nach Gewicht', bezeichnung: 'Montagezeit im Verhältnis zur Fertigung bei Arbeiten am Bestand', einheit: '×', wert: 2.1, quelle: BR },
  { schluessel: 'kg_kran_t', gruppe: 'Stahlbau nach Gewicht', bezeichnung: 'Kran je t, wenn keine BE-Position', einheit: '€/t', wert: 180, quelle: BR },

  // Geländer
  { schluessel: 'gel_h_m_cluster1', gruppe: 'Geländer', bezeichnung: 'Herstellung und Montage Aufwand 1 (einfach)', einheit: 'h/m', wert: 3.8, quelle: BR },
  { schluessel: 'gel_h_m_cluster2', gruppe: 'Geländer', bezeichnung: 'Herstellung und Montage Aufwand 2 (mittel)', einheit: 'h/m', wert: 4.5, quelle: BR },
  { schluessel: 'gel_h_m_cluster3', gruppe: 'Geländer', bezeichnung: 'Herstellung und Montage Aufwand 3 (aufwendig)', einheit: 'h/m', wert: 6.0, quelle: BR },
  { schluessel: 'gel_cluster3_schweiss_m', gruppe: 'Geländer', bezeichnung: 'Aufwand 3 ab Schweißnaht je lfm Geländer', einheit: 'm/m', wert: 3, quelle: BR },
  { schluessel: 'gel_cluster2_schweiss_m', gruppe: 'Geländer', bezeichnung: 'Aufwand 2 ab Schweißnaht je lfm Geländer', einheit: 'm/m', wert: 1.5, quelle: BR },
  { schluessel: 'gel_edelstahl_handlauf_m', gruppe: 'Geländer', bezeichnung: 'Edelstahl-Handlauf Material', einheit: '€/m', wert: 38, quelle: BR },
  { schluessel: 'gel_edelstahl_h_m', gruppe: 'Geländer', bezeichnung: 'Edelstahl-Handlauf Mehraufwand', einheit: 'h/m', wert: 1.0, quelle: BR },

  // Treppen
  { schluessel: 'tr_gitterrost_stufe_stk', gruppe: 'Treppen', bezeichnung: 'Gitterroststufe bis 1.000 mm, verzinkt (Kaufteil)', einheit: '€/Stck', wert: 65, quelle: BR },
  { schluessel: 'tr_gitterrost_stufe_breit_stk', gruppe: 'Treppen', bezeichnung: 'Gitterroststufe 1.000 bis 1.500 mm (Kaufteil)', einheit: '€/Stck', wert: 92, quelle: BR },
  { schluessel: 'tr_gitterrost_m2', gruppe: 'Treppen', bezeichnung: 'Gitterrost Podest (Kaufteil)', einheit: '€/m²', wert: 120, quelle: BR },
  { schluessel: 'gr_montage_h_m2', gruppe: 'Treppen', bezeichnung: 'Montage Gitterrost je m²', einheit: 'h/m²', wert: 0.9, quelle: BR },
  { schluessel: 'tr_grund_h', gruppe: 'Treppen', bezeichnung: 'Grundaufwand je Treppe (Anschlüsse, Ausrichten, Transport)', einheit: 'h', wert: 4, quelle: BR },
  { schluessel: 'tr_grund_h_je_m', gruppe: 'Treppen', bezeichnung: 'Grundaufwand je Meter Geschosshöhe (Podeste, Stützen, Montage in der Höhe)', einheit: 'h/m', wert: 2.5, quelle: BR },
  { schluessel: 'tr_h_je_stufe', gruppe: 'Treppen', bezeichnung: 'Aufwand je Stufe (anschrauben, ausrichten)', einheit: 'h/Stufe', wert: 0.8, quelle: BR },

  // Lernen aus Korrekturen: startet bei 1,0. Die Anwendung schlägt Änderungen vor, wenn Sie Preise einer Art wiederholt in dieselbe Richtung korrigieren.
  { schluessel: 'faktor_baugruppe', gruppe: 'Lernen aus Korrekturen', bezeichnung: 'Erfahrungsfaktor Baugruppen nach Zeichnung', einheit: '×', wert: 1, quelle: 'Startwert, Vorschläge aus Ihren Korrekturen' },
  { schluessel: 'faktor_stahl_kg', gruppe: 'Lernen aus Korrekturen', bezeichnung: 'Erfahrungsfaktor Stahl nach Gewicht', einheit: '×', wert: 1, quelle: 'Startwert, Vorschläge aus Ihren Korrekturen' },
  { schluessel: 'faktor_gelaender_m', gruppe: 'Lernen aus Korrekturen', bezeichnung: 'Erfahrungsfaktor Geländer', einheit: '×', wert: 1, quelle: 'Startwert, Vorschläge aus Ihren Korrekturen' },
  { schluessel: 'faktor_treppe_stk', gruppe: 'Lernen aus Korrekturen', bezeichnung: 'Erfahrungsfaktor Treppen', einheit: '×', wert: 1, quelle: 'Startwert, Vorschläge aus Ihren Korrekturen' },
  { schluessel: 'faktor_gitterrost_m2', gruppe: 'Lernen aus Korrekturen', bezeichnung: 'Erfahrungsfaktor Gitterroste', einheit: '×', wert: 1, quelle: 'Startwert, Vorschläge aus Ihren Korrekturen' },
  { schluessel: 'faktor_stunden', gruppe: 'Lernen aus Korrekturen', bezeichnung: 'Erfahrungsfaktor Arbeiten nach Aufwand', einheit: '×', wert: 1, quelle: 'Startwert, Vorschläge aus Ihren Korrekturen' },
];

export function defaultStammdaten(): Stammdaten {
  return Object.fromEntries(STAMMDATEN_DEFS.map((d) => [d.schluessel, d.wert]));
}

export function sd(stamm: Stammdaten, key: string): number {
  const v = stamm[key];
  if (v === undefined || v === null || Number.isNaN(v)) {
    const def = STAMMDATEN_DEFS.find((d) => d.schluessel === key);
    return def ? def.wert : 0;
  }
  return v;
}
