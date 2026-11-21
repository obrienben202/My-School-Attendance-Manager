# Capacity and retention review

No school user counts, register concurrency or annual record volumes were supplied. Local fixtures are correctness tests, **not Google load tests**. This package is not attested for whole-school production capacity.

## Reviewed safeguards in the package

| Boundary | Limit / behaviour |
| --- | --- |
| Directory | 5,000 source accounts per configured audience; explicit failure above this |
| Table reads | Default 10,000 rows per tab, configurable 100–50,000 after review; no silent truncation |
| List response | 50 records maximum, scope/filter/search before paging |
| Register | Up to 200 current learners, with mandatory complete marks; multi-row writes are grouped where contiguous |
| Requests | 2.9 MB serialized envelope; file bytes at most 2 MB |
| Files | JPEG, PNG or PDF, MIME/magic checks and private parent; no video/large-document storage in cells |
| Large fields | Typed fields up to 250,000 serialized characters; review work up to 200,000; private fragment rows avoid Sheets' cell limit |
| Journal | Large plans/results use private integrity-checked fragments; total reviewed storage bounds still apply |
| Reports | 2,000 rows; an over-limit report stops with a clear message |
| Lock wait | 5 seconds; BUSY preserves drafts/request IDs for retry |
| Sign-in | At most 6 attempts per username/audience over a sliding cache window; global minute guard at 60 attempts |
| Sessions | Fixed 15–480 minutes, default 60, hashed bearer tokens only |

Google applies execution-duration, per-user/script concurrency and daily service quotas. Running as the owner means the per-user limits are particularly important. Service quotas and Workspace policies may change: check the actual school account and https://developers.google.com/apps-script/guides/services/quotas before deployment.

The workbook also has Google Sheets' finite cell budget. Attendance marks, immutable audit, journals, session history and record fragments grow over time. Raising MAX_TABLE_ROWS does not solve the workbook cell budget or make full-table reads cheap.

## Required school sizing

Record these before cutover:

1. Learners, staff, active courses, average roster size, daily lesson occurrences.
2. Expected concurrent register submissions during the busiest five minutes.
3. Daily marks = daily lesson occurrences × average roster size; multiply by required retention days.
4. Estimated physical cells including audit/journals/fragments, not only visible records.
5. Attachment count, size and retention; school-owned Drive storage available.
6. Required response-time/error targets, recovery time and backup/restore evidence.

Run a private Google test with agreed synthetic volumes, then record p50/p95 save time, BUSY rate, timeouts, duplicate checks, interrupted-save recovery and quota headroom. Do not extrapolate Node test timings to Apps Script.

## Retention

Do not delete school records or audit automatically. Agree a lawful school retention schedule and owner-reviewed archival process, with private backup and reconciliation first. Sessions and journals also require reviewed retention/expiry cleanup; token expiry denies access but does not erase the old row automatically.

Large-value fragments are content-addressed. Never delete fragments merely because an edit generated newer ones: historical journals may still reference them. A future approved archive must trace references across operational records and journals before pruning. When any cap is reached, the package stops rather than silently discarding history.
