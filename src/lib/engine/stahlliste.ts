/**
 * Stahlliste wie auf einem Hallen-Kalkulationsblatt: Hauptrahmen (Stiele + Riegel), Giebelrahmen,
 * Verbände (Rohr), Rundstahl-Kreuze, plus 10 % Kleinteile. Ergibt die Tonnage für "Stahlbau".
 * Pfetten, Wandriegel und Traufriegel sind NICHT enthalten (eigene Zeilen im Vordruck).
 *
 * Profilwahl nach Spannweite (Richtwerte, die Statik entscheidet):
 *   bis 10 m IPE 400 / IPE 400 · 16 m IPE 500 / IPE 360 · 17,5 bis 21 m IPE 500 / IPE 400 · ab 27 m IPE 600 / IPE 500
 */
import { WALZPROFILE } from './profile';
import { sd, type Stammdaten } from './stammdaten';

export type StahlPosition = { text: string; profil: string; meter: number; kg_m: number; kg: number };

export type Stahlliste = {
  positionen: StahlPosition[];
  summe_kg: number;
  kleinteile_prozent: number;
  gesamt_kg: number;
  hauptrahmen: number;
  giebelrahmen: number;
  hinweise: string[];
};

type Eingabe = {
  laenge: number;
  breite: number;
  traufhoehe: number;
  dachform: 'satteldach' | 'pultdach';
  neigung: number;
  rahmenabstand: number;
  giebelrahmen?: number;
};

const IPE = ['IPE 300', 'IPE 330', 'IPE 360', 'IPE 400', 'IPE 450', 'IPE 500', 'IPE 550', 'IPE 600'];

function stufe(liste: string[], basis: string, plus: number) {
  const i = liste.indexOf(basis);
  return liste[Math.min(liste.length - 1, Math.max(0, i + plus))];
}

/** Stiel- und Riegelprofil je Spannweite, Stiel bei hohen Hallen eine bzw. zwei Stufen stärker. */
export function rahmenProfile(breite: number, traufhoehe: number) {
  let stiel: string;
  let riegel: string;
  if (breite <= 10) [stiel, riegel] = ['IPE 400', 'IPE 400'];
  else if (breite <= 16) [stiel, riegel] = ['IPE 500', 'IPE 360'];
  else if (breite <= 21) [stiel, riegel] = ['IPE 500', 'IPE 400'];
  else if (breite <= 24) [stiel, riegel] = ['IPE 550', 'IPE 450'];
  else [stiel, riegel] = ['IPE 600', 'IPE 500'];
  const plus = traufhoehe > 7.5 ? 2 : traufhoehe > 6.5 ? 1 : 0;
  stiel = stufe(IPE, stiel, plus);
  const giebel = breite <= 21 && traufhoehe <= 5.5 ? 'HEA 160' : breite <= 24 && traufhoehe <= 6.5 ? 'HEA 180' : 'HEA 220';
  return { stiel, riegel, giebel };
}

const r1 = (v: number) => Math.round(v * 10) / 10;

export function stahlliste(e: Eingabe, stamm: Stammdaten): Stahlliste {
  const L = Math.max(e.laenge, 0);
  const B = Math.max(e.breite, 0);
  const H = Math.max(e.traufhoehe, 0);
  const a = (Math.min(Math.max(e.neigung || 0, 0), 45) * Math.PI) / 180;
  const sattel = e.dachform === 'satteldach';
  const H2 = sattel ? H : H + B * Math.tan(a); // hohe Seite beim Pultdach
  const first = sattel ? H + (B / 2) * Math.tan(a) : (H + H2) / 2;
  const felder = Math.max(1, Math.ceil(L / Math.max(e.rahmenabstand || 6, 1)));
  const rahmen = felder + 1;
  const gr = Math.min(Math.max(e.giebelrahmen ?? 2, 0), 2);
  const hr = Math.max(rahmen - gr, 1);
  const p = rahmenProfile(B, H);
  const hinweise: string[] = [];

  const stuetzen_je_giebel = Math.max(0, Math.ceil(B / 6) - 1);
  const giebel_m = B + H + H2 + stuetzen_je_giebel * (sattel ? (H + 2 * first) / 3 : first);
  const rohr_m = 1.2 * L;
  const rund_m = 150 + 1.5 * L;

  const pos = (text: string, profil: string, meter: number, kg_m?: number): StahlPosition => {
    // Gerechnet wird mit aufgerundeten Metergewichten (IPE 500: 93 statt 90,7 kg/m)
    const g = r1((kg_m ?? WALZPROFILE[profil] ?? 0) * (kg_m ? 1 : 1.03));
    return { text, profil, meter: r1(meter), kg_m: g, kg: Math.round(meter * g) };
  };

  const positionen: StahlPosition[] = [
    pos(`Stiele ${hr} Hauptrahmen`, p.stiel, hr * (H + H2)),
    pos(`Riegel ${hr} Hauptrahmen`, p.riegel, hr * B),
  ];
  if (gr > 0) positionen.push(pos(`${gr} Giebelrahmen mit ${stuetzen_je_giebel} Giebelstützen`, p.giebel, gr * giebel_m));
  positionen.push(pos('Verbände Rohr', 'Rohr', rohr_m, 12.5));
  positionen.push(pos('Rundstahl-Kreuze mit Spannschlössern', B > 20 ? 'Rd 24' : 'Rd 20', rund_m, 3.5));

  const summe_kg = positionen.reduce((s, x) => s + x.kg, 0);
  const kleinteile_prozent = sd(stamm, 'kleinteile_prozent');
  const gesamt_kg = Math.ceil((summe_kg * (1 + kleinteile_prozent / 100)) / 100) * 100;

  if (e.rahmenabstand > 7.5) hinweise.push('Rahmenabstand über 7,5 m: Pfetten und Riegel werden schwerer.');

  return { positionen, summe_kg, kleinteile_prozent, gesamt_kg, hauptrahmen: hr, giebelrahmen: gr, hinweise };
}
