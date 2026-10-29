import { sd, type Stammdaten } from './stammdaten';
import { zuschlagskalkulation } from './zeichnung';
import { summen, zaehlt, type Position } from '@/components/positionen/typen';

export const LOSGROESSEN = [1, 10, 50];

/**
 * Losgrößen-Staffel für Serienteile nach Zeichnung. Der kalkulierte Preis gilt für einen Satz.
 * Rüsten und Programmieren (Stammdaten zg_ruesten_h je gefertigter Zeichnung) fällt einmal je Los an
 * und verteilt sich bei größeren Losen auf alle Sätze.
 */
export function losStaffel(pos: Position[], stamm: Stammdaten) {
  const gefertigt = pos.filter((p) => zaehlt(p) && (p.ansatz?.art === 'baugruppe' || p.ansatz?.art === 'stahl_kg')).length;
  const satz = summen(pos).gesamt;
  if (!gefertigt || satz <= 0) return null;
  const stunden = sd(stamm, 'zg_ruesten_h') * gefertigt;
  // Nie mehr als gut die Hälfte des Satzpreises als Rüstanteil, sonst stimmt die Kalkulation nicht
  const ruesten = Math.min(satz * 0.6, zuschlagskalkulation(0, stunden * sd(stamm, 'ks_schlosser'), 0, stamm).zvp);
  return { stunden, ruesten, zeilen: LOSGROESSEN.map((n) => ({ n, jeSatz: Math.round((satz - ruesten + ruesten / n) * 100) / 100 })) };
}
