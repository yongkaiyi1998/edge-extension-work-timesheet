"""Independent standard-library validation of generated Default-mode XLSX files."""
from zipfile import ZipFile
import xml.etree.ElementTree as E
N={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
for filename,count in [('default-empty.xlsx',0),('default-demo.xlsx',4),('default-overflow.xlsx',60)]:
    with ZipFile('tests/'+filename) as z:
        assert z.testzip() is None
        wb=E.fromstring(z.read('xl/workbook.xml'))
        assert [s.attrib['name'] for s in wb.findall('s:sheets/s:sheet',N)]==['Sheet1']
        ws=E.fromstring(z.read('xl/worksheets/sheet1.xml'))
        assert not ws.findall('.//s:f',N)
        rows=ws.findall('s:sheetData/s:row',N)
        def text(c):return ''.join(t.text or '' for t in c.findall('.//s:t',N))
        entries=[r for r in rows if int(r.attrib['r'])>1 and any(c.attrib['r'].startswith('C') and text(c) for c in r)]
        assert len(entries)==count
        dates=[c for r in rows for c in r if c.attrib['r'].startswith('A') and c.find('s:v',N) is not None]
        assert len(dates)==5
        serials=[int(c.find('s:v',N).text) for c in dates]
        assert serials==list(range(serials[0],serials[0]+5))
        for r in rows:
            assert all(c.attrib['r'].rstrip('0123456789') in 'ABCDEFG' for c in r)
        styles=E.fromstring(z.read('xl/styles.xml'))
        xfs=styles.find('s:cellXfs',N)
        for c in dates:
            xf=xfs[int(c.attrib['s'])]
            assert xf.attrib['numFmtId']=='165' and xf.attrib['fillId']=='3'
        assert ws.find('s:pageSetup',N).attrib['orientation']=='landscape'
        assert ws.find('s:pageSetup',N).attrib['fitToWidth']=='1'
        if count==60:
            assert all(float(r.attrib['ht'])>36 for r in entries)
            assert all(any(c.attrib['r'].startswith('E') and text(c)=='WIP' for c in r) for r in entries)
            area=next(n.text for n in wb.findall('s:definedNames/s:definedName',N) if n.attrib['name']=='_xlnm.Print_Area')
            assert int(area.split('$')[-1])>=max(int(r.attrib['r']) for r in entries)
            assert serials[0]==46384 # Monday 2026-12-28
        assert 'FF808080' in z.read('xl/styles.xml').decode() and 'FFC2DFFF' in z.read('xl/styles.xml').decode()
print('PASS: independent Default XLSX checks (empty/demo/60 long records, five dates, WIP, print area, seven columns, single Sheet1).')
