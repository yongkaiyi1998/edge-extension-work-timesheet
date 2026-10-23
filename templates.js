// Generic OOXML authored here from scratch; never reads the private reference.
import { zipSync, strToU8 } from "./vendor/fflate.js";
import { templateGet } from "./db.js";
const ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
export function defaultTemplate() {
  const cell = (ref, style, value) =>
    `<c r="${ref}" s="${style}">${value === undefined ? "" : `<v>${value}</v>`}</c>`;
  let rows =
    '<row r="1" ht="28" customHeight="1">' +
    Array.from("ABCDEFG", (c) => cell(c + "1", 1)).join("") +
    "</row>";
  for (let day = 0; day < 5; day++) {
    const n = 2 + day * 4;
    rows +=
      `<row r="${n}" ht="24" customHeight="1">` +
      Array.from("ABCDEFG", (c) =>
        cell(c + n, 2, c === "A" ? 46314 + day : undefined),
      ).join("") +
      "</row>";
    for (let i = 1; i <= 3; i++)
      rows +=
        `<row r="${n + i}" ht="36" customHeight="1">` +
        Array.from("ABCDEFG", (c) => cell(c + (n + i), 3)).join("") +
        "</row>";
  }
  const files = {
    "[Content_Types].xml": `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    "_rels/.rels":
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    "xl/workbook.xml": `<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">Sheet1!$A$1:$G$21</definedName><definedName name="_xlnm.Print_Titles" localSheetId="0">Sheet1!$1:$1</definedName></definedNames></workbook>`,
    "xl/_rels/workbook.xml.rels":
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    "xl/styles.xml": `<styleSheet xmlns="${ns}"><numFmts count="1"><numFmt numFmtId="165" formatCode="yyyy-mm-dd (ddd)"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF808080"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFC2DFFF"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"><color rgb="FFD4DCE3"/></left><right style="thin"><color rgb="FFD4DCE3"/></right><top style="thin"><color rgb="FFD4DCE3"/></top><bottom style="thin"><color rgb="FFD4DCE3"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf><xf numFmtId="165" fontId="0" fillId="3" borderId="1" applyNumberFormat="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    "xl/worksheets/sheet1.xml": `<worksheet xmlns="${ns}"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="36"/><cols>${[26, 20, 64, 12, 15, 13, 28].map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols><sheetData>${rows}</sheetData><printOptions horizontalCentered="1"/><pageMargins left="0.25" right="0.25" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`,
  };
  return zipSync(
    Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])),
    { level: 6 },
  ).buffer;
}
export async function selectedTemplate(s) {
  if (s.templateMode === "default") return defaultTemplate();
  const bytes = await templateGet(s.templateKey);
  if (!bytes)
    throw Error(
      "Custom template missing. Import a custom XLSX or select Default Template in Settings.",
    );
  return bytes;
}
