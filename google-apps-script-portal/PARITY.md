# Feature and access inventory

This matrix is a verification checklist, not an assertion that Google runtime acceptance has passed. All operational source tables are mapped automatically into the generated data dictionary. Password hashes and sessions from the old application are intentionally excluded from transfer.

| Existing area | Google edition | Access / verification boundary |
| --- | --- | --- |
| Staff login | Separate staff login with existing school verifier and verified private directory | No new staff signup, verifier role claims ignored; real school configuration awaiting owner |
| Learner login | Separate learner source/verifier or compatible bcrypt hash | Exact PersonCode binding; no source-sheet link exposed |
| Dashboard | Real counts from authorised records | Retired courses excluded from active course count; not invented KPI trends |
| Students / courses / enrolments | Typed record lists, details, create/edit/archive where permitted | Admin/office provisioning; teacher/HOD/learner row scopes enforced |
| Staff details | Current verified self-profile | Name, role, department, email, phone, job title; absent fields say Not recorded, not inferred from names |
| Timetables | Lesson and staff-slot records with explicit course/username/department access | No Monday fallback; no calendar parity inference; form-based rather than identical school grid |
| Daily eRegisters | Lesson/date roster, marks, submission, revision and audit | Editable course assignment required; every learner exactly once; office view-only |
| Register contacts | Student records within authorised scope | Contact fields omitted for ordinary teachers and learners; not a port of the old broken contact route |
| Assessment / markbook | Assessments, results, confirmation and verification records | Assigned course/tutor scope; per-assessment verification synchronises result confirmation |
| Targets / planned absence | Persisted typed records | Existing restricted role groups; no student exposure of staff notes |
| ILP legacy plans | Persisted plan/section records | Assigned tutor or administrator; no name-based identity linking |
| Termly ILPs | Published template, term, verified assignments, structured learner responses/targets | Own confirmed learner only; tutor return/complete requires feedback; published templates immutable |
| Shared staff comments | Separate comments plus minimal review header search | Any school staff may comment; this does not open private learner answers |
| ILP groups | Year Group filters, revision conflicts and default-year uniqueness | Verified supported filters only; administrator changes |
| Safeguarding | Real persisted notes | Admin, scoped HOD, or the author; no demo case treated as genuine |
| eProgressions | Persisted learner/course progression records | Admin/HOD/office with course/student scope; source fields retained in dictionary |
| Concierge | Application, interview and offer fields in persistent records; related enrolments and uploads | Admissions roles only, not merely any staff session |
| Reports | Real authorised attendance, assessment and enrolment CSV | Role filtering, formula-safe export, bounded response |
| Files / photos | Private Drive bytes plus sheet metadata and digest | No public URL; every read checks the parent record and file integrity |
| Administration | Verified mappings (read-only), course/department access, KPI/settings, owner setup/import/backup | Internal sessions, journals, fragment rows and source identifiers never become client modules |
| Help | Top help action, separate tab, numbered synthetic SVG illustrations | No Staff Help Guide sidebar entry; no real learner screenshots |
| Old Markbook / licensed Support | Not implemented as a new licensed product | Original licence-required navigation is not production functionality |
| Presentation-only room/exam/correspondence pages | No newly invented persistence | No corresponding dedicated source tables; map any genuine external records before a later parity claim |
| Existing upstream Data Sync | Master-sheet direct reads plus explicit owner dry-run imports | No automatic destructive mirror of the partial Sessions feed; additional upstream feed connectors need source/ownership approval |

## Interface differences that must be reviewed

The Google edition supplies functional metadata-driven forms and tables rather than copying every existing React widget. Review-template and filter configuration uses validated JSON. Relationship fields are labelled stable IDs; school ownership/access must be provisioned before normal users can see data.

The Google edition does not copy the old local-password fallback. Directory outages deny new requests without authorising stale identities. Already open drafts remain until a true invalid/expired session requires clearing private browser state.

## Table mapping

The build checks all 26 current persisted table definitions and emits their fields/types/source-column names/references. Additional tabs cover explicit course access, department links, Week A/B dates, shared comments, private upload metadata, settings, hashed sessions, audit/journal and large-value fragments.

Credential-bearing LegacySessions and LegacyPhotoUploads tab definitions remain empty compatibility markers; old sessions/passwords/upload receipts are not activated or imported. Real file contents must be reconciled separately. Historical review event data is retained; migrated shared staff-comment events require the explicit extraction performed by the preparation tool.

## Actual Google status

- School account source compatibility: awaiting configuration/authorisation.
- Apps Script web-app execution and browser permissions: not run.
- Google file-sharing and domain policy: not changed or tested against a school account.
- Live data migration / production parity: not asserted.
