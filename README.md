# AIM · Beispielbetrieb (Vorführinstanz)

Vorführinstanz von AIM mit einem ausgedachten Beispielbetrieb (toolwerk, eine Marke der Grünberg Solutions GmbH).

Baukasten: gleicher Code wie jede Kundeninstanz, eigene Datenbank (Frankfurt), eigenes Hosting-Projekt. Keine Kundendaten.

## Module
- **Nach Zeichnung**: Werkstattzeichnungen (PDF, Scan, Foto) lesen, Stückliste und Fertigungsmerkmale erkennen, Preis über Kostenstellen und Zuschlagskalkulation (MEK, MGK, FEK, FGK, Fremdleistung, VwGK, VtGK, Gewinn, Skonto).
- **Hallenbau**: digitaler Vordruck "Kalkulation Hallenbau" mit Geometrie, Stahlgewicht aus Referenzhallen, Angebot mit Baubeschreibung.
- **Ausschreibung**: LV als GAEB (X83) oder PDF lesen, KI-Vorschlag je Position, deterministische Preisformel, Prüfmaske, Export Excel, PDF, GAEB X84.
- **Treppe · Geländer · Stahlbau**: Einzelbauteile nach den Faustformeln des Betriebs.
- **Stammdaten**, **Referenzen**, **Datenexport**.

## Entwicklung
```
pnpm install
pnpm dev
pnpm test
```
Umgebungsvariablen: siehe `.env.example`.

Schema: `supabase/migrations`, Stammdaten: `node --import tsx scripts/stammdaten-sql.ts`, Beispielzeichnungen: `python3 scripts/beispielzeichnungen.py`.
