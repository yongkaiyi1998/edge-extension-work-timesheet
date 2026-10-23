import { initial, state, task } from "./core.js";
import { templateGet, templatePut } from "./db.js";
let queue = Promise.resolve();
async function run(m) {
  const stored = (await chrome.storage.local.get("state")).state;
  let s = state(stored === undefined ? initial() : stored);
  if (m.op === "get") return s;
  if (m.op === "save") {
    task(m.task);
    const at = s.tasks.findIndex((t) => t.id === m.task.id);
    if (m.edit && at < 0) throw Error("Task was deleted in another window.");
    if (!m.edit && at >= 0) return s;
    if (m.edit && JSON.stringify(s.tasks[at]) !== JSON.stringify(m.original))
      throw Error("Task changed in another window. Reopen the editor.");
    if (at < 0) s.tasks.push(m.task);
    else s.tasks[at] = m.task;
    s.uppercase = !!m.uppercase;
  } else if (m.op === "delete") s.tasks = s.tasks.filter((t) => t.id !== m.id);
  else if (m.op === "customers") {
    if (
      m.original &&
      (JSON.stringify(s.customers) !== JSON.stringify(m.original.customers) ||
        s.defaultCustomer !== m.original.defaultCustomer)
    )
      throw Error(
        "Customers changed in another window. Reload Settings before trying again.",
      );
    s.customers = m.customers;
    s.defaultCustomer = m.defaultCustomer;
  } else if (m.op === "projects") {
    if (
      m.original &&
      JSON.stringify([s.projects, s.defaultProject, s.dailyTarget]) !==
        JSON.stringify(m.original)
    )
      throw Error("Project settings changed. Reload Settings.");
    s.projects = m.projects;
    s.defaultProject = m.defaultProject;
    s.dailyTarget = m.dailyTarget;
  } else if (m.op === "uppercase") s.uppercase = !!m.value;
  else if (m.op === "template") {
    if (
      !Array.isArray(m.bytes) ||
      m.bytes.length > 20000000 ||
      m.bytes[0] !== 80 ||
      m.bytes[1] !== 75 ||
      m.bytes.some((v) => !Number.isInteger(v) || v < 0 || v > 255)
    )
      throw Error("Invalid template bytes.");
    s.templateKey = await templatePut(new Uint8Array(m.bytes).buffer);
  } else if (m.op === "backup") {
    const bytes = await templateGet(s.templateKey);
    if (s.templateKey && !bytes)
      throw Error("Template is missing. Import it again before backing up.");
    return {
      format: "quick-timesheet",
      version: 1,
      state: s,
      template: bytes ? Array.from(new Uint8Array(bytes)) : null,
    };
  } else if (m.op === "restore") {
    const b = m.backup;
    if (b?.format !== "quick-timesheet" || b.version !== 1)
      throw Error("Unsupported backup.");
    s = state(b.state);
    if (
      b.template !== null &&
      (!Array.isArray(b.template) ||
        b.template.length > 20000000 ||
        b.template.some((v) => !Number.isInteger(v) || v < 0 || v > 255))
    )
      throw Error("Invalid template backup.");
    if (!!s.templateKey !== (b.template !== null))
      throw Error("Incomplete template backup.");
    s.templateKey =
      b.template === null
        ? null
        : await templatePut(new Uint8Array(b.template).buffer);
  } else throw Error("Unknown operation.");
  state(s);
  await chrome.storage.local.set({ state: s });
  return s;
}
chrome.runtime.onMessage.addListener((m, sender, respond) => {
  if (sender.id !== chrome.runtime.id) return;
  const job = queue.then(() => run(m));
  queue = job.catch(() => {});
  job.then(
    (value) => respond({ value }),
    (e) => respond({ error: e.message }),
  );
  return true;
});
