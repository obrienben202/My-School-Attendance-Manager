---
name: Sessions source scope
description: Why missing courses in the daily Sessions source are not timetable deletions, and why alternating weeks have no inferred calendar.
---

The user maintains the Courses spreadsheet's session tab daily while populating it incrementally. A course absent from that tab, or a blank tab, is not an instruction to clear that course's timetable.

**Why:** The source is intentionally partial, not a complete replacement for the existing school timetable.

**How to apply:** Only a fully validated, nonempty snapshot can take over represented courses. Keep unrepresented course schedules and personal activities. Week A/B labels must be retained, but the user has not supplied a school-week calendar or term dates; do not invent one or change daily register semantics.

For every course listed in the validated Sessions sheet, that sheet is authoritative: retire older manual or other imported slots as well as superseded sheet-owned slots, while preserving attendance and register history.

**Why:** The user explicitly chose "All courses listed in the Sessions sheet" after seeing old manual timetable slots remain alongside an imported session.

**How to apply:** Limit retirement to active slots belonging to represented courses. Do not delete rows or repurpose manual register identities; do not change omitted courses merely because the source is partial.