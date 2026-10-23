import { api, $, el, message, action, download } from "./client.js";
import {
  today,
  monday,
  addDays,
  weekTasks,
  filename,
  weekNumber,
} from "./core.js";
import { editor } from "./editor.js";
import { selectedTemplate } from "./templates.js";
import { exportColumns, exportDataset, exportWeek } from "./xlsx.js";
let selected = monday(today());
async function render() {
  const s = await api("get");
  const tasks = weekTasks(s, selected);
  $("#week").value = selected;
  $("#range").textContent =
    `${selected} – ${addDays(selected, 4)} · ISO week ${weekNumber(selected)}`;
  $("#summary").textContent =
    `${tasks.length} tasks · ${tasks.reduce((n, t) => n + t.hours, 0)} hours`;
  $("#days").replaceChildren();
  for (let i = 0; i < 7; i++) {
    const day = addDays(selected, i),
      list = tasks.filter((t) => t.date === day);
    if (i > 4 && !list.length) continue;
    const sec = el("section");
    sec.append(
      el(
        "h2",
        `${["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][i]} · ${day} · ${list.reduce((n, t) => n + t.hours, 0)} h`,
      ),
    );
    if (!list.length) sec.append(el("p", "No tasks", { className: "muted" }));
    for (const t of list) {
      const a = el("article", undefined, { className: "task-row" });
      const work = el("div", undefined, { className: "work" });
      work.append(el("p", t.work));
      const details = el("details"),
        summary = el("summary", "Details");
      details.append(summary, el("p", `Chargeable: ${t.chargeable}`));
      if (t.remarks) details.append(el("p", t.remarks));
      work.append(details);
      a.append(
        work,
        el("span", t.projectName || "—", { className: "project" }),
        el("span", t.customer, { className: "client" }),
        el("strong", `${t.hours} h`, { className: "hours" }),
        el("span", t.status, { className: "status" }),
      );
      const edit = el("button", "Edit", { className: "secondary" }),
        del = el("button", "Delete", { className: "secondary" });
      edit.onclick = action(async () => {
        editor($("#editor"), await api("get"), t, async () => {
          $("#edit").close();
          await render();
        });
        $("#edit").showModal();
      });
      del.onclick = action(async () => {
        if (confirm("Delete this task permanently?")) {
          await api("delete", { id: t.id });
          await render();
          message("Task deleted.");
        }
      });
      const actions = el("div", undefined, { className: "row-actions" });
      actions.append(edit, del);
      a.append(actions);
      sec.append(a);
    }
    $("#days").append(sec);
  }
}
$("#prev").onclick = action(async () => {
  selected = addDays(selected, -7);
  await render();
});
$("#next").onclick = action(async () => {
  selected = addDays(selected, 7);
  await render();
});
$("#current").onclick = action(async () => {
  selected = monday(today());
  await render();
});
$("#week").onchange = action(async () => {
  selected = monday($("#week").value);
  await render();
});
$("#closeEdit").onclick = () => $("#edit").close();
$("#closeExport").onclick = () => $("#export").close();
let prepared = null,
  downloading = false,
  revision = 0;
function invalidate() {
  revision++;
  prepared = null;
  $("#confirmed").checked = false;
  $("#download").disabled = true;
  if ($("#export").open)
    $("#warnings").textContent =
      "Data or week changed. Close and reopen Export Preview to validate again.";
}
const fingerprint = (s, week) =>
  JSON.stringify([week, s.templateMode, s.templateKey, weekTasks(s, week)]);
$("#confirmed").onchange = () => {
  $("#download").disabled =
    !prepared || !$("#confirmed").checked || downloading;
};
$("#preview").onclick = action(async () => {
  invalidate();
  const ticket = revision,
    week = selected;
  $("#sheetPreview").replaceChildren();
  $("#warnings").textContent = "Validating workbook…";
  $("#warnings").className = "";
  $("#details").textContent = "";
  $("#export").showModal();
  try {
    const s = await api("get"),
      tasks = weekTasks(s, week),
      bytes = await selectedTemplate(s);
    const dataset = exportDataset(week, tasks);
    $("#details").textContent =
      week +
      " – " +
      addDays(week, 4) +
      " · " +
      filename(week) +
      " · " +
      tasks.length +
      " tasks · " +
      tasks.reduce((n, t) => n + t.hours, 0) +
      " hours";
    const head = el("thead"),
      hr = el("tr");
    exportColumns.forEach((c) => {
      const th = el("th", c);
      th.scope = "col";
      hr.append(th);
    });
    head.append(hr);
    const body = el("tbody");
    dataset.forEach((day) => {
      const row = el("tr", undefined, { className: "date-separator" }),
        th = el(
          "th",
          day.date +
            " (" +
            new Intl.DateTimeFormat("en", {
              weekday: "short",
              timeZone: "UTC",
            }).format(new Date(day.date + "T12:00:00Z")) +
            ")",
        );
      th.colSpan = 7;
      th.scope = "rowgroup";
      row.append(th);
      body.append(row);
      if (!day.rows.length) {
        const empty = el("tr"),
          td = el("td", "No tasks", { className: "muted" });
        td.colSpan = 7;
        empty.append(td);
        body.append(empty);
      }
      day.rows.forEach((values) => {
        const tr = el("tr");
        values.forEach((v) => tr.append(el("td", String(v))));
        body.append(tr);
      });
    });
    $("#sheetPreview").replaceChildren(head, body);
    if (!bytes) throw Error("Template missing. Import one in Settings.");
    const result = exportWeek(bytes, week, tasks, {
      autoHeight: s.templateMode === "default",
    });
    const latest = await api("get");
    if (
      ticket !== revision ||
      week !== selected ||
      fingerprint(s, week) !== fingerprint(latest, week)
    )
      throw Error("Data changed during validation. Reopen preview.");
    prepared = { ...result, key: fingerprint(s, week) };
    $("#warnings").textContent =
      "Workbook validated. Review all five days, then confirm below. Long text may need row resizing in Excel.";
  } catch (e) {
    prepared = null;
    $("#warnings").textContent = e.message;
    $("#warnings").className = "error";
  }
});
$("#download").onclick = async () => {
  if (downloading || !prepared || !$("#confirmed").checked) return;
  downloading = true;
  $("#download").disabled = true;
  try {
    const latest = await api("get"),
      file = prepared;
    if (!file || file.key !== fingerprint(latest, selected)) {
      invalidate();
      throw Error("Saved data changed. Reopen preview and confirm again.");
    }
    prepared = null;
    $("#confirmed").checked = false;
    download(
      file.bytes,
      file.filename,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    $("#export").close();
    message("Validated XLSX download started. Tasks retained.");
  } catch (e) {
    message(e.message, true);
  } finally {
    downloading = false;
    $("#download").disabled = true;
  }
};
chrome.storage.onChanged.addListener(() => {
  invalidate();
  render().catch((e) => message(e.message, true));
});
$("#week").addEventListener("change", invalidate);
for (const id of ["prev", "next", "current"])
  $("#" + id).addEventListener("click", invalidate);
render().catch((e) => message(e.message, true));
