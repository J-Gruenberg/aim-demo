import { describe, it, expect } from 'vitest';
import { gaebText, leseGaeb, schreibeX84 } from '../src/lib/gaeb';

const X83 = `<?xml version="1.0" encoding="UTF-8"?>
<GAEB xmlns="http://www.gaeb.de/GAEB_DA_XML/200407">
 <PrjInfo><NamePrj>25404</NamePrj><LblPrj>Ersatzneubau der Radfahrerbrücke in Neustadt Glewe</LblPrj></PrjInfo>
 <Award><DP>83</DP>
  <BoQ ID="B1"><BoQBody>
   <BoQCtgy ID="C1" RNoPart="01"><LblTx><p><span>Ersatzneubau der Radfahrerbrücke</span></p></LblTx>
    <BoQBody>
     <BoQCtgy ID="C2" RNoPart="07"><LblTx><p><span>Überbau - Stahlbau, Lager, GFK-Belag</span></p></LblTx>
      <BoQBody><Itemlist>
       <Item ID="I1" RNoPart="0010"><LumpSumItem>Yes</LumpSumItem><Qty>1.000</Qty><QU>PSCH</QU>
        <Description><CompleteText><DetailTxt><Text><p><span>Werkstatt- und Montageplanung</span><br/><span>für den Stahlüberbau erstellen.</span></p></Text></DetailTxt>
        <OutlineText><OutlTxt><TextOutlTxt><p><span>Werkplanung Stahlbau</span></p></TextOutlTxt></OutlTxt></OutlineText></CompleteText></Description></Item>
       <Item ID="I2" RNoPart="0020"><Qty>12500.000</Qty><QU>kg</QU>
        <Description><CompleteText><DetailTxt><Text><p><span>Stahlkonstruktion S355 J2, Hauptträger HEB 400 &amp; Querträger,</span><br/><span>feuerverzinkt, liefern und montieren.</span></p></Text></DetailTxt>
        <OutlineText><OutlTxt><TextOutlTxt><p><span>Stahlüberbau S355</span></p></TextOutlTxt></OutlTxt></OutlineText></CompleteText></Description></Item>
       <Item ID="I3" RNoPart="0030"><Provis>WithoutTotal</Provis><Qty>46.000</Qty><QU>m</QU>
        <Description><CompleteText><DetailTxt><Text><p><span>Geländer H=1,30 m mit Stabfüllung</span></p></Text></DetailTxt></CompleteText></Description></Item>
      </Itemlist></BoQBody>
     </BoQCtgy>
    </BoQBody>
   </BoQCtgy>
  </BoQBody></BoQ>
 </Award>
</GAEB>`;

describe('GAEB', () => {
  it('liest Positionen mit Ordnungszahl, Text, Menge, Einheit', () => {
    const lv = leseGaeb(X83);
    expect(lv.datenart).toBe('83');
    expect(lv.positionen).toHaveLength(3);
    const p = lv.positionen[1];
    expect(p.oz).toBe('01.07.0020');
    expect(p.kurztext).toBe('Stahlüberbau S355');
    expect(p.langtext).toContain('HEB 400 & Querträger,\nfeuerverzinkt');
    expect(p.menge).toBe(12500);
    expect(p.einheit).toBe('kg');
    expect(lv.positionen[0].pauschal).toBe(true);
    expect(lv.positionen[2].bedarf).toBe(true);
    expect(lv.positionen[2].kurztext).toBe('Geländer H=1,30 m mit Stabfüllung');
    expect(p.bereich).toContain('Überbau');
  });
  it('schreibt X84 mit UP und IT', () => {
    const { xml, gesetzt } = schreibeX84(X83, { I2: 4.21, I3: 312.5 });
    expect(gesetzt).toBe(2);
    expect(xml).toContain('<DP>84</DP>');
    expect(xml).toContain('<QU>kg</QU><UP>4.21</UP><IT>52625.00</IT>');
    expect(leseGaeb(xml).positionen).toHaveLength(3);
  });
});

// Aufbau wie ein Export aus einem AVA-Programm: GAEB DA XML 3.2, ISO-8859-1, drei Ebenen, Hinweistext,
// Menge noch offen, Bedarfs- und Wahlposition, Bieterangabe im Text
const X83_32 = `<?xml version="1.0" encoding="ISO-8859-1"?>
<GAEB xmlns="http://www.gaeb.de/GAEB_DA_XML/DA83/3.2">
<GAEBInfo><Version>3.2</Version><VersDate>2013-10</VersDate><Date>2026-03-18</Date><ProgSystem>AVA</ProgSystem></GAEBInfo>
<PrjInfo><NamePrj>2609</NamePrj><LblPrj>Neubau Feuerwehrgerätehaus Körchow</LblPrj><Cur>EUR</Cur></PrjInfo>
<Award><DP>83</DP><AwardInfo><Cur>EUR</Cur></AwardInfo>
<BoQ ID="BOQ1"><BoQInfo><Name>LV</Name><LblBoQ>Los 2 Stahlbau</LblBoQ><BoQBkdn><Type>BoQLevel</Type><Length>2</Length></BoQBkdn><BoQBkdn><Type>BoQLevel</Type><Length>2</Length></BoQBkdn><BoQBkdn><Type>Item</Type><Length>4</Length></BoQBkdn></BoQInfo>
<BoQBody>
 <BoQCtgy ID="K1" RNoPart="02"><LblTx><p><span>Stahlbau</span></p></LblTx><BoQBody>
  <BoQCtgy ID="K2" RNoPart="01"><LblTx><p><span>Fahrzeughalle</span></p></LblTx><BoQBody><Itemlist>
   <Remark ID="R1"><Description><CompleteText><DetailTxt><Text><p><span>Hinweis: Alle Stahlbauteile feuerverzinkt.</span></p></Text></DetailTxt></CompleteText></Description></Remark>
   <Item ID="P1" RNoPart="0010"><Qty>2.000</Qty><QU>St</QU><Description><CompleteText><DetailTxt><Text><p><span>Stütze HEB 200, S235, L = 6,45 m, mit Fußplatte 20 mm,</span></p><p><span>Fabrikat: </span><TextComplement Kind="Owner"><ComplCaption>Fabrikat</ComplCaption><ComplBody><p><span>.....</span></p></ComplBody></TextComplement></p></Text></DetailTxt><OutlineText><OutlTxt><TextOutlTxt><p><span>Stütze HEB 200 verzinkt</span></p></TextOutlTxt></OutlTxt></OutlineText></CompleteText></Description></Item>
   <Item ID="P2" RNoPart="0020"><QtyTBD>Yes</QtyTBD><QU>kg</QU><Description><CompleteText><OutlineText><OutlTxt><TextOutlTxt><p><span>Kleinteile Stahl nach Aufmaß</span></p></TextOutlTxt></OutlTxt></OutlineText></CompleteText></Description></Item>
   <Item ID="P3" RNoPart="0030"><Provis>WithoutTotal</Provis><Qty>5.000</Qty><QU>m</QU><Description><CompleteText><OutlineText><OutlTxt><TextOutlTxt><p><span>Geländer, Bedarfsposition</span></p></TextOutlTxt></OutlTxt></OutlineText></CompleteText></Description></Item>
   <Item ID="P4" RNoPart="0040"><ALNGroupNo>1</ALNGroupNo><ALNSerNo>0</ALNSerNo><Qty>1.000</Qty><QU>St</QU><Description><CompleteText><OutlineText><OutlTxt><TextOutlTxt><p><span>Tor, Grundposition</span></p></TextOutlTxt></OutlTxt></OutlineText></CompleteText></Description></Item>
   <Item ID="P5" RNoPart="0050"><ALNGroupNo>1</ALNGroupNo><ALNSerNo>1</ALNSerNo><Qty>1.000</Qty><QU>St</QU><Description><CompleteText><OutlineText><OutlTxt><TextOutlTxt><p><span>Tor, Wahlposition mit Antrieb</span></p></TextOutlTxt></OutlTxt></OutlineText></CompleteText></Description></Item>
  </Itemlist></BoQBody></BoQCtgy>
 </BoQBody></BoQCtgy>
</BoQBody></BoQ></Award></GAEB>`;

describe('GAEB DA XML 3.2 aus einem AVA-Programm', () => {
  const bytes = Buffer.from(X83_32, 'latin1');
  it('liest ISO-8859-1 mit Umlauten, drei Ebenen, Hinweistext, offene Menge, Bedarf und Wahl', () => {
    const lv = leseGaeb(gaebText(bytes));
    expect(lv.bezeichnung).toBe('Neubau Feuerwehrgerätehaus Körchow');
    expect(lv.positionen.map((p) => p.oz)).toEqual(['02.01.0010', '02.01.0020', '02.01.0030', '02.01.0040', '02.01.0050']);
    expect(lv.positionen[0].langtext).toContain('Stütze HEB 200, S235, L = 6,45 m');
    expect(lv.positionen[0].kurztext).toBe('Stütze HEB 200 verzinkt');
    expect(lv.positionen[1].menge).toBeNull();
    expect(lv.positionen[2].bedarf).toBe(true);
    expect(lv.positionen[3].alternativ).toBe(false);
    expect(lv.positionen[4].alternativ).toBe(true);
    expect(lv.positionen[0].bereich).toBe('Stahlbau › Fahrzeughalle');
  });
  it('schreibt die X84 als UTF-8 mit Namensraum DA84', () => {
    const { xml, gesetzt } = schreibeX84(gaebText(bytes), { P1: 1234.5, P3: 210 });
    expect(gesetzt).toBe(2);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('xmlns="http://www.gaeb.de/GAEB_DA_XML/DA84/3.2"');
    expect(xml).toContain('<DP>84</DP>');
    expect(xml).toContain('<QU>St</QU><UP>1234.50</UP><IT>2469.00</IT>');
    expect(xml).toContain('Körchow');
    expect(leseGaeb(xml).positionen).toHaveLength(5);
  });
  it('weist das alte Format D83 verständlich ab', () => {
    expect(() => gaebText(Buffer.from('T0 GAEB 90 ...\r\n00 Leistungsverzeichnis', 'latin1'))).toThrow(/X83/);
  });
  it('liest UTF-8 mit Byte-Order-Mark', () => {
    const utf = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(X83_32.replace('ISO-8859-1', 'UTF-8'), 'utf8')]);
    expect(leseGaeb(gaebText(utf)).bezeichnung).toBe('Neubau Feuerwehrgerätehaus Körchow');
  });
});
