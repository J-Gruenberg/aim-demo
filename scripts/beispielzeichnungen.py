"""
Erzeugt fiktive Werkstattzeichnungen (A3 quer) für die Vorführung von AIM.
Alle Inhalte sind ausgedacht, kein Kundenbezug. Ausgabe: public/beispiele/*.pdf

Aufruf: python3 scripts/beispielzeichnungen.py
"""
from reportlab.lib.pagesizes import A3, landscape
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
import os

RHO = 7.85e-6  # kg je mm³
W, H = landscape(A3)
AUS = os.path.join(os.path.dirname(__file__), '..', 'public', 'beispiele')
os.makedirs(AUS, exist_ok=True)

FIRMA = 'Beispiel Metallbau GmbH'
PROJEKT = 'Lagererweiterung Musterstadt, Halle 3'


def blech(t, b, l, stk=1):
    return round(t * b * l * RHO * stk, 2)


def rahmen(c, nr, titel, massstab, gewicht, blatt):
    c.setLineWidth(1.2)
    c.rect(10 * mm, 10 * mm, W - 20 * mm, H - 20 * mm)
    # Schriftfeld unten rechts
    x0, y0, bw, bh = W - 190 * mm, 10 * mm, 180 * mm, 42 * mm
    c.setLineWidth(0.8)
    c.rect(x0, y0, bw, bh)
    for dy in (10, 20, 30):
        c.line(x0, y0 + dy * mm, x0 + bw, y0 + dy * mm)
    c.line(x0 + 110 * mm, y0, x0 + 110 * mm, y0 + 30 * mm)
    c.setFont('Helvetica-Bold', 11)
    c.drawString(x0 + 3 * mm, y0 + 33 * mm, FIRMA)
    c.setFont('Helvetica', 7)
    c.drawString(x0 + 120 * mm, y0 + 36 * mm, 'Beispielzeichnung, fiktiv')
    c.drawString(x0 + 120 * mm, y0 + 32.5 * mm, 'nur zur Vorführung von AIM')
    c.setFont('Helvetica', 7)
    c.drawString(x0 + 3 * mm, y0 + 26.5 * mm, 'Projekt')
    c.drawString(x0 + 3 * mm, y0 + 16.5 * mm, 'Benennung')
    c.drawString(x0 + 3 * mm, y0 + 6.5 * mm, 'Zeichnungsnummer')
    c.drawString(x0 + 113 * mm, y0 + 26.5 * mm, 'Maßstab')
    c.drawString(x0 + 113 * mm, y0 + 16.5 * mm, 'Gewicht')
    c.drawString(x0 + 113 * mm, y0 + 6.5 * mm, 'Blatt')
    c.setFont('Helvetica-Bold', 9)
    c.drawString(x0 + 30 * mm, y0 + 23 * mm, PROJEKT)
    c.drawString(x0 + 30 * mm, y0 + 13 * mm, titel)
    c.drawString(x0 + 30 * mm, y0 + 3 * mm, nr)
    c.drawString(x0 + 135 * mm, y0 + 23 * mm, massstab)
    c.drawString(x0 + 135 * mm, y0 + 13 * mm, f'{gewicht:.2f} kg'.replace('.', ','))
    c.drawString(x0 + 135 * mm, y0 + 3 * mm, blatt)


def stueckliste(c, zeilen, anzahl_bg, pos_bg):
    x0 = W - 190 * mm
    y = 56 * mm
    spalten = [('Pos', 16), ('Stk', 10), ('Benennung', 34), ('Profil', 42), ('Werkstoff', 24), ('Länge', 18), ('Gewicht kg', 36)]
    hz = 6 * mm
    n = len(zeilen) + 2
    c.setLineWidth(0.6)
    c.rect(x0, y, 180 * mm, n * hz)
    c.setFont('Helvetica-Bold', 8)
    c.drawString(x0 + 2 * mm, y + (n - 1) * hz + 1.8 * mm, f'Stückliste Position {pos_bg}   ({anzahl_bg} Stück)')
    xs = [x0]
    for _, b in spalten:
        xs.append(xs[-1] + b * mm)
    yk = y + (n - 2) * hz
    for (t, _), xx in zip(spalten, xs):
        c.drawString(xx + 1.5 * mm, yk + 1.8 * mm, t)
    c.line(x0, yk, x0 + 180 * mm, yk)
    c.line(x0, yk + hz, x0 + 180 * mm, yk + hz)
    c.setFont('Helvetica', 8)
    summe = 0
    for i, z in enumerate(zeilen):
        yy = yk - (i + 1) * hz
        c.line(x0, yy, x0 + 180 * mm, yy)
        werte = [z[0], str(z[1]), z[2], z[3], z[4], str(z[5]), f'{z[6]:.2f}'.replace('.', ',')]
        for w, xx in zip(werte, xs):
            c.drawString(xx + 1.5 * mm, yy + 1.8 * mm, w)
        summe += z[6]
    for xx in xs[1:-1]:
        c.line(xx, y, xx, yk + hz)
    return round(summe, 2)


def mass(c, x1, y1, x2, y2, text, versatz=8):
    c.setLineWidth(0.3)
    if y1 == y2:
        yy = y1 - versatz * mm
        c.line(x1, y1, x1, yy - 1.5 * mm)
        c.line(x2, y2, x2, yy - 1.5 * mm)
        c.line(x1, yy, x2, yy)
        c.setFont('Helvetica', 7)
        c.drawCentredString((x1 + x2) / 2, yy + 1 * mm, text)
    else:
        xx = x1 - versatz * mm
        c.line(x1, y1, xx - 1.5 * mm, y1)
        c.line(x2, y2, xx - 1.5 * mm, y2)
        c.line(xx, y1, xx, y2)
        c.saveState()
        c.translate(xx - 1 * mm, (y1 + y2) / 2)
        c.rotate(90)
        c.setFont('Helvetica', 7)
        c.drawCentredString(0, 0, text)
        c.restoreState()


def hinweise(c, zeilen):
    c.setFont('Helvetica-Bold', 8)
    c.drawString(20 * mm, 50 * mm, 'Hinweise')
    c.setFont('Helvetica', 8)
    for i, z in enumerate(zeilen):
        c.drawString(20 * mm, (45 - i * 4.5) * mm, z)


def stuetze():
    nr, pos, anzahl = 'BSP-101', 'S1', 4
    L = 4200
    z = [
        ('S1', 1, 'Stütze', 'HEB200', 'S355J2', L, round(61.3 * L / 1000, 2)),
        ('1', 1, 'Fußplatte', 'BL20*300*300', 'S355J2', 300, blech(20, 300, 300)),
        ('2', 1, 'Kopfplatte', 'BL15*250*250', 'S355J2', 250, blech(15, 250, 250)),
        ('3', 4, 'Steife', 'BL10*90*180', 'S355J2', 180, blech(10, 90, 180, 4)),
    ]
    c = canvas.Canvas(os.path.join(AUS, 'Beispiel_BSP-101_Stuetze_S1.pdf'), pagesize=landscape(A3))
    c.setTitle('BSP-101 Stütze S1')
    g = round(sum(x[6] for x in z), 2)
    rahmen(c, nr, 'Stütze HEB 200 mit Fuß- und Kopfplatte', '1:15', g, '1 / 1')
    stueckliste(c, z, anzahl, pos)
    # Ansicht: liegende Stütze
    sx = 0.055 * mm  # 1:18 auf dem Blatt
    x0, y0 = 40 * mm, 160 * mm
    hl, hh = L * sx, 200 * sx * 3
    c.setLineWidth(1)
    c.rect(x0, y0, hl, hh)
    c.line(x0, y0 + hh * 0.08, x0 + hl, y0 + hh * 0.08)
    c.line(x0, y0 + hh * 0.92, x0 + hl, y0 + hh * 0.92)
    c.rect(x0 - 20 * 0.055 * mm * 3, y0 - 50 * sx, 20 * sx * 3, hh + 100 * sx)
    c.rect(x0 + hl, y0 - 25 * sx, 15 * sx * 3, hh + 50 * sx)
    for k in (0.25, 0.75):
        c.line(x0 + 30 * sx, y0 + hh * k, x0 + 30 * sx, y0 + hh * k)
    mass(c, x0, y0, x0 + hl, y0, '4200', versatz=14)
    mass(c, x0, y0, x0, y0 + hh, '200', versatz=12)
    c.setFont('Helvetica', 8)
    c.drawString(x0, y0 + hh + 18 * mm, f'Position {pos}   {anzahl} Stück gleich')
    c.drawString(x0 - 4 * mm, y0 - 30 * mm, 'Fußplatte: 4x Ø26 (Anker M24), Lochabstand 200 x 200')
    c.drawString(x0 + hl - 30 * mm, y0 + hh + 8 * mm, 'Kopfplatte: 4x Ø22 für M20')
    c.drawString(x0 + 20 * mm, y0 + hh + 8 * mm, 'Fußplatte HV-Naht umlaufend, Kopfplatte a5 umlaufend')
    c.drawString(x0 + 20 * mm, y0 - 22 * mm, '4 Steifen am Fuß, beidseitig a4')
    hinweise(c, [
        'Ausführungsklasse EXC2 nach DIN EN 1090-2, Werkstoff S355J2+N',
        'Schweißnähte MAG 135, nicht bemaßte Kehlnähte a = 4 mm',
        'Oberfläche: feuerverzinkt nach DIN EN ISO 1461',
        'Allgemeintoleranzen DIN EN 1090-2, Toleranzklasse 1',
    ])
    c.showPage()
    c.save()
    return g


def traeger():
    nr, pos, anzahl = 'BSP-102', 'T1', 3
    L = 6000
    z = [
        ('T1', 1, 'Träger', 'IPE300', 'S235JR', L - 40, round(42.2 * (L - 40) / 1000, 2)),
        ('1', 2, 'Stirnplatte', 'BL20*150*400', 'S235JR', 400, blech(20, 150, 400, 2)),
        ('2', 2, 'Steife', 'BL10*65*280', 'S235JR', 280, blech(10, 65, 280, 2)),
    ]
    c = canvas.Canvas(os.path.join(AUS, 'Beispiel_BSP-102_Traeger_T1.pdf'), pagesize=landscape(A3))
    c.setTitle('BSP-102 Träger T1')
    g = round(sum(x[6] for x in z), 2)
    rahmen(c, nr, 'Träger IPE 300 mit Stirnplatten', '1:20', g, '1 / 1')
    stueckliste(c, z, anzahl, pos)
    sx = 0.045 * mm
    x0, y0 = 35 * mm, 165 * mm
    hl, hh = L * sx, 300 * sx * 2.2
    c.setLineWidth(1)
    c.rect(x0, y0, hl, hh)
    c.line(x0, y0 + hh * 0.07, x0 + hl, y0 + hh * 0.07)
    c.line(x0, y0 + hh * 0.93, x0 + hl, y0 + hh * 0.93)
    c.rect(x0 - 20 * sx * 2.2, y0 - 50 * sx, 20 * sx * 2.2, hh + 100 * sx)
    c.rect(x0 + hl, y0 - 50 * sx, 20 * sx * 2.2, hh + 100 * sx)
    c.line(x0 + hl / 2, y0, x0 + hl / 2, y0 + hh)
    mass(c, x0, y0, x0 + hl, y0, '6000', versatz=14)
    mass(c, x0, y0, x0, y0 + hh, '300', versatz=12)
    c.setFont('Helvetica', 8)
    c.drawString(x0, y0 + hh + 18 * mm, f'Position {pos}   {anzahl} Stück gleich')
    c.drawString(x0, y0 + hh + 8 * mm, 'Stirnplatten je 6x Ø22 für HV M20, beidseitig, Steife mittig')
    c.drawString(x0, y0 - 28 * mm, 'Stirnplatten: Flansche HV-Naht, Steg a4 beidseitig; Steife a3 umlaufend')
    hinweise(c, [
        'Ausführungsklasse EXC2 nach DIN EN 1090-2, Werkstoff S235JR',
        'Korrosionsschutz: strahlen Sa 2 1/2, Grund- und Deckbeschichtung 160 µm',
        'Schweißnähte MAG 135',
    ])
    c.showPage()
    c.save()
    return g


def konsole():
    nr, pos, anzahl = 'BSP-103', 'K1', 6
    z = [
        ('K1', 1, 'Kragarm', 'HEA160', 'S235JR', 600, round(30.4 * 0.6, 2)),
        ('1', 1, 'Ankerplatte', 'BL20*250*350', 'S235JR', 350, blech(20, 250, 350)),
        ('2', 2, 'Steife', 'BL10*70*140', 'S235JR', 140, blech(10, 70, 140, 2)),
        ('3', 1, 'Auflagerblech', 'BL12*160*200', 'S235JR', 200, blech(12, 160, 200)),
    ]
    c = canvas.Canvas(os.path.join(AUS, 'Beispiel_BSP-103_Konsole_K1.pdf'), pagesize=landscape(A3))
    c.setTitle('BSP-103 Konsole K1')
    g = round(sum(x[6] for x in z), 2)
    rahmen(c, nr, 'Wandkonsole HEA 160', '1:5', g, '1 / 1')
    stueckliste(c, z, anzahl, pos)
    sx = 0.28 * mm
    x0, y0 = 60 * mm, 140 * mm
    c.setLineWidth(1)
    c.rect(x0, y0, 20 * sx, 350 * sx)
    c.rect(x0 + 20 * sx, y0 + 95 * sx, 600 * sx, 152 * sx)
    c.rect(x0 + 20 * sx + 600 * sx - 200 * sx, y0 + 247 * sx, 200 * sx, 12 * sx)
    mass(c, x0 + 20 * sx, y0 + 95 * sx, x0 + 620 * sx, y0 + 95 * sx, '600', versatz=10)
    mass(c, x0, y0, x0, y0 + 350 * sx, '350', versatz=10)
    c.setFont('Helvetica', 8)
    c.drawString(x0, y0 + 350 * sx + 10 * mm, f'Position {pos}   {anzahl} Stück, davon 3 spiegelbildlich')
    c.drawString(x0 + 40 * mm, y0 - 20 * mm, 'Ankerplatte 4x Ø18 für Verbundanker M16')
    c.drawString(x0 + 40 * mm, y0 - 25 * mm, 'Kragarm an Ankerplatte a5 umlaufend, Steifen a4 beidseitig, Auflagerblech a3')
    hinweise(c, [
        'Ausführungsklasse EXC2, Werkstoff S235JR',
        'Oberfläche: feuerverzinkt',
        'Verbundanker bauseits, nicht im Lieferumfang',
    ])
    c.showPage()
    c.save()
    return g


if __name__ == '__main__':
    for f in (stuetze, traeger, konsole):
        print(f.__name__, f())
