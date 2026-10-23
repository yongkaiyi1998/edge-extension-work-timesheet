# Quick Timesheet — Local Edition 0.2.1

V0.2 adds independent projects (saved/default/one-time), a configurable daily target (8 h initially), and a live logged/remaining/overtime preview that excludes the original task when editing. Overtime is informational. New tasks default to Chargeable No; existing values remain intact. Old tasks and version-1 backups remain readable without assigning projects to historical tasks.

Exports use A–G: Project Name, Customer, Task / Work, Hours Spent, Status, Chargeable, Remarks. Numeric dates appear only in column A on the five blue weekday separators; normal rows use A for projects. Column A is width 26 for readable weekday dates; Task / Work retains the original width. In Progress exports as WIP. Company styles, overflow insertion and page settings remain intact; unused formatting beyond G is removed.

Export Preview shows all five days in a scrollable spreadsheet-style table using the export engine's normalized dataset. Workbook validation must succeed, then you must check **I have reviewed and confirmed the timesheet** before **Confirm & Download** becomes available. Data or week changes reset confirmation; reopen preview to validate again. Preview styling approximates the company workbook and is not native Excel rendering.

An offline Manifest V3 extension for Windows 10 Chrome and Microsoft Edge. No build step, backend, account, runtime CDN or network access. Only the `storage` extension permission is requested.

## Install

1. Keep this repository in a permanent local folder.
2. Open `edge://extensions` or `chrome://extensions` and enable **Developer mode**.
3. Choose **Load unpacked** and select this folder, containing `manifest.json`.
4. Pin **Quick Timesheet** to the toolbar. Open it, then choose **Settings**.
5. Add customers and select a default. Import `reference/Timesheet-43_2026-10-19.xlsx` using **Import Template**. The reference file stays local and is ignored by Git; it is not bundled into the extension source.

## Workflow

- **Quick Add:** enter a date, customer, work, hours, status and chargeability. Choose the custom-entry option for a one-time customer. Auto UPPERCASE changes text only when saving, and its preference persists. Save success appears only after durable storage succeeds.
- **Weekly Tasks:** navigate weeks or pick any date to select its Monday. Review daily and weekly totals; edit tasks or confirm individual deletion. Historical weeks remain available.
- **Export Preview:** review the selected range, exact filename, count, hours and template status; click **Download XLSX**. The exporter reads current saved tasks, starts with fresh template bytes, expands day sections as needed, then reopens and validates the generated file. Tasks remain saved afterward.
- **Settings:** customer rename/removal affects the saved dropdown only, not historical tasks. Template replacement requires confirmation.
- **Backup / Restore:** download versioned JSON including every task, customer, preference and the full XLSX template. To restore, select that JSON, choose **Validate and Restore**, and confirm replacement. Invalid backups leave existing data intact. Save a current backup before restoring.

Data belongs to this browser profile and extension installation. Back up before removing the extension, changing profiles or moving machines. Chrome and Edge keep separate stores. Browser reload and extension reload preserve data.

## Implementation

Vanilla HTML/CSS/JavaScript. `background.js` serializes mutations to a single versioned `chrome.storage.local` state object. Task IDs suppress repeated creates; edits detect conflicting changes. Imported template versions use IndexedDB. Restore writes template bytes first and switches the state/template pointer in one storage write; a failed switch retains the previous state. Unreferenced template versions can remain in IndexedDB after replacements or failed restores.

`xlsx.js` is a small OOXML engine using bundled **fflate 0.8.3** for ZIP processing (`vendor/fflate.js`, MIT license in `vendor/LICENSE`). It identifies date sections from cell number formats and work-row styles rather than fixed write addresses. It preserves the original style definitions, row attributes, columns and page settings, shifts ranges/drawing anchors during expansion, removes excluded sheets and unreachable package parts, and writes user text as literal inline strings. No formula evaluation or remote code is used.

The supplied template has Sheet1 and Sheet6, date rows 2/8/12/18/24, daily capacities 4/2/5/4/4, no merged cells, and only five Sheet1 formulas (the weekday dates). Export replaces them with numeric Excel dates. Monday receives a cloned date style using the template's existing weekday number format so all five dates display weekdays. Old template work data and the stale shared-string pool are removed.

## Limits and QA

See [QA.md](QA.md) for actual checks and limitations. Exports are Monday–Friday. Weekend tasks remain visible and editable; export rejects a week containing them so none are silently omitted. Changed templates with formulas outside the date separators, merged task cells, unsupported date systems or incompatible layouts are rejected. Template import is limited to 20 MB and 60 MB expanded XML; backups to 100 MB. Browser storage quotas still apply and failures are reported.

No native Excel visual/print verification has been performed. Original fixed row heights are preserved, so long or multiline text may need row-height adjustment in Excel. General-purpose formula recalculation and arbitrary redesigned company templates are outside this release's scope.

For development QA, run `node tests/run.mjs` with Node 22+, installed Edge, and Playwright Core available. Set `CODEX_NODE_MODULES` to a directory containing `playwright-core`, and optionally `CHROMIUM_PATH` to a compatible Chromium executable. The test uses a separate temporary browser profile, never your normal profile. Then run `python tests/check_workbook.py` for independent standard-library ZIP/XML checks. No test dependency is required to install or use the extension.
