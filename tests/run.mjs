import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import {
  date,
  monday,
  weekNumber,
  filename,
  task,
  initial,
  state,
  dailyHours,
} from "../core.js";
const require = createRequire(import.meta.url);
const runtime =
  process.env.CODEX_NODE_MODULES ||
  "C:/Users/infonal/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
const { chromium } = require(path.join(runtime, "playwright-core"));
const root = path.resolve(".");
assert.deepEqual(
  dailyHours([{ id: "a", date: "2026-10-21", hours: 6 }], "2026-10-21", 3),
  { logged: 6, remaining: 0, overtime: 1 },
);
assert.deepEqual(
  dailyHours(
    [{ id: "a", date: "2026-10-21", hours: 6 }],
    "2026-10-21",
    2,
    8,
    "a",
  ),
  { logged: 0, remaining: 6, overtime: 0 },
);
assert.equal(monday("2027-01-01"), "2026-12-28");
assert.equal(weekNumber("2027-01-01"), 53);
assert.equal(weekNumber("2027-01-04"), 1);
assert.equal(weekNumber("2021-01-04"), 1);
assert.equal(weekNumber("2021-01-01"), 53);
// Independently count whole weeks from ISO year's first Thursday.
for (let year = 2000; year < 2400; year++)
  for (let day = 1; day <= 14; day++) {
    const s = `${year}-01-${String(day).padStart(2, "0")}`;
    const thursday = new Date(s + "T00:00:00Z");
    thursday.setUTCDate(
      thursday.getUTCDate() + 3 - ((thursday.getUTCDay() + 6) % 7),
    );
    const first = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
    first.setUTCDate(first.getUTCDate() + 3 - ((first.getUTCDay() + 6) % 7));
    assert.equal(
      weekNumber(s),
      Math.round((thursday - first) / 604800000) + 1,
      s,
    );
  }
assert.equal(filename("2026-10-19"), "Timesheet_43_2026-10-19.xlsx");
assert.equal(filename("2024-12-30"), "Timesheet_1_2024-12-30.xlsx");
assert.throws(() => date("2026-02-30"));
assert.throws(() => state({ ...initial(), tasks: [{}] }));
const source = await fs.readFile("reference/Timesheet-43_2026-10-19.xlsx");
const hash = (b) => createHash("sha256").update(b).digest("hex");
const profile = await fs.mkdtemp(path.join(os.tmpdir(), "quick-timesheet-qa-"));
const context = await chromium.launchPersistentContext(profile, {
  executablePath:
    process.env.CHROMIUM_PATH ||
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
  ignoreDefaultArgs: ["--disable-extensions"],
  args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`],
});
try {
  let worker =
    context.serviceWorkers()[0] ||
    (await context.waitForEvent("serviceworker", { timeout: 15000 }));
  const base = worker.url().split("/").slice(0, 3).join("/");
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/popup.html");
  await page.waitForSelector("form");
  const result = await page.evaluate(async (bytes) => {
    const { api } = await import("./client.js");
    const { templateSummary, exportWeek } = await import("./xlsx.js");
    const { unzipSync, strFromU8 } = await import("./vendor/fflate.js");
    const buf = new Uint8Array(bytes).buffer;
    const summary = templateSummary(buf);
    const make = (day, i) => ({
      id: `${day}-${i}`,
      date: `2026-10-${19 + day}`,
      customer: "CUSTOM <&>",
      work: `Work ${day}/${i}\n=SUM(A1:A2)`,
      hours: i / 4,
      projectName: "PROJECT " + day,
      status: "In Progress",
      chargeable: "Yes",
      remarks: '"Remark" & <text>',
    });
    const tasks = Array.from({ length: 5 }, (_, day) =>
      Array.from({ length: 12 }, (_, i) => make(day, i)),
    ).flat();
    const out = exportWeek(buf, "2026-10-19", tasks);
    if (out.count !== 60) throw Error("Wrong export count");
    const empty = exportWeek(buf, "2026-10-19", []);
    const changed = exportWeek(buf, "2026-10-19", [
      { ...tasks[0], work: "Edited", hours: 0 },
    ]);
    const z = unzipSync(out.bytes),
      ws = new DOMParser().parseFromString(
        strFromU8(z["xl/worksheets/sheet1.xml"]),
        "application/xml",
      );
    if (ws.querySelector("f")) throw Error("Stale formula");
    const text = (ref) => {
      const c = Array.from(ws.querySelectorAll("c")).find(
        (c) => c.getAttribute("r") === ref,
      );
      return c
        ? Array.from(c.querySelectorAll("t"))
            .map((t) => t.textContent)
            .join("")
        : "";
    };
    if (
      text("A3") !== "PROJECT 0" ||
      text("E3") !== "WIP" ||
      text("C3") !== tasks[0].work
    )
      throw Error("Seven-column mapping failed");
    if (Object.keys(z).includes("xl/worksheets/sheet2.xml"))
      throw Error("Sheet6 remains");
    await api("customers", {
      customers: ["Acme", "Beta"],
      defaultCustomer: "Acme",
    });
    await api("save", { task: tasks[0], uppercase: false });
    await api("save", { task: tasks[0], uppercase: false });
    if ((await api("get")).tasks.length !== 1)
      throw Error("Duplicate click wrote twice");
    await api("template", { bytes: buf });
    const backup = await api("backup");
    await api("delete", { id: tasks[0].id });
    await api("restore", { backup });
    if ((await api("get")).tasks.length !== 1) throw Error("Restore failed");
    let rejected = false;
    try {
      await api("restore", { backup: { ...backup, version: 2 } });
    } catch {
      rejected = true;
    }
    if (!rejected || (await api("get")).tasks.length !== 1)
      throw Error("Invalid restore damaged data");
    for (const invalid of [
      { ...backup, state: { ...backup.state, tasks: [tasks[0], tasks[0]] } },
      {
        ...backup,
        state: { ...backup.state, tasks: [{ ...tasks[0], hours: -1 }] },
      },
      { ...backup, template: [1, 2, 3] },
    ]) {
      // Template contents are validated in Settings before invoking restore.
      if (invalid.template?.length === 3) {
        let failed = false;
        try {
          templateSummary(new Uint8Array(invalid.template).buffer);
        } catch {
          failed = true;
        }
        if (!failed) throw Error("Invalid XLSX accepted");
        continue;
      }
      let failed = false;
      try {
        await api("restore", { backup: invalid });
      } catch {
        failed = true;
      }
      if (!failed) throw Error("Invalid backup accepted");
    }
    await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        api("save", {
          task: { ...tasks[0], id: "concurrent-" + i },
          uppercase: false,
        }),
      ),
    );
    if ((await api("get")).tasks.length !== 9)
      throw Error("Concurrent writes lost tasks");
    await api("restore", { backup });
    let weekendRejected = false;
    try {
      exportWeek(buf, "2026-10-19", [{ ...tasks[0], date: "2026-10-24" }]);
    } catch {
      weekendRejected = true;
    }
    if (!weekendRejected) throw Error("Weekend task silently omitted");
    return {
      summary,
      rows: out.sections,
      empty: empty.count,
      changed: changed.count,
    };
  }, Array.from(source));
  console.log("Workbook / storage checks:", result);
  await page.reload();
  await page.waitForSelector("form");
  assert.equal(await page.locator("select").first().inputValue(), "Acme");
  assert.equal(await page.locator("input[type=checkbox]").isChecked(), false);
  assert.equal(
    await page.getByLabel("Chargeable", { exact: true }).inputValue(),
    "No",
  );
  const inputs = page.locator("form input");
  await page.locator("input[type=date]").fill("2026-10-20");
  await page.locator("textarea").first().fill("Original Mixed Case");
  await page.locator("input[type=number]").fill("1.5");
  await page.getByRole("button", { name: "Save Task", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Task saved." }).waitFor();
  const saved = await page.evaluate(
    async () => (await (await import("./client.js")).api("get")).tasks,
  );
  assert(saved.some((t) => t.work === "Original Mixed Case"));
  await page.locator("input[type=checkbox]").check();
  await page.locator("textarea").first().fill("Upper Text");
  await page.locator("input[type=number]").fill("2");
  await page.getByRole("button", { name: "Save Task", exact: true }).click();
  await page.waitForFunction(async () => {
    const s = await (await import("./client.js")).api("get");
    return s.tasks.some((t) => t.work === "UPPER TEXT");
  });
  await page.goto(base + "/weekly.html");
  await page.locator("#week").fill("2026-10-19");
  await page.locator("#week").dispatchEvent("change");
  await page.waitForFunction(
    () => document.querySelectorAll("article").length === 3,
  );
  await page.getByRole("button", { name: "Edit", exact: true }).first().click();
  await page.evaluate(async () => {
    const { api } = await import("./client.js");
    const original = (await api("get")).tasks[0];
    await api("save", {
      task: { ...original, work: "Concurrent external edit" },
      edit: true,
      original,
      uppercase: true,
    });
  });
  await page.getByRole("button", { name: "Save Changes" }).click();
  await page.waitForFunction(() =>
    document
      .querySelector("#edit .dialog-message")
      ?.textContent.includes("changed in another window"),
  );
  await page.locator("#closeEdit").click();
  await page.getByRole("button", { name: "Edit", exact: true }).first().click();
  await page.locator("#editor textarea").first().fill("Edited through UI");
  await page.getByRole("button", { name: "Save Changes" }).click();
  await page.waitForFunction(() => !document.querySelector("#edit").open);
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Delete", exact: true })
    .first()
    .click();
  await page.waitForFunction(
    () => document.querySelectorAll("article").length === 2,
  );
  await page.reload();
  await page.waitForFunction(
    () => document.querySelectorAll("article").length === 2,
  );
  await page.goto(base + "/settings.html");
  await page.waitForFunction(() =>
    document.querySelector("#templateStatus").textContent.includes("Ready"),
  );
  await page.locator("#newCustomer").fill("Gamma");
  await page.getByRole("button", { name: "Add Customer", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelectorAll(".customer").length === 3,
  );
  const historyBefore = await page.evaluate(async () =>
    JSON.stringify((await (await import("./client.js")).api("get")).tasks),
  );
  await page.locator(".customer input").first().fill("Acme Renamed");
  await page
    .getByRole("button", { name: "Rename", exact: true })
    .first()
    .click();
  await page.waitForFunction(
    () => document.querySelector("#defaultCustomer").value === "Acme Renamed",
  );
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Remove", exact: true })
    .nth(1)
    .click();
  await page.waitForFunction(
    () => document.querySelectorAll(".customer").length === 2,
  );
  assert.equal(
    await page.evaluate(async () =>
      JSON.stringify((await (await import("./client.js")).api("get")).tasks),
    ),
    historyBefore,
  );
  await page.goto(base + "/popup.html");
  await page.waitForSelector("form");
  await page.locator("select").first().selectOption("One-time custom entry…");
  await page
    .getByRole("textbox", { name: "One-time customer", exact: true })
    .fill("One Off");
  await page.locator("input[type=date]").fill("2026-10-21");
  await page.locator("textarea").first().fill("Custom client task");
  await page.locator("input[type=number]").fill("0");
  await page.getByRole("button", { name: "Save Task", exact: true }).click();
  await page.waitForFunction(async () => {
    const s = await (await import("./client.js")).api("get");
    return (
      s.tasks.some((t) => t.customer === "ONE OFF") &&
      !s.customers.includes("ONE OFF")
    );
  });
  await page.goto(base + "/weekly.html");
  await page.waitForSelector("#summary");
  await page.locator("#week").fill("2026-10-19");
  await page.locator("#week").dispatchEvent("change");
  await page.waitForFunction(
    () => document.querySelectorAll("article").length === 3,
  );
  assert.match(
    await page.locator("#summary").textContent(),
    /3 tasks · 3.5 hours/,
  );
  await page.locator("#preview").click();
  await page.waitForFunction(() => document.querySelector("#export").open);
  assert.equal(await page.locator("#confirmed").isChecked(), false);
  assert.equal(await page.locator("#download").isDisabled(), true);
  await page.waitForFunction(() =>
    document
      .querySelector("#warnings")
      .textContent.includes("Workbook validated"),
  );
  assert.equal(await page.locator("#sheetPreview .date-separator").count(), 5);
  assert.equal(
    await page.locator("#sheetPreview tbody tr:not(.date-separator)").count(),
    5,
  );
  await page.locator("#confirmed").check();
  // A persisted change invalidates the validated snapshot and confirmation.
  await page.evaluate(async () => {
    const { api } = await import("./client.js");
    await api("uppercase", { value: false });
  });
  await page.waitForFunction(
    () =>
      !document.querySelector("#confirmed").checked &&
      document.querySelector("#download").disabled,
  );
  await page.locator("#closeExport").click();
  await page.locator("#preview").click();
  await page.waitForFunction(() =>
    document
      .querySelector("#warnings")
      .textContent.includes("Workbook validated"),
  );
  await page.locator("#confirmed").check();
  await page.screenshot({ path: "tests/preview.png", fullPage: true });
  assert.equal(await page.evaluate(async()=>{const {api}=await import('./client.js');const {exportDataset}=await import('./xlsx.js');const {weekTasks}=await import('./core.js');const expected=exportDataset('2026-10-19',weekTasks(await api('get'),'2026-10-19')).flatMap(d=>d.rows).map(r=>r.map(String));const actual=Array.from(document.querySelectorAll('#sheetPreview tbody tr')).filter(r=>r.querySelectorAll('td').length===7).map(r=>Array.from(r.querySelectorAll('td')).map(c=>c.textContent));return JSON.stringify(actual)===JSON.stringify(expected);}),true);
  const pendingDownload = page.waitForEvent("download");
  let downloadCount=0;page.on('download',()=>downloadCount++);
  await page.evaluate(()=>{document.querySelector('#download').click();document.querySelector('#download').click();});
  const exported = await pendingDownload;
  assert.equal(exported.suggestedFilename(), "Timesheet_43_2026-10-19.xlsx");
  await exported.saveAs("tests/generated.xlsx");
  assert.equal(downloadCount,1);
  await page.screenshot({ path: "tests/weekly.png", fullPage: true });
  await page.locator("#week").fill("2026-12-28");
  await page.locator("#week").dispatchEvent("change");
  await page.locator("#next").click();
  assert.equal(await page.locator("#week").inputValue(), "2027-01-04");
  await page.locator("#prev").click();
  assert.equal(await page.locator("#week").inputValue(), "2026-12-28");
  await page.goto(base + "/settings.html");
  await page.waitForFunction(() =>
    document.querySelector("#templateStatus").textContent.includes("Ready"),
  );
  const pendingBackup = page.waitForEvent("download");
  await page.locator("#backup").click();
  const backupFile = await pendingBackup;
  const backupBytes = await fs.readFile(await backupFile.path());
  const parsedBackup = JSON.parse(backupBytes);
  assert.equal(parsedBackup.state.tasks.length, 3);
  assert.deepEqual(parsedBackup.template, Array.from(source));
  await page.locator("#restoreFile").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":9}'),
  });
  await page.locator("#restore").click();
  await page.waitForFunction(
    () =>
      document.querySelector("#message").textContent === "Unsupported backup.",
  );
  await page.locator("#restoreFile").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: backupBytes,
  });
  page.once("dialog", (d) => d.accept());
  await page.locator("#restore").click();
  await page.waitForFunction(
    () => document.querySelector("#message").textContent === "Backup restored.",
  );
  // Re-import through the real file picker as well as the background API.
  await page
    .locator("#template")
    .setInputFiles(path.join(root, "reference/Timesheet-43_2026-10-19.xlsx"));
  page.once("dialog", (d) => d.accept());
  await page.locator("#importTemplate").click();
  await page.waitForFunction(
    () =>
      document.querySelector("#message").textContent === "Template imported.",
  );
  await page.screenshot({ path: "tests/settings.png", fullPage: true });
  await page.getByLabel("New project", { exact: true }).fill("Alpha");
  await page.getByRole("button", { name: "Add Project", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelectorAll(".project-row").length === 1,
  );
  await page
    .getByLabel("Default project", { exact: true })
    .selectOption("Alpha");
  await page.waitForFunction(
    async () =>
      (await (await import("./client.js")).api("get")).defaultProject ===
      "Alpha",
  );
  await page.goto(base + "/popup.html");
  await page.waitForSelector("form");
  assert.equal(
    await page
      .getByLabel("Project Name (optional)", { exact: true })
      .inputValue(),
    "Alpha",
  );
  await page
    .getByLabel("Project Name (optional)", { exact: true })
    .selectOption("One-time project…");
  await page
    .getByRole("textbox", { name: "One-time project", exact: true })
    .fill("Temporary");
  await page.locator("textarea").first().fill("Project test");
  await page.locator("input[type=number]").fill("10");
  assert.match(
    await page.locator(".daily-summary").textContent(),
    /Overtime: [2-9]/,
  );
  await page.getByRole("button", { name: "Save Task", exact: true }).click();
  await page.waitForFunction(async () => {
    const s = await (await import("./client.js")).api("get");
    return (
      s.tasks.some((t) => t.projectName === "TEMPORARY") &&
      s.projects.length === 1
    );
  });
  await page.screenshot({ path: "tests/popup.png", fullPage: true });
  await page.goto(base + "/settings.html");
  await page.waitForSelector(".project-row");
  const history = await page.evaluate(async () =>
    JSON.stringify((await (await import("./client.js")).api("get")).tasks),
  );
  await page.locator(".project-row input").fill("Renamed");
  await page
    .locator(".project-row")
    .getByRole("button", { name: "Rename", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document.querySelector('select[aria-label="Default project"]').value ===
      "Renamed",
  );
  await page.getByLabel("Daily work-hour target", { exact: true }).fill("7.5");
  await page.getByRole("button", { name: "Save Target", exact: true }).click();
  await page.waitForFunction(
    async () =>
      (await (await import("./client.js")).api("get")).dailyTarget === 7.5,
  );
  page.once("dialog", (d) => d.accept());
  await page
    .locator(".project-row")
    .getByRole("button", { name: "Remove", exact: true })
    .click();
  await page.waitForFunction(() => !document.querySelector(".project-row"));
  assert.equal(
    await page.evaluate(async () =>
      JSON.stringify((await (await import("./client.js")).api("get")).tasks),
    ),
    history,
  );
  await page.evaluate(async () => {
    const { api } = await import("./client.js");
    const b = await api("backup");
    delete b.state.projects;
    delete b.state.defaultProject;
    delete b.state.dailyTarget;
    for (const t of b.state.tasks) delete t.projectName;
    await api("restore", { backup: b });
    const s = await api("get");
    if (
      s.projects.length ||
      s.dailyTarget !== 8 ||
      s.tasks.some((t) => t.projectName)
    )
      throw Error("Legacy backup compatibility failed");
  });
  assert.deepEqual(errors, []);
  assert.equal(
    hash(source),
    hash(await fs.readFile("reference/Timesheet-43_2026-10-19.xlsx")),
  );
  console.log(
    "PASS: Edge extension load, workbook overflow/empty/edit exports, storage CRUD, duplicate suppression, reload, default customer, uppercase, backup/restore, invalid backup, UI edit/delete, customer add, source integrity.",
  );
} finally {
  await context.close();
}
