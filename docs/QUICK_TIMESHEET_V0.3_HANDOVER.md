# Quick Timesheet — Project Handover

**Baseline:** V0.3.0  
**Handover date:** 2026-10-23 (Malaysia, UTC+08:00)  
**Project:** Local-first Chrome / Microsoft Edge timesheet extension  
**GitHub:** https://github.com/yongkaiyi1998/edge-extension-work-timesheet  
**Branch:** `master`  
**Baseline commit:** `b59aa90` — `feat: implement Quick Timesheet v0.3 default template`  
**Previous screenshot commit:** `d89dc72` — `feat: add default XLSX template and improve documentation`  
**Reported Git state after push:** `master` synchronized with `origin/master`; working tree clean.

> **Source/evidence note:** This handover consolidates user decisions, screenshots, terminal output and Codex completion/QA reports from the project conversation. The final commits and clean Git status were demonstrated by the user's terminal output. Test and compatibility claims below are **Codex-reported** unless otherwise stated. This handover does not assert an independent source-code audit or native Excel/Calc verification.

## 1. Purpose and operating model

Quick Timesheet lets an individual quickly record work during the week and export a formatted `.xlsx` timesheet on Friday. No backend, WAMP, MySQL, Google sign-in, Drive/Sheets API, or network connection is required for normal use.

**Workflow:** install extension → log work through Quick Add → manage/edit/delete tasks in Weekly Tasks → review spreadsheet-style Export Preview → explicitly confirm → download XLSX → manually upload/share the exported file as needed.

The app is **local-first and per-browser-profile**, not a collaboration or cloud-sync tool. Other people can install and use it independently. **V0.3 makes template import optional** by providing a generic offline Default Template; users can still import their own Custom Template.

## 2. Confirmed user requirements and features

| Area | Current agreed behavior |
|---|---|
| Quick Add | Date, Project Name, Customer, Task/Work, Hours Spent, Status, Chargeable, Remarks; compact popup. |
| Task editing | Add/Edit/Delete with durable local storage, validation, delete confirmation/undo and duplicate-submit protection. |
| Projects | Manage saved project names, select a default, or use a one-time custom project. Project and Customer are distinct. |
| Customers | Manage saved customers, select a default, or use a one-time custom customer. |
| Task case | `Auto UPPERCASE` checkbox enabled by default; only Task/Work content is capitalized on save when enabled. |
| Status | UI displays **In Progress**; spreadsheet export writes **WIP**. |
| Chargeable | **No** by default on new tasks; user may change it to Yes. Editing preserves existing values. |
| Daily hours | Configurable daily target (initially 8 hours); live Logged / Remaining / Overtime indicators for selected date. This is informational, not a maximum-hours restriction. |
| Weekly Tasks | Monday–Friday grouping, week navigation/history, daily and weekly totals, compact task rows, edit/delete controls. |
| Templates | **Default**: built-in generic offline XLSX; **Custom**: user-imported company XLSX. Switching modes must not discard either template or user data. |
| Preview | Large spreadsheet-style preview using the export dataset, all five weekdays including empty ones, validation, filename and totals. Download requires a fresh explicit confirmation checkbox. Prevent stale-data confirmation and duplicate downloads. |
| Export | Single worksheet **`Sheet1`**; no `Sheet6`. Week-specific dates, overflow rows and styling retained as appropriate. |
| Backup | Versioned JSON backup/restore for data and relevant settings; preserve legacy-backup compatibility and existing imported template. |
| Privacy | Offline operation, no backend/cloud data submission, avoid broad permissions and never bundle actual company records into releases. |
| Holidays | **Out of scope** — user explicitly removed holiday functionality. |

### Exact XLSX layout — approved seven columns

| Column | Task row field |
|---|---|
| A | Project Name |
| B | Customer |
| C | Task / Work |
| D | Hours Spent |
| E | Status (e.g. `WIP`) |
| F | Chargeable |
| G | Remarks |

**Date is NOT a dedicated table column.** Each weekday is represented by its own full-width light-blue separator row; the date/day label begins in column A of that separator. Task rows use A–G as mapped above. Any future export changes must preserve this distinction.

**Exact filename:** `Timesheet_{ISO_WEEK}_{MONDAY_YYYY-MM-DD}.xlsx`  
Example: `Timesheet_43_2026-10-19.xlsx`.

- ISO-8601 week number **without** a leading zero.
- Monday date is computed from the **selected** week, including year boundaries.
- Use underscores between filename components.
- Export should use a fresh template and latest persisted tasks rather than a previously exported workbook.

### Template and layout expectations

The original company-provided template (development reference) is `reference/Timesheet-43_2026-10-19.xlsx`. Its general style uses a grey table header (`#808080`), light-blue date separators (`#C2DFFF`), Times New Roman, borders and established row/column dimensions. Actual imported Custom Template formatting is authoritative; do not invent company styles based on screenshots. Default Template must be independently generated or bundled **without company-specific or personal content**. Long entries and days exceeding the original row capacity must not overwrite the next weekday.

## 3. Architecture and repository notes

- **Manifest V3 browser extension**, targeting Chrome and Microsoft Edge on Windows 10.
- **Vanilla HTML / CSS / JavaScript**, without a framework or backend.
- Tasks, projects, customers and preferences: `chrome.storage.local`.
- Imported Custom XLSX template bytes: IndexedDB (as specified in implementation plan; confirm current implementation when editing).
- XLSX generation is entirely local; project uses a ZIP/XML-based export mechanism and bundled offline dependencies. Earlier Codex work requested `fflate` for ZIP handling.
- Data is isolated per local browser profile; uninstalling/reinstalling the extension or changing browser profiles may lose locally stored records without a backup.

**Known changed/new repository files for V0.3:**

```text
.gitignore
README.md
QA.md
background.js
core.js
manifest.json
package.json
settings.html
settings.js
templates.js
weekly.js
xlsx.js
scripts/package.mjs
tests/check_default.py
tests/check_package.py
tests/v03.mjs
docs/screenshots/quick-add.png
docs/screenshots/weekly-dashboard.png
docs/screenshots/export-preview.png
docs/screenshots/settings-templates.png
```

This is a list of files surfaced in the Git output, **not a complete inventory** of all project files. Consult the current repository rather than assuming this list is exhaustive.

The private `reference/` directory is Git-ignored. User command output confirmed:

```text
.gitignore:1:/reference/        reference/Timesheet-43_2026-10-19.xlsx
```

Do not add the private reference workbook to a Git commit, distributable ZIP, screenshots or public documentation. Confirm that build scripts exclude it.

## 4. UI and documentation

The user approved a **compact, readable productivity UI**: Quick Add browser popup, Weekly Tasks full-page view and Settings. Weekly task entries should be scannable, not overly tall cards. The Export Preview should approximate the XLSX's grey header / blue date rows and allow the user to double-confirm the week before download. Exact native Excel pixel rendering is **not promised** by the in-browser preview.

The English `README.md` was updated for public-facing installation and usage, covering both Default/Custom modes, offline privacy and backup/restore. Four **real Playwright/Edge screenshots with fictional sample data** were reported and committed under `docs/screenshots/` (see filenames above). Do not replace these with mock renders or expose actual customer/company data.

**Installation:** open `edge://extensions` or `chrome://extensions`, enable Developer mode, select **Load unpacked**, choose the folder containing `manifest.json`. Reload an existing unpacked extension after source changes. New users can export using Default Template immediately; Custom mode uses Settings → Import Template.

## 5. Development history and verification

| Version | Main additions | State |
|---|---|---|
| V0.1 | Offline task CRUD, customers, uppercase option, template-based export, backup/restore | Implemented; Codex Edge QA reported passing |
| V0.2 | Projects, configurable daily working hours, remaining/overtime preview, Chargeable No, WIP, initial eight-column XLSX, UI compactness | Implemented and subsequently refined |
| V0.2.1 | Final **seven-column** XLSX (no Date table column), large confirmed Export Preview, compact weekly list | Implemented; Codex reported Edge regressions and independent workbook checks passing |
| V0.3.0 | Built-in offline Default Template, Default/Custom selection and compatibility, README screenshots, release packaging | Implemented and **committed/pushed** |

**V0.3 Codex-reported test coverage:** two Edge suites; independent XLSX verification; package checks; fresh install without template import; Default/Custom switching; existing template/data/backup preservation; legacy backups; weekly dates and filename; overflow rows; preview-vs-export parity; required confirmation and duplicate download protection; project/customer settings and CRUD regressions; unchanged/excluded private reference file.

**What is not yet verified independently:** native Microsoft Excel/OpenOffice/LibreOffice visual rendering, especially long-text row heights and print/pagination. Exported long-text row heights are estimates and may clip. Treat programmatic XLSX validation as separate from native rendering approval. The user had previously visually reviewed earlier exports and noted an `###` date display problem; later column-width adjustments were applied. Recheck dates and layout after future export changes.

**Release package (Codex-reported local path):**

```text
C:\Project\edge-extension-work-timesheet\dist\quick-timesheet-0.3.0.zip
```

This is a path on the user's Windows machine, **not** a download link available in this chat. Codex reported that the ZIP excludes the private reference workbook. The Git terminal output confirms the source/docs commits but does not establish that the ZIP itself was pushed or attached to a GitHub Release.

## 6. Git state and workflow rules

User's Windows checkout:

```text
C:\Project\edge-extension-work-timesheet
```

Confirmed terminal output:

```text
[master b59aa90] feat: implement Quick Timesheet v0.3 default template
16 files changed, 549 insertions(+), 41 deletions(-)
...
d89dc72..b59aa90  master -> master
On branch master
Your branch is up to date with 'origin/master'.
nothing to commit, working tree clean
```

The earlier screenshot commit `d89dc72` contains four PNG screenshots. The subsequent `b59aa90` contains the 16 remaining V0.3 source, documentation, build and QA files.

**User preference:** the user manually stages, commits and pushes after Coordinator review. Do not automatically commit/push, do not force push and avoid blanket `git add .` or similarly broad staging. Prefer explicit scoped paths, review staged diff/stat, `git diff --cached --check`, and check that `reference/` remains ignored before requesting manual commit.

**For future Codex prompts:** concise, non-repetitive, scoped patches; preserve working behavior and existing vanilla-JS architecture; ask only about genuinely blocking questions; avoid repeated analysis and unnecessary new dependencies; give test evidence and honest limitations. The user values fast implementation and efficient model usage **without sacrificing data integrity, Excel format or QA**.

## 7. Risks / constraints to carry forward

1. **Local data loss:** No cloud sync. Provide and encourage backup/restore before uninstall, profile migration or substantial upgrades. Never silently clear or reset old data.
2. **Excel compatibility:** Programmatic workbook checks passed per Codex, but native layout and print appearance are not conclusively validated. Preserve custom-template formats, print setup and long-text legibility.
3. **Seven-column regression risk:** Do not reintroduce a Date table column; dates belong in the blue weekday separators.
4. **Preview/export divergence:** Preview and generator should share a normalized data model. Invalidate confirmation after edits or template/week changes.
5. **Sensitive company data:** Never publish original company workbook, actual tasks, credentials or real customer info in the package, screenshots or Git history.
6. **Extension storage and migration:** Keep old tasks, IDs, customer/project values, settings and backups usable across versions. Avoid destructive changes.
7. **Scope discipline:** No holiday integration, Google Drive, cloud sync, user accounts or backend unless the user explicitly revises scope.

## 8. Incoming Coordinator / developer checklist

When the next task arrives:

1. Confirm baseline `master` at or after `b59aa90`; inspect current code, `README.md`, `QA.md` and Git status before editing. User's latest files and repo state are the source of truth.
2. Record the user's requested change as a minimal versioned patch, distinguishing UI, export, migration and tests.
3. Preserve the approved seven-column mapping, filename and all currently working features unless explicitly changed.
4. Protect local data; include migration and backward-compatibility coverage for storage/settings changes.
5. If XLSX export changes, test Default **and** Custom modes, overflow, date separators, project mapping, WIP mapping, filenames and preview agreement.
6. Run applicable existing Edge suites / independent workbook checks and report actual results; do not state native Excel tests passed without evidence.
7. Review staged content, public screenshots, package contents, ignored reference and security/privacy impact.
8. Return a concise completion summary plus exact modified files, pass/fail totals if available, remaining risks and scoped **manual** Git commands once the user approves.

## 9. Next recommended action

**No new feature is currently required.** V0.3.0 is the current accepted Git baseline. Before wider distribution, perform a small real-device manual acceptance check: fresh Chrome/Edge profile, create/edit a few tasks, export with Default Template, switch to Custom Template, compare the actual XLSX in Microsoft Excel and/or Calc (date visibility, long text, print preview), and confirm README screenshots and release ZIP contain no private records.

If a problem is found, treat it as a **focused post-V0.3 bugfix** rather than a rewrite. Let the user decide whether to create a formal GitHub Release or publish through an extension store; none has been confirmed.

---

**Handover status:** Ready for next Coordinator/Codex session. **Current repository baseline:** `master` / `b59aa90` / clean working tree (per user-shared Git terminal output).
