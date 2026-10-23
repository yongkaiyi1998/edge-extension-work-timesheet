import { el, api, message } from "./client.js";
import { today, task, dailyHours } from "./core.js";
export function editor(host, s, existing, onSaved) {
  host.replaceChildren();
  const form = el("form");
  form.className = "task-editor";
  const fields = {};
  const t = existing ?? {
    id: crypto.randomUUID(),
    date: today(),
    customer: s.defaultCustomer,
    projectName: s.defaultProject,
    work: "",
    hours: "",
    status: "Completed",
    chargeable: "No",
    remarks: "",
  };
  function field(k, title, type, options) {
    const label = el("label", title);
    const input = el(
      options ? "select" : type === "textarea" ? "textarea" : "input",
    );
    if (options)
      for (const v of options)
        input.append(el("option", v || "Choose customer", { value: v }));
    else if (type !== "textarea") input.type = type;
    input.value = t[k] ?? "";
    input.setAttribute('aria-label',title);
    label.className = "field-" + k;
    input.required = ["date", "customer", "work", "hours"].includes(k);
    if (k === "hours") {
      input.min = "0";
      input.step = "any";
    }
    label.append(input);
    form.append(label);
    fields[k] = input;
    return input;
  }
  field("date", "Date", "date");
  const c = field("customer", "Customer", null, [
    "",
    ...s.customers,
    ...(t.customer && !s.customers.includes(t.customer) ? [t.customer] : []),
    "One-time custom entry…",
  ]);
  const custom = el("input", "", {
    placeholder: "One-time customer",
    hidden: true,
  });
  custom.setAttribute("aria-label", "One-time customer");
  form.append(custom);
  c.onchange = () => {
    custom.hidden = c.value !== "One-time custom entry…";
    custom.required = !custom.hidden;
  };
  const p = field("projectName", "Project Name (optional)", null, [
    "",
    ...s.projects,
    ...(t.projectName && !s.projects.includes(t.projectName)
      ? [t.projectName]
      : []),
    "One-time project…",
  ]);
  const projectCustom = el("input", "", {
    placeholder: "One-time project",
    hidden: true,
  });
  projectCustom.setAttribute("aria-label", "One-time project");
  form.append(projectCustom);
  p.onchange = () => {
    projectCustom.hidden = p.value !== "One-time project…";
    projectCustom.required = !projectCustom.hidden;
  };
  field("work", "Task / Work", "textarea");
  field("hours", "Hours Spent", "number");
  const summary = el("output", "", { className: "daily-summary" });
  summary.setAttribute("aria-live", "polite");
  form.append(summary);
  function updateHours() {
    const h = dailyHours(
      s.tasks,
      fields.date.value,
      Number(fields.hours.value),
      s.dailyTarget,
      existing?.id,
    );
    const fmt = (n) => Number(n.toFixed(8));
    summary.textContent = `Logged Hours: ${fmt(h.logged)} · Remaining Hours: ${fmt(h.remaining)} · Overtime: ${fmt(h.overtime)} (target ${s.dailyTarget} h; includes draft)`;
  }
  fields.date.addEventListener("input", updateHours);
  fields.hours.addEventListener("input", updateHours);
  updateHours();
  const changed = async () => {
    try {
      s = await api("get");
      updateHours();
    } catch (e) {
      message(e.message, true);
    }
  };
  chrome.storage.onChanged.addListener(changed);
  const observer = new MutationObserver(() => {
    if (!form.isConnected) {
      chrome.storage.onChanged.removeListener(changed);
      observer.disconnect();
    }
  });
  observer.observe(host, { childList: true });
  field("status", "Status", null, ["Completed", "In Progress", "Pending"]);
  field("chargeable", "Chargeable", null, ["Yes", "No"]);
  field("remarks", "Remarks (optional)", "textarea");
  const label = el("label");
  const upper = el("input", "", { type: "checkbox", checked: s.uppercase });
  label.append(upper, " Auto UPPERCASE on save");
  form.append(label);
  upper.onchange = async () => {
    try {
      await api("uppercase", { value: upper.checked });
    } catch (e) {
      message(e.message, true);
    }
  };
  const save = el("button", existing ? "Save Changes" : "Save Task", {
    type: "submit",
  });
  form.append(save);
  let busy = false;
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    busy = true;
    save.disabled = true;
    try {
      const next = { id: t.id };
      for (const k of Object.keys(fields)) next[k] = fields[k].value;
      next.customer = custom.hidden ? c.value : custom.value;
      next.projectName = projectCustom.hidden ? p.value : projectCustom.value;
      next.hours = Number(next.hours);
      if (fields.hours.value.trim() === "") throw Error("Enter hours.");
      for (const k of ["customer", "projectName", "work", "remarks"])
        next[k] = upper.checked ? next[k].trim().toUpperCase() : next[k].trim();
      task(next);
      await api("save", {
        task: next,
        edit: !!existing,
        original: existing,
        uppercase: upper.checked,
      });
      message("Task saved.");
      await onSaved();
    } catch (err) {
      message(err.message, true);
    } finally {
      busy = false;
      save.disabled = false;
    }
  };
  host.append(form);
}
