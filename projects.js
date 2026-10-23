import { api, el, message, action } from "./client.js";
const section = el("section");
section.append(
  el("h2", "Projects & working hours"),
  el(
    "p",
    "Project changes affect saved choices only. Historical tasks stay unchanged.",
    { className: "muted" },
  ),
);
const list = el("div"),
  form = el("form"),
  label = el("label", "New project"),
  input = el("input", "", { required: true });
label.append(input);
form.append(label, el("button", "Add Project"));
const defaultLabel = el("label", "Default project"),
  select = el("select");
defaultLabel.append(select);
select.setAttribute('aria-label','Default project');
const targetLabel = el("label", "Daily work-hour target"),
  target = el("input", "", {
    type: "number",
    min: "0",
    step: "any",
    required: true,
  });
targetLabel.append(target);
const saveTarget = el("button", "Save Target");
section.append(list, form, defaultLabel, targetLabel, saveTarget);
document.querySelector("section").after(section);
let current;
async function save(
  projects = current.projects,
  defaultProject = current.defaultProject,
  dailyTarget = current.dailyTarget,
) {
  await api("projects", {
    projects,
    defaultProject,
    dailyTarget,
    original: [current.projects, current.defaultProject, current.dailyTarget],
  });
  await render();
  message("Project settings saved.");
}
async function render() {
  current = await api("get");
  list.replaceChildren();
  for (const p of current.projects) {
    const row = el("div", "", { className: "project-row" }),
      name = el("input", "", { value: p });
    name.setAttribute("aria-label", "Project name");
    const rename = el("button", "Rename"),
      remove = el("button", "Remove", { className: "secondary" });
    rename.onclick = action(async () => {
      const next = name.value.trim();
      if (!next || (next !== p && current.projects.includes(next)))
        throw Error("Enter a unique project name.");
      await save(
        current.projects.map((x) => (x === p ? next : x)),
        current.defaultProject === p ? next : current.defaultProject,
      );
    });
    remove.onclick = action(async () => {
      if (confirm(`Remove ${p}? Historical tasks stay unchanged.`))
        await save(
          current.projects.filter((x) => x !== p),
          current.defaultProject === p ? "" : current.defaultProject,
        );
    });
    row.append(name, rename, remove);
    list.append(row);
  }
  select.replaceChildren(el("option", "None", { value: "" }));
  current.projects.forEach((p) => select.append(el("option", p, { value: p })));
  select.value = current.defaultProject;
  target.value = current.dailyTarget;
}
select.onchange = action(async () => save(current.projects, select.value));
saveTarget.onclick = action(async () => {
  const n = Number(target.value);
  if (target.value.trim() === "" || !Number.isFinite(n) || n < 0)
    throw Error("Enter a finite nonnegative daily target.");
  await save(current.projects, current.defaultProject, n);
});
form.onsubmit = async (e) => {
  e.preventDefault();
  const b = e.submitter;
  if (b.disabled) return;
  b.disabled = true;
  try {
    const p = input.value.trim();
    if (!p || current.projects.includes(p))
      throw Error("Enter a unique project name.");
    await save([...current.projects, p]);
    input.value = "";
  } catch (e) {
    message(e.message, true);
  } finally {
    b.disabled = false;
  }
};
// Restore may replace these preferences while this tab is open.
document.addEventListener("data-restored", () =>
  render().catch((e) => message(e.message, true)),
);
render().catch((e) => message(e.message, true));
