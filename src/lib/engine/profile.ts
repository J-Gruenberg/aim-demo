/** Metergewichte gängiger Stahlprofile (kg/m) nach EN-Tabellen. */
export const WALZPROFILE: Record<string, number> = {
  'IPE 80': 6.0, 'IPE 100': 8.1, 'IPE 120': 10.4, 'IPE 140': 12.9, 'IPE 160': 15.8, 'IPE 180': 18.8, 'IPE 200': 22.4, 'IPE 220': 26.2,
  'IPE 240': 30.7, 'IPE 270': 36.1, 'IPE 300': 42.2, 'IPE 330': 49.1, 'IPE 360': 57.1, 'IPE 400': 66.3, 'IPE 450': 77.6, 'IPE 500': 90.7,
  'IPE 550': 106, 'IPE 600': 122,
  'HEA 100': 16.7, 'HEA 120': 19.9, 'HEA 140': 24.7, 'HEA 160': 30.4, 'HEA 180': 35.5, 'HEA 200': 42.3, 'HEA 220': 50.5, 'HEA 240': 60.3,
  'HEA 260': 68.2, 'HEA 280': 76.4, 'HEA 300': 88.3, 'HEA 320': 97.6, 'HEA 340': 105, 'HEA 360': 112, 'HEA 400': 125, 'HEA 450': 140,
  'HEA 500': 155, 'HEA 550': 166, 'HEA 600': 178,
  'HEB 100': 20.4, 'HEB 120': 26.7, 'HEB 140': 33.7, 'HEB 160': 42.6, 'HEB 180': 51.2, 'HEB 200': 61.3, 'HEB 220': 71.5, 'HEB 240': 83.2,
  'HEB 260': 93.0, 'HEB 280': 103, 'HEB 300': 117, 'HEB 320': 127, 'HEB 340': 134, 'HEB 360': 142, 'HEB 400': 155, 'HEB 450': 171,
  'HEB 500': 187, 'HEB 550': 199, 'HEB 600': 212,
  'UPN 80': 8.64, 'UPN 100': 10.6, 'UPN 120': 13.4, 'UPN 140': 16.0, 'UPN 160': 18.8, 'UPN 180': 22.0, 'UPN 200': 25.3, 'UPN 220': 29.4,
  'UPN 240': 33.2, 'UPN 260': 37.9, 'UPN 280': 41.8, 'UPN 300': 46.2,
  'UPE 80': 7.9, 'UPE 100': 9.82, 'UPE 120': 12.1, 'UPE 140': 14.5, 'UPE 160': 17.0, 'UPE 180': 19.7, 'UPE 200': 22.8, 'UPE 220': 26.6,
  'UPE 240': 30.2, 'UPE 270': 35.2, 'UPE 300': 44.4, 'UPE 330': 53.2, 'UPE 360': 61.2, 'UPE 400': 72.2,
  'HEM 100': 41.8, 'HEM 120': 52.1, 'HEM 140': 63.2, 'HEM 160': 76.2, 'HEM 180': 88.9, 'HEM 200': 103, 'HEM 220': 117, 'HEM 240': 157,
  'HEM 260': 172, 'HEM 280': 189, 'HEM 300': 238, 'HEM 320': 245, 'HEM 340': 248, 'HEM 360': 250, 'HEM 400': 256, 'HEM 450': 263, 'HEM 500': 270,
  'L 40x4': 2.42, 'L 50x5': 3.77, 'L 60x6': 5.42, 'L 70x7': 7.38, 'L 80x8': 9.63, 'L 100x10': 15.0, 'L 120x12': 21.6,
};

const RHO = 0.00785; // kg je mm² je m

export function flachKgM(b: number, t: number) {
  return b * t * RHO;
}
export function rundKgM(d: number) {
  return (Math.PI / 4) * d * d * RHO;
}
export function rohrRundKgM(d: number, t: number) {
  return Math.PI * (d - t) * t * RHO;
}
export function rohrQuadratKgM(a: number, b: number, t: number) {
  return (2 * (a + b) - 4 * t) * t * RHO;
}

/** Erkennt Profilangaben wie "IPE 200", "HEA200", "Fl 60x10", "Flach 70 x 10", "Rd 12", "Rohr 42,4x2,6", "QR 40x40x3". */
export function metergewicht(bezeichnung: string): number | null {
  const s = bezeichnung.toUpperCase().replace(/,/g, '.').replace(/\s+/g, ' ').trim();
  let m = s.match(/\b(IPE|HEA|HEB|HEM|UPE|UPN|U)\s?(\d{2,3})\b/);
  if (m) {
    const key = `${m[1] === 'U' ? 'UPN' : m[1]} ${m[2]}`;
    return WALZPROFILE[key] ?? null;
  }
  m = s.match(/\bL\s?(\d{2,3})\s?[X×]\s?(\d{1,2})\b/);
  if (m) {
    const key = `L ${m[1]}x${m[2]}`;
    if (WALZPROFILE[key]) return WALZPROFILE[key];
    const a = Number(m[1]);
    const t = Number(m[2]);
    return (2 * a - t) * t * RHO;
  }
  m = s.match(/\b(QRO|QR|QRR|VKT|ROHR\s?QUADRAT|RRO|RR)\s?(\d{2,3}(?:\.\d)?)\s?[X×/]\s?(\d{2,3}(?:\.\d)?)\s?[X×/]\s?(\d{1,2}(?:\.\d)?)/);
  if (m) return rohrQuadratKgM(Number(m[2]), Number(m[3]), Number(m[4]));
  // Quadratrohr mit Kantenlänge und Wanddicke, z. B. "QRo 180x8"
  m = s.match(/\b(QRO|QR|VKT)\s?(\d{2,3}(?:\.\d)?)\s?[X×]\s?(\d{1,2}(?:\.\d)?)\b(?!\s?[X×])/);
  if (m) return rohrQuadratKgM(Number(m[2]), Number(m[2]), Number(m[3]));
  m = s.match(/\b(ROHR|RO|RD-ROHR)\s?[Ø]?\s?(\d{2,3}(?:\.\d)?)\s?[X×]\s?(\d{1,2}(?:\.\d)?)/);
  if (m) return rohrRundKgM(Number(m[2]), Number(m[3]));
  m = s.match(/\b(FL|FLACH|FLA|FLACHSTAHL|BL)\s?(\d{2,3})\s?[X×]\s?(\d{1,2})\b/);
  if (m) return flachKgM(Number(m[2]), Number(m[3]));
  m = s.match(/\b(RD|RUND|RUNDSTAHL)\s?(\d{1,2})\b/);
  if (m) return rundKgM(Number(m[2]));
  return null;
}
