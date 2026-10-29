/** Pfad des Vorschaubilds zu einer hochgeladenen Zeichnung (liegt neben der Datei im Speicher). Blatt 1 behält den alten Namen. */
export const vorschauPfad = (pfad: string, seite = 1) => (seite > 1 ? `${pfad}.s${seite}.vorschau.jpg` : `${pfad}.vorschau.jpg`);
