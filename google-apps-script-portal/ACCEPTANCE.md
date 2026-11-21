# Verification and cutover checklist

## Evidence categories

Keep three separate results:

1. **Local automated** — Node tests of actual server functions, spreadsheet adapter fakes, schemas and synthetic browser wiring.
2. **Google test deployment** — actual Apps Script/Sheets/Drive behaviour under an authorised school-owned account.
3. **Live migration/cutover** — separately approved transfer, reconciled school records and operational acceptance.

Passing the first is not passing the second or third. No school account, real login workbook, production database, live learner data or Google sharing setting was accessed by the local tests.

## School owner: non-public Google test

Record date, executor, deployment version, workbook version, expected results and actual evidence. Use synthetic records and a dedicated test workbook.

- [ ] Manifest/scopes reviewed by school administrator; access policy suitable for staff and learners.
- [ ] Initialise a new empty workbook twice: second run reuses it unchanged. Pointing at an existing unmarked populated workbook refuses without changing it.
- [ ] Source headers and normalised account names match school-managed sources; unknown roles and duplicate usernames refuse access.
- [ ] Existing staff verifier works without a new staff login or copied password directory.
- [ ] Learner source and verifier/bcrypt format match; exact PersonCode mapping is required.
- [ ] Invalid account, wrong password, missing/deactivated source account, role demotion, revoked token and expired token cannot retrieve data.
- [ ] Learner One cannot read Learner Two, reports, admissions, account mappings, staff comments, safeguarding or internal journal/fragment tables, including direct RPC attempts.
- [ ] Teacher One cannot open Teacher Two's register by changing a schedule ID. HOD sees only explicit verified department courses.
- [ ] A staff display name matching a course name/teacher name does not grant access.
- [ ] Office can view an authorised register but cannot submit; all menus/forms reflect the server restrictions.
- [ ] Dates remain correct across 29 March and 25 October 2026 daylight-saving transitions; an unscheduled lesson is not Monday.
- [ ] Week A/B requires a matching explicit CalendarWeeks entry, never inferred calendar parity.
- [ ] Submit all marks; reload and open in another browser. Retry identical request ID: exactly one mark per learner/occurrence and one submission receipt.
- [ ] Two browsers edit the same register/record: second save stops, keeps its draft and requires explicit reconciliation and a separate save.
- [ ] Simulated interruption between marks and register/audit update: no success response, journal stays prepared and retry recovers exactly once.
- [ ] A directory/service outage does not silently authorise cached identities or discard an unsaved draft as if credentials were invalid.
- [ ] Create/edit/reload/archive each enabled module and check foreign keys, uniqueness, totals and audit. Linked parent records cannot be archived silently.
- [ ] Published ILP template is immutable. Learner sees full prompts/instructions, only their assigned confirmed review, current-term opening rules and earlier target descriptions without earlier private answers.
- [ ] Save a learner draft, reload, submit with all three target categories/steps, return with feedback, revise, complete with feedback/date and confirm read-only state.
- [ ] Any school staff can add shared comments without gaining private answer access. Administrative answer changes require a reason/support audit.
- [ ] Upload JPEG/PNG/PDF; check ownership, record binding, private metadata, actual bytes, MIME mismatch, oversize and changed-file denial.
- [ ] Learner cannot download another learner's file by guessing its ID. No public Drive link is returned.
- [ ] Staff roster/learner access does not expose administrator/office PDF documents on student/enrolment records, including file names. Authorised photos remain available; termly-review attachments are clearly labelled shared with the learner.
- [ ] Formula-like input is literal; CSV export cannot inject a spreadsheet formula. Large structured values round-trip through private fragments without truncation.
- [ ] Tablet/phone navigation, keyboard labels, errors/loading, sign-out and top Help new-tab pictures are usable.
- [ ] Agree and pass the school-specific Google peak-load test in CAPACITY.md.

## Authorised migration rehearsal

- [ ] Export approval and private storage confirmed; no credentials/session tokens transferred.
- [ ] Dry run writes zero records, validates every field/reference/date and reports omitted credentials/old upload receipts.
- [ ] Import small dependency-ordered synthetic batches into the TEST workbook; replaying a batch returns its prior receipt.
- [ ] Reconcile source/target counts, IDs, sample values, learner-account/tutor/course links and historical review comments.
- [ ] Transfer approved file bytes privately and compare counts/hashes; an old object path is not accepted as a transferred file.
- [ ] Backup and restore rehearsed; no journal/fragment records pruned without reference checks.

## Separate live approval

- [ ] All blocking Google checks passed and recorded; school accepts remaining differences in PARITY.md.
- [ ] Retention, privacy/access ownership, backup frequency and support owner signed off.
- [ ] A final write freeze, export delta, reconciliation and rollback time are agreed.
- [ ] User explicitly authorises live deployment/import and switching the school link.
- [ ] Existing portal and backups retained until the school explicitly authorises retirement.
