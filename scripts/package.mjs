// Explicit allowlist: private reference files and test fixtures can never enter.
import fs from "node:fs/promises";
import { zipSync } from "../vendor/fflate.js";
const names = [
  "manifest.json",
  "background.js",
  "client.js",
  "core.js",
  "db.js",
  "editor.js",
  "popup.js",
  "popup.html",
  "weekly.js",
  "weekly.html",
  "settings.js",
  "settings.html",
  "projects.js",
  "templates.js",
  "xlsx.js",
  "style.css",
  "vendor/fflate.js",
  "vendor/LICENSE",
  "README.md",
  "QA.md",
  ...[
    "quick-add",
    "weekly-dashboard",
    "export-preview",
    "settings-templates",
  ].map((n) => "docs/screenshots/" + n + ".png"),
];
const files = Object.fromEntries(
  await Promise.all(
    names.map(async (n) => [n, new Uint8Array(await fs.readFile(n))]),
  ),
);
await fs.mkdir("dist", { recursive: true });
await fs.writeFile(
  "dist/quick-timesheet-0.3.0.zip",
  zipSync(files, { level: 6 }),
);
console.log(
  "Packaged " + names.length + " public files; reference/ and tests/ excluded.",
);
