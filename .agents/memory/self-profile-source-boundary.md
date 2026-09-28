---
name: Self-profile source boundary
description: Source and identity constraints for optional contact and employment details.
---

For signed-in staff's optional contact and employment details, use the school's validated user directory matched by the authenticated account username. Do not infer identity from course staff names, let the client choose a staff ID, or treat a failed directory fetch as proof that fields are absent.

**Why:** The account record lacks most of these fields and name-based course/timetable entries are not authoritative identity links. Fetching the directory server-side avoids storing another copy of sensitive contact information and ensures the response cannot include other staff's records.

**How to apply:** Keep missing verified values null and show them as Not recorded, while showing a distinct error if the directory cannot be validated or reached. Never return the directory's password column or unknown columns.