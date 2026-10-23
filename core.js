export const initial = () => ({
  version: 1,
  tasks: [],
  customers: [],
  projects: [],
  defaultProject: "",
  dailyTarget: 8,
  defaultCustomer: "",
  uppercase: true,
  templateKey: null,
  templateMode: "default",
});
export function date(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s))
    throw Error("Use a valid date.");
  const d = new Date(s + "T12:00:00Z");
  if (!Number.isFinite(+d) || d.toISOString().slice(0, 10) !== s)
    throw Error("Use a valid date.");
  return d;
}
export const iso = (d) => d.toISOString().slice(0, 10);
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export function addDays(s, n) {
  const d = date(s);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}
export function monday(s) {
  const d = date(s);
  return addDays(s, -((d.getUTCDay() + 6) % 7));
}
export function weekNumber(s) {
  const d = date(monday(s));
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 3);
  return Math.ceil(
    ((+d - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7,
  );
}
export const filename = (s) => `Timesheet_${weekNumber(s)}_${monday(s)}.xlsx`;
export function task(t) {
  if (t?.projectName !== undefined && typeof t.projectName !== "string")
    throw Error("Invalid project name.");
  if (
    t?.projectName &&
    (t.projectName.length > 32767 ||
      /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(t.projectName))
  )
    throw Error("Invalid project text.");
  if (!t || typeof t.id !== "string" || !t.id.trim())
    throw Error("Invalid task ID.");
  date(t.date);
  for (const k of ["customer", "work"])
    if (typeof t[k] !== "string" || !t[k].trim())
      throw Error("Customer and work are required.");
  if (typeof t.hours !== "number" || !Number.isFinite(t.hours) || t.hours < 0)
    throw Error("Hours must be finite and nonnegative.");
  if (
    !["Completed", "In Progress", "Pending"].includes(t.status) ||
    !["Yes", "No"].includes(t.chargeable) ||
    typeof t.remarks !== "string"
  )
    throw Error("Invalid task details.");
  for (const k of ["customer", "work", "remarks"])
    if (t[k].length > 32767 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(t[k]))
      throw Error(
        "Text contains unsupported characters or exceeds Excel’s cell limit.",
      );
  return t;
}
export function state(s) {
  if (
    !s ||
    s.version !== 1 ||
    !Array.isArray(s.tasks) ||
    !Array.isArray(s.customers) ||
    typeof s.uppercase !== "boolean" ||
    typeof s.defaultCustomer !== "string" ||
    !(s.templateKey === null || typeof s.templateKey === "string")
  )
    throw Error("Invalid or unsupported data version.");
  s.tasks.forEach(task);
  if (s.templateMode === undefined)
    s.templateMode = s.templateKey ? "custom" : "default";
  if (!["default", "custom"].includes(s.templateMode))
    throw Error("Invalid template mode.");
  s.projects ??= [];
  s.defaultProject ??= "";
  s.dailyTarget ??= 8;
  if (
    !Array.isArray(s.projects) ||
    s.projects.some((p) => typeof p !== "string" || !p.trim()) ||
    new Set(s.projects).size !== s.projects.length ||
    typeof s.defaultProject !== "string" ||
    (s.defaultProject && !s.projects.includes(s.defaultProject)) ||
    typeof s.dailyTarget !== "number" ||
    !Number.isFinite(s.dailyTarget) ||
    s.dailyTarget < 0
  )
    throw Error("Invalid project setup or daily target.");
  if (new Set(s.tasks.map((t) => t.id)).size !== s.tasks.length)
    throw Error("Duplicate task IDs.");
  if (
    s.customers.some((c) => typeof c !== "string" || !c.trim()) ||
    new Set(s.customers).size !== s.customers.length ||
    (s.defaultCustomer && !s.customers.includes(s.defaultCustomer))
  )
    throw Error("Invalid customer setup.");
  return s;
}
export function dailyHours(
  tasks,
  selected,
  draft,
  target = 8,
  editingId = null,
) {
  const logged = tasks
    .filter((t) => t.date === selected && t.id !== editingId)
    .reduce((n, t) => n + t.hours, 0);
  const proposed = Number.isFinite(draft) && draft >= 0 ? draft : 0;
  return {
    logged,
    remaining: Math.max(0, target - logged - proposed),
    overtime: Math.max(0, logged + proposed - target),
  };
}
export function weekTasks(s, m) {
  date(m);
  return s.tasks
    .filter((t) => t.date >= m && t.date <= addDays(m, 6))
    .sort((a, b) => a.date.localeCompare(b.date));
}
