# Attendance Learning Hub — Google edition

A **separate, exportable Google Apps Script application**, backed by private Google Sheets and Drive. It does not replace the running React/Express portal or access its database. GitHub and Replit are not runtime dependencies after the files are installed in Google.

**Status:** implemented and locally testable with synthetic fixtures. School Google authorisation, live account-source compatibility, actual Apps Script browser execution and school-scale capacity must still be checked. **Not deployed; no live records imported; not approved for cutover.**

## Build and test

From the project root, using the already installed dependencies:

```sh
pnpm google-portal:test
pnpm google-portal:build
```

The build produces `generated-artifacts/google-portal/attendance-google-apps-script.zip`, an `apps-script` folder ready to copy into Google, the full workbook data dictionary, schema and handover documents. This generated directory is excluded from GitHub and deployment. The build bundles the existing bcryptjs dependency and its licence for supported learner password-hash verification; it requires no Node packages inside Google.

The Apps Script files are generated from this package plus the current Drizzle table definitions. Do not copy the old server, its database credentials or its live URLs into the new project.

## Installation — school owner

Use a school-owned Google Workspace account, not an employee's personal account. Start in a separate Apps Script project and a test deployment. Obtain school approval for the requested Sheets, Drive and external-request scopes.

1. **Create the project.** Open `script.google.com`, create a new project and name it “Attendance Learning Hub — TEST”. Keep the existing portal running.
2. **Add the files.** Extract the ZIP. Add every `.gs` file from `apps-script` as a Script file, and every `.html` file as an HTML file, retaining names without the extension in Google's editor. This includes generated `Schema.gs` and bundled `Bcrypt.gs`, not only the files under this repository's `src` folder.
3. **Set the manifest.** In Project Settings, enable “Show appsscript.json manifest file in editor”. Replace that manifest with the supplied `appsscript.json`. The timezone is Europe/London.
4. **Set private Script Properties.** In Project Settings → Script Properties, configure the table below. Do not put identifiers, password sources or secrets in HTML, public instructions, chat, source control or screenshots.
5. **Create an empty test workbook.** With `MODE=TEST` and a strong SESSION_KEY set, run the editor-only `initializePortal_` function. Approve scopes only after review. It creates a new private workbook and upload folder and records their IDs in Script Properties. It refuses to initialise an existing unmarked workbook and will not overwrite school tabs.
6. **Inspect before importing.** Run `inspectPortal_`. Keep the master workbook and upload folder owner-only. Do not share them with students or ordinary staff. Existing login workbooks can remain separate private sources; do not change their permissions.
7. **Provision test records and accounts.** Use an authorised synthetic export and the dry-run process below. Staff must exist in the configured school directory. Learners require an exact PersonCode match to a Students record. Run `syncAccounts_` from the editor to create verified account mappings; this is not public registration.
8. **Assign access explicitly.** An administrator configures CourseAccess by verified username and course ID, DepartmentCourses by verified department and course ID, and LearnerAssignments by student/account/tutor IDs. A staff display name on a timetable never grants access. A learner needs `confirmedLearner=true` and a matching learner assignment to open termly reviews.
9. **Create a non-public test deployment.** Use Deploy → New deployment → Web app. Execute as the school-owned deployment account so portal users do not need access to the workbook. Prefer school-domain-only access where the Workspace policy supports the required users. A Google access restriction supplements, not replaces, the application login and record checks.
10. **Run ACCEPTANCE.md.** Record actual Google results, including dates across daylight-saving changes, role denial, two browsers editing the same register and a simulated service failure. Do not mark these as passed on the strength of a local fixture preview.
11. **Only after separate approval:** complete a school security/capacity review, reconcile an approved transfer and choose an agreed cutover time. Do not disable or delete the original portal/data as part of testing.

### Script Properties

| Property | Purpose |
| --- | --- |
| MODE | Start with `TEST`; this package does not enable a live cutover automatically |
| SESSION_KEY | At least 32 cryptographically random characters, generated privately by the owner; never use the synthetic test key |
| STAFF_DIRECTORY_ID / STAFF_DIRECTORY_TAB | Existing authorised school staff account source |
| STAFF_AUTH_URL | Existing approved school Apps Script password verifier, ending `/exec` |
| LEARNER_DIRECTORY_ID / LEARNER_DIRECTORY_TAB | The separately supplied learner-login workbook and its tab, configured privately |
| LEARNER_AUTH_URL | Approved learner verifier, if available; otherwise the private learner source must have a compatible PasswordHash column |
| MASTER_WORKBOOK_ID | Created by initialisation; do not point it at a live workbook |
| INITIALIZED_WORKBOOK_ID | Safety marker written by initialisation; never change to bypass its refusal |
| UPLOAD_FOLDER_ID | Created private test upload folder |
| SESSION_MINUTES | Optional 15–480, default 60; sessions are fixed-expiry and revocable |
| MAX_TABLE_ROWS | Reviewed cap, default 10,000, configurable 100–50,000; not a promise of acceptable performance at that size |
| IMPORT_FILE_ID | Optional owner-only prepared JSON batch for a dry run |
| IMPORT_APPROVAL | Leave unset; `APPROVED_TEST_COPY` is an explicit approval for a private TEST copy only |

Generate SESSION_KEY with a trusted local password manager or a cryptographically secure generator, for example `openssl rand -base64 32`. Enter it directly in Google's private Script Properties. Do not send it to Agent or save it in a workbook. No real key is provided in this package.

### Directory columns and authentication

Only selected identity columns are read; plaintext Password and unknown columns are not read or copied.

| Source | Required | Optional |
| --- | --- | --- |
| Staff | Username, Role | FullName, Department, Active, Email, Phone, JobTitle |
| Learner | Username, PersonCode | FullName, Active, PasswordHash |

Common aliases such as “User name”, “Full name”, “Dept”, “Student code” and “Learner code” are supported after header normalisation. Roles are explicitly validated: administrator/admin/HR, HoD, staff/teacher, office, learner/student. An unknown role never defaults to staff.

The verifier receives username/password server-side via HTTPS form POST and must return JSON `{ "success": true }` only for valid credentials. **Its role claim is ignored.** The directory supplies roles, account mappings must already exist, and identity is revalidated on every authenticated call. No directory outage silently falls back to cached privileged identities. A temporary outage preserves the browser draft but denies the request.

If no learner verifier exists, the learner source may supply a **bcrypt PasswordHash** (cost 10–14), verified using bundled bcryptjs. A pre-existing plaintext password column is **not** a compatible hash. Do not automatically replace it or copy it into the master workbook: the school must authorise either its existing verifier or a separately reviewed hash-provisioning process. Staff credential-sheet details must never appear in learner setup instructions.

## Using the application

Staff and students receive the deployed web-app link, not a spreadsheet link. There is no public signup. Staff use their existing school username; students choose Learner and use the separate learner source.

The top **Help** action opens an illustrated guide in a new tab. The removed Staff Help Guide sidebar entry is not restored. All guide examples are synthetic.

Every exposed module has server-filtered search, pagination, typed forms and appropriate read/create/edit/archive controls. Advanced structured configuration, such as review templates and ILP filters, uses validated JSON fields rather than recreating every React editor. Linked fields use stable IDs shown in the relevant lists, not spreadsheet row numbers.

For registers, copy the lesson ID from Lesson timetable and choose its actual date. Week A/B requires an explicit CalendarWeeks entry; an unscheduled lesson is never silently treated as Monday. Every current enrolment receives one mark. Office access is view-only for submission; teachers need an explicit editable course assignment.

For learner reviews, published template questions are shown exactly, including instructions. Submitting requires a summary, the required answers and one academic, personal and future target with actionable steps. Tutors can comment, return or complete submitted reviews; completing requires feedback and a review date. Separate shared staff comments do not grant access to private learner answers. Administrative support edits require a reason and a support-audit record.

## Data integrity and recovery

- IDs remain stable through sorting and import. The workbook's machine-readable headers are validated; do not rename/add columns inside managed tabs.
- Every editable record has a revision. Conflict responses preserve the draft and show the saved version. Choosing to adopt the newer baseline does not itself save.
- Mutations carry a request ID. Retry the same unchanged submission with the same ID after a network/interrupted-save failure. Do not edit and resubmit an unresolved operation as if it were new.
- An operation journal is durable before record writes. A retry recovers prepared operations idempotently and records success only after all changes and audit entries are written.
- Large structured values are stored in private, integrity-checked RecordFragments child rows; normal cells remain readable. Formula-like user text is encoded as a literal, never executed as a formula.
- Script locking is **not** a database transaction. Manual spreadsheet edits bypass it. Keep direct workbook edits to reviewed owner maintenance windows, take a backup, validate headers/IDs and retest before reopening.
- An unrecoverable prepared operation blocks requests rather than returning partial data. The owner must inspect/recover from a private backup; never delete a journal blindly.
- `backupPortal_` makes a private workbook copy. It includes sensitive records and hashed sessions: never publish it, import old sessions or share it as a public download.
- Files are private Drive objects with metadata, byte checks, owner/record checks and content digests. No public Drive links are returned. Files are limited to 2 MB PDF/JPEG/PNG. Learner/enrolment photographs are visible within the authorised roster; PDF documents on those records are administrator/office-only, including their names. Termly-review attachments are explicitly shared with that review's learner, so staff-only notes belong in the separately restricted area, not those attachments.

## Controlled migration rehearsal

No command here automatically reads the running database. Obtain separate school approval before using real records.

1. Prepare an authorised export with camelCase field names or the original SQL column names, grouped by legacy table name. Keep exports under the ignored `generated-artifacts` directory.
2. Run the offline mapper:

   ```sh
   node google-apps-script-portal/tools/prepare-import.mjs \
     generated-artifacts/private-export.json \
     generated-artifacts/private-google-import
   ```

3. Review `reconciliation.json`. Credentials, old sessions and old upload receipts are deliberately omitted and reported. Unknown fields stop preparation, rather than being silently lost.
4. Batches are dependency ordered. Upload one approved synthetic/sanitised batch privately to the school owner's Drive and set IMPORT_FILE_ID. Run `dryRunImport_`; verify `written=0`, counts, required dates, relationships and warnings.
5. Only for an explicitly approved TEST copy, set IMPORT_APPROVAL to APPROVED_TEST_COPY and run `importApprovedTestCopy_`. Retry of the identical batch returns its previous receipt rather than duplicating rows. Existing IDs are not overwritten.
6. Repeat batches in order, run `syncAccounts_`, assign course/tutor access and compare counts, sample records, date-only values and ownership links.
7. Existing photo/object-path references are not file bytes. Transfer files only with separate approval, re-upload privately against their correct record, and compare source counts/checksums before cutover. Run `reconcileTransferredFiles_` to verify the new stored files. Never claim an old Replit object path has become a Drive file.
8. Remove the import approval and IMPORT_FILE_ID when finished. Keep the original portal running. Any live transfer and changeover needs a separate decision.

## Updating and rollback

Keep the Apps Script project under school ownership. Copy reviewed source changes into that project, update the deployment version in Deploy → Manage deployments and retain its prior version. Spreadsheet schema changes need an explicit reviewed migration; initialisation does not auto-upgrade populated workbooks.

Before a later approved cutover: take a private workbook and file backup, freeze writes briefly, reconcile the final delta and run the Google checklist. If checks fail, continue using the existing portal. Never allow both systems to accept independent live writes without a reviewed reconciliation process.

## Security and verification boundaries

See ACCEPTANCE.md, PARITY.md and CAPACITY.md. The synthetic Node/browser harness is deliberately excluded from the Google deployment. It is not Google authorisation, a real password service, a production datastore or proof of Google quotas. Do not deploy it.

Google references:
- https://developers.google.com/apps-script/guides/web
- https://developers.google.com/apps-script/guides/html/communication
- https://developers.google.com/apps-script/guides/services/quotas
- https://developers.google.com/apps-script/reference/lock/lock-service
