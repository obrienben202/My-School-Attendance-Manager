# Browser regression checks

## My details → My timetable

With the Attendance Tracker and API Server development workflows running, run from
the workspace root:

```sh
pnpm --filter @workspace/attendance-tracker run test:e2e:my-timetable
```

The existing `E2E_STAFF_USERNAME` and `E2E_STAFF_PASSWORD` Replit Secrets are
required. Do not paste credentials into commands or commit an authentication state
file. `E2E_BASE_URL` defaults to `http://localhost/`; it can point to the development
preview (including an artifact base path). `CHROMIUM_PATH` defaults to
`/repl/tools/bin/chromium`.

The check signs in to the real service and waits for both the authenticated staff
session and the signed-in interface before navigating. All personal timetable
requests are intercepted in the browser using synthetic records. It makes no
assignment or database changes and blocks any non-read API request after sign-in.
Other signed-in read endpoints still use the development API.

Coverage:

- Loading, empty and failed timetable responses; explicit retry fetches new data.
- Monday–Friday columns, registration/break/lunch bands, distinct overlapping
  entries (including repeated IDs) and full cross-period times.
- Early, lunch-overlapping, unknown-day, missing-time and invalid-time sessions
  remain in the additional section with their recorded details and reasons.
- Desktop containment and usable horizontal scrolling to Friday at 390px and
  320px widths, without dialog or page overflow.
- The real theme toggle changes the dialog, header, entries, titles and additional
  section in dark mode.
- Close button, Escape and successful reopening.
- The real Print button opens a complete document from a narrow, dark-mode dialog.
  Print-media layout retains all weekdays, overlapping entries and additional
  sessions; Chromium renders every PDF page at A4 landscape size.

The printer dialog is stubbed, not the document builder or popup. PDF bytes remain
in memory; no staff details, screenshots, credentials or browser state are saved.
An assertion failure exits nonzero. Expected 503 responses during the retry case
are intentional.

For a fast, independent render/PDF check (no API, credentials or database):

```sh
node --experimental-strip-types --test artifacts/attendance-tracker/e2e/my-timetable-print.test.mjs
```

This also checks that removing Friday or an additional session makes the assertions
fail. It supplements rather than replaces the signed-in run.
