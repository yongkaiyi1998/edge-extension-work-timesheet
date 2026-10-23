"""Independent read-only OOXML checks of the XLSX downloaded by Edge QA."""
from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as ET
import hashlib

NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
reference = Path("reference/Timesheet-43_2026-10-19.xlsx")
assert hashlib.sha256(reference.read_bytes()).hexdigest() == "97b56edcaf15a9be98e4634638ac94819629538f3e2c171aff00d87814602a96"
with ZipFile(reference) as source, ZipFile("tests/generated.xlsx") as out:
    assert out.testzip() is None
    workbook = ET.fromstring(out.read("xl/workbook.xml"))
    assert [s.attrib["name"] for s in workbook.findall("s:sheets/s:sheet", NS)] == ["Sheet1"]
    assert "xl/worksheets/sheet2.xml" not in out.namelist()
    assert "xl/worksheets/_rels/sheet2.xml.rels" not in out.namelist()
    assert "xl/drawings/drawing2.xml" not in out.namelist()
    assert "xl/sharedStrings.xml" not in out.namelist()
    original = ET.fromstring(source.read("xl/worksheets/sheet1.xml"))
    sheet = ET.fromstring(out.read("xl/worksheets/sheet1.xml"))
    assert not sheet.findall(".//s:f", NS)
    cells = {c.attrib["r"]: c for c in sheet.findall(".//s:c", NS)}
    for row, serial in [(2, 46314), (8, 46315), (12, 46316), (18, 46317), (24, 46318)]:
        assert int(cells[f"A{row}"].find("s:v", NS).text) == serial
    def content(c):
        return "".join(t.text or "" for t in c.findall(".//s:t", NS))
    tasks = [content(c) for ref, c in cells.items() if ref.startswith("C") and ref != "C1" and content(c)]
    assert set(tasks) == {"Original Mixed Case", "UPPER TEXT", "CUSTOM CLIENT TASK"}, tasks
    assert sum(float(c.find("s:v", NS).text) for ref, c in cells.items() if ref.startswith("D") and c.find("s:v", NS) is not None) == 3.5
    assert [content(cells[f'{c}1']) for c in 'ABCDEFG'] == ['Project Name','Customer','Task / Work','Hours Spent','Status','Chargeable','Remarks']
    assert all(ref.rstrip('0123456789') in 'ABCDEFG' for ref in cells)
    assert float(sheet.find('s:cols/s:col[@min="1"]', NS).attrib['width']) >= 26
    assert sheet.find('s:cols/s:col[@min="3"]', NS).attrib['width'] == '74.86'
    for name in ["sheetFormatPr", "pageMargins", "pageSetup", "printOptions", "headerFooter"]:
        assert ET.tostring(original.find(f"s:{name}", NS)) == ET.tostring(sheet.find(f"s:{name}", NS))
    styles = ET.fromstring(out.read("xl/styles.xml"))
    old_styles = ET.fromstring(source.read("xl/styles.xml"))
    for name in ["fonts", "fills", "borders", "numFmts", "cellStyles", "cellStyleXfs"]:
        assert ET.tostring(styles.find(f"s:{name}", NS)) == ET.tostring(old_styles.find(f"s:{name}", NS))
    assert "FF808080" in out.read("xl/styles.xml").decode()
    assert "FFC2DFFF" in out.read("xl/styles.xml").decode()
    assert "Times New Roman" in out.read("xl/styles.xml").decode()
print("PASS: independent ZIP/XML checks: only Sheet1, fresh values, five numeric dates, three tasks, 3.5 hours, preserved company styles/layout/page settings, original SHA-256.")
