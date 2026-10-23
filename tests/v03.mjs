import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const runtime =
  process.env.CODEX_NODE_MODULES ||
  "C:/Users/infonal/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
const { chromium } = require(path.join(runtime, "playwright-core"));
const root = path.resolve("."),
  profile = await fs.mkdtemp(path.join(os.tmpdir(), "timesheet-v03-"));
await fs.mkdir("docs/screenshots", { recursive: true });
const context = await chromium.launchPersistentContext(profile, {
  executablePath:
    process.env.CHROMIUM_PATH ||
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
  ignoreDefaultArgs: ["--disable-extensions"],
  args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`],
});
try {
  const worker =
    context.serviceWorkers()[0] ||
    (await context.waitForEvent("serviceworker"));
  const base = worker.url().split("/").slice(0, 3).join("/");
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/weekly.html");
  await page.waitForSelector("#summary");
  assert.equal(
    await page.evaluate(
      async () => (await (await import("./client.js")).api("get")).templateMode,
    ),
    "default",
  );
  await page.locator("#preview").click();
  await page.waitForFunction(() =>
    document
      .querySelector("#warnings")
      .textContent.includes("Workbook validated"),
  );
  assert.equal(await page.locator("#download").isDisabled(), true);
  await page.locator("#confirmed").check();
  const empty = page.waitForEvent("download");
  await page.locator("#download").click();
  await (await empty).saveAs("tests/default-empty.xlsx");
  const overflow = await page.evaluate(async () => {
    const { defaultTemplate } = await import("./templates.js");
    const { exportWeek } = await import("./xlsx.js");
    const { state, initial, addDays } = await import("./core.js");
    if (
      state({ ...initial(), templateMode: undefined, templateKey: "old-id" })
        .templateMode !== "custom"
    )
      throw Error("Existing selection lost");
    const tasks = Array.from({ length: 60 }, (_, i) => ({
      id: "overflow-" + i,
      date: addDays("2026-12-28", Math.floor(i / 12)),
      projectName: "Demo Project",
      customer: "Demo Customer",
      work: "Long fictional description ".repeat(30),
      hours: 0.5,
      status: "In Progress",
      chargeable: "No",
      remarks: "Demonstration only",
    }));
    const out = exportWeek(defaultTemplate(), "2026-12-28", tasks, {
      autoHeight: true,
    });
    if (out.filename !== "Timesheet_53_2026-12-28.xlsx" || out.count !== 60)
      throw Error("Default overflow failed");
    return Array.from(out.bytes);
  });
  await fs.writeFile("tests/default-overflow.xlsx", new Uint8Array(overflow));
  await page.evaluate(async () => {
    const { api } = await import("./client.js");
    const { defaultTemplate } = await import("./templates.js");
    await api("customers", {
      customers: ["Demo Studio", "Sample Workshop"],
      defaultCustomer: "Demo Studio",
    });
    await api("projects", {
      projects: ["Website Refresh", "Research Sprint"],
      defaultProject: "Website Refresh",
      dailyTarget: 8,
    });
    for (const [i, date, work, hours, status] of [
      [0, "2026-10-19", "Plan navigation and page structure", 2, "Completed"],
      [
        1,
        "2026-10-20",
        "Build and review the draft interface",
        3,
        "In Progress",
      ],
      [
        2,
        "2026-10-21",
        "Test keyboard navigation and focus states",
        2.5,
        "Completed",
      ],
      [3, "2026-10-23", "Prepare next week’s research notes", 1, "Pending"],
    ])
      await api("save", {
        task: {
          id: "demo-" + i,
          date,
          work,
          hours,
          status,
          projectName: i === 3 ? "Research Sprint" : "Website Refresh",
          customer: i === 3 ? "Sample Workshop" : "Demo Studio",
          chargeable: "No",
          remarks: "Fictional demonstration entry",
        },
        uppercase: false,
      });
    // Use a separately generated generic file as custom fixture, never the private reference.
    await api("template", { bytes: defaultTemplate() });
    const before = await api("backup");
    await api("templateMode", { mode: "default" });
    const after = await api("backup");
    if (
      JSON.stringify(before.template) !== JSON.stringify(after.template) ||
      JSON.stringify(before.state.tasks) !== JSON.stringify(after.state.tasks)
    )
      throw Error("Switch damaged data");
    delete before.state.templateMode;
    await api("restore", { backup: before });
    if ((await api("get")).templateMode !== "custom")
      throw Error("Legacy custom backup migration failed");
    await api("templateMode", { mode: "default" });
  });
  await page.goto(base + "/popup.html");
  await page.setViewportSize({ width: 440, height: 680 });
  await page.waitForSelector(".daily-summary");
  await page.locator("input[type=date]").fill("2026-10-21");
  await page
    .locator("textarea")
    .first()
    .fill("Review the final accessibility checklist");
  await page.locator("input[type=number]").fill("1.5");
  await page
    .locator("body")
    .screenshot({ path: "docs/screenshots/quick-add.png" });
  await page.setViewportSize({ width: 1440, height: 1040 });
  await page.goto(base + "/weekly.html");
  await page.waitForSelector("#summary");
  await page.locator("#week").fill("2026-10-19");
  await page.locator("#week").dispatchEvent("change");
  await page.waitForFunction(
    () => document.querySelectorAll("article").length === 4,
  );
  await page.screenshot({
    path: "docs/screenshots/weekly-dashboard.png",
    fullPage: true,
  });
  await page.locator("#preview").click();
  await page.waitForFunction(() =>
    document
      .querySelector("#warnings")
      .textContent.includes("Workbook validated"),
  );
  await page.locator("#confirmed").check();
  await page.evaluate(async () => {
    await (await import("./client.js")).api("templateMode", { mode: "custom" });
  });
  await page.waitForFunction(
    () =>
      !document.querySelector("#confirmed").checked &&
      document.querySelector("#download").disabled,
  );
  await page.locator("#closeExport").click();
  await page.evaluate(async () => {
    await (
      await import("./client.js")
    ).api("templateMode", { mode: "default" });
  });
  await page.locator("#preview").click();
  await page.waitForFunction(() =>
    document
      .querySelector("#warnings")
      .textContent.includes("Workbook validated"),
  );
  await page
    .locator("#export")
    .screenshot({ path: "docs/screenshots/export-preview.png" });
  await page.locator("#confirmed").check();
  const demo = page.waitForEvent("download");
  await page.locator("#download").click();
  await (await demo).saveAs("tests/default-demo.xlsx");
  await page.goto(base + "/settings.html");
  await page.waitForSelector("#templateMode");
  await page.waitForFunction(() =>
    document.querySelector("#templateStatus").textContent.includes("Ready"),
  );
  await page.screenshot({
    path: "docs/screenshots/settings-templates.png",
    fullPage: true,
  });
  await page.locator("#templateMode").selectOption("custom");
  await page.waitForFunction(() =>
    document.querySelector("#templateStatus").textContent.includes("Ready"),
  );
  await page.locator("#templateMode").selectOption("default");
  await page.waitForFunction(()=>document.querySelector('#templateStatus').textContent.includes('Default Template'));
  await worker.evaluate(async()=>{const {state}=await chrome.storage.local.get('state');await chrome.storage.local.set({state:{...state,templateMode:'custom',templateKey:'missing-test-key'}});});
  await page.reload();await page.waitForFunction(()=>document.querySelector('#templateStatus').textContent.includes('Custom template missing'));
  await page.locator('#templateMode').selectOption('default');await page.waitForFunction(()=>document.querySelector('#templateStatus').textContent.includes('Default Template'));
  assert.equal(await page.evaluate(async()=> (await (await import('./client.js')).api('get')).templateKey),'missing-test-key');
  await page.evaluate(async()=>{const {api}=await import('./client.js');await api('template',{bytes:new Uint8Array([80,75,1,2]).buffer});});
  await page.reload();await page.waitForFunction(()=>document.querySelector('#templateStatus').textContent.includes('Custom template invalid'));
  await page.locator('#templateMode').selectOption('default');await page.waitForFunction(()=>document.querySelector('#templateStatus').textContent.includes('Default Template'));
  assert.deepEqual(errors, []);
  console.log(
    "PASS V0.3: fresh export, generic overflow/year boundary, legacy selection/backup, lossless switching, confirmation invalidation, four fictional UI screenshots.",
  );
} finally {
  await context.close();
}
