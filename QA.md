# QA results — 23 October 2026

## V0.2.1 — current results

Changed files: xlsx.js, weekly.js, weekly.html, style.css, manifest.json, package.json, tests/run.mjs, tests/check_workbook.py, README.md and QA.md. Stored projects and all storage/CRUD modules are unchanged.

Passed: extended installed-Edge suite, actual confirmed XLSX download, seven-column project/WIP mapping, 60-task overflow exports, all five separator dates, empty weekdays in preview, unchecked initial confirmation, disabled download until validation and confirmation, confirmation reset after persisted changes, and existing CRUD/settings/daily-hours/legacy-backup/navigation tests. Independent ZIP/XML checks pass on the downloaded workbook: exactly A–G cell references and approved headings, numeric dates in A, original C width 74.86, A width 26, three records/3.5 hours, company fonts/fills/page settings, single Sheet1 and unchanged reference SHA-256. JavaScript syntax and final source review completed; no unresolved test failures. Preview and download both consume exportDataset; final workbook values are checked against that dataset after reopening. Duplicate clicks are guarded by a busy flag and consumed validated snapshot.

Weekly dashboard and preview screenshots were visually reviewed. The preview uses grey headers, blue full-width date rows and Times New Roman, and scrolls in both axes. Weekly task rows retain Edit/Delete and put chargeability/remarks in keyboard-accessible Details controls.

Limitations: no native Calc/Excel visual or print verification. Date width and number formats are verified at file level, not a guarantee of pixel-perfect native rendering. Original fixed task row heights can still clip long text in Excel. Column A is intentionally wider than the reference date column, but the dedicated date column from V0.2 is removed. Weekend-containing weeks continue to be rejected with a warning rather than silently dropping tasks. Reference remains Git-ignored and unmodified. No commit or push.

## V0.2 patch — historical results

Modified: core.js, background.js, editor.js, weekly.js, settings.js, new projects.js, xlsx.js, style.css, manifest.json, package.json, README.md and both QA test scripts. Existing HTML entry points remain intact; project settings are mounted by a local module.

V0.2 Edge regression coverage adds default Chargeable No, project defaults/one-time values, project/WIP/eight-column overflow exports, and daily calculations for create/edit. Existing CRUD, backup/restore, historical customer values, navigation, ISO filenames, empty weeks and reference integrity checks remain enabled. The independent ZIP/XML checker now checks date column B, exact A–H headings and date width 26, alongside preserved fonts/fills/page settings. Earlier development runs caught a slow cell-lookup validation and missing accessible select labels; both were corrected.

Tradeoffs: the new column and wider date column increase printed report width; original page orientation and margins are retained. The popup was visually reviewed as an extension page, with paired controls and visible daily summary. No approved prototype image was supplied in this task. OpenOffice is installed but native Calc rendering has not been automated or visually verified; Microsoft Excel rendering is also untested. Numeric date values, weekday number formats and effective column width are checked at file level, which does not establish native visual fidelity. Long task text still uses original row heights. No commit or push.

## Verified

Automated checks ran in installed Microsoft Edge with Manifest V3 loaded unpacked, using an isolated temporary profile and the real extension service worker, `chrome.storage.local`, IndexedDB and file downloads.

- Quick Add required fields; numeric nonnegative hours; stable IDs and suppression of duplicate creates; simultaneous independent saves retain every task.
- Add, edit, confirmed delete and page reload retain the expected saved state. Conflicting task edits are rejected. Invalid stored state is reported rather than silently reset.
- Saved/default customers, one-time customers, customer add/rename/remove, and historical customer text preservation.
- Original mixed-case editor text; uppercase enabled/disabled at save; preference persistence.
- Week navigation across the year boundary; ISO filenames for week 1 and week 53. Independent first-Thursday comparisons cover the first 14 days of every year from 2000 through 2399 (5,600 dates).
- Daily grouping and weekly totals, including zero hours; empty weeks; exports after edits/deletions.
- Actual XLSX preview/download and exact `Timesheet_43_2026-10-19.xlsx` filename.
- Actual JSON backup download includes byte-for-byte template contents; Settings restores it after confirmation. Unsupported versions, malformed task structures, duplicate IDs and negative hours are rejected. Invalid template bytes are rejected before restore.
- Real template-file import and replacement through Settings.
- Sixty-task overflow export (12 per weekday). Separator rows shift from 2/8/12/18/24 to 2/16/30/43/57; subsequent dates and all customer/work/hours/status/chargeability/remarks values validate after reopening. Empty and edited single-task exports also validate.
- Generated XLSX contains exactly one sheet named Sheet1, no date formulas, and numeric dates for the selected week. Old shared strings, Sheet6 and its orphaned drawing/relationships are removed. Formula-looking task text remains literal text.
- Runtime export validation compares original fonts, fills, borders, number formats, original cell styles and row heights, column widths, merged-range adjustments and page settings. A separate Python standard-library ZIP/XML check verifies the actual browser-downloaded workbook: five correct dates, three expected tasks, 3.5 total hours and original company style/page definitions.
- Settings screenshot visually reviewed. JavaScript syntax and local module/asset references checked. Only `storage` permission; CSP disables network connections. No application fetch, analytics, remote scripts or dynamic evaluation.
- `/reference/` and generated QA artifacts are Git-ignored. No reference file is tracked. The reference workbook remains unchanged, SHA-256 `97b56edcaf15a9be98e4634638ac94819629538f3e2c171aff00d87814602a96`.

## Limits and checks not performed

- Tested in headless installed Edge on this Windows environment. Chrome, Windows 10 specifically, toolbar popup placement, native Excel rendering and actual printing were not separately tested. The popup document and all workflows were exercised as extension pages.
- No assertion of perfect visual fidelity in native Excel. Original row heights are retained, so long/multiline work can be clipped until rows are resized. Monday intentionally uses the existing weekday display format via a cloned original style.
- The source has no merged ranges or populated drawing anchors. Adjustments exist, but native Excel behavior for redesigned templates with those features is unverified. Merged task cells and non-date formulas are rejected. Arbitrary Excel formula recalculation is not supported.
- Weekend tasks are retained and shown; a week containing them is rejected for export, avoiding silent data omission from the five-day company report.
- Quota exhaustion, disk failure, forced browser termination during writes and OS download cancellation were not fault-injected. API failures are caught; backup restores switch the template pointer and state together only after IndexedDB commits. Abandoned template versions can remain in IndexedDB.
- No Git commit or push was performed.

## Reproduce

`node tests/run.mjs` uses the available Playwright Core runtime (override `CODEX_NODE_MODULES`) and installed Edge (override `CHROMIUM_PATH`). It writes ignored test-only XLSX/PNG files. Then run `python tests/check_workbook.py`; that script uses only Python's standard library and checks the supplied reference hash. The extension itself needs neither Node nor Python.
