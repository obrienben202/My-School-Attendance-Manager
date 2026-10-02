---
name: Termly ILP form associations
description: What Associated ILPs means for Year 7–11 groups and the canonical source for Headers.
---

For Year 7–11 groups, Associated ILPs should show Term 1, Term 2 and Term 3 forms, not a separate entry for every learner's review.

**Why:** The user explicitly selected the three-form interpretation when offered forms versus individual learner reviews.

**How to apply:** Keep form associations distinct from completion-monitor records. Preserve actual saved form versions rather than inventing counts or placeholder forms.

Headers reference the titles and introductions of the real versioned termly forms, rather than a separate editable demonstration catalogue.

**Why:** Independent sample headers can claim an edit succeeded while leaving the learner-facing form unchanged. A single canonical definition avoids that mismatch.

**How to apply:** Route header changes through the existing versioned template workflow. Editing a title must not rewrite historical published reviews.

The Groups form catalogue is display-only, not a saved association or a reason to block custom-group deletion. Keep the Year 7–11 defaults available; deleting a custom group must not delete forms or learner reviews.

**Why:** No template, term or review depends on group configuration. Treating the displayed forms as dependencies prevented every custom group from being deleted and misrepresented the data model.

**How to apply:** If real group-to-form assignments are introduced later, define and enforce their dependencies explicitly on the server instead of inferring them from shared catalogue visibility.

Group counts are limited to confirmed Year 7–11 roster learners. Unsupported filter fields must be rejected rather than stored as if evaluated.

**Why:** The previous demonstration filters implied selection capabilities and counts without an actual roster-backed calculation.

**How to apply:** Broaden supported filters only alongside genuine evaluation and matching-count tests; keep the supported learner scope clear in the editor.