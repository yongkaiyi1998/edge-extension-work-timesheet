// Template-preserving OOXML editing: fflate handles ZIP; browser DOM handles XML.
import { unzipSync, zipSync, strFromU8, strToU8 } from "./vendor/fflate.js";
import { date, monday, addDays, task, filename } from "./core.js";
const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const nodes = (d, n) => Array.from(d.getElementsByTagNameNS("*", n));
const xml = (s) => {
  const d = new DOMParser().parseFromString(s, "application/xml");
  if (nodes(d, "parsererror").length) throw Error("Malformed template XML.");
  return d;
};
const serialize = (d) => new XMLSerializer().serializeToString(d);
const read = (z, n) => {
  if (!z[n]) throw Error(`Template is missing ${n}.`);
  return xml(strFromU8(z[n]));
};
const cell = (r, col) =>
  nodes(r, "c").find((c) => c.getAttribute("r").replace(/\d/g, "") === col);
function value(c, strings) {
  if (!c) return "";
  return c.getAttribute("t") === "s"
    ? strings[Number(nodes(c, "v")[0]?.textContent)]
    : c.getAttribute("t") === "inlineStr"
      ? nodes(c, "t")
          .map((t) => t.textContent)
          .join("")
      : (nodes(c, "v")[0]?.textContent ?? "");
}
function write(c, v) {
  c.replaceChildren();
  c.removeAttribute("t");
  if (v === "" || v === null) return;
  if (typeof v === "number") {
    const n = c.ownerDocument.createElementNS(NS, "v");
    n.textContent = String(v);
    c.append(n);
  } else {
    c.setAttribute("t", "inlineStr");
    const is = c.ownerDocument.createElementNS(NS, "is"),
      t = c.ownerDocument.createElementNS(NS, "t");
    t.setAttributeNS(
      "http://www.w3.org/XML/1998/namespace",
      "xml:space",
      "preserve",
    );
    t.textContent = v;
    is.append(t);
    c.append(is);
  }
}
function getCell(row, col, style) {
  let c = cell(row, col);
  if (!c) {
    c = row.ownerDocument.createElementNS(NS, "c");
    c.setAttribute("r", col + row.getAttribute("r"));
    if (style) c.setAttribute("s", style);
    const next = nodes(row, "c").find(
      (x) => x.getAttribute("r").replace(/\d/g, "").localeCompare(col) > 0,
    );
    row.insertBefore(c, next ?? null);
  }
  return c;
}
function unpack(bytes) {
  if (bytes.byteLength > 20000000) throw Error("Template exceeds 20 MB.");
  let total = 0;
  return unzipSync(new Uint8Array(bytes), {
    filter: (e) => {
      total += e.originalSize;
      if (total > 60000000) throw Error("Template expands beyond 60 MB.");
      return true;
    },
  });
}
// Keep only parts reachable from package relationships. This removes excluded
// sheets' relationship files, drawings and other orphaned worksheet content.
function prunePackage(z) {
  const keep = new Set(["[Content_Types].xml"]);
  function visit(part) {
    if (keep.has(part)) return;
    if (part && !z[part]) throw Error(`Broken workbook relationship: ${part}`);
    if (part) keep.add(part);
    const slash = part.lastIndexOf("/");
    const dir = slash < 0 ? "" : part.slice(0, slash + 1);
    const relPath = part
      ? dir + "_rels/" + part.slice(slash + 1) + ".rels"
      : "_rels/.rels";
    if (!z[relPath]) return;
    keep.add(relPath);
    for (const r of nodes(read(z, relPath), "Relationship")) {
      if (r.getAttribute("TargetMode") === "External") continue;
      const target = r.getAttribute("Target").split("#")[0];
      const bits = (
        target.startsWith("/") ? target.slice(1) : dir + target
      ).split("/");
      const clean = [];
      for (const bit of bits) {
        if (bit === "..") clean.pop();
        else if (bit && bit !== ".") clean.push(bit);
      }
      visit(clean.join("/"));
    }
  }
  visit("");
  for (const name of Object.keys(z)) if (!keep.has(name)) delete z[name];
  const ct = read(z, "[Content_Types].xml");
  for (const e of nodes(ct, "Override"))
    if (!z[e.getAttribute("PartName").slice(1)]) e.remove();
  z["[Content_Types].xml"] = strToU8(serialize(ct));
}
export function inspectTemplate(bytes) {
  const z = unpack(bytes),
    wb = read(z, "xl/workbook.xml"),
    rels = read(z, "xl/_rels/workbook.xml.rels");
  const sheet = nodes(wb, "sheet").find(
    (s) => s.getAttribute("name") === "Sheet1",
  );
  if (!sheet) throw Error("Template must contain Sheet1.");
  if (
    nodes(wb, "workbookPr").some((p) =>
      ["1", "true"].includes(p.getAttribute("date1904")),
    )
  )
    throw Error("1904 date system is unsupported.");
  const id = sheet.getAttributeNS(
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "id",
  );
  const rel = nodes(rels, "Relationship").find(
    (r) => r.getAttribute("Id") === id,
  );
  const target = rel?.getAttribute("Target");
  if (!target || target.includes(".."))
    throw Error("Unsupported worksheet relationship.");
  const path = target.startsWith("/") ? target.slice(1) : "xl/" + target;
  const ws = read(z, path),
    styles = read(z, "xl/styles.xml");
  const strings = z["xl/sharedStrings.xml"]
    ? nodes(read(z, "xl/sharedStrings.xml"), "si").map((s) =>
        nodes(s, "t")
          .map((t) => t.textContent)
          .join(""),
      )
    : [];
  const xfs = Array.from(nodes(styles, "cellXfs")[0].children),
    formats = new Map(
      nodes(styles, "numFmt").map((n) => [
        Number(n.getAttribute("numFmtId")),
        n.getAttribute("formatCode"),
      ]),
    );
  const rows = nodes(ws, "row"),
    sections = [];
  for (const r of rows) {
    const a = cell(r, "A");
    if (!a) continue;
    const style = xfs[Number(a.getAttribute("s") || 0)];
    const fmt = Number(style?.getAttribute("numFmtId"));
    if (
      ((fmt >= 14 && fmt <= 22) || /[dy]/i.test(formats.get(fmt) ?? "")) &&
      (nodes(a, "f").length || value(a, strings) !== "")
    )
      sections.push({
        row: r,
        number: Number(r.getAttribute("r")),
        style: a.getAttribute("s"),
      });
  }
  if (sections.length !== 5)
    throw Error("Expected exactly five date sections in Sheet1.");
  for (let i = 0; i < 5; i++) {
    const s = sections[i],
      first = rows.find((r) => Number(r.getAttribute("r")) === s.number + 1);
    if (!first || !cell(first, "C") || !cell(first, "B"))
      throw Error("Missing task row prototype.");
    s.prototype = first;
    s.workRows = [];
    for (const r of rows) {
      const n = Number(r.getAttribute("r"));
      if (n <= s.number || n >= (sections[i + 1]?.number ?? s.number + 1000))
        continue;
      if (
        cell(r, "B")?.getAttribute("s") !==
          cell(first, "B").getAttribute("s") ||
        !cell(r, "C")
      )
        break;
      s.workRows.push(r);
    }
    if (!s.workRows.length) throw Error("No writable task rows.");
  }
  const dateCells = new Set(sections.map((s) => cell(s.row, "A")));
  for (const c of nodes(ws, "c"))
    if (nodes(c, "f").length && !dateCells.has(c))
      throw Error(
        `Unsupported formula at ${c.getAttribute("r")}; cannot safely detach worksheets.`,
      );
  for (const m of nodes(ws, "mergeCell")) {
    const ref = m.getAttribute("ref");
    if (
      sections.some((s) =>
        s.workRows.some((r) => {
          const n = Number(r.getAttribute("r"));
          const nums = ref.match(/\d+/g).map(Number);
          return n >= nums[0] && n <= nums[1];
        }),
      )
    )
      throw Error("Merged task cells are unsupported.");
  }
  return { z, wb, rels, sheet, path, ws, styles, strings, rows, sections };
}
export function templateSummary(bytes) {
  const t = inspectTemplate(bytes);
  return `Ready · Sheet1 · daily capacities ${t.sections.map((s) => s.workRows.length).join(", ")}`;
}
function exportLegacyWeek(bytes, selected, tasks) {
  if (monday(selected) !== selected) throw Error("Select a Monday week start.");
  if (selected < "1900-03-01")
    throw Error("Excel export requires dates from March 1900 onward.");
  tasks.forEach(task);
  if (new Set(tasks.map((t) => t.id)).size !== tasks.length)
    throw Error("Duplicate task IDs.");
  if (tasks.some((t) => t.date < selected || t.date > addDays(selected, 4)))
    throw Error(
      "This export covers Monday–Friday only. Move weekend tasks to a weekday before exporting.",
    );
  const t = inspectTemplate(bytes),
    { z, ws, wb, rels, sections } = t;
  const layoutNames = [
    "cols",
    "sheetFormatPr",
    "pageMargins",
    "pageSetup",
    "printOptions",
    "headerFooter",
  ];
  const originalLayout = new Map(
    layoutNames.map((n) => [n, nodes(ws, n).map(serialize).join("")]),
  );
  const originalStyles = xml(strFromU8(z["xl/styles.xml"]));
  const originalRows = t.rows.map((r) => ({
    number: Number(r.getAttribute("r")),
    height: r.getAttribute("ht"),
    cells: nodes(r, "c").map((c) => ({
      ref: c.getAttribute("r"),
      style: c.getAttribute("s"),
    })),
  }));
  const originalMerges = nodes(ws, "mergeCell").map((m) =>
    m.getAttribute("ref"),
  );
  const groups = sections.map((s, i) =>
    tasks.filter((t) => t.date === addDays(selected, i)),
  );
  const insertions = sections.map((s, i) => ({
    at: Number(s.workRows.at(-1).getAttribute("r")) + 1,
    count: Math.max(0, groups[i].length - s.workRows.length),
    prototype: s.prototype,
  }));
  const shift = (n) =>
    n + insertions.reduce((sum, x) => sum + (n >= x.at ? x.count : 0), 0);
  const shiftRef = (ref) =>
    ref.replace(
      /(\$?[A-Z]{1,3}\$?)(\d+)/g,
      (_, col, n) => col + shift(Number(n)),
    );
  // Resolve all shared strings to inline text, then discard the stale string pool.
  for (const c of nodes(ws, "c"))
    if (c.getAttribute("t") === "s") write(c, value(c, t.strings));
  // No old customer/work/status/remarks may survive from the template body.
  for (const r of t.rows)
    if (Number(r.getAttribute("r")) > 1)
      for (const c of nodes(r, "c"))
        if (/^[B-G]\d+$/.test(c.getAttribute("r"))) write(c, "");
  for (const r of t.rows) {
    const old = Number(r.getAttribute("r"));
    r.setAttribute("r", shift(old));
    for (const c of nodes(r, "c"))
      c.setAttribute("r", shiftRef(c.getAttribute("r")));
  }
  for (const e of nodes(ws, "worksheet")[0].querySelectorAll("*"))
    for (const name of ["ref", "sqref", "topLeftCell"])
      if (e.hasAttribute(name))
        e.setAttribute(name, shiftRef(e.getAttribute(name)));
  const sheetData = nodes(ws, "sheetData")[0];
  for (const ins of insertions) {
    const base = shift(ins.at) - ins.count;
    for (let j = 0; j < ins.count; j++) {
      const r = ins.prototype.cloneNode(true);
      r.setAttribute("r", base + j);
      for (const c of nodes(r, "c")) {
        c.setAttribute("r", c.getAttribute("r").replace(/\d+$/, base + j));
        write(c, "");
      }
      const next = nodes(sheetData, "row").find(
        (x) => Number(x.getAttribute("r")) > base + j,
      );
      sheetData.insertBefore(r, next ?? null);
    }
  }
  const expected = [];
  for (let i = 0; i < 5; i++) {
    const s = sections[i],
      n = shift(s.number);
    for (const c of nodes(s.row, "c"))
      if (/^[B-G]\d+$/.test(c.getAttribute("r"))) write(c, "");
    const a = cell(s.row, "A");
    const serial = Math.round(
      (+date(addDays(selected, i)) - Date.UTC(1899, 11, 30, 12)) / 86400000,
    );
    write(a, serial);
    // The source Monday uses a date-only format. Use the existing weekday format
    // on a cloned style so its other formatting stays intact.
    if (i === 0) {
      const xfs = nodes(t.styles, "cellXfs")[0];
      const source = xfs.children[Number(s.style)].cloneNode(true);
      source.setAttribute(
        "numFmtId",
        xfs.children[Number(sections[1].style)].getAttribute("numFmtId"),
      );
      a.setAttribute("s", xfs.children.length);
      xfs.append(source);
      xfs.setAttribute("count", xfs.children.length);
    }
    const workRows = nodes(sheetData, "row").filter(
      (r) =>
        Number(r.getAttribute("r")) > n &&
        Number(r.getAttribute("r")) <
          shift(Number(s.workRows.at(-1).getAttribute("r")) + 1),
    );
    for (const r of workRows)
      for (const col of ["A", "B", "C", "D", "E", "F", "G"])
        write(getCell(r, col, cell(s.prototype, col)?.getAttribute("s")), "");
    groups[i].forEach((task, j) => {
      const r = workRows[j];
      if (!r) throw Error("Row expansion failed.");
      const vals = [
        task.customer,
        task.work,
        task.hours,
        task.status === "In Progress" ? "WIP" : task.status,
        task.chargeable,
        task.remarks,
      ];
      vals.forEach((v, k) =>
        write(
          getCell(
            r,
            "BCDEFG"[k],
            cell(s.prototype, "BCDEFG"[k])?.getAttribute("s"),
          ),
          v,
        ),
      );
      expected.push({ row: Number(r.getAttribute("r")), vals });
    });
    s.outputRow = n;
    s.serial = serial;
  }
  for (const s of nodes(wb, "sheet")) if (s !== t.sheet) s.remove();
  for (const d of nodes(wb, "definedName")) {
    if (/Sheet6|#REF!|\[/.test(d.textContent))
      throw Error("Unsupported named-range dependency.");
    if (
      d.hasAttribute("localSheetId") &&
      d.getAttribute("localSheetId") !== "0"
    ) {
      d.remove();
      continue;
    }
    d.textContent = shiftRef(d.textContent);
  }
  for (const ext of nodes(wb, "extLst")) ext.remove();
  for (const r of nodes(rels, "Relationship")) {
    const type = r.getAttribute("Type");
    if (
      (type.endsWith("/worksheet") &&
        r.getAttribute("Id") !==
          t.sheet.getAttributeNS(
            "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
            "id",
          )) ||
      type.endsWith("/sharedStrings") ||
      type.endsWith("/calcChain") ||
      type.includes("workbookmetadata")
    )
      r.remove();
  }
  const ct = read(z, "[Content_Types].xml");
  const removed = [];
  for (const name of Object.keys(z)) {
    if (
      (/^xl\/worksheets\/sheet\d+\.xml$/.test(name) && name !== t.path) ||
      name === "xl/sharedStrings.xml" ||
      name === "xl/calcChain.xml" ||
      name === "xl/metadata" ||
      name === "docProps/app.xml"
    ) {
      delete z[name];
      removed.push("/" + name);
    }
  }
  for (const e of nodes(ct, "Override"))
    if (removed.includes(e.getAttribute("PartName"))) e.remove();
  const rootrels = read(z, "_rels/.rels");
  for (const r of nodes(rootrels, "Relationship"))
    if (r.getAttribute("Type").endsWith("/extended-properties")) r.remove();
  z["_rels/.rels"] = strToU8(serialize(rootrels));
  // Shift drawing anchors, preserving drawing content and relationships.
  for (const name of Object.keys(z).filter((n) =>
    /^xl\/drawings\/drawing\d+\.xml$/.test(n),
  )) {
    const d = read(z, name);
    for (const r of nodes(d, "row"))
      r.textContent = String(shift(Number(r.textContent) + 1) - 1);
    z[name] = strToU8(serialize(d));
  }
  z[t.path] = strToU8(serialize(ws));
  z["xl/workbook.xml"] = strToU8(serialize(wb));
  z["xl/_rels/workbook.xml.rels"] = strToU8(serialize(rels));
  z["xl/styles.xml"] = strToU8(serialize(t.styles));
  z["[Content_Types].xml"] = strToU8(serialize(ct));
  prunePackage(z);
  const output = zipSync(z, { level: 6 });
  const reopened = unpack(output),
    out = read(reopened, t.path),
    outWb = read(reopened, "xl/workbook.xml");
  if (
    nodes(outWb, "sheet").length !== 1 ||
    nodes(outWb, "sheet")[0].getAttribute("name") !== "Sheet1"
  )
    throw Error("Worksheet validation failed.");
  const outRows = nodes(out, "row");
  for (const s of sections) {
    const r = outRows.find((r) => Number(r.getAttribute("r")) === s.outputRow);
    if (
      Number(value(cell(r, "A"), [])) !== s.serial ||
      nodes(cell(r, "A"), "f").length
    )
      throw Error("Date validation failed.");
    for (const col of "BCDEFG")
      if (
        cell(r, col)?.getAttribute("s") !== cell(s.row, col)?.getAttribute("s")
      )
        throw Error("Separator style validation failed.");
  }
  for (const e of expected) {
    const row = outRows.find((r) => Number(r.getAttribute("r")) === e.row);
    e.vals.forEach((v, k) => {
      if (String(value(cell(row, "BCDEFG"[k]), [])) !== String(v))
        throw Error("Task data validation failed.");
    });
  }
  const filled = outRows.filter(
    (r) =>
      Number(r.getAttribute("r")) > 1 &&
      !sections.some((s) => s.outputRow === Number(r.getAttribute("r"))) &&
      value(cell(r, "C"), []) !== "",
  );
  if (filled.length !== tasks.length)
    throw Error("Task count validation failed.");
  for (const name of layoutNames)
    if (nodes(out, name).map(serialize).join("") !== originalLayout.get(name))
      throw Error("Layout validation failed.");
  const outputStyles = read(reopened, "xl/styles.xml");
  for (const name of [
    "fonts",
    "fills",
    "borders",
    "numFmts",
    "cellStyleXfs",
    "cellStyles",
  ])
    if (
      nodes(outputStyles, name).map(serialize).join("") !==
      nodes(originalStyles, name).map(serialize).join("")
    )
      throw Error("Style definitions changed.");
  const oldXfs = nodes(originalStyles, "cellXfs")[0],
    newXfs = nodes(outputStyles, "cellXfs")[0];
  Array.from(oldXfs.children).forEach((xf, i) => {
    if (serialize(xf) !== serialize(newXfs.children[i]))
      throw Error("Original cell style changed.");
  });
  for (const old of originalRows) {
    const r = outRows.find(
      (r) => Number(r.getAttribute("r")) === shift(old.number),
    );
    if (!r || r.getAttribute("ht") !== old.height)
      throw Error("Original row height changed.");
    for (const c of old.cells) {
      if (c.ref === "A" + sections[0].number) continue;
      const target = nodes(r, "c").find(
        (e) => e.getAttribute("r") === shiftRef(c.ref),
      );
      if (!target || target.getAttribute("s") !== c.style)
        throw Error("Original cell formatting changed.");
    }
  }
  if (
    JSON.stringify(
      nodes(out, "mergeCell").map((m) => m.getAttribute("ref")),
    ) !== JSON.stringify(originalMerges.map(shiftRef))
  )
    throw Error("Merged ranges changed unexpectedly.");
  return {
    bytes: output,
    filename: filename(selected),
    sections: sections.map((s) => s.outputRow),
    count: expected.length,
  };
}
// Both preview and XLSX consume these exact normalized values.
export const exportColumns = [
  "Project Name",
  "Customer",
  "Task / Work",
  "Hours Spent",
  "Status",
  "Chargeable",
  "Remarks",
];
export function exportDataset(selected, tasks) {
  if (monday(selected) !== selected) throw Error("Select a Monday week start.");
  tasks.forEach(task);
  if (tasks.some((t) => t.date < selected || t.date > addDays(selected, 4)))
    throw Error(
      "Weekend tasks cannot be included in this Monday–Friday report.",
    );
  return Array.from({ length: 5 }, (_, i) => ({
    date: addDays(selected, i),
    rows: tasks
      .filter((t) => t.date === addDays(selected, i))
      .map((t) => [
        t.projectName ?? "",
        t.customer,
        t.work,
        t.hours,
        t.status === "In Progress" ? "WIP" : t.status,
        t.chargeable,
        t.remarks,
      ]),
  }));
}
export function exportWeek(bytes, selected, tasks) {
  const dataset = exportDataset(selected, tasks);
  const result = exportLegacyWeek(bytes, selected, tasks),
    z = unpack(result.bytes);
  const path = inspectTemplate(bytes).path,
    ws = read(z, path),
    rows = nodes(ws, "row");
  const header = rows.find((r) => r.getAttribute("r") === "1");
  exportColumns.forEach((name, i) =>
    write(getCell(header, "ABCDEFG"[i]), name),
  );
  let day = -1,
    at = 0;
  for (const row of rows) {
    const n = Number(row.getAttribute("r"));
    if (result.sections.includes(n)) {
      day++;
      at = 0;
    } else if (n > 1 && value(cell(row, "C"), []) !== "") {
      const values = dataset[day].rows[at++];
      values.forEach((v, i) => write(getCell(row, "ABCDEFG"[i]), v));
    }
    // The template contains unused formatting through Z. Limit report to A–G.
    for (const c of nodes(row, "c"))
      if (!/^[A-G]\d+$/.test(c.getAttribute("r"))) c.remove();
  }
  for (const col of nodes(ws, "col")) {
    if (Number(col.getAttribute("min")) > 7) col.remove();
    else if (Number(col.getAttribute("max")) > 7) col.setAttribute("max", "7");
  }
  const a = nodes(ws, "col").find((c) => c.getAttribute("min") === "1");
  a.setAttribute("width", "26");
  a.setAttribute("customWidth", "1");
  let dimension = nodes(ws, "dimension")[0];
  if (!dimension) {
    dimension = ws.createElementNS(NS, "dimension");
    const root = ws.documentElement;
    root.insertBefore(dimension, nodes(ws, "sheetViews")[0]);
  }
  dimension.setAttribute(
    "ref",
    "A1:G" +
      Math.max(
        ...rows
          .filter((r) => nodes(r, "c").length)
          .map((r) => Number(r.getAttribute("r"))),
      ),
  );
  z[path] = strToU8(serialize(ws));
  const output = zipSync(z, { level: 6 }),
    check = read(unpack(output), path);
  const cells = new Map(nodes(check, "c").map((c) => [c.getAttribute("r"), c]));
  if (nodes(check, "c").some((c) => !/^[A-G]\d+$/.test(c.getAttribute("r"))))
    throw Error("Seven-column validation failed.");
  let count = 0;
  dataset.forEach((day, i) => {
    const separator = result.sections[i],
      a = cells.get("A" + separator);
    const serial = Math.round(
      (+date(day.date) - Date.UTC(1899, 11, 30, 12)) / 86400000,
    );
    if (Number(value(a, [])) !== serial || nodes(a, "f").length)
      throw Error("Separator date validation failed.");
    day.rows.forEach((values, j) => {
      values.forEach((v, k) => {
        if (
          String(value(cells.get("ABCDEFG"[k] + (separator + 1 + j)), [])) !==
          String(v)
        )
          throw Error("Preview/workbook data mismatch.");
      });
      count++;
    });
  });
  if (count !== tasks.length) throw Error("Task count validation failed.");
  return { ...result, bytes: output, dataset };
}
