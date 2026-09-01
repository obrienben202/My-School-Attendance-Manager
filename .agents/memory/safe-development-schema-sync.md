---
name: Safe development schema sync
description: How to handle development schema drift without risking populated course records.
---

Never use a forced Drizzle schema push when it offers to truncate populated course data in order to add or change a constraint. Inspect the proposed drift and preserve existing records; apply only reviewed, non-destructive development changes.

**Why:** The development database can lag the declared schema, and adding a unique source identifier caused the normal push to request a truncation confirmation even though the feature only needed missing additive columns for verification.

**How to apply:** When course-backed APIs fail because the development database is missing declared columns, inspect `information_schema` first. Do not force the push; separate safe additive changes from constraints or destructive operations.

For regression coverage of data transformations, do not make tests depend on the shared development database being fully synchronized. Seed the same extracted transformation used by production; reserve database-backed tests for behavior that specifically requires SQL or transaction semantics.

**Why:** Shared development schema drift can otherwise make deterministic report tests fail before they reach the behavior under test, while an attempted sync may be blocked by unrelated destructive changes.

**How to apply:** Keep production data loading thin and pass its typed records into a separately testable transformation. Never replace a required SQL integration test with this pattern merely to avoid provisioning an appropriate isolated database.