# Handover verification — 21 November 2026

## Passed locally

- `pnpm google-portal:test`: **22 tests passed** using synthetic records only.
- `node --test scripts/sync-github.test.mjs`: **3 source-sharing safety tests passed**.
- `pnpm google-portal:build`: built the Apps Script export and all 38 workbook definitions, including all 26 legacy table mappings.
- Export archive integrity checked; the synthetic server, fixtures and test tools are not in the Google deployment.
- The fully rendered synthetic HTML includes Styles, Client and the local RPC bridge; all three scripts compile and no unexpanded Apps Script expressions remain.
- The original running portal's signed-out page still loads without browser errors.

The tests exercise ownership/role denial, invalid/expired/changed identities, managed verification and bundled browser bcrypt, explicit course/department links, complete register submissions, conflict preservation, idempotent retry, interrupted-operation recovery, immutable keys, references, large-value fragments, formula escaping, London date-only handling, safe initialisation, selective directory reads, file privacy and dry-run imports.

Student/enrolment PDF documents and their names are restricted to administrator/office roles. Authorised learner photos remain available. Review attachments are labelled as shared with that review's learner.

The final regression checks round-trip two learner/tutor assignments through fresh spreadsheet readers, reopen/edit them, verify deterministic legacy-assignment import IDs, and submit create/edit timetable payloads produced by the actual metadata-driven form. Readonly booleans are disabled and omitted from saves.

## Not verified — do not report as passed

- **Full synthetic browser journey:** an initial run found a boot-template quoting problem, which was fixed. The local template emulator also omitted semicolon-terminated includes; it now fails on unrendered expressions and has a regression check covering the actual client script. Follow-up browser attempts did not return a usable journey verdict and were stopped. Login → draft save → reload → sign-out is therefore **not browser-attested**.
- **Actual Google runtime:** no school-owned Apps Script project was connected, installed or deployed. No real directory/password source compatibility, Google browser permissions, Drive policy, school peak-load result or restore rehearsal is claimed.
- **Live transfer/cutover:** no school records were read or imported; no existing workbook/sharing settings, production database or current portal was replaced.

The package is ready for a separately authorised private Google trial, **not for an unreviewed live switch**. Complete ACCEPTANCE.md and CAPACITY.md under the school owner's account before claiming Google runtime acceptance or production capacity.
