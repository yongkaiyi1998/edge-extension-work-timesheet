import { api, $, el, message, action, download } from "./client.js";
import { state } from "./core.js";
import { templateGet } from "./db.js";
import { templateSummary } from "./xlsx.js";
import "./projects.js";
let snapshot;
function saveCustomers(values) {
  return api("customers", {
    ...values,
    original: {
      customers: snapshot.customers,
      defaultCustomer: snapshot.defaultCustomer,
    },
  });
}
async function render() {
  snapshot = await api("get");
  $("#customers").replaceChildren();
  for (const c of snapshot.customers) {
    const row = el("div", "", { className: "customer" }),
      input = el("input", "", { value: c });
    input.setAttribute("aria-label", "Customer name");
    const rename = el("button", "Rename"),
      remove = el("button", "Remove", { className: "secondary" });
    rename.onclick = action(async () => {
      const name = input.value.trim();
      if (!name) throw Error("Enter a customer name.");
      if (name !== c && snapshot.customers.includes(name))
        throw Error("Customer already exists.");
      await saveCustomers({
        customers: snapshot.customers.map((x) => (x === c ? name : x)),
        defaultCustomer:
          snapshot.defaultCustomer === c ? name : snapshot.defaultCustomer,
      });
      await render();
      message("Customer renamed.");
    });
    remove.onclick = action(async () => {
      if (
        !confirm(
          `Remove ${c} from saved customers? Historical tasks stay unchanged.`,
        )
      )
        return;
      await saveCustomers({
        customers: snapshot.customers.filter((x) => x !== c),
        defaultCustomer:
          snapshot.defaultCustomer === c ? "" : snapshot.defaultCustomer,
      });
      await render();
    });
    row.append(input, rename, remove);
    $("#customers").append(row);
  }
  const select = $("#defaultCustomer");
  select.replaceChildren(el("option", "None", { value: "" }));
  snapshot.customers.forEach((c) =>
    select.append(el("option", c, { value: c })),
  );
  select.value = snapshot.defaultCustomer;
  $("#templateMode").value = snapshot.templateMode;
  const bytes = await templateGet(snapshot.templateKey);
  try {
    $("#templateStatus").textContent =
      snapshot.templateMode === "default"
        ? "Ready · Default Template (built-in). No import needed."
        : bytes
          ? templateSummary(bytes)
          : "Custom template missing. Import one or choose Default Template.";
  } catch (e) {
    $("#templateStatus").textContent =
      "Custom template invalid: " +
      e.message +
      " Select Default Template or replace the custom file.";
  }
}
$("#templateMode").onchange = action(async () => {
  await api("templateMode", { mode: $("#templateMode").value });
  await render();
  message("Export template selection saved.");
});
$("#addCustomer").onsubmit = async (e) => {
  e.preventDefault();
  const b = e.submitter;
  if (b.disabled) return;
  b.disabled = true;
  try {
    const c = $("#newCustomer").value.trim();
    if (!c || snapshot.customers.includes(c))
      throw Error("Enter a new, unique customer.");
    await saveCustomers({
      customers: [...snapshot.customers, c],
      defaultCustomer: snapshot.defaultCustomer,
    });
    $("#newCustomer").value = "";
    await render();
    message("Customer saved.");
  } catch (err) {
    message(err.message, true);
  } finally {
    b.disabled = false;
  }
};
$("#defaultCustomer").onchange = action(async () => {
  await saveCustomers({
    customers: snapshot.customers,
    defaultCustomer: $("#defaultCustomer").value,
  });
  await render();
  message("Default customer saved.");
});
$("#importTemplate").onclick = action(async () => {
  const f = $("#template").files[0];
  if (!f) throw Error("Select an XLSX template.");
  const bytes = await f.arrayBuffer();
  templateSummary(bytes);
  if (snapshot.templateKey && !confirm("Replace the imported template?"))
    return;
  await api("template", { bytes });
  await render();
  message("Template imported.");
});
$("#backup").onclick = action(async () => {
  const b = await api("backup");
  download(
    JSON.stringify(b),
    `QuickTimesheet_Backup_${new Date().toISOString().slice(0, 10)}.json`,
    "application/json",
  );
  message("Backup download started.");
});
$("#restore").onclick = action(async () => {
  const file = $("#restoreFile").files[0];
  if (!file) throw Error("Choose a JSON backup.");
  if (file.size > 100000000) throw Error("Backup exceeds 100 MB.");
  const b = JSON.parse(await file.text());
  if (b.format !== "quick-timesheet" || b.version !== 1)
    throw Error("Unsupported backup.");
  state(b.state);
  if (b.template !== null) {
    if (
      !Array.isArray(b.template) ||
      b.template.some((n) => !Number.isInteger(n) || n < 0 || n > 255)
    )
      throw Error("Invalid template bytes.");
    templateSummary(new Uint8Array(b.template).buffer);
  }
  if (!!b.state.templateKey !== (b.template !== null))
    throw Error("Backup template is incomplete.");
  if (
    !confirm(
      `Replace ALL data with ${b.state.tasks.length} tasks from this backup? Make a current backup first.`,
    )
  )
    return;
  await api("restore", { backup: b });
  document.dispatchEvent(new Event("data-restored"));
  await render();
  message("Backup restored.");
});
render().catch((e) => message(e.message, true));
