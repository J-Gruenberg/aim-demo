/**
 * Löschen oder archivieren: Was einmal geprüft, freigegeben oder abgegeben war (oder einen Ausgang hat),
 * liefert Preise für das Preisarchiv und wird deshalb nur archiviert. Entwürfe mit offenem Ausgang dürfen weg.
 * Gilt in der Oberfläche und in der API gleich.
 */
export type ProjektZustand = { status: string; ergebnis_label?: string | null };

export function darfLoeschen(p: ProjektZustand): boolean {
  return p.status === 'entwurf' && (p.ergebnis_label ?? 'offen') === 'offen';
}

export const NUR_ARCHIVIEREN =
  'Diese Kalkulation war schon in Prüfung, ist freigegeben, abgegeben oder hat einen Ausgang. Sie kann nur archiviert werden, damit ihre Preise im Archiv bleiben.';
