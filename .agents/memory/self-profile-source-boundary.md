---
name: Self-profile source boundary
description: Source and identity constraints for optional contact and employment details.
---

For signed-in staff's optional contact and employment details, use the school's validated user directory matched by the authenticated account username. Do not infer identity from course staff names, let the client choose a staff ID, or treat a failed directory fetch as proof that fields are absent.

**Why:** The account record lacks most of these fields and name-based course/timetable entries are not authoritative identity links. Fetching the directory server-side ensures the response cannot include other staff's records. A bounded, process-local copy of only previously verified fields is an intentional exception to the no-copy preference so a short directory outage does not erase access to those details.

**How to apply:** Keep missing verified values null and show them as Not recorded; distinguish a validated missing account from an unreachable directory, and label any outage fallback as stale with its verification time. Invalid directory data must still fail closed. Never cache the raw directory, its password column, or unknown columns, and never reuse another account's copy.